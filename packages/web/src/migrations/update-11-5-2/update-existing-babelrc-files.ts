import { formatFiles, getProjects, Tree, updateJson } from '@nrwl/devkit';

export async function updateExistingBabelrcFiles(host: Tree) {
  const projects = getProjects(host);

  projects.forEach((p) => {
    const babelrcPath = `${p.root}/.babelrc`;

    // Add `@nrwl/web/babel` to projects that did not previously use it.
    // This is needed because we removed it from the root.
    if (host.exists(babelrcPath)) {
      updateJson(host, babelrcPath, (json) => {
        json.presets ||= [];
        if (
          -1 ===
          json.presets.findIndex(
            (x) =>
              x === '@nrwl/web/babel' ||
              x === '@nrwl/react/babel' ||
              x === '@nrwl/next/babel'
          )
        ) {
          json.presets.push('@nrwl/web/babel');
        }
        return json;
      });
    }
  });

  await formatFiles(host);
}

export default updateExistingBabelrcFiles;
