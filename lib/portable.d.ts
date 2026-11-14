/**
 * 配置的可移植文档：导出文本、导入解析与缺省语义。
 *
 * 导出的文档同时是导入的合法输入，因此格式只有一份定义。解析器面向用户粘贴
 * 或选择的外部文件，任何不认识的字段、缺失的必填字段或类型不符都必须定位到
 * 具体路径后报错，不做静默丢弃——静默丢弃会让用户以为导入成功，实际少了条目。
 */
/** 文档所属插件，用于在导入时拒绝别的插件的配置。 */
export declare const PORTABLE_PLUGIN = "@dsh-plugin/dsh-subagent-intro";
/** 文档格式版本，仅在结构不兼容时递增。 */
export declare const PORTABLE_VERSION = 1;
/** 默认的子代理创建工具名；导入时缺失该字段即取此值，与 schema 默认值一致。 */
export declare const DEFAULT_TOOL_NAMES: readonly string[];
/** 可移植文档中的一条模型介绍；`name` 与 `provider` 留空时不落盘。 */
export interface PortableModel {
    /** 模型 id，与 `list_subagent_models` 返回的 id 一致。 */
    model: string;
    /** provider id，仅在与模型 id 一起用于路由说明时填写。 */
    provider?: string;
    /** 展示名，缺省取 {@link PortableModel.model}。 */
    name?: string;
    /** 该模型擅长的能力。 */
    ability: string;
    /** 该模型的适用场景。 */
    scenario: string;
    /** 该模型的适用时机。 */
    timing: string;
}
/** 可移植文档中的配置主体，四个字段全部落地，不含 undefined。 */
export interface PortableConfig {
    /** 判定拥有子代理创建工具的工具名。 */
    toolNames: string[];
    /** 段首总述，空串表示不输出。 */
    intro: string;
    /** 是否输出适用声明头。 */
    announce: boolean;
    /** 模型介绍条目，按原顺序输出。 */
    models: PortableModel[];
}
/** 解析结果：失败时带一条可直接展示给用户的说明。 */
export type PortableParseResult = {
    readonly ok: true;
    readonly config: PortableConfig;
} | {
    readonly ok: false;
    readonly error: string;
};
/**
 * 生成可导入的配置文档。
 *
 * @param config - 待导出的完整配置。
 * @param exportedAt - 导出时刻，由调用方提供以保证函数输出只取决于入参。
 * @returns 带两空格缩进的 JSON 文本，结尾带换行。
 */
export declare function serializePortable(config: PortableConfig, exportedAt: string): string;
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
export declare function parsePortable(text: string): PortableParseResult;
