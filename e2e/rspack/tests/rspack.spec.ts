import { getPackageManagerCommand } from '@nx/devkit';
import {
  checkFilesExist,
  cleanupProject,
  listFiles,
  newProject,
  tmpProjPath,
  uniq,
  updateFile,
  runCLI,
  runCommand,
} from '@nx/e2e/utils';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';

describe('rspack e2e', () => {
  let proj: string;

  // Setting up individual workspaces per
  // test can cause e2e runs to take a long time.
  // For this reason, we recommend each suite only
  // consumes 1 workspace. The tests should each operate
  // on a unique project in the workspace, such that they
  // are not dependant on one another.
  beforeAll(() => {
    proj = newProject({ packages: ['@nx/rspack'] });
  });

  afterAll(() => cleanupProject());

  it('should create rspack root project and additional apps', async () => {
    const project = uniq('myapp');
    runCLI(
      `generate @nx/rspack:preset ${project} --framework=react --unitTestRunner=jest --e2eTestRunner=cypress --verbose`
    );

    // Added this so that the nx-ecosystem-ci tests don't throw jest error
    writeFileSync(
      join(tmpProjPath(), '.babelrc'),
      `
        {
          "presets": [
            "@babel/preset-env", "@babel/preset-react", "@babel/preset-typescript",
            [
              "@nx/react/babel",
              {
                "runtime": "automatic"
              }
            ]
          ],
          "plugins": ["@babel/plugin-transform-runtime"]
        }
      `
    );

    const pm = getPackageManagerCommand();
    runCommand(
      pm.addDev +
        ' @babel/preset-react @babel/preset-env @babel/preset-typescript'
    );

    let result = runCLI(`build ${project}`, {
      env: { NODE_ENV: 'production' },
    });
    expect(result).toContain('Successfully ran target build');
    // Make sure expected files are present.
    expect(listFiles(`dist/${project}`)).toHaveLength(5);

    result = runCLI(`test ${project}`);
    expect(result).toContain('Successfully ran target test');

    // TODO(Colum): re-enable when cypress issue is resolved
    // result = runCLI(`e2e e2e`);
    // expect(result.stdout).toContain('Successfully ran target e2e');

    // Update app and make sure previous dist files are not present.
    updateFile(`src/app/app.tsx`, (content) => {
      return `${content}\nconsole.log('hello');
    `;
    });
    result = runCLI(`build ${project}`, {
      env: { NODE_ENV: 'production' },
    });
    expect(result).toContain('Successfully ran target build');
    expect(listFiles(`dist/${project}`)).toHaveLength(5); // same length as before

    // Generate a new app and check that the files are correct
    const app2 = uniq('app2');
    runCLI(
      `generate @nx/rspack:app ${app2} --framework=react --unitTestRunner=jest --e2eTestRunner=cypress --style=css`
    );
    checkFilesExist(`${app2}/project.json`, `${app2}-e2e/project.json`);

    // Added this so that the nx-ecosystem-ci tests don't throw jest error
    writeFileSync(
      join(tmpProjPath(), app2, '.babelrc'),
      `
        {
          "presets": [
            "@babel/preset-env", "@babel/preset-react", "@babel/preset-typescript",
            [
              "@nx/react/babel",
              {
                "runtime": "automatic"
              }
            ]
          ],
          "plugins": ["@babel/plugin-transform-runtime"]
        }
      `
    );

    result = runCLI(`build ${app2}`, {
      env: { NODE_ENV: 'production' },
    });
    expect(result).toContain('Successfully ran target build');
    // Make sure expected files are present.
    expect(listFiles(`dist/${app2}`)).toHaveLength(5);

    result = runCLI(`test ${app2}`);
    expect(result).toContain('Successfully ran target test');

    // TODO(Colum): re-enable when cypress issue is resolved
    // result = runCLI(`e2e ${app2}-e2e`);
    // expect(result.stdout).toContain('Successfully ran target e2e');

    // Generate a Nest app and verify build output
    const app3 = uniq('app3');
    runCLI(
      `generate @nx/rspack:app ${app3} --framework=nest --unitTestRunner=jest --no-interactive`
    );
    checkFilesExist(`${app3}/project.json`);

    result = runCLI(`build ${app3}`);
    expect(result).toContain('Successfully ran target build');
    // Make sure expected files are present.
    expect(listFiles(`dist/${app3}`)).toHaveLength(2);

    result = runCLI(`build ${app3} --generatePackageJson=true`);
    expect(result).toContain('Successfully ran target build');
    // Make sure expected files are present.
    expect(listFiles(`dist/${app3}`)).toHaveLength(4);
  }, 200_000);
});
