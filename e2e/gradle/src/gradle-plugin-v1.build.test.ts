import { checkFilesExist, runCLI } from '@nx/e2e-utils';

import {
  addProjectReportToSettings,
  createGradleSuiteContext,
  setupGradleSuite,
} from './gradle.setup';

describe.each([{ type: 'kotlin' }, { type: 'groovy' }])(
  'Gradle Plugin V1 build - %s',
  ({ type }: { type: 'kotlin' | 'groovy' }) => {
    const context = createGradleSuiteContext(type, { usePluginV1: true });

    setupGradleSuite(context);
    addProjectReportToSettings(
      `settings.gradle${type === 'kotlin' ? '.kts' : ''}`
    );

    it('should build', () => {
      const projects = runCLI(`show projects`);
      expect(projects).toContain('app');
      expect(projects).toContain('list');
      expect(projects).toContain('utilities');
      expect(projects).toContain(context.projectName);

      const buildOutput = runCLI('build app', { verbose: true });
      expect(buildOutput).toContain('nx run list:build');
      expect(buildOutput).toContain(':list:classes');
      expect(buildOutput).toContain('nx run utilities:build');
      expect(buildOutput).toContain(':utilities:classes');

      checkFilesExist(
        `app/build/libs/app.jar`,
        `list/build/libs/list.jar`,
        `utilities/build/libs/utilities.jar`
      );
    });
  }
);
