import { checkFilesExist, runCLI } from '@nx/e2e-utils';

import { generateSSRHost, setupReactModuleFederationSuite } from './core.setup';

describe('React Rspack Module Federation - ssr config', () => {
  setupReactModuleFederationSuite();

  it('should generate host and remote apps with ssr', async () => {
    const { shell, remote1, remote2, remote3 } = await generateSSRHost(
      'rspack'
    );

    [shell, remote1, remote2, remote3].forEach((app) => {
      checkFilesExist(
        `${app}/module-federation.config.ts`,
        `${app}/module-federation.server.config.ts`
      );
      ['build', 'server'].forEach((target) => {
        ['development', 'production'].forEach((configuration) => {
          const cliOutput = runCLI(`run ${app}:${target}:${configuration}`);
          expect(cliOutput).toContain('Successfully ran target');
        });
      });
    });
  }, 500_000);
});
