# Identify Dependencies Between Folders

As projects grow in size, you often need to split out a particular folder in that project into its own library. In order to do this properly, you need to:

1. Generate a new library to set up all the config files
2. Move the code from the existing folder into the new library
3. Clean up paths that were broken when you moved the code

If you're not sure which code you want to split into a new library, this can be a tedious process to repeat multiple times.

Here is a technique to use during the exploration phase to help identify which code makes sense to separate into its own library.

{% callout type="note" title="Requires Nx 15.3" %}

Nx 15.3 introduced nested projects, which are necessary for Nx to be aware of `project.json` files inside of an existing project.

{% /callout %}

## Set up

1. Identify the folders that might make sense to separate into their own library
2. In each folder, create a `project.json` file with the following contents:

```json {% fileName="project.json" %}
{
  "name": "[name_of_the_folder]"
}
```

## Analysis

Now, run `nx graph` to view the dependencies between the folders. In the full web view (not in the graph below), you can click on the dependency lines to see which specific files are creating those dependencies.

Here is a graph that was created when doing this exercise on the [Angular Jump Start](https://github.com/DanWahlin/Angular-JumpStart) repo. To reproduce this graph yourself, download the repo, run `nx init` and then add `project.json` files to the folders under `/src/app`.

{% graph height="450px" %}

```json
{
  "hash": "9713539543f19c5299e56715e78c576a40b91056b9cbb4e42118780cfcd22b5e",
  "projects": [
    {
      "name": "customers",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "customer",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "orders",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "shared",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "about",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "login",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "core",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "playground",
      "type": "app",
      "data": {
        "tags": []
      }
    },
    {
      "name": "angular-jumpstart",
      "type": "app",
      "data": {
        "tags": []
      }
    }
  ],
  "dependencies": {
    "customers": [
      { "source": "customers", "target": "shared", "type": "static" },
      { "source": "customers", "target": "core", "type": "static" }
    ],
    "customer": [
      { "source": "customer", "target": "shared", "type": "static" },
      { "source": "customer", "target": "core", "type": "static" }
    ],
    "orders": [
      { "source": "orders", "target": "core", "type": "static" },
      { "source": "orders", "target": "shared", "type": "static" }
    ],
    "shared": [],
    "about": [],
    "login": [
      { "source": "login", "target": "core", "type": "static" },
      { "source": "login", "target": "shared", "type": "static" }
    ],
    "core": [
      { "source": "core", "target": "shared", "type": "static" },
      { "source": "core", "target": "angular-jumpstart", "type": "static" }
    ],
    "playground": [
      {
        "source": "playground",
        "target": "angular-jumpstart",
        "type": "static"
      },
      { "source": "playground", "target": "core", "type": "static" },
      { "source": "playground", "target": "customer", "type": "static" },
      { "source": "playground", "target": "customers", "type": "static" },
      { "source": "playground", "target": "orders", "type": "static" },
      { "source": "playground", "target": "about", "type": "static" },
      { "source": "playground", "target": "login", "type": "static" },
      { "source": "playground", "target": "shared", "type": "static" }
    ],
    "angular-jumpstart": []
  },
  "workspaceLayout": { "appsDir": "projects", "libsDir": "projects" },
  "affectedProjectIds": [],
  "focus": null,
  "groupByFolder": false,
  "exclude": []
}
```

{% /graph %}

## Clean up

{% callout type="warning" title="DO NOT COMMIT" %}
Do not commit these empty `project.json` files. They remove files from the cache inputs of the parent project without creating new test or build targets in place to cover those files. So testing and building will not be triggered correctly when those files change.
{% /callout %}

1. Delete the empty `project.json` files.
2. Make new libraries for any folders that were marked to be extracted into new libraries.
