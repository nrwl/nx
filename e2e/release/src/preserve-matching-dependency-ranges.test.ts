import { NxJsonConfiguration } from '@nx/devkit';
import {
  cleanupProject,
  newProject,
  runCommandAsync,
  runCLI,
  tmpProjPath,
  uniq,
  updateJson,
  getPackageManagerCommand,
  detectPackageManager,
} from '@nx/e2e-utils';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { setupWorkspaces } from './utils';

expect.addSnapshotSerializer({
  serialize(str: string) {
    return (
      str
        // Remove all output unique to specific projects to ensure deterministic snapshots
        .replaceAll(/my-pkg-\d+/g, '{project-name}')
        .replaceAll(
          /integrity:\s*.*/g,
          'integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
        )
        .replaceAll(/\b[0-9a-f]{40}\b/g, '{SHASUM}')
        .replaceAll(/\d*B  index\.js/g, 'XXB  index.js')
        .replaceAll(/\d*B\s+project\.json/g, 'XXB project.json')
        .replaceAll(/\d*B\s+package\.json/g, 'XXXB package.json')
        .replaceAll(/size:\s*\d*\s?B/g, 'size: XXXB')
        .replaceAll(/\d*\.\d*\s?kB/g, 'XXX.XXX kb')
        .replaceAll(/\d*B\s+src\//g, 'XXB src/')
        .replaceAll(/\d*B\s+index/g, 'XXB index')
        .replaceAll(/total files:\s+\d*/g, 'total files: X')
        .replaceAll(/\d*B\s+README.md/g, 'XXB README.md')
        .replaceAll(/Test @[\w\d]+/g, 'Test @{COMMIT_AUTHOR}')
        .replaceAll(/(\w+) lock file/g, 'PM lock file')
        .replaceAll('NX   Updating PM lock file\n', '')
        // Normalize the version title date.
        .replaceAll(/\(\d{4}-\d{2}-\d{2}\)/g, '(YYYY-MM-DD)')
        // We trim each line to reduce the chances of snapshot flakiness
        // Slightly different handling needed for bun (length can be 8)
        .replaceAll(/[a-fA-F0-9]{7,8}/g, '{COMMIT_SHA}')
        .split('\n')
        .map((r) => r.trim())
        .filter(Boolean)
        .join('\n')
    );
  },
  test(val: string) {
    return val != null && typeof val === 'string';
  },
});

describe('nx release preserve matching dependency ranges', () => {
  let e2eRegistryUrl: string;

  beforeAll(() => {
    // This is the verdaccio instance that the e2e tests themselves are working from
    e2eRegistryUrl = execSync('npm config get registry').toString().trim();
  });

  afterEach(() => cleanupProject());

  /**
   * Initialize each test with a fresh workspace
   */
  const initializeProject = async () => {
    newProject({
      packages: ['@nx/js'],
    });

    const pkg1 = uniq('my-pkg-1');
    runCLI(`generate @nx/workspace:npm-package ${pkg1}`);
    const pkg2 = uniq('my-pkg-2');
    runCLI(`generate @nx/workspace:npm-package ${pkg2}`);
    const pkg3 = uniq('my-pkg-3');
    runCLI(`generate @nx/workspace:npm-package ${pkg3}`);

    setupWorkspaces(detectPackageManager(), pkg1, pkg2, pkg3);

    // Set up dependencies with various range types
    updateJson(join(pkg1, 'package.json'), (packageJson) => {
      packageJson.version = '1.0.0';
      packageJson.dependencies = {
        [`@proj/${pkg2}`]: '^1.0.0',
        [`@proj/${pkg3}`]: '~1.0.0',
      };
      packageJson.devDependencies = {
        [`@proj/${pkg2}`]: '^1.0.0',
      };
      return packageJson;
    });

    updateJson(join(pkg2, 'package.json'), (packageJson) => {
      packageJson.version = '1.0.0';
      packageJson.peerDependencies = {
        [`@proj/${pkg3}`]: '>=1.0.0 <2.0.0', // Range notation
      };
      return packageJson;
    });

    updateJson(join(pkg3, 'package.json'), (packageJson) => {
      packageJson.version = '1.0.0';
      packageJson.optionalDependencies = {
        [`@proj/${pkg1}`]: '^1.0.0',
      };
      return packageJson;
    });

    const pmc = getPackageManagerCommand();
    await runCommandAsync(pmc.install);

    // workaround for NXC-143
    runCLI('reset');

    return { workspacePath: tmpProjPath(), pkg1, pkg2, pkg3 };
  };

  describe('when preserveMatchingDependencyRanges is set to false', () => {
    it('should update all dependency ranges', async () => {
      const { workspacePath } = await initializeProject();

      updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
        nxJson.release = {
          version: {
            preserveMatchingDependencyRanges: false,
          },
        };
        return nxJson;
      });

      expect(
        runCLI(`release version 1.1.0`, {
          cwd: workspacePath,
        })
      ).toMatchInlineSnapshot(`
        NX   Running release version for project: {project-name}
        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied explicit semver value "1.1.0", from the given specifier, to get new version 1.1.0
        {project-name} ✍️  New version 1.1.0 written to manifest: {project-name}/package.json
        {project-name} ✍️  Updated 2 dependencies in manifest: {project-name}/package.json
        NX   Running release version for project: {project-name}
        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied version 1.1.0 directly, because the project is a member of a fixed release group containing {project-name}
        {project-name} ✍️  New version 1.1.0 written to manifest: {project-name}/package.json
        {project-name} ✍️  Updated 1 dependency in manifest: {project-name}/package.json
        NX   Running release version for project: {project-name}
        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied version 1.1.0 directly, because the project is a member of a fixed release group containing {project-name}
        {project-name} ✍️  New version 1.1.0 written to manifest: {project-name}/package.json
        {project-name} ✍️  Updated 1 dependency in manifest: {project-name}/package.json
        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "1.1.0",
        "exports": {
        "optionalDependencies": {
        -     "@proj/{project-name}": "^1.0.0"
        +     "@proj/{project-name}": "^1.1.0"
        }
        }
        +
        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "1.1.0",
        "exports": {
        "peerDependencies": {
        -     "@proj/{project-name}": ">=1.0.0 <2.0.0"
        +     "@proj/{project-name}": "1.1.0"
        }
        }
        +
        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "1.1.0",
        "exports": {
        "dependencies": {
        -     "@proj/{project-name}": "^1.0.0",
        -     "@proj/{project-name}": "~1.0.0"
        +     "@proj/{project-name}": "^1.1.0",
        +     "@proj/{project-name}": "~1.1.0"
        },
        "devDependencies": {
        -     "@proj/{project-name}": "^1.0.0"
        +     "@proj/{project-name}": "^1.1.0"
        }
        }
        +
        NX   Staging changed files with git
      `);
    });
  });

  describe('when preserveMatchingDependencyRanges is set to true', () => {
    it('should preserve dependency ranges when new version satisfies them', async () => {
      const { workspacePath, pkg1, pkg3 } = await initializeProject();
      updateJson(join(pkg1, 'package.json'), (packageJson) => {
        packageJson.dependencies[`@proj/${pkg3}`] = '^1.0.0';
        return packageJson;
      });

      updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
        nxJson.release = {
          version: {
            preserveMatchingDependencyRanges: true,
          },
        };
        return nxJson;
      });

      expect(
        runCLI(`release version 1.1.0`, {
          cwd: workspacePath,
        })
      ).toMatchInlineSnapshot(`
        NX   Running release version for project: {project-name}
        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied explicit semver value "1.1.0", from the given specifier, to get new version 1.1.0
        {project-name} ✍️  New version 1.1.0 written to manifest: {project-name}/package.json
        {project-name} ✍️  Updated 2 dependencies in manifest: {project-name}/package.json
        NX   Running release version for project: {project-name}
        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied version 1.1.0 directly, because the project is a member of a fixed release group containing {project-name}
        {project-name} ✍️  New version 1.1.0 written to manifest: {project-name}/package.json
        {project-name} ✍️  Updated 1 dependency in manifest: {project-name}/package.json
        NX   Running release version for project: {project-name}
        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied version 1.1.0 directly, because the project is a member of a fixed release group containing {project-name}
        {project-name} ✍️  New version 1.1.0 written to manifest: {project-name}/package.json
        {project-name} ✍️  Updated 1 dependency in manifest: {project-name}/package.json
        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "1.1.0",
        "exports": {
        }
        +
        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "1.1.0",
        "exports": {
        }
        +
        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "1.1.0",
        "exports": {
        }
        +
        NX   Staging changed files with git
      `);
    });
  });

  describe('when preserveMatchingDependencyRanges is set to specific dependency types', () => {
    it('should only preserve ranges for specified dependency types', async () => {
      const { workspacePath } = await initializeProject();

      updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
        nxJson.release = {
          version: {
            // Only preserve ranges for dependencies and devDependencies
            preserveMatchingDependencyRanges: [
              'dependencies',
              'devDependencies',
            ],
          },
        };
        return nxJson;
      });

      // Version to 1.0.1
      expect(
        runCLI(`release version patch`, {
          cwd: workspacePath,
        })
      ).toMatchInlineSnapshot(`
        NX   Running release version for project: {project-name}
        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied semver relative bump "patch", from the given specifier, to get new version 1.0.1
        {project-name} ✍️  New version 1.0.1 written to manifest: {project-name}/package.json
        {project-name} ✍️  Updated 2 dependencies in manifest: {project-name}/package.json
        NX   Running release version for project: {project-name}
        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied version 1.0.1 directly, because the project is a member of a fixed release group containing {project-name}
        {project-name} ✍️  New version 1.0.1 written to manifest: {project-name}/package.json
        {project-name} ✍️  Updated 1 dependency in manifest: {project-name}/package.json
        NX   Running release version for project: {project-name}
        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied version 1.0.1 directly, because the project is a member of a fixed release group containing {project-name}
        {project-name} ✍️  New version 1.0.1 written to manifest: {project-name}/package.json
        {project-name} ✍️  Updated 1 dependency in manifest: {project-name}/package.json
        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "1.0.1",
        "exports": {
        "optionalDependencies": {
        -     "@proj/{project-name}": "^1.0.0"
        +     "@proj/{project-name}": "^1.0.1"
        }
        }
        +
        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "1.0.1",
        "exports": {
        "peerDependencies": {
        -     "@proj/{project-name}": ">=1.0.0 <2.0.0"
        +     "@proj/{project-name}": "1.0.1"
        }
        }
        +
        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "1.0.1",
        "exports": {
        }
        +
        NX   Staging changed files with git
      `);
    });

    it('should handle empty array (no preservation)', async () => {
      const { workspacePath } = await initializeProject();

      updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
        nxJson.release = {
          version: {
            preserveMatchingDependencyRanges: [],
          },
        };
        return nxJson;
      });

      // Version to 1.1.0
      expect(
        runCLI(`release version minor`, {
          cwd: workspacePath,
        })
      ).toMatchInlineSnapshot(`
        NX   Running release version for project: {project-name}
        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied semver relative bump "minor", from the given specifier, to get new version 1.1.0
        {project-name} ✍️  New version 1.1.0 written to manifest: {project-name}/package.json
        {project-name} ✍️  Updated 2 dependencies in manifest: {project-name}/package.json
        NX   Running release version for project: {project-name}
        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied version 1.1.0 directly, because the project is a member of a fixed release group containing {project-name}
        {project-name} ✍️  New version 1.1.0 written to manifest: {project-name}/package.json
        {project-name} ✍️  Updated 1 dependency in manifest: {project-name}/package.json
        NX   Running release version for project: {project-name}
        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied version 1.1.0 directly, because the project is a member of a fixed release group containing {project-name}
        {project-name} ✍️  New version 1.1.0 written to manifest: {project-name}/package.json
        {project-name} ✍️  Updated 1 dependency in manifest: {project-name}/package.json
        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "1.1.0",
        "exports": {
        "optionalDependencies": {
        -     "@proj/{project-name}": "^1.0.0"
        +     "@proj/{project-name}": "^1.1.0"
        }
        }
        +
        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "1.1.0",
        "exports": {
        "peerDependencies": {
        -     "@proj/{project-name}": ">=1.0.0 <2.0.0"
        +     "@proj/{project-name}": "1.1.0"
        }
        }
        +
        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "1.1.0",
        "exports": {
        "dependencies": {
        -     "@proj/{project-name}": "^1.0.0",
        -     "@proj/{project-name}": "~1.0.0"
        +     "@proj/{project-name}": "^1.1.0",
        +     "@proj/{project-name}": "~1.1.0"
        },
        "devDependencies": {
        -     "@proj/{project-name}": "^1.0.0"
        +     "@proj/{project-name}": "^1.1.0"
        }
        }
        +
        NX   Staging changed files with git
      `);
    });
  });

  describe('with patch versions', () => {
    it('should preserve ranges when patch version satisfies them', async () => {
      const { workspacePath } = await initializeProject();

      updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
        nxJson.release = {
          version: {
            preserveMatchingDependencyRanges: true,
          },
        };
        return nxJson;
      });

      // Version to 1.0.1 (patch) - should satisfy all ranges (^1.0.0, ~1.0.0, >=1.0.0 <2.0.0)
      expect(
        runCLI(`release version patch`, {
          cwd: workspacePath,
        })
      ).toMatchInlineSnapshot(`
        NX   Running release version for project: {project-name}
        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied semver relative bump "patch", from the given specifier, to get new version 1.0.1
        {project-name} ✍️  New version 1.0.1 written to manifest: {project-name}/package.json
        {project-name} ✍️  Updated 2 dependencies in manifest: {project-name}/package.json
        NX   Running release version for project: {project-name}
        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied version 1.0.1 directly, because the project is a member of a fixed release group containing {project-name}
        {project-name} ✍️  New version 1.0.1 written to manifest: {project-name}/package.json
        {project-name} ✍️  Updated 1 dependency in manifest: {project-name}/package.json
        NX   Running release version for project: {project-name}
        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied version 1.0.1 directly, because the project is a member of a fixed release group containing {project-name}
        {project-name} ✍️  New version 1.0.1 written to manifest: {project-name}/package.json
        {project-name} ✍️  Updated 1 dependency in manifest: {project-name}/package.json
        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "1.0.1",
        "exports": {
        }
        +
        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "1.0.1",
        "exports": {
        }
        +
        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "1.0.1",
        "exports": {
        }
        +
        NX   Staging changed files with git
      `);
    });
  });

  describe('with exact version dependencies', () => {
    it('should always update exact version dependencies', async () => {
      const { workspacePath, pkg1, pkg2 } = await initializeProject();

      // Add exact version dependency
      updateJson(join(pkg1, 'package.json'), (packageJson) => {
        packageJson.dependencies = {
          [`@proj/${pkg2}`]: '1.0.0', // Exact version
        };
        return packageJson;
      });

      updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
        nxJson.release = {
          version: {
            preserveMatchingDependencyRanges: true,
          },
        };
        return nxJson;
      });

      // Version to 1.0.1
      expect(
        runCLI(`release version patch`, {
          cwd: workspacePath,
        })
      ).toMatchInlineSnapshot(`
        NX   Running release version for project: {project-name}
        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied semver relative bump "patch", from the given specifier, to get new version 1.0.1
        {project-name} ✍️  New version 1.0.1 written to manifest: {project-name}/package.json
        {project-name} ✍️  Updated 1 dependency in manifest: {project-name}/package.json
        NX   Running release version for project: {project-name}
        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied version 1.0.1 directly, because the project is a member of a fixed release group containing {project-name}
        {project-name} ✍️  New version 1.0.1 written to manifest: {project-name}/package.json
        {project-name} ✍️  Updated 1 dependency in manifest: {project-name}/package.json
        NX   Running release version for project: {project-name}
        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied version 1.0.1 directly, because the project is a member of a fixed release group containing {project-name}
        {project-name} ✍️  New version 1.0.1 written to manifest: {project-name}/package.json
        {project-name} ✍️  Updated 1 dependency in manifest: {project-name}/package.json
        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "1.0.1",
        "exports": {
        }
        +
        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "1.0.1",
        "exports": {
        }
        +
        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "1.0.1",
        "exports": {
        "dependencies": {
        -     "@proj/{project-name}": "1.0.0"
        +     "@proj/{project-name}": "1.0.1"
        },
        }
        +
        NX   Staging changed files with git
      `);
    });
  });

  describe('with wildcard ranges', () => {
    it('should preserve wildcard ranges', async () => {
      const { workspacePath, pkg1, pkg2, pkg3 } = await initializeProject();

      // Add wildcard dependency
      updateJson(join(pkg1, 'package.json'), (packageJson) => {
        packageJson.dependencies = {
          [`@proj/${pkg2}`]: '*',
        };
        packageJson.devDependencies = {};
        return packageJson;
      });
      updateJson(join(pkg2, 'package.json'), (packageJson) => {
        packageJson.dependencies = {};
        packageJson.devDependencies = {};
        packageJson.peerDependencies = {};
        packageJson.optionalDependencies = {};
        return packageJson;
      });
      updateJson(join(pkg3, 'package.json'), (packageJson) => {
        packageJson.dependencies = {};
        packageJson.devDependencies = {};
        packageJson.peerDependencies = {};
        packageJson.optionalDependencies = {};
        return packageJson;
      });

      updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
        nxJson.release = {
          version: {
            preserveMatchingDependencyRanges: true,
          },
        };
        return nxJson;
      });

      // Version to 2.0.0
      expect(
        runCLI(`release version major`, {
          cwd: workspacePath,
        })
      ).toMatchInlineSnapshot(`
        NX   Running release version for project: {project-name}
        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied semver relative bump "major", from the given specifier, to get new version 2.0.0
        {project-name} ✍️  New version 2.0.0 written to manifest: {project-name}/package.json
        {project-name} ✍️  Updated 1 dependency in manifest: {project-name}/package.json
        NX   Running release version for project: {project-name}
        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied version 2.0.0 directly, because the project is a member of a fixed release group containing {project-name}
        {project-name} ✍️  New version 2.0.0 written to manifest: {project-name}/package.json
        NX   Running release version for project: {project-name}
        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied version 2.0.0 directly, because the project is a member of a fixed release group containing {project-name}
        {project-name} ✍️  New version 2.0.0 written to manifest: {project-name}/package.json
        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "2.0.0",
        "exports": {
        }
        +
        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "2.0.0",
        "exports": {
        }
        +
        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "2.0.0",
        "exports": {
        }
        +
        NX   Staging changed files with git
      `);
    });
  });
});
