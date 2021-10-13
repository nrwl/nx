import {
  formatFiles,
  getProjects,
  logger,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';

export default async function update(host: Tree) {
  const projects = getProjects(host);

  for (const [name, config] of projects.entries()) {
    if (config.targets.build.executor === '@nrwl/web:build') {
      let updated = false;
      if (config.targets.build?.configurations?.production?.budgets) {
        delete config.targets.build.configurations.production.budgets;
        updated = true;
      }
      if (config.targets.build.options.budgets) {
        delete config.targets.build.options.budgets;
        updated = true;
      }
      if (updated) {
        updateProjectConfiguration(host, name, config);
        logger.info(`NX Removed legacy budgets build options from "${name}"`);
      }
    }
  }

  await formatFiles(host);
}
