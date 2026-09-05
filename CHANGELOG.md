# declarative-tracker

## 0.2.0

### Minor Changes

- a86aef4: Add `createTrackAttrs<Events>()`. Bind `trackAttrs` to your event map once and every call checks the key and params without spelling out generics.
- 0c168e5: Add `schema` to event definitions. Pass any Standard Schema (zod, valibot, arktype, ...) and, with `debug: true`, every `fire()` validates the merged params and warns about issues. `defineEvent` infers the params type from the schema's output.
