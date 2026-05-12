import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addBrandKitAsset,
  addBrandKitColor,
  type BrandKitAsset,
  type BrandKitAssetKind,
  type BrandKitColor,
  type BrandKitFull,
  deleteBrandKitAsset,
  deleteBrandKitColor,
  getBrandKit,
  updateBrandKit,
  updateBrandKitColor,
  uploadAsset,
  uploadUrl,
} from '../lib/avnac-server-api'

type Props = {
  brandKitId: string
  onClose: () => void
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

export default function BrandKitEditor({ brandKitId, onClose }: Props) {
  const [kit, setKit] = useState<BrandKitFull | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')

  const refresh = useCallback(async () => {
    try {
      const fresh = await getBrandKit(brandKitId)
      setKit(fresh)
      setName(fresh.name)
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    }
  }, [brandKitId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const commitName = async () => {
    if (!kit || name.trim() === kit.name || name.trim() === '') {
      setName(kit?.name ?? '')
      return
    }
    setBusy(true)
    try {
      await updateBrandKit(brandKitId, { name: name.trim() })
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const onAddColor = async () => {
    const hex = window.prompt('Color hex (e.g. #4F46E5)')
    if (!hex) return
    if (!HEX_RE.test(hex.trim())) {
      window.alert('Invalid hex')
      return
    }
    const label = window.prompt('Color name (optional)') ?? null
    setBusy(true)
    try {
      await addBrandKitColor(brandKitId, { hex: hex.trim(), name: label || null })
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const onEditColor = async (color: BrandKitColor) => {
    const hex = window.prompt('Hex', color.hex)
    if (!hex) return
    if (!HEX_RE.test(hex.trim())) {
      window.alert('Invalid hex')
      return
    }
    const label = window.prompt('Name', color.name ?? '')
    setBusy(true)
    try {
      await updateBrandKitColor(brandKitId, color.id, {
        hex: hex.trim(),
        name: label || null,
      })
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const onRemoveColor = async (color: BrandKitColor) => {
    if (!window.confirm(`Delete ${color.name ?? color.hex}?`)) return
    setBusy(true)
    try {
      await deleteBrandKitColor(brandKitId, color.id)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const onUpload = async (file: File, kind: BrandKitAssetKind) => {
    setBusy(true)
    try {
      const uploaded = await uploadAsset(file)
      await addBrandKitAsset(brandKitId, {
        kind,
        url: uploaded.url,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        name: uploaded.originalName.replace(/\.[^.]+$/, '') || null,
      })
      await refresh()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  const onRemoveAsset = async (asset: BrandKitAsset) => {
    if (!window.confirm(`Delete ${asset.name ?? asset.kind}?`)) return
    setBusy(true)
    try {
      await deleteBrandKitAsset(brandKitId, asset.id)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  if (loadError) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="rounded-2xl bg-white p-6 shadow-xl max-w-md">
          <p className="text-sm text-red-600">{loadError}</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  if (!kit) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="rounded-2xl bg-white p-6 shadow-xl">
          <p className="text-sm text-gray-500">Loading brand kit…</p>
        </div>
      </div>
    )
  }

  const logos = kit.assets.filter(a => a.kind === 'logo')
  const graphics = kit.assets.filter(a => a.kind === 'graphic')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex-1">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={() => void commitName()}
              onKeyDown={e => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              }}
              className="w-full border-0 bg-transparent text-lg font-semibold outline-none focus:ring-0"
              placeholder="Brand kit name"
              disabled={busy}
            />
            <p className="text-xs text-gray-500">Brand kit</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Close
          </button>
        </header>

        <div className="flex-1 space-y-8 overflow-y-auto p-6">
          {/* Colors */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                Colors
              </h3>
              <button
                type="button"
                onClick={onAddColor}
                disabled={busy}
                className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                + Add color
              </button>
            </div>
            {kit.colors.length === 0 ? (
              <p className="text-sm text-gray-400">No colors yet.</p>
            ) : (
              <div className="grid grid-cols-6 gap-3">
                {kit.colors.map(color => (
                  <div
                    key={color.id}
                    className="group relative flex flex-col items-center text-center"
                  >
                    <button
                      type="button"
                      onClick={() => void onEditColor(color)}
                      className="h-16 w-full rounded-lg border border-gray-200 shadow-sm transition hover:scale-[1.02]"
                      style={{ backgroundColor: color.hex }}
                      title={`Edit ${color.name ?? color.hex}`}
                    />
                    <span className="mt-1 max-w-full truncate text-xs text-gray-600">
                      {color.name ?? color.hex}
                    </span>
                    <button
                      type="button"
                      onClick={() => void onRemoveColor(color)}
                      className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-white/90 text-xs text-red-600 shadow group-hover:flex"
                      title="Delete color"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <AssetSection
            title="Logos"
            assets={logos}
            kind="logo"
            onUpload={onUpload}
            onRemove={onRemoveAsset}
            busy={busy}
          />
          <AssetSection
            title="Graphics"
            assets={graphics}
            kind="graphic"
            onUpload={onUpload}
            onRemove={onRemoveAsset}
            busy={busy}
          />
        </div>
      </div>
    </div>
  )
}

function AssetSection({
  title,
  assets,
  kind,
  onUpload,
  onRemove,
  busy,
}: {
  title: string
  assets: BrandKitAsset[]
  kind: BrandKitAssetKind
  onUpload: (file: File, kind: BrandKitAssetKind) => void | Promise<void>
  onRemove: (asset: BrandKitAsset) => void | Promise<void>
  busy: boolean
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">{title}</h3>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          + Upload {title.toLowerCase().slice(0, -1)}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) void onUpload(file, kind)
            if (inputRef.current) inputRef.current.value = ''
          }}
        />
      </div>
      {assets.length === 0 ? (
        <p className="text-sm text-gray-400">No {title.toLowerCase()} yet.</p>
      ) : (
        <div className="grid grid-cols-5 gap-3">
          {assets.map(asset => (
            <div
              key={asset.id}
              className="group relative flex flex-col items-center text-center"
            >
              <div className="flex h-24 w-full items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                <img
                  src={uploadUrl(asset.url)}
                  alt={asset.name ?? title}
                  className="max-h-full max-w-full object-contain p-2"
                  loading="lazy"
                />
              </div>
              <span className="mt-1 max-w-full truncate text-xs text-gray-600">
                {asset.name ?? '—'}
              </span>
              <button
                type="button"
                onClick={() => void onRemove(asset)}
                className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-white/90 text-xs text-red-600 shadow group-hover:flex"
                title="Delete"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
