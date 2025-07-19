export const complexScenariosLockFile = `{
  "lockfileVersion": 1,
  "workspaces": {
    "": {
      "name": "complex-scenarios-test",
      "dependencies": {
        "@types/node": "^18.16.0",
        "debug": "github:debug-js/debug#4.3.4",
        "file-dep": "file:./local-package",
        "lodash": "^4.17.21",
        "react": "^18.2.0",
      },
      "devDependencies": {
        "@jest/types": "^29.0.0",
        "local-test": "file:./test-utils",
      },
      "optionalDependencies": {
        "fsevents": "^2.3.2",
      },
      "peerDependencies": {
        "typescript": ">=4.0.0",
      },
    },
  },
  "packages": {
    "@jest/schemas": ["@jest/schemas@29.6.3", "https://registry.npmjs.org/@jest/schemas/-/schemas-29.6.3.tgz", { "dependencies": { "@sinclair/typebox": "^0.27.8" } }, "sha512-mo5j5X+jIZmJQveBKeS/clAueipV7KgiX1vMgCxam1RNYiqE1w62n0/tJJnHtjW8ZHcQco5gY85jA3mi0L+nSA=="],

    "@jest/types": ["@jest/types@29.6.3", "https://registry.npmjs.org/@jest/types/-/types-29.6.3.tgz", { "dependencies": { "@jest/schemas": "^29.6.3", "@types/istanbul-lib-coverage": "^2.0.0", "@types/istanbul-reports": "^3.0.0", "@types/node": "*", "@types/yargs": "^17.0.8", "chalk": "^4.0.0" } }, "sha512-u3UPsIilWKOM3F9CXtrG8LEJmNxwoCQC/XVj4IKYXvvpx7QIi/Kg1LI5uDmDpKlac62NUtX7eLjRh+jVZcLOzw=="],

    "@sinclair/typebox": ["@sinclair/typebox@0.27.8", "https://registry.npmjs.org/@sinclair/typebox/-/typebox-0.27.8.tgz", {}, "sha512-+Fj43pSMwJs4KRrH/938Uf+uAELIgVBmQzg/q1YG10djyfA3TnrU8N8XzqCh/okZdszqBQTZf96idMfE5lnwTA=="],

    "@types/istanbul-lib-coverage": ["@types/istanbul-lib-coverage@2.0.6", "https://registry.npmjs.org/@types/istanbul-lib-coverage/-/istanbul-lib-coverage-2.0.6.tgz", {}, "sha512-2QF/t/auWm0lsy8XtKVPG19v3sSOQlJe/YHZgfjb/KBBHOGSV+J2q/S671rcq9uTBrLAXmZpqJiaQbMT+zNU1w=="],

    "@types/istanbul-lib-report": ["@types/istanbul-lib-report@3.0.3", "https://registry.npmjs.org/@types/istanbul-lib-report/-/istanbul-lib-report-3.0.3.tgz", { "dependencies": { "@types/istanbul-lib-coverage": "*" } }, "sha512-NQn7AHQnk/RSLOxrBbGyJM/aVQ+pjj5HCgasFxc0K/KhoATfQ/47AyUl15I2yBUpihjmas+a+VJBOqecrFH+uA=="],

    "@types/istanbul-reports": ["@types/istanbul-reports@3.0.4", "https://registry.npmjs.org/@types/istanbul-reports/-/istanbul-reports-3.0.4.tgz", { "dependencies": { "@types/istanbul-lib-report": "*" } }, "sha512-pk2B1NWalF9toCRu6gjBzR69syFjP4Od8WRAX+0mmf9lAjCRicLOWc+ZrxZHx/0XRjotgkF9t6iaMJ+aXcOdZQ=="],

    "@types/node": ["@types/node@18.19.119", "https://registry.npmjs.org/@types/node/-/node-18.19.119.tgz", { "dependencies": { "undici-types": "~5.26.4" } }, "sha512-d0F6m9itIPaKnrvEMlzE48UjwZaAnFW7Jwibacw9MNdqadjKNpUm9tfJYDwmShJmgqcoqYUX3EMKO1+RWiuuNg=="],

    "@types/yargs": ["@types/yargs@17.0.33", "https://registry.npmjs.org/@types/yargs/-/yargs-17.0.33.tgz", { "dependencies": { "@types/yargs-parser": "*" } }, "sha512-WpxBCKWPLr4xSsHgz511rFJAM+wS28w2zEO1QDNY5zM/S8ok70NNfztH0xwhqKyaK0OHCbN98LDAZuy1ctxDkA=="],

    "@types/yargs-parser": ["@types/yargs-parser@21.0.3", "https://registry.npmjs.org/@types/yargs-parser/-/yargs-parser-21.0.3.tgz", {}, "sha512-I4q9QU9MQv4oEOz4tAHJtNz1cwuLxn2F3xcc2iV5WdqLPpUnj30aUuxt1mAxYTG+oe8CZMV/+6rU4S4gRDzqtQ=="],

    "ansi-styles": ["ansi-styles@4.3.0", "https://registry.npmjs.org/ansi-styles/-/ansi-styles-4.3.0.tgz", { "dependencies": { "color-convert": "^2.0.1" } }, "sha512-zbB9rCJAT1rbjiVDb2hqKFHNYLxgtk8NURxZ3IZwD3F6NtxbXZQCnnSi1Lkx+IDohdPlFp222wVALIheZJQSEg=="],

    "chalk": ["chalk@4.1.2", "https://registry.npmjs.org/chalk/-/chalk-4.1.2.tgz", { "dependencies": { "ansi-styles": "^4.1.0", "supports-color": "^7.1.0" } }, "sha512-oKnbhFyRIXpUuez8iBMmyEa4nbj4IOQyuhc/wy9kY7/WVPcwIO9VA668Pu8RkO7+0G76SLROeyw9CpQ061i4mA=="],

    "color-convert": ["color-convert@2.0.1", "https://registry.npmjs.org/color-convert/-/color-convert-2.0.1.tgz", { "dependencies": { "color-name": "~1.1.4" } }, "sha512-RRECPsj7iu/xb5oKYcsFHSppFNnsj/52OVTRKb4zP5onXwVF3zVmmToNcOfGC+CRDpfK/U584fMg38ZHCaElKQ=="],

    "color-name": ["color-name@1.1.4", "https://registry.npmjs.org/color-name/-/color-name-1.1.4.tgz", {}, "sha512-dOy+3AuW3a2wNbZHIuMZpTcgjGuLU/uBL/ubcZF9OXbDo8ff4O8yVp5Bf0efS8uEoYo5q4Fx7dY9OgQGXgAsQA=="],

    "debug": ["debug@github:debug-js/debug#6add244", { "dependencies": { "ms": "2.1.2" } }, "debug-js-debug-6add244"],

    "file-dep": ["local-package@file:local-package", {}],

    "fsevents": ["fsevents@2.3.3", "https://registry.npmjs.org/fsevents/-/fsevents-2.3.3.tgz", { "os": "darwin" }, "sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw=="],

    "has-flag": ["has-flag@4.0.0", "https://registry.npmjs.org/has-flag/-/has-flag-4.0.0.tgz", {}, "sha512-EykJT/Q1KjTWctppgIAgfSO0tKVuZUjhgMr17kqTumMl6Afv3EISleU7qZUzoXDFTAHTDC4NOoG/ZxU3EvlMPQ=="],

    "js-tokens": ["js-tokens@4.0.0", "https://registry.npmjs.org/js-tokens/-/js-tokens-4.0.0.tgz", {}, "sha512-RdJUflcE3cUzKiMqQgsCu06FPu9UdIJO0beYbPhHN4k6apgJtifcoCtT9bcxOpYBtpD2kCM6Sbzg4CausW/PKQ=="],

    "local-test": ["test-utils@file:test-utils", {}],

    "lodash": ["lodash@4.17.21", "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz", {}, "sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg=="],

    "loose-envify": ["loose-envify@1.4.0", "https://registry.npmjs.org/loose-envify/-/loose-envify-1.4.0.tgz", { "dependencies": { "js-tokens": "^3.0.0 || ^4.0.0" }, "bin": { "loose-envify": "cli.js" } }, "sha512-lyuxPGr/Wfhrlem2CL/UcnUc1zcqKAImBDzukY7Y5F/yQiNdko6+fRLevlw1HgMySw7f611UIY408EtxRSoK3Q=="],

    "ms": ["ms@2.1.2", "https://registry.npmjs.org/ms/-/ms-2.1.2.tgz", {}, "sha512-sGkPx+VjMtmA6MX27oA4FBFELFCZZ4S4XqeGOXCv68tT+jb3vk/RyaKWP0PTKyWtmLSM0b+adUTEvbs1PEaH2w=="],

    "react": ["react@18.3.1", "https://registry.npmjs.org/react/-/react-18.3.1.tgz", { "dependencies": { "loose-envify": "^1.1.0" } }, "sha512-wS+hAgJShR0KhEvPJArfuPVN1+Hz1t0Y6n5jLrGQbkb4urgPE/0Rve+1kMB1v/oWgHgm4WIcV+i7F2pTVj+2iQ=="],

    "supports-color": ["supports-color@7.2.0", "https://registry.npmjs.org/supports-color/-/supports-color-7.2.0.tgz", { "dependencies": { "has-flag": "^4.0.0" } }, "sha512-qpCAvRl9stuOHveKsn7HncJRvv501qIacKzQlO/+Lwxc9+0q2wLyv4Dfvt80/DPn2pqOBsJdDiogXGR9+OvwRw=="],

    "typescript": ["typescript@5.8.3", "https://registry.npmjs.org/typescript/-/typescript-5.8.3.tgz", { "bin": { "tsc": "bin/tsc", "tsserver": "bin/tsserver" } }, "sha512-p1diW6TqL9L07nNxvRMM7hMMw4c5XOo/1ibL4aAIGmSAt9slTE1Xgw5KWuof2uTOvCg9BY7ZRi+GaF+7sfgPeQ=="],

    "undici-types": ["undici-types@5.26.5", "https://registry.npmjs.org/undici-types/-/undici-types-5.26.5.tgz", {}, "sha512-JlCMO+ehdEIKqlFxk6IfVoAUVmgz7cU7zD/h9XZ0qzeosSHmUJVOzSQvvYSYWXkFXC+IfLKSIffhv0sVZup6pA=="],
  }
}`;
