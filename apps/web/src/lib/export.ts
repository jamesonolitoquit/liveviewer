import { format } from 'date-fns'

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

function escapeCsv(value: string | number): string {
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function csvFromAudit(data: AuditData): string {
  const rows: string[] = []
  rows.push([
    'Selector', 'Text', 'Foreground', 'Background',
    'Contrast Ratio', 'Required Ratio', 'Font Size (px)',
    'Large Text', 'Status'
  ].join(','))

  const failures = data.wcag?.failures ?? []
  for (const f of failures) {
    rows.push([
      escapeCsv(f.selector),
      escapeCsv(f.text),
      escapeCsv(f.foreground),
      escapeCsv(f.background),
      f.contrastRatio,
      f.required,
      f.fontSize,
      f.isLarge ? 'Yes' : 'No',
      'Fail'
    ].join(','))
  }

  if (data.wcag) {
    rows.push('')
    rows.push(`Pass Count,Poss Count,Total Elements,Score`)
    rows.push(`${data.wcag.passCount},${data.wcag.failCount},${data.wcag.totalElements},${data.wcag.score}%`)
  }

  return rows.join('\n')
}

export function jsonFromAudit(data: AuditData): string {
  return JSON.stringify({
    url: data.url,
    timestamp: format(data.timestamp, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
    viewport: data.viewport,
    summary: data.wcag ? {
      totalElements: data.wcag.totalElements,
      passCount: data.wcag.passCount,
      failCount: data.wcag.failCount,
      score: data.wcag.score
    } : null,
    failures: (data.wcag?.failures ?? []).map(f => ({
      selector: f.selector,
      text: f.text,
      foreground: f.foreground,
      background: f.background,
      contrastRatio: f.contrastRatio,
      requiredRatio: f.required,
      fontSizePx: f.fontSize,
      isLargeText: f.isLarge
    }))
  }, null, 2)
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
