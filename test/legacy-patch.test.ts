import assert from 'node:assert/strict'
import { test } from 'node:test'
import { removeLegacyConfig } from '../src/legacy-patch.ts'

test('删除旧 Web 保存条目并保留相邻条目的注释和表达式', () => {
  const text = [
    '# 配置档的补丁',
    '- id: subagent-intro',
    '  name: "@dsh-plugin/dsh-subagent-intro"',
    '  config:',
    '    models: [{ model: example }]',
    '# 其他插件',
    '- id: example',
    '  config: !!js getConfiguration()',
    '',
  ].join('\r\n')
  const patch = removeLegacyConfig(text)
  assert.deepEqual(patch?.config, { models: [{ model: 'example' }] })
  assert.equal(patch?.text, [
    '# 配置档的补丁',
    '# 其他插件',
    '- id: example',
    '  config: !!js getConfiguration()',
    '',
  ].join('\r\n'))
})

test('清理空配置并保留禁用状态、其他包和插入行', () => {
  const text = [
    '- id: subagent-intro',
    '  name: "@dsh-plugin/dsh-subagent-intro"',
    '  disabled: true',
    '  config: {}',
    '- id: subagent-intro',
    '  name: "@example/other"',
    '  config: { untouched: true }',
    '- id: subagent-intro',
    '  insert:',
    '    - id: other',
    '  config: { untouched: true }',
  ].join('\n')
  assert.equal(removeLegacyConfig(text)?.text, text.replace('  config: {}\n', ''))
})

test('忽略没有 config 的目标条目及其他位置的同名条目', () => {
  assert.equal(removeLegacyConfig([
    '- id: subagent-intro',
    '  disabled: true',
    '- insert:',
    '    - id: subagent-intro',
    '      config: {}',
  ].join('\n')), undefined)
})

test('清理最后一条配置后仍留下补丁序列', () => {
  assert.equal(removeLegacyConfig('- id: subagent-intro\n  config: {}\n')?.text, '[]\n')
})

test('标记需要宿主求值的配置', () => {
  const patch = removeLegacyConfig('- id: subagent-intro\n  config: { intro: !!js makeIntro() }\n')
  assert.deepEqual(patch, { text: '[]\n', config: undefined, computed: true })
})

test('拒绝语法损坏或结构无效的补丁', () => {
  assert.throws(() => removeLegacyConfig('- id: subagent-intro\n  config: [\n'))
  assert.throws(() => removeLegacyConfig('id: subagent-intro\nconfig: {}\n'), /顶层序列/)
  assert.throws(() => removeLegacyConfig('- invalid\n'), /条目必须是映射/)
})

test('清理会使其他条目的 YAML 别名失效时拒绝生成补丁', () => {
  assert.throws(() => removeLegacyConfig([
    '- id: subagent-intro',
    '  config: &example { intro: hello }',
    '- id: other',
    '  config: *example',
  ].join('\n')), /Unresolved alias/)
})
