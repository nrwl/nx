## Contributing to Nx

We would love for you to contribute to Nx! Read this document to see how to do it.


## Got a Question?

We are trying to keep GitHub issues for bug reports and feature requests. Stack Overflow is a much better place to ask general questions about how to use Nx.



## Building the Project

After cloning the project run: `yarn`.

After that run `yarn build` to build the `bazel`, `nx`, and `schematics` packages.

After that run `yarn linknpm`.

### Running Unit Tests

To make sure you changes do not break any unit tests, run `yarn test`. You can also run `yarn test:schematics` and `yarn test:nx` to test the schematics and nx packages individually.

> If you need to test only the collection ngrx test [for example], you can use an optional `$1` argument as follows:<br/> `yarn test:schematics schematics/src/collection/ngrx/ngrx`

### Running E2E Tests

To make sure you changes do not break any unit tests, run `yarn e2e`. Running e2e tests can take some time, so if it often useful to run a single test. You can do it as follows: `yarn e2e lint`



## Submitting a PR

Please follow the following guidelines:

* Make sure unit tests pass
* Make sure e2e tests pass
* Make sure you run `yarn format`
* Update your commit message to follow the guidelines below

### Commit Message Guidelines

Commit message should follow the following format:

```
type(scope): subject
BLANK LINE
body
```

#### Type

The type must be one of the following:

* build
* feat
* fix
* refactor
* style
* docs
* test

#### Scope

The scope must be one of the following:

* bazel
* nx
* schematics

#### Subject

The subject must contain a description of the change.

#### Example

```
feat(schematics): add an option to generate lazy-loadable modules

`ng generate lib mylib --lazy` provisions the mylib project in tslint.json
```

## Migrations

Nx allows users to automatically upgrade to the newest version of the package. If you are introducing a change that would require the users to upgrade their workspace, add a migration to `packages/schematics/migrations`.

Migrations are named in the following fashion: `YYYYMMDD-name.ts` (e.g., 20171129-change-schema.ts).

The `yarn nx-migrate` command will run all the migrations after the one encoded in .angular-cli.json.
