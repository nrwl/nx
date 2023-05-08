import { writeFileSync } from 'fs';
import {
  fileExists,
  readJsonFile,
  writeJsonFile,
} from '../../../../utils/fileutils';

export function setupE2eProject(appName: string) {
  const json = readJsonFile(`apps/${appName}-e2e/project.json`);
  json.targets.e2e = {
    executor: 'nx:run-commands',
    options: {
      commands: [`nx e2e-serve ${appName}-e2e`, `nx e2e-run ${appName}-e2e`],
    },
  };
  json.targets['e2e-run'] = {
    executor: '@nx/cypress:cypress',
    options: {
      cypressConfig: `apps/${appName}-e2e/cypress.json`,
      tsConfig: `apps/${appName}-e2e/tsconfig.e2e.json`,
      baseUrl: 'http://localhost:3000',
    },
  };
  json.targets['e2e-serve'] = {
    executor: 'nx:run-commands',
    options: {
      commands: [`nx serve ${appName}`],
      readyWhen: 'can now view',
    },
  };
  writeJsonFile(`apps/${appName}-e2e/project.json`, json);

  if (fileExists(`apps/${appName}-e2e/src/integration/app.spec.ts`)) {
    const integrationE2eTest = `
      describe('${appName}', () => {
        beforeEach(() => cy.visit('/'));
        it('should contain a body', () => {
          cy.get('body').should('exist');
        });
      });`;
    writeFileSync(
      `apps/${appName}-e2e/src/integration/app.spec.ts`,
      integrationE2eTest
    );
  }
}
