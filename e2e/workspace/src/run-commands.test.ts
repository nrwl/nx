import {
  newProject,
  readJson,
  removeProject,
  runCLI,
  uniq,
  updateFile,
  workspaceConfigName,
} from '@nrwl/e2e/utils';

describe('Run Commands', () => {
  beforeAll(() => newProject());

  afterAll(() => removeProject({ onlyOnCI: true }));

  it('should not override environment variables already set when setting a custom env file path', async (done) => {
    const nodeapp = uniq('nodeapp');
    updateFile(
      `.env`,
      'SHARED_VAR=shared-root-value\nROOT_ONLY=root-only-value'
    );
    runCLI(`generate @nrwl/express:app ${nodeapp}`);
    updateFile(
      `apps/${nodeapp}/.custom.env`,
      'SHARED_VAR=shared-nested-value\nNESTED_ONLY=nested-only-value'
    );

    const envFile = `apps/${nodeapp}/.custom.env`;
    runCLI(
      `generate @nrwl/workspace:run-commands echoEnvVariables --command=echo --envFile=${envFile} --project=${nodeapp}`
    );

    const command =
      process.platform === 'win32'
        ? `%SHARED_VAR% %ROOT_ONLY% %NESTED_ONLY%` // Windows
        : `$SHARED_VAR $ROOT_ONLY $NESTED_ONLY`;
    const config = readJson(workspaceConfigName());
    config.projects[
      nodeapp
    ].targets.echoEnvVariables.options.command += ` ${command}`;
    updateFile(workspaceConfigName(), JSON.stringify(config, null, 2));

    const result = runCLI('echoEnvVariables');
    expect(result).toContain('shared-root-value');
    expect(result).not.toContain('shared-nested-value');
    expect(result).toContain('root-only-value');
    expect(result).toContain('nested-only-value');
    done();
  }, 120000);

  it('should pass options', async (done) => {
    const myapp = uniq('myapp1');

    runCLI(`generate @nrwl/web:app ${myapp}`);

    const config = readJson(workspaceConfigName());
    config.projects[myapp].targets.echo = {
      executor: '@nrwl/workspace:run-commands',
      options: {
        command: 'echo',
        var1: 'a',
        var2: 'b',
        'var-hyphen': 'c',
        varCamelCase: 'd',
      },
    };
    updateFile(workspaceConfigName(), JSON.stringify(config));

    const result = runCLI(`run ${myapp}:echo`, { silent: true });
    expect(result).toContain(
      '--var1=a --var2=b --var-hyphen=c --varCamelCase=d'
    );
    done();
  }, 120000);

  it('should interpolate provided arguments', async (done) => {
    const myapp = uniq('myapp1');

    runCLI(`generate @nrwl/web:app ${myapp}`);

    const config = readJson(workspaceConfigName());
    config.projects[myapp].targets.echo = {
      executor: '@nrwl/workspace:run-commands',
      options: {
        commands: [
          `echo 'var1: {args.var1}'`,
          `echo 'var2: {args.var2}'`,
          `echo 'hyphen: {args.var-hyphen}'`,
          `echo 'camel: {args.varCamelCase}'`,
        ],
      },
    };
    updateFile(workspaceConfigName(), JSON.stringify(config));

    const result = runCLI(
      `run ${myapp}:echo --var1=a --var2=b --var-hyphen=c --varCamelCase=d`
    );
    expect(result).toContain('var1: a');
    expect(result).toContain('var2: b');
    expect(result).toContain('hyphen: c');
    expect(result).toContain('camel: d');

    const resultArgs = runCLI(
      `run ${myapp}:echo --args="--var1=a --var2=b --var-hyphen=c --varCamelCase=d"`
    );
    expect(resultArgs).toContain('var1: a');
    expect(resultArgs).toContain('var2: b');
    expect(resultArgs).toContain('hyphen: c');
    expect(resultArgs).toContain('camel: d');
    done();
  }, 120000);

  it('should fail when a process exits non-zero', () => {
    const myapp = uniq('myapp1');

    runCLI(`generate @nrwl/web:app ${myapp}`);

    const config = readJson(workspaceConfigName());
    config.projects[myapp].targets.error = {
      executor: '@nrwl/workspace:run-commands',
      options: {
        command: `exit 1`,
      },
    };
    updateFile(workspaceConfigName(), JSON.stringify(config));

    try {
      runCLI(`run ${myapp}:error`);
      fail('Should error if process errors');
    } catch (e) {
      expect(e.stderr.toString()).toContain(
        'Something went wrong in @nrwl/run-commands - Command failed: exit 1'
      );
    }
  });
});
