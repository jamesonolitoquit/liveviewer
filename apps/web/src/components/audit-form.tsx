'use client'

import { useState, FormEvent } from 'react'

interface AuditFormProps {
  onRun: (url: string) => void
  isRunning: boolean
}

export function AuditForm({ onRun, isRunning }: AuditFormProps) {
  const [url, setUrl] = useState('')
  const [shaking, setShaking] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) {
      setShaking(true)
      setTimeout(() => setShaking(false), 300)
      return
    }
    onRun(trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3" role="search" aria-label="Audit a website">
      <label htmlFor="audit-url" className="sr-only">
        Website URL to audit
      </label>
      <div className={`relative min-w-0 flex-1 ${shaking ? 'shake' : ''}`}>
        <input
          id="audit-url"
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://example.com"
          required
          disabled={isRunning}
          aria-busy={isRunning}
          className="w-full rounded-full border border-[var(--jao-border)] bg-[var(--jao-surface)] px-5 py-3 text-sm outline-none transition-all placeholder:text-[var(--jao-text-tertiary)] focus:border-[var(--jao-primary)] focus:ring-2 focus:ring-[var(--jao-primary)]/20"
        />
      </div>
      <button
        type="submit"
        disabled={isRunning || !url.trim()}
        aria-label={isRunning ? 'Audit in progress' : 'Run audit'}
        className={`btn-gradient inline-flex min-h-11 items-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/50 ${isRunning ? 'btn-pulse' : ''}`}
      >
        {isRunning ? (
          <>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" role="status" aria-label="Auditing" />
            Auditing…
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
              <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
              <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
              <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
            </svg>
            Run Audit
          </>
        )}
      </button>
    </form>
  )
}
