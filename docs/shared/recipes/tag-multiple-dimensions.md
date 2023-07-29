# Tag in Multiple Dimensions

The example above shows using a single dimension: `scope`. It's the most commonly used one. But you can find other dimensions useful. You can define which projects contain components, state management code, and features, so you, for instance, can disallow projects containing dumb UI components to depend on state management code. You can define which projects are experimental and which are stable, so stable applications cannot depend on experimental projects etc. You can define which projects have server-side code and which have client-side code to make sure your node app doesn't bundle in your frontend framework.

Let's consider our previous three scopes - `scope:client`. `scope:admin`, `scope:shared`. By using just a single dimension, our `client-e2e` application would be able to import `client` application or `client-feature-main`. This is likely not something we want to allow as it's using framework that our E2E project doesn't have.

Let's add another dimension - `type`. Some of our projects are applications, some are UI features and some are just plain helper libraries. Let's define three new tags: `type:app`, `type:feature`, `type:ui` and `type:util`.

Our project configurations might now look like this:

```jsonc
// project "client"
{
  // ... more project configuration here

  "tags": ["scope:client", "type:app"]
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

  "tags": ["scope:admin", "type:app"]
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

  "tags": ["scope:client", "type:feature"]
},

// project "admin-feature-permissions"
{
  // ... more project configuration here

  "tags": ["scope:admin", "type:feature"]
}

// project "components-shared"
{
  // ... more project configuration here

  "tags": ["scope:shared", "type:ui"]
}

// project "utils"
{
  // ... more project configuration here

  "tags": ["scope:shared", "type:util"]
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

  // @nx/enforce-module-boundaries should already exist at the top-level of your config
  "@nx/enforce-module-boundaries": [
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

There are no limits to the number of tags, but as you add more tags the complexity of your dependency constraints rises exponentially. It's always good to draw a diagram and carefully plan the boundaries.

## Matching multiple source tags

Matching just a single source tag is sometimes not enough for solving complex restrictions. To avoid creating ad-hoc tags that are only meant for specific constraints, you can also combine multiple tags with `allSourceTags`. Each tag in the array must be matched for a constraint to be applied:

```jsonc
{
  // ... more ESLint config here

  // @nx/enforce-module-boundaries should already exist at the top-level of your config
  "@nx/enforce-module-boundaries": [
    "error",
    {
      "allow": [],
      // update depConstraints based on your tags
      "depConstraints": [
        { // this constraint applies to all "admin" projects
          "sourceTag": "scope:admin",
          "onlyDependOnLibsWithTags": ["scope:shared", "scope:admin"]
        },
        {
          "sourceTag": "type:ui",
          "onlyDependOnLibsWithTags": ["type:ui", "type:util"]
        },
        { // we don't want our admin ui components to depend on anything except utilities, and we also want to ban router imports
          "allSourceTags": ["scope:admin", "type:ui"],
          "onlyDependOnLibsWithTags": ["type:util"],
          "bannedExternalImports": ["*router*"]
        }
      ]
    }
  ]

  // ... more ESLint config here
}

## Further reading

- [Article: Taming Code Organization with Module Boundaries in Nx](https://blog.nrwl.io/mastering-the-project-boundaries-in-nx-f095852f5bf4)
```
