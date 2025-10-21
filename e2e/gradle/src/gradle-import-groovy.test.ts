import {
  checkFilesExist,
  runCLI,
  readJson,
  runCommand,
  updateJson,
} from '@nx/e2e-utils';
import { mkdirSync, rmdirSync } from 'fs';
import { execSync } from 'node:child_process';
import { join } from 'path';
import { createGradleProject } from './utils/create-gradle-project';
import { createFileSync } from 'fs-extra';
import { writeFileSync } from 'fs';
import {
  setupGradleImportProject,
  teardownGradleImportProject,
  tempImportE2ERoot,
} from './utils/gradle-import-setup';

describe('Nx Import Gradle', () => {
  beforeAll(() => {
    setupGradleImportProject();
  });

  afterAll(() => teardownGradleImportProject());

  it('should be able to import a groovy gradle app', () => {
    const tempGradleProjectName = 'created-gradle-app-groovy';
    const tempGraldeProjectPath = join(
      tempImportE2ERoot,
      tempGradleProjectName
    );
    try {
      rmdirSync(tempGraldeProjectPath);
    } catch {}
    mkdirSync(tempGraldeProjectPath, { recursive: true });
    createGradleProject(
      tempGradleProjectName,
      'groovy',
      tempGraldeProjectPath,
      'gradleProjectGroovy',
      'groovy-'
    );
    setupGradleProjectGit(tempGraldeProjectPath, tempGradleProjectName);

    const remote = tempGraldeProjectPath;
    const ref = 'main';
    const source = '.';
    const directory = 'projects/gradle-app-groovy';

    try {
      runCLI(
        `import ${remote} ${directory} --ref ${ref} --source ${source} --no-interactive`,
        {
          verbose: true,
        }
      );
      runCLI(`g @nx/gradle:init --no-interactive`);

      checkFilesExist(
        `${directory}/build.gradle`,
        `${directory}/settings.gradle`,
        `${directory}/gradlew`,
        `${directory}/gradlew.bat`
      );
      const nxJson = readJson('nx.json');
      const gradlePlugin = nxJson.plugins.find(
        (plugin) => plugin.plugin === '@nx/gradle'
      );
      gradlePlugin.exclude = [];
      updateJson('nx.json', () => nxJson);
      expect(() => {
        runCLI('reset', { env: { CI: 'false' } });
        runCLI(`show projects`);
        runCLI('build groovy-app');
      }).not.toThrow();
    } finally {
      // Cleanup
      runCommand(`git add .`);
      runCommand(`git commit -am 'import groovy project'`);
    }
  });
});

function setupGradleProjectGit(
  tempGraldeProjectPath: string,
  tempGradleProjectName: string
) {
  // Add project.json files to the gradle project to avoid duplicate project names
  createFileSync(join(tempGraldeProjectPath, 'project.json'));
  writeFileSync(
    join(tempGraldeProjectPath, 'project.json'),
    `{"name": "${tempGradleProjectName}"}`
  );

  execSync(`git init`, {
    cwd: tempGraldeProjectPath,
  });
  execSync(`git add .`, {
    cwd: tempGraldeProjectPath,
  });
  execSync(`git commit -am "initial commit"`, {
    cwd: tempGraldeProjectPath,
  });

  try {
    execSync(`git checkout -b main`, {
      cwd: tempGraldeProjectPath,
    });
  } catch {
    // This fails if git is already configured to have `main` branch, but that's OK
  }
}
