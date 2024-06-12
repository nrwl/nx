import { getPackageManagerCommand } from '@nx/devkit';
import {
  checkFilesExist,
  ensureNxProject,
  listFiles,
  runNxCommandAsync,
  tmpProjPath,
  uniq,
  updateFile,
} from '@nx/plugin/testing';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';

describe('rspack e2e', () => {
  // Setting up individual workspaces per
  // test can cause e2e runs to take a long time.
  // For this reason, we recommend each suite only
  // consumes 1 workspace. The tests should each operate
  // on a unique project in the workspace, such that they
  // are not dependant on one another.
  beforeAll(() => {
    ensureNxProject('@nx/rspack', 'dist/packages/rspack');
  });

  afterAll(() => {
    // `nx reset` kills the daemon, and performs
    // some work which can help clean up e2e leftovers
    runNxCommandAsync('reset');
  });

  it('should create rspack root project and additional apps', async () => {
    const project = uniq('myapp');
    await runNxCommandAsync(
      `generate @nx/rspack:preset ${project} --framework=react --unitTestRunner=jest --e2eTestRunner=cypress`
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
    execSync(
      pm.addDev +
        ' @babel/preset-react @babel/preset-env @babel/preset-typescript',
      { cwd: tmpProjPath() }
    );

    let result = await runNxCommandAsync(`build ${project}`, {
      env: { NODE_ENV: 'production' },
    });
    expect(result.stdout).toContain('Successfully ran target build');
    // Make sure expected files are present.
    expect(listFiles(`dist/${project}`)).toHaveLength(5);

    result = await runNxCommandAsync(`test ${project}`);
    expect(result.stdout).toContain('Successfully ran target test');

    // TODO(Colum): re-enable when cypress issue is resolved
    // result = await runNxCommandAsync(`e2e e2e`);
    // expect(result.stdout).toContain('Successfully ran target e2e');

    // Update app and make sure previous dist files are not present.
    updateFile(`src/app/app.tsx`, (content) => {
      return `${content}\nconsole.log('hello');
    `;
    });
    result = await runNxCommandAsync(`build ${project}`, {
      env: { NODE_ENV: 'production' },
    });
    expect(result.stdout).toContain('Successfully ran target build');
    expect(listFiles(`dist/${project}`)).toHaveLength(5); // same length as before

    // Generate a new app and check that the files are correct
    const app2 = uniq('app2');
    await runNxCommandAsync(
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

    result = await runNxCommandAsync(`build ${app2}`, {
      env: { NODE_ENV: 'production' },
    });
    expect(result.stdout).toContain('Successfully ran target build');
    // Make sure expected files are present.
    expect(listFiles(`dist/${app2}`)).toHaveLength(5);

    result = await runNxCommandAsync(`test ${app2}`);
    expect(result.stdout).toContain('Successfully ran target test');

    // TODO(Colum): re-enable when cypress issue is resolved
    // result = await runNxCommandAsync(`e2e ${app2}-e2e`);
    // expect(result.stdout).toContain('Successfully ran target e2e');

    // Generate a Nest app and verify build output
    const app3 = uniq('app3');
    await runNxCommandAsync(
      `generate @nx/rspack:app ${app3} --framework=nest --unitTestRunner=jest --no-interactive`
    );
    checkFilesExist(`${app3}/project.json`);

    result = await runNxCommandAsync(`build ${app3}`);
    expect(result.stdout).toContain('Successfully ran target build');
    // Make sure expected files are present.
    expect(listFiles(`dist/${app3}`)).toHaveLength(3);

    result = await runNxCommandAsync(
      `build ${app3} --generatePackageJson=true`
    );
    expect(result.stdout).toContain('Successfully ran target build');
    // Make sure expected files are present.
    expect(listFiles(`dist/${app3}`)).toHaveLength(5);
  }, 200_000);
});
