# Ban Dependencies with Certain Tags

Specifying which tags a project is allowed to depend on can sometimes lead to a long list of possible options:

```jsonc
{
  "sourceTag": "scope:client",
  // we actually want to say it cannot depend on `scope:admin`
  "onlyDependOnLibsWithTags": [
    "scope:shared",
    "scope:utils",
    "scope:core",
    "scope:client"
  ]
}
```

The property `notDependOnLibsWithTags` is used to invert this condition by explicitly specifying which tag(s) it cannot depend on:

```jsonc
{
  "sourceTag": "scope:client",
  // we accept any tag except for `scope:admin`
  "notDependOnLibsWithTags": ["scope:admin"]
}
```

> In contrast to `onlyDependOnLibsWithTags`, the `notDependOnLibsWithTags` will also follow down the _entire dependency tree_ to make sure there are no sub-dependencies that violate this rule. You can also use a combination of these two rules to restrict certain types of projects to be imported:

```jsonc
{
  "sourceTag": "type:react",
  "onlyDependOnLibsWithTags": [
    "type:react",
    "type:utils",
    "type:animation",
    "type:model"
  ],
  // make sure no `angular` code ends up being referenced by react projects
  "notDependOnLibsWithTags": ["type:angular"]
}
```
