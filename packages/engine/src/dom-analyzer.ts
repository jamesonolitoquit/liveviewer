export interface ElementDatum {
  selector: string
  text: string
  foreground: string
  background: string
  fontSize: number
  fontWeight: number
  isLarge: boolean
  fontFamily: string
  lineHeight: number
  tagName: string
}

export interface Failure {
  selector: string
  text: string
  foreground: string
  background: string
  contrastRatio: number
  required: number
  fontSize: number
  isLarge: boolean
}

export interface WcagResult {
  totalElements: number
  failures: Failure[]
  passCount: number
  failCount: number
  score: number
}

function getEffectiveBackground(el: Element, maxDepth: number): string | 'skip' {
  let current: Element | null = el
  for (let i = 0; i < maxDepth && current; i++) {
    const style = getComputedStyle(current)
    const bg = style.backgroundColor
    const bgImage = style.backgroundImage
    if (bgImage !== 'none') return 'skip'
    if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg
    current = current.parentElement
  }
  return getComputedStyle(document.documentElement).backgroundColor
}

export function collectElements(): ElementDatum[] {
  const results: ElementDatum[] = []
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    null
  )
  while (walker.nextNode()) {
    const el = walker.currentNode as Element
    const tag = el.tagName.toLowerCase()
    if (tag === 'style' || tag === 'script' || tag === 'noscript') continue
    const text = el.textContent?.trim() || ''
    if (!text || el.children.length > 0) continue
    const style = getComputedStyle(el)
    const fontSize = parseFloat(style.fontSize)
    const fontWeight = parseInt(style.fontWeight)
    const isLarge = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700)
    const rawCls = typeof el.className === 'string' ? el.className : (el.getAttribute('class') || '')
    const cls = rawCls ? '.' + rawCls.trim().split(/\s+/).filter(Boolean).join('.') : ''
    const bg = getEffectiveBackground(el, 10)
    if (bg === 'skip') continue
    const lh = parseFloat(style.lineHeight)
    results.push({
      selector: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + cls,
      text: text.slice(0, 120),
      foreground: style.color,
      background: bg,
      fontSize,
      fontWeight,
      isLarge,
      fontFamily: style.fontFamily,
      lineHeight: isNaN(lh) ? 0 : lh,
      tagName: el.tagName.toLowerCase()
    })
  }
  return results
}
