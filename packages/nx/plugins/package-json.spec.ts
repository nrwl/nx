import '../src/internal-testing-utils/mock-fs';

import { join } from 'node:path';
import { vol } from 'memfs';
import { workspaceDataDirectory } from '../src/utils/cache-directory';
import { readJsonFile } from '../src/utils/fileutils';
import { setWorkspaceRoot } from '../src/utils/workspace-root';

const plugin = require('./package-json');

describe('nx-all-package-jsons-plugin', () => {
  const context = {
    workspaceRoot: '/root',
    nxJsonConfiguration: {},
    configFiles: [],
  } as any;

  beforeEach(() => {
    setWorkspaceRoot('/root');
    // Ensure deterministic package manager detection: without a lockfile the
    // detector falls back to npm_config_user_agent, which makes test output
    // depend on whoever invoked jest (npm vs pnpm vs yarn).
    vol.fromJSON({ 'package-lock.json': '{}' }, '/root');
  });

  afterEach(() => {
    vol.reset();
  });

  it('should attach workspace package dependency descriptors and keep the persisted cache clean', async () => {
    vol.fromJSON(
      {
        'package.json': JSON.stringify({ name: 'root' }),
        'packages/app/package.json': JSON.stringify({
          name: 'app',
          version: '1.0.0',
          dependencies: {
            'alias-lib': 'workspace:lib@*',
          },
        }),
        'packages/lib/package.json': JSON.stringify({
          name: 'lib',
          version: '1.0.0',
        }),
      },
      '/root'
    );

    const configFiles = [
      'packages/app/package.json',
      'packages/lib/package.json',
    ];
    const expectedPackageDependencies = {
      dependencies: {
        'alias-lib': {
          rawSpecifier: 'workspace:lib@*',
          requestedPackageName: 'lib',
        },
      },
    };

    const getAppProject = (results: any) => {
      const entry = results.find(
        ([f]: [string]) => f === 'packages/app/package.json'
      );
      return Object.values(entry[1].projects)[0] as any;
    };

    const firstRun = await plugin.createNodes[1](
      configFiles,
      undefined,
      context
    );
    expect(getAppProject(firstRun).metadata.js.packageDependencies).toEqual(
      expectedPackageDependencies
    );

    // this plugin persists its cache to disk; descriptors must not be baked
    // into the persisted entries
    const cacheOnDisk = readJsonFile<{ entries: Record<string, any> }>(
      join(workspaceDataDirectory, 'package-json.hash')
    );
    const persistedProjects = Object.values(cacheOnDisk.entries);
    expect(persistedProjects.length).toBeGreaterThan(0);
    for (const project of persistedProjects) {
      expect(project.metadata?.js?.packageDependencies).toBeUndefined();
    }

    // a run served from the persisted cache still attaches the descriptors
    const secondRun = await plugin.createNodes[1](
      configFiles,
      undefined,
      context
    );
    expect(getAppProject(secondRun).metadata.js.packageDependencies).toEqual(
      expectedPackageDependencies
    );
  });
});
