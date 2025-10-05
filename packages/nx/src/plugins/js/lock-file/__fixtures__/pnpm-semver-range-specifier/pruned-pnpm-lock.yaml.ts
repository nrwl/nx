export default `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

importers:

  .:
    dependencies:
      lodash:
        specifier: ^4.17.0
        version: 4.17.21
      semver:
        specifier: ^7.3.0
        version: 7.7.2
      tmp:
        specifier: ^0.2.3
        version: 0.2.3

packages:

  lodash@4.17.21:
    resolution: {integrity: sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg==}

  semver@7.7.2:
    resolution: {integrity: sha512-RF0Fw+rO5AMf9MAyaRXI4AV0Ulj5lMHqVxxdSgiVbixSCXoEmmX/jk0CuJw4+3SqroYO9VoUh+HcuJivvtJemA==}
    engines: {node: '>=10'}
    hasBin: true

  tmp@0.2.3:
    resolution: {integrity: sha512-nZD7m9iCPC5g0pYmcaxogYKggSfLsdxl8of3Q/oIbqCqLLIO9IAF0GWjX1z9NZRHPiXv8Wex4yDCaZsgEw0Y8w==}
    engines: {node: '>=14.14'}

snapshots:

  lodash@4.17.21: {}

  semver@7.7.2: {}

  tmp@0.2.3: {}
`;
