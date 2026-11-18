export const bundledDependenciesRootBunLock = `{
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
        "fsevents": "1.2.4",
        "ms": "^2.1.0",
      },
    },
    "apps/other": {
      "name": "@demo/other",
      "version": "0.0.1",
      "dependencies": {
        "is-odd": "^1.0.0",
      },
    },
  },
  "packages": {
    "@demo/api": ["@demo/api@workspace:apps/api"],

    "@demo/other": ["@demo/other@workspace:apps/other"],

    "fsevents": ["fsevents@1.2.4", "", { "dependencies": { "nan": "^2.9.2", "node-pre-gyp": "^0.10.0" }, "os": "darwin", "hasInstallScript": true }, "sha512-z8H8/diyk76B7q5wg+Ud0+CqzcAF3mBBI/bA5ne5zrRUUIvNkJY//D3BqyH571KuAC4Nr7Rw7CjWX4r0y9DvNg=="],

    "is-buffer": ["is-buffer@1.1.6", "", {}, "sha512-NcdALwpXkTm5Zvvbk7owOUSvVvBKDgKP5/ewfXEznmQFfs4ZRmanOeKBTjRVjka3QFoN6XJ+9F3USqfHqTaU5w=="],

    "is-number": ["is-number@3.0.0", "", { "dependencies": { "kind-of": "^3.0.2" } }, "sha512-4cboCqIpliH+mAvFNegjZQ4kgKc3ZUhQVr3HvWbSh5q3WH2v82ct+T2Y1hdU5Gdtorx/cLifQjqCbL7bpznLTg=="],

    "is-odd": ["is-odd@1.0.0", "", { "dependencies": { "is-number": "^3.0.0" } }, "sha512-yIhxkKCK7pZnj48WBvaTQ36Or7PymGYqmZrSNqkrhmU3pakkp2TWhuN7hH25bqJgH+Xq4IZ3QNd3+QVshldEHA=="],

    "kind-of": ["kind-of@3.2.2", "", { "dependencies": { "is-buffer": "^1.1.5" } }, "sha512-NOW9QQXMoZGg/oqnVNoNTTIFEIid1627WCffUBJEdMxYApq7mNE7CpzucIPc+ZQg25Phej7IJSmX3hO+oblOtQ=="],

    "ms": ["ms@2.1.3", "", {}, "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA=="],

    "nan": ["nan@2.30.0", "", {}, "sha512-P5mokDkSvCGBz6mZDD/2l+w9QoICRXdCyZ9ONGmTePr40oihJg3Kpn0YU3twKd6PJnwSlLBWNQeOT6yWEV2c4A=="],

    "fsevents/abbrev": ["abbrev@1.1.1", "", {}, "sha512-nne9/IiQ/hzIhY6pdDnbBtz7DjPTKrY00P/zvPSm5pOFkl6xuGrGnXn/VtTNNfNtAfZ9/1RtehkszU9qcTii0Q=="],

    "fsevents/ansi-regex": ["ansi-regex@2.1.1", "", {}, "sha512-TIGnTpdo+E3+pCyAluZvtED5p5wCqLdezCyhPZzKPcxvFplEt4i+W7OONCKgeZFT3+y5NZZfOOS/Bdcanm1MYA=="],

    "fsevents/aproba": ["aproba@1.2.0", "", {}, "sha512-Y9J6ZjXtoYh8RnXVCMOU/ttDmk1aBjunq9vO0ta5x85WDQiQfUF9sIPBITdbiiIVcBo03Hi3jMxigBtsddlXRw=="],

    "fsevents/are-we-there-yet": ["are-we-there-yet@1.1.7", "", { "dependencies": { "delegates": "^1.0.0", "readable-stream": "^2.0.6" } }, "sha512-nxwy40TuMiUGqMyRHgCSWZ9FM4VAoRP4xUYSTv5ImRog+h9yISPbVH7H8fASCIzYn9wlEv4zvFL7uKDMCFQm3g=="],

    "fsevents/balanced-match": ["balanced-match@1.0.2", "", {}, "sha512-3oSeUO0TMV67hN1AmbXsK4yaqU7tjiHlbxRDZOpH0KW9+CeX4bRAaX0Anxt0tx2MrpRpWwQaPwIlISEJhYU5Pw=="],

    "fsevents/brace-expansion": ["brace-expansion@1.1.21", "", { "dependencies": { "balanced-match": "^1.0.0", "concat-map": "0.0.1" } }, "sha512-9zeA+KLZNNzglF2TPKRQEDyx6Yby7daAkuy8MiPzpXPsYDWi/DRM8jmwUDxokQjYqBpv5DgPiwD4h4ZZSy1Ujw=="],

    "fsevents/chownr": ["chownr@1.1.4", "", {}, "sha512-jJ0bqzaylmJtVnNgzTeSOs8DPavpbYgEr/b0YL8/2GO3xJEhInFmhKMUnEJQjZumK7KXGFhUy89PrsJWlakBVg=="],

    "fsevents/code-point-at": ["code-point-at@1.1.0", "", {}, "sha512-RpAVKQA5T63xEj6/giIbUEtZwJ4UFIc3ZtvEkiaUERylqe8xb5IvqcgOurZLahv93CLKfxcw5YI+DZcUBRyLXA=="],

    "fsevents/concat-map": ["concat-map@0.0.1", "", {}, "sha512-/Srv4dswyQNBfohGpz9o6Yb3Gz3SrUDqBH5rTuhGR7ahtlbYKnVxw2bCFMRljaA7EXHaXZ8wsHdodFvbkhKmqg=="],

    "fsevents/console-control-strings": ["console-control-strings@1.1.0", "", {}, "sha512-ty/fTekppD2fIwRvnZAVdeOiGd1c7YXEixbgJTNzqcxJWKQnjJ/V1bNEEE6hygpM3WjwHFUVK6HTjWSzV4a8sQ=="],

    "fsevents/core-util-is": ["core-util-is@1.0.3", "", {}, "sha512-ZQBvi1DcpJ4GDqanjucZ2Hj3wEO5pZDS89BWbkcrvdxksJorwUDDZamX9ldFkp9aw2lmBDLgkObEA4DWNJ9FYQ=="],

    "fsevents/debug": ["debug@3.2.7", "", { "dependencies": { "ms": "^2.1.1" } }, "sha512-CFjzYYAi4ThfiQvizrFQevTTXHtnCqWfe7x1AhgEscTz6ZbLbfoLRLPugTQyBth6f8ZERVUSyWHFD/7Wu4t1XQ=="],

    "fsevents/deep-extend": ["deep-extend@0.6.0", "", {}, "sha512-LOHxIOaPYdHlJRtCQfDIVZtfw/ufM8+rVj649RIHzcm/vGwQRXFt6OPqIFWsm2XEMrNIEtWR64sY1LEKD2vAOA=="],

    "fsevents/delegates": ["delegates@1.0.0", "", {}, "sha512-bd2L678uiWATM6m5Z1VzNCErI3jiGzt6HGY8OVICs40JQq/HALfbyNJmp0UDakEY4pMMaN0Ly5om/B1VI/+xfQ=="],

    "fsevents/detect-libc": ["detect-libc@1.0.3", "", { "bin": { "detect-libc": "./bin/detect-libc.js" } }, "sha512-pGjwhsmsp4kL2RTz08wcOlGN83otlqHeD/Z5T8GXZB+/YcpQ/dgo+lbU8ZsGxV0HIvqqxo9l7mqYwyYMD9bKDg=="],

    "fsevents/emoji-regex": ["emoji-regex@8.0.0", "", {}, "sha512-MSjYzcWNOA0ewAHpz0MxpYFvwg6yjy1NG3xteoqz644VCo/RPgnr1/GGt+ic3iJTzQ8Eu3TdM14SawnVUmGE6A=="],

    "fsevents/fs-minipass": ["fs-minipass@1.2.7", "", { "dependencies": { "minipass": "^2.6.0" } }, "sha512-GWSSJGFy4e9GUeCcbIkED+bgAoFyj7XF1mV8rma3QW4NIqX9Kyx79N/PF61H5udOV3aY1IaMLs6pGbH71nlCTA=="],

    "fsevents/fs.realpath": ["fs.realpath@1.0.0", "", {}, "sha512-OO0pH2lK6a0hZnAdau5ItzHPI6pUlvI7jMVnxUQRtw4owF2wk8lOSabtGDCTP4Ggrg2MbGnWO9X8K1t4+fGMDw=="],

    "fsevents/gauge": ["gauge@2.7.4", "", { "dependencies": { "aproba": "^1.0.3", "console-control-strings": "^1.0.0", "has-unicode": "^2.0.0", "object-assign": "^4.1.0", "signal-exit": "^3.0.0", "string-width": "^1.0.1", "strip-ansi": "^3.0.1", "wide-align": "^1.1.0" } }, "sha512-14x4kjc6lkD3ltw589k0NrPD6cCNTD6CWoVUNpB85+DrtONoZn+Rug6xZU5RvSC4+TZPxA5AnBibQYAvZn41Hg=="],

    "fsevents/glob": ["glob@7.2.3", "", { "dependencies": { "fs.realpath": "^1.0.0", "inflight": "^1.0.4", "inherits": "2", "minimatch": "^3.1.1", "once": "^1.3.0", "path-is-absolute": "^1.0.0" } }, "sha512-nFR0zLpU2YCaRxwoCJvL6UvCH2JFyFVIvwTLsIf21AuHlMskA1hhTdk+LlYJtOlYt9v6dvszD2BGRqBL+iQK9Q=="],

    "fsevents/has-unicode": ["has-unicode@2.0.1", "", {}, "sha512-8Rf9Y83NBReMnx0gFzA8JImQACstCYWUplepDa9xprwwtmgEZUF0h/i5xSA625zB/I37EtrswSST6OXxwaaIJQ=="],

    "fsevents/iconv-lite": ["iconv-lite@0.4.24", "", { "dependencies": { "safer-buffer": ">= 2.1.2 < 3" } }, "sha512-v3MXnZAcvnywkTUEZomIActle7RXXeedOR31wwl7VlyoXO4Qi9arvSenNQWne1TcRwhCL1HwLI21bEqdpj8/rA=="],

    "fsevents/ignore-walk": ["ignore-walk@3.0.4", "", { "dependencies": { "minimatch": "^3.0.4" } }, "sha512-PY6Ii8o1jMRA1z4F2hRkH/xN59ox43DavKvD3oDpfurRlOJyAHpifIwpbdv1n4jt4ov0jSpw3kQ4GhJnpBL6WQ=="],

    "fsevents/inflight": ["inflight@1.0.6", "", { "dependencies": { "once": "^1.3.0", "wrappy": "1" } }, "sha512-k92I/b08q4wvFscXCLvqfsHCrjrF7yiXsQuIVvVE7N82W3+aqpzuUdBbfhWcy/FZR3/4IgflMgKLOsvPDrGCJA=="],

    "fsevents/inherits": ["inherits@2.0.4", "", {}, "sha512-k/vGaX4/Yla3WzyMCvTQOXYeIHvqOKtnqBduzTHpzpQZzAskKMhZ2K+EnBiSM9zGSoIFeMpXKxa4dYeZIQqewQ=="],

    "fsevents/ini": ["ini@1.3.8", "", {}, "sha512-JV/yugV2uzW5iMRSiZAyDtQd+nxtUnjeLt0acNdw98kKLrvuRVyB80tsREOE7yvGVgalhZ6RNXCmEHkUKBKxew=="],

    "fsevents/is-fullwidth-code-point": ["is-fullwidth-code-point@1.0.0", "", { "dependencies": { "number-is-nan": "^1.0.0" } }, "sha512-1pqUqRjkhPJ9miNq9SwMfdvi6lBJcd6eFxvfaivQhaH3SgisfiuudvFntdKOmxuee/77l+FPjKrQjWvmPjWrRw=="],

    "fsevents/isarray": ["isarray@1.0.0", "", {}, "sha512-VLghIWNM6ELQzo7zwmcg0NmTVyWKYjvIeM83yjp0wRDTmUnrM678fQbcKBo6n2CJEF0szoG//ytg+TKla89ALQ=="],

    "fsevents/minimatch": ["minimatch@3.1.5", "", { "dependencies": { "brace-expansion": "^1.1.7" } }, "sha512-VgjWUsnnT6n+NUk6eZq77zeFdpW2LWDzP6zFGrCbHXiYNul5Dzqk2HHQ5uFH2DNW5Xbp8+jVzaeNt94ssEEl4w=="],

    "fsevents/minimist": ["minimist@1.2.8", "", {}, "sha512-2yyAR8qBkN3YuheJanUpWC5U3bb5osDywNB8RzDVlDwDHbocAJveqqj1u8+SVD7jkWT4yvsHCpWqqWqAxb0zCA=="],

    "fsevents/minipass": ["minipass@2.9.0", "", { "dependencies": { "safe-buffer": "^5.1.2", "yallist": "^3.0.0" } }, "sha512-wxfUjg9WebH+CUDX/CdbRlh5SmfZiy/hpkxaRI16Y9W56Pa75sWgd/rvFilSgrauD9NyFymP/+JFV3KwzIsJeg=="],

    "fsevents/minizlib": ["minizlib@1.3.3", "", { "dependencies": { "minipass": "^2.9.0" } }, "sha512-6ZYMOEnmVsdCeTJVE0W9ZD+pVnE8h9Hma/iOwwRDsdQoePpoX56/8B6z3P9VNwppJuBKNRuFDRNRqRWexT9G9Q=="],

    "fsevents/mkdirp": ["mkdirp@0.5.6", "", { "dependencies": { "minimist": "^1.2.6" }, "bin": { "mkdirp": "bin/cmd.js" } }, "sha512-FP+p8RB8OWpF3YZBCrP5gtADmtXApB5AMLn+vdyA+PyxCjrCs00mjyUozssO33cwDeT3wNGdLxJ5M//YqtHAJw=="],

    "fsevents/ms": ["ms@2.1.3", "", {}, "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA=="],

    "fsevents/needle": ["needle@2.9.1", "", { "dependencies": { "debug": "^3.2.6", "iconv-lite": "^0.4.4", "sax": "^1.2.4" }, "bin": { "needle": "./bin/needle" } }, "sha512-6R9fqJ5Zcmf+uYaFgdIHmLwNldn5HbK8L5ybn7Uz+ylX/rnOsSp1AHcvQSrCaFN+qNM1wpymHqD7mVasEOlHGQ=="],

    "fsevents/node-pre-gyp": ["node-pre-gyp@0.10.3", "", { "dependencies": { "detect-libc": "^1.0.2", "mkdirp": "^0.5.1", "needle": "^2.2.1", "nopt": "^4.0.1", "npm-packlist": "^1.1.6", "npmlog": "^4.0.2", "rc": "^1.2.7", "rimraf": "^2.6.1", "semver": "^5.3.0", "tar": "^4" }, "bundled": true, "bin": { "node-pre-gyp": "./bin/node-pre-gyp" } }, "sha512-d1xFs+C/IPS8Id0qPTZ4bUT8wWryfR/OzzAFxweG+uLN85oPzyo2Iw6bVlLQ/JOdgNonXLCoRyqDzDWq4iw72A=="],

    "fsevents/nopt": ["nopt@4.0.3", "", { "dependencies": { "abbrev": "1", "osenv": "^0.1.4" }, "bin": { "nopt": "bin/nopt.js" } }, "sha512-CvaGwVMztSMJLOeXPrez7fyfObdZqNUK1cPAEzLHrTybIua9pMdmmPR5YwtfNftIOMv3DPUhFaxsZMNTQO20Kg=="],

    "fsevents/npm-bundled": ["npm-bundled@1.1.2", "", { "dependencies": { "npm-normalize-package-bin": "^1.0.1" } }, "sha512-x5DHup0SuyQcmL3s7Rx/YQ8sbw/Hzg0rj48eN0dV7hf5cmQq5PXIeioroH3raV1QC1yh3uTYuMThvEQF3iKgGQ=="],

    "fsevents/npm-normalize-package-bin": ["npm-normalize-package-bin@1.0.1", "", {}, "sha512-EPfafl6JL5/rU+ot6P3gRSCpPDW5VmIzX959Ob1+ySFUuuYHWHekXpwdUZcKP5C+DS4GEtdJluwBjnsNDl+fSA=="],

    "fsevents/npm-packlist": ["npm-packlist@1.4.8", "", { "dependencies": { "ignore-walk": "^3.0.1", "npm-bundled": "^1.0.1", "npm-normalize-package-bin": "^1.0.1" } }, "sha512-5+AZgwru5IevF5ZdnFglB5wNlHG1AOOuw28WhUq8/8emhBmLv6jX5by4WJCh7lW0uSYZYS6DXqIsyZVIXRZU9A=="],

    "fsevents/npmlog": ["npmlog@4.1.2", "", { "dependencies": { "are-we-there-yet": "~1.1.2", "console-control-strings": "~1.1.0", "gauge": "~2.7.3", "set-blocking": "~2.0.0" } }, "sha512-2uUqazuKlTaSI/dC8AzicUck7+IrEaOnN/e0jd3Xtt1KcGpwx30v50mL7oPyr/h9bL3E4aZccVwpwP+5W9Vjkg=="],

    "fsevents/number-is-nan": ["number-is-nan@1.0.1", "", {}, "sha512-4jbtZXNAsfZbAHiiqjLPBiCl16dES1zI4Hpzzxw61Tk+loF+sBDBKx1ICKKKwIqQ7M0mFn1TmkN7euSncWgHiQ=="],

    "fsevents/object-assign": ["object-assign@4.1.1", "", {}, "sha512-rJgTQnkUnH1sFw8yT6VSU3zD3sWmu6sZhIseY8VX+GRu3P6F7Fu+JNDoXfklElbLJSnc3FUQHVe4cU5hj+BcUg=="],

    "fsevents/once": ["once@1.4.0", "", { "dependencies": { "wrappy": "1" } }, "sha512-lNaJgI+2Q5URQBkccEKHTQOPaXdUxnZZElQTZY0MFUAuaEqe1E+Nyvgdz/aIyNi6Z9MzO5dv1H8n58/GELp3+w=="],

    "fsevents/os-homedir": ["os-homedir@1.0.2", "", {}, "sha512-B5JU3cabzk8c67mRRd3ECmROafjYMXbuzlwtqdM8IbS8ktlTix8aFGb2bAGKrSRIlnfKwovGUUr72JUPyOb6kQ=="],

    "fsevents/os-tmpdir": ["os-tmpdir@1.0.2", "", {}, "sha512-D2FR03Vir7FIu45XBY20mTb+/ZSWB00sjU9jdQXt83gDrI4Ztz5Fs7/yy74g2N5SVQY4xY1qDr4rNddwYRVX0g=="],

    "fsevents/osenv": ["osenv@0.1.5", "", { "dependencies": { "os-homedir": "^1.0.0", "os-tmpdir": "^1.0.0" } }, "sha512-0CWcCECdMVc2Rw3U5w9ZjqX6ga6ubk1xDVKxtBQPK7wis/0F2r9T6k4ydGYhecl7YUBxBVxhL5oisPsNxAPe2g=="],

    "fsevents/path-is-absolute": ["path-is-absolute@1.0.1", "", {}, "sha512-AVbw3UJ2e9bq64vSaS9Am0fje1Pa8pbGqTTsmXfaIiMpnr5DlDhfJOuLj9Sf95ZPVDAUerDfEk88MPmPe7UCQg=="],

    "fsevents/process-nextick-args": ["process-nextick-args@2.0.1", "", {}, "sha512-3ouUOpQhtgrbOa17J7+uxOTpITYWaGP7/AhoR3+A+/1e9skrzelGi/dXzEYyvbxubEF6Wn2ypscTKiKJFFn1ag=="],

    "fsevents/rc": ["rc@1.2.8", "", { "dependencies": { "deep-extend": "^0.6.0", "ini": "~1.3.0", "minimist": "^1.2.0", "strip-json-comments": "~2.0.1" }, "bin": { "rc": "./cli.js" } }, "sha512-y3bGgqKj3QBdxLbLkomlohkvsA8gdAiUQlSBJnBhfn+BPxg4bc62d8TcBW15wavDfgexCgccckhcZvywyQYPOw=="],

    "fsevents/readable-stream": ["readable-stream@2.3.8", "", { "dependencies": { "core-util-is": "~1.0.0", "inherits": "~2.0.3", "isarray": "~1.0.0", "process-nextick-args": "~2.0.0", "safe-buffer": "~5.1.1", "string_decoder": "~1.1.1", "util-deprecate": "~1.0.1" } }, "sha512-8p0AUk4XODgIewSi0l8Epjs+EVnWiK7NoDIEGU0HhE7+ZyY8D1IMY7odu5lRrFXGg71L15KG8QrPmum45RTtdA=="],

    "fsevents/rimraf": ["rimraf@2.7.1", "", { "dependencies": { "glob": "^7.1.3" }, "bin": { "rimraf": "./bin.js" } }, "sha512-uWjbaKIK3T1OSVptzX7Nl6PvQ3qAGtKEtVRjRuazjfL3Bx5eI409VZSqgND+4UNnmzLVdPj9FqFJNPqBZFve4w=="],

    "fsevents/safe-buffer": ["safe-buffer@5.2.1", "", {}, "sha512-rp3So07KcdmmKbGvgaNxQSJr7bGVSVk5S9Eq1F+ppbRo70+YeaDxkw5Dd8NPN+GD6bjnYm2VuPuCXmpuYvmCXQ=="],

    "fsevents/safer-buffer": ["safer-buffer@2.1.2", "", {}, "sha512-YZo3K82SD7Riyi0E1EQPojLz7kpepnSQI9IyPbHHg1XXXevb5dJI7tpyN2ADxGcQbHG7vcyRHk0cbwqcQriUtg=="],

    "fsevents/sax": ["sax@1.6.1", "", {}, "sha512-42tBVwLWnaQvW5zc4HbZrTuWccECCZfBi92FDuwtqxasH+JbPB3/FOKb1m222K42R4WxuxzzMsTswfzgtSu64Q=="],

    "fsevents/semver": ["semver@5.7.2", "", { "bin": { "semver": "bin/semver" } }, "sha512-cBznnQ9KjJqU67B52RMC65CMarK2600WFnbkcaiwWq3xy/5haFJlshgnpjovMVJ+Hff49d8GEn0b87C5pDQ10g=="],

    "fsevents/set-blocking": ["set-blocking@2.0.0", "", {}, "sha512-KiKBS8AnWGEyLzofFfmvKwpdPzqiy16LvQfK3yv/fVH7Bj13/wl3JSR1J+rfgRE9q7xUJK4qvgS8raSOeLUehw=="],

    "fsevents/signal-exit": ["signal-exit@3.0.7", "", {}, "sha512-wnD2ZE+l+SPC/uoS0vXeE9L1+0wuaMqKlfz9AMUo38JsyLSBWSFcHR1Rri62LZc12vLr1gb3jl7iwQhgwpAbGQ=="],

    "fsevents/string-width": ["string-width@1.0.2", "", { "dependencies": { "code-point-at": "^1.0.0", "is-fullwidth-code-point": "^1.0.0", "strip-ansi": "^3.0.0" } }, "sha512-0XsVpQLnVCXHJfyEs8tC0zpTVIr5PKKsQtkT29IwupnPTjtPmQ3xT/4yCREF9hYkV/3M3kzcUTSAZT6a6h81tw=="],

    "fsevents/string_decoder": ["string_decoder@1.1.1", "", { "dependencies": { "safe-buffer": "~5.1.0" } }, "sha512-n/ShnvDi6FHbbVfviro+WojiFzv+s8MPMHBczVePfUpDJLwoLT0ht1l4YwBCbi8pJAveEEdnkHyPyTP/mzRfwg=="],

    "fsevents/strip-ansi": ["strip-ansi@3.0.1", "", { "dependencies": { "ansi-regex": "^2.0.0" } }, "sha512-VhumSSbBqDTP8p2ZLKj40UjBCV4+v8bUSEpUb4KjRgWk9pbqGF4REFj6KEagidb2f/M6AzC0EmFyDNGaw9OCzg=="],

    "fsevents/strip-json-comments": ["strip-json-comments@2.0.1", "", {}, "sha512-4gB8na07fecVVkOI6Rs4e7T6NOTki5EmL7TUduTs6bu3EdnSycntVJ4re8kgZA+wx9IueI2Y11bfbgwtzuE0KQ=="],

    "fsevents/tar": ["tar@4.4.19", "", { "dependencies": { "chownr": "^1.1.4", "fs-minipass": "^1.2.7", "minipass": "^2.9.0", "minizlib": "^1.3.3", "mkdirp": "^0.5.5", "safe-buffer": "^5.2.1", "yallist": "^3.1.1" } }, "sha512-a20gEsvHnWe0ygBY8JbxoM4w3SJdhc7ZAuxkLqh+nvNQN2IOt0B5lLgM490X5Hl8FF0dl0tOf2ewFYAlIFgzVA=="],

    "fsevents/util-deprecate": ["util-deprecate@1.0.2", "", {}, "sha512-EPD5q1uXyFxJpCrLnCc1nHnq3gOa6DZBocAIiI2TaSCA7VCJ1UJDMagCzIkXNsUYfD1daK//LTEQ8xiIbrHtcw=="],

    "fsevents/wide-align": ["wide-align@1.1.5", "", { "dependencies": { "string-width": "^1.0.2 || 2 || 3 || 4" } }, "sha512-eDMORYaPNZ4sQIuuYPDHdQvf4gyCF9rEEV/yPxGfwPkRodwEgiMUUXTx/dex+Me0wxx53S+NgUHaP7y3MGlDmg=="],

    "fsevents/wrappy": ["wrappy@1.0.2", "", {}, "sha512-l4Sp/DRseor9wL6EvV2+TuQn63dMkPjZ/sp9XkghTEbV9KlPS1xUsZ3u7/IQO4wxtcFB4bgpQPRcR3QCvezPcQ=="],

    "fsevents/yallist": ["yallist@3.1.1", "", {}, "sha512-a4UGQaWPH59mOXUYnAG2ewncQS4i4F43Tv3JoAM+s2VDAmS9NsK8GpDMLrCHPksFT7h3K6TOoUNn2pb7RoXx4g=="],

    "fsevents/readable-stream/safe-buffer": ["safe-buffer@5.1.2", "", {}, "sha512-Gd2UZBJDkXlY7GbJxfsE8/nvKkUEU1G38c1siN6QP6a9PT9MmHB8GnpscSmMJSoF8LOIrt8ud/wPtojys4G6+g=="],

    "fsevents/string_decoder/safe-buffer": ["safe-buffer@5.1.2", "", {}, "sha512-Gd2UZBJDkXlY7GbJxfsE8/nvKkUEU1G38c1siN6QP6a9PT9MmHB8GnpscSmMJSoF8LOIrt8ud/wPtojys4G6+g=="],

    "fsevents/wide-align/string-width": ["string-width@4.2.3", "", { "dependencies": { "emoji-regex": "^8.0.0", "is-fullwidth-code-point": "^3.0.0", "strip-ansi": "^6.0.1" } }, "sha512-wKyQRQpjJ0sIp62ErSZdGsjMJWsap5oRNihHhu6G7JVO/9jIB6UyevL+tXuOqrng8j/cxKTWyWUwvSTriiZz/g=="],

    "fsevents/wide-align/string-width/is-fullwidth-code-point": ["is-fullwidth-code-point@3.0.0", "", {}, "sha512-zymm5+u+sCsSWyD9qNaejV3DFvhCKclKdizYaJUuHA83RLjb7nSuGnddCHGv0hk+KY7BMAlsWeK4Ueg6EV6XQg=="],

    "fsevents/wide-align/string-width/strip-ansi": ["strip-ansi@6.0.1", "", { "dependencies": { "ansi-regex": "^5.0.1" } }, "sha512-Y38VPSHcqkFrCpFnQ9vuSXmquuv5oXOKpGeT6aGrr3o3Gc9AlVa6JBfUSOCnbxGGZF+/0ooI7KrPuUSztUdU5A=="],

    "fsevents/wide-align/string-width/strip-ansi/ansi-regex": ["ansi-regex@5.0.1", "", {}, "sha512-quJQXlTSUGL2LH9SUXo8VwsY4soanhgo6LNSm84E1LBcE8s3O0wpdiRzyR9z/ZZJMlMWv37qOOb9pdJlMUEKFQ=="],
  }
}
`;

export const bundledDependenciesPrunedBunLock = `{
  "lockfileVersion": 2,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "@demo/api",
      "dependencies": {
        "fsevents": "1.2.4",
        "ms": "^2.1.0",
      },
    },
  },
  "packages": {
    "fsevents": ["fsevents@1.2.4", "", { "dependencies": { "nan": "^2.9.2", "node-pre-gyp": "^0.10.0" }, "os": "darwin", "hasInstallScript": true }, "sha512-z8H8/diyk76B7q5wg+Ud0+CqzcAF3mBBI/bA5ne5zrRUUIvNkJY//D3BqyH571KuAC4Nr7Rw7CjWX4r0y9DvNg=="],

    "ms": ["ms@2.1.3", "", {}, "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA=="],

    "nan": ["nan@2.30.0", "", {}, "sha512-P5mokDkSvCGBz6mZDD/2l+w9QoICRXdCyZ9ONGmTePr40oihJg3Kpn0YU3twKd6PJnwSlLBWNQeOT6yWEV2c4A=="],

    "fsevents/abbrev": ["abbrev@1.1.1", "", {}, "sha512-nne9/IiQ/hzIhY6pdDnbBtz7DjPTKrY00P/zvPSm5pOFkl6xuGrGnXn/VtTNNfNtAfZ9/1RtehkszU9qcTii0Q=="],

    "fsevents/ansi-regex": ["ansi-regex@2.1.1", "", {}, "sha512-TIGnTpdo+E3+pCyAluZvtED5p5wCqLdezCyhPZzKPcxvFplEt4i+W7OONCKgeZFT3+y5NZZfOOS/Bdcanm1MYA=="],

    "fsevents/aproba": ["aproba@1.2.0", "", {}, "sha512-Y9J6ZjXtoYh8RnXVCMOU/ttDmk1aBjunq9vO0ta5x85WDQiQfUF9sIPBITdbiiIVcBo03Hi3jMxigBtsddlXRw=="],

    "fsevents/are-we-there-yet": ["are-we-there-yet@1.1.7", "", { "dependencies": { "delegates": "^1.0.0", "readable-stream": "^2.0.6" } }, "sha512-nxwy40TuMiUGqMyRHgCSWZ9FM4VAoRP4xUYSTv5ImRog+h9yISPbVH7H8fASCIzYn9wlEv4zvFL7uKDMCFQm3g=="],

    "fsevents/balanced-match": ["balanced-match@1.0.2", "", {}, "sha512-3oSeUO0TMV67hN1AmbXsK4yaqU7tjiHlbxRDZOpH0KW9+CeX4bRAaX0Anxt0tx2MrpRpWwQaPwIlISEJhYU5Pw=="],

    "fsevents/brace-expansion": ["brace-expansion@1.1.21", "", { "dependencies": { "balanced-match": "^1.0.0", "concat-map": "0.0.1" } }, "sha512-9zeA+KLZNNzglF2TPKRQEDyx6Yby7daAkuy8MiPzpXPsYDWi/DRM8jmwUDxokQjYqBpv5DgPiwD4h4ZZSy1Ujw=="],

    "fsevents/chownr": ["chownr@1.1.4", "", {}, "sha512-jJ0bqzaylmJtVnNgzTeSOs8DPavpbYgEr/b0YL8/2GO3xJEhInFmhKMUnEJQjZumK7KXGFhUy89PrsJWlakBVg=="],

    "fsevents/code-point-at": ["code-point-at@1.1.0", "", {}, "sha512-RpAVKQA5T63xEj6/giIbUEtZwJ4UFIc3ZtvEkiaUERylqe8xb5IvqcgOurZLahv93CLKfxcw5YI+DZcUBRyLXA=="],

    "fsevents/concat-map": ["concat-map@0.0.1", "", {}, "sha512-/Srv4dswyQNBfohGpz9o6Yb3Gz3SrUDqBH5rTuhGR7ahtlbYKnVxw2bCFMRljaA7EXHaXZ8wsHdodFvbkhKmqg=="],

    "fsevents/console-control-strings": ["console-control-strings@1.1.0", "", {}, "sha512-ty/fTekppD2fIwRvnZAVdeOiGd1c7YXEixbgJTNzqcxJWKQnjJ/V1bNEEE6hygpM3WjwHFUVK6HTjWSzV4a8sQ=="],

    "fsevents/core-util-is": ["core-util-is@1.0.3", "", {}, "sha512-ZQBvi1DcpJ4GDqanjucZ2Hj3wEO5pZDS89BWbkcrvdxksJorwUDDZamX9ldFkp9aw2lmBDLgkObEA4DWNJ9FYQ=="],

    "fsevents/debug": ["debug@3.2.7", "", { "dependencies": { "ms": "^2.1.1" } }, "sha512-CFjzYYAi4ThfiQvizrFQevTTXHtnCqWfe7x1AhgEscTz6ZbLbfoLRLPugTQyBth6f8ZERVUSyWHFD/7Wu4t1XQ=="],

    "fsevents/deep-extend": ["deep-extend@0.6.0", "", {}, "sha512-LOHxIOaPYdHlJRtCQfDIVZtfw/ufM8+rVj649RIHzcm/vGwQRXFt6OPqIFWsm2XEMrNIEtWR64sY1LEKD2vAOA=="],

    "fsevents/delegates": ["delegates@1.0.0", "", {}, "sha512-bd2L678uiWATM6m5Z1VzNCErI3jiGzt6HGY8OVICs40JQq/HALfbyNJmp0UDakEY4pMMaN0Ly5om/B1VI/+xfQ=="],

    "fsevents/detect-libc": ["detect-libc@1.0.3", "", { "bin": { "detect-libc": "./bin/detect-libc.js" } }, "sha512-pGjwhsmsp4kL2RTz08wcOlGN83otlqHeD/Z5T8GXZB+/YcpQ/dgo+lbU8ZsGxV0HIvqqxo9l7mqYwyYMD9bKDg=="],

    "fsevents/emoji-regex": ["emoji-regex@8.0.0", "", {}, "sha512-MSjYzcWNOA0ewAHpz0MxpYFvwg6yjy1NG3xteoqz644VCo/RPgnr1/GGt+ic3iJTzQ8Eu3TdM14SawnVUmGE6A=="],

    "fsevents/fs-minipass": ["fs-minipass@1.2.7", "", { "dependencies": { "minipass": "^2.6.0" } }, "sha512-GWSSJGFy4e9GUeCcbIkED+bgAoFyj7XF1mV8rma3QW4NIqX9Kyx79N/PF61H5udOV3aY1IaMLs6pGbH71nlCTA=="],

    "fsevents/fs.realpath": ["fs.realpath@1.0.0", "", {}, "sha512-OO0pH2lK6a0hZnAdau5ItzHPI6pUlvI7jMVnxUQRtw4owF2wk8lOSabtGDCTP4Ggrg2MbGnWO9X8K1t4+fGMDw=="],

    "fsevents/gauge": ["gauge@2.7.4", "", { "dependencies": { "aproba": "^1.0.3", "console-control-strings": "^1.0.0", "has-unicode": "^2.0.0", "object-assign": "^4.1.0", "signal-exit": "^3.0.0", "string-width": "^1.0.1", "strip-ansi": "^3.0.1", "wide-align": "^1.1.0" } }, "sha512-14x4kjc6lkD3ltw589k0NrPD6cCNTD6CWoVUNpB85+DrtONoZn+Rug6xZU5RvSC4+TZPxA5AnBibQYAvZn41Hg=="],

    "fsevents/glob": ["glob@7.2.3", "", { "dependencies": { "fs.realpath": "^1.0.0", "inflight": "^1.0.4", "inherits": "2", "minimatch": "^3.1.1", "once": "^1.3.0", "path-is-absolute": "^1.0.0" } }, "sha512-nFR0zLpU2YCaRxwoCJvL6UvCH2JFyFVIvwTLsIf21AuHlMskA1hhTdk+LlYJtOlYt9v6dvszD2BGRqBL+iQK9Q=="],

    "fsevents/has-unicode": ["has-unicode@2.0.1", "", {}, "sha512-8Rf9Y83NBReMnx0gFzA8JImQACstCYWUplepDa9xprwwtmgEZUF0h/i5xSA625zB/I37EtrswSST6OXxwaaIJQ=="],

    "fsevents/iconv-lite": ["iconv-lite@0.4.24", "", { "dependencies": { "safer-buffer": ">= 2.1.2 < 3" } }, "sha512-v3MXnZAcvnywkTUEZomIActle7RXXeedOR31wwl7VlyoXO4Qi9arvSenNQWne1TcRwhCL1HwLI21bEqdpj8/rA=="],

    "fsevents/ignore-walk": ["ignore-walk@3.0.4", "", { "dependencies": { "minimatch": "^3.0.4" } }, "sha512-PY6Ii8o1jMRA1z4F2hRkH/xN59ox43DavKvD3oDpfurRlOJyAHpifIwpbdv1n4jt4ov0jSpw3kQ4GhJnpBL6WQ=="],

    "fsevents/inflight": ["inflight@1.0.6", "", { "dependencies": { "once": "^1.3.0", "wrappy": "1" } }, "sha512-k92I/b08q4wvFscXCLvqfsHCrjrF7yiXsQuIVvVE7N82W3+aqpzuUdBbfhWcy/FZR3/4IgflMgKLOsvPDrGCJA=="],

    "fsevents/inherits": ["inherits@2.0.4", "", {}, "sha512-k/vGaX4/Yla3WzyMCvTQOXYeIHvqOKtnqBduzTHpzpQZzAskKMhZ2K+EnBiSM9zGSoIFeMpXKxa4dYeZIQqewQ=="],

    "fsevents/ini": ["ini@1.3.8", "", {}, "sha512-JV/yugV2uzW5iMRSiZAyDtQd+nxtUnjeLt0acNdw98kKLrvuRVyB80tsREOE7yvGVgalhZ6RNXCmEHkUKBKxew=="],

    "fsevents/is-fullwidth-code-point": ["is-fullwidth-code-point@1.0.0", "", { "dependencies": { "number-is-nan": "^1.0.0" } }, "sha512-1pqUqRjkhPJ9miNq9SwMfdvi6lBJcd6eFxvfaivQhaH3SgisfiuudvFntdKOmxuee/77l+FPjKrQjWvmPjWrRw=="],

    "fsevents/isarray": ["isarray@1.0.0", "", {}, "sha512-VLghIWNM6ELQzo7zwmcg0NmTVyWKYjvIeM83yjp0wRDTmUnrM678fQbcKBo6n2CJEF0szoG//ytg+TKla89ALQ=="],

    "fsevents/minimatch": ["minimatch@3.1.5", "", { "dependencies": { "brace-expansion": "^1.1.7" } }, "sha512-VgjWUsnnT6n+NUk6eZq77zeFdpW2LWDzP6zFGrCbHXiYNul5Dzqk2HHQ5uFH2DNW5Xbp8+jVzaeNt94ssEEl4w=="],

    "fsevents/minimist": ["minimist@1.2.8", "", {}, "sha512-2yyAR8qBkN3YuheJanUpWC5U3bb5osDywNB8RzDVlDwDHbocAJveqqj1u8+SVD7jkWT4yvsHCpWqqWqAxb0zCA=="],

    "fsevents/minipass": ["minipass@2.9.0", "", { "dependencies": { "safe-buffer": "^5.1.2", "yallist": "^3.0.0" } }, "sha512-wxfUjg9WebH+CUDX/CdbRlh5SmfZiy/hpkxaRI16Y9W56Pa75sWgd/rvFilSgrauD9NyFymP/+JFV3KwzIsJeg=="],

    "fsevents/minizlib": ["minizlib@1.3.3", "", { "dependencies": { "minipass": "^2.9.0" } }, "sha512-6ZYMOEnmVsdCeTJVE0W9ZD+pVnE8h9Hma/iOwwRDsdQoePpoX56/8B6z3P9VNwppJuBKNRuFDRNRqRWexT9G9Q=="],

    "fsevents/mkdirp": ["mkdirp@0.5.6", "", { "dependencies": { "minimist": "^1.2.6" }, "bin": { "mkdirp": "bin/cmd.js" } }, "sha512-FP+p8RB8OWpF3YZBCrP5gtADmtXApB5AMLn+vdyA+PyxCjrCs00mjyUozssO33cwDeT3wNGdLxJ5M//YqtHAJw=="],

    "fsevents/ms": ["ms@2.1.3", "", {}, "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA=="],

    "fsevents/needle": ["needle@2.9.1", "", { "dependencies": { "debug": "^3.2.6", "iconv-lite": "^0.4.4", "sax": "^1.2.4" }, "bin": { "needle": "./bin/needle" } }, "sha512-6R9fqJ5Zcmf+uYaFgdIHmLwNldn5HbK8L5ybn7Uz+ylX/rnOsSp1AHcvQSrCaFN+qNM1wpymHqD7mVasEOlHGQ=="],

    "fsevents/node-pre-gyp": ["node-pre-gyp@0.10.3", "", { "dependencies": { "detect-libc": "^1.0.2", "mkdirp": "^0.5.1", "needle": "^2.2.1", "nopt": "^4.0.1", "npm-packlist": "^1.1.6", "npmlog": "^4.0.2", "rc": "^1.2.7", "rimraf": "^2.6.1", "semver": "^5.3.0", "tar": "^4" }, "bundled": true, "bin": { "node-pre-gyp": "./bin/node-pre-gyp" } }, "sha512-d1xFs+C/IPS8Id0qPTZ4bUT8wWryfR/OzzAFxweG+uLN85oPzyo2Iw6bVlLQ/JOdgNonXLCoRyqDzDWq4iw72A=="],

    "fsevents/nopt": ["nopt@4.0.3", "", { "dependencies": { "abbrev": "1", "osenv": "^0.1.4" }, "bin": { "nopt": "bin/nopt.js" } }, "sha512-CvaGwVMztSMJLOeXPrez7fyfObdZqNUK1cPAEzLHrTybIua9pMdmmPR5YwtfNftIOMv3DPUhFaxsZMNTQO20Kg=="],

    "fsevents/npm-bundled": ["npm-bundled@1.1.2", "", { "dependencies": { "npm-normalize-package-bin": "^1.0.1" } }, "sha512-x5DHup0SuyQcmL3s7Rx/YQ8sbw/Hzg0rj48eN0dV7hf5cmQq5PXIeioroH3raV1QC1yh3uTYuMThvEQF3iKgGQ=="],

    "fsevents/npm-normalize-package-bin": ["npm-normalize-package-bin@1.0.1", "", {}, "sha512-EPfafl6JL5/rU+ot6P3gRSCpPDW5VmIzX959Ob1+ySFUuuYHWHekXpwdUZcKP5C+DS4GEtdJluwBjnsNDl+fSA=="],

    "fsevents/npm-packlist": ["npm-packlist@1.4.8", "", { "dependencies": { "ignore-walk": "^3.0.1", "npm-bundled": "^1.0.1", "npm-normalize-package-bin": "^1.0.1" } }, "sha512-5+AZgwru5IevF5ZdnFglB5wNlHG1AOOuw28WhUq8/8emhBmLv6jX5by4WJCh7lW0uSYZYS6DXqIsyZVIXRZU9A=="],

    "fsevents/npmlog": ["npmlog@4.1.2", "", { "dependencies": { "are-we-there-yet": "~1.1.2", "console-control-strings": "~1.1.0", "gauge": "~2.7.3", "set-blocking": "~2.0.0" } }, "sha512-2uUqazuKlTaSI/dC8AzicUck7+IrEaOnN/e0jd3Xtt1KcGpwx30v50mL7oPyr/h9bL3E4aZccVwpwP+5W9Vjkg=="],

    "fsevents/number-is-nan": ["number-is-nan@1.0.1", "", {}, "sha512-4jbtZXNAsfZbAHiiqjLPBiCl16dES1zI4Hpzzxw61Tk+loF+sBDBKx1ICKKKwIqQ7M0mFn1TmkN7euSncWgHiQ=="],

    "fsevents/object-assign": ["object-assign@4.1.1", "", {}, "sha512-rJgTQnkUnH1sFw8yT6VSU3zD3sWmu6sZhIseY8VX+GRu3P6F7Fu+JNDoXfklElbLJSnc3FUQHVe4cU5hj+BcUg=="],

    "fsevents/once": ["once@1.4.0", "", { "dependencies": { "wrappy": "1" } }, "sha512-lNaJgI+2Q5URQBkccEKHTQOPaXdUxnZZElQTZY0MFUAuaEqe1E+Nyvgdz/aIyNi6Z9MzO5dv1H8n58/GELp3+w=="],

    "fsevents/os-homedir": ["os-homedir@1.0.2", "", {}, "sha512-B5JU3cabzk8c67mRRd3ECmROafjYMXbuzlwtqdM8IbS8ktlTix8aFGb2bAGKrSRIlnfKwovGUUr72JUPyOb6kQ=="],

    "fsevents/os-tmpdir": ["os-tmpdir@1.0.2", "", {}, "sha512-D2FR03Vir7FIu45XBY20mTb+/ZSWB00sjU9jdQXt83gDrI4Ztz5Fs7/yy74g2N5SVQY4xY1qDr4rNddwYRVX0g=="],

    "fsevents/osenv": ["osenv@0.1.5", "", { "dependencies": { "os-homedir": "^1.0.0", "os-tmpdir": "^1.0.0" } }, "sha512-0CWcCECdMVc2Rw3U5w9ZjqX6ga6ubk1xDVKxtBQPK7wis/0F2r9T6k4ydGYhecl7YUBxBVxhL5oisPsNxAPe2g=="],

    "fsevents/path-is-absolute": ["path-is-absolute@1.0.1", "", {}, "sha512-AVbw3UJ2e9bq64vSaS9Am0fje1Pa8pbGqTTsmXfaIiMpnr5DlDhfJOuLj9Sf95ZPVDAUerDfEk88MPmPe7UCQg=="],

    "fsevents/process-nextick-args": ["process-nextick-args@2.0.1", "", {}, "sha512-3ouUOpQhtgrbOa17J7+uxOTpITYWaGP7/AhoR3+A+/1e9skrzelGi/dXzEYyvbxubEF6Wn2ypscTKiKJFFn1ag=="],

    "fsevents/rc": ["rc@1.2.8", "", { "dependencies": { "deep-extend": "^0.6.0", "ini": "~1.3.0", "minimist": "^1.2.0", "strip-json-comments": "~2.0.1" }, "bin": { "rc": "./cli.js" } }, "sha512-y3bGgqKj3QBdxLbLkomlohkvsA8gdAiUQlSBJnBhfn+BPxg4bc62d8TcBW15wavDfgexCgccckhcZvywyQYPOw=="],

    "fsevents/readable-stream": ["readable-stream@2.3.8", "", { "dependencies": { "core-util-is": "~1.0.0", "inherits": "~2.0.3", "isarray": "~1.0.0", "process-nextick-args": "~2.0.0", "safe-buffer": "~5.1.1", "string_decoder": "~1.1.1", "util-deprecate": "~1.0.1" } }, "sha512-8p0AUk4XODgIewSi0l8Epjs+EVnWiK7NoDIEGU0HhE7+ZyY8D1IMY7odu5lRrFXGg71L15KG8QrPmum45RTtdA=="],

    "fsevents/rimraf": ["rimraf@2.7.1", "", { "dependencies": { "glob": "^7.1.3" }, "bin": { "rimraf": "./bin.js" } }, "sha512-uWjbaKIK3T1OSVptzX7Nl6PvQ3qAGtKEtVRjRuazjfL3Bx5eI409VZSqgND+4UNnmzLVdPj9FqFJNPqBZFve4w=="],

    "fsevents/safe-buffer": ["safe-buffer@5.2.1", "", {}, "sha512-rp3So07KcdmmKbGvgaNxQSJr7bGVSVk5S9Eq1F+ppbRo70+YeaDxkw5Dd8NPN+GD6bjnYm2VuPuCXmpuYvmCXQ=="],

    "fsevents/safer-buffer": ["safer-buffer@2.1.2", "", {}, "sha512-YZo3K82SD7Riyi0E1EQPojLz7kpepnSQI9IyPbHHg1XXXevb5dJI7tpyN2ADxGcQbHG7vcyRHk0cbwqcQriUtg=="],

    "fsevents/sax": ["sax@1.6.1", "", {}, "sha512-42tBVwLWnaQvW5zc4HbZrTuWccECCZfBi92FDuwtqxasH+JbPB3/FOKb1m222K42R4WxuxzzMsTswfzgtSu64Q=="],

    "fsevents/semver": ["semver@5.7.2", "", { "bin": { "semver": "bin/semver" } }, "sha512-cBznnQ9KjJqU67B52RMC65CMarK2600WFnbkcaiwWq3xy/5haFJlshgnpjovMVJ+Hff49d8GEn0b87C5pDQ10g=="],

    "fsevents/set-blocking": ["set-blocking@2.0.0", "", {}, "sha512-KiKBS8AnWGEyLzofFfmvKwpdPzqiy16LvQfK3yv/fVH7Bj13/wl3JSR1J+rfgRE9q7xUJK4qvgS8raSOeLUehw=="],

    "fsevents/signal-exit": ["signal-exit@3.0.7", "", {}, "sha512-wnD2ZE+l+SPC/uoS0vXeE9L1+0wuaMqKlfz9AMUo38JsyLSBWSFcHR1Rri62LZc12vLr1gb3jl7iwQhgwpAbGQ=="],

    "fsevents/string-width": ["string-width@1.0.2", "", { "dependencies": { "code-point-at": "^1.0.0", "is-fullwidth-code-point": "^1.0.0", "strip-ansi": "^3.0.0" } }, "sha512-0XsVpQLnVCXHJfyEs8tC0zpTVIr5PKKsQtkT29IwupnPTjtPmQ3xT/4yCREF9hYkV/3M3kzcUTSAZT6a6h81tw=="],

    "fsevents/string_decoder": ["string_decoder@1.1.1", "", { "dependencies": { "safe-buffer": "~5.1.0" } }, "sha512-n/ShnvDi6FHbbVfviro+WojiFzv+s8MPMHBczVePfUpDJLwoLT0ht1l4YwBCbi8pJAveEEdnkHyPyTP/mzRfwg=="],

    "fsevents/strip-ansi": ["strip-ansi@3.0.1", "", { "dependencies": { "ansi-regex": "^2.0.0" } }, "sha512-VhumSSbBqDTP8p2ZLKj40UjBCV4+v8bUSEpUb4KjRgWk9pbqGF4REFj6KEagidb2f/M6AzC0EmFyDNGaw9OCzg=="],

    "fsevents/strip-json-comments": ["strip-json-comments@2.0.1", "", {}, "sha512-4gB8na07fecVVkOI6Rs4e7T6NOTki5EmL7TUduTs6bu3EdnSycntVJ4re8kgZA+wx9IueI2Y11bfbgwtzuE0KQ=="],

    "fsevents/tar": ["tar@4.4.19", "", { "dependencies": { "chownr": "^1.1.4", "fs-minipass": "^1.2.7", "minipass": "^2.9.0", "minizlib": "^1.3.3", "mkdirp": "^0.5.5", "safe-buffer": "^5.2.1", "yallist": "^3.1.1" } }, "sha512-a20gEsvHnWe0ygBY8JbxoM4w3SJdhc7ZAuxkLqh+nvNQN2IOt0B5lLgM490X5Hl8FF0dl0tOf2ewFYAlIFgzVA=="],

    "fsevents/util-deprecate": ["util-deprecate@1.0.2", "", {}, "sha512-EPD5q1uXyFxJpCrLnCc1nHnq3gOa6DZBocAIiI2TaSCA7VCJ1UJDMagCzIkXNsUYfD1daK//LTEQ8xiIbrHtcw=="],

    "fsevents/wide-align": ["wide-align@1.1.5", "", { "dependencies": { "string-width": "^1.0.2 || 2 || 3 || 4" } }, "sha512-eDMORYaPNZ4sQIuuYPDHdQvf4gyCF9rEEV/yPxGfwPkRodwEgiMUUXTx/dex+Me0wxx53S+NgUHaP7y3MGlDmg=="],

    "fsevents/wrappy": ["wrappy@1.0.2", "", {}, "sha512-l4Sp/DRseor9wL6EvV2+TuQn63dMkPjZ/sp9XkghTEbV9KlPS1xUsZ3u7/IQO4wxtcFB4bgpQPRcR3QCvezPcQ=="],

    "fsevents/yallist": ["yallist@3.1.1", "", {}, "sha512-a4UGQaWPH59mOXUYnAG2ewncQS4i4F43Tv3JoAM+s2VDAmS9NsK8GpDMLrCHPksFT7h3K6TOoUNn2pb7RoXx4g=="],

    "fsevents/readable-stream/safe-buffer": ["safe-buffer@5.1.2", "", {}, "sha512-Gd2UZBJDkXlY7GbJxfsE8/nvKkUEU1G38c1siN6QP6a9PT9MmHB8GnpscSmMJSoF8LOIrt8ud/wPtojys4G6+g=="],

    "fsevents/string_decoder/safe-buffer": ["safe-buffer@5.1.2", "", {}, "sha512-Gd2UZBJDkXlY7GbJxfsE8/nvKkUEU1G38c1siN6QP6a9PT9MmHB8GnpscSmMJSoF8LOIrt8ud/wPtojys4G6+g=="],

    "fsevents/wide-align/string-width": ["string-width@4.2.3", "", { "dependencies": { "emoji-regex": "^8.0.0", "is-fullwidth-code-point": "^3.0.0", "strip-ansi": "^6.0.1" } }, "sha512-wKyQRQpjJ0sIp62ErSZdGsjMJWsap5oRNihHhu6G7JVO/9jIB6UyevL+tXuOqrng8j/cxKTWyWUwvSTriiZz/g=="],

    "fsevents/wide-align/string-width/is-fullwidth-code-point": ["is-fullwidth-code-point@3.0.0", "", {}, "sha512-zymm5+u+sCsSWyD9qNaejV3DFvhCKclKdizYaJUuHA83RLjb7nSuGnddCHGv0hk+KY7BMAlsWeK4Ueg6EV6XQg=="],

    "fsevents/wide-align/string-width/strip-ansi": ["strip-ansi@6.0.1", "", { "dependencies": { "ansi-regex": "^5.0.1" } }, "sha512-Y38VPSHcqkFrCpFnQ9vuSXmquuv5oXOKpGeT6aGrr3o3Gc9AlVa6JBfUSOCnbxGGZF+/0ooI7KrPuUSztUdU5A=="],

    "fsevents/wide-align/string-width/strip-ansi/ansi-regex": ["ansi-regex@5.0.1", "", {}, "sha512-quJQXlTSUGL2LH9SUXo8VwsY4soanhgo6LNSm84E1LBcE8s3O0wpdiRzyR9z/ZZJMlMWv37qOOb9pdJlMUEKFQ=="],
  }
}
`;
