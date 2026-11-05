# 贡献指南

感谢你愿意一起把星环做得更好。

## 开发

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm build
```

- Node.js 22+，pnpm 10/11。
- 前端在 `apps/web`，信令在 `apps/server`，桌面壳在 `apps/desktop`（默认不安装依赖）。
- 新增应用：在 `src/apps/` 建目录，导出默认组件，并在 `registry.tsx` 与 `AppRenderer.tsx` 注册。
- 新增跨应用能力：优先扩展 `core/ecosystem.ts`，不要在应用间直接 import 组件。

## 代码约定

- TypeScript strict；避免 `any`（Web Speech API 等浏览器差异可局部使用并注释）。
- 文件引用只传 `fileId`；二进制走 IndexedDB。
- UI 文案以中文为主，保留英文技术标签。
- 所有演示素材必须由代码生成，不能引入第三方版权图片。
- 不要声称实现了浏览器无法做到的能力；在 UI 中明确限制。

## 提交

- 一个 PR 聚焦一个能力。
- 附上截图或录屏（桌面 + 移动）。
- 更新相关文档与 `THIRD_PARTY_NOTICES.md`。
- 至少通过 `pnpm typecheck && pnpm build`。

## 许可证

贡献即同意以 Apache-2.0 许可发布。
