export const siblingOptionalPeerInRangeRootBunLock = `{
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
        "ws": "^8.18.0",
      },
    },
    "libs/util": {
      "name": "@demo/util",
      "version": "0.0.1",
      "dependencies": {
        "bufferutil": "4.0.9",
      },
    },
  },
  "packages": {
    "@demo/api": ["@demo/api@workspace:apps/api"],

    "@demo/util": ["@demo/util@workspace:libs/util"],

    "bufferutil": ["bufferutil@4.0.9", "", { "dependencies": { "node-gyp-build": "^4.3.0" }, "hasInstallScript": true }, "sha512-WDtdLmJvAuNNPzByAYpRo2rF1Mmradw6gvWsQKf63476DDXmomT9zUiGypLcG4ibIM67vhAj8jJRdbmEws2Aqw=="],

    "node-gyp-build": ["node-gyp-build@4.8.4", "", { "bin": { "node-gyp-build": "bin.js", "node-gyp-build-optional": "optional.js", "node-gyp-build-test": "build-test.js" } }, "sha512-LA4ZjwlnUblHVgq0oBF3Jl/6h/Nvs5fzBLwdEF4nuxnFdsfajde4WfxtJr3CaiH+F6ewcIB/q4jQ4UzPyid+CQ=="],

    "ws": ["ws@8.22.0", "", { "peerDependencies": { "bufferutil": "^4.0.1", "utf-8-validate": ">=5.0.2" }, "optionalPeers": ["bufferutil", "utf-8-validate"] }, "sha512-Ydggc987+RO0AnWtZ/7Wq9FtNvcrL1b/RO0ud9mWjUPgDrsAAwQSF51sm2hm1XofbU/4jkpGEsLFsZZxU+1DOg=="],
  }
}
`;

export const siblingOptionalPeerInRangePrunedBunLock = `{
  "lockfileVersion": 2,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "@demo/api",
      "dependencies": {
        "ws": "^8.18.0",
      },
    },
  },
  "packages": {
    "bufferutil": ["bufferutil@4.0.9", "", { "dependencies": { "node-gyp-build": "^4.3.0" }, "hasInstallScript": true }, "sha512-WDtdLmJvAuNNPzByAYpRo2rF1Mmradw6gvWsQKf63476DDXmomT9zUiGypLcG4ibIM67vhAj8jJRdbmEws2Aqw=="],

    "node-gyp-build": ["node-gyp-build@4.8.4", "", { "bin": { "node-gyp-build": "bin.js", "node-gyp-build-optional": "optional.js", "node-gyp-build-test": "build-test.js" } }, "sha512-LA4ZjwlnUblHVgq0oBF3Jl/6h/Nvs5fzBLwdEF4nuxnFdsfajde4WfxtJr3CaiH+F6ewcIB/q4jQ4UzPyid+CQ=="],

    "ws": ["ws@8.22.0", "", { "peerDependencies": { "bufferutil": "^4.0.1", "utf-8-validate": ">=5.0.2" }, "optionalPeers": ["bufferutil", "utf-8-validate"] }, "sha512-Ydggc987+RO0AnWtZ/7Wq9FtNvcrL1b/RO0ud9mWjUPgDrsAAwQSF51sm2hm1XofbU/4jkpGEsLFsZZxU+1DOg=="],
  }
}
`;

export const siblingOptionalPeerOutOfRangeRootBunLock = `{
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
        "ws": "^8.18.0",
      },
    },
    "libs/util": {
      "name": "@demo/util",
      "version": "0.0.1",
      "dependencies": {
        "bufferutil": "4.0.0",
      },
    },
  },
  "packages": {
    "@demo/api": ["@demo/api@workspace:apps/api"],

    "@demo/util": ["@demo/util@workspace:libs/util"],

    "bufferutil": ["bufferutil@4.0.0", "", { "dependencies": { "node-gyp-build": "~3.4.0" }, "hasInstallScript": true }, "sha512-jpnqMVLo7sqfUY2W92RC4jjj9TuiOSkjB0k43TxPcrBSntZwXUOl8Krfd3eVEdApuScpSTwYKntm/dXU2T8gnw=="],

    "node-gyp-build": ["node-gyp-build@3.4.0", "", { "bin": { "node-gyp-build": "./bin.js", "node-gyp-build-test": "./build-test.js", "node-gyp-build-optional": "./optional.js" } }, "sha512-YoviGBJYGrPdLOKDIQB0sKxuKy/EEsxzooNkOZak4vSTKT/qH0Pa6dj3t1MJjEQGsefih61IyHDmO1WW7xOFfw=="],

    "ws": ["ws@8.22.0", "", { "peerDependencies": { "bufferutil": "^4.0.1", "utf-8-validate": ">=5.0.2" }, "optionalPeers": ["bufferutil", "utf-8-validate"] }, "sha512-Ydggc987+RO0AnWtZ/7Wq9FtNvcrL1b/RO0ud9mWjUPgDrsAAwQSF51sm2hm1XofbU/4jkpGEsLFsZZxU+1DOg=="],
  }
}
`;

export const siblingOptionalPeerOutOfRangePrunedBunLock = `{
  "lockfileVersion": 2,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "@demo/api",
      "dependencies": {
        "ws": "^8.18.0",
      },
    },
  },
  "packages": {
    "bufferutil": ["bufferutil@4.0.0", "", { "dependencies": { "node-gyp-build": "~3.4.0" }, "hasInstallScript": true }, "sha512-jpnqMVLo7sqfUY2W92RC4jjj9TuiOSkjB0k43TxPcrBSntZwXUOl8Krfd3eVEdApuScpSTwYKntm/dXU2T8gnw=="],

    "node-gyp-build": ["node-gyp-build@3.4.0", "", { "bin": { "node-gyp-build": "./bin.js", "node-gyp-build-test": "./build-test.js", "node-gyp-build-optional": "./optional.js" } }, "sha512-YoviGBJYGrPdLOKDIQB0sKxuKy/EEsxzooNkOZak4vSTKT/qH0Pa6dj3t1MJjEQGsefih61IyHDmO1WW7xOFfw=="],

    "ws": ["ws@8.22.0", "", { "peerDependencies": { "bufferutil": "^4.0.1", "utf-8-validate": ">=5.0.2" }, "optionalPeers": ["bufferutil", "utf-8-validate"] }, "sha512-Ydggc987+RO0AnWtZ/7Wq9FtNvcrL1b/RO0ud9mWjUPgDrsAAwQSF51sm2hm1XofbU/4jkpGEsLFsZZxU+1DOg=="],
  }
}
`;
