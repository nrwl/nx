#### Update Jest Snapshot Guide Link

Updates the snapshot guide link at the top of every `.snap` file from the legacy `https://goo.gl/fbAQLP` to `https://jestjs.io/docs/snapshot-testing`. Jest v30 errors out at test setup time if it sees the old link, so existing snapshot files need to be rewritten before tests can run. Read more at the [Jest v30 migration notes](https://jestjs.io/docs/upgrading-to-jest30).

#### Examples

##### Before

```text title="apps/myapp/src/__snapshots__/example.spec.ts.snap"
// Jest Snapshot v1, https://goo.gl/fbAQLP

exports[`renders correctly 1`] = `"hello"`;
```

##### After

```text title="apps/myapp/src/__snapshots__/example.spec.ts.snap"
// Jest Snapshot v1, https://jestjs.io/docs/snapshot-testing

exports[`renders correctly 1`] = `"hello"`;
```
