# Explore the Graph

For Nx to run tasks quickly and correctly, it creates a graph of the dependencies between all the projects in the
repository. Exploring this graph visually can be useful
to understand why Nx is behaving in a certain way and to get a
high level view of your code architecture.

To launch the project graph visualization run:

```shell
nx graph
```

This will open a browser window with an interactive representation of the project graph of your current codebase.
Viewing the entire graph can be unmanageable even for smaller repositories, so there are several ways to narrow the
focus of the visualization down to the most useful part of the graph at the moment.

1. Focus on a specific project and then use the proximity and group by folder controls to modify the graph around that
   project.
2. Use the search bar to find all projects with names that contain a certain string.
3. Manually hide or show projects in the sidebar

Once the graph is displayed, you can click on an individual dependency link to find out what specific file(s) created
that dependency.

Try playing around with a [fully interactive graph on a sample repo](https://nrwl-nx-examples-dep-graph.netlify.app/?focus=cart) or look at the more limited example below:

{% graph height="450px" %}

```json
{
  "hash": "58420bb4002bb9b6914bdeb7808c77a591a089fc82aaee11e656d73b2735e3fa",
  "projects": [
    {
      "name": "shared-product-state",
      "type": "lib",
      "data": {
        "tags": ["scope:shared", "type:state"],
        "root": "libs/shared/product/state",
        "files": [
          {
            "file": "libs/shared/product/state/.babelrc",
            "hash": "0cae4a9a81270d6cf3315436f594bf2fbd4fb3e2"
          },
          {
            "file": "libs/shared/product/state/.eslintrc.json",
            "hash": "eee5f453593a2b8e7f865305029b7edc3449cca6"
          },
          {
            "file": "libs/shared/product/state/jest.config.ts",
            "hash": "9184d1913ec49fa254d1ebdcffd99d31d07b5353"
          },
          {
            "file": "libs/shared/product/state/project.json",
            "hash": "4c6c7ea6d808bb99a3784b4fd92b3b290ec94397"
          },
          {
            "file": "libs/shared/product/state/README.md",
            "hash": "63538ffc745d3f82d93bcfbd61608057bf9cafaf"
          },
          {
            "file": "libs/shared/product/state/src/index.ts",
            "hash": "0f1e1c9a63ae70e3c2cadd493263853511567dfd",
            "deps": ["npm:@ngrx/store"]
          },
          {
            "file": "libs/shared/product/state/src/lib/+state/products.actions.ts",
            "hash": "4c0efeeec1adfcecd34b20bda87fce5f24a64675",
            "deps": ["npm:@ngrx/store"]
          },
          {
            "file": "libs/shared/product/state/src/lib/+state/products.reducer.spec.ts",
            "hash": "b2821f72394868ca503eb637f2891564851583eb",
            "deps": ["npm:@ngrx/store", "shared-product-data"]
          },
          {
            "file": "libs/shared/product/state/src/lib/+state/products.reducer.ts",
            "hash": "9168586d19b76b0dd462dafbb5b6998c4da5ba53",
            "deps": ["shared-product-data", "shared-product-types"]
          },
          {
            "file": "libs/shared/product/state/src/lib/+state/products.selectors.spec.ts",
            "hash": "d22772ca82cb0f57a96d11fa3cb8f5a0e238c6d8",
            "deps": ["shared-product-data"]
          },
          {
            "file": "libs/shared/product/state/src/lib/+state/products.selectors.ts",
            "hash": "da9e68bf4631ddb35e19659c3db04a0953a62a61"
          },
          {
            "file": "libs/shared/product/state/src/lib/shared-product-state.module.spec.ts",
            "hash": "2aab0223be6028d16f8cddc8ac033b362eae21e2",
            "deps": ["npm:@angular/core"]
          },
          {
            "file": "libs/shared/product/state/src/lib/shared-product-state.module.ts",
            "hash": "45820bfa99997f35e6576d526fa228b7a5638cca",
            "deps": [
              "npm:@angular/common",
              "npm:@angular/core",
              "npm:@ngrx/store"
            ]
          },
          {
            "file": "libs/shared/product/state/src/react.ts",
            "hash": "fa1cb4754b3dd584ba8ca23fe462c906f59945d6"
          },
          {
            "file": "libs/shared/product/state/src/test-setup.ts",
            "hash": "1100b3e8a6ed08f4b5c27a96471846d57023c320",
            "deps": ["npm:jest-preset-angular"]
          },
          {
            "file": "libs/shared/product/state/tsconfig.json",
            "hash": "a9a0b978b3edf84247a550ba82d8eea50dc8da68"
          },
          {
            "file": "libs/shared/product/state/tsconfig.lib.json",
            "hash": "3b1fbbb954624d075826446e0060d243813ebcf1"
          },
          {
            "file": "libs/shared/product/state/tsconfig.spec.json",
            "hash": "8603a008c3b77e77e142939e83e05e4a1043fbc6"
          }
        ]
      }
    },
    {
      "name": "shared-product-types",
      "type": "lib",
      "data": {
        "tags": ["type:types", "scope:shared"],
        "root": "libs/shared/product/types",
        "files": [
          {
            "file": "libs/shared/product/types/.babelrc",
            "hash": "0cae4a9a81270d6cf3315436f594bf2fbd4fb3e2"
          },
          {
            "file": "libs/shared/product/types/.eslintrc.json",
            "hash": "deb72aabdf74e23f16519b8cbeb5d63e769cd470"
          },
          {
            "file": "libs/shared/product/types/project.json",
            "hash": "92202a2aaf4c482dd8e463ddefc6d0eb6f5640f2"
          },
          {
            "file": "libs/shared/product/types/README.md",
            "hash": "a3308045207635951262c7c81e93c4afafb484c4"
          },
          {
            "file": "libs/shared/product/types/src/index.ts",
            "hash": "6b3cdd251890a858bace2be04ff2ef2920d68b76"
          },
          {
            "file": "libs/shared/product/types/src/lib/shared-product-types.ts",
            "hash": "4f99c082564a63944be3e035c4ef47cc060b3af9"
          },
          {
            "file": "libs/shared/product/types/tsconfig.json",
            "hash": "e7879c9efcfa2e1c35b5373b03b4b7ea276795ac"
          },
          {
            "file": "libs/shared/product/types/tsconfig.lib.json",
            "hash": "a174cb09c30e46285517c7308247d602414aa63f"
          }
        ]
      }
    },
    {
      "name": "shared-product-data",
      "type": "lib",
      "data": {
        "tags": ["type:data", "scope:shared"],
        "root": "libs/shared/product/data",
        "files": [
          {
            "file": "libs/shared/product/data/.babelrc",
            "hash": "0cae4a9a81270d6cf3315436f594bf2fbd4fb3e2"
          },
          {
            "file": "libs/shared/product/data/.eslintrc.json",
            "hash": "0576ff84e48f121399441a189bc1cd2a35fbca47"
          },
          {
            "file": "libs/shared/product/data/project.json",
            "hash": "8c12bcd46a2d49861cd71b6b9502bf5a408c380d"
          },
          {
            "file": "libs/shared/product/data/README.md",
            "hash": "a433a7f8582e93329c762709f617d5d146b763f1"
          },
          {
            "file": "libs/shared/product/data/src/index.ts",
            "hash": "0818cd09cdd02861b3319fd08cfcd2abf29539b4"
          },
          {
            "file": "libs/shared/product/data/src/lib/product-data.mock.ts",
            "hash": "dedcafc80a6cf40d3f644c8f88679b0182fd1c00"
          },
          {
            "file": "libs/shared/product/data/src/lib/shared-product-data.ts",
            "hash": "37d51e532586fe98ac35c9236e8fd538718cf14f",
            "deps": ["shared-product-types"]
          },
          {
            "file": "libs/shared/product/data/src/testing.ts",
            "hash": "d80ae5191bdb9c730883065e07d95876d1a701c9"
          },
          {
            "file": "libs/shared/product/data/tsconfig.json",
            "hash": "e7879c9efcfa2e1c35b5373b03b4b7ea276795ac"
          },
          {
            "file": "libs/shared/product/data/tsconfig.lib.json",
            "hash": "a174cb09c30e46285517c7308247d602414aa63f"
          }
        ]
      }
    },
    {
      "name": "cart-cart-page",
      "type": "lib",
      "data": {
        "tags": ["scope:cart", "type:feature"],
        "root": "libs/cart/cart-page",
        "files": [
          {
            "file": "libs/cart/cart-page/.babelrc",
            "hash": "2563bbc7a3a07754d9cce33fed581595cefca651"
          },
          {
            "file": "libs/cart/cart-page/.eslintrc.json",
            "hash": "0790d98fc5188ef5b9707e0a47792b30e87f807f"
          },
          {
            "file": "libs/cart/cart-page/jest.config.ts",
            "hash": "cfd45fc556295c42c6b09f864a82309d649e452f"
          },
          {
            "file": "libs/cart/cart-page/project.json",
            "hash": "9965bbb55c9fdbde736ea98d368bba6758183d72"
          },
          {
            "file": "libs/cart/cart-page/README.md",
            "hash": "e849e84b78b7b1c409567b4dadebf54b1ef45ca6"
          },
          {
            "file": "libs/cart/cart-page/src/index.ts",
            "hash": "ad4674d7e1cfad04953cff1084cb229d81bcfa94"
          },
          {
            "file": "libs/cart/cart-page/src/lib/cart-cart-page/cart-cart-page.spec.tsx",
            "hash": "496df785798bd335433efac1ce9b63f4837d8862",
            "deps": ["npm:@testing-library/react"]
          },
          {
            "file": "libs/cart/cart-page/src/lib/cart-cart-page/cart-cart-page.tsx",
            "hash": "384ca9a17a3379dfacf6a6c4fb672d0b6f223997",
            "deps": [
              "npm:react",
              "npm:@emotion/styled",
              "shared-product-ui",
              "shared-cart-state",
              "shared-product-state"
            ]
          },
          {
            "file": "libs/cart/cart-page/src/test-setup.ts",
            "hash": "d8508d703266e7390b30189d3cf7fec7a70b198c",
            "deps": ["npm:document-register-element"]
          },
          {
            "file": "libs/cart/cart-page/tsconfig.json",
            "hash": "cd38e3e04409f21cefb92c2531b7f539fc2db14d"
          },
          {
            "file": "libs/cart/cart-page/tsconfig.lib.json",
            "hash": "8dcf07ce29e8bca717ce2672fb9f2ac5c9ab0556"
          },
          {
            "file": "libs/cart/cart-page/tsconfig.spec.json",
            "hash": "e1535ba9d07c38511f465f5427c9c5a39ab3b174"
          }
        ]
      }
    },
    {
      "name": "shared-styles",
      "type": "lib",
      "data": {
        "tags": ["scope:shared", "type:styles"],
        "root": "libs/shared/styles",
        "files": [
          {
            "file": "libs/shared/styles/project.json",
            "hash": "47566a51c14545b7fa381bbfddd4e36217c80c69"
          },
          {
            "file": "libs/shared/styles/README.md",
            "hash": "726adf41353f106db057050b4b8d0e8784c6eed5"
          },
          {
            "file": "libs/shared/styles/src/index.scss",
            "hash": "4242c2389d84fc3062a84cddb0f6b94427304803"
          },
          {
            "file": "libs/shared/styles/src/lib/global.scss",
            "hash": "55caa35d877ea8028f97134fa985a0b7e772f963"
          }
        ]
      }
    },
    {
      "name": "cart-e2e",
      "type": "e2e",
      "data": {
        "tags": ["scope:cart", "type:e2e"],
        "root": "apps/cart-e2e",
        "files": [
          {
            "file": "apps/cart-e2e/.eslintrc.json",
            "hash": "082395fbd03ae178157f9ebd4d374d208fd254f8"
          },
          {
            "file": "apps/cart-e2e/cypress.config.ts",
            "hash": "f292e4c8c9a6268418b17d7ff125bef64c961a4c",
            "deps": ["npm:cypress", "npm:@nrwl/cypress"]
          },
          {
            "file": "apps/cart-e2e/project.json",
            "hash": "02852d8c5cc3c57e82bdfe47858d97b36a3a1cb6"
          },
          {
            "file": "apps/cart-e2e/src/e2e/app.cy.ts",
            "hash": "2971885c601f09176516333d80a59f6e61ceaf9f",
            "deps": ["shared-e2e-utils"]
          },
          {
            "file": "apps/cart-e2e/src/fixtures/example.json",
            "hash": "294cbed6ce9e0b948b787452e8676aee486cb3be"
          },
          {
            "file": "apps/cart-e2e/src/support/app.po.ts",
            "hash": "c29f04f1c8d7c8722fbf705b3d951333c4fb95fc"
          },
          {
            "file": "apps/cart-e2e/src/support/commands.ts",
            "hash": "ca4d256f3eb15dfabad1f5760c9b2d0ceb4c24b9"
          },
          {
            "file": "apps/cart-e2e/src/support/e2e.ts",
            "hash": "3d469a6b6cf31eb66117d73e278bcf74f398f1db"
          },
          {
            "file": "apps/cart-e2e/tsconfig.json",
            "hash": "cc509a730e12498509bb7475f6f54b1a18021191"
          }
        ]
      }
    },
    {
      "name": "cart",
      "type": "app",
      "data": {
        "tags": ["type:app", "scope:cart"],
        "root": "apps/cart",
        "files": [
          {
            "file": "apps/cart/.babelrc",
            "hash": "61641ec8ac3659e204441c80bb06defe323e3110"
          },
          {
            "file": "apps/cart/.eslintrc.json",
            "hash": "4e6e0b82073fa77dc1c5b2f926d5d9d5d3cf2585"
          },
          {
            "file": "apps/cart/browserlist",
            "hash": "37371cb04b9f1986d952499cdf9613c9d5d8ca8c"
          },
          {
            "file": "apps/cart/jest.config.ts",
            "hash": "af92cac53c45ca46b882c00a5f87d486a2755986"
          },
          {
            "file": "apps/cart/project.json",
            "hash": "d950429fa06f12953744ce20e4585247c98486c6"
          },
          {
            "file": "apps/cart/src/_redirects",
            "hash": "50d93f23ab427b2911555db1a5c9a023293f470a"
          },
          {
            "file": "apps/cart/src/app/app.spec.tsx",
            "hash": "be06392eb51b8d8fd62a0c3dc8c4fa3c8ee76aca",
            "deps": ["npm:react-router-dom", "npm:@testing-library/react"]
          },
          {
            "file": "apps/cart/src/app/app.tsx",
            "hash": "4206822dc52f06828ef3192e385bad60262d8a40",
            "deps": ["npm:react-router-dom", "shared-header", "cart-cart-page"]
          },
          {
            "file": "apps/cart/src/assets/.gitkeep",
            "hash": "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391"
          },
          {
            "file": "apps/cart/src/environments/environment.prod.ts",
            "hash": "c9669790be176ac85a5d8c11278875c2f52dc507"
          },
          {
            "file": "apps/cart/src/environments/environment.ts",
            "hash": "7ed83767fff25adfed19d52b2821a432f8ed18b1"
          },
          {
            "file": "apps/cart/src/favicon.ico",
            "hash": "a11777cc471a4344702741ab1c8a588998b1311a"
          },
          {
            "file": "apps/cart/src/index.html",
            "hash": "1a7a74ec69f2b7a86ee7918f412e25edff23ebfb"
          },
          {
            "file": "apps/cart/src/main.tsx",
            "hash": "7991369e387a2b974b678a86c6eb006fd9757d8e",
            "deps": ["npm:react-dom", "npm:react-router-dom"]
          },
          {
            "file": "apps/cart/src/polyfills.ts",
            "hash": "83926853099fe077c00663db9909f25c9a3b769d"
          },
          {
            "file": "apps/cart/src/test-setup.ts",
            "hash": "d8508d703266e7390b30189d3cf7fec7a70b198c",
            "deps": ["npm:document-register-element"]
          },
          {
            "file": "apps/cart/tsconfig.app.json",
            "hash": "ce67a8f6f0c3345266081568fbe122381c7b82a2"
          },
          {
            "file": "apps/cart/tsconfig.json",
            "hash": "e7d37b3ecd2df29a7bf98d03d015f73dbaf0e723"
          },
          {
            "file": "apps/cart/tsconfig.spec.json",
            "hash": "99a0ce08de0901250105669917e582aba6e8697e"
          }
        ]
      }
    }
  ],
  "dependencies": {
    "shared-product-state": [
      {
        "source": "shared-product-state",
        "target": "shared-product-data",
        "type": "static"
      },
      {
        "source": "shared-product-state",
        "target": "shared-product-types",
        "type": "static"
      }
    ],
    "shared-product-types": [],
    "shared-product-data": [
      {
        "source": "shared-product-data",
        "target": "shared-product-types",
        "type": "static"
      }
    ],
    "shared-e2e-utils": [],
    "cart-cart-page": [
      {
        "source": "cart-cart-page",
        "target": "shared-product-state",
        "type": "static"
      }
    ],
    "shared-styles": [],
    "cart-e2e": [
      { "source": "cart-e2e", "target": "cart", "type": "implicit" }
    ],
    "cart": [
      { "source": "cart", "target": "shared-styles", "type": "implicit" },
      { "source": "cart", "target": "cart-cart-page", "type": "static" }
    ]
  },
  "workspaceLayout": {
    "appsDir": "apps",
    "libsDir": "libs"
  },
  "affectedProjectIds": [],
  "focus": null,
  "groupByFolder": false,
  "exclude": []
}
```

{% /graph %}
