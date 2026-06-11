import { describe, it, expect } from 'vitest'

function mergeElements(existing, incoming) {
  const seen = new Set((existing || []).map(e => e.selector))
  const merged = [...(existing || [])]
  for (const el of (incoming || [])) {
    if (!seen.has(el.selector)) {
      seen.add(el.selector)
      merged.push(el)
    }
  }
  return merged
}

describe('viewport element merge', () => {
  it('merges two arrays with distinct selectors', () => {
    const a = [{ selector: 'p.foo', text: 'hello' }]
    const b = [{ selector: 'p.bar', text: 'world' }]
    const result = mergeElements(a, b)
    expect(result).toHaveLength(2)
    expect(result[0].selector).toBe('p.foo')
    expect(result[1].selector).toBe('p.bar')
  })

  it('deduplicates when same selector appears in both arrays', () => {
    const a = [{ selector: 'p.foo', text: 'first' }]
    const b = [{ selector: 'p.foo', text: 'second' }]
    const result = mergeElements(a, b)
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('first')
  })

  it('handles empty first array', () => {
    const result = mergeElements([], [{ selector: 'p.new', text: 'new' }])
    expect(result).toHaveLength(1)
    expect(result[0].selector).toBe('p.new')
  })

  it('handles empty incoming array', () => {
    const a = [{ selector: 'p.foo', text: 'hello' }]
    const result = mergeElements(a, [])
    expect(result).toHaveLength(1)
  })

  it('handles both arrays empty', () => {
    const result = mergeElements([], [])
    expect(result).toHaveLength(0)
  })

  it('preserves all element properties after merge', () => {
    const a = [{ selector: 'p.foo', text: 'hello', fontSize: 14, foreground: 'rgb(0,0,0)' }]
    const b = [{ selector: 'p.bar', text: 'world', fontSize: 11, foreground: 'rgb(51,51,51)' }]
    const result = mergeElements(a, b)
    expect(result).toHaveLength(2)
    expect(result[0].fontSize).toBe(14)
    expect(result[1].fontSize).toBe(11)
    expect(result[1].foreground).toBe('rgb(51,51,51)')
  })

  it('deduplicates by selector only, keeps first occurrence', () => {
    const a = [{ selector: 'div.x', text: 'alpha', fontSize: 12 }]
    const b = [{ selector: 'div.x', text: 'beta', fontSize: 14 }]
    const result = mergeElements(a, b)
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('alpha')
    expect(result[0].fontSize).toBe(12)
  })

  it('handles multiple viewports (3+) with overlapping selectors', () => {
    const vp1 = [{ selector: 'p.a' }, { selector: 'p.b' }]
    const vp2 = [{ selector: 'p.b' }, { selector: 'p.c' }]
    const vp3 = [{ selector: 'p.c' }, { selector: 'p.d' }]
    let merged = mergeElements([], vp1)
    merged = mergeElements(merged, vp2)
    merged = mergeElements(merged, vp3)
    expect(merged).toHaveLength(4)
    expect(merged.map(e => e.selector).sort()).toEqual(['p.a', 'p.b', 'p.c', 'p.d'])
  })
})
