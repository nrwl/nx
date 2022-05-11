# Security Scenarios
The following are the three commonly used setups.

## Setup 1: Only main branch has a read-write access token

- A read-only access token is specified in `nx.json`.
- A read-write access token is set using the `NX_CLOUD_ACCESS_TOKEN` env variable in CI only for CI runs on the main/master/development branch.
- The `encryptionKey` value is set in `nx.json`.

In this setup, only builds run against the main branch in CI can upload artifacts to the shared cache that will be used by pull requests and local commands. No one can affect the result of running a command in a pull request or someone else's machine unless they know the read-write token set in CI. This assumes that they have the admin/owner access to the organization in CI. So there is no way to substitute any artifact without knowing the token.

The distributed task execution (DTE) enabled by Nx Cloud works with read-only tokens (so it works for pull requests as well), but the artifacts are scoped to that execution. In other words, artifacts created by a read-only DTE run cannot be accessed by other runs or through the Nx Cloud distributed cache.

The downside of this approach is that pull requests and local commands benefit from the computation run on the main branch, but the main branch doesn't benefit from the computation performed, for instance, on a pull request.

## Setup 2: CI has a read-write access token

- A read-only token is specified in `nx.json`.
- A read-write access token is set using `NX_CLOUD_ACCESS_TOKEN` env variable in CI and is used for pull requests and the main branch.
- The `encryptionKey` value is set in `nx.json`.

This can drastically speed up the CI run against the main branch. The downside is that it is possible for a PR to upload a broken artifact that will be pulled by the main branch and then deployed. To make sure this doesn't happen the CI pipeline can rebuild the artifact, skipping the cache before any deployment. With this, a broken artifact cannot affect the deployment but can temporarily affect what is downloaded on the main branch.

## Setup 3: A read-write access token is stored in `nx.json`

- A read-write token is specified in `nx.json`.

This can speed up CI and local development. The computation performed locally can be shared among developers and CI agents.

## Deciding on a Setup
In small close-sourced projects where developers have similar setups, it's common to have one read-write token shared by all the developers. The token is stored in `nx.json`. Every developer can write artifacts to the cache. Other developers and CI agents can read those values. This assumes a high degree of trust. As with Setup 2, you can still rebuild the artifact from scratch before any deployment.

In large organizations, it's common to have a read token set in `nx.json `and a read-write token set as an `NX_CLOUD_ACCESS_TOKEN` env variable in CI. Developers can benefit from the computation performed on CI but cannot affect the CI execution. Depending on how much you want to isolate the main branch, and what you do with the cached artifacts, you can select between Setup 1 or Setup 2.

## Revoking Access Tokens 

Generally, there is no need to revoke access tokens. To affect the computation run against, say, the main branch, you need to know the computation hash of the command you are trying to affect. You can only know the hash by running the command, so you need to have access to the latest HEAD of the main branch. 

That's why when a developer loses access to the source code, they lose the ability to know the computation hash. They cannot affect any computation even if they know a read-write access token.