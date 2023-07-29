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
