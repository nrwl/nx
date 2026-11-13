export default `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

importers:

  .:
    dependencies:
      alias:
        specifier: file:./vendor/real
        version: real@file:vendor/real
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

  real@file:vendor/real:
    resolution: {directory: vendor/real, type: directory}

  ttar@file:vendor/ttar-1.0.0.tgz:
    resolution: {integrity: sha512-kO3A9JVF6tDNIrS1KO7tDN+Ly8UNMqAxClR/GzXBP2owH0fsPP9QmOzT03NF8t5UqwDsbPu/wnqt9oilIN5dPQ==, tarball: file:vendor/ttar-1.0.0.tgz}
    version: 1.0.0

  vend@file:vendor/vend:
    resolution: {directory: vendor/vend, type: directory}

  vtar@file:vendor/vtar-1.0.0.tgz:
    resolution: {integrity: sha512-ryhoLLJAIwkLA1dIXC5lCi3K73koaKB0oiMiZEBBCxRZ/44892q/75qPxZnVZgGcdZbweilCvpbzGdA0s8QqOg==, tarball: file:vendor/vtar-1.0.0.tgz}
    version: 1.0.0

snapshots:

  ignored@file:vendor/ignored: {}

  real@file:vendor/real: {}

  ttar@file:vendor/ttar-1.0.0.tgz: {}

  vend@file:vendor/vend:
    dependencies:
      ttar: file:vendor/ttar-1.0.0.tgz

  vtar@file:vendor/vtar-1.0.0.tgz: {}
`;
