import {
  checkFilesExist,
  cleanupProject,
  newProject,
  readFile,
  runCLI,
  runCLIAsync,
  tmpProjPath,
  uniq,
  updateFile,
} from '@nx/e2e/utils';
import { execSync } from 'child_process';

describe('Node Applications + webpack', () => {
  beforeEach(() => newProject());

  afterEach(() => cleanupProject());

  it('should generate an app using webpack', async () => {
    const app = uniq('nodeapp');

    runCLI(`generate @nx/node:app ${app} --bundler=webpack --no-interactive`);

    checkFilesExist(`apps/${app}/webpack.config.js`);

    updateFile(
      `apps/${app}/src/main.ts`,
      `
      function foo(x: string) {
        return "foo " + x;
      };
      console.log(foo("bar")); 
    `
    );
    await runCLIAsync(`build ${app}`);

    checkFilesExist(`dist/apps/${app}/main.js`);
    // no optimization by default
    const content = readFile(`dist/apps/${app}/main.js`);
    expect(content).toContain('console.log(foo("bar"))');

    const result = execSync(`node dist/apps/${app}/main.js`, {
      cwd: tmpProjPath(),
    }).toString();
    expect(result).toMatch(/foo bar/);

    await runCLIAsync(`build ${app} --optimization`);
    const optimizedContent = readFile(`dist/apps/${app}/main.js`);
    expect(optimizedContent).toContain('console.log("foo "+"bar")');
  }, 300_000);
});
