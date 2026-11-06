export const localPathPackagesBunLock = `{
  "lockfileVersion": 2,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "root",
      "dependencies": {
        "alias": "file:./vendor/real",
        "ignored": "file:./vendor/ignored",
        "lnk": "link:vendor/lnk",
        "vend": "file:./vendor/vend",
        "vtar": "file:./vendor/vtar-1.0.0.tgz",
      },
    },
  },
  "packages": {
    "alias": ["real@file:vendor/real", {}],

    "ignored": ["ignored@file:vendor/ignored", {}],

    "lnk": ["lnk@link:./vendor/lnk", {}],

    "ttar": ["ttar@../ttar-1.0.0.tgz", {}, "sha512-kO3A9JVF6tDNIrS1KO7tDN+Ly8UNMqAxClR/GzXBP2owH0fsPP9QmOzT03NF8t5UqwDsbPu/wnqt9oilIN5dPQ=="],

    "vend": ["vend@file:vendor/vend", { "dependencies": { "ttar": "file:../ttar-1.0.0.tgz" } }],

    "vtar": ["vtar@./vendor/vtar-1.0.0.tgz", {}, "sha512-ryhoLLJAIwkLA1dIXC5lCi3K73koaKB0oiMiZEBBCxRZ/44892q/75qPxZnVZgGcdZbweilCvpbzGdA0s8QqOg=="],
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
