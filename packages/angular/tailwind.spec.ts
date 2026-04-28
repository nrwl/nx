describe('@nx/angular/tailwind deprecation warning', () => {
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

    createGlobPatternsForDependencies('/does/not/exist');
    createGlobPatternsForDependencies('/does/not/exist');

    const deprecationWarnings = warnSpy.mock.calls.filter(
      ([msg]) =>
        typeof msg === 'string' &&
        msg.includes('"@nx/angular/tailwind" is deprecated')
    );
    expect(deprecationWarnings).toHaveLength(1);
  });
});
