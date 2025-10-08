import {
  isNotWindows,
  isWindows,
  checkFilesExist,
  fileExists,
  readJson,
  runCLI,
  runCommand,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import {
  setupAffectedGraphTest,
  cleanupAffectedGraphTest,
} from './affected-graph-setup';

describe('Nx Affected and Graph Tests', () => {
  let proj: string;

  beforeAll(() => {
    const context = setupAffectedGraphTest();
    proj = context.proj;
  });
  afterAll(() => cleanupAffectedGraphTest());

  describe('graph', () => {
    let myapp: string;
    let myapp2: string;
    let myapp3: string;
    let myappE2e: string;
    let myapp2E2e: string;
    let myapp3E2e: string;
    let mylib: string;
    let mylib2: string;

    beforeAll(() => {
      myapp = uniq('myapp');
      myapp2 = uniq('myapp2');
      myapp3 = uniq('myapp3');
      myappE2e = `${myapp}-e2e`;
      myapp2E2e = `${myapp2}-e2e`;
      myapp3E2e = `${myapp3}-e2e`;
      mylib = uniq('mylib');
      mylib2 = uniq('mylib2');

      runCLI(`generate @nx/web:app ${myapp} --directory=apps/${myapp}`);
      runCLI(`generate @nx/web:app ${myapp2} --directory=apps/${myapp2}`);
      runCLI(`generate @nx/web:app ${myapp3} --directory=apps/${myapp3}`);
      runCLI(`generate @nx/js:lib ${mylib} --directory=libs/${mylib}`);
      runCLI(`generate @nx/js:lib ${mylib2} --directory=libs/${mylib2}`);

      runCommand(`git init`);
      runCommand(`git config user.email "test@test.com"`);
      runCommand(`git config user.name "Test"`);
      runCommand(`git config commit.gpgsign false`);
      runCommand(
        `git add . && git commit -am "initial commit" && git checkout -b main`
      );

      updateFile(
        `apps/${myapp}/src/main.ts`,
        `
      import '@${proj}/${mylib}';

      const s = {loadChildren: '@${proj}/${mylib2}'};
    `
      );

      updateFile(
        `apps/${myapp2}/src/app/app.element.spec.ts`,
        `import '@${proj}/${mylib}';`
      );

      updateFile(
        `libs/${mylib}/src/${mylib}.spec.ts`,
        `import '@${proj}/${mylib2}';`
      );
    });

    it('graph should output json to file', () => {
      runCLI(`graph --file=project-graph.json`);

      expect(() => checkFilesExist('project-graph.json')).not.toThrow();

      const jsonFileContents = readJson('project-graph.json');

      expect(jsonFileContents.graph.dependencies).toEqual(
        expect.objectContaining({
          [myapp3E2e]: [
            {
              source: myapp3E2e,
              target: myapp3,
              type: 'implicit',
            },
          ],
          [myapp2]: [
            {
              source: myapp2,
              target: mylib,
              type: 'static',
            },
          ],
          [myapp2E2e]: [
            {
              source: myapp2E2e,
              target: myapp2,
              type: 'implicit',
            },
          ],
          [mylib]: [
            {
              source: mylib,
              target: mylib2,
              type: 'static',
            },
          ],
          [mylib2]: [],
          [myapp]: [
            {
              source: myapp,
              target: mylib,
              type: 'static',
            },
          ],
          [myappE2e]: [
            {
              source: myappE2e,
              target: myapp,
              type: 'implicit',
            },
          ],
          [myapp3]: [],
        })
      );
    }, 1000000);

    if (isNotWindows()) {
      it('graph should output json to file by absolute path', () => {
        runCLI(`graph --file=/tmp/project-graph.json`);

        expect(() => checkFilesExist('/tmp/project-graph.json')).not.toThrow();
      }, 1000000);
    }

    if (isWindows()) {
      it('graph should output json to file by absolute path in Windows', () => {
        runCLI(`graph --file=C:\\tmp\\project-graph.json`);

        expect(fileExists('C:\\tmp\\project-graph.json')).toBeTruthy();
      }, 1000000);
    }
  });
});
