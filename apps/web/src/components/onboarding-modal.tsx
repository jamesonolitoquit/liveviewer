'use client'

import { useState, useEffect, useCallback } from 'react'
import { Wand2, CheckCircle, MessageSquare } from 'lucide-react'
import { JaoLogo } from './jao-logo'

const ONBOARDED_KEY = 'liveviewer_onboarded'

const STEPS = [
  {
    icon: <Wand2 size={24} aria-hidden="true" />,
    title: 'Enter a URL',
    desc: 'Type any website URL and click "Run Audit". We\'ll check WCAG contrast and design quality.',
  },
  {
    icon: <CheckCircle size={24} aria-hidden="true" />,
    title: 'Review scores',
    desc: 'See which elements fail. Failures are grouped by severity — expand low-severity items to see details.',
  },
  {
    icon: <MessageSquare size={24} aria-hidden="true" />,
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
