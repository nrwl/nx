#### Remove defaults for the removed SCAM generators

Nx v24 removes the generators that created and converted single component Angular modules (SCAMs):

- `@nx/angular:scam`
- `@nx/angular:scam-directive`
- `@nx/angular:scam-pipe`
- `@nx/angular:scam-to-standalone`

Nx no longer reads generator defaults set for them.
This migration removes those defaults from `nx.json` and from the configuration of every project, including projects defined in `angular.json`.
It handles both the `"@nx/angular:scam"` key form and the nested `"@nx/angular": { "scam": {} }` form.
When the removal leaves the `@nx/angular` entry or the whole `generators` object (`schematics` in `angular.json`) empty, the migration removes it too.

The migration doesn't change commands or scripts that run these generators.
Use the `@nx/angular:component`, `@nx/angular:directive`, or `@nx/angular:pipe` generators instead.

#### Sample code changes

##### Before

```json title="nx.json"
{
  "generators": {
    "@nx/angular:component": {
      "type": "component"
    },
    "@nx/angular:scam": {
      "type": "component"
    },
    "@nx/angular:scam-directive": {
      "type": "directive"
    }
  }
}
```

##### After

```json title="nx.json"
{
  "generators": {
    "@nx/angular:component": {
      "type": "component"
    }
  }
}
```
