export const tupleShapesBunLock = `{
  "lockfileVersion": 2,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "test-workspace",
      "dependencies": {
        "file-pkg": "file:./local-package",
        "git-pkg": "git+file:///tmp/repos/git-pkg.git",
        "is-odd": "1.0.0",
        "workspace-pkg": "workspace:*",
      },
    },
    "apps/workspace-pkg": {
      "name": "workspace-pkg",
      "version": "1.0.0",
    },
  },
  "packages": {
    "file-pkg": ["file-pkg@file:local-package", { "dependencies": { "left-pad": "^1.3.0" } }],

    "git-pkg": ["git-pkg@git+file:///tmp/repos/git-pkg.git#62e28c90a2aadf723b59ed7cebd00ce63a5dae87", { "dependencies": { "ms": "^2.1.0" } }, "62e28c90a2aadf723b59ed7cebd00ce63a5dae87"],

    "is-buffer": ["is-buffer@1.1.6", "", {}, "sha512-NcdALwpXkTm5Zvvbk7owOUSvVvBKDgKP5/ewfXEznmQFfs4ZRmanOeKBTjRVjka3QFoN6XJ+9F3USqfHqTaU5w=="],

    "is-number": ["is-number@3.0.0", "", { "dependencies": { "kind-of": "^3.0.2" } }, "sha512-4cboCqIpliH+mAvFNegjZQ4kgKc3ZUhQVr3HvWbSh5q3WH2v82ct+T2Y1hdU5Gdtorx/cLifQjqCbL7bpznLTg=="],

    "is-odd": ["is-odd@1.0.0", "", { "dependencies": { "is-number": "^3.0.0" } }, "sha512-yIhxkKCK7pZnj48WBvaTQ36Or7PymGYqmZrSNqkrhmU3pakkp2TWhuN7hH25bqJgH+Xq4IZ3QNd3+QVshldEHA=="],

    "kind-of": ["kind-of@3.2.2", "", { "dependencies": { "is-buffer": "^1.1.5" } }, "sha512-NOW9QQXMoZGg/oqnVNoNTTIFEIid1627WCffUBJEdMxYApq7mNE7CpzucIPc+ZQg25Phej7IJSmX3hO+oblOtQ=="],

    "left-pad": ["left-pad@1.3.0", "", {}, "sha512-XI5MPzVNApjAyhQzphX8BkmKsKUxD4LdyK24iZeQGinBN9yTQT3bFlCBy/aVx2HrNcqQGsdot8ghrjyrvMCoEA=="],

    "ms": ["ms@2.1.3", "", {}, "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA=="],

    "workspace-pkg": ["workspace-pkg@workspace:apps/workspace-pkg"],
  }
}
`;
