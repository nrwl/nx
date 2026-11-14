#### Enable JWT API tokens in Verdaccio configs

The `@nx/js:verdaccio` executor and `startLocalRegistry` set a placeholder npm auth token for the local registry, because npm and bun refuse to publish to a registry without one. Verdaccio 7 rejects a token it cannot decode with a 401 error, which breaks `npm publish` and `npm view` against the local registry. With JWT API tokens enabled, Verdaccio 6 and 7 treat the placeholder token as anonymous instead.

The migration adds a `security.api.jwt` section to each Verdaccio config file that an `@nx/js:verdaccio` target points at through its `config` option, including target configurations and `targetDefaults` in `nx.json`. Config files that already set `security.api.jwt`, or set `security.api.legacy` to `false`, already accept the placeholder token and stay unchanged.

JWT API tokens turn existing tokens from `npm login` into anonymous ones. The migration therefore lists, and leaves unchanged, config files that rely on logged-in users:

- a package rule grants `access`, `publish`, `unpublish` or `stage` only to logged-in users
- `publish.check_owners` is enabled
- an auth plugin other than `htpasswd` is configured

It also lists config files that already have a `security` section, and files it cannot parse or update.

In the config files it changes, users who logged in before the migration act as anonymous users until they log in again. Installs and publishes keep working, but `npm whoami` fails on Verdaccio 7. New tokens from `npm login` expire after 7 days.

#### Sample code changes

##### Before

```yaml title=".verdaccio/config.yml"
storage: ../tmp/local-registry/storage

packages:
  '**':
    access: $all
    publish: $all
    unpublish: $all
```

##### After

```yaml title=".verdaccio/config.yml"
storage: ../tmp/local-registry/storage

packages:
  '**':
    access: $all
    publish: $all
    unpublish: $all

# jwt tokens make verdaccio 7+ treat the placeholder npm auth token set by nx
# as anonymous instead of rejecting it
security:
  api:
    jwt:
      sign:
        expiresIn: 7d
```
