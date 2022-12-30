import {
  formatFiles,
  getProjects,
  logger,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';

const deprecatedOptions = ['showCircularDependencies', 'budgets'];

export default async function update(host: Tree) {
  const projects = getProjects(host);

  for (const [name, config] of projects.entries()) {
    if (config.targets.build.executor !== '@nrwl/web:build') return;

    for (const opt of deprecatedOptions) {
      let updated = false;
      if (
        typeof config.targets.build?.configurations?.production?.[opt] !==
        'undefined'
      ) {
        delete config.targets.build.configurations.production[opt];
        updated = true;
      }
      if (typeof config.targets.build.options[opt] !== 'undefined') {
        delete config.targets.build.options[opt];
        updated = true;
      }

      if (updated) {
        updateProjectConfiguration(host, name, config);
        logger.info(`NX Removed legacy build option from "${name}": ${opt}`);
      }
    }
  }

  await formatFiles(host);
}
