import {
  isPnpmLockfileV13,
  normalizePnpmLockfileV13,
  selectPnpmLockfileV13ImporterReferences,
  stringifyPnpmLockfileV13,
} from './pnpm-v13';

describe('pnpm lockfile v13 adapter', () => {
  it('recognizes only major 13', () => {
    for (const version of ['13.0', 13, '13.1']) {
      expect(isPnpmLockfileV13({ lockfileVersion: version })).toBe(true);
    }
    for (const version of [9, '9.0', '130.0', '13oops', undefined]) {
      expect(isPnpmLockfileV13({ lockfileVersion: version })).toBe(false);
    }
  });

  it('normalizes omitted exact, catalog, alias and workspace versions', () => {
    const result = normalizePnpmLockfileV13({
      lockfileVersion: '13.0',
      settings: {
        autoInstallPeers: false,
        catalogs: { default: { alias: 'npm:real@2.0.0' } },
        patchedDependencies: { 'real@2.0.0': 'patch-hash' },
      },
      importers: {
        '.': {
          dependencies: {
            exact: '1.0.0',
            alias: 'catalog:',
            local: 'workspace:*',
          },
        },
        'libs/local': { name: 'local' },
      },
      packages: {
        'exact@1.0.0': { integrity: 'sha512-exact' },
        'real@2.0.0': { integrity: 'sha512-real' },
      },
    });
    expect(result.importers['.']).toMatchObject({
      specifiers: { exact: '1.0.0', alias: 'catalog:', local: 'workspace:*' },
      dependencies: {
        exact: '1.0.0',
        alias: 'real@2.0.0',
        local: 'link:libs/local',
      },
    });
    expect(result.packages['exact@1.0.0'].resolution).toEqual({
      integrity: 'sha512-exact',
    });
    expect(result.patchedDependencies).toEqual({ 'real@2.0.0': 'patch-hash' });
  });

  it('keeps distinct snapshot dependency closures and chooses inferred and explicit bindings', () => {
    const raw = peerFixture();
    const normalized = normalizePnpmLockfileV13(raw);
    const first = normalized.importers['.'].dependencies.plugin;
    const second = normalized.importers['other'].dependencies.plugin;
    expect(first).not.toBe(second);
    expect(normalized.packages[`plugin@${first}`].dependencies).toMatchObject({
      react: '18.0.0',
      leaf: '1.0.0',
    });
    expect(normalized.packages[`plugin@${second}`].dependencies).toMatchObject({
      react: '19.0.0',
      leaf: '2.0.0',
    });
    expect(first.split('(')[0]).toBe('1.0.0');
    const restored = normalizePnpmLockfileV13(
      stringifyPnpmLockfileV13(normalized)
    );
    expect(restored.importers['.'].dependencies.plugin).not.toBe(
      restored.importers.other.dependencies.plugin
    );
  });

  it('preserves selected hashed-peer bindings when pruning changes root scope', () => {
    const normalized = normalizePnpmLockfileV13(peerFixture());
    const ref = normalized.importers.other.dependencies.plugin;
    const selected = `plugin@${ref}`;
    const pruned = {
      ...normalized,
      importers: {
        '.': {
          specifiers: { plugin: '^1.0.0' },
          dependencies: { plugin: ref },
        },
      },
      packages: Object.fromEntries(
        Object.entries(normalized.packages).filter(
          ([key]) => !key.startsWith('plugin@') || key === selected
        )
      ),
    };
    const output = stringifyPnpmLockfileV13(pruned);
    expect(output.lockfileVersion).toBe('13.0');
    expect(output).not.toHaveProperty('snapshots');
    expect(output.projects['.'].dependencies.plugin).toEqual({
      specifier: '^1.0.0',
      version: '1.0.0',
      with: { react: '19.0.0' },
    });
    expect(
      output.packages['plugin@1.0.0'].peerDependencies.react
    ).toMatchObject({ version: '19.0.0', specifier: '*' });
    expect(output.packages['plugin@1.0.0'].dependencies.leaf).toBe('2.0.0');
  });

  it('keeps empty with, below and unbound peers and finite cyclic bindings', () => {
    const raw = {
      lockfileVersion: '13.0',
      importers: {
        '.': { dependencies: { a: { specifier: '1.0.0', with: {} } } },
      },
      packages: {
        'a@1.0.0': {
          integrity: 'sha512-a',
          peerDependencies: {
            b: { specifier: '*', version: '1.0.0', with: { a: '1.0.0' } },
            external: { version: '2.0.0', below: true },
          },
          unboundPeerDependencies: ['missing'],
        },
        'b@1.0.0': {
          integrity: 'sha512-b',
          peerDependencies: { a: { specifier: '*', version: '1.0.0' } },
        },
        'external@2.0.0': { integrity: 'sha512-external' },
      },
    };
    const normalized = normalizePnpmLockfileV13(raw);
    expect(normalized.packages['a@1.0.0'].dependencies.b).toBe('1.0.0');
    expect(normalized.packages['a@1.0.0'].dependencies).not.toHaveProperty(
      'external'
    );
    const output = stringifyPnpmLockfileV13(normalized);
    expect(output.projects['.'].dependencies.a.with).toEqual({});
    expect(output.packages['a@1.0.0'].peerDependencies.external).toEqual({
      version: '2.0.0',
      below: true,
    });
    expect(output.packages['a@1.0.0'].unboundPeerDependencies).toEqual([
      'missing',
    ]);
    expect(() => JSON.stringify(output)).not.toThrow();
  });

  it('recovers the source project variant after graph root mapping chooses the first key', () => {
    const normalized = normalizePnpmLockfileV13(peerFixture());
    const root = {
      specifiers: { plugin: '1.0.0', react: '19.0.0' },
      dependencies: {
        plugin: normalized.importers['.'].dependencies.plugin,
        react: '19.0.0',
      },
    };
    // Add an app scope whose inferred peers select the second plugin variant.
    const raw = peerFixture();
    const full = normalizePnpmLockfileV13({
      ...raw,
      importers: {
        ...raw.importers,
        other: {
          dependencies: {
            ...raw.importers.other.dependencies,
            react: '19.0.0',
          },
        },
      },
    });
    selectPnpmLockfileV13ImporterReferences(full, root);
    expect(root.dependencies.plugin).toBe(
      full.importers.other.dependencies.plugin
    );
    const output = stringifyPnpmLockfileV13({
      ...full,
      importers: { '.': root },
    });
    expect(output.projects['.'].dependencies.plugin).toMatchObject({
      with: { react: '19.0.0' },
    });
  });

  it('preserves the selected source importer explicit empty with across section promotion', () => {
    const raw = peerFixture();
    const normalized = normalizePnpmLockfileV13({
      ...raw,
      importers: {
        ...raw.importers,
        other: {
          dependencies: {
            plugin: { specifier: '1.0.0', with: {} },
            react: '19.0.0',
          },
        },
      },
    });
    const root = {
      specifiers: { plugin: '1.0.0', react: '19.0.0' },
      optionalDependencies: {
        plugin: normalized.importers['.'].dependencies.plugin,
      },
      dependencies: { react: '19.0.0' },
    };
    selectPnpmLockfileV13ImporterReferences(normalized, root);
    expect(root.optionalDependencies.plugin).toBe(
      normalized.importers.other.dependencies.plugin
    );
    const output = stringifyPnpmLockfileV13({
      ...normalized,
      importers: { '.': root },
    });
    expect(output.projects['.'].optionalDependencies.plugin).toEqual({
      specifier: '1.0.0',
      version: '1.0.0',
      with: {},
    });
  });

  it('leaves ambiguous mixed project dependencies and older lockfiles unchanged', () => {
    const normalized = normalizePnpmLockfileV13(peerFixture());
    const root = {
      specifiers: {},
      dependencies: {
        plugin: normalized.importers['.'].dependencies.plugin,
        unrelated: '4.0.0',
      },
    };
    const before = structuredClone(root);
    selectPnpmLockfileV13ImporterReferences(normalized, root);
    expect(root).toEqual(before);
    selectPnpmLockfileV13ImporterReferences(
      { ...normalized, lockfileVersion: 9 },
      root
    );
    expect(root).toEqual(before);
  });

  it('retains snapshot provenance when local file keys and peer refs relocate', () => {
    const normalized = normalizePnpmLockfileV13({
      lockfileVersion: '13.0',
      projects: {
        '.': {
          dependencies: {
            local: 'file:tarballs/local.tgz',
            provider: 'file:libs/provider',
          },
        },
      },
      packages: {
        'local@file:tarballs/local.tgz': {
          integrity: 'sha512-local',
          resolution: { tarball: 'file:tarballs/local.tgz' },
          specifiers: { dependencies: { provider: 'file:../provider' } },
          peerDependencies: {
            provider: { specifier: '*', version: 'file:libs/provider' },
          },
        },
        'provider@file:libs/provider': {},
      },
    });
    const local = normalized.packages['local@file:tarballs/local.tgz'];
    local.resolution = {
      tarball: 'file:local_path_modules/tarballs/local.tgz',
      integrity: 'sha512-local',
    };
    local.dependencies.provider = 'file:local_path_modules/libs/provider';
    normalized.packages = {
      'local@file:local_path_modules/tarballs/local.tgz': { ...local },
      'provider@file:local_path_modules/libs/provider': {
        ...normalized.packages['provider@file:libs/provider'],
        resolution: {
          type: 'directory',
          directory: 'local_path_modules/libs/provider',
        },
      },
    };
    normalized.importers['.'].dependencies.local =
      'file:local_path_modules/tarballs/local.tgz';
    normalized.importers['.'].dependencies.provider =
      'file:local_path_modules/libs/provider';
    const output = stringifyPnpmLockfileV13(normalized);
    const emitted =
      output.packages['local@file:local_path_modules/tarballs/local.tgz'];
    expect(emitted.integrity).toBe('sha512-local');
    expect(emitted.resolution).toEqual({
      tarball: 'file:local_path_modules/tarballs/local.tgz',
    });
    expect(emitted.specifiers).toEqual({
      dependencies: { provider: 'file:../provider' },
    });
    expect(emitted.peerDependencies.provider).toMatchObject({
      version: 'file:local_path_modules/libs/provider',
    });
    expect(output.projects['.'].dependencies.local).toMatchObject({
      with: { provider: 'file:local_path_modules/libs/provider' },
    });
  });

  it('distinguishes nested provider bindings and keeps ordinary aliases beside peer aliases', () => {
    const normalized = normalizePnpmLockfileV13({
      lockfileVersion: '13.0',
      projects: {
        '.': {
          dependencies: {
            consumer: {
              specifier: '1.0.0',
              with: {
                provider: { version: '1.0.0', with: { nested: '2.0.0' } },
              },
            },
          },
        },
      },
      packages: {
        'consumer@1.0.0': {
          integrity: 'sha512-consumer',
          peerDependencies: { provider: '*' },
          snapshots: [
            {
              peerDependencies: {
                provider: { version: '1.0.0', with: { nested: '1.0.0' } },
              },
              dependencies: { renamed: 'provider@1.0.0' },
            },
            {
              peerDependencies: {
                provider: { version: '1.0.0', with: { nested: '2.0.0' } },
              },
              dependencies: {
                renamed: {
                  version: 'provider@1.0.0',
                  with: { nested: '2.0.0' },
                },
              },
            },
          ],
        },
        'provider@1.0.0': {
          integrity: 'sha512-provider',
          peerDependencies: { nested: '*' },
          snapshots: [
            { peerDependencies: { nested: { version: '1.0.0' } } },
            { peerDependencies: { nested: { version: '2.0.0' } } },
          ],
        },
        'nested@1.0.0': { integrity: 'sha512-one' },
        'nested@2.0.0': { integrity: 'sha512-two' },
      },
    });
    const consumer =
      normalized.packages[
        `consumer@${normalized.importers['.'].dependencies.consumer}`
      ];
    expect(consumer.dependencies.provider).toBe('1.0.0(nx-v13-1)');
    expect(consumer.dependencies.renamed).toBe('provider@1.0.0(nx-v13-1)');
    const output = stringifyPnpmLockfileV13(normalized);
    expect(
      output.packages['consumer@1.0.0'].snapshots[1].dependencies.renamed
    ).toEqual({ version: 'provider@1.0.0', with: { nested: '2.0.0' } });
    expect(output.projects['.'].dependencies.consumer).toMatchObject({
      with: { provider: { version: '1.0.0', with: { nested: '2.0.0' } } },
    });
  });

  it('uses source order for empty with and infers self-provider scope', () => {
    const normalized = normalizePnpmLockfileV13({
      lockfileVersion: '13.0',
      projects: {
        '.': {
          dependencies: {
            core: '2.0.0',
            helper: { specifier: '1.0.0', with: {} },
          },
        },
      },
      packages: {
        'core@2.0.0': {
          integrity: 'sha512-core',
          dependencies: { helper: '1.0.0' },
        },
        'helper@1.0.0': {
          integrity: 'sha512-helper',
          peerDependencies: { core: '*' },
          snapshots: [
            { peerDependencies: { core: { version: '1.0.0' } } },
            { peerDependencies: { core: { version: '2.0.0' } } },
          ],
        },
        'core@1.0.0': { integrity: 'sha512-other' },
      },
    });
    expect(normalized.importers['.'].dependencies.helper).toBe(
      '1.0.0(nx-v13-0)'
    );
    expect(normalized.packages['core@2.0.0'].dependencies.helper).toBe(
      '1.0.0(nx-v13-1)'
    );
  });

  it('serializes copied workspace packages and does not restore stripped settings', () => {
    const normalized = normalizePnpmLockfileV13({
      lockfileVersion: '13.0',
      settings: {
        autoInstallPeers: false,
        overrides: { x: '1.0.0' },
        catalogs: { default: { x: '1.0.0' } },
        patchedDependencies: { x: 'hash' },
      },
      importers: { '.': {} },
      packages: {},
    });
    delete normalized.overrides;
    delete normalized.catalogs;
    delete normalized.patchedDependencies;
    normalized.packages['local@file:workspace_modules/local'] = {
      resolution: { type: 'directory', directory: 'workspace_modules/local' },
      dependencies: { missingOptional: '2.0.0' },
    };
    const output = stringifyPnpmLockfileV13(normalized);
    expect(output.settings).toEqual({ autoInstallPeers: false });
    expect(output.packages['local@file:workspace_modules/local']).toEqual({
      resolution: { type: 'directory', directory: 'workspace_modules/local' },
      dependencies: { missingOptional: '2.0.0' },
    });
  });
});

function peerFixture() {
  return {
    lockfileVersion: '13.0',
    settings: { peersSuffixMaxLength: 1 },
    importers: {
      '.': { dependencies: { plugin: '1.0.0', react: '18.0.0' } },
      other: {
        dependencies: {
          plugin: { specifier: '1.0.0', with: { react: '19.0.0' } },
        },
      },
    },
    packages: {
      'plugin@1.0.0': {
        integrity: 'sha512-plugin',
        peerDependencies: { react: '*' },
        snapshots: [
          {
            peerDependencies: { react: { version: '18.0.0' } },
            dependencies: { leaf: '1.0.0' },
          },
          {
            peerDependencies: { react: { version: '19.0.0' } },
            dependencies: { leaf: '2.0.0' },
          },
        ],
      },
      'react@18.0.0': { integrity: 'sha512-18' },
      'react@19.0.0': { integrity: 'sha512-19' },
      'leaf@1.0.0': { integrity: 'sha512-1' },
      'leaf@2.0.0': { integrity: 'sha512-2' },
    },
  };
}
