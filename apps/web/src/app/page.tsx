'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { AuditForm } from '@/components/audit-form'
import { AuditResults } from '@/components/audit-results'
import { ExportButtons } from '@/components/export-buttons'
import { Checklist } from '@/components/checklist'
import { SmartPanel } from '@/components/smart-panel'
import { LoadingSkeleton } from '@/components/loading-skeleton'
import { ErrorToast } from '@/components/error-toast'
import { JaoLogo } from '@/components/jao-logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { HistoryDropdown } from '@/components/history-dropdown'
import { OnboardingModal } from '@/components/onboarding-modal'
import type { AuditData, DesignData, WcagData } from '@/types/audit'

type AuditStatus = 'idle' | 'running' | 'complete' | 'error'

const VIEWPORT_MAP: Record<string, { width: number; height: number }> = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 375, height: 812 },
}

export default function Home() {
  const [status, setStatus] = useState<AuditStatus>('idle')
  const [data, setData] = useState<AuditData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewportMode, setViewportMode] = useState<'desktop' | 'mobile' | 'both'>('both')
  const [llmEnabled, setLlmEnabled] = useState(false)
  const [llmResult, setLlmResult] = useState<any>(null)
  const [llmLoading, setLlmLoading] = useState(false)
  const [context, setContext] = useState('')
  const [showScrollTop, setShowScrollTop] = useState(false)
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

  useEffect(() => {
    const handler = () => setShowScrollTop(window.scrollY > 400)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

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
      const vps = viewportMode === 'both'
        ? [VIEWPORT_MAP.desktop, VIEWPORT_MAP.mobile]
        : [VIEWPORT_MAP[viewportMode]]
      body.viewports = vps
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
  }, [viewportMode])

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
      const baseUrl = (sessionStorage.getItem('liveviewer_llm_base_url') || '').trim()

      if (!key) {
        throw new Error('Enter your access key in the settings panel')
      }

      const result = await enrichWithLLM(wcagFails || [], 'openai-compatible', 'deepseek-chat', key, baseUrl || 'https://api.deepseek.com/v1', designFails || [], context || undefined)
      setLlmResult({ ...result, cached: false })
    } catch (err) {
      setLlmResult({ error: err instanceof Error ? err.message : 'Enhancement failed', provider: 'client', model: '', perFailure: [], summary: '' })
    } finally {
      setLlmLoading(false)
    }
  }, [data, llmEnabled])

  const liveMessage = status === 'running' ? `Auditing ${auditUrlRef.current}...` :
    status === 'complete' ? `Audit completed with ${data?.wcag?.score ?? 0}% score` :
    status === 'error' ? `Audit failed: ${error}` : ''

  return (
    <>
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4">
      <header className="flex items-center justify-between border-b border-[var(--jao-border-subtle)] py-4">
        <div className="flex items-center gap-2.5">
          <JaoLogo size={24} className="text-[var(--jao-text-secondary)]" />
          <span className="text-base font-semibold tracking-tight">Liveviewer</span>
        </div>
        <div className="flex items-center gap-1">
          <HistoryDropdown onSelect={runAudit} />
          <ThemeToggle />
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 py-8 sm:py-12">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Design QA Intelligence</h1>
          <p className="mt-1.5 text-base text-[var(--jao-text-secondary)]">
            Audit websites for WCAG contrast, right in your browser.
          </p>
        </div>

        <div aria-describedby={status === 'error' ? 'audit-error' : undefined}>
          <AuditForm onRun={runAudit} isRunning={status === 'running'} />
        </div>

          <div className="mt-3 flex items-center justify-center gap-0.5 rounded-xl border border-[var(--jao-border)] bg-[var(--jao-surface)] p-0.5" role="radiogroup" aria-label="Viewport mode">
          {(['desktop', 'mobile', 'both'] as const).map(mode => {
            const labels: Record<string, string> = { desktop: 'Desktop', mobile: 'Mobile', both: 'Both' }
            return (
              <button
                key={mode}
                role="radio"
                aria-checked={viewportMode === mode}
                onClick={() => setViewportMode(mode)}
                disabled={status === 'running'}
                className={`rounded-lg px-3 py-1.5 text-base font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/30 ${
                  viewportMode === mode
                    ? 'bg-[var(--jao-primary)] text-white shadow-sm'
                    : 'text-[var(--jao-text-secondary)] hover:text-[var(--jao-text)]'
                }`}
              >
                {labels[mode]}
              </button>
            )
          })}
        </div>

        <details className="mt-3 group">
          <summary className="flex cursor-pointer items-center gap-1.5 text-base text-[var(--jao-text-secondary)] transition-colors hover:text-[var(--jao-text)] focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/30 rounded-lg px-2 py-1">
            <span>✨ Advanced</span>
            <span className="text-base leading-normal text-[var(--jao-text-tertiary)] group-open:hidden">— site context</span>
          </summary>
          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="Describe your site — e.g., Dark mode SaaS dashboard for engineers, data-dense UX"
            rows={2}
            className="mt-2 w-full rounded-xl border border-[var(--jao-border)] bg-[var(--jao-surface)] px-4 py-2.5 text-sm outline-none transition-all placeholder:text-[var(--jao-text-tertiary)] focus:border-[var(--jao-primary)] focus:ring-2 focus:ring-[var(--jao-primary)]/20"
            aria-label="Site context"
          />

        </details>

        {status === 'idle' && !data && (
          <div className="mt-3 flex justify-center">
            <button
              onClick={() => runAudit('https://web.dev')}
              className="rounded-full border border-dashed border-[var(--jao-border)] px-4 py-2 text-base text-[var(--jao-text-tertiary)] transition-colors hover:border-[var(--jao-primary)] hover:text-[var(--jao-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/30"
            >
              Try a demo → web.dev (has known issues)
            </button>
          </div>
        )}

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

            <SmartPanel
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
                  {llmLoading ? 'Analyzing...' : 'Get Smart Fixes'}
                </button>
              </div>
            )}

            {llmResult && !llmLoading && (
              <div className="card p-5 text-sm">
                <h3 className="mb-2 font-semibold">Recommendations</h3>
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
        <p className="inline-flex items-center gap-1.5 text-base text-[var(--jao-text-tertiary)]">
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
          {' — '}WCAG & Design QA audits
        </p>
      </footer>
    </div>
    <OnboardingModal />
    {showScrollTop && (
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-6 right-6 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--jao-primary)] text-white shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/50"
        aria-label="Scroll to top"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
    )}
    </>
  )
}
