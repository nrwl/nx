import {
  checkFilesExist,
  readFile,
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

    it('graph should output a deployable static website in an html file accompanied by a folder with static assets', () => {
      runCLI(`graph --file=project-graph.html`);

      expect(() => checkFilesExist('project-graph.html')).not.toThrow();
      expect(() => checkFilesExist('static/styles.css')).not.toThrow();
      expect(() => checkFilesExist('static/runtime.js')).not.toThrow();
      expect(() => checkFilesExist('static/main.js')).not.toThrow();
      expect(() => checkFilesExist('static/environment.js')).not.toThrow();

      const environmentJs = readFile('static/environment.js');

      expect(environmentJs).toContain('window.projectGraphResponse');
      expect(environmentJs).toMatch(/"affected":\[.*\]/);
    });

    // TODO(@AgentEnder): Please re-enable this when you fix the output
    xit('graph should output valid json when stdout is specified', () => {
      const result = runCLI(`affected -t build --graph stdout`);
      let model;
      expect(() => (model = JSON.parse(result))).not.toThrow();
      expect(model).toHaveProperty('graph');
      expect(model).toHaveProperty('tasks');
    });

    it('should include affected projects in environment file', () => {
      runCLI(`graph --affected --file=project-graph.html`);

      const environmentJs = readFile('static/environment.js');
      const affectedProjects = environmentJs
        .match(/"affected":\[(.*?)\]/)[1]
        ?.split(',');

      expect(affectedProjects).toContain(`"${myapp}"`);
      expect(affectedProjects).toContain(`"${myappE2e}"`);
      expect(affectedProjects).toContain(`"${myapp2}"`);
      expect(affectedProjects).toContain(`"${myapp2E2e}"`);
      expect(affectedProjects).toContain(`"${mylib}"`);
    });
  });
});
