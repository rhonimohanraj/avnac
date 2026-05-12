import { aliasedTable, desc, eq, isNull } from 'drizzle-orm'
import { Elysia } from 'elysia'
import { z } from 'zod'
import { auth } from '../auth'
import { db } from '../db'
import { document, folder, user } from '../db/schema'
import { documentPayloadSchema } from '../lib/editor-schema'
import { HttpError } from '../lib/http'

const putBodySchema = documentPayloadSchema.extend({
  title: z.string().trim().max(200).nullable().optional(),
  folderId: z.string().uuid().nullable().optional(),
})

async function requireAuth(headers: Headers) {
  const session = await auth.api.getSession({ headers })
  if (!session) throw new HttpError(401, 'Authentication required')
  return session
}

export const documentsRoutes = new Elysia({ prefix: '/documents' })
  .get('/', async ({ request, set }) => {
    await requireAuth(request.headers)
    const owner = aliasedTable(user, 'owner')
    const editor = aliasedTable(user, 'editor')
    const rows = await db
      .select({
        id: document.id,
        title: document.title,
        folderId: document.folderId,
        ownerUserId: document.ownerUserId,
        ownerName: owner.name,
        ownerEmail: owner.email,
        lastEditedByUserId: document.lastEditedByUserId,
        lastEditedByName: editor.name,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      })
      .from(document)
      .leftJoin(owner, eq(owner.id, document.ownerUserId))
      .leftJoin(editor, eq(editor.id, document.lastEditedByUserId))
      .orderBy(desc(document.updatedAt))
    set.status = 200
    return { data: rows }
  })
  .get('/:id', async ({ request, params, set }) => {
    await requireAuth(request.headers)
    const row = await db.query.document.findFirst({
      where: eq(document.id, params.id),
    })
    if (!row) throw new HttpError(404, 'Document not found')
    set.status = 200
    return {
      data: {
        id: row.id,
        title: row.title,
        folderId: row.folderId,
        ownerUserId: row.ownerUserId,
        lastEditedByUserId: row.lastEditedByUserId,
        document: row.document,
        vectorBoards: row.vectorBoards,
        vectorBoardDocs: row.vectorBoardDocs,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    }
  })
  .put('/:id', async ({ request, body, params, set }) => {
    const session = await requireAuth(request.headers)
    const payload = putBodySchema.parse(body)

    if (payload.folderId) {
      const exists = await db.query.folder.findFirst({
        where: eq(folder.id, payload.folderId),
        columns: { id: true },
      })
      if (!exists) throw new HttpError(400, 'folderId does not exist')
    }

    const existing = await db.query.document.findFirst({
      where: eq(document.id, params.id),
    })

    const now = new Date()

    if (!existing) {
      const [created] = await db
        .insert(document)
        .values({
          id: params.id,
          ownerUserId: session.user.id,
          lastEditedByUserId: session.user.id,
          title: payload.title ?? null,
          folderId: payload.folderId ?? null,
          document: payload.document,
          vectorBoards: payload.vectorBoards,
          vectorBoardDocs: payload.vectorBoardDocs,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
      set.status = 201
      return { data: created }
    }

    const [updated] = await db
      .update(document)
      .set({
        lastEditedByUserId: session.user.id,
        ...(payload.title !== undefined && { title: payload.title }),
        ...(payload.folderId !== undefined && { folderId: payload.folderId }),
        document: payload.document,
        vectorBoards: payload.vectorBoards,
        vectorBoardDocs: payload.vectorBoardDocs,
        updatedAt: now,
      })
      .where(eq(document.id, params.id))
      .returning()
    set.status = 200
    return { data: updated }
  })
  .patch('/:id', async ({ request, body, params, set }) => {
    // Metadata-only update (title, folderId). Avoids re-sending the full doc payload.
    const session = await requireAuth(request.headers)
    const payload = z
      .object({
        title: z.string().trim().max(200).nullable().optional(),
        folderId: z.string().uuid().nullable().optional(),
      })
      .parse(body)

    if (payload.folderId) {
      const exists = await db.query.folder.findFirst({
        where: eq(folder.id, payload.folderId),
        columns: { id: true },
      })
      if (!exists) throw new HttpError(400, 'folderId does not exist')
    }

    const existing = await db.query.document.findFirst({
      where: eq(document.id, params.id),
      columns: { id: true },
    })
    if (!existing) throw new HttpError(404, 'Document not found')

    const [updated] = await db
      .update(document)
      .set({
        lastEditedByUserId: session.user.id,
        ...(payload.title !== undefined && { title: payload.title }),
        ...(payload.folderId !== undefined && { folderId: payload.folderId }),
        updatedAt: new Date(),
      })
      .where(eq(document.id, params.id))
      .returning()
    set.status = 200
    return { data: updated }
  })
  .delete('/:id', async ({ request, params, set }) => {
    await requireAuth(request.headers)
    const existing = await db.query.document.findFirst({
      where: eq(document.id, params.id),
      columns: { id: true },
    })
    if (!existing) throw new HttpError(404, 'Document not found')
    await db.delete(document).where(eq(document.id, params.id))
    set.status = 204
    return null
  })
