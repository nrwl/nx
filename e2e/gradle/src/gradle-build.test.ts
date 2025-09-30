import { checkFilesExist, runCLI } from '@nx/e2e-utils';
import { setupGradleTest, cleanupGradleTest } from './gradle-setup';

describe('Gradle - Build', () => {
  describe.each([{ type: 'kotlin' }, { type: 'groovy' }])(
    '$type',
    ({ type }: { type: 'kotlin' | 'groovy' }) => {
      let gradleProjectName: string;

      beforeAll(() => {
        const setup = setupGradleTest(type);
        gradleProjectName = setup.gradleProjectName;
      });

      afterAll(() => cleanupGradleTest());

      it('should build', () => {
        const projects = runCLI(`show projects`);
        expect(projects).toContain('app');
        expect(projects).toContain('list');
        expect(projects).toContain('utilities');
        expect(projects).toContain(gradleProjectName);

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
});
