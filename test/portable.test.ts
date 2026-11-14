import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PortableConfig } from '../src/portable.ts'
import { DEFAULT_TOOL_NAMES, parsePortable, serializePortable } from '../src/portable.ts'

const EXPORTED_AT = '2026-11-14T09:30:00.000Z'

function config(overrides: Partial<PortableConfig> = {}): PortableConfig {
  return {
    toolNames: ['subagent', 'subagent_fork'],
    intro: '先看能力与适用时机，再选择模型。',
    announce: true,
    models: [
      {
        model: 'deepseek-flash',
        provider: 'mclans-deepseek',
        name: '快速模型',
        ability: '单文件修改与批量改写。',
        scenario: '小步改动、配置调整。',
        timing: '改动边界清晰时。',
      },
      {
        model: 'k3-256k',
        ability: '长上下文检索。',
        scenario: '整仓梳理。',
        timing: '需要通读大量文件时。',
      },
    ],
    ...overrides,
  }
}

/** 解析成功时取回配置，失败时直接把错误抛出来。 */
function parsed(text: string): PortableConfig {
  const result = parsePortable(text)
  if (!result.ok) throw new Error(result.error)
  return result.config
}

/** 解析失败时的错误说明。 */
function errorOf(text: string): string {
  const result = parsePortable(text)
  if (result.ok) throw new Error('期望解析失败，实际成功')
  return result.error
}

test('导出后再导入得到等价配置', () => {
  assert.deepEqual(parsed(serializePortable(config(), EXPORTED_AT)), config())
})

test('导出文档保留调用方给出的导出时刻', () => {
  const document = JSON.parse(serializePortable(config(), EXPORTED_AT)) as Record<string, unknown>
  assert.equal(document.exportedAt, EXPORTED_AT)
})

test('导出的条目省略空的 name 与 provider', () => {
  const document = JSON.parse(serializePortable(config(), EXPORTED_AT)) as {
    config: { models: Record<string, unknown>[] }
  }
  const [first, second] = document.config.models
  assert.ok(first !== undefined && second !== undefined)
  assert.ok('provider' in first && 'name' in first)
  assert.ok(!('provider' in second) && !('name' in second))
})

test('全空白的 name 与 provider 按未填写省略', () => {
  const document = JSON.parse(serializePortable(config({
    models: [{ model: 'a', provider: '  ', name: '\t', ability: 'b', scenario: 'c', timing: 'd' }],
  }), EXPORTED_AT)) as { config: { models: Record<string, unknown>[] } }
  const entry = document.config.models[0] ?? {}
  assert.ok(!('provider' in entry) && !('name' in entry))
})

test('带首尾空白的字段值原样往返，不会被导出裁剪', () => {
  const text = serializePortable(config({
    models: [{ model: 'a', provider: ' mclans-deepseek ', name: ' 甲 ', ability: 'b', scenario: 'c', timing: 'd' }],
  }), EXPORTED_AT)
  const [model] = parsed(text).models
  assert.equal(model?.provider, ' mclans-deepseek ')
  assert.equal(model?.name, ' 甲 ')
})

test('裸配置缺失字段取默认值', () => {
  assert.deepEqual(parsed('{"models": []}'), {
    toolNames: [...DEFAULT_TOOL_NAMES],
    intro: '',
    announce: true,
    models: [],
  })
})

test('导入时空的 name 与 provider 视为未填写', () => {
  const text = JSON.stringify({
    models: [{ model: 'a', name: '', provider: '', ability: 'b', scenario: 'c', timing: 'd' }],
  })
  assert.deepEqual(parsed(text).models, [{ model: 'a', ability: 'b', scenario: 'c', timing: 'd' }])
})

test('文件开头的 BOM 不影响解析', () => {
  assert.equal(parsed(`\uFEFF${serializePortable(config(), EXPORTED_AT)}`).models.length, 2)
})

test('JSON 不合法时给出语法错误', () => {
  assert.match(errorOf('{ models: [] }'), /不是合法的 JSON/)
})

test('根节点不是对象时报错', () => {
  assert.match(errorOf('[]'), /根节点必须是对象/)
})

test('空对象不当作合法输入', () => {
  assert.match(errorOf('{}'), /至少要包含/)
})

test('文档外壳拒绝其他插件的配置', () => {
  assert.match(errorOf(JSON.stringify({ plugin: '@dsh-plugin/other', version: 1, config: {} })), /不是 @dsh-plugin\/dsh-subagent-intro/)
})

test('文档外壳拒绝不支持的版本', () => {
  assert.match(errorOf(JSON.stringify({ plugin: '@dsh-plugin/dsh-subagent-intro', version: 2, config: {} })), /不受支持/)
})

test('文档外壳缺少 plugin 或 version 时报错', () => {
  assert.match(errorOf('{"config": {}}'), /"plugin".*缺失/)
  assert.match(errorOf(JSON.stringify({ plugin: '@dsh-plugin/dsh-subagent-intro', config: {} })), /"version".*缺失/)
})

test('文档外壳的 config 不是对象时报错', () => {
  assert.match(errorOf(JSON.stringify({ plugin: '@dsh-plugin/dsh-subagent-intro', version: 1, config: [] })), /"config" 必须是对象/)
})

test('配置主体拒绝未知字段', () => {
  assert.match(errorOf('{"models": [], "extra": 1}'), /未知字段 "extra"/)
})

test('裸对象里的外壳键按未知字段报告', () => {
  assert.match(errorOf('{"models": [], "version": 1}'), /未知字段 "version"/)
})

test('工具名必须是字符串数组', () => {
  assert.match(errorOf('{"toolNames": "subagent"}'), /"toolNames" 必须是字符串数组/)
  assert.match(errorOf('{"toolNames": ["subagent", 7]}'), /"toolNames\[1\]" 必须是字符串/)
})

test('模型条目的未知字段报错并指出下标', () => {
  const text = JSON.stringify({ models: [{ model: 'a', ability: 'b', scenario: 'c', timing: 'd', abilty: 'e' }] })
  assert.match(errorOf(text), /"models\[0\]".*未知字段 "abilty"/)
})

test('模型条目缺少必填字段时报错并指出路径', () => {
  const text = JSON.stringify({ models: [{ model: 'a', ability: 'b', timing: 'd' }] })
  assert.match(errorOf(text), /"models\[0\]\.scenario" 必须是字符串/)
})

test('布尔与数字类型不符时报错', () => {
  assert.match(errorOf('{"announce": "true"}'), /"announce" 必须是布尔值/)
  assert.match(errorOf(JSON.stringify({ plugin: '@dsh-plugin/dsh-subagent-intro', version: '1', config: {} })), /"version" 必须是数字/)
})
