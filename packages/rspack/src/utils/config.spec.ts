import {
  composePlugins,
  composePluginsSync,
  isNxRspackComposablePlugin,
} from './config';
import { withNx } from './with-nx';
import { withWeb } from './with-web';
import { withReact } from './with-react';

describe('removed compose helper stubs', () => {
  it.each([composePlugins, composePluginsSync])(
    'keeps executor configs loadable without running callbacks',
    async (compose) => {
      const callback = jest.fn(() => {
        throw new Error('legacy callback requires Nx build context');
      });
      const original = {
        mode: 'production' as const,
        output: { path: '/tmp/output' },
      };
      const combined = compose(withNx(), withWeb(), callback);
      expect(isNxRspackComposablePlugin(combined)).toBe(true);
      expect(
        await combined(original, {
          options: {},
          context: { projectGraph: null },
        } as any)
      ).toBe(original);
      expect(callback).not.toHaveBeenCalled();
    }
  );

  it.each([composePlugins, composePluginsSync])(
    'does not treat CLI env as a config',
    async (compose) => {
      const env = { WEBPACK_BUILD: true };
      expect(await compose()(env as any, { env } as any)).toEqual({});
      expect(
        await compose()(env as any, { mode: 'production' } as any)
      ).toEqual({});
      expect(
        await compose()(env as any, { context: '/workspace' } as any)
      ).toEqual({});
      expect(await compose()(env as any)).toEqual({});
    }
  );

  it.each([withNx, withWeb, withReact])(
    'does not configure a build or require executor context',
    (helper) => {
      const config = Object.freeze({ mode: 'production' as const });
      expect(helper()(config, undefined)).toBe(config);
    }
  );
});
