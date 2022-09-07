# Cache Task Results

It's costly to rebuild and retest the same code over and over again. Nx uses a computation cache to never rebuild the
same code twice.

## Setup

Nx has the most sophisticated and battle-tested computation caching system. It knows when the task you are
about to run has been executed before, so it can use the cache to restore the results of running that task.

To enable caching for `build` and `test`, edit the `cacheableOperations` property in `nx.json` to include the `build` and `test` tasks:

```json title="nx.json"
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx/tasks-runners/default",
      "options": {
        "cacheableOperations": ["build", "test"]
      }
    }
  }
}
```

{% callout type="note" title="Cacheable operations need to be side effect free" %}
This means that given the same input they should always result in
the same output. As an example, e2e test runs that hit the backend API cannot be cached as the backend might influence
the result of the test run.
{% /callout %}

Now, run the following command twice. The second time the operation will be instant:

```bash
nx test header
```

```bash title="Terminal Output"
> nx run header:test  [existing outputs match the cache, left as is]


> header@0.0.0 test
> jest

 PASS  src/Header.spec.tsx
  ✓ renders header (14 ms)

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.528 s, estimated 2 s
Ran all test suites.

 ————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target test for project header (4ms)

   Nx read the output from the cache instead of running the command for 1 out of 1 tasks.
```

## Advanced Caching

For a more in-depth understanding of the caching implementation and to fine-tune the caching for your repo, read [How Caching Works](/concepts/how-caching-works).

## Local Computation Caching

By default, Nx uses a local computation cache. Nx stores the cached values only for a week, after which they
are deleted. To clear the cache run [`nx reset`](/nx/reset), and Nx will create a new one the next time it tries to access it.

## Distributed Computation Caching

The computation cache provided by Nx can be distributed across multiple machines. You can either build an implementation
of the cache or use Nx Cloud. Nx Cloud is an app that provides a fast and zero-config implementation of distributed
caching. It's completely free for OSS projects and for most closed-sourced
projects ([read more here](https://dev.to/nrwl/more-time-saved-for-free-with-nx-cloud-4a2j)).

You can connect your workspace to Nx Cloud by running:

```bash
npx nx connect-to-nx-cloud
```

## Related Documentation

- [Nx Cloud Documentation](/nx-cloud/intro/what-is-nx-cloud)
- [Nx Cloud Main Site](https://nx.app)

### Concepts

- [How Caching Works](/concepts/how-caching-works)

### Reference

- [--skip-nx-cache](/nx/affected#skip-nx-cache)
- [reset command](/nx/reset)
- [tasks-runner-options](/reference/nx-json#tasks-runner-options)
