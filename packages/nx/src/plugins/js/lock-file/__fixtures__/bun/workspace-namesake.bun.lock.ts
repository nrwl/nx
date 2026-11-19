// Bun 1.3 output: the workspace package `foo` and the root's vendored `foo`
// share a key, and JSON parsing keeps the last one.
export const workspaceNamesakeBunLock = `{
  "lockfileVersion": 1,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "root",
      "dependencies": {
        "foo": "file:./vendor/foo",
      },
    },
    "apps/a": {
      "name": "a",
      "version": "1.0.0",
      "dependencies": {
        "foo": "workspace:*",
      },
    },
    "apps/b": {
      "name": "b",
      "version": "1.0.0",
    },
    "libs/foo": {
      "name": "foo",
      "version": "1.0.0",
    },
  },
  "packages": {
    "a": ["a@workspace:apps/a"],

    "b": ["b@workspace:apps/b"],

    "foo": ["foo@workspace:libs/foo"],

    "foo": ["foo@file:vendor/foo", { "dependencies": { "bar": "file:../bar" } }],

    "foo/bar": ["bar@file:vendor/bar", {}],
  }
}
`;
