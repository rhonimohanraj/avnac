import { useEffect, useRef } from 'react'

export type ContextMenuItem = {
  label: string
  onClick: () => void
  danger?: boolean
  divider?: boolean
  disabled?: boolean
}

type Props = {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export default function LibraryContextMenu({ x, y, items, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // Clamp to viewport so right-click near right edge doesn't overflow.
  const left = Math.min(x, window.innerWidth - 220)
  const top = Math.min(y, window.innerHeight - items.length * 36 - 12)

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] rounded-lg bg-white p-1 shadow-lg ring-1 ring-black/10"
      style={{ left, top }}
      role="menu"
    >
      {items.map((item, i) =>
        item.divider ? (
          <div key={`d-${i}`} className="my-1 border-t border-gray-100" />
        ) : (
          <button
            key={item.label}
            type="button"
            disabled={item.disabled}
            onClick={() => {
              item.onClick()
              onClose()
            }}
            className={`flex w-full items-center rounded px-3 py-2 text-left text-sm ${
              item.danger
                ? 'text-red-600 hover:bg-red-50'
                : 'text-gray-700 hover:bg-gray-100'
            } disabled:opacity-50 disabled:hover:bg-transparent`}
            role="menuitem"
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  )
}
