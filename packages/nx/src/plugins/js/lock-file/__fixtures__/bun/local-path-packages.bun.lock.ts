export const localPathPackagesBunLock = `{
  "lockfileVersion": 2,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "root",
      "dependencies": {
        "ignored": "file:./vendor/ignored",
        "lnk": "link:vendor/lnk",
        "vend": "file:./vendor/vend",
        "vtar": "file:./vendor/vtar-1.0.0.tgz",
      },
    },
  },
  "packages": {
    "ignored": ["ignored@file:vendor/ignored", {}],

    "lnk": ["lnk@link:./vendor/lnk", {}],

    "ttar": ["ttar@../ttar-1.0.0.tgz", {}, "sha512-vUBRCjoXfRDJSPRNadts6ZFlwSz5G0jNyodbIq3NX45es/e8u7qtf22H9OuAAlsvDfM+XdUjeewGO8XlwKr60w=="],

    "vend": ["vend@file:vendor/vend", { "dependencies": { "ttar": "file:../ttar-1.0.0.tgz" } }],

    "vtar": ["vtar@./vendor/vtar-1.0.0.tgz", {}, "sha512-6MzKQuGxoFB6HuUzK6Pe/EwCIeH8cOST39I8boWeLVo0UaJ7GoX6rWFFyLkKmuWb6qRYS7nhSOLGX+mJaTs0gw=="],
  }
}
`;

export const workspaceNameLocalPathBunLock = `{
  "lockfileVersion": 2,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "root",
    },
    "apps/api": {
      "name": "@demo/api",
      "version": "1.0.0",
      "dependencies": {
        "util": "file:../../vendor/util",
      },
    },
    "apps/web": {
      "name": "@demo/web",
      "version": "1.0.0",
      "dependencies": {
        "util": "link:../../libs/util",
      },
    },
    "libs/util": {
      "name": "util",
      "version": "1.0.0",
    },
  },
  "packages": {
    "@demo/api": ["@demo/api@workspace:apps/api"],

    "@demo/web": ["@demo/web@workspace:apps/web"],

    "util": ["util@workspace:libs/util"],

    "@demo/api/util": ["util@file:vendor/util", {}],

    "@demo/web/util": ["util@link:./libs/util", {}],
  }
}
`;
