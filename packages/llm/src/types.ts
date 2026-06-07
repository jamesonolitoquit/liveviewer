export interface LLMOptions {
  llmEnrich: boolean
  provider: 'openai' | 'ollama' | 'mock'
  model: string
  apiKey?: string
  promptTemplate?: string
  cacheTtlDays?: number
  cacheDir?: string
  clearCache?: boolean
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

export interface AuditResults {
  url: string
  timestamp: number
  filepath?: string
  wcag: AuditWcagResult | null
}

export interface LLMClient {
  complete<T>(prompt: string, schema?: object): Promise<T>
}
