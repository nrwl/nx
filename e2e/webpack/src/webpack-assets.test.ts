import {
  checkFilesExist,
  runCLI,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { setupWebpackTest } from './webpack-setup';

describe('Webpack Plugin', () => {
  setupWebpackTest();

  it('should resolve assets from executors as relative to workspace root', () => {
    const appName = uniq('app');
    runCLI(
      `generate @nx/web:app ${appName} --directory=apps/${appName} --bundler webpack`
    );
    updateFile('shared/docs/TEST.md', 'TEST');
    updateJson(`apps/${appName}/project.json`, (json) => {
      json.targets.build = {
        executor: '@nx/webpack:webpack',
        outputs: ['{options.outputPath}'],
        options: {
          assets: [
            {
              input: 'shared/docs',
              glob: 'TEST.md',
              output: '.',
            },
          ],
          outputPath: `dist/apps/${appName}`,
          webpackConfig: `apps/${appName}/webpack.config.js`,
        },
      };
      return json;
    });

    runCLI(`build ${appName}`);

    checkFilesExist(`dist/apps/${appName}/TEST.md`);
  });
});
