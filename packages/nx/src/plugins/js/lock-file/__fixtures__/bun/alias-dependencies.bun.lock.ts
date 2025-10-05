export const aliasDependenciesBunLock = `{
  "lockfileVersion": 1,
  "workspaces": {
    "": {
      "name": "alias-dependencies-test",
      "dependencies": {
        "eslint-plugin-disable-autofix": "npm:@mattlewis92/eslint-plugin-disable-autofix@3.0.0",
        "pretty-format": "npm:pretty-format@29.7.0",
        "scoped-alias": "npm:@types/node@18.15.0",
      },
      "devDependencies": {
        "alias-dev": "npm:typescript@5.0.4",
      },
    },
  },
  "packages": {
    "eslint-plugin-disable-autofix": ["@mattlewis92/eslint-plugin-disable-autofix@3.0.0", "", { "dependencies": { "app-root-path": "^3.1.0", "eslint": "^8.16.0", "eslint-rule-composer": "^0.3.0", "scoped-alias": "npm:@types/node@18.15.0" } }, "sha512-zYDdpaj+1Al8Ki3WpY2I9bOAd8NSgFWGT7yR6KemSi25qWwDMNArnR2q6gDEDKSw+KuYY4shFxkY/JpoNF64tg=="],

    "pretty-format": ["pretty-format@29.7.0", "", { "dependencies": { "@jest/schemas": "^29.6.3", "ansi-styles": "^5.0.0", "react-is": "^18.0.0", "alias-dev": "npm:typescript@5.0.4" } }, "sha512-Pdlw/oPxN+aXdmM9R00JVC9WVFoCLTKJvDVLgmJ+qAffBMxsV85l/Lu7sNx4zSzPyoL2euImuEwHhOXdEgNFZQ=="],

    "scoped-alias": ["@types/node@18.15.0", "", { "dependencies": { "pretty-format": "npm:pretty-format@29.7.0" } }, "sha512-z6nr0TTEOBGkzLGmbypWOGnpSpSIBorEhC4L+4HeQ2iezKCi4f77kyslRwvHeNitymGQ+oFyIWGP96l/DPSV9w=="],

    "alias-dev": ["typescript@5.0.4", "", { "bin": { "tsc": "bin/tsc", "tsserver": "bin/tsserver" }, "dependencies": { "eslint-plugin-disable-autofix": "npm:@mattlewis92/eslint-plugin-disable-autofix@3.0.0" } }, "sha512-cW9T5W9xY37cc+jfEnaUvX91foxtHkza3Nw3wkoF4sSlKn0MONdkdEndig/qPBWXNkmplh3NzayQzCiHM4/hqw=="],
  }
}`;