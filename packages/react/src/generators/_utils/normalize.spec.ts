import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  getDefaultPort,
  normalizeScaffoldOptions,
  toFederationName,
} from './normalize';

describe('toFederationName', () => {
  it('passes simple identifiers through', () => {
    expect(toFederationName('myapp')).toBe('myapp');
  });

  it('converts hyphens to underscores', () => {
    expect(toFederationName('my-app')).toBe('my_app');
  });

  it('strips disallowed characters', () => {
    expect(toFederationName('my.app@v1')).toBe('myappv1');
  });

  it('throws when result would be empty', () => {
    expect(() => toFederationName('---')).toThrow(/Cannot derive/);
  });

  it('throws when result starts with a digit', () => {
    expect(() => toFederationName('1-app')).toThrow(
      /cannot start with a digit/
    );
  });
});

describe('getDefaultPort', () => {
  it.each([
    ['vite', 'consumer', 5100],
    ['vite', 'provider', 5101],
    ['rsbuild', 'consumer', 3100],
    ['rsbuild', 'provider', 3101],
    ['rspack', 'consumer', 8100],
    ['rspack', 'provider', 8101],
  ] as const)(
    'defaults %s %s to %i (provider = consumer base + 1 so they do not collide)',
    (bundler, surface, expected) => {
      expect(getDefaultPort(bundler, surface)).toBe(expected);
    }
  );
});

describe('normalizeScaffoldOptions', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('infers project name + root from a positional directory path', async () => {
    const opts = await normalizeScaffoldOptions(tree, {
      directory: 'apps/shop',
      surface: 'consumer',
    });
    expect(opts).toMatchInlineSnapshot(`
      {
        "bundler": "vite",
        "federationName": "shop",
        "port": 5100,
        "projectName": "shop",
        "projectRoot": "apps/shop",
      }
    `);
  });

  it('defaults provider port to consumer port + 1 so a workspace can spin up both without override', async () => {
    const opts = await normalizeScaffoldOptions(tree, {
      directory: 'apps/shop',
      surface: 'provider',
    });
    expect(opts.port).toBe(5101);
  });

  it('coerces hyphenated names into a federation identifier', async () => {
    const opts = await normalizeScaffoldOptions(tree, {
      directory: 'apps/product-catalog',
      surface: 'provider',
      bundler: 'rspack',
    });
    expect(opts).toMatchInlineSnapshot(`
      {
        "bundler": "rspack",
        "federationName": "product_catalog",
        "port": 8101,
        "projectName": "product-catalog",
        "projectRoot": "apps/product-catalog",
      }
    `);
  });

  it('honours an explicit port override', async () => {
    const opts = await normalizeScaffoldOptions(tree, {
      directory: 'apps/shell',
      surface: 'consumer',
      bundler: 'rsbuild',
      port: 4321,
    });
    expect(opts.port).toBe(4321);
  });
});
