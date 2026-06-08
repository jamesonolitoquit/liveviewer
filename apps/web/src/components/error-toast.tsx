'use client'

import { useEffect, useState } from 'react'

interface ErrorToastProps {
  message: string
  onDismiss: () => void
  duration?: number
}

export function ErrorToast({ message, onDismiss, duration = 5000 }: ErrorToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 300)
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, onDismiss])

  return (
    <div
      id="audit-error"
      role="alert"
      className={`fixed top-4 right-4 z-50 max-w-sm transition-all duration-300 ease-out ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
      }`}
    >
      <div className="flex items-start gap-3 rounded-xl border border-[var(--jao-destructive)]/30 bg-[var(--jao-destructive)]/10 p-4 shadow-lg backdrop-blur-sm">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 flex-shrink-0 text-[var(--jao-destructive)]" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p className="flex-1 text-sm text-[var(--jao-destructive)]">{message}</p>
        <button
          onClick={() => { setVisible(false); setTimeout(onDismiss, 300) }}
          className="flex-shrink-0 rounded-full p-0.5 text-[var(--jao-text-tertiary)] transition-colors hover:text-[var(--jao-text)] focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/30"
          aria-label="Dismiss error"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
