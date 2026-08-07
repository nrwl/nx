import { updateJson, type Tree } from '@nx/devkit';
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

  it('throws when Angular is 22.1 and Cypress is below 16', () => {
    setVersions({ '@angular/core': '~22.1.0', cypress: '^15.17.0' });

    expect(() => assertCypressComponentTestingSupport(tree)).toThrow(
      /doesn't support Angular 22\.1 and higher for Cypress version 15\.17\.0/
    );
  });

  it('throws when Angular is above 22.1 and Cypress is below 16', () => {
    setVersions({ '@angular/core': '~23.0.0', cypress: '^15.17.0' });

    expect(() => assertCypressComponentTestingSupport(tree)).toThrow(
      /doesn't support Angular 22\.1 and higher/
    );
  });

  it('throws when Cypress is not installed, since the version to install is below 16', () => {
    setVersions({ '@angular/core': '~22.1.0' });

    expect(() => assertCypressComponentTestingSupport(tree)).toThrow(
      /doesn't support Angular 22\.1 and higher/
    );
  });

  it('does not throw when Angular is below 22.1', () => {
    setVersions({ '@angular/core': '~22.0.0', cypress: '^15.17.0' });

    expect(() => assertCypressComponentTestingSupport(tree)).not.toThrow();
  });

  it('does not throw when Cypress is 16 or higher', () => {
    setVersions({ '@angular/core': '~22.1.0', cypress: '^16.0.0' });

    expect(() => assertCypressComponentTestingSupport(tree)).not.toThrow();
  });

  it('does not throw when Angular is not installed', () => {
    setVersions({ cypress: '^15.17.0' });

    expect(() => assertCypressComponentTestingSupport(tree)).not.toThrow();
  });

  it.each(['latest', 'next'])(
    'does not throw when Angular is `%s`',
    (distTag) => {
      setVersions({ '@angular/core': distTag, cypress: '^15.17.0' });

      expect(() => assertCypressComponentTestingSupport(tree)).not.toThrow();
    }
  );

  it.each(['latest', 'next'])(
    'does not throw when Cypress is `%s`',
    (distTag) => {
      setVersions({ '@angular/core': '~22.1.0', cypress: distTag });

      expect(() => assertCypressComponentTestingSupport(tree)).not.toThrow();
    }
  );
});
