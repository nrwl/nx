import { execSync } from 'child_process';
import {
  checkFilesExist,
  newProject,
  runCLI,
  tmpProjPath,
  uniq,
} from '@nrwl/e2e/utils';

describe('Node Applications', () => {
  beforeEach(() => newProject());

  it('should be able to generate an empty application', async () => {
    const appName = uniq('nodeapp');

    runCLI(`generate @nrwl/node:app ${appName} --linter=eslint`);
    runCLI(`generate @nrwl/node:webpack5`);
    runCLI(`build ${appName}`);

    checkFilesExist(`dist/apps/${appName}/main.js`);
    const result = execSync(`node dist/apps/${appName}/main.js`, {
      cwd: tmpProjPath(),
    }).toString();
    expect(result).toContain('Hello World!');
  }, 300000);
});
