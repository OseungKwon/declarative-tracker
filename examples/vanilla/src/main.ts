import { createTracker } from 'declarative-tracker';
import { observe } from 'declarative-tracker/dom';

import { appsflyer, ga4 } from './adapters';
import { events } from './events';

const tracker = createTracker({
  events,
  adapters: [ga4, appsflyer],
  context: { page: 'home' },
  debug: true,
});

// data-track 요소를 찾아 click / mount / impression / scroll-depth 트리거를 붙인다
observe(tracker);

// DOM 트리거가 없는 이벤트는 직접 fire 한다
const form = document.getElementById('newsletter') as HTMLFormElement;
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const plan = new FormData(form).get('plan') as 'free' | 'pro';
  tracker.fire('newsletter-submit', { plan });
});
