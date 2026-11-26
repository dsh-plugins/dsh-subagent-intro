import type { Context } from '@deepseek-ai/cordis'
import type { ConfigPanelProps, DshLoaderUi } from '@dsh-plugin/dsh-loader/client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, ReactElement } from 'react'
import type { PortableConfig } from '../portable.js'
import { parsePortable, serializePortable } from '../portable.js'

const CONFIG_ID = 'dsh-subagent-intro'
const SAVE_DELAY = 400
const FILE_PREFIX = 'subagent-intro'

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

/** 一批连续编辑共用一个修订号，只有成功写入才能推进该修订号。 */
interface PendingEdits {
  revision: number
  draft: Draft
}

const EMPTY_MODEL: ModelDraft = { model: '', provider: '', name: '', ability: '', scenario: '', timing: '' }

export const name = '@dsh-plugin/dsh-subagent-intro'
export const inject = ['dshLoaderUi', 'remote', 'remote.session']

/** 将编辑区挂到配置卡片，并从宿主模型目录提供可选条目。 */
export function apply(ctx: Context & { dshLoaderUi: Pick<DshLoaderUi, 'config'> }): void {
  const loadCatalog = async (): Promise<CatalogModel[]> => {
    const response = await ctx.remote.session.modelCatalog()
    if (!response.ok) {
      throw new Error(`${response.error.code}: ${response.error.message}`)
    }
    return response.value.groups.flatMap(group => group.models.map(model => ({
      provider: group.id,
      providerName: group.name,
      id: model.id,
      name: model.name,
    })))
  }
  ctx.dshLoaderUi.config.registerPanel(
    { effect: register => ctx.effect(() => register() ?? []) },
    {
      configId: CONFIG_ID,
      id: 'editor',
      component: ({ view, client }) => <SubagentIntroSettings snapshot={view} client={client} loadCatalog={loadCatalog} />,
    },
  )
}

function toDraft(config: PortableConfig): Draft {
  return {
    toolNames: [...config.toolNames],
    intro: config.intro,
    announce: config.announce,
    models: config.models.map(model => ({
      ...model,
      provider: model.provider ?? '',
      name: model.name ?? '',
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

const introStyle: CSSProperties = { margin: 0, fontSize: 13, lineHeight: '20px', color: 'var(--dsw-alias-label-tertiary)' }

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

function SubagentIntroSettings({ snapshot, client, loadCatalog }: {
  snapshot: ConfigPanelProps['view']
  client: ConfigPanelProps['client']
  loadCatalog: () => Promise<CatalogModel[]>
}): ReactElement {
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

  const [lastSaved, setLastSaved] = useState(snapshot)
  const [override, setOverride] = useState<Draft | null>(null)
  const [save, setSave] = useState<SaveState>({ kind: 'idle' })
  const [note, setNote] = useState<TransferNote | null>(null)
  const [staged, setStaged] = useState<StagedImport | null>(null)
  const [applying, setApplying] = useState(false)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const timer = useRef<number | null>(null)
  const pending = useRef<PendingEdits | null>(null)
  const writes = useRef(Promise.resolve(true))
  const mounted = useRef(true)

  const current = lastSaved.revision > snapshot.revision ? lastSaved : snapshot
  // 配置服务已按本插件注册的模板校验这一份快照。
  const external = current.value as typeof current.value & PortableConfig
  const view = override ?? toDraft(external)
  const disabled = applying

  const cancelTimer = useCallback((): void => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const commit = useCallback((): Promise<boolean> => {
    cancelTimer()
    const batch = pending.current
    if (batch === null) {
      return Promise.resolve(false)
    }
    const draft = batch.draft
    const write = writes.current.then(async () => {
      if (pending.current !== batch) {
        return false
      }
      if (mounted.current) {
        setSave({ kind: 'saving' })
      }
      try {
        const saved = await client.update(CONFIG_ID, {
          ...draft,
          models: draft.models.map(model => ({
            ...model,
            name: model.name.trim() === '' ? '' : model.name,
            provider: model.provider.trim() === '' ? '' : model.provider,
          })),
        }, batch.revision)
        batch.revision = saved.revision
        if (mounted.current) {
          setLastSaved(saved)
        }
        if (batch.draft === draft) {
          pending.current = null
          if (mounted.current) {
            setOverride(null)
            setSave({ kind: 'saved' })
          }
        }
        return true
      } catch (error) {
        const reason = describeError(error)
        console.error('[@dsh-plugin/dsh-subagent-intro] 配置写入失败', error)
        if (mounted.current) {
          try {
            const latest = await client.read(CONFIG_ID)
            if (mounted.current) {
              setLastSaved(latest)
            }
          } catch (readError) {
            console.error('[@dsh-plugin/dsh-subagent-intro] 重新读取配置失败', readError)
          }
        }
        // 这一批编辑基于同一份配置，后续写入继承失败结果，防止覆盖其他页面的修改。
        cancelTimer()
        pending.current = null
        if (mounted.current) {
          setOverride(null)
          setSave({ kind: 'failed', reason })
        }
        return false
      }
    })
    writes.current = write
    return write
  }, [cancelTimer, client])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (timer.current !== null) {
        void commit()
      }
    }
  }, [commit])

  const edit = (change: (draft: Draft) => Draft): void => {
    const batch = pending.current ?? { revision: current.revision, draft: view }
    batch.draft = change(batch.draft)
    pending.current = batch
    setOverride(batch.draft)
  }

  const update = (change: (draft: Draft) => Draft, immediate = false): void => {
    edit(change)
    if (immediate) {
      void commit()
    } else {
      cancelTimer()
      timer.current = window.setTimeout(() => { void commit() }, SAVE_DELAY)
    }
  }

  const updateIntro = (intro: string): void => {
    update(draft => ({ ...draft, intro }))
  }

  const updateModel = (index: number, field: keyof ModelDraft, text: string): void => {
    update(draft => ({
      ...draft,
      models: draft.models.map((model, at) => (at === index ? { ...model, [field]: text } : model)),
    }))
  }

  const pickModel = (index: number, picked: CatalogModel): void => {
    update(draft => ({
      ...draft,
      models: draft.models.map((model, at) => (at === index
        ? {
          ...model,
          model: picked.id,
          provider: picked.provider,
          name: model.name.trim() === '' ? picked.name : model.name,
        }
        : model)),
    }), true)
  }

  const addModel = (): void => {
    update(draft => ({ ...draft, models: [...draft.models, { ...EMPTY_MODEL }] }), true)
  }

  const removeModel = (index: number): void => {
    update(draft => ({ ...draft, models: draft.models.filter((_model, at) => at !== index) }), true)
  }

  const moveModel = (index: number, delta: number): void => {
    const target = index + delta
    if (target < 0 || target >= view.models.length) {
      return
    }
    update(draft => {
      const models = [...draft.models]
      const [moved] = models.splice(index, 1)
      models.splice(target, 0, moved)
      return { ...draft, models }
    }, true)
  }

  const updateToolName = (index: number, text: string): void => {
    update(draft => ({
      ...draft,
      toolNames: draft.toolNames.map((toolName, at) => (at === index ? text : toolName)),
    }))
  }

  const addToolName = (): void => {
    update(draft => ({ ...draft, toolNames: [...draft.toolNames, ''] }), true)
  }

  const removeToolName = (index: number): void => {
    update(draft => ({ ...draft, toolNames: draft.toolNames.filter((_toolName, at) => at !== index) }), true)
  }

  const toggleAnnounce = (announce: boolean): void => {
    update(draft => ({ ...draft, announce }), true)
  }

  const exportText = (): string => serializePortable(view, new Date().toISOString())

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

  const applyImport = async (): Promise<void> => {
    if (staged === null || applying) {
      return
    }
    edit(() => toDraft(staged.config))
    setApplying(true)
    const accepted = await commit()
    if (mounted.current) {
      setApplying(false)
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
        <p style={introStyle}>修改会自动保存到当前 profile。下一轮请求使用更新后的子代理介绍。</p>
      </div>

      <SaveStatus state={save} />

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
