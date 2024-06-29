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

  describe('Reserved variables', () => {
    it('should warn the user if the next config file contains reserved variables', () => {
      const initConfig = `
    const options = {};
    const configValues = {};
    const configuration = {};
    `;
      const projectDetails = {
        projectName: 'reserved-variables',
        root: 'reserved-variables',
      };
      tree.write(`${projectDetails.root}/next.config.js`, initConfig);

      updateNextConfig(tree, '', projectDetails, mockLog);

      expect(mockLog.addLog).toHaveBeenCalledWith({
        executorName: '@nx/next:build',
        log: "The project (reserved-variables) Next.js config contains reserved variables ('options', 'configValues' or 'configuration') which are generated during the migration. Leaving it as is.",
        project: 'reserved-variables',
      });
    });

    it('should warn the user if the next config file contains a reserved variable (option)', () => {
      const initConfig = `const options = {};`;
      const projectDetails = {
        projectName: 'reserved-options',
        root: 'reserved-options',
      };
      tree.write(`${projectDetails.root}/next.config.js`, initConfig);

      updateNextConfig(tree, '', projectDetails, mockLog);

      expect(mockLog.addLog).toHaveBeenCalledWith({
        executorName: '@nx/next:build',
        log: "The project (reserved-options) Next.js config contains reserved variables ('options', 'configValues' or 'configuration') which are generated during the migration. Leaving it as is.",
        project: 'reserved-options',
      });
    });

    it('should warn the user if the next config file contains a reserved variable (configValues)', () => {
      const initConfig = `const configValues = {};`;
      const projectDetails = {
        projectName: 'reserved-config-values',
        root: 'reserved-config-values',
      };

      tree.write(`${projectDetails.root}/next.config.js`, initConfig);

      updateNextConfig(tree, '', projectDetails, mockLog);

      expect(mockLog.addLog).toHaveBeenCalledWith({
        executorName: '@nx/next:build',
        log: "The project (reserved-config-values) Next.js config contains reserved variables ('options', 'configValues' or 'configuration') which are generated during the migration. Leaving it as is.",
        project: 'reserved-config-values',
      });
    });

    it('should warn the user if the next config file contains a reserved variable (configuration)', () => {
      const initConfig = `const configuration = {};`;
      const projectDetails = {
        projectName: 'reserved-configuration-values',
        root: 'reserved-configuration-values',
      };

      tree.write(`${projectDetails.root}/next.config.js`, initConfig);

      updateNextConfig(tree, '', projectDetails, mockLog);

      expect(mockLog.addLog).toHaveBeenCalledWith({
        executorName: '@nx/next:build',
        log: "The project (reserved-configuration-values) Next.js config contains reserved variables ('options', 'configValues' or 'configuration') which are generated during the migration. Leaving it as is.",
        project: 'reserved-configuration-values',
      });
    });
  });
});
