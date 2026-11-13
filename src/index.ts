import type { Context } from '@deepseek-ai/cordis'
import { Config, resolveConfig } from './config.js'
import type { AssembleContext, PreStepDecision, PreStepPayload, SessionLike } from './host.js'
import { renderIntroText } from './render.js'

export { Config } from './config.js'

/** 插件名，与 package.json 的 name 一致。 */
export const name = '@dsh-plugin/dsh-subagent-intro'

/** 位于宿主 TOOL_SUBAGENT(2800) 段落之前，紧邻子代理工具说明。 */
const SECTION_ORDER = 2790

export const inject = ['systemPrompt', 'tools']

/**
 * 判断会话当前生效的系统提示词是否已经包含本段贡献。
 *
 * 首次进入某会话时以空串为基线即可覆盖历史残留，但"内存基线缺失"也可能来自
 * 插件重装：期间宿主会用不含本插件段落的文本重写头部，此时盲目比较内存基线
 * 会漏掉修复。对照真实文本判断，避免每次重载都无条件重写头部。
 * @param session - 目标会话。
 * @param contribution - 本次应注入的完整文本。
 * @returns 生效的系统消息已包含该文本时为 true；contribution 为空串时恒为 true。
 */
function sessionShowsContribution(session: SessionLike, contribution: string): boolean {
  if (contribution === '') return true
  const nodes = session.surface.nodes
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const seq = nodes[index]
    if (seq === undefined) continue
    const event = session.eventAt(seq)
    if (event?.type !== 'system/message') continue
    const message = event.data as { message?: { content?: readonly { type?: unknown; text?: unknown }[] } } | undefined
    const text = (message?.message?.content ?? [])
      .map(block => (block.type === 'text' && typeof block.text === 'string' ? block.text : ''))
      .join('')
    if (text === '') continue
    return text.includes(contribution)
  }
  return false
}

export function apply(ctx: Context, config: Config): void {
  /**
   * 按作用域内可见的子代理创建工具渲染本段；section 与 pre-step 必须共用同一函数。
   *
   * 配置字段是 volatile，每次求值都读当前值，设置页写入后下一轮装配即生效。
   */
  const renderFor = (scope: unknown): string => {
    const resolved = resolveConfig(config)
    const visible = resolved.toolNames.filter(tool => ctx.tools.get(tool, scope) !== undefined)
    return renderIntroText(resolved, visible)
  }

  ctx.effect(() => ctx.systemPrompt.section({
    name: 'subagent:model-intro',
    order: SECTION_ORDER,
    interpolate: false,
    text: (context: AssembleContext) => renderFor(context.scope),
  }), 'subagent-intro:section')

  /**
   * 每个 session 上一次贡献的段落文本。
   * 首次遇到一个 session 时以空串为基线，使历史记录里残留的旧版介绍被一次头部替换清除；
   * 新会话在无系统节点时不会因此产生额外节点。
   */
  const contributions = new WeakMap<object, string>()

  ctx.effect(() => {
    const off = ctx.on('agent/pre-step', async (payload: PreStepPayload, next: () => Promise<PreStepDecision>) => {
      const decision = await next()
      if (decision.kind === 'reject') return decision
      const session = payload.agent.session
      const current = renderFor(payload.agent)
      const remembered = contributions.get(session)
      const previous = remembered ?? ''
      // 内存基线缺失时核验真实头部，避免插件重装后旧介绍留在历史里。
      const headStale = remembered === undefined && !sessionShowsContribution(session, current)
      if (current === previous && !headStale) return decision
      contributions.set(session, current)
      ctx.logger.debug(`subagent-intro: 第 ${payload.turn} 轮第 ${payload.step} 步的段落贡献变化，下一步替换头部系统提示词节点`)
      return { ...decision, startsRequestSeries: true as const }
    })
    return () => { off() }
  }, 'subagent-intro:series')
}
