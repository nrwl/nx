export const workspaceDependenciesBunLock = `{
  "lockfileVersion": 1,
  "workspaces": {
    "": {
      "name": "workspace-root",
      "dependencies": {
        "lodash": "^4.17.21",
      },
    },
    "packages/app": {
      "name": "app",
      "version": "1.0.0",
      "dependencies": {
        "react": "^18.2.0",
        "shared": "workspace:*",
      },
    },
    "packages/shared": {
      "name": "shared",
      "version": "1.0.0",
      "dependencies": {
        "axios": "^1.6.0",
      },
    },
  },
  "packages": {
    "app": ["app@workspace:packages/app"],

    "asynckit": ["asynckit@0.4.0", "https://registry.npmjs.org/asynckit/-/asynckit-0.4.0.tgz", {}, "sha512-Oei9OH4tRh0YqU3GxhX79dM/mwVgvbZJaSNaRk+bshkj0S5cfHcgYakreBjrHwatXKbz+IoIdYLxrKim2MjW0Q=="],

    "axios": ["axios@1.10.0", "https://registry.npmjs.org/axios/-/axios-1.10.0.tgz", { "dependencies": { "follow-redirects": "^1.15.6", "form-data": "^4.0.0", "proxy-from-env": "^1.1.0" } }, "sha512-/1xYAC4MP/HEG+3duIhFr4ZQXR4sQXOIe+o6sdqzeykGLx6Upp/1p8MHqhINOvGeP7xyNHe7tsiJByc4SSVUxw=="],

    "call-bind-apply-helpers": ["call-bind-apply-helpers@1.0.2", "https://registry.npmjs.org/call-bind-apply-helpers/-/call-bind-apply-helpers-1.0.2.tgz", { "dependencies": { "es-errors": "^1.3.0", "function-bind": "^1.1.2" } }, "sha512-Sp1ablJ0ivDkSzjcaJdxEunN5/XvksFJ2sMBFfq6x0ryhQV/2b/KwFe21cMpmHtPOSij8K99/wSfoEuTObmuMQ=="],

    "combined-stream": ["combined-stream@1.0.8", "https://registry.npmjs.org/combined-stream/-/combined-stream-1.0.8.tgz", { "dependencies": { "delayed-stream": "~1.0.0" } }, "sha512-FQN4MRfuJeHf7cBbBMJFXhKSDq+2kAArBlmRBvcvFE5BB1HZKXtSFASDhdlz9zOYwxh8lDdnvmMOe/+5cdoEdg=="],

    "delayed-stream": ["delayed-stream@1.0.0", "https://registry.npmjs.org/delayed-stream/-/delayed-stream-1.0.0.tgz", {}, "sha512-ZySD7Nf91aLB0RxL4KGrKHBXl7Eds1DAmEdcoVawXnLD7SDhpNgtuII2aAkg7a7QS41jxPSZ17p4VdGnMHk3MQ=="],

    "dunder-proto": ["dunder-proto@1.0.1", "https://registry.npmjs.org/dunder-proto/-/dunder-proto-1.0.1.tgz", { "dependencies": { "call-bind-apply-helpers": "^1.0.1", "es-errors": "^1.3.0", "gopd": "^1.2.0" } }, "sha512-KIN/nDJBQRcXw0MLVhZE9iQHmG68qAVIBg9CqmUYjmQIhgij9U5MFvrqkUL5FbtyyzZuOeOt0zdeRe4UY7ct+A=="],

    "es-define-property": ["es-define-property@1.0.1", "https://registry.npmjs.org/es-define-property/-/es-define-property-1.0.1.tgz", {}, "sha512-e3nRfgfUZ4rNGL232gUgX06QNyyez04KdjFrF+LTRoOXmrOgFKDg4BCdsjW8EnT69eqdYGmRpJwiPVYNrCaW3g=="],

    "es-errors": ["es-errors@1.3.0", "https://registry.npmjs.org/es-errors/-/es-errors-1.3.0.tgz", {}, "sha512-Zf5H2Kxt2xjTvbJvP2ZWLEICxA6j+hAmMzIlypy4xcBg1vKVnx89Wy0GbS+kf5cwCVFFzdCFh2XSCFNULS6csw=="],

    "es-object-atoms": ["es-object-atoms@1.1.1", "https://registry.npmjs.org/es-object-atoms/-/es-object-atoms-1.1.1.tgz", { "dependencies": { "es-errors": "^1.3.0" } }, "sha512-FGgH2h8zKNim9ljj7dankFPcICIK9Cp5bm+c2gQSYePhpaG5+esrLODihIorn+Pe6FGJzWhXQotPv73jTaldXA=="],

    "es-set-tostringtag": ["es-set-tostringtag@2.1.0", "https://registry.npmjs.org/es-set-tostringtag/-/es-set-tostringtag-2.1.0.tgz", { "dependencies": { "es-errors": "^1.3.0", "get-intrinsic": "^1.2.6", "has-tostringtag": "^1.0.2", "hasown": "^2.0.2" } }, "sha512-j6vWzfrGVfyXxge+O0x5sh6cvxAog0a/4Rdd2K36zCMV5eJ+/+tOAngRO8cODMNWbVRdVlmGZQL2YS3yR8bIUA=="],

    "follow-redirects": ["follow-redirects@1.15.9", "https://registry.npmjs.org/follow-redirects/-/follow-redirects-1.15.9.tgz", {}, "sha512-gew4GsXizNgdoRyqmyfMHyAmXsZDk6mHkSxZFCzW9gwlbtOW44CDtYavM+y+72qD/Vq2l550kMF52DT8fOLJqQ=="],

    "form-data": ["form-data@4.0.4", "https://registry.npmjs.org/form-data/-/form-data-4.0.4.tgz", { "dependencies": { "asynckit": "^0.4.0", "combined-stream": "^1.0.8", "es-set-tostringtag": "^2.1.0", "hasown": "^2.0.2", "mime-types": "^2.1.12" } }, "sha512-KrGhL9Q4zjj0kiUt5OO4Mr/A/jlI2jDYs5eHBpYHPcBEVSiipAvn2Ko2HnPe20rmcuuvMHNdZFp+4IlGTMF0Ow=="],

    "function-bind": ["function-bind@1.1.2", "https://registry.npmjs.org/function-bind/-/function-bind-1.1.2.tgz", {}, "sha512-7XHNxH7qX9xG5mIwxkhumTox/MIRNcOgDrxWsMt2pAr23WHp6MrRlN7FBSFpCpr+oVO0F744iUgR82nJMfG2SA=="],

    "get-intrinsic": ["get-intrinsic@1.3.0", "https://registry.npmjs.org/get-intrinsic/-/get-intrinsic-1.3.0.tgz", { "dependencies": { "call-bind-apply-helpers": "^1.0.2", "es-define-property": "^1.0.1", "es-errors": "^1.3.0", "es-object-atoms": "^1.1.1", "function-bind": "^1.1.2", "get-proto": "^1.0.1", "gopd": "^1.2.0", "has-symbols": "^1.1.0", "hasown": "^2.0.2", "math-intrinsics": "^1.1.0" } }, "sha512-9fSjSaos/fRIVIp+xSJlE6lfwhES7LNtKaCBIamHsjr2na1BiABJPo0mOjjz8GJDURarmCPGqaiVg5mfjb98CQ=="],

    "get-proto": ["get-proto@1.0.1", "https://registry.npmjs.org/get-proto/-/get-proto-1.0.1.tgz", { "dependencies": { "dunder-proto": "^1.0.1", "es-object-atoms": "^1.0.0" } }, "sha512-sTSfBjoXBp89JvIKIefqw7U2CCebsc74kiY6awiGogKtoSGbgjYE/G/+l9sF3MWFPNc9IcoOC4ODfKHfxFmp0g=="],

    "gopd": ["gopd@1.2.0", "https://registry.npmjs.org/gopd/-/gopd-1.2.0.tgz", {}, "sha512-ZUKRh6/kUFoAiTAtTYPZJ3hw9wNxx+BIBOijnlG9PnrJsCcSjs1wyyD6vJpaYtgnzDrKYRSqf3OO6Rfa93xsRg=="],

    "has-symbols": ["has-symbols@1.1.0", "https://registry.npmjs.org/has-symbols/-/has-symbols-1.1.0.tgz", {}, "sha512-1cDNdwJ2Jaohmb3sg4OmKaMBwuC48sYni5HUw2DvsC8LjGTLK9h+eb1X6RyuOHe4hT0ULCW68iomhjUoKUqlPQ=="],

    "has-tostringtag": ["has-tostringtag@1.0.2", "https://registry.npmjs.org/has-tostringtag/-/has-tostringtag-1.0.2.tgz", { "dependencies": { "has-symbols": "^1.0.3" } }, "sha512-NqADB8VjPFLM2V0VvHUewwwsw0ZWBaIdgo+ieHtK3hasLz4qeCRjYcqfB6AQrBggRKppKF8L52/VqdVsO47Dlw=="],

    "hasown": ["hasown@2.0.2", "https://registry.npmjs.org/hasown/-/hasown-2.0.2.tgz", { "dependencies": { "function-bind": "^1.1.2" } }, "sha512-0hJU9SCPvmMzIBdZFqNPXWa6dqh7WdH0cII9y+CyS8rG3nL48Bclra9HmKhVVUHyPWNH5Y7xDwAB7bfgSjkUMQ=="],

    "js-tokens": ["js-tokens@4.0.0", "https://registry.npmjs.org/js-tokens/-/js-tokens-4.0.0.tgz", {}, "sha512-RdJUflcE3cUzKiMqQgsCu06FPu9UdIJO0beYbPhHN4k6apgJtifcoCtT9bcxOpYBtpD2kCM6Sbzg4CausW/PKQ=="],

    "lodash": ["lodash@4.17.21", "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz", {}, "sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg=="],

    "loose-envify": ["loose-envify@1.4.0", "https://registry.npmjs.org/loose-envify/-/loose-envify-1.4.0.tgz", { "dependencies": { "js-tokens": "^3.0.0 || ^4.0.0" }, "bin": { "loose-envify": "cli.js" } }, "sha512-lyuxPGr/Wfhrlem2CL/UcnUc1zcqKAImBDzukY7Y5F/yQiNdko6+fRLevlw1HgMySw7f611UIY408EtxRSoK3Q=="],

    "math-intrinsics": ["math-intrinsics@1.1.0", "https://registry.npmjs.org/math-intrinsics/-/math-intrinsics-1.1.0.tgz", {}, "sha512-/IXtbwEk5HTPyEwyKX6hGkYXxM9nbj64B+ilVJnC/R6B0pH5G4V3b0pVbL7DBj4tkhBAppbQUlf6F6Xl9LHu1g=="],

    "mime-db": ["mime-db@1.52.0", "https://registry.npmjs.org/mime-db/-/mime-db-1.52.0.tgz", {}, "sha512-sPU4uV7dYlvtWJxwwxHD0PuihVNiE7TyAbQ5SWxDCB9mUYvOgroQOwYQQOKPJ8CIbE+1ETVlOoK1UC2nU3gYvg=="],

    "mime-types": ["mime-types@2.1.35", "https://registry.npmjs.org/mime-types/-/mime-types-2.1.35.tgz", { "dependencies": { "mime-db": "1.52.0" } }, "sha512-ZDY+bPm5zTTF+YpCrAU9nK0UgICYPT0QtT1NZWFv4s++TNkcgVaT0g6+4R2uI4MjQjzysHB1zxuWL50hzaeXiw=="],

    "proxy-from-env": ["proxy-from-env@1.1.0", "https://registry.npmjs.org/proxy-from-env/-/proxy-from-env-1.1.0.tgz", {}, "sha512-D+zkORCbA9f1tdWRK0RaCR3GPv50cMxcrz4X8k5LTSUD1Dkw47mKJEZQNunItRTkWwgtaUSo1RVFRIG9ZXiFYg=="],

    "react": ["react@18.3.1", "https://registry.npmjs.org/react/-/react-18.3.1.tgz", { "dependencies": { "loose-envify": "^1.1.0" } }, "sha512-wS+hAgJShR0KhEvPJArfuPVN1+Hz1t0Y6n5jLrGQbkb4urgPE/0Rve+1kMB1v/oWgHgm4WIcV+i7F2pTVj+2iQ=="],

    "shared": ["shared@workspace:packages/shared"],
  }
}`;
