import {
  newProject,
  cleanupProject,
  runCLI,
  uniq,
  updateFile,
  updateProjectConfig,
} from '@nrwl/e2e/utils';

describe('Run Commands', () => {
  beforeAll(() => newProject());
  afterAll(() => cleanupProject());

  it('should not override environment variables already set when setting a custom env file path', async () => {
    const mylib = uniq('lib');
    updateFile(
      `.env`,
      'SHARED_VAR=shared-root-value\nROOT_ONLY=root-only-value'
    );
    runCLI(`generate @nrwl/workspace:lib ${mylib}`);
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
    const mylib = uniq('lib');

    runCLI(`generate @nrwl/workspace:lib ${mylib}`);

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
    const mylib = uniq('lib');

    runCLI(`generate @nrwl/workspace:lib ${mylib}`);

    updateProjectConfig(mylib, (config) => {
      config.targets.echo = {
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
      `run ${mylib}:echo --var1=a --var2=b --var-hyphen=c --varCamelCase=d`
    );
    expect(result).toContain('var1: a');
    expect(result).toContain('var2: b');
    expect(result).toContain('hyphen: c');
    expect(result).toContain('camel: d');

    const resultArgs = runCLI(
      `run ${mylib}:echo --args="--var1=a --var2=b --var-hyphen=c --varCamelCase=d"`
    );
    expect(resultArgs).toContain('var1: a');
    expect(resultArgs).toContain('var2: b');
    expect(resultArgs).toContain('hyphen: c');
    expect(resultArgs).toContain('camel: d');
  }, 120000);

  it('should fail when a process exits non-zero', () => {
    const mylib = uniq('lib');

    runCLI(`generate @nrwl/workspace:lib ${mylib}`);

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
      expect(e.stderr.toString()).toContain(
        'Something went wrong in run-commands - Command failed: exit 1'
      );
    }
  });

  it('run command should not break if output property is missing in options and arguments', () => {
    const mylib = uniq('mylib');

    runCLI(`generate @nrwl/workspace:lib ${mylib}`);
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
