import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { updateNextConfig } from './update-next-config';

describe('UpdateNextConfig', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should update next.config.js with assets and file replacements if they do not exists', () => {
    const initalConfig = `
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

    module.exports = composePlugins(...plugins)(nextConfig);`;

    const projectName = 'my-app';
    tree.write(`${projectName}/next.config.js`, initalConfig);

    const assets = [
      {
        input: 'my-app/assets',
        output: 'my-app/public/assets',
        glob: '**/*',
      },
    ];
    const fileReplacements = [
      {
        replace: 'my-app/environments/environment.ts',
        with: 'my-app/environments/environment.prod.ts',
      },
    ];

    updateNextConfig(
      tree,
      { projectName, root: projectName },
      { assets, fileReplacements }
    );

    const updatedConfig = tree.read(`${projectName}/next.config.js`, 'utf-8');
    expect(updatedConfig).toMatchInlineSnapshot(`
      "//@ts-check
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
              fileReplacements: [
                  {
                      replace: "./environments/environment.ts",
                      with: "./environments/environment.prod.ts"
                  }
              ],
              assets: [
                  {
                      input: "./assets",
                      output: "./public/assets",
                      glob: "**/*"
                  }
              ],
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

  it('should not update next.config.js if assets and file replacements already exists', () => {
    const initalConfig = `
    /**
       * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
      **/
      const nextConfig = {
          nx: {
              // Set this to true if you would like to use SVGR
              // See: https://github.com/gregberge/svgr
              svgr: false,
          
            fileReplacements: [
                {
                    replace: "./environments/environment.ts",
                    with: "./environments/environment.prod.ts"
                }
            ],
            assets: [
                {
                    input: "./assets",
                    output: "./public/assets",
                    glob: "**/*"
                }
            ],
          },
      };
      const plugins = [
          // Add more Next.js plugins to this list if needed.
          withNx,
      ];
      module.exports = composePlugins(...plugins)(nextConfig);
    `;

    const assets = [
      {
        input: 'demo/my-assets/assets',
        output: 'demo/public/assets',
        glob: '**/**/test',
      },
    ];
    const fileReplacements = [
      {
        replace: 'demo/environments/environment.ts',
        with: 'demo/environments/environment.prod.ts',
      },
    ];

    const projectName = 'demo';
    tree.write(`${projectName}/next.config.js`, initalConfig);

    updateNextConfig(
      tree,
      { projectName, root: projectName },
      { assets, fileReplacements }
    );

    expect(tree.read(`${projectName}/next.config.js`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "/**
         * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
        **/
      const nextConfig = {
          nx: {
              // Set this to true if you would like to use SVGR
              // See: https://github.com/gregberge/svgr
              svgr: false,
              fileReplacements: [
                  {
                      replace: "./environments/environment.ts",
                      with: "./environments/environment.prod.ts"
                  }
              ],
              assets: [
                  {
                      input: "./assets",
                      output: "./public/assets",
                      glob: "**/*"
                  }
              ],
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

  it('should only update assets if they are provided and do not exist in next.config.js', () => {
    const initalConfig = `
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

    module.exports = composePlugins(...plugins)(nextConfig);`;

    const projectName = 'only-assets';
    tree.write(`${projectName}/next.config.js`, initalConfig);

    const assets = [
      {
        input: 'only-assets/assets',
        output: 'only-assets/public/assets',
        glob: '**/*',
      },
    ];

    updateNextConfig(tree, { projectName, root: projectName }, { assets });

    expect(tree.read(`${projectName}/next.config.js`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "//@ts-check
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
              assets: [
                  {
                      input: "./assets",
                      output: "./public/assets",
                      glob: "**/*"
                  }
              ],
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

  it('should only update file replacements if they are provided and do not exist in next.config.js', () => {
    const initalConfig = `
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

    module.exports = composePlugins(...plugins)(nextConfig);`;

    const projectName = 'only-file-replacements';
    tree.write(`${projectName}/next.config.js`, initalConfig);

    const fileReplacements = [
      {
        replace: 'only-file-replacements/environments/environment.ts',
        with: 'only-file-replacements/environments/environment.prod.ts',
      },
    ];

    updateNextConfig(
      tree,
      { projectName, root: projectName },
      { fileReplacements }
    );

    expect(tree.read(`${projectName}/next.config.js`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "//@ts-check
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
              fileReplacements: [
                  {
                      replace: "./environments/environment.ts",
                      with: "./environments/environment.prod.ts"
                  }
              ],
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

  it('should add distDir property to next.config.js if it does not exist', () => {
    const initalConfig = `
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

    module.exports = composePlugins(...plugins)(nextConfig);`;

    const projectName = 'only-distDir-replacements';
    tree.write(`${projectName}/next.config.js`, initalConfig);

    updateNextConfig(
      tree,
      { projectName, root: projectName },
      { outputPath: 'dist' }
    );

    expect(tree.read(`${projectName}/next.config.js`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "//@ts-check
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
          distDir: "dist",
      };
      const plugins = [
          // Add more Next.js plugins to this list if needed.
          withNx,
      ];
      module.exports = composePlugins(...plugins)(nextConfig);
      "
    `);
  });
});
