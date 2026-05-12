import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import BrandKitEditor from '../components/brand-kit-editor'
import LibraryContextMenu, {
  type ContextMenuItem,
} from '../components/library-context-menu'
import {
  type BrandKit,
  createBrandKit,
  createFolder,
  deleteBrandKit,
  deleteFolder,
  deleteServerDocument,
  type Folder,
  listBrandKits,
  listFolders,
  listServerDocuments,
  patchServerDocument,
  type ServerDocumentListItem,
  updateFolder,
} from '../lib/avnac-server-api'
import { buildFolderTree, type FolderNode } from '../lib/avnac-library-tree'

type OpenMenu =
  | { kind: 'doc'; x: number; y: number; doc: ServerDocumentListItem }
  | { kind: 'folder'; x: number; y: number; folder: Folder }
  | null

export const Route = createFileRoute('/library')({
  component: LibraryPage,
})

function LibraryPage() {
  const navigate = useNavigate()
  const [folders, setFolders] = useState<Folder[]>([])
  const [kits, setKits] = useState<BrandKit[]>([])
  const [docs, setDocs] = useState<ServerDocumentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authError, setAuthError] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [editingBrandKitId, setEditingBrandKitId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [menu, setMenu] = useState<OpenMenu>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    setAuthError(false)
    try {
      const [f, k, d] = await Promise.all([listFolders(), listBrandKits(), listServerDocuments()])
      setFolders(f)
      setKits(k)
      setDocs(d)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/auth/i.test(msg) || /401/.test(msg)) setAuthError(true)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const tree = useMemo(() => buildFolderTree(folders), [folders])
  const selectedFolder = useMemo(
    () => folders.find(f => f.id === selectedFolderId) ?? null,
    [folders, selectedFolderId],
  )
  const selectedKit = useMemo(() => {
    if (!selectedFolder?.brandKitId) return null
    return kits.find(k => k.id === selectedFolder.brandKitId) ?? null
  }, [selectedFolder, kits])

  const childFolders = useMemo(() => {
    return folders
      .filter(f => f.parentFolderId === (selectedFolderId ?? null))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [folders, selectedFolderId])

  const folderDocs = useMemo(() => {
    return docs
      .filter(d => d.folderId === (selectedFolderId ?? null))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [docs, selectedFolderId])

  const breadcrumbs = useMemo(() => {
    const chain: Folder[] = []
    let cursor = selectedFolderId
    const byId = new Map(folders.map(f => [f.id, f]))
    const seen = new Set<string>()
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor)
      const node = byId.get(cursor)
      if (!node) break
      chain.unshift(node)
      cursor = node.parentFolderId
    }
    return chain
  }, [folders, selectedFolderId])

  const handleNewFolder = async () => {
    const name = window.prompt('Folder name')
    if (!name?.trim()) return
    try {
      await createFolder({ name: name.trim(), parentFolderId: selectedFolderId })
      await refresh()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to create folder')
    }
  }

  const handleNewBrandKit = async () => {
    const name = window.prompt('Brand kit name (e.g. "Trident Event Group")')
    if (!name?.trim()) return
    try {
      const kit = await createBrandKit({ name: name.trim() })
      await refresh()
      setEditingBrandKitId(kit.id)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to create brand kit')
    }
  }

  const handleRenameFolder = async (folder: Folder) => {
    const name = window.prompt('Rename folder', folder.name)
    if (!name?.trim() || name.trim() === folder.name) return
    try {
      await updateFolder(folder.id, { name: name.trim() })
      await refresh()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Rename failed')
    }
  }

  const handleDeleteFolder = async (folder: Folder) => {
    if (
      !window.confirm(
        `Delete folder "${folder.name}" and ALL its subfolders? (Designs inside will move to root.)`,
      )
    )
      return
    try {
      await deleteFolder(folder.id)
      if (selectedFolderId === folder.id) setSelectedFolderId(null)
      await refresh()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const handleAttachKit = async (folder: Folder) => {
    if (kits.length === 0) {
      window.alert('Create a brand kit first.')
      return
    }
    const choice = window.prompt(
      `Type the brand kit name to attach to "${folder.name}":\n\n${kits.map(k => `• ${k.name}`).join('\n')}`,
    )
    if (!choice) return
    const match = kits.find(k => k.name.toLowerCase() === choice.trim().toLowerCase())
    if (!match) {
      window.alert('No matching kit found.')
      return
    }
    try {
      await updateFolder(folder.id, { brandKitId: match.id })
      await refresh()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Attach failed')
    }
  }

  const handleDetachKit = async (folder: Folder) => {
    try {
      await updateFolder(folder.id, { brandKitId: null })
      await refresh()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Detach failed')
    }
  }

  const handleNewDesign = () => {
    const id = crypto.randomUUID()
    const params: Record<string, string | number> = { id, w: 1080, h: 1080 }
    if (selectedFolderId) params.folderId = selectedFolderId
    void navigate({ to: '/create', search: params as never })
  }

  const handleOpenDesign = (doc: ServerDocumentListItem) => {
    void navigate({ to: '/create', search: { id: doc.id } as never })
  }

  const handleDeleteDesign = async (doc: ServerDocumentListItem) => {
    if (!window.confirm(`Delete design "${doc.title ?? 'Untitled'}"?`)) return
    try {
      await deleteServerDocument(doc.id)
      await refresh()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const handleRenameDesign = async (doc: ServerDocumentListItem) => {
    const next = window.prompt('Rename design', doc.title ?? 'Untitled')
    if (next === null) return
    const trimmed = next.trim() || 'Untitled'
    if (trimmed === (doc.title ?? 'Untitled')) return
    try {
      await patchServerDocument(doc.id, { title: trimmed })
      await refresh()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Rename failed')
    }
  }

  const handleMoveDesign = async (doc: ServerDocumentListItem) => {
    const choices = ['root', ...folders.map(f => f.name)]
    const choice = window.prompt(
      `Move to which folder? Type "root" for top level.\n\nAvailable: ${choices.join(', ')}`,
      'root',
    )
    if (!choice) return
    const trimmed = choice.trim().toLowerCase()
    let folderId: string | null = null
    if (trimmed !== 'root' && trimmed !== '') {
      const match = folders.find(f => f.name.toLowerCase() === trimmed)
      if (!match) {
        window.alert(`No folder named "${choice}".`)
        return
      }
      folderId = match.id
    }
    try {
      await patchServerDocument(doc.id, { folderId })
      await refresh()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Move failed')
    }
  }

  const designMenuItems = (doc: ServerDocumentListItem): ContextMenuItem[] => [
    { label: 'Open', onClick: () => handleOpenDesign(doc) },
    { label: 'Rename', onClick: () => void handleRenameDesign(doc) },
    { label: 'Move to folder…', onClick: () => void handleMoveDesign(doc) },
    { label: '', onClick: () => undefined, divider: true },
    { label: 'Delete', onClick: () => void handleDeleteDesign(doc), danger: true },
  ]

  const folderMenuItems = (f: Folder): ContextMenuItem[] => [
    { label: 'Open', onClick: () => setSelectedFolderId(f.id) },
    { label: 'Rename', onClick: () => void handleRenameFolder(f) },
    {
      label: f.brandKitId ? 'Detach brand kit' : 'Attach brand kit…',
      onClick: () =>
        f.brandKitId ? void handleDetachKit(f) : void handleAttachKit(f),
    },
    { label: '', onClick: () => undefined, divider: true },
    { label: 'Delete', onClick: () => void handleDeleteFolder(f), danger: true },
  ]

  const openDocMenu = (e: React.MouseEvent, doc: ServerDocumentListItem) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ kind: 'doc', x: e.clientX, y: e.clientY, doc })
  }

  const openFolderMenu = (e: React.MouseEvent, f: Folder) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ kind: 'folder', x: e.clientX, y: e.clientY, folder: f })
  }

  const handleDeleteKit = async (kit: BrandKit) => {
    if (
      !window.confirm(
        `Delete brand kit "${kit.name}"? Folders attached to it will be detached. Colors/logos/graphics cascade-delete.`,
      )
    )
      return
    try {
      await deleteBrandKit(kit.id)
      await refresh()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  if (authError) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center p-6">
        <div className="max-w-md rounded-2xl bg-white p-8 shadow-xl">
          <h1 className="mb-2 text-xl font-semibold">Sign in required</h1>
          <p className="text-sm text-gray-600">
            The Library is only available to signed-in TEG team members.
          </p>
          <div className="mt-5 flex gap-2">
            <a
              href="/sign-in?next=/library"
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Sign in
            </a>
            <a
              href="/sign-in?mode=sign-up&next=/library"
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium ring-1 ring-gray-300 hover:bg-gray-50"
            >
              Create account
            </a>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex h-[100dvh] min-h-0 flex-col bg-[var(--surface-subtle,#f7f7f8)] text-[var(--text,#111)]">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold">Library</h1>
          <span className="text-xs text-gray-500">Shared TEG workspace</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleNewFolder}
            className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium ring-1 ring-gray-300 hover:bg-gray-50"
          >
            + Folder
          </button>
          <button
            type="button"
            onClick={handleNewBrandKit}
            className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium ring-1 ring-gray-300 hover:bg-gray-50"
          >
            + Brand kit
          </button>
          <button
            type="button"
            onClick={handleNewDesign}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            + New design
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className="flex w-64 flex-shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-white px-3 py-3 text-sm">
          <button
            type="button"
            onClick={() => setSelectedFolderId(null)}
            className={`mb-1 rounded-md px-2 py-1.5 text-left ${
              selectedFolderId === null ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'
            }`}
          >
            All files (root)
          </button>

          <div className="mt-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Folders
          </div>
          {tree.length === 0 ? (
            <p className="px-2 py-2 text-xs text-gray-400">No folders yet.</p>
          ) : (
            tree.map(node => (
              <FolderTreeNode
                key={node.id}
                node={node}
                level={0}
                selectedId={selectedFolderId}
                expanded={expanded}
                onSelect={id => setSelectedFolderId(id)}
                onToggle={id => {
                  setExpanded(prev => {
                    const next = new Set(prev)
                    if (next.has(id)) next.delete(id)
                    else next.add(id)
                    return next
                  })
                }}
                folders={folders}
                kits={kits}
              />
            ))
          )}

          <div className="mt-4 px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Brand kits
          </div>
          {kits.length === 0 ? (
            <p className="px-2 py-2 text-xs text-gray-400">No brand kits yet.</p>
          ) : (
            kits.map(kit => (
              <div key={kit.id} className="group flex items-center justify-between px-2 py-1">
                <button
                  type="button"
                  onClick={() => setEditingBrandKitId(kit.id)}
                  className="flex-1 truncate text-left text-sm hover:underline"
                  title="Edit brand kit"
                >
                  {kit.name}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteKit(kit)}
                  className="ml-2 hidden text-xs text-red-500 group-hover:block"
                  title="Delete"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </aside>

        {/* Main content */}
        <section className="min-w-0 flex-1 overflow-y-auto p-6">
          {error && !authError ? (
            <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : (
            <>
              <nav className="mb-4 flex items-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => setSelectedFolderId(null)}
                  className={selectedFolderId === null ? 'font-semibold' : 'text-gray-500 hover:underline'}
                >
                  Root
                </button>
                {breadcrumbs.map((f, i) => (
                  <span key={f.id} className="flex items-center gap-2">
                    <span className="text-gray-400">/</span>
                    <button
                      type="button"
                      onClick={() => setSelectedFolderId(f.id)}
                      className={
                        i === breadcrumbs.length - 1
                          ? 'font-semibold'
                          : 'text-gray-500 hover:underline'
                      }
                    >
                      {f.name}
                    </button>
                  </span>
                ))}
              </nav>

              {selectedFolder ? (
                <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 ring-1 ring-gray-200">
                  {selectedKit ? (
                    <>
                      <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-900">
                        Brand kit · {selectedKit.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingBrandKitId(selectedKit.id)}
                        className="rounded-md bg-white px-3 py-1 text-xs font-medium ring-1 ring-gray-300 hover:bg-gray-50"
                      >
                        Edit brand kit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDetachKit(selectedFolder)}
                        className="rounded-md bg-white px-3 py-1 text-xs font-medium text-red-600 ring-1 ring-gray-300 hover:bg-gray-50"
                      >
                        Detach
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleAttachKit(selectedFolder)}
                      className="rounded-md bg-white px-3 py-1 text-xs font-medium ring-1 ring-gray-300 hover:bg-gray-50"
                    >
                      + Attach brand kit
                    </button>
                  )}
                  <span className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleRenameFolder(selectedFolder)}
                      className="rounded-md bg-white px-3 py-1 text-xs font-medium ring-1 ring-gray-300 hover:bg-gray-50"
                    >
                      Rename folder
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteFolder(selectedFolder)}
                      className="rounded-md bg-white px-3 py-1 text-xs font-medium text-red-600 ring-1 ring-gray-300 hover:bg-gray-50"
                    >
                      Delete folder
                    </button>
                  </span>
                </div>
              ) : null}

              {childFolders.length > 0 && (
                <section className="mb-8">
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Folders
                  </h2>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                    {childFolders.map(f => {
                      const kit = f.brandKitId ? kits.find(k => k.id === f.brandKitId) : null
                      return (
                        <div
                          key={f.id}
                          className="group relative flex aspect-[5/4] flex-col items-start justify-between rounded-xl bg-white p-3 text-left ring-1 ring-gray-200 hover:ring-gray-400"
                          onContextMenu={e => openFolderMenu(e, f)}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedFolderId(f.id)}
                            className="absolute inset-0 cursor-pointer"
                            aria-label={`Open ${f.name}`}
                          />
                          <span className="pointer-events-none relative text-3xl">📁</span>
                          <div className="pointer-events-none relative w-full">
                            <p className="truncate text-sm font-medium">{f.name}</p>
                            {kit ? (
                              <p className="truncate text-xs text-indigo-600">
                                ✦ {kit.name}
                              </p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={e => openFolderMenu(e, f)}
                            aria-label="More actions"
                            className="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-md text-gray-500 opacity-0 ring-1 ring-gray-200 transition hover:bg-white hover:text-gray-900 group-hover:opacity-100"
                            title="More"
                          >
                            ⋯
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Designs {folderDocs.length > 0 && `(${folderDocs.length})`}
                  </h2>
                  <button
                    type="button"
                    onClick={handleNewDesign}
                    className="rounded-md bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-800"
                  >
                    + New design here
                  </button>
                </div>
                {folderDocs.length === 0 ? (
                  <p className="rounded-md bg-white px-4 py-6 text-center text-sm text-gray-400 ring-1 ring-gray-200">
                    No designs in {selectedFolder ? `"${selectedFolder.name}"` : 'root'} yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                    {folderDocs.map(doc => (
                      <div
                        key={doc.id}
                        className="group relative flex aspect-[5/4] flex-col items-start justify-between rounded-xl bg-white p-3 text-left ring-1 ring-gray-200 hover:ring-gray-400"
                        onContextMenu={e => openDocMenu(e, doc)}
                      >
                        <button
                          type="button"
                          onClick={() => handleOpenDesign(doc)}
                          className="flex h-full w-full flex-col items-start justify-between text-left"
                        >
                          <span className="text-3xl">🎨</span>
                          <div className="w-full">
                            <p className="truncate text-sm font-medium">
                              {doc.title ?? 'Untitled'}
                            </p>
                            <p className="truncate text-xs text-gray-500">
                              {doc.lastEditedByName ?? doc.ownerName ?? 'Unknown'} ·{' '}
                              {new Date(doc.updatedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={e => openDocMenu(e, doc)}
                          aria-label="More actions"
                          className="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-md bg-white text-gray-500 opacity-0 ring-1 ring-gray-200 transition hover:text-gray-900 group-hover:opacity-100"
                          title="More"
                        >
                          ⋯
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </section>
      </div>

      {editingBrandKitId ? (
        <BrandKitEditor
          brandKitId={editingBrandKitId}
          onClose={() => {
            setEditingBrandKitId(null)
            void refresh()
          }}
        />
      ) : null}

      {menu ? (
        <LibraryContextMenu
          x={menu.x}
          y={menu.y}
          items={
            menu.kind === 'doc' ? designMenuItems(menu.doc) : folderMenuItems(menu.folder)
          }
          onClose={() => setMenu(null)}
        />
      ) : null}
    </main>
  )
}

function FolderTreeNode({
  node,
  level,
  selectedId,
  expanded,
  onSelect,
  onToggle,
  folders,
  kits,
}: {
  node: FolderNode
  level: number
  selectedId: string | null
  expanded: Set<string>
  onSelect: (id: string) => void
  onToggle: (id: string) => void
  folders: Folder[]
  kits: BrandKit[]
}) {
  const isExpanded = expanded.has(node.id)
  const isSelected = node.id === selectedId
  const hasChildren = node.children.length > 0
  const kit = node.brandKitId ? kits.find(k => k.id === node.brandKitId) : null
  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded-md px-2 py-1 ${
          isSelected ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'
        }`}
        style={{ paddingLeft: 8 + level * 12 }}
      >
        <button
          type="button"
          onClick={() => onToggle(node.id)}
          className="w-3 flex-shrink-0 text-xs"
        >
          {hasChildren ? (isExpanded ? '▾' : '▸') : ''}
        </button>
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className="flex-1 truncate text-left"
          title={kit ? `${node.name} (${kit.name})` : node.name}
        >
          {node.name}
          {kit ? <span className="ml-1 text-[10px]">✦</span> : null}
        </button>
      </div>
      {isExpanded
        ? node.children.map(child => (
            <FolderTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              expanded={expanded}
              onSelect={onSelect}
              onToggle={onToggle}
              folders={folders}
              kits={kits}
            />
          ))
        : null}
    </div>
  )
}
