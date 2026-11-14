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
		/** 本插件在 profile 中的条目 id，同时是设置命名空间 key。 */
		const NAMESPACE = "subagent-intro";
		/**
		* 插件管理页中本 Bundle 详情页的配置插槽。
		*
		* 该插槽按包名寻址，占用后详情页才会出现配置区。配置只挂在这里，不再往
		* 设置面板的「插件」分页塞一个标签页，避免与内置插件的浏览列表挤在一起。
		*/
		const BUNDLE_CONFIG_SLOT = "plugins.bundle.config";
		/** 本插件的包名，同时是 bundle 配置插槽的 key。 */
		const PACKAGE_NAME = "@dsh-plugin/dsh-subagent-intro";
		/** 输入防抖时长，单位毫秒。 */
		const SAVE_DELAY = 400;
		/** 下载文件名前缀。 */
		const FILE_PREFIX = "subagent-intro";
		/** 可省略字段：留空时应 unset 而不是写入空串，与重排时的整体写回保持一致。 */
		const OPTIONAL_MODEL_FIELDS = /* @__PURE__ */ new Set(["provider", "name"]);
		/** 新增条目时写入宿主的空条目，必填字段先落空串由用户补齐。 */
		const EMPTY_MODEL = {
			model: "",
			provider: "",
			name: "",
			ability: "",
			scenario: "",
			timing: ""
		};
		const name = "@dsh-plugin/dsh-subagent-intro";
		/** 插件详情页需要插槽、配置表单与远端模型目录三个浏览器端服务。 */
		const inject = [
			"slots",
			"configForms",
			"remote",
			"remote.session"
		];
		/**
		* 挂载插件详情页的配置区。
		*
		* @param ctx - 浏览器端插件上下文。
		*/
		function apply(ctx) {
			const form = ctx.configForms.get(NAMESPACE);
			/**
			* 读取宿主模型目录，展平成「provider + 模型」候选列表。
			*
			* 目录只作为填写辅助：拉到就用下拉提示，拉不到时退化为手工输入，不阻塞编辑。
			*/
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
			const page = () => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SubagentIntroSettings, {
				form,
				loadCatalog
			});
			ctx.effect(() => ctx.slots.inject(BUNDLE_CONFIG_SLOT, () => ctx.slots.register({
				name: BUNDLE_CONFIG_SLOT,
				key: PACKAGE_NAME
			}, page)), "subagent-intro:bundle-config");
		}
		/** 把宿主配置转成编辑期草稿，缺省字段补空值。 */
		function toDraft(config) {
			return {
				toolNames: [...config.toolNames ?? []],
				intro: config.intro ?? "",
				announce: config.announce ?? true,
				models: (config.models ?? []).map((model) => ({
					model: model.model,
					provider: model.provider ?? "",
					name: model.name ?? "",
					ability: model.ability,
					scenario: model.scenario,
					timing: model.timing
				}))
			};
		}
		/** 把草稿条目还原成待写入的 JSON；可选字段留空时不写入，避免存下空串覆盖缺省语义。 */
		function modelToJson(model) {
			const json = {
				model: model.model,
				ability: model.ability,
				scenario: model.scenario,
				timing: model.timing
			};
			if (model.name.trim() !== "") json.name = model.name;
			if (model.provider.trim() !== "") json.provider = model.provider;
			return json;
		}
		/**
		* 把编辑期草稿转成可导出文档的配置主体。
		*
		* 导出的是屏幕上的当前内容，含尚未落盘的编辑，因此这里原样搬运字段；可选字段的
		* 省略规则集中在 {@link serializePortable}，避免两处判断不一致。
		*/
		function toPortable(draft) {
			return {
				toolNames: [...draft.toolNames],
				intro: draft.intro,
				announce: draft.announce,
				models: draft.models.map((model) => ({
					model: model.model,
					provider: model.provider,
					name: model.name,
					ability: model.ability,
					scenario: model.scenario,
					timing: model.timing
				}))
			};
		}
		/** 把导入的配置主体转成编辑期草稿，可选字段统一补空串。 */
		function fromPortable(config) {
			return {
				toolNames: [...config.toolNames],
				intro: config.intro,
				announce: config.announce,
				models: config.models.map((model) => ({
					model: model.model,
					provider: model.provider ?? "",
					name: model.name ?? "",
					ability: model.ability,
					scenario: model.scenario,
					timing: model.timing
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
		/** 标题与说明。 */
		const titleStyle = {
			margin: 0,
			fontSize: 18,
			fontWeight: 600,
			lineHeight: "26px"
		};
		const introStyle = {
			margin: 0,
			fontSize: 13,
			lineHeight: "20px",
			color: "var(--dsw-alias-label-tertiary)"
		};
		/** 占位与提示块。 */
		const noticeStyle = {
			margin: 0,
			padding: "10px 12px",
			fontSize: 13,
			lineHeight: "20px",
			borderRadius: "var(--dsw-radius-lg)",
			background: "var(--dsw-alias-bg-module-platform)",
			color: "var(--dsw-alias-label-secondary)"
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
		/**
		* 配置区主体。
		*
		* 宿主按 `view` 区分用途：详情页请求 `page` 时才渲染完整表单，
		* `summary` 只用于列表或折叠摘要，这里不需要给出简写版本。
		*/
		function SubagentIntroSettings(props) {
			const { form, loadCatalog } = props;
			if (props.view === "summary") return null;
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
			const subscribe = (0, react.useCallback)((listener) => form.subscribe(listener), [form]);
			const getSnapshot = (0, react.useCallback)(() => form.getSnapshot(), [form]);
			const snapshot = (0, react.useSyncExternalStore)(subscribe, getSnapshot, getSnapshot);
			/** 用户尚未提交的编辑；null 表示直接采用宿主值。 */
			const [override, setOverride] = (0, react.useState)(null);
			/** 在途写入全部结算后自增，用于触发草稿与宿主值的重新对齐。 */
			const [settled, setSettled] = (0, react.useState)(0);
			const [save, setSave] = (0, react.useState)({ kind: "idle" });
			/** 导入导出的操作反馈；成功或失败都保留到下一次导入导出操作覆盖。 */
			const [note, setNote] = (0, react.useState)(null);
			/** 已解析待确认的导入内容；null 表示没有待确认项。 */
			const [staged, setStaged] = (0, react.useState)(null);
			/** 导入写入是否在途；在途期间禁用全部导入控件，避免覆盖尚未落定的那次导入。 */
			const [applying, setApplying] = (0, react.useState)(false);
			const fileInput = (0, react.useRef)(null);
			const queue = (0, react.useRef)(/* @__PURE__ */ new Map());
			const timer = (0, react.useRef)(null);
			const writeSeq = (0, react.useRef)(0);
			const mounted = (0, react.useRef)(true);
			/** 尚未结算的写入数；大于零时宿主快照仍落后于草稿。 */
			const inflight = (0, react.useRef)(0);
			const external = snapshot.value;
			const writable = snapshot.writable;
			/** 渲染用的有效草稿：用户编辑优先，否则跟随宿主值。 */
			const view = override ?? (external === void 0 ? null : toDraft(external));
			/**
			* 立即发出写入，并把失败原因留在页面状态区。
			*
			* @param ops - 按顺序应用的路径操作。
			* @returns 宿主是否接受了这次写入；供需要据此决定后续动作的调用方使用。
			*/
			const write = (0, react.useCallback)(async (ops) => {
				if (ops.length === 0) return true;
				const seq = writeSeq.current + 1;
				writeSeq.current = seq;
				inflight.current += 1;
				if (mounted.current) setSave({ kind: "saving" });
				try {
					if (!await form.mutate(ops)) {
						const reason = "宿主拒绝了这次写入；配置可能已在别处被修改，页面已重新读取宿主值。";
						console.error("[@dsh-plugin/dsh-subagent-intro] 配置写入被宿主拒绝", ops);
						if (mounted.current) {
							setSave({
								kind: "failed",
								reason
							});
							if (seq === writeSeq.current) setOverride(null);
						}
						return false;
					}
					if (mounted.current && seq === writeSeq.current) setSave({ kind: "saved" });
					return true;
				} catch (error) {
					const reason = error instanceof Error ? error.message : String(error);
					console.error("[@dsh-plugin/dsh-subagent-intro] 配置写入失败", error);
					if (mounted.current) {
						setSave({
							kind: "failed",
							reason
						});
						if (seq === writeSeq.current) setOverride(null);
					}
					return false;
				} finally {
					inflight.current -= 1;
					if (inflight.current === 0) setSettled((count) => count + 1);
				}
			}, [form]);
			/** 取消防抖并立刻提交队列中的操作，可附加一批结构性操作。 */
			const commit = (0, react.useCallback)((structural = []) => {
				if (timer.current !== null) {
					window.clearTimeout(timer.current);
					timer.current = null;
				}
				const ops = [...queue.current.values(), ...structural];
				queue.current.clear();
				write(ops);
			}, [write]);
			/** 排队一条操作并延迟写出；同一路径的连续编辑只保留最后一次。 */
			const enqueue = (0, react.useCallback)((op) => {
				queue.current.set(op.path.join("\0"), op);
				if (timer.current !== null) window.clearTimeout(timer.current);
				timer.current = window.setTimeout(() => {
					timer.current = null;
					commit();
				}, SAVE_DELAY);
			}, [commit]);
			/** 组件卸载前补发尚未到期的写入，避免最后一次编辑丢失。 */
			const commitRef = (0, react.useRef)(commit);
			commitRef.current = commit;
			(0, react.useEffect)(() => () => {
				mounted.current = false;
				commitRef.current();
			}, []);
			/**
			* 草稿与宿主快照同步：待写操作、防抖计时器与在途写入都清空后，让宿主值接管。
			*
			* 这里刻意不把"是否有焦点"算进来：弹出层关闭时焦点元素会被移除，浏览器
			* 不一定补发 blur，用焦点计数会让草稿永久停留在旧值上。真正的保护来自
			* 队列与在途写入本身。
			*/
			(0, react.useEffect)(() => {
				if (override === null) return;
				if (queue.current.size > 0 || timer.current !== null || inflight.current > 0) return;
				setOverride(null);
			}, [
				override,
				external,
				settled
			]);
			if (snapshot.status !== "ready" || view === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: pageStyle,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
					style: titleStyle,
					children: "子代理介绍"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					style: noticeStyle,
					children: snapshot.status === "unavailable" ? "配置尚未就绪：宿主没有提供 subagent-intro 这个配置项，请确认插件已安装并启用。" : "配置尚未就绪：正在读取宿主配置…"
				})]
			});
			const disabled = !writable;
			/**
			* 基于最新草稿更新。
			*
			* 不能用渲染期捕获的 `view` 直接 `setOverride({ ...view, ... })`：同一事件里
			* 连续调用多次时，React 批处理会让每次都用同一份旧值，后一次把前一次的
			* 修改覆盖掉（点选模型时同时写 model 与 provider 就会丢一半）。
			* @param change - 接收最新草稿并返回下一份草稿。
			*/
			const mutateDraft = (0, react.useCallback)((change) => {
				setOverride((previous) => {
					const base = previous ?? (external === void 0 ? null : toDraft(external));
					return base === null ? previous : change(base);
				});
			}, [external]);
			const updateIntro = (text) => {
				mutateDraft((draft) => ({
					...draft,
					intro: text
				}));
				enqueue({
					op: "set",
					path: ["intro"],
					value: text
				});
			};
			const updateModel = (index, field, text) => {
				mutateDraft((draft) => {
					const models = draft.models.map((model, at) => at === index ? {
						...model,
						[field]: text
					} : model);
					return {
						...draft,
						models
					};
				});
				const path = [
					"models",
					String(index),
					field
				];
				if (OPTIONAL_MODEL_FIELDS.has(field) && text.trim() === "") enqueue({
					op: "unset",
					path
				});
				else enqueue({
					op: "set",
					path,
					value: text
				});
			};
			/**
			* 应用一次模型目录点选。
			*
			* 三步改动合成一次草稿更新与一次整体写入：分多次写既会因旧快照丢改动，
			* 也会让宿主看到中间态。
			* @param index - 条目下标。
			* @param picked - 选中的目录条目。
			*/
			const pickModel = (index, picked) => {
				const models = view.models.map((model, at) => at === index ? {
					...model,
					model: picked.id,
					provider: picked.provider,
					name: model.name.trim() === "" ? picked.name : model.name
				} : model);
				setOverride({
					...view,
					models
				});
				const pickedModel = models[index];
				if (pickedModel === void 0) return;
				commit([{
					op: "set",
					path: ["models", String(index)],
					value: modelToJson(pickedModel)
				}]);
			};
			const addModel = () => {
				const index = view.models.length;
				mutateDraft((draft) => ({
					...draft,
					models: [...draft.models, { ...EMPTY_MODEL }]
				}));
				commit([{
					op: "set",
					path: ["models", String(index)],
					value: {
						model: "",
						ability: "",
						scenario: "",
						timing: ""
					}
				}]);
			};
			const removeModel = (index) => {
				mutateDraft((draft) => ({
					...draft,
					models: draft.models.filter((_model, at) => at !== index)
				}));
				commit([{
					op: "unset",
					path: ["models", String(index)]
				}]);
			};
			const moveModel = (index, delta) => {
				const target = index + delta;
				if (target < 0 || target >= view.models.length) return;
				const models = [...view.models];
				const [moved] = models.splice(index, 1);
				models.splice(target, 0, moved);
				setOverride({
					...view,
					models
				});
				commit([{
					op: "set",
					path: ["models"],
					value: models.map(modelToJson)
				}]);
			};
			const updateToolName = (index, text) => {
				const toolNames = view.toolNames.map((toolName, at) => at === index ? text : toolName);
				mutateDraft((draft) => ({
					...draft,
					toolNames
				}));
				enqueue({
					op: "set",
					path: ["toolNames"],
					value: toolNames
				});
			};
			const addToolName = () => {
				const toolNames = [...view.toolNames, ""];
				mutateDraft((draft) => ({
					...draft,
					toolNames
				}));
				commit([{
					op: "set",
					path: ["toolNames"],
					value: toolNames
				}]);
			};
			const removeToolName = (index) => {
				const toolNames = view.toolNames.filter((_toolName, at) => at !== index);
				mutateDraft((draft) => ({
					...draft,
					toolNames
				}));
				commit([{
					op: "set",
					path: ["toolNames"],
					value: toolNames
				}]);
			};
			const toggleAnnounce = (checked) => {
				mutateDraft((draft) => ({
					...draft,
					announce: checked
				}));
				commit([{
					op: "set",
					path: ["announce"],
					value: checked
				}]);
			};
			/** 当前表单的导出文本；取草稿而非宿主快照，保证复制/下载到的就是屏幕上看到的内容。 */
			const exportText = () => serializePortable(toPortable(view), (/* @__PURE__ */ new Date()).toISOString());
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
			/**
			* 应用待确认的导入内容：一次写入四个顶层字段，避免宿主看到中间态。
			*
			* 写入成功才收起待导入项；失败时保留它，可直接重试同一份内容——要换内容需先
			* 放弃，再重新粘贴或选择文件。
			*/
			const applyImport = async () => {
				if (staged === null || applying) return;
				const draft = fromPortable(staged.config);
				setOverride(draft);
				if (timer.current !== null) {
					window.clearTimeout(timer.current);
					timer.current = null;
				}
				queue.current.clear();
				setApplying(true);
				let accepted = false;
				try {
					accepted = await write([
						{
							op: "set",
							path: ["toolNames"],
							value: draft.toolNames
						},
						{
							op: "set",
							path: ["intro"],
							value: draft.intro
						},
						{
							op: "set",
							path: ["announce"],
							value: draft.announce
						},
						{
							op: "set",
							path: ["models"],
							value: draft.models.map(modelToJson)
						}
					]);
				} finally {
					if (mounted.current) setApplying(false);
				}
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
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						style: titleStyle,
						children: "子代理介绍"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: introStyle,
						children: "下面的内容决定注入系统提示词的子代理介绍段落。修改会自动写入 profile 配置，由宿主按配置模式校验。"
					})] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SaveStatus, { state: save }),
					disabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: noticeStyle,
						children: "当前配置文档不可写（只读或缺少写入权限），所有控件已禁用；请检查 profile 的写入权限。"
					}) : null,
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
