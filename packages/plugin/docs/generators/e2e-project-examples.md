## Examples

##### E2E Project with Jest (default)

Scaffolds an E2E project for the plugin `my-plugin` using Jest.

```bash
nx g @nx/plugin:e2e-project --pluginName my-plugin --npmPackageName my-plugin --pluginOutputPath dist/my-plugin
```

##### E2E Project with Vitest

Scaffolds an E2E project for the plugin `my-plugin` using Vitest.

```bash
nx g @nx/plugin:e2e-project --pluginName my-plugin --npmPackageName my-plugin --pluginOutputPath dist/my-plugin --testRunner vitest
```
