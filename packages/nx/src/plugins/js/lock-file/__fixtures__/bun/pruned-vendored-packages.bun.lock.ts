export const vendoredPackagesRootBunLock = `{
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
        "@demo/util": "workspace:*",
        "lnk": "link:../../vendor/lnk",
        "vend": "file:../../vendor/vend",
        "vtar": "file:../../vendor/vtar-1.0.0.tgz",
      },
      "peerDependencies": {
        "pvend": "file:../../vendor/pvend",
      },
    },
    "apps/web": {
      "name": "@demo/web",
      "version": "1.0.0",
      "dependencies": {
        "vend": "file:../../vendor/vend2",
      },
    },
    "libs/util": {
      "name": "@demo/util",
      "version": "1.0.0",
      "dependencies": {
        "libvend": "file:../../vendor/libvend",
        "ltar": "file:../../vendor/ltar-1.0.0.tgz",
      },
    },
  },
  "packages": {
    "@demo/api": ["@demo/api@workspace:apps/api"],

    "@demo/util": ["@demo/util@workspace:libs/util"],

    "@demo/web": ["@demo/web@workspace:apps/web"],

    "left-pad": ["left-pad@1.3.0", "", {}, "sha512-XI5MPzVNApjAyhQzphX8BkmKsKUxD4LdyK24iZeQGinBN9yTQT3bFlCBy/aVx2HrNcqQGsdot8ghrjyrvMCoEA=="],

    "lnk": ["lnk@link:./vendor/lnk", {}],

    "ltar": ["ltar@../../vendor/ltar-1.0.0.tgz", {}, "sha512-LpWD93nH1bmwPXX+6IO4iMCmnfJOo0ka6o4eXNXtS5RuAqGLsQMaVajmJGL4g46ktWtfY42Mue2jhzeSin+Vhw=="],

    "ttar": ["ttar@../ttar-1.0.0.tgz", {}, "sha512-4TdWGRWDFd93FNGnVdZrkxi9DldhGHjP3BxlkHBUoMYY8h8FEr6qywpX0RMzPkVse2G9WqaRFw4RefHq3jGOLg=="],

    "typescript": ["typescript@5.9.3", "", { "bin": { "tsc": "bin/tsc", "tsserver": "bin/tsserver" } }, "sha512-jl1vZzPDinLr9eUt3J/t7V6FgNEw9QjvBPdysz9KfQDD41fQrC2Y4vKQdiaUpFT4bXlb1RHhLpp8wtm6M5TgSw=="],

    "vtar": ["vtar@../../vendor/vtar-1.0.0.tgz", {}, "sha512-heyGDdCbR7qmd2bHOxXZDRPhYixpYb8PxPwhz4iyZDzQ1LG67bJniqFzEt9d0QE7SxKRO9Pw8egk8gs9KBL0Dg=="],

    "@demo/api/pvend": ["pvend@file:vendor/pvend", {}],

    "@demo/api/vend": ["vend@file:vendor/vend", { "dependencies": { "inner": "file:../inner", "ttar": "file:../ttar-1.0.0.tgz" }, "devDependencies": { "left-pad": "1.3.0" } }],

    "@demo/util/libvend": ["libvend@file:vendor/libvend", {}],

    "@demo/web/vend": ["vend@file:vendor/vend2", {}],

    "@demo/api/vend/inner": ["inner@file:vendor/inner", {}],
  }
}
`;

export const vendoredPackagesPrunedBunLock = `{
  "lockfileVersion": 2,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "@demo/api",
      "dependencies": {
        "@demo/util": "file:./workspace_modules/@demo/util",
        "libvend": "file:local_path_modules/vendor/libvend",
        "lnk": "link:local_path_modules/vendor/lnk",
        "ltar": "file:local_path_modules/vendor/ltar-1.0.0.tgz",
        "vend": "file:local_path_modules/vendor/vend",
        "vtar": "file:local_path_modules/vendor/vtar-1.0.0.tgz",
      },
      "peerDependencies": {
        "pvend": "file:local_path_modules/vendor/pvend",
      },
    },
  },
  "packages": {
    "@demo/util": ["@demo/util@file:workspace_modules/@demo/util", { "dependencies": { "libvend": "file:../../../local_path_modules/vendor/libvend", "ltar": "file:../../../local_path_modules/vendor/ltar-1.0.0.tgz" } }],

    "inner": ["inner@file:local_path_modules/vendor/inner", {}],

    "left-pad": ["left-pad@1.3.0", "", {}, "sha512-XI5MPzVNApjAyhQzphX8BkmKsKUxD4LdyK24iZeQGinBN9yTQT3bFlCBy/aVx2HrNcqQGsdot8ghrjyrvMCoEA=="],

    "libvend": ["libvend@file:local_path_modules/vendor/libvend", {}],

    "lnk": ["lnk@link:./local_path_modules/vendor/lnk", {}],

    "ltar": ["ltar@local_path_modules/vendor/ltar-1.0.0.tgz", {}, "sha512-LpWD93nH1bmwPXX+6IO4iMCmnfJOo0ka6o4eXNXtS5RuAqGLsQMaVajmJGL4g46ktWtfY42Mue2jhzeSin+Vhw=="],

    "pvend": ["pvend@file:local_path_modules/vendor/pvend", {}],

    "ttar": ["ttar@../ttar-1.0.0.tgz", {}, "sha512-4TdWGRWDFd93FNGnVdZrkxi9DldhGHjP3BxlkHBUoMYY8h8FEr6qywpX0RMzPkVse2G9WqaRFw4RefHq3jGOLg=="],

    "vend": ["vend@file:local_path_modules/vendor/vend", { "dependencies": { "inner": "file:../inner", "ttar": "file:../ttar-1.0.0.tgz" }, "devDependencies": { "left-pad": "1.3.0" } }],

    "vtar": ["vtar@local_path_modules/vendor/vtar-1.0.0.tgz", {}, "sha512-heyGDdCbR7qmd2bHOxXZDRPhYixpYb8PxPwhz4iyZDzQ1LG67bJniqFzEt9d0QE7SxKRO9Pw8egk8gs9KBL0Dg=="],

    "@demo/util/ltar": ["ltar@../../../local_path_modules/vendor/ltar-1.0.0.tgz", {}, "sha512-LpWD93nH1bmwPXX+6IO4iMCmnfJOo0ka6o4eXNXtS5RuAqGLsQMaVajmJGL4g46ktWtfY42Mue2jhzeSin+Vhw=="],
  }
}
`;

export const vendoredWorkspaceNameRootBunLock = `{
  "lockfileVersion": 2,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "demo",
    },
    "apps/api": {
      "name": "@demo/api",
      "version": "1.0.0",
      "dependencies": {
        "@demo/lib": "workspace:*",
        "util": "file:../../vendor/util",
      },
    },
    "apps/web": {
      "name": "@demo/web",
      "version": "1.0.0",
      "dependencies": {
        "util": "workspace:*",
      },
    },
    "libs/lib": {
      "name": "@demo/lib",
      "version": "1.0.0",
      "dependencies": {
        "util": "file:../../vendor/util",
      },
    },
    "libs/util": {
      "name": "util",
      "version": "1.0.0",
      "dependencies": {
        "odd": "file:../../vendor/odd",
      },
    },
  },
  "packages": {
    "@demo/api": ["@demo/api@workspace:apps/api"],

    "@demo/lib": ["@demo/lib@workspace:libs/lib"],

    "@demo/web": ["@demo/web@workspace:apps/web"],

    "util": ["util@workspace:libs/util"],

    "@demo/api/util": ["util@file:vendor/util", {}],

    "@demo/lib/util": ["util@file:vendor/util", {}],

    "util/odd": ["odd@file:vendor/odd", {}],
  }
}
`;

export const vendoredWorkspaceNamePrunedBunLock = `{
  "lockfileVersion": 2,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "@demo/api",
      "dependencies": {
        "@demo/lib": "file:./workspace_modules/@demo/lib",
        "util": "file:local_path_modules/vendor/util",
      },
    },
  },
  "packages": {
    "@demo/lib": ["@demo/lib@file:workspace_modules/@demo/lib", { "dependencies": { "util": "file:../../../local_path_modules/vendor/util" } }],

    "util": ["util@file:local_path_modules/vendor/util", {}],
  }
}
`;
