import { trackAttrs, TrackingProvider } from 'declarative-tracker/react';
import { useState, useSyncExternalStore } from 'react';

import { logStore } from './adapters';
import { tracker, useTrackProps } from './tracking';

const PRODUCTS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

// submit 트리거: 폼에 data-track을 두면 제출 시점에 params를 읽어 보낸다
function Newsletter() {
  const [plan, setPlan] = useState<'free' | 'pro'>('free');
  const props = useTrackProps('newsletter-submit', { plan });

  return (
    <form {...props} onSubmit={(e) => e.preventDefault()}>
      <select value={plan} onChange={(e) => setPlan(e.target.value as 'free' | 'pro')}>
        <option value="free">Free</option>
        <option value="pro">Pro</option>
      </select>
      <button type="submit">Subscribe</button>
    </form>
  );
}

// useTrackProps: params를 ref로 붙여 렌더마다 JSON 문자열을 만들지 않는다
function ProductButton({ id, position }: { id: string; position: number }) {
  const props = useTrackProps('product-click', { productId: id, position: String(position) });
  return <button {...props}>Product {position}</button>;
}

function Products() {
  const [count, setCount] = useState(3);

  return (
    // 조상 ctx: 아래 모든 이벤트의 params에 list=featured 가 들어간다
    <section data-track-ctx-list="featured">
      <h2>Featured</h2>
      <button onClick={() => setCount((c) => Math.min(c + 1, PRODUCTS.length))}>add product</button>
      <div className="grid">
        {PRODUCTS.slice(0, count).map((id, index) => (
          <ProductButton key={id} id={id} position={index + 1} />
        ))}
      </div>
    </section>
  );
}

function LogPanel() {
  const text = useSyncExternalStore(logStore.subscribe, logStore.getSnapshot);
  return <pre id="log">{text}</pre>;
}

export default function App() {
  return (
    <TrackingProvider tracker={tracker}>
      <div data-track="page-scroll">
        <section className="hero" {...trackAttrs('hero-view', { variant: 'a' })}>
          <h1>Scroll down and click around</h1>
        </section>
        <Products />
        <section>
          <h2>Newsletter</h2>
          <Newsletter />
        </section>
        <div className="spacer">keep scrolling…</div>
      </div>
      <LogPanel />
    </TrackingProvider>
  );
}
