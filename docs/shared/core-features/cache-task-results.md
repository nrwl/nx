# Cache Task Results

It's costly to rebuild and retest the same code over and over again. Nx uses a computation cache to never rebuild the
same code twice.

## Setup

Nx has the most sophisticated and battle-tested computation caching system. It knows when the task you are
about to run has been executed before, so it can use the cache to restore the results of running that task.

To enable caching for `build` and `test`, edit the `cacheableOperations` property in `nx.json` to include the `build` and `test` tasks:

```json {% fileName="nx.json" %}
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

```shell
nx build header
```

```{% command="nx build header"%}
> nx run header:build  [local cache]


> header@0.0.0 build
> rimraf dist && rollup --config


src/index.tsx → dist...
created dist in 858ms

 —————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for project header (13ms)

   Nx read the output from the cache instead of running the command for 1 out of 1 tasks.
```

## Replaying from Cache

When Nx determines that the inputs for a task have not changed, it recreates the outputs of that task as if it actually ran on your machine - but much faster. The outputs of a cached task include both the terminal output and the files created in the defined `output` directories for that task.

You can test this out by deleting the `dist` folder that the `header:build` task outputs to and then running `nx build header` again. The cached task will replay instantly and the correct files will be present in the `dist` folder.

```treeview
header/
└── dist/  <-- this folder gets recreated
```

If your task creates output artifacts in a different location, you can [change the output folder(s)](/reference/project-configuration#outputs) that are cached. You can also [customize which inputs](/more-concepts/customizing-inputs) will invalidate the cache if they are changed.

## Advanced Caching

For a more in-depth understanding of the caching implementation and to fine-tune the caching for your repo, read [How Caching Works](/concepts/how-caching-works).

## Local Computation Caching

By default, Nx uses a local computation cache. Nx stores the cached values only for a week, after which they
are deleted. To clear the cache run [`nx reset`](/packages/nx/documents/reset), and Nx will create a new one the next time it tries to access it.
