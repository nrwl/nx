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
    ['moduleResolution Node (case-insensitive)', { moduleResolution: 'Node' }],
    ['baseUrl', { baseUrl: '.' }],
    ['target es5', { target: 'es5' }],
    ['target ES5 (case-insensitive)', { target: 'ES5' }],
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
    tree.write(
      'tsconfig.json',
      JSON.stringify(
        { compilerOptions: { module: 'esnext', moduleResolution: 'bundler' } },
        null,
        2
      )
    );

    await update(tree);

    const json = readJson(tree, 'tsconfig.json');
    expect(json.compilerOptions.ignoreDeprecations).toBeUndefined();
  });

  it('skips files with no compilerOptions', async () => {
    tree.write('tsconfig.json', JSON.stringify({ files: [] }, null, 2));

    await update(tree);

    const json = readJson(tree, 'tsconfig.json');
    expect(json.compilerOptions).toBeUndefined();
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
    tree.write(
      'tsconfig.json',
      JSON.stringify(
        {
          compilerOptions: { module: 'esnext', moduleResolution: 'bundler' },
          'ts-node': { compilerOptions: { moduleResolution: 'node10' } },
        },
        null,
        2
      )
    );

    await update(tree);

    const json = readJson(tree, 'tsconfig.json');
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
    tree.write(
      'tsconfig.json',
      JSON.stringify({ compilerOptions: { alwaysStrict: true } }, null, 2)
    );

    await update(tree);

    const json = readJson(tree, 'tsconfig.json');
    expect(json.compilerOptions.ignoreDeprecations).toBeUndefined();
  });

  it('does not add ignoreDeprecations when downlevelIteration is absent', async () => {
    tree.write(
      'tsconfig.json',
      JSON.stringify(
        { compilerOptions: { module: 'esnext', moduleResolution: 'bundler' } },
        null,
        2
      )
    );

    await update(tree);

    const json = readJson(tree, 'tsconfig.json');
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
      expect(json.compilerOptions).toBeUndefined();
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
      expect(json.compilerOptions).toBeUndefined();
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
      expect(json.compilerOptions).toBeUndefined();
    });
  });
});
