import { asc, eq, isNull } from 'drizzle-orm'
import { Elysia, t } from 'elysia'
import { z } from 'zod'
import { auth } from '../auth'
import { db } from '../db'
import { brandKit, folder } from '../db/schema'
import { HttpError } from '../lib/http'

const folderCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  parentFolderId: z.string().uuid().nullable().optional(),
  brandKitId: z.string().uuid().nullable().optional(),
})

const folderUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  parentFolderId: z.string().uuid().nullable().optional(),
  brandKitId: z.string().uuid().nullable().optional(),
})

async function requireAuth(headers: Headers) {
  const session = await auth.api.getSession({ headers })
  if (!session) throw new HttpError(401, 'Authentication required')
  return session
}

async function isDescendant(parentId: string, candidateChildId: string): Promise<boolean> {
  // Walk up from candidateChildId; if we hit parentId, the candidate IS a descendant of parent.
  // Used to prevent cycles when moving folders.
  let cursor: string | null = candidateChildId
  const seen = new Set<string>()
  while (cursor) {
    if (cursor === parentId) return true
    if (seen.has(cursor)) return false
    seen.add(cursor)
    const [row] = await db
      .select({ parentFolderId: folder.parentFolderId })
      .from(folder)
      .where(eq(folder.id, cursor))
      .limit(1)
    cursor = row?.parentFolderId ?? null
  }
  return false
}

export const foldersRoutes = new Elysia({ prefix: '/folders' })
  .get('/', async ({ request, set }) => {
    await requireAuth(request.headers)
    const rows = await db
      .select({
        id: folder.id,
        name: folder.name,
        parentFolderId: folder.parentFolderId,
        brandKitId: folder.brandKitId,
        createdByUserId: folder.createdByUserId,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
      })
      .from(folder)
      .orderBy(asc(folder.name))
    set.status = 200
    return { data: rows }
  })
  .get('/:id', async ({ request, params, set }) => {
    await requireAuth(request.headers)
    const row = await db.query.folder.findFirst({
      where: eq(folder.id, params.id),
    })
    if (!row) throw new HttpError(404, 'Folder not found')
    let attachedBrandKit = null
    if (row.brandKitId) {
      attachedBrandKit = await db.query.brandKit.findFirst({
        where: eq(brandKit.id, row.brandKitId),
        columns: { id: true, name: true },
      })
    }
    set.status = 200
    return { data: { ...row, brandKit: attachedBrandKit } }
  })
  .post('/', async ({ request, body, set }) => {
    const session = await requireAuth(request.headers)
    const payload = folderCreateSchema.parse(body)
    if (payload.parentFolderId) {
      const parent = await db.query.folder.findFirst({
        where: eq(folder.id, payload.parentFolderId),
        columns: { id: true },
      })
      if (!parent) throw new HttpError(400, 'parentFolderId does not exist')
    }
    if (payload.brandKitId) {
      const kit = await db.query.brandKit.findFirst({
        where: eq(brandKit.id, payload.brandKitId),
        columns: { id: true },
      })
      if (!kit) throw new HttpError(400, 'brandKitId does not exist')
    }
    const [created] = await db
      .insert(folder)
      .values({
        name: payload.name,
        parentFolderId: payload.parentFolderId ?? null,
        brandKitId: payload.brandKitId ?? null,
        createdByUserId: session.user.id,
      })
      .returning()
    set.status = 201
    return { data: created }
  })
  .patch('/:id', async ({ request, params, body, set }) => {
    await requireAuth(request.headers)
    const payload = folderUpdateSchema.parse(body)
    const existing = await db.query.folder.findFirst({ where: eq(folder.id, params.id) })
    if (!existing) throw new HttpError(404, 'Folder not found')

    if (payload.parentFolderId !== undefined && payload.parentFolderId !== null) {
      if (payload.parentFolderId === params.id) {
        throw new HttpError(400, 'A folder cannot be its own parent')
      }
      const wouldCycle = await isDescendant(params.id, payload.parentFolderId)
      if (wouldCycle) {
        throw new HttpError(400, 'Move would create a folder cycle')
      }
      const parent = await db.query.folder.findFirst({
        where: eq(folder.id, payload.parentFolderId),
        columns: { id: true },
      })
      if (!parent) throw new HttpError(400, 'parentFolderId does not exist')
    }

    if (payload.brandKitId !== undefined && payload.brandKitId !== null) {
      const kit = await db.query.brandKit.findFirst({
        where: eq(brandKit.id, payload.brandKitId),
        columns: { id: true },
      })
      if (!kit) throw new HttpError(400, 'brandKitId does not exist')
    }

    const [updated] = await db
      .update(folder)
      .set({
        ...(payload.name !== undefined && { name: payload.name }),
        ...(payload.parentFolderId !== undefined && {
          parentFolderId: payload.parentFolderId,
        }),
        ...(payload.brandKitId !== undefined && { brandKitId: payload.brandKitId }),
        updatedAt: new Date(),
      })
      .where(eq(folder.id, params.id))
      .returning()
    set.status = 200
    return { data: updated }
  })
  .delete('/:id', async ({ request, params, set }) => {
    await requireAuth(request.headers)
    const existing = await db.query.folder.findFirst({ where: eq(folder.id, params.id) })
    if (!existing) throw new HttpError(404, 'Folder not found')
    await db.delete(folder).where(eq(folder.id, params.id))
    set.status = 204
    return null
  })
