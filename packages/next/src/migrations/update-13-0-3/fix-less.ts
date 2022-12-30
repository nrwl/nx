import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  getProjects,
  joinPathFragments,
  Tree,
} from '@nrwl/devkit';

export async function update(host: Tree) {
  const projects = getProjects(host);
  let task: undefined | GeneratorCallback = undefined;

  projects.forEach((project) => {
    const configPath = joinPathFragments(project.root, 'next.config.js');

    if (!host.exists(configPath)) return;

    const content = host.read(configPath).toString();

    if (content.match(/next-with-less/)) {
      const updated = content.replace(
        'next-with-less',
        '@nrwl/next/plugins/with-less'
      );
      task = addDependenciesToPackageJson(
        host,
        { 'less-loader': '10.2.0' },
        {}
      );
      host.write(configPath, updated);
    }
  });

  await formatFiles(host);

  return task;
}

export default update;
