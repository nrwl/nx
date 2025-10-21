import {
  checkFilesExist,
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

    it('graph should focus requested project', () => {
      runCLI(`graph --focus=${myapp} --file=project-graph.json`);

      expect(() => checkFilesExist('project-graph.json')).not.toThrow();

      const jsonFileContents = readJson('project-graph.json');
      const projectNames = Object.keys(jsonFileContents.graph.nodes);

      expect(projectNames).toContain(myapp);
      expect(projectNames).toContain(mylib);
      expect(projectNames).toContain(mylib2);
      expect(projectNames).toContain(myappE2e);

      expect(projectNames).not.toContain(myapp2);
      expect(projectNames).not.toContain(myapp3);
      expect(projectNames).not.toContain(myapp2E2e);
      expect(projectNames).not.toContain(myapp3E2e);
    }, 1000000);

    it('graph should exclude requested projects', () => {
      runCLI(
        `graph --exclude=${myappE2e},${myapp2E2e},${myapp3E2e} --file=project-graph.json`
      );

      expect(() => checkFilesExist('project-graph.json')).not.toThrow();

      const jsonFileContents = readJson('project-graph.json');
      const projectNames = Object.keys(jsonFileContents.graph.nodes);

      expect(projectNames).toContain(myapp);
      expect(projectNames).toContain(mylib);
      expect(projectNames).toContain(mylib2);
      expect(projectNames).toContain(myapp2);
      expect(projectNames).toContain(myapp3);

      expect(projectNames).not.toContain(myappE2e);
      expect(projectNames).not.toContain(myapp2E2e);
      expect(projectNames).not.toContain(myapp3E2e);
    }, 1000000);

    it('graph should exclude requested projects that were included by a focus', () => {
      runCLI(
        `graph --focus=${myapp} --exclude=${myappE2e} --file=project-graph.json`
      );

      expect(() => checkFilesExist('project-graph.json')).not.toThrow();

      const jsonFileContents = readJson('project-graph.json');
      const projectNames = Object.keys(jsonFileContents.graph.nodes);

      expect(projectNames).toContain(myapp);
      expect(projectNames).toContain(mylib);
      expect(projectNames).toContain(mylib2);

      expect(projectNames).not.toContain(myappE2e);
      expect(projectNames).not.toContain(myapp2);
      expect(projectNames).not.toContain(myapp3);
      expect(projectNames).not.toContain(myapp2E2e);
      expect(projectNames).not.toContain(myapp3E2e);
    }, 1000000);
  });
});
