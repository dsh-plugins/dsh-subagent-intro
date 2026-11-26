import type { Context } from '@deepseek-ai/cordis';
import type { HostAPI } from '@dsh-plugin/dsh-loader';
import type { ResolvedConfig } from './config.js';
/** 注册 JSON 存储，并在宿主释放升级事务的文件锁后迁移旧配置。 */
export declare function registerSettings(ctx: Context & {
    dshLoader: HostAPI;
}, legacy: ResolvedConfig): Promise<() => ResolvedConfig>;
