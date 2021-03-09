import { formatFiles, getProjects, Tree, updateJson } from '@nrwl/devkit';

export async function updateBabelConfig(host: Tree) {
  const projects = getProjects(host);

  projects.forEach((p) => {
    const babelrcPath = `${p.root}/.babelrc`;
    if (!host.exists(babelrcPath)) return;

    updateJson(host, babelrcPath, (json) => {
      json.presets = json.presets || [];
      json.presets = json.presets.map((x) =>
        x === 'next/babel' ? '@nrwl/next/babel' : x
      );
      return json;
    });
  });

  await formatFiles(host);
}

export default updateBabelConfig;
