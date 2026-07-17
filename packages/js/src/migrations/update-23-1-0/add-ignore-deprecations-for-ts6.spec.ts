import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readJson, type Tree } from '@nx/devkit';
import update from './add-ignore-deprecations-for-ts6';

describe('add-ignore-deprecations-for-ts6 migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  const detectedCases: Array<[string, Record<string, unknown>]> = [
    ['moduleResolution node', { moduleResolution: 'node' }],
    ['moduleResolution node10', { moduleResolution: 'node10' }],
    ['moduleResolution classic', { moduleResolution: 'classic' }],
    ['baseUrl', { baseUrl: '.' }],
    ['target es5', { target: 'es5' }],
    ['esModuleInterop false', { esModuleInterop: false }],
    ['outFile', { outFile: './out.js', module: 'esnext' }],
    ['module amd', { module: 'amd' }],
    ['module umd', { module: 'umd' }],
    ['module system', { module: 'system' }],
    ['module none', { module: 'none' }],
    ['alwaysStrict false', { alwaysStrict: false }],
    [
      'allowSyntheticDefaultImports false',
      { allowSyntheticDefaultImports: false },
    ],
    ['downlevelIteration false', { downlevelIteration: false }],
  ];

  it.each(detectedCases)(
    'adds ignoreDeprecations for %s',
    async (_name, compilerOptions) => {
      tree.write('tsconfig.json', JSON.stringify({ compilerOptions }, null, 2));

      await update(tree);

      const json = readJson(tree, 'tsconfig.json');
      expect(json.compilerOptions.ignoreDeprecations).toBe('6.0');
    }
  );

  it('skips files with no deprecated options', async () => {
    // An "extends" file is not a chain root, so the default-preserving pass
    // leaves it alone (it would otherwise pin the deprecated
    // "esModuleInterop": false), isolating the deprecation-detection logic.
    tree.write(
      'tsconfig.app.json',
      JSON.stringify(
        {
          extends: './tsconfig.json',
          compilerOptions: { module: 'esnext', moduleResolution: 'bundler' },
        },
        null,
        2
      )
    );

    await update(tree);

    const json = readJson(tree, 'tsconfig.app.json');
    expect(json.compilerOptions.ignoreDeprecations).toBeUndefined();
  });

  it('adds only the config-load flag to a solution-container tsconfig.json', async () => {
    // No compilerOptions and no source files, so the pins are skipped, but the
    // file is still a jest/ts-node auto-load target, so it gets the flag.
    tree.write('tsconfig.json', JSON.stringify({ files: [] }, null, 2));

    await update(tree);

    const json = readJson(tree, 'tsconfig.json');
    expect(json.compilerOptions).toEqual({ ignoreDeprecations: '6.0' });
  });

  it('leaves a non-object compilerOptions untouched without crashing', async () => {
    // A present-but-non-object compilerOptions previously crashed the pin pass
    // (modify() throws), aborting the whole migration.
    tree.write(
      'tsconfig.json',
      JSON.stringify({ compilerOptions: [] }, null, 2)
    );

    await update(tree);

    expect(readJson(tree, 'tsconfig.json').compilerOptions).toEqual([]);
  });

  it('leaves a non-object compilerOptions untouched even when it inherits a deprecated value', async () => {
    // The block can't receive the flag; the inherited node10 stays unsilenced,
    // but the migration must not corrupt the array or throw and abort.
    tree.write(
      'base.json',
      JSON.stringify(
        { compilerOptions: { moduleResolution: 'node10' } },
        null,
        2
      )
    );
    tree.write(
      'tsconfig.app.json',
      JSON.stringify({ extends: './base.json', compilerOptions: [] }, null, 2)
    );

    await update(tree);

    expect(readJson(tree, 'tsconfig.app.json').compilerOptions).toEqual([]);
  });

  it('upgrades a stale ignoreDeprecations value to "6.0"', async () => {
    tree.write(
      'tsconfig.json',
      JSON.stringify(
        {
          compilerOptions: {
            moduleResolution: 'node',
            ignoreDeprecations: '5.0',
          },
        },
        null,
        2
      )
    );

    await update(tree);

    const json = readJson(tree, 'tsconfig.json');
    expect(json.compilerOptions.ignoreDeprecations).toBe('6.0');
  });

  it('does not modify a file that already has ignoreDeprecations "6.0"', async () => {
    tree.write(
      'tsconfig.json',
      JSON.stringify(
        {
          compilerOptions: {
            moduleResolution: 'node',
            ignoreDeprecations: '6.0',
          },
        },
        null,
        2
      )
    );
    // Run once so the file is already format-normalized; the assertion then
    // isolates the migration's own edit logic from formatFiles churn.
    await update(tree);
    const before = tree.read('tsconfig.json', 'utf-8');

    await update(tree);

    expect(tree.read('tsconfig.json', 'utf-8')).toBe(before);
  });

  it('adds ignoreDeprecations to a ts-node.compilerOptions block', async () => {
    // "extends" keeps the default-preserving pass off the top-level block, so
    // only the ts-node block's own deprecated value drives ignoreDeprecations.
    tree.write(
      'tsconfig.app.json',
      JSON.stringify(
        {
          extends: './tsconfig.json',
          compilerOptions: { module: 'esnext', moduleResolution: 'bundler' },
          'ts-node': { compilerOptions: { moduleResolution: 'node10' } },
        },
        null,
        2
      )
    );

    await update(tree);

    const json = readJson(tree, 'tsconfig.app.json');
    expect(json.compilerOptions.ignoreDeprecations).toBeUndefined();
    expect(json['ts-node'].compilerOptions.ignoreDeprecations).toBe('6.0');
  });

  it('adds ignoreDeprecations to both compilerOptions and ts-node block', async () => {
    tree.write(
      'tsconfig.json',
      JSON.stringify(
        {
          compilerOptions: { baseUrl: '.' },
          'ts-node': { compilerOptions: { moduleResolution: 'node10' } },
        },
        null,
        2
      )
    );

    await update(tree);

    const json = readJson(tree, 'tsconfig.json');
    expect(json.compilerOptions.ignoreDeprecations).toBe('6.0');
    expect(json['ts-node'].compilerOptions.ignoreDeprecations).toBe('6.0');
  });

  it('processes nested project tsconfig files', async () => {
    tree.write(
      'apps/app1/tsconfig.app.json',
      JSON.stringify({ compilerOptions: { target: 'es5' } }, null, 2)
    );

    await update(tree);

    const json = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(json.compilerOptions.ignoreDeprecations).toBe('6.0');
  });

  it('is idempotent', async () => {
    tree.write(
      'tsconfig.json',
      JSON.stringify({ compilerOptions: { moduleResolution: 'node' } }, null, 2)
    );

    await update(tree);
    const afterFirst = tree.read('tsconfig.json', 'utf-8');
    await update(tree);
    const afterSecond = tree.read('tsconfig.json', 'utf-8');

    expect(afterSecond).toBe(afterFirst);
  });

  it('preserves comments when adding the flag', async () => {
    tree.write(
      'tsconfig.json',
      `{
  // root tsconfig
  "compilerOptions": {
    "moduleResolution": "node"
  }
}
`
    );

    await update(tree);

    const contents = tree.read('tsconfig.json', 'utf-8');
    expect(contents).toContain('// root tsconfig');
    expect(contents).toContain('"ignoreDeprecations": "6.0"');
  });

  it('does not add ignoreDeprecations for alwaysStrict true', async () => {
    // "extends" file so the default-preserving pass doesn't pin the deprecated
    // "esModuleInterop": false; only alwaysStrict (true, not deprecated) is here.
    tree.write(
      'tsconfig.app.json',
      JSON.stringify(
        {
          extends: './tsconfig.json',
          compilerOptions: { alwaysStrict: true },
        },
        null,
        2
      )
    );

    await update(tree);

    const json = readJson(tree, 'tsconfig.app.json');
    expect(json.compilerOptions.ignoreDeprecations).toBeUndefined();
  });

  it('does not add ignoreDeprecations when downlevelIteration is absent', async () => {
    // "extends" file so the default-preserving pass doesn't add its own
    // deprecated "esModuleInterop": false and confound the assertion.
    tree.write(
      'tsconfig.app.json',
      JSON.stringify(
        {
          extends: './tsconfig.json',
          compilerOptions: { module: 'esnext', moduleResolution: 'bundler' },
        },
        null,
        2
      )
    );

    await update(tree);

    const json = readJson(tree, 'tsconfig.app.json');
    expect(json.compilerOptions.ignoreDeprecations).toBeUndefined();
  });

  it('applies all pins on a chain root carrying a deprecated option', async () => {
    tree.write(
      'tsconfig.json',
      JSON.stringify({ compilerOptions: { moduleResolution: 'node' } }, null, 2)
    );

    await update(tree);

    const json = readJson(tree, 'tsconfig.json');
    expect(json.compilerOptions.ignoreDeprecations).toBe('6.0');
    expect(json.compilerOptions.strict).toBe(false);
    expect(json.compilerOptions.noUncheckedSideEffectImports).toBe(false);
    expect(json.compilerOptions.types).toEqual(['*']);
    expect(json.compilerOptions.esModuleInterop).toBe(false);
  });

  describe('strict-pin pass', () => {
    it('adds strict false to a chain root without an explicit strict key', async () => {
      tree.write(
        'tsconfig.json',
        JSON.stringify(
          {
            compilerOptions: { module: 'esnext', moduleResolution: 'bundler' },
          },
          null,
          2
        )
      );

      await update(tree);

      const json = readJson(tree, 'tsconfig.json');
      expect(json.compilerOptions.strict).toBe(false);
    });

    it('does not touch strict on a file that has "extends"', async () => {
      tree.write(
        'tsconfig.app.json',
        JSON.stringify(
          {
            extends: './tsconfig.json',
            compilerOptions: { module: 'esnext' },
          },
          null,
          2
        )
      );

      await update(tree);

      const json = readJson(tree, 'tsconfig.app.json');
      expect(json.compilerOptions.strict).toBeUndefined();
    });

    it('does not overwrite an explicit strict true', async () => {
      tree.write(
        'tsconfig.json',
        JSON.stringify(
          { compilerOptions: { strict: true, module: 'esnext' } },
          null,
          2
        )
      );

      await update(tree);

      const json = readJson(tree, 'tsconfig.json');
      expect(json.compilerOptions.strict).toBe(true);
    });

    it('does not overwrite an explicit strict false', async () => {
      tree.write(
        'tsconfig.json',
        JSON.stringify(
          { compilerOptions: { strict: false, module: 'esnext' } },
          null,
          2
        )
      );

      await update(tree);

      const json = readJson(tree, 'tsconfig.json');
      expect(json.compilerOptions.strict).toBe(false);
    });

    it('skips solution-style containers with files:[] and no include', async () => {
      tree.write(
        'tsconfig.json',
        JSON.stringify(
          {
            files: [],
            references: [{ path: './packages/a' }],
          },
          null,
          2
        )
      );

      await update(tree);

      const json = readJson(tree, 'tsconfig.json');
      // Pin skipped (solution container); the config-load flag is still set.
      expect(json.compilerOptions.strict).toBeUndefined();
      expect(json.compilerOptions.ignoreDeprecations).toBe('6.0');
    });

    it('adds compilerOptions.strict false when the block is missing', async () => {
      tree.write(
        'tsconfig.json',
        JSON.stringify({ include: ['src/**/*'] }, null, 2)
      );

      await update(tree);

      const json = readJson(tree, 'tsconfig.json');
      expect(json.compilerOptions.strict).toBe(false);
    });

    it('is idempotent for the strict-pin pass', async () => {
      tree.write(
        'tsconfig.json',
        JSON.stringify(
          {
            compilerOptions: { module: 'esnext', moduleResolution: 'bundler' },
          },
          null,
          2
        )
      );

      await update(tree);
      const afterFirst = tree.read('tsconfig.json', 'utf-8');
      await update(tree);
      const afterSecond = tree.read('tsconfig.json', 'utf-8');

      expect(afterSecond).toBe(afterFirst);
    });
  });

  describe('noUncheckedSideEffectImports-pin pass', () => {
    it('adds noUncheckedSideEffectImports false to a chain root without an explicit key', async () => {
      tree.write(
        'tsconfig.json',
        JSON.stringify(
          {
            compilerOptions: { module: 'esnext', moduleResolution: 'bundler' },
          },
          null,
          2
        )
      );

      await update(tree);

      const json = readJson(tree, 'tsconfig.json');
      expect(json.compilerOptions.noUncheckedSideEffectImports).toBe(false);
    });

    it('does not touch noUncheckedSideEffectImports on a file that has "extends"', async () => {
      tree.write(
        'tsconfig.app.json',
        JSON.stringify(
          {
            extends: './tsconfig.json',
            compilerOptions: { module: 'esnext' },
          },
          null,
          2
        )
      );

      await update(tree);

      const json = readJson(tree, 'tsconfig.app.json');
      expect(json.compilerOptions.noUncheckedSideEffectImports).toBeUndefined();
    });

    it('does not overwrite an explicit noUncheckedSideEffectImports true', async () => {
      tree.write(
        'tsconfig.json',
        JSON.stringify(
          {
            compilerOptions: {
              noUncheckedSideEffectImports: true,
              module: 'esnext',
            },
          },
          null,
          2
        )
      );

      await update(tree);

      const json = readJson(tree, 'tsconfig.json');
      expect(json.compilerOptions.noUncheckedSideEffectImports).toBe(true);
    });

    it('skips solution-style containers with files:[] and no include', async () => {
      tree.write(
        'tsconfig.json',
        JSON.stringify(
          {
            files: [],
            references: [{ path: './packages/a' }],
          },
          null,
          2
        )
      );

      await update(tree);

      const json = readJson(tree, 'tsconfig.json');
      // Pin skipped (solution container); the config-load flag is still set.
      expect(json.compilerOptions.noUncheckedSideEffectImports).toBeUndefined();
      expect(json.compilerOptions.ignoreDeprecations).toBe('6.0');
    });

    it('pins both strict and noUncheckedSideEffectImports on a bare chain root', async () => {
      tree.write(
        'tsconfig.json',
        JSON.stringify({ compilerOptions: {} }, null, 2)
      );

      await update(tree);

      const json = readJson(tree, 'tsconfig.json');
      expect(json.compilerOptions.strict).toBe(false);
      expect(json.compilerOptions.noUncheckedSideEffectImports).toBe(false);
    });
  });

  describe('types-pin pass', () => {
    it('adds types ["*"] to a chain root without an explicit types key', async () => {
      tree.write(
        'tsconfig.base.json',
        JSON.stringify(
          {
            compilerOptions: { module: 'esnext', moduleResolution: 'bundler' },
          },
          null,
          2
        )
      );

      await update(tree);

      const json = readJson(tree, 'tsconfig.base.json');
      expect(json.compilerOptions.types).toEqual(['*']);
    });

    it('does not touch types on a file that has "extends"', async () => {
      tree.write(
        'tsconfig.app.json',
        JSON.stringify(
          { extends: './tsconfig.json', compilerOptions: { module: 'esnext' } },
          null,
          2
        )
      );

      await update(tree);

      const json = readJson(tree, 'tsconfig.app.json');
      expect(json.compilerOptions.types).toBeUndefined();
    });

    it('does not overwrite an explicit types list', async () => {
      tree.write(
        'tsconfig.json',
        JSON.stringify(
          { compilerOptions: { types: ['node'], module: 'esnext' } },
          null,
          2
        )
      );

      await update(tree);

      const json = readJson(tree, 'tsconfig.json');
      expect(json.compilerOptions.types).toEqual(['node']);
    });

    it('does not overwrite an explicit empty types array (deliberate opt-out)', async () => {
      tree.write(
        'tsconfig.json',
        JSON.stringify(
          { compilerOptions: { types: [], module: 'esnext' } },
          null,
          2
        )
      );

      await update(tree);

      const json = readJson(tree, 'tsconfig.json');
      expect(json.compilerOptions.types).toEqual([]);
    });

    it('skips solution-style containers with files:[] and no include', async () => {
      tree.write(
        'tsconfig.json',
        JSON.stringify(
          { files: [], references: [{ path: './packages/a' }] },
          null,
          2
        )
      );

      await update(tree);

      const json = readJson(tree, 'tsconfig.json');
      // Pin skipped (solution container); the config-load flag is still set.
      expect(json.compilerOptions.types).toBeUndefined();
      expect(json.compilerOptions.ignoreDeprecations).toBe('6.0');
    });
  });

  describe('esModuleInterop-pin pass', () => {
    it('pins esModuleInterop false and silences it on a bare chain root', async () => {
      tree.write(
        'tsconfig.base.json',
        JSON.stringify(
          {
            compilerOptions: { module: 'esnext', moduleResolution: 'bundler' },
          },
          null,
          2
        )
      );

      await update(tree);

      const json = readJson(tree, 'tsconfig.base.json');
      // TS6's default is true; false preserves the pre-TS6 `import * as <cjs>`
      // call behavior, and the deprecation pass silences the now-deprecated
      // false value in the same run.
      expect(json.compilerOptions.esModuleInterop).toBe(false);
      expect(json.compilerOptions.ignoreDeprecations).toBe('6.0');
    });

    it('keeps an explicit esModuleInterop true but still ensures ignoreDeprecations', async () => {
      tree.write(
        'tsconfig.json',
        JSON.stringify(
          { compilerOptions: { esModuleInterop: true, module: 'esnext' } },
          null,
          2
        )
      );

      await update(tree);

      const json = readJson(tree, 'tsconfig.json');
      expect(json.compilerOptions.esModuleInterop).toBe(true);
      // tsconfig.json is a config-load target, so it always carries the flag
      // even with no deprecated value of its own.
      expect(json.compilerOptions.ignoreDeprecations).toBe('6.0');
    });

    it('does not touch esModuleInterop on a file that has "extends"', async () => {
      tree.write(
        'tsconfig.app.json',
        JSON.stringify(
          { extends: './tsconfig.json', compilerOptions: { module: 'esnext' } },
          null,
          2
        )
      );

      await update(tree);

      const json = readJson(tree, 'tsconfig.app.json');
      expect(json.compilerOptions.esModuleInterop).toBeUndefined();
    });
  });

  describe('config-load flag on tsconfig.json', () => {
    it('always flags a clean chain-root tsconfig.json but not a clean tsconfig.base.json', async () => {
      tree.write(
        'tsconfig.json',
        JSON.stringify(
          {
            compilerOptions: { module: 'esnext', moduleResolution: 'bundler' },
          },
          null,
          2
        )
      );
      tree.write(
        'tsconfig.base.json',
        JSON.stringify(
          {
            compilerOptions: {
              module: 'esnext',
              moduleResolution: 'bundler',
              esModuleInterop: true,
            },
          },
          null,
          2
        )
      );

      await update(tree);

      // tsconfig.json is an auto-load target -> flagged even with no deprecation.
      expect(
        readJson(tree, 'tsconfig.json').compilerOptions.ignoreDeprecations
      ).toBe('6.0');
      // tsconfig.base.json is not auto-loaded and carries no deprecated value.
      expect(
        readJson(tree, 'tsconfig.base.json').compilerOptions.ignoreDeprecations
      ).toBeUndefined();
    });

    it('flags a config-loading tsconfig.json directly without touching its clean base', async () => {
      // nx-console-shape base: NodeNext + esModuleInterop true carries no
      // deprecated value, so it is left clean (it is not an auto-load target).
      tree.write(
        'tsconfig.base.json',
        JSON.stringify(
          {
            compilerOptions: {
              module: 'nodenext',
              moduleResolution: 'nodenext',
              esModuleInterop: true,
            },
          },
          null,
          2
        )
      );
      // The auto-loaded name (jest/ts-node resolve this) gets the flag directly.
      tree.write(
        'apps/e2e/tsconfig.json',
        JSON.stringify(
          { extends: '../../tsconfig.base.json', files: [], include: [] },
          null,
          2
        )
      );

      await update(tree);

      // The base has no deprecated value and isn't auto-loaded, so no flag...
      expect(
        readJson(tree, 'tsconfig.base.json').compilerOptions.ignoreDeprecations
      ).toBeUndefined();
      // ...while the auto-loaded tsconfig.json carries it directly.
      expect(
        readJson(tree, 'apps/e2e/tsconfig.json').compilerOptions
          .ignoreDeprecations
      ).toBe('6.0');
    });

    it('does not re-flag a descendant that inherits the flag from tsconfig.json', async () => {
      tree.write(
        'apps/app/tsconfig.json',
        JSON.stringify(
          {
            compilerOptions: { module: 'esnext', moduleResolution: 'bundler' },
          },
          null,
          2
        )
      );
      // Sets a deprecated value directly but extends the flagged tsconfig.json,
      // so the inherited flag already silences it.
      tree.write(
        'apps/app/tsconfig.spec.json',
        JSON.stringify(
          {
            extends: './tsconfig.json',
            compilerOptions: { moduleResolution: 'node10' },
          },
          null,
          2
        )
      );

      await update(tree);

      expect(
        readJson(tree, 'apps/app/tsconfig.json').compilerOptions
          .ignoreDeprecations
      ).toBe('6.0');
      expect(
        readJson(tree, 'apps/app/tsconfig.spec.json').compilerOptions
          .ignoreDeprecations
      ).toBeUndefined();
    });

    it('flags a descendant whose deprecated value is not covered by an inherited flag', async () => {
      // Extends a clean base (no flag, no deprecated value), so the direct
      // node10 is not silenced by inheritance and must be flagged here.
      tree.write(
        'tsconfig.base.json',
        JSON.stringify(
          {
            compilerOptions: {
              module: 'nodenext',
              moduleResolution: 'nodenext',
              esModuleInterop: true,
            },
          },
          null,
          2
        )
      );
      tree.write(
        'apps/app/tsconfig.spec.json',
        JSON.stringify(
          {
            extends: '../../tsconfig.base.json',
            compilerOptions: { moduleResolution: 'node10' },
          },
          null,
          2
        )
      );

      await update(tree);

      expect(
        readJson(tree, 'apps/app/tsconfig.spec.json').compilerOptions
          .ignoreDeprecations
      ).toBe('6.0');
    });
  });

  describe('stale local flags under inheritance', () => {
    it('upgrades a stale local flag that overrides an inherited "6.0"', async () => {
      // The base is the auto-loaded tsconfig.json, so it gets "6.0". The spec
      // extends it but pins a local "5.0" that overrides the inherited flag;
      // paired with its own node10 it still errors on TS6, so it is upgraded.
      tree.write(
        'apps/app/tsconfig.json',
        JSON.stringify(
          {
            compilerOptions: { module: 'esnext', moduleResolution: 'bundler' },
          },
          null,
          2
        )
      );
      tree.write(
        'apps/app/tsconfig.spec.json',
        JSON.stringify(
          {
            extends: './tsconfig.json',
            compilerOptions: {
              moduleResolution: 'node10',
              ignoreDeprecations: '5.0',
            },
          },
          null,
          2
        )
      );

      await update(tree);

      expect(
        readJson(tree, 'apps/app/tsconfig.spec.json').compilerOptions
          .ignoreDeprecations
      ).toBe('6.0');
    });

    it('upgrades a stale local flag when the deprecated value is inherited', async () => {
      // The base carries node10 (and is flagged "6.0"). The spec has no
      // deprecated value of its own but pins a stale local "5.0"; node10 reaches
      // it through the merged config, so the "5.0" still errors and is upgraded.
      tree.write(
        'tsconfig.base.json',
        JSON.stringify(
          { compilerOptions: { moduleResolution: 'node10' } },
          null,
          2
        )
      );
      tree.write(
        'apps/app/tsconfig.spec.json',
        JSON.stringify(
          {
            extends: '../../tsconfig.base.json',
            compilerOptions: { ignoreDeprecations: '5.0' },
          },
          null,
          2
        )
      );

      await update(tree);

      expect(
        readJson(tree, 'apps/app/tsconfig.spec.json').compilerOptions
          .ignoreDeprecations
      ).toBe('6.0');
    });

    it('leaves a descendant that only inherits the flag untouched', async () => {
      // No local flag and no deprecated value of its own: the inherited "6.0"
      // already silences it, so it is not flagged again.
      tree.write(
        'apps/app/tsconfig.json',
        JSON.stringify(
          { compilerOptions: { moduleResolution: 'node10' } },
          null,
          2
        )
      );
      tree.write(
        'apps/app/tsconfig.spec.json',
        JSON.stringify(
          {
            extends: './tsconfig.json',
            compilerOptions: { moduleResolution: 'node10' },
          },
          null,
          2
        )
      );

      await update(tree);

      expect(
        readJson(tree, 'apps/app/tsconfig.spec.json').compilerOptions
          .ignoreDeprecations
      ).toBeUndefined();
    });

    it('upgrades the ts-node block when a local main flag lowers the inherited "6.0"', async () => {
      // The clean base is the auto-loaded tsconfig.json, so it gets "6.0". The
      // app pins a local main "5.0" that overrides the inherited "6.0"; ts-node
      // overlays that resolved main, so its own node10 is not silenced and the
      // ts-node block must be flagged even though the ancestor provides "6.0".
      tree.write(
        'apps/app/tsconfig.json',
        JSON.stringify(
          {
            compilerOptions: {
              module: 'nodenext',
              moduleResolution: 'nodenext',
              esModuleInterop: true,
            },
          },
          null,
          2
        )
      );
      tree.write(
        'apps/app/tsconfig.app.json',
        JSON.stringify(
          {
            extends: './tsconfig.json',
            compilerOptions: { ignoreDeprecations: '5.0' },
            'ts-node': { compilerOptions: { moduleResolution: 'node10' } },
          },
          null,
          2
        )
      );

      await update(tree);

      const json = readJson(tree, 'apps/app/tsconfig.app.json');
      expect(json.compilerOptions.ignoreDeprecations).toBe('5.0');
      expect(json['ts-node'].compilerOptions.ignoreDeprecations).toBe('6.0');
    });
  });

  describe('deprecated value inherited from a base this migration never edits', () => {
    it('flags a child whose deprecated value comes from a non-tsconfig-named base', async () => {
      // The base is not named "tsconfig*.json", so it is never collected or
      // edited. Its node10 reaches the child through the merged config, so the
      // child must carry the flag itself.
      tree.write(
        'libs/a/base.json',
        JSON.stringify(
          { compilerOptions: { moduleResolution: 'node10' } },
          null,
          2
        )
      );
      tree.write(
        'libs/a/tsconfig.app.json',
        JSON.stringify({ extends: './base.json', compilerOptions: {} }, null, 2)
      );

      await update(tree);

      // The base is left untouched...
      expect(
        readJson(tree, 'libs/a/base.json').compilerOptions.ignoreDeprecations
      ).toBeUndefined();
      // ...so the child carries the flag directly.
      expect(
        readJson(tree, 'libs/a/tsconfig.app.json').compilerOptions
          .ignoreDeprecations
      ).toBe('6.0');
    });

    it('creates a compilerOptions block to flag a child that only has "extends"', async () => {
      tree.write(
        'libs/a/base.json',
        JSON.stringify(
          { compilerOptions: { moduleResolution: 'node10' } },
          null,
          2
        )
      );
      // No compilerOptions block of its own, yet it inherits node10.
      tree.write(
        'libs/a/tsconfig.app.json',
        JSON.stringify({ extends: './base.json' }, null, 2)
      );

      await update(tree);

      expect(
        readJson(tree, 'libs/a/tsconfig.app.json').compilerOptions
          .ignoreDeprecations
      ).toBe('6.0');
    });

    it('flags a child that inherits a deprecated value through array-form "extends"', async () => {
      // TypeScript merges array "extends" left to right, later wins. base-b's
      // node10 overrides base-a's clean resolution, so the merged config is
      // deprecated and the child must carry the flag. Neither base is named
      // tsconfig*.json, so neither is collected or edited on its own.
      tree.write(
        'libs/a/base-a.json',
        JSON.stringify(
          { compilerOptions: { moduleResolution: 'bundler' } },
          null,
          2
        )
      );
      tree.write(
        'libs/a/base-b.json',
        JSON.stringify(
          { compilerOptions: { moduleResolution: 'node10' } },
          null,
          2
        )
      );
      tree.write(
        'libs/a/tsconfig.app.json',
        JSON.stringify(
          {
            extends: ['./base-a.json', './base-b.json'],
            compilerOptions: {},
          },
          null,
          2
        )
      );

      await update(tree);

      expect(
        readJson(tree, 'libs/a/tsconfig.app.json').compilerOptions
          .ignoreDeprecations
      ).toBe('6.0');
    });
  });
});
