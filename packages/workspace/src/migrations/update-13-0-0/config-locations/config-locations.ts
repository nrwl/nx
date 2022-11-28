import {
  NxConfiguration,
  ProjectConfiguration,
  readJson,
  writeJson,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
  formatFiles,
} from '@nrwl/devkit';

export default async function update(host: Tree) {
  const nxConfig = readJson(host, 'nx.json') as NxConfiguration & {
    projects: Record<
      string,
      Pick<ProjectConfiguration, 'tags' | 'implicitDependencies'>
    > | null;
  };
  // updateProjectConfiguration automatically saves the project opts into workspace/project.json
  if (nxConfig.projects) {
    Object.entries(nxConfig.projects).forEach(([p, nxJsonConfig]) => {
      const configuration = readProjectConfiguration(host, p);
      configuration.tags ??= nxJsonConfig.tags;
      configuration.implicitDependencies ??= nxJsonConfig.implicitDependencies;
      updateProjectConfiguration(host, p, configuration);
    });
    delete nxConfig.projects;
  }

  writeJson(host, 'nx.json', nxConfig);
  await formatFiles(host); // format files handles moving config options to new spots.
}
