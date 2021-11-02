import {
  formatFiles,
  getProjects,
  joinPathFragments,
  readJson,
  Tree,
  writeJson,
} from '@nrwl/devkit';

export async function fixPageDirForEslint(host: Tree) {
  const projects = getProjects(host);

  projects.forEach((project) => {
    const eslintRcJson = joinPathFragments(project.root, '.eslintrc.json');
    if (host.exists(eslintRcJson)) {
      const config = readJson(host, eslintRcJson);
      // Ignore non-nextjs projects
      if (!config?.extends?.includes('next')) return;

      // Find the override that handles both TS and JS files.
      const commonOverride = config.overrides?.find((o) =>
        ['*.ts', '*.tsx', '*.js', '*.jsx'].every((ext) => o.files.includes(ext))
      );

      if (
        commonOverride &&
        !commonOverride.rules['@next/next/no-html-link-for-pages']
      ) {
        commonOverride.rules = {
          ...commonOverride.rules,
          '@next/next/no-html-link-for-pages': [
            'error',
            `${project.root}/pages`,
          ],
        };

        writeJson(host, eslintRcJson, config);
      }
    }
  });

  await formatFiles(host);
}

export default fixPageDirForEslint;
