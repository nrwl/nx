#### Update `moduleResolution` to `bundler` in TypeScript configurations

Updates the TypeScript `moduleResolution` option to `'bundler'` for improved compatibility with modern package resolution algorithms used by bundlers like Webpack, Vite, and esbuild.

#### Examples

The migration will update TypeScript configuration files in your workspace to use the `'bundler'` module resolution strategy:

{% tabs %}
{% tab label="Before" %}

```json {% fileName="apps/app1/tsconfig.app.json" highlightLines=["4"] %}
{
  "compilerOptions": {
    "module": "es2020",
    "moduleResolution": "node"
  }
}
```

{% /tab %}

{% tab label="After" %}

```json {% fileName="apps/app1/tsconfig.app.json" highlightLines=["4"] %}
{
  "compilerOptions": {
    "module": "es2020",
    "moduleResolution": "bundler"
  }
}
```

{% /tab %}
{% /tabs %}

If the `moduleResolution` is already set to `'bundler'` or the `module` is set to `'preserve'`, the migration will not modify the configuration:

{% tabs %}
{% tab label="Before" %}

```json {% fileName="apps/app1/tsconfig.app.json" highlightLines=[3,4] %}
{
  "compilerOptions": {
    "module": "preserve",
    "moduleResolution": "node"
  }
}
```

{% /tab %}

{% tab label="After" %}

```json {% fileName="apps/app1/tsconfig.app.json" highlightLines=[3,4] %}
{
  "compilerOptions": {
    "module": "preserve",
    "moduleResolution": "node"
  }
}
```

{% /tab %}
{% /tabs %}
