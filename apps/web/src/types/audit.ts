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

export interface SeoFailure {
  ruleId: string
  ruleName: string
  category: string
  selector: string
  description: string
  severity: 'high' | 'medium' | 'low'
  value: string
  expected: string
}

export interface SeoData {
  failures: SeoFailure[]
  totalChecks: number
  passCount: number
  failCount: number
  score: number
}

export interface SecurityFailure {
  ruleId: string
  ruleName: string
  category: string
  selector: string
  description: string
  severity: 'high' | 'medium' | 'low'
  value: string
  expected: string
}

export interface SecurityData {
  failures: SecurityFailure[]
  totalChecks: number
  passCount: number
  failCount: number
  score: number
}

export interface LegalFailure {
  ruleId: string
  ruleName: string
  category?: string
  selector: string
  description: string
  severity?: string
  value?: string
  expected?: string
}

export interface LegalData {
  failures: LegalFailure[]
  totalChecks: number
  passCount: number
  failCount: number
  score: number
}

export interface PerformanceData {
  error: string | null
  score: number | null
  grade: string | null
  lcp: number | null
  cls: number | null
  tbt: number | null
  fcp: number | null
  speedIndex: number | null
  tti: number | null
  recommendations: string[]
}

export interface AiFailure {
  ruleId: string
  ruleName: string
  category?: string
  selector: string
  description: string
  severity?: string
  value?: string
  expected?: string
}

export interface AiSignal {
  type: string
  detail: string
  weight: number
}

export interface AiData {
  failures: AiFailure[]
  confidence: number
  level: string
  signals: AiSignal[]
  totalChecks: number
  passCount: number
  failCount: number
  score: number
}

export interface MobileFailure {
  ruleId: string
  ruleName: string
  category: string
  selector: string
  description: string
  severity: string
  value: string
  expected: string
}

export interface MobileData {
  failures: MobileFailure[]
  totalChecks: number
  passCount: number
  failCount: number
  score: number
}

export interface AuditData {
  url: string
  timestamp: number
  viewport: { width: number; height: number }
  wcag: WcagData | null
  viewports?: ViewportResult[]
  multiViewport?: boolean
  design?: DesignData | null
  seo?: SeoData | null
  security?: SecurityData | null
  legal?: LegalData | null
  performance?: PerformanceData | null
  ai?: AiData | null
  mobile?: MobileData | null
  recommendations?: FixSuggestion[]
}
