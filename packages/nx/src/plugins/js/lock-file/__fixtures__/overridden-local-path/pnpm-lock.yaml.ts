export default `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

overrides:
  lib>ms: 2.1.3

importers:

  .:
    dependencies:
      ms:
        specifier: 2.1.3
        version: 2.1.3

  libs/control:
    dependencies:
      ms:
        specifier: file:../../vendor/ms
        version: file:vendor/ms

  libs/lib:
    dependencies:
      ms:
        specifier: 2.1.3
        version: 2.1.3

packages:

  ms@2.1.3:
    resolution: {integrity: sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==}

  ms@file:vendor/ms:
    resolution: {directory: vendor/ms, type: directory}

snapshots:

  ms@2.1.3: {}

  ms@file:vendor/ms: {}
`;
