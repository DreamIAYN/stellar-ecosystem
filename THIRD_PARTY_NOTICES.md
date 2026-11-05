# 第三方软件与许可

星环 Stellar 以 Apache-2.0 发布。以下为主要运行时/构建依赖及其许可证（以各项目仓库为准）：

| 依赖 | 用途 | 许可证 |
| --- | --- | --- |
| React / React DOM | UI | MIT |
| Vite | 构建 | MIT |
| TypeScript | 类型系统 | Apache-2.0 |
| Zustand | 状态管理 | MIT |
| lucide-react | 图标 | ISC |
| CodeMirror 6 系列 | 代码编辑器 | MIT |
| marked | Markdown 渲染 | MIT |
| DOMPurify | HTML 清洗 | Apache-2.0 / MPL-2.0 |
| jsPDF | PDF 导出 | MIT |
| JSZip | 备份 Zip | MIT / GPL-3.0（双许可，本项目按 MIT 使用） |
| Tesseract.js | OCR | Apache-2.0 |
| Express | 静态服务 | MIT |
| ws | WebSocket | MIT |
| Manrope | 拉丁字体 | OFL-1.1 |
| Noto Sans SC | 中文字体 | OFL-1.1 |
| Noto Color Emoji（子集） | Emoji 字形 | OFL-1.1 |
| Electron（可选桌面壳） | 桌面容器 | MIT |

## 字体

- Manrope：SIL Open Font License 1.1。
- Noto Sans SC：SIL Open Font License 1.1。
- Noto Color Emoji 的子集由 `fontTools` 生成，仅包含本项目 UI 使用的 emoji，仍遵循 OFL-1.1。

## 演示素材

- `core/seed.ts`、扫描仪示例、朋友圈图片均由代码（SVG / Canvas）实时生成。
- 远程媒体示例使用 MDN 的 CC0 示例资源（`mdn.github.io/shared-assets`），仅用于播放器演示；离线环境可自行替换。

## 商标

星环 Stellar 与微信、腾讯会议、ToDesk、扫描全能王无任何关联，未使用其商标、图标或私有资源。相关名称仅用于说明功能参考。
