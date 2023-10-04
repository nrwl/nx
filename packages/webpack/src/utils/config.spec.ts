import {
  composePluginsSync,
  composePlugins,
  NxWebpackExecutionContext,
} from './config';

describe('composePlugins', () => {
  it('should support sync and async plugin functions', async () => {
    const callOrder = [];
    const a = () => (config) => {
      callOrder.push('a');
      config.plugins.push(new (class A {})());
      return config;
    };
    const b = async () => (config) => {
      callOrder.push('b');
      config.plugins.push(new (class B {})());
      return config;
    };
    const c = () => async (config) => {
      callOrder.push('c');
      config.plugins.push(new (class C {})());
      return config;
    };
    const d = async () => async (config) => {
      callOrder.push('d');
      config.plugins.push(new (class D {})());
      return config;
    };

    const combined = composePlugins(a(), b(), c(), d());
    const config = await combined(
      { plugins: [] },
      {} as NxWebpackExecutionContext
    );

    expect(config.plugins.map((p) => p.constructor.name)).toEqual([
      'A',
      'B',
      'C',
      'D',
    ]);
    expect(callOrder).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('composePluginsSync', () => {
  it('should support sync plugin functions', async () => {
    const callOrder = [];
    const a = () => (config) => {
      callOrder.push('a');
      config.plugins.push(new (class A {})());
      return config;
    };
    const b = () => (config) => {
      callOrder.push('b');
      config.plugins.push(new (class B {})());
      return config;
    };

    const combined = composePluginsSync(a(), b());
    const config = await combined(
      { plugins: [] },
      {} as NxWebpackExecutionContext
    );

    expect(config.plugins.map((p) => p.constructor.name)).toEqual(['A', 'B']);
    expect(callOrder).toEqual(['a', 'b']);
  });
});
