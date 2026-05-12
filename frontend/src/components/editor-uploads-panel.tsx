import { Cancel01Icon, CloudUploadIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  editorSidebarPanelLeftClass,
  editorSidebarPanelTopClass,
} from '../lib/editor-sidebar-panel-layout'
import {
  listTeamUploads,
  type TeamUploadListItem,
  uploadAsset,
  uploadUrl,
} from '../lib/avnac-server-api'
import { useAiController } from './scene-editor/ai-controller-context'

const PLACE_MAX_EDGE_PX = 1200

type Props = {
  open: boolean
  onClose: () => void
}

function probeImageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('Failed to load image'))
    img.crossOrigin = 'anonymous'
    img.src = url
  })
}

function fitToPlaceBox(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const edge = Math.max(width, height)
  if (edge <= maxEdge) return { width, height }
  const scale = maxEdge / edge
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

export default function EditorUploadsPanel({ open, onClose }: Props) {
  const controller = useAiController()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [items, setItems] = useState<TeamUploadListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [placingUrl, setPlacingUrl] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await listTeamUploads()
      setItems(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load uploads')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void refresh()
  }, [open, refresh])

  const handleUploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList)
      if (files.length === 0) return
      setUploading(true)
      setError(null)
      try {
        for (const f of files) {
          await uploadAsset(f, f.name)
        }
        await refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
    [refresh],
  )

  const placeOnCanvas = useCallback(
    async (item: TeamUploadListItem) => {
      setPlacingUrl(item.url)
      setError(null)
      try {
        const absoluteUrl = uploadUrl(item.url)
        const probed = await probeImageSize(absoluteUrl)
        const fitted = fitToPlaceBox(probed.width, probed.height, PLACE_MAX_EDGE_PX)
        const result = await controller.addImageFromUrl({
          url: absoluteUrl,
          origin: 'center',
          width: fitted.width,
          height: fitted.height,
        })
        if (!result) {
          setError('Could not place this image on the canvas.')
          return
        }
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Place failed')
      } finally {
        setPlacingUrl(null)
      }
    },
    [controller, onClose],
  )

  if (!open) return null

  return (
    <div
      data-avnac-chrome
      className={[
        'pointer-events-auto fixed z-40 flex max-h-[min(92dvh,720px)] w-[min(100vw-1.5rem,300px)] flex-col overflow-hidden rounded-3xl border border-black/[0.08] bg-white/95 backdrop-blur-md',
        editorSidebarPanelLeftClass,
        editorSidebarPanelTopClass,
      ].join(' ')}
      role="dialog"
      aria-label="Uploads"
    >
      <div className="flex shrink-0 items-start justify-between border-b border-black/[0.06] px-3 py-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-neutral-800">Uploads</div>
          <p className="mt-0.5 text-[11px] text-neutral-500">Shared with the TEG team</p>
        </div>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 hover:bg-black/[0.06]"
          onClick={onClose}
          aria-label="Close uploads"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={1.75} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault()
            setDragOver(false)
            if (e.dataTransfer?.files?.length) void handleUploadFiles(e.dataTransfer.files)
          }}
          disabled={uploading}
          className={[
            'm-2 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-3 py-5 text-center transition',
            dragOver
              ? 'border-neutral-700 bg-neutral-100'
              : 'border-neutral-300 bg-neutral-50 hover:border-neutral-500',
            uploading ? 'opacity-60' : '',
          ].join(' ')}
        >
          <HugeiconsIcon
            icon={CloudUploadIcon}
            size={22}
            strokeWidth={1.6}
            className="text-neutral-500"
          />
          <span className="mt-2 text-[13px] font-medium text-neutral-700">
            {uploading ? 'Uploading…' : 'Click or drop to upload'}
          </span>
          <span className="mt-0.5 text-[11px] text-neutral-500">
            PNG / JPG / SVG / WebP · up to 5 MB
          </span>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={e => {
              if (e.target.files?.length) void handleUploadFiles(e.target.files)
              if (fileInputRef.current) fileInputRef.current.value = ''
            }}
          />
        </button>

        {error ? (
          <p className="mx-2 mb-2 rounded-md bg-red-50 px-2 py-1.5 text-[12px] text-red-700">
            {error}
          </p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {loading ? (
            <p className="px-1 py-3 text-[12px] text-neutral-500">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-1 py-3 text-[12px] text-neutral-500">
              No uploads yet. Drop a file above to share with the team.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {items.map(item => {
                const absoluteUrl = uploadUrl(item.url)
                const isPlacing = placingUrl === item.url
                return (
                  <button
                    type="button"
                    key={item.url}
                    onClick={() => void placeOnCanvas(item)}
                    disabled={isPlacing}
                    className="group relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-black/[0.06] bg-neutral-50 transition hover:border-neutral-400 disabled:opacity-50"
                    title={item.filename}
                  >
                    <img
                      src={absoluteUrl}
                      alt=""
                      loading="lazy"
                      className="max-h-full max-w-full object-contain p-1.5"
                    />
                    {isPlacing ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-white/80 text-[11px] text-neutral-700">
                        Placing…
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
