export default function HistoryLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 rounded bg-[var(--jao-border)]" />
        <div className="h-11 w-full rounded-lg bg-[var(--jao-border)]" />
        <div className="rounded-lg border border-[var(--jao-border)] p-4">
          <div className="mb-4 h-32 rounded bg-[var(--jao-border)]" />
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-[var(--jao-border)]" />
            <div className="h-4 w-3/4 rounded bg-[var(--jao-border)]" />
            <div className="h-4 w-1/2 rounded bg-[var(--jao-border)]" />
          </div>
        </div>
      </div>
    </div>
  )
}
