import { useRef } from 'react'
import { CheckCircle } from 'lucide-react'
import type { AuditData, WcagFailure, DesignFailure, FixSuggestion, SeoFailure, SecurityFailure, LegalFailure, PerformanceData } from '@/types/audit'
import { SmartFixButton } from './smart-fix-button'
import { VisualReport } from './visual-report'

interface AuditResultsProps {
  data: AuditData
  children?: React.ReactNode
}

function scoreStyles(score: number) {
  if (score >= 90) return {
    text: 'text-[var(--jao-success)]',
    cardBg: 'bg-[var(--jao-success)]/8',
    cardBorder: 'border-[var(--jao-success)]/20',
    stroke: 'var(--jao-success)'
  }
  if (score >= 70) return {
    text: 'text-amber-800 dark:text-amber-300',
    cardBg: 'bg-amber-50 dark:bg-amber-900/20',
    cardBorder: 'border-amber-200 dark:border-amber-700/30',
    stroke: 'var(--jao-warning)'
  }
  return {
    text: 'text-red-700 dark:text-red-400',
    cardBg: 'bg-red-50 dark:bg-red-900/20',
    cardBorder: 'border-red-200 dark:border-red-700/30',
    stroke: 'var(--jao-destructive)'
  }
}

function ScoreCard({ score, size = 64, title, subtitle }: { score: number; size?: number; title?: string; subtitle?: string }) {
  const s = scoreStyles(score)
  return (
    <div
      className={`flex w-full items-center gap-4 rounded-2xl border p-4 shadow-sm ${s.cardBg} ${s.cardBorder}`}
      title={title}
    >
      <div className="relative inline-flex items-center justify-center flex-shrink-0">
        <svg width={size} height={size} viewBox="0 0 36 36" className="-rotate-90">
          <circle cx="18" cy="18" r={15.5} fill="none" stroke="var(--jao-border)" strokeWidth="3" />
          <circle
            cx="18" cy="18" r={15.5}
            fill="none"
            stroke={s.stroke}
            strokeWidth="3"
            strokeDasharray={2 * Math.PI * 15.5}
            strokeDashoffset={2 * Math.PI * 15.5 - (score / 100) * 2 * Math.PI * 15.5}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
      </div>
      <div>
        <span className={`text-3xl font-bold ${s.text}`}>{score}%</span>
        {subtitle && <div className="text-xs text-[var(--jao-text-tertiary)] mt-0.5">{subtitle}</div>}
      </div>
    </div>
  )
}

function vpLabel(vp: { width: number; height: number }): string {
  if (vp.width === 1280) return 'D'
  if (vp.width === 768) return 'T'
  if (vp.width === 375) return 'M'
  return `${vp.width}×${vp.height}`
}

function vpBadge(vp: { width: number; height: number }): string {
  if (vp.width === 1280) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
  if (vp.width === 375) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
  if (vp.width === 768) return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
  return 'bg-[var(--jao-border)] text-[var(--jao-text-secondary)]'
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
  }
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${colors[severity] || colors.low}`}>
      {severity}
    </span>
  )
}

type SeverityLevel = 'high' | 'medium' | 'low'

function FailureCard({ children, severity }: { children: React.ReactNode; severity: SeverityLevel }) {
  const borderColors: Record<string, string> = {
    high: 'border-l-[var(--jao-destructive)]',
    medium: 'border-l-[var(--jao-warning)]',
    low: 'border-l-[var(--jao-success)]'
  }
  return (
    <div className={`rounded-lg border border-[var(--jao-border)] border-l-[3px] bg-[var(--jao-surface)] p-3 text-xs shadow-sm transition-shadow hover:shadow-md ${borderColors[severity]}`} role="listitem">
      {children}
    </div>
  )
}

interface PillarFailuresProps<T extends { severity?: string }> {
  failures: T[]
  title: string
  accentColor: string
  renderContent: (f: T, i: number) => React.ReactNode
  emptyState?: React.ReactNode
}

function PillarFailures<T extends { severity?: string }>({ failures, title, accentColor, renderContent, emptyState }: PillarFailuresProps<T>) {
  const severities: SeverityLevel[] = ['high', 'medium', 'low']
  const groups: Record<string, T[]> = { high: [], medium: [], low: [] }
  for (const f of failures) groups[f.severity || 'low']?.push(f)
  const activeGroups = severities.filter(s => groups[s].length > 0)

  if (failures.length === 0) return emptyState ?? null

  return (
    <div className="border-t border-[var(--jao-border)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className={`text-sm font-medium ${accentColor}`}>
            {title} — {failures.length} issue{failures.length !== 1 ? 's' : ''}
          </h3>
          {activeGroups.map(s => (
            <span key={s} className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium uppercase ${
              s === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
              s === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
              'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
            }`}>{s}: {groups[s].length}</span>
          ))}
        </div>
      </div>
      <div className="space-y-3" role="list" aria-label={`${title} failure details`}>
        {activeGroups.map(s => {
          const content = (
            <div className="space-y-2">
              {groups[s].map((f, i) => (
                <FailureCard key={i} severity={s}>
                  {renderContent(f, i)}
                </FailureCard>
              ))}
            </div>
          )
          const label = s.charAt(0).toUpperCase() + s.slice(1)
          return (
            <details key={s} className="group" {...(s === 'high' ? { open: true } : {})}>
              <summary className="cursor-pointer text-sm font-medium text-[var(--jao-text-secondary)] hover:text-[var(--jao-text)] focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/30 rounded px-1 py-0.5 transition-colors">
                {label} severity ({groups[s].length})
              </summary>
              <div className="mt-2">{content}</div>
            </details>
          )
        })}
      </div>
    </div>
  )
}

function PerformanceSection({ perf }: { perf: PerformanceData }) {
  if (perf.error) {
    return (
      <div className="border-t border-[var(--jao-border)] p-6">
        <h3 className="mb-3 text-sm font-medium text-[var(--jao-text)]">Performance</h3>
        <div className="rounded-lg border border-[var(--jao-destructive)]/30 bg-red-50 dark:bg-red-900/10 p-3 text-xs text-[var(--jao-text-secondary)]">
          {perf.error}
        </div>
      </div>
    )
  }

  const metrics = [
    { key: 'lcp', label: 'LCP', value: perf.lcp, unit: 's', desc: 'Largest Contentful Paint' },
    { key: 'fcp', label: 'FCP', value: perf.fcp, unit: 's', desc: 'First Contentful Paint' },
    { key: 'tbt', label: 'TBT', value: perf.tbt, unit: 'ms', desc: 'Total Blocking Time' },
    { key: 'cls', label: 'CLS', value: perf.cls, unit: '', desc: 'Cumulative Layout Shift' },
    { key: 'si', label: 'SI', value: perf.speedIndex, unit: 's', desc: 'Speed Index' },
    { key: 'tti', label: 'TTI', value: perf.tti, unit: 's', desc: 'Time to Interactive' },
  ]

  const gradeColors: Record<string, string> = {
    A: 'text-[var(--jao-success)] bg-[var(--jao-success)]/8 border-[var(--jao-success)]/20',
    B: 'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/30',
    C: 'text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700/30',
    D: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/30',
    F: 'text-red-800 dark:text-red-300 bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700/40',
  }

  const metricThresholds: Record<string, { good: number; poor: number }> = {
    lcp: { good: 2.5, poor: 4.0 },
    fcp: { good: 1.8, poor: 3.0 },
    tbt: { good: 200, poor: 600 },
    cls: { good: 0.1, poor: 0.25 },
    si: { good: 3.4, poor: 5.8 },
    tti: { good: 3.8, poor: 7.3 },
  }

  return (
    <div className="border-t border-[var(--jao-border)] p-6">
      <div className="mb-4 flex items-center gap-3">
        <h3 className="text-sm font-medium text-[var(--jao-text)]">Performance</h3>
        {perf.grade && (
          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-bold ${gradeColors[perf.grade] || 'text-[var(--jao-text-secondary)] bg-[var(--jao-surface)] border-[var(--jao-border)]'}`}>
            {perf.grade}
          </span>
        )}
        {perf.score != null && <ScoreCard score={perf.score} size={28} title="Performance score" />}
      </div>
      {perf.recommendations && perf.recommendations.length > 0 && (
        <details open className="mb-4 group">
          <summary className="cursor-pointer text-xs font-medium text-[var(--jao-text-secondary)] hover:text-[var(--jao-text)] transition-colors mb-2">
            {perf.recommendations.length} recommendation{perf.recommendations.length !== 1 ? 's' : ''}
          </summary>
          <div className="space-y-1">
            {perf.recommendations.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-[var(--jao-text-tertiary)]">
                <span className="mt-0.5 text-[var(--jao-warning)] shrink-0">&#9654;</span>
                <span>{r}</span>
              </div>
            ))}
          </div>
        </details>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {metrics.map(m => {
          const val = m.value != null
            ? m.unit === 'ms' ? Math.round(m.value as number) : (m.value as number).toFixed(2)
            : null
          const threshold = metricThresholds[m.key]
          let metricColor = 'text-[var(--jao-text-tertiary)]'
          if (val != null && threshold) {
            metricColor = m.value! <= threshold.good
              ? 'text-[var(--jao-success)]'
              : m.value! <= threshold.poor
                ? 'text-[var(--jao-warning)]'
                : 'text-[var(--jao-destructive)]'
          }
          return (
            <div key={m.key} className="rounded-lg border border-[var(--jao-border)] bg-[var(--jao-surface)] p-3 text-center shadow-sm">
              <div className={`text-lg font-bold ${val != null ? metricColor : 'text-[var(--jao-text-tertiary)]'}`}>
                {val != null ? `${val}${m.unit ? m.unit : ''}` : '\u2014'}
              </div>
              <div className="text-[10px] text-[var(--jao-text-tertiary)] mt-0.5" title={m.desc}>{m.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function renderSeoFailure(f: SeoFailure, _i: number) {
  return (
    <>
      <div className="mb-1 flex items-center gap-2">
        <SeverityBadge severity={f.severity} />
        <span className="text-[var(--jao-text-secondary)] text-[10px]">{f.ruleName}</span>
      </div>
      <code className="block break-all text-[10px] text-[var(--jao-text-secondary)]">{f.selector}</code>
      <p className="mt-0.5 text-[var(--jao-text-tertiary)]">{f.description}</p>
      <div className="mt-1 flex gap-3 text-[10px] text-[var(--jao-text-tertiary)]">
        <span>found: {f.value}</span>
        <span>expected: {f.expected}</span>
      </div>
    </>
  )
}

function renderSecurityFailure(f: SecurityFailure, _i: number) {
  return (
    <>
      <div className="mb-1 flex items-center gap-2">
        <SeverityBadge severity={f.severity} />
        <span className="text-[var(--jao-text-secondary)] text-[10px]">{f.ruleName}</span>
      </div>
      <code className="block break-all text-[10px] text-[var(--jao-text-secondary)]">{f.selector}</code>
      <p className="mt-0.5 text-[var(--jao-text-tertiary)]">{f.description}</p>
      <div className="mt-1 flex gap-3 text-[10px] text-[var(--jao-text-tertiary)]">
        <span>found: {f.value}</span>
        <span>expected: {f.expected}</span>
      </div>
    </>
  )
}

function renderLegalFailure(f: LegalFailure, _i: number) {
  return (
    <>
      <div className="mb-1 flex items-center gap-2">
        <SeverityBadge severity={f.severity || 'low'} />
        <span className="text-[var(--jao-text-secondary)] text-[10px]">{f.ruleName || f.ruleId}</span>
      </div>
      <code className="block break-all text-[10px] text-[var(--jao-text-secondary)]">{f.selector}</code>
      <p className="mt-0.5 text-[var(--jao-text-tertiary)]">{f.description}</p>
      {(f.value || f.expected) && (
        <div className="mt-1 flex gap-3 text-[10px] text-[var(--jao-text-tertiary)]">
          {f.value && <span>found: {f.value}</span>}
          {f.expected && <span>expected: {f.expected}</span>}
        </div>
      )}
    </>
  )
}

function renderDesignFailure(f: DesignFailure, _i: number) {
  return (
    <>
      <div className="mb-1 flex items-center gap-2">
        <SeverityBadge severity={f.severity} />
        <span className="text-[var(--jao-text-secondary)] text-[10px]">{f.ruleName}</span>
      </div>
      <code className="block break-all text-[10px] text-[var(--jao-text-secondary)]">{f.selector}</code>
      <p className="mt-0.5 text-[var(--jao-text-tertiary)]">{f.description}</p>
      <div className="mt-1 flex gap-3 text-[10px] text-[var(--jao-text-tertiary)]">
        <span>found: {f.value}</span>
        <span>expected: {f.expected}</span>
      </div>
    </>
  )
}

export function AuditResults({ data, children }: AuditResultsProps) {
  const { wcag, design, seo, security, legal, performance } = data
  const multi = data.multiViewport && data.viewports && data.viewports.length >= 2
  const resultsRef = useRef<HTMLElement>(null)

  const renderWcagFailure = (f: WcagFailure & { severity: string }, _i: number) => (
    <>
      <div className="mb-1 flex items-center gap-2">
        <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium ${
          f.contrastRatio < 3 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
          f.contrastRatio < 4.5 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
        }`}>
          {f.contrastRatio}:1
        </span>
        <span className="text-[var(--jao-text-tertiary)] text-[10px]">
          needs {f.required}:1
        </span>
        {multi && f.viewports && f.viewports.length > 0 && (
          <span className="ml-auto w-full sm:w-auto flex gap-1 mt-1 sm:mt-0 sm:self-center self-start">
            {f.viewports.map((vp: { width: number; height: number }, vi: number) => (
              <span key={vi} className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-medium ${vpBadge(vp)}`}>{vpLabel(vp)}</span>
            ))}
          </span>
        )}
      </div>
      <code className="block break-all text-[10px] text-[var(--jao-text-secondary)]">{f.selector}</code>
      <p className="mt-0.5 truncate text-[var(--jao-text-tertiary)]">&ldquo;{f.text}&rdquo;</p>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[var(--jao-text-tertiary)]">
        <span>fg: {f.foreground}</span>
        <span>bg: {f.background}</span>
        <span>{f.fontSize}px{f.isLarge ? ' (large)' : ''}</span>
      </div>
      <div className="mt-2"><SmartFixButton failure={f} /></div>
    </>
  )

  const expandAll = () => {
    resultsRef.current?.querySelectorAll<HTMLElement>('details')
      .forEach(el => el.setAttribute('open', ''))
  }

  const collapseAll = () => {
    resultsRef.current?.querySelectorAll<HTMLElement>('details')
      .forEach(el => el.removeAttribute('open'))
  }

  if (!wcag && !design && !seo && !security && !legal && !performance) {
    return (
      <div className="card p-6 text-sm text-[var(--jao-text-secondary)] text-center" role="status">
        No audit data. Run with at least one pillar enabled.
      </div>
    )
  }

  return (
    <section ref={resultsRef} className="card overflow-hidden" aria-label="Audit results">
      {children && (
        <div className="sticky top-0 z-10 border-b border-[var(--jao-border)] bg-[var(--jao-surface)] px-6 py-3 shadow-sm">
          {children}
        </div>
      )}
      <VisualReport data={data} />
      {(wcag || design || seo || security || legal || performance) && (
        <div className="border-b border-[var(--jao-border)] p-6">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-semibold text-lg">Audit Results</h2>
            <div className="flex gap-1">
              <button
                data-testid="expand-all"
                onClick={expandAll}
                className="rounded border border-[var(--jao-border)] px-2 py-0.5 text-[10px] text-[var(--jao-text-secondary)] hover:bg-[var(--jao-border-subtle)] transition-colors"
              >
                ↕ Expand All
              </button>
              <button
                data-testid="collapse-all"
                onClick={collapseAll}
                className="rounded border border-[var(--jao-border)] px-2 py-0.5 text-[10px] text-[var(--jao-text-secondary)] hover:bg-[var(--jao-border-subtle)] transition-colors"
              >
                ➖ Collapse All
              </button>
            </div>
          </div>
          <p className="mb-5 truncate text-sm text-[var(--jao-text-secondary)]">{data.url}</p>
          {(() => {
            const showMulti = multi && data.viewports && data.viewports.length >= 2
            const desktopVp = showMulti ? data.viewports!.find(v => v.viewport.width >= 1280) ?? data.viewports![0] : null
            const mobileVp = showMulti ? data.viewports!.find(v => v.viewport.width <= 767) ?? data.viewports![1] : null
            const gridCols = showMulti ? 'md:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
            return (
              <div className={`grid grid-cols-1 gap-6 ${gridCols}`}>
                {showMulti ? (
                  <>
                    <div>
                      <h3 className="mb-3 flex items-center gap-1 text-sm font-semibold text-[var(--jao-text)]">
                        Desktop
                        <span className="inline-flex cursor-help items-center rounded-full border border-[var(--jao-border)] px-1.5 py-0.5 text-[9px] text-[var(--jao-text-tertiary)]" title="Checks color contrast, missing alt text, form labels, skip navigation, and WCAG 2.2 AA requirements.">&#9432;</span>
                      </h3>
                      <ScoreCard score={desktopVp!.wcag.score} size={36} title="Desktop WCAG score" subtitle={`${desktopVp!.viewport.width}\u00d7${desktopVp!.viewport.height} viewport`} />
                    </div>
                    <div>
                      <h3 className="mb-3 flex items-center gap-1 text-sm font-semibold text-[var(--jao-text)]">
                        Mobile
                        <span className="inline-flex cursor-help items-center rounded-full border border-[var(--jao-border)] px-1.5 py-0.5 text-[9px] text-[var(--jao-text-tertiary)]" title="Checks color contrast, missing alt text, form labels, skip navigation, and WCAG 2.2 AA requirements.">&#9432;</span>
                      </h3>
                      <ScoreCard score={mobileVp!.wcag.score} size={36} title="Mobile WCAG score" subtitle={`${mobileVp!.viewport.width}\u00d7${mobileVp!.viewport.height} viewport`} />
                    </div>
                  </>
                ) : wcag && (
                  <div>
                    <h3 className="mb-3 flex items-center gap-1 text-sm font-semibold text-[var(--jao-text)]">
                      Accessibility
                      <span className="inline-flex cursor-help items-center rounded-full border border-[var(--jao-border)] px-1.5 py-0.5 text-[9px] text-[var(--jao-text-tertiary)]" title="Checks color contrast, missing alt text, form labels, skip navigation, and WCAG 2.2 AA requirements.">&#9432;</span>
                    </h3>
                    <ScoreCard score={wcag.score} size={36} title="Accessibility score" subtitle="" />
                  </div>
                )}
                {design && (
                  <div>
                    <h3 className="mb-3 flex items-center gap-1 text-sm font-semibold text-[var(--jao-text)]">
                      Design Quality
                      <span className="inline-flex cursor-help items-center rounded-full border border-[var(--jao-border)] px-1.5 py-0.5 text-[9px] text-[var(--jao-text-tertiary)]" title="Checks font size (≥16px), line height (1.4–1.6), heading hierarchy, and horizontal scroll.">&#9432;</span>
                    </h3>
                    <ScoreCard score={design.score} size={36} title="Design QA score" subtitle={showMulti ? 'Both viewports' : ''} />
                  </div>
                )}
                {seo && (
                  <div>
                    <h3 className="mb-3 flex items-center gap-1 text-sm font-semibold text-[var(--jao-text)]">
                      SEO
                      <span className="inline-flex cursor-help items-center rounded-full border border-[var(--jao-border)] px-1.5 py-0.5 text-[9px] text-[var(--jao-text-tertiary)]" title="Checks title, meta description, canonical, viewport, Open Graph, and Twitter Card tags.">&#9432;</span>
                    </h3>
                    <ScoreCard score={seo.score} size={36} title="SEO score" subtitle="" />
                  </div>
                )}
                {security && (
                  <div>
                    <h3 className="mb-3 flex items-center gap-1 text-sm font-semibold text-[var(--jao-text)]">
                      Security
                      <span className="inline-flex cursor-help items-center rounded-full border border-[var(--jao-border)] px-1.5 py-0.5 text-[9px] text-[var(--jao-text-tertiary)]" title="Checks HSTS, CSP, X-Frame-Options, mixed content, secure cookies, and more.">&#9432;</span>
                    </h3>
                    <ScoreCard score={security.score} size={36} title="Security score" subtitle="" />
                  </div>
                )}
                {legal && (
                  <div>
                    <h3 className="mb-3 flex items-center gap-1 text-sm font-semibold text-[var(--jao-text)]">
                      Legal &amp; Privacy
                      <span className="inline-flex cursor-help items-center rounded-full border border-[var(--jao-border)] px-1.5 py-0.5 text-[9px] text-[var(--jao-text-tertiary)]" title="Checks cookie consent, privacy policy, imprint, terms of service, and data collection notice.">&#9432;</span>
                    </h3>
                    <ScoreCard score={legal.score} size={36} title="Legal & Privacy score" subtitle="" />
                  </div>
                )}
                {performance && (
                  <div>
                    <h3 className="mb-3 flex items-center gap-1 text-sm font-semibold text-[var(--jao-text)]">
                      Performance
                      <span className="inline-flex cursor-help items-center rounded-full border border-[var(--jao-border)] px-1.5 py-0.5 text-[9px] text-[var(--jao-text-tertiary)]" title="Lighthouse performance score based on LCP, FCP, TBT, CLS, and Speed Index.">&#9432;</span>
                    </h3>
                    <ScoreCard score={performance.score ?? 0} size={36} title="Performance score" subtitle={performance.grade ? `Grade ${performance.grade}` : ''} />
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {wcag && (() => {
        const wcagFailures = wcag.failures.map(f => ({
          ...f,
          severity: f.contrastRatio < 3 ? 'high' as const : f.contrastRatio < 4.5 ? 'medium' as const : 'low' as const
        }))
        return (
          <PillarFailures
            failures={wcagFailures}
            title="Accessibility"
            accentColor="text-[var(--jao-destructive)]"
            renderContent={renderWcagFailure}
            emptyState={
              <div className="p-8 text-center text-sm text-[var(--jao-success)]" role="status">
                <CheckCircle size={32} className="mx-auto mb-2" />
                All elements pass contrast requirements
              </div>
            }
          />
        )
      })()}

      {design && (
        <PillarFailures
          failures={design.failures}
          title="Design QA"
          accentColor="text-[var(--jao-accent)]"
          renderContent={renderDesignFailure}
          emptyState={wcag ? (
            <div className="border-t border-[var(--jao-border)] p-4 text-center text-xs text-[var(--jao-success)]">
              Design QA: all typography checks pass
            </div>
          ) : undefined}
        />
      )}

      <PillarFailures
        failures={seo?.failures || []}
        title="SEO"
        accentColor="text-blue-600 dark:text-blue-400"
        renderContent={renderSeoFailure}
      />

      <PillarFailures
        failures={security?.failures || []}
        title="Security"
        accentColor="text-red-600 dark:text-red-400"
        renderContent={renderSecurityFailure}
      />

      <PillarFailures
        failures={legal?.failures || []}
        title="Legal &amp; Privacy"
        accentColor="text-purple-600 dark:text-purple-400"
        renderContent={renderLegalFailure}
      />

      {performance && <PerformanceSection perf={performance} />}

      {data.recommendations && data.recommendations.length > 0 && (
        <div className="border-t border-[var(--jao-border)] p-6">
          <details open>
            <summary className="mb-3 cursor-pointer text-sm font-medium text-[var(--jao-text)] focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/30 rounded transition-colors">
              Fix Suggestions ({data.recommendations.length})
            </summary>
            <div className="space-y-2" role="list" aria-label="Deterministic fix suggestions">
              {data.recommendations.map((r: FixSuggestion, i: number) => (
                <div key={i} className="rounded-lg border border-[var(--jao-border)] border-l-[3px] border-l-[var(--jao-primary)] bg-[var(--jao-surface)] p-3 text-xs shadow-sm transition-shadow hover:shadow-md" role="listitem">
                  <div className="mb-1 flex items-center gap-2">
                    <SeverityBadge severity={r.severity} />
                    <span className="font-mono text-[10px] text-[var(--jao-text-secondary)]">{r.selector}</span>
                  </div>
                  <p className="text-[var(--jao-text)]">{r.recommendation}</p>
                  {(r.currentValue || r.suggestedValue) && (
                    <div className="mt-1 flex gap-3 text-[10px] text-[var(--jao-text-tertiary)]">
                      {r.currentValue && <span>{r.currentValue}</span>}
                      {r.suggestedValue && <span>&rarr; {r.suggestedValue}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      <details className="group mt-8 rounded-lg border border-[var(--jao-border-subtle)] p-4">
        <summary className="cursor-pointer text-sm font-medium text-[var(--jao-text-secondary)] transition-colors hover:text-[var(--jao-text)]">
          Known limitations
        </summary>
        <div className="mt-3 space-y-2 text-sm text-[var(--jao-text-tertiary)]">
          <p>
            CSS variable opacity and color-mix() may report false positives on decorative
            badges and tags. Content text contrast is always accurate.
          </p>
          <p>
            SVG text elements and Shadow DOM content are not checked.
          </p>
          <p>
            Heavy pages may time out on the web version (the CLI handles those fine).
          </p>
          <p>
            This tool does not test screen reader compatibility, interactive widgets,
            or PDFs.
          </p>
        </div>
      </details>
    </section>
  )
}
