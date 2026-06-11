'use client'

import { useState } from 'react'
import { csvFromAudit, jsonFromAudit, textFromAudit, failuresText, downloadFile } from '@/lib/export'
import { humanError } from '@/lib/errors'
import { PdfExportButton } from './pdf-export-button'
import type { AuditData } from '@/types/audit'

interface ExportButtonsProps {
  data: AuditData
}

function sanitizeFilename(url: string): string {
  try {
    const u = new URL(url)
    return `${u.hostname}${u.pathname.replace(/[^a-zA-Z0-9]/g, '-')}`
  } catch {
    return url.replace(/[^a-zA-Z0-9]/g, '-')
  }
}

export function ExportButtons({ data }: ExportButtonsProps) {
  const [error, setError] = useState<string | null>(null)
  const [shareState, setShareState] = useState<'idle' | 'saving' | 'copied' | 'error'>('idle')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const [copyFailsState, setCopyFailsState] = useState<'idle' | 'copied' | 'error'>('idle')
  const prefix = sanitizeFilename(data.url)

  const handleCsv = () => {
    try {
      const csv = csvFromAudit(data)
      downloadFile(csv, `${prefix}-audit.csv`, 'text/csv')
      setError(null)
    } catch {
      setError(humanError('export'))
    }
  }

  const handleJson = () => {
    try {
      const json = jsonFromAudit(data)
      downloadFile(json, `${prefix}-audit.json`, 'application/json')
      setError(null)
    } catch {
      setError(humanError('export'))
    }
  }

  const handleCopy = () => {
    try {
      const text = textFromAudit(data)
      navigator.clipboard.writeText(text)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 3000)
    } catch {
      setCopyState('error')
      setTimeout(() => setCopyState('idle'), 3000)
    }
  }

  const handleCopyFailures = () => {
    try {
      const text = failuresText(data)
      navigator.clipboard.writeText(text)
      setCopyFailsState('copied')
      setTimeout(() => setCopyFailsState('idle'), 3000)
    } catch {
      setCopyFailsState('error')
      setTimeout(() => setCopyFailsState('idle'), 3000)
    }
  }

  const handleShare = async () => {
    setShareState('saving')
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const json = await res.json()
      if (!json.success || !json.id) throw new Error(humanError('share'))
      const url = `${window.location.origin}/report/${json.id}`
      await navigator.clipboard.writeText(url)
      setShareState('copied')
      setTimeout(() => setShareState('idle'), 3000)
    } catch {
      setShareState('error')
      setTimeout(() => setShareState('idle'), 3000)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-[var(--jao-text-secondary)]">Export:</span>
      <button
        onClick={handleCsv}
        className="rounded-lg border border-[var(--jao-border)] px-3 py-1.5 text-xs text-[var(--jao-text-secondary)] transition-colors hover:bg-[var(--jao-border-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/30"
      >
        CSV
      </button>
      <button
        onClick={handleJson}
        className="rounded-lg border border-[var(--jao-border)] px-3 py-1.5 text-xs text-[var(--jao-text-secondary)] transition-colors hover:bg-[var(--jao-border-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/30 disabled:opacity-50"
      >
        JSON
      </button>
      <PdfExportButton data={data} prefix={prefix} />
      <button
        onClick={handleCopy}
        className={`rounded-lg border px-3 py-1.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/30 ${
          copyState === 'copied'
            ? 'border-[var(--jao-success)] text-[var(--jao-success)]'
            : copyState === 'error'
            ? 'border-[var(--jao-destructive)] text-[var(--jao-destructive)]'
            : 'border-[var(--jao-border)] text-[var(--jao-text-secondary)] hover:bg-[var(--jao-border-subtle)]'
        }`}
      >
        {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Nope' : 'Copy Summary'}
      </button>
      <button
        onClick={handleCopyFailures}
        className={`rounded-lg border px-3 py-1.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/30 ${
          copyFailsState === 'copied'
            ? 'border-[var(--jao-success)] text-[var(--jao-success)]'
            : copyFailsState === 'error'
            ? 'border-[var(--jao-destructive)] text-[var(--jao-destructive)]'
            : 'border-[var(--jao-border)] text-[var(--jao-text-secondary)] hover:bg-[var(--jao-border-subtle)]'
        }`}
      >
        {copyFailsState === 'copied' ? 'Copied' : copyFailsState === 'error' ? 'Nope' : 'Copy Failures'}
      </button>
      <button
        onClick={handleShare}
        disabled={shareState === 'saving'}
        className={`rounded-lg border px-3 py-1.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/30 ${
          shareState === 'copied'
            ? 'border-[var(--jao-success)] text-[var(--jao-success)]'
            : shareState === 'error'
            ? 'border-[var(--jao-destructive)] text-[var(--jao-destructive)]'
            : 'border-[var(--jao-border)] text-[var(--jao-text-secondary)] hover:bg-[var(--jao-border-subtle)]'
        }`}
      >
        {shareState === 'saving' ? 'Saving...' : shareState === 'copied' ? 'Link copied' : shareState === 'error' ? 'Nope' : 'Share'}
      </button>
      {error && (
        <span className="text-xs text-[var(--jao-destructive)]" role="alert">{error}</span>
      )}
    </div>
  )
}
