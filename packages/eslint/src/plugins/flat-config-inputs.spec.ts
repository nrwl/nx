import { TempFs } from '@nx/devkit/internal-testing-utils';
import { collectFlatConfigInputs } from './flat-config-inputs';

describe('collectFlatConfigInputs', () => {
  let tempFs: TempFs;

  beforeEach(() => {
    tempFs = new TempFs('flat-config-inputs');
  });

  afterEach(() => {
    tempFs.cleanup();
  });

  function installPackage(name: string) {
    tempFs.createFileSync(
      `node_modules/${name}/package.json`,
      JSON.stringify({ name, version: '1.0.0' })
    );
  }

  it('should collect installed packages imported by the config', () => {
    installPackage('@nx/eslint-plugin');
    installPackage('typescript-eslint');
    installPackage('eslint-config-prettier');
    tempFs.createFileSync(
      'eslint.config.mjs',
      `
      import nx from '@nx/eslint-plugin';
      import tseslint from 'typescript-eslint';
      import prettier from 'eslint-config-prettier';
      export default [];
      `
    );

    const result = collectFlatConfigInputs('eslint.config.mjs', tempFs.tempDir);

    expect(result.externalDependencies).toEqual([
      '@nx/eslint-plugin',
      'typescript-eslint',
      'eslint-config-prettier',
    ]);
    expect(result.files).toEqual([]);
  });

  it('should map subpath imports to their package name', () => {
    installPackage('typescript-eslint');
    installPackage('@angular-eslint/eslint-plugin');
    tempFs.createFileSync(
      'eslint.config.mjs',
      `
      import parser from 'typescript-eslint/parser';
      import { rules } from '@angular-eslint/eslint-plugin/dist/rules';
      export default [];
      `
    );

    const result = collectFlatConfigInputs('eslint.config.mjs', tempFs.tempDir);

    expect(result.externalDependencies).toEqual([
      'typescript-eslint',
      '@angular-eslint/eslint-plugin',
    ]);
  });

  it('should collect require and dynamic import and re-export specifiers', () => {
    installPackage('eslint-plugin-a');
    installPackage('eslint-plugin-b');
    installPackage('eslint-plugin-c');
    tempFs.createFileSync(
      'eslint.config.cjs',
      `
      const a = require('eslint-plugin-a');
      const b = import('eslint-plugin-b');
      export * from 'eslint-plugin-c';
      module.exports = [];
      `
    );

    const result = collectFlatConfigInputs('eslint.config.cjs', tempFs.tempDir);

    expect(result.externalDependencies).toEqual([
      'eslint-plugin-a',
      'eslint-plugin-b',
      'eslint-plugin-c',
    ]);
  });

  it('should skip node builtins and packages that are not installed', () => {
    installPackage('globals');
    tempFs.createFileSync(
      'eslint.config.mjs',
      `
      import { dirname } from 'node:path';
      import { fileURLToPath } from 'url';
      import globals from 'globals';
      import missing from 'eslint-plugin-missing';
      export default [];
      `
    );

    const result = collectFlatConfigInputs('eslint.config.mjs', tempFs.tempDir);

    expect(result.externalDependencies).toEqual(['globals']);
  });

  it('should follow relative imports and collect their imports too', () => {
    installPackage('@nx/eslint-plugin');
    installPackage('eslint-plugin-react');
    tempFs.createFilesSync({
      'eslint.config.mjs': `
        import nx from '@nx/eslint-plugin';
        export default [];
      `,
      'tools/eslint/react.mjs': `
        import react from 'eslint-plugin-react';
        export default [];
      `,
      'apps/web/eslint.config.mjs': `
        import baseConfig from '../../eslint.config.mjs';
        import reactConfig from '../../tools/eslint/react.mjs';
        export default [...baseConfig, ...reactConfig];
      `,
    });

    const result = collectFlatConfigInputs(
      'apps/web/eslint.config.mjs',
      tempFs.tempDir
    );

    expect(result.externalDependencies).toEqual([
      '@nx/eslint-plugin',
      'eslint-plugin-react',
    ]);
    expect(result.files).toEqual([
      'eslint.config.mjs',
      'tools/eslint/react.mjs',
    ]);
  });

  it('should resolve extensionless and directory relative imports', () => {
    installPackage('eslint-plugin-a');
    installPackage('eslint-plugin-b');
    tempFs.createFilesSync({
      'eslint.config.js': `
        const a = require('./tools/eslint/a');
        const rules = require('./tools/eslint-rules');
        module.exports = [];
      `,
      'tools/eslint/a.js': `module.exports = require('eslint-plugin-a');`,
      'tools/eslint-rules/index.js': `module.exports = require('eslint-plugin-b');`,
    });

    const result = collectFlatConfigInputs('eslint.config.js', tempFs.tempDir);

    expect(result.externalDependencies).toEqual([
      'eslint-plugin-a',
      'eslint-plugin-b',
    ]);
    expect(result.files).toEqual([
      'tools/eslint/a.js',
      'tools/eslint-rules/index.js',
    ]);
  });

  it('should not loop on circular relative imports', () => {
    tempFs.createFilesSync({
      'eslint.config.mjs': `
        import other from './other.mjs';
        export default [];
      `,
      'other.mjs': `
        import config from './eslint.config.mjs';
        export default [];
      `,
    });

    const result = collectFlatConfigInputs('eslint.config.mjs', tempFs.tempDir);

    expect(result.externalDependencies).toEqual([]);
    expect(result.files).toEqual(['other.mjs']);
  });

  it('should skip relative imports that cannot be resolved', () => {
    tempFs.createFileSync(
      'eslint.config.mjs',
      `
      import missing from './does-not-exist.mjs';
      export default [];
      `
    );

    const result = collectFlatConfigInputs('eslint.config.mjs', tempFs.tempDir);

    expect(result.files).toEqual([]);
  });

  it('should treat a workspace package linked into node_modules as a fileset', () => {
    tempFs.createFileSync(
      'libs/eslint-config/package.json',
      JSON.stringify({ name: '@org/eslint-config' })
    );
    tempFs.createFileSync(
      'libs/eslint-config/index.js',
      `module.exports = [];`
    );
    tempFs.createSymlinkSync(
      'libs/eslint-config',
      'node_modules/@org/eslint-config',
      'dir'
    );
    tempFs.createFileSync(
      'eslint.config.cjs',
      `
      const shared = require('@org/eslint-config');
      module.exports = [...shared];
      `
    );

    const result = collectFlatConfigInputs('eslint.config.cjs', tempFs.tempDir);

    expect(result.externalDependencies).toEqual([]);
    expect(result.files).toEqual(['libs/eslint-config/**/*']);
  });

  it('should look up packages from nested node_modules up to the workspace root', () => {
    installPackage('eslint-plugin-root');
    tempFs.createFileSync(
      'apps/web/node_modules/eslint-plugin-local/package.json',
      JSON.stringify({ name: 'eslint-plugin-local' })
    );
    tempFs.createFileSync(
      'apps/web/eslint.config.mjs',
      `
      import local from 'eslint-plugin-local';
      import root from 'eslint-plugin-root';
      export default [];
      `
    );

    const result = collectFlatConfigInputs(
      'apps/web/eslint.config.mjs',
      tempFs.tempDir
    );

    expect(result.externalDependencies).toEqual([
      'eslint-plugin-local',
      'eslint-plugin-root',
    ]);
  });

  it('should return empty inputs for an unreadable config', () => {
    const result = collectFlatConfigInputs('eslint.config.mjs', tempFs.tempDir);

    expect(result).toEqual({ externalDependencies: [], files: [] });
  });
});
