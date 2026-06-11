import { Loader } from 'lucide-react'

export default function ReportLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-[var(--jao-text-secondary)]">
        <Loader size={18} className="animate-spin" />
        Loading report...
      </div>
    </div>
  )
}
