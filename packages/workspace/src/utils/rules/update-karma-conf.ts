import {
  Rule,
  Tree,
  SchematicContext,
  SchematicsException,
} from '@angular-devkit/schematics';
import { offsetFromRoot } from '../common';
import { createOrUpdate, getProjectConfig } from '../ast-utils';

/**
 * This returns a Rule which changes the default Angular CLI Generated karma.conf.js
 * @param options Object containing projectROot
 * @throws {SchematicsException}
 */
export function updateKarmaConf(options: { projectName: string }): Rule {
  return (host: Tree, context: SchematicContext) => {
    const project = getProjectConfig(host, options.projectName);
    const projectRoot = project.root.replace(/\/$/, '');
    const karmaPath = project.architect.test.options?.karmaConfig;

    if (!karmaPath) {
      throw new SchematicsException(`karmaConfig is missing!`);
    }

    createOrUpdate(
      host,
      karmaPath as string,
      `// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

const { join } = require('path');
const getBaseKarmaConfig = require('${offsetFromRoot(projectRoot)}karma.conf');

module.exports = function(config) {
  const baseConfig = getBaseKarmaConfig();
  config.set({
    ...baseConfig,
    coverageIstanbulReporter: {
      ...baseConfig.coverageIstanbulReporter,
      dir: join(__dirname, '${offsetFromRoot(
        projectRoot
      )}coverage/${projectRoot}')
    }
  });
};
`
    );
    return host;
  };
}
