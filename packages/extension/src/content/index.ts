import browser from 'webextension-polyfill'
import { collectElements, analyzeElements } from '@liveviewer/engine'
import type { WcagResult } from '@liveviewer/engine'

let highlightActive = false
let highlightStyleEl: HTMLStyleElement | null = null
let lastResult: WcagResult | null = null

function applyHighlight(result: WcagResult | null) {
  if (highlightStyleEl) {
    highlightStyleEl.remove()
    highlightStyleEl = null
  }

  if (!result || !highlightActive) return

  const selectors = result.failures.map(f => f.selector).join(', ')
  if (!selectors) return

  highlightStyleEl = document.createElement('style')
  highlightStyleEl.textContent = `
    ${selectors} {
      outline: 2px solid #dc2626 !important;
      outline-offset: 2px !important;
    }
  `
  document.head.appendChild(highlightStyleEl)
}

browser.runtime.onMessage.addListener((message: any) => {
  switch (message.type) {
    case 'RUN_AUDIT': {
      try {
        const elements = collectElements()
        const result = analyzeElements(elements)
        lastResult = result
        if (highlightActive) applyHighlight(result)
        return Promise.resolve({ result })
      } catch (err) {
        return Promise.resolve({ error: err instanceof Error ? err.message : 'Audit failed' })
      }
    }

    case 'TOGGLE_HIGHLIGHT': {
      highlightActive = message.active
      applyHighlight(lastResult)
      return Promise.resolve({ success: true })
    }

    default:
      return Promise.resolve({ error: 'Unknown message type' })
  }
})
