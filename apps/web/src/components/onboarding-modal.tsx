'use client'

import { useState, useEffect, useCallback } from 'react'
import { JaoLogo } from './jao-logo'

const ONBOARDED_KEY = 'liveviewer_onboarded'

const STEPS = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
        <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
        <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
      </svg>
    ),
    title: 'Enter a URL',
    desc: 'Type any website URL and click "Run Audit". We\'ll check WCAG contrast and design quality.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    title: 'Review scores',
    desc: 'See which elements fail. Failures are grouped by severity — expand low-severity items to see details.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    title: 'Get detailed fixes (optional)',
    desc: 'Enable enhanced analysis for detailed fix suggestions.',
  },
]

export function OnboardingModal() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(ONBOARDED_KEY)) setShow(true)
    } catch {}
  }, [])

  const dismiss = useCallback(() => {
    setShow(false)
    try { localStorage.setItem(ONBOARDED_KEY, '1') } catch {}
  }, [])

  useEffect(() => {
    if (!show) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [show, dismiss])

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={dismiss}>
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--jao-border)] bg-[var(--jao-surface)] p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to Liveviewer"
      >
        <div className="mb-6 flex items-center gap-2.5">
          <JaoLogo size={28} className="text-[var(--jao-primary)]" />
          <span className="text-lg font-bold tracking-tight">Welcome to Liveviewer</span>
        </div>

        <div className="space-y-4">
          {STEPS.map((step, i) => (
            <div key={i} className="flex gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--jao-primary)]/10 text-[var(--jao-primary)]">
                {step.icon}
              </div>
              <div>
                <h3 className="text-sm font-semibold">{step.title}</h3>
                <p className="text-xs text-[var(--jao-text-secondary)]">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={dismiss}
            className="rounded-full border border-[var(--jao-border)] px-5 py-2 text-sm text-[var(--jao-text-secondary)] transition-colors hover:bg-[var(--jao-border-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/30"
          >
            Skip
          </button>
          <button
            onClick={dismiss}
            className="btn-gradient inline-flex rounded-full px-5 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/50"
          >
            Start auditing →
          </button>
        </div>
      </div>
    </div>
  )
}
