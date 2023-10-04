import { tsquery } from '@phenomnomnominal/tsquery';
import { checkSharedNpmPackagesMatchExpected } from './check-shared-npm-packages';

describe('checkSharedNpmPackagesMatchExpected', () => {
  it('should return true if all shared packages match the config object we expect', () => {
    // ARRANGE
    const sourceText = `module.exports = {
            plugins: [
                new ModuleFederationPlugin({
                    shared: share({
                        '@angular/core': {
                            singleton: true,
                            strictVersion: true,
                            requiredVersion: 'auto',
                            includeSecondaries: true
                        },
                        '@angular/common': {
                            singleton: true,
                            strictVersion: true,
                            requiredVersion: 'auto',
                            includeSecondaries: true
                        },
                        'rxjs': {
                            singleton: true,
                            strictVersion: true,
                            requiredVersion: 'auto',
                            includeSecondaries: true
                        },
                    })
                })
            ]
        }`;

    const ast = tsquery.ast(sourceText);

    // ACT
    const result = checkSharedNpmPackagesMatchExpected(ast);

    // ASSERT
    expect(result).toBeTruthy();
  });

  it('should return true if all shared packages match the config object we expect using object syntax', () => {
    // ARRANGE
    const sourceText = `module.exports = {
            plugins: [
                new ModuleFederationPlugin({
                    shared: {
                        '@angular/core': {
                            singleton: true,
                            strictVersion: true,
                        },
                        '@angular/common': {
                            singleton: true,
                            strictVersion: true,
                        },
                        'rxjs': {
                            singleton: true,
                            strictVersion: true,
                        },
                    }
                })
            ]
        }`;

    const ast = tsquery.ast(sourceText);

    // ACT
    const result = checkSharedNpmPackagesMatchExpected(ast);

    // ASSERT
    expect(result).toBeTruthy();
  });

  it('should return false if any shared packages do not match the config object we expect using object syntax', () => {
    // ARRANGE
    const sourceText = `module.exports = {
            plugins: [
                new ModuleFederationPlugin({
                    shared: {
                        '@angular/core': {
                            singleton: true,
                            strictVersion: true,
                        },
                        '@angular/common': {
                            singleton: true,
                            strictVersion: false,
                        },
                        'rxjs': {
                            singleton: true,
                            strictVersion: true,
                        },
                    }
                })
            ]
        }`;

    const ast = tsquery.ast(sourceText);

    // ACT
    const result = checkSharedNpmPackagesMatchExpected(ast);

    // ASSERT
    expect(result).toBeFalsy();
  });

  it('should return true if we arent sharing packages with the share helper', () => {
    // ARRANGE
    const sourceText = `module.exports = {
            plugins: [
                new ModuleFederationPlugin({
                    shared: share({})
                })
            ]
        }`;

    const ast = tsquery.ast(sourceText);

    // ACT
    const result = checkSharedNpmPackagesMatchExpected(ast);

    // ASSERT
    expect(result).toBeTruthy();
  });

  it('should return true if we arent sharing packages with the standard shared syntax', () => {
    // ARRANGE
    const sourceText = `module.exports = {
            plugins: [
                new ModuleFederationPlugin({
                    shared: {}
                })
            ]
        }`;

    const ast = tsquery.ast(sourceText);

    // ACT
    const result = checkSharedNpmPackagesMatchExpected(ast);

    // ASSERT
    expect(result).toBeTruthy();
  });

  it('should return false if any shared packages does not match the config object we expect', () => {
    // ARRANGE
    const sourceText = `module.exports = {
            plugins: [
                new ModuleFederationPlugin({
                    shared: share({
                        '@angular/core': {
                            singleton: true,
                            strictVersion: true,
                            requiredVersion: 'auto',
                            includeSecondaries: true
                        },
                        '@angular/common': {
                            singleton: true,
                            strictVersion: false,
                            requiredVersion: 'auto',
                            includeSecondaries: true
                        },
                        'rxjs': {
                            singleton: true,
                            strictVersion: true,
                            requiredVersion: 'auto',
                            includeSecondaries: true
                        },
                    })
                })
            ]
        }`;

    const ast = tsquery.ast(sourceText);

    // ACT
    const result = checkSharedNpmPackagesMatchExpected(ast);

    // ASSERT
    expect(result).toBeFalsy();
  });
});
