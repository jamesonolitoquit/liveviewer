interface WcagFailure {
  selector: string
  text: string
  foreground: string
  background: string
  contrastRatio: number
  required: number
  fontSize: number
  isLarge: boolean
}

interface WcagData {
  totalElements: number
  failures: WcagFailure[]
  passCount: number
  failCount: number
  score: number
}

interface AuditData {
  url: string
  timestamp: number
  viewport: { width: number; height: number }
  wcag: WcagData | null
}

interface AuditResultsProps {
  data: AuditData
}

function scoreColor(score: number): string {
  if (score >= 90) return 'text-green-600'
  if (score >= 70) return 'text-yellow-600'
  return 'text-red-600'
}

export function AuditResults({ data }: AuditResultsProps) {
  const wcag = data.wcag
  if (!wcag) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--muted-foreground)]">
        No WCAG data. Run with WCAG analysis enabled.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]">
      <div className="border-b border-[var(--border)] p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">WCAG Contrast Audit</h2>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)] break-all">{data.url}</p>
          </div>
          <div className="text-right">
            <span className={`text-2xl font-bold ${scoreColor(wcag.score)}`}>
              {wcag.score}%
            </span>
            <p className="text-xs text-[var(--muted-foreground)]">
              {wcag.passCount}/{wcag.totalElements} pass
            </p>
          </div>
        </div>
      </div>

      {wcag.failures.length > 0 && (
        <div className="p-4">
          <h3 className="mb-3 text-sm font-medium text-[var(--destructive)]">
            {wcag.failCount} failure{wcag.failCount !== 1 ? 's' : ''} found
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {wcag.failures.map((f, i) => (
              <div key={i} className="rounded border border-[var(--border)] p-3 text-xs">
                <div className="mb-1 flex items-center gap-2">
                  <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    f.contrastRatio < 3
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {f.contrastRatio}:1
                  </span>
                  <span className="text-[var(--muted-foreground)]">
                    needs {f.required}:1
                  </span>
                </div>
                <code className="block break-all text-[10px] text-[var(--muted-foreground)]">
                  {f.selector}
                </code>
                <p className="mt-0.5 truncate text-[var(--muted-foreground)]">
                  &ldquo;{f.text}&rdquo;
                </p>
                <div className="mt-1 flex gap-3 text-[10px] text-[var(--muted-foreground)]">
                  <span>fg: {f.foreground}</span>
                  <span>bg: {f.background}</span>
                  <span>{f.fontSize}px{f.isLarge ? ' (large)' : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {wcag.failures.length === 0 && (
        <div className="p-4 text-center text-sm text-green-600">
          All elements pass contrast requirements
        </div>
      )}
    </div>
  )
}
