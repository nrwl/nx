jest.mock('../utils/output', () => ({
  output: { warn: jest.fn() },
}));
jest.mock('../project-graph/nx-deps-cache', () => ({
  readSourceMapsCache: jest.fn(),
}));

import {
  __resetForTests,
  flushLegacyDependsOnViolations,
  LegacyDependsOnViolation,
  warnLegacyDependsOnMagicString,
} from './legacy-depends-on-warning';

const { output } = require('../utils/output');
const { readSourceMapsCache } = require('../project-graph/nx-deps-cache');

const selfEntry = (target: string) => ({ projects: 'self', target }) as const;

describe('legacy-depends-on-warning', () => {
  beforeEach(() => {
    __resetForTests();
    (output.warn as jest.Mock).mockReset();
    (readSourceMapsCache as jest.Mock).mockReset();
  });

  describe('flushLegacyDependsOnViolations', () => {
    it('emits nothing when there are no violations', () => {
      flushLegacyDependsOnViolations('p', 't', [], undefined);
      expect(output.warn).not.toHaveBeenCalled();
    });

    it('emits a single warning for hand-authored entries from a config file', () => {
      (readSourceMapsCache as jest.Mock).mockReturnValue({
        'libs/p': {
          'targets.build.dependsOn.0': [
            'libs/p/project.json',
            'nx/core/project-json',
          ],
        },
      });
      const violations: LegacyDependsOnViolation[] = [
        { index: 0, originalEntry: selfEntry('compile') },
      ];
      flushLegacyDependsOnViolations('p', 'build', violations, 'libs/p');
      expect(output.warn).toHaveBeenCalledTimes(1);
      const arg = (output.warn as jest.Mock).mock.calls[0][0];
      expect(arg.title).toContain('libs/p/project.json defines p:build');
      expect(arg.title).toContain("projects: 'self'");
      expect(arg.title).toContain("'nx repair'");
      expect(arg.bodyLines).toEqual([
        `  - {"projects":"self","target":"compile"} (0)`,
      ]);
    });

    it('emits one workspace-wide warning per external plugin (no body)', () => {
      (readSourceMapsCache as jest.Mock).mockReturnValue({
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
        index,
        originalEntry: selfEntry(`e2e--file${index}`),
      });
      flushLegacyDependsOnViolations('a', 'e2e', [make(0), make(1)], 'libs/a');
      flushLegacyDependsOnViolations('b', 'e2e', [make(0)], 'libs/b');
      expect(output.warn).toHaveBeenCalledTimes(1);
      const arg = (output.warn as jest.Mock).mock.calls[0][0];
      expect(arg.title).toContain('The @nx/jest/plugin plugin infers');
      expect(arg.title).toContain('please upgrade @nx/jest/plugin');
      expect(arg.bodyLines).toEqual([]);
    });

    it('falls back to mixed-source advice when sources differ', () => {
      (readSourceMapsCache as jest.Mock).mockReturnValue({
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
        { index: 0, originalEntry: selfEntry('compile') },
        { index: 1, originalEntry: selfEntry('e2e--file') },
      ];
      flushLegacyDependsOnViolations('p', 'build', violations, 'libs/p');
      const arg = (output.warn as jest.Mock).mock.calls[0][0];
      expect(arg.title).toContain('p:build has 2 dependsOn entries');
      expect(arg.title).toContain("run 'nx repair' for hand-authored");
      expect(arg.title).toContain('upgrade @nx/jest/plugin');
      expect(arg.bodyLines).toHaveLength(2);
      expect(arg.bodyLines[1]).toContain('from @nx/jest/plugin');
    });

    it('reports a count breakdown when values are mixed', () => {
      (readSourceMapsCache as jest.Mock).mockReturnValue({
        'libs/p': {
          'targets.build.dependsOn': [
            'libs/p/project.json',
            'nx/core/project-json',
          ],
        },
      });
      const violations: LegacyDependsOnViolation[] = [
        { index: 0, originalEntry: selfEntry('a') },
        { index: 1, originalEntry: selfEntry('b') },
        {
          index: 2,
          originalEntry: { projects: 'dependencies', target: 'c' },
        },
      ];
      flushLegacyDependsOnViolations('p', 'build', violations, 'libs/p');
      const arg = (output.warn as jest.Mock).mock.calls[0][0];
      expect(arg.title).toContain(
        "legacy projects values (2 'self', 1 'dependencies')"
      );
    });

    it('dedupes per (project, target) for hand-authored cases', () => {
      (readSourceMapsCache as jest.Mock).mockReturnValue({
        'libs/p': {
          'targets.build.dependsOn.0': [
            'libs/p/project.json',
            'nx/core/project-json',
          ],
        },
      });
      const violations: LegacyDependsOnViolation[] = [
        { index: 0, originalEntry: selfEntry('a') },
      ];
      flushLegacyDependsOnViolations('p', 'build', violations, 'libs/p');
      flushLegacyDependsOnViolations('p', 'build', violations, 'libs/p');
      expect(output.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('warnLegacyDependsOnMagicString', () => {
    it('appends to a collector when provided', () => {
      const collector: LegacyDependsOnViolation[] = [];
      warnLegacyDependsOnMagicString('p', selfEntry('t'), {
        ownerTarget: 'build',
        index: 2,
        legacyViolations: collector,
      });
      expect(collector).toEqual([{ index: 2, originalEntry: selfEntry('t') }]);
      expect(output.warn).not.toHaveBeenCalled();
    });

    it('emits immediately when no collector is provided', () => {
      warnLegacyDependsOnMagicString('p', selfEntry('t'), {
        ownerTarget: 'build',
        index: 0,
      });
      expect(output.warn).toHaveBeenCalledTimes(1);
    });
  });
});
