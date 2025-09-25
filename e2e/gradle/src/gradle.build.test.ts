import { checkFilesExist, runCLI } from '@nx/e2e-utils';

import { createGradleSuiteContext, setupGradleSuite } from './gradle.setup';

describe.each([{ type: 'kotlin' }, { type: 'groovy' }])(
  'Gradle build - %s',
  ({ type }: { type: 'kotlin' | 'groovy' }) => {
    const context = createGradleSuiteContext(type);

    setupGradleSuite(context);

    it('should build', () => {
      const projects = runCLI(`show projects`);
      expect(projects).toContain('app');
      expect(projects).toContain('list');
      expect(projects).toContain('utilities');
      expect(projects).toContain(context.projectName);

      let buildOutput = runCLI('build app', { verbose: true });
      expect(buildOutput).toContain(':list:classes');
      expect(buildOutput).toContain(':utilities:classes');

      checkFilesExist(
        `app/build/libs/app.jar`,
        `list/build/libs/list.jar`,
        `utilities/build/libs/utilities.jar`
      );

      buildOutput = runCLI('build app --batch', { verbose: true });
      expect(buildOutput).toContain(':list:classes');
      expect(buildOutput).toContain(':utilities:classes');

      const bootJarOutput = runCLI('bootJar app', { verbose: true });
      expect(bootJarOutput).toContain(':app:bootJar');
    });
  }
);
