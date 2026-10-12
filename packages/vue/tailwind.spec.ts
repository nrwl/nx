import type { MockInstance } from 'vitest';
describe('@nx/vue/tailwind deprecation warning', () => {
  let warnSpy: MockInstance;

  beforeEach(() => {
    vi.resetModules();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('warns once per process when createGlobPatternsForDependencies is invoked', () => {
    const { createGlobPatternsForDependencies } = require('./tailwind');

    createGlobPatternsForDependencies('/does/not/exist');
    createGlobPatternsForDependencies('/does/not/exist');

    const deprecationWarnings = warnSpy.mock.calls.filter(
      ([msg]) =>
        typeof msg === 'string' &&
        msg.includes('"@nx/vue/tailwind" is deprecated')
    );
    expect(deprecationWarnings).toHaveLength(1);
  });
});
