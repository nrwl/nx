import { formatFiles, getProjects, Tree, updateJson } from '@nrwl/devkit';

export async function updateBabelConfig(host: Tree) {
  const projects = getProjects(host);

  if (host.exists('babel.config.json')) {
    updateJson(host, 'babel.config.json', (json) => {
      if (Array.isArray(json.presets)) {
        json.presets = json.presets.filter((x) => x !== '@nrwl/web/babel');
      }
      return json;
    });
  }

  projects.forEach((p) => {
    const babelrcPath = `${p.root}/.babelrc`;

    // Add `@nrwl/web/babel` to projects that did not previously use it.
    // This is needed because we removed it from the root.
    if (host.exists(babelrcPath)) {
      updateJson(host, babelrcPath, (json) => {
        json.presets = json.presets || [];
        if (
          -1 ===
          json.presets.findIndex(
            (x) =>
              x === '@nrwl/web/babel' ||
              x === '@nrwl/react/babel' ||
              x === '@nrwl/next/babel' ||
              x === '@nrwl/gatsby/babel'
          )
        ) {
          json.presets.push('@nrwl/web/babel');
        }
        return json;
      });
      // Non-buildable libraries might be included in applications that
      // require .babelrc to exist and contain '@nrwl/web/babel' preset
    } else if (p.projectType === 'library') {
      host.write(
        babelrcPath,
        JSON.stringify({ presets: ['@nrwl/web/babel'] }, null, 2)
      );
    }
  });

  await formatFiles(host);
}

export default updateBabelConfig;
