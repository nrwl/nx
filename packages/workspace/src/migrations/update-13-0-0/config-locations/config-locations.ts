import {
  NxJsonConfiguration,
  ProjectConfiguration,
  readJson,
  writeJson,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
  formatFiles,
} from '@nrwl/devkit';

export default async function update(host: Tree) {
  const nxJson = readJson(host, 'nx.json') as NxJsonConfiguration & {
    projects: Record<
      string,
      Pick<ProjectConfiguration, 'tags' | 'implicitDependencies'>
    >;
  };
  // updateProjectConfiguration automatically saves the project opts into workspace/project.json
  Object.entries(nxJson.projects).forEach(([p, nxJsonConfig]) => {
    const configuration = readProjectConfiguration(host, p);
    configuration.tags ??= nxJsonConfig.tags;
    configuration.implicitDependencies ??= nxJsonConfig.implicitDependencies;
    updateProjectConfiguration(host, p, configuration);
  });

  delete nxJson.projects;

  writeJson(host, 'nx.json', nxJson);
  await formatFiles(host); // format files handles moving config options to new spots.
}
