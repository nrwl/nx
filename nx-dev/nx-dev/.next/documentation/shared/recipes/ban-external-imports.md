# Ban External Imports

**This constraint is only available for projects using ESLint.**

You may want to constrain what external packages a project may import. For example, you may want to prevent backend projects from importing packages related to your frontend framework. You can ban these imports using `bannedExternalImports` property in your dependency constraints configuration.

A common example of this is for backend projects that use NestJS and frontend projects that use Angular. Both frameworks contain a class named `Injectable`. It's very easy for a developer to import the wrong one by mistake, especially when using auto-import in an IDE. To prevent this, add tags to define the type of project to distinguish between backend and frontend projects. Each tag should define its own list of banned external imports.

```jsonc {% fileName=".eslintrc.json" %}
{
  // ... more ESLint config here

  // @nx/enforce-module-boundaries should already exist at the top-level of your config
  "@nx/enforce-module-boundaries": [
    "error",
    {
      "allow": [],
      // update depConstraints based on your tags
      "depConstraints": [
        // projects tagged with "frontend" can't import from "@nestjs/common"
        {
          "sourceTag": "frontend",
          "bannedExternalImports": ["@nestjs/common"]
        },
        // projects tagged with "backend" can't import from "@angular/core"
        {
          "sourceTag": "backend",
          "bannedExternalImports": ["@angular/core"]
        }
      ]
    }
  ]

  // ... more ESLint config here
}
```

Another common example is ensuring that util libraries stay framework-free by banning imports from these frameworks. You can use wildcard `*` to match multiple projects e.g. `react*` would match `react`, but also `react-dom`, `react-native` etc. You can also have multiple wildcards e.g. `*react*` would match any package with word `react` in it's name. A workspace using React would have a configuration like this.

```jsonc {% fileName=".eslintrc.json" %}
{
  // ... more ESLint config here
  // @nx/enforce-module-boundaries should already exist at the top-level of your config
  "@nx/enforce-module-boundaries": [
    "error",
    {
      "allow": [],
      // update depConstraints based on your tags
      "depConstraints": [
        // projects tagged with "type:util" can't import from "react" or related projects
        {
          "sourceTag": "type:util",
          "bannedExternalImports": ["*react*"]
        }
      ]
    }
  ]

  // ... more ESLint config here
}
```

## Whitelisting external imports with `allowedExternalImports`

If you need a more restrictive approach, you can use the `allowedExternalImports` option to ensure that a project only imports from a specific set of packages.
This is useful if you want to enforce separation of concerns _(e.g. keeping your domain logic clean from infrastructure concerns, or ui libraries clean from data access concerns)_ or keep some parts of your codebase framework-free or library-free.

```jsonc {% fileName=".eslintrc.json" %}
{
  // ... more ESLint config here

  // @nx/enforce-module-boundaries should already exist at the top-level of your config
  "@nx/enforce-module-boundaries": [
    "error",
    {
      "allow": [],
      // update depConstraints based on your tags
      "depConstraints": [
        // limiting the dependencies of util libraries to the bare minimum
        // projects tagged with "type:util" can only import from "date-fns"
        {
          "sourceTag": "type:util",
          "allowedExternalImports": ["date-fns"]
        },
        // ui libraries clean from data access concerns
        // projects tagged with "type:ui" can only import pacages matching "@angular/*" except "@angular/common/http"
        {
          "sourceTag": "type:ui",
          "allowedExternalImports": ["@angular/*"],
          "bannedExternalImports": ["@angular/common/http"]
        },
        // keeping the domain logic clean from infrastructure concerns
        // projects tagged with "type:core" can't import any external packages.
        {
          "sourceTag": "type:core",
          "allowedExternalImports": []
        }
      ]
    }
  ]
```
