# Troubleshooting Jest

## Update Jest Resolver Package List

If you're needing to add package names to include in the [@nrwl/jest resolver](https://github.com/nrwl/nx/blob/master/packages/jest/plugins/resolver.ts), then you can pass a comma seperated list via the `NX_JEST_RESOLVER_PACKAGES` environment variable.

`NX_JEST_RESOLVER_PACKAGES=@some/package,another-package nx test my-cool-project`

Please [open an issue](https://github.com/nrwl/nx/issues/new?assignees=&labels=type%3A+bug,scope%3A+testing+tools&title=Add+package+to+jest+resolver+[package-name-here]&assignees=barbados-clemens&template=1-bug.md) with the package you're having issues with so we can add it to our resolver so you don't need to use the environment variable.

The reason why you might need to do this is because [Jest 28 now supports the package exports](https://jestjs.io/docs/upgrading-to-jest28#packagejson-exports), which can cause Jest to load ESM instead of CJS files.
