export const mediumGraph = {
  version: '2.0',
  rootFiles: [
    {
      file: 'angular.json',
      hash: '3ea87635d14f46a32b56bd010061c4cdb225fc6f',
      ext: '.json',
    },
    {
      file: 'nx.json',
      hash: '99b41a6538eb767e13b15058008bc8b73e7eaf29',
      ext: '.json',
    },
    {
      file: 'package.json',
      hash: '7a4c917e70a48dcb884d07ac24c6e8133041f65d',
      ext: '.json',
    },
    {
      file: 'tsconfig.base.json',
      hash: '3c41a2d2051ca18d36ad128197fabe0146d913de',
      ext: '.json',
    },
  ],
  nodes: {
    'nx-cloud-reference-feature-invite-members': {
      name: 'nx-cloud-reference-feature-invite-members',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nx-cloud/reference/feature-invite-members',
        sourceRoot: 'libs/nx-cloud/reference/feature-invite-members/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-cloud/reference/feature-invite-members/tsconfig.lib.json',
                'libs/nx-cloud/reference/feature-invite-members/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nx-cloud/reference/feature-invite-members/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig:
                'libs/nx-cloud/reference/feature-invite-members/jest.config.js',
              tsConfig:
                'libs/nx-cloud/reference/feature-invite-members/tsconfig.spec.json',
              passWithNoTests: true,
              setupFile:
                'libs/nx-cloud/reference/feature-invite-members/src/test-setup.ts',
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            style: 'scss',
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/nx-cloud/reference/feature-invite-members/README.md',
            hash: '58dea934c3859db2564d678c9065edc9ad1f907f',
            ext: '.md',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-invite-members/jest.config.js',
            hash: '68c9c2f9ce188384cf7caa912cbbf7d18f239483',
            ext: '.js',
          },
          {
            file: 'libs/nx-cloud/reference/feature-invite-members/src/index.ts',
            hash: '1fce2aa5e4538b865287fca5dbe887a2818c1e42',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-invite-members/src/lib/accept-invite/accept-invite.component.ts',
            hash: '33b33aedc0d5b5eb07d61ab0e8bba1bc85a7214f',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-invite-members/src/lib/add-member-modal/add-member-modal.component.html',
            hash: 'dd56aa71000fc8ea2054933b4d50a47a890919b4',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-invite-members/src/lib/add-member-modal/add-member-modal.component.scss',
            hash: 'c7acb4bf6e7f6dd478cc87d9fc5a9ee93fd12013',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-invite-members/src/lib/add-member-modal/add-member-modal.component.ts',
            hash: 'd49fc0802ca3cf249af3e82aeefb5c68cd8a8ae2',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-invite-members/src/lib/invite-member-button/invite-member-button.component.html',
            hash: '5e395c7acf526c4c30d6db5927e6da8ba90d2716',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-invite-members/src/lib/invite-member-button/invite-member-button.component.scss',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-invite-members/src/lib/invite-member-button/invite-member-button.component.ts',
            hash: '1b29b3ccafea62decf9cf9bb76b736c6da40c300',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-invite-members/src/lib/nx-cloud-reference-feature-invite-members.module.ts',
            hash: '218cbacc4ffd46909dbac64a10a7d1e2d7273a13',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-invite-members/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-invite-members/tsconfig.json',
            hash: '26b7b4afd192ea6de9e231782d05a8f03f80627b',
            ext: '.json',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-invite-members/tsconfig.lib.json',
            hash: '290e7bc9a4e40a6a9a2c218090e8973fc9375730',
            ext: '.json',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-invite-members/tsconfig.spec.json',
            hash: 'aed68bc6bf86609a7a4f0fdf5a562265cd90e452',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/reference/feature-invite-members/tslint.json',
            hash: '367fb1ad5f3e93ce3ebd81543613cd0af99ca999',
            ext: '.json',
          },
        ],
      },
    },
    'nx-cloud-data-access-workspace': {
      name: 'nx-cloud-data-access-workspace',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nx-cloud/reference/data-access-workspace',
        sourceRoot: 'libs/nx-cloud/reference/data-access-workspace/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-cloud/reference/data-access-workspace/tsconfig.lib.json',
                'libs/nx-cloud/reference/data-access-workspace/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig:
                'libs/nx-cloud/reference/data-access-workspace/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['nx-cloud', 'type:data-access'],
        files: [
          {
            file:
              'libs/nx-cloud/reference/data-access-workspace/jest.config.js',
            hash: '51fd4d6d7cbc0d102bef9674eda7ec3768efd9ff',
            ext: '.js',
          },
          {
            file: 'libs/nx-cloud/reference/data-access-workspace/src/index.ts',
            hash: '5f722472311819f5770cce208744d243b0131ad7',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/data-access-workspace/src/lib/current-workspace.service.ts',
            hash: '91cc874f1e83ab40d71fdf109b948779fa8b7166',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/data-access-workspace/src/lib/data-access-workspace.module.ts',
            hash: '59833cebc90a541b44f80a556d47dcfabc7105fa',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/data-access-workspace/src/lib/models/aggregation-job-data.ts',
            hash: 'c98a806f999605a49385afd1b484bf1af0427c6f',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/data-access-workspace/src/lib/models/project-usage-data.ts',
            hash: '8cee8feaa5e2f3a0d2f19caf02e04583447cc05f',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/data-access-workspace/src/lib/models/usage-period.ts',
            hash: '096a33c18eb329616780a2cdc93a288971070d3f',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/data-access-workspace/src/lib/models/usage.ts',
            hash: '61d856c1de848199a02544538928f199f6171aa2',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/data-access-workspace/src/lib/models/workspace.interface.ts',
            hash: '41c2ca233cf8b4b131c31f7a67e313e4be41063c',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/data-access-workspace/src/lib/usage.service.ts',
            hash: '671ccedc88ee4c73c044587900dd3cc5a441c2ae',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/data-access-workspace/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/reference/data-access-workspace/tsconfig.json',
            hash: 'd32f55e3999447ae24e89f0e76d8c3128113c85e',
            ext: '.json',
          },
          {
            file:
              'libs/nx-cloud/reference/data-access-workspace/tsconfig.lib.json',
            hash: '30c861db6fdc5f5c9c83c11d39b7fceab815f9a6',
            ext: '.json',
          },
          {
            file:
              'libs/nx-cloud/reference/data-access-workspace/tsconfig.spec.json',
            hash: 'aed68bc6bf86609a7a4f0fdf5a562265cd90e452',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/reference/data-access-workspace/tslint.json',
            hash: '367fb1ad5f3e93ce3ebd81543613cd0af99ca999',
            ext: '.json',
          },
        ],
      },
    },
    'nx-cloud-reference-feature-access-token': {
      name: 'nx-cloud-reference-feature-access-token',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nx-cloud/reference/feature-access-token',
        sourceRoot: 'libs/nx-cloud/reference/feature-access-token/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-cloud/reference/feature-access-token/tsconfig.lib.json',
                'libs/nx-cloud/reference/feature-access-token/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig:
                'libs/nx-cloud/reference/feature-access-token/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['type:feature'],
        files: [
          {
            file: 'libs/nx-cloud/reference/feature-access-token/README.md',
            hash: '5d0a9dd4b19315b7845a0420604186445a671fcf',
            ext: '.md',
          },
          {
            file: 'libs/nx-cloud/reference/feature-access-token/jest.config.js',
            hash: '90fc0b003ed7628284cb434f7885570735949423',
            ext: '.js',
          },
          {
            file: 'libs/nx-cloud/reference/feature-access-token/src/index.ts',
            hash: '6b60858e693f78ae72c5d0dde3d2790727786c2f',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-access-token/src/lib/confirm-delete-dialog/confirm-delete-dialog.component.html',
            hash: '2620d331dac7b8a89c14f6db92de15572aaa8ed2',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-access-token/src/lib/confirm-delete-dialog/confirm-delete-dialog.component.scss',
            hash: '1bc886ad66e96c018e9530583019b663a908f97f',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-access-token/src/lib/confirm-delete-dialog/confirm-delete-dialog.component.ts',
            hash: '2bdb6fbf737dde5bc166e6f548a9fda1213f71b0',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-access-token/src/lib/generate-new-token-dialog/generate-new-token-dialog.component.html',
            hash: '1529bd466b316646abad6297ce71d6302f24ba68',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-access-token/src/lib/generate-new-token-dialog/generate-new-token-dialog.component.scss',
            hash: '79d81e4abccf85ba01d8021c370965cb0161a04e',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-access-token/src/lib/generate-new-token-dialog/generate-new-token-dialog.component.ts',
            hash: '0b71fe149a90d375be384fe0496a9ea187c25b26',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-access-token/src/lib/generate-new-token-dialog/package.json',
            hash: '64b00b26de88aed4e5328a47c06321cfc821d6d8',
            ext: '.json',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-access-token/src/lib/nx-cloud-feature-access-token.module.ts',
            hash: '8495b6590bbbfa0a839a8425ad86fee22a898e3b',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-access-token/src/lib/token-setup-instructions-dialog/token-setup-instructions-dialog.component.html',
            hash: '9490262c6ff76bf85519e64faf100eefa04ecdf1',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-access-token/src/lib/token-setup-instructions-dialog/token-setup-instructions-dialog.component.scss',
            hash: '678b50290c5706eb408c7c210a0bfccdbb550758',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-access-token/src/lib/token-setup-instructions-dialog/token-setup-instructions-dialog.component.ts',
            hash: 'a4dbb1b53cca1b94da39cc68ee63dc64fb028e33',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-access-token/src/lib/tokens-list/tokens-list.component.html',
            hash: '51cf8e516827c56630d28d68203c4978385b3ccc',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-access-token/src/lib/tokens-list/tokens-list.component.scss',
            hash: 'dc2dcad5bae2518025d1f160b2c06f624bdfeacf',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-access-token/src/lib/tokens-list/tokens-list.component.ts',
            hash: 'd56ad75dd4a25b64c7defe2fef551978c4189edc',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-access-token/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/reference/feature-access-token/tsconfig.json',
            hash: 'd32f55e3999447ae24e89f0e76d8c3128113c85e',
            ext: '.json',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-access-token/tsconfig.lib.json',
            hash: '30c861db6fdc5f5c9c83c11d39b7fceab815f9a6',
            ext: '.json',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-access-token/tsconfig.spec.json',
            hash: 'aed68bc6bf86609a7a4f0fdf5a562265cd90e452',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/reference/feature-access-token/tslint.json',
            hash: '367fb1ad5f3e93ce3ebd81543613cd0af99ca999',
            ext: '.json',
          },
        ],
      },
    },
    'nx-cloud-data-access-billing': {
      name: 'nx-cloud-data-access-billing',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nx-cloud/reference/data-access-billing',
        sourceRoot: 'libs/nx-cloud/reference/data-access-billing/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-cloud/reference/data-access-billing/tsconfig.lib.json',
                'libs/nx-cloud/reference/data-access-billing/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nx-cloud/reference/data-access-billing/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig:
                'libs/nx-cloud/reference/data-access-billing/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['nx-insights', 'type:data-access'],
        files: [
          {
            file: 'libs/nx-cloud/reference/data-access-billing/README.md',
            hash: 'd6834bfba2766d230ab31b45294f3e73816f888c',
            ext: '.md',
          },
          {
            file: 'libs/nx-cloud/reference/data-access-billing/jest.config.js',
            hash: '358d49a8e8be518e4d4d7175a2c5306deb250bb4',
            ext: '.js',
          },
          {
            file: 'libs/nx-cloud/reference/data-access-billing/src/index.ts',
            hash: '2ca8d2c87a82ab8c25ff36d77318343d4b108595',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/data-access-billing/src/lib/billing-graphql.service.ts',
            hash: '0f84961c66b17b4e8cf51fbe6e0de7ac7ce5b2ce',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/data-access-billing/src/lib/billing.interface.ts',
            hash: 'f4e6758f6e678d31d16edb9b179f68f57d5ed417',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/data-access-billing/src/lib/nx-insights-data-access-billing.module.ts',
            hash: 'd02b9b367645b09ef198623e370b034ee5e9d8b8',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/data-access-billing/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/reference/data-access-billing/tsconfig.json',
            hash: 'd32f55e3999447ae24e89f0e76d8c3128113c85e',
            ext: '.json',
          },
          {
            file:
              'libs/nx-cloud/reference/data-access-billing/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file:
              'libs/nx-cloud/reference/data-access-billing/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/reference/data-access-billing/tslint.json',
            hash: '367fb1ad5f3e93ce3ebd81543613cd0af99ca999',
            ext: '.json',
          },
        ],
      },
    },
    'nx-cloud-reference-util-org-membership': {
      name: 'nx-cloud-reference-util-org-membership',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nx-cloud/reference/util-org-membership',
        sourceRoot: 'libs/nx-cloud/reference/util-org-membership/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-cloud/reference/util-org-membership/tsconfig.lib.json',
                'libs/nx-cloud/reference/util-org-membership/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nx-cloud/reference/util-org-membership/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig:
                'libs/nx-cloud/reference/util-org-membership/jest.config.js',
              tsConfig:
                'libs/nx-cloud/reference/util-org-membership/tsconfig.spec.json',
              passWithNoTests: true,
              setupFile:
                'libs/nx-cloud/reference/util-org-membership/src/test-setup.ts',
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            style: 'scss',
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/nx-cloud/reference/util-org-membership/README.md',
            hash: '2163a43d1f65d08e8c0bf9c66a991082d91d29f6',
            ext: '.md',
          },
          {
            file: 'libs/nx-cloud/reference/util-org-membership/jest.config.js',
            hash: 'e4d3f86768feafb8c4626b55a59504ae1402174f',
            ext: '.js',
          },
          {
            file: 'libs/nx-cloud/reference/util-org-membership/src/index.ts',
            hash: 'e9c178000da28091fc880cc605129a424cd5bce0',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/util-org-membership/src/lib/is-admin.pipe.ts',
            hash: '00ae1b478480ab69495060019c5e4251e5139308',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/util-org-membership/src/lib/org-membership.module.ts',
            hash: '4cc25bb114fcda450555115cbb131c5eb7a8f18b',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/util-org-membership/src/lib/org-membership.service.ts',
            hash: 'ad2b33aa0a25c0b4a7e703520e48a31977890321',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/util-org-membership/src/lib/org-route.guard.ts',
            hash: '258ae79a583fb6ab344693636d13f05b8d63b400',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/util-org-membership/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/reference/util-org-membership/tsconfig.json',
            hash: '26b7b4afd192ea6de9e231782d05a8f03f80627b',
            ext: '.json',
          },
          {
            file:
              'libs/nx-cloud/reference/util-org-membership/tsconfig.lib.json',
            hash: 'feb76e1306e58f9278f240b994d3de132ff6d85d',
            ext: '.json',
          },
          {
            file:
              'libs/nx-cloud/reference/util-org-membership/tsconfig.spec.json',
            hash: 'aed68bc6bf86609a7a4f0fdf5a562265cd90e452',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/reference/util-org-membership/tslint.json',
            hash: '367fb1ad5f3e93ce3ebd81543613cd0af99ca999',
            ext: '.json',
          },
        ],
      },
    },
    'nrwlio-site-pages-feature-style-guide': {
      name: 'nrwlio-site-pages-feature-style-guide',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nrwlio-site/pages/feature-style-guide',
        sourceRoot: 'libs/nrwlio-site/pages/feature-style-guide/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nrwlio-site/pages/feature-style-guide/tsconfig.lib.json',
                'libs/nrwlio-site/pages/feature-style-guide/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nrwlio-site/pages/feature-style-guide/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig:
                'libs/nrwlio-site/pages/feature-style-guide/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['nrwlio', 'type:feature'],
        files: [
          {
            file: 'libs/nrwlio-site/pages/feature-style-guide/README.md',
            hash: 'e48d30f17e2b1358c3acefca8c8cb147173deeba',
            ext: '.md',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-style-guide/jest.config.js',
            hash: '1c7c9810ae15ee4b1958cd7540052c69528cd675',
            ext: '.js',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-style-guide/src/index.ts',
            hash: '4f2e7380d4eb67ef5aa4737aae43c5b67e51367e',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-style-guide/src/lib/basics/basics.component.html',
            hash: '9e817cef9db6a3ba8b8fab2139257dad7bb1d75c',
            ext: '.html',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-style-guide/src/lib/basics/basics.component.scss',
            hash: '0dbc527bc230f6a52f75ec01ec92548cc48fc74d',
            ext: '.scss',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-style-guide/src/lib/basics/basics.component.ts',
            hash: 'c56c95c0bb77d104b538086d44d8f4011b6d56bb',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-style-guide/src/lib/contents/contents.component.html',
            hash: '64d5a07d6f8fc3b59d3d358d20d72d280a25489b',
            ext: '.html',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-style-guide/src/lib/contents/contents.component.scss',
            hash: 'd582ae210860576104972688577526c6aa4ea174',
            ext: '.scss',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-style-guide/src/lib/contents/contents.component.ts',
            hash: 'd707766a804a507681acb94facdfdcff1dc06595',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-style-guide/src/lib/dynamic-layout/dynamic-layout.component.ts',
            hash: '7d51ac201320f6f0b56f3c1a8c8ee18e5aed869c',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-style-guide/src/lib/feature-style-guide.module.ts',
            hash: '08993fe59a385a31df400f5d3355c07918031c8a',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-style-guide/src/lib/shell/shell.component.html',
            hash: '70b045fd75d5ba24fc56ba0ebab8a8e3bcd38726',
            ext: '.html',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-style-guide/src/lib/shell/shell.component.scss',
            hash: 'b545f8883bb5c4bbfc3fd5df3343328ad89d5bb1',
            ext: '.scss',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-style-guide/src/lib/shell/shell.component.ts',
            hash: 'e344f47734e79e75546fa06a9cb658aad58f84b3',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-style-guide/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-style-guide/tsconfig.json',
            hash: 'd32f55e3999447ae24e89f0e76d8c3128113c85e',
            ext: '.json',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-style-guide/tsconfig.lib.json',
            hash: 'ad83824e5f62f1e5ff2acd0960bde6bab3f87d66',
            ext: '.json',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-style-guide/tsconfig.spec.json',
            hash: 'aed68bc6bf86609a7a4f0fdf5a562265cd90e452',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-style-guide/tslint.json',
            hash: '83044b2002861893cc69114f11d0a1c4e043917a',
            ext: '.json',
          },
        ],
      },
    },
    'nrwlio-site-pages-feature-contact-us': {
      name: 'nrwlio-site-pages-feature-contact-us',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nrwlio-site/pages/feature-contact-us',
        sourceRoot: 'libs/nrwlio-site/pages/feature-contact-us/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nrwlio-site/pages/feature-contact-us/tsconfig.lib.json',
                'libs/nrwlio-site/pages/feature-contact-us/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nrwlio-site/pages/feature-contact-us/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig:
                'libs/nrwlio-site/pages/feature-contact-us/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['nrwlio', 'type:feature'],
        files: [
          {
            file: 'libs/nrwlio-site/pages/feature-contact-us/README.md',
            hash: '701eb1c0ea65ba671abf3292b534e7201f59bcb2',
            ext: '.md',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-contact-us/jest.config.js',
            hash: '6830a9eabb34e56e6b5c03214b26dc5e15524782',
            ext: '.js',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-contact-us/src/index.ts',
            hash: 'bc90e0f93e3e0bfcbb202f32f301836756776a65',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-contact-us/src/lib/contact-us-query.service.ts',
            hash: '39a45dfd46b354c640181c8207aa0a036bcd8355',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-contact-us/src/lib/contact-us.model.ts',
            hash: '9548cda5608f5438c652d3a69677ba61537b430a',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-contact-us/src/lib/feature-contact-us-routing.module.ts',
            hash: '2e6e30be8ac3452ebb345ef2a3a740e8b505abef',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-contact-us/src/lib/feature-contact-us.module.ts',
            hash: '3a919efb89c384678c99edc1ce53cbda0d60c886',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-contact-us/src/lib/shell/shell.component.html',
            hash: '3b945f2ed78466feaec5d4b0c2918b9d1b704b1e',
            ext: '.html',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-contact-us/src/lib/shell/shell.component.scss',
            hash: '167fba0f4a28d0508c3c0179f6020f0d9c517c71',
            ext: '.scss',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-contact-us/src/lib/shell/shell.component.ts',
            hash: '6968b0a80805b316c4fe511198f3c207cb95f9d9',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-contact-us/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-contact-us/tsconfig.json',
            hash: 'd32f55e3999447ae24e89f0e76d8c3128113c85e',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-contact-us/tsconfig.lib.json',
            hash: 'ad83824e5f62f1e5ff2acd0960bde6bab3f87d66',
            ext: '.json',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-contact-us/tsconfig.spec.json',
            hash: 'aed68bc6bf86609a7a4f0fdf5a562265cd90e452',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-contact-us/tslint.json',
            hash: '83044b2002861893cc69114f11d0a1c4e043917a',
            ext: '.json',
          },
        ],
      },
    },
    'nx-cloud-reference-feature-workspace': {
      name: 'nx-cloud-reference-feature-workspace',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nx-cloud/reference/feature-workspace',
        sourceRoot: 'libs/nx-cloud/reference/feature-workspace/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-cloud/reference/feature-workspace/tsconfig.lib.json',
                'libs/nx-cloud/reference/feature-workspace/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig:
                'libs/nx-cloud/reference/feature-workspace/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['nx-cloud', 'type:feature'],
        files: [
          {
            file: 'libs/nx-cloud/reference/feature-workspace/README.md',
            hash: '0a81d33fe381e9ff060d5ca90f60b6fcde22e046',
            ext: '.md',
          },
          {
            file: 'libs/nx-cloud/reference/feature-workspace/jest.config.js',
            hash: '77d27622ab4111bd8cce8af32cb3f5ca325accfb',
            ext: '.js',
          },
          {
            file: 'libs/nx-cloud/reference/feature-workspace/src/index.ts',
            hash: 'd091cb48c693ee76f19096d1b799b473557cc2cc',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/aggregated-time-saved-graph/aggregated-time-saved-graph.component.html',
            hash: 'b13610d18808c799d4902815345c411aa070fe97',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/aggregated-time-saved-graph/aggregated-time-saved-graph.component.ts',
            hash: '3d7da3cd0e764d77a8631ed487f67064a2ba5b96',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/aggregated-time-saved-graph/diagonal-stripes.component.html',
            hash: 'ed44b2119bb0cd3f0f8bb8922b5fe64be2a77516',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/aggregated-time-saved-graph/diagonal-stripes.component.ts',
            hash: 'c130769d0461d5f441e78e429b6c175c1035cfef',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/breadcrumb-nav/breadcrumb-nav.component.ts',
            hash: '9c309425827cfaee5d2c6a11e7fe0fa44116146b',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/cache-reporting-details/cache-reporting-details.component.html',
            hash: '77eb46e227d099a9dbfbfdf20c1f59d895671230',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/cache-reporting-details/cache-reporting-details.component.scss',
            hash: '65615cc44388299468c435dbbef89baaa20fd0fe',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/cache-reporting-details/cache-reporting-details.component.ts',
            hash: '2e5128abcba7cf88f62ca321d2238c4757d3da90',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/cache-reporting-troubleshooting/cache-reporting-troubleshooting.component.html',
            hash: '60b6f29bf5650a819b62b8ec5b62b88a66ef67cc',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/cache-reporting-troubleshooting/cache-reporting-troubleshooting.component.scss',
            hash: 'a9ab0840ea7cf8d76624236f93d20652fb0dca55',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/cache-reporting-troubleshooting/cache-reporting-troubleshooting.component.ts',
            hash: '31984340c355ed8ba639f096b7697e25e072cb1f',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/cache-reporting/cache-reporting.component.html',
            hash: '7f1e10b1fd6f328b6039758ec7d0bf6a99f7298f',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/cache-reporting/cache-reporting.component.scss',
            hash: '6265f8799780a355ff4c77d458e5be0e5d0459b9',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/cache-reporting/cache-reporting.component.ts',
            hash: 'd7b6fa9d64cdf14851f033edc1e9ca512198ae76',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/confirm-delete-dialog/confirm-delete-dialog.component.html',
            hash: '3833431e15b6f277dcdef94627882ef30dfb0335',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/confirm-delete-dialog/confirm-delete-dialog.component.scss',
            hash: '1bc886ad66e96c018e9530583019b663a908f97f',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/confirm-delete-dialog/confirm-delete-dialog.component.ts',
            hash: '2c85ef44a4bc31effa7613b61f32862849b36afd',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/feature-workspace.module.ts',
            hash: '438302aed10906f37c2812f01499052e7691e082',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/tokens-view/tokens-view.component.html',
            hash: 'ee121ddafc8bf3273886d4dafac0a579e1d22c27',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/tokens-view/tokens-view.component.ts',
            hash: '7bd450381e5567eed8ba1e92b8b85032f3c5a157',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/workspace-edit/workspace-edit.component.html',
            hash: '54c60575cb4f5be53b04774e11b5eb1de0021ace',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/workspace-edit/workspace-edit.component.scss',
            hash: 'fe53a751d47626de49be50e45caf9fe60cee13bf',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/workspace-edit/workspace-edit.component.ts',
            hash: '9e9b63953bdf9a7c86bb370f02f6f5e315a13f2c',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/workspace-field-form/workspace-field-form.component.html',
            hash: '2dbff2a36f00d0be2e72d4b2d9307da59cd009a1',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/workspace-field-form/workspace-field-form.component.scss',
            hash: 'd5d0d86fbbab0b50e0551e502dfdded847d31da8',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/workspace-field-form/workspace-field-form.component.ts',
            hash: 'b91974f3872be235b645e02c488a43da92abb7a7',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/workspace-route.guard.ts',
            hash: '92bd088c95da0f574518218ba8b2054fd3fd70b7',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/workspace-view/workspace-view.component.html',
            hash: '4d3a729cea59fef9f3511bf94edc70301ed940a9',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/workspace-view/workspace-view.component.scss',
            hash: '2810f5da9d1fb9d7ca7c249b3eecf362ab065636',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/src/lib/workspace-view/workspace-view.component.ts',
            hash: 'ab8fc1dad7da7a708f38f6ff81b8ac456f6b2dd8',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/reference/feature-workspace/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/reference/feature-workspace/tsconfig.json',
            hash: 'd32f55e3999447ae24e89f0e76d8c3128113c85e',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/reference/feature-workspace/tsconfig.lib.json',
            hash: '30c861db6fdc5f5c9c83c11d39b7fceab815f9a6',
            ext: '.json',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-workspace/tsconfig.spec.json',
            hash: 'aed68bc6bf86609a7a4f0fdf5a562265cd90e452',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/reference/feature-workspace/tslint.json',
            hash: '367fb1ad5f3e93ce3ebd81543613cd0af99ca999',
            ext: '.json',
          },
        ],
      },
    },
    'platform-data-access-nrwl-changelog': {
      name: 'platform-data-access-nrwl-changelog',
      type: 'lib',
      data: {
        root: 'libs/platform/data-access-nrwl-changelog',
        sourceRoot: 'libs/platform/data-access-nrwl-changelog/src',
        projectType: 'library',
        prefix: 'nrwl-connect',
        architect: {
          'test-change-to-jest-and-rename-back': {
            builder: '@angular-devkit/build-angular:karma',
            options: {
              main: 'libs/platform/data-access-nrwl-changelog/src/test.ts',
              tsConfig:
                'libs/platform/data-access-nrwl-changelog/tsconfig.spec.json',
              karmaConfig:
                'libs/platform/data-access-nrwl-changelog/karma.conf.js',
            },
          },
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/data-access-nrwl-changelog/tsconfig.lib.json',
                'libs/platform/data-access-nrwl-changelog/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/platform/data-access-nrwl-changelog/**/*',
              ],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/platform/data-access-nrwl-changelog/karma.conf.js',
            hash: '587c6cc5d7f403a4e8f760b283dd06a63faf258e',
            ext: '.js',
          },
          {
            file: 'libs/platform/data-access-nrwl-changelog/src/index.ts',
            hash: '4890091a486dcf2261e4510f067da3729b3caa04',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-nrwl-changelog/src/lib/changelog-graphql.interfaces.ts',
            hash: '1193bfc8bb909e0435094e2ee8993a442d5c2675',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-nrwl-changelog/src/lib/changelog-graphql.service.ts',
            hash: '5844a5eda33b8e790fe0ea8d0a87b064d17b2e2b',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-nrwl-changelog/src/lib/nrwl-changelog.interfaces.ts',
            hash: '8f7945fd3aae7b0242959bedd792ee9deda9b4f3',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-nrwl-changelog/src/lib/platform-data-access-nrwl-changelog.module.ts',
            hash: 'bb698da808493372d26c6e6b2f0351bf5addd5ce',
            ext: '.ts',
          },
          {
            file: 'libs/platform/data-access-nrwl-changelog/src/test.ts',
            hash: '40ae238126b52a49932f4603239136bbab1c11fd',
            ext: '.ts',
          },
          {
            file: 'libs/platform/data-access-nrwl-changelog/tsconfig.json',
            hash: 'eeb69e8c3186705a4ee723c39c447bc4cc66b4fd',
            ext: '.json',
          },
          {
            file: 'libs/platform/data-access-nrwl-changelog/tsconfig.lib.json',
            hash: '2c46ad4390b2bb2b139d3075a3405391c8bc870c',
            ext: '.json',
          },
          {
            file: 'libs/platform/data-access-nrwl-changelog/tsconfig.spec.json',
            hash: 'b53396ef9dc0dfb75f6b723e0dbf908724e15371',
            ext: '.json',
          },
          {
            file: 'libs/platform/data-access-nrwl-changelog/tslint.json',
            hash: 'ca5cf8583639a5ed9051fe4b6ed21955a5e98e96',
            ext: '.json',
          },
        ],
      },
    },
    'nx-cloud-feature-make-ng-cli-faster': {
      name: 'nx-cloud-feature-make-ng-cli-faster',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nx-cloud/feature-make-ng-cli-faster',
        sourceRoot: 'libs/nx-cloud/feature-make-ng-cli-faster/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-cloud/feature-make-ng-cli-faster/tsconfig.lib.json',
                'libs/nx-cloud/feature-make-ng-cli-faster/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nx-cloud/feature-make-ng-cli-faster/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig:
                'libs/nx-cloud/feature-make-ng-cli-faster/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            style: 'scss',
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/nx-cloud/feature-make-ng-cli-faster/README.md',
            hash: '20b51fd9425452ed261d0ab2f3bd57cfb19891d0',
            ext: '.md',
          },
          {
            file: 'libs/nx-cloud/feature-make-ng-cli-faster/jest.config.js',
            hash: 'f81b8b5e6474245a36b5ea66a6561d31d334c5d7',
            ext: '.js',
          },
          {
            file: 'libs/nx-cloud/feature-make-ng-cli-faster/src/index.ts',
            hash: '4c8a4001ba388d3e6e4b790213a967fca4527ec5',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/feature-make-ng-cli-faster/src/lib/faster-ng-cli/faster-ng-cli.component.html',
            hash: 'c24fe3ffc6c1b4c8c581ddc1149ae8cbf420e909',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/feature-make-ng-cli-faster/src/lib/faster-ng-cli/faster-ng-cli.component.scss',
            hash: '2779189b3dcc5a5bea90080bfeb799e7a0914623',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/feature-make-ng-cli-faster/src/lib/faster-ng-cli/faster-ng-cli.component.ts',
            hash: '7cc10b672da3a4083046a76a347a1d239fc41852',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/feature-make-ng-cli-faster/src/lib/nx-cloud-feature-make-ng-cli-faster.module.ts',
            hash: 'e9d3d52630818837df2162940c13d893ea7a7cec',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/feature-make-ng-cli-faster/src/lib/tabbed-articles/tabbed-articles.component.html',
            hash: '16c54c3faeced9106d6048fd537f2d970c197483',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/feature-make-ng-cli-faster/src/lib/tabbed-articles/tabbed-articles.component.scss',
            hash: '744289b8e57eecafec394e4dec9156367c005186',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/feature-make-ng-cli-faster/src/lib/tabbed-articles/tabbed-articles.component.ts',
            hash: '605e41dbaa908892180b154eae39633bfebce79c',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/feature-make-ng-cli-faster/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/feature-make-ng-cli-faster/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/feature-make-ng-cli-faster/tsconfig.lib.json',
            hash: '2dc9b2ccd7b7f5860be847ee69b9945d7bfb3ee8',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/feature-make-ng-cli-faster/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/feature-make-ng-cli-faster/tslint.json',
            hash: '73b97fa5da957ae1c3b7c1814eb288cec20e4d7e',
            ext: '.json',
          },
        ],
      },
    },
    'nx-cloud-reference-data-access-runs': {
      name: 'nx-cloud-reference-data-access-runs',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nx-cloud/reference/data-access-runs',
        sourceRoot: 'libs/nx-cloud/reference/data-access-runs/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-cloud/reference/data-access-runs/tsconfig.lib.json',
                'libs/nx-cloud/reference/data-access-runs/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nx-cloud/reference/data-access-runs/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig:
                'libs/nx-cloud/reference/data-access-runs/jest.config.js',
              tsConfig:
                'libs/nx-cloud/reference/data-access-runs/tsconfig.spec.json',
              passWithNoTests: true,
              setupFile:
                'libs/nx-cloud/reference/data-access-runs/src/test-setup.ts',
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            style: 'scss',
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/nx-cloud/reference/data-access-runs/README.md',
            hash: 'c5165afc415da5bca080ae8819d8710c5ff1c9d3',
            ext: '.md',
          },
          {
            file: 'libs/nx-cloud/reference/data-access-runs/jest.config.js',
            hash: '1007b4ad83d13467f8cb789640739fade5a24f83',
            ext: '.js',
          },
          {
            file: 'libs/nx-cloud/reference/data-access-runs/src/index.ts',
            hash: '91cb55312c0ab4734ea15bccfdc2590ae1903206',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/data-access-runs/src/lib/run-model.ts',
            hash: '9b6b7ade859b7c419a58daf669dae7ccfded7b85',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/data-access-runs/src/lib/single-run.service.ts',
            hash: 'f0237cbd5f96b6c643709e3e6fd8f869b191215a',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/reference/data-access-runs/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/reference/data-access-runs/tsconfig.json',
            hash: '26b7b4afd192ea6de9e231782d05a8f03f80627b',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/reference/data-access-runs/tsconfig.lib.json',
            hash: '290e7bc9a4e40a6a9a2c218090e8973fc9375730',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/reference/data-access-runs/tsconfig.spec.json',
            hash: 'aed68bc6bf86609a7a4f0fdf5a562265cd90e452',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/reference/data-access-runs/tslint.json',
            hash: '367fb1ad5f3e93ce3ebd81543613cd0af99ca999',
            ext: '.json',
          },
        ],
      },
    },
    'nx-docs-site-feature-documentation': {
      name: 'nx-docs-site-feature-documentation',
      type: 'lib',
      data: {
        root: 'libs/nx-docs-site/feature-documentation',
        sourceRoot: 'libs/nx-docs-site/feature-documentation/src',
        projectType: 'library',
        prefix: 'nx-doc',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-docs-site/feature-documentation/tsconfig.lib.json',
                'libs/nx-docs-site/feature-documentation/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nx-docs-site/feature-documentation/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig:
                'libs/nx-docs-site/feature-documentation/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/schematics:component': {
            styleext: 'scss',
          },
        },
        tags: ['nx:docs-site'],
        files: [
          {
            file: 'libs/nx-docs-site/feature-documentation/jest.config.js',
            hash: '0c981f858cc3273097f77b9d67b40261ada5a4b2',
            ext: '.js',
          },
          {
            file: 'libs/nx-docs-site/feature-documentation/src/index.ts',
            hash: 'd73b9fa750de7c87bf65b02513bfa84c0949665c',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/feature-documentation/src/lib/doc-fetcher.service.ts',
            hash: '16420877f4fb9f8f28a431afe327503f276f6b01',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/feature-documentation/src/lib/document-viewer/document-viewer.component.ts',
            hash: '207df2aea79c4c6931572842bda1229132e3701e',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/feature-documentation/src/lib/feature-documentation.module.ts',
            hash: 'eba543b640346c5e6994a32176cc9680f2afa6d0',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/feature-documentation/src/lib/global-banner/global-banner.component.ts',
            hash: '312f9029d98fbbf125eac31a3ef9d75df8403bfd',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/feature-documentation/src/lib/not-found/not-found.component.html',
            hash: '0bfd10af700fb77cdb41d264500521f0ddacf3c0',
            ext: '.html',
          },
          {
            file:
              'libs/nx-docs-site/feature-documentation/src/lib/not-found/not-found.component.scss',
            hash: '2c8189837c0c97a932a6254b284e2dee03bcf65d',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-docs-site/feature-documentation/src/lib/not-found/not-found.component.ts',
            hash: '1c0cf979ab825242c41539bdfd5a9374c78a0fb3',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/feature-documentation/src/lib/shell/shell.component.ts',
            hash: '7d78be020c70db165e1f03d861bf64dd64d5b799',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/feature-documentation/src/lib/table-of-contents/table-of-contents.component.ts',
            hash: '10d3bad2916338b2d3c7aad8845d7b7d640d7f3a',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/feature-documentation/src/lib/tutorial/tutorial.component.ts',
            hash: '5938b57a7086b53b37025dc954494b25f75565b2',
            ext: '.ts',
          },
          {
            file: 'libs/nx-docs-site/feature-documentation/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nx-docs-site/feature-documentation/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/nx-docs-site/feature-documentation/tsconfig.lib.json',
            hash: 'abea8f4dfe0caf166950e1ed57b1e6563ef26d3b',
            ext: '.json',
          },
          {
            file: 'libs/nx-docs-site/feature-documentation/tsconfig.spec.json',
            hash: '2af9fb3f23a95dab0808790b3d3a86a09b55c653',
            ext: '.json',
          },
          {
            file: 'libs/nx-docs-site/feature-documentation/tslint.json',
            hash: 'ba9f74205548ce5bf6004366ec247fd2056dcc51',
            ext: '.json',
          },
        ],
      },
    },
    'nrwlio-site-pages-feature-products': {
      name: 'nrwlio-site-pages-feature-products',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nrwlio-site/pages/feature-products',
        sourceRoot: 'libs/nrwlio-site/pages/feature-products/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nrwlio-site/pages/feature-products/tsconfig.lib.json',
                'libs/nrwlio-site/pages/feature-products/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nrwlio-site/pages/feature-products/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig:
                'libs/nrwlio-site/pages/feature-products/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['nrwlio', 'type:feature'],
        files: [
          {
            file: 'libs/nrwlio-site/pages/feature-products/README.md',
            hash: '16b6ba4c232e23261d7595414361557dc82c4b53',
            ext: '.md',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-products/jest.config.js',
            hash: '01b31940b555d6ad64bb5885735c2ef30088a5fa',
            ext: '.js',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-products/src/index.ts',
            hash: 'd04aeebffa2855fe299ae4a43fe2b9d283075846',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-products/src/lib/feature-products-routing.module.ts',
            hash: '7792b292cccc62146648deb4adb5a53ced199a1d',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-products/src/lib/feature-products.module.ts',
            hash: '3f287f05471b0c19dfdfaa64d6203945fc90a7cd',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-products/src/lib/products-query.service.ts',
            hash: '893134150e98c26ef6f16c24380572b731a54a88',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-products/src/lib/products.model.ts',
            hash: 'c202f03e2c7cc8954af63707f7957607f48fb7bc',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-products/src/lib/shell/shell.component.ts',
            hash: '2cb5feb127761b36310be79ec723c3811183122a',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-products/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-products/tsconfig.json',
            hash: 'd32f55e3999447ae24e89f0e76d8c3128113c85e',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-products/tsconfig.lib.json',
            hash: 'ad83824e5f62f1e5ff2acd0960bde6bab3f87d66',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-products/tsconfig.spec.json',
            hash: 'aed68bc6bf86609a7a4f0fdf5a562265cd90e452',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-products/tslint.json',
            hash: '83044b2002861893cc69114f11d0a1c4e043917a',
            ext: '.json',
          },
        ],
      },
    },
    'nrwlio-site-pages-feature-services': {
      name: 'nrwlio-site-pages-feature-services',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nrwlio-site/pages/feature-services',
        sourceRoot: 'libs/nrwlio-site/pages/feature-services/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nrwlio-site/pages/feature-services/tsconfig.lib.json',
                'libs/nrwlio-site/pages/feature-services/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nrwlio-site/pages/feature-services/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig:
                'libs/nrwlio-site/pages/feature-services/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['nrwlio', 'type:feature'],
        files: [
          {
            file: 'libs/nrwlio-site/pages/feature-services/README.md',
            hash: '42e946e5c6e9fa8cb2707d9bcd49107a8336eb61',
            ext: '.md',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-services/jest.config.js',
            hash: 'fd5c210ab68893cabda2829b0188efa6ab6055c9',
            ext: '.js',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-services/src/index.ts',
            hash: 'f6c5fd7009dc52a318ff4b546ea28a5282f91307',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-services/src/lib/feature-services-routing.module.ts',
            hash: 'dacaa17dd5d1fde35029584dd83ee147808dabb4',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-services/src/lib/feature-services.module.ts',
            hash: '8349077dadedb06c2d2654559df50a03b85e9826',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-services/src/lib/services-card/services-card.component.scss',
            hash: '56c7413a3e2a3e8d67e64f701115a97f8b2da03f',
            ext: '.scss',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-services/src/lib/services-card/services-card.component.ts',
            hash: '82756bc7023ba42ed83f499a876ef2c88c9631d8',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-services/src/lib/services-cards-container/services-cards-container.component.scss',
            hash: 'a055d6b77c6e5964a21e4566f2b8ad7340ccddeb',
            ext: '.scss',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-services/src/lib/services-cards-container/services-cards-container.component.ts',
            hash: '8367fbf0d05edd36858d0fabe776c9c625cff0dd',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-services/src/lib/services-content.ts',
            hash: 'dd060d1f4c22387095b51910e5998c18e2adbea7',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-services/src/lib/services-solutions-container/services-solutions-container.component.scss',
            hash: '09a1f062d85c5588f548e211e291598228ecbeda',
            ext: '.scss',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-services/src/lib/services-solutions-container/services-solutions-container.component.ts',
            hash: 'd288448f3ad0f6a0b28a9898add0d70a56a8f7c8',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-services/src/lib/services.model.ts',
            hash: '96da569ed59007821f01e157665cd0d16bed5c66',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-services/src/lib/shell/shell.component.html',
            hash: 'b23de640128b540fd4bb0fa0bf6478b7d349369d',
            ext: '.html',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-services/src/lib/shell/shell.component.scss',
            hash: '393136d6c31e79c3864e503add96cbdc82f32e30',
            ext: '.scss',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-services/src/lib/shell/shell.component.ts',
            hash: 'a5a0ad2e8df7c6a9d36ac8b8af89d293b1ca0e6a',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-services/src/lib/solutions-card-dialog/solutions-card-dialog.component.scss',
            hash: '8568b3af6d6790cf623ac7c6aeca34705177ccb6',
            ext: '.scss',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-services/src/lib/solutions-card-dialog/solutions-card-dialog.component.ts',
            hash: '3d7cf2518d131e448d7da68eda2e65e2c7fe275c',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-services/src/lib/solutions-card/solutions-card.component.scss',
            hash: '5354c131417a874d54f53beab052b2b8e5da0b41',
            ext: '.scss',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-services/src/lib/solutions-card/solutions-card.component.ts',
            hash: '2161aae9b7e6ccdea18ecc7eb18e82c13a8c2f5e',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-services/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-services/tsconfig.json',
            hash: 'd32f55e3999447ae24e89f0e76d8c3128113c85e',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-services/tsconfig.lib.json',
            hash: 'ad83824e5f62f1e5ff2acd0960bde6bab3f87d66',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-services/tsconfig.spec.json',
            hash: 'aed68bc6bf86609a7a4f0fdf5a562265cd90e452',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-services/tslint.json',
            hash: '83044b2002861893cc69114f11d0a1c4e043917a',
            ext: '.json',
          },
        ],
      },
    },
    'nx-cloud-feature-billing': {
      name: 'nx-cloud-feature-billing',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nx-cloud/reference/feature-billing',
        sourceRoot: 'libs/nx-cloud/reference/feature-billing/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-cloud/reference/feature-billing/tsconfig.lib.json',
                'libs/nx-cloud/reference/feature-billing/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nx-cloud/reference/feature-billing/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig:
                'libs/nx-cloud/reference/feature-billing/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['nx-cloud', 'type:feature'],
        files: [
          {
            file: 'libs/nx-cloud/reference/feature-billing/README.md',
            hash: 'df73502c6b24138c6e314fb0eb6f8d81530cddf6',
            ext: '.md',
          },
          {
            file: 'libs/nx-cloud/reference/feature-billing/jest.config.js',
            hash: '7ac354b19c552a5feab753c7fabfd78b24f3102c',
            ext: '.js',
          },
          {
            file: 'libs/nx-cloud/reference/feature-billing/src/index.ts',
            hash: '0e19cbd265985d27d6c27a76230a894725ec785f',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-billing/src/lib/activate-subscription/activate-subscription.component.html',
            hash: 'bb6e6cdc03a525e2a4faba43c9f5034bc1a49af5',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-billing/src/lib/activate-subscription/activate-subscription.component.scss',
            hash: '21ae6e5ef9772adf43ad0f96512a85892d9fe6b3',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-billing/src/lib/activate-subscription/activate-subscription.component.ts',
            hash: '96681288ead31b51944eef4e82f2167fff3af835',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-billing/src/lib/issue-coupon-dialog/issue-coupon-dialog.component.html',
            hash: 'd8c4c2bcfc577e0c5828d831da475cad0db9d6e5',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-billing/src/lib/issue-coupon-dialog/issue-coupon-dialog.component.scss',
            hash: '553159d96540d10b28b98b6b0c97e5f5e064582e',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-billing/src/lib/issue-coupon-dialog/issue-coupon-dialog.component.ts',
            hash: '66c141dd3af28e0c5262371dbd8f8b4bce0dc435',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-billing/src/lib/main-billing/main-billing.component.html',
            hash: '3f0755fb08625d42d0142fa19a57343edd8db672',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-billing/src/lib/main-billing/main-billing.component.scss',
            hash: '35b69a94dcbbe510dc70a4f74779d4d540c1900c',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-billing/src/lib/main-billing/main-billing.component.ts',
            hash: '20b2577a6f04618a1b61f58b7d660659d3f47c72',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-billing/src/lib/nx-cloud-feature-billing.module.ts',
            hash: 'dab8380cebd182c32d6f3cac3dbbdd159285e66c',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-billing/src/lib/redeem-coupon/redeem-coupon.component.html',
            hash: 'a3349e7fc53c725282fa5142ab0c4aa13b4bd96e',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-billing/src/lib/redeem-coupon/redeem-coupon.component.scss',
            hash: 'c7acb4bf6e7f6dd478cc87d9fc5a9ee93fd12013',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-billing/src/lib/redeem-coupon/redeem-coupon.component.ts',
            hash: '10b68e9a6ba3a2ca9d058885a0136814af2c614b',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-billing/src/lib/subscription-widget/subscription-widget.component.html',
            hash: '3537d0ffd51b12325a8173110604244907b3f9a2',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-billing/src/lib/subscription-widget/subscription-widget.component.scss',
            hash: '2a563a1b07749d2d2935844415eb11ff35281072',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-billing/src/lib/subscription-widget/subscription-widget.component.ts',
            hash: 'a52abe8af5894d978d4b496997e546e349747b7e',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/reference/feature-billing/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/reference/feature-billing/tsconfig.json',
            hash: 'd32f55e3999447ae24e89f0e76d8c3128113c85e',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/reference/feature-billing/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/reference/feature-billing/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/reference/feature-billing/tslint.json',
            hash: '367fb1ad5f3e93ce3ebd81543613cd0af99ca999',
            ext: '.json',
          },
        ],
      },
    },
    'nrwlio-site-pages-feature-about-us': {
      name: 'nrwlio-site-pages-feature-about-us',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nrwlio-site/pages/feature-about-us',
        sourceRoot: 'libs/nrwlio-site/pages/feature-about-us/src',
        prefix: 'nrwl',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nrwlio-site/pages/feature-about-us/tsconfig.lib.json',
                'libs/nrwlio-site/pages/feature-about-us/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nrwlio-site/pages/feature-about-us/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig:
                'libs/nrwlio-site/pages/feature-about-us/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/nrwlio-site/pages/feature-about-us/README.md',
            hash: '9db098c3dbcb2aa8f7d5726ac3bb5e87a20f295f',
            ext: '.md',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-about-us/jest.config.js',
            hash: '09433123921d2927e5572188b3fec96945334d2c',
            ext: '.js',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-about-us/src/index.ts',
            hash: '403051952b051ca22851831c01e1b0ecc7dc058a',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-about-us/src/lib/feature-about-us.module.ts',
            hash: 'a2ec748a91b63a2e6a5ffe4e00f0aa4d373a9041',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-about-us/src/lib/founder-card/founder-card.component.html',
            hash: '07cedf6d17c577156c487ac1a5ca572e1a5c82a6',
            ext: '.html',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-about-us/src/lib/founder-card/founder-card.component.scss',
            hash: '01be5c31107ce9e91439ddff75ba933d874e3952',
            ext: '.scss',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-about-us/src/lib/founder-card/founder-card.component.ts',
            hash: 'd887292b1c10131a3d3e0fdc43c708a145032a09',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-about-us/src/lib/member-card/member-card.component.html',
            hash: '909c8f5f10d5796aee91d0551ae442e1ca7fd31f',
            ext: '.html',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-about-us/src/lib/member-card/member-card.component.scss',
            hash: 'a20ccaeee3fad577a197103bf8496d395ae813ba',
            ext: '.scss',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-about-us/src/lib/member-card/member-card.component.ts',
            hash: '348e248a8c2bbec6a78fb7de035743422a4104b7',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-about-us/src/lib/shell/shell.component.html',
            hash: '2d3c8d618adcfd8a7af69d9cb69bdbb35ba6d448',
            ext: '.html',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-about-us/src/lib/shell/shell.component.scss',
            hash: 'c3c1c2df58f2f265ee3402a9d7a263aa95e8735f',
            ext: '.scss',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-about-us/src/lib/shell/shell.component.ts',
            hash: '759ebb42ea15e8258eb7a5b6216fa02c9d0b7e6c',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-about-us/src/lib/shell/shuffle.ts',
            hash: '4ff22e741e40fb83d2f4f3f123d9dd72307147ff',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-about-us/src/lib/team-query.service.ts',
            hash: '4ee033a8a0cc15bb65e748f55533fb9e0affb11e',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-about-us/src/lib/team.model.ts',
            hash: '8c39b6156e285bfd3b8d950636fe2d4755318252',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-about-us/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-about-us/tsconfig.json',
            hash: '26b7b4afd192ea6de9e231782d05a8f03f80627b',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-about-us/tsconfig.lib.json',
            hash: 'df7eab02f0fab5de2893e9d4be54a095c8463341',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-about-us/tsconfig.spec.json',
            hash: 'aed68bc6bf86609a7a4f0fdf5a562265cd90e452',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-about-us/tslint.json',
            hash: '83044b2002861893cc69114f11d0a1c4e043917a',
            ext: '.json',
          },
        ],
      },
    },
    'nrwlio-site-pages-feature-careers': {
      name: 'nrwlio-site-pages-feature-careers',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nrwlio-site/pages/feature-careers',
        sourceRoot: 'libs/nrwlio-site/pages/feature-careers/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nrwlio-site/pages/feature-careers/tsconfig.lib.json',
                'libs/nrwlio-site/pages/feature-careers/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nrwlio-site/pages/feature-careers/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig:
                'libs/nrwlio-site/pages/feature-careers/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['nrwlio', 'type:feature'],
        files: [
          {
            file: 'libs/nrwlio-site/pages/feature-careers/README.md',
            hash: '78f6a84e5f657c34ab332d9a6d4f579533eb424b',
            ext: '.md',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-careers/jest.config.js',
            hash: '82fd6c1ff93dc3e2b36098f5e8681a1e890d924b',
            ext: '.js',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-careers/src/index.ts',
            hash: 'd4b7e8d5385ea926c8fb127ffb49aee92f963bb7',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-careers/src/lib/feature-careers.module.ts',
            hash: '90b6db341f0cce41c96765c9d2b2aa7cb5ff0530',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-careers/src/lib/job-listing-form/job-listing-form.component.html',
            hash: '8d7943b5b8ef16e6fe0edff700c6d5b2e9f02d78',
            ext: '.html',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-careers/src/lib/job-listing-form/job-listing-form.component.scss',
            hash: 'ac6999d1ecd3ed2de78e4585013788908192f5f6',
            ext: '.scss',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-careers/src/lib/job-listing-form/job-listing-form.component.ts',
            hash: 'aa581b497c23f4646735bf02478ffc6e47621545',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-careers/src/lib/job-listing/job-listing.component.html',
            hash: '6703db3e5d4d81118b50c8f38d5e3780cc6e2f1f',
            ext: '.html',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-careers/src/lib/job-listing/job-listing.component.scss',
            hash: '5edc5898778ed45bfd978a5b6bf3c3abf8192d2f',
            ext: '.scss',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-careers/src/lib/job-listing/job-listing.component.ts',
            hash: '8165b72a8a690c1a8a5f06a8c194c50803f11872',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-careers/src/lib/shell/shell.component.html',
            hash: 'bf956cb71c0578e9b2769b3259aa336213b8f6bd',
            ext: '.html',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-careers/src/lib/shell/shell.component.scss',
            hash: 'ce5aca9fb03ff3f2c6f74fce06c6256993dfa981',
            ext: '.scss',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-careers/src/lib/shell/shell.component.ts',
            hash: '2bb16f3b4a963d77d1a4cc256216e327074afc4f',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-careers/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-careers/tsconfig.json',
            hash: 'd32f55e3999447ae24e89f0e76d8c3128113c85e',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-careers/tsconfig.lib.json',
            hash: 'ad83824e5f62f1e5ff2acd0960bde6bab3f87d66',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-careers/tsconfig.spec.json',
            hash: 'aed68bc6bf86609a7a4f0fdf5a562265cd90e452',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-careers/tslint.json',
            hash: '83044b2002861893cc69114f11d0a1c4e043917a',
            ext: '.json',
          },
        ],
      },
    },
    'nx-cloud-feature-terms-of-service': {
      name: 'nx-cloud-feature-terms-of-service',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nx-cloud/feature-terms-of-service',
        sourceRoot: 'libs/nx-cloud/feature-terms-of-service/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-cloud/feature-terms-of-service/tsconfig.lib.json',
                'libs/nx-cloud/feature-terms-of-service/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nx-cloud/feature-terms-of-service/**/*',
              ],
            },
          },
          build: {
            builder: '@nrwl/angular:package',
            options: {
              tsConfig:
                'libs/nx-cloud/feature-terms-of-service/tsconfig.lib.json',
              project: 'libs/nx-cloud/feature-terms-of-service/ng-package.json',
            },
            configurations: {
              production: {
                tsConfig:
                  'libs/nx-cloud/feature-terms-of-service/tsconfig.lib.prod.json',
              },
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig:
                'libs/nx-cloud/feature-terms-of-service/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            style: 'scss',
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/nx-cloud/feature-terms-of-service/README.md',
            hash: '0fffad459f838ea0d59f1dd25541b6c2210a6fb9',
            ext: '.md',
          },
          {
            file: 'libs/nx-cloud/feature-terms-of-service/jest.config.js',
            hash: '17f09b351009d11bd725e1e19638385cf1544902',
            ext: '.js',
          },
          {
            file: 'libs/nx-cloud/feature-terms-of-service/ng-package.json',
            hash: '32249c2bcc44d43360ba02ba970b1384a4a022bf',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/feature-terms-of-service/package.json',
            hash: '951516f73158628eedf7c3cf93c198de3db9d606',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/feature-terms-of-service/src/index.ts',
            hash: '58dcaff1dde4f3a7335e11d4d4aadebc6e9a98f1',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/feature-terms-of-service/src/lib/nx-cloud-feature-terms-of-service.module.spec.ts',
            hash: 'c014ea5c879980da14d871e4145ad39a8f923ff0',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/feature-terms-of-service/src/lib/nx-cloud-feature-terms-of-service.module.ts',
            hash: '64e2a8b4af46304490b0cfac95c72655f118d2bb',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/feature-terms-of-service/src/lib/terms-of-service/terms-of-service.component.html',
            hash: 'c49ecc31f1a0d098c0c0cfc3e8b19f65cd85fadb',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/feature-terms-of-service/src/lib/terms-of-service/terms-of-service.component.scss',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/feature-terms-of-service/src/lib/terms-of-service/terms-of-service.component.ts',
            hash: 'c7a09491f2943a1868a5a4eb61e05e75460bdddf',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/feature-terms-of-service/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/feature-terms-of-service/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/feature-terms-of-service/tsconfig.lib.json',
            hash: '2dc9b2ccd7b7f5860be847ee69b9945d7bfb3ee8',
            ext: '.json',
          },
          {
            file:
              'libs/nx-cloud/feature-terms-of-service/tsconfig.lib.prod.json',
            hash: 'cbae794224800aec4b08c87a37135e334265908e',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/feature-terms-of-service/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/feature-terms-of-service/tslint.json',
            hash: '73b97fa5da957ae1c3b7c1814eb288cec20e4d7e',
            ext: '.json',
          },
        ],
      },
    },
    'platform-data-access-live-events': {
      name: 'platform-data-access-live-events',
      type: 'lib',
      data: {
        root: 'libs/platform/data-access-live-events',
        sourceRoot: 'libs/platform/data-access-live-events/src',
        projectType: 'library',
        prefix: 'nrwl-connect',
        architect: {
          'test-change-to-jest-and-rename-back': {
            builder: '@angular-devkit/build-angular:karma',
            options: {
              main: 'libs/platform/data-access-live-events/src/test.ts',
              tsConfig:
                'libs/platform/data-access-live-events/tsconfig.spec.json',
              karmaConfig:
                'libs/platform/data-access-live-events/karma.conf.js',
            },
          },
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/data-access-live-events/tsconfig.lib.json',
                'libs/platform/data-access-live-events/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/platform/data-access-live-events/**/*',
              ],
            },
          },
        },
        schematics: {},
        tags: [],
        files: [
          {
            file: 'libs/platform/data-access-live-events/karma.conf.js',
            hash: '96af149b62e40a79fcdac3012adc59710eb2fb04',
            ext: '.js',
          },
          {
            file: 'libs/platform/data-access-live-events/src/index.ts',
            hash: 'c59e85c7e2f6437b24f290e2f4f247b0df10f1dd',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-live-events/src/lib/live-event-graphql.interface.ts',
            hash: '8bae49a8c2e05cc3b7d84df723a0d41386814c3b',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-live-events/src/lib/live-event-graphql.service.ts',
            hash: '6368b8876cc5102012c289578d2ccc1c51f260ad',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-live-events/src/lib/live-event.interface.ts',
            hash: '0aedf4c8a46af63fd1618b532ee0b482f6c94e69',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-live-events/src/lib/platform-data-access-live-events.module.ts',
            hash: '183ae11ddbc0bcfb828ccbe045d5052bd83f1e27',
            ext: '.ts',
          },
          {
            file: 'libs/platform/data-access-live-events/src/test.ts',
            hash: '40ae238126b52a49932f4603239136bbab1c11fd',
            ext: '.ts',
          },
          {
            file: 'libs/platform/data-access-live-events/tsconfig.json',
            hash: '1133a7edbf84a108d49b74910f4b818c72e0455c',
            ext: '.json',
          },
          {
            file: 'libs/platform/data-access-live-events/tsconfig.lib.json',
            hash: '64ed3247e50ab9bb6e8c2ff190f69f297a2c9cda',
            ext: '.json',
          },
          {
            file: 'libs/platform/data-access-live-events/tsconfig.spec.json',
            hash: 'a77dd8d48e3630b2b250aadb6ffd5a125ca02341',
            ext: '.json',
          },
          {
            file: 'libs/platform/data-access-live-events/tslint.json',
            hash: 'ca5cf8583639a5ed9051fe4b6ed21955a5e98e96',
            ext: '.json',
          },
        ],
      },
    },
    'nx-docs-site-feature-file-system': {
      name: 'nx-docs-site-feature-file-system',
      type: 'lib',
      data: {
        root: 'libs/nx-docs-site/feature-file-system',
        sourceRoot: 'libs/nx-docs-site/feature-file-system/src',
        projectType: 'library',
        prefix: 'nx-file',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-docs-site/feature-file-system/tsconfig.lib.json',
                'libs/nx-docs-site/feature-file-system/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nx-docs-site/feature-file-system/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig:
                'libs/nx-docs-site/feature-file-system/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/schematics:component': {
            styleext: 'scss',
          },
        },
        tags: ['nx:docs-site'],
        files: [
          {
            file: 'libs/nx-docs-site/feature-file-system/jest.config.js',
            hash: '36fd6fc666ec7de164e059edbd8db21112e315be',
            ext: '.js',
          },
          {
            file: 'libs/nx-docs-site/feature-file-system/src/index.ts',
            hash: 'a779892504e2f7a2c700423e6839ea71789e17ea',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/feature-file-system/src/lib/base-path-token..ts',
            hash: '02162ac928af0e342610a3659b71c9772962b27b',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/feature-file-system/src/lib/feature-file-system.module.ts',
            hash: '860be56e568244fe6a8f06b19437749905f8e7c5',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/feature-file-system/src/lib/file-system.interceptor.ts',
            hash: '347613c5199350487a2c6e28a1503a3edfacbd84',
            ext: '.ts',
          },
          {
            file: 'libs/nx-docs-site/feature-file-system/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nx-docs-site/feature-file-system/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/nx-docs-site/feature-file-system/tsconfig.lib.json',
            hash: 'fa6a8c02c1eb4cfff52481c91f10ad3c3bbb754f',
            ext: '.json',
          },
          {
            file: 'libs/nx-docs-site/feature-file-system/tsconfig.spec.json',
            hash: 'cf7b15e93f4bcc4fc11f6cfec6b651d22450b3c0',
            ext: '.json',
          },
          {
            file: 'libs/nx-docs-site/feature-file-system/tslint.json',
            hash: '2f2928147f07c0a00794b15482d223c555f80279',
            ext: '.json',
          },
        ],
      },
    },
    'platform-feature-nrwl-changelog': {
      name: 'platform-feature-nrwl-changelog',
      type: 'lib',
      data: {
        root: 'libs/platform/feature-nrwl-changelog',
        sourceRoot: 'libs/platform/feature-nrwl-changelog/src',
        projectType: 'library',
        prefix: 'angular-console',
        architect: {
          'test-change-to-jest-and-rename-back': {
            builder: '@angular-devkit/build-angular:karma',
            options: {
              main: 'libs/platform/feature-nrwl-changelog/src/test.ts',
              tsConfig:
                'libs/platform/feature-nrwl-changelog/tsconfig.spec.json',
              karmaConfig: 'libs/platform/feature-nrwl-changelog/karma.conf.js',
            },
          },
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/feature-nrwl-changelog/tsconfig.lib.json',
                'libs/platform/feature-nrwl-changelog/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/platform/feature-nrwl-changelog/**/*',
              ],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/platform/feature-nrwl-changelog/karma.conf.js',
            hash: '7c6db7bc8b9f75856ad18081212405ca91f160ff',
            ext: '.js',
          },
          {
            file: 'libs/platform/feature-nrwl-changelog/src/index.ts',
            hash: '7ad67a0c0dfed57083a907f65e0aeb0307ea5d58',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-nrwl-changelog/src/lib/nrwl-changelog/nrwl-changelog.component.html',
            hash: '6cf5a68939e53bcbcf8c05986cd95a67265810b1',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-nrwl-changelog/src/lib/nrwl-changelog/nrwl-changelog.component.scss',
            hash: 'c0775f93ae04e53ed2c44e190bd018c28a570cf1',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-nrwl-changelog/src/lib/nrwl-changelog/nrwl-changelog.component.ts',
            hash: 'e64f99528ebdc733c6515a087f324536816bf5d0',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-nrwl-changelog/src/lib/platform-feature-nrwl-changelog.module.ts',
            hash: 'a03800cd4d5767c65f68127e45a21cca4a80b0aa',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-nrwl-changelog/src/test.ts',
            hash: '40ae238126b52a49932f4603239136bbab1c11fd',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-nrwl-changelog/tsconfig.json',
            hash: '8c8dd086f99335d47c1f2f3e47fd3b8af7429293',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-nrwl-changelog/tsconfig.lib.json',
            hash: 'e2f6edeb610d91a34338854c0970e33fc5825cff',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-nrwl-changelog/tsconfig.spec.json',
            hash: '09e49bebe294da76d18dad02c7f35bb5e40ef2f4',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-nrwl-changelog/tslint.json',
            hash: '2a88bfbfbe8c85a62dcbe985dc55e07f3483ece9',
            ext: '.json',
          },
        ],
      },
    },
    'platform-feature-live-broadcast': {
      name: 'platform-feature-live-broadcast',
      type: 'lib',
      data: {
        root: 'libs/platform/feature-live-broadcast',
        sourceRoot: 'libs/platform/feature-live-broadcast/src',
        projectType: 'library',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/feature-live-broadcast/tsconfig.lib.json',
                'libs/platform/feature-live-broadcast/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/platform/feature-live-broadcast/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/platform/feature-live-broadcast/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/schematics:component': {
            styleext: 'scss',
          },
        },
        tags: ['type:feature'],
        files: [
          {
            file: 'libs/platform/feature-live-broadcast/README.md',
            hash: '0335c1187110dbc5176e70d79f372f69447a6a3f',
            ext: '.md',
          },
          {
            file: 'libs/platform/feature-live-broadcast/jest.config.js',
            hash: 'e6fb0eeb919607362482593002f017a7ee23d22e',
            ext: '.js',
          },
          {
            file: 'libs/platform/feature-live-broadcast/src/index.ts',
            hash: '75fff1ce9f4c7bd51d86b7229fb2415e38b6aa44',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-live-broadcast/src/lib/broadcast-is-live.guard.ts',
            hash: 'd04b17b8c18e1e0d5afe8e15a1d497cc9b69a137',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-live-broadcast/src/lib/live-broadcast/live-broadcast.component.html',
            hash: '93be3fa5fd94fb0614164578c33fc36a3cedfde1',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-live-broadcast/src/lib/live-broadcast/live-broadcast.component.scss',
            hash: 'cff5219f62d8337a84d91b3e78f04d293152f432',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-live-broadcast/src/lib/live-broadcast/live-broadcast.component.ts',
            hash: 'ade4473db86ec67db869518dcbfb3ffef2a7f556',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-live-broadcast/src/lib/platform-feature-live-broadcast.module.ts',
            hash: '7f070b442e490b10a2e5dba8b5d914c1877bb226',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-live-broadcast/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-live-broadcast/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-live-broadcast/tsconfig.lib.json',
            hash: 'c9ee31a70bcaa62995ddfeeaa303d5723ca03ef4',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-live-broadcast/tsconfig.spec.json',
            hash: '3a4b4ed3422cb9d9b80930ff7a97360d1b0829c7',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-live-broadcast/tslint.json',
            hash: '9e6c1d1b0582f60745530f104d6a0168beb5cc35',
            ext: '.json',
          },
        ],
      },
    },
    'nrwlio-site-data-access-graphql': {
      name: 'nrwlio-site-data-access-graphql',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nrwlio-site/data-access-graphql',
        sourceRoot: 'libs/nrwlio-site/data-access-graphql/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nrwlio-site/data-access-graphql/tsconfig.lib.json',
                'libs/nrwlio-site/data-access-graphql/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nrwlio-site/data-access-graphql/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nrwlio-site/data-access-graphql/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {},
        tags: ['nrwlio', 'type:data-access'],
        files: [
          {
            file: 'libs/nrwlio-site/data-access-graphql/README.md',
            hash: '00f73702d2401a17238acf283dd422e99d9c1f58',
            ext: '.md',
          },
          {
            file: 'libs/nrwlio-site/data-access-graphql/jest.config.js',
            hash: 'a6792631b50cd3b5b23e941c2b0c6216b5d33d17',
            ext: '.js',
          },
          {
            file: 'libs/nrwlio-site/data-access-graphql/src/index.ts',
            hash: '31fb47646a62e0931d3affdca20396cdeb7a4371',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/data-access-graphql/src/lib/authorization.token.ts',
            hash: 'db37b5941bb901bba811947a83aee4077a2ce3e3',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/data-access-graphql/src/lib/data-access-graphql.module.ts',
            hash: '36874d5132fc71747ff833530622dbe9e5983304',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/data-access-graphql/src/lib/graphql-uri.token.ts',
            hash: 'b2eb69ec877e380b4e75189a07c98b469a292e85',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/data-access-graphql/src/lib/graphql.module.ts',
            hash: '6d6dd90a218f0ed41c49ca3f144e5619d096e919',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/data-access-graphql/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/data-access-graphql/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/data-access-graphql/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/data-access-graphql/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/data-access-graphql/tslint.json',
            hash: '5708d7147ddece6af5375119e6cc1a3a9032fb77',
            ext: '.json',
          },
        ],
      },
    },
    'nx-cloud-reference-feature-runs': {
      name: 'nx-cloud-reference-feature-runs',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nx-cloud/reference/feature-runs',
        sourceRoot: 'libs/nx-cloud/reference/feature-runs/src',
        prefix: 'nx-cloud',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-cloud/reference/feature-runs/tsconfig.lib.json',
                'libs/nx-cloud/reference/feature-runs/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nx-cloud/reference/feature-runs/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nx-cloud/reference/feature-runs/jest.config.js',
              tsConfig:
                'libs/nx-cloud/reference/feature-runs/tsconfig.spec.json',
              passWithNoTests: true,
              setupFile:
                'libs/nx-cloud/reference/feature-runs/src/test-setup.ts',
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            style: 'scss',
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/nx-cloud/reference/feature-runs/README.md',
            hash: 'f4f7494624d254c008a72ee341d0677b0083770f',
            ext: '.md',
          },
          {
            file: 'libs/nx-cloud/reference/feature-runs/jest.config.js',
            hash: '92e763a161226daf7a86a56a143cd95ec1961e77',
            ext: '.js',
          },
          {
            file: 'libs/nx-cloud/reference/feature-runs/src/index.ts',
            hash: 'd86aeb979e85807b59196358d6ce45df1621b010',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-runs/src/lib/date-helpers.ts',
            hash: '4ebd4212289cc8c6a57a6d9711d35bad1b598f23',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-runs/src/lib/nx-cloud-feature-runs.module.ts',
            hash: '0d7cfa0e32377400c70fa29a20625cc6027a83c7',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-runs/src/lib/run-header/run-header.component.ts',
            hash: '7ce65d0e896783961b938a2197949c5836932ee4',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-runs/src/lib/run-machine-info/run-machine-info.component.ts',
            hash: '6fb14b3212e09da8dd954703e6912f9ae5928713',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-runs/src/lib/run-nav/run-nav.component.ts',
            hash: '9b9c00b6c6764d111e784547eba9e0ff5d36c3c1',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-runs/src/lib/run-not-found/run-not-found.component.ts',
            hash: '58f55811aafba2b125c94729b5b66b8b250380e0',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-runs/src/lib/run-summary/run-summary.component.html',
            hash: '04b3a9eb77f3e701918942276dacc50ec0c4d5d7',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-runs/src/lib/run-summary/run-summary.component.scss',
            hash: '215e912260323a9bb5ce58c512a169b8cffc975c',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-runs/src/lib/run-summary/run-summary.component.ts',
            hash: 'a68eff25fb06edcc04883e24a8d2c10e49545862',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-runs/src/lib/run-tasks/run-tasks.component.html',
            hash: 'fa7b791b5cb30a71b515203ec00f350dde01082b',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-runs/src/lib/run-tasks/run-tasks.component.scss',
            hash: '5a3268650784d2c5554a2bb92609f3d780e6ab3a',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-runs/src/lib/run-tasks/run-tasks.component.ts',
            hash: 'd49f2c9a59d7c903a02581a9621f25a80f77b95b',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-runs/src/lib/run-unclaimed/run-unclaimed.component.ts',
            hash: 'f3e455f9045d94aa72c4e6933277c964f882b8cf',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-runs/src/lib/run-view-container/run-view-container.component.html',
            hash: '3ee3ce3cebbe78af6cbe88670ab46c498c103cd1',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-runs/src/lib/run-view-container/run-view-container.component.scss',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-runs/src/lib/run-view-container/run-view-container.component.ts',
            hash: 'e0e87cba59f281c7e13a0d99a162c8009362da08',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-runs/src/lib/run-view/run-view.component.html',
            hash: '6fd49964804283c9c27b214ea2461567901232be',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-runs/src/lib/run-view/run-view.component.scss',
            hash: '8af7c0c535d0dc9045c451dcda4ba77b5c02a65c',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-runs/src/lib/run-view/run-view.component.ts',
            hash: '52a0af16b66333eaa6a49324735e7ea923cce1a7',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-runs/src/lib/task-view-container/task-view-container.component.html',
            hash: 'be28c5de23931da60ce17504a7d47c74dddfd697',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-runs/src/lib/task-view-container/task-view-container.component.scss',
            hash: '162c7b0cf7da00a11676f17e5975b607832466ca',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-runs/src/lib/task-view-container/task-view-container.component.ts',
            hash: '9b81ede573ce750322a874ad6dbbb7d887fa2864',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-runs/src/lib/task-view/task-view.component.html',
            hash: 'c9a6b3af2ac3f79444ab0755cef48c63972bfcf3',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-runs/src/lib/task-view/task-view.component.scss',
            hash: 'c35c15c377efbb4f355a1d9380ef657736157b2d',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-runs/src/lib/task-view/task-view.component.ts',
            hash: 'cff20ed65691141383ef9f5ce45228fbd2c29c3d',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/reference/feature-runs/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/reference/feature-runs/tsconfig.json',
            hash: '84157387af379e1c971afc56ccdf47c4f22e50e6',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/reference/feature-runs/tsconfig.lib.json',
            hash: 'fcb4bde4058b8f8fc5a19f4591ad3d2be990d210',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/reference/feature-runs/tsconfig.spec.json',
            hash: 'aed68bc6bf86609a7a4f0fdf5a562265cd90e452',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/reference/feature-runs/tslint.json',
            hash: 'c67b6e765c02e516176e7b045cd3d99253deb694',
            ext: '.json',
          },
        ],
      },
    },
    'platform-feature-organizations': {
      name: 'platform-feature-organizations',
      type: 'lib',
      data: {
        root: 'libs/platform/feature-organizations',
        sourceRoot: 'libs/platform/feature-organizations/src',
        projectType: 'library',
        prefix: 'angular-console',
        architect: {
          'test-change-to-jest-and-rename-back': {
            builder: '@angular-devkit/build-angular:karma',
            options: {
              main: 'libs/platform/feature-organizations/src/test.ts',
              tsConfig:
                'libs/platform/feature-organizations/tsconfig.spec.json',
              karmaConfig: 'libs/platform/feature-organizations/karma.conf.js',
            },
          },
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/feature-organizations/tsconfig.lib.json',
                'libs/platform/feature-organizations/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/platform/feature-organizations/**/*',
              ],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/platform/feature-organizations/karma.conf.js',
            hash: '8b286256c5bf0c57497c693f1d45ac35e58775dd',
            ext: '.js',
          },
          {
            file: 'libs/platform/feature-organizations/src/index.ts',
            hash: 'a9669ce58d33daec4b5451cb4c1aa5b7d593bb4b',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-organizations/src/lib/all-organizations/all-organizations.component.html',
            hash: 'a7d707875609293dfe6e81cecfca49d875ce0434',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-organizations/src/lib/all-organizations/all-organizations.component.scss',
            hash: 'c3257fa6f72f25e660d03549fd443547ebc08707',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-organizations/src/lib/all-organizations/all-organizations.component.ts',
            hash: 'a6896857b0fd5b57e04c2e9ca15420a8559caab3',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-organizations/src/lib/create-organization-dialog/create-organization-dialog.component.html',
            hash: '2656aa24eb4357bcb0eed4d9abce1a3b287a6757',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-organizations/src/lib/create-organization-dialog/create-organization-dialog.component.scss',
            hash: 'ddc5b4c3bed9b7804076416a2b7b7e3b18c7d49a',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-organizations/src/lib/create-organization-dialog/create-organization-dialog.component.ts',
            hash: '4c83f7266bfbe9d6d41d13bed4ee8b66299badea',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-organizations/src/lib/platform-feature-organizations.module.ts',
            hash: '3b3a90e652a17925c691677c6bc02b8781a7e975',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-organizations/src/lib/update-organization-dialog/update-organization-dialog.component.html',
            hash: 'e7b86a65d4a0c1e6eb534eae777becb30efe1e6a',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-organizations/src/lib/update-organization-dialog/update-organization-dialog.component.scss',
            hash: 'ddc5b4c3bed9b7804076416a2b7b7e3b18c7d49a',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-organizations/src/lib/update-organization-dialog/update-organization-dialog.component.ts',
            hash: '1494397081b2d993ed981d619bf01942c9c54c2b',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-organizations/src/test.ts',
            hash: '40ae238126b52a49932f4603239136bbab1c11fd',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-organizations/tsconfig.json',
            hash: '8c8dd086f99335d47c1f2f3e47fd3b8af7429293',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-organizations/tsconfig.lib.json',
            hash: 'c661f7008a9d11abf042df0842455e5c4552dab1',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-organizations/tsconfig.spec.json',
            hash: 'c03212b40c98f889872f0d547ea2de56b31f5074',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-organizations/tslint.json',
            hash: '2a88bfbfbe8c85a62dcbe985dc55e07f3483ece9',
            ext: '.json',
          },
        ],
      },
    },
    'platform-feature-live-workshop': {
      name: 'platform-feature-live-workshop',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/platform/feature-live-workshop',
        sourceRoot: 'libs/platform/feature-live-workshop/src',
        prefix: 'live-workshop',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/feature-live-workshop/tsconfig.lib.json',
                'libs/platform/feature-live-workshop/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/platform/feature-live-workshop/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/platform/feature-live-workshop/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['type:feature', 'platform:client', 'scope:live-workshop'],
        files: [
          {
            file: 'libs/platform/feature-live-workshop/README.md',
            hash: '26a1f56627ed9d17160d38dfe15b2863773bdac0',
            ext: '.md',
          },
          {
            file: 'libs/platform/feature-live-workshop/jest.config.js',
            hash: '1cb890335658134d222713fb883b2279b0f64937',
            ext: '.js',
          },
          {
            file: 'libs/platform/feature-live-workshop/src/index.ts',
            hash: 'e6ef636c754a4c355652cde6686a0aaf63fc7e4a',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-live-workshop/src/lib/archives/archives.component.html',
            hash: '655c0c9d43df37a2907078b22858ea934a3c97d9',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-live-workshop/src/lib/archives/archives.component.scss',
            hash: '2aa8ac49b7be50239b42c4d60604a56afe9f597b',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-live-workshop/src/lib/archives/archives.component.ts',
            hash: '45b22223e43f6d1f2dd73c71e1da28a03300fc6e',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-live-workshop/src/lib/live-workshop-collection.query.ts',
            hash: '71f38e4c68d6d96eef7f5aa2d50e9ada35dc08bc',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-live-workshop/src/lib/live-workshop-single.query.ts',
            hash: '821a2a5759093d526ea7fb543aa59773deebc0b9',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-live-workshop/src/lib/live-workshop.interface.ts',
            hash: 'ff423ee9e249205312dfab3cf3b0bbc364a7ef9c',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-live-workshop/src/lib/live-workshop/live-workshop.component.html',
            hash: '333647d3380339435fccf81c7e3795fb3e7dd677',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-live-workshop/src/lib/live-workshop/live-workshop.component.scss',
            hash: '63c6d16190c818c699e29ddc8927a04720467fb1',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-live-workshop/src/lib/live-workshop/live-workshop.component.ts',
            hash: '4ee4f385a2a70ee474059aac383e89474e547b9e',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-live-workshop/src/lib/platform-feature-live-workshop.module.ts',
            hash: '2ba768b596e95c198d45abe507a350e50be8386e',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-live-workshop/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-live-workshop/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-live-workshop/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-live-workshop/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-live-workshop/tslint.json',
            hash: '3bf2b5a1886e0a4fbb407725fd0143f4311b9cd6',
            ext: '.json',
          },
        ],
      },
    },
    'nrwlio-site-pages-feature-home': {
      name: 'nrwlio-site-pages-feature-home',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nrwlio-site/pages/feature-home',
        sourceRoot: 'libs/nrwlio-site/pages/feature-home/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nrwlio-site/pages/feature-home/tsconfig.lib.json',
                'libs/nrwlio-site/pages/feature-home/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nrwlio-site/pages/feature-home/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nrwlio-site/pages/feature-home/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['nrwlio', 'type:feature'],
        files: [
          {
            file: 'libs/nrwlio-site/pages/feature-home/README.md',
            hash: '1ba8c967939240adb60ca836e21877b24b9a64c1',
            ext: '.md',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-home/jest.config.js',
            hash: '8f174d04ec085426dce539906c1b68de071c7d34',
            ext: '.js',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-home/src/index.ts',
            hash: '5215d835a11efe7e884e08f137a0d5d988ae37c7',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-home/src/lib/feature-home.module.ts',
            hash: 'c00ef255df02e82c946fe7181f19ee869503710a',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-home/src/lib/home-query.service.ts',
            hash: 'c9a7bd917c3cc4d50111fe92fde627c5bc95a3a4',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-home/src/lib/home.model.ts',
            hash: 'bc2cb0ec2e5cfe3316389e3f44acd8510835a108',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-home/src/lib/shell/shell.component.html',
            hash: '510045f35c447c5584cc0afa14f6dd98e79a1b88',
            ext: '.html',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-home/src/lib/shell/shell.component.scss',
            hash: '7b6de9a71f53d00b4e1b62f67b7bffa33210b371',
            ext: '.scss',
          },
          {
            file:
              'libs/nrwlio-site/pages/feature-home/src/lib/shell/shell.component.ts',
            hash: '03c17e54b8aafc65e053975298b809338d77eacb',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-home/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-home/tsconfig.json',
            hash: 'd32f55e3999447ae24e89f0e76d8c3128113c85e',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-home/tsconfig.lib.json',
            hash: 'ad83824e5f62f1e5ff2acd0960bde6bab3f87d66',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-home/tsconfig.spec.json',
            hash: 'aed68bc6bf86609a7a4f0fdf5a562265cd90e452',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/pages/feature-home/tslint.json',
            hash: '83044b2002861893cc69114f11d0a1c4e043917a',
            ext: '.json',
          },
        ],
      },
    },
    'nx-cloud-reference-feature-org': {
      name: 'nx-cloud-reference-feature-org',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nx-cloud/reference/feature-org',
        sourceRoot: 'libs/nx-cloud/reference/feature-org/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-cloud/reference/feature-org/tsconfig.lib.json',
                'libs/nx-cloud/reference/feature-org/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nx-cloud/reference/feature-org/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nx-cloud/reference/feature-org/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {},
        tags: [],
        files: [
          {
            file: 'libs/nx-cloud/reference/feature-org/README.md',
            hash: '0b97b2dc877780287998aadf28ad7d6ca4c60d92',
            ext: '.md',
          },
          {
            file: 'libs/nx-cloud/reference/feature-org/jest.config.js',
            hash: '5ace402384639a1d0e06cfa3e28a766422847710',
            ext: '.js',
          },
          {
            file: 'libs/nx-cloud/reference/feature-org/src/index.ts',
            hash: '3c811bda003b4bc32b9ead760c764080026738f9',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-org/src/lib/edit-member-role-dialog/edit-member-role-dialog.component.html',
            hash: 'ded91758e7cfc0b6c2501a871b33cf53c862f7b1',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-org/src/lib/edit-member-role-dialog/edit-member-role-dialog.component.scss',
            hash: 'fd13e721dd7d23ca4f274092fe44b55f276590f7',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-org/src/lib/edit-member-role-dialog/edit-member-role-dialog.component.ts',
            hash: '63fec1204c6584365b5fa76d594e5906c8f35095',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-org/src/lib/nx-cloud-feature-org.module.ts',
            hash: 'dc8aab5d4b026d416f129d87b07e7ffcae90ce37',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-org/src/lib/org-list/org-list.component.html',
            hash: '1cbe4f985b3631d975ea03d6944b97b759edcd8d',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-org/src/lib/org-list/org-list.component.scss',
            hash: '802b27894fb0cbef5b625e271e3e855fe006244c',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-org/src/lib/org-list/org-list.component.ts',
            hash: '93bfad67aa9fe27529ec3097c4739f0533e2971b',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-org/src/lib/org-member-list/org-member-list.component.html',
            hash: '4a1c2523b9086c8ebd6a86e263b81c8b3006fd3e',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-org/src/lib/org-member-list/org-member-list.component.scss',
            hash: '0787a74c605bb04757302a8bba09586c81a572e8',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-org/src/lib/org-member-list/org-member-list.component.ts',
            hash: '5183797f1ae2803c9b71b18d3d3dd46228171825',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-org/src/lib/remove-member-dialog/remove-member-dialog.component.html',
            hash: '218b4e8b1494e46f0d076c0e8042f592c3fa7e4d',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-org/src/lib/remove-member-dialog/remove-member-dialog.component.scss',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-org/src/lib/remove-member-dialog/remove-member-dialog.component.ts',
            hash: 'd45425a5e82b4988da343c8c753409fc3ec46aea',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-org/src/lib/workspace-list/workspace-list.component.html',
            hash: '920636f0b6123cb66552c98064dc3526c62ce33b',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-org/src/lib/workspace-list/workspace-list.component.scss',
            hash: 'cb2c5c049e2097e8d8ba9163f7c541d5fca073f1',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-org/src/lib/workspace-list/workspace-list.component.ts',
            hash: 'b7d0accde0b6f5e0d37dbaf8f2d28224eb8cca7e',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-org/src/lib/workspace-setup/workspace-setup.component.html',
            hash: '26cae7aea242ec0d1af9e8b6f267be6cff5c1e9f',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-org/src/lib/workspace-setup/workspace-setup.component.scss',
            hash: '36be9fb1713b67115494e8b0692bb15356ab3b62',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/reference/feature-org/src/lib/workspace-setup/workspace-setup.component.ts',
            hash: '0da6eb132a8b37f070a82eceef8fe54ab2b5d5ed',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/reference/feature-org/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/reference/feature-org/tsconfig.json',
            hash: 'd32f55e3999447ae24e89f0e76d8c3128113c85e',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/reference/feature-org/tsconfig.lib.json',
            hash: 'ad83824e5f62f1e5ff2acd0960bde6bab3f87d66',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/reference/feature-org/tsconfig.spec.json',
            hash: 'aed68bc6bf86609a7a4f0fdf5a562265cd90e452',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/reference/feature-org/tslint.json',
            hash: 'c67b6e765c02e516176e7b045cd3d99253deb694',
            ext: '.json',
          },
        ],
      },
    },
    'nx-cloud-admin-feature-support': {
      name: 'nx-cloud-admin-feature-support',
      type: 'lib',
      data: {
        root: 'libs/nx-cloud/admin/feature-support',
        sourceRoot: 'libs/nx-cloud/admin/feature-support/src',
        projectType: 'library',
        schematics: {},
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-cloud/admin/feature-support/tsconfig.lib.json',
                'libs/nx-cloud/admin/feature-support/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nx-cloud/admin/feature-support/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nx-cloud/admin/feature-support/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/nx-cloud/admin/feature-support/README.md',
            hash: '6ed38c56734ad37b28ffdf6902eab5277e0d8425',
            ext: '.md',
          },
          {
            file: 'libs/nx-cloud/admin/feature-support/jest.config.js',
            hash: '10a382f63b51d50f9f61bc3d7f6e3f0eeecd1048',
            ext: '.js',
          },
          {
            file: 'libs/nx-cloud/admin/feature-support/src/index.ts',
            hash: 'e5069a9be4f71c0df8a349b5627419832ea179d4',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/admin/feature-support/src/lib/login-as-user-dialog.component.html',
            hash: '22757681dc0d23b112a11147d8ccbb8088e41cb4',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/admin/feature-support/src/lib/login-as-user-dialog.component.scss',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/admin/feature-support/src/lib/login-as-user-dialog.component.ts',
            hash: '26d1a304a331f026e016cb90e867d634a41301db',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/admin/feature-support/src/lib/nx-cloud-feature-support.module.ts',
            hash: '873c09d6c8322119b1318a428f8b1ef79cce763b',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/admin/feature-support/tsconfig.json',
            hash: 'd32f55e3999447ae24e89f0e76d8c3128113c85e',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/admin/feature-support/tsconfig.lib.json',
            hash: 'a174cb09c30e46285517c7308247d602414aa63f',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/admin/feature-support/tsconfig.spec.json',
            hash: 'd38f29ed71dc44f512e29dbc921ffb582729b444',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/admin/feature-support/tslint.json',
            hash: '952b9914894707b221712ff43059f7286a388d61',
            ext: '.json',
          },
        ],
      },
    },
    'platform-feature-organization': {
      name: 'platform-feature-organization',
      type: 'lib',
      data: {
        root: 'libs/platform/feature-organization',
        sourceRoot: 'libs/platform/feature-organization/src',
        projectType: 'library',
        prefix: 'angular-console',
        architect: {
          'test-change-to-jest-and-rename-back': {
            builder: '@angular-devkit/build-angular:karma',
            options: {
              main: 'libs/platform/feature-organization/src/test.ts',
              tsConfig: 'libs/platform/feature-organization/tsconfig.spec.json',
              karmaConfig: 'libs/platform/feature-organization/karma.conf.js',
            },
          },
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/feature-organization/tsconfig.lib.json',
                'libs/platform/feature-organization/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/platform/feature-organization/**/*',
              ],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/platform/feature-organization/karma.conf.js',
            hash: '8b286256c5bf0c57497c693f1d45ac35e58775dd',
            ext: '.js',
          },
          {
            file: 'libs/platform/feature-organization/src/index.ts',
            hash: '1f510721d13667fe7a19d0c60e9c84547da788e0',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-organization/src/lib/bulk-create-organization-membership-dialog/bulk-create-organization-membership-dialog.component.html',
            hash: '5fbd571d3561e581e5615fb1eb84bf21255ec23c',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-organization/src/lib/bulk-create-organization-membership-dialog/bulk-create-organization-membership-dialog.component.scss',
            hash: '165bc2254e461d997301c7d4d45c5debda3b4822',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-organization/src/lib/bulk-create-organization-membership-dialog/bulk-create-organization-membership-dialog.component.ts',
            hash: '812235072cca1986da5b827a54e922b47ecb8d33',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-organization/src/lib/bulk-create-organization-membership-user/bulk-create-organization-membership-user.component.html',
            hash: '03e078cdb8aee7d1ae9a15b7359e6feef37575b1',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-organization/src/lib/bulk-create-organization-membership-user/bulk-create-organization-membership-user.component.scss',
            hash: '7e809efd095e4815c8052e34bae6cc3302a5389c',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-organization/src/lib/bulk-create-organization-membership-user/bulk-create-organization-membership-user.component.ts',
            hash: '9ef5d042b3534ec6c993094a90bd77e3991f0a5e',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-organization/src/lib/bulk-input-users-for-organization-membership-dialog/bulk-input-users-for-organization-membership-dialog.component.html',
            hash: 'daaaa1aa4766d4986b3f2353be88d4b87c2c93e6',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-organization/src/lib/bulk-input-users-for-organization-membership-dialog/bulk-input-users-for-organization-membership-dialog.component.scss',
            hash: '4a14b8085f7697f837f2312890563e5baa8572c6',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-organization/src/lib/bulk-input-users-for-organization-membership-dialog/bulk-input-users-for-organization-membership-dialog.component.ts',
            hash: '57e09829bc31ac22771079f869b2af9777eeb85d',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-organization/src/lib/delete-organization-membership-confirmation-dialog/delete-organization-membership-confirmation-dialog.component.html',
            hash: '489f486dc51dafd1f4a0b1e50ce1b47f07fcdf0f',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-organization/src/lib/delete-organization-membership-confirmation-dialog/delete-organization-membership-confirmation-dialog.component.scss',
            hash: '8f5c580105b58f80494dfc9f104b7770d57419d3',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-organization/src/lib/delete-organization-membership-confirmation-dialog/delete-organization-membership-confirmation-dialog.component.ts',
            hash: '8037e7c3686e9f982ce6c37227a3bdfc10974310',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-organization/src/lib/delete-organization-membership-progress-dialog/delete-organization-membership-progress-dialog.component.html',
            hash: '1cddc28bc94eb26121b8ead8c447dae0388e150a',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-organization/src/lib/delete-organization-membership-progress-dialog/delete-organization-membership-progress-dialog.component.scss',
            hash: '8f5c580105b58f80494dfc9f104b7770d57419d3',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-organization/src/lib/delete-organization-membership-progress-dialog/delete-organization-membership-progress-dialog.component.ts',
            hash: 'ac85c1d33479fa37e7781a1562f65086c14f0c41',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-organization/src/lib/organization-members/organization-members.component.html',
            hash: '1c6e2be2fc8776f8bf019fe3a9410a50b4856579',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-organization/src/lib/organization-members/organization-members.component.scss',
            hash: '8da9e5db7323f24da920747e20040a03c9fc43cf',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-organization/src/lib/organization-members/organization-members.component.ts',
            hash: 'eb33b64822f522234bf40d4e24241a8e51335fd4',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-organization/src/lib/organization-settings/organization-settings.component.html',
            hash: '36b39ba3cbc1a91b32aac72346bd67a9f7c4c084',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-organization/src/lib/organization-settings/organization-settings.component.scss',
            hash: '3487d5943b187af0e4fa46665eee61db5b19fb3f',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-organization/src/lib/organization-settings/organization-settings.component.ts',
            hash: '76744a0a48d217b685f47f86f957354c8e5930ab',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-organization/src/lib/organization-shell/organization-shell.component.html',
            hash: '0680b43f9c6ae05df91c576141f20ed411d07c7d',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-organization/src/lib/organization-shell/organization-shell.component.scss',
            hash: '5d4e87f30f6362b8597dbe54a44aadaffa915763',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-organization/src/lib/organization-shell/organization-shell.component.ts',
            hash: '4192c65da8ac734c8f68db14e2c86a229684f3c9',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-organization/src/lib/platform-feature-org.module.ts',
            hash: '53784e6f19c10703889b4996d384fb77dd7d9105',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-organization/src/lib/update-organization-membership-role-dialog/update-organization-membership-role-dialog.component.html',
            hash: 'e8f879266087ddc23379da8b327eefb6206c0cf2',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-organization/src/lib/update-organization-membership-role-dialog/update-organization-membership-role-dialog.component.scss',
            hash: '43a0eb55d35117e30fd9e2b1a011783cc62585d9',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-organization/src/lib/update-organization-membership-role-dialog/update-organization-membership-role-dialog.component.ts',
            hash: '093d206e072afb7bca7540e2fb775eb5ed5c7c08',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-organization/src/test.ts',
            hash: '40ae238126b52a49932f4603239136bbab1c11fd',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-organization/tsconfig.json',
            hash: '8c8dd086f99335d47c1f2f3e47fd3b8af7429293',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-organization/tsconfig.lib.json',
            hash: '2ffb5e66a7d6aa2dbea95e2d71e06746559e4a9d',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-organization/tsconfig.spec.json',
            hash: '21b3e552eef48c91174181f478641e5a2c545350',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-organization/tslint.json',
            hash: '2a88bfbfbe8c85a62dcbe985dc55e07f3483ece9',
            ext: '.json',
          },
        ],
      },
    },
    'platform-data-access-cookbook': {
      name: 'platform-data-access-cookbook',
      type: 'lib',
      data: {
        root: 'libs/platform/data-access-cookbook',
        sourceRoot: 'libs/platform/data-access-cookbook/src',
        projectType: 'library',
        prefix: 'nrwl-connect',
        architect: {
          'test-change-to-jest-and-rename-back': {
            builder: '@angular-devkit/build-angular:karma',
            options: {
              main: 'libs/platform/data-access-cookbook/src/test.ts',
              tsConfig: 'libs/platform/data-access-cookbook/tsconfig.spec.json',
              karmaConfig: 'libs/platform/data-access-cookbook/karma.conf.js',
            },
          },
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/data-access-cookbook/tsconfig.lib.json',
                'libs/platform/data-access-cookbook/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/platform/data-access-cookbook/**/*',
              ],
            },
          },
        },
        tags: ['data-access'],
        files: [
          {
            file: 'libs/platform/data-access-cookbook/karma.conf.js',
            hash: '4c44f16bedbe82c1b415f86f531a29e847ab4a80',
            ext: '.js',
          },
          {
            file: 'libs/platform/data-access-cookbook/src/index.ts',
            hash: '88220c79cf76c42b5507daa7a88fe3485949f909',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-cookbook/src/lib/platform-data-access-cookbook.module.ts',
            hash: 'e7152b08857101aee29cb74de4e24bd2beaa5b70',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-cookbook/src/lib/recipe-graphql.interface.ts',
            hash: '93368ecfd38e021ad9aee8769acab15edde14f35',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-cookbook/src/lib/recipe-graphql.service.ts',
            hash: '1f7ec0b7d44172d404b8e28b87bcd22a5f117eba',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-cookbook/src/lib/recipe.interface.ts',
            hash: 'bd0cb079d928f732e1af9490c0897dc45d544b7f',
            ext: '.ts',
          },
          {
            file: 'libs/platform/data-access-cookbook/src/test.ts',
            hash: '40ae238126b52a49932f4603239136bbab1c11fd',
            ext: '.ts',
          },
          {
            file: 'libs/platform/data-access-cookbook/tsconfig.lib.json',
            hash: '87a39d406e35c7d915dccd1a9126721f0665737a',
            ext: '.json',
          },
          {
            file: 'libs/platform/data-access-cookbook/tsconfig.spec.json',
            hash: 'c442173514a2a7b09622365f6e7475eb108971f8',
            ext: '.json',
          },
          {
            file: 'libs/platform/data-access-cookbook/tslint.json',
            hash: 'ca5cf8583639a5ed9051fe4b6ed21955a5e98e96',
            ext: '.json',
          },
        ],
      },
    },
    'platform-feature-landing-page': {
      name: 'platform-feature-landing-page',
      type: 'lib',
      data: {
        root: 'libs/platform/feature-landing-page',
        sourceRoot: 'libs/platform/feature-landing-page/src',
        projectType: 'library',
        prefix: 'nx-cloud',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/feature-landing-page/tsconfig.lib.json',
                'libs/platform/feature-landing-page/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/platform/feature-landing-page/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/platform/feature-landing-page/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/schematics:component': {
            styleext: 'scss',
          },
        },
        tags: ['type:feature'],
        files: [
          {
            file: 'libs/platform/feature-landing-page/README.md',
            hash: '9e09667dc8cd5634f0b1023085d4ec4990430a56',
            ext: '.md',
          },
          {
            file: 'libs/platform/feature-landing-page/jest.config.js',
            hash: '628648f70960c7dae8f4db62002014611394c8f0',
            ext: '.js',
          },
          {
            file: 'libs/platform/feature-landing-page/src/index.ts',
            hash: 'ff1c35223e13b1fbc319f7c5786ccfc878300a34',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-landing-page/src/lib/landing-page/landing-page.component.html',
            hash: '933454f09c91107f1c8c1c9c9bc668d01b397109',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-landing-page/src/lib/landing-page/landing-page.component.scss',
            hash: '75b52bbd3019f781497186c216792389666aaf66',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-landing-page/src/lib/landing-page/landing-page.component.ts',
            hash: '915d4103f9aee0df01c040e2147dd0e0aaa448e2',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-landing-page/src/lib/platform-feature-landing-page.module.ts',
            hash: '481ad29004fda84af4122b2d105ad1b31aa08bb5',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-landing-page/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-landing-page/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-landing-page/tsconfig.lib.json',
            hash: '18eb36dfff4a71ba57347dcd67fbb1c7a2af88d7',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-landing-page/tsconfig.spec.json',
            hash: '316edb6547196c51245bc041da37b7628d83fee4',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-landing-page/tslint.json',
            hash: '9e6c1d1b0582f60745530f104d6a0168beb5cc35',
            ext: '.json',
          },
        ],
      },
    },
    'platform-data-access-graphql': {
      name: 'platform-data-access-graphql',
      type: 'lib',
      data: {
        root: 'libs/platform/data-access-graphql',
        sourceRoot: 'libs/platform/data-access-graphql/src',
        projectType: 'library',
        architect: {
          'test-change-to-jest-and-rename-back': {
            builder: '@angular-devkit/build-angular:karma',
            options: {
              main: 'libs/platform/data-access-graphql/src/test.ts',
              karmaConfig: 'libs/platform/data-access-graphql/karma.conf.js',
              scripts: [],
              styles: [],
              assets: [],
              tsConfig: 'libs/platform/data-access-graphql/tsconfig.spec.json',
            },
          },
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/data-access-graphql/tsconfig.lib.json',
                'libs/platform/data-access-graphql/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/platform/data-access-graphql/**/*',
              ],
            },
          },
        },
        prefix: '',
        tags: [],
        files: [
          {
            file: 'libs/platform/data-access-graphql/karma.conf.js',
            hash: 'fd5080706855d0ab41abf9c1b83c739d7e824b3f',
            ext: '.js',
          },
          {
            file: 'libs/platform/data-access-graphql/src/index.ts',
            hash: 'e733de44f02555860c3b0e443bbbe65b17eaa3dd',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-graphql/src/lib/data-access-graphql.module.ts',
            hash: '8d55492e7cd87994e77cee2bc9b908380ed62c0b',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-graphql/src/lib/environment-config.service.ts',
            hash: '4cf865294c69038abd89613e4cb1ede09a0f3fe6',
            ext: '.ts',
          },
          {
            file: 'libs/platform/data-access-graphql/src/lib/models.ts',
            hash: '0947f0c1b025bff2bac12f6ae1d3047c1b1cfb8a',
            ext: '.ts',
          },
          {
            file: 'libs/platform/data-access-graphql/src/lib/nrwl-api-error.ts',
            hash: '30cee86bd3a6ff55aa4918c25850ac81d8129a8f',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-graphql/src/lib/organizations.state.ts',
            hash: 'ca7d6ac2092a85bea08f9292858b0c25fbcfba03',
            ext: '.ts',
          },
          {
            file: 'libs/platform/data-access-graphql/src/lib/users.state.ts',
            hash: '9c3dbc66858f612330decc82a5a7d32d0a3150e8',
            ext: '.ts',
          },
          {
            file: 'libs/platform/data-access-graphql/src/test.ts',
            hash: '40ae238126b52a49932f4603239136bbab1c11fd',
            ext: '.ts',
          },
          {
            file: 'libs/platform/data-access-graphql/tsconfig.json',
            hash: '8c8dd086f99335d47c1f2f3e47fd3b8af7429293',
            ext: '.json',
          },
          {
            file: 'libs/platform/data-access-graphql/tsconfig.lib.json',
            hash: '25ce3a78f6b2de351dc3acad094e62bfda195881',
            ext: '.json',
          },
          {
            file: 'libs/platform/data-access-graphql/tsconfig.spec.json',
            hash: 'a7368e8bc238970aa2f2c08910363f39fbf358fd',
            ext: '.json',
          },
          {
            file: 'libs/platform/data-access-graphql/tslint.json',
            hash: '95392b22f1daff08c314b72981978732803832fe',
            ext: '.json',
          },
        ],
      },
    },
    'platform-feature-live-events': {
      name: 'platform-feature-live-events',
      type: 'lib',
      data: {
        root: 'libs/platform/feature-live-events',
        sourceRoot: 'libs/platform/feature-live-events/src',
        projectType: 'library',
        prefix: 'angular-console',
        architect: {
          'test-change-to-jest-and-rename-back': {
            builder: '@angular-devkit/build-angular:karma',
            options: {
              main: 'libs/platform/feature-live-events/src/test.ts',
              tsConfig: 'libs/platform/feature-live-events/tsconfig.spec.json',
              karmaConfig: 'libs/platform/feature-live-events/karma.conf.js',
            },
          },
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/feature-live-events/tsconfig.lib.json',
                'libs/platform/feature-live-events/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/platform/feature-live-events/**/*',
              ],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/platform/feature-live-events/karma.conf.js',
            hash: '50ee68dd12d689c237479bb35c6cb826ea14a4d9',
            ext: '.js',
          },
          {
            file: 'libs/platform/feature-live-events/src/index.ts',
            hash: '947c961ef1de299fdb2ac908fd6075d81ebb6ceb',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-live-events/src/lib/live-event-detail/live-event-detail.component.html',
            hash: 'eedceda41823bf6ddaa7488f666177d330414db6',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-live-events/src/lib/live-event-detail/live-event-detail.component.scss',
            hash: '6918f9dc86c8fe19a8778bb80a071c37763ecfa8',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-live-events/src/lib/live-event-detail/live-event-detail.component.ts',
            hash: '71229c78dfb0ea8581e030c72a2aa597c6f633c5',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-live-events/src/lib/live-events/live-events.component.html',
            hash: '76a133c46b9e6f7187ad73630fe86cd51690de16',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-live-events/src/lib/live-events/live-events.component.scss',
            hash: '2aa8ac49b7be50239b42c4d60604a56afe9f597b',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-live-events/src/lib/live-events/live-events.component.ts',
            hash: 'd8a2189e0640ede217eec82cf21b0aba6e638ea0',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-live-events/src/lib/platform-feature-live-events.module.ts',
            hash: '77934b757cd56dac8090ba921e29820b8ceaeb76',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-live-events/src/test.ts',
            hash: '40ae238126b52a49932f4603239136bbab1c11fd',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-live-events/tsconfig.json',
            hash: '8c8dd086f99335d47c1f2f3e47fd3b8af7429293',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-live-events/tsconfig.lib.json',
            hash: 'd1fecdbd3178371edcc88896b799ce1142cf268d',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-live-events/tsconfig.spec.json',
            hash: '2fe51028d95e2448fba46697ac8bfb3909ef5e60',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-live-events/tslint.json',
            hash: '2a88bfbfbe8c85a62dcbe985dc55e07f3483ece9',
            ext: '.json',
          },
        ],
      },
    },
    'platform-data-access-courses': {
      name: 'platform-data-access-courses',
      type: 'lib',
      data: {
        root: 'libs/platform/data-access-courses',
        sourceRoot: 'libs/platform/data-access-courses/src',
        projectType: 'library',
        prefix: 'nrwl-connect',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/data-access-courses/tsconfig.lib.json',
                'libs/platform/data-access-courses/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/platform/data-access-courses/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/platform/data-access-courses/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {},
        tags: ['type:data-access'],
        files: [
          {
            file: 'libs/platform/data-access-courses/README.md',
            hash: '287ed1db8cf030848cbe8dbdb83ef2217c00baa7',
            ext: '.md',
          },
          {
            file: 'libs/platform/data-access-courses/jest.config.js',
            hash: 'e96a3224a635bbb02d0c1822e0770e091cbf6137',
            ext: '.js',
          },
          {
            file: 'libs/platform/data-access-courses/src/index.ts',
            hash: '5a4a8045edb684a6bd268ea77aa63442e3d9c60a',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-courses/src/lib/+state/compound-selectors/course-lessons-by-course-id.selector.ts',
            hash: '2039d28e5679bec52daf38b38f9821dc1fe4ade5',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-courses/src/lib/+state/compound-selectors/course-overview.selector.ts',
            hash: 'eb258f7c53574bd93bd8cb1c97df58fe5a55651c',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-courses/src/lib/+state/compound-selectors/index.ts',
            hash: '99b443bf545b344b87954a3e7bf72775c0e54c7e',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-courses/src/lib/+state/course-lessons/course-lessons.actions.ts',
            hash: '0faef61e2b1402c767ac5c4bc52f38f7e066bd25',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-courses/src/lib/+state/course-lessons/course-lessons.effects.ts',
            hash: '5aa4a70556a27b128a5fd6a49d536ab90a578360',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-courses/src/lib/+state/course-lessons/course-lessons.reducer.spec.ts',
            hash: '28f03a13b1f984251b146ab82d68f718997d423a',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-courses/src/lib/+state/course-lessons/course-lessons.reducer.ts',
            hash: '58ac130e27b20bc9d1cc54fa6d73928a4791d7a7',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-courses/src/lib/+state/course-lessons/course-lessons.selectors.spec.ts',
            hash: 'd0e4110680360b68db7e196944be14ad29a25d7b',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-courses/src/lib/+state/course-lessons/course-lessons.selectors.ts',
            hash: '6fed2f3ee8e0be1a45bd5007635ef532c7fb56c6',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-courses/src/lib/+state/course-lessons/index.ts',
            hash: 'e790406311040d8c7d92800aca5eeb318f17c34f',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-courses/src/lib/+state/course-sections/course-sections.effects.ts',
            hash: '7fe03910e408160de245d69cc0b9915b86edcb2a',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-courses/src/lib/+state/course-sections/course-sections.reducer.spec.ts',
            hash: '38c5af1937c5bfd2b4fba88a8b047374315fd8e8',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-courses/src/lib/+state/course-sections/course-sections.reducer.ts',
            hash: 'cb89ecfba5a8e3820c3f1aff31256a693ce65839',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-courses/src/lib/+state/course-sections/course-sections.selectors.spec.ts',
            hash: '15e91a8ab968af613d9bab0034caa5ff55de93d1',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-courses/src/lib/+state/course-sections/course-sections.selectors.ts',
            hash: 'e81bdd132e783826c137da7968698fc4e5efaa39',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-courses/src/lib/+state/course-sections/index.ts',
            hash: '134e0d6c4258fdf04a13d3969f010e2e99ae259e',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-courses/src/lib/+state/courses/courses.actions.ts',
            hash: '1eec23a0412337843fa5bcd4a06217ab01252664',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-courses/src/lib/+state/courses/courses.effects.ts',
            hash: '7f261b3a78761a6ceae993726e79af4ec511c30b',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-courses/src/lib/+state/courses/courses.reducer.spec.ts',
            hash: 'de04c62f1293324653af09f80387327fef2106e0',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-courses/src/lib/+state/courses/courses.reducer.ts',
            hash: '9b92ccce0882a892d67fee1659a1bc93e212bdba',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-courses/src/lib/+state/courses/courses.selectors.spec.ts',
            hash: 'c7855774c59b26f35cad5397332a2516dc66f793',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-courses/src/lib/+state/courses/courses.selectors.ts',
            hash: '63f778a9461c87df585de151e00032288aed3532',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-courses/src/lib/+state/courses/index.ts',
            hash: '2bdea63d7eca555a7b51b54f6db5a8d6cfa67334',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-courses/src/lib/course-overview.interface.ts',
            hash: 'ea876394895372fc883962d5a3bf8cebdcec143d',
            ext: '.ts',
          },
          {
            file: 'libs/platform/data-access-courses/src/lib/course.service.ts',
            hash: '611b8cb4fcf1f1f271a6f60dda81b561eb7b42e2',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-courses/src/lib/platform-data-access-courses.module.ts',
            hash: 'e770edabef0d77e31b6c7e802bbfa090158c3421',
            ext: '.ts',
          },
          {
            file: 'libs/platform/data-access-courses/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-courses/src/test/generic-courses-store-state.ts',
            hash: '1565faa336bee3fc7f3489ca4be4e2c731ce2bad',
            ext: '.ts',
          },
          {
            file: 'libs/platform/data-access-courses/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/platform/data-access-courses/tsconfig.lib.json',
            hash: '90f0e1d335c6d2c5f36c707c195a4ec5585515a0',
            ext: '.json',
          },
          {
            file: 'libs/platform/data-access-courses/tsconfig.spec.json',
            hash: '63f53d94c05e87b706f8808710e228d4415b0171',
            ext: '.json',
          },
          {
            file: 'libs/platform/data-access-courses/tslint.json',
            hash: '9e6c1d1b0582f60745530f104d6a0168beb5cc35',
            ext: '.json',
          },
        ],
      },
    },
    'nx-cloud-data-access-graphql': {
      name: 'nx-cloud-data-access-graphql',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nx-cloud/data-access-graphql',
        sourceRoot: 'libs/nx-cloud/data-access-graphql/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-cloud/data-access-graphql/tsconfig.lib.json',
                'libs/nx-cloud/data-access-graphql/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nx-cloud/data-access-graphql/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nx-cloud/data-access-graphql/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {},
        tags: ['nx-cloud', 'type:data-access'],
        files: [
          {
            file: 'libs/nx-cloud/data-access-graphql/README.md',
            hash: '2686d80decfb36b4ca07261dce0d687a866338b1',
            ext: '.md',
          },
          {
            file: 'libs/nx-cloud/data-access-graphql/jest.config.js',
            hash: '5f30965454ba31773f557b8c679acf7cf9d23629',
            ext: '.js',
          },
          {
            file: 'libs/nx-cloud/data-access-graphql/src/index.ts',
            hash: 'f6d06578044d9577669f15235af93a1d62b4d46a',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/data-access-graphql/src/lib/contentful-configuration.token.ts',
            hash: 'a91e19cfb633b66ad0202ca45779497e0fb71017',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/data-access-graphql/src/lib/environment-config.service.ts',
            hash: '7a6856d7d2c71dc4574b549fcb1cbdc4e5041b21',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/data-access-graphql/src/lib/models.ts',
            hash: 'f83834dc204f62fc738a5111bc8c2b8892600251',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/data-access-graphql/src/lib/nrwl-api-error.ts',
            hash: '30cee86bd3a6ff55aa4918c25850ac81d8129a8f',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/data-access-graphql/src/lib/nx-cloud-data-access-graphql.module.ts',
            hash: '7f9290d0ddb6af7ce9a5b0510b1053c39e4f5cf6',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/data-access-graphql/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/data-access-graphql/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/data-access-graphql/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/data-access-graphql/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/data-access-graphql/tslint.json',
            hash: '73b97fa5da957ae1c3b7c1814eb288cec20e4d7e',
            ext: '.json',
          },
        ],
      },
    },
    'nx-docs-site-feature-flavors': {
      name: 'nx-docs-site-feature-flavors',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nx-docs-site/feature-flavors',
        sourceRoot: 'libs/nx-docs-site/feature-flavors/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-docs-site/feature-flavors/tsconfig.lib.json',
                'libs/nx-docs-site/feature-flavors/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nx-docs-site/feature-flavors/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nx-docs-site/feature-flavors/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['nx:docs-site'],
        files: [
          {
            file: 'libs/nx-docs-site/feature-flavors/README.md',
            hash: 'ea28835fe50e9f0ac1b76330749a4869c6ef403c',
            ext: '.md',
          },
          {
            file: 'libs/nx-docs-site/feature-flavors/jest.config.js',
            hash: '60f22d4e790020be983b801fb2c24793cda462ea',
            ext: '.js',
          },
          {
            file: 'libs/nx-docs-site/feature-flavors/src/index.ts',
            hash: '7e15d47357b0c50d47bb36e50134ae81e11e5f23',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/feature-flavors/src/lib/feature-flavors.module.ts',
            hash: 'bc3f26ac3b9c7dbdc4326b6eccdfd8b0415f0aa8',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/feature-flavors/src/lib/flavor-redirect.guard.ts',
            hash: '3436480d12febe433c064219f4b26662cda35d58',
            ext: '.ts',
          },
          {
            file: 'libs/nx-docs-site/feature-flavors/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nx-docs-site/feature-flavors/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/nx-docs-site/feature-flavors/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/nx-docs-site/feature-flavors/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/nx-docs-site/feature-flavors/tslint.json',
            hash: '73b97fa5da957ae1c3b7c1814eb288cec20e4d7e',
            ext: '.json',
          },
        ],
      },
    },
    'nx-docs-site-feature-plugins': {
      name: 'nx-docs-site-feature-plugins',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nx-docs-site/feature-plugins',
        sourceRoot: 'libs/nx-docs-site/feature-plugins/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-docs-site/feature-plugins/tsconfig.lib.json',
                'libs/nx-docs-site/feature-plugins/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nx-docs-site/feature-plugins/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nx-docs-site/feature-plugins/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['nx:docs-site'],
        files: [
          {
            file: 'libs/nx-docs-site/feature-plugins/README.md',
            hash: 'e951632b50f1c8c71de15a7dfb29f4d27eb04a8e',
            ext: '.md',
          },
          {
            file: 'libs/nx-docs-site/feature-plugins/jest.config.js',
            hash: '0c201f69adc1aaa587e0e6baedbc4ceed2a6bd48',
            ext: '.js',
          },
          {
            file: 'libs/nx-docs-site/feature-plugins/src/index.ts',
            hash: '110fc31c11b56707b1813deae5b8d178af387da4',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/feature-plugins/src/lib/feature-plugins.module.ts',
            hash: '8e18ff4d69028a6060a2693ff6c22967441b2dc8',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/feature-plugins/src/lib/github-icon/github-icon.component.ts',
            hash: 'eeffc2b6f4b44afcb30924b18db82610084a855b',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/feature-plugins/src/lib/npm-icon/npm-icon.component.ts',
            hash: 'ec66856bbf2515fddaac4013fb9d95bfe998b0c6',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/feature-plugins/src/lib/plugin-card/plugin-card.component.html',
            hash: '8b5e463ad5d9f8c5e9ec9feb2f0c80ab8bdf4ffe',
            ext: '.html',
          },
          {
            file:
              'libs/nx-docs-site/feature-plugins/src/lib/plugin-card/plugin-card.component.scss',
            hash: 'bb8ebe84bdf277a29bcff705c3d78ade24688888',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-docs-site/feature-plugins/src/lib/plugin-card/plugin-card.component.ts',
            hash: '2ea2f6637628e252025e440a93beea7733a8f9c5',
            ext: '.ts',
          },
          {
            file: 'libs/nx-docs-site/feature-plugins/src/lib/plugins.model.ts',
            hash: '88864282643c14962da1d93344bcf2073e8403ba',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/feature-plugins/src/lib/plugins.service.ts',
            hash: '4d4424e1378c07043ad38091c155e721b3ed3659',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/feature-plugins/src/lib/shell/shell.component.html',
            hash: 'dc816c7b47f5ffe7bca1c2be1d922603fcb16c93',
            ext: '.html',
          },
          {
            file:
              'libs/nx-docs-site/feature-plugins/src/lib/shell/shell.component.scss',
            hash: 'd17e68ac089d287b72511560eaee950ba9a89043',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-docs-site/feature-plugins/src/lib/shell/shell.component.ts',
            hash: '9a91eaf463593fa6784541314f15741d7c05238f',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/feature-plugins/src/lib/yarn-icon/yarn-icon.component.ts',
            hash: 'd72e71f0e8dc303707301c9d22bae66014392a03',
            ext: '.ts',
          },
          {
            file: 'libs/nx-docs-site/feature-plugins/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nx-docs-site/feature-plugins/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/nx-docs-site/feature-plugins/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/nx-docs-site/feature-plugins/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/nx-docs-site/feature-plugins/tslint.json',
            hash: '73b97fa5da957ae1c3b7c1814eb288cec20e4d7e',
            ext: '.json',
          },
        ],
      },
    },
    'platform-feature-expert-bio': {
      name: 'platform-feature-expert-bio',
      type: 'lib',
      data: {
        root: 'libs/platform/feature-expert-bio',
        sourceRoot: 'libs/platform/feature-expert-bio/src',
        projectType: 'library',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/feature-expert-bio/tsconfig.lib.json',
                'libs/platform/feature-expert-bio/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/platform/feature-expert-bio/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/platform/feature-expert-bio/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/schematics:component': {
            styleext: 'scss',
          },
        },
        tags: ['type:feature'],
        files: [
          {
            file: 'libs/platform/feature-expert-bio/README.md',
            hash: '209b64566416f22ed94ed36f7752a797d12d857c',
            ext: '.md',
          },
          {
            file: 'libs/platform/feature-expert-bio/jest.config.js',
            hash: 'f1542b9d106dbea0dd1e481bb95ec98d90274120',
            ext: '.js',
          },
          {
            file: 'libs/platform/feature-expert-bio/src/index.ts',
            hash: 'fe52dee1d0f58ca62c287ca6c338da0ffb8c3940',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-expert-bio/src/lib/bio-page/bio-page.component.html',
            hash: '0797c88c83e1480e4b51c7d9acaf4f6528d20a82',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-expert-bio/src/lib/bio-page/bio-page.component.scss',
            hash: '58df1a4fc6085c1aefac4bdb5c04487670eb8e42',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-expert-bio/src/lib/bio-page/bio-page.component.ts',
            hash: '6c0bfbbf0aa8183e6cfe87098aafd0e2ab583393',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-expert-bio/src/lib/platform-feature-expert-bio.module.ts',
            hash: '9537f5367b0922d1f95cc4209c67406608276edf',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-expert-bio/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-expert-bio/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-expert-bio/tsconfig.lib.json',
            hash: '321febd8781818b93e686f149ef01b3f174cd25d',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-expert-bio/tsconfig.spec.json',
            hash: '8e96674435dd5888dd414038b92596c27f54f706',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-expert-bio/tslint.json',
            hash: '9e6c1d1b0582f60745530f104d6a0168beb5cc35',
            ext: '.json',
          },
        ],
      },
    },
    'nrwlio-site-ui-text-sliders': {
      name: 'nrwlio-site-ui-text-sliders',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nrwlio-site/ui/text-sliders',
        sourceRoot: 'libs/nrwlio-site/ui/text-sliders/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nrwlio-site/ui/text-sliders/tsconfig.lib.json',
                'libs/nrwlio-site/ui/text-sliders/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nrwlio-site/ui/text-sliders/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nrwlio-site/ui/text-sliders/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['nrwlio', 'type:ui'],
        files: [
          {
            file: 'libs/nrwlio-site/ui/text-sliders/README.md',
            hash: 'e91896af443421d6b8df209c98d58313f312506a',
            ext: '.md',
          },
          {
            file: 'libs/nrwlio-site/ui/text-sliders/jest.config.js',
            hash: 'd4aad40ff7f9315b1d412ce8411d41a904911a1d',
            ext: '.js',
          },
          {
            file: 'libs/nrwlio-site/ui/text-sliders/src/index.ts',
            hash: '7426363bf720ea51d2707fddd7a0b8e9588f3107',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/ui/text-sliders/src/lib/ui-text-sliders.module.ts',
            hash: '9894b57d5d5f03a38f7a39c5681775dedc648d65',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/ui/text-sliders/src/lib/vertical-text-slider/vertical-text-slider.component.html',
            hash: 'c159f7757f9347c70c2289b6d8aaff40d183f4d5',
            ext: '.html',
          },
          {
            file:
              'libs/nrwlio-site/ui/text-sliders/src/lib/vertical-text-slider/vertical-text-slider.component.scss',
            hash: 'b55825b9daaa2c12c05eda5d6ca3154c02ee32f4',
            ext: '.scss',
          },
          {
            file:
              'libs/nrwlio-site/ui/text-sliders/src/lib/vertical-text-slider/vertical-text-slider.component.ts',
            hash: '675ce07d4d8d3e667e27b29b1eea6e42487b562f',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/ui/text-sliders/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/ui/text-sliders/tsconfig.json',
            hash: 'd32f55e3999447ae24e89f0e76d8c3128113c85e',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/ui/text-sliders/tsconfig.lib.json',
            hash: 'ad83824e5f62f1e5ff2acd0960bde6bab3f87d66',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/ui/text-sliders/tsconfig.spec.json',
            hash: 'aed68bc6bf86609a7a4f0fdf5a562265cd90e452',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/ui/text-sliders/tslint.json',
            hash: '83044b2002861893cc69114f11d0a1c4e043917a',
            ext: '.json',
          },
        ],
      },
    },
    'nx-docs-site-feature-search': {
      name: 'nx-docs-site-feature-search',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nx-docs-site/feature-search',
        sourceRoot: 'libs/nx-docs-site/feature-search/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-docs-site/feature-search/tsconfig.lib.json',
                'libs/nx-docs-site/feature-search/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nx-docs-site/feature-search/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nx-docs-site/feature-search/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            style: 'scss',
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/nx-docs-site/feature-search/README.md',
            hash: '440f5a5f413d40bc185786d9d03408514bf52e19',
            ext: '.md',
          },
          {
            file: 'libs/nx-docs-site/feature-search/jest.config.js',
            hash: '726e2b17e4e1c2a5af2851f57225a1638e3e11aa',
            ext: '.js',
          },
          {
            file: 'libs/nx-docs-site/feature-search/src/index.ts',
            hash: 'a1528057fb80f37feea65d90ebfb2b19c24a54ac',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/feature-search/src/lib/algolia-search.component.scss',
            hash: '32153a52e7b225e72dbb0fbb88bf770787150904',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-docs-site/feature-search/src/lib/algolia-search.component.ts',
            hash: 'b872e568b4a029ee5642fae8a202cb6b842e81ed',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/feature-search/src/lib/feature-search.module.ts',
            hash: 'bcb6f59c47509236c4848955e49d7f89d61ffe9a',
            ext: '.ts',
          },
          {
            file: 'libs/nx-docs-site/feature-search/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nx-docs-site/feature-search/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/nx-docs-site/feature-search/tsconfig.lib.json',
            hash: '2dc9b2ccd7b7f5860be847ee69b9945d7bfb3ee8',
            ext: '.json',
          },
          {
            file: 'libs/nx-docs-site/feature-search/tsconfig.lib.prod.json',
            hash: 'cbae794224800aec4b08c87a37135e334265908e',
            ext: '.json',
          },
          {
            file: 'libs/nx-docs-site/feature-search/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/nx-docs-site/feature-search/tslint.json',
            hash: '1769007a5f840a03d0aeb280688ab6ca6ce59cce',
            ext: '.json',
          },
        ],
      },
    },
    'platform-feature-dashboard': {
      name: 'platform-feature-dashboard',
      type: 'lib',
      data: {
        root: 'libs/platform/feature-dashboard',
        sourceRoot: 'libs/platform/feature-dashboard/src',
        projectType: 'library',
        architect: {
          'test-change-to-jest-and-rename-back': {
            builder: '@angular-devkit/build-angular:karma',
            options: {
              main: 'libs/platform/feature-dashboard/src/test.ts',
              karmaConfig: 'libs/platform/feature-dashboard/karma.conf.js',
              scripts: [],
              styles: [],
              assets: [],
              tsConfig: 'libs/platform/feature-dashboard/tsconfig.spec.json',
            },
          },
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/feature-dashboard/tsconfig.lib.json',
                'libs/platform/feature-dashboard/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/platform/feature-dashboard/**/*',
              ],
            },
          },
        },
        prefix: '',
        tags: [],
        files: [
          {
            file: 'libs/platform/feature-dashboard/karma.conf.js',
            hash: 'fd5080706855d0ab41abf9c1b83c739d7e824b3f',
            ext: '.js',
          },
          {
            file: 'libs/platform/feature-dashboard/src/index.ts',
            hash: '3feac3930da550cca8c3ec8c60d89167d9fe1685',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-dashboard/src/lib/dashboard.module.ts',
            hash: '645b7e6aad9fa9b79ae7efe65d46b7293e072937',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-dashboard/src/lib/dashboard/dashboard.component.html',
            hash: '63122fdd473e3016df422037911e56caa3cd69b1',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-dashboard/src/lib/dashboard/dashboard.component.scss',
            hash: '3b8dcb058be45e06e222b7d0ae69bf64fa5fc81c',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-dashboard/src/lib/dashboard/dashboard.component.ts',
            hash: '00814d063f8fd33f11aed3a52c4e204b59adcedb',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-dashboard/src/lib/featured-book/featured-book.component.html',
            hash: '5e4510ecfab46bbe7ec35ef3e597c3ea6b3149a1',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-dashboard/src/lib/featured-book/featured-book.component.scss',
            hash: 'f4f08915ca021433222b3cae9704a7dc9b4176b8',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-dashboard/src/lib/featured-book/featured-book.component.ts',
            hash: '21a3bc7e0dd2983c4385e314ae6973ec8d704fd2',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-dashboard/src/lib/featured-changelog/featured-changelog.component.html',
            hash: '735b6d73fda186f5e5476ca0f3f1dba2fa08ea7b',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-dashboard/src/lib/featured-changelog/featured-changelog.component.scss',
            hash: 'f4f08915ca021433222b3cae9704a7dc9b4176b8',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-dashboard/src/lib/featured-changelog/featured-changelog.component.ts',
            hash: 'efac60dbe18bc09f6989ceecc4e3a430ec11ab05',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-dashboard/src/lib/featured-connect-live/featured-connect-live.component.html',
            hash: '9d3c4b6e4017029d9df49746ff3b70dae273fc47',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-dashboard/src/lib/featured-connect-live/featured-connect-live.component.scss',
            hash: 'f318e2c4ab504dd62276cd84824f4318184b0f5e',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-dashboard/src/lib/featured-connect-live/featured-connect-live.component.ts',
            hash: 'ee72ce6cbb721df056e0cab6eb5bc7ea9b33a9f3',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-dashboard/src/lib/featured-course/featured-course.component.html',
            hash: '18456a961ef8e581d490658ab2f1a9a7e60eac69',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-dashboard/src/lib/featured-course/featured-course.component.scss',
            hash: 'f4f08915ca021433222b3cae9704a7dc9b4176b8',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-dashboard/src/lib/featured-course/featured-course.component.ts',
            hash: 'c132e88a6afa71d6baa2e51fc78c997e460fc423',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-dashboard/src/lib/featured-expert/featured-expert.component.html',
            hash: 'e2ff4bc623f416147ee75af8d258d47d21695bbc',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-dashboard/src/lib/featured-expert/featured-expert.component.scss',
            hash: 'f4f08915ca021433222b3cae9704a7dc9b4176b8',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-dashboard/src/lib/featured-expert/featured-expert.component.ts',
            hash: '9c8e49bfabb0fa6ffd8a525fb33d6477bf304cc4',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-dashboard/src/lib/featured-recipe/featured-recipe.component.html',
            hash: '2b17bde7cc83c529074f70c0dff65249a8877511',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-dashboard/src/lib/featured-recipe/featured-recipe.component.scss',
            hash: 'f4f08915ca021433222b3cae9704a7dc9b4176b8',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-dashboard/src/lib/featured-recipe/featured-recipe.component.ts',
            hash: '5a18a18b9da8740ed9236c4b12d6d0b204b4e8c0',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-dashboard/src/lib/featured-topic/featured-topic.component.html',
            hash: 'f0f01a3ef30648d35ad6f9c5c9f8ee90f489b5c7',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-dashboard/src/lib/featured-topic/featured-topic.component.scss',
            hash: 'f4f08915ca021433222b3cae9704a7dc9b4176b8',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-dashboard/src/lib/featured-topic/featured-topic.component.ts',
            hash: 'dbab944a329e0f38f737d05eeae555ea51a726a9',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-dashboard/src/test.ts',
            hash: '40ae238126b52a49932f4603239136bbab1c11fd',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-dashboard/tsconfig.json',
            hash: '8c8dd086f99335d47c1f2f3e47fd3b8af7429293',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-dashboard/tsconfig.lib.json',
            hash: '7e4b368161f3d11659e9e3044ea78c33a7abd925',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-dashboard/tsconfig.spec.json',
            hash: '27490b05e2605e3286f010079e7ac3d50878cf8e',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-dashboard/tslint.json',
            hash: '95392b22f1daff08c314b72981978732803832fe',
            ext: '.json',
          },
        ],
      },
    },
    'platform-data-access-blurb': {
      name: 'platform-data-access-blurb',
      type: 'lib',
      data: {
        root: 'libs/platform/data-access-blurb',
        sourceRoot: 'libs/platform/data-access-blurb/src',
        projectType: 'library',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/data-access-blurb/tsconfig.lib.json',
                'libs/platform/data-access-blurb/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/platform/data-access-blurb/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/platform/data-access-blurb/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {},
        tags: ['type:data-access'],
        files: [
          {
            file: 'libs/platform/data-access-blurb/README.md',
            hash: '6eb47b7aa0bd5ebeaf016e378b394d52e5a0d61f',
            ext: '.md',
          },
          {
            file: 'libs/platform/data-access-blurb/jest.config.js',
            hash: '854d4d9b00fbc9d3562d15b0fc06861d3ceed069',
            ext: '.js',
          },
          {
            file: 'libs/platform/data-access-blurb/src/index.ts',
            hash: '35b5e667e4097a4a9d6bc6ea77520bad0f09f63c',
            ext: '.ts',
          },
          {
            file: 'libs/platform/data-access-blurb/src/lib/blurb.service.ts',
            hash: '2a81ea20e8ee96c8bd9a7f3c4293c616d0311b8b',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-blurb/src/lib/platform-data-access-blurb.module.ts',
            hash: 'f3de6f0df88085ed67e266032619992f7553d71c',
            ext: '.ts',
          },
          {
            file: 'libs/platform/data-access-blurb/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/platform/data-access-blurb/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/platform/data-access-blurb/tsconfig.lib.json',
            hash: 'cdc997acc0f2c9cb229148c05a2d4556814f885c',
            ext: '.json',
          },
          {
            file: 'libs/platform/data-access-blurb/tsconfig.spec.json',
            hash: '1af1e3d88c4ac2276bd07ea52fb31f8a9e8c1ae9',
            ext: '.json',
          },
          {
            file: 'libs/platform/data-access-blurb/tslint.json',
            hash: '9e6c1d1b0582f60745530f104d6a0168beb5cc35',
            ext: '.json',
          },
        ],
      },
    },
    'nx-docs-site-utils-fetcher': {
      name: 'nx-docs-site-utils-fetcher',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nx-docs-site/utils-fetcher',
        sourceRoot: 'libs/nx-docs-site/utils-fetcher/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-docs-site/utils-fetcher/tsconfig.lib.json',
                'libs/nx-docs-site/utils-fetcher/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nx-docs-site/utils-fetcher/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nx-docs-site/utils-fetcher/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {},
        tags: [],
        files: [
          {
            file: 'libs/nx-docs-site/utils-fetcher/README.md',
            hash: '6c898ce6cfe4cea36132983f88f0a19656219d20',
            ext: '.md',
          },
          {
            file: 'libs/nx-docs-site/utils-fetcher/jest.config.js',
            hash: 'e39b15686307ab185bfba187db978dab5e9121c2',
            ext: '.js',
          },
          {
            file: 'libs/nx-docs-site/utils-fetcher/src/index.ts',
            hash: 'b7343ea7853273efb9f189f99be3791791195af7',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/utils-fetcher/src/lib/metadata-fetcher.service.ts',
            hash: '30f53eff1e672e8e88d1e79e608e47159a656c98',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/utils-fetcher/src/lib/nx-docs-site-utils-fetcher.module.ts',
            hash: '6b139da0f92b1d0722aac3948cb5e59f8156047d',
            ext: '.ts',
          },
          {
            file: 'libs/nx-docs-site/utils-fetcher/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nx-docs-site/utils-fetcher/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/nx-docs-site/utils-fetcher/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/nx-docs-site/utils-fetcher/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/nx-docs-site/utils-fetcher/tslint.json',
            hash: '73b97fa5da957ae1c3b7c1814eb288cec20e4d7e',
            ext: '.json',
          },
        ],
      },
    },
    'platform-data-access-book': {
      name: 'platform-data-access-book',
      type: 'lib',
      data: {
        root: 'libs/platform/data-access-book',
        sourceRoot: 'libs/platform/data-access-book/src',
        projectType: 'library',
        prefix: 'nrwl-connect',
        architect: {
          'test-change-to-jest-and-rename-back': {
            builder: '@angular-devkit/build-angular:karma',
            options: {
              main: 'libs/platform/data-access-book/src/test.ts',
              tsConfig: 'libs/platform/data-access-book/tsconfig.spec.json',
              karmaConfig: 'libs/platform/data-access-book/karma.conf.js',
            },
          },
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/data-access-book/tsconfig.lib.json',
                'libs/platform/data-access-book/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/platform/data-access-book/**/*',
              ],
            },
          },
        },
        schematics: {},
        tags: [],
        files: [
          {
            file: 'libs/platform/data-access-book/karma.conf.js',
            hash: '0726833d72f5021286a4aeaced1d19af0c7aa07e',
            ext: '.js',
          },
          {
            file: 'libs/platform/data-access-book/src/index.ts',
            hash: '700b9761362317be9b4e115ba244ef26da03d6d9',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-book/src/lib/book-graphql.interface.ts',
            hash: '9f9e8d9d2fae16d4eb29884827c7ca5c3824f652',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-book/src/lib/book-graphql.service.ts',
            hash: 'de7c6f350f7349f6b3f93289c0bcda893f5b12bd',
            ext: '.ts',
          },
          {
            file: 'libs/platform/data-access-book/src/lib/book.interface.ts',
            hash: 'ecb75ee176abc02c59201c92fdcd38d32d478f5f',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/data-access-book/src/lib/platform-data-access-book.module.ts',
            hash: '3e29fb9cca159ae8a6999f2821853ded1759fc6b',
            ext: '.ts',
          },
          {
            file: 'libs/platform/data-access-book/src/test.ts',
            hash: '40ae238126b52a49932f4603239136bbab1c11fd',
            ext: '.ts',
          },
          {
            file: 'libs/platform/data-access-book/tsconfig.json',
            hash: '1133a7edbf84a108d49b74910f4b818c72e0455c',
            ext: '.json',
          },
          {
            file: 'libs/platform/data-access-book/tsconfig.lib.json',
            hash: 'ea0da3a6bba9b7a42a87e781063b3815827e88ee',
            ext: '.json',
          },
          {
            file: 'libs/platform/data-access-book/tsconfig.spec.json',
            hash: 'e0d6fa695a697f6a12f414169e13ae06acbe62ee',
            ext: '.json',
          },
          {
            file: 'libs/platform/data-access-book/tslint.json',
            hash: 'ca5cf8583639a5ed9051fe4b6ed21955a5e98e96',
            ext: '.json',
          },
        ],
      },
    },
    'nx-docs-site-feature-home': {
      name: 'nx-docs-site-feature-home',
      type: 'lib',
      data: {
        root: 'libs/nx-docs-site/feature-home',
        sourceRoot: 'libs/nx-docs-site/feature-home/src',
        projectType: 'library',
        prefix: 'nx-home',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-docs-site/feature-home/tsconfig.lib.json',
                'libs/nx-docs-site/feature-home/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nx-docs-site/feature-home/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nx-docs-site/feature-home/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/schematics:component': {
            styleext: 'scss',
          },
        },
        tags: ['nx:docs-site'],
        files: [
          {
            file: 'libs/nx-docs-site/feature-home/jest.config.js',
            hash: '378cca2d754d50224059a6d73c5da993f59bf0ef',
            ext: '.js',
          },
          {
            file: 'libs/nx-docs-site/feature-home/src/index.ts',
            hash: '5215d835a11efe7e884e08f137a0d5d988ae37c7',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/feature-home/src/lib/feature-home.module.ts',
            hash: 'b3c189375c710675b8c153783c9965abae9122de',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/feature-home/src/lib/flavor-selection.guard.ts',
            hash: 'e5ad64bc6650fb9a7699cca2d373d5a0c1f04a25',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/feature-home/src/lib/nx-cloud-sponsor/nx-cloud-sponsor.component.scss',
            hash: '26d86c6376cfc26b0dbdca263a3d395a2460a36e',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-docs-site/feature-home/src/lib/nx-cloud-sponsor/nx-cloud-sponsor.component.ts',
            hash: '01d4b34836a8803a6af1f3e7688f563443a20f89',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/feature-home/src/lib/shell/shell.component.html',
            hash: '71297a316ac7f56830bc3163fff5623962780732',
            ext: '.html',
          },
          {
            file:
              'libs/nx-docs-site/feature-home/src/lib/shell/shell.component.scss',
            hash: 'a236b631f8dbc425427caf55fd9fd85766b7e58c',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-docs-site/feature-home/src/lib/shell/shell.component.ts',
            hash: '49dd7993ca661f636166b1a621e6af3715e3227c',
            ext: '.ts',
          },
          {
            file: 'libs/nx-docs-site/feature-home/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nx-docs-site/feature-home/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/nx-docs-site/feature-home/tsconfig.lib.json',
            hash: '066c77b00dca39aa0d36d4d8e7908185f67a2334',
            ext: '.json',
          },
          {
            file: 'libs/nx-docs-site/feature-home/tsconfig.spec.json',
            hash: '19a0ba23bfeb2c43ce5bf6f2094a4731554189b5',
            ext: '.json',
          },
          {
            file: 'libs/nx-docs-site/feature-home/tslint.json',
            hash: 'c7d6b35f71e8dd19274443b6a74f79ab5824c183',
            ext: '.json',
          },
        ],
      },
    },
    'platform-feature-cookbook': {
      name: 'platform-feature-cookbook',
      type: 'lib',
      data: {
        root: 'libs/platform/feature-cookbook',
        sourceRoot: 'libs/platform/feature-cookbook/src',
        projectType: 'library',
        prefix: 'nrwl-connect',
        architect: {
          'test-change-to-jest-and-rename-back': {
            builder: '@angular-devkit/build-angular:karma',
            options: {
              main: 'libs/platform/feature-cookbook/src/test.ts',
              tsConfig: 'libs/platform/feature-cookbook/tsconfig.spec.json',
              karmaConfig: 'libs/platform/feature-cookbook/karma.conf.js',
            },
          },
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/feature-cookbook/tsconfig.lib.json',
                'libs/platform/feature-cookbook/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/platform/feature-cookbook/**/*',
              ],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/platform/feature-cookbook/karma.conf.js',
            hash: '252bfc1a9d0dd39bca7427534b0351c0855deddf',
            ext: '.js',
          },
          {
            file: 'libs/platform/feature-cookbook/src/index.ts',
            hash: '201bf8d22f931b278a947e7f0cd7ee74d1ae453c',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-cookbook/src/lib/platform-feature-cookbook.module.ts',
            hash: '22d4ec7992e44a8d9e692ba6cf1777566a3d29c7',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-cookbook/src/lib/recipe/recipe.component.html',
            hash: '720613ab61a8a7a4e9de5c9c084944a495a10e98',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-cookbook/src/lib/recipe/recipe.component.scss',
            hash: 'c20014b1efca7918f8d27a8bb4a1940dde4c8a25',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-cookbook/src/lib/recipe/recipe.component.ts',
            hash: '5c7639d7c53699c9a1c2dff8082bcdda97b3a8b9',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-cookbook/src/lib/recipes/recipes.component.html',
            hash: '2a0e64bc6177703ddb04a5dfddf59e6f4da498f0',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-cookbook/src/lib/recipes/recipes.component.scss',
            hash: '669352ae1f6ba9a855bfa110cf1ad90d33e7959e',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-cookbook/src/lib/recipes/recipes.component.ts',
            hash: '103efb2cbc54349bb7db1cf4da25536db14975c7',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-cookbook/src/test.ts',
            hash: '40ae238126b52a49932f4603239136bbab1c11fd',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-cookbook/tsconfig.lib.json',
            hash: 'ea4368be65c087b0abd52b45157a8b138a129511',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-cookbook/tsconfig.spec.json',
            hash: '941140b678620572e28e824f84e83f2c54e47b21',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-cookbook/tslint.json',
            hash: 'ca5cf8583639a5ed9051fe4b6ed21955a5e98e96',
            ext: '.json',
          },
        ],
      },
    },
    'platform-feature-policies': {
      name: 'platform-feature-policies',
      type: 'lib',
      data: {
        root: 'libs/platform/feature-policies',
        sourceRoot: 'libs/platform/feature-policies/src',
        projectType: 'library',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/feature-policies/tsconfig.lib.json',
                'libs/platform/feature-policies/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/platform/feature-policies/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/platform/feature-policies/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/schematics:component': {
            styleext: 'scss',
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/platform/feature-policies/README.md',
            hash: '8ff82a960d6f0b74bb07c4d1fb218990476973f8',
            ext: '.md',
          },
          {
            file: 'libs/platform/feature-policies/jest.config.js',
            hash: '76284b168f4b30fe2a7051817bb0dfe4f0a77a7c',
            ext: '.js',
          },
          {
            file: 'libs/platform/feature-policies/src/index.ts',
            hash: 'c7f6e325ca5e633c18eae547ca1c57e132a8006e',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-policies/src/lib/platform-feature-policies.module.ts',
            hash: '2021bcba32ce19e228eb2e37cb966d65597f2c4a',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-policies/src/lib/privacy-policy/privacy-policy.component.html',
            hash: 'fc44fafc8116c2603fb397201d7c18da448ac3aa',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-policies/src/lib/privacy-policy/privacy-policy.component.scss',
            hash: 'aa46314bf219ca92a7a58da76acf59085347182f',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-policies/src/lib/privacy-policy/privacy-policy.component.ts',
            hash: '7529e0b6287bff246bf212d4f689223b47f7b39d',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-policies/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-policies/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-policies/tsconfig.lib.json',
            hash: 'd8f698a08ec5559ec9e36a9fe230970953d4fd76',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-policies/tsconfig.spec.json',
            hash: '72c29b02eecbb7cfb0d206618992c8906dcb7510',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-policies/tslint.json',
            hash: '9e6c1d1b0582f60745530f104d6a0168beb5cc35',
            ext: '.json',
          },
        ],
      },
    },
    'shared-utils-download-csv': {
      name: 'shared-utils-download-csv',
      type: 'lib',
      data: {
        root: 'libs/shared/utils/download-csv',
        sourceRoot: 'libs/shared/utils/download-csv/src',
        projectType: 'library',
        schematics: {},
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/shared/utils/download-csv/tsconfig.lib.json',
                'libs/shared/utils/download-csv/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/shared/utils/download-csv/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/shared/utils/download-csv/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/shared/utils/download-csv/README.md',
            hash: '2d7c2f79d247f3eecb895afc19b503fff62de890',
            ext: '.md',
          },
          {
            file: 'libs/shared/utils/download-csv/jest.config.js',
            hash: 'f373dac49e6316664709da9f4f520b03599e8ce4',
            ext: '.js',
          },
          {
            file: 'libs/shared/utils/download-csv/src/index.ts',
            hash: '5e0c661c166196719e0cd39c3fc5b061d7d907c6',
            ext: '.ts',
          },
          {
            file:
              'libs/shared/utils/download-csv/src/lib/shared-utils-download-csv.ts',
            hash: '131b885745a8d2b6317f70a74fad8a5f1036921c',
            ext: '.ts',
          },
          {
            file: 'libs/shared/utils/download-csv/tsconfig.json',
            hash: 'd32f55e3999447ae24e89f0e76d8c3128113c85e',
            ext: '.json',
          },
          {
            file: 'libs/shared/utils/download-csv/tsconfig.lib.json',
            hash: 'a174cb09c30e46285517c7308247d602414aa63f',
            ext: '.json',
          },
          {
            file: 'libs/shared/utils/download-csv/tsconfig.spec.json',
            hash: 'd38f29ed71dc44f512e29dbc921ffb582729b444',
            ext: '.json',
          },
          {
            file: 'libs/shared/utils/download-csv/tslint.json',
            hash: 'a9790fc8d7b07dce18c68fe2b9c76c8d622b8022',
            ext: '.json',
          },
        ],
      },
    },
    'nrwlio-site-feature-pages': {
      name: 'nrwlio-site-feature-pages',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nrwlio-site/feature-pages',
        sourceRoot: 'libs/nrwlio-site/feature-pages/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nrwlio-site/feature-pages/tsconfig.lib.json',
                'libs/nrwlio-site/feature-pages/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nrwlio-site/feature-pages/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nrwlio-site/feature-pages/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['nrwlio', 'type:feature'],
        files: [
          {
            file: 'libs/nrwlio-site/feature-pages/README.md',
            hash: '72d363a1007104b90396f012d81e10635bbe74b7',
            ext: '.md',
          },
          {
            file: 'libs/nrwlio-site/feature-pages/jest.config.js',
            hash: '6063089c3f8ced8beae6d6422bb264dd35c5f1b3',
            ext: '.js',
          },
          {
            file: 'libs/nrwlio-site/feature-pages/src/index.ts',
            hash: '32c0e558ceef5f6abf49db19a37b00180b7ec5cc',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/feature-pages/src/lib/feature-pages-routing.module.ts',
            hash: '422b1b7c369ca6e71b970ff10e1e8ef6c16d95f3',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/feature-pages/src/lib/feature-pages.module.ts',
            hash: '0dc8cb3c712bef9d39f1dd6e9bf4a5c49acef0b6',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/feature-pages/src/lib/not-found/not-found.component.html',
            hash: 'a515f0462a3e2b639bd11f9bd49dd0d86c15c7b8',
            ext: '.html',
          },
          {
            file:
              'libs/nrwlio-site/feature-pages/src/lib/not-found/not-found.component.scss',
            hash: '2c8189837c0c97a932a6254b284e2dee03bcf65d',
            ext: '.scss',
          },
          {
            file:
              'libs/nrwlio-site/feature-pages/src/lib/not-found/not-found.component.ts',
            hash: 'c0b85624d086cd0b9f7bce96243f3e355bf4d158',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/feature-pages/src/lib/page-metas.service.ts',
            hash: '82926b7e8243c5fbc0b29ddd974a1e432acaefe3',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/feature-pages/src/lib/page-resolver.service.ts',
            hash: 'b1dce84a3937f339d5491e4945e5923ee852d3e3',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/feature-pages/src/lib/page-slug.guard.ts',
            hash: 'fe7148a8ad7a485aa4b4f2fb3eb6d436c1a04dcb',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/feature-pages/src/lib/pages-query.service.ts',
            hash: '8a4ec03f4d87c2bd6a6b7663b8a777927c0d08d9',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/feature-pages/src/lib/pages.model.ts',
            hash: '2e994e797c09684ec5e062a165e9339b2e8fe44b',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/feature-pages/src/lib/shell/shell.component.ts',
            hash: 'a65269088c1247674f2b6d1cc9fe9ce37678d020',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/feature-pages/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/feature-pages/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/feature-pages/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/feature-pages/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/feature-pages/tslint.json',
            hash: '5708d7147ddece6af5375119e6cc1a3a9032fb77',
            ext: '.json',
          },
        ],
      },
    },
    'nx-cloud-feature-policies': {
      name: 'nx-cloud-feature-policies',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nx-cloud/feature-policies',
        sourceRoot: 'libs/nx-cloud/feature-policies/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-cloud/feature-policies/tsconfig.lib.json',
                'libs/nx-cloud/feature-policies/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nx-cloud/feature-policies/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nx-cloud/feature-policies/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/nx-cloud/feature-policies/README.md',
            hash: 'b2434177715676aeecf5d0d1603eefeabee378f2',
            ext: '.md',
          },
          {
            file: 'libs/nx-cloud/feature-policies/jest.config.js',
            hash: 'e0ef381a1bafecef2cc2756e9f61cdc9dbebf4f5',
            ext: '.js',
          },
          {
            file: 'libs/nx-cloud/feature-policies/src/index.ts',
            hash: '4468c952406a5a7f1c2160d3ffb34536d6176d3f',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/feature-policies/src/lib/feature-policies.module.spec.ts',
            hash: '5ba0208b4b347831f74afa0ef8fd1bb7a02f61b3',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/feature-policies/src/lib/feature-policies.module.ts',
            hash: '7f9a98a084308ce9d572ab0b61540ed446222595',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/feature-policies/src/lib/privacy-policy/privacy-policy.component.html',
            hash: '3bdebbfcbf99aed6ca037cc017b9b57c76988839',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/feature-policies/src/lib/privacy-policy/privacy-policy.component.scss',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/feature-policies/src/lib/privacy-policy/privacy-policy.component.ts',
            hash: '49b0fd520db309e46655592a370cc9e17718190e',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/feature-policies/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/feature-policies/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/feature-policies/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/feature-policies/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/feature-policies/tslint.json',
            hash: '9e38c8fcad5435933a4554d833b1f480fe8bcf8c',
            ext: '.json',
          },
        ],
      },
    },
    'design-system-buttons-e2e': {
      name: 'design-system-buttons-e2e',
      type: 'e2e',
      data: {
        root: 'apps/design-system-buttons-e2e',
        sourceRoot: 'apps/design-system-buttons-e2e/src',
        projectType: 'application',
        architect: {
          e2e: {
            builder: '@nrwl/cypress:cypress',
            options: {
              cypressConfig: 'apps/design-system-buttons-e2e/cypress.json',
              tsConfig: 'apps/design-system-buttons-e2e/tsconfig.e2e.json',
              devServerTarget: 'design-system-buttons:storybook',
            },
            configurations: {
              ci: {
                devServerTarget: 'design-system-buttons:storybook:ci',
              },
            },
          },
          lint: {
            builder: '@nrwl/linter:lint',
            options: {
              linter: 'eslint',
              tsConfig: ['apps/design-system-buttons-e2e/tsconfig.e2e.json'],
              exclude: [
                '**/node_modules/**',
                '!apps/design-system-buttons-e2e/**/*',
              ],
            },
          },
        },
        tags: ['scope:design-system', 'type:ui'],
        files: [
          {
            file: 'apps/design-system-buttons-e2e/.eslintrc',
            hash: 'dccafcf8d06177fd12cbaf7bf51911077649d6f8',
            ext: '',
          },
          {
            file: 'apps/design-system-buttons-e2e/cypress.json',
            hash: 'dbccb281b43d80d0e5afb20d2a935c94d3c6f414',
            ext: '.json',
          },
          {
            file: 'apps/design-system-buttons-e2e/src/fixtures/example.json',
            hash: '294cbed6ce9e0b948b787452e8676aee486cb3be',
            ext: '.json',
          },
          {
            file:
              'apps/design-system-buttons-e2e/src/integration/buttons/buttons.component.spec.ts',
            hash: '6154910b5522ff89f4ac2e50ad2bb59dfc7c1627',
            ext: '.ts',
          },
          {
            file: 'apps/design-system-buttons-e2e/src/plugins/index.js',
            hash: '9067e75a258dadf5a02b2a91c64f5acee1af17fd',
            ext: '.js',
          },
          {
            file: 'apps/design-system-buttons-e2e/src/support/commands.ts',
            hash: '61b3a3e35770234a5aa9e31b07870b9292ec52ba',
            ext: '.ts',
          },
          {
            file: 'apps/design-system-buttons-e2e/src/support/index.ts',
            hash: '3d469a6b6cf31eb66117d73e278bcf74f398f1db',
            ext: '.ts',
          },
          {
            file: 'apps/design-system-buttons-e2e/tsconfig.e2e.json',
            hash: '9dc3660a79ee2f6daf097b4930427223896e3b25',
            ext: '.json',
          },
          {
            file: 'apps/design-system-buttons-e2e/tsconfig.json',
            hash: '08841a7f56c62d55340ad08451502304837254fd',
            ext: '.json',
          },
        ],
      },
    },
    'platform-feature-courses': {
      name: 'platform-feature-courses',
      type: 'lib',
      data: {
        root: 'libs/platform/feature-courses',
        sourceRoot: 'libs/platform/feature-courses/src',
        projectType: 'library',
        prefix: 'nrwl-connect',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/feature-courses/tsconfig.lib.json',
                'libs/platform/feature-courses/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/platform/feature-courses/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/platform/feature-courses/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/schematics:component': {
            styleext: 'scss',
          },
        },
        tags: ['type:feature'],
        files: [
          {
            file: 'libs/platform/feature-courses/README.md',
            hash: '6c1aba0396f9943f70ba843dd1b5c2d16bd3fe2d',
            ext: '.md',
          },
          {
            file: 'libs/platform/feature-courses/jest.config.js',
            hash: '2064b5634e8fbf0861d4e210c2c1e5509b8c07c4',
            ext: '.js',
          },
          {
            file: 'libs/platform/feature-courses/src/index.ts',
            hash: 'a8ec147adb79bf04082b2e0b31186fbf011ba816',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-courses/src/lib/courses/courses.component.html',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-courses/src/lib/courses/courses.component.scss',
            hash: '2be414365bafda3734caeaf54370dfb802ed7878',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-courses/src/lib/courses/courses.component.ts',
            hash: 'c449390168638e0f13fe1813757e57f86b16c8eb',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-courses/src/lib/platform-feature-courses.module.ts',
            hash: '8d9cbeca39d2d94c10449b3de6fc56ae596fdbdd',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-courses/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-courses/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-courses/tsconfig.lib.json',
            hash: 'c770f565c8fdd3c4ee56e8ec267609826c20da0f',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-courses/tsconfig.spec.json',
            hash: 'e63babae8088dd381e284a53356d3022de20f729',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-courses/tslint.json',
            hash: 'ca5cf8583639a5ed9051fe4b6ed21955a5e98e96',
            ext: '.json',
          },
        ],
      },
    },
    'platform-feature-reports': {
      name: 'platform-feature-reports',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/platform/feature-reports',
        sourceRoot: 'libs/platform/feature-reports/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/feature-reports/tsconfig.lib.json',
                'libs/platform/feature-reports/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/platform/feature-reports/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/platform/feature-reports/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {},
        tags: [],
        files: [
          {
            file: 'libs/platform/feature-reports/README.md',
            hash: 'd4ee27ec5376e38aaa3c4271e7e01b94b729167d',
            ext: '.md',
          },
          {
            file: 'libs/platform/feature-reports/jest.config.js',
            hash: '2166b03ab5c5da5e794ea2348899b16ce95c61b3',
            ext: '.js',
          },
          {
            file: 'libs/platform/feature-reports/src/index.ts',
            hash: '600180ff5c2eb6b219f92e986b9572dbe0a0e715',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-reports/src/lib/platform-feature-reports.module.ts',
            hash: '2fe80ad422c7cf0dd83c29cb6741a569de28e683',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-reports/src/lib/reports/reports.component.html',
            hash: '1fa1de6f5779794f838d4b7380651f0dc8089e28',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-reports/src/lib/reports/reports.component.scss',
            hash: '58df1a4fc6085c1aefac4bdb5c04487670eb8e42',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-reports/src/lib/reports/reports.component.ts',
            hash: 'b91fa270831cb079b7d68e907dfe6db3be6ae7cb',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-reports/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-reports/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-reports/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-reports/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-reports/tslint.json',
            hash: '73b97fa5da957ae1c3b7c1814eb288cec20e4d7e',
            ext: '.json',
          },
        ],
      },
    },
    'nx-cloud-feature-landing': {
      name: 'nx-cloud-feature-landing',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nx-cloud/feature-landing',
        sourceRoot: 'libs/nx-cloud/feature-landing/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-cloud/feature-landing/tsconfig.lib.json',
                'libs/nx-cloud/feature-landing/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nx-cloud/feature-landing/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nx-cloud/feature-landing/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {},
        tags: [],
        files: [
          {
            file: 'libs/nx-cloud/feature-landing/README.md',
            hash: 'd3cee2390e0a17ca0aa5297cb81233239b7a58e3',
            ext: '.md',
          },
          {
            file: 'libs/nx-cloud/feature-landing/jest.config.js',
            hash: '0bf1d77d9976accd6bc9302ff1ad97ec80aeefed',
            ext: '.js',
          },
          {
            file: 'libs/nx-cloud/feature-landing/src/index.ts',
            hash: 'ed4c2527e498975abc7e1359f769e657fdb8f3d8',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/feature-landing/src/lib/content/index.ts',
            hash: '636810471b3e830dbfb2660fbaf010be16bc95b4',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/feature-landing/src/lib/nx-cloud-feature-landing.module.ts',
            hash: '3a4a7e0719373aaa7611513647c88a9c020939a5',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/feature-landing/src/lib/price-calculator/price-calculator.component.css',
            hash: '7e52a06ca58b134aa45cc4382aa8c2aba12b05ac',
            ext: '.css',
          },
          {
            file:
              'libs/nx-cloud/feature-landing/src/lib/price-calculator/price-calculator.component.html',
            hash: 'e028ddc5c5b83b7dcf2c1fe579a379d033f0c104',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/feature-landing/src/lib/price-calculator/price-calculator.component.ts',
            hash: 'e8f655d81bf67337d1663c198abdbe40b5a3cef9',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/feature-landing/src/lib/shell/shell.component.html',
            hash: 'bd7b9bc3fd46d86f40f8b2fba363165b1eee60ef',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/feature-landing/src/lib/shell/shell.component.scss',
            hash: 'c2666886b11dfd00e2fc7914c8661ee9cd44c07b',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/feature-landing/src/lib/shell/shell.component.ts',
            hash: 'd1d6b1c9cdb4f26d276f81894b753ef1163fd640',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/feature-landing/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/feature-landing/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/feature-landing/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/feature-landing/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/feature-landing/tslint.json',
            hash: 'fb85d9abc2571bb57bc04aa7807790f508c25f88',
            ext: '.json',
          },
        ],
      },
    },
    'nx-cloud-feature-pricing': {
      name: 'nx-cloud-feature-pricing',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nx-cloud/feature-pricing',
        sourceRoot: 'libs/nx-cloud/feature-pricing/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-cloud/feature-pricing/tsconfig.lib.json',
                'libs/nx-cloud/feature-pricing/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nx-cloud/feature-pricing/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nx-cloud/feature-pricing/jest.config.js',
              tsConfig: 'libs/nx-cloud/feature-pricing/tsconfig.spec.json',
              passWithNoTests: true,
              setupFile: 'libs/nx-cloud/feature-pricing/src/test-setup.ts',
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            style: 'scss',
          },
        },
        tags: ['nx-cloud', 'type:feature'],
        files: [
          {
            file: 'libs/nx-cloud/feature-pricing/README.md',
            hash: '0fbb31b7b0cf0ff40455b9fd0b3d41712fc8038e',
            ext: '.md',
          },
          {
            file: 'libs/nx-cloud/feature-pricing/jest.config.js',
            hash: 'ff203d65bb7dc9b2f4af5a7c048edafd46c2d32f',
            ext: '.js',
          },
          {
            file: 'libs/nx-cloud/feature-pricing/src/index.ts',
            hash: '45ae34b032686ed1d95383eab8ddf8410102dc6d',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/feature-pricing/src/lib/nx-cloud-feature-pricing.module.ts',
            hash: '78d0c4dbcf30acce8ac42c1a1ea3b45baf2258e1',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/feature-pricing/src/lib/pricing-faqs/pricing-faqs.component.html',
            hash: '3f59ffd1a1b6bc35dcf3c752ae83a6a7f553c26d',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/feature-pricing/src/lib/pricing-faqs/pricing-faqs.component.scss',
            hash: 'ebbfe9281bb7164c82e4b16d2a03257afc2540bf',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/feature-pricing/src/lib/pricing-faqs/pricing-faqs.component.ts',
            hash: '9e3b9bbb948d9c82f9ff6a732fdd2be0d71da596',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/feature-pricing/src/lib/pricing-feature-table/pricing-feature-table.component.html',
            hash: 'd8d78fc8300bc73247d564b1a65e84622b4f92a1',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/feature-pricing/src/lib/pricing-feature-table/pricing-feature-table.component.scss',
            hash: '65d266d48fb74bd05de6d1fed8ac0b4beb956f39',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/feature-pricing/src/lib/pricing-feature-table/pricing-feature-table.component.ts',
            hash: '979e0cb83d851ff560566e3e90b8cf35de42cb01',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/feature-pricing/src/lib/pricing-table-value/pricing-table-value.component.html',
            hash: '7d7819ac259591d491c558fccf73b718324220f5',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/feature-pricing/src/lib/pricing-table-value/pricing-table-value.component.scss',
            hash: 'e6346975d47ee779a90a25f66476007ba9e9d57f',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/feature-pricing/src/lib/pricing-table-value/pricing-table-value.component.ts',
            hash: 'bb923f813896d83da0f07006c6b15cead66918ea',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/feature-pricing/src/lib/pricing/pricing.component.html',
            hash: 'b406ee002598aedd60e0671674bed29bd4114bc0',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/feature-pricing/src/lib/pricing/pricing.component.scss',
            hash: '9f791b9cf858613f216705a4833f5e0d4bc79658',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/feature-pricing/src/lib/pricing/pricing.component.ts',
            hash: '3c2b3448fdcbd7f80607e1ef037776a8b7839fd8',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/feature-pricing/src/lib/private-cloud-form/private-cloud-form.component.html',
            hash: '212c8146b11ea1bd0325ede4d90b75202db20d92',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/feature-pricing/src/lib/private-cloud-form/private-cloud-form.component.scss',
            hash: 'ccd0c2b4cc63796b68cf53202d13d491f20c7204',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/feature-pricing/src/lib/private-cloud-form/private-cloud-form.component.ts',
            hash: 'fec482f683f0e009673f554c4e65d2481b4c06d4',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/feature-pricing/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/feature-pricing/tsconfig.json',
            hash: '667a3463d1d1367fdaa0a33be5eded304f7873f1',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/feature-pricing/tsconfig.lib.json',
            hash: '2dc9b2ccd7b7f5860be847ee69b9945d7bfb3ee8',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/feature-pricing/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/feature-pricing/tslint.json',
            hash: '73b97fa5da957ae1c3b7c1814eb288cec20e4d7e',
            ext: '.json',
          },
        ],
      },
    },
    'platform-feature-topics': {
      name: 'platform-feature-topics',
      type: 'lib',
      data: {
        root: 'libs/platform/feature-topics',
        sourceRoot: 'libs/platform/feature-topics/src',
        projectType: 'library',
        prefix: 'nrwl-connect',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/feature-topics/tsconfig.lib.json',
                'libs/platform/feature-topics/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/platform/feature-topics/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/platform/feature-topics/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {},
        tags: [],
        files: [
          {
            file: 'libs/platform/feature-topics/jest.config.js',
            hash: '25ce0e7224ac84440810687bffc1a1925f5bec49',
            ext: '.js',
          },
          {
            file: 'libs/platform/feature-topics/src/index.ts',
            hash: '192f192de3d5fc3ea8b49d30a0d11b5a364f8e63',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-topics/src/lib/platform-feature-topics.module.ts',
            hash: '046b8cf37188312cbefa615fc8701181c0526e10',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-topics/src/lib/topic-detail/topic-detail.component.html',
            hash: 'f33ba6522ea9ebbe97b1a930ac5fa492fec42c01',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-topics/src/lib/topic-detail/topic-detail.component.scss',
            hash: 'b67995824e441866cd6290322ba2fd22b6bbaf18',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-topics/src/lib/topic-detail/topic-detail.component.ts',
            hash: '7eadcf5b48126a7756d196b7fb86d37804fa74a5',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-topics/src/lib/topics/topics.component.html',
            hash: 'a149c6fbef4a59fdb2f73ad6b2e4bc1b49a0820f',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-topics/src/lib/topics/topics.component.scss',
            hash: '734691ca152fc8e68bb8ad4231ccf0654725e68f',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-topics/src/lib/topics/topics.component.ts',
            hash: '3fe5313de717d58342f2087d2137cf9984fb4ed6',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-topics/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-topics/tsconfig.lib.json',
            hash: '47aa9a3fe129e3c168a57ec521f3cb62ef59e460',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-topics/tsconfig.spec.json',
            hash: '3e95b0ff84fe4ea86cd968174d6c8a39dbbacb13',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-topics/tslint.json',
            hash: 'ca5cf8583639a5ed9051fe4b6ed21955a5e98e96',
            ext: '.json',
          },
        ],
      },
    },
    'platform-feature-users': {
      name: 'platform-feature-users',
      type: 'lib',
      data: {
        root: 'libs/platform/feature-users',
        sourceRoot: 'libs/platform/feature-users/src',
        projectType: 'library',
        prefix: 'angular-console',
        architect: {
          'test-change-to-jest-and-rename-back': {
            builder: '@angular-devkit/build-angular:karma',
            options: {
              main: 'libs/platform/feature-users/src/test.ts',
              tsConfig: 'libs/platform/feature-users/tsconfig.spec.json',
              karmaConfig: 'libs/platform/feature-users/karma.conf.js',
            },
          },
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/feature-users/tsconfig.lib.json',
                'libs/platform/feature-users/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/platform/feature-users/**/*',
              ],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/platform/feature-users/karma.conf.js',
            hash: 'da705cf5eaadca0332fa9a4e67392934909e288e',
            ext: '.js',
          },
          {
            file: 'libs/platform/feature-users/src/index.ts',
            hash: '9050574be0fd94be246d00172286d51c868de929',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-users/src/lib/all-users/all-users.component.html',
            hash: 'b1d968a72381cc416703e90d3f04292072902dac',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-users/src/lib/all-users/all-users.component.scss',
            hash: '78e8cd365924be9f0f6ecd86bc4e67e9c3ada844',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-users/src/lib/all-users/all-users.component.ts',
            hash: 'ca86b38edf8632b5e41c3e97c1fc4db84599bb3d',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-users/src/lib/create-user-dialog/create-user-dialog.component.html',
            hash: '643dbbee65e3b5218dbc9280b800c1eb35ce0e13',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-users/src/lib/create-user-dialog/create-user-dialog.component.scss',
            hash: 'ddc5b4c3bed9b7804076416a2b7b7e3b18c7d49a',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-users/src/lib/create-user-dialog/create-user-dialog.component.ts',
            hash: '6f6838342bf6beb24f41c6b469e6485c6b44a902',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-users/src/lib/delete-user-confirmation-dialog/delete-user-confirmation-dialog.component.html',
            hash: '6c67b746bb7e10f57147aa8853a1e0ceef73adba',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-users/src/lib/delete-user-confirmation-dialog/delete-user-confirmation-dialog.component.scss',
            hash: '8f5c580105b58f80494dfc9f104b7770d57419d3',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-users/src/lib/delete-user-confirmation-dialog/delete-user-confirmation-dialog.component.ts',
            hash: 'a76db3c3b5731fd467939860afc9390184f9f18c',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-users/src/lib/delete-user-progress-dialog/delete-user-progress-dialog.component.html',
            hash: '0069ae1b965b699c6142c15a3b7660663f1ccf45',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-users/src/lib/delete-user-progress-dialog/delete-user-progress-dialog.component.scss',
            hash: '3f2356796cc1f5e89c7b0c6a676d688765b55031',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-users/src/lib/delete-user-progress-dialog/delete-user-progress-dialog.component.ts',
            hash: '62906e5aa3169a6f3412e910c8704ce24f81aa35',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-users/src/lib/platform-feature-users.module.ts',
            hash: 'ba783216bc200a0da9d5e606ca58e6d464534e4d',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-users/src/test.ts',
            hash: '40ae238126b52a49932f4603239136bbab1c11fd',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-users/tsconfig.json',
            hash: '8c8dd086f99335d47c1f2f3e47fd3b8af7429293',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-users/tsconfig.lib.json',
            hash: '060059b2a0ab8b8d122c23650a2cd3599e47ba17',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-users/tsconfig.spec.json',
            hash: 'c875501152d73b42a8e856c34631ce6b4ae69ec9',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-users/tslint.json',
            hash: '2a88bfbfbe8c85a62dcbe985dc55e07f3483ece9',
            ext: '.json',
          },
        ],
      },
    },
    'platform-feature-books': {
      name: 'platform-feature-books',
      type: 'lib',
      data: {
        root: 'libs/platform/feature-books',
        sourceRoot: 'libs/platform/feature-books/src',
        projectType: 'library',
        prefix: 'angular-console',
        architect: {
          'test-change-to-jest-and-rename-back': {
            builder: '@angular-devkit/build-angular:karma',
            options: {
              main: 'libs/platform/feature-books/src/test.ts',
              tsConfig: 'libs/platform/feature-books/tsconfig.spec.json',
              karmaConfig: 'libs/platform/feature-books/karma.conf.js',
            },
          },
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/feature-books/tsconfig.lib.json',
                'libs/platform/feature-books/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/platform/feature-books/**/*',
              ],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/platform/feature-books/karma.conf.js',
            hash: '9e2c96406ac2d740f3b27fadc00affa6cfe39d71',
            ext: '.js',
          },
          {
            file: 'libs/platform/feature-books/src/index.ts',
            hash: '495a4bfcd8be229f5fadb572b328fa6c6d9f2987',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-books/src/lib/book/book.component.html',
            hash: '036136c58663aafdb40adaa9dede18cc50504693',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-books/src/lib/book/book.component.scss',
            hash: '7e66fd818d3f3e5f85eb531a5e78f3067aa9e52b',
            ext: '.scss',
          },
          {
            file: 'libs/platform/feature-books/src/lib/book/book.component.ts',
            hash: '247229975639ae0300a997084571134b67487e3b',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-books/src/lib/books/books.component.html',
            hash: 'b701b82b9510be681b52141f00c8c22be7e6acf9',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-books/src/lib/books/books.component.scss',
            hash: '6b21b34e4c680c6f64b3820177a25cf94f1afb6c',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-books/src/lib/books/books.component.ts',
            hash: '87788d7e42cbf180ebcf2d771e74fa2ed2488ccc',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-books/src/lib/epub-reader/epub-reader.component.html',
            hash: '2e94e79943aa25cd27c28c96722f36f1b50ce8ff',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-books/src/lib/epub-reader/epub-reader.component.scss',
            hash: '8ebaf96c4b1424d5b88424d037ec850971f688e4',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-books/src/lib/epub-reader/epub-reader.component.ts',
            hash: '40e24c52600bb8b8d4f2b8c8d61a52f6d1543dec',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-books/src/lib/platform-feature-books.module.ts',
            hash: 'f409f8f05cd6851d99a21396ef0a4aa28510caca',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-books/src/test.ts',
            hash: '40ae238126b52a49932f4603239136bbab1c11fd',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-books/tsconfig.json',
            hash: '8c8dd086f99335d47c1f2f3e47fd3b8af7429293',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-books/tsconfig.lib.json',
            hash: 'efa7d9dac3f4282b1454df682744ed2a4964961d',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-books/tsconfig.spec.json',
            hash: '4d30f7bbb9a0ea0b8db67a04438fdabd21e59ac7',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-books/tslint.json',
            hash: '2a88bfbfbe8c85a62dcbe985dc55e07f3483ece9',
            ext: '.json',
          },
        ],
      },
    },
    'platform-ui-expert-bio': {
      name: 'platform-ui-expert-bio',
      type: 'lib',
      data: {
        root: 'libs/platform/ui-expert-bio',
        sourceRoot: 'libs/platform/ui-expert-bio/src',
        projectType: 'library',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/ui-expert-bio/tsconfig.lib.json',
                'libs/platform/ui-expert-bio/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/platform/ui-expert-bio/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/platform/ui-expert-bio/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/schematics:component': {
            styleext: 'scss',
          },
        },
        tags: ['type:ui'],
        files: [
          {
            file: 'libs/platform/ui-expert-bio/README.md',
            hash: '951c9331e44418c50cdd190a75785912aca9ef07',
            ext: '.md',
          },
          {
            file: 'libs/platform/ui-expert-bio/jest.config.js',
            hash: 'b375a12e373b1049956e631a5fb3aff6635c20ce',
            ext: '.js',
          },
          {
            file: 'libs/platform/ui-expert-bio/src/index.ts',
            hash: '5642da37096290a3a0079e734b58e4fc3733524b',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/ui-expert-bio/src/lib/expert-bio/expert-bio.component.html',
            hash: 'c4b040d4f3be08a6bcc0803ad5dae78e11ff82ef',
            ext: '.html',
          },
          {
            file:
              'libs/platform/ui-expert-bio/src/lib/expert-bio/expert-bio.component.scss',
            hash: 'a2ba71e1c27e2c847d7dd52a61dd1595c1e0308c',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/ui-expert-bio/src/lib/expert-bio/expert-bio.component.ts',
            hash: 'd2348137cb29d57bb778f902032f299a0c21081b',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/ui-expert-bio/src/lib/platform-ui-expert-bio.module.ts',
            hash: '0ed00a26537eb842e0d43d9e3656308751276623',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/ui-expert-bio/src/lib/topic-card/topic-card.component.html',
            hash: '394395e3f90760f0a9c2459af5a3f42c083886cc',
            ext: '.html',
          },
          {
            file:
              'libs/platform/ui-expert-bio/src/lib/topic-card/topic-card.component.scss',
            hash: 'bf69547d4323268893490eb968f217c19c13c792',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/ui-expert-bio/src/lib/topic-card/topic-card.component.ts',
            hash: '955f1d9b3517fe4cbc7a690d2b30304e54e2227f',
            ext: '.ts',
          },
          {
            file: 'libs/platform/ui-expert-bio/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/platform/ui-expert-bio/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/platform/ui-expert-bio/tsconfig.lib.json',
            hash: '1a1b4fbe85b55873a58e6c297f8b59bdeeddfd0c',
            ext: '.json',
          },
          {
            file: 'libs/platform/ui-expert-bio/tsconfig.spec.json',
            hash: 'a523c5c05066045d37153d0ce777b22239ed1cf4',
            ext: '.json',
          },
          {
            file: 'libs/platform/ui-expert-bio/tslint.json',
            hash: '9e6c1d1b0582f60745530f104d6a0168beb5cc35',
            ext: '.json',
          },
        ],
      },
    },
    'nrwlio-site-contentful': {
      name: 'nrwlio-site-contentful',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nrwlio-site/contentful',
        sourceRoot: 'libs/nrwlio-site/contentful/src',
        prefix: 'ctf',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nrwlio-site/contentful/tsconfig.lib.json',
                'libs/nrwlio-site/contentful/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nrwlio-site/contentful/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nrwlio-site/contentful/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {},
        tags: ['nrwlio'],
        files: [
          {
            file: 'libs/nrwlio-site/contentful/README.md',
            hash: '84cc38299bf2d687830d15f5edc0ca666b452f6d',
            ext: '.md',
          },
          {
            file: 'libs/nrwlio-site/contentful/jest.config.js',
            hash: 'a476e111c643c3a0a5e0a1a8299b768171dd9d35',
            ext: '.js',
          },
          {
            file: 'libs/nrwlio-site/contentful/src/index.ts',
            hash: '6376d75c6c5b1dcb419cd0dd05f04de677dfcf0b',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/ads/ad-display-primary/ad-display-primary-query.service.ts',
            hash: '01d3c5f3ef32f7599480f274c9c4822113fed497',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/ads/ad-display-primary/ad-display-primary.component.ts',
            hash: 'b57ad3ada5872e83a65392f0f0362cd550cc34ba',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/ads/ad-display-primary/ad-display-primary.model.ts',
            hash: 'f654103ecf04a170dc5677d2b5c1bd4f958ec159',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/articles/article-primary/article-primary-query.service.ts',
            hash: 'b707865731e46426c44c0a5f1437915c2c55541f',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/articles/article-primary/article-primary.component.ts',
            hash: 'cdc29af3b4560c5f5fe355551170d82ce2e6a49c',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/articles/article-primary/article-primary.model.ts',
            hash: 'ddaeb47f6d67acbb30ceff3d0169bee87422e379',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/component-drivers.collection.ts',
            hash: '309ed38790fe57a27dd656b6f7535375d065f91d',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/contentful-components.service.ts',
            hash: '802580415c22466ff2486e28a534a2f5253d0e10',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/contentful-configuration.token.ts',
            hash: '6cf407551e4343d7aa73241bb11e8e40657a3e8a',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/contentful/src/lib/contentful.module.ts',
            hash: '40529a294e46edd34f5564d28d8535ffee339ab0',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/contents/content-block-001/content-block-001-query.service.ts',
            hash: '484681ddc10c25c234c93bc123992cb2a480ae30',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/contents/content-block-001/content-block-001.component.ts',
            hash: 'cf9151a565be9b74be7a13d56fe10517507b3d28',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/contents/content-block-001/content-block-001.model.ts',
            hash: '8387648f784a480ee7bde7ff7eaaf5f6b681d5f6',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/contents/content-block-002/content-block-002-query.service.ts',
            hash: '2d2e5d7f44a386f18b55af87e933f8045f50f827',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/contents/content-block-002/content-block-002.component.ts',
            hash: '530d7a43f281da21627bd0d7e4b4a60ef8e93e94',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/contents/content-block-002/content-block-002.model.ts',
            hash: 'd82d00caf1ecc8fb9d978656ca2bdce6489d0e0a',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/contents/content-block-004/content-block-004-query.service.ts',
            hash: '8c9a6e526d57ed53fb2818be5cb50870ca426767',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/contents/content-block-004/content-block-004.component.ts',
            hash: '2802650ccf8a0bae0196e0460c1e828a1155bb0b',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/contents/content-block-004/content-block-004.model.ts',
            hash: 'f0c0242e6eac701d59c24bd0fce92f0a8ca98884',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/contents/content-wide/content-wide-query.service.ts',
            hash: '8808aea179288d7e7fc7629073a30d48a03a7939',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/contents/content-wide/content-wide.component.ts',
            hash: '6a2561f1160d885f39d4497c293882cda45d8437',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/contents/content-wide/content-wide.model.ts',
            hash: '3ab62aafcd1015aa598dabd694476f8d6db6ec53',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/domain-switcher.service.ts',
            hash: '4bcf6f3610669ab41309550ab47d293af18f82ff',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/downloads/download-primary/download-primary-query.service.ts',
            hash: '53803070862e19e5b6baa52cec1b0cd94097b33c',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/downloads/download-primary/download-primary.component.ts',
            hash: '9386ae9bf54901b2b35a5fe2774507882d979a49',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/downloads/download-primary/download-primary.model.ts',
            hash: '02b8b821b7085b38e7070323d44a7fb32e375513',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/dynamic-layout/dyanmic-layout-query.service.ts',
            hash: '93604b622c115f195d5bfbab917472cb8295e1a2',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/dynamic-layout/dynamic-layout-view.directive.ts',
            hash: '6fde413abb01a41017e42f3a6c2fbabc7562ddc9',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/dynamic-layout/dynamic-layout.component.ts',
            hash: '90aa8bacb91caff0d1e556ec166e12fa15e52a01',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/dynamic-layout/dynamic-layout.model.ts',
            hash: 'a1acf6bfada6893689f8a89a0170940a23eaae24',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/features/feature-primary/feature-primary-query.service.ts',
            hash: '1a0a2fe0972e3e9a95e40b45d60ae801ed893924',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/features/feature-primary/feature-primary.component.ts',
            hash: '9abaab90de699e3b0703f0fb2a10e6d8aecd8279',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/features/feature-primary/feature-primary.model.ts',
            hash: '7f765904321d7a74ba43c160379f0902e97b7b84',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/heros/hero-primary/hero-primary-query.service.ts',
            hash: 'b44518a5fa99d2387a3c669d555ba350739c2b80',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/heros/hero-primary/hero-primary.component.ts',
            hash: '44c2b46545c9b1605959a9a385bfe3b9b1008116',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/heros/hero-primary/hero-primary.model.ts',
            hash: 'f7e8f45d8156fc84bb556aea5e9eb1f7c291a43d',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/contentful/src/lib/image.tranformer.ts',
            hash: 'cc8bf88cdc377a627b17b761169d98a34673c4f1',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/layout-metas/layout-metas-query.service.ts',
            hash: '6ab380f3f360e5e63abc63d53844c0e5d2e46dc2',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/layout-metas/layout-metas.component.ts',
            hash: 'c38a90d9795d086590e994feebd37f81d86b455e',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/layout-metas/layout-metas.model.ts',
            hash: '4377be9409577cbf951d6d8d77e40cad9ce59598',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/testimonials/testimonial-primary/testimonial-primary-query.service.ts',
            hash: 'b46e29b15ff693dbedfd7aee38af873cd522b50d',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/testimonials/testimonial-primary/testimonial-primary.component.ts',
            hash: '36e20b4816aa542bacff781da2d2d3c76cde32da',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/contentful/src/lib/testimonials/testimonial-primary/testimonial-primary.model.ts',
            hash: 'd53c9a27e629630678d5c7bbd23c8d4e94e6f9e5',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/contentful/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/contentful/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/contentful/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/contentful/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/contentful/tslint.json',
            hash: 'b4df30d6360b3d808200b4c24aa113bb8d1d2e30',
            ext: '.json',
          },
        ],
      },
    },
    'platform-feature-about': {
      name: 'platform-feature-about',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/platform/feature-about',
        sourceRoot: 'libs/platform/feature-about/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/feature-about/tsconfig.lib.json',
                'libs/platform/feature-about/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/platform/feature-about/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/platform/feature-about/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['type:feature'],
        files: [
          {
            file: 'libs/platform/feature-about/README.md',
            hash: 'efc618dd9a472ff5667e3f5a67f46d1e88c27fe5',
            ext: '.md',
          },
          {
            file: 'libs/platform/feature-about/jest.config.js',
            hash: '0d1bd35b3768181513568bb94c8a9ddaefecffcb',
            ext: '.js',
          },
          {
            file: 'libs/platform/feature-about/src/index.ts',
            hash: '36f8bed7af416c353f5a1beaf1847f24db530a7b',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-about/src/lib/about/about.component.html',
            hash: '9585229f6b39256d10705536cfe6d392a9aff227',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-about/src/lib/about/about.component.scss',
            hash: 'ba66f3e45a14c9d82c3eeca318096c1d2805d4c3',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-about/src/lib/about/about.component.ts',
            hash: '477f0f57cac080f7c77906ee2a4216858b81922a',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-about/src/lib/platform-feature-about.module.ts',
            hash: '993c4b79c032f2df22f9bd025639cc70d5c15dca',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-about/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-about/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-about/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-about/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-about/tslint.json',
            hash: '73b97fa5da957ae1c3b7c1814eb288cec20e4d7e',
            ext: '.json',
          },
        ],
      },
    },
    'platform-feature-auth': {
      name: 'platform-feature-auth',
      type: 'lib',
      data: {
        root: 'libs/platform/feature-auth',
        sourceRoot: 'libs/platform/feature-auth/src',
        projectType: 'library',
        architect: {
          'test-change-to-jest-and-rename-back': {
            builder: '@angular-devkit/build-angular:karma',
            options: {
              main: 'libs/platform/feature-auth/src/test.ts',
              karmaConfig: 'libs/platform/feature-auth/karma.conf.js',
              scripts: [],
              styles: [],
              assets: [],
              tsConfig: 'libs/platform/feature-auth/tsconfig.spec.json',
            },
          },
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/feature-auth/tsconfig.lib.json',
                'libs/platform/feature-auth/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/platform/feature-auth/**/*',
              ],
            },
          },
        },
        prefix: '',
        tags: [],
        files: [
          {
            file: 'libs/platform/feature-auth/karma.conf.js',
            hash: 'fd5080706855d0ab41abf9c1b83c739d7e824b3f',
            ext: '.js',
          },
          {
            file: 'libs/platform/feature-auth/src/index.ts',
            hash: 'f9e1fc6d3c1a3ea15f2c6d16ad5d0d334fd17467',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-auth/src/lib/auth-callback/auth-callback.component.html',
            hash: 'a58059d3299e32ffa24a950d561c82458004ac2e',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-auth/src/lib/auth-callback/auth-callback.component.scss',
            hash: 'db0291ae856ba03fc059546a82b381c5a3a9cc90',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-auth/src/lib/auth-callback/auth-callback.component.ts',
            hash: '79a1904f4bf087cfb40adfbf074516f219fcdf0e',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-auth/src/lib/auth.guard.ts',
            hash: '93bc01cbfb139bdc20c69376794fda3ffc7c9237',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-auth/src/lib/auth.module.ts',
            hash: 'f77f88074193865d8501ecb299ed2259332546f6',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-auth/src/lib/email-not-verified/email-not-verified.component.html',
            hash: '69bab4b6a68c11ad41e10a710208184700a5f42c',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-auth/src/lib/email-not-verified/email-not-verified.component.scss',
            hash: '042c98ba3b28a2dc8c05a7d23261a7e05df3280c',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/feature-auth/src/lib/email-not-verified/email-not-verified.component.ts',
            hash: '0caef09e7f1d95b4f53941cef528f74dd9344a85',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-auth/src/lib/login-button/login-button.component.css',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.css',
          },
          {
            file:
              'libs/platform/feature-auth/src/lib/login-button/login-button.component.html',
            hash: 'dc2684ada7aaa0870aaed3a4b61abb88db150365',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-auth/src/lib/login-button/login-button.component.ts',
            hash: '44042bfac6687119e7a0517b1e9c6a6df8162903',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/feature-auth/src/lib/login/login.component.html',
            hash: 'ad949a08b76c9360dcc5ec7e60754cb53a2f94fc',
            ext: '.html',
          },
          {
            file:
              'libs/platform/feature-auth/src/lib/login/login.component.scss',
            hash: 'c3349b2e690bb6e3c9835c4308904c84c6b08849',
            ext: '.scss',
          },
          {
            file: 'libs/platform/feature-auth/src/lib/login/login.component.ts',
            hash: 'cc9f04b8eb52e988a440111f9d6d6ac580f84f44',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-auth/src/lib/nrwl-admin.guard.ts',
            hash: '58c390caa6c2e0e4f41a2e46d4b2d49dd07fc3b5',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-auth/src/lib/unauth.guard.ts',
            hash: '1196c435b215dc6760cf5f48680b3fd3990fa779',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-auth/src/test.ts',
            hash: '40ae238126b52a49932f4603239136bbab1c11fd',
            ext: '.ts',
          },
          {
            file: 'libs/platform/feature-auth/tsconfig.json',
            hash: '8c8dd086f99335d47c1f2f3e47fd3b8af7429293',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-auth/tsconfig.lib.json',
            hash: 'f4174b7450b3307df4ae6b89c4fcbaaff216c769',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-auth/tsconfig.spec.json',
            hash: '8b2bb2ed76fe1da946ed47caa2135a75562095cb',
            ext: '.json',
          },
          {
            file: 'libs/platform/feature-auth/tslint.json',
            hash: '95392b22f1daff08c314b72981978732803832fe',
            ext: '.json',
          },
        ],
      },
    },
    'nrwlio-site-ui-styles': {
      name: 'nrwlio-site-ui-styles',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nrwlio-site/ui/styles',
        sourceRoot: 'libs/nrwlio-site/ui/styles/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nrwlio-site/ui/styles/tsconfig.lib.json',
                'libs/nrwlio-site/ui/styles/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nrwlio-site/ui/styles/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nrwlio-site/ui/styles/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['nrwlio', 'type:ui'],
        files: [
          {
            file: 'libs/nrwlio-site/ui/styles/README.md',
            hash: '86df2f5a9665eb6d038174b2d794e5edf825de2a',
            ext: '.md',
          },
          {
            file: 'libs/nrwlio-site/ui/styles/jest.config.js',
            hash: '6cd75c4f2d635be568fc2de3597949b50db9a31e',
            ext: '.js',
          },
          {
            file: 'libs/nrwlio-site/ui/styles/src/index.ts',
            hash: '9f0b3d2ee14e6be904a18647aa9a9d128783fcdb',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/ui/styles/src/lib/material.scss',
            hash: 'd6e51d3456b8c1928f93b8d586204c167bc8697a',
            ext: '.scss',
          },
          {
            file: 'libs/nrwlio-site/ui/styles/src/lib/styles.ts',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/ui/styles/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/ui/styles/tsconfig.json',
            hash: 'd32f55e3999447ae24e89f0e76d8c3128113c85e',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/ui/styles/tsconfig.lib.json',
            hash: 'ad83824e5f62f1e5ff2acd0960bde6bab3f87d66',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/ui/styles/tsconfig.spec.json',
            hash: 'aed68bc6bf86609a7a4f0fdf5a562265cd90e452',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/ui/styles/tslint.json',
            hash: '83044b2002861893cc69114f11d0a1c4e043917a',
            ext: '.json',
          },
        ],
      },
    },
    'nrwlio-site-ui-footer': {
      name: 'nrwlio-site-ui-footer',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nrwlio-site/ui/footer',
        sourceRoot: 'libs/nrwlio-site/ui/footer/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nrwlio-site/ui/footer/tsconfig.lib.json',
                'libs/nrwlio-site/ui/footer/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nrwlio-site/ui/footer/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nrwlio-site/ui/footer/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['nrwlio', 'type:ui'],
        files: [
          {
            file: 'libs/nrwlio-site/ui/footer/README.md',
            hash: '9c64e096ff171c0f0e9367f9f54807bd85f33376',
            ext: '.md',
          },
          {
            file: 'libs/nrwlio-site/ui/footer/jest.config.js',
            hash: 'dbbc46f2f329d2d97134cd64b487469639819d08',
            ext: '.js',
          },
          {
            file: 'libs/nrwlio-site/ui/footer/src/index.ts',
            hash: '555e2f2a8ff3bd02a7c904974fcb75ffa1b13746',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/ui/footer/src/lib/footer/footer.component.html',
            hash: '884d9b99d928404ac2770d3fa70c2ec7ea791aab',
            ext: '.html',
          },
          {
            file:
              'libs/nrwlio-site/ui/footer/src/lib/footer/footer.component.scss',
            hash: '739334a321774a55c40461de4f2af5c420fc1e9f',
            ext: '.scss',
          },
          {
            file:
              'libs/nrwlio-site/ui/footer/src/lib/footer/footer.component.ts',
            hash: 'cb7ebe3967563e3c1d9e63b3bcfa8b3ff047cbea',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/ui/footer/src/lib/newsletter-signup/newsletter-signup.component.html',
            hash: '30fb93f9b6b1f0ce586375aebef763ae8efdd7ca',
            ext: '.html',
          },
          {
            file:
              'libs/nrwlio-site/ui/footer/src/lib/newsletter-signup/newsletter-signup.component.scss',
            hash: '9f2e1cf47560fa50bda95cef93d7b5ab1423b86d',
            ext: '.scss',
          },
          {
            file:
              'libs/nrwlio-site/ui/footer/src/lib/newsletter-signup/newsletter-signup.component.ts',
            hash: 'a6022a844315b787e5f3bcc8bb72f5e046881ee7',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/ui/footer/src/lib/ui-footer.module.ts',
            hash: '57a3d404a2c9007b1737d3e0b09cfe682befaafb',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/ui/footer/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/ui/footer/tsconfig.json',
            hash: 'd32f55e3999447ae24e89f0e76d8c3128113c85e',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/ui/footer/tsconfig.lib.json',
            hash: 'ad83824e5f62f1e5ff2acd0960bde6bab3f87d66',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/ui/footer/tsconfig.spec.json',
            hash: 'aed68bc6bf86609a7a4f0fdf5a562265cd90e452',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/ui/footer/tslint.json',
            hash: '83044b2002861893cc69114f11d0a1c4e043917a',
            ext: '.json',
          },
        ],
      },
    },
    'nrwlio-site-ui-header': {
      name: 'nrwlio-site-ui-header',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nrwlio-site/ui/header',
        sourceRoot: 'libs/nrwlio-site/ui/header/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nrwlio-site/ui/header/tsconfig.lib.json',
                'libs/nrwlio-site/ui/header/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nrwlio-site/ui/header/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nrwlio-site/ui/header/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['nrwlio', 'type:ui'],
        files: [
          {
            file: 'libs/nrwlio-site/ui/header/README.md',
            hash: '25265a75b024879efa8e9daabc3c0e3857d35810',
            ext: '.md',
          },
          {
            file: 'libs/nrwlio-site/ui/header/jest.config.js',
            hash: '0c4e94c3754033cadabdbfc3f1d74fa42e51257a',
            ext: '.js',
          },
          {
            file: 'libs/nrwlio-site/ui/header/src/index.ts',
            hash: 'c8dfa599dd83fda8416ab43f249eb49be9a06815',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/ui/header/src/lib/header/header.component.html',
            hash: '3fd0db3c4707356e4decea1727e7832cd62dfc7d',
            ext: '.html',
          },
          {
            file:
              'libs/nrwlio-site/ui/header/src/lib/header/header.component.scss',
            hash: '914a70d9e63867d84235826468137a3dcb40b356',
            ext: '.scss',
          },
          {
            file:
              'libs/nrwlio-site/ui/header/src/lib/header/header.component.ts',
            hash: 'b055f0fb1e43cdd49c016684381afa39e58b8975',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/ui/header/src/lib/ui-header.module.ts',
            hash: '8aa334a8ca88009aa563f79827e9cb64543ae135',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/ui/header/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/ui/header/tsconfig.json',
            hash: 'd32f55e3999447ae24e89f0e76d8c3128113c85e',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/ui/header/tsconfig.lib.json',
            hash: 'ad83824e5f62f1e5ff2acd0960bde6bab3f87d66',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/ui/header/tsconfig.spec.json',
            hash: 'aed68bc6bf86609a7a4f0fdf5a562265cd90e452',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/ui/header/tslint.json',
            hash: '83044b2002861893cc69114f11d0a1c4e043917a',
            ext: '.json',
          },
        ],
      },
    },
    'nrwlio-site-analytics': {
      name: 'nrwlio-site-analytics',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nrwlio-site/analytics',
        sourceRoot: 'libs/nrwlio-site/analytics/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nrwlio-site/analytics/tsconfig.lib.json',
                'libs/nrwlio-site/analytics/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nrwlio-site/analytics/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nrwlio-site/analytics/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['nrwlio'],
        files: [
          {
            file: 'libs/nrwlio-site/analytics/README.md',
            hash: 'bbd235a3b19b1a43cdd8b6e389f30cc74ad09ca3',
            ext: '.md',
          },
          {
            file: 'libs/nrwlio-site/analytics/jest.config.js',
            hash: 'a71f2a8726dde2239d2529d913c3939fc1a8ef78',
            ext: '.js',
          },
          {
            file: 'libs/nrwlio-site/analytics/src/index.ts',
            hash: 'a22be7153af946bde3fd02dd94abc62cab9c2d29',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/analytics/src/lib/analytics.module.ts',
            hash: 'cccbba548b2b200f4c6c18c4643ad36aacfc843a',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/analytics/src/lib/analytics.service.ts',
            hash: '3ca2ed9cf7c2f8cd9152ddf155e57a95b63a9d1c',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/analytics/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/analytics/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/analytics/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/analytics/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/analytics/tslint.json',
            hash: '73b97fa5da957ae1c3b7c1814eb288cec20e4d7e',
            ext: '.json',
          },
        ],
      },
    },
    'nx-cloud-feature-auth': {
      name: 'nx-cloud-feature-auth',
      type: 'lib',
      data: {
        root: 'libs/nx-cloud/feature-auth',
        sourceRoot: 'libs/nx-cloud/feature-auth/src',
        projectType: 'library',
        schematics: {},
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-cloud/feature-auth/tsconfig.lib.json',
                'libs/nx-cloud/feature-auth/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nx-cloud/feature-auth/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nx-cloud/feature-auth/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        tags: ['nx-cloud', 'type:feature'],
        files: [
          {
            file: 'libs/nx-cloud/feature-auth/README.md',
            hash: '5058aae64429b235969c01b9ed96903a6ca0cdec',
            ext: '.md',
          },
          {
            file: 'libs/nx-cloud/feature-auth/jest.config.js',
            hash: '0aebc1caaa94decba9afbe18ebb1f7ceeeb1fef8',
            ext: '.js',
          },
          {
            file: 'libs/nx-cloud/feature-auth/src/index.ts',
            hash: '7113562d6c914f3ab7d452658b317c3c46d222cf',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/feature-auth/src/lib/auth-callback/auth-callback.component.html',
            hash: 'f5823908dbab9d59da412afed538a6a3a7f86259',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/feature-auth/src/lib/auth-callback/auth-callback.component.scss',
            hash: 'c9cec10d9543174dfba64a2836fd0d521c983b5d',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/feature-auth/src/lib/auth-callback/auth-callback.component.ts',
            hash: 'd0cd6996802d4386e6b2acdd7925a487e1432ce4',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/feature-auth/src/lib/auth.guard.ts',
            hash: '86711a969851931c9b4be330eac2133153b6664a',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/feature-auth/src/lib/auth0-based-auth.module.ts',
            hash: '167836042b427488f47ebf1627acc9b313642360',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/feature-auth/src/lib/basic-auth.module.ts',
            hash: '998348a45074d62f5e0f77b234b83fdeb442b575',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/feature-auth/src/lib/initial-redirect.guard.ts',
            hash: '8198b3be7eeb132c47d7225a24d88d9588370f65',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/feature-auth/src/lib/login-button/login-button.component.html',
            hash: 'a2e6ddd66774ab948d3d3bfd5a1a021d7fb4f9d1',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/feature-auth/src/lib/login-button/login-button.component.scss',
            hash: '0ee098ba01ee5edddbe7bf306a1d084fb3e7da57',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/feature-auth/src/lib/login-button/login-button.component.ts',
            hash: '24b6bc66a0c8e65b4fe6c0981a9ca0cecbf2d534',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/feature-auth/src/lib/login/login.component.html',
            hash: '315e8a39495eda36c80d9ac72b7d4393709d94bd',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/feature-auth/src/lib/login/login.component.scss',
            hash: 'c9cec10d9543174dfba64a2836fd0d521c983b5d',
            ext: '.scss',
          },
          {
            file: 'libs/nx-cloud/feature-auth/src/lib/login/login.component.ts',
            hash: '05e0ccb778e754c79896ce5bc3649c78264cb140',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/feature-auth/src/lib/nrwl-admin.guard.ts',
            hash: '8b5141ebaa060a7712dece22c78f03fbf4848626',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/feature-auth/src/lib/services/auth.service.ts',
            hash: 'bdcad7c0f7ea47d46f676d846a2e460b28d1a43e',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/feature-auth/src/lib/services/auth0-based-auth.service.ts',
            hash: '3ed8517d8faa44fe843f5ca75fd640e065566ae1',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/feature-auth/src/lib/services/basic-auth.service.ts',
            hash: 'eaeeeb6395ce3c4c5784fe50a5959130998ea067',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/feature-auth/src/lib/ui-auth.module.ts',
            hash: '0b84d7942d974c63867c821073d43b9d2de0a8ca',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/feature-auth/src/lib/unauth.guard.ts',
            hash: 'b53cc7a165aceb3204c48bedc0a6f038749dacdb',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/feature-auth/src/lib/verify-email/verify-email.component.html',
            hash: '7b61bf95536ce912c53943f4f9bdfc5ab85985c9',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/feature-auth/src/lib/verify-email/verify-email.component.scss',
            hash: 'd8cb14b81edd38910070c847d93e98bb3ad599da',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-cloud/feature-auth/src/lib/verify-email/verify-email.component.ts',
            hash: '035b92fd1028cf1ccc60871ed2d6517cdbe183e2',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/feature-auth/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/feature-auth/tsconfig.lib.json',
            hash: '0fe9966358eb51092a1668ecb0795b6db52a538b',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/feature-auth/tsconfig.spec.json',
            hash: '4dc880ff63ba87e658f9948d0f04608f6c871f71',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/feature-auth/tslint.json',
            hash: '95392b22f1daff08c314b72981978732803832fe',
            ext: '.json',
          },
        ],
      },
    },
    'design-system-buttons': {
      name: 'design-system-buttons',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/design-system/buttons',
        sourceRoot: 'libs/design-system/buttons/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/design-system/buttons/tsconfig.lib.json',
                'libs/design-system/buttons/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/design-system/buttons/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/design-system/buttons/jest.config.js',
              tsConfig: 'libs/design-system/buttons/tsconfig.spec.json',
              passWithNoTests: true,
              setupFile: 'libs/design-system/buttons/src/test-setup.ts',
            },
          },
          storybook: {
            builder: '@nrwl/storybook:storybook',
            options: {
              uiFramework: '@storybook/angular',
              port: 4400,
              config: {
                configFolder: 'libs/design-system/buttons/.storybook',
              },
            },
            configurations: {
              ci: {
                quiet: true,
              },
            },
          },
          'build-storybook': {
            builder: '@nrwl/storybook:build',
            options: {
              uiFramework: '@storybook/angular',
              outputPath: 'dist/storybook/design-system-buttons',
              config: {
                configFolder: 'libs/design-system/buttons/.storybook',
              },
            },
            configurations: {
              ci: {
                quiet: true,
              },
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            style: 'scss',
          },
        },
        tags: ['scope:design-system', 'type:ui'],
        files: [
          {
            file: 'libs/design-system/buttons/.storybook/addons.js',
            hash: '2a4e2a760563f6c037fe6ce2c00043bd63816d25',
            ext: '.js',
          },
          {
            file: 'libs/design-system/buttons/.storybook/config.js',
            hash: '04c36e9a5e2c9cbccb3b2ae70b272c73739e73a4',
            ext: '.js',
          },
          {
            file: 'libs/design-system/buttons/.storybook/tsconfig.json',
            hash: '2683bab1b73ced5387594d93e3f34dff391c9e3d',
            ext: '.json',
          },
          {
            file: 'libs/design-system/buttons/.storybook/webpack.config.js',
            hash: 'b3f8e9e0160ca753260f62ca4a4c7f267a35a6d6',
            ext: '.js',
          },
          {
            file: 'libs/design-system/buttons/README.md',
            hash: 'dd07811849dff9baccce22c626bdaf42c2974846',
            ext: '.md',
          },
          {
            file: 'libs/design-system/buttons/jest.config.js',
            hash: 'e7d689d2fe1050bed4068a05254122275d47c328',
            ext: '.js',
          },
          {
            file: 'libs/design-system/buttons/src/index.ts',
            hash: '293de0b13a1582bcb444a35a36b57fcbd2b96c98',
            ext: '.ts',
          },
          {
            file:
              'libs/design-system/buttons/src/lib/anchor-buttons.component.scss',
            hash: 'be30b84a330b75a1d18b294952229d7357a909e9',
            ext: '.scss',
          },
          {
            file:
              'libs/design-system/buttons/src/lib/anchor-buttons.component.spec.ts',
            hash: '0a31b4afc6206841545998dbbb4dff0f7a4260ed',
            ext: '.ts',
          },
          {
            file:
              'libs/design-system/buttons/src/lib/anchor-buttons.component.ts',
            hash: 'adb4b0dd63f6d92f9df4449d761cfbf9f3bdb0a9',
            ext: '.ts',
          },
          {
            file:
              'libs/design-system/buttons/src/lib/buttons-viewer-component.component.ts',
            hash: '03e6b1680eec8dd19de5a27b7146721d1f5a0e46',
            ext: '.ts',
          },
          {
            file: 'libs/design-system/buttons/src/lib/buttons.component.scss',
            hash: '1b6cfc39b8ed30ba63dd0c8f05f1fb9ec1f96d00',
            ext: '.scss',
          },
          {
            file:
              'libs/design-system/buttons/src/lib/buttons.component.spec.ts',
            hash: 'e3708472c189004cd6fb1336190cee2141b751ae',
            ext: '.ts',
          },
          {
            file:
              'libs/design-system/buttons/src/lib/buttons.component.stories.ts',
            hash: '2074f05361daf5ab03bf89717c64ca34d153efbc',
            ext: '.ts',
          },
          {
            file: 'libs/design-system/buttons/src/lib/buttons.component.ts',
            hash: '0dbbacb4d0ab52fd91eaad04a9fd2a51c1558d89',
            ext: '.ts',
          },
          {
            file: 'libs/design-system/buttons/src/lib/buttons.module.ts',
            hash: 'aa6c513c3e1eb69c2092bfe435afecdc8cdc8314',
            ext: '.ts',
          },
          {
            file: 'libs/design-system/buttons/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/design-system/buttons/tsconfig.json',
            hash: '667a3463d1d1367fdaa0a33be5eded304f7873f1',
            ext: '.json',
          },
          {
            file: 'libs/design-system/buttons/tsconfig.lib.json',
            hash: '6b1960321ef35b34edf6512a0032eed1da7ba650',
            ext: '.json',
          },
          {
            file: 'libs/design-system/buttons/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/design-system/buttons/tslint.json',
            hash: '5708d7147ddece6af5375119e6cc1a3a9032fb77',
            ext: '.json',
          },
        ],
      },
    },
    'nx-packages-nx-cloud': {
      name: 'nx-packages-nx-cloud',
      type: 'lib',
      data: {
        root: 'libs/nx-packages/nx-cloud',
        sourceRoot: 'libs/nx-packages/nx-cloud/src',
        projectType: 'library',
        schematics: {},
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-packages/nx-cloud/tsconfig.lib.json',
                'libs/nx-packages/nx-cloud/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nx-packages/nx-cloud/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nx-packages/nx-cloud/jest.config.js',
              passWithNoTests: true,
            },
          },
          build: {
            builder: '@nrwl/node:package',
            options: {
              outputPath: 'dist/libs/nx-packages/nx-cloud',
              tsConfig: 'libs/nx-packages/nx-cloud/tsconfig.lib.json',
              packageJson: 'libs/nx-packages/nx-cloud/package.json',
              main: 'libs/nx-packages/nx-cloud/src/index.ts',
              assets: [
                'libs/nx-packages/nx-cloud/**/*.md',
                'libs/nx-packages/nx-cloud/LICENSE',
                {
                  input: 'libs/nx-packages/nx-cloud/src',
                  glob: '**/*.json',
                  output: '.',
                },
              ],
              srcRootForCompilationRoot: 'libs/nx-packages/nx-cloud/src',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/nx-packages/nx-cloud/README.md',
            hash: 'b826e1440b2c55ce5c53ae72ed4ec285644be4cc',
            ext: '.md',
          },
          {
            file: 'libs/nx-packages/nx-cloud/jest.config.js',
            hash: 'd25995f97edd313c3b2b7c34737aea09809d576e',
            ext: '.js',
          },
          {
            file: 'libs/nx-packages/nx-cloud/package.json',
            hash: 'a0ec29080ee9c002d47c019271b5b1e63cea56d4',
            ext: '.json',
          },
          {
            file: 'libs/nx-packages/nx-cloud/src/collection.json',
            hash: 'e7553a6427cff657127b5704b1846562f25ccd6e',
            ext: '.json',
          },
          {
            file: 'libs/nx-packages/nx-cloud/src/index.ts',
            hash: 'ec763f31aa9636175aad992eedcc8d118d481fb0',
            ext: '.ts',
          },
          {
            file: 'libs/nx-packages/nx-cloud/src/lib/nx-cloud-tasks-runner.ts',
            hash: 'e033d6e505de0bc21f1119d3c56059d02d1cffec',
            ext: '.ts',
          },
          {
            file: 'libs/nx-packages/nx-cloud/src/lib/schematics/init/init.ts',
            hash: '43fc73e53c49cfdd3384bac237f9917a7178737a',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-packages/nx-cloud/src/lib/schematics/init/schema.d.ts',
            hash: '6811d5ff06afdf91c8421292992b005eb9a531cc',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-packages/nx-cloud/src/lib/schematics/init/schema.json',
            hash: '83fcee72c23c738381230a56299bb7959adf1f95',
            ext: '.json',
          },
          {
            file: 'libs/nx-packages/nx-cloud/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/nx-packages/nx-cloud/tsconfig.lib.json',
            hash: 'ca4b70c39ccb79a18f56320925acbfd7a05323c3',
            ext: '.json',
          },
          {
            file: 'libs/nx-packages/nx-cloud/tsconfig.spec.json',
            hash: '4dc880ff63ba87e658f9948d0f04608f6c871f71',
            ext: '.json',
          },
          {
            file: 'libs/nx-packages/nx-cloud/tslint.json',
            hash: '95392b22f1daff08c314b72981978732803832fe',
            ext: '.json',
          },
        ],
      },
    },
    'nx-docs-site-base-ui': {
      name: 'nx-docs-site-base-ui',
      type: 'lib',
      data: {
        root: 'libs/nx-docs-site/base-ui',
        sourceRoot: 'libs/nx-docs-site/base-ui/src',
        projectType: 'library',
        prefix: 'nx-ui',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-docs-site/base-ui/tsconfig.lib.json',
                'libs/nx-docs-site/base-ui/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nx-docs-site/base-ui/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nx-docs-site/base-ui/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/schematics:component': {
            styleext: 'scss',
          },
        },
        tags: ['nx:docs-site'],
        files: [
          {
            file: 'libs/nx-docs-site/base-ui/jest.config.js',
            hash: '0c771c92194a778beeb92c7b3f908942a00930bf',
            ext: '.js',
          },
          {
            file: 'libs/nx-docs-site/base-ui/src/index.ts',
            hash: 'f89b6df24fbd5b82e484edab9da713f4acd2aa06',
            ext: '.ts',
          },
          {
            file: 'libs/nx-docs-site/base-ui/src/lib/base-ui.module.ts',
            hash: '6f8b2d91d467df4de951389624f1eca6c33abc66',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/base-ui/src/lib/flavors-overlay/flavors-overlay-ref.ts',
            hash: 'c0522e200a153998d7ffa9350342d79bb279f046',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/base-ui/src/lib/flavors-overlay/flavors-overlay.component.html',
            hash: '2fd6469d53cf2afbfec11ab5a29c2c5d9b49d0a1',
            ext: '.html',
          },
          {
            file:
              'libs/nx-docs-site/base-ui/src/lib/flavors-overlay/flavors-overlay.component.scss',
            hash: '5748378ba20c340e4c9e1f2cd6a8c1ea8bff7e8e',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-docs-site/base-ui/src/lib/flavors-overlay/flavors-overlay.component.ts',
            hash: 'da2a1e3dc5251f379b872dfe57ac532090e84931',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/base-ui/src/lib/flavors-overlay/flavors-overlay.service.ts',
            hash: 'f46e21347f6cecd4d33395b4f985960b6c1b3c81',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/base-ui/src/lib/flavors-selector/flavors-selector.component.html',
            hash: '748571775681e917254c5109226a8c5bb6b5d8b1',
            ext: '.html',
          },
          {
            file:
              'libs/nx-docs-site/base-ui/src/lib/flavors-selector/flavors-selector.component.scss',
            hash: '65bde26146c6deebed2aaf376dd899772d6973c5',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-docs-site/base-ui/src/lib/flavors-selector/flavors-selector.component.ts',
            hash: 'ac028199b20e4c67b970bf2aa150f2546b90d55c',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/base-ui/src/lib/flex-layout/custom-flex-directive.ts',
            hash: '47af2055fcf6848fb440c0af57d1d0d743a2d763',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/base-ui/src/lib/flex-layout/custom-layout-align-directive.ts',
            hash: '15a19407e339681e37d395a96ad10a42d76ab0fd',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/base-ui/src/lib/flex-layout/custom-layout-directive.ts',
            hash: 'db76598f59f3424f37001f2bceba7fb740585bef',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/base-ui/src/lib/flex-layout/custom-layout-gap-directive.ts',
            hash: 'be368154ef526f8f949681e16a152c3e6701535e',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/base-ui/src/lib/footer/footer.component.ts',
            hash: '70ce83eb22eb71b2a40a74132b7bf5badf17e9d3',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/base-ui/src/lib/header/header.component.ts',
            hash: '71ddf8a4fa6e39fcc631bbe9430bede888ba2c5a',
            ext: '.ts',
          },
          {
            file: 'libs/nx-docs-site/base-ui/src/lib/material.module.ts',
            hash: '7afff9a3bed46b1034520aebacaf54ef1c27e0dd',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/base-ui/src/lib/nav-item/nav-item.component.scss',
            hash: '178528a9f888189cd4b6b43888008688edda266f',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-docs-site/base-ui/src/lib/nav-item/nav-item.component.ts',
            hash: '6086ff514e3dfc95a68350a747687f926cd602f4',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/base-ui/src/lib/side-menu/side-menu.component.scss',
            hash: '0da5ee312f32888308ef9a0df9c01ed42eb1e768',
            ext: '.scss',
          },
          {
            file:
              'libs/nx-docs-site/base-ui/src/lib/side-menu/side-menu.component.ts',
            hash: 'daeb62c6f482c2fe1849c53fdf9d9f44fce4de6f',
            ext: '.ts',
          },
          {
            file: 'libs/nx-docs-site/base-ui/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nx-docs-site/base-ui/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/nx-docs-site/base-ui/tsconfig.lib.json',
            hash: '42f90e7794e1b9c59fad6c87128caf03ef1470dc',
            ext: '.json',
          },
          {
            file: 'libs/nx-docs-site/base-ui/tsconfig.spec.json',
            hash: 'caa51f739859c7b58b7c62551d221a6002fac9f1',
            ext: '.json',
          },
          {
            file: 'libs/nx-docs-site/base-ui/tslint.json',
            hash: '35eaf2ea6cee78eea9c967c30a5e80bd26b5ee07',
            ext: '.json',
          },
        ],
      },
    },
    'nrwlio-site-ui-heros': {
      name: 'nrwlio-site-ui-heros',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nrwlio-site/ui/heros',
        sourceRoot: 'libs/nrwlio-site/ui/heros/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nrwlio-site/ui/heros/tsconfig.lib.json',
                'libs/nrwlio-site/ui/heros/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nrwlio-site/ui/heros/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nrwlio-site/ui/heros/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['nrwlio', 'type:ui'],
        files: [
          {
            file: 'libs/nrwlio-site/ui/heros/README.md',
            hash: 'd6a3cbafbe3b1fd47476ba1b88f108649a9d2041',
            ext: '.md',
          },
          {
            file: 'libs/nrwlio-site/ui/heros/jest.config.js',
            hash: '14b3f46850c4e31a3e6e3f3025a44f08d1b6f407',
            ext: '.js',
          },
          {
            file: 'libs/nrwlio-site/ui/heros/src/index.ts',
            hash: '9b3add86e27f10ab6775e5ee3b4af96370370043',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwlio-site/ui/heros/src/lib/hero-full/hero-full.component.html',
            hash: '5c5b4aa01965ff48f5c632a9ac27be5e4fbacd68',
            ext: '.html',
          },
          {
            file:
              'libs/nrwlio-site/ui/heros/src/lib/hero-full/hero-full.component.scss',
            hash: '4b201a8cbd17d47f39b60e89b891ba11722cc5be',
            ext: '.scss',
          },
          {
            file:
              'libs/nrwlio-site/ui/heros/src/lib/hero-full/hero-full.component.ts',
            hash: '21fb5f4a0433af458bc04b3b935af7c335559e89',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/ui/heros/src/lib/hero/hero.component.html',
            hash: '473e25c15a2e4d4019057d11ce01ddf5d073ac2a',
            ext: '.html',
          },
          {
            file: 'libs/nrwlio-site/ui/heros/src/lib/hero/hero.component.scss',
            hash: 'd43bef5c3719ee7be40aacc30ab2f4c1502fe2ce',
            ext: '.scss',
          },
          {
            file: 'libs/nrwlio-site/ui/heros/src/lib/hero/hero.component.ts',
            hash: '7ebdd523280ade79439c07aa6c79c6e92d90c87c',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/ui/heros/src/lib/ui-heros.module.ts',
            hash: '7cd11a036da2d20eed1f1291b17542ba7be2bf27',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/ui/heros/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/ui/heros/tsconfig.json',
            hash: 'd32f55e3999447ae24e89f0e76d8c3128113c85e',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/ui/heros/tsconfig.lib.json',
            hash: 'ad83824e5f62f1e5ff2acd0960bde6bab3f87d66',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/ui/heros/tsconfig.spec.json',
            hash: 'aed68bc6bf86609a7a4f0fdf5a562265cd90e452',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/ui/heros/tslint.json',
            hash: '83044b2002861893cc69114f11d0a1c4e043917a',
            ext: '.json',
          },
        ],
      },
    },
    'ui-article-container': {
      name: 'ui-article-container',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/ui/article-container',
        sourceRoot: 'libs/ui/article-container/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/ui/article-container/tsconfig.lib.json',
                'libs/ui/article-container/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/ui/article-container/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/ui/article-container/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/ui/article-container/README.md',
            hash: '5a2eb22095a7cc43832b7bbb847edf048a4de1c9',
            ext: '.md',
          },
          {
            file: 'libs/ui/article-container/jest.config.js',
            hash: '07b15bc7af3360e127ed4d42856d9e9f0b908858',
            ext: '.js',
          },
          {
            file: 'libs/ui/article-container/src/index.ts',
            hash: '83a1c2ef0c11ec8b3e42798f4ec75bfea340cca5',
            ext: '.ts',
          },
          {
            file:
              'libs/ui/article-container/src/lib/article-container/article-container.component.html',
            hash: '106d35345463d3811a96d78b7ffd8d77f3f408d8',
            ext: '.html',
          },
          {
            file:
              'libs/ui/article-container/src/lib/article-container/article-container.component.scss',
            hash: '01f4935f01b0d4030c1db81f204974e1ebdc0fc3',
            ext: '.scss',
          },
          {
            file:
              'libs/ui/article-container/src/lib/article-container/article-container.component.ts',
            hash: '68ef828858073f5aad18a7257a394c1b91fe68e0',
            ext: '.ts',
          },
          {
            file:
              'libs/ui/article-container/src/lib/ui-article-container.module.spec.ts',
            hash: '109c364656a72f19127f31e4092efec6f38d2f44',
            ext: '.ts',
          },
          {
            file:
              'libs/ui/article-container/src/lib/ui-article-container.module.ts',
            hash: 'cf9a9c75de62d9a6e04d55502e0848f4bfb20a4f',
            ext: '.ts',
          },
          {
            file: 'libs/ui/article-container/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/ui/article-container/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/ui/article-container/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/ui/article-container/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/ui/article-container/tslint.json',
            hash: '5ad9ba82222ce3bd10c035b49adc62c50f8a2ef8',
            ext: '.json',
          },
        ],
      },
    },
    'nx-cloud-feature-faq': {
      name: 'nx-cloud-feature-faq',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nx-cloud/feature-faq',
        sourceRoot: 'libs/nx-cloud/feature-faq/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-cloud/feature-faq/tsconfig.lib.json',
                'libs/nx-cloud/feature-faq/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/nx-cloud/feature-faq/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nx-cloud/feature-faq/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            style: 'scss',
          },
        },
        tags: ['nx-cloud', 'type:feature'],
        files: [
          {
            file: 'libs/nx-cloud/feature-faq/README.md',
            hash: '8dde180ceb2a8a87d10fe43cd24d3edcb93c00a2',
            ext: '.md',
          },
          {
            file: 'libs/nx-cloud/feature-faq/jest.config.js',
            hash: '9a5db158203209a7d6ea75e667489fc158fcc585',
            ext: '.js',
          },
          {
            file: 'libs/nx-cloud/feature-faq/src/index.ts',
            hash: '966df7e7723f30e13384faaa22a9b92059e83d53',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/feature-faq/src/lib/faq/faq.component.html',
            hash: '2d1f325393b526ecc1bfe86d1845d195cba19d04',
            ext: '.html',
          },
          {
            file: 'libs/nx-cloud/feature-faq/src/lib/faq/faq.component.scss',
            hash: '06209672aa19e10a8f411c976dbd4c0c4745111c',
            ext: '.scss',
          },
          {
            file: 'libs/nx-cloud/feature-faq/src/lib/faq/faq.component.ts',
            hash: 'd8e2c282203ecca94ee926ce78e1ceadfdc17a0a',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/feature-faq/src/lib/nx-cloud-feature-faq.module.spec.ts',
            hash: '62658ae36c0d22fe59538e643dbcf3b80ac026e4',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/feature-faq/src/lib/nx-cloud-feature-faq.module.ts',
            hash: '3112a2712500145a8efbf52488b65798d5b822a6',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/feature-faq/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/feature-faq/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/feature-faq/tsconfig.lib.json',
            hash: '2dc9b2ccd7b7f5860be847ee69b9945d7bfb3ee8',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/feature-faq/tsconfig.lib.prod.json',
            hash: 'cbae794224800aec4b08c87a37135e334265908e',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/feature-faq/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/feature-faq/tslint.json',
            hash: '73b97fa5da957ae1c3b7c1814eb288cec20e4d7e',
            ext: '.json',
          },
        ],
      },
    },
    'design-system-styles': {
      name: 'design-system-styles',
      type: 'lib',
      data: {
        root: 'libs/design-system/styles',
        sourceRoot: 'libs/design-system/styles/src',
        projectType: 'library',
        schematics: {},
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/design-system/styles/tsconfig.lib.json',
                'libs/design-system/styles/tsconfig.spec.json',
              ],
              exclude: [
                '**/node_modules/**',
                '!libs/design-system/styles/**/*',
              ],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/design-system/styles/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        tags: ['scope:design-system', 'type:ui'],
        files: [
          {
            file: 'libs/design-system/styles/README.md',
            hash: '721b6fbf1f45c2f3b6b79bbe39f2eae7989b73a7',
            ext: '.md',
          },
          {
            file: 'libs/design-system/styles/jest.config.js',
            hash: '184b3d2350fb1701a16a8ec51f56afb9c44a2501',
            ext: '.js',
          },
          {
            file: 'libs/design-system/styles/src/index.ts',
            hash: 'd9ca3c5795529212a2ff34197b3ff308e0d437fc',
            ext: '.ts',
          },
          {
            file: 'libs/design-system/styles/src/lib/buttons.scss',
            hash: 'a362028d200890e5e365cac40ae18f51fed875b2',
            ext: '.scss',
          },
          {
            file: 'libs/design-system/styles/src/lib/colours.scss',
            hash: '2189bbbcd9be129a63aa00fda01f7bd4a5f199e2',
            ext: '.scss',
          },
          {
            file: 'libs/design-system/styles/src/lib/core.scss',
            hash: '6dfd962a3e7a6a4641aa71a335d33f96effb9f4e',
            ext: '.scss',
          },
          {
            file:
              'libs/design-system/styles/src/lib/design-system-styles.spec.ts',
            hash: 'a0961762d064bb061c5eea3a23e0a0b07af75ebe',
            ext: '.ts',
          },
          {
            file: 'libs/design-system/styles/src/lib/design-system-styles.ts',
            hash: '6ba6580cc07052ef8fde9ca2176e7fece63c7859',
            ext: '.ts',
          },
          {
            file: 'libs/design-system/styles/src/lib/easings.scss',
            hash: '8f40d0779416e6f5e805df88c8d1664e27c80560',
            ext: '.scss',
          },
          {
            file: 'libs/design-system/styles/src/lib/grids.scss',
            hash: '4fa67a8681ca2200e21bd6b0eb698984581364da',
            ext: '.scss',
          },
          {
            file: 'libs/design-system/styles/src/lib/inputs.scss',
            hash: '9ab74410121d603c186546328c96c1af3499fbc7',
            ext: '.scss',
          },
          {
            file: 'libs/design-system/styles/src/lib/markup-styles.scss',
            hash: '13aed5a1920e398f1b88364b4d0e43c4a2cc8eeb',
            ext: '.scss',
          },
          {
            file: 'libs/design-system/styles/src/lib/spacers.scss',
            hash: 'f9633a8723abb5d9815dfc9d2a88e1f13dff0aa5',
            ext: '.scss',
          },
          {
            file: 'libs/design-system/styles/src/lib/typography.scss',
            hash: '51b939470363d2594345a52132f3cbb2290fb89e',
            ext: '.scss',
          },
          {
            file: 'libs/design-system/styles/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/design-system/styles/tsconfig.lib.json',
            hash: '9c463b51e20eb49406561417052eb3bbf7876f87',
            ext: '.json',
          },
          {
            file: 'libs/design-system/styles/tsconfig.spec.json',
            hash: '4dc880ff63ba87e658f9948d0f04608f6c871f71',
            ext: '.json',
          },
          {
            file: 'libs/design-system/styles/tslint.json',
            hash: '2cdd2989d80fc797c1be816ca20227fb7a5ce457',
            ext: '.json',
          },
        ],
      },
    },
    'platform-components': {
      name: 'platform-components',
      type: 'lib',
      data: {
        root: 'libs/platform/components',
        sourceRoot: 'libs/platform/components/src',
        projectType: 'library',
        prefix: 'angular-console',
        architect: {
          'test-change-to-jest-and-rename-back': {
            builder: '@angular-devkit/build-angular:karma',
            options: {
              main: 'libs/platform/components/src/test.ts',
              tsConfig: 'libs/platform/components/tsconfig.spec.json',
              karmaConfig: 'libs/platform/components/karma.conf.js',
            },
          },
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/components/tsconfig.lib.json',
                'libs/platform/components/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/platform/components/**/*'],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/platform/components/karma.conf.js',
            hash: '8b286256c5bf0c57497c693f1d45ac35e58775dd',
            ext: '.js',
          },
          {
            file: 'libs/platform/components/src/index.ts',
            hash: '8ce1bc1ee2f5337fe5a04299300832aab7fdeb69',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/components/src/lib/back-button/back-button.component.html',
            hash: 'c5197fdec6cb85d8f57a9abfd49d9b4ff1e58e72',
            ext: '.html',
          },
          {
            file:
              'libs/platform/components/src/lib/back-button/back-button.component.scss',
            hash: 'f879aed8ae31fa550dd668b184c90fe2196479f0',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/components/src/lib/back-button/back-button.component.ts',
            hash: 'e2967487d319ef8392940124595b541911eabe0f',
            ext: '.ts',
          },
          {
            file: 'libs/platform/components/src/lib/constants.ts',
            hash: '5df696ff039ec115ebd8b03a138af39e5972e9b2',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/components/src/lib/live-now/live-now.component.html',
            hash: 'e930cc077abd167e86ed702bd2a66bd1b90578e2',
            ext: '.html',
          },
          {
            file:
              'libs/platform/components/src/lib/live-now/live-now.component.scss',
            hash: '93997537009c774264889cd24602641618986057',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/components/src/lib/live-now/live-now.component.ts',
            hash: '2eae55985756bfda86031e37b7432fd456769fde',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/components/src/lib/platform-components.module.ts',
            hash: '89279122219fe30e3e30aa803a0186ae63c2ff65',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/components/src/lib/primary-toolbar/primary-toolbar.component.html',
            hash: 'e480a622f13ee07a6617248f236d29833c764244',
            ext: '.html',
          },
          {
            file:
              'libs/platform/components/src/lib/primary-toolbar/primary-toolbar.component.scss',
            hash: 'c7b7bcbd115d4afa8d6341ae31aadf0540cfca8a',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/components/src/lib/primary-toolbar/primary-toolbar.component.ts',
            hash: '4fc969bb1834ab00365b4531dbd925b517d7ffa1',
            ext: '.ts',
          },
          {
            file: 'libs/platform/components/src/test.ts',
            hash: '40ae238126b52a49932f4603239136bbab1c11fd',
            ext: '.ts',
          },
          {
            file: 'libs/platform/components/tsconfig.json',
            hash: '8c8dd086f99335d47c1f2f3e47fd3b8af7429293',
            ext: '.json',
          },
          {
            file: 'libs/platform/components/tsconfig.lib.json',
            hash: 'be50ebc4900846e3c41c60a1acbb2537149b8e1d',
            ext: '.json',
          },
          {
            file: 'libs/platform/components/tsconfig.spec.json',
            hash: 'ced4c44d7abe1ff9c4c079f70d6c96e908101f23',
            ext: '.json',
          },
          {
            file: 'libs/platform/components/tslint.json',
            hash: '2a88bfbfbe8c85a62dcbe985dc55e07f3483ece9',
            ext: '.json',
          },
        ],
      },
    },
    'platform-scss-utils': {
      name: 'platform-scss-utils',
      type: 'lib',
      data: {
        root: 'libs/platform/scss-utils',
        sourceRoot: 'libs/platform/scss-utils',
        projectType: 'library',
        architect: {},
        tags: [],
        files: [
          {
            file: 'libs/platform/scss-utils/_material-theme.scss',
            hash: 'ae99516d41f18963bfb9c54a8860356540321b4b',
            ext: '.scss',
          },
          {
            file: 'libs/platform/scss-utils/_variables-mixins.scss',
            hash: '5e39770997a20f6b221e413d9e8db6b7383bde05',
            ext: '.scss',
          },
          {
            file: 'libs/platform/scss-utils/tsconfig.json',
            hash: 'b10892d26824dc9a4a10e405ec6d34dc4c25f45b',
            ext: '.json',
          },
        ],
      },
    },
    'nx-docs-site-styles': {
      name: 'nx-docs-site-styles',
      type: 'lib',
      data: {
        root: 'libs/nx-docs-site/styles',
        sourceRoot: 'libs/nx-docs-site/styles/src',
        projectType: 'library',
        prefix: 'nx-style',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-docs-site/styles/tsconfig.lib.json',
                'libs/nx-docs-site/styles/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/nx-docs-site/styles/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nx-docs-site/styles/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/schematics:component': {
            styleext: 'scss',
          },
        },
        tags: ['nx:docs-site'],
        files: [
          {
            file: 'libs/nx-docs-site/styles/jest.config.js',
            hash: '4ad862e7f4834cb5855677d45a0e88b9f099915b',
            ext: '.js',
          },
          {
            file: 'libs/nx-docs-site/styles/src/index.ts',
            hash: '8c6d1db169c3629c8d0dc9289a43506c3161628d',
            ext: '.ts',
          },
          {
            file: 'libs/nx-docs-site/styles/src/lib/_typography.scss',
            hash: '7dd5a735cd7fddddc9b54957f87bbf4cdf751310',
            ext: '.scss',
          },
          {
            file: 'libs/nx-docs-site/styles/src/lib/main.scss',
            hash: 'ac5ecc46339925322c7df0d1234f183a9c57d24f',
            ext: '.scss',
          },
          {
            file: 'libs/nx-docs-site/styles/src/lib/material.scss',
            hash: 'b368991c340b5bff41e008fcaab33199aca7461d',
            ext: '.scss',
          },
          {
            file: 'libs/nx-docs-site/styles/src/lib/styles.module.ts',
            hash: 'a9d92c3a1f4c0ba6598e0bd89b4be1affc091048',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-docs-site/styles/src/lib/theme-switcher/theme-switcher.component.ts',
            hash: 'b3409786247d217fa39d7d52337268121b016c3f',
            ext: '.ts',
          },
          {
            file: 'libs/nx-docs-site/styles/src/lib/variables.scss',
            hash: 'bd60ad0e9bf2301c3ad57dc5d8832c7e1287a312',
            ext: '.scss',
          },
          {
            file: 'libs/nx-docs-site/styles/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nx-docs-site/styles/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/nx-docs-site/styles/tsconfig.lib.json',
            hash: '4bf29530c2e9c0818fbba76bad8ea4c1b5299985',
            ext: '.json',
          },
          {
            file: 'libs/nx-docs-site/styles/tsconfig.spec.json',
            hash: '5c7c26ba64fc8946a52785f118b47b7059de241e',
            ext: '.json',
          },
          {
            file: 'libs/nx-docs-site/styles/tslint.json',
            hash: 'f3b9daadd6d3fdbe54ee72a1a75f5441b200cde6',
            ext: '.json',
          },
        ],
      },
    },
    'platform-ui-courses': {
      name: 'platform-ui-courses',
      type: 'lib',
      data: {
        root: 'libs/platform/ui-courses',
        sourceRoot: 'libs/platform/ui-courses/src',
        projectType: 'library',
        prefix: 'ui-courses',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/ui-courses/tsconfig.lib.json',
                'libs/platform/ui-courses/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/platform/ui-courses/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/platform/ui-courses/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/schematics:component': {
            styleext: 'scss',
          },
        },
        tags: ['type:ui'],
        files: [
          {
            file: 'libs/platform/ui-courses/README.md',
            hash: 'b178ff6c2536f2bce147f84f6fd95a95f1477929',
            ext: '.md',
          },
          {
            file: 'libs/platform/ui-courses/jest.config.js',
            hash: 'cb83e1dffe7e2b44a3f41b722f265208e9d5488c',
            ext: '.js',
          },
          {
            file: 'libs/platform/ui-courses/src/index.ts',
            hash: 'd9e89afaf1a65297f6e44196174a670947053f8f',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/ui-courses/src/lib/lesson/lesson.component.html',
            hash: '7a1eaab243d45f8b915c7a2a4d2c4150ced73b4f',
            ext: '.html',
          },
          {
            file:
              'libs/platform/ui-courses/src/lib/lesson/lesson.component.scss',
            hash: 'def2cb4b1ed9dc524129de2078e506095c7c10b4',
            ext: '.scss',
          },
          {
            file: 'libs/platform/ui-courses/src/lib/lesson/lesson.component.ts',
            hash: '9385feb371191ff7c733819f5f2aeff583af420d',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/ui-courses/src/lib/platform-ui-courses.module.ts',
            hash: '8d9e326324c526c02b4530ef18ff28b73ef41144',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/ui-courses/src/lib/restricted-lesson/restricted-lesson.component.html',
            hash: 'aaea7d83992e99d7594b45958625c54521296147',
            ext: '.html',
          },
          {
            file:
              'libs/platform/ui-courses/src/lib/restricted-lesson/restricted-lesson.component.scss',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.scss',
          },
          {
            file:
              'libs/platform/ui-courses/src/lib/restricted-lesson/restricted-lesson.component.ts',
            hash: 'fcdd7d1e2b28a391def0bb74e922a073b4a5516c',
            ext: '.ts',
          },
          {
            file: 'libs/platform/ui-courses/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/platform/ui-courses/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/platform/ui-courses/tsconfig.lib.json',
            hash: '5fe71c1750f5616f0f55e0c8018f072be911bfce',
            ext: '.json',
          },
          {
            file: 'libs/platform/ui-courses/tsconfig.spec.json',
            hash: '84bef1a7a5f0e53434f2225d3e1b12bc534631cf',
            ext: '.json',
          },
          {
            file: 'libs/platform/ui-courses/tslint.json',
            hash: 'bd2fd4770b068be9f74fbdd37935c7ff5d6e7957',
            ext: '.json',
          },
        ],
      },
    },
    'platform-ui-twitter': {
      name: 'platform-ui-twitter',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/platform/ui-twitter',
        sourceRoot: 'libs/platform/ui-twitter/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/ui-twitter/tsconfig.lib.json',
                'libs/platform/ui-twitter/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/platform/ui-twitter/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/platform/ui-twitter/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {},
        tags: [],
        files: [
          {
            file: 'libs/platform/ui-twitter/README.md',
            hash: '932d2ca9a89375f6799b8d1ccc876595dc1b0ab1',
            ext: '.md',
          },
          {
            file: 'libs/platform/ui-twitter/jest.config.js',
            hash: '8531433a683afbbc711bdc62ece3d8847c33ae45',
            ext: '.js',
          },
          {
            file: 'libs/platform/ui-twitter/src/index.ts',
            hash: 'ca76cbfe7f5e127ad4b623f8ff7e3fcc3fa71d8e',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/ui-twitter/src/lib/platform-ui-twitter.module.ts',
            hash: '88e3dfa3641e725b3a9e176e41277eba387655ea',
            ext: '.ts',
          },
          {
            file:
              'libs/platform/ui-twitter/src/lib/twitter-share-button/twitter-share-button.component.css',
            hash: '1cf00a1152220b33558b1e9050ee8a75c03479e8',
            ext: '.css',
          },
          {
            file:
              'libs/platform/ui-twitter/src/lib/twitter-share-button/twitter-share-button.component.html',
            hash: 'cfa2482bba263ee055f26f13c174cec5368d2c41',
            ext: '.html',
          },
          {
            file:
              'libs/platform/ui-twitter/src/lib/twitter-share-button/twitter-share-button.component.ts',
            hash: 'b968806f6fd6f52fc2be92994dc9c05ca3d190f9',
            ext: '.ts',
          },
          {
            file: 'libs/platform/ui-twitter/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/platform/ui-twitter/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/platform/ui-twitter/tsconfig.lib.json',
            hash: '2219a1c444f02556e126480884d5b3526202bfd8',
            ext: '.json',
          },
          {
            file: 'libs/platform/ui-twitter/tsconfig.spec.json',
            hash: 'db9cec019af0cdcd42f471c535a984c4c93ad630',
            ext: '.json',
          },
          {
            file: 'libs/platform/ui-twitter/tslint.json',
            hash: '73b97fa5da957ae1c3b7c1814eb288cec20e4d7e',
            ext: '.json',
          },
        ],
      },
    },
    'nrwlio-site-hubspot': {
      name: 'nrwlio-site-hubspot',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nrwlio-site/hubspot',
        sourceRoot: 'libs/nrwlio-site/hubspot/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nrwlio-site/hubspot/tsconfig.lib.json',
                'libs/nrwlio-site/hubspot/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/nrwlio-site/hubspot/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nrwlio-site/hubspot/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['nrwlio'],
        files: [
          {
            file: 'libs/nrwlio-site/hubspot/README.md',
            hash: '89c101f5d1a46a1e401b17cf632f1433204e42b8',
            ext: '.md',
          },
          {
            file: 'libs/nrwlio-site/hubspot/jest.config.js',
            hash: '7f4bc2cd56adf7f546f3fd9d414799a68ab0582d',
            ext: '.js',
          },
          {
            file: 'libs/nrwlio-site/hubspot/src/index.ts',
            hash: '31151d056128c83c9581c9cfe9c7f6b313770f70',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/hubspot/src/lib/hubspot-events.service.ts',
            hash: '235daa4f047ff027ba7d939b1a7a6e53ae263b4f',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/hubspot/src/lib/hubspot-forms.service.ts',
            hash: '37178f2f670ee35cf6789beafe646b28a0299192',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/hubspot/src/lib/hubspot.module.ts',
            hash: 'bc0a5751d9c437fc7cc04d5442a218cf2bf07686',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/hubspot/src/lib/hubspot.token.ts',
            hash: '1dcdd8fcf396eb8da80cbfb0bed87e1250c42cef',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/hubspot/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/hubspot/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/hubspot/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/hubspot/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/hubspot/tslint.json',
            hash: '5708d7147ddece6af5375119e6cc1a3a9032fb77',
            ext: '.json',
          },
        ],
      },
    },
    'shared-ui-markdown': {
      name: 'shared-ui-markdown',
      type: 'lib',
      data: {
        root: 'libs/shared/ui-markdown',
        sourceRoot: 'libs/shared/ui-markdown/src',
        projectType: 'library',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/shared/ui-markdown/tsconfig.lib.json',
                'libs/shared/ui-markdown/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/shared/ui-markdown/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/shared/ui-markdown/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {},
        tags: [],
        files: [
          {
            file: 'libs/shared/ui-markdown/README.md',
            hash: 'aff1ee3c8ad337f9721b1e32a147209d81157174',
            ext: '.md',
          },
          {
            file: 'libs/shared/ui-markdown/jest.config.js',
            hash: '50589aef6d3104576938840576b9917c0506921b',
            ext: '.js',
          },
          {
            file: 'libs/shared/ui-markdown/src/assets/prism.css',
            hash: '383bcbb9a8dd7ae9e46f829dd6b67527e1cce001',
            ext: '.css',
          },
          {
            file: 'libs/shared/ui-markdown/src/assets/prism.plugins.js',
            hash: '15f63b7dc88776f23ee502aaf23d66e4f381020a',
            ext: '.js',
          },
          {
            file: 'libs/shared/ui-markdown/src/index.ts',
            hash: '2e4829cfacbe2a3b37a78f80ba66724765ec297f',
            ext: '.ts',
          },
          {
            file:
              'libs/shared/ui-markdown/src/lib/markdown-renderer-override.service.ts',
            hash: '34808ba48ff70b29dd7aa0148e5a64c0c7270f50',
            ext: '.ts',
          },
          {
            file: 'libs/shared/ui-markdown/src/lib/markedRenderer.token.ts',
            hash: '4bf114353f3578fd104b165727c1fe0430c129af',
            ext: '.ts',
          },
          {
            file:
              'libs/shared/ui-markdown/src/lib/shared-ui-markdown.module.ts',
            hash: '0bb9265e7a5845e19df6e83abf4f25ee7572bd4b',
            ext: '.ts',
          },
          {
            file: 'libs/shared/ui-markdown/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/shared/ui-markdown/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/shared/ui-markdown/tsconfig.lib.json',
            hash: 'a3c34cd1764bf06429c9bb82e77b163e9e856cff',
            ext: '.json',
          },
          {
            file: 'libs/shared/ui-markdown/tsconfig.spec.json',
            hash: 'eab59a71a1821e17463c234a95f0c5a6cf3fec7b',
            ext: '.json',
          },
          {
            file: 'libs/shared/ui-markdown/tslint.json',
            hash: '9e6c1d1b0582f60745530f104d6a0168beb5cc35',
            ext: '.json',
          },
        ],
      },
    },
    'nrwlio-site-assets': {
      name: 'nrwlio-site-assets',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nrwlio-site/assets',
        sourceRoot: 'libs/nrwlio-site/assets/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nrwlio-site/assets/tsconfig.lib.json',
                'libs/nrwlio-site/assets/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/nrwlio-site/assets/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nrwlio-site/assets/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['nrwlio', 'type:ui'],
        files: [
          {
            file: 'libs/nrwlio-site/assets/README.md',
            hash: '3e0199c7a42f1d5796c113fb600f20b2b72ba2bf',
            ext: '.md',
          },
          {
            file: 'libs/nrwlio-site/assets/jest.config.js',
            hash: '3d7039b2a55b2dc3d2a4903ad150bb8bb747ce71',
            ext: '.js',
          },
          {
            file: 'libs/nrwlio-site/assets/src/index.ts',
            hash: '6b370cda8d17236972bee66345b8bde0d6d051b3',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/about-us/icon-community.svg',
            hash: 'e31f1c9a71cc76b942462cb552048d3c57a20593',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/about-us/icon-global.svg',
            hash: '22f0cabd7e1591d20276e38bf4f189ceacccf571',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/about-us/icon-inclusive.svg',
            hash: '38804cf5f5b5c069b5b6ad57528d383dfe592d7c',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/about-us/icon-leaders.svg',
            hash: 'b0e2df428f024919d0235383c83c256c63c5afda',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/about-us/icon-twitter.svg',
            hash: '36e7b6aa0e117303938256c4ab1cfcf6a9bdfdb4',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/assets.ts',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/black-arrow.svg',
            hash: 'f3d823ca7972fc129ac90645f8d0e3620a1f380e',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/careers/book.svg',
            hash: '6fce44022fd6ad8e0a9d83af5dfd6785b810ba56',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/careers/careers-glob.svg',
            hash: 'a4c0e219b6449ca867c89ae12b1fed953356dd29',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/careers/connect-live.svg',
            hash: 'debb1b446d20a0a84f4f6c24cfbb8909341d3883',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/careers/consulting.svg',
            hash: '19b7a3dd71ffc354055073a0aca5bf373e3be81c',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/careers/cookbook.svg',
            hash: '27281fa790892da9d523a5cd0c5140bcc8768cd6',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/careers/handshake.svg',
            hash: '675d09aabef473716242c2c1285a9a65b3b4fdef',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/careers/high-five.svg',
            hash: '4176c3f53a225517bf9f503af6f62083157f2a04',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/careers/icon-career.svg',
            hash: 'ec14273f18c3c12913fe583a049c448c02e26a91',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/careers/icon-expenses.svg',
            hash: '709553f536740d22c7fcb09f688c2b83b5842a67',
            ext: '.svg',
          },
          {
            file:
              'libs/nrwlio-site/assets/src/lib/careers/icon-flexibility.svg',
            hash: 'db18f59c24ca00053b13811447130596695ec44c',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/careers/icon-health.svg',
            hash: 'dffca86ce02f669a32ddffbbc9922ad4e013d2a8',
            ext: '.svg',
          },
          {
            file:
              'libs/nrwlio-site/assets/src/lib/careers/icon-open-source.svg',
            hash: '59829b480b112005a76b156abfaa3d93a6a12a06',
            ext: '.svg',
          },
          {
            file:
              'libs/nrwlio-site/assets/src/lib/careers/icon-remote-work.svg',
            hash: 'dd1c1b5d0212ec434d06b7427bcca7e8e5e683d1',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/careers/icon-salary.svg',
            hash: 'e99cc01a1fe99a81556945bbde95b068db865614',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/careers/icon-vacation.svg',
            hash: '10f09fac3a35f34f745e3ca1720588d791a87417',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/careers/mockup1.png',
            hash: '9e0877e1c2399bf891aba4ce40fc44d1d48e9221',
            ext: '.png',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/careers/mockup2.png',
            hash: 'ca8b57b7e58c806b6848b42cf35b8f596738788a',
            ext: '.png',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/careers/mockup3.png',
            hash: '00736157280dbbcc5bffe36e01f78210a938f445',
            ext: '.png',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/careers/mockup4.png',
            hash: '84c5955e2e0e103ca33b7c2079578ccca4a2aae4',
            ext: '.png',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/careers/nx-console.svg',
            hash: 'f14c845a79e990ca23dbf9637d3eda1022724fef',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/careers/open-source.png',
            hash: '88b07e408cdfb80ba8c99004e6f2e4c5e7dafa7a',
            ext: '.png',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/careers/technology.svg',
            hash: 'a780addfbbad69c88fc9b9ddabceaee815a7371f',
            ext: '.svg',
          },
          {
            file:
              'libs/nrwlio-site/assets/src/lib/careers/who-we-are-looking-for.png',
            hash: '910cc0b9b62a4058063bf48825facbebeb877140',
            ext: '.png',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/narwhal-default-avatar.svg',
            hash: 'e2cad43a8fcc21e5aeba7f539e505913c6870cc4',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/nrwl-logo-vertical.svg',
            hash: 'e5f157d91c7ad39d3c8358c900c175ba27ec09e7',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/nrwl-logo-white.svg',
            hash: 'b045710d8837433100e3337fcc6eca2c312ad03b',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/nrwl-logo.svg',
            hash: '6cc026727fffc2a2bba626fbd16ef4d4f67b4133',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/nrwl-nx-blue.svg',
            hash: '944ad4aeca3e862ef657dfd0e999cddc37ef64bc',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/nrwl-nx-white.svg',
            hash: 'abea3ea0c2bbe658f9e76a899879261f8a7abcd0',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/nrwl-share.jpg',
            hash: 'fb708717f7776a828e8d2aadbc2ade08bb2e6eae',
            ext: '.jpg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/services/edit-item-list.svg',
            hash: '96e0aa489876df36c8cd7e8660d99968df40e23e',
            ext: '.svg',
          },
          {
            file:
              'libs/nrwlio-site/assets/src/lib/services/hero-service-asset-temp.svg',
            hash: 'c7f446f78f5e92b99ced6cde173a301cf2dcdec0',
            ext: '.svg',
          },
          {
            file:
              'libs/nrwlio-site/assets/src/lib/services/item-angularjs-upgrade.svg',
            hash: 'cb96d2b2f73600b49f21e7a2ef710d73ec0ae87c',
            ext: '.svg',
          },
          {
            file:
              'libs/nrwlio-site/assets/src/lib/services/item-app-performance.svg',
            hash: 'cd0684ff6ed72015d345548b254531a80a54a03f',
            ext: '.svg',
          },
          {
            file:
              'libs/nrwlio-site/assets/src/lib/services/item-bazelification.svg',
            hash: '589746a73ba11d5f9772b8d02f7dd81ca650ef82',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/services/item-devops.svg',
            hash: '2997aec63bfc971c0084630c3b448d8dd1a1505b',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/services/item-monorepo.svg',
            hash: '1d9ca7cf63e26b79d3257f39e2bb240ba98a0bf8',
            ext: '.svg',
          },
          {
            file:
              'libs/nrwlio-site/assets/src/lib/services/item-nxification.svg',
            hash: 'a61437a75f50efe011c74c9e3a3fc333aa28895c',
            ext: '.svg',
          },
          {
            file:
              'libs/nrwlio-site/assets/src/lib/services/item-platform-development.svg',
            hash: '03e85f49bbc9ebed207b3dc2c1f105d7890c8cc4',
            ext: '.svg',
          },
          {
            file:
              'libs/nrwlio-site/assets/src/lib/services/item-react-nxification.svg',
            hash: '2a9a497d0b1969987af966c38fdfff7a86ea693e',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/services/jeff.svg',
            hash: 'd92a5ba20a86335bcb805376f0d44fc49d9718c6',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/services/select-item.svg',
            hash: 'f3fda733c467c9dd4b1c7409b89513abc79c69ec',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/services/send.svg',
            hash: 'd8a073c4322fd75792a9386fec49ef996d35673e',
            ext: '.svg',
          },
          {
            file:
              'libs/nrwlio-site/assets/src/lib/services/services-model-plan.svg',
            hash: 'a90df330bc1cfe66ef4ebba6fa2fc8b9ef4eb19d',
            ext: '.svg',
          },
          {
            file:
              'libs/nrwlio-site/assets/src/lib/services/services-model-train.svg',
            hash: '1195ce4abb465247bc4fc6ee9d811079988f0546',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/social-github.jpg',
            hash: 'f1e54f6fd7c3670fcf30e8ea3c7459680c299552',
            ext: '.jpg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/social-linkedin.jpg',
            hash: '018e4d6d9dab460ffbf0a41b7ae0e2371e8d7c48',
            ext: '.jpg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/social-twitter.jpg',
            hash: '1d8ea6608c2a8eeaa4ff0477e126b5c3a6aea589',
            ext: '.jpg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/style-guide/square1.svg',
            hash: 'ba383537b5ff2750c1ba78c295417c7fc4d9a5cb',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/team-bullet-blog.jpg',
            hash: '3537f0c2e6483f4f2c0953f9027176f70cba3d27',
            ext: '.jpg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/team-bullet-github.jpg',
            hash: '6a516d6ab65fc686d577bc743592ec643aae85a0',
            ext: '.jpg',
          },
          {
            file:
              'libs/nrwlio-site/assets/src/lib/team-bullet-presentations.jpg',
            hash: '5af69ae27dc8b6496ce623a96675944c82c1ab10',
            ext: '.jpg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/waves/wave00.svg',
            hash: '49669d208d74fd7c310dd65b37f72295d70e6510',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/lib/waves/wave01.svg',
            hash: 'b5e90e01d35e93a5584942a6d53286221d855207',
            ext: '.svg',
          },
          {
            file: 'libs/nrwlio-site/assets/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/assets/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/assets/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/assets/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/assets/tslint.json',
            hash: '5708d7147ddece6af5375119e6cc1a3a9032fb77',
            ext: '.json',
          },
        ],
      },
    },
    'nx-cloud-ui-styles': {
      name: 'nx-cloud-ui-styles',
      type: 'lib',
      data: {
        root: 'libs/nx-cloud/ui/styles',
        sourceRoot: 'libs/nx-cloud/ui/styles/src',
        projectType: 'library',
        schematics: {},
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-cloud/ui/styles/tsconfig.lib.json',
                'libs/nx-cloud/ui/styles/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/nx-cloud/ui/styles/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nx-cloud/ui/styles/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/nx-cloud/ui/styles/README.md',
            hash: '00383dab9dc13a11ea049a9763b69be3dfc3ddf7',
            ext: '.md',
          },
          {
            file: 'libs/nx-cloud/ui/styles/jest.config.js',
            hash: '71150f2dfffdd1c1505adac7bda28726ec57ba5f',
            ext: '.js',
          },
          {
            file: 'libs/nx-cloud/ui/styles/src/index.ts',
            hash: '5c39aa2046edbffa5d78351b6a504177bd5b2a7b',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/ui/styles/src/lib/material.scss',
            hash: '817a4c270ddadbdd3057e003d3e418e667660b6d',
            ext: '.scss',
          },
          {
            file: 'libs/nx-cloud/ui/styles/src/lib/nx-cloud-ui-styles.ts',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/ui/styles/tsconfig.json',
            hash: 'd32f55e3999447ae24e89f0e76d8c3128113c85e',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/ui/styles/tsconfig.lib.json',
            hash: 'a174cb09c30e46285517c7308247d602414aa63f',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/ui/styles/tsconfig.spec.json',
            hash: 'd38f29ed71dc44f512e29dbc921ffb582729b444',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/ui/styles/tslint.json',
            hash: 'e9dbc536a63a9e6d4016cdc5338b008778a77290',
            ext: '.json',
          },
        ],
      },
    },
    'nx-cloud-ui-header': {
      name: 'nx-cloud-ui-header',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nx-cloud/ui/header',
        sourceRoot: 'libs/nx-cloud/ui/header/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-cloud/ui/header/tsconfig.lib.json',
                'libs/nx-cloud/ui/header/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/nx-cloud/ui/header/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nx-cloud/ui/header/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/nx-cloud/ui/header/README.md',
            hash: '005c1e49e4dc0dd53a91c0a7f708b98a79068f39',
            ext: '.md',
          },
          {
            file: 'libs/nx-cloud/ui/header/jest.config.js',
            hash: 'de221ecc36b4c58996a460cd8f62fa2fa9315e89',
            ext: '.js',
          },
          {
            file: 'libs/nx-cloud/ui/header/src/index.ts',
            hash: '45cff81d5a735424887bf646866c6da99faab116',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/ui/header/src/lib/header/header.component.html',
            hash: '0dac6bf3d7855d6d74bb75196cf6924f464a1474',
            ext: '.html',
          },
          {
            file:
              'libs/nx-cloud/ui/header/src/lib/header/header.component.scss',
            hash: 'cb715c154420a8b6ec0a1d0607de0a5b0b9d6f1c',
            ext: '.scss',
          },
          {
            file: 'libs/nx-cloud/ui/header/src/lib/header/header.component.ts',
            hash: '8ddd95cbf44621d3d1267b18026ed7de105e5b9d',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/ui/header/src/lib/nx-cloud-ui-header.module.ts',
            hash: '4e30b9b2e9b2f8a851fab6497962f7c541058183',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/ui/header/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/ui/header/tsconfig.json',
            hash: 'd32f55e3999447ae24e89f0e76d8c3128113c85e',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/ui/header/tsconfig.lib.json',
            hash: 'ad83824e5f62f1e5ff2acd0960bde6bab3f87d66',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/ui/header/tsconfig.spec.json',
            hash: 'aed68bc6bf86609a7a4f0fdf5a562265cd90e452',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/ui/header/tslint.json',
            hash: 'd34baf1d9e3a7717b435f5afbe93cc3590f2ff78',
            ext: '.json',
          },
        ],
      },
    },
    'nx-cloud-ui-footer': {
      name: 'nx-cloud-ui-footer',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nx-cloud/ui/footer',
        sourceRoot: 'libs/nx-cloud/ui/footer/src',
        prefix: 'nx-cloud',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-cloud/ui/footer/tsconfig.lib.json',
                'libs/nx-cloud/ui/footer/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/nx-cloud/ui/footer/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nx-cloud/ui/footer/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/nx-cloud/ui/footer/README.md',
            hash: '177a8561cccf0be8b1cd90fffc9baed862f614cf',
            ext: '.md',
          },
          {
            file: 'libs/nx-cloud/ui/footer/jest.config.js',
            hash: 'da34903cdf7863d7309f27b223c558bfcb28e749',
            ext: '.js',
          },
          {
            file: 'libs/nx-cloud/ui/footer/src/index.ts',
            hash: '07e18cdf5ee1dca37fbda37c2f5627ef89fdd40d',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/ui/footer/src/lib/footer.module.ts',
            hash: '6c41b63c5bcdd7ec4a3ffdd09926bb1002ed350f',
            ext: '.ts',
          },
          {
            file:
              'libs/nx-cloud/ui/footer/src/lib/footer/footer.component.html',
            hash: 'a479cc3a2462e0ad284058c843092f9e96aa0278',
            ext: '.html',
          },
          {
            file: 'libs/nx-cloud/ui/footer/src/lib/footer/footer.component.ts',
            hash: '730c6cec32eee6675ec0ec932bf6d383fa737269',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/ui/footer/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/ui/footer/tsconfig.json',
            hash: 'd32f55e3999447ae24e89f0e76d8c3128113c85e',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/ui/footer/tsconfig.lib.json',
            hash: 'ad83824e5f62f1e5ff2acd0960bde6bab3f87d66',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/ui/footer/tsconfig.spec.json',
            hash: 'aed68bc6bf86609a7a4f0fdf5a562265cd90e452',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/ui/footer/tslint.json',
            hash: 'd34baf1d9e3a7717b435f5afbe93cc3590f2ff78',
            ext: '.json',
          },
        ],
      },
    },
    'nx-cloud-ui-alerts': {
      name: 'nx-cloud-ui-alerts',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nx-cloud/ui/alerts',
        sourceRoot: 'libs/nx-cloud/ui/alerts/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-cloud/ui/alerts/tsconfig.lib.json',
                'libs/nx-cloud/ui/alerts/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/nx-cloud/ui/alerts/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nx-cloud/ui/alerts/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/nx-cloud/ui/alerts/README.md',
            hash: '80e107d920dc41c61c3cf0c20e891ea56af40ef1',
            ext: '.md',
          },
          {
            file: 'libs/nx-cloud/ui/alerts/jest.config.js',
            hash: 'cc7526849e82d0a49cf0e71921336549dc27886d',
            ext: '.js',
          },
          {
            file: 'libs/nx-cloud/ui/alerts/src/index.ts',
            hash: '27f6f44cf4bf07b6bd0ede3502f3344f1d207484',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/ui/alerts/src/lib/alert/alert.component.html',
            hash: '7ab1183e8dd55d83176e382d3869fa52344ee3e5',
            ext: '.html',
          },
          {
            file: 'libs/nx-cloud/ui/alerts/src/lib/alert/alert.component.scss',
            hash: 'f93622e49663d17653a6d718d7713391b13000e5',
            ext: '.scss',
          },
          {
            file: 'libs/nx-cloud/ui/alerts/src/lib/alert/alert.component.ts',
            hash: '0f630c3a84cd6ffb445bad697192f1634d7a9981',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/ui/alerts/src/lib/alerts.module.ts',
            hash: '89ef365ecdfa0038eb7222ba10f037407456aed1',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/ui/alerts/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/ui/alerts/tsconfig.json',
            hash: 'd32f55e3999447ae24e89f0e76d8c3128113c85e',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/ui/alerts/tsconfig.lib.json',
            hash: 'ad83824e5f62f1e5ff2acd0960bde6bab3f87d66',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/ui/alerts/tsconfig.spec.json',
            hash: 'aed68bc6bf86609a7a4f0fdf5a562265cd90e452',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/ui/alerts/tslint.json',
            hash: 'c67b6e765c02e516176e7b045cd3d99253deb694',
            ext: '.json',
          },
        ],
      },
    },
    'nrwl-api-reporting': {
      name: 'nrwl-api-reporting',
      type: 'lib',
      data: {
        root: 'libs/nrwl-api/reporting',
        sourceRoot: 'libs/nrwl-api/reporting/src',
        projectType: 'library',
        schematics: {},
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nrwl-api/reporting/tsconfig.lib.json',
                'libs/nrwl-api/reporting/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/nrwl-api/reporting/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nrwl-api/reporting/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/nrwl-api/reporting/README.md',
            hash: '3ca8634e1c6c0347c88e12a769e15f3ee1e67339',
            ext: '.md',
          },
          {
            file: 'libs/nrwl-api/reporting/jest.config.js',
            hash: 'd7c42625e6b40284f643984f65c55668ad9fc0b3',
            ext: '.js',
          },
          {
            file: 'libs/nrwl-api/reporting/src/index.ts',
            hash: '32e088f59b1ed33f67ec78c431db5f50de14d067',
            ext: '.ts',
          },
          {
            file: 'libs/nrwl-api/reporting/src/lib/active-users.ts',
            hash: '6131d464cf9729c6800023830bef5aefa1619710',
            ext: '.ts',
          },
          {
            file: 'libs/nrwl-api/reporting/src/lib/download-cloud-stats.ts',
            hash: 'fb1a6a158d2088f73b38a31c60e5d8fad4ac131a',
            ext: '.ts',
          },
          {
            file: 'libs/nrwl-api/reporting/src/lib/google-sheets.ts',
            hash: '68a55febcec93e7d3398fbe229bedd52818ce857',
            ext: '.ts',
          },
          {
            file: 'libs/nrwl-api/reporting/src/lib/npm-downloads.ts',
            hash: 'b84b9abfdc4e880bab8e2f5a02993fc8938c640b',
            ext: '.ts',
          },
          {
            file: 'libs/nrwl-api/reporting/src/lib/publish-cloud-stats.ts',
            hash: 'a7f09a53822cab2eb04d70365eb251f71bda49c8',
            ext: '.ts',
          },
          {
            file: 'libs/nrwl-api/reporting/src/lib/publish-npm-stats.ts',
            hash: '85960e6f2eafbc72cca0d051d2a88764542ee82d',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwl-api/reporting/src/lib/time-saved-email/hubspot-utils.ts',
            hash: '099e804823be8da00b1557ff4b2e05e4865ffe06',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwl-api/reporting/src/lib/time-saved-email/mongo-queries.ts',
            hash: '56895f6ec54e67f744d769a23ac68a25650174a0',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwl-api/reporting/src/lib/time-saved-email/monthly-time-saved.ts',
            hash: '7a5c0d7f2e5f797e0ed0e3cf5620a522dc5862b0',
            ext: '.ts',
          },
          {
            file:
              'libs/nrwl-api/reporting/src/lib/time-saved-email/run-immediately.ts',
            hash: '8e2a9d9c5dddc34468c9ca9890085649b078c1f0',
            ext: '.ts',
          },
          {
            file: 'libs/nrwl-api/reporting/src/lib/updated-cloud-stats.ts',
            hash: 'c38039af96e8792d9a451e47d9f539dff96db8bf',
            ext: '.ts',
          },
          {
            file: 'libs/nrwl-api/reporting/tsconfig.json',
            hash: '178208334c274c285b3e603076006864f350bed2',
            ext: '.json',
          },
          {
            file: 'libs/nrwl-api/reporting/tsconfig.lib.json',
            hash: '0fe9966358eb51092a1668ecb0795b6db52a538b',
            ext: '.json',
          },
          {
            file: 'libs/nrwl-api/reporting/tsconfig.scripts.json',
            hash: '95f6210d0500f735802f904b2f9e8e699a3cf0f7',
            ext: '.json',
          },
          {
            file: 'libs/nrwl-api/reporting/tsconfig.spec.json',
            hash: '4dc880ff63ba87e658f9948d0f04608f6c871f71',
            ext: '.json',
          },
          {
            file: 'libs/nrwl-api/reporting/tslint.json',
            hash: '2cdd2989d80fc797c1be816ca20227fb7a5ce457',
            ext: '.json',
          },
        ],
      },
    },
    'private-nx-cloud': {
      name: 'private-nx-cloud',
      type: 'app',
      data: {
        root: 'apps/private-nx-cloud/',
        projectType: 'application',
        architect: {},
        tags: [],
        files: [
          {
            file: 'apps/private-nx-cloud/Dockerfile',
            hash: 'b09f2b13232833143971e0694dc843dc1d4fc470',
            ext: '',
          },
          {
            file: 'apps/private-nx-cloud/README.md',
            hash: 'e6910aa857994dc520adbe117f66cceddc704502',
            ext: '.md',
          },
          {
            file: 'apps/private-nx-cloud/aggregate.sh',
            hash: '9ae1d2af56a967689035e0882a02d1e4eb38a757',
            ext: '.sh',
          },
          {
            file: 'apps/private-nx-cloud/how-to-set-up.md',
            hash: 'f14332389f17e02fe0ace37fd1cbb0e7a249ed0a',
            ext: '.md',
          },
          {
            file: 'apps/private-nx-cloud/init.sh',
            hash: 'c8dc6d8c426446042225cf36dc9d5761b59364f9',
            ext: '.sh',
          },
          {
            file: 'apps/private-nx-cloud/specs/test-private-nx-cloud.ts',
            hash: '9112de4825733ababab2102718a8e685e1586f78',
            ext: '.ts',
          },
          {
            file: 'apps/private-nx-cloud/supervisord.conf',
            hash: '91658cc80704cb004afc4ee663f82d9b6478f5bc',
            ext: '.conf',
          },
          {
            file: 'apps/private-nx-cloud/tsconfig.json',
            hash: '8db0c24eb9096362dacaa10f53c95c2b23383d67',
            ext: '.json',
          },
        ],
      },
    },
    'ui-floating-items': {
      name: 'ui-floating-items',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/ui/floating-items',
        sourceRoot: 'libs/ui/floating-items/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/ui/floating-items/tsconfig.lib.json',
                'libs/ui/floating-items/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/ui/floating-items/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/ui/floating-items/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['nrwlio', 'type:ui'],
        files: [
          {
            file: 'libs/ui/floating-items/README.md',
            hash: '099d9e780e2d59c31287e8c7dfcab67b10a9cbb6',
            ext: '.md',
          },
          {
            file: 'libs/ui/floating-items/jest.config.js',
            hash: 'e90da1ee02782e199e598384e721f271ab0cc64f',
            ext: '.js',
          },
          {
            file: 'libs/ui/floating-items/src/index.ts',
            hash: '989356f313f304df20f56377393a9e4aa26a2c70',
            ext: '.ts',
          },
          {
            file:
              'libs/ui/floating-items/src/lib/floating-item/floating-item.component.html',
            hash: '8e20b212afa202d9646033a1d542cb5387f92c8f',
            ext: '.html',
          },
          {
            file:
              'libs/ui/floating-items/src/lib/floating-item/floating-item.component.scss',
            hash: 'ab26114aabfa53c6825d715366ecb3de657109d4',
            ext: '.scss',
          },
          {
            file:
              'libs/ui/floating-items/src/lib/floating-item/floating-item.component.ts',
            hash: 'b422c7e30ecb15501aaf23a80bc3af9264fc1ba3',
            ext: '.ts',
          },
          {
            file: 'libs/ui/floating-items/src/lib/ui-floating-items.module.ts',
            hash: 'da4747d59e8f144f533374ace1b8869c356f6b21',
            ext: '.ts',
          },
          {
            file: 'libs/ui/floating-items/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/ui/floating-items/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/ui/floating-items/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/ui/floating-items/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/ui/floating-items/tslint.json',
            hash: '5708d7147ddece6af5375119e6cc1a3a9032fb77',
            ext: '.json',
          },
        ],
      },
    },
    'design-system-e2e': {
      name: 'design-system-e2e',
      type: 'e2e',
      data: {
        root: 'apps/design-system-e2e',
        sourceRoot: 'apps/design-system-e2e/src',
        projectType: 'application',
        architect: {
          e2e: {
            builder: '@nrwl/cypress:cypress',
            options: {
              cypressConfig: 'apps/design-system-e2e/cypress.json',
              tsConfig: 'apps/design-system-e2e/tsconfig.e2e.json',
              devServerTarget: 'design-system:serve',
            },
            configurations: {
              production: {
                devServerTarget: 'design-system:serve:production',
              },
            },
          },
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: ['apps/design-system-e2e/tsconfig.e2e.json'],
              exclude: ['**/node_modules/**', '!apps/design-system-e2e/**/*'],
            },
          },
        },
        tags: ['scope:design-system', 'type:ui'],
        files: [
          {
            file: 'apps/design-system-e2e/cypress.json',
            hash: 'e702db1d0d7cbc9635243f8f375e0ed4b452c5e5',
            ext: '.json',
          },
          {
            file: 'apps/design-system-e2e/src/fixtures/example.json',
            hash: '294cbed6ce9e0b948b787452e8676aee486cb3be',
            ext: '.json',
          },
          {
            file: 'apps/design-system-e2e/src/integration/app.spec.ts',
            hash: '16491af5484eac60d0110620e34dcf56bdf1c9c8',
            ext: '.ts',
          },
          {
            file: 'apps/design-system-e2e/src/plugins/index.js',
            hash: '9067e75a258dadf5a02b2a91c64f5acee1af17fd',
            ext: '.js',
          },
          {
            file: 'apps/design-system-e2e/src/support/app.po.ts',
            hash: '32934246969c2ecb827ac05677785933a707a54d',
            ext: '.ts',
          },
          {
            file: 'apps/design-system-e2e/src/support/commands.ts',
            hash: '61b3a3e35770234a5aa9e31b07870b9292ec52ba',
            ext: '.ts',
          },
          {
            file: 'apps/design-system-e2e/src/support/index.ts',
            hash: '3d469a6b6cf31eb66117d73e278bcf74f398f1db',
            ext: '.ts',
          },
          {
            file: 'apps/design-system-e2e/tsconfig.e2e.json',
            hash: '824748ba21cd17152842106f36df2fc1da3f5253',
            ext: '.json',
          },
          {
            file: 'apps/design-system-e2e/tsconfig.json',
            hash: 'fa46a2aec4fb94d5cc37d2425cc08da8fb27cb2c',
            ext: '.json',
          },
          {
            file: 'apps/design-system-e2e/tslint.json',
            hash: '905c5d5e0adc870dfe21afa692cfa2fcdadf8ced',
            ext: '.json',
          },
        ],
      },
    },
    'nx-docs-site-e2e': {
      name: 'nx-docs-site-e2e',
      type: 'e2e',
      data: {
        root: 'apps/nx-docs-site-e2e',
        projectType: 'application',
        prefix: '',
        architect: {
          e2e: {
            outputs: ['/dist/out-tsc/apps/nx-docs-site-e2e'],
            builder: '@nrwl/cypress:cypress',
            options: {
              cypressConfig: 'apps/nx-docs-site-e2e/cypress.json',
              tsConfig: 'apps/nx-docs-site-e2e/tsconfig.e2e.json',
              devServerTarget: 'nx-docs-site:serve',
            },
            configurations: {
              production: {
                devServerTarget: 'nx-docs-site:serve:production',
              },
            },
          },
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: 'apps/nx-docs-site-e2e/tsconfig.e2e.json',
              exclude: ['**/node_modules/**', '!apps/nx-docs-site-e2e/**/*'],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'apps/nx-docs-site-e2e/cypress.json',
            hash: '88d42685e7336af79d1c4b4bafdb14e1094da024',
            ext: '.json',
          },
          {
            file: 'apps/nx-docs-site-e2e/src/fixtures/example.json',
            hash: '294cbed6ce9e0b948b787452e8676aee486cb3be',
            ext: '.json',
          },
          {
            file: 'apps/nx-docs-site-e2e/src/integration/app.spec.ts',
            hash: 'afaa2c67e2637bcdf11855d447784863725ec5db',
            ext: '.ts',
          },
          {
            file: 'apps/nx-docs-site-e2e/src/plugins/index.ts',
            hash: '2ea2994b794b4f8c064ed8d4c69b7fbc85c80a91',
            ext: '.ts',
          },
          {
            file: 'apps/nx-docs-site-e2e/src/support/app.po.ts',
            hash: 'abcdbbb05ad031319ddb341308b0b35ca2f65a53',
            ext: '.ts',
          },
          {
            file: 'apps/nx-docs-site-e2e/src/support/commands.ts',
            hash: 'cf62f9b907fb51752dc4c9842025f466d60af4a8',
            ext: '.ts',
          },
          {
            file: 'apps/nx-docs-site-e2e/src/support/index.ts',
            hash: '3d469a6b6cf31eb66117d73e278bcf74f398f1db',
            ext: '.ts',
          },
          {
            file: 'apps/nx-docs-site-e2e/tsconfig.e2e.json',
            hash: '144d0a60fb2da3047fde573c8ac37691ae8e3bf3',
            ext: '.json',
          },
          {
            file: 'apps/nx-docs-site-e2e/tsconfig.json',
            hash: '296139b687d8852e439ef279a04539404768aa78',
            ext: '.json',
          },
        ],
      },
    },
    'ui-article-media': {
      name: 'ui-article-media',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/ui/article-media',
        sourceRoot: 'libs/ui/article-media/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/ui/article-media/tsconfig.lib.json',
                'libs/ui/article-media/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/ui/article-media/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/ui/article-media/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/ui/article-media/README.md',
            hash: '276e785511bcc20ddd3b4577735ec39186421e41',
            ext: '.md',
          },
          {
            file: 'libs/ui/article-media/jest.config.js',
            hash: '3e0cf6ddf098ec07293781aab02c9802b1b8eca2',
            ext: '.js',
          },
          {
            file: 'libs/ui/article-media/src/index.ts',
            hash: '1dda328fac457927b231a17350028febff6ea38d',
            ext: '.ts',
          },
          {
            file:
              'libs/ui/article-media/src/lib/article-media/article-media.component.html',
            hash: '25b2a56ff055b688123a0c2bab415e329abe932a',
            ext: '.html',
          },
          {
            file:
              'libs/ui/article-media/src/lib/article-media/article-media.component.scss',
            hash: 'cf91f5de1df01f0c7b4881479fb3e48e0913fc05',
            ext: '.scss',
          },
          {
            file:
              'libs/ui/article-media/src/lib/article-media/article-media.component.ts',
            hash: '1c0ea39e375c55ec9ed677fb539cb5b753420b9d',
            ext: '.ts',
          },
          {
            file:
              'libs/ui/article-media/src/lib/ui-article-media.module.spec.ts',
            hash: '0f512557b9cf6c06ee67205022ec9def7c0ab6d6',
            ext: '.ts',
          },
          {
            file: 'libs/ui/article-media/src/lib/ui-article-media.module.ts',
            hash: '0a9940e6c1baa95dd8ba6501e05fc1fe5c634d2c',
            ext: '.ts',
          },
          {
            file: 'libs/ui/article-media/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/ui/article-media/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/ui/article-media/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/ui/article-media/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/ui/article-media/tslint.json',
            hash: '5ad9ba82222ce3bd10c035b49adc62c50f8a2ef8',
            ext: '.json',
          },
        ],
      },
    },
    'common-platform': {
      name: 'common-platform',
      type: 'lib',
      data: {
        root: 'libs/common-platform',
        sourceRoot: 'libs/common-platform/src',
        projectType: 'library',
        prefix: 'cpf',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/common-platform/tsconfig.lib.json',
                'libs/common-platform/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/common-platform/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/common-platform/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/schematics:component': {
            styleext: 'scss',
          },
        },
        tags: ['common:platform'],
        files: [
          {
            file: 'libs/common-platform/jest.config.js',
            hash: '11f3e623da873ed2a45f847c9c864a081998df60',
            ext: '.js',
          },
          {
            file: 'libs/common-platform/src/index.ts',
            hash: 'a6c0b95ac3b748ddc489910ff5d773688f4efa17',
            ext: '.ts',
          },
          {
            file: 'libs/common-platform/src/lib/base-url-token.ts',
            hash: '161cf091fc582fdcdaaeb5ae21f77c4fb2dc2e04',
            ext: '.ts',
          },
          {
            file: 'libs/common-platform/src/lib/common-platform.module.ts',
            hash: '4148acae3a57a72443b93be2086ec476dd27d1ed',
            ext: '.ts',
          },
          {
            file: 'libs/common-platform/src/lib/is-node-token.ts',
            hash: '0f8b447660736639cbbc101161287c2060ca74ca',
            ext: '.ts',
          },
          {
            file: 'libs/common-platform/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/common-platform/tsconfig.json',
            hash: '58bd2c97a66f5e5ea5d05c8a5709ee79bad02094',
            ext: '.json',
          },
          {
            file: 'libs/common-platform/tsconfig.lib.json',
            hash: 'd921b9c503b9b9813029adfe2da9b559582696f8',
            ext: '.json',
          },
          {
            file: 'libs/common-platform/tsconfig.spec.json',
            hash: '5efa96d40fafbebd463293227f98870e28a42e34',
            ext: '.json',
          },
          {
            file: 'libs/common-platform/tslint.json',
            hash: 'cd7d2279be15fe82f6e6cfe64f1491bbb68c0c1d',
            ext: '.json',
          },
        ],
      },
    },
    'nrwlio-site-pwa': {
      name: 'nrwlio-site-pwa',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nrwlio-site/pwa',
        sourceRoot: 'libs/nrwlio-site/pwa/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nrwlio-site/pwa/tsconfig.lib.json',
                'libs/nrwlio-site/pwa/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/nrwlio-site/pwa/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nrwlio-site/pwa/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['nrwlio'],
        files: [
          {
            file: 'libs/nrwlio-site/pwa/README.md',
            hash: 'cef4b03a601fc2a58f7adcdd292dbdc2c7475354',
            ext: '.md',
          },
          {
            file: 'libs/nrwlio-site/pwa/jest.config.js',
            hash: 'c2c80bd2fcc587b5c54aca8271a8b218ab1d66d5',
            ext: '.js',
          },
          {
            file: 'libs/nrwlio-site/pwa/src/index.ts',
            hash: '547c770b73c55e3a1da1544131bfa0c5b9917185',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/pwa/src/lib/app-version.service.ts',
            hash: 'ae29a44224bbe5bea73e8bf497cd02da7b31c60f',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/pwa/src/lib/pwa.module.ts',
            hash: 'c5cd75f9611377f41eb27c192e6ef0d89998835c',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/pwa/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nrwlio-site/pwa/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/pwa/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/pwa/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/nrwlio-site/pwa/tslint.json',
            hash: '5708d7147ddece6af5375119e6cc1a3a9032fb77',
            ext: '.json',
          },
        ],
      },
    },
    'ui-testimonials': {
      name: 'ui-testimonials',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/ui/testimonials',
        sourceRoot: 'libs/ui/testimonials/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/ui/testimonials/tsconfig.lib.json',
                'libs/ui/testimonials/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/ui/testimonials/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/ui/testimonials/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['ui'],
        files: [
          {
            file: 'libs/ui/testimonials/README.md',
            hash: '59316fb0fceeb9c1b6b2996dbd83d5c08bd49f0c',
            ext: '.md',
          },
          {
            file: 'libs/ui/testimonials/jest.config.js',
            hash: '82492ebfed4476f4242e3391c0b4d05ab288743d',
            ext: '.js',
          },
          {
            file: 'libs/ui/testimonials/src/index.ts',
            hash: 'b40f23af3488d504132bf28130c3c946ffe3a086',
            ext: '.ts',
          },
          {
            file:
              'libs/ui/testimonials/src/lib/testimonial-card/testimonial-card.component.scss',
            hash: 'fd83ca271730309058d78067a973e263278d017b',
            ext: '.scss',
          },
          {
            file:
              'libs/ui/testimonials/src/lib/testimonial-card/testimonial-card.component.ts',
            hash: '25d1676ab90ac87f13806c802390b24b5f974b11',
            ext: '.ts',
          },
          {
            file:
              'libs/ui/testimonials/src/lib/testimonial-primary/testimonial-primary.component.scss',
            hash: '35f36a6681d9f0896d28157ff835a59c45dc92a5',
            ext: '.scss',
          },
          {
            file:
              'libs/ui/testimonials/src/lib/testimonial-primary/testimonial-primary.component.ts',
            hash: 'a11880416a68799997100c38e584f7000a423244',
            ext: '.ts',
          },
          {
            file: 'libs/ui/testimonials/src/lib/ui-testimonials.module.ts',
            hash: '55d37ea74db611673e9cfb525e51ba1d1beeecfa',
            ext: '.ts',
          },
          {
            file: 'libs/ui/testimonials/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/ui/testimonials/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/ui/testimonials/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/ui/testimonials/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/ui/testimonials/tslint.json',
            hash: '5ad9ba82222ce3bd10c035b49adc62c50f8a2ef8',
            ext: '.json',
          },
        ],
      },
    },
    'nx-cloud-assets': {
      name: 'nx-cloud-assets',
      type: 'lib',
      data: {
        root: 'libs/nx-cloud/assets',
        sourceRoot: 'libs/nx-cloud/assets/src',
        projectType: 'library',
        schematics: {},
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-cloud/assets/tsconfig.lib.json',
                'libs/nx-cloud/assets/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/nx-cloud/assets/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nx-cloud/assets/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'libs/nx-cloud/assets/README.md',
            hash: '266810d1d45c4fea1012bf82b2ff82a316c29df1',
            ext: '.md',
          },
          {
            file: 'libs/nx-cloud/assets/jest.config.js',
            hash: '6dafecd78b4a344bbcab5be6a84d1aea072ac499',
            ext: '.js',
          },
          {
            file: 'libs/nx-cloud/assets/src/index.ts',
            hash: 'ebf36e79f44185293f6743244f7d9cb53ea9d35a',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/assets/src/lib/angular-cli-faster-card.png',
            hash: '76989c393eed3d329c29c857e4c5f3e3ae9b8482',
            ext: '.png',
          },
          {
            file: 'libs/nx-cloud/assets/src/lib/black-arrow.svg',
            hash: 'f3d823ca7972fc129ac90645f8d0e3620a1f380e',
            ext: '.svg',
          },
          {
            file:
              'libs/nx-cloud/assets/src/lib/favicon/android-chrome-192x192.png',
            hash: 'd5b79b6088e7336bba692486386ddbf45999d42c',
            ext: '.png',
          },
          {
            file:
              'libs/nx-cloud/assets/src/lib/favicon/android-chrome-512x512.png',
            hash: 'f7b9a923bf1c298c68ee484a3abd502e136d573c',
            ext: '.png',
          },
          {
            file: 'libs/nx-cloud/assets/src/lib/favicon/apple-touch-icon.png',
            hash: '3a2ea7e83b92dbf50d51463410b35cc6e64d9944',
            ext: '.png',
          },
          {
            file: 'libs/nx-cloud/assets/src/lib/favicon/favicon-16x16.png',
            hash: 'ed502d0dd2b2299999ce1a51795935109d5f7679',
            ext: '.png',
          },
          {
            file: 'libs/nx-cloud/assets/src/lib/favicon/favicon-32x32.png',
            hash: '27a6e688ac331103ec3902f3bcfcbbc585dfb544',
            ext: '.png',
          },
          {
            file: 'libs/nx-cloud/assets/src/lib/favicon/favicon.ico',
            hash: '33b4ee41f9357cb910ae3bc7c50d5482ddb0b0fd',
            ext: '.ico',
          },
          {
            file: 'libs/nx-cloud/assets/src/lib/favicon/mstile-150x150.png',
            hash: '8274a5758e6c7525e2b29b037d01101e51838981',
            ext: '.png',
          },
          {
            file: 'libs/nx-cloud/assets/src/lib/favicon/safari-pinned-tab.svg',
            hash: '94f001310cba940e7d3e67469ecea450d439c5fe',
            ext: '.svg',
          },
          {
            file: 'libs/nx-cloud/assets/src/lib/illustrations/10x.svg',
            hash: '7b1f586a1c0abfb9f9045d47eba135a623183410',
            ext: '.svg',
          },
          {
            file: 'libs/nx-cloud/assets/src/lib/illustrations/analysis.svg',
            hash: 'bf2a1f5acfe1bc095a6daaacd7b66f1a7c9bd8d2',
            ext: '.svg',
          },
          {
            file:
              'libs/nx-cloud/assets/src/lib/illustrations/computation-dark.svg',
            hash: '08edc9c272414fce8bc5b5ecee74f62b51d9b22e',
            ext: '.svg',
          },
          {
            file: 'libs/nx-cloud/assets/src/lib/illustrations/computation.svg',
            hash: '6c99ac9dbd624abaadada863be413489cbffd3f2',
            ext: '.svg',
          },
          {
            file:
              'libs/nx-cloud/assets/src/lib/illustrations/enjoy-the-benefits.svg',
            hash: '9bca34bd484cab4da22e153fdebbd9a40484ef32',
            ext: '.svg',
          },
          {
            file:
              'libs/nx-cloud/assets/src/lib/illustrations/icon-expenses.svg',
            hash: '6d68793ec8c9ee3481ea5edfe4ba3541fe3bc2ef',
            ext: '.svg',
          },
          {
            file: 'libs/nx-cloud/assets/src/lib/illustrations/icon-flower.svg',
            hash: '4cba397f6f0ef2d7b2e7c9232a91dcc210229a35',
            ext: '.svg',
          },
          {
            file: 'libs/nx-cloud/assets/src/lib/illustrations/icon-running.svg',
            hash: 'a6a799939673ee871a910ef4bcf24e54a9ab71d4',
            ext: '.svg',
          },
          {
            file: 'libs/nx-cloud/assets/src/lib/illustrations/insights.svg',
            hash: '4ec14b89a7968ccd83c9a829f88f99d295fe8d74',
            ext: '.svg',
          },
          {
            file: 'libs/nx-cloud/assets/src/lib/nrwl-logo-white-word.svg',
            hash: 'b045710d8837433100e3337fcc6eca2c312ad03b',
            ext: '.svg',
          },
          {
            file: 'libs/nx-cloud/assets/src/lib/nrwl-logo-white.svg',
            hash: '8bf2e725d4b42794f689a1d2b8ca0c6aec0a7007',
            ext: '.svg',
          },
          {
            file: 'libs/nx-cloud/assets/src/lib/nrwl-nx-blue.svg',
            hash: '944ad4aeca3e862ef657dfd0e999cddc37ef64bc',
            ext: '.svg',
          },
          {
            file: 'libs/nx-cloud/assets/src/lib/nx-cloud-assets.ts',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/assets/src/lib/nx-cloud-card.png',
            hash: '78c65d81985fcd8f351834f8c271fda22dd28375',
            ext: '.png',
          },
          {
            file:
              'libs/nx-cloud/assets/src/lib/nx-cloud-logo-horizontal-white.svg',
            hash: '9778d28f938c264fcae795853431a2ac4682e402',
            ext: '.svg',
          },
          {
            file:
              'libs/nx-cloud/assets/src/lib/nx-cloud-logo-vertical-white.svg',
            hash: 'ec4070c350c5ee0f8f020dd598349277092be129',
            ext: '.svg',
          },
          {
            file: 'libs/nx-cloud/assets/src/lib/nx-cloud-logo.svg',
            hash: '1e6e4237c2362777b1d942270780df2bab2a2d7b',
            ext: '.svg',
          },
          {
            file: 'libs/nx-cloud/assets/src/lib/nx-logo-white.svg',
            hash: '08f22a6180441b1505ade2f51a32bb69450958c7',
            ext: '.svg',
          },
          {
            file: 'libs/nx-cloud/assets/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/assets/tsconfig.lib.json',
            hash: '0fe9966358eb51092a1668ecb0795b6db52a538b',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/assets/tsconfig.spec.json',
            hash: '4dc880ff63ba87e658f9948d0f04608f6c871f71',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/assets/tslint.json',
            hash: '95392b22f1daff08c314b72981978732803832fe',
            ext: '.json',
          },
        ],
      },
    },
    'platform-utils': {
      name: 'platform-utils',
      type: 'lib',
      data: {
        root: 'libs/platform/utils',
        sourceRoot: 'libs/platform/utils/src',
        projectType: 'library',
        architect: {
          'test-change-to-jest-and-rename-back': {
            builder: '@angular-devkit/build-angular:karma',
            options: {
              main: 'libs/platform/utils/src/test.ts',
              karmaConfig: 'libs/platform/utils/karma.conf.js',
              scripts: [],
              styles: [],
              assets: [],
              tsConfig: 'libs/platform/utils/tsconfig.spec.json',
            },
          },
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/platform/utils/tsconfig.lib.json',
                'libs/platform/utils/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/platform/utils/**/*'],
            },
          },
        },
        prefix: '',
        tags: [],
        files: [
          {
            file: 'libs/platform/utils/karma.conf.js',
            hash: 'fd5080706855d0ab41abf9c1b83c739d7e824b3f',
            ext: '.js',
          },
          {
            file: 'libs/platform/utils/src/index.ts',
            hash: 'a3204979ba1a2993a8e7f31bf8b79fb5fac28e70',
            ext: '.ts',
          },
          {
            file: 'libs/platform/utils/src/lib/auth.service.ts',
            hash: '73c7920d09db056b4004d8283925cac50f24dce8',
            ext: '.ts',
          },
          {
            file: 'libs/platform/utils/src/lib/local-storage.service.ts',
            hash: '1ef6bbd7953892163fd15c66388b50e2f82ffe7c',
            ext: '.ts',
          },
          {
            file: 'libs/platform/utils/src/lib/primary-toolbar.service.ts',
            hash: 'b732a2f4184185a491eef44b103dcd142c22c276',
            ext: '.ts',
          },
          {
            file: 'libs/platform/utils/src/lib/utils.module.ts',
            hash: 'de576dfe44efe0b6a91645faccc0a20523062bd5',
            ext: '.ts',
          },
          {
            file: 'libs/platform/utils/src/test.ts',
            hash: '40ae238126b52a49932f4603239136bbab1c11fd',
            ext: '.ts',
          },
          {
            file: 'libs/platform/utils/tsconfig.json',
            hash: '8c8dd086f99335d47c1f2f3e47fd3b8af7429293',
            ext: '.json',
          },
          {
            file: 'libs/platform/utils/tsconfig.lib.json',
            hash: '4e5c90342eae1e79d4a84e05699207b0918784da',
            ext: '.json',
          },
          {
            file: 'libs/platform/utils/tsconfig.spec.json',
            hash: '14649b0f9441b06e4b1582861a7824ee3f8465e1',
            ext: '.json',
          },
          {
            file: 'libs/platform/utils/tslint.json',
            hash: '95392b22f1daff08c314b72981978732803832fe',
            ext: '.json',
          },
        ],
      },
    },
    'nx-cloud-utils': {
      name: 'nx-cloud-utils',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/nx-cloud/utils',
        sourceRoot: 'libs/nx-cloud/utils/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/nx-cloud/utils/tsconfig.lib.json',
                'libs/nx-cloud/utils/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/nx-cloud/utils/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/nx-cloud/utils/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {},
        tags: ['nx-cloud', 'type:util'],
        files: [
          {
            file: 'libs/nx-cloud/utils/README.md',
            hash: '399d62ab38687285c7fd2922c2d79e4016bac07a',
            ext: '.md',
          },
          {
            file: 'libs/nx-cloud/utils/jest.config.js',
            hash: 'e7461bef4041f8dc8b471dac89b48b4e2c1b0f20',
            ext: '.js',
          },
          {
            file: 'libs/nx-cloud/utils/src/index.ts',
            hash: '59bcabdb70660bd15ab4f9e4e952637e1b95e452',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/utils/src/lib/analytics.service.ts',
            hash: 'bbcdeec68e189d38cbed88d63f95ad2568d46530',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/utils/src/lib/copyToClipboard.ts',
            hash: 'f55241df9fbfaf60be9cb2d278bbd127d590abc7',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/utils/src/lib/enable-feature.guard.ts',
            hash: '35756143210c8501e367c73e7a40971121e2720c',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/utils/src/lib/format-millis.pipe.ts',
            hash: '56de44886bd3cfbedd49af1f43a4d5b5b169d2c8',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/utils/src/lib/local-storage.service.ts',
            hash: 'e4e5bfc15f8db17facabe1ab3a2d32306050f9ca',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/utils/src/lib/nx-cloud-utils.module.ts',
            hash: 'a388573d92e176bf12e72947ccf7bab5ad7dc664',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/utils/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/nx-cloud/utils/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/utils/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/utils/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/nx-cloud/utils/tslint.json',
            hash: '73b97fa5da957ae1c3b7c1814eb288cec20e4d7e',
            ext: '.json',
          },
        ],
      },
    },
    'nx-docs-site': {
      name: 'nx-docs-site',
      type: 'app',
      data: {
        root: 'apps/nx-docs-site/',
        sourceRoot: 'apps/nx-docs-site/src',
        projectType: 'application',
        prefix: 'nx',
        schematics: {
          '@schematics/angular:component': {
            styleext: 'scss',
          },
        },
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:browser',
            options: {
              outputPath: 'dist/apps/nx-docs-site',
              index: 'apps/nx-docs-site/src/index.html',
              main: 'apps/nx-docs-site/src/main.ts',
              polyfills: 'apps/nx-docs-site/src/polyfills.ts',
              tsConfig: 'apps/nx-docs-site/tsconfig.app.json',
              assets: [
                'apps/nx-docs-site/src/browserconfig.xml',
                'apps/nx-docs-site/src/site.webmanifest',
                'apps/nx-docs-site/src/sitemap.xml',
                'apps/nx-docs-site/src/assets',
              ],
              styles: [
                'libs/shared/ui-markdown/src/assets/prism.css',
                'apps/nx-docs-site/src/styles.scss',
              ],
              scripts: [
                './node_modules/marked/lib/marked.js',
                './node_modules/prismjs/prism.js',
                './node_modules/prismjs/plugins/toolbar/prism-toolbar.min.js',
                './node_modules/prismjs/plugins/copy-to-clipboard/prism-copy-to-clipboard.min.js',
                './node_modules/prismjs/components/prism-typescript.js',
                './node_modules/prismjs/components/prism-bash.js',
                'libs/shared/ui-markdown/src/assets/prism.plugins.js',
              ],
              stylePreprocessorOptions: {
                includePaths: ['libs/nx-docs-site/styles/src/lib'],
              },
            },
            configurations: {
              production: {
                fileReplacements: [
                  {
                    replace:
                      'apps/nx-docs-site/src/environments/environment.ts',
                    with:
                      'apps/nx-docs-site/src/environments/environment.prod.ts',
                  },
                ],
                optimization: true,
                outputHashing: 'all',
                sourceMap: false,
                extractCss: true,
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
                ],
              },
            },
          },
          server: {
            builder: '@angular-devkit/build-angular:server',
            options: {
              outputPath: 'dist/apps/nx-docs-site-server',
              main: 'apps/nx-docs-site/src/main.server.ts',
              tsConfig: 'apps/nx-docs-site/tsconfig.server.json',
              stylePreprocessorOptions: {
                includePaths: ['libs/nx-docs-site/styles/src/lib'],
              },
            },
            configurations: {
              production: {
                fileReplacements: [
                  {
                    replace:
                      'apps/nx-docs-site/src/environments/environment.ts',
                    with:
                      'apps/nx-docs-site/src/environments/environment.prod.ts',
                  },
                ],
                sourceMap: false,
                optimization: {
                  scripts: false,
                  styles: true,
                },
              },
            },
          },
          serve: {
            builder: '@angular-devkit/build-angular:dev-server',
            options: {
              browserTarget: 'nx-docs-site:build',
            },
            configurations: {
              production: {
                browserTarget: 'nx-docs-site:build:production',
              },
            },
          },
          'extract-i18n': {
            builder: '@angular-devkit/build-angular:extract-i18n',
            options: {
              browserTarget: 'nx-docs-site:build',
            },
          },
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'apps/nx-docs-site/tsconfig.app.json',
                'apps/nx-docs-site/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!apps/nx-docs-site/**'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'apps/nx-docs-site/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        tags: ['nx:docs-site'],
        files: [
          {
            file: 'apps/nx-docs-site/browserslist',
            hash: '21e7db67f21925fec628c002fc2e36f634316185',
            ext: '',
          },
          {
            file: 'apps/nx-docs-site/jest.config.js',
            hash: '2d8bb56e07c337c776d3219d7c4042a74480e071',
            ext: '.js',
          },
          {
            file: 'apps/nx-docs-site/src/app/app.component.spec.ts',
            hash: 'dd2cfdf785d32f2289b9b864bd862b3c248ae989',
            ext: '.ts',
          },
          {
            file: 'apps/nx-docs-site/src/app/app.component.ts',
            hash: '477cd60493cc70b6033a4f39bec23ddb3c4b169d',
            ext: '.ts',
          },
          {
            file: 'apps/nx-docs-site/src/app/app.module.ts',
            hash: '5744b003501c2070f781d52a98af5a4fbce143fa',
            ext: '.ts',
          },
          {
            file: 'apps/nx-docs-site/src/app/app.routing.module.ts',
            hash: 'd50640e59385573484be57a605e44d02c0cd787e',
            ext: '.ts',
          },
          {
            file: 'apps/nx-docs-site/src/app/app.server.module.ts',
            hash: '9388a0e4f5d8ca2137ebdeb049ed8d2f7a98a401',
            ext: '.ts',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-angular/builders/package.md',
            hash: '2829b902fa198b200227aefaf1f1f7e9e5c52ffd',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-angular/schematics/application.md',
            hash: '21d84d5a9ed0d57e46522d8629fda2f08cd23b91',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-angular/schematics/downgrade-module.md',
            hash: 'bf61edc6e0a516b8cef4dc3589c18fbef6a7499f',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-angular/schematics/karma-project.md',
            hash: '437525907fccfd807fc390049e2b571ecd7791f4',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-angular/schematics/karma.md',
            hash: '60e8a1287f6690c45bd9169d6c28a3e96340f92c',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-angular/schematics/library.md',
            hash: '2bef93086bebfab8528211cc1300f7e3965f3709',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-angular/schematics/move.md',
            hash: '9950c8661e84412790155a9927d89ce1a254aaf8',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-angular/schematics/ngrx.md',
            hash: '2b80efe29efcefa7bd8805f7d79b840a650c0369',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-angular/schematics/stories.md',
            hash: '6b5ae085d4cd6057bae7265554ebcbfe16badbb4',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-angular/schematics/storybook-configuration.md',
            hash: '242cf06ba8f32caef630d45fab5a6d6b1d1356a6',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-angular/schematics/upgrade-module.md',
            hash: '5ef0b737053c380a340aa7ec78c73b708f6e9fbe',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-cypress/builders/cypress.md',
            hash: 'c940e55be12269b913b11f4f2374e987566074e8',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-express/schematics/application.md',
            hash: '3fef2b524cf0868f6b71705bbbc292d175cba20d',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-jest/builders/jest.md',
            hash: '71e6447b7dc40425a63dc8be16e573550a6a50bd',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-linter/builders/lint.md',
            hash: '02de994ab7d9ce3eeceb5e15e890472388fed19e',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-nest/schematics/application.md',
            hash: 'a8033843a30abe4c566f5f7516029f606c98cc8b',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-nest/schematics/class.md',
            hash: '60eed0c9defc6c9c79e95c509d26f61789dd6028',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-nest/schematics/controller.md',
            hash: '34196e0344dc0531108ba564bc69784d3a6a4b37',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-nest/schematics/decorator.md',
            hash: '91251f6129fafea6a60cbf385d9808a78062901f',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-nest/schematics/filter.md',
            hash: 'e9fdd2d25f15f1fddb741dd42989535b2d5a9994',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-nest/schematics/gateway.md',
            hash: '17337b131037df028cea417d662d97e09e9c23eb',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-nest/schematics/guard.md',
            hash: '957a74659561bcf1438ef815289bb6c5feaea7aa',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-nest/schematics/interceptor.md',
            hash: '7fe958dbe35ad5b18c6f7232b7e80833e4652b49',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-nest/schematics/interface.md',
            hash: '3d3caeeb6aba0ba4f73ed4c4b7526b969054d8cf',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-nest/schematics/library.md',
            hash: '378edce0f3eb638f868677c68374054f94d986bb',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-nest/schematics/middleware.md',
            hash: 'f0bbc032b30480a32982748b05cbab0955275135',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-nest/schematics/module.md',
            hash: 'fadf38a320b0ddfe68bdc2f433e872a90bfef3b7',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-nest/schematics/pipe.md',
            hash: 'aa4f795996bdec0c7e36a2f44123e6513cda18cb',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-nest/schematics/provider.md',
            hash: 'aeec1a7e37412445bbc9626d8cddee75dc6ce1b6',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-nest/schematics/resolver.md',
            hash: '11f796c62251f9ef39d64ff45b454d694caf6743',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-nest/schematics/service.md',
            hash: '64eba5d6dcad61915e391b3b9f50793fe64ef7fc',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-next/builders/build.md',
            hash: '00e6dec45e7813bd3fb7b0b7d24ff3e1b6636389',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-next/builders/export.md',
            hash: '830302d8b3e776a91e090feb936e403a7149d2a5',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-next/builders/server.md',
            hash: '8f0510f26198eda5f6cd5ce1cc579f423f18adfd',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-next/schematics/application.md',
            hash: '1edfc0e6473b23b5e81a6aed8aa6bab9e97250b0',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-next/schematics/component.md',
            hash: 'a15559d721943911a55e7858f641dbff5eb6efb6',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-next/schematics/page.md',
            hash: '913c30ad4934aa86870e2c58196720f0219339f5',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-node/builders/build.md',
            hash: 'a45e0b511e53efbcfc412f6c283d93d2935030aa',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-node/builders/execute.md',
            hash: 'da28d63188922d6094e91e7e85c0319b8ea966b8',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-node/builders/package.md',
            hash: '01b50e956b180a0b05f92d68f9fc0b18802a1586',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-node/schematics/application.md',
            hash: '69830fb0368decf4385140380a0f7ab6b661b85c',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-node/schematics/library.md',
            hash: '34bc00a7b0c2b715ffe69acf54e69e5657668ccb',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-nx-plugin/builders/e2e.md',
            hash: 'ff930503cde0482e599c8953ad5c2303b859c3ad',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-nx-plugin/schematics/builder.md',
            hash: '834d5e6a0ea05366b93de07ba1ccf441783a9b86',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-nx-plugin/schematics/migration.md',
            hash: 'c3d3a9d3a8f30fd4addebdc2abaaab7e749efd8b',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-nx-plugin/schematics/plugin.md',
            hash: '656fff8080cec6a0c61832206959d39f60404d27',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-nx-plugin/schematics/schematic.md',
            hash: '926215122b89e8d01b3bada51fef1d6fd55cdd3e',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-react/schematics/application.md',
            hash: '1c545946a636090d79037497ffb339bed9936343',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-react/schematics/component-cypress-spec.md',
            hash: '5496c40fdeee21f15d910f7e840b09b52123b69e',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-react/schematics/component-story.md',
            hash: '9dc2d510afcafcc73b4ecd24131b885c4b4b5bf6',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-react/schematics/component.md',
            hash: 'e0734c9b23f2a879eaf663acd11ff99746541c59',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-react/schematics/library.md',
            hash: '247ca157507b7dae3f1981ab49b0245004d0012b',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-react/schematics/redux.md',
            hash: '762c61dba7d32beec8a2da9757947c9ae2db1459',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-react/schematics/stories.md',
            hash: '254fa3265a6cbf06ec843013f603ff769511aaad',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-react/schematics/storybook-configuration.md',
            hash: '59445597473410b543441ae8ebd825e89186df2d',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-storybook/builders/build.md',
            hash: '6d16ae6db7ac8bb6e4ccfbb03a9d0dea75588922',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-storybook/builders/storybook.md',
            hash: '58f6cd165b65e0759909497a77adc4ed76ece3fb',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-storybook/schematics/configuration.md',
            hash: '85424203c18da2c47919c914175106c5b620f9a8',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-storybook/schematics/cypress-project.md',
            hash: '2c41f37dd5e4c659a8bd98bda01a89ef41d16e7b',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-web/builders/build.md',
            hash: 'be67fd7ff7cb619dc38def55da9654d0d0e9112e',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-web/builders/dev-server.md',
            hash: 'a3419a6985e2b94fc42ae749505b64cb6fa846b5',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-web/builders/package.md',
            hash: '65e9b5ad419b01c89140c5dfa4595678f9b6de13',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-web/schematics/application.md',
            hash: '2fe756de4ab0c4e52812d113bc88605cd67f3f06',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-workspace/builders/run-commands.md',
            hash: '8a5b9d2176e08649b0479c6602364993ed51b5dc',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-workspace/schematics/library.md',
            hash: '4204e2a99c3600acc130545e0397b73f6feeff86',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-workspace/schematics/move.md',
            hash: '6b835910aae3316304b73aebdbc4fca974eef0d1',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-workspace/schematics/remove.md',
            hash: 'c641affde7249e934963f448bd79db900b703368',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-workspace/schematics/run-commands.md',
            hash: 'aece6f40fe1a63524d345321ceeb0703ef2324e5',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/api-workspace/schematics/workspace-schematic.md',
            hash: '48d2b6607b0a1a689633b111e62016071e984a08',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/angular/api/home.md',
            hash: '13e2de346cf8b06859731d2b1e038d158ad92a94',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/angular/builders.json',
            hash: '722846ec085f8420adb3aa54cda733c6e96ccb92',
            ext: '.json',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/cli/affected-apps.md',
            hash: 'a3a0b085a39c5e362f89291a7cb5c89cabe16c36',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/cli/affected-build.md',
            hash: '71838d1d62f0e951d32b34cb85b34605cc44bd41',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/cli/affected-dep-graph.md',
            hash: '62c9b47cf520a761a6162aa0908574f578dcfd1a',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/cli/affected-e2e.md',
            hash: '978a4c0bcb5c9c49acf841493e911f8f38050369',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/cli/affected-libs.md',
            hash: 'f9648615be93795227bfff5fe13482e06568cee8',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/cli/affected-lint.md',
            hash: '7b193569105cefa196307092904949edd76ec3e1',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/cli/affected-test.md',
            hash: 'f4ac477c0903dc265b00c83e6bee4aaf25356256',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/cli/affected.md',
            hash: 'af8eb1161d0f545601ef3c2b49717b7130bf2931',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/angular/cli/build.md',
            hash: '8a398ba7e32adf7dc0c39005b4b081b9a2070033',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/cli/dep-graph.md',
            hash: '5ab0a9faebb7aeed898db20d62663ae3a689df3c',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/angular/cli/e2e.md',
            hash: '1fdb16dc1bb845214d8fb86074d9955074f53ad1',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/cli/format-check.md',
            hash: '30e8502026a21bcd6b311457aa3502122d5fdbec',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/cli/format-write.md',
            hash: '665209906619d33d30417d2c5c8b9312e068fef1',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/cli/generate.md',
            hash: '033fcfd871d6cac1bed56b688d48d87a072292af',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/angular/cli/lint.md',
            hash: '19efd0e2af38aaa58ed144a10632755a6f37ffba',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/angular/cli/list.md',
            hash: '09742dbc9bbd99276f5f8d24c800c9f5be12d500',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/angular/cli/migrate.md',
            hash: '4ce4814282359f748650a746b5eb4da801537a92',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/cli/print-affected.md',
            hash: '3064c879ccc06aebd4203d3ab7db1818ab610f58',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/angular/cli/report.md',
            hash: '0d7c3480d5a028a13d8da43f34d0fd699bd58c55',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/cli/run-many.md',
            hash: '11f33191055c1d7132fb46f5618fa34bd098a654',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/angular/cli/run.md',
            hash: '87df36051c3f52d5577a7f1c59424f6b9fd0b9d2',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/angular/cli/serve.md',
            hash: '6a87bc97767eb44b8e44b868a4f0b08c826378b4',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/angular/cli/test.md',
            hash: '84d7e9db8662dd4775f841ebd3a07d7743d0ad09',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/cli/workspace-lint.md',
            hash: 'd3eeca5b2b9c13b8f18eea24cfcb8c2bcf6829f9',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/cli/workspace-schematic.md',
            hash: '1935090762ef64b71d4d5c44e5e5b6eaafdfbfbf',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/examples/apollo-angular.md',
            hash: 'c6818acd7f008d9fca6b1f451682755afefa5090',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/examples/react-affected.png',
            hash: 'e1dd4042dd12e46bb23fe26781c469db2460b021',
            ext: '.png',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/examples/react-affected2.png',
            hash: '3d8f870b9377d708c56b77a4a889b24ffa3628a7',
            ext: '.png',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/examples/react-and-angular.md',
            hash: '5539ef330d8c40c0af350f79f83cad5d7e1f2de4',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/examples/react-dep-graph.png',
            hash: '81f04e46326bc57d1ae87a7a5896a3d9ef8e1638',
            ext: '.png',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/examples/react-serve.png',
            hash: 'b73ca2038a61a7915a20721ec775e925baf0ff8e',
            ext: '.png',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/getting-started/advanced-nx-workspace-course.png',
            hash: 'bf8a9f31fe3679f3f5f9d535da0735170299b095',
            ext: '.png',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/getting-started/create-workspace.gif',
            hash: '85a97af73b29af9a4476e2b3d4d22ec1a1b05eca',
            ext: '.gif',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/getting-started/dep-graph.png',
            hash: '0cc9c65cdf9c81eba3d30cd09979f818d74a7260',
            ext: '.png',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/getting-started/nx-and-cli.md',
            hash: 'da560808b667d4beace6fdf1db574bf152fb59af',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/getting-started/resources.md',
            hash: '2f50a109d105b0ee9c60d2778965db0127d6179a',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/getting-started/why-nx.md',
            hash: '57865b754bc18eda488888df473133136b70d2d3',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/guides/cli-overview.md',
            hash: '4881187995d2152d189e6dd06e54b429828d0d8f',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/guides/configuration.md',
            hash: 'ed056e05445c6b60a5db386749436cb0ac8f381c',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/guides/misc-data-persistence.md',
            hash: '7fee2b0ce85399c86131443ab3957b9c3f063c87',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/guides/misc-ngrx.md',
            hash: '784b1e43fae2a43d7ace7088e8565947277468f9',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/guides/misc-upgrade.md',
            hash: 'b840a290289cb524c65176422e39526d69a52bc9',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/guides/nx7-to-nx8.md',
            hash: '3e9095160947bb7b56deb905e5dcf7447a4b701d',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/guides/running-custom-commands.md',
            hash: '2afa6f986713d1a0964cca9ae06348768380917f',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/guides/storybook-plugin.md',
            hash: 'adec6a167bb7b5775d5d39db9af244db5e50119e',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/guides/update.md',
            hash: '4e4723273ce668d64ab8ce4c7da42d803e4b3253',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/migration/migration-angular.md',
            hash: '90bb361519ab4d5eae593d7846b94878d5668984',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/migration/migration-angularjs-unit-tests-passing.png',
            hash: '53414ab08cb6659ac6e5506f9c351ad343075064',
            ext: '.png',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/migration/migration-angularjs.md',
            hash: '4938946027f304eabb4385eff92f9f60b29da027',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/schematics.json',
            hash: '8676bdea5b1fe7fc9db79681562fd43d7443ac6d',
            ext: '.json',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/tutorial/01-create-application.md',
            hash: '7920ab1a4ab544adde40d36ddbe5e6ee824d7346',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/tutorial/02-add-e2e-test.md',
            hash: '360204d96900b013d073851ed55246d9d910c3cc',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/tutorial/03-display-todos.md',
            hash: '16dfea6885d273633047243f33279e7dbf933e8c',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/tutorial/04-connect-to-api.md',
            hash: '88f27717705b3580cd9a74942eeb14a8b0161ce2',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/tutorial/05-add-node-app.md',
            hash: 'd52de68306a67e1331177b00ccd1665bbf0787c8',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/tutorial/06-proxy.md',
            hash: '449c14c790900776feb205e5480dce32e3955924',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/tutorial/07-share-code.md',
            hash: 'bee7c00618b1049e9a12b7470be072d5330a05e3',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/tutorial/08-create-libs.md',
            hash: 'aa475e9305823ca422b5bb385d016a10c1933129',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/tutorial/09-dep-graph.md',
            hash: 'd01a11571447ea6dfc9d4806be44843b13414aea',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/tutorial/10-computation-caching.md',
            hash: 'c5df552ac17c11871f2406a223ce448fe648324c',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/tutorial/11-test-affected-projects.md',
            hash: '7ad4aee2600effc13de0760a400e2379d38b4f00',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/angular/tutorial/12-summary.md',
            hash: '345f42e0eff9ca2377613a5097a0bd5873bd6489',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/builders.json',
            hash: 'd147d35dea142344dcbb2293d49a1deb84b0c150',
            ext: '.json',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/map.json',
            hash: '5b8be91218be86097a451912aa411de510036be0',
            ext: '.json',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-angular/builders/package.md',
            hash: '7713413651ddd5c676cef49223ceeca834b1d9b9',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-angular/schematics/application.md',
            hash: 'a895bddf451b6eb7ab046a5fa8688c5dcd75720c',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-angular/schematics/downgrade-module.md',
            hash: '83a9b97974fe9935ef5c28006ed169a59870bf6e',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-angular/schematics/karma-project.md',
            hash: 'fb87bebaa393c4bb4fad7084ca641f7ce4d52c2e',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-angular/schematics/karma.md',
            hash: 'fa41a5fe4654fb7ad89178f38aa0399cdf728ce8',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-angular/schematics/library.md',
            hash: 'fb756b7a75d580565464f9e5882e8057c69b4ad8',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-angular/schematics/move.md',
            hash: 'b5b4a8632cfbcb2c14e350ae8d55e7dddcacdab2',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-angular/schematics/ngrx.md',
            hash: '9d4a0f23dc962452ee656e011b884afeb40927d0',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-angular/schematics/stories.md',
            hash: 'b2f44ffb0abe1aabe4bca74d4092ddd040552fc5',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-angular/schematics/storybook-configuration.md',
            hash: '751fd9c07692799cff997700e9810d2e9b8816f2',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-angular/schematics/upgrade-module.md',
            hash: '093f05de0159d531029aa9ed04372527bb069598',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-cypress/builders/cypress.md',
            hash: '7442d5d345c4e19ef4f80a4d2eb74e38999a55f9',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-express/schematics/application.md',
            hash: 'e99102b4067b2552638db4f972c8175ea161a1a1',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-jest/builders/jest.md',
            hash: 'f9da9829e43487ed69412e88c59768b258f0379f',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-linter/builders/lint.md',
            hash: 'd235d9c234e023c3721ed2fa9a24baa5f5dc7dc1',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-nest/schematics/application.md',
            hash: 'cca4d44354a4b5c0ed3f15a4f8e4e4bf4ce6ab87',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-nest/schematics/class.md',
            hash: '919d78f9ccad6a202f0cb5003859ed3298df204d',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-nest/schematics/controller.md',
            hash: '6d876ec3eeaa5e1318d638d2413b6b18c5036f34',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-nest/schematics/decorator.md',
            hash: '30c763bfe182f09705aa315e077eb82e66e3347d',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-nest/schematics/filter.md',
            hash: '574c0bb7faf8d9b86e0addc1b0d2f1544cb410ce',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-nest/schematics/gateway.md',
            hash: '0c84025bedeeac4d0b0dec53180462559db7cea4',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-nest/schematics/guard.md',
            hash: '07c00cac00c85b4ac3d8496d5b89dfcc78c2dd1c',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-nest/schematics/interceptor.md',
            hash: 'ba3aff009eed789c473930c5649f6dec46c22cc2',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-nest/schematics/interface.md',
            hash: '6392eb510c6f1f5d8238d03c4675b54d2c186728',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-nest/schematics/library.md',
            hash: '5a96b01c79745f21acb2015b7bf598fa9e7e6f52',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-nest/schematics/middleware.md',
            hash: '8f4f48344e3202eea4b303e2115fe828491be209',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-nest/schematics/module.md',
            hash: '9d36d9e18e69258365b438977779c4ceea41c0d0',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-nest/schematics/pipe.md',
            hash: '49992338e207fdb76d916b1a15356a43a7794d18',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-nest/schematics/provider.md',
            hash: '6ea1995f14867cb1904edfc7c68008fd666b447a',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-nest/schematics/resolver.md',
            hash: '35a7bf480c4703a30166f5d314efdf3a73c45638',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-nest/schematics/service.md',
            hash: '78da4067aa39ce928c0ef54865e76aeb622d9e45',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-next/builders/build.md',
            hash: 'c3b9d3d3b30e98f7287c661312ef2cdd1955e726',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-next/builders/export.md',
            hash: 'e6885d3740c5f19e4d7d13a4742c9418c04a61be',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-next/builders/server.md',
            hash: '095e48e2d722f6b053b301a979500d96a1e3a011',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-next/schematics/application.md',
            hash: 'ec0c74b2b2d13fe12c7c05ab51e41c3ec29b687f',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-next/schematics/component.md',
            hash: 'bb6cffb91e6be7eae2b7a9fc01952bfd6710746a',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-next/schematics/page.md',
            hash: '82ca21954ec0bc5b4b550a5d4e7613f17865b1fb',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-node/builders/build.md',
            hash: '36e6ef7f3a06b50697de4af808cda92cd4b39f72',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-node/builders/execute.md',
            hash: 'c56a5976f4135eb9506c89e2eddf0ed60c19414f',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-node/builders/package.md',
            hash: '9660b68f468ab13467a3dc9a9a95845397e47957',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-node/schematics/application.md',
            hash: 'ec8dc40167741f5b40ccd3d3e245443ef0862c05',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-node/schematics/library.md',
            hash: '24867910f135fe8d159772dbe085ce2d35af5003',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-nx-plugin/builders/e2e.md',
            hash: 'a3785bbd7d8e7e324f7df8854b6438b26e658ea7',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-nx-plugin/schematics/builder.md',
            hash: '63c86c4e429366c6d76a319dbba774477390eca3',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-nx-plugin/schematics/migration.md',
            hash: 'd8ebce862a794715a51b6c14aa26ee4cc4ccf907',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-nx-plugin/schematics/plugin.md',
            hash: 'f7bce6c1ba9c7b43537de336d709a3689d222a21',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-nx-plugin/schematics/schematic.md',
            hash: 'dd34d31cdc0e733163fd23971d3f55e8214edf83',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-react/schematics/application.md',
            hash: '305c382e5dce08f33f42fe4b60de89bcc1d2164a',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-react/schematics/component-cypress-spec.md',
            hash: '58b52f635add7eb9e407d871168912b0fc3d0e19',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-react/schematics/component-story.md',
            hash: '35ef6ced9c08a07ad07f7863536859522c2c7620',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-react/schematics/component.md',
            hash: '8fe208e4ec679fe7ab87485db7032024961368c9',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-react/schematics/library.md',
            hash: '81cf8a607f4621bf13ed35f9fb1e418910d2769b',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-react/schematics/redux.md',
            hash: 'cda1e636d6ca2673a5d13c483c297415fc889dec',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-react/schematics/stories.md',
            hash: '1783c9fa827f971539446d97e92eb0f0f84cb9df',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-react/schematics/storybook-configuration.md',
            hash: '1863c90349312ce6126ae22a19392be3a139f57d',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-storybook/builders/build.md',
            hash: '05648b03786f5541ad8346969b9f11d8e52d0b7c',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-storybook/builders/storybook.md',
            hash: 'cbe82db0236cd7435ea69424d3697a241b9953bd',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-storybook/schematics/configuration.md',
            hash: '65eb7bc7c67a487d08d5e568627b58d65a245f10',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-storybook/schematics/cypress-project.md',
            hash: 'ed108f43ac61bf669f2a1b767f8ab32521e271cd',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-web/builders/build.md',
            hash: '787193fec8813266085e215ffd6beef58168747e',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-web/builders/dev-server.md',
            hash: '1059a38e48c0009f5e7e726cb85f4d7f54e86306',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-web/builders/package.md',
            hash: 'c26419a51090d36a3ceee4689fac425eb267c4c3',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-web/schematics/application.md',
            hash: 'c361d4833f433933622ac0753fdb74c19a21f2a9',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-workspace/builders/run-commands.md',
            hash: 'fffa19b96cc83ab8780f262bb9e61858bde48f11',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-workspace/schematics/library.md',
            hash: '7bbf252feede1e0ed5d29a1b6d7b781c951217df',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-workspace/schematics/move.md',
            hash: 'efd16148a20332539420cbc5dc7ee2a1829c8cec',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-workspace/schematics/remove.md',
            hash: 'a83d2779386b7e72a93db5f8629d60babe6bd5d8',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-workspace/schematics/run-commands.md',
            hash: '6ab77cfeba3eea0c74db1d448744068513490df5',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/api-workspace/schematics/workspace-schematic.md',
            hash: 'd90b6755c4a0b765c039310911df27b5c8f46d86',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/react/api/home.md',
            hash: 'cac22a054ad85b599b7281b9a4cb6f46d7a1c4f7',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/react/builders.json',
            hash: '722846ec085f8420adb3aa54cda733c6e96ccb92',
            ext: '.json',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/cli/affected-apps.md',
            hash: 'a3a0b085a39c5e362f89291a7cb5c89cabe16c36',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/cli/affected-build.md',
            hash: '71838d1d62f0e951d32b34cb85b34605cc44bd41',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/cli/affected-dep-graph.md',
            hash: '62c9b47cf520a761a6162aa0908574f578dcfd1a',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/cli/affected-e2e.md',
            hash: '978a4c0bcb5c9c49acf841493e911f8f38050369',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/cli/affected-libs.md',
            hash: 'f9648615be93795227bfff5fe13482e06568cee8',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/cli/affected-lint.md',
            hash: '7b193569105cefa196307092904949edd76ec3e1',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/cli/affected-test.md',
            hash: 'f4ac477c0903dc265b00c83e6bee4aaf25356256',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/react/cli/affected.md',
            hash: 'af8eb1161d0f545601ef3c2b49717b7130bf2931',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/react/cli/build.md',
            hash: '8a398ba7e32adf7dc0c39005b4b081b9a2070033',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/react/cli/dep-graph.md',
            hash: '5ab0a9faebb7aeed898db20d62663ae3a689df3c',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/react/cli/e2e.md',
            hash: '1fdb16dc1bb845214d8fb86074d9955074f53ad1',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/cli/format-check.md',
            hash: '30e8502026a21bcd6b311457aa3502122d5fdbec',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/cli/format-write.md',
            hash: '665209906619d33d30417d2c5c8b9312e068fef1',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/react/cli/generate.md',
            hash: '033fcfd871d6cac1bed56b688d48d87a072292af',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/react/cli/lint.md',
            hash: '19efd0e2af38aaa58ed144a10632755a6f37ffba',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/react/cli/list.md',
            hash: '09742dbc9bbd99276f5f8d24c800c9f5be12d500',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/react/cli/migrate.md',
            hash: '4ce4814282359f748650a746b5eb4da801537a92',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/cli/print-affected.md',
            hash: '3064c879ccc06aebd4203d3ab7db1818ab610f58',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/react/cli/report.md',
            hash: '0d7c3480d5a028a13d8da43f34d0fd699bd58c55',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/react/cli/run-many.md',
            hash: '11f33191055c1d7132fb46f5618fa34bd098a654',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/react/cli/run.md',
            hash: '87df36051c3f52d5577a7f1c59424f6b9fd0b9d2',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/react/cli/serve.md',
            hash: '6a87bc97767eb44b8e44b868a4f0b08c826378b4',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/react/cli/test.md',
            hash: '84d7e9db8662dd4775f841ebd3a07d7743d0ad09',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/cli/workspace-lint.md',
            hash: 'd3eeca5b2b9c13b8f18eea24cfcb8c2bcf6829f9',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/cli/workspace-schematic.md',
            hash: '1935090762ef64b71d4d5c44e5e5b6eaafdfbfbf',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/examples/apollo-react.md',
            hash: 'af304f26be420f876e8298fc41d21f919e542221',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/examples/react-nx.md',
            hash: '3f638680f1f5b26789fea48d7bdb9ed88827f5a8',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/getting-started/advanced-nx-workspace-course.png',
            hash: 'bf8a9f31fe3679f3f5f9d535da0735170299b095',
            ext: '.png',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/getting-started/resources.md',
            hash: 'aff14c088ba679e28984d37be34b17435d03d9ec',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/getting-started/why-nx.md',
            hash: '55fc46217e6d0591e7a857b43dc9e3a979ba4f46',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/guides/adding-assets.md',
            hash: 'a4e9ffb83749f379dc2b2beedbf772367930f455',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/guides/cli-overview.md',
            hash: '82a94514c7faa042523f7910c5ee08435b74306d',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/guides/configuration.md',
            hash: 'f9ac4143701519f7d282d5d737b586a3926fab22',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/guides/environment-variables.md',
            hash: 'aa9997a750b00acaf029d76226c19ebf2bfb4357',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/guides/js-and-ts.md',
            hash: 'f0c6f9e601a5a1db6e0fad3996c9d34676cf0837',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/react/guides/nextjs.md',
            hash: '0d589affeb69a802d5d96c9177c0b2d76d11d144',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/guides/storybook-plugin.md',
            hash: 'b3bc01d77da8795966a0444582f9f086a6895067',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/migration/migration-cra.md',
            hash: '2c12a78e6c61edda1329797df12a0b127c4eee51',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/react/schematics.json',
            hash: '8676bdea5b1fe7fc9db79681562fd43d7443ac6d',
            ext: '.json',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/tutorial/01-create-application.md',
            hash: '773dccf4e9f3f909ab4dbbfc617dada3daa6782c',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/tutorial/02-add-e2e-test.md',
            hash: '0d4cf29262118068c169a327db493fb474b59728',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/tutorial/03-display-todos.md',
            hash: 'a5e6ca42cdf8d4a23f7fb19bf66969d617bf01e2',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/tutorial/04-connect-to-api.md',
            hash: 'd4a6922bacca3286874791b74855a8aaa5bb67ff',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/tutorial/05-add-node-app.md',
            hash: '7b8d580e5daf53db4ecb57c4837078e6771f001f',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/tutorial/06-proxy.md',
            hash: '0051ea95ba26ba608b752c2b57d56497d33bd72f',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/tutorial/07-share-code.md',
            hash: 'b6a50f5efd41d51450a2539dd9088d7e0537b844',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/tutorial/08-create-libs.md',
            hash: 'e3c2616d2afded0427fb2c4452f7e70681e994e3',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/tutorial/09-dep-graph.md',
            hash: '15c1af29c93627c69771bdc42ab368f99a1f1c3c',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/tutorial/10-computation-caching.md',
            hash: '9665bb583a4dadc04610c218be6969865eb4612c',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/tutorial/11-test-affected-projects.md',
            hash: 'e092ae1b41548245a4a03fe1afc6cc5334f41258',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/react/tutorial/12-summary.md',
            hash: '27eeb049059d64a8c9a894e4a89903c340e4ab1c',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/shared/affected.png',
            hash: '4437f9a8e397a98ea7d99b2d929be360a51313c8',
            ext: '.png',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/all-cache-inputs.png',
            hash: 'e7e5bd839e7ccb4acc4221dce66952db6cad85e1',
            ext: '.png',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/angular-plugin.md',
            hash: 'db1d1312c30a6dfa73d3f5674e30b9c5f2079ff9',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/shared/api/angular.jpg',
            hash: 'f03bf78a3bd15e5bfeb925922ad94c41e5203009',
            ext: '.jpg',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/shared/api/cypress.jpg',
            hash: '7727bf6d734549eeca678de9c870f3b4072698e5',
            ext: '.jpg',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/shared/api/express.jpg',
            hash: 'f55f7f0783d2ec9373b90e66be944eac48bb4bb8',
            ext: '.jpg',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/shared/api/jest.jpg',
            hash: 'd7ce915a2ad472df19f77de8437d7edc330d665c',
            ext: '.jpg',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/shared/api/nest.jpg',
            hash: '9e02b1e3dde3433378881993c520c9d65688a9ea',
            ext: '.jpg',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/shared/api/node.jpg',
            hash: '7003802217e825012068684547d7d5e30badd775',
            ext: '.jpg',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/shared/api/react.jpg',
            hash: 'e534bd5b242a8a5ed55c8d02851dd7c4d86ac3ba',
            ext: '.jpg',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/shared/api/web.jpg',
            hash: 'd92cea331c6bd8d4453e5311ca30b43c0a77fe0a',
            ext: '.jpg',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/caching-example.png',
            hash: '026252539a044e6b3312df9e6065d97c168f8f49',
            ext: '.png',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/ci-graph-everything-affected.png',
            hash: '95ea861c4ea747b8fad48d765b45384ce63f0223',
            ext: '.png',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/ci-graph-one-affected.png',
            hash: '1eb5a4c166942cd3b03be920b5b71959d2583359',
            ext: '.png',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/shared/ci-graph.png',
            hash: '94138839eac7b5de9928acb243ab9c5c22f378c3',
            ext: '.png',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/shared/cli/build.md',
            hash: '8a398ba7e32adf7dc0c39005b4b081b9a2070033',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/shared/cli/e2e.md',
            hash: '1fdb16dc1bb845214d8fb86074d9955074f53ad1',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/shared/cli/generate.md',
            hash: '033fcfd871d6cac1bed56b688d48d87a072292af',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/shared/cli/lint.md',
            hash: '19efd0e2af38aaa58ed144a10632755a6f37ffba',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/shared/cli/run.md',
            hash: '87df36051c3f52d5577a7f1c59424f6b9fd0b9d2',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/shared/cli/serve.md',
            hash: '6a87bc97767eb44b8e44b868a4f0b08c826378b4',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/shared/cli/test.md',
            hash: '84d7e9db8662dd4775f841ebd3a07d7743d0ad09',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/community-plugins.md',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/computation-caching.md',
            hash: 'ad15e517a8ad1e6305968800caf1495826a3f31f',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/shared/console.md',
            hash: '83ab9bcb0c30851a1b9881582ad4a99ff34ec004',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/continue-light.svg',
            hash: '2563bfa114bef1fefe582096bfd1095f44a4f6c4',
            ext: '.svg',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/cypress-logo.png',
            hash: '6553e4a03ef1554df37beca19e24c10a10c2c71a',
            ext: '.png',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/cypress-plugin.md',
            hash: '0e6ed455409a1b78c429841d24ca9e045c937dc0',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/dependency-graph.png',
            hash: '7c187112fb9f4b32b4ba88088638438ac9b97381',
            ext: '.png',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/distributed-builds.md',
            hash: '2788c8fd29deb4855cbd98af99a931f3d54c91ac',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/examples/nx-examples.md',
            hash: 'fc01b6336758215afb8dcbc13583aa4afa6a0a8b',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/express-plugin.md',
            hash: '997e2fbb7a959a238b792c5bcdc9adaf6f640520',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/folder-light.svg',
            hash: '8daecdac6a358b5d789ed6e6f02dee0b4c7a48c3',
            ext: '.svg',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/guides/browser-support.md',
            hash: '1dba1fbc7d3ae86715e7286fee104c0fa728d36b',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/incremental-builds.md',
            hash: 'dde79502493b83bcc6622d3058d0831fc6290fdb',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/shared/jest-logo.png',
            hash: 'ac0c0f5e4429a5ce6b6f1c66bf62040b36e5794c',
            ext: '.png',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/shared/jest-plugin.md',
            hash: 'a85dc68adbb057509173e5bd87f396b03e16ad77',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/migration-overview.md',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/migration/overview.md',
            hash: '36a7d1bf6bc9da5c0e3bc498a7ccd2bbe80fde4b',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/migration/preserving-git-histories.md',
            hash: '761db22841dff7992413668a32b2d5e1389ec439',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/modernize-prettier.md',
            hash: '9d0d9e7495e0da9623462ecdcee1e5e3749b2636',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/monorepo-affected.md',
            hash: '6ef0f1e58cfed5bf0150909aaf4894dc4734aea1',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/monorepo-ci-azure.md',
            hash: '464c20fa734b1188a30867f5e182227bcb9d1748',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/monorepo-ci-jenkins.md',
            hash: '3b31d0fc1958dc5d57bc7ef518972d193e02db2b',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/monorepo-dependency-diagrams.md',
            hash: 'e4201d66f704364a48fc5abfe128b87b6f59bd44',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/monorepo-nx-enterprise.md',
            hash: '96de8891ab891ede776014ee206ba91fd2117c35',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/monorepo-tags.md',
            hash: '0917384a44a7176a47ce5c0cd8b94a6b087cb80d',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/shared/nest-logo.png',
            hash: 'f1e27035310756193211911a74cdf39d4c6376b5',
            ext: '.png',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/shared/nest-plugin.md',
            hash: '091d39ce89f04190e99eb732bc04ad9e5dc81d7f',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/shared/next-plugin.md',
            hash: '9f16b4e0f7a82d0b223147740847525d006889a9',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/shared/node-plugin.md',
            hash: 'e57256327e2557f6bfed1c7d1a61f73590042f83',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/nx-console-logo.png',
            hash: '11d0c0758fd20321bdda24886f3fd573092fc5ac',
            ext: '.png',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/nx-console-screenshot.png',
            hash: '0a444ee0d5d93eac2c3f18f35ba2e91b3c4b4ff4',
            ext: '.png',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/shared/nx-plugin.md',
            hash: '3d45c48ebb7a67d23f43ad875e3723b9b0c86584',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/plugins-overview.md',
            hash: '3ea5f1fff7f9737696d965ed183f2864cc26240a',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/prettier-logo.png',
            hash: '59bb947f29431ccf142c1ed2f520aa747c38541a',
            ext: '.png',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/shared/react-plugin.md',
            hash: '3d45b88a7eb4d3e175d9c2ed649d87ffeed208b2',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/refresh-light.svg',
            hash: 'e0345748192eeb97633b33feb5cd8997a98c9edc',
            ext: '.svg',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/running-custom-commands.md',
            hash: '4ea8f7ce32ea03db8bff49bce1aae696de6ced67',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/storybook-logo.png',
            hash: '9201193134c0f94a842c4f929b9c23f62060e0d1',
            ext: '.png',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/tools-workspace-builders.md',
            hash: '5e47407ae2bef31a0a886efa7298f5f6503557ba',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/tools-workspace-generators.md',
            hash: '36a8e3fdd9166bebbc14220e92feb4e32f0d2f96',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/shared/update.md',
            hash: '702770be2f5802e9d46410d2a844af0a78a6d74a',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/using-builders.md',
            hash: 'b5cb842a23baa4454ad613edd0e6180d2275ef67',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/using-schematics.md',
            hash: 'cbef5bb9286199f1283191cc18babc1ca4f4b571',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/vscode-schematics-debug.png',
            hash: '57efd4b6c15012e816df353cd1bc33c08a189116',
            ext: '.png',
          },
          {
            file: 'apps/nx-docs-site/src/assets/content/shared/web-plugin.md',
            hash: 'fe698f59aae63d7deed27bb230ac3bf72aae0f20',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/workspace-overview.md',
            hash: 'bb9ec7c2f41ee2b74d665a393b04736cd98203b8',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/workspace-plugin.md',
            hash: '3529e62980033c3dfdd5af83ec3ef1afcd9c59d5',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/workspace/creating-libraries.md',
            hash: '3cd6c16c57ccdbab8b5ea4aaa75c2976e4a647a4',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/workspace/grouping-libraries.md',
            hash: 'c844995610063be710fd18e758c35e5feb290613',
            ext: '.md',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/content/shared/workspace/library-types.md',
            hash: '1182992056416592ef53c866da92e0bb37dcb222',
            ext: '.md',
          },
          {
            file: 'apps/nx-docs-site/src/assets/images/angular-logo.svg',
            hash: '421c23afef225dcfcbe7ff26b07a5038ea1f510c',
            ext: '.svg',
          },
          {
            file: 'apps/nx-docs-site/src/assets/images/background.svg',
            hash: 'c8627cabd98eb63ed837cdd10ffd4c3f7364cd51',
            ext: '.svg',
          },
          {
            file: 'apps/nx-docs-site/src/assets/images/clients/Accenture.png',
            hash: '991f2ce0a26636be1f9efb9ed3aeaecb08c8ddbf',
            ext: '.png',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/images/clients/AmericanAirlines.png',
            hash: '9c29a2290cceb1210cf55340d412e2ee2031bede',
            ext: '.png',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/images/clients/AmericanTireDistributors.png',
            hash: 'eb29deb182ef9c5f66f046c60156b86e9b4d3ca0',
            ext: '.png',
          },
          {
            file: 'apps/nx-docs-site/src/assets/images/clients/Anthem.png',
            hash: 'd7d1da75fecff798fa9941bedf6a8b36d4299d4c',
            ext: '.png',
          },
          {
            file: 'apps/nx-docs-site/src/assets/images/clients/Audi.png',
            hash: '28bd690c42c87ae799329ecd0a5f7561ebdb160e',
            ext: '.png',
          },
          {
            file: 'apps/nx-docs-site/src/assets/images/clients/BlackRock.png',
            hash: '95a62709ea8ea54ae34cef7b3ff543aeb75fe955',
            ext: '.png',
          },
          {
            file: 'apps/nx-docs-site/src/assets/images/clients/CapitalOne.png',
            hash: 'b08027835677221d87083625bc6eb1443aa987f2',
            ext: '.png',
          },
          {
            file: 'apps/nx-docs-site/src/assets/images/clients/Cigna.png',
            hash: '5cabf7bc82ca6df1df5fbb4f116d3834a2b5971c',
            ext: '.png',
          },
          {
            file: 'apps/nx-docs-site/src/assets/images/clients/Cisco.png',
            hash: '7d5af44c0e7446dd1b11a3fd2897aade7ac24624',
            ext: '.png',
          },
          {
            file: 'apps/nx-docs-site/src/assets/images/clients/Datasite.png',
            hash: '341fb9c18a9762a9de548331bc0c1670e258e599',
            ext: '.png',
          },
          {
            file: 'apps/nx-docs-site/src/assets/images/clients/FICO.png',
            hash: 'c151a8106809c897a3c788de9650f27e98242e7b',
            ext: '.png',
          },
          {
            file: 'apps/nx-docs-site/src/assets/images/clients/FedEx.png',
            hash: '7d1358779471c2fb534b4820a37c98a4a3073ccd',
            ext: '.png',
          },
          {
            file: 'apps/nx-docs-site/src/assets/images/clients/Fidelity.png',
            hash: 'c5aeba10c2ae85bcee42cf6955196736e1b89603',
            ext: '.png',
          },
          {
            file: 'apps/nx-docs-site/src/assets/images/clients/GM.png',
            hash: '6b47005493dcacd4b81b7a6e27f4f8851388c32c',
            ext: '.png',
          },
          {
            file: 'apps/nx-docs-site/src/assets/images/clients/Microsoft.png',
            hash: 'a7c9f9c6bd1fad77630710be44a141167a7af4a3',
            ext: '.png',
          },
          {
            file: 'apps/nx-docs-site/src/assets/images/clients/RedHat.png',
            hash: '8bd589e4c469cefd42e231254be3c91d76f4acfb',
            ext: '.png',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/images/clients/SatcomDirect.png',
            hash: 'dea10034c008e18eb736bc62fdddcbdfdd4f89cf',
            ext: '.png',
          },
          {
            file: 'apps/nx-docs-site/src/assets/images/clients/TMobile.png',
            hash: '049d34601bcdb4466b741026b8f5542642470cca',
            ext: '.png',
          },
          {
            file: 'apps/nx-docs-site/src/assets/images/clients/Viacom.png',
            hash: '8350fcb368964145a42c7b38b2b365522d0f1114',
            ext: '.png',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/images/favicon/android-chrome-192x192.png',
            hash: 'd8a682d4dd2235ed786cfe441677ea52aabcddfa',
            ext: '.png',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/images/favicon/android-chrome-512x512.png',
            hash: '4f7d0b265367cebbc29381872e4787ef33e22949',
            ext: '.png',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/images/favicon/apple-touch-icon.png',
            hash: '78dfd572d4d38e82098c0fe468c1010e4458475d',
            ext: '.png',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/images/favicon/favicon-16x16.png',
            hash: 'ea82d7c30d186a16ddeb752a994e5355e12b6543',
            ext: '.png',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/images/favicon/favicon-32x32.png',
            hash: 'a9e95b69b4c47c44c7305b071c1043a25e097773',
            ext: '.png',
          },
          {
            file: 'apps/nx-docs-site/src/assets/images/favicon/favicon.ico',
            hash: '317ebcb2336e0833a22dddf0ab287849f26fda57',
            ext: '.ico',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/images/favicon/mstile-150x150.png',
            hash: '7aad821ccd366d4bcfd0afc4a650456389c2a1de',
            ext: '.png',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/images/favicon/safari-pinned-tab.svg',
            hash: 'adfd97595eec598bf6863e07952c08c946384631',
            ext: '.svg',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/images/github-circle-white-transparent.svg',
            hash: '879760b67740a30900de215be67b088c7c17dbdc',
            ext: '.svg',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/images/illustrations/computation.svg',
            hash: '6c99ac9dbd624abaadada863be413489cbffd3f2',
            ext: '.svg',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/images/illustrations/develop-like-google.svg',
            hash: 'b9a27f62e5c6c0ab1c0e4c0f33263efe7b11d608',
            ext: '.svg',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/images/illustrations/full-stack.svg',
            hash: 'af722ca3ca554583215b57675c339da48979e725',
            ext: '.svg',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/images/illustrations/modern-tools.svg',
            hash: '36364c77bacbf523a5fdfd51a344008bf47668ac',
            ext: '.svg',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/images/illustrations/youtube-illustration.svg',
            hash: '891d87228c32aa8ef063b3f474e93c2738e86576',
            ext: '.svg',
          },
          {
            file: 'apps/nx-docs-site/src/assets/images/nrwl-logo-white.svg',
            hash: '54e17113569fad7f67fd7ebe87fdb07e69e6c8bc',
            ext: '.svg',
          },
          {
            file: 'apps/nx-docs-site/src/assets/images/nrwl-logo.svg',
            hash: '6cc026727fffc2a2bba626fbd16ef4d4f67b4133',
            ext: '.svg',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/images/nx-console-logo-white.svg',
            hash: 'fa6078c37461c6699fa3aab4b3539b533be9cbcd',
            ext: '.svg',
          },
          {
            file: 'apps/nx-docs-site/src/assets/images/nx-logo-white.svg',
            hash: '8fa84ab5092a65217b22dd0be03de5c6aea9a648',
            ext: '.svg',
          },
          {
            file: 'apps/nx-docs-site/src/assets/images/nx-logo.svg',
            hash: '3b2e5a98f522e147882ebc8fc56a7eb124b78eac',
            ext: '.svg',
          },
          {
            file: 'apps/nx-docs-site/src/assets/images/nx-media.jpg',
            hash: '7f7d61b6e3a7be3b8f6ced98941994d181352010',
            ext: '.jpg',
          },
          {
            file: 'apps/nx-docs-site/src/assets/images/react-logo.svg',
            hash: '359136ba6218edc5167e32570202598e39b3b774',
            ext: '.svg',
          },
          {
            file:
              'apps/nx-docs-site/src/assets/images/react-nx-book-banner.png',
            hash: '9a44499bd81678db8906dbd63e3011779159b230',
            ext: '.png',
          },
          {
            file: 'apps/nx-docs-site/src/assets/images/wave-bottom.svg',
            hash: 'df010a3f39835f714eb376d1a17ab48a9d84032b',
            ext: '.svg',
          },
          {
            file: 'apps/nx-docs-site/src/assets/images/wave-top.svg',
            hash: 'b917bba0685524574ed303baeb7392c7e0a4a785',
            ext: '.svg',
          },
          {
            file: 'apps/nx-docs-site/src/assets/images/web-components-logo.svg',
            hash: '0d83ff3cd60cb040a3e574b84d2b31470e18bcea',
            ext: '.svg',
          },
          {
            file: 'apps/nx-docs-site/src/environments/environment.prod.ts',
            hash: '4cd14e952cd4ee1a49e10f2cbc5a34915d8f5451',
            ext: '.ts',
          },
          {
            file: 'apps/nx-docs-site/src/environments/environment.ts',
            hash: '668b38d525f7dc5ffb033f09898b0ed98dd90a4e',
            ext: '.ts',
          },
          {
            file: 'apps/nx-docs-site/src/index.html',
            hash: '4c899e22754e9d7d386f0ab252d47c75d6619531',
            ext: '.html',
          },
          {
            file: 'apps/nx-docs-site/src/main.server.ts',
            hash: '10150a7181e8e79ea35e8ba8d0f74e1d4ce87eec',
            ext: '.ts',
          },
          {
            file: 'apps/nx-docs-site/src/main.ts',
            hash: '6fd7bcb52f88231499851dda21820e5493c5daac',
            ext: '.ts',
          },
          {
            file: 'apps/nx-docs-site/src/polyfills.ts',
            hash: 'b9a73c9af7be2808f18e6a7c2da71ca2118291eb',
            ext: '.ts',
          },
          {
            file: 'apps/nx-docs-site/src/site.webmanifest',
            hash: '04e378040135dd999b103a9116fca364164e8ead',
            ext: '.webmanifest',
          },
          {
            file: 'apps/nx-docs-site/src/sitemap.xml',
            hash: 'f09af4468b2286f969e7ec481287a3d14b9f59fb',
            ext: '.xml',
          },
          {
            file: 'apps/nx-docs-site/src/styles.scss',
            hash: '1b8fb769f956fc138e8b100ecf0b2ac3a627a31e',
            ext: '.scss',
          },
          {
            file: 'apps/nx-docs-site/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'apps/nx-docs-site/tsconfig.app.json',
            hash: '8fa747652bcfd866f33753f143c76e95ffab91ee',
            ext: '.json',
          },
          {
            file: 'apps/nx-docs-site/tsconfig.server.json',
            hash: '22913dbd1e3643e55a0f830295302b624f3b7f90',
            ext: '.json',
          },
          {
            file: 'apps/nx-docs-site/tsconfig.spec.json',
            hash: '3e1891070e95cdeda711f8f9bab05ca83d98cbff',
            ext: '.json',
          },
          {
            file: 'apps/nx-docs-site/tslint.json',
            hash: 'd4a8dd3d654b1abf354b65ca02143caf8206c8d6',
            ext: '.json',
          },
        ],
      },
    },
    'design-system': {
      name: 'design-system',
      type: 'app',
      data: {
        projectType: 'application',
        schematics: {
          '@schematics/angular:interceptor': {
            skipTests: true,
          },
          '@nrwl/angular:class': {
            skipTests: true,
          },
          '@nrwl/angular:component': {
            style: 'scss',
            skipTests: true,
          },
          '@nrwl/angular:directive': {
            skipTests: true,
          },
          '@nrwl/angular:guard': {
            skipTests: true,
          },
          '@nrwl/angular:module': {
            skipTests: true,
          },
          '@nrwl/angular:pipe': {
            skipTests: true,
          },
          '@nrwl/angular:service': {
            skipTests: true,
          },
        },
        root: 'apps/design-system',
        sourceRoot: 'apps/design-system/src',
        prefix: 'nrwl-ocean',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:browser',
            options: {
              outputPath: 'dist/apps/design-system',
              index: 'apps/design-system/src/index.html',
              main: 'apps/design-system/src/main.ts',
              polyfills: 'apps/design-system/src/polyfills.ts',
              tsConfig: 'apps/design-system/tsconfig.app.json',
              aot: true,
              assets: [
                'apps/design-system/src/favicon.png',
                'apps/design-system/src/assets',
              ],
              styles: ['apps/design-system/src/styles.scss'],
              stylePreprocessorOptions: {
                includePaths: [],
              },
              scripts: [],
            },
            configurations: {
              production: {
                fileReplacements: [
                  {
                    replace:
                      'apps/design-system/src/environments/environment.ts',
                    with:
                      'apps/design-system/src/environments/environment.prod.ts',
                  },
                ],
                optimization: true,
                outputHashing: 'all',
                sourceMap: false,
                extractCss: true,
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
            builder: '@angular-devkit/build-angular:dev-server',
            options: {
              browserTarget: 'design-system:build',
            },
            configurations: {
              production: {
                browserTarget: 'design-system:build:production',
              },
            },
          },
          'extract-i18n': {
            builder: '@angular-devkit/build-angular:extract-i18n',
            options: {
              browserTarget: 'design-system:build',
            },
          },
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'apps/design-system/tsconfig.app.json',
                'apps/design-system/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!apps/design-system/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'apps/design-system/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        tags: ['scope:design-system', 'type:ui'],
        files: [
          {
            file: 'apps/design-system/browserslist',
            hash: '80848532e47d58cc7a4b618f600b438960f9f045',
            ext: '',
          },
          {
            file: 'apps/design-system/jest.config.js',
            hash: '9c7ed217714a26b0ac30cb931216d511b1b476fd',
            ext: '.js',
          },
          {
            file: 'apps/design-system/src/app/app.component.html',
            hash: 'f155b7a5e8ca242d25d6c2dd1eabf75aa3342bca',
            ext: '.html',
          },
          {
            file: 'apps/design-system/src/app/app.component.scss',
            hash: '526b61a3bd121ede278ed4087ccc3f171eec3734',
            ext: '.scss',
          },
          {
            file: 'apps/design-system/src/app/app.component.ts',
            hash: '70cec6babf514a9b94b9b32aea26de83af614f0c',
            ext: '.ts',
          },
          {
            file: 'apps/design-system/src/app/app.module.ts',
            hash: 'cdd61b6dfc2814742894a990e4c869197069909a',
            ext: '.ts',
          },
          {
            file: 'apps/design-system/src/assets/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file: 'apps/design-system/src/environments/environment.prod.ts',
            hash: 'c9669790be176ac85a5d8c11278875c2f52dc507',
            ext: '.ts',
          },
          {
            file: 'apps/design-system/src/environments/environment.ts',
            hash: '99c3763cad6f4ae7808a34e2aa4e5b90232c67fc',
            ext: '.ts',
          },
          {
            file: 'apps/design-system/src/favicon.png',
            hash: '167ba824caebf3b339141090d485ef69f8b04521',
            ext: '.png',
          },
          {
            file: 'apps/design-system/src/index.html',
            hash: 'e90676ddaa7ee9563bed7c3be77642360cf0cc76',
            ext: '.html',
          },
          {
            file: 'apps/design-system/src/main.ts',
            hash: 'd9a2e7e4a582e265db779363bd8b2492c43c141b',
            ext: '.ts',
          },
          {
            file: 'apps/design-system/src/polyfills.ts',
            hash: 'e49856ec90d6bf3ac29646c3755138c502b44157',
            ext: '.ts',
          },
          {
            file: 'apps/design-system/src/styles.scss',
            hash: '9d65b8b954923bd51e4c835023d4eea48681f14f',
            ext: '.scss',
          },
          {
            file: 'apps/design-system/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'apps/design-system/tsconfig.app.json',
            hash: 'e9fa6dfd9387e0a5b362098d5d6542e952fdd831',
            ext: '.json',
          },
          {
            file: 'apps/design-system/tsconfig.json',
            hash: 'a9e8b688152d6cc1202f4ba34138046b86970445',
            ext: '.json',
          },
          {
            file: 'apps/design-system/tsconfig.spec.json',
            hash: 'cfff29a544fb49a8c26a7cbf9cd836c87efb7fe8',
            ext: '.json',
          },
          {
            file: 'apps/design-system/tslint.json',
            hash: '981ba44c49b6d0db643567d5dd0379e96520f428',
            ext: '.json',
          },
        ],
      },
    },
    'platform-e2e': {
      name: 'platform-e2e',
      type: 'e2e',
      data: {
        root: 'apps/platform-e2e',
        projectType: 'application',
        prefix: '',
        architect: {
          e2e: {
            builder: '@nrwl/cypress:cypress',
            options: {
              cypressConfig: 'apps/platform-e2e/cypress.json',
              tsConfig: 'apps/platform-e2e/tsconfig.e2e.json',
              devServerTarget: 'platform:serve',
            },
            configurations: {
              production: {
                devServerTarget: 'platform:serve:production',
              },
            },
          },
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: 'apps/platform-e2e/tsconfig.e2e.json',
              exclude: ['**/node_modules/**', '!apps/platform-e2e/**/*'],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'apps/platform-e2e/cypress.json',
            hash: 'e2543c8b497ee5d793eef819203fe9ac6c6f90d8',
            ext: '.json',
          },
          {
            file: 'apps/platform-e2e/src/fixtures/example.json',
            hash: '294cbed6ce9e0b948b787452e8676aee486cb3be',
            ext: '.json',
          },
          {
            file: 'apps/platform-e2e/src/integration/app.spec.ts',
            hash: '1c35f5cf09b351e24a4e9da63b9b1ab96db6af6c',
            ext: '.ts',
          },
          {
            file: 'apps/platform-e2e/src/plugins/index.js',
            hash: '465837c7948461d667fe3113033e91a99f648f8e',
            ext: '.js',
          },
          {
            file: 'apps/platform-e2e/src/support/commands.ts',
            hash: '0a17c8bd7c0faaef1e59c516366e236a8f9a0a48',
            ext: '.ts',
          },
          {
            file: 'apps/platform-e2e/src/support/index.ts',
            hash: '3d469a6b6cf31eb66117d73e278bcf74f398f1db',
            ext: '.ts',
          },
          {
            file: 'apps/platform-e2e/tsconfig.e2e.json',
            hash: '4ea0c844f3eaefb26dd1618b475930547522ca54',
            ext: '.json',
          },
          {
            file: 'apps/platform-e2e/tsconfig.json',
            hash: '296139b687d8852e439ef279a04539404768aa78',
            ext: '.json',
          },
        ],
      },
    },
    'nrwl-api-e2e': {
      name: 'nrwl-api-e2e',
      type: 'e2e',
      data: {
        root: 'apps/nrwl-api-e2e',
        sourceRoot: 'apps/nrwl-api/e2e/src',
        projectType: 'application',
        prefix: 'nrwl-api-e2e',
        schematics: {},
        architect: {
          e2e: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'apps/nrwl-api-e2e/jest.config.js',
              runInBand: true,
              passWithNoTests: true,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'apps/nrwl-api-e2e/control-data/cache-stats.ts',
            hash: '9d4f25c767c2230ba5791556bca1812c6c68ce4a',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api-e2e/control-data/coupons.ts',
            hash: '9b67cbc24d46edb79a164952a5414367e1f76f9d',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api-e2e/control-data/hashes.ts',
            hash: '14828e0b1073f64d307927349be2dd643d123c07',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api-e2e/control-data/identity.ts',
            hash: 'e44e41549af9175dad9353a9553efd288ef24f56',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api-e2e/control-data/index.ts',
            hash: '84fd541dff0ba74b0a537b9bd3e6e84c39746037',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api-e2e/control-data/organizations.ts',
            hash: '349a64ddeaca2375011f18f2e0d8e4d647c39fd5',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api-e2e/control-data/stats.ts',
            hash: '42cc203d99d90d83a74d9fab4d9f16282e364824',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api-e2e/control-data/users.ts',
            hash: '714e50f6e09e8b29d6cc59089aa827834e4ceea4',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api-e2e/control-data/utils.ts',
            hash: '109c54be58c27ffdbfe8139ba4b13e3332f2d7f8',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api-e2e/control-data/workspaces.ts',
            hash: '90d55c8b04b689a6337ee838c0510347c9e9b33c',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api-e2e/jest.config.js',
            hash: 'a7b2fcaef1ca334ec93d027d6151d52bc97f93e6',
            ext: '.js',
          },
          {
            file: 'apps/nrwl-api-e2e/scripts/add-coupons-to-workspaces.ts',
            hash: '39d9b573128b54ad6055a6b86802c4d3c5c6397e',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api-e2e/scripts/ensure-org-workspace.ts',
            hash: 'cc6d8749cfab0a86da560e94d79573335eb9d334',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api-e2e/scripts/generate-cache-data.ts',
            hash: '1b5d9d8e9fca9cad153a1138bb7654736071559f',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api-e2e/seed/data/access-tokens.json',
            hash: 'f9b801f4ea7de0a73a56f854ef97c8d824b989e6',
            ext: '.json',
          },
          {
            file: 'apps/nrwl-api-e2e/seed/data/cache-stats.json',
            hash: 'd60edd957202f938591a08546962433da447364c',
            ext: '.json',
          },
          {
            file: 'apps/nrwl-api-e2e/seed/data/cloud-organizations.json',
            hash: '81b867a47803c4c8f0d7fcf70b10ee6ada9cec21',
            ext: '.json',
          },
          {
            file: 'apps/nrwl-api-e2e/seed/data/coupons.json',
            hash: '08c520b105f5017df6cc62b096ea978b54d55796',
            ext: '.json',
          },
          {
            file: 'apps/nrwl-api-e2e/seed/data/hashes.json',
            hash: 'c68fc5113754413fc1836dc5651b417700b587c9',
            ext: '.json',
          },
          {
            file: 'apps/nrwl-api-e2e/seed/data/stats.json',
            hash: 'dc5c9ca1c8ba5ef80fdf0937700347b9e2f613ff',
            ext: '.json',
          },
          {
            file: 'apps/nrwl-api-e2e/seed/data/tasks.json',
            hash: 'c0dfb85163bca61353c9f09c6f5dbfff051e0ccf',
            ext: '.json',
          },
          {
            file: 'apps/nrwl-api-e2e/seed/data/users.json',
            hash: '7968a4c5b28c50492a7dd76d64adb20b33f178a7',
            ext: '.json',
          },
          {
            file: 'apps/nrwl-api-e2e/seed/data/workspaces.json',
            hash: 'ad166688dd6eccdce69a5e4cc5712c4217ae7730',
            ext: '.json',
          },
          {
            file: 'apps/nrwl-api-e2e/seed/seed.sh',
            hash: '1fe20d4bc0ea490bf5232475ddcde7b8efd9e04d',
            ext: '.sh',
          },
          {
            file: 'apps/nrwl-api-e2e/tests/access-token-mutations.spec.ts',
            hash: '3ea40c9ecbdd8e671dbd36be24bf1ffca267b2e2',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api-e2e/tests/cache.spec.ts',
            hash: '320f269c3dd6353113ca138416fd1e716a14c276',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api-e2e/tests/coupons.spec.ts',
            hash: 'efe8727dd32f357a4892c93be7a4c9b659578433',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api-e2e/tests/fins-similar-tasks.spec.ts',
            hash: '00caac9b1f3814b8b9eeb754140c1ad939cc759d',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api-e2e/tests/report-usage.spec.ts',
            hash: 'f78875a5aaa785ddac2e61fb65567948ac90a493',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api-e2e/tests/runs.spec.ts',
            hash: '3d2729f9fd29bf11795595aad013cced1182f90b',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api-e2e/tests/tasks.spec.ts',
            hash: '200b291007bb32d47794808172621be3b1964c20',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api-e2e/tests/usage.spec.ts',
            hash: '72f7ba25730d35defa3987e8aa31f3581f3c2977',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api-e2e/tests/utils.ts',
            hash: '9dfbe1ce6aeae4172144d54784d67185c8132843',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api-e2e/tests/validation.ts',
            hash: '9906ed30f7b5f191efa9fb8ac26c794e7916f07e',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api-e2e/tests/workspace-operations.spec.ts',
            hash: 'aa04e71ade4a8c7dd382357049828000926ee630',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api-e2e/tsconfig.app.json',
            hash: 'bb717c5e289e34da2907609b1535fbfdaf59ce31',
            ext: '.json',
          },
          {
            file: 'apps/nrwl-api-e2e/tsconfig.json',
            hash: '3409190cbf2c53b538b9d039b85c8f85d9486b09',
            ext: '.json',
          },
          {
            file: 'apps/nrwl-api-e2e/tsconfig.scripts.json',
            hash: 'f8c1302460515a17aea440097bd20f5e1bb0e050',
            ext: '.json',
          },
          {
            file: 'apps/nrwl-api-e2e/tsconfig.spec.json',
            hash: '4c4a06da8088f1802f2311a82745c26e97d9a856',
            ext: '.json',
          },
          {
            file: 'apps/nrwl-api-e2e/utils/create-client.ts',
            hash: 'c079cdf58c7e8be329a32905c571014a11020358',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api-e2e/utils/environment.ts',
            hash: '1a0e4e61db472688a360d765d10242896f7270db',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api-e2e/utils/request-promise.ts',
            hash: 'f2d890030bb773ba1be92c9613986b4df242ed88',
            ext: '.ts',
          },
        ],
      },
    },
    'nx-cloud-e2e': {
      name: 'nx-cloud-e2e',
      type: 'e2e',
      data: {
        root: 'apps/nx-cloud-e2e',
        sourceRoot: 'apps/nx-cloud-e2e/src',
        projectType: 'application',
        architect: {
          e2e: {
            outputs: ['/dist/out-tsc/apps/nx-cloud-e2e'],
            builder: '@nrwl/cypress:cypress',
            options: {
              cypressConfig: 'apps/nx-cloud-e2e/cypress.json',
              tsConfig: 'apps/nx-cloud-e2e/tsconfig.e2e.json',
              devServerTarget: 'nx-cloud:serve',
            },
            configurations: {
              production: {
                devServerTarget: 'nx-cloud:serve:production',
              },
            },
          },
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: 'apps/nx-cloud-e2e/tsconfig.e2e.json',
              exclude: ['!apps/nx-cloud-e2e/**/*'],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'apps/nx-cloud-e2e/cypress.json',
            hash: '4d965e9f4ec490755f346ff0f1d7160a603f17b1',
            ext: '.json',
          },
          {
            file: 'apps/nx-cloud-e2e/seed/data/access-tokens.json',
            hash: '09d0b7e036eb448b915ecbd5ea27f9c9c7d2e7b2',
            ext: '.json',
          },
          {
            file: 'apps/nx-cloud-e2e/seed/data/cloud-organizations.json',
            hash: '8b9047a9f49cd78dab2c9caf3190061ecdb5e94c',
            ext: '.json',
          },
          {
            file: 'apps/nx-cloud-e2e/seed/data/coupons.json',
            hash: '0e4fe0642281869256d1e5ef215ce52dd1b733b5',
            ext: '.json',
          },
          {
            file: 'apps/nx-cloud-e2e/seed/data/hashes.json',
            hash: '6a0fe429bd10800aa81f3c7003bd7ad97a9999be',
            ext: '.json',
          },
          {
            file: 'apps/nx-cloud-e2e/seed/data/runs.json',
            hash: 'a82b9ac7fa052ca0df55adf282a7c6204a872f14',
            ext: '.json',
          },
          {
            file: 'apps/nx-cloud-e2e/seed/data/stats.json',
            hash: 'ef5c2e908eec3e2669a957a497a71a12602e37d0',
            ext: '.json',
          },
          {
            file: 'apps/nx-cloud-e2e/seed/data/terminalOutputs.json',
            hash: '238d6abb8b94ddbfa427b157923b1853d57b68c3',
            ext: '.json',
          },
          {
            file: 'apps/nx-cloud-e2e/seed/data/users.json',
            hash: '74319acc859c48ab9eda915c069142f38e53018a',
            ext: '.json',
          },
          {
            file: 'apps/nx-cloud-e2e/seed/data/workspaces.json',
            hash: '4df4e3b823957d0eb1ca19e38c65cacbae632fec',
            ext: '.json',
          },
          {
            file: 'apps/nx-cloud-e2e/seed/seed.sh',
            hash: 'ff503cbe83b3ab19a43e2d76e05a56f193160b73',
            ext: '.sh',
          },
          {
            file: 'apps/nx-cloud-e2e/src/fixtures/example.json',
            hash: '294cbed6ce9e0b948b787452e8676aee486cb3be',
            ext: '.json',
          },
          {
            file: 'apps/nx-cloud-e2e/src/integration/invited-users.spec.ts',
            hash: 'bf8d01126e1df8c0272df1fe487f3b7976c26a96',
            ext: '.ts',
          },
          {
            file: 'apps/nx-cloud-e2e/src/integration/org-member.spec.ts',
            hash: 'b14c5f5f1da50aca7a5bcd1731d8a82e39424927',
            ext: '.ts',
          },
          {
            file: 'apps/nx-cloud-e2e/src/integration/pricing.spec.ts',
            hash: '69000eee27cde50970161eff46433ceac596e410',
            ext: '.ts',
          },
          {
            file: 'apps/nx-cloud-e2e/src/integration/run-details.spec.ts',
            hash: '98fddc4a92b2bd55823f18cdaf67d3128513c28d',
            ext: '.ts',
          },
          {
            file: 'apps/nx-cloud-e2e/src/integration/usage-stats.spec.ts',
            hash: '09a2263811d4f29bc592e39db106ed3f09460fc8',
            ext: '.ts',
          },
          {
            file:
              'apps/nx-cloud-e2e/src/integration/workspace-creation.spec.ts',
            hash: '00d2229e4528cc04da2ed1642315a52b5f1a41b4',
            ext: '.ts',
          },
          {
            file: 'apps/nx-cloud-e2e/src/plugins/index.js',
            hash: '1feebdfbd791ab41ac14f59d0d989d021300d817',
            ext: '.js',
          },
          {
            file: 'apps/nx-cloud-e2e/src/plugins/tasks/mongo.js',
            hash: '7c8ac9e12b27e78a35af30d24a28d6b6c7de2966',
            ext: '.js',
          },
          {
            file:
              'apps/nx-cloud-e2e/src/plugins/tasks/reset-unclaimed-workspace.js',
            hash: 'd90d8269de51960839eb422178341711e4ec7f4a',
            ext: '.js',
          },
          {
            file: 'apps/nx-cloud-e2e/src/support/app.po.ts',
            hash: '513fbf40b6d8e1d7e474483780ba23ac52c977bc',
            ext: '.ts',
          },
          {
            file: 'apps/nx-cloud-e2e/src/support/commands.ts',
            hash: 'e2c41bc454e9875f3d279822144775772d89b3c2',
            ext: '.ts',
          },
          {
            file: 'apps/nx-cloud-e2e/src/support/index.ts',
            hash: '3d469a6b6cf31eb66117d73e278bcf74f398f1db',
            ext: '.ts',
          },
          {
            file: 'apps/nx-cloud-e2e/tsconfig.e2e.json',
            hash: '364243f9151061cc3020cdd6b23e990efd78cc57',
            ext: '.json',
          },
          {
            file: 'apps/nx-cloud-e2e/tsconfig.json',
            hash: '6fb123308a99050ba96a7ae5704e56264b1a5e2b',
            ext: '.json',
          },
        ],
      },
    },
    'ui-downloads': {
      name: 'ui-downloads',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/ui/downloads',
        sourceRoot: 'libs/ui/downloads/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/ui/downloads/tsconfig.lib.json',
                'libs/ui/downloads/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/ui/downloads/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/ui/downloads/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['ui'],
        files: [
          {
            file: 'libs/ui/downloads/README.md',
            hash: '20db5976ac3fd8aa45a93846d4cde48a8294e85a',
            ext: '.md',
          },
          {
            file: 'libs/ui/downloads/jest.config.js',
            hash: 'eeb1d82488375011d578dc250d8aaf0b38e76f19',
            ext: '.js',
          },
          {
            file: 'libs/ui/downloads/src/index.ts',
            hash: 'c9955396f0a91330ce5f0f4a004a1277c802ebb2',
            ext: '.ts',
          },
          {
            file:
              'libs/ui/downloads/src/lib/download-primary/download-primary.component.html',
            hash: 'd98ff76965043f95e77dd3fb224c6c5dc6a46352',
            ext: '.html',
          },
          {
            file:
              'libs/ui/downloads/src/lib/download-primary/download-primary.component.scss',
            hash: '7333c270b20d7d4c9722410cbf4b53951aa719e8',
            ext: '.scss',
          },
          {
            file:
              'libs/ui/downloads/src/lib/download-primary/download-primary.component.ts',
            hash: 'b7bb3bd74a0b82bddd1d3c7857550886cc63851b',
            ext: '.ts',
          },
          {
            file: 'libs/ui/downloads/src/lib/ui-downloads.module.ts',
            hash: '11d3e1f134082b408f45d8838d4df3bfe83295f9',
            ext: '.ts',
          },
          {
            file: 'libs/ui/downloads/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/ui/downloads/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/ui/downloads/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/ui/downloads/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/ui/downloads/tslint.json',
            hash: '5ad9ba82222ce3bd10c035b49adc62c50f8a2ef8',
            ext: '.json',
          },
        ],
      },
    },
    'common-site': {
      name: 'common-site',
      type: 'lib',
      data: {
        root: 'libs/common-site',
        sourceRoot: 'libs/common-site/src',
        projectType: 'library',
        prefix: 'cws',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/common-site/tsconfig.lib.json',
                'libs/common-site/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/common-site/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/common-site/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/schematics:component': {
            styleext: 'scss',
          },
        },
        tags: ['common:site'],
        files: [
          {
            file: 'libs/common-site/jest.config.js',
            hash: '0a35e336c18b6226ddd2755920d4b4993676f836',
            ext: '.js',
          },
          {
            file: 'libs/common-site/src/index.ts',
            hash: '7f652aaf58d8cb1ba1863d9f4423bcf8daf4856b',
            ext: '.ts',
          },
          {
            file: 'libs/common-site/src/lib/common-site.module.ts',
            hash: 'fbcfc7bde0ef9a4ba5a6511d7b0007990a2b207e',
            ext: '.ts',
          },
          {
            file: 'libs/common-site/src/lib/page-meta.service.ts',
            hash: 'e14779f41733249f3a91e29fab305933b311916d',
            ext: '.ts',
          },
          {
            file: 'libs/common-site/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/common-site/tsconfig.json',
            hash: '58bd2c97a66f5e5ea5d05c8a5709ee79bad02094',
            ext: '.json',
          },
          {
            file: 'libs/common-site/tsconfig.lib.json',
            hash: '00df5d9878a33bf1b8ec0ab79a414797c9274911',
            ext: '.json',
          },
          {
            file: 'libs/common-site/tsconfig.spec.json',
            hash: '78134636e1f7d4d175e4468339c452eefd673297',
            ext: '.json',
          },
          {
            file: 'libs/common-site/tslint.json',
            hash: 'cd7d2279be15fe82f6e6cfe64f1491bbb68c0c1d',
            ext: '.json',
          },
        ],
      },
    },
    'ui-contents': {
      name: 'ui-contents',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/ui/contents',
        sourceRoot: 'libs/ui/contents/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/ui/contents/tsconfig.lib.json',
                'libs/ui/contents/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/ui/contents/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/ui/contents/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['type:ui'],
        files: [
          {
            file: 'libs/ui/contents/README.md',
            hash: 'ba97bb4826b2fa39bf0269a385f7a660333ce239',
            ext: '.md',
          },
          {
            file: 'libs/ui/contents/jest.config.js',
            hash: '2d36d01a4209a71d6a96bb83c81abc325add1f58',
            ext: '.js',
          },
          {
            file: 'libs/ui/contents/src/index.ts',
            hash: '13771c4b64c9a4f0c42ac924d61b3d94ffbea6da',
            ext: '.ts',
          },
          {
            file: 'libs/ui/contents/src/lib/call-to-action.model.ts',
            hash: 'fce253e8104258df2ffc734cd8eb3944b8862c70',
            ext: '.ts',
          },
          {
            file:
              'libs/ui/contents/src/lib/content-character/content-character.component.html',
            hash: '80392f3c5af6973f39bb8c5ec2e7a35f4e7ad97a',
            ext: '.html',
          },
          {
            file:
              'libs/ui/contents/src/lib/content-character/content-character.component.scss',
            hash: '2eec92134056c1fa5617b0bb055e1951e634c057',
            ext: '.scss',
          },
          {
            file:
              'libs/ui/contents/src/lib/content-character/content-character.component.ts',
            hash: '59e990e8887aeb6bc51354d0c0cf3fce3f097dd2',
            ext: '.ts',
          },
          {
            file:
              'libs/ui/contents/src/lib/content-media-two-columns/content-media-two-columns.component.html',
            hash: 'd7243b9d73623fdd482562211ee0be04b1748acf',
            ext: '.html',
          },
          {
            file:
              'libs/ui/contents/src/lib/content-media-two-columns/content-media-two-columns.component.scss',
            hash: 'd445003cb13eb076956fa15ccfcb6b4751ccfa8e',
            ext: '.scss',
          },
          {
            file:
              'libs/ui/contents/src/lib/content-media-two-columns/content-media-two-columns.component.ts',
            hash: 'cbaf20ac22878288f6758598b627b9e3f28dc55b',
            ext: '.ts',
          },
          {
            file:
              'libs/ui/contents/src/lib/content-small/content-small.component.html',
            hash: '9184c1c620ae4aab25e09a1c78d2b36f40e55ecb',
            ext: '.html',
          },
          {
            file:
              'libs/ui/contents/src/lib/content-small/content-small.component.scss',
            hash: 'e5f76334cbfea32b292e7e9b309ef3de841d3d20',
            ext: '.scss',
          },
          {
            file:
              'libs/ui/contents/src/lib/content-small/content-small.component.ts',
            hash: '22ccd79f88f81a9936d4bf78548945643945e448',
            ext: '.ts',
          },
          {
            file:
              'libs/ui/contents/src/lib/content-text-alone/content-text-alone.component.html',
            hash: '514e6cb2d1b9d0c84ff47a4f94d16543b43c45ba',
            ext: '.html',
          },
          {
            file:
              'libs/ui/contents/src/lib/content-text-alone/content-text-alone.component.scss',
            hash: 'b558a3827c94fc9d978762ee9e7cb741d8514362',
            ext: '.scss',
          },
          {
            file:
              'libs/ui/contents/src/lib/content-text-alone/content-text-alone.component.ts',
            hash: '8dace60ec0bf41556bf13341b1a5de90946da84e',
            ext: '.ts',
          },
          {
            file:
              'libs/ui/contents/src/lib/content-text-centered-title/content-text-centered-title.component.html',
            hash: '3411ade648fdd940649aeb807d32565ef509b3a4',
            ext: '.html',
          },
          {
            file:
              'libs/ui/contents/src/lib/content-text-centered-title/content-text-centered-title.component.scss',
            hash: 'e48033a930072c157b521a97d2de25ca0d0c3081',
            ext: '.scss',
          },
          {
            file:
              'libs/ui/contents/src/lib/content-text-centered-title/content-text-centered-title.component.ts',
            hash: '54421a75afcf3ad6f5067557befa519d0b0d3b66',
            ext: '.ts',
          },
          {
            file:
              'libs/ui/contents/src/lib/content-title-alone/content-title-alone.component.html',
            hash: 'fc1b471ee7314242c59ad7aea974fb31dcedf003',
            ext: '.html',
          },
          {
            file:
              'libs/ui/contents/src/lib/content-title-alone/content-title-alone.component.scss',
            hash: '00f041938f58b355649e25a372f42127147c8fa4',
            ext: '.scss',
          },
          {
            file:
              'libs/ui/contents/src/lib/content-title-alone/content-title-alone.component.ts',
            hash: '92702f1bc3e7448f97216c2816a0edd39a6d5cc1',
            ext: '.ts',
          },
          {
            file:
              'libs/ui/contents/src/lib/content-wide-card/content-wide-card.component.html',
            hash: '9184c1c620ae4aab25e09a1c78d2b36f40e55ecb',
            ext: '.html',
          },
          {
            file:
              'libs/ui/contents/src/lib/content-wide-card/content-wide-card.component.scss',
            hash: '30d8f1a86285153c8b847adf6116e26bee3ee76f',
            ext: '.scss',
          },
          {
            file:
              'libs/ui/contents/src/lib/content-wide-card/content-wide-card.component.ts',
            hash: 'e38a03d7a89eb3966df23d5a6ff7545093a83055',
            ext: '.ts',
          },
          {
            file:
              'libs/ui/contents/src/lib/content-wide/content-wide.component.html',
            hash: '3b341e0542261cc09aa15b5a39e697a2b56bb9be',
            ext: '.html',
          },
          {
            file:
              'libs/ui/contents/src/lib/content-wide/content-wide.component.scss',
            hash: 'e0a5e2f0b8a583d4f1073c2e0f9c37542f9c69c0',
            ext: '.scss',
          },
          {
            file:
              'libs/ui/contents/src/lib/content-wide/content-wide.component.ts',
            hash: '7692840868be95ff7b05efbc92cb9fec36c667e9',
            ext: '.ts',
          },
          {
            file: 'libs/ui/contents/src/lib/ui-contents.module.ts',
            hash: 'b16613636bd6f8af715d8bd3aa888ec4816233b6',
            ext: '.ts',
          },
          {
            file: 'libs/ui/contents/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/ui/contents/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/ui/contents/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/ui/contents/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/ui/contents/tslint.json',
            hash: '5ad9ba82222ce3bd10c035b49adc62c50f8a2ef8',
            ext: '.json',
          },
        ],
      },
    },
    'ui-features': {
      name: 'ui-features',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/ui/features',
        sourceRoot: 'libs/ui/features/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/ui/features/tsconfig.lib.json',
                'libs/ui/features/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/ui/features/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/ui/features/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['ui'],
        files: [
          {
            file: 'libs/ui/features/README.md',
            hash: 'd151f62b11a5523ea528331153ecfdd0031550a0',
            ext: '.md',
          },
          {
            file: 'libs/ui/features/jest.config.js',
            hash: '7f397db440eabbf039cfb8afaee6b81f0854a0d5',
            ext: '.js',
          },
          {
            file: 'libs/ui/features/src/index.ts',
            hash: '705d39753d9f7e8ba93c842e66636fcfac7b363b',
            ext: '.ts',
          },
          {
            file:
              'libs/ui/features/src/lib/feature-item/feature-item.component.ts',
            hash: '22d785331e375dbc0c647f0c92de3b0b0ee2ede5',
            ext: '.ts',
          },
          {
            file:
              'libs/ui/features/src/lib/feature-primary/feature-primary.component.html',
            hash: 'a24449a69dace854c34b56d93afd18bb5c3ba465',
            ext: '.html',
          },
          {
            file:
              'libs/ui/features/src/lib/feature-primary/feature-primary.component.ts',
            hash: 'bcdfea91fb806fc3d804daf4cb45b6ebc9eb6677',
            ext: '.ts',
          },
          {
            file:
              'libs/ui/features/src/lib/feature-primary/feature-primary.components.scss',
            hash: '64bc453354eaaa5a4284b9b5c6e1265f17ad0348',
            ext: '.scss',
          },
          {
            file: 'libs/ui/features/src/lib/ui-features.module.ts',
            hash: 'a9b397af3fb3b480096eddfbd6121cc373b4d9a1',
            ext: '.ts',
          },
          {
            file: 'libs/ui/features/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/ui/features/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/ui/features/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/ui/features/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/ui/features/tslint.json',
            hash: '5ad9ba82222ce3bd10c035b49adc62c50f8a2ef8',
            ext: '.json',
          },
        ],
      },
    },
    'ui-articles': {
      name: 'ui-articles',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/ui/articles',
        sourceRoot: 'libs/ui/articles/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/ui/articles/tsconfig.lib.json',
                'libs/ui/articles/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/ui/articles/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/ui/articles/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['ui'],
        files: [
          {
            file: 'libs/ui/articles/README.md',
            hash: '8a2478a14d17bfa6166a62ab519639962ac44995',
            ext: '.md',
          },
          {
            file: 'libs/ui/articles/jest.config.js',
            hash: '3c6217ee6c2177684f4a08cb17e363ede9ff06a8',
            ext: '.js',
          },
          {
            file: 'libs/ui/articles/src/index.ts',
            hash: '71b2ccaa51c9cd944b88a7dbb7c1caf6bb4cd16f',
            ext: '.ts',
          },
          {
            file:
              'libs/ui/articles/src/lib/article-primary/article-primary.component.html',
            hash: 'c34ace7d2a2505b32475925d6b7fe6f2f63ed9ad',
            ext: '.html',
          },
          {
            file:
              'libs/ui/articles/src/lib/article-primary/article-primary.component.scss',
            hash: 'cf91f5de1df01f0c7b4881479fb3e48e0913fc05',
            ext: '.scss',
          },
          {
            file:
              'libs/ui/articles/src/lib/article-primary/article-primary.component.ts',
            hash: '0aa2408fcfe2b9808a3dd2231e800033c2de449a',
            ext: '.ts',
          },
          {
            file: 'libs/ui/articles/src/lib/ui-articles.module.ts',
            hash: '3a419c986774c8f73c7ce32b7f456444055751b1',
            ext: '.ts',
          },
          {
            file: 'libs/ui/articles/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/ui/articles/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/ui/articles/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/ui/articles/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/ui/articles/tslint.json',
            hash: '5ad9ba82222ce3bd10c035b49adc62c50f8a2ef8',
            ext: '.json',
          },
        ],
      },
    },
    'ui-callouts': {
      name: 'ui-callouts',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/ui/callouts',
        sourceRoot: 'libs/ui/callouts/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/ui/callouts/tsconfig.lib.json',
                'libs/ui/callouts/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/ui/callouts/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/ui/callouts/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['ui'],
        files: [
          {
            file: 'libs/ui/callouts/README.md',
            hash: 'ad9127621a169d82bf536be58b6d44f64399022e',
            ext: '.md',
          },
          {
            file: 'libs/ui/callouts/jest.config.js',
            hash: '7c492243c56d0650c784016c6abe3e1b5f0cc1ab',
            ext: '.js',
          },
          {
            file: 'libs/ui/callouts/src/index.ts',
            hash: '5c2dc08aab9e2ddb7b6d683455dc50275e0c53c7',
            ext: '.ts',
          },
          {
            file: 'libs/ui/callouts/src/lib/call-to-action.model.ts',
            hash: '2d66972eb6a9eeb45b3cadc9c594d87f3f5a5786',
            ext: '.ts',
          },
          {
            file:
              'libs/ui/callouts/src/lib/callouts-section/callouts-section.component.scss',
            hash: '6812c7080bdc44e2b2cf33518547a2a6b7aeb4fc',
            ext: '.scss',
          },
          {
            file:
              'libs/ui/callouts/src/lib/callouts-section/callouts-section.component.ts',
            hash: 'f728b1a6bfcb9edfb132126828891cc50f43eb90',
            ext: '.ts',
          },
          {
            file: 'libs/ui/callouts/src/lib/ui-callouts.module.ts',
            hash: 'acc391c97289c84d3b974671ff82e5189ce3c2c2',
            ext: '.ts',
          },
          {
            file: 'libs/ui/callouts/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/ui/callouts/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/ui/callouts/tsconfig.lib.json',
            hash: '2dc9b2ccd7b7f5860be847ee69b9945d7bfb3ee8',
            ext: '.json',
          },
          {
            file: 'libs/ui/callouts/tsconfig.lib.prod.json',
            hash: 'cbae794224800aec4b08c87a37135e334265908e',
            ext: '.json',
          },
          {
            file: 'libs/ui/callouts/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/ui/callouts/tslint.json',
            hash: '143d8f8c807de3537ca857b77c3141ba6425e4b5',
            ext: '.json',
          },
        ],
      },
    },
    'file-server': {
      name: 'file-server',
      type: 'app',
      data: {
        root: 'apps/file-server',
        sourceRoot: 'apps/file-server/src',
        projectType: 'application',
        prefix: 'file-server',
        schematics: {},
        architect: {
          build: {
            builder: '@nrwl/node:build',
            options: {
              outputPath: 'dist/apps/file-server',
              main: 'apps/file-server/src/main.ts',
              tsConfig: 'apps/file-server/tsconfig.app.json',
              assets: ['apps/file-server/src/assets'],
            },
            configurations: {
              production: {
                optimization: true,
                extractLicenses: true,
                inspect: false,
                fileReplacements: [
                  {
                    replace: 'apps/file-server/src/environments/environment.ts',
                    with:
                      'apps/file-server/src/environments/environment.prod.ts',
                  },
                ],
              },
            },
          },
          serve: {
            builder: '@nrwl/node:execute',
            options: {
              buildTarget: 'file-server:build',
            },
          },
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'apps/file-server/tsconfig.app.json',
                'apps/file-server/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!apps/file-server/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'apps/file-server/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'apps/file-server/jest.config.js',
            hash: 'c1c13d3de759b7d280ad56610e92db3901a2fb75',
            ext: '.js',
          },
          {
            file: 'apps/file-server/src/app/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file: 'apps/file-server/src/app/server.spec.ts',
            hash: 'ce68a8a7978a01ded1e690b08cf2546afb702480',
            ext: '.ts',
          },
          {
            file: 'apps/file-server/src/app/server.ts',
            hash: '78d3f4fe2fed284dd6814b9b84a6d5cf6278339b',
            ext: '.ts',
          },
          {
            file: 'apps/file-server/src/assets/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file: 'apps/file-server/src/environments/environment.prod.ts',
            hash: 'c9669790be176ac85a5d8c11278875c2f52dc507',
            ext: '.ts',
          },
          {
            file: 'apps/file-server/src/environments/environment.ts',
            hash: 'a20cfe55731540eac839ab33f9ce1eaa6da50b16',
            ext: '.ts',
          },
          {
            file: 'apps/file-server/src/main.ts',
            hash: '28cbc6f11e8fcb435bbe199615bedc1c50132f91',
            ext: '.ts',
          },
          {
            file: 'apps/file-server/tsconfig.app.json',
            hash: 'bb717c5e289e34da2907609b1535fbfdaf59ce31',
            ext: '.json',
          },
          {
            file: 'apps/file-server/tsconfig.json',
            hash: '3409190cbf2c53b538b9d039b85c8f85d9486b09',
            ext: '.json',
          },
          {
            file: 'apps/file-server/tsconfig.spec.json',
            hash: '4c4a06da8088f1802f2311a82745c26e97d9a856',
            ext: '.json',
          },
          {
            file: 'apps/file-server/tslint.json',
            hash: '905c5d5e0adc870dfe21afa692cfa2fcdadf8ced',
            ext: '.json',
          },
        ],
      },
    },
    'cloud-proxy': {
      name: 'cloud-proxy',
      type: 'app',
      data: {
        root: 'apps/cloud-proxy',
        sourceRoot: 'apps/cloud-proxy/src',
        projectType: 'application',
        prefix: 'cloud-proxy',
        schematics: {},
        architect: {
          build: {
            builder: '@nrwl/node:build',
            options: {
              outputPath: 'dist/apps/cloud-proxy',
              main: 'apps/cloud-proxy/src/main.ts',
              tsConfig: 'apps/cloud-proxy/tsconfig.app.json',
              assets: ['apps/cloud-proxy/src/assets'],
            },
            configurations: {
              production: {
                optimization: true,
                extractLicenses: true,
                inspect: false,
                externalDependencies: 'none',
                fileReplacements: [
                  {
                    replace: 'apps/cloud-proxy/src/environments/environment.ts',
                    with:
                      'apps/cloud-proxy/src/environments/environment.prod.ts',
                  },
                ],
              },
            },
          },
          serve: {
            builder: '@nrwl/node:execute',
            options: {
              buildTarget: 'cloud-proxy:build',
            },
          },
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'apps/cloud-proxy/tsconfig.app.json',
                'apps/cloud-proxy/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!apps/cloud-proxy/**/*'],
            },
          },
          'base-test': {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'apps/cloud-proxy/jest.config.js',
              passWithNoTests: true,
            },
          },
          test: {
            builder: '@nrwl/workspace:run-commands',
            options: {
              command: 'nx base-test cloud-proxy',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'apps/cloud-proxy/jest.config.js',
            hash: '616fcbce7d854a22e1fbbeabc3818ae35d8e5fef',
            ext: '.js',
          },
          {
            file: 'apps/cloud-proxy/src/app/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file: 'apps/cloud-proxy/src/app/server.spec.ts',
            hash: 'eaa7a8b15b94dd981243b4efc81d1465c269d2a4',
            ext: '.ts',
          },
          {
            file: 'apps/cloud-proxy/src/app/server.ts',
            hash: '1360403e7cad8251fc24c378cb24a8e66b2b0972',
            ext: '.ts',
          },
          {
            file: 'apps/cloud-proxy/src/assets/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file: 'apps/cloud-proxy/src/environments/environment.prod.ts',
            hash: 'c9669790be176ac85a5d8c11278875c2f52dc507',
            ext: '.ts',
          },
          {
            file: 'apps/cloud-proxy/src/environments/environment.ts',
            hash: 'a20cfe55731540eac839ab33f9ce1eaa6da50b16',
            ext: '.ts',
          },
          {
            file: 'apps/cloud-proxy/src/main.ts',
            hash: 'f35f4c46012a84f6cf38c565cee0ff8eb398acef',
            ext: '.ts',
          },
          {
            file: 'apps/cloud-proxy/tsconfig.app.json',
            hash: 'bb717c5e289e34da2907609b1535fbfdaf59ce31',
            ext: '.json',
          },
          {
            file: 'apps/cloud-proxy/tsconfig.json',
            hash: '3409190cbf2c53b538b9d039b85c8f85d9486b09',
            ext: '.json',
          },
          {
            file: 'apps/cloud-proxy/tsconfig.spec.json',
            hash: '4c4a06da8088f1802f2311a82745c26e97d9a856',
            ext: '.json',
          },
          {
            file: 'apps/cloud-proxy/tslint.json',
            hash: '905c5d5e0adc870dfe21afa692cfa2fcdadf8ced',
            ext: '.json',
          },
        ],
      },
    },
    'nrwlio-e2e': {
      name: 'nrwlio-e2e',
      type: 'e2e',
      data: {
        root: 'apps/nrwlio-e2e',
        sourceRoot: 'apps/nrwlio-e2e/src',
        projectType: 'application',
        architect: {
          e2e: {
            builder: '@nrwl/cypress:cypress',
            outputs: ['/dist/out-tsc/apps/nrwlio-e2e'],
            options: {
              cypressConfig: 'apps/nrwlio-e2e/cypress.json',
              tsConfig: 'apps/nrwlio-e2e/tsconfig.e2e.json',
              devServerTarget: 'nrwlio:serve',
            },
            configurations: {
              production: {
                devServerTarget: 'nrwlio:serve:production',
              },
            },
          },
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: 'apps/nrwlio-e2e/tsconfig.e2e.json',
              exclude: ['!apps/nrwlio-e2e/**/*'],
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'apps/nrwlio-e2e/cypress.json',
            hash: '14088c7b8a9e40b4c722e6ae68740909023079d1',
            ext: '.json',
          },
          {
            file: 'apps/nrwlio-e2e/src/fixtures/example.json',
            hash: '294cbed6ce9e0b948b787452e8676aee486cb3be',
            ext: '.json',
          },
          {
            file: 'apps/nrwlio-e2e/src/integration/app.spec.ts',
            hash: 'f699a57ef595fb7f5d95b19afd599506cf052ca2',
            ext: '.ts',
          },
          {
            file: 'apps/nrwlio-e2e/src/plugins/index.js',
            hash: '77087ae0f53e2e66328bd1473338f890a25c9fbe',
            ext: '.js',
          },
          {
            file: 'apps/nrwlio-e2e/src/support/app.po.ts',
            hash: '701f6304bf382df7ac0b2a119b73bd7da009c770',
            ext: '.ts',
          },
          {
            file: 'apps/nrwlio-e2e/src/support/commands.ts',
            hash: 'ca4d256f3eb15dfabad1f5760c9b2d0ceb4c24b9',
            ext: '.ts',
          },
          {
            file: 'apps/nrwlio-e2e/src/support/index.ts',
            hash: '3d469a6b6cf31eb66117d73e278bcf74f398f1db',
            ext: '.ts',
          },
          {
            file: 'apps/nrwlio-e2e/tsconfig.e2e.json',
            hash: '629b4c1cc0aa89944b14f310982bc73441dabeb8',
            ext: '.json',
          },
          {
            file: 'apps/nrwlio-e2e/tsconfig.json',
            hash: 'fa46a2aec4fb94d5cc37d2425cc08da8fb27cb2c',
            ext: '.json',
          },
        ],
      },
    },
    'ui-banners': {
      name: 'ui-banners',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/ui/banners',
        sourceRoot: 'libs/ui/banners/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/ui/banners/tsconfig.lib.json',
                'libs/ui/banners/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/ui/banners/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/ui/banners/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['ui'],
        files: [
          {
            file: 'libs/ui/banners/README.md',
            hash: '6b70ca0c225233ffcb602dc7e0475e2e4d2b7fe7',
            ext: '.md',
          },
          {
            file: 'libs/ui/banners/jest.config.js',
            hash: '02ce0607192c0118d548d82c5971843d9b789575',
            ext: '.js',
          },
          {
            file: 'libs/ui/banners/src/index.ts',
            hash: 'ac03559d1936b1ce5de2f63ef2191d3e98cc4c97',
            ext: '.ts',
          },
          {
            file:
              'libs/ui/banners/src/lib/banner-primary/banner-primary.component.scss',
            hash: '9d30e6a1e389bce36af1a0c1b496d0948d0971ea',
            ext: '.scss',
          },
          {
            file:
              'libs/ui/banners/src/lib/banner-primary/banner-primary.component.ts',
            hash: 'ed94af64471421c123e236cb3c5fa6f9bf0dd11b',
            ext: '.ts',
          },
          {
            file: 'libs/ui/banners/src/lib/ui-banners.module.ts',
            hash: 'fedbfcfd1d3fb182d176cd753ab53c175b1d9595',
            ext: '.ts',
          },
          {
            file: 'libs/ui/banners/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/ui/banners/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/ui/banners/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/ui/banners/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/ui/banners/tslint.json',
            hash: '5708d7147ddece6af5375119e6cc1a3a9032fb77',
            ext: '.json',
          },
        ],
      },
    },
    platform: {
      name: 'platform',
      type: 'app',
      data: {
        root: 'apps/platform/',
        sourceRoot: 'apps/platform/src',
        projectType: 'application',
        schematics: {
          '@schematics/angular:component': {
            styleext: 'scss',
          },
        },
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:browser',
            options: {
              outputPath: 'dist/apps/platform',
              index: 'apps/platform/src/app.html',
              main: 'apps/platform/src/main.ts',
              tsConfig: 'apps/platform/tsconfig.app.json',
              polyfills: 'apps/platform/src/polyfills.ts',
              assets: [
                'apps/platform/src/assets',
                'apps/platform/src/favicon.ico',
                'apps/platform/src/index.html',
              ],
              styles: [
                'libs/shared/ui-markdown/src/assets/prism.css',
                'apps/platform/src/styles.scss',
              ],
              stylePreprocessorOptions: {
                includePaths: ['libs/platform/scss-utils'],
              },
              scripts: [
                './node_modules/prismjs/prism.js',
                './node_modules/prismjs/plugins/toolbar/prism-toolbar.min.js',
                './node_modules/prismjs/plugins/copy-to-clipboard/prism-copy-to-clipboard.min.js',
                './node_modules/prismjs/components/prism-typescript.js',
                './node_modules/prismjs/components/prism-bash.js',
                'libs/shared/ui-markdown/src/assets/prism.plugins.js',
              ],
            },
            configurations: {
              production: {
                optimization: true,
                outputHashing: 'all',
                sourceMap: false,
                extractCss: true,
                namedChunks: false,
                aot: true,
                extractLicenses: true,
                vendorChunk: false,
                buildOptimizer: true,
                fileReplacements: [
                  {
                    replace: 'apps/platform/src/environments/environment.ts',
                    with: 'apps/platform/src/environments/environment.prod.ts',
                  },
                ],
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
            builder: '@angular-devkit/build-angular:dev-server',
            options: {
              browserTarget: 'platform:build',
              port: 4201,
            },
            configurations: {
              production: {
                browserTarget: 'platform:build:production',
              },
            },
          },
          'extract-i18n': {
            builder: '@angular-devkit/build-angular:extract-i18n',
            options: {
              browserTarget: 'platform:build',
            },
          },
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'apps/platform/tsconfig.app.json',
                'apps/platform/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!apps/platform/**'],
            },
          },
        },
        prefix: 'nrwl-connect',
        tags: [],
        files: [
          {
            file: 'apps/platform/browserslist',
            hash: 'd8e64613b86258bc00dff52b5b49bf6b83b624b0',
            ext: '',
          },
          {
            file: 'apps/platform/karma.conf.js',
            hash: '5d69423bd2e824e8491b2944bf48a995fb8e159b',
            ext: '.js',
          },
          {
            file: 'apps/platform/src/app.html',
            hash: '43dc3ac229211776baaa9a525574a052797e07cf',
            ext: '.html',
          },
          {
            file: 'apps/platform/src/app/app.component.html',
            hash: '451be02187b1e23e7089223a2575735a27723087',
            ext: '.html',
          },
          {
            file: 'apps/platform/src/app/app.component.scss',
            hash: '526e592980b7600a1924f541afb23ff5eb97a737',
            ext: '.scss',
          },
          {
            file: 'apps/platform/src/app/app.component.ts',
            hash: '38fd77f752aebd20171e897d1d03d999c21a3ae2',
            ext: '.ts',
          },
          {
            file: 'apps/platform/src/app/app.module.ts',
            hash: '88e61df69a8bd1fa749ce4061be620e9bf03a1b6',
            ext: '.ts',
          },
          {
            file: 'apps/platform/src/app/organization.guard.ts',
            hash: 'af1f9effe857f94ca19637f84424aa8651f9c434',
            ext: '.ts',
          },
          {
            file: 'apps/platform/src/assets/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file: 'apps/platform/src/assets/books/effective-react-with-nx.epub',
            hash: '05949c38671f786c1c54855903621bcc10bc7aea',
            ext: '.epub',
          },
          {
            file:
              'apps/platform/src/assets/books/enterprise-angular-monorepo-patterns.epub',
            hash: '965208645ca2eab3878975db94525907f2ba5b5a',
            ext: '.epub',
          },
          {
            file:
              'apps/platform/src/assets/books/enterprise-angular-monorepo-patterns.pdf',
            hash: 'c08702d62a3939fdbaa1735695a446b9a4088912',
            ext: '.pdf',
          },
          {
            file: 'apps/platform/src/assets/books/essential_angular.epub',
            hash: '7c45ae511b094971ceacabffa9fdef2da2269780',
            ext: '.epub',
          },
          {
            file: 'apps/platform/src/assets/books/essential_angular.pdf',
            hash: 'd27295f9e285b0394ef1742e83160b3db92f960b',
            ext: '.pdf',
          },
          {
            file: 'apps/platform/src/assets/books/ngupgrade.epub',
            hash: 'd971b8a584475327cbaea6750abd2058c6ec4183',
            ext: '.epub',
          },
          {
            file: 'apps/platform/src/assets/books/ngupgrade.pdf',
            hash: '709438694a53b19cb2437b3c518597a41f8447c9',
            ext: '.pdf',
          },
          {
            file: 'apps/platform/src/assets/books/router.epub',
            hash: '1c1e2044f08f45acae265bfebf46e2b27d48dec7',
            ext: '.epub',
          },
          {
            file: 'apps/platform/src/assets/books/router.pdf',
            hash: 'c4ce96851c4ec6f78a3dcf0032d581b72f3806c8',
            ext: '.pdf',
          },
          {
            file: 'apps/platform/src/assets/css/styles.css',
            hash: 'a14a559289f24f038c47c199fc8d0e421e498f1d',
            ext: '.css',
          },
          {
            file: 'apps/platform/src/assets/html/auth-success.html',
            hash: 'bdd14d8ad67237c261752e41e275ba181b99292f',
            ext: '.html',
          },
          {
            file: 'apps/platform/src/assets/img/CONNECT_ColorIcon.png',
            hash: '63e4a903635d05976ccfee2cab229168133af4c3',
            ext: '.png',
          },
          {
            file: 'apps/platform/src/assets/img/CONNECT_ColorLockup@2x.png',
            hash: '3316037a8fed80fb89c083f2d7f7e4c2b09d7673',
            ext: '.png',
          },
          {
            file: 'apps/platform/src/assets/img/CONNECT_ColorStandalone@2x.png',
            hash: '81e935f40e7e2a554ff2b1b91f31ded1b9adfb9a',
            ext: '.png',
          },
          {
            file:
              'apps/platform/src/assets/img/CONNECT_ColorTypeIconLockup.png',
            hash: 'e72e8eb15b745df72c0ec11bf402bdfa622ab6e5',
            ext: '.png',
          },
          {
            file: 'apps/platform/src/assets/img/GitHub-Icon.png',
            hash: 'ea6ff545a246caa64074ba809bbc86fcb8589071',
            ext: '.png',
          },
          {
            file: 'apps/platform/src/assets/img/LinkedIn-Icon.png',
            hash: '4b3bd5f50971f60a7fa47648e13013787c1e464a',
            ext: '.png',
          },
          {
            file: 'apps/platform/src/assets/img/Medium-Monogram.png',
            hash: '8ff3fb659ad66840678d714954fe9e7c8b23fa03',
            ext: '.png',
          },
          {
            file:
              'apps/platform/src/assets/img/Twitter_Social_Icon_Circle_Color.png',
            hash: 'af44ca5d502e7841fada40eeeefc200d151dc246',
            ext: '.png',
          },
          {
            file: 'apps/platform/src/assets/img/angular-console-icon.png',
            hash: '8a6a0fae4b5170749fb9bd83800a4c312a0b4b25',
            ext: '.png',
          },
          {
            file: 'apps/platform/src/assets/img/button-arrow.svg',
            hash: '259f649fb077b702f863d00735b67e2c0a195e90',
            ext: '.svg',
          },
          {
            file: 'apps/platform/src/assets/img/connect_feature_books.jpg',
            hash: '9cb79af7527c7494e610ad8261e20531b8263521',
            ext: '.jpg',
          },
          {
            file:
              'apps/platform/src/assets/img/connect_feature_content_recs.jpg',
            hash: 'cb197af16fb730e024d62a737526e10377778b4b',
            ext: '.jpg',
          },
          {
            file: 'apps/platform/src/assets/img/connect_feature_courses.jpg',
            hash: '9f241441a9de49b4fed601f69fcaf1d90600fd5b',
            ext: '.jpg',
          },
          {
            file:
              'apps/platform/src/assets/img/connect_feature_live_events.jpg',
            hash: '4466e05788f6421445041464d1252b716fc830e3',
            ext: '.jpg',
          },
          {
            file: 'apps/platform/src/assets/img/connect_feature_recipes.jpg',
            hash: '09a06591a70a420907ff308d4a88bb0439eb1aaa',
            ext: '.jpg',
          },
          {
            file: 'apps/platform/src/assets/img/connect_feature_topics.jpg',
            hash: '2d0f3499dabd90bdf466f8c0e917573ff94f1393',
            ext: '.jpg',
          },
          {
            file: 'apps/platform/src/assets/img/logo_footer_2x.png',
            hash: '4d4e2bc7a0c0ee4919a73a6f3f8cb055d1e3c025',
            ext: '.png',
          },
          {
            file: 'apps/platform/src/assets/img/nrwl-connect-logo.png',
            hash: '43fea143cc2ae276f3c7636efe79505e41deac29',
            ext: '.png',
          },
          {
            file: 'apps/platform/src/assets/img/nrwl-connect-social-card.png',
            hash: 'd22596868b34d0e8e0af04d9d2fd8a1fd5330ed2',
            ext: '.png',
          },
          {
            file:
              'apps/platform/src/assets/img/undraw_connecting_teams3_1pgn.svg',
            hash: '7154533c58a59c18f2df3527c7c2a48de7586ce9',
            ext: '.svg',
          },
          {
            file:
              'apps/platform/src/assets/img/undraw_developer_activity_bv83.svg',
            hash: '5f02492c7ed46e3adb24acfdfeb4f4573a492b15',
            ext: '.svg',
          },
          {
            file: 'apps/platform/src/assets/img/undraw_graduation_9x4i.svg',
            hash: '1c30a60842ab49da883999c6cdb3849803fbc2cf',
            ext: '.svg',
          },
          {
            file:
              'apps/platform/src/assets/img/undraw_live_collaboration_2r4y.svg',
            hash: '301484d6b40deb9bdcda14d0ed68048331102ba9',
            ext: '.svg',
          },
          {
            file: 'apps/platform/src/assets/img/undraw_mobile_testing_reah.svg',
            hash: '3a0aca35d5ce8f7e8bcda78d66825bd7c8959170',
            ext: '.svg',
          },
          {
            file: 'apps/platform/src/assets/img/undraw_setup_wizard_r6mr.svg',
            hash: '1417eda4931fd0ccec65b484cb6445a7ceca6b61',
            ext: '.svg',
          },
          {
            file:
              'apps/platform/src/assets/img/undraw_youtube_tutorial_2gn3.svg',
            hash: '5aa9783a3164825df64a40ac48ec51bfcea231ab',
            ext: '.svg',
          },
          {
            file: 'apps/platform/src/assets/topics/pwa-background.png',
            hash: '0ec30f6d00e059677e8cf9ae87e2537ccd2ed8b8',
            ext: '.png',
          },
          {
            file: 'apps/platform/src/environments/environment.prod.ts',
            hash: 'c9669790be176ac85a5d8c11278875c2f52dc507',
            ext: '.ts',
          },
          {
            file: 'apps/platform/src/environments/environment.ts',
            hash: 'cf6bba0df389cc9e7e473f2629910d225734df49',
            ext: '.ts',
          },
          {
            file: 'apps/platform/src/favicon.ico',
            hash: '167ba824caebf3b339141090d485ef69f8b04521',
            ext: '.ico',
          },
          {
            file: 'apps/platform/src/index.html',
            hash: '3e8cf58acecb2c229e970763d353b07214c3fe15',
            ext: '.html',
          },
          {
            file: 'apps/platform/src/main.ts',
            hash: '741c9eb862fed45d5440272daae7a40101bfe50f',
            ext: '.ts',
          },
          {
            file: 'apps/platform/src/polyfills.ts',
            hash: '781b979ffe6f629979e87a7115d264bd86bcfc91',
            ext: '.ts',
          },
          {
            file: 'apps/platform/src/styles.scss',
            hash: '9f8dc43f7ff8bb0d3c0add05e36c7376c8640d77',
            ext: '.scss',
          },
          {
            file: 'apps/platform/src/test.ts',
            hash: '1445e84859c18efe8a3b8e568d520a199de88928',
            ext: '.ts',
          },
          {
            file: 'apps/platform/tsconfig.app.json',
            hash: 'e9da6e18e032cddce9cc179ca43bc2e4a87bee12',
            ext: '.json',
          },
          {
            file: 'apps/platform/tsconfig.json',
            hash: '0809b8bdb479fab5db55f3ca835a74cab6149c57',
            ext: '.json',
          },
          {
            file: 'apps/platform/tsconfig.spec.json',
            hash: 'f635798081c610195981605d780fbca96f5f5423',
            ext: '.json',
          },
          {
            file: 'apps/platform/tslint.json',
            hash: '41c22f6e4f6bd04ae41c500231965d8ccfa1ee17',
            ext: '.json',
          },
        ],
      },
    },
    'ui-images': {
      name: 'ui-images',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/ui/images',
        sourceRoot: 'libs/ui/images/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/ui/images/tsconfig.lib.json',
                'libs/ui/images/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/ui/images/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/ui/images/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['type:ui'],
        files: [
          {
            file: 'libs/ui/images/README.md',
            hash: 'a8f8e8e820d127a181908744d77bd483b299fee2',
            ext: '.md',
          },
          {
            file: 'libs/ui/images/jest.config.js',
            hash: 'e342ce8170bda6799c169b82a90a657ac9ca7515',
            ext: '.js',
          },
          {
            file: 'libs/ui/images/src/index.ts',
            hash: '0fc09f92b22e25db5b9f723afc5e472694c22932',
            ext: '.ts',
          },
          {
            file: 'libs/ui/images/src/lib/image/image.component.ts',
            hash: 'd2c30bc4fe944da24f2b93b58c6c89a79825156b',
            ext: '.ts',
          },
          {
            file: 'libs/ui/images/src/lib/ui-images.module.ts',
            hash: '2968818cd9ba81d1b870cca4d47e133a38bd359c',
            ext: '.ts',
          },
          {
            file: 'libs/ui/images/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/ui/images/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/ui/images/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/ui/images/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/ui/images/tslint.json',
            hash: '5ad9ba82222ce3bd10c035b49adc62c50f8a2ef8',
            ext: '.json',
          },
        ],
      },
    },
    'ui-styles': {
      name: 'ui-styles',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/ui/styles',
        sourceRoot: 'libs/ui/styles/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/ui/styles/tsconfig.lib.json',
                'libs/ui/styles/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/ui/styles/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/ui/styles/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['type:ui'],
        files: [
          {
            file: 'libs/ui/styles/README.md',
            hash: '7034adf566234995fc5dbe5ac393419556332f56',
            ext: '.md',
          },
          {
            file: 'libs/ui/styles/jest.config.js',
            hash: 'd730a86b42a9e9ab6353c1dde29876866ad699de',
            ext: '.js',
          },
          {
            file: 'libs/ui/styles/src/index.ts',
            hash: '8c6d1db169c3629c8d0dc9289a43506c3161628d',
            ext: '.ts',
          },
          {
            file: 'libs/ui/styles/src/lib/ui-mixins.scss',
            hash: 'd37c814072f5fd4cee5f72ae7112a1021e61fd40',
            ext: '.scss',
          },
          {
            file: 'libs/ui/styles/src/lib/ui-styles.ts',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.ts',
          },
          {
            file: 'libs/ui/styles/src/lib/ui-variables.scss',
            hash: 'a5cf08c4e4a599e4e82f7b747c9eb9821ffd0c0b',
            ext: '.scss',
          },
          {
            file: 'libs/ui/styles/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/ui/styles/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/ui/styles/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/ui/styles/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/ui/styles/tslint.json',
            hash: '5ad9ba82222ce3bd10c035b49adc62c50f8a2ef8',
            ext: '.json',
          },
        ],
      },
    },
    'nrwl-api': {
      name: 'nrwl-api',
      type: 'app',
      data: {
        root: 'apps/nrwl-api',
        sourceRoot: 'apps/nrwl-api/src',
        projectType: 'application',
        prefix: 'nrwl-api',
        schematics: {},
        architect: {
          child: {
            builder: '@nrwl/workspace:run-commands',
            options: {
              command: 'echo CHILD',
            },
          },
          parent: {
            builder: '@nrwl/workspace:run-commands',
            options: {
              commands: ['nx child nrwl-api --skip-nx-cache', 'echo PARENT'],
            },
          },
          build: {
            builder: '@nrwl/node:build',
            options: {
              outputPath: 'dist/apps/nrwl-api',
              main: 'apps/nrwl-api/src/main.ts',
              tsConfig: 'apps/nrwl-api/tsconfig.app.json',
              externalDependencies: 'all',
              assets: ['apps/nrwl-api/src/assets'],
              buildLibsFromSource: true,
            },
            configurations: {
              production: {
                optimization: true,
                extractLicenses: true,
                inspect: false,
                externalDependencies: 'none',
                fileReplacements: [
                  {
                    replace: 'apps/nrwl-api/src/environments/environment.ts',
                    with: 'apps/nrwl-api/src/environments/environment.prod.ts',
                  },
                ],
              },
            },
          },
          serve: {
            builder: '@nrwl/node:execute',
            options: {
              buildTarget: 'nrwl-api:build',
            },
          },
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'apps/nrwl-api/tsconfig.app.json',
                'apps/nrwl-api/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!apps/nrwl-api/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'apps/nrwl-api/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'apps/nrwl-api/Dockerfile',
            hash: '3b6a99a46862dccbb333cf92826bae98eae9d02b',
            ext: '',
          },
          {
            file: 'apps/nrwl-api/jest.config.js',
            hash: 'a7b2fcaef1ca334ec93d027d6151d52bc97f93e6',
            ext: '.js',
          },
          {
            file: 'apps/nrwl-api/seed/data/access-tokens.json',
            hash: 'f9b801f4ea7de0a73a56f854ef97c8d824b989e6',
            ext: '.json',
          },
          {
            file: 'apps/nrwl-api/seed/data/cloud-organizations.json',
            hash: 'd86982effd437d459cdae6a2b6d3f3736c767c7f',
            ext: '.json',
          },
          {
            file: 'apps/nrwl-api/seed/data/coupons.json',
            hash: '1623bfad950fb26b021a1fd1da426b1f062d409a',
            ext: '.json',
          },
          {
            file: 'apps/nrwl-api/seed/data/hashes.json',
            hash: '4639734d413eb44d36bee834b5ed43999c639537',
            ext: '.json',
          },
          {
            file: 'apps/nrwl-api/seed/data/stats.json',
            hash: 'c50e865551578d0d3cbd1c9ba5f86a0d30743cac',
            ext: '.json',
          },
          {
            file: 'apps/nrwl-api/seed/data/users.json',
            hash: '40b45939f52cf15ec4adc066f96d302e35de39f1',
            ext: '.json',
          },
          {
            file: 'apps/nrwl-api/seed/data/workspaces.json',
            hash: 'ad166688dd6eccdce69a5e4cc5712c4217ae7730',
            ext: '.json',
          },
          {
            file: 'apps/nrwl-api/seed/remove-aggregate-collections.js',
            hash: '0ca811da99a3ef526c3291e4baf16e7ac351fb14',
            ext: '.js',
          },
          {
            file: 'apps/nrwl-api/seed/seed.sh',
            hash: '2fdac6a5a3fa990743187d3164f2e561e1549014',
            ext: '.sh',
          },
          {
            file:
              'apps/nrwl-api/src/app/aggregation/aggregate-billing-usage.ts',
            hash: '94b56111907deac30b083d51db650607935bc92f',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/aggregation/aggregate-job.ts',
            hash: 'd1aa79335326884770c5f4bea7d716495378ab4e',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/aggregation/aggregate-usage.ts',
            hash: '3b494e1410660a9645439bda0cf6a777c222ae51',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/aggregation/logging.ts',
            hash: '9101f8c77135131e95c09d180f40adcbb328a563',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/auth0/parse-id-token.ts',
            hash: 'e87438300e06e9ff3ea76167cbe25edec9ba3306',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/auth0/request-promise.ts',
            hash: '8554a93490a2801a3f320e3f3ff2367f6e5fa385',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/auth0/user.ts',
            hash: '191534f2bce145507006c1e3cc9f3a39c97adcb0',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/billing/coupons/entity.ts',
            hash: '48644566fb86cf1590ab5e76b4758872d139fd44',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/billing/coupons/index.ts',
            hash: '3f913268baaa05010b92b55f7349016b5ae0c308',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/billing/coupons/logging.ts',
            hash: '7a13d7cca54601e4b7f90b604807b40aa8a0c87a',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/billing/coupons/query.ts',
            hash: '438c2d8c979271cafac9f81b5385f99cdd61a4a1',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/billing/coupons/renew.spec.ts',
            hash: '36557695f77b5dd7ce06eeb4745c4865e271b0d6',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/billing/coupons/renew.ts',
            hash: '31d87b692968885a1079baac74cd4996e9f902b7',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/billing/coupons/report-usage.ts',
            hash: 'f8ddc76f4ffbedece286f7aeb769eb8e98588d84',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/billing/coupons/sign.ts',
            hash: '016719d51dae4b1de522b7b33adbd36bf70882f1',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/billing/index.ts',
            hash: '653e7f6d95894db1b7c63bbcce1a07b7f86a7c4e',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/billing/logging.ts',
            hash: 'a85b8da722bbbd8e16947defc0d12227f6d3746c',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/billing/report-usage.ts',
            hash: '7069f5d6db3069c5c9f7d7ae94cb6a705d642980',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/billing/stripe/cancel-subscription.ts',
            hash: 'e5d3752c1a1a3d285c73085b2e7a1305de700f6b',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/billing/stripe/client.ts',
            hash: 'b771770916afee14f088676c0fc80591c69f009e',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/billing/stripe/create-subscription.ts',
            hash: 'dce8e2a7f1934ec5e7830c20d1989a2902f73a70',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/billing/stripe/index.ts',
            hash: '2d33c5d314626cb3eca8d69a1e2f39b7dd52d61d',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/billing/stripe/report-usage.ts',
            hash: '8a6583b0386e85715c4febf1dfa156f80e5e03dc',
            ext: '.ts',
          },
          {
            file:
              'apps/nrwl-api/src/app/billing/stripe/subscription-pausing.ts',
            hash: '9d0219b1578c32442ad7952f046303d0c376e59f',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/billing/stripe/update-customer.ts',
            hash: 'fa2f270f2d610d9a81b64eb1666f8104d8a7a5f8',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/billing/types.ts',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/billing/workspace.ts',
            hash: '9fdc9fec5cc3562326709285cac2b7f0f746a57a',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/context.ts',
            hash: '6f6e8a0ce2169417dc138c1266c224b9de0c3686',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/environment.ts',
            hash: '1a0e4e61db472688a360d765d10242896f7270db',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/errors.ts',
            hash: '20c5809096fecf348fc1bb531f374c1f07d18327',
            ext: '.ts',
          },
          {
            file:
              'apps/nrwl-api/src/app/graphql/mutations/access-token.mutation.ts',
            hash: '7f11da37a56ca5cd257ca22375d5e934b3244229',
            ext: '.ts',
          },
          {
            file:
              'apps/nrwl-api/src/app/graphql/mutations/aggregate.muation.ts',
            hash: 'ea8188a4e34ea7855935cf5ce24a274d4ca3dde9',
            ext: '.ts',
          },
          {
            file:
              'apps/nrwl-api/src/app/graphql/mutations/basic-auth.mutations.ts',
            hash: '8d2ac9a07597c8f55e539255d183a410f4f81c85',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/graphql/mutations/billing.mutation.ts',
            hash: '1ffea050288e203bff3603a5058744db5a67621f',
            ext: '.ts',
          },
          {
            file:
              'apps/nrwl-api/src/app/graphql/mutations/connect-workspace-using-token.mutation.ts',
            hash: 'ac35dbe70e1ba9b11a45f1dca6f0306f370f4bce',
            ext: '.ts',
          },
          {
            file:
              'apps/nrwl-api/src/app/graphql/mutations/create-test-user.mutation.ts',
            hash: '482bfdf228f653c6856df7447a2bc2372d9c2872',
            ext: '.ts',
          },
          {
            file:
              'apps/nrwl-api/src/app/graphql/mutations/invite-members/accept-invite.mutation.ts',
            hash: '93512388e5d629c1237fb6e898e666521128eaf6',
            ext: '.ts',
          },
          {
            file:
              'apps/nrwl-api/src/app/graphql/mutations/invite-members/invite-member.mutation.ts',
            hash: '3a54ff0a5ec648f5e9afbc64d682ee57d5620aba',
            ext: '.ts',
          },
          {
            file:
              'apps/nrwl-api/src/app/graphql/mutations/invite-members/mongo-utils.ts',
            hash: '95fb1c239f75f551ff51ae74f8863fa17600af44',
            ext: '.ts',
          },
          {
            file:
              'apps/nrwl-api/src/app/graphql/mutations/invite-members/send-email.ts',
            hash: 'ef562c60bc20ae1cdddd8000f44b03582da841d7',
            ext: '.ts',
          },
          {
            file:
              'apps/nrwl-api/src/app/graphql/mutations/issue-coupon.mutation.ts',
            hash: 'eb6d6a782e5998361bcff784960117d007853eb8',
            ext: '.ts',
          },
          {
            file:
              'apps/nrwl-api/src/app/graphql/mutations/organization.mutation.ts',
            hash: '5306412222c197458b65e768dd6c61ce424f1704',
            ext: '.ts',
          },
          {
            file:
              'apps/nrwl-api/src/app/graphql/mutations/redeem-coupon.mutation.ts',
            hash: 'dd41525f612609375bd94132a1c107c92b55503f',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/graphql/mutations/sign-up.mutation.ts',
            hash: '5259034bd124bf1fb7073359e75a74c074bfa90c',
            ext: '.ts',
          },
          {
            file:
              'apps/nrwl-api/src/app/graphql/mutations/verify-email.mutation.ts',
            hash: '73a5f68470402ed5d0faeb9853e1082a8712de2d',
            ext: '.ts',
          },
          {
            file:
              'apps/nrwl-api/src/app/graphql/mutations/workspace.mutations.ts',
            hash: '19fa704182afa347d5f52e84fca78ccd329f2860',
            ext: '.ts',
          },
          {
            file:
              'apps/nrwl-api/src/app/graphql/nx-cloud-graphql.interfaces.ts',
            hash: '16a550dbb1dd2b25d35a86d885666241a146e165',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/graphql/permissions-helpers.ts',
            hash: '1eacfb66a33b30a0634c909aaecf980112f50012',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/graphql/permissions.ts',
            hash: '8987394ff627fb372a432bb9ca21902bdccf963b',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/graphql/query/access-token-queries.ts',
            hash: '30bf61cbc6a90977af9c8dd31605872cd3e88745',
            ext: '.ts',
          },
          {
            file:
              'apps/nrwl-api/src/app/graphql/query/aggregate-run-queries.ts',
            hash: '599b0b0b1e4d41c80d62df80116eae122aae2822',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/graphql/query/billing.ts',
            hash: 'd7ae73c5cfb8e8b0392c1b9ba384a7579b14f3e3',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/graphql/query/cloud-organization.ts',
            hash: '780618f8b8612878d021ff3dd8e947d85ddc06f9',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/graphql/query/coupons-query.ts',
            hash: '4b1052ed36b3fa1d8228f4c1ef980e690c310b18',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/graphql/query/current-user.ts',
            hash: 'f8a81c1d4850450360987a8694e16361cbc50edb',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/graphql/query/hashes-queries.ts',
            hash: 'd3a4de42d04b9fdf553ffcd2ce19c042ae641723',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/graphql/query/near-misses.ts',
            hash: 'ee9802621a4c7042ee88ea4a335c709cb8cae230',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/graphql/query/single-run.ts',
            hash: '497bdd6b5c04b08b90867396bb3fa1dbfcea3e4c',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/graphql/query/terminal-output.ts',
            hash: '2039ef847757d4fac83805f991e784227e06fbee',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/graphql/query/usage-by-project.ts',
            hash: 'fce1d3338703064944642ebc13010ae9158484d5',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/graphql/query/usage.ts',
            hash: 'd9334abccf41471f6ed801eacf8bcb9671ce2ee4',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/graphql/query/users-by-email.ts',
            hash: 'bd2488bf8d5066ec80ce96bdc23ac6bd16656a34',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/graphql/query/workspace-queries.ts',
            hash: 'd7a091e8cf55f9f1cf9ed2f13d3ffc1c14f45f65',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/graphql/resolvers.ts',
            hash: 'faa1ea0d111511b7dcea818859fba12519eee222',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/graphql/utils.ts',
            hash: 'd2d610e2cd82652928f9f0acbca6b8991d3561ed',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/middleware/check-jwt.ts',
            hash: 'a5826f95e2ffa9838c7a0bc4b72ee97a42054da7',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/middleware/error-handler.ts',
            hash: 'c5176b36e32c897bdbe4acd382cbe94b1270280d',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/middleware/user-middleware.ts',
            hash: '9a3910dcdcb1c6a4398af148557a1785e5730c1d',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/middleware/validate.ts',
            hash: 'c555269de9fd71c38dfa903137ad308c1f38da11',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/mongo-entity.interfaces.ts',
            hash: '0430ec8b0875ada495e5a8109d4de27780bb85ab',
            ext: '.ts',
          },
          {
            file:
              'apps/nrwl-api/src/app/nx-integration-handlers/cache-handlers.ts',
            hash: 'f1c4eab915f84375c587a3624d5bfab399cc0f94',
            ext: '.ts',
          },
          {
            file:
              'apps/nrwl-api/src/app/nx-integration-handlers/cache-stats-repo.ts',
            hash: 'a1b11ad2adc42cd360d59004708397023d35347b',
            ext: '.ts',
          },
          {
            file:
              'apps/nrwl-api/src/app/nx-integration-handlers/create-org-and-workspace-handler.ts',
            hash: 'e88580c310974f410fa8b28d9d28c6832f9b32cb',
            ext: '.ts',
          },
          {
            file:
              'apps/nrwl-api/src/app/nx-integration-handlers/find-similar-tasks-handler.spec.ts',
            hash: 'd9df53d0a93e3143cb06722642d6a9a8bbeef557',
            ext: '.ts',
          },
          {
            file:
              'apps/nrwl-api/src/app/nx-integration-handlers/find-similar-tasks-handler.ts',
            hash: '2c40429aa8c46c11588c306319bd02dc61b58d74',
            ext: '.ts',
          },
          {
            file:
              'apps/nrwl-api/src/app/nx-integration-handlers/get-workspace-using-access-token.ts',
            hash: '3a452a20cdb921ced616d83bea82fe7b388a6d3f',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/nx-integration-handlers/logging.ts',
            hash: '2e31ae5dd76ef840deaa62f4f601f74a414a2c50',
            ext: '.ts',
          },
          {
            file:
              'apps/nrwl-api/src/app/nx-integration-handlers/runs-handlers.ts',
            hash: 'f38099ec1d5c231dfd8d8fdb408f7953e477ed8e',
            ext: '.ts',
          },
          {
            file:
              'apps/nrwl-api/src/app/nx-integration-handlers/task-handlers.ts',
            hash: '70c4788dcffb000242b65d4c73920ba5f4df3006',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/nx-integration-handlers/types.ts',
            hash: 'e971f162010c21a41cd4bf01344579b086ac8d02',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/nx-integration-handlers/utils.ts',
            hash: 'b129e5de922592ffe9c9396a01f5140a8bc07c53',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/queue/job.ts',
            hash: 'ac2e35be6d136954bf885a5ef2cc942275010b2d',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/queue/jobs.ts',
            hash: '144fb684d8088c847b33aea291adf965bc3b7045',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/queue/logging.ts',
            hash: '11becc0169d4e91d1d9830ddbf184fd255b2f53a',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/queue/process-job.ts',
            hash: '1fc8db279481b475ffda38bacab0641cefe24994',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/queue/queue.ts',
            hash: 'f6ed90156491398a5b28ba9ce0e7afc711e87513',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/queue/redis.ts',
            hash: '74bfd9b491e71c8b3ddb702e58bd0c63c7a5b48a',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/schema.graphql',
            hash: '4e53ec62de605110e6ddbcc1a58b4706be8e4f83',
            ext: '.graphql',
          },
          {
            file: 'apps/nrwl-api/src/app/utils/email/client.ts',
            hash: '51fe8ab3aba30747b350a61810aaccf14a24548d',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/app/utils/encryption.ts',
            hash: '43258c49f121171874f2b9831d80924a3d9e3b3e',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/assets/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file: 'apps/nrwl-api/src/init/aggregate-job-init.ts',
            hash: '7863821e22f5afb2786e8e2bcbeb569c29e582f0',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/init/api-init.ts',
            hash: '0ea7e54047e9eca478790a8775932cdf65aeb6fd',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/init/create-external-capabilities.ts',
            hash: 'ed05cad29d1d40fcf025b317bb53ad102b5f6577',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/init/create-graphql-server.ts',
            hash: 'e7244195d681246beab12b26513440ace8ad431f',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/init/publish-stats.ts',
            hash: '82ed4997dde580558a24ee3b467965150432c415',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/logging.ts',
            hash: 'af22e6c6d90c7d932a577cfa730ae7feadb6226f',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/src/main.ts',
            hash: '1c4103b28a4c70fdd1d9356d9031efc680706d25',
            ext: '.ts',
          },
          {
            file: 'apps/nrwl-api/tsconfig.app.json',
            hash: 'bb717c5e289e34da2907609b1535fbfdaf59ce31',
            ext: '.json',
          },
          {
            file: 'apps/nrwl-api/tsconfig.json',
            hash: '3409190cbf2c53b538b9d039b85c8f85d9486b09',
            ext: '.json',
          },
          {
            file: 'apps/nrwl-api/tsconfig.scripts.json',
            hash: 'f8c1302460515a17aea440097bd20f5e1bb0e050',
            ext: '.json',
          },
          {
            file: 'apps/nrwl-api/tsconfig.spec.json',
            hash: '4c4a06da8088f1802f2311a82745c26e97d9a856',
            ext: '.json',
          },
          {
            file: 'apps/nrwl-api/tslint.json',
            hash: '41c22f6e4f6bd04ae41c500231965d8ccfa1ee17',
            ext: '.json',
          },
        ],
      },
    },
    'nx-cloud': {
      name: 'nx-cloud',
      type: 'app',
      data: {
        projectType: 'application',
        schematics: {
          '@nrwl/workspace:component': {
            style: 'scss',
          },
        },
        root: 'apps/nx-cloud',
        sourceRoot: 'apps/nx-cloud/src',
        prefix: 'nrwl-ocean',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:browser',
            options: {
              outputPath: 'dist/apps/nx-cloud/browser',
              index: 'apps/nx-cloud/src/index.html',
              main: 'apps/nx-cloud/src/main.ts',
              polyfills: 'apps/nx-cloud/src/polyfills.ts',
              tsConfig: 'apps/nx-cloud/tsconfig.app.json',
              assets: [
                'apps/nx-cloud/src/site.webmanifest',
                'apps/nx-cloud/src/assets',
                {
                  input: 'libs/nx-cloud/assets/src/lib',
                  glob: '**/*',
                  output: 'assets',
                  ignore: ['**/*.ts'],
                },
              ],
              styles: [
                'apps/nx-cloud/src/styles.scss',
                'libs/nx-cloud/ui/styles/src/lib/material.scss',
              ],
              scripts: [],
            },
            configurations: {
              production: {
                fileReplacements: [
                  {
                    replace: 'apps/nx-cloud/src/environments/environment.ts',
                    with: 'apps/nx-cloud/src/environments/environment.prod.ts',
                  },
                ],
                optimization: true,
                outputHashing: 'all',
                sourceMap: false,
                extractCss: true,
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
                ],
              },
              private: {
                index: 'apps/nx-cloud/src/index-private.html',
                fileReplacements: [
                  {
                    replace: 'apps/nx-cloud/src/environments/environment.ts',
                    with:
                      'apps/nx-cloud/src/environments/environment.private.ts',
                  },
                ],
              },
            },
          },
          'build-private': {
            builder: '@nrwl/workspace:run-commands',
            options: {
              commands: [
                'nx run nx-cloud:build:private',
                'cp dist/apps/nx-cloud/browser/index-private.html dist/apps/nx-cloud/browser/index.html',
                'cp dist/apps/nx-cloud/browser/index-private.html dist/apps/nx-cloud/browser/404.html',
              ],
              parallel: false,
            },
          },
          serve: {
            builder: '@angular-devkit/build-angular:dev-server',
            options: {
              browserTarget: 'nx-cloud:build',
              port: 4202,
            },
            configurations: {
              production: {
                browserTarget: 'nx-cloud:build:production',
              },
              private: {
                browserTarget: 'nx-cloud:build:private',
              },
            },
          },
          server: {
            builder: '@angular-devkit/build-angular:server',
            options: {
              outputPath: 'dist/apps/nx-cloud-server',
              main: 'apps/nx-cloud/src/express.server.ts',
              tsConfig: 'apps/nx-cloud/tsconfig.server.json',
            },
            configurations: {
              production: {
                outputHashing: 'media',
                fileReplacements: [
                  {
                    replace: 'apps/nx-cloud/src/environments/environment.ts',
                    with: 'apps/nx-cloud/src/environments/environment.prod.ts',
                  },
                ],
                sourceMap: true,
                optimization: true,
              },
            },
          },
          'serve-ssr': {
            builder: '@nguniversal/builders:ssr-dev-server',
            options: {
              port: 4202,
              browserTarget: 'nx-cloud:build',
              serverTarget: 'nx-cloud:server',
            },
            configurations: {
              production: {
                browserTarget: 'nx-cloud:build:production',
                serverTarget: 'nx-cloud:server:production',
              },
            },
          },
          prerender: {
            builder: '@nguniversal/builders:prerender',
            options: {
              browserTarget: 'nx-cloud:build:production',
              serverTarget: 'nx-cloud:server:production',
              routes: ['/'],
            },
            configurations: {
              production: {},
            },
          },
          'extract-i18n': {
            builder: '@angular-devkit/build-angular:extract-i18n',
            options: {
              browserTarget: 'nx-cloud:build',
            },
          },
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'apps/nx-cloud/tsconfig.app.json',
                'apps/nx-cloud/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!apps/nx-cloud/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'apps/nx-cloud/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        tags: ['nx-cloud'],
        files: [
          {
            file: 'apps/nx-cloud/browserslist',
            hash: '80848532e47d58cc7a4b618f600b438960f9f045',
            ext: '',
          },
          {
            file: 'apps/nx-cloud/jest.config.js',
            hash: '5e1a2f1e02e1a5cc1b3904f0100c243de4d2cbc4',
            ext: '.js',
          },
          {
            file: 'apps/nx-cloud/src/app/app.component.html',
            hash: 'd3c74198c605de7fb4fa553e05bc9d605e7e601d',
            ext: '.html',
          },
          {
            file: 'apps/nx-cloud/src/app/app.component.scss',
            hash: '2b9ce4f652ae9be62c55b0808cdf40b8841537a5',
            ext: '.scss',
          },
          {
            file: 'apps/nx-cloud/src/app/app.component.ts',
            hash: '401ae5c13aca02f9c22225bfeda1ff729c410ba9',
            ext: '.ts',
          },
          {
            file: 'apps/nx-cloud/src/app/app.module.ts',
            hash: '2011865bb0ed636ad8ebe9c90376ca90986a11a2',
            ext: '.ts',
          },
          {
            file: 'apps/nx-cloud/src/app/app.server.module.ts',
            hash: 'ba856d719dedddc20a861641adae1e5150818193',
            ext: '.ts',
          },
          {
            file: 'apps/nx-cloud/src/app/error-handler.ts',
            hash: '2ce8f706b5607749948491b209748bf9faa2045f',
            ext: '.ts',
          },
          {
            file: 'apps/nx-cloud/src/app/set-headers.interceptor.ts',
            hash: '714ea57ae1a6694ac9a975f20f0fc7ef640e29ab',
            ext: '.ts',
          },
          {
            file: 'apps/nx-cloud/src/assets/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file: 'apps/nx-cloud/src/environments/environment.interface.ts',
            hash: '0a05228536cead05d2e6caad370857dcd12f424f',
            ext: '.ts',
          },
          {
            file: 'apps/nx-cloud/src/environments/environment.private.ts',
            hash: '46c632788ec0dd6b6c91786ad4595ea71ad1e213',
            ext: '.ts',
          },
          {
            file: 'apps/nx-cloud/src/environments/environment.prod.ts',
            hash: '438821021aa41a8166ba81bfc4fd6b5ade344363',
            ext: '.ts',
          },
          {
            file: 'apps/nx-cloud/src/environments/environment.ts',
            hash: '993062e8a55cd8dad9cbc36d12ec810138e61eb2',
            ext: '.ts',
          },
          {
            file: 'apps/nx-cloud/src/express.server.ts',
            hash: 'b04709c46238af526b717557ad1df4a028aaf975',
            ext: '.ts',
          },
          {
            file: 'apps/nx-cloud/src/index-private.html',
            hash: 'e35a69fabc7f871b68f8a6f0ac863cdf2ab49145',
            ext: '.html',
          },
          {
            file: 'apps/nx-cloud/src/index.html',
            hash: '1962b8d40872fe20bd64358f2a61d8f0f3c787ea',
            ext: '.html',
          },
          {
            file: 'apps/nx-cloud/src/main.server.ts',
            hash: '10150a7181e8e79ea35e8ba8d0f74e1d4ce87eec',
            ext: '.ts',
          },
          {
            file: 'apps/nx-cloud/src/main.ts',
            hash: 'bc45bdbfb0f4cee40bf4e23f7802890c45fd32d4',
            ext: '.ts',
          },
          {
            file: 'apps/nx-cloud/src/polyfills.ts',
            hash: '2f258e56c60dd84a931a7486d2b999dd8ecf7037',
            ext: '.ts',
          },
          {
            file: 'apps/nx-cloud/src/site.webmanifest',
            hash: 'dfa06cf8b775bea32c49f888ed5f634de5d3e807',
            ext: '.webmanifest',
          },
          {
            file: 'apps/nx-cloud/src/styles.scss',
            hash: 'ec2601dc8fd8c129a9df15271a7239c82bdeb39d',
            ext: '.scss',
          },
          {
            file: 'apps/nx-cloud/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'apps/nx-cloud/tsconfig.app.json',
            hash: 'c27e5873f5526cdcf6c416445b17f05a79d2eb6f',
            ext: '.json',
          },
          {
            file: 'apps/nx-cloud/tsconfig.json',
            hash: '243697cd661c65e071fb3bdef381996b7e07c56f',
            ext: '.json',
          },
          {
            file: 'apps/nx-cloud/tsconfig.server.json',
            hash: '927ab092837bacc5225d0a6a9e2775cfc4c58702',
            ext: '.json',
          },
          {
            file: 'apps/nx-cloud/tsconfig.spec.json',
            hash: 'cfff29a544fb49a8c26a7cbf9cd836c87efb7fe8',
            ext: '.json',
          },
          {
            file: 'apps/nx-cloud/tslint.json',
            hash: '70eced8643555fb67216482f9fee7803d7818b4a',
            ext: '.json',
          },
        ],
      },
    },
    'ui-heros': {
      name: 'ui-heros',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/ui/heros',
        sourceRoot: 'libs/ui/heros/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/ui/heros/tsconfig.lib.json',
                'libs/ui/heros/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/ui/heros/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/ui/heros/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['ui'],
        files: [
          {
            file: 'libs/ui/heros/README.md',
            hash: '264284a60d2100722b4d4f604f3cce62688b8754',
            ext: '.md',
          },
          {
            file: 'libs/ui/heros/jest.config.js',
            hash: '317fb6c514ba1200e4277468fadb23bcfca4a431',
            ext: '.js',
          },
          {
            file: 'libs/ui/heros/src/index.ts',
            hash: '9b3add86e27f10ab6775e5ee3b4af96370370043',
            ext: '.ts',
          },
          {
            file:
              'libs/ui/heros/src/lib/hero-primary/hero-primary.component.scss',
            hash: 'ded29004bf2b452957193f7bbd4dd52e3ccf473d',
            ext: '.scss',
          },
          {
            file:
              'libs/ui/heros/src/lib/hero-primary/hero-primary.component.ts',
            hash: '56bdf2418eb200edd1b2e02ab87909c4293f68a4',
            ext: '.ts',
          },
          {
            file:
              'libs/ui/heros/src/lib/hero-secondary/hero-secondary.component.scss',
            hash: '592949a8bfd2b8902f93e9de5dec1e6d30556a0e',
            ext: '.scss',
          },
          {
            file:
              'libs/ui/heros/src/lib/hero-secondary/hero-secondary.component.ts',
            hash: '869af257d7582068e5d10af333296cc74d86b9a0',
            ext: '.ts',
          },
          {
            file: 'libs/ui/heros/src/lib/ui-heros.module.ts',
            hash: 'dab031186f4354b8092e90ce1d5cde05f61dc838',
            ext: '.ts',
          },
          {
            file: 'libs/ui/heros/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/ui/heros/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/ui/heros/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/ui/heros/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/ui/heros/tslint.json',
            hash: '5ad9ba82222ce3bd10c035b49adc62c50f8a2ef8',
            ext: '.json',
          },
        ],
      },
    },
    'nx-api': {
      name: 'nx-api',
      type: 'app',
      data: {
        root: 'apps/nx-api/',
        projectType: 'application',
        architect: {
          build: {
            builder: '@nrwl/workspace:run-commands',
            options: {
              commands: ['./gradlew :nx-api:build -x test'],
            },
          },
          serve: {
            builder: '@nrwl/workspace:run-commands',
            options: {
              commands: ['./gradlew -t installDist', './gradlew :nx-api:run'],
              parallel: true,
            },
          },
          test: {
            builder: '@nrwl/workspace:run-commands',
            options: {
              commands: [
                'yarn nps services.create',
                'yarn nps services.waitForMongoDB',
                './gradlew :nx-api:test',
              ],
              parallel: false,
            },
          },
          'test-watch': {
            builder: '@nrwl/workspace:run-commands',
            options: {
              commands: [
                'yarn nps services.create',
                'yarn nps services.waitForMongoDB',
                './gradlew -t :nx-api:test',
              ],
              parallel: false,
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'apps/nx-api/Dockerfile',
            hash: 'ffe744e4522678838036685bf32412eb123c0bc8',
            ext: '',
          },
          {
            file: 'apps/nx-api/build.gradle.kts',
            hash: '16f23a2175d300b7fc812a4c67b6320f019f2481',
            ext: '.kts',
          },
          {
            file: 'apps/nx-api/src/main/kotlin/BackgroundTasks.kt',
            hash: 'c56f0768d994b9d5913fa05404456940f37a023d',
            ext: '.kt',
          },
          {
            file: 'apps/nx-api/src/main/kotlin/CreateOrgAndWorkspaceHandler.kt',
            hash: 'd70f9993b3153fe0bfa66c3df43cfb39c35a353b',
            ext: '.kt',
          },
          {
            file: 'apps/nx-api/src/main/kotlin/Db.kt',
            hash: '7e870baf41524e00b54ec04d333ee6108e9e704a',
            ext: '.kt',
          },
          {
            file: 'apps/nx-api/src/main/kotlin/ErrorReporting.kt',
            hash: '0b6f0ed14f02951f9a59febcb14587d060918ef7',
            ext: '.kt',
          },
          {
            file: 'apps/nx-api/src/main/kotlin/ErrorTestHandler.kt',
            hash: 'a29f9fa6ae46a8fbcdef3f35806ac15d18f38bd4',
            ext: '.kt',
          },
          {
            file: 'apps/nx-api/src/main/kotlin/FileServers.kt',
            hash: '295e79e083297e819276017e3c84e97097797c64',
            ext: '.kt',
          },
          {
            file: 'apps/nx-api/src/main/kotlin/FindSimilarTasksHandler.kt',
            hash: '01abe413c131d53e8fececd7b48d2588bb7313e5',
            ext: '.kt',
          },
          {
            file: 'apps/nx-api/src/main/kotlin/Main.kt',
            hash: 'eec3f66059341f2c00f296baf0d74a87dd76a76a',
            ext: '.kt',
          },
          {
            file: 'apps/nx-api/src/main/kotlin/NearMisses.kt',
            hash: '19a5ce7f0b152285de04e97cd338c84f4753b03d',
            ext: '.kt',
          },
          {
            file: 'apps/nx-api/src/main/kotlin/PingHandler.kt',
            hash: '632fb3619d3340448b0f5c6706782733bfbdf9d8',
            ext: '.kt',
          },
          {
            file: 'apps/nx-api/src/main/kotlin/ReqContext.kt',
            hash: '4a1f57f8014adb1800b782aec9c97f4a8640e601',
            ext: '.kt',
          },
          {
            file: 'apps/nx-api/src/main/kotlin/RunEndHandler.kt',
            hash: '973c70c0cf4a8442fab7eb4467a9ced3dcb65fa1',
            ext: '.kt',
          },
          {
            file: 'apps/nx-api/src/main/kotlin/RunStartHandler.kt',
            hash: '674b1c41b648f2b4563414ce9b254cc9e16f7b64',
            ext: '.kt',
          },
          {
            file: 'apps/nx-api/src/main/kotlin/ScheduledTasks.kt',
            hash: 'b14cbaefce7d9fc6e93916f6091ced04d3cc5ec0',
            ext: '.kt',
          },
          {
            file: 'apps/nx-api/src/main/kotlin/TerminalOutput.kt',
            hash: '088de8a14c058c554d333f6346439c2ad6b18c94',
            ext: '.kt',
          },
          {
            file: 'apps/nx-api/src/main/resources/application.conf',
            hash: '2867b97feddd0d54f990276949d860a3c53ce7fa',
            ext: '.conf',
          },
          {
            file: 'apps/nx-api/src/main/resources/logback.xml',
            hash: 'd2e3788dd540f1c0a729fba278b92523b39e655c',
            ext: '.xml',
          },
          {
            file: 'apps/nx-api/src/test/kotlin/CreateOrgAndWorkspaceTests.kt',
            hash: 'ec0f52aefc12db8ad25f73de5be72e7855ad43ce',
            ext: '.kt',
          },
          {
            file: 'apps/nx-api/src/test/kotlin/PermissionsTests.kt',
            hash: '709f5aa4d8f32ebb4da37b11c167e481f427638b',
            ext: '.kt',
          },
          {
            file: 'apps/nx-api/src/test/kotlin/RunTests.kt',
            hash: '4a3335d439652ebc5c07b0b17fb8a4fd0909da7c',
            ext: '.kt',
          },
          {
            file: 'apps/nx-api/src/test/kotlin/ScheduledTasksTests.kt',
            hash: '4e8e122ac21bd0df97255e27c2dae1c9e007e663',
            ext: '.kt',
          },
          {
            file: 'apps/nx-api/src/test/kotlin/TerminalOutputTests.kt',
            hash: 'f162688eef831dcf9c40dcd7d93d3d0c59861aa1',
            ext: '.kt',
          },
          {
            file: 'apps/nx-api/src/test/resources/logback-test.xml',
            hash: 'de268242eaa558bce5e2a0f883e9418e26a171d2',
            ext: '.xml',
          },
        ],
      },
    },
    nrwlio: {
      name: 'nrwlio',
      type: 'app',
      data: {
        projectType: 'application',
        schematics: {
          '@nrwl/workspace:component': {
            style: 'scss',
          },
        },
        root: 'apps/nrwlio',
        sourceRoot: 'apps/nrwlio/src',
        prefix: 'nrwlio',
        architect: {
          build: {
            builder: '@angular-devkit/build-angular:browser',
            options: {
              outputPath: 'dist/apps/nrwlio/browser',
              index: 'apps/nrwlio/src/index.html',
              main: 'apps/nrwlio/src/main.ts',
              polyfills: 'apps/nrwlio/src/polyfills.ts',
              tsConfig: 'apps/nrwlio/tsconfig.app.json',
              assets: [
                'apps/nrwlio/src/favicon.png',
                'apps/nrwlio/src/assets',
                'apps/nrwlio/src/manifest.webmanifest',
                'apps/nrwlio/src/robots.txt',
                'apps/nrwlio/src/robots.staging.txt',
                {
                  input: 'libs/nrwlio-site/assets/src/lib',
                  glob: '**/*',
                  output: 'assets',
                  ignore: ['**/*.ts'],
                },
              ],
              styles: [
                'apps/nrwlio/src/styles.scss',
                'libs/nrwlio-site/ui/styles/src/lib/material.scss',
              ],
              scripts: ['node_modules/marked/lib/marked.js'],
              sourceMap: true,
              extractCss: true,
            },
            configurations: {
              production: {
                fileReplacements: [
                  {
                    replace: 'apps/nrwlio/src/environments/environment.ts',
                    with: 'apps/nrwlio/src/environments/environment.prod.ts',
                  },
                ],
                optimization: true,
                outputHashing: 'all',
                sourceMap: false,
                extractCss: true,
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
                ],
                serviceWorker: true,
                ngswConfigPath: 'apps/nrwlio/ngsw-config.json',
              },
            },
          },
          serve: {
            builder: '@angular-devkit/build-angular:dev-server',
            options: {
              browserTarget: 'nrwlio:build',
            },
            configurations: {
              production: {
                browserTarget: 'nrwlio:build:production',
              },
            },
          },
          server: {
            builder: '@angular-devkit/build-angular:server',
            options: {
              outputPath: 'dist/apps/nrwlio-server',
              main: 'apps/nrwlio/src/express.server.ts',
              tsConfig: 'apps/nrwlio/tsconfig.server.json',
            },
            configurations: {
              production: {
                outputHashing: 'media',
                fileReplacements: [
                  {
                    replace: 'apps/nrwlio/src/environments/environment.ts',
                    with: 'apps/nrwlio/src/environments/environment.prod.ts',
                  },
                ],
                sourceMap: true,
                optimization: true,
              },
            },
          },
          'serve-ssr': {
            builder: '@nguniversal/builders:ssr-dev-server',
            options: {
              browserTarget: 'nrwlio:build',
              serverTarget: 'nrwlio:server',
            },
            configurations: {
              production: {
                browserTarget: 'nrwlio:build:production',
                serverTarget: 'nrwlio:server:production',
              },
            },
          },
          prerender: {
            builder: '@nguniversal/builders:prerender',
            options: {
              browserTarget: 'nrwlio:build:production',
              serverTarget: 'nrwlio:server:production',
              routes: ['/'],
            },
            configurations: {
              production: {},
            },
          },
          'extract-i18n': {
            builder: '@angular-devkit/build-angular:extract-i18n',
            options: {
              browserTarget: 'nrwlio:build',
            },
          },
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'apps/nrwlio/tsconfig.app.json',
                'apps/nrwlio/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!apps/nrwlio/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'apps/nrwlio/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        tags: ['nrwlio'],
        files: [
          {
            file: 'apps/nrwlio/browserslist',
            hash: '80848532e47d58cc7a4b618f600b438960f9f045',
            ext: '',
          },
          {
            file: 'apps/nrwlio/jest.config.js',
            hash: 'b6a6df53dbbe360a271cd42e089e29d7bba00799',
            ext: '.js',
          },
          {
            file: 'apps/nrwlio/ngsw-config.json',
            hash: '81dfb6e15f8becab456b5f8e3a582b1b6ba6db0d',
            ext: '.json',
          },
          {
            file: 'apps/nrwlio/src/app/app-routing.module.ts',
            hash: '328ab65410b1b18ffcc7e7f69e8c4170c75bc78a',
            ext: '.ts',
          },
          {
            file: 'apps/nrwlio/src/app/app.component.ts',
            hash: '35f03deb8527fdb5b7a3f94430fbf6edec4ad9cd',
            ext: '.ts',
          },
          {
            file: 'apps/nrwlio/src/app/app.module.ts',
            hash: '8ca0ff43eb48baaf6c435276b96646786ca9ecdd',
            ext: '.ts',
          },
          {
            file: 'apps/nrwlio/src/app/app.server.module.ts',
            hash: 'ba856d719dedddc20a861641adae1e5150818193',
            ext: '.ts',
          },
          {
            file: 'apps/nrwlio/src/assets/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file: 'apps/nrwlio/src/assets/icons/icon-128x128.png',
            hash: '54e041c33fc74c43108ab13cce452f3ca2a1bee3',
            ext: '.png',
          },
          {
            file: 'apps/nrwlio/src/assets/icons/icon-144x144.png',
            hash: '5c9d7e567f623b4a9371b6971ad179a8f6e00684',
            ext: '.png',
          },
          {
            file: 'apps/nrwlio/src/assets/icons/icon-152x152.png',
            hash: '31101928619fc80928844a834fb1a10fd1001b36',
            ext: '.png',
          },
          {
            file: 'apps/nrwlio/src/assets/icons/icon-192x192.png',
            hash: '3ac4ce6320ee5ef5fa2e6f8c712a78cf9a71ed29',
            ext: '.png',
          },
          {
            file: 'apps/nrwlio/src/assets/icons/icon-384x384.png',
            hash: 'f035be948a7c4dec9de3738dcb5ece96e2320372',
            ext: '.png',
          },
          {
            file: 'apps/nrwlio/src/assets/icons/icon-512x512.png',
            hash: 'e8b23205e40424d73a6054ae1ba133cb0afc3123',
            ext: '.png',
          },
          {
            file: 'apps/nrwlio/src/assets/icons/icon-72x72.png',
            hash: '1f4b8fadda3bbd3144d28baa8c65d6b1c6cbc87d',
            ext: '.png',
          },
          {
            file: 'apps/nrwlio/src/assets/icons/icon-96x96.png',
            hash: '29fb463d577cf0445743973461d3bf437f4ddc9a',
            ext: '.png',
          },
          {
            file: 'apps/nrwlio/src/environments/environment.prod.ts',
            hash: '4375b97fdce1e69f8aaf08a43c0ffa2cc15f826d',
            ext: '.ts',
          },
          {
            file: 'apps/nrwlio/src/environments/environment.staging.ts',
            hash: 'eb97b40491a3f5bcf46a26c349995829d8733fe1',
            ext: '.ts',
          },
          {
            file: 'apps/nrwlio/src/environments/environment.ts',
            hash: '7a4866c6a2be602b84287329f0bfaf84054158ef',
            ext: '.ts',
          },
          {
            file: 'apps/nrwlio/src/express.server.ts',
            hash: '135bf50c70dde3ebd6c7cfbc812d5febb4a9557e',
            ext: '.ts',
          },
          {
            file: 'apps/nrwlio/src/favicon.png',
            hash: '167ba824caebf3b339141090d485ef69f8b04521',
            ext: '.png',
          },
          {
            file: 'apps/nrwlio/src/index.html',
            hash: '42970b8e3a58bfc9cf729d4e8961f50da0693245',
            ext: '.html',
          },
          {
            file: 'apps/nrwlio/src/main.server.ts',
            hash: '10150a7181e8e79ea35e8ba8d0f74e1d4ce87eec',
            ext: '.ts',
          },
          {
            file: 'apps/nrwlio/src/main.ts',
            hash: '6fd7bcb52f88231499851dda21820e5493c5daac',
            ext: '.ts',
          },
          {
            file: 'apps/nrwlio/src/manifest.webmanifest',
            hash: '8a9c904368ef28189e4079b703fbc9a00344e87f',
            ext: '.webmanifest',
          },
          {
            file: 'apps/nrwlio/src/polyfills.ts',
            hash: '2f258e56c60dd84a931a7486d2b999dd8ecf7037',
            ext: '.ts',
          },
          {
            file: 'apps/nrwlio/src/robots.staging.txt',
            hash: '1f53798bb4fe33c86020be7f10c44f29486fd190',
            ext: '.txt',
          },
          {
            file: 'apps/nrwlio/src/robots.txt',
            hash: 'eb0536286f3081c6c0646817037faf5446e3547d',
            ext: '.txt',
          },
          {
            file: 'apps/nrwlio/src/styles.scss',
            hash: '4a22bc090f6bd7c2a6442b456771b31cf91871fc',
            ext: '.scss',
          },
          {
            file: 'apps/nrwlio/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'apps/nrwlio/tsconfig.app.json',
            hash: 'f7509e7197b1a48595a85c43a3ce6f5c4cb33485',
            ext: '.json',
          },
          {
            file: 'apps/nrwlio/tsconfig.json',
            hash: '63dbe35fb282d5f9ac4a724607173e6316269e29',
            ext: '.json',
          },
          {
            file: 'apps/nrwlio/tsconfig.server.json',
            hash: 'bacf286f7d64db87f1eae2ebf75e42947ca5be15',
            ext: '.json',
          },
          {
            file: 'apps/nrwlio/tsconfig.spec.json',
            hash: 'cfff29a544fb49a8c26a7cbf9cd836c87efb7fe8',
            ext: '.json',
          },
          {
            file: 'apps/nrwlio/tslint.json',
            hash: '9d6cb05294e52f60a1812519c3e653f255190a9d',
            ext: '.json',
          },
        ],
      },
    },
    'ui-ads': {
      name: 'ui-ads',
      type: 'lib',
      data: {
        projectType: 'library',
        root: 'libs/ui/ads',
        sourceRoot: 'libs/ui/ads/src',
        prefix: 'nrwl-ocean',
        architect: {
          lint: {
            builder: '@angular-devkit/build-angular:tslint',
            options: {
              tsConfig: [
                'libs/ui/ads/tsconfig.lib.json',
                'libs/ui/ads/tsconfig.spec.json',
              ],
              exclude: ['**/node_modules/**', '!libs/ui/ads/**/*'],
            },
          },
          test: {
            builder: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/ui/ads/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
        schematics: {
          '@nrwl/angular:component': {
            styleext: 'scss',
          },
        },
        tags: ['ui'],
        files: [
          {
            file: 'libs/ui/ads/README.md',
            hash: 'a329f48b1635141da736987c8f20e1ae1e012b09',
            ext: '.md',
          },
          {
            file: 'libs/ui/ads/jest.config.js',
            hash: 'a5e8ebe45045ec6f314cf542fb1875bf0880a61a',
            ext: '.js',
          },
          {
            file: 'libs/ui/ads/src/index.ts',
            hash: '459b78a5b6add1080d7cdb7742d3f2a3009bbedd',
            ext: '.ts',
          },
          {
            file:
              'libs/ui/ads/src/lib/ad-display-primary/ad-display-primary.component.html',
            hash: '117d29a941ec06d980d388eccd672573f8f2c3bf',
            ext: '.html',
          },
          {
            file:
              'libs/ui/ads/src/lib/ad-display-primary/ad-display-primary.component.scss',
            hash: 'cf91f5de1df01f0c7b4881479fb3e48e0913fc05',
            ext: '.scss',
          },
          {
            file:
              'libs/ui/ads/src/lib/ad-display-primary/ad-display-primary.component.ts',
            hash: '8e049445af363ad86b259a134febb8d5ffa947b0',
            ext: '.ts',
          },
          {
            file:
              'libs/ui/ads/src/lib/ad-display-wide/ad-display-wide.component.html',
            hash: '039237b744a63de396f1100066635d2b5cabba32',
            ext: '.html',
          },
          {
            file:
              'libs/ui/ads/src/lib/ad-display-wide/ad-display-wide.component.scss',
            hash: '6efd62b62242aa389d465974971819dd83740832',
            ext: '.scss',
          },
          {
            file:
              'libs/ui/ads/src/lib/ad-display-wide/ad-display-wide.component.ts',
            hash: 'b00af98b760830d7c52eed354931b8c36904af1e',
            ext: '.ts',
          },
          {
            file: 'libs/ui/ads/src/lib/call-to-action.model.ts',
            hash: '2d66972eb6a9eeb45b3cadc9c594d87f3f5a5786',
            ext: '.ts',
          },
          {
            file: 'libs/ui/ads/src/lib/ui-ads.module.ts',
            hash: '2677c24f6e6af0a30f64aa0a0fa436bffd72f3e2',
            ext: '.ts',
          },
          {
            file: 'libs/ui/ads/src/test-setup.ts',
            hash: '8d88704e8ff09145a6310d3df98f124042268bfe',
            ext: '.ts',
          },
          {
            file: 'libs/ui/ads/tsconfig.json',
            hash: '1b6ee0bf6f3df276fbfc5c683aca2e02c6c6523a',
            ext: '.json',
          },
          {
            file: 'libs/ui/ads/tsconfig.lib.json',
            hash: '94cf26a99e2d444d82e8566c853202848775998e',
            ext: '.json',
          },
          {
            file: 'libs/ui/ads/tsconfig.spec.json',
            hash: 'fd405a65ef42fc2a9dece7054ce3338c0195210b',
            ext: '.json',
          },
          {
            file: 'libs/ui/ads/tslint.json',
            hash: '5ad9ba82222ce3bd10c035b49adc62c50f8a2ef8',
            ext: '.json',
          },
        ],
      },
    },
    'npm:@angular/animations': {
      type: 'npm',
      name: 'npm:@angular/animations',
      data: {
        version: '10.0.4',
        packageName: '@angular/animations',
        files: [],
      },
    },
    'npm:@angular/cdk': {
      type: 'npm',
      name: 'npm:@angular/cdk',
      data: {
        version: '9.1.0',
        packageName: '@angular/cdk',
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
    'npm:@angular/core': {
      type: 'npm',
      name: 'npm:@angular/core',
      data: {
        version: '10.0.4',
        packageName: '@angular/core',
        files: [],
      },
    },
    'npm:@angular/flex-layout': {
      type: 'npm',
      name: 'npm:@angular/flex-layout',
      data: {
        version: '^9.0.0-beta.29',
        packageName: '@angular/flex-layout',
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
    'npm:@angular/material': {
      type: 'npm',
      name: 'npm:@angular/material',
      data: {
        version: '9.1.0',
        packageName: '@angular/material',
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
    'npm:@angular/pwa': {
      type: 'npm',
      name: 'npm:@angular/pwa',
      data: {
        version: '^0.901.9',
        packageName: '@angular/pwa',
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
    'npm:@contentful/rich-text-html-renderer': {
      type: 'npm',
      name: 'npm:@contentful/rich-text-html-renderer',
      data: {
        version: '^13.1.0',
        packageName: '@contentful/rich-text-html-renderer',
        files: [],
      },
    },
    'npm:@contentful/rich-text-types': {
      type: 'npm',
      name: 'npm:@contentful/rich-text-types',
      data: {
        version: '^13.1.0',
        packageName: '@contentful/rich-text-types',
        files: [],
      },
    },
    'npm:@loona/angular': {
      type: 'npm',
      name: 'npm:@loona/angular',
      data: {
        version: '1.0.0',
        packageName: '@loona/angular',
        files: [],
      },
    },
    'npm:@loona/core': {
      type: 'npm',
      name: 'npm:@loona/core',
      data: {
        version: '1.0.0',
        packageName: '@loona/core',
        files: [],
      },
    },
    'npm:@nestjs/common': {
      type: 'npm',
      name: 'npm:@nestjs/common',
      data: {
        version: '7.3.2',
        packageName: '@nestjs/common',
        files: [],
      },
    },
    'npm:@nestjs/core': {
      type: 'npm',
      name: 'npm:@nestjs/core',
      data: {
        version: '7.3.2',
        packageName: '@nestjs/core',
        files: [],
      },
    },
    'npm:@nestjs/graphql': {
      type: 'npm',
      name: 'npm:@nestjs/graphql',
      data: {
        version: '5.5.0',
        packageName: '@nestjs/graphql',
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
    'npm:@ngrx/store': {
      type: 'npm',
      name: 'npm:@ngrx/store',
      data: {
        version: '9.1.0',
        packageName: '@ngrx/store',
        files: [],
      },
    },
    'npm:@nguniversal/express-engine': {
      type: 'npm',
      name: 'npm:@nguniversal/express-engine',
      data: {
        version: '^9.1.1',
        packageName: '@nguniversal/express-engine',
        files: [],
      },
    },
    'npm:@nrwl/angular': {
      type: 'npm',
      name: 'npm:@nrwl/angular',
      data: {
        version: '10.1.1-beta.2',
        packageName: '@nrwl/angular',
        files: [],
      },
    },
    'npm:@types/d3-axis': {
      type: 'npm',
      name: 'npm:@types/d3-axis',
      data: {
        version: '^1.0.12',
        packageName: '@types/d3-axis',
        files: [],
      },
    },
    'npm:@types/graphql': {
      type: 'npm',
      name: 'npm:@types/graphql',
      data: {
        version: '14.0.2',
        packageName: '@types/graphql',
        files: [],
      },
    },
    'npm:@types/opn': {
      type: 'npm',
      name: 'npm:@types/opn',
      data: {
        version: '^5.1.0',
        packageName: '@types/opn',
        files: [],
      },
    },
    'npm:@types/redis': {
      type: 'npm',
      name: 'npm:@types/redis',
      data: {
        version: '^2.8.18',
        packageName: '@types/redis',
        files: [],
      },
    },
    'npm:apollo-angular': {
      type: 'npm',
      name: 'npm:apollo-angular',
      data: {
        version: '1.5.0',
        packageName: 'apollo-angular',
        files: [],
      },
    },
    'npm:apollo-angular-link-http': {
      type: 'npm',
      name: 'npm:apollo-angular-link-http',
      data: {
        version: '1.4.0',
        packageName: 'apollo-angular-link-http',
        files: [],
      },
    },
    'npm:apollo-cache-inmemory': {
      type: 'npm',
      name: 'npm:apollo-cache-inmemory',
      data: {
        version: '1.3.11',
        packageName: 'apollo-cache-inmemory',
        files: [],
      },
    },
    'npm:apollo-client': {
      type: 'npm',
      name: 'npm:apollo-client',
      data: {
        version: '^2.6.10',
        packageName: 'apollo-client',
        files: [],
      },
    },
    'npm:apollo-link': {
      type: 'npm',
      name: 'npm:apollo-link',
      data: {
        version: '1.2.14',
        packageName: 'apollo-link',
        files: [],
      },
    },
    'npm:apollo-link-error': {
      type: 'npm',
      name: 'npm:apollo-link-error',
      data: {
        version: '^1.1.13',
        packageName: 'apollo-link-error',
        files: [],
      },
    },
    'npm:auth0-js': {
      type: 'npm',
      name: 'npm:auth0-js',
      data: {
        version: '9.7.3',
        packageName: 'auth0-js',
        files: [],
      },
    },
    'npm:axios': {
      type: 'npm',
      name: 'npm:axios',
      data: {
        version: '0.19.1',
        packageName: 'axios',
        files: [],
      },
    },
    'npm:bourbon': {
      type: 'npm',
      name: 'npm:bourbon',
      data: {
        version: '^7.0.0',
        packageName: 'bourbon',
        files: [],
      },
    },
    'npm:core-js': {
      type: 'npm',
      name: 'npm:core-js',
      data: {
        version: '2.5.7',
        packageName: 'core-js',
        files: [],
      },
    },
    'npm:d3-axis': {
      type: 'npm',
      name: 'npm:d3-axis',
      data: {
        version: '^1.0.12',
        packageName: 'd3-axis',
        files: [],
      },
    },
    'npm:dms-report': {
      type: 'npm',
      name: 'npm:dms-report',
      data: {
        version: '^0.1.1',
        packageName: 'dms-report',
        files: [],
      },
    },
    'npm:epubjs': {
      type: 'npm',
      name: 'npm:epubjs',
      data: {
        version: '^0.3.84',
        packageName: 'epubjs',
        files: [],
      },
    },
    'npm:express-jwt': {
      type: 'npm',
      name: 'npm:express-jwt',
      data: {
        version: '5.3.1',
        packageName: 'express-jwt',
        files: [],
      },
    },
    'npm:get-port': {
      type: 'npm',
      name: 'npm:get-port',
      data: {
        version: '^4.0.0',
        packageName: 'get-port',
        files: [],
      },
    },
    'npm:googleapis': {
      type: 'npm',
      name: 'npm:googleapis',
      data: {
        version: '^39.2.0',
        packageName: 'googleapis',
        files: [],
      },
    },
    'npm:graphql': {
      type: 'npm',
      name: 'npm:graphql',
      data: {
        version: '14.1.1',
        packageName: 'graphql',
        files: [],
      },
    },
    'npm:graphql-middleware': {
      type: 'npm',
      name: 'npm:graphql-middleware',
      data: {
        version: '3.0.2',
        packageName: 'graphql-middleware',
        files: [],
      },
    },
    'npm:graphql-shield': {
      type: 'npm',
      name: 'npm:graphql-shield',
      data: {
        version: '5.3.4',
        packageName: 'graphql-shield',
        files: [],
      },
    },
    'npm:graphql-tag': {
      type: 'npm',
      name: 'npm:graphql-tag',
      data: {
        version: '2.10.0',
        packageName: 'graphql-tag',
        files: [],
      },
    },
    'npm:graphql-yoga': {
      type: 'npm',
      name: 'npm:graphql-yoga',
      data: {
        version: '1.17.4',
        packageName: 'graphql-yoga',
        files: [],
      },
    },
    'npm:hammerjs': {
      type: 'npm',
      name: 'npm:hammerjs',
      data: {
        version: '2.0.8',
        packageName: 'hammerjs',
        files: [],
      },
    },
    'npm:helmet': {
      type: 'npm',
      name: 'npm:helmet',
      data: {
        version: '3.15.1',
        packageName: 'helmet',
        files: [],
      },
    },
    'npm:jsonwebtoken': {
      type: 'npm',
      name: 'npm:jsonwebtoken',
      data: {
        version: '8.4.0',
        packageName: 'jsonwebtoken',
        files: [],
      },
    },
    'npm:jwks-rsa': {
      type: 'npm',
      name: 'npm:jwks-rsa',
      data: {
        version: '1.4.0',
        packageName: 'jwks-rsa',
        files: [],
      },
    },
    'npm:lodash.memoize': {
      type: 'npm',
      name: 'npm:lodash.memoize',
      data: {
        version: '4.1.2',
        packageName: 'lodash.memoize',
        files: [],
      },
    },
    'npm:mandrill-api': {
      type: 'npm',
      name: 'npm:mandrill-api',
      data: {
        version: '1.0.45',
        packageName: 'mandrill-api',
        files: [],
      },
    },
    'npm:modern-normalize': {
      type: 'npm',
      name: 'npm:modern-normalize',
      data: {
        version: '^0.6.0',
        packageName: 'modern-normalize',
        files: [],
      },
    },
    'npm:mongodb': {
      type: 'npm',
      name: 'npm:mongodb',
      data: {
        version: '^3.5.4',
        packageName: 'mongodb',
        files: [],
      },
    },
    'npm:ngx-markdown': {
      type: 'npm',
      name: 'npm:ngx-markdown',
      data: {
        version: '7.1.4',
        packageName: 'ngx-markdown',
        files: [],
      },
    },
    'npm:ngx-masonry': {
      type: 'npm',
      name: 'npm:ngx-masonry',
      data: {
        version: '^1.1.2',
        packageName: 'ngx-masonry',
        files: [],
      },
    },
    'npm:node-machine-id': {
      type: 'npm',
      name: 'npm:node-machine-id',
      data: {
        version: '^1.1.12',
        packageName: 'node-machine-id',
        files: [],
      },
    },
    'npm:opn': {
      type: 'npm',
      name: 'npm:opn',
      data: {
        version: '^5.4.0',
        packageName: 'opn',
        files: [],
      },
    },
    'npm:redis': {
      type: 'npm',
      name: 'npm:redis',
      data: {
        version: '^3.0.2',
        packageName: 'redis',
        files: [],
      },
    },
    'npm:rollbar': {
      type: 'npm',
      name: 'npm:rollbar',
      data: {
        version: '^2.15.0',
        packageName: 'rollbar',
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
    'npm:stripe': {
      type: 'npm',
      name: 'npm:stripe',
      data: {
        version: '^8.54.0',
        packageName: 'stripe',
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
    'npm:tslib': {
      type: 'npm',
      name: 'npm:tslib',
      data: {
        version: '^2.0.0',
        packageName: 'tslib',
        files: [],
      },
    },
    'npm:uuid': {
      type: 'npm',
      name: 'npm:uuid',
      data: {
        version: '^3.3.3',
        packageName: 'uuid',
        files: [],
      },
    },
    'npm:winston': {
      type: 'npm',
      name: 'npm:winston',
      data: {
        version: '^3.2.1',
        packageName: 'winston',
        files: [],
      },
    },
    'npm:zone.js': {
      type: 'npm',
      name: 'npm:zone.js',
      data: {
        version: '~0.10.2',
        packageName: 'zone.js',
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
    'npm:@angular/cli': {
      type: 'npm',
      name: 'npm:@angular/cli',
      data: {
        version: '10.0.3',
        packageName: '@angular/cli',
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
    'npm:@angular/language-service': {
      type: 'npm',
      name: 'npm:@angular/language-service',
      data: {
        version: '10.0.4',
        packageName: '@angular/language-service',
        files: [],
      },
    },
    'npm:@angular/platform-server': {
      type: 'npm',
      name: 'npm:@angular/platform-server',
      data: {
        version: '10.0.0',
        packageName: '@angular/platform-server',
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
    'npm:@ngrx/store-devtools': {
      type: 'npm',
      name: 'npm:@ngrx/store-devtools',
      data: {
        version: '9.1.0',
        packageName: '@ngrx/store-devtools',
        files: [],
      },
    },
    'npm:@nguniversal/builders': {
      type: 'npm',
      name: 'npm:@nguniversal/builders',
      data: {
        version: '^9.1.1',
        packageName: '@nguniversal/builders',
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
    'npm:@nrwl/nest': {
      type: 'npm',
      name: 'npm:@nrwl/nest',
      data: {
        version: '10.1.1-beta.2',
        packageName: '@nrwl/nest',
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
        version: '^10.1.0-beta.2',
        packageName: '@nrwl/nx-cloud',
        files: [],
      },
    },
    'npm:@nrwl/storybook': {
      type: 'npm',
      name: 'npm:@nrwl/storybook',
      data: {
        version: '10.1.1-beta.2',
        packageName: '@nrwl/storybook',
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
    'npm:@storybook/addon-knobs': {
      type: 'npm',
      name: 'npm:@storybook/addon-knobs',
      data: {
        version: '^5.3.19',
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
    'npm:@testing-library/cypress': {
      type: 'npm',
      name: 'npm:@testing-library/cypress',
      data: {
        version: '^5.3.0',
        packageName: '@testing-library/cypress',
        files: [],
      },
    },
    'npm:@types/auth0-js': {
      type: 'npm',
      name: 'npm:@types/auth0-js',
      data: {
        version: '^8.11.7',
        packageName: '@types/auth0-js',
        files: [],
      },
    },
    'npm:@types/aws-lambda': {
      type: 'npm',
      name: 'npm:@types/aws-lambda',
      data: {
        version: '8.10.13',
        packageName: '@types/aws-lambda',
        files: [],
      },
    },
    'npm:@types/d3-ease': {
      type: 'npm',
      name: 'npm:@types/d3-ease',
      data: {
        version: '^1.0.7',
        packageName: '@types/d3-ease',
        files: [],
      },
    },
    'npm:@types/d3-format': {
      type: 'npm',
      name: 'npm:@types/d3-format',
      data: {
        version: '^1.3.0',
        packageName: '@types/d3-format',
        files: [],
      },
    },
    'npm:@types/d3-sankey': {
      type: 'npm',
      name: 'npm:@types/d3-sankey',
      data: {
        version: '^0.7.3',
        packageName: '@types/d3-sankey',
        files: [],
      },
    },
    'npm:@types/d3-scale': {
      type: 'npm',
      name: 'npm:@types/d3-scale',
      data: {
        version: '^2.0.1',
        packageName: '@types/d3-scale',
        files: [],
      },
    },
    'npm:@types/d3-scale-chromatic': {
      type: 'npm',
      name: 'npm:@types/d3-scale-chromatic',
      data: {
        version: '^1.2.0',
        packageName: '@types/d3-scale-chromatic',
        files: [],
      },
    },
    'npm:@types/d3-selection': {
      type: 'npm',
      name: 'npm:@types/d3-selection',
      data: {
        version: '^1.3.2',
        packageName: '@types/d3-selection',
        files: [],
      },
    },
    'npm:@types/d3-time': {
      type: 'npm',
      name: 'npm:@types/d3-time',
      data: {
        version: '^1.0.8',
        packageName: '@types/d3-time',
        files: [],
      },
    },
    'npm:@types/d3-time-format': {
      type: 'npm',
      name: 'npm:@types/d3-time-format',
      data: {
        version: '^2.1.0',
        packageName: '@types/d3-time-format',
        files: [],
      },
    },
    'npm:@types/d3-transition': {
      type: 'npm',
      name: 'npm:@types/d3-transition',
      data: {
        version: '^1.1.3',
        packageName: '@types/d3-transition',
        files: [],
      },
    },
    'npm:@types/execa': {
      type: 'npm',
      name: 'npm:@types/execa',
      data: {
        version: '0.9.0',
        packageName: '@types/execa',
        files: [],
      },
    },
    'npm:@types/fs-extra': {
      type: 'npm',
      name: 'npm:@types/fs-extra',
      data: {
        version: '5.1.0',
        packageName: '@types/fs-extra',
        files: [],
      },
    },
    'npm:@types/get-port': {
      type: 'npm',
      name: 'npm:@types/get-port',
      data: {
        version: '^4.0.0',
        packageName: '@types/get-port',
        files: [],
      },
    },
    'npm:@types/got': {
      type: 'npm',
      name: 'npm:@types/got',
      data: {
        version: '9.2.0',
        packageName: '@types/got',
        files: [],
      },
    },
    'npm:@types/helmet': {
      type: 'npm',
      name: 'npm:@types/helmet',
      data: {
        version: '^0.0.41',
        packageName: '@types/helmet',
        files: [],
      },
    },
    'npm:@types/jasmine': {
      type: 'npm',
      name: 'npm:@types/jasmine',
      data: {
        version: '2.8.8',
        packageName: '@types/jasmine',
        files: [],
      },
    },
    'npm:@types/jasminewd2': {
      type: 'npm',
      name: 'npm:@types/jasminewd2',
      data: {
        version: '2.0.3',
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
    'npm:@types/jquery': {
      type: 'npm',
      name: 'npm:@types/jquery',
      data: {
        version: '3.3.6',
        packageName: '@types/jquery',
        files: [],
      },
    },
    'npm:@types/jsonwebtoken': {
      type: 'npm',
      name: 'npm:@types/jsonwebtoken',
      data: {
        version: '^7.2.8',
        packageName: '@types/jsonwebtoken',
        files: [],
      },
    },
    'npm:@types/jszip': {
      type: 'npm',
      name: 'npm:@types/jszip',
      data: {
        version: '^3.1.4',
        packageName: '@types/jszip',
        files: [],
      },
    },
    'npm:@types/lodash.memoize': {
      type: 'npm',
      name: 'npm:@types/lodash.memoize',
      data: {
        version: '^4.1.6',
        packageName: '@types/lodash.memoize',
        files: [],
      },
    },
    'npm:@types/mandrill-api': {
      type: 'npm',
      name: 'npm:@types/mandrill-api',
      data: {
        version: '^1.0.30',
        packageName: '@types/mandrill-api',
        files: [],
      },
    },
    'npm:@types/mongodb': {
      type: 'npm',
      name: 'npm:@types/mongodb',
      data: {
        version: '^3.5.2',
        packageName: '@types/mongodb',
        files: [],
      },
    },
    'npm:@types/multer': {
      type: 'npm',
      name: 'npm:@types/multer',
      data: {
        version: '^1.3.7',
        packageName: '@types/multer',
        files: [],
      },
    },
    'npm:@types/node': {
      type: 'npm',
      name: 'npm:@types/node',
      data: {
        version: '~8.9.4',
        packageName: '@types/node',
        files: [],
      },
    },
    'npm:@types/node-fetch': {
      type: 'npm',
      name: 'npm:@types/node-fetch',
      data: {
        version: '^2.1.4',
        packageName: '@types/node-fetch',
        files: [],
      },
    },
    'npm:@types/prettier': {
      type: 'npm',
      name: 'npm:@types/prettier',
      data: {
        version: '^1.13.2',
        packageName: '@types/prettier',
        files: [],
      },
    },
    'npm:@types/request': {
      type: 'npm',
      name: 'npm:@types/request',
      data: {
        version: '2.48.1',
        packageName: '@types/request',
        files: [],
      },
    },
    'npm:@types/rimraf': {
      type: 'npm',
      name: 'npm:@types/rimraf',
      data: {
        version: '^2.0.2',
        packageName: '@types/rimraf',
        files: [],
      },
    },
    'npm:@types/shelljs': {
      type: 'npm',
      name: 'npm:@types/shelljs',
      data: {
        version: '^0.8.0',
        packageName: '@types/shelljs',
        files: [],
      },
    },
    'npm:@types/tmp': {
      type: 'npm',
      name: 'npm:@types/tmp',
      data: {
        version: '^0.0.33',
        packageName: '@types/tmp',
        files: [],
      },
    },
    'npm:@types/unzipper': {
      type: 'npm',
      name: 'npm:@types/unzipper',
      data: {
        version: '^0.10.1',
        packageName: '@types/unzipper',
        files: [],
      },
    },
    'npm:@types/uuid': {
      type: 'npm',
      name: 'npm:@types/uuid',
      data: {
        version: '^3.4.6',
        packageName: '@types/uuid',
        files: [],
      },
    },
    'npm:@types/ws': {
      type: 'npm',
      name: 'npm:@types/ws',
      data: {
        version: '^5.1.2',
        packageName: '@types/ws',
        files: [],
      },
    },
    'npm:@typescript-eslint/eslint-plugin': {
      type: 'npm',
      name: 'npm:@typescript-eslint/eslint-plugin',
      data: {
        version: '2.19.2',
        packageName: '@typescript-eslint/eslint-plugin',
        files: [],
      },
    },
    'npm:@typescript-eslint/parser': {
      type: 'npm',
      name: 'npm:@typescript-eslint/parser',
      data: {
        version: '2.19.2',
        packageName: '@typescript-eslint/parser',
        files: [],
      },
    },
    'npm:apollo-link-http': {
      type: 'npm',
      name: 'npm:apollo-link-http',
      data: {
        version: '^1.5.7',
        packageName: 'apollo-link-http',
        files: [],
      },
    },
    'npm:apollo-server-express': {
      type: 'npm',
      name: 'npm:apollo-server-express',
      data: {
        version: '^2.2.2',
        packageName: 'apollo-server-express',
        files: [],
      },
    },
    'npm:aws-sdk': {
      type: 'npm',
      name: 'npm:aws-sdk',
      data: {
        version: '2.602.0',
        packageName: 'aws-sdk',
        files: [],
      },
    },
    'npm:axios-retry': {
      type: 'npm',
      name: 'npm:axios-retry',
      data: {
        version: '^3.1.8',
        packageName: 'axios-retry',
        files: [],
      },
    },
    'npm:codelyzer': {
      type: 'npm',
      name: 'npm:codelyzer',
      data: {
        version: '^5.0.1',
        packageName: 'codelyzer',
        files: [],
      },
    },
    'npm:csv-parser': {
      type: 'npm',
      name: 'npm:csv-parser',
      data: {
        version: '^2.2.0',
        packageName: 'csv-parser',
        files: [],
      },
    },
    'npm:cypress': {
      type: 'npm',
      name: 'npm:cypress',
      data: {
        version: '^4.0.2',
        packageName: 'cypress',
        files: [],
      },
    },
    'npm:d3-ease': {
      type: 'npm',
      name: 'npm:d3-ease',
      data: {
        version: '^1.0.5',
        packageName: 'd3-ease',
        files: [],
      },
    },
    'npm:d3-format': {
      type: 'npm',
      name: 'npm:d3-format',
      data: {
        version: '^1.3.2',
        packageName: 'd3-format',
        files: [],
      },
    },
    'npm:d3-sankey': {
      type: 'npm',
      name: 'npm:d3-sankey',
      data: {
        version: '^0.7.1',
        packageName: 'd3-sankey',
        files: [],
      },
    },
    'npm:d3-scale': {
      type: 'npm',
      name: 'npm:d3-scale',
      data: {
        version: '^2.1.2',
        packageName: 'd3-scale',
        files: [],
      },
    },
    'npm:d3-scale-chromatic': {
      type: 'npm',
      name: 'npm:d3-scale-chromatic',
      data: {
        version: '^1.3.3',
        packageName: 'd3-scale-chromatic',
        files: [],
      },
    },
    'npm:d3-selection': {
      type: 'npm',
      name: 'npm:d3-selection',
      data: {
        version: '^1.3.2',
        packageName: 'd3-selection',
        files: [],
      },
    },
    'npm:d3-time': {
      type: 'npm',
      name: 'npm:d3-time',
      data: {
        version: '^1.0.10',
        packageName: 'd3-time',
        files: [],
      },
    },
    'npm:d3-time-format': {
      type: 'npm',
      name: 'npm:d3-time-format',
      data: {
        version: '^2.1.3',
        packageName: 'd3-time-format',
        files: [],
      },
    },
    'npm:d3-transition': {
      type: 'npm',
      name: 'npm:d3-transition',
      data: {
        version: '^1.1.3',
        packageName: 'd3-transition',
        files: [],
      },
    },
    'npm:date-fns': {
      type: 'npm',
      name: 'npm:date-fns',
      data: {
        version: '^2.9.0',
        packageName: 'date-fns',
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
        version: '6.8.0',
        packageName: 'eslint',
        files: [],
      },
    },
    'npm:eslint-config-prettier': {
      type: 'npm',
      name: 'npm:eslint-config-prettier',
      data: {
        version: '6.0.0',
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
    'npm:execa': {
      type: 'npm',
      name: 'npm:execa',
      data: {
        version: '^1.0.0',
        packageName: 'execa',
        files: [],
      },
    },
    'npm:firebase-tools': {
      type: 'npm',
      name: 'npm:firebase-tools',
      data: {
        version: '^8.4.1',
        packageName: 'firebase-tools',
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
    'npm:got': {
      type: 'npm',
      name: 'npm:got',
      data: {
        version: '9.3.2',
        packageName: 'got',
        files: [],
      },
    },
    'npm:graphql-cli': {
      type: 'npm',
      name: 'npm:graphql-cli',
      data: {
        version: '3.0.9',
        packageName: 'graphql-cli',
        files: [],
      },
    },
    'npm:http-proxy': {
      type: 'npm',
      name: 'npm:http-proxy',
      data: {
        version: '^1.18.1',
        packageName: 'http-proxy',
        files: [],
      },
    },
    'npm:http-server': {
      type: 'npm',
      name: 'npm:http-server',
      data: {
        version: '0.11.1',
        packageName: 'http-server',
        files: [],
      },
    },
    'npm:husky': {
      type: 'npm',
      name: 'npm:husky',
      data: {
        version: '^1.1.3',
        packageName: 'husky',
        files: [],
      },
    },
    'npm:jasmine-core': {
      type: 'npm',
      name: 'npm:jasmine-core',
      data: {
        version: '3.3.0',
        packageName: 'jasmine-core',
        files: [],
      },
    },
    'npm:jasmine-marbles': {
      type: 'npm',
      name: 'npm:jasmine-marbles',
      data: {
        version: '0.5.0',
        packageName: 'jasmine-marbles',
        files: [],
      },
    },
    'npm:jasmine-spec-reporter': {
      type: 'npm',
      name: 'npm:jasmine-spec-reporter',
      data: {
        version: '4.2.1',
        packageName: 'jasmine-spec-reporter',
        files: [],
      },
    },
    'npm:javascript-obfuscator': {
      type: 'npm',
      name: 'npm:javascript-obfuscator',
      data: {
        version: '^0.25.0',
        packageName: 'javascript-obfuscator',
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
    'npm:jszip': {
      type: 'npm',
      name: 'npm:jszip',
      data: {
        version: '^3.1.5',
        packageName: 'jszip',
        files: [],
      },
    },
    'npm:karma': {
      type: 'npm',
      name: 'npm:karma',
      data: {
        version: '3.1.1',
        packageName: 'karma',
        files: [],
      },
    },
    'npm:karma-chrome-launcher': {
      type: 'npm',
      name: 'npm:karma-chrome-launcher',
      data: {
        version: '2.2.0',
        packageName: 'karma-chrome-launcher',
        files: [],
      },
    },
    'npm:karma-coverage-istanbul-reporter': {
      type: 'npm',
      name: 'npm:karma-coverage-istanbul-reporter',
      data: {
        version: '2.0.4',
        packageName: 'karma-coverage-istanbul-reporter',
        files: [],
      },
    },
    'npm:karma-jasmine': {
      type: 'npm',
      name: 'npm:karma-jasmine',
      data: {
        version: '1.1.2',
        packageName: 'karma-jasmine',
        files: [],
      },
    },
    'npm:karma-jasmine-html-reporter': {
      type: 'npm',
      name: 'npm:karma-jasmine-html-reporter',
      data: {
        version: '1.4.0',
        packageName: 'karma-jasmine-html-reporter',
        files: [],
      },
    },
    'npm:lint-staged': {
      type: 'npm',
      name: 'npm:lint-staged',
      data: {
        version: '^8.0.4',
        packageName: 'lint-staged',
        files: [],
      },
    },
    'npm:netlify-cli': {
      type: 'npm',
      name: 'npm:netlify-cli',
      data: {
        version: '^2.9.1',
        packageName: 'netlify-cli',
        files: [],
      },
    },
    'npm:ng-packagr': {
      type: 'npm',
      name: 'npm:ng-packagr',
      data: {
        version: '^10.0.1',
        packageName: 'ng-packagr',
        files: [],
      },
    },
    'npm:node-fetch': {
      type: 'npm',
      name: 'npm:node-fetch',
      data: {
        version: '^2.3.0',
        packageName: 'node-fetch',
        files: [],
      },
    },
    'npm:nodemon': {
      type: 'npm',
      name: 'npm:nodemon',
      data: {
        version: '^1.18.3',
        packageName: 'nodemon',
        files: [],
      },
    },
    'npm:nps': {
      type: 'npm',
      name: 'npm:nps',
      data: {
        version: '5.9.3',
        packageName: 'nps',
        files: [],
      },
    },
    'npm:nps-utils': {
      type: 'npm',
      name: 'npm:nps-utils',
      data: {
        version: '1.7.0',
        packageName: 'nps-utils',
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
    'npm:replace-in-file': {
      type: 'npm',
      name: 'npm:replace-in-file',
      data: {
        version: '^6.1.0',
        packageName: 'replace-in-file',
        files: [],
      },
    },
    'npm:request': {
      type: 'npm',
      name: 'npm:request',
      data: {
        version: '^2.88.0',
        packageName: 'request',
        files: [],
      },
    },
    'npm:rimraf': {
      type: 'npm',
      name: 'npm:rimraf',
      data: {
        version: '^2.6.3',
        packageName: 'rimraf',
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
    'npm:sitemap': {
      type: 'npm',
      name: 'npm:sitemap',
      data: {
        version: '^6.1.1',
        packageName: 'sitemap',
        files: [],
      },
    },
    'npm:tmp': {
      type: 'npm',
      name: 'npm:tmp',
      data: {
        version: '^0.0.33',
        packageName: 'tmp',
        files: [],
      },
    },
    'npm:trix': {
      type: 'npm',
      name: 'npm:trix',
      data: {
        version: '^1.0.0',
        packageName: 'trix',
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
    'npm:ts-node': {
      type: 'npm',
      name: 'npm:ts-node',
      data: {
        version: '7.0.1',
        packageName: 'ts-node',
        files: [],
      },
    },
    'npm:tsickle': {
      type: 'npm',
      name: 'npm:tsickle',
      data: {
        version: '>=0.29.0',
        packageName: 'tsickle',
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
    'npm:unzipper': {
      type: 'npm',
      name: 'npm:unzipper',
      data: {
        version: '^0.10.5',
        packageName: 'unzipper',
        files: [],
      },
    },
  },
  dependencies: {
    'nx-cloud-reference-feature-invite-members': [
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-invite-members',
        target: 'nx-cloud-feature-auth',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-invite-members',
        target: 'nx-cloud-utils',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-invite-members',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-invite-members',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-invite-members',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-invite-members',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-invite-members',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-invite-members',
        target: 'npm:@angular/forms',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-invite-members',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-invite-members',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-invite-members',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nx-cloud-data-access-workspace': [
      {
        type: 'static',
        source: 'nx-cloud-data-access-workspace',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-cloud-data-access-workspace',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'nx-cloud-data-access-workspace',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nx-cloud-data-access-workspace',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nx-cloud-data-access-workspace',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'nx-cloud-data-access-workspace',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-cloud-data-access-workspace',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nx-cloud-reference-feature-access-token': [
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-access-token',
        target: 'nx-cloud-utils',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-access-token',
        target: 'nx-cloud-ui-alerts',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-access-token',
        target: 'nx-cloud-reference-util-org-membership',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-access-token',
        target: 'nx-cloud-data-access-workspace',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-access-token',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-access-token',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-access-token',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-access-token',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-access-token',
        target: 'npm:@angular/forms',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-access-token',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-access-token',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-access-token',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nx-cloud-data-access-billing': [
      {
        type: 'static',
        source: 'nx-cloud-data-access-billing',
        target: 'nx-cloud-data-access-graphql',
      },
      {
        type: 'static',
        source: 'nx-cloud-data-access-billing',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-cloud-data-access-billing',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'nx-cloud-data-access-billing',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'nx-cloud-data-access-billing',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nx-cloud-data-access-billing',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-cloud-data-access-billing',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nx-cloud-reference-util-org-membership': [
      {
        type: 'static',
        source: 'nx-cloud-reference-util-org-membership',
        target: 'nx-cloud-feature-auth',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-util-org-membership',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-util-org-membership',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-util-org-membership',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-util-org-membership',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-util-org-membership',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nrwlio-site-pages-feature-style-guide': [
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-style-guide',
        target: 'ui-contents',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-style-guide',
        target: 'nrwlio-site-contentful',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-style-guide',
        target: 'ui-ads',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-style-guide',
        target: 'ui-articles',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-style-guide',
        target: 'ui-downloads',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-style-guide',
        target: 'ui-features',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-style-guide',
        target: 'ui-heros',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-style-guide',
        target: 'ui-images',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-style-guide',
        target: 'ui-testimonials',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-style-guide',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-style-guide',
        target: 'npm:@angular/forms',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-style-guide',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-style-guide',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-style-guide',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-style-guide',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nrwlio-site-pages-feature-contact-us': [
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-contact-us',
        target: 'nrwlio-site-ui-footer',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-contact-us',
        target: 'nrwlio-site-ui-header',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-contact-us',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-contact-us',
        target: 'nrwlio-site-contentful',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-contact-us',
        target: 'nrwlio-site-feature-pages',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-contact-us',
        target: 'nrwlio-site-hubspot',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-contact-us',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-contact-us',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-contact-us',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-contact-us',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-contact-us',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-contact-us',
        target: 'npm:@angular/forms',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-contact-us',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-contact-us',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-contact-us',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nx-cloud-reference-feature-workspace': [
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-workspace',
        target: 'nx-cloud-utils',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-workspace',
        target: 'nx-cloud-data-access-workspace',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-workspace',
        target: 'nx-cloud-reference-feature-access-token',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-workspace',
        target: 'nx-cloud-feature-billing',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-workspace',
        target: 'nx-cloud-ui-alerts',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-workspace',
        target: 'nx-cloud-reference-util-org-membership',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-workspace',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-workspace',
        target: 'npm:d3-selection',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-workspace',
        target: 'npm:d3-axis',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-workspace',
        target: 'npm:d3-scale',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-workspace',
        target: 'npm:d3-transition',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-workspace',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-workspace',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-workspace',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-workspace',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-workspace',
        target: 'npm:@angular/forms',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-workspace',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-workspace',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-workspace',
        target: 'npm:@angular/animations',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-workspace',
        target: 'npm:jest-preset-angular',
      },
    ],
    'platform-data-access-nrwl-changelog': [
      {
        type: 'static',
        source: 'platform-data-access-nrwl-changelog',
        target: 'npm:@angular/platform-browser',
      },
      {
        type: 'static',
        source: 'platform-data-access-nrwl-changelog',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-data-access-nrwl-changelog',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'platform-data-access-nrwl-changelog',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'platform-data-access-nrwl-changelog',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'platform-data-access-nrwl-changelog',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-data-access-nrwl-changelog',
        target: 'npm:core-js',
      },
      {
        type: 'static',
        source: 'platform-data-access-nrwl-changelog',
        target: 'npm:zone.js',
      },
      {
        type: 'static',
        source: 'platform-data-access-nrwl-changelog',
        target: 'npm:@angular/platform-browser-dynamic',
      },
    ],
    'nx-cloud-feature-make-ng-cli-faster': [
      {
        type: 'static',
        source: 'nx-cloud-feature-make-ng-cli-faster',
        target: 'common-site',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-make-ng-cli-faster',
        target: 'common-platform',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-make-ng-cli-faster',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-make-ng-cli-faster',
        target: 'ui-images',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-make-ng-cli-faster',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-make-ng-cli-faster',
        target: 'npm:@angular/cdk',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-make-ng-cli-faster',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-make-ng-cli-faster',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-make-ng-cli-faster',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-make-ng-cli-faster',
        target: 'npm:@angular/platform-browser',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-make-ng-cli-faster',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nx-cloud-reference-data-access-runs': [
      {
        type: 'static',
        source: 'nx-cloud-reference-data-access-runs',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-data-access-runs',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-data-access-runs',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-data-access-runs',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-data-access-runs',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-data-access-runs',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nx-docs-site-feature-documentation': [
      {
        type: 'static',
        source: 'nx-docs-site-feature-documentation',
        target: 'common-site',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-documentation',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-documentation',
        target: 'nx-docs-site-utils-fetcher',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-documentation',
        target: 'nx-docs-site-base-ui',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-documentation',
        target: 'ui-banners',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-documentation',
        target: 'nx-docs-site-feature-flavors',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-documentation',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-documentation',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-documentation',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-documentation',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-documentation',
        target: 'npm:@angular/flex-layout',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-documentation',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nrwlio-site-pages-feature-products': [
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-products',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-products',
        target: 'nrwlio-site-contentful',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-products',
        target: 'nrwlio-site-ui-header',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-products',
        target: 'nrwlio-site-ui-footer',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-products',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-products',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-products',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-products',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-products',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-products',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nrwlio-site-pages-feature-services': [
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-services',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-services',
        target: 'nrwlio-site-ui-header',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-services',
        target: 'nrwlio-site-ui-footer',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-services',
        target: 'ui-images',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-services',
        target: 'ui-heros',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-services',
        target: 'ui-ads',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-services',
        target: 'nrwlio-site-feature-pages',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-services',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-services',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-services',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-services',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-services',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nx-cloud-feature-billing': [
      {
        type: 'static',
        source: 'nx-cloud-feature-billing',
        target: 'nx-cloud-data-access-billing',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-billing',
        target: 'nx-cloud-data-access-graphql',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-billing',
        target: 'nx-cloud-feature-auth',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-billing',
        target: 'nx-cloud-utils',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-billing',
        target: 'nx-cloud-ui-alerts',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-billing',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-billing',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-billing',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-billing',
        target: 'npm:@angular/forms',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-billing',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-billing',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-billing',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-billing',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-billing',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nrwlio-site-pages-feature-about-us': [
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-about-us',
        target: 'nrwlio-site-contentful',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-about-us',
        target: 'nrwlio-site-ui-footer',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-about-us',
        target: 'nrwlio-site-ui-header',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-about-us',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-about-us',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-about-us',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-about-us',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-about-us',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-about-us',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-about-us',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-about-us',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nrwlio-site-pages-feature-careers': [
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-careers',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-careers',
        target: 'nrwlio-site-ui-header',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-careers',
        target: 'nrwlio-site-ui-footer',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-careers',
        target: 'ui-contents',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-careers',
        target: 'ui-testimonials',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-careers',
        target: 'nrwlio-site-hubspot',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-careers',
        target: 'nrwlio-site-analytics',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-careers',
        target: 'nrwlio-site-feature-pages',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-careers',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-careers',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-careers',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-careers',
        target: 'npm:@angular/forms',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-careers',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-careers',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-careers',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nx-cloud-feature-terms-of-service': [
      {
        type: 'static',
        source: 'nx-cloud-feature-terms-of-service',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-terms-of-service',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-terms-of-service',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-terms-of-service',
        target: 'npm:jest-preset-angular',
      },
    ],
    'platform-data-access-live-events': [
      {
        type: 'static',
        source: 'platform-data-access-live-events',
        target: 'npm:@angular/platform-browser',
      },
      {
        type: 'static',
        source: 'platform-data-access-live-events',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-data-access-live-events',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'platform-data-access-live-events',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'platform-data-access-live-events',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'platform-data-access-live-events',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-data-access-live-events',
        target: 'npm:core-js',
      },
      {
        type: 'static',
        source: 'platform-data-access-live-events',
        target: 'npm:zone.js',
      },
      {
        type: 'static',
        source: 'platform-data-access-live-events',
        target: 'npm:@angular/platform-browser-dynamic',
      },
    ],
    'nx-docs-site-feature-file-system': [
      {
        type: 'static',
        source: 'nx-docs-site-feature-file-system',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-file-system',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-file-system',
        target: 'npm:@angular/compiler',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-file-system',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-file-system',
        target: 'npm:jest-preset-angular',
      },
    ],
    'platform-feature-nrwl-changelog': [
      {
        type: 'static',
        source: 'platform-feature-nrwl-changelog',
        target: 'platform-utils',
      },
      {
        type: 'static',
        source: 'platform-feature-nrwl-changelog',
        target: 'platform-data-access-nrwl-changelog',
      },
      {
        type: 'static',
        source: 'platform-feature-nrwl-changelog',
        target: 'platform-components',
      },
      {
        type: 'static',
        source: 'platform-feature-nrwl-changelog',
        target: 'platform-data-access-blurb',
      },
      {
        type: 'static',
        source: 'platform-feature-nrwl-changelog',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'platform-feature-nrwl-changelog',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-feature-nrwl-changelog',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'platform-feature-nrwl-changelog',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'platform-feature-nrwl-changelog',
        target: 'npm:@angular/animations',
      },
      {
        type: 'static',
        source: 'platform-feature-nrwl-changelog',
        target: 'npm:@angular/forms',
      },
      {
        type: 'static',
        source: 'platform-feature-nrwl-changelog',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-feature-nrwl-changelog',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'platform-feature-nrwl-changelog',
        target: 'npm:core-js',
      },
      {
        type: 'static',
        source: 'platform-feature-nrwl-changelog',
        target: 'npm:zone.js',
      },
      {
        type: 'static',
        source: 'platform-feature-nrwl-changelog',
        target: 'npm:@angular/platform-browser-dynamic',
      },
    ],
    'platform-feature-live-broadcast': [
      {
        type: 'static',
        source: 'platform-feature-live-broadcast',
        target: 'platform-utils',
      },
      {
        type: 'static',
        source: 'platform-feature-live-broadcast',
        target: 'platform-components',
      },
      {
        type: 'static',
        source: 'platform-feature-live-broadcast',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'platform-feature-live-broadcast',
        target: 'platform-feature-auth',
      },
      {
        type: 'static',
        source: 'platform-feature-live-broadcast',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-feature-live-broadcast',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'platform-feature-live-broadcast',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'platform-feature-live-broadcast',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'platform-feature-live-broadcast',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'platform-feature-live-broadcast',
        target: 'npm:@angular/animations',
      },
      {
        type: 'static',
        source: 'platform-feature-live-broadcast',
        target: 'npm:@angular/platform-browser',
      },
      {
        type: 'static',
        source: 'platform-feature-live-broadcast',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-feature-live-broadcast',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nrwlio-site-data-access-graphql': [
      {
        type: 'static',
        source: 'nrwlio-site-data-access-graphql',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nrwlio-site-data-access-graphql',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nrwlio-site-data-access-graphql',
        target: 'npm:@angular/platform-browser',
      },
      {
        type: 'static',
        source: 'nrwlio-site-data-access-graphql',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'nrwlio-site-data-access-graphql',
        target: 'npm:apollo-angular-link-http',
      },
      {
        type: 'static',
        source: 'nrwlio-site-data-access-graphql',
        target: 'npm:apollo-cache-inmemory',
      },
      {
        type: 'static',
        source: 'nrwlio-site-data-access-graphql',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nx-cloud-reference-feature-runs': [
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-runs',
        target: 'nx-cloud-reference-data-access-runs',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-runs',
        target: 'nx-cloud-utils',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-runs',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-runs',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-runs',
        target: 'npm:@angular/forms',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-runs',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-runs',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-runs',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-runs',
        target: 'npm:jest-preset-angular',
      },
    ],
    'platform-feature-organizations': [
      {
        type: 'static',
        source: 'platform-feature-organizations',
        target: 'platform-data-access-graphql',
      },
      {
        type: 'static',
        source: 'platform-feature-organizations',
        target: 'platform-utils',
      },
      {
        type: 'static',
        source: 'platform-feature-organizations',
        target: 'npm:karma-jasmine',
      },
      {
        type: 'static',
        source: 'platform-feature-organizations',
        target: 'npm:karma-chrome-launcher',
      },
      {
        type: 'static',
        source: 'platform-feature-organizations',
        target: 'npm:karma-jasmine-html-reporter',
      },
      {
        type: 'static',
        source: 'platform-feature-organizations',
        target: 'npm:karma-coverage-istanbul-reporter',
      },
      {
        type: 'static',
        source: 'platform-feature-organizations',
        target: 'npm:@angular-devkit/build-angular',
      },
      {
        type: 'static',
        source: 'platform-feature-organizations',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-feature-organizations',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'platform-feature-organizations',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'platform-feature-organizations',
        target: 'npm:@loona/angular',
      },
      {
        type: 'static',
        source: 'platform-feature-organizations',
        target: 'npm:apollo-client',
      },
      {
        type: 'static',
        source: 'platform-feature-organizations',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'platform-feature-organizations',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'platform-feature-organizations',
        target: 'npm:@angular/forms',
      },
      {
        type: 'static',
        source: 'platform-feature-organizations',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-feature-organizations',
        target: 'npm:core-js',
      },
      {
        type: 'static',
        source: 'platform-feature-organizations',
        target: 'npm:zone.js',
      },
      {
        type: 'static',
        source: 'platform-feature-organizations',
        target: 'npm:@angular/platform-browser-dynamic',
      },
    ],
    'platform-feature-live-workshop': [
      {
        type: 'static',
        source: 'platform-feature-live-workshop',
        target: 'platform-utils',
      },
      {
        type: 'static',
        source: 'platform-feature-live-workshop',
        target: 'platform-data-access-blurb',
      },
      {
        type: 'static',
        source: 'platform-feature-live-workshop',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'platform-feature-live-workshop',
        target: 'platform-components',
      },
      {
        type: 'static',
        source: 'platform-feature-live-workshop',
        target: 'platform-feature-auth',
      },
      {
        type: 'static',
        source: 'platform-feature-live-workshop',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-feature-live-workshop',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'platform-feature-live-workshop',
        target: 'npm:@angular/forms',
      },
      {
        type: 'static',
        source: 'platform-feature-live-workshop',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'platform-feature-live-workshop',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'platform-feature-live-workshop',
        target: 'npm:@angular/animations',
      },
      {
        type: 'static',
        source: 'platform-feature-live-workshop',
        target: 'npm:@angular/platform-browser',
      },
      {
        type: 'static',
        source: 'platform-feature-live-workshop',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'platform-feature-live-workshop',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-feature-live-workshop',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'platform-feature-live-workshop',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nrwlio-site-pages-feature-home': [
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-home',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-home',
        target: 'nrwlio-site-ui-header',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-home',
        target: 'nrwlio-site-ui-footer',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-home',
        target: 'ui-floating-items',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-home',
        target: 'nrwlio-site-ui-heros',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-home',
        target: 'ui-images',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-home',
        target: 'ui-contents',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-home',
        target: 'ui-ads',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-home',
        target: 'ui-callouts',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-home',
        target: 'nrwlio-site-contentful',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-home',
        target: 'nrwlio-site-feature-pages',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-home',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-home',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-home',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-home',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-home',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-home',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pages-feature-home',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nx-cloud-reference-feature-org': [
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-org',
        target: 'nx-cloud-data-access-workspace',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-org',
        target: 'nx-cloud-reference-feature-workspace',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-org',
        target: 'ui-images',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-org',
        target: 'nx-cloud-reference-feature-invite-members',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-org',
        target: 'nx-cloud-reference-util-org-membership',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-org',
        target: 'nx-cloud-utils',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-org',
        target: 'nx-cloud-feature-auth',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-org',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-org',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-org',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-org',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-org',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-org',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-org',
        target: 'npm:@angular/forms',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-org',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-org',
        target: 'npm:@angular/cdk',
      },
      {
        type: 'static',
        source: 'nx-cloud-reference-feature-org',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nx-cloud-admin-feature-support': [
      {
        type: 'static',
        source: 'nx-cloud-admin-feature-support',
        target: 'nx-cloud-data-access-graphql',
      },
      {
        type: 'static',
        source: 'nx-cloud-admin-feature-support',
        target: 'nx-cloud-utils',
      },
      {
        type: 'static',
        source: 'nx-cloud-admin-feature-support',
        target: 'nx-cloud-feature-auth',
      },
      {
        type: 'static',
        source: 'nx-cloud-admin-feature-support',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-cloud-admin-feature-support',
        target: 'npm:@angular/forms',
      },
      {
        type: 'static',
        source: 'nx-cloud-admin-feature-support',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nx-cloud-admin-feature-support',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nx-cloud-admin-feature-support',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'nx-cloud-admin-feature-support',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'nx-cloud-admin-feature-support',
        target: 'npm:@angular/common',
      },
    ],
    'platform-feature-organization': [
      {
        type: 'static',
        source: 'platform-feature-organization',
        target: 'platform-data-access-graphql',
      },
      {
        type: 'static',
        source: 'platform-feature-organization',
        target: 'platform-utils',
      },
      {
        type: 'static',
        source: 'platform-feature-organization',
        target: 'npm:karma-jasmine',
      },
      {
        type: 'static',
        source: 'platform-feature-organization',
        target: 'npm:karma-chrome-launcher',
      },
      {
        type: 'static',
        source: 'platform-feature-organization',
        target: 'npm:karma-jasmine-html-reporter',
      },
      {
        type: 'static',
        source: 'platform-feature-organization',
        target: 'npm:karma-coverage-istanbul-reporter',
      },
      {
        type: 'static',
        source: 'platform-feature-organization',
        target: 'npm:@angular-devkit/build-angular',
      },
      {
        type: 'static',
        source: 'platform-feature-organization',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-feature-organization',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'platform-feature-organization',
        target: 'npm:@loona/angular',
      },
      {
        type: 'static',
        source: 'platform-feature-organization',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'platform-feature-organization',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'platform-feature-organization',
        target: 'npm:@angular/forms',
      },
      {
        type: 'static',
        source: 'platform-feature-organization',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'platform-feature-organization',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-feature-organization',
        target: 'npm:core-js',
      },
      {
        type: 'static',
        source: 'platform-feature-organization',
        target: 'npm:zone.js',
      },
      {
        type: 'static',
        source: 'platform-feature-organization',
        target: 'npm:@angular/platform-browser-dynamic',
      },
    ],
    'platform-data-access-cookbook': [
      {
        type: 'static',
        source: 'platform-data-access-cookbook',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-data-access-cookbook',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-data-access-cookbook',
        target: 'npm:@angular/platform-browser',
      },
      {
        type: 'static',
        source: 'platform-data-access-cookbook',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'platform-data-access-cookbook',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'platform-data-access-cookbook',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'platform-data-access-cookbook',
        target: 'npm:core-js',
      },
      {
        type: 'static',
        source: 'platform-data-access-cookbook',
        target: 'npm:zone.js',
      },
      {
        type: 'static',
        source: 'platform-data-access-cookbook',
        target: 'npm:@angular/platform-browser-dynamic',
      },
    ],
    'platform-feature-landing-page': [
      {
        type: 'static',
        source: 'platform-feature-landing-page',
        target: 'platform-utils',
      },
      {
        type: 'static',
        source: 'platform-feature-landing-page',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'platform-feature-landing-page',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-feature-landing-page',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'platform-feature-landing-page',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'platform-feature-landing-page',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'platform-feature-landing-page',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'platform-feature-landing-page',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-feature-landing-page',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'platform-feature-landing-page',
        target: 'npm:jest-preset-angular',
      },
    ],
    'platform-data-access-graphql': [
      {
        type: 'static',
        source: 'platform-data-access-graphql',
        target: 'npm:karma-jasmine',
      },
      {
        type: 'static',
        source: 'platform-data-access-graphql',
        target: 'npm:karma-chrome-launcher',
      },
      {
        type: 'static',
        source: 'platform-data-access-graphql',
        target: 'npm:karma-jasmine-html-reporter',
      },
      {
        type: 'static',
        source: 'platform-data-access-graphql',
        target: 'npm:karma-coverage-istanbul-reporter',
      },
      {
        type: 'static',
        source: 'platform-data-access-graphql',
        target: 'npm:@angular-devkit/build-angular',
      },
      {
        type: 'static',
        source: 'platform-data-access-graphql',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-data-access-graphql',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-data-access-graphql',
        target: 'npm:@loona/angular',
      },
      {
        type: 'static',
        source: 'platform-data-access-graphql',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'platform-data-access-graphql',
        target: 'npm:apollo-angular-link-http',
      },
      {
        type: 'static',
        source: 'platform-data-access-graphql',
        target: 'npm:apollo-cache-inmemory',
      },
      {
        type: 'static',
        source: 'platform-data-access-graphql',
        target: 'npm:apollo-link',
      },
      {
        type: 'static',
        source: 'platform-data-access-graphql',
        target: 'npm:graphql',
      },
      {
        type: 'static',
        source: 'platform-data-access-graphql',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'platform-data-access-graphql',
        target: 'npm:core-js',
      },
      {
        type: 'static',
        source: 'platform-data-access-graphql',
        target: 'npm:zone.js',
      },
      {
        type: 'static',
        source: 'platform-data-access-graphql',
        target: 'npm:@angular/platform-browser-dynamic',
      },
    ],
    'platform-feature-live-events': [
      {
        type: 'static',
        source: 'platform-feature-live-events',
        target: 'platform-data-access-live-events',
      },
      {
        type: 'static',
        source: 'platform-feature-live-events',
        target: 'platform-utils',
      },
      {
        type: 'static',
        source: 'platform-feature-live-events',
        target: 'platform-data-access-blurb',
      },
      {
        type: 'static',
        source: 'platform-feature-live-events',
        target: 'platform-feature-live-broadcast',
      },
      {
        type: 'static',
        source: 'platform-feature-live-events',
        target: 'platform-components',
      },
      {
        type: 'static',
        source: 'platform-feature-live-events',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'platform-feature-live-events',
        target: 'platform-ui-twitter',
      },
      {
        type: 'static',
        source: 'platform-feature-live-events',
        target: 'platform-feature-auth',
      },
      {
        type: 'static',
        source: 'platform-feature-live-events',
        target: 'npm:@angular/animations',
      },
      {
        type: 'static',
        source: 'platform-feature-live-events',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-feature-live-events',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'platform-feature-live-events',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'platform-feature-live-events',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'platform-feature-live-events',
        target: 'npm:@angular/forms',
      },
      {
        type: 'static',
        source: 'platform-feature-live-events',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'platform-feature-live-events',
        target: 'npm:@angular/platform-browser',
      },
      {
        type: 'static',
        source: 'platform-feature-live-events',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-feature-live-events',
        target: 'npm:core-js',
      },
      {
        type: 'static',
        source: 'platform-feature-live-events',
        target: 'npm:zone.js',
      },
      {
        type: 'static',
        source: 'platform-feature-live-events',
        target: 'npm:@angular/platform-browser-dynamic',
      },
    ],
    'platform-data-access-courses': [
      {
        type: 'static',
        source: 'platform-data-access-courses',
        target: 'npm:@ngrx/store',
      },
      {
        type: 'static',
        source: 'platform-data-access-courses',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-data-access-courses',
        target: 'npm:@ngrx/effects',
      },
      {
        type: 'static',
        source: 'platform-data-access-courses',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'platform-data-access-courses',
        target: 'npm:@ngrx/entity',
      },
      {
        type: 'static',
        source: 'platform-data-access-courses',
        target: 'npm:@angular/platform-browser',
      },
      {
        type: 'static',
        source: 'platform-data-access-courses',
        target: 'npm:@contentful/rich-text-html-renderer',
      },
      {
        type: 'static',
        source: 'platform-data-access-courses',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'platform-data-access-courses',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'platform-data-access-courses',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-data-access-courses',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nx-cloud-data-access-graphql': [
      {
        type: 'static',
        source: 'nx-cloud-data-access-graphql',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-cloud-data-access-graphql',
        target: 'npm:graphql',
      },
      {
        type: 'static',
        source: 'nx-cloud-data-access-graphql',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-cloud-data-access-graphql',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'nx-cloud-data-access-graphql',
        target: 'npm:apollo-angular-link-http',
      },
      {
        type: 'static',
        source: 'nx-cloud-data-access-graphql',
        target: 'npm:apollo-cache-inmemory',
      },
      {
        type: 'static',
        source: 'nx-cloud-data-access-graphql',
        target: 'npm:apollo-link',
      },
      {
        type: 'static',
        source: 'nx-cloud-data-access-graphql',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nx-docs-site-feature-flavors': [
      {
        type: 'static',
        source: 'nx-docs-site-feature-flavors',
        target: 'nx-docs-site-base-ui',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-flavors',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-flavors',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-flavors',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-flavors',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nx-docs-site-feature-plugins': [
      {
        type: 'static',
        source: 'nx-docs-site-feature-plugins',
        target: 'nx-docs-site-base-ui',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-plugins',
        target: 'common-site',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-plugins',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-plugins',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-plugins',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-plugins',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-plugins',
        target: 'npm:@angular/cdk',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-plugins',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-plugins',
        target: 'npm:jest-preset-angular',
      },
    ],
    'platform-feature-expert-bio': [
      {
        type: 'static',
        source: 'platform-feature-expert-bio',
        target: 'platform-utils',
      },
      {
        type: 'static',
        source: 'platform-feature-expert-bio',
        target: 'platform-ui-expert-bio',
      },
      {
        type: 'static',
        source: 'platform-feature-expert-bio',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-feature-expert-bio',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'platform-feature-expert-bio',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'platform-feature-expert-bio',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'platform-feature-expert-bio',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'platform-feature-expert-bio',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-feature-expert-bio',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nrwlio-site-ui-text-sliders': [
      {
        type: 'static',
        source: 'nrwlio-site-ui-text-sliders',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nrwlio-site-ui-text-sliders',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nrwlio-site-ui-text-sliders',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nrwlio-site-ui-text-sliders',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nx-docs-site-feature-search': [
      {
        type: 'static',
        source: 'nx-docs-site-feature-search',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-search',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-search',
        target: 'npm:jest-preset-angular',
      },
    ],
    'platform-feature-dashboard': [
      {
        type: 'static',
        source: 'platform-feature-dashboard',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'platform-feature-dashboard',
        target: 'platform-data-access-courses',
      },
      {
        type: 'static',
        source: 'platform-feature-dashboard',
        target: 'platform-data-access-blurb',
      },
      {
        type: 'static',
        source: 'platform-feature-dashboard',
        target: 'platform-data-access-graphql',
      },
      {
        type: 'static',
        source: 'platform-feature-dashboard',
        target: 'platform-utils',
      },
      {
        type: 'static',
        source: 'platform-feature-dashboard',
        target: 'platform-data-access-book',
      },
      {
        type: 'static',
        source: 'platform-feature-dashboard',
        target: 'platform-data-access-nrwl-changelog',
      },
      {
        type: 'static',
        source: 'platform-feature-dashboard',
        target: 'platform-data-access-live-events',
      },
      {
        type: 'static',
        source: 'platform-feature-dashboard',
        target: 'platform-data-access-cookbook',
      },
      {
        type: 'static',
        source: 'platform-feature-dashboard',
        target: 'npm:karma-jasmine',
      },
      {
        type: 'static',
        source: 'platform-feature-dashboard',
        target: 'npm:karma-chrome-launcher',
      },
      {
        type: 'static',
        source: 'platform-feature-dashboard',
        target: 'npm:karma-jasmine-html-reporter',
      },
      {
        type: 'static',
        source: 'platform-feature-dashboard',
        target: 'npm:karma-coverage-istanbul-reporter',
      },
      {
        type: 'static',
        source: 'platform-feature-dashboard',
        target: 'npm:@angular-devkit/build-angular',
      },
      {
        type: 'static',
        source: 'platform-feature-dashboard',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-feature-dashboard',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-feature-dashboard',
        target: 'npm:@angular/forms',
      },
      {
        type: 'static',
        source: 'platform-feature-dashboard',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'platform-feature-dashboard',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'platform-feature-dashboard',
        target: 'npm:@angular/flex-layout',
      },
      {
        type: 'static',
        source: 'platform-feature-dashboard',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'platform-feature-dashboard',
        target: 'npm:@angular/platform-browser',
      },
      {
        type: 'static',
        source: 'platform-feature-dashboard',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'platform-feature-dashboard',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'platform-feature-dashboard',
        target: 'npm:@ngrx/store',
      },
      {
        type: 'static',
        source: 'platform-feature-dashboard',
        target: 'npm:core-js',
      },
      {
        type: 'static',
        source: 'platform-feature-dashboard',
        target: 'npm:zone.js',
      },
      {
        type: 'static',
        source: 'platform-feature-dashboard',
        target: 'npm:@angular/platform-browser-dynamic',
      },
    ],
    'platform-data-access-blurb': [
      {
        type: 'static',
        source: 'platform-data-access-blurb',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-data-access-blurb',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'platform-data-access-blurb',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'platform-data-access-blurb',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'platform-data-access-blurb',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-data-access-blurb',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nx-docs-site-utils-fetcher': [
      {
        type: 'static',
        source: 'nx-docs-site-utils-fetcher',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-docs-site-utils-fetcher',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nx-docs-site-utils-fetcher',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-docs-site-utils-fetcher',
        target: 'npm:jest-preset-angular',
      },
    ],
    'platform-data-access-book': [
      {
        type: 'static',
        source: 'platform-data-access-book',
        target: 'npm:@angular/platform-browser',
      },
      {
        type: 'static',
        source: 'platform-data-access-book',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-data-access-book',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'platform-data-access-book',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'platform-data-access-book',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'platform-data-access-book',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-data-access-book',
        target: 'npm:core-js',
      },
      {
        type: 'static',
        source: 'platform-data-access-book',
        target: 'npm:zone.js',
      },
      {
        type: 'static',
        source: 'platform-data-access-book',
        target: 'npm:@angular/platform-browser-dynamic',
      },
    ],
    'nx-docs-site-feature-home': [
      {
        type: 'static',
        source: 'nx-docs-site-feature-home',
        target: 'nx-docs-site-base-ui',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-home',
        target: 'nx-docs-site-feature-flavors',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-home',
        target: 'common-site',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-home',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-home',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-home',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-home',
        target: 'npm:@angular/forms',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-home',
        target: 'npm:@angular/flex-layout',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-home',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nx-docs-site-feature-home',
        target: 'npm:jest-preset-angular',
      },
    ],
    'platform-feature-cookbook': [
      {
        type: 'static',
        source: 'platform-feature-cookbook',
        target: 'platform-data-access-cookbook',
      },
      {
        type: 'static',
        source: 'platform-feature-cookbook',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'platform-feature-cookbook',
        target: 'platform-components',
      },
      {
        type: 'static',
        source: 'platform-feature-cookbook',
        target: 'platform-data-access-blurb',
      },
      {
        type: 'static',
        source: 'platform-feature-cookbook',
        target: 'platform-ui-twitter',
      },
      {
        type: 'static',
        source: 'platform-feature-cookbook',
        target: 'platform-feature-auth',
      },
      {
        type: 'static',
        source: 'platform-feature-cookbook',
        target: 'platform-utils',
      },
      {
        type: 'static',
        source: 'platform-feature-cookbook',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-feature-cookbook',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-feature-cookbook',
        target: 'npm:@angular/forms',
      },
      {
        type: 'static',
        source: 'platform-feature-cookbook',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'platform-feature-cookbook',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'platform-feature-cookbook',
        target: 'npm:@angular/animations',
      },
      {
        type: 'static',
        source: 'platform-feature-cookbook',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'platform-feature-cookbook',
        target: 'npm:core-js',
      },
      {
        type: 'static',
        source: 'platform-feature-cookbook',
        target: 'npm:zone.js',
      },
      {
        type: 'static',
        source: 'platform-feature-cookbook',
        target: 'npm:@angular/platform-browser-dynamic',
      },
    ],
    'platform-feature-policies': [
      {
        type: 'static',
        source: 'platform-feature-policies',
        target: 'platform-utils',
      },
      {
        type: 'static',
        source: 'platform-feature-policies',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-feature-policies',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-feature-policies',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'platform-feature-policies',
        target: 'npm:jest-preset-angular',
      },
    ],
    'shared-utils-download-csv': [],
    'nrwlio-site-feature-pages': [
      {
        type: 'static',
        source: 'nrwlio-site-feature-pages',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'nrwlio-site-feature-pages',
        target: 'nrwlio-site-ui-header',
      },
      {
        type: 'static',
        source: 'nrwlio-site-feature-pages',
        target: 'nrwlio-site-ui-footer',
      },
      {
        type: 'static',
        source: 'nrwlio-site-feature-pages',
        target: 'nrwlio-site-contentful',
      },
      {
        type: 'static',
        source: 'nrwlio-site-feature-pages',
        target: 'common-platform',
      },
      {
        type: 'static',
        source: 'nrwlio-site-feature-pages',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nrwlio-site-feature-pages',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nrwlio-site-feature-pages',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nrwlio-site-feature-pages',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nrwlio-site-feature-pages',
        target: 'npm:@angular/platform-browser',
      },
      {
        type: 'static',
        source: 'nrwlio-site-feature-pages',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nrwlio-site-feature-pages',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'nrwlio-site-feature-pages',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'nrwlio-site-feature-pages',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nx-cloud-feature-policies': [
      {
        type: 'static',
        source: 'nx-cloud-feature-policies',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-policies',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-policies',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-policies',
        target: 'npm:jest-preset-angular',
      },
    ],
    'design-system-buttons-e2e': [
      {
        type: 'implicit',
        source: 'design-system-buttons-e2e',
        target: 'design-system-buttons',
      },
      {
        type: 'static',
        source: 'design-system-buttons-e2e',
        target: 'npm:@nrwl/cypress',
      },
    ],
    'platform-feature-courses': [
      {
        type: 'static',
        source: 'platform-feature-courses',
        target: 'platform-components',
      },
      {
        type: 'static',
        source: 'platform-feature-courses',
        target: 'platform-data-access-blurb',
      },
      {
        type: 'static',
        source: 'platform-feature-courses',
        target: 'platform-data-access-courses',
      },
      {
        type: 'static',
        source: 'platform-feature-courses',
        target: 'platform-feature-auth',
      },
      {
        type: 'static',
        source: 'platform-feature-courses',
        target: 'platform-ui-courses',
      },
      {
        type: 'static',
        source: 'platform-feature-courses',
        target: 'platform-ui-twitter',
      },
      {
        type: 'static',
        source: 'platform-feature-courses',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'platform-feature-courses',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-feature-courses',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-feature-courses',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'platform-feature-courses',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'platform-feature-courses',
        target: 'npm:jest-preset-angular',
      },
    ],
    'platform-feature-reports': [
      {
        type: 'static',
        source: 'platform-feature-reports',
        target: 'shared-utils-download-csv',
      },
      {
        type: 'static',
        source: 'platform-feature-reports',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-feature-reports',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-feature-reports',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'platform-feature-reports',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'platform-feature-reports',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'platform-feature-reports',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'platform-feature-reports',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'platform-feature-reports',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nx-cloud-feature-landing': [
      {
        type: 'static',
        source: 'nx-cloud-feature-landing',
        target: 'nx-cloud-feature-auth',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-landing',
        target: 'nx-cloud-ui-footer',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-landing',
        target: 'ui-heros',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-landing',
        target: 'ui-articles',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-landing',
        target: 'ui-floating-items',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-landing',
        target: 'ui-ads',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-landing',
        target: 'ui-images',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-landing',
        target: 'ui-article-media',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-landing',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-landing',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-landing',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-landing',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-landing',
        target: 'npm:@angular/forms',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-landing',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-landing',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nx-cloud-feature-pricing': [
      {
        type: 'static',
        source: 'nx-cloud-feature-pricing',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-pricing',
        target: 'ui-images',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-pricing',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-pricing',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-pricing',
        target: 'npm:@angular/forms',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-pricing',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-pricing',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-pricing',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-pricing',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-pricing',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-pricing',
        target: 'npm:jest-preset-angular',
      },
    ],
    'platform-feature-topics': [
      {
        type: 'static',
        source: 'platform-feature-topics',
        target: 'platform-components',
      },
      {
        type: 'static',
        source: 'platform-feature-topics',
        target: 'platform-data-access-blurb',
      },
      {
        type: 'static',
        source: 'platform-feature-topics',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'platform-feature-topics',
        target: 'platform-ui-twitter',
      },
      {
        type: 'static',
        source: 'platform-feature-topics',
        target: 'platform-feature-auth',
      },
      {
        type: 'static',
        source: 'platform-feature-topics',
        target: 'platform-utils',
      },
      {
        type: 'static',
        source: 'platform-feature-topics',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-feature-topics',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-feature-topics',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'platform-feature-topics',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'platform-feature-topics',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'platform-feature-topics',
        target: 'npm:@angular/platform-browser',
      },
      {
        type: 'static',
        source: 'platform-feature-topics',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'platform-feature-topics',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'platform-feature-topics',
        target: 'npm:@contentful/rich-text-html-renderer',
      },
      {
        type: 'static',
        source: 'platform-feature-topics',
        target: 'npm:jest-preset-angular',
      },
    ],
    'platform-feature-users': [
      {
        type: 'static',
        source: 'platform-feature-users',
        target: 'platform-data-access-graphql',
      },
      {
        type: 'static',
        source: 'platform-feature-users',
        target: 'platform-utils',
      },
      {
        type: 'static',
        source: 'platform-feature-users',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-feature-users',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'platform-feature-users',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'platform-feature-users',
        target: 'npm:@loona/angular',
      },
      {
        type: 'static',
        source: 'platform-feature-users',
        target: 'npm:apollo-client',
      },
      {
        type: 'static',
        source: 'platform-feature-users',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'platform-feature-users',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'platform-feature-users',
        target: 'npm:@angular/forms',
      },
      {
        type: 'static',
        source: 'platform-feature-users',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-feature-users',
        target: 'npm:core-js',
      },
      {
        type: 'static',
        source: 'platform-feature-users',
        target: 'npm:zone.js',
      },
      {
        type: 'static',
        source: 'platform-feature-users',
        target: 'npm:@angular/platform-browser-dynamic',
      },
    ],
    'platform-feature-books': [
      {
        type: 'static',
        source: 'platform-feature-books',
        target: 'platform-utils',
      },
      {
        type: 'static',
        source: 'platform-feature-books',
        target: 'platform-data-access-book',
      },
      {
        type: 'static',
        source: 'platform-feature-books',
        target: 'platform-data-access-blurb',
      },
      {
        type: 'static',
        source: 'platform-feature-books',
        target: 'platform-components',
      },
      {
        type: 'static',
        source: 'platform-feature-books',
        target: 'platform-ui-twitter',
      },
      {
        type: 'static',
        source: 'platform-feature-books',
        target: 'platform-feature-auth',
      },
      {
        type: 'static',
        source: 'platform-feature-books',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'platform-feature-books',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-feature-books',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'platform-feature-books',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'platform-feature-books',
        target: 'npm:@angular/animations',
      },
      {
        type: 'static',
        source: 'platform-feature-books',
        target: 'npm:@angular/forms',
      },
      {
        type: 'static',
        source: 'platform-feature-books',
        target: 'npm:epubjs',
      },
      {
        type: 'static',
        source: 'platform-feature-books',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-feature-books',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'platform-feature-books',
        target: 'npm:core-js',
      },
      {
        type: 'static',
        source: 'platform-feature-books',
        target: 'npm:zone.js',
      },
      {
        type: 'static',
        source: 'platform-feature-books',
        target: 'npm:@angular/platform-browser-dynamic',
      },
    ],
    'platform-ui-expert-bio': [
      {
        type: 'static',
        source: 'platform-ui-expert-bio',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'platform-ui-expert-bio',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-ui-expert-bio',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'platform-ui-expert-bio',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-ui-expert-bio',
        target: 'npm:@angular/flex-layout',
      },
      {
        type: 'static',
        source: 'platform-ui-expert-bio',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'platform-ui-expert-bio',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nrwlio-site-contentful': [
      {
        type: 'static',
        source: 'nrwlio-site-contentful',
        target: 'ui-ads',
      },
      {
        type: 'static',
        source: 'nrwlio-site-contentful',
        target: 'ui-articles',
      },
      {
        type: 'static',
        source: 'nrwlio-site-contentful',
        target: 'ui-contents',
      },
      {
        type: 'static',
        source: 'nrwlio-site-contentful',
        target: 'ui-downloads',
      },
      {
        type: 'static',
        source: 'nrwlio-site-contentful',
        target: 'ui-heros',
      },
      {
        type: 'static',
        source: 'nrwlio-site-contentful',
        target: 'ui-features',
      },
      {
        type: 'static',
        source: 'nrwlio-site-contentful',
        target: 'ui-testimonials',
      },
      {
        type: 'static',
        source: 'nrwlio-site-contentful',
        target: 'nrwlio-site-hubspot',
      },
      {
        type: 'static',
        source: 'nrwlio-site-contentful',
        target: 'common-platform',
      },
      {
        type: 'static',
        source: 'nrwlio-site-contentful',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nrwlio-site-contentful',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'nrwlio-site-contentful',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'nrwlio-site-contentful',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nrwlio-site-contentful',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nrwlio-site-contentful',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nrwlio-site-contentful',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nrwlio-site-contentful',
        target: 'npm:@angular/platform-browser',
      },
      {
        type: 'static',
        source: 'nrwlio-site-contentful',
        target: 'npm:jest-preset-angular',
      },
    ],
    'platform-feature-about': [
      {
        type: 'static',
        source: 'platform-feature-about',
        target: 'platform-utils',
      },
      {
        type: 'static',
        source: 'platform-feature-about',
        target: 'platform-data-access-blurb',
      },
      {
        type: 'static',
        source: 'platform-feature-about',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'platform-feature-about',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-feature-about',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-feature-about',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'platform-feature-about',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'platform-feature-about',
        target: 'npm:jest-preset-angular',
      },
    ],
    'platform-feature-auth': [
      {
        type: 'static',
        source: 'platform-feature-auth',
        target: 'platform-utils',
      },
      {
        type: 'static',
        source: 'platform-feature-auth',
        target: 'platform-data-access-graphql',
      },
      {
        type: 'static',
        source: 'platform-feature-auth',
        target: 'npm:karma-jasmine',
      },
      {
        type: 'static',
        source: 'platform-feature-auth',
        target: 'npm:karma-chrome-launcher',
      },
      {
        type: 'static',
        source: 'platform-feature-auth',
        target: 'npm:karma-jasmine-html-reporter',
      },
      {
        type: 'static',
        source: 'platform-feature-auth',
        target: 'npm:karma-coverage-istanbul-reporter',
      },
      {
        type: 'static',
        source: 'platform-feature-auth',
        target: 'npm:@angular-devkit/build-angular',
      },
      {
        type: 'static',
        source: 'platform-feature-auth',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-feature-auth',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'platform-feature-auth',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'platform-feature-auth',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'platform-feature-auth',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'platform-feature-auth',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-feature-auth',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'platform-feature-auth',
        target: 'npm:core-js',
      },
      {
        type: 'static',
        source: 'platform-feature-auth',
        target: 'npm:zone.js',
      },
      {
        type: 'static',
        source: 'platform-feature-auth',
        target: 'npm:@angular/platform-browser-dynamic',
      },
    ],
    'nrwlio-site-ui-styles': [
      {
        type: 'static',
        source: 'nrwlio-site-ui-styles',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nrwlio-site-ui-footer': [
      {
        type: 'static',
        source: 'nrwlio-site-ui-footer',
        target: 'nrwlio-site-hubspot',
      },
      {
        type: 'static',
        source: 'nrwlio-site-ui-footer',
        target: 'nrwlio-site-analytics',
      },
      {
        type: 'static',
        source: 'nrwlio-site-ui-footer',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nrwlio-site-ui-footer',
        target: 'npm:@angular/forms',
      },
      {
        type: 'static',
        source: 'nrwlio-site-ui-footer',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nrwlio-site-ui-footer',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nrwlio-site-ui-footer',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nrwlio-site-ui-footer',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nrwlio-site-ui-footer',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nrwlio-site-ui-header': [
      {
        type: 'static',
        source: 'nrwlio-site-ui-header',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nrwlio-site-ui-header',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nrwlio-site-ui-header',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nrwlio-site-ui-header',
        target: 'npm:@angular/cdk',
      },
      {
        type: 'static',
        source: 'nrwlio-site-ui-header',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nrwlio-site-ui-header',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nrwlio-site-ui-header',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nrwlio-site-analytics': [
      {
        type: 'static',
        source: 'nrwlio-site-analytics',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nrwlio-site-analytics',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nrwlio-site-analytics',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nx-cloud-feature-auth': [
      {
        type: 'static',
        source: 'nx-cloud-feature-auth',
        target: 'nx-cloud-data-access-graphql',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-auth',
        target: 'nx-cloud-utils',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-auth',
        target: 'platform-data-access-graphql',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-auth',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-auth',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-auth',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-auth',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-auth',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-auth',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-auth',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-auth',
        target: 'npm:@angular/forms',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-auth',
        target: 'npm:apollo-client',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-auth',
        target: 'npm:auth0-js',
      },
    ],
    'design-system-buttons': [
      {
        type: 'static',
        source: 'design-system-buttons',
        target: 'npm:@storybook/angular',
      },
      {
        type: 'static',
        source: 'design-system-buttons',
        target: 'npm:@storybook/addon-knobs',
      },
      {
        type: 'static',
        source: 'design-system-buttons',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'design-system-buttons',
        target: 'npm:@angular/cdk',
      },
      {
        type: 'static',
        source: 'design-system-buttons',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'design-system-buttons',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nx-packages-nx-cloud': [
      {
        type: 'static',
        source: 'nx-packages-nx-cloud',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: 'nx-packages-nx-cloud',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nx-packages-nx-cloud',
        target: 'npm:uuid',
      },
      {
        type: 'static',
        source: 'nx-packages-nx-cloud',
        target: 'npm:node-machine-id',
      },
      {
        type: 'static',
        source: 'nx-packages-nx-cloud',
        target: 'npm:axios',
      },
      {
        type: 'static',
        source: 'nx-packages-nx-cloud',
        target: 'npm:tar',
      },
    ],
    'nx-docs-site-base-ui': [
      {
        type: 'static',
        source: 'nx-docs-site-base-ui',
        target: 'nx-docs-site-styles',
      },
      {
        type: 'static',
        source: 'nx-docs-site-base-ui',
        target: 'nx-docs-site-feature-search',
      },
      {
        type: 'static',
        source: 'nx-docs-site-base-ui',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-docs-site-base-ui',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-docs-site-base-ui',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nx-docs-site-base-ui',
        target: 'npm:@angular/forms',
      },
      {
        type: 'static',
        source: 'nx-docs-site-base-ui',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nx-docs-site-base-ui',
        target: 'npm:@angular/cdk',
      },
      {
        type: 'static',
        source: 'nx-docs-site-base-ui',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nx-docs-site-base-ui',
        target: 'npm:@angular/flex-layout',
      },
      {
        type: 'static',
        source: 'nx-docs-site-base-ui',
        target: 'npm:@angular/platform-browser',
      },
      {
        type: 'static',
        source: 'nx-docs-site-base-ui',
        target: 'npm:@angular/animations',
      },
      {
        type: 'static',
        source: 'nx-docs-site-base-ui',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nrwlio-site-ui-heros': [
      {
        type: 'static',
        source: 'nrwlio-site-ui-heros',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'nrwlio-site-ui-heros',
        target: 'nrwlio-site-ui-text-sliders',
      },
      {
        type: 'static',
        source: 'nrwlio-site-ui-heros',
        target: 'ui-images',
      },
      {
        type: 'static',
        source: 'nrwlio-site-ui-heros',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nrwlio-site-ui-heros',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nrwlio-site-ui-heros',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nrwlio-site-ui-heros',
        target: 'npm:jest-preset-angular',
      },
    ],
    'ui-article-container': [
      {
        type: 'static',
        source: 'ui-article-container',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'ui-article-container',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'ui-article-container',
        target: 'npm:@angular/cdk',
      },
      {
        type: 'static',
        source: 'ui-article-container',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'ui-article-container',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nx-cloud-feature-faq': [
      {
        type: 'static',
        source: 'nx-cloud-feature-faq',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-faq',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-faq',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-faq',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-faq',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-faq',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-faq',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-faq',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nx-cloud-feature-faq',
        target: 'npm:jest-preset-angular',
      },
    ],
    'design-system-styles': [],
    'platform-components': [
      {
        type: 'static',
        source: 'platform-components',
        target: 'platform-data-access-graphql',
      },
      {
        type: 'static',
        source: 'platform-components',
        target: 'platform-utils',
      },
      {
        type: 'static',
        source: 'platform-components',
        target: 'npm:karma-jasmine',
      },
      {
        type: 'static',
        source: 'platform-components',
        target: 'npm:karma-chrome-launcher',
      },
      {
        type: 'static',
        source: 'platform-components',
        target: 'npm:karma-jasmine-html-reporter',
      },
      {
        type: 'static',
        source: 'platform-components',
        target: 'npm:karma-coverage-istanbul-reporter',
      },
      {
        type: 'static',
        source: 'platform-components',
        target: 'npm:@angular-devkit/build-angular',
      },
      {
        type: 'static',
        source: 'platform-components',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-components',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-components',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'platform-components',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'platform-components',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'platform-components',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'platform-components',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'platform-components',
        target: 'npm:@angular/animations',
      },
      {
        type: 'static',
        source: 'platform-components',
        target: 'npm:core-js',
      },
      {
        type: 'static',
        source: 'platform-components',
        target: 'npm:zone.js',
      },
      {
        type: 'static',
        source: 'platform-components',
        target: 'npm:@angular/platform-browser-dynamic',
      },
    ],
    'platform-scss-utils': [],
    'nx-docs-site-styles': [
      {
        type: 'static',
        source: 'nx-docs-site-styles',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-docs-site-styles',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-docs-site-styles',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nx-docs-site-styles',
        target: 'npm:jest-preset-angular',
      },
    ],
    'platform-ui-courses': [
      {
        type: 'static',
        source: 'platform-ui-courses',
        target: 'platform-data-access-courses',
      },
      {
        type: 'static',
        source: 'platform-ui-courses',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-ui-courses',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-ui-courses',
        target: 'npm:jest-preset-angular',
      },
    ],
    'platform-ui-twitter': [
      {
        type: 'static',
        source: 'platform-ui-twitter',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-ui-twitter',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-ui-twitter',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'platform-ui-twitter',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nrwlio-site-hubspot': [
      {
        type: 'static',
        source: 'nrwlio-site-hubspot',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nrwlio-site-hubspot',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nrwlio-site-hubspot',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nrwlio-site-hubspot',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nrwlio-site-hubspot',
        target: 'npm:jest-preset-angular',
      },
    ],
    'shared-ui-markdown': [
      {
        type: 'static',
        source: 'shared-ui-markdown',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'shared-ui-markdown',
        target: 'npm:ngx-markdown',
      },
      {
        type: 'static',
        source: 'shared-ui-markdown',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'shared-ui-markdown',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nrwlio-site-assets': [
      {
        type: 'static',
        source: 'nrwlio-site-assets',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nx-cloud-ui-styles': [],
    'nx-cloud-ui-header': [
      {
        type: 'static',
        source: 'nx-cloud-ui-header',
        target: 'nx-cloud-data-access-graphql',
      },
      {
        type: 'static',
        source: 'nx-cloud-ui-header',
        target: 'nx-cloud-utils',
      },
      {
        type: 'static',
        source: 'nx-cloud-ui-header',
        target: 'nx-cloud-feature-billing',
      },
      {
        type: 'static',
        source: 'nx-cloud-ui-header',
        target: 'nx-cloud-admin-feature-support',
      },
      {
        type: 'static',
        source: 'nx-cloud-ui-header',
        target: 'nx-cloud-feature-auth',
      },
      {
        type: 'static',
        source: 'nx-cloud-ui-header',
        target: 'ui-images',
      },
      {
        type: 'static',
        source: 'nx-cloud-ui-header',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-cloud-ui-header',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nx-cloud-ui-header',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'nx-cloud-ui-header',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'nx-cloud-ui-header',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nx-cloud-ui-header',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nx-cloud-ui-header',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-cloud-ui-header',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nx-cloud-ui-footer': [
      {
        type: 'static',
        source: 'nx-cloud-ui-footer',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-cloud-ui-footer',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-cloud-ui-footer',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nx-cloud-ui-footer',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nx-cloud-ui-footer',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nx-cloud-ui-alerts': [
      {
        type: 'static',
        source: 'nx-cloud-ui-alerts',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-cloud-ui-alerts',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-cloud-ui-alerts',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nx-cloud-ui-alerts',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nrwl-api-reporting': [
      {
        type: 'static',
        source: 'nrwl-api-reporting',
        target: 'npm:mongodb',
      },
      {
        type: 'static',
        source: 'nrwl-api-reporting',
        target: 'npm:dotenv',
      },
      {
        type: 'static',
        source: 'nrwl-api-reporting',
        target: 'npm:date-fns',
      },
      {
        type: 'static',
        source: 'nrwl-api-reporting',
        target: 'npm:googleapis',
      },
      {
        type: 'static',
        source: 'nrwl-api-reporting',
        target: 'npm:axios',
      },
      {
        type: 'static',
        source: 'nrwl-api-reporting',
        target: 'npm:axios-retry',
      },
      {
        type: 'static',
        source: 'nrwl-api-reporting',
        target: 'npm:request',
      },
    ],
    'private-nx-cloud': [
      {
        type: 'static',
        source: 'private-nx-cloud',
        target: 'npm:axios',
      },
    ],
    'ui-floating-items': [
      {
        type: 'static',
        source: 'ui-floating-items',
        target: 'ui-images',
      },
      {
        type: 'static',
        source: 'ui-floating-items',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'ui-floating-items',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'ui-floating-items',
        target: 'npm:jest-preset-angular',
      },
    ],
    'design-system-e2e': [
      {
        type: 'implicit',
        source: 'design-system-e2e',
        target: 'design-system',
      },
      {
        type: 'static',
        source: 'design-system-e2e',
        target: 'npm:@nrwl/cypress',
      },
    ],
    'nx-docs-site-e2e': [
      {
        type: 'implicit',
        source: 'nx-docs-site-e2e',
        target: 'nx-docs-site',
      },
    ],
    'ui-article-media': [
      {
        type: 'static',
        source: 'ui-article-media',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'ui-article-media',
        target: 'ui-images',
      },
      {
        type: 'static',
        source: 'ui-article-media',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'ui-article-media',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'ui-article-media',
        target: 'npm:@angular/cdk',
      },
      {
        type: 'static',
        source: 'ui-article-media',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'ui-article-media',
        target: 'npm:jest-preset-angular',
      },
    ],
    'common-platform': [
      {
        type: 'static',
        source: 'common-platform',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'common-platform',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'common-platform',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nrwlio-site-pwa': [
      {
        type: 'static',
        source: 'nrwlio-site-pwa',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pwa',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pwa',
        target: 'npm:@angular/service-worker',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pwa',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pwa',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nrwlio-site-pwa',
        target: 'npm:jest-preset-angular',
      },
    ],
    'ui-testimonials': [
      {
        type: 'static',
        source: 'ui-testimonials',
        target: 'ui-images',
      },
      {
        type: 'static',
        source: 'ui-testimonials',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'ui-testimonials',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'ui-testimonials',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'ui-testimonials',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nx-cloud-assets': [],
    'platform-utils': [
      {
        type: 'static',
        source: 'platform-utils',
        target: 'platform-data-access-graphql',
      },
      {
        type: 'static',
        source: 'platform-utils',
        target: 'npm:karma-jasmine',
      },
      {
        type: 'static',
        source: 'platform-utils',
        target: 'npm:karma-chrome-launcher',
      },
      {
        type: 'static',
        source: 'platform-utils',
        target: 'npm:karma-jasmine-html-reporter',
      },
      {
        type: 'static',
        source: 'platform-utils',
        target: 'npm:karma-coverage-istanbul-reporter',
      },
      {
        type: 'static',
        source: 'platform-utils',
        target: 'npm:@angular-devkit/build-angular',
      },
      {
        type: 'static',
        source: 'platform-utils',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform-utils',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'platform-utils',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'platform-utils',
        target: 'npm:apollo-client',
      },
      {
        type: 'static',
        source: 'platform-utils',
        target: 'npm:auth0-js',
      },
      {
        type: 'static',
        source: 'platform-utils',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'platform-utils',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'platform-utils',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'platform-utils',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform-utils',
        target: 'npm:core-js',
      },
      {
        type: 'static',
        source: 'platform-utils',
        target: 'npm:zone.js',
      },
      {
        type: 'static',
        source: 'platform-utils',
        target: 'npm:@angular/platform-browser-dynamic',
      },
    ],
    'nx-cloud-utils': [
      {
        type: 'static',
        source: 'nx-cloud-utils',
        target: 'nx-cloud-data-access-graphql',
      },
      {
        type: 'static',
        source: 'nx-cloud-utils',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-cloud-utils',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nx-cloud-utils',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nx-cloud-utils',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-cloud-utils',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nx-docs-site': [
      {
        type: 'static',
        source: 'nx-docs-site',
        target: 'nx-docs-site-base-ui',
      },
      {
        type: 'static',
        source: 'nx-docs-site',
        target: 'common-platform',
      },
      {
        type: 'static',
        source: 'nx-docs-site',
        target: 'nx-docs-site-utils-fetcher',
      },
      {
        type: 'static',
        source: 'nx-docs-site',
        target: 'nx-docs-site-feature-search',
      },
      {
        type: 'dynamic',
        source: 'nx-docs-site',
        target: 'nx-docs-site-feature-plugins',
      },
      {
        type: 'dynamic',
        source: 'nx-docs-site',
        target: 'nx-docs-site-feature-home',
      },
      {
        type: 'dynamic',
        source: 'nx-docs-site',
        target: 'nx-docs-site-feature-documentation',
      },
      {
        type: 'static',
        source: 'nx-docs-site',
        target: 'nx-docs-site-feature-file-system',
      },
      {
        type: 'static',
        source: 'nx-docs-site',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-docs-site',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nx-docs-site',
        target: 'npm:@angular/platform-browser',
      },
      {
        type: 'static',
        source: 'nx-docs-site',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-docs-site',
        target: 'npm:ngx-markdown',
      },
      {
        type: 'static',
        source: 'nx-docs-site',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nx-docs-site',
        target: 'npm:@angular/platform-server',
      },
      {
        type: 'static',
        source: 'nx-docs-site',
        target: 'npm:@angular/flex-layout',
      },
      {
        type: 'static',
        source: 'nx-docs-site',
        target: 'npm:@angular/platform-browser-dynamic',
      },
      {
        type: 'static',
        source: 'nx-docs-site',
        target: 'npm:zone.js',
      },
      {
        type: 'static',
        source: 'nx-docs-site',
        target: 'npm:jest-preset-angular',
      },
    ],
    'design-system': [
      {
        type: 'static',
        source: 'design-system',
        target: 'design-system-buttons',
      },
      {
        type: 'implicit',
        source: 'design-system',
        target: 'design-system-styles',
      },
      {
        type: 'static',
        source: 'design-system',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'design-system',
        target: 'npm:@angular/platform-browser',
      },
      {
        type: 'static',
        source: 'design-system',
        target: 'npm:@angular/platform-browser-dynamic',
      },
      {
        type: 'static',
        source: 'design-system',
        target: 'npm:zone.js',
      },
      {
        type: 'static',
        source: 'design-system',
        target: 'npm:jest-preset-angular',
      },
    ],
    'platform-e2e': [
      {
        type: 'implicit',
        source: 'platform-e2e',
        target: 'platform',
      },
      {
        type: 'static',
        source: 'platform-e2e',
        target: 'npm:@nrwl/cypress',
      },
      {
        type: 'static',
        source: 'platform-e2e',
        target: 'npm:dotenv',
      },
    ],
    'nrwl-api-e2e': [
      {
        type: 'implicit',
        source: 'nrwl-api-e2e',
        target: 'nrwl-api',
      },
      {
        type: 'static',
        source: 'nrwl-api-e2e',
        target: 'npm:mongodb',
      },
      {
        type: 'static',
        source: 'nrwl-api-e2e',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'nrwl-api-e2e',
        target: 'npm:axios',
      },
      {
        type: 'static',
        source: 'nrwl-api-e2e',
        target: 'npm:apollo-cache-inmemory',
      },
      {
        type: 'static',
        source: 'nrwl-api-e2e',
        target: 'npm:apollo-client',
      },
      {
        type: 'static',
        source: 'nrwl-api-e2e',
        target: 'npm:apollo-link-error',
      },
      {
        type: 'static',
        source: 'nrwl-api-e2e',
        target: 'npm:apollo-link-http',
      },
      {
        type: 'static',
        source: 'nrwl-api-e2e',
        target: 'npm:node-fetch',
      },
      {
        type: 'static',
        source: 'nrwl-api-e2e',
        target: 'npm:dotenv',
      },
      {
        type: 'static',
        source: 'nrwl-api-e2e',
        target: 'npm:request',
      },
    ],
    'nx-cloud-e2e': [
      {
        type: 'implicit',
        source: 'nx-cloud-e2e',
        target: 'nx-cloud',
      },
      {
        type: 'static',
        source: 'nx-cloud-e2e',
        target: 'npm:dotenv',
      },
      {
        type: 'static',
        source: 'nx-cloud-e2e',
        target: 'npm:@nrwl/cypress',
      },
      {
        type: 'static',
        source: 'nx-cloud-e2e',
        target: 'npm:mongodb',
      },
      {
        type: 'static',
        source: 'nx-cloud-e2e',
        target: 'npm:@testing-library/cypress',
      },
    ],
    'ui-downloads': [
      {
        type: 'static',
        source: 'ui-downloads',
        target: 'nrwlio-site-analytics',
      },
      {
        type: 'static',
        source: 'ui-downloads',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'ui-downloads',
        target: 'ui-images',
      },
      {
        type: 'static',
        source: 'ui-downloads',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'ui-downloads',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'ui-downloads',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'ui-downloads',
        target: 'npm:jest-preset-angular',
      },
    ],
    'common-site': [
      {
        type: 'static',
        source: 'common-site',
        target: 'common-platform',
      },
      {
        type: 'static',
        source: 'common-site',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'common-site',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'common-site',
        target: 'npm:@angular/platform-browser',
      },
      {
        type: 'static',
        source: 'common-site',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'common-site',
        target: 'npm:jest-preset-angular',
      },
    ],
    'ui-contents': [
      {
        type: 'static',
        source: 'ui-contents',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'ui-contents',
        target: 'ui-images',
      },
      {
        type: 'static',
        source: 'ui-contents',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'ui-contents',
        target: 'npm:@angular/cdk',
      },
      {
        type: 'static',
        source: 'ui-contents',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'ui-contents',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'ui-contents',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'ui-contents',
        target: 'npm:jest-preset-angular',
      },
    ],
    'ui-features': [
      {
        type: 'static',
        source: 'ui-features',
        target: 'ui-images',
      },
      {
        type: 'static',
        source: 'ui-features',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'ui-features',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'ui-features',
        target: 'npm:@angular/cdk',
      },
      {
        type: 'static',
        source: 'ui-features',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'ui-features',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'ui-features',
        target: 'npm:jest-preset-angular',
      },
    ],
    'ui-articles': [
      {
        type: 'static',
        source: 'ui-articles',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'ui-articles',
        target: 'ui-images',
      },
      {
        type: 'static',
        source: 'ui-articles',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'ui-articles',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'ui-articles',
        target: 'npm:@angular/cdk',
      },
      {
        type: 'static',
        source: 'ui-articles',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'ui-articles',
        target: 'npm:jest-preset-angular',
      },
    ],
    'ui-callouts': [
      {
        type: 'static',
        source: 'ui-callouts',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'ui-callouts',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'ui-callouts',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'ui-callouts',
        target: 'npm:jest-preset-angular',
      },
    ],
    'file-server': [
      {
        type: 'static',
        source: 'file-server',
        target: 'npm:axios',
      },
    ],
    'cloud-proxy': [
      {
        type: 'static',
        source: 'cloud-proxy',
        target: 'npm:axios',
      },
      {
        type: 'static',
        source: 'cloud-proxy',
        target: 'npm:http-proxy',
      },
    ],
    'nrwlio-e2e': [
      {
        type: 'implicit',
        source: 'nrwlio-e2e',
        target: 'nrwlio',
      },
      {
        type: 'static',
        source: 'nrwlio-e2e',
        target: 'npm:@nrwl/cypress',
      },
    ],
    'ui-banners': [
      {
        type: 'static',
        source: 'ui-banners',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'ui-banners',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'ui-banners',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'ui-banners',
        target: 'npm:jest-preset-angular',
      },
    ],
    platform: [
      {
        type: 'static',
        source: 'platform',
        target: 'platform-data-access-graphql',
      },
      {
        type: 'static',
        source: 'platform',
        target: 'platform-utils',
      },
      {
        type: 'static',
        source: 'platform',
        target: 'platform-data-access-blurb',
      },
      {
        type: 'static',
        source: 'platform',
        target: 'platform-components',
      },
      {
        type: 'static',
        source: 'platform',
        target: 'platform-feature-auth',
      },
      {
        type: 'static',
        source: 'platform',
        target: 'platform-feature-landing-page',
      },
      {
        type: 'dynamic',
        source: 'platform',
        target: 'platform-feature-dashboard',
      },
      {
        type: 'dynamic',
        source: 'platform',
        target: 'platform-feature-books',
      },
      {
        type: 'dynamic',
        source: 'platform',
        target: 'platform-feature-topics',
      },
      {
        type: 'dynamic',
        source: 'platform',
        target: 'platform-feature-cookbook',
      },
      {
        type: 'dynamic',
        source: 'platform',
        target: 'platform-feature-live-events',
      },
      {
        type: 'dynamic',
        source: 'platform',
        target: 'platform-feature-nrwl-changelog',
      },
      {
        type: 'dynamic',
        source: 'platform',
        target: 'platform-feature-users',
      },
      {
        type: 'dynamic',
        source: 'platform',
        target: 'platform-feature-organizations',
      },
      {
        type: 'dynamic',
        source: 'platform',
        target: 'platform-feature-organization',
      },
      {
        type: 'dynamic',
        source: 'platform',
        target: 'platform-feature-courses',
      },
      {
        type: 'dynamic',
        source: 'platform',
        target: 'platform-feature-expert-bio',
      },
      {
        type: 'dynamic',
        source: 'platform',
        target: 'platform-feature-policies',
      },
      {
        type: 'dynamic',
        source: 'platform',
        target: 'platform-feature-live-broadcast',
      },
      {
        type: 'dynamic',
        source: 'platform',
        target: 'platform-feature-live-workshop',
      },
      {
        type: 'dynamic',
        source: 'platform',
        target: 'platform-feature-reports',
      },
      {
        type: 'dynamic',
        source: 'platform',
        target: 'platform-feature-about',
      },
      {
        type: 'static',
        source: 'platform',
        target: 'npm:karma-jasmine',
      },
      {
        type: 'static',
        source: 'platform',
        target: 'npm:karma-chrome-launcher',
      },
      {
        type: 'static',
        source: 'platform',
        target: 'npm:karma-jasmine-html-reporter',
      },
      {
        type: 'static',
        source: 'platform',
        target: 'npm:karma-coverage-istanbul-reporter',
      },
      {
        type: 'static',
        source: 'platform',
        target: 'npm:@angular-devkit/build-angular',
      },
      {
        type: 'static',
        source: 'platform',
        target: 'npm:@angular/cdk',
      },
      {
        type: 'static',
        source: 'platform',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'platform',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'platform',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'platform',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'platform',
        target: 'npm:apollo-angular',
      },
      {
        type: 'static',
        source: 'platform',
        target: 'npm:graphql-tag',
      },
      {
        type: 'static',
        source: 'platform',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'platform',
        target: 'npm:@angular/platform-browser',
      },
      {
        type: 'static',
        source: 'platform',
        target: 'npm:@ngrx/effects',
      },
      {
        type: 'static',
        source: 'platform',
        target: 'npm:@ngrx/store',
      },
      {
        type: 'static',
        source: 'platform',
        target: 'npm:@ngrx/store-devtools',
      },
      {
        type: 'static',
        source: 'platform',
        target: 'npm:ngx-markdown',
      },
      {
        type: 'static',
        source: 'platform',
        target: 'npm:@loona/angular',
      },
      {
        type: 'static',
        source: 'platform',
        target: 'npm:@angular/platform-browser-dynamic',
      },
      {
        type: 'static',
        source: 'platform',
        target: 'npm:core-js',
      },
      {
        type: 'static',
        source: 'platform',
        target: 'npm:zone.js',
      },
    ],
    'ui-images': [
      {
        type: 'static',
        source: 'ui-images',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'ui-images',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'ui-images',
        target: 'npm:jest-preset-angular',
      },
    ],
    'ui-styles': [
      {
        type: 'static',
        source: 'ui-styles',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nrwl-api': [
      {
        type: 'static',
        source: 'nrwl-api',
        target: 'nrwl-api-reporting',
      },
      {
        type: 'static',
        source: 'nrwl-api',
        target: 'npm:mongodb',
      },
      {
        type: 'static',
        source: 'nrwl-api',
        target: 'npm:dms-report',
      },
      {
        type: 'static',
        source: 'nrwl-api',
        target: 'npm:jsonwebtoken',
      },
      {
        type: 'static',
        source: 'nrwl-api',
        target: 'npm:jwks-rsa',
      },
      {
        type: 'static',
        source: 'nrwl-api',
        target: 'npm:request',
      },
      {
        type: 'static',
        source: 'nrwl-api',
        target: 'npm:stripe',
      },
      {
        type: 'static',
        source: 'nrwl-api',
        target: 'npm:dotenv',
      },
      {
        type: 'static',
        source: 'nrwl-api',
        target: 'npm:uuid',
      },
      {
        type: 'static',
        source: 'nrwl-api',
        target: 'npm:graphql-shield',
      },
      {
        type: 'static',
        source: 'nrwl-api',
        target: 'npm:graphql-middleware',
      },
      {
        type: 'static',
        source: 'nrwl-api',
        target: 'npm:express-jwt',
      },
      {
        type: 'static',
        source: 'nrwl-api',
        target: 'npm:aws-sdk',
      },
      {
        type: 'static',
        source: 'nrwl-api',
        target: 'npm:winston',
      },
      {
        type: 'static',
        source: 'nrwl-api',
        target: 'npm:redis',
      },
      {
        type: 'static',
        source: 'nrwl-api',
        target: 'npm:mandrill-api',
      },
      {
        type: 'static',
        source: 'nrwl-api',
        target: 'npm:graphql-yoga',
      },
      {
        type: 'static',
        source: 'nrwl-api',
        target: 'npm:rollbar',
      },
      {
        type: 'static',
        source: 'nrwl-api',
        target: 'npm:helmet',
      },
      {
        type: 'static',
        source: 'nrwl-api',
        target: 'npm:http-proxy',
      },
    ],
    'nx-cloud': [
      {
        type: 'static',
        source: 'nx-cloud',
        target: 'nx-cloud-data-access-graphql',
      },
      {
        type: 'static',
        source: 'nx-cloud',
        target: 'nx-cloud-feature-auth',
      },
      {
        type: 'static',
        source: 'nx-cloud',
        target: 'nx-cloud-ui-footer',
      },
      {
        type: 'static',
        source: 'nx-cloud',
        target: 'nx-cloud-ui-header',
      },
      {
        type: 'static',
        source: 'nx-cloud',
        target: 'nx-cloud-utils',
      },
      {
        type: 'dynamic',
        source: 'nx-cloud',
        target: 'nx-cloud-feature-landing',
      },
      {
        type: 'dynamic',
        source: 'nx-cloud',
        target: 'nx-cloud-reference-feature-org',
      },
      {
        type: 'dynamic',
        source: 'nx-cloud',
        target: 'nx-cloud-reference-feature-invite-members',
      },
      {
        type: 'dynamic',
        source: 'nx-cloud',
        target: 'nx-cloud-reference-feature-runs',
      },
      {
        type: 'dynamic',
        source: 'nx-cloud',
        target: 'nx-cloud-feature-policies',
      },
      {
        type: 'dynamic',
        source: 'nx-cloud',
        target: 'nx-cloud-feature-faq',
      },
      {
        type: 'dynamic',
        source: 'nx-cloud',
        target: 'nx-cloud-feature-terms-of-service',
      },
      {
        type: 'dynamic',
        source: 'nx-cloud',
        target: 'nx-cloud-feature-make-ng-cli-faster',
      },
      {
        type: 'dynamic',
        source: 'nx-cloud',
        target: 'nx-cloud-feature-pricing',
      },
      {
        type: 'implicit',
        source: 'nx-cloud',
        target: 'nx-cloud-assets',
      },
      {
        type: 'static',
        source: 'nx-cloud',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nx-cloud',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nx-cloud',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nx-cloud',
        target: 'npm:@angular/platform-browser',
      },
      {
        type: 'static',
        source: 'nx-cloud',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nx-cloud',
        target: 'npm:ngx-markdown',
      },
      {
        type: 'static',
        source: 'nx-cloud',
        target: 'npm:@angular/platform-server',
      },
      {
        type: 'static',
        source: 'nx-cloud',
        target: 'npm:rollbar',
      },
      {
        type: 'static',
        source: 'nx-cloud',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'nx-cloud',
        target: 'npm:zone.js',
      },
      {
        type: 'static',
        source: 'nx-cloud',
        target: 'npm:@nguniversal/express-engine',
      },
      {
        type: 'static',
        source: 'nx-cloud',
        target: 'npm:@angular/platform-browser-dynamic',
      },
      {
        type: 'static',
        source: 'nx-cloud',
        target: 'npm:jest-preset-angular',
      },
    ],
    'ui-heros': [
      {
        type: 'static',
        source: 'ui-heros',
        target: 'ui-images',
      },
      {
        type: 'static',
        source: 'ui-heros',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'ui-heros',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'ui-heros',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'ui-heros',
        target: 'npm:jest-preset-angular',
      },
    ],
    'nx-api': [],
    nrwlio: [
      {
        type: 'dynamic',
        source: 'nrwlio',
        target: 'nrwlio-site-pages-feature-home',
      },
      {
        type: 'dynamic',
        source: 'nrwlio',
        target: 'nrwlio-site-pages-feature-services',
      },
      {
        type: 'dynamic',
        source: 'nrwlio',
        target: 'nrwlio-site-pages-feature-about-us',
      },
      {
        type: 'dynamic',
        source: 'nrwlio',
        target: 'nrwlio-site-pages-feature-products',
      },
      {
        type: 'dynamic',
        source: 'nrwlio',
        target: 'nrwlio-site-pages-feature-contact-us',
      },
      {
        type: 'dynamic',
        source: 'nrwlio',
        target: 'nrwlio-site-pages-feature-careers',
      },
      {
        type: 'dynamic',
        source: 'nrwlio',
        target: 'nrwlio-site-pages-feature-style-guide',
      },
      {
        type: 'static',
        source: 'nrwlio',
        target: 'nrwlio-site-data-access-graphql',
      },
      {
        type: 'static',
        source: 'nrwlio',
        target: 'nrwlio-site-contentful',
      },
      {
        type: 'static',
        source: 'nrwlio',
        target: 'nrwlio-site-feature-pages',
      },
      {
        type: 'static',
        source: 'nrwlio',
        target: 'nrwlio-site-pwa',
      },
      {
        type: 'static',
        source: 'nrwlio',
        target: 'nrwlio-site-analytics',
      },
      {
        type: 'static',
        source: 'nrwlio',
        target: 'nrwlio-site-hubspot',
      },
      {
        type: 'static',
        source: 'nrwlio',
        target: 'common-platform',
      },
      {
        type: 'static',
        source: 'nrwlio',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'nrwlio',
        target: 'npm:@angular/router',
      },
      {
        type: 'static',
        source: 'nrwlio',
        target: 'npm:@angular/platform-browser',
      },
      {
        type: 'static',
        source: 'nrwlio',
        target: 'npm:@angular/service-worker',
      },
      {
        type: 'static',
        source: 'nrwlio',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'nrwlio',
        target: 'npm:ngx-markdown',
      },
      {
        type: 'static',
        source: 'nrwlio',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'nrwlio',
        target: 'npm:@angular/platform-server',
      },
      {
        type: 'static',
        source: 'nrwlio',
        target: 'npm:zone.js',
      },
      {
        type: 'static',
        source: 'nrwlio',
        target: 'npm:@nguniversal/express-engine',
      },
      {
        type: 'static',
        source: 'nrwlio',
        target: 'npm:@angular/platform-browser-dynamic',
      },
      {
        type: 'static',
        source: 'nrwlio',
        target: 'npm:jest-preset-angular',
      },
    ],
    'ui-ads': [
      {
        type: 'static',
        source: 'ui-ads',
        target: 'shared-ui-markdown',
      },
      {
        type: 'static',
        source: 'ui-ads',
        target: 'ui-images',
      },
      {
        type: 'static',
        source: 'ui-ads',
        target: 'npm:@angular/core',
      },
      {
        type: 'static',
        source: 'ui-ads',
        target: 'npm:rxjs',
      },
      {
        type: 'static',
        source: 'ui-ads',
        target: 'npm:@angular/cdk',
      },
      {
        type: 'static',
        source: 'ui-ads',
        target: 'npm:@angular/common',
      },
      {
        type: 'static',
        source: 'ui-ads',
        target: 'npm:@angular/material',
      },
      {
        type: 'static',
        source: 'ui-ads',
        target: 'npm:jest-preset-angular',
      },
    ],
    'npm:@angular/animations': [],
    'npm:@angular/cdk': [],
    'npm:@angular/common': [],
    'npm:@angular/compiler': [],
    'npm:@angular/core': [],
    'npm:@angular/flex-layout': [],
    'npm:@angular/forms': [],
    'npm:@angular/material': [],
    'npm:@angular/platform-browser': [],
    'npm:@angular/platform-browser-dynamic': [],
    'npm:@angular/pwa': [],
    'npm:@angular/router': [],
    'npm:@angular/service-worker': [],
    'npm:@contentful/rich-text-html-renderer': [],
    'npm:@contentful/rich-text-types': [],
    'npm:@loona/angular': [],
    'npm:@loona/core': [],
    'npm:@nestjs/common': [],
    'npm:@nestjs/core': [],
    'npm:@nestjs/graphql': [],
    'npm:@ngrx/effects': [],
    'npm:@ngrx/entity': [],
    'npm:@ngrx/router-store': [],
    'npm:@ngrx/store': [],
    'npm:@nguniversal/express-engine': [],
    'npm:@nrwl/angular': [],
    'npm:@types/d3-axis': [],
    'npm:@types/graphql': [],
    'npm:@types/opn': [],
    'npm:@types/redis': [],
    'npm:apollo-angular': [],
    'npm:apollo-angular-link-http': [],
    'npm:apollo-cache-inmemory': [],
    'npm:apollo-client': [],
    'npm:apollo-link': [],
    'npm:apollo-link-error': [],
    'npm:auth0-js': [],
    'npm:axios': [],
    'npm:bourbon': [],
    'npm:core-js': [],
    'npm:d3-axis': [],
    'npm:dms-report': [],
    'npm:epubjs': [],
    'npm:express-jwt': [],
    'npm:get-port': [],
    'npm:googleapis': [],
    'npm:graphql': [],
    'npm:graphql-middleware': [],
    'npm:graphql-shield': [],
    'npm:graphql-tag': [],
    'npm:graphql-yoga': [],
    'npm:hammerjs': [],
    'npm:helmet': [],
    'npm:jsonwebtoken': [],
    'npm:jwks-rsa': [],
    'npm:lodash.memoize': [],
    'npm:mandrill-api': [],
    'npm:modern-normalize': [],
    'npm:mongodb': [],
    'npm:ngx-markdown': [],
    'npm:ngx-masonry': [],
    'npm:node-machine-id': [],
    'npm:opn': [],
    'npm:redis': [],
    'npm:rollbar': [],
    'npm:rxjs': [],
    'npm:stripe': [],
    'npm:tar': [],
    'npm:tslib': [],
    'npm:uuid': [],
    'npm:winston': [],
    'npm:zone.js': [],
    'npm:@angular-devkit/build-angular': [],
    'npm:@angular-devkit/build-ng-packagr': [],
    'npm:@angular/cli': [],
    'npm:@angular/compiler-cli': [],
    'npm:@angular/language-service': [],
    'npm:@angular/platform-server': [],
    'npm:@ngrx/schematics': [],
    'npm:@ngrx/store-devtools': [],
    'npm:@nguniversal/builders': [],
    'npm:@nrwl/cypress': [],
    'npm:@nrwl/eslint-plugin-nx': [],
    'npm:@nrwl/jest': [],
    'npm:@nrwl/nest': [],
    'npm:@nrwl/node': [],
    'npm:@nrwl/nx-cloud': [],
    'npm:@nrwl/storybook': [],
    'npm:@nrwl/workspace': [],
    'npm:@storybook/addon-knobs': [],
    'npm:@storybook/angular': [],
    'npm:@testing-library/cypress': [],
    'npm:@types/auth0-js': [],
    'npm:@types/aws-lambda': [],
    'npm:@types/d3-ease': [],
    'npm:@types/d3-format': [],
    'npm:@types/d3-sankey': [],
    'npm:@types/d3-scale': [],
    'npm:@types/d3-scale-chromatic': [],
    'npm:@types/d3-selection': [],
    'npm:@types/d3-time': [],
    'npm:@types/d3-time-format': [],
    'npm:@types/d3-transition': [],
    'npm:@types/execa': [],
    'npm:@types/fs-extra': [],
    'npm:@types/get-port': [],
    'npm:@types/got': [],
    'npm:@types/helmet': [],
    'npm:@types/jasmine': [],
    'npm:@types/jasminewd2': [],
    'npm:@types/jest': [],
    'npm:@types/jquery': [],
    'npm:@types/jsonwebtoken': [],
    'npm:@types/jszip': [],
    'npm:@types/lodash.memoize': [],
    'npm:@types/mandrill-api': [],
    'npm:@types/mongodb': [],
    'npm:@types/multer': [],
    'npm:@types/node': [],
    'npm:@types/node-fetch': [],
    'npm:@types/prettier': [],
    'npm:@types/request': [],
    'npm:@types/rimraf': [],
    'npm:@types/shelljs': [],
    'npm:@types/tmp': [],
    'npm:@types/unzipper': [],
    'npm:@types/uuid': [],
    'npm:@types/ws': [],
    'npm:@typescript-eslint/eslint-plugin': [],
    'npm:@typescript-eslint/parser': [],
    'npm:apollo-link-http': [],
    'npm:apollo-server-express': [],
    'npm:aws-sdk': [],
    'npm:axios-retry': [],
    'npm:codelyzer': [],
    'npm:csv-parser': [],
    'npm:cypress': [],
    'npm:d3-ease': [],
    'npm:d3-format': [],
    'npm:d3-sankey': [],
    'npm:d3-scale': [],
    'npm:d3-scale-chromatic': [],
    'npm:d3-selection': [],
    'npm:d3-time': [],
    'npm:d3-time-format': [],
    'npm:d3-transition': [],
    'npm:date-fns': [],
    'npm:dotenv': [],
    'npm:eslint': [],
    'npm:eslint-config-prettier': [],
    'npm:eslint-plugin-cypress': [],
    'npm:execa': [],
    'npm:firebase-tools': [],
    'npm:fs-extra': [],
    'npm:got': [],
    'npm:graphql-cli': [],
    'npm:http-proxy': [],
    'npm:http-server': [],
    'npm:husky': [],
    'npm:jasmine-core': [],
    'npm:jasmine-marbles': [],
    'npm:jasmine-spec-reporter': [],
    'npm:javascript-obfuscator': [],
    'npm:jest': [],
    'npm:jest-preset-angular': [],
    'npm:jszip': [],
    'npm:karma': [],
    'npm:karma-chrome-launcher': [],
    'npm:karma-coverage-istanbul-reporter': [],
    'npm:karma-jasmine': [],
    'npm:karma-jasmine-html-reporter': [],
    'npm:lint-staged': [],
    'npm:netlify-cli': [],
    'npm:ng-packagr': [],
    'npm:node-fetch': [],
    'npm:nodemon': [],
    'npm:nps': [],
    'npm:nps-utils': [],
    'npm:prettier': [],
    'npm:pretty-quick': [],
    'npm:replace-in-file': [],
    'npm:request': [],
    'npm:rimraf': [],
    'npm:shelljs': [],
    'npm:sitemap': [],
    'npm:tmp': [],
    'npm:trix': [],
    'npm:ts-jest': [],
    'npm:ts-node': [],
    'npm:tsickle': [],
    'npm:tslint': [],
    'npm:typescript': [],
    'npm:unzipper': [],
  },
};
