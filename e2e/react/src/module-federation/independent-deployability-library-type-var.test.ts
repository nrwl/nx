import {
  getAvailablePort,
  killProcessAndPorts,
  runCommandUntil,
  runE2ETests,
  uniq,
  updateFile,
} from "@nx/e2e-utils";
import { stripIndents } from "nx/src/utils/strip-indents";
import { readPort, runCLI } from "./utils";
import {
  setupIndependentDeployabilityTest,
  cleanupIndependentDeployabilityTest,
} from "./independent-deployability-setup";

describe("Independent Deployability", () => {
  let proj: string;
  beforeAll(() => {
    proj = setupIndependentDeployabilityTest();
  });

  afterAll(() => {
    cleanupIndependentDeployabilityTest();
  });

  it("should support host and remote with library type var", async () => {
    const shell = uniq("shell");
    const remote = uniq("remote");
    const shellPort = await getAvailablePort();

    runCLI(
      `generate @nx/react:host ${shell} --devServerPort=${shellPort} --remotes=${remote} --bundler=webpack --e2eTestRunner=cypress --no-interactive --skipFormat`
    );

    const remotePort = readPort(remote);

    // update host and remote to use library type var
    updateFile(
      `${shell}/module-federation.config.ts`,
      stripIndents`
      import { ModuleFederationConfig } from '@nx/webpack';

      const config: ModuleFederationConfig = {
        name: '${shell}',
        library: { type: 'var', name: '${shell}' },
        remotes: ['${remote}'],
      };

      export default config;
      `
    );

    updateFile(
      `${shell}/webpack.config.prod.ts`,
      `export { default } from './webpack.config';`
    );

    updateFile(
      `${remote}/module-federation.config.ts`,
      stripIndents`
      import { ModuleFederationConfig } from '@nx/webpack';

      const config: ModuleFederationConfig = {
        name: '${remote}',
        library: { type: 'var', name: '${remote}' },
        exposes: {
          './Module': './src/remote-entry.ts',
        },
      };

      export default config;
      `
    );

    updateFile(
      `${remote}/webpack.config.prod.ts`,
      `export { default } from './webpack.config';`
    );

    // Update host e2e test to check that the remote works with library type var via navigation
    updateFile(
      `${shell}-e2e/src/e2e/app.cy.ts`,
      `
    import { getGreeting } from '../support/app.po';
    
    describe('${shell}', () => {
      beforeEach(() => cy.visit('/'));
    
      it('should display welcome message', () => {
        getGreeting().contains('Welcome ${shell}');
        
      });
    
      it('should navigate to /about from /', () => {
        cy.get('a').contains('${remote[0].toUpperCase()}${remote.slice(
        1
      )}').click();
        cy.url().should('include', '/${remote}');
        getGreeting().contains('Welcome ${remote}');
      });
    });
    `
    );

    // Build host and remote
    const buildOutput = runCLI(`build ${shell}`);
    const remoteOutput = runCLI(`build ${remote}`);

    expect(buildOutput).toContain("Successfully ran target build");
    expect(remoteOutput).toContain("Successfully ran target build");

    if (runE2ETests()) {
      const hostE2eResultsSwc = await runCommandUntil(
        `e2e ${shell}-e2e --no-watch --verbose`,
        (output) => output.includes("All specs passed!")
      );
      await killProcessAndPorts(
        hostE2eResultsSwc.pid,
        shellPort,
        shellPort + 1,
        remotePort
      );

      const remoteE2eResultsSwc = await runCommandUntil(
        `e2e ${remote}-e2e --no-watch --verbose`,
        (output) => output.includes("All specs passed!")
      );

      await killProcessAndPorts(remoteE2eResultsSwc.pid, remotePort);

      const hostE2eResultsTsNode = await runCommandUntil(
        `e2e ${shell}-e2e --no-watch --verbose`,
        (output) => output.includes("All specs passed!"),
        { env: { NX_PREFER_TS_NODE: "true" } }
      );

      await killProcessAndPorts(
        hostE2eResultsTsNode.pid,
        shellPort,
        shellPort + 1,
        remotePort
      );

      const remoteE2eResultsTsNode = await runCommandUntil(
        `e2e ${remote}-e2e --no-watch --verbose`,
        (output) => output.includes("All specs passed!"),
        { env: { NX_PREFER_TS_NODE: "true" } }
      );

      await killProcessAndPorts(remoteE2eResultsTsNode.pid, remotePort);
    }
  }, 500_000);
});
