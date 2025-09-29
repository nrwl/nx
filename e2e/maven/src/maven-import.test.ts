import {
  checkFilesExist,
  cleanupProject,
  getSelectedPackageManager,
  newProject,
  runCLI,
  updateJson,
  updateFile,
  e2eCwd,
  readJson,
  runCommand,
  createFile,
} from '@nx/e2e-utils';
import { mkdirSync, rmdirSync, writeFileSync } from 'fs';
import { execSync } from 'node:child_process';
import { join } from 'path';
import { createMavenProject } from './utils/create-maven-project';
import { createFileSync } from 'fs-extra';

describe('Nx Import Maven', () => {
  const tempImportE2ERoot = join(e2eCwd, 'nx-import');
  beforeAll(() => {
    newProject({
      packages: ['@nx/js'],
    });

    if (getSelectedPackageManager() === 'pnpm') {
      updateFile(
        'pnpm-workspace.yaml',
        `packages:
    - 'projects/*'
  `
      );
    } else {
      updateJson('package.json', (json) => {
        json.workspaces = ['projects/*'];
        return json;
      });
    }

    createFile('.gitignore', 'target/');

    try {
      rmdirSync(tempImportE2ERoot, { recursive: true });
    } catch {}
    mkdirSync(tempImportE2ERoot, { recursive: true });

    runCommand(`git add .`);
    runCommand(`git commit -am "update"`);
  });

  afterAll(() => cleanupProject());

  it('should be able to import a Maven project', () => {
    const tempMavenProjectName = 'created-maven-app';
    const tempMavenProjectPath = join(
      tempImportE2ERoot,
      tempMavenProjectName
    );
    try {
      rmdirSync(tempMavenProjectPath, { recursive: true });
    } catch {}
    mkdirSync(tempMavenProjectPath, { recursive: true });
    createMavenProject(
      tempMavenProjectName,
      tempMavenProjectPath,
      'maven-'
    );
    setupMavenProjectGit(tempMavenProjectPath, tempMavenProjectName);

    const remote = tempMavenProjectPath;
    const ref = 'main';
    const source = '.';
    const directory = 'projects/maven-app';

    try {
      runCLI(
        `import ${remote} ${directory} --ref ${ref} --source ${source} --no-interactive`,
        {
          verbose: true,
        }
      );

      checkFilesExist(
        `${directory}/pom.xml`,
        `${directory}/app/pom.xml`,
        `${directory}/lib/pom.xml`,
        `${directory}/utils/pom.xml`
      );
      const nxJson = readJson('nx.json');
      const mavenPlugin = nxJson.plugins.find(
        (plugin) => plugin.plugin === '@nx/maven'
      );
      expect(mavenPlugin).toBeDefined();
      expect(() => {
        runCLI('reset', { env: { CI: 'false' } });
        runCLI(`show projects`);
        runCLI('run maven-app:install');
      }).not.toThrow();
    } finally {
      // Cleanup
      runCommand(`git add .`);
      runCommand(`git commit -am 'import maven project'`);
    }
  });
});

function setupMavenProjectGit(
  tempMavenProjectPath: string,
  tempMavenProjectName: string
) {
  // Add project.json files to the maven project to avoid duplicate project names
  createFileSync(join(tempMavenProjectPath, 'project.json'));
  writeFileSync(
    join(tempMavenProjectPath, 'project.json'),
    `{"name": "${tempMavenProjectName}"}`
  );

  execSync(`git init`, {
    cwd: tempMavenProjectPath,
  });
  execSync(`git add .`, {
    cwd: tempMavenProjectPath,
  });
  execSync(`git commit -am "initial commit"`, {
    cwd: tempMavenProjectPath,
  });

  try {
    execSync(`git checkout -b main`, {
      cwd: tempMavenProjectPath,
    });
  } catch {
    // This fails if git is already configured to have `main` branch, but that's OK
  }
}