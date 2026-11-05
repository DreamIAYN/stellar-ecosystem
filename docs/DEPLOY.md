# 部署

## 单机 Docker（推荐）

```bash
docker compose up --build -d
curl http://127.0.0.1:8787/api/health
```

生产镜像由一个 Node 进程同时提供 SPA 与 `/ws` 信令。要放到公网：

1. 使用 Caddy / Nginx / Traefik 终止 TLS。
2. 反向代理 `/` 与 `/ws` 到 `127.0.0.1:8787`，并为 WebSocket 保留 `Upgrade` / `Connection` 头。
3. 摄像头、麦克风与屏幕共享要求 **HTTPS**（`localhost` 例外）。
4. 跨公网 WebRTC 建议配置 TURN（见下）。

Caddy 示例：

```caddyfile
stellar.example.com {
  reverse_proxy 127.0.0.1:8787
}
```

Nginx 关键片段：

```nginx
location / {
  proxy_pass http://127.0.0.1:8787;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
location /ws {
  proxy_pass http://127.0.0.1:8787;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_read_timeout 3600s;
}
```

## TURN

严格 NAT 下 P2P 可能失败。部署 coturn 后：

```bash
TURN_URL=turn:turn.example.com:3478 \
TURN_USERNAME=stellar \
TURN_CREDENTIAL='strong-secret' \
pnpm start
```

`GET /api/ice` 会返回 STUN/TURN 配置（当前前端使用内置 STUN；如需动态 TURN，可在 `useMeeting.ts` / `useRemote.ts` 中改为请求该端点）。

## 静态站点 + 独立信令

```bash
pnpm --filter @stellar/web build   # apps/web/dist
pnpm --filter @stellar/server build
PORT=8787 node apps/server/dist/index.js
```

将 `apps/web/dist` 交给任意静态托管，并把 `/ws` 代理到信令服务，前端使用同源 `/ws`。若分离域名，需要修改 `useMeeting.ts` / `useRemote.ts` 的 WebSocket 地址，并在服务端增加 CORS/来源校验。

## 反向代理与安全

- 设置 `X-Forwarded-For`，服务端日志会记录房间加入来源。
- 房间号不是安全凭证，敏感会议建议配合 HTTPS 与随机房间号。
- 信令服务不落盘媒体内容；如启用 TURN，中继流量按 coturn 策略处理。
- 不要在前端构建中写入服务商 API Key。

## 备份

控制台 → 数据与迁移 → 导出完整备份（Zip，含 Blob）。备份文件包含 AI Key，请妥善保管。
