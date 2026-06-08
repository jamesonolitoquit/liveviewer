'use client'

import { useState } from 'react'
import type { FixSuggestion } from '@/lib/llm-client'

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

interface SmartFixButtonProps {
  failure: WcagFailure
}

export function SmartFixButton({ failure }: SmartFixButtonProps) {
  const [suggestion, setSuggestion] = useState<FixSuggestion | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGetFix = async () => {
    setLoading(true)
    setError(null)
    setSuggestion(null)

    try {
      const key = (sessionStorage.getItem('liveviewer_llm_key') || '').trim()
      const provider = sessionStorage.getItem('liveviewer_llm_provider') || 'openai-compatible'
      const model = sessionStorage.getItem('liveviewer_llm_model') || 'gpt-4o-mini'
      const baseUrl = (sessionStorage.getItem('liveviewer_llm_base_url') || '').trim()

      if (!key && provider !== 'ollama') {
        throw new Error('Set your access key in the settings panel')
      }

      const { getFixSuggestion } = await import('@/lib/llm-client')
      const result = await getFixSuggestion(failure, provider, model, key, baseUrl || undefined)
      setSuggestion(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get fix')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleGetFix}
        disabled={loading}
        className="btn-gradient inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-medium text-white shadow-sm transition-all hover:scale-105 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/50 disabled:opacity-50 disabled:hover:scale-100"
      >
        {loading ? '...' : <><span>✨</span> Fix Suggestion</>}
      </button>

      {error && (
        <p className="mt-1 text-[10px] text-[var(--destructive)]">{error}</p>
      )}

      {suggestion && (
        <div className="mt-2 rounded border border-[var(--border)] bg-[var(--muted)] p-2">
          <div className="mb-1 flex items-center gap-1.5">
            <span className={`inline-block rounded px-1 py-0.5 text-[9px] font-medium uppercase ${
              suggestion.priority === 'high' ? 'bg-red-100 text-red-700' :
              suggestion.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
              'bg-green-100 text-green-700'
            }`}>
              {suggestion.priority}
            </span>
            <span className="text-[10px] text-[var(--muted-foreground)]">Suggestion</span>
          </div>
          <p className="text-[10px] text-[var(--muted-foreground)]">{suggestion.explanation}</p>
          <div className="relative mt-1">
            <pre className="rounded bg-[var(--card)] p-1.5 pr-7 text-[10px] font-mono text-[var(--foreground)] overflow-x-auto">
              {suggestion.cssFix}
            </pre>
            <button
              onClick={() => navigator.clipboard.writeText(suggestion.cssFix)}
              className="absolute right-1 top-1 rounded px-1 py-0.5 text-[10px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
              title="Copy CSS fix"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
