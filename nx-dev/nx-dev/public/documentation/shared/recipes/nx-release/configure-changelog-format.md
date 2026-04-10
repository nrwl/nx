# Configure Changelog Format

The default changelog renderer for `nx release` generates a changelog entry for each released project similar to the following:

```md
## 7.9.0 (2024-05-13)

### 🚀 Features

- **rule-tester:** check for missing placeholder data in the message ([#9039](https://github.com/typescript-eslint/typescript-eslint/pull/9039))

### ❤️ Thank You

- Kirk Waiblinger
- Sheetal Nandi
- Vinccool96
```

## Include All Metadata

There are a few options available to modify the default changelog renderer output. They can be applied to both `workspaceChangelog` and `projectChangelogs` in exactly the same way. All four options are true by default:

```json
{
  "release": {
    "changelog": {
      "projectChangelogs": {
        "renderOptions": {
          "authors": true,
          "mapAuthorsToGitHubUsernames": true,
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

#### `mapAuthorsToGitHubUsernames`

If authors is enabled, controls whether or not to try to map the authors to their GitHub usernames using https://ungh.cc (from https://github.com/unjs/ungh) and the email addresses found in the commits. Defaults to `true`.

You should disable this option if you don't want to make any external requests to https://ungh.cc

#### `commitReferences`

Whether the commit references (such as commit and/or PR links) should be included in the changelog. Defaults to `true`.

#### `versionTitleDate`

Whether to include the date in the version title. It can be set to `false` to disable it, or `true` to enable with the default of (YYYY-MM-DD). Defaults to `true`.

## Remove All Metadata

If you prefer a more minimalist changelog, you can set all the options to false, like this:

```json
{
  "release": {
    "changelog": {
      "projectChangelogs": {
        "renderOptions": {
          "authors": false,
          "mapAuthorsToGitHubUsernames": false,
          "commitReferences": false,
          "versionTitleDate": false
        }
      }
    }
  }
}
```

Which will generate a changelog that looks similar to the following:

```md
## 7.9.0

### 🚀 Features

- **rule-tester:** check for missing placeholder data in the message
```
