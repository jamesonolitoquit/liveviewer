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

interface AiFixButtonProps {
  failure: WcagFailure
}

export function AiFixButton({ failure }: AiFixButtonProps) {
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
        throw new Error('Set your LLM API key in the AI panel above')
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
        className="rounded border border-[var(--jao-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--jao-text-secondary)] transition-colors hover:border-[var(--jao-primary)] hover:text-[var(--jao-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/30 disabled:opacity-50"
      >
        {loading ? '...' : 'AI Fix'}
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
            <span className="text-[10px] text-[var(--muted-foreground)]">AI Suggestion</span>
          </div>
          <p className="text-[10px] text-[var(--muted-foreground)]">{suggestion.explanation}</p>
          <pre className="mt-1 rounded bg-[var(--card)] p-1.5 text-[10px] font-mono text-[var(--foreground)] overflow-x-auto">
            {suggestion.cssFix}
          </pre>
        </div>
      )}
    </div>
  )
}
