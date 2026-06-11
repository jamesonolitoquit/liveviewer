'use client'

interface PillarScores {
  wcag?: number
  design?: number
  seo?: number
  security?: number
  legal?: number
  performance?: number
}

interface HistoryEntry {
  url: string
  timestamp: number
  score: number
  passCount: number
  failCount: number
  totalElements: number
  pillars: PillarScores
}

interface DashboardProps {
  entries: HistoryEntry[]
  onReAudit: (url: string) => void
}

function scoreColor(score: number): string {
  if (score >= 90) return 'text-[var(--jao-success)]'
  if (score >= 70) return 'text-amber-800 dark:text-amber-300'
  return 'text-red-700 dark:text-red-400'
}

function scoreBg(score: number): string {
  if (score >= 90) return 'border-[var(--jao-success)]/20 bg-[var(--jao-success)]/8'
  if (score >= 70) return 'border-amber-200 dark:border-amber-700/30 bg-amber-50 dark:bg-amber-900/20'
  return 'border-red-200 dark:border-red-700/30 bg-red-50 dark:bg-red-900/20'
}

const PILLAR_LABELS: Record<string, string> = {
  wcag: 'WCAG',
  design: 'Design',
  seo: 'SEO',
  security: 'Security',
  legal: 'Legal',
  performance: 'Performance'
}

const PILLAR_ORDER = ['wcag', 'design', 'seo', 'security', 'legal', 'performance'] as const

export function Dashboard({ entries, onReAudit }: DashboardProps) {
  if (entries.length === 0) return null

  const latest = entries[0]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 text-xl font-semibold tracking-tight">Dashboard</h2>
        <p className="mb-4 text-sm text-[var(--jao-text-secondary)]">
          Latest audit: <span className="font-mono text-xs">{latest.url}</span>
          {' — '}
          <span className={scoreColor(latest.score)}>{Math.round(latest.score)}%</span>
          {' overall'}
          {' · '}
          {new Date(latest.timestamp).toLocaleDateString()}
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {PILLAR_ORDER.map((key) => {
            const score = latest.pillars[key]
            return (
              <div
                key={key}
                className={`rounded-xl border p-4 text-center shadow-sm ${score !== undefined ? scoreBg(score) : 'border-[var(--jao-border)] bg-[var(--jao-surface)]'}`}
              >
                <div className="text-xs uppercase tracking-wide text-[var(--jao-text-secondary)]">
                  {PILLAR_LABELS[key]}
                </div>
                <div className={`mt-1 text-2xl font-bold ${score !== undefined ? scoreColor(score) : 'text-[var(--jao-text-tertiary)]'}`}>
                  {score !== undefined ? `${Math.round(score)}%` : '—'}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Recent audits</h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--jao-border)] bg-[var(--jao-surface)]">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[var(--jao-border)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--jao-text-secondary)]">URL</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--jao-text-secondary)]">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--jao-text-secondary)]">Overall</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--jao-text-secondary)]">Failures</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--jao-text-secondary)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <tr key={entry.url + entry.timestamp + '-' + idx} className="border-b border-[var(--jao-border-subtle)] last:border-b-0">
                  <td className="max-w-[200px] truncate px-4 py-3 font-mono text-xs text-[var(--jao-text)]">
                    {entry.url}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--jao-text-secondary)]">
                    {new Date(entry.timestamp).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    <span className={scoreColor(entry.score)}>
                      {Math.round(entry.score)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--jao-text-secondary)]">
                    {entry.failCount > 0 ? (
                      <span className="text-red-700 dark:text-red-400">{entry.failCount}</span>
                    ) : (
                      <span className="text-[var(--jao-success)]">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onReAudit(entry.url)}
                      className="rounded-md px-2 py-1 text-xs text-[var(--jao-primary)] underline decoration-dotted transition-colors hover:bg-[var(--jao-primary)]/10"
                    >
                      Re-audit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
