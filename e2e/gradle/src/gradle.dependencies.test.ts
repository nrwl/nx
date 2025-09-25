import { checkFilesExist, runCLI } from '@nx/e2e-utils';

import {
  addDependentApp,
  createGradleSuiteContext,
  setupGradleSuite,
} from './gradle.setup';

describe.each([{ type: 'kotlin' }, { type: 'groovy' }])(
  'Gradle dependencies - %s',
  ({ type }: { type: 'kotlin' | 'groovy' }) => {
    const context = createGradleSuiteContext(type);

    setupGradleSuite(context);

    it('should track dependencies for new app', () => {
      addDependentApp(context);

      let buildOutput = runCLI('build app2', { verbose: true });
      expect(buildOutput).toContain(':app:classes');
      expect(buildOutput).toContain(':list:classes');
      expect(buildOutput).toContain(':utilities:classes');

      checkFilesExist(`app2/build/libs/app2.jar`);

      buildOutput = runCLI('build app2 --batch', { verbose: true });
      expect(buildOutput).toContain(':app:classes');
      expect(buildOutput).toContain(':list:classes');
      expect(buildOutput).toContain(':utilities:classes');
    });
  }
);

