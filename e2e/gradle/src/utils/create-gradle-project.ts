import {
  e2eConsoleLogger,
  isWindows,
  runCommand,
  tmpProjPath,
} from '@nx/e2e/utils';
import { execSync } from 'child_process';
import { createFileSync, writeFileSync } from 'fs-extra';
import { join, resolve } from 'path';

export function createGradleProject(
  projectName: string,
  type: 'kotlin' | 'groovy' = 'kotlin',
  cwd: string = tmpProjPath(),
  packageName: string = 'gradleProject',
  addProjectJsonNamePrefix: string = ''
) {
  e2eConsoleLogger(`Using java version: ${execSync('java -version')}`);
  const gradleCommand = isWindows()
    ? resolve(`${__dirname}/../../gradlew.bat`)
    : resolve(`${__dirname}/../../gradlew`);
  e2eConsoleLogger(
    'Using gradle version: ' +
      execSync(`${gradleCommand} --version`, {
        cwd,
      })
  );
  e2eConsoleLogger(
    execSync(`${gradleCommand} help --task :init`, {
      cwd,
    }).toString()
  );
  e2eConsoleLogger(
    runCommand(
      `${gradleCommand} init --type ${type}-application --dsl ${type} --project-name ${projectName} --package ${packageName} --no-incubating --split-project`,
      {
        cwd,
      }
    )
  );

  if (addProjectJsonNamePrefix) {
    createFileSync(join(cwd, 'app/project.json'));
    writeFileSync(
      join(cwd, 'app/project.json'),
      `{"name": "${addProjectJsonNamePrefix}app"}`
    );
    createFileSync(join(cwd, 'list/project.json'));
    writeFileSync(
      join(cwd, 'list/project.json'),
      `{"name": "${addProjectJsonNamePrefix}list"}`
    );
    createFileSync(join(cwd, 'utilities/project.json'));
    writeFileSync(
      join(cwd, 'utilities/project.json'),
      `{"name": "${addProjectJsonNamePrefix}utilities"}`
    );
  }
}
