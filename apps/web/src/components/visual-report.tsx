'use client'

import type { AuditData } from '@/types/audit'
import { PillarRadar } from './pillar-radar'
import { PassFailBars } from './pass-fail-bars'

interface VisualReportProps {
  data: AuditData
}

const PILLAR_LABELS: Record<string, string> = {
  wcag: 'WCAG',
  design: 'Design',
  seo: 'SEO',
  security: 'Security',
  legal: 'Legal',
  performance: 'Perf',
}

export function VisualReport({ data }: VisualReportProps) {
  const pillars = ['wcag', 'design', 'seo', 'security', 'legal', 'performance'] as const
  const scores: { pillar: string; score: number }[] = []
  const bars: { pillar: string; pass: number; fail: number }[] = []

  for (const key of pillars) {
    const p = data[key as keyof AuditData] as { score?: number; passCount?: number; failCount?: number } | null
    if (p && p.score != null) {
      scores.push({ pillar: PILLAR_LABELS[key], score: Math.round(p.score) })
    }
    if (p && p.passCount != null && p.failCount != null) {
      bars.push({ pillar: PILLAR_LABELS[key], pass: p.passCount, fail: p.failCount })
    }
  }

  const validScores = scores.filter(s => s.score > 0)
  const overall = validScores.length > 0 ? Math.round(validScores.reduce((a, s) => a + s.score, 0) / validScores.length) : null

  if (scores.length === 0 && bars.length === 0) return null

  return (
    <div className="border-b border-[var(--jao-border)] p-6">
      {overall != null && (
        <div className="mb-6 flex items-center gap-3">
          <span className={`text-3xl font-bold tracking-tight ${
            overall >= 90 ? 'text-[var(--jao-success)]' :
            overall >= 70 ? 'text-[var(--jao-warning)]' :
            'text-[var(--jao-destructive)]'
          }`}>
            {overall}%
          </span>
          <div className="text-xs text-[var(--jao-text-tertiary)]">
            <div>Overall Score</div>
            <div>{validScores.length} of 6 pillars</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {scores.length > 0 && (
          <div className="rounded-lg border border-[var(--jao-border)] bg-[var(--jao-surface)] p-4">
            <h3 className="mb-2 text-xs font-semibold text-[var(--jao-text-secondary)] uppercase tracking-wider">Pillar Scores</h3>
            <PillarRadar scores={scores} />
          </div>
        )}
        {bars.length > 0 && (
          <div className="rounded-lg border border-[var(--jao-border)] bg-[var(--jao-surface)] p-4">
            <h3 className="mb-2 text-xs font-semibold text-[var(--jao-text-secondary)] uppercase tracking-wider">Pass / Fail Breakdown</h3>
            <PassFailBars pillars={bars} />
          </div>
        )}
      </div>
    </div>
  )
}
