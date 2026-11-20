export const trustedDependenciesRootBunLock = `{
  "lockfileVersion": 1,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "demo",
    },
    "apps/api": {
      "name": "@demo/api",
      "version": "0.0.1",
      "dependencies": {
        "is-odd": "^1.0.0",
        "normalize-path": "^3.0.0",
      },
      "optionalDependencies": {
        "fsevents": "^2.3.0",
      },
    },
    "apps/other": {
      "name": "@demo/other",
      "version": "0.0.1",
      "dependencies": {
        "supports-color": "^8.1.0",
      },
    },
  },
  "trustedDependencies": [
    "is-odd",
    "fsevents",
    "supports-color",
  ],
  "packages": {
    "@demo/api": ["@demo/api@workspace:apps/api"],

    "@demo/other": ["@demo/other@workspace:apps/other"],

    "fsevents": ["fsevents@2.3.3", "", { "os": "darwin" }, "sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw=="],

    "has-flag": ["has-flag@4.0.0", "", {}, "sha512-EykJT/Q1KjTWctppgIAgfSO0tKVuZUjhgMr17kqTumMl6Afv3EISleU7qZUzoXDFTAHTDC4NOoG/ZxU3EvlMPQ=="],

    "is-buffer": ["is-buffer@1.1.6", "", {}, "sha512-NcdALwpXkTm5Zvvbk7owOUSvVvBKDgKP5/ewfXEznmQFfs4ZRmanOeKBTjRVjka3QFoN6XJ+9F3USqfHqTaU5w=="],

    "is-number": ["is-number@3.0.0", "", { "dependencies": { "kind-of": "^3.0.2" } }, "sha512-4cboCqIpliH+mAvFNegjZQ4kgKc3ZUhQVr3HvWbSh5q3WH2v82ct+T2Y1hdU5Gdtorx/cLifQjqCbL7bpznLTg=="],

    "is-odd": ["is-odd@1.0.0", "", { "dependencies": { "is-number": "^3.0.0" } }, "sha512-yIhxkKCK7pZnj48WBvaTQ36Or7PymGYqmZrSNqkrhmU3pakkp2TWhuN7hH25bqJgH+Xq4IZ3QNd3+QVshldEHA=="],

    "kind-of": ["kind-of@3.2.2", "", { "dependencies": { "is-buffer": "^1.1.5" } }, "sha512-NOW9QQXMoZGg/oqnVNoNTTIFEIid1627WCffUBJEdMxYApq7mNE7CpzucIPc+ZQg25Phej7IJSmX3hO+oblOtQ=="],

    "normalize-path": ["normalize-path@3.0.0", "", {}, "sha512-6eZs5Ls3WtCisHWp9S2GUy8dqkpGi4BVSz3GaqiE6ezub0512ESztXUwUB6C6IKbQkY2Pnb/mD4WYojCRwcwLA=="],

    "supports-color": ["supports-color@8.1.1", "", { "dependencies": { "has-flag": "^4.0.0" } }, "sha512-MpUEN2OodtUzxvKQl72cUF7RQ5EiHsGvSsVG0ia9c5RbWGL2CI4C7EpPS8UTBIplnlzZiNuV56w+FuNxy3ty2Q=="],
  }
}
`;

export const emptyTrustedDependenciesRootBunLock = `{
  "lockfileVersion": 2,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "demo",
    },
    "apps/api": {
      "name": "@demo/api",
      "version": "0.0.1",
      "dependencies": {
        "is-odd": "^1.0.0",
        "normalize-path": "^3.0.0",
      },
      "optionalDependencies": {
        "fsevents": "^2.3.0",
      },
    },
    "apps/other": {
      "name": "@demo/other",
      "version": "0.0.1",
      "dependencies": {
        "supports-color": "^8.1.0",
      },
    },
  },
  "trustedDependencies": [],
  "packages": {
    "@demo/api": ["@demo/api@workspace:apps/api"],

    "@demo/other": ["@demo/other@workspace:apps/other"],

    "fsevents": ["fsevents@2.3.3", "", { "os": "darwin", "hasInstallScript": true }, "sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw=="],

    "has-flag": ["has-flag@4.0.0", "", {}, "sha512-EykJT/Q1KjTWctppgIAgfSO0tKVuZUjhgMr17kqTumMl6Afv3EISleU7qZUzoXDFTAHTDC4NOoG/ZxU3EvlMPQ=="],

    "is-buffer": ["is-buffer@1.1.6", "", {}, "sha512-NcdALwpXkTm5Zvvbk7owOUSvVvBKDgKP5/ewfXEznmQFfs4ZRmanOeKBTjRVjka3QFoN6XJ+9F3USqfHqTaU5w=="],

    "is-number": ["is-number@3.0.0", "", { "dependencies": { "kind-of": "^3.0.2" } }, "sha512-4cboCqIpliH+mAvFNegjZQ4kgKc3ZUhQVr3HvWbSh5q3WH2v82ct+T2Y1hdU5Gdtorx/cLifQjqCbL7bpznLTg=="],

    "is-odd": ["is-odd@1.0.0", "", { "dependencies": { "is-number": "^3.0.0" } }, "sha512-yIhxkKCK7pZnj48WBvaTQ36Or7PymGYqmZrSNqkrhmU3pakkp2TWhuN7hH25bqJgH+Xq4IZ3QNd3+QVshldEHA=="],

    "kind-of": ["kind-of@3.2.2", "", { "dependencies": { "is-buffer": "^1.1.5" } }, "sha512-NOW9QQXMoZGg/oqnVNoNTTIFEIid1627WCffUBJEdMxYApq7mNE7CpzucIPc+ZQg25Phej7IJSmX3hO+oblOtQ=="],

    "normalize-path": ["normalize-path@3.0.0", "", {}, "sha512-6eZs5Ls3WtCisHWp9S2GUy8dqkpGi4BVSz3GaqiE6ezub0512ESztXUwUB6C6IKbQkY2Pnb/mD4WYojCRwcwLA=="],

    "supports-color": ["supports-color@8.1.1", "", { "dependencies": { "has-flag": "^4.0.0" } }, "sha512-MpUEN2OodtUzxvKQl72cUF7RQ5EiHsGvSsVG0ia9c5RbWGL2CI4C7EpPS8UTBIplnlzZiNuV56w+FuNxy3ty2Q=="],
  }
}
`;

export const omittedTrustedDependenciesRootBunLock = `{
  "lockfileVersion": 1,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "demo",
    },
    "apps/api": {
      "name": "@demo/api",
      "version": "0.0.1",
      "dependencies": {
        "is-odd": "^1.0.0",
        "normalize-path": "^3.0.0",
      },
      "optionalDependencies": {
        "fsevents": "^2.3.0",
      },
    },
    "apps/other": {
      "name": "@demo/other",
      "version": "0.0.1",
      "dependencies": {
        "supports-color": "^8.1.0",
      },
    },
  },
  "packages": {
    "@demo/api": ["@demo/api@workspace:apps/api"],

    "@demo/other": ["@demo/other@workspace:apps/other"],

    "fsevents": ["fsevents@2.3.3", "", { "os": "darwin" }, "sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw=="],

    "has-flag": ["has-flag@4.0.0", "", {}, "sha512-EykJT/Q1KjTWctppgIAgfSO0tKVuZUjhgMr17kqTumMl6Afv3EISleU7qZUzoXDFTAHTDC4NOoG/ZxU3EvlMPQ=="],

    "is-buffer": ["is-buffer@1.1.6", "", {}, "sha512-NcdALwpXkTm5Zvvbk7owOUSvVvBKDgKP5/ewfXEznmQFfs4ZRmanOeKBTjRVjka3QFoN6XJ+9F3USqfHqTaU5w=="],

    "is-number": ["is-number@3.0.0", "", { "dependencies": { "kind-of": "^3.0.2" } }, "sha512-4cboCqIpliH+mAvFNegjZQ4kgKc3ZUhQVr3HvWbSh5q3WH2v82ct+T2Y1hdU5Gdtorx/cLifQjqCbL7bpznLTg=="],

    "is-odd": ["is-odd@1.0.0", "", { "dependencies": { "is-number": "^3.0.0" } }, "sha512-yIhxkKCK7pZnj48WBvaTQ36Or7PymGYqmZrSNqkrhmU3pakkp2TWhuN7hH25bqJgH+Xq4IZ3QNd3+QVshldEHA=="],

    "kind-of": ["kind-of@3.2.2", "", { "dependencies": { "is-buffer": "^1.1.5" } }, "sha512-NOW9QQXMoZGg/oqnVNoNTTIFEIid1627WCffUBJEdMxYApq7mNE7CpzucIPc+ZQg25Phej7IJSmX3hO+oblOtQ=="],

    "normalize-path": ["normalize-path@3.0.0", "", {}, "sha512-6eZs5Ls3WtCisHWp9S2GUy8dqkpGi4BVSz3GaqiE6ezub0512ESztXUwUB6C6IKbQkY2Pnb/mD4WYojCRwcwLA=="],

    "supports-color": ["supports-color@8.1.1", "", { "dependencies": { "has-flag": "^4.0.0" } }, "sha512-MpUEN2OodtUzxvKQl72cUF7RQ5EiHsGvSsVG0ia9c5RbWGL2CI4C7EpPS8UTBIplnlzZiNuV56w+FuNxy3ty2Q=="],
  }
}
`;
