import { formatPluginProgressText } from './plugin-progress-text';

describe('formatPluginProgressText', () => {
  it('returns an empty string when no plugins are in progress', () => {
    expect(
      formatPluginProgressText('Creating project metadata', new Set())
    ).toBe('');
  });

  it('returns a single-line message when exactly one plugin is in progress', () => {
    const inProgress = new Set(['@nx/rust']);
    expect(
      formatPluginProgressText(
        'Creating project graph dependencies',
        inProgress
      )
    ).toBe('Creating project graph dependencies with @nx/rust');
  });

  it('returns a multi-line message listing each plugin when multiple are in progress', () => {
    const inProgress = new Set(['@nx/rust', '@nx/js', '@nx/eslint']);
    expect(
      formatPluginProgressText(
        'Creating project graph dependencies',
        inProgress
      )
    ).toBe(
      [
        'Creating project graph dependencies with 3 plugins',
        '  - @nx/rust',
        '  - @nx/js',
        '  - @nx/eslint',
      ].join('\n')
    );
  });

  it('preserves each plugin name as a whole entry, not per-character', () => {
    // Regression: `new Set(...array)` spreads into the Set constructor,
    // which takes a single iterable — for a string that means iterating
    // character-by-character. The formatter must surface full plugin names.
    const inProgress = new Set(['@nx/rust']);
    const output = formatPluginProgressText(
      'Creating project graph dependencies',
      inProgress
    );
    expect(output).toContain('@nx/rust');
    expect(output).not.toMatch(/^\s*- @$/m);
    expect(output).not.toMatch(/^\s*- r$/m);
  });

  it('does not mutate the provided set', () => {
    const inProgress = new Set(['@nx/rust', '@nx/js']);
    formatPluginProgressText('Creating project metadata', inProgress);
    expect(inProgress.size).toBe(2);
  });

  it('reflects the current set contents across successive calls', () => {
    const inProgress = new Set(['@nx/rust', '@nx/js']);
    const before = formatPluginProgressText(
      'Creating project metadata',
      inProgress
    );
    inProgress.delete('@nx/rust');
    const after = formatPluginProgressText(
      'Creating project metadata',
      inProgress
    );

    expect(before).toContain('2 plugins');
    expect(after).toBe('Creating project metadata with @nx/js');
  });
});
