import { trackAttrs, TrackingProvider } from 'declarative-tracker/react';
import { type FormEvent, useState, useSyncExternalStore } from 'react';

import { logStore } from './adapters';
import { tracker, useFire } from './tracking';

const PRODUCTS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

function Newsletter() {
  const fireSubmit = useFire('newsletter-submit');

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const plan = new FormData(e.currentTarget).get('plan') as 'free' | 'pro';
    fireSubmit({ plan });
  };

  return (
    <form onSubmit={onSubmit}>
      <select name="plan">
        <option value="free">Free</option>
        <option value="pro">Pro</option>
      </select>
      <button type="submit">Subscribe</button>
    </form>
  );
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
          <button
            key={id}
            {...trackAttrs('product-click', { productId: id, position: String(index + 1) })}
          >
            Product {index + 1}
          </button>
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
