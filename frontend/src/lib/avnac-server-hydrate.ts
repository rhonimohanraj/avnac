import { getServerDocument } from './avnac-server-api'
import { parseAvnacDocument } from './avnac-document'
import {
  saveVectorBoardDocs,
  saveVectorBoards,
} from './avnac-vector-boards-storage'

const STORE = 'documents'
const DB_NAME = 'avnac-editor'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('idb open failed'))
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
  })
}

async function writeIdbRecord(
  id: string,
  document: unknown,
  name: string,
  updatedAt: number,
): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.onerror = () => reject(tx.error ?? new Error('idb write failed'))
      tx.oncomplete = () => resolve()
      tx.objectStore(STORE).put({ id, updatedAt, document, name })
    })
  } finally {
    db.close()
  }
}

/**
 * Hydrate a document from the server into local IndexedDB + vector-board localStorage.
 * Called on /create mount when the editor wants to open a doc that may exist
 * on the team-shared server but not yet in this browser.
 *
 * Returns:
 *  - `'server'` — found on server, IDB written, editor can proceed
 *  - `'local-only'` — not on server (404), editor falls back to whatever IDB has
 *  - `'unauthorized'` — caller is not signed in; treat as local-only
 */
export type HydrateResult = 'server' | 'local-only' | 'unauthorized'

export async function hydrateDocumentFromServer(id: string): Promise<HydrateResult> {
  try {
    const remote = await getServerDocument(id)
    const parsed = parseAvnacDocument(remote.document)
    if (!parsed) return 'local-only'
    const updatedAt = Date.parse(remote.updatedAt) || Date.now()
    const name = remote.title?.trim() || 'Untitled'
    await writeIdbRecord(id, parsed, name, updatedAt)
    if (Array.isArray(remote.vectorBoards)) {
      saveVectorBoards(id, remote.vectorBoards as never)
    }
    if (remote.vectorBoardDocs && typeof remote.vectorBoardDocs === 'object') {
      saveVectorBoardDocs(id, remote.vectorBoardDocs as never)
    }
    return 'server'
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/401|auth/i.test(msg)) return 'unauthorized'
    return 'local-only'
  }
}
