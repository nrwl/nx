jest.mock('../utils/output', () => ({
  output: { warn: jest.fn() },
}));
jest.mock('../project-graph/nx-deps-cache', () => ({
  readSourceMapsCache: jest.fn(),
}));

import {
  flushLegacyDependsOnViolations,
  LegacyDependsOnViolation,
  warnLegacyDependsOnMagicString,
} from './legacy-depends-on-warning';

const { output } = require('../utils/output');
const { readSourceMapsCache } = require('../project-graph/nx-deps-cache');

// The warned-keys set lives in module scope. We re-require to get a fresh
// module between tests so dedupe state doesn't leak between assertions.
function resetModule() {
  jest.resetModules();
  jest.doMock('../utils/output', () => ({ output: { warn: jest.fn() } }));
  jest.doMock('../project-graph/nx-deps-cache', () => ({
    readSourceMapsCache: jest.fn(),
  }));
  return {
    warning: require('./legacy-depends-on-warning'),
    output: require('../utils/output').output,
    cache: require('../project-graph/nx-deps-cache'),
  };
}

describe('legacy-depends-on-warning', () => {
  beforeEach(() => {
    (output.warn as jest.Mock).mockReset();
    (readSourceMapsCache as jest.Mock).mockReset();
  });

  describe('flushLegacyDependsOnViolations', () => {
    it('emits nothing when there are no violations', () => {
      flushLegacyDependsOnViolations('p', 't', [], undefined);
      expect(output.warn).not.toHaveBeenCalled();
    });

    it('emits a single warning for hand-authored entries from a config file', () => {
      const { warning, output: out, cache } = resetModule();
      (cache.readSourceMapsCache as jest.Mock).mockReturnValue({
        'libs/p': {
          'targets.build.dependsOn.0': [
            'libs/p/project.json',
            'nx/core/project-json',
          ],
        },
      });
      const violations: LegacyDependsOnViolation[] = [
        {
          value: 'self',
          index: 0,
          originalEntry: { projects: 'self', target: 'compile' },
        },
      ];
      warning.flushLegacyDependsOnViolations(
        'p',
        'build',
        violations,
        'libs/p'
      );
      expect(out.warn).toHaveBeenCalledTimes(1);
      const arg = (out.warn as jest.Mock).mock.calls[0][0];
      expect(arg.title).toContain('libs/p/project.json defines p:build');
      expect(arg.title).toContain("projects: 'self'");
      expect(arg.title).toContain("'nx repair'");
      expect(arg.bodyLines).toEqual([
        `  - {"projects":"self","target":"compile"} (0)`,
      ]);
    });

    it('emits one workspace-wide warning per external plugin (no body)', () => {
      const { warning, output: out, cache } = resetModule();
      (cache.readSourceMapsCache as jest.Mock).mockReturnValue({
        'libs/a': {
          'targets.e2e.dependsOn.0': [
            'libs/a/jest.config.cts',
            '@nx/jest/plugin',
          ],
          'targets.e2e.dependsOn.1': [
            'libs/a/jest.config.cts',
            '@nx/jest/plugin',
          ],
        },
        'libs/b': {
          'targets.e2e.dependsOn.0': [
            'libs/b/jest.config.cts',
            '@nx/jest/plugin',
          ],
        },
      });
      const make = (index: number): LegacyDependsOnViolation => ({
        value: 'self',
        index,
        originalEntry: { projects: 'self', target: `e2e--file${index}` },
      });
      warning.flushLegacyDependsOnViolations(
        'a',
        'e2e',
        [make(0), make(1)],
        'libs/a'
      );
      warning.flushLegacyDependsOnViolations('b', 'e2e', [make(0)], 'libs/b');
      expect(out.warn).toHaveBeenCalledTimes(1);
      const arg = (out.warn as jest.Mock).mock.calls[0][0];
      expect(arg.title).toContain('The @nx/jest/plugin plugin infers');
      expect(arg.title).toContain('please upgrade @nx/jest/plugin');
      expect(arg.bodyLines).toEqual([]);
    });

    it('falls back to mixed-source advice when sources differ', () => {
      const { warning, output: out, cache } = resetModule();
      (cache.readSourceMapsCache as jest.Mock).mockReturnValue({
        'libs/p': {
          'targets.build.dependsOn.0': [
            'libs/p/project.json',
            'nx/core/project-json',
          ],
          'targets.build.dependsOn.1': [
            'libs/p/jest.config.cts',
            '@nx/jest/plugin',
          ],
        },
      });
      const violations: LegacyDependsOnViolation[] = [
        {
          value: 'self',
          index: 0,
          originalEntry: { projects: 'self', target: 'compile' },
        },
        {
          value: 'self',
          index: 1,
          originalEntry: { projects: 'self', target: 'e2e--file' },
        },
      ];
      warning.flushLegacyDependsOnViolations(
        'p',
        'build',
        violations,
        'libs/p'
      );
      const arg = (out.warn as jest.Mock).mock.calls[0][0];
      expect(arg.title).toContain('p:build has 2 dependsOn entries');
      expect(arg.title).toContain("run 'nx repair' for hand-authored");
      expect(arg.title).toContain('upgrade @nx/jest/plugin');
      expect(arg.bodyLines).toHaveLength(2);
      expect(arg.bodyLines[1]).toContain('from @nx/jest/plugin');
    });

    it('reports a count breakdown when values are mixed', () => {
      const { warning, output: out, cache } = resetModule();
      (cache.readSourceMapsCache as jest.Mock).mockReturnValue({
        'libs/p': {
          'targets.build.dependsOn.0': [
            'libs/p/project.json',
            'nx/core/project-json',
          ],
          'targets.build.dependsOn.1': [
            'libs/p/project.json',
            'nx/core/project-json',
          ],
          'targets.build.dependsOn.2': [
            'libs/p/project.json',
            'nx/core/project-json',
          ],
        },
      });
      const violations: LegacyDependsOnViolation[] = [
        {
          value: 'self',
          index: 0,
          originalEntry: { projects: 'self', target: 'a' },
        },
        {
          value: 'self',
          index: 1,
          originalEntry: { projects: 'self', target: 'b' },
        },
        {
          value: 'dependencies',
          index: 2,
          originalEntry: { projects: 'dependencies', target: 'c' },
        },
      ];
      warning.flushLegacyDependsOnViolations(
        'p',
        'build',
        violations,
        'libs/p'
      );
      const arg = (out.warn as jest.Mock).mock.calls[0][0];
      expect(arg.title).toContain(
        "legacy projects values (2 'self', 1 'dependencies')"
      );
    });

    it('dedupes per (project, target) for hand-authored cases', () => {
      const { warning, output: out, cache } = resetModule();
      (cache.readSourceMapsCache as jest.Mock).mockReturnValue({
        'libs/p': {
          'targets.build.dependsOn.0': [
            'libs/p/project.json',
            'nx/core/project-json',
          ],
        },
      });
      const violations: LegacyDependsOnViolation[] = [
        {
          value: 'self',
          index: 0,
          originalEntry: { projects: 'self', target: 'a' },
        },
      ];
      warning.flushLegacyDependsOnViolations(
        'p',
        'build',
        violations,
        'libs/p'
      );
      warning.flushLegacyDependsOnViolations(
        'p',
        'build',
        violations,
        'libs/p'
      );
      expect(out.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('warnLegacyDependsOnMagicString', () => {
    it('appends to a collector when provided', () => {
      const collector: LegacyDependsOnViolation[] = [];
      warnLegacyDependsOnMagicString(
        'self',
        'p',
        { projects: 'self', target: 't' },
        { ownerTarget: 'build', index: 2, legacyViolations: collector }
      );
      expect(collector).toHaveLength(1);
      expect(collector[0]).toEqual({
        value: 'self',
        index: 2,
        originalEntry: { projects: 'self', target: 't' },
      });
      expect(output.warn).not.toHaveBeenCalled();
    });

    it('emits immediately when no collector is provided', () => {
      const { warning, output: out } = resetModule();
      warning.warnLegacyDependsOnMagicString(
        'self',
        'p',
        { projects: 'self', target: 't' },
        { ownerTarget: 'build', index: 0 }
      );
      expect(out.warn).toHaveBeenCalledTimes(1);
    });
  });
});
