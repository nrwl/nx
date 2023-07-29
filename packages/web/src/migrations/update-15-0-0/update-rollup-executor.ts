import {
  formatFiles,
  getProjects,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';

export default async function update(host: Tree) {
  const projects = getProjects(host);

  for (const [name, config] of projects.entries()) {
    let updated = false;

    if (config?.targets?.build?.executor === '@nrwl/web:rollup') {
      config.targets.build.executor = '@nrwl/rollup:rollup';
      updated = true;
    }

    if (config?.targets?.build?.options?.formats?.includes('umd')) {
      config.targets.build.options.formats =
        config.targets.build.options.formats.reduce((acc, x) => {
          const format = x === 'umd' ? 'cjs' : x;

          if (format === 'cjs') {
            if (!acc.includes('cjs')) acc.push(format);
          } else {
            acc.push(format);
          }

          return acc;
        }, []);

      updated = true;
    }

    if (updated) {
      updateProjectConfiguration(host, name, config);
    }
  }

  await formatFiles(host);
}
