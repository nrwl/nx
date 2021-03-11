import { ProjectGraphCache } from '@nrwl/workspace';

export const smallGraph: ProjectGraphCache = {
  version: '2.0',
  rootFiles: [
    {
      file: 'package.json',
      hash: '56dd235281ce754d2ae495b2f4e12cbea9667269',
      ext: '.json',
    },
    {
      file: 'workspace.json',
      hash: 'd1e56fbdd840dacf060d7ad0db5cc7c892146046',
      ext: '.json',
    },
    {
      file: 'nx.json',
      hash: 'c11b3067ff8454ecb6583e93df3553f8b530a501',
      ext: '.json',
    },
    {
      file: 'tsconfig.base.json',
      hash: '3c058d8e7be69a57ab3a204aa4d29d2f9f996a01',
      ext: '.json',
    },
  ],
  nodes: {
    'create-nx-workspace': {
      name: 'create-nx-workspace',
      type: 'lib',
      data: {
        root: 'packages/create-nx-workspace',
        sourceRoot: 'packages/create-nx-workspace',
        projectType: 'library',
        schematics: {},
        architect: {
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/create-nx-workspace/jest.config.js',
              passWithNoTests: true,
            },
          },
          'build-base': {
            builder: '@nrwl/node:package',
            options: {
              outputPath: 'build/packages/create-nx-workspace',
              tsConfig: 'packages/create-nx-workspace/tsconfig.lib.json',
              packageJson: 'packages/create-nx-workspace/package.json',
              main: 'packages/create-nx-workspace/index.ts',
              updateBuildableProjectDepsInPackageJson: false,
              assets: [
                {
                  input: 'packages/create-nx-workspace',
                  glob: '**/files/**',
                  output: '/',
                },
                {
                  input: 'packages/create-nx-workspace',
                  glob: '**/files/**/.gitkeep',
                  output: '/',
                },
                {
                  input: 'packages/create-nx-workspace',
                  glob: '**/*.json',
                  output: '/',
                },
                {
                  input: 'packages/create-nx-workspace',
                  glob: '**/*.js',
                  output: '/',
                },
                'LICENSE',
              ],
            },
          },
          build: {
            builder: '@nrwl/workspace:run-commands',
            outputs: ['build/packages/create-nx-workspace'],
            options: {
              commands: [
                {
                  command: 'nx build-base create-nx-workspace',
                },
                {
                  command:
                    'chmod +x build/packages/create-nx-workspace/bin/create-nx-workspace.js',
                },
                {
                  command: 'node ./scripts/copy-readme.js create-nx-workspace',
                },
              ],
              parallel: false,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/create-nx-workspace/.eslintrc',
            hash: '9afd5d63f09f7d350b479cea3984ab4d8920d964',
            ext: '',
          },
          {
            file: 'packages/create-nx-workspace/bin/create-nx-workspace.ts',
            hash: '42097a80058565cfe3c02411cc7a82b32cb19911',
            ext: '.ts',
          },
          {
            file: 'packages/create-nx-workspace/bin/shared.ts',
            hash: '5641d327a49e2e213565defb14494f1f97166301',
            ext: '.ts',
          },
          {
            file: 'packages/create-nx-workspace/jest.config.js',
            hash: '7a000f30cbce12b8f037ad75ddeac9228cd00fc0',
            ext: '.js',
          },
          {
            file: 'packages/create-nx-workspace/package.json',
            hash: '05c673e409c6d7f267cabf069a1cedee11ce3a8f',
            ext: '.json',
          },
          {
            file: 'packages/create-nx-workspace/README.md',
            hash: 'edead203a3ead488992f18604c0d65681582b029',
            ext: '.md',
          },
          {
            file: 'packages/create-nx-workspace/tsconfig.json',
            hash: '58bd2c97a66f5e5ea5d05c8a5709ee79bad02094',
            ext: '.json',
          },
          {
            file: 'packages/create-nx-workspace/tsconfig.lib.json',
            hash: 'dbe90e0855d2ef980595dcc17f577088662cfb4d',
            ext: '.json',
          },
          {
            file: 'packages/create-nx-workspace/tsconfig.spec.json',
            hash: 'd6ae6669d75fc5beb184f28966262e1762b9623c',
            ext: '.json',
          },
        ],
      },
    },
    'eslint-plugin-nx': {
      name: 'eslint-plugin-nx',
      type: 'lib',
      data: {
        root: 'packages/eslint-plugin-nx',
        sourceRoot: 'packages/eslint-plugin-nx',
        projectType: 'library',
        schematics: {},
        architect: {
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/eslint-plugin-nx/jest.config.js',
              passWithNoTests: true,
            },
          },
          'build-base': {
            builder: '@nrwl/node:package',
            options: {
              outputPath: 'build/packages/eslint-plugin-nx',
              tsConfig: 'packages/eslint-plugin-nx/tsconfig.lib.json',
              packageJson: 'packages/eslint-plugin-nx/package.json',
              main: 'packages/eslint-plugin-nx/index.ts',
              updateBuildableProjectDepsInPackageJson: false,
              assets: [
                {
                  input: 'packages/eslint-plugin-nx',
                  glob: '**/files/**',
                  output: '/',
                },
                {
                  input: 'packages/eslint-plugin-nx',
                  glob: '**/files/**/.gitkeep',
                  output: '/',
                },
                {
                  input: 'packages/eslint-plugin-nx',
                  glob: '**/*.json',
                  output: '/',
                },
                {
                  input: 'packages/eslint-plugin-nx',
                  glob: '**/*.js',
                  output: '/',
                },
                'LICENSE',
              ],
            },
          },
          build: {
            builder: '@nrwl/workspace:run-commands',
            outputs: ['build/packages/eslint-plugin-nx'],
            options: {
              commands: [
                {
                  command: 'nx build-base eslint-plugin-nx',
                },
                {
                  command: 'node ./scripts/copy-readme.js eslint-plugin-nx',
                },
              ],
              parallel: false,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/eslint-plugin-nx/.eslintrc',
            hash: '9afd5d63f09f7d350b479cea3984ab4d8920d964',
            ext: '',
          },
          {
            file: 'packages/eslint-plugin-nx/jest.config.js',
            hash: 'd46b94edc86f19c83d4c6e61b07a019d1797df94',
            ext: '.js',
          },
          {
            file: 'packages/eslint-plugin-nx/package.json',
            hash: 'be34fc0d1991ac89afc2b5dec430e9d42fcee407',
            ext: '.json',
          },
          {
            file: 'packages/eslint-plugin-nx/README.md',
            hash: 'f0e84a03e995a884751b92dc08189b14175557f1',
            ext: '.md',
          },
          {
            file: 'packages/eslint-plugin-nx/src/index.ts',
            hash: '8d0d8d155cf69133f99688001850d1b0fcee06d4',
            ext: '.ts',
          },
          {
            file:
              'packages/eslint-plugin-nx/src/rules/enforce-module-boundaries.ts',
            hash: '8296329cb5998670b7ff505355c1a7ad75087ffd',
            ext: '.ts',
          },
          {
            file: 'packages/eslint-plugin-nx/src/utils/create-eslint-rule.ts',
            hash: 'c72c352363c15cc8d55f686ee90e8d7ca81c652e',
            ext: '.ts',
          },
          {
            file:
              'packages/eslint-plugin-nx/tests/rules/enforce-module-boundaries.spec.ts',
            hash: 'f170745159f0bac38a1adeeaa21745726d576e50',
            ext: '.ts',
          },
          {
            file: 'packages/eslint-plugin-nx/tests/test-helper.ts',
            hash: 'cd5cd229b8fe30066fe233b9cb9332981bcaeb07',
            ext: '.ts',
          },
          {
            file: 'packages/eslint-plugin-nx/tsconfig.json',
            hash: '58bd2c97a66f5e5ea5d05c8a5709ee79bad02094',
            ext: '.json',
          },
          {
            file: 'packages/eslint-plugin-nx/tsconfig.lib.json',
            hash: 'dbe90e0855d2ef980595dcc17f577088662cfb4d',
            ext: '.json',
          },
          {
            file: 'packages/eslint-plugin-nx/tsconfig.spec.json',
            hash: 'd6ae6669d75fc5beb184f28966262e1762b9623c',
            ext: '.json',
          },
        ],
      },
    },
    'create-nx-plugin': {
      name: 'create-nx-plugin',
      type: 'lib',
      data: {
        root: 'packages/create-nx-plugin',
        sourceRoot: 'packages/create-nx-plugin',
        projectType: 'library',
        schematics: {},
        architect: {
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/create-nx-plugin/jest.config.js',
              passWithNoTests: true,
            },
          },
          'build-base': {
            builder: '@nrwl/node:package',
            options: {
              outputPath: 'build/packages/create-nx-plugin',
              tsConfig: 'packages/create-nx-plugin/tsconfig.lib.json',
              packageJson: 'packages/create-nx-plugin/package.json',
              main: 'packages/create-nx-plugin/index.ts',
              updateBuildableProjectDepsInPackageJson: false,
              assets: [
                {
                  input: 'packages/create-nx-plugin',
                  glob: '**/files/**',
                  output: '/',
                },
                {
                  input: 'packages/create-nx-plugin',
                  glob: '**/files/**/.gitkeep',
                  output: '/',
                },
                {
                  input: 'packages/create-nx-plugin',
                  glob: '**/*.json',
                  output: '/',
                },
                {
                  input: 'packages/create-nx-plugin',
                  glob: '**/*.js',
                  output: '/',
                },
                'LICENSE',
              ],
            },
          },
          build: {
            builder: '@nrwl/workspace:run-commands',
            outputs: ['build/packages/create-nx-plugin'],
            options: {
              commands: [
                {
                  command: 'nx build-base create-nx-plugin',
                },
                {
                  command:
                    'chmod +x build/packages/create-nx-plugin/bin/create-nx-plugin.js',
                },
                {
                  command: 'node ./scripts/copy-readme.js create-nx-workspace',
                },
              ],
              parallel: false,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/create-nx-plugin/.eslintrc',
            hash: '9afd5d63f09f7d350b479cea3984ab4d8920d964',
            ext: '',
          },
          {
            file: 'packages/create-nx-plugin/bin/create-nx-plugin.ts',
            hash: 'a691f46262f86eaafc01566444496b9e8ced8192',
            ext: '.ts',
          },
          {
            file: 'packages/create-nx-plugin/bin/shared.ts',
            hash: '5641d327a49e2e213565defb14494f1f97166301',
            ext: '.ts',
          },
          {
            file: 'packages/create-nx-plugin/jest.config.js',
            hash: '4e746eeadbac87fde1bf74f3cbe532f6cb87c21d',
            ext: '.js',
          },
          {
            file: 'packages/create-nx-plugin/package.json',
            hash: '4be10b2e338ca7fee7c22fbbbff592e9cca6115a',
            ext: '.json',
          },
          {
            file: 'packages/create-nx-plugin/README.md',
            hash: 'f305a16b2ff4834929fff6e6013c0449a52bc9da',
            ext: '.md',
          },
          {
            file: 'packages/create-nx-plugin/tsconfig.json',
            hash: '58bd2c97a66f5e5ea5d05c8a5709ee79bad02094',
            ext: '.json',
          },
          {
            file: 'packages/create-nx-plugin/tsconfig.lib.json',
            hash: 'dbe90e0855d2ef980595dcc17f577088662cfb4d',
            ext: '.json',
          },
          {
            file: 'packages/create-nx-plugin/tsconfig.spec.json',
            hash: 'd6ae6669d75fc5beb184f28966262e1762b9623c',
            ext: '.json',
          },
        ],
      },
    },
    'dep-graph-client-e2e': {
      name: 'dep-graph-client-e2e',
      type: 'e2e',
      data: {
        root: 'apps/dep-graph-client-e2e',
        sourceRoot: 'apps/dep-graph-client-e2e/src',
        projectType: 'application',
        architect: {
          e2e: {
            builder: '@nrwl/cypress:cypress',
            options: {
              cypressConfig: 'apps/dep-graph-client-e2e/cypress.json',
              tsConfig: 'apps/dep-graph-client-e2e/tsconfig.e2e.json',
              devServerTarget: 'dep-graph-client:serve',
            },
            configurations: {
              release: {
                devServerTarget: 'dep-graph-client:serve:release',
              },
            },
          },
          lint: {
            builder: '@nrwl/linter:lint',
            options: {
              linter: 'eslint',
              tsConfig: ['apps/dep-graph-client-e2e/tsconfig.e2e.json'],
              exclude: [
                '**/node_modules/**',
                '!apps/dep-graph-client-e2e/**/*',
              ],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'apps/dep-graph-client-e2e/.eslintrc',
            hash: 'a15e6e72c6c672e40e179b07bade85d47377d8c9',
            ext: '',
          },
          {
            file: 'apps/dep-graph-client-e2e/cypress.json',
            hash: '4ea79c6b200fb1046cfe354c83d1af6f89f1b175',
            ext: '.json',
          },
          {
            file: 'apps/dep-graph-client-e2e/src/fixtures/example.json',
            hash: '294cbed6ce9e0b948b787452e8676aee486cb3be',
            ext: '.json',
          },
          {
            file: 'apps/dep-graph-client-e2e/src/integration/app.spec.ts',
            hash: 'd3fb99601bb86f35e22ac8e36551f32b38a45f54',
            ext: '.ts',
          },
          {
            file: 'apps/dep-graph-client-e2e/src/plugins/index.js',
            hash: '9067e75a258dadf5a02b2a91c64f5acee1af17fd',
            ext: '.js',
          },
          {
            file: 'apps/dep-graph-client-e2e/src/support/app.po.ts',
            hash: '32934246969c2ecb827ac05677785933a707a54d',
            ext: '.ts',
          },
          {
            file: 'apps/dep-graph-client-e2e/src/support/commands.ts',
            hash: '61b3a3e35770234a5aa9e31b07870b9292ec52ba',
            ext: '.ts',
          },
          {
            file: 'apps/dep-graph-client-e2e/src/support/index.ts',
            hash: '3d469a6b6cf31eb66117d73e278bcf74f398f1db',
            ext: '.ts',
          },
          {
            file: 'apps/dep-graph-client-e2e/tsconfig.e2e.json',
            hash: '9dc3660a79ee2f6daf097b4930427223896e3b25',
            ext: '.json',
          },
          {
            file: 'apps/dep-graph-client-e2e/tsconfig.json',
            hash: '08841a7f56c62d55340ad08451502304837254fd',
            ext: '.json',
          },
        ],
      },
    },
    'dep-graph-client': {
      name: 'dep-graph-client',
      type: 'app',
      data: {
        root: 'apps/dep-graph-client',
        sourceRoot: 'apps/dep-graph-client/src',
        projectType: 'application',
        schematics: {},
        architect: {
          'build-base': {
            builder: '@nrwl/web:build',
            options: {
              outputPath: 'build/packages/workspace/src/core/dep-graph',
              index: 'apps/dep-graph-client/src/index.html',
              main: 'apps/dep-graph-client/src/main.ts',
              polyfills: 'apps/dep-graph-client/src/polyfills.ts',
              tsConfig: 'apps/dep-graph-client/tsconfig.app.json',
              assets: [
                'apps/dep-graph-client/src/favicon.ico',
                'apps/dep-graph-client/src/assets',
              ],
              styles: ['apps/dep-graph-client/src/styles.scss'],
              scripts: [],
            },
            configurations: {
              release: {
                fileReplacements: [
                  {
                    replace: 'apps/dep-graph-client/src/main.ts',
                    with: 'apps/dep-graph-client/src/main.release.ts',
                  },
                ],
                optimization: true,
                outputHashing: 'none',
                sourceMap: false,
                extractCss: true,
                namedChunks: false,
                extractLicenses: true,
                vendorChunk: false,
                budgets: [
                  {
                    type: 'initial',
                    maximumWarning: '2mb',
                    maximumError: '5mb',
                  },
                ],
              },
            },
          },
          serve: {
            builder: '@nrwl/web:dev-server',
            options: {
              buildTarget: 'dep-graph-client:build-base',
            },
            configurations: {
              release: {
                buildTarget: 'dep-graph-client:build-base:release',
              },
            },
          },
          lint: {
            builder: '@nrwl/linter:lint',
            options: {
              linter: 'eslint',
              tsConfig: [
                'apps/dep-graph-client/tsconfig.app.json',
                'apps/dep-graph-client/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!apps/dep-graph-client/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'apps/dep-graph-client/jest.config.js',
              tsConfig: 'apps/dep-graph-client/tsconfig.spec.json',
              passWithNoTests: true,
              setupFile: 'apps/dep-graph-client/src/test-setup.ts',
            },
          },
        },
        tags: ['core'],
        files: [
          {
            file: 'apps/dep-graph-client/.babelrc',
            hash: '0967ef424bce6791893e9a57bb952f80fd536e93',
            ext: '',
          },
          {
            file: 'apps/dep-graph-client/.eslintrc',
            hash: 'ab8f38339cde4762a7feb906e9e0f963958e3f93',
            ext: '',
          },
          {
            file: 'apps/dep-graph-client/browserslist',
            hash: '8d6179367e7ba6b8cd0fa04b900d6ab4142ab08b',
            ext: '',
          },
          {
            file: 'apps/dep-graph-client/jest.config.js',
            hash: 'b56768be18e3cab7c012fd5cdf2fc2afdc9e2643',
            ext: '.js',
          },
          {
            file: 'apps/dep-graph-client/src/app/app.ts',
            hash: 'bef0a9b9d57a64b36e22d52496b08cfffa4ca2e2',
            ext: '.ts',
          },
          {
            file: 'apps/dep-graph-client/src/app/graph.ts',
            hash: '59adc9194a4327de20a899824783740bd07c0659',
            ext: '.ts',
          },
          {
            file: 'apps/dep-graph-client/src/app/sidebar.ts',
            hash: '5387df1ae5a942351994f36788c8b427cd3c7cea',
            ext: '.ts',
          },
          {
            file: 'apps/dep-graph-client/src/app/util.ts',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.ts',
          },
          {
            file: 'apps/dep-graph-client/src/assets/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file: 'apps/dep-graph-client/src/environments/environment.prod.ts',
            hash: 'c9669790be176ac85a5d8c11278875c2f52dc507',
            ext: '.ts',
          },
          {
            file: 'apps/dep-graph-client/src/environments/environment.ts',
            hash: '7ed83767fff25adfed19d52b2821a432f8ed18b1',
            ext: '.ts',
          },
          {
            file: 'apps/dep-graph-client/src/favicon.ico',
            hash: '317ebcb2336e0833a22dddf0ab287849f26fda57',
            ext: '.ico',
          },
          {
            file: 'apps/dep-graph-client/src/globals.d.ts',
            hash: '16d6386b43ec76048e9d5a90696d815ea0cffb63',
            ext: '.ts',
          },
          {
            file: 'apps/dep-graph-client/src/graphs/medium.ts',
            hash: 'ad939f894294a1ef4c7b395b5d8e92a96867d13f',
            ext: '.ts',
          },
          {
            file: 'apps/dep-graph-client/src/index.html',
            hash: 'c08495528aff6f31e70df1ec19999f4b1891cc48',
            ext: '.html',
          },
          {
            file: 'apps/dep-graph-client/src/main.release.ts',
            hash: '7b6b2c00c7a457fdefff789e8603b675857cd0df',
            ext: '.ts',
          },
          {
            file: 'apps/dep-graph-client/src/main.ts',
            hash: 'ea892b663daa059c59f69182e0d8eab341e497e9',
            ext: '.ts',
          },
          {
            file: 'apps/dep-graph-client/src/polyfills.ts',
            hash: '2adf3d05b6fcf479dd61c74f6bda95d9edb6ac6b',
            ext: '.ts',
          },
          {
            file: 'apps/dep-graph-client/src/styles.scss',
            hash: '07f192c7bb786bed86b9072fd026fc73c0280106',
            ext: '.scss',
          },
          {
            file: 'apps/dep-graph-client/src/test-setup.ts',
            hash: 'd8508d703266e7390b30189d3cf7fec7a70b198c',
            ext: '.ts',
          },
          {
            file: 'apps/dep-graph-client/tsconfig.app.json',
            hash: '77cfd4d96d70925df0f4191b030b344597802fac',
            ext: '.json',
          },
          {
            file: 'apps/dep-graph-client/tsconfig.json',
            hash: '63dbe35fb282d5f9ac4a724607173e6316269e29',
            ext: '.json',
          },
          {
            file: 'apps/dep-graph-client/tsconfig.spec.json',
            hash: 'cfff29a544fb49a8c26a7cbf9cd836c87efb7fe8',
            ext: '.json',
          },
        ],
      },
    },
    workspace: {
      name: 'workspace',
      type: 'lib',
      data: {
        root: 'packages/workspace',
        sourceRoot: 'packages/workspace',
        projectType: 'library',
        schematics: {},
        architect: {
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/workspace/jest.config.js',
              passWithNoTests: true,
            },
          },
          'build-base': {
            builder: '@nrwl/node:package',
            options: {
              outputPath: 'build/packages/workspace',
              tsConfig: 'packages/workspace/tsconfig.lib.json',
              packageJson: 'packages/workspace/package.json',
              main: 'packages/workspace/index.ts',
              updateBuildableProjectDepsInPackageJson: false,
              assets: [
                {
                  input: 'packages/workspace',
                  glob: '**/files/**',
                  output: '/',
                },
                {
                  input: 'packages/workspace',
                  glob: '**/files/**/.gitkeep',
                  output: '/',
                },
                {
                  input: 'packages/workspace',
                  glob: '**/**/decorate-angular-cli.js__tmpl__',
                  output: '/',
                },
                {
                  input: 'packages/workspace',
                  glob: '**/*.json',
                  output: '/',
                },
                {
                  input: 'packages/workspace',
                  glob: '**/*.{js,css,html,svg}',
                  output: '/',
                },
                'LICENSE',
              ],
            },
          },
          build: {
            builder: '@nrwl/workspace:run-commands',
            outputs: ['build/packages/workspace'],
            options: {
              commands: [
                {
                  command: 'nx build-base workspace',
                },
                {
                  command:
                    'nx build-base dep-graph-client --configuration release',
                },
                {
                  command: 'node ./scripts/copy-readme.js workspace',
                },
              ],
              parallel: false,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/workspace/.eslintrc',
            hash: '9afd5d63f09f7d350b479cea3984ab4d8920d964',
            ext: '',
          },
          {
            file: 'packages/workspace/builders.json',
            hash: '5836310acc0c5775679addf7c4f0cfb79cdf143d',
            ext: '.json',
          },
          {
            file: 'packages/workspace/collection.json',
            hash: '9b559bbff848ae2b2987eee0100f3e889e687713',
            ext: '.json',
          },
          {
            file: 'packages/workspace/docs/run-commands-examples.md',
            hash: '29a802a94c8412888d483d6032a8bf136cecf235',
            ext: '.md',
          },
          {
            file: 'packages/workspace/index.ts',
            hash: 'd92c170913a4f0f98ebc32dd171763a119b0c595',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/jest.config.js',
            hash: '626127c5a23362895dc75b7bea23af9d62e709e8',
            ext: '.js',
          },
          {
            file: 'packages/workspace/migrations.json',
            hash: 'ca065454269319ece5cddc03ce2896cc50ef9d7e',
            ext: '.json',
          },
          {
            file: 'packages/workspace/package.json',
            hash: '9eb4f2ee6411aad4493ef96782c1848380024fa3',
            ext: '.json',
          },
          {
            file: 'packages/workspace/README.md',
            hash: '9c49ecb1ad0ced71fa9eded2bf3b7173fcd3ae7a',
            ext: '.md',
          },
          {
            file:
              'packages/workspace/src/builders/run-commands/run-commands.impl.spec.ts',
            hash: 'c13927fea262bd547d29b441143114494649612a',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/builders/run-commands/run-commands.impl.ts',
            hash: '0bceb7af7e919cadd588334be15679e9647e47d4',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/builders/run-commands/schema.json',
            hash: '6d3d235b851471633013a7cac38e5a8d38f5e492',
            ext: '.json',
          },
          {
            file: 'packages/workspace/src/command-line/affected.ts',
            hash: '8976d90a4ed7b17b86988c29511592fc9eae8aa0',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/dep-graph.ts',
            hash: '8b637965f959cc37fff0fd3864cfc82b14c8b43b',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/format.ts',
            hash: 'ce48a9c69b64fa0b4289ff92f3f530c2460131af',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/lint.ts',
            hash: '6c9e83c2aa9693b60cb13d81c528a8c5200d3f1e',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/list.ts',
            hash: '7012c03d501a98aca4dd1a16378f0be12df3997d',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/nx-commands.ts',
            hash: '2e96cd2f47a68ba6bb82f9493406cb762e745090',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/print-affected.spec.ts',
            hash: '7cd4a5e1ae17f65fb782c468126f07fd15156076',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/print-affected.ts',
            hash: '596ce740b6fe6b98db6db9878a1683ad063e08ec',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/report.ts',
            hash: '6d0c03e647cca929f8c2d56b82a3d616cfe4576c',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/run-many.ts',
            hash: '540c662322106cbb1d751ee2d110f94218f1a217',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/run-one.ts',
            hash: '46b2d5bac761a4515cc34bf577903c9adefc4e89',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/shared.ts',
            hash: '671c6e5bfb27b9ca0573a7ef8de7f41ab6a022eb',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/command-line/supported-nx-commands.ts',
            hash: '550a8be07c3f8064a8dad284c5d29b303fe3eef0',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/utils.spec.ts',
            hash: '844e98e74c168e015f239ad5c588eedbc7039c98',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/utils.ts',
            hash: '7a3336f69b3e38f4e1d6944db1bb3f67aef06ff0',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/command-line/workspace-integrity-checks.spec.ts',
            hash: '72da6bccec2d45ce29f7467111efeefc4e11d45a',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/command-line/workspace-integrity-checks.ts',
            hash: 'c3a1f5be9c3459e0755252ad07502eaf15c1e6db',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/command-line/workspace-results.spec.ts',
            hash: '68dae4c7f4f5597d0e77ae1579646a013eb911a1',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/workspace-results.ts',
            hash: '2c0f619f3d5381bfb26d78820569c4560847c5be',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/workspace-schematic.ts',
            hash: '5f926aa49e0c83371814c1d3f9855366247167ba',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/affected-project-graph/affected-project-graph-models.ts',
            hash: 'fa1a734d45e756385a16236511220999c20fa794',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/affected-project-graph/affected-project-graph.spec.ts',
            hash: '1846ddb99fa5094cab713961d7647a953a8328d3',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/affected-project-graph/affected-project-graph.ts',
            hash: '58c3cc46201d91f3ffc69e67e041f148afb9555e',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/affected-project-graph/index.ts',
            hash: '895811b82033217ab8e85fdab606fdc71732da66',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/affected-project-graph/locators/implicit-json-changes.spec.ts',
            hash: '6fbf2c8c435b9d1df88f667e568b35be8c795c09',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/affected-project-graph/locators/implicit-json-changes.ts',
            hash: 'ed27c95fb817b1fd3bf3a9c342cf9bb00c10809d',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/affected-project-graph/locators/npm-packages.spec.ts',
            hash: 'c210d432f1476d395893a5372bfd49a8f2d1ab93',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/affected-project-graph/locators/npm-packages.ts',
            hash: 'b5b9e0be3d27db2582edbf5f53df2e4838d475f2',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/affected-project-graph/locators/nx-json-changes.spec.ts',
            hash: 'b5d79cb44a439661f005007b1823961614109023',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/affected-project-graph/locators/nx-json-changes.ts',
            hash: '3a4e56d5d8dbb4b164973778b25ae40e0c5c04bd',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/affected-project-graph/locators/tsconfig-json-changes.spec.ts',
            hash: '83eb239a4ccc9918fb064e7efa494832863bc2c8',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/affected-project-graph/locators/tsconfig-json-changes.ts',
            hash: '4511e0eef3631640f3d5cd185c08987d403fbcd9',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/affected-project-graph/locators/workspace-json-changes.spec.ts',
            hash: 'b16a7672dd41645b9908d7ad183c5198ab07c716',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/affected-project-graph/locators/workspace-json-changes.ts',
            hash: '1e7b9b9301628867b8adb5128422bc25d8e88883',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/affected-project-graph/locators/workspace-projects.spec.ts',
            hash: '64e2a0460ed2b8ae1c273e8381193ba82601a920',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/affected-project-graph/locators/workspace-projects.ts',
            hash: '461300dd505469ab2b2c358ddbaef6e1fe342e31',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/assert-workspace-validity.spec.ts',
            hash: '6ca998ea342b0f453ce61bb02d64ee45a31aefd9',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/assert-workspace-validity.ts',
            hash: 'a5cf7ae1249c1d5f1cddfd10fbb0bf137267fedf',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/file-graph/file-map.spec.ts',
            hash: 'cb345807ac09d062f4c5bb9fb5047ca259b1227e',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/file-graph/file-map.ts',
            hash: '83fc686699015774b72bf021f90b252d336efc59',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/file-graph/index.ts',
            hash: 'c093eeae3b2d32d6176b824cfeafb20b3b52424a',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/file-utils.spec.ts',
            hash: 'd3cf79c83649ef54308780c7a8f1d39353822bff',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/file-utils.ts',
            hash: 'ab6dfa108e2b60a44707c2763b4ab6ed04316e9b',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/hasher/file-hasher.ts',
            hash: 'ccef046f45c757a69635aba98635516187973355',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/hasher/git-hasher.spec.ts',
            hash: '44362940d68acb35f5c890f8b8a12a850a516ef5',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/hasher/git-hasher.ts',
            hash: '90e71eae4a2141bf8a8619d9b0dc29e915b8819d',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/hasher/hasher.spec.ts',
            hash: '7198929b5fa2c4759360c3ee0917bb0dd27ca3f4',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/hasher/hasher.ts',
            hash: 'd374f68146ab50840ebf116b2f61fca8258dc6a7',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/hasher/hashing-impl.ts',
            hash: '8a1f2d3940d139fbb243150634593ad7d01aa317',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/normalize-nx-json.spec.ts',
            hash: '0ce045589b4a0c672731c23dc15c8a17af3c4bb9',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/normalize-nx-json.ts',
            hash: '6a14a5fd4cd163fcc549989f5e0cb66f0c7a0018',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/nx-deps/nx-deps-cache.ts',
            hash: '4375e04405eb8aa7cc40420f6830b9de7bc37f8e',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/project-graph/build-dependencies/build-dependencies.ts',
            hash: '652b7dde558b9cc5639eb1b3ad21ae57618cca43',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/project-graph/build-dependencies/explicit-npm-dependencies.ts',
            hash: 'ffbb357ee0d906c3bc3f85037af0805c1b825266',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/project-graph/build-dependencies/explicit-project-dependencies.spec.ts',
            hash: '500e09a2c5245f0e9b99975a657040031622f68d',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/project-graph/build-dependencies/explicit-project-dependencies.ts',
            hash: '83db80dc9c4afea502e2532849405e20f41032c1',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/project-graph/build-dependencies/implicit-project-dependencies.ts',
            hash: '02cc7e77e095158047f74cf504e792864bbef4df',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/project-graph/build-dependencies/index.ts',
            hash: '7bfc04761edf30da8b4942d0af57eea30cf6806e',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/project-graph/build-dependencies/typescript-import-locator.ts',
            hash: 'a77f4ff5663e99e16fed01f65e501927fdf3a3d0',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/project-graph/build-nodes/build-nodes.ts',
            hash: '11849d5fe8567210007a7d7693c9761d03511268',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/project-graph/build-nodes/index.ts',
            hash: 'e8e4a7f3534b63c6c2bae9fbcf20b4d970407172',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/project-graph/build-nodes/npm-packages.ts',
            hash: 'a642bf6b5d4adb01a090b229ac968e0c0f4d123c',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/project-graph/build-nodes/workspace-projects.ts',
            hash: '27040dc1dd2ff2aeccb232122814946d7508b8e8',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/project-graph/index.ts',
            hash: 'c4e3d9461145ee15f0ec32e644b4792764448c6a',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/project-graph/operators.spec.ts',
            hash: '7007aadcf2b4e26d3e24e2182d36b52dac49ec04',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/project-graph/operators.ts',
            hash: '2568213d37e1c1b5245c48419e3c2cc1218ec7af',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/project-graph/project-graph-builder.spec.ts',
            hash: '44191e58068f8e92ea4455dd40dfa8497ef14665',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/project-graph/project-graph-builder.ts',
            hash: '2c13c64ad45c9e2adefa0346034d23d14e7f0ed4',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/project-graph/project-graph-models.ts',
            hash: '53d246eda0f0e40d0e7e4fdba63509c4667fdf00',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/project-graph/project-graph.spec.ts',
            hash: 'fe8028f98d8fc410d66bf1a487de250f22d2599c',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/project-graph/project-graph.ts',
            hash: '6a2b0e3396adcfac3a47b463c52f97955fff420b',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/shared-interfaces.ts',
            hash: '611971977166940738d27b8656a309d7cb8865b3',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/target-project-locator.spec.ts',
            hash: '0cb660c14b05cd17628126bce1dfb85453d728d9',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/target-project-locator.ts',
            hash: '9bc516bfd802fd877e83ad62c38d9ffc04cd9843',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-10-0-0/solution-tsconfigs.spec.ts',
            hash: 'a51129bd91ded011420e56fd3ba07b3f742b68a5',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-10-0-0/solution-tsconfigs.ts',
            hash: '306a4e1be5537390dab4fc8e5e0fa8f04631769c',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-10-0-0/update-10-0-0.ts',
            hash: '70c1478bfc5fa38f7e9cfd7aafd14ecc95c8cdeb',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-10-0-1/migrate-eslintrc.spec.ts',
            hash: '92781b894ebce23ac564071f8a473d2a2ebf0224',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-10-0-1/migrate-eslintrc.ts',
            hash: '24ffad375c43b8e4eb726101b14b677df26073d5',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-10-1-0/migrate-eslintrc-tsconfig-wildcard.spec.ts',
            hash: '82ec9daee586548e00b360329562009df4b711f4',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-10-1-0/migrate-eslintrc-tsconfig-wildcard.ts',
            hash: '7f7c8a87b3a5c04c62ccbee6acfe90767023f4d4',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-8-10-0/fix-tslint-json.spec.ts',
            hash: '58285e8424217ae0eee959926a42bfd2c80073cb',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-8-10-0/fix-tslint-json.ts',
            hash: '399aae1b384ffe7b833a4b94f21a2a3c18dc6f58',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-8-12-0/add-implicit-e2e-deps.spec.ts',
            hash: '5b2b377bf1083d6050faeefdc62a21dafcc52dc2',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-8-12-0/add-implicit-e2e-deps.ts',
            hash: 'e7b659fdd0c19d23e82729f10bfbc50870abebb4',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-8-12-0/update-enforce-boundary-lint-rule.spec.ts',
            hash: '87d192e6924701bbcad7d01d1d17776672541dcb',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-8-12-0/update-enforce-boundary-lint-rule.ts',
            hash: '7aa470a99ea655bfe58c1ff4887f4149d5428f97',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-8-12-0/update-package-json-deps.spec.ts',
            hash: '5f4eae6cafebe0b51deaf49af477c08fdfcb1fa2',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-8-12-0/update-package-json-deps.ts',
            hash: 'd97223d39efe56166b1406afd0fc94a87660a362',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-8-2-0/update-8-2-0.spec.ts',
            hash: '254baf928a6f068f75aad3735a66179a70a0bc7a',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-8-2-0/update-8-2-0.ts',
            hash: 'a6726cc9dd74b467f2ea869b0535e9070d2dd69c',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-8-3-0/rename-lint.ts',
            hash: '060e60cacef06a90943dfd13f15c5a10d3851020',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-8-3-0/update-8-3-0.spec.ts',
            hash: '44fd3596b6d5893bb6b1f93f10f36edd3cfae379',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-8-3-0/update-cypress-to-34.ts',
            hash: 'a10b6efb81a9ac9d1b821d7fb945630b7afcadbc',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-8-3-0/update-ng-cli-8-1.ts',
            hash: 'c5b7fb1289666bed1f0c3f9520b8e582b6371a36',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-8-4-0/add-nx-script.ts',
            hash: '30c472675e75a91ca4a76d1162d1aa72bac9229f',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-8-5-0/fix-tsconfig-lib-json.ts',
            hash: 'f486e97c213c491d5cd7fed978c377134af57009',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-8-5-0/update-8-5-0.spec.ts',
            hash: 'fe42a532ea0be4b9283b9bab02ec0b6332e94a02',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-9-0-0/update-9-0-0.ts',
            hash: '89beb2d13d301e215e81232fe04d5d4ed6979355',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-9-1-0/update-9-1-0.ts',
            hash: '5670f7c9a19a9b41ccc621b4fe34d23f8ce65985',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-9-1-0/update-lint-config.spec.ts',
            hash: '57708029d81e55e3287e484fa98bb7fcf405b904',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-9-1-0/update-lint-config.ts',
            hash: '708fc7e43eb390ce1dadce082b666b4f194a80cf',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-9-2-0/update-9-2-0.spec.ts',
            hash: 'dd74f32899f417834707663c9d56af7a2740f3f3',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-9-2-0/update-9-2-0.ts',
            hash: 'e3e386afe58816682410924f62e8eacc2ff5efd2',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-9-3-0/update-9-3-0.ts',
            hash: '5e26653ad64eea136aa6fef11508ff66ff1ccde0',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-9-4-0/add-decorate-cli.spec.ts',
            hash: 'c7670f667f98fe0c3a1d72f4c533c1fb87dbfda6',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-9-4-0/add-decorate-cli.ts',
            hash: '0f1e571cb1788f4087d0a7a0ca73121bb1650020',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-9-4-0/update-eslint-config.spec.ts',
            hash: 'c551a2f3cb813a22cee53d6181ab2d5e6bb9ca4c',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-9-4-0/update-eslint-config.ts',
            hash: '910fc93e666389cd6f29f7c5ae7edb7fed5fab05',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-9-4-0/update-linters-exclude.spec.ts',
            hash: '0992e661180537c4d108e6133ac4251bc89de8cf',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-9-4-0/update-linters-exclude.ts',
            hash: 'c633705b43a77c4fc3110a3309d5b0bd9abd64cd',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/init/files/.prettierignore',
            hash: '931aad9929fc2cad371db36caa49ed4de357ab9d',
            ext: '',
          },
          {
            file: 'packages/workspace/src/schematics/init/files/karma.conf.js',
            hash: '2c5a16ceedb8c308f6adf452d6c8aad215c9be88',
            ext: '.js',
          },
          {
            file:
              'packages/workspace/src/schematics/init/files/tools/schematics/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file:
              'packages/workspace/src/schematics/init/files/tools/tsconfig.tools.json',
            hash: '5f6f15d74e572a32331ce7495175afdf25b604fc',
            ext: '.json',
          },
          {
            file: 'packages/workspace/src/schematics/init/init.spec.ts',
            hash: 'c5fb279e02bfe9ccc524a958a6bd77c5d5c32c46',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/schematics/init/init.ts',
            hash: 'e23995a049232b1ec636b57594110902eef6dd8f',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/schematics/init/schema.d.ts',
            hash: '09a5184fa6c862432c3ef0ffc0d21c7079e674ff',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/schematics/init/schema.json',
            hash: 'f51f94793d68498da14df3bfbba09ca90b54a5b6',
            ext: '.json',
          },
          {
            file:
              'packages/workspace/src/schematics/library/files/lib/README.md',
            hash: 'f2336f89d3285af79f820f5f253ba913902cbefe',
            ext: '.md',
          },
          {
            file:
              'packages/workspace/src/schematics/library/files/lib/src/index.ts__tmpl__',
            hash: '32176b3ef175e1c81af513d1381762f4dca7e1b2',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/workspace/src/schematics/library/files/lib/src/lib/__fileName__.ts__tmpl__',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/workspace/src/schematics/library/files/lib/tsconfig.json',
            hash: '9b3cf74e56a30a4613e649c9d8371bde45bcb655',
            ext: '.json',
          },
          {
            file:
              'packages/workspace/src/schematics/library/files/lib/tsconfig.lib.json',
            hash: 'f6326068a44d676ef3936d71be5281b42be00250',
            ext: '.json',
          },
          {
            file: 'packages/workspace/src/schematics/library/library.spec.ts',
            hash: '25fa094bc7747516f0ae9f75f9eb23f4ed7e2d92',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/schematics/library/library.ts',
            hash: '42596a14fe4cad48e52320e38d2766b939e589e2',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/schematics/library/schema.d.ts',
            hash: '9b8a838b24b9c74c9bc722433f7d1fd813aae0ab',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/schematics/library/schema.json',
            hash: 'e6a558684da3229b04ee09030595efe4759a4876',
            ext: '.json',
          },
          {
            file:
              'packages/workspace/src/schematics/move/lib/check-destination.spec.ts',
            hash: '167cc938e0e73a22e99f02265effb2e730daae72',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/move/lib/check-destination.ts',
            hash: 'f639d5f27e9f4c8d57f3328d5a029e33bcf2d51e',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/move/lib/move-project.spec.ts',
            hash: '6d4f3111e9d8eb40c0d74640e95886c93e41fde9',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/schematics/move/lib/move-project.ts',
            hash: '4babf5e8879b093aab0703c7097bda37221b131c',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/move/lib/update-cypress-json.spec.ts',
            hash: '766d352d4c776b5f72a8528293376871224c796d',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/move/lib/update-cypress-json.ts',
            hash: 'bc0ee760e279f19c7768d9a50085d3fd1f9a6166',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/move/lib/update-imports.spec.ts',
            hash: 'ea3d9bade520355bca2b444cc350f0278d0c8620',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/move/lib/update-imports.ts',
            hash: 'd91cdb34d82f676219575bd483809dd1812a276a',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/move/lib/update-jest-config.spec.ts',
            hash: '33b5b8b010bff56f6eb53468ecb2524e2721c84f',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/move/lib/update-jest-config.ts',
            hash: 'd31a7ce765e9d2768c2a77c0620512856660ab09',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/move/lib/update-nx-json.spec.ts',
            hash: '716e2db06669fdba4f782b9890b64446f5836976',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/move/lib/update-nx-json.ts',
            hash: '92f21dd2453ebbc2b2e195b71c6e67f7ec660bf9',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/move/lib/update-project-root-files.spec.ts',
            hash: '6ca9ffd6c55dd2c986ebb478beba5b75d41fba86',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/move/lib/update-project-root-files.ts',
            hash: 'a372e99a75b9649272da3c80f01287dfefe60372',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/move/lib/update-workspace.spec.ts',
            hash: 'da92346a572b43385a12caefabbca88891259ea6',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/move/lib/update-workspace.ts',
            hash: 'af2559fadb20ac058e7d8ac2d13896478b859fc9',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/schematics/move/lib/utils.ts',
            hash: '32d261b39748d8d6e0fe69e939a2016acf34bce2',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/schematics/move/move.ts',
            hash: '7225df1cce0be02c4ae448363346bf4efdc9e0f6',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/schematics/move/schema.d.ts',
            hash: '50ed425b41447d90dcf1184ef5424a1ca065090f',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/schematics/move/schema.json',
            hash: '87563bed7e4067ffd60811ca941a9f6765dc30f5',
            ext: '.json',
          },
          {
            file: 'packages/workspace/src/schematics/ng-new/ng-new.ts',
            hash: '3c622d8aeae2c618d91a2c16ee0335d620136be3',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/schematics/ng-new/schema.json',
            hash: '90550eba4b2d216779c07d61467e2ffd0db06bbd',
            ext: '.json',
          },
          {
            file: 'packages/workspace/src/schematics/preset/preset.spec.ts',
            hash: '26a43ca97dd1f6451c15d72366ca9a028e6adcbb',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/schematics/preset/preset.ts',
            hash: 'd28a9531d6e41519ad9cc52dff7a685339fcd105',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/schematics/preset/schema.d.ts',
            hash: '904ef778d8acdb246a584b7069b928a78fbf0c1f',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/schematics/preset/schema.json',
            hash: '474e2483300901a81698be03076f57170db64c62',
            ext: '.json',
          },
          {
            file:
              'packages/workspace/src/schematics/remove/lib/check-dependencies.spec.ts',
            hash: '87bde5f483cb5b1cc5c71ca2b64965d57f960a1f',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/remove/lib/check-dependencies.ts',
            hash: '5dd99481554f4c611479485df2758da111e77f85',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/remove/lib/check-targets.spec.ts',
            hash: '8f51a3c51040affef2aa034d5aec2f6d4f64d14e',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/remove/lib/check-targets.ts',
            hash: '9c98ea93be5b7fb103c69ffa00fd42775308c827',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/remove/lib/remove-project.spec.ts',
            hash: 'd856534f3d9a72f7033895f01751fa9bb597285d',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/remove/lib/remove-project.ts',
            hash: '965789b9bc317004a79e3317ee1ce96455f11729',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/remove/lib/update-nx-json.spec.ts',
            hash: 'c06083ad531a0c03caf884cd46180215adb868b4',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/remove/lib/update-nx-json.ts',
            hash: 'c165ea6a7f44f714bbac7e72e25d6b06e3df8dad',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/remove/lib/update-tsconfig.spec.ts',
            hash: '1c8b85fae1c560c45bdeae4de0e0479db615d42a',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/remove/lib/update-tsconfig.ts',
            hash: '58a96fc9c12161ab11f93ca045e7cb4bf1cfd10f',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/remove/lib/update-workspace.spec.ts',
            hash: '196addadefbcdf56212422969451a59bafc4b364',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/remove/lib/update-workspace.ts',
            hash: 'eabdacbbd2629faf2a9d8b5124bcc88b8eb14fea',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/schematics/remove/remove.ts',
            hash: 'b409917c358e1e2816710bc754602f057030b416',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/schematics/remove/schema.d.ts',
            hash: '49ee03376b2679c258ffb2f811a250203f81f5d5',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/schematics/remove/schema.json',
            hash: 'f839c53ea431d34b01ac6ad2361752ac8c1b74ac',
            ext: '.json',
          },
          {
            file:
              'packages/workspace/src/schematics/run-commands/run-commands.spec.ts',
            hash: 'a8c581abf85abc2096688299153ab9706bec851e',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/run-commands/run-commands.ts',
            hash: 'b5d6b119ec4ab801f04a467acc4ad5f55676117d',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/schematics/run-commands/schema.d.ts',
            hash: 'd0d1ebe0c1383f3b0c2d8395105b1d3a89825194',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/schematics/run-commands/schema.json',
            hash: 'c56651700b48783cd6722172f273713aa326e43f',
            ext: '.json',
          },
          {
            file: 'packages/workspace/src/schematics/shared-new/shared-new.ts',
            hash: '3194f7b3b51e1088c10f137e3767bab5b1ab6177',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/schematics/tao-new/schema.json',
            hash: 'fd6f43e2d5481f542ed3629ce4336c4134b4abb9',
            ext: '.json',
          },
          {
            file: 'packages/workspace/src/schematics/tao-new/tao-new.ts',
            hash: '37e31f67462d557d98dacda4923d37ab8480141d',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/utils/decorate-angular-cli.js__tmpl__',
            hash: '3db6091a598f04ea34edb130c59d3a3b08535db1',
            ext: '.js__tmpl__',
          },
          {
            file:
              'packages/workspace/src/schematics/workspace-schematic/files/__name__/index.ts__tmpl__',
            hash: 'd652e3bd2321059e37fb12b109a0eb1f3a431737',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/workspace/src/schematics/workspace-schematic/files/__name__/schema.json',
            hash: '1aaec4fca8195b9ef57547b42fe80f1763bbe4f3',
            ext: '.json',
          },
          {
            file:
              'packages/workspace/src/schematics/workspace-schematic/schema.d.ts',
            hash: '13e049e4b1cd10337fe12395c79380c93137308b',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/workspace-schematic/schema.json',
            hash: 'cd5a35e173e07775dc950d79d5f16020a9195308',
            ext: '.json',
          },
          {
            file:
              'packages/workspace/src/schematics/workspace-schematic/workspace-schematic.spec.ts',
            hash: 'febd59286d8554195c53ca576a0459ba08bd55bc',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/workspace-schematic/workspace-schematic.ts',
            hash: '9f904cff4f56d5a4085a71c85b23e74bad0002f4',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/schematics/workspace/files/__dot__editorconfig',
            hash: '6e87a003da89defd554080af5af93600cc9f91fe',
            ext: '',
          },
          {
            file:
              'packages/workspace/src/schematics/workspace/files/__dot__gitignore',
            hash: 'ee5c9d8336b76b3bb5658d0888bdec86eb7b0990',
            ext: '',
          },
          {
            file:
              'packages/workspace/src/schematics/workspace/files/__dot__prettierignore',
            hash: 'd0b804da2a462044bb1c63364440b2c2164e86ad',
            ext: '',
          },
          {
            file:
              'packages/workspace/src/schematics/workspace/files/__dot__prettierrc',
            hash: '69909e172a06ea5d8aa436d9bd8fdce3c55c4b1e',
            ext: '',
          },
          {
            file:
              'packages/workspace/src/schematics/workspace/files/__workspaceFile__.json',
            hash: 'ae27a8004733b65b82d44fa44baeb9b8fc6fdf6f',
            ext: '.json',
          },
          {
            file:
              'packages/workspace/src/schematics/workspace/files/.vscode/extensions.json__tmpl__',
            hash: 'c912f2f744b24ffbb68bb6085f51bb48fa883190',
            ext: '.json__tmpl__',
          },
          {
            file: 'packages/workspace/src/schematics/workspace/files/nx.json',
            hash: 'baf65ce4ffc21f787bf7a6c444488badfe0f164d',
            ext: '.json',
          },
          {
            file:
              'packages/workspace/src/schematics/workspace/files/package.json__tmpl__',
            hash: '7304ad9d5bd3b1dbe4577485c34ee48d8d68db02',
            ext: '.json__tmpl__',
          },
          {
            file:
              'packages/workspace/src/schematics/workspace/files/README.md__tmpl__',
            hash: 'fbae411e4a31d4917934b0c62d80f0637892419e',
            ext: '.md__tmpl__',
          },
          {
            file:
              'packages/workspace/src/schematics/workspace/files/tools/schematics/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file:
              'packages/workspace/src/schematics/workspace/files/tools/tsconfig.tools.json',
            hash: '5f6f15d74e572a32331ce7495175afdf25b604fc',
            ext: '.json',
          },
          {
            file:
              'packages/workspace/src/schematics/workspace/files/tsconfig.base.json',
            hash: 'a5099b58079704eb4ca766fa5674956107bf44c9',
            ext: '.json',
          },
          {
            file: 'packages/workspace/src/schematics/workspace/schema.d.ts',
            hash: '1874578dfae2328e39f287ca3c80bb7dd3e4693d',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/schematics/workspace/schema.json',
            hash: 'ad3b3c4b9b70969fcc9405bf73c309b67661cbc1',
            ext: '.json',
          },
          {
            file:
              'packages/workspace/src/schematics/workspace/workspace.spec.ts',
            hash: '72e6143d14dd876b4bd9a4ab4017db5cd4a81055',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/schematics/workspace/workspace.ts',
            hash: '22506437250e0ecab96b0bad24fb687f24c8048c',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/tasks-runner/cache.ts',
            hash: '9495a35405b2f12fa144aab5dd8aea28b232f674',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/tasks-runner/default-reporter.ts',
            hash: '9c1b33730c3779944d06c67cbc8b2aadbc134bbe',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/tasks-runner/default-tasks-runner.ts',
            hash: '8278b673a84b8b03e76c2f55d197d9baf22259e3',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/tasks-runner/empty-reporter.ts',
            hash: '5e73c4a115d036d30dcacfef3a43b602fbc05203',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/tasks-runner/remove-old-cache-records.ts',
            hash: 'e21d3a812d3933ce4c93bab6ba69cfa244324430',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/tasks-runner/run-command.spec.ts',
            hash: 'a154723c93e45721f844578754c3f53649729109',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/tasks-runner/run-command.ts',
            hash: 'a83a24be69d2ceec6c920adbd4ceb1c68ac160cc',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/tasks-runner/run-one-reporter.ts',
            hash: '3377132ac5abda00216a830909575423a6c1c6b4',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/tasks-runner/task-orchestrator.ts',
            hash: '785d394e5c6cda3ae69dd32146da2bd3dca06a43',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/tasks-runner/task-orderer.spec.ts',
            hash: 'bd7d9d070ccb0ccccabe6bf9150b1b504d16d680',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/tasks-runner/task-orderer.ts',
            hash: '34849c873acf000335b9118ba066387e55c4b9c4',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/tasks-runner/tasks-runner-v1.ts',
            hash: '0e0eeb57fe5dd3d4e12f1a73be93c7d9a2b45e14',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/tasks-runner/tasks-runner-v2.ts',
            hash: '7b6e1f3e150311050154be60de2b075cddd47d64',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/tasks-runner/tasks-runner.ts',
            hash: 'f7e4af72e51c2c1fdf7c18f883cf79b9491eea67',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/tasks-runner/utils.spec.ts',
            hash: 'df04766ec9fb011020ae9ba91ce3e8b29f1faa37',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/tasks-runner/utils.ts',
            hash: '773d17384cc203a522a19a83df557561a24c9fb1',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/tslint/nxEnforceModuleBoundariesRule.spec.ts',
            hash: 'f8257d14832c011eb8a11e48a4b3f901a456ff79',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/tslint/nxEnforceModuleBoundariesRule.ts',
            hash: '00940f1ce6e69b05e68a8ec4b4813cbc2f295619',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/app-root.ts',
            hash: 'f410d345fa170801eb5841191bc9ae49aa56cb91',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/ast-utils.spec.ts',
            hash: '02b28e501b176d9078c892169d2401a39b8a0945',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/ast-utils.ts',
            hash: '99874dcb4c2736f266e31b3b402eab109c6150d7',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/buildable-libs-utils.spec.ts',
            hash: 'c58c382e666b8afe8d2517d5a910bc12ef939534',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/buildable-libs-utils.ts',
            hash: 'cd725d57e8cca7ea6253ffa998cda6a571e5368f',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/cli-config-utils.spec.ts',
            hash: 'bdb36d99b9856260a14203cb26b95186bb94db38',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/cli-config-utils.ts',
            hash: 'dbeb82758bda63c3e65b1d55d657b7bfadf1b108',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/common.spec.ts',
            hash: 'd7226f14090716853ebf5831012ceced6b090f1f',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/common.ts',
            hash: '2681a282bba77ed617b983b1c4a57c157cee9121',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/detect-package-manager.ts',
            hash: 'b68af146acdd8de070695d3e6399e3ced847a966',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/fileutils.spec.ts',
            hash: '569be9a37b37ed35602d71827adebda16e5b6bee',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/fileutils.ts',
            hash: 'bdd5b33522cb110cbb230d30c1610a13649aabab',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/json-diff.spec.ts',
            hash: '032381884374a2cfc2f02b10b9ef652ae502b186',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/json-diff.ts',
            hash: 'a723ee63b7448a8a5bbd70356d51ed06b554d472',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/lint.ts',
            hash: '05917f37bbb02b8d24b939629faba020e04032da',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/name-utils.spec.ts',
            hash: 'ffd4ed30df373d3dec09b8f45eb7d4ab1fa28d59',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/name-utils.ts',
            hash: 'aefebb8d08d758677f14b1e46046b8c043b7abc8',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/output.ts',
            hash: '16a833a51dbdc65981c4f4b4a65382e98f1c3e70',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/perf-logging.ts',
            hash: 'f3b86436e28a566af275873f048776b680fc2317',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/utilities/plugins/community-plugins.ts',
            hash: 'b8eb35cc82541340e8333c05f7392d54ca994d95',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/plugins/core-plugins.ts',
            hash: '2de09f2eec860a03efe71718b736533b140d0447',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/plugins/index.ts',
            hash: '007409e5443a7051731e40bb3ef82376c75451cf',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/utilities/plugins/installed-plugins.ts',
            hash: '35690c04e9548014a7e7aa2b0c46db37d8826d3d',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/plugins/models.ts',
            hash: '57561297a50cd702a338dbee0496342e65d7d291',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/utilities/plugins/plugin-capabilities.ts',
            hash: 'fd688e795d47d80f44d5e5b317dcfda77620983a',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/plugins/shared.ts',
            hash: '534feccefec66b287622c7a2c6206b234d160ac2',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/project-graph-utils.ts',
            hash: '699d97015f039005ee481d46bbc48cf524a157e2',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/project-type.ts',
            hash: '17417ade108b01313cbf6e126f0919c9be321057',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/rules/add-install-task.ts',
            hash: 'ab7fb6c38e9082ccea1e242317f582572ea9c214',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/utils/rules/check-project-exists.spec.ts',
            hash: '79a1ae21d32b8082f31da13ae0315285396b4f80',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/rules/check-project-exists.ts',
            hash: '021a6ca20283bbe9a7aa81f15cb6276f9a7f0998',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/rules/deleteFile.ts',
            hash: 'e3ba0cdaadd53108566e1f8605370c368c75739d',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/rules/format-files.spec.ts',
            hash: '57c65ee008b0e64b2c54a0cafb9c07a1c2681f7b',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/rules/format-files.ts',
            hash: '2654be28128d1e98eef95ce54257e875e56753a2',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/rules/ng-add.ts',
            hash: 'c701f53a124540fae605110377263fa715355770',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/rules/to-js.ts',
            hash: '99937c2cbda77d922ea35a766c70bb0a3d2361c6',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/utils/rules/update-karma-conf.spec.ts',
            hash: '1bd3510ef79e51b81987debb3119d4f464f26d13',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/rules/update-karma-conf.ts',
            hash: '443e3bb3e32a2e634d32d48365ba547a84eabea0',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/utils/rules/visit-not-ignored-files.ts',
            hash: '60ce78e111c86a82ac944c97ef2eb7a7eb491ef7',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/rules/workspace.spec.ts',
            hash: '66b3547554e1ce04a3f81ff13c77da6de8777595',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/rules/workspace.ts',
            hash: '75c2796d20a89565513e34281a1e1916793ddb92',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/runtime-lint-utils.ts',
            hash: '1cf120c37a3c9b243ddfb7dc4d41953f0ea4bb7d',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/strings.ts',
            hash: '40fe77da089104e37489ae52a739c4b33bf38873',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/strip-source-code.spec.ts',
            hash: '79ef7faca5e9756c35c1044755adc76f851a95fe',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/strip-source-code.ts',
            hash: '6ca8e89d9e42b6cbb5441fef65d3c7e1c4abd6a9',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/testing-utils.ts',
            hash: 'ce18ec909fc4ac286475511af16d62681e1ed317',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/testing.ts',
            hash: 'c9a4eced54413ca3a2240aa40ffe69172b466c55',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/typescript.ts',
            hash: '2a6b93a8e2975037825d808651d1c73fe93dc954',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/utils/update-packages-in-package-json.ts',
            hash: 'f8cdd68897f5b7f8984dbf3b71cbc6dd0a5c9291',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/update-task.ts',
            hash: 'c2a03354582a95dd7fe6f6278d8b37a1e58440c9',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/version-utils.ts',
            hash: '9e693139ee90478b303b6970cca822211fa1aa46',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/versions.ts',
            hash: '76be1c35c9eee85d048a9d5c699ddfbfaa37f287',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/workspace.spec.ts',
            hash: 'ff27fec4eab7795d383384390be73f7c24de19b1',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/workspace.ts',
            hash: 'b897d0f4086ad72691102bc1b3688e2b678505f6',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/tasks-runners/default.ts',
            hash: '9fe50fe4f8235f6afc1b4d3bce6e015c0972b1cc',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/testing.ts',
            hash: 'cd585f1ddaeb3336631fa3cec5d8ece662cfea3f',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/tsconfig.json',
            hash: '58bd2c97a66f5e5ea5d05c8a5709ee79bad02094',
            ext: '.json',
          },
          {
            file: 'packages/workspace/tsconfig.lib.json',
            hash: '037d796f286235dce67c9e648d2d42adcc61ccd7',
            ext: '.json',
          },
          {
            file: 'packages/workspace/tsconfig.spec.json',
            hash: '559410b96af6781ac3e7cf348bf4a710b4009481',
            ext: '.json',
          },
        ],
      },
    },
    storybook: {
      name: 'storybook',
      type: 'lib',
      data: {
        root: 'packages/storybook',
        sourceRoot: 'packages/storybook',
        projectType: 'library',
        schematics: {},
        architect: {
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/storybook/jest.config.js',
              passWithNoTests: true,
            },
          },
          'build-base': {
            builder: '@nrwl/node:package',
            options: {
              outputPath: 'build/packages/storybook',
              tsConfig: 'packages/storybook/tsconfig.lib.json',
              packageJson: 'packages/storybook/package.json',
              main: 'packages/storybook/index.ts',
              updateBuildableProjectDepsInPackageJson: false,
              assets: [
                {
                  input: 'packages/storybook',
                  glob: '**/lib-files/.storybook/**',
                  output: '/',
                },
                {
                  input: 'packages/storybook',
                  glob: '**/root-files/.storybook/**',
                  output: '/',
                },
                {
                  input: 'packages/storybook',
                  glob: '**/*.json',
                  output: '/',
                },
                {
                  input: 'packages/storybook',
                  glob: '**/*.js',
                  output: '/',
                },
                'LICENSE',
              ],
            },
          },
          build: {
            builder: '@nrwl/workspace:run-commands',
            outputs: ['build/packages/storybook'],
            options: {
              commands: [
                {
                  command: 'nx build-base storybook',
                },
                {
                  command: 'node ./scripts/copy-readme.js storybook',
                },
              ],
              parallel: false,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/storybook/.eslintrc',
            hash: '9afd5d63f09f7d350b479cea3984ab4d8920d964',
            ext: '',
          },
          {
            file: 'packages/storybook/builders.json',
            hash: '6a0374d8856c11d0f2e2c7c213c8c25e6eb2fe87',
            ext: '.json',
          },
          {
            file: 'packages/storybook/collection.json',
            hash: 'fd811242fd6b7366ae52fd71e27571cb778b2a3a',
            ext: '.json',
          },
          {
            file: 'packages/storybook/index.ts',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.ts',
          },
          {
            file: 'packages/storybook/jest.config.js',
            hash: '1086355ddf842d9d0d668f2162eda44d0cee7136',
            ext: '.js',
          },
          {
            file: 'packages/storybook/migrations.json',
            hash: 'bcae00879428405a4ec1ff382d315212b3cca290',
            ext: '.json',
          },
          {
            file: 'packages/storybook/package.json',
            hash: '9de6164ff4034397f764d3fe1d6304449ae42cda',
            ext: '.json',
          },
          {
            file: 'packages/storybook/README.md',
            hash: 'a63596525e6e6977b929969b21993c87d657701e',
            ext: '.md',
          },
          {
            file:
              'packages/storybook/src/builders/build-storybook/build-storybook.impl.spec.ts',
            hash: '3dc8151d2ae15d6cb5c1ca965f6376602b953bbb',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/builders/build-storybook/build-storybook.impl.ts',
            hash: '9b31a4d9b5e2f2584fc178662a4f951640d1bbdf',
            ext: '.ts',
          },
          {
            file: 'packages/storybook/src/builders/build-storybook/schema.json',
            hash: 'd4800d984e1181fce37ac87ef195af62553fa9f7',
            ext: '.json',
          },
          {
            file: 'packages/storybook/src/builders/storybook/schema.json',
            hash: 'd9efb3f23e05bf733ca18c4f52ef000264930313',
            ext: '.json',
          },
          {
            file:
              'packages/storybook/src/builders/storybook/storybook.impl.spec.ts',
            hash: '1dea1a833570d4f76f87fd181b6d316e04d366bf',
            ext: '.ts',
          },
          {
            file: 'packages/storybook/src/builders/storybook/storybook.impl.ts',
            hash: 'f588c8cb1e430e8ee9210415768f8a9765c2cc17',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/migrations/update-10-0-12/update-10-0-12.spec.ts',
            hash: '7791e044763e64bc5048c4dccdf182b0e0427be9',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/migrations/update-10-0-12/update-10-0-12.ts',
            hash: '07433a2a9db5040a6a4134057807e33d70f20598',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/migrations/update-8-8-2/update-builder-8-8-2.spec.ts',
            hash: '614b77a9b40eded0944fa0f7feda6be9c630b619',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/migrations/update-8-8-2/update-builder-8-8-2.ts',
            hash: '27afb07e114da39e5266ed02ef388706e50cfa72',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/migrations/update-9-0-0/update-9-0-0.ts',
            hash: '89beb2d13d301e215e81232fe04d5d4ed6979355',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/migrations/update-9-2-0/update-9-2-0.ts',
            hash: '240e7be70556ef940b73945a573964a852156770',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/schematics/configuration/configuration.spec.ts',
            hash: '0b8e1cb8224200a017cb0175d0cd94915a9f7a44',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/schematics/configuration/configuration.ts',
            hash: '8e4bccf17654562c4a5153ff171a960010b39a17',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/schematics/configuration/lib-files/.storybook/addons.js__tmpl__',
            hash: '9ba582015be3ae096522cfcf0d08bc7abd7aa2df',
            ext: '.js__tmpl__',
          },
          {
            file:
              'packages/storybook/src/schematics/configuration/lib-files/.storybook/config.js__tmpl__',
            hash: '72c809f190fe675f3c33bd7af4b1274d3d8c1b5d',
            ext: '.js__tmpl__',
          },
          {
            file:
              'packages/storybook/src/schematics/configuration/lib-files/.storybook/tsconfig.json__tmpl__',
            hash: '4b4497923f755760f62e28880b66dee58e96ce08',
            ext: '.json__tmpl__',
          },
          {
            file:
              'packages/storybook/src/schematics/configuration/lib-files/.storybook/webpack.config.js__tmpl__',
            hash: '415331ccc0b428d6134bcbcf59a302de35a0bad9',
            ext: '.js__tmpl__',
          },
          {
            file:
              'packages/storybook/src/schematics/configuration/root-files/.storybook/addons.js',
            hash: '6622fe475d5fef5a139c6fbe3e5953ce7ef63b97',
            ext: '.js',
          },
          {
            file:
              'packages/storybook/src/schematics/configuration/root-files/.storybook/tsconfig.json',
            hash: '4b11015439f2ee0cbaa8e267d0ddafbed95410a4',
            ext: '.json',
          },
          {
            file:
              'packages/storybook/src/schematics/configuration/root-files/.storybook/webpack.config.js',
            hash: '69fcea76977dc0febc9dfe4451c44c96826e544d',
            ext: '.js',
          },
          {
            file: 'packages/storybook/src/schematics/configuration/schema.d.ts',
            hash: '844b0655948850359bcbb4cbf611f4f287345e2c',
            ext: '.ts',
          },
          {
            file: 'packages/storybook/src/schematics/configuration/schema.json',
            hash: '0a68879f40a78da33f3e0b471bd57557237777cd',
            ext: '.json',
          },
          {
            file:
              'packages/storybook/src/schematics/cypress-project/cypress-project.spec.ts',
            hash: '9c23144c9ad44aad2484b533377c79e37a501a64',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/schematics/cypress-project/cypress-project.ts',
            hash: '8114a4e2adc2103de73dd36ba9136b0772466c31',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/schematics/cypress-project/schema.json',
            hash: '2d2f8414f1271995820ecbd9fef4257e38380a79',
            ext: '.json',
          },
          {
            file: 'packages/storybook/src/schematics/init/init.spec.ts',
            hash: 'cc61f44b8f7214b7f038b6b02ff2c5f3af65de35',
            ext: '.ts',
          },
          {
            file: 'packages/storybook/src/schematics/init/init.ts',
            hash: '8e552c7cd5134c7dcd941bd082474c80ab7b33a3',
            ext: '.ts',
          },
          {
            file: 'packages/storybook/src/schematics/init/schema.d.ts',
            hash: '385349b0fce35c26ca6e09289f652321e0e4d223',
            ext: '.ts',
          },
          {
            file: 'packages/storybook/src/schematics/init/schema.json',
            hash: 'c6aa68d25805dc5cab731f491a42c7b6813860f7',
            ext: '.json',
          },
          {
            file: 'packages/storybook/src/utils/root.ts',
            hash: '992f28f31ba3a3a891d8bda8bbaf0805ded7babc',
            ext: '.ts',
          },
          {
            file: 'packages/storybook/src/utils/testing.ts',
            hash: '644548267a7a2dd76ca28bea59876dac41be3412',
            ext: '.ts',
          },
          {
            file: 'packages/storybook/src/utils/utils.ts',
            hash: '4caf11c542b9f81ee28f54a0bf75cb0efc95c2d8',
            ext: '.ts',
          },
          {
            file: 'packages/storybook/src/utils/versions.ts',
            hash: '20dedd9a3c462c42de2880422a2319690a5419bc',
            ext: '.ts',
          },
          {
            file: 'packages/storybook/tsconfig.json',
            hash: '58bd2c97a66f5e5ea5d05c8a5709ee79bad02094',
            ext: '.json',
          },
          {
            file: 'packages/storybook/tsconfig.lib.json',
            hash: 'dbe90e0855d2ef980595dcc17f577088662cfb4d',
            ext: '.json',
          },
          {
            file: 'packages/storybook/tsconfig.spec.json',
            hash: 'd6ae6669d75fc5beb184f28966262e1762b9623c',
            ext: '.json',
          },
        ],
      },
    },
    'nx-plugin': {
      name: 'nx-plugin',
      type: 'lib',
      data: {
        root: 'packages/nx-plugin',
        sourceRoot: 'packages/nx-plugin',
        projectType: 'library',
        schematics: {},
        architect: {
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/nx-plugin/jest.config.js',
              passWithNoTests: true,
            },
          },
          'build-base': {
            builder: '@nrwl/node:package',
            options: {
              outputPath: 'build/packages/nx-plugin',
              tsConfig: 'packages/nx-plugin/tsconfig.lib.json',
              packageJson: 'packages/nx-plugin/package.json',
              main: 'packages/nx-plugin/index.ts',
              updateBuildableProjectDepsInPackageJson: false,
              assets: [
                {
                  input: 'packages/nx-plugin',
                  glob: '**/files/**',
                  output: '/',
                },
                {
                  input: 'packages/nx-plugin',
                  glob: '**/files/**/.gitkeep',
                  output: '/',
                },
                {
                  input: 'packages/nx-plugin',
                  glob: '**/*.json',
                  output: '/',
                },
                {
                  input: 'packages/nx-plugin',
                  glob: '**/*.js',
                  output: '/',
                },
                'LICENSE',
              ],
            },
          },
          build: {
            builder: '@nrwl/workspace:run-commands',
            outputs: ['build/packages/nx-plugin'],
            options: {
              commands: [
                {
                  command: 'nx build-base nx-plugin',
                },
                {
                  command: 'node ./scripts/copy-readme.js nx-plugin',
                },
              ],
              parallel: false,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/nx-plugin/.eslintrc',
            hash: '9afd5d63f09f7d350b479cea3984ab4d8920d964',
            ext: '',
          },
          {
            file: 'packages/nx-plugin/builders.json',
            hash: '757bbb4509fd91b834ff805c5808a6c0607a4990',
            ext: '.json',
          },
          {
            file: 'packages/nx-plugin/collection.json',
            hash: 'ec33454813f922240d2f820f5d8849ab59abf0a2',
            ext: '.json',
          },
          {
            file: 'packages/nx-plugin/index.ts',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/jest.config.js',
            hash: '05d0b90b8eff53914694ccaf3dc16413bab3b557',
            ext: '.js',
          },
          {
            file: 'packages/nx-plugin/migrations.json',
            hash: 'd895a0461f27c0099af6a1a43f7a2883cb280564',
            ext: '.json',
          },
          {
            file: 'packages/nx-plugin/package.json',
            hash: '6b0dce594c6ef3d2961ca19f960ae4125717bd4a',
            ext: '.json',
          },
          {
            file: 'packages/nx-plugin/README.md',
            hash: '4fa7af46b5b04edf64e9ac0b7ad5ef094a293eaa',
            ext: '.md',
          },
          {
            file: 'packages/nx-plugin/src/builders/e2e/e2e.impl.ts',
            hash: 'b195873568e500f409c291b554462eaef925e736',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/builders/e2e/schema.d.ts',
            hash: 'de597dd0e4a910887c2c0b679061f7f8c866d4fa',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/builders/e2e/schema.json',
            hash: '05754552e3ed73c83ea5dd828c53881726857676',
            ext: '.json',
          },
          {
            file:
              'packages/nx-plugin/src/migrations/update-10-2-0/update-10-2-0.spec.ts',
            hash: '64b8db3f9a901dba2a6e1cedbcf7f5677b014699',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/migrations/update-10-2-0/update-10-2-0.ts',
            hash: '1027e5c11c5846b176cad9ce6bfb345d536fbbe8',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/builder/builder.spec.ts',
            hash: '4fc36b48e05bdccc3d799dc325bc7f8566bc8f7a',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/builder/builder.ts',
            hash: 'd8962d19f8c6325c9d8bb6204745e1cd18c03f76',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/builder/files/builder/__fileName__/builder.spec.ts__tmpl__',
            hash: '666f192051e1acd314f34bffc3cd3bf8731c4bce',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/builder/files/builder/__fileName__/builder.ts__tmpl__',
            hash: '10364e343f58bf126cbcdb097f111806b6a004ba',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/builder/files/builder/__fileName__/schema.d.ts__tmpl__',
            hash: '7511d86deb300119b39559d173aee13c56aabe63',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/builder/files/builder/__fileName__/schema.json__tmpl__',
            hash: '2782505ea15b3e7282e6377a64505e8de5578705',
            ext: '.json__tmpl__',
          },
          {
            file: 'packages/nx-plugin/src/schematics/builder/lib/add-files.ts',
            hash: '498bbb39692697f354af6cb226ca5a039034741c',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/builder/lib/normalize-options.ts',
            hash: '8f339fe219359bcb89e3176c4f99a4c4e151dae6',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/builder/lib/update-builders-json.ts',
            hash: '53a8cbca868581b2645e9fbb49fbcfb5eeed5a68',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/builder/schema.d.ts',
            hash: 'f3e04572c5202e35a8d9a3a2c3dccecfc1aaa16f',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/builder/schema.json',
            hash: '9638bec2f820c21e3244865d78219386a743fdad',
            ext: '.json',
          },
          {
            file: 'packages/nx-plugin/src/schematics/e2e-project/e2e.spec.ts',
            hash: 'e9073dd7df1ec124511e84c05665f88c923d5c9a',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/e2e-project/e2e.ts',
            hash: 'a164de08fd648fde70d3f45000215e0de497d66a',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/e2e-project/files/tests/__pluginName__.test.ts__tmpl__',
            hash: '11bc9c8abaab507c68480a3d05f5e1f3c281946f',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/e2e-project/files/tsconfig.json__tmpl__',
            hash: 'c31c52e04ce1a561344054702b387be478b60109',
            ext: '.json__tmpl__',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/e2e-project/lib/add-files.ts',
            hash: '09ef6c8bfc697480bdbf70de6b4a67402ccf88e7',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/e2e-project/lib/add-jest.ts',
            hash: '3c08bd037b974365a1619e018ea10d4cb6ed6ce2',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/e2e-project/lib/normalize-options.ts',
            hash: 'c431aaf8e08b6918af88fec349e10d1304b32aee',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/e2e-project/lib/update-nx-json.ts',
            hash: '56d5ef150029b406f021d73a65e34b16a1803fe0',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/e2e-project/lib/update-workspace-json.ts',
            hash: '28411276f3b9f313b68d616c8c43c92c2d4bdc91',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/e2e-project/lib/validate-plugin.ts',
            hash: 'f7a8f80638399d7b778c78792dfde2d32369bee8',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/e2e-project/schema.d.ts',
            hash: '81cf25330d3fac98d926432a2d0fa58f0cba2b7c',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/e2e-project/schema.json',
            hash: 'ba9b1bdf794c6204b03c038e898786eaef1e92b1',
            ext: '.json',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/migration/files/migration/__name__/__name__.spec.ts__tmpl__',
            hash: '7f05e5e68e2ad4f409d3888b5fcdf80900ee03db',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/migration/files/migration/__name__/__name__.ts__tmpl__',
            hash: 'd4454f6a548035c16acd6a0f261c2756067b4cf8',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/migration/lib/add-files.ts',
            hash: 'df10f8eda6a46b4af752053613920154509aacc0',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/migration/lib/normalize-options.ts',
            hash: '2bf804e384eed63e172b8f3ff2088e224cb75dd5',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/migration/lib/update-migratiions-json.ts',
            hash: '6d380e418483d2ed35b5ecd408ecb104d336e67d',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/migration/lib/update-package-json.ts',
            hash: '5f59a4280089bfb4f985199ece53b60f551b7792',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/migration/lib/update-workspace-json.ts',
            hash: '296e5c96d4634108411f65a8a037cfc07f2eac30',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/migration/migration.spec.ts',
            hash: 'e66903155e609efaef2e435092e7fcab85376297',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/migration/migration.ts',
            hash: 'a00173ee6ab4b405b63226c4c3c92d5a5a3dfb77',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/migration/schema.d.ts',
            hash: '38b853e4a9124fe7b649e465a33ff3d0ad20f1c6',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/migration/schema.json',
            hash: '8a43240a2a8ec35fe9e286b246f23ea41fa613ab',
            ext: '.json',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/plugin/files/plugin/builders.json__tmpl__',
            hash: '73a632af5dc597cb99371020a83a39059842d8e8',
            ext: '.json__tmpl__',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/plugin/files/plugin/collection.json__tmpl__',
            hash: 'cca1473bee32c44c9c660c585af0f1127dbff583',
            ext: '.json__tmpl__',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/plugin/files/plugin/package.json__tmpl__',
            hash: 'bd50fddfab357783166860ce8c1006990f410f6b',
            ext: '.json__tmpl__',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/plugin/files/plugin/src/index.ts__tmpl__',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.ts__tmpl__',
          },
          {
            file: 'packages/nx-plugin/src/schematics/plugin/lib/add-files.ts',
            hash: '9ec2b6512435f091e809c4a10110c2a60d8287bf',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/plugin/lib/normalize-options.ts',
            hash: 'e494b69317771934df2263e1f789ec34d3d6c23c',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/plugin/lib/update-tsconfig.ts',
            hash: '02f06aa04780f277f18dff931d332ff8a4cd8eab',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/plugin/lib/update-workspace-json.ts',
            hash: '2ac2a518994105b52f129cdb1aa54b9ae069a5e3',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/plugin/plugin.spec.ts',
            hash: '664182bc4c927a147971446dfff536f9cf693647',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/plugin/plugin.ts',
            hash: '0eb750879b7579b9471f4c49504a2b0506e7b62e',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/plugin/schema.d.ts',
            hash: '9c448eeca4fd5da2ea44796ac7841b303434c93f',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/plugin/schema.json',
            hash: '917fe0d8e8c1def90764b56f83a42e181d68591d',
            ext: '.json',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/schematic/files/schematic/__fileName__/files/src/index.ts.template',
            hash: '7dc0b8ee648c18b294a6f052d33029f966ffad8d',
            ext: '.template',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/schematic/files/schematic/__fileName__/schema.d.ts__tmpl__',
            hash: 'bc872b99a9598954a941a903054c4c7a2e650eca',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/schematic/files/schematic/__fileName__/schema.json__tmpl__',
            hash: 'f2cab296cf7a28f01beda135b9cd699f4fd45330',
            ext: '.json__tmpl__',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/schematic/files/schematic/__fileName__/schematic.spec.ts__tmpl__',
            hash: 'a72e86a3b785503f9423a3a21e37c84b128524da',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/schematic/files/schematic/__fileName__/schematic.ts__tmpl__',
            hash: '55619552405160c7ef1578b414257f5dc6410a44',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/schematic/lib/add-files.ts',
            hash: '4eb60cc002eb4c28712c1f3f7644da17fabc7ac7',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/schematic/lib/normalize-options.ts',
            hash: '251d6e47065612c84cee5e42d375c6fbfd7b3565',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/schematic/lib/update-collection-json.ts',
            hash: '11146fdab1d833d26db833c36da09dce97dc8b76',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/schematic/schema.d.ts',
            hash: '812e795dacef9f9c94274596fd8f4254c3c035d5',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/schematic/schema.json',
            hash: 'b938a78c2d6db32608fafff3eeb0fcacdc70a09d',
            ext: '.json',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/schematic/schematic.spec.ts',
            hash: '5d95c2be4f4c03a50b432fbdc014e171ec9540e4',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/schematic/schematic.ts',
            hash: 'b301f58dc96a07961fd682a3f32e92d1fc645c35',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/utils/get-file-template.ts',
            hash: '91adcc50b043ef2e7a757812825cc98181a35770',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/utils/testing-utils/async-commands.ts',
            hash: '5152f1a52203bd0c843edccd2ddbd31b00c91c93',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/utils/testing-utils/commands.ts',
            hash: '308db0a53397804cdefd08e94e284df7c79b6b16',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/utils/testing-utils/index.ts',
            hash: '81414ad685bfb5e3e3ba48a0f570592c4fc2de59',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/utils/testing-utils/nx-project.ts',
            hash: 'e112f597f1ead0a1349c4a3a76f5e538dd545b14',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/utils/testing-utils/paths.ts',
            hash: 'a7430522721739fe0572978195ef8bc9ac750bc8',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/utils/testing-utils/utils.ts',
            hash: 'e6d75c3e2382429e384c3b126baf06c20143bb67',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/utils/testing.ts',
            hash: '313ac693bad2768bdd2b85642714f731ad8989bd',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/utils/versions.ts',
            hash: 'df701d624b0613121aa0c04a1a6dd1a00daa09f2',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/testing.ts',
            hash: '52c637a4d1713f6d575c13a1f084efcb6c4562c6',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/tsconfig.json',
            hash: '58bd2c97a66f5e5ea5d05c8a5709ee79bad02094',
            ext: '.json',
          },
          {
            file: 'packages/nx-plugin/tsconfig.lib.json',
            hash: '7fa30c67d0ca1c5562ac92e81b345d65e718e4a8',
            ext: '.json',
          },
          {
            file: 'packages/nx-plugin/tsconfig.spec.json',
            hash: 'd6ae6669d75fc5beb184f28966262e1762b9623c',
            ext: '.json',
          },
        ],
      },
    },
    cypress: {
      name: 'cypress',
      type: 'lib',
      data: {
        root: 'packages/cypress',
        sourceRoot: 'packages/cypress',
        projectType: 'library',
        schematics: {},
        architect: {
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/cypress/jest.config.js',
              passWithNoTests: true,
            },
          },
          'build-base': {
            builder: '@nrwl/node:package',
            options: {
              outputPath: 'build/packages/cypress',
              tsConfig: 'packages/cypress/tsconfig.lib.json',
              packageJson: 'packages/cypress/package.json',
              main: 'packages/cypress/index.ts',
              updateBuildableProjectDepsInPackageJson: false,
              assets: [
                {
                  input: 'packages/cypress',
                  glob: '**/files/**',
                  output: '/',
                },
                {
                  input: 'packages/cypress',
                  glob: '**/files/**/.gitkeep',
                  output: '/',
                },
                {
                  input: 'packages/cypress',
                  glob: '**/*.json',
                  output: '/',
                },
                {
                  input: 'packages/cypress',
                  glob: '**/*.js',
                  output: '/',
                },
                'LICENSE',
              ],
            },
          },
          build: {
            builder: '@nrwl/workspace:run-commands',
            outputs: ['build/packages/cypress'],
            options: {
              commands: [
                {
                  command: 'nx build-base cypress',
                },
                {
                  command: 'node ./scripts/copy-readme.js cypress',
                },
              ],
              parallel: false,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/cypress/.eslintrc',
            hash: '9afd5d63f09f7d350b479cea3984ab4d8920d964',
            ext: '',
          },
          {
            file: 'packages/cypress/builders.json',
            hash: '4bc0331eaf97b65a5969a6daf5b4210dfe97d34f',
            ext: '.json',
          },
          {
            file: 'packages/cypress/collection.json',
            hash: '9b4120e5799cd25821d1e9d1f1ca707f0f037983',
            ext: '.json',
          },
          {
            file: 'packages/cypress/index.ts',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.ts',
          },
          {
            file: 'packages/cypress/jest.config.js',
            hash: '3a80259b46f2ab39d67e15a74d8a8eaeaa524811',
            ext: '.js',
          },
          {
            file: 'packages/cypress/migrations.json',
            hash: '3bcc5de3bffed3efb32529a63fbea31aa30dadac',
            ext: '.json',
          },
          {
            file: 'packages/cypress/package.json',
            hash: '1ab153076fa1462787a7625719e89fad055008f0',
            ext: '.json',
          },
          {
            file: 'packages/cypress/plugins/preprocessor.ts',
            hash: '74a9fe7a6f1bc68cbb09d77dbe60933509e8b4d1',
            ext: '.ts',
          },
          {
            file: 'packages/cypress/README.md',
            hash: '6676634b107a4f46bf318f19b63abf28b5cd7932',
            ext: '.md',
          },
          {
            file: 'packages/cypress/src/builders/cypress/cypress.impl.spec.ts',
            hash: 'e4d3cfb8db82b84c80d650fa356f92f0fbbbcedb',
            ext: '.ts',
          },
          {
            file: 'packages/cypress/src/builders/cypress/cypress.impl.ts',
            hash: '16ca923a282c4322a05defa4dbb9a507a706e227',
            ext: '.ts',
          },
          {
            file: 'packages/cypress/src/builders/cypress/legacy.ts',
            hash: 'e75876211fca904860aa4281e4295d0402442605',
            ext: '.ts',
          },
          {
            file: 'packages/cypress/src/builders/cypress/schema.json',
            hash: '338b818ce5df9210e8c6c344122c5f0351ff830c',
            ext: '.json',
          },
          {
            file:
              'packages/cypress/src/migrations/update-8-1-0/update-8-1-0.spec.ts',
            hash: '8c1e5610155459604f720532af06ce712fca8f94',
            ext: '.ts',
          },
          {
            file:
              'packages/cypress/src/migrations/update-8-1-0/update-8-1-0.ts',
            hash: '48e0529fd603f649dc7858c0f9b3894a16965550',
            ext: '.ts',
          },
          {
            file:
              'packages/cypress/src/migrations/update-8-10-0/update-8-10-0.ts',
            hash: '2257c756503e3690ded1769c940d0420732ad70e',
            ext: '.ts',
          },
          {
            file:
              'packages/cypress/src/migrations/update-8-12-0/update-8-12-0.ts',
            hash: '6d526136aedc893a8af075f78750d599b5a404d8',
            ext: '.ts',
          },
          {
            file:
              'packages/cypress/src/migrations/update-8-2-0/update-8-2-0.spec.ts',
            hash: '7b3718317e23621e6c3681d77bbc6eb0d4162c7d',
            ext: '.ts',
          },
          {
            file:
              'packages/cypress/src/migrations/update-8-2-0/update-8-2-0.ts',
            hash: '8d7278afca1df45b43abf9d1c59c46f3f8d7da7d',
            ext: '.ts',
          },
          {
            file:
              'packages/cypress/src/migrations/update-9-4-0/add-cypress-eslint-plugin-9-4-0.spec.ts',
            hash: '0e30d93bfd4424d3442ce196c8635ade77c11a3a',
            ext: '.ts',
          },
          {
            file:
              'packages/cypress/src/migrations/update-9-4-0/add-cypress-eslint-plugin-9-4-0.ts',
            hash: '425f923e5a0613794258575dc33b6f7ae36f31ea',
            ext: '.ts',
          },
          {
            file: 'packages/cypress/src/plugins/preprocessor.spec.ts',
            hash: '18a207be3e7a445ba4353ccfacfbf7f6d8885f87',
            ext: '.ts',
          },
          {
            file: 'packages/cypress/src/plugins/preprocessor.ts',
            hash: '7776c3a78a0eebc5b24393271d284603664279fb',
            ext: '.ts',
          },
          {
            file:
              'packages/cypress/src/schematics/cypress-project/cypress-project.spec.ts',
            hash: '5cdea8171a900b2f504eadcef33d94004ad6ae66',
            ext: '.ts',
          },
          {
            file:
              'packages/cypress/src/schematics/cypress-project/cypress-project.ts',
            hash: '6f916ca15e5ed15e98387b78e277a3b022163712',
            ext: '.ts',
          },
          {
            file:
              'packages/cypress/src/schematics/cypress-project/files/cypress.json',
            hash: 'e13d1ca77cde002cb3899ad36f0dade92a3c70c0',
            ext: '.json',
          },
          {
            file:
              'packages/cypress/src/schematics/cypress-project/files/src/fixtures/example.json__tmpl__',
            hash: '294cbed6ce9e0b948b787452e8676aee486cb3be',
            ext: '.json__tmpl__',
          },
          {
            file:
              'packages/cypress/src/schematics/cypress-project/files/src/integration/app.spec.ts__tmpl__',
            hash: '2ebbb53a9bae021128b6daa11537f37fcf211eee',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/cypress/src/schematics/cypress-project/files/src/plugins/index.js',
            hash: '9067e75a258dadf5a02b2a91c64f5acee1af17fd',
            ext: '.js',
          },
          {
            file:
              'packages/cypress/src/schematics/cypress-project/files/src/support/app.po.ts__tmpl__',
            hash: '32934246969c2ecb827ac05677785933a707a54d',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/cypress/src/schematics/cypress-project/files/src/support/commands.ts__tmpl__',
            hash: '61b3a3e35770234a5aa9e31b07870b9292ec52ba',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/cypress/src/schematics/cypress-project/files/src/support/index.ts__tmpl__',
            hash: '3d469a6b6cf31eb66117d73e278bcf74f398f1db',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/cypress/src/schematics/cypress-project/files/tsconfig.e2e.json',
            hash: '62ba2f0c2dabdcab94784b263a61df8d01b8e2aa',
            ext: '.json',
          },
          {
            file:
              'packages/cypress/src/schematics/cypress-project/files/tsconfig.json',
            hash: 'c31c52e04ce1a561344054702b387be478b60109',
            ext: '.json',
          },
          {
            file: 'packages/cypress/src/schematics/cypress-project/schema.d.ts',
            hash: 'e5492dcdd70c197bbdb7e90113bbe9401ae0cc75',
            ext: '.ts',
          },
          {
            file: 'packages/cypress/src/schematics/cypress-project/schema.json',
            hash: '4736c72234f91cc18f60cca88f728df898a3e2c0',
            ext: '.json',
          },
          {
            file: 'packages/cypress/src/schematics/init/init.spec.ts',
            hash: '218494c82e64731b1d0f841297db8990782f2b18',
            ext: '.ts',
          },
          {
            file: 'packages/cypress/src/schematics/init/init.ts',
            hash: 'b3e1edec17fd2ba86cc5320fac3663570d8999eb',
            ext: '.ts',
          },
          {
            file: 'packages/cypress/src/schematics/init/schema.d.ts',
            hash: 'e53f1202a2dbcc9dd0557eb6e641faebd55a0a79',
            ext: '.ts',
          },
          {
            file: 'packages/cypress/src/schematics/init/schema.json',
            hash: 'eb3edacbf0a65c6a5d5b776dd4b7350eb1cee44d',
            ext: '.json',
          },
          {
            file: 'packages/cypress/src/utils/cypress-version.ts',
            hash: 'f9ee53de9119904a6bf72a9f3099f5af54f9380f',
            ext: '.ts',
          },
          {
            file: 'packages/cypress/src/utils/testing.ts',
            hash: '833b5fb9753f323c9246a90a5f440ce4686fa4ee',
            ext: '.ts',
          },
          {
            file: 'packages/cypress/src/utils/versions.ts',
            hash: '1fbe769a175fe3a3c2a503045bd0b6fabfa5b8c0',
            ext: '.ts',
          },
          {
            file: 'packages/cypress/tsconfig.json',
            hash: '58bd2c97a66f5e5ea5d05c8a5709ee79bad02094',
            ext: '.json',
          },
          {
            file: 'packages/cypress/tsconfig.lib.json',
            hash: '037d796f286235dce67c9e648d2d42adcc61ccd7',
            ext: '.json',
          },
          {
            file: 'packages/cypress/tsconfig.spec.json',
            hash: '559410b96af6781ac3e7cf348bf4a710b4009481',
            ext: '.json',
          },
        ],
      },
    },
    express: {
      name: 'express',
      type: 'lib',
      data: {
        root: 'packages/express',
        sourceRoot: 'packages/express',
        projectType: 'library',
        schematics: {},
        architect: {
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/express/jest.config.js',
              passWithNoTests: true,
            },
          },
          'build-base': {
            builder: '@nrwl/node:package',
            options: {
              outputPath: 'build/packages/express',
              tsConfig: 'packages/express/tsconfig.lib.json',
              packageJson: 'packages/express/package.json',
              main: 'packages/express/index.ts',
              updateBuildableProjectDepsInPackageJson: false,
              assets: [
                {
                  input: 'packages/express',
                  glob: '**/files/**',
                  output: '/',
                },
                {
                  input: 'packages/express',
                  glob: '**/files/**/.gitkeep',
                  output: '/',
                },
                {
                  input: 'packages/express',
                  glob: '**/*.json',
                  output: '/',
                },
                {
                  input: 'packages/express',
                  glob: '**/*.js',
                  output: '/',
                },
                'LICENSE',
              ],
            },
          },
          build: {
            builder: '@nrwl/workspace:run-commands',
            outputs: ['build/packages/express'],
            options: {
              commands: [
                {
                  command: 'nx build-base express',
                },
                {
                  command: 'node ./scripts/copy-readme.js express',
                },
              ],
              parallel: false,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/express/.eslintrc',
            hash: '9afd5d63f09f7d350b479cea3984ab4d8920d964',
            ext: '',
          },
          {
            file: 'packages/express/builders.json',
            hash: 'aa97ded151a5cc5b29308544331dc4e36ae33204',
            ext: '.json',
          },
          {
            file: 'packages/express/collection.json',
            hash: '6046c36f05f2eff293269d381bc4abf5c5c9f933',
            ext: '.json',
          },
          {
            file: 'packages/express/index.ts',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.ts',
          },
          {
            file: 'packages/express/jest.config.js',
            hash: '9780134abd6aed2804dc0007cb4e148540b3b1ab',
            ext: '.js',
          },
          {
            file: 'packages/express/migrations.json',
            hash: '63001b445889156d9b23c60598171ffc53a90d0c',
            ext: '.json',
          },
          {
            file: 'packages/express/package.json',
            hash: '55d7a1edf2917dc3c88c2a790e60bb676993f34c',
            ext: '.json',
          },
          {
            file: 'packages/express/README.md',
            hash: '7c76de5a0875358e2ba06a746f624e63668e3e58',
            ext: '.md',
          },
          {
            file:
              'packages/express/src/schematics/application/application.spec.ts',
            hash: '240e752922e33b7322ddf01c1ba9b1b00b98e7f6',
            ext: '.ts',
          },
          {
            file: 'packages/express/src/schematics/application/application.ts',
            hash: '39a0469f527b101c0299c53fe98b8c4c58638a6b',
            ext: '.ts',
          },
          {
            file: 'packages/express/src/schematics/application/schema.d.ts',
            hash: '5830b78e65fb5211ca9afec5d9c99d4b3f36b25f',
            ext: '.ts',
          },
          {
            file: 'packages/express/src/schematics/application/schema.json',
            hash: '0f0d2a6c99cbf8641a212f06edfa7eeb83185bd7',
            ext: '.json',
          },
          {
            file: 'packages/express/src/schematics/init/init.spec.ts',
            hash: '12125704828c233a2c32fbfa69fa5bafa7072e23',
            ext: '.ts',
          },
          {
            file: 'packages/express/src/schematics/init/init.ts',
            hash: '35e578b2d9d199bd884414f391a2f92cf76bdb0e',
            ext: '.ts',
          },
          {
            file: 'packages/express/src/schematics/init/schema.d.ts',
            hash: '52ac13000a18d701532ccd65ffecfe545ff28d55',
            ext: '.ts',
          },
          {
            file: 'packages/express/src/schematics/init/schema.json',
            hash: '977b1a806b3bf8822bb0d913a687bbe05064716b',
            ext: '.json',
          },
          {
            file: 'packages/express/src/utils/testing.ts',
            hash: '2d095237741512a31a16f1ced30aa3f97bf66bd2',
            ext: '.ts',
          },
          {
            file: 'packages/express/src/utils/versions.ts',
            hash: '7f5a6d9269eae83d0bdedb28df018c3c841919ea',
            ext: '.ts',
          },
          {
            file: 'packages/express/tsconfig.json',
            hash: '58bd2c97a66f5e5ea5d05c8a5709ee79bad02094',
            ext: '.json',
          },
          {
            file: 'packages/express/tsconfig.lib.json',
            hash: 'dbe90e0855d2ef980595dcc17f577088662cfb4d',
            ext: '.json',
          },
          {
            file: 'packages/express/tsconfig.spec.json',
            hash: 'd6ae6669d75fc5beb184f28966262e1762b9623c',
            ext: '.json',
          },
        ],
      },
    },
    angular: {
      name: 'angular',
      type: 'lib',
      data: {
        root: 'packages/angular',
        sourceRoot: 'packages/angular',
        projectType: 'library',
        schematics: {},
        architect: {
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/angular/jest.config.js',
              passWithNoTests: true,
            },
          },
          'build-base': {
            builder: '@nrwl/node:package',
            options: {
              outputPath: 'build/packages/angular',
              tsConfig: 'packages/angular/tsconfig.lib.json',
              packageJson: 'packages/angular/package.json',
              main: 'packages/angular/index.ts',
              updateBuildableProjectDepsInPackageJson: false,
              assets: [
                {
                  input: 'packages/angular',
                  glob: '**/files/**',
                  output: '/',
                },
                {
                  input: 'packages/angular',
                  glob: '**/creator-files/**',
                  output: '/',
                },
                {
                  input: 'packages/angular',
                  glob: '**/files/**/.gitkeep',
                  output: '/',
                },
                {
                  input: 'packages/angular',
                  glob: '**/*.json',
                  output: '/',
                },
                {
                  input: 'packages/angular',
                  glob: '**/*.js',
                  output: '/',
                },
                'LICENSE',
              ],
            },
          },
          build: {
            builder: '@nrwl/workspace:run-commands',
            outputs: ['build/packages/angular'],
            options: {
              commands: [
                {
                  command: 'nx build-base angular',
                },
                {
                  command: './scripts/build-angular.sh',
                },
                {
                  command: 'node ./scripts/copy-readme.js angular',
                },
              ],
              parallel: false,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/angular/.eslintrc',
            hash: '9afd5d63f09f7d350b479cea3984ab4d8920d964',
            ext: '',
          },
          {
            file: 'packages/angular/builders.json',
            hash: '216b2bc760a84f742131f18dc8ddcf0fd62bf44f',
            ext: '.json',
          },
          {
            file: 'packages/angular/collection.json',
            hash: '0f9740760f7bb8910a22a9fa5348b674e0fb6d87',
            ext: '.json',
          },
          {
            file: 'packages/angular/index.ts',
            hash: 'ba5e98d619b4c4faa674316314601de080a84b2d',
            ext: '.ts',
          },
          {
            file: 'packages/angular/jest.config.js',
            hash: '9b09f1c8ec31adb26dcb19b4eca6fe221301d06c',
            ext: '.js',
          },
          {
            file: 'packages/angular/migrations.json',
            hash: '99aaa39185e3268a969ff1f0e41060151f6720af',
            ext: '.json',
          },
          {
            file: 'packages/angular/ng-package.json',
            hash: '2210133055ba1c9dc85932013d7dde18a2e07985',
            ext: '.json',
          },
          {
            file: 'packages/angular/package.json',
            hash: '45dad079e455d89a613db17fe3b5a2b5e0aea2ad',
            ext: '.json',
          },
          {
            file: 'packages/angular/README.md',
            hash: 'a4018fe814bf3c7e7d8eef07c913896d2dd6b568',
            ext: '.md',
          },
          {
            file: 'packages/angular/scripts/nx-cli-warning.js',
            hash: '0767a98d0921e46cc1d15f466049142b4066c274',
            ext: '.js',
          },
          {
            file: 'packages/angular/spec/data-persistence.spec.ts',
            hash: 'f805cf500070882c59d15c4e2ca16c4ec17512c5',
            ext: '.ts',
          },
          {
            file: 'packages/angular/spec/testing-utils.spec.ts',
            hash: '74b5379e3e0bbfe93a2806c4e50d5d32de63b62a',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/builders/package/package.impl.spec.ts',
            hash: '13e63726bab7097caced162c0ae4cf83983327e6',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/builders/package/package.impl.ts',
            hash: 'aa979f169bf7aa809abc2ec2b24ffd944a1c1f05',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/builders/package/schema.json',
            hash: 'e334ee9151d10c42ac7c71251ff4bce1cc73195e',
            ext: '.json',
          },
          {
            file:
              'packages/angular/src/migrations/update-10-0-0/update-10-0-0.ts',
            hash: '2d3cc989200918252e72026bf72b58e439554f9c',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/migrations/update-10-2-0/update-10-2-0.ts',
            hash: '251962b8c88d27f0ae1025e6ad81fe2a10a52b66',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/migrations/update-8-12-0/change-angular-lib-builder.spec.ts',
            hash: '27617f30c6d6382225c0bd03bd476af422a295ad',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/migrations/update-8-12-0/change-angular-lib-builder.ts',
            hash: '9e2cf49f21ebddef5149aa9a1c90e0aa91b43870',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/migrations/update-8-3-0/upgrade-ngrx-8-0.ts',
            hash: 'c5492d3f558acc89c72a20de41daf3ef668e52c6',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/migrations/update-8-5-0/update-8-5-0.spec.ts',
            hash: 'e50290116b7e00b0e96e9bc61817fb867a0810e0',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/migrations/update-8-5-0/upgrade-cli-8-3.ts',
            hash: '430ca98928cb4d355bbcdb41dc174ad94d1b26e3',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/migrations/update-9-0-0/add-postinstall.spec.ts',
            hash: '0f8ab0486273ff64eb2fdc0bc6a5f46d0887a11c',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/migrations/update-9-0-0/add-postinstall.ts',
            hash: '40381bc9788161e52c2eff924e326f7f1f35b45c',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/migrations/update-9-0-0/update-9-0-0.ts',
            hash: 'c04f3037bd34310356bf0bd54e44888109ac6d88',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/runtime/nx/data-persistence.ts',
            hash: 'b40df3696259a5b24900ec0f63c35125dd42c187',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/runtime/nx/nx.module.ts',
            hash: '6354d202e8f98eeb0e7585aa4211ab900b1152d8',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/application/application.spec.ts',
            hash: '20c4781c512641118731c95a72fe616a9aaf1e8a',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/application/application.ts',
            hash: '52c5e1f4225c682933ea1226c83b52858c1899a0',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/application/files/src/favicon.ico',
            hash: '317ebcb2336e0833a22dddf0ab287849f26fda57',
            ext: '.ico',
          },
          {
            file:
              'packages/angular/src/schematics/application/files/tsconfig.json',
            hash: '795ebf01cbe3c6c661881db9a5b3aec95a69fe9b',
            ext: '.json',
          },
          {
            file: 'packages/angular/src/schematics/application/schema.d.ts',
            hash: '659d471e408fbdd3c1dca0868ba11ceedad871f5',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/application/schema.json',
            hash: '4322480d9fa7d4df59d398eaa371986dd74eb6ea',
            ext: '.json',
          },
          {
            file:
              'packages/angular/src/schematics/component-cypress-spec/component-cypress-spec.ts',
            hash: '93d16545b4fa981e33a0486ff59292b5fc46de97',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/component-cypress-spec/files/__componentFileName__.spec.ts__tmpl__',
            hash: 'c89d6b6bafca2c4b7acd73c7b794873690562ca1',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/angular/src/schematics/component-cypress-spec/schema.json',
            hash: '4423b54cf19bd61503931f1ebdfb83165a6bb18d',
            ext: '.json',
          },
          {
            file:
              'packages/angular/src/schematics/component-story/component-story.ts',
            hash: '855b7d54b6aa76c63166a6060592ca7b799b9aab',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/component-story/files/__componentFileName__.stories.ts__tmpl__',
            hash: '1235565680a7427ebc034bc01aaeb922a3c56ccb',
            ext: '.ts__tmpl__',
          },
          {
            file: 'packages/angular/src/schematics/component-story/schema.json',
            hash: 'beaf3d9e1afcc08be2b78dcba24e357bfe677d6d',
            ext: '.json',
          },
          {
            file:
              'packages/angular/src/schematics/downgrade-module/downgrade-module.spec.ts',
            hash: 'fc3af6cadade1ce566ee1a59388b7c4380f216aa',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/downgrade-module/downgrade-module.ts',
            hash: 'a219c72830047917ff8994a1fdf4eaf0adc34ec6',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/downgrade-module/schema.d.ts',
            hash: '294838c2686a91cbc40b18c639b78ad15605b97e',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/downgrade-module/schema.json',
            hash: 'eb30099eee96e0f611837d25d9d30a69ba9620d2',
            ext: '.json',
          },
          {
            file: 'packages/angular/src/schematics/init/init.spec.ts',
            hash: 'ec58aff5685e1891d326661847a7f2e20a5c2834',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/init/init.ts',
            hash: 'ff65c0b0f743d5ff2445e339c7576fbee425620f',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/init/schema.d.ts',
            hash: 'd47c00b0a8e72a07d04ebfc85a9bac3e250b24f6',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/init/schema.json',
            hash: 'a45a205701da536841cf85815daa0dbd78c80b58',
            ext: '.json',
          },
          {
            file:
              'packages/angular/src/schematics/karma-project/files/karma.conf.js__tmpl__',
            hash: '38e887584aaa1e8495066fc341cfec175de86d91',
            ext: '.js__tmpl__',
          },
          {
            file:
              'packages/angular/src/schematics/karma-project/files/src/test.ts__tmpl__',
            hash: 'db820813ab65db7f1b2ec1f9c515ba178d2a8c45',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/angular/src/schematics/karma-project/files/tsconfig.spec.json',
            hash: 'f671d494c429faf5a3c2955a3863ec482a2a4184',
            ext: '.json',
          },
          {
            file:
              'packages/angular/src/schematics/karma-project/karma-project.spec.ts',
            hash: 'f72c6fd4a0af03960189a24b3fd474740fbb9d83',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/karma-project/karma-project.ts',
            hash: '4c060a68c471128e03ff840446424d9fa646e0a3',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/karma-project/schema.json',
            hash: '895fa34ec8a905ee388439d4f206bebf702fe3c7',
            ext: '.json',
          },
          {
            file:
              'packages/angular/src/schematics/karma/files/karma/karma.conf.js',
            hash: '2c5a16ceedb8c308f6adf452d6c8aad215c9be88',
            ext: '.js',
          },
          {
            file: 'packages/angular/src/schematics/karma/karma.spec.ts',
            hash: '14497e1974c6e82e2a3995149c531af6302de04d',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/karma/karma.ts',
            hash: '9b82c5cb75b6d43885898076cf75fb033fa85e7e',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/karma/schema.json',
            hash: '8781daac97f78a4781ea1cfd4988a87afe41ff61',
            ext: '.json',
          },
          {
            file: 'packages/angular/src/schematics/library/files/lib/README.md',
            hash: 'b72e16d5b10578829c60cfcf622844651621f189',
            ext: '.md',
          },
          {
            file:
              'packages/angular/src/schematics/library/files/lib/tsconfig.json',
            hash: 'd4a0841f5b0edf488810c1a2ecaa1fccc2562167',
            ext: '.json',
          },
          {
            file: 'packages/angular/src/schematics/library/lib/add-children.ts',
            hash: '5bac01bc4dca7837bb9e06324f0c5aa58e0510c4',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/library/lib/add-lazy-loaded-router-configuration.ts',
            hash: '594a4165b7deb082ca3ba3142c4facde34c8abd8',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/library/lib/add-load-children.ts',
            hash: 'ddaefe64e4214a52ceff8a161eff8427244ce2c2',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/library/lib/add-module.ts',
            hash: '19d04a4af7dbe081928c6cad64685a39cd5f7950',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/library/lib/add-router-configuration.ts',
            hash: 'c701d74d1103c9e85be362b3256b379047641dbd',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/library/lib/enable-strict-type-checking.ts',
            hash: '72eedbef7e6cc1b74d32740a182be374b77c6290',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/library/lib/normalize-options.ts',
            hash: 'd652a9fdf90ced0d31bf47ab175903fa93f53129',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/library/lib/normalized-schema.ts',
            hash: '916e2f8c4f26256953a85303d0144cb413d85cd1',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/library/lib/update-lib-package-npm-scope.ts',
            hash: '9e0c6184b73b03d52f2ccca74a5c693cb16276ce',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/library/lib/update-ng-package.ts',
            hash: '8c53e17f8a5e5fe57834a94bbbf00467b3397f10',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/library/lib/update-project.ts',
            hash: '83adadfeb97af57ab6d702a4936472599c5b8b5b',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/library/lib/update-tsconfig.ts',
            hash: '3808d1d7718a1dc6dda616117f0d295867a6be36',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/library/library.spec.ts',
            hash: 'dcd578486396e5cb1719e2ef0d8a33b9185302db',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/library/library.ts',
            hash: '09dee1d5442d46e34ffce4fc2d404dd58bd49456',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/library/schema.d.ts',
            hash: 'b778f7adc5de6c2d7c09ad7025ac8cbc1b7c9ba8',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/library/schema.json',
            hash: 'b1123d71ee1566450c890b3d9920c2d9597e0457',
            ext: '.json',
          },
          {
            file:
              'packages/angular/src/schematics/move/lib/update-module-name.spec.ts',
            hash: '777beb0141dce99a2e591dd2fe6eb231abc7d87f',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/move/lib/update-module-name.ts',
            hash: '241ce481281cba164eef7011e7d3a6e259db893f',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/move/move.ts',
            hash: '9592980c2f26a6e14209a4dbff3323ad2d98445d',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/move/schema.d.ts',
            hash: '50ed425b41447d90dcf1184ef5424a1ca065090f',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/move/schema.json',
            hash: 'd9721794a064cca4b77819a640b1176bb31e5234',
            ext: '.json',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/creator-files/__directory__/__fileName__.actions.ts__tmpl__',
            hash: '1b9a39a682f44c22e1855859e74ccc099c863523',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/creator-files/__directory__/__fileName__.effects.spec.ts__tmpl__',
            hash: 'c17073bd33aaf36cf64bbd44148289fe07a98d5d',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/creator-files/__directory__/__fileName__.effects.ts__tmpl__',
            hash: 'cf2219eb00af267d457539a29e548661c1d07f57',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/creator-files/__directory__/__fileName__.facade.spec.ts__tmpl__',
            hash: '994397aedd48553f2d9e9f48480bf4f0f483764b',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/creator-files/__directory__/__fileName__.facade.ts__tmpl__',
            hash: '55eea6fd17b75f2f432fd954358d256841fde52d',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/creator-files/__directory__/__fileName__.models.ts__tmpl__',
            hash: 'ab33969694db17c36855076bd2005decfc9f66e4',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/creator-files/__directory__/__fileName__.reducer.spec.ts__tmpl__',
            hash: '8a449766f7d69f3cb1857f645913755dfe774e2c',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/creator-files/__directory__/__fileName__.reducer.ts__tmpl__',
            hash: '7174b7b44b3e1e3bc3b3116966f4935f6b148952',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/creator-files/__directory__/__fileName__.selectors.spec.ts__tmpl__',
            hash: 'de6c12154fffb5680adcb435dfc1e133b2ff3ae7',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/creator-files/__directory__/__fileName__.selectors.ts__tmpl__',
            hash: '7b4c67bb4ac33a5419b20cef68281c5e6350a2d5',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/files/__directory__/__fileName__.actions.ts__tmpl__',
            hash: 'dcdc7da26fca172153a37f53f8022e53e3e63a20',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/files/__directory__/__fileName__.effects.spec.ts__tmpl__',
            hash: '601318e5d07b608808ea7a43c33f149b70c0e939',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/files/__directory__/__fileName__.effects.ts__tmpl__',
            hash: '6926e378d9229c49ef591c9e667f6a3d1fb931f3',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/files/__directory__/__fileName__.facade.spec.ts__tmpl__',
            hash: '09b24f0807740fbba71481b4f48a13b4e3e26210',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/files/__directory__/__fileName__.facade.ts__tmpl__',
            hash: 'b8a87461a40abe417b31a8bd3f67d984b2d17eb2',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/files/__directory__/__fileName__.reducer.spec.ts__tmpl__',
            hash: 'f0ad86ae02dd5e8f745496660b1d701554c81fc1',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/files/__directory__/__fileName__.reducer.ts__tmpl__',
            hash: 'ef6bd3c2827c22c1ef27b7043fc9d2d9571dca38',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/files/__directory__/__fileName__.selectors.spec.ts__tmpl__',
            hash: 'a6a12bd10f371b27c82a24bfb1e9e4c959560e3b',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/files/__directory__/__fileName__.selectors.ts__tmpl__',
            hash: 'f04c67a64e30ecf0c0d9f344afe08598b5b5cb61',
            ext: '.ts__tmpl__',
          },
          {
            file: 'packages/angular/src/schematics/ngrx/ngrx.spec.ts',
            hash: 'b22172056fa1f374b5202892cc6bbd23ca434b7a',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/ngrx/ngrx.ts',
            hash: '9a96741e42c471e660a3e2ca7727d03a90356ae1',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/rules/add-exports-barrel.ts',
            hash: '9deddcacba1e8b4198fe78cd1b5ded035bdf7090',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/rules/add-imports-to-module.ts',
            hash: '48d60547d40642620ee029400fbd66ecb1d05410',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/rules/add-ngrx-to-package-json.ts',
            hash: '50d4bae30317ebbe8db192d9089ea0e22b5de114',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/ngrx/rules/index.ts',
            hash: '231f515d251afac341549a45555b24350e3ebc0c',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/rules/request-context.ts',
            hash: 'dce79c0ac6679318daac678696ce75bfd0ddf35d',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/ngrx/schema.d.ts',
            hash: 'ad7103864bd77755304919356d4a53219c672e99',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/ngrx/schema.json',
            hash: 'd8fd97868652a7f163869d47030b4717fc55a6c5',
            ext: '.json',
          },
          {
            file: 'packages/angular/src/schematics/stories/schema.json',
            hash: '4c18eb180cf1483284b2fa27d73c3021a829a9b0',
            ext: '.json',
          },
          {
            file: 'packages/angular/src/schematics/stories/stories.spec.ts',
            hash: 'ecd7be1491db3259af271f835c12d0c593694cbc',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/stories/stories.ts',
            hash: '510b23d509f5faeb4e0d87f350debc5fa4dc5221',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/storybook-configuration/__snapshots__/configuration.spec.ts.snap',
            hash: '8f05944076eedb071e7cb8cd9130a865d3cd372e',
            ext: '.snap',
          },
          {
            file:
              'packages/angular/src/schematics/storybook-configuration/configuration.spec.ts',
            hash: 'bfc0b796ad0e9f46b8ff2149ccf189ac46826cf3',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/storybook-configuration/configuration.ts',
            hash: 'c68ffb8b1894eba2692588dd65a2876e820bcb40',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/storybook-configuration/schema.d.ts',
            hash: 'be239d095a5c17d8fa3e242866ff0e15fb3cf5ad',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/storybook-configuration/schema.json',
            hash: '1a55c565252b62abe82d8c405405c0368110ab13',
            ext: '.json',
          },
          {
            file:
              'packages/angular/src/schematics/upgrade-module/files/__name__-setup.ts__tmpl__',
            hash: '4837d63db01de66f8f37e2d3365b7245ed65c53e',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/angular/src/schematics/upgrade-module/files/hybrid.spec.ts__tmpl__',
            hash: '9cd5d29ae3292d99b75a0690f1c1c41dfb9c50b7',
            ext: '.ts__tmpl__',
          },
          {
            file: 'packages/angular/src/schematics/upgrade-module/schema.d.ts',
            hash: '968490979907d34a7cd9590366ecf9108dbe68be',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/upgrade-module/schema.json',
            hash: 'c610a632db008d4d9cc08c31308d32c6124ad5d5',
            ext: '.json',
          },
          {
            file:
              'packages/angular/src/schematics/upgrade-module/upgrade-module.spec.ts',
            hash: 'c92751913cbd918d4ecf4847c30aaeeff73534b5',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/upgrade-module/upgrade-module.ts',
            hash: 'f738e8551fbb96fbc46b20c7da2e245747930095',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/utils/ast-utils.spec.ts',
            hash: '6b7e3746dad083ea656c632b069e8535084498fc',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/utils/ast-utils.ts',
            hash: 'df2b34c59ae8fcc175b21f6a8116ac99c0448df4',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/utils/test-runners.ts',
            hash: '2304ac0a4f70531b1055bc939650746dc456452c',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/utils/testing.ts',
            hash: 'a1315e54ddd402465cc87e1bc46d8c2c4695c628',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/utils/upgrade.ts',
            hash: '08cfeb64455d764f8b49d63d2f8050218d367f63',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/utils/versions.ts',
            hash: '026fe09b2eff8691dd1b066d6c8c97e123cee5cd',
            ext: '.ts',
          },
          {
            file: 'packages/angular/testing/index.ts',
            hash: '945b8d3c1e2b8c5aff33b0e6d0f47c76cf99b581',
            ext: '.ts',
          },
          {
            file: 'packages/angular/testing/package.json',
            hash: 'ece6e8bb0bc4bb710b0ada2be14466a6f4641995',
            ext: '.json',
          },
          {
            file: 'packages/angular/testing/src/testing-utils.ts',
            hash: '46c7a68fe346fd284d681668de24f79ec2b132af',
            ext: '.ts',
          },
          {
            file: 'packages/angular/tsconfig.json',
            hash: '58bd2c97a66f5e5ea5d05c8a5709ee79bad02094',
            ext: '.json',
          },
          {
            file: 'packages/angular/tsconfig.lib.json',
            hash: 'dbe90e0855d2ef980595dcc17f577088662cfb4d',
            ext: '.json',
          },
          {
            file: 'packages/angular/tsconfig.spec.json',
            hash: 'd6ae6669d75fc5beb184f28966262e1762b9623c',
            ext: '.json',
          },
        ],
      },
    },
    linter: {
      name: 'linter',
      type: 'lib',
      data: {
        root: 'packages/linter',
        sourceRoot: 'packages/linter',
        projectType: 'library',
        schematics: {},
        architect: {
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/linter/jest.config.js',
              passWithNoTests: true,
            },
          },
          'build-base': {
            builder: '@nrwl/node:package',
            options: {
              outputPath: 'build/packages/linter',
              tsConfig: 'packages/linter/tsconfig.lib.json',
              packageJson: 'packages/linter/package.json',
              main: 'packages/linter/index.ts',
              updateBuildableProjectDepsInPackageJson: false,
              assets: [
                {
                  input: 'packages/linter',
                  glob: '**/files/**',
                  output: '/',
                },
                {
                  input: 'packages/linter',
                  glob: '**/files/**/.gitkeep',
                  output: '/',
                },
                {
                  input: 'packages/linter',
                  glob: '**/*.json',
                  output: '/',
                },
                {
                  input: 'packages/linter',
                  glob: '**/*.js',
                  output: '/',
                },
                'LICENSE',
              ],
            },
          },
          build: {
            builder: '@nrwl/workspace:run-commands',
            outputs: ['build/packages/linter'],
            options: {
              commands: [
                {
                  command: 'nx build-base linter',
                },
                {
                  command: 'node ./scripts/copy-readme.js linter',
                },
              ],
              parallel: false,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/linter/.eslintrc',
            hash: '9afd5d63f09f7d350b479cea3984ab4d8920d964',
            ext: '',
          },
          {
            file: 'packages/linter/builders.json',
            hash: 'fd626fb883182259efc2d70b1ca6a423924bffc2',
            ext: '.json',
          },
          {
            file: 'packages/linter/jest.config.js',
            hash: '47a2c32269d1add8743f184767c2e6efb82d2710',
            ext: '.js',
          },
          {
            file: 'packages/linter/package.json',
            hash: '05cee36985d16775af611f50e27de1cd6bdb9bcf',
            ext: '.json',
          },
          {
            file: 'packages/linter/README.md',
            hash: 'f3da156b4e4df1a0e750e65592eed0ca5ab14c8c',
            ext: '.md',
          },
          {
            file: 'packages/linter/src/builders/lint/lint.impl.spec.ts',
            hash: 'd83babfce7201533707c01d55d225d3361948d84',
            ext: '.ts',
          },
          {
            file: 'packages/linter/src/builders/lint/lint.impl.ts',
            hash: 'b46f8fd6714586e18a424eb0341a014a3f506692',
            ext: '.ts',
          },
          {
            file: 'packages/linter/src/builders/lint/schema.d.ts',
            hash: 'febed08511f25adc60152fd9486b0051346270d5',
            ext: '.ts',
          },
          {
            file: 'packages/linter/src/builders/lint/schema.json',
            hash: '397ad58f4dd18f8feee4d26aae43eda0834f5d84',
            ext: '.json',
          },
          {
            file:
              'packages/linter/src/builders/lint/utility/eslint-utils.spec.ts',
            hash: '5c1476d80756c5a49189112402e27005998e4fca',
            ext: '.ts',
          },
          {
            file: 'packages/linter/src/builders/lint/utility/eslint-utils.ts',
            hash: 'f79de2cb966c77d2d788546401b9cbd8b5be8be1',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/builders/lint/utility/file-utils.spec.ts',
            hash: '300e43b686c336e31bbc7f0051725b5a0cec2e69',
            ext: '.ts',
          },
          {
            file: 'packages/linter/src/builders/lint/utility/file-utils.ts',
            hash: 'd12d17d04edee2a422fa6e22450d2597f5dfa1c3',
            ext: '.ts',
          },
          {
            file: 'packages/linter/src/builders/lint/utility/ts-utils.spec.ts',
            hash: '9c32a7bf8c8d9c7418d0b8697a595d9d808e0bc3',
            ext: '.ts',
          },
          {
            file: 'packages/linter/src/builders/lint/utility/ts-utils.ts',
            hash: '7ac3f7cabb6f05461c3fecf4e52ab7d78fee5839',
            ext: '.ts',
          },
          {
            file: 'packages/linter/tsconfig.json',
            hash: '58bd2c97a66f5e5ea5d05c8a5709ee79bad02094',
            ext: '.json',
          },
          {
            file: 'packages/linter/tsconfig.lib.json',
            hash: 'dbe90e0855d2ef980595dcc17f577088662cfb4d',
            ext: '.json',
          },
          {
            file: 'packages/linter/tsconfig.spec.json',
            hash: 'd6ae6669d75fc5beb184f28966262e1762b9623c',
            ext: '.json',
          },
        ],
      },
    },
    react: {
      name: 'react',
      type: 'lib',
      data: {
        root: 'packages/react',
        sourceRoot: 'packages/react',
        projectType: 'library',
        schematics: {},
        architect: {
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/react/jest.config.js',
              passWithNoTests: true,
            },
          },
          'build-base': {
            builder: '@nrwl/node:package',
            options: {
              outputPath: 'build/packages/react',
              tsConfig: 'packages/react/tsconfig.lib.json',
              packageJson: 'packages/react/package.json',
              main: 'packages/react/index.ts',
              updateBuildableProjectDepsInPackageJson: false,
              assets: [
                {
                  input: 'packages/react',
                  glob: '**/files/**',
                  output: '/',
                },
                {
                  input: 'packages/react',
                  glob: '**/files/**/.gitkeep',
                  output: '/',
                },
                {
                  input: 'packages/react',
                  glob: '**/files/**/.babelrc__tmpl__',
                  output: '/',
                },
                {
                  input: 'packages/react',
                  glob: '**/files/**/.browserslistrc__tmpl__',
                  output: '/',
                },
                {
                  input: 'packages/react',
                  glob: '**/*.json',
                  output: '/',
                },
                {
                  input: 'packages/react',
                  glob: '**/*.d.ts',
                  output: '/',
                },
                {
                  input: 'packages/react',
                  glob: '**/*.js',
                  output: '/',
                },
                'LICENSE',
              ],
            },
          },
          build: {
            builder: '@nrwl/workspace:run-commands',
            outputs: ['build/packages/react'],
            options: {
              commands: [
                {
                  command: 'nx build-base react',
                },
                {
                  command: 'node ./scripts/copy-readme.js react',
                },
              ],
              parallel: false,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/react/.eslintrc',
            hash: '9afd5d63f09f7d350b479cea3984ab4d8920d964',
            ext: '',
          },
          {
            file: 'packages/react/ast-utils.ts',
            hash: '1b96d3f6e2bf28e4377cdcd9ddfccc0a766c5bee',
            ext: '.ts',
          },
          {
            file: 'packages/react/babel.ts',
            hash: 'e2fbb486bcdfa08681dc8a17467d86b73a93c266',
            ext: '.ts',
          },
          {
            file: 'packages/react/collection.json',
            hash: '859d88b7ad9ec10ab777dab5c860a3132fd2d800',
            ext: '.json',
          },
          {
            file: 'packages/react/index.ts',
            hash: '8677be169de566fe5831cb1ff77a5c09c4bc5e3e',
            ext: '.ts',
          },
          {
            file: 'packages/react/jest.config.js',
            hash: '249c458ef5da4c448aed23ffa1fd427584443a72',
            ext: '.js',
          },
          {
            file: 'packages/react/migrations.json',
            hash: 'e77a9e0d7eaea01c76ef1cfbf5554671b636072b',
            ext: '.json',
          },
          {
            file: 'packages/react/package.json',
            hash: '7443c7c15cc627d89f23069bd4ebf7e101f21007',
            ext: '.json',
          },
          {
            file: 'packages/react/plugins/bundle-babel.ts',
            hash: 'df4aeb2bf5d591d425aeaa933e915b53e95a3b9c',
            ext: '.ts',
          },
          {
            file: 'packages/react/plugins/bundle-rollup.ts',
            hash: '74d2248cf903923a50d8df6973ec9a74573c5472',
            ext: '.ts',
          },
          {
            file: 'packages/react/plugins/jest.ts',
            hash: 'ccf2fad967fd2ea21b858df2cc0b6754243bbaec',
            ext: '.ts',
          },
          {
            file: 'packages/react/plugins/webpack.ts',
            hash: '28c0ce7aebd31c494f2574556c43f82d06f085c6',
            ext: '.ts',
          },
          {
            file: 'packages/react/README.md',
            hash: '61f6a30a41a2987b1ac4ff036216831a472d4878',
            ext: '.md',
          },
          {
            file:
              'packages/react/src/migrations/update-8-10-0/update-8-10-0.spec.ts',
            hash: 'd8df2feb953c236e18d1859114f8835b7d012898',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/migrations/update-8-10-0/update-8-10-0.ts',
            hash: 'dc8599469a4997512351ba324f0afaf272b22b96',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/migrations/update-8-10-1/fix-react-tsconfig-8-10-1.spec.ts',
            hash: '65aea059492ba85aeda2ea81b720d3a755f49326',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/migrations/update-8-10-1/fix-react-tsconfig-8-10-1.ts',
            hash: 'b0c0b6f4c32b5e1c331a25dc26c88322668291c4',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/migrations/update-8-12-0/fix-react-files-8-12-0.spec.ts',
            hash: '7c47b699b2aafb6e79b3d1dc1d7651138061e79c',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/migrations/update-8-12-0/fix-react-files-8-12-0.ts',
            hash: '98a591a4895f0d48e761c46d71b08e5b3090856c',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/migrations/update-8-12-0/update-8-12-0.spec.ts',
            hash: '419d4f3e5a04a1e00b5e5379b70fd307d49e9259',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/migrations/update-8-12-0/update-8-12-0.ts',
            hash: '4071ca6694d089bd36094de13a2ab319473b7e29',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/migrations/update-8-3-0/update-8-3-0.spec.ts',
            hash: '3d9663c9b2bcae02acfd8ae6d8c2fb2561e6d93d',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/migrations/update-8-3-0/update-8-3-0.ts',
            hash: '8741536a6889baf493440317bcf0eaa904e1265f',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/migrations/update-8-5-0/update-workspace-8-5-0.spec.ts',
            hash: '7f58e4b1383201c0d0324823b3a9d9b663a884e9',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/migrations/update-8-5-0/update-workspace-8-5-0.ts',
            hash: '32955c853f05bb7588ddc01f7813b6f953d5c088',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/migrations/update-8-7-0/update-8-7-0.ts',
            hash: '9b33feabfc27fbc5f9ef67c329cadbb202478196',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/migrations/update-8-9-0/update-8-9-0.spec.ts',
            hash: '390ad0fb5f2ab7e8971549d6921f81bc31d29834',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/migrations/update-8-9-0/update-8-9-0.ts',
            hash: '526e9fac8292c71033fcce87a44f28aecb851555',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/migrations/update-9-4-0/babelrc-9-4-0.spec.ts',
            hash: 'c2ee3ccc3ebd7aba7c84bbaf47d8710dd0e8eda9',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/migrations/update-9-4-0/babelrc-9-4-0.ts',
            hash: '9723c772df35bbd3311e139be79ac4b2ab3ab4fc',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/migrations/update-9-4-0/update-9-4-0.spec.ts',
            hash: '3ab1bf81431cfdefcf55810c8ba4bd159ebb056a',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/migrations/update-9-4-0/update-9-4-0.ts',
            hash: 'd48f2c2a016951d54ef5f8f31a8ad3771ff9584d',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/migrations/update-9-5-0/update-9-5-0.spec.ts',
            hash: 'b61cc74ba4755840108e44b1b554a3b6ec4712b3',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/migrations/update-9-5-0/update-9-5-0.ts',
            hash: '7e02967c9126883c5ebdaa9e50440018dea8a747',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/rules/add-styled-dependencies.ts',
            hash: '688fbabad5369b621acde5ed6f3050a6e0fca7d3',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/rules/update-babel-jest-config.spec.ts',
            hash: '43369770e96f876ba72c44cdaf5d76a53a200981',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/rules/update-babel-jest-config.ts',
            hash: 'a05b3ba6e109cbdbf5055a0e1bd484808b2db769',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/schematics/application/application.spec.ts',
            hash: 'd695572ad56a16bec16a9250ca02d65da5fa1cf9',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/schematics/application/application.ts',
            hash: '6f44eb469aab54e5c2da2514b0dbd25abf2d1d3c',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/schematics/application/files/app/.babelrc__tmpl__',
            hash: 'c851ab175f606ee798170c3a9f9b61b597a9c16f',
            ext: '',
          },
          {
            file:
              'packages/react/src/schematics/application/files/app/.browserslistrc__tmpl__',
            hash: 'f1d12df4faa25ab7f0f03196105e957395f609af',
            ext: '',
          },
          {
            file:
              'packages/react/src/schematics/application/files/app/src/app/__fileName__.__style__',
            hash: '315ded51815bfcadd6c5cdbeb051f7edf346307b',
            ext: '.__style__',
          },
          {
            file:
              'packages/react/src/schematics/application/files/app/src/app/__fileName__.spec.tsx__tmpl__',
            hash: '87f270e9e870267f3dddd8ab5add927954f49cf2',
            ext: '.tsx__tmpl__',
          },
          {
            file:
              'packages/react/src/schematics/application/files/app/src/app/__fileName__.tsx__tmpl__',
            hash: '9b3c57c5da4dad36cabbbd93e54948cebe8ca29a',
            ext: '.tsx__tmpl__',
          },
          {
            file:
              'packages/react/src/schematics/application/files/app/src/app/logo.svg',
            hash: '8fa84ab5092a65217b22dd0be03de5c6aea9a648',
            ext: '.svg',
          },
          {
            file:
              'packages/react/src/schematics/application/files/app/src/app/star.svg',
            hash: '901053d3854900761496d4077229c1633391b272',
            ext: '.svg',
          },
          {
            file:
              'packages/react/src/schematics/application/files/app/src/assets/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file:
              'packages/react/src/schematics/application/files/app/src/environments/environment.prod.ts__tmpl__',
            hash: '3612073bc31cd4c1f5d6cbb00318521e9a61bd8a',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/react/src/schematics/application/files/app/src/environments/environment.ts__tmpl__',
            hash: 'd9370e924b51bc67ecddee7fc3b6693681a324b6',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/react/src/schematics/application/files/app/src/favicon.ico',
            hash: '317ebcb2336e0833a22dddf0ab287849f26fda57',
            ext: '.ico',
          },
          {
            file:
              'packages/react/src/schematics/application/files/app/src/index.html',
            hash: '85edca9f5dbfe168c52a079b2d48c2f49283ef97',
            ext: '.html',
          },
          {
            file:
              'packages/react/src/schematics/application/files/app/src/main.tsx__tmpl__',
            hash: '6e332d45eccb06a3d8b3e62564161e6bf9ca67ef',
            ext: '.tsx__tmpl__',
          },
          {
            file:
              'packages/react/src/schematics/application/files/app/src/polyfills.ts__tmpl__',
            hash: '2adf3d05b6fcf479dd61c74f6bda95d9edb6ac6b',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/react/src/schematics/application/files/app/src/styles.__style__',
            hash: '90d4ee0072ce3fc41812f8af910219f9eea3c3de',
            ext: '.__style__',
          },
          {
            file:
              'packages/react/src/schematics/application/files/app/tsconfig.app.json',
            hash: '4597c8742503ac67e16256cba1cc1de23afb046e',
            ext: '.json',
          },
          {
            file:
              'packages/react/src/schematics/application/files/app/tsconfig.json__tmpl__',
            hash: '15affb4f3527565d066f87c60d02acc7fc1552ef',
            ext: '.json__tmpl__',
          },
          {
            file:
              'packages/react/src/schematics/application/lib/add-cypress.ts',
            hash: '974091f43f6d37293dac6df5a90ed89420a9ccef',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/schematics/application/lib/add-jest.ts',
            hash: '60db58b4c6c045aff8be115fa207589cfee0b112',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/schematics/application/lib/add-project.ts',
            hash: '5119d9b2c42fe235228d87ee9f3d8220baf8076b',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/schematics/application/lib/add-routing.ts',
            hash: 'f70d41489fe05a4cac0cefbaa5b8fb7acc9ff3b7',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/schematics/application/lib/create-application-files.helpers.ts',
            hash: 'b1fab3781e1ac7b01b384ae716ac5ddabc810916',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/schematics/application/lib/create-application-files.ts',
            hash: 'f53bdc52a1fd491d597642a8b186718aef12952e',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/schematics/application/lib/normalize-options.ts',
            hash: '1cb07aa5473d7d425ce4737d6321b6b29b6e5b98',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/schematics/application/lib/set-defaults.ts',
            hash: '6981cebf8eee602b235a87fd08294e9dc4249d0f',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/schematics/application/lib/update-jest-config.ts',
            hash: '102b9f5bd9f6ce6edf41cedd91390878c8de8508',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/schematics/application/lib/update-nx-json.ts',
            hash: '7cdb670669a295104f635b08586a174fe056635d',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/schematics/application/schema.d.ts',
            hash: '95f6896d9d5b10476770339b844245a3abd5238e',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/schematics/application/schema.json',
            hash: 'f52f9015ea001cfe9b72eb477ff387ef854a7819',
            ext: '.json',
          },
          {
            file:
              'packages/react/src/schematics/component-cypress-spec/component-cypress-spec.spec.ts',
            hash: '9a7384ddb367a934c486e61be7d7c4dbc918e71e',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/schematics/component-cypress-spec/component-cypress-spec.ts',
            hash: 'dab6b8a054e062bcdbbc2a448b327e756ec9aa22',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/schematics/component-cypress-spec/files/__componentName__.spec.__fileExt__.template',
            hash: '9a14b836dbdf405834c77faa2cd50bbb87c85867',
            ext: '.template',
          },
          {
            file:
              'packages/react/src/schematics/component-cypress-spec/schema.json',
            hash: 'b5a32fc0999f9d5ce04edaaaea4ba4c2666a116d',
            ext: '.json',
          },
          {
            file:
              'packages/react/src/schematics/component-story/component-story.spec.ts',
            hash: 'c18cdfca51b8d9d37ee21d71f75e03950fc9bb76',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/schematics/component-story/component-story.ts',
            hash: '6baef4102c219b4f83c5ba8604f84cfe904276d2',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/schematics/component-story/files/__componentFileName__.stories.__fileExt__.template',
            hash: '26395fb12e7792d9310ff3b93ba59573eec51d61',
            ext: '.template',
          },
          {
            file: 'packages/react/src/schematics/component-story/schema.json',
            hash: '9125fe1c4cfb6fe808f15e77c76cf0bce37c04a9',
            ext: '.json',
          },
          {
            file: 'packages/react/src/schematics/component/component.spec.ts',
            hash: '834889e9c2e16686268fe44c773fa624b68e8bed',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/schematics/component/component.ts',
            hash: '4a653252b8911424e77bacd0b87c3bfe5985045a',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/schematics/component/files/__fileName__.__style__',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.__style__',
          },
          {
            file:
              'packages/react/src/schematics/component/files/__fileName__.spec.tsx__tmpl__',
            hash: '70cf68f37cf2f646a224bd01fd84dd9f13b0ba91',
            ext: '.tsx__tmpl__',
          },
          {
            file:
              'packages/react/src/schematics/component/files/__fileName__.tsx__tmpl__',
            hash: '9bdba47ff6899abd8459223ed8e86a56640bf2a2',
            ext: '.tsx__tmpl__',
          },
          {
            file: 'packages/react/src/schematics/component/schema.d.ts',
            hash: 'd8b3b187480d043aecd6a5a3e9e9c8cfb98421fd',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/schematics/component/schema.json',
            hash: '7a07cbaa330582eb332480643c7c21c2d94339cc',
            ext: '.json',
          },
          {
            file: 'packages/react/src/schematics/init/init.spec.ts',
            hash: 'f276e3a9bc9aea81887407a7355c9fe97c71496e',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/schematics/init/init.ts',
            hash: '22db3ca77e1529e7de09df7e55d36fe8f1361eec',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/schematics/init/schema.d.ts',
            hash: '9f7995c018ef15ad32bf98effcb63686ac04cc85',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/schematics/init/schema.json',
            hash: '5d39839c024c338697cdfbd620a9747de2b71c21',
            ext: '.json',
          },
          {
            file:
              'packages/react/src/schematics/library/files/lib/.babelrc__tmpl__',
            hash: 'c851ab175f606ee798170c3a9f9b61b597a9c16f',
            ext: '',
          },
          {
            file:
              'packages/react/src/schematics/library/files/lib/package.json__tmpl__',
            hash: 'fa518765a372fc2c8593fdd59b748f284d1ee495',
            ext: '.json__tmpl__',
          },
          {
            file: 'packages/react/src/schematics/library/files/lib/README.md',
            hash: 'b74453ce2e8395837aad3c7c03e3ab14ae819218',
            ext: '.md',
          },
          {
            file:
              'packages/react/src/schematics/library/files/lib/src/index.ts__tmpl__',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/react/src/schematics/library/files/lib/tsconfig.json__tmpl__',
            hash: '82cd653430de29200831146d9d5e43f1ee5e8fbc',
            ext: '.json__tmpl__',
          },
          {
            file:
              'packages/react/src/schematics/library/files/lib/tsconfig.lib.json',
            hash: '7957a7db8e768299aedbeccac435a30024adb5c4',
            ext: '.json',
          },
          {
            file: 'packages/react/src/schematics/library/library.spec.ts',
            hash: '3b4005a4f96702b36067c8b3539edc8e064fd115',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/schematics/library/library.ts',
            hash: '57c0d2dc9d83c60055653c13159f66c4299fe66e',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/schematics/library/schema.d.ts',
            hash: 'ec66a58e23dc4ebcb48b33a264f88290b10e2cc2',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/schematics/library/schema.json',
            hash: '1caf0dfc583663bfce0cd714ce313a4dcdffdc70',
            ext: '.json',
          },
          {
            file:
              'packages/react/src/schematics/redux/files/__directory__/__fileName__.slice.spec.ts__tmpl__',
            hash: 'b96f5f281e11c1803ea7b8ff6dbbec98ee3ece38',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/react/src/schematics/redux/files/__directory__/__fileName__.slice.ts__tmpl__',
            hash: 'f6addfdd414badddaf7981143baa14582d6b4283',
            ext: '.ts__tmpl__',
          },
          {
            file: 'packages/react/src/schematics/redux/redux.spec.ts',
            hash: 'cd50bd73a86ea96255717cbc2738d66fce0342d8',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/schematics/redux/redux.ts',
            hash: 'b61ef2184ad0b18da111a805ac07000bb6e63d04',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/schematics/redux/schema.d.ts',
            hash: '1ec735610bd519497b2934d9168bad7af101fc60',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/schematics/redux/schema.json',
            hash: '5af5650e9bb033eb19a966f6618fc0cedd56ce22',
            ext: '.json',
          },
          {
            file: 'packages/react/src/schematics/stories/schema.json',
            hash: 'bf73a1e8d837ec54876d2521a6756b654086ceef',
            ext: '.json',
          },
          {
            file: 'packages/react/src/schematics/stories/stories.spec.ts',
            hash: '9d173cbfd9fcdd3ea6318c065a0451bfb6c31c5a',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/schematics/stories/stories.ts',
            hash: '27657a3d93b691b8389b2730db1e5f593b951050',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/schematics/storybook-configuration/configuration.spec.ts',
            hash: 'de026c9582447bff607812230eb429b015b239b4',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/schematics/storybook-configuration/configuration.ts',
            hash: '7532ec2e12df6d03b150c3bf1e6d8616a2f03727',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/schematics/storybook-configuration/schema.d.ts',
            hash: 'f1d8197a24a85e2ea15820c8314b7474bfd53d5c',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/schematics/storybook-configuration/schema.json',
            hash: 'f2335f8fcbc6a4f6712f2f904d6d26b961c0797c',
            ext: '.json',
          },
          {
            file: 'packages/react/src/utils/assertion.spec.ts',
            hash: '6bfb9ef9aa33c6d34386e89d39e0b786cab74ecb',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/utils/assertion.ts',
            hash: '59d939ff531eab6eade158f6384d095a371d1fb7',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/utils/ast-utils.spec.ts',
            hash: '3c171ffa5d073feda4ff15f168d65bfb2109e9b1',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/utils/ast-utils.ts',
            hash: 'dd1a4d896781cda9bd183cb632ae1cd22420bd4c',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/utils/babel-utils.ts',
            hash: '0a54bb7a6ffb2c33152cf693c095b7c5b02104d7',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/utils/dependencies.ts',
            hash: '8dcd07e1c1e5dd3705845c48ba8d3a59c9536c7e',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/utils/jest-utils.ts',
            hash: '89e534d699042cce75bc39279812694a6995f676',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/utils/lint.ts',
            hash: '8cb387ddd67ce980f658250a8a12f96a243d1120',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/utils/styled.ts',
            hash: '1cc4b7b1541f60883de95424d7e2ac7745290034',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/utils/testing.ts',
            hash: '7774437107f955e7aeb48cb59b54c884824d1f63',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/utils/versions.ts',
            hash: 'a0b33d96d77e88d144b02d540f496daab799a1ed',
            ext: '.ts',
          },
          {
            file: 'packages/react/tsconfig.json',
            hash: '58bd2c97a66f5e5ea5d05c8a5709ee79bad02094',
            ext: '.json',
          },
          {
            file: 'packages/react/tsconfig.lib.json',
            hash: 'dbe90e0855d2ef980595dcc17f577088662cfb4d',
            ext: '.json',
          },
          {
            file: 'packages/react/tsconfig.spec.json',
            hash: 'd6ae6669d75fc5beb184f28966262e1762b9623c',
            ext: '.json',
          },
          {
            file: 'packages/react/typings/cssmodule.d.ts',
            hash: '15f3046e360f1ca5169c032b5c943b14ae1bd385',
            ext: '.ts',
          },
          {
            file: 'packages/react/typings/image.d.ts',
            hash: 'd681dc294b89d4a9806a68e10dc9c115eca5469b',
            ext: '.ts',
          },
          {
            file: 'packages/react/typings/style.d.ts',
            hash: '8f2d76d63e51f636384784bab2f13902b3a272fa',
            ext: '.ts',
          },
          {
            file: 'packages/react/typings/styled-jsx.d.ts',
            hash: 'febdbe1583ae1eaf149309541b47f220f624489c',
            ext: '.ts',
          },
        ],
      },
    },
    bazel: {
      name: 'bazel',
      type: 'lib',
      data: {
        root: 'packages/bazel',
        sourceRoot: 'packages/bazel',
        projectType: 'library',
        schematics: {},
        architect: {
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/bazel/jest.config.js',
              passWithNoTests: true,
            },
          },
          'build-base': {
            builder: '@nrwl/node:package',
            options: {
              outputPath: 'build/packages/bazel',
              tsConfig: 'packages/bazel/tsconfig.lib.json',
              packageJson: 'packages/bazel/package.json',
              main: 'packages/bazel/index.ts',
              updateBuildableProjectDepsInPackageJson: false,
              assets: [
                {
                  input: 'packages/bazel',
                  glob: '**/files/**',
                  output: '/',
                },
                {
                  input: 'packages/bazel',
                  glob: '**/files/**/.gitkeep',
                  output: '/',
                },
                {
                  input: 'packages/bazel',
                  glob: '**/*.json',
                  output: '/',
                },
                {
                  input: 'packages/bazel',
                  glob: '**/*.js',
                  output: '/',
                },
                'LICENSE',
              ],
            },
          },
          build: {
            builder: '@nrwl/workspace:run-commands',
            outputs: ['build/packages/bazel'],
            options: {
              commands: [
                {
                  command: 'nx build-base bazel',
                },
                {
                  command: 'node ./scripts/copy-readme.js bazel',
                },
              ],
              parallel: false,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/bazel/.eslintrc',
            hash: '9afd5d63f09f7d350b479cea3984ab4d8920d964',
            ext: '',
          },
          {
            file: 'packages/bazel/collection.json',
            hash: 'e30026318eba94948314f52d66231b985b61b6b9',
            ext: '.json',
          },
          {
            file: 'packages/bazel/index.ts',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.ts',
          },
          {
            file: 'packages/bazel/jest.config.js',
            hash: 'af8300a1c1e60bad5d656a230038a7e738a675cb',
            ext: '.js',
          },
          {
            file: 'packages/bazel/migrations.json',
            hash: '63001b445889156d9b23c60598171ffc53a90d0c',
            ext: '.json',
          },
          {
            file: 'packages/bazel/package.json',
            hash: '16983db4af71d371a7473647b0af024c981d11c0',
            ext: '.json',
          },
          {
            file: 'packages/bazel/README.md',
            hash: '9f374bb99c2cf1de1d9b5d2f2774d3e1c5ca59a1',
            ext: '.md',
          },
          {
            file: 'packages/bazel/src/schematics/init/files/root/.bazelrc',
            hash: 'fdf240e6287239d6ccdf9df9b760c72930ef7286',
            ext: '',
          },
          {
            file: 'packages/bazel/src/schematics/init/init.spec.ts',
            hash: 'cfd26e1fbda5d49b4c1c54c35b256388d037c05a',
            ext: '.ts',
          },
          {
            file: 'packages/bazel/src/schematics/init/init.ts',
            hash: 'ef909117d4ccdf33f7260d4dab345e47760f0e48',
            ext: '.ts',
          },
          {
            file: 'packages/bazel/src/schematics/init/schema.json',
            hash: '726273331bb21017a91eadc9bdf47e82aa98bf59',
            ext: '.json',
          },
          {
            file:
              'packages/bazel/src/schematics/sync/files/build-file/BUILD.bazel__tmpl__',
            hash: '4323dea3269cfa25c11ed4696e1da66d57a7c215',
            ext: '.bazel__tmpl__',
          },
          {
            file:
              'packages/bazel/src/schematics/sync/files/root-build-file/BUILD.bazel__tmpl__',
            hash: 'a70a7dd660a30f2343721ff41bd1c8970a710b4c',
            ext: '.bazel__tmpl__',
          },
          {
            file:
              'packages/bazel/src/schematics/sync/files/workspace-file/WORKSPACE__tmpl__',
            hash: 'd1e36017a4b651d81e59c0f9794983ba9a06dc80',
            ext: '',
          },
          {
            file: 'packages/bazel/src/schematics/sync/schema.json',
            hash: '5ee1d10ff84dd4e8b4f0da71560408bfc4132e6c',
            ext: '.json',
          },
          {
            file: 'packages/bazel/src/schematics/sync/sync.spec.ts',
            hash: '9088ef507f2d970dc1dbd038127d24e02911b70d',
            ext: '.ts',
          },
          {
            file: 'packages/bazel/src/schematics/sync/sync.ts',
            hash: 'ad12788179907f5634193b07d1b9158657fb94aa',
            ext: '.ts',
          },
          {
            file: 'packages/bazel/src/schematics/utils/testing.ts',
            hash: 'd2469734456d406ed76e7d1e7002e1a8d576d1da',
            ext: '.ts',
          },
          {
            file: 'packages/bazel/src/schematics/utils/versions.ts',
            hash: '4594deca2825a5877a62f6a379c318ce0c4f5531',
            ext: '.ts',
          },
          {
            file: 'packages/bazel/tsconfig.json',
            hash: '58bd2c97a66f5e5ea5d05c8a5709ee79bad02094',
            ext: '.json',
          },
          {
            file: 'packages/bazel/tsconfig.lib.json',
            hash: 'dbe90e0855d2ef980595dcc17f577088662cfb4d',
            ext: '.json',
          },
          {
            file: 'packages/bazel/tsconfig.spec.json',
            hash: 'd6ae6669d75fc5beb184f28966262e1762b9623c',
            ext: '.json',
          },
        ],
      },
    },
    jest: {
      name: 'jest',
      type: 'lib',
      data: {
        root: 'packages/jest',
        sourceRoot: 'packages/jest',
        projectType: 'library',
        schematics: {},
        architect: {
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/jest/jest.config.js',
              passWithNoTests: true,
            },
          },
          'build-base': {
            builder: '@nrwl/node:package',
            options: {
              outputPath: 'build/packages/jest',
              tsConfig: 'packages/jest/tsconfig.lib.json',
              packageJson: 'packages/jest/package.json',
              main: 'packages/jest/index.ts',
              updateBuildableProjectDepsInPackageJson: false,
              assets: [
                {
                  input: 'packages/jest',
                  glob: '**/files/**',
                  output: '/',
                },
                {
                  input: 'packages/jest',
                  glob: '**/files/**/.gitkeep',
                  output: '/',
                },
                {
                  input: 'packages/jest',
                  glob: '**/*.json',
                  output: '/',
                },
                {
                  input: 'packages/jest',
                  glob: '**/*.js',
                  output: '/',
                },
                'LICENSE',
              ],
            },
          },
          build: {
            builder: '@nrwl/workspace:run-commands',
            outputs: ['build/packages/jest'],
            options: {
              commands: [
                {
                  command: 'nx build-base jest',
                },
                {
                  command: 'node ./scripts/copy-readme.js jest',
                },
              ],
              parallel: false,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/jest/.eslintrc',
            hash: '9afd5d63f09f7d350b479cea3984ab4d8920d964',
            ext: '',
          },
          {
            file: 'packages/jest/builders.json',
            hash: 'd540d843088705dcd1ef059ff288c054a9b8b1ad',
            ext: '.json',
          },
          {
            file: 'packages/jest/collection.json',
            hash: 'dae9c4689f2ba0f126ed172b7e899a3e83919fed',
            ext: '.json',
          },
          {
            file: 'packages/jest/index.ts',
            hash: '27d682ebc832afcb5194ad1758bb6483609c8c6f',
            ext: '.ts',
          },
          {
            file: 'packages/jest/jest.config.js',
            hash: '94a01f8b7e64859d2e4b4003ae9b55192e24768e',
            ext: '.js',
          },
          {
            file: 'packages/jest/migrations.json',
            hash: 'db222e7d82bbc2201c053f8a4a3c1aee64c35c85',
            ext: '.json',
          },
          {
            file: 'packages/jest/package.json',
            hash: 'be1006a0a0cc876f6d086244d77e759e8418a569',
            ext: '.json',
          },
          {
            file: 'packages/jest/plugins/resolver.ts',
            hash: 'd7145c7bfc8808f38d4032724801ba686a56d23c',
            ext: '.ts',
          },
          {
            file: 'packages/jest/README.md',
            hash: '600ca68167ff9d81708e04912b917fa7f72f1e13',
            ext: '.md',
          },
          {
            file: 'packages/jest/src/builders/jest/jest.impl.spec.ts',
            hash: 'da50800f42d6bdabf439038651dd352d3a638320',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/builders/jest/jest.impl.ts',
            hash: 'b24aac04ade842589b0bba52bf7c6c369f300454',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/builders/jest/schema.d.ts',
            hash: 'd04905bb3c61b1549d24b9a3a23eb3f647d9bce2',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/builders/jest/schema.json',
            hash: 'd41490a9224ee054b3c9e7ac27e9ed0639b794a7',
            ext: '.json',
          },
          {
            file:
              'packages/jest/src/migrations/update-10-0-0/require-jest-config.ts',
            hash: 'b96f903f8ccdf46307652b60e6bec5d1de588c4f',
            ext: '.ts',
          },
          {
            file:
              'packages/jest/src/migrations/update-10-0-0/update-jest-configs.spec.ts',
            hash: '8aa6a940d32b7c0a204614abcd8ead4810131304',
            ext: '.ts',
          },
          {
            file:
              'packages/jest/src/migrations/update-10-0-0/update-jest-configs.ts',
            hash: '8a46b48abd4302cfa654f466d3bbe31fdac274dc',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/migrations/update-10-1-0/update-10-1-0.ts',
            hash: '9e18196a45cb1f2cfe0504ce2cf724090c8deaf5',
            ext: '.ts',
          },
          {
            file:
              'packages/jest/src/migrations/update-10-2-0/update-10-2-0.spec.ts',
            hash: 'd07d9d7124ed23cbcaec8c27ad3db7d1ec2cd34b',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/migrations/update-10-2-0/update-10-2-0.ts',
            hash: '7ba77212088a49e14293226e19d68e5044086911',
            ext: '.ts',
          },
          {
            file:
              'packages/jest/src/migrations/update-8-3-0/test-files/jest.config.js',
            hash: '9b08aea993436d418b2212c28ad968e5e38de626',
            ext: '.js',
          },
          {
            file:
              'packages/jest/src/migrations/update-8-3-0/update-8-3-0.spec.ts',
            hash: '87a651cd020d33e4f4ace15a0e7d0d436bab1391',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/migrations/update-8-3-0/update-8-3-0.ts',
            hash: '4775f1820adedfa8ce85815075bbe289dceea12a',
            ext: '.ts',
          },
          {
            file:
              'packages/jest/src/migrations/update-8-7-0/update-8-7-0.spec.ts',
            hash: '659d95f1f0b0fc7f38bd92cc077ac3c4ab92bf3b',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/migrations/update-8-7-0/update-8-7-0.ts',
            hash: 'b7dcd893099f6622d375e386e551e590c59d49d5',
            ext: '.ts',
          },
          {
            file:
              'packages/jest/src/migrations/update-9-0-0/update-9-0-0.spec.ts',
            hash: 'd25c5d6e4d98bbc103db87bb749d784323723722',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/migrations/update-9-0-0/update-9-0-0.ts',
            hash: '245aae9f9f9380e768737c15743b42d70913fbd5',
            ext: '.ts',
          },
          {
            file:
              'packages/jest/src/migrations/update-9-0-1/test-files/jest.config.js',
            hash: 'e4ee1a2b33936b60a546b743d5f706fcc5cf10f6',
            ext: '.js',
          },
          {
            file:
              'packages/jest/src/migrations/update-9-0-1/update-9-0-1.spec.ts',
            hash: '30fa56ce0747ed92a05acd942488d60c9ee79692',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/migrations/update-9-0-1/update-9-0-1.ts',
            hash: '2c6b466fee13cdcd3962a8f6864a05b6d132eda7',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/migrations/update-9-2-0/update-9-2-0.ts',
            hash: '4c6be6484ebd99e3a99fcd525efc833575fe79b5',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/schematics/init/init.spec.ts',
            hash: '4e13d9c601e14096dcf2cbd7bf010355aa81fa66',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/schematics/init/init.ts',
            hash: '45a5c2cbe5936d35962d5ee2afddabfad8c63467',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/schematics/init/schema.d.ts',
            hash: 'a4e35c09d6b25fa9c3e12831fdf4ecbfdc11ff24',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/schematics/init/schema.json',
            hash: 'f1bfe821fc82be05549831728b2c29c6cff5803e',
            ext: '.json',
          },
          {
            file:
              'packages/jest/src/schematics/jest-project/files/babel-jest.config.json__tmpl__',
            hash: '6c6534b0e88d240b5713f96227a935a3f6957b1c',
            ext: '.json__tmpl__',
          },
          {
            file:
              'packages/jest/src/schematics/jest-project/files/jest.config.js__tmpl__',
            hash: '567cc52fabd37754f45a85f003794f7940e27b6c',
            ext: '.js__tmpl__',
          },
          {
            file:
              'packages/jest/src/schematics/jest-project/files/src/test-setup.ts__tmpl__',
            hash: 'ed2d24fecf16657017c452e8d424deaf95baa9d3',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/jest/src/schematics/jest-project/files/tsconfig.spec.json__tmpl__',
            hash: '9cad516d73243471ba7d7aa0a3479936213ca26b',
            ext: '.json__tmpl__',
          },
          {
            file:
              'packages/jest/src/schematics/jest-project/jest-project.spec.ts',
            hash: '1a20d4a2866c0aadfaba8a6e53adf3c2399b58b2',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/schematics/jest-project/jest-project.ts',
            hash: 'e493d8b36d52d67eff6f1d5f6d470d7aa0deebfc',
            ext: '.ts',
          },
          {
            file:
              'packages/jest/src/schematics/jest-project/lib/check-for-test-target.ts',
            hash: 'e5c28f4dfbee117259a583131818701249c6e128',
            ext: '.ts',
          },
          {
            file:
              'packages/jest/src/schematics/jest-project/lib/generate-files.ts',
            hash: 'bed2bf5aea2129e5d337c0c51c109e1f2db8a53c',
            ext: '.ts',
          },
          {
            file:
              'packages/jest/src/schematics/jest-project/lib/update-tsconfig.ts',
            hash: 'c5cfaf01593af6bf23b4b39993ce54949e15ddeb',
            ext: '.ts',
          },
          {
            file:
              'packages/jest/src/schematics/jest-project/lib/update-workspace.ts',
            hash: '481f3c08ff81d2952aa5aecd2a91c01f78aa667e',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/schematics/jest-project/schema.d.ts',
            hash: '367526d59a98e3e063e2898b3c86a9e0e7167f80',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/schematics/jest-project/schema.json',
            hash: '09be1be526dfb36cd1f89c5e39b7546dd797a4f7',
            ext: '.json',
          },
          {
            file: 'packages/jest/src/utils/config/functions.ts',
            hash: '1babb3cf9a1855474533800c3809edf4360447c9',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/utils/config/update-config.spec.ts',
            hash: 'c61156b5d26e6f406376676c2b4ab916580fef05',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/utils/config/update-config.ts',
            hash: '5687b992392849fce357a3f08bdf12c17db39c50',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/utils/testing.ts',
            hash: '79ebb61bca8a1b34cdd1cbc6312b3c673d068bc2',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/utils/versions.ts',
            hash: '9c2deb988891332331da9d010f9d9c9d16482647',
            ext: '.ts',
          },
          {
            file: 'packages/jest/tsconfig.json',
            hash: '58bd2c97a66f5e5ea5d05c8a5709ee79bad02094',
            ext: '.json',
          },
          {
            file: 'packages/jest/tsconfig.lib.json',
            hash: '037d796f286235dce67c9e648d2d42adcc61ccd7',
            ext: '.json',
          },
          {
            file: 'packages/jest/tsconfig.spec.json',
            hash: '559410b96af6781ac3e7cf348bf4a710b4009481',
            ext: '.json',
          },
        ],
      },
    },
    node: {
      name: 'node',
      type: 'lib',
      data: {
        root: 'packages/node',
        sourceRoot: 'packages/node',
        projectType: 'library',
        schematics: {},
        architect: {
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/node/jest.config.js',
              passWithNoTests: true,
            },
          },
          'build-base': {
            builder: '@nrwl/node:package',
            options: {
              outputPath: 'build/packages/node',
              tsConfig: 'packages/node/tsconfig.lib.json',
              packageJson: 'packages/node/package.json',
              main: 'packages/node/index.ts',
              updateBuildableProjectDepsInPackageJson: false,
              assets: [
                {
                  input: 'packages/node',
                  glob: '**/files/**',
                  output: '/',
                },
                {
                  input: 'packages/node',
                  glob: '**/files/**/.gitkeep',
                  output: '/',
                },
                {
                  input: 'packages/node',
                  glob: '**/*.json',
                  output: '/',
                },
                {
                  input: 'packages/node',
                  glob: '**/*.js',
                  output: '/',
                },
                'LICENSE',
              ],
            },
          },
          build: {
            builder: '@nrwl/workspace:run-commands',
            outputs: ['build/packages/node'],
            options: {
              commands: [
                {
                  command: 'nx build-base node',
                },
                {
                  command: 'node ./scripts/copy-readme.js node',
                },
              ],
              parallel: false,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/node/.eslintrc',
            hash: '9afd5d63f09f7d350b479cea3984ab4d8920d964',
            ext: '',
          },
          {
            file: 'packages/node/builders.json',
            hash: '1e48bb57ae92aa67702fe6c3acdc1a122b3a83cf',
            ext: '.json',
          },
          {
            file: 'packages/node/collection.json',
            hash: 'c029fecaec4f5c26757c4846d3f9f450f9278920',
            ext: '.json',
          },
          {
            file: 'packages/node/index.ts',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.ts',
          },
          {
            file: 'packages/node/jest.config.js',
            hash: '2c981629d52f013cc17a8654a56b3b71f335c43b',
            ext: '.js',
          },
          {
            file: 'packages/node/migrations.json',
            hash: 'ac03218981e8ec8823fc7f8d7f031037bd99ce25',
            ext: '.json',
          },
          {
            file: 'packages/node/package.json',
            hash: '6a43b5354602a11dde1817ee88b4a835a150fa99',
            ext: '.json',
          },
          {
            file: 'packages/node/README.md',
            hash: '7fc3ef6456fc177a3f886e58416ab77d4e420de9',
            ext: '.md',
          },
          {
            file: 'packages/node/src/builders/build/build.impl.ts',
            hash: '4a117680591c99fd10d319dd5a41404a1c7d64bf',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/builders/build/schema.json',
            hash: '389c967f10ee4a8dc454ac5eb1e44e5ab05976e0',
            ext: '.json',
          },
          {
            file: 'packages/node/src/builders/execute/execute.impl.spec.ts',
            hash: 'f551784ccf759d7275b494e3cea3eb94e06d5086',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/builders/execute/execute.impl.ts',
            hash: 'eb4dd8ce5091052891c0f24dba360004082acfad',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/builders/execute/schema.json',
            hash: '609c7c27ecea47f280c7ce04b14cc4f63d083654',
            ext: '.json',
          },
          {
            file: 'packages/node/src/builders/package/package.impl.spec.ts',
            hash: '03d76688ae40528cf78ae6b9dbfb9ea04ad39b11',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/builders/package/package.impl.ts',
            hash: 'a7885093b80c23629315cb57ae1f28d62a17bf30',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/builders/package/schema.json',
            hash: 'fcf061c1bbf9d14f9c57efe9a44c335b35e765a1',
            ext: '.json',
          },
          {
            file:
              'packages/node/src/builders/package/utils/compile-typescript-files.ts',
            hash: '20fb4c9bab5249cdefd5fbd45a65839ac2dbfc42',
            ext: '.ts',
          },
          {
            file:
              'packages/node/src/builders/package/utils/copy-asset-files.ts',
            hash: 'cec48af6454d81b57e64f70d20b009b7caa762dd',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/builders/package/utils/models.ts',
            hash: '88a89621894f9222069ca766a648969b154a3b37',
            ext: '.ts',
          },
          {
            file:
              'packages/node/src/builders/package/utils/normalize-options.ts',
            hash: '13c467b346ee868255f48503eeae0a6b6c5cabdd',
            ext: '.ts',
          },
          {
            file:
              'packages/node/src/builders/package/utils/update-package-json.ts',
            hash: 'b9d9d9f3f17279d32dec30d9cfea2b9e2e3f5164',
            ext: '.ts',
          },
          {
            file:
              'packages/node/src/migrations/update-10-1-0/remove-root-dir.spec.ts',
            hash: 'dd6f24a9ef5076799b9428396bbed42cc8b0c7d7',
            ext: '.ts',
          },
          {
            file:
              'packages/node/src/migrations/update-10-1-0/remove-root-dir.ts',
            hash: 'e369c9573ceb3ccd34af62b9b68a00892b70aa5f',
            ext: '.ts',
          },
          {
            file:
              'packages/node/src/migrations/update-9-2-0/set-build-libs-from-source.spec.ts',
            hash: 'ed9fe96e9e002fa7d5e48763e182075d62a73f93',
            ext: '.ts',
          },
          {
            file:
              'packages/node/src/migrations/update-9-2-0/set-build-libs-from-source.ts',
            hash: '9e9a3216d97455012714b219fa37b98bf2f8ee96',
            ext: '.ts',
          },
          {
            file:
              'packages/node/src/schematics/application/application.spec.ts',
            hash: 'fb118bf1772cd16829e97fac8486e9d07dddce26',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/schematics/application/application.ts',
            hash: 'dfdfb1a03eda768763eb00722bccaffecdd20c66',
            ext: '.ts',
          },
          {
            file:
              'packages/node/src/schematics/application/files/app/src/app/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file:
              'packages/node/src/schematics/application/files/app/src/assets/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file:
              'packages/node/src/schematics/application/files/app/src/environments/environment.prod.ts__tmpl__',
            hash: '3612073bc31cd4c1f5d6cbb00318521e9a61bd8a',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/node/src/schematics/application/files/app/src/environments/environment.ts__tmpl__',
            hash: 'ffe8aed76642585a382f5673e2c08e96de695788',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/node/src/schematics/application/files/app/src/main.ts__tmpl__',
            hash: 'a420803c09eec03f5e419c693d817f785a0b8efa',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/node/src/schematics/application/files/app/tsconfig.app.json',
            hash: '30409887633151df04be1a78929ac12c6d3389ec',
            ext: '.json',
          },
          {
            file:
              'packages/node/src/schematics/application/files/app/tsconfig.json',
            hash: 'a6db50db59d2d124d9f0bfb5e24a065857d1bee6',
            ext: '.json',
          },
          {
            file: 'packages/node/src/schematics/application/schema.d.ts',
            hash: 'a3ee57d744e299900a4a3689fa35a5576c8d0cfd',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/schematics/application/schema.json',
            hash: 'adfd84621aa179bfd732dfbcac3c806caddeb572',
            ext: '.json',
          },
          {
            file: 'packages/node/src/schematics/init/init.spec.ts',
            hash: 'caa390e86323974a34609315c659441de959be26',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/schematics/init/init.ts',
            hash: 'b7b67d3873afaf514c4070de63ce20cf2e5e51b5',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/schematics/init/schema.d.ts',
            hash: '52ac13000a18d701532ccd65ffecfe545ff28d55',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/schematics/init/schema.json',
            hash: 'ec628380972b848fd1d196eb3bd2119fafbbe4e2',
            ext: '.json',
          },
          {
            file:
              'packages/node/src/schematics/library/files/lib/package.json__tmpl__',
            hash: 'e3a3ad83c46eb57baf768ec2c0e0be269c7bac1c',
            ext: '.json__tmpl__',
          },
          {
            file:
              'packages/node/src/schematics/library/files/lib/src/lib/__fileName__.spec.ts__tmpl__',
            hash: '35b0948b95087892cb9694ff9880cf254de6985e',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/node/src/schematics/library/files/lib/src/lib/__fileName__.ts__tmpl__',
            hash: '87f0f45f164a16721ae12a45855828b815b5bc82',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/node/src/schematics/library/files/lib/tsconfig.lib.json',
            hash: '0dc5244a4b716316159459f8cb882fce5beac7b9',
            ext: '.json',
          },
          {
            file: 'packages/node/src/schematics/library/library.spec.ts',
            hash: 'a4fbb32ac7d2d5502e062dba1d1af3b25f94c76c',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/schematics/library/library.ts',
            hash: 'baef95527dcc5dcbd9ec59d02e5de91de42ec4e3',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/schematics/library/schema.d.ts',
            hash: 'de252fd666b0f1e31c1b7b28bdbf5262ec33cfc0',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/schematics/library/schema.json',
            hash: 'bfd8e09b8f71a5911ea13a8dbbaa691bd654cefd',
            ext: '.json',
          },
          {
            file: 'packages/node/src/utils/config.spec.ts',
            hash: '9a8bd85fea4f5fbabdadc7012718b2fd404ea304',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/utils/config.ts',
            hash: '5421e25c4bfcc8201d7c3d134975ffd4721c7d81',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/utils/node.config.spec.ts',
            hash: '7f9bd701d6a782943de01694c5df63c6768ffcf8',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/utils/node.config.ts',
            hash: '4e24f49dea3a1b88beb66e38925d48b196afeff5',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/utils/normalize.spec.ts',
            hash: '0deab2f693d3ac49ab4a8f1acdbc25a5956832a8',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/utils/normalize.ts',
            hash: '7c1a153944dcd4e089750b73bb4231293557bbe3',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/utils/testing.ts',
            hash: 'c651014110d4fd98ca772efb308850bb50c81bc5',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/utils/types.ts',
            hash: '9ff550f78b007bab43f50d02db97f5d9d8b727f5',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/utils/versions.ts',
            hash: 'df701d624b0613121aa0c04a1a6dd1a00daa09f2',
            ext: '.ts',
          },
          {
            file: 'packages/node/tsconfig.json',
            hash: '58bd2c97a66f5e5ea5d05c8a5709ee79bad02094',
            ext: '.json',
          },
          {
            file: 'packages/node/tsconfig.lib.json',
            hash: 'dbe90e0855d2ef980595dcc17f577088662cfb4d',
            ext: '.json',
          },
          {
            file: 'packages/node/tsconfig.spec.json',
            hash: 'd6ae6669d75fc5beb184f28966262e1762b9623c',
            ext: '.json',
          },
        ],
      },
    },
    next: {
      name: 'next',
      type: 'lib',
      data: {
        root: 'packages/next',
        sourceRoot: 'packages/next',
        projectType: 'library',
        schematics: {},
        architect: {
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/next/jest.config.js',
              passWithNoTests: true,
            },
          },
          'build-base': {
            builder: '@nrwl/node:package',
            options: {
              outputPath: 'build/packages/next',
              tsConfig: 'packages/next/tsconfig.lib.json',
              packageJson: 'packages/next/package.json',
              main: 'packages/next/index.ts',
              updateBuildableProjectDepsInPackageJson: false,
              assets: [
                {
                  input: 'packages/next',
                  glob: '**/files/**',
                  output: '/',
                },
                {
                  input: 'packages/next',
                  glob: '**/files/**/.gitkeep',
                  output: '/',
                },
                {
                  input: 'packages/next',
                  glob: '**/files/**/.babelrc__tmpl__',
                  output: '/',
                },
                {
                  input: 'packages/next',
                  glob: '**/*.json',
                  output: '/',
                },
                {
                  input: 'packages/next',
                  glob: '**/*.js',
                  output: '/',
                },
                'LICENSE',
              ],
            },
          },
          build: {
            builder: '@nrwl/workspace:run-commands',
            outputs: ['build/packages/next'],
            options: {
              commands: [
                {
                  command: 'nx build-base next',
                },
                {
                  command: 'node ./scripts/copy-readme.js next',
                },
              ],
              parallel: false,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/next/.eslintrc',
            hash: '9afd5d63f09f7d350b479cea3984ab4d8920d964',
            ext: '',
          },
          {
            file: 'packages/next/builders.json',
            hash: '4e071410670455dbccf4c1b39a7c4ce6c7c8df21',
            ext: '.json',
          },
          {
            file: 'packages/next/collection.json',
            hash: '47ea21b8ffc53606087647d68b9fdba3153c4b1e',
            ext: '.json',
          },
          {
            file: 'packages/next/index.ts',
            hash: '028abca244cb6fc7895424b1e309f3533caf6973',
            ext: '.ts',
          },
          {
            file: 'packages/next/jest.config.js',
            hash: 'f93c1571b9b105f592b70507ec308a636bf015f2',
            ext: '.js',
          },
          {
            file: 'packages/next/migrations.json',
            hash: '9a3fc04761bcee366bb29486dd8c8b97b511c2ba',
            ext: '.json',
          },
          {
            file: 'packages/next/package.json',
            hash: '1469d4064c57ad36f700aaaf12e4a93c0fa4b8df',
            ext: '.json',
          },
          {
            file: 'packages/next/README.md',
            hash: '5d9e5fb3c17b9b4616291cd5a0caf1d5b246499b',
            ext: '.md',
          },
          {
            file: 'packages/next/src/builders/build/build.impl.spec.ts',
            hash: '0e37b55ca0b71f418d881aa7142c911aeb2844b0',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/builders/build/build.impl.ts',
            hash: '4bd799b475c1104903f5a6dd9fa3df6a74bbee78',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/builders/build/lib/create-package-json.ts',
            hash: '67c3d42a56e73a5343a32729b790bd1292540ccd',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/builders/build/schema.json',
            hash: 'ee6b03c50e978f3466db0e946898cff6b9439b39',
            ext: '.json',
          },
          {
            file: 'packages/next/src/builders/export/export.impl.ts',
            hash: 'bf6f937a337a99a4e330cc7de5a8ab9e5934caa5',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/builders/export/schema.json',
            hash: 'ef1b578cc5b6494d4087642a1238ca736c879f80',
            ext: '.json',
          },
          {
            file: 'packages/next/src/builders/server/lib/custom-server.ts',
            hash: 'b80a5cdd5124fbe82d4ef730c8239c17de3c378f',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/builders/server/lib/default-server.ts',
            hash: '31df70998af180b2b659171ee31d54fb593ad9d6',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/builders/server/schema.json',
            hash: '20ca9824555a6877a5e476c6b58a20a865d6bae9',
            ext: '.json',
          },
          {
            file: 'packages/next/src/builders/server/server.impl.ts',
            hash: '973306e870096c32ea94202a9d621807b14fcf4e',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/migrations/update-10-1-0/update-10-1-0.ts',
            hash: '9e18196a45cb1f2cfe0504ce2cf724090c8deaf5',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/migrations/update-8-10-0/update-8-10-0.ts',
            hash: '44354a45ff6fafe1d9f7a5e3c6fa15e2be6be673',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/migrations/update-9-2-0/create-next-config.spec.ts',
            hash: 'e7531a62e5b5b4597e5ae4a6fbcfa5cb9fd78b3e',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/migrations/update-9-2-0/create-next-config.ts',
            hash: '4d2fb3a2f79567acc3b241c443e64c005683be77',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/migrations/update-9-3-1/update-9-3-1.ts',
            hash: '701780ffc8b86ee475b32564c86d963a8b89ebb4',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/schematics/application/application.spec.ts',
            hash: 'c696507c6479f51830e2227ff9de5af2bf45a3e8',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/schematics/application/application.ts',
            hash: '5e1143dacc47be7a04e10ff790afe761c7526fde',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/schematics/application/files/.babelrc__tmpl__',
            hash: '4d62a607c0a2cb5f5d7b3e3be1421f9fde763eb1',
            ext: '',
          },
          {
            file:
              'packages/next/src/schematics/application/files/index.d.ts__tmpl__',
            hash: '7ba08fa17ccbb3d5eaa4d9c7b435bd44ff43f330',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/next/src/schematics/application/files/next-env.d.ts__tmpl__',
            hash: '7b7aa2c7727d88b33b62bee640d607d57cc79599',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/next/src/schematics/application/files/next.config.js__tmpl__',
            hash: 'fb13bf5b36d724e0f1b6340744240a2edd908f56',
            ext: '.js__tmpl__',
          },
          {
            file:
              'packages/next/src/schematics/application/files/pages/__fileName__.module.__style__',
            hash: '8a13e21cb3114dc597001050a8afda0a6add8b37',
            ext: '.__style__',
          },
          {
            file:
              'packages/next/src/schematics/application/files/pages/__fileName__.tsx__tmpl__',
            hash: 'f6b8aef0611b84034af0bfcefad10356b47a0efe',
            ext: '.tsx__tmpl__',
          },
          {
            file:
              'packages/next/src/schematics/application/files/pages/_app.tsx__tmpl__',
            hash: '8370acd0e5140d71a289fa4a95882dd012322dde',
            ext: '.tsx__tmpl__',
          },
          {
            file:
              'packages/next/src/schematics/application/files/pages/_document.tsx__tmpl__',
            hash: 'be2c9417b12e458e3e4e42f992b5d5f0780052de',
            ext: '.tsx__tmpl__',
          },
          {
            file:
              'packages/next/src/schematics/application/files/pages/styles.css__tmpl__',
            hash: '315ded51815bfcadd6c5cdbeb051f7edf346307b',
            ext: '.css__tmpl__',
          },
          {
            file:
              'packages/next/src/schematics/application/files/public/nx-logo-white.svg',
            hash: '577944247dec3ec43f3804672841755f0a483d09',
            ext: '.svg',
          },
          {
            file:
              'packages/next/src/schematics/application/files/public/star.svg',
            hash: '901053d3854900761496d4077229c1633391b272',
            ext: '.svg',
          },
          {
            file:
              'packages/next/src/schematics/application/files/specs/__fileName__.spec.tsx__tmpl__',
            hash: '42c94022afd1c1c396f85b24a08d75984b8adb9c',
            ext: '.tsx__tmpl__',
          },
          {
            file:
              'packages/next/src/schematics/application/files/tsconfig.json__tmpl__',
            hash: 'c6e438c868197812dc327559d3ea4f1ab3bdbe9c',
            ext: '.json__tmpl__',
          },
          {
            file: 'packages/next/src/schematics/application/lib/add-cypress.ts',
            hash: 'baa15ad088d3d5499d865c62eb6a4010f6084589',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/schematics/application/lib/add-jest.ts',
            hash: 'cb2a613c8707879e781c9ea3ca71735b643f7a78',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/schematics/application/lib/add-project.spec.ts',
            hash: '571bc066cae7b0f950e1640200877c563b25dcca',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/schematics/application/lib/add-project.ts',
            hash: '181bfa7025bd04b6f92a6e835c9f44a0d3c9cd98',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/schematics/application/lib/create-application-files.helpers.ts',
            hash: '9a9103b6cee4558f7696c03bb5b064bccbb450d0',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/schematics/application/lib/create-application-files.ts',
            hash: '2dbb730a6dff7ab0e56d23ff957ccea9e6ba68c8',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/schematics/application/lib/create-next-server-files.ts',
            hash: 'c0cee27ff9253345933a6c6b55e41b1fa956a60d',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/schematics/application/lib/normalize-options.ts',
            hash: '6a09f415a43341d1304d4698e0a149d9b66e34a9',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/schematics/application/lib/set-defaults.ts',
            hash: '184c9087317aa7c238453cdc34c396f41cc93627',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/schematics/application/lib/update-jest-config.ts',
            hash: 'bae8e27cd604dbcf5ebaac72c9e1fb15ba4691d9',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/schematics/application/lib/update-nx-json.ts',
            hash: 'ac507f4567cd4f47604dec36030274f80f4a4aa1',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/schematics/application/schema.d.ts',
            hash: '5e92fbacddea83fba9539f1f197d31357920ea66',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/schematics/application/schema.json',
            hash: 'f2c857394a08b23b6fdd42daf402bb19335adf1d',
            ext: '.json',
          },
          {
            file: 'packages/next/src/schematics/component/component.spec.ts',
            hash: 'a4df379acb409a9aebd1c1cf6140964b9b9ebaa2',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/schematics/component/component.ts',
            hash: '37d71d7cbc642a18cf8494046217c95f0d4e8f38',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/schematics/component/schema.json',
            hash: '9d4ac62bd8c28ea44458fb1447e39ced0f1752ae',
            ext: '.json',
          },
          {
            file: 'packages/next/src/schematics/init/init.spec.ts',
            hash: '1693df631259cadd902fb60b6dc1488547ab9abd',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/schematics/init/init.ts',
            hash: 'bc62ed52105488e3fe8c96fe41df02df3b50c5d0',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/schematics/init/schema.d.ts',
            hash: '9f7995c018ef15ad32bf98effcb63686ac04cc85',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/schematics/init/schema.json',
            hash: '733f82413996668554b4e04d34dce7724d912bcb',
            ext: '.json',
          },
          {
            file: 'packages/next/src/schematics/page/page.spec.ts',
            hash: '34b70f04eec4996908b2d6c3ed643ee916a1866b',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/schematics/page/page.ts',
            hash: '4e59529354e630241a5a18dd977510226a446e9c',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/schematics/page/schema.d.ts',
            hash: '717434e99222bc08b01ea365759a9f7f630fbfab',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/schematics/page/schema.json',
            hash: '5510ff788db8c6aea3cc94cf8327d2e850c00b2b',
            ext: '.json',
          },
          {
            file: 'packages/next/src/utils/config.spec.ts',
            hash: '43ca5f49f0a4d99d17ebfd08b9504ac99182987a',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/utils/config.ts',
            hash: 'b8a04f4bc35ba70fcfe644595146870e9b481543',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/utils/styles.ts',
            hash: 'd9e7a66dfda9f14491d411269a4b0194cdbce8ec',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/utils/testing.ts',
            hash: 'bad1c3680a30ce582b8d5f1b5f814aa4542d95b8',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/utils/types.ts',
            hash: '84dbc3b17cacfb58483df3297e0e3c0484ab9875',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/utils/versions.ts',
            hash: 'afd7a49c9a23190cf00a7ff50e4249a600158d54',
            ext: '.ts',
          },
          {
            file: 'packages/next/tsconfig.json',
            hash: '58bd2c97a66f5e5ea5d05c8a5709ee79bad02094',
            ext: '.json',
          },
          {
            file: 'packages/next/tsconfig.lib.json',
            hash: 'dbe90e0855d2ef980595dcc17f577088662cfb4d',
            ext: '.json',
          },
          {
            file: 'packages/next/tsconfig.spec.json',
            hash: 'd6ae6669d75fc5beb184f28966262e1762b9623c',
            ext: '.json',
          },
        ],
      },
    },
    nest: {
      name: 'nest',
      type: 'lib',
      data: {
        root: 'packages/nest',
        sourceRoot: 'packages/nest',
        projectType: 'library',
        schematics: {},
        architect: {
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/nest/jest.config.js',
              passWithNoTests: true,
            },
          },
          'build-base': {
            builder: '@nrwl/node:package',
            options: {
              outputPath: 'build/packages/nest',
              tsConfig: 'packages/nest/tsconfig.lib.json',
              packageJson: 'packages/nest/package.json',
              main: 'packages/nest/index.ts',
              updateBuildableProjectDepsInPackageJson: false,
              assets: [
                {
                  input: 'packages/nest',
                  glob: '**/files/**',
                  output: '/',
                },
                {
                  input: 'packages/nest',
                  glob: '**/files/**/.gitkeep',
                  output: '/',
                },
                {
                  input: 'packages/nest',
                  glob: '**/*.json',
                  output: '/',
                },
                {
                  input: 'packages/nest',
                  glob: '**/*.js',
                  output: '/',
                },
                'LICENSE',
              ],
            },
          },
          build: {
            builder: '@nrwl/workspace:run-commands',
            outputs: ['build/packages/nest'],
            options: {
              commands: [
                {
                  command: 'nx build-base nest',
                },
                {
                  command: 'node ./scripts/copy-readme.js nest',
                },
              ],
              parallel: false,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/nest/.eslintrc',
            hash: '9afd5d63f09f7d350b479cea3984ab4d8920d964',
            ext: '',
          },
          {
            file: 'packages/nest/builders.json',
            hash: 'aa97ded151a5cc5b29308544331dc4e36ae33204',
            ext: '.json',
          },
          {
            file: 'packages/nest/collection.json',
            hash: '0941765cd23c2422bb8d75c1b55891512fd4a2e9',
            ext: '.json',
          },
          {
            file: 'packages/nest/index.ts',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.ts',
          },
          {
            file: 'packages/nest/jest.config.js',
            hash: 'fad76748f179891dd88988c03dd7c14926273eb6',
            ext: '.js',
          },
          {
            file: 'packages/nest/migrations.json',
            hash: '26bb42797aff13e526b52a62d110fda2ace09122',
            ext: '.json',
          },
          {
            file: 'packages/nest/package.json',
            hash: '91c21a38e8a2a6f7b25810e03a39c76242ccb32b',
            ext: '.json',
          },
          {
            file: 'packages/nest/README.md',
            hash: '54900f1e6f239c9bef2fc2470058da15f78fba4d',
            ext: '.md',
          },
          {
            file: 'packages/nest/src/migrations/update-10-0-0/update-10-0-0.ts',
            hash: 'bc23104f2ae060b3e5b4f21c3c12b544f043de30',
            ext: '.ts',
          },
          {
            file: 'packages/nest/src/migrations/update-8-7-0/update-8-7-0.ts',
            hash: '2238636f91a66f9e236d13e73a0fb9c6a607d0f7',
            ext: '.ts',
          },
          {
            file:
              'packages/nest/src/schematics/application/application.spec.ts',
            hash: '0f7d9d223a4a0100bf4ab710e1947520d958705e',
            ext: '.ts',
          },
          {
            file: 'packages/nest/src/schematics/application/application.ts',
            hash: 'cdd6cd91b5cabb7dea7cde32b2fb7accab1e8222',
            ext: '.ts',
          },
          {
            file:
              'packages/nest/src/schematics/application/files/app/app.controller.spec.ts__tmpl__',
            hash: 'a99a57355c9312018484b2e60f07a1d05515c66c',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/nest/src/schematics/application/files/app/app.controller.ts__tmpl__',
            hash: 'dff210a841eb3893066314660135eb0c534f041d',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/nest/src/schematics/application/files/app/app.module.ts__tmpl__',
            hash: '6a9bc166d35090df009e0fa74bf4a9a9d740028a',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/nest/src/schematics/application/files/app/app.service.spec.ts__tmpl__',
            hash: 'c35c26984b7f959d7bf34636196a018dbebfda5a',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/nest/src/schematics/application/files/app/app.service.ts__tmpl__',
            hash: '1f5dc013bc8937d8ea2721620dfcd57e057f4448',
            ext: '.ts__tmpl__',
          },
          {
            file: 'packages/nest/src/schematics/application/schema.d.ts',
            hash: 'a2fcb16756b029b85f14b0f35c108c76410e1916',
            ext: '.ts',
          },
          {
            file: 'packages/nest/src/schematics/application/schema.json',
            hash: '32611d1103ea8d5fc28246abfa171fcf28f44d5d',
            ext: '.json',
          },
          {
            file: 'packages/nest/src/schematics/init/init.spec.ts',
            hash: 'e337ebeb775e4a7e77c41ae4ca63678ca0ddc412',
            ext: '.ts',
          },
          {
            file: 'packages/nest/src/schematics/init/init.ts',
            hash: '7d7e60e419528954afdd7749890452adfda44aa5',
            ext: '.ts',
          },
          {
            file: 'packages/nest/src/schematics/init/schema.d.ts',
            hash: '52ac13000a18d701532ccd65ffecfe545ff28d55',
            ext: '.ts',
          },
          {
            file: 'packages/nest/src/schematics/init/schema.json',
            hash: 'd169f1999c4fd852a0c2665b8f0ee9bb8393c1ed',
            ext: '.json',
          },
          {
            file:
              'packages/nest/src/schematics/library/files/lib/src/lib/__fileName__.controller.spec.ts__tmpl__',
            hash: '30c3ea0da6c7c58e429c6e59bb8bfcf473921883',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/nest/src/schematics/library/files/lib/src/lib/__fileName__.controller.ts__tmpl__',
            hash: 'e1b7c5d257a09816cc3530af8c0de785de029de3',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/nest/src/schematics/library/files/lib/src/lib/__fileName__.module.ts__tmpl__',
            hash: '001980c7cd9fbafa7800f4521bb9df87c065a08d',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/nest/src/schematics/library/files/lib/src/lib/__fileName__.service.spec.ts__tmpl__',
            hash: '79a67fb503425cf4cb384827b37593e9f84bf6bf',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/nest/src/schematics/library/files/lib/src/lib/__fileName__.service.ts__tmpl__',
            hash: 'cfb9f4ab5fe1a3ee7e47b1296cc59b32f2bf2b9c',
            ext: '.ts__tmpl__',
          },
          {
            file: 'packages/nest/src/schematics/library/library.spec.ts',
            hash: 'f027ce99e0625904b033f2fd84404478c093ec2d',
            ext: '.ts',
          },
          {
            file: 'packages/nest/src/schematics/library/library.ts',
            hash: '74d099205fa05cfec1344da2c604c8d6cf61c02f',
            ext: '.ts',
          },
          {
            file: 'packages/nest/src/schematics/library/schema.d.ts',
            hash: 'b88b9be05997876d6ae8773a423c52ffcea1f035',
            ext: '.ts',
          },
          {
            file: 'packages/nest/src/schematics/library/schema.json',
            hash: '8eff387fb1bcb6e6a38092ac39777f96b6ca6a57',
            ext: '.json',
          },
          {
            file:
              'packages/nest/src/schematics/nestjs-schematics/nestjs-schematics.spec.ts',
            hash: '9f1a2aed69b5f7748e64f19e7001047bde72d15f',
            ext: '.ts',
          },
          {
            file:
              'packages/nest/src/schematics/nestjs-schematics/nestjs-schematics.ts',
            hash: 'd9243b0af5dcec6a8a52d42794c9e45e14ded7f3',
            ext: '.ts',
          },
          {
            file: 'packages/nest/src/schematics/nestjs-schematics/schema.d.ts',
            hash: 'ff762ea62d9f6061295a32c8d2148030c2b56d76',
            ext: '.ts',
          },
          {
            file: 'packages/nest/src/schematics/nestjs-schematics/schema.json',
            hash: 'b806a48857daa3d3abb45c28ed87d0ed5e862361',
            ext: '.json',
          },
          {
            file: 'packages/nest/src/utils/testing.ts',
            hash: '180712d392b195c281cdd45aeb6c1be162d80d86',
            ext: '.ts',
          },
          {
            file: 'packages/nest/src/utils/versions.ts',
            hash: '903209ba6dbba1dc3aa6973dfe0ee50beeaeca61',
            ext: '.ts',
          },
          {
            file: 'packages/nest/tsconfig.json',
            hash: '58bd2c97a66f5e5ea5d05c8a5709ee79bad02094',
            ext: '.json',
          },
          {
            file: 'packages/nest/tsconfig.lib.json',
            hash: 'dbe90e0855d2ef980595dcc17f577088662cfb4d',
            ext: '.json',
          },
          {
            file: 'packages/nest/tsconfig.spec.json',
            hash: 'd6ae6669d75fc5beb184f28966262e1762b9623c',
            ext: '.json',
          },
        ],
      },
    },
    'e2e-storybook': {
      name: 'e2e-storybook',
      type: 'app',
      data: {
        root: 'e2e/storybook',
        sourceRoot: 'e2e/storybook',
        projectType: 'application',
        schematics: {},
        architect: {
          e2e: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'e2e/storybook/jest.config.js',
              passWithNoTests: true,
              runInBand: true,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'e2e/storybook/jest.config.js',
            hash: '1cae026824572989f7917949ba8cca2705ce8b1a',
            ext: '.js',
          },
          {
            file: 'e2e/storybook/src/storybook.test.ts',
            hash: 'd116ef6665e4e49ae9be649e2c3d2c868566cb25',
            ext: '.ts',
          },
          {
            file: 'e2e/storybook/tsconfig.json',
            hash: '6d5abf84832009a8c70e7a910c49f332bf1f0612',
            ext: '.json',
          },
          {
            file: 'e2e/storybook/tsconfig.spec.json',
            hash: 'af4ac638d670981da49963e84160a6a6c4439f81',
            ext: '.json',
          },
        ],
      },
    },
    'e2e-workspace': {
      name: 'e2e-workspace',
      type: 'app',
      data: {
        root: 'e2e/workspace',
        sourceRoot: 'e2e/workspace',
        projectType: 'application',
        schematics: {},
        architect: {
          e2e: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'e2e/workspace/jest.config.js',
              passWithNoTests: true,
              runInBand: true,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'e2e/workspace/jest.config.js',
            hash: '1a412dcb9ea89d71001eb499f3d6dac4086c6379',
            ext: '.js',
          },
          {
            file: 'e2e/workspace/src/create-nx-workspace.test.ts',
            hash: '239c6c11b5eeba9ec845e497b3320315b8bde463',
            ext: '.ts',
          },
          {
            file: 'e2e/workspace/src/custom-layout.test.ts',
            hash: '17abcdf8302042943941db21389ceb22fccaea85',
            ext: '.ts',
          },
          {
            file: 'e2e/workspace/src/run-commands.test.ts',
            hash: 'b76eb54b75a47a9fca34dff61cb2cacf3e943bc9',
            ext: '.ts',
          },
          {
            file: 'e2e/workspace/src/workspace-aux-commands.test.ts',
            hash: '307d3203dc84c0a26d90c7394ee9565f504ec691',
            ext: '.ts',
          },
          {
            file: 'e2e/workspace/src/workspace.test.ts',
            hash: '6a27eea2b200812a904c8281924e2204c8e5210d',
            ext: '.ts',
          },
          {
            file: 'e2e/workspace/tsconfig.json',
            hash: '6d5abf84832009a8c70e7a910c49f332bf1f0612',
            ext: '.json',
          },
          {
            file: 'e2e/workspace/tsconfig.spec.json',
            hash: 'af4ac638d670981da49963e84160a6a6c4439f81',
            ext: '.json',
          },
        ],
      },
    },
    'e2e-nx-plugin': {
      name: 'e2e-nx-plugin',
      type: 'app',
      data: {
        root: 'e2e/nx-plugin',
        sourceRoot: 'e2e/nx-plugin',
        projectType: 'application',
        schematics: {},
        architect: {
          e2e: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'e2e/nx-plugin/jest.config.js',
              passWithNoTests: true,
              runInBand: true,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'e2e/nx-plugin/jest.config.js',
            hash: 'c08d112b09f9704a44e316c861f6d27c67889c7a',
            ext: '.js',
          },
          {
            file: 'e2e/nx-plugin/src/nx-plugin.test.ts',
            hash: 'beaad0bf6d638a09dcb80379fcd32ef96006a27d',
            ext: '.ts',
          },
          {
            file: 'e2e/nx-plugin/tsconfig.json',
            hash: '6d5abf84832009a8c70e7a910c49f332bf1f0612',
            ext: '.json',
          },
          {
            file: 'e2e/nx-plugin/tsconfig.spec.json',
            hash: 'af4ac638d670981da49963e84160a6a6c4439f81',
            ext: '.json',
          },
        ],
      },
    },
    tao: {
      name: 'tao',
      type: 'lib',
      data: {
        root: 'packages/tao',
        sourceRoot: 'packages/tao',
        projectType: 'library',
        schematics: {},
        architect: {
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/tao/jest.config.js',
              passWithNoTests: true,
            },
          },
          'build-base': {
            builder: '@nrwl/node:package',
            options: {
              outputPath: 'build/packages/tao',
              tsConfig: 'packages/tao/tsconfig.lib.json',
              packageJson: 'packages/tao/package.json',
              main: 'packages/tao/index.ts',
              updateBuildableProjectDepsInPackageJson: false,
              assets: [
                {
                  input: 'packages/tao',
                  glob: '**/files/**',
                  output: '/',
                },
                {
                  input: 'packages/tao',
                  glob: '**/files/**/.gitkeep',
                  output: '/',
                },
                {
                  input: 'packages/tao',
                  glob: '**/*.json',
                  output: '/',
                },
                {
                  input: 'packages/tao',
                  glob: '**/*.js',
                  output: '/',
                },
                'LICENSE',
              ],
            },
          },
          build: {
            builder: '@nrwl/workspace:run-commands',
            outputs: ['build/packages/tao'],
            options: {
              commands: [
                {
                  command: 'nx build-base tao',
                },
                {
                  command: 'chmod +x build/packages/tao/index.js',
                },
                {
                  command: 'node ./scripts/copy-readme.js tao',
                },
              ],
              parallel: false,
            },
          },
          lint: {
            builder: '@nrwl/linter:lint',
            options: {
              linter: 'eslint',
              config: 'packages/tao/.eslintrc',
              tsConfig: [
                'packages/tao/tsconfig.lib.json',
                'packages/tao/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**'],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/tao/.eslintrc',
            hash: '9afd5d63f09f7d350b479cea3984ab4d8920d964',
            ext: '',
          },
          {
            file: 'packages/tao/index.ts',
            hash: '18eaae19964fdf8ced139cc07834cb6067a15af5',
            ext: '.ts',
          },
          {
            file: 'packages/tao/jest.config.js',
            hash: '77b56eff8b9921834a93a7a85ee1e5135c21015f',
            ext: '.js',
          },
          {
            file: 'packages/tao/package.json',
            hash: '94867835cae012b47c5d6075bbdb2821e1e1c188',
            ext: '.json',
          },
          {
            file: 'packages/tao/README.md',
            hash: '6e02756f83eb356f96cec00c69edf006487501fa',
            ext: '.md',
          },
          {
            file: 'packages/tao/src/commands/generate.ts',
            hash: '0880343eb596e774853b542c853d0eeb0170dff8',
            ext: '.ts',
          },
          {
            file: 'packages/tao/src/commands/help.ts',
            hash: '8c3b358655358099f2d7cf0199def15d7aa8ebcc',
            ext: '.ts',
          },
          {
            file: 'packages/tao/src/commands/migrate.spec.ts',
            hash: 'f78c963c74e0dbed9f066ea7cd36f3c653b8894c',
            ext: '.ts',
          },
          {
            file: 'packages/tao/src/commands/migrate.ts',
            hash: '4afbf7b8a205e6c741182c090fd26f412c3c0727',
            ext: '.ts',
          },
          {
            file: 'packages/tao/src/commands/run.ts',
            hash: '869977a74d5b630893b86d412d00b82880ed7aac',
            ext: '.ts',
          },
          {
            file: 'packages/tao/src/compat/compat.ts',
            hash: 'c61d5478b8df5a22d6f7cb0bd293fc8c6145b8f4',
            ext: '.ts',
          },
          {
            file: 'packages/tao/src/shared/detect-package-manager.ts',
            hash: 'f2dfaa82302617d89636e7ea41130de250e18258',
            ext: '.ts',
          },
          {
            file: 'packages/tao/src/shared/logger.ts',
            hash: 'c34131e08cacd94becaaedb78b145b6fd577e74e',
            ext: '.ts',
          },
          {
            file: 'packages/tao/src/shared/params.spec.ts',
            hash: '39092221fe1095853d8f7794d7bf771aa2438ad2',
            ext: '.ts',
          },
          {
            file: 'packages/tao/src/shared/params.ts',
            hash: '1bd212633c16f9a16a5b282bae694ed3588388cc',
            ext: '.ts',
          },
          {
            file: 'packages/tao/src/shared/print-help.ts',
            hash: '5a5c7f9c658a6d585d3bb509675dd6478f5e78c3',
            ext: '.ts',
          },
          {
            file: 'packages/tao/tsconfig.json',
            hash: '58bd2c97a66f5e5ea5d05c8a5709ee79bad02094',
            ext: '.json',
          },
          {
            file: 'packages/tao/tsconfig.lib.json',
            hash: '037d796f286235dce67c9e648d2d42adcc61ccd7',
            ext: '.json',
          },
          {
            file: 'packages/tao/tsconfig.spec.json',
            hash: '559410b96af6781ac3e7cf348bf4a710b4009481',
            ext: '.json',
          },
        ],
      },
    },
    web: {
      name: 'web',
      type: 'lib',
      data: {
        root: 'packages/web',
        sourceRoot: 'packages/web',
        projectType: 'library',
        schematics: {},
        architect: {
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/web/jest.config.js',
              passWithNoTests: true,
            },
          },
          'build-base': {
            builder: '@nrwl/node:package',
            options: {
              outputPath: 'build/packages/web',
              tsConfig: 'packages/web/tsconfig.lib.json',
              packageJson: 'packages/web/package.json',
              main: 'packages/web/index.ts',
              updateBuildableProjectDepsInPackageJson: false,
              assets: [
                {
                  input: 'packages/web',
                  glob: '**/files/**',
                  output: '/',
                },
                {
                  input: 'packages/web',
                  glob: '**/files/**/.gitkeep',
                  output: '/',
                },
                {
                  input: 'packages/web',
                  glob: '**/files/**/.babelrc__tmpl__',
                  output: '/',
                },
                {
                  input: 'packages/web',
                  glob: '**/*.json',
                  output: '/',
                },
                {
                  input: 'packages/web',
                  glob: '**/*.js',
                  output: '/',
                },
                'LICENSE',
              ],
            },
          },
          build: {
            builder: '@nrwl/workspace:run-commands',
            outputs: ['build/packages/web'],
            options: {
              commands: [
                {
                  command: 'nx build-base web',
                },
                {
                  command: 'node ./scripts/copy-readme.js web',
                },
              ],
              parallel: false,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/web/.eslintrc',
            hash: '9afd5d63f09f7d350b479cea3984ab4d8920d964',
            ext: '',
          },
          {
            file: 'packages/web/babel.ts',
            hash: '5674c8b54935cd1bd6a09ac8b8b864211c26132e',
            ext: '.ts',
          },
          {
            file: 'packages/web/builders.json',
            hash: '2ca1cfe0d9f51f73fd36aed61f803b5141a40fef',
            ext: '.json',
          },
          {
            file: 'packages/web/collection.json',
            hash: '1b188871f2dee2d1af65d02192b422c56f454d52',
            ext: '.json',
          },
          {
            file: 'packages/web/index.ts',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.ts',
          },
          {
            file: 'packages/web/jest.config.js',
            hash: 'd2e6f4fbbfc1015c89b247c9a610dba5ba7ce4cd',
            ext: '.js',
          },
          {
            file: 'packages/web/migrations.json',
            hash: '7b672650ca6bb7b82e67e83e5ef0f4a13be6d037',
            ext: '.json',
          },
          {
            file: 'packages/web/package.json',
            hash: '29afad844600b11cb881e0c93ed0324c5ad77af6',
            ext: '.json',
          },
          {
            file: 'packages/web/README.md',
            hash: 'd0fcc09be673c98b2b9f28c4ca23fa7a8c2ce666',
            ext: '.md',
          },
          {
            file: 'packages/web/src/builders/build/build.impl.ts',
            hash: '2f9483ff62a8929545db4c5ee4f6160f94029ecd',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/builders/build/schema.json',
            hash: '9ea3285ccaa16f8ecd8b43c3edeb2cae3c25bb34',
            ext: '.json',
          },
          {
            file:
              'packages/web/src/builders/dev-server/dev-server.impl.spec.ts',
            hash: '8e48fb0ed74151ef3c8da1eba5a006ad7a481b45',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/builders/dev-server/dev-server.impl.ts',
            hash: '0aecda1ffecd01182c4115cd6b2eda2ad5c05974',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/builders/dev-server/schema.json',
            hash: '480f345fa6e6edf114eb1e4760d2b011d6c0bad1',
            ext: '.json',
          },
          {
            file: 'packages/web/src/builders/package/package.impl.spec.ts',
            hash: '0fc5065a78749dfba473c501f7f3184bab4f0752',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/builders/package/package.impl.ts',
            hash: 'd5c6829b4702be75f01f7eba8b456fd513d7dde5',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/builders/package/run-rollup.ts',
            hash: '774cd0780bc08cade9d726d53e1a49005cf55189',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/builders/package/schema.json',
            hash: '066ed1a6f8e1bf836d29db90974eeb71cf470f5a',
            ext: '.json',
          },
          {
            file:
              'packages/web/src/migrations/update-8-5-0/update-builder-8-5-0.spec.ts',
            hash: 'dbcc41f3ef9d45fba31e038570c41e9f5a1d3830',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/migrations/update-8-5-0/update-builder-8-5-0.ts',
            hash: '8609283d12a9710edb8c8bae1dcf8d7bcd9e569d',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/migrations/update-9-0-0/update-builder-9-0-0.ts',
            hash: '8a27386fe3f7467dd3632e5c166712448fc9ecfe',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/migrations/update-9-2-0/set-build-libs-from-source.spec.ts',
            hash: '8f1325d524d0c18b224bc5765fd2b1be2b7dd7ce',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/migrations/update-9-2-0/set-build-libs-from-source.ts',
            hash: 'f4008621e563594b660b94134e89cd0c82386011',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/schematics/application/application.spec.ts',
            hash: '57cf899e8547dce5ee54cf449fd7c076a9367c65',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/schematics/application/application.ts',
            hash: 'bbbaa0d79b0d4a58780d6d7971425faed4b05d80',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/schematics/application/files/app/.babelrc__tmpl__',
            hash: '0967ef424bce6791893e9a57bb952f80fd536e93',
            ext: '',
          },
          {
            file:
              'packages/web/src/schematics/application/files/app/browserslist',
            hash: '8d6179367e7ba6b8cd0fa04b900d6ab4142ab08b',
            ext: '',
          },
          {
            file:
              'packages/web/src/schematics/application/files/app/src/app/app.element.__style__',
            hash: '3b63d4dbd7f58fc89f59dca91ef8fbd35405d3cc',
            ext: '.__style__',
          },
          {
            file:
              'packages/web/src/schematics/application/files/app/src/app/app.element.spec.ts__tmpl__',
            hash: '09b331189af0bbe4e08f4dbbc78643ba1b343e6c',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/web/src/schematics/application/files/app/src/app/app.element.ts__tmpl__',
            hash: '3a72436438e46cae5dc25949b946d47a20b781ff',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/web/src/schematics/application/files/app/src/assets/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file:
              'packages/web/src/schematics/application/files/app/src/environments/environment.prod.ts__tmpl__',
            hash: '3612073bc31cd4c1f5d6cbb00318521e9a61bd8a',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/web/src/schematics/application/files/app/src/environments/environment.ts__tmpl__',
            hash: 'd9370e924b51bc67ecddee7fc3b6693681a324b6',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/web/src/schematics/application/files/app/src/favicon.ico',
            hash: '317ebcb2336e0833a22dddf0ab287849f26fda57',
            ext: '.ico',
          },
          {
            file:
              'packages/web/src/schematics/application/files/app/src/index.html',
            hash: '42ece406e8b8a1c34635b9ad6f424411f6bbeb06',
            ext: '.html',
          },
          {
            file:
              'packages/web/src/schematics/application/files/app/src/main.ts__tmpl__',
            hash: '12f7aaebe90c53c21c5efc6ad3b571d86f6ff932',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/web/src/schematics/application/files/app/src/polyfills.ts__tmpl__',
            hash: '2adf3d05b6fcf479dd61c74f6bda95d9edb6ac6b',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/web/src/schematics/application/files/app/src/styles.__style__',
            hash: '90d4ee0072ce3fc41812f8af910219f9eea3c3de',
            ext: '.__style__',
          },
          {
            file:
              'packages/web/src/schematics/application/files/app/tsconfig.app.json',
            hash: 'ee0f68db8873be761b4ded20baf3a38286b8bc4e',
            ext: '.json',
          },
          {
            file:
              'packages/web/src/schematics/application/files/app/tsconfig.json',
            hash: '795ebf01cbe3c6c661881db9a5b3aec95a69fe9b',
            ext: '.json',
          },
          {
            file: 'packages/web/src/schematics/application/schema.d.ts',
            hash: 'a8471460e68483b702c658d728801300f9d731e5',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/schematics/application/schema.json',
            hash: '3a26df944b8698a848e3ce31b132dc0940dce329',
            ext: '.json',
          },
          {
            file: 'packages/web/src/schematics/init/init.spec.ts',
            hash: 'c5145b371deaf558d4c0b74ccd31652aa826f63c',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/schematics/init/init.ts',
            hash: 'be5dbaa2f9d2ebf0825b2ffc55d22dd9dffe8eba',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/schematics/init/schema.d.ts',
            hash: '9f7995c018ef15ad32bf98effcb63686ac04cc85',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/schematics/init/schema.json',
            hash: '5dd1c7fc3a77b049a905dfc220ea8cef2b028f0e',
            ext: '.json',
          },
          {
            file: 'packages/web/src/utils/config.spec.ts',
            hash: '2e11ec3a3dd724b9679b54585bbc71a5a4531222',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/config.ts',
            hash: '8965e2797f038de19a494a0438eb2070e2024eee',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/delete-output-dir.ts',
            hash: 'a7d21e9621449f8f6731a2d8e7ad4e996697fac4',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/devserver.config.spec.ts',
            hash: '68c926ac8ac1500e5a7257f116a3eda1d2ef328e',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/devserver.config.ts',
            hash: 'f783854e90fb87833580b071dd2cead36db84f08',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/hash-format.ts',
            hash: 'a85e2cf1a3c843121edb0c769a83139155b3e5d8',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/normalize.spec.ts',
            hash: '4b947ab18daa54c49c43309e6c4069efa0dbb2be',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/normalize.ts',
            hash: 'f9866141a6df2ff8bdfd68ef129ff2e9e10ff17b',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/rules.ts',
            hash: '2fbf009568e8cf09775ed1e9d3b0c4bddd89e3e4',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/serve-path.ts',
            hash: 'a97502f5c0d5c9556ce6da99f89162e172a40104',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/source-root.ts',
            hash: 'ecb390e107e5f1fe55c5479e94decf7eee9b62b7',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/testing.ts',
            hash: '773b2792f30af6d76454cd0c375107f5eb05509c',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/third-party/browser/schema.ts',
            hash: '5293372b26fa04b1288b5cd26015d28dda82cd40',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/models/build-options.ts',
            hash: '4ee1706c1d98a75bfb4da14505feae9fa4379371',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/models/safari-nomodule.js',
            hash: '3ed244256f3a9c3507da1c0fa22ecdf627242e75',
            ext: '.js',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/models/webpack-configs/browser.ts',
            hash: '87a90ae99df23c87481febd338c16d5ce7937e70',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/models/webpack-configs/common.ts',
            hash: '6bb9541e5c23f733700513c93e2973d9c6100e2c',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/models/webpack-configs/styles.ts',
            hash: 'f0288cf4807fd69612b65a882c73b8f4bb05be85',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/models/webpack-configs/utils.ts',
            hash: '3b8a3516ac7eb7aacc7714c7127074e27d875a57',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/plugins/bundle-budget.ts',
            hash: 'f4a5e12d859f9b4d5405a9bf9a9cbdc813991784',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/plugins/cleancss-webpack-plugin.ts',
            hash: '14d2aa0d6e4e35012d99168e89ceda35c24abb7d',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/plugins/index-html-webpack-plugin.ts',
            hash: 'aa17874e2b0269be1effaf886e8b7b4cd96e7ff2',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/plugins/named-chunks-plugin.ts',
            hash: '1865492e27362145f69525aa8f0c636ca28097d0',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/plugins/postcss-cli-resources.ts',
            hash: '95bee6d022720fd4cfde327d3382c318196863cf',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/plugins/raw-css-loader.ts',
            hash: '851bff70691265f56643778baeea946a963a7be0',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/plugins/remove-hash-plugin.ts',
            hash: '20887aabe1db5f1183b4b203fa43e2effbe16979',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/plugins/scripts-webpack-plugin.ts',
            hash: '299820100207d2aa15ae08348c161ebbb3f361f6',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/plugins/suppress-entry-chunks-webpack-plugin.ts',
            hash: 'f1cf2b1686d73942c6398ff677c0f1f5a9b1d163',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/plugins/webpack.ts',
            hash: '09866a02d40ad28134ce3339a73a509e46a0388c',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/utilities/bundle-calculator_spec.ts',
            hash: '0f21ba97e138e01f1455c29b4311415c265aaadf',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/utilities/bundle-calculator.ts',
            hash: 'dee76288f465d1ef22fa557345caea5e962906bf',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/utilities/find-up.ts',
            hash: 'e207f632c8b06b20233132354399b7a70b8cdbaf',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/utilities/index-file/augment-index-html_spec.ts',
            hash: 'c8ba726b7c62bea21fb7780d0d494d5e781f596b',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/utilities/index-file/augment-index-html.ts',
            hash: '3ee4cb42479d2b9999fff6f4b22294c0a70f9dba',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/utilities/index-file/write-index-html.ts',
            hash: '671f5334fa039ac72721ccaecd2d70cb7a6bbce2',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/utilities/is-directory.ts',
            hash: 'f4636a272531fe65a844071d61ac0ebeda714aff',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/utilities/package-chunk-sort.ts',
            hash: 'dde94dbc6567d5e1d9b7be1a33d9dd03ab0fcd85',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/utilities/stats.ts',
            hash: '67737265a45060ea9f279a2a99156fc48e334146',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/utilities/strip-bom.ts',
            hash: 'f4aba38228b32f2a0bc8c9e202255d8ae8116d74',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/third-party/transforms.ts',
            hash: 'c724aedab6464127a769e849f3a7363c799db910',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/utils/build-browser-features_spec.ts',
            hash: '21dc0724eb1ec02716820c58db7c91261af88704',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/utils/build-browser-features.ts',
            hash: 'a51271b5c53c2a760854640f3693dc87fd7b07c9',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/utils/default-progress.ts',
            hash: '258412b460f18c907ffd64f9d9f8f21b01f153bf',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/utils/delete-output-dir.ts',
            hash: 'bbdc2b9a19d0179e6b838215b5a16f9aab2d0b5a',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/third-party/utils/index.ts',
            hash: '8cd7670f0a9bb4a2c8bf6697556c2ccd86ed9e7e',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/third-party/utils/mangle-options.ts',
            hash: '60085e43c8e797202d1593e6115e6bebeeb433c8',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/utils/normalize-asset-patterns.ts',
            hash: 'b7c9e62f2a0ea2110006c3ee4f153e63b1e23055',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/utils/normalize-builder-schema.ts',
            hash: '6027285b9beb557656845ab3d3afe161d87db95e',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/utils/normalize-file-replacements.ts',
            hash: 'adf0a2da1e161bce5d86c281d16b27260a93a6cd',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/utils/normalize-optimization.ts',
            hash: '743181e5222e756c5b27a595960a256d5c3a4050',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/utils/normalize-source-maps.ts',
            hash: 'fcd0bb342ea0fa876f4a5096ec951cddfa8086d5',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/utils/run-module-as-observable-fork.ts',
            hash: 'd3c15ecd2694d9a9621280c9a9a9aca8c16a3599',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/types.ts',
            hash: '7d6907199d9fe71ea5b27a63b00a1cf8f02273d2',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/versions.ts',
            hash: '66f7d33476d2bf3df79468b2f5a0afcde02c60e7',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/web-babel-loader.ts',
            hash: '06d627667eaeba1bc818b2677a184a10e7c12e21',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/web.config.spec.ts',
            hash: 'ca48036c8c6d248fdc258a9ff7b56c71da8cb687',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/web.config.ts',
            hash: 'ea70ec71b24ad67973a63301f4366d58c49b4d52',
            ext: '.ts',
          },
          {
            file: 'packages/web/tsconfig.json',
            hash: '58bd2c97a66f5e5ea5d05c8a5709ee79bad02094',
            ext: '.json',
          },
          {
            file: 'packages/web/tsconfig.lib.json',
            hash: 'dbe90e0855d2ef980595dcc17f577088662cfb4d',
            ext: '.json',
          },
          {
            file: 'packages/web/tsconfig.spec.json',
            hash: 'd6ae6669d75fc5beb184f28966262e1762b9623c',
            ext: '.json',
          },
        ],
      },
    },
    cli: {
      name: 'cli',
      type: 'lib',
      data: {
        root: 'packages/cli',
        sourceRoot: 'packages/cli',
        projectType: 'library',
        schematics: {},
        architect: {
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/cli/jest.config.js',
              passWithNoTests: true,
            },
          },
          'build-base': {
            builder: '@nrwl/node:package',
            options: {
              outputPath: 'build/packages/cli',
              tsConfig: 'packages/cli/tsconfig.lib.json',
              packageJson: 'packages/cli/package.json',
              main: 'packages/cli/index.ts',
              updateBuildableProjectDepsInPackageJson: false,
              assets: [
                {
                  input: 'packages/cli',
                  glob: '**/files/**',
                  output: '/',
                },
                {
                  input: 'packages/cli',
                  glob: '**/files/**/.gitkeep',
                  output: '/',
                },
                {
                  input: 'packages/cli',
                  glob: '**/*.json',
                  output: '/',
                },
                {
                  input: 'packages/cli',
                  glob: '**/*.js',
                  output: '/',
                },
                'LICENSE',
              ],
            },
          },
          build: {
            builder: '@nrwl/workspace:run-commands',
            outputs: ['build/packages/cli'],
            options: {
              commands: [
                {
                  command: 'nx build-base cli',
                },
                {
                  command: 'chmod +x build/packages/cli/bin/nx.js',
                },
                {
                  command: 'node ./scripts/copy-readme.js cli',
                },
              ],
              parallel: false,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/cli/.eslintrc',
            hash: '9afd5d63f09f7d350b479cea3984ab4d8920d964',
            ext: '',
          },
          {
            file: 'packages/cli/bin/nx.ts',
            hash: 'b20201e33a2c7ad5c6e5e18b0151b65e22c020c6',
            ext: '.ts',
          },
          {
            file: 'packages/cli/jest.config.js',
            hash: '5d0990534a8a7b5937a0211364352bda1a75ad3e',
            ext: '.js',
          },
          {
            file: 'packages/cli/lib/find-workspace-root.ts',
            hash: 'cc104ce8a32dee5ca82600eca1e68acd0d12d94b',
            ext: '.ts',
          },
          {
            file: 'packages/cli/lib/init-global.ts',
            hash: 'a2c74a6e5ea9179e8386092444da0884af763289',
            ext: '.ts',
          },
          {
            file: 'packages/cli/lib/init-local.ts',
            hash: 'fac8d9485459f5d87253ebe183712eb2b02e4a91',
            ext: '.ts',
          },
          {
            file: 'packages/cli/lib/output.ts',
            hash: '1f894756eaac752ec336f84f5abcf9edbe963d26',
            ext: '.ts',
          },
          {
            file: 'packages/cli/lib/parse-run-one-options.spec.ts',
            hash: '0a483cc9a4ea28889126110d9428705c6fe8ec0f',
            ext: '.ts',
          },
          {
            file: 'packages/cli/lib/parse-run-one-options.ts',
            hash: 'a24433ecb6da252a8e656f9788a86536329b2182',
            ext: '.ts',
          },
          {
            file: 'packages/cli/lib/run-cli.ts',
            hash: 'd98ccc1ed9e81da447d0c0bb799c3b303a2a1438',
            ext: '.ts',
          },
          {
            file: 'packages/cli/lib/workspace.ts',
            hash: 'a5f21d8fe9b645d08aba3266b31864eeb885343c',
            ext: '.ts',
          },
          {
            file: 'packages/cli/package.json',
            hash: '70ed52ef24f5995bc3d5c23deaf584de1708024f',
            ext: '.json',
          },
          {
            file: 'packages/cli/README.md',
            hash: '2291f29cde4a97337b230ae28ac6743675080278',
            ext: '.md',
          },
          {
            file: 'packages/cli/tsconfig.json',
            hash: '58bd2c97a66f5e5ea5d05c8a5709ee79bad02094',
            ext: '.json',
          },
          {
            file: 'packages/cli/tsconfig.lib.json',
            hash: 'dbe90e0855d2ef980595dcc17f577088662cfb4d',
            ext: '.json',
          },
          {
            file: 'packages/cli/tsconfig.spec.json',
            hash: 'd6ae6669d75fc5beb184f28966262e1762b9623c',
            ext: '.json',
          },
        ],
      },
    },
    nx: {
      name: 'nx',
      type: 'lib',
      data: {
        root: 'packages/nx',
        sourceRoot: 'packages/nx',
        projectType: 'library',
        schematics: {},
        architect: {
          'build-base': {
            builder: '@nrwl/node:package',
            options: {
              outputPath: 'build/packages/nx',
              tsConfig: 'packages/nx/tsconfig.lib.json',
              packageJson: 'packages/nx/package.json',
              main: 'packages/nx/index.ts',
              updateBuildableProjectDepsInPackageJson: false,
              assets: [
                {
                  input: 'packages/nx',
                  glob: '**/files/**',
                  output: '/',
                },
                {
                  input: 'packages/nx',
                  glob: '**/files/**/.gitkeep',
                  output: '/',
                },
                {
                  input: 'packages/nx',
                  glob: '**/*.json',
                  output: '/',
                },
                {
                  input: 'packages/nx',
                  glob: '**/*.js',
                  output: '/',
                },
                'LICENSE',
              ],
            },
          },
          build: {
            builder: '@nrwl/workspace:run-commands',
            outputs: ['build/packages/nx'],
            options: {
              commands: [
                {
                  command: 'nx build-base nx',
                },
                {
                  command: 'node ./scripts/copy-readme.js nx',
                },
              ],
              parallel: false,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/nx/.eslintrc',
            hash: '9afd5d63f09f7d350b479cea3984ab4d8920d964',
            ext: '',
          },
          {
            file: 'packages/nx/bin/nx.ts',
            hash: '31869bd706e4b900515577914326d55678306794',
            ext: '.ts',
          },
          {
            file: 'packages/nx/jest.config.js',
            hash: '5d0990534a8a7b5937a0211364352bda1a75ad3e',
            ext: '.js',
          },
          {
            file: 'packages/nx/package.json',
            hash: '1bb0988e1ecbd43fc7d070918fbb2fdccaafad50',
            ext: '.json',
          },
          {
            file: 'packages/nx/README.md',
            hash: '2291f29cde4a97337b230ae28ac6743675080278',
            ext: '.md',
          },
          {
            file: 'packages/nx/tsconfig.json',
            hash: '58bd2c97a66f5e5ea5d05c8a5709ee79bad02094',
            ext: '.json',
          },
          {
            file: 'packages/nx/tsconfig.lib.json',
            hash: 'dbe90e0855d2ef980595dcc17f577088662cfb4d',
            ext: '.json',
          },
          {
            file: 'packages/nx/tsconfig.spec.json',
            hash: 'd6ae6669d75fc5beb184f28966262e1762b9623c',
            ext: '.json',
          },
        ],
      },
    },
    'e2e-angular': {
      name: 'e2e-angular',
      type: 'app',
      data: {
        root: 'e2e/angular',
        sourceRoot: 'e2e/angular',
        projectType: 'application',
        schematics: {},
        architect: {
          e2e: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'e2e/angular/jest.config.js',
              passWithNoTests: true,
              runInBand: true,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'e2e/angular/jest.config.js',
            hash: '8236911c7288d666e074b5b6c71ab75e733fc2ae',
            ext: '.js',
          },
          {
            file: 'e2e/angular/src/angular-core.test.ts',
            hash: 'eba7af4aa5c1c2ee017fc47885c165e1fb7d26e6',
            ext: '.ts',
          },
          {
            file: 'e2e/angular/src/angular-package.test.ts',
            hash: '27e10550a1e117a15cfd24a404ebad15f3f674bd',
            ext: '.ts',
          },
          {
            file: 'e2e/angular/src/angularjs.test.ts',
            hash: '8b50702e8e3960eda97e11c6be5875582198cd97',
            ext: '.ts',
          },
          {
            file: 'e2e/angular/src/karma.test.ts',
            hash: '755d1f856d5afcf54479cc4e9ed696ba3f5e7157',
            ext: '.ts',
          },
          {
            file: 'e2e/angular/src/ng-add.test.ts',
            hash: 'e5e682c1cdc2f6ede0d77203f07ba37dbd9e647b',
            ext: '.ts',
          },
          {
            file: 'e2e/angular/src/ngrx.test.ts',
            hash: '72a27f0ead926f246db50eda4cd83dd515add06c',
            ext: '.ts',
          },
          {
            file: 'e2e/angular/src/protractor.test.ts',
            hash: 'b4aa879e8c5ef88b417af2f5957bc5d2bec2f03c',
            ext: '.ts',
          },
          {
            file: 'e2e/angular/tsconfig.json',
            hash: '6d5abf84832009a8c70e7a910c49f332bf1f0612',
            ext: '.json',
          },
          {
            file: 'e2e/angular/tsconfig.spec.json',
            hash: 'af4ac638d670981da49963e84160a6a6c4439f81',
            ext: '.json',
          },
        ],
      },
    },
    'e2e-cypress': {
      name: 'e2e-cypress',
      type: 'app',
      data: {
        root: 'e2e/cypress',
        sourceRoot: 'e2e/cypress',
        projectType: 'application',
        schematics: {},
        architect: {
          e2e: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'e2e/cypress/jest.config.js',
              passWithNoTests: true,
              runInBand: true,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'e2e/cypress/jest.config.js',
            hash: '6c5395129767a0e9f33bfddcc55f2eb2fe37adf3',
            ext: '.js',
          },
          {
            file: 'e2e/cypress/src/cypress.test.ts',
            hash: '05e8ad1c2006e0f54326474b877bf0281faa69ad',
            ext: '.ts',
          },
          {
            file: 'e2e/cypress/tsconfig.json',
            hash: '6d5abf84832009a8c70e7a910c49f332bf1f0612',
            ext: '.json',
          },
          {
            file: 'e2e/cypress/tsconfig.spec.json',
            hash: 'af4ac638d670981da49963e84160a6a6c4439f81',
            ext: '.json',
          },
        ],
      },
    },
    'e2e-linter': {
      name: 'e2e-linter',
      type: 'app',
      data: {
        root: 'e2e/linter',
        sourceRoot: 'e2e/linter',
        projectType: 'application',
        schematics: {},
        architect: {
          e2e: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'e2e/linter/jest.config.js',
              passWithNoTests: true,
              runInBand: true,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'e2e/linter/jest.config.js',
            hash: 'febb8395ff0473b227c32bda91cef46654e3f121',
            ext: '.js',
          },
          {
            file: 'e2e/linter/src/linter.test.ts',
            hash: 'bfeaf8b3bf6856043861632120ef8ace8431d7e8',
            ext: '.ts',
          },
          {
            file: 'e2e/linter/tsconfig.json',
            hash: '6d5abf84832009a8c70e7a910c49f332bf1f0612',
            ext: '.json',
          },
          {
            file: 'e2e/linter/tsconfig.spec.json',
            hash: 'af4ac638d670981da49963e84160a6a6c4439f81',
            ext: '.json',
          },
        ],
      },
    },
    'e2e-utils': {
      name: 'e2e-utils',
      type: 'lib',
      data: {
        root: 'e2e/utils',
        sourceRoot: 'e2e/utils',
        projectType: 'library',
        schematics: {},
        architect: {},
        tags: [],
        files: [
          {
            file: 'e2e/utils/index.ts',
            hash: 'c8870d8e3f5d4dd3c357b1189012a31a406b388a',
            ext: '.ts',
          },
        ],
      },
    },
    'e2e-bazel': {
      name: 'e2e-bazel',
      type: 'app',
      data: {
        root: 'e2e/bazel',
        sourceRoot: 'e2e/bazel',
        projectType: 'application',
        schematics: {},
        architect: {
          e2e: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'e2e/bazel/jest.config.js',
              passWithNoTests: true,
              runInBand: true,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'e2e/bazel/jest.config.js',
            hash: 'f9401b364f171ea75261be170cda44d4a6f1f694',
            ext: '.js',
          },
          {
            file: 'e2e/bazel/src/bazel.test.ts',
            hash: '400578b44686fe08d406ed3d5682987a6bdb1f24',
            ext: '.ts',
          },
          {
            file: 'e2e/bazel/tsconfig.json',
            hash: '6d5abf84832009a8c70e7a910c49f332bf1f0612',
            ext: '.json',
          },
          {
            file: 'e2e/bazel/tsconfig.spec.json',
            hash: 'af4ac638d670981da49963e84160a6a6c4439f81',
            ext: '.json',
          },
        ],
      },
    },
    'e2e-react': {
      name: 'e2e-react',
      type: 'app',
      data: {
        root: 'e2e/react',
        sourceRoot: 'e2e/react',
        projectType: 'application',
        schematics: {},
        architect: {
          e2e: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'e2e/react/jest.config.js',
              passWithNoTests: true,
              runInBand: true,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'e2e/react/jest.config.js',
            hash: '852ddfbcde437b881702baa1b2f00cf7916c8ae2',
            ext: '.js',
          },
          {
            file: 'e2e/react/src/react-package.test.ts',
            hash: 'dfcaa8d3e6b324c7160c7508c33831ee0125ebeb',
            ext: '.ts',
          },
          {
            file: 'e2e/react/src/react.test.ts',
            hash: '4449737f6b5fcf7f0c112084875e926ae66da0ff',
            ext: '.ts',
          },
          {
            file: 'e2e/react/tsconfig.json',
            hash: '6d5abf84832009a8c70e7a910c49f332bf1f0612',
            ext: '.json',
          },
          {
            file: 'e2e/react/tsconfig.spec.json',
            hash: 'af4ac638d670981da49963e84160a6a6c4439f81',
            ext: '.json',
          },
        ],
      },
    },
    'e2e-jest': {
      name: 'e2e-jest',
      type: 'app',
      data: {
        root: 'e2e/jest',
        sourceRoot: 'e2e/jest',
        projectType: 'application',
        schematics: {},
        architect: {
          e2e: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'e2e/jest/jest.config.js',
              passWithNoTests: true,
              runInBand: true,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'e2e/jest/jest.config.js',
            hash: '8432eb8b47fc056ec810dbd35ec7e68506ee854d',
            ext: '.js',
          },
          {
            file: 'e2e/jest/src/jest.test.ts',
            hash: '0eee0f34caab425ba79a2cd4e3d4b37c26522e72',
            ext: '.ts',
          },
          {
            file: 'e2e/jest/tsconfig.json',
            hash: '6d5abf84832009a8c70e7a910c49f332bf1f0612',
            ext: '.json',
          },
          {
            file: 'e2e/jest/tsconfig.spec.json',
            hash: 'af4ac638d670981da49963e84160a6a6c4439f81',
            ext: '.json',
          },
        ],
      },
    },
    'e2e-next': {
      name: 'e2e-next',
      type: 'app',
      data: {
        root: 'e2e/next',
        sourceRoot: 'e2e/next',
        projectType: 'application',
        schematics: {},
        architect: {
          e2e: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'e2e/next/jest.config.js',
              passWithNoTests: true,
              runInBand: true,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'e2e/next/jest.config.js',
            hash: 'b412316757cb12aac24973f186d7c0f1a037734b',
            ext: '.js',
          },
          {
            file: 'e2e/next/src/next.test.ts',
            hash: '7a25fe209f536a20a3724483dee94483b4b3053d',
            ext: '.ts',
          },
          {
            file: 'e2e/next/tsconfig.json',
            hash: '6d5abf84832009a8c70e7a910c49f332bf1f0612',
            ext: '.json',
          },
          {
            file: 'e2e/next/tsconfig.spec.json',
            hash: 'af4ac638d670981da49963e84160a6a6c4439f81',
            ext: '.json',
          },
        ],
      },
    },
    'e2e-node': {
      name: 'e2e-node',
      type: 'app',
      data: {
        root: 'e2e/node',
        sourceRoot: 'e2e/node',
        projectType: 'application',
        schematics: {},
        architect: {
          e2e: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'e2e/node/jest.config.js',
              passWithNoTests: true,
              runInBand: true,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'e2e/node/jest.config.js',
            hash: '645e22f9b476daf11355f769b022181be3489f6f',
            ext: '.js',
          },
          {
            file: 'e2e/node/src/node.test.ts',
            hash: '2fcb8b6b048f379e8dfea99b12fc6ddd8cd4fe4c',
            ext: '.ts',
          },
          {
            file: 'e2e/node/tsconfig.json',
            hash: '6d5abf84832009a8c70e7a910c49f332bf1f0612',
            ext: '.json',
          },
          {
            file: 'e2e/node/tsconfig.spec.json',
            hash: 'af4ac638d670981da49963e84160a6a6c4439f81',
            ext: '.json',
          },
        ],
      },
    },
    'e2e-cli': {
      name: 'e2e-cli',
      type: 'app',
      data: {
        root: 'e2e/cli',
        sourceRoot: 'e2e/cli',
        projectType: 'application',
        schematics: {},
        architect: {
          e2e: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'e2e/cli/jest.config.js',
              passWithNoTests: true,
              runInBand: true,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'e2e/cli/jest.config.js',
            hash: '471ba68cb7b2ab425b869dd46873dfa18aad1f8a',
            ext: '.js',
          },
          {
            file: 'e2e/cli/src/cli.test.ts',
            hash: '9df81da844423230670d2b99dc4a2f08605a3889',
            ext: '.ts',
          },
          {
            file: 'e2e/cli/tsconfig.json',
            hash: '6d5abf84832009a8c70e7a910c49f332bf1f0612',
            ext: '.json',
          },
          {
            file: 'e2e/cli/tsconfig.spec.json',
            hash: 'af4ac638d670981da49963e84160a6a6c4439f81',
            ext: '.json',
          },
        ],
      },
    },
    'e2e-web': {
      name: 'e2e-web',
      type: 'app',
      data: {
        root: 'e2e/web',
        sourceRoot: 'e2e/web',
        projectType: 'application',
        schematics: {},
        architect: {
          e2e: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'e2e/web/jest.config.js',
              passWithNoTests: true,
              runInBand: true,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'e2e/web/jest.config.js',
            hash: '6a3635b4a257a0c2709d7d5cd0fc039c55e29bbd',
            ext: '.js',
          },
          {
            file: 'e2e/web/src/web.test.ts',
            hash: '80aa5cb823dc1262e47bfa927352a09e76767b40',
            ext: '.ts',
          },
          {
            file: 'e2e/web/tsconfig.json',
            hash: '6d5abf84832009a8c70e7a910c49f332bf1f0612',
            ext: '.json',
          },
          {
            file: 'e2e/web/tsconfig.spec.json',
            hash: 'af4ac638d670981da49963e84160a6a6c4439f81',
            ext: '.json',
          },
        ],
      },
    },
    'npm:@types/cytoscape': {
      type: 'npm',
      name: 'npm:@types/cytoscape',
      data: {
        version: '^3.14.7',
        packageName: '@types/cytoscape',
        files: [],
      },
    },
    'npm:cytoscape': {
      type: 'npm',
      name: 'npm:cytoscape',
      data: {
        version: '^3.15.2',
        packageName: 'cytoscape',
        files: [],
      },
    },
    'npm:cytoscape-dagre': {
      type: 'npm',
      name: 'npm:cytoscape-dagre',
      data: {
        version: '^2.2.2',
        packageName: 'cytoscape-dagre',
        files: [],
      },
    },
    'npm:cytoscape-fcose': {
      type: 'npm',
      name: 'npm:cytoscape-fcose',
      data: {
        version: '^1.2.3',
        packageName: 'cytoscape-fcose',
        files: [],
      },
    },
    'npm:cytoscape-popper': {
      type: 'npm',
      name: 'npm:cytoscape-popper',
      data: {
        version: '^1.0.7',
        packageName: 'cytoscape-popper',
        files: [],
      },
    },
    'npm:@angular-devkit/architect': {
      type: 'npm',
      name: 'npm:@angular-devkit/architect',
      data: {
        version: '0.1000.3',
        packageName: '@angular-devkit/architect',
        files: [],
      },
    },
    'npm:@angular-devkit/build-angular': {
      type: 'npm',
      name: 'npm:@angular-devkit/build-angular',
      data: {
        version: '0.1000.3',
        packageName: '@angular-devkit/build-angular',
        files: [],
      },
    },
    'npm:@angular-devkit/build-ng-packagr': {
      type: 'npm',
      name: 'npm:@angular-devkit/build-ng-packagr',
      data: {
        version: '0.1000.3',
        packageName: '@angular-devkit/build-ng-packagr',
        files: [],
      },
    },
    'npm:@angular-devkit/build-optimizer': {
      type: 'npm',
      name: 'npm:@angular-devkit/build-optimizer',
      data: {
        version: '0.1000.3',
        packageName: '@angular-devkit/build-optimizer',
        files: [],
      },
    },
    'npm:@angular-devkit/build-webpack': {
      type: 'npm',
      name: 'npm:@angular-devkit/build-webpack',
      data: {
        version: '0.1000.3',
        packageName: '@angular-devkit/build-webpack',
        files: [],
      },
    },
    'npm:@angular-devkit/core': {
      type: 'npm',
      name: 'npm:@angular-devkit/core',
      data: {
        version: '10.0.3',
        packageName: '@angular-devkit/core',
        files: [],
      },
    },
    'npm:@angular-devkit/schematics': {
      type: 'npm',
      name: 'npm:@angular-devkit/schematics',
      data: {
        version: '10.0.3',
        packageName: '@angular-devkit/schematics',
        files: [],
      },
    },
    'npm:@angular/cli': {
      type: 'npm',
      name: 'npm:@angular/cli',
      data: {
        version: '10.0.3',
        packageName: '@angular/cli',
        files: [],
      },
    },
    'npm:@angular/common': {
      type: 'npm',
      name: 'npm:@angular/common',
      data: {
        version: '10.0.4',
        packageName: '@angular/common',
        files: [],
      },
    },
    'npm:@angular/compiler': {
      type: 'npm',
      name: 'npm:@angular/compiler',
      data: {
        version: '10.0.4',
        packageName: '@angular/compiler',
        files: [],
      },
    },
    'npm:@angular/compiler-cli': {
      type: 'npm',
      name: 'npm:@angular/compiler-cli',
      data: {
        version: '10.0.4',
        packageName: '@angular/compiler-cli',
        files: [],
      },
    },
    'npm:@angular/core': {
      type: 'npm',
      name: 'npm:@angular/core',
      data: {
        version: '10.0.4',
        packageName: '@angular/core',
        files: [],
      },
    },
    'npm:@angular/forms': {
      type: 'npm',
      name: 'npm:@angular/forms',
      data: {
        version: '10.0.4',
        packageName: '@angular/forms',
        files: [],
      },
    },
    'npm:@angular/platform-browser': {
      type: 'npm',
      name: 'npm:@angular/platform-browser',
      data: {
        version: '10.0.4',
        packageName: '@angular/platform-browser',
        files: [],
      },
    },
    'npm:@angular/platform-browser-dynamic': {
      type: 'npm',
      name: 'npm:@angular/platform-browser-dynamic',
      data: {
        version: '10.0.4',
        packageName: '@angular/platform-browser-dynamic',
        files: [],
      },
    },
    'npm:@angular/router': {
      type: 'npm',
      name: 'npm:@angular/router',
      data: {
        version: '10.0.4',
        packageName: '@angular/router',
        files: [],
      },
    },
    'npm:@angular/service-worker': {
      type: 'npm',
      name: 'npm:@angular/service-worker',
      data: {
        version: '10.0.4',
        packageName: '@angular/service-worker',
        files: [],
      },
    },
    'npm:@angular/upgrade': {
      type: 'npm',
      name: 'npm:@angular/upgrade',
      data: {
        version: '10.0.4',
        packageName: '@angular/upgrade',
        files: [],
      },
    },
    'npm:@babel/core': {
      type: 'npm',
      name: 'npm:@babel/core',
      data: {
        version: '7.9.6',
        packageName: '@babel/core',
        files: [],
      },
    },
    'npm:@babel/plugin-proposal-class-properties': {
      type: 'npm',
      name: 'npm:@babel/plugin-proposal-class-properties',
      data: {
        version: '7.8.3',
        packageName: '@babel/plugin-proposal-class-properties',
        files: [],
      },
    },
    'npm:@babel/plugin-proposal-decorators': {
      type: 'npm',
      name: 'npm:@babel/plugin-proposal-decorators',
      data: {
        version: '7.8.3',
        packageName: '@babel/plugin-proposal-decorators',
        files: [],
      },
    },
    'npm:@babel/plugin-transform-regenerator': {
      type: 'npm',
      name: 'npm:@babel/plugin-transform-regenerator',
      data: {
        version: '7.8.7',
        packageName: '@babel/plugin-transform-regenerator',
        files: [],
      },
    },
    'npm:@babel/preset-env': {
      type: 'npm',
      name: 'npm:@babel/preset-env',
      data: {
        version: '7.9.6',
        packageName: '@babel/preset-env',
        files: [],
      },
    },
    'npm:@babel/preset-react': {
      type: 'npm',
      name: 'npm:@babel/preset-react',
      data: {
        version: '7.9.4',
        packageName: '@babel/preset-react',
        files: [],
      },
    },
    'npm:@babel/preset-typescript': {
      type: 'npm',
      name: 'npm:@babel/preset-typescript',
      data: {
        version: '7.9.0',
        packageName: '@babel/preset-typescript',
        files: [],
      },
    },
    'npm:@bazel/bazel': {
      type: 'npm',
      name: 'npm:@bazel/bazel',
      data: {
        version: '^1.2.0',
        packageName: '@bazel/bazel',
        files: [],
      },
    },
    'npm:@bazel/ibazel': {
      type: 'npm',
      name: 'npm:@bazel/ibazel',
      data: {
        version: '^0.10.3',
        packageName: '@bazel/ibazel',
        files: [],
      },
    },
    'npm:@cypress/webpack-preprocessor': {
      type: 'npm',
      name: 'npm:@cypress/webpack-preprocessor',
      data: {
        version: '^4.1.2',
        packageName: '@cypress/webpack-preprocessor',
        files: [],
      },
    },
    'npm:@nestjs/common': {
      type: 'npm',
      name: 'npm:@nestjs/common',
      data: {
        version: '^7.0.0',
        packageName: '@nestjs/common',
        files: [],
      },
    },
    'npm:@nestjs/core': {
      type: 'npm',
      name: 'npm:@nestjs/core',
      data: {
        version: '^7.0.0',
        packageName: '@nestjs/core',
        files: [],
      },
    },
    'npm:@nestjs/platform-express': {
      type: 'npm',
      name: 'npm:@nestjs/platform-express',
      data: {
        version: '^7.0.0',
        packageName: '@nestjs/platform-express',
        files: [],
      },
    },
    'npm:@nestjs/schematics': {
      type: 'npm',
      name: 'npm:@nestjs/schematics',
      data: {
        version: '^7.0.0',
        packageName: '@nestjs/schematics',
        files: [],
      },
    },
    'npm:@nestjs/testing': {
      type: 'npm',
      name: 'npm:@nestjs/testing',
      data: {
        version: '^7.0.0',
        packageName: '@nestjs/testing',
        files: [],
      },
    },
    'npm:@ngrx/effects': {
      type: 'npm',
      name: 'npm:@ngrx/effects',
      data: {
        version: '9.1.0',
        packageName: '@ngrx/effects',
        files: [],
      },
    },
    'npm:@ngrx/entity': {
      type: 'npm',
      name: 'npm:@ngrx/entity',
      data: {
        version: '9.1.0',
        packageName: '@ngrx/entity',
        files: [],
      },
    },
    'npm:@ngrx/router-store': {
      type: 'npm',
      name: 'npm:@ngrx/router-store',
      data: {
        version: '9.1.0',
        packageName: '@ngrx/router-store',
        files: [],
      },
    },
    'npm:@ngrx/schematics': {
      type: 'npm',
      name: 'npm:@ngrx/schematics',
      data: {
        version: '9.1.0',
        packageName: '@ngrx/schematics',
        files: [],
      },
    },
    'npm:@ngrx/store': {
      type: 'npm',
      name: 'npm:@ngrx/store',
      data: {
        version: '9.1.0',
        packageName: '@ngrx/store',
        files: [],
      },
    },
    'npm:@ngrx/store-devtools': {
      type: 'npm',
      name: 'npm:@ngrx/store-devtools',
      data: {
        version: '9.1.0',
        packageName: '@ngrx/store-devtools',
        files: [],
      },
    },
    'npm:@ngtools/webpack': {
      type: 'npm',
      name: 'npm:@ngtools/webpack',
      data: {
        version: '~10.0.0',
        packageName: '@ngtools/webpack',
        files: [],
      },
    },
    'npm:@nrwl/cypress': {
      type: 'npm',
      name: 'npm:@nrwl/cypress',
      data: {
        version: '10.1.1-beta.2',
        packageName: '@nrwl/cypress',
        files: [],
      },
    },
    'npm:@nrwl/eslint-plugin-nx': {
      type: 'npm',
      name: 'npm:@nrwl/eslint-plugin-nx',
      data: {
        version: '10.1.1-beta.2',
        packageName: '@nrwl/eslint-plugin-nx',
        files: [],
      },
    },
    'npm:@nrwl/jest': {
      type: 'npm',
      name: 'npm:@nrwl/jest',
      data: {
        version: '10.1.1-beta.2',
        packageName: '@nrwl/jest',
        files: [],
      },
    },
    'npm:@nrwl/node': {
      type: 'npm',
      name: 'npm:@nrwl/node',
      data: {
        version: '10.1.1-beta.2',
        packageName: '@nrwl/node',
        files: [],
      },
    },
    'npm:@nrwl/nx-cloud': {
      type: 'npm',
      name: 'npm:@nrwl/nx-cloud',
      data: {
        version: '10.1.0-beta.2',
        packageName: '@nrwl/nx-cloud',
        files: [],
      },
    },
    'npm:@nrwl/web': {
      type: 'npm',
      name: 'npm:@nrwl/web',
      data: {
        version: '10.1.1-beta.2',
        packageName: '@nrwl/web',
        files: [],
      },
    },
    'npm:@nrwl/workspace': {
      type: 'npm',
      name: 'npm:@nrwl/workspace',
      data: {
        version: '10.1.1-beta.2',
        packageName: '@nrwl/workspace',
        files: [],
      },
    },
    'npm:@reduxjs/toolkit': {
      type: 'npm',
      name: 'npm:@reduxjs/toolkit',
      data: {
        version: '1.3.2',
        packageName: '@reduxjs/toolkit',
        files: [],
      },
    },
    'npm:@rollup/plugin-babel': {
      type: 'npm',
      name: 'npm:@rollup/plugin-babel',
      data: {
        version: '5.0.2',
        packageName: '@rollup/plugin-babel',
        files: [],
      },
    },
    'npm:@rollup/plugin-commonjs': {
      type: 'npm',
      name: 'npm:@rollup/plugin-commonjs',
      data: {
        version: '11.0.2',
        packageName: '@rollup/plugin-commonjs',
        files: [],
      },
    },
    'npm:@rollup/plugin-image': {
      type: 'npm',
      name: 'npm:@rollup/plugin-image',
      data: {
        version: '2.0.4',
        packageName: '@rollup/plugin-image',
        files: [],
      },
    },
    'npm:@rollup/plugin-node-resolve': {
      type: 'npm',
      name: 'npm:@rollup/plugin-node-resolve',
      data: {
        version: '7.1.1',
        packageName: '@rollup/plugin-node-resolve',
        files: [],
      },
    },
    'npm:@schematics/angular': {
      type: 'npm',
      name: 'npm:@schematics/angular',
      data: {
        version: '10.0.3',
        packageName: '@schematics/angular',
        files: [],
      },
    },
    'npm:@storybook/addon-knobs': {
      type: 'npm',
      name: 'npm:@storybook/addon-knobs',
      data: {
        version: '5.3.9',
        packageName: '@storybook/addon-knobs',
        files: [],
      },
    },
    'npm:@storybook/angular': {
      type: 'npm',
      name: 'npm:@storybook/angular',
      data: {
        version: '5.3.9',
        packageName: '@storybook/angular',
        files: [],
      },
    },
    'npm:@storybook/core': {
      type: 'npm',
      name: 'npm:@storybook/core',
      data: {
        version: '5.3.9',
        packageName: '@storybook/core',
        files: [],
      },
    },
    'npm:@storybook/react': {
      type: 'npm',
      name: 'npm:@storybook/react',
      data: {
        version: '5.3.9',
        packageName: '@storybook/react',
        files: [],
      },
    },
    'npm:@svgr/webpack': {
      type: 'npm',
      name: 'npm:@svgr/webpack',
      data: {
        version: '^5.2.0',
        packageName: '@svgr/webpack',
        files: [],
      },
    },
    'npm:@testing-library/react': {
      type: 'npm',
      name: 'npm:@testing-library/react',
      data: {
        version: '9.4.0',
        packageName: '@testing-library/react',
        files: [],
      },
    },
    'npm:@types/copy-webpack-plugin': {
      type: 'npm',
      name: 'npm:@types/copy-webpack-plugin',
      data: {
        version: '6.0.0',
        packageName: '@types/copy-webpack-plugin',
        files: [],
      },
    },
    'npm:@types/d3': {
      type: 'npm',
      name: 'npm:@types/d3',
      data: {
        version: '^5.7.2',
        packageName: '@types/d3',
        files: [],
      },
    },
    'npm:@types/eslint': {
      type: 'npm',
      name: 'npm:@types/eslint',
      data: {
        version: '^6.1.8',
        packageName: '@types/eslint',
        files: [],
      },
    },
    'npm:@types/express': {
      type: 'npm',
      name: 'npm:@types/express',
      data: {
        version: '4.17.0',
        packageName: '@types/express',
        files: [],
      },
    },
    'npm:@types/fs-extra': {
      type: 'npm',
      name: 'npm:@types/fs-extra',
      data: {
        version: '7.0.0',
        packageName: '@types/fs-extra',
        files: [],
      },
    },
    'npm:@types/jasmine': {
      type: 'npm',
      name: 'npm:@types/jasmine',
      data: {
        version: '~2.8.6',
        packageName: '@types/jasmine',
        files: [],
      },
    },
    'npm:@types/jasminewd2': {
      type: 'npm',
      name: 'npm:@types/jasminewd2',
      data: {
        version: '~2.0.3',
        packageName: '@types/jasminewd2',
        files: [],
      },
    },
    'npm:@types/jest': {
      type: 'npm',
      name: 'npm:@types/jest',
      data: {
        version: '26.0.8',
        packageName: '@types/jest',
        files: [],
      },
    },
    'npm:@types/node': {
      type: 'npm',
      name: 'npm:@types/node',
      data: {
        version: '14.14.33',
        packageName: '@types/node',
        files: [],
      },
    },
    'npm:@types/prettier': {
      type: 'npm',
      name: 'npm:@types/prettier',
      data: {
        version: '2.0.0',
        packageName: '@types/prettier',
        files: [],
      },
    },
    'npm:@types/react': {
      type: 'npm',
      name: 'npm:@types/react',
      data: {
        version: '16.9.17',
        packageName: '@types/react',
        files: [],
      },
    },
    'npm:@types/react-dom': {
      type: 'npm',
      name: 'npm:@types/react-dom',
      data: {
        version: '16.9.4',
        packageName: '@types/react-dom',
        files: [],
      },
    },
    'npm:@types/react-redux': {
      type: 'npm',
      name: 'npm:@types/react-redux',
      data: {
        version: '7.1.5',
        packageName: '@types/react-redux',
        files: [],
      },
    },
    'npm:@types/react-router-dom': {
      type: 'npm',
      name: 'npm:@types/react-router-dom',
      data: {
        version: '5.1.3',
        packageName: '@types/react-router-dom',
        files: [],
      },
    },
    'npm:@types/webpack': {
      type: 'npm',
      name: 'npm:@types/webpack',
      data: {
        version: '^4.4.24',
        packageName: '@types/webpack',
        files: [],
      },
    },
    'npm:@types/yargs': {
      type: 'npm',
      name: 'npm:@types/yargs',
      data: {
        version: '^15.0.5',
        packageName: '@types/yargs',
        files: [],
      },
    },
    'npm:@typescript-eslint/eslint-plugin': {
      type: 'npm',
      name: 'npm:@typescript-eslint/eslint-plugin',
      data: {
        version: '^2.19.2',
        packageName: '@typescript-eslint/eslint-plugin',
        files: [],
      },
    },
    'npm:@typescript-eslint/experimental-utils': {
      type: 'npm',
      name: 'npm:@typescript-eslint/experimental-utils',
      data: {
        version: '^2.19.2',
        packageName: '@typescript-eslint/experimental-utils',
        files: [],
      },
    },
    'npm:@typescript-eslint/parser': {
      type: 'npm',
      name: 'npm:@typescript-eslint/parser',
      data: {
        version: '^2.19.2',
        packageName: '@typescript-eslint/parser',
        files: [],
      },
    },
    'npm:@zeit/next-css': {
      type: 'npm',
      name: 'npm:@zeit/next-css',
      data: {
        version: '1.0.1',
        packageName: '@zeit/next-css',
        files: [],
      },
    },
    'npm:@zeit/next-less': {
      type: 'npm',
      name: 'npm:@zeit/next-less',
      data: {
        version: '1.0.1',
        packageName: '@zeit/next-less',
        files: [],
      },
    },
    'npm:@zeit/next-sass': {
      type: 'npm',
      name: 'npm:@zeit/next-sass',
      data: {
        version: '1.0.1',
        packageName: '@zeit/next-sass',
        files: [],
      },
    },
    'npm:@zeit/next-stylus': {
      type: 'npm',
      name: 'npm:@zeit/next-stylus',
      data: {
        version: '1.0.1',
        packageName: '@zeit/next-stylus',
        files: [],
      },
    },
    'npm:ajv': {
      type: 'npm',
      name: 'npm:ajv',
      data: {
        version: '6.10.2',
        packageName: 'ajv',
        files: [],
      },
    },
    'npm:angular': {
      type: 'npm',
      name: 'npm:angular',
      data: {
        version: '1.8.0',
        packageName: 'angular',
        files: [],
      },
    },
    'npm:app-root-path': {
      type: 'npm',
      name: 'npm:app-root-path',
      data: {
        version: '^2.0.1',
        packageName: 'app-root-path',
        files: [],
      },
    },
    'npm:autoprefixer': {
      type: 'npm',
      name: 'npm:autoprefixer',
      data: {
        version: '9.7.4',
        packageName: 'autoprefixer',
        files: [],
      },
    },
    'npm:axios': {
      type: 'npm',
      name: 'npm:axios',
      data: {
        version: '^0.19.0',
        packageName: 'axios',
        files: [],
      },
    },
    'npm:babel-loader': {
      type: 'npm',
      name: 'npm:babel-loader',
      data: {
        version: '8.1.0',
        packageName: 'babel-loader',
        files: [],
      },
    },
    'npm:babel-plugin-const-enum': {
      type: 'npm',
      name: 'npm:babel-plugin-const-enum',
      data: {
        version: '^1.0.1',
        packageName: 'babel-plugin-const-enum',
        files: [],
      },
    },
    'npm:babel-plugin-emotion': {
      type: 'npm',
      name: 'npm:babel-plugin-emotion',
      data: {
        version: '^10.0.29',
        packageName: 'babel-plugin-emotion',
        files: [],
      },
    },
    'npm:babel-plugin-macros': {
      type: 'npm',
      name: 'npm:babel-plugin-macros',
      data: {
        version: '^2.8.0',
        packageName: 'babel-plugin-macros',
        files: [],
      },
    },
    'npm:babel-plugin-styled-components': {
      type: 'npm',
      name: 'npm:babel-plugin-styled-components',
      data: {
        version: '^1.10.7',
        packageName: 'babel-plugin-styled-components',
        files: [],
      },
    },
    'npm:babel-plugin-transform-async-to-promises': {
      type: 'npm',
      name: 'npm:babel-plugin-transform-async-to-promises',
      data: {
        version: '^0.8.15',
        packageName: 'babel-plugin-transform-async-to-promises',
        files: [],
      },
    },
    'npm:browserslist': {
      type: 'npm',
      name: 'npm:browserslist',
      data: {
        version: '4.8.7',
        packageName: 'browserslist',
        files: [],
      },
    },
    'npm:cacache': {
      type: 'npm',
      name: 'npm:cacache',
      data: {
        version: '12.0.2',
        packageName: 'cacache',
        files: [],
      },
    },
    'npm:caniuse-lite': {
      type: 'npm',
      name: 'npm:caniuse-lite',
      data: {
        version: '^1.0.30001030',
        packageName: 'caniuse-lite',
        files: [],
      },
    },
    'npm:circular-dependency-plugin': {
      type: 'npm',
      name: 'npm:circular-dependency-plugin',
      data: {
        version: '^5.0.2',
        packageName: 'circular-dependency-plugin',
        files: [],
      },
    },
    'npm:clean-css': {
      type: 'npm',
      name: 'npm:clean-css',
      data: {
        version: '4.2.1',
        packageName: 'clean-css',
        files: [],
      },
    },
    'npm:codelyzer': {
      type: 'npm',
      name: 'npm:codelyzer',
      data: {
        version: '~5.0.1',
        packageName: 'codelyzer',
        files: [],
      },
    },
    'npm:commitizen': {
      type: 'npm',
      name: 'npm:commitizen',
      data: {
        version: '^4.0.3',
        packageName: 'commitizen',
        files: [],
      },
    },
    'npm:confusing-browser-globals': {
      type: 'npm',
      name: 'npm:confusing-browser-globals',
      data: {
        version: '^1.0.9',
        packageName: 'confusing-browser-globals',
        files: [],
      },
    },
    'npm:conventional-changelog-cli': {
      type: 'npm',
      name: 'npm:conventional-changelog-cli',
      data: {
        version: '^2.0.23',
        packageName: 'conventional-changelog-cli',
        files: [],
      },
    },
    'npm:copy-webpack-plugin': {
      type: 'npm',
      name: 'npm:copy-webpack-plugin',
      data: {
        version: '6.0.3',
        packageName: 'copy-webpack-plugin',
        files: [],
      },
    },
    'npm:core-js': {
      type: 'npm',
      name: 'npm:core-js',
      data: {
        version: '^3.6.5',
        packageName: 'core-js',
        files: [],
      },
    },
    'npm:cosmiconfig': {
      type: 'npm',
      name: 'npm:cosmiconfig',
      data: {
        version: '^4.0.0',
        packageName: 'cosmiconfig',
        files: [],
      },
    },
    'npm:css-loader': {
      type: 'npm',
      name: 'npm:css-loader',
      data: {
        version: '3.4.2',
        packageName: 'css-loader',
        files: [],
      },
    },
    'npm:cypress': {
      type: 'npm',
      name: 'npm:cypress',
      data: {
        version: '^4.1.0',
        packageName: 'cypress',
        files: [],
      },
    },
    'npm:cz-conventional-changelog': {
      type: 'npm',
      name: 'npm:cz-conventional-changelog',
      data: {
        version: '^3.0.2',
        packageName: 'cz-conventional-changelog',
        files: [],
      },
    },
    'npm:cz-customizable': {
      type: 'npm',
      name: 'npm:cz-customizable',
      data: {
        version: '^6.2.0',
        packageName: 'cz-customizable',
        files: [],
      },
    },
    'npm:d3': {
      type: 'npm',
      name: 'npm:d3',
      data: {
        version: '^6.1.1',
        packageName: 'd3',
        files: [],
      },
    },
    'npm:d3-zoom': {
      type: 'npm',
      name: 'npm:d3-zoom',
      data: {
        version: '^2.0.0',
        packageName: 'd3-zoom',
        files: [],
      },
    },
    'npm:dagre-d3': {
      type: 'npm',
      name: 'npm:dagre-d3',
      data: {
        version: '^0.6.4',
        packageName: 'dagre-d3',
        files: [],
      },
    },
    'npm:document-register-element': {
      type: 'npm',
      name: 'npm:document-register-element',
      data: {
        version: '^1.13.1',
        packageName: 'document-register-element',
        files: [],
      },
    },
    'npm:dotenv': {
      type: 'npm',
      name: 'npm:dotenv',
      data: {
        version: '8.2.0',
        packageName: 'dotenv',
        files: [],
      },
    },
    'npm:eslint': {
      type: 'npm',
      name: 'npm:eslint',
      data: {
        version: '6.8.0',
        packageName: 'eslint',
        files: [],
      },
    },
    'npm:eslint-config-prettier': {
      type: 'npm',
      name: 'npm:eslint-config-prettier',
      data: {
        version: '8.1.0',
        packageName: 'eslint-config-prettier',
        files: [],
      },
    },
    'npm:eslint-plugin-cypress': {
      type: 'npm',
      name: 'npm:eslint-plugin-cypress',
      data: {
        version: '^2.10.3',
        packageName: 'eslint-plugin-cypress',
        files: [],
      },
    },
    'npm:eslint-plugin-import': {
      type: 'npm',
      name: 'npm:eslint-plugin-import',
      data: {
        version: '^2.20.1',
        packageName: 'eslint-plugin-import',
        files: [],
      },
    },
    'npm:eslint-plugin-jsx-a11y': {
      type: 'npm',
      name: 'npm:eslint-plugin-jsx-a11y',
      data: {
        version: '^6.2.3',
        packageName: 'eslint-plugin-jsx-a11y',
        files: [],
      },
    },
    'npm:eslint-plugin-react': {
      type: 'npm',
      name: 'npm:eslint-plugin-react',
      data: {
        version: '^7.18.3',
        packageName: 'eslint-plugin-react',
        files: [],
      },
    },
    'npm:eslint-plugin-react-hooks': {
      type: 'npm',
      name: 'npm:eslint-plugin-react-hooks',
      data: {
        version: '^2.4.0',
        packageName: 'eslint-plugin-react-hooks',
        files: [],
      },
    },
    'npm:express': {
      type: 'npm',
      name: 'npm:express',
      data: {
        version: '4.17.1',
        packageName: 'express',
        files: [],
      },
    },
    'npm:file-loader': {
      type: 'npm',
      name: 'npm:file-loader',
      data: {
        version: '4.2.0',
        packageName: 'file-loader',
        files: [],
      },
    },
    'npm:find-cache-dir': {
      type: 'npm',
      name: 'npm:find-cache-dir',
      data: {
        version: '3.0.0',
        packageName: 'find-cache-dir',
        files: [],
      },
    },
    'npm:flat': {
      type: 'npm',
      name: 'npm:flat',
      data: {
        version: '^5.0.2',
        packageName: 'flat',
        files: [],
      },
    },
    'npm:fork-ts-checker-webpack-plugin': {
      type: 'npm',
      name: 'npm:fork-ts-checker-webpack-plugin',
      data: {
        version: '^3.1.1',
        packageName: 'fork-ts-checker-webpack-plugin',
        files: [],
      },
    },
    'npm:fs-extra': {
      type: 'npm',
      name: 'npm:fs-extra',
      data: {
        version: '7.0.1',
        packageName: 'fs-extra',
        files: [],
      },
    },
    'npm:glob': {
      type: 'npm',
      name: 'npm:glob',
      data: {
        version: '7.1.4',
        packageName: 'glob',
        files: [],
      },
    },
    'npm:html-webpack-plugin': {
      type: 'npm',
      name: 'npm:html-webpack-plugin',
      data: {
        version: '^3.2.0',
        packageName: 'html-webpack-plugin',
        files: [],
      },
    },
    'npm:husky': {
      type: 'npm',
      name: 'npm:husky',
      data: {
        version: '^3.0.3',
        packageName: 'husky',
        files: [],
      },
    },
    'npm:identity-obj-proxy': {
      type: 'npm',
      name: 'npm:identity-obj-proxy',
      data: {
        version: '3.0.0',
        packageName: 'identity-obj-proxy',
        files: [],
      },
    },
    'npm:ignore': {
      type: 'npm',
      name: 'npm:ignore',
      data: {
        version: '^5.0.4',
        packageName: 'ignore',
        files: [],
      },
    },
    'npm:import-fresh': {
      type: 'npm',
      name: 'npm:import-fresh',
      data: {
        version: '^3.1.0',
        packageName: 'import-fresh',
        files: [],
      },
    },
    'npm:jasmine-core': {
      type: 'npm',
      name: 'npm:jasmine-core',
      data: {
        version: '~2.99.1',
        packageName: 'jasmine-core',
        files: [],
      },
    },
    'npm:jasmine-marbles': {
      type: 'npm',
      name: 'npm:jasmine-marbles',
      data: {
        version: '~0.6.0',
        packageName: 'jasmine-marbles',
        files: [],
      },
    },
    'npm:jasmine-spec-reporter': {
      type: 'npm',
      name: 'npm:jasmine-spec-reporter',
      data: {
        version: '~4.2.1',
        packageName: 'jasmine-spec-reporter',
        files: [],
      },
    },
    'npm:jest': {
      type: 'npm',
      name: 'npm:jest',
      data: {
        version: '26.2.2',
        packageName: 'jest',
        files: [],
      },
    },
    'npm:jest-preset-angular': {
      type: 'npm',
      name: 'npm:jest-preset-angular',
      data: {
        version: '8.2.1',
        packageName: 'jest-preset-angular',
        files: [],
      },
    },
    'npm:karma': {
      type: 'npm',
      name: 'npm:karma',
      data: {
        version: '~4.0.0',
        packageName: 'karma',
        files: [],
      },
    },
    'npm:karma-chrome-launcher': {
      type: 'npm',
      name: 'npm:karma-chrome-launcher',
      data: {
        version: '~2.2.0',
        packageName: 'karma-chrome-launcher',
        files: [],
      },
    },
    'npm:karma-coverage-istanbul-reporter': {
      type: 'npm',
      name: 'npm:karma-coverage-istanbul-reporter',
      data: {
        version: '~2.0.1',
        packageName: 'karma-coverage-istanbul-reporter',
        files: [],
      },
    },
    'npm:karma-jasmine': {
      type: 'npm',
      name: 'npm:karma-jasmine',
      data: {
        version: '~1.1.1',
        packageName: 'karma-jasmine',
        files: [],
      },
    },
    'npm:karma-jasmine-html-reporter': {
      type: 'npm',
      name: 'npm:karma-jasmine-html-reporter',
      data: {
        version: '^0.2.2',
        packageName: 'karma-jasmine-html-reporter',
        files: [],
      },
    },
    'npm:karma-source-map-support': {
      type: 'npm',
      name: 'npm:karma-source-map-support',
      data: {
        version: '1.4.0',
        packageName: 'karma-source-map-support',
        files: [],
      },
    },
    'npm:karma-webpack': {
      type: 'npm',
      name: 'npm:karma-webpack',
      data: {
        version: '4.0.2',
        packageName: 'karma-webpack',
        files: [],
      },
    },
    'npm:less': {
      type: 'npm',
      name: 'npm:less',
      data: {
        version: '3.11.1',
        packageName: 'less',
        files: [],
      },
    },
    'npm:less-loader': {
      type: 'npm',
      name: 'npm:less-loader',
      data: {
        version: '5.0.0',
        packageName: 'less-loader',
        files: [],
      },
    },
    'npm:license-webpack-plugin': {
      type: 'npm',
      name: 'npm:license-webpack-plugin',
      data: {
        version: '2.1.2',
        packageName: 'license-webpack-plugin',
        files: [],
      },
    },
    'npm:loader-utils': {
      type: 'npm',
      name: 'npm:loader-utils',
      data: {
        version: '1.2.3',
        packageName: 'loader-utils',
        files: [],
      },
    },
    'npm:memfs': {
      type: 'npm',
      name: 'npm:memfs',
      data: {
        version: '^3.0.1',
        packageName: 'memfs',
        files: [],
      },
    },
    'npm:mime': {
      type: 'npm',
      name: 'npm:mime',
      data: {
        version: '2.4.4',
        packageName: 'mime',
        files: [],
      },
    },
    'npm:mini-css-extract-plugin': {
      type: 'npm',
      name: 'npm:mini-css-extract-plugin',
      data: {
        version: '0.8.0',
        packageName: 'mini-css-extract-plugin',
        files: [],
      },
    },
    'npm:minimatch': {
      type: 'npm',
      name: 'npm:minimatch',
      data: {
        version: '3.0.4',
        packageName: 'minimatch',
        files: [],
      },
    },
    'npm:next': {
      type: 'npm',
      name: 'npm:next',
      data: {
        version: '9.5.2',
        packageName: 'next',
        files: [],
      },
    },
    'npm:ng-packagr': {
      type: 'npm',
      name: 'npm:ng-packagr',
      data: {
        version: '9.1.0',
        packageName: 'ng-packagr',
        files: [],
      },
    },
    'npm:ngrx-store-freeze': {
      type: 'npm',
      name: 'npm:ngrx-store-freeze',
      data: {
        version: '0.2.4',
        packageName: 'ngrx-store-freeze',
        files: [],
      },
    },
    'npm:npm-run-all': {
      type: 'npm',
      name: 'npm:npm-run-all',
      data: {
        version: '^4.1.5',
        packageName: 'npm-run-all',
        files: [],
      },
    },
    'npm:open': {
      type: 'npm',
      name: 'npm:open',
      data: {
        version: '6.4.0',
        packageName: 'open',
        files: [],
      },
    },
    'npm:opn': {
      type: 'npm',
      name: 'npm:opn',
      data: {
        version: '^5.3.0',
        packageName: 'opn',
        files: [],
      },
    },
    'npm:parse5': {
      type: 'npm',
      name: 'npm:parse5',
      data: {
        version: '4.0.0',
        packageName: 'parse5',
        files: [],
      },
    },
    'npm:postcss': {
      type: 'npm',
      name: 'npm:postcss',
      data: {
        version: '7.0.27',
        packageName: 'postcss',
        files: [],
      },
    },
    'npm:postcss-import': {
      type: 'npm',
      name: 'npm:postcss-import',
      data: {
        version: '12.0.1',
        packageName: 'postcss-import',
        files: [],
      },
    },
    'npm:postcss-loader': {
      type: 'npm',
      name: 'npm:postcss-loader',
      data: {
        version: '3.0.0',
        packageName: 'postcss-loader',
        files: [],
      },
    },
    'npm:precise-commits': {
      type: 'npm',
      name: 'npm:precise-commits',
      data: {
        version: '1.0.2',
        packageName: 'precise-commits',
        files: [],
      },
    },
    'npm:prettier': {
      type: 'npm',
      name: 'npm:prettier',
      data: {
        version: '2.0.4',
        packageName: 'prettier',
        files: [],
      },
    },
    'npm:pretty-quick': {
      type: 'npm',
      name: 'npm:pretty-quick',
      data: {
        version: '^2.0.1',
        packageName: 'pretty-quick',
        files: [],
      },
    },
    'npm:protractor': {
      type: 'npm',
      name: 'npm:protractor',
      data: {
        version: '5.4.3',
        packageName: 'protractor',
        files: [],
      },
    },
    'npm:raw-loader': {
      type: 'npm',
      name: 'npm:raw-loader',
      data: {
        version: '3.1.0',
        packageName: 'raw-loader',
        files: [],
      },
    },
    'npm:react': {
      type: 'npm',
      name: 'npm:react',
      data: {
        version: '16.10.2',
        packageName: 'react',
        files: [],
      },
    },
    'npm:react-dom': {
      type: 'npm',
      name: 'npm:react-dom',
      data: {
        version: '16.10.2',
        packageName: 'react-dom',
        files: [],
      },
    },
    'npm:react-redux': {
      type: 'npm',
      name: 'npm:react-redux',
      data: {
        version: '7.1.3',
        packageName: 'react-redux',
        files: [],
      },
    },
    'npm:react-router-dom': {
      type: 'npm',
      name: 'npm:react-router-dom',
      data: {
        version: '5.1.2',
        packageName: 'react-router-dom',
        files: [],
      },
    },
    'npm:regenerator-runtime': {
      type: 'npm',
      name: 'npm:regenerator-runtime',
      data: {
        version: '0.13.3',
        packageName: 'regenerator-runtime',
        files: [],
      },
    },
    'npm:release-it': {
      type: 'npm',
      name: 'npm:release-it',
      data: {
        version: '^7.4.0',
        packageName: 'release-it',
        files: [],
      },
    },
    'npm:rimraf': {
      type: 'npm',
      name: 'npm:rimraf',
      data: {
        version: '^3.0.2',
        packageName: 'rimraf',
        files: [],
      },
    },
    'npm:rollup': {
      type: 'npm',
      name: 'npm:rollup',
      data: {
        version: '1.31.1',
        packageName: 'rollup',
        files: [],
      },
    },
    'npm:rollup-plugin-copy': {
      type: 'npm',
      name: 'npm:rollup-plugin-copy',
      data: {
        version: '3.3.0',
        packageName: 'rollup-plugin-copy',
        files: [],
      },
    },
    'npm:rollup-plugin-filesize': {
      type: 'npm',
      name: 'npm:rollup-plugin-filesize',
      data: {
        version: '^9.0.0',
        packageName: 'rollup-plugin-filesize',
        files: [],
      },
    },
    'npm:rollup-plugin-local-resolve': {
      type: 'npm',
      name: 'npm:rollup-plugin-local-resolve',
      data: {
        version: '1.0.7',
        packageName: 'rollup-plugin-local-resolve',
        files: [],
      },
    },
    'npm:rollup-plugin-peer-deps-external': {
      type: 'npm',
      name: 'npm:rollup-plugin-peer-deps-external',
      data: {
        version: '2.2.2',
        packageName: 'rollup-plugin-peer-deps-external',
        files: [],
      },
    },
    'npm:rollup-plugin-postcss': {
      type: 'npm',
      name: 'npm:rollup-plugin-postcss',
      data: {
        version: '^3.1.1',
        packageName: 'rollup-plugin-postcss',
        files: [],
      },
    },
    'npm:rollup-plugin-typescript2': {
      type: 'npm',
      name: 'npm:rollup-plugin-typescript2',
      data: {
        version: '0.26.0',
        packageName: 'rollup-plugin-typescript2',
        files: [],
      },
    },
    'npm:rxjs': {
      type: 'npm',
      name: 'npm:rxjs',
      data: {
        version: '6.5.5',
        packageName: 'rxjs',
        files: [],
      },
    },
    'npm:sass': {
      type: 'npm',
      name: 'npm:sass',
      data: {
        version: '1.26.3',
        packageName: 'sass',
        files: [],
      },
    },
    'npm:sass-loader': {
      type: 'npm',
      name: 'npm:sass-loader',
      data: {
        version: '8.0.2',
        packageName: 'sass-loader',
        files: [],
      },
    },
    'npm:semver': {
      type: 'npm',
      name: 'npm:semver',
      data: {
        version: '6.3.0',
        packageName: 'semver',
        files: [],
      },
    },
    'npm:shelljs': {
      type: 'npm',
      name: 'npm:shelljs',
      data: {
        version: '^0.8.3',
        packageName: 'shelljs',
        files: [],
      },
    },
    'npm:source-map': {
      type: 'npm',
      name: 'npm:source-map',
      data: {
        version: '0.7.3',
        packageName: 'source-map',
        files: [],
      },
    },
    'npm:source-map-loader': {
      type: 'npm',
      name: 'npm:source-map-loader',
      data: {
        version: '0.2.4',
        packageName: 'source-map-loader',
        files: [],
      },
    },
    'npm:source-map-support': {
      type: 'npm',
      name: 'npm:source-map-support',
      data: {
        version: '^0.5.12',
        packageName: 'source-map-support',
        files: [],
      },
    },
    'npm:speed-measure-webpack-plugin': {
      type: 'npm',
      name: 'npm:speed-measure-webpack-plugin',
      data: {
        version: '1.3.1',
        packageName: 'speed-measure-webpack-plugin',
        files: [],
      },
    },
    'npm:strip-json-comments': {
      type: 'npm',
      name: 'npm:strip-json-comments',
      data: {
        version: '2.0.1',
        packageName: 'strip-json-comments',
        files: [],
      },
    },
    'npm:style-loader': {
      type: 'npm',
      name: 'npm:style-loader',
      data: {
        version: '1.0.0',
        packageName: 'style-loader',
        files: [],
      },
    },
    'npm:styled-components': {
      type: 'npm',
      name: 'npm:styled-components',
      data: {
        version: '5.0.0',
        packageName: 'styled-components',
        files: [],
      },
    },
    'npm:stylus': {
      type: 'npm',
      name: 'npm:stylus',
      data: {
        version: '0.54.5',
        packageName: 'stylus',
        files: [],
      },
    },
    'npm:stylus-loader': {
      type: 'npm',
      name: 'npm:stylus-loader',
      data: {
        version: '3.0.2',
        packageName: 'stylus-loader',
        files: [],
      },
    },
    'npm:tar': {
      type: 'npm',
      name: 'npm:tar',
      data: {
        version: '5.0.5',
        packageName: 'tar',
        files: [],
      },
    },
    'npm:terser': {
      type: 'npm',
      name: 'npm:terser',
      data: {
        version: '4.3.8',
        packageName: 'terser',
        files: [],
      },
    },
    'npm:terser-webpack-plugin': {
      type: 'npm',
      name: 'npm:terser-webpack-plugin',
      data: {
        version: '2.3.1',
        packageName: 'terser-webpack-plugin',
        files: [],
      },
    },
    'npm:tippy.js': {
      type: 'npm',
      name: 'npm:tippy.js',
      data: {
        version: '5.2.1',
        packageName: 'tippy.js',
        files: [],
      },
    },
    'npm:tmp': {
      type: 'npm',
      name: 'npm:tmp',
      data: {
        version: '0.0.33',
        packageName: 'tmp',
        files: [],
      },
    },
    'npm:tree-kill': {
      type: 'npm',
      name: 'npm:tree-kill',
      data: {
        version: '1.2.2',
        packageName: 'tree-kill',
        files: [],
      },
    },
    'npm:ts-jest': {
      type: 'npm',
      name: 'npm:ts-jest',
      data: {
        version: '26.1.4',
        packageName: 'ts-jest',
        files: [],
      },
    },
    'npm:ts-loader': {
      type: 'npm',
      name: 'npm:ts-loader',
      data: {
        version: '^5.3.1',
        packageName: 'ts-loader',
        files: [],
      },
    },
    'npm:ts-node': {
      type: 'npm',
      name: 'npm:ts-node',
      data: {
        version: '^8.0.2',
        packageName: 'ts-node',
        files: [],
      },
    },
    'npm:tsconfig-paths-webpack-plugin': {
      type: 'npm',
      name: 'npm:tsconfig-paths-webpack-plugin',
      data: {
        version: '^3.2.0',
        packageName: 'tsconfig-paths-webpack-plugin',
        files: [],
      },
    },
    'npm:tsickle': {
      type: 'npm',
      name: 'npm:tsickle',
      data: {
        version: '^0.38.1',
        packageName: 'tsickle',
        files: [],
      },
    },
    'npm:tslib': {
      type: 'npm',
      name: 'npm:tslib',
      data: {
        version: '^1.9.3',
        packageName: 'tslib',
        files: [],
      },
    },
    'npm:tslint': {
      type: 'npm',
      name: 'npm:tslint',
      data: {
        version: '6.0.0',
        packageName: 'tslint',
        files: [],
      },
    },
    'npm:typescript': {
      type: 'npm',
      name: 'npm:typescript',
      data: {
        version: '3.9.6',
        packageName: 'typescript',
        files: [],
      },
    },
    'npm:url-loader': {
      type: 'npm',
      name: 'npm:url-loader',
      data: {
        version: '^3.0.0',
        packageName: 'url-loader',
        files: [],
      },
    },
    'npm:verdaccio': {
      type: 'npm',
      name: 'npm:verdaccio',
      data: {
        version: '^4.4.2',
        packageName: 'verdaccio',
        files: [],
      },
    },
    'npm:webpack': {
      type: 'npm',
      name: 'npm:webpack',
      data: {
        version: '4.42.0',
        packageName: 'webpack',
        files: [],
      },
    },
    'npm:webpack-dev-middleware': {
      type: 'npm',
      name: 'npm:webpack-dev-middleware',
      data: {
        version: '3.7.0',
        packageName: 'webpack-dev-middleware',
        files: [],
      },
    },
    'npm:webpack-dev-server': {
      type: 'npm',
      name: 'npm:webpack-dev-server',
      data: {
        version: '3.9.0',
        packageName: 'webpack-dev-server',
        files: [],
      },
    },
    'npm:webpack-merge': {
      type: 'npm',
      name: 'npm:webpack-merge',
      data: {
        version: '4.2.1',
        packageName: 'webpack-merge',
        files: [],
      },
    },
    'npm:webpack-node-externals': {
      type: 'npm',
      name: 'npm:webpack-node-externals',
      data: {
        version: '^1.7.2',
        packageName: 'webpack-node-externals',
        files: [],
      },
    },
    'npm:webpack-sources': {
      type: 'npm',
      name: 'npm:webpack-sources',
      data: {
        version: '1.4.3',
        packageName: 'webpack-sources',
        files: [],
      },
    },
    'npm:webpack-subresource-integrity': {
      type: 'npm',
      name: 'npm:webpack-subresource-integrity',
      data: {
        version: '1.1.0-rc.6',
        packageName: 'webpack-subresource-integrity',
        files: [],
      },
    },
    'npm:worker-plugin': {
      type: 'npm',
      name: 'npm:worker-plugin',
      data: {
        version: '3.2.0',
        packageName: 'worker-plugin',
        files: [],
      },
    },
    'npm:yargs': {
      type: 'npm',
      name: 'npm:yargs',
      data: {
        version: '15.4.1',
        packageName: 'yargs',
        files: [],
      },
    },
    'npm:zone.js': {
      type: 'npm',
      name: 'npm:zone.js',
      data: {
        version: '^0.10.0',
        packageName: 'zone.js',
        files: [],
      },
    },
  },
  dependencies: {
    'create-nx-workspace': [
      {
        type: 'implicit',
        source: 'create-nx-workspace',
        target: 'workspace',
      },
      {
        type: 'static',
        source: 'create-nx-workspace',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'create-nx-workspace',
        target: 'npm:tmp',
      },
    ],
    'eslint-plugin-nx': [
      {
        type: 'implicit',
        source: 'eslint-plugin-nx',
        target: 'workspace',
      },
      {
        type: 'static',
        source: 'eslint-plugin-nx',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'eslint-plugin-nx',
        target: 'npm:@typescript-eslint/experimental-utils',
      },
      {
        type: 'static',
        source: 'eslint-plugin-nx',
        target: 'npm:@angular-devkit/core',
      },
      {
        type: 'static',
        source: 'eslint-plugin-nx',
        target: 'npm:@typescript-eslint/parser',
      },
      {
        type: 'static',
        source: 'eslint-plugin-nx',
        target: 'npm:memfs',
      },
    ],
    'create-nx-plugin': [
      {
        type: 'static',
        source: 'create-nx-plugin',
        target: 'workspace',
      },
      {
        type: 'implicit',
        source: 'create-nx-plugin',
        target: 'nx-plugin',
      },
      {
        type: 'static',
        source: 'create-nx-plugin',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'create-nx-plugin',
        target: 'npm:tmp',
      },
      {
        type: 'static',
        source: 'create-nx-plugin',
        target: 'npm:fs-extra',
      },
    ],
    'dep-graph-client-e2e': [
      {
        type: 'static',
        source: 'dep-graph-client-e2e',
        target: 'cypress',
      },
      {
        type: 'implicit',
        source: 'dep-graph-client-e2e',
        target: 'dep-graph-client',
      },
      {
        type: 'static',
        source: 'dep-graph-client-e2e',
        target: 'npm:@nrwl/cypress',
      },
    ],
    'dep-graph-client': [
      {
        type: 'static',
        source: 'dep-graph-client',
        target: 'workspace',
      },
      {
        type: 'static',
        source: 'dep-graph-client',
        target: 'npm:tippy.js',
      },
      {
        type: 'static',
        source: 'dep-graph-client',
        target: 'npm:d3',
      },
      {
        type: 'static',
        source: 'dep-graph-client',
        target: 'npm:dagre-d3',
      },
      {
        type: 'static',
        source: 'dep-graph-client',
        target: 'npm:cytoscape-dagre',
      },
      {
        type: 'static',
        source: 'dep-graph-client',
        target: 'npm:cytoscape-fcose',
      },
      {
        type: 'static',
        source: 'dep-graph-client',
        target: 'npm:cytoscape',
      },
      {
        type: 'static',
        source: 'dep-graph-client',
        target: 'npm:cytoscape-popper',
      },
      {
        type: 'static',
        source: 'dep-graph-client',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'dep-graph-client',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'dep-graph-client',
        target: 'npm:core-js',
      },
      {
        type: 'static',
        source: 'dep-graph-client',
        target: 'npm:regenerator-runtime',
      },
      {
        type: 'static',
        source: 'dep-graph-client',
        target: 'npm:document-register-element',
      },
    ],
    workspace: [
      {
        type: 'implicit',
        source: 'workspace',
        target: 'tao',
      },
      {
        type: 'implicit',
        source: 'workspace',
        target: 'cli',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:@angular-devkit/core',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:tmp',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:@angular-devkit/architect',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:dotenv',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:yargs',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:fs-extra',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:opn',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:@angular-devkit/schematics',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:typescript',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:memfs',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:flat',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:minimatch',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:ignore',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:strip-json-comments',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:semver',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:karma',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:karma-jasmine',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:karma-chrome-launcher',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:karma-jasmine-html-reporter',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:karma-coverage-istanbul-reporter',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:@angular-devkit/build-angular',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:npm-run-all',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:tslint',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:prettier',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:cosmiconfig',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:axios',
      },
    ],
    storybook: [
      {
        type: 'implicit',
        source: 'storybook',
        target: 'workspace',
      },
      {
        type: 'implicit',
        source: 'storybook',
        target: 'cypress',
      },
      {
        type: 'static',
        source: 'storybook',
        target: 'npm:@storybook/core',
      },
      {
        type: 'static',
        source: 'storybook',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'storybook',
        target: 'npm:@angular-devkit/architect',
      },
      {
        type: 'static',
        source: 'storybook',
        target: 'npm:@angular-devkit/core',
      },
      {
        type: 'static',
        source: 'storybook',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'storybook',
        target: 'npm:dotenv',
      },
      {
        type: 'static',
        source: 'storybook',
        target: 'npm:@angular-devkit/schematics',
      },
      {
        type: 'static',
        source: 'storybook',
        target: 'npm:@storybook/addon-knobs',
      },
      {
        type: 'static',
        source: 'storybook',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'storybook',
        target: 'npm:typescript',
      },
    ],
    'nx-plugin': [
      {
        type: 'implicit',
        source: 'nx-plugin',
        target: 'workspace',
      },
      {
        type: 'static',
        source: 'nx-plugin',
        target: 'npm:@angular-devkit/architect',
      },
      {
        type: 'static',
        source: 'nx-plugin',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nx-plugin',
        target: 'npm:dotenv',
      },
      {
        type: 'static',
        source: 'nx-plugin',
        target: 'npm:@angular-devkit/core',
      },
      {
        type: 'static',
        source: 'nx-plugin',
        target: 'npm:@angular-devkit/schematics',
      },
      {
        type: 'static',
        source: 'nx-plugin',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'nx-plugin',
        target: 'npm:fs-extra',
      },
    ],
    cypress: [
      {
        type: 'implicit',
        source: 'cypress',
        target: 'workspace',
      },
      {
        type: 'static',
        source: 'cypress',
        target: 'npm:@angular-devkit/architect',
      },
      {
        type: 'static',
        source: 'cypress',
        target: 'npm:@angular-devkit/core',
      },
      {
        type: 'static',
        source: 'cypress',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'cypress',
        target: 'npm:fs-extra',
      },
      {
        type: 'static',
        source: 'cypress',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'cypress',
        target: 'npm:cypress',
      },
      {
        type: 'static',
        source: 'cypress',
        target: 'npm:dotenv',
      },
      {
        type: 'static',
        source: 'cypress',
        target: 'npm:tree-kill',
      },
      {
        type: 'static',
        source: 'cypress',
        target: 'npm:@angular-devkit/schematics',
      },
      {
        type: 'static',
        source: 'cypress',
        target: 'npm:typescript',
      },
      {
        type: 'static',
        source: 'cypress',
        target: 'npm:@cypress/webpack-preprocessor',
      },
      {
        type: 'static',
        source: 'cypress',
        target: 'npm:tsconfig-paths-webpack-plugin',
      },
      {
        type: 'static',
        source: 'cypress',
        target: 'npm:webpack-node-externals',
      },
      {
        type: 'static',
        source: 'cypress',
        target: 'npm:fork-ts-checker-webpack-plugin',
      },
      {
        type: 'static',
        source: 'cypress',
        target: 'npm:@nrwl/cypress',
      },
    ],
    express: [
      {
        type: 'static',
        source: 'express',
        target: 'workspace',
      },
      {
        type: 'implicit',
        source: 'express',
        target: 'node',
      },
      {
        type: 'static',
        source: 'express',
        target: 'npm:@angular-devkit/schematics',
      },
      {
        type: 'static',
        source: 'express',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'express',
        target: 'npm:@angular-devkit/core',
      },
    ],
    angular: [
      {
        type: 'implicit',
        source: 'angular',
        target: 'workspace',
      },
      {
        type: 'implicit',
        source: 'angular',
        target: 'cypress',
      },
      {
        type: 'implicit',
        source: 'angular',
        target: 'jest',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:@angular-devkit/architect',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:@angular-devkit/core',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:@angular/compiler-cli',
      },
      {
        type: 'dynamic',
        source: 'angular',
        target: 'npm:ng-packagr',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:@angular-devkit/schematics',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:semver',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:@ngrx/effects',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:@ngrx/router-store',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:@ngrx/store',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:strip-json-comments',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:typescript',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:karma',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:karma-jasmine',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:karma-chrome-launcher',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:karma-jasmine-html-reporter',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:karma-coverage-istanbul-reporter',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:@angular-devkit/build-angular',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:@angular/platform-browser',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:@angular/platform-browser-dynamic',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:jasmine-marbles',
      },
    ],
    linter: [
      {
        type: 'implicit',
        source: 'linter',
        target: 'workspace',
      },
      {
        type: 'static',
        source: 'linter',
        target: 'npm:@angular-devkit/core',
      },
      {
        type: 'static',
        source: 'linter',
        target: 'npm:@angular-devkit/architect',
      },
      {
        type: 'static',
        source: 'linter',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'dynamic',
        source: 'linter',
        target: 'npm:eslint',
      },
      {
        type: 'static',
        source: 'linter',
        target: 'npm:glob',
      },
      {
        type: 'static',
        source: 'linter',
        target: 'npm:typescript',
      },
      {
        type: 'static',
        source: 'linter',
        target: 'npm:minimatch',
      },
    ],
    react: [
      {
        type: 'implicit',
        source: 'react',
        target: 'workspace',
      },
      {
        type: 'static',
        source: 'react',
        target: 'web',
      },
      {
        type: 'static',
        source: 'react',
        target: 'tao',
      },
      {
        type: 'implicit',
        source: 'react',
        target: 'cypress',
      },
      {
        type: 'implicit',
        source: 'react',
        target: 'jest',
      },
      {
        type: 'static',
        source: 'react',
        target: 'npm:rollup',
      },
      {
        type: 'static',
        source: 'react',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'react',
        target: 'npm:webpack',
      },
      {
        type: 'static',
        source: 'react',
        target: 'npm:@angular-devkit/schematics',
      },
      {
        type: 'static',
        source: 'react',
        target: 'npm:@angular-devkit/core',
      },
      {
        type: 'static',
        source: 'react',
        target: 'npm:ignore',
      },
      {
        type: 'static',
        source: 'react',
        target: 'npm:typescript',
      },
      {
        type: 'static',
        source: 'react',
        target: 'npm:@nrwl/web',
      },
      {
        type: 'static',
        source: 'react',
        target: 'npm:strip-json-comments',
      },
      {
        type: 'static',
        source: 'react',
        target: 'npm:react',
      },
      {
        type: 'static',
        source: 'react',
        target: 'npm:@storybook/addon-knobs',
      },
      {
        type: 'static',
        source: 'react',
        target: 'npm:react-router-dom',
      },
      {
        type: 'static',
        source: 'react',
        target: 'npm:@reduxjs/toolkit',
      },
      {
        type: 'static',
        source: 'react',
        target: 'npm:react-redux',
      },
      {
        type: 'static',
        source: 'react',
        target: 'npm:confusing-browser-globals',
      },
      {
        type: 'static',
        source: 'react',
        target: 'npm:react-dom',
      },
    ],
    bazel: [
      {
        type: 'implicit',
        source: 'bazel',
        target: 'workspace',
      },
      {
        type: 'static',
        source: 'bazel',
        target: 'npm:@angular-devkit/schematics',
      },
      {
        type: 'static',
        source: 'bazel',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'bazel',
        target: 'npm:ignore',
      },
      {
        type: 'static',
        source: 'bazel',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'bazel',
        target: 'npm:@angular-devkit/core',
      },
    ],
    jest: [
      {
        type: 'implicit',
        source: 'jest',
        target: 'workspace',
      },
      {
        type: 'static',
        source: 'jest',
        target: 'npm:typescript',
      },
      {
        type: 'static',
        source: 'jest',
        target: 'npm:@angular-devkit/architect',
      },
      {
        type: 'static',
        source: 'jest',
        target: 'npm:@angular-devkit/core',
      },
      {
        type: 'static',
        source: 'jest',
        target: 'npm:jest',
      },
      {
        type: 'static',
        source: 'jest',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'jest',
        target: 'npm:dotenv',
      },
      {
        type: 'static',
        source: 'jest',
        target: 'npm:@angular-devkit/schematics',
      },
      {
        type: 'static',
        source: 'jest',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'jest',
        target: 'npm:strip-json-comments',
      },
    ],
    node: [
      {
        type: 'implicit',
        source: 'node',
        target: 'workspace',
      },
      {
        type: 'static',
        source: 'node',
        target: 'angular',
      },
      {
        type: 'implicit',
        source: 'node',
        target: 'jest',
      },
      {
        type: 'static',
        source: 'node',
        target: 'npm:@angular-devkit/architect',
      },
      {
        type: 'static',
        source: 'node',
        target: 'npm:@angular-devkit/core',
      },
      {
        type: 'static',
        source: 'node',
        target: 'npm:@angular-devkit/build-webpack',
      },
      {
        type: 'static',
        source: 'node',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'node',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'node',
        target: 'npm:dotenv',
      },
      {
        type: 'static',
        source: 'node',
        target: 'npm:webpack',
      },
      {
        type: 'static',
        source: 'node',
        target: 'npm:tree-kill',
      },
      {
        type: 'static',
        source: 'node',
        target: 'npm:ts-jest',
      },
      {
        type: 'static',
        source: 'node',
        target: 'npm:glob',
      },
      {
        type: 'static',
        source: 'node',
        target: 'npm:fs-extra',
      },
      {
        type: 'static',
        source: 'node',
        target: 'npm:typescript',
      },
      {
        type: 'static',
        source: 'node',
        target: 'npm:@angular-devkit/schematics',
      },
      {
        type: 'static',
        source: 'node',
        target: 'npm:strip-json-comments',
      },
      {
        type: 'static',
        source: 'node',
        target: 'npm:license-webpack-plugin',
      },
      {
        type: 'static',
        source: 'node',
        target: 'npm:copy-webpack-plugin',
      },
      {
        type: 'static',
        source: 'node',
        target: 'npm:tsconfig-paths-webpack-plugin',
      },
      {
        type: 'static',
        source: 'node',
        target: 'npm:webpack-merge',
      },
      {
        type: 'static',
        source: 'node',
        target: 'npm:webpack-node-externals',
      },
    ],
    next: [
      {
        type: 'static',
        source: 'next',
        target: 'workspace',
      },
      {
        type: 'implicit',
        source: 'next',
        target: 'react',
      },
      {
        type: 'static',
        source: 'next',
        target: 'web',
      },
      {
        type: 'static',
        source: 'next',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'next',
        target: 'npm:next',
      },
      {
        type: 'static',
        source: 'next',
        target: 'npm:@angular-devkit/architect',
      },
      {
        type: 'static',
        source: 'next',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'next',
        target: 'npm:dotenv',
      },
      {
        type: 'static',
        source: 'next',
        target: 'npm:express',
      },
      {
        type: 'static',
        source: 'next',
        target: 'npm:@angular-devkit/core',
      },
      {
        type: 'static',
        source: 'next',
        target: 'npm:@angular-devkit/schematics',
      },
      {
        type: 'static',
        source: 'next',
        target: 'npm:tsconfig-paths-webpack-plugin',
      },
      {
        type: 'static',
        source: 'next',
        target: 'npm:webpack',
      },
      {
        type: 'static',
        source: 'next',
        target: 'npm:@nrwl/web',
      },
    ],
    nest: [
      {
        type: 'static',
        source: 'nest',
        target: 'workspace',
      },
      {
        type: 'static',
        source: 'nest',
        target: 'tao',
      },
      {
        type: 'implicit',
        source: 'nest',
        target: 'node',
      },
      {
        type: 'static',
        source: 'nest',
        target: 'npm:@angular-devkit/schematics',
      },
      {
        type: 'static',
        source: 'nest',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'nest',
        target: 'npm:typescript',
      },
      {
        type: 'static',
        source: 'nest',
        target: 'npm:ignore',
      },
      {
        type: 'static',
        source: 'nest',
        target: 'npm:@angular-devkit/core',
      },
      {
        type: 'static',
        source: 'nest',
        target: 'npm:tslint',
      },
      {
        type: 'static',
        source: 'nest',
        target: 'npm:@nestjs/common',
      },
    ],
    'e2e-storybook': [
      {
        type: 'static',
        source: 'e2e-storybook',
        target: 'e2e-utils',
      },
      {
        type: 'implicit',
        source: 'e2e-storybook',
        target: 'storybook',
      },
      {
        type: 'static',
        source: 'e2e-storybook',
        target: 'npm:react',
      },
      {
        type: 'static',
        source: 'e2e-storybook',
        target: 'npm:@storybook/addon-knobs',
      },
      {
        type: 'static',
        source: 'e2e-storybook',
        target: 'npm:@angular/core',
      },
    ],
    'e2e-workspace': [
      {
        type: 'static',
        source: 'e2e-workspace',
        target: 'e2e-utils',
      },
      {
        type: 'implicit',
        source: 'e2e-workspace',
        target: 'workspace',
      },
      {
        type: 'implicit',
        source: 'e2e-workspace',
        target: 'create-nx-workspace',
      },
      {
        type: 'static',
        source: 'e2e-workspace',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'e2e-workspace',
        target: 'npm:react',
      },
      {
        type: 'static',
        source: 'e2e-workspace',
        target: 'npm:react-dom',
      },
    ],
    'e2e-nx-plugin': [
      {
        type: 'static',
        source: 'e2e-nx-plugin',
        target: 'e2e-utils',
      },
      {
        type: 'implicit',
        source: 'e2e-nx-plugin',
        target: 'nx-plugin',
      },
      {
        type: 'implicit',
        source: 'e2e-nx-plugin',
        target: 'create-nx-plugin',
      },
    ],
    tao: [
      {
        type: 'static',
        source: 'tao',
        target: 'npm:@angular-devkit/core',
      },
      {
        type: 'static',
        source: 'tao',
        target: 'npm:@angular-devkit/schematics',
      },
      {
        type: 'static',
        source: 'tao',
        target: 'npm:semver',
      },
      {
        type: 'static',
        source: 'tao',
        target: 'npm:strip-json-comments',
      },
      {
        type: 'static',
        source: 'tao',
        target: 'npm:tmp',
      },
      {
        type: 'static',
        source: 'tao',
        target: 'npm:@angular-devkit/architect',
      },
      {
        type: 'static',
        source: 'tao',
        target: 'npm:@angular-devkit/build-angular',
      },
    ],
    web: [
      {
        type: 'implicit',
        source: 'web',
        target: 'workspace',
      },
      {
        type: 'implicit',
        source: 'web',
        target: 'cypress',
      },
      {
        type: 'implicit',
        source: 'web',
        target: 'jest',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:@angular-devkit/architect',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:@angular-devkit/core',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:@angular-devkit/build-webpack',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:semver',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:webpack',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:opn',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:webpack-dev-server',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:@nrwl/web',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:@rollup/plugin-babel',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:autoprefixer',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:rollup',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:rollup-plugin-peer-deps-external',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:rollup-plugin-local-resolve',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:@rollup/plugin-node-resolve',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:@rollup/plugin-commonjs',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:rollup-plugin-typescript2',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:@rollup/plugin-image',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:rollup-plugin-copy',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:rollup-plugin-postcss',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:rollup-plugin-filesize',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:@angular-devkit/schematics',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:strip-json-comments',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:typescript',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:license-webpack-plugin',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:tsconfig-paths-webpack-plugin',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:copy-webpack-plugin',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:terser-webpack-plugin',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:rimraf',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:webpack-subresource-integrity',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:@angular-devkit/build-optimizer',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:webpack-sources',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:circular-dependency-plugin',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:mini-css-extract-plugin',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:postcss-import',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:sass',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:clean-css',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:loader-utils',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:postcss',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:parse5',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:browserslist',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:caniuse-lite',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:tree-kill',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:babel-loader',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:webpack-merge',
      },
    ],
    cli: [],
    nx: [
      {
        type: 'static',
        source: 'nx',
        target: 'cli',
      },
    ],
    'e2e-angular': [
      {
        type: 'static',
        source: 'e2e-angular',
        target: 'e2e-utils',
      },
      {
        type: 'static',
        source: 'e2e-angular',
        target: 'workspace',
      },
      {
        type: 'implicit',
        source: 'e2e-angular',
        target: 'angular',
      },
      {
        type: 'static',
        source: 'e2e-angular',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'e2e-angular',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'e2e-angular',
        target: 'npm:@angular/common',
      },
    ],
    'e2e-cypress': [
      {
        type: 'static',
        source: 'e2e-cypress',
        target: 'e2e-utils',
      },
      {
        type: 'implicit',
        source: 'e2e-cypress',
        target: 'cypress',
      },
    ],
    'e2e-linter': [
      {
        type: 'static',
        source: 'e2e-linter',
        target: 'e2e-utils',
      },
      {
        type: 'implicit',
        source: 'e2e-linter',
        target: 'linter',
      },
    ],
    'e2e-utils': [
      {
        type: 'static',
        source: 'e2e-utils',
        target: 'npm:fs-extra',
      },
    ],
    'e2e-bazel': [
      {
        type: 'static',
        source: 'e2e-bazel',
        target: 'e2e-utils',
      },
      {
        type: 'implicit',
        source: 'e2e-bazel',
        target: 'bazel',
      },
    ],
    'e2e-react': [
      {
        type: 'static',
        source: 'e2e-react',
        target: 'e2e-utils',
      },
      {
        type: 'static',
        source: 'e2e-react',
        target: 'workspace',
      },
      {
        type: 'implicit',
        source: 'e2e-react',
        target: 'react',
      },
      {
        type: 'static',
        source: 'e2e-react',
        target: 'npm:@nrwl/workspace',
      },
    ],
    'e2e-jest': [
      {
        type: 'static',
        source: 'e2e-jest',
        target: 'e2e-utils',
      },
      {
        type: 'implicit',
        source: 'e2e-jest',
        target: 'jest',
      },
      {
        type: 'static',
        source: 'e2e-jest',
        target: 'npm:@angular-devkit/core',
      },
    ],
    'e2e-next': [
      {
        type: 'static',
        source: 'e2e-next',
        target: 'workspace',
      },
      {
        type: 'static',
        source: 'e2e-next',
        target: 'e2e-utils',
      },
      {
        type: 'implicit',
        source: 'e2e-next',
        target: 'next',
      },
      {
        type: 'static',
        source: 'e2e-next',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'e2e-next',
        target: 'npm:react',
      },
      {
        type: 'static',
        source: 'e2e-next',
        target: 'npm:next',
      },
    ],
    'e2e-node': [
      {
        type: 'static',
        source: 'e2e-node',
        target: 'e2e-utils',
      },
      {
        type: 'implicit',
        source: 'e2e-node',
        target: 'node',
      },
      {
        type: 'static',
        source: 'e2e-node',
        target: 'npm:@angular-devkit/core',
      },
      {
        type: 'static',
        source: 'e2e-node',
        target: 'npm:tree-kill',
      },
      {
        type: 'static',
        source: 'e2e-node',
        target: 'npm:typescript',
      },
    ],
    'e2e-cli': [
      {
        type: 'static',
        source: 'e2e-cli',
        target: 'workspace',
      },
      {
        type: 'static',
        source: 'e2e-cli',
        target: 'e2e-utils',
      },
      {
        type: 'implicit',
        source: 'e2e-cli',
        target: 'cli',
      },
      {
        type: 'static',
        source: 'e2e-cli',
        target: 'npm:@nrwl/workspace',
      },
    ],
    'e2e-web': [
      {
        type: 'static',
        source: 'e2e-web',
        target: 'e2e-utils',
      },
      {
        type: 'implicit',
        source: 'e2e-web',
        target: 'web',
      },
    ],
    'npm:@types/cytoscape': [],
    'npm:cytoscape': [],
    'npm:cytoscape-dagre': [],
    'npm:cytoscape-fcose': [],
    'npm:cytoscape-popper': [],
    'npm:@angular-devkit/architect': [],
    'npm:@angular-devkit/build-angular': [],
    'npm:@angular-devkit/build-ng-packagr': [],
    'npm:@angular-devkit/build-optimizer': [],
    'npm:@angular-devkit/build-webpack': [],
    'npm:@angular-devkit/core': [],
    'npm:@angular-devkit/schematics': [],
    'npm:@angular/cli': [],
    'npm:@angular/common': [],
    'npm:@angular/compiler': [],
    'npm:@angular/compiler-cli': [],
    'npm:@angular/core': [],
    'npm:@angular/forms': [],
    'npm:@angular/platform-browser': [],
    'npm:@angular/platform-browser-dynamic': [],
    'npm:@angular/router': [],
    'npm:@angular/service-worker': [],
    'npm:@angular/upgrade': [],
    'npm:@babel/core': [],
    'npm:@babel/plugin-proposal-class-properties': [],
    'npm:@babel/plugin-proposal-decorators': [],
    'npm:@babel/plugin-transform-regenerator': [],
    'npm:@babel/preset-env': [],
    'npm:@babel/preset-react': [],
    'npm:@babel/preset-typescript': [],
    'npm:@bazel/bazel': [],
    'npm:@bazel/ibazel': [],
    'npm:@cypress/webpack-preprocessor': [],
    'npm:@nestjs/common': [],
    'npm:@nestjs/core': [],
    'npm:@nestjs/platform-express': [],
    'npm:@nestjs/schematics': [],
    'npm:@nestjs/testing': [],
    'npm:@ngrx/effects': [],
    'npm:@ngrx/entity': [],
    'npm:@ngrx/router-store': [],
    'npm:@ngrx/schematics': [],
    'npm:@ngrx/store': [],
    'npm:@ngrx/store-devtools': [],
    'npm:@ngtools/webpack': [],
    'npm:@nrwl/cypress': [],
    'npm:@nrwl/eslint-plugin-nx': [],
    'npm:@nrwl/jest': [],
    'npm:@nrwl/node': [],
    'npm:@nrwl/nx-cloud': [],
    'npm:@nrwl/web': [],
    'npm:@nrwl/workspace': [],
    'npm:@reduxjs/toolkit': [],
    'npm:@rollup/plugin-babel': [],
    'npm:@rollup/plugin-commonjs': [],
    'npm:@rollup/plugin-image': [],
    'npm:@rollup/plugin-node-resolve': [],
    'npm:@schematics/angular': [],
    'npm:@storybook/addon-knobs': [],
    'npm:@storybook/angular': [],
    'npm:@storybook/core': [],
    'npm:@storybook/react': [],
    'npm:@svgr/webpack': [],
    'npm:@testing-library/react': [],
    'npm:@types/copy-webpack-plugin': [],
    'npm:@types/d3': [],
    'npm:@types/eslint': [],
    'npm:@types/express': [],
    'npm:@types/fs-extra': [],
    'npm:@types/jasmine': [],
    'npm:@types/jasminewd2': [],
    'npm:@types/jest': [],
    'npm:@types/node': [],
    'npm:@types/prettier': [],
    'npm:@types/react': [],
    'npm:@types/react-dom': [],
    'npm:@types/react-redux': [],
    'npm:@types/react-router-dom': [],
    'npm:@types/webpack': [],
    'npm:@types/yargs': [],
    'npm:@typescript-eslint/eslint-plugin': [],
    'npm:@typescript-eslint/experimental-utils': [],
    'npm:@typescript-eslint/parser': [],
    'npm:@zeit/next-css': [],
    'npm:@zeit/next-less': [],
    'npm:@zeit/next-sass': [],
    'npm:@zeit/next-stylus': [],
    'npm:ajv': [],
    'npm:angular': [],
    'npm:app-root-path': [],
    'npm:autoprefixer': [],
    'npm:axios': [],
    'npm:babel-loader': [],
    'npm:babel-plugin-const-enum': [],
    'npm:babel-plugin-emotion': [],
    'npm:babel-plugin-macros': [],
    'npm:babel-plugin-styled-components': [],
    'npm:babel-plugin-transform-async-to-promises': [],
    'npm:browserslist': [],
    'npm:cacache': [],
    'npm:caniuse-lite': [],
    'npm:circular-dependency-plugin': [],
    'npm:clean-css': [],
    'npm:codelyzer': [],
    'npm:commitizen': [],
    'npm:confusing-browser-globals': [],
    'npm:conventional-changelog-cli': [],
    'npm:copy-webpack-plugin': [],
    'npm:core-js': [],
    'npm:cosmiconfig': [],
    'npm:css-loader': [],
    'npm:cypress': [],
    'npm:cz-conventional-changelog': [],
    'npm:cz-customizable': [],
    'npm:d3': [],
    'npm:d3-zoom': [],
    'npm:dagre-d3': [],
    'npm:document-register-element': [],
    'npm:dotenv': [],
    'npm:eslint': [],
    'npm:eslint-config-prettier': [],
    'npm:eslint-plugin-cypress': [],
    'npm:eslint-plugin-import': [],
    'npm:eslint-plugin-jsx-a11y': [],
    'npm:eslint-plugin-react': [],
    'npm:eslint-plugin-react-hooks': [],
    'npm:express': [],
    'npm:file-loader': [],
    'npm:find-cache-dir': [],
    'npm:flat': [],
    'npm:fork-ts-checker-webpack-plugin': [],
    'npm:fs-extra': [],
    'npm:glob': [],
    'npm:html-webpack-plugin': [],
    'npm:husky': [],
    'npm:identity-obj-proxy': [],
    'npm:ignore': [],
    'npm:import-fresh': [],
    'npm:jasmine-core': [],
    'npm:jasmine-marbles': [],
    'npm:jasmine-spec-reporter': [],
    'npm:jest': [],
    'npm:jest-preset-angular': [],
    'npm:karma': [],
    'npm:karma-chrome-launcher': [],
    'npm:karma-coverage-istanbul-reporter': [],
    'npm:karma-jasmine': [],
    'npm:karma-jasmine-html-reporter': [],
    'npm:karma-source-map-support': [],
    'npm:karma-webpack': [],
    'npm:less': [],
    'npm:less-loader': [],
    'npm:license-webpack-plugin': [],
    'npm:loader-utils': [],
    'npm:memfs': [],
    'npm:mime': [],
    'npm:mini-css-extract-plugin': [],
    'npm:minimatch': [],
    'npm:next': [],
    'npm:ng-packagr': [],
    'npm:ngrx-store-freeze': [],
    'npm:npm-run-all': [],
    'npm:open': [],
    'npm:opn': [],
    'npm:parse5': [],
    'npm:postcss': [],
    'npm:postcss-import': [],
    'npm:postcss-loader': [],
    'npm:precise-commits': [],
    'npm:prettier': [],
    'npm:pretty-quick': [],
    'npm:protractor': [],
    'npm:raw-loader': [],
    'npm:react': [],
    'npm:react-dom': [],
    'npm:react-redux': [],
    'npm:react-router-dom': [],
    'npm:regenerator-runtime': [],
    'npm:release-it': [],
    'npm:rimraf': [],
    'npm:rollup': [],
    'npm:rollup-plugin-copy': [],
    'npm:rollup-plugin-filesize': [],
    'npm:rollup-plugin-local-resolve': [],
    'npm:rollup-plugin-peer-deps-external': [],
    'npm:rollup-plugin-postcss': [],
    'npm:rollup-plugin-typescript2': [],
    'npm:rxjs': [],
    'npm:sass': [],
    'npm:sass-loader': [],
    'npm:semver': [],
    'npm:shelljs': [],
    'npm:source-map': [],
    'npm:source-map-loader': [],
    'npm:source-map-support': [],
    'npm:speed-measure-webpack-plugin': [],
    'npm:strip-json-comments': [],
    'npm:style-loader': [],
    'npm:styled-components': [],
    'npm:stylus': [],
    'npm:stylus-loader': [],
    'npm:tar': [],
    'npm:terser': [],
    'npm:terser-webpack-plugin': [],
    'npm:tippy.js': [],
    'npm:tmp': [],
    'npm:tree-kill': [],
    'npm:ts-jest': [],
    'npm:ts-loader': [],
    'npm:ts-node': [],
    'npm:tsconfig-paths-webpack-plugin': [],
    'npm:tsickle': [],
    'npm:tslib': [],
    'npm:tslint': [],
    'npm:typescript': [],
    'npm:url-loader': [],
    'npm:verdaccio': [],
    'npm:webpack': [],
    'npm:webpack-dev-middleware': [],
    'npm:webpack-dev-server': [],
    'npm:webpack-merge': [],
    'npm:webpack-node-externals': [],
    'npm:webpack-sources': [],
    'npm:webpack-subresource-integrity': [],
    'npm:worker-plugin': [],
    'npm:yargs': [],
    'npm:zone.js': [],
  },
};
