export const tarballDependenciesLockFile = `{
  "lockfileVersion": 1,
  "workspaces": {
    "": {
      "name": "tarball-dependencies-test",
      "dependencies": {
        "chalk": "https://registry.npmjs.org/chalk/-/chalk-4.1.2.tgz",
        "is-even": "https://registry.npmjs.org/is-even/-/is-even-1.0.0.tgz",
        "lodash": "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz",
      },
      "devDependencies": {
        "rimraf": "https://registry.npmjs.org/rimraf/-/rimraf-3.0.2.tgz",
      },
    },
  },
  "packages": {
    "ansi-styles": ["ansi-styles@4.3.0", "", { "dependencies": { "color-convert": "^2.0.1" } }, "sha512-zbB9rCJAT1rbjiVDb2hqKFHNYLxgtk8NURxZ3IZwD3F6NtxbXZQCnnSi1Lkx+IDohdPlFp222wVALIheZJQSEg=="],

    "balanced-match": ["balanced-match@1.0.2", "", {}, "sha512-3oSeUO0TMV67hN1AmbXsK4yaqU7tjiHlbxRDZOpH0KW9+CeX4bRAaX0Anxt0tx2MrpRpWwQaPwIlISEJhYU5Pw=="],

    "brace-expansion": ["brace-expansion@1.1.12", "", { "dependencies": { "balanced-match": "^1.0.0", "concat-map": "0.0.1" } }, "sha512-9T9UjW3r0UW5c1Q7GTwllptXwhvYmEzFhzMfZ9H7FQWt+uZePjZPjBP/W1ZEyZ1twGWom5/56TF4lPcqjnDHcg=="],

    "chalk": ["chalk@https://registry.npmjs.org/chalk/-/chalk-4.1.2.tgz", { "dependencies": { "ansi-styles": "^4.1.0", "supports-color": "^7.1.0" } }],

    "color-convert": ["color-convert@2.0.1", "", { "dependencies": { "color-name": "~1.1.4" } }, "sha512-RRECPsj7iu/xb5oKYcsFHSppFNnsj/52OVTRKb4zP5onXwVF3zVmmToNcOfGC+CRDpfK/U584fMg38ZHCaElKQ=="],

    "color-name": ["color-name@1.1.4", "", {}, "sha512-dOy+3AuW3a2wNbZHIuMZpTcgjGuLU/uBL/ubcZF9OXbDo8ff4O8yVp5Bf0efS8uEoYo5q4Fx7dY9OgQGXgAsQA=="],

    "concat-map": ["concat-map@0.0.1", "", {}, "sha512-/Srv4dswyQNBfohGpz9o6Yb3Gz3SrUDqBH5rTuhGR7ahtlbYKnVxw2bCFMRljaA7EXHaXZ8wsHdodFvbkhKmqg=="],

    "fs.realpath": ["fs.realpath@1.0.0", "", {}, "sha512-OO0pH2lK6a0hZnAdau5ItzHPI6pUlvI7jMVnxUQRtw4owF2wk8lOSabtGDCTP4Ggrg2MbGnWO9X8K1t4+fGMDw=="],

    "glob": ["glob@7.2.3", "", { "dependencies": { "fs.realpath": "^1.0.0", "inflight": "^1.0.4", "inherits": "2", "minimatch": "^3.1.1", "once": "^1.3.0", "path-is-absolute": "^1.0.0" } }, "sha512-nFR0zLpU2YCaRxwoCJvL6UvCH2JFyFVIvwTLsIf21AuHlMskA1hhTdk+LlYJtOlYt9v6dvszD2BGRqBL+iQK9Q=="],

    "has-flag": ["has-flag@4.0.0", "", {}, "sha512-EykJT/Q1KjTWctppgIAgfSO0tKVuZUjhgMr17kqTumMl6Afv3EISleU7qZUzoXDFTAHTDC4NOoG/ZxU3EvlMPQ=="],

    "inflight": ["inflight@1.0.6", "", { "dependencies": { "once": "^1.3.0", "wrappy": "1" } }, "sha512-k92I/b08q4wvFscXCLvqfsHCrjrF7yiXsQuIVvVE7N82W3+aqpzuUdBbfhWcy/FZR3/4IgflMgKLOsvPDrGCJA=="],

    "inherits": ["inherits@2.0.4", "", {}, "sha512-k/vGaX4/Yla3WzyMCvTQOXYeIHvqOKtnqBduzTHpzpQZzAskKMhZ2K+EnBiSM9zGSoIFeMpXKxa4dYeZIQqewQ=="],

    "is-buffer": ["is-buffer@1.1.6", "", {}, "sha512-NcdALwpXkTm5Zvvbk7owOUSvVvBKDgKP5/ewfXEznmQFfs4ZRmanOeKBTjRVjka3QFoN6XJ+9F3USqfHqTaU5w=="],

    "is-even": ["is-even@https://registry.npmjs.org/is-even/-/is-even-1.0.0.tgz", { "dependencies": { "is-odd": "^0.1.2" } }],

    "is-number": ["is-number@3.0.0", "", { "dependencies": { "kind-of": "^3.0.2" } }, "sha512-4cboCqIpliH+mAvFNegjZQ4kgKc3ZUhQVr3HvWbSh5q3WH2v82ct+T2Y1hdU5Gdtorx/cLifQjqCbL7bpznLTg=="],

    "is-odd": ["is-odd@0.1.2", "", { "dependencies": { "is-number": "^3.0.0" } }, "sha512-Ri7C2K7o5IrUU9UEI8losXJCCD/UtsaIrkR5sxIcFg4xQ9cRJXlWA5DQvTE0yDc0krvSNLsRGXN11UPS6KyfBw=="],

    "kind-of": ["kind-of@3.2.2", "", { "dependencies": { "is-buffer": "^1.1.5" } }, "sha512-NOW9QQXMoZGg/oqnVNoNTTIFEIid1627WCffUBJEdMxYApq7mNE7CpzucIPc+ZQg25Phej7IJSmX3hO+oblOtQ=="],

    "lodash": ["lodash@https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz", {}],

    "minimatch": ["minimatch@3.1.2", "", { "dependencies": { "brace-expansion": "^1.1.7" } }, "sha512-J7p63hRiAjw1NDEww1W7i37+ByIrOWO5XQQAzZ3VOcL0PNybwpfmV/N05zFAzwQ9USyEcX6t3UO+K5aqBQOIHw=="],

    "once": ["once@1.4.0", "", { "dependencies": { "wrappy": "1" } }, "sha512-lNaJgI+2Q5URQBkccEKHTQOPaXdUxnZZElQTZY0MFUAuaEqe1E+Nyvgdz/aIyNi6Z9MzO5dv1H8n58/GELp3+w=="],

    "path-is-absolute": ["path-is-absolute@1.0.1", "", {}, "sha512-AVbw3UJ2e9bq64vSaS9Am0fje1Pa8pbGqTTsmXfaIiMpnr5DlDhfJOuLj9Sf95ZPVDAUerDfEk88MPmPe7UCQg=="],

    "rimraf": ["rimraf@https://registry.npmjs.org/rimraf/-/rimraf-3.0.2.tgz", { "dependencies": { "glob": "^7.1.3" }, "bin": "./bin.js" }],

    "supports-color": ["supports-color@7.2.0", "", { "dependencies": { "has-flag": "^4.0.0" } }, "sha512-qpCAvRl9stuOHveKsn7HncJRvv501qIacKzQlO/+Lwxc9+0q2wLyv4Dfvt80/DPn2pqOBsJdDiogXGR9+OvwRw=="],

    "wrappy": ["wrappy@1.0.2", "", {}, "sha512-l4Sp/DRseor9wL6EvV2+TuQn63dMkPjZ/sp9XkghTEbV9KlPS1xUsZ3u7/IQO4wxtcFB4bgpQPRcR3QCvezPcQ=="],
  }
}`;