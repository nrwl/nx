import { ProjectGraphCache } from '@nrwl/workspace';

export const nxWorkspaceLayout = {
  libsDir: '',
  appsDir: '',
};

export const nxGraph: ProjectGraphCache = {
  version: '2.0',
  rootFiles: [
    {
      file: 'package.json',
      hash: '189ee4a044f28c79e55a94ce0e35d7f779042ece',
      ext: '.json',
    },
    {
      file: 'workspace.json',
      hash: '262cd90a6bd25e0094fed4f8f490e5c20104df23',
      ext: '.json',
    },
    {
      file: 'nx.json',
      hash: '27bc6db4ee0132ef6a4106b0934728dc3700cc73',
      ext: '.json',
    },
    {
      file: 'tsconfig.base.json',
      hash: 'ec6b8f9554d437208748bf74b3fd345df41cf69a',
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
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/create-nx-workspace/jest.config.js',
              passWithNoTests: true,
            },
            outputs: ['coverage/packages/create-nx-workspace'],
          },
          'build-base': {
            executor: '@nrwl/node:package',
            options: {
              outputPath: 'build/packages/create-nx-workspace',
              tsConfig: 'packages/create-nx-workspace/tsconfig.lib.json',
              packageJson: 'packages/create-nx-workspace/package.json',
              main: 'packages/create-nx-workspace/bin/create-nx-workspace.ts',
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
                {
                  input: 'packages/create-nx-workspace',
                  glob: '**/*.d.ts',
                  output: '/',
                },
                'LICENSE',
              ],
            },
            outputs: ['{options.outputPath}'],
          },
          build: {
            executor: '@nrwl/workspace:run-commands',
            outputs: ['build/packages/create-nx-workspace'],
            options: {
              commands: [
                {
                  command: 'nx build-base create-nx-workspace',
                },
                {
                  command:
                    'node ./scripts/chmod build/packages/create-nx-workspace/bin/create-nx-workspace.js',
                },
                {
                  command: 'node ./scripts/copy-readme.js create-nx-workspace',
                },
              ],
              parallel: false,
            },
          },
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'packages/create-nx-workspace/**/*.ts',
                'packages/create-nx-workspace/**/*.spec.ts',
                'packages/create-nx-workspace/**/*_spec.ts',
                'packages/create-nx-workspace/**/*.spec.tsx',
                'packages/create-nx-workspace/**/*.spec.js',
                'packages/create-nx-workspace/**/*.spec.jsx',
                'packages/create-nx-workspace/**/*.d.ts',
              ],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/create-nx-workspace/.eslintrc.json',
            hash: 'b195b75f3631f7ba3c006b97856e866bc1a6e1d5',
            ext: '.json',
          },
          {
            file: 'packages/create-nx-workspace/bin/create-nx-workspace.ts',
            hash: 'f21d344276a423eb1ab8cbe7abe91fefe454914f',
            ext: '.ts',
          },
          {
            file: 'packages/create-nx-workspace/bin/output.ts',
            hash: 'fc56181ff2c7252e3de3d868631843769aa889fd',
            ext: '.ts',
          },
          {
            file: 'packages/create-nx-workspace/bin/package-manager.ts',
            hash: 'c39c5259827b49c64bf78abab158f33d46fb0225',
            ext: '.ts',
          },
          {
            file: 'packages/create-nx-workspace/bin/shared.ts',
            hash: '01335313d85f4548042198d785b9505cd55d3dc1',
            ext: '.ts',
          },
          {
            file: 'packages/create-nx-workspace/jest.config.js',
            hash: '79062ca7209a59ff3a25bda3ceabbd6e93fedf3a',
            ext: '.js',
          },
          {
            file: 'packages/create-nx-workspace/package.json',
            hash: 'aea6b6de0b0f69bf508eea4dd72b2a78fd14b4e9',
            ext: '.json',
          },
          {
            file: 'packages/create-nx-workspace/README.md',
            hash: 'f05ebf083f115cb1e957ad412ec166e8fa7bb1aa',
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
    'nx-dev-data-access-documents': {
      name: 'nx-dev-data-access-documents',
      type: 'lib',
      data: {
        root: 'nx-dev/data-access-documents',
        sourceRoot: 'nx-dev/data-access-documents/src',
        projectType: 'library',
        targets: {
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: ['nx-dev/data-access-documents/**/*.ts'],
            },
          },
          test: {
            executor: '@nrwl/jest:jest',
            outputs: ['coverage/nx-dev/data-access-documents'],
            options: {
              jestConfig: 'nx-dev/data-access-documents/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        tags: ['scope:nx-dev', 'type:data-access'],
        files: [
          {
            file: 'nx-dev/data-access-documents/.babelrc',
            hash: '0cae4a9a81270d6cf3315436f594bf2fbd4fb3e2',
            ext: '',
          },
          {
            file: 'nx-dev/data-access-documents/.eslintrc.json',
            hash: 'ee27ad3f41e2389828a51869c0c816087df303a7',
            ext: '.json',
          },
          {
            file: 'nx-dev/data-access-documents/jest.config.js',
            hash: 'f962ebf495d5c5ec275c105d1e00cbeccc55b716',
            ext: '.js',
          },
          {
            file: 'nx-dev/data-access-documents/README.md',
            hash: '5ae32a3856ae3e18b800a065cc42f0526b6e93db',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-angular/builders/ng-packagr-lite.md',
            hash: 'c03f75dee5e3178a80db8bd994cb0c8d9f4a59bb',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-angular/builders/package.md',
            hash: '506a5054cecdd10ff4a55882a3b15e9a4971aea5',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-angular/builders/webpack-browser.md',
            hash: '4fd34e498cd85b6506ceb656c157c8dfa9262354',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-angular/schematics/application.md',
            hash: '21d84d5a9ed0d57e46522d8629fda2f08cd23b91',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-angular/schematics/downgrade-module.md',
            hash: 'bf61edc6e0a516b8cef4dc3589c18fbef6a7499f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-angular/schematics/karma-project.md',
            hash: '437525907fccfd807fc390049e2b571ecd7791f4',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-angular/schematics/karma.md',
            hash: '60e8a1287f6690c45bd9169d6c28a3e96340f92c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-angular/schematics/library.md',
            hash: '2bef93086bebfab8528211cc1300f7e3965f3709',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-angular/schematics/move.md',
            hash: '194b230d652705ec93ee44d48e7392af21004425',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-angular/schematics/ngrx.md',
            hash: '2b80efe29efcefa7bd8805f7d79b840a650c0369',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-angular/schematics/stories.md',
            hash: 'f78a30e2a5b2c407da702eff38d2dd12c9c11f7a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-angular/schematics/storybook-configuration.md',
            hash: '22c0c2f577521a0af94d675fccc0b7d30e2d3347',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-angular/schematics/upgrade-module.md',
            hash: '5ef0b737053c380a340aa7ec78c73b708f6e9fbe',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-cypress/builders/cypress.md',
            hash: 'c940e55be12269b913b11f4f2374e987566074e8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-express/schematics/application.md',
            hash: 'fa4f5a0ae5589d0d2601b6f9d568625c8331e4a8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-jest/builders/jest.md',
            hash: 'beca0edde661ea11012cc260ac074b5aee625629',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-linter/builders/eslint.md',
            hash: '0886f1080d03d6d888f5f33bd3785889681d0848',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-linter/builders/lint.md',
            hash: 'ebe4e1a3ff1533e51e4960d9c2046044150dc939',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-nest/schematics/application.md',
            hash: 'a8033843a30abe4c566f5f7516029f606c98cc8b',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-nest/schematics/class.md',
            hash: '60eed0c9defc6c9c79e95c509d26f61789dd6028',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-nest/schematics/controller.md',
            hash: '34196e0344dc0531108ba564bc69784d3a6a4b37',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-nest/schematics/decorator.md',
            hash: '91251f6129fafea6a60cbf385d9808a78062901f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-nest/schematics/filter.md',
            hash: 'e9fdd2d25f15f1fddb741dd42989535b2d5a9994',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-nest/schematics/gateway.md',
            hash: '17337b131037df028cea417d662d97e09e9c23eb',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-nest/schematics/guard.md',
            hash: '957a74659561bcf1438ef815289bb6c5feaea7aa',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-nest/schematics/interceptor.md',
            hash: '7fe958dbe35ad5b18c6f7232b7e80833e4652b49',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-nest/schematics/interface.md',
            hash: '3d3caeeb6aba0ba4f73ed4c4b7526b969054d8cf',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-nest/schematics/library.md',
            hash: '378edce0f3eb638f868677c68374054f94d986bb',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-nest/schematics/middleware.md',
            hash: 'f0bbc032b30480a32982748b05cbab0955275135',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-nest/schematics/module.md',
            hash: 'fadf38a320b0ddfe68bdc2f433e872a90bfef3b7',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-nest/schematics/pipe.md',
            hash: 'aa4f795996bdec0c7e36a2f44123e6513cda18cb',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-nest/schematics/provider.md',
            hash: 'aeec1a7e37412445bbc9626d8cddee75dc6ce1b6',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-nest/schematics/resolver.md',
            hash: '11f796c62251f9ef39d64ff45b454d694caf6743',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-nest/schematics/service.md',
            hash: '64eba5d6dcad61915e391b3b9f50793fe64ef7fc',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-next/builders/build.md',
            hash: 'c1c48a58cbc10c635870aa45086d725430a24425',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-next/builders/export.md',
            hash: '830302d8b3e776a91e090feb936e403a7149d2a5',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-next/builders/server.md',
            hash: '8f0510f26198eda5f6cd5ce1cc579f423f18adfd',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-next/schematics/application.md',
            hash: '1edfc0e6473b23b5e81a6aed8aa6bab9e97250b0',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-next/schematics/component.md',
            hash: 'a15559d721943911a55e7858f641dbff5eb6efb6',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-next/schematics/page.md',
            hash: '913c30ad4934aa86870e2c58196720f0219339f5',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-node/builders/build.md',
            hash: '219d41f303e6b9f8a224606f2cbe47ffeaff9970',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-node/builders/execute.md',
            hash: '73f1a5c3f0ae982251211dc53bbf778dd7d403a1',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-node/builders/package.md',
            hash: '1799dcda7b8b9b73b4049ce2f34e99fb117b5d04',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-node/schematics/application.md',
            hash: 'e5beb3332a374a2f1e6c335bd6326522dbdb351a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-node/schematics/library.md',
            hash: '40b589c3f7818547498ba86b31aaae5d8d5bc1ff',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-nx-plugin/builders/e2e.md',
            hash: '816558d0d0bbf8e2d8981e5c2a73c0f00a597b0e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-nx-plugin/schematics/builder.md',
            hash: '834d5e6a0ea05366b93de07ba1ccf441783a9b86',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-nx-plugin/schematics/migration.md',
            hash: 'c3d3a9d3a8f30fd4addebdc2abaaab7e749efd8b',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-nx-plugin/schematics/plugin.md',
            hash: '656fff8080cec6a0c61832206959d39f60404d27',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-nx-plugin/schematics/schematic.md',
            hash: '926215122b89e8d01b3bada51fef1d6fd55cdd3e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-react/schematics/application.md',
            hash: '1c545946a636090d79037497ffb339bed9936343',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-react/schematics/component-cypress-spec.md',
            hash: '5496c40fdeee21f15d910f7e840b09b52123b69e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-react/schematics/component-story.md',
            hash: '9dc2d510afcafcc73b4ecd24131b885c4b4b5bf6',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-react/schematics/component.md',
            hash: 'e0734c9b23f2a879eaf663acd11ff99746541c59',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-react/schematics/library.md',
            hash: '247ca157507b7dae3f1981ab49b0245004d0012b',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-react/schematics/redux.md',
            hash: '762c61dba7d32beec8a2da9757947c9ae2db1459',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-react/schematics/stories.md',
            hash: '27511a4e981e6bd2a00a99521f04f0c72086b26a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-react/schematics/storybook-configuration.md',
            hash: '3d7b940a94456e2a2321c3513bad21256d594839',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-storybook/builders/build.md',
            hash: '6d16ae6db7ac8bb6e4ccfbb03a9d0dea75588922',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-storybook/builders/storybook.md',
            hash: '58f6cd165b65e0759909497a77adc4ed76ece3fb',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-storybook/schematics/configuration.md',
            hash: '85424203c18da2c47919c914175106c5b620f9a8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-storybook/schematics/cypress-project.md',
            hash: '2c41f37dd5e4c659a8bd98bda01a89ef41d16e7b',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-web/builders/build.md',
            hash: 'be67fd7ff7cb619dc38def55da9654d0d0e9112e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-web/builders/dev-server.md',
            hash: 'ed4a0bc4617c9e4a3f8a1e056a0da468c32eaad9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-web/builders/package.md',
            hash: 'fcb94cbf4fbb104fe1d9009016a111c9f9e96dfb',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-web/schematics/application.md',
            hash: 'c7954c442c21307be42a32d33a9e86256183a02f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-workspace/builders/run-commands.md',
            hash: 'c10a295449a114bdb8935eb22f56deb6d9c19c08',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-workspace/schematics/library.md',
            hash: '08cbd36929ee5b5fd4fa6d6018a62c2ae3b1b0a5',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-workspace/schematics/move.md',
            hash: '8f330cc62bf7a0dcbe883d229e6329cbdb4eabff',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-workspace/schematics/remove.md',
            hash: 'c641affde7249e934963f448bd79db900b703368',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-workspace/schematics/run-commands.md',
            hash: 'aece6f40fe1a63524d345321ceeb0703ef2324e5',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/api-workspace/schematics/workspace-schematic.md',
            hash: '48d2b6607b0a1a689633b111e62016071e984a08',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/builders.json',
            hash: '722846ec085f8420adb3aa54cda733c6e96ccb92',
            ext: '.json',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/cli/affected-apps.md',
            hash: 'a3a0b085a39c5e362f89291a7cb5c89cabe16c36',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/cli/affected-build.md',
            hash: '76dc8d0795571a2d58f58f617e286b50c49a8617',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/cli/affected-dep-graph.md',
            hash: '1f5311aa42f3571d220bf1c55db4510593ce996c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/cli/affected-e2e.md',
            hash: 'f6a95185629148021f272b0d9cdcaf389d93f466',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/cli/affected-libs.md',
            hash: 'f9648615be93795227bfff5fe13482e06568cee8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/cli/affected-lint.md',
            hash: 'ebf0491368d705d043d5425d561e14938d8e2d02',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/cli/affected-test.md',
            hash: '663ec95368de8e696d50052f380f20524aa5a372',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/cli/affected.md',
            hash: '874b43a5c60fdb471a492652a41d25c42670a605',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/cli/build.md',
            hash: '8a398ba7e32adf7dc0c39005b4b081b9a2070033',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/cli/dep-graph.md',
            hash: '7de42387d7c42fe19b3f64fee70dff2e53931f41',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/cli/e2e.md',
            hash: '1fdb16dc1bb845214d8fb86074d9955074f53ad1',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/cli/format-check.md',
            hash: '8582f2a9a592b9bd296ffe988dd69fe25f8d0aca',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/cli/format-write.md',
            hash: '356fdf198afcca9674d99ff797bc0d8f05e21973',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/cli/generate.md',
            hash: '033fcfd871d6cac1bed56b688d48d87a072292af',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/cli/lint.md',
            hash: '19efd0e2af38aaa58ed144a10632755a6f37ffba',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/cli/list.md',
            hash: '09742dbc9bbd99276f5f8d24c800c9f5be12d500',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/cli/migrate.md',
            hash: '2fcd07191768eb2427a02877ade11b9c264f81b5',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/cli/print-affected.md',
            hash: '1ac11d2fd80e57e08f41883035e7ba54d7bed1c9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/cli/report.md',
            hash: '0d7c3480d5a028a13d8da43f34d0fd699bd58c55',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/cli/run-many.md',
            hash: '11f33191055c1d7132fb46f5618fa34bd098a654',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/cli/run.md',
            hash: '87df36051c3f52d5577a7f1c59424f6b9fd0b9d2',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/cli/serve.md',
            hash: '6a87bc97767eb44b8e44b868a4f0b08c826378b4',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/cli/test.md',
            hash: '84d7e9db8662dd4775f841ebd3a07d7743d0ad09',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/cli/workspace-lint.md',
            hash: 'd3eeca5b2b9c13b8f18eea24cfcb8c2bcf6829f9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/cli/workspace-schematic.md',
            hash: '1935090762ef64b71d4d5c44e5e5b6eaafdfbfbf',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/examples/apollo-angular.md',
            hash: 'c6818acd7f008d9fca6b1f451682755afefa5090',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/examples/react-affected.png',
            hash: 'e1dd4042dd12e46bb23fe26781c469db2460b021',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/examples/react-affected2.png',
            hash: '3d8f870b9377d708c56b77a4a889b24ffa3628a7',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/examples/react-and-angular.md',
            hash: '5539ef330d8c40c0af350f79f83cad5d7e1f2de4',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/examples/react-dep-graph.png',
            hash: '81f04e46326bc57d1ae87a7a5896a3d9ef8e1638',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/examples/react-serve.png',
            hash: 'b73ca2038a61a7915a20721ec775e925baf0ff8e',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/getting-started/advanced-nx-workspace-course.png',
            hash: 'bf8a9f31fe3679f3f5f9d535da0735170299b095',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/getting-started/create-workspace.gif',
            hash: '85a97af73b29af9a4476e2b3d4d22ec1a1b05eca',
            ext: '.gif',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/getting-started/dep-graph.png',
            hash: '0cc9c65cdf9c81eba3d30cd09979f818d74a7260',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/getting-started/nx-and-cli.md',
            hash: 'da560808b667d4beace6fdf1db574bf152fb59af',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/getting-started/resources.md',
            hash: '3558206cb45425a9ccda114eaf00cfe6c494150b',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/getting-started/why-nx.md',
            hash: '57865b754bc18eda488888df473133136b70d2d3',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/guides/cli-overview.md',
            hash: 'd92ffe5c1fa7df736d6d2d6ae458d3aee059f207',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/guides/configuration.md',
            hash: '324f992babd08ce1df6b8a34d515e69ba267d317',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/guides/misc-data-persistence.md',
            hash: 'd5f0bdd266f4b5c8fe4a04c48e50eaa7ebae290d',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/guides/misc-ngrx.md',
            hash: '784b1e43fae2a43d7ace7088e8565947277468f9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/guides/misc-upgrade.md',
            hash: 'b840a290289cb524c65176422e39526d69a52bc9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/guides/modern-angular/karma-to-jest.md',
            hash: 'b0eb35a6181d8b40527a2b5ac3932d820a757e90',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/guides/modern-angular/protractor-to-cypress.md',
            hash: '6e7b179a52008c9b2c9d2ebbe2c289b897f5a19c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/guides/nx7-to-nx8.md',
            hash: '3e9095160947bb7b56deb905e5dcf7447a4b701d',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/guides/running-custom-commands.md',
            hash: '2afa6f986713d1a0964cca9ae06348768380917f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/guides/storybook-plugin.md',
            hash: '19ad7dcfe736d913a4bb588e5aeee7e6bfcc1a55',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/guides/update.md',
            hash: '4e4723273ce668d64ab8ce4c7da42d803e4b3253',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/migration/migration-angular.md',
            hash: '60bf3d20dcab9d7500286e006a6a120e0967af6f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/migration/migration-angularjs-unit-tests-passing.png',
            hash: '53414ab08cb6659ac6e5506f9c351ad343075064',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/migration/migration-angularjs.md',
            hash: '4938946027f304eabb4385eff92f9f60b29da027',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/schematics.json',
            hash: 'ae621ac6e860b926f344bdfa4e92498d24335626',
            ext: '.json',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/tutorial/01-create-application.md',
            hash: 'd28468eb0ebf086f84988be95744903e90fb0980',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/tutorial/02-add-e2e-test.md',
            hash: '34e3541ab5bc80595019fdb84b28feb6248cd025',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/tutorial/03-display-todos.md',
            hash: '6eb024640fd8252f2edfd82145647bad61908952',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/tutorial/04-connect-to-api.md',
            hash: '0f23ed8b792ca8ffa4b985d4cd6f8f0fc948fc8d',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/tutorial/05-add-node-app.md',
            hash: '1f09cba585569763a966de223bf0230acff3b8e3',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/tutorial/06-proxy.md',
            hash: '4dc74e5fb217dfc2d30c0195d4e4c9cfe8a94d3d',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/tutorial/07-share-code.md',
            hash: '86ae8e3be1e787bc8d3a69aab0ee5297188861b7',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/tutorial/08-create-libs.md',
            hash: '3b81fc4295484270bbd7af9f995685f7e432d985',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/tutorial/09-dep-graph.md',
            hash: '483db717f2bc7d176f9fd5d7ed3032068f4774ce',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/tutorial/10-computation-caching.md',
            hash: '370220478c581c7e4023c801d1b3ad18b5beccf4',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/tutorial/11-test-affected-projects.md',
            hash: 'c0d2c34ed4b52dbe220b2de4bd5bd2d4e3edfe78',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/angular/tutorial/12-summary.md',
            hash: 'c16ce711ac86bfb12395615bd58ef9d7e1e1c59e',
            ext: '.md',
          },
          {
            file: 'nx-dev/data-access-documents/src/data/10.4.13/builders.json',
            hash: 'd147d35dea142344dcbb2293d49a1deb84b0c150',
            ext: '.json',
          },
          {
            file: 'nx-dev/data-access-documents/src/data/10.4.13/map.json',
            hash: '1cba380bf4f850456f06a995683613076344dde2',
            ext: '.json',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-angular/builders/ng-packagr-lite.md',
            hash: '7e7f576f2efb17a1418cdfdb1fb663ed643349ed',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-angular/builders/package.md',
            hash: '67a6e8615644bfa9444a172ae38fae1717e0f7ab',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-angular/builders/webpack-browser.md',
            hash: '0ce26b763ed55bf601607a6baf5380fdc08613c7',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-angular/schematics/application.md',
            hash: 'a895bddf451b6eb7ab046a5fa8688c5dcd75720c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-angular/schematics/downgrade-module.md',
            hash: '83a9b97974fe9935ef5c28006ed169a59870bf6e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-angular/schematics/karma-project.md',
            hash: 'fb87bebaa393c4bb4fad7084ca641f7ce4d52c2e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-angular/schematics/karma.md',
            hash: 'fa41a5fe4654fb7ad89178f38aa0399cdf728ce8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-angular/schematics/library.md',
            hash: 'fb756b7a75d580565464f9e5882e8057c69b4ad8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-angular/schematics/move.md',
            hash: '835e09dc50248f26bcda8063c497288294b1ecc0',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-angular/schematics/ngrx.md',
            hash: '9d4a0f23dc962452ee656e011b884afeb40927d0',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-angular/schematics/stories.md',
            hash: '2c028bd6326b268e55f2d816634be33cd5296342',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-angular/schematics/storybook-configuration.md',
            hash: '59170f1310d6f1397e918da18d87afc752fe8d3f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-angular/schematics/upgrade-module.md',
            hash: '093f05de0159d531029aa9ed04372527bb069598',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-cypress/builders/cypress.md',
            hash: '00f4aed94a63dce6ae71f3f6578a0949db9c6d07',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-express/schematics/application.md',
            hash: 'c801960e6a9fa878fa1b9048256f30327c0d3fd9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-jest/builders/jest.md',
            hash: '78e065f5ca9aed03149876354ee357087a8d9203',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-linter/builders/eslint.md',
            hash: 'd1ecf361584fe955ebfc63c90d2c67d28a7b084e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-linter/builders/lint.md',
            hash: 'c8e382a1d4ee750d98360b00ba50fbc66b3d96d9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-nest/schematics/application.md',
            hash: 'cca4d44354a4b5c0ed3f15a4f8e4e4bf4ce6ab87',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-nest/schematics/class.md',
            hash: '919d78f9ccad6a202f0cb5003859ed3298df204d',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-nest/schematics/controller.md',
            hash: '6d876ec3eeaa5e1318d638d2413b6b18c5036f34',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-nest/schematics/decorator.md',
            hash: '30c763bfe182f09705aa315e077eb82e66e3347d',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-nest/schematics/filter.md',
            hash: '574c0bb7faf8d9b86e0addc1b0d2f1544cb410ce',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-nest/schematics/gateway.md',
            hash: '0c84025bedeeac4d0b0dec53180462559db7cea4',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-nest/schematics/guard.md',
            hash: '07c00cac00c85b4ac3d8496d5b89dfcc78c2dd1c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-nest/schematics/interceptor.md',
            hash: 'ba3aff009eed789c473930c5649f6dec46c22cc2',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-nest/schematics/interface.md',
            hash: '6392eb510c6f1f5d8238d03c4675b54d2c186728',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-nest/schematics/library.md',
            hash: '5a96b01c79745f21acb2015b7bf598fa9e7e6f52',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-nest/schematics/middleware.md',
            hash: '8f4f48344e3202eea4b303e2115fe828491be209',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-nest/schematics/module.md',
            hash: '9d36d9e18e69258365b438977779c4ceea41c0d0',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-nest/schematics/pipe.md',
            hash: '49992338e207fdb76d916b1a15356a43a7794d18',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-nest/schematics/provider.md',
            hash: '6ea1995f14867cb1904edfc7c68008fd666b447a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-nest/schematics/resolver.md',
            hash: '35a7bf480c4703a30166f5d314efdf3a73c45638',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-nest/schematics/service.md',
            hash: '78da4067aa39ce928c0ef54865e76aeb622d9e45',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-next/builders/build.md',
            hash: 'c3ebe5d4eed25494edb4aa98545e099ceee9a397',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-next/builders/export.md',
            hash: '37d3d14e2f8604488b76ef464f3595901d4f41b2',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-next/builders/server.md',
            hash: '7076eb98972781c41314d32a2f887151d0d23e90',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-next/schematics/application.md',
            hash: 'ec0c74b2b2d13fe12c7c05ab51e41c3ec29b687f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-next/schematics/component.md',
            hash: 'bb6cffb91e6be7eae2b7a9fc01952bfd6710746a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-next/schematics/page.md',
            hash: '82ca21954ec0bc5b4b550a5d4e7613f17865b1fb',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-node/builders/build.md',
            hash: '907e79a73dd4364bd43f876b5c0e5692e9f3bad0',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-node/builders/execute.md',
            hash: 'b08dfb613498cb0a2ea633d23eb4e42f8022b791',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-node/builders/package.md',
            hash: 'ff12624f41107dcab8f2a50fc8f5da88ac072d71',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-node/schematics/application.md',
            hash: '5ed7f18cd4ed742c398c36317989093b4caa0bfe',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-node/schematics/library.md',
            hash: '1320501c10bb346fa104a9aaa4702679e477d894',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-nx-plugin/builders/e2e.md',
            hash: '0cf587ff28f1f8e3fbc94b172da18335e650f286',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-nx-plugin/schematics/builder.md',
            hash: '63c86c4e429366c6d76a319dbba774477390eca3',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-nx-plugin/schematics/migration.md',
            hash: 'd8ebce862a794715a51b6c14aa26ee4cc4ccf907',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-nx-plugin/schematics/plugin.md',
            hash: 'f7bce6c1ba9c7b43537de336d709a3689d222a21',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-nx-plugin/schematics/schematic.md',
            hash: 'dd34d31cdc0e733163fd23971d3f55e8214edf83',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-react/schematics/application.md',
            hash: '305c382e5dce08f33f42fe4b60de89bcc1d2164a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-react/schematics/component-cypress-spec.md',
            hash: '58b52f635add7eb9e407d871168912b0fc3d0e19',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-react/schematics/component-story.md',
            hash: '35ef6ced9c08a07ad07f7863536859522c2c7620',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-react/schematics/component.md',
            hash: '8fe208e4ec679fe7ab87485db7032024961368c9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-react/schematics/library.md',
            hash: '81cf8a607f4621bf13ed35f9fb1e418910d2769b',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-react/schematics/redux.md',
            hash: 'cda1e636d6ca2673a5d13c483c297415fc889dec',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-react/schematics/stories.md',
            hash: '69ae7ee3934bb7c26517cf6ffbbda1f7ed3c7b57',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-react/schematics/storybook-configuration.md',
            hash: 'd5a59afb476fa8ec1f27ebcfa29edfe38d08809f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-storybook/builders/build.md',
            hash: '163d3882c5130bab148b0001b900c65cccd071e3',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-storybook/builders/storybook.md',
            hash: '6be3b85997947faf142e2b95ce3ddf047f83b51e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-storybook/schematics/configuration.md',
            hash: '65eb7bc7c67a487d08d5e568627b58d65a245f10',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-storybook/schematics/cypress-project.md',
            hash: 'ed108f43ac61bf669f2a1b767f8ab32521e271cd',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-web/builders/build.md',
            hash: 'f59e8910eefb9a2a02a2f276577b82f0668519b0',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-web/builders/dev-server.md',
            hash: '96c14732a0153cac125ed167cd932578b4d8deee',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-web/builders/package.md',
            hash: 'a1ce5b616d5a442f6d0738ca671a16b09822cbfb',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-web/schematics/application.md',
            hash: '914d89a1c55d253ab5cee98d660fb02700247455',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-workspace/builders/run-commands.md',
            hash: '5ab1354885383437d32820154a9584f387fe0db2',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-workspace/schematics/library.md',
            hash: '681c06659f82c91396bfcbcfca84626e473d63f6',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-workspace/schematics/move.md',
            hash: '8f7f38a34e9e52cf9c6a44be55a2af777c60a025',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-workspace/schematics/remove.md',
            hash: 'a83d2779386b7e72a93db5f8629d60babe6bd5d8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-workspace/schematics/run-commands.md',
            hash: '6ab77cfeba3eea0c74db1d448744068513490df5',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/api-workspace/schematics/workspace-schematic.md',
            hash: 'd90b6755c4a0b765c039310911df27b5c8f46d86',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/builders.json',
            hash: '722846ec085f8420adb3aa54cda733c6e96ccb92',
            ext: '.json',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/cli/affected-apps.md',
            hash: 'a3a0b085a39c5e362f89291a7cb5c89cabe16c36',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/cli/affected-build.md',
            hash: '76dc8d0795571a2d58f58f617e286b50c49a8617',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/cli/affected-dep-graph.md',
            hash: '1f5311aa42f3571d220bf1c55db4510593ce996c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/cli/affected-e2e.md',
            hash: 'f6a95185629148021f272b0d9cdcaf389d93f466',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/cli/affected-libs.md',
            hash: 'f9648615be93795227bfff5fe13482e06568cee8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/cli/affected-lint.md',
            hash: 'ebf0491368d705d043d5425d561e14938d8e2d02',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/cli/affected-test.md',
            hash: '663ec95368de8e696d50052f380f20524aa5a372',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/cli/affected.md',
            hash: '874b43a5c60fdb471a492652a41d25c42670a605',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/cli/build.md',
            hash: '8a398ba7e32adf7dc0c39005b4b081b9a2070033',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/cli/dep-graph.md',
            hash: '7de42387d7c42fe19b3f64fee70dff2e53931f41',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/cli/e2e.md',
            hash: '1fdb16dc1bb845214d8fb86074d9955074f53ad1',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/cli/format-check.md',
            hash: '8582f2a9a592b9bd296ffe988dd69fe25f8d0aca',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/cli/format-write.md',
            hash: '356fdf198afcca9674d99ff797bc0d8f05e21973',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/cli/generate.md',
            hash: '033fcfd871d6cac1bed56b688d48d87a072292af',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/cli/lint.md',
            hash: '19efd0e2af38aaa58ed144a10632755a6f37ffba',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/cli/list.md',
            hash: '09742dbc9bbd99276f5f8d24c800c9f5be12d500',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/cli/migrate.md',
            hash: '2fcd07191768eb2427a02877ade11b9c264f81b5',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/cli/print-affected.md',
            hash: '1ac11d2fd80e57e08f41883035e7ba54d7bed1c9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/cli/report.md',
            hash: '0d7c3480d5a028a13d8da43f34d0fd699bd58c55',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/cli/run-many.md',
            hash: '11f33191055c1d7132fb46f5618fa34bd098a654',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/cli/run.md',
            hash: '87df36051c3f52d5577a7f1c59424f6b9fd0b9d2',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/cli/serve.md',
            hash: '6a87bc97767eb44b8e44b868a4f0b08c826378b4',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/cli/test.md',
            hash: '84d7e9db8662dd4775f841ebd3a07d7743d0ad09',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/cli/workspace-lint.md',
            hash: 'd3eeca5b2b9c13b8f18eea24cfcb8c2bcf6829f9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/cli/workspace-schematic.md',
            hash: '1935090762ef64b71d4d5c44e5e5b6eaafdfbfbf',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/getting-started/advanced-nx-workspace-course.png',
            hash: 'bf8a9f31fe3679f3f5f9d535da0735170299b095',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/getting-started/resources.md',
            hash: 'aff14c088ba679e28984d37be34b17435d03d9ec',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/getting-started/why-nx.md',
            hash: '55fc46217e6d0591e7a857b43dc9e3a979ba4f46',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/guides/cli-overview.md',
            hash: 'd74b4a436cff00f4c632ddb2cc8309952c0c32c7',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/guides/configuration.md',
            hash: '4b44b8039c8275323d30b9512a77c5a942485f4c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/schematics.json',
            hash: 'ae621ac6e860b926f344bdfa4e92498d24335626',
            ext: '.json',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/tutorial/01-create-application.md',
            hash: '619991a46d79982d26f6628b593116ac5ad80962',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/tutorial/02-display-todos.md',
            hash: '3b145b56c676a70a003a90c6fb345ebf43136ce3',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/tutorial/03-share-code.md',
            hash: '2cc3410e8376c35cad9f0a6786790c426af0bb76',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/tutorial/04-create-libs.md',
            hash: '8e341993a977fc5be1658ccfebc54e9325515e0a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/tutorial/05-dep-graph.md',
            hash: '3047bedf2defce51c2801cf988e6611ccbf80395',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/tutorial/06-computation-caching.md',
            hash: '52431ba20301afe839bf4f75b0ce03ec3a75f7ec',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/tutorial/07-test-affected-projects.md',
            hash: '15833a3df8b941e29a0dffd6320a67d2abf8f5b8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/node/tutorial/08-summary.md',
            hash: '9af8abcb5c59c4fd72aa0e1dc4972de8c182d297',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-angular/builders/ng-packagr-lite.md',
            hash: '667a7b33abdd18ab7601efcd9b7fe86a0525bced',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-angular/builders/package.md',
            hash: '3d66db032615641cfd582515cdc71812ff19cfc2',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-angular/builders/webpack-browser.md',
            hash: '4efbc5a16eee1be86a94df6ff1b06da7cfc25182',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-angular/schematics/application.md',
            hash: 'a895bddf451b6eb7ab046a5fa8688c5dcd75720c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-angular/schematics/downgrade-module.md',
            hash: '83a9b97974fe9935ef5c28006ed169a59870bf6e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-angular/schematics/karma-project.md',
            hash: 'fb87bebaa393c4bb4fad7084ca641f7ce4d52c2e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-angular/schematics/karma.md',
            hash: 'fa41a5fe4654fb7ad89178f38aa0399cdf728ce8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-angular/schematics/library.md',
            hash: 'fb756b7a75d580565464f9e5882e8057c69b4ad8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-angular/schematics/move.md',
            hash: '835e09dc50248f26bcda8063c497288294b1ecc0',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-angular/schematics/ngrx.md',
            hash: '9d4a0f23dc962452ee656e011b884afeb40927d0',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-angular/schematics/stories.md',
            hash: '2c028bd6326b268e55f2d816634be33cd5296342',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-angular/schematics/storybook-configuration.md',
            hash: '59170f1310d6f1397e918da18d87afc752fe8d3f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-angular/schematics/upgrade-module.md',
            hash: '093f05de0159d531029aa9ed04372527bb069598',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-cypress/builders/cypress.md',
            hash: '7442d5d345c4e19ef4f80a4d2eb74e38999a55f9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-express/schematics/application.md',
            hash: 'c801960e6a9fa878fa1b9048256f30327c0d3fd9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-jest/builders/jest.md',
            hash: 'db8bcb0e4ea63fc69bcd9991c63f9745ea8c5545',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-linter/builders/eslint.md',
            hash: 'a2af8e391b8f98bbc1bcff7417b8a5dab5da03fd',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-linter/builders/lint.md',
            hash: '199f5123b0cbfcea009b3e7c23b242acd9a67ce8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-nest/schematics/application.md',
            hash: 'cca4d44354a4b5c0ed3f15a4f8e4e4bf4ce6ab87',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-nest/schematics/class.md',
            hash: '919d78f9ccad6a202f0cb5003859ed3298df204d',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-nest/schematics/controller.md',
            hash: '6d876ec3eeaa5e1318d638d2413b6b18c5036f34',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-nest/schematics/decorator.md',
            hash: '30c763bfe182f09705aa315e077eb82e66e3347d',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-nest/schematics/filter.md',
            hash: '574c0bb7faf8d9b86e0addc1b0d2f1544cb410ce',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-nest/schematics/gateway.md',
            hash: '0c84025bedeeac4d0b0dec53180462559db7cea4',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-nest/schematics/guard.md',
            hash: '07c00cac00c85b4ac3d8496d5b89dfcc78c2dd1c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-nest/schematics/interceptor.md',
            hash: 'ba3aff009eed789c473930c5649f6dec46c22cc2',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-nest/schematics/interface.md',
            hash: '6392eb510c6f1f5d8238d03c4675b54d2c186728',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-nest/schematics/library.md',
            hash: '5a96b01c79745f21acb2015b7bf598fa9e7e6f52',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-nest/schematics/middleware.md',
            hash: '8f4f48344e3202eea4b303e2115fe828491be209',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-nest/schematics/module.md',
            hash: '9d36d9e18e69258365b438977779c4ceea41c0d0',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-nest/schematics/pipe.md',
            hash: '49992338e207fdb76d916b1a15356a43a7794d18',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-nest/schematics/provider.md',
            hash: '6ea1995f14867cb1904edfc7c68008fd666b447a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-nest/schematics/resolver.md',
            hash: '35a7bf480c4703a30166f5d314efdf3a73c45638',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-nest/schematics/service.md',
            hash: '78da4067aa39ce928c0ef54865e76aeb622d9e45',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-next/builders/build.md',
            hash: 'f3b464f2659ec8679cedbdf4f704d2528d8accc1',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-next/builders/export.md',
            hash: 'e6885d3740c5f19e4d7d13a4742c9418c04a61be',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-next/builders/server.md',
            hash: '095e48e2d722f6b053b301a979500d96a1e3a011',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-next/schematics/application.md',
            hash: 'ec0c74b2b2d13fe12c7c05ab51e41c3ec29b687f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-next/schematics/component.md',
            hash: 'bb6cffb91e6be7eae2b7a9fc01952bfd6710746a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-next/schematics/page.md',
            hash: '82ca21954ec0bc5b4b550a5d4e7613f17865b1fb',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-node/builders/build.md',
            hash: '0ca8edc43c6bce90c5c12fcb8d2483902e6aabb8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-node/builders/execute.md',
            hash: '142e72e3f7385b1828dee0322b73956260d3c7ae',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-node/builders/package.md',
            hash: 'bb47b3db6d71f61d461a6208e72f933bd276a5a3',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-node/schematics/application.md',
            hash: '5ed7f18cd4ed742c398c36317989093b4caa0bfe',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-node/schematics/library.md',
            hash: '1320501c10bb346fa104a9aaa4702679e477d894',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-nx-plugin/builders/e2e.md',
            hash: '326849b24bb4ba33ffe01595b3de37991ee49a13',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-nx-plugin/schematics/builder.md',
            hash: '63c86c4e429366c6d76a319dbba774477390eca3',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-nx-plugin/schematics/migration.md',
            hash: 'd8ebce862a794715a51b6c14aa26ee4cc4ccf907',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-nx-plugin/schematics/plugin.md',
            hash: 'f7bce6c1ba9c7b43537de336d709a3689d222a21',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-nx-plugin/schematics/schematic.md',
            hash: 'dd34d31cdc0e733163fd23971d3f55e8214edf83',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-react/schematics/application.md',
            hash: '305c382e5dce08f33f42fe4b60de89bcc1d2164a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-react/schematics/component-cypress-spec.md',
            hash: '58b52f635add7eb9e407d871168912b0fc3d0e19',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-react/schematics/component-story.md',
            hash: '35ef6ced9c08a07ad07f7863536859522c2c7620',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-react/schematics/component.md',
            hash: '8fe208e4ec679fe7ab87485db7032024961368c9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-react/schematics/library.md',
            hash: '81cf8a607f4621bf13ed35f9fb1e418910d2769b',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-react/schematics/redux.md',
            hash: 'cda1e636d6ca2673a5d13c483c297415fc889dec',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-react/schematics/stories.md',
            hash: '69ae7ee3934bb7c26517cf6ffbbda1f7ed3c7b57',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-react/schematics/storybook-configuration.md',
            hash: 'd5a59afb476fa8ec1f27ebcfa29edfe38d08809f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-storybook/builders/build.md',
            hash: '05648b03786f5541ad8346969b9f11d8e52d0b7c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-storybook/builders/storybook.md',
            hash: 'cbe82db0236cd7435ea69424d3697a241b9953bd',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-storybook/schematics/configuration.md',
            hash: '65eb7bc7c67a487d08d5e568627b58d65a245f10',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-storybook/schematics/cypress-project.md',
            hash: 'ed108f43ac61bf669f2a1b767f8ab32521e271cd',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-web/builders/build.md',
            hash: '787193fec8813266085e215ffd6beef58168747e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-web/builders/dev-server.md',
            hash: 'e9479059e30dd913c7f51b170ad5abba77e96c12',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-web/builders/package.md',
            hash: '726ee5cf4f3a81039caddda34765171c15323374',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-web/schematics/application.md',
            hash: '914d89a1c55d253ab5cee98d660fb02700247455',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-workspace/builders/run-commands.md',
            hash: 'b8bed6f2f8ba44811b63c1fb86e06af5893ee22e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-workspace/schematics/library.md',
            hash: '681c06659f82c91396bfcbcfca84626e473d63f6',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-workspace/schematics/move.md',
            hash: '8f7f38a34e9e52cf9c6a44be55a2af777c60a025',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-workspace/schematics/remove.md',
            hash: 'a83d2779386b7e72a93db5f8629d60babe6bd5d8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-workspace/schematics/run-commands.md',
            hash: '6ab77cfeba3eea0c74db1d448744068513490df5',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/api-workspace/schematics/workspace-schematic.md',
            hash: 'd90b6755c4a0b765c039310911df27b5c8f46d86',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/builders.json',
            hash: '722846ec085f8420adb3aa54cda733c6e96ccb92',
            ext: '.json',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/cli/affected-apps.md',
            hash: 'a3a0b085a39c5e362f89291a7cb5c89cabe16c36',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/cli/affected-build.md',
            hash: '76dc8d0795571a2d58f58f617e286b50c49a8617',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/cli/affected-dep-graph.md',
            hash: '1f5311aa42f3571d220bf1c55db4510593ce996c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/cli/affected-e2e.md',
            hash: 'f6a95185629148021f272b0d9cdcaf389d93f466',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/cli/affected-libs.md',
            hash: 'f9648615be93795227bfff5fe13482e06568cee8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/cli/affected-lint.md',
            hash: 'ebf0491368d705d043d5425d561e14938d8e2d02',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/cli/affected-test.md',
            hash: '663ec95368de8e696d50052f380f20524aa5a372',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/cli/affected.md',
            hash: '874b43a5c60fdb471a492652a41d25c42670a605',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/cli/build.md',
            hash: '8a398ba7e32adf7dc0c39005b4b081b9a2070033',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/cli/dep-graph.md',
            hash: '7de42387d7c42fe19b3f64fee70dff2e53931f41',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/cli/e2e.md',
            hash: '1fdb16dc1bb845214d8fb86074d9955074f53ad1',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/cli/format-check.md',
            hash: '8582f2a9a592b9bd296ffe988dd69fe25f8d0aca',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/cli/format-write.md',
            hash: '356fdf198afcca9674d99ff797bc0d8f05e21973',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/cli/generate.md',
            hash: '033fcfd871d6cac1bed56b688d48d87a072292af',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/cli/lint.md',
            hash: '19efd0e2af38aaa58ed144a10632755a6f37ffba',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/cli/list.md',
            hash: '09742dbc9bbd99276f5f8d24c800c9f5be12d500',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/cli/migrate.md',
            hash: '2fcd07191768eb2427a02877ade11b9c264f81b5',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/cli/print-affected.md',
            hash: '1ac11d2fd80e57e08f41883035e7ba54d7bed1c9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/cli/report.md',
            hash: '0d7c3480d5a028a13d8da43f34d0fd699bd58c55',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/cli/run-many.md',
            hash: '11f33191055c1d7132fb46f5618fa34bd098a654',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/cli/run.md',
            hash: '87df36051c3f52d5577a7f1c59424f6b9fd0b9d2',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/cli/serve.md',
            hash: '6a87bc97767eb44b8e44b868a4f0b08c826378b4',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/cli/test.md',
            hash: '84d7e9db8662dd4775f841ebd3a07d7743d0ad09',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/cli/workspace-lint.md',
            hash: 'd3eeca5b2b9c13b8f18eea24cfcb8c2bcf6829f9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/cli/workspace-schematic.md',
            hash: '1935090762ef64b71d4d5c44e5e5b6eaafdfbfbf',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/examples/apollo-react.md',
            hash: 'e3aa0cbe281e21faac3a6dbae4d628a3f2ce595d',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/examples/react-nx.md',
            hash: '3f638680f1f5b26789fea48d7bdb9ed88827f5a8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/getting-started/advanced-nx-workspace-course.png',
            hash: 'bf8a9f31fe3679f3f5f9d535da0735170299b095',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/getting-started/resources.md',
            hash: 'aff14c088ba679e28984d37be34b17435d03d9ec',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/getting-started/why-nx.md',
            hash: '55fc46217e6d0591e7a857b43dc9e3a979ba4f46',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/guides/adding-assets.md',
            hash: 'a4e9ffb83749f379dc2b2beedbf772367930f455',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/guides/cli-overview.md',
            hash: '82a94514c7faa042523f7910c5ee08435b74306d',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/guides/configuration.md',
            hash: '35c9ee8d021e8ec4736de1a06fb194911d91fef3',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/guides/environment-variables.md',
            hash: 'aa9997a750b00acaf029d76226c19ebf2bfb4357',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/guides/js-and-ts.md',
            hash: 'f0c6f9e601a5a1db6e0fad3996c9d34676cf0837',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/guides/nextjs.md',
            hash: '9ee11a36be0a9c052f8e97a8023c2ebb62977bc9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/guides/storybook-plugin.md',
            hash: 'acb33081d6bdf8dff0a0bf49b62df769b3abc103',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/migration/migration-cra.md',
            hash: '2c12a78e6c61edda1329797df12a0b127c4eee51',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/schematics.json',
            hash: 'ae621ac6e860b926f344bdfa4e92498d24335626',
            ext: '.json',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/tutorial/01-create-application.md',
            hash: 'a9a45cb74b509a8e4ae562c8fae9abe3fbb71a6f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/tutorial/02-add-e2e-test.md',
            hash: '9c463ba69a2012363b7ddb26563f4d6ae7ea1b74',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/tutorial/03-display-todos.md',
            hash: 'd6ea9189b346f0cb26942ecadf01f6d46e79b366',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/tutorial/04-connect-to-api.md',
            hash: '28dc8bfae5bad651ca1839a7e8fe6a35c3046b82',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/tutorial/05-add-node-app.md',
            hash: 'cb6f78073f12bf6ff3d3b133857d591c4ab0bdb6',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/tutorial/06-proxy.md',
            hash: 'bb7d649bc147c993f4b13070571e930d148999b9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/tutorial/07-share-code.md',
            hash: '8edece892a4774d245c8c1bda56c5448b947fc4f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/tutorial/08-create-libs.md',
            hash: '48e1c79bbc297f9f6cf96c1e76d026060c450a85',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/tutorial/09-dep-graph.md',
            hash: '3fb1e8812873a70c0ef1b5b61ba9b8e69e147907',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/tutorial/10-computation-caching.md',
            hash: '3bb4d233422c8c87be13736e9714317c50f1b482',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/tutorial/11-test-affected-projects.md',
            hash: 'bdfb4147ae3e0678207948c8e039e9da1662959c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/react/tutorial/12-summary.md',
            hash: 'eea36de8f00d5465cf2954edf0c7d160a7929997',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/affected.png',
            hash: '4437f9a8e397a98ea7d99b2d929be360a51313c8',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/all-cache-inputs.png',
            hash: 'e7e5bd839e7ccb4acc4221dce66952db6cad85e1',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/angular-plugin.md',
            hash: 'db1d1312c30a6dfa73d3f5674e30b9c5f2079ff9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/api/angular.jpg',
            hash: 'f03bf78a3bd15e5bfeb925922ad94c41e5203009',
            ext: '.jpg',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/api/cypress.jpg',
            hash: '7727bf6d734549eeca678de9c870f3b4072698e5',
            ext: '.jpg',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/api/express.jpg',
            hash: 'f55f7f0783d2ec9373b90e66be944eac48bb4bb8',
            ext: '.jpg',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/api/jest.jpg',
            hash: 'd7ce915a2ad472df19f77de8437d7edc330d665c',
            ext: '.jpg',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/api/nest.jpg',
            hash: '9e02b1e3dde3433378881993c520c9d65688a9ea',
            ext: '.jpg',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/api/node.jpg',
            hash: '7003802217e825012068684547d7d5e30badd775',
            ext: '.jpg',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/api/react.jpg',
            hash: 'e534bd5b242a8a5ed55c8d02851dd7c4d86ac3ba',
            ext: '.jpg',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/api/web.jpg',
            hash: 'd92cea331c6bd8d4453e5311ca30b43c0a77fe0a',
            ext: '.jpg',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/caching-example.png',
            hash: '026252539a044e6b3312df9e6065d97c168f8f49',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/ci-graph-everything-affected.png',
            hash: '95ea861c4ea747b8fad48d765b45384ce63f0223',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/ci-graph-one-affected.png',
            hash: '1eb5a4c166942cd3b03be920b5b71959d2583359',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/ci-graph.png',
            hash: '94138839eac7b5de9928acb243ab9c5c22f378c3',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/cli/build.md',
            hash: '8a398ba7e32adf7dc0c39005b4b081b9a2070033',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/cli/e2e.md',
            hash: '1fdb16dc1bb845214d8fb86074d9955074f53ad1',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/cli/generate.md',
            hash: '033fcfd871d6cac1bed56b688d48d87a072292af',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/cli/lint.md',
            hash: '19efd0e2af38aaa58ed144a10632755a6f37ffba',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/cli/run.md',
            hash: '87df36051c3f52d5577a7f1c59424f6b9fd0b9d2',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/cli/serve.md',
            hash: '6a87bc97767eb44b8e44b868a4f0b08c826378b4',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/cli/test.md',
            hash: '84d7e9db8662dd4775f841ebd3a07d7743d0ad09',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/computation-caching.md',
            hash: 'ad15e517a8ad1e6305968800caf1495826a3f31f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/console.md',
            hash: 'bf20ceaf23970286ab83b706507204559cf79515',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/continue-light.svg',
            hash: '2563bfa114bef1fefe582096bfd1095f44a4f6c4',
            ext: '.svg',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/cypress-logo.png',
            hash: '6553e4a03ef1554df37beca19e24c10a10c2c71a',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/cypress-plugin.md',
            hash: '0e6ed455409a1b78c429841d24ca9e045c937dc0',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/dependency-graph.png',
            hash: '7c187112fb9f4b32b4ba88088638438ac9b97381',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/distributed-builds.md',
            hash: '2788c8fd29deb4855cbd98af99a931f3d54c91ac',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/examples/nx-examples.md',
            hash: 'fc01b6336758215afb8dcbc13583aa4afa6a0a8b',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/express-plugin.md',
            hash: '997e2fbb7a959a238b792c5bcdc9adaf6f640520',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/folder-light.svg',
            hash: '8daecdac6a358b5d789ed6e6f02dee0b4c7a48c3',
            ext: '.svg',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/guides/browser-support.md',
            hash: '1dba1fbc7d3ae86715e7286fee104c0fa728d36b',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/incremental-builds.md',
            hash: 'dde79502493b83bcc6622d3058d0831fc6290fdb',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/jest-logo.png',
            hash: 'ac0c0f5e4429a5ce6b6f1c66bf62040b36e5794c',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/jest-plugin.md',
            hash: 'a85dc68adbb057509173e5bd87f396b03e16ad77',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/migration/overview.md',
            hash: '36a7d1bf6bc9da5c0e3bc498a7ccd2bbe80fde4b',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/migration/preserving-git-histories.md',
            hash: '761db22841dff7992413668a32b2d5e1389ec439',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/monorepo-affected.md',
            hash: '6ef0f1e58cfed5bf0150909aaf4894dc4734aea1',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/monorepo-ci-azure.md',
            hash: '464c20fa734b1188a30867f5e182227bcb9d1748',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/monorepo-ci-jenkins.md',
            hash: '3b31d0fc1958dc5d57bc7ef518972d193e02db2b',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/monorepo-nx-enterprise.md',
            hash: '483214ac368a8f8e9a701d169ce0b831acc4aa4e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/monorepo-tags.md',
            hash: '526f0b53c2e86e34f393ada77e4ffdff959babd2',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/nest-logo.png',
            hash: 'f1e27035310756193211911a74cdf39d4c6376b5',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/nest-plugin.md',
            hash: '091d39ce89f04190e99eb732bc04ad9e5dc81d7f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/next-plugin.md',
            hash: 'e4fd1c38fcb4d85c5f5d075abe525ba2ffa11b38',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/node-plugin.md',
            hash: 'e57256327e2557f6bfed1c7d1a61f73590042f83',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/nx-console-logo.png',
            hash: '11d0c0758fd20321bdda24886f3fd573092fc5ac',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/nx-console-screenshot.png',
            hash: '0a444ee0d5d93eac2c3f18f35ba2e91b3c4b4ff4',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/nx-plugin.md',
            hash: '3d45c48ebb7a67d23f43ad875e3723b9b0c86584',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/plugins-overview.md',
            hash: '3ea5f1fff7f9737696d965ed183f2864cc26240a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/prettier-logo.png',
            hash: '59bb947f29431ccf142c1ed2f520aa747c38541a',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/react-plugin.md',
            hash: '3d45b88a7eb4d3e175d9c2ed649d87ffeed208b2',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/refresh-light.svg',
            hash: 'e0345748192eeb97633b33feb5cd8997a98c9edc',
            ext: '.svg',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/running-custom-commands.md',
            hash: '4ea8f7ce32ea03db8bff49bce1aae696de6ced67',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/storybook-logo.png',
            hash: '9201193134c0f94a842c4f929b9c23f62060e0d1',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/tools-workspace-builders.md',
            hash: '8d2aa069e395e005fc96cfebe77a1afe42ee386c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/tools-workspace-schematics.md',
            hash: '36a8e3fdd9166bebbc14220e92feb4e32f0d2f96',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/update.md',
            hash: '702770be2f5802e9d46410d2a844af0a78a6d74a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/using-builders.md',
            hash: 'b5cb842a23baa4454ad613edd0e6180d2275ef67',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/using-schematics.md',
            hash: 'cbef5bb9286199f1283191cc18babc1ca4f4b571',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/vscode-schematics-debug.png',
            hash: '57efd4b6c15012e816df353cd1bc33c08a189116',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/web-plugin.md',
            hash: 'fe698f59aae63d7deed27bb230ac3bf72aae0f20',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/workspace-overview.md',
            hash: 'bb9ec7c2f41ee2b74d665a393b04736cd98203b8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/workspace-plugin.md',
            hash: '3529e62980033c3dfdd5af83ec3ef1afcd9c59d5',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/workspace/buildable-and-publishable-libraries.md',
            hash: 'f149f2eac7489967dc1c37fd8dba5cdc6bf9e3a4',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/workspace/creating-libraries.md',
            hash: '3cd6c16c57ccdbab8b5ea4aaa75c2976e4a647a4',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/workspace/grouping-libraries.md',
            hash: 'c844995610063be710fd18e758c35e5feb290613',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/workspace/library-types.md',
            hash: '1182992056416592ef53c866da92e0bb37dcb222',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/10.4.13/shared/workspace/structure/dependency-graph.md',
            hash: '9c352090b1045f8723bfb1d58563e5e0aae9f568',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-angular/executors/ng-packagr-lite.md',
            hash: '050bf6e3111fff2db9c1a7417dfce4aaaf7f167c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-angular/executors/package.md',
            hash: '2981a96842ecc1fd9ce8ad8b966087bd553dacae',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-angular/executors/webpack-browser.md',
            hash: 'a153abbc7c6a16e2506416bcdf0cde3dfa2427eb',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-angular/generators/application.md',
            hash: '91d225fbd677b9117786945365f0e4f70a707c7a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-angular/generators/downgrade-module.md',
            hash: 'bf61edc6e0a516b8cef4dc3589c18fbef6a7499f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-angular/generators/karma-project.md',
            hash: '437525907fccfd807fc390049e2b571ecd7791f4',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-angular/generators/karma.md',
            hash: '60e8a1287f6690c45bd9169d6c28a3e96340f92c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-angular/generators/library.md',
            hash: 'ee1c4809fc7af3328d834d9a712c2c1c1e244f1c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-angular/generators/move.md',
            hash: '8619f74ca3d9f794be6128ed91439473fa2e569c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-angular/generators/ngrx.md',
            hash: '2b80efe29efcefa7bd8805f7d79b840a650c0369',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-angular/generators/stories.md',
            hash: 'eb917cdf600f5a18b03bda4f5b6c77bb04a9ed3e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-angular/generators/storybook-configuration.md',
            hash: '395e3800eb9da88467a3d78244ee2dfb05991911',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-angular/generators/storybook-migrate-defaults-5-to-6.md',
            hash: 'db5fa1d5fd46cc209be0b076bfbe6f99d0e6f9ac',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-angular/generators/upgrade-module.md',
            hash: '5ef0b737053c380a340aa7ec78c73b708f6e9fbe',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-cypress/executors/cypress.md',
            hash: '5f0ac9c1ecce20eee23bc7623ee03d27e276e26a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-express/generators/application.md',
            hash: 'fa4f5a0ae5589d0d2601b6f9d568625c8331e4a8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-gatsby/executors/build.md',
            hash: '1e7af3c1701fec3d7b27db4b86c9663beda4d203',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-gatsby/executors/server.md',
            hash: '9fea830c4dfa7af56e4497eac876ec46870ca70c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-gatsby/generators/application.md',
            hash: '6378fe7a59f9133bc463a2f1b287aab57a4a7b08',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-gatsby/generators/component.md',
            hash: '58421410b8681dfbb01781c6f989fbfa78afd015',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-gatsby/generators/page.md',
            hash: 'f188dae08ddec307a26c053f7e1d97ed08cd6343',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-jest/executors/jest.md',
            hash: '8c3482cd4b30e0cc70a6bcedb24f96db2414569c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-linter/executors/eslint.md',
            hash: '30b5a4989b601e498dc7d41f3fa1cf171a18e9f8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-linter/executors/lint.md',
            hash: '24da827c26fc63867088390878a6453338dae552',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-nest/generators/application.md',
            hash: 'a8033843a30abe4c566f5f7516029f606c98cc8b',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-nest/generators/class.md',
            hash: '7e17ad9c6ad0dc4c5ea4448f4a855d4ddece04a2',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-nest/generators/controller.md',
            hash: 'f712c2aae2c7f51229c9486979b88cad3097483f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-nest/generators/decorator.md',
            hash: 'cc261f485a47260f578ff7b12d39b41348f58b2f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-nest/generators/filter.md',
            hash: '7436e2a376b640cbb3de2c1fbae5cfcf25120052',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-nest/generators/gateway.md',
            hash: 'cd342690512359699b7e138f89859d6875ebd792',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-nest/generators/guard.md',
            hash: '62dc698b6c28f7cb48d37eea1df4334aecb05d6c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-nest/generators/interceptor.md',
            hash: 'd6bfc25455af476ae1ddfbf56e0f35cee50acb23',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-nest/generators/interface.md',
            hash: 'eb7aadeefa5c54b2af9d1f1cfdd066e722c89db6',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-nest/generators/library.md',
            hash: '7c114d270259703167fb94a3cca3f5864d31972f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-nest/generators/middleware.md',
            hash: '5bf8afa0d92682ea0eef4752e04e8525d02ddf1a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-nest/generators/module.md',
            hash: '906e7bcb36899ccb0f518d73490e710198fb5fce',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-nest/generators/pipe.md',
            hash: 'e12a91f0455ec966526a78eb094d9e8f6a6ea58f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-nest/generators/provider.md',
            hash: '292cb7f4ae6e36720d7b023da0f3a37cf934eae6',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-nest/generators/resolver.md',
            hash: '09b7c8b3f82ad83fb017a98d6735c6a65ee9707e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-nest/generators/service.md',
            hash: '34731ea8628175d351670ce5c572470eccee1add',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-next/executors/build.md',
            hash: '7c3d168a2a4333f583042c25ce1ef92492e8746f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-next/executors/export.md',
            hash: '3bbc6787cbc8e397b2828aa8cdd9234413f7c288',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-next/executors/server.md',
            hash: '94641914c99a7938f1de00908606734433ba2f6b',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-next/generators/application.md',
            hash: 'ac0a2d21b6471555cb094d267c398ba9aade6062',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-next/generators/component.md',
            hash: 'a15559d721943911a55e7858f641dbff5eb6efb6',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-next/generators/page.md',
            hash: '913c30ad4934aa86870e2c58196720f0219339f5',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-node/executors/build.md',
            hash: '462c61069ee2c2785515525cd7eda2f378c44d79',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-node/executors/execute.md',
            hash: '44fe9a5277fef7204e94cf9f37e5d2645e2b61ba',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-node/executors/package.md',
            hash: '25b0a23e17a6fed75ce20712b80f9c5c1fc99b2b',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-node/generators/application.md',
            hash: 'e5beb3332a374a2f1e6c335bd6326522dbdb351a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-node/generators/library.md',
            hash: 'ae4f7d96b27be0bff084381123daed62dd030a25',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-nx-plugin/executors/e2e.md',
            hash: '6a30dc4b9bee149f4f10f6260d2ac6f504042229',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-nx-plugin/generators/executor.md',
            hash: 'eb3f4bd5e02c944af62e173e36019f3292698132',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-nx-plugin/generators/generator.md',
            hash: 'c1c905fe15b079d7be4e55d688c1e9eae33510a6',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-nx-plugin/generators/migration.md',
            hash: '4b0efe5cbc0cc8912ff41a3b8ce488089bf20e14',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-nx-plugin/generators/plugin.md',
            hash: '656fff8080cec6a0c61832206959d39f60404d27',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-react/generators/application.md',
            hash: '54ff079d1a29c533e2a46e5309ca94058d63e5ff',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-react/generators/component-cypress-spec.md',
            hash: '5496c40fdeee21f15d910f7e840b09b52123b69e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-react/generators/component-story.md',
            hash: '9dc2d510afcafcc73b4ecd24131b885c4b4b5bf6',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-react/generators/component.md',
            hash: '8868ee5e75b0da40972fe45de93081dbba642d40',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-react/generators/library.md',
            hash: '1a81920fc572f6a01d157d132e9d6f4d684843a0',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-react/generators/redux.md',
            hash: '762c61dba7d32beec8a2da9757947c9ae2db1459',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-react/generators/stories.md',
            hash: '986574e2f602699fe9cf96d2a562473d33edb839',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-react/generators/storybook-configuration.md',
            hash: '6733d5691d73fd87a13f648883eaa1eb50d743f7',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-react/generators/storybook-migrate-defaults-5-to-6.md',
            hash: 'fdccfaff0b9ad132f9b649f09ae5a83c076b81d0',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-storybook/executors/build.md',
            hash: '15d9ae88d290e5ffa59998f820257461b68083b2',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-storybook/executors/storybook.md',
            hash: '43d622c83c6ec57876bd3959377f245169adf63f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-storybook/generators/configuration.md',
            hash: 'e6e78485df9a0e28b6ee8a7513090598d3966165',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-storybook/generators/cypress-project.md',
            hash: 'd6a486edc38b0b40df1428530aa8aa914342e329',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-storybook/generators/migrate-defaults-5-to-6.md',
            hash: '7ec95f19c7cf6ce4ff808f973e7f482543ca32cc',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-web/executors/build.md',
            hash: '2b28fd9e929e2916be19ac84f2d8c4fe0c7e18d6',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-web/executors/dev-server.md',
            hash: 'e53943a8508ba1c9761d6b0c8456dfd0a93ebdbd',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-web/executors/file-server.md',
            hash: 'caa61108477d03a243c1ed44fc90ed1f881eea25',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-web/executors/package.md',
            hash: 'fd09f76f67b6bafd5a9b98d479957fe788975d82',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-web/generators/application.md',
            hash: 'c7954c442c21307be42a32d33a9e86256183a02f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-workspace/executors/run-commands.md',
            hash: 'fc0c90dbc858d2110e1ec5c785fad7cde4d70c28',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-workspace/executors/run-script.md',
            hash: '525ac4e72590154b5e593fda9d451caf421e98e0',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-workspace/generators/library.md',
            hash: '8d29f77b027e11ce4b2f0c012d9eaae1e2cf386a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-workspace/generators/move.md',
            hash: '8b76fb8b6ae8cb86c415ff738b59c6255a37ac0a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-workspace/generators/remove.md',
            hash: 'c641affde7249e934963f448bd79db900b703368',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-workspace/generators/run-commands.md',
            hash: '0ff2c258ac839343aed98bc7f194341cdd017fce',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/api-workspace/generators/workspace-generator.md',
            hash: 'a426f12cf8f83fb9e120d513a49c9503b4ddfa5c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/cli/affected-apps.md',
            hash: 'a3a0b085a39c5e362f89291a7cb5c89cabe16c36',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/cli/affected-build.md',
            hash: '87dbc138554b135f7543d6a0ea6c8c981cf81966',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/cli/affected-dep-graph.md',
            hash: '1f5311aa42f3571d220bf1c55db4510593ce996c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/cli/affected-e2e.md',
            hash: '13992dcca8de1ff854705b6ecb343d553e5f4101',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/cli/affected-libs.md',
            hash: 'f9648615be93795227bfff5fe13482e06568cee8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/cli/affected-lint.md',
            hash: '93c30beaa954ecfed926977c02e77dbc46edb63e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/cli/affected-test.md',
            hash: '7339dc151c1f65c8df3c96219ddfdbd122a83472',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/cli/affected.md',
            hash: '5b4b792fad8acce4c722217db0ea4571bfcc2674',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/cli/build.md',
            hash: '8a398ba7e32adf7dc0c39005b4b081b9a2070033',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/cli/dep-graph.md',
            hash: '7de42387d7c42fe19b3f64fee70dff2e53931f41',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/cli/e2e.md',
            hash: '279449cf40a544ff2442c9cc018cad67c385cc50',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/cli/format-check.md',
            hash: '8582f2a9a592b9bd296ffe988dd69fe25f8d0aca',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/cli/format-write.md',
            hash: '356fdf198afcca9674d99ff797bc0d8f05e21973',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/cli/generate.md',
            hash: '0fa39dc3f69a7ea7a6eae4ea125e4d86a3d7ae5e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/cli/lint.md',
            hash: '19efd0e2af38aaa58ed144a10632755a6f37ffba',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/cli/list.md',
            hash: '312250e8497f1fde97e83b8ca7170eb966ed122b',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/cli/migrate.md',
            hash: '2fcd07191768eb2427a02877ade11b9c264f81b5',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/cli/print-affected.md',
            hash: '1ac11d2fd80e57e08f41883035e7ba54d7bed1c9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/cli/report.md',
            hash: '0d7c3480d5a028a13d8da43f34d0fd699bd58c55',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/cli/run-many.md',
            hash: '0a247289e0d7f82d7d712f9bbe415202a701ba3a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/cli/run.md',
            hash: '87df36051c3f52d5577a7f1c59424f6b9fd0b9d2',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/cli/serve.md',
            hash: '6a87bc97767eb44b8e44b868a4f0b08c826378b4',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/cli/test.md',
            hash: '84d7e9db8662dd4775f841ebd3a07d7743d0ad09',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/cli/workspace-generator.md',
            hash: 'dca864f7aa6b81bc5164cf48798cd5561a7df421',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/cli/workspace-lint.md',
            hash: 'd3eeca5b2b9c13b8f18eea24cfcb8c2bcf6829f9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/examples/apollo-angular.md',
            hash: 'c6818acd7f008d9fca6b1f451682755afefa5090',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/examples/react-affected.png',
            hash: 'e1dd4042dd12e46bb23fe26781c469db2460b021',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/examples/react-affected2.png',
            hash: '3d8f870b9377d708c56b77a4a889b24ffa3628a7',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/examples/react-and-angular.md',
            hash: '5539ef330d8c40c0af350f79f83cad5d7e1f2de4',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/examples/react-dep-graph.png',
            hash: '81f04e46326bc57d1ae87a7a5896a3d9ef8e1638',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/examples/react-serve.png',
            hash: 'b73ca2038a61a7915a20721ec775e925baf0ff8e',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/executors.json',
            hash: 'ded073647f1735c3c2499f428c6a2b000d4d7b4a',
            ext: '.json',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/generators.json',
            hash: '46a738dc382521ef4070c3debf5a5a04c966921d',
            ext: '.json',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/getting-started/advanced-nx-workspace-course.png',
            hash: 'bf8a9f31fe3679f3f5f9d535da0735170299b095',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/getting-started/create-workspace.gif',
            hash: '85a97af73b29af9a4476e2b3d4d22ec1a1b05eca',
            ext: '.gif',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/getting-started/dep-graph.png',
            hash: '0cc9c65cdf9c81eba3d30cd09979f818d74a7260',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/getting-started/getting-started.md',
            hash: 'f4e4d698746d3e23923b41db757b99cafc8b948a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/getting-started/nx-and-cli.md',
            hash: '6645f78bbd87fc206d43806f9bbc90b4d640a21e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/getting-started/resources.md',
            hash: 'a58b2d213209bd76d9dded5a74bc61339c42cbec',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/guides/cli-overview.md',
            hash: '40c80c8b73416069183e9578759ccaff7a2a49b7',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/guides/configuration.md',
            hash: '0e35f8034c844e1c3f361339b6743449abbbd680',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/guides/misc-data-persistence.md',
            hash: 'd5f0bdd266f4b5c8fe4a04c48e50eaa7ebae290d',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/guides/misc-ngrx.md',
            hash: '65f5c2f023b2a1be4b4d407049d4ae9b2e9fe98e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/guides/misc-upgrade.md',
            hash: 'b840a290289cb524c65176422e39526d69a52bc9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/guides/modern-angular/karma-to-jest.md',
            hash: '4e89788539b7cfcecf3c83b995b8db2b7d888d28',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/guides/modern-angular/protractor-to-cypress.md',
            hash: 'dd6b8d7d2ba11e37da6a642284c6d51f22b1f4e7',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/guides/nx-devkit-angular-devkit.md',
            hash: '4453711f4c38bcb3c2d74f9b7afb2dcc82906b3a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/guides/nx7-to-nx8.md',
            hash: '3e9095160947bb7b56deb905e5dcf7447a4b701d',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/guides/running-custom-commands.md',
            hash: 'd9bb335fa0d6b3f43ca6f280085505c866782503',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/guides/setup-incremental-builds.md',
            hash: '8f129fad795f3492046afa5f352ba32bd29f60b1',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/guides/storybook-plugin.md',
            hash: '3aeb8aef579efc9e8d52cd9b73960be93ede303f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/guides/update.md',
            hash: 'e7d4197503e71b7c46c36bee8ea025ad3c91c18d',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/migration/migration-angular.md',
            hash: 'f0a7fd7b308a6db7ebfe19d2af2c6c24a370b09c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/migration/migration-angularjs-unit-tests-passing.png',
            hash: '53414ab08cb6659ac6e5506f9c351ad343075064',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/migration/migration-angularjs.md',
            hash: '245223143ca703fb86bd9be400dd5727dc55576d',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/tutorial/01-create-application.md',
            hash: '24a9ebf073efcb91f9210988a252c4f8f2f8c323',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/tutorial/02-add-e2e-test.md',
            hash: '9fb006e7c433f5647efdd115eaa74fb67e93ce7e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/tutorial/03-display-todos.md',
            hash: '01bdf0268da6a81908e168e48454ef42e96b50fa',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/tutorial/04-connect-to-api.md',
            hash: '5ebaba37ea930fd06ed08eca2cead028eb87c03f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/tutorial/05-add-node-app.md',
            hash: '3fbf934372fd7e3929cf09418ef20a636509b602',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/tutorial/06-proxy.md',
            hash: '67fb24e447e9b53c75f9258282000a7873c720c2',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/tutorial/07-share-code.md',
            hash: '10f551ce4d5ee26034331b7a9722e1d5e299a0a0',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/tutorial/08-create-libs.md',
            hash: 'dfaa83cd14702be49827da1a08b02a533330c50c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/tutorial/09-dep-graph.md',
            hash: '9eefe9d759c4f4285a72284b6ca223f1fe8e7d2d',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/tutorial/10-computation-caching.md',
            hash: '73bed9d0f0adf2dd9f934bb1c6b8ab5796df3b17',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/tutorial/11-test-affected-projects.md',
            hash: 'b5c984b962eb3faddddc3338a88909ecc21970e9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/angular/tutorial/12-summary.md',
            hash: '129254b8cb1edcb731a32599c45e21286e4672eb',
            ext: '.md',
          },
          {
            file: 'nx-dev/data-access-documents/src/data/11.4.0/builders.json',
            hash: 'd147d35dea142344dcbb2293d49a1deb84b0c150',
            ext: '.json',
          },
          {
            file: 'nx-dev/data-access-documents/src/data/11.4.0/map.json',
            hash: 'a961fd05d6e88f8d90f574bc864aa909a8fb85a0',
            ext: '.json',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-angular/executors/ng-packagr-lite.md',
            hash: '21201d12376e6d14e7da40529f57b73feef64917',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-angular/executors/package.md',
            hash: '6e5d6e2e52beee2b5ed4b835de86b91ec19a653d',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-angular/executors/webpack-browser.md',
            hash: '302b52cb3fa06c6b701873c7f42319c2fc4a8b1a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-angular/generators/application.md',
            hash: 'bbe416f9ded72ea19e38c64c584e09d0cb4e9f0c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-angular/generators/downgrade-module.md',
            hash: '83a9b97974fe9935ef5c28006ed169a59870bf6e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-angular/generators/karma-project.md',
            hash: 'fb87bebaa393c4bb4fad7084ca641f7ce4d52c2e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-angular/generators/karma.md',
            hash: 'fa41a5fe4654fb7ad89178f38aa0399cdf728ce8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-angular/generators/library.md',
            hash: 'ab04fd7e4aa4d0e02da27c6b0cc11001e012baeb',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-angular/generators/move.md',
            hash: '4af4c255fab9df5cbedad5f015efb2371c54c8d6',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-angular/generators/ngrx.md',
            hash: '9d4a0f23dc962452ee656e011b884afeb40927d0',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-angular/generators/stories.md',
            hash: '043fdf15678fc9b851034d141574e2b01675475b',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-angular/generators/storybook-configuration.md',
            hash: '073ed1dcd12f2f8567754fb563aa4d5088e0b779',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-angular/generators/storybook-migrate-defaults-5-to-6.md',
            hash: '9476ba779446dd3fb0b6cf76d973b6bee09515c1',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-angular/generators/upgrade-module.md',
            hash: '093f05de0159d531029aa9ed04372527bb069598',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-cypress/executors/cypress.md',
            hash: 'ff3d74242f70e62934bb1592a504c577aa396cd0',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-express/generators/application.md',
            hash: 'c801960e6a9fa878fa1b9048256f30327c0d3fd9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-gatsby/executors/build.md',
            hash: '47ce509dcf4edece8055d916f4f5e40ea6f46af6',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-gatsby/executors/server.md',
            hash: '66b9ddaec1da093c4ede468d8bc19672e392f46f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-gatsby/generators/application.md',
            hash: '444d19ee1b48754be32e083f5f49fa499cbd5914',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-gatsby/generators/component.md',
            hash: '505bd2d0d8f653b86d6b68d6d5c05e15341e733e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-gatsby/generators/page.md',
            hash: '9310106396fba0c7ad194e812c1718d81611abca',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-jest/executors/jest.md',
            hash: '356ac69ad8972cbfa6b675135dcdd81146b76038',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-linter/executors/eslint.md',
            hash: '64463a8fa94447129c22291fdbd527367e553689',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-linter/executors/lint.md',
            hash: '0bdeba5142b7ae4a32afdd680a19ab55aad7f989',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-nest/generators/application.md',
            hash: 'cca4d44354a4b5c0ed3f15a4f8e4e4bf4ce6ab87',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-nest/generators/class.md',
            hash: '6e68d6c09b99a558f3197894c87b0bc4f19cbaf1',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-nest/generators/controller.md',
            hash: '675f120e099e878e50946a2635605215129f9190',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-nest/generators/decorator.md',
            hash: '3d7897059346ee48809a53f0d24a0fd0e048c93a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-nest/generators/filter.md',
            hash: 'ae68bfb9c76a3f1113e55c85126307db651822a8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-nest/generators/gateway.md',
            hash: '158e69e78e61109725c9032106cf0674a957ffe1',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-nest/generators/guard.md',
            hash: '79030bc77d0f32f7f90817662776e95f4f2505a5',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-nest/generators/interceptor.md',
            hash: 'baf34e70657b4c35f5d70ce10115ee3bc66b67b3',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-nest/generators/interface.md',
            hash: '5d8e361733bf4aa20c3f1c8ebab6c005ab620915',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-nest/generators/library.md',
            hash: '5e59e4f3c54fb2d2e7412b3e6446eb567e8c09d4',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-nest/generators/middleware.md',
            hash: 'a98c69da257bd9953099fdacb317c9e6dd8b8664',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-nest/generators/module.md',
            hash: 'd6c89ec3623306c6e2e8716ab6d5bfc7d30c6bd9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-nest/generators/pipe.md',
            hash: '3bc792d24fb5279b8cd4c5a7064f33257b693093',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-nest/generators/provider.md',
            hash: '546a44396b9b0263c24f5e95594f6b19a5f6622d',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-nest/generators/resolver.md',
            hash: '76cde3741d83e02f1c54f03b80dc7025dd9692f9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-nest/generators/service.md',
            hash: '241519d348b3a58ad6872b86a772231db9150a1c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-next/executors/build.md',
            hash: '6430d70759dc86709a51674dddc85816deb0e260',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-next/executors/export.md',
            hash: '8f9d649dd296c8b27ed51304da73c93fc6ca0006',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-next/executors/server.md',
            hash: 'c32b25a8727c1cbf5102c56019c84b0ee983c410',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-next/generators/application.md',
            hash: '7fe8a93eedb1e127d059a0570f8f3bf9bbf2396b',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-next/generators/component.md',
            hash: 'bb6cffb91e6be7eae2b7a9fc01952bfd6710746a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-next/generators/page.md',
            hash: '82ca21954ec0bc5b4b550a5d4e7613f17865b1fb',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-node/executors/build.md',
            hash: '24482b310f988e24d9f3fd5f71ddaa02be30463f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-node/executors/execute.md',
            hash: 'fb7bcfd2cd23643e0466508c3e378e5827ee806d',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-node/executors/package.md',
            hash: 'cd2b34a69116bd7026cd223550fb41e427428697',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-node/generators/application.md',
            hash: '5ed7f18cd4ed742c398c36317989093b4caa0bfe',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-node/generators/library.md',
            hash: '864624be6ddc13c3df7cd7acabd17e604e839a9b',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-nx-plugin/executors/e2e.md',
            hash: '7ccb9278bad7b271b6abcd437d0cda680e616164',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-nx-plugin/generators/executor.md',
            hash: 'aed95878693117db9e880a51700b906efb0b4ec6',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-nx-plugin/generators/generator.md',
            hash: '64d2686a74219010f143b49c4904cdf800f0a433',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-nx-plugin/generators/migration.md',
            hash: '82867640a77ee6a12b2e4b26dc4ee998950cd469',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-nx-plugin/generators/plugin.md',
            hash: 'f7bce6c1ba9c7b43537de336d709a3689d222a21',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-react/generators/application.md',
            hash: '8bb109275c733ebd385eefa4799899fa79f17332',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-react/generators/component-cypress-spec.md',
            hash: '58b52f635add7eb9e407d871168912b0fc3d0e19',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-react/generators/component-story.md',
            hash: '35ef6ced9c08a07ad07f7863536859522c2c7620',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-react/generators/component.md',
            hash: '2633a1c1e99313c8ac485554809dd060a3394b52',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-react/generators/library.md',
            hash: 'fe6358933e024e429a02e7d69e6fbb163decd7dd',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-react/generators/redux.md',
            hash: 'cda1e636d6ca2673a5d13c483c297415fc889dec',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-react/generators/stories.md',
            hash: '8189aab8a77169cb312c6b00c5c9526da033d9d3',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-react/generators/storybook-configuration.md',
            hash: '17f57195302c0d98e82624271d0c9dc9f07bf681',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-react/generators/storybook-migrate-defaults-5-to-6.md',
            hash: '6253cf44e82f54f1283695e66ce80880819ea3ed',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-storybook/executors/build.md',
            hash: '2947ef14274ade5690b5f50bcfae93bd67e9447c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-storybook/executors/storybook.md',
            hash: 'a5e75e11a38863017ee6fff6ec3f32057f994b34',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-storybook/generators/configuration.md',
            hash: 'ecd1fe62621e635bcab32533ed1890582a74cefe',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-storybook/generators/cypress-project.md',
            hash: '8b70e27fd348bf629c7f34fd8810435b3a4e6c36',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-storybook/generators/migrate-defaults-5-to-6.md',
            hash: '4054001fcf22c73a40954f9559caf715f2e3bdc5',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-web/executors/build.md',
            hash: '3dc4ddc8b6ad6d7a8096b3b79bbb5ee2069d82fc',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-web/executors/dev-server.md',
            hash: '00bb971158da8ee7cea4a093dbd916f156f2e751',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-web/executors/file-server.md',
            hash: '5a0c2c1c765b13a81fd1b2b88a556f1fbddb9de6',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-web/executors/package.md',
            hash: 'f76ae8440af9e7c64a8a9894690d0abb2df892d6',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-web/generators/application.md',
            hash: '914d89a1c55d253ab5cee98d660fb02700247455',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-workspace/executors/run-commands.md',
            hash: '047411d0d0c866f8d57e8f1dced9332d2ba9ff89',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-workspace/executors/run-script.md',
            hash: '17df3dbf5332ea031de79bf5abea4e20cc0b1a47',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-workspace/generators/library.md',
            hash: '1f0f79e2a728573be02299da17fb9e976b493e6f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-workspace/generators/move.md',
            hash: '723a02289875717602967dcdcb5509e9aafd7117',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-workspace/generators/remove.md',
            hash: 'a83d2779386b7e72a93db5f8629d60babe6bd5d8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-workspace/generators/run-commands.md',
            hash: 'fb24979f182bdf85566570da30fd9a174f5934b2',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/api-workspace/generators/workspace-generator.md',
            hash: '7d95e3eef708f8cd3111206aaad39db24ce78f0f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/cli/affected-apps.md',
            hash: 'a3a0b085a39c5e362f89291a7cb5c89cabe16c36',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/cli/affected-build.md',
            hash: '87dbc138554b135f7543d6a0ea6c8c981cf81966',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/cli/affected-dep-graph.md',
            hash: '1f5311aa42f3571d220bf1c55db4510593ce996c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/cli/affected-e2e.md',
            hash: '13992dcca8de1ff854705b6ecb343d553e5f4101',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/cli/affected-libs.md',
            hash: 'f9648615be93795227bfff5fe13482e06568cee8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/cli/affected-lint.md',
            hash: '93c30beaa954ecfed926977c02e77dbc46edb63e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/cli/affected-test.md',
            hash: '7339dc151c1f65c8df3c96219ddfdbd122a83472',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/cli/affected.md',
            hash: '5b4b792fad8acce4c722217db0ea4571bfcc2674',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/cli/build.md',
            hash: '8a398ba7e32adf7dc0c39005b4b081b9a2070033',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/cli/dep-graph.md',
            hash: '7de42387d7c42fe19b3f64fee70dff2e53931f41',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/cli/e2e.md',
            hash: '279449cf40a544ff2442c9cc018cad67c385cc50',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/cli/format-check.md',
            hash: '8582f2a9a592b9bd296ffe988dd69fe25f8d0aca',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/cli/format-write.md',
            hash: '356fdf198afcca9674d99ff797bc0d8f05e21973',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/cli/generate.md',
            hash: '0fa39dc3f69a7ea7a6eae4ea125e4d86a3d7ae5e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/cli/lint.md',
            hash: '19efd0e2af38aaa58ed144a10632755a6f37ffba',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/cli/list.md',
            hash: '312250e8497f1fde97e83b8ca7170eb966ed122b',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/cli/migrate.md',
            hash: '2fcd07191768eb2427a02877ade11b9c264f81b5',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/cli/print-affected.md',
            hash: '1ac11d2fd80e57e08f41883035e7ba54d7bed1c9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/cli/report.md',
            hash: '0d7c3480d5a028a13d8da43f34d0fd699bd58c55',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/cli/run-many.md',
            hash: '0a247289e0d7f82d7d712f9bbe415202a701ba3a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/cli/run.md',
            hash: '87df36051c3f52d5577a7f1c59424f6b9fd0b9d2',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/cli/serve.md',
            hash: '6a87bc97767eb44b8e44b868a4f0b08c826378b4',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/cli/test.md',
            hash: '84d7e9db8662dd4775f841ebd3a07d7743d0ad09',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/cli/workspace-generator.md',
            hash: 'dca864f7aa6b81bc5164cf48798cd5561a7df421',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/cli/workspace-lint.md',
            hash: 'd3eeca5b2b9c13b8f18eea24cfcb8c2bcf6829f9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/executors.json',
            hash: 'ded073647f1735c3c2499f428c6a2b000d4d7b4a',
            ext: '.json',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/generators.json',
            hash: '46a738dc382521ef4070c3debf5a5a04c966921d',
            ext: '.json',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/getting-started/advanced-nx-workspace-course.png',
            hash: 'bf8a9f31fe3679f3f5f9d535da0735170299b095',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/getting-started/getting-started.md',
            hash: '2a7c106a6316f247e3075ac55f202accfd243ea8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/getting-started/resources.md',
            hash: 'ab428a04c89c307de7f696b9a08afc64d0f4c792',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/guides/cli-overview.md',
            hash: '89da92788af17edf6774805b63c30f8826a8de7e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/guides/configuration.md',
            hash: 'ae9a719f0210d1629f3ebd3e9166ca27e0a66787',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/guides/storybook-plugin.md',
            hash: '12362818806e0d42dad68b6b10ec0295154b08e1',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/tutorial/01-create-application.md',
            hash: '1ac6a5dd01354da5ea8327fbea13a997cd5dd8b4',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/tutorial/02-display-todos.md',
            hash: '90d51f190baa197cc597fe92d225aaed1f99d26d',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/tutorial/03-share-code.md',
            hash: 'f914968b801500de85415be9884c8c2c9e4ce160',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/tutorial/04-create-libs.md',
            hash: '535c9956d67cbbd089a75211e8cfd0dc573dc538',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/tutorial/05-dep-graph.md',
            hash: '78f8c7c3089811d37f62cbf8edf4135800f13ebf',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/tutorial/06-computation-caching.md',
            hash: '7e2523ce33230b3f8b1f9352e570333ce34ae308',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/tutorial/07-test-affected-projects.md',
            hash: 'd28688609d63e0233126ea395a379b561cc3373f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/node/tutorial/08-summary.md',
            hash: '6ef5520a5a60fa39e3f5a2526bcd66ad62ec04c4',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-angular/executors/ng-packagr-lite.md',
            hash: 'd25e311dac153364bad06f6c8ad1838bb596fb24',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-angular/executors/package.md',
            hash: '11fd6fd02cc941be67b61d90fc96bc9c14f1d1ee',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-angular/executors/webpack-browser.md',
            hash: 'dbc31886c9de60a5d056ca65fa7ae44a7c0ac6ae',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-angular/generators/application.md',
            hash: 'bbe416f9ded72ea19e38c64c584e09d0cb4e9f0c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-angular/generators/downgrade-module.md',
            hash: '83a9b97974fe9935ef5c28006ed169a59870bf6e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-angular/generators/karma-project.md',
            hash: 'fb87bebaa393c4bb4fad7084ca641f7ce4d52c2e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-angular/generators/karma.md',
            hash: 'fa41a5fe4654fb7ad89178f38aa0399cdf728ce8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-angular/generators/library.md',
            hash: 'ab04fd7e4aa4d0e02da27c6b0cc11001e012baeb',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-angular/generators/move.md',
            hash: '4af4c255fab9df5cbedad5f015efb2371c54c8d6',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-angular/generators/ngrx.md',
            hash: '9d4a0f23dc962452ee656e011b884afeb40927d0',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-angular/generators/stories.md',
            hash: '043fdf15678fc9b851034d141574e2b01675475b',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-angular/generators/storybook-configuration.md',
            hash: '073ed1dcd12f2f8567754fb563aa4d5088e0b779',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-angular/generators/storybook-migrate-defaults-5-to-6.md',
            hash: '9476ba779446dd3fb0b6cf76d973b6bee09515c1',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-angular/generators/upgrade-module.md',
            hash: '093f05de0159d531029aa9ed04372527bb069598',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-cypress/executors/cypress.md',
            hash: '14cee12bed650a854f5805adbd635b761ed6839e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-express/generators/application.md',
            hash: 'c801960e6a9fa878fa1b9048256f30327c0d3fd9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-gatsby/executors/build.md',
            hash: '5d732f43d5f1f095081decc7406200df9de3689b',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-gatsby/executors/server.md',
            hash: 'c19723ab14e64a82df1fb191814639a6648a927d',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-gatsby/generators/application.md',
            hash: '444d19ee1b48754be32e083f5f49fa499cbd5914',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-gatsby/generators/component.md',
            hash: '505bd2d0d8f653b86d6b68d6d5c05e15341e733e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-gatsby/generators/page.md',
            hash: '9310106396fba0c7ad194e812c1718d81611abca',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-jest/executors/jest.md',
            hash: '51fa9df10ed94068f8c84abd16896af7e1ab7077',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-linter/executors/eslint.md',
            hash: 'bf02ceff28026d4d4de9a9f5439272ca87cc6945',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-linter/executors/lint.md',
            hash: '2ca75a055619df36117ca5419a43f90b9c6ede61',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-nest/generators/application.md',
            hash: 'cca4d44354a4b5c0ed3f15a4f8e4e4bf4ce6ab87',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-nest/generators/class.md',
            hash: '6e68d6c09b99a558f3197894c87b0bc4f19cbaf1',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-nest/generators/controller.md',
            hash: '675f120e099e878e50946a2635605215129f9190',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-nest/generators/decorator.md',
            hash: '3d7897059346ee48809a53f0d24a0fd0e048c93a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-nest/generators/filter.md',
            hash: 'ae68bfb9c76a3f1113e55c85126307db651822a8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-nest/generators/gateway.md',
            hash: '158e69e78e61109725c9032106cf0674a957ffe1',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-nest/generators/guard.md',
            hash: '79030bc77d0f32f7f90817662776e95f4f2505a5',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-nest/generators/interceptor.md',
            hash: 'baf34e70657b4c35f5d70ce10115ee3bc66b67b3',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-nest/generators/interface.md',
            hash: '5d8e361733bf4aa20c3f1c8ebab6c005ab620915',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-nest/generators/library.md',
            hash: '5e59e4f3c54fb2d2e7412b3e6446eb567e8c09d4',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-nest/generators/middleware.md',
            hash: 'a98c69da257bd9953099fdacb317c9e6dd8b8664',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-nest/generators/module.md',
            hash: 'd6c89ec3623306c6e2e8716ab6d5bfc7d30c6bd9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-nest/generators/pipe.md',
            hash: '3bc792d24fb5279b8cd4c5a7064f33257b693093',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-nest/generators/provider.md',
            hash: '546a44396b9b0263c24f5e95594f6b19a5f6622d',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-nest/generators/resolver.md',
            hash: '76cde3741d83e02f1c54f03b80dc7025dd9692f9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-nest/generators/service.md',
            hash: '241519d348b3a58ad6872b86a772231db9150a1c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-next/executors/build.md',
            hash: 'c08477e5d03942a468bfb339faa1d82ac42b9626',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-next/executors/export.md',
            hash: '278037938d46b3e7edac87f5ebd0394108a34c3f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-next/executors/server.md',
            hash: 'e417e9e80ceda787d285bceceb0c7c379d129c82',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-next/generators/application.md',
            hash: '7fe8a93eedb1e127d059a0570f8f3bf9bbf2396b',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-next/generators/component.md',
            hash: 'bb6cffb91e6be7eae2b7a9fc01952bfd6710746a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-next/generators/page.md',
            hash: '82ca21954ec0bc5b4b550a5d4e7613f17865b1fb',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-node/executors/build.md',
            hash: '32a9e66ddf76028ba3c25742a0081865c2b11c25',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-node/executors/execute.md',
            hash: '39206f607341479811e9e3ba6466e70bb469f903',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-node/executors/package.md',
            hash: 'f132ef0604808cad876ccd4c752e867f893170f8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-node/generators/application.md',
            hash: '5ed7f18cd4ed742c398c36317989093b4caa0bfe',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-node/generators/library.md',
            hash: '864624be6ddc13c3df7cd7acabd17e604e839a9b',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-nx-plugin/executors/e2e.md',
            hash: '17ff6fa9cd074ed4e09a16efe884e3bbb16dd8ce',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-nx-plugin/generators/executor.md',
            hash: 'aed95878693117db9e880a51700b906efb0b4ec6',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-nx-plugin/generators/generator.md',
            hash: '64d2686a74219010f143b49c4904cdf800f0a433',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-nx-plugin/generators/migration.md',
            hash: '82867640a77ee6a12b2e4b26dc4ee998950cd469',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-nx-plugin/generators/plugin.md',
            hash: 'f7bce6c1ba9c7b43537de336d709a3689d222a21',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-react/generators/application.md',
            hash: '8bb109275c733ebd385eefa4799899fa79f17332',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-react/generators/component-cypress-spec.md',
            hash: '58b52f635add7eb9e407d871168912b0fc3d0e19',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-react/generators/component-story.md',
            hash: '35ef6ced9c08a07ad07f7863536859522c2c7620',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-react/generators/component.md',
            hash: '2633a1c1e99313c8ac485554809dd060a3394b52',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-react/generators/library.md',
            hash: 'fe6358933e024e429a02e7d69e6fbb163decd7dd',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-react/generators/redux.md',
            hash: 'cda1e636d6ca2673a5d13c483c297415fc889dec',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-react/generators/stories.md',
            hash: '8189aab8a77169cb312c6b00c5c9526da033d9d3',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-react/generators/storybook-configuration.md',
            hash: '17f57195302c0d98e82624271d0c9dc9f07bf681',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-react/generators/storybook-migrate-defaults-5-to-6.md',
            hash: '6253cf44e82f54f1283695e66ce80880819ea3ed',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-storybook/executors/build.md',
            hash: '2255ef48e7cdff6d8b5322a283ee26f84baba585',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-storybook/executors/storybook.md',
            hash: '1ddae5eccff43234f839578d930829bbb5c920f1',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-storybook/generators/configuration.md',
            hash: 'ecd1fe62621e635bcab32533ed1890582a74cefe',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-storybook/generators/cypress-project.md',
            hash: '8b70e27fd348bf629c7f34fd8810435b3a4e6c36',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-storybook/generators/migrate-defaults-5-to-6.md',
            hash: '4054001fcf22c73a40954f9559caf715f2e3bdc5',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-web/executors/build.md',
            hash: '488a28cc01daf76e24bf3e93916484eb017fc8f7',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-web/executors/dev-server.md',
            hash: '188d8caf81c58fa19669628a6d60f05cef38825a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-web/executors/file-server.md',
            hash: '10e401d924d3d4ee63b2f49434b611ce698b10ff',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-web/executors/package.md',
            hash: '8ac18a761ae469924d7862a84b0d9806a97817a6',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-web/generators/application.md',
            hash: '914d89a1c55d253ab5cee98d660fb02700247455',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-workspace/executors/run-commands.md',
            hash: 'f1d67f0b697bfede85ac29777d8597b8d6e4b84f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-workspace/executors/run-script.md',
            hash: 'de42c421fdd01dee5873b95a322b25fa6188a5ba',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-workspace/generators/library.md',
            hash: '1f0f79e2a728573be02299da17fb9e976b493e6f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-workspace/generators/move.md',
            hash: '723a02289875717602967dcdcb5509e9aafd7117',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-workspace/generators/remove.md',
            hash: 'a83d2779386b7e72a93db5f8629d60babe6bd5d8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-workspace/generators/run-commands.md',
            hash: 'fb24979f182bdf85566570da30fd9a174f5934b2',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/api-workspace/generators/workspace-generator.md',
            hash: '7d95e3eef708f8cd3111206aaad39db24ce78f0f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/cli/affected-apps.md',
            hash: 'a3a0b085a39c5e362f89291a7cb5c89cabe16c36',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/cli/affected-build.md',
            hash: '87dbc138554b135f7543d6a0ea6c8c981cf81966',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/cli/affected-dep-graph.md',
            hash: '1f5311aa42f3571d220bf1c55db4510593ce996c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/cli/affected-e2e.md',
            hash: '13992dcca8de1ff854705b6ecb343d553e5f4101',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/cli/affected-libs.md',
            hash: 'f9648615be93795227bfff5fe13482e06568cee8',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/cli/affected-lint.md',
            hash: '93c30beaa954ecfed926977c02e77dbc46edb63e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/cli/affected-test.md',
            hash: '7339dc151c1f65c8df3c96219ddfdbd122a83472',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/cli/affected.md',
            hash: '5b4b792fad8acce4c722217db0ea4571bfcc2674',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/cli/build.md',
            hash: '8a398ba7e32adf7dc0c39005b4b081b9a2070033',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/cli/dep-graph.md',
            hash: '7de42387d7c42fe19b3f64fee70dff2e53931f41',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/cli/e2e.md',
            hash: '279449cf40a544ff2442c9cc018cad67c385cc50',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/cli/format-check.md',
            hash: '8582f2a9a592b9bd296ffe988dd69fe25f8d0aca',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/cli/format-write.md',
            hash: '356fdf198afcca9674d99ff797bc0d8f05e21973',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/cli/generate.md',
            hash: '0fa39dc3f69a7ea7a6eae4ea125e4d86a3d7ae5e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/cli/lint.md',
            hash: '19efd0e2af38aaa58ed144a10632755a6f37ffba',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/cli/list.md',
            hash: '312250e8497f1fde97e83b8ca7170eb966ed122b',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/cli/migrate.md',
            hash: '2fcd07191768eb2427a02877ade11b9c264f81b5',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/cli/print-affected.md',
            hash: '1ac11d2fd80e57e08f41883035e7ba54d7bed1c9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/cli/report.md',
            hash: '0d7c3480d5a028a13d8da43f34d0fd699bd58c55',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/cli/run-many.md',
            hash: '0a247289e0d7f82d7d712f9bbe415202a701ba3a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/cli/run.md',
            hash: '87df36051c3f52d5577a7f1c59424f6b9fd0b9d2',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/cli/serve.md',
            hash: '6a87bc97767eb44b8e44b868a4f0b08c826378b4',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/cli/test.md',
            hash: '84d7e9db8662dd4775f841ebd3a07d7743d0ad09',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/cli/workspace-generator.md',
            hash: 'dca864f7aa6b81bc5164cf48798cd5561a7df421',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/cli/workspace-lint.md',
            hash: 'd3eeca5b2b9c13b8f18eea24cfcb8c2bcf6829f9',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/examples/apollo-react.md',
            hash: 'e3aa0cbe281e21faac3a6dbae4d628a3f2ce595d',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/examples/react-nx.md',
            hash: '69add2be3242a28c2bdb3cdfe8da1b351bf1167e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/executors.json',
            hash: 'ded073647f1735c3c2499f428c6a2b000d4d7b4a',
            ext: '.json',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/generators.json',
            hash: '46a738dc382521ef4070c3debf5a5a04c966921d',
            ext: '.json',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/getting-started/advanced-nx-workspace-course.png',
            hash: 'bf8a9f31fe3679f3f5f9d535da0735170299b095',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/getting-started/EGH_ScalingReactNx.png',
            hash: '308795a5a64edb85dbfde738b72c131976ab87b9',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/getting-started/getting-started.md',
            hash: '5d94dc04f46af8677902ece174d76a78ae6d871f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/getting-started/resources.md',
            hash: '26a48e64ff81c4225bf4caf43491715472260256',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/guides/adding-assets.md',
            hash: 'a4e9ffb83749f379dc2b2beedbf772367930f455',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/guides/cli-overview.md',
            hash: '5030c091209482ec0c0ef59bc5577d9a301e38cf',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/guides/configuration.md',
            hash: '6eccc8816f1d4d3993488f3bed1131ebbfcd7474',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/guides/environment-variables.md',
            hash: 'f8f4460513b388cfa51ccaef882377b445f0e94b',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/guides/js-and-ts.md',
            hash: 'f0c6f9e601a5a1db6e0fad3996c9d34676cf0837',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/guides/nextjs.md',
            hash: 'f6f73912592c1f19975d4f145cd2e10e64583d32',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/guides/storybook-plugin.md',
            hash: '670787b8ff5e4aca3ee4fd448ef0ad5f9998f76e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/migration/migration-cra.md',
            hash: '8c21dc6e239dc6b2a6578b0d8ef2e489134fa617',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/tutorial/01-create-application.md',
            hash: 'dde563cd28bd8e3f600a3312ce77242c136baace',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/tutorial/02-add-e2e-test.md',
            hash: 'b3da10fe071f8c85bbba35ff55edcc2e77e1bb96',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/tutorial/03-display-todos.md',
            hash: '02e0c5d8c5138d041cd5aee0d1a569a6e5560783',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/tutorial/04-connect-to-api.md',
            hash: 'f6ac37073fcf1e241185d54a160cff16914c7695',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/tutorial/05-add-node-app.md',
            hash: '73848974139a5bf685c678b0c39388a1490295d1',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/tutorial/06-proxy.md',
            hash: 'bd49864b6c8a69e23c6f5ea66c8270a656320551',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/tutorial/07-share-code.md',
            hash: '14cb6fcc519ee2391c29682a9bfe3e6674c7973e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/tutorial/08-create-libs.md',
            hash: '8ec318a9d3a39b403e8f4bb08a91569eaac9bc29',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/tutorial/09-dep-graph.md',
            hash: '1d214ea01a80de5c9291d42989bab1bea532be98',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/tutorial/10-computation-caching.md',
            hash: '4ddf9028a67baf476e1b455584bf8e81c778664e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/tutorial/11-test-affected-projects.md',
            hash: '726463b6967bd640b2cd20003a47dbfd6f178ede',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/react/tutorial/12-summary.md',
            hash: 'a0c3a78f673969c3b7c88f5919af241dc1ed6a39',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/affected.md',
            hash: '6ef0f1e58cfed5bf0150909aaf4894dc4734aea1',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/affected.png',
            hash: '4437f9a8e397a98ea7d99b2d929be360a51313c8',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/all-cache-inputs.png',
            hash: 'e7e5bd839e7ccb4acc4221dce66952db6cad85e1',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/angular-plugin.md',
            hash: '849e3bd5b93aecd71da33be9ff936af369d28941',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/api/angular.jpg',
            hash: 'f03bf78a3bd15e5bfeb925922ad94c41e5203009',
            ext: '.jpg',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/api/cypress.jpg',
            hash: '7727bf6d734549eeca678de9c870f3b4072698e5',
            ext: '.jpg',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/api/express.jpg',
            hash: 'f55f7f0783d2ec9373b90e66be944eac48bb4bb8',
            ext: '.jpg',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/api/jest.jpg',
            hash: 'd7ce915a2ad472df19f77de8437d7edc330d665c',
            ext: '.jpg',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/api/nest.jpg',
            hash: '9e02b1e3dde3433378881993c520c9d65688a9ea',
            ext: '.jpg',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/api/node.jpg',
            hash: '7003802217e825012068684547d7d5e30badd775',
            ext: '.jpg',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/api/react.jpg',
            hash: 'e534bd5b242a8a5ed55c8d02851dd7c4d86ac3ba',
            ext: '.jpg',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/api/web.jpg',
            hash: 'd92cea331c6bd8d4453e5311ca30b43c0a77fe0a',
            ext: '.jpg',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/caching-example.png',
            hash: '026252539a044e6b3312df9e6065d97c168f8f49',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/ci-graph-everything-affected.png',
            hash: '95ea861c4ea747b8fad48d765b45384ce63f0223',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/ci-graph-one-affected.png',
            hash: '1eb5a4c166942cd3b03be920b5b71959d2583359',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/ci-graph.png',
            hash: '94138839eac7b5de9928acb243ab9c5c22f378c3',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/cli/build.md',
            hash: '8a398ba7e32adf7dc0c39005b4b081b9a2070033',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/cli/e2e.md',
            hash: '279449cf40a544ff2442c9cc018cad67c385cc50',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/cli/generate.md',
            hash: '0fa39dc3f69a7ea7a6eae4ea125e4d86a3d7ae5e',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/cli/lint.md',
            hash: '19efd0e2af38aaa58ed144a10632755a6f37ffba',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/cli/run.md',
            hash: '87df36051c3f52d5577a7f1c59424f6b9fd0b9d2',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/cli/serve.md',
            hash: '6a87bc97767eb44b8e44b868a4f0b08c826378b4',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/cli/test.md',
            hash: '84d7e9db8662dd4775f841ebd3a07d7743d0ad09',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/computation-caching.md',
            hash: 'ad15e517a8ad1e6305968800caf1495826a3f31f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/console.md',
            hash: '87d903638c5044938cf80d6c7202d1eca0591913',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/continue-light.svg',
            hash: '2563bfa114bef1fefe582096bfd1095f44a4f6c4',
            ext: '.svg',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/cypress-logo.png',
            hash: '6553e4a03ef1554df37beca19e24c10a10c2c71a',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/cypress-plugin.md',
            hash: '0e6ed455409a1b78c429841d24ca9e045c937dc0',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/dependency-graph.png',
            hash: '7c187112fb9f4b32b4ba88088638438ac9b97381',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/devkit.md',
            hash: 'cbd833639ed30d20fc4e9d9db1887be3d35a08b7',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/distributed-builds.md',
            hash: '2788c8fd29deb4855cbd98af99a931f3d54c91ac',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/examples/nx-examples.md',
            hash: 'fc01b6336758215afb8dcbc13583aa4afa6a0a8b',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/express-plugin.md',
            hash: '8be8ba506dfa64b39e9c41cdf0571e68bde7016f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/folder-light.svg',
            hash: '8daecdac6a358b5d789ed6e6f02dee0b4c7a48c3',
            ext: '.svg',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/folder-structure.md',
            hash: 'b631eb1a8e619254bbfbbafab45eb330e97d8328',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/gatsby-plugin.md',
            hash: '9e927e1c323bae15e02c25d7067e12f436898711',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/github.png',
            hash: 'd1a2a6374771be04e93755cd90e9bda17423f701',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/guides/browser-support.md',
            hash: '2a94350a4b198ec80b894a319ef75537c5f3ab65',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/guides/why-monorepos.md',
            hash: '7d97ef8765f63f39446f8036247fce7aee964f0c',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/incremental-build-webpack-vs-incremental.png',
            hash: '9d57530a94709215e6774bf89e28c9ff11e8c6d3',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/incremental-builds.md',
            hash: 'bcc00dea34c055e32fed1e73d6cded8000de7386',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/jest-logo.png',
            hash: 'ac0c0f5e4429a5ce6b6f1c66bf62040b36e5794c',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/jest-plugin.md',
            hash: 'a85dc68adbb057509173e5bd87f396b03e16ad77',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/migration/adding-to-monorepo.md',
            hash: '47a08a4a5db899fa1ef61bce1c5bca59367236bd',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/migration/overview.md',
            hash: 'bcc5d498517eabed6355dd47865a46b968681b62',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/migration/preserving-git-histories.md',
            hash: '5ff68760837420f95321b9ec168d59f6a213a64a',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/monorepo-ci-azure.md',
            hash: '464c20fa734b1188a30867f5e182227bcb9d1748',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/monorepo-ci-jenkins.md',
            hash: '3b31d0fc1958dc5d57bc7ef518972d193e02db2b',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/monorepo-nx-enterprise.md',
            hash: '7cb1fb7114a8a832ae7af7f461b6be58eb2bf436',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/monorepo-tags.md',
            hash: '526f0b53c2e86e34f393ada77e4ffdff959babd2',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/nest-logo.png',
            hash: 'f1e27035310756193211911a74cdf39d4c6376b5',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/nest-plugin.md',
            hash: '94dffb3007d8c69764e17e051a38a357dde9a255',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/next-plugin.md',
            hash: '36b0f19ca514bd8c3dd10864dac03fd3964c1d9f',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/node-plugin.md',
            hash: 'ce676139ef7283c130769bdf1df251165254de93',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/nx-console-logo.png',
            hash: '11d0c0758fd20321bdda24886f3fd573092fc5ac',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/nx-console-screenshot.png',
            hash: '0a444ee0d5d93eac2c3f18f35ba2e91b3c4b4ff4',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/nx-plugin.md',
            hash: '47562ea004619320b576bf92779a2baa5f5d72fe',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/plugins-overview.md',
            hash: '0ecf7e5b15d5fb6ad61d409a347883aa89a0d182',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/prettier-logo.png',
            hash: '59bb947f29431ccf142c1ed2f520aa747c38541a',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/react-plugin.md',
            hash: 'c67c50513030d044e6d80cf46b8b10fc1bbfcaf2',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/refresh-light.svg',
            hash: 'e0345748192eeb97633b33feb5cd8997a98c9edc',
            ext: '.svg',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/running-custom-commands.md',
            hash: '714823828e32016b10cad1fbc9bfb060865090b1',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/storybook-logo.png',
            hash: '9201193134c0f94a842c4f929b9c23f62060e0d1',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/tools-workspace-builders.md',
            hash: '79b10c71b2fa0635e34c11035ac3dbda17e3d268',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/tools-workspace-generators.md',
            hash: 'c10ad54af6965260154b06fbbeb080447590f3e7',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/update.md',
            hash: '534691ce3ad11ccc5c539bf9f0e1dcb752fe2f86',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/using-builders.md',
            hash: '03ecdb5005c1d17702f541bcceb6d3d41edc329b',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/using-schematics.md',
            hash: 'c842f48632180f00b88e5448070996e377caae00',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/vscode-schematics-debug.png',
            hash: '57efd4b6c15012e816df353cd1bc33c08a189116',
            ext: '.png',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/web-plugin.md',
            hash: '4d512f80ddc04fb1db038e46e026aafe04da78cd',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/workspace-plugin.md',
            hash: 'a343267c6fc247081449e9afb257c76cdf6ae849',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/workspace/buildable-and-publishable-libraries.md',
            hash: '10c3ba0943a883cf396bd851f7c55fd754703ffc',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/workspace/creating-libraries.md',
            hash: 'aa5cf178dc0d1d3db68ae9ad1c071628c4f01895',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/workspace/grouping-libraries.md',
            hash: '6a370828a8897aa966f03502bf7ddb4f628a3158',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/workspace/library-types.md',
            hash: '8d4a9ab557bdd624c07b2c1c2e1f07c3162026ea',
            ext: '.md',
          },
          {
            file:
              'nx-dev/data-access-documents/src/data/11.4.0/shared/workspace/structure/dependency-graph.md',
            hash: '93c2d98866af3cbd7661a2301286c8820bfd17df',
            ext: '.md',
          },
          {
            file: 'nx-dev/data-access-documents/src/data/versions.json',
            hash: 'bc276301fd97947350422675e75adac9afe03c7d',
            ext: '.json',
          },
          {
            file: 'nx-dev/data-access-documents/src/index.ts',
            hash: '92b66dfce23b3d299a577e3d29047a7668432748',
            ext: '.ts',
          },
          {
            file:
              'nx-dev/data-access-documents/src/lib/documentation-api.spec.ts',
            hash: 'bf09e8d221aeb4b38612ab2bd9a70921fa673965',
            ext: '.ts',
          },
          {
            file: 'nx-dev/data-access-documents/src/lib/documentation-api.ts',
            hash: '153c70353829dd723d1aba875175998997bd8078',
            ext: '.ts',
          },
          {
            file: 'nx-dev/data-access-documents/src/lib/models.ts',
            hash: '32c0c7b7fc39586687c4f908b1623a397e9a67be',
            ext: '.ts',
          },
          {
            file: 'nx-dev/data-access-documents/src/lib/utils.spec.ts',
            hash: 'a51c9d9b28c771455e4711f4da6677d18ba349fc',
            ext: '.ts',
          },
          {
            file: 'nx-dev/data-access-documents/src/lib/utils.ts',
            hash: 'cce589eb45b26213af6f7bf53ff03859a616b776',
            ext: '.ts',
          },
          {
            file: 'nx-dev/data-access-documents/tsconfig.json',
            hash: '62ebbd946474cea997e774d20fffc4d585c184f3',
            ext: '.json',
          },
          {
            file: 'nx-dev/data-access-documents/tsconfig.lib.json',
            hash: '7bce65e5cf5ad7105818fdcc19343420af30d9db',
            ext: '.json',
          },
          {
            file: 'nx-dev/data-access-documents/tsconfig.spec.json',
            hash: '3706777f628aeb7eb900711c13adc843dfa3786b',
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
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/eslint-plugin-nx/jest.config.js',
              passWithNoTests: true,
            },
            outputs: ['coverage/packages/eslint-plugin-nx'],
          },
          'build-base': {
            executor: '@nrwl/node:package',
            options: {
              outputPath: 'build/packages/eslint-plugin-nx',
              tsConfig: 'packages/eslint-plugin-nx/tsconfig.lib.json',
              packageJson: 'packages/eslint-plugin-nx/package.json',
              main: 'packages/eslint-plugin-nx/src/index.ts',
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
                {
                  input: 'packages/eslint-plugin-nx',
                  glob: '**/*.d.ts',
                  output: '/',
                },
                'LICENSE',
              ],
            },
            outputs: ['{options.outputPath}'],
          },
          build: {
            executor: '@nrwl/workspace:run-commands',
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
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'packages/eslint-plugin-nx/**/*.ts',
                'packages/eslint-plugin-nx/**/*.spec.ts',
                'packages/eslint-plugin-nx/**/*_spec.ts',
                'packages/eslint-plugin-nx/**/*.spec.tsx',
                'packages/eslint-plugin-nx/**/*.spec.js',
                'packages/eslint-plugin-nx/**/*.spec.jsx',
                'packages/eslint-plugin-nx/**/*.d.ts',
              ],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/eslint-plugin-nx/.eslintrc.json',
            hash: '4c778b45385793614535314f68a092d8cd67bf32',
            ext: '.json',
          },
          {
            file: 'packages/eslint-plugin-nx/jest.config.js',
            hash: '9801a3ddefd3b4593a1be5422728c2a23caf5059',
            ext: '.js',
          },
          {
            file: 'packages/eslint-plugin-nx/package.json',
            hash: '4e151b0ca87786ed8bf4796b831074660f00400c',
            ext: '.json',
          },
          {
            file: 'packages/eslint-plugin-nx/README.md',
            hash: 'e7eb743a55eed5fa89ac61db0a4e69680ef449ad',
            ext: '.md',
          },
          {
            file: 'packages/eslint-plugin-nx/src/configs/angular-template.ts',
            hash: '2b3f7f61b01acf2d0f989e7dd71ff80854711e03',
            ext: '.ts',
          },
          {
            file: 'packages/eslint-plugin-nx/src/configs/angular.ts',
            hash: '2bad9512dca202b3ae557d1ddcc2b45b7d788056',
            ext: '.ts',
          },
          {
            file: 'packages/eslint-plugin-nx/src/configs/javascript.ts',
            hash: '3b02eb07fd6428bff79f66ac630a125161f761ea',
            ext: '.ts',
          },
          {
            file: 'packages/eslint-plugin-nx/src/configs/react-base.ts',
            hash: '892760cd1fcf978f255b96bcce66cf05ef90c3af',
            ext: '.ts',
          },
          {
            file: 'packages/eslint-plugin-nx/src/configs/react-jsx.ts',
            hash: 'ec5778995add239466842b41ebc62afb9d1702f8',
            ext: '.ts',
          },
          {
            file: 'packages/eslint-plugin-nx/src/configs/react-tmp.ts',
            hash: '1e6cae320fb6bac61848134fef90daa667587a9e',
            ext: '.ts',
          },
          {
            file: 'packages/eslint-plugin-nx/src/configs/react-typescript.ts',
            hash: 'f332ef226a8efa8fbe40ab754e6f23dd5cef7078',
            ext: '.ts',
          },
          {
            file: 'packages/eslint-plugin-nx/src/configs/typescript.ts',
            hash: 'f80241316359c02614ec21819e0bfaa2f72d29a0',
            ext: '.ts',
          },
          {
            file: 'packages/eslint-plugin-nx/src/index.ts',
            hash: '1ded1de6fe980433cef3c050a38d140b6214bcaf',
            ext: '.ts',
          },
          {
            file:
              'packages/eslint-plugin-nx/src/rules/enforce-module-boundaries.ts',
            hash: '40aff6616a3dffcfab5a2ca34a9c9becbce4ec48',
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
            hash: 'db1436684d3b03317cb0e7aa70c0b3afd234d5e8',
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
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/create-nx-plugin/jest.config.js',
              passWithNoTests: true,
            },
            outputs: ['coverage/packages/create-nx-plugin'],
          },
          'build-base': {
            executor: '@nrwl/node:package',
            options: {
              outputPath: 'build/packages/create-nx-plugin',
              tsConfig: 'packages/create-nx-plugin/tsconfig.lib.json',
              packageJson: 'packages/create-nx-plugin/package.json',
              main: 'packages/create-nx-plugin/bin/create-nx-plugin.ts',
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
                {
                  input: 'packages/create-nx-plugin',
                  glob: '**/*.d.ts',
                  output: '/',
                },
                'LICENSE',
              ],
            },
            outputs: ['{options.outputPath}'],
          },
          build: {
            executor: '@nrwl/workspace:run-commands',
            outputs: ['build/packages/create-nx-plugin'],
            options: {
              commands: [
                {
                  command: 'nx build-base create-nx-plugin',
                },
                {
                  command:
                    'node ./scripts/chmod build/packages/create-nx-plugin/bin/create-nx-plugin.js',
                },
                {
                  command: 'node ./scripts/copy-readme.js create-nx-workspace',
                },
              ],
              parallel: false,
            },
          },
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'packages/create-nx-plugin/**/*.ts',
                'packages/create-nx-plugin/**/*.spec.ts',
                'packages/create-nx-plugin/**/*_spec.ts',
                'packages/create-nx-plugin/**/*.spec.tsx',
                'packages/create-nx-plugin/**/*.spec.js',
                'packages/create-nx-plugin/**/*.spec.jsx',
                'packages/create-nx-plugin/**/*.d.ts',
              ],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/create-nx-plugin/.eslintrc.json',
            hash: '6ab6a99935b238635f4e18fe1864bfcf9588f6f2',
            ext: '.json',
          },
          {
            file: 'packages/create-nx-plugin/bin/create-nx-plugin.ts',
            hash: 'db683778d679271d79d351f53415814e5b88795d',
            ext: '.ts',
          },
          {
            file: 'packages/create-nx-plugin/bin/shared.ts',
            hash: '0169f9f729f3dbeacdfba7f7ec8305e7a55a494f',
            ext: '.ts',
          },
          {
            file: 'packages/create-nx-plugin/jest.config.js',
            hash: '1ec7225bf5803e5eaf3321939b2a4df9716aa8f8',
            ext: '.js',
          },
          {
            file: 'packages/create-nx-plugin/package.json',
            hash: '001ed7f7245a4d4dabff5d722f3b21269e8eb65e',
            ext: '.json',
          },
          {
            file: 'packages/create-nx-plugin/README.md',
            hash: '24b97e55f793e1ae9619a0685b7fc504b87c8f78',
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
    'nx-dev-feature-doc-viewer': {
      name: 'nx-dev-feature-doc-viewer',
      type: 'lib',
      data: {
        root: 'nx-dev/feature-doc-viewer',
        sourceRoot: 'nx-dev/feature-doc-viewer/src',
        projectType: 'library',
        targets: {
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'nx-dev/feature-doc-viewer/**/*.{ts,tsx,js,jsx}',
              ],
            },
          },
          test: {
            executor: '@nrwl/jest:jest',
            outputs: ['coverage/nx-dev/feature-doc-viewer'],
            options: {
              jestConfig: 'nx-dev/feature-doc-viewer/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        tags: ['scope:nx-dev', 'type:feature'],
        files: [
          {
            file: 'nx-dev/feature-doc-viewer/.babelrc',
            hash: '09d67939cc9202e50c7cf5b012c0d3136306e725',
            ext: '',
          },
          {
            file: 'nx-dev/feature-doc-viewer/.eslintrc.json',
            hash: 'ce08cad8a7cb345aec321cc72a170ac82e8e9e4a',
            ext: '.json',
          },
          {
            file: 'nx-dev/feature-doc-viewer/jest.config.js',
            hash: 'f738f6075d2d7478c25e120bbd4a3cb28b39f7af',
            ext: '.js',
          },
          {
            file: 'nx-dev/feature-doc-viewer/README.md',
            hash: 'fb159c010c890849648d1e141a945ee16541e9ac',
            ext: '.md',
          },
          {
            file: 'nx-dev/feature-doc-viewer/src/index.ts',
            hash: '36f4daaa68475ed88055ed2fde295065d3536ce4',
            ext: '.ts',
          },
          {
            file: 'nx-dev/feature-doc-viewer/src/lib/content.spec.tsx',
            hash: '236c7822cc12cde6cd5bcda62636092274796cc6',
            ext: '.tsx',
          },
          {
            file: 'nx-dev/feature-doc-viewer/src/lib/content.tsx',
            hash: '30559c458bd7c23734a03ff9448293c4f371a34a',
            ext: '.tsx',
          },
          {
            file: 'nx-dev/feature-doc-viewer/src/lib/doc-viewer.spec.tsx',
            hash: '75571a9a84c5dd2f7e9eb090e7c62908a11c69e9',
            ext: '.tsx',
          },
          {
            file: 'nx-dev/feature-doc-viewer/src/lib/doc-viewer.tsx',
            hash: 'ea7b1aaa882afaa0197a5a960d074f71dcfb135d',
            ext: '.tsx',
          },
          {
            file: 'nx-dev/feature-doc-viewer/src/lib/sidebar.spec.tsx',
            hash: '54b0c4baf7a094410959590e62ce05dec4258312',
            ext: '.tsx',
          },
          {
            file: 'nx-dev/feature-doc-viewer/src/lib/sidebar.tsx',
            hash: '77f2af742f5ec952bbc7e08f1892fddde5f448e0',
            ext: '.tsx',
          },
          {
            file: 'nx-dev/feature-doc-viewer/src/lib/toc.spec.tsx',
            hash: '27584108ea414d845c6ec970bc2167a690f4b0aa',
            ext: '.tsx',
          },
          {
            file: 'nx-dev/feature-doc-viewer/src/lib/toc.tsx',
            hash: 'bb0e66802060006c508b7a10b18f97ab32f5e4ba',
            ext: '.tsx',
          },
          {
            file: 'nx-dev/feature-doc-viewer/tsconfig.json',
            hash: 'd8eb687121eddfbb13549fcb4f716217dfdddea8',
            ext: '.json',
          },
          {
            file: 'nx-dev/feature-doc-viewer/tsconfig.lib.json',
            hash: 'b560bc4dec6edf66358a7562712e0afdd2903042',
            ext: '.json',
          },
          {
            file: 'nx-dev/feature-doc-viewer/tsconfig.spec.json',
            hash: '1798b378a998ed74ef92f3e98f95e60c58bcba37',
            ext: '.json',
          },
        ],
      },
    },
    'dep-graph-dep-graph-e2e': {
      name: 'dep-graph-dep-graph-e2e',
      type: 'e2e',
      data: {
        root: 'dep-graph/dep-graph-e2e',
        sourceRoot: 'dep-graph/dep-graph-e2e/src',
        projectType: 'application',
        targets: {
          e2e: {
            executor: '@nrwl/cypress:cypress',
            options: {
              cypressConfig: 'dep-graph/dep-graph-e2e/cypress.json',
              tsConfig: 'dep-graph/dep-graph-e2e/tsconfig.e2e.json',
              devServerTarget: 'dep-graph-dep-graph:serve',
            },
          },
          lint: {
            executor: '@nrwl/linter:lint',
            options: {
              linter: 'eslint',
              tsConfig: ['dep-graph/dep-graph-e2e/tsconfig.e2e.json'],
              exclude: ['**/node_modules/**', '!dep-graph/dep-graph-e2e/**/*'],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'dep-graph/dep-graph-e2e/.eslintrc',
            hash: 'a15e6e72c6c672e40e179b07bade85d47377d8c9',
            ext: '',
          },
          {
            file: 'dep-graph/dep-graph-e2e/cypress.json',
            hash: '9d3462ef1752851c5a60202b7aef2ab6099d2c00',
            ext: '.json',
          },
          {
            file: 'dep-graph/dep-graph-e2e/src/fixtures/example.json',
            hash: '294cbed6ce9e0b948b787452e8676aee486cb3be',
            ext: '.json',
          },
          {
            file: 'dep-graph/dep-graph-e2e/src/integration/app.spec.ts',
            hash: 'f51b9a6e808cf6675d34984877f04349a2ee58d1',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph-e2e/src/plugins/index.js',
            hash: '9067e75a258dadf5a02b2a91c64f5acee1af17fd',
            ext: '.js',
          },
          {
            file: 'dep-graph/dep-graph-e2e/src/support/app.po.ts',
            hash: 'ae388a0059dc32b0db6cdcc0198739cb2b2847c5',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph-e2e/src/support/commands.ts',
            hash: '61b3a3e35770234a5aa9e31b07870b9292ec52ba',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph-e2e/src/support/index.ts',
            hash: '3d469a6b6cf31eb66117d73e278bcf74f398f1db',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph-e2e/tsconfig.e2e.json',
            hash: '9dc3660a79ee2f6daf097b4930427223896e3b25',
            ext: '.json',
          },
          {
            file: 'dep-graph/dep-graph-e2e/tsconfig.json',
            hash: '08841a7f56c62d55340ad08451502304837254fd',
            ext: '.json',
          },
        ],
      },
    },
    'dep-graph-dep-graph': {
      name: 'dep-graph-dep-graph',
      type: 'app',
      data: {
        root: 'dep-graph/dep-graph',
        sourceRoot: 'dep-graph/dep-graph/src',
        projectType: 'application',
        targets: {
          'build-base': {
            executor: '@nrwl/web:build',
            options: {
              maxWorkers: 8,
              outputPath: 'build/apps/dep-graph',
              index: 'dep-graph/dep-graph/src/index.html',
              main: 'dep-graph/dep-graph/src/main.ts',
              polyfills: 'dep-graph/dep-graph/src/polyfills.ts',
              tsConfig: 'dep-graph/dep-graph/tsconfig.app.json',
              assets: [
                'dep-graph/dep-graph/src/favicon.ico',
                'dep-graph/dep-graph/src/assets',
              ],
              styles: ['dep-graph/dep-graph/src/styles.scss'],
              scripts: [],
            },
            configurations: {
              release: {
                fileReplacements: [
                  {
                    replace:
                      'dep-graph/dep-graph/src/environments/environment.ts',
                    with:
                      'dep-graph/dep-graph/src/environments/environment.release.ts',
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
            outputs: ['{options.outputPath}'],
          },
          serve: {
            executor: '@nrwl/web:dev-server',
            options: {
              buildTarget: 'dep-graph-dep-graph:build-base',
            },
            configurations: {
              release: {
                buildTarget: 'dep-graph-dep-graph:build-base:release',
              },
            },
          },
          lint: {
            executor: '@nrwl/linter:lint',
            options: {
              linter: 'eslint',
              tsConfig: [
                'dep-graph/dep-graph/tsconfig.app.json',
                'dep-graph/dep-graph/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!dep-graph/dep-graph/**/*'],
            },
          },
          test: {
            executor: '@nrwl/jest:jest',
            outputs: ['coverage/dep-graph/dep-graph'],
            options: {
              jestConfig: 'dep-graph/dep-graph/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        tags: ['core'],
        files: [
          {
            file: 'dep-graph/dep-graph/.babelrc',
            hash: '0cae4a9a81270d6cf3315436f594bf2fbd4fb3e2',
            ext: '',
          },
          {
            file: 'dep-graph/dep-graph/.eslintrc',
            hash: 'ab8f38339cde4762a7feb906e9e0f963958e3f93',
            ext: '',
          },
          {
            file: 'dep-graph/dep-graph/browserslist',
            hash: '8d6179367e7ba6b8cd0fa04b900d6ab4142ab08b',
            ext: '',
          },
          {
            file: 'dep-graph/dep-graph/jest.config.js',
            hash: 'cee13c63f520916225f1d07b89b427365cee0e3d',
            ext: '.js',
          },
          {
            file: 'dep-graph/dep-graph/src/app/app.ts',
            hash: 'e750d2ad69eb7cc022cedc29882cf673524862d9',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/src/app/debugger-panel.ts',
            hash: 'e4f66b0e3f6d309a456051683a77ce9444852135',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/src/app/graph.ts',
            hash: 'ba33bfd4ffec9ab6564d6c2db32128ed9dd2cee6',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/src/app/models.ts',
            hash: 'a216e9f1e46bc0f3d2fdf0ba827421e92e1f3ac0',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/src/app/project-node-tooltip.ts',
            hash: '3bc100cdc865ab71eac407299bf02d732eae9f38',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/src/app/styles-graph/edges.ts',
            hash: '3ed6b537302d2b6f12d19e910da50ffc09951f26',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/src/app/styles-graph/fonts.ts',
            hash: '82fdbeee7810db91a5cb883e78a5d08c87985059',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/src/app/styles-graph/index.ts',
            hash: 'c557f1698c2309a3dfa1ae30e75db9e16d1a3cc6',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/src/app/styles-graph/nodes.ts',
            hash: 'f63e5cd023f6f3c49763ad6f086ef766f026d6a3',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/src/app/styles-graph/palette.ts',
            hash: 'ef5e4aba5ebe0da11e667cf440cb4eed75973241',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/src/app/tooltip-service.ts',
            hash: '9ff04dc6ba03b135135a4485d793d44f366cc651',
            ext: '.ts',
          },
          {
            file:
              'dep-graph/dep-graph/src/app/ui-sidebar/display-options-panel.ts',
            hash: 'bb5a1879b5904e2279ca4bee930fcf0456b4b22f',
            ext: '.ts',
          },
          {
            file:
              'dep-graph/dep-graph/src/app/ui-sidebar/focused-project-panel.ts',
            hash: 'cd3580c3af4fb3452d34156897b7285de0c20325',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/src/app/ui-sidebar/project-list.ts',
            hash: '0938b4bb1c20d4f0097947789c8972947d5da369',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/src/app/ui-sidebar/sidebar.ts',
            hash: '14184f36e16344a7ac792d56d5428616fce72e02',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/src/app/ui-sidebar/text-filter-panel.ts',
            hash: 'd4865714fdf863bbec42f6f92a69b0b69d25ab21',
            ext: '.ts',
          },
          {
            file:
              'dep-graph/dep-graph/src/app/util-cytoscape/cytoscape.models.ts',
            hash: '6e0e73f7943cb0b1eec83bd587482c3271a94143',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/src/app/util-cytoscape/edge.ts',
            hash: '772411f6f2528539c5bf77b57245a8639beae9a8',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/src/app/util-cytoscape/index.ts',
            hash: 'f10dc4ac0b409f488a70b6cbc7ece930534beb8a',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/src/app/util-cytoscape/parent-node.ts',
            hash: '0a11c00c4831df8986c37fbb94a124d0c001e05e',
            ext: '.ts',
          },
          {
            file:
              'dep-graph/dep-graph/src/app/util-cytoscape/project-node.spec.ts',
            hash: '5a1f58ef722d3ad73502c98b62ee9a8a55a4f845',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/src/app/util-cytoscape/project-node.ts',
            hash: 'f028c7f5ec34dfb192da791403178725e7d2387e',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/src/app/util.ts',
            hash: 'd25aed24b525e4bde71966e261548e5686f63dbd',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/src/assets/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file: 'dep-graph/dep-graph/src/environments/environment.release.ts',
            hash: '51de6f51f456ecaaef8f362d5070e65f47098795',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/src/environments/environment.ts',
            hash: '844c89f2f270a0a7065ae3bf69b1eccb31d3384d',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/src/favicon.ico',
            hash: '317ebcb2336e0833a22dddf0ab287849f26fda57',
            ext: '.ico',
          },
          {
            file: 'dep-graph/dep-graph/src/globals.d.ts',
            hash: '900abe18aaac3c040dd7ce1716044e7ef3323e2e',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/src/graphs/index.ts',
            hash: '8adddf98029cef7e66aff6dc5021a8f6480f14fe',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/src/graphs/medium.ts',
            hash: 'f6e718b2f918102c10e505ada4d92b8d61a7d940',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/src/graphs/small.ts',
            hash: 'f525f73aa15e8040451bf735a901193b8419a164',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/src/graphs/storybook.ts',
            hash: 'd78179e9445abde5cc0ab5e66b0e92bbaa1bc41b',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/src/graphs/sub-apps.ts',
            hash: 'd56b2bbe144ed9b613b44878552a1ae639dca9fb',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/src/index.html',
            hash: '213670cf70602594d4f35320cec2fd3944953b43',
            ext: '.html',
          },
          {
            file: 'dep-graph/dep-graph/src/main.ts',
            hash: 'b2ec8b2c94c606a4858d66583250600c7060a456',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/src/polyfills.ts',
            hash: '2adf3d05b6fcf479dd61c74f6bda95d9edb6ac6b',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/src/styles.scss',
            hash: 'fd3595f98d7d50f990a9720060569fa7fc89e080',
            ext: '.scss',
          },
          {
            file: 'dep-graph/dep-graph/src/test-setup.ts',
            hash: 'd8508d703266e7390b30189d3cf7fec7a70b198c',
            ext: '.ts',
          },
          {
            file: 'dep-graph/dep-graph/tsconfig.app.json',
            hash: '393d04013aa3241949442dedadb41b06e76e7499',
            ext: '.json',
          },
          {
            file: 'dep-graph/dep-graph/tsconfig.json',
            hash: '63dbe35fb282d5f9ac4a724607173e6316269e29',
            ext: '.json',
          },
          {
            file: 'dep-graph/dep-graph/tsconfig.spec.json',
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
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/workspace/jest.config.js',
              passWithNoTests: true,
            },
            outputs: ['coverage/packages/workspace'],
          },
          'build-base': {
            executor: '@nrwl/node:package',
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
                {
                  input: 'packages/workspace',
                  glob: '**/*.d.ts',
                  output: '/',
                },
                'LICENSE',
              ],
            },
            outputs: ['{options.outputPath}'],
          },
          build: {
            executor: '@nrwl/workspace:run-commands',
            outputs: ['build/packages/workspace'],
            options: {
              commands: [
                {
                  command: 'nx build-base workspace',
                },
                {
                  command:
                    'nx build-base dep-graph-dep-graph --configuration release',
                },
                {
                  command: 'node ./scripts/copy-dep-graph.js',
                },
                {
                  command: 'node ./scripts/copy-readme.js workspace',
                },
              ],
              parallel: false,
            },
          },
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'packages/workspace/**/*.ts',
                'packages/workspace/**/*.spec.ts',
                'packages/workspace/**/*.spec.tsx',
                'packages/workspace/**/*.spec.js',
                'packages/workspace/**/*.spec.jsx',
                'packages/workspace/**/*.d.ts',
              ],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/workspace/.babelrc',
            hash: '0cae4a9a81270d6cf3315436f594bf2fbd4fb3e2',
            ext: '',
          },
          {
            file: 'packages/workspace/.eslintrc.json',
            hash: '2d0c290869a63c9282fd1b809309b63a0c122d17',
            ext: '.json',
          },
          {
            file: 'packages/workspace/builders.json',
            hash: '12815591f94630b79afc958dd5c7d7a5ce5d82c8',
            ext: '.json',
          },
          {
            file: 'packages/workspace/collection.json',
            hash: 'fe67dcfba6e123dd5a800dc8faeda10974e283c2',
            ext: '.json',
          },
          {
            file: 'packages/workspace/docs/run-commands-examples.md',
            hash: '29a802a94c8412888d483d6032a8bf136cecf235',
            ext: '.md',
          },
          {
            file: 'packages/workspace/generators.ts',
            hash: '14e3677af0957743325a6ab5058eac817b6d62e6',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/index.ts',
            hash: 'b11929ffe6e117dd49b05d14e0676fc89dbef672',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/jest.config.js',
            hash: 'c92eb4a3788ef7eeb90adb608e78098d3815a317',
            ext: '.js',
          },
          {
            file: 'packages/workspace/migrations.json',
            hash: 'b6dec206f645fc616a4c713939eb00326c5157a5',
            ext: '.json',
          },
          {
            file: 'packages/workspace/package.json',
            hash: 'c20560d1ca9efcd5160c49703f1d1073a6b0fc62',
            ext: '.json',
          },
          {
            file: 'packages/workspace/README.md',
            hash: '211a67fd391af4428501707b15b77d939348c1ac',
            ext: '.md',
          },
          {
            file: 'packages/workspace/src/command-line/affected.ts',
            hash: '80f829b8baa5d1cf231397ca1aaba742e2463ce6',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/connect-to-nx-cloud.ts',
            hash: 'fa62ebaa6d969af3cc74a5e245287b96e6236d93',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/dep-graph.ts',
            hash: 'd2ad25ad02e50452e38d9ae44221e5f8457bd373',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/format.ts',
            hash: '206c27b55304f7b843e23faa1151d7e4127466ed',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/lint.ts',
            hash: '4487978b7f7fdf2fb3eb80bbd1ffe7b8f14aa639',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/list.ts',
            hash: '1b93a2a7b510c0cffc4bc69bfb950c3e432ec915',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/nx-commands.ts',
            hash: '80375f39f63a2f712caa6bda016b562177a82932',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/print-affected.spec.ts',
            hash: '7cd4a5e1ae17f65fb782c468126f07fd15156076',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/print-affected.ts',
            hash: '8d8bd0355ab0a5df1c3c3f78b2af9557ede30302',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/report.ts',
            hash: '2b55ae50cb5dc1b34afbe2bd0d7c427bd1d5fc79',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/run-many.ts',
            hash: '8da2081f1cab553af9d6c92a2b40e89748f3d293',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/run-one.ts',
            hash: '067b0f0b7918bb259f7c8251f9bbebfec6a9a48a',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/shared.ts',
            hash: 'eb1bf021f0f2cbe9e235eff3cb53390a22a49c62',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/command-line/supported-nx-commands.ts',
            hash: '8a518501dc1d0918bd558823cadaa0ddc980947d',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/utils.spec.ts',
            hash: '8da03719fd565773073b9e8f56b8f61afcd1f9e5',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/utils.ts',
            hash: '08c3c38a5593fad138618610f776fe4dd028ae86',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/workspace-generators.ts',
            hash: 'c918854498b97e24516a6a6ebcd5339726a5279e',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/command-line/workspace-integrity-checks.spec.ts',
            hash: 'f4886ce45d84cc38d1965232a251c7ec5cccbc54',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/command-line/workspace-integrity-checks.ts',
            hash: '0f0f7e1c0c9deeaeefde92606b90aaab7c7579ed',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/command-line/workspace-results.spec.ts',
            hash: '457a27227a8aa45836759272a8843f22a710981f',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/command-line/workspace-results.ts',
            hash: '4e21613a9f5952f1169dc12b7b8194de34ce361b',
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
            hash: 'c042fb9cdc3c93c5b3e7f0bd62041ecc4248f85f',
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
            hash: '549dda7ffc18f5c928f11cfd9114bd65394c54fe',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/affected-project-graph/locators/implicit-json-changes.ts',
            hash: '7d591348450d74880eda90c937a1973597d364f3',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/affected-project-graph/locators/npm-packages.spec.ts',
            hash: '3401a61fdd7819670af7de9dc92a954df9b79f99',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/affected-project-graph/locators/npm-packages.ts',
            hash: '6796670353d55c1b5c123076cc72ff7f2cb777f3',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/affected-project-graph/locators/nx-json-changes.spec.ts',
            hash: '3b279a4b431c816f234536bacc8bf4664015bef0',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/affected-project-graph/locators/nx-json-changes.ts',
            hash: '4ab7074a3093c34b271e40b5d17a501f76cc047c',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/affected-project-graph/locators/tsconfig-json-changes.spec.ts',
            hash: 'abe782b9f1f5d171a2b5cef19eca10a7e1d75940',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/affected-project-graph/locators/tsconfig-json-changes.ts',
            hash: 'ceedd70d17f92a211f6c80d368aae323c2b06657',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/affected-project-graph/locators/workspace-json-changes.spec.ts',
            hash: 'a2af75869c1725346f11fdcc414aad268a8b55d6',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/affected-project-graph/locators/workspace-json-changes.ts',
            hash: 'a0acb652db0e38f61bdb1911404bbf129be52eaf',
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
            hash: '1acb2f41401c5a5a4c35c30130675f109438a560',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/assert-workspace-validity.spec.ts',
            hash: '8ac4e08e01d7b195f85e8b2e00fa45fe2bdef944',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/assert-workspace-validity.ts',
            hash: '3a8449b1abc37560cdaf564bf381d2b591e7cae2',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/file-graph/file-map.spec.ts',
            hash: '299a9370068cc79fc0b6afb1ec2694fe45eef7ab',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/file-graph/index.ts',
            hash: '5331116cab42a75269dcc1aa2aa7bb1f9f569223',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/file-graph/project-file-map.ts',
            hash: '3f6804b12f313cd6d70327c70e43e9cddf40310e',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/file-utils.spec.ts',
            hash: '0f57b3f454d2d4152d7b6e280c3e550ba6cd34ee',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/file-utils.ts',
            hash: '97a802967080d76c15133c5253adb4e02944598b',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/hasher/file-hasher.ts',
            hash: '66dd1912aed54c81f533ab2f4450626747165196',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/hasher/git-hasher.spec.ts',
            hash: '958e2af5875c9cf9ab6164b84342fea18d6ffca0',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/hasher/git-hasher.ts',
            hash: '690844746aab894492fc47473ec3abcff5bd6efb',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/hasher/hasher.spec.ts',
            hash: '80b2245800d2fa08ade2e820adfb3334af453d9f',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/hasher/hasher.ts',
            hash: '3068ded2b351dd3c503c6d5cf994770bd428a041',
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
            hash: '0c4f2b433c5887c8c3b8996681af59891886ee40',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/nx-deps/nx-deps-cache.ts',
            hash: 'ee5ef3f90b813b85aef217c2e5b2f19d49c8ce6c',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/project-graph/build-dependencies/build-dependencies.ts',
            hash: '62961502d138354c36fb78ac66d09c028e8e3875',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/project-graph/build-dependencies/explicit-package-json-dependencies.spec.ts',
            hash: '196309542e916932c0279dc6e81322c5f796213c',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/project-graph/build-dependencies/explicit-package-json-dependencies.ts',
            hash: 'dde9a84452fdb4f4f53760458e12920e11d07680',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/project-graph/build-dependencies/explicit-project-dependencies.spec.ts',
            hash: '3ce22df367cc451866c568a80e0c41684d32405e',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/project-graph/build-dependencies/explicit-project-dependencies.ts',
            hash: 'f83e08015473d2e2324b6eb0a92937cb94792f86',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/project-graph/build-dependencies/implicit-project-dependencies.ts',
            hash: '9523c0fc102916b077cad1bd63019516494b8708',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/project-graph/build-dependencies/index.ts',
            hash: 'b93a91df31232aa37fed3ebd656956da1154cac4',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/project-graph/build-dependencies/typescript-import-locator.ts',
            hash: '441b068b371e7c536d0d5a8ac46754bada3facbb',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/project-graph/build-nodes/build-nodes.ts',
            hash: '2e5cbd2467e71db40c5e2554c5db7d7f1868be3d',
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
            hash: 'a76ee9d1799abdbea422ab1ea9a8f9e30e4c52cd',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/project-graph/build-nodes/workspace-projects.ts',
            hash: 'cf38434538f3184fec3b1e216dd9e2389f3efb08',
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
            hash: 'a4c158ac2ced7b2029bd90452232adbc2691d0c4',
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
            hash: 'e9e7e6fc23f0d8979946b20f4be72c0ede58e30e',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/project-graph/project-graph-models.ts',
            hash: 'fb283ed9b2ac389d5cfad3bab70e84663b110864',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/core/project-graph/project-graph.spec.ts',
            hash: '2e1d09627f726e2d7b59bed0560dd4a4aaee45ba',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/project-graph/project-graph.ts',
            hash: '2f048201bb2c7fe930dc2b6c2187bb2cdd190d08',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/shared-interfaces.ts',
            hash: '0344b5ee713832a521a5517ee12e63c55fb108f9',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/target-project-locator.spec.ts',
            hash: '25d5c5b6a0abd53f6201e72ae30e4c8f22d0615f',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/core/target-project-locator.ts',
            hash: '8badaa37abf2d3e9d1297fadc8400c0da4c7a746',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/devkit-reexport.ts',
            hash: '93930f63877e852824e053490fb172fb01bd7a4c',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/executors/counter/counter.impl.ts',
            hash: 'fcdd1ef4e17b0dc934af71d1b46bff0f5d74abae',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/executors/counter/schema.json',
            hash: '0b88dc20572303238af9d0dc03b7171e4abca017',
            ext: '.json',
          },
          {
            file: 'packages/workspace/src/executors/run-commands/compat.ts',
            hash: 'c9d7cf04d19b5e083a4d1fc6625d2768b8c40c68',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/executors/run-commands/run-commands.impl.spec.ts',
            hash: 'df266f88e608daa65ef958e5b618a6e56f340172',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/executors/run-commands/run-commands.impl.ts',
            hash: 'b47d6ba9980ab9e94527f6a0b59c7568ac3529db',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/executors/run-commands/schema.json',
            hash: 'fa639823717f3f59a197dd17bc3398794baf75cc',
            ext: '.json',
          },
          {
            file: 'packages/workspace/src/executors/run-script/compat.ts',
            hash: '3cb0469557bc192ef89cbd6160844be54ca4316f',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/executors/run-script/run-script.impl.ts',
            hash: '1b0f5cdd8c6c5ace928f33f5d59d244876d5437f',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/executors/run-script/schema.json',
            hash: 'd584c1eb64fc585acf3a0651460c42f35e1096de',
            ext: '.json',
          },
          {
            file:
              'packages/workspace/src/generators/init/__snapshots__/init.spec.ts.snap',
            hash: 'b98a943c473f48992242ca7737ee6598c988c10c',
            ext: '.snap',
          },
          {
            file:
              'packages/workspace/src/generators/init/files/prettier/.prettierignore',
            hash: '931aad9929fc2cad371db36caa49ed4de357ab9d',
            ext: '',
          },
          {
            file:
              'packages/workspace/src/generators/init/files/root/karma.conf.js',
            hash: '2c5a16ceedb8c308f6adf452d6c8aad215c9be88',
            ext: '.js',
          },
          {
            file:
              'packages/workspace/src/generators/init/files/root/tools/schematics/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file:
              'packages/workspace/src/generators/init/files/root/tools/tsconfig.tools.json',
            hash: '99428e1473febd3534100c4ce261c5904b461d8a',
            ext: '.json',
          },
          {
            file: 'packages/workspace/src/generators/init/init.spec.ts',
            hash: '329b9c27e0a049eea5d86beda5651729989d1e8e',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/generators/init/init.ts',
            hash: '916918eb747818ad9a0782d921c4a33964e5fd86',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/generators/init/schema.d.ts',
            hash: '0c3ec4048b5300b6e7922d5790d5cc5129d1b287',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/generators/init/schema.json',
            hash: '0f080310cded01cd1475b9febb65083c133102f2',
            ext: '.json',
          },
          {
            file:
              'packages/workspace/src/generators/library/files/lib/__dot__babelrc__tmpl__',
            hash: 'cf7ddd99c615a064ac18eb3109eee4f394ab1faf',
            ext: '',
          },
          {
            file:
              'packages/workspace/src/generators/library/files/lib/README.md',
            hash: '6346442e498b14607dad12f725a7b227a4822591',
            ext: '.md',
          },
          {
            file:
              'packages/workspace/src/generators/library/files/lib/src/index.ts__tmpl__',
            hash: '32176b3ef175e1c81af513d1381762f4dca7e1b2',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/workspace/src/generators/library/files/lib/src/lib/__fileName__.spec.ts__tmpl__',
            hash: '35b0948b95087892cb9694ff9880cf254de6985e',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/workspace/src/generators/library/files/lib/src/lib/__fileName__.ts__tmpl__',
            hash: 'ae311e3ac41f0b1ffb8f097e7f4e27ca08512f91',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/workspace/src/generators/library/files/lib/tsconfig.json',
            hash: '83a68fa354843a9eeeab4fb3319f1d5b533f4b19',
            ext: '.json',
          },
          {
            file:
              'packages/workspace/src/generators/library/files/lib/tsconfig.lib.json',
            hash: '26b2087e78595a2b6289ba27b412768248e05ce4',
            ext: '.json',
          },
          {
            file: 'packages/workspace/src/generators/library/library.spec.ts',
            hash: '5efd98ea1f0f3d3e4774a02e049f57411fac015c',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/generators/library/library.ts',
            hash: '0967a57047ede72e7647977cec0cf3918b0e9690',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/generators/library/schema.d.ts',
            hash: '2993240d0b9ab539ff64eb8d3dfcbbf00726c5f1',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/generators/library/schema.json',
            hash: '5b1aea75b4456d08b185c4377504068bd447fb2c',
            ext: '.json',
          },
          {
            file:
              'packages/workspace/src/generators/move/lib/__snapshots__/update-imports.spec.ts.snap',
            hash: '8a0103dc3c09344955f23fd39e7b8bd978c704a5',
            ext: '.snap',
          },
          {
            file:
              'packages/workspace/src/generators/move/lib/check-destination.spec.ts',
            hash: '5128c9c3f947c83df4a1b882ead15ff3eb8830a4',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/move/lib/check-destination.ts',
            hash: '60c6f86d065dce4caa618bc3b9b2a4f82925a895',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/move/lib/move-project-configuration.spec.ts',
            hash: '4832281e7cb4ac9029549cc6f6025d00db139303',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/move/lib/move-project-configuration.ts',
            hash: '6a63a741cfd538147b8cbf096f63e235bb7c8885',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/move/lib/move-project.spec.ts',
            hash: 'f71b88cbc292f190d94424ce8cd1bcf1be0a26a8',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/generators/move/lib/move-project.ts',
            hash: '27c49a60dc19848ee2d98ffbe92a938e81b28bc4',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/move/lib/update-build-targets.spec.ts',
            hash: '6ab0a72e1acc525776905afff43fb5a1fa1d0517',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/move/lib/update-build-targets.ts',
            hash: '3163487b6d6a005ed51801792d4da9beeb463822',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/move/lib/update-cypress-json.spec.ts',
            hash: '546ea42e158cb63d89c77591cf069553fbf1d7a3',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/move/lib/update-cypress-json.ts',
            hash: '46e09aabd4645c5eab85cfdee7e27a2c6fe4de65',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/move/lib/update-default-project.spec.ts',
            hash: 'af72f5d4504737f0d5a2c5e45e7cb48a4acbd4bc',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/move/lib/update-default-project.ts',
            hash: '56d17e3488e21cf80edd07ade7b868be2f9d3f7d',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/move/lib/update-eslintrc-json.spec.ts',
            hash: '565c598623dffeacb6d61756376f29e318ad3d55',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/move/lib/update-eslintrc-json.ts',
            hash: '75611568238e75e9920a2231f9d00b795a002c5b',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/move/lib/update-implicit-dependencies.spec.ts',
            hash: '0d25a2daed0864744600c15d9a83ed9525c43b61',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/move/lib/update-implicit-dependencies.ts',
            hash: '816f185face337ad61894e4785a256213a29e72d',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/move/lib/update-imports.spec.ts',
            hash: '871519c170cd93e96060b4df0d46828eb934994c',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/move/lib/update-imports.ts',
            hash: '35711c568c96da8e8231b97a6122afe4c5f9d626',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/move/lib/update-jest-config.spec.ts',
            hash: '65bb4be6c45747257411990abd5726b61926b5a2',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/move/lib/update-jest-config.ts',
            hash: '8246c4eb658329c02175586e34b38c76b52c18d2',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/move/lib/update-project-root-files.spec.ts',
            hash: '92d160e66ed9216e1940fd1b8e02d901b6d26923',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/move/lib/update-project-root-files.ts',
            hash: '55d79c660bd6431dab03dd02322a57d04ab5b4ff',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/move/lib/update-storybook-config.spec.ts',
            hash: 'eebe9af7b1f7c6e1c9a9ab6a26d41727aa91368b',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/move/lib/update-storybook-config.ts',
            hash: '14e9060566e6b18f52e28706ccd26935c15e44ce',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/generators/move/lib/utils.ts',
            hash: '26b5453c777b9649fcd08cfab85ab08f3e27bef7',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/generators/move/move.ts',
            hash: '5e8ddb8cb483fbfa4c0dea54f25df165c99004b8',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/generators/move/schema.d.ts',
            hash: 'd5410c04ffa808375b6145e90d5437f3b56a21d0',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/generators/move/schema.json',
            hash: 'fb73b430981dd302e0715f7659d3b48b93458552',
            ext: '.json',
          },
          {
            file:
              'packages/workspace/src/generators/new/__snapshots__/new.spec.ts.snap',
            hash: '9c7b12dee5710d9d7bbbf6a152e85420134d06ed',
            ext: '.snap',
          },
          {
            file: 'packages/workspace/src/generators/new/new.spec.ts',
            hash: '5438b817602007fb9b395d862bbc79df003dba77',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/generators/new/new.ts',
            hash: '2653964547addab2e2dadee471aed2a6c7163b6d',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/generators/new/schema.json',
            hash: '0d3cb93c23d022358ae59ffcdafe21462f15955e',
            ext: '.json',
          },
          {
            file:
              'packages/workspace/src/generators/preset/__snapshots__/preset.spec.ts.snap',
            hash: 'a44d399a1b5e503508c15a0339485b9846e4319e',
            ext: '.snap',
          },
          {
            file:
              'packages/workspace/src/generators/preset/files/angular/app.module.ts',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/generators/preset/preset.spec.ts',
            hash: '9734fccc843264b15aa159a5405dc2edc18132fe',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/generators/preset/preset.ts',
            hash: 'd129d23c56aa627c61f41c9ef5207554c25c04c8',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/generators/preset/schema.d.ts',
            hash: 'b1b43bc23bf47beb76bd1d2a9aea5b599aa8261a',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/generators/preset/schema.json',
            hash: 'bbc86c50dc3582231611b220d782ee9b3453d9a8',
            ext: '.json',
          },
          {
            file:
              'packages/workspace/src/generators/remove/lib/__snapshots__/update-jest-config.spec.ts.snap',
            hash: '049484599e15d3ee78685b64cfddeb7ab9c7b866',
            ext: '.snap',
          },
          {
            file:
              'packages/workspace/src/generators/remove/lib/check-dependencies.spec.ts',
            hash: 'ba1b09265bf8e3ed77267d05fafc6456cba2edca',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/remove/lib/check-dependencies.ts',
            hash: '84a0fc7da359a539f532dda2c6f0b587d7778a1d',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/remove/lib/check-targets.spec.ts',
            hash: '604898c0ac314a4608d88f50df207b4d443897b0',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/remove/lib/check-targets.ts',
            hash: 'af91cd1b2b51323289aa87cb6fc79959d5844fe2',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/remove/lib/remove-project-config.spec.ts',
            hash: 'b6c13d606ce063901ee7a2f88669d1844d219626',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/remove/lib/remove-project-config.ts',
            hash: '8ac38f77dd6ba16392918480c5b04f208b58b12c',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/remove/lib/remove-project.spec.ts',
            hash: 'c6dd60301c0c86860451bc15bd7114ea74105281',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/remove/lib/remove-project.ts',
            hash: '8e3a09309e3d2f63b6b310c3f1cb41c600743ad4',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/remove/lib/test-files/jest.config.js',
            hash: '77a1a0010c5572b94d35f495910e7f3e48a5424d',
            ext: '.js',
          },
          {
            file:
              'packages/workspace/src/generators/remove/lib/update-jest-config.spec.ts',
            hash: 'dfbd2f3adcf8d7800628de12c7b3b751d3cde64a',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/remove/lib/update-jest-config.ts',
            hash: 'de89784b308c0c3a0e7553a513d55b90bcecf6ad',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/remove/lib/update-tsconfig.spec.ts',
            hash: '3c4baa3ed9d7c7b28454e773f25064d115270aa8',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/remove/lib/update-tsconfig.ts',
            hash: '0f08c2681db480c8fe1f14092c8aad82bde72184',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/generators/remove/remove.ts',
            hash: '8684ccd58bdf7a2aec32dc1dc5dfa7419dbee7c6',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/generators/remove/schema.d.ts',
            hash: 'd69859109639ec77cb3bea0754554b415dde6e64',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/generators/remove/schema.json',
            hash: '2531b6314afae2fac18d38dda5a856cd86788944',
            ext: '.json',
          },
          {
            file:
              'packages/workspace/src/generators/run-commands/run-commands.spec.ts',
            hash: '2d9afdadae14359d9ad05d87c6d439c49074fc5a',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/run-commands/run-commands.ts',
            hash: '9d7d116ab1039ebaa5a3ffcf706775fa1df0d7bd',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/generators/run-commands/schema.d.ts',
            hash: '9a94e1a512445c9c9f8f1530e05e580e7bd2bf2c',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/generators/run-commands/schema.json',
            hash: 'a1da335895b16b2a19731bc7ed7c623647434510',
            ext: '.json',
          },
          {
            file:
              'packages/workspace/src/generators/utils/decorate-angular-cli.js__tmpl__',
            hash: 'bc81a83788969dfc51f47328faa716295a225f54',
            ext: '.js__tmpl__',
          },
          {
            file:
              'packages/workspace/src/generators/utils/insert-import.spec.ts',
            hash: '9e22d948d9e7263bf7093e95a0255068099ea608',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/generators/utils/insert-import.ts',
            hash: 'a32e781cc4f8f12a5e6634945a56d51377241243',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/utils/insert-statement.spec.ts',
            hash: 'a7b18d85622dedea975d4ca78f6841465ce32214',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/generators/utils/insert-statement.ts',
            hash: '45e173c840397316479a9057786a65ac8d8acdfc',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/workspace-generator/files/index.ts__tmpl__',
            hash: '9ee433719ba10d47d19ce2ed9d6b34614070e6d5',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/workspace/src/generators/workspace-generator/files/schema.json__tmpl__',
            hash: 'b46e83c1adc33d4b0f88f7016f482fb950db94d4',
            ext: '.json__tmpl__',
          },
          {
            file:
              'packages/workspace/src/generators/workspace-generator/schema.d.ts',
            hash: '13e049e4b1cd10337fe12395c79380c93137308b',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/workspace-generator/schema.json',
            hash: 'c664efc9e1fd43ea6235c5d8deefd4060dc0c417',
            ext: '.json',
          },
          {
            file:
              'packages/workspace/src/generators/workspace-generator/workspace-generator.spec.ts',
            hash: '23654e95f6400d04a70b6b4cecc1300f739902a8',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/workspace-generator/workspace-generator.ts',
            hash: '5da6bd54374f746f93155ad7294bcb8d14d7e8ed',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/generators/workspace/__snapshots__/workspace.spec.ts.snap',
            hash: 'aa6956d110114a52962e36436ea131371e4f482a',
            ext: '.snap',
          },
          {
            file:
              'packages/workspace/src/generators/workspace/files/__dot__editorconfig',
            hash: '6e87a003da89defd554080af5af93600cc9f91fe',
            ext: '',
          },
          {
            file:
              'packages/workspace/src/generators/workspace/files/__dot__gitignore',
            hash: 'ee5c9d8336b76b3bb5658d0888bdec86eb7b0990',
            ext: '',
          },
          {
            file:
              'packages/workspace/src/generators/workspace/files/__dot__prettierignore',
            hash: 'd0b804da2a462044bb1c63364440b2c2164e86ad',
            ext: '',
          },
          {
            file:
              'packages/workspace/src/generators/workspace/files/__dot__vscode/extensions.json__tmpl__',
            hash: '116b35fadacea33949feb622c944494d40ed23ab',
            ext: '.json__tmpl__',
          },
          {
            file:
              'packages/workspace/src/generators/workspace/files/__workspaceFile__.json',
            hash: '566bd7faeceb5adef91c7eed48a3f75c22ac8bf9',
            ext: '.json',
          },
          {
            file: 'packages/workspace/src/generators/workspace/files/nx.json',
            hash: 'e09a55270ffa170a424c708d3c6bb10930aabca6',
            ext: '.json',
          },
          {
            file:
              'packages/workspace/src/generators/workspace/files/package.json__tmpl__',
            hash: '1121dae0858c8c27c5b2a7fc91febee965bd2a5e',
            ext: '.json__tmpl__',
          },
          {
            file:
              'packages/workspace/src/generators/workspace/files/README.md__tmpl__',
            hash: '770712e0755ccbc540e5ce7789b2e1f411e83cb3',
            ext: '.md__tmpl__',
          },
          {
            file:
              'packages/workspace/src/generators/workspace/files/tools/generators/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file:
              'packages/workspace/src/generators/workspace/files/tools/tsconfig.tools.json',
            hash: '99428e1473febd3534100c4ce261c5904b461d8a',
            ext: '.json',
          },
          {
            file:
              'packages/workspace/src/generators/workspace/files/tsconfig.base.json',
            hash: '11253ac5c2b7bc7ccc8003036c9379134582575c',
            ext: '.json',
          },
          {
            file: 'packages/workspace/src/generators/workspace/schema.d.ts',
            hash: '4fe413cd9d9a50a017b015118551f8a19ea1d389',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/generators/workspace/schema.json',
            hash: '2217411e91f6e5d3891a8da967adb22ada85d6a4',
            ext: '.json',
          },
          {
            file:
              'packages/workspace/src/generators/workspace/workspace.spec.ts',
            hash: 'c30d19adaebe1fb7d54d4e0c00cc6df58dd7672c',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/generators/workspace/workspace.ts',
            hash: '79658de67036467879ad02816a206fc9af0f3142',
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
            hash: 'fd26bf016e19f905fd6563abc98fe74d67c68dc5',
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
              'packages/workspace/src/migrations/update-10-3-0/add-buildable-project-deps-in-package-json-type.spec.ts',
            hash: 'a0bad70d39f32a8ff93bc9076bedbd5345b472d2',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-10-3-0/add-buildable-project-deps-in-package-json-type.ts',
            hash: '26da497a5e2c75e199abd19b45902e66700b1dda',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-10-3-0/add-cli-dependency.spec.ts',
            hash: '918e408ce739492826f76809a774bbb2d0699bc0',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-10-3-0/add-cli-dependency.ts',
            hash: 'b6a88f0d21f326102162ed758e877c98cd2dd08b',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-10-3-0/add-vscode-extensions.spec.ts',
            hash: 'd44d8c7c25963936eaa66da4b529fa2b93f95068',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-10-3-0/add-vscode-extensions.ts',
            hash: '41caf3777d6f9059db902dc8ad244c00c5d187ff',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-10-3-0/update-typescript.ts',
            hash: '7fe517d0b50cb3e58e404a5089dd0b08add1f5c4',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-10-4-0/add-explicit-dep-on-tao.ts',
            hash: '3a8fae96ceacda659bae325d1165890935a9f6fe',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-10-4-0/update-script-to-invoke-nx-migrate.ts',
            hash: '5ab00ae715b87a3f9850396a28fd16b7bedad691',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-11-0-0/add-outputs-in-workspace.spec.ts',
            hash: '36db196cdaeac744e41f4b1ad4cb7a437b8bee48',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-11-0-0/add-outputs-in-workspace.ts',
            hash: '9871d5f41d682a6dc4116c37aee65ee35dfd6399',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-11-0-0/rename-workspace-schematic-script.ts',
            hash: '80a8d0042acde97435e238a3da85824ed54073a1',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-11-0-0/rename-workspace-schematics.ts',
            hash: 'd7214c68caa67498e6e75560857db595f9a71cfa',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-11-0-0/update-command-check.ts',
            hash: '7466c8554ec697381deae1758ff105ed88de6cea',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-11-0-0/update-decorate-angular-cli.ts',
            hash: '44b0584f0dece64c5c3f99d61f1e6fa4ace47ebb',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-11-0-0/update-node-types.ts',
            hash: 'bd7b7484ffe5f3837d03b2a83c6894cd2444971e',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-11-1-2/update-11-1-2.ts',
            hash: '2d290e898c1313431a40d15f7031e3582b12779e',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-8-10-0/fix-tslint-json.spec.ts',
            hash: 'eba9ad2bcc49b32e8afedcefe0fec58389c49b93',
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
            hash: '143326599c21b7aa954d41128827a68d3b1eaf67',
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
            hash: '2e38dd6e5d591fd5639d579e9cfff1987718e151',
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
            hash: '926801ee81b37a14948348514e0ca95c3567441b',
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
            hash: '2b1be505d607507c3c6b9cc0381717dbe377d628',
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
            hash: 'bb2e044fed81764aa5a9d7e2d674d4180eb54d0a',
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
            hash: 'e85224c103558d11ede9c7c04b4ed0774ba5e9e3',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/migrations/update-9-4-0/add-decorate-cli.ts',
            hash: '45fa45b2b0c82dd806336c4f3503348fcee434e8',
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
            hash: 'cd24862a75d4ee6a071142c6b835cda8ca6fffe0',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/tasks-runner/cache.ts',
            hash: 'e93eb95af5ec46ed2ad94ec41e269edf50dd7c45',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/tasks-runner/default-reporter.ts',
            hash: 'b48e7436407598e3f2b8aa6cef99e0a451faebb3',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/tasks-runner/default-tasks-runner.ts',
            hash: '1055da44fc646531256f392e557e3645f56084c3',
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
            hash: '69b5f842317600834fdf6b952de1b8da7e77682b',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/tasks-runner/run-command.ts',
            hash: '2ddb76e800428181e74a296782f92247a7be1dbb',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/tasks-runner/run-one-reporter.ts',
            hash: 'ed130b0e3683d8c62d090d94d786627e120834b6',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/tasks-runner/task-orchestrator.ts',
            hash: 'e75c3e26decf10b5e951744adfa7e9d5da089d5c',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/tasks-runner/task-orderer.spec.ts',
            hash: 'd673743cd921001fe8d510c1e1c33977b94a9071',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/tasks-runner/task-orderer.ts',
            hash: '3bce95057df7dd6a74f35d3899b51fc2dc5e832d',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/tasks-runner/tasks-runner-v2.ts',
            hash: '7b6e1f3e150311050154be60de2b075cddd47d64',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/tasks-runner/tasks-runner.ts',
            hash: '6599a5dfe4e6a1b9ddc140755807e6faced4ef94',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/tasks-runner/utils.spec.ts',
            hash: '7e9d07f9314481ab4295a51b2d7fd04c904942ce',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/tasks-runner/utils.ts',
            hash: '23a8be33dabd51f05d44b1ae3fa5da88bec0ec9f',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/tslint/nxEnforceModuleBoundariesRule.spec.ts',
            hash: '619a6b16773cb9e663eec37000ea2a8c4f82012a',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/tslint/nxEnforceModuleBoundariesRule.ts',
            hash: '64586c8e4d2ac0cdc93a0eb10f403e9080b412b4',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/app-root.ts',
            hash: 'f410d345fa170801eb5841191bc9ae49aa56cb91',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/utilities/buildable-libs-utils.spec.ts',
            hash: '55049a2e28ffd499d1856719d86b1e3ecb6dcf3c',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/buildable-libs-utils.ts',
            hash: '39ca197369666ae936b24a40ff154fa581366039',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/cache-directory.ts',
            hash: '7e5cda86c040e203c4b9e0454ca45a62d00010e6',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/create-package-json.ts',
            hash: '2d961487f4619fec1ba89fc8b9621d563c85e228',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/utilities/create-project-graph-from-tree.ts',
            hash: 'ff13ab364ea6b285b5fdd50350bc623004e256c7',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/fileutils.spec.ts',
            hash: '4c8b8a02f1e864c09c0ac9a94b97dc50c11eaea7',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/fileutils.ts',
            hash: '063572021dee792cc9033faf76c0c1c23447e2b9',
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
            file: 'packages/workspace/src/utilities/output.ts',
            hash: '3e56b93ccb641b9d1e43e435e5bb3b350f177fe9',
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
            hash: '083a3112192c8f645d157d8930af44323c1741d6',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/plugins/core-plugins.ts',
            hash: 'c76c97f0f2a25adf0ebe857a46ee14865d012a5c',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/plugins/index.ts',
            hash: '9ac357e92d22cfcc5c205fa5405bf8546ddd35b7',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/utilities/plugins/installed-plugins.ts',
            hash: '083b987b75d1ba447f2c7b2e75f8ad4d54f527ae',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/plugins/models.ts',
            hash: '2cae45873debd51f0d54b8ce24d127f9c5810cd6',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/utilities/plugins/plugin-capabilities.ts',
            hash: '34fbdb20ec1e6be0d94cca5de39135863eaa0f75',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/plugins/shared.ts',
            hash: '534feccefec66b287622c7a2c6206b234d160ac2',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/prettier.ts',
            hash: 'fb06fdf2a8c86cd900a58868079297ac1a7f578a',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/project-graph-utils.ts',
            hash: '8eaf656dffc3933d6a4906138ceec126c69d4e32',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/run-tasks-in-serial.ts',
            hash: 'bd2b34ddaa0bceb10d5a9237d8b1c454150ff24e',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/run-webpack.ts',
            hash: 'b2798265236c496c2a3daf428b4ef72f3c101f9b',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/set-default-collection.ts',
            hash: 'f97e9fa66e924c87ff63f867430edfe7ad8f8229',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/strip-source-code.spec.ts',
            hash: 'fd047848889fab6f37da2335a5322fa19847e979',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/strip-source-code.ts',
            hash: '9597957f4d16c20086d7fb720213a6f7b1c4d707',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/typescript.ts',
            hash: 'f267ced14cbee74b1f2603f7717e37982cc699eb',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/typescript/find-nodes.ts',
            hash: 'ca4369f8014f9cd817865829d86f09f40198306b',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/utilities/typescript/get-source-nodes.ts',
            hash: 'e2b6fa7f24da629c3423f1429f5c660ac84f8ab3',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utilities/version-utils.ts',
            hash: '9e693139ee90478b303b6970cca822211fa1aa46',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/app-root.ts',
            hash: 'dd731779ea817c73f40822e57f2a1c41831b079f',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/ast-utils.spec.ts',
            hash: '20fa013acab2489b25ce3b8d0d1b369e38078e9e',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/ast-utils.ts',
            hash: '80d0df025b3308dfdd18a7aff53d7d674385e3a0',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/buildable-libs-utils.spec.ts',
            hash: '216d3f6322f11717cd49d7a8a17ff26dcc4287b6',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/buildable-libs-utils.ts',
            hash: '48ceff83a7a906931d50d51657bc11ffd245d725',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/cli-config-utils.spec.ts',
            hash: 'bdb36d99b9856260a14203cb26b95186bb94db38',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/cli-config-utils.ts',
            hash: 'ed92cbf198261b0df137fe0250be96ac2cd98e7d',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/fileutils.ts',
            hash: '063572021dee792cc9033faf76c0c1c23447e2b9',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/graph-utils.spec.ts',
            hash: '21ad73bafc3f769bf32c2f1862e4264b699188f4',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/graph-utils.ts',
            hash: '9aeec98cf82804dd18349b2e23769b8db47091ef',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/lint.ts',
            hash: '7ad8e6595c19063726675ceeeb59785fdbd4de0f',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/output.ts',
            hash: '01398095f91e4b0dbf156b12c2a7ce2badb86046',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/perf-logging.ts',
            hash: 'f3b86436e28a566af275873f048776b680fc2317',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/project-type.ts',
            hash: '454def4325f7347927fe8a51a4620fbf84f9e23e',
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
            hash: '2e145397453f79e6601a7001150e87228c768834',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/rules/format-files.spec.ts',
            hash: '9e5e486c9205c2589fa356909d727aa82e0533ca',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/rules/format-files.ts',
            hash: '98b23f27a651b19439694e34c980c778a4fe99ea',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/utils/rules/move-npm-packages.spec.ts',
            hash: '6ab7b696c6b0e223890b0dd573410cbb96923627',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/rules/move-npm-packages.ts',
            hash: 'ab49394337115682d3da0fcbcab72d99408c35bc',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/rules/ng-add.ts',
            hash: 'c701f53a124540fae605110377263fa715355770',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/utils/rules/rename-npm-packages.spec.ts',
            hash: '50ff5862a3e29f8089547e0437248bc8f8e159da',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/rules/rename-npm-packages.ts',
            hash: '9b812c0a9916304508c55ef1ed0b993dd6a7a9b7',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/utils/rules/rename-package-imports.spec.ts',
            hash: 'c184aa06959fcc666c5c74496e20292fab36eaae',
            ext: '.ts',
          },
          {
            file:
              'packages/workspace/src/utils/rules/rename-package-imports.ts',
            hash: '4e4124673691f9fab2547e8247169d25e3342448',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/rules/to-js.ts',
            hash: '05a855fa8b41c1468f19ccd8cc08ccc30b157b68',
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
            hash: '908f4030029781e67fb1e9dc4f504d69a7255615',
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
            hash: '1ab0099c0fa92717de212d1af2bd3306ebc831b5',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/strings.spec.ts',
            hash: '346545405ca45a04b3a3cb2f9abb9c9f9b16040b',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/strings.ts',
            hash: 'f6a9beb7bc08259bcfb99a0b30217f7277b2e94a',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/testing-utils.ts',
            hash: 'e5c80d424e89cec2726ed8e3a79a98334654f2a3',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/testing.ts',
            hash: '90d43332e87d29104935ee2e4faaccf9831277bb',
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
            hash: 'a01e1e86aaa0789be214d318c9cfefc62bfd2d3f',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/versions.ts',
            hash: '3d1edface92d2bd84d04424ac463da679243dacf',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/workspace.spec.ts',
            hash: '2fef421c4e91a6287759abf4d8f12ff7923de0f5',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/src/utils/workspace.ts',
            hash: '7961c776792a21724401c405bf8c1a71e3230f4f',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/tasks-runners/default.ts',
            hash: '9fe50fe4f8235f6afc1b4d3bce6e015c0972b1cc',
            ext: '.ts',
          },
          {
            file: 'packages/workspace/testing.ts',
            hash: '295759d6b8680403f760e5fc3c7cf9ca54fa229a',
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
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/storybook/jest.config.js',
              passWithNoTests: true,
            },
            outputs: ['coverage/packages/storybook'],
          },
          'build-base': {
            executor: '@nrwl/node:package',
            options: {
              outputPath: 'build/packages/storybook',
              tsConfig: 'packages/storybook/tsconfig.lib.json',
              packageJson: 'packages/storybook/package.json',
              main: 'packages/storybook/index.ts',
              updateBuildableProjectDepsInPackageJson: false,
              assets: [
                {
                  input: 'packages/storybook',
                  glob: '**/project-files/.storybook/**',
                  output: '/',
                },
                {
                  input: 'packages/storybook',
                  glob: '**/root-files/.storybook/**',
                  output: '/',
                },
                {
                  input: 'packages/storybook',
                  glob: '**/project-files-5/.storybook/**',
                  output: '/',
                },
                {
                  input: 'packages/storybook',
                  glob: '**/root-files-5/.storybook/**',
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
                {
                  input: 'packages/storybook',
                  glob: '**/*.d.ts',
                  output: '/',
                },
                'LICENSE',
              ],
            },
            outputs: ['{options.outputPath}'],
          },
          build: {
            executor: '@nrwl/workspace:run-commands',
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
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'packages/storybook/**/*.ts',
                'packages/storybook/**/*.spec.ts',
                'packages/storybook/**/*_spec.ts',
                'packages/storybook/**/*.spec.tsx',
                'packages/storybook/**/*.spec.js',
                'packages/storybook/**/*.spec.jsx',
                'packages/storybook/**/*.d.ts',
              ],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/storybook/.eslintrc.json',
            hash: '21f4492789bc569fa0c0cde9c4eeb6a1ee1ad73d',
            ext: '.json',
          },
          {
            file: 'packages/storybook/builders.json',
            hash: 'd5bb16aed86cc0528211cd35dda3e7a13a6da6ff',
            ext: '.json',
          },
          {
            file: 'packages/storybook/collection.json',
            hash: 'e6cd30388221bd7e3193976aa79d3872d28aebde',
            ext: '.json',
          },
          {
            file: 'packages/storybook/index.ts',
            hash: '4de7881bf47cd321d894a8d48282a8bfbd1d700c',
            ext: '.ts',
          },
          {
            file: 'packages/storybook/jest.config.js',
            hash: 'cfe6ffa4029cbde004009a20c8036b2fbc3d8067',
            ext: '.js',
          },
          {
            file: 'packages/storybook/migrations.json',
            hash: '63855f2c4295505b6e822b13a1e44b34836f741f',
            ext: '.json',
          },
          {
            file: 'packages/storybook/package.json',
            hash: 'f1c6417e5085baa807667cf29a4fb61ad0869c82',
            ext: '.json',
          },
          {
            file: 'packages/storybook/README.md',
            hash: 'ea878ad9bfd3f85dcb8ec08bb1c00323beaeec32',
            ext: '.md',
          },
          {
            file:
              'packages/storybook/src/executors/build-storybook/build-storybook.impl.spec.ts',
            hash: 'ff0f8c446cf34b811d4055c4aa872e9a5af947f6',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/executors/build-storybook/build-storybook.impl.ts',
            hash: '4d283fcaa8260a7ef59d4d6e76678ba7f7eefa93',
            ext: '.ts',
          },
          {
            file: 'packages/storybook/src/executors/build-storybook/compat.ts',
            hash: 'b339343ae7a2abe11c5419900c466c3e23f27878',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/executors/build-storybook/schema.json',
            hash: '01909d742c9d5834a6802621e2d440a730726a4e',
            ext: '.json',
          },
          {
            file: 'packages/storybook/src/executors/storybook/compat.ts',
            hash: 'e49c497e58c5b1f0743ed5904f443c5a5827a1b4',
            ext: '.ts',
          },
          {
            file: 'packages/storybook/src/executors/storybook/schema.json',
            hash: 'ada1bc7cb8497d5829b2c36b7cab974c0799acb4',
            ext: '.json',
          },
          {
            file:
              'packages/storybook/src/executors/storybook/storybook.impl.spec.ts',
            hash: 'abffd576f048197ccfab4389f2f784f57b774df0',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/executors/storybook/storybook.impl.ts',
            hash: '6d134365754d0370cd6a97562d1045ece264094a',
            ext: '.ts',
          },
          {
            file: 'packages/storybook/src/executors/utils.ts',
            hash: '20c1ca778947dccc83bb2c59dbbeae5da03a139c',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/generators/configuration/configuration.spec.ts',
            hash: 'b6efa5d23a6e42876be214cc1697b63c7cdece02',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/generators/configuration/configuration.ts',
            hash: '064e53e67cf2cd51a7bfcf16de1e26deaacc63e3',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/generators/configuration/project-files-5/.storybook/addons.js__tmpl__',
            hash: '9ba582015be3ae096522cfcf0d08bc7abd7aa2df',
            ext: '.js__tmpl__',
          },
          {
            file:
              'packages/storybook/src/generators/configuration/project-files-5/.storybook/config.js__tmpl__',
            hash: '3478c695ec78db52e8a71e506342a3307dadf803',
            ext: '.js__tmpl__',
          },
          {
            file:
              'packages/storybook/src/generators/configuration/project-files-5/.storybook/tsconfig.json__tmpl__',
            hash: '4b4497923f755760f62e28880b66dee58e96ce08',
            ext: '.json__tmpl__',
          },
          {
            file:
              'packages/storybook/src/generators/configuration/project-files-5/.storybook/webpack.config.js__tmpl__',
            hash: 'd13c7cffceae5c8d5f64e66cde98fee8e9887854',
            ext: '.js__tmpl__',
          },
          {
            file:
              'packages/storybook/src/generators/configuration/project-files/.storybook/main.js__tmpl__',
            hash: 'fc85f293e6107859d2a06883d37856e4a73a934a',
            ext: '.js__tmpl__',
          },
          {
            file:
              'packages/storybook/src/generators/configuration/project-files/.storybook/preview.js__tmpl__',
            hash: '5aafd48e9d9548283b1e1e1228bf0385861bbff6',
            ext: '.js__tmpl__',
          },
          {
            file:
              'packages/storybook/src/generators/configuration/project-files/.storybook/tsconfig.json__tmpl__',
            hash: 'c5ad8d071ac3e518a57b078f39de37aafa5a9610',
            ext: '.json__tmpl__',
          },
          {
            file:
              'packages/storybook/src/generators/configuration/project-files/.storybook/webpack.config.js__tmpl__',
            hash: '963d4146ca0ac87cb74edddedc2df68631ac860c',
            ext: '.js__tmpl__',
          },
          {
            file:
              'packages/storybook/src/generators/configuration/root-files-5/.storybook/addons.js',
            hash: '6622fe475d5fef5a139c6fbe3e5953ce7ef63b97',
            ext: '.js',
          },
          {
            file:
              'packages/storybook/src/generators/configuration/root-files-5/.storybook/tsconfig.json',
            hash: '4b11015439f2ee0cbaa8e267d0ddafbed95410a4',
            ext: '.json',
          },
          {
            file:
              'packages/storybook/src/generators/configuration/root-files-5/.storybook/webpack.config.js',
            hash: '69fcea76977dc0febc9dfe4451c44c96826e544d',
            ext: '.js',
          },
          {
            file:
              'packages/storybook/src/generators/configuration/root-files/.storybook/main.js',
            hash: '84be9fa2a99d400a37337989a117faa320782860',
            ext: '.js',
          },
          {
            file:
              'packages/storybook/src/generators/configuration/root-files/.storybook/tsconfig.json',
            hash: '4b11015439f2ee0cbaa8e267d0ddafbed95410a4',
            ext: '.json',
          },
          {
            file:
              'packages/storybook/src/generators/configuration/root-files/.storybook/webpack.config.js',
            hash: '69fcea76977dc0febc9dfe4451c44c96826e544d',
            ext: '.js',
          },
          {
            file: 'packages/storybook/src/generators/configuration/schema.d.ts',
            hash: '7059cee65875fb28b79081d719244d490e0178d7',
            ext: '.ts',
          },
          {
            file: 'packages/storybook/src/generators/configuration/schema.json',
            hash: '54e721fb41b56ad7bf63e7598e7c31fb8e17df87',
            ext: '.json',
          },
          {
            file:
              'packages/storybook/src/generators/cypress-project/cypress-project.spec.ts',
            hash: '3d3d038436dc86e2cffe8af5a857f7348d5402fd',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/generators/cypress-project/cypress-project.ts',
            hash: '49c41664d587b687d384f1ee1d6f7a3ac9702006',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/generators/cypress-project/schema.json',
            hash: '3b072640082ea2aa1e8dfb92c3e906e21bd5a4d9',
            ext: '.json',
          },
          {
            file: 'packages/storybook/src/generators/init/init.spec.ts',
            hash: '87bdad1d8c13bb89eaeaddb0190dfe2006a3665f',
            ext: '.ts',
          },
          {
            file: 'packages/storybook/src/generators/init/init.ts',
            hash: '5620bdb1083ab5ff1f0b350a1baa0d22b3506a5e',
            ext: '.ts',
          },
          {
            file: 'packages/storybook/src/generators/init/schema.d.ts',
            hash: 'f7a9b73696f671bb802afac0bfe0e57df2bbeb5e',
            ext: '.ts',
          },
          {
            file: 'packages/storybook/src/generators/init/schema.json',
            hash: 'e6160895fed5d0ad589dae02f52fb4c32b4f34c1',
            ext: '.json',
          },
          {
            file:
              'packages/storybook/src/generators/migrate-defaults-5-to-6/migrate-defaults-5-to-6.spec.ts',
            hash: '1de9bf1ef42d6a4a24a4dd44704ea0f3fc43d4aa',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/generators/migrate-defaults-5-to-6/migrate-defaults-5-to-6.ts',
            hash: '13e48eef42f91f24dde0eb396d2e3cbecb890406',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/generators/migrate-defaults-5-to-6/schema.d.ts',
            hash: 'c2dab2c3c1c3a0bba2a8922063d7e33d626fe5a5',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/generators/migrate-defaults-5-to-6/schema.json',
            hash: 'eb7e0bd7d19ec6f510946d03d0e85e1ebf42af8d',
            ext: '.json',
          },
          {
            file:
              'packages/storybook/src/migrations/update-10-2-1/update-10-2-1.spec.ts',
            hash: '7b537e2fb0b01e7ca55f5f0084ed2a612f855965',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/migrations/update-10-2-1/update-10-2-1.ts',
            hash: 'b2ce340f1ec429c70dd36218bc388a3a397ed01a',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/migrations/update-10-3-0/update-10-3-0.spec.ts',
            hash: '6e604cea7671c84cc227d98da4947d44f9b7b1e3',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/migrations/update-10-3-0/update-10-3-0.ts',
            hash: 'fa33053bd96052261b5e844fd8f1d1d66f73ddbd',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/migrations/update-11-0-12/update-storybook.spec.ts',
            hash: '52a2c0aaa9aba536e21ffc69f6abab6251b6f334',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/migrations/update-11-0-12/update-storybook.ts',
            hash: '2435676f06ff49ebce0dc98e566e6275da285d16',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/migrations/update-11-5-3/update-lint-ignores.spec.ts',
            hash: '7526e7a8da3ac011197bfc705dfb1afbfd143fa9',
            ext: '.ts',
          },
          {
            file:
              'packages/storybook/src/migrations/update-11-5-3/update-lint-ignores.ts',
            hash: '7bebb5fb388074a46fea60ba542028df797297d3',
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
            hash: '1886746d668c494efc4c0fd7f129492359395593',
            ext: '.ts',
          },
          {
            file: 'packages/storybook/src/utils/testing.ts',
            hash: '943ad43f580d46c1f3fcbfd5b229778e2501fb57',
            ext: '.ts',
          },
          {
            file: 'packages/storybook/src/utils/utilities.ts',
            hash: '1fc0c1ed0bded4775c53167a2e5c18c5710f61bf',
            ext: '.ts',
          },
          {
            file: 'packages/storybook/src/utils/versions.ts',
            hash: 'eeb3899c1271e17ccc75ee63614555c8107399de',
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
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/nx-plugin/jest.config.js',
              passWithNoTests: true,
            },
            outputs: ['coverage/packages/nx-plugin'],
          },
          'build-base': {
            executor: '@nrwl/node:package',
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
                {
                  input: 'packages/nx-plugin',
                  glob: '**/*.d.ts',
                  output: '/',
                },
                'LICENSE',
              ],
            },
            outputs: ['{options.outputPath}'],
          },
          build: {
            executor: '@nrwl/workspace:run-commands',
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
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'packages/nx-plugin/**/*.ts',
                'packages/nx-plugin/**/*.spec.ts',
                'packages/nx-plugin/**/*_spec.ts',
                'packages/nx-plugin/**/*.spec.tsx',
                'packages/nx-plugin/**/*.spec.js',
                'packages/nx-plugin/**/*.spec.jsx',
                'packages/nx-plugin/**/*.d.ts',
              ],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/nx-plugin/.eslintrc.json',
            hash: '418941d1dece3457578047803cea13cdeac040da',
            ext: '.json',
          },
          {
            file: 'packages/nx-plugin/builders.json',
            hash: '757bbb4509fd91b834ff805c5808a6c0607a4990',
            ext: '.json',
          },
          {
            file: 'packages/nx-plugin/collection.json',
            hash: '31f9f708f2d762a8578dbe58f110d704e3cb1df3',
            ext: '.json',
          },
          {
            file: 'packages/nx-plugin/index.ts',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/jest.config.js',
            hash: '3aca9da12c411a6e4e558d159b0b63b5402aac02',
            ext: '.js',
          },
          {
            file: 'packages/nx-plugin/migrations.json',
            hash: '4c70457eb5c34f62cf575b52cb28fb314dd1df33',
            ext: '.json',
          },
          {
            file: 'packages/nx-plugin/package.json',
            hash: 'd5286396d8a4c88b303fbe7b5a859cb579289698',
            ext: '.json',
          },
          {
            file: 'packages/nx-plugin/README.md',
            hash: '7e290686d1dff9054f927753f4bda5a05e02d006',
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
            hash: '24bb64b9f636b24e83066293d8a310449056533a',
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
            file:
              'packages/nx-plugin/src/migrations/update-11-0-0/rename-ng-update-into-nx-migrate.ts',
            hash: '0d23daa9f47dadb5b7129f16a89ee41f0dc0fa94',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/migrations/update-11-0-0/update-schema-version-for-executors-and-generators.ts',
            hash: '58b2972d9181f29725714672636a05bc630410c6',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/e2e-project/e2e.spec.ts',
            hash: '55c5678a25ca296ac3cf4185c3e82555e04e2683',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/e2e-project/e2e.ts',
            hash: 'a164de08fd648fde70d3f45000215e0de497d66a',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/e2e-project/files/tests/__pluginName__.spec.ts__tmpl__',
            hash: 'd47b5fdfdd99f973d00b40a927cdc0023e6a8e9a',
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
            hash: '533f2ce5d369e843160574264cd87d78fcf8d87d',
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
            hash: '9453ea73cb9b68009e46d28c58e0402954afe392',
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
            hash: 'e2337c521ae9cd9032878e89be4013896ba2add0',
            ext: '.json',
          },
          {
            file: 'packages/nx-plugin/src/schematics/executor/executor.spec.ts',
            hash: 'fa25da47750bc321aebe93c8dca231bd4bb7fe25',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/executor/executor.ts',
            hash: 'b631df5d43e73fb21ca9dd0fba39db194a25400a',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/executor/files/executor/__fileName__/executor.spec.ts__tmpl__',
            hash: '97f3fa015b4430d3e1b1a783c5654ea68c9221c5',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/executor/files/executor/__fileName__/executor.ts__tmpl__',
            hash: '7d2bb28d58129670e76dfacb0a2e6ab868d0924d',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/executor/files/executor/__fileName__/schema.d.ts__tmpl__',
            hash: 'e243f94a61ce03c84227d7edee7652b26f73a9ab',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/executor/files/executor/__fileName__/schema.json__tmpl__',
            hash: 'd585d76c47cb480b6ec69125c1fa94426fc1c64d',
            ext: '.json__tmpl__',
          },
          {
            file: 'packages/nx-plugin/src/schematics/executor/lib/add-files.ts',
            hash: '8a7d9a0d9d66a74061a510d58b876e34905dc61c',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/executor/lib/normalize-options.ts',
            hash: '0fb4d10280f6ba6dce774d80c9b518642696287a',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/executor/lib/update-executor-json.ts',
            hash: '2ba4837b8fc7891e34cfd5abfd1eaa57a1c1e38e',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/executor/schema.d.ts',
            hash: 'f3e04572c5202e35a8d9a3a2c3dccecfc1aaa16f',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/executor/schema.json',
            hash: 'a7a1655109881ab1e9299d29f7443b3f6a33a478',
            ext: '.json',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/generator/files/generator/__fileName__/generator.spec.ts__tmpl__',
            hash: 'a1756cee998e7b28d8aed6da844a92c900ff9da2',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/generator/files/generator/__fileName__/generator.ts__tmpl__',
            hash: '29a6b70af1883b4e74369cfc6578aad2bce6290e',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/generator/files/generator/__fileName__/schema.d.ts__tmpl__',
            hash: '8905d0c2467ff0a069122c2a8ab94344cbe4a8ad',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/generator/files/generator/__fileName__/schema.json__tmpl__',
            hash: 'a5022500db2858dcecc45342520808d0ec38eefd',
            ext: '.json__tmpl__',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/generator/generator.spec.ts',
            hash: '8736db9e1cdb7e03e0b5e768228e8f2676fcff8a',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/generator/generator.ts',
            hash: '65110cb09358a574a372df98db6a84576c69a590',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/generator/lib/add-files.ts',
            hash: '298a28d03ac48c5d6a4cb61b33c4d9f291ce7bf0',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/generator/lib/normalize-options.ts',
            hash: 'bf5a219849bf51c07894633be080996e70946605',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/generator/lib/update-generator-json.ts',
            hash: '3663bffd1fcd494ce35a27821d95d465bfa16267',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/generator/schema.d.ts',
            hash: '812e795dacef9f9c94274596fd8f4254c3c035d5',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/generator/schema.json',
            hash: '7c25eb2d860ce65c9cd0097aefe5d87a5087bfec',
            ext: '.json',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/migration/files/migration/__name__/__name__.ts__tmpl__',
            hash: 'c16470b439d2dc31f587fcd1407a151a39b2f7e9',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/migration/lib/add-files.ts',
            hash: 'e3f68c4ff23b2a28def533918f4682c309ad4fe8',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/migration/lib/normalize-options.ts',
            hash: '37657d67720e3bc0e7b8def61bdfda9d88b62671',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/migration/lib/update-migrations-json.ts',
            hash: 'dfde9297fbf266595f1ce0bd834a0e0fce8ac1cc',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/migration/lib/update-package-json.ts',
            hash: '3fac85e159b86a2a41fe4880d42b44bbb5187994',
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
            hash: '5236a082e3ba7d872aeee4b9484db9c593af947c',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/migration/migration.ts',
            hash: '4495cbcf42c9c16059c29abc9abb9e0a92bf0392',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/migration/schema.d.ts',
            hash: '3443ba9d7f3e45c2a500060b810d27f0c422a9c7',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/migration/schema.json',
            hash: '3f180275943e98d6163c0f7af057d12832172305',
            ext: '.json',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/plugin/files/plugin/executors.json__tmpl__',
            hash: 'b64f99d988d2c44bed20931b7768061c5a56b496',
            ext: '.json__tmpl__',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/plugin/files/plugin/generators.json__tmpl__',
            hash: 'dc62504eecca3d20aec9fc6e064b9e2964d35ce4',
            ext: '.json__tmpl__',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/plugin/files/plugin/package.json__tmpl__',
            hash: '8c68ef7302d13fa57224eb985cc50a4e7b11cdd9',
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
            hash: 'f8d0fbeb7f15837aa826138f6764824ecaaf7051',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/plugin/lib/normalize-options.ts',
            hash: '842be1af243bfa3ba57dec0a4a2dcba164fbb874',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/schematics/plugin/lib/update-workspace-json.ts',
            hash: 'fa1de4759cdb5d6d022f383b21003134ce35bc06',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/plugin/plugin.spec.ts',
            hash: '8ae6d374063299844c94e4335fd2d2b9612004ac',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/plugin/plugin.ts',
            hash: 'da98454ab3d02c321fba2fb8ec92e0d9bb6e7eba',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/plugin/schema.d.ts',
            hash: '9c448eeca4fd5da2ea44796ac7841b303434c93f',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/schematics/plugin/schema.json',
            hash: '811166078c3ff393cf1a1d330a87f75962a83056',
            ext: '.json',
          },
          {
            file: 'packages/nx-plugin/src/utils/get-file-template.ts',
            hash: '91adcc50b043ef2e7a757812825cc98181a35770',
            ext: '.ts',
          },
          {
            file:
              'packages/nx-plugin/src/utils/testing-utils/async-commands.ts',
            hash: '4e9a7efa595fa4dc52bedab5e5733f408b0da214',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/utils/testing-utils/commands.ts',
            hash: '61945c86e853ca0f9bef58c9738e539428142303',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/utils/testing-utils/index.ts',
            hash: '81414ad685bfb5e3e3ba48a0f570592c4fc2de59',
            ext: '.ts',
          },
          {
            file: 'packages/nx-plugin/src/utils/testing-utils/nx-project.ts',
            hash: '3ea3f058e6df17358e5ff093ca340e2b0d48c51e',
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
            hash: 'ce267f606301f09359f63c099a3684e9460eb05e',
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
    'nx-dev-e2e': {
      name: 'nx-dev-e2e',
      type: 'e2e',
      data: {
        root: 'nx-dev/nx-dev-e2e',
        sourceRoot: 'nx-dev/nx-dev-e2e/src',
        projectType: 'application',
        targets: {
          e2e: {
            executor: '@nrwl/cypress:cypress',
            options: {
              cypressConfig: 'nx-dev/nx-dev-e2e/cypress.json',
              tsConfig: 'nx-dev/nx-dev-e2e/tsconfig.e2e.json',
              devServerTarget: 'nx-dev:serve',
            },
            configurations: {
              production: {
                devServerTarget: 'nx-dev:serve:production',
              },
            },
          },
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: ['nx-dev/nx-dev-e2e/**/*.{js,ts}'],
            },
          },
        },
        tags: ['scope:nx-dev', 'type:e2e'],
        files: [
          {
            file: 'nx-dev/nx-dev-e2e/.eslintrc.json',
            hash: '595f51e4079b39bb889b3f3aab47116164141965',
            ext: '.json',
          },
          {
            file: 'nx-dev/nx-dev-e2e/cypress.json',
            hash: '941faa4cf8715cafd70b54e1a750209349b5323a',
            ext: '.json',
          },
          {
            file: 'nx-dev/nx-dev-e2e/src/fixtures/example.json',
            hash: '294cbed6ce9e0b948b787452e8676aee486cb3be',
            ext: '.json',
          },
          {
            file: 'nx-dev/nx-dev-e2e/src/integration/app.spec.ts',
            hash: '63ea8befe7aa4eb1767e1e10ca61341cb0b9afd4',
            ext: '.ts',
          },
          {
            file: 'nx-dev/nx-dev-e2e/src/plugins/index.js',
            hash: '9067e75a258dadf5a02b2a91c64f5acee1af17fd',
            ext: '.js',
          },
          {
            file: 'nx-dev/nx-dev-e2e/src/support/app.po.ts',
            hash: '32934246969c2ecb827ac05677785933a707a54d',
            ext: '.ts',
          },
          {
            file: 'nx-dev/nx-dev-e2e/src/support/commands.ts',
            hash: '310f1fa0e043ffebbbcf575c5a4d17f13a6b14d6',
            ext: '.ts',
          },
          {
            file: 'nx-dev/nx-dev-e2e/src/support/index.ts',
            hash: '3d469a6b6cf31eb66117d73e278bcf74f398f1db',
            ext: '.ts',
          },
          {
            file: 'nx-dev/nx-dev-e2e/tsconfig.e2e.json',
            hash: '9dc3660a79ee2f6daf097b4930427223896e3b25',
            ext: '.json',
          },
          {
            file: 'nx-dev/nx-dev-e2e/tsconfig.json',
            hash: '08841a7f56c62d55340ad08451502304837254fd',
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
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/cypress/jest.config.js',
              passWithNoTests: true,
            },
            outputs: ['coverage/packages/cypress'],
          },
          'build-base': {
            executor: '@nrwl/node:package',
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
                {
                  input: 'packages/cypress',
                  glob: '**/*.d.ts',
                  output: '/',
                },
                'LICENSE',
              ],
            },
            outputs: ['{options.outputPath}'],
          },
          build: {
            executor: '@nrwl/workspace:run-commands',
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
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'packages/cypress/**/*.ts',
                'packages/cypress/**/*.spec.ts',
                'packages/cypress/**/*.spec.tsx',
                'packages/cypress/**/*.spec.js',
                'packages/cypress/**/*.spec.jsx',
                'packages/cypress/**/*.d.ts',
              ],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/cypress/.eslintrc.json',
            hash: 'd5d546493ba6cdb5d127c6cd89c741257039463d',
            ext: '.json',
          },
          {
            file: 'packages/cypress/collection.json',
            hash: 'b6c1f9a81f2a77b204402274bdbe06f692238fcd',
            ext: '.json',
          },
          {
            file: 'packages/cypress/executors.json',
            hash: 'e15fbb8ffd2c7adcf9cfc2b3ccabe4af8f3365bd',
            ext: '.json',
          },
          {
            file: 'packages/cypress/index.ts',
            hash: '999469755ce1f15a7d3834c4b57617c7b0bb19c0',
            ext: '.ts',
          },
          {
            file: 'packages/cypress/jest.config.js',
            hash: '13140ed28f78283daedd4efe1b7128f388c59076',
            ext: '.js',
          },
          {
            file: 'packages/cypress/migrations.json',
            hash: '3bcc5de3bffed3efb32529a63fbea31aa30dadac',
            ext: '.json',
          },
          {
            file: 'packages/cypress/package.json',
            hash: '0829bd138cc68af051514bfbc1d5f79be2cc4d41',
            ext: '.json',
          },
          {
            file: 'packages/cypress/plugins/preprocessor.ts',
            hash: '74a9fe7a6f1bc68cbb09d77dbe60933509e8b4d1',
            ext: '.ts',
          },
          {
            file: 'packages/cypress/README.md',
            hash: 'ecc8fba29ba898f02af467bf3d31c5026b14830a',
            ext: '.md',
          },
          {
            file: 'packages/cypress/src/executors/cypress/compat.ts',
            hash: '67ea703f814efff27e38dd649b5e5c7176312954',
            ext: '.ts',
          },
          {
            file: 'packages/cypress/src/executors/cypress/cypress.impl.spec.ts',
            hash: '66ff8cdada30995e4288f05d9a1b66b72c6c19f7',
            ext: '.ts',
          },
          {
            file: 'packages/cypress/src/executors/cypress/cypress.impl.ts',
            hash: '5c0b753ad7d8e66b7a4d421af36166be2b9ccefa',
            ext: '.ts',
          },
          {
            file: 'packages/cypress/src/executors/cypress/schema.json',
            hash: 'e998ee26ede00d4000807d72d90ea3e0ccc498b3',
            ext: '.json',
          },
          {
            file:
              'packages/cypress/src/generators/convert-tslint-to-eslint/__snapshots__/convert-tslint-to-eslint.spec.ts.snap',
            hash: 'd6494f74db7efa3175e500b3fed11831071e68f9',
            ext: '.snap',
          },
          {
            file:
              'packages/cypress/src/generators/convert-tslint-to-eslint/convert-tslint-to-eslint.spec.ts',
            hash: '0ab1d31df8f42aee8505c3200904ec862fa73e0b',
            ext: '.ts',
          },
          {
            file:
              'packages/cypress/src/generators/convert-tslint-to-eslint/convert-tslint-to-eslint.ts',
            hash: '87eb9dd3c875c3c83f4f1254bff70d8f2bb51c66',
            ext: '.ts',
          },
          {
            file:
              'packages/cypress/src/generators/convert-tslint-to-eslint/schema.json',
            hash: '76b06b400b716e921834c13830e9701b3c0afbfd',
            ext: '.json',
          },
          {
            file:
              'packages/cypress/src/generators/cypress-project/cypress-project.spec.ts',
            hash: '07f8833db1eb2b20627d598b719a878c20c6dfb3',
            ext: '.ts',
          },
          {
            file:
              'packages/cypress/src/generators/cypress-project/cypress-project.ts',
            hash: '065e28a729113eb41033560809f3502e76bbd4f0',
            ext: '.ts',
          },
          {
            file:
              'packages/cypress/src/generators/cypress-project/files/cypress.json',
            hash: 'e13d1ca77cde002cb3899ad36f0dade92a3c70c0',
            ext: '.json',
          },
          {
            file:
              'packages/cypress/src/generators/cypress-project/files/src/fixtures/example.json__tmpl__',
            hash: '294cbed6ce9e0b948b787452e8676aee486cb3be',
            ext: '.json__tmpl__',
          },
          {
            file:
              'packages/cypress/src/generators/cypress-project/files/src/integration/app.spec.ts__tmpl__',
            hash: '2ebbb53a9bae021128b6daa11537f37fcf211eee',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/cypress/src/generators/cypress-project/files/src/plugins/index.js',
            hash: '9067e75a258dadf5a02b2a91c64f5acee1af17fd',
            ext: '.js',
          },
          {
            file:
              'packages/cypress/src/generators/cypress-project/files/src/support/app.po.ts__tmpl__',
            hash: '32934246969c2ecb827ac05677785933a707a54d',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/cypress/src/generators/cypress-project/files/src/support/commands.ts__tmpl__',
            hash: 'fc4dc5d3d285dac4cf85f96fd7181458c0b85259',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/cypress/src/generators/cypress-project/files/src/support/index.ts__tmpl__',
            hash: '3d469a6b6cf31eb66117d73e278bcf74f398f1db',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/cypress/src/generators/cypress-project/files/tsconfig.e2e.json',
            hash: '62ba2f0c2dabdcab94784b263a61df8d01b8e2aa',
            ext: '.json',
          },
          {
            file:
              'packages/cypress/src/generators/cypress-project/files/tsconfig.json',
            hash: 'c31c52e04ce1a561344054702b387be478b60109',
            ext: '.json',
          },
          {
            file: 'packages/cypress/src/generators/cypress-project/schema.d.ts',
            hash: '8ed33c44570f625cfedfe1048ca28cb10d7dafed',
            ext: '.ts',
          },
          {
            file: 'packages/cypress/src/generators/cypress-project/schema.json',
            hash: '7d001bf8e1e30aaa0875bd2ddad74ad05cbe1657',
            ext: '.json',
          },
          {
            file: 'packages/cypress/src/generators/init/init.spec.ts',
            hash: '1ee6be5542dfdbbc2a4e8c930694d259a379ef3e',
            ext: '.ts',
          },
          {
            file: 'packages/cypress/src/generators/init/init.ts',
            hash: '52cfb33566e47a76f758d7bb062ee1181ad68848',
            ext: '.ts',
          },
          {
            file: 'packages/cypress/src/generators/init/schema.d.ts',
            hash: 'e53f1202a2dbcc9dd0557eb6e641faebd55a0a79',
            ext: '.ts',
          },
          {
            file: 'packages/cypress/src/generators/init/schema.json',
            hash: 'c8a7023319bc894d507bfd5ba6e2117f2cc889c8',
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
            hash: 'bf9ae6341c7b8cb8d94d8d22245ec071d7a0b696',
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
            hash: 'bfecac2dfaa825797f8e6b1b2817758828006f59',
            ext: '.ts',
          },
          {
            file: 'packages/cypress/src/plugins/preprocessor.ts',
            hash: 'fdab472435820fd751aceadc03b280cc32370cf7',
            ext: '.ts',
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
            hash: 'f4a88e65e0e958ab567f569ae4bb66bfc7fc6077',
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
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/express/jest.config.js',
              passWithNoTests: true,
            },
            outputs: ['coverage/packages/express'],
          },
          'build-base': {
            executor: '@nrwl/node:package',
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
                {
                  input: 'packages/express',
                  glob: '**/*.d.ts',
                  output: '/',
                },
                'LICENSE',
              ],
            },
            outputs: ['{options.outputPath}'],
          },
          build: {
            executor: '@nrwl/workspace:run-commands',
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
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'packages/express/**/*.ts',
                'packages/express/**/*.spec.ts',
                'packages/express/**/*_spec.ts',
                'packages/express/**/*.spec.tsx',
                'packages/express/**/*.spec.js',
                'packages/express/**/*.spec.jsx',
                'packages/express/**/*.d.ts',
              ],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/express/.eslintrc.json',
            hash: '9a75f74f8b915f473491a3c665c9440f197a5a98',
            ext: '.json',
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
            hash: '47d712ab8ead5d2131529113694fcbfb7cc1dc2c',
            ext: '.ts',
          },
          {
            file: 'packages/express/jest.config.js',
            hash: 'a6ab3486ab75afb7f4972dbac0516094a1d641fc',
            ext: '.js',
          },
          {
            file: 'packages/express/migrations.json',
            hash: '63001b445889156d9b23c60598171ffc53a90d0c',
            ext: '.json',
          },
          {
            file: 'packages/express/package.json',
            hash: 'cb5d12a73c6e4d95308c4e9d46d029e742a2a60b',
            ext: '.json',
          },
          {
            file: 'packages/express/README.md',
            hash: '23a8cdd5334df8ab4e06fdd00190144ea6f10ab2',
            ext: '.md',
          },
          {
            file:
              'packages/express/src/schematics/application/application.spec.ts',
            hash: '4a0ec7d090f77abd7f93fb63691653da88817500',
            ext: '.ts',
          },
          {
            file: 'packages/express/src/schematics/application/application.ts',
            hash: '6e034ed4d8c8fbb7d2d18c747257089d5cf61174',
            ext: '.ts',
          },
          {
            file: 'packages/express/src/schematics/application/schema.d.ts',
            hash: '6b1755945333d3deca5a70a2eab75566a1aae4cc',
            ext: '.ts',
          },
          {
            file: 'packages/express/src/schematics/application/schema.json',
            hash: '45b358b5912b4d6c79cc65bdfd76886bbaae6eed',
            ext: '.json',
          },
          {
            file: 'packages/express/src/schematics/init/init.spec.ts',
            hash: '12125704828c233a2c32fbfa69fa5bafa7072e23',
            ext: '.ts',
          },
          {
            file: 'packages/express/src/schematics/init/init.ts',
            hash: '516acbb477d4d33bec64e2edda5aa00966aa5c6c',
            ext: '.ts',
          },
          {
            file: 'packages/express/src/schematics/init/schema.d.ts',
            hash: '52ac13000a18d701532ccd65ffecfe545ff28d55',
            ext: '.ts',
          },
          {
            file: 'packages/express/src/schematics/init/schema.json',
            hash: '25bf9b203923dca068d240a1fad697b84a719169',
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
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/angular/jest.config.js',
              passWithNoTests: true,
            },
            outputs: ['coverage/packages/angular'],
          },
          'build-base': {
            executor: '@nrwl/node:package',
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
                {
                  input: 'packages/angular',
                  glob: '**/*.d.ts',
                  output: '/',
                },
                'LICENSE',
              ],
            },
            outputs: ['{options.outputPath}'],
          },
          build: {
            executor: '@nrwl/workspace:run-commands',
            outputs: ['build/packages/angular'],
            options: {
              commands: [
                {
                  command: 'nx build-base angular',
                },
                {
                  command: 'node ./scripts/build-angular',
                },
                {
                  command: 'node ./scripts/copy-readme.js angular',
                },
              ],
              parallel: false,
            },
          },
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'packages/angular/**/*.ts',
                'packages/angular/**/*.spec.ts',
                'packages/angular/**/*_spec.ts',
                'packages/angular/**/*.spec.tsx',
                'packages/angular/**/*.spec.js',
                'packages/angular/**/*.spec.jsx',
                'packages/angular/**/*.d.ts',
              ],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/angular/.eslintrc.json',
            hash: '160e17e26189893725b539183bfa3d4bc69d480e',
            ext: '.json',
          },
          {
            file: 'packages/angular/builders.json',
            hash: 'b1bb7f12d0cd216433d5a2f8fbb40faee0e60a5b',
            ext: '.json',
          },
          {
            file: 'packages/angular/collection.json',
            hash: '22390413aa57c1fccc518ce87f754c8c1124659b',
            ext: '.json',
          },
          {
            file: 'packages/angular/generators.ts',
            hash: 'e7886b359197a58247eea1a680a37618991d09e6',
            ext: '.ts',
          },
          {
            file: 'packages/angular/index.ts',
            hash: 'ba5e98d619b4c4faa674316314601de080a84b2d',
            ext: '.ts',
          },
          {
            file: 'packages/angular/jest.config.js',
            hash: '75d31a52636e26801bdedd0544b477e225fa68e8',
            ext: '.js',
          },
          {
            file: 'packages/angular/migrations.json',
            hash: 'cb194c563e6d0bbed4b504173a452968dbee9db8',
            ext: '.json',
          },
          {
            file: 'packages/angular/ng-package.json',
            hash: '440e8ade10788d418551aeb7d7b9d7502771f34e',
            ext: '.json',
          },
          {
            file: 'packages/angular/package.json',
            hash: '0833992e0c65c0168c812362e734c73902ac652c',
            ext: '.json',
          },
          {
            file: 'packages/angular/README.md',
            hash: '127e045ab2e42f18dccfeb4a54e17e700fb8af0c',
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
            file:
              'packages/angular/src/builders/ng-packagr-lite/ng-packagr-adjustments/compile-ngc.ts',
            hash: '7d8d1385483dd7746d32a04520d96cfd1ef06ea2',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/builders/ng-packagr-lite/ng-packagr-adjustments/entry-point.di.ts',
            hash: 'ed63db841ac95f4c449e851fd24b5c40929e92ec',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/builders/ng-packagr-lite/ng-packagr-adjustments/init-tsconfig.ts',
            hash: '5493bd27446a43f3dab9f3487ec3176f8e382186',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/builders/ng-packagr-lite/ng-packagr-adjustments/package.di.ts',
            hash: '852beeaa0ea1f3429a6b551ce1e13f54bb266952',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/builders/ng-packagr-lite/ng-packagr-adjustments/write-bundles.ts',
            hash: 'eb09662a2d560ab8688558b85c80af51b90696e8',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/builders/ng-packagr-lite/ng-packagr-lite.impl.ts',
            hash: '8b9e98ee6b123d2e75d8021d8d6f25b3e93c6bab',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/builders/ng-packagr-lite/schema.json',
            hash: '9690dbcaef7b72b2d2f7087ffc533f1ce6eb2839',
            ext: '.json',
          },
          {
            file: 'packages/angular/src/builders/package/package.impl.spec.ts',
            hash: 'aab60698bd7c60a466b8bdf8a5d32b807f1f06d6',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/builders/package/package.impl.ts',
            hash: 'b9822c7ae4998ce8442a7a40a1fb7e4172f7ca5d',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/builders/package/schema.json',
            hash: 'f47c876adeeb387b33f1d863ade805b03fa5d168',
            ext: '.json',
          },
          {
            file: 'packages/angular/src/builders/webpack-browser/schema.json',
            hash: '15adc9ce92ac2cb947d95fba7feaf24e9997248b',
            ext: '.json',
          },
          {
            file:
              'packages/angular/src/builders/webpack-browser/webpack-browser.impl.ts',
            hash: '42a69e9d45f59e0d54a061fc77df1a3e8a44fc62',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/generators/convert-tslint-to-eslint/__snapshots__/convert-tslint-to-eslint.spec.ts.snap',
            hash: '8c825a1a55a7cbdf45891de8bd7b8daae964dafa',
            ext: '.snap',
          },
          {
            file:
              'packages/angular/src/generators/convert-tslint-to-eslint/convert-tslint-to-eslint.spec.ts',
            hash: '2120b55199ec5f8fc2f9620c6556f81493caa0a4',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/generators/convert-tslint-to-eslint/convert-tslint-to-eslint.ts',
            hash: 'dd680cf5dc5e31893a8d00a8dcbffaef36e2a22e',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/generators/convert-tslint-to-eslint/schema.json',
            hash: '5bbb3751309d3b48fb35a44babdd5d6b84fba166',
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
              'packages/angular/src/migrations/update-10-3-0/files/tsconfig.editor.json',
            hash: '8969e4a021829a0f694b1ece2f5cc87af80ac5b8',
            ext: '.json',
          },
          {
            file:
              'packages/angular/src/migrations/update-10-3-0/update-10-3-0.spec.ts',
            hash: 'fff9300abf73777ba9740f971c8a3f7052383ace',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/migrations/update-10-3-0/update-10-3-0.ts',
            hash: '7e827c4ffdd00979f43b382bb9dddc34477959a3',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/migrations/update-10-4-0/update-10-4-0.spec.ts',
            hash: '0b7d4b50c98a5512b3464c21b43579372b90fb52',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/migrations/update-10-4-0/update-10-4-0.ts',
            hash: '583f005da61e0776092f3261ef9805d950fe6aed',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/migrations/update-10-5-0/add-template-support-and-presets-to-eslint.spec.ts',
            hash: '30f7cdb5fff6736a37537b2b8a19ffbed0086fb8',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/migrations/update-10-5-0/add-template-support-and-presets-to-eslint.ts',
            hash: '2029b64aee88536e2ed66018fe7c25270afe1a43',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/migrations/update-11-0-0/update-builders-config.spec.ts',
            hash: '613cb3db4a99c134ec41ddc0c6eea038bfae706e',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/migrations/update-11-0-0/update-builders-config.ts',
            hash: '78e654632ddfbb50b3e2936b9f030a9c852e2567',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/migrations/update-12-0-0/update-ngcc-postinstall.spec.ts',
            hash: '6f9dc791aceebcdfb4015a44a5b3247b15d76f82',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/migrations/update-12-0-0/update-ngcc-postinstall.ts',
            hash: 'db12abf3fbf1206b16ee029419adac4d1e888794',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/migrations/update-8-12-0/change-angular-lib-builder.spec.ts',
            hash: '1a25614d83295259de2689e826b31d137b0cdf62',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/migrations/update-8-12-0/change-angular-lib-builder.ts',
            hash: '0356cc9ec89174a15d4c22130e49c6b9ceb3a1d7',
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
            file: 'packages/angular/src/schematics/add-linting/add-linting.ts',
            hash: 'edc3f7bebd10554fc90a892df9069e6c701c91b1',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/add-linting/schema.d.ts',
            hash: 'b28297bb99055bf4a5ace2f6fb6242e66d8fb2fb',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/add-linting/schema.json',
            hash: 'b22b14fb2ad3d5dbaa79816de6fddb57fb83ee86',
            ext: '.json',
          },
          {
            file:
              'packages/angular/src/schematics/application/__snapshots__/application.spec.ts.snap',
            hash: '608ac3530bb77fb9fd8e19a055277fb5492206c3',
            ext: '.snap',
          },
          {
            file:
              'packages/angular/src/schematics/application/application.spec.ts',
            hash: '6cdb8cb6f91525464dbc7efccf9ae5959433c801',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/application/application.ts',
            hash: '86d5d8f3decbc18cd231ada4dd7abc282ee88e5c',
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
              'packages/angular/src/schematics/application/files/tsconfig.editor.json',
            hash: '774d8047479b45655384fe7575972152adae3ca1',
            ext: '.json',
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
            hash: '6f3bcc5acaa6352ed9ad169ef857e1a2e59de46e',
            ext: '.json',
          },
          {
            file:
              'packages/angular/src/schematics/component-cypress-spec/component-cypress-spec.ts',
            hash: '2ace08293bb1d218e8dcc42ded4664344058a968',
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
            hash: '7e0446893e60593015fd05c146a91698de3eee1e',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/component-story/files/__componentFileName__.stories.ts__tmpl__',
            hash: '81c70e415b789b05535080cd69876a982b37e6f8',
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
            hash: 'c472529b0ec731a38dfaa7f99bce0bed2fbe41b6',
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
            file: 'packages/angular/src/schematics/generators.ts',
            hash: 'e4e6121571943bde7a57229de8c84a61f1ddd2b9',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/init/init.spec.ts',
            hash: 'ee08511b38f4cee235ac074eb95d5dbcde1ca8ae',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/init/init.ts',
            hash: '572d6c1f4116bb936a6a99e0e90bbff47abbfae3',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/init/schema.d.ts',
            hash: 'ac6c3dcb5b11d799e376e34a1807bf1e692a0ca6',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/init/schema.json',
            hash: '9afdd3390bb2d541cdfa7892f9df16281505adda',
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
            hash: 'd9a7dd5f69568b9affae9fc08e87c7c7fdce1ce9',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/karma-project/karma-project.ts',
            hash: '97b8c8c27fe6e26a0533f3efd56f4e5673a3d2c2',
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
            hash: 'd5d98afe2cbfd144acff4852a95b5aaaf72c9451',
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
            hash: '67be73bb0f9bd3c16b2dcff89275c69734be4961',
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
            hash: '53d812e7741c7bd6cbd22b277d296465ebcfdc88',
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
            hash: 'c6e69ac6862efa96907e3fecf194244a7657b373',
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
            hash: 'ef1994940c7da6d1ff91efa7842f04bf0c214f69',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/library/lib/normalized-schema.ts',
            hash: '7e9597e7a5b3db7ceec9e14832f3b481bd9475cb',
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
            hash: '7686b7909a38c80329a65a9179ceacbcee08f725',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/library/lib/update-project.ts',
            hash: '5cad1d03a847d0e9fb9b3294eda771030c88c3f3',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/library/lib/update-tsconfig.ts',
            hash: '1e1ef0ab5641b5e125e98ccc28f0b666c447e33d',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/library/library.spec.ts',
            hash: 'b149a7618982dafc5e75b66733db57ac5cb9a4f1',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/library/library.ts',
            hash: '9eec35e789a9c9589bc5ece85758964947553722',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/library/schema.d.ts',
            hash: 'cfaa9ea8d92b9964db71ad3c171ccedfee015c99',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/library/schema.json',
            hash: 'fd03a51ebbb12fbe4498a0c8a0bb1fbb76d35f8a',
            ext: '.json',
          },
          {
            file:
              'packages/angular/src/schematics/move/lib/update-module-name.spec.ts',
            hash: '993c42b7853f8b779a90c1f4acdbdcc8cb4d9591',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/move/lib/update-module-name.ts',
            hash: '8b341246423e4b33b68e549b5d5a402f92b097c4',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/move/move.spec.ts',
            hash: '83d5905cc9dfefa437d353319a05fd7b9e2593b4',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/move/move.ts',
            hash: '3e371d7d9fa2b3bb091976ab9061f9fd06dcfc26',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/move/schema.d.ts',
            hash: '14f247d3b7980759b62b1a142b3874497e608087',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/move/schema.json',
            hash: '6ea7279ed04a8ae2e759428d0ea4bda936c0b121',
            ext: '.json',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/creator-files/__directory__/__fileName__.actions.ts__tmpl__',
            hash: '2ef4b6a25e507245951e3f970578bd86b37d1a89',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/creator-files/__directory__/__fileName__.effects.spec.ts__tmpl__',
            hash: '58a17be3fc5767145fc38a8e2375275e4fe2fcc9',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/creator-files/__directory__/__fileName__.effects.ts__tmpl__',
            hash: 'dededb7a50021bd2195e2d5f59547cef847c3e8d',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/creator-files/__directory__/__fileName__.facade.spec.ts__tmpl__',
            hash: 'ea844dec1c4c0c0a907e8555d547aa83a8886e82',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/creator-files/__directory__/__fileName__.facade.ts__tmpl__',
            hash: 'dd52d0b3de2e8666e922beed65dffd7fb6b30cc3',
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
            hash: 'b1799749987ee626bb553396ba8b09820fc4bd5b',
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
            hash: 'a1c75cee916d7ceec705cce335d8863a05051067',
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
            hash: '7ca2fb53799df5ee9305dc75247dc8290b44ebbb',
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
            hash: '9d249c35582a5672b630d60467dc4797eb5dd226',
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
            hash: '536ed8e061251d1a1e5f606891d0457ba39286b3',
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
            hash: '1e6b0b599b6f847e810379f3f09c54aa158a94bd',
            ext: '.ts__tmpl__',
          },
          {
            file: 'packages/angular/src/schematics/ngrx/ngrx.spec.ts',
            hash: 'fbeaf0cb3e8c398cb651ca91cbc19a1432737f08',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/ngrx/ngrx.ts',
            hash: '583bda608a932eab7dc9637bd2e97b7308a74252',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/rules/add-exports-barrel.ts',
            hash: '24cf081333cfeb4505b5a84e0e3185007b686cd0',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/rules/add-imports-to-module.ts',
            hash: '36a6057dbaa057404d3164d20e00e5247de19b9e',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/ngrx/rules/add-ngrx-to-package-json.ts',
            hash: '8fbb444781f0a0a9d8dee22113995eb42e22bd13',
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
            hash: '39bee500aed4973e1715b6815c4da2368b575a23',
            ext: '.json',
          },
          {
            file: 'packages/angular/src/schematics/stories/stories-app.spec.ts',
            hash: '0a03411d3d8db7b7acdae60e8344f6d3a5be15c7',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/stories/stories-lib.spec.ts',
            hash: '1bba6b1460f20413092425370f7149692a7ac8e3',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/schematics/stories/stories.ts',
            hash: '12e292d36273d6f72a93be528bf3b16245a3314d',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/storybook-configuration/__snapshots__/configuration.spec.ts.snap',
            hash: '69030af243e6c7a976183850fb8217c62e75015a',
            ext: '.snap',
          },
          {
            file:
              'packages/angular/src/schematics/storybook-configuration/configuration.spec.ts',
            hash: 'd00bf385b076e3e1ff4f9abf2b511322419768cb',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/storybook-configuration/configuration.ts',
            hash: 'abb3f723a6cef605a0aaed07e25b1a17d678c0f1',
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
            hash: '026e041bc2cd238a085f57dc006773f101186a3e',
            ext: '.json',
          },
          {
            file:
              'packages/angular/src/schematics/storybook-migrate-defaults-5-to-6/migrate-defaults-5-to-6.spec.ts',
            hash: 'f62bfabb98dc72fa5e0a1b4af418c59567395dd2',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/storybook-migrate-defaults-5-to-6/migrate-defaults-5-to-6.ts',
            hash: 'a0f1043588460e31106d774833c2afce6a7a2c0a',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/storybook-migrate-defaults-5-to-6/schema.d.ts',
            hash: 'c2dab2c3c1c3a0bba2a8922063d7e33d626fe5a5',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/storybook-migrate-defaults-5-to-6/schema.json',
            hash: '084110dc133e90d8ecd398446dea09166c5fa9a1',
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
            hash: 'd15d036c90cd81bc73ef2df07b447a2a3326881b',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/utils/insert-ngmodule-import.spec.ts',
            hash: 'c3bd2516b8a61ab216f9bb2dc73d3adf4def2d52',
            ext: '.ts',
          },
          {
            file:
              'packages/angular/src/schematics/utils/insert-ngmodule-import.ts',
            hash: '631ac199d7ab066639a8f2c94ab6dc43a860cf0c',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/utils/ast-utils.spec.ts',
            hash: '928ea9de6455d857bb27a4669279796056126fa3',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/utils/ast-utils.ts',
            hash: 'db6eb0a331b0541a7d10d433057814b78a5153e3',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/utils/lint.ts',
            hash: '634d62565f0b5884a04cb4ade1e45eb46316ecda',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/utils/test-runners.ts',
            hash: '2304ac0a4f70531b1055bc939650746dc456452c',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/utils/testing.ts',
            hash: 'e83d06cedfd50c8a0f4b980baba3c1ef7ed95bfd',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/utils/upgrade.ts',
            hash: '08cfeb64455d764f8b49d63d2f8050218d367f63',
            ext: '.ts',
          },
          {
            file: 'packages/angular/src/utils/versions.ts',
            hash: '3afd2d881ae43a6a61f77c014fcf32715af41f2f',
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
    'nx-dev-ui-common': {
      name: 'nx-dev-ui-common',
      type: 'lib',
      data: {
        root: 'nx-dev/ui-common',
        sourceRoot: 'nx-dev/ui-common/src',
        projectType: 'library',
        targets: {
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: ['nx-dev/ui-common/**/*.{ts,tsx,js,jsx}'],
            },
          },
          test: {
            executor: '@nrwl/jest:jest',
            outputs: ['coverage/nx-dev/ui-common'],
            options: {
              jestConfig: 'nx-dev/ui-common/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        tags: ['scope:nx-dev', 'type:ui'],
        files: [
          {
            file: 'nx-dev/ui-common/.babelrc',
            hash: '09d67939cc9202e50c7cf5b012c0d3136306e725',
            ext: '',
          },
          {
            file: 'nx-dev/ui-common/.eslintrc.json',
            hash: '4d71ffb1400656694613a7a16b349914b4c8d27f',
            ext: '.json',
          },
          {
            file: 'nx-dev/ui-common/jest.config.js',
            hash: '00e3be90904e1b90ab51a48e0a02a16229ea68d5',
            ext: '.js',
          },
          {
            file: 'nx-dev/ui-common/README.md',
            hash: '431f141645a9c409fca92063ec4e62a292583356',
            ext: '.md',
          },
          {
            file: 'nx-dev/ui-common/src/index.ts',
            hash: 'ec931d3cd1024907d76eb8960d0777df2904febb',
            ext: '.ts',
          },
          {
            file: 'nx-dev/ui-common/src/lib/footer.spec.tsx',
            hash: '07dc94529d77b74576f4b0a933b2ec28cdeb2f01',
            ext: '.tsx',
          },
          {
            file: 'nx-dev/ui-common/src/lib/footer.tsx',
            hash: 'bf054f75536c976c59ab4ad84d0887575182d1f2',
            ext: '.tsx',
          },
          {
            file: 'nx-dev/ui-common/src/lib/header.spec.tsx',
            hash: '328563af7f66cefa488c7514d2ed4a474755d926',
            ext: '.tsx',
          },
          {
            file: 'nx-dev/ui-common/src/lib/header.tsx',
            hash: 'aa36e4d5756e745a9e1c61ee25795ac638fda356',
            ext: '.tsx',
          },
          {
            file: 'nx-dev/ui-common/tsconfig.json',
            hash: '37ab84bcdbbc868f09c31416a7ec01d0ee63a913',
            ext: '.json',
          },
          {
            file: 'nx-dev/ui-common/tsconfig.lib.json',
            hash: '66eb193383959a85e0f8fe67e07c03d2ec0f5315',
            ext: '.json',
          },
          {
            file: 'nx-dev/ui-common/tsconfig.spec.json',
            hash: '8119baebcd43425a4864ee524518032d2f4af20a',
            ext: '.json',
          },
        ],
      },
    },
    devkit: {
      name: 'devkit',
      type: 'lib',
      data: {
        root: 'packages/devkit',
        sourceRoot: 'packages/devkit',
        projectType: 'library',
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/devkit/jest.config.js',
              passWithNoTests: true,
            },
            outputs: ['coverage/packages/devkit'],
          },
          'build-base': {
            executor: '@nrwl/node:package',
            options: {
              outputPath: 'build/packages/devkit',
              tsConfig: 'packages/devkit/tsconfig.lib.json',
              packageJson: 'packages/devkit/package.json',
              main: 'packages/devkit/index.ts',
              updateBuildableProjectDepsInPackageJson: false,
              assets: [
                {
                  input: 'packages/devkit',
                  glob: '**/files/**',
                  output: '/',
                },
                {
                  input: 'packages/devkit',
                  glob: '**/files/**/.gitkeep',
                  output: '/',
                },
                {
                  input: 'packages/devkit',
                  glob: '**/*.json',
                  output: '/',
                },
                {
                  input: 'packages/devkit',
                  glob: '**/*.js',
                  output: '/',
                },
                {
                  input: 'packages/devkit',
                  glob: '**/*.d.ts',
                  output: '/',
                },
                'LICENSE',
              ],
            },
            outputs: ['{options.outputPath}'],
          },
          build: {
            executor: '@nrwl/workspace:run-commands',
            outputs: ['build/packages/devkit'],
            options: {
              commands: [
                {
                  command: 'nx build-base devkit',
                },
                {
                  command: 'node ./scripts/copy-readme.js devkit',
                },
              ],
              parallel: false,
            },
          },
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'packages/devkit/**/*.ts',
                'packages/devkit/**/*.spec.ts',
                'packages/devkit/**/*.spec.tsx',
                'packages/devkit/**/*.spec.js',
                'packages/devkit/**/*.spec.jsx',
                'packages/devkit/**/*.d.ts',
              ],
            },
          },
        },
        tags: ['tao'],
        files: [
          {
            file: 'packages/devkit/.eslintrc.json',
            hash: '8fdcddc9db606e86ff896ce13bb983074b395ad7',
            ext: '.json',
          },
          {
            file: 'packages/devkit/index.ts',
            hash: '803a761d7a39cccebc769a85dc6410aa015d62a3',
            ext: '.ts',
          },
          {
            file: 'packages/devkit/jest.config.js',
            hash: 'cb958ede149b1816f66e5402fb91d3687bf799bf',
            ext: '.js',
          },
          {
            file: 'packages/devkit/ngcli-adapter.ts',
            hash: '470e2d831123bc24e9943d6bd6bc5f5143880143',
            ext: '.ts',
          },
          {
            file: 'packages/devkit/package.json',
            hash: 'b016040c01cf20391ac67297685847bfc93e1a5d',
            ext: '.json',
          },
          {
            file: 'packages/devkit/README.md',
            hash: '334511271fa0aef95f9a4dc924257b0442759cc4',
            ext: '.md',
          },
          {
            file: 'packages/devkit/src/executors/parse-target-string.ts',
            hash: 'f2152a824f069b60ce4099eed672a1be5895873c',
            ext: '.ts',
          },
          {
            file: 'packages/devkit/src/executors/read-target-options.ts',
            hash: '2fb2eb130b8f614dc7f5c809d4f3a79291d08a2c',
            ext: '.ts',
          },
          {
            file:
              'packages/devkit/src/generators/__snapshots__/generate-files.spec.ts.snap',
            hash: '7a6636f585e6476440b7392ddbe12eccdebbd7fc',
            ext: '.snap',
          },
          {
            file: 'packages/devkit/src/generators/format-files.ts',
            hash: 'fa35c90b70949fd01b63bd45c6a4724158dabc63',
            ext: '.ts',
          },
          {
            file: 'packages/devkit/src/generators/generate-files.spec.ts',
            hash: 'c45ffa60d059dc93e83463e395faf9e830b03a11',
            ext: '.ts',
          },
          {
            file: 'packages/devkit/src/generators/generate-files.ts',
            hash: 'c4f68e77368d148d61ae6d44f78a6c4292a8207e',
            ext: '.ts',
          },
          {
            file: 'packages/devkit/src/generators/project-configuration.ts',
            hash: '54083c867b365e7881c685b2d99fa57cea9c2754',
            ext: '.ts',
          },
          {
            file:
              'packages/devkit/src/generators/test-files/directory-foo-__foo__/file-in-directory-foo-__foo__.txt',
            hash: '5b81b2eb1f17cb2ad4dc281594d73a9f08419a92',
            ext: '.txt',
          },
          {
            file:
              'packages/devkit/src/generators/test-files/directory/file-in-directory.txt',
            hash: 'f51cb01e9a75161e0fb8bece45451f6f268694f0',
            ext: '.txt',
          },
          {
            file:
              'packages/devkit/src/generators/test-files/file-with-property-foo-__foo__.txt',
            hash: 'a6a98cfa5880bdf54ae687892791455716525ac2',
            ext: '.txt',
          },
          {
            file:
              'packages/devkit/src/generators/test-files/file-with-template-suffix.txt.template',
            hash: '6121e61af396d9eb6aaebdde1bd426a7906a69ec',
            ext: '.template',
          },
          {
            file: 'packages/devkit/src/generators/test-files/file.txt',
            hash: 'd03e2425cf1c82616e12cb430c69aaa6cc08ff84',
            ext: '.txt',
          },
          {
            file: 'packages/devkit/src/generators/test-files/image.png',
            hash: 'ee28d3d8f79610760e987979703f4c0c310ddd37',
            ext: '.png',
          },
          {
            file:
              'packages/devkit/src/generators/test-files/src/__name__.module.ts.template',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.template',
          },
          {
            file:
              'packages/devkit/src/generators/test-files/src/__projectName__/__name__/__projectName__.__name__.model.ts.template',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.template',
          },
          {
            file:
              'packages/devkit/src/generators/test-files/src/__projectName__/create-__name__.input.ts.template',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.template',
          },
          {
            file:
              'packages/devkit/src/generators/test-files/src/__projectName__/output/__dot__gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file:
              'packages/devkit/src/generators/test-files/src/common-util.ts.template',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.template',
          },
          {
            file: 'packages/devkit/src/generators/to-js.ts',
            hash: 'dab35d0ed52f3acd0c0ccbfd86836fac9f8471e3',
            ext: '.ts',
          },
          {
            file: 'packages/devkit/src/generators/typescript/insert-import.ts',
            hash: '7f7b0410a2b3a5f9f9f6d29bf451d3666448b07d',
            ext: '.ts',
          },
          {
            file:
              'packages/devkit/src/generators/typescript/insert-statement.ts',
            hash: '7f7b0410a2b3a5f9f9f6d29bf451d3666448b07d',
            ext: '.ts',
          },
          {
            file: 'packages/devkit/src/generators/update-ts-configs-to-js.ts',
            hash: '5c100bb55bdab4d000ace43d9f2332d8bc59e753',
            ext: '.ts',
          },
          {
            file:
              'packages/devkit/src/generators/visit-not-ignored-files.spec.ts',
            hash: '211b2490be715585b6cafddd40f354a13a20e4b0',
            ext: '.ts',
          },
          {
            file: 'packages/devkit/src/generators/visit-not-ignored-files.ts',
            hash: '11297b538e98021368674d80d0737f46ae754c86',
            ext: '.ts',
          },
          {
            file: 'packages/devkit/src/project-graph/interfaces.ts',
            hash: 'c47dbe857583b3a5fdbcaa4c23e176a4f492140f',
            ext: '.ts',
          },
          {
            file: 'packages/devkit/src/project-graph/utils.ts',
            hash: '3885eb15181dff128f31c2b2f798606ae1d38e9c',
            ext: '.ts',
          },
          {
            file: 'packages/devkit/src/tasks/install-packages-task.ts',
            hash: 'f779b07b0aba1108e2bc447a7ed17f24fa138a72',
            ext: '.ts',
          },
          {
            file:
              'packages/devkit/src/tests/create-tree-with-empty-workspace.ts',
            hash: 'ebf41761ef9b6c741b3203a14da5aa110c70c471',
            ext: '.ts',
          },
          {
            file: 'packages/devkit/src/tests/create-tree.ts',
            hash: 'b3653257657a4fa24d0b103d7caf5e40b6576e6a',
            ext: '.ts',
          },
          {
            file: 'packages/devkit/src/utils/convert-nx-executor.ts',
            hash: '8fd65a0bfa5b8b5a6ad5cf4aa205d092dde6949d',
            ext: '.ts',
          },
          {
            file: 'packages/devkit/src/utils/get-workspace-layout.ts',
            hash: 'f8f72d69620cc528bcf8459e1d6d3c7dd4a8959a',
            ext: '.ts',
          },
          {
            file: 'packages/devkit/src/utils/invoke-nx-generator.ts',
            hash: 'e9bcdadc91474bf3853735f0f56f66f513748605',
            ext: '.ts',
          },
          {
            file: 'packages/devkit/src/utils/json.ts',
            hash: '44f236102b495fa38d0d568152670917fc72dfce',
            ext: '.ts',
          },
          {
            file: 'packages/devkit/src/utils/names.spec.ts',
            hash: '856dfb3930be5bcede2c3e9024b2a856c4e5a29e',
            ext: '.ts',
          },
          {
            file: 'packages/devkit/src/utils/names.ts',
            hash: '0f91fdf3ecee7249cc31c140ecc751d3fe8b0917',
            ext: '.ts',
          },
          {
            file: 'packages/devkit/src/utils/offset-from-root.spec.ts',
            hash: '15b27b4ad49db322d7eb5469268b2c6190046742',
            ext: '.ts',
          },
          {
            file: 'packages/devkit/src/utils/offset-from-root.ts',
            hash: '3d7dfc0a12bcfa4c51525fba2e0d35d75d963e50',
            ext: '.ts',
          },
          {
            file: 'packages/devkit/src/utils/package-json.spec.ts',
            hash: '4adda4e211a7df6e436d5402fda086230ffe8fbd',
            ext: '.ts',
          },
          {
            file: 'packages/devkit/src/utils/package-json.ts',
            hash: '7f2baabe18d9c3ce1cd09c28cb971a376a46477b',
            ext: '.ts',
          },
          {
            file: 'packages/devkit/src/utils/path.ts',
            hash: '96de74c71f509e75e85b32b51ff80b6c5baa3a63',
            ext: '.ts',
          },
          {
            file: 'packages/devkit/src/utils/string-change.spec.ts',
            hash: 'd27ae95d8f90eec99538f9d2df1e90a028017bba',
            ext: '.ts',
          },
          {
            file: 'packages/devkit/src/utils/string-change.ts',
            hash: '9bf67076c01aefe9e6b48df93bde2c3824cdee2c',
            ext: '.ts',
          },
          {
            file: 'packages/devkit/src/utils/strip-indents.ts',
            hash: 'c7911647d5670c040c148f9d510aa8548f822b93',
            ext: '.ts',
          },
          {
            file: 'packages/devkit/testing.ts',
            hash: 'f36d1c0d310e67c50e15d765e704ba1d204445d6',
            ext: '.ts',
          },
          {
            file: 'packages/devkit/tsconfig.json',
            hash: '58bd2c97a66f5e5ea5d05c8a5709ee79bad02094',
            ext: '.json',
          },
          {
            file: 'packages/devkit/tsconfig.lib.json',
            hash: 'dbe90e0855d2ef980595dcc17f577088662cfb4d',
            ext: '.json',
          },
          {
            file: 'packages/devkit/tsconfig.spec.json',
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
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/linter/jest.config.js',
              passWithNoTests: true,
            },
            outputs: ['coverage/packages/linter'],
          },
          'build-base': {
            executor: '@nrwl/node:package',
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
                {
                  input: 'packages/linter',
                  glob: '**/*.d.ts',
                  output: '/',
                },
                'LICENSE',
              ],
            },
            outputs: ['{options.outputPath}'],
          },
          build: {
            executor: '@nrwl/workspace:run-commands',
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
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'packages/linter/**/*.ts',
                'packages/linter/**/*.spec.ts',
                'packages/linter/**/*_spec.ts',
                'packages/linter/**/*.spec.tsx',
                'packages/linter/**/*.spec.js',
                'packages/linter/**/*.spec.jsx',
                'packages/linter/**/*.d.ts',
              ],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/linter/.eslintrc.json',
            hash: '2d5e04f2ebbdb0a59990bf0463b762437b397fbb',
            ext: '.json',
          },
          {
            file: 'packages/linter/builders.json',
            hash: 'cd730fc5d76c49b40a399a2d05c2359fbb871d71',
            ext: '.json',
          },
          {
            file: 'packages/linter/index.ts',
            hash: '4f5263328f257abe3ac521ded3e73a48c3693d58',
            ext: '.ts',
          },
          {
            file: 'packages/linter/jest.config.js',
            hash: '99d78bc409f74f7ede15281475122520ecc3301c',
            ext: '.js',
          },
          {
            file: 'packages/linter/migrations.json',
            hash: '8ee530ce9215b2d725c8327e0e7e091694a7ae43',
            ext: '.json',
          },
          {
            file: 'packages/linter/package.json',
            hash: '72879ede8eb81ea1203e49892561ff739daec3ea',
            ext: '.json',
          },
          {
            file: 'packages/linter/README.md',
            hash: '2ba99bd7afbc08cd44002164969baffba643a879',
            ext: '.md',
          },
          {
            file: 'packages/linter/src/executors/eslint/compat.ts',
            hash: 'd04532c1be5ca4b4445d93b43b4d880d2a2b101b',
            ext: '.ts',
          },
          {
            file: 'packages/linter/src/executors/eslint/lint.impl.spec.ts',
            hash: '0010d00f282e6ff75275d31c35089cfcf21f281d',
            ext: '.ts',
          },
          {
            file: 'packages/linter/src/executors/eslint/lint.impl.ts',
            hash: '7e543437321ccd4d64145a5304cdcce95403be15',
            ext: '.ts',
          },
          {
            file: 'packages/linter/src/executors/eslint/schema.d.ts',
            hash: 'a89c4a0dd0a4141db6287efeaca32b0deccba1b0',
            ext: '.ts',
          },
          {
            file: 'packages/linter/src/executors/eslint/schema.json',
            hash: '6009f88479e62f62a3b891c7f4205a993e15b9e3',
            ext: '.json',
          },
          {
            file:
              'packages/linter/src/executors/eslint/utility/create-directory.ts',
            hash: '60083125721f1a6087d4f980286232cf8cc5ee0b',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/executors/eslint/utility/eslint-utils.spec.ts',
            hash: '5886fdf441cf0b001825d28cb88e44072d06fa9f',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/executors/eslint/utility/eslint-utils.ts',
            hash: '791feda1a59694a73b12bbbc543177dd29999851',
            ext: '.ts',
          },
          {
            file: 'packages/linter/src/executors/lint/lint.impl.spec.ts',
            hash: '708117042765a0d2a8f1fe3699530256c83c4c8e',
            ext: '.ts',
          },
          {
            file: 'packages/linter/src/executors/lint/lint.impl.ts',
            hash: 'af0c194a1781fa767bd85c675cf46abdc04113a2',
            ext: '.ts',
          },
          {
            file: 'packages/linter/src/executors/lint/schema.d.ts',
            hash: '94f0cb6f02ea6217ed92b5cf41e4876a93718505',
            ext: '.ts',
          },
          {
            file: 'packages/linter/src/executors/lint/schema.json',
            hash: '47544d2f21bab4a9d57e8b05f91085cbe7f308c1',
            ext: '.json',
          },
          {
            file:
              'packages/linter/src/executors/lint/utility/eslint-utils.spec.ts',
            hash: '8fc6231814f74c25392f1ed5a3ccb0f08ffed171',
            ext: '.ts',
          },
          {
            file: 'packages/linter/src/executors/lint/utility/eslint-utils.ts',
            hash: 'f79de2cb966c77d2d788546401b9cbd8b5be8be1',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/executors/lint/utility/file-utils.spec.ts',
            hash: '300e43b686c336e31bbc7f0051725b5a0cec2e69',
            ext: '.ts',
          },
          {
            file: 'packages/linter/src/executors/lint/utility/file-utils.ts',
            hash: 'd12d17d04edee2a422fa6e22450d2597f5dfa1c3',
            ext: '.ts',
          },
          {
            file: 'packages/linter/src/executors/lint/utility/ts-utils.spec.ts',
            hash: '9c32a7bf8c8d9c7418d0b8697a595d9d808e0bc3',
            ext: '.ts',
          },
          {
            file: 'packages/linter/src/executors/lint/utility/ts-utils.ts',
            hash: '7ac3f7cabb6f05461c3fecf4e52ab7d78fee5839',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/generators/init/__snapshots__/init.spec.ts.snap',
            hash: '3cdbd591d3e8b4cdfdcff9a08dedfb8e7910d853',
            ext: '.snap',
          },
          {
            file: 'packages/linter/src/generators/init/init.spec.ts',
            hash: '9f7b358a92a9c72ef6e7419c5e57bbd989ee827b',
            ext: '.ts',
          },
          {
            file: 'packages/linter/src/generators/init/init.ts',
            hash: '0babb6c9c9dc4859f0979a545c3de938850bd2ca',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/generators/lint-project/__snapshots__/lint-project.spec.ts.snap',
            hash: '43f811db4268f17592844616642b93fb194499bd',
            ext: '.snap',
          },
          {
            file:
              'packages/linter/src/generators/lint-project/lint-project.spec.ts',
            hash: '800e97067fc6f488eb8e364d063298573f4fb1b6',
            ext: '.ts',
          },
          {
            file: 'packages/linter/src/generators/lint-project/lint-project.ts',
            hash: '42927f1d05350cc7ed2fb399ea274c8735e726c5',
            ext: '.ts',
          },
          {
            file: 'packages/linter/src/generators/utils/linter.ts',
            hash: 'd766289a0bc32855523ae2122f353c09f02392c6',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/migrations/update-10-3-0/add-json-ext-to-eslintrc.spec.ts',
            hash: '3676ac29c355159e97862eec8c70d6f0c039c856',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/migrations/update-10-3-0/add-json-ext-to-eslintrc.ts',
            hash: 'f0510fc304b356327b6de0a7d8aa9d468491642b',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/migrations/update-10-3-0/add-root-eslintrc-json-to-workspace-implicit-deps.spec.ts',
            hash: 'e8f01377080d138964b7e664159ce3318176583c',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/migrations/update-10-3-0/add-root-eslintrc-json-to-workspace-implicit-deps.ts',
            hash: '870c815444572874d5c3a3d58c7bb6df97d66d98',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/migrations/update-10-3-0/update-10-3-0.spec.ts',
            hash: 'c2f00c21769258e91d4d85423fe5fe81b92f83bc',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/migrations/update-10-3-0/update-10-3-0.ts',
            hash: '886ce679f04af4172c1d8bfaa4d64294395db925',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/migrations/update-10-3-0/update-eslint-builder-and-config.spec.ts',
            hash: '5f8fad348536eacaaf38d97bd47b1168d41459f3',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/migrations/update-10-3-0/update-eslint-builder-and-config.ts',
            hash: '621635a7dc52cdaf039ffe39238a66573334ad2d',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/migrations/update-10-3-1/revert-node-modules-files-in-eslint-builder-options.spec.ts',
            hash: '15526b6495041b96887e06fe7186ceea42929bcc',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/migrations/update-10-3-1/revert-node-modules-files-in-eslint-builder-options.ts',
            hash: '2a3cd5a4543fb2e60392be2e7fde9ed62821859a',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/migrations/update-10-4-0/update-eslint-configs-to-use-nx-presets.spec.ts',
            hash: '176669ada2d81e81c68fcf850d39afe8a33f5104',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/migrations/update-10-4-0/update-eslint-configs-to-use-nx-presets.ts',
            hash: '3da3779769d109cf7f669c2472ee65897c5cc546',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/migrations/update-10-4-0/update-root-eslint-config-to-use-overrides.spec.ts',
            hash: '5bed6601b6976b88237bc14258295ab342e84936',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/migrations/update-10-4-0/update-root-eslint-config-to-use-overrides.ts',
            hash: '9cf8a4ccaa6226a6f4f18a32170916b6534e535e',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/migrations/update-11-5-0/always-use-project-level-tsconfigs-with-eslint.spec.ts',
            hash: 'f948c9d1b3da4f166de3dab728ac7e14ddea87e6',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/migrations/update-11-5-0/always-use-project-level-tsconfigs-with-eslint.ts',
            hash: 'a612ada29a6d3903d21635a7f7f502294db190cc',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/utils/convert-tslint-to-eslint/__snapshots__/convert-to-eslint-config.spec.ts.snap',
            hash: '9f36c7ea7920f53416aed422b5dc9b5eeeec3f08',
            ext: '.snap',
          },
          {
            file:
              'packages/linter/src/utils/convert-tslint-to-eslint/__snapshots__/project-converter.spec.ts.snap',
            hash: '9327d53da0e13397aa8cb6713c3a00b7baf2be25',
            ext: '.snap',
          },
          {
            file:
              'packages/linter/src/utils/convert-tslint-to-eslint/convert-nx-enforce-module-boundaries-rule.spec.ts',
            hash: '044ca66897f1760b5880dbd919f6cb03eea3997a',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/utils/convert-tslint-to-eslint/convert-nx-enforce-module-boundaries-rule.ts',
            hash: '36c00eaa49ba47c708fbab47792b985f0b35175b',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/utils/convert-tslint-to-eslint/convert-to-eslint-config.spec.ts',
            hash: 'cebca2387413b516c93001ce93495c06bb065c17',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/utils/convert-tslint-to-eslint/convert-to-eslint-config.ts',
            hash: '1fcdfee188d6039c3246f4f986eaa9d078f8b770',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/utils/convert-tslint-to-eslint/example-tslint-configs.ts',
            hash: '2c4123c381aaa6c18eebb53871e346600247d198',
            ext: '.ts',
          },
          {
            file: 'packages/linter/src/utils/convert-tslint-to-eslint/index.ts',
            hash: 'cc95094649634a3a38643aef1808f95c7b1ec24f',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/utils/convert-tslint-to-eslint/project-converter.spec.ts',
            hash: 'dad4a722714bb713dec79b56ba2b754f85f19104',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/utils/convert-tslint-to-eslint/project-converter.ts',
            hash: '03b5bbf8d8899d172d4f51d853035a93bd970cfa',
            ext: '.ts',
          },
          {
            file:
              'packages/linter/src/utils/convert-tslint-to-eslint/utils.spec.ts',
            hash: '6b1b4492c31d634d109988e63140add48db58ba0',
            ext: '.ts',
          },
          {
            file: 'packages/linter/src/utils/convert-tslint-to-eslint/utils.ts',
            hash: '77aeeadc62cc8644ce926eb0e823f3193363a68a',
            ext: '.ts',
          },
          {
            file: 'packages/linter/src/utils/testing.ts',
            hash: 'd3fcd4818499b8dc5bbcbd087e72da6b3e20ccf5',
            ext: '.ts',
          },
          {
            file: 'packages/linter/src/utils/versions.ts',
            hash: '147b782bba050f6f1adf28d92122797d8d713a7c',
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
    gatsby: {
      name: 'gatsby',
      type: 'lib',
      data: {
        root: 'packages/gatsby',
        sourceRoot: 'packages/gatsby',
        projectType: 'library',
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/gatsby/jest.config.js',
              passWithNoTests: true,
            },
            outputs: ['coverage/packages/gatsby'],
          },
          'build-base': {
            executor: '@nrwl/node:package',
            options: {
              outputPath: 'build/packages/gatsby',
              tsConfig: 'packages/gatsby/tsconfig.lib.json',
              packageJson: 'packages/gatsby/package.json',
              main: 'packages/gatsby/index.ts',
              updateBuildableProjectDepsInPackageJson: false,
              assets: [
                {
                  input: 'packages/gatsby/src',
                  glob: '**/.babelrc*',
                  output: './src',
                },
                {
                  input: 'packages/gatsby/src',
                  glob: '**/*.!(ts)',
                  output: './src',
                },
                {
                  input: 'packages/gatsby/plugins',
                  glob: '**/*.!(ts)',
                  output: './plugins',
                },
                {
                  input: 'packages/gatsby',
                  glob: '**/*.json',
                  output: '/',
                },
                {
                  input: 'packages/gatsby',
                  glob: '**/*.js',
                  output: '/',
                },
                {
                  input: 'packages/gatsby',
                  glob: '**/*.d.ts',
                  output: '/',
                },
                'LICENSE',
              ],
            },
            outputs: ['{options.outputPath}'],
          },
          build: {
            executor: '@nrwl/workspace:run-commands',
            outputs: ['build/packages/gatsby'],
            options: {
              commands: [
                {
                  command: 'nx build-base gatsby',
                },
                {
                  command: 'node ./scripts/copy-readme.js gatsby',
                },
              ],
              parallel: false,
            },
          },
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'packages/gatsby/**/*.ts',
                'packages/gatsby/**/*.spec.ts',
                'packages/gatsby/**/*_spec.ts',
                'packages/gatsby/**/*.spec.tsx',
                'packages/gatsby/**/*.spec.js',
                'packages/gatsby/**/*.spec.jsx',
                'packages/gatsby/**/*.d.ts',
              ],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/gatsby/.eslintrc.json',
            hash: '5483216334cead03e08c0eaafe5a08ea33c8a215',
            ext: '.json',
          },
          {
            file: 'packages/gatsby/babel.ts',
            hash: 'b6f9cf70ec434c42354384e834020481f22835c7',
            ext: '.ts',
          },
          {
            file: 'packages/gatsby/builders.json',
            hash: '88c99d87d764729a2c874718a55ae5fe34ed5afa',
            ext: '.json',
          },
          {
            file: 'packages/gatsby/collection.json',
            hash: '6ccb4f5e0f183a1f396a8856f13cf55d4f4dcd39',
            ext: '.json',
          },
          {
            file: 'packages/gatsby/index.ts',
            hash: 'd89670cbf062ecd1879d8bf6e4121dd070f2a1aa',
            ext: '.ts',
          },
          {
            file: 'packages/gatsby/jest.config.js',
            hash: '338780b93272991f4194cbc8634fe011b3d04ee6',
            ext: '.js',
          },
          {
            file: 'packages/gatsby/migrations.json',
            hash: 'bb82c8f0651decb52a13d0487c8d38751b22f45f',
            ext: '.json',
          },
          {
            file: 'packages/gatsby/package.json',
            hash: 'fb03a47d1a4d4afb4a671c801f2e4af6dcf3b44d',
            ext: '.json',
          },
          {
            file:
              'packages/gatsby/plugins/nx-gatsby-ext-plugin/gatsby-config.ts',
            hash: '7b21fd565d3a147f08a58d1b32b397ea08235873',
            ext: '.ts',
          },
          {
            file: 'packages/gatsby/plugins/nx-gatsby-ext-plugin/gatsby-node.ts',
            hash: '85914558f7edd4a80f55c7fa1ab304a873fefcfc',
            ext: '.ts',
          },
          {
            file: 'packages/gatsby/plugins/nx-gatsby-ext-plugin/package.json',
            hash: 'e52d3bcad0e162fa5b8129edb9f88fd26d8d0eb5',
            ext: '.json',
          },
          {
            file: 'packages/gatsby/README.md',
            hash: '7cc1d2c363e41cd431294912b5312faacaba086b',
            ext: '.md',
          },
          {
            file: 'packages/gatsby/src/executors/build/build.impl.ts',
            hash: '18939a347a12265ee2a4b6458244e65e07c2d2f6',
            ext: '.ts',
          },
          {
            file: 'packages/gatsby/src/executors/build/compat.ts',
            hash: '477ba0be5f653b607cb16d690a4a97b732e7df29',
            ext: '.ts',
          },
          {
            file: 'packages/gatsby/src/executors/build/schema.d.ts',
            hash: 'c92517fb0d73d766f967d0255f67687df52e42b2',
            ext: '.ts',
          },
          {
            file: 'packages/gatsby/src/executors/build/schema.json',
            hash: '68f10fb0560bf8f1f66557f03c207ccf6af28cbe',
            ext: '.json',
          },
          {
            file: 'packages/gatsby/src/executors/server/compat.ts',
            hash: 'c70f628f39422faa701c618a0b177c996b9c8297',
            ext: '.ts',
          },
          {
            file: 'packages/gatsby/src/executors/server/schema.d.ts',
            hash: '5fe0d97842c607e0f1e972c126815320546a8d60',
            ext: '.ts',
          },
          {
            file: 'packages/gatsby/src/executors/server/schema.json',
            hash: 'c0d8d38b3cd8a74f439791cbe2b36712118908fc',
            ext: '.json',
          },
          {
            file: 'packages/gatsby/src/executors/server/server.impl.ts',
            hash: '8a30230377e26474c06da724bd6576655d5f2a62',
            ext: '.ts',
          },
          {
            file:
              'packages/gatsby/src/generators/application/application.spec.ts',
            hash: '7d598e9002a5127a2065f97fe20ce264a596e587',
            ext: '.ts',
          },
          {
            file: 'packages/gatsby/src/generators/application/application.ts',
            hash: 'c09dd1f9b7f2d1b7735252bfe8c4b37e39db646c',
            ext: '.ts',
          },
          {
            file:
              'packages/gatsby/src/generators/application/files/.babelrc__tmpl__',
            hash: '7d27381480117737207f1cc5de963b751e8d1379',
            ext: '',
          },
          {
            file: 'packages/gatsby/src/generators/application/files/.gitignore',
            hash: 'f81327511eeb4a898632e11c08410fbc393dd5a1',
            ext: '',
          },
          {
            file:
              'packages/gatsby/src/generators/application/files/.prettierignore',
            hash: '58d06c368a2aed2595c63288cae4a94d72972ead',
            ext: '',
          },
          {
            file:
              'packages/gatsby/src/generators/application/files/.prettierrc',
            hash: '33d2cfa3f6193c91be64c1dbb3a7c7b0377adcc4',
            ext: '',
          },
          {
            file:
              'packages/gatsby/src/generators/application/files/gatsby-browser.js',
            hash: 'b1e5c316b7f94cd10f0c48a4d3d5567789299b03',
            ext: '.js',
          },
          {
            file:
              'packages/gatsby/src/generators/application/files/gatsby-config.js__tmpl__',
            hash: '25b36077c44c0203da04b38bcb8c600708f1f4cf',
            ext: '.js__tmpl__',
          },
          {
            file:
              'packages/gatsby/src/generators/application/files/gatsby-node.js',
            hash: '2f4266513eb6606ea0680779ddc146e859d269a3',
            ext: '.js',
          },
          {
            file:
              'packages/gatsby/src/generators/application/files/gatsby-ssr.js',
            hash: 'b17b8fc19d65986509ea9b6c250629d38e2a0c1f',
            ext: '.js',
          },
          {
            file: 'packages/gatsby/src/generators/application/files/LICENSE',
            hash: '5169a5e4135e9f7e5ff7b2c835dfb34e48202ff7',
            ext: '',
          },
          {
            file:
              'packages/gatsby/src/generators/application/files/package.json',
            hash: '30af12ad8109ddf7df860265fb32a4ad424c5297',
            ext: '.json',
          },
          {
            file: 'packages/gatsby/src/generators/application/files/README.md',
            hash: 'ebc6e40b7c5bfa3b7a869b0ee3067b9722e1e15b',
            ext: '.md',
          },
          {
            file:
              'packages/gatsby/src/generators/application/files/src/images/logo.svg',
            hash: 'a3827fd49f34d5bd89fabdc74664600204bef235',
            ext: '.svg',
          },
          {
            file:
              'packages/gatsby/src/generators/application/files/src/pages/404.js',
            hash: 'df313f75051eb6e8b71116df3e4c1c73729c8e5a',
            ext: '.js',
          },
          {
            file:
              'packages/gatsby/src/generators/application/files/src/pages/index.module.__style__',
            hash: '756d4bb08ff463dceb2db56557834334120ce0e4',
            ext: '.__style__',
          },
          {
            file:
              'packages/gatsby/src/generators/application/files/src/pages/index.spec.tsx__tmpl__',
            hash: '3b04b38ec583c1db0c9189ab696b9b2e076781a5',
            ext: '.tsx__tmpl__',
          },
          {
            file:
              'packages/gatsby/src/generators/application/files/src/pages/index.tsx__tmpl__',
            hash: '0145ba308a371540902a1f6dc1ac2788fc569eb7',
            ext: '.tsx__tmpl__',
          },
          {
            file:
              'packages/gatsby/src/generators/application/files/src/pages/logo.svg',
            hash: 'b59f98431d3f90cee3d87b771ed85547980b7b23',
            ext: '.svg',
          },
          {
            file:
              'packages/gatsby/src/generators/application/files/src/pages/star.svg',
            hash: '901053d3854900761496d4077229c1633391b272',
            ext: '.svg',
          },
          {
            file:
              'packages/gatsby/src/generators/application/files/tsconfig.app.json__tmpl__',
            hash: '432e3cac2173be124034f985235a1f468ad9ea43',
            ext: '.json__tmpl__',
          },
          {
            file:
              'packages/gatsby/src/generators/application/files/tsconfig.json__tmpl__',
            hash: 'b6056551ec9bbfa2a1c4ae5fa24775718fc0eab3',
            ext: '.json__tmpl__',
          },
          {
            file:
              'packages/gatsby/src/generators/application/lib/add-cypress.ts',
            hash: '5984b0506998454ce7c0f92598f26db01c48724a',
            ext: '.ts',
          },
          {
            file:
              'packages/gatsby/src/generators/application/lib/add-git-ignore-entry.ts',
            hash: '12c730f707f0cf90a46c09500cb2cf42ef3e4367',
            ext: '.ts',
          },
          {
            file: 'packages/gatsby/src/generators/application/lib/add-jest.ts',
            hash: '6394e8310e227a989117fe964323f646c3f2b462',
            ext: '.ts',
          },
          {
            file:
              'packages/gatsby/src/generators/application/lib/add-linting.ts',
            hash: '8c174c24d499070e2f9c6a62f26b46aad2551eae',
            ext: '.ts',
          },
          {
            file:
              'packages/gatsby/src/generators/application/lib/add-prettier-ignore-entry.ts',
            hash: 'd47a6d063992e23633f1da7fd776b72eb5a303ef',
            ext: '.ts',
          },
          {
            file:
              'packages/gatsby/src/generators/application/lib/add-project.ts',
            hash: 'abfb47dfea7c89cf8f89a02ce9280607549dfa15',
            ext: '.ts',
          },
          {
            file:
              'packages/gatsby/src/generators/application/lib/create-application-files.ts',
            hash: 'aba3f67b69a5de0bcd1c43dc75a2e464efaa3901',
            ext: '.ts',
          },
          {
            file:
              'packages/gatsby/src/generators/application/lib/normalize-options.ts',
            hash: '4e302e6d3ea516e632475d0acafe7de767020871',
            ext: '.ts',
          },
          {
            file:
              'packages/gatsby/src/generators/application/lib/set-defaults.ts',
            hash: '936f65ef00f5d518c1667edf154031e99829cf72',
            ext: '.ts',
          },
          {
            file:
              'packages/gatsby/src/generators/application/lib/update-jest-config.ts',
            hash: '1449f743391717cf91a7a8094efd65640a6a8454',
            ext: '.ts',
          },
          {
            file: 'packages/gatsby/src/generators/application/schema.d.ts',
            hash: '0f52774bb7ded6a49b825f17189120cba8eb53da',
            ext: '.ts',
          },
          {
            file: 'packages/gatsby/src/generators/application/schema.json',
            hash: 'c729d4134e5f1eced61a19ceaa4b6e762dde13cd',
            ext: '.json',
          },
          {
            file: 'packages/gatsby/src/generators/component/component.spec.ts',
            hash: '5af206a7ab6b9222de3f0762a3f23aaec4b8995c',
            ext: '.ts',
          },
          {
            file: 'packages/gatsby/src/generators/component/component.ts',
            hash: '1d8938c3da132f4165b63bcf82019b401cdbbf1f',
            ext: '.ts',
          },
          {
            file: 'packages/gatsby/src/generators/component/schema.json',
            hash: 'f31d70e697d44c80b7389a48fe74a76287a2dbba',
            ext: '.json',
          },
          {
            file: 'packages/gatsby/src/generators/init/init.spec.ts',
            hash: '41070ae169d084481b59bb3933d0d755f5fca4af',
            ext: '.ts',
          },
          {
            file: 'packages/gatsby/src/generators/init/init.ts',
            hash: 'b572904ca3f3093b03e6b5f588aa448e71a453d3',
            ext: '.ts',
          },
          {
            file: 'packages/gatsby/src/generators/init/schema.d.ts',
            hash: '1609ce865be3923728169cdfa1e98d996fdace8b',
            ext: '.ts',
          },
          {
            file: 'packages/gatsby/src/generators/init/schema.json',
            hash: '862524809a31917931b5e5fddb4e4e91bb63770a',
            ext: '.json',
          },
          {
            file: 'packages/gatsby/src/generators/page/page.spec.ts',
            hash: 'cf16f6898dbcf78826da9cb046f0d0a7f6653386',
            ext: '.ts',
          },
          {
            file: 'packages/gatsby/src/generators/page/page.ts',
            hash: '64454649eee4c1a0a1c18b17b720916442fe9244',
            ext: '.ts',
          },
          {
            file: 'packages/gatsby/src/generators/page/schema.json',
            hash: 'd3cb98a0e4d8b8ba4b629c279f451b76caee4695',
            ext: '.json',
          },
          {
            file: 'packages/gatsby/src/index.ts',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.ts',
          },
          {
            file:
              'packages/gatsby/src/migrations/update-11-6-0/add-js-include-11-6-0.spec.ts',
            hash: '7ca3eabd653adda2faa1ff401acc8e5565c65561',
            ext: '.ts',
          },
          {
            file:
              'packages/gatsby/src/migrations/update-11-6-0/add-js-include-11-6-0.ts',
            hash: '45998686ede7a22d6eb10881bfc91557a5e39460',
            ext: '.ts',
          },
          {
            file: 'packages/gatsby/src/utils/styles.ts',
            hash: '5f9522550b64c7a726a5ce2d2833a2cd76138fce',
            ext: '.ts',
          },
          {
            file: 'packages/gatsby/src/utils/versions.ts',
            hash: 'ab75bfc6a6f80e359950055eddf7ad4e66d326cc',
            ext: '.ts',
          },
          {
            file: 'packages/gatsby/tsconfig.json',
            hash: '58bd2c97a66f5e5ea5d05c8a5709ee79bad02094',
            ext: '.json',
          },
          {
            file: 'packages/gatsby/tsconfig.lib.json',
            hash: 'dbe90e0855d2ef980595dcc17f577088662cfb4d',
            ext: '.json',
          },
          {
            file: 'packages/gatsby/tsconfig.spec.json',
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
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/react/jest.config.js',
              passWithNoTests: true,
            },
            outputs: ['coverage/packages/react'],
          },
          'build-base': {
            executor: '@nrwl/node:package',
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
            outputs: ['{options.outputPath}'],
          },
          build: {
            executor: '@nrwl/workspace:run-commands',
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
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'packages/react/**/*.ts',
                'packages/react/**/*.spec.ts',
                'packages/react/**/*_spec.ts',
                'packages/react/**/*.spec.tsx',
                'packages/react/**/*.spec.js',
                'packages/react/**/*.spec.jsx',
                'packages/react/**/*.d.ts',
              ],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/react/.eslintrc.json',
            hash: '3aa795c8cdc8d6ffb3b73673d0810758518b8d1d',
            ext: '.json',
          },
          {
            file: 'packages/react/ast-utils.ts',
            hash: '1b96d3f6e2bf28e4377cdcd9ddfccc0a766c5bee',
            ext: '.ts',
          },
          {
            file: 'packages/react/babel.ts',
            hash: 'bf0e9acf59b80047f3161aeb8753d6a7d85cf923',
            ext: '.ts',
          },
          {
            file: 'packages/react/collection.json',
            hash: '64023ed55981d7d1c9125ef7acae609e4e1d84a9',
            ext: '.json',
          },
          {
            file: 'packages/react/index.ts',
            hash: '825d02fd9963647e91329b2973fdc2e47be928cc',
            ext: '.ts',
          },
          {
            file: 'packages/react/jest.config.js',
            hash: '6a1d703f676a8d8a3dca3285bc4c4b95e693a868',
            ext: '.js',
          },
          {
            file: 'packages/react/migrations.json',
            hash: '9cffe969d289d388cfeab7315597d4c61baf6799',
            ext: '.json',
          },
          {
            file: 'packages/react/package.json',
            hash: '2851d12440f3cf15cd54050c5f16453cc3ddaac4',
            ext: '.json',
          },
          {
            file: 'packages/react/plugins/bundle-babel.ts',
            hash: '7662b3fb3e5174de3049f837ad19279e9fb76a34',
            ext: '.ts',
          },
          {
            file: 'packages/react/plugins/bundle-rollup.ts',
            hash: '9f9eaa63a026156e6ff58ec500108cfe5f1e6ab7',
            ext: '.ts',
          },
          {
            file: 'packages/react/plugins/jest.ts',
            hash: '5f9b306b409c469869b2d4da9ed29bbb85557ab5',
            ext: '.ts',
          },
          {
            file: 'packages/react/plugins/webpack.ts',
            hash: 'f808c592dc1eee377d434d0a97480a1f247fa1ac',
            ext: '.ts',
          },
          {
            file: 'packages/react/README.md',
            hash: '8cd6bc5f994ff561dd5bfee2a8940f652df1f01a',
            ext: '.md',
          },
          {
            file:
              'packages/react/src/generators/application/application.spec.ts',
            hash: '56266da8bca038e40a44bd192298a9d2c7809b77',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/generators/application/application.ts',
            hash: '6dbe60140b51deb7e03d26c93fb2ffa89be35b60',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/generators/application/files/common/.babelrc__tmpl__',
            hash: 'c2db7bd4a91419753969094fe3770a423ef5cc95',
            ext: '',
          },
          {
            file:
              'packages/react/src/generators/application/files/common/.browserslistrc__tmpl__',
            hash: 'f1d12df4faa25ab7f0f03196105e957395f609af',
            ext: '',
          },
          {
            file:
              'packages/react/src/generators/application/files/common/src/app/__fileName__.spec.tsx__tmpl__',
            hash: '3564d9a7493357d94c977ed5a1b611853160a2a5',
            ext: '.tsx__tmpl__',
          },
          {
            file:
              'packages/react/src/generators/application/files/common/src/app/logo.svg',
            hash: '8fa84ab5092a65217b22dd0be03de5c6aea9a648',
            ext: '.svg',
          },
          {
            file:
              'packages/react/src/generators/application/files/common/src/app/star.svg',
            hash: '901053d3854900761496d4077229c1633391b272',
            ext: '.svg',
          },
          {
            file:
              'packages/react/src/generators/application/files/common/src/assets/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file:
              'packages/react/src/generators/application/files/common/src/environments/environment.prod.ts__tmpl__',
            hash: '3612073bc31cd4c1f5d6cbb00318521e9a61bd8a',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/react/src/generators/application/files/common/src/environments/environment.ts__tmpl__',
            hash: 'd9370e924b51bc67ecddee7fc3b6693681a324b6',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/react/src/generators/application/files/common/src/favicon.ico',
            hash: '317ebcb2336e0833a22dddf0ab287849f26fda57',
            ext: '.ico',
          },
          {
            file:
              'packages/react/src/generators/application/files/common/src/index.html',
            hash: '85edca9f5dbfe168c52a079b2d48c2f49283ef97',
            ext: '.html',
          },
          {
            file:
              'packages/react/src/generators/application/files/common/src/main.tsx__tmpl__',
            hash: 'af82fc91a81c198c69a2420fcc751cd4a80d4f16',
            ext: '.tsx__tmpl__',
          },
          {
            file:
              'packages/react/src/generators/application/files/common/src/polyfills.ts__tmpl__',
            hash: '2adf3d05b6fcf479dd61c74f6bda95d9edb6ac6b',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/react/src/generators/application/files/common/tsconfig.app.json__tmpl__',
            hash: '4597c8742503ac67e16256cba1cc1de23afb046e',
            ext: '.json__tmpl__',
          },
          {
            file:
              'packages/react/src/generators/application/files/common/tsconfig.json__tmpl__',
            hash: '074c6682dcf705553b4f2adbd7d734b28b544319',
            ext: '.json__tmpl__',
          },
          {
            file:
              'packages/react/src/generators/application/files/css-module/src/app/__fileName__.module.__style__',
            hash: '04d9c847539e100d1109d670c54d9ed50b78c76d',
            ext: '.__style__',
          },
          {
            file:
              'packages/react/src/generators/application/files/css-module/src/app/__fileName__.tsx__tmpl__',
            hash: '3ac65364d207d6aeeb91497638e13361120f885d',
            ext: '.tsx__tmpl__',
          },
          {
            file:
              'packages/react/src/generators/application/files/css-module/src/styles.__style__',
            hash: '90d4ee0072ce3fc41812f8af910219f9eea3c3de',
            ext: '.__style__',
          },
          {
            file:
              'packages/react/src/generators/application/files/global-css/src/app/__fileName__.__style__',
            hash: '5d5777c1cbfa4dbc8452e8eb6c532cc772e8b8cf',
            ext: '.__style__',
          },
          {
            file:
              'packages/react/src/generators/application/files/global-css/src/app/__fileName__.tsx__tmpl__',
            hash: '19ba2c30602c9d0bd610fcb03f9060df4ce1055d',
            ext: '.tsx__tmpl__',
          },
          {
            file:
              'packages/react/src/generators/application/files/global-css/src/styles.__style__',
            hash: '90d4ee0072ce3fc41812f8af910219f9eea3c3de',
            ext: '.__style__',
          },
          {
            file:
              'packages/react/src/generators/application/files/none/src/app/__fileName__.tsx__tmpl__',
            hash: '8b6835c4f62674c80d11b8814dde721c1fbdf9da',
            ext: '.tsx__tmpl__',
          },
          {
            file:
              'packages/react/src/generators/application/files/styled-jsx/src/app/__fileName__.tsx__tmpl__',
            hash: 'f6b74e0678d277c5782b750861507f0af5cf3f35',
            ext: '.tsx__tmpl__',
          },
          {
            file:
              'packages/react/src/generators/application/files/styled-module/src/app/__fileName__.tsx__tmpl__',
            hash: '76b5f43afe55b4c715cf7d831923772dde0ce228',
            ext: '.tsx__tmpl__',
          },
          {
            file:
              'packages/react/src/generators/application/lib/add-cypress.ts',
            hash: 'bf1ebf574c5b25da29f2a9af9c4e2a369997a581',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/generators/application/lib/add-jest.ts',
            hash: 'c4de9c8055248c2ead41e4ec4b1b14886aa6297c',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/generators/application/lib/add-project.ts',
            hash: 'dab69b6501a9947a130016c1429cf51e8c0830f0',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/generators/application/lib/add-routing.ts',
            hash: 'fdbc164f53d43ff4c70fb0b6e2e41f444e559bee',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/generators/application/lib/create-application-files.ts',
            hash: '5ee656b0996dc71c64e0da905dd1e44c4bd1db04',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/generators/application/lib/normalize-options.ts',
            hash: 'b53d72cfc7a90d1cfd4f0c979d5d9143a4d43f78',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/generators/application/lib/set-defaults.ts',
            hash: 'c0cced760665cbcbe0a50bf31ecaed4f5198e3a2',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/generators/application/lib/update-jest-config.ts',
            hash: 'b725b314a3aac27a4acebd1eea96fe3f10dc3423',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/generators/application/schema.d.ts',
            hash: '9884a21bf84fb6e515ce5c99c54281f81bb44d82',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/generators/application/schema.json',
            hash: 'de30f709591132610a4fa880c060476aca570e97',
            ext: '.json',
          },
          {
            file:
              'packages/react/src/generators/component-cypress-spec/component-cypress-spec.spec.ts',
            hash: '1dc9098c1349039698f66ae24d43f0bd9f9931d0',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/generators/component-cypress-spec/component-cypress-spec.ts',
            hash: 'a77d4b4b8310f7a8f258fb2c2cd4a938d7223705',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/generators/component-cypress-spec/files/__componentName__.spec.__fileExt__',
            hash: '9a14b836dbdf405834c77faa2cd50bbb87c85867',
            ext: '.__fileExt__',
          },
          {
            file:
              'packages/react/src/generators/component-cypress-spec/schema.json',
            hash: 'cc4083fe9d50f154e6f195ea978a0498e273a97c',
            ext: '.json',
          },
          {
            file:
              'packages/react/src/generators/component-story/component-story.spec.ts',
            hash: 'f5aaf10ba0397316ecd7045cbc380a97a33b06f2',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/generators/component-story/component-story.ts',
            hash: 'a4b1f2f15d9223560b7e135b21a6359887a01b81',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/generators/component-story/files/__componentFileName__.stories.__fileExt__',
            hash: '3d7f850d3644b82ae1d09b328821ef7387051be1',
            ext: '.__fileExt__',
          },
          {
            file: 'packages/react/src/generators/component-story/schema.json',
            hash: 'd0b1be1a4820e292c838805ee3b3ac4e266b5b59',
            ext: '.json',
          },
          {
            file: 'packages/react/src/generators/component/component.spec.ts',
            hash: '7084fe15c78e3f1d6cc8e73f50ee01922f0eb307',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/generators/component/component.ts',
            hash: '49dd2038d6cb9d8421a241979ba4469ea7c6c365',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/generators/component/files/__fileName__.__style__',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.__style__',
          },
          {
            file:
              'packages/react/src/generators/component/files/__fileName__.module.__style__',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.__style__',
          },
          {
            file:
              'packages/react/src/generators/component/files/__fileName__.spec.tsx__tmpl__',
            hash: '1254163ca353e63ee49c816a5c8bf4c4058b6646',
            ext: '.tsx__tmpl__',
          },
          {
            file:
              'packages/react/src/generators/component/files/__fileName__.tsx__tmpl__',
            hash: '3d91f10acf63abc9a39af999347c37f6e4fc7105',
            ext: '.tsx__tmpl__',
          },
          {
            file: 'packages/react/src/generators/component/schema.d.ts',
            hash: 'c571eb8f2b1e8e4c17c85cf67a050aa691abc0d9',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/generators/component/schema.json',
            hash: 'cf8ab12c31db66d7f953ea1f721f869fa05cfc5c',
            ext: '.json',
          },
          {
            file: 'packages/react/src/generators/init/init.spec.ts',
            hash: 'de5b42fc072bc0848d798610ac083eec0bcbcf37',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/generators/init/init.ts',
            hash: '14db125f371e04feb9483a92e55a84e6529c8321',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/generators/init/schema.d.ts',
            hash: '1609ce865be3923728169cdfa1e98d996fdace8b',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/generators/init/schema.json',
            hash: 'a22cd922691bd3a0aa9f0b2fc7fd39eede0284a9',
            ext: '.json',
          },
          {
            file:
              'packages/react/src/generators/library/files/lib/.babelrc__tmpl__',
            hash: 'd10d05a41f7d738e2b8853ac695159fc9e2352bb',
            ext: '',
          },
          {
            file:
              'packages/react/src/generators/library/files/lib/package.json__tmpl__',
            hash: 'fa518765a372fc2c8593fdd59b748f284d1ee495',
            ext: '.json__tmpl__',
          },
          {
            file: 'packages/react/src/generators/library/files/lib/README.md',
            hash: 'b74453ce2e8395837aad3c7c03e3ab14ae819218',
            ext: '.md',
          },
          {
            file:
              'packages/react/src/generators/library/files/lib/src/index.ts__tmpl__',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/react/src/generators/library/files/lib/tsconfig.json__tmpl__',
            hash: '514efa55d71046e9d0c0531b40b0e934dc553c71',
            ext: '.json__tmpl__',
          },
          {
            file:
              'packages/react/src/generators/library/files/lib/tsconfig.lib.json__tmpl__',
            hash: '7957a7db8e768299aedbeccac435a30024adb5c4',
            ext: '.json__tmpl__',
          },
          {
            file: 'packages/react/src/generators/library/library.spec.ts',
            hash: '3170c11766a0def34ebbb91186f032347837736f',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/generators/library/library.ts',
            hash: '73beaf2100ed2d56120ffa0828113b396188b62c',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/generators/library/schema.d.ts',
            hash: 'aa745e787bd76bf876f211468c2c811ebbbb34aa',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/generators/library/schema.json',
            hash: '01a3cf43777086689dc81b118a8e703a6e826884',
            ext: '.json',
          },
          {
            file:
              'packages/react/src/generators/redux/files/__directory__/__fileName__.slice.spec.ts__tmpl__',
            hash: 'b96f5f281e11c1803ea7b8ff6dbbec98ee3ece38',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/react/src/generators/redux/files/__directory__/__fileName__.slice.ts__tmpl__',
            hash: 'f6addfdd414badddaf7981143baa14582d6b4283',
            ext: '.ts__tmpl__',
          },
          {
            file: 'packages/react/src/generators/redux/redux.spec.ts',
            hash: '1d198c4d0b248a444de246547fe1ef9ee8cc0b64',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/generators/redux/redux.ts',
            hash: '21617d9a4a88160b672ea9ea91808aa943f05e5a',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/generators/redux/schema.d.ts',
            hash: '4d20fcddece6acf5673cd2bbb81b16d767bf9b0f',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/generators/redux/schema.json',
            hash: '3a8e54e1e4cfe1088355f4d7beff3b4361756aee',
            ext: '.json',
          },
          {
            file: 'packages/react/src/generators/stories/schema.json',
            hash: '29ca0bfd02af42817d160cd0682af445df0a4a39',
            ext: '.json',
          },
          {
            file: 'packages/react/src/generators/stories/stories-app.spec.ts',
            hash: '053305b033516db4daf0fd9051b808fbf7f2ed97',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/generators/stories/stories-lib.spec.ts',
            hash: 'b718f31ec3269332954498d0e6c89a5e5b2d5356',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/generators/stories/stories.ts',
            hash: 'd8f12cf1cad7f63feacb07bcb8db662761576859',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/generators/storybook-configuration/configuration.spec.ts',
            hash: '5f9522d0565adb052b57c8c4f3b6c822b0cd1b9b',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/generators/storybook-configuration/configuration.ts',
            hash: '76d42a1b52b52fbd2efce98ece791e01f1bc367e',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/generators/storybook-configuration/schema.d.ts',
            hash: '2914ba947fbf02d0e569872b9dc293ecfc046379',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/generators/storybook-configuration/schema.json',
            hash: 'af3dddbd8650e5ff512a05734f23c45e3ce64e60',
            ext: '.json',
          },
          {
            file:
              'packages/react/src/generators/storybook-migrate-defaults-5-to-6/migrate-defaults-5-to-6.spec.ts',
            hash: '31238c30ea41cd6151ab55e1cc823bc871334a47',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/generators/storybook-migrate-defaults-5-to-6/migrate-defaults-5-to-6.ts',
            hash: '405b82144544aaa3b86c5e757dceff897ead7184',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/generators/storybook-migrate-defaults-5-to-6/schema.d.ts',
            hash: 'c2dab2c3c1c3a0bba2a8922063d7e33d626fe5a5',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/generators/storybook-migrate-defaults-5-to-6/schema.json',
            hash: '8cb93dc53b21c47700ddec7a175f3a88f57f2e71',
            ext: '.json',
          },
          {
            file:
              'packages/react/src/migrations/update-10-4-0/update-10-4-0.spec.ts',
            hash: 'e131c524d92596f1d4a123554f86c286a332c48f',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/migrations/update-10-4-0/update-10-4-0.ts',
            hash: 'df51a4deb2676e51876b94ab1494f20ec2d819a0',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/migrations/update-11-0-0/rename-emotion-packages-11-0-0.spec.ts',
            hash: 'af78e1a8f1f82b2b5000cde9ce4fdf24ff515db8',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/migrations/update-11-0-0/rename-emotion-packages-11-0-0.ts',
            hash: '8845c6dd9ca8bf0ee7085d59c352128fb5843e90',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/migrations/update-11-0-0/update-11-0-0.spec.ts',
            hash: 'd56fe83d7454760f9f318062d3d9dc48c89343e0',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/migrations/update-11-0-0/update-11-0-0.ts',
            hash: 'f1e4543f83a75038ceba7f4698f5e5dcdc28218c',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/migrations/update-11-2-0/move-react-redux-types-package-11-2-0.spec.ts',
            hash: '777da6f5fddd15d0930d31c1179aaa6171ce7d40',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/migrations/update-11-2-0/move-react-redux-types-package-11-2-0.ts',
            hash: '384c0dab067666f51a500afa2dc2f369f797eaa6',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/migrations/update-12-0-0/remove-react-redux-types-package.spec.ts',
            hash: '7d181a6262d8632cc229b059ec88d8c63c8272ca',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/migrations/update-12-0-0/remove-react-redux-types-package.ts',
            hash: '242d033576d97e6a7fd89cd203525c202d1e2880',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/migrations/update-12-0-0/update-emotion-setup.spec.ts',
            hash: '94cbbc633e66f17a4d411ecde1ffc980a279fc3d',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/migrations/update-12-0-0/update-emotion-setup.ts',
            hash: '50ca6b56281a5e9064e7e0b16f7c6ecff21117e2',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/migrations/update-12-0-0/use-react-jsx-in-tsconfig.spec.ts',
            hash: '8695e36948e82d782e6482acbdfee67f7271bcea',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/migrations/update-12-0-0/use-react-jsx-in-tsconfig.ts',
            hash: 'd414ed408cc316a380822b7d3197a7bfa8d503ae',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/migrations/update-8-10-0/update-8-10-0.spec.ts',
            hash: 'fc72268a72568449cadc8f4abc94bc80d38dd042',
            ext: '.ts',
          },
          {
            file:
              'packages/react/src/migrations/update-8-10-0/update-8-10-0.ts',
            hash: 'ae6ef302b55390a6738afeadf631550593752954',
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
            hash: 'd2071766d1b876114bbc9f0f2d55883fe1e99252',
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
            hash: '376052a194b151a74e859693abebf215a2cb80f8',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/migrations/update-9-4-0/babelrc-9-4-0.ts',
            hash: '37ce5df73ffceac298ab39566c5acdfb86754b1f',
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
            file: 'packages/react/src/migrations/utils/rules.ts',
            hash: '2fbf009568e8cf09775ed1e9d3b0c4bddd89e3e4',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/migrations/utils/testing.ts',
            hash: 'f0997b0d8c0555471fd3ddf2736c261b65dd0115',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/rules/add-styled-dependencies.ts',
            hash: 'ac5c93aef52ec20b61999476cc6963f14a833f59',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/utils/assertion.spec.ts',
            hash: '1a91285a67151b84239c2b21a17128a11e30196b',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/utils/assertion.ts',
            hash: '59d939ff531eab6eade158f6384d095a371d1fb7',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/utils/ast-utils.spec.ts',
            hash: '99b299d395ddac4143f31e58871a4095863e1318',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/utils/ast-utils.ts',
            hash: 'd61766cf053337ffac7094f71b042598b093f493',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/utils/dependencies.ts',
            hash: '8dcd07e1c1e5dd3705845c48ba8d3a59c9536c7e',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/utils/format-file.ts',
            hash: '3d88cb29a2abb1f67314d28ef0d17677953f4b3a',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/utils/jest-utils.ts',
            hash: '89e534d699042cce75bc39279812694a6995f676',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/utils/lint.ts',
            hash: 'ba15b331b41da4fb0b322d7cb5ba13f6f303f3d9',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/utils/styled.ts',
            hash: '57a5dd86b9972b3b25ed955addb332b8269dab88',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/utils/testing-generators.ts',
            hash: '5db546ce31632bee95f2fa2960d0d705acda9369',
            ext: '.ts',
          },
          {
            file: 'packages/react/src/utils/versions.ts',
            hash: 'd25d5031a7c32f1e7bf90ef37f13903b02521993',
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
            hash: '4692cb8336600e15db53b49005e35ea8b8dc5130',
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
    jest: {
      name: 'jest',
      type: 'lib',
      data: {
        root: 'packages/jest',
        sourceRoot: 'packages/jest',
        projectType: 'library',
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/jest/jest.config.js',
              passWithNoTests: true,
            },
            outputs: ['coverage/packages/jest'],
          },
          'build-base': {
            executor: '@nrwl/node:package',
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
                {
                  input: 'packages/jest',
                  glob: '**/*.d.ts',
                  output: '/',
                },
                'LICENSE',
              ],
            },
            outputs: ['{options.outputPath}'],
          },
          build: {
            executor: '@nrwl/workspace:run-commands',
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
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'packages/jest/**/*.ts',
                'packages/jest/**/*.spec.ts',
                'packages/jest/**/*.spec.tsx',
                'packages/jest/**/*.spec.js',
                'packages/jest/**/*.spec.jsx',
                'packages/jest/**/*.d.ts',
              ],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/jest/.eslintrc.json',
            hash: 'b1ef91f966e4cd74328251a2e5283956c269dbfc',
            ext: '.json',
          },
          {
            file: 'packages/jest/collection.json',
            hash: 'ee5119e98a662977e892e20c7afaadcbdb22aba8',
            ext: '.json',
          },
          {
            file: 'packages/jest/executors.json',
            hash: '32ee933857560dbacdb2a20177a148c811158b7a',
            ext: '.json',
          },
          {
            file: 'packages/jest/index.ts',
            hash: '173f624287912e361afb7a0e3af0f0ba685af817',
            ext: '.ts',
          },
          {
            file: 'packages/jest/jest.config.js',
            hash: 'bba87a4dd195ffeb147e489abf38c151443f034f',
            ext: '.js',
          },
          {
            file: 'packages/jest/migrations.json',
            hash: '02152ce62764a9d80f7774897eedc27307477de5',
            ext: '.json',
          },
          {
            file: 'packages/jest/package.json',
            hash: '75f50c256fb4447a27ab825e8f69957a1b33368b',
            ext: '.json',
          },
          {
            file: 'packages/jest/plugins/resolver.ts',
            hash: '2ca8f340d9a7c53b75cd8a05a0d95fed92935d52',
            ext: '.ts',
          },
          {
            file: 'packages/jest/preset/index.ts',
            hash: '6256a436c833d514db8ca2bc5194e6cfbea2d83d',
            ext: '.ts',
          },
          {
            file: 'packages/jest/preset/jest-preset.ts',
            hash: '9168996861e84a50b99e41dadab78c06c7e1993a',
            ext: '.ts',
          },
          {
            file: 'packages/jest/README.md',
            hash: 'a3d7f178ce28df35620f4abded9a9a9955b8d18f',
            ext: '.md',
          },
          {
            file: 'packages/jest/src/executors/jest/compat.ts',
            hash: '5e83b59b8ab03068f665347d06b3453e5931f876',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/executors/jest/jest.impl.spec.ts',
            hash: 'ebba4f8d41b8ce5f8e0ba6176725e1fe19d99525',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/executors/jest/jest.impl.ts',
            hash: 'ccc5e55cb93446f6f301e4896bce67c1bd271772',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/executors/jest/schema.d.ts',
            hash: 'af396a6628fe3f27bacf6151cc36599413a71ead',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/executors/jest/schema.json',
            hash: '300f2a53b042991ef2a04b5c9a25998ffe8507f6',
            ext: '.json',
          },
          {
            file: 'packages/jest/src/generators/init/init.spec.ts',
            hash: '9a5300c0d8fb0a9b470c4505d1bf67d2c99a3378',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/generators/init/init.ts',
            hash: '6199701f7ed28607606144e8a60093613f09fda7',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/generators/init/schema.d.ts',
            hash: 'a4e35c09d6b25fa9c3e12831fdf4ecbfdc11ff24',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/generators/init/schema.json',
            hash: 'e7659b2a311f6d2bcda7627af73325fd646852ac',
            ext: '.json',
          },
          {
            file:
              'packages/jest/src/generators/jest-project/__snapshots__/jest-project.spec.ts.snap',
            hash: '5a71a06a84c203d022b7ff6844ad504a9794cb24',
            ext: '.snap',
          },
          {
            file:
              'packages/jest/src/generators/jest-project/files/jest.config.js__tmpl__',
            hash: '3f586539c92425873adb392bbb9ab10cd5e8fd3b',
            ext: '.js__tmpl__',
          },
          {
            file:
              'packages/jest/src/generators/jest-project/files/src/test-setup.ts__tmpl__',
            hash: 'ed2d24fecf16657017c452e8d424deaf95baa9d3',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/jest/src/generators/jest-project/files/tsconfig.spec.json__tmpl__',
            hash: '9cad516d73243471ba7d7aa0a3479936213ca26b',
            ext: '.json__tmpl__',
          },
          {
            file:
              'packages/jest/src/generators/jest-project/jest-project.spec.ts',
            hash: 'e7a9c73a8e6ecb01d7a933b80d66a489e8b47bd4',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/generators/jest-project/jest-project.ts',
            hash: '11d92afa57c1affaf32749919b4f845a47f0ca51',
            ext: '.ts',
          },
          {
            file:
              'packages/jest/src/generators/jest-project/lib/check-for-test-target.ts',
            hash: 'e24793c596757597d268a6ac95fc3611a3186001',
            ext: '.ts',
          },
          {
            file:
              'packages/jest/src/generators/jest-project/lib/create-files.ts',
            hash: 'a55c21d90ada892f3bc477b80267e51dbbc54592',
            ext: '.ts',
          },
          {
            file:
              'packages/jest/src/generators/jest-project/lib/update-jestconfig.ts',
            hash: 'bd0bf1c9ead3f8ddaea0162cb34f0e91fc412ec7',
            ext: '.ts',
          },
          {
            file:
              'packages/jest/src/generators/jest-project/lib/update-tsconfig.ts',
            hash: '4a0c5f5e152f3db3306b94a8003b17dbf89dddbb',
            ext: '.ts',
          },
          {
            file:
              'packages/jest/src/generators/jest-project/lib/update-workspace.ts',
            hash: 'a93402e980d48665832fe2e326f2a1279e21e1c6',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/generators/jest-project/schema.d.ts',
            hash: 'af5cc3955755b1f6a294f0b834054babc935a34e',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/generators/jest-project/schema.json',
            hash: 'd44f4d17543895074b44fefee5acfea9e48108e2',
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
            hash: '0b1e43175bc96c92cf4db69f6485fe0678d45a7e',
            ext: '.ts',
          },
          {
            file:
              'packages/jest/src/migrations/update-10-0-0/update-jest-configs.ts',
            hash: '3cd62241875f3bd95c01663626019580f4062be4',
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
              'packages/jest/src/migrations/update-10-3-0/add-jest-extension.spec.ts',
            hash: '23adee0e08d55abd0ad2b0b939ecb0ba9efebfa3',
            ext: '.ts',
          },
          {
            file:
              'packages/jest/src/migrations/update-10-3-0/add-jest-extension.ts',
            hash: 'e84d2a979169290d55929ce7217d9c68d0165f98',
            ext: '.ts',
          },
          {
            file:
              'packages/jest/src/migrations/update-10-3-0/update-projects-property.spec.ts',
            hash: 'b1c58049c7e08eef4d886ea74219530c9d0b9f36',
            ext: '.ts',
          },
          {
            file:
              'packages/jest/src/migrations/update-10-3-0/update-projects-property.ts',
            hash: 'b44ab57b4247c5f32785943d0a0b3ad57d9691e0',
            ext: '.ts',
          },
          {
            file:
              'packages/jest/src/migrations/update-10-3-0/update-ts-jest.spec.ts',
            hash: '5e232c5cbe0ec297a9fe4b2cc8de2f467452e81d',
            ext: '.ts',
          },
          {
            file:
              'packages/jest/src/migrations/update-10-3-0/update-ts-jest.ts',
            hash: '78d332ae08039eda69e2e00041235ffe1a33a150',
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
            file:
              'packages/jest/src/migrations/utils/config/legacy/functions.ts',
            hash: '4863b1240c19af9f51f537cea401dceccdd28bb5',
            ext: '.ts',
          },
          {
            file:
              'packages/jest/src/migrations/utils/config/legacy/update-config.spec.ts',
            hash: '8ebbe9bbe3c8f7a47018403d86713e9f3716aceb',
            ext: '.ts',
          },
          {
            file:
              'packages/jest/src/migrations/utils/config/legacy/update-config.ts',
            hash: 'bb154f7dab9ba63624e57864c4ef2f559da518b0',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/utils/config/functions.ts',
            hash: '72996277d720c02ac4e77eeb9d84ef914ce1fc2d',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/utils/config/update-config.spec.ts',
            hash: 'e7fa100cbd47e70b37ebe05750d563ac46a2a139',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/utils/config/update-config.ts',
            hash: '29a2a304957aebe3b71957d004e990d919e9f343',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/utils/testing.ts',
            hash: '80774e7661e36aad8fc17cb978d7b7a5846d33aa',
            ext: '.ts',
          },
          {
            file: 'packages/jest/src/utils/versions.ts',
            hash: '139259efaac74777eca2512cbc6c541fc83c40b5',
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
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/node/jest.config.js',
              passWithNoTests: true,
            },
            outputs: ['coverage/packages/node'],
          },
          'build-base': {
            executor: '@nrwl/node:package',
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
                {
                  input: 'packages/node',
                  glob: '**/*.d.ts',
                  output: '/',
                },
                'LICENSE',
              ],
            },
            outputs: ['{options.outputPath}'],
          },
          build: {
            executor: '@nrwl/workspace:run-commands',
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
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'packages/node/**/*.ts',
                'packages/node/**/*.spec.ts',
                'packages/node/**/*_spec.ts',
                'packages/node/**/*.spec.tsx',
                'packages/node/**/*.spec.js',
                'packages/node/**/*.spec.jsx',
                'packages/node/**/*.d.ts',
              ],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/node/.eslintrc.json',
            hash: 'aae1d68998ea5ca36454efef684af000540c9565',
            ext: '.json',
          },
          {
            file: 'packages/node/builders.json',
            hash: 'dfe5ae581bdfe9d22fe23ee9c0aafa36ebccc301',
            ext: '.json',
          },
          {
            file: 'packages/node/collection.json',
            hash: '1956ffd690b4cacd5fcc05d35b0f282a97e26280',
            ext: '.json',
          },
          {
            file: 'packages/node/index.ts',
            hash: '2c89d6a04fd6c2a372b0dff36480671e01d24faf',
            ext: '.ts',
          },
          {
            file: 'packages/node/jest.config.js',
            hash: 'a3236377a0162f4bb54a57aa64a6291616d570eb',
            ext: '.js',
          },
          {
            file: 'packages/node/migrations.json',
            hash: 'ac03218981e8ec8823fc7f8d7f031037bd99ce25',
            ext: '.json',
          },
          {
            file: 'packages/node/package.json',
            hash: 'd8a5176b90d91a0ea5ed309bfc45e0bfdaf68019',
            ext: '.json',
          },
          {
            file: 'packages/node/README.md',
            hash: '3b5d271276a98bc7d69ba8ee5811667cb4d81f42',
            ext: '.md',
          },
          {
            file: 'packages/node/src/executors/build/build.impl.spec.ts',
            hash: 'a17b80c8c793c6b2b8d9dab6a8e33998a247f387',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/executors/build/build.impl.ts',
            hash: '79fa9d35d4dadc79d09035ec167084fa6a6b34d2',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/executors/build/compat.ts',
            hash: '31cdeffe6b1deb92360d5be6aac94ba464ddc9cb',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/executors/build/schema.json',
            hash: '389a3e0d6067dd8f193e0a9b17de04e1bb94aee1',
            ext: '.json',
          },
          {
            file: 'packages/node/src/executors/execute/compat.ts',
            hash: 'c3fb5f3b978de729d9a8b8f81320d31e48dba31e',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/executors/execute/execute.impl.spec.ts',
            hash: 'd2b9e1a14bcfc204c956c9d66817a1b9c74e7a49',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/executors/execute/execute.impl.ts',
            hash: 'fe4f2c3a53fed955d4d7f79b9e38179e9a2da922',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/executors/execute/schema.json',
            hash: '4b502b8f9b2f70396c2d08f2ce2ae5d6a1aa5dd4',
            ext: '.json',
          },
          {
            file: 'packages/node/src/executors/package/compat.ts',
            hash: '50966de81d508ea40127aac285c47d2f027e70f3',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/executors/package/package.impl.spec.ts',
            hash: '8895a075f89f3ae355d4d763e0fc1d3c998426c0',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/executors/package/package.impl.ts',
            hash: '9350506ba281c9fa500a0402099098d20d9f9330',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/executors/package/schema.json',
            hash: '581316f04792d946eed87602ed78cdbb32b7f9d7',
            ext: '.json',
          },
          {
            file: 'packages/node/src/executors/package/utils/cli.ts',
            hash: '75096638df534434b51a3d15cd6519a958302ef8',
            ext: '.ts',
          },
          {
            file:
              'packages/node/src/executors/package/utils/compile-typescript-files.ts',
            hash: '1880848b0c1229d55ed01e946dba285cdd9ae1f4',
            ext: '.ts',
          },
          {
            file:
              'packages/node/src/executors/package/utils/copy-asset-files.ts',
            hash: 'e3dd6924b6409e4f2c7620cb5d2ff4de5369c320',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/executors/package/utils/models.ts',
            hash: 'b91cdbe3c18b2d3ed2e2b2c34e796acf17668293',
            ext: '.ts',
          },
          {
            file:
              'packages/node/src/executors/package/utils/normalize-options.ts',
            hash: '5722333e1df0ec1f3363a3c5c95316e573707ca0',
            ext: '.ts',
          },
          {
            file:
              'packages/node/src/executors/package/utils/update-package-json.ts',
            hash: '168e4c64a14483f715006c54f92ee0f58b14720b',
            ext: '.ts',
          },
          {
            file:
              'packages/node/src/generators/application/application.spec.ts',
            hash: '3476a35dc322d14603fd09c5cfb8e45a2d1f87a7',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/generators/application/application.ts',
            hash: 'e18e9b86a5847e9e797a32136ce9cd9db2e4b530',
            ext: '.ts',
          },
          {
            file:
              'packages/node/src/generators/application/files/app/src/app/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file:
              'packages/node/src/generators/application/files/app/src/assets/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file:
              'packages/node/src/generators/application/files/app/src/environments/environment.prod.ts__tmpl__',
            hash: '3612073bc31cd4c1f5d6cbb00318521e9a61bd8a',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/node/src/generators/application/files/app/src/environments/environment.ts__tmpl__',
            hash: 'ffe8aed76642585a382f5673e2c08e96de695788',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/node/src/generators/application/files/app/src/main.ts__tmpl__',
            hash: 'a420803c09eec03f5e419c693d817f785a0b8efa',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/node/src/generators/application/files/app/tsconfig.app.json',
            hash: 'fced0ff59103d3cd8dc147fbe892c40fcecb816e',
            ext: '.json',
          },
          {
            file:
              'packages/node/src/generators/application/files/app/tsconfig.json',
            hash: 'a6db50db59d2d124d9f0bfb5e24a065857d1bee6',
            ext: '.json',
          },
          {
            file: 'packages/node/src/generators/application/schema.d.ts',
            hash: 'd05927ab6b80b9a459ea27baa64e2e955e8bc4dc',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/generators/application/schema.json',
            hash: '0de85eb01a0b36dbc4de2676c563e24e2b062ec8',
            ext: '.json',
          },
          {
            file: 'packages/node/src/generators/init/init.spec.ts',
            hash: 'e8a8efcc6fcdc68686e7dccada53f98e52e61734',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/generators/init/init.ts',
            hash: 'ab38c3be30c70ad3ebd0b2c3b7824974ee21e6d7',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/generators/init/schema.d.ts',
            hash: 'dde6ab28778e7e60ca8413d68251529ec075e183',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/generators/init/schema.json',
            hash: 'e63e0eefbad04a99cd28878c65d0a5114d7acb7c',
            ext: '.json',
          },
          {
            file:
              'packages/node/src/generators/library/files/lib/package.json__tmpl__',
            hash: 'e3a3ad83c46eb57baf768ec2c0e0be269c7bac1c',
            ext: '.json__tmpl__',
          },
          {
            file:
              'packages/node/src/generators/library/files/lib/src/lib/__fileName__.spec.ts__tmpl__',
            hash: '35b0948b95087892cb9694ff9880cf254de6985e',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/node/src/generators/library/files/lib/src/lib/__fileName__.ts__tmpl__',
            hash: '87f0f45f164a16721ae12a45855828b815b5bc82',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/node/src/generators/library/files/lib/tsconfig.lib.json',
            hash: '0dc5244a4b716316159459f8cb882fce5beac7b9',
            ext: '.json',
          },
          {
            file: 'packages/node/src/generators/library/library.spec.ts',
            hash: '7b90227ce3896ea317fd32bfef95298beab372fa',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/generators/library/library.ts',
            hash: 'cad298cb2b092e9c9ef5de2945d176e904c5ebfa',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/generators/library/schema.d.ts',
            hash: '2ff4c8b87038d0aa58eff5ba791122578b89c099',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/generators/library/schema.json',
            hash: '5bed922666c3267c704597e75ad3a276ffd451af',
            ext: '.json',
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
            file: 'packages/node/src/utils/config.spec.ts',
            hash: 'ba412b7bbe5c3404ef9ece10ca10956c5712fd27',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/utils/config.ts',
            hash: 'd524d3ddf0b175c58d0d1470a7684bb94ab2d684',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/utils/generate-package-json.ts',
            hash: '21b8db5c1d7c012d6e02dc4b573131f7f9402059',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/utils/node.config.spec.ts',
            hash: 'ec51625390939e301462c694822a0245d1c869bd',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/utils/node.config.ts',
            hash: 'ffcb3490f622e90b69f309f745a6a81a096ade7e',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/utils/normalize.spec.ts',
            hash: '7cc5e90d63d9c7374bc21009c6d79b0422a9057a',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/utils/normalize.ts',
            hash: '38c06c4d2141cd3cbdd243d81ef2d3fb8eb7b265',
            ext: '.ts',
          },
          {
            file: 'packages/node/src/utils/types.ts',
            hash: '3279aeedd6a156b6477018f8354734502c7a0714',
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
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/next/jest.config.js',
              passWithNoTests: true,
            },
            outputs: ['coverage/packages/next'],
          },
          'build-base': {
            executor: '@nrwl/node:package',
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
                {
                  input: 'packages/next',
                  glob: '**/*.d.ts',
                  output: '/',
                },
                'LICENSE',
              ],
            },
            outputs: ['{options.outputPath}'],
          },
          build: {
            executor: '@nrwl/workspace:run-commands',
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
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'packages/next/**/*.ts',
                'packages/next/**/*.spec.ts',
                'packages/next/**/*_spec.ts',
                'packages/next/**/*.spec.tsx',
                'packages/next/**/*.spec.js',
                'packages/next/**/*.spec.jsx',
                'packages/next/**/*.d.ts',
              ],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/next/.eslintrc.json',
            hash: '4ee1f349fa2ed4935d755007c545fefd58089efb',
            ext: '.json',
          },
          {
            file: 'packages/next/babel.ts',
            hash: '8038e6dea18961c473b1bfa0c7b7274276ba498c',
            ext: '.ts',
          },
          {
            file: 'packages/next/builders.json',
            hash: '65e5f3749518acf39d6d7eab13e69d58af3129ad',
            ext: '.json',
          },
          {
            file: 'packages/next/collection.json',
            hash: '0b5ea6395432aac36114182dd62773397347cda3',
            ext: '.json',
          },
          {
            file: 'packages/next/index.ts',
            hash: 'cda3dc7d75deb416d8e64cdc2c7a72ed54b51d75',
            ext: '.ts',
          },
          {
            file: 'packages/next/jest.config.js',
            hash: '5045a99c966278a5c7bcedc45e7d7bf5fc023494',
            ext: '.js',
          },
          {
            file: 'packages/next/migrations.json',
            hash: '3be109d789588e2dfc03c5781bae3b5891f2c6e9',
            ext: '.json',
          },
          {
            file: 'packages/next/package.json',
            hash: '4921e5dc58f823c2650e1e5bed22e8d9b3e7b6eb',
            ext: '.json',
          },
          {
            file: 'packages/next/plugins/with-nx.ts',
            hash: 'b56d0d1cb784856589f3cacd2a08862be4ef01f5',
            ext: '.ts',
          },
          {
            file: 'packages/next/README.md',
            hash: '774a232dbba9754015197719d1b7ff11c98ea1d0',
            ext: '.md',
          },
          {
            file: 'packages/next/src/executors/build/build.impl.spec.ts',
            hash: '04cd658dc41da9c598c16030d55ee397287bfa8a',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/executors/build/build.impl.ts',
            hash: '1e7de2bf4d2622a9981b20755fb1479e6f95ec00',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/executors/build/compat.ts',
            hash: '477ba0be5f653b607cb16d690a4a97b732e7df29',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/executors/build/lib/create-next-config-file.ts',
            hash: 'b28948ae2be2670c4975ce945789cc7c42ed1d9f',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/executors/build/lib/create-package-json.ts',
            hash: 'c0a784a3b1e3f151a8acd8be9a8ed113f0cc916a',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/executors/build/schema.json',
            hash: '0f45c618bbe0fefe26c32297a5653cb93d0e1508',
            ext: '.json',
          },
          {
            file: 'packages/next/src/executors/export/compat.ts',
            hash: '7bc584476207acf6139fbd5db62f0e73df66df0b',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/executors/export/export.impl.ts',
            hash: '43c7da562e747349d08fcaa7926d0892fc4c83e7',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/executors/export/schema.json',
            hash: '6a6a17659f1452713420373fc5b1a674b9a0a239',
            ext: '.json',
          },
          {
            file: 'packages/next/src/executors/server/compat.ts',
            hash: 'c70f628f39422faa701c618a0b177c996b9c8297',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/executors/server/lib/custom-server.ts',
            hash: 'b80a5cdd5124fbe82d4ef730c8239c17de3c378f',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/executors/server/lib/default-server.ts',
            hash: '22939b1ff7f23d9856d1a49a3db417c61acd64c0',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/executors/server/schema.json',
            hash: 'a5e627818e927b9bc1145ef6b6f2a162cff9a91b',
            ext: '.json',
          },
          {
            file: 'packages/next/src/executors/server/server.impl.ts',
            hash: '84ef5e11400d858ae06fa15e63c25838753da2be',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/generators/application/application.spec.ts',
            hash: 'b90501403e8fd961a76a37a98ca40d5c39b9251c',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/generators/application/application.ts',
            hash: 'dad3169ac123f4f65f3a1e1336e58904e7621dd7',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/generators/application/files/.babelrc__tmpl__',
            hash: 'c77984e670415c0c76c00bbf8da1434ddca20ce2',
            ext: '',
          },
          {
            file:
              'packages/next/src/generators/application/files/index.d.ts__tmpl__',
            hash: '7ba08fa17ccbb3d5eaa4d9c7b435bd44ff43f330',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/next/src/generators/application/files/next-env.d.ts__tmpl__',
            hash: '76a5070588d9126b0491321457f0fc3374396189',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/next/src/generators/application/files/next.config.js__tmpl__',
            hash: '85da39a7b45309bfd315078848c79432e61e7bdb',
            ext: '.js__tmpl__',
          },
          {
            file:
              'packages/next/src/generators/application/files/pages/__fileName__.module.__style__',
            hash: 'f106ef1f66349b266e12bbf38c9f5cae4ac0ecbb',
            ext: '.__style__',
          },
          {
            file:
              'packages/next/src/generators/application/files/pages/__fileName__.tsx__tmpl__',
            hash: '61afb9cbc36e9698137141015d3d0f672a06f58e',
            ext: '.tsx__tmpl__',
          },
          {
            file:
              'packages/next/src/generators/application/files/pages/_app.tsx__tmpl__',
            hash: 'acc2b83f8d7b7646f159ddeedd1900acd6e9bc4e',
            ext: '.tsx__tmpl__',
          },
          {
            file:
              'packages/next/src/generators/application/files/pages/_document.tsx__tmpl__',
            hash: 'a9260716da6fd7fe7d1d6063cc018476540a28bb',
            ext: '.tsx__tmpl__',
          },
          {
            file:
              'packages/next/src/generators/application/files/pages/styles.__stylesExt____tmpl__',
            hash: '315ded51815bfcadd6c5cdbeb051f7edf346307b',
            ext: '.__stylesExt____tmpl__',
          },
          {
            file:
              'packages/next/src/generators/application/files/public/nx-logo-white.svg',
            hash: '577944247dec3ec43f3804672841755f0a483d09',
            ext: '.svg',
          },
          {
            file:
              'packages/next/src/generators/application/files/public/star.svg',
            hash: '901053d3854900761496d4077229c1633391b272',
            ext: '.svg',
          },
          {
            file:
              'packages/next/src/generators/application/files/specs/__fileName__.spec.tsx__tmpl__',
            hash: '42c94022afd1c1c396f85b24a08d75984b8adb9c',
            ext: '.tsx__tmpl__',
          },
          {
            file:
              'packages/next/src/generators/application/files/tsconfig.json__tmpl__',
            hash: '125b73910e7fee120832f2be91690c070bc58e69',
            ext: '.json__tmpl__',
          },
          {
            file: 'packages/next/src/generators/application/lib/add-cypress.ts',
            hash: '5fc3bd3b46d23f75a6d92938cf21c33a4359b71e',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/generators/application/lib/add-jest.ts',
            hash: 'cd1df2593fc98e81454dab66e9dbcb877f2cb98c',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/generators/application/lib/add-linting.ts',
            hash: '959856d149fa949dc4643f1e936f9a6873266822',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/generators/application/lib/add-project.ts',
            hash: '1e39d76ec1bf5c080f4fc2ffb296d69114bf8de4',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/generators/application/lib/create-application-files.helpers.ts',
            hash: '65159c6830ba7675272bb7b8876f4639ae1810fc',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/generators/application/lib/create-application-files.ts',
            hash: 'efef0490999741120022d4474cf79966914ea03a',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/generators/application/lib/create-next-server-files.ts',
            hash: '9d0bbcd27d0ebdfb56c74094a52759d5664f1f44',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/generators/application/lib/normalize-options.ts',
            hash: '34670b9c4af0648afad5cfd5e73756742c7c0791',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/generators/application/lib/set-defaults.ts',
            hash: '3392cdc01f23ee2c557a8f703d42678afe5262dd',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/generators/application/lib/update-jest-config.ts',
            hash: 'bdedfce730ddb13b483f9d296573d0f2fd6697e8',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/generators/application/schema.d.ts',
            hash: 'ab8f723b4775ca8f001f4ba1a37d63fa92c5ca36',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/generators/application/schema.json',
            hash: '65220cc1599226853aa1cb1badf8d74246e07d9e',
            ext: '.json',
          },
          {
            file: 'packages/next/src/generators/component/component.spec.ts',
            hash: '674d8bc3f80104a7f9590ee77f4fbb9865c73de1',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/generators/component/component.ts',
            hash: '792a1b854e961c8dcd0865f8fd00567e1970b3fa',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/generators/component/schema.json',
            hash: '5a9a1217380fbed9fed91ade18f3188e023ac192',
            ext: '.json',
          },
          {
            file: 'packages/next/src/generators/init/init.spec.ts',
            hash: '25b2ee9cc2cde2c0a85020dbaa3569da0d6fb7e3',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/generators/init/init.ts',
            hash: '23686139c61ec424422036c6c711a44d73198ce7',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/generators/init/schema.d.ts',
            hash: '1609ce865be3923728169cdfa1e98d996fdace8b',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/generators/init/schema.json',
            hash: '47b2a0f68b64e97026858f2aa12151c7dbbca4c1',
            ext: '.json',
          },
          {
            file: 'packages/next/src/generators/page/page.spec.ts',
            hash: '3634864c6d7ae409fd11b01efc3633c67a392cce',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/generators/page/page.ts',
            hash: 'e686fac995f85c5d709a60fdc3ad15d6278a02a5',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/generators/page/schema.d.ts',
            hash: '7808a22626a0c0b38ccbe060166e463b192f69d4',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/generators/page/schema.json',
            hash: '69aae1af38b1daf364c28d92f3c19fd8372b06bb',
            ext: '.json',
          },
          {
            file: 'packages/next/src/migrations/update-10-1-0/update-10-1-0.ts',
            hash: '9e18196a45cb1f2cfe0504ce2cf724090c8deaf5',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/migrations/update-11-0-0/rename-emotion-packages-11-0-0.spec.ts',
            hash: '1f19671b9bdd242315771effc5506d60ee66b8e8',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/migrations/update-11-0-0/rename-emotion-packages-11-0-0.ts',
            hash: '4a8d51affbc46b2e528ca2a3cf0fd6b25ec3e612',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/migrations/update-11-0-0/update-11-0-0.spec.ts',
            hash: '9d0d6a512860c12a7e8e7ce89973ed6661e2685f',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/migrations/update-11-0-0/update-11-0-0.ts',
            hash: 'f1e4543f83a75038ceba7f4698f5e5dcdc28218c',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/migrations/update-11-5-0/remove-tsconfig-app-11-5-0.spec.ts',
            hash: '9a11df5a3ba4b3acf98ed51e228333bf154bb7e1',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/migrations/update-11-5-0/remove-tsconfig-app-11-5-0.ts',
            hash: 'e4c4f4a52ebcee1decba30a36f092c0afbbb74f1',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/migrations/update-11-5-0/update-babel-config.spec.ts',
            hash: 'b55a6e6453023a9b9b3259793b6e01f83fcc34e4',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/migrations/update-11-5-0/update-babel-config.ts',
            hash: '47c32090d2bb8e176fccd441db3506c84467b5ac',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/migrations/update-11-6-0/add-js-include-11-6-0.spec.ts',
            hash: 'a9d71c980d78e2aa866501f826d71fb9c7bd18c5',
            ext: '.ts',
          },
          {
            file:
              'packages/next/src/migrations/update-11-6-0/add-js-include-11-6-0.ts',
            hash: '9ea787bf9b8016ea57eda9980000aee4da25e1b0',
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
            file: 'packages/next/src/utils/config-invalid-function.fixture.ts',
            hash: 'cc40a4649c9f7c6cf49dd0092cf1f06bcf727bcd',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/utils/config-not-a-function.fixture.ts',
            hash: '2d1c453106b801311f3658813155d69369599ce3',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/utils/config.fixture.ts',
            hash: '8c33e8ece16f7aed6c22acfdcc7d30917cbb517d',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/utils/config.spec.ts',
            hash: '86e9b539482515770b2e0695d857ad3b664053fa',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/utils/config.ts',
            hash: 'e3089db6129cb42b8746bc406dba62156f136378',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/utils/styles.ts',
            hash: '984b7469064871487e0ca1c1db35279976f1c450',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/utils/types.ts',
            hash: '37d5a1bbb28c2c2e5f1d76295aa3b69ef018eeb4',
            ext: '.ts',
          },
          {
            file: 'packages/next/src/utils/versions.ts',
            hash: '14b7d530783a89a1e98ae172c810b97cba685f0b',
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
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/nest/jest.config.js',
              passWithNoTests: true,
            },
            outputs: ['coverage/packages/nest'],
          },
          'build-base': {
            executor: '@nrwl/node:package',
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
                {
                  input: 'packages/nest',
                  glob: '**/*.d.ts',
                  output: '/',
                },
                'LICENSE',
              ],
            },
            outputs: ['{options.outputPath}'],
          },
          build: {
            executor: '@nrwl/workspace:run-commands',
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
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'packages/nest/**/*.ts',
                'packages/nest/**/*.spec.ts',
                'packages/nest/**/*_spec.ts',
                'packages/nest/**/*.spec.tsx',
                'packages/nest/**/*.spec.js',
                'packages/nest/**/*.spec.jsx',
                'packages/nest/**/*.d.ts',
              ],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/nest/.eslintrc.json',
            hash: 'c2cff7ee97aef926295bd29d075149e52a27b8a7',
            ext: '.json',
          },
          {
            file: 'packages/nest/builders.json',
            hash: 'aa97ded151a5cc5b29308544331dc4e36ae33204',
            ext: '.json',
          },
          {
            file: 'packages/nest/collection.json',
            hash: '5d0887c1ba384f224ae1febdeef03617a617f5c0',
            ext: '.json',
          },
          {
            file: 'packages/nest/index.ts',
            hash: '6c2b36750b25c7b2e6ecd81d4f469129d1d42f11',
            ext: '.ts',
          },
          {
            file: 'packages/nest/jest.config.js',
            hash: 'fb3fca9202819b07c97d1bf18499a539390c18df',
            ext: '.js',
          },
          {
            file: 'packages/nest/migrations.json',
            hash: '26bb42797aff13e526b52a62d110fda2ace09122',
            ext: '.json',
          },
          {
            file: 'packages/nest/package.json',
            hash: '28bff2b8b5821e96dcfcd5d4b9e7445464995283',
            ext: '.json',
          },
          {
            file: 'packages/nest/README.md',
            hash: '58980f56be6953ba769a5c4240ff1640d37ee572',
            ext: '.md',
          },
          {
            file:
              'packages/nest/src/generators/convert-tslint-to-eslint/__snapshots__/convert-tslint-to-eslint.spec.ts.snap',
            hash: 'c14facb023f375c0621ef6c2ed9760c4464e144d',
            ext: '.snap',
          },
          {
            file:
              'packages/nest/src/generators/convert-tslint-to-eslint/convert-tslint-to-eslint.spec.ts',
            hash: 'f9ef6f3cdcf7f4e03e275334f22f38e5e456d383',
            ext: '.ts',
          },
          {
            file:
              'packages/nest/src/generators/convert-tslint-to-eslint/convert-tslint-to-eslint.ts',
            hash: 'e911bafa17311ca35be0468f8fca70608bb17eba',
            ext: '.ts',
          },
          {
            file:
              'packages/nest/src/generators/convert-tslint-to-eslint/schema.json',
            hash: '9c6984af929fb1f4f456a1347fa07781c388661c',
            ext: '.json',
          },
          {
            file: 'packages/nest/src/migrations/update-10-0-0/update-10-0-0.ts',
            hash: '2fa501a3031d1f964bc9baf1196fb02ddb7ca54c',
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
            hash: 'd1fda5163882285b9b2b7160312f7fee5249a65a',
            ext: '.ts',
          },
          {
            file: 'packages/nest/src/schematics/application/application.ts',
            hash: '23c73033a308f2245bc244c5a9bea99af9cab97b',
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
            hash: 'b89983b0c472b12baa693f09625c939fb6b8a4db',
            ext: '.ts',
          },
          {
            file: 'packages/nest/src/schematics/init/schema.d.ts',
            hash: '52ac13000a18d701532ccd65ffecfe545ff28d55',
            ext: '.ts',
          },
          {
            file: 'packages/nest/src/schematics/init/schema.json',
            hash: '1cff4c7b8a7b10c31be6014f203743932f07c754',
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
            hash: 'b129a4dda3de198a457f37b94a3ac64e58fa6bf4',
            ext: '.ts',
          },
          {
            file: 'packages/nest/src/schematics/library/library.ts',
            hash: 'f6e522d4f289f9059ea426240455074a7f6d4387',
            ext: '.ts',
          },
          {
            file: 'packages/nest/src/schematics/library/schema.d.ts',
            hash: '98c40613604a4e18200e3d3a755fd497e370fa73',
            ext: '.ts',
          },
          {
            file: 'packages/nest/src/schematics/library/schema.json',
            hash: 'cec47ef40706b1dca05414efeb2319ed06c1454a',
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
            hash: 'cd36f9b0900e1c54096acb5a92d42d574b6fc526',
            ext: '.ts',
          },
          {
            file: 'packages/nest/src/schematics/nestjs-schematics/schema.d.ts',
            hash: 'ff762ea62d9f6061295a32c8d2148030c2b56d76',
            ext: '.ts',
          },
          {
            file: 'packages/nest/src/schematics/nestjs-schematics/schema.json',
            hash: 'e22effe8c8a45c4656dd51a6eb4c47485b8b3894',
            ext: '.json',
          },
          {
            file: 'packages/nest/src/utils/testing.ts',
            hash: '180712d392b195c281cdd45aeb6c1be162d80d86',
            ext: '.ts',
          },
          {
            file: 'packages/nest/src/utils/versions.ts',
            hash: 'ddfb3aa31ebb7ddc94a248a36dc94c275284c24d',
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
        targets: {
          e2e: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'e2e/storybook/jest.config.js',
              passWithNoTests: true,
              runInBand: true,
            },
            outputs: ['coverage/e2e/storybook'],
          },
        },
        tags: [],
        files: [
          {
            file: 'e2e/storybook/jest.config.js',
            hash: 'ebba572b5acc02bb5309c8c7bb27cfa33e8c476b',
            ext: '.js',
          },
          {
            file: 'e2e/storybook/src/storybook.test.ts',
            hash: '867e29c85f50eeef3612a21343daf05d62980e6d',
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
        targets: {
          e2e: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'e2e/workspace/jest.config.js',
              passWithNoTests: true,
              runInBand: true,
            },
            outputs: ['coverage/e2e/workspace'],
          },
        },
        tags: [],
        files: [
          {
            file: 'e2e/workspace/jest.config.js',
            hash: '717c54805336af7bf2ea436abb697b1f5a760dc5',
            ext: '.js',
          },
          {
            file: 'e2e/workspace/src/create-nx-workspace.test.ts',
            hash: '13660eaea4d145b8bb917197adca3205ad1d7a4e',
            ext: '.ts',
          },
          {
            file: 'e2e/workspace/src/custom-layout.test.ts',
            hash: '7635f55b5fca73b236303041a06de98e21b840b3',
            ext: '.ts',
          },
          {
            file: 'e2e/workspace/src/plugins.test.ts',
            hash: '7c506c558132bea00303dc31a28f41bda3672ee1',
            ext: '.ts',
          },
          {
            file: 'e2e/workspace/src/run-commands.test.ts',
            hash: '01e74aa717f59a756cc96a4634dd3cec8ee58a1b',
            ext: '.ts',
          },
          {
            file: 'e2e/workspace/src/workspace-aux-commands.test.ts',
            hash: 'c693f330351909666f4c7d37b939f75436798005',
            ext: '.ts',
          },
          {
            file: 'e2e/workspace/src/workspace-lib.test.ts',
            hash: 'ce1d42002c5e006bd5d09866e5de197b27bf022b',
            ext: '.ts',
          },
          {
            file: 'e2e/workspace/src/workspace.test.ts',
            hash: '66b4a45b533a4f8287189e0a6d410af0b74b5d73',
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
        targets: {
          e2e: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'e2e/nx-plugin/jest.config.js',
              passWithNoTests: true,
              runInBand: true,
            },
            outputs: ['coverage/e2e/nx-plugin'],
          },
        },
        tags: [],
        files: [
          {
            file: 'e2e/nx-plugin/jest.config.js',
            hash: '95357dd492155741389047f83c7597bb96ea0a70',
            ext: '.js',
          },
          {
            file: 'e2e/nx-plugin/src/nx-plugin.test.ts',
            hash: '4cfdd5bfd7c15fa0ef9637a759bbe2f38517b0d7',
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
    'nx-dev': {
      name: 'nx-dev',
      type: 'app',
      data: {
        root: 'nx-dev/nx-dev',
        sourceRoot: 'nx-dev/nx-dev',
        projectType: 'application',
        targets: {
          build: {
            executor: '@nrwl/next:build',
            outputs: ['{options.outputPath}'],
            options: {
              root: 'nx-dev/nx-dev',
              outputPath: 'dist/nx-dev/nx-dev',
            },
            configurations: {
              production: {},
            },
          },
          serve: {
            executor: '@nrwl/next:server',
            options: {
              buildTarget: 'nx-dev:build',
              dev: true,
            },
            configurations: {
              production: {
                buildTarget: 'nx-dev:build:production',
                dev: false,
              },
            },
          },
          export: {
            executor: '@nrwl/next:export',
            options: {
              buildTarget: 'nx-dev:build:production',
            },
          },
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: ['nx-dev/nx-dev/**/*.{ts,tsx,js,jsx}'],
            },
          },
          test: {
            executor: '@nrwl/jest:jest',
            outputs: ['coverage/nx-dev/nx-dev'],
            options: {
              jestConfig: 'nx-dev/nx-dev/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        tags: ['scope:nx-dev', 'type:app'],
        files: [
          {
            file: 'nx-dev/nx-dev/.babelrc',
            hash: '9fcef0394fdf0b08b16e280fd2cc59c757121afc',
            ext: '',
          },
          {
            file: 'nx-dev/nx-dev/.eslintrc.json',
            hash: 'b8b29b78f406491c8a9e40e042e6738fc5629865',
            ext: '.json',
          },
          {
            file: 'nx-dev/nx-dev/index.d.ts',
            hash: '7ba08fa17ccbb3d5eaa4d9c7b435bd44ff43f330',
            ext: '.ts',
          },
          {
            file: 'nx-dev/nx-dev/jest.config.js',
            hash: 'cba59d7606cf658778de097f1abe11bebc389c91',
            ext: '.js',
          },
          {
            file: 'nx-dev/nx-dev/next-env.d.ts',
            hash: '7b7aa2c7727d88b33b62bee640d607d57cc79599',
            ext: '.ts',
          },
          {
            file: 'nx-dev/nx-dev/next.config.js',
            hash: '4fab0da62de71ba980360baf723bf7346bd11f5b',
            ext: '.js',
          },
          {
            file: 'nx-dev/nx-dev/pages/_app.tsx',
            hash: '369609fc7daf914a74958c3146961ac2d5e51857',
            ext: '.tsx',
          },
          {
            file: 'nx-dev/nx-dev/pages/[version]/[flavor]/[...segments].tsx',
            hash: 'faf4eb3264b61bfd50487a348c230e0954db220a',
            ext: '.tsx',
          },
          {
            file: 'nx-dev/nx-dev/pages/index.module.css',
            hash: '1e4da1d961e76a3fb956d1ea656dff452349c0b7',
            ext: '.css',
          },
          {
            file: 'nx-dev/nx-dev/pages/index.tsx',
            hash: 'fedb7e1e7e55b9eee82acf6ce6e4b72b78f682cc',
            ext: '.tsx',
          },
          {
            file: 'nx-dev/nx-dev/pages/styles.css',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.css',
          },
          {
            file: 'nx-dev/nx-dev/public/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file: 'nx-dev/nx-dev/specs/index.spec.tsx',
            hash: '42c94022afd1c1c396f85b24a08d75984b8adb9c',
            ext: '.tsx',
          },
          {
            file: 'nx-dev/nx-dev/tsconfig.app.json',
            hash: '73c4943df981965c807d419f7c96797ff8956f70',
            ext: '.json',
          },
          {
            file: 'nx-dev/nx-dev/tsconfig.json',
            hash: 'bc1511f9a7529ece28da3f10b130f5398ff2fd69',
            ext: '.json',
          },
          {
            file: 'nx-dev/nx-dev/tsconfig.spec.json',
            hash: 'f7c70376eabebda282b9efe57a8dc9cf640d6bd6',
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
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/tao/jest.config.js',
              passWithNoTests: true,
            },
            outputs: ['coverage/packages/tao'],
          },
          'build-base': {
            executor: '@nrwl/node:package',
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
                {
                  input: 'packages/tao',
                  glob: '**/*.d.ts',
                  output: '/',
                },
                'LICENSE',
              ],
            },
            outputs: ['{options.outputPath}'],
          },
          build: {
            executor: '@nrwl/workspace:run-commands',
            outputs: ['build/packages/tao'],
            options: {
              commands: [
                {
                  command: 'nx build-base tao',
                },
                {
                  command: 'node ./scripts/chmod build/packages/tao/index.js',
                },
                {
                  command: 'node ./scripts/copy-readme.js tao',
                },
              ],
              parallel: false,
            },
          },
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'packages/tao/**/*.ts',
                'packages/tao/**/*.spec.ts',
                'packages/tao/**/*.spec.tsx',
                'packages/tao/**/*.spec.js',
                'packages/tao/**/*.spec.jsx',
                'packages/tao/**/*.d.ts',
              ],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/tao/.eslintrc.json',
            hash: 'f5da5dd170a271af27737e3c81eaac533620def4',
            ext: '.json',
          },
          {
            file: 'packages/tao/index.ts',
            hash: '90f9c8c48ba9ae636a4a69defc8c938bfb68f6ab',
            ext: '.ts',
          },
          {
            file: 'packages/tao/jest.config.js',
            hash: '1031fc8c3a4d646f9da97036aecfcaee9185ebde',
            ext: '.js',
          },
          {
            file: 'packages/tao/package.json',
            hash: '63a9cd9d831fac17ff42ba9aef0f040188f0b2c5',
            ext: '.json',
          },
          {
            file: 'packages/tao/README.md',
            hash: '106b9c069cfa3e38a1f0bd442faa539e826453b7',
            ext: '.md',
          },
          {
            file: 'packages/tao/src/commands/generate.ts',
            hash: 'b1528f3858c40d1254b558645f1ab30c09378708',
            ext: '.ts',
          },
          {
            file: 'packages/tao/src/commands/help.ts',
            hash: '98b5fb6b62739df0a17ec5baa276766b73c9331f',
            ext: '.ts',
          },
          {
            file: 'packages/tao/src/commands/migrate.spec.ts',
            hash: 'be2a89a44ece5a9894479ebd7c087dec13e3525f',
            ext: '.ts',
          },
          {
            file: 'packages/tao/src/commands/migrate.ts',
            hash: '9ea00deccb7324b819b34c1f5185bdf36e238544',
            ext: '.ts',
          },
          {
            file: 'packages/tao/src/commands/ngcli-adapter.ts',
            hash: '25addcbe5a590afd7283723fd32c621cfcfd6ade',
            ext: '.ts',
          },
          {
            file: 'packages/tao/src/commands/run.ts',
            hash: '29c71fdd8165cb285c1b00ebad705e8af60ef9b2',
            ext: '.ts',
          },
          {
            file: 'packages/tao/src/compat/compat.ts',
            hash: '5580393c20b01b0dda8e3151c277253ac11c860c',
            ext: '.ts',
          },
          {
            file: 'packages/tao/src/shared/logger.ts',
            hash: '224d85fba16ade8e279dadd7667983fb03884ec5',
            ext: '.ts',
          },
          {
            file: 'packages/tao/src/shared/nx.ts',
            hash: 'a01d4f09db933c5b42ac4e87c4093499d0c0abad',
            ext: '.ts',
          },
          {
            file: 'packages/tao/src/shared/package-manager.ts',
            hash: '08924a6f802627c75bc3c2bcd486894060106cf2',
            ext: '.ts',
          },
          {
            file: 'packages/tao/src/shared/params.spec.ts',
            hash: 'dd9d9aa4bd3e5818862d088fe7304ef51b3f04db',
            ext: '.ts',
          },
          {
            file: 'packages/tao/src/shared/params.ts',
            hash: '721f8f41e3a0e96aa6f9d2629cbc0e82ab44fc6b',
            ext: '.ts',
          },
          {
            file: 'packages/tao/src/shared/print-help.ts',
            hash: 'f20a7d680fd272caa860ee35b6c1ad09f9885420',
            ext: '.ts',
          },
          {
            file: 'packages/tao/src/shared/tree.spec.ts',
            hash: '8f2c2450090279e3e054ca820aefcca3be21a6ec',
            ext: '.ts',
          },
          {
            file: 'packages/tao/src/shared/tree.ts',
            hash: 'd263963584837e5254fdb9beff6846442dc481d7',
            ext: '.ts',
          },
          {
            file: 'packages/tao/src/shared/workspace.ts',
            hash: 'abe303f6323d1353d0206fdcce9266b3c698f75e',
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
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/web/jest.config.js',
              passWithNoTests: true,
            },
            outputs: ['coverage/packages/web'],
          },
          'build-base': {
            executor: '@nrwl/node:package',
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
                {
                  input: 'packages/web',
                  glob: '**/*.d.ts',
                  output: '/',
                },
                'LICENSE',
              ],
            },
            outputs: ['{options.outputPath}'],
          },
          build: {
            executor: '@nrwl/workspace:run-commands',
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
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'packages/web/**/*.ts',
                'packages/web/**/*.spec.ts',
                'packages/web/**/*_spec.ts',
                'packages/web/**/*.spec.tsx',
                'packages/web/**/*.spec.js',
                'packages/web/**/*.spec.jsx',
                'packages/web/**/*.d.ts',
              ],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/web/.eslintrc.json',
            hash: '888142ea070777fa527d89a49d1cb6ea63c515db',
            ext: '.json',
          },
          {
            file: 'packages/web/babel.ts',
            hash: '81a1fdd287d90b6e26237e315d95da8100b04c40',
            ext: '.ts',
          },
          {
            file: 'packages/web/builders.json',
            hash: '29c847d08ead5ab6ce6dda59a3447c0855985524',
            ext: '.json',
          },
          {
            file: 'packages/web/collection.json',
            hash: '0afa5e429d07c5725742dda14a5aff0d5e785d23',
            ext: '.json',
          },
          {
            file: 'packages/web/index.ts',
            hash: '5bdcea824fe081238113711d60341965ccbf69b2',
            ext: '.ts',
          },
          {
            file: 'packages/web/jest.config.js',
            hash: 'd22cd6ab6c79b106fec4b8fa3fb137d349bfda12',
            ext: '.js',
          },
          {
            file: 'packages/web/migrations.json',
            hash: '4fc2d3d77dc563ceab8e76a69083b60f09565cb7',
            ext: '.json',
          },
          {
            file: 'packages/web/package.json',
            hash: '540ffab481f35bf97abf2372ebbe6b0668ccb138',
            ext: '.json',
          },
          {
            file: 'packages/web/README.md',
            hash: '9573897655b005f776c73bfe8d0747dac6867dc1',
            ext: '.md',
          },
          {
            file: 'packages/web/src/builders/build/build.impl.ts',
            hash: '2975f26dc86f9991ea93381c8e3fd8b830134983',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/builders/build/compat.ts',
            hash: '14878ff5d2c6b1263c1c12ae0a306c9a9fd58dc3',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/builders/build/schema.json',
            hash: 'd067d0cfd6eec6728a76a7e58a4efa6f790fce65',
            ext: '.json',
          },
          {
            file: 'packages/web/src/builders/dev-server/compat.ts',
            hash: 'a587ba361b107642d805754f6799b90f2ac6bde4',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/builders/dev-server/dev-server.impl.spec.ts',
            hash: '3035c54ee485a70e9bb7a30af801c3ee291ac867',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/builders/dev-server/dev-server.impl.ts',
            hash: 'dbdda6dc2636b90ef48526aaa4c0d112d58d5e28',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/builders/dev-server/schema.json',
            hash: '4f3fb9086f797ae8b2f6bb516c972c1ee51b3f26',
            ext: '.json',
          },
          {
            file: 'packages/web/src/builders/file-server/compat.ts',
            hash: '094efc423152340e16481ea0d7c25caa077a714f',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/builders/file-server/file-server.impl.ts',
            hash: 'c044bce578aba84c763b429eb2b181249b296675',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/builders/file-server/schema.json',
            hash: '9eadecf92ba0cd6240fa06c9576d506a8f04af68',
            ext: '.json',
          },
          {
            file: 'packages/web/src/builders/package/compat.ts',
            hash: '5abbbd033d6434c7be7a7830fa9b74e0796329cf',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/builders/package/package.impl.spec.ts',
            hash: 'ab43334d2ded1ac282c29832fde4caed1506ce0b',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/builders/package/package.impl.ts',
            hash: 'da393b9eed2abb3d4f7fa4920f18b0fb69103d4d',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/builders/package/run-rollup.ts',
            hash: '774cd0780bc08cade9d726d53e1a49005cf55189',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/builders/package/schema.json',
            hash: '39ab98aa4c7e3e8d82c47bed12a9c13bfe5a5ee9',
            ext: '.json',
          },
          {
            file: 'packages/web/src/generators/application/application.spec.ts',
            hash: '7e7fd955434f4ef8b807b30227b552e6844726ee',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/generators/application/application.ts',
            hash: 'c9ec33ffe3c2eb41a2d41bf05dc41eb4ee1f342c',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/generators/application/files/app/.babelrc__tmpl__',
            hash: '2e593427f7ba2133f2718369cb43067f579b757a',
            ext: '',
          },
          {
            file:
              'packages/web/src/generators/application/files/app/browserslist',
            hash: '8d6179367e7ba6b8cd0fa04b900d6ab4142ab08b',
            ext: '',
          },
          {
            file:
              'packages/web/src/generators/application/files/app/src/app/app.element.__style__',
            hash: '3b63d4dbd7f58fc89f59dca91ef8fbd35405d3cc',
            ext: '.__style__',
          },
          {
            file:
              'packages/web/src/generators/application/files/app/src/app/app.element.spec.ts__tmpl__',
            hash: '09b331189af0bbe4e08f4dbbc78643ba1b343e6c',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/web/src/generators/application/files/app/src/app/app.element.ts__tmpl__',
            hash: 'b3c4531e97c14a575ed931e48bac7edf37696150',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/web/src/generators/application/files/app/src/assets/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file:
              'packages/web/src/generators/application/files/app/src/environments/environment.prod.ts__tmpl__',
            hash: '3612073bc31cd4c1f5d6cbb00318521e9a61bd8a',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/web/src/generators/application/files/app/src/environments/environment.ts__tmpl__',
            hash: 'd9370e924b51bc67ecddee7fc3b6693681a324b6',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/web/src/generators/application/files/app/src/favicon.ico',
            hash: '317ebcb2336e0833a22dddf0ab287849f26fda57',
            ext: '.ico',
          },
          {
            file:
              'packages/web/src/generators/application/files/app/src/index.html',
            hash: '42ece406e8b8a1c34635b9ad6f424411f6bbeb06',
            ext: '.html',
          },
          {
            file:
              'packages/web/src/generators/application/files/app/src/main.ts__tmpl__',
            hash: '12f7aaebe90c53c21c5efc6ad3b571d86f6ff932',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/web/src/generators/application/files/app/src/polyfills.ts__tmpl__',
            hash: '2adf3d05b6fcf479dd61c74f6bda95d9edb6ac6b',
            ext: '.ts__tmpl__',
          },
          {
            file:
              'packages/web/src/generators/application/files/app/src/styles.__style__',
            hash: '90d4ee0072ce3fc41812f8af910219f9eea3c3de',
            ext: '.__style__',
          },
          {
            file:
              'packages/web/src/generators/application/files/app/tsconfig.app.json',
            hash: 'ee0f68db8873be761b4ded20baf3a38286b8bc4e',
            ext: '.json',
          },
          {
            file:
              'packages/web/src/generators/application/files/app/tsconfig.json',
            hash: '795ebf01cbe3c6c661881db9a5b3aec95a69fe9b',
            ext: '.json',
          },
          {
            file: 'packages/web/src/generators/application/schema.d.ts',
            hash: '2e6e69d38ddfa78dc9055efb18f828052580c0e2',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/generators/application/schema.json',
            hash: '875ecfe29b2b238d543e531425095026e85ddd53',
            ext: '.json',
          },
          {
            file: 'packages/web/src/generators/init/init.spec.ts',
            hash: 'cab4a7e743c197893cf6ca1f1ee12776998e58b6',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/generators/init/init.ts',
            hash: 'df7e38f5bdcf2f0d3385eaa67e48069672d5f8f4',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/generators/init/schema.d.ts',
            hash: '7ab6757712763422267ba107cc7811179d6dad46',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/generators/init/schema.json',
            hash: 'b30764c266ff6e492f180bd5c45fec11312c9244',
            ext: '.json',
          },
          {
            file:
              'packages/web/src/migrations/update-11-5-2/create-babelrc-for-workspace-libs.spec.ts',
            hash: '0567c172ec2cf4da2006f7fdd82c7fa4e2f41f52',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/migrations/update-11-5-2/create-babelrc-for-workspace-libs.ts',
            hash: 'a754aeba005d6c40bc567a8bcf3005edaa010625',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/migrations/update-11-5-2/update-existing-babelrc-files.spec.ts',
            hash: 'efb3a20a0ed1e173ffc2c0550db847f11c486737',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/migrations/update-11-5-2/update-existing-babelrc-files.ts',
            hash: '7e0fdea98e26780ac66c481e96ad796688d3451a',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/migrations/update-11-5-2/update-root-babel-config.spec.ts',
            hash: 'c7cdb5925c101f75e2dd0080070c814020267cf1',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/migrations/update-11-5-2/update-root-babel-config.ts',
            hash: '1f0507ae13ab95a637c21eb61b0e6cab33e8f214',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/migrations/update-11-5-2/utils.spec.ts',
            hash: '388067881493d18c5e99dd4add508d62b88a9427',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/migrations/update-11-5-2/utils.ts',
            hash: 'ca682d94ea032195634f55105d56435348707347',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/migrations/update-8-5-0/update-builder-8-5-0.spec.ts',
            hash: 'e5eb7e6bcc54d73674903c7a7650f33401548ae0',
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
            file: 'packages/web/src/utils/config.spec.ts',
            hash: '5ce2196ea38868c6e226dc161f508b69cec5dd07',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/config.ts',
            hash: '4998c0b412ce2c380f4f894c71e69fb3fe9fa528',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/delete-output-dir.ts',
            hash: 'a7d21e9621449f8f6731a2d8e7ad4e996697fac4',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/devserver.config.spec.ts',
            hash: 'e663e1fa954a5467cf98c43dd5a49aaebc83df35',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/devserver.config.ts',
            hash: '3ec224403cc385c2e4cb7cd69c6cd3abe79918f1',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/hash-format.ts',
            hash: 'a85e2cf1a3c843121edb0c769a83139155b3e5d8',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/normalize.spec.ts',
            hash: '8855aad459eded0d69e7334c9c87f76c4a359b1b',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/normalize.ts',
            hash: 'ffa736ba927eb24a94d418355d62c21a3a27e3ae',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/serve-path.ts',
            hash: 'a97502f5c0d5c9556ce6da99f89162e172a40104',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/third-party/.eslintrc.json',
            hash: '90d8894e28293a9d6a4078cdd0a6ad29e450ee1a',
            ext: '.json',
          },
          {
            file: 'packages/web/src/utils/third-party/browser/schema.ts',
            hash: '5293372b26fa04b1288b5cd26015d28dda82cd40',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/models/build-options.ts',
            hash: '1d66feb5698b5cdebf2fea00925452d79772c75d',
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
            hash: '968fa002a855ddaedab41996db6f5a1c480e9f58',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/models/webpack-configs/common.ts',
            hash: 'b82e12b5bb975efe75b18e38a138fe020cab2b01',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/models/webpack-configs/styles.ts',
            hash: '874fe542ab0a8b9576735ae7133267badaab2ea6',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/models/webpack-configs/utils.ts',
            hash: 'a545dcf89abe5db8565247ae5d05ab489b47e3e8',
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
            hash: '3826bdc3c5bd04bf7a99ae695d1b4e7c1de95816',
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
              'packages/web/src/utils/third-party/cli-files/utilities/bundle-calculator.spec.ts',
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
              'packages/web/src/utils/third-party/cli-files/utilities/index-file/__snapshots__/augment-index-html.spec.ts.snap',
            hash: 'df3f4e3a60891ff99e376ae45eddfa899c2cc614',
            ext: '.snap',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/utilities/index-file/augment-index-html.spec.ts',
            hash: '9c53a68985e567926859bf814d0c820968f6a8ad',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/utilities/index-file/augment-index-html.ts',
            hash: '300017d8a669df721dbae35405660c87adeb9655',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/cli-files/utilities/index-file/write-index-html.ts',
            hash: '301bf7208977903557d834125ee319a233af3a2a',
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
            hash: 'f1883b77f42630e6d241d914a3dfa819e113edd9',
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
              'packages/web/src/utils/third-party/utils/build-browser-features.spec.ts',
            hash: '939852e4f52584be73cb4b9f10fc63f2f33755b3',
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
            hash: '892340a474f7dd70a237bae0faf9f09afc2afc21',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/third-party/utils/index.ts',
            hash: 'c529716e911571a6783accd89e17ce4b87f395f1',
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
            hash: '82918013686f7aeb4661786912165aea2458a770',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/utils/normalize-builder-schema.ts',
            hash: 'd90b0b184d78549d863bfab2fb2e619b1a69c8b6',
            ext: '.ts',
          },
          {
            file:
              'packages/web/src/utils/third-party/utils/normalize-file-replacements.ts',
            hash: '8f651968a89a7a9c5c23dde90b925c20339c2b22',
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
            file: 'packages/web/src/utils/types.ts',
            hash: '395f6f5351950c197031203d972bf7aec6f30592',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/versions.ts',
            hash: '66f7d33476d2bf3df79468b2f5a0afcde02c60e7',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/web-babel-loader.ts',
            hash: 'aa5246eab036ec3ff46215172d89141f7238431f',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/web.config.spec.ts',
            hash: '4baffa954347fa6719db4b747bce18fb627d9562',
            ext: '.ts',
          },
          {
            file: 'packages/web/src/utils/web.config.ts',
            hash: '3d633a9ac6ce1a533b70e23bd8e754a47783d9df',
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
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'packages/cli/jest.config.js',
              passWithNoTests: true,
            },
            outputs: ['coverage/packages/cli'],
          },
          'build-base': {
            executor: '@nrwl/node:package',
            options: {
              outputPath: 'build/packages/cli',
              tsConfig: 'packages/cli/tsconfig.lib.json',
              packageJson: 'packages/cli/package.json',
              main: 'packages/cli/bin/nx.ts',
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
                {
                  input: 'packages/cli',
                  glob: '**/*.d.ts',
                  output: '/',
                },
                'LICENSE',
              ],
            },
            outputs: ['{options.outputPath}'],
          },
          build: {
            executor: '@nrwl/workspace:run-commands',
            outputs: ['build/packages/cli'],
            options: {
              commands: [
                {
                  command: 'nx build-base cli',
                },
                {
                  command: 'node ./scripts/chmod build/packages/cli/bin/nx.js',
                },
                {
                  command: 'node ./scripts/copy-readme.js cli',
                },
              ],
              parallel: false,
            },
          },
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'packages/cli/**/*.ts',
                'packages/cli/**/*.spec.ts',
                'packages/cli/**/*_spec.ts',
                'packages/cli/**/*.spec.tsx',
                'packages/cli/**/*.spec.js',
                'packages/cli/**/*.spec.jsx',
                'packages/cli/**/*.d.ts',
              ],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/cli/.eslintrc.json',
            hash: 'a53d7845c652c11bf470dc9f4cf06b866d155618',
            ext: '.json',
          },
          {
            file: 'packages/cli/bin/nx.ts',
            hash: 'af27f4253304ff56a6218d55fbd722b9448f458d',
            ext: '.ts',
          },
          {
            file: 'packages/cli/jest.config.js',
            hash: 'cb958ede149b1816f66e5402fb91d3687bf799bf',
            ext: '.js',
          },
          {
            file: 'packages/cli/lib/decorate-cli.ts',
            hash: '42cd339804ebf0c60d0556d3457a3154dd2ff7f9',
            ext: '.ts',
          },
          {
            file: 'packages/cli/lib/find-workspace-root.ts',
            hash: 'cc104ce8a32dee5ca82600eca1e68acd0d12d94b',
            ext: '.ts',
          },
          {
            file: 'packages/cli/lib/init-local.ts',
            hash: '3ca61d259bffa006b8fd8394e723323c80873165',
            ext: '.ts',
          },
          {
            file: 'packages/cli/lib/output.ts',
            hash: '323291d2481293c98e4e84da4eee5977d52d11be',
            ext: '.ts',
          },
          {
            file: 'packages/cli/lib/parse-run-one-options.spec.ts',
            hash: '352b3e120e020e731c64234cec58d8414ac49aef',
            ext: '.ts',
          },
          {
            file: 'packages/cli/lib/parse-run-one-options.ts',
            hash: 'cc48cec6ab8f1c5b337aae3d73768feb54e2e3f5',
            ext: '.ts',
          },
          {
            file: 'packages/cli/lib/run-cli.ts',
            hash: 'e7be3b365de25bf3f45b01f46c4fca985776e607',
            ext: '.ts',
          },
          {
            file: 'packages/cli/lib/workspace.ts',
            hash: 'a5f21d8fe9b645d08aba3266b31864eeb885343c',
            ext: '.ts',
          },
          {
            file: 'packages/cli/package.json',
            hash: 'aeef022d88be3cf9f07b30af9efdafd5d1d99b0b',
            ext: '.json',
          },
          {
            file: 'packages/cli/README.md',
            hash: 'cb52d49a62da7e4270106f7e5803e5e6dee6e6b5',
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
        targets: {
          'build-base': {
            executor: '@nrwl/node:package',
            options: {
              outputPath: 'build/packages/nx',
              tsConfig: 'packages/nx/tsconfig.lib.json',
              packageJson: 'packages/nx/package.json',
              main: 'packages/nx/bin/nx.ts',
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
                {
                  input: 'packages/nx',
                  glob: '**/*.d.ts',
                  output: '/',
                },
                'LICENSE',
              ],
            },
            outputs: ['{options.outputPath}'],
          },
          build: {
            executor: '@nrwl/workspace:run-commands',
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
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'packages/nx/**/*.ts',
                'packages/nx/**/*.spec.ts',
                'packages/nx/**/*_spec.ts',
                'packages/nx/**/*.spec.tsx',
                'packages/nx/**/*.spec.js',
                'packages/nx/**/*.spec.jsx',
                'packages/nx/**/*.d.ts',
              ],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'packages/nx/.eslintrc.json',
            hash: '3655ba59246e881fea3b0a23fe53c4f0b9f46b98',
            ext: '.json',
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
            hash: 'f6df373c33900a865d2123ced35c3f139457c990',
            ext: '.json',
          },
          {
            file: 'packages/nx/README.md',
            hash: 'a1faa845a3ea3f52d54409093a3d569bc7782309',
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
        targets: {
          e2e: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'e2e/angular/jest.config.js',
              passWithNoTests: true,
              runInBand: true,
            },
            outputs: ['coverage/e2e/angular'],
          },
        },
        tags: [],
        files: [
          {
            file: 'e2e/angular/jest.config.js',
            hash: '91f6b815053936b6d998cdb115694d405185ab83',
            ext: '.js',
          },
          {
            file: 'e2e/angular/src/angular-app.test.ts',
            hash: '06d4d4e9097489ac3ff053240fdc78be3b7f874d',
            ext: '.ts',
          },
          {
            file: 'e2e/angular/src/angular-core.test.ts',
            hash: '403c153d3f21bcc06d743cd3356de844b34618f1',
            ext: '.ts',
          },
          {
            file: 'e2e/angular/src/angular-library.test.ts',
            hash: '74c8a41d12bb994079848a05caa6b7119311d4a9',
            ext: '.ts',
          },
          {
            file: 'e2e/angular/src/config-compat.test.ts',
            hash: '6ee6983dc604ec88ec199399ab43a20dd3fdcdf3',
            ext: '.ts',
          },
          {
            file: 'e2e/angular/src/ng-add.test.ts',
            hash: 'd1b8616c393958b18108aeb72c209be1a77a7f77',
            ext: '.ts',
          },
          {
            file: 'e2e/angular/src/ngrx.test.ts',
            hash: 'e2f4ed7df28a78e4c3ae68b998f5028cf2462fe9',
            ext: '.ts',
          },
          {
            file: 'e2e/angular/src/storybook.test.ts',
            hash: '52ffe7f89530881595ae14c9eaa573b25e75b78d',
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
        targets: {
          e2e: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'e2e/cypress/jest.config.js',
              passWithNoTests: true,
              runInBand: true,
            },
            outputs: ['coverage/e2e/cypress'],
          },
        },
        tags: [],
        files: [
          {
            file: 'e2e/cypress/jest.config.js',
            hash: '41b597b471c375777b38dbbc6e266c5502144baf',
            ext: '.js',
          },
          {
            file: 'e2e/cypress/src/cypress.test.ts',
            hash: '7596ad1f5c182082b3d1b9d8fa64e171134c4d08',
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
        targets: {
          e2e: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'e2e/linter/jest.config.js',
              passWithNoTests: true,
              runInBand: true,
            },
            outputs: ['coverage/e2e/linter'],
          },
        },
        tags: [],
        files: [
          {
            file: 'e2e/linter/jest.config.js',
            hash: '816ca40333014d7dbaced4129d7bfc9050005304',
            ext: '.js',
          },
          {
            file: 'e2e/linter/src/linter.test.ts',
            hash: '472c3176c388fa68d46c4885ee72b36c87cda445',
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
    'e2e-gatsby': {
      name: 'e2e-gatsby',
      type: 'app',
      data: {
        root: 'e2e/gatsby',
        sourceRoot: 'e2e/gatsby',
        projectType: 'application',
        targets: {
          e2e: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'e2e/gatsby/jest.config.js',
              passWithNoTests: true,
              runInBand: true,
            },
            outputs: ['coverage/e2e/gatsby'],
          },
        },
        tags: [],
        files: [
          {
            file: 'e2e/gatsby/jest.config.js',
            hash: '20df9ab0643d3797e5e5183ef91012ff17dc91d8',
            ext: '.js',
          },
          {
            file: 'e2e/gatsby/src/gatsby.test.ts',
            hash: '6a1aa9d5a6cfee8ec4a8eabb202c0c2a10b553f2',
            ext: '.ts',
          },
          {
            file: 'e2e/gatsby/tsconfig.json',
            hash: '6d5abf84832009a8c70e7a910c49f332bf1f0612',
            ext: '.json',
          },
          {
            file: 'e2e/gatsby/tsconfig.spec.json',
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
        targets: {},
        tags: [],
        files: [
          {
            file: 'e2e/utils/index.ts',
            hash: 'e6ec862071c7e27ee9f622538bb813f9295a67f5',
            ext: '.ts',
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
        targets: {
          e2e: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'e2e/react/jest.config.js',
              passWithNoTests: true,
              runInBand: true,
            },
            outputs: ['coverage/e2e/react'],
          },
        },
        tags: [],
        files: [
          {
            file: 'e2e/react/jest.config.js',
            hash: 'd27fed803bd8b80ee64526c09f23b309bb0adefa',
            ext: '.js',
          },
          {
            file: 'e2e/react/src/react-package.test.ts',
            hash: 'cd35ec388d54ef1434e80bc005cb62a2e65cae91',
            ext: '.ts',
          },
          {
            file: 'e2e/react/src/react.test.ts',
            hash: '2ce8f0b6038abe762da0fe12b7e3a7181042d815',
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
        targets: {
          e2e: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'e2e/jest/jest.config.js',
              passWithNoTests: true,
              runInBand: true,
            },
            outputs: ['coverage/e2e/jest'],
          },
        },
        tags: [],
        files: [
          {
            file: 'e2e/jest/jest.config.js',
            hash: '4ef73deb2b48865741deadf617c18eb5effbea5b',
            ext: '.js',
          },
          {
            file: 'e2e/jest/src/jest.test.ts',
            hash: '0837323a8567c84d5889820a1f6f9a83784d1c0e',
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
        targets: {
          e2e: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'e2e/next/jest.config.js',
              passWithNoTests: true,
              runInBand: true,
            },
            outputs: ['coverage/e2e/next'],
          },
        },
        tags: [],
        files: [
          {
            file: 'e2e/next/jest.config.js',
            hash: '20df9ab0643d3797e5e5183ef91012ff17dc91d8',
            ext: '.js',
          },
          {
            file: 'e2e/next/src/next.test.ts',
            hash: '9e0d4c1d2c9ce2d90535365fdb3dfad785b07c52',
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
        targets: {
          e2e: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'e2e/node/jest.config.js',
              passWithNoTests: true,
              runInBand: true,
            },
            outputs: ['coverage/e2e/node'],
          },
        },
        tags: [],
        files: [
          {
            file: 'e2e/node/jest.config.js',
            hash: 'c938f163aa9b24c4eb717b06693db46f6775e0fe',
            ext: '.js',
          },
          {
            file: 'e2e/node/src/node.test.ts',
            hash: '64f6b37a96beb0e5dd51ef1263788a17b89fa106',
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
        targets: {
          e2e: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'e2e/cli/jest.config.js',
              passWithNoTests: true,
              runInBand: true,
            },
            outputs: ['coverage/e2e/cli'],
          },
        },
        tags: [],
        files: [
          {
            file: 'e2e/cli/jest.config.js',
            hash: '80ea217aac72bbf19439518e90eeb1fc1aaccd6c',
            ext: '.js',
          },
          {
            file: 'e2e/cli/src/cli.test.ts',
            hash: 'f0b466b86d170cd6391860c427c977579f3d7dd7',
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
        targets: {
          e2e: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'e2e/web/jest.config.js',
              passWithNoTests: true,
              runInBand: true,
            },
            outputs: ['coverage/e2e/web'],
          },
        },
        tags: [],
        files: [
          {
            file: 'e2e/web/jest.config.js',
            hash: '4804f561c23bce7b0c96fcd3d43bbc5139778eeb',
            ext: '.js',
          },
          {
            file: 'e2e/web/src/file-server.test.ts',
            hash: '2cddc5a4418dd09456dd1fd5cc095746372c0ef0',
            ext: '.ts',
          },
          {
            file: 'e2e/web/src/web.test.ts',
            hash: 'e12e699c8d76c258fcbcd96d224cad9a75ea5b7c',
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
    'npm:core-js': {
      type: 'npm',
      name: 'npm:core-js',
      data: {
        version: '^3.6.5',
        packageName: 'core-js',
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
    'npm:gray-matter': {
      type: 'npm',
      name: 'npm:gray-matter',
      data: {
        version: '^4.0.2',
        packageName: 'gray-matter',
        files: [],
      },
    },
    'npm:marked': {
      type: 'npm',
      name: 'npm:marked',
      data: {
        version: '^2.0.1',
        packageName: 'marked',
        files: [],
      },
    },
    'npm:react': {
      type: 'npm',
      name: 'npm:react',
      data: {
        version: '17.0.2',
        packageName: 'react',
        files: [],
      },
    },
    'npm:react-dom': {
      type: 'npm',
      name: 'npm:react-dom',
      data: {
        version: '17.0.2',
        packageName: 'react-dom',
        files: [],
      },
    },
    'npm:@angular-devkit/architect': {
      type: 'npm',
      name: 'npm:@angular-devkit/architect',
      data: {
        version: '~0.1102.0',
        packageName: '@angular-devkit/architect',
        files: [],
      },
    },
    'npm:@angular-devkit/build-angular': {
      type: 'npm',
      name: 'npm:@angular-devkit/build-angular',
      data: {
        version: '~0.1102.0',
        packageName: '@angular-devkit/build-angular',
        files: [],
      },
    },
    'npm:@angular-devkit/build-optimizer': {
      type: 'npm',
      name: 'npm:@angular-devkit/build-optimizer',
      data: {
        version: '~0.1102.0',
        packageName: '@angular-devkit/build-optimizer',
        files: [],
      },
    },
    'npm:@angular-devkit/build-webpack': {
      type: 'npm',
      name: 'npm:@angular-devkit/build-webpack',
      data: {
        version: '~0.1102.0',
        packageName: '@angular-devkit/build-webpack',
        files: [],
      },
    },
    'npm:@angular-devkit/core': {
      type: 'npm',
      name: 'npm:@angular-devkit/core',
      data: {
        version: '~11.2.0',
        packageName: '@angular-devkit/core',
        files: [],
      },
    },
    'npm:@angular-devkit/schematics': {
      type: 'npm',
      name: 'npm:@angular-devkit/schematics',
      data: {
        version: '~11.2.0',
        packageName: '@angular-devkit/schematics',
        files: [],
      },
    },
    'npm:@angular-eslint/eslint-plugin': {
      type: 'npm',
      name: 'npm:@angular-eslint/eslint-plugin',
      data: {
        version: '~2.0.2',
        packageName: '@angular-eslint/eslint-plugin',
        files: [],
      },
    },
    'npm:@angular-eslint/eslint-plugin-template': {
      type: 'npm',
      name: 'npm:@angular-eslint/eslint-plugin-template',
      data: {
        version: '~2.0.2',
        packageName: '@angular-eslint/eslint-plugin-template',
        files: [],
      },
    },
    'npm:@angular-eslint/template-parser': {
      type: 'npm',
      name: 'npm:@angular-eslint/template-parser',
      data: {
        version: '~2.0.2',
        packageName: '@angular-eslint/template-parser',
        files: [],
      },
    },
    'npm:@angular/cli': {
      type: 'npm',
      name: 'npm:@angular/cli',
      data: {
        version: '~11.2.0',
        packageName: '@angular/cli',
        files: [],
      },
    },
    'npm:@angular/common': {
      type: 'npm',
      name: 'npm:@angular/common',
      data: {
        version: '~11.2.0',
        packageName: '@angular/common',
        files: [],
      },
    },
    'npm:@angular/compiler': {
      type: 'npm',
      name: 'npm:@angular/compiler',
      data: {
        version: '~11.2.0',
        packageName: '@angular/compiler',
        files: [],
      },
    },
    'npm:@angular/compiler-cli': {
      type: 'npm',
      name: 'npm:@angular/compiler-cli',
      data: {
        version: '~11.2.0',
        packageName: '@angular/compiler-cli',
        files: [],
      },
    },
    'npm:@angular/core': {
      type: 'npm',
      name: 'npm:@angular/core',
      data: {
        version: '~11.2.0',
        packageName: '@angular/core',
        files: [],
      },
    },
    'npm:@angular/forms': {
      type: 'npm',
      name: 'npm:@angular/forms',
      data: {
        version: '~11.2.0',
        packageName: '@angular/forms',
        files: [],
      },
    },
    'npm:@angular/platform-browser': {
      type: 'npm',
      name: 'npm:@angular/platform-browser',
      data: {
        version: '~11.2.0',
        packageName: '@angular/platform-browser',
        files: [],
      },
    },
    'npm:@angular/platform-browser-dynamic': {
      type: 'npm',
      name: 'npm:@angular/platform-browser-dynamic',
      data: {
        version: '~11.2.0',
        packageName: '@angular/platform-browser-dynamic',
        files: [],
      },
    },
    'npm:@angular/router': {
      type: 'npm',
      name: 'npm:@angular/router',
      data: {
        version: '~11.2.0',
        packageName: '@angular/router',
        files: [],
      },
    },
    'npm:@angular/service-worker': {
      type: 'npm',
      name: 'npm:@angular/service-worker',
      data: {
        version: '~11.2.0',
        packageName: '@angular/service-worker',
        files: [],
      },
    },
    'npm:@angular/upgrade': {
      type: 'npm',
      name: 'npm:@angular/upgrade',
      data: {
        version: '~11.2.0',
        packageName: '@angular/upgrade',
        files: [],
      },
    },
    'npm:@babel/core': {
      type: 'npm',
      name: 'npm:@babel/core',
      data: {
        version: '7.12.13',
        packageName: '@babel/core',
        files: [],
      },
    },
    'npm:@babel/plugin-proposal-class-properties': {
      type: 'npm',
      name: 'npm:@babel/plugin-proposal-class-properties',
      data: {
        version: '7.12.13',
        packageName: '@babel/plugin-proposal-class-properties',
        files: [],
      },
    },
    'npm:@babel/plugin-proposal-decorators': {
      type: 'npm',
      name: 'npm:@babel/plugin-proposal-decorators',
      data: {
        version: '7.12.13',
        packageName: '@babel/plugin-proposal-decorators',
        files: [],
      },
    },
    'npm:@babel/plugin-transform-regenerator': {
      type: 'npm',
      name: 'npm:@babel/plugin-transform-regenerator',
      data: {
        version: '7.12.13',
        packageName: '@babel/plugin-transform-regenerator',
        files: [],
      },
    },
    'npm:@babel/preset-env': {
      type: 'npm',
      name: 'npm:@babel/preset-env',
      data: {
        version: '7.12.13',
        packageName: '@babel/preset-env',
        files: [],
      },
    },
    'npm:@babel/preset-react': {
      type: 'npm',
      name: 'npm:@babel/preset-react',
      data: {
        version: '7.12.13',
        packageName: '@babel/preset-react',
        files: [],
      },
    },
    'npm:@babel/preset-typescript': {
      type: 'npm',
      name: 'npm:@babel/preset-typescript',
      data: {
        version: '7.12.13',
        packageName: '@babel/preset-typescript',
        files: [],
      },
    },
    'npm:@cypress/webpack-preprocessor': {
      type: 'npm',
      name: 'npm:@cypress/webpack-preprocessor',
      data: {
        version: '~4.1.2',
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
    'npm:@ngrx/component-store': {
      type: 'npm',
      name: 'npm:@ngrx/component-store',
      data: {
        version: '11.0.0',
        packageName: '@ngrx/component-store',
        files: [],
      },
    },
    'npm:@ngrx/effects': {
      type: 'npm',
      name: 'npm:@ngrx/effects',
      data: {
        version: '11.0.0',
        packageName: '@ngrx/effects',
        files: [],
      },
    },
    'npm:@ngrx/entity': {
      type: 'npm',
      name: 'npm:@ngrx/entity',
      data: {
        version: '11.0.0',
        packageName: '@ngrx/entity',
        files: [],
      },
    },
    'npm:@ngrx/router-store': {
      type: 'npm',
      name: 'npm:@ngrx/router-store',
      data: {
        version: '11.0.0',
        packageName: '@ngrx/router-store',
        files: [],
      },
    },
    'npm:@ngrx/schematics': {
      type: 'npm',
      name: 'npm:@ngrx/schematics',
      data: {
        version: '11.0.0',
        packageName: '@ngrx/schematics',
        files: [],
      },
    },
    'npm:@ngrx/store': {
      type: 'npm',
      name: 'npm:@ngrx/store',
      data: {
        version: '11.0.0',
        packageName: '@ngrx/store',
        files: [],
      },
    },
    'npm:@ngrx/store-devtools': {
      type: 'npm',
      name: 'npm:@ngrx/store-devtools',
      data: {
        version: '11.0.0',
        packageName: '@ngrx/store-devtools',
        files: [],
      },
    },
    'npm:@ngtools/webpack': {
      type: 'npm',
      name: 'npm:@ngtools/webpack',
      data: {
        version: '~10.1.3',
        packageName: '@ngtools/webpack',
        files: [],
      },
    },
    'npm:@nrwl/cli': {
      type: 'npm',
      name: 'npm:@nrwl/cli',
      data: {
        version: '12.0.0-rc.1',
        packageName: '@nrwl/cli',
        files: [],
      },
    },
    'npm:@nrwl/cypress': {
      type: 'npm',
      name: 'npm:@nrwl/cypress',
      data: {
        version: '12.0.0-rc.1',
        packageName: '@nrwl/cypress',
        files: [],
      },
    },
    'npm:@nrwl/eslint-plugin-nx': {
      type: 'npm',
      name: 'npm:@nrwl/eslint-plugin-nx',
      data: {
        version: '12.0.0-rc.1',
        packageName: '@nrwl/eslint-plugin-nx',
        files: [],
      },
    },
    'npm:@nrwl/jest': {
      type: 'npm',
      name: 'npm:@nrwl/jest',
      data: {
        version: '12.0.0-rc.1',
        packageName: '@nrwl/jest',
        files: [],
      },
    },
    'npm:@nrwl/linter': {
      type: 'npm',
      name: 'npm:@nrwl/linter',
      data: {
        version: '12.0.0-rc.1',
        packageName: '@nrwl/linter',
        files: [],
      },
    },
    'npm:@nrwl/next': {
      type: 'npm',
      name: 'npm:@nrwl/next',
      data: {
        version: '12.0.0-rc.1',
        packageName: '@nrwl/next',
        files: [],
      },
    },
    'npm:@nrwl/node': {
      type: 'npm',
      name: 'npm:@nrwl/node',
      data: {
        version: '12.0.0-rc.1',
        packageName: '@nrwl/node',
        files: [],
      },
    },
    'npm:@nrwl/nx-cloud': {
      type: 'npm',
      name: 'npm:@nrwl/nx-cloud',
      data: {
        version: '11.2.0',
        packageName: '@nrwl/nx-cloud',
        files: [],
      },
    },
    'npm:@nrwl/tao': {
      type: 'npm',
      name: 'npm:@nrwl/tao',
      data: {
        version: '12.0.0-rc.1',
        packageName: '@nrwl/tao',
        files: [],
      },
    },
    'npm:@nrwl/web': {
      type: 'npm',
      name: 'npm:@nrwl/web',
      data: {
        version: '12.0.0-rc.1',
        packageName: '@nrwl/web',
        files: [],
      },
    },
    'npm:@nrwl/workspace': {
      type: 'npm',
      name: 'npm:@nrwl/workspace',
      data: {
        version: '12.0.0-rc.1',
        packageName: '@nrwl/workspace',
        files: [],
      },
    },
    'npm:@reduxjs/toolkit': {
      type: 'npm',
      name: 'npm:@reduxjs/toolkit',
      data: {
        version: '1.5.0',
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
    'npm:@rollup/plugin-json': {
      type: 'npm',
      name: 'npm:@rollup/plugin-json',
      data: {
        version: '^4.1.0',
        packageName: '@rollup/plugin-json',
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
        version: '~11.2.0',
        packageName: '@schematics/angular',
        files: [],
      },
    },
    'npm:@storybook/addon-knobs': {
      type: 'npm',
      name: 'npm:@storybook/addon-knobs',
      data: {
        version: '^6.0.21',
        packageName: '@storybook/addon-knobs',
        files: [],
      },
    },
    'npm:@storybook/angular': {
      type: 'npm',
      name: 'npm:@storybook/angular',
      data: {
        version: '^6.0.21',
        packageName: '@storybook/angular',
        files: [],
      },
    },
    'npm:@storybook/core': {
      type: 'npm',
      name: 'npm:@storybook/core',
      data: {
        version: '^6.0.21',
        packageName: '@storybook/core',
        files: [],
      },
    },
    'npm:@storybook/react': {
      type: 'npm',
      name: 'npm:@storybook/react',
      data: {
        version: '^6.0.21',
        packageName: '@storybook/react',
        files: [],
      },
    },
    'npm:@svgr/webpack': {
      type: 'npm',
      name: 'npm:@svgr/webpack',
      data: {
        version: '^5.4.0',
        packageName: '@svgr/webpack',
        files: [],
      },
    },
    'npm:@testing-library/react': {
      type: 'npm',
      name: 'npm:@testing-library/react',
      data: {
        version: '11.2.5',
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
    'npm:@types/cytoscape': {
      type: 'npm',
      name: 'npm:@types/cytoscape',
      data: {
        version: '^3.14.7',
        packageName: '@types/cytoscape',
        files: [],
      },
    },
    'npm:@types/eslint': {
      type: 'npm',
      name: 'npm:@types/eslint',
      data: {
        version: '^7.2.2',
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
    'npm:@types/is-ci': {
      type: 'npm',
      name: 'npm:@types/is-ci',
      data: {
        version: '^2.0.0',
        packageName: '@types/is-ci',
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
    'npm:@types/marked': {
      type: 'npm',
      name: 'npm:@types/marked',
      data: {
        version: '^2.0.0',
        packageName: '@types/marked',
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
        version: '17.0.3',
        packageName: '@types/react',
        files: [],
      },
    },
    'npm:@types/react-dom': {
      type: 'npm',
      name: 'npm:@types/react-dom',
      data: {
        version: '17.0.3',
        packageName: '@types/react-dom',
        files: [],
      },
    },
    'npm:@types/react-router-dom': {
      type: 'npm',
      name: 'npm:@types/react-router-dom',
      data: {
        version: '5.1.7',
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
    'npm:@types/webpack-dev-server': {
      type: 'npm',
      name: 'npm:@types/webpack-dev-server',
      data: {
        version: '^3.11.1',
        packageName: '@types/webpack-dev-server',
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
        version: '^4.3.0',
        packageName: '@typescript-eslint/eslint-plugin',
        files: [],
      },
    },
    'npm:@typescript-eslint/experimental-utils': {
      type: 'npm',
      name: 'npm:@typescript-eslint/experimental-utils',
      data: {
        version: '^4.3.0',
        packageName: '@typescript-eslint/experimental-utils',
        files: [],
      },
    },
    'npm:@typescript-eslint/parser': {
      type: 'npm',
      name: 'npm:@typescript-eslint/parser',
      data: {
        version: '^4.3.0',
        packageName: '@typescript-eslint/parser',
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
        version: '^10.2.5',
        packageName: 'autoprefixer',
        files: [],
      },
    },
    'npm:axios': {
      type: 'npm',
      name: 'npm:axios',
      data: {
        version: '0.21.1',
        packageName: 'axios',
        files: [],
      },
    },
    'npm:babel-jest': {
      type: 'npm',
      name: 'npm:babel-jest',
      data: {
        version: '26.2.2',
        packageName: 'babel-jest',
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
    'npm:babel-plugin-transform-typescript-metadata': {
      type: 'npm',
      name: 'npm:babel-plugin-transform-typescript-metadata',
      data: {
        version: '^0.3.1',
        packageName: 'babel-plugin-transform-typescript-metadata',
        files: [],
      },
    },
    'npm:browserslist': {
      type: 'npm',
      name: 'npm:browserslist',
      data: {
        version: '^4.14.6',
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
    'npm:chalk': {
      type: 'npm',
      name: 'npm:chalk',
      data: {
        version: '4.1.0',
        packageName: 'chalk',
        files: [],
      },
    },
    'npm:circular-dependency-plugin': {
      type: 'npm',
      name: 'npm:circular-dependency-plugin',
      data: {
        version: '5.2.0',
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
        version: '^6.0.1',
        packageName: 'cypress',
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
    'npm:cytoscape-anywhere-panning': {
      type: 'npm',
      name: 'npm:cytoscape-anywhere-panning',
      data: {
        version: '^0.5.5',
        packageName: 'cytoscape-anywhere-panning',
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
    'npm:cytoscape-popper': {
      type: 'npm',
      name: 'npm:cytoscape-popper',
      data: {
        version: '^1.0.7',
        packageName: 'cytoscape-popper',
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
    'npm:depcheck': {
      type: 'npm',
      name: 'npm:depcheck',
      data: {
        version: '^1.3.1',
        packageName: 'depcheck',
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
    'npm:ejs': {
      type: 'npm',
      name: 'npm:ejs',
      data: {
        version: '^3.1.5',
        packageName: 'ejs',
        files: [],
      },
    },
    'npm:eslint': {
      type: 'npm',
      name: 'npm:eslint',
      data: {
        version: '7.10.0',
        packageName: 'eslint',
        files: [],
      },
    },
    'npm:eslint-config-prettier': {
      type: 'npm',
      name: 'npm:eslint-config-prettier',
      data: {
        version: '^8.1.0',
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
        version: '2.22.1',
        packageName: 'eslint-plugin-import',
        files: [],
      },
    },
    'npm:eslint-plugin-jsx-a11y': {
      type: 'npm',
      name: 'npm:eslint-plugin-jsx-a11y',
      data: {
        version: '6.4.1',
        packageName: 'eslint-plugin-jsx-a11y',
        files: [],
      },
    },
    'npm:eslint-plugin-react': {
      type: 'npm',
      name: 'npm:eslint-plugin-react',
      data: {
        version: '7.23.1',
        packageName: 'eslint-plugin-react',
        files: [],
      },
    },
    'npm:eslint-plugin-react-hooks': {
      type: 'npm',
      name: 'npm:eslint-plugin-react-hooks',
      data: {
        version: '4.2.0',
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
    'npm:file-type': {
      type: 'npm',
      name: 'npm:file-type',
      data: {
        version: '^16.2.0',
        packageName: 'file-type',
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
    'npm:http-server': {
      type: 'npm',
      name: 'npm:http-server',
      data: {
        version: '0.12.3',
        packageName: 'http-server',
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
    'npm:injection-js': {
      type: 'npm',
      name: 'npm:injection-js',
      data: {
        version: '^2.4.0',
        packageName: 'injection-js',
        files: [],
      },
    },
    'npm:is-ci': {
      type: 'npm',
      name: 'npm:is-ci',
      data: {
        version: '^2.0.0',
        packageName: 'is-ci',
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
        version: '3.12.2',
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
    'npm:lodash.template': {
      type: 'npm',
      name: 'npm:lodash.template',
      data: {
        version: '~4.5.0',
        packageName: 'lodash.template',
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
    'npm:minimist': {
      type: 'npm',
      name: 'npm:minimist',
      data: {
        version: '^1.2.5',
        packageName: 'minimist',
        files: [],
      },
    },
    'npm:next': {
      type: 'npm',
      name: 'npm:next',
      data: {
        version: '10.1.2',
        packageName: 'next',
        files: [],
      },
    },
    'npm:ng-packagr': {
      type: 'npm',
      name: 'npm:ng-packagr',
      data: {
        version: '~11.2.0',
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
    'npm:node-watch': {
      type: 'npm',
      name: 'npm:node-watch',
      data: {
        version: '0.7.0',
        packageName: 'node-watch',
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
    'npm:parse-markdown-links': {
      type: 'npm',
      name: 'npm:parse-markdown-links',
      data: {
        version: '^1.0.4',
        packageName: 'parse-markdown-links',
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
        version: '8.2.4',
        packageName: 'postcss',
        files: [],
      },
    },
    'npm:postcss-import': {
      type: 'npm',
      name: 'npm:postcss-import',
      data: {
        version: '14.0.0',
        packageName: 'postcss-import',
        files: [],
      },
    },
    'npm:postcss-loader': {
      type: 'npm',
      name: 'npm:postcss-loader',
      data: {
        version: '4.2.0',
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
        version: '2.2.1',
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
    'npm:react-redux': {
      type: 'npm',
      name: 'npm:react-redux',
      data: {
        version: '7.2.3',
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
        version: '0.13.7',
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
        version: '^4.0.0',
        packageName: 'rollup-plugin-postcss',
        files: [],
      },
    },
    'npm:rollup-plugin-typescript2': {
      type: 'npm',
      name: 'npm:rollup-plugin-typescript2',
      data: {
        version: '^0.27.1',
        packageName: 'rollup-plugin-typescript2',
        files: [],
      },
    },
    'npm:rxjs': {
      type: 'npm',
      name: 'npm:rxjs',
      data: {
        version: '6.6.3',
        packageName: 'rxjs',
        files: [],
      },
    },
    'npm:rxjs-for-await': {
      type: 'npm',
      name: 'npm:rxjs-for-await',
      data: {
        version: '0.0.2',
        packageName: 'rxjs-for-await',
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
        version: '7.3.4',
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
        version: '0.5.16',
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
        version: '2.3.7',
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
        version: '26.4.0',
        packageName: 'ts-jest',
        files: [],
      },
    },
    'npm:ts-loader': {
      type: 'npm',
      name: 'npm:ts-loader',
      data: {
        version: '5.4.5',
        packageName: 'ts-loader',
        files: [],
      },
    },
    'npm:ts-node': {
      type: 'npm',
      name: 'npm:ts-node',
      data: {
        version: '9.1.1',
        packageName: 'ts-node',
        files: [],
      },
    },
    'npm:tsconfig-paths': {
      type: 'npm',
      name: 'npm:tsconfig-paths',
      data: {
        version: '^3.9.0',
        packageName: 'tsconfig-paths',
        files: [],
      },
    },
    'npm:tsconfig-paths-webpack-plugin': {
      type: 'npm',
      name: 'npm:tsconfig-paths-webpack-plugin',
      data: {
        version: '3.2.0',
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
        version: '^2.0.0',
        packageName: 'tslib',
        files: [],
      },
    },
    'npm:tslint': {
      type: 'npm',
      name: 'npm:tslint',
      data: {
        version: '6.1.3',
        packageName: 'tslint',
        files: [],
      },
    },
    'npm:tslint-to-eslint-config': {
      type: 'npm',
      name: 'npm:tslint-to-eslint-config',
      data: {
        version: '2.2.0',
        packageName: 'tslint-to-eslint-config',
        files: [],
      },
    },
    'npm:typescript': {
      type: 'npm',
      name: 'npm:typescript',
      data: {
        version: '4.0.5',
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
        version: '^4.11.1',
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
        version: '3.11.0',
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
        version: '1.7.2',
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
        version: '^1.5.1',
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
    'npm:yargs-parser': {
      type: 'npm',
      name: 'npm:yargs-parser',
      data: {
        version: '20.0.0',
        packageName: 'yargs-parser',
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
    'npm:levenary': {
      type: 'npm',
      name: 'npm:levenary',
      data: {
        version: '^1.1.1',
        packageName: 'levenary',
        files: [],
      },
    },
  },
  dependencies: {
    'create-nx-workspace': [
      {
        type: 'static',
        source: 'create-nx-workspace',
        target: 'npm:tmp',
      },
      {
        type: 'static',
        source: 'create-nx-workspace',
        target: 'npm:yargs-parser',
      },
      {
        type: 'static',
        source: 'create-nx-workspace',
        target: 'npm:chalk',
      },
      {
        type: 'static',
        source: 'create-nx-workspace',
        target: 'npm:flat',
      },
      {
        type: 'implicit',
        source: 'create-nx-workspace',
        target: 'workspace',
      },
    ],
    'nx-dev-data-access-documents': [
      {
        type: 'static',
        source: 'nx-dev-data-access-documents',
        target: 'npm:@nrwl/jest',
      },
      {
        type: 'static',
        source: 'nx-dev-data-access-documents',
        target: 'npm:gray-matter',
      },
      {
        type: 'static',
        source: 'nx-dev-data-access-documents',
        target: 'npm:marked',
      },
      {
        type: 'static',
        source: 'nx-dev-data-access-documents',
        target: 'npm:@nrwl/workspace',
      },
    ],
    'eslint-plugin-nx': [
      {
        type: 'static',
        source: 'eslint-plugin-nx',
        target: 'npm:confusing-browser-globals',
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
        target: 'devkit',
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
      {
        type: 'implicit',
        source: 'eslint-plugin-nx',
        target: 'workspace',
      },
    ],
    'create-nx-plugin': [
      {
        type: 'static',
        source: 'create-nx-plugin',
        target: 'npm:@nrwl/tao',
      },
      {
        type: 'static',
        source: 'create-nx-plugin',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'create-nx-plugin',
        target: 'npm:fs-extra',
      },
      {
        type: 'static',
        source: 'create-nx-plugin',
        target: 'npm:tmp',
      },
      {
        type: 'static',
        source: 'create-nx-plugin',
        target: 'npm:yargs-parser',
      },
      {
        type: 'implicit',
        source: 'create-nx-plugin',
        target: 'nx-plugin',
      },
    ],
    'nx-dev-feature-doc-viewer': [
      {
        type: 'static',
        source: 'nx-dev-feature-doc-viewer',
        target: 'npm:@nrwl/jest',
      },
      {
        type: 'static',
        source: 'nx-dev-feature-doc-viewer',
        target: 'npm:react',
      },
      {
        type: 'static',
        source: 'nx-dev-feature-doc-viewer',
        target: 'npm:@testing-library/react',
      },
    ],
    'dep-graph-dep-graph-e2e': [
      {
        type: 'static',
        source: 'dep-graph-dep-graph-e2e',
        target: 'npm:@nrwl/cypress',
      },
      {
        type: 'implicit',
        source: 'dep-graph-dep-graph-e2e',
        target: 'dep-graph-dep-graph',
      },
    ],
    'dep-graph-dep-graph': [
      {
        type: 'static',
        source: 'dep-graph-dep-graph',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'dep-graph-dep-graph',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'dep-graph-dep-graph',
        target: 'npm:cytoscape',
      },
      {
        type: 'static',
        source: 'dep-graph-dep-graph',
        target: 'npm:cytoscape-anywhere-panning',
      },
      {
        type: 'static',
        source: 'dep-graph-dep-graph',
        target: 'npm:cytoscape-dagre',
      },
      {
        type: 'static',
        source: 'dep-graph-dep-graph',
        target: 'npm:cytoscape-popper',
      },
      {
        type: 'static',
        source: 'dep-graph-dep-graph',
        target: 'npm:tippy.js',
      },
      {
        type: 'static',
        source: 'dep-graph-dep-graph',
        target: 'devkit',
      },
      {
        type: 'static',
        source: 'dep-graph-dep-graph',
        target: 'npm:core-js',
      },
      {
        type: 'static',
        source: 'dep-graph-dep-graph',
        target: 'npm:regenerator-runtime',
      },
      {
        type: 'static',
        source: 'dep-graph-dep-graph',
        target: 'npm:document-register-element',
      },
    ],
    workspace: [
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:yargs',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:@nrwl/tao',
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
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:strip-json-comments',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:chalk',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:yargs-parser',
      },
      {
        type: 'implicit',
        source: 'workspace',
        target: 'devkit',
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
        target: 'npm:@angular-devkit/core',
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
        target: 'npm:tmp',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:dotenv',
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
        target: 'npm:@nrwl/jest',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:@nrwl/linter',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:@nestjs/common',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:react',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:@testing-library/react',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:express',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:@angular-devkit/schematics',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:semver',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:lodash.template',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:tslint',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:axios',
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
        type: 'dynamic',
        source: 'workspace',
        target: 'npm:webpack',
      },
      {
        type: 'dynamic',
        source: 'workspace',
        target: 'npm:webpack-dev-server',
      },
      {
        type: 'static',
        source: 'workspace',
        target: 'npm:@angular-devkit/architect',
      },
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
    ],
    storybook: [
      {
        type: 'static',
        source: 'storybook',
        target: 'devkit',
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
        target: 'npm:dotenv',
      },
      {
        type: 'static',
        source: 'storybook',
        target: 'npm:memfs',
      },
      {
        type: 'static',
        source: 'storybook',
        target: 'npm:semver',
      },
      {
        type: 'static',
        source: 'storybook',
        target: 'npm:@nrwl/linter',
      },
      {
        type: 'static',
        source: 'storybook',
        target: 'npm:@storybook/addon-knobs',
      },
      {
        type: 'static',
        source: 'storybook',
        target: 'npm:@nrwl/cypress',
      },
      {
        type: 'static',
        source: 'storybook',
        target: 'npm:@angular-devkit/schematics',
      },
      {
        type: 'dynamic',
        source: 'storybook',
        target: 'npm:@angular-devkit/core',
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
      {
        type: 'implicit',
        source: 'storybook',
        target: 'cypress',
      },
      {
        type: 'implicit',
        source: 'storybook',
        target: 'workspace',
      },
    ],
    'nx-plugin': [
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
        target: 'devkit',
      },
      {
        type: 'static',
        source: 'nx-plugin',
        target: 'npm:@nrwl/tao',
      },
      {
        type: 'static',
        source: 'nx-plugin',
        target: 'npm:fs-extra',
      },
      {
        type: 'implicit',
        source: 'nx-plugin',
        target: 'workspace',
      },
    ],
    'nx-dev-e2e': [
      {
        type: 'static',
        source: 'nx-dev-e2e',
        target: 'npm:@nrwl/cypress',
      },
      {
        type: 'implicit',
        source: 'nx-dev-e2e',
        target: 'nx-dev',
      },
    ],
    cypress: [
      {
        type: 'static',
        source: 'cypress',
        target: 'devkit',
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
        target: 'npm:@nrwl/linter',
      },
      {
        type: 'static',
        source: 'cypress',
        target: 'npm:eslint',
      },
      {
        type: 'static',
        source: 'cypress',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'cypress',
        target: 'npm:@nrwl/cypress',
      },
      {
        type: 'static',
        source: 'cypress',
        target: 'npm:@angular-devkit/schematics',
      },
      {
        type: 'static',
        source: 'cypress',
        target: 'npm:@angular-devkit/core',
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
        type: 'implicit',
        source: 'cypress',
        target: 'workspace',
      },
      {
        type: 'implicit',
        source: 'cypress',
        target: 'linter',
      },
    ],
    express: [
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
      {
        type: 'static',
        source: 'express',
        target: 'devkit',
      },
      {
        type: 'implicit',
        source: 'express',
        target: 'node',
      },
    ],
    angular: [
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
        type: 'dynamic',
        source: 'angular',
        target: 'npm:ng-packagr',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:typescript',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:injection-js',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:@angular/compiler-cli',
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
        target: 'npm:@angular-devkit/build-angular',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'devkit',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:@nrwl/linter',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:@nrwl/cypress',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'npm:eslint',
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
        target: 'npm:prettier',
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
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'angular',
        target: 'storybook',
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
    ],
    'nx-dev-ui-common': [
      {
        type: 'static',
        source: 'nx-dev-ui-common',
        target: 'npm:@nrwl/jest',
      },
      {
        type: 'static',
        source: 'nx-dev-ui-common',
        target: 'npm:react',
      },
      {
        type: 'static',
        source: 'nx-dev-ui-common',
        target: 'npm:@testing-library/react',
      },
      {
        type: 'static',
        source: 'nx-dev-ui-common',
        target: 'npm:next',
      },
    ],
    devkit: [
      {
        type: 'static',
        source: 'devkit',
        target: 'npm:@nrwl/tao',
      },
      {
        type: 'static',
        source: 'devkit',
        target: 'npm:prettier',
      },
      {
        type: 'static',
        source: 'devkit',
        target: 'npm:strip-json-comments',
      },
      {
        type: 'static',
        source: 'devkit',
        target: 'npm:file-type',
      },
      {
        type: 'static',
        source: 'devkit',
        target: 'npm:ejs',
      },
      {
        type: 'static',
        source: 'devkit',
        target: 'npm:typescript',
      },
      {
        type: 'static',
        source: 'devkit',
        target: 'npm:ignore',
      },
      {
        type: 'static',
        source: 'devkit',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'devkit',
        target: 'npm:@angular-devkit/architect',
      },
      {
        type: 'implicit',
        source: 'devkit',
        target: 'tao',
      },
    ],
    linter: [
      {
        type: 'static',
        source: 'linter',
        target: 'devkit',
      },
      {
        type: 'static',
        source: 'linter',
        target: 'npm:eslint',
      },
      {
        type: 'static',
        source: 'linter',
        target: 'npm:@angular-devkit/core',
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
      {
        type: 'static',
        source: 'linter',
        target: 'npm:@angular-devkit/schematics',
      },
      {
        type: 'static',
        source: 'linter',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'linter',
        target: 'npm:tslint-to-eslint-config',
      },
      {
        type: 'static',
        source: 'linter',
        target: 'npm:@nrwl/tao',
      },
      {
        type: 'static',
        source: 'linter',
        target: 'npm:tmp',
      },
      {
        type: 'implicit',
        source: 'linter',
        target: 'workspace',
      },
    ],
    gatsby: [
      {
        type: 'static',
        source: 'gatsby',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'gatsby',
        target: 'npm:@nrwl/tao',
      },
      {
        type: 'static',
        source: 'gatsby',
        target: 'devkit',
      },
      {
        type: 'static',
        source: 'gatsby',
        target: 'npm:react',
      },
      {
        type: 'static',
        source: 'gatsby',
        target: 'npm:@nrwl/cypress',
      },
      {
        type: 'static',
        source: 'gatsby',
        target: 'npm:@nrwl/linter',
      },
      {
        type: 'static',
        source: 'gatsby',
        target: 'npm:@nrwl/jest',
      },
      {
        type: 'static',
        source: 'gatsby',
        target: 'react',
      },
      {
        type: 'static',
        source: 'gatsby',
        target: 'npm:eslint',
      },
    ],
    react: [
      {
        type: 'static',
        source: 'react',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'react',
        target: 'npm:rollup',
      },
      {
        type: 'static',
        source: 'react',
        target: 'devkit',
      },
      {
        type: 'static',
        source: 'react',
        target: 'npm:react',
      },
      {
        type: 'static',
        source: 'react',
        target: 'npm:webpack',
      },
      {
        type: 'static',
        source: 'react',
        target: 'npm:strip-json-comments',
      },
      {
        type: 'static',
        source: 'react',
        target: 'npm:@nrwl/linter',
      },
      {
        type: 'static',
        source: 'react',
        target: 'npm:@nrwl/cypress',
      },
      {
        type: 'static',
        source: 'react',
        target: 'npm:@nrwl/jest',
      },
      {
        type: 'static',
        source: 'react',
        target: 'npm:typescript',
      },
      {
        type: 'static',
        source: 'react',
        target: 'npm:@storybook/addon-knobs',
      },
      {
        type: 'static',
        source: 'react',
        target: 'npm:@nrwl/web',
      },
      {
        type: 'static',
        source: 'react',
        target: 'storybook',
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
        target: 'npm:react-dom',
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
        target: 'npm:prettier',
      },
      {
        type: 'static',
        source: 'react',
        target: 'npm:eslint',
      },
      {
        type: 'implicit',
        source: 'react',
        target: 'workspace',
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
        type: 'implicit',
        source: 'react',
        target: 'web',
      },
    ],
    jest: [
      {
        type: 'static',
        source: 'jest',
        target: 'devkit',
      },
      {
        type: 'static',
        source: 'jest',
        target: 'npm:@nrwl/tao',
      },
      {
        type: 'static',
        source: 'jest',
        target: 'npm:jest',
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
        target: 'npm:jest-preset-angular',
      },
      {
        type: 'static',
        source: 'jest',
        target: 'npm:@angular-devkit/core',
      },
      {
        type: 'static',
        source: 'jest',
        target: 'npm:@nrwl/jest',
      },
      {
        type: 'static',
        source: 'jest',
        target: 'npm:typescript',
      },
      {
        type: 'static',
        source: 'jest',
        target: 'npm:strip-json-comments',
      },
      {
        type: 'implicit',
        source: 'jest',
        target: 'workspace',
      },
    ],
    node: [
      {
        type: 'static',
        source: 'node',
        target: 'devkit',
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
        target: 'npm:webpack',
      },
      {
        type: 'static',
        source: 'node',
        target: 'npm:rxjs-for-await',
      },
      {
        type: 'static',
        source: 'node',
        target: 'npm:dotenv',
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
        target: 'angular',
      },
      {
        type: 'static',
        source: 'node',
        target: 'npm:@nrwl/linter',
      },
      {
        type: 'static',
        source: 'node',
        target: 'npm:@nrwl/jest',
      },
      {
        type: 'static',
        source: 'node',
        target: 'npm:@angular-devkit/schematics',
      },
      {
        type: 'static',
        source: 'node',
        target: 'npm:license-webpack-plugin',
      },
      {
        type: 'static',
        source: 'node',
        target: 'npm:circular-dependency-plugin',
      },
      {
        type: 'static',
        source: 'node',
        target: 'npm:fork-ts-checker-webpack-plugin',
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
      {
        type: 'implicit',
        source: 'node',
        target: 'workspace',
      },
      {
        type: 'implicit',
        source: 'node',
        target: 'jest',
      },
      {
        type: 'implicit',
        source: 'node',
        target: 'linter',
      },
    ],
    next: [
      {
        type: 'static',
        source: 'next',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'next',
        target: 'devkit',
      },
      {
        type: 'static',
        source: 'next',
        target: 'npm:next',
      },
      {
        type: 'static',
        source: 'next',
        target: 'npm:fs-extra',
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
        target: 'npm:chalk',
      },
      {
        type: 'static',
        source: 'next',
        target: 'npm:@nrwl/linter',
      },
      {
        type: 'static',
        source: 'next',
        target: 'npm:@nrwl/cypress',
      },
      {
        type: 'static',
        source: 'next',
        target: 'npm:@nrwl/jest',
      },
      {
        type: 'implicit',
        source: 'next',
        target: 'react',
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
        target: 'npm:@nrwl/next',
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
        target: 'devkit',
      },
      {
        type: 'static',
        source: 'nest',
        target: 'npm:@nrwl/linter',
      },
      {
        type: 'static',
        source: 'nest',
        target: 'npm:@nrwl/node',
      },
      {
        type: 'static',
        source: 'nest',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'nest',
        target: 'npm:eslint',
      },
      {
        type: 'static',
        source: 'nest',
        target: 'npm:@angular-devkit/schematics',
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
      {
        type: 'implicit',
        source: 'nest',
        target: 'node',
      },
      {
        type: 'implicit',
        source: 'nest',
        target: 'linter',
      },
    ],
    'e2e-storybook': [
      {
        type: 'static',
        source: 'e2e-storybook',
        target: 'e2e-utils',
      },
      {
        type: 'static',
        source: 'e2e-storybook',
        target: 'npm:react',
      },
      {
        type: 'static',
        source: 'e2e-storybook',
        target: 'npm:@angular/core',
      },
      {
        type: 'implicit',
        source: 'e2e-storybook',
        target: 'storybook',
      },
    ],
    'e2e-workspace': [
      {
        type: 'static',
        source: 'e2e-workspace',
        target: 'e2e-utils',
      },
      {
        type: 'static',
        source: 'e2e-workspace',
        target: 'npm:fs-extra',
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
    'nx-dev': [
      {
        type: 'static',
        source: 'nx-dev',
        target: 'npm:@nrwl/jest',
      },
      {
        type: 'static',
        source: 'nx-dev',
        target: 'npm:@nrwl/next',
      },
      {
        type: 'static',
        source: 'nx-dev',
        target: 'npm:react',
      },
      {
        type: 'static',
        source: 'nx-dev',
        target: 'npm:next',
      },
      {
        type: 'static',
        source: 'nx-dev',
        target: 'nx-dev-ui-common',
      },
      {
        type: 'static',
        source: 'nx-dev',
        target: 'nx-dev-data-access-documents',
      },
      {
        type: 'static',
        source: 'nx-dev',
        target: 'nx-dev-feature-doc-viewer',
      },
      {
        type: 'static',
        source: 'nx-dev',
        target: 'npm:@testing-library/react',
      },
    ],
    tao: [
      {
        type: 'static',
        source: 'tao',
        target: 'npm:yargs-parser',
      },
      {
        type: 'static',
        source: 'tao',
        target: 'npm:fs-extra',
      },
      {
        type: 'static',
        source: 'tao',
        target: 'npm:minimist',
      },
      {
        type: 'static',
        source: 'tao',
        target: 'npm:chalk',
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
        target: 'npm:@angular-devkit/core',
      },
      {
        type: 'static',
        source: 'tao',
        target: 'npm:@nrwl/tao',
      },
      {
        type: 'static',
        source: 'tao',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'tao',
        target: 'npm:@angular-devkit/architect',
      },
      {
        type: 'dynamic',
        source: 'tao',
        target: 'npm:@angular-devkit/schematics',
      },
      {
        type: 'static',
        source: 'tao',
        target: 'npm:rxjs-for-await',
      },
      {
        type: 'static',
        source: 'tao',
        target: 'npm:@angular-devkit/build-angular',
      },
    ],
    web: [
      {
        type: 'static',
        source: 'web',
        target: 'devkit',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:webpack',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:rxjs-for-await',
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
        target: 'npm:webpack-dev-server',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:node-watch',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:ignore',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:fs-extra',
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
        target: 'npm:@rollup/plugin-babel',
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
        target: 'npm:@rollup/plugin-json',
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
        target: 'npm:autoprefixer',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:react',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:@nrwl/cypress',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:@nrwl/linter',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:@nrwl/jest',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:@nrwl/web',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:@angular-devkit/schematics',
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
        target: 'npm:circular-dependency-plugin',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:fork-ts-checker-webpack-plugin',
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
        target: 'npm:opn',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:webpack-subresource-integrity',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:webpack-sources',
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
        target: 'npm:memfs',
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
        target: 'npm:babel-loader',
      },
      {
        type: 'static',
        source: 'web',
        target: 'npm:webpack-merge',
      },
      {
        type: 'implicit',
        source: 'web',
        target: 'cypress',
      },
      {
        type: 'implicit',
        source: 'web',
        target: 'workspace',
      },
      {
        type: 'implicit',
        source: 'web',
        target: 'jest',
      },
    ],
    cli: [
      {
        type: 'static',
        source: 'cli',
        target: 'npm:chalk',
      },
      {
        type: 'static',
        source: 'cli',
        target: 'npm:@nrwl/tao',
      },
      {
        type: 'static',
        source: 'cli',
        target: 'npm:@nrwl/cli',
      },
      {
        type: 'static',
        source: 'cli',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'cli',
        target: 'npm:yargs-parser',
      },
      {
        type: 'implicit',
        source: 'cli',
        target: 'tao',
      },
    ],
    nx: [
      {
        type: 'static',
        source: 'nx',
        target: 'npm:@nrwl/cli',
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
        target: 'devkit',
      },
      {
        type: 'static',
        source: 'e2e-angular',
        target: 'npm:@angular/platform-browser',
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
      {
        type: 'static',
        source: 'e2e-angular',
        target: 'npm:react',
      },
      {
        type: 'static',
        source: 'e2e-angular',
        target: 'npm:@storybook/addon-knobs',
      },
      {
        type: 'implicit',
        source: 'e2e-angular',
        target: 'angular',
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
    'e2e-gatsby': [
      {
        type: 'static',
        source: 'e2e-gatsby',
        target: 'e2e-utils',
      },
      {
        type: 'implicit',
        source: 'e2e-gatsby',
        target: 'gatsby',
      },
    ],
    'e2e-utils': [
      {
        type: 'static',
        source: 'e2e-utils',
        target: 'npm:@nrwl/tao',
      },
      {
        type: 'static',
        source: 'e2e-utils',
        target: 'npm:fs-extra',
      },
      {
        type: 'static',
        source: 'e2e-utils',
        target: 'npm:is-ci',
      },
      {
        type: 'static',
        source: 'e2e-utils',
        target: 'npm:tmp',
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
        target: 'devkit',
      },
      {
        type: 'static',
        source: 'e2e-react',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'implicit',
        source: 'e2e-react',
        target: 'react',
      },
    ],
    'e2e-jest': [
      {
        type: 'static',
        source: 'e2e-jest',
        target: 'npm:@angular-devkit/core',
      },
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
    ],
    'e2e-next': [
      {
        type: 'static',
        source: 'e2e-next',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'e2e-next',
        target: 'e2e-utils',
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
      {
        type: 'implicit',
        source: 'e2e-next',
        target: 'next',
      },
    ],
    'e2e-node': [
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
        target: 'e2e-utils',
      },
      {
        type: 'static',
        source: 'e2e-node',
        target: 'npm:fs-extra',
      },
      {
        type: 'implicit',
        source: 'e2e-node',
        target: 'node',
      },
    ],
    'e2e-cli': [
      {
        type: 'static',
        source: 'e2e-cli',
        target: 'npm:@nrwl/workspace',
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
    ],
    'e2e-web': [
      {
        type: 'static',
        source: 'e2e-web',
        target: 'e2e-utils',
      },
      {
        type: 'static',
        source: 'e2e-web',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'implicit',
        source: 'e2e-web',
        target: 'web',
      },
    ],
    'npm:core-js': [],
    'npm:document-register-element': [],
    'npm:gray-matter': [],
    'npm:marked': [],
    'npm:react': [],
    'npm:react-dom': [],
    'npm:@angular-devkit/architect': [],
    'npm:@angular-devkit/build-angular': [],
    'npm:@angular-devkit/build-optimizer': [],
    'npm:@angular-devkit/build-webpack': [],
    'npm:@angular-devkit/core': [],
    'npm:@angular-devkit/schematics': [],
    'npm:@angular-eslint/eslint-plugin': [],
    'npm:@angular-eslint/eslint-plugin-template': [],
    'npm:@angular-eslint/template-parser': [],
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
    'npm:@cypress/webpack-preprocessor': [],
    'npm:@nestjs/common': [],
    'npm:@nestjs/core': [],
    'npm:@nestjs/platform-express': [],
    'npm:@nestjs/schematics': [],
    'npm:@nestjs/testing': [],
    'npm:@ngrx/component-store': [],
    'npm:@ngrx/effects': [],
    'npm:@ngrx/entity': [],
    'npm:@ngrx/router-store': [],
    'npm:@ngrx/schematics': [],
    'npm:@ngrx/store': [],
    'npm:@ngrx/store-devtools': [],
    'npm:@ngtools/webpack': [],
    'npm:@nrwl/cli': [],
    'npm:@nrwl/cypress': [],
    'npm:@nrwl/eslint-plugin-nx': [],
    'npm:@nrwl/jest': [],
    'npm:@nrwl/linter': [],
    'npm:@nrwl/next': [],
    'npm:@nrwl/node': [],
    'npm:@nrwl/nx-cloud': [],
    'npm:@nrwl/tao': [],
    'npm:@nrwl/web': [],
    'npm:@nrwl/workspace': [],
    'npm:@reduxjs/toolkit': [],
    'npm:@rollup/plugin-babel': [],
    'npm:@rollup/plugin-commonjs': [],
    'npm:@rollup/plugin-image': [],
    'npm:@rollup/plugin-json': [],
    'npm:@rollup/plugin-node-resolve': [],
    'npm:@schematics/angular': [],
    'npm:@storybook/addon-knobs': [],
    'npm:@storybook/angular': [],
    'npm:@storybook/core': [],
    'npm:@storybook/react': [],
    'npm:@svgr/webpack': [],
    'npm:@testing-library/react': [],
    'npm:@types/copy-webpack-plugin': [],
    'npm:@types/cytoscape': [],
    'npm:@types/eslint': [],
    'npm:@types/express': [],
    'npm:@types/fs-extra': [],
    'npm:@types/is-ci': [],
    'npm:@types/jasmine': [],
    'npm:@types/jasminewd2': [],
    'npm:@types/jest': [],
    'npm:@types/marked': [],
    'npm:@types/node': [],
    'npm:@types/prettier': [],
    'npm:@types/react': [],
    'npm:@types/react-dom': [],
    'npm:@types/react-router-dom': [],
    'npm:@types/webpack': [],
    'npm:@types/webpack-dev-server': [],
    'npm:@types/yargs': [],
    'npm:@typescript-eslint/eslint-plugin': [],
    'npm:@typescript-eslint/experimental-utils': [],
    'npm:@typescript-eslint/parser': [],
    'npm:ajv': [],
    'npm:angular': [],
    'npm:app-root-path': [],
    'npm:autoprefixer': [],
    'npm:axios': [],
    'npm:babel-jest': [],
    'npm:babel-loader': [],
    'npm:babel-plugin-const-enum': [],
    'npm:babel-plugin-emotion': [],
    'npm:babel-plugin-macros': [],
    'npm:babel-plugin-styled-components': [],
    'npm:babel-plugin-transform-async-to-promises': [],
    'npm:babel-plugin-transform-typescript-metadata': [],
    'npm:browserslist': [],
    'npm:cacache': [],
    'npm:caniuse-lite': [],
    'npm:chalk': [],
    'npm:circular-dependency-plugin': [],
    'npm:clean-css': [],
    'npm:codelyzer': [],
    'npm:commitizen': [],
    'npm:confusing-browser-globals': [],
    'npm:conventional-changelog-cli': [],
    'npm:copy-webpack-plugin': [],
    'npm:cosmiconfig': [],
    'npm:css-loader': [],
    'npm:cypress': [],
    'npm:cytoscape': [],
    'npm:cytoscape-anywhere-panning': [],
    'npm:cytoscape-dagre': [],
    'npm:cytoscape-popper': [],
    'npm:cz-conventional-changelog': [],
    'npm:cz-customizable': [],
    'npm:depcheck': [],
    'npm:dotenv': [],
    'npm:ejs': [],
    'npm:eslint': [],
    'npm:eslint-config-prettier': [],
    'npm:eslint-plugin-cypress': [],
    'npm:eslint-plugin-import': [],
    'npm:eslint-plugin-jsx-a11y': [],
    'npm:eslint-plugin-react': [],
    'npm:eslint-plugin-react-hooks': [],
    'npm:express': [],
    'npm:file-loader': [],
    'npm:file-type': [],
    'npm:find-cache-dir': [],
    'npm:flat': [],
    'npm:fork-ts-checker-webpack-plugin': [],
    'npm:fs-extra': [],
    'npm:glob': [],
    'npm:html-webpack-plugin': [],
    'npm:http-server': [],
    'npm:husky': [],
    'npm:identity-obj-proxy': [],
    'npm:ignore': [],
    'npm:import-fresh': [],
    'npm:injection-js': [],
    'npm:is-ci': [],
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
    'npm:lodash.template': [],
    'npm:memfs': [],
    'npm:mime': [],
    'npm:mini-css-extract-plugin': [],
    'npm:minimatch': [],
    'npm:minimist': [],
    'npm:next': [],
    'npm:ng-packagr': [],
    'npm:ngrx-store-freeze': [],
    'npm:node-watch': [],
    'npm:npm-run-all': [],
    'npm:open': [],
    'npm:opn': [],
    'npm:parse-markdown-links': [],
    'npm:parse5': [],
    'npm:postcss': [],
    'npm:postcss-import': [],
    'npm:postcss-loader': [],
    'npm:precise-commits': [],
    'npm:prettier': [],
    'npm:pretty-quick': [],
    'npm:protractor': [],
    'npm:raw-loader': [],
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
    'npm:rxjs-for-await': [],
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
    'npm:tsconfig-paths': [],
    'npm:tsconfig-paths-webpack-plugin': [],
    'npm:tsickle': [],
    'npm:tslib': [],
    'npm:tslint': [],
    'npm:tslint-to-eslint-config': [],
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
    'npm:yargs-parser': [],
    'npm:zone.js': [],
    'npm:levenary': [],
  },
};
