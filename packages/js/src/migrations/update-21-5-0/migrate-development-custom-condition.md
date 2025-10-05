#### Migrate `development` custom condition to unique workspace-specific name

Replace the TypeScript `development` custom condition with a unique workspace-specific name to avoid conflicts when consuming packages in other workspaces.

#### Examples

The migration will update the custom condition name in both `tsconfig.base.json` and all workspace package.json files that use the `development` custom condition:

{% tabs %}
{% tab label="Before" %}

```json {% fileName="tsconfig.base.json" highlightLines=["3"] %}
{
  "compilerOptions": {
    "customConditions": ["development"]
  }
}
```

{% /tab %}

{% tab label="After" %}

```json {% fileName="tsconfig.base.json" highlightLines=["3"] %}
{
  "compilerOptions": {
    "customConditions": ["@my-org/source"] // assuming the root package.json name is `@my-org/source`
  }
}
```

{% /tab %}
{% /tabs %}

The migration also updates `package.json` files that use the `development` condition in their `exports` field and point to TypeScript files:

{% tabs %}
{% tab label="Before" %}

```json {% fileName="libs/my-lib/package.json" highlightLines=["5"] %}
{
  "name": "@myorg/my-lib",
  "exports": {
    ".": {
      "development": "./src/index.ts",
      "default": "./dist/index.js"
    }
  }
}
```

{% /tab %}

{% tab label="After" %}

```json {% fileName="libs/my-lib/package.json" highlightLines=["5"] %}
{
  "name": "@myorg/my-lib",
  "exports": {
    ".": {
      "@my-org/source": "./src/index.ts",
      "default": "./dist/index.js"
    }
  }
}
```

{% /tab %}
{% /tabs %}

If the custom condition is not set to `["development"]` or the `package.json`'s `exports` field doesn't point to TypeScript files, the migration will not modify the configuration:

{% tabs %}
{% tab label="Before" %}

```json {% fileName="libs/my-lib/package.json" highlightLines=["5"] %}
{
  "name": "@myorg/my-lib",
  "exports": {
    ".": {
      "development": "./dist/index.js",
      "default": "./dist/index.js"
    }
  }
}
```

{% /tab %}

{% tab label="After" %}

```json {% fileName="libs/my-lib/package.json" highlightLines=["5"] %}
{
  "name": "@myorg/my-lib",
  "exports": {
    ".": {
      "development": "./dist/index.js",
      "default": "./dist/index.js"
    }
  }
}
```

{% /tab %}
{% /tabs %}
