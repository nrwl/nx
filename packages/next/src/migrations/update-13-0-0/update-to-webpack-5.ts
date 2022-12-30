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
    let updated = content.replace(/webpack5: false/, 'webpack5: true');

    if (content.match(/@zeit\/next-less/)) {
      updated = updated.replace('@zeit/next-less', 'next-with-less');
      task = addDependenciesToPackageJson(
        host,
        { 'next-with-less': '1.0.1' },
        {}
      );
    }

    if (content.match(/@zeit\/next-stylus/)) {
      updated = updated.replace(
        '@zeit/next-stylus',
        '@nrwl/next/plugins/with-stylus'
      );
      task = addDependenciesToPackageJson(
        host,
        { 'stylus-loader': '6.2.0' },
        {}
      );
    }

    host.write(configPath, updated);
  });

  await formatFiles(host);

  return task;
}

export default update;
