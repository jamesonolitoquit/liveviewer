import { useState, useEffect, useCallback } from 'react'
import browser from 'webextension-polyfill'
import type { WcagResult, Failure } from '@liveviewer/engine'

interface HighlightState {
  active: boolean
  toggle: () => void
}

function HighlightToggle({ active, toggle }: HighlightState) {
  return (
    <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
      <input
        type="checkbox"
        checked={active}
        onChange={toggle}
        className="w-3 h-3 accent-[var(--primary)]"
      />
      <span className="text-[var(--muted-foreground)]">Highlight failures</span>
    </label>
  )
}

function scoreColor(score: number): string {
  if (score >= 90) return '#15803d'
  if (score >= 70) return '#b45309'
  return '#dc2626'
}

export function Popup() {
  const [result, setResult] = useState<WcagResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [highlight, setHighlight] = useState(false)
  const [currentUrl, setCurrentUrl] = useState('')

  useEffect(() => {
    async function run() {
      try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
        if (!tab.id || !tab.url) {
          setError('Cannot access this page')
          setLoading(false)
          return
        }
        setCurrentUrl(tab.url)

        const response = await browser.tabs.sendMessage(tab.id, { type: 'RUN_AUDIT' })
        if (response?.error) {
          setError(response.error)
        } else if (response?.result) {
          setResult(response.result)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Audit failed')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  const toggleHighlight = useCallback(async () => {
    const next = !highlight
    setHighlight(next)
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
      if (tab.id) {
        await browser.tabs.sendMessage(tab.id, { type: 'TOGGLE_HIGHLIGHT', active: next })
      }
    } catch {
      // content script may not be injected yet
    }
  }, [highlight])

  const handleOpenFullReport = () => {
    if (!result || !currentUrl) return
    const encoded = encodeURIComponent(JSON.stringify(result))
    const auditUrl = `http://localhost:3000/?audit=${encoded}&url=${encodeURIComponent(currentUrl)}`
    window.open(auditUrl, '_blank')
  }

  return (
    <div style={{
      width: 420,
      padding: 12,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: 12,
      color: '#171717',
      backgroundColor: '#ffffff'
    }}>
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Liveviewer</h1>
        <HighlightToggle active={highlight} toggle={toggleHighlight} />
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 24, color: '#525252' }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #2563eb', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
          </div>
          Auditing...
        </div>
      )}

      {error && (
        <div style={{ padding: 8, borderRadius: 4, backgroundColor: '#fef2f2', color: '#dc2626', fontSize: 11 }}>
          {error}
        </div>
      )}

      {result && (
        <>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 8,
            borderRadius: 4,
            backgroundColor: '#f5f5f5',
            marginBottom: 8
          }}>
            <span style={{ fontSize: 10, color: '#525252' }}>{result.totalElements} elements</span>
            <span style={{ fontSize: 24, fontWeight: 700, color: scoreColor(result.score) }}>
              {result.score}%
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1, padding: 6, borderRadius: 4, backgroundColor: '#f0fdf4', textAlign: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#15803d' }}>{result.passCount}</span>
              <div style={{ fontSize: 9, color: '#525252' }}>Pass</div>
            </div>
            <div style={{ flex: 1, padding: 6, borderRadius: 4, backgroundColor: '#fef2f2', textAlign: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#dc2626' }}>{result.failCount}</span>
              <div style={{ fontSize: 9, color: '#525252' }}>Fail</div>
            </div>
          </div>

          {result.failures.length > 0 && (
            <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 8 }}>
              {result.failures.slice(0, 10).map((f, i) => (
                <div key={i} style={{
                  padding: 6,
                  marginBottom: 4,
                  borderRadius: 4,
                  border: '1px solid #d4d4d4',
                  fontSize: 10
                }}>
                  <div style={{ marginBottom: 2, display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '1px 4px',
                      borderRadius: 2,
                      fontSize: 9,
                      fontWeight: 600,
                      backgroundColor: f.contrastRatio < 3 ? '#fef2f2' : '#fefce8',
                      color: f.contrastRatio < 3 ? '#dc2626' : '#b45309'
                    }}>
                      {f.contrastRatio}:1
                    </span>
                    <span style={{ color: '#525252' }}>needs {f.required}:1</span>
                  </div>
                  <code style={{ color: '#525252', wordBreak: 'break-all' }}>{f.selector}</code>
                </div>
              ))}
              {result.failures.length > 10 && (
                <div style={{ textAlign: 'center', fontSize: 10, color: '#525252', padding: 4 }}>
                  +{result.failures.length - 10} more failures
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={handleOpenFullReport}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: 4,
                border: '1px solid #d4d4d4',
                backgroundColor: '#ffffff',
                fontSize: 10,
                cursor: 'pointer',
                color: '#525252'
              }}
            >
              Open full report
            </button>
            <button
              onClick={() => {
                const csv = 'Selector,Text,Foreground,Background,Contrast Ratio,Required Ratio\n' +
                  result.failures.map(f =>
                    `"${f.selector}","${f.text}","${f.foreground}","${f.background}",${f.contrastRatio},${f.required}`
                  ).join('\n')
                const blob = new Blob([csv], { type: 'text/csv' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'liveviewer-audit.csv'
                a.click()
                URL.revokeObjectURL(url)
              }}
              style={{
                padding: '6px 8px',
                borderRadius: 4,
                border: '1px solid #d4d4d4',
                backgroundColor: '#ffffff',
                fontSize: 10,
                cursor: 'pointer',
                color: '#525252'
              }}
            >
              CSV
            </button>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
