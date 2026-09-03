import { describe, expectTypeOf, it } from 'vitest';

import type { ImpressionOptions, ScrollDepthOptions } from '../core/types';
import { defineTrigger } from './trigger';

describe('defineTrigger', () => {
  it('트리거 이름에 맞는 options 타입을 attach에 넘긴다', () => {
    defineTrigger({
      name: 'impression',
      setup: () => ({
        attach(_el, options) {
          expectTypeOf(options).toEqualTypeOf<ImpressionOptions | undefined>();
        },
        destroy: () => undefined,
      }),
    });
    defineTrigger({
      name: 'scroll-depth',
      setup: () => ({
        attach(_el, options) {
          expectTypeOf(options).toEqualTypeOf<ScrollDepthOptions | undefined>();
        },
        destroy: () => undefined,
      }),
    });
  });

  it('등록되지 않은 이름은 막힌다', () => {
    defineTrigger({
      // @ts-expect-error hover는 등록되지 않은 트리거 이름
      name: 'hover',
      setup: () => ({ attach: () => undefined, destroy: () => undefined }),
    });
  });
});
