import {
  cleanupProject,
  newProject,
  readFile,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e-utils';

describe('CLI - Environment Variables', () => {
  it('should automatically load workspace and per-project environment variables', async () => {
    newProject();

    const appName = uniq('app');
    //test if the Nx CLI loads root .env vars
    updateFile(
      `.env`,
      'NX_PUBLIC_WS_BASE=ws-base\nNX_PUBLIC_SHARED_ENV=shared-in-workspace-base'
    );
    updateFile(
      `.env.local`,
      'NX_PUBLIC_WS_ENV_LOCAL=ws-env-local\nNX_PUBLIC_SHARED_ENV=shared-in-workspace-env-local'
    );
    updateFile(
      `.local.env`,
      'NX_PUBLIC_WS_LOCAL_ENV=ws-local-env\nNX_PUBLIC_SHARED_ENV=shared-in-workspace-local-env'
    );
    updateFile(
      `apps/${appName}/.env`,
      'NX_PUBLIC_APP_BASE=app-base\nNX_PUBLIC_SHARED_ENV=shared-in-app-base'
    );
    updateFile(
      `apps/${appName}/.env.local`,
      'NX_PUBLIC_APP_ENV_LOCAL=app-env-local\nNX_PUBLIC_SHARED_ENV=shared-in-app-env-local'
    );
    updateFile(
      `apps/${appName}/.local.env`,
      'NX_PUBLIC_APP_LOCAL_ENV=app-local-env\nNX_PUBLIC_SHARED_ENV=shared-in-app-local-env'
    );
    const main = `apps/${appName}/src/main.ts`;
    const newCode = `
      const envVars = [process.env.NODE_ENV, process.env.NX_PUBLIC_WS_BASE, process.env.NX_PUBLIC_WS_ENV_LOCAL, process.env.NX_PUBLIC_WS_LOCAL_ENV, process.env.NX_PUBLIC_APP_BASE, process.env.NX_PUBLIC_APP_ENV_LOCAL, process.env.NX_PUBLIC_APP_LOCAL_ENV, process.env.NX_PUBLIC_SHARED_ENV];
      const nodeEnv = process.env.NODE_ENV;
      const nxWsBase = process.env.NX_PUBLIC_WS_BASE;
      const nxWsEnvLocal = process.env.NX_PUBLIC_WS_ENV_LOCAL;
      const nxWsLocalEnv = process.env.NX_PUBLIC_WS_LOCAL_ENV;
      const nxAppBase = process.env.NX_PUBLIC_APP_BASE;
      const nxAppEnvLocal = process.env.NX_PUBLIC_APP_ENV_LOCAL;
      const nxAppLocalEnv = process.env.NX_PUBLIC_APP_LOCAL_ENV;
      const nxSharedEnv = process.env.NX_PUBLIC_SHARED_ENV;
      `;

    runCLI(
      `generate @nx/web:app apps/${appName} --bundler=webpack --no-interactive --compiler=babel --unitTestRunner=vitest --linter=eslint`
    );

    const content = readFile(main);

    updateFile(main, `${newCode}\n${content}`);

    const appName2 = uniq('app');

    updateFile(
      `apps/${appName2}/.env`,
      'NX_PUBLIC_APP_BASE=app2-base\nNX_PUBLIC_SHARED_ENV=shared2-in-app-base'
    );
    updateFile(
      `apps/${appName2}/.env.local`,
      'NX_PUBLIC_APP_ENV_LOCAL=app2-env-local\nNX_PUBLIC_SHARED_ENV=shared2-in-app-env-local'
    );
    updateFile(
      `apps/${appName2}/.local.env`,
      'NX_PUBLIC_APP_LOCAL_ENV=app2-local-env\nNX_PUBLIC_SHARED_ENV=shared2-in-app-local-env'
    );
    const main2 = `apps/${appName2}/src/main.ts`;
    const newCode2 = `const envVars = [process.env.NODE_ENV, process.env.NX_PUBLIC_WS_BASE, process.env.NX_PUBLIC_WS_ENV_LOCAL, process.env.NX_PUBLIC_WS_LOCAL_ENV, process.env.NX_PUBLIC_APP_BASE, process.env.NX_PUBLIC_APP_ENV_LOCAL, process.env.NX_PUBLIC_APP_LOCAL_ENV, process.env.NX_PUBLIC_SHARED_ENV];`;

    runCLI(
      `generate @nx/web:app apps/${appName2} --bundler=webpack --no-interactive --compiler=babel --unitTestRunner=vitest --linter=eslint`
    );

    const content2 = readFile(main2);

    updateFile(main2, `${newCode2}\n${content2}`);

    setPluginOption(
      `apps/${appName}/webpack.config.js`,
      'outputHashing',
      'none'
    );
    setPluginOption(`apps/${appName}/webpack.config.js`, 'optimization', false);
    setPluginOption(
      `apps/${appName2}/webpack.config.js`,
      'outputHashing',
      'none'
    );
    setPluginOption(
      `apps/${appName2}/webpack.config.js`,
      'optimization',
      false
    );
    runCLI(`run-many --target build --node-env=test`);
    expect(readFile(`dist/apps/${appName}/main.js`)).toContain(
      'const envVars = ["test", "ws-base", "ws-env-local", "ws-local-env", "app-base", "app-env-local", "app-local-env", "shared-in-app-env-local"];'
    );
    expect(readFile(`dist/apps/${appName2}/main.js`)).toContain(
      'const envVars = ["test", "ws-base", "ws-env-local", "ws-local-env", "app2-base", "app2-env-local", "app2-local-env", "shared2-in-app-env-local"];'
    );

    cleanupProject();
  });
});

function setPluginOption(
  webpackConfigPath: string,
  option: string,
  value: string | boolean
): void {
  updateFile(webpackConfigPath, (content) => {
    return content.replace(
      new RegExp(`${option}: .+`),
      `${option}: ${typeof value === 'string' ? `'${value}'` : value},`
    );
  });
}
