# Contributing to Stellar

Thanks for helping. Stellar is a local-first PWA monorepo; keep changes small and verifiable.

## Development

```bash
git clone https://github.com/DreamIAYN/stellar-ecosystem.git
cd stellar-ecosystem
pnpm install
pnpm dev
```

- Web: `http://127.0.0.1:5173`
- Edge/signaling: `http://127.0.0.1:8787`

## Before opening a PR

```bash
pnpm typecheck
pnpm build
```

- Keep UI copy in Chinese unless the feature is intentionally bilingual.
- Do not commit API keys, tunnel tokens, user scans, or `.env` files.
- New apps must register through the existing app registry and use `ecosystem` for cross-app calls.
- Preserve the local-first rule: by default, user content stays on the device.

## License

By contributing, you agree that your contribution is licensed under Apache-2.0.
