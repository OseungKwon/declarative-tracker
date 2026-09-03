import { defineEvent, defineEvents } from 'declarative-tracker';

export const events = defineEvents({
  'hero-view': defineEvent({
    trigger: 'impression',
    options: { threshold: 0.5, minVisibleMs: 1000 },
    params: {} as { variant: string },
    targets: {
      ga4: (e) => ({ name: 'view_hero', params: { variant: e.params.variant } }),
      appsflyer: { eventName: 'af_content_view' },
    },
  }),

  'product-click': defineEvent({
    trigger: 'click',
    params: {} as { productId: string; position: string; list?: string },
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
  }),

  'page-scroll': {
    trigger: 'scroll-depth',
    options: { milestones: [0.25, 0.5, 0.75, 1] },
    targets: {
      ga4: (e) => ({ name: 'scroll', params: { percent: e.params.scrollDepthPercent } }),
    },
  },

  'newsletter-submit': defineEvent({
    trigger: 'manual',
    params: {} as { plan: 'free' | 'pro' },
    targets: {
      ga4: (e) => ({ name: 'sign_up', params: { method: e.params.plan } }),
      appsflyer: { eventName: 'af_complete_registration' },
    },
  }),
});
