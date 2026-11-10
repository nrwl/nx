import type { MockInstance } from 'vitest';
describe('@nx/next/tailwind deprecation warning', () => {
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

describe('@nx/next/tailwind with Tailwind v4', () => {
  afterEach(() => {
    vi.doUnmock('@nx/js/internal');
    vi.restoreAllMocks();
  });

  it('should keep negated patterns from the dependency globs', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.doMock('@nx/js/internal', () => ({
      createGlobPatternsForDependencies: (dirPath: string, pattern: string) => [
        `${dirPath}/../../libs/ui${pattern}`,
        `!${dirPath}/../../libs/ui/**/node_modules/**`,
      ],
    }));
    const { createGlobPatternsForDependencies } = await import('./tailwind');

    expect(createGlobPatternsForDependencies(__dirname)).toMatchInlineSnapshot(`
      [
        "../../libs/ui/**/*.{tsx,ts,jsx,js,html}",
        "!../../libs/ui/**/node_modules/**",
        "!../../libs/ui/**/*.{stories,spec}.{tsx,ts,jsx,js,html}",
      ]
    `);
  });
});
