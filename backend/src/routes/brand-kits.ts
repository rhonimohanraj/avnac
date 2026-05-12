import { and, asc, desc, eq } from 'drizzle-orm'
import { Elysia } from 'elysia'
import { z } from 'zod'
import { auth } from '../auth'
import { db } from '../db'
import { brandKit, brandKitAsset, brandKitColor } from '../db/schema'
import { HttpError } from '../lib/http'

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const ASSET_KINDS = ['logo', 'graphic'] as const

const brandKitCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
})

const brandKitUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
})

const colorCreateSchema = z.object({
  hex: z.string().regex(HEX, 'Must be #RGB, #RRGGBB, or #RRGGBBAA'),
  name: z.string().trim().max(80).optional().nullable(),
  position: z.number().int().min(0).optional(),
})

const colorUpdateSchema = z.object({
  hex: z.string().regex(HEX).optional(),
  name: z.string().trim().max(80).nullable().optional(),
  position: z.number().int().min(0).optional(),
})

const assetCreateSchema = z.object({
  kind: z.enum(ASSET_KINDS),
  url: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  name: z.string().trim().max(120).nullable().optional(),
  position: z.number().int().min(0).optional(),
})

const assetUpdateSchema = z.object({
  name: z.string().trim().max(120).nullable().optional(),
  position: z.number().int().min(0).optional(),
})

async function requireAuth(headers: Headers) {
  const session = await auth.api.getSession({ headers })
  if (!session) throw new HttpError(401, 'Authentication required')
  return session
}

async function getKitOr404(id: string) {
  const row = await db.query.brandKit.findFirst({ where: eq(brandKit.id, id) })
  if (!row) throw new HttpError(404, 'Brand kit not found')
  return row
}

export const brandKitsRoutes = new Elysia({ prefix: '/brand-kits' })
  .get('/', async ({ request, set }) => {
    await requireAuth(request.headers)
    const rows = await db.select().from(brandKit).orderBy(asc(brandKit.name))
    set.status = 200
    return { data: rows }
  })
  .get('/:id', async ({ request, params, set }) => {
    await requireAuth(request.headers)
    const kit = await getKitOr404(params.id)
    const colors = await db
      .select()
      .from(brandKitColor)
      .where(eq(brandKitColor.brandKitId, params.id))
      .orderBy(asc(brandKitColor.position), asc(brandKitColor.createdAt))
    const assets = await db
      .select()
      .from(brandKitAsset)
      .where(eq(brandKitAsset.brandKitId, params.id))
      .orderBy(asc(brandKitAsset.position), asc(brandKitAsset.createdAt))
    set.status = 200
    return { data: { ...kit, colors, assets } }
  })
  .post('/', async ({ request, body, set }) => {
    const session = await requireAuth(request.headers)
    const payload = brandKitCreateSchema.parse(body)
    const [created] = await db
      .insert(brandKit)
      .values({ name: payload.name, createdByUserId: session.user.id })
      .returning()
    set.status = 201
    return { data: created }
  })
  .patch('/:id', async ({ request, params, body, set }) => {
    await requireAuth(request.headers)
    const payload = brandKitUpdateSchema.parse(body)
    await getKitOr404(params.id)
    const [updated] = await db
      .update(brandKit)
      .set({
        ...(payload.name !== undefined && { name: payload.name }),
        updatedAt: new Date(),
      })
      .where(eq(brandKit.id, params.id))
      .returning()
    set.status = 200
    return { data: updated }
  })
  .delete('/:id', async ({ request, params, set }) => {
    await requireAuth(request.headers)
    await getKitOr404(params.id)
    await db.delete(brandKit).where(eq(brandKit.id, params.id))
    set.status = 204
    return null
  })
  // Colors
  .post('/:id/colors', async ({ request, params, body, set }) => {
    await requireAuth(request.headers)
    await getKitOr404(params.id)
    const payload = colorCreateSchema.parse(body)
    let position = payload.position ?? 0
    if (payload.position === undefined) {
      const [last] = await db
        .select({ position: brandKitColor.position })
        .from(brandKitColor)
        .where(eq(brandKitColor.brandKitId, params.id))
        .orderBy(desc(brandKitColor.position))
        .limit(1)
      position = (last?.position ?? -1) + 1
    }
    const [created] = await db
      .insert(brandKitColor)
      .values({
        brandKitId: params.id,
        hex: payload.hex.toUpperCase(),
        name: payload.name ?? null,
        position,
      })
      .returning()
    set.status = 201
    return { data: created }
  })
  .patch('/:id/colors/:colorId', async ({ request, params, body, set }) => {
    await requireAuth(request.headers)
    const payload = colorUpdateSchema.parse(body)
    const existing = await db.query.brandKitColor.findFirst({
      where: and(
        eq(brandKitColor.id, params.colorId),
        eq(brandKitColor.brandKitId, params.id),
      ),
    })
    if (!existing) throw new HttpError(404, 'Color not found in this brand kit')
    const [updated] = await db
      .update(brandKitColor)
      .set({
        ...(payload.hex !== undefined && { hex: payload.hex.toUpperCase() }),
        ...(payload.name !== undefined && { name: payload.name }),
        ...(payload.position !== undefined && { position: payload.position }),
      })
      .where(eq(brandKitColor.id, params.colorId))
      .returning()
    set.status = 200
    return { data: updated }
  })
  .delete('/:id/colors/:colorId', async ({ request, params, set }) => {
    await requireAuth(request.headers)
    const existing = await db.query.brandKitColor.findFirst({
      where: and(
        eq(brandKitColor.id, params.colorId),
        eq(brandKitColor.brandKitId, params.id),
      ),
    })
    if (!existing) throw new HttpError(404, 'Color not found')
    await db.delete(brandKitColor).where(eq(brandKitColor.id, params.colorId))
    set.status = 204
    return null
  })
  // Assets (logos + graphics)
  .post('/:id/assets', async ({ request, params, body, set }) => {
    await requireAuth(request.headers)
    await getKitOr404(params.id)
    const payload = assetCreateSchema.parse(body)
    let position = payload.position ?? 0
    if (payload.position === undefined) {
      const [last] = await db
        .select({ position: brandKitAsset.position })
        .from(brandKitAsset)
        .where(
          and(
            eq(brandKitAsset.brandKitId, params.id),
            eq(brandKitAsset.kind, payload.kind),
          ),
        )
        .orderBy(desc(brandKitAsset.position))
        .limit(1)
      position = (last?.position ?? -1) + 1
    }
    const [created] = await db
      .insert(brandKitAsset)
      .values({
        brandKitId: params.id,
        kind: payload.kind,
        name: payload.name ?? null,
        url: payload.url,
        mimeType: payload.mimeType,
        sizeBytes: payload.sizeBytes,
        position,
      })
      .returning()
    set.status = 201
    return { data: created }
  })
  .patch('/:id/assets/:assetId', async ({ request, params, body, set }) => {
    await requireAuth(request.headers)
    const payload = assetUpdateSchema.parse(body)
    const existing = await db.query.brandKitAsset.findFirst({
      where: and(
        eq(brandKitAsset.id, params.assetId),
        eq(brandKitAsset.brandKitId, params.id),
      ),
    })
    if (!existing) throw new HttpError(404, 'Asset not found in this brand kit')
    const [updated] = await db
      .update(brandKitAsset)
      .set({
        ...(payload.name !== undefined && { name: payload.name }),
        ...(payload.position !== undefined && { position: payload.position }),
      })
      .where(eq(brandKitAsset.id, params.assetId))
      .returning()
    set.status = 200
    return { data: updated }
  })
  .delete('/:id/assets/:assetId', async ({ request, params, set }) => {
    await requireAuth(request.headers)
    const existing = await db.query.brandKitAsset.findFirst({
      where: and(
        eq(brandKitAsset.id, params.assetId),
        eq(brandKitAsset.brandKitId, params.id),
      ),
    })
    if (!existing) throw new HttpError(404, 'Asset not found')
    await db.delete(brandKitAsset).where(eq(brandKitAsset.id, params.assetId))
    set.status = 204
    return null
  })
