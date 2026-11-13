/** 适用声明头：历史记录中的旧段落在本会话内不再有效。 */
const ANNOUNCE = '以下子代理模型介绍仅适用于当前会话配置。历史记录中的旧版介绍以本段为准。';
/** 路由声明尾行：配置描述只是线索，运行时以工具结果为准。 */
const ROUTING_NOTE = '实际可选路由以 `list_subagent_models` 工具结果为准；该工具不可用时以子代理工具描述为准。';
/**
 * 一条条目是否可渲染。
 *
 * 设置页新增条目时先写入占位对象，用户填空前必填字段是空串。这类条目不能
 * 进入提示词，否则会输出空白的能力/场景/时机块。
 * @param model - 待检查的条目。
 * @returns 必填字段全部非空时为 true。
 */
export function isRenderableModel(model) {
    return model.model.trim() !== ''
        && model.ability.trim() !== ''
        && model.scenario.trim() !== ''
        && model.timing.trim() !== '';
}
/**
 * 渲染子代理模型介绍段落。
 *
 * @param config - 已补齐默认值的配置，条目按原顺序输出。
 * @param visibleTools - 当前作用域可见的子代理创建工具名。
 * @returns 段落完整文本；作用域无子代理创建工具或无介绍内容时返回空串。
 */
export function renderIntroText(config, visibleTools) {
    if (visibleTools.length === 0)
        return '';
    const intro = config.intro.trim();
    const models = config.models.filter(isRenderableModel);
    if (intro === '' && models.length === 0)
        return '';
    const blocks = [];
    if (config.announce)
        blocks.push(ANNOUNCE);
    if (intro !== '')
        blocks.push(intro);
    for (const model of models)
        blocks.push(renderModel(model));
    blocks.push(ROUTING_NOTE);
    return blocks.join('\n\n');
}
/** 渲染单条模型介绍：首行给出展示名与路由标识，后三行是固定字段。 */
function renderModel(model) {
    const name = model.name?.trim() ?? '';
    const provider = model.provider?.trim() ?? '';
    const head = provider === ''
        ? `- ${name === '' ? model.model : name}（${model.model}）`
        : `- ${name === '' ? model.model : name}（${model.model}，provider: ${provider}）`;
    return [
        head,
        `  能力：${model.ability.trim()}`,
        `  场景：${model.scenario.trim()}`,
        `  适用时机：${model.timing.trim()}`,
    ].join('\n');
}
