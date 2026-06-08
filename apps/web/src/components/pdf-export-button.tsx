'use client'

import { useState } from 'react'

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
      setError('Failed to generate PDF')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={handlePdf}
        disabled={loading}
        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 disabled:opacity-50"
      >
        {loading ? 'PDF...' : 'PDF'}
      </button>
      {error && (
        <span className="text-xs text-[var(--destructive)]" role="alert">{error}</span>
      )}
    </>
  )
}
