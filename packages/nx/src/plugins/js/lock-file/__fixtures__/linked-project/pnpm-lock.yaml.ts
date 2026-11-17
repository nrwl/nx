export default `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

importers:

  .: {}

  apps/a:
    dependencies:
      x:
        specifier: link:../../libs/x/dist
        version: link:../../libs/x/dist

  apps/b:
    dependencies:
      x:
        specifier: link:../../vendor/x
        version: link:../../vendor/x
`;
