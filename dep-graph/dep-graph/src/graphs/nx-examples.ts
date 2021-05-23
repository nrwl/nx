import { ProjectGraphCache } from '@nrwl/workspace';

export const nxExamplesWorkspaceLayout = {
  libsDir: 'libs',
  appsDir: 'apps',
};

export const nxExamplesGraph: ProjectGraphCache = {
  version: '2.0',
  rootFiles: [
    {
      file: 'package.json',
      hash: '47e41f75e7d3fc7623035ea5d9afa9e7940df041',
      ext: '.json',
    },
    {
      file: 'workspace.json',
      hash: 'eaa0fa233e465898060879f4dbc61457b8d20b6a',
      ext: '.json',
    },
    {
      file: 'nx.json',
      hash: 'b9e8d004caf12c070c9f888709b290537a53d76c',
      ext: '.json',
    },
    {
      file: 'tsconfig.base.json',
      hash: '73eaab8698f683aa5d1e6b292cd8a545950099df',
      ext: '.json',
    },
  ],
  nodes: {
    'products-product-detail-page': {
      name: 'products-product-detail-page',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/products/product-detail-page',
        sourceRoot: 'libs/products/product-detail-page/src',
        prefix: 'nx-example',
        targets: {
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'libs/products/product-detail-page/src/**/*.ts',
                'libs/products/product-detail-page/src/**/*.html',
              ],
            },
          },
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/products/product-detail-page/jest.config.js',
              passWithNoTests: true,
            },
            outputs: ['coverage/libs/products/product-detail-page'],
          },
        },
        generators: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['type:feature', 'scope:products'],
        files: [
          {
            file: 'libs/products/product-detail-page/.eslintrc.json',
            hash: '27519506e3b1095fc3d2395d0bc6163409573e27',
            ext: '.json',
          },
          {
            file: 'libs/products/product-detail-page/jest.config.js',
            hash: 'b697d946bce6bb6fa2aceec08f130a1c9b418c43',
            ext: '.js',
          },
          {
            file: 'libs/products/product-detail-page/README.md',
            hash: 'f466b2f632d80578a70301ffb7dc7b99c1e5c918',
            ext: '.md',
          },
          {
            file: 'libs/products/product-detail-page/src/index.ts',
            hash: '1f5976f2ae3b5938d9bd48e9b213a7bc4bce479c',
            ext: '.ts',
          },
          {
            file:
              'libs/products/product-detail-page/src/lib/product-detail-page/product-detail-page.component.html',
            hash: 'fd5fa276dc13f789ae5d7a37703a296753aec8be',
            ext: '.html',
          },
          {
            file:
              'libs/products/product-detail-page/src/lib/product-detail-page/product-detail-page.component.scss',
            hash: '98fbca8900da6d5c5f6373558f5bd69efe190780',
            ext: '.scss',
          },
          {
            file:
              'libs/products/product-detail-page/src/lib/product-detail-page/product-detail-page.component.spec.ts',
            hash: 'e8390b7218d2dca9eb4be8d2b1cc08e1b1c0de1b',
            ext: '.ts',
          },
          {
            file:
              'libs/products/product-detail-page/src/lib/product-detail-page/product-detail-page.component.ts',
            hash: 'c20bd27b12494827624a3835b1ec6475efaf0913',
            ext: '.ts',
          },
          {
            file:
              'libs/products/product-detail-page/src/lib/products-product-detail-page.module.spec.ts',
            hash: '01541f218a3a1b95b056fd9d2d1b578e5a2e3d9a',
            ext: '.ts',
          },
          {
            file:
              'libs/products/product-detail-page/src/lib/products-product-detail-page.module.ts',
            hash: '5c06b527e7ffe870f1960a74a845106beca79b6b',
            ext: '.ts',
          },
          {
            file: 'libs/products/product-detail-page/src/test-setup.ts',
            hash: '234024b3a303a4a59c0c3b204f549f0ebf0ce386',
            ext: '.ts',
          },
          {
            file: 'libs/products/product-detail-page/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/products/product-detail-page/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/products/product-detail-page/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
        ],
      },
    },
    'shared-product-types': {
      name: 'shared-product-types',
      type: 'lib',
      data: {
        root: 'libs/shared/product/types',
        sourceRoot: 'libs/shared/product/types/src',
        projectType: 'library',
        generators: {},
        targets: {
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'libs/shared/product/types/src/**/*.ts',
                'libs/shared/product/types/src/**/*.html',
              ],
            },
          },
        },
        tags: ['type:types', 'scope:shared'],
        files: [
          {
            file: 'libs/shared/product/types/.babelrc',
            hash: '0cae4a9a81270d6cf3315436f594bf2fbd4fb3e2',
            ext: '',
          },
          {
            file: 'libs/shared/product/types/.eslintrc.json',
            hash: 'deb72aabdf74e23f16519b8cbeb5d63e769cd470',
            ext: '.json',
          },
          {
            file: 'libs/shared/product/types/README.md',
            hash: 'a3308045207635951262c7c81e93c4afafb484c4',
            ext: '.md',
          },
          {
            file: 'libs/shared/product/types/src/index.ts',
            hash: '6b3cdd251890a858bace2be04ff2ef2920d68b76',
            ext: '.ts',
          },
          {
            file: 'libs/shared/product/types/src/lib/shared-product-types.ts',
            hash: '4f99c082564a63944be3e035c4ef47cc060b3af9',
            ext: '.ts',
          },
          {
            file: 'libs/shared/product/types/tsconfig.json',
            hash: 'e7879c9efcfa2e1c35b5373b03b4b7ea276795ac',
            ext: '.json',
          },
          {
            file: 'libs/shared/product/types/tsconfig.lib.json',
            hash: 'a174cb09c30e46285517c7308247d602414aa63f',
            ext: '.json',
          },
        ],
      },
    },
    'shared-product-state': {
      name: 'shared-product-state',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/shared/product/state',
        sourceRoot: 'libs/shared/product/state/src',
        prefix: 'nx-example',
        targets: {
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'libs/shared/product/state/src/**/*.ts',
                'libs/shared/product/state/src/**/*.html',
              ],
            },
          },
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/shared/product/state/jest.config.js',
              passWithNoTests: true,
            },
            outputs: ['coverage/libs/shared/product/state'],
          },
        },
        generators: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['scope:shared', 'type:state'],
        files: [
          {
            file: 'libs/shared/product/state/.babelrc',
            hash: '0cae4a9a81270d6cf3315436f594bf2fbd4fb3e2',
            ext: '',
          },
          {
            file: 'libs/shared/product/state/.eslintrc.json',
            hash: 'eee5f453593a2b8e7f865305029b7edc3449cca6',
            ext: '.json',
          },
          {
            file: 'libs/shared/product/state/jest.config.js',
            hash: '823fc1089440641fa020bc064ac210b016a8e892',
            ext: '.js',
          },
          {
            file: 'libs/shared/product/state/README.md',
            hash: '63538ffc745d3f82d93bcfbd61608057bf9cafaf',
            ext: '.md',
          },
          {
            file: 'libs/shared/product/state/src/index.ts',
            hash: '7db504866b5fefc09665345c902721552fe20e6c',
            ext: '.ts',
          },
          {
            file:
              'libs/shared/product/state/src/lib/+state/products.actions.ts',
            hash: '4c0efeeec1adfcecd34b20bda87fce5f24a64675',
            ext: '.ts',
          },
          {
            file:
              'libs/shared/product/state/src/lib/+state/products.reducer.spec.ts',
            hash: 'b2821f72394868ca503eb637f2891564851583eb',
            ext: '.ts',
          },
          {
            file:
              'libs/shared/product/state/src/lib/+state/products.reducer.ts',
            hash: '9168586d19b76b0dd462dafbb5b6998c4da5ba53',
            ext: '.ts',
          },
          {
            file:
              'libs/shared/product/state/src/lib/+state/products.selectors.spec.ts',
            hash: '25cd673e1ff8b591f92f734944cd20adf965b612',
            ext: '.ts',
          },
          {
            file:
              'libs/shared/product/state/src/lib/+state/products.selectors.ts',
            hash: '74fd5c163037dd51d33316cb2ce1c816728edea1',
            ext: '.ts',
          },
          {
            file:
              'libs/shared/product/state/src/lib/shared-product-state.module.spec.ts',
            hash: '713543b7a36b2027985904f9a74124f79406108c',
            ext: '.ts',
          },
          {
            file:
              'libs/shared/product/state/src/lib/shared-product-state.module.ts',
            hash: '144207d2b4609204b8ceab1ae81d1079d61b3949',
            ext: '.ts',
          },
          {
            file: 'libs/shared/product/state/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/shared/product/state/tsconfig.json',
            hash: 'd32f55e3999447ae24e89f0e76d8c3128113c85e',
            ext: '.json',
          },
          {
            file: 'libs/shared/product/state/tsconfig.lib.json',
            hash: 'ad83824e5f62f1e5ff2acd0960bde6bab3f87d66',
            ext: '.json',
          },
          {
            file: 'libs/shared/product/state/tsconfig.spec.json',
            hash: 'aed68bc6bf86609a7a4f0fdf5a562265cd90e452',
            ext: '.json',
          },
        ],
      },
    },
    'shared-product-data': {
      name: 'shared-product-data',
      type: 'lib',
      data: {
        root: 'libs/shared/product/data',
        sourceRoot: 'libs/shared/product/data/src',
        projectType: 'library',
        generators: {},
        targets: {
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'libs/shared/product/data/src/**/*.ts',
                'libs/shared/product/data/src/**/*.html',
              ],
            },
          },
        },
        tags: ['type:data', 'scope:shared'],
        files: [
          {
            file: 'libs/shared/product/data/.babelrc',
            hash: '0cae4a9a81270d6cf3315436f594bf2fbd4fb3e2',
            ext: '',
          },
          {
            file: 'libs/shared/product/data/.eslintrc.json',
            hash: '0576ff84e48f121399441a189bc1cd2a35fbca47',
            ext: '.json',
          },
          {
            file: 'libs/shared/product/data/README.md',
            hash: 'a433a7f8582e93329c762709f617d5d146b763f1',
            ext: '.md',
          },
          {
            file: 'libs/shared/product/data/src/index.ts',
            hash: '0818cd09cdd02861b3319fd08cfcd2abf29539b4',
            ext: '.ts',
          },
          {
            file: 'libs/shared/product/data/src/lib/product-data.mock.ts',
            hash: 'dcd7b7730bcd977d83eec2b8c8a27980ed605d58',
            ext: '.ts',
          },
          {
            file: 'libs/shared/product/data/src/lib/shared-product-data.ts',
            hash: 'eea248a1d99f1b5385f489a9ff7cbe8d947dd5aa',
            ext: '.ts',
          },
          {
            file: 'libs/shared/product/data/src/testing.ts',
            hash: 'd80ae5191bdb9c730883065e07d95876d1a701c9',
            ext: '.ts',
          },
          {
            file: 'libs/shared/product/data/tsconfig.json',
            hash: 'e7879c9efcfa2e1c35b5373b03b4b7ea276795ac',
            ext: '.json',
          },
          {
            file: 'libs/shared/product/data/tsconfig.lib.json',
            hash: 'a174cb09c30e46285517c7308247d602414aa63f',
            ext: '.json',
          },
        ],
      },
    },
    'products-home-page': {
      name: 'products-home-page',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/products/home-page',
        sourceRoot: 'libs/products/home-page/src',
        prefix: 'nx-example',
        targets: {
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'libs/products/home-page/src/**/*.ts',
                'libs/products/home-page/src/**/*.html',
              ],
            },
          },
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/products/home-page/jest.config.js',
              passWithNoTests: true,
            },
            outputs: ['coverage/libs/products/home-page'],
          },
        },
        generators: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['scope:products', 'type:feature'],
        files: [
          {
            file: 'libs/products/home-page/.eslintrc.json',
            hash: '9384bd8cee7cccbdde43abbc051ecf6cef35b256',
            ext: '.json',
          },
          {
            file: 'libs/products/home-page/jest.config.js',
            hash: 'e744d2813572a05a578b2f62b91aa43171497b37',
            ext: '.js',
          },
          {
            file: 'libs/products/home-page/README.md',
            hash: '722e60a3b9690fe6d2bc9f0e85b114a3048ca9d0',
            ext: '.md',
          },
          {
            file: 'libs/products/home-page/src/index.ts',
            hash: '0e7f9ca26e66d7aa35a83cd8e957248ef5bb1240',
            ext: '.ts',
          },
          {
            file:
              'libs/products/home-page/src/lib/home-page/home-page.component.html',
            hash: '8bd27770e5974269e766d95762fef74b5bd89841',
            ext: '.html',
          },
          {
            file:
              'libs/products/home-page/src/lib/home-page/home-page.component.scss',
            hash: 'ba4f1655a2c0791670384de48367caded0d6e601',
            ext: '.scss',
          },
          {
            file:
              'libs/products/home-page/src/lib/home-page/home-page.component.spec.ts',
            hash: '66eb455b3e71b30c0bd16a4769cc34b81133b667',
            ext: '.ts',
          },
          {
            file:
              'libs/products/home-page/src/lib/home-page/home-page.component.ts',
            hash: 'bd081eedbf10a2cd04c95609379d131e5e8d60a1',
            ext: '.ts',
          },
          {
            file:
              'libs/products/home-page/src/lib/products-home-page.module.spec.ts',
            hash: '1d9cf1c8c46ebe69275def67ccf6f04c0f967856',
            ext: '.ts',
          },
          {
            file:
              'libs/products/home-page/src/lib/products-home-page.module.ts',
            hash: 'db6a06b6d0063c4a1fff6c7953be09a680592184',
            ext: '.ts',
          },
          {
            file: 'libs/products/home-page/src/test-setup.ts',
            hash: '234024b3a303a4a59c0c3b204f549f0ebf0ce386',
            ext: '.ts',
          },
          {
            file: 'libs/products/home-page/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/products/home-page/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/products/home-page/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
        ],
      },
    },
    'shared-product-ui': {
      name: 'shared-product-ui',
      type: 'lib',
      data: {
        root: 'libs/shared/product/ui',
        sourceRoot: 'libs/shared/product/ui/src',
        projectType: 'library',
        generators: {},
        targets: {
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'libs/shared/product/ui/src/**/*.ts',
                'libs/shared/product/ui/src/**/*.html',
              ],
            },
          },
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/shared/product/ui/jest.config.js',
              passWithNoTests: true,
            },
            outputs: ['coverage/libs/shared/product/ui'],
          },
        },
        tags: ['scope:shared', 'type:ui'],
        files: [
          {
            file: 'libs/shared/product/ui/.babelrc',
            hash: '0cae4a9a81270d6cf3315436f594bf2fbd4fb3e2',
            ext: '',
          },
          {
            file: 'libs/shared/product/ui/.eslintrc.json',
            hash: 'f27e8c332d321de90c56395d24b45a2b68d1b52b',
            ext: '.json',
          },
          {
            file: 'libs/shared/product/ui/jest.config.js',
            hash: '24df5cb60883764db9003e975a9980189444e397',
            ext: '.js',
          },
          {
            file: 'libs/shared/product/ui/README.md',
            hash: 'e6943fb94ddb0a94513d68f4586098581172fcf4',
            ext: '.md',
          },
          {
            file: 'libs/shared/product/ui/src/index.ts',
            hash: '58b274ad76843b50333fc6d5cb9272d0f17d901d',
            ext: '.ts',
          },
          {
            file:
              'libs/shared/product/ui/src/lib/product-price/product-price.element.spec.ts',
            hash: '34be17f44c09cfa01a9fd4dc7ada68c7bafded6e',
            ext: '.ts',
          },
          {
            file:
              'libs/shared/product/ui/src/lib/product-price/product-price.element.ts',
            hash: '8c626d1213b1b47bc2bdf221554fb38bb9f9bfae',
            ext: '.ts',
          },
          {
            file: 'libs/shared/product/ui/src/test-setup.ts',
            hash: 'd8508d703266e7390b30189d3cf7fec7a70b198c',
            ext: '.ts',
          },
          {
            file: 'libs/shared/product/ui/tsconfig.json',
            hash: 'd32f55e3999447ae24e89f0e76d8c3128113c85e',
            ext: '.json',
          },
          {
            file: 'libs/shared/product/ui/tsconfig.lib.json',
            hash: 'a174cb09c30e46285517c7308247d602414aa63f',
            ext: '.json',
          },
          {
            file: 'libs/shared/product/ui/tsconfig.spec.json',
            hash: '8119baebcd43425a4864ee524518032d2f4af20a',
            ext: '.json',
          },
        ],
      },
    },
    'shared-cart-state': {
      name: 'shared-cart-state',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/shared/cart/state',
        sourceRoot: 'libs/shared/cart/state/src',
        prefix: 'nx-example',
        targets: {
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'libs/shared/cart/state/src/**/*.ts',
                'libs/shared/cart/state/src/**/*.html',
              ],
            },
          },
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/shared/cart/state/jest.config.js',
              passWithNoTests: true,
            },
            outputs: ['coverage/libs/shared/cart/state'],
          },
        },
        generators: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['scope:shared', 'type:state'],
        files: [
          {
            file: 'libs/shared/cart/state/.babelrc',
            hash: '0cae4a9a81270d6cf3315436f594bf2fbd4fb3e2',
            ext: '',
          },
          {
            file: 'libs/shared/cart/state/.eslintrc.json',
            hash: '57932578e6df8f4a907a78abde0e3f5a7d84fc6f',
            ext: '.json',
          },
          {
            file: 'libs/shared/cart/state/jest.config.js',
            hash: 'a68c833b702c540a8b0d0d95f2685c2ee4d253da',
            ext: '.js',
          },
          {
            file: 'libs/shared/cart/state/README.md',
            hash: '38627fdbb83e5984c84fd1d5895815907d4dea30',
            ext: '.md',
          },
          {
            file: 'libs/shared/cart/state/src/index.ts',
            hash: 'a3b86be1438b7b7cdccb3bc7e76aadfe577fc285',
            ext: '.ts',
          },
          {
            file: 'libs/shared/cart/state/src/lib/+state/cart.actions.ts',
            hash: '48a8bd4b999b890c0dcced20c3a52b79f9c8406c',
            ext: '.ts',
          },
          {
            file: 'libs/shared/cart/state/src/lib/+state/cart.reducer.spec.ts',
            hash: '01afbcca3e8a6ca70f24f5a7ff3efce0d9fb6e6a',
            ext: '.ts',
          },
          {
            file: 'libs/shared/cart/state/src/lib/+state/cart.reducer.ts',
            hash: '0583a02da1ed94e29a9ab4b8f310bad9c069962c',
            ext: '.ts',
          },
          {
            file:
              'libs/shared/cart/state/src/lib/+state/cart.selectors.spec.ts',
            hash: 'dc5a869677b1db84446492fc6a1045cd33c0d661',
            ext: '.ts',
          },
          {
            file: 'libs/shared/cart/state/src/lib/+state/cart.selectors.ts',
            hash: '17578b3264970ac26228f8b0ec59707591714ffd',
            ext: '.ts',
          },
          {
            file:
              'libs/shared/cart/state/src/lib/shared-cart-state.module.spec.ts',
            hash: 'caef812f0d76e3f3ca6849d53dc0d011cd2e902a',
            ext: '.ts',
          },
          {
            file: 'libs/shared/cart/state/src/lib/shared-cart-state.module.ts',
            hash: '180d2c45ab25f0eeb6b15378bd43b85874f5b318',
            ext: '.ts',
          },
          {
            file: 'libs/shared/cart/state/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/shared/cart/state/tsconfig.json',
            hash: 'd32f55e3999447ae24e89f0e76d8c3128113c85e',
            ext: '.json',
          },
          {
            file: 'libs/shared/cart/state/tsconfig.lib.json',
            hash: 'ad83824e5f62f1e5ff2acd0960bde6bab3f87d66',
            ext: '.json',
          },
          {
            file: 'libs/shared/cart/state/tsconfig.spec.json',
            hash: 'aed68bc6bf86609a7a4f0fdf5a562265cd90e452',
            ext: '.json',
          },
        ],
      },
    },
    'shared-e2e-utils': {
      name: 'shared-e2e-utils',
      type: 'lib',
      data: {
        root: 'libs/shared/e2e-utils',
        sourceRoot: 'libs/shared/e2e-utils/src',
        projectType: 'library',
        generators: {},
        targets: {
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'libs/shared/e2e-utils/src/**/*.ts',
                'libs/shared/e2e-utils/src/**/*.html',
              ],
            },
          },
        },
        tags: ['scope:shared', 'type:e2e-utils'],
        files: [
          {
            file: 'libs/shared/e2e-utils/.eslintrc.json',
            hash: 'b7d8fbb6b72b612119154a18b2142c8f41e1f6a5',
            ext: '.json',
          },
          {
            file: 'libs/shared/e2e-utils/README.md',
            hash: '4864d1fe9daeac7441673144997eb93f38a451a7',
            ext: '.md',
          },
          {
            file: 'libs/shared/e2e-utils/src/index.ts',
            hash: '5f637af2f9a45117b16185c0d2d49bb7ae082e8c',
            ext: '.ts',
          },
          {
            file: 'libs/shared/e2e-utils/src/lib/shared-e2e-utils.ts',
            hash: '69aae501c209457bd9a504344fcc262cb2c452a6',
            ext: '.ts',
          },
          {
            file: 'libs/shared/e2e-utils/tsconfig.json',
            hash: '662468f8e66527570a90c88435fb3fe322200c55',
            ext: '.json',
          },
          {
            file: 'libs/shared/e2e-utils/tsconfig.lib.json',
            hash: '0fe9966358eb51092a1668ecb0795b6db52a538b',
            ext: '.json',
          },
        ],
      },
    },
    'cart-cart-page': {
      name: 'cart-cart-page',
      type: 'lib',
      data: {
        root: 'libs/cart/cart-page',
        sourceRoot: 'libs/cart/cart-page/src',
        projectType: 'library',
        generators: {},
        targets: {
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'libs/cart/cart-page/src/**/*.ts',
                'libs/cart/cart-page/src/**/*.html',
              ],
            },
          },
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/cart/cart-page/jest.config.js',
              passWithNoTests: true,
            },
            outputs: ['coverage/libs/cart/cart-page'],
          },
        },
        tags: ['scope:cart', 'type:feature'],
        files: [
          {
            file: 'libs/cart/cart-page/.babelrc',
            hash: '949e8732e3c2eff5d233ac6940e53b8a2580f34d',
            ext: '',
          },
          {
            file: 'libs/cart/cart-page/.eslintrc.json',
            hash: '39bcc7135bc0dee18a7cd08ba10d6eaf2fc80537',
            ext: '.json',
          },
          {
            file: 'libs/cart/cart-page/jest.config.js',
            hash: 'fb7e75c762323454e8f0f461e751fb02fd0712be',
            ext: '.js',
          },
          {
            file: 'libs/cart/cart-page/README.md',
            hash: 'e849e84b78b7b1c409567b4dadebf54b1ef45ca6',
            ext: '.md',
          },
          {
            file: 'libs/cart/cart-page/src/index.ts',
            hash: 'ad4674d7e1cfad04953cff1084cb229d81bcfa94',
            ext: '.ts',
          },
          {
            file:
              'libs/cart/cart-page/src/lib/cart-cart-page/cart-cart-page.spec.tsx',
            hash: 'ccef1ef28fac14fdaa45c523108862d70d28825b',
            ext: '.tsx',
          },
          {
            file:
              'libs/cart/cart-page/src/lib/cart-cart-page/cart-cart-page.tsx',
            hash: '83a824d0bafcc3d4edf94490664351fe99cdef3f',
            ext: '.tsx',
          },
          {
            file: 'libs/cart/cart-page/src/test-setup.ts',
            hash: 'd8508d703266e7390b30189d3cf7fec7a70b198c',
            ext: '.ts',
          },
          {
            file: 'libs/cart/cart-page/tsconfig.json',
            hash: '2fb9dcb6105aef11dbd99240297fbe2e3bcc6e06',
            ext: '.json',
          },
          {
            file: 'libs/cart/cart-page/tsconfig.lib.json',
            hash: '38f967bced5dd3d7010d6faf6fa18b34959ffbb1',
            ext: '.json',
          },
          {
            file: 'libs/cart/cart-page/tsconfig.spec.json',
            hash: '1798b378a998ed74ef92f3e98f95e60c58bcba37',
            ext: '.json',
          },
        ],
      },
    },
    'shared-jsxify': {
      name: 'shared-jsxify',
      type: 'lib',
      data: {
        root: 'libs/shared/jsxify',
        sourceRoot: 'libs/shared/jsxify/src',
        projectType: 'library',
        generators: {},
        targets: {
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'libs/shared/jsxify/src/**/*.ts',
                'libs/shared/jsxify/src/**/*.html',
              ],
            },
          },
        },
        tags: ['scope:shared', 'type:types'],
        files: [
          {
            file: 'libs/shared/jsxify/.babelrc',
            hash: '0cae4a9a81270d6cf3315436f594bf2fbd4fb3e2',
            ext: '',
          },
          {
            file: 'libs/shared/jsxify/.eslintrc.json',
            hash: '956fcc640babc6d52c6c2370616b71d5fa4b5a7a',
            ext: '.json',
          },
          {
            file: 'libs/shared/jsxify/README.md',
            hash: '80d053e1b10cef1a553c10a78969b7f5b77dc53a',
            ext: '.md',
          },
          {
            file: 'libs/shared/jsxify/src/index.ts',
            hash: 'c83bdb671f875f391277ac69a5468fab6a07b2af',
            ext: '.ts',
          },
          {
            file: 'libs/shared/jsxify/src/lib/shared-jsxify.ts',
            hash: '2343cbc0ee3a4399b277720ae516575b00415f4e',
            ext: '.ts',
          },
          {
            file: 'libs/shared/jsxify/tsconfig.json',
            hash: '98a51da43d2d67b63a8e74ae657686858277e9f7',
            ext: '.json',
          },
          {
            file: 'libs/shared/jsxify/tsconfig.lib.json',
            hash: '0fe9966358eb51092a1668ecb0795b6db52a538b',
            ext: '.json',
          },
        ],
      },
    },
    'shared-assets': {
      name: 'shared-assets',
      type: 'lib',
      data: {
        root: 'libs/shared/assets',
        sourceRoot: 'libs/shared/assets/src',
        projectType: 'library',
        generators: {},
        targets: {},
        tags: ['type:assets', 'scope:shared'],
        files: [
          {
            file: 'libs/shared/assets/README.md',
            hash: '11891734c3dc348bc38c587824ce3334fc9eb5f0',
            ext: '.md',
          },
          {
            file: 'libs/shared/assets/src/assets/icons/github.png',
            hash: '73db1f61f3aa55fcaecbca896dbea067706bb7bd',
            ext: '.png',
          },
          {
            file: 'libs/shared/assets/src/assets/images/a-clash-of-kings.jpg',
            hash: 'be2863c3a3eb291cac921028af72604af00dd362',
            ext: '.jpg',
          },
          {
            file:
              'libs/shared/assets/src/assets/images/a-dance-with-dragons.jpg',
            hash: 'ea6706f36b4e3a579bd97b8e506fbc7345ef8635',
            ext: '.jpg',
          },
          {
            file: 'libs/shared/assets/src/assets/images/a-feast-for-crows.jpg',
            hash: '1bd6e8f85bb741aca00d0bf9d6c87ddb1e96c97e',
            ext: '.jpg',
          },
          {
            file: 'libs/shared/assets/src/assets/images/a-game-of-thrones.jpg',
            hash: '2fc1452579133fbc3e02c822e5d14beeaae09d0d',
            ext: '.jpg',
          },
          {
            file: 'libs/shared/assets/src/assets/images/a-storm-of-swords.jpg',
            hash: '0abd5a19762f2766ab86c192eafad4acf1ca66db',
            ext: '.jpg',
          },
          {
            file: 'libs/shared/assets/src/favicon.ico',
            hash: '317ebcb2336e0833a22dddf0ab287849f26fda57',
            ext: '.ico',
          },
        ],
      },
    },
    'shared-header': {
      name: 'shared-header',
      type: 'lib',
      data: {
        root: 'libs/shared/header',
        sourceRoot: 'libs/shared/header/src',
        projectType: 'library',
        generators: {},
        targets: {
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'libs/shared/header/src/**/*.ts',
                'libs/shared/header/src/**/*.html',
              ],
            },
          },
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/shared/header/jest.config.js',
              passWithNoTests: true,
            },
            outputs: ['coverage/libs/shared/header'],
          },
        },
        tags: ['scope:shared', 'type:ui'],
        files: [
          {
            file: 'libs/shared/header/.babelrc',
            hash: '0cae4a9a81270d6cf3315436f594bf2fbd4fb3e2',
            ext: '',
          },
          {
            file: 'libs/shared/header/.eslintrc.json',
            hash: 'c1ddeb2aa5bf964a05e628e2137c4ac513c59a7e',
            ext: '.json',
          },
          {
            file: 'libs/shared/header/index.scss',
            hash: '09fd44fea0cd18509c0e77aa5522c65590df0448',
            ext: '.scss',
          },
          {
            file: 'libs/shared/header/jest.config.js',
            hash: '20f1a883bc2411dbb35c36135443dfe45c3a97f4',
            ext: '.js',
          },
          {
            file: 'libs/shared/header/README.md',
            hash: '7a9c74dbe1c14e5b710aa03cf0a0013ebdce39e2',
            ext: '.md',
          },
          {
            file: 'libs/shared/header/src/index.ts',
            hash: '720634b61b9010b5ba7a58169a8f1e99853aa604',
            ext: '.ts',
          },
          {
            file: 'libs/shared/header/src/lib/header/header.element.scss',
            hash: 'd13956172eb5f11b6fe4f5e616c057be3bc12578',
            ext: '.scss',
          },
          {
            file: 'libs/shared/header/src/lib/header/header.element.spec.ts',
            hash: '2e410dcfcce6c2e15cdbe8382463d64bc2724af6',
            ext: '.ts',
          },
          {
            file: 'libs/shared/header/src/lib/header/header.element.ts',
            hash: '788a1512fb3b61bb9d431c16656781132ac5c530',
            ext: '.ts',
          },
          {
            file: 'libs/shared/header/src/test-setup.ts',
            hash: 'd8508d703266e7390b30189d3cf7fec7a70b198c',
            ext: '.ts',
          },
          {
            file: 'libs/shared/header/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/shared/header/tsconfig.lib.json',
            hash: '0fe9966358eb51092a1668ecb0795b6db52a538b',
            ext: '.json',
          },
          {
            file: 'libs/shared/header/tsconfig.spec.json',
            hash: '1798b378a998ed74ef92f3e98f95e60c58bcba37',
            ext: '.json',
          },
        ],
      },
    },
    'shared-styles': {
      name: 'shared-styles',
      type: 'lib',
      data: {
        root: 'libs/shared/styles',
        sourceRoot: 'libs/shared/styles/src',
        projectType: 'library',
        generators: {},
        targets: {},
        tags: ['scope:shared', 'type:styles'],
        files: [
          {
            file: 'libs/shared/styles/README.md',
            hash: '726adf41353f106db057050b4b8d0e8784c6eed5',
            ext: '.md',
          },
          {
            file: 'libs/shared/styles/src/index.scss',
            hash: '4242c2389d84fc3062a84cddb0f6b94427304803',
            ext: '.scss',
          },
          {
            file: 'libs/shared/styles/src/lib/global.scss',
            hash: '55caa35d877ea8028f97134fa985a0b7e772f963',
            ext: '.scss',
          },
        ],
      },
    },
    'products-e2e': {
      name: 'products-e2e',
      type: 'e2e',
      data: {
        root: 'apps/products-e2e',
        sourceRoot: 'apps/products-e2e/src',
        projectType: 'application',
        targets: {
          e2e: {
            executor: '@nrwl/cypress:cypress',
            options: {
              cypressConfig: 'apps/products-e2e/cypress.json',
              tsConfig: 'apps/products-e2e/tsconfig.e2e.json',
              devServerTarget: 'products:serve',
            },
            configurations: {
              production: {
                devServerTarget: 'products:serve:production',
              },
            },
          },
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: ['apps/products-e2e/**/*.{js,ts}'],
            },
          },
        },
        tags: ['scope:products', 'type:e2e'],
        files: [
          {
            file: 'apps/products-e2e/.eslintrc.json',
            hash: 'e7caab63fbef52bb000835acbb23935cb48203a0',
            ext: '.json',
          },
          {
            file: 'apps/products-e2e/cypress.json',
            hash: 'c39114733d86bb3add2b9d597c00abad22d3f17f',
            ext: '.json',
          },
          {
            file: 'apps/products-e2e/src/fixtures/example.json',
            hash: '294cbed6ce9e0b948b787452e8676aee486cb3be',
            ext: '.json',
          },
          {
            file: 'apps/products-e2e/src/integration/app.spec.ts',
            hash: '00b7341abcfcdaf897c7eb31f6a79a297fc01af0',
            ext: '.ts',
          },
          {
            file: 'apps/products-e2e/src/plugins/index.js',
            hash: 'bc34d630eb13beb0738f63e289248a6f3bc1c1c5',
            ext: '.js',
          },
          {
            file: 'apps/products-e2e/src/support/app.po.ts',
            hash: 'd5ac94199b3e68be5782c883344f00c90bfd07a9',
            ext: '.ts',
          },
          {
            file: 'apps/products-e2e/src/support/commands.ts',
            hash: 'ca4d256f3eb15dfabad1f5760c9b2d0ceb4c24b9',
            ext: '.ts',
          },
          {
            file: 'apps/products-e2e/src/support/index.ts',
            hash: '3d469a6b6cf31eb66117d73e278bcf74f398f1db',
            ext: '.ts',
          },
          {
            file: 'apps/products-e2e/tsconfig.e2e.json',
            hash: '9dc3660a79ee2f6daf097b4930427223896e3b25',
            ext: '.json',
          },
          {
            file: 'apps/products-e2e/tsconfig.json',
            hash: '08841a7f56c62d55340ad08451502304837254fd',
            ext: '.json',
          },
        ],
      },
    },
    products: {
      name: 'products',
      type: 'app',
      data: {
        projectType: 'application',
        generators: {
          '@nrwl/workspace:component': {
            style: 'scss',
          },
        },
        root: 'apps/products',
        sourceRoot: 'apps/products/src',
        prefix: 'nx-example',
        targets: {
          build: {
            executor: '@angular-devkit/build-angular:browser',
            options: {
              aot: true,
              outputPath: 'dist/apps/products',
              index: 'apps/products/src/index.html',
              main: 'apps/products/src/main.ts',
              polyfills: 'apps/products/src/polyfills.ts',
              tsConfig: 'apps/products/tsconfig.app.json',
              assets: [
                'apps/products/src/_redirects',
                {
                  input: 'libs/shared/assets/src/assets',
                  glob: '**/*',
                  output: 'assets',
                },
                {
                  input: 'libs/shared/assets/src',
                  glob: 'favicon.ico',
                  output: '.',
                },
              ],
              styles: [
                'libs/shared/styles/src/index.scss',
                'libs/shared/header/index.scss',
                'node_modules/normalize.css/normalize.css',
              ],
              scripts: [],
            },
            configurations: {
              production: {
                fileReplacements: [
                  {
                    replace: 'apps/products/src/environments/environment.ts',
                    with: 'apps/products/src/environments/environment.prod.ts',
                  },
                ],
                optimization: true,
                outputHashing: 'all',
                sourceMap: false,
                namedChunks: false,
                aot: true,
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
                  },
                ],
              },
            },
            outputs: ['{options.outputPath}'],
          },
          serve: {
            executor: '@angular-devkit/build-angular:dev-server',
            options: {
              browserTarget: 'products:build',
            },
            configurations: {
              production: {
                browserTarget: 'products:build:production',
              },
            },
          },
          'extract-i18n': {
            executor: '@angular-devkit/build-angular:extract-i18n',
            options: {
              browserTarget: 'products:build',
            },
          },
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'apps/products/src/**/*.ts',
                'apps/products/src/**/*.html',
              ],
            },
          },
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'apps/products/jest.config.js',
              passWithNoTests: true,
            },
            outputs: ['coverage/apps/products'],
          },
          deploy: {
            executor: '@nrwl/workspace:run-commands',
            options: {
              commands: [
                {
                  command:
                    'npx ts-node --project tools/tsconfig.tools.json tools/scripts/deploy --siteName nrwl-nx-examples-products --outputPath dist/apps/products',
                },
              ],
            },
          },
        },
        tags: ['type:app', 'scope:products'],
        files: [
          {
            file: 'apps/products/.browserslistrc',
            hash: '80848532e47d58cc7a4b618f600b438960f9f045',
            ext: '',
          },
          {
            file: 'apps/products/.eslintrc.json',
            hash: '09bf85ffde1b09ba5ee6a114f2ceeb11a4a892d1',
            ext: '.json',
          },
          {
            file: 'apps/products/jest.config.js',
            hash: '467eac68e849365f649f8f4aac5d5f6395c62ba9',
            ext: '.js',
          },
          {
            file: 'apps/products/src/_redirects',
            hash: '7cbf76be95b720c89c7602ff8497c030004460a0',
            ext: '',
          },
          {
            file: 'apps/products/src/app/app.component.html',
            hash: 'bb3f473b9bbce44012333d96f9e2a741f11eeda7',
            ext: '.html',
          },
          {
            file: 'apps/products/src/app/app.component.scss',
            hash: '6c2cb68a16e0dbc48ec5497bffe3db6c83a08171',
            ext: '.scss',
          },
          {
            file: 'apps/products/src/app/app.component.spec.ts',
            hash: 'b611bf15a7302118c40010c47faa14a6ee70d714',
            ext: '.ts',
          },
          {
            file: 'apps/products/src/app/app.component.ts',
            hash: '67f74e1fe6f32700ab9eb84c28e8c5eb0a3816e6',
            ext: '.ts',
          },
          {
            file: 'apps/products/src/app/app.module.ts',
            hash: 'b83f636e0c945792e77ac5634ef6641041bc5e7a',
            ext: '.ts',
          },
          {
            file: 'apps/products/src/assets/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file: 'apps/products/src/environments/environment.prod.ts',
            hash: '3612073bc31cd4c1f5d6cbb00318521e9a61bd8a',
            ext: '.ts',
          },
          {
            file: 'apps/products/src/environments/environment.ts',
            hash: '7b4f817adb754769ca126a939d48ac4b0850489d',
            ext: '.ts',
          },
          {
            file: 'apps/products/src/favicon.ico',
            hash: '8081c7ceaf2be08bf59010158c586170d9d2d517',
            ext: '.ico',
          },
          {
            file: 'apps/products/src/index.html',
            hash: 'ab6b7852619b9523b4bce50a50f04f4b92612878',
            ext: '.html',
          },
          {
            file: 'apps/products/src/main.ts',
            hash: 'fa4e0aef33721b84c2cc9f415da4770e770a68b4',
            ext: '.ts',
          },
          {
            file: 'apps/products/src/polyfills.ts',
            hash: '2f258e56c60dd84a931a7486d2b999dd8ecf7037',
            ext: '.ts',
          },
          {
            file: 'apps/products/src/test-setup.ts',
            hash: '234024b3a303a4a59c0c3b204f549f0ebf0ce386',
            ext: '.ts',
          },
          {
            file: 'apps/products/tsconfig.app.json',
            hash: '47e4f8225ea7c019c84f7c5f1809237f34c7b0a9',
            ext: '.json',
          },
          {
            file: 'apps/products/tsconfig.editor.json',
            hash: '20c4afdbf437457984afcb236d4b5e588aec858a',
            ext: '.json',
          },
          {
            file: 'apps/products/tsconfig.json',
            hash: '4ef4491ede9de763393e9ab15febd9091fbb1ca5',
            ext: '.json',
          },
          {
            file: 'apps/products/tsconfig.spec.json',
            hash: 'cfff29a544fb49a8c26a7cbf9cd836c87efb7fe8',
            ext: '.json',
          },
        ],
      },
    },
    'cart-e2e': {
      name: 'cart-e2e',
      type: 'e2e',
      data: {
        root: 'apps/cart-e2e',
        sourceRoot: 'apps/cart-e2e/src',
        projectType: 'application',
        targets: {
          e2e: {
            executor: '@nrwl/cypress:cypress',
            options: {
              cypressConfig: 'apps/cart-e2e/cypress.json',
              tsConfig: 'apps/cart-e2e/tsconfig.e2e.json',
              devServerTarget: 'cart:serve',
            },
            configurations: {
              production: {
                devServerTarget: 'cart:serve:production',
              },
            },
          },
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: ['apps/cart-e2e/**/*.{ts,tsx,js,jsx}'],
            },
          },
        },
        tags: ['scope:cart', 'type:e2e'],
        files: [
          {
            file: 'apps/cart-e2e/.eslintrc.json',
            hash: '082395fbd03ae178157f9ebd4d374d208fd254f8',
            ext: '.json',
          },
          {
            file: 'apps/cart-e2e/cypress.json',
            hash: '274e7f46c243ba3246a6da530d52ad7e03c7652e',
            ext: '.json',
          },
          {
            file: 'apps/cart-e2e/src/fixtures/example.json',
            hash: '294cbed6ce9e0b948b787452e8676aee486cb3be',
            ext: '.json',
          },
          {
            file: 'apps/cart-e2e/src/integration/app.spec.ts',
            hash: 'caae6c7558f1bdfa052af97eb192ad3ef9673921',
            ext: '.ts',
          },
          {
            file: 'apps/cart-e2e/src/plugins/index.js',
            hash: 'bc34d630eb13beb0738f63e289248a6f3bc1c1c5',
            ext: '.js',
          },
          {
            file: 'apps/cart-e2e/src/support/app.po.ts',
            hash: 'c29f04f1c8d7c8722fbf705b3d951333c4fb95fc',
            ext: '.ts',
          },
          {
            file: 'apps/cart-e2e/src/support/commands.ts',
            hash: 'ca4d256f3eb15dfabad1f5760c9b2d0ceb4c24b9',
            ext: '.ts',
          },
          {
            file: 'apps/cart-e2e/src/support/index.ts',
            hash: '3d469a6b6cf31eb66117d73e278bcf74f398f1db',
            ext: '.ts',
          },
          {
            file: 'apps/cart-e2e/tsconfig.e2e.json',
            hash: '9dc3660a79ee2f6daf097b4930427223896e3b25',
            ext: '.json',
          },
          {
            file: 'apps/cart-e2e/tsconfig.json',
            hash: '08841a7f56c62d55340ad08451502304837254fd',
            ext: '.json',
          },
        ],
      },
    },
    cart: {
      name: 'cart',
      type: 'app',
      data: {
        root: 'apps/cart',
        sourceRoot: 'apps/cart/src',
        projectType: 'application',
        generators: {},
        targets: {
          build: {
            executor: '@nrwl/web:build',
            options: {
              outputPath: 'dist/apps/cart',
              webpackConfig: '@nrwl/react/plugins/webpack',
              index: 'apps/cart/src/index.html',
              main: 'apps/cart/src/main.tsx',
              polyfills: 'apps/cart/src/polyfills.ts',
              tsConfig: 'apps/cart/tsconfig.app.json',
              assets: [
                'apps/cart/src/_redirects',
                {
                  input: 'libs/shared/assets/src/assets',
                  glob: '**/*',
                  output: 'assets',
                },
                {
                  input: 'libs/shared/assets/src',
                  glob: 'favicon.ico',
                  output: '',
                },
              ],
              maxWorkers: 8,
              styles: [
                'libs/shared/styles/src/index.scss',
                'libs/shared/header/index.scss',
                'node_modules/normalize.css/normalize.css',
              ],
              scripts: [],
              buildLibsFromSource: true,
            },
            configurations: {
              production: {
                fileReplacements: [
                  {
                    replace: 'apps/cart/src/environments/environment.ts',
                    with: 'apps/cart/src/environments/environment.prod.ts',
                  },
                ],
                optimization: true,
                outputHashing: 'all',
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
              buildTarget: 'cart:build',
            },
            configurations: {
              production: {
                buildTarget: 'cart:build:production',
              },
            },
          },
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: ['apps/cart/**/*.{ts,tsx,js,jsx}'],
            },
          },
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'apps/cart/jest.config.js',
              passWithNoTests: true,
            },
            outputs: ['coverage/apps/cart'],
          },
          deploy: {
            executor: '@nrwl/workspace:run-commands',
            options: {
              commands: [
                {
                  command:
                    'npx ts-node --project tools/tsconfig.tools.json tools/scripts/deploy --siteName nrwl-nx-examples-cart --outputPath dist/apps/cart',
                },
              ],
            },
          },
        },
        tags: ['type:app', 'scope:cart'],
        files: [
          {
            file: 'apps/cart/.babelrc',
            hash: 'e7dbb18faa92e1c266d48a34f5e24f9123486cfd',
            ext: '',
          },
          {
            file: 'apps/cart/.eslintrc.json',
            hash: '4e6e0b82073fa77dc1c5b2f926d5d9d5d3cf2585',
            ext: '.json',
          },
          {
            file: 'apps/cart/browserlist',
            hash: '37371cb04b9f1986d952499cdf9613c9d5d8ca8c',
            ext: '',
          },
          {
            file: 'apps/cart/jest.config.js',
            hash: '95c4560df2a7ecaaa7acea7c4e4490d5e41e0e68',
            ext: '.js',
          },
          {
            file: 'apps/cart/src/_redirects',
            hash: '50d93f23ab427b2911555db1a5c9a023293f470a',
            ext: '',
          },
          {
            file: 'apps/cart/src/app/app.spec.tsx',
            hash: '1cbad629155a8ef9e3d2cb2fd11f2066f46ebdc1',
            ext: '.tsx',
          },
          {
            file: 'apps/cart/src/app/app.tsx',
            hash: '314f470e7cea7b5d4c4204af6bd163889f174123',
            ext: '.tsx',
          },
          {
            file: 'apps/cart/src/assets/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file: 'apps/cart/src/environments/environment.prod.ts',
            hash: '3612073bc31cd4c1f5d6cbb00318521e9a61bd8a',
            ext: '.ts',
          },
          {
            file: 'apps/cart/src/environments/environment.ts',
            hash: 'd9370e924b51bc67ecddee7fc3b6693681a324b6',
            ext: '.ts',
          },
          {
            file: 'apps/cart/src/favicon.ico',
            hash: 'a11777cc471a4344702741ab1c8a588998b1311a',
            ext: '.ico',
          },
          {
            file: 'apps/cart/src/index.html',
            hash: '1a7a74ec69f2b7a86ee7918f412e25edff23ebfb',
            ext: '.html',
          },
          {
            file: 'apps/cart/src/main.tsx',
            hash: 'af19d958935daa35c0d7f584564983695a99fe30',
            ext: '.tsx',
          },
          {
            file: 'apps/cart/src/polyfills.ts',
            hash: '83926853099fe077c00663db9909f25c9a3b769d',
            ext: '.ts',
          },
          {
            file: 'apps/cart/src/test-setup.ts',
            hash: 'd8508d703266e7390b30189d3cf7fec7a70b198c',
            ext: '.ts',
          },
          {
            file: 'apps/cart/tsconfig.app.json',
            hash: '107c96889d3469e7d3a3080cc35f480ea6e76485',
            ext: '.json',
          },
          {
            file: 'apps/cart/tsconfig.json',
            hash: 'f3a492c6b29c56046e87a24927ec6c51fa21e581',
            ext: '.json',
          },
          {
            file: 'apps/cart/tsconfig.spec.json',
            hash: 'fee141bb0e94dd45e39790186c49cac7dcf470c2',
            ext: '.json',
          },
        ],
      },
    },
    'npm:@angular/animations': {
      type: 'npm',
      name: 'npm:@angular/animations',
      data: {
        version: '11.2.0',
        packageName: '@angular/animations',
        files: [],
      },
    },
    'npm:@angular/common': {
      type: 'npm',
      name: 'npm:@angular/common',
      data: {
        version: '11.2.0',
        packageName: '@angular/common',
        files: [],
      },
    },
    'npm:@angular/compiler': {
      type: 'npm',
      name: 'npm:@angular/compiler',
      data: {
        version: '11.2.0',
        packageName: '@angular/compiler',
        files: [],
      },
    },
    'npm:@angular/core': {
      type: 'npm',
      name: 'npm:@angular/core',
      data: {
        version: '11.2.0',
        packageName: '@angular/core',
        files: [],
      },
    },
    'npm:@angular/forms': {
      type: 'npm',
      name: 'npm:@angular/forms',
      data: {
        version: '11.2.0',
        packageName: '@angular/forms',
        files: [],
      },
    },
    'npm:@angular/platform-browser': {
      type: 'npm',
      name: 'npm:@angular/platform-browser',
      data: {
        version: '11.2.0',
        packageName: '@angular/platform-browser',
        files: [],
      },
    },
    'npm:@angular/platform-browser-dynamic': {
      type: 'npm',
      name: 'npm:@angular/platform-browser-dynamic',
      data: {
        version: '11.2.0',
        packageName: '@angular/platform-browser-dynamic',
        files: [],
      },
    },
    'npm:@angular/router': {
      type: 'npm',
      name: 'npm:@angular/router',
      data: {
        version: '11.2.0',
        packageName: '@angular/router',
        files: [],
      },
    },
    'npm:@emotion/babel-preset-css-prop': {
      type: 'npm',
      name: 'npm:@emotion/babel-preset-css-prop',
      data: {
        version: '11.0.0',
        packageName: '@emotion/babel-preset-css-prop',
        files: [],
      },
    },
    'npm:@emotion/react': {
      type: 'npm',
      name: 'npm:@emotion/react',
      data: {
        version: '11.0.0',
        packageName: '@emotion/react',
        files: [],
      },
    },
    'npm:@emotion/styled': {
      type: 'npm',
      name: 'npm:@emotion/styled',
      data: {
        version: '11.0.0',
        packageName: '@emotion/styled',
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
    'npm:@ngrx/store': {
      type: 'npm',
      name: 'npm:@ngrx/store',
      data: {
        version: '11.0.0',
        packageName: '@ngrx/store',
        files: [],
      },
    },
    'npm:@nrwl/angular': {
      type: 'npm',
      name: 'npm:@nrwl/angular',
      data: {
        version: '11.6.0',
        packageName: '@nrwl/angular',
        files: [],
      },
    },
    'npm:core-js': {
      type: 'npm',
      name: 'npm:core-js',
      data: {
        version: '^2.5.4',
        packageName: 'core-js',
        files: [],
      },
    },
    'npm:document-register-element': {
      type: 'npm',
      name: 'npm:document-register-element',
      data: {
        version: '1.13.1',
        packageName: 'document-register-element',
        files: [],
      },
    },
    'npm:normalize.css': {
      type: 'npm',
      name: 'npm:normalize.css',
      data: {
        version: '^8.0.1',
        packageName: 'normalize.css',
        files: [],
      },
    },
    'npm:react': {
      type: 'npm',
      name: 'npm:react',
      data: {
        version: '17.0.1',
        packageName: 'react',
        files: [],
      },
    },
    'npm:react-dom': {
      type: 'npm',
      name: 'npm:react-dom',
      data: {
        version: '17.0.1',
        packageName: 'react-dom',
        files: [],
      },
    },
    'npm:react-router-dom': {
      type: 'npm',
      name: 'npm:react-router-dom',
      data: {
        version: '5.2.0',
        packageName: 'react-router-dom',
        files: [],
      },
    },
    'npm:rxjs': {
      type: 'npm',
      name: 'npm:rxjs',
      data: {
        version: '~6.5.5',
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
        version: '~0.10.3',
        packageName: 'zone.js',
        files: [],
      },
    },
    'npm:@angular-devkit/build-angular': {
      type: 'npm',
      name: 'npm:@angular-devkit/build-angular',
      data: {
        version: '0.1102.0',
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
        version: '11.2.0',
        packageName: '@angular/cli',
        files: [],
      },
    },
    'npm:@angular/compiler-cli': {
      type: 'npm',
      name: 'npm:@angular/compiler-cli',
      data: {
        version: '11.2.0',
        packageName: '@angular/compiler-cli',
        files: [],
      },
    },
    'npm:@angular/language-service': {
      type: 'npm',
      name: 'npm:@angular/language-service',
      data: {
        version: '11.2.0',
        packageName: '@angular/language-service',
        files: [],
      },
    },
    'npm:@babel/preset-react': {
      type: 'npm',
      name: 'npm:@babel/preset-react',
      data: {
        version: '7.0.0',
        packageName: '@babel/preset-react',
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
    'npm:@nrwl/cli': {
      type: 'npm',
      name: 'npm:@nrwl/cli',
      data: {
        version: '11.6.0',
        packageName: '@nrwl/cli',
        files: [],
      },
    },
    'npm:@nrwl/cypress': {
      type: 'npm',
      name: 'npm:@nrwl/cypress',
      data: {
        version: '11.6.0',
        packageName: '@nrwl/cypress',
        files: [],
      },
    },
    'npm:@nrwl/eslint-plugin-nx': {
      type: 'npm',
      name: 'npm:@nrwl/eslint-plugin-nx',
      data: {
        version: '11.6.0',
        packageName: '@nrwl/eslint-plugin-nx',
        files: [],
      },
    },
    'npm:@nrwl/jest': {
      type: 'npm',
      name: 'npm:@nrwl/jest',
      data: {
        version: '11.6.0',
        packageName: '@nrwl/jest',
        files: [],
      },
    },
    'npm:@nrwl/linter': {
      type: 'npm',
      name: 'npm:@nrwl/linter',
      data: {
        version: '11.6.0',
        packageName: '@nrwl/linter',
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
    'npm:@nrwl/react': {
      type: 'npm',
      name: 'npm:@nrwl/react',
      data: {
        version: '11.6.0',
        packageName: '@nrwl/react',
        files: [],
      },
    },
    'npm:@nrwl/tao': {
      type: 'npm',
      name: 'npm:@nrwl/tao',
      data: {
        version: '11.6.0',
        packageName: '@nrwl/tao',
        files: [],
      },
    },
    'npm:@nrwl/web': {
      type: 'npm',
      name: 'npm:@nrwl/web',
      data: {
        version: '11.6.0',
        packageName: '@nrwl/web',
        files: [],
      },
    },
    'npm:@nrwl/workspace': {
      type: 'npm',
      name: 'npm:@nrwl/workspace',
      data: {
        version: '11.6.0',
        packageName: '@nrwl/workspace',
        files: [],
      },
    },
    'npm:@testing-library/react': {
      type: 'npm',
      name: 'npm:@testing-library/react',
      data: {
        version: '11.1.2',
        packageName: '@testing-library/react',
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
    'npm:@types/react': {
      type: 'npm',
      name: 'npm:@types/react',
      data: {
        version: '16.9.56',
        packageName: '@types/react',
        files: [],
      },
    },
    'npm:@types/react-dom': {
      type: 'npm',
      name: 'npm:@types/react-dom',
      data: {
        version: '16.9.9',
        packageName: '@types/react-dom',
        files: [],
      },
    },
    'npm:@types/react-router-dom': {
      type: 'npm',
      name: 'npm:@types/react-router-dom',
      data: {
        version: '5.1.6',
        packageName: '@types/react-router-dom',
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
    'npm:codelyzer': {
      type: 'npm',
      name: 'npm:codelyzer',
      data: {
        version: '6.0.1',
        packageName: 'codelyzer',
        files: [],
      },
    },
    'npm:cypress': {
      type: 'npm',
      name: 'npm:cypress',
      data: {
        version: '^5.0.0',
        packageName: 'cypress',
        files: [],
      },
    },
    'npm:dotenv': {
      type: 'npm',
      name: 'npm:dotenv',
      data: {
        version: '10.0.0',
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
        version: '7.21.5',
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
    'npm:fuzzy': {
      type: 'npm',
      name: 'npm:fuzzy',
      data: {
        version: '^0.1.3',
        packageName: 'fuzzy',
        files: [],
      },
    },
    'npm:inquirer': {
      type: 'npm',
      name: 'npm:inquirer',
      data: {
        version: '^6.2.2',
        packageName: 'inquirer',
        files: [],
      },
    },
    'npm:inquirer-autocomplete-prompt': {
      type: 'npm',
      name: 'npm:inquirer-autocomplete-prompt',
      data: {
        version: '^1.0.1',
        packageName: 'inquirer-autocomplete-prompt',
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
    'npm:jest-environment-jsdom-fourteen': {
      type: 'npm',
      name: 'npm:jest-environment-jsdom-fourteen',
      data: {
        version: '^0.1.0',
        packageName: 'jest-environment-jsdom-fourteen',
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
    'npm:netlify': {
      type: 'npm',
      name: 'npm:netlify',
      data: {
        version: '^2.4.8',
        packageName: 'netlify',
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
        version: '9.1.1',
        packageName: 'ts-node',
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
    'npm:typescript': {
      type: 'npm',
      name: 'npm:typescript',
      data: {
        version: '4.0.3',
        packageName: 'typescript',
        files: [],
      },
    },
  },
  dependencies: {
    'products-product-detail-page': [
      {
        type: 'static',
        source: 'products-product-detail-page',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'products-product-detail-page',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'products-product-detail-page',
        target: 'npm:@ngrx/store',
      },
      {
        type: 'static',
        source: 'products-product-detail-page',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'products-product-detail-page',
        target: 'shared-product-state',
      },
      {
        type: 'static',
        source: 'products-product-detail-page',
        target: 'shared-product-ui',
      },
      {
        type: 'static',
        source: 'products-product-detail-page',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'products-product-detail-page',
        target: 'npm:jest',
      },
      {
        type: 'static',
        source: 'products-product-detail-page',
        target: 'npm:document-register-element',
      },
    ],
    'shared-product-types': [],
    'shared-product-state': [
      {
        type: 'static',
        source: 'shared-product-state',
        target: 'npm:@ngrx/store',
      },
      {
        type: 'static',
        source: 'shared-product-state',
        target: 'shared-product-data',
      },
      {
        type: 'static',
        source: 'shared-product-state',
        target: 'shared-product-types',
      },
      {
        type: 'static',
        source: 'shared-product-state',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'shared-product-state',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'shared-product-state',
        target: 'npm:jest',
      },
    ],
    'shared-product-data': [
      {
        type: 'static',
        source: 'shared-product-data',
        target: 'shared-product-types',
      },
    ],
    'products-home-page': [
      {
        type: 'static',
        source: 'products-home-page',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'products-home-page',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'products-home-page',
        target: 'npm:@ngrx/store',
      },
      {
        type: 'static',
        source: 'products-home-page',
        target: 'shared-product-state',
      },
      {
        type: 'static',
        source: 'products-home-page',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'products-home-page',
        target: 'shared-product-types',
      },
      {
        type: 'static',
        source: 'products-home-page',
        target: 'shared-product-ui',
      },
      {
        type: 'static',
        source: 'products-home-page',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'products-home-page',
        target: 'npm:jest',
      },
      {
        type: 'static',
        source: 'products-home-page',
        target: 'npm:document-register-element',
      },
    ],
    'shared-product-ui': [
      {
        type: 'static',
        source: 'shared-product-ui',
        target: 'shared-jsxify',
      },
      {
        type: 'static',
        source: 'shared-product-ui',
        target: 'npm:document-register-element',
      },
    ],
    'shared-cart-state': [
      {
        type: 'static',
        source: 'shared-cart-state',
        target: 'npm:@ngrx/store',
      },
      {
        type: 'static',
        source: 'shared-cart-state',
        target: 'shared-product-data',
      },
      {
        type: 'static',
        source: 'shared-cart-state',
        target: 'shared-product-state',
      },
      {
        type: 'static',
        source: 'shared-cart-state',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'shared-cart-state',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'shared-cart-state',
        target: 'npm:jest',
      },
    ],
    'shared-e2e-utils': [],
    'cart-cart-page': [
      {
        type: 'static',
        source: 'cart-cart-page',
        target: 'npm:react',
      },
      {
        type: 'static',
        source: 'cart-cart-page',
        target: 'npm:@testing-library/react',
      },
      {
        type: 'static',
        source: 'cart-cart-page',
        target: 'npm:@emotion/styled',
      },
      {
        type: 'static',
        source: 'cart-cart-page',
        target: 'shared-product-ui',
      },
      {
        type: 'static',
        source: 'cart-cart-page',
        target: 'shared-cart-state',
      },
      {
        type: 'static',
        source: 'cart-cart-page',
        target: 'shared-product-state',
      },
      {
        type: 'static',
        source: 'cart-cart-page',
        target: 'npm:document-register-element',
      },
    ],
    'shared-jsxify': [],
    'shared-assets': [],
    'shared-header': [
      {
        type: 'static',
        source: 'shared-header',
        target: 'shared-jsxify',
      },
      {
        type: 'static',
        source: 'shared-header',
        target: 'npm:document-register-element',
      },
    ],
    'shared-styles': [],
    'products-e2e': [
      {
        type: 'static',
        source: 'products-e2e',
        target: 'shared-e2e-utils',
      },
      {
        type: 'static',
        source: 'products-e2e',
        target: 'npm:@nrwl/cypress',
      },
      {
        type: 'implicit',
        source: 'products-e2e',
        target: 'products',
      },
    ],
    products: [
      {
        type: 'static',
        source: 'products',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'products',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'products',
        target: 'shared-header',
      },
      {
        type: 'static',
        source: 'products',
        target: 'npm:@angular/platform-browser',
      },
      {
        type: 'static',
        source: 'products',
        target: 'npm:@ngrx/store',
      },
      {
        type: 'dynamic',
        source: 'products',
        target: 'products-home-page',
      },
      {
        type: 'dynamic',
        source: 'products',
        target: 'products-product-detail-page',
      },
      {
        type: 'static',
        source: 'products',
        target: 'npm:zone.js',
      },
      {
        type: 'static',
        source: 'products',
        target: 'npm:jest',
      },
      {
        type: 'static',
        source: 'products',
        target: 'npm:document-register-element',
      },
      {
        type: 'implicit',
        source: 'products',
        target: 'shared-assets',
      },
      {
        type: 'implicit',
        source: 'products',
        target: 'shared-styles',
      },
    ],
    'cart-e2e': [
      {
        type: 'static',
        source: 'cart-e2e',
        target: 'shared-e2e-utils',
      },
      {
        type: 'static',
        source: 'cart-e2e',
        target: 'npm:@nrwl/cypress',
      },
      {
        type: 'implicit',
        source: 'cart-e2e',
        target: 'cart',
      },
    ],
    cart: [
      {
        type: 'static',
        source: 'cart',
        target: 'npm:react',
      },
      {
        type: 'static',
        source: 'cart',
        target: 'npm:@testing-library/react',
      },
      {
        type: 'static',
        source: 'cart',
        target: 'shared-header',
      },
      {
        type: 'static',
        source: 'cart',
        target: 'cart-cart-page',
      },
      {
        type: 'static',
        source: 'cart',
        target: 'npm:document-register-element',
      },
      {
        type: 'implicit',
        source: 'cart',
        target: 'shared-assets',
      },
      {
        type: 'implicit',
        source: 'cart',
        target: 'shared-styles',
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
    'npm:@emotion/babel-preset-css-prop': [],
    'npm:@emotion/react': [],
    'npm:@emotion/styled': [],
    'npm:@ngrx/component-store': [],
    'npm:@ngrx/effects': [],
    'npm:@ngrx/entity': [],
    'npm:@ngrx/router-store': [],
    'npm:@ngrx/store': [],
    'npm:@nrwl/angular': [],
    'npm:core-js': [],
    'npm:document-register-element': [],
    'npm:normalize.css': [],
    'npm:react': [],
    'npm:react-dom': [],
    'npm:react-router-dom': [],
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
    'npm:@babel/preset-react': [],
    'npm:@ngrx/store-devtools': [],
    'npm:@nrwl/cli': [],
    'npm:@nrwl/cypress': [],
    'npm:@nrwl/eslint-plugin-nx': [],
    'npm:@nrwl/jest': [],
    'npm:@nrwl/linter': [],
    'npm:@nrwl/nx-cloud': [],
    'npm:@nrwl/react': [],
    'npm:@nrwl/tao': [],
    'npm:@nrwl/web': [],
    'npm:@nrwl/workspace': [],
    'npm:@testing-library/react': [],
    'npm:@types/jest': [],
    'npm:@types/node': [],
    'npm:@types/react': [],
    'npm:@types/react-dom': [],
    'npm:@types/react-router-dom': [],
    'npm:@typescript-eslint/eslint-plugin': [],
    'npm:@typescript-eslint/parser': [],
    'npm:codelyzer': [],
    'npm:cypress': [],
    'npm:dotenv': [],
    'npm:eslint': [],
    'npm:eslint-config-prettier': [],
    'npm:eslint-plugin-cypress': [],
    'npm:eslint-plugin-import': [],
    'npm:eslint-plugin-jsx-a11y': [],
    'npm:eslint-plugin-react': [],
    'npm:eslint-plugin-react-hooks': [],
    'npm:fuzzy': [],
    'npm:inquirer': [],
    'npm:inquirer-autocomplete-prompt': [],
    'npm:jest': [],
    'npm:jest-environment-jsdom-fourteen': [],
    'npm:jest-preset-angular': [],
    'npm:netlify': [],
    'npm:prettier': [],
    'npm:ts-jest': [],
    'npm:ts-node': [],
    'npm:tslint': [],
    'npm:typescript': [],
  },
};
