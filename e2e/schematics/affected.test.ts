import { newApp, newLib, newProject, readFile, runCLI, runCommand, updateFile } from '../utils';

describe('Affected', () => {
  fit(
    'should print, build, and test affected apps',
    () => {
      newProject();
      newApp('myapp');
      newApp('myapp2');
      newLib('mylib');

      updateFile('apps/myapp/src/app/app.component.spec.ts', `import '@nrwl/mylib';`);

      updateRunAffectedToWorkInE2ESetup();

      const affectedApps = runCommand('npm run apps:affected -- --files="libs/mylib/index.ts"');
      expect(affectedApps).toContain('myapp');
      expect(affectedApps).not.toContain('myapp2');

      const build = runCommand('npm run build:affected -- --files="libs/mylib/index.ts"');
      expect(build).toContain('Building myapp');

      const e2e = runCommand('npm run e2e:affected -- --files="libs/mylib/index.ts"');
      expect(e2e).toContain('should display welcome message');
    },
    1000000
  );
});

function updateRunAffectedToWorkInE2ESetup() {
  const runAffected = readFile('node_modules/@nrwl/schematics/src/affected/run-affected.js');
  const newRunAffected = runAffected
    .replace('ng build', '../../node_modules/.bin/ng build')
    .replace('ng e2e', '../../node_modules/.bin/ng e2e');
  updateFile('node_modules/@nrwl/schematics/src/affected/run-affected.js', newRunAffected);
}
