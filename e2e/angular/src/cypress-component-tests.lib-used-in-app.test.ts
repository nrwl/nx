import { runCLI, runE2ETests, uniq } from '@nx/e2e-utils';
import { registerAngularCypressCTSetup } from './cypress-component-tests.setup';

describe('Angular Cypress Component Tests - lib used in app', () => {
  registerAngularCypressCTSetup();

  it('should successfully component test lib being used in app', () => {
    const usedInAppLibName = uniq('cy-angular-lib');
    runCLI(`generate @nx/angular:lib ${usedInAppLibName} --no-interactive`);
    runCLI(
      `generate @nx/angular:component ${usedInAppLibName}/src/lib/btn/btn --inlineTemplate --inlineStyle --export --no-interactive`
    );

    runCLI(
      `generate @nx/angular:cypress-component-configuration --project=${usedInAppLibName} --generate-tests --no-interactive`
    );
    if (runE2ETests('cypress')) {
      expect(runCLI(`component-test ${usedInAppLibName}`)).toContain(
        'All specs passed!'
      );
    }
  }, 300_000);
});
