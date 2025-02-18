import {
  checkFilesDoNotExist,
  checkFilesExist,
  getPackageManagerCommand,
  getPublishedVersion,
  readFile,
  readJson,
  runCLI,
  runCommand,
  updateFile,
} from '@nx/e2e/utils';
import { copySync, renameSync } from 'fs-extra';
import { sync as globSync } from 'glob';
import { join } from 'path';
import {
  createNonNxProjectDirectory,
  tmpProjPath,
  updateJson,
} from '../../utils';

describe('nx init (for React - legacy)', () => {
  let pmc: ReturnType<typeof getPackageManagerCommand>;

  it('should convert to an standalone workspace with Vite', () => {
    const appName = 'my-app';
    createReactApp(appName);

    const craToNxOutput = runCommand(
      `${
        pmc.runUninstalledPackage
      } nx@${getPublishedVersion()} init --no-interactive`
    );

    expect(craToNxOutput).toContain('Successfully created the workspace');

    checkFilesDoNotExist(
      'libs/.gitkeep',
      'tools/tsconfig.tools.json',
      'babel.config.json',
      'jest.preset.js',
      'jest.config.ts'
    );

    const packageJson = readJson('package.json');
    expect(packageJson.dependencies['redux']).toBeDefined();
    expect(packageJson.name).toEqual(appName);

    const viteConfig = readFile(`vite.config.js`);
    expect(viteConfig).toContain('port: 4200'); // default port

    runCLI(`build ${appName}`);
    checkFilesExist(`dist/${appName}/index.html`);

    const unitTestsOutput = runCLI(`test ${appName}`);
    expect(unitTestsOutput).toContain('Successfully ran target test');
  });

  function createReactApp(appName: string) {
    createNonNxProjectDirectory();
    const projPath = tmpProjPath();
    copySync(join(__dirname, 'files/cra'), projPath);
    const filesToRename = globSync(join(projPath, '**/*.txt'));
    filesToRename.forEach((f) => {
      renameSync(f, f.split('.txt')[0]);
    });
    updateFile('.gitignore', 'node_modules');
    updateJson('package.json', (_) => ({
      name: appName,
      version: '0.1.0',
      private: true,
      dependencies: {
        '@testing-library/jest-dom': '5.16.5',
        '@testing-library/react': '13.4.0',
        '@testing-library/user-event': '13.5.0',
        react: '^18.2.0',
        'react-dom': '^18.2.0',
        'react-scripts': '5.0.1',
        'web-vitals': '2.1.4',
        redux: '^3.6.0',
      },
      scripts: {
        start: 'react-scripts start',
        build: 'react-scripts build',
        test: 'react-scripts test',
        eject: 'react-scripts eject',
      },
      eslintConfig: {
        extends: ['react-app', 'react-app/jest'],
      },
      browserslist: {
        production: ['>0.2%', 'not dead', 'not op_mini all'],
        development: [
          'last 1 chrome version',
          'last 1 firefox version',
          'last 1 safari version',
        ],
      },
    }));
    runCommand(pmc.install);
    runCommand('git init');
    runCommand('git add .');
    runCommand('git commit -m "Init"');
  }
});
