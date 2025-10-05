export const auxiliaryPackagesBunLock = `{
  "lockfileVersion": 1,
  "workspaces": {
    "": {
      "name": "auxiliary-packages-fixture",
      "dependencies": {
        "@babel/core": "^7.20.0",
        "@babel/preset-env": "^7.20.0",
        "@babel/preset-react": "^7.18.0",
        "@babel/preset-typescript": "^7.18.0",
        "@jest/reporters": "^29.0.0",
        "@nrwl/devkit": "15.0.13",
        "@nrwl/linter": "15.0.13",
        "@nrwl/workspace": "15.0.13",
        "@phenomnomnominal/tsquery": "^5.0.0",
        "acorn-jsx": "^5.3.2",
        "babel-jest": "^29.0.0",
        "babel-preset-current-node-syntax": "^1.0.0",
        "babel-preset-jest": "^29.0.0",
        "debug": "^4.3.4",
        "eslint-plugin-disable-autofix": "npm:@mattlewis92/eslint-plugin-disable-autofix@3.0.0",
        "eslint-utils": "^3.0.0",
        "follow-redirects": "^1.15.0",
        "jest": "^29.0.0",
        "jest-config": "^29.0.0",
        "jest-pnp-resolver": "^1.2.3",
        "nx": "15.0.13",
        "react": "18.2.0",
        "update-browserslist-db": "^1.0.10",
        "yargs": "17.6.2",
      },
      "devDependencies": {
        "typescript": "4.8.4",
      },
      "optionalDependencies": {
        "supports-color": "^9.0.0",
      },
      "peerDependencies": {
        "typescript": "4.8.4",
      },
    },
  },
  "packages": {
    "@ampproject/remapping": ["@ampproject/remapping@2.3.0", "https://registry.npmjs.org/@ampproject/remapping/-/remapping-2.3.0.tgz", { "dependencies": { "@jridgewell/gen-mapping": "^0.3.5", "@jridgewell/trace-mapping": "^0.3.24" } }, "sha512-30iZtAPgz+LTIYoeivqYo853f02jBYSd5uGnGpkFV0M3xOt9aN73erkgYAmZU43x4VfqcnLxW9Kpg3R5LC4YYw=="],

    "@babel/code-frame": ["@babel/code-frame@7.27.1", "https://registry.npmjs.org/@babel/code-frame/-/code-frame-7.27.1.tgz", { "dependencies": { "@babel/helper-validator-identifier": "^7.27.1", "js-tokens": "^4.0.0", "picocolors": "^1.1.1" } }, "sha512-cjQ7ZlQ0Mv3b47hABuTevyTuYN4i+loJKGeV9flcCgIK37cCXRh+L1bd3iBHlynerhQ7BhCkn2BPbQUL+rGqFg=="],

    "@babel/compat-data": ["@babel/compat-data@7.28.0", "https://registry.npmjs.org/@babel/compat-data/-/compat-data-7.28.0.tgz", {}, "sha512-60X7qkglvrap8mn1lh2ebxXdZYtUcpd7gsmy9kLaBJ4i/WdY8PqTSdxyA8qraikqKQK5C1KRBKXqznrVapyNaw=="],

    "@babel/core": ["@babel/core@7.28.0", "https://registry.npmjs.org/@babel/core/-/core-7.28.0.tgz", { "dependencies": { "@ampproject/remapping": "^2.2.0", "@babel/code-frame": "^7.27.1", "@babel/generator": "^7.28.0", "@babel/helper-compilation-targets": "^7.27.2", "@babel/helper-module-transforms": "^7.27.3", "@babel/helpers": "^7.27.6", "@babel/parser": "^7.28.0", "@babel/template": "^7.27.2", "@babel/traverse": "^7.28.0", "@babel/types": "^7.28.0", "convert-source-map": "^2.0.0", "debug": "^4.1.0", "gensync": "^1.0.0-beta.2", "json5": "^2.2.3", "semver": "^6.3.1" } }, "sha512-UlLAnTPrFdNGoFtbSXwcGFQBtQZJCNjaN6hQNP3UPvuNXT1i82N26KL3dZeIpNalWywr9IuQuncaAfUaS1g6sQ=="],

    "@babel/generator": ["@babel/generator@7.28.0", "https://registry.npmjs.org/@babel/generator/-/generator-7.28.0.tgz", { "dependencies": { "@babel/parser": "^7.28.0", "@babel/types": "^7.28.0", "@jridgewell/gen-mapping": "^0.3.12", "@jridgewell/trace-mapping": "^0.3.28", "jsesc": "^3.0.2" } }, "sha512-lJjzvrbEeWrhB4P3QBsH7tey117PjLZnDbLiQEKjQ/fNJTjuq4HSqgFA+UNSwZT8D7dxxbnuSBMsa1lrWzKlQg=="],

    "@babel/helper-annotate-as-pure": ["@babel/helper-annotate-as-pure@7.27.3", "https://registry.npmjs.org/@babel/helper-annotate-as-pure/-/helper-annotate-as-pure-7.27.3.tgz", { "dependencies": { "@babel/types": "^7.27.3" } }, "sha512-fXSwMQqitTGeHLBC08Eq5yXz2m37E4pJX1qAU1+2cNedz/ifv/bVXft90VeSav5nFO61EcNgwr0aJxbyPaWBPg=="],

    "@babel/helper-compilation-targets": ["@babel/helper-compilation-targets@7.27.2", "https://registry.npmjs.org/@babel/helper-compilation-targets/-/helper-compilation-targets-7.27.2.tgz", { "dependencies": { "@babel/compat-data": "^7.27.2", "@babel/helper-validator-option": "^7.27.1", "browserslist": "^4.24.0", "lru-cache": "^5.1.1", "semver": "^6.3.1" } }, "sha512-2+1thGUUWWjLTYTHZWK1n8Yga0ijBz1XAhUXcKy81rd5g6yh7hGqMp45v7cadSbEHc9G3OTv45SyneRN3ps4DQ=="],

    "@babel/helper-create-class-features-plugin": ["@babel/helper-create-class-features-plugin@7.27.1", "https://registry.npmjs.org/@babel/helper-create-class-features-plugin/-/helper-create-class-features-plugin-7.27.1.tgz", { "dependencies": { "@babel/helper-annotate-as-pure": "^7.27.1", "@babel/helper-member-expression-to-functions": "^7.27.1", "@babel/helper-optimise-call-expression": "^7.27.1", "@babel/helper-replace-supers": "^7.27.1", "@babel/helper-skip-transparent-expression-wrappers": "^7.27.1", "@babel/traverse": "^7.27.1", "semver": "^6.3.1" }, "peerDependencies": { "@babel/core": "^7.0.0" } }, "sha512-QwGAmuvM17btKU5VqXfb+Giw4JcN0hjuufz3DYnpeVDvZLAObloM77bhMXiqry3Iio+Ai4phVRDwl6WU10+r5A=="],

    "@babel/helper-create-regexp-features-plugin": ["@babel/helper-create-regexp-features-plugin@7.27.1", "https://registry.npmjs.org/@babel/helper-create-regexp-features-plugin/-/helper-create-regexp-features-plugin-7.27.1.tgz", { "dependencies": { "@babel/helper-annotate-as-pure": "^7.27.1", "regexpu-core": "^6.2.0", "semver": "^6.3.1" }, "peerDependencies": { "@babel/core": "^7.0.0" } }, "sha512-uVDC72XVf8UbrH5qQTc18Agb8emwjTiZrQE11Nv3CuBEZmVvTwwE9CBUEvHku06gQCAyYf8Nv6ja1IN+6LMbxQ=="],

    "@babel/helper-define-polyfill-provider": ["@babel/helper-define-polyfill-provider@0.6.5", "https://registry.npmjs.org/@babel/helper-define-polyfill-provider/-/helper-define-polyfill-provider-0.6.5.tgz", { "dependencies": { "@babel/helper-compilation-targets": "^7.27.2", "@babel/helper-plugin-utils": "^7.27.1", "debug": "^4.4.1", "lodash.debounce": "^4.0.8", "resolve": "^1.22.10" }, "peerDependencies": { "@babel/core": "^7.4.0 || ^8.0.0-0 <8.0.0" } }, "sha512-uJnGFcPsWQK8fvjgGP5LZUZZsYGIoPeRjSF5PGwrelYgq7Q15/Ft9NGFp1zglwgIv//W0uG4BevRuSJRyylZPg=="],

    "@babel/helper-globals": ["@babel/helper-globals@7.28.0", "https://registry.npmjs.org/@babel/helper-globals/-/helper-globals-7.28.0.tgz", {}, "sha512-+W6cISkXFa1jXsDEdYA8HeevQT/FULhxzR99pxphltZcVaugps53THCeiWA8SguxxpSp3gKPiuYfSWopkLQ4hw=="],

    "@babel/helper-member-expression-to-functions": ["@babel/helper-member-expression-to-functions@7.27.1", "https://registry.npmjs.org/@babel/helper-member-expression-to-functions/-/helper-member-expression-to-functions-7.27.1.tgz", { "dependencies": { "@babel/traverse": "^7.27.1", "@babel/types": "^7.27.1" } }, "sha512-E5chM8eWjTp/aNoVpcbfM7mLxu9XGLWYise2eBKGQomAk/Mb4XoxyqXTZbuTohbsl8EKqdlMhnDI2CCLfcs9wA=="],

    "@babel/helper-module-imports": ["@babel/helper-module-imports@7.27.1", "https://registry.npmjs.org/@babel/helper-module-imports/-/helper-module-imports-7.27.1.tgz", { "dependencies": { "@babel/traverse": "^7.27.1", "@babel/types": "^7.27.1" } }, "sha512-0gSFWUPNXNopqtIPQvlD5WgXYI5GY2kP2cCvoT8kczjbfcfuIljTbcWrulD1CIPIX2gt1wghbDy08yE1p+/r3w=="],

    "@babel/helper-module-transforms": ["@babel/helper-module-transforms@7.27.3", "https://registry.npmjs.org/@babel/helper-module-transforms/-/helper-module-transforms-7.27.3.tgz", { "dependencies": { "@babel/helper-module-imports": "^7.27.1", "@babel/helper-validator-identifier": "^7.27.1", "@babel/traverse": "^7.27.3" }, "peerDependencies": { "@babel/core": "^7.0.0" } }, "sha512-dSOvYwvyLsWBeIRyOeHXp5vPj5l1I011r52FM1+r1jCERv+aFXYk4whgQccYEGYxK2H3ZAIA8nuPkQ0HaUo3qg=="],

    "@babel/helper-optimise-call-expression": ["@babel/helper-optimise-call-expression@7.27.1", "https://registry.npmjs.org/@babel/helper-optimise-call-expression/-/helper-optimise-call-expression-7.27.1.tgz", { "dependencies": { "@babel/types": "^7.27.1" } }, "sha512-URMGH08NzYFhubNSGJrpUEphGKQwMQYBySzat5cAByY1/YgIRkULnIy3tAMeszlL/so2HbeilYloUmSpd7GdVw=="],

    "@babel/helper-plugin-utils": ["@babel/helper-plugin-utils@7.27.1", "https://registry.npmjs.org/@babel/helper-plugin-utils/-/helper-plugin-utils-7.27.1.tgz", {}, "sha512-1gn1Up5YXka3YYAHGKpbideQ5Yjf1tDa9qYcgysz+cNCXukyLl6DjPXhD3VRwSb8c0J9tA4b2+rHEZtc6R0tlw=="],

    "@babel/helper-remap-async-to-generator": ["@babel/helper-remap-async-to-generator@7.27.1", "https://registry.npmjs.org/@babel/helper-remap-async-to-generator/-/helper-remap-async-to-generator-7.27.1.tgz", { "dependencies": { "@babel/helper-annotate-as-pure": "^7.27.1", "@babel/helper-wrap-function": "^7.27.1", "@babel/traverse": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0" } }, "sha512-7fiA521aVw8lSPeI4ZOD3vRFkoqkJcS+z4hFo82bFSH/2tNd6eJ5qCVMS5OzDmZh/kaHQeBaeyxK6wljcPtveA=="],

    "@babel/helper-replace-supers": ["@babel/helper-replace-supers@7.27.1", "https://registry.npmjs.org/@babel/helper-replace-supers/-/helper-replace-supers-7.27.1.tgz", { "dependencies": { "@babel/helper-member-expression-to-functions": "^7.27.1", "@babel/helper-optimise-call-expression": "^7.27.1", "@babel/traverse": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0" } }, "sha512-7EHz6qDZc8RYS5ElPoShMheWvEgERonFCs7IAonWLLUTXW59DP14bCZt89/GKyreYn8g3S83m21FelHKbeDCKA=="],

    "@babel/helper-skip-transparent-expression-wrappers": ["@babel/helper-skip-transparent-expression-wrappers@7.27.1", "https://registry.npmjs.org/@babel/helper-skip-transparent-expression-wrappers/-/helper-skip-transparent-expression-wrappers-7.27.1.tgz", { "dependencies": { "@babel/traverse": "^7.27.1", "@babel/types": "^7.27.1" } }, "sha512-Tub4ZKEXqbPjXgWLl2+3JpQAYBJ8+ikpQ2Ocj/q/r0LwE3UhENh7EUabyHjz2kCEsrRY83ew2DQdHluuiDQFzg=="],

    "@babel/helper-string-parser": ["@babel/helper-string-parser@7.27.1", "https://registry.npmjs.org/@babel/helper-string-parser/-/helper-string-parser-7.27.1.tgz", {}, "sha512-qMlSxKbpRlAridDExk92nSobyDdpPijUq2DW6oDnUqd0iOGxmQjyqhMIihI9+zv4LPyZdRje2cavWPbCbWm3eA=="],

    "@babel/helper-validator-identifier": ["@babel/helper-validator-identifier@7.27.1", "https://registry.npmjs.org/@babel/helper-validator-identifier/-/helper-validator-identifier-7.27.1.tgz", {}, "sha512-D2hP9eA+Sqx1kBZgzxZh0y1trbuU+JoDkiEwqhQ36nodYqJwyEIhPSdMNd7lOm/4io72luTPWH20Yda0xOuUow=="],

    "@babel/helper-validator-option": ["@babel/helper-validator-option@7.27.1", "https://registry.npmjs.org/@babel/helper-validator-option/-/helper-validator-option-7.27.1.tgz", {}, "sha512-YvjJow9FxbhFFKDSuFnVCe2WxXk1zWc22fFePVNEaWJEu8IrZVlda6N0uHwzZrUM1il7NC9Mlp4MaJYbYd9JSg=="],

    "@babel/helper-wrap-function": ["@babel/helper-wrap-function@7.27.1", "https://registry.npmjs.org/@babel/helper-wrap-function/-/helper-wrap-function-7.27.1.tgz", { "dependencies": { "@babel/template": "^7.27.1", "@babel/traverse": "^7.27.1", "@babel/types": "^7.27.1" } }, "sha512-NFJK2sHUvrjo8wAU/nQTWU890/zB2jj0qBcCbZbbf+005cAsv6tMjXz31fBign6M5ov1o0Bllu+9nbqkfsjjJQ=="],

    "@babel/helpers": ["@babel/helpers@7.27.6", "https://registry.npmjs.org/@babel/helpers/-/helpers-7.27.6.tgz", { "dependencies": { "@babel/template": "^7.27.2", "@babel/types": "^7.27.6" } }, "sha512-muE8Tt8M22638HU31A3CgfSUciwz1fhATfoVai05aPXGor//CdWDCbnlY1yvBPo07njuVOCNGCSp/GTt12lIug=="],

    "@babel/parser": ["@babel/parser@7.28.0", "https://registry.npmjs.org/@babel/parser/-/parser-7.28.0.tgz", { "dependencies": { "@babel/types": "^7.28.0" }, "bin": "./bin/babel-parser.js" }, "sha512-jVZGvOxOuNSsuQuLRTh13nU0AogFlw32w/MT+LV6D3sP5WdbW61E77RnkbaO2dUvmPAYrBDJXGn5gGS6tH4j8g=="],

    "@babel/plugin-bugfix-firefox-class-in-computed-class-key": ["@babel/plugin-bugfix-firefox-class-in-computed-class-key@7.27.1", "https://registry.npmjs.org/@babel/plugin-bugfix-firefox-class-in-computed-class-key/-/plugin-bugfix-firefox-class-in-computed-class-key-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1", "@babel/traverse": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0" } }, "sha512-QPG3C9cCVRQLxAVwmefEmwdTanECuUBMQZ/ym5kiw3XKCGA7qkuQLcjWWHcrD/GKbn/WmJwaezfuuAOcyKlRPA=="],

    "@babel/plugin-bugfix-safari-class-field-initializer-scope": ["@babel/plugin-bugfix-safari-class-field-initializer-scope@7.27.1", "https://registry.npmjs.org/@babel/plugin-bugfix-safari-class-field-initializer-scope/-/plugin-bugfix-safari-class-field-initializer-scope-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0" } }, "sha512-qNeq3bCKnGgLkEXUuFry6dPlGfCdQNZbn7yUAPCInwAJHMU7THJfrBSozkcWq5sNM6RcF3S8XyQL2A52KNR9IA=="],

    "@babel/plugin-bugfix-safari-id-destructuring-collision-in-function-expression": ["@babel/plugin-bugfix-safari-id-destructuring-collision-in-function-expression@7.27.1", "https://registry.npmjs.org/@babel/plugin-bugfix-safari-id-destructuring-collision-in-function-expression/-/plugin-bugfix-safari-id-destructuring-collision-in-function-expression-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0" } }, "sha512-g4L7OYun04N1WyqMNjldFwlfPCLVkgB54A/YCXICZYBsvJJE3kByKv9c9+R/nAfmIfjl2rKYLNyMHboYbZaWaA=="],

    "@babel/plugin-bugfix-v8-spread-parameters-in-optional-chaining": ["@babel/plugin-bugfix-v8-spread-parameters-in-optional-chaining@7.27.1", "https://registry.npmjs.org/@babel/plugin-bugfix-v8-spread-parameters-in-optional-chaining/-/plugin-bugfix-v8-spread-parameters-in-optional-chaining-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1", "@babel/helper-skip-transparent-expression-wrappers": "^7.27.1", "@babel/plugin-transform-optional-chaining": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.13.0" } }, "sha512-oO02gcONcD5O1iTLi/6frMJBIwWEHceWGSGqrpCmEL8nogiS6J9PBlE48CaK20/Jx1LuRml9aDftLgdjXT8+Cw=="],

    "@babel/plugin-bugfix-v8-static-class-fields-redefine-readonly": ["@babel/plugin-bugfix-v8-static-class-fields-redefine-readonly@7.27.1", "https://registry.npmjs.org/@babel/plugin-bugfix-v8-static-class-fields-redefine-readonly/-/plugin-bugfix-v8-static-class-fields-redefine-readonly-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1", "@babel/traverse": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0" } }, "sha512-6BpaYGDavZqkI6yT+KSPdpZFfpnd68UKXbcjI9pJ13pvHhPrCKWOOLp+ysvMeA+DxnhuPpgIaRpxRxo5A9t5jw=="],

    "@babel/plugin-proposal-private-property-in-object": ["@babel/plugin-proposal-private-property-in-object@7.21.0-placeholder-for-preset-env.2", "https://registry.npmjs.org/@babel/plugin-proposal-private-property-in-object/-/plugin-proposal-private-property-in-object-7.21.0-placeholder-for-preset-env.2.tgz", { "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-SOSkfJDddaM7mak6cPEpswyTRnuRltl429hMraQEglW+OkovnCzsiszTmsrlY//qLFjCpQDFRvjdm2wA5pPm9w=="],

    "@babel/plugin-syntax-async-generators": ["@babel/plugin-syntax-async-generators@7.8.4", "https://registry.npmjs.org/@babel/plugin-syntax-async-generators/-/plugin-syntax-async-generators-7.8.4.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.8.0" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-tycmZxkGfZaxhMRbXlPXuVFpdWlXpir2W4AMhSJgRKzk/eDlIXOhb2LHWoLpDF7TEHylV5zNhykX6KAgHJmTNw=="],

    "@babel/plugin-syntax-bigint": ["@babel/plugin-syntax-bigint@7.8.3", "https://registry.npmjs.org/@babel/plugin-syntax-bigint/-/plugin-syntax-bigint-7.8.3.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.8.0" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-wnTnFlG+YxQm3vDxpGE57Pj0srRU4sHE/mDkt1qv2YJJSeUAec2ma4WLUnUPeKjyrfntVwe/N6dCXpU+zL3Npg=="],

    "@babel/plugin-syntax-class-properties": ["@babel/plugin-syntax-class-properties@7.12.13", "https://registry.npmjs.org/@babel/plugin-syntax-class-properties/-/plugin-syntax-class-properties-7.12.13.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.12.13" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-fm4idjKla0YahUNgFNLCB0qySdsoPiZP3iQE3rky0mBUtMZ23yDJ9SJdg6dXTSDnulOVqiF3Hgr9nbXvXTQZYA=="],

    "@babel/plugin-syntax-class-static-block": ["@babel/plugin-syntax-class-static-block@7.14.5", "https://registry.npmjs.org/@babel/plugin-syntax-class-static-block/-/plugin-syntax-class-static-block-7.14.5.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.14.5" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-b+YyPmr6ldyNnM6sqYeMWE+bgJcJpO6yS4QD7ymxgH34GBPNDM/THBh8iunyvKIZztiwLH4CJZ0RxTk9emgpjw=="],

    "@babel/plugin-syntax-import-assertions": ["@babel/plugin-syntax-import-assertions@7.27.1", "https://registry.npmjs.org/@babel/plugin-syntax-import-assertions/-/plugin-syntax-import-assertions-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-UT/Jrhw57xg4ILHLFnzFpPDlMbcdEicaAtjPQpbj9wa8T4r5KVWCimHcL/460g8Ht0DMxDyjsLgiWSkVjnwPFg=="],

    "@babel/plugin-syntax-import-attributes": ["@babel/plugin-syntax-import-attributes@7.27.1", "https://registry.npmjs.org/@babel/plugin-syntax-import-attributes/-/plugin-syntax-import-attributes-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-oFT0FrKHgF53f4vOsZGi2Hh3I35PfSmVs4IBFLFj4dnafP+hIWDLg3VyKmUHfLoLHlyxY4C7DGtmHuJgn+IGww=="],

    "@babel/plugin-syntax-import-meta": ["@babel/plugin-syntax-import-meta@7.10.4", "https://registry.npmjs.org/@babel/plugin-syntax-import-meta/-/plugin-syntax-import-meta-7.10.4.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.10.4" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-Yqfm+XDx0+Prh3VSeEQCPU81yC+JWZ2pDPFSS4ZdpfZhp4MkFMaDC1UqseovEKwSUpnIL7+vK+Clp7bfh0iD7g=="],

    "@babel/plugin-syntax-json-strings": ["@babel/plugin-syntax-json-strings@7.8.3", "https://registry.npmjs.org/@babel/plugin-syntax-json-strings/-/plugin-syntax-json-strings-7.8.3.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.8.0" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-lY6kdGpWHvjoe2vk4WrAapEuBR69EMxZl+RoGRhrFGNYVK8mOPAW8VfbT/ZgrFbXlDNiiaxQnAtgVCZ6jv30EA=="],

    "@babel/plugin-syntax-jsx": ["@babel/plugin-syntax-jsx@7.27.1", "https://registry.npmjs.org/@babel/plugin-syntax-jsx/-/plugin-syntax-jsx-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-y8YTNIeKoyhGd9O0Jiyzyyqk8gdjnumGTQPsz0xOZOQ2RmkVJeZ1vmmfIvFEKqucBG6axJGBZDE/7iI5suUI/w=="],

    "@babel/plugin-syntax-logical-assignment-operators": ["@babel/plugin-syntax-logical-assignment-operators@7.10.4", "https://registry.npmjs.org/@babel/plugin-syntax-logical-assignment-operators/-/plugin-syntax-logical-assignment-operators-7.10.4.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.10.4" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-d8waShlpFDinQ5MtvGU9xDAOzKH47+FFoney2baFIoMr952hKOLp1HR7VszoZvOsV/4+RRszNY7D17ba0te0ig=="],

    "@babel/plugin-syntax-nullish-coalescing-operator": ["@babel/plugin-syntax-nullish-coalescing-operator@7.8.3", "https://registry.npmjs.org/@babel/plugin-syntax-nullish-coalescing-operator/-/plugin-syntax-nullish-coalescing-operator-7.8.3.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.8.0" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-aSff4zPII1u2QD7y+F8oDsz19ew4IGEJg9SVW+bqwpwtfFleiQDMdzA/R+UlWDzfnHFCxxleFT0PMIrR36XLNQ=="],

    "@babel/plugin-syntax-numeric-separator": ["@babel/plugin-syntax-numeric-separator@7.10.4", "https://registry.npmjs.org/@babel/plugin-syntax-numeric-separator/-/plugin-syntax-numeric-separator-7.10.4.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.10.4" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-9H6YdfkcK/uOnY/K7/aA2xpzaAgkQn37yzWUMRK7OaPOqOpGS1+n0H5hxT9AUw9EsSjPW8SVyMJwYRtWs3X3ug=="],

    "@babel/plugin-syntax-object-rest-spread": ["@babel/plugin-syntax-object-rest-spread@7.8.3", "https://registry.npmjs.org/@babel/plugin-syntax-object-rest-spread/-/plugin-syntax-object-rest-spread-7.8.3.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.8.0" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-XoqMijGZb9y3y2XskN+P1wUGiVwWZ5JmoDRwx5+3GmEplNyVM2s2Dg8ILFQm8rWM48orGy5YpI5Bl8U1y7ydlA=="],

    "@babel/plugin-syntax-optional-catch-binding": ["@babel/plugin-syntax-optional-catch-binding@7.8.3", "https://registry.npmjs.org/@babel/plugin-syntax-optional-catch-binding/-/plugin-syntax-optional-catch-binding-7.8.3.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.8.0" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-6VPD0Pc1lpTqw0aKoeRTMiB+kWhAoT24PA+ksWSBrFtl5SIRVpZlwN3NNPQjehA2E/91FV3RjLWoVTglWcSV3Q=="],

    "@babel/plugin-syntax-optional-chaining": ["@babel/plugin-syntax-optional-chaining@7.8.3", "https://registry.npmjs.org/@babel/plugin-syntax-optional-chaining/-/plugin-syntax-optional-chaining-7.8.3.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.8.0" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-KoK9ErH1MBlCPxV0VANkXW2/dw4vlbGDrFgz8bmUsBGYkFRcbRwMh6cIJubdPrkxRwuGdtCk0v/wPTKbQgBjkg=="],

    "@babel/plugin-syntax-private-property-in-object": ["@babel/plugin-syntax-private-property-in-object@7.14.5", "https://registry.npmjs.org/@babel/plugin-syntax-private-property-in-object/-/plugin-syntax-private-property-in-object-7.14.5.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.14.5" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-0wVnp9dxJ72ZUJDV27ZfbSj6iHLoytYZmh3rFcxNnvsJF3ktkzLDZPy/mA17HGsaQT3/DQsWYX1f1QGWkCoVUg=="],

    "@babel/plugin-syntax-top-level-await": ["@babel/plugin-syntax-top-level-await@7.14.5", "https://registry.npmjs.org/@babel/plugin-syntax-top-level-await/-/plugin-syntax-top-level-await-7.14.5.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.14.5" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-hx++upLv5U1rgYfwe1xBQUhRmU41NEvpUvrp8jkrSCdvGSnM5/qdRMtylJ6PG5OFkBaHkbTAKTnd3/YyESRHFw=="],

    "@babel/plugin-syntax-typescript": ["@babel/plugin-syntax-typescript@7.27.1", "https://registry.npmjs.org/@babel/plugin-syntax-typescript/-/plugin-syntax-typescript-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-xfYCBMxveHrRMnAWl1ZlPXOZjzkN82THFvLhQhFXFt81Z5HnN+EtUkZhv/zcKpmT3fzmWZB0ywiBrbC3vogbwQ=="],

    "@babel/plugin-syntax-unicode-sets-regex": ["@babel/plugin-syntax-unicode-sets-regex@7.18.6", "https://registry.npmjs.org/@babel/plugin-syntax-unicode-sets-regex/-/plugin-syntax-unicode-sets-regex-7.18.6.tgz", { "dependencies": { "@babel/helper-create-regexp-features-plugin": "^7.18.6", "@babel/helper-plugin-utils": "^7.18.6" }, "peerDependencies": { "@babel/core": "^7.0.0" } }, "sha512-727YkEAPwSIQTv5im8QHz3upqp92JTWhidIC81Tdx4VJYIte/VndKf1qKrfnnhPLiPghStWfvC/iFaMCQu7Nqg=="],

    "@babel/plugin-transform-arrow-functions": ["@babel/plugin-transform-arrow-functions@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-arrow-functions/-/plugin-transform-arrow-functions-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-8Z4TGic6xW70FKThA5HYEKKyBpOOsucTOD1DjU3fZxDg+K3zBJcXMFnt/4yQiZnf5+MiOMSXQ9PaEK/Ilh1DeA=="],

    "@babel/plugin-transform-async-generator-functions": ["@babel/plugin-transform-async-generator-functions@7.28.0", "https://registry.npmjs.org/@babel/plugin-transform-async-generator-functions/-/plugin-transform-async-generator-functions-7.28.0.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1", "@babel/helper-remap-async-to-generator": "^7.27.1", "@babel/traverse": "^7.28.0" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-BEOdvX4+M765icNPZeidyADIvQ1m1gmunXufXxvRESy/jNNyfovIqUyE7MVgGBjWktCoJlzvFA1To2O4ymIO3Q=="],

    "@babel/plugin-transform-async-to-generator": ["@babel/plugin-transform-async-to-generator@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-async-to-generator/-/plugin-transform-async-to-generator-7.27.1.tgz", { "dependencies": { "@babel/helper-module-imports": "^7.27.1", "@babel/helper-plugin-utils": "^7.27.1", "@babel/helper-remap-async-to-generator": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-NREkZsZVJS4xmTr8qzE5y8AfIPqsdQfRuUiLRTEzb7Qii8iFWCyDKaUV2c0rCuh4ljDZ98ALHP/PetiBV2nddA=="],

    "@babel/plugin-transform-block-scoped-functions": ["@babel/plugin-transform-block-scoped-functions@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-block-scoped-functions/-/plugin-transform-block-scoped-functions-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-cnqkuOtZLapWYZUYM5rVIdv1nXYuFVIltZ6ZJ7nIj585QsjKM5dhL2Fu/lICXZ1OyIAFc7Qy+bvDAtTXqGrlhg=="],

    "@babel/plugin-transform-block-scoping": ["@babel/plugin-transform-block-scoping@7.28.0", "https://registry.npmjs.org/@babel/plugin-transform-block-scoping/-/plugin-transform-block-scoping-7.28.0.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-gKKnwjpdx5sER/wl0WN0efUBFzF/56YZO0RJrSYP4CljXnP31ByY7fol89AzomdlLNzI36AvOTmYHsnZTCkq8Q=="],

    "@babel/plugin-transform-class-properties": ["@babel/plugin-transform-class-properties@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-class-properties/-/plugin-transform-class-properties-7.27.1.tgz", { "dependencies": { "@babel/helper-create-class-features-plugin": "^7.27.1", "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-D0VcalChDMtuRvJIu3U/fwWjf8ZMykz5iZsg77Nuj821vCKI3zCyRLwRdWbsuJ/uRwZhZ002QtCqIkwC/ZkvbA=="],

    "@babel/plugin-transform-class-static-block": ["@babel/plugin-transform-class-static-block@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-class-static-block/-/plugin-transform-class-static-block-7.27.1.tgz", { "dependencies": { "@babel/helper-create-class-features-plugin": "^7.27.1", "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.12.0" } }, "sha512-s734HmYU78MVzZ++joYM+NkJusItbdRcbm+AGRgJCt3iA+yux0QpD9cBVdz3tKyrjVYWRl7j0mHSmv4lhV0aoA=="],

    "@babel/plugin-transform-classes": ["@babel/plugin-transform-classes@7.28.0", "https://registry.npmjs.org/@babel/plugin-transform-classes/-/plugin-transform-classes-7.28.0.tgz", { "dependencies": { "@babel/helper-annotate-as-pure": "^7.27.3", "@babel/helper-compilation-targets": "^7.27.2", "@babel/helper-globals": "^7.28.0", "@babel/helper-plugin-utils": "^7.27.1", "@babel/helper-replace-supers": "^7.27.1", "@babel/traverse": "^7.28.0" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-IjM1IoJNw72AZFlj33Cu8X0q2XK/6AaVC3jQu+cgQ5lThWD5ajnuUAml80dqRmOhmPkTH8uAwnpMu9Rvj0LTRA=="],

    "@babel/plugin-transform-computed-properties": ["@babel/plugin-transform-computed-properties@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-computed-properties/-/plugin-transform-computed-properties-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1", "@babel/template": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-lj9PGWvMTVksbWiDT2tW68zGS/cyo4AkZ/QTp0sQT0mjPopCmrSkzxeXkznjqBxzDI6TclZhOJbBmbBLjuOZUw=="],

    "@babel/plugin-transform-destructuring": ["@babel/plugin-transform-destructuring@7.28.0", "https://registry.npmjs.org/@babel/plugin-transform-destructuring/-/plugin-transform-destructuring-7.28.0.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1", "@babel/traverse": "^7.28.0" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-v1nrSMBiKcodhsyJ4Gf+Z0U/yawmJDBOTpEB3mcQY52r9RIyPneGyAS/yM6seP/8I+mWI3elOMtT5dB8GJVs+A=="],

    "@babel/plugin-transform-dotall-regex": ["@babel/plugin-transform-dotall-regex@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-dotall-regex/-/plugin-transform-dotall-regex-7.27.1.tgz", { "dependencies": { "@babel/helper-create-regexp-features-plugin": "^7.27.1", "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-gEbkDVGRvjj7+T1ivxrfgygpT7GUd4vmODtYpbs0gZATdkX8/iSnOtZSxiZnsgm1YjTgjI6VKBGSJJevkrclzw=="],

    "@babel/plugin-transform-duplicate-keys": ["@babel/plugin-transform-duplicate-keys@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-duplicate-keys/-/plugin-transform-duplicate-keys-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-MTyJk98sHvSs+cvZ4nOauwTTG1JeonDjSGvGGUNHreGQns+Mpt6WX/dVzWBHgg+dYZhkC4X+zTDfkTU+Vy9y7Q=="],

    "@babel/plugin-transform-duplicate-named-capturing-groups-regex": ["@babel/plugin-transform-duplicate-named-capturing-groups-regex@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-duplicate-named-capturing-groups-regex/-/plugin-transform-duplicate-named-capturing-groups-regex-7.27.1.tgz", { "dependencies": { "@babel/helper-create-regexp-features-plugin": "^7.27.1", "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0" } }, "sha512-hkGcueTEzuhB30B3eJCbCYeCaaEQOmQR0AdvzpD4LoN0GXMWzzGSuRrxR2xTnCrvNbVwK9N6/jQ92GSLfiZWoQ=="],

    "@babel/plugin-transform-dynamic-import": ["@babel/plugin-transform-dynamic-import@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-dynamic-import/-/plugin-transform-dynamic-import-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-MHzkWQcEmjzzVW9j2q8LGjwGWpG2mjwaaB0BNQwst3FIjqsg8Ct/mIZlvSPJvfi9y2AC8mi/ktxbFVL9pZ1I4A=="],

    "@babel/plugin-transform-explicit-resource-management": ["@babel/plugin-transform-explicit-resource-management@7.28.0", "https://registry.npmjs.org/@babel/plugin-transform-explicit-resource-management/-/plugin-transform-explicit-resource-management-7.28.0.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1", "@babel/plugin-transform-destructuring": "^7.28.0" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-K8nhUcn3f6iB+P3gwCv/no7OdzOZQcKchW6N389V6PD8NUWKZHzndOd9sPDVbMoBsbmjMqlB4L9fm+fEFNVlwQ=="],

    "@babel/plugin-transform-exponentiation-operator": ["@babel/plugin-transform-exponentiation-operator@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-exponentiation-operator/-/plugin-transform-exponentiation-operator-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-uspvXnhHvGKf2r4VVtBpeFnuDWsJLQ6MF6lGJLC89jBR1uoVeqM416AZtTuhTezOfgHicpJQmoD5YUakO/YmXQ=="],

    "@babel/plugin-transform-export-namespace-from": ["@babel/plugin-transform-export-namespace-from@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-export-namespace-from/-/plugin-transform-export-namespace-from-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-tQvHWSZ3/jH2xuq/vZDy0jNn+ZdXJeM8gHvX4lnJmsc3+50yPlWdZXIc5ay+umX+2/tJIqHqiEqcJvxlmIvRvQ=="],

    "@babel/plugin-transform-for-of": ["@babel/plugin-transform-for-of@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-for-of/-/plugin-transform-for-of-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1", "@babel/helper-skip-transparent-expression-wrappers": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-BfbWFFEJFQzLCQ5N8VocnCtA8J1CLkNTe2Ms2wocj75dd6VpiqS5Z5quTYcUoo4Yq+DN0rtikODccuv7RU81sw=="],

    "@babel/plugin-transform-function-name": ["@babel/plugin-transform-function-name@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-function-name/-/plugin-transform-function-name-7.27.1.tgz", { "dependencies": { "@babel/helper-compilation-targets": "^7.27.1", "@babel/helper-plugin-utils": "^7.27.1", "@babel/traverse": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-1bQeydJF9Nr1eBCMMbC+hdwmRlsv5XYOMu03YSWFwNs0HsAmtSxxF1fyuYPqemVldVyFmlCU7w8UE14LupUSZQ=="],

    "@babel/plugin-transform-json-strings": ["@babel/plugin-transform-json-strings@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-json-strings/-/plugin-transform-json-strings-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-6WVLVJiTjqcQauBhn1LkICsR2H+zm62I3h9faTDKt1qP4jn2o72tSvqMwtGFKGTpojce0gJs+76eZ2uCHRZh0Q=="],

    "@babel/plugin-transform-literals": ["@babel/plugin-transform-literals@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-literals/-/plugin-transform-literals-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-0HCFSepIpLTkLcsi86GG3mTUzxV5jpmbv97hTETW3yzrAij8aqlD36toB1D0daVFJM8NK6GvKO0gslVQmm+zZA=="],

    "@babel/plugin-transform-logical-assignment-operators": ["@babel/plugin-transform-logical-assignment-operators@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-logical-assignment-operators/-/plugin-transform-logical-assignment-operators-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-SJvDs5dXxiae4FbSL1aBJlG4wvl594N6YEVVn9e3JGulwioy6z3oPjx/sQBO3Y4NwUu5HNix6KJ3wBZoewcdbw=="],

    "@babel/plugin-transform-member-expression-literals": ["@babel/plugin-transform-member-expression-literals@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-member-expression-literals/-/plugin-transform-member-expression-literals-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-hqoBX4dcZ1I33jCSWcXrP+1Ku7kdqXf1oeah7ooKOIiAdKQ+uqftgCFNOSzA5AMS2XIHEYeGFg4cKRCdpxzVOQ=="],

    "@babel/plugin-transform-modules-amd": ["@babel/plugin-transform-modules-amd@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-modules-amd/-/plugin-transform-modules-amd-7.27.1.tgz", { "dependencies": { "@babel/helper-module-transforms": "^7.27.1", "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-iCsytMg/N9/oFq6n+gFTvUYDZQOMK5kEdeYxmxt91fcJGycfxVP9CnrxoliM0oumFERba2i8ZtwRUCMhvP1LnA=="],

    "@babel/plugin-transform-modules-commonjs": ["@babel/plugin-transform-modules-commonjs@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-modules-commonjs/-/plugin-transform-modules-commonjs-7.27.1.tgz", { "dependencies": { "@babel/helper-module-transforms": "^7.27.1", "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-OJguuwlTYlN0gBZFRPqwOGNWssZjfIUdS7HMYtN8c1KmwpwHFBwTeFZrg9XZa+DFTitWOW5iTAG7tyCUPsCCyw=="],

    "@babel/plugin-transform-modules-systemjs": ["@babel/plugin-transform-modules-systemjs@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-modules-systemjs/-/plugin-transform-modules-systemjs-7.27.1.tgz", { "dependencies": { "@babel/helper-module-transforms": "^7.27.1", "@babel/helper-plugin-utils": "^7.27.1", "@babel/helper-validator-identifier": "^7.27.1", "@babel/traverse": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-w5N1XzsRbc0PQStASMksmUeqECuzKuTJer7kFagK8AXgpCMkeDMO5S+aaFb7A51ZYDF7XI34qsTX+fkHiIm5yA=="],

    "@babel/plugin-transform-modules-umd": ["@babel/plugin-transform-modules-umd@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-modules-umd/-/plugin-transform-modules-umd-7.27.1.tgz", { "dependencies": { "@babel/helper-module-transforms": "^7.27.1", "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-iQBE/xC5BV1OxJbp6WG7jq9IWiD+xxlZhLrdwpPkTX3ydmXdvoCpyfJN7acaIBZaOqTfr76pgzqBJflNbeRK+w=="],

    "@babel/plugin-transform-named-capturing-groups-regex": ["@babel/plugin-transform-named-capturing-groups-regex@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-named-capturing-groups-regex/-/plugin-transform-named-capturing-groups-regex-7.27.1.tgz", { "dependencies": { "@babel/helper-create-regexp-features-plugin": "^7.27.1", "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0" } }, "sha512-SstR5JYy8ddZvD6MhV0tM/j16Qds4mIpJTOd1Yu9J9pJjH93bxHECF7pgtc28XvkzTD6Pxcm/0Z73Hvk7kb3Ng=="],

    "@babel/plugin-transform-new-target": ["@babel/plugin-transform-new-target@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-new-target/-/plugin-transform-new-target-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-f6PiYeqXQ05lYq3TIfIDu/MtliKUbNwkGApPUvyo6+tc7uaR4cPjPe7DFPr15Uyycg2lZU6btZ575CuQoYh7MQ=="],

    "@babel/plugin-transform-nullish-coalescing-operator": ["@babel/plugin-transform-nullish-coalescing-operator@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-nullish-coalescing-operator/-/plugin-transform-nullish-coalescing-operator-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-aGZh6xMo6q9vq1JGcw58lZ1Z0+i0xB2x0XaauNIUXd6O1xXc3RwoWEBlsTQrY4KQ9Jf0s5rgD6SiNkaUdJegTA=="],

    "@babel/plugin-transform-numeric-separator": ["@babel/plugin-transform-numeric-separator@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-numeric-separator/-/plugin-transform-numeric-separator-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-fdPKAcujuvEChxDBJ5c+0BTaS6revLV7CJL08e4m3de8qJfNIuCc2nc7XJYOjBoTMJeqSmwXJ0ypE14RCjLwaw=="],

    "@babel/plugin-transform-object-rest-spread": ["@babel/plugin-transform-object-rest-spread@7.28.0", "https://registry.npmjs.org/@babel/plugin-transform-object-rest-spread/-/plugin-transform-object-rest-spread-7.28.0.tgz", { "dependencies": { "@babel/helper-compilation-targets": "^7.27.2", "@babel/helper-plugin-utils": "^7.27.1", "@babel/plugin-transform-destructuring": "^7.28.0", "@babel/plugin-transform-parameters": "^7.27.7", "@babel/traverse": "^7.28.0" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-9VNGikXxzu5eCiQjdE4IZn8sb9q7Xsk5EXLDBKUYg1e/Tve8/05+KJEtcxGxAgCY5t/BpKQM+JEL/yT4tvgiUA=="],

    "@babel/plugin-transform-object-super": ["@babel/plugin-transform-object-super@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-object-super/-/plugin-transform-object-super-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1", "@babel/helper-replace-supers": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-SFy8S9plRPbIcxlJ8A6mT/CxFdJx/c04JEctz4jf8YZaVS2px34j7NXRrlGlHkN/M2gnpL37ZpGRGVFLd3l8Ng=="],

    "@babel/plugin-transform-optional-catch-binding": ["@babel/plugin-transform-optional-catch-binding@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-optional-catch-binding/-/plugin-transform-optional-catch-binding-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-txEAEKzYrHEX4xSZN4kJ+OfKXFVSWKB2ZxM9dpcE3wT7smwkNmXo5ORRlVzMVdJbD+Q8ILTgSD7959uj+3Dm3Q=="],

    "@babel/plugin-transform-optional-chaining": ["@babel/plugin-transform-optional-chaining@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-optional-chaining/-/plugin-transform-optional-chaining-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1", "@babel/helper-skip-transparent-expression-wrappers": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-BQmKPPIuc8EkZgNKsv0X4bPmOoayeu4F1YCwx2/CfmDSXDbp7GnzlUH+/ul5VGfRg1AoFPsrIThlEBj2xb4CAg=="],

    "@babel/plugin-transform-parameters": ["@babel/plugin-transform-parameters@7.27.7", "https://registry.npmjs.org/@babel/plugin-transform-parameters/-/plugin-transform-parameters-7.27.7.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-qBkYTYCb76RRxUM6CcZA5KRu8K4SM8ajzVeUgVdMVO9NN9uI/GaVmBg/WKJJGnNokV9SY8FxNOVWGXzqzUidBg=="],

    "@babel/plugin-transform-private-methods": ["@babel/plugin-transform-private-methods@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-private-methods/-/plugin-transform-private-methods-7.27.1.tgz", { "dependencies": { "@babel/helper-create-class-features-plugin": "^7.27.1", "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-10FVt+X55AjRAYI9BrdISN9/AQWHqldOeZDUoLyif1Kn05a56xVBXb8ZouL8pZ9jem8QpXaOt8TS7RHUIS+GPA=="],

    "@babel/plugin-transform-private-property-in-object": ["@babel/plugin-transform-private-property-in-object@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-private-property-in-object/-/plugin-transform-private-property-in-object-7.27.1.tgz", { "dependencies": { "@babel/helper-annotate-as-pure": "^7.27.1", "@babel/helper-create-class-features-plugin": "^7.27.1", "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-5J+IhqTi1XPa0DXF83jYOaARrX+41gOewWbkPyjMNRDqgOCqdffGh8L3f/Ek5utaEBZExjSAzcyjmV9SSAWObQ=="],

    "@babel/plugin-transform-property-literals": ["@babel/plugin-transform-property-literals@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-property-literals/-/plugin-transform-property-literals-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-oThy3BCuCha8kDZ8ZkgOg2exvPYUlprMukKQXI1r1pJ47NCvxfkEy8vK+r/hT9nF0Aa4H1WUPZZjHTFtAhGfmQ=="],

    "@babel/plugin-transform-react-display-name": ["@babel/plugin-transform-react-display-name@7.28.0", "https://registry.npmjs.org/@babel/plugin-transform-react-display-name/-/plugin-transform-react-display-name-7.28.0.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-D6Eujc2zMxKjfa4Zxl4GHMsmhKKZ9VpcqIchJLvwTxad9zWIYulwYItBovpDOoNLISpcZSXoDJ5gaGbQUDqViA=="],

    "@babel/plugin-transform-react-jsx": ["@babel/plugin-transform-react-jsx@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-react-jsx/-/plugin-transform-react-jsx-7.27.1.tgz", { "dependencies": { "@babel/helper-annotate-as-pure": "^7.27.1", "@babel/helper-module-imports": "^7.27.1", "@babel/helper-plugin-utils": "^7.27.1", "@babel/plugin-syntax-jsx": "^7.27.1", "@babel/types": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-2KH4LWGSrJIkVf5tSiBFYuXDAoWRq2MMwgivCf+93dd0GQi8RXLjKA/0EvRnVV5G0hrHczsquXuD01L8s6dmBw=="],

    "@babel/plugin-transform-react-jsx-development": ["@babel/plugin-transform-react-jsx-development@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-react-jsx-development/-/plugin-transform-react-jsx-development-7.27.1.tgz", { "dependencies": { "@babel/plugin-transform-react-jsx": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-ykDdF5yI4f1WrAolLqeF3hmYU12j9ntLQl/AOG1HAS21jxyg1Q0/J/tpREuYLfatGdGmXp/3yS0ZA76kOlVq9Q=="],

    "@babel/plugin-transform-react-pure-annotations": ["@babel/plugin-transform-react-pure-annotations@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-react-pure-annotations/-/plugin-transform-react-pure-annotations-7.27.1.tgz", { "dependencies": { "@babel/helper-annotate-as-pure": "^7.27.1", "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-JfuinvDOsD9FVMTHpzA/pBLisxpv1aSf+OIV8lgH3MuWrks19R27e6a6DipIg4aX1Zm9Wpb04p8wljfKrVSnPA=="],

    "@babel/plugin-transform-regenerator": ["@babel/plugin-transform-regenerator@7.28.1", "https://registry.npmjs.org/@babel/plugin-transform-regenerator/-/plugin-transform-regenerator-7.28.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-P0QiV/taaa3kXpLY+sXla5zec4E+4t4Aqc9ggHlfZ7a2cp8/x/Gv08jfwEtn9gnnYIMvHx6aoOZ8XJL8eU71Dg=="],

    "@babel/plugin-transform-regexp-modifiers": ["@babel/plugin-transform-regexp-modifiers@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-regexp-modifiers/-/plugin-transform-regexp-modifiers-7.27.1.tgz", { "dependencies": { "@babel/helper-create-regexp-features-plugin": "^7.27.1", "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0" } }, "sha512-TtEciroaiODtXvLZv4rmfMhkCv8jx3wgKpL68PuiPh2M4fvz5jhsA7697N1gMvkvr/JTF13DrFYyEbY9U7cVPA=="],

    "@babel/plugin-transform-reserved-words": ["@babel/plugin-transform-reserved-words@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-reserved-words/-/plugin-transform-reserved-words-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-V2ABPHIJX4kC7HegLkYoDpfg9PVmuWy/i6vUM5eGK22bx4YVFD3M5F0QQnWQoDs6AGsUWTVOopBiMFQgHaSkVw=="],

    "@babel/plugin-transform-shorthand-properties": ["@babel/plugin-transform-shorthand-properties@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-shorthand-properties/-/plugin-transform-shorthand-properties-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-N/wH1vcn4oYawbJ13Y/FxcQrWk63jhfNa7jef0ih7PHSIHX2LB7GWE1rkPrOnka9kwMxb6hMl19p7lidA+EHmQ=="],

    "@babel/plugin-transform-spread": ["@babel/plugin-transform-spread@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-spread/-/plugin-transform-spread-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1", "@babel/helper-skip-transparent-expression-wrappers": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-kpb3HUqaILBJcRFVhFUs6Trdd4mkrzcGXss+6/mxUd273PfbWqSDHRzMT2234gIg2QYfAjvXLSquP1xECSg09Q=="],

    "@babel/plugin-transform-sticky-regex": ["@babel/plugin-transform-sticky-regex@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-sticky-regex/-/plugin-transform-sticky-regex-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-lhInBO5bi/Kowe2/aLdBAawijx+q1pQzicSgnkB6dUPc1+RC8QmJHKf2OjvU+NZWitguJHEaEmbV6VWEouT58g=="],

    "@babel/plugin-transform-template-literals": ["@babel/plugin-transform-template-literals@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-template-literals/-/plugin-transform-template-literals-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-fBJKiV7F2DxZUkg5EtHKXQdbsbURW3DZKQUWphDum0uRP6eHGGa/He9mc0mypL680pb+e/lDIthRohlv8NCHkg=="],

    "@babel/plugin-transform-typeof-symbol": ["@babel/plugin-transform-typeof-symbol@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-typeof-symbol/-/plugin-transform-typeof-symbol-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-RiSILC+nRJM7FY5srIyc4/fGIwUhyDuuBSdWn4y6yT6gm652DpCHZjIipgn6B7MQ1ITOUnAKWixEUjQRIBIcLw=="],

    "@babel/plugin-transform-typescript": ["@babel/plugin-transform-typescript@7.28.0", "https://registry.npmjs.org/@babel/plugin-transform-typescript/-/plugin-transform-typescript-7.28.0.tgz", { "dependencies": { "@babel/helper-annotate-as-pure": "^7.27.3", "@babel/helper-create-class-features-plugin": "^7.27.1", "@babel/helper-plugin-utils": "^7.27.1", "@babel/helper-skip-transparent-expression-wrappers": "^7.27.1", "@babel/plugin-syntax-typescript": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-4AEiDEBPIZvLQaWlc9liCavE0xRM0dNca41WtBeM3jgFptfUOSG9z0uteLhq6+3rq+WB6jIvUwKDTpXEHPJ2Vg=="],

    "@babel/plugin-transform-unicode-escapes": ["@babel/plugin-transform-unicode-escapes@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-unicode-escapes/-/plugin-transform-unicode-escapes-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-Ysg4v6AmF26k9vpfFuTZg8HRfVWzsh1kVfowA23y9j/Gu6dOuahdUVhkLqpObp3JIv27MLSii6noRnuKN8H0Mg=="],

    "@babel/plugin-transform-unicode-property-regex": ["@babel/plugin-transform-unicode-property-regex@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-unicode-property-regex/-/plugin-transform-unicode-property-regex-7.27.1.tgz", { "dependencies": { "@babel/helper-create-regexp-features-plugin": "^7.27.1", "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-uW20S39PnaTImxp39O5qFlHLS9LJEmANjMG7SxIhap8rCHqu0Ik+tLEPX5DKmHn6CsWQ7j3lix2tFOa5YtL12Q=="],

    "@babel/plugin-transform-unicode-regex": ["@babel/plugin-transform-unicode-regex@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-unicode-regex/-/plugin-transform-unicode-regex-7.27.1.tgz", { "dependencies": { "@babel/helper-create-regexp-features-plugin": "^7.27.1", "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-xvINq24TRojDuyt6JGtHmkVkrfVV3FPT16uytxImLeBZqW3/H52yN+kM1MGuyPkIQxrzKwPHs5U/MP3qKyzkGw=="],

    "@babel/plugin-transform-unicode-sets-regex": ["@babel/plugin-transform-unicode-sets-regex@7.27.1", "https://registry.npmjs.org/@babel/plugin-transform-unicode-sets-regex/-/plugin-transform-unicode-sets-regex-7.27.1.tgz", { "dependencies": { "@babel/helper-create-regexp-features-plugin": "^7.27.1", "@babel/helper-plugin-utils": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0" } }, "sha512-EtkOujbc4cgvb0mlpQefi4NTPBzhSIevblFevACNLUspmrALgmEBdL/XfnyyITfd8fKBZrZys92zOWcik7j9Tw=="],

    "@babel/preset-env": ["@babel/preset-env@7.28.0", "https://registry.npmjs.org/@babel/preset-env/-/preset-env-7.28.0.tgz", { "dependencies": { "@babel/compat-data": "^7.28.0", "@babel/helper-compilation-targets": "^7.27.2", "@babel/helper-plugin-utils": "^7.27.1", "@babel/helper-validator-option": "^7.27.1", "@babel/plugin-bugfix-firefox-class-in-computed-class-key": "^7.27.1", "@babel/plugin-bugfix-safari-class-field-initializer-scope": "^7.27.1", "@babel/plugin-bugfix-safari-id-destructuring-collision-in-function-expression": "^7.27.1", "@babel/plugin-bugfix-v8-spread-parameters-in-optional-chaining": "^7.27.1", "@babel/plugin-bugfix-v8-static-class-fields-redefine-readonly": "^7.27.1", "@babel/plugin-proposal-private-property-in-object": "7.21.0-placeholder-for-preset-env.2", "@babel/plugin-syntax-import-assertions": "^7.27.1", "@babel/plugin-syntax-import-attributes": "^7.27.1", "@babel/plugin-syntax-unicode-sets-regex": "^7.18.6", "@babel/plugin-transform-arrow-functions": "^7.27.1", "@babel/plugin-transform-async-generator-functions": "^7.28.0", "@babel/plugin-transform-async-to-generator": "^7.27.1", "@babel/plugin-transform-block-scoped-functions": "^7.27.1", "@babel/plugin-transform-block-scoping": "^7.28.0", "@babel/plugin-transform-class-properties": "^7.27.1", "@babel/plugin-transform-class-static-block": "^7.27.1", "@babel/plugin-transform-classes": "^7.28.0", "@babel/plugin-transform-computed-properties": "^7.27.1", "@babel/plugin-transform-destructuring": "^7.28.0", "@babel/plugin-transform-dotall-regex": "^7.27.1", "@babel/plugin-transform-duplicate-keys": "^7.27.1", "@babel/plugin-transform-duplicate-named-capturing-groups-regex": "^7.27.1", "@babel/plugin-transform-dynamic-import": "^7.27.1", "@babel/plugin-transform-explicit-resource-management": "^7.28.0", "@babel/plugin-transform-exponentiation-operator": "^7.27.1", "@babel/plugin-transform-export-namespace-from": "^7.27.1", "@babel/plugin-transform-for-of": "^7.27.1", "@babel/plugin-transform-function-name": "^7.27.1", "@babel/plugin-transform-json-strings": "^7.27.1", "@babel/plugin-transform-literals": "^7.27.1", "@babel/plugin-transform-logical-assignment-operators": "^7.27.1", "@babel/plugin-transform-member-expression-literals": "^7.27.1", "@babel/plugin-transform-modules-amd": "^7.27.1", "@babel/plugin-transform-modules-commonjs": "^7.27.1", "@babel/plugin-transform-modules-systemjs": "^7.27.1", "@babel/plugin-transform-modules-umd": "^7.27.1", "@babel/plugin-transform-named-capturing-groups-regex": "^7.27.1", "@babel/plugin-transform-new-target": "^7.27.1", "@babel/plugin-transform-nullish-coalescing-operator": "^7.27.1", "@babel/plugin-transform-numeric-separator": "^7.27.1", "@babel/plugin-transform-object-rest-spread": "^7.28.0", "@babel/plugin-transform-object-super": "^7.27.1", "@babel/plugin-transform-optional-catch-binding": "^7.27.1", "@babel/plugin-transform-optional-chaining": "^7.27.1", "@babel/plugin-transform-parameters": "^7.27.7", "@babel/plugin-transform-private-methods": "^7.27.1", "@babel/plugin-transform-private-property-in-object": "^7.27.1", "@babel/plugin-transform-property-literals": "^7.27.1", "@babel/plugin-transform-regenerator": "^7.28.0", "@babel/plugin-transform-regexp-modifiers": "^7.27.1", "@babel/plugin-transform-reserved-words": "^7.27.1", "@babel/plugin-transform-shorthand-properties": "^7.27.1", "@babel/plugin-transform-spread": "^7.27.1", "@babel/plugin-transform-sticky-regex": "^7.27.1", "@babel/plugin-transform-template-literals": "^7.27.1", "@babel/plugin-transform-typeof-symbol": "^7.27.1", "@babel/plugin-transform-unicode-escapes": "^7.27.1", "@babel/plugin-transform-unicode-property-regex": "^7.27.1", "@babel/plugin-transform-unicode-regex": "^7.27.1", "@babel/plugin-transform-unicode-sets-regex": "^7.27.1", "@babel/preset-modules": "0.1.6-no-external-plugins", "babel-plugin-polyfill-corejs2": "^0.4.14", "babel-plugin-polyfill-corejs3": "^0.13.0", "babel-plugin-polyfill-regenerator": "^0.6.5", "core-js-compat": "^3.43.0", "semver": "^6.3.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-VmaxeGOwuDqzLl5JUkIRM1X2Qu2uKGxHEQWh+cvvbl7JuJRgKGJSfsEF/bUaxFhJl/XAyxBe7q7qSuTbKFuCyg=="],

    "@babel/preset-modules": ["@babel/preset-modules@0.1.6-no-external-plugins", "https://registry.npmjs.org/@babel/preset-modules/-/preset-modules-0.1.6-no-external-plugins.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.0.0", "@babel/types": "^7.4.4", "esutils": "^2.0.2" }, "peerDependencies": { "@babel/core": "^7.0.0-0 || ^8.0.0-0 <8.0.0" } }, "sha512-HrcgcIESLm9aIR842yhJ5RWan/gebQUJ6E/E5+rf0y9o6oj7w0Br+sWuL6kEQ/o/AdfvR1Je9jG18/gnpwjEyA=="],

    "@babel/preset-react": ["@babel/preset-react@7.27.1", "https://registry.npmjs.org/@babel/preset-react/-/preset-react-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1", "@babel/helper-validator-option": "^7.27.1", "@babel/plugin-transform-react-display-name": "^7.27.1", "@babel/plugin-transform-react-jsx": "^7.27.1", "@babel/plugin-transform-react-jsx-development": "^7.27.1", "@babel/plugin-transform-react-pure-annotations": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-oJHWh2gLhU9dW9HHr42q0cI0/iHHXTLGe39qvpAZZzagHy0MzYLCnCVV0symeRvzmjHyVU7mw2K06E6u/JwbhA=="],

    "@babel/preset-typescript": ["@babel/preset-typescript@7.27.1", "https://registry.npmjs.org/@babel/preset-typescript/-/preset-typescript-7.27.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.27.1", "@babel/helper-validator-option": "^7.27.1", "@babel/plugin-syntax-jsx": "^7.27.1", "@babel/plugin-transform-modules-commonjs": "^7.27.1", "@babel/plugin-transform-typescript": "^7.27.1" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-l7WfQfX0WK4M0v2RudjuQK4u99BS6yLHYEmdtVPP7lKV013zr9DygFuWNlnbvQ9LR+LS0Egz/XAvGx5U9MX0fQ=="],

    "@babel/template": ["@babel/template@7.27.2", "https://registry.npmjs.org/@babel/template/-/template-7.27.2.tgz", { "dependencies": { "@babel/code-frame": "^7.27.1", "@babel/parser": "^7.27.2", "@babel/types": "^7.27.1" } }, "sha512-LPDZ85aEJyYSd18/DkjNh4/y1ntkE5KwUHWTiqgRxruuZL2F1yuHligVHLvcHY2vMHXttKFpJn6LwfI7cw7ODw=="],

    "@babel/traverse": ["@babel/traverse@7.28.0", "https://registry.npmjs.org/@babel/traverse/-/traverse-7.28.0.tgz", { "dependencies": { "@babel/code-frame": "^7.27.1", "@babel/generator": "^7.28.0", "@babel/helper-globals": "^7.28.0", "@babel/parser": "^7.28.0", "@babel/template": "^7.27.2", "@babel/types": "^7.28.0", "debug": "^4.3.1" } }, "sha512-mGe7UK5wWyh0bKRfupsUchrQGqvDbZDbKJw+kcRGSmdHVYrv+ltd0pnpDTVpiTqnaBru9iEvA8pz8W46v0Amwg=="],

    "@babel/types": ["@babel/types@7.28.1", "https://registry.npmjs.org/@babel/types/-/types-7.28.1.tgz", { "dependencies": { "@babel/helper-string-parser": "^7.27.1", "@babel/helper-validator-identifier": "^7.27.1" } }, "sha512-x0LvFTekgSX+83TI28Y9wYPUfzrnl2aT5+5QLnO6v7mSJYtEEevuDRN0F0uSHRk1G1IWZC43o00Y0xDDrpBGPQ=="],

    "@bcoe/v8-coverage": ["@bcoe/v8-coverage@0.2.3", "https://registry.npmjs.org/@bcoe/v8-coverage/-/v8-coverage-0.2.3.tgz", {}, "sha512-0hYQ8SB4Db5zvZB4axdMHGwEaQjkZzFjQiN9LVYvIFB2nSUHW9tYpxWriPrWDASIxiaXax83REcLxuSdnGPZtw=="],

    "@eslint-community/eslint-utils": ["@eslint-community/eslint-utils@4.7.0", "https://registry.npmjs.org/@eslint-community/eslint-utils/-/eslint-utils-4.7.0.tgz", { "dependencies": { "eslint-visitor-keys": "^3.4.3" }, "peerDependencies": { "eslint": "^6.0.0 || ^7.0.0 || >=8.0.0" } }, "sha512-dyybb3AcajC7uha6CvhdVRJqaKyn7w2YKqKyAN37NKYgZT36w+iRb0Dymmc5qEJ549c/S31cMMSFd75bteCpCw=="],

    "@eslint-community/regexpp": ["@eslint-community/regexpp@4.12.1", "https://registry.npmjs.org/@eslint-community/regexpp/-/regexpp-4.12.1.tgz", {}, "sha512-CCZCDJuduB9OUkFkY2IgppNZMi2lBQgD2qzwXkEia16cge2pijY/aXi96CJMquDMn3nJdlPV1A5KrJEXwfLNzQ=="],

    "@eslint/eslintrc": ["@eslint/eslintrc@2.1.4", "https://registry.npmjs.org/@eslint/eslintrc/-/eslintrc-2.1.4.tgz", { "dependencies": { "ajv": "^6.12.4", "debug": "^4.3.2", "espree": "^9.6.0", "globals": "^13.19.0", "ignore": "^5.2.0", "import-fresh": "^3.2.1", "js-yaml": "^4.1.0", "minimatch": "^3.1.2", "strip-json-comments": "^3.1.1" } }, "sha512-269Z39MS6wVJtsoUl10L60WdkhJVdPG24Q4eZTH3nnF6lpvSShEK3wQjDX9JRWAUPvPh7COouPpU9IrqaZFvtQ=="],

    "@eslint/js": ["@eslint/js@8.57.1", "https://registry.npmjs.org/@eslint/js/-/js-8.57.1.tgz", {}, "sha512-d9zaMRSTIKDLhctzH12MtXvJKSSUhaHcjV+2Z+GK+EEY7XKpP5yR4x+N3TAcHTcu963nIr+TMcCb4DBCYX1z6Q=="],

    "@humanwhocodes/config-array": ["@humanwhocodes/config-array@0.13.0", "https://registry.npmjs.org/@humanwhocodes/config-array/-/config-array-0.13.0.tgz", { "dependencies": { "@humanwhocodes/object-schema": "^2.0.3", "debug": "^4.3.1", "minimatch": "^3.0.5" } }, "sha512-DZLEEqFWQFiyK6h5YIeynKx7JlvCYWL0cImfSRXZ9l4Sg2efkFGTuFf6vzXjK1cq6IYkU+Eg/JizXw+TD2vRNw=="],

    "@humanwhocodes/module-importer": ["@humanwhocodes/module-importer@1.0.1", "https://registry.npmjs.org/@humanwhocodes/module-importer/-/module-importer-1.0.1.tgz", {}, "sha512-bxveV4V8v5Yb4ncFTT3rPSgZBOpCkjfK0y4oVVVJwIuDVBRMDXrPyXRL988i5ap9m9bnyEEjWfm5WkBmtffLfA=="],

    "@humanwhocodes/object-schema": ["@humanwhocodes/object-schema@2.0.3", "https://registry.npmjs.org/@humanwhocodes/object-schema/-/object-schema-2.0.3.tgz", {}, "sha512-93zYdMES/c1D69yZiKDBj0V24vqNzB/koF26KPaagAfd3P/4gUlh3Dys5ogAK+Exi9QyzlD8x/08Zt7wIKcDcA=="],

    "@istanbuljs/load-nyc-config": ["@istanbuljs/load-nyc-config@1.1.0", "https://registry.npmjs.org/@istanbuljs/load-nyc-config/-/load-nyc-config-1.1.0.tgz", { "dependencies": { "camelcase": "^5.3.1", "find-up": "^4.1.0", "get-package-type": "^0.1.0", "js-yaml": "^3.13.1", "resolve-from": "^5.0.0" } }, "sha512-VjeHSlIzpv/NyD3N0YuHfXOPDIixcA1q2ZV98wsMqcYlPmv2n3Yb2lYP9XMElnaFVXg5A7YLTeLu6V84uQDjmQ=="],

    "@istanbuljs/schema": ["@istanbuljs/schema@0.1.3", "https://registry.npmjs.org/@istanbuljs/schema/-/schema-0.1.3.tgz", {}, "sha512-ZXRY4jNvVgSVQ8DL3LTcakaAtXwTVUxE81hslsyD2AtoXW/wVob10HkOJ1X/pAlcI7D+2YoZKg5do8G/w6RYgA=="],

    "@jest/console": ["@jest/console@29.7.0", "https://registry.npmjs.org/@jest/console/-/console-29.7.0.tgz", { "dependencies": { "@jest/types": "^29.6.3", "@types/node": "*", "chalk": "^4.0.0", "jest-message-util": "^29.7.0", "jest-util": "^29.7.0", "slash": "^3.0.0" } }, "sha512-5Ni4CU7XHQi32IJ398EEP4RrB8eV09sXP2ROqD4bksHrnTree52PsxvX8tpL8LvTZ3pFzXyPbNQReSN41CAhOg=="],

    "@jest/core": ["@jest/core@29.7.0", "https://registry.npmjs.org/@jest/core/-/core-29.7.0.tgz", { "dependencies": { "@jest/console": "^29.7.0", "@jest/reporters": "^29.7.0", "@jest/test-result": "^29.7.0", "@jest/transform": "^29.7.0", "@jest/types": "^29.6.3", "@types/node": "*", "ansi-escapes": "^4.2.1", "chalk": "^4.0.0", "ci-info": "^3.2.0", "exit": "^0.1.2", "graceful-fs": "^4.2.9", "jest-changed-files": "^29.7.0", "jest-config": "^29.7.0", "jest-haste-map": "^29.7.0", "jest-message-util": "^29.7.0", "jest-regex-util": "^29.6.3", "jest-resolve": "^29.7.0", "jest-resolve-dependencies": "^29.7.0", "jest-runner": "^29.7.0", "jest-runtime": "^29.7.0", "jest-snapshot": "^29.7.0", "jest-util": "^29.7.0", "jest-validate": "^29.7.0", "jest-watcher": "^29.7.0", "micromatch": "^4.0.4", "pretty-format": "^29.7.0", "slash": "^3.0.0", "strip-ansi": "^6.0.0" }, "peerDependencies": { "node-notifier": "^8.0.1 || ^9.0.0 || ^10.0.0" }, "optionalPeers": ["node-notifier"] }, "sha512-n7aeXWKMnGtDA48y8TLWJPJmLmmZ642Ceo78cYWEpiD7FzDgmNDV/GCVRorPABdXLJZ/9wzzgZAlHjXjxDHGsg=="],

    "@jest/environment": ["@jest/environment@29.7.0", "https://registry.npmjs.org/@jest/environment/-/environment-29.7.0.tgz", { "dependencies": { "@jest/fake-timers": "^29.7.0", "@jest/types": "^29.6.3", "@types/node": "*", "jest-mock": "^29.7.0" } }, "sha512-aQIfHDq33ExsN4jP1NWGXhxgQ/wixs60gDiKO+XVMd8Mn0NWPWgc34ZQDTb2jKaUWQ7MuwoitXAsN2XVXNMpAw=="],

    "@jest/expect": ["@jest/expect@29.7.0", "https://registry.npmjs.org/@jest/expect/-/expect-29.7.0.tgz", { "dependencies": { "expect": "^29.7.0", "jest-snapshot": "^29.7.0" } }, "sha512-8uMeAMycttpva3P1lBHB8VciS9V0XAr3GymPpipdyQXbBcuhkLQOSe8E/p92RyAdToS6ZD1tFkX+CkhoECE0dQ=="],

    "@jest/expect-utils": ["@jest/expect-utils@29.7.0", "https://registry.npmjs.org/@jest/expect-utils/-/expect-utils-29.7.0.tgz", { "dependencies": { "jest-get-type": "^29.6.3" } }, "sha512-GlsNBWiFQFCVi9QVSx7f5AgMeLxe9YCCs5PuP2O2LdjDAA8Jh9eX7lA1Jq/xdXw3Wb3hyvlFNfZIfcRetSzYcA=="],

    "@jest/fake-timers": ["@jest/fake-timers@29.7.0", "https://registry.npmjs.org/@jest/fake-timers/-/fake-timers-29.7.0.tgz", { "dependencies": { "@jest/types": "^29.6.3", "@sinonjs/fake-timers": "^10.0.2", "@types/node": "*", "jest-message-util": "^29.7.0", "jest-mock": "^29.7.0", "jest-util": "^29.7.0" } }, "sha512-q4DH1Ha4TTFPdxLsqDXK1d3+ioSL7yL5oCMJZgDYm6i+6CygW5E5xVr/D1HdsGxjt1ZWSfUAs9OxSB/BNelWrQ=="],

    "@jest/globals": ["@jest/globals@29.7.0", "https://registry.npmjs.org/@jest/globals/-/globals-29.7.0.tgz", { "dependencies": { "@jest/environment": "^29.7.0", "@jest/expect": "^29.7.0", "@jest/types": "^29.6.3", "jest-mock": "^29.7.0" } }, "sha512-mpiz3dutLbkW2MNFubUGUEVLkTGiqW6yLVTA+JbP6fI6J5iL9Y0Nlg8k95pcF8ctKwCS7WVxteBs29hhfAotzQ=="],

    "@jest/reporters": ["@jest/reporters@29.7.0", "https://registry.npmjs.org/@jest/reporters/-/reporters-29.7.0.tgz", { "dependencies": { "@bcoe/v8-coverage": "^0.2.3", "@jest/console": "^29.7.0", "@jest/test-result": "^29.7.0", "@jest/transform": "^29.7.0", "@jest/types": "^29.6.3", "@jridgewell/trace-mapping": "^0.3.18", "@types/node": "*", "chalk": "^4.0.0", "collect-v8-coverage": "^1.0.0", "exit": "^0.1.2", "glob": "^7.1.3", "graceful-fs": "^4.2.9", "istanbul-lib-coverage": "^3.0.0", "istanbul-lib-instrument": "^6.0.0", "istanbul-lib-report": "^3.0.0", "istanbul-lib-source-maps": "^4.0.0", "istanbul-reports": "^3.1.3", "jest-message-util": "^29.7.0", "jest-util": "^29.7.0", "jest-worker": "^29.7.0", "slash": "^3.0.0", "string-length": "^4.0.1", "strip-ansi": "^6.0.0", "v8-to-istanbul": "^9.0.1" }, "peerDependencies": { "node-notifier": "^8.0.1 || ^9.0.0 || ^10.0.0" }, "optionalPeers": ["node-notifier"] }, "sha512-DApq0KJbJOEzAFYjHADNNxAE3KbhxQB1y5Kplb5Waqw6zVbuWatSnMjE5gs8FUgEPmNsnZA3NCWl9NG0ia04Pg=="],

    "@jest/schemas": ["@jest/schemas@29.6.3", "https://registry.npmjs.org/@jest/schemas/-/schemas-29.6.3.tgz", { "dependencies": { "@sinclair/typebox": "^0.27.8" } }, "sha512-mo5j5X+jIZmJQveBKeS/clAueipV7KgiX1vMgCxam1RNYiqE1w62n0/tJJnHtjW8ZHcQco5gY85jA3mi0L+nSA=="],

    "@jest/source-map": ["@jest/source-map@29.6.3", "https://registry.npmjs.org/@jest/source-map/-/source-map-29.6.3.tgz", { "dependencies": { "@jridgewell/trace-mapping": "^0.3.18", "callsites": "^3.0.0", "graceful-fs": "^4.2.9" } }, "sha512-MHjT95QuipcPrpLM+8JMSzFx6eHp5Bm+4XeFDJlwsvVBjmKNiIAvasGK2fxz2WbGRlnvqehFbh07MMa7n3YJnw=="],

    "@jest/test-result": ["@jest/test-result@29.7.0", "https://registry.npmjs.org/@jest/test-result/-/test-result-29.7.0.tgz", { "dependencies": { "@jest/console": "^29.7.0", "@jest/types": "^29.6.3", "@types/istanbul-lib-coverage": "^2.0.0", "collect-v8-coverage": "^1.0.0" } }, "sha512-Fdx+tv6x1zlkJPcWXmMDAG2HBnaR9XPSd5aDWQVsfrZmLVT3lU1cwyxLgRmXR9yrq4NBoEm9BMsfgFzTQAbJYA=="],

    "@jest/test-sequencer": ["@jest/test-sequencer@29.7.0", "https://registry.npmjs.org/@jest/test-sequencer/-/test-sequencer-29.7.0.tgz", { "dependencies": { "@jest/test-result": "^29.7.0", "graceful-fs": "^4.2.9", "jest-haste-map": "^29.7.0", "slash": "^3.0.0" } }, "sha512-GQwJ5WZVrKnOJuiYiAF52UNUJXgTZx1NHjFSEB0qEMmSZKAkdMoIzw/Cj6x6NF4AvV23AUqDpFzQkN/eYCYTxw=="],

    "@jest/transform": ["@jest/transform@29.7.0", "https://registry.npmjs.org/@jest/transform/-/transform-29.7.0.tgz", { "dependencies": { "@babel/core": "^7.11.6", "@jest/types": "^29.6.3", "@jridgewell/trace-mapping": "^0.3.18", "babel-plugin-istanbul": "^6.1.1", "chalk": "^4.0.0", "convert-source-map": "^2.0.0", "fast-json-stable-stringify": "^2.1.0", "graceful-fs": "^4.2.9", "jest-haste-map": "^29.7.0", "jest-regex-util": "^29.6.3", "jest-util": "^29.7.0", "micromatch": "^4.0.4", "pirates": "^4.0.4", "slash": "^3.0.0", "write-file-atomic": "^4.0.2" } }, "sha512-ok/BTPFzFKVMwO5eOHRrvnBVHdRy9IrsrW1GpMaQ9MCnilNLXQKmAX8s1YXDFaai9xJpac2ySzV0YeRRECr2Vw=="],

    "@jest/types": ["@jest/types@29.6.3", "https://registry.npmjs.org/@jest/types/-/types-29.6.3.tgz", { "dependencies": { "@jest/schemas": "^29.6.3", "@types/istanbul-lib-coverage": "^2.0.0", "@types/istanbul-reports": "^3.0.0", "@types/node": "*", "@types/yargs": "^17.0.8", "chalk": "^4.0.0" } }, "sha512-u3UPsIilWKOM3F9CXtrG8LEJmNxwoCQC/XVj4IKYXvvpx7QIi/Kg1LI5uDmDpKlac62NUtX7eLjRh+jVZcLOzw=="],

    "@jridgewell/gen-mapping": ["@jridgewell/gen-mapping@0.3.12", "https://registry.npmjs.org/@jridgewell/gen-mapping/-/gen-mapping-0.3.12.tgz", { "dependencies": { "@jridgewell/sourcemap-codec": "^1.5.0", "@jridgewell/trace-mapping": "^0.3.24" } }, "sha512-OuLGC46TjB5BbN1dH8JULVVZY4WTdkF7tV9Ys6wLL1rubZnCMstOhNHueU5bLCrnRuDhKPDM4g6sw4Bel5Gzqg=="],

    "@jridgewell/resolve-uri": ["@jridgewell/resolve-uri@3.1.2", "https://registry.npmjs.org/@jridgewell/resolve-uri/-/resolve-uri-3.1.2.tgz", {}, "sha512-bRISgCIjP20/tbWSPWMEi54QVPRZExkuD9lJL+UIxUKtwVJA8wW1Trb1jMs1RFXo1CBTNZ/5hpC9QvmKWdopKw=="],

    "@jridgewell/sourcemap-codec": ["@jridgewell/sourcemap-codec@1.5.4", "https://registry.npmjs.org/@jridgewell/sourcemap-codec/-/sourcemap-codec-1.5.4.tgz", {}, "sha512-VT2+G1VQs/9oz078bLrYbecdZKs912zQlkelYpuf+SXF+QvZDYJlbx/LSx+meSAwdDFnF8FVXW92AVjjkVmgFw=="],

    "@jridgewell/trace-mapping": ["@jridgewell/trace-mapping@0.3.29", "https://registry.npmjs.org/@jridgewell/trace-mapping/-/trace-mapping-0.3.29.tgz", { "dependencies": { "@jridgewell/resolve-uri": "^3.1.0", "@jridgewell/sourcemap-codec": "^1.4.14" } }, "sha512-uw6guiW/gcAGPDhLmd77/6lW8QLeiV5RUTsAX46Db6oLhGaVj4lhnPwb184s1bkc8kdVg/+h988dro8GRDpmYQ=="],

    "@nodelib/fs.scandir": ["@nodelib/fs.scandir@2.1.5", "https://registry.npmjs.org/@nodelib/fs.scandir/-/fs.scandir-2.1.5.tgz", { "dependencies": { "@nodelib/fs.stat": "2.0.5", "run-parallel": "^1.1.9" } }, "sha512-vq24Bq3ym5HEQm2NKCr3yXDwjc7vTsEThRDnkp2DK9p1uqLR+DHurm/NOTo0KG7HYHU7eppKZj3MyqYuMBf62g=="],

    "@nodelib/fs.stat": ["@nodelib/fs.stat@2.0.5", "https://registry.npmjs.org/@nodelib/fs.stat/-/fs.stat-2.0.5.tgz", {}, "sha512-RkhPPp2zrqDAQA/2jNhnztcPAlv64XdhIp7a7454A5ovI7Bukxgt7MX7udwAu3zg1DcpPU0rz3VV1SeaqvY4+A=="],

    "@nodelib/fs.walk": ["@nodelib/fs.walk@1.2.8", "https://registry.npmjs.org/@nodelib/fs.walk/-/fs.walk-1.2.8.tgz", { "dependencies": { "@nodelib/fs.scandir": "2.1.5", "fastq": "^1.6.0" } }, "sha512-oGB+UxlgWcgQkgwo8GcEGwemoTFt3FIO9ababBmaGwXIoBKZ+GTy0pP185beGg7Llih/NSHSV2XAs1lnznocSg=="],

    "@nrwl/cli": ["@nrwl/cli@15.0.13", "https://registry.npmjs.org/@nrwl/cli/-/cli-15.0.13.tgz", { "dependencies": { "nx": "15.0.13" } }, "sha512-w0oOP4v176CbD34+VytiAItIH3fOeiaccq7T2Un/hhx+/Q9mdO/VWyYZOKmp85uGodx/yZ6LyGW6rX0BjM0Rsg=="],

    "@nrwl/devkit": ["@nrwl/devkit@15.0.13", "https://registry.npmjs.org/@nrwl/devkit/-/devkit-15.0.13.tgz", { "dependencies": { "@phenomnomnominal/tsquery": "4.1.1", "ejs": "^3.1.7", "ignore": "^5.0.4", "semver": "7.3.4", "tslib": "^2.3.0" }, "peerDependencies": { "nx": ">= 14 <= 16" } }, "sha512-/8k7wbBRFf2UC+T4F+vWMy3bfSGi+uK6RwXk53moLq3nxehXaQhRiCqasC6VJFUw3zK6luu2T7xkPUlA9K9l4w=="],

    "@nrwl/jest": ["@nrwl/jest@15.0.13", "https://registry.npmjs.org/@nrwl/jest/-/jest-15.0.13.tgz", { "dependencies": { "@jest/reporters": "28.1.1", "@jest/test-result": "28.1.1", "@nrwl/devkit": "15.0.13", "@phenomnomnominal/tsquery": "4.1.1", "chalk": "4.1.0", "dotenv": "~10.0.0", "identity-obj-proxy": "3.0.0", "jest-config": "28.1.1", "jest-resolve": "28.1.1", "jest-util": "28.1.1", "resolve.exports": "1.1.0", "tslib": "^2.3.0" } }, "sha512-env+EO+uvyw85dL7tPwR6VFe0CLGcn82EAaxFwY83XUmdM9n92OR2XY0RecoDzo6uL2kRFb8x++Jy3OVLmqVYA=="],

    "@nrwl/linter": ["@nrwl/linter@15.0.13", "https://registry.npmjs.org/@nrwl/linter/-/linter-15.0.13.tgz", { "dependencies": { "@nrwl/devkit": "15.0.13", "@nrwl/jest": "15.0.13", "@phenomnomnominal/tsquery": "4.1.1", "nx": "15.0.13", "tmp": "~0.2.1", "tslib": "^2.3.0" }, "peerDependencies": { "eslint": "^8.0.0" }, "optionalPeers": ["eslint"] }, "sha512-u/6eO6k/9ceVP0y/0dbDUcoHh/MNebTa8DBugarhKgRYXyA0jIIg3ZIw2oJmKaIVicFMAAM2uxkyVQUvIltiuA=="],

    "@nrwl/tao": ["@nrwl/tao@15.0.13", "https://registry.npmjs.org/@nrwl/tao/-/tao-15.0.13.tgz", { "dependencies": { "nx": "15.0.13" }, "bin": { "tao": "index.js" } }, "sha512-z55RKnVOYsiABKFUIj+QBf6I4fUwTlObxJpgUJp0i3E97P3BgbzhTG1EhuBxLH8fGKrbOAPs0ct38Asl+zGZfQ=="],

    "@nrwl/workspace": ["@nrwl/workspace@15.0.13", "https://registry.npmjs.org/@nrwl/workspace/-/workspace-15.0.13.tgz", { "dependencies": { "@nrwl/devkit": "15.0.13", "@nrwl/jest": "15.0.13", "@nrwl/linter": "15.0.13", "@parcel/watcher": "2.0.4", "chalk": "4.1.0", "chokidar": "^3.5.1", "cli-cursor": "3.1.0", "cli-spinners": "2.6.1", "dotenv": "~10.0.0", "enquirer": "~2.3.6", "figures": "3.2.0", "flat": "^5.0.2", "fs-extra": "^10.1.0", "glob": "7.1.4", "ignore": "^5.0.4", "minimatch": "3.0.5", "npm-run-path": "^4.0.1", "nx": "15.0.13", "open": "^8.4.0", "rxjs": "^6.5.4", "semver": "7.3.4", "tmp": "~0.2.1", "tslib": "^2.3.0", "yargs": "^17.6.2", "yargs-parser": "21.1.1" }, "peerDependencies": { "prettier": "^2.6.2" }, "optionalPeers": ["prettier"] }, "sha512-G+emebnp8lIOf4ytYd3fUIGhVtnZAg+qhkXYyYZdlsNFBK1qYmkCVPIAL8fLLnHNT1NXe5zYTJzoHEEl/eoKSw=="],

    "@parcel/watcher": ["@parcel/watcher@2.0.4", "https://registry.npmjs.org/@parcel/watcher/-/watcher-2.0.4.tgz", { "dependencies": { "node-addon-api": "^3.2.1", "node-gyp-build": "^4.3.0" } }, "sha512-cTDi+FUDBIUOBKEtj+nhiJ71AZVlkAsQFuGQTun5tV9mwQBQgZvhCzG+URPQc8myeN32yRVZEfVAPCs1RW+Jvg=="],

    "@phenomnomnominal/tsquery": ["@phenomnomnominal/tsquery@5.0.1", "https://registry.npmjs.org/@phenomnomnominal/tsquery/-/tsquery-5.0.1.tgz", { "dependencies": { "esquery": "^1.4.0" }, "peerDependencies": { "typescript": "^3 || ^4 || ^5" } }, "sha512-3nVv+e2FQwsW8Aw6qTU6f+1rfcJ3hrcnvH/mu9i8YhxO+9sqbOfpL8m6PbET5+xKOlz/VSbp0RoYWYCtIsnmuA=="],

    "@sinclair/typebox": ["@sinclair/typebox@0.27.8", "https://registry.npmjs.org/@sinclair/typebox/-/typebox-0.27.8.tgz", {}, "sha512-+Fj43pSMwJs4KRrH/938Uf+uAELIgVBmQzg/q1YG10djyfA3TnrU8N8XzqCh/okZdszqBQTZf96idMfE5lnwTA=="],

    "@sinonjs/commons": ["@sinonjs/commons@3.0.1", "https://registry.npmjs.org/@sinonjs/commons/-/commons-3.0.1.tgz", { "dependencies": { "type-detect": "4.0.8" } }, "sha512-K3mCHKQ9sVh8o1C9cxkwxaOmXoAMlDxC1mYyHrjqOWEcBjYr76t96zL2zlj5dUGZ3HSw240X1qgH3Mjf1yJWpQ=="],

    "@sinonjs/fake-timers": ["@sinonjs/fake-timers@10.3.0", "https://registry.npmjs.org/@sinonjs/fake-timers/-/fake-timers-10.3.0.tgz", { "dependencies": { "@sinonjs/commons": "^3.0.0" } }, "sha512-V4BG07kuYSUkTCSBHG8G8TNhM+F19jXFWnQtzj+we8DrkpSBCee9Z3Ms8yiGer/dlmhe35/Xdgyo3/0rQKg7YA=="],

    "@types/babel__core": ["@types/babel__core@7.20.5", "https://registry.npmjs.org/@types/babel__core/-/babel__core-7.20.5.tgz", { "dependencies": { "@babel/parser": "^7.20.7", "@babel/types": "^7.20.7", "@types/babel__generator": "*", "@types/babel__template": "*", "@types/babel__traverse": "*" } }, "sha512-qoQprZvz5wQFJwMDqeseRXWv3rqMvhgpbXFfVyWhbx9X47POIA6i/+dXefEmZKoAgOaTdaIgNSMqMIU61yRyzA=="],

    "@types/babel__generator": ["@types/babel__generator@7.27.0", "https://registry.npmjs.org/@types/babel__generator/-/babel__generator-7.27.0.tgz", { "dependencies": { "@babel/types": "^7.0.0" } }, "sha512-ufFd2Xi92OAVPYsy+P4n7/U7e68fex0+Ee8gSG9KX7eo084CWiQ4sdxktvdl0bOPupXtVJPY19zk6EwWqUQ8lg=="],

    "@types/babel__template": ["@types/babel__template@7.4.4", "https://registry.npmjs.org/@types/babel__template/-/babel__template-7.4.4.tgz", { "dependencies": { "@babel/parser": "^7.1.0", "@babel/types": "^7.0.0" } }, "sha512-h/NUaSyG5EyxBIp8YRxo4RMe2/qQgvyowRwVMzhYhBCONbW8PUsg4lkFMrhgZhUe5z3L3MiLDuvyJ/CaPa2A8A=="],

    "@types/babel__traverse": ["@types/babel__traverse@7.20.7", "https://registry.npmjs.org/@types/babel__traverse/-/babel__traverse-7.20.7.tgz", { "dependencies": { "@babel/types": "^7.20.7" } }, "sha512-dkO5fhS7+/oos4ciWxyEyjWe48zmG6wbCheo/G2ZnHx4fs3EU6YC6UM8rk56gAjNJ9P3MTH2jo5jb92/K6wbng=="],

    "@types/graceful-fs": ["@types/graceful-fs@4.1.9", "https://registry.npmjs.org/@types/graceful-fs/-/graceful-fs-4.1.9.tgz", { "dependencies": { "@types/node": "*" } }, "sha512-olP3sd1qOEe5dXTSaFvQG+02VdRXcdytWLAZsAq1PecU8uqQAhkrnbli7DagjtXKW/Bl7YJbUsa8MPcuc8LHEQ=="],

    "@types/istanbul-lib-coverage": ["@types/istanbul-lib-coverage@2.0.6", "https://registry.npmjs.org/@types/istanbul-lib-coverage/-/istanbul-lib-coverage-2.0.6.tgz", {}, "sha512-2QF/t/auWm0lsy8XtKVPG19v3sSOQlJe/YHZgfjb/KBBHOGSV+J2q/S671rcq9uTBrLAXmZpqJiaQbMT+zNU1w=="],

    "@types/istanbul-lib-report": ["@types/istanbul-lib-report@3.0.3", "https://registry.npmjs.org/@types/istanbul-lib-report/-/istanbul-lib-report-3.0.3.tgz", { "dependencies": { "@types/istanbul-lib-coverage": "*" } }, "sha512-NQn7AHQnk/RSLOxrBbGyJM/aVQ+pjj5HCgasFxc0K/KhoATfQ/47AyUl15I2yBUpihjmas+a+VJBOqecrFH+uA=="],

    "@types/istanbul-reports": ["@types/istanbul-reports@3.0.4", "https://registry.npmjs.org/@types/istanbul-reports/-/istanbul-reports-3.0.4.tgz", { "dependencies": { "@types/istanbul-lib-report": "*" } }, "sha512-pk2B1NWalF9toCRu6gjBzR69syFjP4Od8WRAX+0mmf9lAjCRicLOWc+ZrxZHx/0XRjotgkF9t6iaMJ+aXcOdZQ=="],

    "@types/json5": ["@types/json5@0.0.29", "https://registry.npmjs.org/@types/json5/-/json5-0.0.29.tgz", {}, "sha512-dRLjCWHYg4oaA77cxO64oO+7JwCwnIzkZPdrrC71jQmQtlhM556pwKo5bUzqvZndkVbeFLIIi+9TC40JNF5hNQ=="],

    "@types/node": ["@types/node@24.0.14", "https://registry.npmjs.org/@types/node/-/node-24.0.14.tgz", { "dependencies": { "undici-types": "~7.8.0" } }, "sha512-4zXMWD91vBLGRtHK3YbIoFMia+1nqEz72coM42C5ETjnNCa/heoj7NT1G67iAfOqMmcfhuCZ4uNpyz8EjlAejw=="],

    "@types/prettier": ["@types/prettier@2.7.3", "https://registry.npmjs.org/@types/prettier/-/prettier-2.7.3.tgz", {}, "sha512-+68kP9yzs4LMp7VNh8gdzMSPZFL44MLGqiHWvttYJe+6qnuVr4Ek9wSBQoveqY/r+LwjCcU29kNVkidwim+kYA=="],

    "@types/stack-utils": ["@types/stack-utils@2.0.3", "https://registry.npmjs.org/@types/stack-utils/-/stack-utils-2.0.3.tgz", {}, "sha512-9aEbYZ3TbYMznPdcdr3SmIrLXwC/AKZXQeCf9Pgao5CKb8CyHuEX5jzWPTkvregvhRJHcpRO6BFoGW9ycaOkYw=="],

    "@types/yargs": ["@types/yargs@17.0.33", "https://registry.npmjs.org/@types/yargs/-/yargs-17.0.33.tgz", { "dependencies": { "@types/yargs-parser": "*" } }, "sha512-WpxBCKWPLr4xSsHgz511rFJAM+wS28w2zEO1QDNY5zM/S8ok70NNfztH0xwhqKyaK0OHCbN98LDAZuy1ctxDkA=="],

    "@types/yargs-parser": ["@types/yargs-parser@21.0.3", "https://registry.npmjs.org/@types/yargs-parser/-/yargs-parser-21.0.3.tgz", {}, "sha512-I4q9QU9MQv4oEOz4tAHJtNz1cwuLxn2F3xcc2iV5WdqLPpUnj30aUuxt1mAxYTG+oe8CZMV/+6rU4S4gRDzqtQ=="],

    "@ungap/structured-clone": ["@ungap/structured-clone@1.3.0", "https://registry.npmjs.org/@ungap/structured-clone/-/structured-clone-1.3.0.tgz", {}, "sha512-WmoN8qaIAo7WTYWbAZuG8PYEhn5fkz7dZrqTBZ7dtt//lL2Gwms1IcnQ5yHqjDfX8Ft5j4YzDM23f87zBfDe9g=="],

    "@yarnpkg/lockfile": ["@yarnpkg/lockfile@1.1.0", "https://registry.npmjs.org/@yarnpkg/lockfile/-/lockfile-1.1.0.tgz", {}, "sha512-GpSwvyXOcOOlV70vbnzjj4fW5xW/FdUF6nQEt1ENy7m4ZCczi1+/buVUPAqmGfqznsORNFzUMjctTIp8a9tuCQ=="],

    "@yarnpkg/parsers": ["@yarnpkg/parsers@3.0.3", "https://registry.npmjs.org/@yarnpkg/parsers/-/parsers-3.0.3.tgz", { "dependencies": { "js-yaml": "^3.10.0", "tslib": "^2.4.0" } }, "sha512-mQZgUSgFurUtA07ceMjxrWkYz8QtDuYkvPlu0ZqncgjopQ0t6CNEo/OSealkmnagSUx8ZD5ewvezUwUuMqutQg=="],

    "@zkochan/js-yaml": ["@zkochan/js-yaml@0.0.6", "https://registry.npmjs.org/@zkochan/js-yaml/-/js-yaml-0.0.6.tgz", { "dependencies": { "argparse": "^2.0.1" }, "bin": { "js-yaml": "bin/js-yaml.js" } }, "sha512-nzvgl3VfhcELQ8LyVrYOru+UtAy1nrygk2+AGbTm8a5YcO6o8lSjAT+pfg3vJWxIoZKOUhrK6UU7xW/+00kQrg=="],

    "acorn": ["acorn@8.15.0", "https://registry.npmjs.org/acorn/-/acorn-8.15.0.tgz", { "bin": { "acorn": "bin/acorn" } }, "sha512-NZyJarBfL7nWwIq+FDL6Zp/yHEhePMNnnJ0y3qfieCrmNvYct8uvtiV41UvlSe6apAfk0fY1FbWx+NwfmpvtTg=="],

    "acorn-jsx": ["acorn-jsx@5.3.2", "https://registry.npmjs.org/acorn-jsx/-/acorn-jsx-5.3.2.tgz", { "peerDependencies": { "acorn": "^6.0.0 || ^7.0.0 || ^8.0.0" } }, "sha512-rq9s+JNhf0IChjtDXxllJ7g41oZk5SlXtp0LHwyA5cejwn7vKmKp4pPri6YEePv2PU65sAsegbXtIinmDFDXgQ=="],

    "ajv": ["ajv@6.12.6", "https://registry.npmjs.org/ajv/-/ajv-6.12.6.tgz", { "dependencies": { "fast-deep-equal": "^3.1.1", "fast-json-stable-stringify": "^2.0.0", "json-schema-traverse": "^0.4.1", "uri-js": "^4.2.2" } }, "sha512-j3fVLgvTo527anyYyJOGTYJbG+vnnQYvE0m5mmkc1TK+nxAppkCLMIL0aZ4dblVCNoGShhm+kzE4ZUykBoMg4g=="],

    "ansi-colors": ["ansi-colors@4.1.3", "https://registry.npmjs.org/ansi-colors/-/ansi-colors-4.1.3.tgz", {}, "sha512-/6w/C21Pm1A7aZitlI5Ni/2J6FFQN8i1Cvz3kHABAAbw93v/NlvKdVOqz7CCWz/3iv/JplRSEEZ83XION15ovw=="],

    "ansi-escapes": ["ansi-escapes@4.3.2", "https://registry.npmjs.org/ansi-escapes/-/ansi-escapes-4.3.2.tgz", { "dependencies": { "type-fest": "^0.21.3" } }, "sha512-gKXj5ALrKWQLsYG9jlTRmR/xKluxHV+Z9QEwNIgCfM1/uwPMCuzVVnh5mwTd+OuBZcwSIMbqssNWRm1lE51QaQ=="],

    "ansi-regex": ["ansi-regex@5.0.1", "https://registry.npmjs.org/ansi-regex/-/ansi-regex-5.0.1.tgz", {}, "sha512-quJQXlTSUGL2LH9SUXo8VwsY4soanhgo6LNSm84E1LBcE8s3O0wpdiRzyR9z/ZZJMlMWv37qOOb9pdJlMUEKFQ=="],

    "ansi-styles": ["ansi-styles@4.3.0", "https://registry.npmjs.org/ansi-styles/-/ansi-styles-4.3.0.tgz", { "dependencies": { "color-convert": "^2.0.1" } }, "sha512-zbB9rCJAT1rbjiVDb2hqKFHNYLxgtk8NURxZ3IZwD3F6NtxbXZQCnnSi1Lkx+IDohdPlFp222wVALIheZJQSEg=="],

    "anymatch": ["anymatch@3.1.3", "https://registry.npmjs.org/anymatch/-/anymatch-3.1.3.tgz", { "dependencies": { "normalize-path": "^3.0.0", "picomatch": "^2.0.4" } }, "sha512-KMReFUr0B4t+D+OBkjR3KYqvocp2XaSzO55UcB6mgQMd3KbcE+mWTyvVV7D/zsdEbNnV6acZUutkiHQXvTr1Rw=="],

    "app-root-path": ["app-root-path@3.1.0", "https://registry.npmjs.org/app-root-path/-/app-root-path-3.1.0.tgz", {}, "sha512-biN3PwB2gUtjaYy/isrU3aNWI5w+fAfvHkSvCKeQGxhmYpwKFUxudR3Yya+KqVRHBmEDYh+/lTozYCFbmzX4nA=="],

    "argparse": ["argparse@2.0.1", "https://registry.npmjs.org/argparse/-/argparse-2.0.1.tgz", {}, "sha512-8+9WqebbFzpX9OR+Wa6O29asIogeRMzcGtAINdpMHHyAg10f05aSFVBbcEqGf/PXw1EjAZ+q2/bEBg3DvurK3Q=="],

    "async": ["async@3.2.6", "https://registry.npmjs.org/async/-/async-3.2.6.tgz", {}, "sha512-htCUDlxyyCLMgaM3xXg0C0LW2xqfuQ6p05pCEIsXuyQ+a1koYKTuBMzRNwmybfLgvJDMd0r1LTn4+E0Ti6C2AA=="],

    "asynckit": ["asynckit@0.4.0", "https://registry.npmjs.org/asynckit/-/asynckit-0.4.0.tgz", {}, "sha512-Oei9OH4tRh0YqU3GxhX79dM/mwVgvbZJaSNaRk+bshkj0S5cfHcgYakreBjrHwatXKbz+IoIdYLxrKim2MjW0Q=="],

    "axios": ["axios@1.10.0", "https://registry.npmjs.org/axios/-/axios-1.10.0.tgz", { "dependencies": { "follow-redirects": "^1.15.6", "form-data": "^4.0.0", "proxy-from-env": "^1.1.0" } }, "sha512-/1xYAC4MP/HEG+3duIhFr4ZQXR4sQXOIe+o6sdqzeykGLx6Upp/1p8MHqhINOvGeP7xyNHe7tsiJByc4SSVUxw=="],

    "babel-jest": ["babel-jest@29.7.0", "https://registry.npmjs.org/babel-jest/-/babel-jest-29.7.0.tgz", { "dependencies": { "@jest/transform": "^29.7.0", "@types/babel__core": "^7.1.14", "babel-plugin-istanbul": "^6.1.1", "babel-preset-jest": "^29.6.3", "chalk": "^4.0.0", "graceful-fs": "^4.2.9", "slash": "^3.0.0" }, "peerDependencies": { "@babel/core": "^7.8.0" } }, "sha512-BrvGY3xZSwEcCzKvKsCi2GgHqDqsYkOP4/by5xCgIwGXQxIEh+8ew3gmrE1y7XRR6LHZIj6yLYnUi/mm2KXKBg=="],

    "babel-plugin-istanbul": ["babel-plugin-istanbul@6.1.1", "https://registry.npmjs.org/babel-plugin-istanbul/-/babel-plugin-istanbul-6.1.1.tgz", { "dependencies": { "@babel/helper-plugin-utils": "^7.0.0", "@istanbuljs/load-nyc-config": "^1.0.0", "@istanbuljs/schema": "^0.1.2", "istanbul-lib-instrument": "^5.0.4", "test-exclude": "^6.0.0" } }, "sha512-Y1IQok9821cC9onCx5otgFfRm7Lm+I+wwxOx738M/WLPZ9Q42m4IG5W0FNX8WLL2gYMZo3JkuXIH2DOpWM+qwA=="],

    "babel-plugin-jest-hoist": ["babel-plugin-jest-hoist@29.6.3", "https://registry.npmjs.org/babel-plugin-jest-hoist/-/babel-plugin-jest-hoist-29.6.3.tgz", { "dependencies": { "@babel/template": "^7.3.3", "@babel/types": "^7.3.3", "@types/babel__core": "^7.1.14", "@types/babel__traverse": "^7.0.6" } }, "sha512-ESAc/RJvGTFEzRwOTT4+lNDk/GNHMkKbNzsvT0qKRfDyyYTskxB5rnU2njIDYVxXCBHHEI1c0YwHob3WaYujOg=="],

    "babel-plugin-polyfill-corejs2": ["babel-plugin-polyfill-corejs2@0.4.14", "https://registry.npmjs.org/babel-plugin-polyfill-corejs2/-/babel-plugin-polyfill-corejs2-0.4.14.tgz", { "dependencies": { "@babel/compat-data": "^7.27.7", "@babel/helper-define-polyfill-provider": "^0.6.5", "semver": "^6.3.1" }, "peerDependencies": { "@babel/core": "^7.4.0 || ^8.0.0-0 <8.0.0" } }, "sha512-Co2Y9wX854ts6U8gAAPXfn0GmAyctHuK8n0Yhfjd6t30g7yvKjspvvOo9yG+z52PZRgFErt7Ka2pYnXCjLKEpg=="],

    "babel-plugin-polyfill-corejs3": ["babel-plugin-polyfill-corejs3@0.13.0", "https://registry.npmjs.org/babel-plugin-polyfill-corejs3/-/babel-plugin-polyfill-corejs3-0.13.0.tgz", { "dependencies": { "@babel/helper-define-polyfill-provider": "^0.6.5", "core-js-compat": "^3.43.0" }, "peerDependencies": { "@babel/core": "^7.4.0 || ^8.0.0-0 <8.0.0" } }, "sha512-U+GNwMdSFgzVmfhNm8GJUX88AadB3uo9KpJqS3FaqNIPKgySuvMb+bHPsOmmuWyIcuqZj/pzt1RUIUZns4y2+A=="],

    "babel-plugin-polyfill-regenerator": ["babel-plugin-polyfill-regenerator@0.6.5", "https://registry.npmjs.org/babel-plugin-polyfill-regenerator/-/babel-plugin-polyfill-regenerator-0.6.5.tgz", { "dependencies": { "@babel/helper-define-polyfill-provider": "^0.6.5" }, "peerDependencies": { "@babel/core": "^7.4.0 || ^8.0.0-0 <8.0.0" } }, "sha512-ISqQ2frbiNU9vIJkzg7dlPpznPZ4jOiUQ1uSmB0fEHeowtN3COYRsXr/xexn64NpU13P06jc/L5TgiJXOgrbEg=="],

    "babel-preset-current-node-syntax": ["babel-preset-current-node-syntax@1.1.0", "https://registry.npmjs.org/babel-preset-current-node-syntax/-/babel-preset-current-node-syntax-1.1.0.tgz", { "dependencies": { "@babel/plugin-syntax-async-generators": "^7.8.4", "@babel/plugin-syntax-bigint": "^7.8.3", "@babel/plugin-syntax-class-properties": "^7.12.13", "@babel/plugin-syntax-class-static-block": "^7.14.5", "@babel/plugin-syntax-import-attributes": "^7.24.7", "@babel/plugin-syntax-import-meta": "^7.10.4", "@babel/plugin-syntax-json-strings": "^7.8.3", "@babel/plugin-syntax-logical-assignment-operators": "^7.10.4", "@babel/plugin-syntax-nullish-coalescing-operator": "^7.8.3", "@babel/plugin-syntax-numeric-separator": "^7.10.4", "@babel/plugin-syntax-object-rest-spread": "^7.8.3", "@babel/plugin-syntax-optional-catch-binding": "^7.8.3", "@babel/plugin-syntax-optional-chaining": "^7.8.3", "@babel/plugin-syntax-private-property-in-object": "^7.14.5", "@babel/plugin-syntax-top-level-await": "^7.14.5" }, "peerDependencies": { "@babel/core": "^7.0.0" } }, "sha512-ldYss8SbBlWva1bs28q78Ju5Zq1F+8BrqBZZ0VFhLBvhh6lCpC2o3gDJi/5DRLs9FgYZCnmPYIVFU4lRXCkyUw=="],

    "babel-preset-jest": ["babel-preset-jest@29.6.3", "https://registry.npmjs.org/babel-preset-jest/-/babel-preset-jest-29.6.3.tgz", { "dependencies": { "babel-plugin-jest-hoist": "^29.6.3", "babel-preset-current-node-syntax": "^1.0.0" }, "peerDependencies": { "@babel/core": "^7.0.0" } }, "sha512-0B3bhxR6snWXJZtR/RliHTDPRgn1sNHOR0yVtq/IiQFyuOVjFS+wuio/R4gSNkyYmKmJB4wGZv2NZanmKmTnNA=="],

    "balanced-match": ["balanced-match@1.0.2", "https://registry.npmjs.org/balanced-match/-/balanced-match-1.0.2.tgz", {}, "sha512-3oSeUO0TMV67hN1AmbXsK4yaqU7tjiHlbxRDZOpH0KW9+CeX4bRAaX0Anxt0tx2MrpRpWwQaPwIlISEJhYU5Pw=="],

    "base64-js": ["base64-js@1.5.1", "https://registry.npmjs.org/base64-js/-/base64-js-1.5.1.tgz", {}, "sha512-AKpaYlHn8t4SVbOHCy+b5+KKgvR4vrsD8vbvrbiQJps7fKDTkjkDry6ji0rUJjC0kzbNePLwzxq8iypo41qeWA=="],

    "binary-extensions": ["binary-extensions@2.3.0", "https://registry.npmjs.org/binary-extensions/-/binary-extensions-2.3.0.tgz", {}, "sha512-Ceh+7ox5qe7LJuLHoY0feh3pHuUDHAcRUeyL2VYghZwfpkNIy/+8Ocg0a3UuSoYzavmylwuLWQOf3hl0jjMMIw=="],

    "bl": ["bl@4.1.0", "https://registry.npmjs.org/bl/-/bl-4.1.0.tgz", { "dependencies": { "buffer": "^5.5.0", "inherits": "^2.0.4", "readable-stream": "^3.4.0" } }, "sha512-1W07cM9gS6DcLperZfFSj+bWLtaPGSOHWhPiGzXmvVJbRLdG82sH/Kn8EtW1VqWVA54AKf2h5k5BbnIbwF3h6w=="],

    "brace-expansion": ["brace-expansion@1.1.12", "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.12.tgz", { "dependencies": { "balanced-match": "^1.0.0", "concat-map": "0.0.1" } }, "sha512-9T9UjW3r0UW5c1Q7GTwllptXwhvYmEzFhzMfZ9H7FQWt+uZePjZPjBP/W1ZEyZ1twGWom5/56TF4lPcqjnDHcg=="],

    "braces": ["braces@3.0.3", "https://registry.npmjs.org/braces/-/braces-3.0.3.tgz", { "dependencies": { "fill-range": "^7.1.1" } }, "sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA=="],

    "browserslist": ["browserslist@4.25.1", "https://registry.npmjs.org/browserslist/-/browserslist-4.25.1.tgz", { "dependencies": { "caniuse-lite": "^1.0.30001726", "electron-to-chromium": "^1.5.173", "node-releases": "^2.0.19", "update-browserslist-db": "^1.1.3" }, "bin": { "browserslist": "cli.js" } }, "sha512-KGj0KoOMXLpSNkkEI6Z6mShmQy0bc1I+T7K9N81k4WWMrfz+6fQ6es80B/YLAeRoKvjYE1YSHHOW1qe9xIVzHw=="],

    "bser": ["bser@2.1.1", "https://registry.npmjs.org/bser/-/bser-2.1.1.tgz", { "dependencies": { "node-int64": "^0.4.0" } }, "sha512-gQxTNE/GAfIIrmHLUE3oJyp5FO6HRBfhjnw4/wMmA63ZGDJnWBmgY/lyQBpnDUkGmAhbSe39tx2d/iTOAfglwQ=="],

    "buffer": ["buffer@5.7.1", "https://registry.npmjs.org/buffer/-/buffer-5.7.1.tgz", { "dependencies": { "base64-js": "^1.3.1", "ieee754": "^1.1.13" } }, "sha512-EHcyIPBQ4BSGlvjB16k5KgAJ27CIsHY/2JBmCRReo48y9rQ3MaUzWX3KVlBa4U7MyX02HdVj0K7C3WaB3ju7FQ=="],

    "buffer-from": ["buffer-from@1.1.2", "https://registry.npmjs.org/buffer-from/-/buffer-from-1.1.2.tgz", {}, "sha512-E+XQCRwSbaaiChtv6k6Dwgc+bx+Bs6vuKJHHl5kox/BaKbhiXzqQOwK4cO22yElGp2OCmjwVhT3HmxgyPGnJfQ=="],

    "call-bind-apply-helpers": ["call-bind-apply-helpers@1.0.2", "https://registry.npmjs.org/call-bind-apply-helpers/-/call-bind-apply-helpers-1.0.2.tgz", { "dependencies": { "es-errors": "^1.3.0", "function-bind": "^1.1.2" } }, "sha512-Sp1ablJ0ivDkSzjcaJdxEunN5/XvksFJ2sMBFfq6x0ryhQV/2b/KwFe21cMpmHtPOSij8K99/wSfoEuTObmuMQ=="],

    "callsites": ["callsites@3.1.0", "https://registry.npmjs.org/callsites/-/callsites-3.1.0.tgz", {}, "sha512-P8BjAsXvZS+VIDUI11hHCQEv74YT67YUi5JJFNWIqL235sBmjX4+qx9Muvls5ivyNENctx46xQLQ3aTuE7ssaQ=="],

    "camelcase": ["camelcase@6.3.0", "https://registry.npmjs.org/camelcase/-/camelcase-6.3.0.tgz", {}, "sha512-Gmy6FhYlCY7uOElZUSbxo2UCDH8owEk996gkbrpsgGtrJLM3J7jGxl9Ic7Qwwj4ivOE5AWZWRMecDdF7hqGjFA=="],

    "caniuse-lite": ["caniuse-lite@1.0.30001727", "https://registry.npmjs.org/caniuse-lite/-/caniuse-lite-1.0.30001727.tgz", {}, "sha512-pB68nIHmbN6L/4C6MH1DokyR3bYqFwjaSs/sWDHGj4CTcFtQUQMuJftVwWkXq7mNWOybD3KhUv3oWHoGxgP14Q=="],

    "chalk": ["chalk@4.1.2", "https://registry.npmjs.org/chalk/-/chalk-4.1.2.tgz", { "dependencies": { "ansi-styles": "^4.1.0", "supports-color": "^7.1.0" } }, "sha512-oKnbhFyRIXpUuez8iBMmyEa4nbj4IOQyuhc/wy9kY7/WVPcwIO9VA668Pu8RkO7+0G76SLROeyw9CpQ061i4mA=="],

    "char-regex": ["char-regex@1.0.2", "https://registry.npmjs.org/char-regex/-/char-regex-1.0.2.tgz", {}, "sha512-kWWXztvZ5SBQV+eRgKFeh8q5sLuZY2+8WUIzlxWVTg+oGwY14qylx1KbKzHd8P6ZYkAg0xyIDU9JMHhyJMZ1jw=="],

    "chokidar": ["chokidar@3.6.0", "https://registry.npmjs.org/chokidar/-/chokidar-3.6.0.tgz", { "dependencies": { "anymatch": "~3.1.2", "braces": "~3.0.2", "glob-parent": "~5.1.2", "is-binary-path": "~2.1.0", "is-glob": "~4.0.1", "normalize-path": "~3.0.0", "readdirp": "~3.6.0" }, "optionalDependencies": { "fsevents": "~2.3.2" } }, "sha512-7VT13fmjotKpGipCW9JEQAusEPE+Ei8nl6/g4FBAmIm0GOOLMua9NDDo/DWp0ZAxCr3cPq5ZpBqmPAQgDda2Pw=="],

    "ci-info": ["ci-info@3.9.0", "https://registry.npmjs.org/ci-info/-/ci-info-3.9.0.tgz", {}, "sha512-NIxF55hv4nSqQswkAeiOi1r83xy8JldOFDTWiug55KBu9Jnblncd2U6ViHmYgHf01TPZS77NJBhBMKdWj9HQMQ=="],

    "cjs-module-lexer": ["cjs-module-lexer@1.4.3", "https://registry.npmjs.org/cjs-module-lexer/-/cjs-module-lexer-1.4.3.tgz", {}, "sha512-9z8TZaGM1pfswYeXrUpzPrkx8UnWYdhJclsiYMm6x/w5+nN+8Tf/LnAgfLGQCm59qAOxU8WwHEq2vNwF6i4j+Q=="],

    "cli-cursor": ["cli-cursor@3.1.0", "https://registry.npmjs.org/cli-cursor/-/cli-cursor-3.1.0.tgz", { "dependencies": { "restore-cursor": "^3.1.0" } }, "sha512-I/zHAwsKf9FqGoXM4WWRACob9+SNukZTd94DWF57E4toouRulbCxcUh6RKUEOQlYTHJnzkPMySvPNaaSLNfLZw=="],

    "cli-spinners": ["cli-spinners@2.6.1", "https://registry.npmjs.org/cli-spinners/-/cli-spinners-2.6.1.tgz", {}, "sha512-x/5fWmGMnbKQAaNwN+UZlV79qBLM9JFnJuJ03gIi5whrob0xV0ofNVHy9DhwGdsMJQc2OKv0oGmLzvaqvAVv+g=="],

    "cliui": ["cliui@7.0.4", "https://registry.npmjs.org/cliui/-/cliui-7.0.4.tgz", { "dependencies": { "string-width": "^4.2.0", "strip-ansi": "^6.0.0", "wrap-ansi": "^7.0.0" } }, "sha512-OcRE68cOsVMXp1Yvonl/fzkQOyjLSu/8bhPDfQt0e0/Eb283TKP20Fs2MqoPsr9SwA595rRCA+QMzYc9nBP+JQ=="],

    "co": ["co@4.6.0", "https://registry.npmjs.org/co/-/co-4.6.0.tgz", {}, "sha512-QVb0dM5HvG+uaxitm8wONl7jltx8dqhfU33DcqtOZcLSVIKSDDLDi7+0LbAKiyI8hD9u42m2YxXSkMGWThaecQ=="],

    "collect-v8-coverage": ["collect-v8-coverage@1.0.2", "https://registry.npmjs.org/collect-v8-coverage/-/collect-v8-coverage-1.0.2.tgz", {}, "sha512-lHl4d5/ONEbLlJvaJNtsF/Lz+WvB07u2ycqTYbdrq7UypDXailES4valYb2eWiJFxZlVmpGekfqoxQhzyFdT4Q=="],

    "color-convert": ["color-convert@2.0.1", "https://registry.npmjs.org/color-convert/-/color-convert-2.0.1.tgz", { "dependencies": { "color-name": "~1.1.4" } }, "sha512-RRECPsj7iu/xb5oKYcsFHSppFNnsj/52OVTRKb4zP5onXwVF3zVmmToNcOfGC+CRDpfK/U584fMg38ZHCaElKQ=="],

    "color-name": ["color-name@1.1.4", "https://registry.npmjs.org/color-name/-/color-name-1.1.4.tgz", {}, "sha512-dOy+3AuW3a2wNbZHIuMZpTcgjGuLU/uBL/ubcZF9OXbDo8ff4O8yVp5Bf0efS8uEoYo5q4Fx7dY9OgQGXgAsQA=="],

    "combined-stream": ["combined-stream@1.0.8", "https://registry.npmjs.org/combined-stream/-/combined-stream-1.0.8.tgz", { "dependencies": { "delayed-stream": "~1.0.0" } }, "sha512-FQN4MRfuJeHf7cBbBMJFXhKSDq+2kAArBlmRBvcvFE5BB1HZKXtSFASDhdlz9zOYwxh8lDdnvmMOe/+5cdoEdg=="],

    "concat-map": ["concat-map@0.0.1", "https://registry.npmjs.org/concat-map/-/concat-map-0.0.1.tgz", {}, "sha512-/Srv4dswyQNBfohGpz9o6Yb3Gz3SrUDqBH5rTuhGR7ahtlbYKnVxw2bCFMRljaA7EXHaXZ8wsHdodFvbkhKmqg=="],

    "convert-source-map": ["convert-source-map@2.0.0", "https://registry.npmjs.org/convert-source-map/-/convert-source-map-2.0.0.tgz", {}, "sha512-Kvp459HrV2FEJ1CAsi1Ku+MY3kasH19TFykTz2xWmMeq6bk2NU3XXvfJ+Q61m0xktWwt+1HSYf3JZsTms3aRJg=="],

    "core-js-compat": ["core-js-compat@3.44.0", "https://registry.npmjs.org/core-js-compat/-/core-js-compat-3.44.0.tgz", { "dependencies": { "browserslist": "^4.25.1" } }, "sha512-JepmAj2zfl6ogy34qfWtcE7nHKAJnKsQFRn++scjVS2bZFllwptzw61BZcZFYBPpUznLfAvh0LGhxKppk04ClA=="],

    "create-jest": ["create-jest@29.7.0", "https://registry.npmjs.org/create-jest/-/create-jest-29.7.0.tgz", { "dependencies": { "@jest/types": "^29.6.3", "chalk": "^4.0.0", "exit": "^0.1.2", "graceful-fs": "^4.2.9", "jest-config": "^29.7.0", "jest-util": "^29.7.0", "prompts": "^2.0.1" }, "bin": { "create-jest": "bin/create-jest.js" } }, "sha512-Adz2bdH0Vq3F53KEMJOoftQFutWCukm6J24wbPWRO4k1kMY7gS7ds/uoJkNuV8wDCtWWnuwGcJwpWcih+zEW1Q=="],

    "cross-spawn": ["cross-spawn@7.0.6", "https://registry.npmjs.org/cross-spawn/-/cross-spawn-7.0.6.tgz", { "dependencies": { "path-key": "^3.1.0", "shebang-command": "^2.0.0", "which": "^2.0.1" } }, "sha512-uV2QOWP2nWzsy2aMp8aRibhi9dlzF5Hgh5SHaB9OiTGEyDTiJJyx0uy51QXdyWbtAHNua4XJzUKca3OzKUd3vA=="],

    "debug": ["debug@4.4.1", "https://registry.npmjs.org/debug/-/debug-4.4.1.tgz", { "dependencies": { "ms": "^2.1.3" } }, "sha512-KcKCqiftBJcZr++7ykoDIEwSa3XWowTfNPo92BYxjXiyYEVrUQh2aLyhxBCwww+heortUFxEJYcRzosstTEBYQ=="],

    "dedent": ["dedent@1.6.0", "https://registry.npmjs.org/dedent/-/dedent-1.6.0.tgz", { "peerDependencies": { "babel-plugin-macros": "^3.1.0" }, "optionalPeers": ["babel-plugin-macros"] }, "sha512-F1Z+5UCFpmQUzJa11agbyPVMbpgT/qA3/SKyJ1jyBgm7dUcUEa8v9JwDkerSQXfakBwFljIxhOJqGkjUwZ9FSA=="],

    "deep-is": ["deep-is@0.1.4", "https://registry.npmjs.org/deep-is/-/deep-is-0.1.4.tgz", {}, "sha512-oIPzksmTg4/MriiaYGO+okXDT7ztn/w3Eptv/+gSIdMdKsJo0u4CfYNFJPy+4SKMuCqGw2wxnA+URMg3t8a/bQ=="],

    "deepmerge": ["deepmerge@4.3.1", "https://registry.npmjs.org/deepmerge/-/deepmerge-4.3.1.tgz", {}, "sha512-3sUqbMEc77XqpdNO7FRyRog+eW3ph+GYCbj+rK+uYyRMuwsVy0rMiVtPn+QJlKFvWP/1PYpapqYn0Me2knFn+A=="],

    "define-lazy-prop": ["define-lazy-prop@2.0.0", "https://registry.npmjs.org/define-lazy-prop/-/define-lazy-prop-2.0.0.tgz", {}, "sha512-Ds09qNh8yw3khSjiJjiUInaGX9xlqZDY7JVryGxdxV7NPeuqQfplOpQ66yJFZut3jLa5zOwkXw1g9EI2uKh4Og=="],

    "delayed-stream": ["delayed-stream@1.0.0", "https://registry.npmjs.org/delayed-stream/-/delayed-stream-1.0.0.tgz", {}, "sha512-ZySD7Nf91aLB0RxL4KGrKHBXl7Eds1DAmEdcoVawXnLD7SDhpNgtuII2aAkg7a7QS41jxPSZ17p4VdGnMHk3MQ=="],

    "detect-newline": ["detect-newline@3.1.0", "https://registry.npmjs.org/detect-newline/-/detect-newline-3.1.0.tgz", {}, "sha512-TLz+x/vEXm/Y7P7wn1EJFNLxYpUD4TgMosxY6fAVJUnJMbupHBOncxyWUG9OpTaH9EBD7uFI5LfEgmMOc54DsA=="],

    "diff-sequences": ["diff-sequences@29.6.3", "https://registry.npmjs.org/diff-sequences/-/diff-sequences-29.6.3.tgz", {}, "sha512-EjePK1srD3P08o2j4f0ExnylqRs5B9tJjcp9t1krH2qRi8CCdsYfwe9JgSLurFBWwq4uOlipzfk5fHNvwFKr8Q=="],

    "doctrine": ["doctrine@3.0.0", "https://registry.npmjs.org/doctrine/-/doctrine-3.0.0.tgz", { "dependencies": { "esutils": "^2.0.2" } }, "sha512-yS+Q5i3hBf7GBkd4KG8a7eBNNWNGLTaEwwYWUijIYM7zrlYDM0BFXHjjPWlWZ1Rg7UaddZeIDmi9jF3HmqiQ2w=="],

    "dotenv": ["dotenv@10.0.0", "https://registry.npmjs.org/dotenv/-/dotenv-10.0.0.tgz", {}, "sha512-rlBi9d8jpv9Sf1klPjNfFAuWDjKLwTIJJ/VxtoTwIR6hnZxcEOQCZg2oIL3MWBYw5GpUDKOEnND7LXTbIpQ03Q=="],

    "dunder-proto": ["dunder-proto@1.0.1", "https://registry.npmjs.org/dunder-proto/-/dunder-proto-1.0.1.tgz", { "dependencies": { "call-bind-apply-helpers": "^1.0.1", "es-errors": "^1.3.0", "gopd": "^1.2.0" } }, "sha512-KIN/nDJBQRcXw0MLVhZE9iQHmG68qAVIBg9CqmUYjmQIhgij9U5MFvrqkUL5FbtyyzZuOeOt0zdeRe4UY7ct+A=="],

    "duplexer": ["duplexer@0.1.2", "https://registry.npmjs.org/duplexer/-/duplexer-0.1.2.tgz", {}, "sha512-jtD6YG370ZCIi/9GTaJKQxWTZD045+4R4hTk/x1UyoqadyJ9x9CgSi1RlVDQF8U2sxLLSnFkCaMihqljHIWgMg=="],

    "ejs": ["ejs@3.1.10", "https://registry.npmjs.org/ejs/-/ejs-3.1.10.tgz", { "dependencies": { "jake": "^10.8.5" }, "bin": { "ejs": "bin/cli.js" } }, "sha512-UeJmFfOrAQS8OJWPZ4qtgHyWExa088/MtK5UEyoJGFH67cDEXkZSviOiKRCZ4Xij0zxI3JECgYs3oKx+AizQBA=="],

    "electron-to-chromium": ["electron-to-chromium@1.5.187", "https://registry.npmjs.org/electron-to-chromium/-/electron-to-chromium-1.5.187.tgz", {}, "sha512-cl5Jc9I0KGUoOoSbxvTywTa40uspGJt/BDBoDLoxJRSBpWh4FFXBsjNRHfQrONsV/OoEjDfHUmZQa2d6Ze4YgA=="],

    "emittery": ["emittery@0.13.1", "https://registry.npmjs.org/emittery/-/emittery-0.13.1.tgz", {}, "sha512-DeWwawk6r5yR9jFgnDKYt4sLS0LmHJJi3ZOnb5/JdbYwj3nW+FxQnHIjhBKz8YLC7oRNPVM9NQ47I3CVx34eqQ=="],

    "emoji-regex": ["emoji-regex@8.0.0", "https://registry.npmjs.org/emoji-regex/-/emoji-regex-8.0.0.tgz", {}, "sha512-MSjYzcWNOA0ewAHpz0MxpYFvwg6yjy1NG3xteoqz644VCo/RPgnr1/GGt+ic3iJTzQ8Eu3TdM14SawnVUmGE6A=="],

    "end-of-stream": ["end-of-stream@1.4.5", "https://registry.npmjs.org/end-of-stream/-/end-of-stream-1.4.5.tgz", { "dependencies": { "once": "^1.4.0" } }, "sha512-ooEGc6HP26xXq/N+GCGOT0JKCLDGrq2bQUZrQ7gyrJiZANJ/8YDTxTpQBXGMn+WbIQXNVpyWymm7KYVICQnyOg=="],

    "enquirer": ["enquirer@2.3.6", "https://registry.npmjs.org/enquirer/-/enquirer-2.3.6.tgz", { "dependencies": { "ansi-colors": "^4.1.1" } }, "sha512-yjNnPr315/FjS4zIsUxYguYUPP2e1NK4d7E7ZOLiyYCcbFBiTMyID+2wvm2w6+pZ/odMA7cRkjhsPbltwBOrLg=="],

    "error-ex": ["error-ex@1.3.2", "https://registry.npmjs.org/error-ex/-/error-ex-1.3.2.tgz", { "dependencies": { "is-arrayish": "^0.2.1" } }, "sha512-7dFHNmqeFSEt2ZBsCriorKnn3Z2pj+fd9kmI6QoWw4//DL+icEBfc0U7qJCisqrTsKTjw4fNFy2pW9OqStD84g=="],

    "es-define-property": ["es-define-property@1.0.1", "https://registry.npmjs.org/es-define-property/-/es-define-property-1.0.1.tgz", {}, "sha512-e3nRfgfUZ4rNGL232gUgX06QNyyez04KdjFrF+LTRoOXmrOgFKDg4BCdsjW8EnT69eqdYGmRpJwiPVYNrCaW3g=="],

    "es-errors": ["es-errors@1.3.0", "https://registry.npmjs.org/es-errors/-/es-errors-1.3.0.tgz", {}, "sha512-Zf5H2Kxt2xjTvbJvP2ZWLEICxA6j+hAmMzIlypy4xcBg1vKVnx89Wy0GbS+kf5cwCVFFzdCFh2XSCFNULS6csw=="],

    "es-object-atoms": ["es-object-atoms@1.1.1", "https://registry.npmjs.org/es-object-atoms/-/es-object-atoms-1.1.1.tgz", { "dependencies": { "es-errors": "^1.3.0" } }, "sha512-FGgH2h8zKNim9ljj7dankFPcICIK9Cp5bm+c2gQSYePhpaG5+esrLODihIorn+Pe6FGJzWhXQotPv73jTaldXA=="],

    "es-set-tostringtag": ["es-set-tostringtag@2.1.0", "https://registry.npmjs.org/es-set-tostringtag/-/es-set-tostringtag-2.1.0.tgz", { "dependencies": { "es-errors": "^1.3.0", "get-intrinsic": "^1.2.6", "has-tostringtag": "^1.0.2", "hasown": "^2.0.2" } }, "sha512-j6vWzfrGVfyXxge+O0x5sh6cvxAog0a/4Rdd2K36zCMV5eJ+/+tOAngRO8cODMNWbVRdVlmGZQL2YS3yR8bIUA=="],

    "escalade": ["escalade@3.2.0", "https://registry.npmjs.org/escalade/-/escalade-3.2.0.tgz", {}, "sha512-WUj2qlxaQtO4g6Pq5c29GTcWGDyd8itL8zTlipgECz3JesAiiOKotd8JU6otB3PACgG6xkJUyVhboMS+bje/jA=="],

    "escape-string-regexp": ["escape-string-regexp@1.0.5", "https://registry.npmjs.org/escape-string-regexp/-/escape-string-regexp-1.0.5.tgz", {}, "sha512-vbRorB5FUQWvla16U8R/qgaFIya2qGzwDrNmCZuYKrbdSUMG6I1ZCGQRefkRVhuOkIGVne7BQ35DSfo1qvJqFg=="],

    "eslint": ["eslint@8.57.1", "https://registry.npmjs.org/eslint/-/eslint-8.57.1.tgz", { "dependencies": { "@eslint-community/eslint-utils": "^4.2.0", "@eslint-community/regexpp": "^4.6.1", "@eslint/eslintrc": "^2.1.4", "@eslint/js": "8.57.1", "@humanwhocodes/config-array": "^0.13.0", "@humanwhocodes/module-importer": "^1.0.1", "@nodelib/fs.walk": "^1.2.8", "@ungap/structured-clone": "^1.2.0", "ajv": "^6.12.4", "chalk": "^4.0.0", "cross-spawn": "^7.0.2", "debug": "^4.3.2", "doctrine": "^3.0.0", "escape-string-regexp": "^4.0.0", "eslint-scope": "^7.2.2", "eslint-visitor-keys": "^3.4.3", "espree": "^9.6.1", "esquery": "^1.4.2", "esutils": "^2.0.2", "fast-deep-equal": "^3.1.3", "file-entry-cache": "^6.0.1", "find-up": "^5.0.0", "glob-parent": "^6.0.2", "globals": "^13.19.0", "graphemer": "^1.4.0", "ignore": "^5.2.0", "imurmurhash": "^0.1.4", "is-glob": "^4.0.0", "is-path-inside": "^3.0.3", "js-yaml": "^4.1.0", "json-stable-stringify-without-jsonify": "^1.0.1", "levn": "^0.4.1", "lodash.merge": "^4.6.2", "minimatch": "^3.1.2", "natural-compare": "^1.4.0", "optionator": "^0.9.3", "strip-ansi": "^6.0.1", "text-table": "^0.2.0" }, "bin": { "eslint": "bin/eslint.js" } }, "sha512-ypowyDxpVSYpkXr9WPv2PAZCtNip1Mv5KTW0SCurXv/9iOpcrH9PaqUElksqEB6pChqHGDRCFTyrZlGhnLNGiA=="],

    "eslint-plugin-disable-autofix": ["@mattlewis92/eslint-plugin-disable-autofix@3.0.0", "https://registry.npmjs.org/@mattlewis92/eslint-plugin-disable-autofix/-/eslint-plugin-disable-autofix-3.0.0.tgz", { "dependencies": { "app-root-path": "^3.1.0", "eslint": "^8.16.0", "eslint-rule-composer": "^0.3.0" } }, "sha512-zYDdpaj+1Al8Ki3WpY2I9bOAd8NSgFWGT7yR6KemSi25qWwDMNArnR2q6gDEDKSw+KuYY4shFxkY/JpoNF64tg=="],

    "eslint-rule-composer": ["eslint-rule-composer@0.3.0", "https://registry.npmjs.org/eslint-rule-composer/-/eslint-rule-composer-0.3.0.tgz", {}, "sha512-bt+Sh8CtDmn2OajxvNO+BX7Wn4CIWMpTRm3MaiKPCQcnnlm0CS2mhui6QaoeQugs+3Kj2ESKEEGJUdVafwhiCg=="],

    "eslint-scope": ["eslint-scope@7.2.2", "https://registry.npmjs.org/eslint-scope/-/eslint-scope-7.2.2.tgz", { "dependencies": { "esrecurse": "^4.3.0", "estraverse": "^5.2.0" } }, "sha512-dOt21O7lTMhDM+X9mB4GX+DZrZtCUJPL/wlcTqxyrx5IvO0IYtILdtrQGQp+8n5S0gwSVmOf9NQrjMOgfQZlIg=="],

    "eslint-utils": ["eslint-utils@3.0.0", "https://registry.npmjs.org/eslint-utils/-/eslint-utils-3.0.0.tgz", { "dependencies": { "eslint-visitor-keys": "^2.0.0" }, "peerDependencies": { "eslint": ">=5" } }, "sha512-uuQC43IGctw68pJA1RgbQS8/NP7rch6Cwd4j3ZBtgo4/8Flj4eGE7ZYSZRN3iq5pVUv6GPdW5Z1RFleo84uLDA=="],

    "eslint-visitor-keys": ["eslint-visitor-keys@2.1.0", "https://registry.npmjs.org/eslint-visitor-keys/-/eslint-visitor-keys-2.1.0.tgz", {}, "sha512-0rSmRBzXgDzIsD6mGdJgevzgezI534Cer5L/vyMX0kHzT/jiB43jRhd9YUlMGYLQy2zprNmoT8qasCGtY+QaKw=="],

    "espree": ["espree@9.6.1", "https://registry.npmjs.org/espree/-/espree-9.6.1.tgz", { "dependencies": { "acorn": "^8.9.0", "acorn-jsx": "^5.3.2", "eslint-visitor-keys": "^3.4.1" } }, "sha512-oruZaFkjorTpF32kDSI5/75ViwGeZginGGy2NoOSg3Q9bnwlnmDm4HLnkl0RE3n+njDXR037aY1+x58Z/zFdwQ=="],

    "esprima": ["esprima@4.0.1", "https://registry.npmjs.org/esprima/-/esprima-4.0.1.tgz", { "bin": { "esparse": "./bin/esparse.js", "esvalidate": "./bin/esvalidate.js" } }, "sha512-eGuFFw7Upda+g4p+QHvnW0RyTX/SVeJBDM/gCtMARO0cLuT2HcEKnTPvhjV6aGeqrCB/sbNop0Kszm0jsaWU4A=="],

    "esquery": ["esquery@1.6.0", "https://registry.npmjs.org/esquery/-/esquery-1.6.0.tgz", { "dependencies": { "estraverse": "^5.1.0" } }, "sha512-ca9pw9fomFcKPvFLXhBKUK90ZvGibiGOvRJNbjljY7s7uq/5YO4BOzcYtJqExdx99rF6aAcnRxHmcUHcz6sQsg=="],

    "esrecurse": ["esrecurse@4.3.0", "https://registry.npmjs.org/esrecurse/-/esrecurse-4.3.0.tgz", { "dependencies": { "estraverse": "^5.2.0" } }, "sha512-KmfKL3b6G+RXvP8N1vr3Tq1kL/oCFgn2NYXEtqP8/L3pKapUA4G8cFVaoF3SU323CD4XypR/ffioHmkti6/Tag=="],

    "estraverse": ["estraverse@5.3.0", "https://registry.npmjs.org/estraverse/-/estraverse-5.3.0.tgz", {}, "sha512-MMdARuVEQziNTeJD8DgMqmhwR11BRQ/cBP+pLtYdSTnf3MIO8fFeiINEbX36ZdNlfU/7A9f3gUw49B3oQsvwBA=="],

    "esutils": ["esutils@2.0.3", "https://registry.npmjs.org/esutils/-/esutils-2.0.3.tgz", {}, "sha512-kVscqXk4OCp68SZ0dkgEKVi6/8ij300KBWTJq32P/dYeWTSwK41WyTxalN1eRmA5Z9UU/LX9D7FWSmV9SAYx6g=="],

    "execa": ["execa@5.1.1", "https://registry.npmjs.org/execa/-/execa-5.1.1.tgz", { "dependencies": { "cross-spawn": "^7.0.3", "get-stream": "^6.0.0", "human-signals": "^2.1.0", "is-stream": "^2.0.0", "merge-stream": "^2.0.0", "npm-run-path": "^4.0.1", "onetime": "^5.1.2", "signal-exit": "^3.0.3", "strip-final-newline": "^2.0.0" } }, "sha512-8uSpZZocAZRBAPIEINJj3Lo9HyGitllczc27Eh5YYojjMFMn8yHMDMaUHE2Jqfq05D/wucwI4JGURyXt1vchyg=="],

    "exit": ["exit@0.1.2", "https://registry.npmjs.org/exit/-/exit-0.1.2.tgz", {}, "sha512-Zk/eNKV2zbjpKzrsQ+n1G6poVbErQxJ0LBOJXaKZ1EViLzH+hrLu9cdXI4zw9dBQJslwBEpbQ2P1oS7nDxs6jQ=="],

    "expect": ["expect@29.7.0", "https://registry.npmjs.org/expect/-/expect-29.7.0.tgz", { "dependencies": { "@jest/expect-utils": "^29.7.0", "jest-get-type": "^29.6.3", "jest-matcher-utils": "^29.7.0", "jest-message-util": "^29.7.0", "jest-util": "^29.7.0" } }, "sha512-2Zks0hf1VLFYI1kbh0I5jP3KHHyCHpkfyHBzsSXRFgl/Bg9mWYfMW8oD+PdMPlEwy5HNsR9JutYy6pMeOh61nw=="],

    "fast-deep-equal": ["fast-deep-equal@3.1.3", "https://registry.npmjs.org/fast-deep-equal/-/fast-deep-equal-3.1.3.tgz", {}, "sha512-f3qQ9oQy9j2AhBe/H9VC91wLmKBCCU/gDOnKNAYG5hswO7BLKj09Hc5HYNz9cGI++xlpDCIgDaitVs03ATR84Q=="],

    "fast-glob": ["fast-glob@3.2.7", "https://registry.npmjs.org/fast-glob/-/fast-glob-3.2.7.tgz", { "dependencies": { "@nodelib/fs.stat": "^2.0.2", "@nodelib/fs.walk": "^1.2.3", "glob-parent": "^5.1.2", "merge2": "^1.3.0", "micromatch": "^4.0.4" } }, "sha512-rYGMRwip6lUMvYD3BTScMwT1HtAs2d71SMv66Vrxs0IekGZEjhM0pcMfjQPnknBt2zeCwQMEupiN02ZP4DiT1Q=="],

    "fast-json-stable-stringify": ["fast-json-stable-stringify@2.1.0", "https://registry.npmjs.org/fast-json-stable-stringify/-/fast-json-stable-stringify-2.1.0.tgz", {}, "sha512-lhd/wF+Lk98HZoTCtlVraHtfh5XYijIjalXck7saUtuanSDyLMxnHhSXEDJqHxD7msR8D0uCmqlkwjCV8xvwHw=="],

    "fast-levenshtein": ["fast-levenshtein@2.0.6", "https://registry.npmjs.org/fast-levenshtein/-/fast-levenshtein-2.0.6.tgz", {}, "sha512-DCXu6Ifhqcks7TZKY3Hxp3y6qphY5SJZmrWMDrKcERSOXWQdMhU9Ig/PYrzyw/ul9jOIyh0N4M0tbC5hodg8dw=="],

    "fastq": ["fastq@1.19.1", "https://registry.npmjs.org/fastq/-/fastq-1.19.1.tgz", { "dependencies": { "reusify": "^1.0.4" } }, "sha512-GwLTyxkCXjXbxqIhTsMI2Nui8huMPtnxg7krajPJAjnEG/iiOS7i+zCtWGZR9G0NBKbXKh6X9m9UIsYX/N6vvQ=="],

    "fb-watchman": ["fb-watchman@2.0.2", "https://registry.npmjs.org/fb-watchman/-/fb-watchman-2.0.2.tgz", { "dependencies": { "bser": "2.1.1" } }, "sha512-p5161BqbuCaSnB8jIbzQHOlpgsPmK5rJVDfDKO91Axs5NC1uu3HRQm6wt9cd9/+GtQQIO53JdGXXoyDpTAsgYA=="],

    "figures": ["figures@3.2.0", "https://registry.npmjs.org/figures/-/figures-3.2.0.tgz", { "dependencies": { "escape-string-regexp": "^1.0.5" } }, "sha512-yaduQFRKLXYOGgEn6AZau90j3ggSOyiqXU0F9JZfeXYhNa+Jk4X+s45A2zg5jns87GAFa34BBm2kXw4XpNcbdg=="],

    "file-entry-cache": ["file-entry-cache@6.0.1", "https://registry.npmjs.org/file-entry-cache/-/file-entry-cache-6.0.1.tgz", { "dependencies": { "flat-cache": "^3.0.4" } }, "sha512-7Gps/XWymbLk2QLYK4NzpMOrYjMhdIxXuIvy2QBsLE6ljuodKvdkWs/cpyJJ3CVIVpH0Oi1Hvg1ovbMzLdFBBg=="],

    "filelist": ["filelist@1.0.4", "https://registry.npmjs.org/filelist/-/filelist-1.0.4.tgz", { "dependencies": { "minimatch": "^5.0.1" } }, "sha512-w1cEuf3S+DrLCQL7ET6kz+gmlJdbq9J7yXCSjK/OZCPA+qEN1WyF4ZAf0YYJa4/shHJra2t/d/r8SV4Ji+x+8Q=="],

    "fill-range": ["fill-range@7.1.1", "https://registry.npmjs.org/fill-range/-/fill-range-7.1.1.tgz", { "dependencies": { "to-regex-range": "^5.0.1" } }, "sha512-YsGpe3WHLK8ZYi4tWDg2Jy3ebRz2rXowDxnld4bkQB00cc/1Zw9AWnC0i9ztDJitivtQvaI9KaLyKrc+hBW0yg=="],

    "find-up": ["find-up@5.0.0", "https://registry.npmjs.org/find-up/-/find-up-5.0.0.tgz", { "dependencies": { "locate-path": "^6.0.0", "path-exists": "^4.0.0" } }, "sha512-78/PXT1wlLLDgTzDs7sjq9hzz0vXD+zn+7wypEe4fXQxCmdmqfGsEPQxmiCSQI3ajFV91bVSsvNtrJRiW6nGng=="],

    "flat": ["flat@5.0.2", "https://registry.npmjs.org/flat/-/flat-5.0.2.tgz", { "bin": { "flat": "cli.js" } }, "sha512-b6suED+5/3rTpUBdG1gupIl8MPFCAMA0QXwmljLhvCUKcUvdE4gWky9zpuGCcXHOsz4J9wPGNWq6OKpmIzz3hQ=="],

    "flat-cache": ["flat-cache@3.2.0", "https://registry.npmjs.org/flat-cache/-/flat-cache-3.2.0.tgz", { "dependencies": { "flatted": "^3.2.9", "keyv": "^4.5.3", "rimraf": "^3.0.2" } }, "sha512-CYcENa+FtcUKLmhhqyctpclsq7QF38pKjZHsGNiSQF5r4FtoKDWabFDl3hzaEQMvT1LHEysw5twgLvpYYb4vbw=="],

    "flatted": ["flatted@3.3.3", "https://registry.npmjs.org/flatted/-/flatted-3.3.3.tgz", {}, "sha512-GX+ysw4PBCz0PzosHDepZGANEuFCMLrnRTiEy9McGjmkCQYwRq4A/X786G/fjM/+OjsWSU1ZrY5qyARZmO/uwg=="],

    "follow-redirects": ["follow-redirects@1.15.9", "https://registry.npmjs.org/follow-redirects/-/follow-redirects-1.15.9.tgz", {}, "sha512-gew4GsXizNgdoRyqmyfMHyAmXsZDk6mHkSxZFCzW9gwlbtOW44CDtYavM+y+72qD/Vq2l550kMF52DT8fOLJqQ=="],

    "form-data": ["form-data@4.0.4", "https://registry.npmjs.org/form-data/-/form-data-4.0.4.tgz", { "dependencies": { "asynckit": "^0.4.0", "combined-stream": "^1.0.8", "es-set-tostringtag": "^2.1.0", "hasown": "^2.0.2", "mime-types": "^2.1.12" } }, "sha512-KrGhL9Q4zjj0kiUt5OO4Mr/A/jlI2jDYs5eHBpYHPcBEVSiipAvn2Ko2HnPe20rmcuuvMHNdZFp+4IlGTMF0Ow=="],

    "fs-constants": ["fs-constants@1.0.0", "https://registry.npmjs.org/fs-constants/-/fs-constants-1.0.0.tgz", {}, "sha512-y6OAwoSIf7FyjMIv94u+b5rdheZEjzR63GTyZJm5qh4Bi+2YgwLCcI/fPFZkL5PSixOt6ZNKm+w+Hfp/Bciwow=="],

    "fs-extra": ["fs-extra@10.1.0", "https://registry.npmjs.org/fs-extra/-/fs-extra-10.1.0.tgz", { "dependencies": { "graceful-fs": "^4.2.0", "jsonfile": "^6.0.1", "universalify": "^2.0.0" } }, "sha512-oRXApq54ETRj4eMiFzGnHWGy+zo5raudjuxN0b8H7s/RU2oW0Wvsx9O0ACRN/kRq9E8Vu/ReskGB5o3ji+FzHQ=="],

    "fs.realpath": ["fs.realpath@1.0.0", "https://registry.npmjs.org/fs.realpath/-/fs.realpath-1.0.0.tgz", {}, "sha512-OO0pH2lK6a0hZnAdau5ItzHPI6pUlvI7jMVnxUQRtw4owF2wk8lOSabtGDCTP4Ggrg2MbGnWO9X8K1t4+fGMDw=="],

    "fsevents": ["fsevents@2.3.3", "https://registry.npmjs.org/fsevents/-/fsevents-2.3.3.tgz", { "os": "darwin" }, "sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw=="],

    "function-bind": ["function-bind@1.1.2", "https://registry.npmjs.org/function-bind/-/function-bind-1.1.2.tgz", {}, "sha512-7XHNxH7qX9xG5mIwxkhumTox/MIRNcOgDrxWsMt2pAr23WHp6MrRlN7FBSFpCpr+oVO0F744iUgR82nJMfG2SA=="],

    "gensync": ["gensync@1.0.0-beta.2", "https://registry.npmjs.org/gensync/-/gensync-1.0.0-beta.2.tgz", {}, "sha512-3hN7NaskYvMDLQY55gnW3NQ+mesEAepTqlg+VEbj7zzqEMBVNhzcGYYeqFo/TlYz6eQiFcp1HcsCZO+nGgS8zg=="],

    "get-caller-file": ["get-caller-file@2.0.5", "https://registry.npmjs.org/get-caller-file/-/get-caller-file-2.0.5.tgz", {}, "sha512-DyFP3BM/3YHTQOCUL/w0OZHR0lpKeGrxotcHWcqNEdnltqFwXVfhEBQ94eIo34AfQpo0rGki4cyIiftY06h2Fg=="],

    "get-intrinsic": ["get-intrinsic@1.3.0", "https://registry.npmjs.org/get-intrinsic/-/get-intrinsic-1.3.0.tgz", { "dependencies": { "call-bind-apply-helpers": "^1.0.2", "es-define-property": "^1.0.1", "es-errors": "^1.3.0", "es-object-atoms": "^1.1.1", "function-bind": "^1.1.2", "get-proto": "^1.0.1", "gopd": "^1.2.0", "has-symbols": "^1.1.0", "hasown": "^2.0.2", "math-intrinsics": "^1.1.0" } }, "sha512-9fSjSaos/fRIVIp+xSJlE6lfwhES7LNtKaCBIamHsjr2na1BiABJPo0mOjjz8GJDURarmCPGqaiVg5mfjb98CQ=="],

    "get-package-type": ["get-package-type@0.1.0", "https://registry.npmjs.org/get-package-type/-/get-package-type-0.1.0.tgz", {}, "sha512-pjzuKtY64GYfWizNAJ0fr9VqttZkNiK2iS430LtIHzjBEr6bX8Am2zm4sW4Ro5wjWW5cAlRL1qAMTcXbjNAO2Q=="],

    "get-proto": ["get-proto@1.0.1", "https://registry.npmjs.org/get-proto/-/get-proto-1.0.1.tgz", { "dependencies": { "dunder-proto": "^1.0.1", "es-object-atoms": "^1.0.0" } }, "sha512-sTSfBjoXBp89JvIKIefqw7U2CCebsc74kiY6awiGogKtoSGbgjYE/G/+l9sF3MWFPNc9IcoOC4ODfKHfxFmp0g=="],

    "get-stream": ["get-stream@6.0.1", "https://registry.npmjs.org/get-stream/-/get-stream-6.0.1.tgz", {}, "sha512-ts6Wi+2j3jQjqi70w5AlN8DFnkSwC+MqmxEzdEALB2qXZYV3X/b1CTfgPLGJNMeAWxdPfU8FO1ms3NUfaHCPYg=="],

    "glob": ["glob@7.2.3", "https://registry.npmjs.org/glob/-/glob-7.2.3.tgz", { "dependencies": { "fs.realpath": "^1.0.0", "inflight": "^1.0.4", "inherits": "2", "minimatch": "^3.1.1", "once": "^1.3.0", "path-is-absolute": "^1.0.0" } }, "sha512-nFR0zLpU2YCaRxwoCJvL6UvCH2JFyFVIvwTLsIf21AuHlMskA1hhTdk+LlYJtOlYt9v6dvszD2BGRqBL+iQK9Q=="],

    "glob-parent": ["glob-parent@5.1.2", "https://registry.npmjs.org/glob-parent/-/glob-parent-5.1.2.tgz", { "dependencies": { "is-glob": "^4.0.1" } }, "sha512-AOIgSQCepiJYwP3ARnGx+5VnTu2HBYdzbGP45eLw1vr3zB3vZLeyed1sC9hnbcOc9/SrMyM5RPQrkGz4aS9Zow=="],

    "globals": ["globals@13.24.0", "https://registry.npmjs.org/globals/-/globals-13.24.0.tgz", { "dependencies": { "type-fest": "^0.20.2" } }, "sha512-AhO5QUcj8llrbG09iWhPU2B204J1xnPeL8kQmVorSsy+Sjj1sk8gIyh6cUocGmH4L0UuhAJy+hJMRA4mgA4mFQ=="],

    "gopd": ["gopd@1.2.0", "https://registry.npmjs.org/gopd/-/gopd-1.2.0.tgz", {}, "sha512-ZUKRh6/kUFoAiTAtTYPZJ3hw9wNxx+BIBOijnlG9PnrJsCcSjs1wyyD6vJpaYtgnzDrKYRSqf3OO6Rfa93xsRg=="],

    "graceful-fs": ["graceful-fs@4.2.11", "https://registry.npmjs.org/graceful-fs/-/graceful-fs-4.2.11.tgz", {}, "sha512-RbJ5/jmFcNNCcDV5o9eTnBLJ/HszWV0P73bc+Ff4nS/rJj+YaS6IGyiOL0VoBYX+l1Wrl3k63h/KrH+nhJ0XvQ=="],

    "graphemer": ["graphemer@1.4.0", "https://registry.npmjs.org/graphemer/-/graphemer-1.4.0.tgz", {}, "sha512-EtKwoO6kxCL9WO5xipiHTZlSzBm7WLT627TqC/uVRd0HKmq8NXyebnNYxDoBi7wt8eTWrUrKXCOVaFq9x1kgag=="],

    "harmony-reflect": ["harmony-reflect@1.6.2", "https://registry.npmjs.org/harmony-reflect/-/harmony-reflect-1.6.2.tgz", {}, "sha512-HIp/n38R9kQjDEziXyDTuW3vvoxxyxjxFzXLrBr18uB47GnSt+G9D29fqrpM5ZkspMcPICud3XsBJQ4Y2URg8g=="],

    "has-flag": ["has-flag@4.0.0", "https://registry.npmjs.org/has-flag/-/has-flag-4.0.0.tgz", {}, "sha512-EykJT/Q1KjTWctppgIAgfSO0tKVuZUjhgMr17kqTumMl6Afv3EISleU7qZUzoXDFTAHTDC4NOoG/ZxU3EvlMPQ=="],

    "has-symbols": ["has-symbols@1.1.0", "https://registry.npmjs.org/has-symbols/-/has-symbols-1.1.0.tgz", {}, "sha512-1cDNdwJ2Jaohmb3sg4OmKaMBwuC48sYni5HUw2DvsC8LjGTLK9h+eb1X6RyuOHe4hT0ULCW68iomhjUoKUqlPQ=="],

    "has-tostringtag": ["has-tostringtag@1.0.2", "https://registry.npmjs.org/has-tostringtag/-/has-tostringtag-1.0.2.tgz", { "dependencies": { "has-symbols": "^1.0.3" } }, "sha512-NqADB8VjPFLM2V0VvHUewwwsw0ZWBaIdgo+ieHtK3hasLz4qeCRjYcqfB6AQrBggRKppKF8L52/VqdVsO47Dlw=="],

    "hasown": ["hasown@2.0.2", "https://registry.npmjs.org/hasown/-/hasown-2.0.2.tgz", { "dependencies": { "function-bind": "^1.1.2" } }, "sha512-0hJU9SCPvmMzIBdZFqNPXWa6dqh7WdH0cII9y+CyS8rG3nL48Bclra9HmKhVVUHyPWNH5Y7xDwAB7bfgSjkUMQ=="],

    "html-escaper": ["html-escaper@2.0.2", "https://registry.npmjs.org/html-escaper/-/html-escaper-2.0.2.tgz", {}, "sha512-H2iMtd0I4Mt5eYiapRdIDjp+XzelXQ0tFE4JS7YFwFevXXMmOp9myNrUvCg0D6ws8iqkRPBfKHgbwig1SmlLfg=="],

    "human-signals": ["human-signals@2.1.0", "https://registry.npmjs.org/human-signals/-/human-signals-2.1.0.tgz", {}, "sha512-B4FFZ6q/T2jhhksgkbEW3HBvWIfDW85snkQgawt07S7J5QXTk6BkNV+0yAeZrM5QpMAdYlocGoljn0sJ/WQkFw=="],

    "identity-obj-proxy": ["identity-obj-proxy@3.0.0", "https://registry.npmjs.org/identity-obj-proxy/-/identity-obj-proxy-3.0.0.tgz", { "dependencies": { "harmony-reflect": "^1.4.6" } }, "sha512-00n6YnVHKrinT9t0d9+5yZC6UBNJANpYEQvL2LlX6Ab9lnmxzIRcEmTPuyGScvl1+jKuCICX1Z0Ab1pPKKdikA=="],

    "ieee754": ["ieee754@1.2.1", "https://registry.npmjs.org/ieee754/-/ieee754-1.2.1.tgz", {}, "sha512-dcyqhDvX1C46lXZcVqCpK+FtMRQVdIMN6/Df5js2zouUsqG7I6sFxitIC+7KYK29KdXOLHdu9zL4sFnoVQnqaA=="],

    "ignore": ["ignore@5.3.2", "https://registry.npmjs.org/ignore/-/ignore-5.3.2.tgz", {}, "sha512-hsBTNUqQTDwkWtcdYI2i06Y/nUBEsNEDJKjWdigLvegy8kDuJAS8uRlpkkcQpyEXL0Z/pjDy5HBmMjRCJ2gq+g=="],

    "import-fresh": ["import-fresh@3.3.1", "https://registry.npmjs.org/import-fresh/-/import-fresh-3.3.1.tgz", { "dependencies": { "parent-module": "^1.0.0", "resolve-from": "^4.0.0" } }, "sha512-TR3KfrTZTYLPB6jUjfx6MF9WcWrHL9su5TObK4ZkYgBdWKPOFoSoQIdEuTuR82pmtxH2spWG9h6etwfr1pLBqQ=="],

    "import-local": ["import-local@3.2.0", "https://registry.npmjs.org/import-local/-/import-local-3.2.0.tgz", { "dependencies": { "pkg-dir": "^4.2.0", "resolve-cwd": "^3.0.0" }, "bin": { "import-local-fixture": "fixtures/cli.js" } }, "sha512-2SPlun1JUPWoM6t3F0dw0FkCF/jWY8kttcY4f599GLTSjh2OCuuhdTkJQsEcZzBqbXZGKMK2OqW1oZsjtf/gQA=="],

    "imurmurhash": ["imurmurhash@0.1.4", "https://registry.npmjs.org/imurmurhash/-/imurmurhash-0.1.4.tgz", {}, "sha512-JmXMZ6wuvDmLiHEml9ykzqO6lwFbof0GG4IkcGaENdCRDDmMVnny7s5HsIgHCbaq0w2MyPhDqkhTUgS2LU2PHA=="],

    "inflight": ["inflight@1.0.6", "https://registry.npmjs.org/inflight/-/inflight-1.0.6.tgz", { "dependencies": { "once": "^1.3.0", "wrappy": "1" } }, "sha512-k92I/b08q4wvFscXCLvqfsHCrjrF7yiXsQuIVvVE7N82W3+aqpzuUdBbfhWcy/FZR3/4IgflMgKLOsvPDrGCJA=="],

    "inherits": ["inherits@2.0.4", "https://registry.npmjs.org/inherits/-/inherits-2.0.4.tgz", {}, "sha512-k/vGaX4/Yla3WzyMCvTQOXYeIHvqOKtnqBduzTHpzpQZzAskKMhZ2K+EnBiSM9zGSoIFeMpXKxa4dYeZIQqewQ=="],

    "is-arrayish": ["is-arrayish@0.2.1", "https://registry.npmjs.org/is-arrayish/-/is-arrayish-0.2.1.tgz", {}, "sha512-zz06S8t0ozoDXMG+ube26zeCTNXcKIPJZJi8hBrF4idCLms4CG9QtK7qBl1boi5ODzFpjswb5JPmHCbMpjaYzg=="],

    "is-binary-path": ["is-binary-path@2.1.0", "https://registry.npmjs.org/is-binary-path/-/is-binary-path-2.1.0.tgz", { "dependencies": { "binary-extensions": "^2.0.0" } }, "sha512-ZMERYes6pDydyuGidse7OsHxtbI7WVeUEozgR/g7rd0xUimYNlvZRE/K2MgZTjWy725IfelLeVcEM97mmtRGXw=="],

    "is-core-module": ["is-core-module@2.16.1", "https://registry.npmjs.org/is-core-module/-/is-core-module-2.16.1.tgz", { "dependencies": { "hasown": "^2.0.2" } }, "sha512-UfoeMA6fIJ8wTYFEUjelnaGI67v6+N7qXJEvQuIGa99l4xsCruSYOVSQ0uPANn4dAzm8lkYPaKLrrijLq7x23w=="],

    "is-docker": ["is-docker@2.2.1", "https://registry.npmjs.org/is-docker/-/is-docker-2.2.1.tgz", { "bin": { "is-docker": "cli.js" } }, "sha512-F+i2BKsFrH66iaUFc0woD8sLy8getkwTwtOBjvs56Cx4CgJDeKQeqfz8wAYiSb8JOprWhHH5p77PbmYCvvUuXQ=="],

    "is-extglob": ["is-extglob@2.1.1", "https://registry.npmjs.org/is-extglob/-/is-extglob-2.1.1.tgz", {}, "sha512-SbKbANkN603Vi4jEZv49LeVJMn4yGwsbzZworEoyEiutsN3nJYdbO36zfhGJ6QEDpOZIFkDtnq5JRxmvl3jsoQ=="],

    "is-fullwidth-code-point": ["is-fullwidth-code-point@3.0.0", "https://registry.npmjs.org/is-fullwidth-code-point/-/is-fullwidth-code-point-3.0.0.tgz", {}, "sha512-zymm5+u+sCsSWyD9qNaejV3DFvhCKclKdizYaJUuHA83RLjb7nSuGnddCHGv0hk+KY7BMAlsWeK4Ueg6EV6XQg=="],

    "is-generator-fn": ["is-generator-fn@2.1.0", "https://registry.npmjs.org/is-generator-fn/-/is-generator-fn-2.1.0.tgz", {}, "sha512-cTIB4yPYL/Grw0EaSzASzg6bBy9gqCofvWN8okThAYIxKJZC+udlRAmGbM0XLeniEJSs8uEgHPGuHSe1XsOLSQ=="],

    "is-glob": ["is-glob@4.0.3", "https://registry.npmjs.org/is-glob/-/is-glob-4.0.3.tgz", { "dependencies": { "is-extglob": "^2.1.1" } }, "sha512-xelSayHH36ZgE7ZWhli7pW34hNbNl8Ojv5KVmkJD4hBdD3th8Tfk9vYasLM+mXWOZhFkgZfxhLSnrwRr4elSSg=="],

    "is-number": ["is-number@7.0.0", "https://registry.npmjs.org/is-number/-/is-number-7.0.0.tgz", {}, "sha512-41Cifkg6e8TylSpdtTpeLVMqvSBEVzTttHvERD741+pnZ8ANv0004MRL43QKPDlK9cGvNp6NZWZUBlbGXYxxng=="],

    "is-path-inside": ["is-path-inside@3.0.3", "https://registry.npmjs.org/is-path-inside/-/is-path-inside-3.0.3.tgz", {}, "sha512-Fd4gABb+ycGAmKou8eMftCupSir5lRxqf4aD/vd0cD2qc4HL07OjCeuHMr8Ro4CoMaeCKDB0/ECBOVWjTwUvPQ=="],

    "is-stream": ["is-stream@2.0.1", "https://registry.npmjs.org/is-stream/-/is-stream-2.0.1.tgz", {}, "sha512-hFoiJiTl63nn+kstHGBtewWSKnQLpyb155KHheA1l39uvtO9nWIop1p3udqPcUd/xbF1VLMO4n7OI6p7RbngDg=="],

    "is-wsl": ["is-wsl@2.2.0", "https://registry.npmjs.org/is-wsl/-/is-wsl-2.2.0.tgz", { "dependencies": { "is-docker": "^2.0.0" } }, "sha512-fKzAra0rGJUUBwGBgNkHZuToZcn+TtXHpeCgmkMJMMYx1sQDYaCSyjJBSCa2nH1DGm7s3n1oBnohoVTBaN7Lww=="],

    "isexe": ["isexe@2.0.0", "https://registry.npmjs.org/isexe/-/isexe-2.0.0.tgz", {}, "sha512-RHxMLp9lnKHGHRng9QFhRCMbYAcVpn69smSGcq3f36xjgVVWThj4qqLbTLlq7Ssj8B+fIQ1EuCEGI2lKsyQeIw=="],

    "istanbul-lib-coverage": ["istanbul-lib-coverage@3.2.2", "https://registry.npmjs.org/istanbul-lib-coverage/-/istanbul-lib-coverage-3.2.2.tgz", {}, "sha512-O8dpsF+r0WV/8MNRKfnmrtCWhuKjxrq2w+jpzBL5UZKTi2LeVWnWOmWRxFlesJONmc+wLAGvKQZEOanko0LFTg=="],

    "istanbul-lib-instrument": ["istanbul-lib-instrument@6.0.3", "https://registry.npmjs.org/istanbul-lib-instrument/-/istanbul-lib-instrument-6.0.3.tgz", { "dependencies": { "@babel/core": "^7.23.9", "@babel/parser": "^7.23.9", "@istanbuljs/schema": "^0.1.3", "istanbul-lib-coverage": "^3.2.0", "semver": "^7.5.4" } }, "sha512-Vtgk7L/R2JHyyGW07spoFlB8/lpjiOLTjMdms6AFMraYt3BaJauod/NGrfnVG/y4Ix1JEuMRPDPEj2ua+zz1/Q=="],

    "istanbul-lib-report": ["istanbul-lib-report@3.0.1", "https://registry.npmjs.org/istanbul-lib-report/-/istanbul-lib-report-3.0.1.tgz", { "dependencies": { "istanbul-lib-coverage": "^3.0.0", "make-dir": "^4.0.0", "supports-color": "^7.1.0" } }, "sha512-GCfE1mtsHGOELCU8e/Z7YWzpmybrx/+dSTfLrvY8qRmaY6zXTKWn6WQIjaAFw069icm6GVMNkgu0NzI4iPZUNw=="],

    "istanbul-lib-source-maps": ["istanbul-lib-source-maps@4.0.1", "https://registry.npmjs.org/istanbul-lib-source-maps/-/istanbul-lib-source-maps-4.0.1.tgz", { "dependencies": { "debug": "^4.1.1", "istanbul-lib-coverage": "^3.0.0", "source-map": "^0.6.1" } }, "sha512-n3s8EwkdFIJCG3BPKBYvskgXGoy88ARzvegkitk60NxRdwltLOTaH7CUiMRXvwYorl0Q712iEjcWB+fK/MrWVw=="],

    "istanbul-reports": ["istanbul-reports@3.1.7", "https://registry.npmjs.org/istanbul-reports/-/istanbul-reports-3.1.7.tgz", { "dependencies": { "html-escaper": "^2.0.0", "istanbul-lib-report": "^3.0.0" } }, "sha512-BewmUXImeuRk2YY0PVbxgKAysvhRPUQE0h5QRM++nVWyubKGV0l8qQ5op8+B2DOmwSe63Jivj0BjkPQVf8fP5g=="],

    "jake": ["jake@10.9.2", "https://registry.npmjs.org/jake/-/jake-10.9.2.tgz", { "dependencies": { "async": "^3.2.3", "chalk": "^4.0.2", "filelist": "^1.0.4", "minimatch": "^3.1.2" }, "bin": { "jake": "bin/cli.js" } }, "sha512-2P4SQ0HrLQ+fw6llpLnOaGAvN2Zu6778SJMrCUwns4fOoG9ayrTiZk3VV8sCPkVZF8ab0zksVpS8FDY5pRCNBA=="],

    "jest": ["jest@29.7.0", "https://registry.npmjs.org/jest/-/jest-29.7.0.tgz", { "dependencies": { "@jest/core": "^29.7.0", "@jest/types": "^29.6.3", "import-local": "^3.0.2", "jest-cli": "^29.7.0" }, "peerDependencies": { "node-notifier": "^8.0.1 || ^9.0.0 || ^10.0.0" }, "optionalPeers": ["node-notifier"], "bin": { "jest": "bin/jest.js" } }, "sha512-NIy3oAFp9shda19hy4HK0HRTWKtPJmGdnvywu01nOqNC2vZg+Z+fvJDxpMQA88eb2I9EcafcdjYgsDthnYTvGw=="],

    "jest-changed-files": ["jest-changed-files@29.7.0", "https://registry.npmjs.org/jest-changed-files/-/jest-changed-files-29.7.0.tgz", { "dependencies": { "execa": "^5.0.0", "jest-util": "^29.7.0", "p-limit": "^3.1.0" } }, "sha512-fEArFiwf1BpQ+4bXSprcDc3/x4HSzL4al2tozwVpDFpsxALjLYdyiIK4e5Vz66GQJIbXJ82+35PtysofptNX2w=="],

    "jest-circus": ["jest-circus@29.7.0", "https://registry.npmjs.org/jest-circus/-/jest-circus-29.7.0.tgz", { "dependencies": { "@jest/environment": "^29.7.0", "@jest/expect": "^29.7.0", "@jest/test-result": "^29.7.0", "@jest/types": "^29.6.3", "@types/node": "*", "chalk": "^4.0.0", "co": "^4.6.0", "dedent": "^1.0.0", "is-generator-fn": "^2.0.0", "jest-each": "^29.7.0", "jest-matcher-utils": "^29.7.0", "jest-message-util": "^29.7.0", "jest-runtime": "^29.7.0", "jest-snapshot": "^29.7.0", "jest-util": "^29.7.0", "p-limit": "^3.1.0", "pretty-format": "^29.7.0", "pure-rand": "^6.0.0", "slash": "^3.0.0", "stack-utils": "^2.0.3" } }, "sha512-3E1nCMgipcTkCocFwM90XXQab9bS+GMsjdpmPrlelaxwD93Ad8iVEjX/vvHPdLPnFf+L40u+5+iutRdA1N9myw=="],

    "jest-cli": ["jest-cli@29.7.0", "https://registry.npmjs.org/jest-cli/-/jest-cli-29.7.0.tgz", { "dependencies": { "@jest/core": "^29.7.0", "@jest/test-result": "^29.7.0", "@jest/types": "^29.6.3", "chalk": "^4.0.0", "create-jest": "^29.7.0", "exit": "^0.1.2", "import-local": "^3.0.2", "jest-config": "^29.7.0", "jest-util": "^29.7.0", "jest-validate": "^29.7.0", "yargs": "^17.3.1" }, "peerDependencies": { "node-notifier": "^8.0.1 || ^9.0.0 || ^10.0.0" }, "optionalPeers": ["node-notifier"], "bin": { "jest": "bin/jest.js" } }, "sha512-OVVobw2IubN/GSYsxETi+gOe7Ka59EFMR/twOU3Jb2GnKKeMGJB5SGUUrEz3SFVmJASUdZUzy83sLNNQ2gZslg=="],

    "jest-config": ["jest-config@29.7.0", "https://registry.npmjs.org/jest-config/-/jest-config-29.7.0.tgz", { "dependencies": { "@babel/core": "^7.11.6", "@jest/test-sequencer": "^29.7.0", "@jest/types": "^29.6.3", "babel-jest": "^29.7.0", "chalk": "^4.0.0", "ci-info": "^3.2.0", "deepmerge": "^4.2.2", "glob": "^7.1.3", "graceful-fs": "^4.2.9", "jest-circus": "^29.7.0", "jest-environment-node": "^29.7.0", "jest-get-type": "^29.6.3", "jest-regex-util": "^29.6.3", "jest-resolve": "^29.7.0", "jest-runner": "^29.7.0", "jest-util": "^29.7.0", "jest-validate": "^29.7.0", "micromatch": "^4.0.4", "parse-json": "^5.2.0", "pretty-format": "^29.7.0", "slash": "^3.0.0", "strip-json-comments": "^3.1.1" }, "peerDependencies": { "@types/node": "*", "ts-node": ">=9.0.0" }, "optionalPeers": ["@types/node", "ts-node"] }, "sha512-uXbpfeQ7R6TZBqI3/TxCU4q4ttk3u0PJeC+E0zbfSoSjq6bJ7buBPxzQPL0ifrkY4DNu4JUdk0ImlBUYi840eQ=="],

    "jest-diff": ["jest-diff@29.7.0", "https://registry.npmjs.org/jest-diff/-/jest-diff-29.7.0.tgz", { "dependencies": { "chalk": "^4.0.0", "diff-sequences": "^29.6.3", "jest-get-type": "^29.6.3", "pretty-format": "^29.7.0" } }, "sha512-LMIgiIrhigmPrs03JHpxUh2yISK3vLFPkAodPeo0+BuF7wA2FoQbkEg1u8gBYBThncu7e1oEDUfIXVuTqLRUjw=="],

    "jest-docblock": ["jest-docblock@29.7.0", "https://registry.npmjs.org/jest-docblock/-/jest-docblock-29.7.0.tgz", { "dependencies": { "detect-newline": "^3.0.0" } }, "sha512-q617Auw3A612guyaFgsbFeYpNP5t2aoUNLwBUbc/0kD1R4t9ixDbyFTHd1nok4epoVFpr7PmeWHrhvuV3XaJ4g=="],

    "jest-each": ["jest-each@29.7.0", "https://registry.npmjs.org/jest-each/-/jest-each-29.7.0.tgz", { "dependencies": { "@jest/types": "^29.6.3", "chalk": "^4.0.0", "jest-get-type": "^29.6.3", "jest-util": "^29.7.0", "pretty-format": "^29.7.0" } }, "sha512-gns+Er14+ZrEoC5fhOfYCY1LOHHr0TI+rQUHZS8Ttw2l7gl+80eHc/gFf2Ktkw0+SIACDTeWvpFcv3B04VembQ=="],

    "jest-environment-node": ["jest-environment-node@29.7.0", "https://registry.npmjs.org/jest-environment-node/-/jest-environment-node-29.7.0.tgz", { "dependencies": { "@jest/environment": "^29.7.0", "@jest/fake-timers": "^29.7.0", "@jest/types": "^29.6.3", "@types/node": "*", "jest-mock": "^29.7.0", "jest-util": "^29.7.0" } }, "sha512-DOSwCRqXirTOyheM+4d5YZOrWcdu0LNZ87ewUoywbcb2XR4wKgqiG8vNeYwhjFMbEkfju7wx2GYH0P2gevGvFw=="],

    "jest-get-type": ["jest-get-type@29.6.3", "https://registry.npmjs.org/jest-get-type/-/jest-get-type-29.6.3.tgz", {}, "sha512-zrteXnqYxfQh7l5FHyL38jL39di8H8rHoecLH3JNxH3BwOrBsNeabdap5e0I23lD4HHI8W5VFBZqG4Eaq5LNcw=="],

    "jest-haste-map": ["jest-haste-map@29.7.0", "https://registry.npmjs.org/jest-haste-map/-/jest-haste-map-29.7.0.tgz", { "dependencies": { "@jest/types": "^29.6.3", "@types/graceful-fs": "^4.1.3", "@types/node": "*", "anymatch": "^3.0.3", "fb-watchman": "^2.0.0", "graceful-fs": "^4.2.9", "jest-regex-util": "^29.6.3", "jest-util": "^29.7.0", "jest-worker": "^29.7.0", "micromatch": "^4.0.4", "walker": "^1.0.8" }, "optionalDependencies": { "fsevents": "^2.3.2" } }, "sha512-fP8u2pyfqx0K1rGn1R9pyE0/KTn+G7PxktWidOBTqFPLYX0b9ksaMFkhK5vrS3DVun09pckLdlx90QthlW7AmA=="],

    "jest-leak-detector": ["jest-leak-detector@29.7.0", "https://registry.npmjs.org/jest-leak-detector/-/jest-leak-detector-29.7.0.tgz", { "dependencies": { "jest-get-type": "^29.6.3", "pretty-format": "^29.7.0" } }, "sha512-kYA8IJcSYtST2BY9I+SMC32nDpBT3J2NvWJx8+JCuCdl/CR1I4EKUJROiP8XtCcxqgTTBGJNdbB1A8XRKbTetw=="],

    "jest-matcher-utils": ["jest-matcher-utils@29.7.0", "https://registry.npmjs.org/jest-matcher-utils/-/jest-matcher-utils-29.7.0.tgz", { "dependencies": { "chalk": "^4.0.0", "jest-diff": "^29.7.0", "jest-get-type": "^29.6.3", "pretty-format": "^29.7.0" } }, "sha512-sBkD+Xi9DtcChsI3L3u0+N0opgPYnCRPtGcQYrgXmR+hmt/fYfWAL0xRXYU8eWOdfuLgBe0YCW3AFtnRLagq/g=="],

    "jest-message-util": ["jest-message-util@29.7.0", "https://registry.npmjs.org/jest-message-util/-/jest-message-util-29.7.0.tgz", { "dependencies": { "@babel/code-frame": "^7.12.13", "@jest/types": "^29.6.3", "@types/stack-utils": "^2.0.0", "chalk": "^4.0.0", "graceful-fs": "^4.2.9", "micromatch": "^4.0.4", "pretty-format": "^29.7.0", "slash": "^3.0.0", "stack-utils": "^2.0.3" } }, "sha512-GBEV4GRADeP+qtB2+6u61stea8mGcOT4mCtrYISZwfu9/ISHFJ/5zOMXYbpBE9RsS5+Gb63DW4FgmnKJ79Kf6w=="],

    "jest-mock": ["jest-mock@29.7.0", "https://registry.npmjs.org/jest-mock/-/jest-mock-29.7.0.tgz", { "dependencies": { "@jest/types": "^29.6.3", "@types/node": "*", "jest-util": "^29.7.0" } }, "sha512-ITOMZn+UkYS4ZFh83xYAOzWStloNzJFO2s8DWrE4lhtGD+AorgnbkiKERe4wQVBydIGPx059g6riW5Btp6Llnw=="],

    "jest-pnp-resolver": ["jest-pnp-resolver@1.2.3", "https://registry.npmjs.org/jest-pnp-resolver/-/jest-pnp-resolver-1.2.3.tgz", { "peerDependencies": { "jest-resolve": "*" }, "optionalPeers": ["jest-resolve"] }, "sha512-+3NpwQEnRoIBtx4fyhblQDPgJI0H1IEIkX7ShLUjPGA7TtUTvI1oiKi3SR4oBR0hQhQR80l4WAe5RrXBwWMA8w=="],

    "jest-regex-util": ["jest-regex-util@29.6.3", "https://registry.npmjs.org/jest-regex-util/-/jest-regex-util-29.6.3.tgz", {}, "sha512-KJJBsRCyyLNWCNBOvZyRDnAIfUiRJ8v+hOBQYGn8gDyF3UegwiP4gwRR3/SDa42g1YbVycTidUF3rKjyLFDWbg=="],

    "jest-resolve": ["jest-resolve@29.7.0", "https://registry.npmjs.org/jest-resolve/-/jest-resolve-29.7.0.tgz", { "dependencies": { "chalk": "^4.0.0", "graceful-fs": "^4.2.9", "jest-haste-map": "^29.7.0", "jest-pnp-resolver": "^1.2.2", "jest-util": "^29.7.0", "jest-validate": "^29.7.0", "resolve": "^1.20.0", "resolve.exports": "^2.0.0", "slash": "^3.0.0" } }, "sha512-IOVhZSrg+UvVAshDSDtHyFCCBUl/Q3AAJv8iZ6ZjnZ74xzvwuzLXid9IIIPgTnY62SJjfuupMKZsZQRsCvxEgA=="],

    "jest-resolve-dependencies": ["jest-resolve-dependencies@29.7.0", "https://registry.npmjs.org/jest-resolve-dependencies/-/jest-resolve-dependencies-29.7.0.tgz", { "dependencies": { "jest-regex-util": "^29.6.3", "jest-snapshot": "^29.7.0" } }, "sha512-un0zD/6qxJ+S0et7WxeI3H5XSe9lTBBR7bOHCHXkKR6luG5mwDDlIzVQ0V5cZCuoTgEdcdwzTghYkTWfubi+nA=="],

    "jest-runner": ["jest-runner@29.7.0", "https://registry.npmjs.org/jest-runner/-/jest-runner-29.7.0.tgz", { "dependencies": { "@jest/console": "^29.7.0", "@jest/environment": "^29.7.0", "@jest/test-result": "^29.7.0", "@jest/transform": "^29.7.0", "@jest/types": "^29.6.3", "@types/node": "*", "chalk": "^4.0.0", "emittery": "^0.13.1", "graceful-fs": "^4.2.9", "jest-docblock": "^29.7.0", "jest-environment-node": "^29.7.0", "jest-haste-map": "^29.7.0", "jest-leak-detector": "^29.7.0", "jest-message-util": "^29.7.0", "jest-resolve": "^29.7.0", "jest-runtime": "^29.7.0", "jest-util": "^29.7.0", "jest-watcher": "^29.7.0", "jest-worker": "^29.7.0", "p-limit": "^3.1.0", "source-map-support": "0.5.13" } }, "sha512-fsc4N6cPCAahybGBfTRcq5wFR6fpLznMg47sY5aDpsoejOcVYFb07AHuSnR0liMcPTgBsA3ZJL6kFOjPdoNipQ=="],

    "jest-runtime": ["jest-runtime@29.7.0", "https://registry.npmjs.org/jest-runtime/-/jest-runtime-29.7.0.tgz", { "dependencies": { "@jest/environment": "^29.7.0", "@jest/fake-timers": "^29.7.0", "@jest/globals": "^29.7.0", "@jest/source-map": "^29.6.3", "@jest/test-result": "^29.7.0", "@jest/transform": "^29.7.0", "@jest/types": "^29.6.3", "@types/node": "*", "chalk": "^4.0.0", "cjs-module-lexer": "^1.0.0", "collect-v8-coverage": "^1.0.0", "glob": "^7.1.3", "graceful-fs": "^4.2.9", "jest-haste-map": "^29.7.0", "jest-message-util": "^29.7.0", "jest-mock": "^29.7.0", "jest-regex-util": "^29.6.3", "jest-resolve": "^29.7.0", "jest-snapshot": "^29.7.0", "jest-util": "^29.7.0", "slash": "^3.0.0", "strip-bom": "^4.0.0" } }, "sha512-gUnLjgwdGqW7B4LvOIkbKs9WGbn+QLqRQQ9juC6HndeDiezIwhDP+mhMwHWCEcfQ5RUXa6OPnFF8BJh5xegwwQ=="],

    "jest-snapshot": ["jest-snapshot@29.7.0", "https://registry.npmjs.org/jest-snapshot/-/jest-snapshot-29.7.0.tgz", { "dependencies": { "@babel/core": "^7.11.6", "@babel/generator": "^7.7.2", "@babel/plugin-syntax-jsx": "^7.7.2", "@babel/plugin-syntax-typescript": "^7.7.2", "@babel/types": "^7.3.3", "@jest/expect-utils": "^29.7.0", "@jest/transform": "^29.7.0", "@jest/types": "^29.6.3", "babel-preset-current-node-syntax": "^1.0.0", "chalk": "^4.0.0", "expect": "^29.7.0", "graceful-fs": "^4.2.9", "jest-diff": "^29.7.0", "jest-get-type": "^29.6.3", "jest-matcher-utils": "^29.7.0", "jest-message-util": "^29.7.0", "jest-util": "^29.7.0", "natural-compare": "^1.4.0", "pretty-format": "^29.7.0", "semver": "^7.5.3" } }, "sha512-Rm0BMWtxBcioHr1/OX5YCP8Uov4riHvKPknOGs804Zg9JGZgmIBkbtlxJC/7Z4msKYVbIJtfU+tKb8xlYNfdkw=="],

    "jest-util": ["jest-util@29.7.0", "https://registry.npmjs.org/jest-util/-/jest-util-29.7.0.tgz", { "dependencies": { "@jest/types": "^29.6.3", "@types/node": "*", "chalk": "^4.0.0", "ci-info": "^3.2.0", "graceful-fs": "^4.2.9", "picomatch": "^2.2.3" } }, "sha512-z6EbKajIpqGKU56y5KBUgy1dt1ihhQJgWzUlZHArA/+X2ad7Cb5iF+AK1EWVL/Bo7Rz9uurpqw6SiBCefUbCGA=="],

    "jest-validate": ["jest-validate@29.7.0", "https://registry.npmjs.org/jest-validate/-/jest-validate-29.7.0.tgz", { "dependencies": { "@jest/types": "^29.6.3", "camelcase": "^6.2.0", "chalk": "^4.0.0", "jest-get-type": "^29.6.3", "leven": "^3.1.0", "pretty-format": "^29.7.0" } }, "sha512-ZB7wHqaRGVw/9hST/OuFUReG7M8vKeq0/J2egIGLdvjHCmYqGARhzXmtgi+gVeZ5uXFF219aOc3Ls2yLg27tkw=="],

    "jest-watcher": ["jest-watcher@29.7.0", "https://registry.npmjs.org/jest-watcher/-/jest-watcher-29.7.0.tgz", { "dependencies": { "@jest/test-result": "^29.7.0", "@jest/types": "^29.6.3", "@types/node": "*", "ansi-escapes": "^4.2.1", "chalk": "^4.0.0", "emittery": "^0.13.1", "jest-util": "^29.7.0", "string-length": "^4.0.1" } }, "sha512-49Fg7WXkU3Vl2h6LbLtMQ/HyB6rXSIX7SqvBLQmssRBGN9I0PNvPmAmCWSOY6SOvrjhI/F7/bGAv9RtnsPA03g=="],

    "jest-worker": ["jest-worker@29.7.0", "https://registry.npmjs.org/jest-worker/-/jest-worker-29.7.0.tgz", { "dependencies": { "@types/node": "*", "jest-util": "^29.7.0", "merge-stream": "^2.0.0", "supports-color": "^8.0.0" } }, "sha512-eIz2msL/EzL9UFTFFx7jBTkeZfku0yUAyZZZmJ93H2TYEiroIx2PQjEXcwYtYl8zXCxb+PAmA2hLIt/6ZEkPHw=="],

    "js-tokens": ["js-tokens@4.0.0", "https://registry.npmjs.org/js-tokens/-/js-tokens-4.0.0.tgz", {}, "sha512-RdJUflcE3cUzKiMqQgsCu06FPu9UdIJO0beYbPhHN4k6apgJtifcoCtT9bcxOpYBtpD2kCM6Sbzg4CausW/PKQ=="],

    "js-yaml": ["js-yaml@4.1.0", "https://registry.npmjs.org/js-yaml/-/js-yaml-4.1.0.tgz", { "dependencies": { "argparse": "^2.0.1" }, "bin": { "js-yaml": "bin/js-yaml.js" } }, "sha512-wpxZs9NoxZaJESJGIZTyDEaYpl0FKSA+FB9aJiyemKhMwkxQg63h4T1KJgUGHpTqPDNRcmmYLugrRjJlBtWvRA=="],

    "jsesc": ["jsesc@3.1.0", "https://registry.npmjs.org/jsesc/-/jsesc-3.1.0.tgz", { "bin": { "jsesc": "bin/jsesc" } }, "sha512-/sM3dO2FOzXjKQhJuo0Q173wf2KOo8t4I8vHy6lF9poUp7bKT0/NHE8fPX23PwfhnykfqnC2xRxOnVw5XuGIaA=="],

    "json-buffer": ["json-buffer@3.0.1", "https://registry.npmjs.org/json-buffer/-/json-buffer-3.0.1.tgz", {}, "sha512-4bV5BfR2mqfQTJm+V5tPPdf+ZpuhiIvTuAB5g8kcrXOZpTT/QwwVRWBywX1ozr6lEuPdbHxwaJlm9G6mI2sfSQ=="],

    "json-parse-even-better-errors": ["json-parse-even-better-errors@2.3.1", "https://registry.npmjs.org/json-parse-even-better-errors/-/json-parse-even-better-errors-2.3.1.tgz", {}, "sha512-xyFwyhro/JEof6Ghe2iz2NcXoj2sloNsWr/XsERDK/oiPCfaNhl5ONfp+jQdAZRQQ0IJWNzH9zIZF7li91kh2w=="],

    "json-schema-traverse": ["json-schema-traverse@0.4.1", "https://registry.npmjs.org/json-schema-traverse/-/json-schema-traverse-0.4.1.tgz", {}, "sha512-xbbCH5dCYU5T8LcEhhuh7HJ88HXuW3qsI3Y0zOZFKfZEHcpWiHU/Jxzk629Brsab/mMiHQti9wMP+845RPe3Vg=="],

    "json-stable-stringify-without-jsonify": ["json-stable-stringify-without-jsonify@1.0.1", "https://registry.npmjs.org/json-stable-stringify-without-jsonify/-/json-stable-stringify-without-jsonify-1.0.1.tgz", {}, "sha512-Bdboy+l7tA3OGW6FjyFHWkP5LuByj1Tk33Ljyq0axyzdk9//JSi2u3fP1QSmd1KNwq6VOKYGlAu87CisVir6Pw=="],

    "json5": ["json5@2.2.3", "https://registry.npmjs.org/json5/-/json5-2.2.3.tgz", { "bin": { "json5": "lib/cli.js" } }, "sha512-XmOWe7eyHYH14cLdVPoyg+GOH3rYX++KpzrylJwSW98t3Nk+U8XOl8FWKOgwtzdb8lXGf6zYwDUzeHMWfxasyg=="],

    "jsonc-parser": ["jsonc-parser@3.2.0", "https://registry.npmjs.org/jsonc-parser/-/jsonc-parser-3.2.0.tgz", {}, "sha512-gfFQZrcTc8CnKXp6Y4/CBT3fTc0OVuDofpre4aEeEpSBPV5X5v4+Vmx+8snU7RLPrNHPKSgLxGo9YuQzz20o+w=="],

    "jsonfile": ["jsonfile@6.1.0", "https://registry.npmjs.org/jsonfile/-/jsonfile-6.1.0.tgz", { "dependencies": { "universalify": "^2.0.0" }, "optionalDependencies": { "graceful-fs": "^4.1.6" } }, "sha512-5dgndWOriYSm5cnYaJNhalLNDKOqFwyDB/rr1E9ZsGciGvKPs8R2xYGCacuf3z6K1YKDz182fd+fY3cn3pMqXQ=="],

    "keyv": ["keyv@4.5.4", "https://registry.npmjs.org/keyv/-/keyv-4.5.4.tgz", { "dependencies": { "json-buffer": "3.0.1" } }, "sha512-oxVHkHR/EJf2CNXnWxRLW6mg7JyCCUcG0DtEGmL2ctUo1PNTin1PUil+r/+4r5MpVgC/fn1kjsx7mjSujKqIpw=="],

    "kleur": ["kleur@3.0.3", "https://registry.npmjs.org/kleur/-/kleur-3.0.3.tgz", {}, "sha512-eTIzlVOSUR+JxdDFepEYcBMtZ9Qqdef+rnzWdRZuMbOywu5tO2w2N7rqjoANZ5k9vywhL6Br1VRjUIgTQx4E8w=="],

    "leven": ["leven@3.1.0", "https://registry.npmjs.org/leven/-/leven-3.1.0.tgz", {}, "sha512-qsda+H8jTaUaN/x5vzW2rzc+8Rw4TAQ/4KjB46IwK5VH+IlVeeeje/EoZRpiXvIqjFgK84QffqPztGI3VBLG1A=="],

    "levn": ["levn@0.4.1", "https://registry.npmjs.org/levn/-/levn-0.4.1.tgz", { "dependencies": { "prelude-ls": "^1.2.1", "type-check": "~0.4.0" } }, "sha512-+bT2uH4E5LGE7h/n3evcS/sQlJXCpIp6ym8OWJ5eV6+67Dsql/LaaT7qJBAt2rzfoa/5QBGBhxDix1dMt2kQKQ=="],

    "lines-and-columns": ["lines-and-columns@1.2.4", "https://registry.npmjs.org/lines-and-columns/-/lines-and-columns-1.2.4.tgz", {}, "sha512-7ylylesZQ/PV29jhEDl3Ufjo6ZX7gCqJr5F7PKrqc93v7fzSymt1BpwEU8nAUXs8qzzvqhbjhK5QZg6Mt/HkBg=="],

    "locate-path": ["locate-path@6.0.0", "https://registry.npmjs.org/locate-path/-/locate-path-6.0.0.tgz", { "dependencies": { "p-locate": "^5.0.0" } }, "sha512-iPZK6eYjbxRu3uB4/WZ3EsEIMJFMqAoopl3R+zuq0UjcAm/MO6KCweDgPfP3elTztoKP3KtnVHxTn2NHBSDVUw=="],

    "lodash.debounce": ["lodash.debounce@4.0.8", "https://registry.npmjs.org/lodash.debounce/-/lodash.debounce-4.0.8.tgz", {}, "sha512-FT1yDzDYEoYWhnSGnpE/4Kj1fLZkDFyqRb7fNt6FdYOSxlUWAtp42Eh6Wb0rGIv/m9Bgo7x4GhQbm5Ys4SG5ow=="],

    "lodash.merge": ["lodash.merge@4.6.2", "https://registry.npmjs.org/lodash.merge/-/lodash.merge-4.6.2.tgz", {}, "sha512-0KpjqXRVvrYyCsX1swR/XTK0va6VQkQM6MNo7PqW77ByjAhoARA8EfrP1N4+KlKj8YS0ZUCtRT/YUuhyYDujIQ=="],

    "loose-envify": ["loose-envify@1.4.0", "https://registry.npmjs.org/loose-envify/-/loose-envify-1.4.0.tgz", { "dependencies": { "js-tokens": "^3.0.0 || ^4.0.0" }, "bin": { "loose-envify": "cli.js" } }, "sha512-lyuxPGr/Wfhrlem2CL/UcnUc1zcqKAImBDzukY7Y5F/yQiNdko6+fRLevlw1HgMySw7f611UIY408EtxRSoK3Q=="],

    "lru-cache": ["lru-cache@5.1.1", "https://registry.npmjs.org/lru-cache/-/lru-cache-5.1.1.tgz", { "dependencies": { "yallist": "^3.0.2" } }, "sha512-KpNARQA3Iwv+jTA0utUVVbrh+Jlrr1Fv0e56GGzAFOXN7dk/FviaDW8LHmK52DlcH4WP2n6gI8vN1aesBFgo9w=="],

    "make-dir": ["make-dir@4.0.0", "https://registry.npmjs.org/make-dir/-/make-dir-4.0.0.tgz", { "dependencies": { "semver": "^7.5.3" } }, "sha512-hXdUTZYIVOt1Ex//jAQi+wTZZpUpwBj/0QsOzqegb3rGMMeJiSEu5xLHnYfBrRV4RH2+OCSOO95Is/7x1WJ4bw=="],

    "makeerror": ["makeerror@1.0.12", "https://registry.npmjs.org/makeerror/-/makeerror-1.0.12.tgz", { "dependencies": { "tmpl": "1.0.5" } }, "sha512-JmqCvUhmt43madlpFzG4BQzG2Z3m6tvQDNKdClZnO3VbIudJYmxsT0FNJMeiB2+JTSlTQTSbU8QdesVmwJcmLg=="],

    "math-intrinsics": ["math-intrinsics@1.1.0", "https://registry.npmjs.org/math-intrinsics/-/math-intrinsics-1.1.0.tgz", {}, "sha512-/IXtbwEk5HTPyEwyKX6hGkYXxM9nbj64B+ilVJnC/R6B0pH5G4V3b0pVbL7DBj4tkhBAppbQUlf6F6Xl9LHu1g=="],

    "merge-stream": ["merge-stream@2.0.0", "https://registry.npmjs.org/merge-stream/-/merge-stream-2.0.0.tgz", {}, "sha512-abv/qOcuPfk3URPfDzmZU1LKmuw8kT+0nIHvKrKgFrwifol/doWcdA4ZqsWQ8ENrFKkd67Mfpo/LovbIUsbt3w=="],

    "merge2": ["merge2@1.4.1", "https://registry.npmjs.org/merge2/-/merge2-1.4.1.tgz", {}, "sha512-8q7VEgMJW4J8tcfVPy8g09NcQwZdbwFEqhe/WZkoIzjn/3TGDwtOCYtXGxA3O8tPzpczCCDgv+P2P5y00ZJOOg=="],

    "micromatch": ["micromatch@4.0.8", "https://registry.npmjs.org/micromatch/-/micromatch-4.0.8.tgz", { "dependencies": { "braces": "^3.0.3", "picomatch": "^2.3.1" } }, "sha512-PXwfBhYu0hBCPw8Dn0E+WDYb7af3dSLVWKi3HGv84IdF4TyFoC0ysxFd0Goxw7nSv4T/PzEJQxsYsEiFCKo2BA=="],

    "mime-db": ["mime-db@1.52.0", "https://registry.npmjs.org/mime-db/-/mime-db-1.52.0.tgz", {}, "sha512-sPU4uV7dYlvtWJxwwxHD0PuihVNiE7TyAbQ5SWxDCB9mUYvOgroQOwYQQOKPJ8CIbE+1ETVlOoK1UC2nU3gYvg=="],

    "mime-types": ["mime-types@2.1.35", "https://registry.npmjs.org/mime-types/-/mime-types-2.1.35.tgz", { "dependencies": { "mime-db": "1.52.0" } }, "sha512-ZDY+bPm5zTTF+YpCrAU9nK0UgICYPT0QtT1NZWFv4s++TNkcgVaT0g6+4R2uI4MjQjzysHB1zxuWL50hzaeXiw=="],

    "mimic-fn": ["mimic-fn@2.1.0", "https://registry.npmjs.org/mimic-fn/-/mimic-fn-2.1.0.tgz", {}, "sha512-OqbOk5oEQeAZ8WXWydlu9HJjz9WVdEIvamMCcXmuqUYjTknH/sqsWvhQ3vgwKFRR1HpjvNBKQ37nbJgYzGqGcg=="],

    "minimatch": ["minimatch@3.0.5", "https://registry.npmjs.org/minimatch/-/minimatch-3.0.5.tgz", { "dependencies": { "brace-expansion": "^1.1.7" } }, "sha512-tUpxzX0VAzJHjLu0xUfFv1gwVp9ba3IOuRAVH2EGuRW8a5emA2FlACLqiT/lDVtS1W+TGNwqz3sWaNyLgDJWuw=="],

    "minimist": ["minimist@1.2.8", "https://registry.npmjs.org/minimist/-/minimist-1.2.8.tgz", {}, "sha512-2yyAR8qBkN3YuheJanUpWC5U3bb5osDywNB8RzDVlDwDHbocAJveqqj1u8+SVD7jkWT4yvsHCpWqqWqAxb0zCA=="],

    "ms": ["ms@2.1.3", "https://registry.npmjs.org/ms/-/ms-2.1.3.tgz", {}, "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA=="],

    "natural-compare": ["natural-compare@1.4.0", "https://registry.npmjs.org/natural-compare/-/natural-compare-1.4.0.tgz", {}, "sha512-OWND8ei3VtNC9h7V60qff3SVobHr996CTwgxubgyQYEpg290h9J0buyECNNJexkFm5sOajh5G116RYA1c8ZMSw=="],

    "node-addon-api": ["node-addon-api@3.2.1", "https://registry.npmjs.org/node-addon-api/-/node-addon-api-3.2.1.tgz", {}, "sha512-mmcei9JghVNDYydghQmeDX8KoAm0FAiYyIcUt/N4nhyAipB17pllZQDOJD2fotxABnt4Mdz+dKTO7eftLg4d0A=="],

    "node-gyp-build": ["node-gyp-build@4.8.4", "https://registry.npmjs.org/node-gyp-build/-/node-gyp-build-4.8.4.tgz", { "bin": { "node-gyp-build": "bin.js", "node-gyp-build-optional": "optional.js", "node-gyp-build-test": "build-test.js" } }, "sha512-LA4ZjwlnUblHVgq0oBF3Jl/6h/Nvs5fzBLwdEF4nuxnFdsfajde4WfxtJr3CaiH+F6ewcIB/q4jQ4UzPyid+CQ=="],

    "node-int64": ["node-int64@0.4.0", "https://registry.npmjs.org/node-int64/-/node-int64-0.4.0.tgz", {}, "sha512-O5lz91xSOeoXP6DulyHfllpq+Eg00MWitZIbtPfoSEvqIHdl5gfcY6hYzDWnj0qD5tz52PI08u9qUvSVeUBeHw=="],

    "node-releases": ["node-releases@2.0.19", "https://registry.npmjs.org/node-releases/-/node-releases-2.0.19.tgz", {}, "sha512-xxOWJsBKtzAq7DY0J+DTzuz58K8e7sJbdgwkbMWQe8UYB6ekmsQ45q0M/tJDsGaZmbC+l7n57UV8Hl5tHxO9uw=="],

    "normalize-path": ["normalize-path@3.0.0", "https://registry.npmjs.org/normalize-path/-/normalize-path-3.0.0.tgz", {}, "sha512-6eZs5Ls3WtCisHWp9S2GUy8dqkpGi4BVSz3GaqiE6ezub0512ESztXUwUB6C6IKbQkY2Pnb/mD4WYojCRwcwLA=="],

    "npm-run-path": ["npm-run-path@4.0.1", "https://registry.npmjs.org/npm-run-path/-/npm-run-path-4.0.1.tgz", { "dependencies": { "path-key": "^3.0.0" } }, "sha512-S48WzZW777zhNIrn7gxOlISNAqi9ZC/uQFnRdbeIHhZhCA6UqpkOT8T1G7BvfdgP4Er8gF4sUbaS0i7QvIfCWw=="],

    "nx": ["nx@15.0.13", "https://registry.npmjs.org/nx/-/nx-15.0.13.tgz", { "dependencies": { "@nrwl/cli": "15.0.13", "@nrwl/tao": "15.0.13", "@parcel/watcher": "2.0.4", "@yarnpkg/lockfile": "^1.1.0", "@yarnpkg/parsers": "^3.0.0-rc.18", "@zkochan/js-yaml": "0.0.6", "axios": "^1.0.0", "chalk": "4.1.0", "chokidar": "^3.5.1", "cli-cursor": "3.1.0", "cli-spinners": "2.6.1", "cliui": "^7.0.2", "dotenv": "~10.0.0", "enquirer": "~2.3.6", "fast-glob": "3.2.7", "figures": "3.2.0", "flat": "^5.0.2", "fs-extra": "^10.1.0", "glob": "7.1.4", "ignore": "^5.0.4", "js-yaml": "4.1.0", "jsonc-parser": "3.2.0", "minimatch": "3.0.5", "npm-run-path": "^4.0.1", "open": "^8.4.0", "semver": "7.3.4", "string-width": "^4.2.3", "strong-log-transformer": "^2.1.0", "tar-stream": "~2.2.0", "tmp": "~0.2.1", "tsconfig-paths": "^3.9.0", "tslib": "^2.3.0", "v8-compile-cache": "2.3.0", "yargs": "^17.6.2", "yargs-parser": "21.1.1" }, "peerDependencies": { "@swc-node/register": "^1.4.2", "@swc/core": "^1.2.173" }, "optionalPeers": ["@swc-node/register", "@swc/core"], "bin": { "nx": "bin/nx.js" } }, "sha512-5mJGWz91B9/sxzLjXdD+pmZTel54NeNNxFDis8OhtGDn6eRZ25qWsZNDgzqIDtwKn3c9gThAMHU4XH2OTgWUnA=="],

    "once": ["once@1.4.0", "https://registry.npmjs.org/once/-/once-1.4.0.tgz", { "dependencies": { "wrappy": "1" } }, "sha512-lNaJgI+2Q5URQBkccEKHTQOPaXdUxnZZElQTZY0MFUAuaEqe1E+Nyvgdz/aIyNi6Z9MzO5dv1H8n58/GELp3+w=="],

    "onetime": ["onetime@5.1.2", "https://registry.npmjs.org/onetime/-/onetime-5.1.2.tgz", { "dependencies": { "mimic-fn": "^2.1.0" } }, "sha512-kbpaSSGJTWdAY5KPVeMOKXSrPtr8C8C7wodJbcsd51jRnmD+GZu8Y0VoU6Dm5Z4vWr0Ig/1NKuWRKf7j5aaYSg=="],

    "open": ["open@8.4.2", "https://registry.npmjs.org/open/-/open-8.4.2.tgz", { "dependencies": { "define-lazy-prop": "^2.0.0", "is-docker": "^2.1.1", "is-wsl": "^2.2.0" } }, "sha512-7x81NCL719oNbsq/3mh+hVrAWmFuEYUqrq/Iw3kUzH8ReypT9QQ0BLoJS7/G9k6N81XjW4qHWtjWwe/9eLy1EQ=="],

    "optionator": ["optionator@0.9.4", "https://registry.npmjs.org/optionator/-/optionator-0.9.4.tgz", { "dependencies": { "deep-is": "^0.1.3", "fast-levenshtein": "^2.0.6", "levn": "^0.4.1", "prelude-ls": "^1.2.1", "type-check": "^0.4.0", "word-wrap": "^1.2.5" } }, "sha512-6IpQ7mKUxRcZNLIObR0hz7lxsapSSIYNZJwXPGeF0mTVqGKFIXj1DQcMoT22S3ROcLyY/rz0PWaWZ9ayWmad9g=="],

    "p-limit": ["p-limit@3.1.0", "https://registry.npmjs.org/p-limit/-/p-limit-3.1.0.tgz", { "dependencies": { "yocto-queue": "^0.1.0" } }, "sha512-TYOanM3wGwNGsZN2cVTYPArw454xnXj5qmWF1bEoAc4+cU/ol7GVh7odevjp1FNHduHc3KZMcFduxU5Xc6uJRQ=="],

    "p-locate": ["p-locate@5.0.0", "https://registry.npmjs.org/p-locate/-/p-locate-5.0.0.tgz", { "dependencies": { "p-limit": "^3.0.2" } }, "sha512-LaNjtRWUBY++zB5nE/NwcaoMylSPk+S+ZHNB1TzdbMJMny6dynpAGt7X/tl/QYq3TIeE6nxHppbo2LGymrG5Pw=="],

    "p-try": ["p-try@2.2.0", "https://registry.npmjs.org/p-try/-/p-try-2.2.0.tgz", {}, "sha512-R4nPAVTAU0B9D35/Gk3uJf/7XYbQcyohSKdvAxIRSNghFl4e71hVoGnBNQz9cWaXxO2I10KTC+3jMdvvoKw6dQ=="],

    "parent-module": ["parent-module@1.0.1", "https://registry.npmjs.org/parent-module/-/parent-module-1.0.1.tgz", { "dependencies": { "callsites": "^3.0.0" } }, "sha512-GQ2EWRpQV8/o+Aw8YqtfZZPfNRWZYkbidE9k5rpl/hC3vtHHBfGm2Ifi6qWV+coDGkrUKZAxE3Lot5kcsRlh+g=="],

    "parse-json": ["parse-json@5.2.0", "https://registry.npmjs.org/parse-json/-/parse-json-5.2.0.tgz", { "dependencies": { "@babel/code-frame": "^7.0.0", "error-ex": "^1.3.1", "json-parse-even-better-errors": "^2.3.0", "lines-and-columns": "^1.1.6" } }, "sha512-ayCKvm/phCGxOkYRSCM82iDwct8/EonSEgCSxWxD7ve6jHggsFl4fZVQBPRNgQoKiuV/odhFrGzQXZwbifC8Rg=="],

    "path-exists": ["path-exists@4.0.0", "https://registry.npmjs.org/path-exists/-/path-exists-4.0.0.tgz", {}, "sha512-ak9Qy5Q7jYb2Wwcey5Fpvg2KoAc/ZIhLSLOSBmRmygPsGwkVVt0fZa0qrtMz+m6tJTAHfZQ8FnmB4MG4LWy7/w=="],

    "path-is-absolute": ["path-is-absolute@1.0.1", "https://registry.npmjs.org/path-is-absolute/-/path-is-absolute-1.0.1.tgz", {}, "sha512-AVbw3UJ2e9bq64vSaS9Am0fje1Pa8pbGqTTsmXfaIiMpnr5DlDhfJOuLj9Sf95ZPVDAUerDfEk88MPmPe7UCQg=="],

    "path-key": ["path-key@3.1.1", "https://registry.npmjs.org/path-key/-/path-key-3.1.1.tgz", {}, "sha512-ojmeN0qd+y0jszEtoY48r0Peq5dwMEkIlCOu6Q5f41lfkswXuKtYrhgoTpLnyIcHm24Uhqx+5Tqm2InSwLhE6Q=="],

    "path-parse": ["path-parse@1.0.7", "https://registry.npmjs.org/path-parse/-/path-parse-1.0.7.tgz", {}, "sha512-LDJzPVEEEPR+y48z93A0Ed0yXb8pAByGWo/k5YYdYgpY2/2EsOsksJrq7lOHxryrVOn1ejG6oAp8ahvOIQD8sw=="],

    "picocolors": ["picocolors@1.1.1", "https://registry.npmjs.org/picocolors/-/picocolors-1.1.1.tgz", {}, "sha512-xceH2snhtb5M9liqDsmEw56le376mTZkEX/jEb/RxNFyegNul7eNslCXP9FDj/Lcu0X8KEyMceP2ntpaHrDEVA=="],

    "picomatch": ["picomatch@2.3.1", "https://registry.npmjs.org/picomatch/-/picomatch-2.3.1.tgz", {}, "sha512-JU3teHTNjmE2VCGFzuY8EXzCDVwEqB2a8fsIvwaStHhAWJEeVd1o1QD80CU6+ZdEXXSLbSsuLwJjkCBWqRQUVA=="],

    "pirates": ["pirates@4.0.7", "https://registry.npmjs.org/pirates/-/pirates-4.0.7.tgz", {}, "sha512-TfySrs/5nm8fQJDcBDuUng3VOUKsd7S+zqvbOTiGXHfxX4wK31ard+hoNuvkicM/2YFzlpDgABOevKSsB4G/FA=="],

    "pkg-dir": ["pkg-dir@4.2.0", "https://registry.npmjs.org/pkg-dir/-/pkg-dir-4.2.0.tgz", { "dependencies": { "find-up": "^4.0.0" } }, "sha512-HRDzbaKjC+AOWVXxAU/x54COGeIv9eb+6CkDSQoNTt4XyWoIJvuPsXizxu/Fr23EiekbtZwmh1IcIG/l/a10GQ=="],

    "prelude-ls": ["prelude-ls@1.2.1", "https://registry.npmjs.org/prelude-ls/-/prelude-ls-1.2.1.tgz", {}, "sha512-vkcDPrRZo1QZLbn5RLGPpg/WmIQ65qoWWhcGKf/b5eplkkarX0m9z8ppCat4mlOqUsWpyNuYgO3VRyrYHSzX5g=="],

    "pretty-format": ["pretty-format@29.7.0", "https://registry.npmjs.org/pretty-format/-/pretty-format-29.7.0.tgz", { "dependencies": { "@jest/schemas": "^29.6.3", "ansi-styles": "^5.0.0", "react-is": "^18.0.0" } }, "sha512-Pdlw/oPxN+aXdmM9R00JVC9WVFoCLTKJvDVLgmJ+qAffBMxsV85l/Lu7sNx4zSzPyoL2euImuEwHhOXdEgNFZQ=="],

    "prompts": ["prompts@2.4.2", "https://registry.npmjs.org/prompts/-/prompts-2.4.2.tgz", { "dependencies": { "kleur": "^3.0.3", "sisteransi": "^1.0.5" } }, "sha512-NxNv/kLguCA7p3jE8oL2aEBsrJWgAakBpgmgK6lpPWV+WuOmY6r2/zbAVnP+T8bQlA0nzHXSJSJW0Hq7ylaD2Q=="],

    "proxy-from-env": ["proxy-from-env@1.1.0", "https://registry.npmjs.org/proxy-from-env/-/proxy-from-env-1.1.0.tgz", {}, "sha512-D+zkORCbA9f1tdWRK0RaCR3GPv50cMxcrz4X8k5LTSUD1Dkw47mKJEZQNunItRTkWwgtaUSo1RVFRIG9ZXiFYg=="],

    "punycode": ["punycode@2.3.1", "https://registry.npmjs.org/punycode/-/punycode-2.3.1.tgz", {}, "sha512-vYt7UD1U9Wg6138shLtLOvdAu+8DsC/ilFtEVHcH+wydcSpNE20AfSOduf6MkRFahL5FY7X1oU7nKVZFtfq8Fg=="],

    "pure-rand": ["pure-rand@6.1.0", "https://registry.npmjs.org/pure-rand/-/pure-rand-6.1.0.tgz", {}, "sha512-bVWawvoZoBYpp6yIoQtQXHZjmz35RSVHnUOTefl8Vcjr8snTPY1wnpSPMWekcFwbxI6gtmT7rSYPFvz71ldiOA=="],

    "queue-microtask": ["queue-microtask@1.2.3", "https://registry.npmjs.org/queue-microtask/-/queue-microtask-1.2.3.tgz", {}, "sha512-NuaNSa6flKT5JaSYQzJok04JzTL1CA6aGhv5rfLW3PgqA+M2ChpZQnAC8h8i4ZFkBS8X5RqkDBHA7r4hej3K9A=="],

    "react": ["react@18.2.0", "https://registry.npmjs.org/react/-/react-18.2.0.tgz", { "dependencies": { "loose-envify": "^1.1.0" } }, "sha512-/3IjMdb2L9QbBdWiW5e3P2/npwMBaU9mHCSCUzNln0ZCYbcfTsGbTJrU/kGemdH2IWmB2ioZ+zkxtmq6g09fGQ=="],

    "react-is": ["react-is@18.3.1", "https://registry.npmjs.org/react-is/-/react-is-18.3.1.tgz", {}, "sha512-/LLMVyas0ljjAtoYiPqYiL8VWXzUUdThrmU5+n20DZv+a+ClRoevUzw5JxU+Ieh5/c87ytoTBV9G1FiKfNJdmg=="],

    "readable-stream": ["readable-stream@3.6.2", "https://registry.npmjs.org/readable-stream/-/readable-stream-3.6.2.tgz", { "dependencies": { "inherits": "^2.0.3", "string_decoder": "^1.1.1", "util-deprecate": "^1.0.1" } }, "sha512-9u/sniCrY3D5WdsERHzHE4G2YCXqoG5FTHUiCC4SIbr6XcLZBY05ya9EKjYek9O5xOAwjGq+1JdGBAS7Q9ScoA=="],

    "readdirp": ["readdirp@3.6.0", "https://registry.npmjs.org/readdirp/-/readdirp-3.6.0.tgz", { "dependencies": { "picomatch": "^2.2.1" } }, "sha512-hOS089on8RduqdbhvQ5Z37A0ESjsqz6qnRcffsMU3495FuTdqSm+7bhJ29JvIOsBDEEnan5DPu9t3To9VRlMzA=="],

    "regenerate": ["regenerate@1.4.2", "https://registry.npmjs.org/regenerate/-/regenerate-1.4.2.tgz", {}, "sha512-zrceR/XhGYU/d/opr2EKO7aRHUeiBI8qjtfHqADTwZd6Szfy16la6kqD0MIUs5z5hx6AaKa+PixpPrR289+I0A=="],

    "regenerate-unicode-properties": ["regenerate-unicode-properties@10.2.0", "https://registry.npmjs.org/regenerate-unicode-properties/-/regenerate-unicode-properties-10.2.0.tgz", { "dependencies": { "regenerate": "^1.4.2" } }, "sha512-DqHn3DwbmmPVzeKj9woBadqmXxLvQoQIwu7nopMc72ztvxVmVk2SBhSnx67zuye5TP+lJsb/TBQsjLKhnDf3MA=="],

    "regexpu-core": ["regexpu-core@6.2.0", "https://registry.npmjs.org/regexpu-core/-/regexpu-core-6.2.0.tgz", { "dependencies": { "regenerate": "^1.4.2", "regenerate-unicode-properties": "^10.2.0", "regjsgen": "^0.8.0", "regjsparser": "^0.12.0", "unicode-match-property-ecmascript": "^2.0.0", "unicode-match-property-value-ecmascript": "^2.1.0" } }, "sha512-H66BPQMrv+V16t8xtmq+UC0CBpiTBA60V8ibS1QVReIp8T1z8hwFxqcGzm9K6lgsN7sB5edVH8a+ze6Fqm4weA=="],

    "regjsgen": ["regjsgen@0.8.0", "https://registry.npmjs.org/regjsgen/-/regjsgen-0.8.0.tgz", {}, "sha512-RvwtGe3d7LvWiDQXeQw8p5asZUmfU1G/l6WbUXeHta7Y2PEIvBTwH6E2EfmYUK8pxcxEdEmaomqyp0vZZ7C+3Q=="],

    "regjsparser": ["regjsparser@0.12.0", "https://registry.npmjs.org/regjsparser/-/regjsparser-0.12.0.tgz", { "dependencies": { "jsesc": "~3.0.2" }, "bin": { "regjsparser": "bin/parser" } }, "sha512-cnE+y8bz4NhMjISKbgeVJtqNbtf5QpjZP+Bslo+UqkIt9QPnX9q095eiRRASJG1/tz6dlNr6Z5NsBiWYokp6EQ=="],

    "require-directory": ["require-directory@2.1.1", "https://registry.npmjs.org/require-directory/-/require-directory-2.1.1.tgz", {}, "sha512-fGxEI7+wsG9xrvdjsrlmL22OMTTiHRwAMroiEeMgq8gzoLC/PQr7RsRDSTLUg/bZAZtF+TVIkHc6/4RIKrui+Q=="],

    "resolve": ["resolve@1.22.10", "https://registry.npmjs.org/resolve/-/resolve-1.22.10.tgz", { "dependencies": { "is-core-module": "^2.16.0", "path-parse": "^1.0.7", "supports-preserve-symlinks-flag": "^1.0.0" }, "bin": { "resolve": "bin/resolve" } }, "sha512-NPRy+/ncIMeDlTAsuqwKIiferiawhefFJtkNSW0qZJEqMEb+qBt/77B/jGeeek+F0uOeN05CDa6HXbbIgtVX4w=="],

    "resolve-cwd": ["resolve-cwd@3.0.0", "https://registry.npmjs.org/resolve-cwd/-/resolve-cwd-3.0.0.tgz", { "dependencies": { "resolve-from": "^5.0.0" } }, "sha512-OrZaX2Mb+rJCpH/6CpSqt9xFVpN++x01XnN2ie9g6P5/3xelLAkXWVADpdz1IHD/KFfEXyE6V0U01OQ3UO2rEg=="],

    "resolve-from": ["resolve-from@5.0.0", "https://registry.npmjs.org/resolve-from/-/resolve-from-5.0.0.tgz", {}, "sha512-qYg9KP24dD5qka9J47d0aVky0N+b4fTU89LN9iDnjB5waksiC49rvMB0PrUJQGoTmH50XPiqOvAjDfaijGxYZw=="],

    "resolve.exports": ["resolve.exports@1.1.0", "https://registry.npmjs.org/resolve.exports/-/resolve.exports-1.1.0.tgz", {}, "sha512-J1l+Zxxp4XK3LUDZ9m60LRJF/mAe4z6a4xyabPHk7pvK5t35dACV32iIjJDFeWZFfZlO29w6SZ67knR0tHzJtQ=="],

    "restore-cursor": ["restore-cursor@3.1.0", "https://registry.npmjs.org/restore-cursor/-/restore-cursor-3.1.0.tgz", { "dependencies": { "onetime": "^5.1.0", "signal-exit": "^3.0.2" } }, "sha512-l+sSefzHpj5qimhFSE5a8nufZYAM3sBSVMAPtYkmC+4EH2anSGaEMXSD0izRQbu9nfyQ9y5JrVmp7E8oZrUjvA=="],

    "reusify": ["reusify@1.1.0", "https://registry.npmjs.org/reusify/-/reusify-1.1.0.tgz", {}, "sha512-g6QUff04oZpHs0eG5p83rFLhHeV00ug/Yf9nZM6fLeUrPguBTkTQOdpAWWspMh55TZfVQDPaN3NQJfbVRAxdIw=="],

    "rimraf": ["rimraf@3.0.2", "https://registry.npmjs.org/rimraf/-/rimraf-3.0.2.tgz", { "dependencies": { "glob": "^7.1.3" }, "bin": { "rimraf": "bin.js" } }, "sha512-JZkJMZkAGFFPP2YqXZXPbMlMBgsxzE8ILs4lMIX/2o0L9UBw9O/Y3o6wFw/i9YLapcUJWwqbi3kdxIPdC62TIA=="],

    "run-parallel": ["run-parallel@1.2.0", "https://registry.npmjs.org/run-parallel/-/run-parallel-1.2.0.tgz", { "dependencies": { "queue-microtask": "^1.2.2" } }, "sha512-5l4VyZR86LZ/lDxZTR6jqL8AFE2S0IFLMP26AbjsLVADxHdhB/c0GUsH+y39UfCi3dzz8OlQuPmnaJOMoDHQBA=="],

    "rxjs": ["rxjs@6.6.7", "https://registry.npmjs.org/rxjs/-/rxjs-6.6.7.tgz", { "dependencies": { "tslib": "^1.9.0" } }, "sha512-hTdwr+7yYNIT5n4AMYp85KA6yw2Va0FLa3Rguvbpa4W3I5xynaBZo41cM3XM+4Q6fRMj3sBYIR1VAmZMXYJvRQ=="],

    "safe-buffer": ["safe-buffer@5.2.1", "https://registry.npmjs.org/safe-buffer/-/safe-buffer-5.2.1.tgz", {}, "sha512-rp3So07KcdmmKbGvgaNxQSJr7bGVSVk5S9Eq1F+ppbRo70+YeaDxkw5Dd8NPN+GD6bjnYm2VuPuCXmpuYvmCXQ=="],

    "semver": ["semver@6.3.1", "https://registry.npmjs.org/semver/-/semver-6.3.1.tgz", { "bin": { "semver": "bin/semver.js" } }, "sha512-BR7VvDCVHO+q2xBEWskxS6DJE1qRnb7DxzUrogb71CWoSficBxYsiAGd+Kl0mmq/MprG9yArRkyrQxTO6XjMzA=="],

    "shebang-command": ["shebang-command@2.0.0", "https://registry.npmjs.org/shebang-command/-/shebang-command-2.0.0.tgz", { "dependencies": { "shebang-regex": "^3.0.0" } }, "sha512-kHxr2zZpYtdmrN1qDjrrX/Z1rR1kG8Dx+gkpK1G4eXmvXswmcE1hTWBWYUzlraYw1/yZp6YuDY77YtvbN0dmDA=="],

    "shebang-regex": ["shebang-regex@3.0.0", "https://registry.npmjs.org/shebang-regex/-/shebang-regex-3.0.0.tgz", {}, "sha512-7++dFhtcx3353uBaq8DDR4NuxBetBzC7ZQOhmTQInHEd6bSrXdiEyzCvG07Z44UYdLShWUyXt5M/yhz8ekcb1A=="],

    "signal-exit": ["signal-exit@3.0.7", "https://registry.npmjs.org/signal-exit/-/signal-exit-3.0.7.tgz", {}, "sha512-wnD2ZE+l+SPC/uoS0vXeE9L1+0wuaMqKlfz9AMUo38JsyLSBWSFcHR1Rri62LZc12vLr1gb3jl7iwQhgwpAbGQ=="],

    "sisteransi": ["sisteransi@1.0.5", "https://registry.npmjs.org/sisteransi/-/sisteransi-1.0.5.tgz", {}, "sha512-bLGGlR1QxBcynn2d5YmDX4MGjlZvy2MRBDRNHLJ8VI6l6+9FUiyTFNJ0IveOSP0bcXgVDPRcfGqA0pjaqUpfVg=="],

    "slash": ["slash@3.0.0", "https://registry.npmjs.org/slash/-/slash-3.0.0.tgz", {}, "sha512-g9Q1haeby36OSStwb4ntCGGGaKsaVSjQ68fBxoQcutl5fS1vuY18H3wSt3jFyFtrkx+Kz0V1G85A4MyAdDMi2Q=="],

    "source-map": ["source-map@0.6.1", "https://registry.npmjs.org/source-map/-/source-map-0.6.1.tgz", {}, "sha512-UjgapumWlbMhkBgzT7Ykc5YXUT46F0iKu8SGXq0bcwP5dz/h0Plj6enJqjz1Zbq2l5WaqYnrVbwWOWMyF3F47g=="],

    "source-map-support": ["source-map-support@0.5.13", "https://registry.npmjs.org/source-map-support/-/source-map-support-0.5.13.tgz", { "dependencies": { "buffer-from": "^1.0.0", "source-map": "^0.6.0" } }, "sha512-SHSKFHadjVA5oR4PPqhtAVdcBWwRYVd6g6cAXnIbRiIwc2EhPrTuKUBdSLvlEKyIP3GCf89fltvcZiP9MMFA1w=="],

    "sprintf-js": ["sprintf-js@1.0.3", "https://registry.npmjs.org/sprintf-js/-/sprintf-js-1.0.3.tgz", {}, "sha512-D9cPgkvLlV3t3IzL0D0YLvGA9Ahk4PcvVwUbN0dSGr1aP0Nrt4AEnTUbuGvquEC0mA64Gqt1fzirlRs5ibXx8g=="],

    "stack-utils": ["stack-utils@2.0.6", "https://registry.npmjs.org/stack-utils/-/stack-utils-2.0.6.tgz", { "dependencies": { "escape-string-regexp": "^2.0.0" } }, "sha512-XlkWvfIm6RmsWtNJx+uqtKLS8eqFbxUg0ZzLXqY0caEy9l7hruX8IpiDnjsLavoBgqCCR71TqWO8MaXYheJ3RQ=="],

    "string-length": ["string-length@4.0.2", "https://registry.npmjs.org/string-length/-/string-length-4.0.2.tgz", { "dependencies": { "char-regex": "^1.0.2", "strip-ansi": "^6.0.0" } }, "sha512-+l6rNN5fYHNhZZy41RXsYptCjA2Igmq4EG7kZAYFQI1E1VTXarr6ZPXBg6eq7Y6eK4FEhY6AJlyuFIb/v/S0VQ=="],

    "string-width": ["string-width@4.2.3", "https://registry.npmjs.org/string-width/-/string-width-4.2.3.tgz", { "dependencies": { "emoji-regex": "^8.0.0", "is-fullwidth-code-point": "^3.0.0", "strip-ansi": "^6.0.1" } }, "sha512-wKyQRQpjJ0sIp62ErSZdGsjMJWsap5oRNihHhu6G7JVO/9jIB6UyevL+tXuOqrng8j/cxKTWyWUwvSTriiZz/g=="],

    "string_decoder": ["string_decoder@1.3.0", "https://registry.npmjs.org/string_decoder/-/string_decoder-1.3.0.tgz", { "dependencies": { "safe-buffer": "~5.2.0" } }, "sha512-hkRX8U1WjJFd8LsDJ2yQ/wWWxaopEsABU1XfkM8A+j0+85JAGppt16cr1Whg6KIbb4okU6Mql6BOj+uup/wKeA=="],

    "strip-ansi": ["strip-ansi@6.0.1", "https://registry.npmjs.org/strip-ansi/-/strip-ansi-6.0.1.tgz", { "dependencies": { "ansi-regex": "^5.0.1" } }, "sha512-Y38VPSHcqkFrCpFnQ9vuSXmquuv5oXOKpGeT6aGrr3o3Gc9AlVa6JBfUSOCnbxGGZF+/0ooI7KrPuUSztUdU5A=="],

    "strip-bom": ["strip-bom@3.0.0", "https://registry.npmjs.org/strip-bom/-/strip-bom-3.0.0.tgz", {}, "sha512-vavAMRXOgBVNF6nyEEmL3DBK19iRpDcoIwW+swQ+CbGiu7lju6t+JklA1MHweoWtadgt4ISVUsXLyDq34ddcwA=="],

    "strip-final-newline": ["strip-final-newline@2.0.0", "https://registry.npmjs.org/strip-final-newline/-/strip-final-newline-2.0.0.tgz", {}, "sha512-BrpvfNAE3dcvq7ll3xVumzjKjZQ5tI1sEUIKr3Uoks0XUl45St3FlatVqef9prk4jRDzhW6WZg+3bk93y6pLjA=="],

    "strip-json-comments": ["strip-json-comments@3.1.1", "https://registry.npmjs.org/strip-json-comments/-/strip-json-comments-3.1.1.tgz", {}, "sha512-6fPc+R4ihwqP6N/aIv2f1gMH8lOVtWQHoqC4yK6oSDVVocumAsfCqjkXnqiYMhmMwS/mEHLp7Vehlt3ql6lEig=="],

    "strong-log-transformer": ["strong-log-transformer@2.1.0", "https://registry.npmjs.org/strong-log-transformer/-/strong-log-transformer-2.1.0.tgz", { "dependencies": { "duplexer": "^0.1.1", "minimist": "^1.2.0", "through": "^2.3.4" }, "bin": { "sl-log-transformer": "bin/sl-log-transformer.js" } }, "sha512-B3Hgul+z0L9a236FAUC9iZsL+nVHgoCJnqCbN588DjYxvGXaXaaFbfmQ/JhvKjZwsOukuR72XbHv71Qkug0HxA=="],

    "supports-color": ["supports-color@9.4.0", "https://registry.npmjs.org/supports-color/-/supports-color-9.4.0.tgz", {}, "sha512-VL+lNrEoIXww1coLPOmiEmK/0sGigko5COxI09KzHc2VJXJsQ37UaQ+8quuxjDeA7+KnLGTWRyOXSLLR2Wb4jw=="],

    "supports-hyperlinks": ["supports-hyperlinks@2.3.0", "https://registry.npmjs.org/supports-hyperlinks/-/supports-hyperlinks-2.3.0.tgz", { "dependencies": { "has-flag": "^4.0.0", "supports-color": "^7.0.0" } }, "sha512-RpsAZlpWcDwOPQA22aCH4J0t7L8JmAvsCxfOSEwm7cQs3LshN36QaTkwd70DnBOXDWGssw2eUoc8CaRWT0XunA=="],

    "supports-preserve-symlinks-flag": ["supports-preserve-symlinks-flag@1.0.0", "https://registry.npmjs.org/supports-preserve-symlinks-flag/-/supports-preserve-symlinks-flag-1.0.0.tgz", {}, "sha512-ot0WnXS9fgdkgIcePe6RHNk1WA8+muPa6cSjeR3V8K27q9BB1rTE3R1p7Hv0z1ZyAc8s6Vvv8DIyWf681MAt0w=="],

    "tar-stream": ["tar-stream@2.2.0", "https://registry.npmjs.org/tar-stream/-/tar-stream-2.2.0.tgz", { "dependencies": { "bl": "^4.0.3", "end-of-stream": "^1.4.1", "fs-constants": "^1.0.0", "inherits": "^2.0.3", "readable-stream": "^3.1.1" } }, "sha512-ujeqbceABgwMZxEJnk2HDY2DlnUZ+9oEcb1KzTVfYHio0UE6dG71n60d8D2I4qNvleWrrXpmjpt7vZeF1LnMZQ=="],

    "terminal-link": ["terminal-link@2.1.1", "https://registry.npmjs.org/terminal-link/-/terminal-link-2.1.1.tgz", { "dependencies": { "ansi-escapes": "^4.2.1", "supports-hyperlinks": "^2.0.0" } }, "sha512-un0FmiRUQNr5PJqy9kP7c40F5BOfpGlYTrxonDChEZB7pzZxRNp/bt+ymiy9/npwXya9KH99nJ/GXFIiUkYGFQ=="],

    "test-exclude": ["test-exclude@6.0.0", "https://registry.npmjs.org/test-exclude/-/test-exclude-6.0.0.tgz", { "dependencies": { "@istanbuljs/schema": "^0.1.2", "glob": "^7.1.4", "minimatch": "^3.0.4" } }, "sha512-cAGWPIyOHU6zlmg88jwm7VRyXnMN7iV68OGAbYDk/Mh/xC/pzVPlQtY6ngoIH/5/tciuhGfvESU8GrHrcxD56w=="],

    "text-table": ["text-table@0.2.0", "https://registry.npmjs.org/text-table/-/text-table-0.2.0.tgz", {}, "sha512-N+8UisAXDGk8PFXP4HAzVR9nbfmVJ3zYLAWiTIoqC5v5isinhr+r5uaO8+7r3BMfuNIufIsA7RdpVgacC2cSpw=="],

    "through": ["through@2.3.8", "https://registry.npmjs.org/through/-/through-2.3.8.tgz", {}, "sha512-w89qg7PI8wAdvX60bMDP+bFoD5Dvhm9oLheFp5O4a2QF0cSBGsBX4qZmadPMvVqlLJBBci+WqGGOAPvcDeNSVg=="],

    "tmp": ["tmp@0.2.3", "https://registry.npmjs.org/tmp/-/tmp-0.2.3.tgz", {}, "sha512-nZD7m9iCPC5g0pYmcaxogYKggSfLsdxl8of3Q/oIbqCqLLIO9IAF0GWjX1z9NZRHPiXv8Wex4yDCaZsgEw0Y8w=="],

    "tmpl": ["tmpl@1.0.5", "https://registry.npmjs.org/tmpl/-/tmpl-1.0.5.tgz", {}, "sha512-3f0uOEAQwIqGuWW2MVzYg8fV/QNnc/IpuJNG837rLuczAaLVHslWHZQj4IGiEl5Hs3kkbhwL9Ab7Hrsmuj+Smw=="],

    "to-regex-range": ["to-regex-range@5.0.1", "https://registry.npmjs.org/to-regex-range/-/to-regex-range-5.0.1.tgz", { "dependencies": { "is-number": "^7.0.0" } }, "sha512-65P7iz6X5yEr1cwcgvQxbbIw7Uk3gOy5dIdtZ4rDveLqhrdJP+Li/Hx6tyK0NEb+2GCyneCMJiGqrADCSNk8sQ=="],

    "tsconfig-paths": ["tsconfig-paths@3.15.0", "https://registry.npmjs.org/tsconfig-paths/-/tsconfig-paths-3.15.0.tgz", { "dependencies": { "@types/json5": "^0.0.29", "json5": "^1.0.2", "minimist": "^1.2.6", "strip-bom": "^3.0.0" } }, "sha512-2Ac2RgzDe/cn48GvOe3M+o82pEFewD3UPbyoUHHdKasHwJKjds4fLXWf/Ux5kATBKN20oaFGu+jbElp1pos0mg=="],

    "tslib": ["tslib@2.8.1", "https://registry.npmjs.org/tslib/-/tslib-2.8.1.tgz", {}, "sha512-oJFu94HQb+KVduSUQL7wnpmqnfmLsOA/nAh6b6EH0wCEoK0/mPeXU6c3wKDV83MkOuHPRHtSXKKU99IBazS/2w=="],

    "type-check": ["type-check@0.4.0", "https://registry.npmjs.org/type-check/-/type-check-0.4.0.tgz", { "dependencies": { "prelude-ls": "^1.2.1" } }, "sha512-XleUoc9uwGXqjWwXaUTZAmzMcFZ5858QA2vvx1Ur5xIcixXIP+8LnFDgRplU30us6teqdlskFfu+ae4K79Ooew=="],

    "type-detect": ["type-detect@4.0.8", "https://registry.npmjs.org/type-detect/-/type-detect-4.0.8.tgz", {}, "sha512-0fr/mIH1dlO+x7TlcMy+bIDqKPsw/70tVyeHW787goQjhmqaZe10uwLujubK9q9Lg6Fiho1KUKDYz0Z7k7g5/g=="],

    "type-fest": ["type-fest@0.20.2", "https://registry.npmjs.org/type-fest/-/type-fest-0.20.2.tgz", {}, "sha512-Ne+eE4r0/iWnpAxD852z3A+N0Bt5RN//NjJwRd2VFHEmrywxf5vsZlh4R6lixl6B+wz/8d+maTSAkN1FIkI3LQ=="],

    "typescript": ["typescript@4.8.4", "https://registry.npmjs.org/typescript/-/typescript-4.8.4.tgz", { "bin": { "tsc": "bin/tsc", "tsserver": "bin/tsserver" } }, "sha512-QCh+85mCy+h0IGff8r5XWzOVSbBO+KfeYrMQh7NJ58QujwcE22u+NUSmUxqF+un70P9GXKxa2HCNiTTMJknyjQ=="],

    "undici-types": ["undici-types@7.8.0", "https://registry.npmjs.org/undici-types/-/undici-types-7.8.0.tgz", {}, "sha512-9UJ2xGDvQ43tYyVMpuHlsgApydB8ZKfVYTsLDhXkFL/6gfkp+U8xTGdh8pMJv1SpZna0zxG1DwsKZsreLbXBxw=="],

    "unicode-canonical-property-names-ecmascript": ["unicode-canonical-property-names-ecmascript@2.0.1", "https://registry.npmjs.org/unicode-canonical-property-names-ecmascript/-/unicode-canonical-property-names-ecmascript-2.0.1.tgz", {}, "sha512-dA8WbNeb2a6oQzAQ55YlT5vQAWGV9WXOsi3SskE3bcCdM0P4SDd+24zS/OCacdRq5BkdsRj9q3Pg6YyQoxIGqg=="],

    "unicode-match-property-ecmascript": ["unicode-match-property-ecmascript@2.0.0", "https://registry.npmjs.org/unicode-match-property-ecmascript/-/unicode-match-property-ecmascript-2.0.0.tgz", { "dependencies": { "unicode-canonical-property-names-ecmascript": "^2.0.0", "unicode-property-aliases-ecmascript": "^2.0.0" } }, "sha512-5kaZCrbp5mmbz5ulBkDkbY0SsPOjKqVS35VpL9ulMPfSl0J0Xsm+9Evphv9CoIZFwre7aJoa94AY6seMKGVN5Q=="],

    "unicode-match-property-value-ecmascript": ["unicode-match-property-value-ecmascript@2.2.0", "https://registry.npmjs.org/unicode-match-property-value-ecmascript/-/unicode-match-property-value-ecmascript-2.2.0.tgz", {}, "sha512-4IehN3V/+kkr5YeSSDDQG8QLqO26XpL2XP3GQtqwlT/QYSECAwFztxVHjlbh0+gjJ3XmNLS0zDsbgs9jWKExLg=="],

    "unicode-property-aliases-ecmascript": ["unicode-property-aliases-ecmascript@2.1.0", "https://registry.npmjs.org/unicode-property-aliases-ecmascript/-/unicode-property-aliases-ecmascript-2.1.0.tgz", {}, "sha512-6t3foTQI9qne+OZoVQB/8x8rk2k1eVy1gRXhV3oFQ5T6R1dqQ1xtin3XqSlx3+ATBkliTaR/hHyJBm+LVPNM8w=="],

    "universalify": ["universalify@2.0.1", "https://registry.npmjs.org/universalify/-/universalify-2.0.1.tgz", {}, "sha512-gptHNQghINnc/vTGIk0SOFGFNXw7JVrlRUtConJRlvaw6DuX0wO5Jeko9sWrMBhh+PsYAZ7oXAiOnf/UKogyiw=="],

    "update-browserslist-db": ["update-browserslist-db@1.1.3", "https://registry.npmjs.org/update-browserslist-db/-/update-browserslist-db-1.1.3.tgz", { "dependencies": { "escalade": "^3.2.0", "picocolors": "^1.1.1" }, "peerDependencies": { "browserslist": ">= 4.21.0" }, "bin": { "update-browserslist-db": "cli.js" } }, "sha512-UxhIZQ+QInVdunkDAaiazvvT/+fXL5Osr0JZlJulepYu6Jd7qJtDZjlur0emRlT71EN3ScPoE7gvsuIKKNavKw=="],

    "uri-js": ["uri-js@4.4.1", "https://registry.npmjs.org/uri-js/-/uri-js-4.4.1.tgz", { "dependencies": { "punycode": "^2.1.0" } }, "sha512-7rKUyy33Q1yc98pQ1DAmLtwX109F7TIfWlW1Ydo8Wl1ii1SeHieeh0HHfPeL2fMXK6z0s8ecKs9frCuLJvndBg=="],

    "util-deprecate": ["util-deprecate@1.0.2", "https://registry.npmjs.org/util-deprecate/-/util-deprecate-1.0.2.tgz", {}, "sha512-EPD5q1uXyFxJpCrLnCc1nHnq3gOa6DZBocAIiI2TaSCA7VCJ1UJDMagCzIkXNsUYfD1daK//LTEQ8xiIbrHtcw=="],

    "v8-compile-cache": ["v8-compile-cache@2.3.0", "https://registry.npmjs.org/v8-compile-cache/-/v8-compile-cache-2.3.0.tgz", {}, "sha512-l8lCEmLcLYZh4nbunNZvQCJc5pv7+RCwa8q/LdUx8u7lsWvPDKmpodJAJNwkAhJC//dFY48KuIEmjtd4RViDrA=="],

    "v8-to-istanbul": ["v8-to-istanbul@9.3.0", "https://registry.npmjs.org/v8-to-istanbul/-/v8-to-istanbul-9.3.0.tgz", { "dependencies": { "@jridgewell/trace-mapping": "^0.3.12", "@types/istanbul-lib-coverage": "^2.0.1", "convert-source-map": "^2.0.0" } }, "sha512-kiGUalWN+rgBJ/1OHZsBtU4rXZOfj/7rKQxULKlIzwzQSvMJUUNgPwJEEh7gU6xEVxC0ahoOBvN2YI8GH6FNgA=="],

    "walker": ["walker@1.0.8", "https://registry.npmjs.org/walker/-/walker-1.0.8.tgz", { "dependencies": { "makeerror": "1.0.12" } }, "sha512-ts/8E8l5b7kY0vlWLewOkDXMmPdLcVV4GmOQLyxuSswIJsweeFZtAsMF7k1Nszz+TYBQrlYRmzOnr398y1JemQ=="],

    "which": ["which@2.0.2", "https://registry.npmjs.org/which/-/which-2.0.2.tgz", { "dependencies": { "isexe": "^2.0.0" }, "bin": { "node-which": "./bin/node-which" } }, "sha512-BLI3Tl1TW3Pvl70l3yq3Y64i+awpwXqsGBYWkkqMtnbXgrMD+yj7rhW0kuEDxzJaYXGjEW5ogapKNMEKNMjibA=="],

    "word-wrap": ["word-wrap@1.2.5", "https://registry.npmjs.org/word-wrap/-/word-wrap-1.2.5.tgz", {}, "sha512-BN22B5eaMMI9UMtjrGd5g5eCYPpCPDUy0FJXbYsaT5zYxjFOckS53SQDE3pWkVoWpHXVb3BrYcEN4Twa55B5cA=="],

    "wrap-ansi": ["wrap-ansi@7.0.0", "https://registry.npmjs.org/wrap-ansi/-/wrap-ansi-7.0.0.tgz", { "dependencies": { "ansi-styles": "^4.0.0", "string-width": "^4.1.0", "strip-ansi": "^6.0.0" } }, "sha512-YVGIj2kamLSTxw6NsZjoBxfSwsn0ycdesmc4p+Q21c5zPuZ1pl+NfxVdxPtdHvmNVOQ6XSYG4AUtyt/Fi7D16Q=="],

    "wrappy": ["wrappy@1.0.2", "https://registry.npmjs.org/wrappy/-/wrappy-1.0.2.tgz", {}, "sha512-l4Sp/DRseor9wL6EvV2+TuQn63dMkPjZ/sp9XkghTEbV9KlPS1xUsZ3u7/IQO4wxtcFB4bgpQPRcR3QCvezPcQ=="],

    "write-file-atomic": ["write-file-atomic@4.0.2", "https://registry.npmjs.org/write-file-atomic/-/write-file-atomic-4.0.2.tgz", { "dependencies": { "imurmurhash": "^0.1.4", "signal-exit": "^3.0.7" } }, "sha512-7KxauUdBmSdWnmpaGFg+ppNjKF8uNLry8LyzjauQDOVONfFLNKrKvQOxZ/VuTIcS/gge/YNahf5RIIQWTSarlg=="],

    "y18n": ["y18n@5.0.8", "https://registry.npmjs.org/y18n/-/y18n-5.0.8.tgz", {}, "sha512-0pfFzegeDWJHJIAmTLRP2DwHjdF5s7jo9tuztdQxAhINCdvS+3nGINqPd00AphqJR/0LhANUS6/+7SCb98YOfA=="],

    "yallist": ["yallist@3.1.1", "https://registry.npmjs.org/yallist/-/yallist-3.1.1.tgz", {}, "sha512-a4UGQaWPH59mOXUYnAG2ewncQS4i4F43Tv3JoAM+s2VDAmS9NsK8GpDMLrCHPksFT7h3K6TOoUNn2pb7RoXx4g=="],

    "yargs": ["yargs@17.6.2", "https://registry.npmjs.org/yargs/-/yargs-17.6.2.tgz", { "dependencies": { "cliui": "^8.0.1", "escalade": "^3.1.1", "get-caller-file": "^2.0.5", "require-directory": "^2.1.1", "string-width": "^4.2.3", "y18n": "^5.0.5", "yargs-parser": "^21.1.1" } }, "sha512-1/9UrdHjDZc0eOU0HxOHoS78C69UD3JRMvzlJ7S79S2nTaWRA/whGCTV8o9e/N/1Va9YIV7Q4sOxD8VV4pCWOw=="],

    "yargs-parser": ["yargs-parser@21.1.1", "https://registry.npmjs.org/yargs-parser/-/yargs-parser-21.1.1.tgz", {}, "sha512-tVpsJW7DdjecAiFpbIB1e3qxIQsE6NoPc5/eTdrbbIC4h0LVsWhnoa3g+m2HclBIujHzsxZ4VJVA+GUuc2/LBw=="],

    "yocto-queue": ["yocto-queue@0.1.0", "https://registry.npmjs.org/yocto-queue/-/yocto-queue-0.1.0.tgz", {}, "sha512-rVksvsnNCdJ/ohGc6xgPwyN8eheCxsiLM8mxuE/t/mOVqJewPuO1miLpTHQiRgTKCLexL4MeAFVagts7HmNZ2Q=="],

    "@eslint-community/eslint-utils/eslint-visitor-keys": ["eslint-visitor-keys@3.4.3", "https://registry.npmjs.org/eslint-visitor-keys/-/eslint-visitor-keys-3.4.3.tgz", {}, "sha512-wpc+LXeiyiisxPlEkUzU6svyS1frIO3Mgxj1fdy7Pm8Ygzguax2N3Fa/D/ag1WqbOprdI+uY6wMUl8/a2G+iag=="],

    "@eslint/eslintrc/minimatch": ["minimatch@3.1.2", "https://registry.npmjs.org/minimatch/-/minimatch-3.1.2.tgz", { "dependencies": { "brace-expansion": "^1.1.7" } }, "sha512-J7p63hRiAjw1NDEww1W7i37+ByIrOWO5XQQAzZ3VOcL0PNybwpfmV/N05zFAzwQ9USyEcX6t3UO+K5aqBQOIHw=="],

    "@humanwhocodes/config-array/minimatch": ["minimatch@3.1.2", "https://registry.npmjs.org/minimatch/-/minimatch-3.1.2.tgz", { "dependencies": { "brace-expansion": "^1.1.7" } }, "sha512-J7p63hRiAjw1NDEww1W7i37+ByIrOWO5XQQAzZ3VOcL0PNybwpfmV/N05zFAzwQ9USyEcX6t3UO+K5aqBQOIHw=="],

    "@istanbuljs/load-nyc-config/camelcase": ["camelcase@5.3.1", "https://registry.npmjs.org/camelcase/-/camelcase-5.3.1.tgz", {}, "sha512-L28STB170nwWS63UjtlEOE3dldQApaJXZkOI1uMFfzf3rRuPegHaHesyee+YxQ+W6SvRDQV6UrdOdRiR153wJg=="],

    "@istanbuljs/load-nyc-config/find-up": ["find-up@4.1.0", "https://registry.npmjs.org/find-up/-/find-up-4.1.0.tgz", { "dependencies": { "locate-path": "^5.0.0", "path-exists": "^4.0.0" } }, "sha512-PpOwAdQ/YlXQ2vj8a3h8IipDuYRi3wceVQQGYWxNINccq40Anw7BlsEXCMbt1Zt+OLA6Fq9suIpIWD0OsnISlw=="],

    "@istanbuljs/load-nyc-config/js-yaml": ["js-yaml@3.14.1", "https://registry.npmjs.org/js-yaml/-/js-yaml-3.14.1.tgz", { "dependencies": { "argparse": "^1.0.7", "esprima": "^4.0.0" }, "bin": { "js-yaml": "bin/js-yaml.js" } }, "sha512-okMH7OXXJ7YrN9Ok3/SXrnu4iX9yOk+25nqX4imS2npuvTYDmo/QEZoqwZkYaIDk3jVvBOTOIEgEhaLOynBS9g=="],

    "@nrwl/devkit/@phenomnomnominal/tsquery": ["@phenomnomnominal/tsquery@4.1.1", "https://registry.npmjs.org/@phenomnomnominal/tsquery/-/tsquery-4.1.1.tgz", { "dependencies": { "esquery": "^1.0.1" }, "peerDependencies": { "typescript": "^3 || ^4" } }, "sha512-jjMmK1tnZbm1Jq5a7fBliM4gQwjxMU7TFoRNwIyzwlO+eHPRCFv/Nv+H/Gi1jc3WR7QURG8D5d0Tn12YGrUqBQ=="],

    "@nrwl/devkit/semver": ["semver@7.3.4", "https://registry.npmjs.org/semver/-/semver-7.3.4.tgz", { "dependencies": { "lru-cache": "^6.0.0" }, "bin": { "semver": "bin/semver.js" } }, "sha512-tCfb2WLjqFAtXn4KEdxIhalnRtoKFN7nAwj0B3ZXCbQloV2tq5eDbcTmT68JJD3nRJq24/XgxtQKFIpQdtvmVw=="],

    "@nrwl/jest/@jest/reporters": ["@jest/reporters@28.1.1", "https://registry.npmjs.org/@jest/reporters/-/reporters-28.1.1.tgz", { "dependencies": { "@bcoe/v8-coverage": "^0.2.3", "@jest/console": "^28.1.1", "@jest/test-result": "^28.1.1", "@jest/transform": "^28.1.1", "@jest/types": "^28.1.1", "@jridgewell/trace-mapping": "^0.3.7", "@types/node": "*", "chalk": "^4.0.0", "collect-v8-coverage": "^1.0.0", "exit": "^0.1.2", "glob": "^7.1.3", "graceful-fs": "^4.2.9", "istanbul-lib-coverage": "^3.0.0", "istanbul-lib-instrument": "^5.1.0", "istanbul-lib-report": "^3.0.0", "istanbul-lib-source-maps": "^4.0.0", "istanbul-reports": "^3.1.3", "jest-message-util": "^28.1.1", "jest-util": "^28.1.1", "jest-worker": "^28.1.1", "slash": "^3.0.0", "string-length": "^4.0.1", "strip-ansi": "^6.0.0", "terminal-link": "^2.0.0", "v8-to-istanbul": "^9.0.0" }, "peerDependencies": { "node-notifier": "^8.0.1 || ^9.0.0 || ^10.0.0" }, "optionalPeers": ["node-notifier"] }, "sha512-597Zj4D4d88sZrzM4atEGLuO7SdA/YrOv9SRXHXRNC+/FwPCWxZhBAEzhXoiJzfRwn8zes/EjS8Lo6DouGN5Gg=="],

    "@nrwl/jest/@jest/test-result": ["@jest/test-result@28.1.1", "https://registry.npmjs.org/@jest/test-result/-/test-result-28.1.1.tgz", { "dependencies": { "@jest/console": "^28.1.1", "@jest/types": "^28.1.1", "@types/istanbul-lib-coverage": "^2.0.0", "collect-v8-coverage": "^1.0.0" } }, "sha512-hPmkugBktqL6rRzwWAtp1JtYT4VHwv8OQ+9lE5Gymj6dHzubI/oJHMUpPOt8NrdVWSrz9S7bHjJUmv2ggFoUNQ=="],

    "@nrwl/jest/@phenomnomnominal/tsquery": ["@phenomnomnominal/tsquery@4.1.1", "https://registry.npmjs.org/@phenomnomnominal/tsquery/-/tsquery-4.1.1.tgz", { "dependencies": { "esquery": "^1.0.1" }, "peerDependencies": { "typescript": "^3 || ^4" } }, "sha512-jjMmK1tnZbm1Jq5a7fBliM4gQwjxMU7TFoRNwIyzwlO+eHPRCFv/Nv+H/Gi1jc3WR7QURG8D5d0Tn12YGrUqBQ=="],

    "@nrwl/jest/chalk": ["chalk@4.1.0", "https://registry.npmjs.org/chalk/-/chalk-4.1.0.tgz", { "dependencies": { "ansi-styles": "^4.1.0", "supports-color": "^7.1.0" } }, "sha512-qwx12AxXe2Q5xQ43Ac//I6v5aXTipYrSESdOgzrN+9XjgEpyjpKuvSGaN4qE93f7TQTlerQQ8S+EQ0EyDoVL1A=="],

    "@nrwl/jest/jest-config": ["jest-config@28.1.1", "https://registry.npmjs.org/jest-config/-/jest-config-28.1.1.tgz", { "dependencies": { "@babel/core": "^7.11.6", "@jest/test-sequencer": "^28.1.1", "@jest/types": "^28.1.1", "babel-jest": "^28.1.1", "chalk": "^4.0.0", "ci-info": "^3.2.0", "deepmerge": "^4.2.2", "glob": "^7.1.3", "graceful-fs": "^4.2.9", "jest-circus": "^28.1.1", "jest-environment-node": "^28.1.1", "jest-get-type": "^28.0.2", "jest-regex-util": "^28.0.2", "jest-resolve": "^28.1.1", "jest-runner": "^28.1.1", "jest-util": "^28.1.1", "jest-validate": "^28.1.1", "micromatch": "^4.0.4", "parse-json": "^5.2.0", "pretty-format": "^28.1.1", "slash": "^3.0.0", "strip-json-comments": "^3.1.1" }, "peerDependencies": { "@types/node": "*", "ts-node": ">=9.0.0" }, "optionalPeers": ["@types/node", "ts-node"] }, "sha512-tASynMhS+jVV85zKvjfbJ8nUyJS/jUSYZ5KQxLUN2ZCvcQc/OmhQl2j6VEL3ezQkNofxn5pQ3SPYWPHb0unTZA=="],

    "@nrwl/jest/jest-resolve": ["jest-resolve@28.1.1", "https://registry.npmjs.org/jest-resolve/-/jest-resolve-28.1.1.tgz", { "dependencies": { "chalk": "^4.0.0", "graceful-fs": "^4.2.9", "jest-haste-map": "^28.1.1", "jest-pnp-resolver": "^1.2.2", "jest-util": "^28.1.1", "jest-validate": "^28.1.1", "resolve": "^1.20.0", "resolve.exports": "^1.1.0", "slash": "^3.0.0" } }, "sha512-/d1UbyUkf9nvsgdBildLe6LAD4DalgkgZcKd0nZ8XUGPyA/7fsnaQIlKVnDiuUXv/IeZhPEDrRJubVSulxrShA=="],

    "@nrwl/jest/jest-util": ["jest-util@28.1.1", "https://registry.npmjs.org/jest-util/-/jest-util-28.1.1.tgz", { "dependencies": { "@jest/types": "^28.1.1", "@types/node": "*", "chalk": "^4.0.0", "ci-info": "^3.2.0", "graceful-fs": "^4.2.9", "picomatch": "^2.2.3" } }, "sha512-FktOu7ca1DZSyhPAxgxB6hfh2+9zMoJ7aEQA759Z6p45NuO8mWcqujH+UdHlCm/V6JTWwDztM2ITCzU1ijJAfw=="],

    "@nrwl/linter/@phenomnomnominal/tsquery": ["@phenomnomnominal/tsquery@4.1.1", "https://registry.npmjs.org/@phenomnomnominal/tsquery/-/tsquery-4.1.1.tgz", { "dependencies": { "esquery": "^1.0.1" }, "peerDependencies": { "typescript": "^3 || ^4" } }, "sha512-jjMmK1tnZbm1Jq5a7fBliM4gQwjxMU7TFoRNwIyzwlO+eHPRCFv/Nv+H/Gi1jc3WR7QURG8D5d0Tn12YGrUqBQ=="],

    "@nrwl/workspace/chalk": ["chalk@4.1.0", "https://registry.npmjs.org/chalk/-/chalk-4.1.0.tgz", { "dependencies": { "ansi-styles": "^4.1.0", "supports-color": "^7.1.0" } }, "sha512-qwx12AxXe2Q5xQ43Ac//I6v5aXTipYrSESdOgzrN+9XjgEpyjpKuvSGaN4qE93f7TQTlerQQ8S+EQ0EyDoVL1A=="],

    "@nrwl/workspace/glob": ["glob@7.1.4", "https://registry.npmjs.org/glob/-/glob-7.1.4.tgz", { "dependencies": { "fs.realpath": "^1.0.0", "inflight": "^1.0.4", "inherits": "2", "minimatch": "^3.0.4", "once": "^1.3.0", "path-is-absolute": "^1.0.0" } }, "sha512-hkLPepehmnKk41pUGm3sYxoFs/umurYfYJCerbXEyFIWcAzvpipAgVkBqqT9RBKMGjnq6kMuyYwha6csxbiM1A=="],

    "@nrwl/workspace/semver": ["semver@7.3.4", "https://registry.npmjs.org/semver/-/semver-7.3.4.tgz", { "dependencies": { "lru-cache": "^6.0.0" }, "bin": { "semver": "bin/semver.js" } }, "sha512-tCfb2WLjqFAtXn4KEdxIhalnRtoKFN7nAwj0B3ZXCbQloV2tq5eDbcTmT68JJD3nRJq24/XgxtQKFIpQdtvmVw=="],

    "@yarnpkg/parsers/js-yaml": ["js-yaml@3.14.1", "https://registry.npmjs.org/js-yaml/-/js-yaml-3.14.1.tgz", { "dependencies": { "argparse": "^1.0.7", "esprima": "^4.0.0" }, "bin": { "js-yaml": "bin/js-yaml.js" } }, "sha512-okMH7OXXJ7YrN9Ok3/SXrnu4iX9yOk+25nqX4imS2npuvTYDmo/QEZoqwZkYaIDk3jVvBOTOIEgEhaLOynBS9g=="],

    "ansi-escapes/type-fest": ["type-fest@0.21.3", "https://registry.npmjs.org/type-fest/-/type-fest-0.21.3.tgz", {}, "sha512-t0rzBq87m3fVcduHDUFhKmyyX+9eo6WQjZvf51Ea/M0Q7+T374Jp1aUiyUl0GKxp8M/OETVHSDvmkyPgvX+X2w=="],

    "babel-plugin-istanbul/istanbul-lib-instrument": ["istanbul-lib-instrument@5.2.1", "https://registry.npmjs.org/istanbul-lib-instrument/-/istanbul-lib-instrument-5.2.1.tgz", { "dependencies": { "@babel/core": "^7.12.3", "@babel/parser": "^7.14.7", "@istanbuljs/schema": "^0.1.2", "istanbul-lib-coverage": "^3.2.0", "semver": "^6.3.0" } }, "sha512-pzqtp31nLv/XFOzXGuvhCb8qhjmTVo5vjVk19XE4CRlSWz0KoeJ3bw9XsA7nOp9YBf4qHjwBxkDzKcME/J29Yg=="],

    "chalk/supports-color": ["supports-color@7.2.0", "https://registry.npmjs.org/supports-color/-/supports-color-7.2.0.tgz", { "dependencies": { "has-flag": "^4.0.0" } }, "sha512-qpCAvRl9stuOHveKsn7HncJRvv501qIacKzQlO/+Lwxc9+0q2wLyv4Dfvt80/DPn2pqOBsJdDiogXGR9+OvwRw=="],

    "eslint/escape-string-regexp": ["escape-string-regexp@4.0.0", "https://registry.npmjs.org/escape-string-regexp/-/escape-string-regexp-4.0.0.tgz", {}, "sha512-TtpcNJ3XAzx3Gq8sWRzJaVajRs0uVxA2YAkdb1jm2YkPz4G6egUFAyA3n5vtEIZefPk5Wa4UXbKuS5fKkJWdgA=="],

    "eslint/eslint-visitor-keys": ["eslint-visitor-keys@3.4.3", "https://registry.npmjs.org/eslint-visitor-keys/-/eslint-visitor-keys-3.4.3.tgz", {}, "sha512-wpc+LXeiyiisxPlEkUzU6svyS1frIO3Mgxj1fdy7Pm8Ygzguax2N3Fa/D/ag1WqbOprdI+uY6wMUl8/a2G+iag=="],

    "eslint/glob-parent": ["glob-parent@6.0.2", "https://registry.npmjs.org/glob-parent/-/glob-parent-6.0.2.tgz", { "dependencies": { "is-glob": "^4.0.3" } }, "sha512-XxwI8EOhVQgWp6iDL+3b0r86f4d6AX6zSU55HfB4ydCEuXLXc5FcYeOu+nnGftS4TEju/11rt4KJPTMgbfmv4A=="],

    "eslint/minimatch": ["minimatch@3.1.2", "https://registry.npmjs.org/minimatch/-/minimatch-3.1.2.tgz", { "dependencies": { "brace-expansion": "^1.1.7" } }, "sha512-J7p63hRiAjw1NDEww1W7i37+ByIrOWO5XQQAzZ3VOcL0PNybwpfmV/N05zFAzwQ9USyEcX6t3UO+K5aqBQOIHw=="],

    "espree/eslint-visitor-keys": ["eslint-visitor-keys@3.4.3", "https://registry.npmjs.org/eslint-visitor-keys/-/eslint-visitor-keys-3.4.3.tgz", {}, "sha512-wpc+LXeiyiisxPlEkUzU6svyS1frIO3Mgxj1fdy7Pm8Ygzguax2N3Fa/D/ag1WqbOprdI+uY6wMUl8/a2G+iag=="],

    "filelist/minimatch": ["minimatch@5.1.6", "https://registry.npmjs.org/minimatch/-/minimatch-5.1.6.tgz", { "dependencies": { "brace-expansion": "^2.0.1" } }, "sha512-lKwV/1brpG6mBUFHtb7NUmtABCb2WZZmm2wNiOA5hAb8VdCS4B3dtMWyvcoViccwAW/COERjXLt0zP1zXUN26g=="],

    "glob/minimatch": ["minimatch@3.1.2", "https://registry.npmjs.org/minimatch/-/minimatch-3.1.2.tgz", { "dependencies": { "brace-expansion": "^1.1.7" } }, "sha512-J7p63hRiAjw1NDEww1W7i37+ByIrOWO5XQQAzZ3VOcL0PNybwpfmV/N05zFAzwQ9USyEcX6t3UO+K5aqBQOIHw=="],

    "import-fresh/resolve-from": ["resolve-from@4.0.0", "https://registry.npmjs.org/resolve-from/-/resolve-from-4.0.0.tgz", {}, "sha512-pb/MYmXstAkysRFx8piNI1tGFNQIFA3vkE3Gq4EuA1dF6gHp/+vgZqsCGJapvy8N3Q+4o7FwvquPJcnZ7RYy4g=="],

    "istanbul-lib-instrument/semver": ["semver@7.7.2", "https://registry.npmjs.org/semver/-/semver-7.7.2.tgz", { "bin": { "semver": "bin/semver.js" } }, "sha512-RF0Fw+rO5AMf9MAyaRXI4AV0Ulj5lMHqVxxdSgiVbixSCXoEmmX/jk0CuJw4+3SqroYO9VoUh+HcuJivvtJemA=="],

    "istanbul-lib-report/supports-color": ["supports-color@7.2.0", "https://registry.npmjs.org/supports-color/-/supports-color-7.2.0.tgz", { "dependencies": { "has-flag": "^4.0.0" } }, "sha512-qpCAvRl9stuOHveKsn7HncJRvv501qIacKzQlO/+Lwxc9+0q2wLyv4Dfvt80/DPn2pqOBsJdDiogXGR9+OvwRw=="],

    "jake/minimatch": ["minimatch@3.1.2", "https://registry.npmjs.org/minimatch/-/minimatch-3.1.2.tgz", { "dependencies": { "brace-expansion": "^1.1.7" } }, "sha512-J7p63hRiAjw1NDEww1W7i37+ByIrOWO5XQQAzZ3VOcL0PNybwpfmV/N05zFAzwQ9USyEcX6t3UO+K5aqBQOIHw=="],

    "jest-resolve/resolve.exports": ["resolve.exports@2.0.3", "https://registry.npmjs.org/resolve.exports/-/resolve.exports-2.0.3.tgz", {}, "sha512-OcXjMsGdhL4XnbShKpAcSqPMzQoYkYyhbEaeSko47MjRP9NfEQMhZkXL1DoFlt9LWQn4YttrdnV6X2OiyzBi+A=="],

    "jest-runtime/strip-bom": ["strip-bom@4.0.0", "https://registry.npmjs.org/strip-bom/-/strip-bom-4.0.0.tgz", {}, "sha512-3xurFv5tEgii33Zi8Jtp55wEIILR9eh34FAW00PZf+JnSsTmV/ioewSgQl97JHvgjoRGwPShsWm+IdrxB35d0w=="],

    "jest-snapshot/semver": ["semver@7.7.2", "https://registry.npmjs.org/semver/-/semver-7.7.2.tgz", { "bin": { "semver": "bin/semver.js" } }, "sha512-RF0Fw+rO5AMf9MAyaRXI4AV0Ulj5lMHqVxxdSgiVbixSCXoEmmX/jk0CuJw4+3SqroYO9VoUh+HcuJivvtJemA=="],

    "jest-worker/supports-color": ["supports-color@8.1.1", "https://registry.npmjs.org/supports-color/-/supports-color-8.1.1.tgz", { "dependencies": { "has-flag": "^4.0.0" } }, "sha512-MpUEN2OodtUzxvKQl72cUF7RQ5EiHsGvSsVG0ia9c5RbWGL2CI4C7EpPS8UTBIplnlzZiNuV56w+FuNxy3ty2Q=="],

    "make-dir/semver": ["semver@7.7.2", "https://registry.npmjs.org/semver/-/semver-7.7.2.tgz", { "bin": { "semver": "bin/semver.js" } }, "sha512-RF0Fw+rO5AMf9MAyaRXI4AV0Ulj5lMHqVxxdSgiVbixSCXoEmmX/jk0CuJw4+3SqroYO9VoUh+HcuJivvtJemA=="],

    "nx/chalk": ["chalk@4.1.0", "https://registry.npmjs.org/chalk/-/chalk-4.1.0.tgz", { "dependencies": { "ansi-styles": "^4.1.0", "supports-color": "^7.1.0" } }, "sha512-qwx12AxXe2Q5xQ43Ac//I6v5aXTipYrSESdOgzrN+9XjgEpyjpKuvSGaN4qE93f7TQTlerQQ8S+EQ0EyDoVL1A=="],

    "nx/glob": ["glob@7.1.4", "https://registry.npmjs.org/glob/-/glob-7.1.4.tgz", { "dependencies": { "fs.realpath": "^1.0.0", "inflight": "^1.0.4", "inherits": "2", "minimatch": "^3.0.4", "once": "^1.3.0", "path-is-absolute": "^1.0.0" } }, "sha512-hkLPepehmnKk41pUGm3sYxoFs/umurYfYJCerbXEyFIWcAzvpipAgVkBqqT9RBKMGjnq6kMuyYwha6csxbiM1A=="],

    "nx/semver": ["semver@7.3.4", "https://registry.npmjs.org/semver/-/semver-7.3.4.tgz", { "dependencies": { "lru-cache": "^6.0.0" }, "bin": { "semver": "bin/semver.js" } }, "sha512-tCfb2WLjqFAtXn4KEdxIhalnRtoKFN7nAwj0B3ZXCbQloV2tq5eDbcTmT68JJD3nRJq24/XgxtQKFIpQdtvmVw=="],

    "pkg-dir/find-up": ["find-up@4.1.0", "https://registry.npmjs.org/find-up/-/find-up-4.1.0.tgz", { "dependencies": { "locate-path": "^5.0.0", "path-exists": "^4.0.0" } }, "sha512-PpOwAdQ/YlXQ2vj8a3h8IipDuYRi3wceVQQGYWxNINccq40Anw7BlsEXCMbt1Zt+OLA6Fq9suIpIWD0OsnISlw=="],

    "pretty-format/ansi-styles": ["ansi-styles@5.2.0", "https://registry.npmjs.org/ansi-styles/-/ansi-styles-5.2.0.tgz", {}, "sha512-Cxwpt2SfTzTtXcfOlzGEee8O+c+MmUgGrNiBcXnuWxuFJHe6a5Hz7qwhwe5OgaSYI0IJvkLqWX1ASG+cJOkEiA=="],

    "regjsparser/jsesc": ["jsesc@3.0.2", "https://registry.npmjs.org/jsesc/-/jsesc-3.0.2.tgz", { "bin": { "jsesc": "bin/jsesc" } }, "sha512-xKqzzWXDttJuOcawBt4KnKHHIf5oQ/Cxax+0PWFG+DFDgHNAdi+TXECADI+RYiFUMmx8792xsMbbgXj4CwnP4g=="],

    "rxjs/tslib": ["tslib@1.14.1", "https://registry.npmjs.org/tslib/-/tslib-1.14.1.tgz", {}, "sha512-Xni35NKzjgMrwevysHTCArtLDpPvye8zV/0E4EyYn43P7/7qvQwPh9BGkHewbMulVntbigmcT7rdX3BNo9wRJg=="],

    "stack-utils/escape-string-regexp": ["escape-string-regexp@2.0.0", "https://registry.npmjs.org/escape-string-regexp/-/escape-string-regexp-2.0.0.tgz", {}, "sha512-UpzcLCXolUWcNu5HtVMHYdXJjArjsF9C0aNnquZYY4uW/Vu0miy5YoWvbV345HauVvcAUnpRuhMMcqTcGOY2+w=="],

    "supports-hyperlinks/supports-color": ["supports-color@7.2.0", "https://registry.npmjs.org/supports-color/-/supports-color-7.2.0.tgz", { "dependencies": { "has-flag": "^4.0.0" } }, "sha512-qpCAvRl9stuOHveKsn7HncJRvv501qIacKzQlO/+Lwxc9+0q2wLyv4Dfvt80/DPn2pqOBsJdDiogXGR9+OvwRw=="],

    "test-exclude/minimatch": ["minimatch@3.1.2", "https://registry.npmjs.org/minimatch/-/minimatch-3.1.2.tgz", { "dependencies": { "brace-expansion": "^1.1.7" } }, "sha512-J7p63hRiAjw1NDEww1W7i37+ByIrOWO5XQQAzZ3VOcL0PNybwpfmV/N05zFAzwQ9USyEcX6t3UO+K5aqBQOIHw=="],

    "tsconfig-paths/json5": ["json5@1.0.2", "https://registry.npmjs.org/json5/-/json5-1.0.2.tgz", { "dependencies": { "minimist": "^1.2.0" }, "bin": { "json5": "lib/cli.js" } }, "sha512-g1MWMLBiz8FKi1e4w0UyVL3w+iJceWAFBAaBnnGKOpNa5f8TLktkbre1+s6oICydWAm+HRUGTmI+//xv2hvXYA=="],

    "yargs/cliui": ["cliui@8.0.1", "https://registry.npmjs.org/cliui/-/cliui-8.0.1.tgz", { "dependencies": { "string-width": "^4.2.0", "strip-ansi": "^6.0.1", "wrap-ansi": "^7.0.0" } }, "sha512-BSeNnyus75C4//NQ9gQt1/csTXyo/8Sb+afLAkzAptFuMsod9HFokGNudZpi/oQV73hnVK+sR+5PVRMd+Dr7YQ=="],

    "@istanbuljs/load-nyc-config/find-up/locate-path": ["locate-path@5.0.0", "https://registry.npmjs.org/locate-path/-/locate-path-5.0.0.tgz", { "dependencies": { "p-locate": "^4.1.0" } }, "sha512-t7hw9pI+WvuwNJXwk5zVHpyhIqzg2qTlklJOf0mVxGSbe3Fp2VieZcduNYjaLDoy6p9uGpQEGWG87WpMKlNq8g=="],

    "@istanbuljs/load-nyc-config/js-yaml/argparse": ["argparse@1.0.10", "https://registry.npmjs.org/argparse/-/argparse-1.0.10.tgz", { "dependencies": { "sprintf-js": "~1.0.2" } }, "sha512-o5Roy6tNG4SL/FOkCAN6RzjiakZS25RLYFrcMttJqbdd8BWrnA+fGz57iN5Pb06pvBGvl5gQ0B48dJlslXvoTg=="],

    "@nrwl/devkit/semver/lru-cache": ["lru-cache@6.0.0", "https://registry.npmjs.org/lru-cache/-/lru-cache-6.0.0.tgz", { "dependencies": { "yallist": "^4.0.0" } }, "sha512-Jo6dJ04CmSjuznwJSS3pUeWmd/H0ffTlkXXgwZi+eq1UCmqQwCh+eLsYOYCwY991i2Fah4h1BEMCx4qThGbsiA=="],

    "@nrwl/jest/@jest/reporters/@jest/console": ["@jest/console@28.1.3", "https://registry.npmjs.org/@jest/console/-/console-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@types/node": "*", "chalk": "^4.0.0", "jest-message-util": "^28.1.3", "jest-util": "^28.1.3", "slash": "^3.0.0" } }, "sha512-QPAkP5EwKdK/bxIr6C1I4Vs0rm2nHiANzj/Z5X2JQkrZo6IqvC4ldZ9K95tF0HdidhA8Bo6egxSzUFPYKcEXLw=="],

    "@nrwl/jest/@jest/reporters/@jest/transform": ["@jest/transform@28.1.3", "https://registry.npmjs.org/@jest/transform/-/transform-28.1.3.tgz", { "dependencies": { "@babel/core": "^7.11.6", "@jest/types": "^28.1.3", "@jridgewell/trace-mapping": "^0.3.13", "babel-plugin-istanbul": "^6.1.1", "chalk": "^4.0.0", "convert-source-map": "^1.4.0", "fast-json-stable-stringify": "^2.0.0", "graceful-fs": "^4.2.9", "jest-haste-map": "^28.1.3", "jest-regex-util": "^28.0.2", "jest-util": "^28.1.3", "micromatch": "^4.0.4", "pirates": "^4.0.4", "slash": "^3.0.0", "write-file-atomic": "^4.0.1" } }, "sha512-u5dT5di+oFI6hfcLOHGTAfmUxFRrjK+vnaP0kkVow9Md/M7V/MxqQMOz/VV25UZO8pzeA9PjfTpOu6BDuwSPQA=="],

    "@nrwl/jest/@jest/reporters/@jest/types": ["@jest/types@28.1.3", "https://registry.npmjs.org/@jest/types/-/types-28.1.3.tgz", { "dependencies": { "@jest/schemas": "^28.1.3", "@types/istanbul-lib-coverage": "^2.0.0", "@types/istanbul-reports": "^3.0.0", "@types/node": "*", "@types/yargs": "^17.0.8", "chalk": "^4.0.0" } }, "sha512-RyjiyMUZrKz/c+zlMFO1pm70DcIlST8AeWTkoUdZevew44wcNZQHsEVOiCVtgVnlFFD82FPaXycys58cf2muVQ=="],

    "@nrwl/jest/@jest/reporters/chalk": ["chalk@4.1.2", "https://registry.npmjs.org/chalk/-/chalk-4.1.2.tgz", { "dependencies": { "ansi-styles": "^4.1.0", "supports-color": "^7.1.0" } }, "sha512-oKnbhFyRIXpUuez8iBMmyEa4nbj4IOQyuhc/wy9kY7/WVPcwIO9VA668Pu8RkO7+0G76SLROeyw9CpQ061i4mA=="],

    "@nrwl/jest/@jest/reporters/istanbul-lib-instrument": ["istanbul-lib-instrument@5.2.1", "https://registry.npmjs.org/istanbul-lib-instrument/-/istanbul-lib-instrument-5.2.1.tgz", { "dependencies": { "@babel/core": "^7.12.3", "@babel/parser": "^7.14.7", "@istanbuljs/schema": "^0.1.2", "istanbul-lib-coverage": "^3.2.0", "semver": "^6.3.0" } }, "sha512-pzqtp31nLv/XFOzXGuvhCb8qhjmTVo5vjVk19XE4CRlSWz0KoeJ3bw9XsA7nOp9YBf4qHjwBxkDzKcME/J29Yg=="],

    "@nrwl/jest/@jest/reporters/jest-message-util": ["jest-message-util@28.1.3", "https://registry.npmjs.org/jest-message-util/-/jest-message-util-28.1.3.tgz", { "dependencies": { "@babel/code-frame": "^7.12.13", "@jest/types": "^28.1.3", "@types/stack-utils": "^2.0.0", "chalk": "^4.0.0", "graceful-fs": "^4.2.9", "micromatch": "^4.0.4", "pretty-format": "^28.1.3", "slash": "^3.0.0", "stack-utils": "^2.0.3" } }, "sha512-PFdn9Iewbt575zKPf1286Ht9EPoJmYT7P0kY+RibeYZ2XtOr53pDLEFoTWXbd1h4JiGiWpTBC84fc8xMXQMb7g=="],

    "@nrwl/jest/@jest/reporters/jest-worker": ["jest-worker@28.1.3", "https://registry.npmjs.org/jest-worker/-/jest-worker-28.1.3.tgz", { "dependencies": { "@types/node": "*", "merge-stream": "^2.0.0", "supports-color": "^8.0.0" } }, "sha512-CqRA220YV/6jCo8VWvAt1KKx6eek1VIHMPeLEbpcfSfkEeWyBNppynM/o6q+Wmw+sOhos2ml34wZbSX3G13//g=="],

    "@nrwl/jest/@jest/test-result/@jest/console": ["@jest/console@28.1.3", "https://registry.npmjs.org/@jest/console/-/console-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@types/node": "*", "chalk": "^4.0.0", "jest-message-util": "^28.1.3", "jest-util": "^28.1.3", "slash": "^3.0.0" } }, "sha512-QPAkP5EwKdK/bxIr6C1I4Vs0rm2nHiANzj/Z5X2JQkrZo6IqvC4ldZ9K95tF0HdidhA8Bo6egxSzUFPYKcEXLw=="],

    "@nrwl/jest/@jest/test-result/@jest/types": ["@jest/types@28.1.3", "https://registry.npmjs.org/@jest/types/-/types-28.1.3.tgz", { "dependencies": { "@jest/schemas": "^28.1.3", "@types/istanbul-lib-coverage": "^2.0.0", "@types/istanbul-reports": "^3.0.0", "@types/node": "*", "@types/yargs": "^17.0.8", "chalk": "^4.0.0" } }, "sha512-RyjiyMUZrKz/c+zlMFO1pm70DcIlST8AeWTkoUdZevew44wcNZQHsEVOiCVtgVnlFFD82FPaXycys58cf2muVQ=="],

    "@nrwl/jest/chalk/supports-color": ["supports-color@7.2.0", "https://registry.npmjs.org/supports-color/-/supports-color-7.2.0.tgz", { "dependencies": { "has-flag": "^4.0.0" } }, "sha512-qpCAvRl9stuOHveKsn7HncJRvv501qIacKzQlO/+Lwxc9+0q2wLyv4Dfvt80/DPn2pqOBsJdDiogXGR9+OvwRw=="],

    "@nrwl/jest/jest-config/@jest/test-sequencer": ["@jest/test-sequencer@28.1.3", "https://registry.npmjs.org/@jest/test-sequencer/-/test-sequencer-28.1.3.tgz", { "dependencies": { "@jest/test-result": "^28.1.3", "graceful-fs": "^4.2.9", "jest-haste-map": "^28.1.3", "slash": "^3.0.0" } }, "sha512-NIMPEqqa59MWnDi1kvXXpYbqsfQmSJsIbnd85mdVGkiDfQ9WQQTXOLsvISUfonmnBT+w85WEgneCigEEdHDFxw=="],

    "@nrwl/jest/jest-config/@jest/types": ["@jest/types@28.1.3", "https://registry.npmjs.org/@jest/types/-/types-28.1.3.tgz", { "dependencies": { "@jest/schemas": "^28.1.3", "@types/istanbul-lib-coverage": "^2.0.0", "@types/istanbul-reports": "^3.0.0", "@types/node": "*", "@types/yargs": "^17.0.8", "chalk": "^4.0.0" } }, "sha512-RyjiyMUZrKz/c+zlMFO1pm70DcIlST8AeWTkoUdZevew44wcNZQHsEVOiCVtgVnlFFD82FPaXycys58cf2muVQ=="],

    "@nrwl/jest/jest-config/babel-jest": ["babel-jest@28.1.3", "https://registry.npmjs.org/babel-jest/-/babel-jest-28.1.3.tgz", { "dependencies": { "@jest/transform": "^28.1.3", "@types/babel__core": "^7.1.14", "babel-plugin-istanbul": "^6.1.1", "babel-preset-jest": "^28.1.3", "chalk": "^4.0.0", "graceful-fs": "^4.2.9", "slash": "^3.0.0" }, "peerDependencies": { "@babel/core": "^7.8.0" } }, "sha512-epUaPOEWMk3cWX0M/sPvCHHCe9fMFAa/9hXEgKP8nFfNl/jlGkE9ucq9NqkZGXLDduCJYS0UvSlPUwC0S+rH6Q=="],

    "@nrwl/jest/jest-config/chalk": ["chalk@4.1.2", "https://registry.npmjs.org/chalk/-/chalk-4.1.2.tgz", { "dependencies": { "ansi-styles": "^4.1.0", "supports-color": "^7.1.0" } }, "sha512-oKnbhFyRIXpUuez8iBMmyEa4nbj4IOQyuhc/wy9kY7/WVPcwIO9VA668Pu8RkO7+0G76SLROeyw9CpQ061i4mA=="],

    "@nrwl/jest/jest-config/jest-circus": ["jest-circus@28.1.3", "https://registry.npmjs.org/jest-circus/-/jest-circus-28.1.3.tgz", { "dependencies": { "@jest/environment": "^28.1.3", "@jest/expect": "^28.1.3", "@jest/test-result": "^28.1.3", "@jest/types": "^28.1.3", "@types/node": "*", "chalk": "^4.0.0", "co": "^4.6.0", "dedent": "^0.7.0", "is-generator-fn": "^2.0.0", "jest-each": "^28.1.3", "jest-matcher-utils": "^28.1.3", "jest-message-util": "^28.1.3", "jest-runtime": "^28.1.3", "jest-snapshot": "^28.1.3", "jest-util": "^28.1.3", "p-limit": "^3.1.0", "pretty-format": "^28.1.3", "slash": "^3.0.0", "stack-utils": "^2.0.3" } }, "sha512-cZ+eS5zc79MBwt+IhQhiEp0OeBddpc1n8MBo1nMB8A7oPMKEO+Sre+wHaLJexQUj9Ya/8NOBY0RESUgYjB6fow=="],

    "@nrwl/jest/jest-config/jest-environment-node": ["jest-environment-node@28.1.3", "https://registry.npmjs.org/jest-environment-node/-/jest-environment-node-28.1.3.tgz", { "dependencies": { "@jest/environment": "^28.1.3", "@jest/fake-timers": "^28.1.3", "@jest/types": "^28.1.3", "@types/node": "*", "jest-mock": "^28.1.3", "jest-util": "^28.1.3" } }, "sha512-ugP6XOhEpjAEhGYvp5Xj989ns5cB1K6ZdjBYuS30umT4CQEETaxSiPcZ/E1kFktX4GkrcM4qu07IIlDYX1gp+A=="],

    "@nrwl/jest/jest-config/jest-get-type": ["jest-get-type@28.0.2", "https://registry.npmjs.org/jest-get-type/-/jest-get-type-28.0.2.tgz", {}, "sha512-ioj2w9/DxSYHfOm5lJKCdcAmPJzQXmbM/Url3rhlghrPvT3tt+7a/+oXc9azkKmLvoiXjtV83bEWqi+vs5nlPA=="],

    "@nrwl/jest/jest-config/jest-regex-util": ["jest-regex-util@28.0.2", "https://registry.npmjs.org/jest-regex-util/-/jest-regex-util-28.0.2.tgz", {}, "sha512-4s0IgyNIy0y9FK+cjoVYoxamT7Zeo7MhzqRGx7YDYmaQn1wucY9rotiGkBzzcMXTtjrCAP/f7f+E0F7+fxPNdw=="],

    "@nrwl/jest/jest-config/jest-runner": ["jest-runner@28.1.3", "https://registry.npmjs.org/jest-runner/-/jest-runner-28.1.3.tgz", { "dependencies": { "@jest/console": "^28.1.3", "@jest/environment": "^28.1.3", "@jest/test-result": "^28.1.3", "@jest/transform": "^28.1.3", "@jest/types": "^28.1.3", "@types/node": "*", "chalk": "^4.0.0", "emittery": "^0.10.2", "graceful-fs": "^4.2.9", "jest-docblock": "^28.1.1", "jest-environment-node": "^28.1.3", "jest-haste-map": "^28.1.3", "jest-leak-detector": "^28.1.3", "jest-message-util": "^28.1.3", "jest-resolve": "^28.1.3", "jest-runtime": "^28.1.3", "jest-util": "^28.1.3", "jest-watcher": "^28.1.3", "jest-worker": "^28.1.3", "p-limit": "^3.1.0", "source-map-support": "0.5.13" } }, "sha512-GkMw4D/0USd62OVO0oEgjn23TM+YJa2U2Wu5zz9xsQB1MxWKDOlrnykPxnMsN0tnJllfLPinHTka61u0QhaxBA=="],

    "@nrwl/jest/jest-config/jest-validate": ["jest-validate@28.1.3", "https://registry.npmjs.org/jest-validate/-/jest-validate-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "camelcase": "^6.2.0", "chalk": "^4.0.0", "jest-get-type": "^28.0.2", "leven": "^3.1.0", "pretty-format": "^28.1.3" } }, "sha512-SZbOGBWEsaTxBGCOpsRWlXlvNkvTkY0XxRfh7zYmvd8uL5Qzyg0CHAXiXKROflh801quA6+/DsT4ODDthOC/OA=="],

    "@nrwl/jest/jest-config/pretty-format": ["pretty-format@28.1.3", "https://registry.npmjs.org/pretty-format/-/pretty-format-28.1.3.tgz", { "dependencies": { "@jest/schemas": "^28.1.3", "ansi-regex": "^5.0.1", "ansi-styles": "^5.0.0", "react-is": "^18.0.0" } }, "sha512-8gFb/To0OmxHR9+ZTb14Df2vNxdGCX8g1xWGUTqUw5TiZvcQf5sHKObd5UcPyLLyowNwDAMTF3XWOG1B6mxl1Q=="],

    "@nrwl/jest/jest-resolve/chalk": ["chalk@4.1.2", "https://registry.npmjs.org/chalk/-/chalk-4.1.2.tgz", { "dependencies": { "ansi-styles": "^4.1.0", "supports-color": "^7.1.0" } }, "sha512-oKnbhFyRIXpUuez8iBMmyEa4nbj4IOQyuhc/wy9kY7/WVPcwIO9VA668Pu8RkO7+0G76SLROeyw9CpQ061i4mA=="],

    "@nrwl/jest/jest-resolve/jest-haste-map": ["jest-haste-map@28.1.3", "https://registry.npmjs.org/jest-haste-map/-/jest-haste-map-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@types/graceful-fs": "^4.1.3", "@types/node": "*", "anymatch": "^3.0.3", "fb-watchman": "^2.0.0", "graceful-fs": "^4.2.9", "jest-regex-util": "^28.0.2", "jest-util": "^28.1.3", "jest-worker": "^28.1.3", "micromatch": "^4.0.4", "walker": "^1.0.8" }, "optionalDependencies": { "fsevents": "^2.3.2" } }, "sha512-3S+RQWDXccXDKSWnkHa/dPwt+2qwA8CJzR61w3FoYCvoo3Pn8tvGcysmMF0Bj0EX5RYvAI2EIvC57OmotfdtKA=="],

    "@nrwl/jest/jest-resolve/jest-validate": ["jest-validate@28.1.3", "https://registry.npmjs.org/jest-validate/-/jest-validate-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "camelcase": "^6.2.0", "chalk": "^4.0.0", "jest-get-type": "^28.0.2", "leven": "^3.1.0", "pretty-format": "^28.1.3" } }, "sha512-SZbOGBWEsaTxBGCOpsRWlXlvNkvTkY0XxRfh7zYmvd8uL5Qzyg0CHAXiXKROflh801quA6+/DsT4ODDthOC/OA=="],

    "@nrwl/jest/jest-util/@jest/types": ["@jest/types@28.1.3", "https://registry.npmjs.org/@jest/types/-/types-28.1.3.tgz", { "dependencies": { "@jest/schemas": "^28.1.3", "@types/istanbul-lib-coverage": "^2.0.0", "@types/istanbul-reports": "^3.0.0", "@types/node": "*", "@types/yargs": "^17.0.8", "chalk": "^4.0.0" } }, "sha512-RyjiyMUZrKz/c+zlMFO1pm70DcIlST8AeWTkoUdZevew44wcNZQHsEVOiCVtgVnlFFD82FPaXycys58cf2muVQ=="],

    "@nrwl/jest/jest-util/chalk": ["chalk@4.1.2", "https://registry.npmjs.org/chalk/-/chalk-4.1.2.tgz", { "dependencies": { "ansi-styles": "^4.1.0", "supports-color": "^7.1.0" } }, "sha512-oKnbhFyRIXpUuez8iBMmyEa4nbj4IOQyuhc/wy9kY7/WVPcwIO9VA668Pu8RkO7+0G76SLROeyw9CpQ061i4mA=="],

    "@nrwl/workspace/chalk/supports-color": ["supports-color@7.2.0", "https://registry.npmjs.org/supports-color/-/supports-color-7.2.0.tgz", { "dependencies": { "has-flag": "^4.0.0" } }, "sha512-qpCAvRl9stuOHveKsn7HncJRvv501qIacKzQlO/+Lwxc9+0q2wLyv4Dfvt80/DPn2pqOBsJdDiogXGR9+OvwRw=="],

    "@nrwl/workspace/glob/minimatch": ["minimatch@3.1.2", "https://registry.npmjs.org/minimatch/-/minimatch-3.1.2.tgz", { "dependencies": { "brace-expansion": "^1.1.7" } }, "sha512-J7p63hRiAjw1NDEww1W7i37+ByIrOWO5XQQAzZ3VOcL0PNybwpfmV/N05zFAzwQ9USyEcX6t3UO+K5aqBQOIHw=="],

    "@nrwl/workspace/semver/lru-cache": ["lru-cache@6.0.0", "https://registry.npmjs.org/lru-cache/-/lru-cache-6.0.0.tgz", { "dependencies": { "yallist": "^4.0.0" } }, "sha512-Jo6dJ04CmSjuznwJSS3pUeWmd/H0ffTlkXXgwZi+eq1UCmqQwCh+eLsYOYCwY991i2Fah4h1BEMCx4qThGbsiA=="],

    "@yarnpkg/parsers/js-yaml/argparse": ["argparse@1.0.10", "https://registry.npmjs.org/argparse/-/argparse-1.0.10.tgz", { "dependencies": { "sprintf-js": "~1.0.2" } }, "sha512-o5Roy6tNG4SL/FOkCAN6RzjiakZS25RLYFrcMttJqbdd8BWrnA+fGz57iN5Pb06pvBGvl5gQ0B48dJlslXvoTg=="],

    "filelist/minimatch/brace-expansion": ["brace-expansion@2.0.2", "https://registry.npmjs.org/brace-expansion/-/brace-expansion-2.0.2.tgz", { "dependencies": { "balanced-match": "^1.0.0" } }, "sha512-Jt0vHyM+jmUBqojB7E1NIYadt0vI0Qxjxd2TErW94wDz+E2LAm5vKMXXwg6ZZBTHPuUlDgQHKXvjGBdfcF1ZDQ=="],

    "nx/chalk/supports-color": ["supports-color@7.2.0", "https://registry.npmjs.org/supports-color/-/supports-color-7.2.0.tgz", { "dependencies": { "has-flag": "^4.0.0" } }, "sha512-qpCAvRl9stuOHveKsn7HncJRvv501qIacKzQlO/+Lwxc9+0q2wLyv4Dfvt80/DPn2pqOBsJdDiogXGR9+OvwRw=="],

    "nx/glob/minimatch": ["minimatch@3.1.2", "https://registry.npmjs.org/minimatch/-/minimatch-3.1.2.tgz", { "dependencies": { "brace-expansion": "^1.1.7" } }, "sha512-J7p63hRiAjw1NDEww1W7i37+ByIrOWO5XQQAzZ3VOcL0PNybwpfmV/N05zFAzwQ9USyEcX6t3UO+K5aqBQOIHw=="],

    "nx/semver/lru-cache": ["lru-cache@6.0.0", "https://registry.npmjs.org/lru-cache/-/lru-cache-6.0.0.tgz", { "dependencies": { "yallist": "^4.0.0" } }, "sha512-Jo6dJ04CmSjuznwJSS3pUeWmd/H0ffTlkXXgwZi+eq1UCmqQwCh+eLsYOYCwY991i2Fah4h1BEMCx4qThGbsiA=="],

    "pkg-dir/find-up/locate-path": ["locate-path@5.0.0", "https://registry.npmjs.org/locate-path/-/locate-path-5.0.0.tgz", { "dependencies": { "p-locate": "^4.1.0" } }, "sha512-t7hw9pI+WvuwNJXwk5zVHpyhIqzg2qTlklJOf0mVxGSbe3Fp2VieZcduNYjaLDoy6p9uGpQEGWG87WpMKlNq8g=="],

    "@istanbuljs/load-nyc-config/find-up/locate-path/p-locate": ["p-locate@4.1.0", "https://registry.npmjs.org/p-locate/-/p-locate-4.1.0.tgz", { "dependencies": { "p-limit": "^2.2.0" } }, "sha512-R79ZZ/0wAxKGu3oYMlz8jy/kbhsNrS7SKZ7PxEHBgJ5+F2mtFW2fK2cOtBh1cHYkQsbzFV7I+EoRKe6Yt0oK7A=="],

    "@nrwl/devkit/semver/lru-cache/yallist": ["yallist@4.0.0", "https://registry.npmjs.org/yallist/-/yallist-4.0.0.tgz", {}, "sha512-3wdGidZyq5PB084XLES5TpOSRA3wjXAlIWMhum2kRcv/41Sn2emQ0dycQW4uZXLejwKvg6EsvbdlVL+FYEct7A=="],

    "@nrwl/jest/@jest/reporters/@jest/console/jest-util": ["jest-util@28.1.3", "https://registry.npmjs.org/jest-util/-/jest-util-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@types/node": "*", "chalk": "^4.0.0", "ci-info": "^3.2.0", "graceful-fs": "^4.2.9", "picomatch": "^2.2.3" } }, "sha512-XdqfpHwpcSRko/C35uLYFM2emRAltIIKZiJ9eAmhjsj0CqZMa0p1ib0R5fWIqGhn1a103DebTbpqIaP1qCQ6tQ=="],

    "@nrwl/jest/@jest/reporters/@jest/transform/convert-source-map": ["convert-source-map@1.9.0", "https://registry.npmjs.org/convert-source-map/-/convert-source-map-1.9.0.tgz", {}, "sha512-ASFBup0Mz1uyiIjANan1jzLQami9z1PoYSZCiiYW2FczPbenXc45FZdBZLzOT+r6+iciuEModtmCti+hjaAk0A=="],

    "@nrwl/jest/@jest/reporters/@jest/transform/jest-haste-map": ["jest-haste-map@28.1.3", "https://registry.npmjs.org/jest-haste-map/-/jest-haste-map-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@types/graceful-fs": "^4.1.3", "@types/node": "*", "anymatch": "^3.0.3", "fb-watchman": "^2.0.0", "graceful-fs": "^4.2.9", "jest-regex-util": "^28.0.2", "jest-util": "^28.1.3", "jest-worker": "^28.1.3", "micromatch": "^4.0.4", "walker": "^1.0.8" }, "optionalDependencies": { "fsevents": "^2.3.2" } }, "sha512-3S+RQWDXccXDKSWnkHa/dPwt+2qwA8CJzR61w3FoYCvoo3Pn8tvGcysmMF0Bj0EX5RYvAI2EIvC57OmotfdtKA=="],

    "@nrwl/jest/@jest/reporters/@jest/transform/jest-regex-util": ["jest-regex-util@28.0.2", "https://registry.npmjs.org/jest-regex-util/-/jest-regex-util-28.0.2.tgz", {}, "sha512-4s0IgyNIy0y9FK+cjoVYoxamT7Zeo7MhzqRGx7YDYmaQn1wucY9rotiGkBzzcMXTtjrCAP/f7f+E0F7+fxPNdw=="],

    "@nrwl/jest/@jest/reporters/@jest/transform/jest-util": ["jest-util@28.1.3", "https://registry.npmjs.org/jest-util/-/jest-util-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@types/node": "*", "chalk": "^4.0.0", "ci-info": "^3.2.0", "graceful-fs": "^4.2.9", "picomatch": "^2.2.3" } }, "sha512-XdqfpHwpcSRko/C35uLYFM2emRAltIIKZiJ9eAmhjsj0CqZMa0p1ib0R5fWIqGhn1a103DebTbpqIaP1qCQ6tQ=="],

    "@nrwl/jest/@jest/reporters/@jest/types/@jest/schemas": ["@jest/schemas@28.1.3", "https://registry.npmjs.org/@jest/schemas/-/schemas-28.1.3.tgz", { "dependencies": { "@sinclair/typebox": "^0.24.1" } }, "sha512-/l/VWsdt/aBXgjshLWOFyFt3IVdYypu5y2Wn2rOO1un6nkqIn8SLXzgIMYXFyYsRWDyF5EthmKJMIdJvk08grg=="],

    "@nrwl/jest/@jest/reporters/chalk/supports-color": ["supports-color@7.2.0", "https://registry.npmjs.org/supports-color/-/supports-color-7.2.0.tgz", { "dependencies": { "has-flag": "^4.0.0" } }, "sha512-qpCAvRl9stuOHveKsn7HncJRvv501qIacKzQlO/+Lwxc9+0q2wLyv4Dfvt80/DPn2pqOBsJdDiogXGR9+OvwRw=="],

    "@nrwl/jest/@jest/reporters/jest-message-util/pretty-format": ["pretty-format@28.1.3", "https://registry.npmjs.org/pretty-format/-/pretty-format-28.1.3.tgz", { "dependencies": { "@jest/schemas": "^28.1.3", "ansi-regex": "^5.0.1", "ansi-styles": "^5.0.0", "react-is": "^18.0.0" } }, "sha512-8gFb/To0OmxHR9+ZTb14Df2vNxdGCX8g1xWGUTqUw5TiZvcQf5sHKObd5UcPyLLyowNwDAMTF3XWOG1B6mxl1Q=="],

    "@nrwl/jest/@jest/reporters/jest-worker/supports-color": ["supports-color@8.1.1", "https://registry.npmjs.org/supports-color/-/supports-color-8.1.1.tgz", { "dependencies": { "has-flag": "^4.0.0" } }, "sha512-MpUEN2OodtUzxvKQl72cUF7RQ5EiHsGvSsVG0ia9c5RbWGL2CI4C7EpPS8UTBIplnlzZiNuV56w+FuNxy3ty2Q=="],

    "@nrwl/jest/@jest/test-result/@jest/console/chalk": ["chalk@4.1.2", "https://registry.npmjs.org/chalk/-/chalk-4.1.2.tgz", { "dependencies": { "ansi-styles": "^4.1.0", "supports-color": "^7.1.0" } }, "sha512-oKnbhFyRIXpUuez8iBMmyEa4nbj4IOQyuhc/wy9kY7/WVPcwIO9VA668Pu8RkO7+0G76SLROeyw9CpQ061i4mA=="],

    "@nrwl/jest/@jest/test-result/@jest/console/jest-message-util": ["jest-message-util@28.1.3", "https://registry.npmjs.org/jest-message-util/-/jest-message-util-28.1.3.tgz", { "dependencies": { "@babel/code-frame": "^7.12.13", "@jest/types": "^28.1.3", "@types/stack-utils": "^2.0.0", "chalk": "^4.0.0", "graceful-fs": "^4.2.9", "micromatch": "^4.0.4", "pretty-format": "^28.1.3", "slash": "^3.0.0", "stack-utils": "^2.0.3" } }, "sha512-PFdn9Iewbt575zKPf1286Ht9EPoJmYT7P0kY+RibeYZ2XtOr53pDLEFoTWXbd1h4JiGiWpTBC84fc8xMXQMb7g=="],

    "@nrwl/jest/@jest/test-result/@jest/console/jest-util": ["jest-util@28.1.3", "https://registry.npmjs.org/jest-util/-/jest-util-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@types/node": "*", "chalk": "^4.0.0", "ci-info": "^3.2.0", "graceful-fs": "^4.2.9", "picomatch": "^2.2.3" } }, "sha512-XdqfpHwpcSRko/C35uLYFM2emRAltIIKZiJ9eAmhjsj0CqZMa0p1ib0R5fWIqGhn1a103DebTbpqIaP1qCQ6tQ=="],

    "@nrwl/jest/@jest/test-result/@jest/types/@jest/schemas": ["@jest/schemas@28.1.3", "https://registry.npmjs.org/@jest/schemas/-/schemas-28.1.3.tgz", { "dependencies": { "@sinclair/typebox": "^0.24.1" } }, "sha512-/l/VWsdt/aBXgjshLWOFyFt3IVdYypu5y2Wn2rOO1un6nkqIn8SLXzgIMYXFyYsRWDyF5EthmKJMIdJvk08grg=="],

    "@nrwl/jest/@jest/test-result/@jest/types/chalk": ["chalk@4.1.2", "https://registry.npmjs.org/chalk/-/chalk-4.1.2.tgz", { "dependencies": { "ansi-styles": "^4.1.0", "supports-color": "^7.1.0" } }, "sha512-oKnbhFyRIXpUuez8iBMmyEa4nbj4IOQyuhc/wy9kY7/WVPcwIO9VA668Pu8RkO7+0G76SLROeyw9CpQ061i4mA=="],

    "@nrwl/jest/jest-config/@jest/test-sequencer/@jest/test-result": ["@jest/test-result@28.1.3", "https://registry.npmjs.org/@jest/test-result/-/test-result-28.1.3.tgz", { "dependencies": { "@jest/console": "^28.1.3", "@jest/types": "^28.1.3", "@types/istanbul-lib-coverage": "^2.0.0", "collect-v8-coverage": "^1.0.0" } }, "sha512-kZAkxnSE+FqE8YjW8gNuoVkkC9I7S1qmenl8sGcDOLropASP+BkcGKwhXoyqQuGOGeYY0y/ixjrd/iERpEXHNg=="],

    "@nrwl/jest/jest-config/@jest/test-sequencer/jest-haste-map": ["jest-haste-map@28.1.3", "https://registry.npmjs.org/jest-haste-map/-/jest-haste-map-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@types/graceful-fs": "^4.1.3", "@types/node": "*", "anymatch": "^3.0.3", "fb-watchman": "^2.0.0", "graceful-fs": "^4.2.9", "jest-regex-util": "^28.0.2", "jest-util": "^28.1.3", "jest-worker": "^28.1.3", "micromatch": "^4.0.4", "walker": "^1.0.8" }, "optionalDependencies": { "fsevents": "^2.3.2" } }, "sha512-3S+RQWDXccXDKSWnkHa/dPwt+2qwA8CJzR61w3FoYCvoo3Pn8tvGcysmMF0Bj0EX5RYvAI2EIvC57OmotfdtKA=="],

    "@nrwl/jest/jest-config/@jest/types/@jest/schemas": ["@jest/schemas@28.1.3", "https://registry.npmjs.org/@jest/schemas/-/schemas-28.1.3.tgz", { "dependencies": { "@sinclair/typebox": "^0.24.1" } }, "sha512-/l/VWsdt/aBXgjshLWOFyFt3IVdYypu5y2Wn2rOO1un6nkqIn8SLXzgIMYXFyYsRWDyF5EthmKJMIdJvk08grg=="],

    "@nrwl/jest/jest-config/babel-jest/@jest/transform": ["@jest/transform@28.1.3", "https://registry.npmjs.org/@jest/transform/-/transform-28.1.3.tgz", { "dependencies": { "@babel/core": "^7.11.6", "@jest/types": "^28.1.3", "@jridgewell/trace-mapping": "^0.3.13", "babel-plugin-istanbul": "^6.1.1", "chalk": "^4.0.0", "convert-source-map": "^1.4.0", "fast-json-stable-stringify": "^2.0.0", "graceful-fs": "^4.2.9", "jest-haste-map": "^28.1.3", "jest-regex-util": "^28.0.2", "jest-util": "^28.1.3", "micromatch": "^4.0.4", "pirates": "^4.0.4", "slash": "^3.0.0", "write-file-atomic": "^4.0.1" } }, "sha512-u5dT5di+oFI6hfcLOHGTAfmUxFRrjK+vnaP0kkVow9Md/M7V/MxqQMOz/VV25UZO8pzeA9PjfTpOu6BDuwSPQA=="],

    "@nrwl/jest/jest-config/babel-jest/babel-preset-jest": ["babel-preset-jest@28.1.3", "https://registry.npmjs.org/babel-preset-jest/-/babel-preset-jest-28.1.3.tgz", { "dependencies": { "babel-plugin-jest-hoist": "^28.1.3", "babel-preset-current-node-syntax": "^1.0.0" }, "peerDependencies": { "@babel/core": "^7.0.0" } }, "sha512-L+fupJvlWAHbQfn74coNX3zf60LXMJsezNvvx8eIh7iOR1luJ1poxYgQk1F8PYtNq/6QODDHCqsSnTFSWC491A=="],

    "@nrwl/jest/jest-config/chalk/supports-color": ["supports-color@7.2.0", "https://registry.npmjs.org/supports-color/-/supports-color-7.2.0.tgz", { "dependencies": { "has-flag": "^4.0.0" } }, "sha512-qpCAvRl9stuOHveKsn7HncJRvv501qIacKzQlO/+Lwxc9+0q2wLyv4Dfvt80/DPn2pqOBsJdDiogXGR9+OvwRw=="],

    "@nrwl/jest/jest-config/jest-circus/@jest/environment": ["@jest/environment@28.1.3", "https://registry.npmjs.org/@jest/environment/-/environment-28.1.3.tgz", { "dependencies": { "@jest/fake-timers": "^28.1.3", "@jest/types": "^28.1.3", "@types/node": "*", "jest-mock": "^28.1.3" } }, "sha512-1bf40cMFTEkKyEf585R9Iz1WayDjHoHqvts0XFYEqyKM3cFWDpeMoqKKTAF9LSYQModPUlh8FKptoM2YcMWAXA=="],

    "@nrwl/jest/jest-config/jest-circus/@jest/expect": ["@jest/expect@28.1.3", "https://registry.npmjs.org/@jest/expect/-/expect-28.1.3.tgz", { "dependencies": { "expect": "^28.1.3", "jest-snapshot": "^28.1.3" } }, "sha512-lzc8CpUbSoE4dqT0U+g1qODQjBRHPpCPXissXD4mS9+sWQdmmpeJ9zSH1rS1HEkrsMN0fb7nKrJ9giAR1d3wBw=="],

    "@nrwl/jest/jest-config/jest-circus/@jest/test-result": ["@jest/test-result@28.1.3", "https://registry.npmjs.org/@jest/test-result/-/test-result-28.1.3.tgz", { "dependencies": { "@jest/console": "^28.1.3", "@jest/types": "^28.1.3", "@types/istanbul-lib-coverage": "^2.0.0", "collect-v8-coverage": "^1.0.0" } }, "sha512-kZAkxnSE+FqE8YjW8gNuoVkkC9I7S1qmenl8sGcDOLropASP+BkcGKwhXoyqQuGOGeYY0y/ixjrd/iERpEXHNg=="],

    "@nrwl/jest/jest-config/jest-circus/dedent": ["dedent@0.7.0", "https://registry.npmjs.org/dedent/-/dedent-0.7.0.tgz", {}, "sha512-Q6fKUPqnAHAyhiUgFU7BUzLiv0kd8saH9al7tnu5Q/okj6dnupxyTgFIBjVzJATdfIAm9NAsvXNzjaKa+bxVyA=="],

    "@nrwl/jest/jest-config/jest-circus/jest-each": ["jest-each@28.1.3", "https://registry.npmjs.org/jest-each/-/jest-each-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "chalk": "^4.0.0", "jest-get-type": "^28.0.2", "jest-util": "^28.1.3", "pretty-format": "^28.1.3" } }, "sha512-arT1z4sg2yABU5uogObVPvSlSMQlDA48owx07BDPAiasW0yYpYHYOo4HHLz9q0BVzDVU4hILFjzJw0So9aCL/g=="],

    "@nrwl/jest/jest-config/jest-circus/jest-matcher-utils": ["jest-matcher-utils@28.1.3", "https://registry.npmjs.org/jest-matcher-utils/-/jest-matcher-utils-28.1.3.tgz", { "dependencies": { "chalk": "^4.0.0", "jest-diff": "^28.1.3", "jest-get-type": "^28.0.2", "pretty-format": "^28.1.3" } }, "sha512-kQeJ7qHemKfbzKoGjHHrRKH6atgxMk8Enkk2iPQ3XwO6oE/KYD8lMYOziCkeSB9G4adPM4nR1DE8Tf5JeWH6Bw=="],

    "@nrwl/jest/jest-config/jest-circus/jest-message-util": ["jest-message-util@28.1.3", "https://registry.npmjs.org/jest-message-util/-/jest-message-util-28.1.3.tgz", { "dependencies": { "@babel/code-frame": "^7.12.13", "@jest/types": "^28.1.3", "@types/stack-utils": "^2.0.0", "chalk": "^4.0.0", "graceful-fs": "^4.2.9", "micromatch": "^4.0.4", "pretty-format": "^28.1.3", "slash": "^3.0.0", "stack-utils": "^2.0.3" } }, "sha512-PFdn9Iewbt575zKPf1286Ht9EPoJmYT7P0kY+RibeYZ2XtOr53pDLEFoTWXbd1h4JiGiWpTBC84fc8xMXQMb7g=="],

    "@nrwl/jest/jest-config/jest-circus/jest-runtime": ["jest-runtime@28.1.3", "https://registry.npmjs.org/jest-runtime/-/jest-runtime-28.1.3.tgz", { "dependencies": { "@jest/environment": "^28.1.3", "@jest/fake-timers": "^28.1.3", "@jest/globals": "^28.1.3", "@jest/source-map": "^28.1.2", "@jest/test-result": "^28.1.3", "@jest/transform": "^28.1.3", "@jest/types": "^28.1.3", "chalk": "^4.0.0", "cjs-module-lexer": "^1.0.0", "collect-v8-coverage": "^1.0.0", "execa": "^5.0.0", "glob": "^7.1.3", "graceful-fs": "^4.2.9", "jest-haste-map": "^28.1.3", "jest-message-util": "^28.1.3", "jest-mock": "^28.1.3", "jest-regex-util": "^28.0.2", "jest-resolve": "^28.1.3", "jest-snapshot": "^28.1.3", "jest-util": "^28.1.3", "slash": "^3.0.0", "strip-bom": "^4.0.0" } }, "sha512-NU+881ScBQQLc1JHG5eJGU7Ui3kLKrmwCPPtYsJtBykixrM2OhVQlpMmFWJjMyDfdkGgBMNjXCGB/ebzsgNGQw=="],

    "@nrwl/jest/jest-config/jest-circus/jest-snapshot": ["jest-snapshot@28.1.3", "https://registry.npmjs.org/jest-snapshot/-/jest-snapshot-28.1.3.tgz", { "dependencies": { "@babel/core": "^7.11.6", "@babel/generator": "^7.7.2", "@babel/plugin-syntax-typescript": "^7.7.2", "@babel/traverse": "^7.7.2", "@babel/types": "^7.3.3", "@jest/expect-utils": "^28.1.3", "@jest/transform": "^28.1.3", "@jest/types": "^28.1.3", "@types/babel__traverse": "^7.0.6", "@types/prettier": "^2.1.5", "babel-preset-current-node-syntax": "^1.0.0", "chalk": "^4.0.0", "expect": "^28.1.3", "graceful-fs": "^4.2.9", "jest-diff": "^28.1.3", "jest-get-type": "^28.0.2", "jest-haste-map": "^28.1.3", "jest-matcher-utils": "^28.1.3", "jest-message-util": "^28.1.3", "jest-util": "^28.1.3", "natural-compare": "^1.4.0", "pretty-format": "^28.1.3", "semver": "^7.3.5" } }, "sha512-4lzMgtiNlc3DU/8lZfmqxN3AYD6GGLbl+72rdBpXvcV+whX7mDrREzkPdp2RnmfIiWBg1YbuFSkXduF2JcafJg=="],

    "@nrwl/jest/jest-config/jest-circus/jest-util": ["jest-util@28.1.3", "https://registry.npmjs.org/jest-util/-/jest-util-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@types/node": "*", "chalk": "^4.0.0", "ci-info": "^3.2.0", "graceful-fs": "^4.2.9", "picomatch": "^2.2.3" } }, "sha512-XdqfpHwpcSRko/C35uLYFM2emRAltIIKZiJ9eAmhjsj0CqZMa0p1ib0R5fWIqGhn1a103DebTbpqIaP1qCQ6tQ=="],

    "@nrwl/jest/jest-config/jest-environment-node/@jest/environment": ["@jest/environment@28.1.3", "https://registry.npmjs.org/@jest/environment/-/environment-28.1.3.tgz", { "dependencies": { "@jest/fake-timers": "^28.1.3", "@jest/types": "^28.1.3", "@types/node": "*", "jest-mock": "^28.1.3" } }, "sha512-1bf40cMFTEkKyEf585R9Iz1WayDjHoHqvts0XFYEqyKM3cFWDpeMoqKKTAF9LSYQModPUlh8FKptoM2YcMWAXA=="],

    "@nrwl/jest/jest-config/jest-environment-node/@jest/fake-timers": ["@jest/fake-timers@28.1.3", "https://registry.npmjs.org/@jest/fake-timers/-/fake-timers-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@sinonjs/fake-timers": "^9.1.2", "@types/node": "*", "jest-message-util": "^28.1.3", "jest-mock": "^28.1.3", "jest-util": "^28.1.3" } }, "sha512-D/wOkL2POHv52h+ok5Oj/1gOG9HSywdoPtFsRCUmlCILXNn5eIWmcnd3DIiWlJnpGvQtmajqBP95Ei0EimxfLw=="],

    "@nrwl/jest/jest-config/jest-environment-node/jest-mock": ["jest-mock@28.1.3", "https://registry.npmjs.org/jest-mock/-/jest-mock-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@types/node": "*" } }, "sha512-o3J2jr6dMMWYVH4Lh/NKmDXdosrsJgi4AviS8oXLujcjpCMBb1FMsblDnOXKZKfSiHLxYub1eS0IHuRXsio9eA=="],

    "@nrwl/jest/jest-config/jest-environment-node/jest-util": ["jest-util@28.1.3", "https://registry.npmjs.org/jest-util/-/jest-util-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@types/node": "*", "chalk": "^4.0.0", "ci-info": "^3.2.0", "graceful-fs": "^4.2.9", "picomatch": "^2.2.3" } }, "sha512-XdqfpHwpcSRko/C35uLYFM2emRAltIIKZiJ9eAmhjsj0CqZMa0p1ib0R5fWIqGhn1a103DebTbpqIaP1qCQ6tQ=="],

    "@nrwl/jest/jest-config/jest-runner/@jest/console": ["@jest/console@28.1.3", "https://registry.npmjs.org/@jest/console/-/console-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@types/node": "*", "chalk": "^4.0.0", "jest-message-util": "^28.1.3", "jest-util": "^28.1.3", "slash": "^3.0.0" } }, "sha512-QPAkP5EwKdK/bxIr6C1I4Vs0rm2nHiANzj/Z5X2JQkrZo6IqvC4ldZ9K95tF0HdidhA8Bo6egxSzUFPYKcEXLw=="],

    "@nrwl/jest/jest-config/jest-runner/@jest/environment": ["@jest/environment@28.1.3", "https://registry.npmjs.org/@jest/environment/-/environment-28.1.3.tgz", { "dependencies": { "@jest/fake-timers": "^28.1.3", "@jest/types": "^28.1.3", "@types/node": "*", "jest-mock": "^28.1.3" } }, "sha512-1bf40cMFTEkKyEf585R9Iz1WayDjHoHqvts0XFYEqyKM3cFWDpeMoqKKTAF9LSYQModPUlh8FKptoM2YcMWAXA=="],

    "@nrwl/jest/jest-config/jest-runner/@jest/test-result": ["@jest/test-result@28.1.3", "https://registry.npmjs.org/@jest/test-result/-/test-result-28.1.3.tgz", { "dependencies": { "@jest/console": "^28.1.3", "@jest/types": "^28.1.3", "@types/istanbul-lib-coverage": "^2.0.0", "collect-v8-coverage": "^1.0.0" } }, "sha512-kZAkxnSE+FqE8YjW8gNuoVkkC9I7S1qmenl8sGcDOLropASP+BkcGKwhXoyqQuGOGeYY0y/ixjrd/iERpEXHNg=="],

    "@nrwl/jest/jest-config/jest-runner/@jest/transform": ["@jest/transform@28.1.3", "https://registry.npmjs.org/@jest/transform/-/transform-28.1.3.tgz", { "dependencies": { "@babel/core": "^7.11.6", "@jest/types": "^28.1.3", "@jridgewell/trace-mapping": "^0.3.13", "babel-plugin-istanbul": "^6.1.1", "chalk": "^4.0.0", "convert-source-map": "^1.4.0", "fast-json-stable-stringify": "^2.0.0", "graceful-fs": "^4.2.9", "jest-haste-map": "^28.1.3", "jest-regex-util": "^28.0.2", "jest-util": "^28.1.3", "micromatch": "^4.0.4", "pirates": "^4.0.4", "slash": "^3.0.0", "write-file-atomic": "^4.0.1" } }, "sha512-u5dT5di+oFI6hfcLOHGTAfmUxFRrjK+vnaP0kkVow9Md/M7V/MxqQMOz/VV25UZO8pzeA9PjfTpOu6BDuwSPQA=="],

    "@nrwl/jest/jest-config/jest-runner/emittery": ["emittery@0.10.2", "https://registry.npmjs.org/emittery/-/emittery-0.10.2.tgz", {}, "sha512-aITqOwnLanpHLNXZJENbOgjUBeHocD+xsSJmNrjovKBW5HbSpW3d1pEls7GFQPUWXiwG9+0P4GtHfEqC/4M0Iw=="],

    "@nrwl/jest/jest-config/jest-runner/jest-docblock": ["jest-docblock@28.1.1", "https://registry.npmjs.org/jest-docblock/-/jest-docblock-28.1.1.tgz", { "dependencies": { "detect-newline": "^3.0.0" } }, "sha512-3wayBVNiOYx0cwAbl9rwm5kKFP8yHH3d/fkEaL02NPTkDojPtheGB7HZSFY4wzX+DxyrvhXz0KSCVksmCknCuA=="],

    "@nrwl/jest/jest-config/jest-runner/jest-haste-map": ["jest-haste-map@28.1.3", "https://registry.npmjs.org/jest-haste-map/-/jest-haste-map-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@types/graceful-fs": "^4.1.3", "@types/node": "*", "anymatch": "^3.0.3", "fb-watchman": "^2.0.0", "graceful-fs": "^4.2.9", "jest-regex-util": "^28.0.2", "jest-util": "^28.1.3", "jest-worker": "^28.1.3", "micromatch": "^4.0.4", "walker": "^1.0.8" }, "optionalDependencies": { "fsevents": "^2.3.2" } }, "sha512-3S+RQWDXccXDKSWnkHa/dPwt+2qwA8CJzR61w3FoYCvoo3Pn8tvGcysmMF0Bj0EX5RYvAI2EIvC57OmotfdtKA=="],

    "@nrwl/jest/jest-config/jest-runner/jest-leak-detector": ["jest-leak-detector@28.1.3", "https://registry.npmjs.org/jest-leak-detector/-/jest-leak-detector-28.1.3.tgz", { "dependencies": { "jest-get-type": "^28.0.2", "pretty-format": "^28.1.3" } }, "sha512-WFVJhnQsiKtDEo5lG2mM0v40QWnBM+zMdHHyJs8AWZ7J0QZJS59MsyKeJHWhpBZBH32S48FOVvGyOFT1h0DlqA=="],

    "@nrwl/jest/jest-config/jest-runner/jest-message-util": ["jest-message-util@28.1.3", "https://registry.npmjs.org/jest-message-util/-/jest-message-util-28.1.3.tgz", { "dependencies": { "@babel/code-frame": "^7.12.13", "@jest/types": "^28.1.3", "@types/stack-utils": "^2.0.0", "chalk": "^4.0.0", "graceful-fs": "^4.2.9", "micromatch": "^4.0.4", "pretty-format": "^28.1.3", "slash": "^3.0.0", "stack-utils": "^2.0.3" } }, "sha512-PFdn9Iewbt575zKPf1286Ht9EPoJmYT7P0kY+RibeYZ2XtOr53pDLEFoTWXbd1h4JiGiWpTBC84fc8xMXQMb7g=="],

    "@nrwl/jest/jest-config/jest-runner/jest-resolve": ["jest-resolve@28.1.3", "https://registry.npmjs.org/jest-resolve/-/jest-resolve-28.1.3.tgz", { "dependencies": { "chalk": "^4.0.0", "graceful-fs": "^4.2.9", "jest-haste-map": "^28.1.3", "jest-pnp-resolver": "^1.2.2", "jest-util": "^28.1.3", "jest-validate": "^28.1.3", "resolve": "^1.20.0", "resolve.exports": "^1.1.0", "slash": "^3.0.0" } }, "sha512-Z1W3tTjE6QaNI90qo/BJpfnvpxtaFTFw5CDgwpyE/Kz8U/06N1Hjf4ia9quUhCh39qIGWF1ZuxFiBiJQwSEYKQ=="],

    "@nrwl/jest/jest-config/jest-runner/jest-runtime": ["jest-runtime@28.1.3", "https://registry.npmjs.org/jest-runtime/-/jest-runtime-28.1.3.tgz", { "dependencies": { "@jest/environment": "^28.1.3", "@jest/fake-timers": "^28.1.3", "@jest/globals": "^28.1.3", "@jest/source-map": "^28.1.2", "@jest/test-result": "^28.1.3", "@jest/transform": "^28.1.3", "@jest/types": "^28.1.3", "chalk": "^4.0.0", "cjs-module-lexer": "^1.0.0", "collect-v8-coverage": "^1.0.0", "execa": "^5.0.0", "glob": "^7.1.3", "graceful-fs": "^4.2.9", "jest-haste-map": "^28.1.3", "jest-message-util": "^28.1.3", "jest-mock": "^28.1.3", "jest-regex-util": "^28.0.2", "jest-resolve": "^28.1.3", "jest-snapshot": "^28.1.3", "jest-util": "^28.1.3", "slash": "^3.0.0", "strip-bom": "^4.0.0" } }, "sha512-NU+881ScBQQLc1JHG5eJGU7Ui3kLKrmwCPPtYsJtBykixrM2OhVQlpMmFWJjMyDfdkGgBMNjXCGB/ebzsgNGQw=="],

    "@nrwl/jest/jest-config/jest-runner/jest-util": ["jest-util@28.1.3", "https://registry.npmjs.org/jest-util/-/jest-util-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@types/node": "*", "chalk": "^4.0.0", "ci-info": "^3.2.0", "graceful-fs": "^4.2.9", "picomatch": "^2.2.3" } }, "sha512-XdqfpHwpcSRko/C35uLYFM2emRAltIIKZiJ9eAmhjsj0CqZMa0p1ib0R5fWIqGhn1a103DebTbpqIaP1qCQ6tQ=="],

    "@nrwl/jest/jest-config/jest-runner/jest-watcher": ["jest-watcher@28.1.3", "https://registry.npmjs.org/jest-watcher/-/jest-watcher-28.1.3.tgz", { "dependencies": { "@jest/test-result": "^28.1.3", "@jest/types": "^28.1.3", "@types/node": "*", "ansi-escapes": "^4.2.1", "chalk": "^4.0.0", "emittery": "^0.10.2", "jest-util": "^28.1.3", "string-length": "^4.0.1" } }, "sha512-t4qcqj9hze+jviFPUN3YAtAEeFnr/azITXQEMARf5cMwKY2SMBRnCQTXLixTl20OR6mLh9KLMrgVJgJISym+1g=="],

    "@nrwl/jest/jest-config/jest-runner/jest-worker": ["jest-worker@28.1.3", "https://registry.npmjs.org/jest-worker/-/jest-worker-28.1.3.tgz", { "dependencies": { "@types/node": "*", "merge-stream": "^2.0.0", "supports-color": "^8.0.0" } }, "sha512-CqRA220YV/6jCo8VWvAt1KKx6eek1VIHMPeLEbpcfSfkEeWyBNppynM/o6q+Wmw+sOhos2ml34wZbSX3G13//g=="],

    "@nrwl/jest/jest-config/pretty-format/@jest/schemas": ["@jest/schemas@28.1.3", "https://registry.npmjs.org/@jest/schemas/-/schemas-28.1.3.tgz", { "dependencies": { "@sinclair/typebox": "^0.24.1" } }, "sha512-/l/VWsdt/aBXgjshLWOFyFt3IVdYypu5y2Wn2rOO1un6nkqIn8SLXzgIMYXFyYsRWDyF5EthmKJMIdJvk08grg=="],

    "@nrwl/jest/jest-config/pretty-format/ansi-styles": ["ansi-styles@5.2.0", "https://registry.npmjs.org/ansi-styles/-/ansi-styles-5.2.0.tgz", {}, "sha512-Cxwpt2SfTzTtXcfOlzGEee8O+c+MmUgGrNiBcXnuWxuFJHe6a5Hz7qwhwe5OgaSYI0IJvkLqWX1ASG+cJOkEiA=="],

    "@nrwl/jest/jest-resolve/chalk/supports-color": ["supports-color@7.2.0", "https://registry.npmjs.org/supports-color/-/supports-color-7.2.0.tgz", { "dependencies": { "has-flag": "^4.0.0" } }, "sha512-qpCAvRl9stuOHveKsn7HncJRvv501qIacKzQlO/+Lwxc9+0q2wLyv4Dfvt80/DPn2pqOBsJdDiogXGR9+OvwRw=="],

    "@nrwl/jest/jest-resolve/jest-haste-map/@jest/types": ["@jest/types@28.1.3", "https://registry.npmjs.org/@jest/types/-/types-28.1.3.tgz", { "dependencies": { "@jest/schemas": "^28.1.3", "@types/istanbul-lib-coverage": "^2.0.0", "@types/istanbul-reports": "^3.0.0", "@types/node": "*", "@types/yargs": "^17.0.8", "chalk": "^4.0.0" } }, "sha512-RyjiyMUZrKz/c+zlMFO1pm70DcIlST8AeWTkoUdZevew44wcNZQHsEVOiCVtgVnlFFD82FPaXycys58cf2muVQ=="],

    "@nrwl/jest/jest-resolve/jest-haste-map/jest-regex-util": ["jest-regex-util@28.0.2", "https://registry.npmjs.org/jest-regex-util/-/jest-regex-util-28.0.2.tgz", {}, "sha512-4s0IgyNIy0y9FK+cjoVYoxamT7Zeo7MhzqRGx7YDYmaQn1wucY9rotiGkBzzcMXTtjrCAP/f7f+E0F7+fxPNdw=="],

    "@nrwl/jest/jest-resolve/jest-haste-map/jest-util": ["jest-util@28.1.3", "https://registry.npmjs.org/jest-util/-/jest-util-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@types/node": "*", "chalk": "^4.0.0", "ci-info": "^3.2.0", "graceful-fs": "^4.2.9", "picomatch": "^2.2.3" } }, "sha512-XdqfpHwpcSRko/C35uLYFM2emRAltIIKZiJ9eAmhjsj0CqZMa0p1ib0R5fWIqGhn1a103DebTbpqIaP1qCQ6tQ=="],

    "@nrwl/jest/jest-resolve/jest-haste-map/jest-worker": ["jest-worker@28.1.3", "https://registry.npmjs.org/jest-worker/-/jest-worker-28.1.3.tgz", { "dependencies": { "@types/node": "*", "merge-stream": "^2.0.0", "supports-color": "^8.0.0" } }, "sha512-CqRA220YV/6jCo8VWvAt1KKx6eek1VIHMPeLEbpcfSfkEeWyBNppynM/o6q+Wmw+sOhos2ml34wZbSX3G13//g=="],

    "@nrwl/jest/jest-resolve/jest-validate/@jest/types": ["@jest/types@28.1.3", "https://registry.npmjs.org/@jest/types/-/types-28.1.3.tgz", { "dependencies": { "@jest/schemas": "^28.1.3", "@types/istanbul-lib-coverage": "^2.0.0", "@types/istanbul-reports": "^3.0.0", "@types/node": "*", "@types/yargs": "^17.0.8", "chalk": "^4.0.0" } }, "sha512-RyjiyMUZrKz/c+zlMFO1pm70DcIlST8AeWTkoUdZevew44wcNZQHsEVOiCVtgVnlFFD82FPaXycys58cf2muVQ=="],

    "@nrwl/jest/jest-resolve/jest-validate/jest-get-type": ["jest-get-type@28.0.2", "https://registry.npmjs.org/jest-get-type/-/jest-get-type-28.0.2.tgz", {}, "sha512-ioj2w9/DxSYHfOm5lJKCdcAmPJzQXmbM/Url3rhlghrPvT3tt+7a/+oXc9azkKmLvoiXjtV83bEWqi+vs5nlPA=="],

    "@nrwl/jest/jest-resolve/jest-validate/pretty-format": ["pretty-format@28.1.3", "https://registry.npmjs.org/pretty-format/-/pretty-format-28.1.3.tgz", { "dependencies": { "@jest/schemas": "^28.1.3", "ansi-regex": "^5.0.1", "ansi-styles": "^5.0.0", "react-is": "^18.0.0" } }, "sha512-8gFb/To0OmxHR9+ZTb14Df2vNxdGCX8g1xWGUTqUw5TiZvcQf5sHKObd5UcPyLLyowNwDAMTF3XWOG1B6mxl1Q=="],

    "@nrwl/jest/jest-util/@jest/types/@jest/schemas": ["@jest/schemas@28.1.3", "https://registry.npmjs.org/@jest/schemas/-/schemas-28.1.3.tgz", { "dependencies": { "@sinclair/typebox": "^0.24.1" } }, "sha512-/l/VWsdt/aBXgjshLWOFyFt3IVdYypu5y2Wn2rOO1un6nkqIn8SLXzgIMYXFyYsRWDyF5EthmKJMIdJvk08grg=="],

    "@nrwl/jest/jest-util/chalk/supports-color": ["supports-color@7.2.0", "https://registry.npmjs.org/supports-color/-/supports-color-7.2.0.tgz", { "dependencies": { "has-flag": "^4.0.0" } }, "sha512-qpCAvRl9stuOHveKsn7HncJRvv501qIacKzQlO/+Lwxc9+0q2wLyv4Dfvt80/DPn2pqOBsJdDiogXGR9+OvwRw=="],

    "@nrwl/workspace/semver/lru-cache/yallist": ["yallist@4.0.0", "https://registry.npmjs.org/yallist/-/yallist-4.0.0.tgz", {}, "sha512-3wdGidZyq5PB084XLES5TpOSRA3wjXAlIWMhum2kRcv/41Sn2emQ0dycQW4uZXLejwKvg6EsvbdlVL+FYEct7A=="],

    "nx/semver/lru-cache/yallist": ["yallist@4.0.0", "https://registry.npmjs.org/yallist/-/yallist-4.0.0.tgz", {}, "sha512-3wdGidZyq5PB084XLES5TpOSRA3wjXAlIWMhum2kRcv/41Sn2emQ0dycQW4uZXLejwKvg6EsvbdlVL+FYEct7A=="],

    "pkg-dir/find-up/locate-path/p-locate": ["p-locate@4.1.0", "https://registry.npmjs.org/p-locate/-/p-locate-4.1.0.tgz", { "dependencies": { "p-limit": "^2.2.0" } }, "sha512-R79ZZ/0wAxKGu3oYMlz8jy/kbhsNrS7SKZ7PxEHBgJ5+F2mtFW2fK2cOtBh1cHYkQsbzFV7I+EoRKe6Yt0oK7A=="],

    "@istanbuljs/load-nyc-config/find-up/locate-path/p-locate/p-limit": ["p-limit@2.3.0", "https://registry.npmjs.org/p-limit/-/p-limit-2.3.0.tgz", { "dependencies": { "p-try": "^2.0.0" } }, "sha512-//88mFWSJx8lxCzwdAABTJL2MyWB12+eIY7MDL2SqLmAkeKU9qxRvWuSyTjm3FUmpBEMuFfckAIqEaVGUDxb6w=="],

    "@nrwl/jest/@jest/reporters/@jest/types/@jest/schemas/@sinclair/typebox": ["@sinclair/typebox@0.24.51", "https://registry.npmjs.org/@sinclair/typebox/-/typebox-0.24.51.tgz", {}, "sha512-1P1OROm/rdubP5aFDSZQILU0vrLCJ4fvHt6EoqHEM+2D/G5MK3bIaymUKLit8Js9gbns5UyJnkP/TZROLw4tUA=="],

    "@nrwl/jest/@jest/reporters/jest-message-util/pretty-format/@jest/schemas": ["@jest/schemas@28.1.3", "https://registry.npmjs.org/@jest/schemas/-/schemas-28.1.3.tgz", { "dependencies": { "@sinclair/typebox": "^0.24.1" } }, "sha512-/l/VWsdt/aBXgjshLWOFyFt3IVdYypu5y2Wn2rOO1un6nkqIn8SLXzgIMYXFyYsRWDyF5EthmKJMIdJvk08grg=="],

    "@nrwl/jest/@jest/reporters/jest-message-util/pretty-format/ansi-styles": ["ansi-styles@5.2.0", "https://registry.npmjs.org/ansi-styles/-/ansi-styles-5.2.0.tgz", {}, "sha512-Cxwpt2SfTzTtXcfOlzGEee8O+c+MmUgGrNiBcXnuWxuFJHe6a5Hz7qwhwe5OgaSYI0IJvkLqWX1ASG+cJOkEiA=="],

    "@nrwl/jest/@jest/test-result/@jest/console/chalk/supports-color": ["supports-color@7.2.0", "https://registry.npmjs.org/supports-color/-/supports-color-7.2.0.tgz", { "dependencies": { "has-flag": "^4.0.0" } }, "sha512-qpCAvRl9stuOHveKsn7HncJRvv501qIacKzQlO/+Lwxc9+0q2wLyv4Dfvt80/DPn2pqOBsJdDiogXGR9+OvwRw=="],

    "@nrwl/jest/@jest/test-result/@jest/console/jest-message-util/pretty-format": ["pretty-format@28.1.3", "https://registry.npmjs.org/pretty-format/-/pretty-format-28.1.3.tgz", { "dependencies": { "@jest/schemas": "^28.1.3", "ansi-regex": "^5.0.1", "ansi-styles": "^5.0.0", "react-is": "^18.0.0" } }, "sha512-8gFb/To0OmxHR9+ZTb14Df2vNxdGCX8g1xWGUTqUw5TiZvcQf5sHKObd5UcPyLLyowNwDAMTF3XWOG1B6mxl1Q=="],

    "@nrwl/jest/@jest/test-result/@jest/types/@jest/schemas/@sinclair/typebox": ["@sinclair/typebox@0.24.51", "https://registry.npmjs.org/@sinclair/typebox/-/typebox-0.24.51.tgz", {}, "sha512-1P1OROm/rdubP5aFDSZQILU0vrLCJ4fvHt6EoqHEM+2D/G5MK3bIaymUKLit8Js9gbns5UyJnkP/TZROLw4tUA=="],

    "@nrwl/jest/@jest/test-result/@jest/types/chalk/supports-color": ["supports-color@7.2.0", "https://registry.npmjs.org/supports-color/-/supports-color-7.2.0.tgz", { "dependencies": { "has-flag": "^4.0.0" } }, "sha512-qpCAvRl9stuOHveKsn7HncJRvv501qIacKzQlO/+Lwxc9+0q2wLyv4Dfvt80/DPn2pqOBsJdDiogXGR9+OvwRw=="],

    "@nrwl/jest/jest-config/@jest/test-sequencer/@jest/test-result/@jest/console": ["@jest/console@28.1.3", "https://registry.npmjs.org/@jest/console/-/console-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@types/node": "*", "chalk": "^4.0.0", "jest-message-util": "^28.1.3", "jest-util": "^28.1.3", "slash": "^3.0.0" } }, "sha512-QPAkP5EwKdK/bxIr6C1I4Vs0rm2nHiANzj/Z5X2JQkrZo6IqvC4ldZ9K95tF0HdidhA8Bo6egxSzUFPYKcEXLw=="],

    "@nrwl/jest/jest-config/@jest/test-sequencer/jest-haste-map/jest-util": ["jest-util@28.1.3", "https://registry.npmjs.org/jest-util/-/jest-util-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@types/node": "*", "chalk": "^4.0.0", "ci-info": "^3.2.0", "graceful-fs": "^4.2.9", "picomatch": "^2.2.3" } }, "sha512-XdqfpHwpcSRko/C35uLYFM2emRAltIIKZiJ9eAmhjsj0CqZMa0p1ib0R5fWIqGhn1a103DebTbpqIaP1qCQ6tQ=="],

    "@nrwl/jest/jest-config/@jest/test-sequencer/jest-haste-map/jest-worker": ["jest-worker@28.1.3", "https://registry.npmjs.org/jest-worker/-/jest-worker-28.1.3.tgz", { "dependencies": { "@types/node": "*", "merge-stream": "^2.0.0", "supports-color": "^8.0.0" } }, "sha512-CqRA220YV/6jCo8VWvAt1KKx6eek1VIHMPeLEbpcfSfkEeWyBNppynM/o6q+Wmw+sOhos2ml34wZbSX3G13//g=="],

    "@nrwl/jest/jest-config/@jest/types/@jest/schemas/@sinclair/typebox": ["@sinclair/typebox@0.24.51", "https://registry.npmjs.org/@sinclair/typebox/-/typebox-0.24.51.tgz", {}, "sha512-1P1OROm/rdubP5aFDSZQILU0vrLCJ4fvHt6EoqHEM+2D/G5MK3bIaymUKLit8Js9gbns5UyJnkP/TZROLw4tUA=="],

    "@nrwl/jest/jest-config/babel-jest/@jest/transform/convert-source-map": ["convert-source-map@1.9.0", "https://registry.npmjs.org/convert-source-map/-/convert-source-map-1.9.0.tgz", {}, "sha512-ASFBup0Mz1uyiIjANan1jzLQami9z1PoYSZCiiYW2FczPbenXc45FZdBZLzOT+r6+iciuEModtmCti+hjaAk0A=="],

    "@nrwl/jest/jest-config/babel-jest/@jest/transform/jest-haste-map": ["jest-haste-map@28.1.3", "https://registry.npmjs.org/jest-haste-map/-/jest-haste-map-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@types/graceful-fs": "^4.1.3", "@types/node": "*", "anymatch": "^3.0.3", "fb-watchman": "^2.0.0", "graceful-fs": "^4.2.9", "jest-regex-util": "^28.0.2", "jest-util": "^28.1.3", "jest-worker": "^28.1.3", "micromatch": "^4.0.4", "walker": "^1.0.8" }, "optionalDependencies": { "fsevents": "^2.3.2" } }, "sha512-3S+RQWDXccXDKSWnkHa/dPwt+2qwA8CJzR61w3FoYCvoo3Pn8tvGcysmMF0Bj0EX5RYvAI2EIvC57OmotfdtKA=="],

    "@nrwl/jest/jest-config/babel-jest/@jest/transform/jest-util": ["jest-util@28.1.3", "https://registry.npmjs.org/jest-util/-/jest-util-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@types/node": "*", "chalk": "^4.0.0", "ci-info": "^3.2.0", "graceful-fs": "^4.2.9", "picomatch": "^2.2.3" } }, "sha512-XdqfpHwpcSRko/C35uLYFM2emRAltIIKZiJ9eAmhjsj0CqZMa0p1ib0R5fWIqGhn1a103DebTbpqIaP1qCQ6tQ=="],

    "@nrwl/jest/jest-config/babel-jest/babel-preset-jest/babel-plugin-jest-hoist": ["babel-plugin-jest-hoist@28.1.3", "https://registry.npmjs.org/babel-plugin-jest-hoist/-/babel-plugin-jest-hoist-28.1.3.tgz", { "dependencies": { "@babel/template": "^7.3.3", "@babel/types": "^7.3.3", "@types/babel__core": "^7.1.14", "@types/babel__traverse": "^7.0.6" } }, "sha512-Ys3tUKAmfnkRUpPdpa98eYrAR0nV+sSFUZZEGuQ2EbFd1y4SOLtD5QDNHAq+bb9a+bbXvYQC4b+ID/THIMcU6Q=="],

    "@nrwl/jest/jest-config/jest-circus/@jest/environment/@jest/fake-timers": ["@jest/fake-timers@28.1.3", "https://registry.npmjs.org/@jest/fake-timers/-/fake-timers-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@sinonjs/fake-timers": "^9.1.2", "@types/node": "*", "jest-message-util": "^28.1.3", "jest-mock": "^28.1.3", "jest-util": "^28.1.3" } }, "sha512-D/wOkL2POHv52h+ok5Oj/1gOG9HSywdoPtFsRCUmlCILXNn5eIWmcnd3DIiWlJnpGvQtmajqBP95Ei0EimxfLw=="],

    "@nrwl/jest/jest-config/jest-circus/@jest/environment/jest-mock": ["jest-mock@28.1.3", "https://registry.npmjs.org/jest-mock/-/jest-mock-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@types/node": "*" } }, "sha512-o3J2jr6dMMWYVH4Lh/NKmDXdosrsJgi4AviS8oXLujcjpCMBb1FMsblDnOXKZKfSiHLxYub1eS0IHuRXsio9eA=="],

    "@nrwl/jest/jest-config/jest-circus/@jest/expect/expect": ["expect@28.1.3", "https://registry.npmjs.org/expect/-/expect-28.1.3.tgz", { "dependencies": { "@jest/expect-utils": "^28.1.3", "jest-get-type": "^28.0.2", "jest-matcher-utils": "^28.1.3", "jest-message-util": "^28.1.3", "jest-util": "^28.1.3" } }, "sha512-eEh0xn8HlsuOBxFgIss+2mX85VAS4Qy3OSkjV7rlBWljtA4oWH37glVGyOZSZvErDT/yBywZdPGwCXuTvSG85g=="],

    "@nrwl/jest/jest-config/jest-circus/@jest/test-result/@jest/console": ["@jest/console@28.1.3", "https://registry.npmjs.org/@jest/console/-/console-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@types/node": "*", "chalk": "^4.0.0", "jest-message-util": "^28.1.3", "jest-util": "^28.1.3", "slash": "^3.0.0" } }, "sha512-QPAkP5EwKdK/bxIr6C1I4Vs0rm2nHiANzj/Z5X2JQkrZo6IqvC4ldZ9K95tF0HdidhA8Bo6egxSzUFPYKcEXLw=="],

    "@nrwl/jest/jest-config/jest-circus/jest-matcher-utils/jest-diff": ["jest-diff@28.1.3", "https://registry.npmjs.org/jest-diff/-/jest-diff-28.1.3.tgz", { "dependencies": { "chalk": "^4.0.0", "diff-sequences": "^28.1.1", "jest-get-type": "^28.0.2", "pretty-format": "^28.1.3" } }, "sha512-8RqP1B/OXzjjTWkqMX67iqgwBVJRgCyKD3L9nq+6ZqJMdvjE8RgHktqZ6jNrkdMT+dJuYNI3rhQpxaz7drJHfw=="],

    "@nrwl/jest/jest-config/jest-circus/jest-runtime/@jest/fake-timers": ["@jest/fake-timers@28.1.3", "https://registry.npmjs.org/@jest/fake-timers/-/fake-timers-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@sinonjs/fake-timers": "^9.1.2", "@types/node": "*", "jest-message-util": "^28.1.3", "jest-mock": "^28.1.3", "jest-util": "^28.1.3" } }, "sha512-D/wOkL2POHv52h+ok5Oj/1gOG9HSywdoPtFsRCUmlCILXNn5eIWmcnd3DIiWlJnpGvQtmajqBP95Ei0EimxfLw=="],

    "@nrwl/jest/jest-config/jest-circus/jest-runtime/@jest/globals": ["@jest/globals@28.1.3", "https://registry.npmjs.org/@jest/globals/-/globals-28.1.3.tgz", { "dependencies": { "@jest/environment": "^28.1.3", "@jest/expect": "^28.1.3", "@jest/types": "^28.1.3" } }, "sha512-XFU4P4phyryCXu1pbcqMO0GSQcYe1IsalYCDzRNyhetyeyxMcIxa11qPNDpVNLeretItNqEmYYQn1UYz/5x1NA=="],

    "@nrwl/jest/jest-config/jest-circus/jest-runtime/@jest/source-map": ["@jest/source-map@28.1.2", "https://registry.npmjs.org/@jest/source-map/-/source-map-28.1.2.tgz", { "dependencies": { "@jridgewell/trace-mapping": "^0.3.13", "callsites": "^3.0.0", "graceful-fs": "^4.2.9" } }, "sha512-cV8Lx3BeStJb8ipPHnqVw/IM2VCMWO3crWZzYodSIkxXnRcXJipCdx1JCK0K5MsJJouZQTH73mzf4vgxRaH9ww=="],

    "@nrwl/jest/jest-config/jest-circus/jest-runtime/@jest/transform": ["@jest/transform@28.1.3", "https://registry.npmjs.org/@jest/transform/-/transform-28.1.3.tgz", { "dependencies": { "@babel/core": "^7.11.6", "@jest/types": "^28.1.3", "@jridgewell/trace-mapping": "^0.3.13", "babel-plugin-istanbul": "^6.1.1", "chalk": "^4.0.0", "convert-source-map": "^1.4.0", "fast-json-stable-stringify": "^2.0.0", "graceful-fs": "^4.2.9", "jest-haste-map": "^28.1.3", "jest-regex-util": "^28.0.2", "jest-util": "^28.1.3", "micromatch": "^4.0.4", "pirates": "^4.0.4", "slash": "^3.0.0", "write-file-atomic": "^4.0.1" } }, "sha512-u5dT5di+oFI6hfcLOHGTAfmUxFRrjK+vnaP0kkVow9Md/M7V/MxqQMOz/VV25UZO8pzeA9PjfTpOu6BDuwSPQA=="],

    "@nrwl/jest/jest-config/jest-circus/jest-runtime/jest-haste-map": ["jest-haste-map@28.1.3", "https://registry.npmjs.org/jest-haste-map/-/jest-haste-map-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@types/graceful-fs": "^4.1.3", "@types/node": "*", "anymatch": "^3.0.3", "fb-watchman": "^2.0.0", "graceful-fs": "^4.2.9", "jest-regex-util": "^28.0.2", "jest-util": "^28.1.3", "jest-worker": "^28.1.3", "micromatch": "^4.0.4", "walker": "^1.0.8" }, "optionalDependencies": { "fsevents": "^2.3.2" } }, "sha512-3S+RQWDXccXDKSWnkHa/dPwt+2qwA8CJzR61w3FoYCvoo3Pn8tvGcysmMF0Bj0EX5RYvAI2EIvC57OmotfdtKA=="],

    "@nrwl/jest/jest-config/jest-circus/jest-runtime/jest-mock": ["jest-mock@28.1.3", "https://registry.npmjs.org/jest-mock/-/jest-mock-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@types/node": "*" } }, "sha512-o3J2jr6dMMWYVH4Lh/NKmDXdosrsJgi4AviS8oXLujcjpCMBb1FMsblDnOXKZKfSiHLxYub1eS0IHuRXsio9eA=="],

    "@nrwl/jest/jest-config/jest-circus/jest-runtime/jest-resolve": ["jest-resolve@28.1.3", "https://registry.npmjs.org/jest-resolve/-/jest-resolve-28.1.3.tgz", { "dependencies": { "chalk": "^4.0.0", "graceful-fs": "^4.2.9", "jest-haste-map": "^28.1.3", "jest-pnp-resolver": "^1.2.2", "jest-util": "^28.1.3", "jest-validate": "^28.1.3", "resolve": "^1.20.0", "resolve.exports": "^1.1.0", "slash": "^3.0.0" } }, "sha512-Z1W3tTjE6QaNI90qo/BJpfnvpxtaFTFw5CDgwpyE/Kz8U/06N1Hjf4ia9quUhCh39qIGWF1ZuxFiBiJQwSEYKQ=="],

    "@nrwl/jest/jest-config/jest-circus/jest-runtime/strip-bom": ["strip-bom@4.0.0", "https://registry.npmjs.org/strip-bom/-/strip-bom-4.0.0.tgz", {}, "sha512-3xurFv5tEgii33Zi8Jtp55wEIILR9eh34FAW00PZf+JnSsTmV/ioewSgQl97JHvgjoRGwPShsWm+IdrxB35d0w=="],

    "@nrwl/jest/jest-config/jest-circus/jest-snapshot/@jest/expect-utils": ["@jest/expect-utils@28.1.3", "https://registry.npmjs.org/@jest/expect-utils/-/expect-utils-28.1.3.tgz", { "dependencies": { "jest-get-type": "^28.0.2" } }, "sha512-wvbi9LUrHJLn3NlDW6wF2hvIMtd4JUl2QNVrjq+IBSHirgfrR3o9RnVtxzdEGO2n9JyIWwHnLfby5KzqBGg2YA=="],

    "@nrwl/jest/jest-config/jest-circus/jest-snapshot/@jest/transform": ["@jest/transform@28.1.3", "https://registry.npmjs.org/@jest/transform/-/transform-28.1.3.tgz", { "dependencies": { "@babel/core": "^7.11.6", "@jest/types": "^28.1.3", "@jridgewell/trace-mapping": "^0.3.13", "babel-plugin-istanbul": "^6.1.1", "chalk": "^4.0.0", "convert-source-map": "^1.4.0", "fast-json-stable-stringify": "^2.0.0", "graceful-fs": "^4.2.9", "jest-haste-map": "^28.1.3", "jest-regex-util": "^28.0.2", "jest-util": "^28.1.3", "micromatch": "^4.0.4", "pirates": "^4.0.4", "slash": "^3.0.0", "write-file-atomic": "^4.0.1" } }, "sha512-u5dT5di+oFI6hfcLOHGTAfmUxFRrjK+vnaP0kkVow9Md/M7V/MxqQMOz/VV25UZO8pzeA9PjfTpOu6BDuwSPQA=="],

    "@nrwl/jest/jest-config/jest-circus/jest-snapshot/expect": ["expect@28.1.3", "https://registry.npmjs.org/expect/-/expect-28.1.3.tgz", { "dependencies": { "@jest/expect-utils": "^28.1.3", "jest-get-type": "^28.0.2", "jest-matcher-utils": "^28.1.3", "jest-message-util": "^28.1.3", "jest-util": "^28.1.3" } }, "sha512-eEh0xn8HlsuOBxFgIss+2mX85VAS4Qy3OSkjV7rlBWljtA4oWH37glVGyOZSZvErDT/yBywZdPGwCXuTvSG85g=="],

    "@nrwl/jest/jest-config/jest-circus/jest-snapshot/jest-diff": ["jest-diff@28.1.3", "https://registry.npmjs.org/jest-diff/-/jest-diff-28.1.3.tgz", { "dependencies": { "chalk": "^4.0.0", "diff-sequences": "^28.1.1", "jest-get-type": "^28.0.2", "pretty-format": "^28.1.3" } }, "sha512-8RqP1B/OXzjjTWkqMX67iqgwBVJRgCyKD3L9nq+6ZqJMdvjE8RgHktqZ6jNrkdMT+dJuYNI3rhQpxaz7drJHfw=="],

    "@nrwl/jest/jest-config/jest-circus/jest-snapshot/jest-haste-map": ["jest-haste-map@28.1.3", "https://registry.npmjs.org/jest-haste-map/-/jest-haste-map-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@types/graceful-fs": "^4.1.3", "@types/node": "*", "anymatch": "^3.0.3", "fb-watchman": "^2.0.0", "graceful-fs": "^4.2.9", "jest-regex-util": "^28.0.2", "jest-util": "^28.1.3", "jest-worker": "^28.1.3", "micromatch": "^4.0.4", "walker": "^1.0.8" }, "optionalDependencies": { "fsevents": "^2.3.2" } }, "sha512-3S+RQWDXccXDKSWnkHa/dPwt+2qwA8CJzR61w3FoYCvoo3Pn8tvGcysmMF0Bj0EX5RYvAI2EIvC57OmotfdtKA=="],

    "@nrwl/jest/jest-config/jest-circus/jest-snapshot/semver": ["semver@7.7.2", "https://registry.npmjs.org/semver/-/semver-7.7.2.tgz", { "bin": { "semver": "bin/semver.js" } }, "sha512-RF0Fw+rO5AMf9MAyaRXI4AV0Ulj5lMHqVxxdSgiVbixSCXoEmmX/jk0CuJw4+3SqroYO9VoUh+HcuJivvtJemA=="],

    "@nrwl/jest/jest-config/jest-environment-node/@jest/fake-timers/@sinonjs/fake-timers": ["@sinonjs/fake-timers@9.1.2", "https://registry.npmjs.org/@sinonjs/fake-timers/-/fake-timers-9.1.2.tgz", { "dependencies": { "@sinonjs/commons": "^1.7.0" } }, "sha512-BPS4ynJW/o92PUR4wgriz2Ud5gpST5vz6GQfMixEDK0Z8ZCUv2M7SkBLykH56T++Xs+8ln9zTGbOvNGIe02/jw=="],

    "@nrwl/jest/jest-config/jest-environment-node/@jest/fake-timers/jest-message-util": ["jest-message-util@28.1.3", "https://registry.npmjs.org/jest-message-util/-/jest-message-util-28.1.3.tgz", { "dependencies": { "@babel/code-frame": "^7.12.13", "@jest/types": "^28.1.3", "@types/stack-utils": "^2.0.0", "chalk": "^4.0.0", "graceful-fs": "^4.2.9", "micromatch": "^4.0.4", "pretty-format": "^28.1.3", "slash": "^3.0.0", "stack-utils": "^2.0.3" } }, "sha512-PFdn9Iewbt575zKPf1286Ht9EPoJmYT7P0kY+RibeYZ2XtOr53pDLEFoTWXbd1h4JiGiWpTBC84fc8xMXQMb7g=="],

    "@nrwl/jest/jest-config/jest-runner/@jest/environment/@jest/fake-timers": ["@jest/fake-timers@28.1.3", "https://registry.npmjs.org/@jest/fake-timers/-/fake-timers-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@sinonjs/fake-timers": "^9.1.2", "@types/node": "*", "jest-message-util": "^28.1.3", "jest-mock": "^28.1.3", "jest-util": "^28.1.3" } }, "sha512-D/wOkL2POHv52h+ok5Oj/1gOG9HSywdoPtFsRCUmlCILXNn5eIWmcnd3DIiWlJnpGvQtmajqBP95Ei0EimxfLw=="],

    "@nrwl/jest/jest-config/jest-runner/@jest/environment/jest-mock": ["jest-mock@28.1.3", "https://registry.npmjs.org/jest-mock/-/jest-mock-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@types/node": "*" } }, "sha512-o3J2jr6dMMWYVH4Lh/NKmDXdosrsJgi4AviS8oXLujcjpCMBb1FMsblDnOXKZKfSiHLxYub1eS0IHuRXsio9eA=="],

    "@nrwl/jest/jest-config/jest-runner/@jest/transform/convert-source-map": ["convert-source-map@1.9.0", "https://registry.npmjs.org/convert-source-map/-/convert-source-map-1.9.0.tgz", {}, "sha512-ASFBup0Mz1uyiIjANan1jzLQami9z1PoYSZCiiYW2FczPbenXc45FZdBZLzOT+r6+iciuEModtmCti+hjaAk0A=="],

    "@nrwl/jest/jest-config/jest-runner/jest-runtime/@jest/fake-timers": ["@jest/fake-timers@28.1.3", "https://registry.npmjs.org/@jest/fake-timers/-/fake-timers-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@sinonjs/fake-timers": "^9.1.2", "@types/node": "*", "jest-message-util": "^28.1.3", "jest-mock": "^28.1.3", "jest-util": "^28.1.3" } }, "sha512-D/wOkL2POHv52h+ok5Oj/1gOG9HSywdoPtFsRCUmlCILXNn5eIWmcnd3DIiWlJnpGvQtmajqBP95Ei0EimxfLw=="],

    "@nrwl/jest/jest-config/jest-runner/jest-runtime/@jest/globals": ["@jest/globals@28.1.3", "https://registry.npmjs.org/@jest/globals/-/globals-28.1.3.tgz", { "dependencies": { "@jest/environment": "^28.1.3", "@jest/expect": "^28.1.3", "@jest/types": "^28.1.3" } }, "sha512-XFU4P4phyryCXu1pbcqMO0GSQcYe1IsalYCDzRNyhetyeyxMcIxa11qPNDpVNLeretItNqEmYYQn1UYz/5x1NA=="],

    "@nrwl/jest/jest-config/jest-runner/jest-runtime/@jest/source-map": ["@jest/source-map@28.1.2", "https://registry.npmjs.org/@jest/source-map/-/source-map-28.1.2.tgz", { "dependencies": { "@jridgewell/trace-mapping": "^0.3.13", "callsites": "^3.0.0", "graceful-fs": "^4.2.9" } }, "sha512-cV8Lx3BeStJb8ipPHnqVw/IM2VCMWO3crWZzYodSIkxXnRcXJipCdx1JCK0K5MsJJouZQTH73mzf4vgxRaH9ww=="],

    "@nrwl/jest/jest-config/jest-runner/jest-runtime/jest-mock": ["jest-mock@28.1.3", "https://registry.npmjs.org/jest-mock/-/jest-mock-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@types/node": "*" } }, "sha512-o3J2jr6dMMWYVH4Lh/NKmDXdosrsJgi4AviS8oXLujcjpCMBb1FMsblDnOXKZKfSiHLxYub1eS0IHuRXsio9eA=="],

    "@nrwl/jest/jest-config/jest-runner/jest-runtime/jest-snapshot": ["jest-snapshot@28.1.3", "https://registry.npmjs.org/jest-snapshot/-/jest-snapshot-28.1.3.tgz", { "dependencies": { "@babel/core": "^7.11.6", "@babel/generator": "^7.7.2", "@babel/plugin-syntax-typescript": "^7.7.2", "@babel/traverse": "^7.7.2", "@babel/types": "^7.3.3", "@jest/expect-utils": "^28.1.3", "@jest/transform": "^28.1.3", "@jest/types": "^28.1.3", "@types/babel__traverse": "^7.0.6", "@types/prettier": "^2.1.5", "babel-preset-current-node-syntax": "^1.0.0", "chalk": "^4.0.0", "expect": "^28.1.3", "graceful-fs": "^4.2.9", "jest-diff": "^28.1.3", "jest-get-type": "^28.0.2", "jest-haste-map": "^28.1.3", "jest-matcher-utils": "^28.1.3", "jest-message-util": "^28.1.3", "jest-util": "^28.1.3", "natural-compare": "^1.4.0", "pretty-format": "^28.1.3", "semver": "^7.3.5" } }, "sha512-4lzMgtiNlc3DU/8lZfmqxN3AYD6GGLbl+72rdBpXvcV+whX7mDrREzkPdp2RnmfIiWBg1YbuFSkXduF2JcafJg=="],

    "@nrwl/jest/jest-config/jest-runner/jest-runtime/strip-bom": ["strip-bom@4.0.0", "https://registry.npmjs.org/strip-bom/-/strip-bom-4.0.0.tgz", {}, "sha512-3xurFv5tEgii33Zi8Jtp55wEIILR9eh34FAW00PZf+JnSsTmV/ioewSgQl97JHvgjoRGwPShsWm+IdrxB35d0w=="],

    "@nrwl/jest/jest-config/jest-runner/jest-worker/supports-color": ["supports-color@8.1.1", "https://registry.npmjs.org/supports-color/-/supports-color-8.1.1.tgz", { "dependencies": { "has-flag": "^4.0.0" } }, "sha512-MpUEN2OodtUzxvKQl72cUF7RQ5EiHsGvSsVG0ia9c5RbWGL2CI4C7EpPS8UTBIplnlzZiNuV56w+FuNxy3ty2Q=="],

    "@nrwl/jest/jest-config/pretty-format/@jest/schemas/@sinclair/typebox": ["@sinclair/typebox@0.24.51", "https://registry.npmjs.org/@sinclair/typebox/-/typebox-0.24.51.tgz", {}, "sha512-1P1OROm/rdubP5aFDSZQILU0vrLCJ4fvHt6EoqHEM+2D/G5MK3bIaymUKLit8Js9gbns5UyJnkP/TZROLw4tUA=="],

    "@nrwl/jest/jest-resolve/jest-haste-map/@jest/types/@jest/schemas": ["@jest/schemas@28.1.3", "https://registry.npmjs.org/@jest/schemas/-/schemas-28.1.3.tgz", { "dependencies": { "@sinclair/typebox": "^0.24.1" } }, "sha512-/l/VWsdt/aBXgjshLWOFyFt3IVdYypu5y2Wn2rOO1un6nkqIn8SLXzgIMYXFyYsRWDyF5EthmKJMIdJvk08grg=="],

    "@nrwl/jest/jest-resolve/jest-haste-map/jest-worker/supports-color": ["supports-color@8.1.1", "https://registry.npmjs.org/supports-color/-/supports-color-8.1.1.tgz", { "dependencies": { "has-flag": "^4.0.0" } }, "sha512-MpUEN2OodtUzxvKQl72cUF7RQ5EiHsGvSsVG0ia9c5RbWGL2CI4C7EpPS8UTBIplnlzZiNuV56w+FuNxy3ty2Q=="],

    "@nrwl/jest/jest-resolve/jest-validate/@jest/types/@jest/schemas": ["@jest/schemas@28.1.3", "https://registry.npmjs.org/@jest/schemas/-/schemas-28.1.3.tgz", { "dependencies": { "@sinclair/typebox": "^0.24.1" } }, "sha512-/l/VWsdt/aBXgjshLWOFyFt3IVdYypu5y2Wn2rOO1un6nkqIn8SLXzgIMYXFyYsRWDyF5EthmKJMIdJvk08grg=="],

    "@nrwl/jest/jest-resolve/jest-validate/pretty-format/@jest/schemas": ["@jest/schemas@28.1.3", "https://registry.npmjs.org/@jest/schemas/-/schemas-28.1.3.tgz", { "dependencies": { "@sinclair/typebox": "^0.24.1" } }, "sha512-/l/VWsdt/aBXgjshLWOFyFt3IVdYypu5y2Wn2rOO1un6nkqIn8SLXzgIMYXFyYsRWDyF5EthmKJMIdJvk08grg=="],

    "@nrwl/jest/jest-resolve/jest-validate/pretty-format/ansi-styles": ["ansi-styles@5.2.0", "https://registry.npmjs.org/ansi-styles/-/ansi-styles-5.2.0.tgz", {}, "sha512-Cxwpt2SfTzTtXcfOlzGEee8O+c+MmUgGrNiBcXnuWxuFJHe6a5Hz7qwhwe5OgaSYI0IJvkLqWX1ASG+cJOkEiA=="],

    "@nrwl/jest/jest-util/@jest/types/@jest/schemas/@sinclair/typebox": ["@sinclair/typebox@0.24.51", "https://registry.npmjs.org/@sinclair/typebox/-/typebox-0.24.51.tgz", {}, "sha512-1P1OROm/rdubP5aFDSZQILU0vrLCJ4fvHt6EoqHEM+2D/G5MK3bIaymUKLit8Js9gbns5UyJnkP/TZROLw4tUA=="],

    "pkg-dir/find-up/locate-path/p-locate/p-limit": ["p-limit@2.3.0", "https://registry.npmjs.org/p-limit/-/p-limit-2.3.0.tgz", { "dependencies": { "p-try": "^2.0.0" } }, "sha512-//88mFWSJx8lxCzwdAABTJL2MyWB12+eIY7MDL2SqLmAkeKU9qxRvWuSyTjm3FUmpBEMuFfckAIqEaVGUDxb6w=="],

    "@nrwl/jest/@jest/reporters/jest-message-util/pretty-format/@jest/schemas/@sinclair/typebox": ["@sinclair/typebox@0.24.51", "https://registry.npmjs.org/@sinclair/typebox/-/typebox-0.24.51.tgz", {}, "sha512-1P1OROm/rdubP5aFDSZQILU0vrLCJ4fvHt6EoqHEM+2D/G5MK3bIaymUKLit8Js9gbns5UyJnkP/TZROLw4tUA=="],

    "@nrwl/jest/@jest/test-result/@jest/console/jest-message-util/pretty-format/@jest/schemas": ["@jest/schemas@28.1.3", "https://registry.npmjs.org/@jest/schemas/-/schemas-28.1.3.tgz", { "dependencies": { "@sinclair/typebox": "^0.24.1" } }, "sha512-/l/VWsdt/aBXgjshLWOFyFt3IVdYypu5y2Wn2rOO1un6nkqIn8SLXzgIMYXFyYsRWDyF5EthmKJMIdJvk08grg=="],

    "@nrwl/jest/@jest/test-result/@jest/console/jest-message-util/pretty-format/ansi-styles": ["ansi-styles@5.2.0", "https://registry.npmjs.org/ansi-styles/-/ansi-styles-5.2.0.tgz", {}, "sha512-Cxwpt2SfTzTtXcfOlzGEee8O+c+MmUgGrNiBcXnuWxuFJHe6a5Hz7qwhwe5OgaSYI0IJvkLqWX1ASG+cJOkEiA=="],

    "@nrwl/jest/jest-config/@jest/test-sequencer/@jest/test-result/@jest/console/jest-message-util": ["jest-message-util@28.1.3", "https://registry.npmjs.org/jest-message-util/-/jest-message-util-28.1.3.tgz", { "dependencies": { "@babel/code-frame": "^7.12.13", "@jest/types": "^28.1.3", "@types/stack-utils": "^2.0.0", "chalk": "^4.0.0", "graceful-fs": "^4.2.9", "micromatch": "^4.0.4", "pretty-format": "^28.1.3", "slash": "^3.0.0", "stack-utils": "^2.0.3" } }, "sha512-PFdn9Iewbt575zKPf1286Ht9EPoJmYT7P0kY+RibeYZ2XtOr53pDLEFoTWXbd1h4JiGiWpTBC84fc8xMXQMb7g=="],

    "@nrwl/jest/jest-config/@jest/test-sequencer/@jest/test-result/@jest/console/jest-util": ["jest-util@28.1.3", "https://registry.npmjs.org/jest-util/-/jest-util-28.1.3.tgz", { "dependencies": { "@jest/types": "^28.1.3", "@types/node": "*", "chalk": "^4.0.0", "ci-info": "^3.2.0", "graceful-fs": "^4.2.9", "picomatch": "^2.2.3" } }, "sha512-XdqfpHwpcSRko/C35uLYFM2emRAltIIKZiJ9eAmhjsj0CqZMa0p1ib0R5fWIqGhn1a103DebTbpqIaP1qCQ6tQ=="],

    "@nrwl/jest/jest-config/@jest/test-sequencer/jest-haste-map/jest-worker/supports-color": ["supports-color@8.1.1", "https://registry.npmjs.org/supports-color/-/supports-color-8.1.1.tgz", { "dependencies": { "has-flag": "^4.0.0" } }, "sha512-MpUEN2OodtUzxvKQl72cUF7RQ5EiHsGvSsVG0ia9c5RbWGL2CI4C7EpPS8UTBIplnlzZiNuV56w+FuNxy3ty2Q=="],

    "@nrwl/jest/jest-config/babel-jest/@jest/transform/jest-haste-map/jest-worker": ["jest-worker@28.1.3", "https://registry.npmjs.org/jest-worker/-/jest-worker-28.1.3.tgz", { "dependencies": { "@types/node": "*", "merge-stream": "^2.0.0", "supports-color": "^8.0.0" } }, "sha512-CqRA220YV/6jCo8VWvAt1KKx6eek1VIHMPeLEbpcfSfkEeWyBNppynM/o6q+Wmw+sOhos2ml34wZbSX3G13//g=="],

    "@nrwl/jest/jest-config/jest-circus/@jest/environment/@jest/fake-timers/@sinonjs/fake-timers": ["@sinonjs/fake-timers@9.1.2", "https://registry.npmjs.org/@sinonjs/fake-timers/-/fake-timers-9.1.2.tgz", { "dependencies": { "@sinonjs/commons": "^1.7.0" } }, "sha512-BPS4ynJW/o92PUR4wgriz2Ud5gpST5vz6GQfMixEDK0Z8ZCUv2M7SkBLykH56T++Xs+8ln9zTGbOvNGIe02/jw=="],

    "@nrwl/jest/jest-config/jest-circus/@jest/expect/expect/@jest/expect-utils": ["@jest/expect-utils@28.1.3", "https://registry.npmjs.org/@jest/expect-utils/-/expect-utils-28.1.3.tgz", { "dependencies": { "jest-get-type": "^28.0.2" } }, "sha512-wvbi9LUrHJLn3NlDW6wF2hvIMtd4JUl2QNVrjq+IBSHirgfrR3o9RnVtxzdEGO2n9JyIWwHnLfby5KzqBGg2YA=="],

    "@nrwl/jest/jest-config/jest-circus/jest-matcher-utils/jest-diff/diff-sequences": ["diff-sequences@28.1.1", "https://registry.npmjs.org/diff-sequences/-/diff-sequences-28.1.1.tgz", {}, "sha512-FU0iFaH/E23a+a718l8Qa/19bF9p06kgE0KipMOMadwa3SjnaElKzPaUC0vnibs6/B/9ni97s61mcejk8W1fQw=="],

    "@nrwl/jest/jest-config/jest-circus/jest-runtime/@jest/fake-timers/@sinonjs/fake-timers": ["@sinonjs/fake-timers@9.1.2", "https://registry.npmjs.org/@sinonjs/fake-timers/-/fake-timers-9.1.2.tgz", { "dependencies": { "@sinonjs/commons": "^1.7.0" } }, "sha512-BPS4ynJW/o92PUR4wgriz2Ud5gpST5vz6GQfMixEDK0Z8ZCUv2M7SkBLykH56T++Xs+8ln9zTGbOvNGIe02/jw=="],

    "@nrwl/jest/jest-config/jest-circus/jest-runtime/@jest/transform/convert-source-map": ["convert-source-map@1.9.0", "https://registry.npmjs.org/convert-source-map/-/convert-source-map-1.9.0.tgz", {}, "sha512-ASFBup0Mz1uyiIjANan1jzLQami9z1PoYSZCiiYW2FczPbenXc45FZdBZLzOT+r6+iciuEModtmCti+hjaAk0A=="],

    "@nrwl/jest/jest-config/jest-circus/jest-runtime/jest-haste-map/jest-worker": ["jest-worker@28.1.3", "https://registry.npmjs.org/jest-worker/-/jest-worker-28.1.3.tgz", { "dependencies": { "@types/node": "*", "merge-stream": "^2.0.0", "supports-color": "^8.0.0" } }, "sha512-CqRA220YV/6jCo8VWvAt1KKx6eek1VIHMPeLEbpcfSfkEeWyBNppynM/o6q+Wmw+sOhos2ml34wZbSX3G13//g=="],

    "@nrwl/jest/jest-config/jest-circus/jest-snapshot/@jest/transform/convert-source-map": ["convert-source-map@1.9.0", "https://registry.npmjs.org/convert-source-map/-/convert-source-map-1.9.0.tgz", {}, "sha512-ASFBup0Mz1uyiIjANan1jzLQami9z1PoYSZCiiYW2FczPbenXc45FZdBZLzOT+r6+iciuEModtmCti+hjaAk0A=="],

    "@nrwl/jest/jest-config/jest-circus/jest-snapshot/jest-diff/diff-sequences": ["diff-sequences@28.1.1", "https://registry.npmjs.org/diff-sequences/-/diff-sequences-28.1.1.tgz", {}, "sha512-FU0iFaH/E23a+a718l8Qa/19bF9p06kgE0KipMOMadwa3SjnaElKzPaUC0vnibs6/B/9ni97s61mcejk8W1fQw=="],

    "@nrwl/jest/jest-config/jest-circus/jest-snapshot/jest-haste-map/jest-worker": ["jest-worker@28.1.3", "https://registry.npmjs.org/jest-worker/-/jest-worker-28.1.3.tgz", { "dependencies": { "@types/node": "*", "merge-stream": "^2.0.0", "supports-color": "^8.0.0" } }, "sha512-CqRA220YV/6jCo8VWvAt1KKx6eek1VIHMPeLEbpcfSfkEeWyBNppynM/o6q+Wmw+sOhos2ml34wZbSX3G13//g=="],

    "@nrwl/jest/jest-config/jest-environment-node/@jest/fake-timers/@sinonjs/fake-timers/@sinonjs/commons": ["@sinonjs/commons@1.8.6", "https://registry.npmjs.org/@sinonjs/commons/-/commons-1.8.6.tgz", { "dependencies": { "type-detect": "4.0.8" } }, "sha512-Ky+XkAkqPZSm3NLBeUng77EBQl3cmeJhITaGHdYH8kjVB+aun3S4XBRti2zt17mtt0mIUDiNxYeoJm6drVvBJQ=="],

    "@nrwl/jest/jest-config/jest-runner/@jest/environment/@jest/fake-timers/@sinonjs/fake-timers": ["@sinonjs/fake-timers@9.1.2", "https://registry.npmjs.org/@sinonjs/fake-timers/-/fake-timers-9.1.2.tgz", { "dependencies": { "@sinonjs/commons": "^1.7.0" } }, "sha512-BPS4ynJW/o92PUR4wgriz2Ud5gpST5vz6GQfMixEDK0Z8ZCUv2M7SkBLykH56T++Xs+8ln9zTGbOvNGIe02/jw=="],

    "@nrwl/jest/jest-config/jest-runner/jest-runtime/@jest/fake-timers/@sinonjs/fake-timers": ["@sinonjs/fake-timers@9.1.2", "https://registry.npmjs.org/@sinonjs/fake-timers/-/fake-timers-9.1.2.tgz", { "dependencies": { "@sinonjs/commons": "^1.7.0" } }, "sha512-BPS4ynJW/o92PUR4wgriz2Ud5gpST5vz6GQfMixEDK0Z8ZCUv2M7SkBLykH56T++Xs+8ln9zTGbOvNGIe02/jw=="],

    "@nrwl/jest/jest-config/jest-runner/jest-runtime/@jest/globals/@jest/expect": ["@jest/expect@28.1.3", "https://registry.npmjs.org/@jest/expect/-/expect-28.1.3.tgz", { "dependencies": { "expect": "^28.1.3", "jest-snapshot": "^28.1.3" } }, "sha512-lzc8CpUbSoE4dqT0U+g1qODQjBRHPpCPXissXD4mS9+sWQdmmpeJ9zSH1rS1HEkrsMN0fb7nKrJ9giAR1d3wBw=="],

    "@nrwl/jest/jest-config/jest-runner/jest-runtime/jest-snapshot/@jest/expect-utils": ["@jest/expect-utils@28.1.3", "https://registry.npmjs.org/@jest/expect-utils/-/expect-utils-28.1.3.tgz", { "dependencies": { "jest-get-type": "^28.0.2" } }, "sha512-wvbi9LUrHJLn3NlDW6wF2hvIMtd4JUl2QNVrjq+IBSHirgfrR3o9RnVtxzdEGO2n9JyIWwHnLfby5KzqBGg2YA=="],

    "@nrwl/jest/jest-config/jest-runner/jest-runtime/jest-snapshot/expect": ["expect@28.1.3", "https://registry.npmjs.org/expect/-/expect-28.1.3.tgz", { "dependencies": { "@jest/expect-utils": "^28.1.3", "jest-get-type": "^28.0.2", "jest-matcher-utils": "^28.1.3", "jest-message-util": "^28.1.3", "jest-util": "^28.1.3" } }, "sha512-eEh0xn8HlsuOBxFgIss+2mX85VAS4Qy3OSkjV7rlBWljtA4oWH37glVGyOZSZvErDT/yBywZdPGwCXuTvSG85g=="],

    "@nrwl/jest/jest-config/jest-runner/jest-runtime/jest-snapshot/jest-diff": ["jest-diff@28.1.3", "https://registry.npmjs.org/jest-diff/-/jest-diff-28.1.3.tgz", { "dependencies": { "chalk": "^4.0.0", "diff-sequences": "^28.1.1", "jest-get-type": "^28.0.2", "pretty-format": "^28.1.3" } }, "sha512-8RqP1B/OXzjjTWkqMX67iqgwBVJRgCyKD3L9nq+6ZqJMdvjE8RgHktqZ6jNrkdMT+dJuYNI3rhQpxaz7drJHfw=="],

    "@nrwl/jest/jest-config/jest-runner/jest-runtime/jest-snapshot/jest-matcher-utils": ["jest-matcher-utils@28.1.3", "https://registry.npmjs.org/jest-matcher-utils/-/jest-matcher-utils-28.1.3.tgz", { "dependencies": { "chalk": "^4.0.0", "jest-diff": "^28.1.3", "jest-get-type": "^28.0.2", "pretty-format": "^28.1.3" } }, "sha512-kQeJ7qHemKfbzKoGjHHrRKH6atgxMk8Enkk2iPQ3XwO6oE/KYD8lMYOziCkeSB9G4adPM4nR1DE8Tf5JeWH6Bw=="],

    "@nrwl/jest/jest-config/jest-runner/jest-runtime/jest-snapshot/semver": ["semver@7.7.2", "https://registry.npmjs.org/semver/-/semver-7.7.2.tgz", { "bin": { "semver": "bin/semver.js" } }, "sha512-RF0Fw+rO5AMf9MAyaRXI4AV0Ulj5lMHqVxxdSgiVbixSCXoEmmX/jk0CuJw4+3SqroYO9VoUh+HcuJivvtJemA=="],

    "@nrwl/jest/jest-resolve/jest-haste-map/@jest/types/@jest/schemas/@sinclair/typebox": ["@sinclair/typebox@0.24.51", "https://registry.npmjs.org/@sinclair/typebox/-/typebox-0.24.51.tgz", {}, "sha512-1P1OROm/rdubP5aFDSZQILU0vrLCJ4fvHt6EoqHEM+2D/G5MK3bIaymUKLit8Js9gbns5UyJnkP/TZROLw4tUA=="],

    "@nrwl/jest/jest-resolve/jest-validate/@jest/types/@jest/schemas/@sinclair/typebox": ["@sinclair/typebox@0.24.51", "https://registry.npmjs.org/@sinclair/typebox/-/typebox-0.24.51.tgz", {}, "sha512-1P1OROm/rdubP5aFDSZQILU0vrLCJ4fvHt6EoqHEM+2D/G5MK3bIaymUKLit8Js9gbns5UyJnkP/TZROLw4tUA=="],

    "@nrwl/jest/jest-resolve/jest-validate/pretty-format/@jest/schemas/@sinclair/typebox": ["@sinclair/typebox@0.24.51", "https://registry.npmjs.org/@sinclair/typebox/-/typebox-0.24.51.tgz", {}, "sha512-1P1OROm/rdubP5aFDSZQILU0vrLCJ4fvHt6EoqHEM+2D/G5MK3bIaymUKLit8Js9gbns5UyJnkP/TZROLw4tUA=="],

    "@nrwl/jest/@jest/test-result/@jest/console/jest-message-util/pretty-format/@jest/schemas/@sinclair/typebox": ["@sinclair/typebox@0.24.51", "https://registry.npmjs.org/@sinclair/typebox/-/typebox-0.24.51.tgz", {}, "sha512-1P1OROm/rdubP5aFDSZQILU0vrLCJ4fvHt6EoqHEM+2D/G5MK3bIaymUKLit8Js9gbns5UyJnkP/TZROLw4tUA=="],

    "@nrwl/jest/jest-config/babel-jest/@jest/transform/jest-haste-map/jest-worker/supports-color": ["supports-color@8.1.1", "https://registry.npmjs.org/supports-color/-/supports-color-8.1.1.tgz", { "dependencies": { "has-flag": "^4.0.0" } }, "sha512-MpUEN2OodtUzxvKQl72cUF7RQ5EiHsGvSsVG0ia9c5RbWGL2CI4C7EpPS8UTBIplnlzZiNuV56w+FuNxy3ty2Q=="],

    "@nrwl/jest/jest-config/jest-circus/@jest/environment/@jest/fake-timers/@sinonjs/fake-timers/@sinonjs/commons": ["@sinonjs/commons@1.8.6", "https://registry.npmjs.org/@sinonjs/commons/-/commons-1.8.6.tgz", { "dependencies": { "type-detect": "4.0.8" } }, "sha512-Ky+XkAkqPZSm3NLBeUng77EBQl3cmeJhITaGHdYH8kjVB+aun3S4XBRti2zt17mtt0mIUDiNxYeoJm6drVvBJQ=="],

    "@nrwl/jest/jest-config/jest-circus/jest-runtime/@jest/fake-timers/@sinonjs/fake-timers/@sinonjs/commons": ["@sinonjs/commons@1.8.6", "https://registry.npmjs.org/@sinonjs/commons/-/commons-1.8.6.tgz", { "dependencies": { "type-detect": "4.0.8" } }, "sha512-Ky+XkAkqPZSm3NLBeUng77EBQl3cmeJhITaGHdYH8kjVB+aun3S4XBRti2zt17mtt0mIUDiNxYeoJm6drVvBJQ=="],

    "@nrwl/jest/jest-config/jest-circus/jest-runtime/jest-haste-map/jest-worker/supports-color": ["supports-color@8.1.1", "https://registry.npmjs.org/supports-color/-/supports-color-8.1.1.tgz", { "dependencies": { "has-flag": "^4.0.0" } }, "sha512-MpUEN2OodtUzxvKQl72cUF7RQ5EiHsGvSsVG0ia9c5RbWGL2CI4C7EpPS8UTBIplnlzZiNuV56w+FuNxy3ty2Q=="],

    "@nrwl/jest/jest-config/jest-circus/jest-snapshot/jest-haste-map/jest-worker/supports-color": ["supports-color@8.1.1", "https://registry.npmjs.org/supports-color/-/supports-color-8.1.1.tgz", { "dependencies": { "has-flag": "^4.0.0" } }, "sha512-MpUEN2OodtUzxvKQl72cUF7RQ5EiHsGvSsVG0ia9c5RbWGL2CI4C7EpPS8UTBIplnlzZiNuV56w+FuNxy3ty2Q=="],

    "@nrwl/jest/jest-config/jest-runner/@jest/environment/@jest/fake-timers/@sinonjs/fake-timers/@sinonjs/commons": ["@sinonjs/commons@1.8.6", "https://registry.npmjs.org/@sinonjs/commons/-/commons-1.8.6.tgz", { "dependencies": { "type-detect": "4.0.8" } }, "sha512-Ky+XkAkqPZSm3NLBeUng77EBQl3cmeJhITaGHdYH8kjVB+aun3S4XBRti2zt17mtt0mIUDiNxYeoJm6drVvBJQ=="],

    "@nrwl/jest/jest-config/jest-runner/jest-runtime/@jest/fake-timers/@sinonjs/fake-timers/@sinonjs/commons": ["@sinonjs/commons@1.8.6", "https://registry.npmjs.org/@sinonjs/commons/-/commons-1.8.6.tgz", { "dependencies": { "type-detect": "4.0.8" } }, "sha512-Ky+XkAkqPZSm3NLBeUng77EBQl3cmeJhITaGHdYH8kjVB+aun3S4XBRti2zt17mtt0mIUDiNxYeoJm6drVvBJQ=="],

    "@nrwl/jest/jest-config/jest-runner/jest-runtime/@jest/globals/@jest/expect/expect": ["expect@28.1.3", "https://registry.npmjs.org/expect/-/expect-28.1.3.tgz", { "dependencies": { "@jest/expect-utils": "^28.1.3", "jest-get-type": "^28.0.2", "jest-matcher-utils": "^28.1.3", "jest-message-util": "^28.1.3", "jest-util": "^28.1.3" } }, "sha512-eEh0xn8HlsuOBxFgIss+2mX85VAS4Qy3OSkjV7rlBWljtA4oWH37glVGyOZSZvErDT/yBywZdPGwCXuTvSG85g=="],

    "@nrwl/jest/jest-config/jest-runner/jest-runtime/jest-snapshot/jest-diff/diff-sequences": ["diff-sequences@28.1.1", "https://registry.npmjs.org/diff-sequences/-/diff-sequences-28.1.1.tgz", {}, "sha512-FU0iFaH/E23a+a718l8Qa/19bF9p06kgE0KipMOMadwa3SjnaElKzPaUC0vnibs6/B/9ni97s61mcejk8W1fQw=="],

    "@nrwl/jest/jest-config/jest-runner/jest-runtime/@jest/globals/@jest/expect/expect/@jest/expect-utils": ["@jest/expect-utils@28.1.3", "https://registry.npmjs.org/@jest/expect-utils/-/expect-utils-28.1.3.tgz", { "dependencies": { "jest-get-type": "^28.0.2" } }, "sha512-wvbi9LUrHJLn3NlDW6wF2hvIMtd4JUl2QNVrjq+IBSHirgfrR3o9RnVtxzdEGO2n9JyIWwHnLfby5KzqBGg2YA=="],

    "@nrwl/jest/jest-config/jest-runner/jest-runtime/@jest/globals/@jest/expect/expect/jest-matcher-utils": ["jest-matcher-utils@28.1.3", "https://registry.npmjs.org/jest-matcher-utils/-/jest-matcher-utils-28.1.3.tgz", { "dependencies": { "chalk": "^4.0.0", "jest-diff": "^28.1.3", "jest-get-type": "^28.0.2", "pretty-format": "^28.1.3" } }, "sha512-kQeJ7qHemKfbzKoGjHHrRKH6atgxMk8Enkk2iPQ3XwO6oE/KYD8lMYOziCkeSB9G4adPM4nR1DE8Tf5JeWH6Bw=="],

    "@nrwl/jest/jest-config/jest-runner/jest-runtime/@jest/globals/@jest/expect/expect/jest-matcher-utils/jest-diff": ["jest-diff@28.1.3", "https://registry.npmjs.org/jest-diff/-/jest-diff-28.1.3.tgz", { "dependencies": { "chalk": "^4.0.0", "diff-sequences": "^28.1.1", "jest-get-type": "^28.0.2", "pretty-format": "^28.1.3" } }, "sha512-8RqP1B/OXzjjTWkqMX67iqgwBVJRgCyKD3L9nq+6ZqJMdvjE8RgHktqZ6jNrkdMT+dJuYNI3rhQpxaz7drJHfw=="],

    "@nrwl/jest/jest-config/jest-runner/jest-runtime/@jest/globals/@jest/expect/expect/jest-matcher-utils/jest-diff/diff-sequences": ["diff-sequences@28.1.1", "https://registry.npmjs.org/diff-sequences/-/diff-sequences-28.1.1.tgz", {}, "sha512-FU0iFaH/E23a+a718l8Qa/19bF9p06kgE0KipMOMadwa3SjnaElKzPaUC0vnibs6/B/9ni97s61mcejk8W1fQw=="],
  }
}`;
