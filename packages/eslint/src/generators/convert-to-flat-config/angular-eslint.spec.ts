import '@nx/devkit/internal-testing-utils/mock-project-graph';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readJson, updateJson, type Tree } from '@nx/devkit';
import { migrateAngularEslintV22FlatConfig } from './angular-eslint';

describe('migrateAngularEslintV22FlatConfig', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  function setAngularEslintVersion(version: string): void {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = {
        ...json.devDependencies,
        '@angular-eslint/eslint-plugin': version,
      };
      return json;
    });
  }

  it('is a no-op below angular-eslint v22 (the refs are still valid)', async () => {
    setAngularEslintVersion('^21.0.0');
    const original = `export default [
  {
    files: ['**/*.ts'],
    rules: { '@angular-eslint/no-conflicting-lifecycle': 'error' },
  },
];
`;
    tree.write('apps/app/eslint.config.mjs', original);

    await migrateAngularEslintV22FlatConfig(tree);

    expect(tree.read('apps/app/eslint.config.mjs', 'utf-8')).toBe(original);
  });

  it('remaps the removed eslintrc configs to their flat-native counterparts', async () => {
    setAngularEslintVersion('^22.0.0');
    tree.write(
      'apps/app/eslint.config.mjs',
      `import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
  ...compat.extends(
    'plugin:@angular-eslint/recommended',
    'plugin:@angular-eslint/all',
    'plugin:@angular-eslint/template/recommended',
    'plugin:@angular-eslint/template/accessibility',
    'plugin:@angular-eslint/template/all'
  ),
];
`
    );

    await migrateAngularEslintV22FlatConfig(tree);

    const content = tree.read('apps/app/eslint.config.mjs', 'utf-8');
    expect(content).not.toContain('compat.extends');
    expect(content).not.toContain('FlatCompat');
    expect(content).toMatch(/import angular from ['"]angular-eslint['"]/);
    expect(content).toContain('...angular.configs.tsRecommended');
    expect(content).toContain('...angular.configs.tsAll');
    expect(content).toContain('...angular.configs.templateRecommended');
    expect(content).toContain('...angular.configs.templateAccessibility');
    expect(content).toContain('...angular.configs.templateAll');
  });

  it('turns the process-inline-templates shim into a processor block and drops the orphaned FlatCompat', async () => {
    setAngularEslintVersion('^22.0.0');
    tree.write(
      'apps/app/eslint.config.mjs',
      `import nx from '@nx/eslint-plugin';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
  ...nx.configs['flat/angular'],
  ...compat.extends('plugin:@angular-eslint/template/process-inline-templates'),
  {
    files: ['**/*.ts'],
    rules: {},
  },
];
`
    );

    await migrateAngularEslintV22FlatConfig(tree);

    const content = tree.read('apps/app/eslint.config.mjs', 'utf-8');
    expect(content).not.toContain('process-inline-templates');
    expect(content).not.toContain('compat.extends');
    expect(content).not.toContain('FlatCompat');
    expect(content).not.toContain('@eslint/eslintrc');
    // The @eslint/js import only fed FlatCompat's recommendedConfig; it goes too.
    expect(content).not.toContain('@eslint/js');
    expect(content).toMatch(/import angular from ['"]angular-eslint['"]/);
    expect(content).toContain('processor: angular.processInlineTemplates');
    expect(content).toContain("files: ['**/*.ts']");
    expect(content).toContain("nx.configs['flat/angular']");
  });

  it('removes the no-conflicting-lifecycle rule and leaves other rules', async () => {
    setAngularEslintVersion('^22.0.0');
    tree.write(
      'apps/app/eslint.config.mjs',
      `import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/angular'],
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': ['error', { type: 'attribute' }],
      '@angular-eslint/no-conflicting-lifecycle': 'error',
      '@angular-eslint/use-lifecycle-interface': 'error',
    },
  },
];
`
    );

    await migrateAngularEslintV22FlatConfig(tree);

    const content = tree.read('apps/app/eslint.config.mjs', 'utf-8');
    expect(content).not.toContain('no-conflicting-lifecycle');
    expect(content).toContain('@angular-eslint/directive-selector');
    expect(content).toContain('@angular-eslint/use-lifecycle-interface');
  });

  it('keeps unrelated configs in a residual compat.extends and preserves FlatCompat', async () => {
    setAngularEslintVersion('^22.0.0');
    tree.write(
      'apps/app/eslint.config.mjs',
      `import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
  ...compat.extends(
    'plugin:@angular-eslint/recommended',
    'plugin:custom/config'
  ),
];
`
    );

    await migrateAngularEslintV22FlatConfig(tree);

    const content = tree.read('apps/app/eslint.config.mjs', 'utf-8');
    expect(content).toContain('...angular.configs.tsRecommended');
    expect(content).toContain("...compat.extends('plugin:custom/config')");
    expect(content).toContain('new FlatCompat');
    expect(content).toContain('@eslint/eslintrc');
  });

  it('preserves argument order so rule precedence is unchanged', async () => {
    setAngularEslintVersion('^22.0.0');
    tree.write(
      'apps/app/eslint.config.mjs',
      `import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  ...compat.extends(
    'plugin:custom/base',
    'plugin:@angular-eslint/recommended'
  ),
];
`
    );

    await migrateAngularEslintV22FlatConfig(tree);

    const content = tree.read('apps/app/eslint.config.mjs', 'utf-8');
    // custom/base was listed first, so its residual compat.extends must stay
    // before the remapped angular config (flat config is last-wins).
    expect(
      content.indexOf("...compat.extends('plugin:custom/base')")
    ).toBeLessThan(content.indexOf('...angular.configs.tsRecommended'));
  });

  it('keeps the @eslint/js import when it is still referenced', async () => {
    setAngularEslintVersion('^22.0.0');
    tree.write(
      'apps/app/eslint.config.mjs',
      `import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
  js.configs.recommended,
  ...compat.extends('plugin:@angular-eslint/recommended'),
];
`
    );

    await migrateAngularEslintV22FlatConfig(tree);

    const content = tree.read('apps/app/eslint.config.mjs', 'utf-8');
    expect(content).not.toContain('new FlatCompat');
    // js is still used by the top-level js.configs.recommended, so its import stays.
    expect(content).toContain('@eslint/js');
    expect(content).toContain('js.configs.recommended');
  });

  it('does not delete a trailing comment on the preceding rule', async () => {
    setAngularEslintVersion('^22.0.0');
    tree.write(
      'apps/app/eslint.config.mjs',
      `export default [
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': 'error', // keep this note
      '@angular-eslint/no-conflicting-lifecycle': 'error',
    },
  },
];
`
    );

    await migrateAngularEslintV22FlatConfig(tree);

    const content = tree.read('apps/app/eslint.config.mjs', 'utf-8');
    expect(content).not.toContain('no-conflicting-lifecycle');
    expect(content).toContain('keep this note');
    expect(content).toContain('@angular-eslint/directive-selector');
  });

  it('removes a rule with a comment before its comma without leaving a dangling comma', async () => {
    setAngularEslintVersion('^22.0.0');
    tree.write(
      'apps/app/eslint.config.mjs',
      `export default [
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/no-conflicting-lifecycle': 'error' /* drop me */,
      '@angular-eslint/use-lifecycle-interface': 'error',
    },
  },
];
`
    );

    await migrateAngularEslintV22FlatConfig(tree);

    const content = tree.read('apps/app/eslint.config.mjs', 'utf-8');
    expect(content).not.toContain('no-conflicting-lifecycle');
    expect(content).toContain('@angular-eslint/use-lifecycle-interface');
    // No leading/double comma left where the rule (and its comment) was removed.
    expect(content).not.toMatch(/{\s*,/);
    expect(content).not.toMatch(/,\s*,/);
  });

  it('leaves configs without the removed refs untouched', async () => {
    setAngularEslintVersion('^22.0.0');
    const original = `import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/angular'],
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': ['error', { type: 'attribute' }],
    },
  },
];
`;
    tree.write('apps/app/eslint.config.mjs', original);

    await migrateAngularEslintV22FlatConfig(tree);

    expect(tree.read('apps/app/eslint.config.mjs', 'utf-8')).toBe(original);
  });

  it('adds the angular-eslint dependency when it introduces angular references', async () => {
    setAngularEslintVersion('^22.0.0');
    tree.write(
      'apps/app/eslint.config.mjs',
      `import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';

const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  ...compat.extends('plugin:@angular-eslint/recommended'),
];
`
    );

    await migrateAngularEslintV22FlatConfig(tree);

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['angular-eslint']).toBe('^22.0.0');
  });

  it('reconciles both base and per-project flat configs', async () => {
    setAngularEslintVersion('^22.0.0');
    tree.write(
      'eslint.base.config.mjs',
      `export default [
  {
    files: ['**/*.ts'],
    rules: { '@angular-eslint/no-conflicting-lifecycle': 'error' },
  },
];
`
    );
    tree.write(
      'apps/app/eslint.config.mjs',
      `export default [
  {
    files: ['**/*.ts'],
    rules: { '@angular-eslint/no-conflicting-lifecycle': ['error'] },
  },
];
`
    );

    await migrateAngularEslintV22FlatConfig(tree);

    expect(tree.read('eslint.base.config.mjs', 'utf-8')).not.toContain(
      'no-conflicting-lifecycle'
    );
    expect(tree.read('apps/app/eslint.config.mjs', 'utf-8')).not.toContain(
      'no-conflicting-lifecycle'
    );
  });

  it('collapses the per-override compat.config().map() shape and drops the redundant processor', async () => {
    setAngularEslintVersion('^22.0.0');
    tree.write(
      'apps/app/eslint.config.mjs',
      `import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import nx from '@nx/eslint-plugin';

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/angular'],
  ...compat
    .config({
      extends: ['plugin:@angular-eslint/template/process-inline-templates'],
    })
    .map((config) => ({
      ...config,
      files: ['**/*.ts'],
      rules: {
        ...config.rules,
        '@angular-eslint/directive-selector': ['error', { type: 'attribute' }],
        '@angular-eslint/no-conflicting-lifecycle': 'error',
      },
    })),
  ...nx.configs['flat/angular-template'],
];
`
    );

    await migrateAngularEslintV22FlatConfig(tree);

    const content = tree.read('apps/app/eslint.config.mjs', 'utf-8');
    expect(content).not.toContain('process-inline-templates');
    expect(content).not.toContain('no-conflicting-lifecycle');
    expect(content).not.toContain('compat.config');
    expect(content).not.toContain('FlatCompat');
    // The override's own files/rules survive the collapse.
    expect(content).toContain("files: ['**/*.ts']");
    expect(content).toContain('@angular-eslint/directive-selector');
    // flat/angular already applies the processor, so the shim is dropped, not
    // re-emitted, and no angular-eslint import is needed.
    expect(content).toContain("nx.configs['flat/angular']");
    expect(content).not.toContain('processor: angular.processInlineTemplates');
    expect(content).not.toContain("from 'angular-eslint'");
  });

  it('remaps a direct angular-eslint config inside the per-override shape and scopes it to the files', async () => {
    setAngularEslintVersion('^22.0.0');
    tree.write(
      'apps/app/eslint.config.mjs',
      `import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  ...compat
    .config({ extends: ['plugin:@angular-eslint/recommended'] })
    .map((config) => ({
      ...config,
      files: ['**/*.ts'],
      rules: { ...config.rules, 'no-console': 'error' },
    })),
];
`
    );

    await migrateAngularEslintV22FlatConfig(tree);

    const content = tree.read('apps/app/eslint.config.mjs', 'utf-8');
    expect(content).not.toContain('compat.config');
    expect(content).not.toContain('FlatCompat');
    expect(content).toMatch(/import angular from ['"]angular-eslint['"]/);
    // The shared config is scoped to the override's files, as the .map did.
    expect(content).toContain(
      "...angular.configs.tsRecommended.map((c) => ({ ...c, files: ['**/*.ts'] }))"
    );
    // The override's own rules survive in the collapsed block.
    expect(content).toContain("'no-console': 'error'");
  });

  it('collapses the per-override shape when the map parameter is not named config', async () => {
    setAngularEslintVersion('^22.0.0');
    tree.write(
      'apps/app/eslint.config.mjs',
      `import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  ...compat
    .config({ extends: ['plugin:@angular-eslint/recommended'] })
    .map((cfg) => ({
      ...cfg,
      files: ['**/*.ts'],
      rules: { ...cfg.rules, 'no-console': 'error' },
    })),
];
`
    );

    await migrateAngularEslintV22FlatConfig(tree);

    const content = tree.read('apps/app/eslint.config.mjs', 'utf-8');
    expect(content).not.toContain('compat.config');
    // The collapse strips the arrow's own spreads by the actual parameter name,
    // so none is left dangling (a `...cfg` with no binding would throw on load).
    expect(content).not.toContain('...cfg');
    expect(content).toContain(
      "...angular.configs.tsRecommended.map((c) => ({ ...c, files: ['**/*.ts'] }))"
    );
    expect(content).toContain("'no-console': 'error'");
  });

  it('leaves a compat.config block that carries more than extends untouched', async () => {
    setAngularEslintVersion('^22.0.0');
    const original = `import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  ...compat
    .config({
      env: { browser: true },
      extends: ['plugin:@angular-eslint/recommended'],
    })
    .map((config) => ({
      ...config,
      files: ['**/*.ts'],
    })),
];
`;
    tree.write('apps/app/eslint.config.mjs', original);

    await migrateAngularEslintV22FlatConfig(tree);

    // The block carries env alongside extends, so it is left byte-for-byte intact
    // rather than partially rewritten into a broken config.
    expect(tree.read('apps/app/eslint.config.mjs', 'utf-8')).toBe(original);
  });

  it('handles the per-override shape in a CJS config and removes the FlatCompat require', async () => {
    setAngularEslintVersion('^22.0.0');
    tree.write(
      'apps/app/eslint.config.cjs',
      `const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');
const nx = require('@nx/eslint-plugin');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  ...nx.configs['flat/angular'],
  ...compat
    .config({
      extends: ['plugin:@angular-eslint/template/process-inline-templates'],
    })
    .map((config) => ({
      ...config,
      files: ['**/*.ts'],
      rules: { ...config.rules, '@angular-eslint/directive-selector': 'error' },
    })),
];
`
    );

    await migrateAngularEslintV22FlatConfig(tree);

    const content = tree.read('apps/app/eslint.config.cjs', 'utf-8');
    expect(content).not.toContain('process-inline-templates');
    expect(content).not.toContain('compat.config');
    expect(content).not.toContain('FlatCompat');
    expect(content).not.toContain('@eslint/eslintrc');
    expect(content).toContain('@angular-eslint/directive-selector');
  });

  it('preserves interleaved config order across multiple residual groups', async () => {
    setAngularEslintVersion('^22.0.0');
    tree.write(
      'apps/app/eslint.config.mjs',
      `import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  ...compat.extends(
    'plugin:custom/a',
    'plugin:@angular-eslint/recommended',
    'plugin:custom/b',
    'plugin:@angular-eslint/all'
  ),
];
`
    );

    await migrateAngularEslintV22FlatConfig(tree);

    const content = tree.read('apps/app/eslint.config.mjs', 'utf-8');
    const aIndex = content.indexOf("...compat.extends('plugin:custom/a')");
    const recIndex = content.indexOf('...angular.configs.tsRecommended');
    const bIndex = content.indexOf("...compat.extends('plugin:custom/b')");
    const allIndex = content.indexOf('...angular.configs.tsAll');
    expect(aIndex).toBeGreaterThanOrEqual(0);
    expect(recIndex).toBeGreaterThan(aIndex);
    expect(bIndex).toBeGreaterThan(recIndex);
    expect(allIndex).toBeGreaterThan(bIndex);
  });

  it('gates on the umbrella angular-eslint dependency when the scoped plugin is absent', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = {
        ...json.devDependencies,
        'angular-eslint': '^22.0.0',
      };
      return json;
    });
    tree.write(
      'apps/app/eslint.config.mjs',
      `export default [
  {
    files: ['**/*.ts'],
    rules: { '@angular-eslint/no-conflicting-lifecycle': 'error' },
  },
];
`
    );

    await migrateAngularEslintV22FlatConfig(tree);

    expect(tree.read('apps/app/eslint.config.mjs', 'utf-8')).not.toContain(
      'no-conflicting-lifecycle'
    );
  });
});
