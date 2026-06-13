'use client'

import { useState, useEffect } from 'react'

const defaultPillars = ['WCAG', 'Design', 'SEO', 'Security', 'Legal', 'Performance']

const pillarLabels: Record<string, string> = {
  navigating: 'Navigating',
  wcag: 'WCAG',
  design: 'Design',
  mobile: 'Mobile',
  seo: 'SEO',
  security: 'Security',
  legal: 'Legal',
  ai: 'AI Detection',
  performance: 'Performance'
}

const pillarOrder = ['navigating', 'wcag', 'design', 'mobile', 'seo', 'security', 'legal', 'ai', 'performance']

export function LoadingSkeleton({ pillars, currentPillar }: { pillars?: string[]; currentPillar?: string | null }) {
  const active = pillars || defaultPillars
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (currentPillar) return
    const t = setInterval(() => setIndex(i => (i + 1) % active.length), 1000)
    return () => clearInterval(t)
  }, [active.length, currentPillar])

  const label = currentPillar
    ? (pillarLabels[currentPillar] || currentPillar)
    : active[index]

  const currentIdx = currentPillar
    ? Math.max(0, pillarOrder.indexOf(currentPillar))
    : index

  return (
    <div className="card mt-6 p-8" role="status" aria-label="Auditing in progress">
      <div className="flex flex-col items-center gap-5">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 rounded-full border-[3px] border-[var(--jao-border)]" />
          <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[var(--jao-primary)] animate-spin" />
        </div>
        <div className="text-center">
          <p className="text-sm text-[var(--jao-text-secondary)] transition-opacity duration-300" key={currentPillar || index}>
            {label} audit&hellip;
          </p>
          <p className="mt-1 text-xs text-[var(--jao-text-tertiary)]">
            Pillar {currentIdx + 1} of {(currentPillar ? pillarOrder.length : active.length)}
          </p>
        </div>
      </div>
    </div>
  )
}
