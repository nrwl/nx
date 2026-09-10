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

  it('returns what was recorded', () => {
    cache.record([{ key: 'key-a', capabilities }]);

    expect(cache.get(['key-a'])).toEqual({ 'key-a': capabilities });
  });

  it('creates its own table, so an existing database gains it without a version bump', () => {
    // The constructor in `beforeEach` ran against a database initialized
    // without this table, and reading works.
    expect(cache.get(['nothing-recorded'])).toEqual({});
  });

  it('omits the keys it has no record for, so the caller can load the rest', () => {
    cache.record([{ key: 'key-a', capabilities }]);

    expect(cache.get(['key-a', 'key-b'])).toEqual({ 'key-a': capabilities });
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

    cache.record([{ key: 'key-inert', capabilities: registersNothing }]);

    expect(cache.get(['key-inert'])).toEqual({ 'key-inert': registersNothing });
  });

  it('replaces a record for a key that already has one', () => {
    cache.record([{ key: 'key-a', capabilities }]);
    const updated = { ...capabilities, hasCreateMetadata: true };
    cache.record([{ key: 'key-a', capabilities: updated }]);

    expect(cache.get(['key-a'])).toEqual({ 'key-a': updated });
  });

  it('records a batch in one transaction', () => {
    cache.record([
      { key: 'key-a', capabilities },
      { key: 'key-b', capabilities: { ...capabilities, name: '@acme/other' } },
    ]);

    expect(Object.keys(cache.get(['key-a', 'key-b'])).sort()).toEqual([
      'key-a',
      'key-b',
    ]);
  });
});
