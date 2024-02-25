`project.json`:

```json
{
  "name": "mobile",
  //...
  "targets": {
    //...
    "export": {
      "executor": "@nx/expo:export",
      "options": {
        "outputs": ["{options.outputDir}"],
        "platform": "all",
        "outputDir": "dist/apps/mobile"
      },
      "dependsOn": ["sync-deps"]
    }
    //...
  }
}
```

```shell
nx run mobile:export
```

## Examples

{% tabs %}
{% tab label="Specify outputDir" %}
The `outputDir` option allows you to specify the output directory of your bundle:

```json
    "export": {
      "executor": "@nx/expo:export",
      "outputs": ["{options.outputDir}"],
      "options": {
        "platform": "all",
        "bundler": "metro",
        "outputDir": "dist/apps/mobile"
      },
      "dependsOn": ["sync-deps"]
    },
```

or run command: `nx run mobile:export --outputDir=dist/apps/mobile`.

{% /tab %}
{% tab label="Specify the platform" %}
The `platform` option allows you to specify the platform to compile with metro bundler: "ios", "android", "all", and "web".

For example, to bundle for web:

```json
    "export": {
      "executor": "@nx/expo:export",
      "outputs": ["{options.outputDir}"],
      "options": {
        "platform": "web",
        "bundler": "metro",
        "outputDir": "dist/apps/dogs"
      },
      "dependsOn": ["sync-deps"]
    },
```

or run command `nx export mobile --platform=web`.

{% /tab %}
{% tab label="Bundle for development" %}

The `dev` option allows you to bundle for development environments.

```json
    "export": {
      "executor": "@nx/expo:export",
      "outputs": ["{options.outputDir}"],
      "options": {
        "platform": "web",
        "bundler": "metro",
        "outputDir": "dist/apps/dogs",
        "dev": true
      },
      "dependsOn": ["sync-deps"]
    },
```

or run command `nx export mobile --dev`.

{% /tab %}
{% tab label="Clear bundle cache" %}

The `clear` option allows you to clear bundle cache.

```json
    "export": {
      "executor": "@nx/expo:export",
      "outputs": ["{options.outputDir}"],
      "options": {
        "platform": "web",
        "bundler": "metro",
        "outputDir": "dist/apps/dogs",
        "clear": true
      },
      "dependsOn": ["sync-deps"]
    },
```

or run command `nx export mobile --clear`.

{% /tab %}
{% /tabs %}
