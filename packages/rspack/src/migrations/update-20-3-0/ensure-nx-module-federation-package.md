#### Ensure the @nx/module-federation Package is Installed

If workspace includes Module Federation projects, ensure the new `@nx/module-federation` package is installed.

#### Sample Code Changes

##### Before

```json title="package.json"
{
  "dependencies": {}
}
```

##### After

```json title="package.json"
{
  "dependencies": {
    "@nx/module-federation": "20.3.0"
  }
}
```
