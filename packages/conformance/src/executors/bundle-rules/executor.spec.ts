import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TempFs } from '../../../testing/temp-fs';
import runExecutor from './executor';

describe('Bundle Rules Executor', () => {
  let tempFs: TempFs;

  beforeEach(async () => {
    tempFs = new TempFs('bundle-rules-executor');
    vi.clearAllMocks();
  });

  afterEach(() => {
    tempFs.cleanup();
  });

  describe('basic functionality', () => {
    it('should successfully bundle a single rule with no additional dependencies', async () => {
      await tempFs.createFiles({
        'projects/rules/src/test-rule/index.ts': `
          import { createConformanceRule } from '@nx/conformance';

          export default createConformanceRule<object>({
            name: 'test-cloud-rule',
            category: 'reliability',
            description: 'A test cloud rule',
            implementation: async () => {
              return {
                severity: 'low',
                details: {
                  violations: [],
                },
              };
            },
          });
        `,
        'projects/rules/src/test-rule/schema.json': JSON.stringify({
          $schema: 'http://json-schema.org/schema',
          type: 'object',
        }),
      });

      const result = await runExecutor({ outputPath: 'dist' }, {
        projectName: 'rules',
        root: tempFs.tempDir,
        projectsConfigurations: {
          projects: {
            rules: {
              root: 'projects/rules',
            },
          },
        },
      } as any);

      expect(result.success).toBe(true);
      const packageJson = JSON.parse(
        await tempFs.readFile('dist/test-rule/package.json')
      );
      expect(packageJson).toMatchInlineSnapshot(`
{
  "dependencies": {
    "@nx/conformance": "^0",
  },
  "private": true,
}
`);
      expect(await tempFs.readFile('dist/test-rule/index.js')).toContain(
        'createConformanceRule'
      );
    });

    it('should work for deep imports into nx and packages', async () => {
      await tempFs.createFiles({
        'projects/rules/src/test-rule/index.ts': `
          import { createConformanceRule } from '@nx/conformance/some/nested/path';
          import { logger } from 'nx/src/devkit-exports';
          console.log(logger);

          export default createConformanceRule<object>({
            name: 'test-cloud-rule',
            category: 'reliability',
            description: 'A test cloud rule',
            implementation: async () => {
              return {
                severity: 'low',
                details: {
                  violations: [],
                },
              };
            },
          });
        `,
        'projects/rules/src/test-rule/schema.json': JSON.stringify({
          $schema: 'http://json-schema.org/schema',
          type: 'object',
        }),
      });

      const result = await runExecutor({ outputPath: 'dist' }, {
        projectName: 'rules',
        root: tempFs.tempDir,
        projectsConfigurations: {
          projects: {
            rules: {
              root: 'projects/rules',
            },
          },
        },
      } as any);

      expect(result.success).toBe(true);
      const packageJson = JSON.parse(
        await tempFs.readFile('dist/test-rule/package.json')
      );
      expect(packageJson).toMatchInlineSnapshot(`
{
  "dependencies": {
    "@nx/conformance": "^0",
    "nx": "^0",
  },
  "private": true,
}
`);
      expect(await tempFs.readFile('dist/test-rule/index.js')).toContain(
        'createConformanceRule'
      );
    });

    it('should successfully bundle multiple rules in separate directories', async () => {
      await tempFs.createFiles({
        'projects/rules/src/rule-one/index.ts': `
          import { createConformanceRule } from '@nx/conformance';
          export default createConformanceRule<object>({
            name: 'rule-one',
            category: 'reliability',
            description: 'First rule',
            implementation: async () => ({
              severity: 'low',
              details: { violations: [] },
            }),
          });
        `,
        'projects/rules/src/rule-one/schema.json': JSON.stringify({
          $schema: 'http://json-schema.org/schema',
          type: 'object',
        }),
        'projects/rules/src/rule-two/index.ts': `
          import { createConformanceRule } from '@nx/conformance';
          import { logger } from '@nx/devkit';
          console.log(logger);
          export default createConformanceRule<object>({
            name: 'rule-two',
            category: 'reliability',
            description: 'Second rule',
            implementation: async () => ({
              severity: 'low',
              details: { violations: [] },
            }),
          });
        `,
        'projects/rules/src/rule-two/schema.json': JSON.stringify({
          $schema: 'http://json-schema.org/schema',
          type: 'object',
        }),
      });

      const result = await runExecutor({ outputPath: 'dist' }, {
        projectName: 'rules',
        root: tempFs.tempDir,
        projectsConfigurations: {
          projects: {
            rules: {
              root: 'projects/rules',
            },
          },
        },
      } as any);

      expect(result.success).toBe(true);

      // Check rule one
      const packageJsonOne = JSON.parse(
        await tempFs.readFile('dist/rule-one/package.json')
      );
      expect(packageJsonOne).toMatchInlineSnapshot(`
{
  "dependencies": {
    "@nx/conformance": "^0",
  },
  "private": true,
}
`);

      // Check rule two (should have both and devkit deps)
      const packageJsonTwo = JSON.parse(
        await tempFs.readFile('dist/rule-two/package.json')
      );
      expect(packageJsonTwo).toMatchInlineSnapshot(`
{
  "dependencies": {
    "@nx/conformance": "^0",
    "@nx/devkit": "^0",
  },
  "private": true,
}
`);
    });

    it('should successfully bundle multiple rules in a custom rules directory', async () => {
      await tempFs.createFiles({
        'projects/rules/src/custom-rules-directory/rule-one/index.ts': `
          import { createConformanceRule } from '@nx/conformance';
          export default createConformanceRule<object>({
            name: 'rule-one',
            category: 'reliability',
            description: 'First rule',
            implementation: async () => ({
              severity: 'low',
              details: { violations: [] },
            }),
          });
        `,
        'projects/rules/src/custom-rules-directory/rule-one/schema.json':
          JSON.stringify({
            $schema: 'http://json-schema.org/schema',
            type: 'object',
          }),
        'projects/rules/src/custom-rules-directory/rule-two/index.ts': `
          import { createConformanceRule } from '@nx/conformance';
          import { logger } from '@nx/devkit';
          console.log(logger);
          export default createConformanceRule<object>({
            name: 'rule-two',
            category: 'reliability',
            description: 'Second rule',
            implementation: async () => ({
              severity: 'low',
              details: { violations: [] },
            }),
          });
        `,
        'projects/rules/src/custom-rules-directory/rule-two/schema.json':
          JSON.stringify({
            $schema: 'http://json-schema.org/schema',
            type: 'object',
          }),
      });

      const result = await runExecutor(
        {
          rulesDirectory: 'projects/rules/src/custom-rules-directory',
          outputPath: 'dist/custom-rules-directory',
        },
        {
          projectName: 'rules',
          root: tempFs.tempDir,
          projectsConfigurations: {
            projects: {
              rules: {
                root: 'projects/rules',
              },
            },
          },
        } as any
      );

      expect(result.success).toBe(true);

      // Check rule one
      const packageJsonOne = JSON.parse(
        await tempFs.readFile(
          'dist/custom-rules-directory/rule-one/package.json'
        )
      );
      expect(packageJsonOne).toMatchInlineSnapshot(`
{
  "dependencies": {
    "@nx/conformance": "^0",
  },
  "private": true,
}
`);

      // Check rule two (should have both and devkit deps)
      const packageJsonTwo = JSON.parse(
        await tempFs.readFile(
          'dist/custom-rules-directory/rule-two/package.json'
        )
      );
      expect(packageJsonTwo).toMatchInlineSnapshot(`
{
  "dependencies": {
    "@nx/conformance": "^0",
    "@nx/devkit": "^0",
  },
  "private": true,
}
`);
    });
  });

  describe('error handling', () => {
    it('should fail if the project root cannot be determined', async () => {
      const consoleSpy = vi.spyOn(console, 'error');
      const result = await runExecutor({ outputPath: 'dist' }, {
        projectName: 'nonexistent',
        root: tempFs.tempDir,
        projectsConfigurations: {
          projects: {},
        },
      } as any);

      expect(result.success).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Project root could not be determined, please report this error'
        )
      );
    });

    it(`should fail if no rules are found in the project's src directory`, async () => {
      await tempFs.createFiles({
        'projects/rules/src/.gitkeep': '',
      });

      const consoleSpy = vi.spyOn(console, 'error');
      const result = await runExecutor({ outputPath: 'dist' }, {
        projectName: 'rules',
        root: tempFs.tempDir,
        projectsConfigurations: {
          projects: {
            rules: {
              root: 'projects/rules',
            },
          },
        },
      } as any);

      expect(result.success).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to discover rules: No valid rules found'
        )
      );
    });

    it('should fail if any rule directory is missing required files', async () => {
      await tempFs.createFiles({
        'projects/rules/src/incomplete-rule/index.ts': `
          import { createConformanceRule } from '@nx/conformance';
          export default createConformanceRule();
        `,
        'projects/rules/src/complete-rule/index.ts': `
          import { createConformanceRule } from '@nx/conformance';
          export default createConformanceRule();
        `,
        'projects/rules/src/complete-rule/schema.json': JSON.stringify({
          $schema: 'http://json-schema.org/schema',
          type: 'object',
        }),
      });

      const consoleSpy = vi.spyOn(console, 'error');

      const result = await runExecutor({ outputPath: 'dist' }, {
        projectName: 'rules',
        root: tempFs.tempDir,
        projectsConfigurations: {
          projects: {
            rules: {
              root: 'projects/rules',
            },
          },
        },
      } as any);

      expect(result.success).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Directory incomplete-rule is missing required files'
        )
      );
    });

    describe('schema validation', () => {
      it('should fail if schema.json is missing $schema field', async () => {
        await tempFs.createFiles({
          'projects/rules/src/test-rule/index.ts': `
            import { createConformanceRule } from '@nx/conformance';
            export default createConformanceRule();
          `,
          'projects/rules/src/test-rule/schema.json': JSON.stringify({
            type: 'object',
          }),
        });

        const consoleSpy = vi.spyOn(console, 'error');
        const result = await runExecutor({ outputPath: 'dist' }, {
          projectName: 'rules',
          root: tempFs.tempDir,
          projectsConfigurations: {
            projects: {
              rules: {
                root: 'projects/rules',
              },
            },
          },
        } as any);

        expect(result.success).toBe(false);
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('missing required fields: $schema')
        );
      });

      it('should fail if schema.json has incorrect type field', async () => {
        await tempFs.createFiles({
          'projects/rules/src/test-rule/index.ts': `
            import { createConformanceRule } from '@nx/conformance';
            export default createConformanceRule();
          `,
          'projects/rules/src/test-rule/schema.json': JSON.stringify({
            $schema: 'http://json-schema.org/schema',
            type: 'string',
          }),
        });

        const consoleSpy = vi.spyOn(console, 'error');
        const result = await runExecutor({ outputPath: 'dist' }, {
          projectName: 'rules',
          root: tempFs.tempDir,
          projectsConfigurations: {
            projects: {
              rules: {
                root: 'projects/rules',
              },
            },
          },
        } as any);

        expect(result.success).toBe(false);
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('must have "type": "object"')
        );
      });

      it('should fail if schema.json is malformed JSON', async () => {
        await tempFs.createFiles({
          'projects/rules/src/test-rule/index.ts': `
            import { createConformanceRule } from '@nx/conformance';
            export default createConformanceRule();
          `,
          'projects/rules/src/test-rule/schema.json': '{invalid json',
        });

        const consoleSpy = vi.spyOn(console, 'error');
        const result = await runExecutor({ outputPath: 'dist' }, {
          projectName: 'rules',
          root: tempFs.tempDir,
          projectsConfigurations: {
            projects: {
              rules: {
                root: 'projects/rules',
              },
            },
          },
        } as any);

        expect(result.success).toBe(false);
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('InvalidSymbol in')
        );
      });
    });
  });
});
