import {
  cleanupProject,
  isNotWindows,
  newProject,
  readJson,
  runCLI,
  uniq,
  updateFile,
  updateProjectConfig,
} from '@nrwl/e2e/utils';

describe('Extra Nx Misc Tests', () => {
  beforeAll(() => newProject());
  afterAll(() => cleanupProject());

  describe('Output Style', () => {
    it('should stream output', async () => {
      const myapp = 'abcdefghijklmon';
      runCLI(`generate @nrwl/web:app ${myapp}`);
      updateProjectConfig(myapp, (c) => {
        c.targets['inner'] = {
          executor: 'nx:run-commands',
          options: {
            command: 'echo inner',
          },
        };
        c.targets['echo'] = {
          executor: 'nx:run-commands',
          options: {
            commands: ['echo 1', 'echo 2', `nx inner ${myapp}`],
            parallel: false,
          },
        };
        return c;
      });

      const withPrefixes = runCLI(`echo ${myapp} --output-style=stream`).split(
        isNotWindows() ? '\n' : '\r\n'
      );
      expect(withPrefixes).toContain(`[${myapp}] 1`);
      expect(withPrefixes).toContain(`[${myapp}] 2`);
      expect(withPrefixes).toContain(`[${myapp}] inner`);

      const noPrefixes = runCLI(
        `echo ${myapp} --output-style=stream-without-prefixes`
      );
      expect(noPrefixes).not.toContain(`[${myapp}]`);
    });
  });

  describe('Nx Plugins', () => {
    it('should use plugins defined in nx.json', () => {
      const nxJson = readJson('nx.json');
      nxJson.plugins = ['./tools/plugin'];
      updateFile('nx.json', JSON.stringify(nxJson));
      updateFile(
        'tools/plugin.js',
        `
      module.exports = {
        processProjectGraph: (graph) => {
          const Builder = require('@nrwl/devkit').ProjectGraphBuilder;
          const builder = new Builder(graph);
          builder.addNode({
            name: 'plugin-node',
            type: 'lib',
            data: {
              root: 'test'
            }
          });
          builder.addNode({
            name: 'plugin-node2',
            type: 'lib',
            data: {
              root: 'test2'
            }
          });
          builder.addImplicitDependency(
            'plugin-node',
            'plugin-node2'
          );
          return builder.getUpdatedProjectGraph();
        }
      };
    `
      );

      runCLI('dep-graph --file project-graph.json');
      const projectGraphJson = readJson('project-graph.json');
      expect(projectGraphJson.graph.nodes['plugin-node']).toBeDefined();
      expect(projectGraphJson.graph.nodes['plugin-node2']).toBeDefined();
      expect(projectGraphJson.graph.dependencies['plugin-node']).toContainEqual(
        {
          type: 'implicit',
          source: 'plugin-node',
          target: 'plugin-node2',
        }
      );
    });
  });

  describe('Run Commands', () => {
    const mylib = uniq('lib');
    beforeAll(() => {
      runCLI(`generate @nrwl/workspace:lib ${mylib}`);
    });

    it('should not override environment variables already set when setting a custom env file path', async () => {
      updateFile(
        `.env`,
        'SHARED_VAR=shared-root-value\nROOT_ONLY=root-only-value'
      );

      updateFile(
        `apps/${mylib}/.custom.env`,
        'SHARED_VAR=shared-nested-value\nNESTED_ONLY=nested-only-value'
      );

      const envFile = `apps/${mylib}/.custom.env`;
      runCLI(
        `generate @nrwl/workspace:run-commands echoEnvVariables --command=echo --envFile=${envFile} --project=${mylib}`
      );

      const command =
        process.platform === 'win32'
          ? `%SHARED_VAR% %ROOT_ONLY% %NESTED_ONLY%` // Windows
          : `$SHARED_VAR $ROOT_ONLY $NESTED_ONLY`;
      updateProjectConfig(mylib, (config) => {
        config.targets.echoEnvVariables.options.command += ` ${command}`;
        return config;
      });

      const result = runCLI(`run ${mylib}:echoEnvVariables`);
      expect(result).toContain('shared-root-value');
      expect(result).not.toContain('shared-nested-value');
      expect(result).toContain('root-only-value');
      expect(result).toContain('nested-only-value');
    }, 120000);

    it('should pass options', async () => {
      updateProjectConfig(mylib, (config) => {
        config.targets.echo = {
          executor: '@nrwl/workspace:run-commands',
          options: {
            command: 'echo --var1={args.var1}',
            var1: 'a',
          },
        };
        return config;
      });

      const result = runCLI(`run ${mylib}:echo`, { silent: true });
      expect(result).toContain('--var1=a');
    }, 120000);

    it('should interpolate provided arguments', async () => {
      const echoTarget = uniq('echo');
      updateProjectConfig(mylib, (config) => {
        config.targets[echoTarget] = {
          executor: '@nrwl/workspace:run-commands',
          options: {
            commands: [
              'echo "Arguments:"',
              'echo "  var1: {args.var1}"',
              'echo "  var2: {args.var2}"',
              'echo "  hyphen: {args.var-hyphen}"',
              'echo "  camel: {args.varCamelCase}"',
              'echo ""',
            ],
          },
        };
        return config;
      });

      const result = runCLI(
        `run ${mylib}:${echoTarget} --var1=a --var2=b --var-hyphen=c --varCamelCase=d`
      );
      expect(result).toContain('var1: a');
      expect(result).toContain('var2: b');
      expect(result).toContain('hyphen: c');
      expect(result).toContain('camel: d');

      const resultArgs = runCLI(
        `run ${mylib}:${echoTarget} --args="--var1=a --var2=b --var-hyphen=c --varCamelCase=d"`
      );
      expect(resultArgs).toContain('var1: a');
      expect(resultArgs).toContain('var2: b');
      expect(resultArgs).toContain('hyphen: c');
      expect(resultArgs).toContain('camel: d');
    }, 120000);

    it('ttt should fail when a process exits non-zero', () => {
      updateProjectConfig(mylib, (config) => {
        config.targets.error = {
          executor: '@nrwl/workspace:run-commands',
          options: {
            command: `exit 1`,
          },
        };
        return config;
      });

      try {
        runCLI(`run ${mylib}:error`);
        fail('Should error if process errors');
      } catch (e) {
        expect(e.stdout.toString()).toContain(
          'Something went wrong in run-commands - Command failed: exit 1'
        );
      }
    });

    it('run command should not break if output property is missing in options and arguments', () => {
      updateProjectConfig(mylib, (config) => {
        config.targets.lint.outputs = ['{options.outputFile}'];
        return config;
      });

      expect(() =>
        runCLI(`run ${mylib}:lint --format=json`, {
          silenceError: true,
        })
      ).not.toThrow();
    }, 1000000);
  });
});
