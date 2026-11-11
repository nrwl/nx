export const overriddenDependencyRootBunLock = `{
  "lockfileVersion": 2,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "demo",
      "devDependencies": {
        "typescript": "^5.9.0",
      },
    },
    "apps/api": {
      "name": "@demo/api",
      "version": "1.0.0",
      "dependencies": {
        "debug": "^4.3.0",
        "is-odd": "^1.0.0",
        "ms": "2.0.0",
      },
    },
    "apps/other": {
      "name": "@demo/other",
      "version": "1.0.0",
      "dependencies": {
        "kind-of": "^3.0.0",
      },
    },
  },
  "overrides": {
    "is-buffer": "1.1.5",
    "ms": "2.1.2",
  },
  "packages": {
    "@demo/api": ["@demo/api@workspace:apps/api"],

    "@demo/other": ["@demo/other@workspace:apps/other"],

    "debug": ["debug@4.4.3", "", { "dependencies": { "ms": "^2.1.3" }, "peerDependencies": { "supports-color": "*" }, "optionalPeers": ["supports-color"] }, "sha512-RGwwWnwQvkVfavKVt22FGLw+xYSdzARwm0ru6DhTVA3umU5hZc28V3kO4stgYryrTlLpuvgI9GiijltAjNbcqA=="],

    "is-buffer": ["is-buffer@1.1.5", "", {}, "sha512-miqftL8E53hH0dtQqLdN+3JwClyJiITcif3gy+RiUlnLJUhEwdyRC29/gpYbuC9IhazGSnP8TjbvxWw2AZylWQ=="],

    "is-number": ["is-number@3.0.0", "", { "dependencies": { "kind-of": "^3.0.2" } }, "sha512-4cboCqIpliH+mAvFNegjZQ4kgKc3ZUhQVr3HvWbSh5q3WH2v82ct+T2Y1hdU5Gdtorx/cLifQjqCbL7bpznLTg=="],

    "is-odd": ["is-odd@1.0.0", "", { "dependencies": { "is-number": "^3.0.0" } }, "sha512-yIhxkKCK7pZnj48WBvaTQ36Or7PymGYqmZrSNqkrhmU3pakkp2TWhuN7hH25bqJgH+Xq4IZ3QNd3+QVshldEHA=="],

    "kind-of": ["kind-of@3.2.2", "", { "dependencies": { "is-buffer": "^1.1.5" } }, "sha512-NOW9QQXMoZGg/oqnVNoNTTIFEIid1627WCffUBJEdMxYApq7mNE7CpzucIPc+ZQg25Phej7IJSmX3hO+oblOtQ=="],

    "ms": ["ms@2.1.2", "", {}, "sha512-sGkPx+VjMtmA6MX27oA4FBFELFCZZ4S4XqeGOXCv68tT+jb3vk/RyaKWP0PTKyWtmLSM0b+adUTEvbs1PEaH2w=="],

    "typescript": ["typescript@5.9.3", "", { "bin": { "tsc": "bin/tsc", "tsserver": "bin/tsserver" } }, "sha512-jl1vZzPDinLr9eUt3J/t7V6FgNEw9QjvBPdysz9KfQDD41fQrC2Y4vKQdiaUpFT4bXlb1RHhLpp8wtm6M5TgSw=="],
  }
}
`;

export const overriddenDependencyPrunedBunLock = `{
  "lockfileVersion": 2,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "@demo/api",
      "dependencies": {
        "debug": "^4.3.0",
        "is-odd": "^1.0.0",
        "ms": "2.1.2",
      },
    },
  },
  "packages": {
    "debug": ["debug@4.4.3", "", { "dependencies": { "ms": "^2.1.3" }, "peerDependencies": { "supports-color": "*" }, "optionalPeers": ["supports-color"] }, "sha512-RGwwWnwQvkVfavKVt22FGLw+xYSdzARwm0ru6DhTVA3umU5hZc28V3kO4stgYryrTlLpuvgI9GiijltAjNbcqA=="],

    "is-buffer": ["is-buffer@1.1.5", "", {}, "sha512-miqftL8E53hH0dtQqLdN+3JwClyJiITcif3gy+RiUlnLJUhEwdyRC29/gpYbuC9IhazGSnP8TjbvxWw2AZylWQ=="],

    "is-number": ["is-number@3.0.0", "", { "dependencies": { "kind-of": "^3.0.2" } }, "sha512-4cboCqIpliH+mAvFNegjZQ4kgKc3ZUhQVr3HvWbSh5q3WH2v82ct+T2Y1hdU5Gdtorx/cLifQjqCbL7bpznLTg=="],

    "is-odd": ["is-odd@1.0.0", "", { "dependencies": { "is-number": "^3.0.0" } }, "sha512-yIhxkKCK7pZnj48WBvaTQ36Or7PymGYqmZrSNqkrhmU3pakkp2TWhuN7hH25bqJgH+Xq4IZ3QNd3+QVshldEHA=="],

    "kind-of": ["kind-of@3.2.2", "", { "dependencies": { "is-buffer": "^1.1.5" } }, "sha512-NOW9QQXMoZGg/oqnVNoNTTIFEIid1627WCffUBJEdMxYApq7mNE7CpzucIPc+ZQg25Phej7IJSmX3hO+oblOtQ=="],

    "ms": ["ms@2.1.2", "", {}, "sha512-sGkPx+VjMtmA6MX27oA4FBFELFCZZ4S4XqeGOXCv68tT+jb3vk/RyaKWP0PTKyWtmLSM0b+adUTEvbs1PEaH2w=="],
  }
}
`;

export const namesakeOverrideRootBunLock = `{
  "lockfileVersion": 3,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "demo",
    },
    "apps/other": {
      "name": "@demo/other",
      "version": "1.0.0",
      "dependencies": {
        "ms": "2.0.0",
      },
    },
    "libs/api": {
      "name": "api",
      "version": "1.0.0",
      "dependencies": {
        "ms": "2.0.0",
      },
    },
  },
  "overrides": {
    "api": {
      "ms": "2.1.2",
    },
  },
  "packages": {
    "@demo/other": ["@demo/other@workspace:apps/other"],

    "api": ["api@workspace:libs/api"],

    "ms": ["ms@2.0.0", "", {}, "sha512-Tpp60P6IUJDTuOq/5Z8cdskzJujfwqfOTkrwIwj7IRISpnkJnT6SyJ4PCPnGMoFjC9ddhal5KVIYtAt97ix05A=="],

    "api/ms": ["ms@2.1.2", "", {}, "sha512-sGkPx+VjMtmA6MX27oA4FBFELFCZZ4S4XqeGOXCv68tT+jb3vk/RyaKWP0PTKyWtmLSM0b+adUTEvbs1PEaH2w=="],
  }
}
`;

export const namesakeOverridePrunedBunLock = `{
  "lockfileVersion": 3,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "api",
      "dependencies": {
        "ms": "2.0.0",
      },
    },
  },
  "packages": {
    "ms": ["ms@2.0.0", "", {}, "sha512-Tpp60P6IUJDTuOq/5Z8cdskzJujfwqfOTkrwIwj7IRISpnkJnT6SyJ4PCPnGMoFjC9ddhal5KVIYtAt97ix05A=="],
  }
}
`;

export const namesakeInRangeRootBunLock = `{
  "lockfileVersion": 1,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "root",
      "dependencies": {
        "ms": "2.1.2",
      },
    },
    "libs/api": {
      "name": "api",
      "version": "1.0.0",
      "dependencies": {
        "ms": "2.1.3",
      },
    },
  },
  "packages": {
    "api": ["api@workspace:libs/api"],

    "ms": ["ms@2.1.2", "", {}, "sha512-sGkPx+VjMtmA6MX27oA4FBFELFCZZ4S4XqeGOXCv68tT+jb3vk/RyaKWP0PTKyWtmLSM0b+adUTEvbs1PEaH2w=="],

    "api/ms": ["ms@2.1.3", "", {}, "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA=="],
  }
}
`;

export const namesakeInRangePrunedBunLock = `{
  "lockfileVersion": 1,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "api",
      "dependencies": {
        "ms": "^2.1.0",
      },
    },
  },
  "packages": {
    "ms": ["ms@2.1.2", "", {}, "sha512-sGkPx+VjMtmA6MX27oA4FBFELFCZZ4S4XqeGOXCv68tT+jb3vk/RyaKWP0PTKyWtmLSM0b+adUTEvbs1PEaH2w=="],
  }
}
`;

export const rootProjectOverrideRootBunLock = `{
  "lockfileVersion": 2,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "root-ovr",
      "dependencies": {
        "ms": "2.1.2",
      },
    },
  },
  "overrides": {
    "ms": "2.1.3",
  },
  "packages": {
    "ms": ["ms@2.1.3", "", {}, "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA=="],
  }
}
`;

export const rootProjectOverridePrunedBunLock = `{
  "lockfileVersion": 2,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "root-ovr",
      "dependencies": {
        "ms": "2.1.3",
      },
    },
  },
  "packages": {
    "ms": ["ms@2.1.3", "", {}, "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA=="],
  }
}
`;
