'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { ChevronUp } from 'lucide-react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { AuditForm } from '@/components/audit-form'
import { LoadingSkeleton } from '@/components/loading-skeleton'
import { JaoLogo } from '@/components/jao-logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { HistoryDropdown } from '@/components/history-dropdown'

import { humanError } from '@/lib/errors'
import { PILLARS } from '@/lib/pillars'
import type { AuditData, DesignData, WcagData } from '@/types/audit'

const AuditResults = dynamic(() => import('@/components/audit-results').then(m => ({ default: m.AuditResults })), { ssr: false, loading: () => <LoadingSkeleton /> })
const Dashboard = dynamic(() => import('@/components/dashboard').then(m => ({ default: m.Dashboard })), { ssr: false })
const ExportButtons = dynamic(() => import('@/components/export-buttons').then(m => ({ default: m.ExportButtons })), { ssr: false })
const Checklist = dynamic(() => import('@/components/checklist').then(m => ({ default: m.Checklist })), { ssr: false })
const SmartPanel = dynamic(() => import('@/components/smart-panel').then(m => ({ default: m.SmartPanel })), { ssr: false })
const ErrorToast = dynamic(() => import('@/components/error-toast').then(m => ({ default: m.ErrorToast })), { ssr: false })

type AuditStatus = 'idle' | 'running' | 'complete' | 'error'

const VIEWPORT_MAP: Record<string, { width: number; height: number }> = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 375, height: 812 },
}

export default function Home() {
  const [status, setStatus] = useState<AuditStatus>('idle')
  const [data, setData] = useState<AuditData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewportMode, setViewportMode] = useState<'desktop' | 'mobile' | 'both'>(() => {
    try {
      return (localStorage.getItem('liveviewer_viewport') as 'desktop' | 'mobile' | 'both') || 'both'
    } catch {
      return 'both'
    }
  })
  const [historyEntries, setHistoryEntries] = useState<any[]>([])
  const [llmEnabled, setLlmEnabled] = useState(false)
  const [llmResult, setLlmResult] = useState<any>(null)
  const [llmLoading, setLlmLoading] = useState(false)
  const [context, setContext] = useState('')
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [demoUrl, setDemoUrl] = useState<string | undefined>(undefined)
  const [selectedPillars, setSelectedPillars] = useState<string[]>(PILLARS.map(p => p.key))
  const [cliRecommendation, setCliRecommendation] = useState<string | null>(null)
  const [pillarErrors, setPillarErrors] = useState<Record<string, string> | null>(null)
  const [currentPillar, setCurrentPillar] = useState<string | null>(null)

  useEffect(() => {
    try {
      if (!localStorage.getItem('liveviewer_onboarded')) {
        setDemoUrl('https://web.dev')
      }
      const { getAllHistory } = require('@/lib/history')
      setHistoryEntries(getAllHistory(5))
    } catch {}
  }, [])
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

  const refreshHistory = useCallback(() => {
    try {
      const { getAllHistory } = require('@/lib/history')
      setHistoryEntries(getAllHistory(5))
    } catch {}
  }, [])

  const cancelAudit = useCallback(() => {
    cancelledRef.current = true
    abortRef.current?.abort()
    setStatus('idle')
  }, [])

  const togglePillar = useCallback((key: string) => {
    setSelectedPillars(prev => {
      if (prev.includes(key) && prev.length <= 1) return prev
      return prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    })
  }, [])

  const runAudit = useCallback(async (url: string, attempt = 1) => {
    auditUrlRef.current = url
    setStatus('running')
    setError(null)
    setData(null)
    setLlmResult(null)
    setCliRecommendation(null)
    setPillarErrors(null)
    setCurrentPillar(null)

    const controller = new AbortController()
    abortRef.current = controller

    const progressKey = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/audit/progress?key=${progressKey}`)
        if (res.ok) {
          const { pillar } = await res.json()
          if (pillar) setCurrentPillar(pillar)
        }
      } catch {}
    }, 500)

    try {
      const body: any = { url, pillars: selectedPillars, progressKey }
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

      clearInterval(pollInterval)

      const json = await res.json()

      if (!res.ok || !json.success) {
        if (json.recommendation === 'use_cli') {
          setCliRecommendation(json.error || 'Page too large for web app. Use CLI instead.')
          setStatus('idle')
          return
        }
        const isRetryable = res.status === 503 || res.status === 429 || !res.ok
        if (isRetryable && attempt < 2 && json.reason === 'serverless_constraint') {
          await new Promise(r => setTimeout(r, 2000))
          if (cancelledRef.current) return
          return runAudit(url, attempt + 1)
        }
        throw new Error(json.error || humanError('audit'))
      }

      setData(json.data)
      setPillarErrors(json.pillarErrors || null)
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
      clearInterval(pollInterval)
      setError(err instanceof Error ? err.message : humanError('audit'))
      setStatus('error')
    }
    try { localStorage.setItem('liveviewer_viewport', viewportMode) } catch {}
  }, [viewportMode])

  const handleReAudit = useCallback((url: string) => {
    runAudit(url)
  }, [runAudit])

  const saveToHistory = useCallback(async (auditData: AuditData) => {
    try {
      const { saveAudit, getAllHistory } = await import('@/lib/history')
      await saveAudit(auditData)
      setHistoryEntries(getAllHistory(5))
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
    const seoFails = data?.seo?.failures
    const securityFails = data?.security?.failures
    const legalFails = data?.legal?.failures
    const hasAny = (wcagFails && wcagFails.length > 0) || (designFails && designFails.length > 0) ||
      (seoFails && seoFails.length > 0) || (securityFails && securityFails.length > 0) ||
      (legalFails && legalFails.length > 0)
    if (!hasAny) return

    setLlmLoading(true)
    setLlmResult(null)

    try {
      const { enrichWithLLM } = await import('@/lib/llm-client')

      const key = (sessionStorage.getItem('liveviewer_llm_key') || '').trim()
      const baseUrl = (sessionStorage.getItem('liveviewer_llm_base_url') || '').trim()
      const model = (sessionStorage.getItem('liveviewer_llm_model') || 'deepseek-chat').trim()

      if (!key) {
        throw new Error('Enter your access key in the settings panel')
      }

      const result = await enrichWithLLM(
        wcagFails || [], 'openai-compatible', model, key, baseUrl || 'https://api.deepseek.com/v1',
        designFails || [], context || undefined,
        seoFails || [], securityFails || [], legalFails || []
      )
      setLlmResult({ ...result, cached: false })
    } catch (err) {
      setLlmResult({ error: err instanceof Error ? err.message : humanError('llm'), provider: 'client', model: '', perFailure: [], summary: '' })
    } finally {
      setLlmLoading(false)
    }
  }, [data, llmEnabled])

  const liveMessage = status === 'running' ? `Auditing ${auditUrlRef.current}...` :
    status === 'complete' ? `Audit completed with ${data?.wcag?.score ?? 0}% score` :
    status === 'error' ? `Audit hit a snag: ${error}` : ''

  return (
    <>
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <div className="flex items-center gap-2.5">
          <JaoLogo size={24} className="text-[var(--jao-primary)]" />
          <span className="text-lg font-semibold tracking-tight">Liveviewer</span>
        </div>
        <div className="flex items-center gap-2">
          <HistoryDropdown onSelect={runAudit} />
          <ThemeToggle />
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 pb-16">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">All in One Audit</h1>
          <p className="mt-2 text-base text-[var(--jao-text-secondary)] mx-auto">
            Accessibility, design, SEO, security, legal compliance, and performance — one tool, zero signup.
          </p>
          <p className="mt-4 text-base text-[var(--jao-text-tertiary)] mx-auto">
            Deterministic fix suggestions for every issue. Open source, community-driven.
          </p>
        </div>

        <div className="card mx-auto p-6 shadow-sm" aria-describedby={status === 'error' ? 'audit-error' : undefined}>
          <AuditForm onRun={runAudit} isRunning={status === 'running'} defaultUrl={demoUrl} />

          <div className="mt-4 flex items-center justify-center gap-0.5 rounded-lg border border-[var(--jao-border)] bg-[var(--jao-bg)] p-0.5" role="radiogroup" aria-label="Viewport mode">
          {(['desktop', 'mobile', 'both'] as const).map(mode => {
            const labels: Record<string, string> = { desktop: 'Desktop', mobile: 'Mobile', both: 'Both' }
            return (
              <button
                key={mode}
                role="radio"
                aria-checked={viewportMode === mode}
                onClick={() => setViewportMode(mode)}
                disabled={status === 'running'}
                className={`rounded-md px-3 py-1.5 text-base font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/30 ${
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

          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5" role="group" aria-label="Audit pillars">
            {PILLARS.map(({ key, label }) => {
              const isActive = selectedPillars.includes(key)
              return (
                <button
                  key={key}
                  type="button"
                  role="checkbox"
                  aria-checked={isActive}
                  onClick={() => togglePillar(key)}
                  disabled={status === 'running'}
                  className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/30 ${
                    isActive
                      ? 'border-[var(--jao-primary)] bg-[var(--jao-primary)]/10 text-[var(--jao-primary)]'
                      : 'border-[var(--jao-border)] text-[var(--jao-text-secondary)] hover:text-[var(--jao-text)]'
                  }`}
                >
                  {label}
                </button>
              )
            })}
            <span className="ml-1 text-sm text-[var(--jao-text-tertiary)]">{selectedPillars.length} of {PILLARS.length}</span>
            <button
              type="button"
              onClick={() => setSelectedPillars(selectedPillars.length < PILLARS.length ? PILLARS.map(p => p.key) : PILLARS.slice(0, 1).map(p => p.key))}
              disabled={status === 'running'}
              className="ml-1 rounded-full px-2 py-1 text-xs text-[var(--jao-text-tertiary)] underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--jao-text)]"
            >
              {selectedPillars.length < PILLARS.length ? 'All' : 'Min'}
            </button>
          </div>

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
        </div>

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
          <div className="relative mt-8">
            <LoadingSkeleton pillars={PILLARS.filter(p => selectedPillars.includes(p.key)).map(p => p.label)} currentPillar={currentPillar} />
            <div className="flex justify-center pt-4">
              <button
                onClick={cancelAudit}
                className="rounded-full border border-[var(--jao-border)] px-4 py-2 text-sm text-[var(--jao-text-secondary)] transition-colors hover:bg-[var(--jao-border-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/30"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {status === 'error' && error && (
          <ErrorToast message={error} onDismiss={dismissError} />
        )}

        {pillarErrors && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/30 dark:bg-amber-900/20 dark:text-amber-200">
            <p className="font-medium">Some audits incomplete</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {Object.entries(pillarErrors).map(([key, msg]) => (
                <li key={key} className="text-xs">
                  <span className="font-medium capitalize">{key}:</span> {msg}
                </li>
              ))}
            </ul>
          </div>
        )}

        {cliRecommendation && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/30 dark:bg-amber-900/20 dark:text-amber-200">
            <p className="font-medium">Page too large for web audit</p>
            <p className="mt-1">{cliRecommendation}</p>
            <code className="mt-2 block rounded bg-amber-100 px-2 py-1 text-xs dark:bg-amber-900/40">npm install -g @liveviewer/cli</code>
            <button
              onClick={() => setCliRecommendation(null)}
              className="mt-2 underline decoration-dotted underline-offset-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {status === 'idle' && !data && historyEntries.length > 0 && (
          <div className="mt-10">
            <Dashboard entries={historyEntries} onReAudit={handleReAudit} />
          </div>
        )}

        {status === 'idle' && !data && historyEntries.length === 0 && (
          <div className="mt-20 text-center">
            <JaoLogo size={48} className="mx-auto text-[var(--jao-border)] opacity-30" />
            <p className="mt-4 text-base text-[var(--jao-text-tertiary)]">
              Enter a URL above to start auditing
            </p>
          </div>
        )}

        {data && (
          <div
            ref={resultsRef}
            tabIndex={-1}
            className="mt-8 space-y-6 focus:outline-none"
          >
            <AuditResults data={data}>
              <ExportButtons data={data} />
            </AuditResults>

            <Checklist currentUrl={data.url} />

          </div>
        )}
      </main>

      {data && (
        <SmartPanel
          enabled={llmEnabled}
          onToggle={setLlmEnabled}
          hasFailures={((data.wcag?.failures?.length ?? 0) + (data.design?.failures?.length ?? 0)) > 0}
          onEnrich={runLlmEnrichment}
          llmLoading={llmLoading}
          llmResult={llmResult}
          context={context}
          onContextChange={setContext}
        />
      )}

      <footer className="border-t border-[var(--jao-border-subtle)] py-8 text-center">
        <p className="inline-flex items-center gap-1.5 text-base text-[var(--jao-text-tertiary)]">
          <JaoLogo size={14} className="opacity-30" />
          Built by{' '}
          <a
            href="https://jaostudio.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--jao-primary)]"
          >
            jaostudio.dev
          </a>
          &nbsp;Independent dev tool, made with care.
        </p>
        <p className="mt-2 text-base text-[var(--jao-text-tertiary)]">
          <a href="/about" className="underline decoration-dotted underline-offset-2 hover:text-[var(--jao-primary)]">About</a>
          {' / '}
          <a href="/privacy" className="underline decoration-dotted underline-offset-2 hover:text-[var(--jao-primary)]">Privacy</a>
          {' / '}
          <a
            href="https://github.com/jamesonolitoquit/liveviewer"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted underline-offset-2 hover:text-[var(--jao-primary)]"
          >
            GitHub
          </a>
          {' / '}
          <a
            href="https://github.com/jamesonolitoquit/liveviewer/blob/master/CHANGELOG.md"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted underline-offset-2 hover:text-[var(--jao-primary)]"
          >
            Changelog
          </a>
          {' / '}
          <Link href="/terms" className="underline decoration-dotted underline-offset-2 hover:text-[var(--jao-primary)]">
            Terms of Service
          </Link>
          {' / '}
          <Link href="/imprint" className="underline decoration-dotted underline-offset-2 hover:text-[var(--jao-primary)]">
            Imprint
          </Link>
          {' / '}
          <button
            id="cookie-settings"
            className="underline decoration-dotted underline-offset-2 hover:text-[var(--jao-primary)]"
            onClick={() => window.dispatchEvent(new CustomEvent('show-cookie-consent'))}
          >
            Cookie Settings
          </button>
        </p>
        <p className="mt-4 text-base text-[var(--jao-text-tertiary)]">
          We protect your data and value your privacy. We do not collect or share your data. See our <a href="/privacy" className="underline decoration-dotted underline-offset-2 hover:text-[var(--jao-primary)]">privacy policy</a>.
        </p>
      </footer>
    </div>
    {showScrollTop && (
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-24 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--jao-primary)] text-white shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/50"
        aria-label="Scroll to top"
      >
        <ChevronUp size={18} strokeWidth={2.5} />
      </button>
    )}
    </>
  )
}
