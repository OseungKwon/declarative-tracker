---
'declarative-tracker': minor
---

Add `schema` to event definitions. Pass any Standard Schema (zod, valibot, arktype, ...) and, with `debug: true`, every `fire()` validates the merged params and warns about issues. `defineEvent` infers the params type from the schema's output.
