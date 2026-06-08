import type { AuditData, DesignFailure, FixSuggestion } from '@/types/audit'
import { SmartFixButton } from './smart-fix-button'

interface AuditResultsProps {
  data: AuditData
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

function FailureCard({ children, severity }: { children: React.ReactNode; severity: 'high' | 'medium' | 'low' }) {
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

export function AuditResults({ data }: AuditResultsProps) {
  const wcag = data.wcag
  const design = data.design
  const multi = data.multiViewport && data.viewports && data.viewports.length >= 2

  if (!wcag && !design) {
    return (
      <div className="card p-6 text-sm text-[var(--jao-text-secondary)] text-center" role="status">
        No audit data. Run with WCAG analysis enabled.
      </div>
    )
  }

  return (
    <section className="card overflow-hidden" aria-label="Audit results">
      {(wcag || design) && (
        <div className="border-b border-[var(--jao-border)] p-6">
          <h2 className="mb-1 font-semibold text-lg">Audit Results</h2>
          <p className="mb-5 truncate text-sm text-[var(--jao-text-secondary)]">{data.url}</p>
          {(() => {
            const showMulti = multi && data.viewports && data.viewports.length >= 2
            const desktopVp = showMulti ? data.viewports!.find(v => v.viewport.width >= 1280) ?? data.viewports![0] : null
            const mobileVp = showMulti ? data.viewports!.find(v => v.viewport.width <= 767) ?? data.viewports![1] : null
            const gridCols = showMulti ? 'md:grid-cols-3' : 'md:grid-cols-2'
            return (
              <div className={`grid grid-cols-1 gap-6 ${gridCols}`}>
                {showMulti ? (
                  <>
                    <div>
                      <h3 className="mb-3 flex items-center gap-1 text-sm font-semibold text-[var(--jao-text)]">
                        Desktop
                        <span className="inline-flex cursor-help items-center rounded-full border border-[var(--jao-border)] px-1.5 py-0.5 text-[9px] text-[var(--jao-text-tertiary)]" title="Checks color contrast, missing alt text, form labels, skip navigation, and WCAG 2.2 AA requirements.">ⓘ</span>
                      </h3>
                      <ScoreCard score={desktopVp!.wcag.score} size={36} title="Desktop WCAG score" subtitle={`${desktopVp!.viewport.width}×${desktopVp!.viewport.height} viewport`} />
                    </div>
                    <div>
                      <h3 className="mb-3 flex items-center gap-1 text-sm font-semibold text-[var(--jao-text)]">
                        Mobile
                        <span className="inline-flex cursor-help items-center rounded-full border border-[var(--jao-border)] px-1.5 py-0.5 text-[9px] text-[var(--jao-text-tertiary)]" title="Checks color contrast, missing alt text, form labels, skip navigation, and WCAG 2.2 AA requirements.">ⓘ</span>
                      </h3>
                      <ScoreCard score={mobileVp!.wcag.score} size={36} title="Mobile WCAG score" subtitle={`${mobileVp!.viewport.width}×${mobileVp!.viewport.height} viewport`} />
                    </div>
                  </>
                ) : wcag && (
                  <div>
                    <h3 className="mb-3 flex items-center gap-1 text-sm font-semibold text-[var(--jao-text)]">
                      Accessibility
                      <span className="inline-flex cursor-help items-center rounded-full border border-[var(--jao-border)] px-1.5 py-0.5 text-[9px] text-[var(--jao-text-tertiary)]" title="Checks color contrast, missing alt text, form labels, skip navigation, and WCAG 2.2 AA requirements.">ⓘ</span>
                    </h3>
                    <ScoreCard score={wcag.score} size={36} title="Accessibility score" subtitle="" />
                  </div>
                )}
                {design && (
                  <div>
                    <h3 className="mb-3 flex items-center gap-1 text-sm font-semibold text-[var(--jao-text)]">
                      Design Quality
                      <span className="inline-flex cursor-help items-center rounded-full border border-[var(--jao-border)] px-1.5 py-0.5 text-[9px] text-[var(--jao-text-tertiary)]" title="Checks font size (≥16px), line height (1.4–1.6), heading hierarchy, and horizontal scroll.">ⓘ</span>
                    </h3>
                    <ScoreCard score={design.score} size={36} title="Design QA score" subtitle={showMulti ? 'Both viewports' : ''} />
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {wcag && wcag.failures.length > 0 &&
        (() => {
          const severities = ['high', 'medium', 'low'] as const
          const groups: Record<string, typeof wcag.failures> = { high: [], medium: [], low: [] }
          for (const f of wcag.failures) {
            const s = f.contrastRatio < 3 ? 'high' : f.contrastRatio < 4.5 ? 'medium' : 'low'
            groups[s].push(f)
          }
          const highCount = groups['high']?.length || 0
          const medCount = groups['medium']?.length || 0
          const lowCount = groups['low']?.length || 0
          const activeGroups = severities.filter(s => groups[s].length > 0)
          return (
            <div className="p-6">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                {highCount > 0 && <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-[var(--jao-destructive)]" /> {highCount} critical</span>}
                {medCount > 0 && <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-[var(--jao-warning)]" /> {medCount} improvements</span>}
                {lowCount > 0 && <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-[var(--jao-success)]" /> {lowCount} minor</span>}
                {wcag.failures.length === 0 && <span className="text-[var(--jao-success)]">✅ No contrast failures</span>}
              </div>
              <div className="mb-4 flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-medium text-[var(--jao-destructive)]">
                  {wcag.failCount} failure{wcag.failCount !== 1 ? 's' : ''}
                </h3>
                {activeGroups.map(s => (
                  <span key={s} className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium uppercase ${
                    s === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                    s === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  }`}>{s}: {groups[s].length}</span>
                ))}
              </div>
              <div className="space-y-3" role="list" aria-label="WCAG failure details">
                {activeGroups.map(s => {
                  const content = (
                    <div className="space-y-2">
                      {groups[s].map((f, i) => (
                        <FailureCard key={i} severity={s as 'high' | 'medium' | 'low'}>
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
                            {multi && (f as any).viewports && (f as any).viewports.length > 0 && (
                              <span className="ml-auto w-full sm:w-auto flex gap-1 mt-1 sm:mt-0 sm:self-center self-start">
                                {(f as any).viewports.map((vp: any, vi: number) => (
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
        })()}

      {wcag && wcag.failures.length === 0 && (
        <div className="p-8 text-center text-sm text-[var(--jao-success)]" role="status">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto mb-2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          All elements pass contrast requirements
        </div>
      )}

      {design && design.failures.length > 0 &&
        (() => {
          const severities = ['high', 'medium', 'low'] as const
          const groups: Record<string, DesignFailure[]> = { high: [], medium: [], low: [] }
          for (const f of design.failures) groups[f.severity]?.push(f)
          const activeGroups = severities.filter(s => groups[s].length > 0)
          return (
            <div className="border-t border-[var(--jao-border)] p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-medium text-[var(--jao-accent)]">
                    Design QA — {design.failCount} issue{design.failCount !== 1 ? 's' : ''}
                  </h3>
                  {activeGroups.map(s => (
                    <span key={s} className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium uppercase ${
                      s === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                      s === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    }`}>{s}: {groups[s].length}</span>
                  ))}
                </div>
                <span className={`text-sm font-bold ${scoreStyles(design.score).text}`}>{design.score}%</span>
              </div>
              <div className="space-y-3" role="list" aria-label="Design QA failure details">
                {activeGroups.map(s => {
                  const content = (
                    <div className="space-y-2">
                      {groups[s].map((f: DesignFailure, i: number) => (
                        <FailureCard key={i} severity={f.severity as 'high' | 'medium' | 'low'}>
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
        })()}

      {design && design.failures.length === 0 && wcag && (
        <div className="border-t border-[var(--jao-border)] p-4 text-center text-xs text-[var(--jao-success)]">
          Design QA: all typography checks pass
        </div>
      )}

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
    </section>
  )
}
