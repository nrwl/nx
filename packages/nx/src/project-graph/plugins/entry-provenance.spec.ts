import { describe, expect, it } from 'vitest';

import { isSourceEntry } from './entry-provenance';

import type { ProjectConfiguration } from '../../config/workspace-json-project-json';

const root = '/workspace';
const projectRoot = 'packages/pkg';
const file = (relativePath: string) => `${root}/${projectRoot}/${relativePath}`;

function project(
  overrides: Partial<ProjectConfiguration> = {}
): ProjectConfiguration {
  return { name: 'pkg', root: projectRoot, targets: {}, ...overrides };
}

describe('isSourceEntry', () => {
  it('treats a file the conditioned exports select over the default target as source', () => {
    expect(isSourceEntry(file('dist/index.js'), true, project(), root)).toBe(
      true
    );
  });

  it.each(['.ts', '.tsx', '.cts', '.mts'])(
    'treats a TypeScript file (%s) as source wherever it sits',
    (ext) => {
      expect(
        isSourceEntry(file(`dist/index${ext}`), false, project(), root)
      ).toBe(true);
    }
  );

  describe('a JavaScript file the default resolution also selects', () => {
    it('is built under a declared target output, even inside sourceRoot', () => {
      const config = project({
        sourceRoot: projectRoot,
        targets: { build: { outputs: ['{projectRoot}/dist'] } },
      });

      expect(isSourceEntry(file('dist/index.js'), false, config, root)).toBe(
        false
      );
      expect(isSourceEntry(file('src/index.js'), false, config, root)).toBe(
        true
      );
    });

    it('is built under a target outputPath option', () => {
      const config = project({
        sourceRoot: projectRoot,
        targets: {
          compile: { options: { outputPath: `${projectRoot}/out` } },
        },
      });

      expect(isSourceEntry(file('out/index.js'), false, config, root)).toBe(
        false
      );
    });

    it('is built under the conventional output of a build target without outputs', () => {
      const config = project({
        sourceRoot: projectRoot,
        targets: { build: { executor: 'nx:run-commands' } },
      });

      expect(isSourceEntry(file('dist/index.js'), false, config, root)).toBe(
        false
      );
      expect(isSourceEntry(file('lib/index.js'), false, config, root)).toBe(
        true
      );
    });

    it('is built under a glob output and ignores negated outputs', () => {
      const config = project({
        sourceRoot: projectRoot,
        targets: {
          build: {
            outputs: ['{projectRoot}/out/**/*.js', '!{projectRoot}/src'],
          },
        },
      });

      expect(
        isSourceEntry(file('out/nested/index.js'), false, config, root)
      ).toBe(false);
      expect(isSourceEntry(file('src/index.js'), false, config, root)).toBe(
        true
      );
    });

    it('is built under a glob output through hidden directories and files', () => {
      const config = project({
        sourceRoot: projectRoot,
        targets: { build: { outputs: ['{projectRoot}/out/**/*.js'] } },
      });

      expect(
        isSourceEntry(file('out/.hidden/index.js'), false, config, root)
      ).toBe(false);
      expect(isSourceEntry(file('out/.index.js'), false, config, root)).toBe(
        false
      );
    });

    it('is built under an output declared only by a target configuration', () => {
      const config = project({
        sourceRoot: projectRoot,
        targets: {
          compile: {
            defaultConfiguration: 'production',
            configurations: {
              production: { outputPath: `${projectRoot}/release` },
              ci: { outputPath: `${projectRoot}/ci-release` },
            },
          },
          bundle: {
            outputs: ['{options.outputPath}'],
            configurations: {
              production: { outputPath: `${projectRoot}/bundle` },
            },
          },
        },
      });

      expect(isSourceEntry(file('release/index.js'), false, config, root)).toBe(
        false
      );
      expect(
        isSourceEntry(file('ci-release/index.js'), false, config, root)
      ).toBe(false);
      expect(isSourceEntry(file('bundle/index.js'), false, config, root)).toBe(
        false
      );
    });

    it('matches a glob output with either separator and with ?', () => {
      const config = project({
        sourceRoot: projectRoot,
        targets: {
          build: {
            options: { outputPath: `${projectRoot}\\out\\**\\*.js` },
          },
          bundle: { outputs: ['{projectRoot}/out?/bundle'] },
        },
      });

      expect(isSourceEntry(file('src/index.js'), false, config, root)).toBe(
        true
      );
      expect(
        isSourceEntry(file('out/nested/index.js'), false, config, root)
      ).toBe(false);
      expect(
        isSourceEntry(file('out1/bundle/index.js'), false, config, root)
      ).toBe(false);
    });

    it.each([
      './out-dir',
      'out-dir/',
      'build/../out-dir',
      ['./out-dir'],
      './out-dir/**/*.js',
      'out-dir\\',
    ])(
      'is built under an output spelled %j relative to the project',
      (outputPath) => {
        const spelled = Array.isArray(outputPath)
          ? outputPath.map((p) => `${projectRoot}/${p}`)
          : `${projectRoot}/${outputPath}`;
        const config = project({
          sourceRoot: projectRoot,
          targets: { compile: { options: { outputPath: spelled } } },
        });

        expect(
          isSourceEntry(file('out-dir/nested/index.js'), false, config, root)
        ).toBe(false);
        expect(isSourceEntry(file('src/index.js'), false, config, root)).toBe(
          true
        );
      }
    );

    it('normalizes the literal prefix of a glob output and leaves its glob syntax intact', () => {
      const config = project({
        sourceRoot: projectRoot,
        targets: {
          compile: {
            options: {
              outputPath: [
                `${projectRoot}/{a/../out-dir,release}/*.js`,
                `${projectRoot}/build/../bundle/**/*.js`,
              ],
            },
          },
        },
      });

      expect(isSourceEntry(file('release/index.js'), false, config, root)).toBe(
        false
      );
      expect(isSourceEntry(file('out-dir/index.js'), false, config, root)).toBe(
        false
      );
      expect(
        isSourceEntry(file('bundle/nested/index.js'), false, config, root)
      ).toBe(false);
      expect(isSourceEntry(file('src/index.js'), false, config, root)).toBe(
        true
      );
    });

    it('keeps a glob below the filesystem root anchored there and a relative glob-first output relative', () => {
      const rootProject = project({
        root: '.',
        sourceRoot: '.',
        targets: {
          compile: { options: { outputPath: ['/*.js', 'C:/*.js'] } },
        },
      });
      expect(isSourceEntry(`${root}/plugin.js`, false, rootProject, root)).toBe(
        true
      );

      const config = project({
        sourceRoot: projectRoot,
        targets: { compile: { options: { outputPath: '**/out-dir/*.js' } } },
      });
      expect(isSourceEntry(file('out-dir/index.js'), false, config, root)).toBe(
        false
      );
      expect(isSourceEntry(file('src/index.js'), false, config, root)).toBe(
        true
      );
    });

    it.each(['.', '..', '/'])(
      'is built under an output %j that contains the workspace',
      (outputPath) => {
        const config = project({
          sourceRoot: projectRoot,
          targets: {
            compile: {
              outputs: ['{options.outputPath}'],
              options: { outputPath },
            },
          },
        });

        expect(isSourceEntry(file('src/index.js'), false, config, root)).toBe(
          false
        );
      }
    );

    it('is source beside an output outside the workspace', () => {
      const config = project({
        sourceRoot: projectRoot,
        targets: { compile: { options: { outputPath: '../artifacts' } } },
      });

      expect(isSourceEntry(file('src/index.js'), false, config, root)).toBe(
        true
      );
    });

    it('is source under sourceRoot when no output covers it', () => {
      const config = project({ sourceRoot: `${projectRoot}/src` });

      expect(isSourceEntry(file('src/plugin.mjs'), false, config, root)).toBe(
        true
      );
      expect(isSourceEntry(file('dist/plugin.mjs'), false, config, root)).toBe(
        false
      );
    });

    it('is built without a sourceRoot or an output to place it', () => {
      expect(isSourceEntry(file('src/index.js'), false, project(), root)).toBe(
        false
      );
      expect(
        isSourceEntry(
          file('src/index.js'),
          false,
          project({ targets: undefined }),
          root
        )
      ).toBe(false);
    });

    it('skips a target whose outputs are invalid instead of failing resolution', () => {
      const config = project({
        sourceRoot: `${projectRoot}/src`,
        targets: {
          build: { outputs: [123 as unknown as string] },
          bundle: { outputs: ['{projectRoot}/src/bundled'] },
        },
      });

      expect(isSourceEntry(file('src/index.js'), false, config, root)).toBe(
        true
      );
      expect(
        isSourceEntry(file('src/bundled/index.js'), false, config, root)
      ).toBe(false);
    });
  });
});
