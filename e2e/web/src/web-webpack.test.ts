import {
  cleanupProject,
  newProject,
  runCLI,
  runCommandUntil,
  setMaxWorkers,
  uniq,
} from '@nx/e2e/utils';
import { join } from 'path';

describe('Web Components Applications with bundler set as webpack', () => {
  beforeEach(() => newProject());
  afterEach(() => cleanupProject());

  it('should support https for dev-server', async () => {
    const appName = uniq('app');
    runCLI(
      `generate @nx/web:app ${appName} --bundler=webpack --no-interactive`
    );
    setMaxWorkers(join('apps', appName, 'project.json'));

    await runCommandUntil(`serve ${appName} --port=5000 --ssl`, (output) => {
      return output.includes('listening at https://localhost:5000');
    });
  }, 300_000);
});
