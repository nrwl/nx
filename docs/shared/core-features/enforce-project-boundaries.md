# Enforce Project Boundaries

If you partition your code into well-defined cohesive units, even a small organization will end up with a dozen apps and dozens or hundreds of libs. If all of them can depend on each other freely, chaos will ensue, and the workspace will become unmanageable.

To help with that Nx uses code analysis to make sure projects can only depend on each other's well-defined public API. It also allows you to declaratively impose constraints on how projects can depend on each other.

## Project APIs

Nx provides an `enforce-module-boundaries` eslint rule that enforces the public API of projects in the repo. Each project defines its public API in an `index.ts` (or `index.js`) file. If another project tries to import a variable from a file deep within a different project, an error will be thrown during linting.

To set up the lint rule, install these dependencies:

```shell
npm i @nx/eslint-plugin @nx/devkit
```

And configure the rule in your root `.eslintrc.json` file:

```jsonc {% fileName=".eslintrc.json" %}
{
  "plugins": ["@nx"],
  // ...
  "rules": {
    "@nx/enforce-module-boundaries": [
      "error",
      {
        /* options */
      }
    ]
  }
}
```

## Tags

Nx comes with a generic mechanism for expressing constraints on project dependencies: tags.

First, use your project configuration (in `project.json` or `package.json`) to annotate your projects with `tags`. In this example, we will use three tags: `scope:client`. `scope:admin`, `scope:shared`.

{% tabs %}
{% tab label="package.json" %}

```jsonc {% fileName="client/package.json" %}
{
  // ... more project configuration here
  "nx": {
    "tags": ["scope:client"]
  }
}
```

```jsonc {% fileName="admin/package.json" %}
{
  // ... more project configuration here
  "nx": {
    "tags": ["scope:admin"]
  }
}
```

```jsonc {% fileName="utils/package.json" %}
{
  // ... more project configuration here
  "nx": {
    "tags": ["scope:shared"]
  }
}
```

{% /tab %}
{% tab label="project.json" %}

```jsonc {% fileName="client/project.json" %}
{
  // ... more project configuration here
  "tags": ["scope:client"]
}
```

```jsonc {% fileName="admin/project.json" %}
{
  // ... more project configuration here
  "tags": ["scope:admin"]
}
```

```jsonc {% fileName="utils/project.json" %}
{
  // ... more project configuration here
  "tags": ["scope:shared"]
}
```

{% /tab %}
{% /tabs %}

Next, you should update your root lint configuration:

- If you are using **ESLint** you should look for an existing rule entry in your root `.eslintrc.json` called `"@nx/enforce-module-boundaries"` and you should update the `"depConstraints"`:

```jsonc {% fileName=".eslintrc.json" %}
{
  // ... more ESLint config here

  // @nx/enforce-module-boundaries should already exist within an "overrides" block using `"files": ["*.ts", "*.tsx", "*.js", "*.jsx",]`
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
        }
      ]
    }
  ]

  // ... more ESLint config here
}
```

With these constraints in place, `scope:client` projects can only depend on projects with `scope:client` or `scope:shared`. And `scope:admin` projects can only depend on projects with `scope:admin` or `scope:shared`. So `scope:client` and `scope:admin` cannot depend on each other.

Projects without any tags cannot depend on any other projects. If you try to violate the constraints, you will get an error when linting:

```shell
A project tagged with "scope:admin" can only depend on projects
tagged with "scoped:shared" or "scope:admin".
```

The exception to this rule is by explicitly allowing all tags (see below).

### Tag formats

- `*`: allow all tags

Example: projects with any tags (including untagged) can depend on any other project.

```jsonc
{
  "sourceTag": "*",
  "onlyDependOnLibsWithTags": ["*"]
}
```

- `string`: allow exact tags

Example: projects tagged with `scope:client` can only depend on projects tagged with `scope:util`.

```jsonc
{
  "sourceTag": "scope:client",
  "onlyDependOnLibsWithTags": ["scope:util"]
}
```

- `regex`: allow tags matching the regular expression

Example: projects tagged with `scope:client` can depend on projects with a tag matching the regular expression `/^scope.*/`. In this case, the `scope:util`, `scope:client`, etc. are all allowed tags for dependencies.

```json
{
  "sourceTag": "scope:client",
  "onlyDependOnLibsWithTags": ["/^scope.*/"]
}
```

- `glob`: allow tags matching the glob

Example: projects with a tag starting with `scope:` can depend on projects with a tag that starts with `scope:*`. In this case `scope:a`, `scope:b`, etc are all allowed tags for dependencies.

```json
{
  "sourceTag": "scope:*",
  "onlyDependOnLibsWithTags": ["scope:*"]
}
```

Globbing supports only the basic use of `*`. For more complex scenarios use the `regex` above.
