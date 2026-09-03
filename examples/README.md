# Examples

Each example links the library from the repo root, so build it first.

```bash
pnpm install
pnpm build
pnpm --filter example-vanilla dev   # http://localhost:5173
pnpm --filter example-react dev
```

| Example                | Shows                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| [`vanilla`](./vanilla) | `createTracker` + `mount`, `data-track-*` attributes, ancestor `data-track-ctx-*`, manual `fire` |
| [`react`](./react)     | `TrackingProvider`, `createTrackingHooks`, `trackAttrs`, elements added after mount              |
