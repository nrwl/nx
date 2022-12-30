import {
  formatFiles,
  getProjects,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';

/*
 * This migration ensures that the previous behavior of applying the app postcss config
 * is carried over to Nx 13.8.0.
 */
export default async function update(host: Tree) {
  const projects = getProjects(host);

  for (const [name, config] of projects.entries()) {
    if (config?.targets?.build?.executor !== '@nrwl/web:webpack') continue;
    const configPath = `${config.root}/postcss.config.js`;

    if (host.exists(configPath)) {
      config.targets.build.options.postcssConfig = configPath;
    }

    updateProjectConfiguration(host, name, config);
  }

  await formatFiles(host);
}
