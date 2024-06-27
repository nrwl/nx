import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { updateNextConfig } from './update-next-config';

describe('UpdateNextConfig', () => {
  let tree: Tree;
  const mockLog = {
    addLog: jest.fn(),
    logs: new Map(),
    flushLogs: jest.fn(),
    reset: jest.fn(),
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should update the next config file adding the options passed in', () => {
    const initConfig = `
    //@ts-check

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { composePlugins, withNx } = require('@nx/next');

    /**
     * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
     **/
    const nextConfig = {
      nx: {
        // Set this to true if you would like to use SVGR
        // See: https://github.com/gregberge/svgr
        svgr: false,
      },
    };

    const plugins = [
      // Add more Next.js plugins to this list if needed.
      withNx,
    ];

    module.exports = composePlugins(...plugins)(nextConfig);
    `;

    const projectName = 'my-app';
    tree.write(`${projectName}/next.config.js`, initConfig);

    const executorOptionsString = `
    const configValues = {
    default: {
      fileReplacements: [
        {
          replace: './environments/environment.ts',
          with: './environments/environment.foo.ts',
        },
      ],
    },
    development: {},
  };
  const configuration = process.env.NX_TASK_TARGET_CONFIGURATION || 'default';
  const options = {
    ...configValues.default,
    //@ts-expect-error: Ignore TypeScript error for indexing configValues with a dynamic key
    ...configValues[configuration],
  };`;

    const projectDetails = { projectName, root: projectName };
    updateNextConfig(tree, executorOptionsString, projectDetails, mockLog);

    const result = tree.read(`${projectName}/next.config.js`, 'utf-8');
    expect(result).toMatchInlineSnapshot(`
      "//@ts-check
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { composePlugins, withNx } = require('@nx/next');
      const configValues = {
          default: {
              fileReplacements: [
                  {
                      replace: './environments/environment.ts',
                      with: './environments/environment.foo.ts',
                  },
              ],
          },
          development: {},
      };
      const configuration = process.env.NX_TASK_TARGET_CONFIGURATION || 'default';
      const options = {
          ...configValues.default,
          //@ts-expect-error: Ignore TypeScript error for indexing configValues with a dynamic key
          ...configValues[configuration],
      };
      ;
      /**
       * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
       **/
      const nextConfig = {
          nx: {
              // Set this to true if you would like to use SVGR
              // See: https://github.com/gregberge/svgr
              svgr: false,
              ...options
          },
      };
      const plugins = [
          // Add more Next.js plugins to this list if needed.
          withNx,
      ];
      module.exports = composePlugins(...plugins)(nextConfig);
      "
    `);
  });

  it('should warm the user if the next config file is not support (.mjs)', () => {
    const initConfig = `export default {}`;
    const projectDetails = { projectName: 'mjs-config', root: 'mjs-config' };
    tree.write(`${projectDetails.root}/next.config.mjs`, initConfig);

    updateNextConfig(tree, '', projectDetails, mockLog);

    expect(mockLog.addLog).toHaveBeenCalledWith({
      executorName: '@nx/next:build',
      log: 'The project mjs-config does not use a supported Next.js config file format. Only .js and .cjs files using "composePlugins" is supported. Leaving it as is.',
      project: 'mjs-config',
    });
  });

  it('should warm the user if composePlugins is not found in the next config file', () => {
    // Example of a typical next.config.js file
    const initConfig = `
    module.exports = {
      distDir: 'dist',
      reactStrictMode: true,
    };
    `;
    const projectDetails = {
      projectName: 'no-compose-plugins',
      root: 'no-compose-plugins',
    };
    tree.write(`${projectDetails.root}/next.config.js`, initConfig);

    updateNextConfig(tree, '', projectDetails, mockLog);

    expect(mockLog.addLog).toHaveBeenCalledWith({
      executorName: '@nx/next:build',
      log: 'The project no-compose-plugins does not use a supported Next.js config file format. Only .js and .cjs files using "composePlugins" is supported. Leaving it as is.',
      project: 'no-compose-plugins',
    });
  });
});
