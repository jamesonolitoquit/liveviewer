export interface WcagFailure {
  selector: string
  text: string
  foreground: string
  background: string
  contrastRatio: number
  required: number
  fontSize: number
  isLarge: boolean
  viewports?: { width: number; height: number }[]
}

export interface WcagData {
  totalElements: number
  failures: WcagFailure[]
  passCount: number
  failCount: number
  score: number
}

export interface ViewportResult {
  viewport: { width: number; height: number }
  wcag: WcagData
}

export interface DesignFailure {
  ruleId: string
  ruleName: string
  category: 'typography' | 'spacing' | 'interactivity' | 'media' | 'brand'
  selector: string
  description: string
  severity: 'high' | 'medium' | 'low'
  value: string
  expected: string
}

export interface DesignData {
  failures: DesignFailure[]
  totalChecks: number
  passCount: number
  failCount: number
  score: number
}

export interface FixSuggestion {
  type: string
  severity: 'high' | 'medium' | 'low'
  selector: string
  text?: string
  currentValue?: string
  suggestedValue?: string
  recommendation: string
}

export interface AuditData {
  url: string
  timestamp: number
  viewport: { width: number; height: number }
  wcag: WcagData | null
  viewports?: ViewportResult[]
  multiViewport?: boolean
  design?: DesignData | null
  recommendations?: FixSuggestion[]
}
