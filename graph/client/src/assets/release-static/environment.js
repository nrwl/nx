window.exclude = [];
window.watch = false;
window.environment = 'release';
window.useXstateInspect = false;
window.localMode = 'build';

window.appConfig = {
  showDebugger: false,
  showExperimentalFeatures: false,
  workspaces: [
    {
      id: 'local',
      label: 'local',
      projectGraphUrl: 'assets/project-graphs/e2e.json',
      taskGraphUrl: 'assets/task-graphs/e2e.json',
    },
  ],
  defaultWorkspaceId: 'local',
};

window.projectGraphResponse = {
  hash: '081624f3bbc67c126e9dc313133c5a0138ae383da39f8793b26609698aea957b',
  projects: [
    {
      name: '@scoped/project-a',
      type: 'lib',
      data: {
        tags: [],
        root: 'libs/project-a',
        files: [],
      },
    },
    {
      name: '@scoped/project-b',
      type: 'lib',
      data: {
        tags: [],
        root: 'libs/project-a',
        files: [],
      },
    },
    {
      name: 'products-product-detail-page',
      type: 'lib',
      data: {
        tags: ['type:feature', 'scope:products'],
        root: 'libs/products/product-detail-page',
        files: [
          {
            file: 'libs/products/product-detail-page/.eslintrc.json',
            hash: '27519506e3b1095fc3d2395d0bc6163409573e27',
          },
          {
            file: 'libs/products/product-detail-page/jest.config.ts',
            hash: 'fbdaa40eee040e39d70fb462e5940cdeddb440c1',
          },
          {
            file: 'libs/products/product-detail-page/project.json',
            hash: '42d4e99947abf15b066725489c2d7762a9927c26',
          },
          {
            file: 'libs/products/product-detail-page/README.md',
            hash: 'f466b2f632d80578a70301ffb7dc7b99c1e5c918',
          },
          {
            file: 'libs/products/product-detail-page/src/index.ts',
            hash: '1f5976f2ae3b5938d9bd48e9b213a7bc4bce479c',
          },
          {
            file: 'libs/products/product-detail-page/src/lib/product-detail-page/product-detail-page.component.html',
            hash: 'fd5fa276dc13f789ae5d7a37703a296753aec8be',
          },
          {
            file: 'libs/products/product-detail-page/src/lib/product-detail-page/product-detail-page.component.scss',
            hash: '98fbca8900da6d5c5f6373558f5bd69efe190780',
          },
          {
            file: 'libs/products/product-detail-page/src/lib/product-detail-page/product-detail-page.component.spec.ts',
            hash: '0de2f97bbb2d8d9877b20f2a4024a3409021c652',
            deps: [
              'npm:@angular/core',
              'npm:@angular/router',
              'npm:@ngrx/store',
              'npm:rxjs',
              'shared-product-state',
            ],
          },
          {
            file: 'libs/products/product-detail-page/src/lib/product-detail-page/product-detail-page.component.ts',
            hash: 'c20bd27b12494827624a3835b1ec6475efaf0913',
            deps: [
              'npm:@angular/core',
              'npm:@angular/router',
              'npm:@ngrx/store',
              'npm:rxjs',
              'shared-product-state',
              'shared-product-ui',
            ],
          },
          {
            file: 'libs/products/product-detail-page/src/lib/products-product-detail-page.module.spec.ts',
            hash: '42049a1b8ea89bdc9bbad4be1fbb299d716bc327',
            deps: ['npm:@angular/core'],
          },
          {
            file: 'libs/products/product-detail-page/src/lib/products-product-detail-page.module.ts',
            hash: '3d77c3b1e639077f830ead6241e615da7f4fdf53',
            deps: [
              'npm:@angular/common',
              'npm:@angular/core',
              'npm:@angular/router',
              'shared-product-state',
            ],
          },
          {
            file: 'libs/products/product-detail-page/src/test-setup.ts',
            hash: 'f64f15cae181c8297512e03e30b2d2f7b7223f5b',
            deps: ['npm:jest-preset-angular', 'npm:document-register-element'],
          },
          {
            file: 'libs/products/product-detail-page/tsconfig.json',
            hash: '5602461b1ed724ed65200be5367ab1defdc871fc',
          },
          {
            file: 'libs/products/product-detail-page/tsconfig.lib.json',
            hash: '570fd66cb7ce59508cddedca0ef815a1c635315d',
          },
          {
            file: 'libs/products/product-detail-page/tsconfig.spec.json',
            hash: '34c38b0ec3a38a7cbd5c3e378ff421ad31e84efb',
          },
        ],
        targets: {
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'libs/products/product-detail-page/src/**/*.ts',
                'libs/products/product-detail-page/src/**/*.html',
              ],
            },
            outputs: ['{options.outputFile}'],
            inputs: ['default', '{workspaceRoot}/.eslintrc.json'],
          },
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/products/product-detail-page/jest.config.ts',
              passWithNoTests: true,
            },
            outputs: [
              '{workspaceRoot}/coverage/libs/products/product-detail-page',
            ],
            inputs: [
              'default',
              '^production',
              '{workspaceRoot}/jest.preset.js',
            ],
          },
        },
      },
    },
    {
      name: 'shared-product-state',
      type: 'lib',
      data: {
        tags: ['scope:shared', 'type:state'],
        root: 'libs/shared/product/state',
        files: [
          {
            file: 'libs/shared/product/state/.babelrc',
            hash: '0cae4a9a81270d6cf3315436f594bf2fbd4fb3e2',
          },
          {
            file: 'libs/shared/product/state/.eslintrc.json',
            hash: 'eee5f453593a2b8e7f865305029b7edc3449cca6',
          },
          {
            file: 'libs/shared/product/state/jest.config.ts',
            hash: '9184d1913ec49fa254d1ebdcffd99d31d07b5353',
          },
          {
            file: 'libs/shared/product/state/project.json',
            hash: 'a20fa0bc68211fd70e7d0f9d10afac0fd7b870ee',
          },
          {
            file: 'libs/shared/product/state/README.md',
            hash: '63538ffc745d3f82d93bcfbd61608057bf9cafaf',
          },
          {
            file: 'libs/shared/product/state/src/index.ts',
            hash: '0f1e1c9a63ae70e3c2cadd493263853511567dfd',
            deps: ['npm:@ngrx/store'],
          },
          {
            file: 'libs/shared/product/state/src/lib/+state/products.actions.ts',
            hash: '4c0efeeec1adfcecd34b20bda87fce5f24a64675',
            deps: ['npm:@ngrx/store'],
          },
          {
            file: 'libs/shared/product/state/src/lib/+state/products.reducer.spec.ts',
            hash: 'b2821f72394868ca503eb637f2891564851583eb',
            deps: ['npm:@ngrx/store', 'shared-product-data'],
          },
          {
            file: 'libs/shared/product/state/src/lib/+state/products.reducer.ts',
            hash: '9168586d19b76b0dd462dafbb5b6998c4da5ba53',
            deps: ['shared-product-data', 'shared-product-types'],
          },
          {
            file: 'libs/shared/product/state/src/lib/+state/products.selectors.spec.ts',
            hash: 'd22772ca82cb0f57a96d11fa3cb8f5a0e238c6d8',
            deps: ['shared-product-data'],
          },
          {
            file: 'libs/shared/product/state/src/lib/+state/products.selectors.ts',
            hash: 'da9e68bf4631ddb35e19659c3db04a0953a62a61',
          },
          {
            file: 'libs/shared/product/state/src/lib/shared-product-state.module.spec.ts',
            hash: '2aab0223be6028d16f8cddc8ac033b362eae21e2',
            deps: ['npm:@angular/core'],
          },
          {
            file: 'libs/shared/product/state/src/lib/shared-product-state.module.ts',
            hash: '45820bfa99997f35e6576d526fa228b7a5638cca',
            deps: [
              'npm:@angular/common',
              'npm:@angular/core',
              'npm:@ngrx/store',
            ],
          },
          {
            file: 'libs/shared/product/state/src/react.ts',
            hash: 'fa1cb4754b3dd584ba8ca23fe462c906f59945d6',
          },
          {
            file: 'libs/shared/product/state/src/test-setup.ts',
            hash: '1100b3e8a6ed08f4b5c27a96471846d57023c320',
            deps: ['npm:jest-preset-angular'],
          },
          {
            file: 'libs/shared/product/state/tsconfig.json',
            hash: 'a9a0b978b3edf84247a550ba82d8eea50dc8da68',
          },
          {
            file: 'libs/shared/product/state/tsconfig.lib.json',
            hash: '3b1fbbb954624d075826446e0060d243813ebcf1',
          },
          {
            file: 'libs/shared/product/state/tsconfig.spec.json',
            hash: '8603a008c3b77e77e142939e83e05e4a1043fbc6',
          },
        ],
        targets: {
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'libs/shared/product/state/src/**/*.ts',
                'libs/shared/product/state/src/**/*.html',
              ],
            },
            outputs: ['{options.outputFile}'],
            inputs: ['default', '{workspaceRoot}/.eslintrc.json'],
          },
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/shared/product/state/jest.config.ts',
              passWithNoTests: true,
            },
            outputs: ['{workspaceRoot}/coverage/libs/shared/product/state'],
            inputs: [
              'default',
              '^production',
              '{workspaceRoot}/jest.preset.js',
            ],
          },
        },
      },
    },
    {
      name: 'shared-product-types',
      type: 'lib',
      data: {
        tags: ['type:types', 'scope:shared'],
        root: 'libs/shared/product/types',
        files: [
          {
            file: 'libs/shared/product/types/.babelrc',
            hash: '0cae4a9a81270d6cf3315436f594bf2fbd4fb3e2',
          },
          {
            file: 'libs/shared/product/types/.eslintrc.json',
            hash: 'deb72aabdf74e23f16519b8cbeb5d63e769cd470',
          },
          {
            file: 'libs/shared/product/types/project.json',
            hash: 'ec241f2eb0e767417c03660a32c089a2d04436e4',
          },
          {
            file: 'libs/shared/product/types/README.md',
            hash: 'a3308045207635951262c7c81e93c4afafb484c4',
          },
          {
            file: 'libs/shared/product/types/src/index.ts',
            hash: '6b3cdd251890a858bace2be04ff2ef2920d68b76',
          },
          {
            file: 'libs/shared/product/types/src/lib/shared-product-types.ts',
            hash: '4f99c082564a63944be3e035c4ef47cc060b3af9',
          },
          {
            file: 'libs/shared/product/types/tsconfig.json',
            hash: 'e7879c9efcfa2e1c35b5373b03b4b7ea276795ac',
          },
          {
            file: 'libs/shared/product/types/tsconfig.lib.json',
            hash: 'a174cb09c30e46285517c7308247d602414aa63f',
          },
        ],
        targets: {
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'libs/shared/product/types/src/**/*.ts',
                'libs/shared/product/types/src/**/*.html',
              ],
            },
            outputs: ['{options.outputFile}'],
            inputs: ['default', '{workspaceRoot}/.eslintrc.json'],
          },
        },
      },
    },
    {
      name: 'shared-product-data',
      type: 'lib',
      data: {
        tags: ['type:data', 'scope:shared'],
        root: 'libs/shared/product/data',
        files: [
          {
            file: 'libs/shared/product/data/.babelrc',
            hash: '0cae4a9a81270d6cf3315436f594bf2fbd4fb3e2',
          },
          {
            file: 'libs/shared/product/data/.eslintrc.json',
            hash: '0576ff84e48f121399441a189bc1cd2a35fbca47',
          },
          {
            file: 'libs/shared/product/data/project.json',
            hash: '80c548ef891993c38d3ddd54f4d3895a11202b5a',
          },
          {
            file: 'libs/shared/product/data/README.md',
            hash: 'a433a7f8582e93329c762709f617d5d146b763f1',
          },
          {
            file: 'libs/shared/product/data/src/index.ts',
            hash: '0818cd09cdd02861b3319fd08cfcd2abf29539b4',
          },
          {
            file: 'libs/shared/product/data/src/lib/product-data.mock.ts',
            hash: 'dedcafc80a6cf40d3f644c8f88679b0182fd1c00',
          },
          {
            file: 'libs/shared/product/data/src/lib/shared-product-data.ts',
            hash: '37d51e532586fe98ac35c9236e8fd538718cf14f',
            deps: ['shared-product-types'],
          },
          {
            file: 'libs/shared/product/data/src/testing.ts',
            hash: 'd80ae5191bdb9c730883065e07d95876d1a701c9',
          },
          {
            file: 'libs/shared/product/data/tsconfig.json',
            hash: 'e7879c9efcfa2e1c35b5373b03b4b7ea276795ac',
          },
          {
            file: 'libs/shared/product/data/tsconfig.lib.json',
            hash: 'a174cb09c30e46285517c7308247d602414aa63f',
          },
        ],
        targets: {
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'libs/shared/product/data/src/**/*.ts',
                'libs/shared/product/data/src/**/*.html',
              ],
            },
            outputs: ['{options.outputFile}'],
            inputs: ['default', '{workspaceRoot}/.eslintrc.json'],
          },
        },
      },
    },
    {
      name: 'products-home-page',
      type: 'lib',
      data: {
        tags: ['scope:products', 'type:feature'],
        root: 'libs/products/home-page',
        files: [
          {
            file: 'libs/products/home-page/.eslintrc.json',
            hash: '9384bd8cee7cccbdde43abbc051ecf6cef35b256',
          },
          {
            file: 'libs/products/home-page/jest.config.ts',
            hash: '811538b0e4b2bddada064484783eb1d3e8a9b947',
          },
          {
            file: 'libs/products/home-page/project.json',
            hash: 'c86b3756dcd29b22cd576544ee6d33bdccc664f2',
          },
          {
            file: 'libs/products/home-page/README.md',
            hash: '722e60a3b9690fe6d2bc9f0e85b114a3048ca9d0',
          },
          {
            file: 'libs/products/home-page/src/index.ts',
            hash: '0e7f9ca26e66d7aa35a83cd8e957248ef5bb1240',
          },
          {
            file: 'libs/products/home-page/src/lib/home-page/home-page.component.html',
            hash: '8bd27770e5974269e766d95762fef74b5bd89841',
          },
          {
            file: 'libs/products/home-page/src/lib/home-page/home-page.component.scss',
            hash: 'ba4f1655a2c0791670384de48367caded0d6e601',
          },
          {
            file: 'libs/products/home-page/src/lib/home-page/home-page.component.spec.ts',
            hash: '87d1216af1f7737913862e6ddeaadebad62791e5',
            deps: [
              'npm:@angular/core',
              'npm:@angular/router',
              'npm:@ngrx/store',
              'shared-product-state',
            ],
          },
          {
            file: 'libs/products/home-page/src/lib/home-page/home-page.component.ts',
            hash: 'bd081eedbf10a2cd04c95609379d131e5e8d60a1',
            deps: [
              'npm:@angular/core',
              'npm:@ngrx/store',
              'npm:rxjs',
              'shared-product-state',
              'shared-product-types',
              'shared-product-ui',
            ],
          },
          {
            file: 'libs/products/home-page/src/lib/products-home-page.module.spec.ts',
            hash: '8cb2bfc9f5de5af9800855b4945b103d115b14ba',
            deps: ['npm:@angular/core'],
          },
          {
            file: 'libs/products/home-page/src/lib/products-home-page.module.ts',
            hash: '7f4fdd952cc9cf060895ac58572039cde80237e3',
            deps: [
              'npm:@angular/common',
              'npm:@angular/core',
              'npm:@angular/router',
              'shared-product-state',
            ],
          },
          {
            file: 'libs/products/home-page/src/test-setup.ts',
            hash: 'f64f15cae181c8297512e03e30b2d2f7b7223f5b',
            deps: ['npm:jest-preset-angular', 'npm:document-register-element'],
          },
          {
            file: 'libs/products/home-page/tsconfig.json',
            hash: '5602461b1ed724ed65200be5367ab1defdc871fc',
          },
          {
            file: 'libs/products/home-page/tsconfig.lib.json',
            hash: '570fd66cb7ce59508cddedca0ef815a1c635315d',
          },
          {
            file: 'libs/products/home-page/tsconfig.spec.json',
            hash: '34c38b0ec3a38a7cbd5c3e378ff421ad31e84efb',
          },
        ],
        targets: {
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'libs/products/home-page/src/**/*.ts',
                'libs/products/home-page/src/**/*.html',
              ],
            },
            outputs: ['{options.outputFile}'],
            inputs: ['default', '{workspaceRoot}/.eslintrc.json'],
          },
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/products/home-page/jest.config.ts',
              passWithNoTests: true,
            },
            outputs: ['{workspaceRoot}/coverage/libs/products/home-page'],
            inputs: [
              'default',
              '^production',
              '{workspaceRoot}/jest.preset.js',
            ],
          },
        },
      },
    },
    {
      name: 'shared-cart-state',
      type: 'lib',
      data: {
        tags: ['scope:shared', 'type:state'],
        root: 'libs/shared/cart/state',
        files: [
          {
            file: 'libs/shared/cart/state/.babelrc',
            hash: '0cae4a9a81270d6cf3315436f594bf2fbd4fb3e2',
          },
          {
            file: 'libs/shared/cart/state/.eslintrc.json',
            hash: '57932578e6df8f4a907a78abde0e3f5a7d84fc6f',
          },
          {
            file: 'libs/shared/cart/state/jest.config.ts',
            hash: '8357457b34280e715a5f5832b115ab6bf2681c31',
          },
          {
            file: 'libs/shared/cart/state/project.json',
            hash: '3b4d33c71ca6e4f66c9aeb6033af81a185df440c',
          },
          {
            file: 'libs/shared/cart/state/README.md',
            hash: '38627fdbb83e5984c84fd1d5895815907d4dea30',
          },
          {
            file: 'libs/shared/cart/state/src/index.ts',
            hash: 'a3b86be1438b7b7cdccb3bc7e76aadfe577fc285',
          },
          {
            file: 'libs/shared/cart/state/src/lib/+state/cart.actions.ts',
            hash: '3cff41aacb72ee50cf5844662ac1b77b78805ac4',
            deps: ['npm:@ngrx/store'],
          },
          {
            file: 'libs/shared/cart/state/src/lib/+state/cart.reducer.spec.ts',
            hash: 'b375658695c3ead82ffc558d5dfbf30c42fc84d6',
          },
          {
            file: 'libs/shared/cart/state/src/lib/+state/cart.reducer.ts',
            hash: '0583a02da1ed94e29a9ab4b8f310bad9c069962c',
          },
          {
            file: 'libs/shared/cart/state/src/lib/+state/cart.selectors.spec.ts',
            hash: '77cc9170d1302e0a84409885d81c3c59fd1226a6',
            deps: ['shared-product-data', 'shared-product-state'],
          },
          {
            file: 'libs/shared/cart/state/src/lib/+state/cart.selectors.ts',
            hash: '5ff6eaec6dc3d341327f2e46c5fffa30a924ba71',
            deps: ['shared-product-state'],
          },
          {
            file: 'libs/shared/cart/state/src/lib/shared-cart-state.module.spec.ts',
            hash: 'e4e845c3c52dc39e06358bf83a729827fe652da5',
            deps: ['npm:@angular/core'],
          },
          {
            file: 'libs/shared/cart/state/src/lib/shared-cart-state.module.ts',
            hash: 'f4b3a218c98c9aa7c0eb5828b5085826d174144a',
            deps: [
              'npm:@angular/common',
              'npm:@angular/core',
              'npm:@ngrx/store',
            ],
          },
          {
            file: 'libs/shared/cart/state/src/react.ts',
            hash: '38949f62ee8e55134c593a046372bc89ea58d266',
          },
          {
            file: 'libs/shared/cart/state/src/test-setup.ts',
            hash: '1100b3e8a6ed08f4b5c27a96471846d57023c320',
            deps: ['npm:jest-preset-angular'],
          },
          {
            file: 'libs/shared/cart/state/tsconfig.json',
            hash: 'a9a0b978b3edf84247a550ba82d8eea50dc8da68',
          },
          {
            file: 'libs/shared/cart/state/tsconfig.lib.json',
            hash: '3b1fbbb954624d075826446e0060d243813ebcf1',
          },
          {
            file: 'libs/shared/cart/state/tsconfig.spec.json',
            hash: '8603a008c3b77e77e142939e83e05e4a1043fbc6',
          },
        ],
        targets: {
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'libs/shared/cart/state/src/**/*.ts',
                'libs/shared/cart/state/src/**/*.html',
              ],
            },
            outputs: ['{options.outputFile}'],
            inputs: ['default', '{workspaceRoot}/.eslintrc.json'],
          },
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/shared/cart/state/jest.config.ts',
              passWithNoTests: true,
            },
            outputs: ['{workspaceRoot}/coverage/libs/shared/cart/state'],
            inputs: [
              'default',
              '^production',
              '{workspaceRoot}/jest.preset.js',
            ],
          },
        },
      },
    },
    {
      name: 'shared-product-ui',
      type: 'lib',
      data: {
        tags: ['scope:shared', 'type:ui'],
        root: 'libs/shared/product/ui',
        files: [
          {
            file: 'libs/shared/product/ui/.babelrc',
            hash: '0cae4a9a81270d6cf3315436f594bf2fbd4fb3e2',
          },
          {
            file: 'libs/shared/product/ui/.eslintrc.json',
            hash: 'f27e8c332d321de90c56395d24b45a2b68d1b52b',
          },
          {
            file: 'libs/shared/product/ui/jest.config.ts',
            hash: '262c1e746be37cbce13b006e6add33401b105a3e',
          },
          {
            file: 'libs/shared/product/ui/project.json',
            hash: '9d65033c934da25789eb1296c837875c5478835e',
          },
          {
            file: 'libs/shared/product/ui/README.md',
            hash: 'e6943fb94ddb0a94513d68f4586098581172fcf4',
          },
          {
            file: 'libs/shared/product/ui/src/index.ts',
            hash: '58b274ad76843b50333fc6d5cb9272d0f17d901d',
          },
          {
            file: 'libs/shared/product/ui/src/lib/product-price/product-price.element.spec.ts',
            hash: '34be17f44c09cfa01a9fd4dc7ada68c7bafded6e',
          },
          {
            file: 'libs/shared/product/ui/src/lib/product-price/product-price.element.ts',
            hash: 'd5bce1a0d9c72a0fa16fb42b46cc89d96c751dd1',
            deps: ['shared-jsxify'],
          },
          {
            file: 'libs/shared/product/ui/src/test-setup.ts',
            hash: 'd8508d703266e7390b30189d3cf7fec7a70b198c',
            deps: ['npm:document-register-element'],
          },
          {
            file: 'libs/shared/product/ui/tsconfig.json',
            hash: 'd32f55e3999447ae24e89f0e76d8c3128113c85e',
          },
          {
            file: 'libs/shared/product/ui/tsconfig.lib.json',
            hash: '7c7688b3df9330c9e0768df1c4701e55add00a40',
          },
          {
            file: 'libs/shared/product/ui/tsconfig.spec.json',
            hash: '515fdb6e5dd4291dc308b7aee7a45b72c83a1b1d',
          },
        ],
        targets: {
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'libs/shared/product/ui/src/**/*.ts',
                'libs/shared/product/ui/src/**/*.html',
              ],
            },
            outputs: ['{options.outputFile}'],
            inputs: ['default', '{workspaceRoot}/.eslintrc.json'],
          },
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/shared/product/ui/jest.config.ts',
              passWithNoTests: true,
            },
            outputs: ['{workspaceRoot}/coverage/libs/shared/product/ui'],
            inputs: [
              'default',
              '^production',
              '{workspaceRoot}/jest.preset.js',
            ],
          },
        },
      },
    },
    {
      name: 'shared-e2e-utils',
      type: 'lib',
      data: {
        tags: ['scope:shared', 'type:e2e-utils'],
        root: 'libs/shared/e2e-utils',
        files: [
          {
            file: 'libs/shared/e2e-utils/.eslintrc.json',
            hash: 'b7d8fbb6b72b612119154a18b2142c8f41e1f6a5',
          },
          {
            file: 'libs/shared/e2e-utils/project.json',
            hash: 'e077c497a78208159de9916630421b54d559ed29',
          },
          {
            file: 'libs/shared/e2e-utils/README.md',
            hash: '4864d1fe9daeac7441673144997eb93f38a451a7',
          },
          {
            file: 'libs/shared/e2e-utils/src/index.ts',
            hash: '5f637af2f9a45117b16185c0d2d49bb7ae082e8c',
          },
          {
            file: 'libs/shared/e2e-utils/src/lib/shared-e2e-utils.ts',
            hash: '69aae501c209457bd9a504344fcc262cb2c452a6',
          },
          {
            file: 'libs/shared/e2e-utils/tsconfig.json',
            hash: '662468f8e66527570a90c88435fb3fe322200c55',
          },
          {
            file: 'libs/shared/e2e-utils/tsconfig.lib.json',
            hash: '0fe9966358eb51092a1668ecb0795b6db52a538b',
          },
        ],
        targets: {
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'libs/shared/e2e-utils/src/**/*.ts',
                'libs/shared/e2e-utils/src/**/*.html',
              ],
            },
            outputs: ['{options.outputFile}'],
            inputs: ['default', '{workspaceRoot}/.eslintrc.json'],
          },
        },
      },
    },
    {
      name: 'cart-cart-page',
      type: 'lib',
      data: {
        tags: ['scope:cart', 'type:feature'],
        root: 'libs/cart/cart-page',
        files: [
          {
            file: 'libs/cart/cart-page/.babelrc',
            hash: '2563bbc7a3a07754d9cce33fed581595cefca651',
          },
          {
            file: 'libs/cart/cart-page/.eslintrc.json',
            hash: '0790d98fc5188ef5b9707e0a47792b30e87f807f',
          },
          {
            file: 'libs/cart/cart-page/jest.config.ts',
            hash: 'cfd45fc556295c42c6b09f864a82309d649e452f',
          },
          {
            file: 'libs/cart/cart-page/project.json',
            hash: '71171beb6956bca200936f59feb711d552a3e998',
          },
          {
            file: 'libs/cart/cart-page/README.md',
            hash: 'e849e84b78b7b1c409567b4dadebf54b1ef45ca6',
          },
          {
            file: 'libs/cart/cart-page/src/index.ts',
            hash: 'ad4674d7e1cfad04953cff1084cb229d81bcfa94',
          },
          {
            file: 'libs/cart/cart-page/src/lib/cart-cart-page/cart-cart-page.spec.tsx',
            hash: '496df785798bd335433efac1ce9b63f4837d8862',
            deps: ['npm:@testing-library/react'],
          },
          {
            file: 'libs/cart/cart-page/src/lib/cart-cart-page/cart-cart-page.tsx',
            hash: '384ca9a17a3379dfacf6a6c4fb672d0b6f223997',
            deps: [
              'npm:react',
              'npm:@emotion/styled',
              'shared-product-ui',
              'shared-cart-state',
              'shared-product-state',
            ],
          },
          {
            file: 'libs/cart/cart-page/src/test-setup.ts',
            hash: 'd8508d703266e7390b30189d3cf7fec7a70b198c',
            deps: ['npm:document-register-element'],
          },
          {
            file: 'libs/cart/cart-page/tsconfig.json',
            hash: 'cd38e3e04409f21cefb92c2531b7f539fc2db14d',
          },
          {
            file: 'libs/cart/cart-page/tsconfig.lib.json',
            hash: '8dcf07ce29e8bca717ce2672fb9f2ac5c9ab0556',
          },
          {
            file: 'libs/cart/cart-page/tsconfig.spec.json',
            hash: 'e1535ba9d07c38511f465f5427c9c5a39ab3b174',
          },
        ],
        targets: {
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'libs/cart/cart-page/src/**/*.ts',
                'libs/cart/cart-page/src/**/*.html',
              ],
            },
            outputs: ['{options.outputFile}'],
            inputs: ['default', '{workspaceRoot}/.eslintrc.json'],
          },
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/cart/cart-page/jest.config.ts',
              passWithNoTests: true,
            },
            outputs: ['{workspaceRoot}/coverage/libs/cart/cart-page'],
            inputs: [
              'default',
              '^production',
              '{workspaceRoot}/jest.preset.js',
            ],
          },
        },
      },
    },
    {
      name: 'shared-assets',
      type: 'lib',
      data: {
        tags: ['type:assets', 'scope:shared'],
        root: 'libs/shared/assets',
        files: [
          {
            file: 'libs/shared/assets/project.json',
            hash: 'b93b2d10b9a3045412cacb514e5f23c7b11da141',
          },
          {
            file: 'libs/shared/assets/README.md',
            hash: '11891734c3dc348bc38c587824ce3334fc9eb5f0',
          },
          {
            file: 'libs/shared/assets/src/assets/icons/github.png',
            hash: '73db1f61f3aa55fcaecbca896dbea067706bb7bd',
          },
          {
            file: 'libs/shared/assets/src/assets/images/a-clash-of-kings.jpg',
            hash: 'be2863c3a3eb291cac921028af72604af00dd362',
          },
          {
            file: 'libs/shared/assets/src/assets/images/a-dance-with-dragons.jpg',
            hash: 'ea6706f36b4e3a579bd97b8e506fbc7345ef8635',
          },
          {
            file: 'libs/shared/assets/src/assets/images/a-feast-for-crows.jpg',
            hash: '1bd6e8f85bb741aca00d0bf9d6c87ddb1e96c97e',
          },
          {
            file: 'libs/shared/assets/src/assets/images/a-game-of-thrones.jpg',
            hash: '2fc1452579133fbc3e02c822e5d14beeaae09d0d',
          },
          {
            file: 'libs/shared/assets/src/assets/images/a-storm-of-swords.jpg',
            hash: '0abd5a19762f2766ab86c192eafad4acf1ca66db',
          },
          {
            file: 'libs/shared/assets/src/favicon.ico',
            hash: '317ebcb2336e0833a22dddf0ab287849f26fda57',
          },
        ],
        targets: {},
      },
    },
    {
      name: 'shared-header',
      type: 'lib',
      data: {
        tags: ['scope:shared', 'type:ui'],
        root: 'libs/shared/header',
        files: [
          {
            file: 'libs/shared/header/.babelrc',
            hash: '0cae4a9a81270d6cf3315436f594bf2fbd4fb3e2',
          },
          {
            file: 'libs/shared/header/.eslintrc.json',
            hash: 'c1ddeb2aa5bf964a05e628e2137c4ac513c59a7e',
          },
          {
            file: 'libs/shared/header/index.scss',
            hash: '09fd44fea0cd18509c0e77aa5522c65590df0448',
          },
          {
            file: 'libs/shared/header/jest.config.ts',
            hash: '77a96b3c6ffd4f4b946c1a8558bf2187a03c958e',
          },
          {
            file: 'libs/shared/header/project.json',
            hash: '14708a09900f151639b589916200638b2dcb794a',
          },
          {
            file: 'libs/shared/header/README.md',
            hash: '7a9c74dbe1c14e5b710aa03cf0a0013ebdce39e2',
          },
          {
            file: 'libs/shared/header/src/index.ts',
            hash: '720634b61b9010b5ba7a58169a8f1e99853aa604',
          },
          {
            file: 'libs/shared/header/src/lib/header/header.element.scss',
            hash: 'd13956172eb5f11b6fe4f5e616c057be3bc12578',
          },
          {
            file: 'libs/shared/header/src/lib/header/header.element.spec.ts',
            hash: '2e410dcfcce6c2e15cdbe8382463d64bc2724af6',
          },
          {
            file: 'libs/shared/header/src/lib/header/header.element.ts',
            hash: 'f1cd2d856aa0551ab01c99bb457f0c82bafcb32a',
            deps: ['shared-jsxify'],
          },
          {
            file: 'libs/shared/header/src/test-setup.ts',
            hash: 'd8508d703266e7390b30189d3cf7fec7a70b198c',
            deps: ['npm:document-register-element'],
          },
          {
            file: 'libs/shared/header/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
          },
          {
            file: 'libs/shared/header/tsconfig.lib.json',
            hash: '20057947e016b3c54734e67901bb1663770adee7',
          },
          {
            file: 'libs/shared/header/tsconfig.spec.json',
            hash: 'e1535ba9d07c38511f465f5427c9c5a39ab3b174',
          },
        ],
        targets: {
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'libs/shared/header/src/**/*.ts',
                'libs/shared/header/src/**/*.html',
              ],
            },
            outputs: ['{options.outputFile}'],
            inputs: ['default', '{workspaceRoot}/.eslintrc.json'],
          },
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/shared/header/jest.config.ts',
              passWithNoTests: true,
            },
            outputs: ['{workspaceRoot}/coverage/libs/shared/header'],
            inputs: [
              'default',
              '^production',
              '{workspaceRoot}/jest.preset.js',
            ],
          },
        },
      },
    },
    {
      name: 'shared-jsxify',
      type: 'lib',
      data: {
        tags: ['scope:shared', 'type:types'],
        root: 'libs/shared/jsxify',
        files: [
          {
            file: 'libs/shared/jsxify/.babelrc',
            hash: '0cae4a9a81270d6cf3315436f594bf2fbd4fb3e2',
          },
          {
            file: 'libs/shared/jsxify/.eslintrc.json',
            hash: '956fcc640babc6d52c6c2370616b71d5fa4b5a7a',
          },
          {
            file: 'libs/shared/jsxify/project.json',
            hash: '66516b22ad23916198867727fbe745c5c4cf948a',
          },
          {
            file: 'libs/shared/jsxify/README.md',
            hash: '80d053e1b10cef1a553c10a78969b7f5b77dc53a',
          },
          {
            file: 'libs/shared/jsxify/src/index.ts',
            hash: 'c83bdb671f875f391277ac69a5468fab6a07b2af',
          },
          {
            file: 'libs/shared/jsxify/src/lib/shared-jsxify.ts',
            hash: '2343cbc0ee3a4399b277720ae516575b00415f4e',
          },
          {
            file: 'libs/shared/jsxify/tsconfig.json',
            hash: '98a51da43d2d67b63a8e74ae657686858277e9f7',
          },
          {
            file: 'libs/shared/jsxify/tsconfig.lib.json',
            hash: '0fe9966358eb51092a1668ecb0795b6db52a538b',
          },
        ],
        targets: {
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: [
                'libs/shared/jsxify/src/**/*.ts',
                'libs/shared/jsxify/src/**/*.html',
              ],
            },
            outputs: ['{options.outputFile}'],
            inputs: ['default', '{workspaceRoot}/.eslintrc.json'],
          },
        },
      },
    },
    {
      name: 'shared-styles',
      type: 'lib',
      data: {
        tags: ['scope:shared', 'type:styles'],
        root: 'libs/shared/styles',
        files: [
          {
            file: 'libs/shared/styles/project.json',
            hash: 'cc7c3f7a747b90917f018d6ee7b5c6005ca235f8',
          },
          {
            file: 'libs/shared/styles/README.md',
            hash: '726adf41353f106db057050b4b8d0e8784c6eed5',
          },
          {
            file: 'libs/shared/styles/src/index.scss',
            hash: '4242c2389d84fc3062a84cddb0f6b94427304803',
          },
          {
            file: 'libs/shared/styles/src/lib/global.scss',
            hash: '55caa35d877ea8028f97134fa985a0b7e772f963',
          },
        ],
        targets: {},
      },
    },
    {
      name: 'products-e2e',
      type: 'e2e',
      data: {
        tags: ['scope:products', 'type:e2e'],
        root: 'apps/products-e2e',
        files: [
          {
            file: 'apps/products-e2e/.eslintrc.json',
            hash: 'e7caab63fbef52bb000835acbb23935cb48203a0',
          },
          {
            file: 'apps/products-e2e/cypress.config.ts',
            hash: 'c80242149987121c164a3e239abe178abc8d4a07',
            deps: ['npm:cypress', 'npm:@nrwl/cypress'],
          },
          {
            file: 'apps/products-e2e/project.json',
            hash: '04a971a513446ab9f533d2bc5b71f4c0f6701026',
          },
          {
            file: 'apps/products-e2e/src/e2e/app.cy.ts',
            hash: 'b83b44ff82a9b4afd01aff30386219a8779c80d8',
            deps: ['shared-e2e-utils'],
          },
          {
            file: 'apps/products-e2e/src/fixtures/example.json',
            hash: '294cbed6ce9e0b948b787452e8676aee486cb3be',
          },
          {
            file: 'apps/products-e2e/src/support/app.po.ts',
            hash: 'd5ac94199b3e68be5782c883344f00c90bfd07a9',
          },
          {
            file: 'apps/products-e2e/src/support/commands.ts',
            hash: 'ca4d256f3eb15dfabad1f5760c9b2d0ceb4c24b9',
          },
          {
            file: 'apps/products-e2e/src/support/e2e.ts',
            hash: '3d469a6b6cf31eb66117d73e278bcf74f398f1db',
          },
          {
            file: 'apps/products-e2e/tsconfig.json',
            hash: 'cc509a730e12498509bb7475f6f54b1a18021191',
          },
        ],
        targets: {
          e2e: {
            executor: '@nrwl/cypress:cypress',
            options: {
              cypressConfig: 'apps/products-e2e/cypress.config.ts',
              devServerTarget: 'products:serve',
              testingType: 'e2e',
            },
            configurations: {
              production: {
                devServerTarget: 'products:serve:production',
              },
            },
            inputs: ['default', '^production'],
          },
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: ['apps/products-e2e/**/*.{js,ts}'],
            },
            outputs: ['{options.outputFile}'],
            inputs: ['default', '{workspaceRoot}/.eslintrc.json'],
          },
        },
      },
    },
    {
      name: 'cart-e2e',
      type: 'e2e',
      data: {
        tags: ['scope:cart', 'type:e2e'],
        root: 'apps/cart-e2e',
        files: [
          {
            file: 'apps/cart-e2e/.eslintrc.json',
            hash: '082395fbd03ae178157f9ebd4d374d208fd254f8',
          },
          {
            file: 'apps/cart-e2e/cypress.config.ts',
            hash: 'f292e4c8c9a6268418b17d7ff125bef64c961a4c',
            deps: ['npm:cypress', 'npm:@nrwl/cypress'],
          },
          {
            file: 'apps/cart-e2e/project.json',
            hash: 'a11acd168cdf5221917f96403e470b585420ead9',
          },
          {
            file: 'apps/cart-e2e/src/e2e/app.cy.ts',
            hash: '2971885c601f09176516333d80a59f6e61ceaf9f',
            deps: ['shared-e2e-utils'],
          },
          {
            file: 'apps/cart-e2e/src/fixtures/example.json',
            hash: '294cbed6ce9e0b948b787452e8676aee486cb3be',
          },
          {
            file: 'apps/cart-e2e/src/support/app.po.ts',
            hash: 'c29f04f1c8d7c8722fbf705b3d951333c4fb95fc',
          },
          {
            file: 'apps/cart-e2e/src/support/commands.ts',
            hash: 'ca4d256f3eb15dfabad1f5760c9b2d0ceb4c24b9',
          },
          {
            file: 'apps/cart-e2e/src/support/e2e.ts',
            hash: '3d469a6b6cf31eb66117d73e278bcf74f398f1db',
          },
          {
            file: 'apps/cart-e2e/tsconfig.json',
            hash: 'cc509a730e12498509bb7475f6f54b1a18021191',
          },
        ],
        targets: {
          e2e: {
            executor: '@nrwl/cypress:cypress',
            options: {
              cypressConfig: 'apps/cart-e2e/cypress.config.ts',
              devServerTarget: 'cart:serve',
              testingType: 'e2e',
            },
            configurations: {
              production: {
                devServerTarget: 'cart:serve:production',
              },
            },
            inputs: ['default', '^production'],
          },
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: ['apps/cart-e2e/**/*.{ts,tsx,js,jsx}'],
            },
            outputs: ['{options.outputFile}'],
            inputs: ['default', '{workspaceRoot}/.eslintrc.json'],
          },
        },
      },
    },
    {
      name: 'products',
      type: 'app',
      data: {
        tags: ['type:app', 'scope:products'],
        root: 'apps/products',
        files: [
          {
            file: 'apps/products/.browserslistrc',
            hash: '80848532e47d58cc7a4b618f600b438960f9f045',
          },
          {
            file: 'apps/products/.eslintrc.json',
            hash: '09bf85ffde1b09ba5ee6a114f2ceeb11a4a892d1',
          },
          {
            file: 'apps/products/jest.config.ts',
            hash: '699704d393fd19b2ea2681b4e124b86008ef70c9',
          },
          {
            file: 'apps/products/project.json',
            hash: 'c9dd3f0c4c4bf71a315c90c02e1f182241337532',
          },
          {
            file: 'apps/products/src/_redirects',
            hash: '7cbf76be95b720c89c7602ff8497c030004460a0',
          },
          {
            file: 'apps/products/src/app/app.component.html',
            hash: 'bb3f473b9bbce44012333d96f9e2a741f11eeda7',
          },
          {
            file: 'apps/products/src/app/app.component.scss',
            hash: '6c2cb68a16e0dbc48ec5497bffe3db6c83a08171',
          },
          {
            file: 'apps/products/src/app/app.component.spec.ts',
            hash: '1f8a9866829d1ca8d1b82fd6db943428bbde8e65',
            deps: ['npm:@angular/core', 'npm:@angular/router'],
          },
          {
            file: 'apps/products/src/app/app.component.ts',
            hash: 'ff3c08d367bbffd1a0467e9f6925f9fe16d7e81d',
            deps: ['npm:@angular/core', 'shared-header'],
          },
          {
            file: 'apps/products/src/app/app.module.ts',
            hash: '814f3c4b6aa21425d7aabb8ff7b31fdc6999a5ae',
            deps: [
              'npm:@angular/core',
              'npm:@angular/platform-browser',
              'npm:@angular/router',
              'npm:@ngrx/store',
              'products-home-page',
              'products-product-detail-page',
            ],
          },
          {
            file: 'apps/products/src/assets/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
          },
          {
            file: 'apps/products/src/environments/environment.prod.ts',
            hash: 'c9669790be176ac85a5d8c11278875c2f52dc507',
          },
          {
            file: 'apps/products/src/environments/environment.ts',
            hash: '99c3763cad6f4ae7808a34e2aa4e5b90232c67fc',
          },
          {
            file: 'apps/products/src/favicon.ico',
            hash: '8081c7ceaf2be08bf59010158c586170d9d2d517',
          },
          {
            file: 'apps/products/src/index.html',
            hash: 'ab6b7852619b9523b4bce50a50f04f4b92612878',
          },
          {
            file: 'apps/products/src/main.ts',
            hash: 'd9a2e7e4a582e265db779363bd8b2492c43c141b',
            deps: [
              'npm:@angular/core',
              'npm:@angular/platform-browser-dynamic',
            ],
          },
          {
            file: 'apps/products/src/polyfills.ts',
            hash: 'ba5c6215cc8aa033abfbd17e0b0192123796b459',
            deps: ['npm:zone.js'],
          },
          {
            file: 'apps/products/src/test-setup.ts',
            hash: 'f64f15cae181c8297512e03e30b2d2f7b7223f5b',
            deps: ['npm:jest-preset-angular', 'npm:document-register-element'],
          },
          {
            file: 'apps/products/tsconfig.app.json',
            hash: '24df375823651e81665dd43e74f8cbd86637b00f',
          },
          {
            file: 'apps/products/tsconfig.editor.json',
            hash: '1bf3c0a7455d9f0731999e8ef4486967bbf3c0aa',
          },
          {
            file: 'apps/products/tsconfig.json',
            hash: '0eb8182debea7532f14b80b7c289ab7b66fc2aef',
          },
          {
            file: 'apps/products/tsconfig.spec.json',
            hash: 'b6347c6f667d5628388e11529377a125758fbe61',
          },
        ],
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
            dependsOn: ['^build'],
            inputs: ['production', '^production'],
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
            outputs: ['{options.outputFile}'],
            inputs: ['default', '{workspaceRoot}/.eslintrc.json'],
          },
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'apps/products/jest.config.ts',
              passWithNoTests: true,
            },
            outputs: ['{workspaceRoot}/coverage/apps/products'],
            inputs: [
              'default',
              '^production',
              '{workspaceRoot}/jest.preset.js',
            ],
          },
          deploy: {
            executor: 'nx:run-commands',
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
      },
    },
    {
      name: 'cart',
      type: 'app',
      data: {
        tags: ['type:app', 'scope:cart'],
        root: 'apps/cart',
        files: [
          {
            file: 'apps/cart/.babelrc',
            hash: '61641ec8ac3659e204441c80bb06defe323e3110',
          },
          {
            file: 'apps/cart/.eslintrc.json',
            hash: '4e6e0b82073fa77dc1c5b2f926d5d9d5d3cf2585',
          },
          {
            file: 'apps/cart/browserlist',
            hash: '37371cb04b9f1986d952499cdf9613c9d5d8ca8c',
          },
          {
            file: 'apps/cart/jest.config.ts',
            hash: 'af92cac53c45ca46b882c00a5f87d486a2755986',
          },
          {
            file: 'apps/cart/project.json',
            hash: 'd2d823c49d47b0c373c1e639acaa2d939a0bdfb1',
          },
          {
            file: 'apps/cart/src/_redirects',
            hash: '50d93f23ab427b2911555db1a5c9a023293f470a',
          },
          {
            file: 'apps/cart/src/app/app.spec.tsx',
            hash: 'be06392eb51b8d8fd62a0c3dc8c4fa3c8ee76aca',
            deps: ['npm:react-router-dom', 'npm:@testing-library/react'],
          },
          {
            file: 'apps/cart/src/app/app.tsx',
            hash: 'e971864bdab1bea4c48550c2ab1d9e0e8489e753',
            deps: ['npm:react-router-dom', 'shared-header', 'cart-cart-page'],
          },
          {
            file: 'apps/cart/src/assets/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
          },
          {
            file: 'apps/cart/src/environments/environment.prod.ts',
            hash: 'c9669790be176ac85a5d8c11278875c2f52dc507',
          },
          {
            file: 'apps/cart/src/environments/environment.ts',
            hash: '7ed83767fff25adfed19d52b2821a432f8ed18b1',
          },
          {
            file: 'apps/cart/src/favicon.ico',
            hash: 'a11777cc471a4344702741ab1c8a588998b1311a',
          },
          {
            file: 'apps/cart/src/index.html',
            hash: '1a7a74ec69f2b7a86ee7918f412e25edff23ebfb',
          },
          {
            file: 'apps/cart/src/main.tsx',
            hash: '7991369e387a2b974b678a86c6eb006fd9757d8e',
            deps: ['npm:react-dom', 'npm:react-router-dom'],
          },
          {
            file: 'apps/cart/src/polyfills.ts',
            hash: '83926853099fe077c00663db9909f25c9a3b769d',
          },
          {
            file: 'apps/cart/src/test-setup.ts',
            hash: 'd8508d703266e7390b30189d3cf7fec7a70b198c',
            deps: ['npm:document-register-element'],
          },
          {
            file: 'apps/cart/tsconfig.app.json',
            hash: 'ce67a8f6f0c3345266081568fbe122381c7b82a2',
          },
          {
            file: 'apps/cart/tsconfig.json',
            hash: 'e7d37b3ecd2df29a7bf98d03d015f73dbaf0e723',
          },
          {
            file: 'apps/cart/tsconfig.spec.json',
            hash: '99a0ce08de0901250105669917e582aba6e8697e',
          },
        ],
        targets: {
          build: {
            executor: '@nrwl/webpack:webpack',
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
              development: {
                extractLicenses: false,
                optimization: false,
                sourceMap: true,
                vendorChunk: true,
              },
            },
            outputs: ['{options.outputPath}'],
            defaultConfiguration: 'production',
            dependsOn: ['^build'],
            inputs: ['production', '^production'],
          },
          serve: {
            executor: '@nrwl/webpack:dev-server',
            options: {
              buildTarget: 'cart:build',
            },
            configurations: {
              production: {
                buildTarget: 'cart:build:production',
              },
              development: {
                buildTarget: 'cart:build:development',
              },
            },
            defaultConfiguration: 'development',
          },
          lint: {
            executor: '@nrwl/linter:eslint',
            options: {
              lintFilePatterns: ['apps/cart/**/*.{ts,tsx,js,jsx}'],
            },
            outputs: ['{options.outputFile}'],
            inputs: ['default', '{workspaceRoot}/.eslintrc.json'],
          },
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'apps/cart/jest.config.ts',
              passWithNoTests: true,
            },
            outputs: ['{workspaceRoot}/coverage/apps/cart'],
            inputs: [
              'default',
              '^production',
              '{workspaceRoot}/jest.preset.js',
            ],
          },
          deploy: {
            executor: 'nx:run-commands',
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
      },
    },
  ],
  dependencies: {
    '@scoped/project-a': [
      {
        source: '@scoped/project-a',
        target: '@scoped/project-b',
      },
    ],
    '@scoped/project-b': [],
    'products-product-detail-page': [
      {
        source: 'products-product-detail-page',
        target: 'shared-product-state',
        type: 'static',
      },
      {
        source: 'products-product-detail-page',
        target: 'shared-product-ui',
        type: 'static',
      },
    ],
    'shared-product-state': [
      {
        source: 'shared-product-state',
        target: 'shared-product-data',
        type: 'static',
      },
      {
        source: 'shared-product-state',
        target: 'shared-product-types',
        type: 'static',
      },
    ],
    'shared-product-types': [],
    'shared-product-data': [
      {
        source: 'shared-product-data',
        target: 'shared-product-types',
        type: 'static',
      },
    ],
    'products-home-page': [
      {
        source: 'products-home-page',
        target: 'shared-product-state',
        type: 'static',
      },
      {
        source: 'products-home-page',
        target: 'shared-product-types',
        type: 'static',
      },
      {
        source: 'products-home-page',
        target: 'shared-product-ui',
        type: 'static',
      },
    ],
    'shared-cart-state': [
      {
        source: 'shared-cart-state',
        target: 'shared-product-data',
        type: 'static',
      },
      {
        source: 'shared-cart-state',
        target: 'shared-product-state',
        type: 'static',
      },
    ],
    'shared-product-ui': [
      {
        source: 'shared-product-ui',
        target: 'shared-jsxify',
        type: 'static',
      },
    ],
    'shared-e2e-utils': [],
    'cart-cart-page': [
      {
        source: 'cart-cart-page',
        target: 'shared-product-ui',
        type: 'static',
      },
      {
        source: 'cart-cart-page',
        target: 'shared-cart-state',
        type: 'static',
      },
      {
        source: 'cart-cart-page',
        target: 'shared-product-state',
        type: 'static',
      },
    ],
    'shared-assets': [],
    'shared-header': [
      {
        source: 'shared-header',
        target: 'shared-jsxify',
        type: 'static',
      },
    ],
    'shared-jsxify': [],
    'shared-styles': [],
    'products-e2e': [
      {
        source: 'products-e2e',
        target: 'products',
        type: 'implicit',
      },
      {
        source: 'products-e2e',
        target: 'shared-e2e-utils',
        type: 'static',
      },
    ],
    'cart-e2e': [
      {
        source: 'cart-e2e',
        target: 'cart',
        type: 'implicit',
      },
      {
        source: 'cart-e2e',
        target: 'shared-e2e-utils',
        type: 'static',
      },
    ],
    products: [
      {
        source: 'products',
        target: 'shared-assets',
        type: 'implicit',
      },
      {
        source: 'products',
        target: 'shared-styles',
        type: 'implicit',
      },
      {
        source: 'products',
        target: 'shared-header',
        type: 'static',
      },
      {
        source: 'products',
        target: 'products-home-page',
        type: 'static',
      },
      {
        source: 'products',
        target: 'products-product-detail-page',
        type: 'static',
      },
    ],
    cart: [
      {
        source: 'cart',
        target: 'shared-assets',
        type: 'implicit',
      },
      {
        source: 'cart',
        target: 'shared-styles',
        type: 'implicit',
      },
      {
        source: 'cart',
        type: 'static',
      },
      {
        source: 'cart',
        target: 'shared-header',
        type: 'static',
      },
      {
        source: 'cart',
        target: 'cart-cart-page',
        type: 'static',
      },
    ],
  },
  layout: {
    appsDir: 'apps',
    libsDir: 'libs',
  },
  affected: [],
  focus: null,
  groupByFolder: false,
  exclude: [],
};

window.taskGraphResponse = {
  taskGraphs: {
    'products-product-detail-page:lint': {
      roots: ['products-product-detail-page:lint'],
      tasks: {
        'products-product-detail-page:lint': {
          id: 'products-product-detail-page:lint',
          target: {
            project: 'products-product-detail-page',
            target: 'lint',
          },
          projectRoot: 'libs/products/product-detail-page',
          overrides: {},
        },
      },
      dependencies: {
        'products-product-detail-page:lint': [],
      },
    },
    'products-product-detail-page:test': {
      roots: ['products-product-detail-page:test'],
      tasks: {
        'products-product-detail-page:test': {
          id: 'products-product-detail-page:test',
          target: {
            project: 'products-product-detail-page',
            target: 'test',
          },
          projectRoot: 'libs/products/product-detail-page',
          overrides: {},
        },
      },
      dependencies: {
        'products-product-detail-page:test': [],
      },
    },
    'shared-product-state:lint': {
      roots: ['shared-product-state:lint'],
      tasks: {
        'shared-product-state:lint': {
          id: 'shared-product-state:lint',
          target: {
            project: 'shared-product-state',
            target: 'lint',
          },
          projectRoot: 'libs/shared/product/state',
          overrides: {},
        },
      },
      dependencies: {
        'shared-product-state:lint': [],
      },
    },
    'shared-product-state:test': {
      roots: ['shared-product-state:test'],
      tasks: {
        'shared-product-state:test': {
          id: 'shared-product-state:test',
          target: {
            project: 'shared-product-state',
            target: 'test',
          },
          projectRoot: 'libs/shared/product/state',
          overrides: {},
        },
      },
      dependencies: {
        'shared-product-state:test': [],
      },
    },
    'shared-product-types:lint': {
      roots: ['shared-product-types:lint'],
      tasks: {
        'shared-product-types:lint': {
          id: 'shared-product-types:lint',
          target: {
            project: 'shared-product-types',
            target: 'lint',
          },
          projectRoot: 'libs/shared/product/types',
          overrides: {},
        },
      },
      dependencies: {
        'shared-product-types:lint': [],
      },
    },
    'shared-product-data:lint': {
      roots: ['shared-product-data:lint'],
      tasks: {
        'shared-product-data:lint': {
          id: 'shared-product-data:lint',
          target: {
            project: 'shared-product-data',
            target: 'lint',
          },
          projectRoot: 'libs/shared/product/data',
          overrides: {},
        },
      },
      dependencies: {
        'shared-product-data:lint': [],
      },
    },
    'products-home-page:lint': {
      roots: ['products-home-page:lint'],
      tasks: {
        'products-home-page:lint': {
          id: 'products-home-page:lint',
          target: {
            project: 'products-home-page',
            target: 'lint',
          },
          projectRoot: 'libs/products/home-page',
          overrides: {},
        },
      },
      dependencies: {
        'products-home-page:lint': [],
      },
    },
    'products-home-page:test': {
      roots: ['products-home-page:test'],
      tasks: {
        'products-home-page:test': {
          id: 'products-home-page:test',
          target: {
            project: 'products-home-page',
            target: 'test',
          },
          projectRoot: 'libs/products/home-page',
          overrides: {},
        },
      },
      dependencies: {
        'products-home-page:test': [],
      },
    },
    'shared-cart-state:lint': {
      roots: ['shared-cart-state:lint'],
      tasks: {
        'shared-cart-state:lint': {
          id: 'shared-cart-state:lint',
          target: {
            project: 'shared-cart-state',
            target: 'lint',
          },
          projectRoot: 'libs/shared/cart/state',
          overrides: {},
        },
      },
      dependencies: {
        'shared-cart-state:lint': [],
      },
    },
    'shared-cart-state:test': {
      roots: ['shared-cart-state:test'],
      tasks: {
        'shared-cart-state:test': {
          id: 'shared-cart-state:test',
          target: {
            project: 'shared-cart-state',
            target: 'test',
          },
          projectRoot: 'libs/shared/cart/state',
          overrides: {},
        },
      },
      dependencies: {
        'shared-cart-state:test': [],
      },
    },
    'shared-product-ui:lint': {
      roots: ['shared-product-ui:lint'],
      tasks: {
        'shared-product-ui:lint': {
          id: 'shared-product-ui:lint',
          target: {
            project: 'shared-product-ui',
            target: 'lint',
          },
          projectRoot: 'libs/shared/product/ui',
          overrides: {},
        },
      },
      dependencies: {
        'shared-product-ui:lint': [],
      },
    },
    'shared-product-ui:test': {
      roots: ['shared-product-ui:test'],
      tasks: {
        'shared-product-ui:test': {
          id: 'shared-product-ui:test',
          target: {
            project: 'shared-product-ui',
            target: 'test',
          },
          projectRoot: 'libs/shared/product/ui',
          overrides: {},
        },
      },
      dependencies: {
        'shared-product-ui:test': [],
      },
    },
    'shared-e2e-utils:lint': {
      roots: ['shared-e2e-utils:lint'],
      tasks: {
        'shared-e2e-utils:lint': {
          id: 'shared-e2e-utils:lint',
          target: {
            project: 'shared-e2e-utils',
            target: 'lint',
          },
          projectRoot: 'libs/shared/e2e-utils',
          overrides: {},
        },
      },
      dependencies: {
        'shared-e2e-utils:lint': [],
      },
    },
    'cart-cart-page:lint': {
      roots: ['cart-cart-page:lint'],
      tasks: {
        'cart-cart-page:lint': {
          id: 'cart-cart-page:lint',
          target: {
            project: 'cart-cart-page',
            target: 'lint',
          },
          projectRoot: 'libs/cart/cart-page',
          overrides: {},
        },
      },
      dependencies: {
        'cart-cart-page:lint': [],
      },
    },
    'cart-cart-page:test': {
      roots: ['cart-cart-page:test'],
      tasks: {
        'cart-cart-page:test': {
          id: 'cart-cart-page:test',
          target: {
            project: 'cart-cart-page',
            target: 'test',
          },
          projectRoot: 'libs/cart/cart-page',
          overrides: {},
        },
      },
      dependencies: {
        'cart-cart-page:test': [],
      },
    },
    'shared-header:lint': {
      roots: ['shared-header:lint'],
      tasks: {
        'shared-header:lint': {
          id: 'shared-header:lint',
          target: {
            project: 'shared-header',
            target: 'lint',
          },
          projectRoot: 'libs/shared/header',
          overrides: {},
        },
      },
      dependencies: {
        'shared-header:lint': [],
      },
    },
    'shared-header:test': {
      roots: ['shared-header:test'],
      tasks: {
        'shared-header:test': {
          id: 'shared-header:test',
          target: {
            project: 'shared-header',
            target: 'test',
          },
          projectRoot: 'libs/shared/header',
          overrides: {},
        },
      },
      dependencies: {
        'shared-header:test': [],
      },
    },
    'shared-jsxify:lint': {
      roots: ['shared-jsxify:lint'],
      tasks: {
        'shared-jsxify:lint': {
          id: 'shared-jsxify:lint',
          target: {
            project: 'shared-jsxify',
            target: 'lint',
          },
          projectRoot: 'libs/shared/jsxify',
          overrides: {},
        },
      },
      dependencies: {
        'shared-jsxify:lint': [],
      },
    },
    'products-e2e:e2e': {
      roots: ['products-e2e:e2e'],
      tasks: {
        'products-e2e:e2e': {
          id: 'products-e2e:e2e',
          target: {
            project: 'products-e2e',
            target: 'e2e',
          },
          projectRoot: 'apps/products-e2e',
          overrides: {},
        },
      },
      dependencies: {
        'products-e2e:e2e': [],
      },
    },
    'products-e2e:e2e:production': {
      roots: ['products-e2e:e2e:production'],
      tasks: {
        'products-e2e:e2e:production': {
          id: 'products-e2e:e2e:production',
          target: {
            project: 'products-e2e',
            target: 'e2e',
            configuration: 'production',
          },
          projectRoot: 'apps/products-e2e',
          overrides: {},
        },
      },
      dependencies: {
        'products-e2e:e2e:production': [],
      },
    },
    'products-e2e:lint': {
      roots: ['products-e2e:lint'],
      tasks: {
        'products-e2e:lint': {
          id: 'products-e2e:lint',
          target: {
            project: 'products-e2e',
            target: 'lint',
          },
          projectRoot: 'apps/products-e2e',
          overrides: {},
        },
      },
      dependencies: {
        'products-e2e:lint': [],
      },
    },
    'cart-e2e:e2e': {
      roots: ['cart-e2e:e2e'],
      tasks: {
        'cart-e2e:e2e': {
          id: 'cart-e2e:e2e',
          target: {
            project: 'cart-e2e',
            target: 'e2e',
          },
          projectRoot: 'apps/cart-e2e',
          overrides: {},
        },
      },
      dependencies: {
        'cart-e2e:e2e': [],
      },
    },
    'cart-e2e:e2e:production': {
      roots: ['cart-e2e:e2e:production'],
      tasks: {
        'cart-e2e:e2e:production': {
          id: 'cart-e2e:e2e:production',
          target: {
            project: 'cart-e2e',
            target: 'e2e',
            configuration: 'production',
          },
          projectRoot: 'apps/cart-e2e',
          overrides: {},
        },
      },
      dependencies: {
        'cart-e2e:e2e:production': [],
      },
    },
    'cart-e2e:lint': {
      roots: ['cart-e2e:lint'],
      tasks: {
        'cart-e2e:lint': {
          id: 'cart-e2e:lint',
          target: {
            project: 'cart-e2e',
            target: 'lint',
          },
          projectRoot: 'apps/cart-e2e',
          overrides: {},
        },
      },
      dependencies: {
        'cart-e2e:lint': [],
      },
    },
    'products:build': {
      roots: ['products:build'],
      tasks: {
        'products:build': {
          id: 'products:build',
          target: {
            project: 'products',
            target: 'build',
          },
          projectRoot: 'apps/products',
          overrides: {},
        },
      },
      dependencies: {
        'products:build': [],
      },
    },
    'products:build:production': {
      roots: ['products:build:production'],
      tasks: {
        'products:build:production': {
          id: 'products:build:production',
          target: {
            project: 'products',
            target: 'build',
            configuration: 'production',
          },
          projectRoot: 'apps/products',
          overrides: {},
        },
      },
      dependencies: {
        'products:build:production': [],
      },
    },
    'products:serve': {
      roots: ['products:serve'],
      tasks: {
        'products:serve': {
          id: 'products:serve',
          target: {
            project: 'products',
            target: 'serve',
          },
          projectRoot: 'apps/products',
          overrides: {},
        },
      },
      dependencies: {
        'products:serve': [],
      },
    },
    'products:serve:production': {
      roots: ['products:serve:production'],
      tasks: {
        'products:serve:production': {
          id: 'products:serve:production',
          target: {
            project: 'products',
            target: 'serve',
            configuration: 'production',
          },
          projectRoot: 'apps/products',
          overrides: {},
        },
      },
      dependencies: {
        'products:serve:production': [],
      },
    },
    'products:extract-i18n': {
      roots: ['products:extract-i18n'],
      tasks: {
        'products:extract-i18n': {
          id: 'products:extract-i18n',
          target: {
            project: 'products',
            target: 'extract-i18n',
          },
          projectRoot: 'apps/products',
          overrides: {},
        },
      },
      dependencies: {
        'products:extract-i18n': [],
      },
    },
    'products:lint': {
      roots: ['products:lint'],
      tasks: {
        'products:lint': {
          id: 'products:lint',
          target: {
            project: 'products',
            target: 'lint',
          },
          projectRoot: 'apps/products',
          overrides: {},
        },
      },
      dependencies: {
        'products:lint': [],
      },
    },
    'products:test': {
      roots: ['products:test'],
      tasks: {
        'products:test': {
          id: 'products:test',
          target: {
            project: 'products',
            target: 'test',
          },
          projectRoot: 'apps/products',
          overrides: {},
        },
      },
      dependencies: {
        'products:test': [],
      },
    },
    'products:deploy': {
      roots: ['products:deploy'],
      tasks: {
        'products:deploy': {
          id: 'products:deploy',
          target: {
            project: 'products',
            target: 'deploy',
          },
          projectRoot: 'apps/products',
          overrides: {},
        },
      },
      dependencies: {
        'products:deploy': [],
      },
    },
    'cart:build': {
      roots: ['cart:build:production'],
      tasks: {
        'cart:build:production': {
          id: 'cart:build:production',
          target: {
            project: 'cart',
            target: 'build',
            configuration: 'production',
          },
          projectRoot: 'apps/cart',
          overrides: {},
        },
      },
      dependencies: {
        'cart:build:production': [],
      },
    },
    'cart:build:production': {
      roots: ['cart:build:production'],
      tasks: {
        'cart:build:production': {
          id: 'cart:build:production',
          target: {
            project: 'cart',
            target: 'build',
            configuration: 'production',
          },
          projectRoot: 'apps/cart',
          overrides: {},
        },
      },
      dependencies: {
        'cart:build:production': [],
      },
    },
    'cart:build:development': {
      roots: ['cart:build:development'],
      tasks: {
        'cart:build:development': {
          id: 'cart:build:development',
          target: {
            project: 'cart',
            target: 'build',
            configuration: 'development',
          },
          projectRoot: 'apps/cart',
          overrides: {},
        },
      },
      dependencies: {
        'cart:build:development': [],
      },
    },
    'cart:serve': {
      roots: ['cart:serve:development'],
      tasks: {
        'cart:serve:development': {
          id: 'cart:serve:development',
          target: {
            project: 'cart',
            target: 'serve',
            configuration: 'development',
          },
          projectRoot: 'apps/cart',
          overrides: {},
        },
      },
      dependencies: {
        'cart:serve:development': [],
      },
    },
    'cart:serve:production': {
      roots: ['cart:serve:production'],
      tasks: {
        'cart:serve:production': {
          id: 'cart:serve:production',
          target: {
            project: 'cart',
            target: 'serve',
            configuration: 'production',
          },
          projectRoot: 'apps/cart',
          overrides: {},
        },
      },
      dependencies: {
        'cart:serve:production': [],
      },
    },
    'cart:serve:development': {
      roots: ['cart:serve:development'],
      tasks: {
        'cart:serve:development': {
          id: 'cart:serve:development',
          target: {
            project: 'cart',
            target: 'serve',
            configuration: 'development',
          },
          projectRoot: 'apps/cart',
          overrides: {},
        },
      },
      dependencies: {
        'cart:serve:development': [],
      },
    },
    'cart:lint': {
      roots: ['cart:lint'],
      tasks: {
        'cart:lint': {
          id: 'cart:lint',
          target: {
            project: 'cart',
            target: 'lint',
          },
          projectRoot: 'apps/cart',
          overrides: {},
        },
      },
      dependencies: {
        'cart:lint': [],
      },
    },
    'cart:test': {
      roots: ['cart:test'],
      tasks: {
        'cart:test': {
          id: 'cart:test',
          target: {
            project: 'cart',
            target: 'test',
          },
          projectRoot: 'apps/cart',
          overrides: {},
        },
      },
      dependencies: {
        'cart:test': [],
      },
    },
    'cart:deploy': {
      roots: ['cart:deploy'],
      tasks: {
        'cart:deploy': {
          id: 'cart:deploy',
          target: {
            project: 'cart',
            target: 'deploy',
          },
          projectRoot: 'apps/cart',
          overrides: {},
        },
      },
      dependencies: {
        'cart:deploy': [],
      },
    },
  },
};
