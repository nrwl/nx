# Distributed Caching

## Only Build, Test, Lint Once 

...across your entire organization.

When running Nx without Nx Cloud, a [computation cache is created on your local machine](https://nx.dev/using-nx/caching) to make the developer experience faster. This allows you to not waste time re-building, re-testing, re-linting, or any number of other actions you might take on code that hasn’t changed. Since the cache is stored locally, you are the only member of your team that can take advantage of these instant commands.

Nx Cloud allows this cache to be shared across your entire organization, meaning that any cacheable operation completed on your workspace only needs to be run once.

The time savings that this can provide your team are drastic. [This blog post](https://blog.nrwl.io/how-to-never-build-or-test-the-same-code-twice-2dc58e413279) explains how such a simple concept can have a massive impact on productive time for you and your team.

## Caching Priority

Whenever you run a cacheable command with Nx, Nx attempts to fulfill that command using the first successful strategy in the following list:

1. Check the local cache.  If the command is cached there, replay the cached output.
2. Check the Nx Cloud distributed cache.  If the command is cached there, store the cache locally and replay the cached output.
3. Run the command locally.  Store the output in local cache.  If you have a read-write access token, store the output in the Nx Cloud distributed cache.

This algorithm optimizes for speed locally and minimizes unnecessary use of the distributed cache.

## When is a Distributed Cache Helpful?

Generally speaking, the bigger the organization, the more helpful a distributed cache becomes.  However, distributed cache is still useful even in the following scenarios with two developers and a CI/CD machine.

### Scenario 1: Help Me Fix This Bug

Perry works on a feature, but he can't figure out why it isn't working the way he expects.  Neelam checks out that branch to help. Neelam doesn't need to re-run all the tests that Perry already ran.

### Scenario 2: Why Is This Breaking in CI?

Tony pushes a branch up to CI, but CI doesn't pass.  He asks Sofija to help.  Sofija checks out that branch to troubleshoot.  Sofija can reuse the output from CI instead of waiting for builds to run on her machine.

### Scenario 3: CI Should Know It Already Did That

Maya and Trey push up changes to two different apps that both depend on an unchanged shared buildable library.  CI reuses the build output of the shared buildable library when building the apps in the two different PRs.
