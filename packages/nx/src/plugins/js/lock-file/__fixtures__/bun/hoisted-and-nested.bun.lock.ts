export const hoistedAndNestedBunLock = `{
  "lockfileVersion": 1,
  "workspaces": {
    "": {
      "name": "quz",
      "dependencies": {
        "lodash": "4.14.2",
      },
    },
    "packages/pkg1": {
      "name": "@quz/pkg1",
      "version": "1.0.0",
      "dependencies": {
        "ansi-styles": "~5.1.0",
        "is-even": "1.0.0",
        "lodash": "~4.13.0",
      },
    },
    "packages/pkg2": {
      "name": "@quz/pkg2",
      "version": "1.0.0",
      "dependencies": {
        "ansi-styles": "^6.2.1",
        "is-even": "0.1.1",
        "is-odd": "3.0.1",
        "lodash": "~4.17.21",
      },
    },
  },
  "packages": {
    "@quz/pkg1": ["@quz/pkg1@workspace:packages/pkg1"],

    "@quz/pkg2": ["@quz/pkg2@workspace:packages/pkg2"],

    "ansi-styles": ["ansi-styles@5.1.0", "", {}, "sha512-osxifZo3ar56+e8tdYreU6p8FZGciBHo5O0JoDAxMUqZuyNUb+yHEwYtJZ+Z32R459jEgtwVf1u8D7qYwU0l6w=="],

    "is-buffer": ["is-buffer@1.1.6", "", {}, "sha512-NcdALwpXkTm5Zvvbk7owOUSvVvBKDgKP5/ewfXEznmQFfs4ZRmanOeKBTjRVjka3QFoN6XJ+9F3USqfHqTaU5w=="],

    "is-even": ["is-even@1.0.0", "", { "dependencies": { "is-odd": "^0.1.2" } }, "sha512-LEhnkAdJqic4Dbqn58A0y52IXoHWlsueqQkKfMfdEnIYG8A1sm/GHidKkS6yvXlMoRrkM34csHnXQtOqcb+Jzg=="],

    "is-number": ["is-number@1.1.2", "", {}, "sha512-dRKHHq76sZAXFf823ziHIOx5fXbuV1IrR892LugLDmyEBVMZzGoske4sY6lf+l3YPH/VyWNiKzNDXAPiQhx9Yg=="],

    "is-odd": ["is-odd@3.0.1", "", { "dependencies": { "is-number": "^6.0.0" } }, "sha512-CQpnWPrDwmP1+SMHXZhtLtJv90yiyVfluGsX5iNCVkrhQtU3TQHsUWPG9wkdk9Lgd5yNpAg9jQEo90CBaXgWMA=="],

    "kind-of": ["kind-of@3.2.2", "", { "dependencies": { "is-buffer": "^1.1.5" } }, "sha512-NOW9QQXMoZGg/oqnVNoNTTIFEIid1627WCffUBJEdMxYApq7mNE7CpzucIPc+ZQg25Phej7IJSmX3hO+oblOtQ=="],

    "lodash": ["lodash@4.14.2", "", {}, "sha512-L5PieqD7phyya3Uave78zpkVE5uc022V1h5iAWt7q1z71SS7Rtw5OX8Q30OZ4L8GVtRLKxI1mn76X288L7EdeA=="],

    "@quz/pkg1/lodash": ["lodash@4.13.1", "", {}, "sha512-j/GRONYpkXt1aB1bQHzkq0Th7zhv/syoDVrzCDA3FDMntIin0b7TjXi62q9juDC+QfhRs9COr0LFW38vQSH9Tg=="],

    "@quz/pkg2/ansi-styles": ["ansi-styles@6.2.1", "", {}, "sha512-bN798gFfQX+viw3R7yrGWRqnrN2oRkEkUjjl4JNn4E8GxxbjtG3FbrEIIY3l8/hrwUwIeCZvi4QuOTP4MErVug=="],

    "@quz/pkg2/is-even": ["is-even@0.1.1", "", { "dependencies": { "is-number": "^1.1.0", "is-odd": "^0.1.0" } }, "sha512-J6BpIZToZSLH7ZbsY+/Z1blEsTa7InEwYc2jn0T9KtcPAR6hLdml/7vUyFgVCzH2BtX2K4d9GfSZROQ1N9YlbQ=="],

    "@quz/pkg2/lodash": ["lodash@4.17.21", "", {}, "sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg=="],

    "is-even/is-odd": ["is-odd@0.1.2", "", { "dependencies": { "is-number": "^3.0.0" } }, "sha512-Ri7C2K7o5IrUU9UEI8losXJCCD/UtsaIrkR5sxIcFg4xQ9cRJXlWA5DQvTE0yDc0krvSNLsRGXN11UPS6KyfBw=="],

    "is-odd/is-number": ["is-number@6.0.0", "", {}, "sha512-Wu1VHeILBK8KAWJUAiSZQX94GmOE45Rg6/538fKwiloUu21KncEkYGPqob2oSZ5mUT73vLGrHQjKw3KMPwfDzg=="],

    "@quz/pkg2/is-even/is-odd": ["is-odd@0.1.2", "", { "dependencies": { "is-number": "^3.0.0" } }, "sha512-Ri7C2K7o5IrUU9UEI8losXJCCD/UtsaIrkR5sxIcFg4xQ9cRJXlWA5DQvTE0yDc0krvSNLsRGXN11UPS6KyfBw=="],

    "is-even/is-odd/is-number": ["is-number@3.0.0", "", { "dependencies": { "kind-of": "^3.0.2" } }, "sha512-4cboCqIpliH+mAvFNegjZQ4kgKc3ZUhQVr3HvWbSh5q3WH2v82ct+T2Y1hdU5Gdtorx/cLifQjqCbL7bpznLTg=="],

    "@quz/pkg2/is-even/is-odd/is-number": ["is-number@3.0.0", "", { "dependencies": { "kind-of": "^3.0.2" } }, "sha512-4cboCqIpliH+mAvFNegjZQ4kgKc3ZUhQVr3HvWbSh5q3WH2v82ct+T2Y1hdU5Gdtorx/cLifQjqCbL7bpznLTg=="],
  }
}`;
