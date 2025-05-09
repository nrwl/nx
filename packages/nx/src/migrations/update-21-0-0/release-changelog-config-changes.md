#### Nx Release Changelog Config Changes

In Nx v21, the `mapAuthorsToGitHubUsernames` changelog "renderOption" for the default changelog renderer was renamed to `applyUsernameToAuthors` to reflect the fact that it is no longer specific to GitHub. Most people were not setting this option directly, but if you were, it will be automatically migrated by this migration.

The migration will also update release groups changelog configuration, if applicable.

#### Sample Code Changes

{% tabs %}
{% tab label="Before" %}

```json {% fileName="nx.json" %}
{
  "release": {
    "changelog": {
      "workspaceChangelog": {
        "renderOptions": {
          "mapAuthorsToGitHubUsernames": true
        }
      },
      "projectChangelogs": {
        "renderOptions": {
          "mapAuthorsToGitHubUsernames": false
        }
      }
    }
  }
}
```

{% /tab %}
{% tab label="After" %}

```json {% fileName="nx.json" %}
{
  "release": {
    "changelog": {
      "workspaceChangelog": {
        "renderOptions": {
          "applyUsernameToAuthors": true
        }
      },
      "projectChangelogs": {
        "renderOptions": {
          "applyUsernameToAuthors": false
        }
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}
