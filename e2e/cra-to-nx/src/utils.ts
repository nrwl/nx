import {
  createNonNxProjectDirectory,
  getPackageManagerCommand,
  getSelectedPackageManager,
  runCommand,
  tmpProjPath,
  updateFile,
  updateJson,
} from '../../utils';
import { copySync, renameSync } from 'fs-extra';
import { join } from 'path';
import { sync as globSync } from 'glob';

export function createReactApp(appName: string) {
  const pmc = getPackageManagerCommand({
    packageManager: getSelectedPackageManager(),
  });

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
