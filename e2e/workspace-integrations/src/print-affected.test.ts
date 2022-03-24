import {
  cleanupProject,
  getPackageManagerCommand,
  newProject,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';

describe('print-affected', () => {
  let proj: string;

  beforeEach(() => (proj = newProject()));
  afterEach(() => cleanupProject());

  it('should print information about affected projects', async () => {
    const myapp = uniq('myapp-a');
    const myapp2 = uniq('myapp-b');
    const mylib = uniq('mylib');
    const mylib2 = uniq('mylib2');
    const mypublishablelib = uniq('mypublishablelib');

    runCLI(`generate @nrwl/react:app ${myapp}`);
    runCLI(`generate @nrwl/react:app ${myapp2}`);
    runCLI(`generate @nrwl/react:lib ${mylib}`);
    runCLI(`generate @nrwl/react:lib ${mylib2}`);
    runCLI(`generate @nrwl/react:lib ${mypublishablelib} --buildable`);

    updateFile(
      `apps/${myapp}/src/main.tsx`,
      `
          import React from 'react';
          import ReactDOM from 'react-dom';
          import "@${proj}/${mylib}";
          import "@${proj}/${mypublishablelib}";
          import App from './app/app';

          ReactDOM.render(<App />, document.getElementById('root'));

          `
    );

    updateFile(
      `apps/${myapp2}/src/main.tsx`,
      `
          import React from 'react';
          import ReactDOM from 'react-dom';
          import "@${proj}/${mylib}";
          import "@${proj}/${mypublishablelib}";
          import App from './app/app';

          ReactDOM.render(<App />, document.getElementById('root'));
          `
    );

    const resWithoutTarget = JSON.parse(
      (
        await runCLIAsync(`print-affected --files=apps/${myapp}/src/main.tsx`, {
          silent: true,
        })
      ).stdout
    );
    expect(resWithoutTarget.tasks).toEqual([]);
    compareTwoArrays(resWithoutTarget.projects, [`${myapp}-e2e`, myapp]);

    const resWithTarget = JSON.parse(
      (
        await runCLIAsync(
          `print-affected --files=apps/${myapp}/src/main.tsx --target=test`,
          { silent: true }
        )
      ).stdout.trim()
    );

    const { runNx } = getPackageManagerCommand();
    expect(resWithTarget.tasks[0]).toMatchObject({
      id: `${myapp}:test`,
      overrides: {},
      target: {
        project: myapp,
        target: 'test',
      },
      command: `${runNx} run ${myapp}:test`,
      outputs: [`coverage/apps/${myapp}`],
    });
    compareTwoArrays(resWithTarget.projects, [`${myapp}-e2e`, myapp]);

    const resWithDeps = JSON.parse(
      (
        await runCLIAsync(
          `print-affected --files=apps/${myapp}/src/main.tsx --target=build --with-deps`,
          { silent: true }
        )
      ).stdout
    );

    expect(resWithDeps.tasks[0]).toMatchObject({
      id: `${myapp}:build:production`,
      overrides: {},
      target: {
        project: myapp,
        target: 'build',
      },
      command: `${runNx} run ${myapp}:build:production`,
      outputs: [`dist/apps/${myapp}`],
    });

    expect(resWithDeps.tasks[1]).toMatchObject({
      id: `${mypublishablelib}:build`,
      overrides: {},
      target: {
        project: mypublishablelib,
        target: 'build',
      },
      command: `${runNx} run ${mypublishablelib}:build`,
      outputs: [`dist/libs/${mypublishablelib}`],
    });

    compareTwoArrays(resWithDeps.projects, [
      mylib,
      mypublishablelib,
      myapp,
      `${myapp}-e2e`,
    ]);

    const resWithTargetWithSelect1 = (
      await runCLIAsync(
        `print-affected --files=apps/${myapp}/src/main.tsx --target=test --select=projects`,
        { silent: true }
      )
    ).stdout.trim();
    compareTwoSerializedArrays(
      resWithTargetWithSelect1,
      `${myapp}-e2e, ${myapp}`
    );

    const resWithTargetWithSelect2 = (
      await runCLIAsync(
        `print-affected --files=apps/${myapp}/src/main.tsx --target=test --select="tasks.target.project"`,
        { silent: true }
      )
    ).stdout.trim();
    compareTwoSerializedArrays(resWithTargetWithSelect2, `${myapp}`);
  }, 120000);

  function compareTwoSerializedArrays(a: string, b: string) {
    compareTwoArrays(
      a.split(',').map((_) => _.trim()),
      b.split(',').map((_) => _.trim())
    );
  }

  function compareTwoArrays(a: string[], b: string[]) {
    expect(a.sort((x, y) => x.localeCompare(y))).toEqual(
      b.sort((x, y) => x.localeCompare(y))
    );
  }
});
