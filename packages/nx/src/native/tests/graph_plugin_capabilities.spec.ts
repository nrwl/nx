import { randomBytes } from 'crypto';
import { rmSync } from 'fs';
import { join } from 'path';

import { getDbConnection } from '../../utils/db-connection';
import { GraphPluginCapabilities } from '../index';

const dbOutputFolder = 'temp-db-graph-plugin-capabilities';

describe('GraphPluginCapabilities', () => {
  let store: GraphPluginCapabilities;

  const vite = {
    name: '@nx/vite/plugin',
    createNodesPattern: '**/vite.config.{js,ts}',
    hasCreateDependencies: false,
    hasCreateMetadata: false,
    hasPreTasksExecution: false,
    hasPostTasksExecution: false,
  };
  const hooks = {
    name: 'hooks-only',
    hasCreateDependencies: false,
    hasCreateMetadata: false,
    hasPreTasksExecution: true,
    hasPostTasksExecution: true,
  };

  beforeEach(() => {
    store = new GraphPluginCapabilities(
      getDbConnection({
        directory: join(__dirname, dbOutputFolder),
        dbName: `temp-db-${randomBytes(4).toString('hex')}`,
      })
    );
  });

  afterAll(() => {
    rmSync(join(__dirname, dbOutputFolder), { recursive: true, force: true });
  });

  it('returns what was recorded with the same graph, in order', () => {
    store.record(1_700_000_000_000, [vite, hooks]);

    expect(store.get(1_700_000_000_000)).toEqual([
      vite,
      expect.objectContaining({
        name: 'hooks-only',
        hasPreTasksExecution: true,
      }),
    ]);
    expect(store.get(1_700_000_000_000)[1].createNodesPattern).toBeFalsy();
  });

  it('answers nothing for a different graph', () => {
    store.record(1_700_000_000_000, [vite]);

    expect(store.get(1_700_000_000_001)).toBeNull();
  });

  it('keeps only the latest build', () => {
    store.record(1_700_000_000_000, [vite, hooks]);
    store.record(1_700_000_000_500, [vite]);

    expect(store.get(1_700_000_000_000)).toBeNull();
    expect(store.get(1_700_000_000_500)).toEqual([vite]);
  });

  it('answers nothing before anything is recorded', () => {
    expect(store.get(1_700_000_000_000)).toBeNull();
  });
});
