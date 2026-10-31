export interface DriftInputs {
  tokens: unknown
  generated: Record<string, string | null>
  files: { file: string; text: string }[]
  allowlist: { entries?: unknown[] } | null
  spec: string | null
}

export interface DriftFinding {
  rule: string
  name: string
  severity: 'error' | 'warning'
  file: string
  line?: number
  token?: string
  message: string
  quiet?: boolean
  allowed?: boolean
  allowReason?: string
}

export interface DriftToken {
  path: string
  parts: string[]
  layer: string
  type: string
  value: unknown
  dark?: unknown
  refs: string[]
}

export interface DriftResult {
  findings: DriftFinding[]
  notes: string[]
  errors: number
  warnings: number
  allowed: number
  exitCode: number
  ctx: {
    tokens: DriftToken[]
    byPath: Map<string, DriftToken>
    resolve(token: DriftToken, dark?: boolean): string
  }
}

export function checkInputs(inputs: DriftInputs, opts?: { rule?: string | null; strict?: boolean }): DriftResult
export function isSource(file: string): boolean
