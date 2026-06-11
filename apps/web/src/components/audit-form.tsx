'use client'

import { useState, FormEvent, useRef, useEffect, useCallback } from 'react'
import { Activity } from 'lucide-react'

interface AuditFormProps {
  onRun: (url: string) => void
  isRunning: boolean
  defaultUrl?: string
}

const RECENT_URLS_KEY = 'liveviewer_recent_urls'
const MAX_RECENT = 20

function loadRecentUrls(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_URLS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  return `https://${trimmed}`
}

function matchUrl(input: string, url: string): boolean {
  if (!input.trim()) return false
  const lower = input.toLowerCase()
  const urlLower = url.toLowerCase()
  return urlLower.includes(lower) && urlLower !== lower
}

export function AuditForm({ onRun, isRunning, defaultUrl }: AuditFormProps) {
  const [url, setUrl] = useState(defaultUrl || '')
  const [shaking, setShaking] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const recent = loadRecentUrls()
    if (recent.length > 0 && !url.trim()) {
      setSuggestions(recent.slice(0, 5))
      setShowDropdown(true)
    }
  }, [])

  const updateSuggestions = useCallback((value: string) => {
    const recent = loadRecentUrls()
    if (!value.trim()) {
      setSuggestions(recent.slice(0, 5))
      setShowDropdown(recent.length > 0)
      return
    }
    const filtered = recent.filter(u => matchUrl(value, u))
    setSuggestions(filtered)
    setShowDropdown(filtered.length > 0)
    setSelectedIdx(-1)
  }, [])

  const selectSuggestion = useCallback((suggestion: string) => {
    setUrl(suggestion)
    setShowDropdown(false)
    setSelectedIdx(-1)
    inputRef.current?.focus()
  }, [])

  const submitUrl = useCallback((raw: string) => {
    const normalized = normalizeUrl(raw)
    setUrl(normalized)
    setShowDropdown(false)
    if (normalized) {
      onRun(normalized)
    }
  }, [onRun])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (showDropdown && selectedIdx >= 0 && selectedIdx < suggestions.length) {
      selectSuggestion(suggestions[selectedIdx])
      return
    }
    const trimmed = url.trim()
    if (!trimmed) {
      setShaking(true)
      setTimeout(() => setShaking(false), 300)
      return
    }
    submitUrl(trimmed)
  }

  const handleChange = (value: string) => {
    setUrl(value)
    setSelectedIdx(-1)
    updateSuggestions(value)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      const trimmed = url.trim()
      if (trimmed) submitUrl(trimmed)
      return
    }
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === 'Enter') {
        const trimmed = url.trim()
        if (trimmed && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
          e.preventDefault()
          submitUrl(trimmed)
        }
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIdx(prev => (prev < suggestions.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIdx(prev => (prev > 0 ? prev - 1 : suggestions.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIdx >= 0 && selectedIdx < suggestions.length) {
          selectSuggestion(suggestions[selectedIdx])
        } else {
          submitUrl(url)
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowDropdown(false)
        setSelectedIdx(-1)
        break
      case 'Tab':
        setShowDropdown(false)
        setSelectedIdx(-1)
        break
    }
  }

  useEffect(() => {
    if (selectedIdx >= 0 && dropdownRef.current) {
      const item = dropdownRef.current.children[selectedIdx] as HTMLElement
      if (item) {
        item.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIdx])

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 sm:gap-3" role="search" aria-label="Audit a website">
      <label htmlFor="audit-url" className="sr-only">
        Website URL to audit
      </label>
      <div className={`relative min-w-0 flex-1 ${shaking ? 'shake' : ''}`}>
        <input
          ref={inputRef}
          id="audit-url"
          type="url"
          value={url}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            const recent = loadRecentUrls()
            if (!url.trim() && recent.length > 0) {
              setSuggestions(recent.slice(0, 5))
              setShowDropdown(true)
            }
          }}
          onBlur={() => {
            setTimeout(() => {
              setShowDropdown(false)
              setSelectedIdx(-1)
            }, 200)
          }}
          placeholder="https://example.com"
          required
          disabled={isRunning}
          aria-busy={isRunning}
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          autoComplete="off"
          role="combobox"
          className="w-full rounded-full border border-[var(--jao-border)] bg-[var(--jao-surface)] px-5 py-3.5 text-base outline-none shadow-sm transition-all placeholder:text-[var(--jao-text-tertiary)] focus:border-[var(--jao-primary)] focus:ring-2 focus:ring-[var(--jao-primary)]/20"
        />
        {showDropdown && suggestions.length > 0 && (
          <ul
            ref={dropdownRef}
            role="listbox"
            aria-label="URL suggestions"
            className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-[var(--jao-border)] bg-[var(--jao-surface)] py-1 shadow-lg"
          >
            {suggestions.map((s, i) => (
              <li
                key={s}
                role="option"
                aria-selected={i === selectedIdx}
                onMouseDown={() => selectSuggestion(s)}
                className={`cursor-pointer px-4 py-2 text-sm transition-colors ${
                  i === selectedIdx
                    ? 'bg-[var(--jao-primary)]/10 text-[var(--jao-primary)]'
                    : 'text-[var(--jao-text)] hover:bg-[var(--jao-border-subtle)]'
                }`}
              >
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="submit"
        disabled={isRunning || !url.trim()}
        aria-label={isRunning ? 'Audit in progress' : 'Run audit'}
        title={isRunning ? '' : '⌘Enter to run'}
        className={`btn-gradient inline-flex min-h-12 items-center gap-2 rounded-full px-6 py-3 text-base font-medium text-white shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/50 ${isRunning ? 'btn-pulse' : ''}`}
      >
        {isRunning ? (
          <>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" role="status" aria-label="Auditing" />
            Auditing…
          </>
        ) : (
          <>
            <Activity size={18} aria-hidden="true" />
            Run Audit
          </>
        )}
      </button>
    </form>
  )
}

export { normalizeUrl, loadRecentUrls, RECENT_URLS_KEY, MAX_RECENT }
