import { readFile, runCLI, updateFile, updateJson } from '@nx/e2e-utils';
import { join } from 'path';

import { esbuildApp, setupAngularProjectsSuite } from './projects.setup';

describe('Angular Projects - index transformer', () => {
  setupAngularProjectsSuite();

  it('should support providing a transformer function for the "index.html" file with the application executor', async () => {
    updateFile(
      `${esbuildApp}/index.transformer.mjs`,
      `const indexHtmlTransformer = (indexContent) => {
        return indexContent.replace(
          '<title>${esbuildApp}</title>',
          '<title>${esbuildApp} (transformed)</title>'
        );
      };

      export default indexHtmlTransformer;`
    );

    updateJson(join(esbuildApp, 'project.json'), (config) => {
      config.targets.build.executor = '@nx/angular:application';
      config.targets.build.options = {
        ...config.targets.build.options,
        indexHtmlTransformer: `${esbuildApp}/index.transformer.mjs`,
      };
      return config;
    });

    runCLI(`build ${esbuildApp}`);

    const indexHtmlContent = readFile(`dist/${esbuildApp}/browser/index.html`);
    expect(indexHtmlContent).toContain(
      `<title>${esbuildApp} (transformed)</title>`
    );
  });
});

