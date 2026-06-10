# AI 桌面宠物 MVP 全量构建方案

## Context

所有产品定义文档（MVP CutLine / 技术选型 / 边界细化 / 人格定义）已完成，5 个技术 Spike 全部通过验证（Tauri 透明窗口 + 鼠标穿透、文件拖拽、Live2D 渲染、PDF 提取、LLM 长文本摘要）。spike-tauri-real 中已有完整的投喂 Pipeline 可运行。现在进入正式 MVP 项目开发阶段。

**目标**：创建 `d:\Desktop\AI桌面宠物\ai-desktop-pet\` 项目，从 spike 代码迁移+新写，构建完整可运行的 MVP。

---

## Task 1: 项目脚手架搭建

创建 Tauri 2 + React 19 + TypeScript + Vite 6 项目骨架。

**创建/编辑文件：**
- `package.json` — 依赖: `@tauri-apps/api ^2`, `react ^19`, `pixi.js 7.4.3`(固定版本), `pixi-live2d-display ^0.4`, `openai ^6`, `pdfjs-dist ^5`, `js-tiktoken ^1`, `marked ^12`
- `src-tauri/Cargo.toml` — tauri 2 (features: `tray-icon`), serde, serde_json, base64
- `src-tauri/tauri.conf.json` — 窗口 350×450, transparent, no decorations, alwaysOnTop, dragDropEnabled
- `src-tauri/build.rs` — 直接 port
- `vite.config.ts`, `tsconfig.json`, `index.html` — 从 spike-tauri-real port

**验证**: `npm install` 成功，目录结构就位

---

## Task 2: Rust 后端 — 窗口 + 命令 + 托盘

**Port 来源**: `spike-tauri-real/src-tauri/src/lib.rs`

**文件：**
- `src-tauri/src/main.rs` — 入口，调用 `lib::run()`
- `src-tauri/src/lib.rs` — 模块声明 + `run()` Builder + 系统托盘(Show/Settings/Quit) + 事件路由
- `src-tauri/src/commands.rs` — `read_file`, `get_window_info`, `toggle_click_through`, `toggle_always_on_top`, `close_window`, `save_window_position`, `load_window_position`
- `src-tauri/src/window.rs` — 文件拖拽事件处理(从 spike port)、窗口位置保存/恢复、WindowEvent 监听
- `src-tauri/icons/` — 从 spike 迁移 icon.ico + icon.png

**关键新增（相比 spike）：**
- 系统托盘 `TrayIconBuilder` + 菜单(显示/设置/退出)
- 窗口位置持久化到 `window_state.json`
- 右键事件 emit 到前端

**验证**: `cargo build` 成功，`npm run tauri dev` 显示透明置顶窗口 + 托盘图标

---

## Task 3: 前端核心模块 — 类型 + 配置 + 知识库

**Port 来源**: `spike-tauri-real/src/lib/` 下的 types.ts, config.ts, knowledge.ts

**文件：**
- `src/lib/types.ts` — port spike 所有类型 + 新增 `CoreMemory`, `Settings`, `ChatMessage`, `AppView`
- `src/lib/config.ts` — port limits + petMessages，移除硬编码 llmConfig（改为运行时从 settings 读取）
- `src/lib/knowledge.ts` — 直接 port（createEmptyProfile, addFileToProfile, getRecentFilesForContext, getTopicsSummary）

**验证**: `npx tsc --noEmit` 通过

---

## Task 4: 服务层 — LLM + 文件解析 + 持久化 + Pipeline

**Port 来源**: spike 的 summarizer.ts, extractor.ts, pipeline.ts

**文件：**
- `src/services/fileParser.ts` — port spike extractor.ts（pdfjs-dist worker + txt/md/pdf 提取）
- `src/services/llm.ts` — port spike summarizer.ts + **新增** `chatCompletion()` 用于文本对话
- `src/services/memory.ts` — **新写**：通过 Tauri plugin-fs 读写 settings.json / core_memory.json
- `src/services/pipeline.ts` — port spike pipeline.ts（processFile, processFiles, firePass2），llmConfig 从参数传入

**关键新增：**
- `memory.ts`: `loadSettings()`, `saveSettings()`, `loadCoreMemory()`, `saveCoreMemory()`, `createEmptyCoreMemory()`
- `llm.ts`: `chatCompletion(config, systemPrompt, messages[])` 支持文本对话

**验证**: 能读写 JSON 文件，能提取 PDF 文本，能调 LLM API

---

## Task 5: Live2D 宠物组件 + 状态 Hook

**Port 来源**: `spike-live2d/src/App.tsx` (Live2D 部分) + `spike-tauri-real/src/hooks/useFeedingPipeline.ts`

**文件：**
- `src/components/Pet.tsx` — PixiJS Application(backgroundAlpha:0) + Live2DModel.from(CDN_URL) + idle/thinking/done 动画切换
- `src/hooks/usePetState.ts` — port useFeedingPipeline.ts + 扩展接受 settings 参数

**Live2D 模型**：MVP 使用 Haru CDN URL，motion 映射: idle→'idle', thinking→'tap_body', done→'tap_head'

**关键约束**: pixi.js 必须固定 7.4.3，不能升级到 v8（pixi-live2d-display 0.4 不兼容）

**验证**: 宠物 Live2D 模型在透明背景上渲染，idle 动画播放，可切换状态

---

## Task 6: UI 组件 — 气泡 + 输入框 + 右键菜单 + 设置 + 引导

**新写组件：**

- `src/components/Bubble.tsx` — 摘要/进度/错误/对话气泡，自动消失(8s)，话题标签
- `src/components/InputBox.tsx` — 双击触发文本输入，Enter 发送，Escape 关闭
- `src/components/ContextMenu.tsx` — 右键菜单：投喂文件 / 对话 / 设置 / 退出
- `src/components/Settings.tsx` — 设置面板（API Key / Base URL / Model / 宠物名 / 用户名 / 隐私提示）
- `src/components/Onboarding.tsx` — 首次引导：取名 → 配 API Key → 简介功能

**验证**: 各组件独立渲染和交互正常

---

## Task 7: App 编排 + 对话 + System Prompt

**文件：**
- `src/prompts/system.ts` — 从 `宠物人格定义.md` 提取 MVP System Prompt，模板函数动态注入 core_memory
- `src/hooks/useChat.ts` — openChat / sendMessage / chatHistory（仅当前会话）
- `src/hooks/useSettings.ts` — load/save settings，isFirstRun 检测
- `src/App.tsx` — 根组件，编排所有子组件
  - 启动: 检查 settings.json → 不存在则显示 Onboarding
  - 主视图: Pet + Bubble 叠加
  - 事件: 拖文件→pipeline, 双击→聊天, 右键→菜单
  - 鼠标穿透管理: UI 面板打开时关闭穿透，仅宠物显示时开启
- `src/main.tsx` — React 入口
- `src/styles/app.css` — 从 spike styles.css port + 新增组件样式

**验证**: 完整端到端：引导 → 宠物 → 投喂 → 摘要 → 对话 → 菜单 → 设置 → 重启后记忆保持

---

## Task 8: 打磨 + 窗口位置记忆 + 最终集成

- 窗口位置保存/恢复（防抖，保存到 window_state.json）
- 错误处理：断网检测、API Key 无效提示、文件格式/大小错误气泡
- 人格后处理过滤：检测禁语（"作为AI"、"好的呢"、"亲"等）→ 替换为安全表达
- 性能检查：内存 <150MB、CPU idle <3%、启动 <2s
- 图标：使用 spike 已有的 icon.ico/icon.png

**验证**: 全功能回归测试 + 性能预算达标

---

## 风险与应对

| 风险 | 应对 |
|------|------|
| pixi-live2d-display 与 pixi.js v8 不兼容 | 固定 pixi.js 7.4.3，spike 已验证 |
| Tauri WebView 的 WebGL 性能 | 缩小 canvas 尺寸，关闭抗锯齿 |
| npm proxy 不通 | 删除 proxy 配置，直接连 registry |
| OpenAI API CORS | spike 已验证可用，备选走 Rust reqwest |
| C 盘空间不足 | 项目在 D 盘，cargo clean 及时清理 |

---

## 关键参考文件

- `spikes/spike-tauri-real/src-tauri/src/lib.rs` → Rust 后端主要 port 源
- `spikes/spike-tauri-real/src/lib/` → 前端 services/lib 主要 port 源
- `spikes/spike-tauri-real/src/hooks/useFeedingPipeline.ts` → 状态管理 port 源
- `spikes/spike-live2d/src/App.tsx` → Live2D Pet 组件提取源
- `宠物人格定义.md` → System Prompt 模板 + 禁语清单
- `MVP-CutLine.md` → 数据模型 + 用户旅程 + 错误处理规格
