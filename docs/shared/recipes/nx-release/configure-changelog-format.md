# Configure Changelog Format

There are a couple of options available for the default implementation of the changelog renderer offered by nx. They can be applied to both `workspaceChangelog` and `projectChangelogs` in exactly the same way. Below if an example for the latter:

```json
{
  "release": {
    "changelog": {
      "projectChangelogs": {
        "renderOptions": {
          "authors": true,
          "commitReferences": true,
          "versionTitleDate": true
        }
      }
    }
  }
}
```

#### `authors`

Whether the commit authors should be added to the bottom of the changelog in a "Thank You" section. Defaults to `true`.

#### `commitReferences`

Whether the commit references (such as commit and/or PR links) should be included in the changelog. Defaults to `true`.

#### `versionTitleDate`

Whether to include the date in the version title. It can be set to `false` to disable it, or `true` to enable with the default of (YYYY-MM-DD). Defaults to `true`.
