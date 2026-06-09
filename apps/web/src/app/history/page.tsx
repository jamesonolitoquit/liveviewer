'use client'

import { useState, useEffect, useCallback } from 'react'
import { AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area } from 'recharts'
import { formatTimestamp, getLocalHistory } from '@/lib/history'
import { humanError } from '@/lib/errors'

interface HistoryEntry {
  url: string
  timestamp: number
  score: number
  passCount: number
  failCount: number
  totalElements: number
}

export default function HistoryPage() {
  const [url, setUrl] = useState('')
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [colors, setColors] = useState({ primary: '#4F46E5', border: '#E2E8F0', textSecondary: '#4B5563', surface: '#FFFFFF' })

  useEffect(() => {
    const el = document.documentElement
    const isDark = el.classList.contains('dark')
    setColors({
      primary: getComputedStyle(el).getPropertyValue('--jao-primary').trim() || '#4F46E5',
      border: isDark ? '#334155' : '#E2E8F0',
      textSecondary: isDark ? '#94A3B8' : '#4B5563',
      surface: isDark ? '#1E293B' : '#FFFFFF',
    })
  }, [])

  const fetchHistory = useCallback(async (u: string) => {
    if (!u.trim()) return
    setLoading(true)
    setError(null)
    setSearched(true)

    let localEntries = getLocalHistory(u.trim())
    if (localEntries.length > 0) {
      setEntries(localEntries)
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`/api/history?url=${encodeURIComponent(u.trim())}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error || humanError('history'))
      setEntries(json.data || [])
    } catch (err) {
      if (localEntries.length === 0) {
        setError(err instanceof Error ? err.message : humanError('history'))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchHistory(url)
  }

  const chartData = entries
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(e => ({
      date: formatTimestamp(e.timestamp),
      score: e.score,
      passCount: e.passCount,
      failCount: e.failCount,
      totalElements: e.totalElements
    }))

  const latest = entries[entries.length - 1]
  const previous = entries.length > 1 ? entries[entries.length - 2] : null
  const diff = latest && previous ? latest.score - previous.score : null

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Audit History</h1>
        <p className="mt-1 text-[var(--muted-foreground)]">
          Track WCAG scores over time for any URL.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex gap-3" role="search" aria-label="View audit history">
        <label htmlFor="history-url" className="sr-only">Website URL</label>
        <input
          id="history-url"
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://example.com"
          required
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm outline-none transition-colors focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="inline-flex min-h-11 items-center rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'View History'}
        </button>
      </form>

      {error && (
        <div className="mt-6 rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 p-4 text-sm text-[var(--destructive)]" role="alert">
          {error}
        </div>
      )}

      {searched && !loading && !error && entries.length === 0 && (
        <div className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--card)] p-8 text-center text-sm text-[var(--muted-foreground)]" role="status">
          No audit history found for this URL. Run an audit first.
        </div>
      )}

      {entries.length > 0 && (
        <div className="mt-6 space-y-6">
          {latest && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
              <h2 className="text-sm font-semibold">Latest Score</h2>
              <div className="mt-2 flex items-baseline gap-3">
                <span className={`text-3xl font-bold ${
                  latest.score >= 90 ? 'text-[var(--success)]' :
                  latest.score >= 70 ? 'text-[var(--warning)]' :
                  'text-[var(--destructive)]'
                }`}>
                  {latest.score}%
                </span>
                {diff !== null && (
                  <span className={`text-sm font-medium ${
                    diff > 0 ? 'text-[var(--success)]' :
                    diff < 0 ? 'text-[var(--destructive)]' :
                    'text-[var(--muted-foreground)]'
                  }`}>
                    {diff > 0 ? '+' : ''}{diff} pts
                    {diff <= -5 && ' ⚠ regression'}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {latest.passCount}/{latest.totalElements} elements pass · {formatTimestamp(latest.timestamp)}
              </p>
            </div>
          )}

          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
            <h2 className="mb-3 text-sm font-semibold">Score Trend</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors.primary} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={colors.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: colors.textSecondary }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: colors.textSecondary }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: colors.surface,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: colors.textSecondary,
                    }}
                  />
                  <Area type="monotone" dataKey="score" stroke={colors.primary} fill="url(#scoreGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
            <h2 className="mb-3 text-sm font-semibold">Recent Audits ({entries.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
                    <th className="pb-2 pr-3 text-left font-medium">Date</th>
                    <th className="pb-2 pr-3 text-left font-medium">Score</th>
                    <th className="pb-2 pr-3 text-right font-medium">Pass</th>
                    <th className="pb-2 pr-3 text-right font-medium">Fail</th>
                    <th className="pb-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[...entries].reverse().map((e, i) => (
                    <tr key={i} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-2 pr-3 text-[var(--muted-foreground)]">{formatTimestamp(e.timestamp)}</td>
                      <td className={`py-2 pr-3 font-medium ${
                        e.score >= 90 ? 'text-[var(--success)]' :
                        e.score >= 70 ? 'text-[var(--warning)]' :
                        'text-[var(--destructive)]'
                      }`}>{e.score}%</td>
                      <td className="py-2 pr-3 text-right text-[var(--success)]">{e.passCount}</td>
                      <td className="py-2 pr-3 text-right text-[var(--destructive)]">{e.failCount}</td>
                      <td className="py-2 text-right text-[var(--muted-foreground)]">{e.totalElements}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 text-center">
        <a
          href="/"
          className="text-sm text-[var(--primary)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
        >
          ← Back to Audit
        </a>
      </div>
    </div>
  )
}
