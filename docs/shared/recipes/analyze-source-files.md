# Disable Graph Links Created from Analyzing Source Files

If you want to disable detecting dependencies from source code and want to only use the dependencies as defined in `package.json` (the same way yarn does), you can add the following configuration to your `nx.json` file:

```json {% fileName="nx.json" %}
{
  "pluginsConfig": {
    "@nx/js": {
      "analyzeSourceFiles": false
    }
  }
}
```

## Default

The default setting for Nx repos is `"analyzeSourceFiles": true`. The assumption is that if there is a real link in the code between projects, you want to know about it. For Lerna repos, the default value is `false` in order to maintain backward compatibility with the way Lerna has always calculated dependencies.
