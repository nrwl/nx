export const libraryDependenciesRootBunLock = `{
  "lockfileVersion": 1,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "demo",
      "dependencies": {
        "debug": "2.6.9",
        "is-number": "^7.0.0",
        "kind-of": "^6.0.0",
        "ms": "2.0.0",
        "supports-color": "^7.0.0",
      },
    },
    "apps/api": {
      "name": "@demo/api",
      "version": "0.0.1",
      "dependencies": {
        "@demo/util": "workspace:*",
        "debug": "^4.3.0",
        "is-odd": "^1.0.0",
        "lp": "npm:left-pad@^1.3.0",
        "normalize-path": "catalog:",
      },
      "optionalDependencies": {
        "fsevents": "^2.3.0",
      },
    },
    "libs/util": {
      "name": "@demo/util",
      "version": "1.0.0",
      "dependencies": {
        "@demo/util2": "workspace:*",
        "ms": "^2.1.0",
        "use-sync-external-store": "1.2.0",
      },
      "devDependencies": {
        "is-extglob": "^2.1.1",
        "left-pad": "^1.3.0",
      },
    },
    "libs/util2": {
      "name": "@demo/util2",
      "version": "2.0.0",
      "dependencies": {
        "picomatch": "^2.0.0",
      },
    },
  },
  "overrides": {
    "is-buffer": "1.1.5",
  },
  "catalog": {
    "normalize-path": "^3.0.0",
  },
  "packages": {
    "@demo/api": ["@demo/api@workspace:apps/api"],

    "@demo/util": ["@demo/util@workspace:libs/util"],

    "@demo/util2": ["@demo/util2@workspace:libs/util2"],

    "debug": ["debug@2.6.9", "", { "dependencies": { "ms": "2.0.0" } }, "sha512-bC7ElrdJaJnPbAP+1EotYvqZsb3ecl5wi6Bfi6BJTUcNowp6cvspg0jXznRTKDjm/E7AdgFBVeAPVMNcKGsHMA=="],

    "fsevents": ["fsevents@2.3.3", "", { "os": "darwin" }, "sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw=="],

    "has-flag": ["has-flag@4.0.0", "", {}, "sha512-EykJT/Q1KjTWctppgIAgfSO0tKVuZUjhgMr17kqTumMl6Afv3EISleU7qZUzoXDFTAHTDC4NOoG/ZxU3EvlMPQ=="],

    "is-buffer": ["is-buffer@1.1.5", "", {}, "sha512-miqftL8E53hH0dtQqLdN+3JwClyJiITcif3gy+RiUlnLJUhEwdyRC29/gpYbuC9IhazGSnP8TjbvxWw2AZylWQ=="],

    "is-extglob": ["is-extglob@2.1.1", "", {}, "sha512-SbKbANkN603Vi4jEZv49LeVJMn4yGwsbzZworEoyEiutsN3nJYdbO36zfhGJ6QEDpOZIFkDtnq5JRxmvl3jsoQ=="],

    "is-number": ["is-number@7.0.0", "", {}, "sha512-41Cifkg6e8TylSpdtTpeLVMqvSBEVzTttHvERD741+pnZ8ANv0004MRL43QKPDlK9cGvNp6NZWZUBlbGXYxxng=="],

    "is-odd": ["is-odd@1.0.0", "", { "dependencies": { "is-number": "^3.0.0" } }, "sha512-yIhxkKCK7pZnj48WBvaTQ36Or7PymGYqmZrSNqkrhmU3pakkp2TWhuN7hH25bqJgH+Xq4IZ3QNd3+QVshldEHA=="],

    "js-tokens": ["js-tokens@4.0.0", "", {}, "sha512-RdJUflcE3cUzKiMqQgsCu06FPu9UdIJO0beYbPhHN4k6apgJtifcoCtT9bcxOpYBtpD2kCM6Sbzg4CausW/PKQ=="],

    "kind-of": ["kind-of@6.0.3", "", {}, "sha512-dcS1ul+9tmeD95T+x28/ehLgd9mENa3LsvDTtzm3vyBEO7RPptvAD+t44WVXaUjTBRcrpFeFlC8WCruUR456hw=="],

    "left-pad": ["left-pad@1.3.0", "", {}, "sha512-XI5MPzVNApjAyhQzphX8BkmKsKUxD4LdyK24iZeQGinBN9yTQT3bFlCBy/aVx2HrNcqQGsdot8ghrjyrvMCoEA=="],

    "loose-envify": ["loose-envify@1.4.0", "", { "dependencies": { "js-tokens": "^3.0.0 || ^4.0.0" }, "bin": { "loose-envify": "cli.js" } }, "sha512-lyuxPGr/Wfhrlem2CL/UcnUc1zcqKAImBDzukY7Y5F/yQiNdko6+fRLevlw1HgMySw7f611UIY408EtxRSoK3Q=="],

    "lp": ["left-pad@1.3.0", "", {}, "sha512-XI5MPzVNApjAyhQzphX8BkmKsKUxD4LdyK24iZeQGinBN9yTQT3bFlCBy/aVx2HrNcqQGsdot8ghrjyrvMCoEA=="],

    "ms": ["ms@2.0.0", "", {}, "sha512-Tpp60P6IUJDTuOq/5Z8cdskzJujfwqfOTkrwIwj7IRISpnkJnT6SyJ4PCPnGMoFjC9ddhal5KVIYtAt97ix05A=="],

    "normalize-path": ["normalize-path@3.0.0", "", {}, "sha512-6eZs5Ls3WtCisHWp9S2GUy8dqkpGi4BVSz3GaqiE6ezub0512ESztXUwUB6C6IKbQkY2Pnb/mD4WYojCRwcwLA=="],

    "picomatch": ["picomatch@2.3.2", "", {}, "sha512-V7+vQEJ06Z+c5tSye8S+nHUfI51xoXIXjHQ99cQtKUkQqqO1kO/KCJUfZXuB47h/YBlDhah2H3hdUGXn8ie0oA=="],

    "react": ["react@18.3.1", "", { "dependencies": { "loose-envify": "^1.1.0" } }, "sha512-wS+hAgJShR0KhEvPJArfuPVN1+Hz1t0Y6n5jLrGQbkb4urgPE/0Rve+1kMB1v/oWgHgm4WIcV+i7F2pTVj+2iQ=="],

    "supports-color": ["supports-color@7.2.0", "", { "dependencies": { "has-flag": "^4.0.0" } }, "sha512-qpCAvRl9stuOHveKsn7HncJRvv501qIacKzQlO/+Lwxc9+0q2wLyv4Dfvt80/DPn2pqOBsJdDiogXGR9+OvwRw=="],

    "use-sync-external-store": ["use-sync-external-store@1.2.0", "", { "peerDependencies": { "react": "^16.8.0 || ^17.0.0 || ^18.0.0" } }, "sha512-eEgnFxGQ1Ife9bzYs6VLi8/4X6CObHMw9Qr9tPY43iKwsPw8xE8+EFsf/2cFZ5S3esXgpWgtSCtLNS41F+sKPA=="],

    "@demo/api/debug": ["debug@4.4.3", "", { "dependencies": { "ms": "^2.1.3" } }, "sha512-RGwwWnwQvkVfavKVt22FGLw+xYSdzARwm0ru6DhTVA3umU5hZc28V3kO4stgYryrTlLpuvgI9GiijltAjNbcqA=="],

    "@demo/util/ms": ["ms@2.1.3", "", {}, "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA=="],

    "is-odd/is-number": ["is-number@3.0.0", "", { "dependencies": { "kind-of": "^3.0.2" } }, "sha512-4cboCqIpliH+mAvFNegjZQ4kgKc3ZUhQVr3HvWbSh5q3WH2v82ct+T2Y1hdU5Gdtorx/cLifQjqCbL7bpznLTg=="],

    "@demo/api/debug/ms": ["ms@2.1.3", "", {}, "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA=="],

    "is-odd/is-number/kind-of": ["kind-of@3.2.2", "", { "dependencies": { "is-buffer": "^1.1.5" } }, "sha512-NOW9QQXMoZGg/oqnVNoNTTIFEIid1627WCffUBJEdMxYApq7mNE7CpzucIPc+ZQg25Phej7IJSmX3hO+oblOtQ=="],
  }
}
`;

export const libraryDependenciesPrunedBunLock = `{
  "lockfileVersion": 1,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "@demo/api",
      "dependencies": {
        "debug": "^4.3.0",
        "is-odd": "^1.0.0",
        "lp": "npm:left-pad@^1.3.0",
        "ms": "^2.1.0",
        "normalize-path": "^3.0.0",
        "picomatch": "^2.0.0",
        "use-sync-external-store": "1.2.0",
      },
      "optionalDependencies": {
        "fsevents": "^2.3.0",
      },
    },
  },
  "packages": {
    "debug": ["debug@4.4.3", "", { "dependencies": { "ms": "^2.1.3" } }, "sha512-RGwwWnwQvkVfavKVt22FGLw+xYSdzARwm0ru6DhTVA3umU5hZc28V3kO4stgYryrTlLpuvgI9GiijltAjNbcqA=="],

    "fsevents": ["fsevents@2.3.3", "", { "os": "darwin" }, "sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw=="],

    "is-buffer": ["is-buffer@1.1.5", "", {}, "sha512-miqftL8E53hH0dtQqLdN+3JwClyJiITcif3gy+RiUlnLJUhEwdyRC29/gpYbuC9IhazGSnP8TjbvxWw2AZylWQ=="],

    "is-number": ["is-number@3.0.0", "", { "dependencies": { "kind-of": "^3.0.2" } }, "sha512-4cboCqIpliH+mAvFNegjZQ4kgKc3ZUhQVr3HvWbSh5q3WH2v82ct+T2Y1hdU5Gdtorx/cLifQjqCbL7bpznLTg=="],

    "is-odd": ["is-odd@1.0.0", "", { "dependencies": { "is-number": "^3.0.0" } }, "sha512-yIhxkKCK7pZnj48WBvaTQ36Or7PymGYqmZrSNqkrhmU3pakkp2TWhuN7hH25bqJgH+Xq4IZ3QNd3+QVshldEHA=="],

    "js-tokens": ["js-tokens@4.0.0", "", {}, "sha512-RdJUflcE3cUzKiMqQgsCu06FPu9UdIJO0beYbPhHN4k6apgJtifcoCtT9bcxOpYBtpD2kCM6Sbzg4CausW/PKQ=="],

    "kind-of": ["kind-of@3.2.2", "", { "dependencies": { "is-buffer": "^1.1.5" } }, "sha512-NOW9QQXMoZGg/oqnVNoNTTIFEIid1627WCffUBJEdMxYApq7mNE7CpzucIPc+ZQg25Phej7IJSmX3hO+oblOtQ=="],

    "loose-envify": ["loose-envify@1.4.0", "", { "dependencies": { "js-tokens": "^3.0.0 || ^4.0.0" }, "bin": { "loose-envify": "cli.js" } }, "sha512-lyuxPGr/Wfhrlem2CL/UcnUc1zcqKAImBDzukY7Y5F/yQiNdko6+fRLevlw1HgMySw7f611UIY408EtxRSoK3Q=="],

    "lp": ["left-pad@1.3.0", "", {}, "sha512-XI5MPzVNApjAyhQzphX8BkmKsKUxD4LdyK24iZeQGinBN9yTQT3bFlCBy/aVx2HrNcqQGsdot8ghrjyrvMCoEA=="],

    "ms": ["ms@2.1.3", "", {}, "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA=="],

    "normalize-path": ["normalize-path@3.0.0", "", {}, "sha512-6eZs5Ls3WtCisHWp9S2GUy8dqkpGi4BVSz3GaqiE6ezub0512ESztXUwUB6C6IKbQkY2Pnb/mD4WYojCRwcwLA=="],

    "picomatch": ["picomatch@2.3.2", "", {}, "sha512-V7+vQEJ06Z+c5tSye8S+nHUfI51xoXIXjHQ99cQtKUkQqqO1kO/KCJUfZXuB47h/YBlDhah2H3hdUGXn8ie0oA=="],

    "react": ["react@18.3.1", "", { "dependencies": { "loose-envify": "^1.1.0" } }, "sha512-wS+hAgJShR0KhEvPJArfuPVN1+Hz1t0Y6n5jLrGQbkb4urgPE/0Rve+1kMB1v/oWgHgm4WIcV+i7F2pTVj+2iQ=="],

    "use-sync-external-store": ["use-sync-external-store@1.2.0", "", { "peerDependencies": { "react": "^16.8.0 || ^17.0.0 || ^18.0.0" } }, "sha512-eEgnFxGQ1Ife9bzYs6VLi8/4X6CObHMw9Qr9tPY43iKwsPw8xE8+EFsf/2cFZ5S3esXgpWgtSCtLNS41F+sKPA=="],
  }
}
`;

export const libraryOptionalPeerPrunedBunLock = `{
  "lockfileVersion": 1,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "@demo/api",
      "peerDependencies": {
        "is-odd": "^1.0.0",
      },
      "optionalPeers": [
        "is-odd",
      ],
    },
  },
  "packages": {}
}
`;
