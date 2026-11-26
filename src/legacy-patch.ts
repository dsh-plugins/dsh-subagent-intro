import { isAlias, isMap, isNode, isScalar, isSeq, parseDocument, visit } from 'yaml'
import type { YAMLMap } from 'yaml'

const PLUGIN_ID = 'subagent-intro'
const PACKAGE_NAME = '@dsh-plugin/dsh-subagent-intro'
const EXPRESSION_TAG = 'tag:yaml.org,2002:js'

/** 清理后的补丁和同一份文件中的旧配置。 */
export interface LegacyPatch {
  readonly text: string
  readonly config: unknown
  readonly computed: boolean
}

function joinComments(...comments: (string | null | undefined)[]): string | null {
  return comments.filter(Boolean).join('\n') || null
}

/** 清理已迁移的 profile 配置字段，保留同一份补丁中的其他设置。 */
export function removeLegacyConfig(text: string): LegacyPatch | undefined {
  const document = parseDocument(text, {
    customTags: [{ tag: EXPRESSION_TAG, resolve: (source: string) => source }],
  })
  if (document.errors.length > 0) {
    throw document.errors[0]
  }
  const rows = document.contents
  if (!isSeq(rows)) {
    throw new Error('配置档的 YAML 补丁必须是顶层序列')
  }

  let changed = false
  let config: unknown
  let computed = false
  let pendingComment: string | null = null
  rows.items = rows.items.filter((row) => {
    const mapping: YAMLMap | undefined = isMap(row) ? row : undefined
    if (!mapping && !(isAlias(row) && isMap(row.resolve(document)))) {
      throw new Error('配置档的 YAML 补丁条目必须是映射')
    }
    if (mapping?.get('id') === PLUGIN_ID && !mapping.has('insert')
      && (!mapping.has('name') || mapping.get('name') === PACKAGE_NAME)) {
      const index = mapping.items.findIndex(({ key }) => isScalar(key) && key.value === 'config')
      if (index >= 0) {
        changed = true
        const value = mapping.items[index]?.value
        computed = false
        if (isNode(value)) {
          visit(value, (_key, node) => {
            if (isAlias(node) || ((isScalar(node) || isMap(node) || isSeq(node)) && node.tag === EXPRESSION_TAG)) {
              computed = true
              return visit.BREAK
            }
          })
        }
        config = isNode(value) && !computed ? value.toJS(document) : undefined
        const [removed] = mapping.items.splice(index, 1)
        if (mapping.items.length === 1 + Number(mapping.has('name'))) {
          pendingComment = joinComments(pendingComment, mapping.commentBefore, mapping.comment)
          return false
        }
        const nextKey = mapping.items[index]?.key
        if (isNode(removed?.key) && removed.key.commentBefore) {
          if (isNode(nextKey)) {
            nextKey.commentBefore = joinComments(removed.key.commentBefore, nextKey.commentBefore)
          } else {
            mapping.comment = joinComments(removed.key.commentBefore, mapping.comment)
          }
        }
      }
    }
    if (pendingComment) {
      row.commentBefore = joinComments(pendingComment, row.commentBefore)
      pendingComment = null
    }
    return true
  })
  if (!changed) {
    return undefined
  }
  if (pendingComment) {
    document.comment = joinComments(pendingComment, document.comment)
  }

  const eol = text.match(/\r?\n/)?.[0] ?? '\n'
  const yaml = document.toString().replaceAll('\n', eol)
  const bom = text.startsWith('\uFEFF') ? '\uFEFF' : ''
  return { text: bom + (text.endsWith('\n') ? yaml : yaml.slice(0, -eol.length)), config, computed }
}
