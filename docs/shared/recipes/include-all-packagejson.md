# Include All package.json Files as Projects

As of Nx 15.0.11, we only include any `package.json` file that is referenced in the `workspaces` property of the root `package.json` file in the graph. (`lerna.json` for Lerna repos or `pnpm-workspaces.yml` for pnpm repos)

If you would prefer to add all `package.json` files as projects, add the following configuration to the `nx.json` file:

```json {% filename="nx.json" %}
{
  "plugins": ["nx/plugins/package-json"]
}
```
