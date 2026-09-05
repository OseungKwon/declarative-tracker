# declarative-tracker

[![CI](https://github.com/oseungkwon/declarative-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/oseungkwon/declarative-tracker/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/declarative-tracker)](https://www.npmjs.com/package/declarative-tracker)
[![license](https://img.shields.io/npm/l/declarative-tracker)](./LICENSE)

Declarative, type-safe event tracking with `data-track` attributes.
One tag, any analytics: GA4, AppsFlyer, Amplitude, or your own adapter. Zero dependencies.

```html
<button data-track="product-click" data-track-product-id="p1">Buy</button>
```

```ts
interface Events {
  'product-click': { productId: string };
}

const events = defineEvents<Events>({
  'product-click': {
    trigger: 'click',
    targets: {
      ga4: (e) => ({ name: 'select_item', params: { item_id: e.params.productId } }),
      amplitude: (e) => ({ eventName: 'Product Click', props: e.params }),
    },
  },
});

const tracker = createTracker({ events, adapters: [ga4, amplitude] });
observe(tracker);
```

The UI says _what happened_. The event map says _where it goes and in what shape_. Adapters do the sending. None of the three knows about the others.

> Status: 0.x. The API is settling and may change between minor versions until 1.0.

## Why

Most tracking code ends up inside the handlers that do the real work. A checkout button after a few months of "just add this event" tends to look like this:

```tsx
async function onCheckout() {
  if (!cart.items.length) return;
  gtag('event', 'begin_checkout', { value: cart.total, currency: 'KRW' });
  AF.logEvent('af_initiated_checkout', { af_price: cart.total, af_currency: 'KRW' });
  try {
    const order = await api.createOrder(cart);
    amplitude.track('Checkout Started', { orderId: order.id, total: cart.total });
    router.push(`/orders/${order.id}`);
  } catch (e) {
    gtag('event', 'checkout_error', { message: String(e) });
    throw e;
  }
}
```

The business logic is four lines. The rest is analytics, and it causes real problems:

- The same fact (`cart.total`) is spelled three ways because each vendor wants its own field names. Rename one and you have to find the other two.
- A vendor SDK that throws or is blocked by an ad blocker can break the checkout, so every call ends up wrapped in its own `try`.
- Marketing asks to add a fourth vendor or move the event from "before the request" to "after". That is a change to checkout code, with a review and a release.
- Tests for `onCheckout` have to mock `gtag`, `AF`, and `amplitude` before they can test the order flow.

declarative-tracker moves that out of the handler. The button carries the intent, the event map carries the vendor mapping, and `onCheckout` goes back to creating the order:

```tsx
<button data-track="checkout-start" data-track-total={cart.total} onClick={onCheckout}>
```

```ts
interface Events {
  'checkout-start': { total: string };
}

const events = defineEvents<Events>({
  'checkout-start': {
    trigger: 'click',
    targets: {
      ga4: (e) => ({
        name: 'begin_checkout',
        params: { value: Number(e.params.total), currency: 'KRW' },
      }),
      appsflyer: (e) => ({
        eventName: 'af_initiated_checkout',
        eventValue: { af_price: Number(e.params.total) },
      }),
      amplitude: (e) => ({
        eventName: 'Checkout Started',
        props: { total: Number(e.params.total) },
      }),
    },
  },
});
```

Adapter errors are isolated from the page, vendor field names live in one file, and the order flow can be tested without an analytics mock in sight.

In short:

- **Markup declares intent.** An element says which event it belongs to and carries its params as attributes. No handlers, no imports, works in plain HTML and SSR.
- **One event map translates to every vendor.** Each event lists its targets. A target turns the domain event into that vendor's payload. Adding a vendor is adding a key.
- **Triggers are built in.** Click, form submit, mount, viewport impression (with minimum visible time and background-tab handling), and scroll depth. Custom triggers plug in through the same interface.
- **Types follow the definition.** Event keys and params are inferred from the map, so a typo in a key or a missing param is a compile error in `fire()`, `trackAttrs()`, and the React hooks.

It is a thin instrumentation layer, not another analytics SDK. It sits in front of GA4, Amplitude, RudderStack, or your own endpoint and stays out of the way.

## Common cases

Each case shows the markup, the line for the `Events` interface, and the entry in `defineEvents<Events>({ ... })`. All of them assume `createTracker({ events, adapters })` and `observe(tracker)` ran once at startup.

### A button click

```html
<button data-track="cta-click">Start free trial</button>
```

```ts
'cta-click': {};
```

```ts
'cta-click': { trigger: 'click', targets: { ga4: { name: 'cta_click' } } },
```

No handler, no params. The target is a static payload.

### A product list: impressions and clicks that share the list name

```html
<ul data-track-ctx-list="recommended">
  <li data-track="product-view" data-track-product-id="p1">…</li>
  <li data-track="product-view" data-track-product-id="p2">…</li>
</ul>
```

```ts
'product-view': { productId: string; list: string };
```

```ts
'product-view': {
  trigger: 'impression',
  options: { threshold: 0.5, minVisibleMs: 1000 },
  targets: {
    ga4: (e) => ({ name: 'view_item', params: { item_id: e.params.productId, item_list_name: e.params.list } }),
  },
},
```

Every item sends `{ productId, list: 'recommended' }` after being at least half visible for one second. Items that scroll past quickly do not count, and neither do items in a background tab.

An element belongs to one event, so clicks go on a child. Move the id up to ctx and both events inherit it:

```html
<li data-track="product-view" data-track-ctx-product-id="p1">
  <a data-track="product-click" href="/p/p1">…</a>
</li>
```

### A form submit with the selected value

```html
<form data-track="signup" data-track-plan="pro">…</form>
```

```ts
signup: {
  plan: 'free' | 'pro';
}
```

```ts
signup: {
  trigger: 'submit',
  targets: { ga4: (e) => ({ name: 'sign_up', params: { method: e.params.plan } }) },
},
```

Update `data-track-plan` when the selection changes; params are read at submit time. In React, `useTrackProps('signup', { plan })` does that without touching attributes.

### How far an article was read

```html
<article data-track="article-read">…</article>
```

```ts
'article-read': {};
```

```ts
'article-read': {
  trigger: 'scroll-depth',
  options: { milestones: [0.25, 0.5, 0.75, 1] },
  targets: { ga4: (e) => ({ name: 'scroll', params: { percent: e.params.scrollDepthPercent } }) },
},
```

Sends once per milestone as the reader scrolls. For a feed that scrolls inside an element, add `container: '#feed'`.

### One event, several vendors, different shapes

```ts
purchase: {
  orderId: string;
  amount: number;
  currency: string;
}
```

```ts
purchase: {
  trigger: 'manual',
  targets: {
    ga4: (e) => ({ name: 'purchase', params: { transaction_id: e.params.orderId, value: e.params.amount } }),
    appsflyer: (e) => ({ eventName: 'af_purchase', eventValue: { af_revenue: e.params.amount, af_currency: e.params.currency } }),
    warehouse: (e) => e.params,
  },
},
```

```ts
tracker.fire('purchase', { orderId: 'o1', amount: 42, currency: 'USD' });
```

The UI fires one domain event. Each vendor gets its own name and field layout. Adding a fourth vendor is one more key; removing one is deleting a key.

### Nothing leaves the page until the user consents

```ts
const tracker = createTracker({
  events,
  adapters: [ga4, appsflyer],
  middleware: [
    (event, next) => {
      if (consent.granted) next(event);
    },
  ],
});
```

Or keep the events flowing and mute one vendor: `tracker.setAdapterEnabled('appsflyer', false)`.

### A React component

```tsx
const { useTrackProps } = createTrackingHooks<typeof events>();

function ProductCard({ product, index }) {
  const track = useTrackProps('product-click', { productId: product.id, position: index });
  return (
    <a {...track} href={product.url}>
      {product.name}
    </a>
  );
}
```

Key and params are type-checked against the event map. The element gets `data-track` and a ref; nothing else is injected.

## Install

```bash
npm install declarative-tracker
# pnpm add declarative-tracker / yarn add declarative-tracker
```

Three entry points:

| Import                      | Contents                                                          | Environment              |
| --------------------------- | ----------------------------------------------------------------- | ------------------------ |
| `declarative-tracker`       | `defineEvents`, `defineEvent`, `createTracker`, `Adapter`, types  | Anywhere (no DOM access) |
| `declarative-tracker/dom`   | `observe`, triggers, `trackAttrs`, `bindParams`, `resolveElement` | Browser                  |
| `declarative-tracker/react` | `TrackingProvider`, hooks, re-exports `trackAttrs`                | React 18.2+ / 19         |

ESM and CJS builds ship with type declarations. React is an optional peer dependency.

## How it works

```
<button data-track="product-click" data-track-product-id="p1">
        │
        │  observe() finds the element and hands it to the trigger named in its event definition
        ▼
   click trigger ──▶ resolveElement() reads key + params from attributes
        │
        ▼
   tracker.fire('product-click', { productId: 'p1' })
        │
        ▼
   middleware chain (optional)
        │
        ▼
   targets: ga4(event) → payload, amplitude(event) → payload
        │
        ▼
   adapters: ga4.send(payload, event), amplitude.send(payload, event)
```

`observe()` runs once. It scans the root, watches the DOM with a `MutationObserver`, and attaches or detaches triggers as elements come and go. Params are read at send time, so attributes can change after the element appears.

## Defining events

Declare the keys and their params once, then define each event:

```ts
import { defineEvents } from 'declarative-tracker';

interface Events {
  'hero-view': { variant: string };
  'page-scroll': {};
  'newsletter-submit': { plan: 'free' | 'pro' };
}

export const events = defineEvents<Events>({
  'hero-view': {
    trigger: 'impression',
    options: { threshold: 0.5, minVisibleMs: 1000 },
    targets: {
      ga4: (e) => ({ name: 'view_hero', params: { variant: e.params.variant } }),
      appsflyer: { eventName: 'af_content_view' },
    },
  },

  'page-scroll': {
    trigger: 'scroll-depth',
    options: { milestones: [0.25, 0.5, 0.75, 1] },
    targets: {
      ga4: (e) => ({ name: 'scroll', params: { percent: e.params.scrollDepthPercent } }),
    },
  },

  'newsletter-submit': {
    trigger: 'submit',
    targets: {
      ga4: (e) => ({ name: 'sign_up', params: { method: e.params.plan } }),
      internal: (e) => (e.params.plan === 'pro' ? { kind: 'lead', ...e.params } : null),
    },
  },
});
```

The interface is the contract: a key missing from the definitions, an extra key, a misspelled param in a target function, or a wrong param in `fire()` is a compile error. The interface is also a readable list of everything the app tracks, which is handy to share with whoever owns the analytics plan.

An event definition has:

- **`trigger`**: when to send. One of the built-in names or a custom one you register. `'manual'` means only `tracker.fire()` sends it.
- **`targets`**: one entry per adapter name. A target is either a static payload or a function of the event. Return `null` or `undefined` to skip that adapter for this event.
- **`options`**: required when the trigger has required options (`scroll-depth` needs `milestones`), optional otherwise.

### Inferring from values instead

If you prefer to keep each event's params next to its definition, call `defineEvents` without the generic and declare params on the entry. Wrap entries that read params in `defineEvent()`, otherwise TypeScript sees `e.params` as `Record<string, unknown>` inside an inline object:

```ts
export const events = defineEvents({
  'hero-view': defineEvent({
    trigger: 'impression',
    params: {} as { variant: string },
    targets: { ga4: (e) => ({ name: 'view_hero', params: { variant: e.params.variant } }) },
  }),
  'page-scroll': { trigger: 'scroll-depth', options: { milestones: [1] }, targets: {} },
});
```

`params` here is a type-only declaration and is never read at runtime. Both styles produce the same map, and everything downstream (`fire`, `trackAttrs`, hooks) works the same.

### The event object

Target functions and middleware receive a `TrackingEvent`:

```ts
interface TrackingEvent<P> {
  key: string; // 'product-click'
  trigger: TriggerName; // 'click' | 'submit' | 'mount' | 'impression' | 'scroll-depth' | 'manual'
  params: P; // merged from attributes, bindParams, and fire()
  context: TrackingContext; // tracker-level context at send time
  timestamp: number;
  element?: Element; // present when a DOM trigger sent it
}
```

## Markup

| Attribute                       | Meaning                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| `data-track="key"`              | The event key. Marks the element as tracked.                                         |
| `data-track-<name>="value"`     | One param. `data-track-product-id` becomes `productId`. Values are strings.          |
| `data-track-params='{"a":1}'`   | Params as a JSON object, for non-string values or many params at once.               |
| `data-track-ctx-<name>="v"`     | On any ancestor. Merged into every tracked descendant. Use for list names, sections. |
| `data-track-ctx='{"list":"x"}'` | Ancestor context as JSON.                                                            |

When the same name appears more than once, later wins in this order: ancestor ctx (outermost first) → individual attributes → JSON params → `bindParams()`.

```html
<section data-track-ctx-list="featured">
  <button data-track="product-click" data-track-product-id="p1">A</button>
  <button data-track="product-click" data-track-product-id="p2">B</button>
</section>
<!-- both clicks send { list: 'featured', productId: '...' } -->
```

The `data-track` prefix is configurable: `observe(tracker, { prefix: 'data-analytics' })` makes every attribute `data-analytics-*`.

### Params without serialization

Attributes are strings. When you already hold an object, or params change every render, attach them directly:

```ts
import { bindParams } from 'declarative-tracker/dom';

bindParams(el, { product }); // an object
bindParams(el, () => currentParams()); // or a getter, read at send time
bindParams(el, null); // detach
```

Bound params override anything read from attributes. The React hook `useTrackProps` does this for you.

## Triggers

```ts
observe(tracker); // all built-in triggers
observe(tracker, { triggers: [clickTrigger({ phase: 'bubble' }), impressionTrigger()] });
```

| Trigger          | Sends when                                       | Options                                           |
| ---------------- | ------------------------------------------------ | ------------------------------------------------- |
| `'click'`        | The element or a descendant is clicked           | factory: `phase: 'capture' \| 'bubble'`           |
| `'submit'`       | The element is, or contains, a form that submits | factory: `phase`                                  |
| `'mount'`        | The element enters the DOM                       | —                                                 |
| `'impression'`   | The element has been visible in the viewport     | `threshold`, `rootMargin`, `minVisibleMs`, `once` |
| `'scroll-depth'` | Scroll depth crosses a milestone                 | `milestones` (required), `container`              |
| `'manual'`       | Never automatically. Use `tracker.fire()`        | —                                                 |

Notes on the built-ins:

- **click / submit** use one delegated listener on the root, in the capture phase by default so `stopPropagation()` in app code does not hide interactions. Pass `phase: 'bubble'` to the factory if you want cancelled interactions excluded.
- **impression** shares one `IntersectionObserver` per distinct `threshold`/`rootMargin`. Elements taller than the viewport are re-observed at a ratio they can actually reach. `minVisibleMs` requires continuous visibility; leaving early cancels. While the tab is hidden nothing counts, and when it becomes visible observation restarts, so a page opened in a background tab does not report impressions. `once: false` re-sends every time the element re-enters.
- **scroll-depth** attaches to `window`, or to the element matched by `container` (a selector). Milestones are fractions `0..1`; each sends once per element and adds `scrollDepth` and `scrollDepthPercent` to params. A document too short to scroll reports depth 1 immediately.

### Custom triggers

Delegated DOM events take one line:

```ts
import { delegatedTrigger } from 'declarative-tracker/dom';

const changeTrigger = delegatedTrigger('change', 'change');
```

Anything else implements the `Trigger` interface:

```ts
import { defineTrigger } from 'declarative-tracker/dom';

const hoverTrigger = defineTrigger({
  name: 'hover',
  setup({ fire }) {
    const onEnter = (e: Event) => fire(e.currentTarget as Element);
    return {
      attach: (el) => el.addEventListener('mouseenter', onEnter),
      detach: (el) => el.removeEventListener('mouseenter', onEnter),
      destroy: () => undefined,
    };
  },
});
```

Register the name (and its options type, if any) so event definitions accept it:

```ts
declare module 'declarative-tracker' {
  interface TriggerRegistry {
    change: NoOptions;
    hover: { delayMs?: number };
  }
}
```

If the trigger adds params of its own through `fire(el, extra)`, declare them too so target functions see them without the event having to list them (this is how `scroll-depth` exposes `scrollDepthPercent`):

```ts
declare module 'declarative-tracker' {
  interface TriggerParamsRegistry {
    hover: { hoverMs: number };
  }
}
```

`setup` runs once per `observe()` and receives `root`, `prefix`, `logger`, and `fire(el, extraParams?)`. `attach`/`detach` run per element. The trigger only decides _when_; reading params and sending is done by `observe()`.

## Adapters

An adapter is an object with a name and a `send`. Everything else is optional.

```ts
import type { Adapter } from 'declarative-tracker';

interface Ga4Payload {
  name: string;
  params?: Record<string, unknown>;
}

export const ga4: Adapter<Ga4Payload> = {
  name: 'ga4',
  setup() {
    /* load gtag */
  },
  send(payload, event) {
    gtag('event', payload.name, payload.params);
  },
  flush() {
    /* return a promise if you batch */
  },
  teardown() {
    /* remove listeners */
  },
};
```

- Adapter names must be unique. A target that names an adapter that is not registered is skipped (with a warning in debug mode).
- Errors thrown or rejected by one adapter never reach the others or the caller. They go to `onError` with the phase (`setup`, `resolve`, `send`, `flush`, `teardown`) and the event.
- `tracker.setAdapterEnabled('ga4', false)` pauses one adapter without touching the event map. Use it for consent gating.
- `await tracker.flush()` calls every adapter's `flush`. `tracker.destroy()` calls `teardown` and ignores later `fire()`s.

## Tracker options

```ts
const tracker = createTracker({
  events,
  adapters: [ga4, amplitude],
  context: { app: 'web', locale: 'ko' }, // attached to every event as event.context
  middleware: [consent, dedupe],
  onError: (error, info) => report(error, info), // default: console.error
  debug: import.meta.env.DEV, // warnings about unknown keys, adapters, triggers
});

tracker.setContext({ userId: 'u1' }); // merged
tracker.clearContext();
tracker.fire('newsletter-submit', { plan: 'pro' }); // params are type-checked against the map
```

### Middleware

Middleware sits between `fire()` and the targets. Call `next` to continue, with the same or a modified event; skip it to drop the event.

```ts
import type { Middleware } from 'declarative-tracker';

const consent: Middleware = (event, next) => {
  if (hasConsent()) next(event);
};

const addSession: Middleware = (event, next) => {
  next({ ...event, context: { ...event.context, sessionId: getSessionId() } });
};
```

A once-per-page dedupe for impressions, keyed on whatever identifies the item:

```ts
const seen = new Set<string>();
const dedupeImpressions: Middleware = (event, next) => {
  if (event.trigger !== 'impression') return next(event);
  const id = `${event.key}:${String(event.params.productId)}`;
  if (seen.has(id)) return;
  seen.add(id);
  next(event);
};
```

## React

```tsx
import { createTracker } from 'declarative-tracker';
import { createTrackingHooks, trackAttrs, TrackingProvider } from 'declarative-tracker/react';

export const tracker = createTracker({ events, adapters });
export const { useTracker, useFire, useTrackProps } = createTrackingHooks<typeof events>();

function App() {
  return (
    <TrackingProvider tracker={tracker}>
      <Home />
    </TrackingProvider>
  );
}
```

`TrackingProvider` puts the tracker in context and calls `observe()` in an effect. Pass `observe={false}` if you only need `fire()`, or `observeOptions={{ prefix, triggers, root }}` to configure it.

### Marking elements

`trackAttrs` returns plain `data-*` attributes, nothing else, so it never collides with your own `onClick` or `ref`:

```tsx
<section {...trackAttrs('hero-view', { variant: 'a' })}>
```

To type-check the key and params, pass the event map: `trackAttrs<typeof events, 'hero-view'>(...)`.

`useTrackProps` is the same idea without serializing params on every render. It returns the `data-track` attribute plus a `ref` that binds the params object directly:

```tsx
function ProductButton({ product, index }) {
  const props = useTrackProps('product-click', { productId: product.id, position: index });
  return <button {...props}>Buy</button>;
}
```

It reads the latest params at send time. If the element already has a ref, pass it through and both are filled: `useTrackProps(key, params, { ref: myRef })`.

### Firing from code

```tsx
const fireSubmit = useFire('newsletter-submit'); // (params) => void, stable across renders
const fire = useFire(); // tracker.fire, for any key
const tracker = useTracker();
```

The hooks from `createTrackingHooks<typeof events>()` are typed once for the whole app. The bare exports (`useFire`, `useTracker`, `useTrackProps`) take the map as a generic per call.

## Other frameworks

The runtime only looks at attributes, so any framework that can render `data-*` works as is. Small helpers make it nicer.

Vue directive:

```ts
app.directive('track', {
  mounted(el, { arg, value }) {
    el.setAttribute('data-track', arg);
    if (value) bindParams(el, () => value);
  },
  updated(el, { value }) {
    bindParams(el, value ? () => value : null);
  },
});
// <button v-track:product-click="{ productId: product.id }">
```

Svelte action:

```ts
export function track(el: HTMLElement, [key, params]: [string, Params?]) {
  el.setAttribute('data-track', key);
  bindParams(el, params ?? null);
  return {
    update: ([, next]) => bindParams(el, next ?? null),
    destroy: () => bindParams(el, null),
  };
}
// <button use:track={['product-click', { productId }]}>
```

Call `observe(tracker)` once at app start in both cases.

## SSR

`declarative-tracker` (the core) has no DOM access and is safe to import on the server. `observe()` returns a no-op when `document` is undefined, so calling it in a shared module is fine. Markup rendered on the server is picked up on the client when `observe()` runs.

## Examples

Runnable Vite apps for vanilla TypeScript and React live in [`examples/`](./examples).

## License

MIT
