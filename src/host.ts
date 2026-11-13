import type { Context } from '@deepseek-ai/cordis'

/** 一次系统提示词装配的上下文（宿主在每步请求前构造）。 */
export interface AssembleContext {
  /** 当前会话或子代理；诊断性装配时为 undefined。 */
  readonly agent?: AgentLike
  /** 作用域，实际为 agent 自身。 */
  readonly scope?: unknown
  /** 本步骤的模型选择；非 agent 步骤时为 undefined。 */
  readonly modelSelection?: ModelSelection
}

export interface ModelSelection {
  readonly provider: string
  readonly model: string
  readonly reasoningEffort?: string
}

export interface HeaderConfig {
  readonly provider: string
  readonly model: string
  readonly reasoningEffort?: string
}

/** 一条已持久化的会话事件，本插件只读取类型与数据。 */
export interface SessionEventLike {
  readonly type: string
  readonly data: unknown
}

/** 会话表面：请求实际发送的消息序列。 */
export interface SessionSurface {
  /** 当前表面上保留的事件序号，按模型可见顺序排列。 */
  readonly nodes: readonly number[]
}

export interface SessionLike {
  /** 该会话上一次实际发出的请求头；从未请求时为 undefined。 */
  requestHeader(): { readonly config: HeaderConfig } | undefined
  /** 请求实际发送的消息序列。 */
  readonly surface: SessionSurface
  /** 按序号读取单个事件；序号不在日志中时返回 undefined。 */
  eventAt(seq: number): SessionEventLike | undefined
}

export interface AgentLike {
  readonly session: SessionLike
}

export interface PromptSection {
  readonly name: string
  readonly order: number
  readonly text: string | ((context: AssembleContext) => string)
  readonly interpolate?: boolean
  readonly complete?: boolean
}

export interface SystemPromptService {
  section(section: PromptSection): () => void
}

export interface ToolRegistry {
  /** 读取该作用域内当前可见的工具定义。 */
  get(name: string, scope?: unknown): unknown
}

export type PreStepDecision =
  | { readonly kind: 'reject' }
  | {
    readonly kind: 'enter'
    readonly messages: readonly unknown[]
    /** 置 true 使宿主以本步作为新请求系列起点：系统提示词文本变化时替换头部节点。 */
    readonly startsRequestSeries?: true
  }

export interface PreStepPayload {
  readonly agent: AgentLike
  readonly messages: readonly unknown[]
  readonly turn: number
  readonly step: number
  readonly signal: AbortSignal
  readonly modelSelection: ModelSelection
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    readonly systemPrompt: SystemPromptService
    readonly tools: ToolRegistry
  }
  interface Events {
    'agent/pre-step'(
      payload: PreStepPayload,
      next: () => Promise<PreStepDecision>,
    ): Promise<PreStepDecision>
  }
}
