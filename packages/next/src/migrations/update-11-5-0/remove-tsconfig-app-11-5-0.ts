import {
  getProjects,
  Tree,
  readJson,
  updateJson,
  formatFiles,
} from '@nrwl/devkit';

export async function removeTsconfigApp(host: Tree) {
  const projects = getProjects(host);

  projects.forEach((project) => {
    const tsconfigAppPath = `${project.root}/tsconfig.app.json`;
    const tsconfigPath = `${project.root}/tsconfig.json`;

    if (project.targets?.build?.executor !== '@nrwl/next:build') return;

    if (!host.exists(tsconfigAppPath)) return;

    const tsconfigAppContents = readJson(host, tsconfigAppPath);

    updateJson(host, tsconfigPath, (json) => {
      json.include = tsconfigAppContents.include;
      if (json.references) {
        delete json.references;
      }
      return json;
    });

    host.delete(tsconfigAppPath);
  });

  await formatFiles(host);
}

export default removeTsconfigApp;
