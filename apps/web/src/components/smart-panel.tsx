'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'

interface SmartPanelProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
  hasFailures: boolean
  onEnrich: () => void
  llmLoading: boolean
  llmResult: any
}

const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1'

const STORAGE_KEYS = {
  key: 'liveviewer_llm_key',
  baseUrl: 'liveviewer_llm_base_url'
}

function SeverityPill({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    high: 'bg-[var(--jao-destructive)]/10 text-[var(--jao-destructive)]',
    medium: 'bg-[var(--jao-warning)]/10 text-[var(--jao-warning)]',
    low: 'bg-[var(--jao-success)]/10 text-[var(--jao-success)]'
  }
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${colors[severity] || colors.low}`}>
      {severity}
    </span>
  )
}

export function SmartPanel({ enabled, onToggle, hasFailures, onEnrich, llmLoading, llmResult }: SmartPanelProps) {
  const [open, setOpen] = useState(false)
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

  const handleEnrich = () => {
    if (enabled && hasFailures) onEnrich()
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--jao-primary)] px-5 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-[var(--jao-primary-hover)] hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/50"
          aria-label="Open enhanced analysis panel"
        >
          <span>✨</span>
          <span>Get Smart Fixes</span>
        </button>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} className="fixed inset-0 z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <DialogPanel className="pointer-events-auto w-screen max-w-md h-full">
                <div className="flex h-full flex-col overflow-y-auto bg-[var(--jao-surface)] border-l border-[var(--jao-border)] shadow-xl">
                  <div className="flex items-center justify-between border-b border-[var(--jao-border)] px-6 py-4">
                    <DialogTitle className="text-base font-semibold">Enhanced Analysis</DialogTitle>
                    <button
                      onClick={() => setOpen(false)}
                      className="rounded-full p-1 text-[var(--jao-text-secondary)] hover:text-[var(--jao-text)] hover:bg-[var(--jao-border-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/30 transition-colors"
                      aria-label="Close panel"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex-1 space-y-6 px-6 py-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Smart Analysis</p>
                        <p className="text-xs text-[var(--muted-foreground)]">Get detailed fix suggestions</p>
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
                      <div className="space-y-4">
                        {!hasFailures && (
                          <p className="text-xs text-[var(--muted-foreground)]">
                            No failures to analyze. Run an audit with failures first.
                          </p>
                        )}

                        <div>
                          <label htmlFor="drawer-base-url" className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">Backend URL</label>
                          <input
                            id="drawer-base-url"
                            type="url"
                            value={baseUrl}
                            onChange={e => handleBaseUrlChange(e.target.value)}
                            placeholder={DEFAULT_BASE_URL}
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--jao-primary)] focus:ring-2 focus:ring-[var(--jao-primary)]/20"
                          />
                        </div>

                        <div>
                          <label htmlFor="drawer-access-key" className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">Access Key</label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <input
                                id="drawer-access-key"
                                type={showKey ? 'text' : 'password'}
                                value={key}
                                onChange={e => handleKeyChange(e.target.value)}
                                placeholder="sk-..."
                                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 pr-8 text-sm outline-none transition-colors focus:border-[var(--jao-primary)] focus:ring-2 focus:ring-[var(--jao-primary)]/20"
                              />
                              <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                                aria-label={showKey ? 'Hide key' : 'Show key'}
                              >
                                {showKey ? '🙈' : '👁'}
                              </button>
                            </div>
                            {key && (
                              <button
                                onClick={clearKey}
                                className="rounded-lg border border-[var(--border)] px-2.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-800 dark:text-amber-200">
                          Your key never leaves your browser. Get a free key at{' '}
                          <a href="https://opencode.ai" target="_blank" rel="noopener noreferrer" className="underline">opencode.ai</a>.
                        </div>

                        <button
                          onClick={handleEnrich}
                          disabled={llmLoading || !hasFailures}
                          className="btn-gradient inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/50 disabled:opacity-50"
                        >
                          {llmLoading ? (
                            <>
                              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              Analyzing...
                            </>
                          ) : (
                            'Get Smart Fixes'
                          )}
                        </button>

                        {llmResult && !llmLoading && (
                          <div className="space-y-3">
                            {llmResult.error ? (
                              <p className="text-sm text-[var(--jao-destructive)]">{llmResult.error}</p>
                            ) : (
                              <>
                                <p className="text-sm text-[var(--jao-text-secondary)]">{llmResult.summary}</p>

                                {llmResult.perFailure?.length > 0 && (
                                  <div className="space-y-2">
                                    <p className="text-xs font-semibold text-[var(--jao-destructive)]">Accessibility</p>
                                    {llmResult.perFailure.map((pf: any, i: number) => (
                                      <div key={i} className="rounded-lg border border-[var(--jao-border)] p-3">
                                        <div className="mb-1 flex items-center gap-2">
                                          <SeverityPill severity={pf.severity} />
                                          <code className="break-all text-[10px] text-[var(--jao-text-secondary)]">{pf.selector}</code>
                                        </div>
                                        <p className="text-xs text-[var(--jao-text-tertiary)]">{pf.explanation}</p>
                                        <p className="mt-1 text-xs font-medium text-[var(--jao-primary)]">{pf.suggestion}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {llmResult.designFixes?.length > 0 && (
                                  <div className="space-y-2">
                                    <p className="text-xs font-semibold text-[var(--jao-accent)]">Design Quality</p>
                                    {llmResult.designFixes.map((df: any, i: number) => (
                                      <div key={i} className="rounded-lg border border-[var(--jao-border)] border-l-[2px] border-l-[var(--jao-accent)] p-3">
                                        <div className="mb-1 flex items-center gap-2">
                                          <SeverityPill severity={df.severity} />
                                          <code className="break-all text-[10px] text-[var(--jao-text-secondary)]">{df.selector}</code>
                                        </div>
                                        <p className="text-xs text-[var(--jao-text-tertiary)]">{df.explanation}</p>
                                        <p className="mt-1 text-xs font-medium text-[var(--jao-accent)]">{df.suggestion}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {llmResult.cached && (
                                  <p className="text-xs text-[var(--jao-text-tertiary)]">(cached result)</p>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </DialogPanel>
            </div>
          </div>
        </div>
      </Dialog>
    </>
  )
}
