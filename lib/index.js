import { Config, resolveConfig } from './config.js';
import { renderIntroText } from './render.js';
export { Config } from './config.js';
/** 插件名，与 package.json 的 name 一致。 */
export const name = '@dsh-plugin/dsh-subagent-intro';
/** 位于宿主 TOOL_SUBAGENT(2800) 段落之前，紧邻子代理工具说明。 */
const SECTION_ORDER = 2790;
export const inject = ['systemPrompt', 'tools'];
export function apply(ctx, config) {
    /**
     * 按作用域内可见的子代理创建工具渲染本段；section 与 pre-step 必须共用同一函数。
     *
     * 配置字段是 volatile，每次求值都读当前值，设置页写入后下一轮装配即生效。
     */
    const renderFor = (scope) => {
        const resolved = resolveConfig(config);
        const visible = resolved.toolNames.filter(tool => ctx.tools.get(tool, scope) !== undefined);
        return renderIntroText(resolved, visible);
    };
    ctx.effect(() => ctx.systemPrompt.section({
        name: 'subagent:model-intro',
        order: SECTION_ORDER,
        interpolate: false,
        text: (context) => renderFor(context.scope),
    }), 'subagent-intro:section');
    /**
     * 每个 session 上一次贡献的段落文本。
     * 首次遇到一个 session 时以空串为基线，使历史记录里残留的旧版介绍被一次头部替换清除；
     * 新会话在无系统节点时不会因此产生额外节点。
     */
    const contributions = new WeakMap();
    ctx.effect(() => {
        const off = ctx.on('agent/pre-step', async (payload, next) => {
            const decision = await next();
            if (decision.kind === 'reject')
                return decision;
            const session = payload.agent.session;
            const current = renderFor(payload.agent);
            const previous = contributions.get(session) ?? '';
            if (current === previous)
                return decision;
            contributions.set(session, current);
            ctx.logger.debug(`subagent-intro: 第 ${payload.turn} 轮第 ${payload.step} 步的段落贡献变化，下一步替换头部系统提示词节点`);
            return { ...decision, startsRequestSeries: true };
        });
        return () => { off(); };
    }, 'subagent-intro:series');
}
