export const overriddenLocalPathBunLock = `{
  "lockfileVersion": 3,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "ovr-root",
      "dependencies": {
        "ms": "2.1.3",
      },
    },
    "libs/control": {
      "name": "control",
      "version": "0.0.0",
      "dependencies": {
        "ms": "file:../../vendor/ms",
      },
    },
    "libs/lib": {
      "name": "lib",
      "version": "0.0.0",
      "dependencies": {
        "ms": "file:../../vendor/ms",
      },
    },
  },
  "overrides": {
    "lib": {
      "ms": "2.1.3",
    },
  },
  "packages": {
    "control": ["control@workspace:libs/control"],

    "lib": ["lib@workspace:libs/lib"],

    "ms": ["ms@2.1.3", "", {}, "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA=="],

    "control/ms": ["ms@file:vendor/ms", {}],
  }
}
`;
