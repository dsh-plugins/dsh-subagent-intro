import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import type { ModelIntro, ResolvedConfig } from '../src/config.ts'
import { isRenderableModel, renderIntroText } from '../src/render.ts'

const ANNOUNCE = '以下子代理模型介绍仅适用于当前会话配置。历史记录中的旧版介绍以本段为准。'
const ROUTING_NOTE = '实际可选路由以 `list_subagent_models` 工具结果为准；该工具不可用时以子代理工具描述为准。'

function resolved(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return { toolNames: ['subagent'], announce: true, intro: '', models: [], ...overrides }
}

function model(overrides: Partial<ModelIntro> = {}): ModelIntro {
  return {
    model: 'deep-reasoner',
    ability: '复杂设计与跨模块审查',
    scenario: '跨模块重构',
    timing: '需要深度推理时',
    ...overrides,
  }
}

test('作用域内没有子代理创建工具时返回空串', () => {
  assert.equal(renderIntroText(resolved({ intro: '总述' }), []), '')
})

test('introduction 与 models 同时为空时返回空串', () => {
  assert.equal(renderIntroText(resolved(), ['subagent']), '')
})

test('intro 只有空白字符视为空', () => {
  assert.equal(renderIntroText(resolved({ intro: '  \n\t ' }), ['subagent']), '')
})

test('announce 开启时首行输出适用声明并空一行', () => {
  const text = renderIntroText(resolved({ intro: '仅此一段' }), ['subagent'])
  assert.equal(text, [ANNOUNCE, '', '仅此一段', '', ROUTING_NOTE].join('\n'))
})

test('announce 关闭时不输出适用声明', () => {
  const text = renderIntroText(resolved({ announce: false, intro: '仅此一段' }), ['subagent'])
  assert.equal(text, ['仅此一段', '', ROUTING_NOTE].join('\n'))
})

test('intro 去掉首尾空白后输出', () => {
  const text = renderIntroText(resolved({ announce: false, intro: '\n  总述  \n' }), ['subagent'])
  assert.equal(text, ['总述', '', ROUTING_NOTE].join('\n'))
})

test('name 缺省时首行使用模型 id', () => {
  const text = renderIntroText(resolved({ announce: false, models: [model()] }), ['subagent'])
  assert.equal(text, [
    '- deep-reasoner（deep-reasoner）',
    '  能力：复杂设计与跨模块审查',
    '  场景：跨模块重构',
    '  适用时机：需要深度推理时',
    '',
    ROUTING_NOTE,
  ].join('\n'))
})

test('name 显式给出时首行使用展示名', () => {
  const text = renderIntroText(resolved({ announce: false, models: [model({ name: '深思模型' })] }), ['subagent'])
  assert.match(text, /^- 深思模型（deep-reasoner）$/m)
})

test('provider 存在时首行附带 provider', () => {
  const text = renderIntroText(resolved({ announce: false, models: [model({ provider: 'mclans' })] }), ['subagent'])
  assert.match(text, /^- deep-reasoner（deep-reasoner，provider: mclans）$/m)
})

test('provider 只有空白字符时视为未配置', () => {
  const text = renderIntroText(resolved({ announce: false, models: [model({ provider: '  ' })] }), ['subagent'])
  assert.match(text, /^- deep-reasoner（deep-reasoner）$/m)
})

test('多模型按配置顺序输出，条目之间空一行', () => {
  const text = renderIntroText(resolved({
    intro: '这些模型各有分工。',
    models: [
      model({
        model: 'mclans/fast',
        name: '快速模型',
        provider: 'mclans',
        ability: '快速小步改动',
        scenario: '单文件修改',
        timing: '需要快速反馈时',
      }),
      model(),
    ],
  }), ['subagent', 'subagent_fork'])
  assert.equal(text, [
    ANNOUNCE,
    '',
    '这些模型各有分工。',
    '',
    '- 快速模型（mclans/fast，provider: mclans）',
    '  能力：快速小步改动',
    '  场景：单文件修改',
    '  适用时机：需要快速反馈时',
    '',
    '- deep-reasoner（deep-reasoner）',
    '  能力：复杂设计与跨模块审查',
    '  场景：跨模块重构',
    '  适用时机：需要深度推理时',
    '',
    ROUTING_NOTE,
  ].join('\n'))
})

test('仅有模型条目而无总述时，声明头之后直接输出条目', () => {
  const text = renderIntroText(resolved({ models: [model()] }), ['subagent'])
  assert.equal(text.split('\n\n')[0], ANNOUNCE)
  assert.match(text, /\n\n- deep-reasoner（deep-reasoner）\n/)
})

describe('isRenderableModel 与不完整条目的过滤', () => {
  const base = { model: 'm', ability: 'a', scenario: 's', timing: 't' }

  test('必填字段全非空时可渲染', () => {
    assert.equal(isRenderableModel(base), true)
  })

  test('任一必填字段为空白时不可渲染', () => {
    for (const field of ['model', 'ability', 'scenario', 'timing'] as const) {
      assert.equal(isRenderableModel({ ...base, [field]: '   ' }), false, `${field} 空白应不可渲染`)
    }
  })

  test('只有不完整条目时不注入段落', () => {
    const text = renderIntroText({
      toolNames: ['subagent'],
      announce: true,
      intro: '',
      models: [{ model: '', ability: '', scenario: '', timing: '' }],
    }, ['subagent'])
    assert.equal(text, '')
  })

  test('不完整条目被跳过，完整条目照常输出', () => {
    const text = renderIntroText({
      toolNames: ['subagent'],
      announce: false,
      intro: '',
      models: [{ model: '', ability: '', scenario: '', timing: '' }, base],
    }, ['subagent'])
    assert.match(text, /- m（m）/)
    assert.equal(text.split('\n').filter(line => line.startsWith('- ')).length, 1)
  })
})
