'use client'

import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts'
import { useEffect, useState } from 'react'

interface PillarScore {
  pillar: string
  score: number
}

interface PillarRadarProps {
  scores: PillarScore[]
}

export function PillarRadar({ scores }: PillarRadarProps) {
  const [colors, setColors] = useState({ primary: '#4F46E5', bg: '#FFFFFF', border: '#E2E8F0', text: '#4B5563' })

  useEffect(() => {
    const el = document.documentElement
    const isDark = el.classList.contains('dark')
    setColors({
      primary: getComputedStyle(el).getPropertyValue('--jao-primary').trim() || '#4F46E5',
      bg: isDark ? '#1E293B' : '#FFFFFF',
      border: isDark ? '#334155' : '#E2E8F0',
      text: isDark ? '#94A3B8' : '#4B5563',
    })
  }, [])

  if (scores.length === 0) return null

  const label = scores.map(s => `${s.pillar} ${s.score}%`).join(', ')

  return (
    <div className="h-72 w-full" role="img" aria-label={`Score radar: ${label}`}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={scores} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke={colors.border} />
          <PolarAngleAxis dataKey="pillar" tick={{ fontSize: 10, fill: colors.text }} />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: colors.text }} angle={90} />
          <Radar name="Score" dataKey="score" stroke={colors.primary} fill={colors.primary} fillOpacity={0.15} strokeWidth={2} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
