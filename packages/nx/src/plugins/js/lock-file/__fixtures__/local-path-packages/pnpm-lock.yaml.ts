export default `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

importers:

  .:
    dependencies:
      ignored:
        specifier: file:./vendor/ignored
        version: file:vendor/ignored
      lnk:
        specifier: link:vendor/lnk
        version: link:vendor/lnk
      vend:
        specifier: file:./vendor/vend
        version: file:vendor/vend
      vtar:
        specifier: file:./vendor/vtar-1.0.0.tgz
        version: file:vendor/vtar-1.0.0.tgz

packages:

  ignored@file:vendor/ignored:
    resolution: {directory: vendor/ignored, type: directory}

  ttar@file:vendor/ttar-1.0.0.tgz:
    resolution: {integrity: sha512-vUBRCjoXfRDJSPRNadts6ZFlwSz5G0jNyodbIq3NX45es/e8u7qtf22H9OuAAlsvDfM+XdUjeewGO8XlwKr60w==, tarball: file:vendor/ttar-1.0.0.tgz}
    version: 1.0.0

  vend@file:vendor/vend:
    resolution: {directory: vendor/vend, type: directory}

  vtar@file:vendor/vtar-1.0.0.tgz:
    resolution: {integrity: sha512-6MzKQuGxoFB6HuUzK6Pe/EwCIeH8cOST39I8boWeLVo0UaJ7GoX6rWFFyLkKmuWb6qRYS7nhSOLGX+mJaTs0gw==, tarball: file:vendor/vtar-1.0.0.tgz}
    version: 1.0.0

snapshots:

  ignored@file:vendor/ignored: {}

  ttar@file:vendor/ttar-1.0.0.tgz: {}

  vend@file:vendor/vend:
    dependencies:
      ttar: file:vendor/ttar-1.0.0.tgz

  vtar@file:vendor/vtar-1.0.0.tgz: {}
`;
