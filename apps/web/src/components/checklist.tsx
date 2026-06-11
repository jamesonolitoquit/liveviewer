'use client'

import { useState, useEffect, useCallback } from 'react'
import checklistData from '@/data/checklist-2.2-aa.json'

interface ChecklistItem {
  id: string
  wcagRef: string
  description: string
  severity: string
}

interface ChecklistCategory {
  category: string
  items: ChecklistItem[]
}

type ItemStatus = 'pass' | 'fail' | 'na' | 'untested'

function getStorageKey(url: string): string {
  return `liveviewer-checklist-${url}`
}

function getDefaultItems(categories: ChecklistCategory[]): Record<string, ItemStatus> {
  const items: Record<string, ItemStatus> = {}
  for (const cat of categories) {
    for (const item of cat.items) {
      items[item.id] = 'untested'
    }
  }
  return items
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-red-100 text-red-700'
    case 'high': return 'bg-orange-100 text-orange-700'
    case 'medium': return 'bg-yellow-100 text-yellow-700'
    default: return 'bg-blue-100 text-blue-700'
  }
}

interface ChecklistProps {
  currentUrl: string
}

export function Checklist({ currentUrl }: ChecklistProps) {
  const categories = checklistData as ChecklistCategory[]
  const [statusMap, setStatusMap] = useState<Record<string, ItemStatus>>(() => {
    if (typeof window === 'undefined') return getDefaultItems(categories)
    const stored = localStorage.getItem(getStorageKey(currentUrl))
    if (stored) {
      try {
        return { ...getDefaultItems(categories), ...JSON.parse(stored) }
      } catch {
        return getDefaultItems(categories)
      }
    }
    return getDefaultItems(categories)
  })

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const key = getStorageKey(currentUrl)
    localStorage.setItem(key, JSON.stringify(statusMap))
  }, [statusMap, currentUrl])

  useEffect(() => {
    const stored = localStorage.getItem(getStorageKey(currentUrl))
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setStatusMap({ ...getDefaultItems(categories), ...parsed })
      } catch {
        setStatusMap(getDefaultItems(categories))
      }
    } else {
      setStatusMap(getDefaultItems(categories))
    }
  }, [currentUrl])

  const toggleStatus = useCallback((id: string) => {
    setStatusMap(prev => {
      const current = prev[id] ?? 'untested'
      const next: ItemStatus = current === 'untested' ? 'pass' : current === 'pass' ? 'fail' : current === 'fail' ? 'na' : 'untested'
      return { ...prev, [id]: next }
    })
  }, [])

  const toggleExpand = useCallback((category: string) => {
    setExpanded(prev => ({ ...prev, [category]: !prev[category] }))
  }, [])

  const total = Object.keys(statusMap).length
  const tested = Object.values(statusMap).filter(s => s !== 'untested').length
  const passed = Object.values(statusMap).filter(s => s === 'pass').length
  const failed = Object.values(statusMap).filter(s => s === 'fail').length

  const resetUrlChecklist = useCallback(() => {
    setStatusMap(getDefaultItems(categories))
    const key = getStorageKey(currentUrl)
    localStorage.removeItem(key)
  }, [currentUrl, categories])

  return (
    <section className="rounded-lg border border-[var(--jao-border)] bg-[var(--jao-surface)]" aria-label="Manual WCAG checklist">
      <div className="border-b border-[var(--jao-border)] p-4">
        <h2 className="font-semibold">Manual WCAG 2.2 AA Checklist</h2>
        <p className="mt-1 text-xs text-[var(--jao-text-tertiary)]">
          Automated tools find ~30-40% of issues. Verify the rest manually.
        </p>
        <div className="mt-2 flex items-center gap-3 text-xs text-[var(--jao-text-tertiary)]">
          <span>{tested}/{total} tested</span>
          <span className="text-[var(--jao-success)]">{passed} pass</span>
          {failed > 0 && <span className="text-[var(--jao-destructive)]">{failed} fail</span>}
          <button
            onClick={resetUrlChecklist}
            className="ml-auto text-[var(--jao-text-tertiary)] underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/30"
          >
            Reset
          </button>
        </div>
      </div>
      <div className="p-4 space-y-3 max-h-[32rem] overflow-y-auto">
        {categories.map(cat => {
          const testedInCat = cat.items.filter(i => (statusMap[i.id] ?? 'untested') !== 'untested').length
          const failedInCat = cat.items.filter(i => (statusMap[i.id] ?? 'untested') === 'fail').length
          const isExpanded = expanded[cat.category] ?? false
          const allPassedInCat = cat.items.every(i => (statusMap[i.id] ?? 'untested') === 'pass')
          return (
            <div key={cat.category} className="rounded border border-[var(--jao-border)]">
              <button
                onClick={() => toggleExpand(cat.category)}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--jao-primary)]/30"
                aria-expanded={isExpanded}
              >
                <span className="text-[var(--jao-text-tertiary)]">{isExpanded ? '▾' : '▸'}</span>
                <span className="flex-1">{cat.category}</span>
                {allPassedInCat && testedInCat > 0 && <span className="text-[var(--jao-success)]">✓</span>}
                {failedInCat > 0 && <span className="text-[var(--jao-destructive)]">{failedInCat} failed</span>}
                <span className="text-[var(--jao-text-tertiary)]">({testedInCat}/{cat.items.length})</span>
              </button>
              {isExpanded && (
                <div className="border-t border-[var(--jao-border)] px-3 py-2 space-y-1.5">
                  {cat.items.map(item => {
                    const status = statusMap[item.id] ?? 'untested'
                    return (
                      <div key={item.id} className="flex items-start gap-2 py-1">
                        <button
                          onClick={() => toggleStatus(item.id)}
                          className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border text-[10px] flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/30 ${
                            status === 'pass' ? 'bg-[var(--jao-success)] border-[var(--jao-success)] text-white' :
                            status === 'fail' ? 'bg-[var(--jao-destructive)] border-[var(--jao-destructive)] text-white' :
                            status === 'na' ? 'bg-[var(--jao-border-subtle)] border-[var(--jao-border)] text-[var(--jao-text-tertiary)]' :
                            'border-[var(--jao-border)] hover:border-[var(--jao-primary)]'
                          }`}
                          role="checkbox"
                          aria-checked={status !== 'untested'}
                          aria-label={`${item.description}: ${status === 'pass' ? 'passed' : status === 'fail' ? 'failed' : status === 'na' ? 'N/A' : 'untested'}. Click to cycle: pass → fail → N/A → untested`}
                        >
                          {status === 'pass' ? '✓' : status === 'fail' ? '✗' : status === 'na' ? '—' : ''}
                        </button>
                        <label
                          onClick={() => toggleStatus(item.id)}
                          className="flex-1 min-w-0 cursor-pointer"
                        >
                          <span className="text-xs">{item.description}</span>
                          <span className={`ml-1.5 inline-block rounded px-1 py-0.5 text-[10px] font-medium ${severityColor(item.severity)}`}>
                            {item.severity}
                          </span>
                          <span className="ml-1 text-[10px] text-[var(--jao-text-tertiary)]">{item.wcagRef}</span>
                        </label>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
