'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { AuditForm } from '@/components/audit-form'
import { AuditResults } from '@/components/audit-results'
import { ExportButtons } from '@/components/export-buttons'
import { Checklist } from '@/components/checklist'
import { LlmPanel } from '@/components/llm-panel'
import { LoadingSkeleton } from '@/components/loading-skeleton'
import { ErrorToast } from '@/components/error-toast'
import { JaoLogo } from '@/components/jao-logo'
import { ThemeToggle } from '@/components/theme-toggle'
import type { AuditData, DesignData, WcagData } from '@/types/audit'

type AuditStatus = 'idle' | 'running' | 'complete' | 'error'

const VIEWPORT_OPTIONS = [
  { label: 'Desktop 1280×800', width: 1280, height: 800 },
  { label: 'Mobile 375×812', width: 375, height: 812 },
]

export default function Home() {
  const [status, setStatus] = useState<AuditStatus>('idle')
  const [data, setData] = useState<AuditData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedViewports, setSelectedViewports] = useState<Set<string>>(new Set(['1280x800']))
  const [llmEnabled, setLlmEnabled] = useState(false)
  const [llmResult, setLlmResult] = useState<any>(null)
  const [llmLoading, setLlmLoading] = useState(false)
  const [context, setContext] = useState('')
  const resultsRef = useRef<HTMLDivElement>(null)
  const announceRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const auditUrlRef = useRef<string>('')
  const cancelledRef = useRef(false)

  useEffect(() => {
    if (status === 'complete' || status === 'error') {
      resultsRef.current?.focus()
    }
  }, [status])

  const toggleViewport = (key: string) => {
    setSelectedViewports(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size <= 1) return prev
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const dismissError = useCallback(() => {
    setError(null)
    setStatus('idle')
  }, [])

  const cancelAudit = useCallback(() => {
    cancelledRef.current = true
    abortRef.current?.abort()
    setStatus('idle')
  }, [])

  const runAudit = useCallback(async (url: string, attempt = 1) => {
    auditUrlRef.current = url
    setStatus('running')
    setError(null)
    setData(null)
    setLlmResult(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const body: any = { url }
      setSelectedViewports(prev => {
        const vps = VIEWPORT_OPTIONS.filter(v => prev.has(`${v.width}x${v.height}`))
        if (vps.length > 0) {
          body.viewports = vps.map(v => ({ width: v.width, height: v.height }))
        }
        return prev
      })
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        const isRetryable = res.status === 503 || res.status === 429 || !res.ok
        if (isRetryable && attempt < 2 && json.reason === 'serverless_constraint') {
          await new Promise(r => setTimeout(r, 2000))
          if (cancelledRef.current) return
          return runAudit(url, attempt + 1)
        }
        throw new Error(json.error || 'Audit failed')
      }

      setData(json.data)
      setStatus('complete')
      saveToHistory(json.data)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setStatus('idle')
        return
      }
      if (err instanceof TypeError && attempt < 2) {
        await new Promise(r => setTimeout(r, 2000))
        if (cancelledRef.current) return
        return runAudit(url, attempt + 1)
      }
      setError(err instanceof Error ? err.message : 'Audit failed')
      setStatus('error')
    }
  }, [])

  const saveToHistory = useCallback(async (auditData: AuditData) => {
    try {
      const { saveAudit } = await import('@/lib/history')
      await saveAudit(auditData)
    } catch {
      // best-effort
    }
    try {
      const RECENT_KEY = 'liveviewer_recent_urls'
      const raw = localStorage.getItem(RECENT_KEY)
      const recent: string[] = raw ? JSON.parse(raw) : []
      const normalized = auditData.url.replace(/\/$/, '')
      const filtered = recent.filter(u => u !== normalized)
      filtered.unshift(normalized)
      localStorage.setItem(RECENT_KEY, JSON.stringify(filtered.slice(0, 20)))
    } catch {
      // best-effort
    }
  }, [])

  const runLlmEnrichment = useCallback(async () => {
    if (!llmEnabled) return
    const wcagFails = data?.wcag?.failures
    const designFails = data?.design?.failures
    if ((!wcagFails || wcagFails.length === 0) && (!designFails || designFails.length === 0)) return

    setLlmLoading(true)
    setLlmResult(null)

    try {
      const { enrichWithLLM } = await import('@/lib/llm-client')

      const key = (sessionStorage.getItem('liveviewer_llm_key') || '').trim()
      const provider = sessionStorage.getItem('liveviewer_llm_provider') || 'openai-compatible'
      const model = sessionStorage.getItem('liveviewer_llm_model') || 'gpt-4o-mini'
      const baseUrl = (sessionStorage.getItem('liveviewer_llm_base_url') || '').trim()

      if (!key && provider !== 'ollama') {
        throw new Error('Enter your API key in the AI panel above before enriching')
      }

      const result = await enrichWithLLM(wcagFails || [], provider, model, key, baseUrl || undefined, designFails || [], context || undefined)
      setLlmResult({ ...result, cached: false })
    } catch (err) {
      setLlmResult({ error: err instanceof Error ? err.message : 'LLM enrichment failed', provider: 'client', model: '', perFailure: [], summary: '' })
    } finally {
      setLlmLoading(false)
    }
  }, [data, llmEnabled])

  const liveMessage = status === 'running' ? `Auditing ${auditUrlRef.current}...` :
    status === 'complete' ? `Audit completed with ${data?.wcag?.score ?? 0}% score` :
    status === 'error' ? `Audit failed: ${error}` : ''

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4">
      <header className="flex items-center justify-between border-b border-[var(--jao-border-subtle)] py-4">
        <div className="flex items-center gap-2.5">
          <JaoLogo size={24} className="text-[var(--jao-text-secondary)]" />
          <span className="text-base font-semibold tracking-tight">Liveviewer</span>
        </div>
        <div className="flex items-center gap-1">
          <a
            href="/history"
            className="rounded-full px-3 py-1.5 text-sm text-[var(--jao-text-secondary)] transition-colors hover:bg-[var(--jao-border-subtle)] hover:text-[var(--jao-text)] focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/30"
          >
            History
          </a>
          <ThemeToggle />
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 py-8 sm:py-12">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Design QA Robot</h1>
          <p className="mt-1.5 text-base text-[var(--jao-text-secondary)]">
            Audit websites for WCAG contrast, right in your browser.
          </p>
        </div>

        <div aria-describedby={status === 'error' ? 'audit-error' : undefined}>
          <AuditForm onRun={runAudit} isRunning={status === 'running'} />
        </div>

        <div className="mt-3 flex items-center justify-center gap-4 text-xs text-[var(--jao-text-secondary)]">
          {VIEWPORT_OPTIONS.map(v => {
            const key = `${v.width}x${v.height}`
            const active = selectedViewports.has(key)
            return (
              <label key={key} className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggleViewport(key)}
                  disabled={status === 'running'}
                  className="h-3.5 w-3.5 rounded border-[var(--jao-border)] text-[var(--jao-primary)] focus:ring-[var(--jao-primary)]/30"
                />
                {v.label}
              </label>
            )
          })}
        </div>

        <textarea
          value={context}
          onChange={e => setContext(e.target.value)}
          placeholder="Site context (optional) — e.g., Dark mode SaaS dashboard for engineers, data-dense UX"
          rows={2}
          className="mt-3 w-full rounded-xl border border-[var(--jao-border)] bg-[var(--jao-surface)] px-4 py-2.5 text-xs outline-none transition-all placeholder:text-[var(--jao-text-tertiary)] focus:border-[var(--jao-primary)] focus:ring-2 focus:ring-[var(--jao-primary)]/20"
          aria-label="Site context for AI recommendations"
        />

        <div
          ref={announceRef}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {liveMessage}
        </div>

        {status === 'running' && (
          <div className="relative">
            <LoadingSkeleton />
            <div className="flex justify-center pt-3">
              <button
                onClick={cancelAudit}
                className="rounded-full border border-[var(--jao-border)] px-3 py-1.5 text-xs text-[var(--jao-text-secondary)] transition-colors hover:bg-[var(--jao-border-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/30"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {status === 'error' && error && (
          <ErrorToast message={error} onDismiss={dismissError} />
        )}

        {status === 'idle' && !data && (
          <div className="mt-16 text-center">
            <JaoLogo size={48} className="mx-auto text-[var(--jao-border)] opacity-40" />
            <p className="mt-4 text-base text-[var(--jao-text-tertiary)]">
              Enter a URL above to start auditing
            </p>
          </div>
        )}

        {data && (
          <div
            ref={resultsRef}
            tabIndex={-1}
            className="mt-6 space-y-5 focus:outline-none"
          >
            <AuditResults data={data} />

            <ExportButtons data={data} />

            <Checklist currentUrl={data.url} />

            <LlmPanel
              enabled={llmEnabled}
              onToggle={setLlmEnabled}
              hasFailures={(data.wcag?.failures?.length ?? 0) > 0}
            />

            {llmEnabled && ((data.wcag?.failures?.length ?? 0) > 0 || (data.design?.failures?.length ?? 0) > 0) && (
              <div className="flex justify-end">
                <button
                  onClick={runLlmEnrichment}
                  disabled={llmLoading}
                  className="btn-gradient inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/50"
                >
                  {llmLoading ? 'Enriching...' : 'Enrich with AI'}
                </button>
              </div>
            )}

            {llmResult && !llmLoading && (
              <div className="card p-5 text-sm">
                <h3 className="mb-2 font-semibold">AI Insights</h3>
                {llmResult.error ? (
                  <p className="text-[var(--jao-destructive)]">Error: {llmResult.error}</p>
                ) : (
                  <>
                    <p className="mb-3 text-[var(--jao-text-secondary)]">{llmResult.summary}</p>

                    {llmResult.perFailure?.length > 0 && (
                      <>
                        <h4 className="mb-2 text-xs font-semibold text-[var(--jao-destructive)]">Accessibility (WCAG)</h4>
                        <div className="mb-4 space-y-2">
                          {llmResult.perFailure.map((pf: any, i: number) => (
                            <div key={i} className="rounded-lg border border-[var(--jao-border)] sm:p-3 p-2.5">
                              <div className="mb-1 flex items-center gap-2">
                                <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                                  pf.severity === 'high' ? 'bg-red-900/30 text-red-300' :
                                  pf.severity === 'medium' ? 'bg-yellow-900/30 text-yellow-300' :
                                  'bg-green-900/30 text-green-300'
                                }`}>
                                  {pf.severity}
                                </span>
                                <code className="break-all text-xs text-[var(--jao-text-secondary)]">{pf.selector}</code>
                              </div>
                              <p className="text-xs text-[var(--jao-text-tertiary)]">{pf.explanation}</p>
                              <p className="mt-1 text-xs font-medium text-[var(--jao-primary)]">{pf.suggestion}</p>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {llmResult.designFixes?.length > 0 && (
                      <>
                        <h4 className="mb-2 text-xs font-semibold text-[var(--jao-accent)]">Design Quality</h4>
                        <div className="space-y-2">
                          {llmResult.designFixes.map((df: any, i: number) => (
                            <div key={i} className="rounded-lg border-l-2 border-[var(--jao-accent)] border-[var(--jao-border)] p-3">
                              <div className="mb-1 flex items-center gap-2">
                                <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                                  df.severity === 'high' ? 'bg-red-900/30 text-red-300' :
                                  df.severity === 'medium' ? 'bg-yellow-900/30 text-yellow-300' :
                                  'bg-green-900/30 text-green-300'
                                }`}>
                                  {df.severity}
                                </span>
                                <code className="break-all text-xs text-[var(--jao-text-secondary)]">{df.selector}</code>
                              </div>
                              <p className="text-xs text-[var(--jao-text-tertiary)]">{df.explanation}</p>
                              <p className="mt-1 text-xs font-medium text-[var(--jao-accent)]">{df.suggestion}</p>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {llmResult.cached && (
                      <p className="mt-2 text-xs text-[var(--jao-text-tertiary)]">(cached result)</p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-[var(--jao-border-subtle)] py-6 text-center">
        <p className="inline-flex items-center gap-1.5 text-sm text-[var(--jao-text-tertiary)]">
          <JaoLogo size={12} className="opacity-40" />
          Made with ⚡ by{' '}
          <a
            href="https://jaostudio.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--jao-primary)]"
          >
            jaostudio.dev
          </a>
          {' — '}AI-powered WCAG audits
        </p>
      </footer>
    </div>
  )
}
