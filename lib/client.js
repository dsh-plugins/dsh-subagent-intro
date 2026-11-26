window.__ModuleLoader__.load({
	id: "@dsh-plugin/dsh-subagent-intro",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		// src/portable.ts
		/**
		* 配置的可移植文档：导出文本、导入解析与缺省语义。
		*
		* 导出的文档同时是导入的合法输入，因此格式只有一份定义。解析器面向用户粘贴
		* 或选择的外部文件，任何不认识的字段、缺失的必填字段或类型不符都必须定位到
		* 具体路径后报错，不做静默丢弃——静默丢弃会让用户以为导入成功，实际少了条目。
		*/
		/** 文档所属插件，用于在导入时拒绝别的插件的配置。 */
		const PORTABLE_PLUGIN = "@dsh-plugin/dsh-subagent-intro";
		/** 默认的子代理创建工具名；导入时缺失该字段即取此值，与 schema 默认值一致。 */
		const DEFAULT_TOOL_NAMES = ["subagent", "subagent_fork"];
		/** 配置主体允许的字段。 */
		const CONFIG_KEYS = /* @__PURE__ */ new Set([
			"toolNames",
			"intro",
			"announce",
			"models"
		]);
		/** 带标识的文档外壳允许的字段。 */
		const DOCUMENT_KEYS = /* @__PURE__ */ new Set([
			"plugin",
			"version",
			"exportedAt",
			"config"
		]);
		/** 单条模型介绍允许的字段。 */
		const MODEL_KEYS = /* @__PURE__ */ new Set([
			"model",
			"provider",
			"name",
			"ability",
			"scenario",
			"timing"
		]);
		/** 解析失败的载体：内部抛出，在 {@link parsePortable} 边界转成结果对象。 */
		var PortableParseError = class extends Error {};
		/**
		* 生成可导入的配置文档。
		*
		* @param config - 待导出的完整配置。
		* @param exportedAt - 导出时刻，由调用方提供以保证函数输出只取决于入参。
		* @returns 带两空格缩进的 JSON 文本，结尾带换行。
		*/
		function serializePortable(config, exportedAt) {
			const models = config.models.map((model) => {
				const entry = { model: model.model };
				if ((model.provider ?? "").trim() !== "") entry.provider = model.provider;
				if ((model.name ?? "").trim() !== "") entry.name = model.name;
				entry.ability = model.ability;
				entry.scenario = model.scenario;
				entry.timing = model.timing;
				return entry;
			});
			const document = {
				plugin: PORTABLE_PLUGIN,
				version: 1,
				exportedAt,
				config: {
					toolNames: [...config.toolNames],
					intro: config.intro,
					announce: config.announce,
					models
				}
			};
			return `${JSON.stringify(document, null, 2)}\n`;
		}
		/**
		* 解析导入文本。
		*
		* 接受两种形态，按根对象是否含 `config` 键区分：含 `config` 的是完整文档，此时
		* `plugin` 与 `version` 必须存在并匹配；不含的是裸配置对象，必须至少给出一个配置
		* 字段——空对象按整体替换会静默清空全部内容，因此视为无效输入。两种形态里缺失的
		* 可选字段都取默认值（与 schema 默认值一致），未知字段一律视为错误。
		*
		* @param text - 剪贴板文本或文件内容。
		* @returns 解析结果；失败时 `error` 说明具体到哪个字段。
		*/
		function parsePortable(text) {
			try {
				return {
					ok: true,
					config: readDocument(text)
				};
			} catch (error) {
				if (error instanceof PortableParseError) return {
					ok: false,
					error: error.message
				};
				throw error;
			}
		}
		/** 解析文档主体。 */
		function readDocument(text) {
			const source = text.replace(/^\uFEFF/, "");
			let raw;
			try {
				raw = JSON.parse(source);
			} catch (error) {
				throw new PortableParseError(`不是合法的 JSON：${describeError$1(error)}`);
			}
			if (!isPlainObject(raw)) throw new PortableParseError(`根节点必须是对象，实际是${describe(raw)}`);
			const wrapped = "config" in raw;
			if (!wrapped && ![...CONFIG_KEYS].some((key) => key in raw)) throw new PortableParseError("配置对象至少要包含 toolNames、intro、announce、models 中的一个字段");
			const body = wrapped ? unwrapDocument(raw) : raw;
			rejectUnknownKeys(body, CONFIG_KEYS, "配置中", "toolNames、intro、announce、models");
			return {
				toolNames: readToolNames(body.toolNames),
				intro: body.intro === void 0 ? "" : requireString(body.intro, "intro"),
				announce: body.announce === void 0 ? true : requireBoolean(body.announce, "announce"),
				models: body.models === void 0 ? [] : readModels(body.models)
			};
		}
		/** 校验文档外壳并取出配置主体。 */
		function unwrapDocument(document) {
			rejectUnknownKeys(document, DOCUMENT_KEYS, "文档中", "plugin、version、exportedAt、config");
			const plugin = requireString(document.plugin, "plugin");
			if (plugin !== "@dsh-plugin/dsh-subagent-intro") throw new PortableParseError(`文档属于 "${plugin}"，不是 ${PORTABLE_PLUGIN} 的配置`);
			const version = requireNumber(document.version, "version");
			if (version !== 1) throw new PortableParseError(`文档版本 ${version} 不受支持，当前只接受版本 1`);
			if (document.exportedAt !== void 0) requireString(document.exportedAt, "exportedAt");
			if (!isPlainObject(document.config)) throw new PortableParseError(`字段 "config" 必须是对象，实际是${describe(document.config)}`);
			return document.config;
		}
		/** 读取工具名列表。 */
		function readToolNames(value) {
			if (value === void 0) return [...DEFAULT_TOOL_NAMES];
			if (!Array.isArray(value)) throw new PortableParseError(`字段 "toolNames" 必须是字符串数组，实际是${describe(value)}`);
			return value.map((entry, index) => requireString(entry, `toolNames[${index}]`));
		}
		/** 读取模型条目。 */
		function readModels(value) {
			if (!Array.isArray(value)) throw new PortableParseError(`字段 "models" 必须是数组，实际是${describe(value)}`);
			return value.map((entry, index) => {
				const at = `models[${index}]`;
				if (!isPlainObject(entry)) throw new PortableParseError(`字段 "${at}" 必须是对象，实际是${describe(entry)}`);
				rejectUnknownKeys(entry, MODEL_KEYS, `字段 "${at}" 中`, "model、provider、name、ability、scenario、timing");
				const model = {
					model: requireString(entry.model, `${at}.model`),
					ability: requireString(entry.ability, `${at}.ability`),
					scenario: requireString(entry.scenario, `${at}.scenario`),
					timing: requireString(entry.timing, `${at}.timing`)
				};
				const provider = entry.provider === void 0 ? "" : requireString(entry.provider, `${at}.provider`);
				const name = entry.name === void 0 ? "" : requireString(entry.name, `${at}.name`);
				if (provider.trim() !== "") model.provider = provider;
				if (name.trim() !== "") model.name = name;
				return model;
			});
		}
		/** 拒绝未声明的字段，避免拼写错误被当作缺省值放过。 */
		function rejectUnknownKeys(record, allowed, where, expected) {
			const unknown = Object.keys(record).find((key) => !allowed.has(key));
			if (unknown !== void 0) throw new PortableParseError(`${where}包含未知字段 "${unknown}"，可用字段：${expected}`);
		}
		/** 校验必填字符串字段。 */
		function requireString(value, path) {
			if (typeof value !== "string") throw new PortableParseError(`字段 "${path}" 必须是字符串，实际是${describe(value)}`);
			return value;
		}
		/** 校验布尔字段。 */
		function requireBoolean(value, path) {
			if (typeof value !== "boolean") throw new PortableParseError(`字段 "${path}" 必须是布尔值，实际是${describe(value)}`);
			return value;
		}
		/** 校验数字字段。 */
		function requireNumber(value, path) {
			if (typeof value !== "number" || !Number.isFinite(value)) throw new PortableParseError(`字段 "${path}" 必须是数字，实际是${describe(value)}`);
			return value;
		}
		/** 判定是否为 JSON 对象（排除 null、数组与其他对象）。 */
		function isPlainObject(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value);
		}
		/** 把任意值描述成中文类型名，用于拼错误信息。 */
		function describe(value) {
			if (value === void 0) return "缺失";
			if (value === null) return "null";
			if (Array.isArray(value)) return "数组";
			if (typeof value === "object") return "对象";
			if (typeof value === "string") return "字符串";
			if (typeof value === "number") return "数字";
			if (typeof value === "boolean") return "布尔值";
			return typeof value;
		}
		/** 提取 JSON 语法错误的原始说明。 */
		function describeError$1(error) {
			return error instanceof Error ? error.message : String(error);
		}
		// src/client/index.tsx
		const CONFIG_ID = "dsh-subagent-intro";
		const SAVE_DELAY = 400;
		const FILE_PREFIX = "subagent-intro";
		const EMPTY_MODEL = {
			model: "",
			provider: "",
			name: "",
			ability: "",
			scenario: "",
			timing: ""
		};
		const name = "@dsh-plugin/dsh-subagent-intro";
		const inject = [
			"dshLoaderUi",
			"remote",
			"remote.session"
		];
		/** 将编辑区挂到配置卡片，并从宿主模型目录提供可选条目。 */
		function apply(ctx) {
			const loadCatalog = async () => {
				const response = await ctx.remote.session.modelCatalog();
				if (!response.ok) throw new Error(`${response.error.code}: ${response.error.message}`);
				return response.value.groups.flatMap((group) => group.models.map((model) => ({
					provider: group.id,
					providerName: group.name,
					id: model.id,
					name: model.name
				})));
			};
			ctx.dshLoaderUi.config.registerPanel({ effect: (register) => ctx.effect(() => register() ?? []) }, {
				configId: CONFIG_ID,
				id: "editor",
				component: ({ view, client }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SubagentIntroSettings, {
					snapshot: view,
					client,
					loadCatalog
				})
			});
		}
		function toDraft(config) {
			return {
				toolNames: [...config.toolNames],
				intro: config.intro,
				announce: config.announce,
				models: config.models.map((model) => ({
					...model,
					provider: model.provider ?? "",
					name: model.name ?? ""
				}))
			};
		}
		/**
		* 导入预览文案：在写入前说明这次替换的规模，避免一次误粘贴直接清空条目。
		*
		* @param config - 已解析的导入内容。
		* @returns 一行用分号分隔的摘要。
		*/
		function describeImport(config) {
			const ids = config.models.map((model) => model.model.trim()).filter((id) => id !== "");
			return [
				config.models.length === 0 ? "无模型条目" : `${config.models.length} 条模型条目（${ids.length === 0 ? "模型 id 均为空" : ids.join("、")}）`,
				config.intro.trim() === "" ? "总述为空" : `总述 ${config.intro.length} 字`,
				config.toolNames.length === 0 ? "工具名列表为空，本段将不再注入" : `工具名 ${config.toolNames.join("、")}`,
				`适用声明头${config.announce ? "开启" : "关闭"}`
			].join("；");
		}
		/** 下载文件名中的时间戳：本地时间，精确到秒。 */
		function timeStamp(date) {
			const pad = (value) => String(value).padStart(2, "0");
			return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
		}
		/** 触发一次浏览器下载，等浏览器取走 blob 后释放对象 URL。 */
		function downloadFile(name, text) {
			const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = name;
			anchor.style.display = "none";
			document.body.append(anchor);
			anchor.click();
			anchor.remove();
			window.setTimeout(() => {
				URL.revokeObjectURL(url);
			}, 0);
		}
		/** 写入剪贴板；页面未提供剪贴板接口时抛出带原因的错误。 */
		async function writeClipboard(text) {
			const clipboard = navigator.clipboard;
			if (clipboard === void 0 || typeof clipboard.writeText !== "function") throw new Error("当前页面没有可用的剪贴板写入接口");
			await clipboard.writeText(text);
		}
		/** 读取剪贴板文本；接口缺失同样抛出带原因的错误。 */
		async function readClipboard() {
			const clipboard = navigator.clipboard;
			if (clipboard === void 0 || typeof clipboard.readText !== "function") throw new Error("当前页面没有可用的剪贴板读取接口");
			return await clipboard.readText();
		}
		/** 取出异常的可读说明。 */
		function describeError(error) {
			return error instanceof Error ? error.message : String(error);
		}
		/**
		* 页面根容器样式。
		*
		* 宽度交给宿主容器决定，自设 maxWidth
		* 会在宽屏下留下一大片空白，也会让长文本字段过早截断。
		*/
		const pageStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 16,
			width: "100%",
			minWidth: 0,
			color: "var(--dsw-alias-label-primary)"
		};
		const introStyle = {
			margin: 0,
			fontSize: 13,
			lineHeight: "20px",
			color: "var(--dsw-alias-label-tertiary)"
		};
		/** 卡片容器。 */
		const cardStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 10,
			padding: 12,
			border: "0.5px solid var(--dsw-alias-border-l2)",
			borderRadius: "var(--dsw-radius-lg)",
			background: "var(--dsw-alias-bg-layer-1)"
		};
		/** 字段栅格：窄屏自动折行，宽屏铺满可用宽度。 */
		const gridStyle = {
			display: "grid",
			gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
			gap: 10
		};
		/** 长文本字段独占整行：能力、场景、适用时机的文字通常远超一行。 */
		const fullRowStyle = { gridColumn: "1 / -1" };
		const labelStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 4,
			fontSize: 12,
			lineHeight: "18px",
			color: "var(--dsw-alias-label-tertiary)"
		};
		const inputStyle = {
			width: "100%",
			boxSizing: "border-box",
			height: 32,
			padding: "0 10px",
			font: "inherit",
			fontSize: 13,
			color: "var(--dsw-alias-label-primary)",
			background: "var(--dsw-alias-bg-base)",
			border: "0.5px solid var(--dsw-alias-border-l3)",
			borderRadius: "var(--dsw-radius-md)"
		};
		const textareaStyle = {
			...inputStyle,
			height: "auto",
			minHeight: 96,
			padding: "8px 10px",
			lineHeight: "20px",
			resize: "vertical"
		};
		/** 多行输入框：高度由内容决定，可手工拖高。 */
		const multilineStyle = {
			...inputStyle,
			height: "auto",
			minHeight: 56,
			padding: "6px 10px",
			lineHeight: "20px",
			resize: "vertical"
		};
		const buttonStyle = {
			height: 30,
			padding: "0 12px",
			font: "inherit",
			fontSize: 13,
			color: "var(--dsw-alias-label-primary)",
			background: "var(--dsw-alias-bg-module-platform)",
			border: "0.5px solid var(--dsw-alias-border-l3)",
			borderRadius: "var(--dsw-radius-md)",
			cursor: "pointer"
		};
		const rowStyle = {
			display: "flex",
			alignItems: "center",
			gap: 8,
			flexWrap: "wrap"
		};
		const cardHeadStyle = {
			...rowStyle,
			justifyContent: "space-between"
		};
		const cardTitleStyle = {
			margin: 0,
			fontSize: 13,
			fontWeight: 500,
			lineHeight: "20px"
		};
		const listStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 10,
			margin: 0,
			padding: 0,
			listStyle: "none"
		};
		const statusStyle = {
			margin: 0,
			fontSize: 12,
			lineHeight: "18px",
			color: "var(--dsw-alias-label-tertiary)"
		};
		/** 选择器字段容器：作为弹出层的定位基准。 */
		const pickerFieldStyle = {
			position: "relative",
			display: "flex",
			flexDirection: "column",
			gap: 4,
			minWidth: 0
		};
		/** 字段标签文字，与 TextField 的标签外观保持一致。 */
		const labelTextStyle = {
			fontSize: 12,
			lineHeight: "18px",
			color: "var(--dsw-alias-label-tertiary)"
		};
		/** 输入框与按钮同一行；按钮不得被压缩，否则文字会竖排换行。 */
		const pickerRowStyle = {
			display: "flex",
			alignItems: "center",
			gap: 6,
			minWidth: 0
		};
		/** 选择器内的输入框：可收缩以让出按钮宽度，避免横向溢出或把按钮挤扁。 */
		const pickerInputStyle = {
			...inputStyle,
			flex: "1 1 auto",
			minWidth: 0
		};
		const pickerButtonStyle = {
			...buttonStyle,
			flexShrink: 0,
			minWidth: 56,
			whiteSpace: "nowrap"
		};
		/** 候选弹出层：脱离文档流，覆盖在下方内容之上。 */
		const pickerPopoverStyle = {
			position: "absolute",
			top: "calc(100% + 4px)",
			left: 0,
			right: 0,
			zIndex: 30,
			display: "flex",
			flexDirection: "column",
			gap: 2,
			padding: 4,
			maxHeight: 260,
			overflowY: "auto",
			border: "0.5px solid var(--dsw-alias-border-l2)",
			borderRadius: "var(--dsw-radius-md)",
			background: "var(--dsw-alias-bg-layer-1)",
			boxShadow: "var(--dsw-shadow-lv3)"
		};
		/** 单条候选：名称一行、provider/id 一行，超长各自截断。 */
		const pickerItemStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 2,
			width: "100%",
			padding: "6px 8px",
			font: "inherit",
			textAlign: "left",
			color: "var(--dsw-alias-label-primary)",
			background: "transparent",
			border: "none",
			borderRadius: "var(--dsw-radius-sm)",
			cursor: "pointer"
		};
		const pickerItemActiveStyle = { background: "var(--dsw-alias-interactive-bg-hover)" };
		const pickerItemNameStyle = {
			fontSize: 13,
			lineHeight: "18px",
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		};
		const pickerItemMetaStyle = {
			fontSize: 12,
			lineHeight: "16px",
			color: "var(--dsw-alias-label-tertiary)",
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		};
		const pickerHintStyle = {
			fontSize: 12,
			lineHeight: "18px",
			color: "var(--dsw-alias-label-tertiary)"
		};
		/** 单行文本输入，标签包裹以免依赖 id 生成。 */
		/**
		* 模型 id 选择器：可下拉挑选宿主已注册的模型，也可直接手工输入。
		*
		* 目录里没有的模型（例如只在子代理侧配置的路由）仍允许填写，因此控件是
		* 输入框 + 候选列表，而不是必须从列表中选择的 select。
		*/
		function ModelPicker(props) {
			const [open, setOpen] = (0, react.useState)(false);
			const [active, setActive] = (0, react.useState)(-1);
			const container = (0, react.useRef)(null);
			const options = (props.catalog ?? []).filter((model) => {
				const keyword = props.value.trim().toLowerCase();
				if (keyword === "") return true;
				return model.id.toLowerCase().includes(keyword) || model.name.toLowerCase().includes(keyword) || model.provider.toLowerCase().includes(keyword);
			}).slice(0, 40);
			const choose = (model) => {
				props.onPick(model);
				setOpen(false);
				setActive(-1);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				ref: container,
				style: pickerFieldStyle,
				onBlur: (event) => {
					const next = event.relatedTarget;
					if (next instanceof Node && container.current?.contains(next) === true) return;
					setOpen(false);
					setActive(-1);
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: labelTextStyle,
						children: "模型 id（model）"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						style: pickerRowStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "text",
							style: pickerInputStyle,
							value: props.value,
							disabled: props.disabled,
							placeholder: "例如 deepseek-flash",
							"aria-expanded": open,
							"aria-autocomplete": "list",
							onChange: (event) => {
								props.onChange(event.currentTarget.value);
								setOpen(true);
								setActive(-1);
							},
							onFocus: () => {
								setOpen(true);
							},
							onKeyDown: (event) => {
								if (event.key === "Escape") {
									setOpen(false);
									return;
								}
								if (event.key === "ArrowDown" || event.key === "ArrowUp") {
									if (options.length === 0) return;
									event.preventDefault();
									setOpen(true);
									const delta = event.key === "ArrowDown" ? 1 : -1;
									setActive((current) => {
										const next = current + delta;
										if (next < 0) return options.length - 1;
										if (next >= options.length) return 0;
										return next;
									});
									return;
								}
								if (event.key === "Enter") {
									const picked = options[active];
									if (!open || picked === void 0) return;
									event.preventDefault();
									choose(picked);
								}
							}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: pickerButtonStyle,
							disabled: props.disabled || props.catalog === null && props.catalogError === null,
							title: props.catalogError !== null ? `模型目录不可用：${props.catalogError}` : props.catalog === null ? "模型目录尚未就绪" : "从已注册模型中选择",
							"aria-haspopup": "listbox",
							"aria-expanded": open,
							onClick: () => {
								setOpen((value) => !value);
								setActive(-1);
							},
							children: "选择"
						})]
					}),
					open && options.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: pickerPopoverStyle,
						role: "listbox",
						children: options.map((model, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							role: "option",
							"aria-selected": index === active,
							style: {
								...pickerItemStyle,
								...index === active ? pickerItemActiveStyle : {}
							},
							onMouseEnter: () => {
								setActive(index);
							},
							onClick: () => {
								choose(model);
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: pickerItemNameStyle,
								children: model.name
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								style: pickerItemMetaStyle,
								children: [
									model.provider,
									"/",
									model.id
								]
							})]
						}, `${model.provider}/${model.id}`))
					}),
					open && props.catalog !== null && options.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: pickerHintStyle,
						children: "没有匹配的已注册模型，可直接输入模型 id。"
					}),
					props.catalogError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						style: pickerHintStyle,
						children: [
							"模型目录不可用（",
							props.catalogError,
							"），可直接输入模型 id。"
						]
					})
				]
			});
		}
		function TextField(props) {
			const style = {
				...props.multiline === true ? multilineStyle : inputStyle,
				...props.fullRow === true ? fullRowStyle : {}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				style: labelStyle,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: props.label }), props.multiline === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
					style,
					value: props.value,
					disabled: props.disabled,
					placeholder: props.placeholder,
					onChange: (event) => {
						props.onChange(event.currentTarget.value);
					}
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					type: "text",
					style,
					value: props.value,
					disabled: props.disabled,
					placeholder: props.placeholder,
					onChange: (event) => {
						props.onChange(event.currentTarget.value);
					}
				})]
			});
		}
		function SubagentIntroSettings({ snapshot, client, loadCatalog }) {
			const [catalog, setCatalog] = (0, react.useState)(null);
			const [catalogError, setCatalogError] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				let cancelled = false;
				loadCatalog().then((models) => {
					if (!cancelled) setCatalog(models);
				}, (error) => {
					if (cancelled) return;
					setCatalogError(error instanceof Error ? error.message : String(error));
					console.error("[@dsh-plugin/dsh-subagent-intro] 读取模型目录失败", error);
				});
				return () => {
					cancelled = true;
				};
			}, [loadCatalog]);
			const [lastSaved, setLastSaved] = (0, react.useState)(snapshot);
			const [override, setOverride] = (0, react.useState)(null);
			const [save, setSave] = (0, react.useState)({ kind: "idle" });
			const [note, setNote] = (0, react.useState)(null);
			const [staged, setStaged] = (0, react.useState)(null);
			const [applying, setApplying] = (0, react.useState)(false);
			const fileInput = (0, react.useRef)(null);
			const timer = (0, react.useRef)(null);
			const pending = (0, react.useRef)(null);
			const writes = (0, react.useRef)(Promise.resolve(true));
			const mounted = (0, react.useRef)(true);
			const current = lastSaved.revision > snapshot.revision ? lastSaved : snapshot;
			const external = current.value;
			const view = override ?? toDraft(external);
			const disabled = applying;
			const cancelTimer = (0, react.useCallback)(() => {
				if (timer.current !== null) {
					window.clearTimeout(timer.current);
					timer.current = null;
				}
			}, []);
			const commit = (0, react.useCallback)(() => {
				cancelTimer();
				const batch = pending.current;
				if (batch === null) return Promise.resolve(false);
				const draft = batch.draft;
				const write = writes.current.then(async () => {
					if (pending.current !== batch) return false;
					if (mounted.current) setSave({ kind: "saving" });
					try {
						const saved = await client.update(CONFIG_ID, {
							...draft,
							models: draft.models.map((model) => ({
								...model,
								name: model.name.trim() === "" ? "" : model.name,
								provider: model.provider.trim() === "" ? "" : model.provider
							}))
						}, batch.revision);
						batch.revision = saved.revision;
						if (mounted.current) setLastSaved(saved);
						if (batch.draft === draft) {
							pending.current = null;
							if (mounted.current) {
								setOverride(null);
								setSave({ kind: "saved" });
							}
						}
						return true;
					} catch (error) {
						const reason = describeError(error);
						console.error("[@dsh-plugin/dsh-subagent-intro] 配置写入失败", error);
						if (mounted.current) try {
							const latest = await client.read(CONFIG_ID);
							if (mounted.current) setLastSaved(latest);
						} catch (readError) {
							console.error("[@dsh-plugin/dsh-subagent-intro] 重新读取配置失败", readError);
						}
						cancelTimer();
						pending.current = null;
						if (mounted.current) {
							setOverride(null);
							setSave({
								kind: "failed",
								reason
							});
						}
						return false;
					}
				});
				writes.current = write;
				return write;
			}, [cancelTimer, client]);
			(0, react.useEffect)(() => {
				mounted.current = true;
				return () => {
					mounted.current = false;
					if (timer.current !== null) commit();
				};
			}, [commit]);
			const edit = (change) => {
				const batch = pending.current ?? {
					revision: current.revision,
					draft: view
				};
				batch.draft = change(batch.draft);
				pending.current = batch;
				setOverride(batch.draft);
			};
			const update = (change, immediate = false) => {
				edit(change);
				if (immediate) commit();
				else {
					cancelTimer();
					timer.current = window.setTimeout(() => {
						commit();
					}, SAVE_DELAY);
				}
			};
			const updateIntro = (intro) => {
				update((draft) => ({
					...draft,
					intro
				}));
			};
			const updateModel = (index, field, text) => {
				update((draft) => ({
					...draft,
					models: draft.models.map((model, at) => at === index ? {
						...model,
						[field]: text
					} : model)
				}));
			};
			const pickModel = (index, picked) => {
				update((draft) => ({
					...draft,
					models: draft.models.map((model, at) => at === index ? {
						...model,
						model: picked.id,
						provider: picked.provider,
						name: model.name.trim() === "" ? picked.name : model.name
					} : model)
				}), true);
			};
			const addModel = () => {
				update((draft) => ({
					...draft,
					models: [...draft.models, { ...EMPTY_MODEL }]
				}), true);
			};
			const removeModel = (index) => {
				update((draft) => ({
					...draft,
					models: draft.models.filter((_model, at) => at !== index)
				}), true);
			};
			const moveModel = (index, delta) => {
				const target = index + delta;
				if (target < 0 || target >= view.models.length) return;
				update((draft) => {
					const models = [...draft.models];
					const [moved] = models.splice(index, 1);
					models.splice(target, 0, moved);
					return {
						...draft,
						models
					};
				}, true);
			};
			const updateToolName = (index, text) => {
				update((draft) => ({
					...draft,
					toolNames: draft.toolNames.map((toolName, at) => at === index ? text : toolName)
				}));
			};
			const addToolName = () => {
				update((draft) => ({
					...draft,
					toolNames: [...draft.toolNames, ""]
				}), true);
			};
			const removeToolName = (index) => {
				update((draft) => ({
					...draft,
					toolNames: draft.toolNames.filter((_toolName, at) => at !== index)
				}), true);
			};
			const toggleAnnounce = (announce) => {
				update((draft) => ({
					...draft,
					announce
				}), true);
			};
			const exportText = () => serializePortable(view, (/* @__PURE__ */ new Date()).toISOString());
			const copyConfig = async () => {
				try {
					await writeClipboard(exportText());
					if (mounted.current) setNote({
						tone: "success",
						text: "配置已复制到剪贴板。"
					});
				} catch (error) {
					console.error("[@dsh-plugin/dsh-subagent-intro] 写入剪贴板失败", error);
					if (!mounted.current) return;
					setNote({
						tone: "error",
						text: `复制失败：${describeError(error)}。可以改用「下载 JSON 文件」。`
					});
				}
			};
			const saveConfig = () => {
				const fileName = `${FILE_PREFIX}-${timeStamp(/* @__PURE__ */ new Date())}.json`;
				try {
					downloadFile(fileName, exportText());
					setNote({
						tone: "success",
						text: `已下载 ${fileName}。`
					});
				} catch (error) {
					console.error("[@dsh-plugin/dsh-subagent-intro] 生成下载失败", error);
					setNote({
						tone: "error",
						text: `下载失败：${describeError(error)}`
					});
				}
			};
			/** 解析一段导入文本；解析失败时清掉上一份待确认项，避免误应用旧内容。 */
			const stageImport = (text, source) => {
				const result = parsePortable(text);
				if (!result.ok) {
					console.warn(`[@dsh-plugin/dsh-subagent-intro] 无法解析${source}中的配置：${result.error}`);
					setStaged(null);
					setNote({
						tone: "error",
						text: `无法解析来源（${source}）中的配置：${result.error}`
					});
					return;
				}
				setStaged({
					config: result.config,
					source
				});
				setNote(null);
			};
			const importFromClipboard = async () => {
				try {
					const text = await readClipboard();
					if (!mounted.current) return;
					if (text.trim() === "") {
						setNote({
							tone: "error",
							text: "剪贴板里没有文本内容。"
						});
						return;
					}
					stageImport(text, "剪贴板");
				} catch (error) {
					console.error("[@dsh-plugin/dsh-subagent-intro] 读取剪贴板失败", error);
					if (!mounted.current) return;
					setNote({
						tone: "error",
						text: `读取剪贴板失败：${describeError(error)}。可以改用「选择 JSON 文件」。`
					});
				}
			};
			const importFromFile = async (event) => {
				const input = event.currentTarget;
				const file = input.files?.[0];
				if (file === void 0) {
					console.warn("[@dsh-plugin/dsh-subagent-intro] 文件选择事件没有携带文件");
					return;
				}
				let text;
				try {
					text = await file.text();
				} catch (error) {
					console.error("[@dsh-plugin/dsh-subagent-intro] 读取导入文件失败", error);
					if (mounted.current) setNote({
						tone: "error",
						text: `读取文件失败：${describeError(error)}`
					});
					return;
				} finally {
					input.value = "";
				}
				if (!mounted.current) return;
				stageImport(text, `文件「${file.name}」`);
			};
			const applyImport = async () => {
				if (staged === null || applying) return;
				edit(() => toDraft(staged.config));
				setApplying(true);
				const accepted = await commit();
				if (mounted.current) setApplying(false);
				if (!mounted.current) return;
				if (accepted) {
					setStaged(null);
					setNote({
						tone: "success",
						text: "已应用导入的配置。"
					});
				} else setNote({
					tone: "error",
					text: "导入未写入：宿主拒绝了这次写入或写入失败，原因见页面上方的保存状态。"
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: pageStyle,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: introStyle,
						children: "修改会自动保存到当前 profile。下一轮请求使用更新后的子代理介绍。"
					}) }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SaveStatus, { state: save }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						style: {
							...labelStyle,
							gap: 6
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "总述（intro）" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
							style: textareaStyle,
							value: view.intro,
							disabled,
							placeholder: "留空表示不输出总述。",
							onChange: (event) => {
								updateIntro(event.currentTarget.value);
							}
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						style: cardStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: cardHeadStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h3", {
								style: cardTitleStyle,
								children: [
									"模型介绍条目（",
									view.models.length,
									"）"
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: buttonStyle,
								disabled,
								onClick: addModel,
								children: "新增条目"
							})]
						}), view.models.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: statusStyle,
							children: "还没有条目。子代理介绍至少需要一条模型条目才会注入。"
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							style: listStyle,
							children: view.models.map((model, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
								style: cardStyle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: cardHeadStyle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h4", {
										style: cardTitleStyle,
										children: ["条目 ", index + 1]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										style: rowStyle,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												style: buttonStyle,
												disabled: disabled || index === 0,
												onClick: () => {
													moveModel(index, -1);
												},
												children: "上移"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												style: buttonStyle,
												disabled: disabled || index === view.models.length - 1,
												onClick: () => {
													moveModel(index, 1);
												},
												children: "下移"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												style: buttonStyle,
												disabled,
												onClick: () => {
													removeModel(index);
												},
												children: "删除"
											})
										]
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: gridStyle,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelPicker, {
											value: model.model,
											disabled,
											catalog,
											catalogError,
											onChange: (text) => {
												updateModel(index, "model", text);
											},
											onPick: (picked) => {
												pickModel(index, picked);
											}
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
											label: "provider（可选）",
											value: model.provider,
											disabled,
											placeholder: "例如 mclans-deepseek",
											onChange: (text) => {
												updateModel(index, "provider", text);
											}
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
											label: "展示名（name，可选）",
											value: model.name,
											disabled,
											placeholder: "留空则使用模型 id",
											onChange: (text) => {
												updateModel(index, "name", text);
											}
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
											label: "能力（ability）",
											value: model.ability,
											disabled,
											multiline: true,
											fullRow: true,
											placeholder: "例如：强推理与复杂编码，擅长长链路重构",
											onChange: (text) => {
												updateModel(index, "ability", text);
											}
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
											label: "场景（scenario）",
											value: model.scenario,
											disabled,
											multiline: true,
											fullRow: true,
											placeholder: "例如：高难度代码改造、架构评审",
											onChange: (text) => {
												updateModel(index, "scenario", text);
											}
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
											label: "适用时机（timing）",
											value: model.timing,
											disabled,
											multiline: true,
											fullRow: true,
											placeholder: "例如：错误代价高时优先指定",
											onChange: (text) => {
												updateModel(index, "timing", text);
											}
										})
									]
								})]
							}, index))
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						style: cardStyle,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: cardHeadStyle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
									style: cardTitleStyle,
									children: "子代理创建工具名（toolNames）"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: buttonStyle,
									disabled,
									onClick: addToolName,
									children: "新增工具名"
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: statusStyle,
								children: "当前作用域内全部工具都不可见时本段不注入；清空列表等同于不再注入。"
							}),
							view.toolNames.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: statusStyle,
								children: "列表为空。"
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
								style: listStyle,
								children: view.toolNames.map((toolName, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
									style: rowStyle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "text",
										style: {
											...inputStyle,
											flex: 1
										},
										value: toolName,
										disabled,
										placeholder: "例如 subagent",
										onChange: (event) => {
											updateToolName(index, event.currentTarget.value);
										}
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										style: buttonStyle,
										disabled,
										onClick: () => {
											removeToolName(index);
										},
										children: "删除"
									})]
								}, index))
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						style: cardStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							style: cardTitleStyle,
							children: "适用声明头（announce）"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							style: {
								...rowStyle,
								fontSize: 13,
								color: "var(--dsw-alias-label-primary)"
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: view.announce,
								disabled,
								onChange: (event) => {
									toggleAnnounce(event.currentTarget.checked);
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "在段落开头输出「仅适用于当前会话配置」的声明" })]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						style: cardStyle,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								style: cardTitleStyle,
								children: "导入 / 导出"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: statusStyle,
								children: "导出把当前表单写成一份 JSON 文档，可用于备份或迁移到另一份 profile。导入会整体替换总述、模型条目、工具名与适用声明头，粘贴或选择文件后先预览，确认后才写入。"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: rowStyle,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										style: buttonStyle,
										onClick: () => {
											copyConfig();
										},
										children: "复制到剪贴板"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										style: buttonStyle,
										onClick: saveConfig,
										children: "下载 JSON 文件"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										style: buttonStyle,
										disabled: disabled || applying,
										onClick: () => {
											importFromClipboard();
										},
										children: "从剪贴板导入"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										style: buttonStyle,
										disabled: disabled || applying,
										onClick: () => {
											fileInput.current?.click();
										},
										children: "选择 JSON 文件…"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										ref: fileInput,
										type: "file",
										accept: "application/json,.json",
										style: { display: "none" },
										onChange: (event) => {
											importFromFile(event);
										}
									})
								]
							}),
							staged !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: cardStyle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									style: {
										...statusStyle,
										color: "var(--dsw-alias-label-secondary)"
									},
									children: [
										"待导入（来源：",
										staged.source,
										"）：",
										describeImport(staged.config)
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: rowStyle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										style: buttonStyle,
										disabled: disabled || applying,
										onClick: () => {
											applyImport();
										},
										children: applying ? "应用中…" : "应用导入"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										style: buttonStyle,
										disabled: applying,
										onClick: () => {
											setStaged(null);
											setNote(null);
										},
										children: "放弃"
									})]
								})]
							}),
							note !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								role: note.tone === "error" ? "alert" : "status",
								style: {
									...statusStyle,
									color: note.tone === "error" ? "var(--dsw-alias-state-error-primary)" : "var(--dsw-alias-state-success-primary)"
								},
								children: note.text
							})
						]
					})
				]
			});
		}
		/** 保存状态条：失败时把原因直接显示在页面上，不只写控制台。 */
		function SaveStatus(props) {
			const { state } = props;
			if (state.kind === "idle") return null;
			if (state.kind === "saving") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				style: statusStyle,
				role: "status",
				children: "保存中…"
			});
			if (state.kind === "saved") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				style: {
					...statusStyle,
					color: "var(--dsw-alias-state-success-primary)"
				},
				role: "status",
				children: "已保存"
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				style: {
					...statusStyle,
					color: "var(--dsw-alias-state-error-primary)"
				},
				role: "alert",
				children: ["保存失败：", state.reason]
			});
		}
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
