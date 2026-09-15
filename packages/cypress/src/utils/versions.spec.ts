import { updateJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  assertViteSupportsInstalledCypress,
  componentTestingVersions,
  cypressVersion,
  getInstalledCypressVersion,
  versions,
} from './versions';

function declareCypress(tree: Tree, version: string): void {
  declareDevDependency(tree, 'cypress', version);
}

function declareVite(tree: Tree, version: string): void {
  declareDevDependency(tree, 'vite', version);
}

function declareDevDependency(tree: Tree, name: string, version: string): void {
  updateJson(tree, 'package.json', (json) => {
    json.devDependencies = { ...json.devDependencies, [name]: version };
    return json;
  });
}

function installCypress(tree: Tree, version: string): void {
  tree.write(
    'node_modules/cypress/package.json',
    JSON.stringify({ name: 'cypress', version })
  );
}

describe('versions', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should return the latest versions when cypress is not declared', () => {
    expect(versions(tree).cypressVersion).toBe(cypressVersion);
    expect(cypressVersion).toMatch(/^\^16\./);
  });

  const compatibleVersions = {
    13: {
      cypressVersion: '^13.13.0',
      cypressViteDevServerVersion: '^2.2.1',
      cypressWebpackVersion: '^3.8.0',
      viteVersion: '~5.0.0',
    },
    14: {
      cypressVersion: '^14.2.1',
      cypressViteDevServerVersion: '^6.0.3',
      cypressWebpackVersion: '^4.0.2',
      viteVersion: '^6.0.0',
    },
    15: {
      cypressVersion: '^15.20.1',
      cypressViteDevServerVersion: '^7.3.1',
      cypressWebpackVersion: '^5.4.1',
      viteVersion: '^6.0.0',
    },
  };

  it.each([
    ['^13.13.0', 13],
    ['^14.2.1', 14],
    ['^15.20.1', 15],
  ] as const)(
    'should return the compatible versions for the declared cypress range %s',
    (range, major) => {
      declareCypress(tree, range);

      expect(versions(tree)).toMatchObject(compatibleVersions[major]);
    }
  );

  it.each([
    ['13.13.0', 13],
    ['14.2.1', 14],
    ['15.20.1', 15],
  ] as const)(
    'should return the compatible versions for the installed cypress %s',
    (installed, major) => {
      declareCypress(tree, `^${installed}`);
      installCypress(tree, installed);

      expect(versions(tree)).toMatchObject(compatibleVersions[major]);
    }
  );

  it('should use the installed cypress version when it satisfies a range spanning majors', () => {
    declareCypress(tree, '>=15.20.1 <17');
    installCypress(tree, '16.0.0');

    expect(versions(tree).cypressVersion).toBe(cypressVersion);
  });

  it.each(['latest', 'next'])(
    'should use the installed cypress version when cypress is declared as %s',
    (distTag) => {
      declareCypress(tree, distTag);
      installCypress(tree, '15.20.1');

      expect(versions(tree)).toMatchObject(compatibleVersions[15]);
    }
  );

  it('should keep the installed cypress version when it is the floor of a range spanning majors', () => {
    declareCypress(tree, '>=15.20.1 <17');
    installCypress(tree, '15.20.1');

    expect(versions(tree).cypressVersion).toBe('^15.20.1');
  });

  it.each([
    ['>=15.20.1 <17', cypressVersion],
    ['>=14 <16', '^15.20.1'],
    ['<16 >=14', '^15.20.1'],
    ['>=14 <15.10', '^15.20.1'],
    ['>=13 <14.5', '^14.2.1'],
  ])(
    'should resolve the range %s to the highest supported major it reaches when cypress is not installed',
    (range, expected) => {
      declareCypress(tree, range);

      expect(versions(tree).cypressVersion).toBe(expected);
    }
  );

  it.each(['>=15.8.0 <16', '<16 >=15.8.0'])(
    'should keep the floor of the range %s when it reaches no higher supported major and cypress is not installed',
    (range) => {
      declareCypress(tree, range);

      expect(getInstalledCypressVersion(tree)).toBe('15.8.0');
    }
  );

  it('should keep the latest versions when cypress is not declared and vite is below 8', () => {
    declareVite(tree, '^7.0.0');

    expect(versions(tree).cypressVersion).toBe(cypressVersion);
  });

  describe('componentTestingVersions', () => {
    it.each(['^7.0.0', '8.0.0-beta.1'])(
      'should return the cypress 15 versions for the vite bundler when cypress is not declared and vite is %s',
      (vite) => {
        declareVite(tree, vite);

        expect(componentTestingVersions(tree, 'vite')).toMatchObject(
          compatibleVersions[15]
        );
      }
    );

    it.each([
      ['the webpack bundler with vite 7', 'webpack', '^7.0.0'],
      ['no bundler with vite 7', undefined, '^7.0.0'],
      ['the vite bundler with vite 8', 'vite', '^8.0.0'],
      ['the vite bundler without vite', 'vite', null],
    ] as const)(
      'should return the latest versions for %s when cypress is not declared',
      (_, bundler, vite) => {
        if (vite) {
          declareVite(tree, vite);
        }

        expect(componentTestingVersions(tree, bundler).cypressVersion).toBe(
          cypressVersion
        );
      }
    );

    it('should follow the installed cypress for the vite bundler with vite 7', () => {
      declareCypress(tree, '^15.20.1');
      installCypress(tree, '15.20.1');
      declareVite(tree, '^7.0.0');

      expect(componentTestingVersions(tree, 'vite')).toMatchObject(
        compatibleVersions[15]
      );
    });
  });

  describe('assertViteSupportsInstalledCypress', () => {
    it.each([
      ['^7.0.0', '7.0.0'],
      ['8.0.0-beta.1', '8.0.0-beta.1'],
    ])('should reject cypress 16 with vite %s', (vite, found) => {
      declareCypress(tree, '^16.0.0');
      installCypress(tree, '16.0.0');
      declareVite(tree, vite);

      expect(() => assertViteSupportsInstalledCypress(tree)).toThrow(
        `Cypress 16 component testing requires Vite 8. Found Vite ${found}. Update Vite to 8 or use Cypress 15.`
      );
    });

    it.each([
      ['cypress 16 with vite 8', '16.0.0', '^8.0.0'],
      ['cypress 15 with vite 7', '15.20.1', '^7.0.0'],
      ['cypress 16 without vite', '16.0.0', null],
      ['no cypress with vite 7', null, '^7.0.0'],
    ])('should accept %s', (_, cypress, vite) => {
      if (cypress) {
        declareCypress(tree, `^${cypress}`);
        installCypress(tree, cypress);
      }
      if (vite) {
        declareVite(tree, vite);
      }

      expect(() => assertViteSupportsInstalledCypress(tree)).not.toThrow();
    });
  });
});
