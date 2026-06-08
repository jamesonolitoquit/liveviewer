import type { AuditData, DesignFailure, FixSuggestion } from '@/types/audit'
import { SmartFixButton } from './smart-fix-button'

interface AuditResultsProps {
  data: AuditData
}

function scoreColor(score: number): string {
  if (score >= 90) return 'text-[var(--jao-success)]'
  if (score >= 70) return 'text-[var(--jao-warning)]'
  return 'text-[var(--jao-destructive)]'
}

function ScoreGauge({ score, size = 64, textSize = 'text-lg', strokeColor }: { score: number; size?: number; textSize?: string; strokeColor?: string }) {
  const color = strokeColor || (score >= 90 ? 'var(--jao-success)' : score >= 70 ? 'var(--jao-warning)' : 'var(--jao-destructive)')
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox="0 0 36 36" className="-rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--jao-border)" strokeWidth="3" />
        <circle
          cx="18" cy="18" r="15.5"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={`${score * 0.97} ${100 - score * 0.97}`}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <span className={`absolute font-bold ${textSize} ${strokeColor ? 'text-[var(--jao-accent)]' : scoreColor(score)}`}>
        {score}
      </span>
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
  if (vp.width === 1280) return 'bg-blue-900/30 text-blue-300'
  if (vp.width === 375) return 'bg-emerald-900/30 text-emerald-300'
  if (vp.width === 768) return 'bg-purple-900/30 text-purple-300'
  return 'bg-[var(--jao-border)] text-[var(--jao-text-secondary)]'
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    high: 'bg-red-900/30 text-red-300',
    medium: 'bg-yellow-900/30 text-yellow-300',
    low: 'bg-green-900/30 text-green-300'
  }
  return (
    <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase ${colors[severity] || colors.low}`}>
      {severity}
    </span>
  )
}

export function AuditResults({ data }: AuditResultsProps) {
  const wcag = data.wcag
  const design = data.design
  const multi = data.multiViewport && data.viewports && data.viewports.length >= 2

  if (!wcag && !design) {
    return (
      <div className="card p-4 text-sm text-[var(--jao-text-secondary)]" role="status">
        No audit data. Run with WCAG analysis enabled.
      </div>
    )
  }

  return (
    <section className="card" aria-label="Audit results">
      {(wcag || design) && (
        <div className="border-b border-[var(--jao-border)] p-5">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h2 className="font-semibold">Audit Results</h2>
              <p className="mt-0.5 truncate text-xs text-[var(--jao-text-secondary)]">{data.url}</p>
            </div>
            <div className="ml-4 flex-shrink-0 text-right">
              {multi ? (
                <div className="flex items-center gap-2">
                  {data.viewports!.map((vr, i) => (
                    <div key={i} className="text-center">
                      <ScoreGauge score={vr.wcag.score} size={44} textSize="text-sm" />
                      <span className="mt-0.5 block text-[9px] text-[var(--jao-text-tertiary)]">
                        {vpLabel(vr.viewport)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    {wcag && <ScoreGauge score={wcag.score} size={48} textSize="text-sm" />}
                    {wcag && <span className="mt-0.5 block text-[9px] text-[var(--jao-text-tertiary)]">A11y</span>}
                  </div>
                  {design && (
                    <div className="text-center" title="Checks font size, line height, heading hierarchy, horizontal scroll">
                      <ScoreGauge score={design.score} size={48} textSize="text-sm" strokeColor="var(--jao-accent)" />
                      <span className="mt-0.5 block text-[9px] text-[var(--jao-text-tertiary)]">Design</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
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
          const activeGroups = severities.filter(s => groups[s].length > 0)
          return (
            <div className="p-5">
              <div className="mb-3 flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-medium text-[var(--jao-destructive)]">
                  {wcag.failCount} failure{wcag.failCount !== 1 ? 's' : ''}
                </h3>
                {activeGroups.map(s => (
                  <span key={s} className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                    s === 'high' ? 'bg-red-900/30 text-red-300' :
                    s === 'medium' ? 'bg-yellow-900/30 text-yellow-300' :
                    'bg-green-900/30 text-green-300'
                  }`}>{s}: {groups[s].length}</span>
                ))}
              </div>
              <div className="space-y-3" role="list" aria-label="WCAG failure details">
                {activeGroups.map(s => {
                  const content = (
                    <div className="space-y-2">
                      {groups[s].map((f, i) => (
                        <div key={i} className="failure-card bg-[var(--jao-bg)] sm:p-3 p-2.5 pr-4 text-xs" role="listitem">
                          <div className="mb-1 flex items-center gap-2">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              f.contrastRatio < 3 ? 'bg-red-900/30 text-red-300' :
                              f.contrastRatio < 4.5 ? 'bg-yellow-900/30 text-yellow-300' :
                              'bg-green-900/30 text-green-300'
                            }`}>
                              {f.contrastRatio}:1
                            </span>
                            <span className="text-[var(--jao-text-tertiary)]">
                              needs {f.required}:1
                            </span>
                            {multi && (f as any).viewports && (f as any).viewports.length > 0 && (
                              <span className="ml-auto flex gap-1">
                                {(f as any).viewports.map((vp: any, vi: number) => (
                                  <span key={vi} className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium ${vpBadge(vp)}`}>{vpLabel(vp)}</span>
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
                          <div className="mt-1.5"><SmartFixButton failure={f} /></div>
                        </div>
                      ))}
                    </div>
                  )
                  const label = s.charAt(0).toUpperCase() + s.slice(1)
                  return (
                    <details key={s} className="group" {...(s !== 'low' ? { open: true } : {})}>
                      <summary className="cursor-pointer text-sm font-medium text-[var(--jao-text-secondary)] hover:text-[var(--jao-text)] focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/30 rounded px-1 py-0.5">
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
            <div className="border-t border-[var(--jao-border)] p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-medium text-[var(--jao-accent)]">
                    Design QA — {design.failCount} issue{design.failCount !== 1 ? 's' : ''}
                  </h3>
                  {activeGroups.map(s => (
                    <span key={s} className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                      s === 'high' ? 'bg-red-900/30 text-red-300' :
                      s === 'medium' ? 'bg-yellow-900/30 text-yellow-300' :
                      'bg-green-900/30 text-green-300'
                    }`}>{s}: {groups[s].length}</span>
                  ))}
                </div>
                <ScoreGauge score={design.score} size={36} textSize="text-xs" />
              </div>
              <div className="space-y-3" role="list" aria-label="Design QA failure details">
                {activeGroups.map(s => {
                  const content = (
                    <div className="space-y-2">
                      {groups[s].map((f: DesignFailure, i: number) => (
                        <div key={i} className="rounded-lg border-l-2 border-[var(--jao-accent)] bg-[var(--jao-bg)] sm:p-3 p-2.5 text-xs" role="listitem">
                          <div className="mb-1 flex items-center gap-2">
                            <SeverityBadge severity={f.severity} />
                            <span className="text-[var(--jao-text-secondary)]">{f.ruleName}</span>
                          </div>
                          <code className="block break-all text-[10px] text-[var(--jao-text-secondary)]">{f.selector}</code>
                          <p className="mt-0.5 text-[var(--jao-text-tertiary)]">{f.description}</p>
                          <div className="mt-1 flex gap-3 text-[10px] text-[var(--jao-text-tertiary)]">
                            <span>found: {f.value}</span>
                            <span>expected: {f.expected}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                  const label = s.charAt(0).toUpperCase() + s.slice(1)
                  return (
                    <details key={s} className="group" {...(s !== 'low' ? { open: true } : {})}>
                      <summary className="cursor-pointer text-sm font-medium text-[var(--jao-text-secondary)] hover:text-[var(--jao-text)] focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/30 rounded px-1 py-0.5">
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
        <div className="border-t border-[var(--jao-border)] p-5">
          <details open>
            <summary className="mb-3 cursor-pointer text-sm font-medium text-[var(--jao-text)] focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/30 rounded">
              Fix Suggestions ({data.recommendations.length})
            </summary>
            <div className="space-y-2" role="list" aria-label="Deterministic fix suggestions">
              {data.recommendations.map((r: FixSuggestion, i: number) => (
                <div key={i} className="rounded-lg border-l-2 border-[var(--jao-primary)] bg-[var(--jao-bg)] sm:p-3 p-2.5 text-xs" role="listitem">
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
