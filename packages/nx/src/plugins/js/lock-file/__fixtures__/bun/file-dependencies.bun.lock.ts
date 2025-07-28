export const fileDependenciesLockFile = `{
  "lockfileVersion": 1,
  "workspaces": {
    "": {
      "name": "file-dependencies-test",
      "dependencies": {
        "local-lib": "file:./packages/local-lib",
        "shared-utils": "file:./shared-utils",
      },
      "devDependencies": {
        "test-utils": "file:./test-utils",
      },
    },
  },
  "packages": {
    "local-lib": ["local-lib@file:packages/local-lib", {}],

    "shared-utils": ["shared-utils@file:shared-utils", { "dependencies": { "uuid": "^9.0.0" } }],

    "test-utils": ["test-utils@file:test-utils", {}],

    "uuid": ["uuid@9.0.1", "", { "bin": { "uuid": "dist/bin/uuid" } }, "sha512-b+1eJOlsR9K8HJpow9Ok3fiWOWSIcIzXodvv0rQjVoOVNpWMpxf1wZNpt4y9h10odCNrqnYp1OBzRktckBe3sA=="],
  }
}`;
