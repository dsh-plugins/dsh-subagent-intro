/** 清理后的补丁和同一份文件中的旧配置。 */
export interface LegacyPatch {
    readonly text: string;
    readonly config: unknown;
    readonly computed: boolean;
}
/** 清理已迁移的 profile 配置字段，保留同一份补丁中的其他设置。 */
export declare function removeLegacyConfig(text: string): LegacyPatch | undefined;
