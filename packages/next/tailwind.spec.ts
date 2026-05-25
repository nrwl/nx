describe('@nx/next/tailwind deprecation warning', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('warns once per process when createGlobPatternsForDependencies is invoked', () => {
    const { createGlobPatternsForDependencies } = require('./tailwind');

    // The function may throw resolving tailwindcss in this test env; we only
    // care that the deprecation warning fires before that, and only once.
    try {
      createGlobPatternsForDependencies('/does/not/exist');
    } catch {}
    try {
      createGlobPatternsForDependencies('/does/not/exist');
    } catch {}

    const deprecationWarnings = warnSpy.mock.calls.filter(
      ([msg]) =>
        typeof msg === 'string' &&
        msg.includes('"@nx/next/tailwind" is deprecated')
    );
    expect(deprecationWarnings).toHaveLength(1);
  });
});
