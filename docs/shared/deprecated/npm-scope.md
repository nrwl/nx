# npmScope

The `npmScope` property of the `nx.json` file is deprecated as of version 16.2.0. `npmScope` was used as a prefix for the names of newly created projects. The recommended way to define the organization prefix is to set the `name` property in the root `package.json` file to `@my-org/root`. Then `@my-org/` will be used as a prefix for all newly created projects.

In Nx 16, if the `npmScope` property is present, it will be used as a prefix. If the `npmScope` property is not present, the `name` property of the root `package.json` file will be used to infer the prefix.

In Nx 17, the `npmScope` property will be ignored.

## Removing npmScope

To remove `npmScope` from the `nx.json` file, delete the `npmScope` property and ensure the `name` property of the root `package.json` file uses the correct scope.

```jsonc {% filename="/nx.json" %}
{
  "npmScope": "@my-org" // delete this line
}
```

```jsonc {% filename="/package.json" %}
{
  "name": "@my-org/root" // make sure this name starts with @my-org/
}
```
