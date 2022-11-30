# Run Root-Level NPM Scripts with Nx

There are often tasks in a codebase that apply to the whole codebase rather than a single project. Before version 15.3.0, the only way to use Nx's task pipelines or caching mechanisms for those scripts was to create an empty `scripts` project and run the scripts from there. Now you can run those commands directly from the root `package.json`.

## Example

Let's say your root `package.json` looks like this:

```json
{
  "name": "myorg",
  "scripts": {
    "echo": "echo hello world"
  }
}
```

We want to be able to run the `echo` script using Nx.

## Setup

There are two methods to make Nx aware of the root `package.json` scripts. You can either:

1. Add an `"nx": {}` property to the root `package.json` -OR-
2. Create a small `project.json` file at the root with the same name as defined in your root `package.json`.

```json
{
  "name": "myorg"
}
```

## Running a Root-Level Target

Once Nx is aware of your root-level scripts, you can run them the same way you would run any other target. Just use the name of your root `package.json` as the project name.

For our example, you would run:

```{% command="nx echo myorg" path="~/myorg" %}
> nx run myorg:echo

yarn run v1.22.19
$ echo hello world
hello world
Done in 0.03s.

 ————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target echo for project myorg (462ms)
```

## Configuring a Root-Level Target

You can also configure the `inputs` and `outputs` or task pipelines for root-level targets the same way you would for any other target.

To cache the `echo` target, you can add `echo` to the `cacheableOperations` in `nx.json` and then your output would look like this:

```{% command="nx echo myorg" path="~/myorg" %}
> nx run myorg:echo  [existing outputs match the cache, left as is]

yarn run v1.22.19
$ echo hello world
hello world
Done in 0.03s.

 ————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target echo for project myorg (31ms)

   Nx read the output from the cache instead of running the command for 1 out of 1 tasks.
```
