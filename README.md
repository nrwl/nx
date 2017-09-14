# Nrwl Extensions for Angular

* See packages/bazel/README.md
* See packages/nx/README.md
* See packages/schematics/README.md

## Development Guide

### Building the Project

Running `yarn build` will build all the three packages.

### Running Unit Tests

Running `yarn test` will run unit tests for all the projects.

### Running E2E Tests

Running `yarn e2e` will run e2e tests for all the projects.

### Linking

The bazel package depends on the schematics package. If you make a change in the schematics that you want the bazel package ot pick up, run `yarn link`.

### Packaging

Running `yarn package` will create tgz files for all the projects. You can install them via npm.

### Release

Running `yarn release` will build the packages and push them to `github.com/nrwl/nx-build`, `github.com/nrwl/schematics-build`, `github.com/nrwl/bazel-build`




