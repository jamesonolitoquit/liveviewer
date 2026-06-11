'use client'

import { useState } from 'react'
import { humanError } from '@/lib/errors'

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

interface PdfExportButtonProps {
  data: AuditData
  prefix: string
}

export function PdfExportButton({ data, prefix }: PdfExportButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePdf = async () => {
    setLoading(true)
    setError(null)
    try {
      const { pdf } = await import('@react-pdf/renderer')
      const { AuditPdfDocument } = await import('@/lib/pdf-report')
      const blob = await pdf(<AuditPdfDocument data={data} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${prefix}-audit.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError(humanError('export'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={handlePdf}
        disabled={loading}
        className="rounded-lg border border-[var(--jao-border)] px-3 py-1.5 text-xs text-[var(--jao-text-tertiary)] transition-colors hover:bg-[var(--jao-border-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/30 disabled:opacity-50"
      >
        {loading ? 'PDF...' : 'PDF'}
      </button>
      {error && (
        <span className="text-xs text-[var(--jao-destructive)]" role="alert">{error}</span>
      )}
    </>
  )
}
