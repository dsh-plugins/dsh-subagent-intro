import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { defineConfig } from '@dsh-plugin/dsh-loader/config';
import { resolveConfig } from './config.js';
import { removeLegacyConfig } from './legacy-patch.js';
import { parsePortable, PORTABLE_PLUGIN, PORTABLE_VERSION } from './portable.js';
const CONFIG_ID = 'dsh-subagent-intro';
function initialValues(config) {
    return {
        ...config,
        toolNames: [...config.toolNames],
        models: config.models.map(({ name, provider, ...model }) => ({
            ...model,
            name: name ?? '',
            provider: provider ?? '',
        })),
    };
}
function createTemplate(initial) {
    return defineConfig({
        id: CONFIG_ID,
        packageName: PORTABLE_PLUGIN,
        title: '子代理介绍',
        fields: [
            {
                type: 'array', key: 'toolNames', label: '工具名', hidden: true,
                default: initial.toolNames, item: { type: 'text', label: '工具名' },
            },
            { type: 'textarea', key: 'intro', label: '总述', default: initial.intro, hidden: true },
            { type: 'boolean', key: 'announce', label: '适用声明头', default: initial.announce, hidden: true },
            {
                type: 'array', key: 'models', label: '模型介绍', hidden: true, default: initial.models,
                item: {
                    type: 'object', label: '模型', fields: [
                        { type: 'text', key: 'model', label: '模型 ID' },
                        { type: 'text', key: 'provider', label: 'Provider' },
                        { type: 'text', key: 'name', label: '展示名' },
                        { type: 'textarea', key: 'ability', label: '能力' },
                        { type: 'textarea', key: 'scenario', label: '场景' },
                        { type: 'textarea', key: 'timing', label: '适用时机' },
                    ],
                },
            },
        ],
        panels: [{ id: 'editor', title: '编辑配置', custom: true, fields: [], operations: [] }],
    });
}
async function readIfPresent(path) {
    try {
        return await readFile(path, 'utf8');
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return undefined;
        }
        throw error;
    }
}
async function cleanLegacyPatch(profile, path, patchPath, before, cleaned, handle) {
    await profile.withPackageLock(async () => {
        // 只在当前 profile 中确实存在目标配置时清理旧文件。
        const disk = JSON.parse(await readFile(path, 'utf8'));
        const saved = handle.get();
        if (disk.formatVersion !== 1 || disk.revision !== saved.revision || !isDeepStrictEqual(disk.value, saved.value)) {
            throw new Error('当前配置档中的 JSON 与已保存配置不一致');
        }
        if (await readIfPresent(patchPath) !== before) {
            throw new Error('迁移期间 YAML 配置发生变化');
        }
        await profile.writeFileAtomic(patchPath, cleaned, { mode: 0o600 });
    });
}
/** 注册 JSON 存储，并在宿主释放升级事务的文件锁后迁移旧配置。 */
export async function registerSettings(ctx, legacy) {
    const loader = ctx.dshLoader;
    const profile = loader.profile;
    const directory = profile.directory;
    const path = join(directory, 'config', CONFIG_ID, 'config.json');
    const patchPath = join(directory, 'cordis.patch.yml');
    const defaults = resolveConfig({});
    const hasSavedFile = await readIfPresent(path) !== undefined;
    let before;
    let cleaned;
    try {
        before = await readIfPresent(patchPath);
        if (before !== undefined) {
            const patch = removeLegacyConfig(before);
            if (patch !== undefined) {
                if (!hasSavedFile && !patch.computed) {
                    const parsed = parsePortable(JSON.stringify({
                        plugin: PORTABLE_PLUGIN, version: PORTABLE_VERSION, config: patch.config ?? {},
                    }));
                    if (!parsed.ok) {
                        throw new Error(parsed.error);
                    }
                    legacy = parsed.config;
                }
                cleaned = patch.text;
            }
        }
    }
    catch (error) {
        ctx.logger.error('subagent-intro: 无法读取待迁移的 YAML 配置', error);
    }
    // 注册会向 Web 发布首份快照，迁移期间的编辑也必须从旧配置开始。
    const initial = initialValues(hasSavedFile ? defaults : legacy);
    const handle = await loader.config.register({ effect: register => ctx.effect(() => register() ?? []) }, createTemplate(initial));
    if (!hasSavedFile && handle.get().revision === 0
        && (cleaned !== undefined || !isDeepStrictEqual(legacy, defaults))) {
        try {
            await handle.update(initial, 0);
        }
        catch (error) {
            ctx.logger.error('subagent-intro: 无法将旧配置迁移到 JSON', error);
        }
    }
    let saved = handle.get();
    handle.watch(snapshot => { saved = snapshot; });
    if (before !== undefined && cleaned !== undefined && (hasSavedFile || saved.revision > 0)) {
        const originalPatch = before;
        const cleanedPatch = cleaned;
        ctx.effect(() => {
            const pending = setImmediate(() => {
                void cleanLegacyPatch(profile, path, patchPath, originalPatch, cleanedPatch, handle).catch((error) => {
                    ctx.logger.error('subagent-intro: 无法清理旧 YAML 配置', error);
                });
            });
            return () => clearImmediate(pending);
        }, 'subagent-intro:config-migration');
    }
    return () => saved.value;
}
