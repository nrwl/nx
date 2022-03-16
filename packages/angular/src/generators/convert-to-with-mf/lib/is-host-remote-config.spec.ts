import { tsquery } from '@phenomnomnominal/tsquery';
import {
  isHostRemoteConfig,
  getRemotesFromHost,
  getExposedModulesFromRemote,
} from './is-host-remote-config';

describe('isHostRemoteConfig', () => {
  it('should return host when correct host config found', () => {
    // ARRANGE
    const sourceText = `module.exports = {
            plugins: [
                new ModuleFederationPlugin({
                    remotes: {
                        remote1: 'http://localhost:4201/remoteEntry.mjs'
                    }
                })
            ]
        }`;

    const ast = tsquery.ast(sourceText);

    // ACT
    const result = isHostRemoteConfig(ast);

    // ASSERT
    expect(result).toEqual('host');
  });

  it('should return remote when correct remote config found', () => {
    // ARRANGE
    const sourceText = `module.exports = {
            plugins: [
                new ModuleFederationPlugin({
                    exposes: {
                        './Module': 'apps/remote1/src/app/remote-entry/entry.module.ts'
                    }
                })
            ]
        }`;

    const ast = tsquery.ast(sourceText);

    // ACT
    const result = isHostRemoteConfig(ast);

    // ASSERT
    expect(result).toEqual('remote');
  });

  it('should return both when correct remote and host config found', () => {
    // ARRANGE
    const sourceText = `module.exports = {
            plugins: [
                new ModuleFederationPlugin({
                    remotes: {
                        remote1: 'http://localhost:4201/remoteEntry.mjs'
                    },
                    exposes: {
                        './Module': 'apps/both/src/app/remote-entry/entry.module.ts'
                    }
                })
            ]
        }`;

    const ast = tsquery.ast(sourceText);

    // ACT
    const result = isHostRemoteConfig(ast);

    // ASSERT
    expect(result).toEqual('both');
  });

  it('should return false when no valid config found', () => {
    // ARRANGE
    const sourceText = `module.exports = {
            plugins: [
                new ModuleFederationPlugin({
                })
            ]
        }`;

    const ast = tsquery.ast(sourceText);

    // ACT
    const result = isHostRemoteConfig(ast);

    // ASSERT
    expect(result).toBeFalsy();
  });

  it('should return remotes from the host correctly', () => {
    // ARRANGE
    const sourceText = `module.exports = {
            plugins: [
                new ModuleFederationPlugin({
                    remotes: {
                        remote1: 'http://localhost:4201/remoteEntry.mjs'
                    }
                })
            ]
        }`;

    const ast = tsquery.ast(sourceText);

    // ACT
    const result = getRemotesFromHost(ast);

    // ASSERT
    expect(result).toEqual([['remote1', 'http://localhost:4201']]);
  });

  it('should return remote when correct remote config found', () => {
    // ARRANGE
    const sourceText = `module.exports = {
            plugins: [
                new ModuleFederationPlugin({
                    exposes: {
                        './Module': 'apps/remote1/src/app/remote-entry/entry.module.ts'
                    }
                })
            ]
        }`;

    const ast = tsquery.ast(sourceText);

    // ACT
    const result = getExposedModulesFromRemote(ast);

    // ASSERT
    // this needs to be snapshot because prettier formats a literal string incorrectly, causing test failure
    expect(result).toMatchSnapshot();
  });
});
