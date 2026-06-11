'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { History, Trash2, ExternalLink, ChevronDown } from 'lucide-react'

const RECENT_URLS_KEY = 'liveviewer_recent_urls'
const MAX_DISPLAY = 5

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_URLS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function clearRecent() {
  try {
    localStorage.removeItem(RECENT_URLS_KEY)
  } catch {}
}

export function HistoryDropdown({ onSelect }: { onSelect: (url: string) => void }) {
  const [open, setOpen] = useState(false)
  const [urls, setUrls] = useState<string[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) setUrls(loadRecent().slice(0, MAX_DISPLAY))
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Audit history"
        className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[var(--jao-text-secondary)] transition-colors hover:bg-[var(--jao-border-subtle)] hover:text-[var(--jao-text)] focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/30"
      >
        <History size={16} aria-hidden="true" /><ChevronDown size={12} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Recent audits"
          className="absolute right-0 z-50 mt-1 min-w-[240px] overflow-hidden rounded-xl border border-[var(--jao-border)] bg-[var(--jao-surface)] py-1 shadow-lg"
        >
          {urls.length === 0 ? (
            <div className="px-4 py-3 text-xs text-[var(--jao-text-tertiary)]">No recent audits</div>
          ) : (
            urls.map((url, i) => (
              <button
                key={i}
                role="option"
                onClick={() => { setOpen(false); onSelect(url) }}
                className="w-full truncate px-4 py-2 text-left text-sm text-[var(--jao-text)] transition-colors hover:bg-[var(--jao-border-subtle)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--jao-primary)]/30"
              >
                {url}
              </button>
            ))
          )}
          <div className="border-t border-[var(--jao-border-subtle)] px-2 py-1.5 space-y-1">
            {urls.length > 0 && (
              <button
                onClick={() => { clearRecent(); setUrls([]) }}
                className="w-full rounded px-2 py-1 text-xs text-[var(--jao-text-tertiary)] transition-colors hover:text-[var(--jao-destructive)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--jao-primary)]/30"
              >
<Trash2 size={12} className="mr-1 inline" aria-hidden="true" />Clear history
              </button>
            )}
            <Link
              href="/history"
              onClick={() => setOpen(false)}
              className="block w-full rounded px-2 py-1 text-xs text-[var(--jao-primary)] transition-colors hover:bg-[var(--jao-border-subtle)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--jao-primary)]/30"
            >
              <ExternalLink size={12} className="mr-1 inline" aria-hidden="true" />View full history
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
