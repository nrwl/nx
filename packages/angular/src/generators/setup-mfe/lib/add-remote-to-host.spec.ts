import { tsquery } from '@phenomnomnominal/tsquery';
import type { ArrayLiteralExpression } from 'typescript';
import { checkIsCommaNeeded } from './add-remote-to-host';

describe('Add remote to host', () => {
  it('should add remote correctly even in multiline', () => {
    // ARRANGE
    const hostWebpackConfig = `const obj = {
            remotes: [
                'remote1',
                'remote2',
            ]
        }`;
    const webpackAst = tsquery.ast(hostWebpackConfig);
    const mfRemotesNode = tsquery(
      webpackAst,
      'Identifier[name=remotes] ~ ArrayLiteralExpression',
      { visitAllChildren: true }
    )[0] as ArrayLiteralExpression;

    const endOfPropertiesPos = mfRemotesNode.getEnd() - 1;

    // ACT
    const isCommaNeeded = checkIsCommaNeeded(mfRemotesNode.getText());

    const updatedConfig = `${hostWebpackConfig.slice(0, endOfPropertiesPos)}${
      isCommaNeeded ? ',' : ''
    }'remote3',${hostWebpackConfig.slice(endOfPropertiesPos)}`;

    // ASSERT
    expect(updatedConfig).toMatchSnapshot();
  });
});
