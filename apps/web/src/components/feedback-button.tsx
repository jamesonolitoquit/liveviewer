'use client'

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
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  )
}
