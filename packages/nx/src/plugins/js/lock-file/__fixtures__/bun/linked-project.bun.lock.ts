export const linkedProjectBunLock = `{
  "lockfileVersion": 2,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "rvws",
    },
    "apps/a": {
      "name": "a",
      "version": "0.0.0",
      "dependencies": {
        "x": "link:../../libs/x/dist",
      },
    },
    "apps/b": {
      "name": "b",
      "version": "0.0.0",
      "dependencies": {
        "x": "link:../../vendor/x",
      },
    },
  },
  "packages": {
    "a": ["a@workspace:apps/a"],

    "b": ["b@workspace:apps/b"],

    "x": ["x@link:./libs/x/dist", {}],

    "b/x": ["x@link:./vendor/x", {}],
  }
}
`;
