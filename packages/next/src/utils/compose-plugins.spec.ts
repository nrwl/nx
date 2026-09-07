import { NextConfig } from 'next';
import { composePlugins } from './compose-plugins';
import { NextConfigFn } from './config';

describe('composePlugins', () => {
  it('should combine multiple plugins', async () => {
    const nextConfig: NextConfig = {
      env: {
        original: 'original',
      },
    };
    const a = (config: NextConfig): NextConfig => {
      config.env['a'] = 'a';
      return config;
    };
    const b = (config: NextConfig): NextConfig => {
      config.env['b'] = 'b';
      return config;
    };
    const fn = await composePlugins(a, b);
    const output = await fn(nextConfig)('test', {});

    expect(output).toEqual({
      env: {
        original: 'original',
        a: 'a',
        b: 'b',
      },
    });
  });

  it('should not load the deprecation module, which is not copied into the .nx-helpers build output', async () => {
    jest.resetModules();
    jest.doMock('./deprecation', () => {
      throw new Error('compose-plugins must not require ./deprecation');
    });
    try {
      const {
        composePlugins: isolatedComposePlugins,
      } = require('./compose-plugins');
      const { PHASE_PRODUCTION_SERVER } = require('next/constants');
      const fn = await isolatedComposePlugins();
      const output = await fn({ env: {} })(PHASE_PRODUCTION_SERVER, {});

      expect(output).toEqual({ env: {} });
    } finally {
      jest.dontMock('./deprecation');
      jest.resetModules();
    }
  });

  it('should compose plugins that return an async function', async () => {
    const nextConfig: NextConfig = {
      env: {
        original: 'original',
      },
    };
    const a = (config: NextConfig): NextConfig => {
      config.env['a'] = 'a';
      return config;
    };
    const b = (config: NextConfig): NextConfigFn => {
      return (phase: string) => {
        config.env['b'] = phase;
        return config;
      };
    };
    const fn = await composePlugins(a, b);
    const output = await fn(nextConfig)('test', {});

    expect(output).toEqual({
      env: {
        original: 'original',
        a: 'a',
        b: 'test',
      },
    });
  });
});
