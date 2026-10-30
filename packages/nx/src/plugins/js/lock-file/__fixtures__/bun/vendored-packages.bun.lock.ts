// `a` vendors `vend` (which nests `inner` and declares the `ttar` tarball) and
// a fork of `is-odd`, while `b` installs `is-odd` from the registry.
export const vendoredPackagesBunLock = `{
  "lockfileVersion": 2,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "root",
    },
    "apps/a": {
      "name": "a",
      "dependencies": {
        "@demo/lib": "file:../../libs/lib",
        "is-odd": "file:../../vendor/is-odd",
        "vend": "file:../../vendor/vend",
      },
    },
    "apps/b": {
      "name": "b",
      "dependencies": {
        "is-odd": "1.0.0",
      },
    },
    "libs/lib": {
      "name": "@demo/lib",
    },
  },
  "packages": {
    "@demo/lib": ["@demo/lib@workspace:libs/lib"],

    "a": ["a@workspace:apps/a"],

    "b": ["b@workspace:apps/b"],

    "is-buffer": ["is-buffer@1.1.6", "", {}, "sha512-NcdALwpXkTm5Zvvbk7owOUSvVvBKDgKP5/ewfXEznmQFfs4ZRmanOeKBTjRVjka3QFoN6XJ+9F3USqfHqTaU5w=="],

    "is-number": ["is-number@3.0.0", "", { "dependencies": { "kind-of": "^3.0.2" } }, "sha512-4cboCqIpliH+mAvFNegjZQ4kgKc3ZUhQVr3HvWbSh5q3WH2v82ct+T2Y1hdU5Gdtorx/cLifQjqCbL7bpznLTg=="],

    "is-odd": ["is-odd@1.0.0", "", { "dependencies": { "is-number": "^3.0.0" } }, "sha512-yIhxkKCK7pZnj48WBvaTQ36Or7PymGYqmZrSNqkrhmU3pakkp2TWhuN7hH25bqJgH+Xq4IZ3QNd3+QVshldEHA=="],

    "kind-of": ["kind-of@3.2.2", "", { "dependencies": { "is-buffer": "^1.1.5" } }, "sha512-NOW9QQXMoZGg/oqnVNoNTTIFEIid1627WCffUBJEdMxYApq7mNE7CpzucIPc+ZQg25Phej7IJSmX3hO+oblOtQ=="],

    "ms": ["ms@2.1.3", "", {}, "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA=="],

    "ttar": ["ttar@../ttar-1.0.0.tgz", {}, "sha512-vUBRCjoXfRDJSPRNadts6ZFlwSz5G0jNyodbIq3NX45es/e8u7qtf22H9OuAAlsvDfM+XdUjeewGO8XlwKr60w=="],

    "a/is-odd": ["is-odd@file:vendor/is-odd", { "dependencies": { "ms": "^2.0.0" } }],

    "a/vend": ["vend@file:vendor/vend", { "dependencies": { "inner": "file:../inner", "ms": "^2.1.0", "ttar": "file:../ttar-1.0.0.tgz" } }],

    "a/vend/inner": ["inner@file:vendor/inner", {}],
  }
}
`;

// The same workspace without `ttar` after a second Bun 1.2.23 install, which
// records the `file:` dependency on the `@demo/lib` workspace as a package entry.
export const workspaceFileDependencyBunLock = `{
  "lockfileVersion": 1,
  "workspaces": {
    "": {
      "name": "root",
    },
    "apps/a": {
      "name": "a",
      "dependencies": {
        "@demo/lib": "file:../../libs/lib",
        "is-odd": "file:../../vendor/is-odd",
        "vend": "file:../../vendor/vend",
      },
    },
    "apps/b": {
      "name": "b",
      "dependencies": {
        "is-odd": "1.0.0",
      },
    },
    "libs/lib": {
      "name": "@demo/lib",
    },
  },
  "packages": {
    "@demo/lib": ["@demo/lib@workspace:libs/lib"],

    "a": ["a@workspace:apps/a"],

    "b": ["b@workspace:apps/b"],

    "is-buffer": ["is-buffer@1.1.6", "", {}, "sha512-NcdALwpXkTm5Zvvbk7owOUSvVvBKDgKP5/ewfXEznmQFfs4ZRmanOeKBTjRVjka3QFoN6XJ+9F3USqfHqTaU5w=="],

    "is-number": ["is-number@3.0.0", "", { "dependencies": { "kind-of": "^3.0.2" } }, "sha512-4cboCqIpliH+mAvFNegjZQ4kgKc3ZUhQVr3HvWbSh5q3WH2v82ct+T2Y1hdU5Gdtorx/cLifQjqCbL7bpznLTg=="],

    "is-odd": ["is-odd@1.0.0", "", { "dependencies": { "is-number": "^3.0.0" } }, "sha512-yIhxkKCK7pZnj48WBvaTQ36Or7PymGYqmZrSNqkrhmU3pakkp2TWhuN7hH25bqJgH+Xq4IZ3QNd3+QVshldEHA=="],

    "kind-of": ["kind-of@3.2.2", "", { "dependencies": { "is-buffer": "^1.1.5" } }, "sha512-NOW9QQXMoZGg/oqnVNoNTTIFEIid1627WCffUBJEdMxYApq7mNE7CpzucIPc+ZQg25Phej7IJSmX3hO+oblOtQ=="],

    "ms": ["ms@2.1.3", "", {}, "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA=="],

    "a/@demo/lib": ["@demo/lib@file:libs/lib", {}],

    "a/is-odd": ["is-odd@file:vendor/is-odd", { "dependencies": { "ms": "^2.0.0" } }],

    "a/vend": ["vend@file:vendor/vend", { "dependencies": { "inner": "file:../inner", "ms": "^2.1.0" } }],

    "a/vend/inner": ["inner@file:vendor/inner", {}],
  }
}
`;
