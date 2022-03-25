import type { SourceFile } from 'typescript';
import {
  getExposedModulesFromRemote,
  getRemotesFromHost,
  IsHostRemoteConfigResult,
} from './is-host-remote-config';

export function writeNewWebpackConfig(
  ast: SourceFile,
  mfType: IsHostRemoteConfigResult,
  projectName: string
) {
  const webpackConfig = `const { withModuleFederation } = require('@nrwl/angular/module-federation');
  const config = require('./mfe.config');
  module.exports = withModuleFederation(config);`;

  let mfeConfig = '';
  if (!mfType) {
    mfeConfig = `
        module.exports = {
          name: '${projectName}',
        };`;
  } else if (mfType === 'host') {
    const remotes = hostRemotesToString(ast);
    mfeConfig = `
        module.exports = {
          name: '${projectName}',
          remotes: ${remotes},
        };`;
  } else if (mfType === 'remote') {
    const exposedModules = getExposedModulesFromRemote(ast);
    mfeConfig = `
        module.exports = {
          name: '${projectName}',
          exposes: ${exposedModules},
        };`;
  } else if (mfType === 'both') {
    const remotes = hostRemotesToString(ast);
    const exposedModules = getExposedModulesFromRemote(ast);
    mfeConfig = `
    module.exports = {
      name: '${projectName}',
      remotes: ${remotes},
      exposes: ${exposedModules},
    };`;
  }

  return [webpackConfig, mfeConfig];
}

function hostRemotesToString(ast: SourceFile) {
  const remotes: string = getRemotesFromHost(ast)
    .reduce(
      (acc, remotePair) => `['${remotePair[0]}', '${remotePair[1]}'], ${acc}`,
      ''
    )
    .trim();
  return `[${remotes.endsWith(',') ? remotes.slice(0, -1) : remotes}]`;
}
