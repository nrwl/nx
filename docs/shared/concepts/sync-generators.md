# Sync Generators

In Nx 19.7, you can use sync generators to update code before a task is run or before code is sent to CI. Sync generators are designed to perform maintenance work that is required for a particular task or for CI.

Sync Generator Examples:

- Ensure code is formatted in a specific way before CI is run
- Update a custom CI script with binning strategies based on the current project graph
- Update TypeScript config files with project references based on the current project graph

## Task Sync Generators

Sync generators can be associated with a particular task. Nx will ensure that the sync generator is run before the task is executed. This is similar to the `dependsOn` property, but for generators instead of task dependencies.

To [register a generator](/extending-nx/recipes/register-sync-generator) as a sync generator for a particular task, add the generator to the `syncGenerators` property of the task configuration.

## Global Sync Generators

Global sync generators are not associated with a particular task and are executed only when the `nx sync` or `nx sync:check` command is explicitly run. They are [registered](/extending-nx/recipes/register-sync-generator) in the `nx.json` file with the `sync.globalGenerators` property.

## Use the Project Graph in a Sync Generator

Nx processes the file system in order to [create the project graph](/features/explore-graph) which is used run tasks in the correct order and determine project dependencies. Sync generators allow you to also go the other direction and use the project graph to update the file system.

{% side-by-side %}

```{% fileName="File System" %}
└─ myorg
   ├─ apps
   │  ├─ app1
   │  └─ app1
   ├─ libs
   │  └─ lib
   ├─ nx.json
   └─ package.json
```

{% graph title="Project Graph" height="200px" type="project" jsonFile="shared/mental-model/three-projects.json" %}
{% /graph %}
{% /side-by-side %}

## Example Usage

When Nx detects that the repository is out of sync, the user will be asked if sync generators should be run. To skip this prompt, set the `sync.applyChanges` property in `nx.json` to either `true` or `false`.

Task sync generators are executed whenever their task is run, but global sync generators need to be triggered manually with `nx sync`. We recommend running `nx sync` in a pre-commit or pre-push Git hook to ensure that all committed code is in sync. Also, add `nx sync:check` to the beginning of your CI scripts so that CI can fail quickly if the code is out of sync.
