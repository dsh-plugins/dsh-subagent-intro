window.__ModuleLoader__.load({
	id: "dsh-subagent-intro",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		// src/client/index.tsx
		/** 本插件在 profile 中的条目 id，同时是设置命名空间 key。 */
		const NAMESPACE = "subagent-intro";
		/** 设置面板「插件」分页的页内插槽。 */
		const SETTINGS_SLOT = "settings.plugins.tab";
		/**
		* 插件管理页中本 Bundle 详情页的配置插槽。
		*
		* 该插槽按包名寻址，占用后详情页才会出现配置区；只注册 settings.plugins.tab 时，
		* 用户在插件详情页看不到任何配置入口。
		*/
		const BUNDLE_CONFIG_SLOT = "plugins.bundle.config";
		/** 本插件的包名，同时是 bundle 配置插槽的 key。 */
		const PACKAGE_NAME = "dsh-subagent-intro";
		/** 输入防抖时长，单位毫秒。 */
		const SAVE_DELAY = 400;
		/** 新增条目时写入宿主的空条目，必填字段先落空串由用户补齐。 */
		/** 可省略字段：留空时应 unset 而不是写入空串，与重排时的整体写回保持一致。 */
		const OPTIONAL_MODEL_FIELDS = /* @__PURE__ */ new Set(["provider", "name"]);
		const EMPTY_MODEL = {
			model: "",
			provider: "",
			name: "",
			ability: "",
			scenario: "",
			timing: ""
		};
		const name = "dsh-subagent-intro";
		/** 设置页需要插槽与配置表单两个浏览器端服务。 */
		const inject = [
			"slots",
			"configForms",
			"remote",
			"remote.session"
		];
		/**
		* 挂载设置页。
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
			ctx.effect(() => ctx.slots.inject(SETTINGS_SLOT, () => ctx.slots.register({
				name: SETTINGS_SLOT,
				id: "subagent-intro",
				order: 0,
				label: () => "子代理介绍"
			}, page)), "subagent-intro:settings-page");
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
		* 页面根容器样式。
		*
		* 宽度交给宿主容器决定：插件详情页与设置页的可用宽度不同，自设 maxWidth
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
		* 设置页主体。
		*
		* 同一组件挂在两个插槽上：设置页分页只渲染表单，插件详情页会传入 `view`，
		* 其中 `summary` 只应给出简短摘要。
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
					console.error("[dsh-subagent-intro] 读取模型目录失败", error);
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
			/** 立即发出写入，并把失败原因留在页面状态区。 */
			const write = (0, react.useCallback)(async (ops) => {
				if (ops.length === 0) return;
				const seq = writeSeq.current + 1;
				writeSeq.current = seq;
				inflight.current += 1;
				if (mounted.current) setSave({ kind: "saving" });
				try {
					if (!await form.mutate(ops)) {
						const reason = "宿主拒绝了这次写入；配置可能已在别处被修改，页面已重新读取宿主值。";
						console.error("[dsh-subagent-intro] 配置写入被宿主拒绝", ops);
						if (mounted.current) {
							setSave({
								kind: "failed",
								reason
							});
							if (seq === writeSeq.current) setOverride(null);
						}
						return;
					}
					if (mounted.current && seq === writeSeq.current) setSave({ kind: "saved" });
				} catch (error) {
					const reason = error instanceof Error ? error.message : String(error);
					console.error("[dsh-subagent-intro] 配置写入失败", error);
					if (mounted.current) {
						setSave({
							kind: "failed",
							reason
						});
						if (seq === writeSeq.current) setOverride(null);
					}
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
