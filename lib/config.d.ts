import type { Volatile } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
/** 一条子代理模型的介绍条目，全部由用户配置提供。 */
export interface ModelIntro {
    /** 模型 id，与 `list_subagent_models` 返回的 id 一致。 */
    model: string;
    /** 展示名，缺省取 {@link ModelIntro.model}。 */
    name?: string;
    /** provider id，缺省表示不区分 provider。 */
    provider?: string;
    /** 该模型擅长的能力。 */
    ability: string;
    /** 该模型的适用场景。 */
    scenario: string;
    /** 该模型的适用时机。 */
    timing: string;
}
/** 补齐默认值后的配置，渲染与判定共用同一份。 */
export interface ResolvedConfig {
    readonly toolNames: readonly string[];
    readonly announce: boolean;
    readonly intro: string;
    readonly models: readonly ModelIntro[];
}
/**
 * 升级前的 Cordis YAML 配置，供迁移读取。
 *
 * 保留 volatile 包装，便于在清理旧配置时让宿主原地更新条目。
 */
export interface Config {
    /** 判定“当前作用域拥有子代理创建工具”的工具名，默认 `['subagent', 'subagent_fork']`。 */
    toolNames?: Volatile<string[]>;
    /** 段首总述。 */
    intro?: Volatile<string>;
    /** 模型介绍条目，按配置顺序输出。 */
    models?: Volatile<ModelIntro[]>;
    /** 是否输出适用声明头，默认 `true`。 */
    announce?: Volatile<boolean>;
}
/**
 * 配置 schema。
 *
 * 这里需要一次断言：`.volatile()` 只写进运行时元数据，schemastery 的静态类型仍按
 * 裸值推导，与接口里的 {@link Volatile} 包装不同。不加断言时无法生成可移植的声明文件。
 */
export declare const Config: z<Config>;
/**
 * 把可缺省配置补齐为固定形状。
 *
 * @param config - 插件配置；volatile 字段取当前值。
 * @returns 渲染与判定共用的固定形状配置。
 */
export declare function resolveConfig(config: Config): ResolvedConfig;
