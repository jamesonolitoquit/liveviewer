'use client'

import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [isLight, setIsLight] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('liveviewer_theme')
      if (stored === 'light') setIsLight(true)
    } catch {}
  }, [])

  const toggle = () => {
    const next = !isLight
    setIsLight(next)
    try {
      localStorage.setItem('liveviewer_theme', next ? 'light' : 'dark')
    } catch {}
    document.documentElement.classList.toggle('light', next)
  }

  return (
    <button
      onClick={toggle}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      className="rounded-full p-1.5 text-[var(--jao-text-secondary)] transition-colors hover:bg-[var(--jao-border-subtle)] hover:text-[var(--jao-text)] focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/30"
    >
      {isLight ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      )}
    </button>
  )
}
