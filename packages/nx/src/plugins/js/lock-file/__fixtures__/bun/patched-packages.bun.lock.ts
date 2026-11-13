export const unpatchedPackagesBunLock = `{
  "lockfileVersion": 2,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "root",
      "dependencies": {
        "is-odd": "1.0.0",
        "left-pad": "1.1.0",
        "odd-alias": "npm:is-odd@2.0.0",
      },
    },
  },
  "packages": {
    "is-buffer": ["is-buffer@1.1.6", "", {}, "sha512-NcdALwpXkTm5Zvvbk7owOUSvVvBKDgKP5/ewfXEznmQFfs4ZRmanOeKBTjRVjka3QFoN6XJ+9F3USqfHqTaU5w=="],

    "is-number": ["is-number@3.0.0", "", { "dependencies": { "kind-of": "^3.0.2" } }, "sha512-4cboCqIpliH+mAvFNegjZQ4kgKc3ZUhQVr3HvWbSh5q3WH2v82ct+T2Y1hdU5Gdtorx/cLifQjqCbL7bpznLTg=="],

    "is-odd": ["is-odd@1.0.0", "", { "dependencies": { "is-number": "^3.0.0" } }, "sha512-yIhxkKCK7pZnj48WBvaTQ36Or7PymGYqmZrSNqkrhmU3pakkp2TWhuN7hH25bqJgH+Xq4IZ3QNd3+QVshldEHA=="],

    "kind-of": ["kind-of@3.2.2", "", { "dependencies": { "is-buffer": "^1.1.5" } }, "sha512-NOW9QQXMoZGg/oqnVNoNTTIFEIid1627WCffUBJEdMxYApq7mNE7CpzucIPc+ZQg25Phej7IJSmX3hO+oblOtQ=="],

    "left-pad": ["left-pad@1.1.0", "", {}, "sha512-C8cw/7VpfXLj8Yjlmux8lqb3mfIe3vEXTdik/cXTuzZ8FXJnu45UAWp94XlWWmcW7Yxl74wvHw8w10wIHNGHRQ=="],

    "odd-alias": ["is-odd@2.0.0", "", { "dependencies": { "is-number": "^4.0.0" } }, "sha512-OTiixgpZAT1M4NHgS5IguFp/Vz2VI3U7Goh4/HA1adtwyLtSBrxYlcSYkhpAE07s4fKEcjrFxyvtQBND4vFQyQ=="],

    "odd-alias/is-number": ["is-number@4.0.0", "", {}, "sha512-rSklcAIlf1OmFdyAqbnWTLVelsQ58uvZ66S/ZyawjWqIviTWCjg2PzVGw8WUA+nNuPTqb4wgA+NszrJ+08LlgQ=="],
  }
}
`;

export const patchedPackagesBunLock = `{
  "lockfileVersion": 2,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "root",
      "dependencies": {
        "is-odd": "1.0.0",
        "left-pad": "1.1.0",
        "odd-alias": "npm:is-odd@2.0.0",
      },
    },
  },
  "patchedDependencies": {
    "is-odd@2.0.0": "custom/is-odd@2.0.0.patch",
    "is-odd@1.0.0": "patches/is-odd@1.0.0.patch",
  },
  "packages": {
    "is-buffer": ["is-buffer@1.1.6", "", {}, "sha512-NcdALwpXkTm5Zvvbk7owOUSvVvBKDgKP5/ewfXEznmQFfs4ZRmanOeKBTjRVjka3QFoN6XJ+9F3USqfHqTaU5w=="],

    "is-number": ["is-number@3.0.0", "", { "dependencies": { "kind-of": "^3.0.2" } }, "sha512-4cboCqIpliH+mAvFNegjZQ4kgKc3ZUhQVr3HvWbSh5q3WH2v82ct+T2Y1hdU5Gdtorx/cLifQjqCbL7bpznLTg=="],

    "is-odd": ["is-odd@1.0.0", "", { "dependencies": { "is-number": "^3.0.0" } }, "sha512-yIhxkKCK7pZnj48WBvaTQ36Or7PymGYqmZrSNqkrhmU3pakkp2TWhuN7hH25bqJgH+Xq4IZ3QNd3+QVshldEHA=="],

    "kind-of": ["kind-of@3.2.2", "", { "dependencies": { "is-buffer": "^1.1.5" } }, "sha512-NOW9QQXMoZGg/oqnVNoNTTIFEIid1627WCffUBJEdMxYApq7mNE7CpzucIPc+ZQg25Phej7IJSmX3hO+oblOtQ=="],

    "left-pad": ["left-pad@1.1.0", "", {}, "sha512-C8cw/7VpfXLj8Yjlmux8lqb3mfIe3vEXTdik/cXTuzZ8FXJnu45UAWp94XlWWmcW7Yxl74wvHw8w10wIHNGHRQ=="],

    "odd-alias": ["is-odd@2.0.0", "", { "dependencies": { "is-number": "^4.0.0" } }, "sha512-OTiixgpZAT1M4NHgS5IguFp/Vz2VI3U7Goh4/HA1adtwyLtSBrxYlcSYkhpAE07s4fKEcjrFxyvtQBND4vFQyQ=="],

    "odd-alias/is-number": ["is-number@4.0.0", "", {}, "sha512-rSklcAIlf1OmFdyAqbnWTLVelsQ58uvZ66S/ZyawjWqIviTWCjg2PzVGw8WUA+nNuPTqb4wgA+NszrJ+08LlgQ=="],
  }
}
`;
