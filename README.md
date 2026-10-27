# Lumi Glass · 液态玻璃组件库 v1.2.0

> 作者：**赵鑫飞** · 一套遵循 Apple「Liquid Glass」材质规范的纯 CSS 组件库

遵循 Apple HIG「Liquid Glass」思路的组件库：CSS 组件 + **自研 WebGL 液态玻璃引擎**（SDF + 折射 + 色散 + 霜化，全站默认 `aurora` 动态壁纸）。手机端与网页端两套组件、明暗双主题、零构建依赖。

## 在线预览

**在线演示：<https://zxf123-dev.github.io/lumiglass/>**

| 站点 | 地址 |
|---|---|
| 在线演示（GitHub Pages） | https://zxf123-dev.github.io/lumiglass/ |
| 源码仓库（GitHub） | https://github.com/zxf123-dev/lumiglass |
| 源码仓库（Gitee 镜像） | https://gitee.com/zhao-xinfei/lumiglass |
| npm 包 | https://www.npmjs.com/package/lumiglass |

各页面直接拼在演示地址后即可访问，例如 `https://zxf123-dev.github.io/lumiglass/web.html`、`.../white.html`、`.../docs.html`。

本地跑：任意静态服务器指向仓库根目录即可，例如 `python3 -m http.server 8000`，然后打开 `http://localhost:8000/`。

| 文件 | 内容 |
|---|---|
| `admin.html` | **页面模板：后端管理台**（侧栏 + KPI + 图表 + 数据表格，可直接改用） |
| `landing.html` | **页面模板：产品官网**（Hero + 特性 + Bento + 定价 + CTA，可直接改用） |
| `shop.html` | **页面模板：电商店铺**（促销横幅 + 筛选栏 + 商品网格 + 购物车演示，可直接改用） |
| `starter.html` | **起步模板**：一个真实业务页面骨架（背景层 + 浮动顶栏 + 指标 + 表格 + 内容卡），直接改成自己的产品 |
| `mobile.html` | 手机端案例页：9 套页面模板 + 9 组触控组件 |
| `web.html` | 网页端案例页：9 套布局模板 + 桌面密度组件 + 明暗切换 |
| `docs.html` | **完整使用文档**（接入步骤 / Token / 组件 API / FAQ / 类名速查；示例全部可交互） |
| `white.html` | 白底合辑（全组件总览） |
| `index.html` | 深色原版案例 |

## 文件结构

```
glass/
├─ glass-core.css      通用层（必引）：Token、玻璃基类、按钮、表单、控件、反馈、
│                      内容卡 / 上传区 / 命令面板 / 日期选择 / 时间线 / 步骤条
├─ glass-mobile.css    手机端（触控密度、Tab Bar、抽屉、控制中心、
│                      登录 / 聊天 / 播放器 / 钱包 / 天气模板…）
├─ glass-web.css       网页端（桌面密度、浮动顶栏、应用框架、Bento、表格、
│                      登录分屏 / 文章阅读 / 看板 / 收件箱…）
├─ glass-templates.css 页面模板扩展（管理台图表 / 官网 Hero / 商品卡，
│                      供 admin / landing / shop 三个模板页使用）
├─ glass-lg.css        .lg 材质层（与液态引擎配套，案例页必引）
├─ glass-stage.css     仅案例/文档页的展示台，业务页面不需要
├─ glass.js            壁纸 aurora、弹簧按压、主题、Toast
├─ site-topbar.js      全站浮动顶栏行为（导航、主题按钮、移动端抽屉，所有页面都引）
├─ favicon.svg         站点图标
├─ glass-liquid-engine.js  WebGL 折射引擎（Glass UI registry 同源）
└─ glass-webgl.js      全站引导 + autoGlass（引即启用，关：data-lg-engine="off"）

starter.html           起步模板（推荐从这里开始改）
admin.html             页面模板：后端管理台（可直接改用）
landing.html           页面模板：产品官网（可直接改用）
shop.html              页面模板：电商店铺（可直接改用）
mobile.html            手机端案例页
web.html               网页端案例页
docs.html              使用文档
white.html             白底合辑（历史存档：内联旧版样式，仅作视觉对照，勿在此页上开发）
index.html             深色原版案例（历史存档：内联旧版样式，仅作视觉对照）
lumiglass/             npm 包（与 glass/ 同源同版本，发布用；改代码请改 glass/ 再同步）
docs-test.html         内部自检页（全量组件回归测试，交付时不需要带上）
LICENSE                MIT 许可
```

> 交付给别人时，把 `glass/` + `starter.html` + `docs.html` + 两个案例页 + `LICENSE` 一起打包即可；
> `docs-test.html` 是内部自检页、`white.html` / `index.html` 是历史存档页，交付不需要带上；
> `.workbuddy/` 是本机工作记录，不要带上。

## 三步接入

```html
<link rel="stylesheet" href="glass/glass-core.css">
<link rel="stylesheet" href="glass/glass-lg.css">
<link rel="stylesheet" href="glass/glass-web.css">   <!-- 或 glass-mobile.css -->

<body class="web" data-wallpaper="aurora">
<script src="glass/glass.js"></script>
<script src="glass/site-topbar.js"></script>          <!-- 页面用到浮动顶栏时引入 -->
<script src="glass/glass-liquid-engine.js"></script>
<script src="glass/glass-webgl.js"></script>
```

最小示例：

```html
<div class="glass" style="padding:20px;border-radius:20px">
  <h3>我的第一块玻璃</h3>
  <p>把它放在有内容的背景上，折射才会出现。</p>
</div>
```

### 从起步模板开始（推荐）

打开 `starter.html`，它已经是一个能跑的真实页面：背景层 → 浮动顶栏 → 指标 → 表格 → 侧栏卡片。
替换顺序：

1. `.page-bg`：换成你的主视觉（照片 / 品牌渐变 / 网格都行）
2. `.topbar-web`：改品牌名与导航
3. `.wrap` 里的内容：换成你的业务模块，组件从 `docs.html` 第 06 章抄
4. `:root` 里的 `--lg-blue` 等 Token：换成品牌色

## 核心概念（30 秒版）
- **玻璃只用于控制层**：导航、工具条、弹窗、悬浮按钮。正文与表格区用近乎不透明的底。
- **玻璃必须有内容可折**：放在照片、彩色渐变或网格背景上，否则退化成白框。
- **不嵌套**：玻璃里不放玻璃（控制中心是唯一例外，内层用 `.glass.thin`）。
- **三种变体**：`.glass`（regular）· `.glass.thin`（嵌套用）· `.glass.clear`（照片之上）。
- **明暗主题**：`data-theme="dark"` 一键切换，或跟随系统；全部 Token 自动适配。

## 常用组件速查

| 分类 | 类名 |
|---|---|
| 按钮 | `.btn` `.primary` `.tinted` `.danger` `.ghost` `.sm` `.icon` `.loading` `.splitbtn` `.fab` |
| 表单 | `.field` `.searchbar` `.selectbox` `.ta` `.combo` `.chips` `.chip` `.strength` `.fieldgroup` `.dropzone` |
| 控件 | `.sw` `.seg` `.slider` `.stepper` `.check` `.tile` `.rate` `.swatches` |
| 手机导航 | `.navbar` `.large-title` `.tabbar` |
| 网页导航 | `.topbar-web` `.pagehead` `.crumbs` `.utabs` `.pager` `.acc` `.dd` `.sidebar` |
| 容器 | `.list` `.notice` `.card` `.cover` `.empty` `.appframe` `.bento` `.tablecard` `.pricing` `.metric` `.tl` `.steps` |
| 弹层 | `dialog.alert` `.sheet` `.actionsheet` `.control-center` `.toast` `.tip` `.cmdk` |
| 反馈 | `.banner` `.sk` `.progress` `.ring` `.spinner` `.badge` `.pill` `.steps` `.tl` |
| 扩展 | `.dropzone` `.cmdk` `.datepicker` `.avatar` `.dots` `.wallet-card` `.kanban` `.inbox` `.authsplit` `.article` |

完整 API（结构、变体、注意事项）见 `docs.html` 第 06 章（含 6.9 模板组件），全部 130+ 类名的速查表见第 14 章。

## 定制主题

在 `glass-core.css` 之后覆盖 Token 即可，组件规则不需要动：

```css
:root {
  --lg-blue: #7c5cff;      /* 你的品牌色 */
  --lg-radius: 20px;       /* 圆角性格 */
  --lg-blur: 14px;         /* 磨砂强度 */
}
```

## 兼容性

- **Chrome / Edge 76+**：完整体验（磨砂 + 边缘折射）
- **Safari / iOS、Firefox**：自动降级为磨砂（已内置 `-webkit-` 前缀）
- **不支持 backdrop-filter**：`@supports` 兜底为高不透明底，保证可读
- 系统级「减少透明度 / 减少动效」均自动适配

## 性能要点

- 同屏玻璃数量：旗舰手机 ≤12、中端手机 ≤8、桌面 ≤20
- 长列表、相册网格等批量内容**不要**套玻璃
- 祖先元素上的 `filter` / `isolation` / `contain` 会截断折射链
- 详见 `docs.html` 第 09 章

## 许可

MIT，见 `LICENSE`。可自由用于个人与商业项目，保留版权声明即可。

本项目的全部代码（含 `glass-liquid-engine.js` 渲染引擎）均为原创实现，不含任何第三方代码。

## 版本

v1.2.0 · 2026-10 · MIT 风格许可，可自由用于个人与商业项目。

### v1.2.0 更新

- **自研 WebGL 液态引擎全站替换**：SDF 圆角矩形 + 多项式平滑并集 + 解析梯度折射 + RGB 色散，渲染管线全部原创，第三方代码清零；契约与原 `glass-webgl.js` 100% 兼容，`data-glass` 标记方式不变
- **指针驱动的边框光效**：指针投影到形状边框最近点，该处一段边框被点亮（父/子组件同时响应，远端控件不误亮）；光斑半径随元素短边缩放，小按钮局部亮、大面板亮一段弧，移动带轻微拖尾
- 修复玻璃外扩（`grow`）时中心偏移：中心改用元素几何中心，外扩只向外长边，消除「内容不居中 / 最外圈偏心」
- 修复滑块轨道与进度条丢失：纯色件交回 DOM 绘制（引擎画布位于页面最底层，任何带自身背景的容器都会遮住它）
- 修复控制中心磁贴外层多余光环：磁贴不再外扩玻璃，恢复单圈
- 移除 `glass-lg.css` 中对 pure-solid 件的背景 kill 规则；引擎 `MAXG` 上限 32 → 48

### v1.1.1 修复

- **性能：修复滚动卡顿**（实测滚动中 5fps → 满帧）：滚动帧不再读取布局——整页滚动时元素位置缓存为文档坐标、仅做 `坐标 − scrollY` 平移；页面内滚动区（侧栏/表格）同样缓存位置并在滚动期间冻结壁纸纹理上传；静止动画（指针追光、弹簧按压）仍逐帧读取，精确无损失；页面隐藏时暂停渲染（GPU 占用归零）
- 修复暗色下分页器选中页码白底白字不可读（`.pager button.on` 补 `[data-theme="dark"]` 覆盖）
- 修复开关开启态「绿胶囊没有旋钮」：旋钮不再交给 WebGL 引擎绘制（引擎画布在 DOM 之下，不透明轨道会挡住它），保留原生白色胶囊旋钮
- 统一 `glass/` 与 `lumiglass/` 双份源码（此前 glass-core.css 与 glass-webgl.js 已分叉，现以最优版本合并后双向同步）
- 修复 `index.html` 暗色主题失效（`html.dark` 选择器永不命中 → `html[data-theme="dark"]`）
- 修复 `docs-test.html` 未闭合的 `.specs.phones` 与多余 `</section>`
- 修复 `glass.js` 的 `LiquidGlass.refresh()` 重复绑定全局监听（pointerdown / pointermove / scroll 泄漏）
- 补 `glass-lg.css` 暗色主题下分段控件选中态的样式（此前为硬编码纯白）
- 清理 `index.html` / `white.html` 中无效的 `backdrop-filter: url()` 写法（Chromium 会整条丢弃）
- `white.html` / `index.html` 标注为历史存档页；README 文件结构补齐 `site-topbar.js`、`favicon.svg`、`lumiglass/` 等

### v1.1 更新

- 手机端新增 5 套页面模板：登录/注册、聊天会话、全屏播放器、钱包支付、天气（共 9 套）
- 网页端新增 4 套布局模板：登录分屏、文章阅读、看板 Kanban、邮件收件箱（共 9 套）
- 新增扩展组件：上传拖放区、⌘K 命令面板、日期选择、头像（状态点）、轮播指示点
- 时间线 / 步骤条从网页端提升为两端通用（core）
- 文档全面升级：每个组件都有真实可交互效果、新增模板组件参考（6.9）与 130+ 类名速查表
- 案例页与文档页均支持明暗切换（手机端新增）
