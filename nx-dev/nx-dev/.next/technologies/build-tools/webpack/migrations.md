The @nx/webpack plugin provides various migrations to help you migrate to newer versions of webpack projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 22.0.x

### `update-22-0-0-remove-deprecated-options`
**Version**: 22.0.0-beta.0

Remove deprecated deleteOutputPath and sassImplementation options from @nx/webpack:webpack



## 21.5.x

### 21.5.0-package-updates
**Version**: 21.5.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `webpack` | `5.101.3` | Updated only



## 21.0.x

### `update-21-0-0-remove-isolated-config`
**Version**: 21.0.0-beta.11

Remove isolatedConfig option for @nx/webpack:webpack

#### Remove `isolatedConfig` option

The `isolatedConfig` option is no longer supported by the `@nx/webpack:webpack` executor. Previously, setting `isolatedConfig: false` allowed you to use the executor's built-in Webpack configuration.

If this option is set in `project.json`, then it will be removed in favor of an explicit `webpackConfig` file. The Webpack configuration file matches the previous built-in configuration of the `@nx/webpack:webpack` executor.

#### Sample Code Changes

##### Before

```json title="project.json"
{
  "targets": {
    "build": {
      "executor": "@nx/webpack:webpack",
      "options": {
        "isolatedConfig": false
      }
    }
  }
}
```

##### After

```json title="project.json" {6}
{
  "targets": {
    "build": {
      "executor": "@nx/webpack:webpack",
      "options": {
        "webpackConfig": "apps/myapp/webpack.config.js"
      }
    }
  }
}
```




## 20.7.x

### 20.7.1-package-updates
**Version**: 20.7.1-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `webpack` | `5.98.0` | Updated only
| `webpack-dev-server` | `^5.2.1` | Updated only



## 20.5.x

### 20.5.0-package-updates
**Version**: 20.5.0-beta.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `sass-loader` | `^16.0.4` | Updated only


