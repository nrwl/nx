import { newApp, newLib, newProject, readFile, runCLI, updateFile } from '../utils';

describe('Lint', () => {
  it(
    'should ensure module boundaries',
    () => {
      newProject();
      newApp('myapp');
      newLib('mylib');
      newLib('lazylib');

      const tslint = JSON.parse(readFile('tslint.json'));
      tslint.rules['nx-enforce-module-boundaries'][1].lazyLoad.push('lazylib');
      updateFile('tslint.json', JSON.stringify(tslint, null, 2));

      updateFile(
        'apps/myapp/src/main.ts',
        `
      import '../../../libs/mylib';
      import '@nrwl/lazylib';
      import '@nrwl/mylib/deep';
    `
      );

      const out = runCLI('lint --type-check', { silenceError: true });
      expect(out).toContain('library imports must start with @nrwl/');
      expect(out).toContain('import of lazy-loaded libraries are forbidden');
      expect(out).toContain('deep imports into libraries are forbidden');
    },
    1000000
  );
});
