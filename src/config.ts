import type { Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { DEFAULT_TOOL_NAMES } from './portable.js'

/** 一条子代理模型的介绍条目，全部由用户配置提供。 */
export interface ModelIntro {
  /** 模型 id，与 `list_subagent_models` 返回的 id 一致。 */
  model: string
  /** 展示名，缺省取 {@link ModelIntro.model}。 */
  name?: string
  /** provider id，缺省表示不区分 provider。 */
  provider?: string
  /** 该模型擅长的能力。 */
  ability: string
  /** 该模型的适用场景。 */
  scenario: string
  /** 该模型的适用时机。 */
  timing: string
}

/** 补齐默认值后的配置，渲染与判定共用同一份。 */
export interface ResolvedConfig {
  readonly toolNames: readonly string[]
  readonly announce: boolean
  readonly intro: string
  readonly models: readonly ModelIntro[]
}

/**
 * 升级前的 Cordis YAML 配置，供迁移读取。
 *
 * 保留 volatile 包装，便于在清理旧配置时让宿主原地更新条目。
 */
export interface Config {
  /** 判定“当前作用域拥有子代理创建工具”的工具名，默认 `['subagent', 'subagent_fork']`。 */
  toolNames?: Volatile<string[]>
  /** 段首总述。 */
  intro?: Volatile<string>
  /** 模型介绍条目，按配置顺序输出。 */
  models?: Volatile<ModelIntro[]>
  /** 是否输出适用声明头，默认 `true`。 */
  announce?: Volatile<boolean>
}

/**
 * 配置 schema。
 *
 * 这里需要一次断言：`.volatile()` 只写进运行时元数据，schemastery 的静态类型仍按
 * 裸值推导，与接口里的 {@link Volatile} 包装不同。不加断言时无法生成可移植的声明文件。
 */
export const Config: z<Config> = z.object({
  toolNames: z.array(z.string()).default([...DEFAULT_TOOL_NAMES]).volatile()
    .description('判定拥有子代理创建工具的工具名；全部不可见时不注入本段。'),
  intro: z.string().default('').volatile()
    .description('子代理介绍的总述，留空表示不输出总述。'),
  models: z.array(z.object({
    model: z.string().required().description('模型 id，与 list_subagent_models 返回的 id 一致。'),
    name: z.string().description('展示名，缺省取模型 id。'),
    provider: z.string().description('provider id，填写后随模型 id 一起输出。'),
    ability: z.string().required().description('该模型擅长的能力。'),
    scenario: z.string().required().description('该模型的适用场景。'),
    timing: z.string().required().description('该模型的适用时机。'),
  })).default([]).volatile()
    .description('子代理模型介绍条目，按配置顺序输出。'),
  announce: z.boolean().default(true).volatile()
    .description('是否输出“仅适用于当前会话配置”的适用声明头。'),
}) as unknown as z<Config>


/**
 * 把可缺省配置补齐为固定形状。
 *
 * @param config - 插件配置；volatile 字段取当前值。
 * @returns 渲染与判定共用的固定形状配置。
 */
export function resolveConfig(config: Config): ResolvedConfig {
  return {
    toolNames: config.toolNames?.get() ?? DEFAULT_TOOL_NAMES,
    announce: config.announce?.get() ?? true,
    intro: config.intro?.get() ?? '',
    models: config.models?.get() ?? [],
  }
}
