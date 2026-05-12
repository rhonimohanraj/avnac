import type { Folder } from './avnac-server-api'

export type FolderNode = Folder & {
  children: FolderNode[]
}

export function buildFolderTree(folders: Folder[]): FolderNode[] {
  const byId = new Map<string, FolderNode>()
  for (const f of folders) {
    byId.set(f.id, { ...f, children: [] })
  }
  const roots: FolderNode[] = []
  for (const node of byId.values()) {
    if (node.parentFolderId && byId.has(node.parentFolderId)) {
      byId.get(node.parentFolderId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sortRecursive = (nodes: FolderNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name))
    for (const n of nodes) sortRecursive(n.children)
  }
  sortRecursive(roots)
  return roots
}

export function folderAncestors(folders: Folder[], folderId: string): Folder[] {
  // Returns the folder chain from folderId up to root (inclusive, root last).
  const byId = new Map(folders.map(f => [f.id, f]))
  const chain: Folder[] = []
  let cursor: string | null = folderId
  const seen = new Set<string>()
  while (cursor) {
    if (seen.has(cursor)) break
    seen.add(cursor)
    const node = byId.get(cursor)
    if (!node) break
    chain.push(node)
    cursor = node.parentFolderId
  }
  return chain
}

export function nearestBrandKitId(folders: Folder[], folderId: string | null): string | null {
  if (!folderId) return null
  for (const ancestor of folderAncestors(folders, folderId)) {
    if (ancestor.brandKitId) return ancestor.brandKitId
  }
  return null
}
