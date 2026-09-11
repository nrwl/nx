import { randomBytes } from 'crypto';
import { rmSync } from 'fs';
import { join } from 'path';

import { getDbConnection } from '../../utils/db-connection';
import { PluginCapabilitiesCache } from '../index';

const dbOutputFolder = 'temp-db-plugin-capabilities';

describe('PluginCapabilitiesCache', () => {
  let cache: PluginCapabilitiesCache;

  const capabilities = {
    name: '@acme/plugin',
    createNodesPattern: '**/*.config.ts',
    hasCreateDependencies: true,
    hasCreateMetadata: false,
    hasPreTasksExecution: false,
    hasPostTasksExecution: true,
  };

  beforeEach(() => {
    cache = new PluginCapabilitiesCache(
      getDbConnection({
        directory: join(__dirname, dbOutputFolder),
        dbName: `temp-db-${randomBytes(4).toString('hex')}`,
      })
    );
  });

  afterAll(() => {
    rmSync(join(__dirname, dbOutputFolder), { recursive: true, force: true });
  });

  function recordFor(caps = capabilities, sourceFiles = ['libs/p/index.js']) {
    return { capabilities: caps, sourceFiles, sourceHash: 'hash-of-sources' };
  }

  it('returns what was recorded, sources and all', () => {
    cache.record([{ key: 'key-a', record: recordFor() }]);

    expect(cache.get(['key-a'])).toEqual({ 'key-a': recordFor() });
  });

  it('round-trips a multi-file closure in order', () => {
    const files = ['libs/p/index.js', 'libs/shared/hooks.js', 'tools/gen.js'];
    cache.record([
      { key: 'key-multi', record: recordFor(capabilities, files) },
    ]);

    // Order is part of the hash, so it has to survive storage.
    expect(cache.get(['key-multi'])['key-multi'].sourceFiles).toEqual(files);
  });

  it('round-trips an empty closure as empty rather than as one blank path', () => {
    cache.record([{ key: 'key-vendor', record: recordFor(capabilities, []) }]);

    expect(cache.get(['key-vendor'])['key-vendor'].sourceFiles).toEqual([]);
  });

  it('creates its own table, so an existing database gains it without a version bump', () => {
    // The constructor in `beforeEach` ran against a database initialized
    // without this table, and reading works.
    expect(cache.get(['nothing-recorded'])).toEqual({});
  });

  it('omits the keys it has no record for, so the caller can load the rest', () => {
    cache.record([{ key: 'key-a', record: recordFor() }]);

    expect(cache.get(['key-a', 'key-b'])).toEqual({ 'key-a': recordFor() });
  });

  it('keeps a plugin that registers nothing distinguishable from an absent record', () => {
    const registersNothing = {
      name: '@acme/inert',
      createNodesPattern: undefined,
      hasCreateDependencies: false,
      hasCreateMetadata: false,
      hasPreTasksExecution: false,
      hasPostTasksExecution: false,
    };

    cache.record([{ key: 'key-inert', record: recordFor(registersNothing) }]);

    expect(cache.get(['key-inert'])['key-inert'].capabilities).toEqual(
      registersNothing
    );
  });

  it('replaces a record for a key that already has one', () => {
    cache.record([{ key: 'key-a', record: recordFor() }]);
    const updated = { ...capabilities, hasCreateMetadata: true };
    cache.record([{ key: 'key-a', record: recordFor(updated) }]);

    expect(cache.get(['key-a'])['key-a'].capabilities).toEqual(updated);
  });

  it('records a batch in one transaction', () => {
    cache.record([
      { key: 'key-a', record: recordFor() },
      {
        key: 'key-b',
        record: recordFor({ ...capabilities, name: '@acme/other' }),
      },
    ]);

    expect(Object.keys(cache.get(['key-a', 'key-b'])).sort()).toEqual([
      'key-a',
      'key-b',
    ]);
  });

  it('writes one row for a module two nx.json entries name', () => {
    const updated = { ...capabilities, hasCreateMetadata: true };

    // Both entries resolve to one module, so both carry one key.
    cache.record([
      { key: 'key-a', record: recordFor() },
      { key: 'key-a', record: recordFor(updated) },
    ]);

    expect(cache.get(['key-a'])['key-a'].capabilities).toEqual(updated);
  });

  it('drops a record so the next run asks the plugin instead', () => {
    cache.record([
      { key: 'key-a', record: recordFor() },
      {
        key: 'key-b',
        record: recordFor({ ...capabilities, name: '@acme/other' }),
      },
    ]);

    cache.remove(['key-a']);

    expect(Object.keys(cache.get(['key-a', 'key-b']))).toEqual(['key-b']);
  });
});
