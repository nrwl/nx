import { ProjectGraphCache } from '@nrwl/workspace';

export const graph: ProjectGraphCache = {
  version: '2.0',
  rootFiles: [
    {
      file: 'package.json',
      hash: '80a577ad73cb648f424c0c62465c7bef028101a4',
      ext: '.json',
    },
    {
      file: 'angular.json',
      hash: 'aeb3af75c84829713c5dff30df094f0b157b9d32',
      ext: '.json',
    },
    {
      file: 'nx.json',
      hash: '8963b98d12255854665d1664ec2a86a70dac4cdd',
      ext: '.json',
    },
    {
      file: 'tsconfig.base.json',
      hash: '11253ac5c2b7bc7ccc8003036c9379134582575c',
      ext: '.json',
    },
  ],
  nodes: {
    'sub/app-e2e': {
      name: 'sub/app-e2e',
      type: 'e2e',
      data: {
        root: 'apps/sub/app-e2e',
        sourceRoot: 'apps/sub/app-e2e/src',
        projectType: 'application',
        targets: {
          e2e: {
            executor: '@nrwl/cypress:cypress',
            options: {
              cypressConfig: 'apps/sub/app-e2e/cypress.json',
              tsConfig: 'apps/sub/app-e2e/tsconfig.e2e.json',
              devServerTarget: 'sub-app:serve',
            },
            configurations: {
              production: {
                devServerTarget: 'sub-app:serve:production',
              },
            },
          },
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: ['apps/sub/app-e2e/**/*.{js,ts}'],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'apps/sub/app-e2e/.eslintrc.json',
            hash: '86fbf604e565ae1253e17b785f24580db6c7614a',
            ext: '.json',
          },
          {
            file: 'apps/sub/app-e2e/cypress.json',
            hash: '5b15b9dc6d50bd314f4847db1f3611088a673388',
            ext: '.json',
          },
          {
            file: 'apps/sub/app-e2e/src/fixtures/example.json',
            hash: '294cbed6ce9e0b948b787452e8676aee486cb3be',
            ext: '.json',
          },
          {
            file: 'apps/sub/app-e2e/src/integration/app.spec.ts',
            hash: '8a069d9e9685399a3cbc5c82a7665a2299949332',
            ext: '.ts',
          },
          {
            file: 'apps/sub/app-e2e/src/plugins/index.js',
            hash: '9067e75a258dadf5a02b2a91c64f5acee1af17fd',
            ext: '.js',
          },
          {
            file: 'apps/sub/app-e2e/src/support/app.po.ts',
            hash: '32934246969c2ecb827ac05677785933a707a54d',
            ext: '.ts',
          },
          {
            file: 'apps/sub/app-e2e/src/support/commands.ts',
            hash: '310f1fa0e043ffebbbcf575c5a4d17f13a6b14d6',
            ext: '.ts',
          },
          {
            file: 'apps/sub/app-e2e/src/support/index.ts',
            hash: '3d469a6b6cf31eb66117d73e278bcf74f398f1db',
            ext: '.ts',
          },
          {
            file: 'apps/sub/app-e2e/tsconfig.e2e.json',
            hash: 'd575035e1a69ff100d395b8c0f97c3ec29a3b710',
            ext: '.json',
          },
          {
            file: 'apps/sub/app-e2e/tsconfig.json',
            hash: 'fbc6e9be785850c37acaf296b1ff155af7a11274',
            ext: '.json',
          },
        ],
      },
    },
    'first-e2e': {
      name: 'first-e2e',
      type: 'e2e',
      data: {
        root: 'apps/first-e2e',
        sourceRoot: 'apps/first-e2e/src',
        projectType: 'application',
        targets: {
          e2e: {
            executor: '@nrwl/cypress:cypress',
            options: {
              cypressConfig: 'apps/first-e2e/cypress.json',
              tsConfig: 'apps/first-e2e/tsconfig.e2e.json',
              devServerTarget: 'first:serve',
            },
            configurations: {
              production: {
                devServerTarget: 'first:serve:production',
              },
            },
          },
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: ['apps/first-e2e/**/*.{js,ts}'],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'apps/first-e2e/.eslintrc.json',
            hash: '6067c8c7981a541dfabc02d5cbc4641e54aedc40',
            ext: '.json',
          },
          {
            file: 'apps/first-e2e/cypress.json',
            hash: 'a3d401e2c2dd3d0ce25325cecc36d18c178b51fa',
            ext: '.json',
          },
          {
            file: 'apps/first-e2e/src/fixtures/example.json',
            hash: '294cbed6ce9e0b948b787452e8676aee486cb3be',
            ext: '.json',
          },
          {
            file: 'apps/first-e2e/src/integration/app.spec.ts',
            hash: '3de466c12c09425cd7e2fc584a3c368471ada150',
            ext: '.ts',
          },
          {
            file: 'apps/first-e2e/src/plugins/index.js',
            hash: '9067e75a258dadf5a02b2a91c64f5acee1af17fd',
            ext: '.js',
          },
          {
            file: 'apps/first-e2e/src/support/app.po.ts',
            hash: '32934246969c2ecb827ac05677785933a707a54d',
            ext: '.ts',
          },
          {
            file: 'apps/first-e2e/src/support/commands.ts',
            hash: '310f1fa0e043ffebbbcf575c5a4d17f13a6b14d6',
            ext: '.ts',
          },
          {
            file: 'apps/first-e2e/src/support/index.ts',
            hash: '3d469a6b6cf31eb66117d73e278bcf74f398f1db',
            ext: '.ts',
          },
          {
            file: 'apps/first-e2e/tsconfig.e2e.json',
            hash: '9dc3660a79ee2f6daf097b4930427223896e3b25',
            ext: '.json',
          },
          {
            file: 'apps/first-e2e/tsconfig.json',
            hash: '08841a7f56c62d55340ad08451502304837254fd',
            ext: '.json',
          },
        ],
      },
    },
    'sub-app': {
      name: 'sub-app',
      type: 'app',
      data: {
        projectType: 'application',
        root: 'apps/sub/app',
        sourceRoot: 'apps/sub/app/src',
        prefix: 'sub-app',
        targets: {
          build: {
            executor: '@angular-devkit/build-angular:browser',
            options: {
              outputPath: 'dist/apps/sub/app',
              index: 'apps/sub/app/src/index.html',
              main: 'apps/sub/app/src/main.ts',
              polyfills: 'apps/sub/app/src/polyfills.ts',
              tsConfig: 'apps/sub/app/tsconfig.app.json',
              aot: true,
              assets: [
                'apps/sub/app/src/favicon.ico',
                'apps/sub/app/src/assets',
              ],
              styles: ['apps/sub/app/src/styles.css'],
              scripts: [],
            },
            configurations: {
              production: {
                fileReplacements: [
                  {
                    replace: 'apps/sub/app/src/environments/environment.ts',
                    with: 'apps/sub/app/src/environments/environment.prod.ts',
                  },
                ],
                optimization: true,
                outputHashing: 'all',
                sourceMap: false,
                namedChunks: false,
                extractLicenses: true,
                vendorChunk: false,
                buildOptimizer: true,
                budgets: [
                  {
                    type: 'initial',
                    maximumWarning: '2mb',
                    maximumError: '5mb',
                  },
                  {
                    type: 'anyComponentStyle',
                    maximumWarning: '6kb',
                    maximumError: '10kb',
                  },
                ],
              },
            },
          },
          serve: {
            executor: '@angular-devkit/build-angular:dev-server',
            options: {
              browserTarget: 'sub-app:build',
            },
            configurations: {
              production: {
                browserTarget: 'sub-app:build:production',
              },
            },
          },
          'extract-i18n': {
            executor: '@angular-devkit/build-angular:extract-i18n',
            options: {
              browserTarget: 'sub-app:build',
            },
          },
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'apps/sub/app/src/**/*.ts',
                'apps/sub/app/src/**/*.html',
              ],
            },
          },
          test: {
            executor: '@nrwl/jest:jest',
            outputs: ['coverage/apps/sub/app'],
            options: {
              jestConfig: 'apps/sub/app/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'apps/sub/app/.browserslistrc',
            hash: '427441dc9308514d0e294ed878a168972f3a4c46',
            ext: '',
          },
          {
            file: 'apps/sub/app/.eslintrc.json',
            hash: '3b944baf819b15d81e023e30bcbe044af969fd8a',
            ext: '.json',
          },
          {
            file: 'apps/sub/app/jest.config.js',
            hash: '329b64de06f14403453ca97def8bb4d7ed2f516b',
            ext: '.js',
          },
          {
            file: 'apps/sub/app/src/app/app.component.css',
            hash: 'f222adffa5fcd7d15966292374486ef9e173c90c',
            ext: '.css',
          },
          {
            file: 'apps/sub/app/src/app/app.component.html',
            hash: 'f605f64a30f91b2310057d7de61ea77d83e42456',
            ext: '.html',
          },
          {
            file: 'apps/sub/app/src/app/app.component.spec.ts',
            hash: '01e5921283142ad7bdb689143850ed890afce576',
            ext: '.ts',
          },
          {
            file: 'apps/sub/app/src/app/app.component.ts',
            hash: 'bd5b8691e0fe7b18cf79fb3d60bb25d573e14dc4',
            ext: '.ts',
          },
          {
            file: 'apps/sub/app/src/app/app.module.ts',
            hash: '7bcb9e9a51ee440b22d29c6ddec55c5a8484b532',
            ext: '.ts',
          },
          {
            file: 'apps/sub/app/src/assets/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file: 'apps/sub/app/src/environments/environment.prod.ts',
            hash: 'c9669790be176ac85a5d8c11278875c2f52dc507',
            ext: '.ts',
          },
          {
            file: 'apps/sub/app/src/environments/environment.ts',
            hash: '99c3763cad6f4ae7808a34e2aa4e5b90232c67fc',
            ext: '.ts',
          },
          {
            file: 'apps/sub/app/src/favicon.ico',
            hash: '317ebcb2336e0833a22dddf0ab287849f26fda57',
            ext: '.ico',
          },
          {
            file: 'apps/sub/app/src/index.html',
            hash: '179d4f39ddb1b96a84fab6e98553f8ab107a316c',
            ext: '.html',
          },
          {
            file: 'apps/sub/app/src/main.ts',
            hash: 'd9a2e7e4a582e265db779363bd8b2492c43c141b',
            ext: '.ts',
          },
          {
            file: 'apps/sub/app/src/polyfills.ts',
            hash: '5812bad0d42e7e867a2d591ecb0c45090bd16706',
            ext: '.ts',
          },
          {
            file: 'apps/sub/app/src/styles.css',
            hash: '90d4ee0072ce3fc41812f8af910219f9eea3c3de',
            ext: '.css',
          },
          {
            file: 'apps/sub/app/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'apps/sub/app/tsconfig.app.json',
            hash: 'dcf14a842eda0cff82ed8c17f9c9193a3286e802',
            ext: '.json',
          },
          {
            file: 'apps/sub/app/tsconfig.editor.json',
            hash: '20c4afdbf437457984afcb236d4b5e588aec858a',
            ext: '.json',
          },
          {
            file: 'apps/sub/app/tsconfig.json',
            hash: '950bb9ee01330117c1844e2d3c903e9b3d6576c6',
            ext: '.json',
          },
          {
            file: 'apps/sub/app/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
        ],
      },
    },
    first: {
      name: 'first',
      type: 'app',
      data: {
        projectType: 'application',
        root: 'apps/first',
        sourceRoot: 'apps/first/src',
        prefix: 'sub-app',
        targets: {
          build: {
            executor: '@angular-devkit/build-angular:browser',
            options: {
              outputPath: 'dist/apps/first',
              index: 'apps/first/src/index.html',
              main: 'apps/first/src/main.ts',
              polyfills: 'apps/first/src/polyfills.ts',
              tsConfig: 'apps/first/tsconfig.app.json',
              aot: true,
              assets: ['apps/first/src/favicon.ico', 'apps/first/src/assets'],
              styles: ['apps/first/src/styles.css'],
              scripts: [],
            },
            configurations: {
              production: {
                fileReplacements: [
                  {
                    replace: 'apps/first/src/environments/environment.ts',
                    with: 'apps/first/src/environments/environment.prod.ts',
                  },
                ],
                optimization: true,
                outputHashing: 'all',
                sourceMap: false,
                namedChunks: false,
                extractLicenses: true,
                vendorChunk: false,
                buildOptimizer: true,
                budgets: [
                  {
                    type: 'initial',
                    maximumWarning: '2mb',
                    maximumError: '5mb',
                  },
                  {
                    type: 'anyComponentStyle',
                    maximumWarning: '6kb',
                    maximumError: '10kb',
                  },
                ],
              },
            },
          },
          serve: {
            executor: '@angular-devkit/build-angular:dev-server',
            options: {
              browserTarget: 'first:build',
            },
            configurations: {
              production: {
                browserTarget: 'first:build:production',
              },
            },
          },
          'extract-i18n': {
            executor: '@angular-devkit/build-angular:extract-i18n',
            options: {
              browserTarget: 'first:build',
            },
          },
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'apps/first/src/**/*.ts',
                'apps/first/src/**/*.html',
              ],
            },
          },
          test: {
            executor: '@nrwl/jest:jest',
            outputs: ['coverage/apps/first'],
            options: {
              jestConfig: 'apps/first/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'apps/first/.browserslistrc',
            hash: '427441dc9308514d0e294ed878a168972f3a4c46',
            ext: '',
          },
          {
            file: 'apps/first/.eslintrc.json',
            hash: '00a6d38c381db98befa6f4672dac5e232336c25c',
            ext: '.json',
          },
          {
            file: 'apps/first/jest.config.js',
            hash: '2967eba26e2248cf07762d9a2dabeb02d27ccd3c',
            ext: '.js',
          },
          {
            file: 'apps/first/src/app/app.component.css',
            hash: 'f222adffa5fcd7d15966292374486ef9e173c90c',
            ext: '.css',
          },
          {
            file: 'apps/first/src/app/app.component.html',
            hash: 'f605f64a30f91b2310057d7de61ea77d83e42456',
            ext: '.html',
          },
          {
            file: 'apps/first/src/app/app.component.spec.ts',
            hash: 'bfa661649d4ab7507f7cded473951065174f55d0',
            ext: '.ts',
          },
          {
            file: 'apps/first/src/app/app.component.ts',
            hash: '0a0b1a11634108cb0d2cfee7aac77560ea44aa18',
            ext: '.ts',
          },
          {
            file: 'apps/first/src/app/app.module.ts',
            hash: '7bcb9e9a51ee440b22d29c6ddec55c5a8484b532',
            ext: '.ts',
          },
          {
            file: 'apps/first/src/assets/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file: 'apps/first/src/environments/environment.prod.ts',
            hash: 'c9669790be176ac85a5d8c11278875c2f52dc507',
            ext: '.ts',
          },
          {
            file: 'apps/first/src/environments/environment.ts',
            hash: '99c3763cad6f4ae7808a34e2aa4e5b90232c67fc',
            ext: '.ts',
          },
          {
            file: 'apps/first/src/favicon.ico',
            hash: '317ebcb2336e0833a22dddf0ab287849f26fda57',
            ext: '.ico',
          },
          {
            file: 'apps/first/src/index.html',
            hash: 'f49c6d2e168b8b8d9ec91540b5c922d3e487c944',
            ext: '.html',
          },
          {
            file: 'apps/first/src/main.ts',
            hash: 'd9a2e7e4a582e265db779363bd8b2492c43c141b',
            ext: '.ts',
          },
          {
            file: 'apps/first/src/polyfills.ts',
            hash: '5812bad0d42e7e867a2d591ecb0c45090bd16706',
            ext: '.ts',
          },
          {
            file: 'apps/first/src/styles.css',
            hash: '90d4ee0072ce3fc41812f8af910219f9eea3c3de',
            ext: '.css',
          },
          {
            file: 'apps/first/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'apps/first/tsconfig.app.json',
            hash: 'e9fa6dfd9387e0a5b362098d5d6542e952fdd831',
            ext: '.json',
          },
          {
            file: 'apps/first/tsconfig.editor.json',
            hash: '20c4afdbf437457984afcb236d4b5e588aec858a',
            ext: '.json',
          },
          {
            file: 'apps/first/tsconfig.json',
            hash: '81cb95e9dc65c8cd62be191b296859d8ae38fd8a',
            ext: '.json',
          },
          {
            file: 'apps/first/tsconfig.spec.json',
            hash: 'cfff29a544fb49a8c26a7cbf9cd836c87efb7fe8',
            ext: '.json',
          },
        ],
      },
    },
    'npm:@angular/animations': {
      type: 'npm',
      name: 'npm:@angular/animations',
      data: {
        version: '^11.2.0',
        packageName: '@angular/animations',
        files: [],
      },
    },
    'npm:@angular/common': {
      type: 'npm',
      name: 'npm:@angular/common',
      data: {
        version: '^11.2.0',
        packageName: '@angular/common',
        files: [],
      },
    },
    'npm:@angular/compiler': {
      type: 'npm',
      name: 'npm:@angular/compiler',
      data: {
        version: '^11.2.0',
        packageName: '@angular/compiler',
        files: [],
      },
    },
    'npm:@angular/core': {
      type: 'npm',
      name: 'npm:@angular/core',
      data: {
        version: '^11.2.0',
        packageName: '@angular/core',
        files: [],
      },
    },
    'npm:@angular/forms': {
      type: 'npm',
      name: 'npm:@angular/forms',
      data: {
        version: '^11.2.0',
        packageName: '@angular/forms',
        files: [],
      },
    },
    'npm:@angular/platform-browser': {
      type: 'npm',
      name: 'npm:@angular/platform-browser',
      data: {
        version: '^11.2.0',
        packageName: '@angular/platform-browser',
        files: [],
      },
    },
    'npm:@angular/platform-browser-dynamic': {
      type: 'npm',
      name: 'npm:@angular/platform-browser-dynamic',
      data: {
        version: '^11.2.0',
        packageName: '@angular/platform-browser-dynamic',
        files: [],
      },
    },
    'npm:@angular/router': {
      type: 'npm',
      name: 'npm:@angular/router',
      data: {
        version: '^11.2.0',
        packageName: '@angular/router',
        files: [],
      },
    },
    'npm:@nrwl/angular': {
      type: 'npm',
      name: 'npm:@nrwl/angular',
      data: {
        version: '11.5.1',
        packageName: '@nrwl/angular',
        files: [],
      },
    },
    'npm:rxjs': {
      type: 'npm',
      name: 'npm:rxjs',
      data: {
        version: '~6.6.3',
        packageName: 'rxjs',
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
    'npm:zone.js': {
      type: 'npm',
      name: 'npm:zone.js',
      data: {
        version: '^0.10.2',
        packageName: 'zone.js',
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
    'npm:@angular-eslint/eslint-plugin': {
      type: 'npm',
      name: 'npm:@angular-eslint/eslint-plugin',
      data: {
        version: '~1.0.0',
        packageName: '@angular-eslint/eslint-plugin',
        files: [],
      },
    },
    'npm:@angular-eslint/eslint-plugin-template': {
      type: 'npm',
      name: 'npm:@angular-eslint/eslint-plugin-template',
      data: {
        version: '~1.0.0',
        packageName: '@angular-eslint/eslint-plugin-template',
        files: [],
      },
    },
    'npm:@angular-eslint/template-parser': {
      type: 'npm',
      name: 'npm:@angular-eslint/template-parser',
      data: {
        version: '~1.0.0',
        packageName: '@angular-eslint/template-parser',
        files: [],
      },
    },
    'npm:@angular/cli': {
      type: 'npm',
      name: 'npm:@angular/cli',
      data: {
        version: '~11.0.0',
        packageName: '@angular/cli',
        files: [],
      },
    },
    'npm:@angular/compiler-cli': {
      type: 'npm',
      name: 'npm:@angular/compiler-cli',
      data: {
        version: '^11.2.0',
        packageName: '@angular/compiler-cli',
        files: [],
      },
    },
    'npm:@angular/language-service': {
      type: 'npm',
      name: 'npm:@angular/language-service',
      data: {
        version: '^11.2.0',
        packageName: '@angular/language-service',
        files: [],
      },
    },
    'npm:@nrwl/cli': {
      type: 'npm',
      name: 'npm:@nrwl/cli',
      data: {
        version: '11.5.1',
        packageName: '@nrwl/cli',
        files: [],
      },
    },
    'npm:@nrwl/cypress': {
      type: 'npm',
      name: 'npm:@nrwl/cypress',
      data: {
        version: '11.5.1',
        packageName: '@nrwl/cypress',
        files: [],
      },
    },
    'npm:@nrwl/eslint-plugin-nx': {
      type: 'npm',
      name: 'npm:@nrwl/eslint-plugin-nx',
      data: {
        version: '11.5.1',
        packageName: '@nrwl/eslint-plugin-nx',
        files: [],
      },
    },
    'npm:@nrwl/jest': {
      type: 'npm',
      name: 'npm:@nrwl/jest',
      data: {
        version: '11.5.1',
        packageName: '@nrwl/jest',
        files: [],
      },
    },
    'npm:@nrwl/linter': {
      type: 'npm',
      name: 'npm:@nrwl/linter',
      data: {
        version: '11.5.1',
        packageName: '@nrwl/linter',
        files: [],
      },
    },
    'npm:@nrwl/tao': {
      type: 'npm',
      name: 'npm:@nrwl/tao',
      data: {
        version: '11.5.1',
        packageName: '@nrwl/tao',
        files: [],
      },
    },
    'npm:@nrwl/workspace': {
      type: 'npm',
      name: 'npm:@nrwl/workspace',
      data: {
        version: '11.5.1',
        packageName: '@nrwl/workspace',
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
        version: '12.12.38',
        packageName: '@types/node',
        files: [],
      },
    },
    'npm:@typescript-eslint/eslint-plugin': {
      type: 'npm',
      name: 'npm:@typescript-eslint/eslint-plugin',
      data: {
        version: '4.3.0',
        packageName: '@typescript-eslint/eslint-plugin',
        files: [],
      },
    },
    'npm:@typescript-eslint/parser': {
      type: 'npm',
      name: 'npm:@typescript-eslint/parser',
      data: {
        version: '4.3.0',
        packageName: '@typescript-eslint/parser',
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
    'npm:dotenv': {
      type: 'npm',
      name: 'npm:dotenv',
      data: {
        version: '6.2.0',
        packageName: 'dotenv',
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
        version: '8.3.2',
        packageName: 'jest-preset-angular',
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
    'npm:ts-jest': {
      type: 'npm',
      name: 'npm:ts-jest',
      data: {
        version: '26.4.0',
        packageName: 'ts-jest',
        files: [],
      },
    },
    'npm:ts-node': {
      type: 'npm',
      name: 'npm:ts-node',
      data: {
        version: '~9.1.1',
        packageName: 'ts-node',
        files: [],
      },
    },
    'npm:typescript': {
      type: 'npm',
      name: 'npm:typescript',
      data: {
        version: '~4.0.3',
        packageName: 'typescript',
        files: [],
      },
    },
  },
  dependencies: {
    'sub/app-e2e': [
      {
        type: 'static',
        source: 'sub/app-e2e',
        target: 'npm:@nrwl/cypress',
      },
      {
        type: 'implicit',
        source: 'sub/app-e2e',
        target: 'sub-app',
      },
    ],
    'first-e2e': [
      {
        type: 'static',
        source: 'first-e2e',
        target: 'npm:@nrwl/cypress',
      },
      {
        type: 'implicit',
        source: 'first-e2e',
        target: 'first',
      },
    ],
    'sub-app': [
      {
        type: 'static',
        source: 'sub-app',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'sub-app',
        target: 'npm:@angular/platform-browser',
      },
      {
        type: 'static',
        source: 'sub-app',
        target: 'npm:@angular/platform-browser-dynamic',
      },
      {
        type: 'static',
        source: 'sub-app',
        target: 'npm:zone.js',
      },
      {
        type: 'static',
        source: 'sub-app',
        target: 'npm:jest-preset-angular',
      },
    ],
    first: [
      {
        type: 'static',
        source: 'first',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'first',
        target: 'npm:@angular/platform-browser',
      },
      {
        type: 'static',
        source: 'first',
        target: 'npm:@angular/platform-browser-dynamic',
      },
      {
        type: 'static',
        source: 'first',
        target: 'npm:zone.js',
      },
      {
        type: 'static',
        source: 'first',
        target: 'npm:jest-preset-angular',
      },
    ],
    'npm:@angular/animations': [],
    'npm:@angular/common': [],
    'npm:@angular/compiler': [],
    'npm:@angular/core': [],
    'npm:@angular/forms': [],
    'npm:@angular/platform-browser': [],
    'npm:@angular/platform-browser-dynamic': [],
    'npm:@angular/router': [],
    'npm:@nrwl/angular': [],
    'npm:rxjs': [],
    'npm:tslib': [],
    'npm:zone.js': [],
    'npm:@angular-devkit/build-angular': [],
    'npm:@angular-eslint/eslint-plugin': [],
    'npm:@angular-eslint/eslint-plugin-template': [],
    'npm:@angular-eslint/template-parser': [],
    'npm:@angular/cli': [],
    'npm:@angular/compiler-cli': [],
    'npm:@angular/language-service': [],
    'npm:@nrwl/cli': [],
    'npm:@nrwl/cypress': [],
    'npm:@nrwl/eslint-plugin-nx': [],
    'npm:@nrwl/jest': [],
    'npm:@nrwl/linter': [],
    'npm:@nrwl/tao': [],
    'npm:@nrwl/workspace': [],
    'npm:@types/jest': [],
    'npm:@types/node': [],
    'npm:@typescript-eslint/eslint-plugin': [],
    'npm:@typescript-eslint/parser': [],
    'npm:cypress': [],
    'npm:dotenv': [],
    'npm:eslint': [],
    'npm:eslint-config-prettier': [],
    'npm:eslint-plugin-cypress': [],
    'npm:jest': [],
    'npm:jest-preset-angular': [],
    'npm:prettier': [],
    'npm:ts-jest': [],
    'npm:ts-node': [],
    'npm:typescript': [],
  },
};
