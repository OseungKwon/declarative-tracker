import { defineEvents } from 'declarative-tracker';

// 이벤트 키와 params 타입을 먼저 선언한다. 정의에서 키가 빠지거나 params 이름이 틀리면 컴파일 에러다
interface Events {
  'hero-view': { variant: string };
  'product-click': { productId: string; position: string; list?: string };
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

  'product-click': {
    trigger: 'click',
    targets: {
      ga4: (e) => ({
        name: 'select_item',
        params: {
          item_id: e.params.productId,
          index: Number(e.params.position),
          list: e.params.list,
        },
      }),
      appsflyer: (e) => ({
        eventName: 'af_content',
        eventValue: { af_content_id: e.params.productId },
      }),
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
      appsflyer: { eventName: 'af_complete_registration' },
    },
  },
});
