# Enforcing quality

## Imposing Constraints on the Dependency Graph

If you partition your code into well-defined cohesive units, even a
small organization will end up with a dozen apps and dozens or
hundreds of libs. If all of them can depend on each other freely,
the chaos will ensue and the workspace will become unmanageable.

To help with that Nx uses code analyses to make sure projects can only
depend on each other's well-defined public API. It also allows you to
declaratively impose constraints on how projects can depend on each other.

Enterprise development teams love this capability to constrain library
dependencies. With it developers can define which projects are team-specific
and which are shared.

For instance, with this configuration, when we import private client code from
the admin part of our repo, we will get an error.

```javascript
"nx-enforce-module-boundaries": [
  true,
  {
    "allow": [],
    "depConstraints": [
       {
          "sourceTag": "shared",
          "onlyDependOnLibsWithTags": ["shared"]
       },
       {
          "sourceTag": "admin",
          "onlyDependOnLibsWithTags": ["shared", "admin" ]
       },
       {
          "sourceTag": "client",
          "onlyDependOnLibsWithTags": ["shared", "client" ]
       },
       {
          "sourceTag": "*",
          "onlyDependOnLibsWithTags": ["*"]
       }
     ]
  }
]
```

![dependency-graph-constraints-lint-error](https://images.ctfassets.net/8eyogtwep6d2/31Aiw0uwFy2mGGsWOcWYII/0ab4f1e30b93ce757a0653fc8b1d4a24/dependency-graph-contraints-lint-error.png)

With these dependency constraints, another team won't create a
dependency on your internal library.

You can define which projects contain components, NgRx code, and features,
so you, for instance, can disallow projects containing dumb UI components
depend on NgRx. You can define which projects are experimental and which
are stable, so stable applications cannot depend on experimental projects etc.

## Implicit Dependencies

Nx uses its built-in intelligence to create the dependency graph of the
apps and libs, and that gets used to figure out what needs to be rebuilt and
retested. There are certain files, however, that Nx cannot analyze.

That’s why Nx has support for implicit dependencies. They are defined in `nx.json`.

```json
{
  "npmScope": "mycompany",
  "implicitDependencies": {
    "package.json": "*",
    "angular.json": "*",
    "tsconfig.json": "*",
    "tslint.json": "*",
    "nx.json": "*"
  },
  "projects": {}
}
```

These tell Nx that a change to files in this list will affect every single project.
