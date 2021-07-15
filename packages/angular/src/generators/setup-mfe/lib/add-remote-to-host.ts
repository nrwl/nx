import type { Tree } from '@nrwl/devkit';
import type { Schema } from '../schema';

import { readProjectConfiguration } from '@nrwl/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import { ObjectLiteralExpression } from 'typescript';

export function addRemoteToHost(host: Tree, options: Schema) {
  if (options.mfeType === 'remote' && options.host) {
    const project = readProjectConfiguration(host, options.host);
    const hostWebpackPath =
      project.targets['build'].options.customWebpackConfig?.path;

    if (!hostWebpackPath || !host.exists(hostWebpackPath)) {
      throw new Error(
        `The selected host application, ${options.host}, does not contain a webpack.config.js. Are you sure it has been set up as a host application?`
      );
    }

    const hostWebpackConfig = host.read(hostWebpackPath, 'utf-8');
    const webpackAst = tsquery.ast(hostWebpackConfig);
    const mfRemotesNode = tsquery(
      webpackAst,
      'Identifier[name=remotes] ~ ObjectLiteralExpression',
      { visitAllChildren: true }
    )[0] as ObjectLiteralExpression;

    const endOfPropertiesPos = mfRemotesNode.properties.end;

    const updatedConfig = `${hostWebpackConfig.slice(0, endOfPropertiesPos)}
    \t\t${options.appName}: '${options.appName}@http://localhost:${
      options.port ?? 4200
    }/remoteEntry.js',${hostWebpackConfig.slice(endOfPropertiesPos)}`;

    host.write(hostWebpackPath, updatedConfig);
  }
}
