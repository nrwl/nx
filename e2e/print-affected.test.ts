import {
  forEachCli,
  newProject,
  runCLI,
  uniq,
  updateFile,
  runCommand
} from './utils';

forEachCli(cliName => {
  describe('print-affected', () => {
    it('should print information about affected projects', () => {
      newProject();
      const myapp = uniq('myapp-a');
      const myapp2 = uniq('myapp-b');
      const mylib = uniq('mylib');
      const mylib2 = uniq('mylib2');
      const mypublishablelib = uniq('mypublishablelib');

      runCLI(`generate @nrwl/react:app ${myapp}`);
      runCLI(`generate @nrwl/react:app ${myapp2}`);
      runCLI(`generate @nrwl/react:lib ${mylib}`);
      runCLI(`generate @nrwl/react:lib ${mylib2}`);
      runCLI(`generate @nrwl/react:lib ${mypublishablelib} --publishable`);

      updateFile(
        `apps/${myapp}/src/main.tsx`,
        `
          import React from 'react';
          import ReactDOM from 'react-dom';
          import "@proj/${mylib}";
          import "@proj/${mypublishablelib}";
          import App from './app/app';

          ReactDOM.render(<App />, document.getElementById('root'));

          `
      );

      updateFile(
        `apps/${myapp2}/src/main.tsx`,
        `
          import React from 'react';
          import ReactDOM from 'react-dom';
          import "@proj/${mylib}";
          import "@proj/${mypublishablelib}";
          import App from './app/app';

          ReactDOM.render(<App />, document.getElementById('root'));
          `
      );

      const resWithoutTarget = JSON.parse(
        runCommand(
          `npm run nx print-affected --silent -- --files=apps/${myapp}/src/main.tsx`
        )
      );
      expect(resWithoutTarget.tasks).toEqual([]);
      compareTwoArrays(resWithoutTarget.projects, [`${myapp}-e2e`, myapp]);

      const resWithTarget = JSON.parse(
        runCommand(
          `npm run nx print-affected --silent -- --files=apps/${myapp}/src/main.tsx --target=test`
        ).trim()
      );

      const cliCommand = cliName === 'angular' ? 'ng' : 'nx';
      expect(resWithTarget.tasks).toEqual([
        {
          id: `${myapp}:test`,
          overrides: {},
          target: {
            project: myapp,
            target: 'test'
          },
          command: `npm run ${cliCommand} -- test ${myapp}`,
          outputs: []
        }
      ]);
      compareTwoArrays(resWithTarget.projects, [`${myapp}-e2e`, myapp]);

      const resWithDeps = JSON.parse(
        runCommand(
          `npm run nx print-affected --silent -- --files=apps/${myapp}/src/main.tsx --target=build --with-deps`
        )
      );
      expect(resWithDeps.tasks).toEqual([
        {
          id: `${mypublishablelib}:build`,
          overrides: {},
          target: {
            project: mypublishablelib,
            target: 'build'
          },
          command: `npm run ${cliCommand} -- build ${mypublishablelib}`,
          outputs: [`dist/libs/${mypublishablelib}`]
        },
        {
          id: `${myapp}:build`,
          overrides: {},
          target: {
            project: myapp,
            target: 'build'
          },
          command: `npm run ${cliCommand} -- build ${myapp}`,
          outputs: [`dist/apps/${myapp}`]
        }
      ]);
      compareTwoArrays(resWithDeps.projects, [
        mylib,
        mypublishablelib,
        myapp,
        `${myapp}-e2e`
      ]);

      const resWithTargetWithSelect1 = runCommand(
        `npm run nx print-affected --silent -- --files=apps/${myapp}/src/main.tsx --target=test --select=projects`
      ).trim();
      compareTwoSerializedArrays(
        resWithTargetWithSelect1,
        `${myapp}-e2e, ${myapp}`
      );

      const resWithTargetWithSelect2 = runCommand(
        `npm run nx print-affected --silent -- --files=apps/${myapp}/src/main.tsx --target=test --select="tasks.target.project"`
      ).trim();
      compareTwoSerializedArrays(resWithTargetWithSelect2, `${myapp}`);
    }, 120000);
  });

  function compareTwoSerializedArrays(a: string, b: string) {
    compareTwoArrays(
      a.split(',').map(_ => _.trim()),
      b.split(',').map(_ => _.trim())
    );
  }

  function compareTwoArrays(a: string[], b: string[]) {
    expect(a.sort((x, y) => x.localeCompare(y))).toEqual(
      b.sort((x, y) => x.localeCompare(y))
    );
  }
});
