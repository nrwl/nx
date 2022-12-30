# Explore the Graph

For Nx to run tasks quickly and correctly, it creates a graph of the dependencies between all the projects in the
repository. Exploring this graph visually can be useful
to understand why Nx is behaving in a certain way and to get a
high level view of your code architecture.

To launch the project graph visualization run:

```shell
nx graph
```

This will open a browser window with an interactive representation of the project graph of your current codebase.
Viewing the entire graph can be unmanageable even for smaller repositories, so there are several ways to narrow the
focus of the visualization down to the most useful part of the graph at the moment.

1. Focus on a specific project and then use the proximity and group by folder controls to modify the graph around that
   project.
2. Use the search bar to find all projects with names that contain a certain string.
3. Manually hide or show projects in the sidebar

Once the graph is displayed, you can click on an individual dependency link to find out what specific file(s) created
that dependency.

Try playing around with a [fully interactive graph on a sample repo](https://nrwl-nx-examples-dep-graph.netlify.app/?focus=cart) or look at the more limited example below:

{% graph height="450px" %}

```json
{
  "hash": "58420bb4002bb9b6914bdeb7808c77a591a089fc82aaee11e656d73b2735e3fa",
  "projects": [
    {
      "name": "shared-product-state",
      "type": "lib",
      "data": {
        "tags": ["scope:shared", "type:state"]
      }
    },
    {
      "name": "shared-product-types",
      "type": "lib",
      "data": {
        "tags": ["type:types", "scope:shared"]
      }
    },
    {
      "name": "shared-product-data",
      "type": "lib",
      "data": {
        "tags": ["type:data", "scope:shared"]
      }
    },
    {
      "name": "cart-cart-page",
      "type": "lib",
      "data": {
        "tags": ["scope:cart", "type:feature"]
      }
    },
    {
      "name": "shared-styles",
      "type": "lib",
      "data": {
        "tags": ["scope:shared", "type:styles"]
      }
    },
    {
      "name": "cart-e2e",
      "type": "e2e",
      "data": {
        "tags": ["scope:cart", "type:e2e"]
      }
    },
    {
      "name": "cart",
      "type": "app",
      "data": {
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
    "cart-e2e": [
      { "source": "cart-e2e", "target": "cart", "type": "implicit" }
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
  "enableTooltips": true
}
```

{% /graph %}
