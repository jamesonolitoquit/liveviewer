'use client'

import { useState, useEffect } from 'react'

interface LlmPanelProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
  hasFailures: boolean
}

interface ProviderConfig {
  id: string
  label: string
  defaultBaseUrl: string
  showBaseUrl: boolean
  showKey: boolean
  defaultModel: string
  models: string[]
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai-compatible',
    label: 'OpenAI Compatible',
    defaultBaseUrl: 'https://api.openai.com/v1',
    showBaseUrl: true,
    showKey: true,
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo', 'deepseek-chat', 'llama3-70b-8192', 'claude-sonnet-4-20250514', 'grok-2-latest', 'mistral-large-latest']
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    showBaseUrl: false,
    showKey: true,
    defaultModel: 'claude-sonnet-4-20250514',
    models: ['claude-sonnet-4-20250514', 'claude-3.5-haiku-20241022', 'claude-3-opus-20240229']
  },
  {
    id: 'google',
    label: 'Google',
    defaultBaseUrl: '',
    showBaseUrl: false,
    showKey: true,
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-2.5-flash-preview-04-17', 'gemini-1.5-flash', 'gemini-1.5-pro']
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    defaultBaseUrl: 'http://localhost:11434',
    showBaseUrl: true,
    showKey: false,
    defaultModel: 'llama3.2',
    models: ['llama3.2', 'llama3.1', 'llama3', 'mistral', 'mixtral']
  }
]

function getDefaultModel(providerId: string): string {
  const p = PROVIDERS.find(x => x.id === providerId)
  return p?.defaultModel ?? 'gpt-4o-mini'
}

const STORAGE_KEYS = {
  provider: 'liveviewer_llm_provider',
  model: 'liveviewer_llm_model',
  key: 'liveviewer_llm_key',
  baseUrl: 'liveviewer_llm_base_url'
}

export function LlmPanel({ enabled, onToggle, hasFailures }: LlmPanelProps) {
  const [provider, setProvider] = useState('openai-compatible')
  const [model, setModel] = useState('gpt-4o-mini')
  const [key, setKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    const savedProvider = sessionStorage.getItem(STORAGE_KEYS.provider) || 'openai-compatible'
    const savedModel = sessionStorage.getItem(STORAGE_KEYS.model) || getDefaultModel(savedProvider)
    const savedKey = sessionStorage.getItem(STORAGE_KEYS.key) || ''
    const savedBaseUrl = sessionStorage.getItem(STORAGE_KEYS.baseUrl) || ''
    setProvider(savedProvider)
    setModel(savedModel)
    setKey(savedKey)
    if (savedBaseUrl) setBaseUrl(savedBaseUrl)
  }, [])

  const cfg = PROVIDERS.find(p => p.id === provider) ?? PROVIDERS[0]

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider)
    const newCfg = PROVIDERS.find(p => p.id === newProvider)
    if (newCfg) {
      const newModel = newCfg.defaultModel
      setModel(newModel)
      setBaseUrl(newCfg.defaultBaseUrl)
      sessionStorage.setItem(STORAGE_KEYS.provider, newProvider)
      sessionStorage.setItem(STORAGE_KEYS.model, newModel)
      sessionStorage.setItem(STORAGE_KEYS.baseUrl, newCfg.defaultBaseUrl)
    }
  }

  const handleModelChange = (newModel: string) => {
    setModel(newModel)
    sessionStorage.setItem(STORAGE_KEYS.model, newModel)
  }

  const handleKeyChange = (newKey: string) => {
    setKey(newKey)
    sessionStorage.setItem(STORAGE_KEYS.key, newKey.trim())
  }

  const handleBaseUrlChange = (newUrl: string) => {
    setBaseUrl(newUrl)
    sessionStorage.setItem(STORAGE_KEYS.baseUrl, newUrl)
  }

  const clearKey = () => {
    setKey('')
    sessionStorage.removeItem(STORAGE_KEYS.key)
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
              <label htmlFor="llm-provider" className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Provider</label>
              <select
                id="llm-provider"
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
              <label htmlFor="llm-model" className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Model</label>
              <input
                id="llm-model"
                type="text"
                value={model}
                onChange={e => handleModelChange(e.target.value)}
                list="llm-model-suggestions"
                placeholder={cfg.defaultModel}
                className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs outline-none"
              />
              <datalist id="llm-model-suggestions">
                {cfg.models.map(m => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
          </div>

          {cfg.showBaseUrl && (
            <div>
              <label htmlFor="llm-base-url" className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Base URL</label>
              <input
                id="llm-base-url"
                type="url"
                value={baseUrl}
                onChange={e => handleBaseUrlChange(e.target.value)}
                placeholder={cfg.defaultBaseUrl}
                className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs outline-none"
              />
            </div>
          )}

          {cfg.showKey && (
            <div>
              <label htmlFor="llm-api-key" className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">API Key</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    id="llm-api-key"
                    type={showKey ? 'text' : 'password'}
                    value={key}
                    onChange={e => handleKeyChange(e.target.value)}
                    placeholder={provider === 'ollama' ? 'Not needed for local models' : 'sk-...'}
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
          )}

          <div className="rounded bg-yellow-50 p-2.5 text-xs text-yellow-800">
            <strong>Privacy:</strong> Your key is stored in session storage and sent directly to
            the provider from your browser. We never see or store your key.
            For fully local processing, select <strong>Ollama (local)</strong> or{' '}
            <a
              href="https://github.com/jamesonolitoquit/liveviewer"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              use the CLI with Ollama
            </a>
            .
          </div>

          <div className="rounded bg-blue-50 p-2.5 text-xs text-blue-800">
            <strong>Heavy pages?</strong> The web app has a 7-second timeout. For large sites (web.dev, nytimes.com),
            use the CLI with <code>--wait-until domcontentloaded</code> for more reliable results.
          </div>

          <details className="text-xs text-[var(--muted-foreground)]">
            <summary className="cursor-pointer font-medium">Compatible providers</summary>
            <ul className="mt-1 space-y-0.5 pl-4 list-disc">
              <li><strong>OpenAI Compatible</strong> — OpenAI, Groq, Together AI, Fireworks, DeepSeek, Perplexity, OpenRouter, xAI Grok, Mistral, GitHub Models, Azure OpenAI, and any API using <code>/v1/chat/completions</code></li>
              <li><strong>Ollama (local)</strong> — Free, runs on your machine. <code>ollama pull llama3.2</code></li>
              <li><strong>Anthropic</strong> — Claude models</li>
              <li><strong>Google</strong> — Gemini models</li>
            </ul>
          </details>
        </div>
      )}
    </div>
  )
}
