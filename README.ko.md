# declarative-tracker

[English](./README.md) · [한국어](./README.ko.md)

[![CI](https://github.com/oseungkwon/declarative-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/oseungkwon/declarative-tracker/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/declarative-tracker)](https://www.npmjs.com/package/declarative-tracker)
[![license](https://img.shields.io/github/license/oseungkwon/declarative-tracker)](./LICENSE)

`data-track` 속성으로 이벤트를 선언하고 타입 검사를 적용할 수 있는 트래킹 라이브러리입니다.
같은 도메인 이벤트를 GA4, AppsFlyer, Amplitude 또는 직접 만든 **어댑터**(adapter)에 맞게 변환해 전송합니다. 런타임 의존성은 없습니다.

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

UI에는 이벤트 키와 params만 선언합니다. **이벤트 맵**(event map)은 이 값을 분석 도구별 페이로드로 변환하고, 어댑터는 변환된 페이로드를 전송합니다. 각 계층은 서로의 구현을 참조하지 않습니다.

> 상태: 0.x. API는 안정화 중이며 1.0 이전까지는 마이너 버전 사이에 바뀔 수 있습니다.

## 왜 필요한가

트래킹 코드는 비즈니스 로직을 처리하는 핸들러에 함께 들어가는 경우가 많습니다. 결제 버튼에 이벤트 추가 요청이 누적되면 다음과 같은 코드가 만들어집니다.

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

주문 생성과 화면 이동을 처리하는 코드 사이에 분석 도구별 호출이 섞여 있습니다. 이 구조에서는 다음 문제가 생깁니다.

- `cart.total`이 벤더별 필드 이름에 맞춰 세 번 작성되어 있습니다. 값의 형식이 바뀌면 세 호출을 각각 수정해야 합니다.
- 벤더 SDK 호출에서 발생한 예외가 결제 흐름에 전달될 수 있습니다. 이를 막으려면 각 호출을 별도의 `try`로 감싸야 합니다.
- 벤더를 추가하거나 이벤트 시점을 "요청 전"에서 "요청 후"로 옮기려면 결제 코드를 수정하고 다시 리뷰·배포해야 합니다.
- `onCheckout`의 테스트는 주문 흐름을 검증하기 전에 `gtag`, `AF`, `amplitude`를 먼저 모킹해야 합니다.

declarative-tracker는 이벤트 선언과 벤더 매핑을 핸들러 밖으로 분리합니다. 버튼에는 이벤트 의도와 params를 선언하고, 이벤트 맵에는 벤더별 변환을 정의합니다. `onCheckout`에는 주문 처리 로직만 남습니다.

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

어댑터 오류는 주문 처리로 전파되지 않습니다. 벤더별 필드 이름은 이벤트 맵에서 관리하므로 주문 흐름 테스트에서 분석 도구를 모킹할 필요도 없습니다.

구성 요소와 지원 범위는 다음과 같습니다.

- **마크업**: 요소의 이벤트 키와 params를 `data-*` 속성에 선언합니다. 이벤트 핸들러나 import가 필요하지 않으며 순수 HTML과 SSR에서도 동작합니다.
- **이벤트 맵**: 도메인 이벤트를 벤더별 페이로드로 변환합니다. 벤더를 추가할 때는 어댑터를 등록하고 해당 이벤트의 타깃을 추가합니다.
- **트리거**(trigger): 클릭, 폼 제출, 마운트, 뷰포트 **노출**(impression), 스크롤 깊이를 지원합니다. 노출 트리거에는 최소 노출 시간과 백그라운드 탭 처리 옵션이 포함되며, 커스텀 트리거도 같은 인터페이스로 등록할 수 있습니다.
- **타입 검사**: 이벤트 키와 params를 맵에서 추론합니다. 키 오타나 누락된 param은 `fire()`, `trackAttrs()`, React 훅을 호출할 때 컴파일 오류로 확인할 수 있습니다.

이 라이브러리는 분석 SDK를 대체하지 않습니다. GA4, Amplitude, RudderStack 또는 직접 운영하는 엔드포인트와 함께 사용하며, 이벤트 정의를 각 전송 API에 연결합니다.

## 자주 쓰는 경우

아래 예제는 마크업, `Events` 인터페이스의 이벤트 타입, `defineEvents<Events>({ ... })`에 들어갈 정의를 차례로 보여 줍니다. 앱을 시작할 때 `createTracker({ events, adapters })`와 `observe(tracker)`가 한 번 실행된 상태를 가정합니다.

### 버튼 클릭

```html
<button data-track="cta-click">Start free trial</button>
```

```ts
'cta-click': {};
```

```ts
'cta-click': { trigger: 'click', targets: { ga4: { name: 'cta_click' } } },
```

이 이벤트에는 별도의 핸들러와 params가 필요하지 않습니다. GA4 타깃에는 정적 페이로드를 지정했습니다.

### 상품 목록: 목록 이름을 공유하는 노출과 클릭

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

각 항목이 절반 이상 노출된 상태로 1초가 지나면 `{ productId, list: 'recommended' }`를 전송합니다. 1초 안에 뷰포트를 벗어나거나 백그라운드 탭에 표시된 항목은 집계하지 않습니다.

요소 하나는 이벤트 하나에만 속하므로, 클릭은 자식 요소에 둡니다. id를 ctx로 올리면 두 이벤트가 모두 상속받습니다.

```html
<li data-track="product-view" data-track-ctx-product-id="p1">
  <a data-track="product-click" href="/p/p1">…</a>
</li>
```

### 선택한 값을 담은 폼 제출

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

선택한 요금제가 바뀔 때 `data-track-plan`을 갱신합니다. params는 폼을 제출하는 시점에 읽습니다. React에서는 `useTrackProps('signup', { plan })`으로 같은 값을 객체 형태로 바인딩할 수 있습니다.

### 글을 어디까지 읽었는지

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

스크롤이 각 마일스톤에 도달할 때마다 이벤트를 한 번 전송합니다. 요소 내부에서 스크롤되는 피드라면 `container: '#feed'`를 추가합니다.

### 이벤트 하나, 여러 벤더, 서로 다른 형태

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

`tracker.fire()`는 하나의 도메인 이벤트를 발생시킵니다. 이벤트 맵은 같은 params를 각 벤더의 이벤트 이름과 필드 구성에 맞게 변환합니다. 벤더를 추가하거나 제거할 때는 `targets`의 해당 항목만 수정합니다.

### 사용자 동의 전까지 전송 막기

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

특정 벤더로만 전송을 중단하려면 `tracker.setAdapterEnabled('appsflyer', false)`를 사용합니다.

### React 컴포넌트

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

키와 params는 이벤트 맵을 기준으로 타입 검사를 받습니다. 요소에는 `data-track` 속성과 ref만 추가됩니다.

## 설치

```bash
npm install declarative-tracker
# pnpm add declarative-tracker / yarn add declarative-tracker
```

진입점은 세 가지입니다.

| 임포트                      | 내용                                                            | 환경                     |
| --------------------------- | --------------------------------------------------------------- | ------------------------ |
| `declarative-tracker`       | `defineEvents`, `defineEvent`, `createTracker`, `Adapter`, 타입 | 어디서나 (DOM 접근 없음) |
| `declarative-tracker/dom`   | `observe`, 트리거, `trackAttrs`, `bindParams`, `resolveElement` | 브라우저                 |
| `declarative-tracker/react` | `TrackingProvider`, 훅, `trackAttrs` 재내보내기                 | React 18.2+ / 19         |

ESM과 CJS 빌드가 타입 선언과 함께 제공됩니다. React는 선택적 peer dependency입니다.

## 동작 방식

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

`observe()`는 앱을 시작할 때 한 번 실행합니다. 처음에는 루트를 스캔하고, 이후에는 `MutationObserver`로 DOM을 감시합니다. 추적 요소가 추가되거나 제거되면 트리거도 함께 연결하거나 해제합니다. params는 이벤트 전송 시점에 읽으므로 요소가 추가된 뒤 속성이 바뀌어도 변경된 값을 사용합니다.

## 이벤트 정의하기

키와 params를 한 번 선언한 뒤, 각 이벤트를 정의합니다.

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

`Events` 인터페이스는 이벤트 정의의 타입 계약으로 사용됩니다. 정의에서 빠지거나 추가된 키, 타깃 함수에서 잘못 참조한 param, `fire()`에 전달한 잘못된 param은 컴파일 오류가 됩니다. 앱에서 추적하는 이벤트와 params를 한곳에서 확인할 수 있어 분석 계획을 검토할 때도 이 인터페이스를 사용할 수 있습니다.

이벤트 정의는 다음으로 구성됩니다.

- **`trigger`**: 언제 보낼지 정합니다. 내장 이름 중 하나이거나 직접 등록한 커스텀 이름입니다. `'manual'`은 `tracker.fire()`로만 보낸다는 뜻입니다.
- **`targets`**: 어댑터 이름마다 항목 하나를 둡니다. 타깃은 정적 페이로드이거나 이벤트를 받는 함수입니다. `null`이나 `undefined`를 반환하면 이 이벤트에 대해 해당 어댑터를 건너뜁니다.
- **`options`**: 트리거 설정을 지정합니다. `scroll-depth`의 `milestones`처럼 트리거에 필수 옵션이 정의되어 있으면 반드시 작성해야 합니다.

### 값에서 추론하기

각 이벤트 정의에 params 타입을 함께 작성하려면 제네릭 없이 `defineEvents`를 호출하고 항목마다 params를 선언합니다. 타깃에서 params를 참조하는 이벤트는 `defineEvent()`로 감싸야 합니다. 이 함수가 없으면 TypeScript는 인라인 객체 안의 `e.params`를 `Record<string, unknown>`으로 추론합니다.

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

여기서 `params`는 타입 선언에만 사용하며 런타임에서는 읽지 않습니다. 두 방식으로 만든 맵은 `fire`, `trackAttrs`, React 훅에서 동일하게 동작합니다.

### 런타임에 params 검증하기

타입 검사는 코드에 작성한 값만 검사하므로 마크업의 잘못된 값은 찾지 못합니다. 예를 들어 `data-track-price="abc"`나 누락된 `data-track-product-id`는 컴파일 오류가 발생하지 않고 잘못된 리포트 데이터로 전송될 수 있습니다. 개발 중에 이를 확인하려면 이벤트의 `schema`에 [Standard Schema](https://standardschema.dev) 호환 라이브러리(zod, valibot, arktype 등)의 스키마를 지정합니다.

```ts
import { z } from 'zod';

const events = defineEvents({
  'product-click': defineEvent({
    trigger: 'click',
    schema: z.object({ productId: z.string(), price: z.coerce.number() }),
    targets: { ga4: (e) => ({ name: 'select_item', params: { item_id: e.params.productId } }) },
  }),
});
```

- `debug: true`이면 `fire()`를 호출할 때마다 병합된 params를 스키마로 검증하고, 문제가 있으면 경고를 남깁니다. 검증 결과는 이벤트 전송을 막거나 값을 변형하지 않습니다.
- `debug`가 꺼져 있으면 스키마는 호출되지 않으므로 프로덕션에서는 비용이 없습니다.
- `defineEvent`는 params 타입을 스키마의 출력에서 가져오므로, `schema`가 `params: {} as ...`를 대신합니다. `defineEvents<Events>`를 쓸 때는 스키마의 출력이 인터페이스와 일치해야 합니다.
- 이 라이브러리는 어떤 스키마 라이브러리에도 의존하지 않습니다. 스펙이 정의한 `~standard` 속성만 읽습니다.

### 이벤트 객체

타깃 함수와 **미들웨어**(middleware)는 `TrackingEvent`를 받습니다.

```ts
interface TrackingEvent<P> {
  key: string; // 'product-click'
  trigger: TriggerName; // 'click' | 'submit' | 'mount' | 'impression' | 'scroll-depth' | 'manual'
  params: P; // 속성, bindParams, fire()에서 병합된 값
  context: TrackingContext; // 전송 시점의 트래커 수준 컨텍스트
  timestamp: number;
  element?: Element; // DOM 트리거가 보낸 경우에만 존재
}
```

## 마크업

| 속성                            | 의미                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| `data-track="key"`              | 이벤트 키입니다. 요소를 추적 대상으로 표시합니다.                                         |
| `data-track-<name>="value"`     | param 하나입니다. `data-track-product-id`는 `productId`가 됩니다. 값은 문자열입니다.      |
| `data-track-params='{"a":1}'`   | JSON 객체 형태의 params입니다. 문자열이 아닌 값이나 여러 params를 한 번에 넣을 때 씁니다. |
| `data-track-ctx-<name>="v"`     | 조상 요소에 컨텍스트를 지정합니다. 추적 대상인 모든 자손의 params에 병합됩니다.           |
| `data-track-ctx='{"list":"x"}'` | JSON 형태의 조상 컨텍스트입니다.                                                          |

같은 이름의 param이 여러 곳에 있으면 뒤에서 읽은 값이 앞의 값을 덮어씁니다. 적용 순서는 조상 ctx(가장 바깥쪽부터) → 개별 속성 → JSON params → `bindParams()`입니다.

```html
<section data-track-ctx-list="featured">
  <button data-track="product-click" data-track-product-id="p1">A</button>
  <button data-track="product-click" data-track-product-id="p2">B</button>
</section>
<!-- 두 클릭 모두 { list: 'featured', productId: '...' }를 보냅니다 -->
```

`data-track` 접두사는 설정할 수 있습니다. `observe(tracker, { prefix: 'data-analytics' })`로 지정하면 모든 속성이 `data-analytics-*`가 됩니다.

### 직렬화 없이 params 전달하기

`data-*` 속성의 값은 문자열입니다. 객체를 그대로 전달해야 하거나 렌더마다 params가 바뀐다면 `bindParams()`를 사용합니다.

```ts
import { bindParams } from 'declarative-tracker/dom';

bindParams(el, { product }); // 객체
bindParams(el, () => currentParams()); // 또는 getter, 전송 시점에 읽힘
bindParams(el, null); // 해제
```

바인딩된 params는 속성에서 읽은 값을 덮어씁니다. React에서는 `useTrackProps` 훅이 같은 방식으로 params를 바인딩합니다.

## 트리거

```ts
observe(tracker); // 모든 내장 트리거
observe(tracker, { triggers: [clickTrigger({ phase: 'bubble' }), impressionTrigger()] });
```

| 트리거           | 전송 시점                                                 | 옵션                                              |
| ---------------- | --------------------------------------------------------- | ------------------------------------------------- |
| `'click'`        | 요소나 그 자손이 클릭될 때                                | 팩토리: `phase: 'capture' \| 'bubble'`            |
| `'submit'`       | 요소가 제출되는 폼이거나 그 폼을 포함할 때                | 팩토리: `phase`                                   |
| `'mount'`        | 요소가 DOM에 들어올 때                                    | —                                                 |
| `'impression'`   | 요소가 뷰포트에 보였을 때                                 | `threshold`, `rootMargin`, `minVisibleMs`, `once` |
| `'scroll-depth'` | 스크롤 깊이가 마일스톤을 넘을 때                          | `milestones` (필수), `container`                  |
| `'manual'`       | 자동으로는 보내지 않습니다. `tracker.fire()`를 사용합니다 | —                                                 |

내장 트리거에 대한 참고 사항입니다.

- **click / submit**은 루트에 위임 리스너 하나를 등록하며 기본값은 캡처 단계입니다. 따라서 앱 코드가 `stopPropagation()`을 호출해도 이벤트를 감지할 수 있습니다. 버블 단계에서 취소되지 않은 상호작용만 추적하려면 팩토리에 `phase: 'bubble'`을 전달합니다.
- **impression**은 `threshold`와 `rootMargin` 조합마다 `IntersectionObserver` 하나를 공유합니다. 뷰포트보다 큰 요소는 도달 가능한 노출 비율을 기준으로 다시 관찰합니다. `minVisibleMs`를 지정하면 해당 시간 동안 연속으로 노출되어야 하며, 그 전에 뷰포트를 벗어나면 타이머를 취소합니다. 탭이 숨겨진 동안에는 노출 시간을 집계하지 않고, 탭이 다시 표시되면 관찰을 재시작합니다. `once: false`이면 요소가 뷰포트에 진입할 때마다 전송합니다.
- **scroll-depth**는 `window` 또는 `container` 셀렉터와 일치하는 요소의 스크롤을 관찰합니다. 마일스톤은 `0..1` 사이의 비율로 지정하며, 요소별로 각 마일스톤에 처음 도달했을 때 params에 `scrollDepth`와 `scrollDepthPercent`를 추가해 전송합니다. 스크롤 영역이 없는 짧은 문서는 깊이 1을 즉시 전송합니다.

### 커스텀 트리거

위임 방식의 DOM 이벤트는 `delegatedTrigger`로 정의합니다.

```ts
import { delegatedTrigger } from 'declarative-tracker/dom';

const changeTrigger = delegatedTrigger('change', 'change');
```

그 외에는 `Trigger` 인터페이스를 구현합니다.

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

이벤트 정의에서 받아들일 수 있도록 이름(과 옵션 타입이 있다면 그것도)을 등록합니다.

```ts
declare module 'declarative-tracker' {
  interface TriggerRegistry {
    change: NoOptions;
    hover: { delayMs?: number };
  }
}
```

트리거가 `fire(el, extra)`를 통해 자체 params를 추가한다면 `TriggerParamsRegistry`에도 해당 타입을 선언합니다. 각 이벤트 타입에 이 params를 따로 추가하지 않아도 타깃 함수에서 사용할 수 있습니다. `scroll-depth`의 `scrollDepthPercent`도 이 방식으로 제공됩니다.

```ts
declare module 'declarative-tracker' {
  interface TriggerParamsRegistry {
    hover: { hoverMs: number };
  }
}
```

`setup`은 `observe()`마다 한 번 실행되며 `root`, `prefix`, `logger`, `fire(el, extraParams?)`를 받습니다. `attach`/`detach`는 요소마다 실행됩니다. 트리거는 _언제_ 보낼지만 결정하고, params를 읽고 전송하는 일은 `observe()`가 합니다.

## 어댑터

어댑터에는 이름과 `send` 메서드가 필요합니다. 그 외 메서드는 선택 사항입니다.

```ts
import type { Adapter } from 'declarative-tracker';

interface Ga4Payload {
  name: string;
  params?: Record<string, unknown>;
}

export const ga4: Adapter<Ga4Payload> = {
  name: 'ga4',
  setup() {
    /* gtag 로드 */
  },
  send(payload, event) {
    gtag('event', payload.name, payload.params);
  },
  flush() {
    /* 배치 전송한다면 promise를 반환 */
  },
  teardown() {
    /* 리스너 제거 */
  },
};
```

- 어댑터 이름은 고유해야 합니다. 등록되지 않은 어댑터를 가리키는 타깃은 건너뛰며, debug 모드에서는 경고를 남깁니다.
- 어댑터에서 예외가 발생하거나 Promise가 reject되어도 다른 어댑터나 `fire()` 호출자에게 오류를 전달하지 않습니다. `onError`는 오류가 발생한 단계(`setup`, `resolve`, `send`, `flush`, `teardown`)와 이벤트 정보를 함께 받습니다.
- `tracker.setAdapterEnabled('ga4', false)`는 이벤트 맵을 변경하지 않고 특정 어댑터의 전송을 중단합니다. 사용자 동의 상태에 따라 벤더별 전송 여부를 바꿀 때 사용할 수 있습니다.
- `await tracker.flush()`는 모든 어댑터의 `flush`를 호출합니다. `tracker.destroy()`는 `teardown`을 호출하고 이후의 `fire()`를 무시합니다.

## 트래커 옵션

```ts
const tracker = createTracker({
  events,
  adapters: [ga4, amplitude],
  context: { app: 'web', locale: 'ko' }, // 모든 이벤트에 event.context로 붙음
  middleware: [consent, dedupe],
  onError: (error, info) => report(error, info), // 기본값: logger.error
  debug: import.meta.env.DEV, // 알 수 없는 키, 어댑터, 트리거에 대한 경고
  logger: { warn: log.warn, error: log.error }, // 기본값: 접두사가 붙은 console
});

tracker.setContext({ userId: 'u1' }); // 병합됨
tracker.clearContext();
tracker.fire('newsletter-submit', { plan: 'pro' }); // params는 맵에 대해 타입 검사됨
```

### 로깅

트래커의 출력은 `warn`과 `error` 메서드를 가진 `Logger`를 거칩니다. 기본 로거는 메시지에 접두사를 붙여 `console`로 출력합니다.

- `debug`는 경고를 만들지 여부를 결정합니다. 알 수 없는 키·어댑터·트리거, 그리고 `destroy()` 이후의 `fire()`는 이 옵션이 켜져 있을 때만 보고됩니다. 어댑터 오류는 항상 보고됩니다.
- `logger`는 경고와 오류의 출력 대상을 정합니다. 직접 만든 로거를 전달하면 Sentry나 로그 드레인으로 보낼 수 있습니다. `false`를 전달하면 출력을 비활성화할 수 있습니다.
- `onError`를 지정하면 어댑터 오류에는 `onError`를 우선 사용합니다. 지정하지 않았을 때는 `logger.error`로 전달합니다.

### 미들웨어

미들웨어는 `fire()`가 생성한 이벤트를 타깃별 페이로드로 변환하기 전에 실행됩니다. 같은 이벤트나 수정한 이벤트를 `next`에 전달하면 다음 단계로 진행하고, `next`를 호출하지 않으면 해당 이벤트를 전송하지 않습니다.

```ts
import type { Middleware } from 'declarative-tracker';

const consent: Middleware = (event, next) => {
  if (hasConsent()) next(event);
};

const addSession: Middleware = (event, next) => {
  next({ ...event, context: { ...event.context, sessionId: getSessionId() } });
};
```

다음 예제는 항목 식별자를 기준으로 노출 이벤트를 페이지당 한 번만 전송합니다.

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

`TrackingProvider`는 트래커를 React 컨텍스트에 등록하고 effect에서 `observe()`를 호출합니다. `fire()`만 사용한다면 `observe={false}`를, 관찰 설정을 변경하려면 `observeOptions={{ prefix, triggers, root }}`를 전달합니다.

### 요소 표시하기

`trackAttrs`는 순수한 `data-*` 속성만 반환하므로 직접 작성한 `onClick`이나 `ref`와 충돌하지 않습니다. 이벤트 맵에 한 번 바인딩하면 모든 호출이 타입 검사를 받습니다.

```ts
export const attrs = createTrackAttrs<typeof events>();
```

```tsx
<section {...attrs('hero-view', { variant: 'a' })}>
```

이벤트 맵에 바인딩하지 않은 `trackAttrs(key, params?, prefix?)`도 사용할 수 있습니다. 타입 검사가 필요하면 `trackAttrs<typeof events, 'hero-view'>(...)`처럼 두 제네릭을 직접 지정합니다. 두 API는 `declarative-tracker/dom`에서도 제공하므로 React 외의 환경에서도 사용할 수 있습니다.

`useTrackProps`는 params를 렌더마다 직렬화하지 않습니다. 대신 `data-track` 속성과 params 객체를 직접 바인딩하는 `ref`를 반환합니다.

```tsx
function ProductButton({ product, index }) {
  const props = useTrackProps('product-click', { productId: product.id, position: index });
  return <button {...props}>Buy</button>;
}
```

전송 시점에 최신 params를 읽습니다. 요소에 이미 ref가 있다면 함께 넘기면 둘 다 채워집니다. `useTrackProps(key, params, { ref: myRef })`처럼 씁니다.

### 코드에서 발생시키기

```tsx
const fireSubmit = useFire('newsletter-submit'); // (params) => void, 렌더 간에 안정적
const fire = useFire(); // tracker.fire, 아무 키에나 사용
const tracker = useTracker();
```

`createTrackingHooks<typeof events>()`에서 만든 훅은 앱 전체에 대해 한 번만 타입이 지정됩니다. 직접 내보내는 훅(`useFire`, `useTracker`, `useTrackProps`)은 호출마다 맵을 제네릭으로 받습니다.

## 다른 프레임워크

런타임은 `data-*` 속성을 기준으로 요소를 찾으므로 특정 프레임워크에 의존하지 않습니다. 아래는 Vue 디렉티브와 Svelte 액션으로 바인딩을 재사용하는 예제입니다.

Vue 디렉티브입니다.

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

Svelte 액션입니다.

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

두 경우 모두 앱 시작 시 `observe(tracker)`를 한 번 호출합니다.

## SSR

`declarative-tracker` 코어는 DOM에 접근하지 않으므로 서버에서도 import할 수 있습니다. `document`가 `undefined`인 환경에서 `observe()`를 호출하면 no-op을 반환합니다. 서버에서 렌더한 마크업은 클라이언트에서 `observe()`가 실행될 때 추적 대상으로 등록됩니다.

## 예제

바닐라 TypeScript와 React용으로 실행 가능한 Vite 앱이 [`examples/`](./examples)에 있습니다.

## 라이선스

MIT
