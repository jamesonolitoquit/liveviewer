'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useEffect, useState } from 'react'

interface PillarCount {
  pillar: string
  pass: number
  fail: number
}

interface PassFailBarsProps {
  pillars: PillarCount[]
}

export function PassFailBars({ pillars }: PassFailBarsProps) {
  const [colors, setColors] = useState({ pass: '#15803D', fail: '#DC2626', border: '#E2E8F0', text: '#4B5563', bg: '#FFFFFF' })

  useEffect(() => {
    const el = document.documentElement
    const isDark = el.classList.contains('dark')
    setColors({
      pass: getComputedStyle(el).getPropertyValue('--jao-success').trim() || '#15803D',
      fail: getComputedStyle(el).getPropertyValue('--jao-destructive').trim() || '#DC2626',
      border: isDark ? '#334155' : '#E2E8F0',
      text: isDark ? '#94A3B8' : '#4B5563',
      bg: isDark ? '#1E293B' : '#FFFFFF',
    })
  }, [])

  if (pillars.length === 0) return null

  const totalMax = Math.max(...pillars.map(p => p.pass + p.fail), 1)

  return (
    <div className="h-72 w-full" role="img" aria-label={`Pass/fail breakdown: ${pillars.map(p => `${p.pillar} ${p.pass} pass, ${p.fail} fail`).join('; ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={pillars} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }} barSize={20} barGap={2}>
          <XAxis type="number" domain={[0, totalMax]} tick={{ fontSize: 9, fill: colors.text }} />
          <YAxis type="category" dataKey="pillar" tick={{ fontSize: 10, fill: colors.text }} width={70} />
          <Tooltip
            contentStyle={{
              backgroundColor: colors.bg,
              border: `1px solid ${colors.border}`,
              borderRadius: '4px',
              fontSize: '12px',
              color: colors.text,
            }}
            formatter={(value, name) => [value, name === 'pass' ? 'Pass' : 'Fail']}
          />
          <Bar dataKey="pass" stackId="a" fill={colors.pass} radius={[4, 0, 0, 4]} name="pass" />
          <Bar dataKey="fail" stackId="a" fill={colors.fail} radius={[0, 4, 4, 0]} name="fail" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
