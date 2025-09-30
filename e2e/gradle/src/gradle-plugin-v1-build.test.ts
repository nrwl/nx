import { checkFilesExist, runCLI } from '@nx/e2e-utils';
import {
  setupGradlePluginV1Test,
  cleanupGradlePluginV1Test,
} from './gradle-plugin-v1-setup';

describe('Gradle Plugin V1 - Build', () => {
  describe.each([{ type: 'kotlin' }, { type: 'groovy' }])(
    '$type',
    ({ type }: { type: 'kotlin' | 'groovy' }) => {
      let gradleProjectName: string;

      beforeAll(() => {
        const setup = setupGradlePluginV1Test(type);
        gradleProjectName = setup.gradleProjectName;
      });

      afterAll(() => cleanupGradlePluginV1Test());

      it('should build', () => {
        const projects = runCLI(`show projects`);
        expect(projects).toContain('app');
        expect(projects).toContain('list');
        expect(projects).toContain('utilities');
        expect(projects).toContain(gradleProjectName);

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
});
