export default `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

importers:

  .:
    dependencies:
      ts-api-utils:
        specifier: 1.4.3
        version: 1.4.3(typescript@5.4.5)
      type-fest:
        specifier: 4.20.0
        version: 4.20.0
      typescript:
        specifier: 5.4.5
        version: 5.4.5

packages:

  ts-api-utils@1.4.3:
    resolution: {integrity: sha512-i3eMG77UTMD0hZhgRS562pv83RC6ukSAC2GMNWc+9dieh/+jDM5u5YG+NHX6VNDRHQcHwmsTHctP9LhbC3WxVw==}
    engines: {node: '>=16'}
    peerDependencies:
      typescript: '>=4.2.0'

  type-fest@4.20.0:
    resolution: {integrity: sha512-MBh+PHUHHisjXf4tlx0CFWoMdjx8zCMLJHOjnV1prABYZFHqtFOyauCIK2/7w4oIfwkF8iNhLtnJEfVY2vn3iw==}
    engines: {node: '>=16'}

  typescript@5.4.5:
    resolution: {integrity: sha512-vcI4UpRgg81oIRUFwR0WSIHKt11nJ7SAVlYNIu+QpqeyXP+gpQJy/Z4+F0aGxSE4MqwjyXvW/TzgkLAx2AGHwQ==}
    engines: {node: '>=14.17'}
    hasBin: true

snapshots:

  ts-api-utils@1.4.3(typescript@5.4.5):
    dependencies:
      typescript: 5.4.5

  type-fest@4.20.0: {}

  typescript@5.4.5: {}
`;
