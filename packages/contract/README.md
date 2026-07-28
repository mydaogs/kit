# @mydaogs/contract

**Versioned backend wire contract**

The response envelope, error classes and formatters, redaction unions, the allowlisted credential-free read lane, a build-time contract version probe, and the fetch factory that enforces all of it at runtime.

## Documentation

These docs are the single source of truth for this package and ship with it:

- [`ARCH-api-response-wrapper.md`](./ARCH-api-response-wrapper.md)
- [`ARCH-app-business-error.md`](./ARCH-app-business-error.md)
- [`ARCH-backend-api-contract.md`](./ARCH-backend-api-contract.md)
- [`ARCH-server-actions-pattern.md`](./ARCH-server-actions-pattern.md)
- [`backend-app-extraction.md`](./backend-app-extraction.md)

## Install

```bash
pnpm add @mydaogs/contract
```

Peer dependencies are listed in `package.json` and are deliberately not bundled

## Cross-cutting docs

Rules, architecture decisions, and patterns that belong to no single package live in
[`@mydaogs/shared-docs`](https://www.npmjs.com/package/@mydaogs/shared-docs)
