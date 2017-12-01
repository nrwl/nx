import { newApp, newLib, newProject, readFile, runCLI, updateFile, runCommand } from '../utils';

describe('Migrator', () => {
  fit(
    'should run migrations',
    () => {
      newProject();
      console.log(runCommand('npm run nx-migrate'));
    },
    100000
  );
});
