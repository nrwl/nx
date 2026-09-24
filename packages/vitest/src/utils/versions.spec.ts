import { updateJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { vitestCoverageV8Version, versions, vitestVersion } from './versions';

describe('versions', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  function setDevDependency(name: string, version: string): void {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies ??= {};
      json.devDependencies[name] = version;
      return json;
    });
  }

  it('should default to the latest versions when nothing is installed', () => {
    expect(versions(tree)).toEqual({
      vitestVersion,
      vitestCoverageV8Version,
      vitestCoverageIstanbulVersion: expect.any(String),
    });
  });

  it('should keep an installed vitest 3 workspace on vitest 3', () => {
    setDevDependency('vitest', '^3.2.0');

    expect(versions(tree).vitestVersion).toBe('^3.0.0');
    expect(versions(tree).vitestCoverageV8Version).toBe('^3.0.5');
  });

  it('should keep an installed vitest 4 workspace on vitest 4', () => {
    setDevDependency('vitest', '~4.1.0');

    expect(versions(tree).vitestVersion).toBe('^4.0.0');
    expect(versions(tree).vitestCoverageV8Version).toBe('^4.0.0');
  });

  it('should use the latest versions when the installed vitest is already 5', () => {
    setDevDependency('vitest', '~5.0.1');

    expect(versions(tree).vitestVersion).toBe(vitestVersion);
  });

  // Vitest 5 declares `vite: ^6.4.0 || ^7.0.0 || ^8.0.0`, vitest 4 declares
  // `^6.0.0 || ^7.0.0 || ^8.0.0`, and vitest 3 declares no vite peer at all.
  it.each(['^6.0.0', '~6.3.1'])(
    'should fall back to vitest 4 when vite %s is too old for vitest 5',
    (viteRange) => {
      setDevDependency('vite', viteRange);

      expect(versions(tree).vitestVersion).toBe('^4.0.0');
      expect(versions(tree).vitestCoverageV8Version).toBe('^4.0.0');
    }
  );

  it('should fall back to vitest 3 when vite 5 is too old for vitest 4', () => {
    setDevDependency('vite', '^5.0.0');

    expect(versions(tree).vitestVersion).toBe('^3.0.0');
    expect(versions(tree).vitestCoverageV8Version).toBe('^3.0.5');
  });

  it('should cap at vitest 4 when analog is installed, which has no v5 peer', () => {
    setDevDependency('vite', '^8.0.0');
    setDevDependency('@analogjs/vitest-angular', '~2.7.2');

    expect(versions(tree).vitestVersion).toBe('^4.0.0');
  });

  // The configuration generator adds analog in the same pass, so at selection
  // time it is not in package.json yet and only the framework says it is coming.
  it('should cap at vitest 4 for angular before analog reaches package.json', () => {
    setDevDependency('vite', '^8.0.0');

    expect(versions(tree, { uiFramework: 'angular' }).vitestVersion).toBe(
      '^4.0.0'
    );
    expect(
      versions(tree, { uiFramework: 'angular' }).vitestCoverageV8Version
    ).toBe('^4.0.0');
  });

  it('should not cap for a framework that has no such constraint', () => {
    setDevDependency('vite', '^8.0.0');

    expect(versions(tree, { uiFramework: 'react' }).vitestVersion).toBe(
      vitestVersion
    );
  });

  it('should honor a requested vite major that is not in package.json yet', () => {
    expect(versions(tree, { viteMajorVersion: 5 }).vitestVersion).toBe(
      '^3.0.0'
    );
    expect(versions(tree, { viteMajorVersion: 8 }).vitestVersion).toBe(
      vitestVersion
    );
  });

  it.each(['^6.4.0', '^7.0.0', '^8.0.0'])(
    'should use the latest versions when vite %s supports vitest 5',
    (viteRange) => {
      setDevDependency('vite', viteRange);

      expect(versions(tree).vitestVersion).toBe(vitestVersion);
    }
  );

  it('should let an installed vitest version win over the vite fallback', () => {
    setDevDependency('vite', '^6.0.0');
    setDevDependency('vitest', '^3.2.0');

    expect(versions(tree).vitestVersion).toBe('^3.0.0');
  });
});
