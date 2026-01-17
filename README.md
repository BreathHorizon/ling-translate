# Ling Translate

Ling Translate 是一款功能强大的 Chrome 浏览器扩展，为用户提供智能网页翻译服务。该扩展支持自定义 AI 模型，允许用户配置多种翻译 API 和模型，以满足不同的翻译需求。无论您是个人用户还是企业用户，Ling Translate 都能为您提供高效、准确的翻译体验。

## 核心特性

Ling Translate 作为一款现代化的翻译扩展，具备以下核心特性：

**多 API 支持**：Ling Translate 支持配置多个翻译 API，包括 OpenAI、Azure、Google、Anthropic 等主流 AI 服务提供商。您可以为不同的使用场景配置不同的 API，实现灵活的翻译策略。

**自定义模型配置**：每个 API 下可以配置多个模型，每个模型都支持独立的系统提示词和用户提示词设置。这种设计允许您针对不同的翻译任务优化模型行为，例如学术论文翻译、日常对话翻译或技术文档翻译等。

**智能站点偏好**：Ling Translate 支持针对不同网站设置翻译偏好，包括「始终翻译」「从不翻译」和「询问是否翻译」三种模式。您可以为常用网站设置特定偏好，避免在不需要的页面触发翻译。

**配置导入导出**：所有设置支持导出为 JSON 文件，方便在不同设备间同步配置或备份您的个性化设置。

**开发者模式**：内置开发者选项，支持日志记录功能，便于调试翻译过程中的问题和优化翻译效果。

**隐私优先设计**：所有翻译请求直接由您的 API 密钥处理，扩展本身不会存储您的翻译数据或 API 密钥，确保数据安全。

## 技术架构

Ling Translate 采用现代化的技术栈构建，确保代码质量和可维护性：

| 技术类别 | 技术选型 | 说明 |
|---------|---------|------|
| 前端框架 | React 18 | 使用函数式组件和 Hooks 进行状态管理 |
| 状态管理 | Zustand 5.x | 轻量级状态管理库，用于管理用户设置 |
| 路由管理 | React Router DOM 7.x | 处理选项页面的路由逻辑 |
| UI 动画 | Framer Motion 12.x | 提供流畅的界面动画效果 |
| 样式方案 | Tailwind CSS 3.x | 原子化 CSS 框架，实现响应式设计 |
| 构建工具 | Vite 6.x | 极速开发服务器和生产构建 |
| 类型系统 | TypeScript 5.x | 强类型支持，提升代码质量 |
| 扩展打包 | @crxjs/vite-plugin | Chrome 扩展专用打包插件 |
| 代码检查 | ESLint 9.x | 代码规范检查和自动修复 |
| 图标库 | Lucide React | 一致的 SVG 图标集 |

扩展采用 Manifest V3 标准，支持内容脚本、后台服务Worker、弹出窗口和选项页面等多种扩展类型。

## 项目结构

```
ling-translate/
├── .trae/                          # Trae IDE 配置文件目录
│   ├── documents/                  # 项目文档
│   │   └── Add Import_Export Configuration Feature.md
│   └── rules/                      # IDE 规则配置
├── dist.crx                        # 扩展 CRX 格式分发包
├── eslint.config.js                # ESLint 配置文件
├── index.html                      # 开发服务器入口 HTML
├── package.json                    # 项目依赖和脚本配置
├── postcss.config.js               # PostCSS 配置
├── tailwind.config.js              # Tailwind CSS 配置
├── tsconfig.json                   # TypeScript 配置
├── vite.config.ts                  # Vite 构建配置
├── test.html                       # 测试页面
├── scripts/                        # 构建脚本目录
│   ├── bump-version.js             # 版本号更新脚本
│   └── update-build.js             # 构建更新脚本
├── public/                         # 静态资源目录
│   └── favicon.svg                 # 扩展图标
└── src/                            # 源代码目录
    ├── main.tsx                    # 应用入口文件
    ├── vite-env.d.ts               # Vite 类型声明
    ├── manifest.json               # 扩展清单文件
    ├── index.css                   # 全局样式
    ├── App.tsx                     # 主应用组件
    ├── lib/                        # 工具库目录
    │   ├── types.ts                # TypeScript 类型定义
    │   ├── utils.ts                # 通用工具函数
    │   ├── logger.ts               # 日志记录工具
    │   └── storage.ts              # 本地存储操作
    ├── hooks/                      # 自定义 Hooks
    │   └── useTheme.ts             # 主题切换 Hook
    ├── components/                 # 公共组件目录
    │   └── ui/                     # UI 基础组件
    │       ├── Button.tsx          # 按钮组件
    │       ├── Card.tsx            # 卡片组件
    │       ├── Input.tsx           # 输入框组件
    │       └── Modal.tsx           # 模态框组件
    ├── store/                      # 状态管理
    │   └── useStore.ts             # Zustand 状态存储
    ├── background/                 # 后台服务
    │   └── index.ts                # Service Worker 入口
    ├── content/                    # 内容脚本
    │   ├── ContentApp.tsx          # 内容脚本主组件
    │   └── index.tsx               # 内容脚本入口
    ├── popup/                      # 弹出窗口
    │   ├── Popup.tsx               # 弹出窗口组件
    │   ├── index.html              # 弹出窗口 HTML
    │   └── index.tsx               # 弹出窗口入口
    └── options/                    # 选项页面
        ├── Options.tsx             # 选项页面主组件
        ├── index.html              # 选项页面 HTML
        ├── index.tsx               # 选项页面入口
        └── components/             # 选项页面子组件
            ├── Sidebar.tsx         # 侧边栏导航
            ├── ApiConfig.tsx       # API 配置组件
            ├── ModelConfig.tsx     # 模型配置组件
            └── About.tsx           # 关于页面组件
```

## 安装指南

### 环境要求

在开始安装之前，请确保您的开发环境满足以下要求：

- Node.js 版本 18.0 或更高
- npm 版本 9.0 或更高
- Chrome 浏览器版本 88 或更高（支持 Manifest V3）
- 操作系统：Windows、macOS 或 Linux

### 安装步骤

**第一步：克隆项目**

如果您还没有项目代码，请使用 Git 克隆代码仓库：

```bash
git clone https://github.com/your-username/ling-translate.git
cd ling-translate
```

**第二步：安装依赖**

进入项目目录后，执行以下命令安装所有依赖：

```bash
npm install
```

此命令会根据 `package.json` 中的依赖配置，自动下载并安装所有必要的 npm 包。安装完成后，您将在项目根目录下看到一个 `node_modules` 文件夹。

**第三步：开发模式运行**

如果您想在开发模式下运行扩展，使用以下命令：

```bash
npm run dev
```

该命令会执行 `update-build.js` 脚本更新构建配置，然后启动 Vite 开发服务器。开发服务器支持热模块替换（HMR），您对代码的修改会实时反映到扩展中。

开发服务器启动后，您可以在浏览器中访问本地服务器查看扩展效果。要在 Chrome 中加载扩展进行测试，请继续阅读下一节。

**第四步：构建扩展包**

当您完成开发并准备生成正式的扩展包时，执行：

```bash
npm run build
```

此命令会依次执行以下操作：
1. 运行 `bump-version.js` 自动更新版本号
2. 执行 TypeScript 编译检查（`tsc -b`）
3. 使用 Vite 构建生产版本

构建完成后，生成的扩展文件将保存在 `dist` 目录下，包括 CRX 格式的分发包。

### 在 Chrome 中加载扩展

要测试本地开发的扩展，请按照以下步骤在 Chrome 中加载：

1. 打开 Chrome 浏览器，访问 `chrome://extensions/` 进入扩展管理页面
2. 在页面右上角启用「开发者模式」开关
3. 点击「加载已解压的扩展程序」按钮
4. 在弹出的文件选择对话框中，选择项目的 `dist` 目录
5. 扩展加载成功后，您将在扩展列表中看到「Ling Translate」图标

如果扩展加载有问题，请检查控制台输出的错误信息，并确保已正确执行 `npm run build` 命令。

## 使用指南

### 首次配置

安装扩展后，您需要先进行基本配置才能使用翻译功能。请点击扩展图标，选择「打开选项页面」进入设置界面。

在「通用设置」页面，您可以配置以下选项：

**翻译加载动画**：设置在翻译过程中是否显示加载图标。启用后，当扩展处理翻译请求时，会在翻译文本旁边显示动画提示。

**开发者模式**：启用后会显示额外的调试选项，包括 DOM 操作日志、翻译内容日志和网络请求日志。建议仅在排查问题时启用。

### 配置 API

在「API 配置」页面，您可以添加和管理翻译 API：

1. 点击「添加 API」按钮
2. 填写 API 名称（如「OpenAI」）
3. 填写 API 的基础 URL（如 `https://api.openai.com/v1`）
4. 填写 API 密钥
5. 点击「测试连接」验证 API 是否可用
6. 点击「保存」完成配置

配置成功后，您可以在列表中看到已添加的 API。点击编辑图标可以修改 API 配置，点击删除图标可以移除 API。

### 配置模型

在「模型配置」页面，您可以针对每个 API 配置具体的模型：

1. 选择要配置模型的 API
2. 点击「添加模型」或编辑现有模型
3. 配置模型参数：
   - **模型名称**：用于识别的名称
   - **最大 Token 数**：单次请求的最大 token 限制
   - **最大段落数**：单次翻译的段落数量限制
   - **系统提示词**：指导模型翻译行为的系统指令
   - **用户提示词**：具体的翻译请求模板
   - **多段落系统提示词**：处理多段落时的系统指令
   - **多段落用户提示词**：多段落翻译的请求模板

4. 点击「测试模型」验证配置是否正确
5. 点击「保存」保存模型配置

### 导入导出配置

在「通用设置」页面的「配置管理」部分，您可以：

**导出配置**：点击「导出设置」按钮，当前所有设置将下载为 JSON 文件。文件名格式为 `ling-translate-settings-日期.json`。

**导入配置**：点击「导入设置」按钮，选择之前导出的 JSON 文件。导入成功后，所有设置将立即更新。

此功能特别适合在多台设备间同步设置，或在重装系统后快速恢复配置。

### 翻译操作

配置完成后，在任意网页上：

1. 选中文本或将鼠标悬停在文本上方
2. 右键点击，选择「翻译选中文本」
3. 或使用扩展图标打开弹出窗口进行翻译

翻译结果将显示在原页面或弹出窗口中，具体行为取决于您的设置和网站偏好。

## 开发指南

### 代码规范

本项目使用 ESLint 进行代码规范检查。运行以下命令检查代码：

```bash
npm run lint
```

该命令会扫描整个项目，报告不符合规范的代码问题。在提交代码前，请确保所有 lint 错误都已修复。

### 类型检查

使用 TypeScript 编译器进行类型检查：

```bash
npm run check
```

此命令执行 `tsc -b --noEmit`，仅检查类型错误而不生成编译产物。建议在每次提交前运行此命令。

### 添加新功能

如果您想为 Ling Translate 添加新功能，建议遵循以下步骤：

1. **了解现有架构**：首先阅读 `manifest.json` 了解扩展的整体结构，阅读 `types.ts` 了解数据模型。
2. **选择合适的扩展类型**：根据功能类型决定是在内容脚本、后台服务Worker、弹出窗口还是选项页面中实现。
3. **遵循组件模式**：新组件应遵循现有的组件结构，使用 TypeScript 定义类型，使用 Zustand 进行状态管理。
4. **添加样式**：使用 Tailwind CSS 类进行样式设计，保持与现有组件一致的设计风格。
5. **编写测试**：为新功能编写必要的测试用例，确保功能正确性。
6. **更新文档**：如果添加了重要功能，请相应更新 README 文档。

### 调试技巧

**内容脚本调试**：在目标网页上右键选择「检查」，打开开发者工具，在「Console」面板查看内容脚本的输出。

**后台服务Worker调试**：在 `chrome://extensions/` 页面找到 Ling Translate，点击「背景页」链接打开后台服务Worker的开发者工具。

**选项页面调试**：在选项页面右键选择「检查」，打开开发者工具进行调试。

**开发者日志**：在选项页面启用开发者模式后，可以查看 DOM 操作、翻译内容和网络请求的详细日志。

## 配置参考

### 默认设置

```typescript
const DEFAULT_SETTINGS = {
  defaultFromLang: 'auto',      // 默认源语言
  defaultToLang: 'zh-CN',       // 默认目标语言
  defaultModelId: 'default-api:default-model',  // 默认模型
  sitePreferences: {},          // 站点偏好设置
  apiConfigs: [],               // API 配置列表
  showLoadingIcon: true,        // 显示加载动画
  developer: {
    enabled: false,             // 开发者模式开关
    logDom: false,              // DOM 操作日志
    logTranslation: false,      // 翻译内容日志
    logNetwork: false           // 网络请求日志
  }
};
```

### API 配置结构

```typescript
interface ApiConfig {
  id: string;                   // 唯一标识符
  name: string;                 // API 名称
  baseUrl: string;              // API 基础 URL
  apiKey: string;               // API 密钥
  models: ModelConfig[];        // 关联的模型配置列表
}
```

### 模型配置结构

```typescript
interface ModelConfig {
  id: string;                   // 唯一标识符
  name: string;                 // 模型名称
  maxTokens: number;            // 最大 Token 数量
  maxParagraphs: number;        // 最大段落数
  concurrency?: number;         // 并发请求数
  requestsPerSecond?: number;   // 每秒请求限制
  systemPrompt: string;         // 系统提示词
  prompt: string;               // 用户提示词
  systemMultiplePrompt: string; // 多段落系统提示词
  multiplePrompt: string;       // 多段落用户提示词
}
```

### 扩展消息类型

扩展各部分之间通过消息进行通信，主要消息类型包括：

| 消息类型 | 用途 |
|---------|------|
| TRANSLATE_TEXT | 翻译文本请求 |
| OPEN_OPTIONS_PAGE | 打开选项页面 |
| TEST_CONNECTION | 测试 API 连接 |
| TEST_MODEL | 测试模型配置 |

## 常见问题

**问：扩展无法翻译网页怎么办？**

首先检查 API 配置是否正确，确保 API 密钥有效且基础 URL 格式正确。然后在选项页面启用开发者模式，查看控制台日志是否有错误信息。常见问题包括网络连接失败、API 配额用尽或请求格式错误。

**问：翻译结果不理想如何优化？**

您可以尝试调整模型配置中的系统提示词和用户提示词。详细的提示词可以帮助模型更好地理解翻译需求。也可以尝试使用不同的模型或调整 maxTokens 参数。

**问：如何在不同电脑间同步设置？**

使用选项页面的「导出设置」功能将配置导出为 JSON 文件，然后在另一台电脑的扩展中导入该文件即可同步设置。

**问：扩展支持哪些语言？**

扩展本身支持多语言界面。翻译功能支持的语言取决于您配置的 API，大多数主流 AI 翻译服务都支持 100 多种语言。

**问：扩展会收集我的翻译数据吗？**

不会。Ling Translate 遵循隐私优先设计，所有翻译请求直接由您的 API 处理，扩展本身不会存储或收集您的翻译数据或 API 密钥。

## 版本历史

| 版本 | 发布日期 | 主要变更 |
|-----|---------|---------|
| 0.0.4 | 2025-01 | 添加配置导入导出功能、优化开发者模式 |
| 0.0.3 | 2024-12 | 添加多模型支持、改进 UI 界面 |
| 0.0.2 | 2024-11 | 添加 API 测试功能、优化性能 |
| 0.0.1 | 2024-10 | 初始版本发布 |

## 贡献指南

我们欢迎社区贡献者参与项目开发。如果您想贡献代码，请遵循以下指南：

1. Fork 项目仓库
2. 创建您的特性分支（`git checkout -b feature/amazing-feature`）
3. 提交您的更改（`git commit -m 'Add amazing feature'`）
4. 推送到分支（`git push origin feature/amazing-feature`）
5. 打开 Pull Request

在提交代码前，请确保运行 `npm run lint` 和 `npm run check` 通过所有检查。

## 许可证

本项目采用 MIT 许可证开源。您可以自由使用、修改和分发本项目的代码，但需要保留原始的版权声明和许可证文本。

## 联系方式

如果您有任何问题、建议或想参与贡献，请通过以下方式联系：

- 项目 Issues：https://github.com/your-username/ling-translate/issues
- 作者邮箱：support@lingtranslate.dev

感谢您使用 Ling Translate！我们会持续改进产品，为您提供更好的翻译体验。
