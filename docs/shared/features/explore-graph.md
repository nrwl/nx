---
title: Explore your Workspace
description: 'Learn how Nx helps you understand your workspace by viewing project details, the project graph, and the task graph.'
---

# Explore your Workspace

Nx understands your workspace as a collection of projects.
Each project can be explored to view the different tasks which can be run.

The projects in the workspace have dependencies between them and form a graph known as the **Project Graph**.
Nx uses this project graph in many ways to make informed decisions such as which tasks to run, when the results of a task can be restored from cache, and more.

In addition to the project graph, Nx also runs your tasks as a **Task Graph**.
This is a separate graph of tasks and their dependencies which is based on the project graph and determines the way in which the tasks are executed.

Nx allows you to interactively explore your workspace through a UI which shows the information above.
Using this tool is _vital_ to understanding both your workspace as well as how Nx behaves.

This guide will teach you to use this tool to explore projects, the project graph, and the task graphs for your workspace.

## Explore Projects in your Workspace

Projects in Nx are the different parts of the monorepo which can have tasks run for them.

The best way to see what projects are in your workspace is to view the [project graph](#explore-the-project-graph) which will be covered in the next section.
Another way is to look at the **Projects** pane in [Nx Console](/getting-started/editor-setup) or run `nx show projects` to show a list of projects in your terminal.

You can see more details about a specific project in Nx Console or by running `nx show project <project-name> --web`. Both methods will show something like the example below:

{% project-details  jsonFile="shared/concepts/myreactapp.json"%}
{% /project-details %}

The view shows a list of targets which can be [run by Nx](/features/run-tasks).
Each target has different options which determine how Nx runs the task.

## Explore the Project Graph

Nx understands the projects in your workspace as a graph and uses this understanding to behave intelligently.
Exploring this graph visually is vital to understanding how your code is structured and how Nx behaves.
It always stays up to date without having to actively maintain a document as it is calculated by analyzing your source code.

### Launching the Project Graph

To launch the project graph visualization for your workspace, use [Nx Console](/getting-started/editor-setup) or run:

```shell
npx nx graph
```

This will open a browser window with an interactive view of the project graph of your workspace.

### Focusing on Valuable Projects

Viewing the entire graph can be unmanageable even for smaller repositories, so there are several ways to narrow the
focus of the visualization down to the most useful part of the graph at the moment.

1. Focus on a specific project and then use the proximity and group by folder controls in the sidebar to modify the graph around that
   project. You can also start the graph with a project focused by running `nx graph --focus <project-name>`.
2. Use the search bar to find all projects with names that contain a certain string.
3. Manually hide or show projects in the sidebar.

Once the graph is displayed, you can explore deeper by clicking on nodes and edges in the graph.
Click on a node to show a tooltip which also has a link to view more details about the project.
You can trace the dependency chain between two projects by choosing a **Start** and **End** point in the project tooltips.
Click on any dependency line to find which file(s) created the dependency.

Composite nodes represent a set of projects in the same folder and can be expanded in place to show all the individual projects and their dependencies. You can also "focus" a composite node to render a graph of just the projects inside that node. Composite nodes are essential to navigate a graph of even a moderate size.

Try playing around with a [fully interactive graph on a sample repo](https://nrwl-nx-examples-dep-graph.netlify.app/?focus=cart) or look at the more limited example below:

{% side-by-side %}

{% graph height="450px" title="Project View" %}

```json
{
  "composite": false,
  "projects": [
    {
      "name": "shared-product-state",
      "type": "lib",
      "data": {
        "root": "shared/product-state",
        "tags": ["scope:shared", "type:state"]
      }
    },
    {
      "name": "shared-product-types",
      "type": "lib",
      "data": {
        "root": "shared/product-types",
        "tags": ["type:types", "scope:shared"]
      }
    },
    {
      "name": "shared-product-data",
      "type": "lib",
      "data": {
        "root": "shared/product-data",
        "tags": ["type:data", "scope:shared"]
      }
    },
    {
      "name": "cart-cart-page",
      "type": "lib",
      "data": {
        "root": "cart/cart-page",
        "tags": ["scope:cart", "type:feature"]
      }
    },
    {
      "name": "shared-styles",
      "type": "lib",
      "data": {
        "root": "shared/styles",
        "tags": ["scope:shared", "type:styles"]
      }
    },
    {
      "name": "e2e-cart",
      "type": "e2e",
      "data": {
        "root": "e2e/cart",
        "tags": ["scope:cart", "type:e2e"]
      }
    },
    {
      "name": "cart",
      "type": "app",
      "data": {
        "root": "cart",
        "tags": ["type:app", "scope:cart"]
      }
    }
  ],
  "dependencies": {
    "shared-product-state": [
      {
        "source": "shared-product-state",
        "target": "shared-product-data",
        "type": "static"
      },
      {
        "source": "shared-product-state",
        "target": "shared-product-types",
        "type": "static"
      }
    ],
    "shared-product-types": [],
    "shared-product-data": [
      {
        "source": "shared-product-data",
        "target": "shared-product-types",
        "type": "static"
      }
    ],
    "shared-e2e-utils": [],
    "cart-cart-page": [
      {
        "source": "cart-cart-page",
        "target": "shared-product-state",
        "type": "static"
      }
    ],
    "shared-styles": [],
    "e2e-cart": [
      { "source": "e2e-cart", "target": "cart", "type": "implicit" }
    ],
    "cart": [
      { "source": "cart", "target": "shared-styles", "type": "implicit" },
      { "source": "cart", "target": "cart-cart-page", "type": "static" }
    ]
  },
  "workspaceLayout": {
    "appsDir": "apps",
    "libsDir": "libs"
  },
  "affectedProjectIds": [],
  "focus": null,
  "groupByFolder": false,
  "exclude": [],
  "enableTooltips": false
}
```

{% /graph %}

{% graph height="450px" title="Composite View (Nx 20+)" %}

```json
{
  "composite": true,
  "projects": [
    {
      "name": "shared-product-state",
      "type": "lib",
      "data": {
        "root": "shared/product-state",
        "tags": ["scope:shared", "type:state"]
      }
    },
    {
      "name": "shared-product-types",
      "type": "lib",
      "data": {
        "root": "shared/product-types",
        "tags": ["type:types", "scope:shared"]
      }
    },
    {
      "name": "shared-product-data",
      "type": "lib",
      "data": {
        "root": "shared/product-data",
        "tags": ["type:data", "scope:shared"]
      }
    },
    {
      "name": "cart-cart-page",
      "type": "lib",
      "data": {
        "root": "cart/cart-page",
        "tags": ["scope:cart", "type:feature"]
      }
    },
    {
      "name": "shared-styles",
      "type": "lib",
      "data": {
        "root": "shared/styles",
        "tags": ["scope:shared", "type:styles"]
      }
    },
    {
      "name": "e2e-cart",
      "type": "e2e",
      "data": {
        "root": "e2e/cart",
        "tags": ["scope:cart", "type:e2e"]
      }
    },
    {
      "name": "cart",
      "type": "app",
      "data": {
        "root": "cart/cart",
        "tags": ["type:app", "scope:cart"]
      }
    }
  ],
  "dependencies": {
    "shared-product-state": [
      {
        "source": "shared-product-state",
        "target": "shared-product-data",
        "type": "static"
      },
      {
        "source": "shared-product-state",
        "target": "shared-product-types",
        "type": "static"
      }
    ],
    "shared-product-types": [],
    "shared-product-data": [
      {
        "source": "shared-product-data",
        "target": "shared-product-types",
        "type": "static"
      }
    ],
    "shared-e2e-utils": [],
    "cart-cart-page": [
      {
        "source": "cart-cart-page",
        "target": "shared-product-state",
        "type": "static"
      }
    ],
    "shared-styles": [],
    "e2e-cart": [
      { "source": "e2e-cart", "target": "cart", "type": "implicit" }
    ],
    "cart": [
      { "source": "cart", "target": "shared-styles", "type": "implicit" },
      { "source": "cart", "target": "cart-cart-page", "type": "static" }
    ]
  },
  "workspaceLayout": {
    "appsDir": "apps",
    "libsDir": "libs"
  },
  "affectedProjectIds": [],
  "focus": null,
  "groupByFolder": false,
  "exclude": [],
  "enableTooltips": false
}
```

{% /graph %}

{% /side-by-side %}

### Export Project Graph to JSON

If you prefer to analyze the underlying data of the project graph with a script or some other tool, you can run:

```shell
nx graph --file=output.json
```

This will give you all the information that is used to create the project graph visualization.

### Export the Project Graph as an Image

There is a floating action button in the bottom right of the project graph view which will save the graph as a `.png` file.
Sharing this image with other developers is a great way to express how a project fits into the workspace.
Some moments which you may want to share these images are:

- When providing a high-level overview of the workspace
- When introducing new project(s) into the workspace
- When changing how project(s) are related
- To share which other projects are directly affected by changes you are making

## Explore the Task Graph

Nx uses the project graph of your workspace to determine the order in which to [run tasks](/features/run-tasks). Pass the `--graph` flag to view the **task graph** which is executed by Nx when running a command.

```shell
nx build myreactapp --graph # View the graph for building myreactapp
nx run-many --targets build --graph # View the graph for building all projects
nx affected --targets build --graph # View the graph for building the affected projects
```

Click on the nodes of this graph to see more information about the task such as:

- Which executor was used to run the command
- Which [inputs](/recipes/running-tasks/configure-inputs) are used to calculate the computation hash.
- A link to see more details about the project which the task belongs to

Dependencies in this graph mean that Nx will need to wait for all task dependencies to complete successfully before running the task.
