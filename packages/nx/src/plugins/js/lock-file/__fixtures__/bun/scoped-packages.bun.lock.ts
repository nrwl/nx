export const scopedPackagesBunLock = `{
  "lockfileVersion": 1,
  "workspaces": {
    "": {
      "name": "scoped-packages-test",
      "dependencies": {
        "@humanwhocodes/config-array": "^0.11.0",
        "@sindresorhus/is": "^4.0.0",
        "@types/node": "^20.0.0",
      },
    },
  },
  "packages": {
    "@humanwhocodes/config-array": ["@humanwhocodes/config-array@0.11.14", "", { "dependencies": { "@humanwhocodes/object-schema": "^2.0.2", "debug": "^4.3.1", "minimatch": "^3.0.5" } }, "sha512-3T8LkOmg45BV5FICb15QQMsyUSWrQ8AygVfC7ZG32zOalnqrilm018ZVCw0eapXux8FtA33q8PSRSstjee3jSg=="],

    "@humanwhocodes/object-schema": ["@humanwhocodes/object-schema@2.0.3", "", {}, "sha512-93zYdMES/c1D69yZiKDBj0V24vqNzB/koF26KPaagAfd3P/4gUlh3Dys5ogAK+Exi9QyzlD8x/08Zt7wIKcDcA=="],

    "@sindresorhus/is": ["@sindresorhus/is@4.6.0", "", {}, "sha512-t09vSN3MdfsyCHoFcTRCH/iUtG7OJ0CsjzB8cjAmKc/va/kIgeDI/TxsigdncE/4be734m0cvIYwNaV4i2XqAw=="],

    "@types/node": ["@types/node@20.19.8", "", { "dependencies": { "undici-types": "~6.21.0" } }, "sha512-HzbgCY53T6bfu4tT7Aq3TvViJyHjLjPNaAS3HOuMc9pw97KHsUtXNX4L+wu59g1WnjsZSko35MbEqnO58rihhw=="],

    "balanced-match": ["balanced-match@1.0.2", "", {}, "sha512-3oSeUO0TMV67hN1AmbXsK4yaqU7tjiHlbxRDZOpH0KW9+CeX4bRAaX0Anxt0tx2MrpRpWwQaPwIlISEJhYU5Pw=="],

    "brace-expansion": ["brace-expansion@1.1.12", "", { "dependencies": { "balanced-match": "^1.0.0", "concat-map": "0.0.1" } }, "sha512-9T9UjW3r0UW5c1Q7GTwllptXwhvYmEzFhzMfZ9H7FQWt+uZePjZPjBP/W1ZEyZ1twGWom5/56TF4lPcqjnDHcg=="],

    "concat-map": ["concat-map@0.0.1", "", {}, "sha512-/Srv4dswyQNBfohGpz9o6Yb3Gz3SrUDqBH5rTuhGR7ahtlbYKnVxw2bCFMRljaA7EXHaXZ8wsHdodFvbkhKmqg=="],

    "debug": ["debug@4.4.1", "", { "dependencies": { "ms": "^2.1.3" } }, "sha512-KcKCqiftBJcZr++7ykoDIEwSa3XWowTfNPo92BYxjXiyYEVrUQh2aLyhxBCwww+heortUFxEJYcRzosstTEBYQ=="],

    "minimatch": ["minimatch@3.1.2", "", { "dependencies": { "brace-expansion": "^1.1.7" } }, "sha512-J7p63hRiAjw1NDEww1W7i37+ByIrOWO5XQQAzZ3VOcL0PNybwpfmV/N05zFAzwQ9USyEcX6t3UO+K5aqBQOIHw=="],

    "ms": ["ms@2.1.3", "", {}, "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA=="],

    "undici-types": ["undici-types@6.21.0", "", {}, "sha512-iwDZqg0QAGrg9Rav5H4n0M64c3mkR59cJ6wQp+7C4nI0gsmExaedaYLNO44eT4AtBBwjbTiGPMlt2Md0T9H9JQ=="],
  }
}`;
