'use client'

import { MessageSquare } from 'lucide-react'

const ISSUES_URL = 'https://github.com/jamesonolitoquit/liveviewer/issues/new'
const TEMPLATE_PARAMS = 'template=feedback.yml'

export function FeedbackButton() {
  const handleClick = () => {
    const body = `URL: ${encodeURIComponent(window.location.href)}`
    window.open(
      `${ISSUES_URL}?${TEMPLATE_PARAMS}&title=[Web+App]+Feedback&body=${body}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Feedback"
      title="Submit feedback"
      className="fixed bottom-36 right-6 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--jao-border)] bg-[var(--jao-surface)] text-[var(--jao-text-secondary)] shadow-md transition-all duration-200 hover:scale-110 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--jao-primary)]/50"
    >
      <MessageSquare size={16} aria-hidden="true" />
    </button>
  )
}
