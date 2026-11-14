import z from '@deepseek-ai/schemastery';
import { DEFAULT_TOOL_NAMES } from './portable.js';
/**
 * 配置 schema。
 *
 * 这里需要一次断言：`.volatile()` 只写进运行时元数据，schemastery 的静态类型仍按
 * 裸值推导，与接口里的 {@link Volatile} 包装不同。不加断言时无法生成可移植的声明文件。
 */
export const Config = z.object({
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
});
/**
 * 把可缺省配置补齐为固定形状。
 *
 * 每次装配重新调用，因此设置页写入的值在下一轮请求即生效，无需重启。
 * @param config - 插件配置；volatile 字段取当前值。
 * @returns 渲染与判定共用的固定形状配置。
 */
export function resolveConfig(config) {
    return {
        toolNames: config.toolNames?.get() ?? DEFAULT_TOOL_NAMES,
        announce: config.announce?.get() ?? true,
        intro: config.intro?.get() ?? '',
        models: config.models?.get() ?? [],
    };
}
