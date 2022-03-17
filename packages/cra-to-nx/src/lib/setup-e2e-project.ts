import { fileExists } from '@nrwl/workspace/src/utilities/fileutils';
import * as fs from 'fs';

export function setupE2eProject(appName: string) {
  const data = fs.readFileSync(`apps/${appName}-e2e/project.json`);
  const json = JSON.parse(data.toString());
  json.targets.e2e = {
    executor: '@nrwl/workspace:run-commands',
    options: {
      commands: [`nx e2e-serve ${appName}-e2e`, `nx e2e-run ${appName}-e2e`],
    },
  };
  json.targets['e2e-run'] = {
    executor: '@nrwl/cypress:cypress',
    options: {
      cypressConfig: `apps/${appName}-e2e/cypress.json`,
      tsConfig: `apps/${appName}-e2e/tsconfig.e2e.json`,
      baseUrl: 'http://localhost:3000',
    },
  };
  json.targets['e2e-serve'] = {
    executor: '@nrwl/workspace:run-commands',
    options: {
      commands: [`nx serve ${appName}`],
      readyWhen: 'can now view',
    },
  };
  fs.writeFileSync(
    `apps/${appName}-e2e/project.json`,
    JSON.stringify(json, null, 2)
  );

  if (fileExists(`apps/${appName}-e2e/src/integration/app.spec.ts`)) {
    const integrationE2eTest = `
      describe('${appName}', () => {
        beforeEach(() => cy.visit('/'));
        it('should contain a body', () => {
          cy.get('body').should('exist');
        });
      });`;
    fs.writeFileSync(
      `apps/${appName}-e2e/src/integration/app.spec.ts`,
      integrationE2eTest
    );
  }
}
