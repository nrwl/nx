#### Migrate `skipSetupFile` Generator Default to `setupFile`

Migrates the previously deprecated `skipSetupFile` option of the `@nx/jest:configuration` generator. When set as a default in `nx.json` `generators` or per-project `project.json` `generators`, it is rewritten as follows:

- `skipSetupFile: true` becomes `setupFile: 'none'` (preserving the original behavior of skipping the setup file). Existing `setupFile` values are left untouched.
- `skipSetupFile: false` is dropped (it was a no-op).

Both flat (`@nx/jest:configuration`) and nested (`@nx/jest` -> `configuration`) forms are handled.

#### Examples

Rewrite a `nx.json` generator default:

##### Before

```json title="nx.json" {4}
{
  "generators": {
    "@nx/jest:configuration": {
      "skipSetupFile": true
    }
  }
}
```

##### After

```json title="nx.json"
{
  "generators": {
    "@nx/jest:configuration": {
      "setupFile": "none"
    }
  }
}
```

Drop the option when set to `false`:

##### Before

```json title="nx.json" {4}
{
  "generators": {
    "@nx/jest:configuration": {
      "skipSetupFile": false,
      "testEnvironment": "jsdom"
    }
  }
}
```

##### After

```json title="nx.json"
{
  "generators": {
    "@nx/jest:configuration": {
      "testEnvironment": "jsdom"
    }
  }
}
```

Rewrite a per-project generator default:

##### Before

```json title="apps/myapp/project.json" {4}
{
  "generators": {
    "@nx/jest:configuration": {
      "skipSetupFile": true
    }
  }
}
```

##### After

```json title="apps/myapp/project.json"
{
  "generators": {
    "@nx/jest:configuration": {
      "setupFile": "none"
    }
  }
}
```

The nested form (`@nx/jest` -> `configuration`) is handled the same way.
