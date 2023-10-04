import { tsquery } from '@phenomnomnominal/tsquery';
import { writeNewWebpackConfig } from './write-new-webpack-config';

describe('writeNewWebpackConfig', () => {
  it('should convert host config correctly', () => {
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
    const result = writeNewWebpackConfig(ast, 'host', 'host1');

    // ASSERT
    expect(result).toMatchSnapshot();
  });

  it('should convert remote config correctly', () => {
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
    const result = writeNewWebpackConfig(ast, 'remote', 'remote1');

    // ASSERT
    expect(result).toMatchSnapshot();
  });

  it('should convert config that is both remote and host correctly', () => {
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
    const result = writeNewWebpackConfig(ast, 'both', 'both1');

    // ASSERT
    expect(result).toMatchSnapshot();
  });

  it('should convert config that is neither remote and host correctly', () => {
    // ARRANGE
    const sourceText = `module.exports = {
        plugins: [
            new ModuleFederationPlugin({})
        ]
    }`;

    const ast = tsquery.ast(sourceText);

    // ACT
    const result = writeNewWebpackConfig(ast, false, 'neither');

    // ASSERT
    expect(result).toMatchSnapshot();
  });
});
