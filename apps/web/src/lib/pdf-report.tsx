import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

Font.register({
  family: 'system-ui',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiJ-Ek-_EeA.woff2', fontWeight: 700 }
  ]
})

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

interface AuditData {
  url: string
  timestamp: number
  viewport: { width: number; height: number }
  wcag: WcagData | null
  design?: DesignData | null
  recommendations?: FixSuggestion[]
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'system-ui',
    fontSize: 10,
    color: '#171717'
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#d4d4d4',
    paddingBottom: 16
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 4
  },
  subtitle: {
    fontSize: 10,
    color: '#525252',
    marginBottom: 2
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 4
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: 700
  },
  scoreLabel: {
    fontSize: 10,
    color: '#525252'
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 8,
    marginTop: 16
  },
  table: {
    marginTop: 8
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#d4d4d4',
    paddingBottom: 6,
    marginBottom: 6,
    fontSize: 8,
    fontWeight: 700,
    color: '#525252',
    textTransform: 'uppercase'
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    fontSize: 8
  },
  colSelector: { width: '25%', paddingRight: 4 },
  colText: { width: '25%', paddingRight: 4 },
  colColors: { width: '15%', paddingRight: 4 },
  colRatio: { width: '10%', paddingRight: 4 },
  colRequired: { width: '10%', paddingRight: 4 },
  colSize: { width: '15%' },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#a3a3a3',
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    paddingTop: 8
  }
})

function scoreColor(score: number): string {
  if (score >= 90) return '#15803d'
  if (score >= 70) return '#b45309'
  return '#dc2626'
}

export function AuditPdfDocument({ data }: { data: AuditData }) {
  const wcag = data.wcag
  const date = new Date(data.timestamp)

  const design = data.design

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Accessibility & Design Audit Report</Text>
          <Text style={styles.subtitle}>URL: {data.url}</Text>
          <Text style={styles.subtitle}>Date: {date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
          <Text style={styles.subtitle}>Viewport: {data.viewport.width}x{data.viewport.height}</Text>
        </View>

        {wcag && (
          <>
            <View style={styles.scoreRow}>
              <View>
                <Text style={styles.scoreLabel}>WCAG Contrast Score</Text>
                <Text style={styles.scoreLabel}>{wcag.totalElements} elements analyzed</Text>
              </View>
              <Text style={[styles.scoreValue, { color: scoreColor(wcag.score) }]}>{wcag.score}%</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <View style={{ flex: 1, padding: 8, backgroundColor: '#f0fdf4', borderRadius: 4 }}>
                <Text style={{ fontSize: 8, color: '#525252' }}>Passing</Text>
                <Text style={{ fontSize: 16, fontWeight: 700, color: '#15803d' }}>{wcag.passCount}</Text>
              </View>
              <View style={{ flex: 1, padding: 8, backgroundColor: '#fef2f2', borderRadius: 4 }}>
                <Text style={{ fontSize: 8, color: '#525252' }}>Failing</Text>
                <Text style={{ fontSize: 16, fontWeight: 700, color: '#dc2626' }}>{wcag.failCount}</Text>
              </View>
            </View>

            {wcag.failures.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Violations ({wcag.failures.length})</Text>
                <View style={styles.table}>
                  <View style={styles.tableHeader}>
                    <Text style={styles.colSelector}>Selector</Text>
                    <Text style={styles.colText}>Text</Text>
                    <Text style={styles.colColors}>Colors</Text>
                    <Text style={styles.colRatio}>Ratio</Text>
                    <Text style={styles.colRequired}>Required</Text>
                    <Text style={styles.colSize}>Font Size</Text>
                  </View>
                  {wcag.failures.map((f, i) => (
                    <View key={i} style={styles.tableRow}>
                      <Text style={styles.colSelector}>{f.selector}</Text>
                      <Text style={styles.colText}>{f.text}</Text>
                      <Text style={styles.colColors}>{f.foreground}/{f.background}</Text>
                      <Text style={[styles.colRatio, { color: f.contrastRatio < 3 ? '#dc2626' : '#b45309' }]}>{f.contrastRatio}:1</Text>
                      <Text style={styles.colRequired}>{f.required}:1</Text>
                      <Text style={styles.colSize}>{f.fontSize}px{f.isLarge ? ' (large)' : ''}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {wcag.failures.length === 0 && (
              <Text style={{ color: '#15803d', marginTop: 16 }}>All elements pass WCAG AA contrast requirements.</Text>
            )}
          </>
        )}

        {!wcag && (
          <Text style={{ color: '#525252', marginTop: 16 }}>No WCAG data available.</Text>
        )}

        {design && (
          <>
            <Text style={styles.sectionTitle}>Design QA (score: {design.score}%)</Text>
            <View style={styles.scoreRow}>
              <View>
                <Text style={styles.scoreLabel}>Design Score</Text>
                <Text style={styles.scoreLabel}>{design.totalChecks} checks</Text>
              </View>
              <Text style={[styles.scoreValue, { color: scoreColor(design.score) }]}>{design.score}%</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <View style={{ flex: 1, padding: 8, backgroundColor: '#f0fdf4', borderRadius: 4 }}>
                <Text style={{ fontSize: 8, color: '#525252' }}>Passing</Text>
                <Text style={{ fontSize: 16, fontWeight: 700, color: '#15803d' }}>{design.passCount}</Text>
              </View>
              <View style={{ flex: 1, padding: 8, backgroundColor: '#fef2f2', borderRadius: 4 }}>
                <Text style={{ fontSize: 8, color: '#525252' }}>Failing</Text>
                <Text style={{ fontSize: 16, fontWeight: 700, color: '#dc2626' }}>{design.failCount}</Text>
              </View>
            </View>
            {design.failures.length > 0 && (
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={styles.colSelector}>Rule</Text>
                  <Text style={styles.colText}>Selector</Text>
                  <Text style={styles.colColors}>Severity</Text>
                  <Text style={styles.colRatio}>Found</Text>
                  <Text style={styles.colRequired}>Expected</Text>
                </View>
                {design.failures.map((f, i) => (
                  <View key={i} style={styles.tableRow}>
                    <Text style={styles.colSelector}>{f.ruleName}</Text>
                    <Text style={styles.colText}>{f.selector}</Text>
                    <Text style={[styles.colColors, { color: f.severity === 'high' ? '#dc2626' : '#b45309' }]}>{f.severity}</Text>
                    <Text style={styles.colRatio}>{f.value}</Text>
                    <Text style={styles.colRequired}>{f.expected}</Text>
                  </View>
                ))}
              </View>
            )}
            {design.failures.length === 0 && (
              <Text style={{ color: '#15803d', marginTop: 8 }}>All design checks pass.</Text>
            )}
          </>
        )}

        {data.recommendations && data.recommendations.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Fix Suggestions ({data.recommendations.length})</Text>
            {data.recommendations.map((r, i) => (
              <View key={i} style={{ paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' }}>
                <Text style={{ fontSize: 8, fontWeight: 700 }}>{r.selector}</Text>
                <Text style={{ fontSize: 8, color: '#525252', marginTop: 2 }}>{r.recommendation}</Text>
                {(r.currentValue || r.suggestedValue) && (
                  <Text style={{ fontSize: 7, color: '#a3a3a3', marginTop: 1 }}>
                    {r.currentValue}{r.suggestedValue ? ` → ${r.suggestedValue}` : ''}
                  </Text>
                )}
              </View>
            ))}
          </>
        )}

        <Text style={styles.footer}>
          Generated by Liveviewer — {date.toLocaleDateString('en-US')}
        </Text>
      </Page>
    </Document>
  )
}
