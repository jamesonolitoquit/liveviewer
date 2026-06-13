'use client'

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'liveviewer_cookie_consent'

export function CookieConsent() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setShow(true)
    } catch {}
    const handler = () => {
      try { localStorage.removeItem(STORAGE_KEY) } catch {}
      setShow(true)
    }
    window.addEventListener('show-cookie-consent', handler)
    return () => window.removeEventListener('show-cookie-consent', handler)
  }, [])

  const accept = () => {
    setShow(false)
    try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
  }

  if (!show) return null

  return (
    <div id="cookie-consent" className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--jao-border)] bg-[var(--jao-surface)] p-4 shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <p className="text-base text-[var(--jao-text-secondary)]">
          This site uses cookies for analytics and functionality. By continuing, you accept our use of cookies.
        </p>
        <button
          onClick={accept}
          className="pointer-events-auto rounded-full bg-[var(--jao-primary)] px-4 py-2 text-base font-medium text-white shadow-sm transition-colors hover:bg-[var(--jao-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/50"
        >
          Accept
        </button>
      </div>
    </div>
  )
}
