import { updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { getConvertToFlatConfigVersions, versions } from './versions';

describe('versions(tree)', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.ESLINT_USE_FLAT_CONFIG;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.ESLINT_USE_FLAT_CONFIG;
    } else {
      process.env.ESLINT_USE_FLAT_CONFIG = originalEnv;
    }
  });

  it('should return the latest ESLint stack for fresh installs', () => {
    const tree = createTreeWithEmptyWorkspace();
    delete process.env.ESLINT_USE_FLAT_CONFIG;

    expect(versions(tree).eslintVersion).toMatch(/^\^10\./);
  });

  it('should pin ESLint v9 for fresh installs when eslintrc is explicitly requested', () => {
    const tree = createTreeWithEmptyWorkspace();
    process.env.ESLINT_USE_FLAT_CONFIG = 'false';

    expect(versions(tree).eslintVersion).toMatch(/^\^9\./);
  });

  it('should pin ESLint v9 for fresh installs in a workspace with a root eslintrc', () => {
    const tree = createTreeWithEmptyWorkspace();
    delete process.env.ESLINT_USE_FLAT_CONFIG;
    tree.write('.eslintrc.json', '{}');

    expect(versions(tree).eslintVersion).toMatch(/^\^9\./);
  });

  it.each([
    ['Angular 20', { '@angular/core': '~20.3.0' }, /^\^9\./],
    ['Angular 20 as a range', { '@angular/core': '<21 >=20.0.0' }, /^\^9\./],
    ['Next.js 15', { next: '~15.2.4' }, /^\^9\./],
    ['Next.js 15 as a range', { next: '<16 >=15.0.0' }, /^\^9\./],
    [
      'Angular 21 and Next.js 16',
      { '@angular/core': '~21.0.0', next: '~16.0.0' },
      /^\^10\./,
    ],
    [
      'Angular 20 with ESLint 10 declared',
      { '@angular/core': '~20.3.0', eslint: '^10.0.0' },
      /^\^10\./,
    ],
    [
      'Angular 21 with angular-eslint 21.2.0',
      { '@angular/core': '~21.0.0', 'angular-eslint': '21.2.0' },
      /^\^9\./,
    ],
    [
      'Angular 21 with @angular-eslint/eslint-plugin 21.2.0',
      { '@angular/core': '~21.0.0', '@angular-eslint/eslint-plugin': '21.2.0' },
      /^\^9\./,
    ],
    [
      'Angular 21 with angular-eslint 21.3.0',
      { '@angular/core': '~21.0.0', 'angular-eslint': '21.3.0' },
      /^\^10\./,
    ],
    [
      'Next.js 16 with eslint-config-next 16.3.0',
      { next: '~16.1.0', 'eslint-config-next': '16.3.0' },
      /^\^9\./,
    ],
    [
      'Next.js 16 with eslint-config-next 16.4.0',
      { next: '~16.1.0', 'eslint-config-next': '16.4.0' },
      /^\^10\./,
    ],
    [
      'eslint-plugin-react-hooks 5.0.0',
      { 'eslint-plugin-react-hooks': '5.0.0' },
      /^\^9\./,
    ],
    [
      'eslint-plugin-react-hooks 7.1.0',
      { 'eslint-plugin-react-hooks': '7.1.0' },
      /^\^10\./,
    ],
    ['typescript-eslint 8.55.0', { 'typescript-eslint': '8.55.0' }, /^\^9\./],
    [
      '@typescript-eslint/parser 8.55.0',
      { '@typescript-eslint/parser': '8.55.0' },
      /^\^9\./,
    ],
    [
      'eslint-plugin-import-x 4.16.1',
      { 'eslint-plugin-import-x': '4.16.1' },
      /^\^9\./,
    ],
    ['eslint-plugin-vue 10.7.0', { 'eslint-plugin-vue': '10.7.0' }, /^\^9\./],
    [
      '@vue/eslint-config-typescript 14.6.0',
      { '@vue/eslint-config-typescript': '14.6.0' },
      /^\^9\./,
    ],
    [
      '@nuxt/eslint-config 1.14.0',
      { '@nuxt/eslint-config': '1.14.0' },
      /^\^9\./,
    ],
  ])('should pick the ESLint major for %s', (_, dependencies, expected) => {
    const tree = createTreeWithEmptyWorkspace();
    delete process.env.ESLINT_USE_FLAT_CONFIG;
    updateJson(tree, 'package.json', (json) => {
      json.dependencies = { ...json.dependencies, ...dependencies };
      return json;
    });

    expect(versions(tree).eslintVersion).toMatch(expected);
  });

  it('should throw when ESLint v10+ is installed and eslintrc is explicitly requested', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = { ...json.devDependencies, eslint: '10.0.0' };
      return json;
    });
    process.env.ESLINT_USE_FLAT_CONFIG = 'false';

    expect(() => versions(tree)).toThrow(
      /does not support the legacy "eslintrc" configuration format/
    );
  });
});

describe('getConvertToFlatConfigVersions(tree)', () => {
  it('should keep the ESLint v9 stack for a v9 workspace', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = { ...json.devDependencies, eslint: '^9.5.0' };
      return json;
    });

    expect(getConvertToFlatConfigVersions(tree).eslintVersion).toMatch(
      /^\^9\./
    );
  });

  it('should keep the ESLint v10 stack for a v10 workspace', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = { ...json.devDependencies, eslint: '10.0.0' };
      return json;
    });

    expect(getConvertToFlatConfigVersions(tree).eslintVersion).toMatch(
      /^\^10\./
    );
  });

  it('should default to the ESLint v9 stack when no ESLint is declared', () => {
    const tree = createTreeWithEmptyWorkspace();

    expect(getConvertToFlatConfigVersions(tree).eslintVersion).toMatch(
      /^\^9\./
    );
  });
});
