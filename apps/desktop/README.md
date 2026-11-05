# Stellar Desktop Shell（可选）

Electron 壳用于把已构建的 Web 应用包装成桌面应用，并提供原生窗口、菜单与后续 OS 级远控代理的接入点。

```bash
# 先构建 Web
pnpm build

cd apps/desktop
npm install        # 会下载 Electron
npm start
```

默认加载 `../web/dist/index.html`。也可以指向已部署地址：

```bash
STELLAR_URL=https://stellar.example.com npm start
```

## 安全

- `contextIsolation: true`、`nodeIntegration: false`。
- 预加载脚本仅暴露只读平台信息。
- 若要实现系统级键鼠注入，请新增独立、显式授权的原生模块，并在 UI 中说明权限范围。

## 后续工作

- 使用 `<webview>` 替换浏览器 iframe，绕过 X-Frame-Options。
- 托盘、全局快捷键、开机自启。
- 原生文件选择与自动更新。
