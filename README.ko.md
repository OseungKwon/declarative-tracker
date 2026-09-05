# declarative-tracker

[English](./README.md) · [한국어](./README.ko.md)

[![CI](https://github.com/oseungkwon/declarative-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/oseungkwon/declarative-tracker/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/declarative-tracker)](https://www.npmjs.com/package/declarative-tracker)
[![license](https://img.shields.io/github/license/oseungkwon/declarative-tracker)](./LICENSE)

`data-track` 속성으로 구현하는 선언적이고 타입 안전한 이벤트 트래킹입니다.
태그 하나로 GA4, AppsFlyer, Amplitude, 혹은 직접 만든 **어댑터**(adapter)까지 어떤 분석 도구에든 보낼 수 있습니다. 의존성은 없습니다.

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

UI는 _무엇이 일어났는지_ 말합니다. **이벤트 맵**(event map)은 _그것이 어디로, 어떤 형태로 가는지_ 말합니다. 어댑터는 전송을 맡습니다. 셋 중 어느 것도 나머지 둘을 알지 못합니다.

> 상태: 0.x. API는 안정화 중이며 1.0 이전까지는 마이너 버전 사이에 바뀔 수 있습니다.

## 왜 필요한가

트래킹 코드 대부분은 실제 일을 하는 핸들러 안에 들어가 있기 마련입니다. "이 이벤트만 하나 추가해 주세요"가 몇 달 쌓인 결제 버튼은 대개 이런 모습이 됩니다.

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

비즈니스 로직은 네 줄입니다. 나머지는 분석 코드이고, 이것이 실제 문제를 일으킵니다.

- 같은 사실(`cart.total`)이 세 가지 방식으로 적혀 있습니다. 벤더마다 원하는 필드 이름이 다르기 때문입니다. 하나를 바꾸면 나머지 둘도 찾아서 고쳐야 합니다.
- 예외를 던지거나 광고 차단기에 막힌 벤더 SDK가 결제를 깨뜨릴 수 있으므로, 결국 모든 호출을 각각의 `try`로 감싸게 됩니다.
- 마케팅 팀이 네 번째 벤더를 추가하거나 이벤트 시점을 "요청 전"에서 "요청 후"로 옮겨 달라고 요청합니다. 이것은 결제 코드의 변경이며, 리뷰와 배포가 뒤따릅니다.
- `onCheckout`의 테스트는 주문 흐름을 검증하기 전에 `gtag`, `AF`, `amplitude`를 먼저 모킹해야 합니다.

declarative-tracker는 이것을 핸들러 밖으로 옮깁니다. 버튼이 의도를 담고, 이벤트 맵이 벤더 매핑을 담으며, `onCheckout`은 주문을 생성하는 일로 돌아갑니다.

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

어댑터 오류는 페이지와 격리되고, 벤더 필드 이름은 한 파일에 모이며, 주문 흐름은 분석 도구 모킹 없이 테스트할 수 있습니다.

정리하면 다음과 같습니다.

- **마크업이 의도를 선언합니다.** 요소는 자신이 어떤 이벤트에 속하는지 말하고 params를 속성으로 담습니다. 핸들러도 import도 필요 없으며, 순수 HTML과 SSR에서도 동작합니다.
- **하나의 이벤트 맵이 모든 벤더로 변환합니다.** 각 이벤트는 자신의 타깃을 나열합니다. 타깃은 도메인 이벤트를 해당 벤더의 페이로드로 바꿉니다. 벤더를 추가하는 일은 키 하나를 추가하는 일입니다.
- **트리거(trigger)가 내장되어 있습니다.** 클릭, 폼 제출, 마운트, 뷰포트 **노출**(impression)(최소 노출 시간과 백그라운드 탭 처리 포함), 스크롤 깊이를 지원합니다. 커스텀 트리거도 같은 인터페이스로 연결됩니다.
- **타입이 정의를 따라갑니다.** 이벤트 키와 params는 맵에서 추론되므로, 키 오타나 누락된 param은 `fire()`, `trackAttrs()`, React 훅에서 컴파일 오류가 됩니다.

이 라이브러리는 얇은 계측 레이어이지, 또 하나의 분석 SDK가 아닙니다. GA4, Amplitude, RudderStack, 혹은 직접 운영하는 엔드포인트 앞에 자리 잡고 방해하지 않습니다.

## 자주 쓰는 경우

각 경우마다 마크업, `Events` 인터페이스에 들어갈 한 줄, 그리고 `defineEvents<Events>({ ... })`에 들어갈 항목을 보여 줍니다. 모두 시작 시점에 `createTracker({ events, adapters })`와 `observe(tracker)`가 한 번 실행되었다고 가정합니다.

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

핸들러도 params도 없습니다. 타깃은 정적 페이로드입니다.

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

각 항목은 절반 이상이 1초 동안 보인 뒤에 `{ productId, list: 'recommended' }`를 보냅니다. 빠르게 스크롤되어 지나간 항목은 집계되지 않으며, 백그라운드 탭에 있는 항목도 마찬가지입니다.

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

선택이 바뀔 때 `data-track-plan`을 갱신합니다. params는 제출 시점에 읽힙니다. React에서는 `useTrackProps('signup', { plan })`이 속성을 건드리지 않고 같은 일을 합니다.

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

독자가 스크롤할 때 마일스톤마다 한 번씩 보냅니다. 요소 내부에서 스크롤되는 피드라면 `container: '#feed'`를 추가합니다.

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

UI는 도메인 이벤트 하나를 발생시킵니다. 벤더마다 각자의 이름과 필드 구성을 받습니다. 네 번째 벤더를 추가하는 일은 키 하나를 더하는 일이고, 하나를 제거하는 일은 키 하나를 지우는 일입니다.

### 사용자가 동의하기 전에는 아무것도 내보내지 않기

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

또는 이벤트는 계속 흐르게 두고 벤더 하나만 끌 수도 있습니다. `tracker.setAdapterEnabled('appsflyer', false)`를 사용합니다.

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

키와 params는 이벤트 맵에 대해 타입 검사를 받습니다. 요소에는 `data-track`과 ref만 붙고, 그 외에는 아무것도 주입되지 않습니다.

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

`observe()`는 한 번만 실행합니다. 루트를 스캔하고, `MutationObserver`로 DOM을 감시하며, 요소가 나타나고 사라질 때마다 트리거를 붙이거나 뗍니다. params는 전송 시점에 읽히므로 요소가 나타난 뒤에 속성이 바뀌어도 괜찮습니다.

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

인터페이스가 곧 계약입니다. 정의에서 빠진 키, 남는 키, 타깃 함수 안의 잘못 적은 param, `fire()`의 잘못된 param은 모두 컴파일 오류가 됩니다. 인터페이스는 앱이 추적하는 모든 것을 읽기 쉽게 나열한 목록이기도 해서, 분석 계획을 담당하는 사람과 공유하기에 좋습니다.

이벤트 정의는 다음으로 구성됩니다.

- **`trigger`**: 언제 보낼지 정합니다. 내장 이름 중 하나이거나 직접 등록한 커스텀 이름입니다. `'manual'`은 `tracker.fire()`로만 보낸다는 뜻입니다.
- **`targets`**: 어댑터 이름마다 항목 하나를 둡니다. 타깃은 정적 페이로드이거나 이벤트를 받는 함수입니다. `null`이나 `undefined`를 반환하면 이 이벤트에 대해 해당 어댑터를 건너뜁니다.
- **`options`**: 트리거에 필수 옵션이 있으면 필수이고(`scroll-depth`는 `milestones`가 필요합니다), 그렇지 않으면 선택입니다.

### 값에서 추론하기

각 이벤트의 params를 정의 옆에 두는 쪽을 선호한다면, 제네릭 없이 `defineEvents`를 호출하고 항목에 params를 선언합니다. params를 읽는 항목은 `defineEvent()`로 감쌉니다. 그렇지 않으면 TypeScript는 인라인 객체 안의 `e.params`를 `Record<string, unknown>`으로 봅니다.

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

여기서 `params`는 타입 전용 선언이며 런타임에는 읽히지 않습니다. 두 방식은 같은 맵을 만들고, 이후 단계(`fire`, `trackAttrs`, 훅)는 동일하게 동작합니다.

### 런타임에 params 검증하기

타입은 코드의 실수를 잡지만 마크업의 실수는 잡지 못합니다. `data-track-price="abc"`나 빠진 `data-track-product-id`는 컴파일은 잘 되고, 몇 주 뒤 깨진 리포트로만 드러납니다. 개발 중에 이를 잡으려면 이벤트에 [Standard Schema](https://standardschema.dev)를 따르는 아무 라이브러리(zod, valibot, arktype, ...)의 `schema`를 지정합니다.

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

- `debug: true`이면 모든 `fire()`가 병합된 params에 스키마를 실행하고, 문제가 있으면 경고를 로그로 남깁니다. 이벤트는 그대로 전송되며, 검증은 전송을 막거나 값을 변형하지 않습니다.
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

| 속성                            | 의미                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| `data-track="key"`              | 이벤트 키입니다. 요소를 추적 대상으로 표시합니다.                                            |
| `data-track-<name>="value"`     | param 하나입니다. `data-track-product-id`는 `productId`가 됩니다. 값은 문자열입니다.         |
| `data-track-params='{"a":1}'`   | JSON 객체 형태의 params입니다. 문자열이 아닌 값이나 여러 params를 한 번에 넣을 때 씁니다.    |
| `data-track-ctx-<name>="v"`     | 아무 조상 요소에나 둡니다. 추적되는 모든 자손에 병합됩니다. 목록 이름이나 섹션에 사용합니다. |
| `data-track-ctx='{"list":"x"}'` | JSON 형태의 조상 컨텍스트입니다.                                                             |

같은 이름이 여러 번 나타나면 다음 순서에서 뒤에 오는 쪽이 이깁니다. 조상 ctx(가장 바깥쪽부터) → 개별 속성 → JSON params → `bindParams()`.

```html
<section data-track-ctx-list="featured">
  <button data-track="product-click" data-track-product-id="p1">A</button>
  <button data-track="product-click" data-track-product-id="p2">B</button>
</section>
<!-- 두 클릭 모두 { list: 'featured', productId: '...' }를 보냅니다 -->
```

`data-track` 접두사는 설정할 수 있습니다. `observe(tracker, { prefix: 'data-analytics' })`로 지정하면 모든 속성이 `data-analytics-*`가 됩니다.

### 직렬화 없이 params 전달하기

속성은 문자열입니다. 이미 객체를 들고 있거나 params가 렌더마다 바뀐다면 직접 붙입니다.

```ts
import { bindParams } from 'declarative-tracker/dom';

bindParams(el, { product }); // 객체
bindParams(el, () => currentParams()); // 또는 getter, 전송 시점에 읽힘
bindParams(el, null); // 해제
```

바인딩된 params는 속성에서 읽은 값을 모두 덮어씁니다. React 훅 `useTrackProps`가 이 일을 대신해 줍니다.

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

- **click / submit**은 루트에 위임 리스너 하나를 사용하며, 기본값은 캡처 단계입니다. 앱 코드의 `stopPropagation()`이 상호작용을 가리지 않게 하기 위해서입니다. 취소된 상호작용을 제외하고 싶다면 팩토리에 `phase: 'bubble'`을 넘깁니다.
- **impression**은 `threshold`/`rootMargin` 조합마다 `IntersectionObserver` 하나를 공유합니다. 뷰포트보다 큰 요소는 실제로 도달할 수 있는 비율로 다시 관찰합니다. `minVisibleMs`는 연속 노출을 요구하며, 일찍 벗어나면 취소됩니다. 탭이 숨겨진 동안에는 아무것도 집계하지 않고, 다시 보이면 관찰을 재시작하므로 백그라운드 탭에서 열린 페이지는 노출을 보고하지 않습니다. `once: false`이면 요소가 다시 들어올 때마다 다시 보냅니다.
- **scroll-depth**는 `window`에, 또는 `container`(셀렉터)와 일치하는 요소에 붙습니다. 마일스톤은 `0..1` 사이의 비율이며, 각 마일스톤은 요소마다 한 번씩 보내고 params에 `scrollDepth`와 `scrollDepthPercent`를 추가합니다. 스크롤할 수 없을 만큼 짧은 문서는 즉시 깊이 1을 보고합니다.

### 커스텀 트리거

위임된 DOM 이벤트는 한 줄이면 됩니다.

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

트리거가 `fire(el, extra)`를 통해 자체 params를 추가한다면 그것도 선언해 둡니다. 그러면 이벤트가 따로 나열하지 않아도 타깃 함수에서 볼 수 있습니다(`scroll-depth`가 `scrollDepthPercent`를 노출하는 방식이 바로 이것입니다).

```ts
declare module 'declarative-tracker' {
  interface TriggerParamsRegistry {
    hover: { hoverMs: number };
  }
}
```

`setup`은 `observe()`마다 한 번 실행되며 `root`, `prefix`, `logger`, `fire(el, extraParams?)`를 받습니다. `attach`/`detach`는 요소마다 실행됩니다. 트리거는 _언제_ 보낼지만 결정하고, params를 읽고 전송하는 일은 `observe()`가 합니다.

## 어댑터

어댑터는 이름과 `send`를 가진 객체입니다. 나머지는 모두 선택입니다.

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

- 어댑터 이름은 고유해야 합니다. 등록되지 않은 어댑터를 가리키는 타깃은 건너뜁니다(debug 모드에서는 경고를 남깁니다).
- 어댑터 하나가 던지거나 reject한 오류는 다른 어댑터나 호출자에게 전달되지 않습니다. 오류는 단계(`setup`, `resolve`, `send`, `flush`, `teardown`)와 이벤트 정보와 함께 `onError`로 갑니다.
- `tracker.setAdapterEnabled('ga4', false)`는 이벤트 맵을 건드리지 않고 어댑터 하나를 멈춥니다. 동의 게이팅에 사용합니다.
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

트래커는 스스로 콘솔에 쓰지 않습니다. 모든 출력은 `warn`과 `error` 두 메서드를 가진 `Logger`를 거치며, 기본 로거는 접두사가 붙은 console입니다.

- `debug`는 경고를 만들지 여부를 결정합니다. 알 수 없는 키·어댑터·트리거, 그리고 `destroy()` 이후의 `fire()`는 이 옵션이 켜져 있을 때만 보고됩니다. 어댑터 오류는 항상 보고됩니다.
- `logger`는 경고가 어디로 갈지 결정합니다. 직접 만든 로거를 넘기면 Sentry나 로그 드레인으로 보낼 수 있고, `false`를 넘기면 트래커를 완전히 침묵시킬 수 있어 테스트에서 유용합니다.
- `onError`를 지정하면 어댑터 오류에 대해서는 여전히 이쪽이 우선합니다. 기본값은 `logger.error`로 전달합니다.

### 미들웨어

미들웨어는 `fire()`와 타깃 사이에 자리합니다. 계속 진행하려면 같은 이벤트나 수정한 이벤트로 `next`를 호출하고, 이벤트를 버리려면 호출하지 않습니다.

```ts
import type { Middleware } from 'declarative-tracker';

const consent: Middleware = (event, next) => {
  if (hasConsent()) next(event);
};

const addSession: Middleware = (event, next) => {
  next({ ...event, context: { ...event.context, sessionId: getSessionId() } });
};
```

항목을 식별하는 값을 키로 삼아 노출을 페이지당 한 번으로 중복 제거하는 예시입니다.

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

`TrackingProvider`는 트래커를 컨텍스트에 넣고 effect 안에서 `observe()`를 호출합니다. `fire()`만 필요하다면 `observe={false}`를 넘기고, 설정을 바꾸려면 `observeOptions={{ prefix, triggers, root }}`를 넘깁니다.

### 요소 표시하기

`trackAttrs`는 순수한 `data-*` 속성만 반환하므로 직접 작성한 `onClick`이나 `ref`와 충돌하지 않습니다. 이벤트 맵에 한 번 바인딩하면 모든 호출이 타입 검사를 받습니다.

```ts
export const attrs = createTrackAttrs<typeof events>();
```

```tsx
<section {...attrs('hero-view', { variant: 'a' })}>
```

바인딩하지 않은 `trackAttrs(key, params?, prefix?)`는 맵 없이도 동작하고, 제네릭 둘을 모두 명시해서 `trackAttrs<typeof events, 'hero-view'>(...)`처럼 쓸 수도 있습니다. 둘 다 `declarative-tracker/dom`에도 있으므로 React 밖에서도 같은 헬퍼를 쓸 수 있습니다.

`useTrackProps`는 같은 개념이지만 렌더마다 params를 직렬화하지 않습니다. `data-track` 속성과 함께 params 객체를 직접 바인딩하는 `ref`를 반환합니다.

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

런타임은 속성만 보므로 `data-*`를 렌더할 수 있는 프레임워크라면 그대로 동작합니다. 작은 헬퍼를 두면 더 편해집니다.

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

`declarative-tracker`(코어)는 DOM에 접근하지 않으므로 서버에서 import해도 안전합니다. `observe()`는 `document`가 undefined이면 no-op을 반환하므로 공유 모듈에서 호출해도 괜찮습니다. 서버에서 렌더된 마크업은 클라이언트에서 `observe()`가 실행될 때 인식됩니다.

## 예제

바닐라 TypeScript와 React용으로 실행 가능한 Vite 앱이 [`examples/`](./examples)에 있습니다.

## 라이선스

MIT
