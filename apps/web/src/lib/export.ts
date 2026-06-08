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
  viewports?: { width: number; height: number }[]
}

interface WcagData {
  totalElements: number
  failures: WcagFailure[]
  passCount: number
  failCount: number
  score: number
}

interface DesignFailure {
  ruleId: string
  ruleName: string
  category: string
  selector: string
  description: string
  severity: string
  value: string
  expected: string
}

interface DesignData {
  failures: DesignFailure[]
  totalChecks: number
  passCount: number
  failCount: number
  score: number
}

interface FixSuggestion {
  type: string
  severity: string
  selector: string
  text?: string
  currentValue?: string
  suggestedValue?: string
  recommendation: string
}

interface ViewportResult {
  viewport: { width: number; height: number }
  wcag: WcagData
}

interface AuditData {
  url: string
  timestamp: number
  viewport: { width: number; height: number }
  viewports?: ViewportResult[]
  multiViewport?: boolean
  wcag: WcagData | null
  design?: DesignData | null
  recommendations?: FixSuggestion[]
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

  // WCAG failures
  rows.push([
    'Type', 'Selector', 'Text', 'Foreground', 'Background',
    'Contrast Ratio', 'Required Ratio', 'Font Size (px)',
    'Large Text', 'Status'
  ].join(','))
  for (const f of data.wcag?.failures ?? []) {
    rows.push([
      'WCAG',
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
    rows.push(`WCAG Summary,Pass Count,Fail Count,Total Elements,Score`)
    rows.push(`WCAG-SUMMARY,${data.wcag.passCount},${data.wcag.failCount},${data.wcag.totalElements},${data.wcag.score}%`)
  }

  // Design failures
  if (data.design && data.design.failures.length > 0) {
    rows.push('')
    rows.push('Type,Rule,Selector,Severity,Value,Expected,Description')
    for (const f of data.design.failures) {
      rows.push([
        'DESIGN',
        escapeCsv(f.ruleName),
        escapeCsv(f.selector),
        f.severity,
        escapeCsv(f.value),
        escapeCsv(f.expected),
        escapeCsv(f.description)
      ].join(','))
    }
    rows.push('')
    rows.push(`Design Summary,Score,Fail Count`)
    rows.push(`DESIGN-SUMMARY,${data.design.score}%,${data.design.failCount}`)
  }

  // Fix suggestions
  if (data.recommendations && data.recommendations.length > 0) {
    rows.push('')
    rows.push('Type,Selector,Severity,Recommendation,Current,Suggested')
    for (const r of data.recommendations) {
      rows.push([
        'FIX',
        escapeCsv(r.selector),
        r.severity,
        escapeCsv(r.recommendation),
        escapeCsv(r.currentValue ?? ''),
        escapeCsv(r.suggestedValue ?? '')
      ].join(','))
    }
  }

  return rows.join('\n')
}

export function jsonFromAudit(data: AuditData): string {
  const obj: Record<string, any> = {
    url: data.url,
    timestamp: format(data.timestamp, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
    viewport: data.viewport,
  }

  if (data.multiViewport && data.viewports) {
    obj.viewports = data.viewports.map(vr => ({
      viewport: vr.viewport,
      wcag: vr.wcag
    }))
  }

  obj.wcag = data.wcag ? {
    totalElements: data.wcag.totalElements,
    passCount: data.wcag.passCount,
    failCount: data.wcag.failCount,
    score: data.wcag.score,
    failures: data.wcag.failures.map(f => ({
      selector: f.selector,
      text: f.text,
      foreground: f.foreground,
      background: f.background,
      contrastRatio: f.contrastRatio,
      requiredRatio: f.required,
      fontSizePx: f.fontSize,
      isLargeText: f.isLarge,
      viewports: f.viewports
    }))
  } : null

  if (data.design) {
    obj.design = {
      totalChecks: data.design.totalChecks,
      passCount: data.design.passCount,
      failCount: data.design.failCount,
      score: data.design.score,
      failures: data.design.failures.map(f => ({
        ruleId: f.ruleId,
        ruleName: f.ruleName,
        category: f.category,
        selector: f.selector,
        description: f.description,
        severity: f.severity,
        value: f.value,
        expected: f.expected
      }))
    }
  }

  if (data.recommendations && data.recommendations.length > 0) {
    obj.recommendations = data.recommendations.map(r => ({
      type: r.type,
      severity: r.severity,
      selector: r.selector,
      text: r.text,
      currentValue: r.currentValue,
      suggestedValue: r.suggestedValue,
      recommendation: r.recommendation
    }))
  }

  return JSON.stringify(obj, null, 2)
}

export function textFromAudit(data: AuditData): string {
  const lines: string[] = []
  const date = new Date(data.timestamp)

  lines.push('# Liveviewer Audit Report')
  lines.push(`URL: ${data.url}`)
  lines.push(`Timestamp: ${format(data.timestamp, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx")}`)

  if (data.multiViewport && data.viewports) {
    const labels = data.viewports.map(v => `${v.viewport.width}x${v.viewport.height}`)
    lines.push(`Viewports: ${labels.join(', ')}`)
  } else {
    lines.push(`Viewport: ${data.viewport.width}x${data.viewport.height}`)
  }

  lines.push('')

  // WCAG section
  if (data.wcag) {
    lines.push(`## WCAG Contrast (score: ${data.wcag.score}%)`)
    if (data.wcag.failures.length > 0) {
      lines.push(`### Failures (${data.wcag.failures.length})`)
      for (const f of data.wcag.failures) {
        const vp = f.viewports?.length
          ? ` [${f.viewports.map(v => `${v.width}x${v.height}`).join(',')}]`
          : ''
        lines.push(`- \`${f.selector}\`${vp} — "${f.text}" — ${f.foreground}/${f.background} — ${f.contrastRatio}:1 (needs ${f.required}:1) — ${f.fontSize}px`)
      }
    } else {
      lines.push('All elements pass contrast requirements.')
    }
    lines.push('')
  }

  // Design section
  if (data.design) {
    lines.push(`## Design QA (score: ${data.design.score}%)`)
    if (data.design.failures.length > 0) {
      lines.push(`### Issues (${data.design.failures.length})`)
      for (const f of data.design.failures) {
        lines.push(`- \`${f.selector}\` — ${f.ruleName} — ${f.severity} — found: ${f.value}, expected: ${f.expected} — ${f.description}`)
      }
    } else {
      lines.push('All design checks pass.')
    }
    lines.push('')
  }

  // Fix suggestions
  if (data.recommendations && data.recommendations.length > 0) {
    lines.push(`## Fix Suggestions (${data.recommendations.length})`)
    for (const r of data.recommendations) {
      const cur = r.currentValue ? ` (was: ${r.currentValue})` : ''
      const sug = r.suggestedValue ? ` → ${r.suggestedValue}` : ''
      lines.push(`- \`${r.selector}\` — ${r.severity} — ${r.recommendation}${cur}${sug}`)
    }
    lines.push('')
  }

  return lines.join('\n')
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
