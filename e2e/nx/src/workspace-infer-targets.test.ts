import {
  cleanupProject,
  newProject,
  runCLI,
  uniq,
  updateJson,
} from '@nx/e2e-utils';
import { join } from 'path';

let proj: string;

describe('@nx/workspace:infer-targets', () => {
  beforeEach(() => {
    proj = newProject({
      packages: ['@nx/playwright', '@nx/remix', '@nx/eslint', '@nx/jest'],
    });
  });

  afterEach(() => cleanupProject());

  it('should run or skip conversions depending on whether executors are present', async () => {
    // default case, everything is generated with crystal, everything should be skipped
    const remixApp = uniq('remix');
    runCLI(
      `generate @nx/remix:app apps/${remixApp} --linter eslint --unitTestRunner jest --e2eTestRunner=playwright --no-interactive`
    );

    const output = runCLI(`generate infer-targets --no-interactive --verbose`);

    expect(output).toContain('@nx/remix:convert-to-inferred - Skipped');
    expect(output).toContain('@nx/playwright:convert-to-inferred - Skipped');
    expect(output).toContain('@nx/eslint:convert-to-inferred - Skipped');
    expect(output).toContain('@nx/jest:convert-to-inferred - Skipped');

    // if we make sure there are executors to convert, conversions will run
    updateJson('nx.json', (json) => {
      json.plugins = [];
      return json;
    });

    updateJson(join('apps', remixApp, 'project.json'), (json) => {
      json.targets = {
        build: {
          executor: '@nx/remix:build',
        },
        lint: {
          executor: '@nx/eslint:lint',
        },
      };
      return json;
    });

    const output2 = runCLI(`generate infer-targets --no-interactive --verbose`);

    expect(output2).toContain('@nx/remix:convert-to-inferred - Success');
    expect(output2).toContain('@nx/eslint:convert-to-inferred - Success');
  });

  it('should run or skip only specific conversions if --plugins is passed', async () => {
    // default case, everything is generated with crystal, relevant plugins should be skipped
    const remixApp = uniq('remix');
    runCLI(
      `generate @nx/remix:app apps/${remixApp} --linter eslint --unitTestRunner jest --e2eTestRunner=playwright --no-interactive`
    );

    const output = runCLI(
      `generate infer-targets --plugins=@nx/eslint,@nx/jest --no-interactive`
    );

    expect(output).toContain('@nx/eslint:convert-to-inferred - Skipped');
    expect(output).toContain('@nx/jest:convert-to-inferred - Skipped');

    expect(output).not.toContain('@nx/remix');
    expect(output).not.toContain('@nx/playwright');

    // if we make sure there are executors to convert, relevant conversions will run
    updateJson('nx.json', (json) => {
      json.plugins = [];
      return json;
    });

    updateJson(join('apps', remixApp, 'project.json'), (json) => {
      json.targets = {
        build: {
          executor: '@nx/remix:build',
        },
        lint: {
          executor: '@nx/eslint:lint',
        },
      };
      return json;
    });

    const output2 = runCLI(
      `generate infer-targets --plugins=@nx/remix,@nx/eslint --no-interactive`
    );

    expect(output2).toContain('@nx/remix:convert-to-inferred - Success');
    expect(output2).toContain('@nx/eslint:convert-to-inferred - Success');

    expect(output2).not.toContain('@nx/jest');
    expect(output2).not.toContain('@nx/playwright');
  });

  it('should run only specific conversions for a specific project if --project is passed', async () => {
    // even if we make sure there are executors for remix & remix-e2e, only remix conversions will run with --project option
    const remixApp = uniq('remix');
    runCLI(
      `generate @nx/remix:app apps/${remixApp} --linter eslint --unitTestRunner jest --e2eTestRunner=playwright --no-interactive`
    );

    updateJson('nx.json', (json) => {
      json.plugins = [];
      return json;
    });

    updateJson(join('apps', remixApp, 'project.json'), (json) => {
      json.targets = {
        build: {
          executor: '@nx/remix:build',
        },
        lint: {
          executor: '@nx/eslint:lint',
        },
      };
      return json;
    });

    updateJson(join('apps', `${remixApp}-e2e`, 'project.json'), (json) => {
      json.targets = {
        e2e: {
          executor: '@nx/playwright:playwright',
        },
      };
      return json;
    });

    const output2 = runCLI(
      `generate infer-targets --project ${remixApp}  --no-interactive`
    );

    expect(output2).toContain('@nx/remix:convert-to-inferred - Success');
    expect(output2).toContain('@nx/eslint:convert-to-inferred - Success');

    expect(output2).toContain('@nx/jest:convert-to-inferred - Skipped');
    expect(output2).toContain('@nx/playwright:convert-to-inferred - Skipped');
  });
});
