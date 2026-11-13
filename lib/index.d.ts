import type { Context } from '@deepseek-ai/cordis';
import { Config } from './config.js';
export { Config } from './config.js';
/** 插件名，与 package.json 的 name 一致。 */
export declare const name = "dsh-subagent-intro";
export declare const inject: string[];
export declare function apply(ctx: Context, config: Config): void;
