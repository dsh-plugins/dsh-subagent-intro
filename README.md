# dsh-subagent-intro

在系统提示词中的子代理工具说明之前，注入一段可配置的「子代理模型介绍」，让模型在委派前就知道每个子代理模型擅长什么、适合在什么场景与时机使用。

## 功能

| 能力 | 说明 |
| --- | --- |
| 段落注入 | 在宿主 `TOOL_SUBAGENT`（order 2800）段落之前注册 `subagent:model-intro`（order 2790），紧邻子代理工具说明 |
| 总述 | `intro` 提供一段整体说明，留空则不输出 |
| 模型条目 | `models` 按配置顺序逐条输出展示名、模型 id、provider、能力、场景、适用时机 |
| 适用声明 | `announce` 控制段首声明「以下子代理模型介绍仅适用于当前会话配置。历史记录中的旧版介绍以本段为准。」 |
| 路由声明 | 段末固定输出「实际可选路由以 `list_subagent_models` 工具结果为准」 |
| 工具门控 | 仅当当前作用域可见 `toolNames` 中的任一子代理创建工具时才注入，否则整段为空 |
| 头部替换 | 段落文本在会话中途变化时，宿主以本步为新请求系列起点，替换头部系统提示词节点而非追加 |
| 空配置不注入 | `intro` 与 `models` 都未配置时整段为空，不产生任何提示词内容 |

## 安装

从 GitHub 源安装（已提交构建产物，无需授权构建脚本）：

```bash
dsh plugin --profile web add github:dsh-plugins/dsh-subagent-intro
```

也可以克隆后按本地目录安装：

```bash
git clone https://github.com/dsh-plugins/dsh-subagent-intro
dsh plugin --profile web add ./dsh-subagent-intro
```

或在 DSH Web 的「插件」管理页安装。

本地构建：

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

本插件是宿主端 Bundle 插件，安装后在下一轮请求生效；修改 `lib/index.js` 后需要重启 DSH 进程，Node.js 的 ESM 模块缓存不会因禁用再启用而重新读取磁盘代码。

## 在 Web 界面编辑

配置面板注册在两处，内容相同：

1. **插件详情页**：打开「插件」页，点开本插件（`dsh-subagent-intro`），描述下方即为配置区。这是最直接的入口。
2. **设置页**：「设置 → 插件 → 子代理介绍」分页。

可编辑全部字段：总述、模型条目（新增、删除、上下移）、工具名与适用声明头开关。输入后约 400ms 自动保存，页面顶部显示保存状态；写入被宿主拒绝或失败时会在页面上给出原因。

表单占满宿主提供的宽度，不设固定最大宽度。`model` 输入框旁的「选择」按钮会读取宿主已注册的模型目录，按名称或 id 过滤后点选，同时自动填入对应的 `provider`，并在 `name` 为空时补上目录里的展示名。目录不可用时该按钮禁用并提示原因，但仍可直接输入任意模型 id。能力、场景、适用时机三个字段是多行输入，各占整行。

四个字段都声明为 volatile，因此在设置页写改后**无需重启**，下一轮请求即生效。也可以继续用下面的补丁文件方式配置。

## 配置

补丁层按行 `id` 匹配并**整行替换** `config`（不做深合并），覆盖时需重述全部所需键：

```yaml
- id: subagent-intro
  config:
    toolNames:
      - subagent
      - subagent_fork
    announce: true
    intro: |
      可委派的子代理模型各有分工，先看下面的能力与适用时机，再选择模型。
    models:
      - model: mclans-deepseek/deepseek-flash
        name: 快速模型
        provider: mclans
        ability: 快速完成单文件修改、样板代码与格式调整。
        scenario: 小步改动、批量重命名、配置调整。
        timing: 需要快速反馈且改动边界清晰时。
      - model: deep-reasoner
        name: 深思模型
        ability: 跨模块设计、疑难缺陷定位与代码审查。
        scenario: 多文件重构、算法与协议设计。
        timing: 改动波及多个模块，或需要先做取舍判断时。
```

### 字段说明

| 字段 | 类型 | 必填 | 填写建议 |
| --- | --- | --- | --- |
| `toolNames` | `string[]` | 否 | 默认 `['subagent', 'subagent_fork']`。只有这些工具在当前作用域可见时才注入本段；无需修改 |
| `intro` | `string` | 否 | 一段总述，说明模型之间存在分工。保持简短，条目内容交给 `models` |
| `announce` | `boolean` | 否 | 默认 `true`。保留声明头可让模型忽略历史记录中的旧版介绍；仅当确定不需要覆盖历史说明时关闭 |
| `models[].model` | `string` | 是 | 模型 id，与 `list_subagent_models` 返回的 id 一致，模型会凭此选择路由 |
| `models[].name` | `string` | 否 | 展示名，缺省使用 `model`。建议用中文短名，便于模型在正文中引用 |
| `models[].provider` | `string` | 否 | provider id，填写后随模型 id 一起输出；仅当同名模型存在多个 provider 时需要 |
| `models[].ability` | `string` | 是 | 该模型擅长的能力，写清区别于其他模型的强项 |
| `models[].scenario` | `string` | 是 | 适用场景，描述任务类型与改动范围 |
| `models[].timing` | `string` | 是 | 适用时机，描述「什么时候该选它」的判断条件 |

`models` 的条目按配置顺序输出，不排序、不去重。`model`、`ability`、`scenario`、`timing` 缺失时，插件加载阶段会因 schema 校验失败而报错，不会静默丢弃条目。

## 注入位置

段落注册在宿主系统提示词的 `subagent:model-intro`（order 2790），位于子代理工具说明 `TOOL_SUBAGENT`（order 2800）之前、`TOOL_RALPH`（order 2700）之后。装配时宿主按 order 升序拼接并过滤空段落，因此未配置内容时不会留下空行。

## 中途变化替换头部

段落文本可能在会话中途变化（插件热重载、配置变化、子代理工具可见性变化）。实现方式：

- 按 `payload.agent.session` 记录上一次贡献的完整文本，记录表是 `apply` 内的 `WeakMap`，不跨插件实例共享。
- 首次遇到某个会话时以空串为基线，因此历史记录中残留的旧版介绍会被一次头部替换清除；新会话在没有系统节点时不会因此产生额外节点。
- `agent/pre-step` 中先用同一个渲染函数、同一份配置计算当前文本；与上次相同则原样返回 `next()` 的决定，不做任何替换。
- 文本变化时更新记录并返回 `{ ...decision, startsRequestSeries: true }`，宿主据此替换头部系统提示词节点并清空后续活动节点，而不是追加一条新的系统消息。宿主仅在本次请求的首次尝试采纳该标记。

## 与 `list_subagent_models` 的关系

本插件只提供静态介绍，不注册工具、不查询模型目录、不改变实际可选路由。模型真正的可选路由以 `list_subagent_models` 工具的返回结果为准，因此段末固定输出该声明；该工具不可用时，以子代理工具自身的描述为准。配置里写错的模型 id 不会导致插件加载失败，但模型会按工具结果纠正选择。

## 未配置时的行为

- `intro` 未配置或只有空白，且 `models` 为空：整段渲染为空串，不注入任何内容。
- `toolNames` 中的工具在当前作用域全部不可见（例如子代理工具未注册、或当前深度不允许继续委派）：同样不注入。
- 段落为空时 `subagents` 相关提示词仍由宿主原有的工具说明与上下文提供，本插件不产生副作用。

## 实现说明

- 段落通过 `ctx.systemPrompt.section({ interpolate: false })` 注册，`interpolate: false` 避免介绍正文中的 `{{` 被当作提示词变量。
- 注册与 `agent/pre-step` 监听都放在 `ctx.effect(..., '<plugin>:<label>')` 内，插件卸载或热重载时完整回收，不留监听残留。
- 渲染与可见性判定共用同一个 `renderFor` 闭包，保证 section 与 pre-step 计算的文本完全一致。
- 纯函数 `renderIntroText` 由 `test/render.test.ts` 覆盖固定文本格式；section 注册、工具可见性查询与事件监听不做单测，交由运行时暴露问题。

## 已知限制

- 模型条目只支持单个模型 id，不支持通配或多路由合并描述。
- `provider` 仅作为展示文本的一部分输出，不参与可见性判断；provider 维度的路由仍由工具结果决定。
- 首次遇到已有历史记录的会话时，若当前应注入内容为空（例如子代理工具不可见），不会主动清除历史中的旧版介绍；这是为避免在每个新会话的首次请求上无谓替换头部。
