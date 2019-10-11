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

      updateFile(`nx.json`, c => {
        const content = JSON.parse(c);
        content['tasksRunnerOptions'] = {
          json: {
            runner: '@nrwl/workspace/src/tasks-runner/json-output-tasks-runner'
          }
        };
        return JSON.stringify(content);
      });
      const testOutput = JSON.parse(
        runCommand(
          `npm run nx print-affected --silent -- --files=apps/${myapp}/src/main.tsx --target=test`
        ).trim()
      );

      const cliCommand = cliName === 'angular' ? 'ng' : 'nx';
      expect(testOutput.tasks).toEqual([
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
      expect(Object.keys(testOutput.dependencyGraph.projects).length).toEqual(
        7
      );

      expect(
        JSON.parse(
          runCommand(
            `npm run nx print-affected --silent -- --files=apps/${myapp}/src/main.tsx --target=build --with-deps`
          )
        ).tasks
      ).toEqual([
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
    }, 120000);
  });
});
