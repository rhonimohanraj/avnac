import { getPublicApiBase } from './public-api-base'

// ---------- Types ----------

export type Folder = {
  id: string
  name: string
  parentFolderId: string | null
  brandKitId: string | null
  createdByUserId: string | null
  createdAt: string
  updatedAt: string
}

export type FolderWithKit = Folder & {
  brandKit: { id: string; name: string } | null
}

export type BrandKit = {
  id: string
  name: string
  createdByUserId: string | null
  createdAt: string
  updatedAt: string
}

export type BrandKitColor = {
  id: string
  brandKitId: string
  hex: string
  name: string | null
  position: number
  createdAt: string
}

export type BrandKitAssetKind = 'logo' | 'graphic'

export type BrandKitAsset = {
  id: string
  brandKitId: string
  kind: BrandKitAssetKind
  url: string
  name: string | null
  mimeType: string
  sizeBytes: number
  position: number
  createdAt: string
}

export type BrandKitFull = BrandKit & {
  colors: BrandKitColor[]
  assets: BrandKitAsset[]
}

export type ServerDocumentListItem = {
  id: string
  title: string | null
  folderId: string | null
  ownerUserId: string | null
  ownerName: string | null
  ownerEmail: string | null
  lastEditedByUserId: string | null
  lastEditedByName: string | null
  createdAt: string
  updatedAt: string
}

export type UploadResult = {
  url: string
  filename: string
  mimeType: string
  sizeBytes: number
  originalName: string
}

// ---------- Helpers ----------

async function readData<T>(response: Response, allow204 = false): Promise<T | null> {
  if (response.status === 204 && allow204) return null
  let payload: { data?: T; error?: string; message?: string } | null = null
  try {
    payload = (await response.json()) as { data?: T; error?: string; message?: string }
  } catch {
    payload = null
  }
  if (!response.ok) {
    throw new Error(
      payload?.error?.trim() ||
        payload?.message?.trim() ||
        `Request failed (${response.status})`,
    )
  }
  return (payload?.data ?? null) as T | null
}

function api(path: string): string {
  return `${getPublicApiBase()}${path}`
}

async function jsonRequest<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<T> {
  const init: RequestInit = {
    method,
    credentials: 'include',
  }
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  const response = await fetch(api(path), init)
  if (method === 'DELETE') {
    const data = await readData<T>(response, true)
    return (data ?? (null as unknown)) as T
  }
  const data = await readData<T>(response)
  return data as T
}

// ---------- Auth ----------

export type SessionUser = {
  id: string
  email: string
  name: string
  emailVerified: boolean
  image: string | null
}

export type SessionPayload = {
  user: SessionUser
  session: { id: string; expiresAt: string }
}

export async function fetchSession(): Promise<SessionPayload | null> {
  // Backend mounts /session at root level. Returns { data: SessionPayload | null }.
  const response = await fetch(api('/session'), { credentials: 'include' })
  if (!response.ok) return null
  try {
    const json = (await response.json()) as { data: SessionPayload | null }
    return json.data ?? null
  } catch {
    return null
  }
}

export async function signInWithEmail(email: string, password: string): Promise<SessionUser> {
  const response = await fetch(api('/auth/sign-in/email'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  })
  const json = (await response.json().catch(() => ({}))) as {
    user?: SessionUser
    message?: string
  }
  if (!response.ok || !json.user) {
    throw new Error(json.message || 'Sign in failed')
  }
  return json.user
}

export async function signUpWithEmail(input: {
  name: string
  email: string
  password: string
}): Promise<SessionUser> {
  const response = await fetch(api('/auth/sign-up/email'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  })
  const json = (await response.json().catch(() => ({}))) as {
    user?: SessionUser
    message?: string
  }
  if (!response.ok || !json.user) {
    throw new Error(json.message || 'Sign up failed')
  }
  return json.user
}

export async function signOut(): Promise<void> {
  await fetch(api('/auth/sign-out'), {
    method: 'POST',
    credentials: 'include',
  })
}

export async function requestPasswordReset(email: string, redirectTo: string): Promise<void> {
  // BetterAuth: POST /auth/forget-password with email + redirectTo. The redirectTo
  // is what we want the email link to point at (our /reset-password page on the
  // frontend). BetterAuth signs a token tied to that URL.
  const response = await fetch(api('/auth/forget-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, redirectTo }),
  })
  if (!response.ok) {
    const json = (await response.json().catch(() => ({}))) as { message?: string }
    throw new Error(json.message || 'Could not send reset email')
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const response = await fetch(api('/auth/reset-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token, newPassword }),
  })
  if (!response.ok) {
    const json = (await response.json().catch(() => ({}))) as { message?: string }
    throw new Error(json.message || 'Password reset failed')
  }
}

// ---------- Folders ----------

export async function listFolders(): Promise<Folder[]> {
  return jsonRequest<Folder[]>('/folders', 'GET')
}

export async function getFolder(id: string): Promise<FolderWithKit> {
  return jsonRequest<FolderWithKit>(`/folders/${id}`, 'GET')
}

export async function createFolder(input: {
  name: string
  parentFolderId?: string | null
  brandKitId?: string | null
}): Promise<Folder> {
  return jsonRequest<Folder>('/folders', 'POST', input)
}

export async function updateFolder(
  id: string,
  input: {
    name?: string
    parentFolderId?: string | null
    brandKitId?: string | null
  },
): Promise<Folder> {
  return jsonRequest<Folder>(`/folders/${id}`, 'PATCH', input)
}

export async function deleteFolder(id: string): Promise<void> {
  await jsonRequest<null>(`/folders/${id}`, 'DELETE')
}

// ---------- Brand Kits ----------

export async function listBrandKits(): Promise<BrandKit[]> {
  return jsonRequest<BrandKit[]>('/brand-kits', 'GET')
}

export async function getBrandKit(id: string): Promise<BrandKitFull> {
  return jsonRequest<BrandKitFull>(`/brand-kits/${id}`, 'GET')
}

export async function createBrandKit(input: { name: string }): Promise<BrandKit> {
  return jsonRequest<BrandKit>('/brand-kits', 'POST', input)
}

export async function updateBrandKit(id: string, input: { name: string }): Promise<BrandKit> {
  return jsonRequest<BrandKit>(`/brand-kits/${id}`, 'PATCH', input)
}

export async function deleteBrandKit(id: string): Promise<void> {
  await jsonRequest<null>(`/brand-kits/${id}`, 'DELETE')
}

export async function addBrandKitColor(
  kitId: string,
  input: { hex: string; name?: string | null; position?: number },
): Promise<BrandKitColor> {
  return jsonRequest<BrandKitColor>(`/brand-kits/${kitId}/colors`, 'POST', input)
}

export async function updateBrandKitColor(
  kitId: string,
  colorId: string,
  input: { hex?: string; name?: string | null; position?: number },
): Promise<BrandKitColor> {
  return jsonRequest<BrandKitColor>(`/brand-kits/${kitId}/colors/${colorId}`, 'PATCH', input)
}

export async function deleteBrandKitColor(kitId: string, colorId: string): Promise<void> {
  await jsonRequest<null>(`/brand-kits/${kitId}/colors/${colorId}`, 'DELETE')
}

export async function addBrandKitAsset(
  kitId: string,
  input: {
    kind: BrandKitAssetKind
    url: string
    mimeType: string
    sizeBytes: number
    name?: string | null
    position?: number
  },
): Promise<BrandKitAsset> {
  return jsonRequest<BrandKitAsset>(`/brand-kits/${kitId}/assets`, 'POST', input)
}

export async function updateBrandKitAsset(
  kitId: string,
  assetId: string,
  input: { name?: string | null; position?: number },
): Promise<BrandKitAsset> {
  return jsonRequest<BrandKitAsset>(`/brand-kits/${kitId}/assets/${assetId}`, 'PATCH', input)
}

export async function deleteBrandKitAsset(kitId: string, assetId: string): Promise<void> {
  await jsonRequest<null>(`/brand-kits/${kitId}/assets/${assetId}`, 'DELETE')
}

// ---------- Uploads ----------

export type TeamUploadListItem = {
  url: string
  filename: string
  mimeType: string
  sizeBytes: number
  modifiedAt: string
}

export async function listTeamUploads(): Promise<TeamUploadListItem[]> {
  return jsonRequest<TeamUploadListItem[]>('/uploads', 'GET')
}

export async function uploadAsset(file: Blob, filename?: string): Promise<UploadResult> {
  const form = new FormData()
  form.append('file', file, filename)
  const response = await fetch(api('/uploads'), {
    method: 'POST',
    credentials: 'include',
    body: form,
  })
  const data = await readData<UploadResult>(response)
  if (!data) throw new Error('Upload returned no data')
  return data
}

export function uploadUrl(urlPath: string): string {
  // Backend returns "/uploads/<filename>". For cross-origin frontend, prefix with API base.
  if (urlPath.startsWith('http://') || urlPath.startsWith('https://')) return urlPath
  return `${getPublicApiBase()}${urlPath}`
}

// ---------- Documents ----------

export async function listServerDocuments(): Promise<ServerDocumentListItem[]> {
  return jsonRequest<ServerDocumentListItem[]>('/documents', 'GET')
}

export type ServerDocumentDetail = {
  id: string
  title: string | null
  folderId: string | null
  ownerUserId: string | null
  lastEditedByUserId: string | null
  document: unknown
  vectorBoards: unknown
  vectorBoardDocs: unknown
  createdAt: string
  updatedAt: string
}

export async function getServerDocument(id: string): Promise<ServerDocumentDetail> {
  return jsonRequest<ServerDocumentDetail>(`/documents/${id}`, 'GET')
}

export async function saveServerDocument(
  id: string,
  payload: {
    document: unknown
    vectorBoards: unknown
    vectorBoardDocs: unknown
    title?: string | null
    folderId?: string | null
  },
): Promise<ServerDocumentDetail> {
  return jsonRequest<ServerDocumentDetail>(`/documents/${id}`, 'PUT', payload)
}

export async function patchServerDocument(
  id: string,
  input: { title?: string | null; folderId?: string | null },
): Promise<ServerDocumentDetail> {
  return jsonRequest<ServerDocumentDetail>(`/documents/${id}`, 'PATCH', input)
}

export async function deleteServerDocument(id: string): Promise<void> {
  await jsonRequest<null>(`/documents/${id}`, 'DELETE')
}
