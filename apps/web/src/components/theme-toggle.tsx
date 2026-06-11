'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('theme')
      if (stored === 'dark') setIsDark(true)
    } catch {}
  }, [])

  const toggle = () => {
    const next = !isDark
    setIsDark(next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {}
    document.documentElement.classList.toggle('dark', next)
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="rounded-full p-1.5 text-[var(--jao-text-secondary)] transition-colors hover:bg-[var(--jao-border-subtle)] hover:text-[var(--jao-text)] focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/30"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
