import {
  formatFiles,
  getProjects,
  Tree,
  readJson,
  joinPathFragments,
  writeJson,
} from '@nrwl/devkit';

export async function removeStyledJsxBabelConfig(host: Tree) {
  const projects = getProjects(host);

  projects.forEach((project) => {
    const babelRcPath = joinPathFragments(project.root, '.babelrc');
    if (host.exists(babelRcPath)) {
      const babelRcContent = readJson(host, babelRcPath);

      // check whether next.js project
      if (babelRcContent.presets.includes('next/babel')) {
        babelRcContent.plugins = babelRcContent.plugins.filter(
          (x) => x !== 'styled-jsx/babel'
        );

        // update .babelrc
        writeJson(host, babelRcPath, babelRcContent);
      }
    }
  });

  await formatFiles(host);
}

export default removeStyledJsxBabelConfig;
