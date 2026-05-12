import { createReadStream } from 'node:fs'
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Elysia } from 'elysia'
import { auth } from '../auth'
import { env } from '../config/env'
import { HttpError } from '../lib/http'

const UPLOADS_DIR = resolve(env.UPLOADS_DIR ?? './uploads')

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/svg+xml',
  'image/webp',
])

const MAX_BYTES = 5 * 1024 * 1024 // 5MB

const MIME_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/svg+xml': '.svg',
  'image/webp': '.webp',
}

async function requireAuth(headers: Headers) {
  const session = await auth.api.getSession({ headers })
  if (!session) throw new HttpError(401, 'Authentication required')
  return session
}

async function ensureUploadsDir() {
  await mkdir(UPLOADS_DIR, { recursive: true })
}

const EXT_TO_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

export const uploadsRoutes = new Elysia()
  .get('/uploads', async ({ request, set }) => {
    // Team-shared inventory of every uploaded image (logos, graphics, editor
    // drops). Returns newest-first. Anyone signed in sees everything.
    await requireAuth(request.headers)
    await ensureUploadsDir()
    const entries = await readdir(UPLOADS_DIR)
    const items: Array<{
      url: string
      filename: string
      mimeType: string
      sizeBytes: number
      modifiedAt: string
    }> = []
    for (const filename of entries) {
      if (filename.startsWith('.')) continue
      const ext = extname(filename).toLowerCase()
      const mime = EXT_TO_MIME[ext]
      if (!mime) continue
      try {
        const fileStat = await stat(join(UPLOADS_DIR, filename))
        if (!fileStat.isFile()) continue
        items.push({
          url: `/uploads/${filename}`,
          filename,
          mimeType: mime,
          sizeBytes: fileStat.size,
          modifiedAt: fileStat.mtime.toISOString(),
        })
      } catch {
        /* skip unreadable */
      }
    }
    items.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
    set.status = 200
    return { data: items }
  })
  .post(
    '/uploads',
    async ({ request, body, set }) => {
      await requireAuth(request.headers)
      await ensureUploadsDir()

      const payload = body as { file?: File }
      const file = payload.file
      if (!(file instanceof File)) {
        throw new HttpError(400, 'Missing "file" form field')
      }
      if (!ALLOWED_MIME.has(file.type)) {
        throw new HttpError(
          400,
          `Unsupported mime type ${file.type}; allowed: ${[...ALLOWED_MIME].join(', ')}`,
        )
      }
      if (file.size <= 0) {
        throw new HttpError(400, 'Empty file')
      }
      if (file.size > MAX_BYTES) {
        throw new HttpError(
          413,
          `File too large; max ${MAX_BYTES} bytes, got ${file.size}`,
        )
      }

      const ext = MIME_EXT[file.type] ?? (extname(file.name) || '.bin')
      const filename = `${randomUUID()}${ext}`
      const fullPath = join(UPLOADS_DIR, filename)
      const buffer = Buffer.from(await file.arrayBuffer())
      await writeFile(fullPath, buffer)

      set.status = 201
      return {
        data: {
          url: `/uploads/${filename}`,
          filename,
          mimeType: file.type,
          sizeBytes: file.size,
          originalName: file.name,
        },
      }
    },
  )
  .get('/uploads/:filename', async ({ params, set }) => {
    // Reject path traversal: filename must be a single segment.
    if (params.filename.includes('/') || params.filename.includes('..')) {
      throw new HttpError(400, 'Invalid filename')
    }
    const fullPath = join(UPLOADS_DIR, params.filename)
    try {
      const fileStat = await stat(fullPath)
      if (!fileStat.isFile()) throw new HttpError(404, 'Not found')
    } catch {
      throw new HttpError(404, 'Not found')
    }
    const ext = extname(params.filename).toLowerCase()
    const mime =
      ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : ext === '.svg'
            ? 'image/svg+xml'
            : ext === '.webp'
              ? 'image/webp'
              : 'application/octet-stream'
    set.headers['content-type'] = mime
    set.headers['cache-control'] = 'public, max-age=31536000, immutable'
    return createReadStream(fullPath)
  })
