'use client'

import { useEffect, useState } from 'react'
import { AuditResults } from '@/components/audit-results'
import { JaoLogo } from '@/components/jao-logo'
import { ThemeToggle } from '@/components/theme-toggle'

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    params.then((p) => setId(p.id))
  }, [params])

  useEffect(() => {
    if (!id) return
    fetch(`/api/report/${encodeURIComponent(id)}`)
      .then((r) => {
        if (!r.ok) throw new Error('Report not found')
        return r.json()
      })
      .then((json) => {
        if (!json.success || !json.data) throw new Error('Report not found')
        setData(json.data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [id])

  if (loading) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4">
        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[var(--jao-primary)] border-t-transparent" />
        <p className="mt-3 text-sm text-[var(--jao-text-secondary)]">Loading report...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4">
        <header className="flex items-center justify-between border-b border-[var(--jao-border-subtle)] py-4">
          <div className="flex items-center gap-2.5">
            <JaoLogo size={24} className="text-[var(--jao-text-secondary)]" />
            <span className="text-base font-semibold tracking-tight">Liveviewer</span>
          </div>
          <ThemeToggle />
        </header>
        <main className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="text-xl font-bold">Report not found</h1>
          <p className="mt-2 text-sm text-[var(--jao-text-secondary)]">
            {error || 'This report may have expired (reports are kept for 7 days).'}
          </p>
          <a href="/" className="btn-gradient mt-6 inline-flex rounded-full px-5 py-2.5 text-sm font-medium text-white">
            Run a new audit
          </a>
        </main>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4">
      <header className="flex items-center justify-between border-b border-[var(--jao-border-subtle)] py-4">
        <div className="flex items-center gap-2.5">
          <JaoLogo size={24} className="text-[var(--jao-text-secondary)]" />
          <span className="text-base font-semibold tracking-tight">Liveviewer</span>
        </div>
        <div className="flex items-center gap-1">
          <a href="/" className="rounded-full px-3 py-1.5 text-sm text-[var(--jao-text-secondary)] transition-colors hover:bg-[var(--jao-border-subtle)] hover:text-[var(--jao-text)]">
            New Audit
          </a>
          <ThemeToggle />
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1 py-8">
        <div className="mb-4 text-center">
          <p className="text-xs text-[var(--jao-text-tertiary)]">Shared audit report</p>
        </div>
        <AuditResults data={data} />
      </main>
      <footer className="border-t border-[var(--jao-border-subtle)] py-6 text-center">
        <p className="inline-flex items-center gap-1.5 text-sm text-[var(--jao-text-tertiary)]">
          <JaoLogo size={12} className="opacity-40" />
          Made with ⚡ by{' '}
          <a href="https://jaostudio.dev" target="_blank" rel="noopener noreferrer"
            className="underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--jao-primary)]">
            jaostudio.dev
          </a>
          &nbsp;Independent dev tool, made with care.
        </p>
        <p className="mt-1 text-xs text-[var(--jao-text-tertiary)]">
          <a href="/about" className="underline decoration-dotted underline-offset-2 hover:text-[var(--jao-primary)]">About</a>
          {' / '}
          <a
            href="https://github.com/jamesonolitoquit/liveviewer"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted underline-offset-2 hover:text-[var(--jao-primary)]"
          >
            GitHub
          </a>
        </p>
      </footer>
    </div>
  )
}
