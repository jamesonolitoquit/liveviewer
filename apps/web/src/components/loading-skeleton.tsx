'use client'

export function LoadingSkeleton() {
  return (
    <div className="card mt-6 p-5 space-y-4 animate-pulse" role="status" aria-label="Loading audit results">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 w-24 bg-[var(--jao-border)] rounded" />
          <div className="h-3 w-48 bg-[var(--jao-border)] rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-10 rounded-full bg-[var(--jao-border)]" />
          <div className="h-10 w-10 rounded-full bg-[var(--jao-border)]" />
        </div>
      </div>
      <div className="h-px bg-[var(--jao-border)]" />
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-lg bg-[var(--jao-bg)] p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-4 w-12 bg-[var(--jao-border)] rounded-full" />
              <div className="h-3 w-36 bg-[var(--jao-border)] rounded" />
            </div>
            <div className="h-3 w-full bg-[var(--jao-border)] rounded" />
            <div className="h-3 w-4/5 bg-[var(--jao-border)] rounded" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 pt-2">
        <div className="h-3 w-16 bg-[var(--jao-border)] rounded" />
      </div>
    </div>
  )
}
