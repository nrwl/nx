import {
  cleanupProject,
  createFile,
  listFiles,
  newProject,
  readFile,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
} from '@nx/e2e/utils';

describe('Build React applications and libraries with Vite', () => {
  beforeAll(() => {
    newProject({
      packages: ['@nx/react'],
    });
  });

  afterAll(() => {
    cleanupProject();
  });

  // Regression test: https://github.com/nrwl/nx/issues/21773
  it('should support SVGR and SVG asset in the same project', async () => {
    const appName = uniq('app');

    runCLI(
      `generate @nx/react:app ${appName} --bundler=webpack --compiler=babel --unitTestRunner=none --no-interactive`
    );
    createFile(
      `apps/${appName}/src/app/nx.svg`,
      `
        <svg version="1.1" width="300" height="200" xmlns="http://www.w3.org/2000/svg">
          <text x="150" y="125" font-size="60" text-anchor="middle" fill="white">SVG for app</text>
        </svg>
      `
    );
    updateFile(
      `apps/${appName}/src/app/app.tsx`,
      `
      import svgImg, { ReactComponent as Logo } from './nx.svg';
      export function App() {
        return (
          <>
            <img src={svgImg} alt="Alt for SVG img tag" />
            <Logo />
          </>
        );
      }
      export default App;
    `
    );

    await runCLIAsync(`build ${appName}`);

    const outFiles = listFiles(`dist/apps/${appName}`);
    const mainFile = outFiles.find((f) => f.startsWith('main.'));
    const mainContent = readFile(`dist/apps/${appName}/${mainFile}`);
    const svgFile = outFiles.find((f) => f.endsWith('.svg'));
    expect(mainContent).toMatch(/SVG for app/);
    expect(mainContent).toMatch(/Alt for SVG img tag/);
    expect(svgFile).toBeTruthy();
  }, 300_000);
});
