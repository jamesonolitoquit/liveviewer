'use client'

import { useState, useEffect } from 'react'

interface SmartPanelProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
  hasFailures: boolean
}

const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1'

const STORAGE_KEYS = {
  key: 'liveviewer_llm_key',
  baseUrl: 'liveviewer_llm_base_url'
}

export function SmartPanel({ enabled, onToggle, hasFailures }: SmartPanelProps) {
  const [key, setKey] = useState('')
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL)
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    const savedKey = sessionStorage.getItem(STORAGE_KEYS.key) || ''
    const savedBaseUrl = sessionStorage.getItem(STORAGE_KEYS.baseUrl) || ''
    setKey(savedKey)
    if (savedBaseUrl) setBaseUrl(savedBaseUrl)
  }, [])

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
          <h3 className="font-semibold text-sm">Enhanced Analysis</h3>
          <p className="text-xs text-[var(--muted-foreground)]">
            Get detailed fix suggestions (requires an access key)
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
              No failures to analyze. Run an audit with failures first.
            </p>
          )}

          <div>
            <label htmlFor="enhance-base-url" className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Backend URL</label>
            <input
              id="enhance-base-url"
              type="url"
              value={baseUrl}
              onChange={e => handleBaseUrlChange(e.target.value)}
              placeholder={DEFAULT_BASE_URL}
              className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs outline-none"
            />
          </div>

          <div>
            <label htmlFor="enhance-access-key" className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Access Key</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="enhance-access-key"
                  type={showKey ? 'text' : 'password'}
                  value={key}
                  onChange={e => handleKeyChange(e.target.value)}
                  placeholder="sk-..."
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
            Your key never leaves your browser. Get a free key at{' '}
            <a href="https://opencode.ai" target="_blank" rel="noopener noreferrer" className="underline">opencode.ai</a>.
          </div>
        </div>
      )}
    </div>
  )
}
