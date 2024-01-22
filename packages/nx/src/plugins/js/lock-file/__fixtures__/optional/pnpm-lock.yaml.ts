export default `lockfileVersion: 5.4

specifiers:
  ssh2: 1.11.0

dependencies:
  ssh2: 1.11.0

packages:

  /asn1/0.2.6:
    resolution: {integrity: sha512-ix/FxPn0MDjeyJ7i/yoHGFt/EX6LyNbxSEhPPXODPL+KB0VPk86UYfL0lMdy+KCnv+fmvIzySwaK5COwqVbWTQ==}
    dependencies:
      safer-buffer: 2.1.2
    dev: false

  /bcrypt-pbkdf/1.0.2:
    resolution: {integrity: sha512-qeFIXtP4MSoi6NLqO12WfqARWWuCKi2Rn/9hJLEmtB5yTNr9DqFWkJRCf2qShWzPeAMRnOgCrq0sg/KLv5ES9w==}
    dependencies:
      tweetnacl: 0.14.5
    dev: false

  /buildcheck/0.0.3:
    resolution: {integrity: sha512-pziaA+p/wdVImfcbsZLNF32EiWyujlQLwolMqUQE8xpKNOH7KmZQaY8sXN7DGOEzPAElo9QTaeNRfGnf3iOJbA==}
    engines: {node: '>=10.0.0'}
    dev: false
    optional: true

  /cpu-features/0.0.4:
    resolution: {integrity: sha512-fKiZ/zp1mUwQbnzb9IghXtHtDoTMtNeb8oYGx6kX2SYfhnG0HNdBEBIzB9b5KlXu5DQPhfy3mInbBxFcgwAr3A==}
    engines: {node: '>=10.0.0'}
    requiresBuild: true
    dependencies:
      buildcheck: 0.0.3
      nan: 2.17.0
    dev: false
    optional: true

  /nan/2.17.0:
    resolution: {integrity: sha512-2ZTgtl0nJsO0KQCjEpxcIr5D+Yv90plTitZt9JBfQvVJDS5seMl3FOvsh3+9CoYWXf/1l5OaZzzF6nDm4cagaQ==}
    dev: false
    optional: true

  /safer-buffer/2.1.2:
    resolution: {integrity: sha512-YZo3K82SD7Riyi0E1EQPojLz7kpepnSQI9IyPbHHg1XXXevb5dJI7tpyN2ADxGcQbHG7vcyRHk0cbwqcQriUtg==}
    dev: false

  /ssh2/1.11.0:
    resolution: {integrity: sha512-nfg0wZWGSsfUe/IBJkXVll3PEZ//YH2guww+mP88gTpuSU4FtZN7zu9JoeTGOyCNx2dTDtT9fOpWwlzyj4uOOw==}
    engines: {node: '>=10.16.0'}
    requiresBuild: true
    dependencies:
      asn1: 0.2.6
      bcrypt-pbkdf: 1.0.2
    optionalDependencies:
      cpu-features: 0.0.4
      nan: 2.17.0
    dev: false

  /tweetnacl/0.14.5:
    resolution: {integrity: sha512-KXXFFdAbFXY4geFIwoyNK+f5Z1b7swfXABfL7HXCmoIWMKU3dmS26672A4EeQtDzLKy7SXmfBu51JolvEKwtGA==}
    dev: false
`;
