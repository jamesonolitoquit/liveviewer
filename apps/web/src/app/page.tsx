'use client'

import { useState, useCallback } from 'react'
import { AuditForm } from '@/components/audit-form'
import { AuditResults } from '@/components/audit-results'
import { LlmPanel } from '@/components/llm-panel'

interface WcagFailure {
  selector: string
  text: string
  foreground: string
  background: string
  contrastRatio: number
  required: number
  fontSize: number
  isLarge: boolean
}

interface WcagData {
  totalElements: number
  failures: WcagFailure[]
  passCount: number
  failCount: number
  score: number
}

interface AuditData {
  url: string
  timestamp: number
  viewport: { width: number; height: number }
  wcag: WcagData | null
}

type AuditStatus = 'idle' | 'running' | 'complete' | 'error'

export default function Home() {
  const [status, setStatus] = useState<AuditStatus>('idle')
  const [data, setData] = useState<AuditData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [llmEnabled, setLlmEnabled] = useState(false)
  const [llmResult, setLlmResult] = useState<any>(null)
  const [llmLoading, setLlmLoading] = useState(false)

  const runAudit = useCallback(async (url: string) => {
    setStatus('running')
    setError(null)
    setData(null)
    setLlmResult(null)

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Audit failed')
      }

      setData(json.data)
      setStatus('complete')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audit failed')
      setStatus('error')
    }
  }, [])

  const runLlmEnrichment = useCallback(async () => {
    if (!data?.wcag?.failures?.length || !llmEnabled) return

    setLlmLoading(true)
    setLlmResult(null)

    try {
      const { enrichWithLLM } = await import('@/lib/llm-client')

      const key = sessionStorage.getItem('liveviewer_llm_key') || ''
      const provider = sessionStorage.getItem('liveviewer_llm_provider') || 'openai'
      const model = sessionStorage.getItem('liveviewer_llm_model') || 'gpt-3.5-turbo'

      const result = await enrichWithLLM(data.wcag.failures, provider, model, key)
      setLlmResult({ ...result, cached: false })
    } catch (err) {
      setLlmResult({ error: err instanceof Error ? err.message : 'LLM enrichment failed', provider: 'client', model: '', perFailure: [], summary: '' })
    } finally {
      setLlmLoading(false)
    }
  }, [data, llmEnabled])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Liveviewer</h1>
        <p className="mt-1 text-[color:var(--muted-foreground)]">
          Design QA robot — audit websites for WCAG contrast, right in your browser.
        </p>
      </header>

      <AuditForm onRun={runAudit} isRunning={status === 'running'} />

      {status === 'error' && (
        <div className="mt-6 rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 p-4 text-sm text-[var(--destructive)]">
          {error}
        </div>
      )}

      {data && (
        <div className="mt-6 space-y-6">
          <AuditResults data={data} />

          <LlmPanel
            enabled={llmEnabled}
            onToggle={setLlmEnabled}
            hasFailures={(data.wcag?.failures?.length ?? 0) > 0}
          />

          {llmEnabled && data.wcag && data.wcag.failures.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={runLlmEnrichment}
                disabled={llmLoading}
                className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {llmLoading ? 'Enriching...' : 'Enrich with AI'}
              </button>
            </div>
          )}

          {llmResult && !llmLoading && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
              <h3 className="mb-2 font-semibold">AI Insights</h3>
              {llmResult.error ? (
                <p className="text-[var(--destructive)]">Error: {llmResult.error}</p>
              ) : (
                <>
                  <p className="mb-3 text-[var(--muted-foreground)]">{llmResult.summary}</p>
                  <div className="space-y-2">
                    {llmResult.perFailure?.map((pf: any, i: number) => (
                      <div key={i} className="rounded border border-[var(--border)] p-3">
                        <div className="mb-1 flex items-center gap-2">
                          <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                            pf.severity === 'high' ? 'bg-red-100 text-red-700' :
                            pf.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {pf.severity}
                          </span>
                          <code className="text-xs break-all">{pf.selector}</code>
                        </div>
                        <p className="text-xs text-[var(--muted-foreground)]">{pf.explanation}</p>
                        <p className="mt-1 text-xs font-medium text-[var(--primary)]">{pf.suggestion}</p>
                      </div>
                    ))}
                  </div>
                  {llmResult.cached && (
                    <p className="mt-2 text-xs text-[var(--muted-foreground)]">(cached result)</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
