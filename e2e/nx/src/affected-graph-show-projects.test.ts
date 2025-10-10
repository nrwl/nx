import { readFile, runCLI, runCLIAsync, uniq, updateFile } from '@nx/e2e-utils';
import {
  setupAffectedGraphTest,
  cleanupAffectedGraphTest,
} from './affected-graph-setup';

describe('show projects --affected', () => {
  let proj: string;

  beforeAll(() => {
    const context = setupAffectedGraphTest();
    proj = context.proj;
  });
  afterAll(() => cleanupAffectedGraphTest());

  it('should print information about affected projects', async () => {
    const myapp = uniq('myapp-a');
    const myapp2 = uniq('myapp-b');
    const mylib = uniq('mylib');
    const mylib2 = uniq('mylib2');
    const mypublishablelib = uniq('mypublishablelib');

    runCLI(
      `generate @nx/web:app ${myapp} --directory=apps/${myapp} --unitTestRunner=vitest`
    );
    runCLI(
      `generate @nx/web:app ${myapp2} --directory=apps/${myapp2} --unitTestRunner=vitest`
    );
    runCLI(`generate @nx/js:lib ${mylib} --directory=libs/${mylib}`);
    runCLI(`generate @nx/js:lib ${mylib2} --directory=libs/${mylib2}`);
    runCLI(
      `generate @nx/js:lib ${mypublishablelib} --directory=libs/${mypublishablelib}`
    );

    const app1ElementSpec = readFile(
      `apps/${myapp}/src/app/app.element.spec.ts`
    );

    updateFile(
      `apps/${myapp}/src/app/app.element.spec.ts`,
      `
        import "@${proj}/${mylib}";
        import "@${proj}/${mypublishablelib}";
        ${app1ElementSpec}
        `
    );

    const app2ElementSpec = readFile(
      `apps/${myapp2}/src/app/app.element.spec.ts`
    );

    updateFile(
      `apps/${myapp2}/src/app/app.element.spec.ts`,
      `
        import "@${proj}/${mylib}";
        import "@${proj}/${mypublishablelib}";
        ${app2ElementSpec}
        `
    );

    const { stdout: resWithoutTarget } = await runCLIAsync(
      `show projects --affected --files=apps/${myapp}/src/app/app.element.spec.ts`
    );
    compareTwoArrays(resWithoutTarget.split('\n').filter(Boolean), [
      `${myapp}-e2e`,
      myapp,
    ]);

    const resWithTarget = JSON.parse(
      (
        await runCLIAsync(
          `affected -t test --files=apps/${myapp}/src/app/app.element.spec.ts --graph stdout`,
          { silent: true }
        )
      ).stdout.trim()
    );

    expect(resWithTarget.tasks.tasks[`${myapp}:test`]).toMatchObject({
      id: `${myapp}:test`,
      overrides: {},
      target: {
        project: myapp,
        target: 'test',
      },
      outputs: [`coverage/apps/${myapp}`],
    });
  }, 120000);

  function compareTwoArrays(a: string[], b: string[]) {
    expect(a.sort((x, y) => x.localeCompare(y))).toEqual(
      b.sort((x, y) => x.localeCompare(y))
    );
  }
});
