/**
 * 浏览器端客户端：在 DSH Web 的插件详情页编辑本插件的 profile 配置。
 *
 * 配置读写全部经由宿主提供的 `configForms` 服务：读取走 `getSnapshot()` 与
 * `subscribe()`，写入走 `mutate()` 的路径操作。组件不直接接触任何 `@deepseek-ai/*`
 * 运行期模块，只依赖 React 与宿主注入的 Cordis 服务。
 */

import type { Context } from '@deepseek-ai/cordis'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ChangeEvent, CSSProperties, ReactElement } from 'react'
import type { ModelIntro } from '../config.js'
import type { PortableConfig } from '../portable.js'
import { parsePortable, serializePortable } from '../portable.js'

/**
 * 插件详情页读到的配置是宿主投影后的裸值，不含宿主端的 `Volatile` 包装，
 * 因此这里单独声明一份纯数据类型，不复用 `src/config.ts` 的 `Config`。
 */
interface EditableConfig {
  toolNames?: string[]
  intro?: string
  models?: ModelIntro[]
  announce?: boolean
}

/** 本插件在 profile 中的条目 id，同时是设置命名空间 key。 */
const NAMESPACE = 'subagent-intro'

/**
 * 插件管理页中本 Bundle 详情页的配置插槽。
 *
 * 该插槽按包名寻址，占用后详情页才会出现配置区。配置只挂在这里，不再往
 * 设置面板的「插件」分页塞一个标签页，避免与内置插件的浏览列表挤在一起。
 */
const BUNDLE_CONFIG_SLOT = 'plugins.bundle.config'

/** 本插件的包名，同时是 bundle 配置插槽的 key。 */
const PACKAGE_NAME = '@dsh-plugin/dsh-subagent-intro'

/** 输入防抖时长，单位毫秒。 */
const SAVE_DELAY = 400

/** 下载文件名前缀。 */
const FILE_PREFIX = 'subagent-intro'

/** 一条路径对命名空间内某个字段的写入，与宿主 `SettingsPathOpView` 同形。 */
type PathOp =
  | { op: 'set'; path: string[]; value: unknown }
  | { op: 'unset'; path: string[] }

/** 命名空间快照，字段语义与宿主 `ConfigFormSnapshot` 一致。 */
interface ConfigFormSnapshot<T> {
  status: 'loading' | 'ready' | 'unavailable'
  value: T | undefined
  base: unknown
  user: unknown
  revision: number | undefined
  writable: boolean
}

/** 单个命名空间的配置表单。 */
interface ConfigForm<T> {
  getSnapshot(): ConfigFormSnapshot<T>
  subscribe(listener: () => void): () => void
  mutate(ops: readonly PathOp[], expectedRevision?: number): Promise<boolean>
  set(field: string, value: unknown): Promise<boolean>
  unset(field: string): Promise<boolean>
}

/** 插槽注册选项，只声明本插件用到的字段。 */
/** 列表型插槽的注册项：按 id 占位，可选 label 与排序。 */
interface ListSlotRegistration {
  name: string
  id: string
  order?: number
  label?: string | (() => string)
}

/** 键控插槽的注册项：按 key 寻址，占用后由宿主按该键下发渲染。 */
interface KeyedSlotRegistration {
  name: string
  key: string
  order?: number
  label?: string | (() => string)
}

type SlotRegistration = ListSlotRegistration | KeyedSlotRegistration

/** 插槽服务，只声明本插件用到的两个方法。 */
interface SlotsService {
  inject(name: string, register: () => () => void): () => void
  register(options: SlotRegistration, component: () => ReactElement | null): () => void
}

/** 模型目录中的一个候选：provider 与模型 id 成对出现。 */
interface CatalogModel {
  readonly provider: string
  readonly providerName: string
  readonly id: string
  readonly name: string
}

/** `remote.session.modelCatalog()` 的返回结构，只声明本插件用到的字段。 */
type ModelCatalogResult =
  | {
    readonly ok: true
    readonly value: {
      readonly groups: readonly {
        readonly id: string
        readonly name: string
        readonly models: readonly { readonly id: string; readonly name: string }[]
      }[]
    }
  }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

/** 宿主在浏览器端补齐的 Cordis 服务。 */
declare module '@deepseek-ai/cordis' {
  interface Context {
    slots: SlotsService
    configForms: { get<T>(entryId: string): ConfigForm<T> }
    remote: { session: { modelCatalog(): Promise<ModelCatalogResult> } }
  }
}

/** 编辑期的一条模型条目：可选字段以空串表示「未填写」。 */
interface ModelDraft {
  model: string
  provider: string
  name: string
  ability: string
  scenario: string
  timing: string
}

/** 编辑期的完整配置。 */
interface Draft {
  toolNames: string[]
  intro: string
  announce: boolean
  models: ModelDraft[]
}

/** 保存状态；失败必须携带原因，页面状态区负责显示。 */
type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'failed'; reason: string }

/** 导入导出的操作反馈；成功或失败都保留到下一次导入导出操作覆盖。 */
interface TransferNote {
  tone: 'success' | 'error'
  text: string
}

/** 已解析、等待用户确认的导入内容。 */
interface StagedImport {
  config: PortableConfig
  source: string
}

/** 可省略字段：留空时应 unset 而不是写入空串，与重排时的整体写回保持一致。 */
const OPTIONAL_MODEL_FIELDS = new Set<keyof ModelDraft>(['provider', 'name'])

/** 新增条目时写入宿主的空条目，必填字段先落空串由用户补齐。 */
const EMPTY_MODEL: ModelDraft = { model: '', provider: '', name: '', ability: '', scenario: '', timing: '' }

export const name = '@dsh-plugin/dsh-subagent-intro'

/** 插件详情页需要插槽、配置表单与远端模型目录三个浏览器端服务。 */
export const inject = ['slots', 'configForms', 'remote', 'remote.session']

/**
 * 挂载插件详情页的配置区。
 *
 * @param ctx - 浏览器端插件上下文。
 */
export function apply(ctx: Context): void {
  const form = ctx.configForms.get<EditableConfig>(NAMESPACE)
  /**
   * 读取宿主模型目录，展平成「provider + 模型」候选列表。
   *
   * 目录只作为填写辅助：拉到就用下拉提示，拉不到时退化为手工输入，不阻塞编辑。
   */
  const loadCatalog = async (): Promise<CatalogModel[]> => {
    const response = await ctx.remote.session.modelCatalog()
    if (!response.ok) throw new Error(`${response.error.code}: ${response.error.message}`)
    return response.value.groups.flatMap(group => group.models.map(model => ({
      provider: group.id,
      providerName: group.name,
      id: model.id,
      name: model.name,
    })))
  }
  const page = () => <SubagentIntroSettings form={form} loadCatalog={loadCatalog} />
  ctx.effect(
    () => ctx.slots.inject(BUNDLE_CONFIG_SLOT, () => ctx.slots.register(
      { name: BUNDLE_CONFIG_SLOT, key: PACKAGE_NAME },
      page,
    )),
    'subagent-intro:bundle-config',
  )
}

/** 把宿主配置转成编辑期草稿，缺省字段补空值。 */
function toDraft(config: EditableConfig): Draft {
  return {
    toolNames: [...config.toolNames ?? []],
    intro: config.intro ?? '',
    announce: config.announce ?? true,
    models: (config.models ?? []).map(model => ({
      model: model.model,
      provider: model.provider ?? '',
      name: model.name ?? '',
      ability: model.ability,
      scenario: model.scenario,
      timing: model.timing,
    })),
  }
}

/** 把草稿条目还原成待写入的 JSON；可选字段留空时不写入，避免存下空串覆盖缺省语义。 */
function modelToJson(model: ModelDraft): Record<string, unknown> {
  const json: Record<string, unknown> = {
    model: model.model,
    ability: model.ability,
    scenario: model.scenario,
    timing: model.timing,
  }
  if (model.name.trim() !== '') json.name = model.name
  if (model.provider.trim() !== '') json.provider = model.provider
  return json
}

/**
 * 把编辑期草稿转成可导出文档的配置主体。
 *
 * 导出的是屏幕上的当前内容，含尚未落盘的编辑，因此这里原样搬运字段；可选字段的
 * 省略规则集中在 {@link serializePortable}，避免两处判断不一致。
 */
function toPortable(draft: Draft): PortableConfig {
  return {
    toolNames: [...draft.toolNames],
    intro: draft.intro,
    announce: draft.announce,
    models: draft.models.map(model => ({
      model: model.model,
      provider: model.provider,
      name: model.name,
      ability: model.ability,
      scenario: model.scenario,
      timing: model.timing,
    })),
  }
}

/** 把导入的配置主体转成编辑期草稿，可选字段统一补空串。 */
function fromPortable(config: PortableConfig): Draft {
  return {
    toolNames: [...config.toolNames],
    intro: config.intro,
    announce: config.announce,
    models: config.models.map(model => ({
      model: model.model,
      provider: model.provider ?? '',
      name: model.name ?? '',
      ability: model.ability,
      scenario: model.scenario,
      timing: model.timing,
    })),
  }
}

/**
 * 导入预览文案：在写入前说明这次替换的规模，避免一次误粘贴直接清空条目。
 *
 * @param config - 已解析的导入内容。
 * @returns 一行用分号分隔的摘要。
 */
function describeImport(config: PortableConfig): string {
  const ids = config.models
    .map(model => model.model.trim())
    .filter(id => id !== '')
  const models = config.models.length === 0
    ? '无模型条目'
    : `${config.models.length} 条模型条目（${ids.length === 0 ? '模型 id 均为空' : ids.join('、')}）`
  const intro = config.intro.trim() === '' ? '总述为空' : `总述 ${config.intro.length} 字`
  const tools = config.toolNames.length === 0
    ? '工具名列表为空，本段将不再注入'
    : `工具名 ${config.toolNames.join('、')}`
  return [models, intro, tools, `适用声明头${config.announce ? '开启' : '关闭'}`].join('；')
}

/** 下载文件名中的时间戳：本地时间，精确到秒。 */
function timeStamp(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
    + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

/** 触发一次浏览器下载，等浏览器取走 blob 后释放对象 URL。 */
function downloadFile(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // 点击是同步返回的，浏览器可能在下一个任务才真正取走 blob，因此延后释放。
  window.setTimeout(() => { URL.revokeObjectURL(url) }, 0)
}

/** 写入剪贴板；页面未提供剪贴板接口时抛出带原因的错误。 */
async function writeClipboard(text: string): Promise<void> {
  const clipboard = navigator.clipboard as Clipboard | undefined
  if (clipboard === undefined || typeof clipboard.writeText !== 'function') {
    throw new Error('当前页面没有可用的剪贴板写入接口')
  }
  await clipboard.writeText(text)
}

/** 读取剪贴板文本；接口缺失同样抛出带原因的错误。 */
async function readClipboard(): Promise<string> {
  const clipboard = navigator.clipboard as Clipboard | undefined
  if (clipboard === undefined || typeof clipboard.readText !== 'function') {
    throw new Error('当前页面没有可用的剪贴板读取接口')
  }
  return await clipboard.readText()
}

/** 取出异常的可读说明。 */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * 页面根容器样式。
 *
 * 宽度交给宿主容器决定，自设 maxWidth
 * 会在宽屏下留下一大片空白，也会让长文本字段过早截断。
 */
const pageStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  width: '100%',
  minWidth: 0,
  color: 'var(--dsw-alias-label-primary)',
}

/** 标题与说明。 */
const titleStyle: CSSProperties = { margin: 0, fontSize: 18, fontWeight: 600, lineHeight: '26px' }
const introStyle: CSSProperties = { margin: 0, fontSize: 13, lineHeight: '20px', color: 'var(--dsw-alias-label-tertiary)' }

/** 占位与提示块。 */
const noticeStyle: CSSProperties = {
  margin: 0,
  padding: '10px 12px',
  fontSize: 13,
  lineHeight: '20px',
  borderRadius: 'var(--dsw-radius-lg)',
  background: 'var(--dsw-alias-bg-module-platform)',
  color: 'var(--dsw-alias-label-secondary)',
}

/** 卡片容器。 */
const cardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: 12,
  border: '0.5px solid var(--dsw-alias-border-l2)',
  borderRadius: 'var(--dsw-radius-lg)',
  background: 'var(--dsw-alias-bg-layer-1)',
}

/** 字段栅格：窄屏自动折行，宽屏铺满可用宽度。 */
const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: 10,
}

/** 长文本字段独占整行：能力、场景、适用时机的文字通常远超一行。 */
const fullRowStyle: CSSProperties = { gridColumn: '1 / -1' }


const labelStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' }

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  height: 32,
  padding: '0 10px',
  font: 'inherit',
  fontSize: 13,
  color: 'var(--dsw-alias-label-primary)',
  background: 'var(--dsw-alias-bg-base)',
  border: '0.5px solid var(--dsw-alias-border-l3)',
  borderRadius: 'var(--dsw-radius-md)',
}

const textareaStyle: CSSProperties = {
  ...inputStyle,
  height: 'auto',
  minHeight: 96,
  padding: '8px 10px',
  lineHeight: '20px',
  resize: 'vertical',
}
/** 多行输入框：高度由内容决定，可手工拖高。 */
const multilineStyle: CSSProperties = {
  ...inputStyle,
  height: 'auto',
  minHeight: 56,
  padding: '6px 10px',
  lineHeight: '20px',
  resize: 'vertical',
}

const buttonStyle: CSSProperties = {
  height: 30,
  padding: '0 12px',
  font: 'inherit',
  fontSize: 13,
  color: 'var(--dsw-alias-label-primary)',
  background: 'var(--dsw-alias-bg-module-platform)',
  border: '0.5px solid var(--dsw-alias-border-l3)',
  borderRadius: 'var(--dsw-radius-md)',
  cursor: 'pointer',
}

const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }
const cardHeadStyle: CSSProperties = { ...rowStyle, justifyContent: 'space-between' }
const cardTitleStyle: CSSProperties = { margin: 0, fontSize: 13, fontWeight: 500, lineHeight: '20px' }
const listStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, margin: 0, padding: 0, listStyle: 'none' }
const statusStyle: CSSProperties = { margin: 0, fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' }

/** 选择器字段容器：作为弹出层的定位基准。 */
const pickerFieldStyle: CSSProperties = { position: 'relative', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }

/** 字段标签文字，与 TextField 的标签外观保持一致。 */
const labelTextStyle: CSSProperties = { fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' }

/** 输入框与按钮同一行；按钮不得被压缩，否则文字会竖排换行。 */
const pickerRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }

/** 选择器内的输入框：可收缩以让出按钮宽度，避免横向溢出或把按钮挤扁。 */
const pickerInputStyle: CSSProperties = { ...inputStyle, flex: '1 1 auto', minWidth: 0 }

const pickerButtonStyle: CSSProperties = {
  ...buttonStyle,
  flexShrink: 0,
  minWidth: 56,
  whiteSpace: 'nowrap',
}

/** 候选弹出层：脱离文档流，覆盖在下方内容之上。 */
const pickerPopoverStyle: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  left: 0,
  right: 0,
  zIndex: 30,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: 4,
  maxHeight: 260,
  overflowY: 'auto',
  border: '0.5px solid var(--dsw-alias-border-l2)',
  borderRadius: 'var(--dsw-radius-md)',
  background: 'var(--dsw-alias-bg-layer-1)',
  boxShadow: 'var(--dsw-shadow-lv3)',
}

/** 单条候选：名称一行、provider/id 一行，超长各自截断。 */
const pickerItemStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  width: '100%',
  padding: '6px 8px',
  font: 'inherit',
  textAlign: 'left',
  color: 'var(--dsw-alias-label-primary)',
  background: 'transparent',
  border: 'none',
  borderRadius: 'var(--dsw-radius-sm)',
  cursor: 'pointer',
}

const pickerItemActiveStyle: CSSProperties = { background: 'var(--dsw-alias-interactive-bg-hover)' }

const pickerItemNameStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: '18px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const pickerItemMetaStyle: CSSProperties = {
  fontSize: 12,
  lineHeight: '16px',
  color: 'var(--dsw-alias-label-tertiary)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const pickerHintStyle: CSSProperties = { fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' }

/** 单行文本输入，标签包裹以免依赖 id 生成。 */
/**
 * 模型 id 选择器：可下拉挑选宿主已注册的模型，也可直接手工输入。
 *
 * 目录里没有的模型（例如只在子代理侧配置的路由）仍允许填写，因此控件是
 * 输入框 + 候选列表，而不是必须从列表中选择的 select。
 */
function ModelPicker(props: {
  value: string
  disabled: boolean
  catalog: CatalogModel[] | null
  catalogError: string | null
  onPick: (model: CatalogModel) => void
  onChange: (text: string) => void
}): ReactElement {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const container = useRef<HTMLSpanElement | null>(null)

  const options = (props.catalog ?? []).filter((model) => {
    const keyword = props.value.trim().toLowerCase()
    if (keyword === '') return true
    return model.id.toLowerCase().includes(keyword)
      || model.name.toLowerCase().includes(keyword)
      || model.provider.toLowerCase().includes(keyword)
  }).slice(0, 40)

  const choose = (model: CatalogModel): void => {
    props.onPick(model)
    setOpen(false)
    setActive(-1)
  }

  return (
    <span
      ref={container}
      style={pickerFieldStyle}
      // 焦点移出整个字段（含按钮与列表）才收起，避免点列表时先被 blur 关掉。
      onBlur={(event) => {
        const next = event.relatedTarget
        if (next instanceof Node && container.current?.contains(next) === true) return
        setOpen(false)
        setActive(-1)
      }}
    >
      <span style={labelTextStyle}>模型 id（model）</span>
      <span style={pickerRowStyle}>
        <input
          type="text"
          style={pickerInputStyle}
          value={props.value}
          disabled={props.disabled}
          placeholder="例如 deepseek-flash"
          aria-expanded={open}
          aria-autocomplete="list"
          onChange={(event) => {
            props.onChange(event.currentTarget.value)
            setOpen(true)
            setActive(-1)
          }}
          onFocus={() => { setOpen(true) }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false)
              return
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              if (options.length === 0) return
              event.preventDefault()
              setOpen(true)
              const delta = event.key === 'ArrowDown' ? 1 : -1
              setActive((current) => {
                const next = current + delta
                if (next < 0) return options.length - 1
                if (next >= options.length) return 0
                return next
              })
              return
            }
            if (event.key === 'Enter') {
              const picked = options[active]
              if (!open || picked === undefined) return
              event.preventDefault()
              choose(picked)
            }
          }}
        />
        <button
          type="button"
          style={pickerButtonStyle}
          disabled={props.disabled || (props.catalog === null && props.catalogError === null)}
          title={props.catalogError !== null
            ? `模型目录不可用：${props.catalogError}`
            : props.catalog === null ? '模型目录尚未就绪' : '从已注册模型中选择'}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => {
            setOpen((value) => !value)
            setActive(-1)
          }}
        >选择</button>
      </span>
      {open && options.length > 0 && (
        <span style={pickerPopoverStyle} role="listbox">
          {options.map((model, index) => (
            <button
              key={`${model.provider}/${model.id}`}
              type="button"
              role="option"
              aria-selected={index === active}
              style={{ ...pickerItemStyle, ...(index === active ? pickerItemActiveStyle : {}) }}
              onMouseEnter={() => { setActive(index) }}
              onClick={() => { choose(model) }}
            >
              <span style={pickerItemNameStyle}>{model.name}</span>
              <span style={pickerItemMetaStyle}>{model.provider}/{model.id}</span>
            </button>
          ))}
        </span>
      )}
      {open && props.catalog !== null && options.length === 0 && (
        <span style={pickerHintStyle}>没有匹配的已注册模型，可直接输入模型 id。</span>
      )}
      {props.catalogError !== null && (
        <span style={pickerHintStyle}>模型目录不可用（{props.catalogError}），可直接输入模型 id。</span>
      )}
    </span>
  )
}

function TextField(props: {
  label: string
  value: string
  disabled: boolean
  placeholder?: string
  /** 填 true 时用多行输入，供整段说明文字使用。 */
  multiline?: boolean
  /** 填 true 时独占栅格整行。 */
  fullRow?: boolean
  onChange: (text: string) => void
}): ReactElement {
  const style: CSSProperties = {
    ...(props.multiline === true ? multilineStyle : inputStyle),
    ...(props.fullRow === true ? fullRowStyle : {}),
  }
  return (
    <label style={labelStyle}>
      <span>{props.label}</span>
      {props.multiline === true ? (
        <textarea
          style={style}
          value={props.value}
          disabled={props.disabled}
          placeholder={props.placeholder}
          onChange={(event) => { props.onChange(event.currentTarget.value) }}
        />
      ) : (
        <input
          type="text"
          style={style}
          value={props.value}
          disabled={props.disabled}
          placeholder={props.placeholder}
          onChange={(event) => { props.onChange(event.currentTarget.value) }}
        />
      )}
    </label>
  )
}

/**
 * 配置区主体。
 *
 * 宿主按 `view` 区分用途：详情页请求 `page` 时才渲染完整表单，
 * `summary` 只用于列表或折叠摘要，这里不需要给出简写版本。
 */
function SubagentIntroSettings(props: {
  form: ConfigForm<EditableConfig>
  /** 读取宿主模型目录；失败时下拉退化为手工输入。 */
  loadCatalog: () => Promise<CatalogModel[]>
  view?: 'summary' | 'page'
}): ReactElement | null {
  const { form, loadCatalog } = props
  if (props.view === 'summary') return null

  const [catalog, setCatalog] = useState<CatalogModel[] | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    loadCatalog().then((models) => {
      if (!cancelled) setCatalog(models)
    }, (error: unknown) => {
      if (cancelled) return
      // 目录不可用时只影响下拉提示，因此只提示而不阻断表单。
      setCatalogError(error instanceof Error ? error.message : String(error))
      console.error('[@dsh-plugin/dsh-subagent-intro] 读取模型目录失败', error)
    })
    return () => { cancelled = true }
  }, [loadCatalog])

  const subscribe = useCallback((listener: () => void) => form.subscribe(listener), [form])
  const getSnapshot = useCallback(() => form.getSnapshot(), [form])
  // 第三个参数是服务端快照：本插件只在浏览器挂载，但传上它可让组件在
  // 任何服务端渲染通路下正常工作，而不是抛 Missing getServerSnapshot。
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  /** 用户尚未提交的编辑；null 表示直接采用宿主值。 */
  const [override, setOverride] = useState<Draft | null>(null)
  /** 在途写入全部结算后自增，用于触发草稿与宿主值的重新对齐。 */
  const [settled, setSettled] = useState(0)
  const [save, setSave] = useState<SaveState>({ kind: 'idle' })
  /** 导入导出的操作反馈；成功或失败都保留到下一次导入导出操作覆盖。 */
  const [note, setNote] = useState<TransferNote | null>(null)
  /** 已解析待确认的导入内容；null 表示没有待确认项。 */
  const [staged, setStaged] = useState<StagedImport | null>(null)
  /** 导入写入是否在途；在途期间禁用全部导入控件，避免覆盖尚未落定的那次导入。 */
  const [applying, setApplying] = useState(false)
  const fileInput = useRef<HTMLInputElement | null>(null)

  const queue = useRef(new Map<string, PathOp>())
  const timer = useRef<number | null>(null)
  const writeSeq = useRef(0)
  const mounted = useRef(true)
  /** 尚未结算的写入数；大于零时宿主快照仍落后于草稿。 */
  const inflight = useRef(0)

  const external = snapshot.value
  const writable = snapshot.writable
  /** 渲染用的有效草稿：用户编辑优先，否则跟随宿主值。 */
  const view: Draft | null = override ?? (external === undefined ? null : toDraft(external))

  /**
   * 立即发出写入，并把失败原因留在页面状态区。
   *
   * @param ops - 按顺序应用的路径操作。
   * @returns 宿主是否接受了这次写入；供需要据此决定后续动作的调用方使用。
   */
  const write = useCallback(async (ops: PathOp[]): Promise<boolean> => {
    if (ops.length === 0) return true
    const seq = writeSeq.current + 1
    writeSeq.current = seq
    inflight.current += 1
    if (mounted.current) setSave({ kind: 'saving' })
    try {
      const accepted = await form.mutate(ops)
      if (!accepted) {
        const reason = '宿主拒绝了这次写入；配置可能已在别处被修改，页面已重新读取宿主值。'
        console.error('[@dsh-plugin/dsh-subagent-intro] 配置写入被宿主拒绝', ops)
        if (mounted.current) {
          setSave({ kind: 'failed', reason })
          // 只有最新一次写入失败才丢弃草稿：较早的失败若也清空草稿，
          // 会把用户在这期间继续输入的内容一起抹掉。
          if (seq === writeSeq.current) setOverride(null)
        }
        return false
      }
      if (mounted.current && seq === writeSeq.current) setSave({ kind: 'saved' })
      return true
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      console.error('[@dsh-plugin/dsh-subagent-intro] 配置写入失败', error)
      if (mounted.current) {
        setSave({ kind: 'failed', reason })
        // 与拒绝分支同理：过期失败不得丢弃仍在编辑的草稿。
        if (seq === writeSeq.current) setOverride(null)
      }
      return false
    } finally {
      inflight.current -= 1
      if (inflight.current === 0) setSettled(count => count + 1)
    }
  }, [form])

  /** 取消防抖并立刻提交队列中的操作，可附加一批结构性操作。 */
  const commit = useCallback((structural: PathOp[] = []): void => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    const ops = [...queue.current.values(), ...structural]
    queue.current.clear()
    void write(ops)
  }, [write])

  /** 排队一条操作并延迟写出；同一路径的连续编辑只保留最后一次。 */
  const enqueue = useCallback((op: PathOp): void => {
    queue.current.set(op.path.join('\u0000'), op)
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      timer.current = null
      commit()
    }, SAVE_DELAY)
  }, [commit])

  /** 组件卸载前补发尚未到期的写入，避免最后一次编辑丢失。 */
  const commitRef = useRef(commit)
  commitRef.current = commit
  useEffect(() => () => {
    mounted.current = false
    commitRef.current()
  }, [])

  /**
   * 草稿与宿主快照同步：待写操作、防抖计时器与在途写入都清空后，让宿主值接管。
   *
   * 这里刻意不把"是否有焦点"算进来：弹出层关闭时焦点元素会被移除，浏览器
   * 不一定补发 blur，用焦点计数会让草稿永久停留在旧值上。真正的保护来自
   * 队列与在途写入本身。
   */
  useEffect(() => {
    if (override === null) return
    if (queue.current.size > 0 || timer.current !== null || inflight.current > 0) return
    setOverride(null)
  }, [override, external, settled])

  if (snapshot.status !== 'ready' || view === null) {
    return (
      <div style={pageStyle}>
        <h2 style={titleStyle}>子代理介绍</h2>
        <p style={noticeStyle}>
          {snapshot.status === 'unavailable'
            ? '配置尚未就绪：宿主没有提供 subagent-intro 这个配置项，请确认插件已安装并启用。'
            : '配置尚未就绪：正在读取宿主配置…'}
        </p>
      </div>
    )
  }

  const disabled = !writable

  /**
   * 基于最新草稿更新。
   *
   * 不能用渲染期捕获的 `view` 直接 `setOverride({ ...view, ... })`：同一事件里
   * 连续调用多次时，React 批处理会让每次都用同一份旧值，后一次把前一次的
   * 修改覆盖掉（点选模型时同时写 model 与 provider 就会丢一半）。
   * @param change - 接收最新草稿并返回下一份草稿。
   */
  const mutateDraft = useCallback((change: (draft: Draft) => Draft): void => {
    setOverride((previous) => {
      const base = previous ?? (external === undefined ? null : toDraft(external))
      return base === null ? previous : change(base)
    })
  }, [external])

  const updateIntro = (text: string): void => {
    mutateDraft(draft => ({ ...draft, intro: text }))
    enqueue({ op: 'set', path: ['intro'], value: text })
  }

  const updateModel = (index: number, field: keyof ModelDraft, text: string): void => {
    mutateDraft((draft) => {
      const models = draft.models.map((model, at) => (at === index ? { ...model, [field]: text } : model))
      return { ...draft, models }
    })
    // 可选字段留空表示"未填写"，写成 unset 才会移除覆盖；
    // 若写成 set ''，重排时的整体写回会省略该键，两条路径的语义就不一致了。
    const path = ['models', String(index), field]
    if (OPTIONAL_MODEL_FIELDS.has(field) && text.trim() === '') enqueue({ op: 'unset', path })
    else enqueue({ op: 'set', path, value: text })
  }

  /**
   * 应用一次模型目录点选。
   *
   * 三步改动合成一次草稿更新与一次整体写入：分多次写既会因旧快照丢改动，
   * 也会让宿主看到中间态。
   * @param index - 条目下标。
   * @param picked - 选中的目录条目。
   */
  const pickModel = (index: number, picked: CatalogModel): void => {
    const models = view.models.map((model, at) => (at === index
      ? {
        ...model,
        model: picked.id,
        provider: picked.provider,
        // 展示名留空才补目录名称，用户已填写的保留。
        name: model.name.trim() === '' ? picked.name : model.name,
      }
      : model))
    setOverride({ ...view, models })
    const pickedModel = models[index]
    if (pickedModel === undefined) return
    // 整体替换该条目：先刷出队列里针对同一字段的旧编辑，再以本条覆盖。
    commit([{ op: 'set', path: ['models', String(index)], value: modelToJson(pickedModel) }])
  }

  const addModel = (): void => {
    const index = view.models.length
    mutateDraft(draft => ({ ...draft, models: [...draft.models, { ...EMPTY_MODEL }] }))
    commit([{
      op: 'set',
      path: ['models', String(index)],
      value: { model: '', ability: '', scenario: '', timing: '' },
    }])
  }

  const removeModel = (index: number): void => {
    mutateDraft(draft => ({ ...draft, models: draft.models.filter((_model, at) => at !== index) }))
    commit([{ op: 'unset', path: ['models', String(index)] }])
  }

  const moveModel = (index: number, delta: number): void => {
    const target = index + delta
    if (target < 0 || target >= view.models.length) return
    const models = [...view.models]
    const [moved] = models.splice(index, 1)
    models.splice(target, 0, moved)
    setOverride({ ...view, models })
    commit([{ op: 'set', path: ['models'], value: models.map(modelToJson) }])
  }

  const updateToolName = (index: number, text: string): void => {
    const toolNames = view.toolNames.map((toolName, at) => (at === index ? text : toolName))
    mutateDraft(draft => ({ ...draft, toolNames }))
    enqueue({ op: 'set', path: ['toolNames'], value: toolNames })
  }

  const addToolName = (): void => {
    const toolNames = [...view.toolNames, '']
    mutateDraft(draft => ({ ...draft, toolNames }))
    commit([{ op: 'set', path: ['toolNames'], value: toolNames }])
  }

  const removeToolName = (index: number): void => {
    const toolNames = view.toolNames.filter((_toolName, at) => at !== index)
    mutateDraft(draft => ({ ...draft, toolNames }))
    commit([{ op: 'set', path: ['toolNames'], value: toolNames }])
  }

  const toggleAnnounce = (checked: boolean): void => {
    mutateDraft(draft => ({ ...draft, announce: checked }))
    commit([{ op: 'set', path: ['announce'], value: checked }])
  }

  /** 当前表单的导出文本；取草稿而非宿主快照，保证复制/下载到的就是屏幕上看到的内容。 */
  const exportText = (): string => serializePortable(toPortable(view), new Date().toISOString())

  const copyConfig = async (): Promise<void> => {
    try {
      await writeClipboard(exportText())
      if (mounted.current) setNote({ tone: 'success', text: '配置已复制到剪贴板。' })
    } catch (error) {
      console.error('[@dsh-plugin/dsh-subagent-intro] 写入剪贴板失败', error)
      if (!mounted.current) return
      setNote({ tone: 'error', text: `复制失败：${describeError(error)}。可以改用「下载 JSON 文件」。` })
    }
  }

  const saveConfig = (): void => {
    const fileName = `${FILE_PREFIX}-${timeStamp(new Date())}.json`
    try {
      downloadFile(fileName, exportText())
      setNote({ tone: 'success', text: `已下载 ${fileName}。` })
    } catch (error) {
      console.error('[@dsh-plugin/dsh-subagent-intro] 生成下载失败', error)
      setNote({ tone: 'error', text: `下载失败：${describeError(error)}` })
    }
  }

  /** 解析一段导入文本；解析失败时清掉上一份待确认项，避免误应用旧内容。 */
  const stageImport = (text: string, source: string): void => {
    const result = parsePortable(text)
    if (!result.ok) {
      console.warn(`[@dsh-plugin/dsh-subagent-intro] 无法解析${source}中的配置：${result.error}`)
      setStaged(null)
      setNote({ tone: 'error', text: `无法解析来源（${source}）中的配置：${result.error}` })
      return
    }
    setStaged({ config: result.config, source })
    setNote(null)
  }

  const importFromClipboard = async (): Promise<void> => {
    try {
      const text = await readClipboard()
      if (!mounted.current) return
      if (text.trim() === '') {
        setNote({ tone: 'error', text: '剪贴板里没有文本内容。' })
        return
      }
      stageImport(text, '剪贴板')
    } catch (error) {
      console.error('[@dsh-plugin/dsh-subagent-intro] 读取剪贴板失败', error)
      if (!mounted.current) return
      setNote({ tone: 'error', text: `读取剪贴板失败：${describeError(error)}。可以改用「选择 JSON 文件」。` })
    }
  }

  const importFromFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    // 事件对象在 await 之后不再持有当前输入框，先取下来。
    const input = event.currentTarget
    const file = input.files?.[0]
    if (file === undefined) {
      console.warn('[@dsh-plugin/dsh-subagent-intro] 文件选择事件没有携带文件')
      return
    }
    let text: string
    try {
      text = await file.text()
    } catch (error) {
      console.error('[@dsh-plugin/dsh-subagent-intro] 读取导入文件失败', error)
      if (mounted.current) setNote({ tone: 'error', text: `读取文件失败：${describeError(error)}` })
      return
    } finally {
      // 清空选择，便于连续导入同一个文件。
      input.value = ''
    }
    if (!mounted.current) return
    stageImport(text, `文件「${file.name}」`)
  }

  /**
   * 应用待确认的导入内容：一次写入四个顶层字段，避免宿主看到中间态。
   *
   * 写入成功才收起待导入项；失败时保留它，可直接重试同一份内容——要换内容需先
   * 放弃，再重新粘贴或选择文件。
   */
  const applyImport = async (): Promise<void> => {
    if (staged === null || applying) return
    const draft = fromPortable(staged.config)
    setOverride(draft)
    // 队列里尚未提交的防抖编辑会被这次整体写入覆盖，先取消以免发出无用请求。
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    queue.current.clear()
    setApplying(true)
    let accepted = false
    try {
      accepted = await write([
        { op: 'set', path: ['toolNames'], value: draft.toolNames },
        { op: 'set', path: ['intro'], value: draft.intro },
        { op: 'set', path: ['announce'], value: draft.announce },
        { op: 'set', path: ['models'], value: draft.models.map(modelToJson) },
      ])
    } finally {
      if (mounted.current) setApplying(false)
    }
    if (!mounted.current) return
    if (accepted) {
      setStaged(null)
      setNote({ tone: 'success', text: '已应用导入的配置。' })
    } else {
      setNote({ tone: 'error', text: '导入未写入：宿主拒绝了这次写入或写入失败，原因见页面上方的保存状态。' })
    }
  }

  return (
    <div style={pageStyle}>
      <div>
        <h2 style={titleStyle}>子代理介绍</h2>
        <p style={introStyle}>下面的内容决定注入系统提示词的子代理介绍段落。修改会自动写入 profile 配置，由宿主按配置模式校验。</p>
      </div>

      <SaveStatus state={save} />

      {disabled
        ? <p style={noticeStyle}>当前配置文档不可写（只读或缺少写入权限），所有控件已禁用；请检查 profile 的写入权限。</p>
        : null}

      <label style={{ ...labelStyle, gap: 6 }}>
        <span>总述（intro）</span>
        <textarea
          style={textareaStyle}
          value={view.intro}
          disabled={disabled}
          placeholder="留空表示不输出总述。"
          onChange={(event) => { updateIntro(event.currentTarget.value) }}
        />
      </label>

      <section style={cardStyle}>
        <div style={cardHeadStyle}>
          <h3 style={cardTitleStyle}>模型介绍条目（{view.models.length}）</h3>
          <button type="button" style={buttonStyle} disabled={disabled} onClick={addModel}>新增条目</button>
        </div>
        {view.models.length === 0
          ? <p style={statusStyle}>还没有条目。子代理介绍至少需要一条模型条目才会注入。</p>
          : (
            <ul style={listStyle}>
              {view.models.map((model, index) => (
                <li key={index} style={cardStyle}>
                  <div style={cardHeadStyle}>
                    <h4 style={cardTitleStyle}>条目 {index + 1}</h4>
                    <div style={rowStyle}>
                      <button
                        type="button"
                        style={buttonStyle}
                        disabled={disabled || index === 0}
                        onClick={() => { moveModel(index, -1) }}
                      >上移</button>
                      <button
                        type="button"
                        style={buttonStyle}
                        disabled={disabled || index === view.models.length - 1}
                        onClick={() => { moveModel(index, 1) }}
                      >下移</button>
                      <button type="button" style={buttonStyle} disabled={disabled} onClick={() => { removeModel(index) }}>删除</button>
                    </div>
                  </div>
                  <div style={gridStyle}>
                    <ModelPicker
                      value={model.model}
                      disabled={disabled}
                      catalog={catalog}
                      catalogError={catalogError}
                      onChange={(text) => { updateModel(index, 'model', text) }}
                      onPick={(picked) => { pickModel(index, picked) }}
                    />
                    <TextField
                      label="provider（可选）"
                      value={model.provider}
                      disabled={disabled}
                      placeholder="例如 mclans-deepseek"
                      onChange={(text) => { updateModel(index, 'provider', text) }}
                    />
                    <TextField
                      label="展示名（name，可选）"
                      value={model.name}
                      disabled={disabled}
                      placeholder="留空则使用模型 id"
                      onChange={(text) => { updateModel(index, 'name', text) }}
                    />
                    <TextField
                      label="能力（ability）"
                      value={model.ability}
                      disabled={disabled}
                      multiline
                      fullRow
                      placeholder="例如：强推理与复杂编码，擅长长链路重构"
                      onChange={(text) => { updateModel(index, 'ability', text) }}
                    />
                    <TextField
                      label="场景（scenario）"
                      value={model.scenario}
                      disabled={disabled}
                      multiline
                      fullRow
                      placeholder="例如：高难度代码改造、架构评审"
                      onChange={(text) => { updateModel(index, 'scenario', text) }}
                    />
                    <TextField
                      label="适用时机（timing）"
                      value={model.timing}
                      disabled={disabled}
                      multiline
                      fullRow
                      placeholder="例如：错误代价高时优先指定"
                      onChange={(text) => { updateModel(index, 'timing', text) }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
      </section>

      <section style={cardStyle}>
        <div style={cardHeadStyle}>
          <h3 style={cardTitleStyle}>子代理创建工具名（toolNames）</h3>
          <button type="button" style={buttonStyle} disabled={disabled} onClick={addToolName}>新增工具名</button>
        </div>
        <p style={statusStyle}>当前作用域内全部工具都不可见时本段不注入；清空列表等同于不再注入。</p>
        {view.toolNames.length === 0
          ? <p style={statusStyle}>列表为空。</p>
          : (
            <ul style={listStyle}>
              {view.toolNames.map((toolName, index) => (
                <li key={index} style={rowStyle}>
                  <input
                    type="text"
                    style={{ ...inputStyle, flex: 1 }}
                    value={toolName}
                    disabled={disabled}
                    placeholder="例如 subagent"
                    onChange={(event) => { updateToolName(index, event.currentTarget.value) }}
                  />
                  <button type="button" style={buttonStyle} disabled={disabled} onClick={() => { removeToolName(index) }}>删除</button>
                </li>
              ))}
            </ul>
          )}
      </section>

      <section style={cardStyle}>
        <h3 style={cardTitleStyle}>适用声明头（announce）</h3>
        <label style={{ ...rowStyle, fontSize: 13, color: 'var(--dsw-alias-label-primary)' }}>
          <input
            type="checkbox"
            checked={view.announce}
            disabled={disabled}
            onChange={(event) => { toggleAnnounce(event.currentTarget.checked) }}
          />
          <span>在段落开头输出「仅适用于当前会话配置」的声明</span>
        </label>
      </section>

      <section style={cardStyle}>
        <h3 style={cardTitleStyle}>导入 / 导出</h3>
        <p style={statusStyle}>
          导出把当前表单写成一份 JSON 文档，可用于备份或迁移到另一份 profile。导入会整体替换总述、模型条目、工具名与适用声明头，粘贴或选择文件后先预览，确认后才写入。
        </p>
        <div style={rowStyle}>
          <button type="button" style={buttonStyle} onClick={() => { void copyConfig() }}>复制到剪贴板</button>
          <button type="button" style={buttonStyle} onClick={saveConfig}>下载 JSON 文件</button>
          <button
            type="button"
            style={buttonStyle}
            disabled={disabled || applying}
            onClick={() => { void importFromClipboard() }}
          >从剪贴板导入</button>
          <button
            type="button"
            style={buttonStyle}
            disabled={disabled || applying}
            onClick={() => { fileInput.current?.click() }}
          >选择 JSON 文件…</button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(event) => { void importFromFile(event) }}
          />
        </div>
        {staged !== null && (
          <div style={cardStyle}>
            <p style={{ ...statusStyle, color: 'var(--dsw-alias-label-secondary)' }}>
              待导入（来源：{staged.source}）：{describeImport(staged.config)}
            </p>
            <div style={rowStyle}>
              <button
                type="button"
                style={buttonStyle}
                disabled={disabled || applying}
                onClick={() => { void applyImport() }}
              >{applying ? '应用中…' : '应用导入'}</button>
              <button
                type="button"
                style={buttonStyle}
                disabled={applying}
                onClick={() => { setStaged(null); setNote(null) }}
              >放弃</button>
            </div>
          </div>
        )}
        {note !== null && (
          <p
            role={note.tone === 'error' ? 'alert' : 'status'}
            style={{
              ...statusStyle,
              color: note.tone === 'error'
                ? 'var(--dsw-alias-state-error-primary)'
                : 'var(--dsw-alias-state-success-primary)',
            }}
          >{note.text}</p>
        )}
      </section>
    </div>
  )
}

/** 保存状态条：失败时把原因直接显示在页面上，不只写控制台。 */
function SaveStatus(props: { state: SaveState }): ReactElement | null {
  const { state } = props
  if (state.kind === 'idle') return null
  if (state.kind === 'saving') {
    return <p style={statusStyle} role="status">保存中…</p>
  }
  if (state.kind === 'saved') {
    return <p style={{ ...statusStyle, color: 'var(--dsw-alias-state-success-primary)' }} role="status">已保存</p>
  }
  return (
    <p
      style={{ ...statusStyle, color: 'var(--dsw-alias-state-error-primary)' }}
      role="alert"
    >
      保存失败：{state.reason}
    </p>
  )
}
