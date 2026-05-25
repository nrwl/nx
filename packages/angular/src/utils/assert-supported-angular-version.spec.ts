import { updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { assertSupportedAngularVersion } from './assert-supported-angular-version';

describe('assertSupportedAngularVersion', () => {
  it('throws when @angular/core is below the supported floor', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { '@angular/core': '~18.2.0' },
    }));

    expect(() => assertSupportedAngularVersion(tree)).toThrow(
      /Unsupported version of `@angular\/core` detected/
    );
  });

  it('does not throw when @angular/core is not installed (fresh-install path)', () => {
    const tree = createTreeWithEmptyWorkspace();
    expect(() => assertSupportedAngularVersion(tree)).not.toThrow();
  });

  it('does not throw when @angular/core is `latest`', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { '@angular/core': 'latest' },
    }));

    expect(() => assertSupportedAngularVersion(tree)).not.toThrow();
  });

  it('does not throw when @angular/core is `next`', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { '@angular/core': 'next' },
    }));

    expect(() => assertSupportedAngularVersion(tree)).not.toThrow();
  });

  it('does not throw when @angular/core is within the supported window', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { '@angular/core': '~19.2.0' },
    }));

    expect(() => assertSupportedAngularVersion(tree)).not.toThrow();
  });
});
