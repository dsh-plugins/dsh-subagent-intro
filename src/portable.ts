/**
 * 配置的可移植文档：导出文本、导入解析与缺省语义。
 *
 * 导出的文档同时是导入的合法输入，因此格式只有一份定义。解析器面向用户粘贴
 * 或选择的外部文件，任何不认识的字段、缺失的必填字段或类型不符都必须定位到
 * 具体路径后报错，不做静默丢弃——静默丢弃会让用户以为导入成功，实际少了条目。
 */

/** 文档所属插件，用于在导入时拒绝别的插件的配置。 */
export const PORTABLE_PLUGIN = '@dsh-plugin/dsh-subagent-intro'

/** 文档格式版本，仅在结构不兼容时递增。 */
export const PORTABLE_VERSION = 1

/** 默认的子代理创建工具名；导入时缺失该字段即取此值，与 schema 默认值一致。 */
export const DEFAULT_TOOL_NAMES: readonly string[] = ['subagent', 'subagent_fork']

/** 可移植文档中的一条模型介绍；`name` 与 `provider` 留空时不落盘。 */
export interface PortableModel {
  /** 模型 id，与 `list_subagent_models` 返回的 id 一致。 */
  model: string
  /** provider id，仅在与模型 id 一起用于路由说明时填写。 */
  provider?: string
  /** 展示名，缺省取 {@link PortableModel.model}。 */
  name?: string
  /** 该模型擅长的能力。 */
  ability: string
  /** 该模型的适用场景。 */
  scenario: string
  /** 该模型的适用时机。 */
  timing: string
}

/** 可移植文档中的配置主体，四个字段全部落地，不含 undefined。 */
export interface PortableConfig {
  /** 判定拥有子代理创建工具的工具名。 */
  toolNames: string[]
  /** 段首总述，空串表示不输出。 */
  intro: string
  /** 是否输出适用声明头。 */
  announce: boolean
  /** 模型介绍条目，按原顺序输出。 */
  models: PortableModel[]
}

/** 解析结果：失败时带一条可直接展示给用户的说明。 */
export type PortableParseResult =
  | { readonly ok: true; readonly config: PortableConfig }
  | { readonly ok: false; readonly error: string }

/** 配置主体允许的字段。 */
const CONFIG_KEYS = new Set(['toolNames', 'intro', 'announce', 'models'])

/** 带标识的文档外壳允许的字段。 */
const DOCUMENT_KEYS = new Set(['plugin', 'version', 'exportedAt', 'config'])

/** 单条模型介绍允许的字段。 */
const MODEL_KEYS = new Set(['model', 'provider', 'name', 'ability', 'scenario', 'timing'])

/** 解析失败的载体：内部抛出，在 {@link parsePortable} 边界转成结果对象。 */
class PortableParseError extends Error {}

/**
 * 生成可导入的配置文档。
 *
 * @param config - 待导出的完整配置。
 * @param exportedAt - 导出时刻，由调用方提供以保证函数输出只取决于入参。
 * @returns 带两空格缩进的 JSON 文本，结尾带换行。
 */
export function serializePortable(config: PortableConfig, exportedAt: string): string {
  const models = config.models.map((model) => {
    const entry: Record<string, unknown> = { model: model.model }
    // 只把全空白视为未填写，写出的是原值，导出内容与屏幕上的输入一致。
    if ((model.provider ?? '').trim() !== '') entry.provider = model.provider
    if ((model.name ?? '').trim() !== '') entry.name = model.name
    entry.ability = model.ability
    entry.scenario = model.scenario
    entry.timing = model.timing
    return entry
  })
  const document = {
    plugin: PORTABLE_PLUGIN,
    version: PORTABLE_VERSION,
    exportedAt,
    config: {
      toolNames: [...config.toolNames],
      intro: config.intro,
      announce: config.announce,
      models,
    },
  }
  return `${JSON.stringify(document, null, 2)}\n`
}

/**
 * 解析导入文本。
 *
 * 接受两种形态，按根对象是否含 `config` 键区分：含 `config` 的是完整文档，此时
 * `plugin` 与 `version` 必须存在并匹配；不含的是裸配置对象，必须至少给出一个配置
 * 字段——空对象按整体替换会静默清空全部内容，因此视为无效输入。两种形态里缺失的
 * 可选字段都取默认值（与 schema 默认值一致），未知字段一律视为错误。
 *
 * @param text - 剪贴板文本或文件内容。
 * @returns 解析结果；失败时 `error` 说明具体到哪个字段。
 */
export function parsePortable(text: string): PortableParseResult {
  try {
    return { ok: true, config: readDocument(text) }
  } catch (error) {
    if (error instanceof PortableParseError) return { ok: false, error: error.message }
    throw error
  }
}

/** 解析文档主体。 */
function readDocument(text: string): PortableConfig {
  // 文本编辑器保存的 UTF-8 文件常带 BOM，JSON.parse 不接受它。
  const source = text.replace(/^\uFEFF/, '')
  let raw: unknown
  try {
    raw = JSON.parse(source)
  } catch (error) {
    throw new PortableParseError(`不是合法的 JSON：${describeError(error)}`)
  }
  if (!isPlainObject(raw)) throw new PortableParseError(`根节点必须是对象，实际是${describe(raw)}`)
  const wrapped = 'config' in raw
  if (!wrapped && ![...CONFIG_KEYS].some(key => key in raw)) {
    throw new PortableParseError('配置对象至少要包含 toolNames、intro、announce、models 中的一个字段')
  }
  const body = wrapped ? unwrapDocument(raw) : raw
  rejectUnknownKeys(body, CONFIG_KEYS, '配置中', 'toolNames、intro、announce、models')
  return {
    toolNames: readToolNames(body.toolNames),
    intro: body.intro === undefined ? '' : requireString(body.intro, 'intro'),
    announce: body.announce === undefined ? true : requireBoolean(body.announce, 'announce'),
    models: body.models === undefined ? [] : readModels(body.models),
  }
}

/** 校验文档外壳并取出配置主体。 */
function unwrapDocument(document: Record<string, unknown>): Record<string, unknown> {
  rejectUnknownKeys(document, DOCUMENT_KEYS, '文档中', 'plugin、version、exportedAt、config')
  const plugin = requireString(document.plugin, 'plugin')
  if (plugin !== PORTABLE_PLUGIN) {
    throw new PortableParseError(`文档属于 "${plugin}"，不是 ${PORTABLE_PLUGIN} 的配置`)
  }
  const version = requireNumber(document.version, 'version')
  if (version !== PORTABLE_VERSION) {
    throw new PortableParseError(`文档版本 ${version} 不受支持，当前只接受版本 ${PORTABLE_VERSION}`)
  }
  if (document.exportedAt !== undefined) requireString(document.exportedAt, 'exportedAt')
  if (!isPlainObject(document.config)) {
    throw new PortableParseError(`字段 "config" 必须是对象，实际是${describe(document.config)}`)
  }
  return document.config
}

/** 读取工具名列表。 */
function readToolNames(value: unknown): string[] {
  if (value === undefined) return [...DEFAULT_TOOL_NAMES]
  if (!Array.isArray(value)) throw new PortableParseError(`字段 "toolNames" 必须是字符串数组，实际是${describe(value)}`)
  return value.map((entry, index) => requireString(entry, `toolNames[${index}]`))
}

/** 读取模型条目。 */
function readModels(value: unknown): PortableModel[] {
  if (!Array.isArray(value)) throw new PortableParseError(`字段 "models" 必须是数组，实际是${describe(value)}`)
  return value.map((entry, index) => {
    const at = `models[${index}]`
    if (!isPlainObject(entry)) throw new PortableParseError(`字段 "${at}" 必须是对象，实际是${describe(entry)}`)
    rejectUnknownKeys(entry, MODEL_KEYS, `字段 "${at}" 中`, 'model、provider、name、ability、scenario、timing')
    const model: PortableModel = {
      model: requireString(entry.model, `${at}.model`),
      ability: requireString(entry.ability, `${at}.ability`),
      scenario: requireString(entry.scenario, `${at}.scenario`),
      timing: requireString(entry.timing, `${at}.timing`),
    }
    const provider = entry.provider === undefined ? '' : requireString(entry.provider, `${at}.provider`)
    const name = entry.name === undefined ? '' : requireString(entry.name, `${at}.name`)
    if (provider.trim() !== '') model.provider = provider
    if (name.trim() !== '') model.name = name
    return model
  })
}

/** 拒绝未声明的字段，避免拼写错误被当作缺省值放过。 */
function rejectUnknownKeys(
  record: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  where: string,
  expected: string,
): void {
  const unknown = Object.keys(record).find(key => !allowed.has(key))
  if (unknown !== undefined) {
    throw new PortableParseError(`${where}包含未知字段 "${unknown}"，可用字段：${expected}`)
  }
}

/** 校验必填字符串字段。 */
function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string') throw new PortableParseError(`字段 "${path}" 必须是字符串，实际是${describe(value)}`)
  return value
}

/** 校验布尔字段。 */
function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new PortableParseError(`字段 "${path}" 必须是布尔值，实际是${describe(value)}`)
  return value
}

/** 校验数字字段。 */
function requireNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new PortableParseError(`字段 "${path}" 必须是数字，实际是${describe(value)}`)
  }
  return value
}

/** 判定是否为 JSON 对象（排除 null、数组与其他对象）。 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 把任意值描述成中文类型名，用于拼错误信息。 */
function describe(value: unknown): string {
  if (value === undefined) return '缺失'
  if (value === null) return 'null'
  if (Array.isArray(value)) return '数组'
  if (typeof value === 'object') return '对象'
  if (typeof value === 'string') return '字符串'
  if (typeof value === 'number') return '数字'
  if (typeof value === 'boolean') return '布尔值'
  return typeof value
}

/** 提取 JSON 语法错误的原始说明。 */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
