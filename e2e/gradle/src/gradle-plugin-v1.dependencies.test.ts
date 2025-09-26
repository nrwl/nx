import { checkFilesExist, runCLI } from '@nx/e2e-utils';

import {
  addDependentApp,
  addProjectReportToSettings,
  createGradleSuiteContext,
  setupGradleSuite,
} from './gradle.setup';

describe.each([{ type: 'kotlin' }, { type: 'groovy' }])(
  'Gradle Plugin V1 dependencies - %s',
  ({ type }: { type: 'kotlin' | 'groovy' }) => {
    const context = createGradleSuiteContext(type, { usePluginV1: true });

    setupGradleSuite(context);
    addProjectReportToSettings(
      `settings.gradle${type === 'kotlin' ? '.kts' : ''}`
    );

    it('should track dependencies for new app', () => {
      addDependentApp(context);

      let buildOutput = runCLI('build app2', { verbose: true });
      expect(buildOutput).toContain('nx run app:build');
      expect(buildOutput).toContain(':app:classes');
      expect(buildOutput).toContain('nx run list:build');
      expect(buildOutput).toContain(':list:classes');
      expect(buildOutput).toContain('nx run utilities:build');
      expect(buildOutput).toContain(':utilities:classes');

      checkFilesExist(
        `app2/build/libs/app2.jar`,
        `app/build/libs/app.jar`,
        `list/build/libs/list.jar`,
        `utilities/build/libs/utilities.jar`
      );
    });
  }
);
