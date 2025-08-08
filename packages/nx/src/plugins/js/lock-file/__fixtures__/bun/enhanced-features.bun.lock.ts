export const enhancedFeaturesBunLock = `{
  "lockfileVersion": 1,
  "workspaces": {
    "": {
      "name": "enhanced-features-test",
      "dependencies": {
        "chalk": "^5.3.0",
        "lodash": "^4.17.21",
        "react": "^18.2.0",
      },
      "devDependencies": {
        "typescript": "^5.0.0",
      },
    },
    "packages/app": {
      "name": "app",
      "version": "1.0.0",
      "dependencies": {
        "workspace-lib": "workspace:*",
      },
    },
    "packages/workspace-lib": {
      "name": "workspace-lib",
      "version": "1.0.0",
      "dependencies": {
        "lodash": "^4.17.21",
      },
    },
  },
  "trustedDependencies": [
    "typescript",
  ],
  "packages": {
    "app": ["app@workspace:packages/app"],

    "chalk": ["chalk@5.4.1", "https://registry.npmjs.org/chalk/-/chalk-5.4.1.tgz", {}, "sha512-zgVZuo2WcZgfUEmsn6eO3kINexW8RAE4maiQ8QNs8CtpPCSyMiYsULR3HQYkm3w8FIA3SberyMJMSldGsW+U3w=="],

    "js-tokens": ["js-tokens@4.0.0", "https://registry.npmjs.org/js-tokens/-/js-tokens-4.0.0.tgz", {}, "sha512-RdJUflcE3cUzKiMqQgsCu06FPu9UdIJO0beYbPhHN4k6apgJtifcoCtT9bcxOpYBtpD2kCM6Sbzg4CausW/PKQ=="],

    "lodash": ["lodash@4.17.21", "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz", {}, "sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg=="],

    "loose-envify": ["loose-envify@1.4.0", "https://registry.npmjs.org/loose-envify/-/loose-envify-1.4.0.tgz", { "dependencies": { "js-tokens": "^3.0.0 || ^4.0.0" }, "bin": { "loose-envify": "cli.js" } }, "sha512-lyuxPGr/Wfhrlem2CL/UcnUc1zcqKAImBDzukY7Y5F/yQiNdko6+fRLevlw1HgMySw7f611UIY408EtxRSoK3Q=="],

    "react": ["react@18.3.1", "https://registry.npmjs.org/react/-/react-18.3.1.tgz", { "dependencies": { "loose-envify": "^1.1.0" } }, "sha512-wS+hAgJShR0KhEvPJArfuPVN1+Hz1t0Y6n5jLrGQbkb4urgPE/0Rve+1kMB1v/oWgHgm4WIcV+i7F2pTVj+2iQ=="],

    "typescript": ["typescript@5.8.3", "https://registry.npmjs.org/typescript/-/typescript-5.8.3.tgz", { "bin": { "tsc": "bin/tsc", "tsserver": "bin/tsserver" } }, "sha512-p1diW6TqL9L07nNxvRMM7hMMw4c5XOo/1ibL4aAIGmSAt9slTE1Xgw5KWuof2uTOvCg9BY7ZRi+GaF+7sfgPeQ=="],

    "workspace-lib": ["workspace-lib@workspace:packages/workspace-lib"],
  }
}`;
