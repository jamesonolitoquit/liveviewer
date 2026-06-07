'use client'

import { useState, useEffect } from 'react'

interface LlmPanelProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
  hasFailures: boolean
}

const PROVIDERS = [
  { id: 'openai', label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'] },
  { id: 'anthropic', label: 'Anthropic', models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'] },
  { id: 'google', label: 'Google', models: ['gemini-1.5-pro', 'gemini-1.5-flash'] },
  { id: 'groq', label: 'Groq', models: ['llama3-70b-8192', 'llama3-8b-8192', 'mixtral-8x7b-32768'] }
]

export function LlmPanel({ enabled, onToggle, hasFailures }: LlmPanelProps) {
  const [provider, setProvider] = useState('openai')
  const [model, setModel] = useState('gpt-3.5-turbo')
  const [key, setKey] = useState('')
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    const savedProvider = sessionStorage.getItem('liveviewer_llm_provider')
    const savedModel = sessionStorage.getItem('liveviewer_llm_model')
    const savedKey = sessionStorage.getItem('liveviewer_llm_key')
    if (savedProvider) setProvider(savedProvider)
    if (savedModel) setModel(savedModel)
    if (savedKey) setKey(savedKey)
  }, [])

  const selectedProvider = PROVIDERS.find(p => p.id === provider)
  const models = selectedProvider?.models ?? []

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider)
    const prov = PROVIDERS.find(p => p.id === newProvider)
    if (prov) {
      setModel(prov.models[0])
      sessionStorage.setItem('liveviewer_llm_provider', newProvider)
      sessionStorage.setItem('liveviewer_llm_model', prov.models[0])
    }
  }

  const handleModelChange = (newModel: string) => {
    setModel(newModel)
    sessionStorage.setItem('liveviewer_llm_model', newModel)
  }

  const handleKeyChange = (newKey: string) => {
    setKey(newKey)
    sessionStorage.setItem('liveviewer_llm_key', newKey)
  }

  const clearKey = () => {
    setKey('')
    sessionStorage.removeItem('liveviewer_llm_key')
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
        <div>
          <h3 className="font-semibold text-sm">AI Enrichment</h3>
          <p className="text-xs text-[var(--muted-foreground)]">
            Explain failures with AI (requires your API key)
          </p>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={enabled}
            onChange={e => onToggle(e.target.checked)}
            className="peer sr-only"
          />
          <div className="h-5 w-9 rounded-full bg-gray-300 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-[var(--primary)] peer-checked:after:translate-x-full" />
        </label>
      </div>

      {enabled && (
        <div className="space-y-3 p-4">
          {!hasFailures && (
            <p className="text-xs text-[var(--muted-foreground)]">
              No WCAG failures to enrich. Run an audit with failures first.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Provider</label>
              <select
                value={provider}
                onChange={e => handleProviderChange(e.target.value)}
                className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs outline-none"
              >
                {PROVIDERS.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Model</label>
              <select
                value={model}
                onChange={e => handleModelChange(e.target.value)}
                className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs outline-none"
              >
                {models.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">API Key</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={key}
                  onChange={e => handleKeyChange(e.target.value)}
                  placeholder="sk-... or leave blank for Ollama"
                  className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 pr-8 text-xs outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  aria-label={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? '🙈' : '👁'}
                </button>
              </div>
              {key && (
                <button
                  onClick={clearKey}
                  className="rounded border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="rounded bg-yellow-50 p-2.5 text-xs text-yellow-800">
            <strong>Privacy:</strong> Your key is stored in session storage and sent directly to
            the provider from your browser. We never see or store your key.
            For local processing, use the{' '}
            <a
              href="https://github.com/jamesonolitoquit/liveviewer"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              CLI with Ollama
            </a>
            .
          </div>
        </div>
      )}
    </div>
  )
}
