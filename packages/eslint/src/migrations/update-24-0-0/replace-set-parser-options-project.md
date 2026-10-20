#### Replace `setParserOptionsProject` with `enableTypedLinting` in generator defaults

Nx 24 removes the deprecated `setParserOptionsProject` generator option, which `enableTypedLinting` replaces. The migration rewrites the generator defaults in `nx.json`, in `project.json` files and in the `nx` key of project `package.json` files. It handles both the flat form (`@nx/react:library`) and the nested form (`@nx/react` -> `library`).

It covers every generator that accepted the option and still exists in Nx 24:

- `application`: `@nx/angular`, `@nx/detox`, `@nx/expo`, `@nx/express`, `@nx/nest`, `@nx/next`, `@nx/node`, `@nx/nuxt`, `@nx/react`, `@nx/react-native`, `@nx/vue` and `@nx/web`
- `library`: `@nx/angular`, `@nx/expo`, `@nx/js`, `@nx/nest`, `@nx/next`, `@nx/node`, `@nx/react`, `@nx/react-native` and `@nx/vue`
- `configuration`: `@nx/cypress` and `@nx/playwright`
- `@nx/angular:add-linting` and `@nx/plugin:plugin`

Generators enabled typed linting when either option was `true`, and the migrated defaults keep that result. `setParserOptionsProject: true` becomes `enableTypedLinting: true`, and `setParserOptionsProject: false` is dropped. When the options are set in several places (nested and flat keys, `nx.json`, `project.json` and `package.json`), the migration rewrites each one so the merged default doesn't change.

The migration doesn't update scripts that pass `--setParserOptionsProject` to `nx g`. Pass `--enableTypedLinting` instead. Most generators ignore the removed flag without an error, so an unchanged script generates projects without typed linting.

#### Sample code changes

##### Before

```json title="nx.json"
{
  "generators": {
    "@nx/react:library": {
      "setParserOptionsProject": true
    },
    "@nx/node": {
      "application": {
        "setParserOptionsProject": false,
        "framework": "express"
      }
    }
  }
}
```

##### After

```json title="nx.json"
{
  "generators": {
    "@nx/react:library": {
      "enableTypedLinting": true
    },
    "@nx/node": {
      "application": {
        "framework": "express"
      }
    }
  }
}
```

A project default of `enableTypedLinting: false` didn't turn typed linting off while `nx.json` set `setParserOptionsProject: true`, so the migration sets it to `true`:

##### Before

```json title="libs/my-lib/project.json"
{
  "generators": {
    "@nx/react:library": {
      "enableTypedLinting": false
    }
  }
}
```

##### After

```json title="libs/my-lib/project.json"
{
  "generators": {
    "@nx/react:library": {
      "enableTypedLinting": true
    }
  }
}
```
