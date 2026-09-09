import { updateJson, writeJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { assertCypressComponentTestingSupport } from './assert-cypress-component-testing-support';

describe('assertCypressComponentTestingSupport', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  function setVersions(versions: Record<string, string>) {
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { ...json.dependencies, ...versions },
    }));
  }

  it('throws when Angular is 22.1 and Cypress is below 15.20.1', () => {
    setVersions({ '@angular/core': '~22.1.0', cypress: '15.20.0' });

    expect(() => assertCypressComponentTestingSupport(tree)).toThrow(
      /requires Cypress 15\.20\.1 or higher.*Found Cypress 15\.20\.0/
    );
  });

  it('throws when Angular is above 22.1 and Cypress is below 15.20.1', () => {
    setVersions({ '@angular/core': '~23.0.0', cypress: '15.20.0' });

    expect(() => assertCypressComponentTestingSupport(tree)).toThrow(
      /requires Cypress 15\.20\.1 or higher/
    );
  });

  it.each(['~15.17.0', '^14.0.0'])(
    'throws when the Cypress range `%s` can only resolve below 15.20.1',
    (cypress) => {
      setVersions({ '@angular/core': '~22.1.0', cypress });

      expect(() => assertCypressComponentTestingSupport(tree)).toThrow(
        /requires Cypress 15\.20\.1 or higher/
      );
    }
  );

  it.each(['^15.17.0', '^15.20.0', '^15.20.1', '^16.0.0'])(
    'does not throw when the Cypress range `%s` can resolve 15.20.1 or higher',
    (cypress) => {
      setVersions({ '@angular/core': '~22.1.0', cypress });

      expect(() => assertCypressComponentTestingSupport(tree)).not.toThrow();
    }
  );

  function installCypress(version: string) {
    writeJson(tree, 'node_modules/cypress/package.json', {
      name: 'cypress',
      version,
    });
  }

  it.each(['15.17.0', '15.20.0'])(
    'throws when the installed Cypress %s satisfies a range spanning the floor',
    (installed) => {
      setVersions({ '@angular/core': '~22.1.0', cypress: '>=15.0.0 <17' });
      installCypress(installed);

      expect(() => assertCypressComponentTestingSupport(tree)).toThrow(
        new RegExp(
          `requires Cypress 15\\.20\\.1 or higher.*Found Cypress ${installed}`
        )
      );
    }
  );

  it.each(['15.20.1', '16.0.0'])(
    'does not throw when the installed Cypress %s satisfies a range spanning the floor',
    (installed) => {
      setVersions({ '@angular/core': '~22.1.0', cypress: '>=15.0.0 <17' });
      installCypress(installed);

      expect(() => assertCypressComponentTestingSupport(tree)).not.toThrow();
    }
  );

  it('does not throw for a range spanning the floor when Cypress is not installed', () => {
    setVersions({ '@angular/core': '~22.1.0', cypress: '>=15.0.0 <17' });

    expect(() => assertCypressComponentTestingSupport(tree)).not.toThrow();
  });

  it('ignores an installed Cypress that does not satisfy the declared range', () => {
    setVersions({ '@angular/core': '~22.1.0', cypress: '^15.20.1' });
    installCypress('15.17.0');

    expect(() => assertCypressComponentTestingSupport(tree)).not.toThrow();
  });

  it('does not throw when Cypress is not installed and the version to install is supported', () => {
    setVersions({ '@angular/core': '~22.1.0' });

    expect(() => assertCypressComponentTestingSupport(tree)).not.toThrow();
  });

  it('does not throw when Angular is below 22.1', () => {
    setVersions({ '@angular/core': '~22.0.0', cypress: '15.20.0' });

    expect(() => assertCypressComponentTestingSupport(tree)).not.toThrow();
  });

  it('does not throw when Angular is not installed', () => {
    setVersions({ cypress: '15.20.0' });

    expect(() => assertCypressComponentTestingSupport(tree)).not.toThrow();
  });

  it.each(['latest', 'next'])(
    'does not throw when Angular is `%s`',
    (distTag) => {
      setVersions({ '@angular/core': distTag, cypress: '15.20.0' });

      expect(() => assertCypressComponentTestingSupport(tree)).not.toThrow();
    }
  );

  it.each(['latest', 'next'])(
    'does not throw when Cypress is `%s` and not installed',
    (distTag) => {
      setVersions({ '@angular/core': '~22.1.0', cypress: distTag });

      expect(() => assertCypressComponentTestingSupport(tree)).not.toThrow();
    }
  );

  it.each(['latest', 'next'])(
    'throws when Cypress is `%s` and the installed version is below 15.20.1',
    (distTag) => {
      setVersions({ '@angular/core': '~22.1.0', cypress: distTag });
      installCypress('15.17.0');

      expect(() => assertCypressComponentTestingSupport(tree)).toThrow(
        /requires Cypress 15\.20\.1 or higher.*Found Cypress 15\.17\.0/
      );
    }
  );

  it.each(['latest', 'next'])(
    'does not throw when Cypress is `%s` and the installed version meets 15.20.1',
    (distTag) => {
      setVersions({ '@angular/core': '~22.1.0', cypress: distTag });
      installCypress('16.0.0');

      expect(() => assertCypressComponentTestingSupport(tree)).not.toThrow();
    }
  );
});
