# Imposing Constraints on the Dependency Graph

If you partition your code into well-defined cohesive units, even a small organization will end up with a dozen apps and dozens or hundreds of libs. If all of them can depend on each other freely, the chaos will ensue, and the workspace will become unmanageable.

To help with that Nx uses code analyses to make sure projects can only depend on each other's well-defined public API. It also allows you to declaratively impose constraints on how projects can depend on each other.

## Tags

Nx comes with a generic mechanism for expressing constraints: tags.

First, use your project configuration (within `workspace.json` or `project.json`) to annotate your projects with `tags`. In this example, we will use three tags: `scope:client`. `scope:admin`, `scope:shared`.

```jsonc
// project "client"
{
  // ... more project configuration here

  "tags": ["scope:client"],
  "implicitDependencies": []
}

// project "client-e2e"
{
  // ... more project configuration here

  "tags": ["scope:client"],
  "implicitDependencies": ["client"]
}

// project "admin"
{
  // ... more project configuration here

  "tags": ["scope:admin"],
  "implicitDependencies": []
}

// project "admin-e2e"
{
  // ... more project configuration here

  "tags": ["scope:admin"],
  "implicitDependencies": ["admin"]
}

// project "client-feature-main"
{
  // ... more project configuration here

  "tags": ["scope:client"],
  "implicitDependencies": []
},

// project "admin-feature-permissions"
{
  // ... more project configuration here

  "tags": ["scope:admin"],
  "implicitDependencies": []
}

// project "components-shared"
{
  // ... more project configuration here

  "tags": ["scope:shared"],
  "implicitDependencies": []
}

// project "utils"
{
  // ... more project configuration here

  "tags": ["scope:shared"],
  "implicitDependencies": []
}
```

Next you should update your root lint configuration:

- If you are using **ESLint** you should look for an existing rule entry in your root `.eslintrc.json` called `"@nrwl/nx/enforce-module-boundaries"` and you should update the `"depConstraints"`:

```jsonc
{
  // ... more ESLint config here

  // @nrwl/nx/enforce-module-boundaries should already exist within an "overrides" block using `"files": ["*.ts", "*.tsx", "*.js", "*.jsx",]`
  "@nrwl/nx/enforce-module-boundaries": [
    "error",
    {
      "allow": [],
      // update depConstraints based on your tags
      "depConstraints": [
        {
          "sourceTag": "scope:shared",
          "onlyDependOnLibsWithTags": ["scope:shared"]
        },
        {
          "sourceTag": "scope:admin",
          "onlyDependOnLibsWithTags": ["scope:shared", "scope:admin"]
        },
        {
          "sourceTag": "scope:client",
          "onlyDependOnLibsWithTags": ["scope:shared", "scope:client"]
        }
      ]
    }
  ]

  // ... more ESLint config here
}
```

- If you are using **TSLint** you should look for an existing rule entry in your root `tslint.json` called `"nx-enforce-module-boundaries"` and you should update the `"depConstraints"`:

```jsonc
{
  // ... more TSLint config here

  // nx-enforce-module-boundaries should already exist at the top-level of your config
  "nx-enforce-module-boundaries": [
    true,
    {
      "allow": [],
      // update depConstraints based on your tags
      "depConstraints": [
        {
          "sourceTag": "scope:shared",
          "onlyDependOnLibsWithTags": ["scope:shared"]
        },
        {
          "sourceTag": "scope:admin",
          "onlyDependOnLibsWithTags": ["scope:shared", "scope:admin"]
        },
        {
          "sourceTag": "scope:client",
          "onlyDependOnLibsWithTags": ["scope:shared", "scope:client"]
        }
      ]
    }
  ]

  // ... more TSLint config here
}
```

With these constraints in place, `scope:client` projects can only depend on other `scope:client` projects or on `scope:shared` projects. And `scope:admin` projects can only depend on other `scope:admin` projects or on `scope:shared` projects. So `scope:client` and `scope:admin` cannot depend on each other.

Projects without any tags cannot depend on any other projects. If you add the following, projects without any tags will be able to depend on any other project.

```json
{
  "sourceTag": "*",
  "onlyDependOnLibsWithTags": ["*"]
}
```

If you try to violate the constrains, you will get an error:

```bash
A project tagged with "scope:admin" can only depend on projects tagged with "scoped:shared" or "scope:admin".
```

### Exceptions

The `"allow": []` are the list of imports that won't fail linting.

- `"allow": ['@myorg/mylib/testing']` allows importing `'@myorg/mylib/testing'`.
- `"allow": ['@myorg/mylib/*']` allows importing `'@myorg/mylib/a'` but not `'@myorg/mylib/a/b'`.
- `"allow": ['@myorg/mylib/**']` allows importing `'@myorg/mylib/a'` and `'@myorg/mylib/a/b'`.
- `"allow": ['@myorg/**/testing']` allows importing `'@myorg/mylib/testing'` and `'@myorg/nested/lib/testing'`.

## Multiple Dimensions

The example above shows using a single dimension: `scope`. It's the most commonly used one. But you can find other dimensions useful. You can define which projects contain components, state management code, and features, so you, for instance, can disallow projects containing dumb UI components to depend on state management code. You can define which projects are experimental and which are stable, so stable applications cannot depend on experimental projects etc. You can define which projects have server-side code and which have client-side code to make sure your node app doesn't bundle in your frontend framework.

Let's consider our previous three scopes - `scope:client`. `scope:admin`, `scope:shared`. By using just a single dimension, our `client-e2e` application would be able to import `client` application or `client-feature-main`. This is likely not something we want to allow as it's using framework that our E2E project doesn't have.

Let's add another dimension - `type`. Some of our projects are applications, some are UI features and some are just plain helper libraries. Let's define three new tags: `type:app`, `type:feature`, `type:ui` and `type:util`.

Our project configurations might now look like this:

```jsonc
// project "client"
{
  // ... more project configuration here

  "tags": ["scope:client", "type:app"],
  "implicitDependencies": []
}

// project "client-e2e"
{
  // ... more project configuration here

  "tags": ["scope:client", "type:app"],
  "implicitDependencies": ["client"]
}

// project "admin"
{
  // ... more project configuration here

  "tags": ["scope:admin", "type:app"],
  "implicitDependencies": []
}

// project "admin-e2e"
{
  // ... more project configuration here

  "tags": ["scope:admin", "type:app"],
  "implicitDependencies": ["admin"]
}

// project "client-feature-main"
{
  // ... more project configuration here

  "tags": ["scope:client", "type:feature"],
  "implicitDependencies": []
},

// project "admin-feature-permissions"
{
  // ... more project configuration here

  "tags": ["scope:admin", "type:feature"],
  "implicitDependencies": []
}

// project "components-shared"
{
  // ... more project configuration here

  "tags": ["scope:shared", "type:ui"],
  "implicitDependencies": []
}

// project "utils"
{
  // ... more project configuration here

  "tags": ["scope:shared", "type:util"],
  "implicitDependencies": []
}
```

We can now restrict projects within the same group to depend on each other based on the type:

- `app` can only depend on `feature`, `ui` or `util`, but not other apps
- `feature` cannot depend on app or another feature
- `ui` can only depend on other `ui`
- everyone can depend on `util` including `util` itself

```jsonc
{
  // ... more ESLint config here

  // nx-enforce-module-boundaries should already exist at the top-level of your config
  "nx-enforce-module-boundaries": [
    true,
    {
      "allow": [],
      // update depConstraints based on your tags
      "depConstraints": [
        {
          "sourceTag": "scope:shared",
          "onlyDependOnLibsWithTags": ["scope:shared"]
        },
        {
          "sourceTag": "scope:admin",
          "onlyDependOnLibsWithTags": ["scope:shared", "scope:admin"]
        },
        {
          "sourceTag": "scope:client",
          "onlyDependOnLibsWithTags": ["scope:shared", "scope:client"]
        },
        {
          "sourceTag": "type:app",
          "onlyDependOnLibsWithTags": ["type:feature", "type:ui", "type:util"]
        },
        {
          "sourceTag": "type:feature",
          "onlyDependOnLibsWithTags": ["type:ui", "type:util"]
        },
        {
          "sourceTag": "type:ui",
          "onlyDependOnLibsWithTags": ["type:ui", "type:util"]
        },
        {
          "sourceTag": "type:util",
          "onlyDependOnLibsWithTags": ["type:util"]
        }
      ]
    }
  ]

  // ... more ESLint config here
}
```

There are no limits to number of tags, but as you add more tags the complexity of your dependency constraints rises exponentially. It's always good to draw a diagram and carefully plan the boundaries.
