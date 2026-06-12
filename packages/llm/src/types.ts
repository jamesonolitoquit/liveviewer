export interface LLMOptions {
  llmEnrich: boolean
  provider: 'openai' | 'ollama' | 'mock'
  model: string
  apiKey?: string
  baseUrl?: string
  promptTemplate?: string
  cacheTtlDays?: number
  cacheDir?: string
  clearCache?: boolean
  context?: string
}

export interface FailureAnalysis {
  selector: string
  ruleId: string
  explanation: string
  suggestion: string
  severity: 'high' | 'medium' | 'low'
}

export interface LLMResponse {
  provider: string
  model: string
  summary: string
  perFailure: FailureAnalysis[]
  cached: boolean
}

export interface LLMError {
  error: string
  provider: string
  model: string
}

export interface AuditWcagResult {
  totalElements: number
  failures: AuditFailure[]
  passCount: number
  failCount: number
  score: number
}

export interface AuditFailure {
  selector: string
  text: string
  foreground: string
  background: string
  contrastRatio: number
  required: number
  fontSize: number
  isLarge: boolean
}

export interface DesignFailure {
  ruleId: string
  ruleName: string
  selector: string
  description: string
  severity: string
  value: string
  expected: string
}

export interface AuditDesignResult {
  failures: DesignFailure[]
  totalChecks: number
  passCount: number
  failCount: number
  score: number
}

export interface DesignFix {
  selector: string
  ruleId: string
  explanation: string
  suggestion: string
  severity: string
}

export interface GeneralFix {
  pillar: string
  selector: string
  ruleId: string
  explanation: string
  suggestion: string
  severity: string
}

export interface AuditSeoResult {
  failures: DesignFailure[]
  totalChecks: number
  passCount: number
  failCount: number
  score: number
}

export interface AuditSecurityResult {
  failures: DesignFailure[]
  totalChecks: number
  passCount: number
  failCount: number
  score: number
}

export interface AuditLegalResult {
  failures: DesignFailure[]
  totalChecks: number
  passCount: number
  failCount: number
  score: number
}

export interface AuditPerformanceResult {
  score: number | null
  lcp: number | null
  cls: number | null
  tbt: number | null
  fcp: number | null
  speedIndex: number | null
  tti: number | null
  grade: string | null
  recommendations?: Array<{ title: string; description?: string }>
}

export interface AuditResults {
  url: string
  timestamp: number
  filepath?: string
  wcag: AuditWcagResult | null
  design?: AuditDesignResult | null
  seo?: AuditSeoResult | null
  security?: AuditSecurityResult | null
  legal?: AuditLegalResult | null
  performance?: AuditPerformanceResult | null
}

export interface LLMResponse {
  provider: string
  model: string
  summary: string
  perFailure: FailureAnalysis[]
  designFixes?: DesignFix[]
  perPillarFixes?: {
    seo?: GeneralFix[]
    security?: GeneralFix[]
    legal?: GeneralFix[]
    performance?: GeneralFix[]
  }
  cached: boolean
}

export interface LLMClient {
  complete<T>(prompt: string, system?: string, schema?: object): Promise<T>
}
