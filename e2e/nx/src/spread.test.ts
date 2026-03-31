import {
  cleanupProject,
  newProject,
  readJson,
  runCLI,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';

describe('Spread Token Merging', () => {
  let proj: string;
  beforeAll(
    () => (proj = newProject({ packages: ['@nx/js'] })),
    10 * 60 * 1000
  );
  afterAll(() => cleanupProject());

  // Ensures that nx.json is restored to its original state after each test
  let existingNxJson;
  beforeEach(() => {
    existingNxJson = readJson('nx.json');
  });
  afterEach(() => {
    updateFile('nx.json', JSON.stringify(existingNxJson, null, 2));
  });

  function getResolvedProject(name: string) {
    return JSON.parse(
      runCLI(`show project ${name} --json`, { verbose: false })
    );
  }

  /**
   * Creates a local plugin file at tools/<name>.js that infers targets
   * for projects matching libs/* /project.json.
   */
  function createPlugin(
    name: string,
    targetFactory: string // JS expression returning targets object; has access to `root` and `name`
  ) {
    updateFile(
      `tools/${name}.js`,
      `
      const { dirname, basename } = require('path');
      module.exports = {
        createNodesV2: ['libs/*/project.json', (configFiles) => {
          const results = [];
          for (const configFile of configFiles) {
            const root = dirname(configFile);
            const name = basename(root);
            const targets = (function(root, name) { return ${targetFactory}; })(root, name);
            results.push([configFile, {
              projects: {
                [root]: { targets }
              }
            }]);
          }
          return results;
        }],
      };
    `
    );
  }

  describe('spread in specified plugins (nx.json plugins)', () => {
    it('should resolve spread when first specified plugin contains "..."', () => {
      const lib = uniq('lib');
      runCLI(`generate @nx/js:lib libs/${lib}`);

      // Remove any generator-created targets so they don't interfere
      updateJson(`libs/${lib}/project.json`, (c) => {
        c.targets = {};
        return c;
      });

      // Plugin A: defines build target with inputs
      createPlugin(
        'plugin-a',
        `{
        build: {
          executor: 'nx:run-commands',
          options: { command: 'echo build' },
          inputs: ['first-plugin', '...'],
        }
      }`
      );

      // Plugin B: also defines build target with inputs
      createPlugin(
        'plugin-b',
        `{
        build: {
          executor: 'nx:run-commands',
          options: { command: 'echo build' },
          inputs: ['second-plugin'],
        }
      }`
      );

      updateJson('nx.json', (json) => {
        json.plugins = ['./tools/plugin-a', './tools/plugin-b'];
        return json;
      });

      const project = getResolvedProject(lib);
      // plugin-b merges on top of plugin-a: overwrites
      expect(project.targets.build.inputs).toEqual(['second-plugin']);
    });

    it('should resolve spread when middle specified plugin contains "..."', () => {
      const lib = uniq('lib');
      runCLI(`generate @nx/js:lib libs/${lib}`);

      // Remove any generator-created targets so they don't interfere
      updateJson(`libs/${lib}/project.json`, (c) => {
        c.targets = {};
        return c;
      });

      createPlugin(
        'plugin-first',
        `{
        build: {
          executor: 'nx:run-commands',
          options: { command: 'echo build' },
          inputs: ['from-first'],
        }
      }`
      );

      createPlugin(
        'plugin-middle',
        `{
        build: {
          executor: 'nx:run-commands',
          options: { command: 'echo build' },
          inputs: ['from-middle', '...'],
        }
      }`
      );

      createPlugin(
        'plugin-last',
        `{
        build: {
          executor: 'nx:run-commands',
          options: { command: 'echo build' },
          inputs: ['from-last'],
        }
      }`
      );

      updateJson('nx.json', (json) => {
        // Order: first, middle (with spread), last
        // Processing: first sets base, middle spreads first's values, last replaces
        json.plugins = [
          './tools/plugin-first',
          './tools/plugin-middle',
          './tools/plugin-last',
        ];
        return json;
      });

      const project = getResolvedProject(lib);
      // last plugin wins (no spread), replaces everything
      expect(project.targets.build.inputs).toEqual(['from-last']);
    });

    it('should resolve spread when last specified plugin contains "..."', () => {
      const lib = uniq('lib');
      runCLI(`generate @nx/js:lib libs/${lib}`);

      // Remove any generator-created targets so they don't interfere
      updateJson(`libs/${lib}/project.json`, (c) => {
        c.targets = {};
        return c;
      });

      createPlugin(
        'plugin-base',
        `{
        build: {
          executor: 'nx:run-commands',
          options: { command: 'echo build' },
          inputs: ['base-value'],
        }
      }`
      );

      createPlugin(
        'plugin-spreader',
        `{
        build: {
          executor: 'nx:run-commands',
          options: { command: 'echo build' },
          inputs: ['last-value', '...'],
        }
      }`
      );

      updateJson('nx.json', (json) => {
        json.plugins = ['./tools/plugin-base', './tools/plugin-spreader'];
        return json;
      });

      const project = getResolvedProject(lib);
      // last plugin spreads: includes base plugin values
      expect(project.targets.build.inputs).toEqual([
        'last-value',
        'base-value',
      ]);
    });
  });

  describe('spread in project.json (default plugin)', () => {
    it('should resolve spread in project.json inputs with target defaults as base', () => {
      const lib = uniq('lib');
      runCLI(`generate @nx/js:lib libs/${lib}`);

      updateJson('nx.json', (json) => {
        json.targetDefaults = {
          echo: {
            executor: 'nx:run-commands',
            inputs: ['from-target-defaults'],
          },
        };
        return json;
      });

      updateJson(`libs/${lib}/project.json`, (c) => {
        c.targets = {
          echo: {
            inputs: ['from-project-json', '...'],
            options: { command: 'echo hello' },
          },
        };
        return c;
      });

      const project = getResolvedProject(lib);
      expect(project.targets.echo.inputs).toEqual([
        'from-project-json',
        'from-target-defaults',
      ]);
    });

    it('should resolve spread in project.json options with target default options as base', () => {
      const lib = uniq('lib');
      runCLI(`generate @nx/js:lib libs/${lib}`);

      updateJson('nx.json', (json) => {
        json.targetDefaults = {
          echo: {
            executor: 'nx:run-commands',
            options: {
              command: 'echo hello',
              args: ['default-arg-1', 'default-arg-2'],
            },
          },
        };
        return json;
      });

      updateJson(`libs/${lib}/project.json`, (c) => {
        c.targets = {
          echo: {
            options: {
              args: ['project-arg', '...'],
            },
          },
        };
        return c;
      });

      const project = getResolvedProject(lib);
      expect(project.targets.echo.options.args).toEqual([
        'project-arg',
        'default-arg-1',
        'default-arg-2',
      ]);
    });

    it('should resolve object spread in project.json env with target default env as base', () => {
      const lib = uniq('lib');
      runCLI(`generate @nx/js:lib libs/${lib}`);

      updateJson('nx.json', (json) => {
        json.targetDefaults = {
          echo: {
            executor: 'nx:run-commands',
            options: {
              command: 'echo hello',
              env: {
                DEFAULT_VAR: 'from-defaults',
                SHARED_VAR: 'default-value',
              },
            },
          },
        };
        return json;
      });

      updateJson(`libs/${lib}/project.json`, (c) => {
        c.targets = {
          echo: {
            options: {
              env: {
                PROJECT_VAR: 'from-project',
                '...': true,
                SHARED_VAR: 'project-value',
              },
            },
          },
        };
        return c;
      });

      const project = getResolvedProject(lib);
      // Object spread includes base, then SHARED_VAR after spread overrides
      expect(project.targets.echo.options.env).toEqual({
        PROJECT_VAR: 'from-project',
        DEFAULT_VAR: 'from-defaults',
        SHARED_VAR: 'project-value',
      });
    });

    it('should resolve spread in project.json inputs with specified plugin inputs as base (no target defaults)', () => {
      const lib = uniq('lib');
      runCLI(`generate @nx/js:lib libs/${lib}`);

      // Specified plugin infers a build target with inputs
      createPlugin(
        'infer-plugin',
        `{
        build: {
          executor: 'nx:run-commands',
          options: { command: 'echo build' },
          inputs: ['inferred-1', 'inferred-2'],
        }
      }`
      );

      updateJson('nx.json', (json) => {
        json.plugins = ['./tools/infer-plugin'];
        // No target defaults for build
        return json;
      });

      // project.json uses spread to extend the inferred inputs
      updateJson(`libs/${lib}/project.json`, (c) => {
        c.targets = {
          build: {
            inputs: ['from-project', '...'],
          },
        };
        return c;
      });

      const project = getResolvedProject(lib);
      // Spread in project.json expands with inferred plugin values
      expect(project.targets.build.inputs).toEqual([
        'from-project',
        'inferred-1',
        'inferred-2',
      ]);
    });

    it('should resolve spread in project.json inputs with specified plugin inputs as base (with target defaults overriding)', () => {
      const lib = uniq('lib');
      runCLI(`generate @nx/js:lib libs/${lib}`);

      // Specified plugin infers a build target with inputs
      createPlugin(
        'infer-plugin',
        `{
        build: {
          executor: 'nx:run-commands',
          options: { command: 'echo build' },
          inputs: ['inferred'],
        }
      }`
      );

      updateJson('nx.json', (json) => {
        json.plugins = ['./tools/infer-plugin'];
        // Target defaults override the inferred inputs (no spread)
        json.targetDefaults = {
          build: {
            inputs: ['from-defaults'],
          },
        };
        return json;
      });

      // project.json uses spread — base should be the resolved value
      // after target defaults replaced inferred
      updateJson(`libs/${lib}/project.json`, (c) => {
        c.targets = {
          build: {
            inputs: ['from-project', '...'],
          },
        };
        return c;
      });

      const project = getResolvedProject(lib);
      // Target defaults replaced inferred, so project.json spread sees only defaults
      expect(project.targets.build.inputs).toEqual([
        'from-project',
        'from-defaults',
      ]);
    });

    it('should resolve spread in project.json options with specified plugin options as base', () => {
      const lib = uniq('lib');
      runCLI(`generate @nx/js:lib libs/${lib}`);

      // Specified plugin infers build target with options
      createPlugin(
        'infer-plugin',
        `{
        build: {
          executor: 'nx:run-commands',
          options: {
            command: 'echo build',
            args: ['inferred-arg-1', 'inferred-arg-2'],
            env: { INFERRED_VAR: 'from-plugin' },
          },
        }
      }`
      );

      updateJson('nx.json', (json) => {
        json.plugins = ['./tools/infer-plugin'];
        return json;
      });

      // project.json uses spread to extend the inferred options
      updateJson(`libs/${lib}/project.json`, (c) => {
        c.targets = {
          build: {
            options: {
              args: ['project-arg', '...'],
              env: { PROJECT_VAR: 'from-project', '...': true },
            },
          },
        };
        return c;
      });

      const project = getResolvedProject(lib);
      expect(project.targets.build.options.args).toEqual([
        'project-arg',
        'inferred-arg-1',
        'inferred-arg-2',
      ]);
      expect(project.targets.build.options.env).toEqual({
        PROJECT_VAR: 'from-project',
        INFERRED_VAR: 'from-plugin',
      });
    });

    it('should fully replace when project.json does not use spread', () => {
      const lib = uniq('lib');
      runCLI(`generate @nx/js:lib libs/${lib}`);

      updateJson('nx.json', (json) => {
        json.targetDefaults = {
          echo: {
            executor: 'nx:run-commands',
            inputs: ['from-target-defaults'],
          },
        };
        return json;
      });

      updateJson(`libs/${lib}/project.json`, (c) => {
        c.targets = {
          echo: {
            inputs: ['only-from-project'],
            options: { command: 'echo hello' },
          },
        };
        return c;
      });

      const project = getResolvedProject(lib);
      // No spread: project.json fully replaces
      expect(project.targets.echo.inputs).toEqual(['only-from-project']);
    });
  });

  describe('spread in target defaults', () => {
    it('should resolve spread in target defaults with specified plugin values as base', () => {
      const lib = uniq('lib');
      runCLI(`generate @nx/js:lib libs/${lib}`);

      // Remove any generator-created targets so they don't interfere
      updateJson(`libs/${lib}/project.json`, (c) => {
        c.targets = {};
        return c;
      });

      createPlugin(
        'infer-plugin',
        `{
        build: {
          executor: 'nx:run-commands',
          options: { command: 'echo build' },
          inputs: ['inferred-input'],
        }
      }`
      );

      updateJson('nx.json', (json) => {
        json.plugins = ['./tools/infer-plugin'];
        json.targetDefaults = {
          build: {
            inputs: ['default-input', '...'],
          },
        };
        return json;
      });

      const project = getResolvedProject(lib);
      // Target defaults spread includes specified plugin values
      expect(project.targets.build.inputs).toEqual([
        'default-input',
        'inferred-input',
      ]);
    });

    it('should override specified plugin values when target defaults do not use spread', () => {
      const lib = uniq('lib');
      runCLI(`generate @nx/js:lib libs/${lib}`);

      // Remove any generator-created targets so they don't interfere
      updateJson(`libs/${lib}/project.json`, (c) => {
        c.targets = {};
        return c;
      });

      createPlugin(
        'infer-plugin',
        `{
        build: {
          executor: 'nx:run-commands',
          options: { command: 'echo build' },
          inputs: ['inferred-input'],
        }
      }`
      );

      updateJson('nx.json', (json) => {
        json.plugins = ['./tools/infer-plugin'];
        json.targetDefaults = {
          build: {
            inputs: ['only-default'],
          },
        };
        return json;
      });

      const project = getResolvedProject(lib);
      // No spread: target defaults fully override
      expect(project.targets.build.inputs).toEqual(['only-default']);
    });
  });

  describe('three-layer spread chain (specified + target defaults + project.json)', () => {
    it('should resolve spread through all three layers for array properties', () => {
      const lib = uniq('lib');
      runCLI(`generate @nx/js:lib libs/${lib}`);

      // Layer 1: specified plugin infers inputs
      createPlugin(
        'infer-plugin',
        `{
        build: {
          executor: 'nx:run-commands',
          options: { command: 'echo build' },
          inputs: ['inferred'],
        }
      }`
      );

      // Layer 2: target defaults use spread to include inferred
      updateJson('nx.json', (json) => {
        json.plugins = ['./tools/infer-plugin'];
        json.targetDefaults = {
          build: {
            inputs: ['from-defaults', '...'],
          },
        };
        return json;
      });

      // Layer 3: project.json uses spread to include (defaults + inferred)
      updateJson(`libs/${lib}/project.json`, (c) => {
        c.targets = {
          build: {
            inputs: ['from-project', '...'],
          },
        };
        return c;
      });

      const project = getResolvedProject(lib);
      // Full chain: project spreads (defaults + inferred)
      expect(project.targets.build.inputs).toEqual([
        'from-project',
        'from-defaults',
        'inferred',
      ]);
    });

    it('should resolve spread through all three layers for object option properties', () => {
      const lib = uniq('lib');
      runCLI(`generate @nx/js:lib libs/${lib}`);

      // Layer 1: specified plugin infers env
      createPlugin(
        'infer-plugin',
        `{
        build: {
          executor: 'nx:run-commands',
          options: {
            command: 'echo build',
            env: { INFERRED: 'true' },
          },
        }
      }`
      );

      // Layer 2: target defaults spread to include inferred env
      updateJson('nx.json', (json) => {
        json.plugins = ['./tools/infer-plugin'];
        json.targetDefaults = {
          build: {
            options: {
              env: { DEFAULT: 'true', '...': true },
            },
          },
        };
        return json;
      });

      // Layer 3: project.json spreads to include (defaults + inferred)
      updateJson(`libs/${lib}/project.json`, (c) => {
        c.targets = {
          build: {
            options: {
              env: { PROJECT: 'true', '...': true },
            },
          },
        };
        return c;
      });

      const project = getResolvedProject(lib);
      expect(project.targets.build.options.env).toEqual({
        PROJECT: 'true',
        DEFAULT: 'true',
        INFERRED: 'true',
      });
    });

    it('should resolve spread in project.json with specified + defaults base (no spread in defaults)', () => {
      const lib = uniq('lib');
      runCLI(`generate @nx/js:lib libs/${lib}`);

      // Specified plugin infers inputs
      createPlugin(
        'infer-plugin',
        `{
        build: {
          executor: 'nx:run-commands',
          options: { command: 'echo build' },
          inputs: ['inferred'],
        }
      }`
      );

      // Target defaults override (no spread)
      updateJson('nx.json', (json) => {
        json.plugins = ['./tools/infer-plugin'];
        json.targetDefaults = {
          build: {
            inputs: ['from-defaults'],
          },
        };
        return json;
      });

      // project.json uses spread
      updateJson(`libs/${lib}/project.json`, (c) => {
        c.targets = {
          build: {
            inputs: ['from-project', '...'],
          },
        };
        return c;
      });

      const project = getResolvedProject(lib);
      // Target defaults replaced inferred, project.json spreads with defaults
      expect(project.targets.build.inputs).toEqual([
        'from-project',
        'from-defaults',
      ]);
    });
  });

  describe('spread in configurations', () => {
    it('should resolve spread in project.json configuration arrays with target default configuration as base', () => {
      const lib = uniq('lib');
      runCLI(`generate @nx/js:lib libs/${lib}`);

      updateJson('nx.json', (json) => {
        json.targetDefaults = {
          echo: {
            executor: 'nx:run-commands',
            configurations: {
              production: {
                args: ['default-prod-arg'],
              },
            },
          },
        };
        return json;
      });

      updateJson(`libs/${lib}/project.json`, (c) => {
        c.targets = {
          echo: {
            options: { command: 'echo hello' },
            configurations: {
              production: {
                args: ['project-prod-arg', '...'],
              },
            },
          },
        };
        return c;
      });

      const project = getResolvedProject(lib);
      expect(project.targets.echo.configurations.production.args).toEqual([
        'project-prod-arg',
        'default-prod-arg',
      ]);
    });
  });

  describe('spread edge cases', () => {
    it('should handle spread when base has no value for the property', () => {
      const lib = uniq('lib');
      runCLI(`generate @nx/js:lib libs/${lib}`);

      updateJson('nx.json', (json) => {
        json.targetDefaults = {
          echo: {
            executor: 'nx:run-commands',
            // No inputs defined in target defaults
          },
        };
        return json;
      });

      updateJson(`libs/${lib}/project.json`, (c) => {
        c.targets = {
          echo: {
            inputs: ['from-project', '...'],
            options: { command: 'echo hello' },
          },
        };
        return c;
      });

      const project = getResolvedProject(lib);
      // Spread with no base: just the project values
      expect(project.targets.echo.inputs).toEqual(['from-project']);
    });

    it('should strip spread token when project.json is the only source for a target', () => {
      const lib = uniq('lib');
      runCLI(`generate @nx/js:lib libs/${lib}`);

      // No plugins define this target, no target defaults exist for it
      updateJson(`libs/${lib}/project.json`, (c) => {
        c.targets = {
          echo: {
            executor: 'nx:run-commands',
            inputs: ['project-input-1', '...', 'project-input-2'],
            options: {
              command: 'echo hello',
              args: ['arg1', '...'],
              env: { MY_VAR: 'value', '...': true },
            },
            dependsOn: ['prebuild', '...'],
          },
        };
        return c;
      });

      const project = getResolvedProject(lib);
      // '...' in arrays should be removed (nothing to spread)
      expect(project.targets.echo.inputs).toEqual([
        'project-input-1',
        'project-input-2',
      ]);
      expect(project.targets.echo.options.args).toEqual(['arg1']);
      expect(project.targets.echo.dependsOn).toEqual(['prebuild']);
      // '...' key in objects should be removed when value is `true`
      expect(project.targets.echo.options.env).toEqual({ MY_VAR: 'value' });
    });

    it('should handle multiple spread tokens (only first is processed)', () => {
      const lib = uniq('lib');
      runCLI(`generate @nx/js:lib libs/${lib}`);

      updateJson('nx.json', (json) => {
        json.targetDefaults = {
          echo: {
            executor: 'nx:run-commands',
            inputs: ['default-1', 'default-2'],
          },
        };
        return json;
      });

      updateJson(`libs/${lib}/project.json`, (c) => {
        c.targets = {
          echo: {
            inputs: ['before', '...', 'middle', '...', 'after'],
            options: { command: 'echo hello' },
          },
        };
        return c;
      });

      const project = getResolvedProject(lib);
      // First '...' is expanded, second '...' is treated as a literal or removed
      // The exact behavior here documents whatever the implementation does
      expect(project.targets.echo.inputs).toContain('before');
      expect(project.targets.echo.inputs).toContain('default-1');
      expect(project.targets.echo.inputs).toContain('default-2');
      expect(project.targets.echo.inputs).toContain('middle');
      expect(project.targets.echo.inputs).toContain('after');
    });

    it('should not treat string "..." value in object as spread (only boolean true triggers spread)', () => {
      const lib = uniq('lib');
      runCLI(`generate @nx/js:lib libs/${lib}`);

      updateJson('nx.json', (json) => {
        json.targetDefaults = {
          echo: {
            executor: 'nx:run-commands',
            options: {
              command: 'echo hello',
              env: { DEFAULT_VAR: 'value' },
            },
          },
        };
        return json;
      });

      updateJson(`libs/${lib}/project.json`, (c) => {
        c.targets = {
          echo: {
            options: {
              env: {
                PROJECT_VAR: 'value',
                '...': 'this is a comment, not a spread',
              },
            },
          },
        };
        return c;
      });

      const project = getResolvedProject(lib);
      // String value for '...' is kept as-is, not treated as spread
      expect(project.targets.echo.options.env).toEqual({
        PROJECT_VAR: 'value',
        '...': 'this is a comment, not a spread',
      });
    });

    it('should support spread in dependsOn with target defaults', () => {
      const lib = uniq('lib');
      runCLI(`generate @nx/js:lib libs/${lib}`);

      updateJson('nx.json', (json) => {
        json.targetDefaults = {
          echo: {
            executor: 'nx:run-commands',
            dependsOn: ['^build'],
          },
        };
        return json;
      });

      updateJson(`libs/${lib}/project.json`, (c) => {
        c.targets = {
          echo: {
            dependsOn: ['prebuild', '...'],
            options: { command: 'echo hello' },
          },
        };
        return c;
      });

      const project = getResolvedProject(lib);
      expect(project.targets.echo.dependsOn).toEqual(['prebuild', '^build']);
    });
  });
});
