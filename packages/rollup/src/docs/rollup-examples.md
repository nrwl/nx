{% tabs %}
{% tab label="Including Dependencies" %}
To include dependencies in the output `package.json`, the dependencies must be installed as a **dependencies** in the root `package.json`

```json {% fileName="package.json" %}
{
  "dependencies": {
    "some-dependency": "^1.0.0"
  }
}
```

To have dependencies in the be listed in the final `package.json` of your project, set the `updateBuildableProjectDepsInPackageJson` option to `true`. After than dependencies will be added to the `peerDependencies` field of the output `package.json`. You can use `buildableProjectDepsInPackageJsonType` option to change which field the dependencies are output to.

```json {% fileName="project.json" %}
{
  "targets": {
    "build": {
      "executor": "@nrwl/rollup:rollup",
      "options": {
        "buildableProjectDepsInPackageJsonType": "dependencies",
        "updateBuildableProjectDepsInPackageJson": true
      }
    }
  }
}
```

{% /tab}
{% /tabs %}
