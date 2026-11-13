import type { ModelIntro, ResolvedConfig } from './config.js';
/**
 * 一条条目是否可渲染。
 *
 * 设置页新增条目时先写入占位对象，用户填空前必填字段是空串。这类条目不能
 * 进入提示词，否则会输出空白的能力/场景/时机块。
 * @param model - 待检查的条目。
 * @returns 必填字段全部非空时为 true。
 */
export declare function isRenderableModel(model: ModelIntro): boolean;
/**
 * 渲染子代理模型介绍段落。
 *
 * @param config - 已补齐默认值的配置，条目按原顺序输出。
 * @param visibleTools - 当前作用域可见的子代理创建工具名。
 * @returns 段落完整文本；作用域无子代理创建工具或无介绍内容时返回空串。
 */
export declare function renderIntroText(config: ResolvedConfig, visibleTools: readonly string[]): string;
