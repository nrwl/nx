export default `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

importers:

  .:
    devDependencies:
      '@nx/js':
        specifier: 21.1.2
        version: 21.1.2(@babel/traverse@7.27.4)(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17))(nx@21.1.2(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17)))
      '@nx/webpack':
        specifier: ^21.1.2
        version: 21.1.3(@babel/traverse@7.27.4)(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17))(nx@21.1.2(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17)))(typescript@5.7.3)
      '@swc-node/register':
        specifier: ~1.9.1
        version: 1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3)
      '@swc/core':
        specifier: ~1.5.7
        version: 1.5.29(@swc/helpers@0.5.17)
      '@swc/helpers':
        specifier: ~0.5.11
        version: 0.5.17
      '@types/node':
        specifier: 18.16.9
        version: 18.16.9
      nx:
        specifier: 21.1.2
        version: 21.1.2(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17))
      typescript:
        specifier: ~5.7.2
        version: 5.7.3

  app:
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

  '@adobe/css-tools@4.3.3':
    resolution: {integrity: sha512-rE0Pygv0sEZ4vBWHlAgJLGDU7Pm8xoO6p3wsEceb7GYAjScrOHpEo8KK/eVkAcnSM+slAEtXjA2JpdjLp4fJQQ==}

  '@ampproject/remapping@2.3.0':
    resolution: {integrity: sha512-30iZtAPgz+LTIYoeivqYo853f02jBYSd5uGnGpkFV0M3xOt9aN73erkgYAmZU43x4VfqcnLxW9Kpg3R5LC4YYw==}
    engines: {node: '>=6.0.0'}

  '@babel/code-frame@7.27.1':
    resolution: {integrity: sha512-cjQ7ZlQ0Mv3b47hABuTevyTuYN4i+loJKGeV9flcCgIK37cCXRh+L1bd3iBHlynerhQ7BhCkn2BPbQUL+rGqFg==}
    engines: {node: '>=6.9.0'}

  '@babel/compat-data@7.27.5':
    resolution: {integrity: sha512-KiRAp/VoJaWkkte84TvUd9qjdbZAdiqyvMxrGl1N6vzFogKmaLgoM3L1kgtLicp2HP5fBJS8JrZKLVIZGVJAVg==}
    engines: {node: '>=6.9.0'}

  '@babel/core@7.27.4':
    resolution: {integrity: sha512-bXYxrXFubeYdvB0NhD/NBB3Qi6aZeV20GOWVI47t2dkecCEoneR4NPVcb7abpXDEvejgrUfFtG6vG/zxAKmg+g==}
    engines: {node: '>=6.9.0'}

  '@babel/generator@7.27.5':
    resolution: {integrity: sha512-ZGhA37l0e/g2s1Cnzdix0O3aLYm66eF8aufiVteOgnwxgnRP8GoyMj7VWsgWnQbVKXyge7hqrFh2K2TQM6t1Hw==}
    engines: {node: '>=6.9.0'}

  '@babel/helper-annotate-as-pure@7.27.3':
    resolution: {integrity: sha512-fXSwMQqitTGeHLBC08Eq5yXz2m37E4pJX1qAU1+2cNedz/ifv/bVXft90VeSav5nFO61EcNgwr0aJxbyPaWBPg==}
    engines: {node: '>=6.9.0'}

  '@babel/helper-compilation-targets@7.27.2':
    resolution: {integrity: sha512-2+1thGUUWWjLTYTHZWK1n8Yga0ijBz1XAhUXcKy81rd5g6yh7hGqMp45v7cadSbEHc9G3OTv45SyneRN3ps4DQ==}
    engines: {node: '>=6.9.0'}

  '@babel/helper-create-class-features-plugin@7.27.1':
    resolution: {integrity: sha512-QwGAmuvM17btKU5VqXfb+Giw4JcN0hjuufz3DYnpeVDvZLAObloM77bhMXiqry3Iio+Ai4phVRDwl6WU10+r5A==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0

  '@babel/helper-create-regexp-features-plugin@7.27.1':
    resolution: {integrity: sha512-uVDC72XVf8UbrH5qQTc18Agb8emwjTiZrQE11Nv3CuBEZmVvTwwE9CBUEvHku06gQCAyYf8Nv6ja1IN+6LMbxQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0

  '@babel/helper-define-polyfill-provider@0.6.4':
    resolution: {integrity: sha512-jljfR1rGnXXNWnmQg2K3+bvhkxB51Rl32QRaOTuwwjviGrHzIbSc8+x9CpraDtbT7mfyjXObULP4w/adunNwAw==}
    peerDependencies:
      '@babel/core': ^7.4.0 || ^8.0.0-0 <8.0.0

  '@babel/helper-member-expression-to-functions@7.27.1':
    resolution: {integrity: sha512-E5chM8eWjTp/aNoVpcbfM7mLxu9XGLWYise2eBKGQomAk/Mb4XoxyqXTZbuTohbsl8EKqdlMhnDI2CCLfcs9wA==}
    engines: {node: '>=6.9.0'}

  '@babel/helper-module-imports@7.27.1':
    resolution: {integrity: sha512-0gSFWUPNXNopqtIPQvlD5WgXYI5GY2kP2cCvoT8kczjbfcfuIljTbcWrulD1CIPIX2gt1wghbDy08yE1p+/r3w==}
    engines: {node: '>=6.9.0'}

  '@babel/helper-module-transforms@7.27.3':
    resolution: {integrity: sha512-dSOvYwvyLsWBeIRyOeHXp5vPj5l1I011r52FM1+r1jCERv+aFXYk4whgQccYEGYxK2H3ZAIA8nuPkQ0HaUo3qg==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0

  '@babel/helper-optimise-call-expression@7.27.1':
    resolution: {integrity: sha512-URMGH08NzYFhubNSGJrpUEphGKQwMQYBySzat5cAByY1/YgIRkULnIy3tAMeszlL/so2HbeilYloUmSpd7GdVw==}
    engines: {node: '>=6.9.0'}

  '@babel/helper-plugin-utils@7.27.1':
    resolution: {integrity: sha512-1gn1Up5YXka3YYAHGKpbideQ5Yjf1tDa9qYcgysz+cNCXukyLl6DjPXhD3VRwSb8c0J9tA4b2+rHEZtc6R0tlw==}
    engines: {node: '>=6.9.0'}

  '@babel/helper-remap-async-to-generator@7.27.1':
    resolution: {integrity: sha512-7fiA521aVw8lSPeI4ZOD3vRFkoqkJcS+z4hFo82bFSH/2tNd6eJ5qCVMS5OzDmZh/kaHQeBaeyxK6wljcPtveA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0

  '@babel/helper-replace-supers@7.27.1':
    resolution: {integrity: sha512-7EHz6qDZc8RYS5ElPoShMheWvEgERonFCs7IAonWLLUTXW59DP14bCZt89/GKyreYn8g3S83m21FelHKbeDCKA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0

  '@babel/helper-skip-transparent-expression-wrappers@7.27.1':
    resolution: {integrity: sha512-Tub4ZKEXqbPjXgWLl2+3JpQAYBJ8+ikpQ2Ocj/q/r0LwE3UhENh7EUabyHjz2kCEsrRY83ew2DQdHluuiDQFzg==}
    engines: {node: '>=6.9.0'}

  '@babel/helper-string-parser@7.27.1':
    resolution: {integrity: sha512-qMlSxKbpRlAridDExk92nSobyDdpPijUq2DW6oDnUqd0iOGxmQjyqhMIihI9+zv4LPyZdRje2cavWPbCbWm3eA==}
    engines: {node: '>=6.9.0'}

  '@babel/helper-validator-identifier@7.27.1':
    resolution: {integrity: sha512-D2hP9eA+Sqx1kBZgzxZh0y1trbuU+JoDkiEwqhQ36nodYqJwyEIhPSdMNd7lOm/4io72luTPWH20Yda0xOuUow==}
    engines: {node: '>=6.9.0'}

  '@babel/helper-validator-option@7.27.1':
    resolution: {integrity: sha512-YvjJow9FxbhFFKDSuFnVCe2WxXk1zWc22fFePVNEaWJEu8IrZVlda6N0uHwzZrUM1il7NC9Mlp4MaJYbYd9JSg==}
    engines: {node: '>=6.9.0'}

  '@babel/helper-wrap-function@7.27.1':
    resolution: {integrity: sha512-NFJK2sHUvrjo8wAU/nQTWU890/zB2jj0qBcCbZbbf+005cAsv6tMjXz31fBign6M5ov1o0Bllu+9nbqkfsjjJQ==}
    engines: {node: '>=6.9.0'}

  '@babel/helpers@7.27.6':
    resolution: {integrity: sha512-muE8Tt8M22638HU31A3CgfSUciwz1fhATfoVai05aPXGor//CdWDCbnlY1yvBPo07njuVOCNGCSp/GTt12lIug==}
    engines: {node: '>=6.9.0'}

  '@babel/parser@7.27.5':
    resolution: {integrity: sha512-OsQd175SxWkGlzbny8J3K8TnnDD0N3lrIUtB92xwyRpzaenGZhxDvxN/JgU00U3CDZNj9tPuDJ5H0WS4Nt3vKg==}
    engines: {node: '>=6.0.0'}
    hasBin: true

  '@babel/plugin-bugfix-firefox-class-in-computed-class-key@7.27.1':
    resolution: {integrity: sha512-QPG3C9cCVRQLxAVwmefEmwdTanECuUBMQZ/ym5kiw3XKCGA7qkuQLcjWWHcrD/GKbn/WmJwaezfuuAOcyKlRPA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0

  '@babel/plugin-bugfix-safari-class-field-initializer-scope@7.27.1':
    resolution: {integrity: sha512-qNeq3bCKnGgLkEXUuFry6dPlGfCdQNZbn7yUAPCInwAJHMU7THJfrBSozkcWq5sNM6RcF3S8XyQL2A52KNR9IA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0

  '@babel/plugin-bugfix-safari-id-destructuring-collision-in-function-expression@7.27.1':
    resolution: {integrity: sha512-g4L7OYun04N1WyqMNjldFwlfPCLVkgB54A/YCXICZYBsvJJE3kByKv9c9+R/nAfmIfjl2rKYLNyMHboYbZaWaA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0

  '@babel/plugin-bugfix-v8-spread-parameters-in-optional-chaining@7.27.1':
    resolution: {integrity: sha512-oO02gcONcD5O1iTLi/6frMJBIwWEHceWGSGqrpCmEL8nogiS6J9PBlE48CaK20/Jx1LuRml9aDftLgdjXT8+Cw==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.13.0

  '@babel/plugin-bugfix-v8-static-class-fields-redefine-readonly@7.27.1':
    resolution: {integrity: sha512-6BpaYGDavZqkI6yT+KSPdpZFfpnd68UKXbcjI9pJ13pvHhPrCKWOOLp+ysvMeA+DxnhuPpgIaRpxRxo5A9t5jw==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0

  '@babel/plugin-proposal-decorators@7.27.1':
    resolution: {integrity: sha512-DTxe4LBPrtFdsWzgpmbBKevg3e9PBy+dXRt19kSbucbZvL2uqtdqwwpluL1jfxYE0wIDTFp1nTy/q6gNLsxXrg==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-proposal-private-property-in-object@7.21.0-placeholder-for-preset-env.2':
    resolution: {integrity: sha512-SOSkfJDddaM7mak6cPEpswyTRnuRltl429hMraQEglW+OkovnCzsiszTmsrlY//qLFjCpQDFRvjdm2wA5pPm9w==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-syntax-decorators@7.27.1':
    resolution: {integrity: sha512-YMq8Z87Lhl8EGkmb0MwYkt36QnxC+fzCgrl66ereamPlYToRpIk5nUjKUY3QKLWq8mwUB1BgbeXcTJhZOCDg5A==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-syntax-import-assertions@7.27.1':
    resolution: {integrity: sha512-UT/Jrhw57xg4ILHLFnzFpPDlMbcdEicaAtjPQpbj9wa8T4r5KVWCimHcL/460g8Ht0DMxDyjsLgiWSkVjnwPFg==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-syntax-import-attributes@7.27.1':
    resolution: {integrity: sha512-oFT0FrKHgF53f4vOsZGi2Hh3I35PfSmVs4IBFLFj4dnafP+hIWDLg3VyKmUHfLoLHlyxY4C7DGtmHuJgn+IGww==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-syntax-jsx@7.27.1':
    resolution: {integrity: sha512-y8YTNIeKoyhGd9O0Jiyzyyqk8gdjnumGTQPsz0xOZOQ2RmkVJeZ1vmmfIvFEKqucBG6axJGBZDE/7iI5suUI/w==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-syntax-typescript@7.27.1':
    resolution: {integrity: sha512-xfYCBMxveHrRMnAWl1ZlPXOZjzkN82THFvLhQhFXFt81Z5HnN+EtUkZhv/zcKpmT3fzmWZB0ywiBrbC3vogbwQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-syntax-unicode-sets-regex@7.18.6':
    resolution: {integrity: sha512-727YkEAPwSIQTv5im8QHz3upqp92JTWhidIC81Tdx4VJYIte/VndKf1qKrfnnhPLiPghStWfvC/iFaMCQu7Nqg==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0

  '@babel/plugin-transform-arrow-functions@7.27.1':
    resolution: {integrity: sha512-8Z4TGic6xW70FKThA5HYEKKyBpOOsucTOD1DjU3fZxDg+K3zBJcXMFnt/4yQiZnf5+MiOMSXQ9PaEK/Ilh1DeA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-async-generator-functions@7.27.1':
    resolution: {integrity: sha512-eST9RrwlpaoJBDHShc+DS2SG4ATTi2MYNb4OxYkf3n+7eb49LWpnS+HSpVfW4x927qQwgk8A2hGNVaajAEw0EA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-async-to-generator@7.27.1':
    resolution: {integrity: sha512-NREkZsZVJS4xmTr8qzE5y8AfIPqsdQfRuUiLRTEzb7Qii8iFWCyDKaUV2c0rCuh4ljDZ98ALHP/PetiBV2nddA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-block-scoped-functions@7.27.1':
    resolution: {integrity: sha512-cnqkuOtZLapWYZUYM5rVIdv1nXYuFVIltZ6ZJ7nIj585QsjKM5dhL2Fu/lICXZ1OyIAFc7Qy+bvDAtTXqGrlhg==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-block-scoping@7.27.5':
    resolution: {integrity: sha512-JF6uE2s67f0y2RZcm2kpAUEbD50vH62TyWVebxwHAlbSdM49VqPz8t4a1uIjp4NIOIZ4xzLfjY5emt/RCyC7TQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-class-properties@7.27.1':
    resolution: {integrity: sha512-D0VcalChDMtuRvJIu3U/fwWjf8ZMykz5iZsg77Nuj821vCKI3zCyRLwRdWbsuJ/uRwZhZ002QtCqIkwC/ZkvbA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-class-static-block@7.27.1':
    resolution: {integrity: sha512-s734HmYU78MVzZ++joYM+NkJusItbdRcbm+AGRgJCt3iA+yux0QpD9cBVdz3tKyrjVYWRl7j0mHSmv4lhV0aoA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.12.0

  '@babel/plugin-transform-classes@7.27.1':
    resolution: {integrity: sha512-7iLhfFAubmpeJe/Wo2TVuDrykh/zlWXLzPNdL0Jqn/Xu8R3QQ8h9ff8FQoISZOsw74/HFqFI7NX63HN7QFIHKA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-computed-properties@7.27.1':
    resolution: {integrity: sha512-lj9PGWvMTVksbWiDT2tW68zGS/cyo4AkZ/QTp0sQT0mjPopCmrSkzxeXkznjqBxzDI6TclZhOJbBmbBLjuOZUw==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-destructuring@7.27.3':
    resolution: {integrity: sha512-s4Jrok82JpiaIprtY2nHsYmrThKvvwgHwjgd7UMiYhZaN0asdXNLr0y+NjTfkA7SyQE5i2Fb7eawUOZmLvyqOA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-dotall-regex@7.27.1':
    resolution: {integrity: sha512-gEbkDVGRvjj7+T1ivxrfgygpT7GUd4vmODtYpbs0gZATdkX8/iSnOtZSxiZnsgm1YjTgjI6VKBGSJJevkrclzw==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-duplicate-keys@7.27.1':
    resolution: {integrity: sha512-MTyJk98sHvSs+cvZ4nOauwTTG1JeonDjSGvGGUNHreGQns+Mpt6WX/dVzWBHgg+dYZhkC4X+zTDfkTU+Vy9y7Q==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-duplicate-named-capturing-groups-regex@7.27.1':
    resolution: {integrity: sha512-hkGcueTEzuhB30B3eJCbCYeCaaEQOmQR0AdvzpD4LoN0GXMWzzGSuRrxR2xTnCrvNbVwK9N6/jQ92GSLfiZWoQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0

  '@babel/plugin-transform-dynamic-import@7.27.1':
    resolution: {integrity: sha512-MHzkWQcEmjzzVW9j2q8LGjwGWpG2mjwaaB0BNQwst3FIjqsg8Ct/mIZlvSPJvfi9y2AC8mi/ktxbFVL9pZ1I4A==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-exponentiation-operator@7.27.1':
    resolution: {integrity: sha512-uspvXnhHvGKf2r4VVtBpeFnuDWsJLQ6MF6lGJLC89jBR1uoVeqM416AZtTuhTezOfgHicpJQmoD5YUakO/YmXQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-export-namespace-from@7.27.1':
    resolution: {integrity: sha512-tQvHWSZ3/jH2xuq/vZDy0jNn+ZdXJeM8gHvX4lnJmsc3+50yPlWdZXIc5ay+umX+2/tJIqHqiEqcJvxlmIvRvQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-for-of@7.27.1':
    resolution: {integrity: sha512-BfbWFFEJFQzLCQ5N8VocnCtA8J1CLkNTe2Ms2wocj75dd6VpiqS5Z5quTYcUoo4Yq+DN0rtikODccuv7RU81sw==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-function-name@7.27.1':
    resolution: {integrity: sha512-1bQeydJF9Nr1eBCMMbC+hdwmRlsv5XYOMu03YSWFwNs0HsAmtSxxF1fyuYPqemVldVyFmlCU7w8UE14LupUSZQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-json-strings@7.27.1':
    resolution: {integrity: sha512-6WVLVJiTjqcQauBhn1LkICsR2H+zm62I3h9faTDKt1qP4jn2o72tSvqMwtGFKGTpojce0gJs+76eZ2uCHRZh0Q==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-literals@7.27.1':
    resolution: {integrity: sha512-0HCFSepIpLTkLcsi86GG3mTUzxV5jpmbv97hTETW3yzrAij8aqlD36toB1D0daVFJM8NK6GvKO0gslVQmm+zZA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-logical-assignment-operators@7.27.1':
    resolution: {integrity: sha512-SJvDs5dXxiae4FbSL1aBJlG4wvl594N6YEVVn9e3JGulwioy6z3oPjx/sQBO3Y4NwUu5HNix6KJ3wBZoewcdbw==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-member-expression-literals@7.27.1':
    resolution: {integrity: sha512-hqoBX4dcZ1I33jCSWcXrP+1Ku7kdqXf1oeah7ooKOIiAdKQ+uqftgCFNOSzA5AMS2XIHEYeGFg4cKRCdpxzVOQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-modules-amd@7.27.1':
    resolution: {integrity: sha512-iCsytMg/N9/oFq6n+gFTvUYDZQOMK5kEdeYxmxt91fcJGycfxVP9CnrxoliM0oumFERba2i8ZtwRUCMhvP1LnA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-modules-commonjs@7.27.1':
    resolution: {integrity: sha512-OJguuwlTYlN0gBZFRPqwOGNWssZjfIUdS7HMYtN8c1KmwpwHFBwTeFZrg9XZa+DFTitWOW5iTAG7tyCUPsCCyw==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-modules-systemjs@7.27.1':
    resolution: {integrity: sha512-w5N1XzsRbc0PQStASMksmUeqECuzKuTJer7kFagK8AXgpCMkeDMO5S+aaFb7A51ZYDF7XI34qsTX+fkHiIm5yA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-modules-umd@7.27.1':
    resolution: {integrity: sha512-iQBE/xC5BV1OxJbp6WG7jq9IWiD+xxlZhLrdwpPkTX3ydmXdvoCpyfJN7acaIBZaOqTfr76pgzqBJflNbeRK+w==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-named-capturing-groups-regex@7.27.1':
    resolution: {integrity: sha512-SstR5JYy8ddZvD6MhV0tM/j16Qds4mIpJTOd1Yu9J9pJjH93bxHECF7pgtc28XvkzTD6Pxcm/0Z73Hvk7kb3Ng==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0

  '@babel/plugin-transform-new-target@7.27.1':
    resolution: {integrity: sha512-f6PiYeqXQ05lYq3TIfIDu/MtliKUbNwkGApPUvyo6+tc7uaR4cPjPe7DFPr15Uyycg2lZU6btZ575CuQoYh7MQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-nullish-coalescing-operator@7.27.1':
    resolution: {integrity: sha512-aGZh6xMo6q9vq1JGcw58lZ1Z0+i0xB2x0XaauNIUXd6O1xXc3RwoWEBlsTQrY4KQ9Jf0s5rgD6SiNkaUdJegTA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-numeric-separator@7.27.1':
    resolution: {integrity: sha512-fdPKAcujuvEChxDBJ5c+0BTaS6revLV7CJL08e4m3de8qJfNIuCc2nc7XJYOjBoTMJeqSmwXJ0ypE14RCjLwaw==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-object-rest-spread@7.27.3':
    resolution: {integrity: sha512-7ZZtznF9g4l2JCImCo5LNKFHB5eXnN39lLtLY5Tg+VkR0jwOt7TBciMckuiQIOIW7L5tkQOCh3bVGYeXgMx52Q==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-object-super@7.27.1':
    resolution: {integrity: sha512-SFy8S9plRPbIcxlJ8A6mT/CxFdJx/c04JEctz4jf8YZaVS2px34j7NXRrlGlHkN/M2gnpL37ZpGRGVFLd3l8Ng==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-optional-catch-binding@7.27.1':
    resolution: {integrity: sha512-txEAEKzYrHEX4xSZN4kJ+OfKXFVSWKB2ZxM9dpcE3wT7smwkNmXo5ORRlVzMVdJbD+Q8ILTgSD7959uj+3Dm3Q==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-optional-chaining@7.27.1':
    resolution: {integrity: sha512-BQmKPPIuc8EkZgNKsv0X4bPmOoayeu4F1YCwx2/CfmDSXDbp7GnzlUH+/ul5VGfRg1AoFPsrIThlEBj2xb4CAg==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-parameters@7.27.1':
    resolution: {integrity: sha512-018KRk76HWKeZ5l4oTj2zPpSh+NbGdt0st5S6x0pga6HgrjBOJb24mMDHorFopOOd6YHkLgOZ+zaCjZGPO4aKg==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-private-methods@7.27.1':
    resolution: {integrity: sha512-10FVt+X55AjRAYI9BrdISN9/AQWHqldOeZDUoLyif1Kn05a56xVBXb8ZouL8pZ9jem8QpXaOt8TS7RHUIS+GPA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-private-property-in-object@7.27.1':
    resolution: {integrity: sha512-5J+IhqTi1XPa0DXF83jYOaARrX+41gOewWbkPyjMNRDqgOCqdffGh8L3f/Ek5utaEBZExjSAzcyjmV9SSAWObQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-property-literals@7.27.1':
    resolution: {integrity: sha512-oThy3BCuCha8kDZ8ZkgOg2exvPYUlprMukKQXI1r1pJ47NCvxfkEy8vK+r/hT9nF0Aa4H1WUPZZjHTFtAhGfmQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-regenerator@7.27.5':
    resolution: {integrity: sha512-uhB8yHerfe3MWnuLAhEbeQ4afVoqv8BQsPqrTv7e/jZ9y00kJL6l9a/f4OWaKxotmjzewfEyXE1vgDJenkQ2/Q==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-regexp-modifiers@7.27.1':
    resolution: {integrity: sha512-TtEciroaiODtXvLZv4rmfMhkCv8jx3wgKpL68PuiPh2M4fvz5jhsA7697N1gMvkvr/JTF13DrFYyEbY9U7cVPA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0

  '@babel/plugin-transform-reserved-words@7.27.1':
    resolution: {integrity: sha512-V2ABPHIJX4kC7HegLkYoDpfg9PVmuWy/i6vUM5eGK22bx4YVFD3M5F0QQnWQoDs6AGsUWTVOopBiMFQgHaSkVw==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-runtime@7.27.4':
    resolution: {integrity: sha512-D68nR5zxU64EUzV8i7T3R5XP0Xhrou/amNnddsRQssx6GrTLdZl1rLxyjtVZBd+v/NVX4AbTPOB5aU8thAZV1A==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-shorthand-properties@7.27.1':
    resolution: {integrity: sha512-N/wH1vcn4oYawbJ13Y/FxcQrWk63jhfNa7jef0ih7PHSIHX2LB7GWE1rkPrOnka9kwMxb6hMl19p7lidA+EHmQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-spread@7.27.1':
    resolution: {integrity: sha512-kpb3HUqaILBJcRFVhFUs6Trdd4mkrzcGXss+6/mxUd273PfbWqSDHRzMT2234gIg2QYfAjvXLSquP1xECSg09Q==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-sticky-regex@7.27.1':
    resolution: {integrity: sha512-lhInBO5bi/Kowe2/aLdBAawijx+q1pQzicSgnkB6dUPc1+RC8QmJHKf2OjvU+NZWitguJHEaEmbV6VWEouT58g==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-template-literals@7.27.1':
    resolution: {integrity: sha512-fBJKiV7F2DxZUkg5EtHKXQdbsbURW3DZKQUWphDum0uRP6eHGGa/He9mc0mypL680pb+e/lDIthRohlv8NCHkg==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-typeof-symbol@7.27.1':
    resolution: {integrity: sha512-RiSILC+nRJM7FY5srIyc4/fGIwUhyDuuBSdWn4y6yT6gm652DpCHZjIipgn6B7MQ1ITOUnAKWixEUjQRIBIcLw==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-typescript@7.27.1':
    resolution: {integrity: sha512-Q5sT5+O4QUebHdbwKedFBEwRLb02zJ7r4A5Gg2hUoLuU3FjdMcyqcywqUrLCaDsFCxzokf7u9kuy7qz51YUuAg==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-unicode-escapes@7.27.1':
    resolution: {integrity: sha512-Ysg4v6AmF26k9vpfFuTZg8HRfVWzsh1kVfowA23y9j/Gu6dOuahdUVhkLqpObp3JIv27MLSii6noRnuKN8H0Mg==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-unicode-property-regex@7.27.1':
    resolution: {integrity: sha512-uW20S39PnaTImxp39O5qFlHLS9LJEmANjMG7SxIhap8rCHqu0Ik+tLEPX5DKmHn6CsWQ7j3lix2tFOa5YtL12Q==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-unicode-regex@7.27.1':
    resolution: {integrity: sha512-xvINq24TRojDuyt6JGtHmkVkrfVV3FPT16uytxImLeBZqW3/H52yN+kM1MGuyPkIQxrzKwPHs5U/MP3qKyzkGw==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/plugin-transform-unicode-sets-regex@7.27.1':
    resolution: {integrity: sha512-EtkOujbc4cgvb0mlpQefi4NTPBzhSIevblFevACNLUspmrALgmEBdL/XfnyyITfd8fKBZrZys92zOWcik7j9Tw==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0

  '@babel/preset-env@7.27.2':
    resolution: {integrity: sha512-Ma4zSuYSlGNRlCLO+EAzLnCmJK2vdstgv+n7aUP+/IKZrOfWHOJVdSJtuub8RzHTj3ahD37k5OKJWvzf16TQyQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/preset-modules@0.1.6-no-external-plugins':
    resolution: {integrity: sha512-HrcgcIESLm9aIR842yhJ5RWan/gebQUJ6E/E5+rf0y9o6oj7w0Br+sWuL6kEQ/o/AdfvR1Je9jG18/gnpwjEyA==}
    peerDependencies:
      '@babel/core': ^7.0.0-0 || ^8.0.0-0 <8.0.0

  '@babel/preset-typescript@7.27.1':
    resolution: {integrity: sha512-l7WfQfX0WK4M0v2RudjuQK4u99BS6yLHYEmdtVPP7lKV013zr9DygFuWNlnbvQ9LR+LS0Egz/XAvGx5U9MX0fQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  '@babel/runtime@7.27.6':
    resolution: {integrity: sha512-vbavdySgbTTrmFE+EsiqUTzlOr5bzlnJtUv9PynGCAKvfQqjIXbvFdumPM/GxMDfyuGMJaJAU6TO4zc1Jf1i8Q==}
    engines: {node: '>=6.9.0'}

  '@babel/template@7.27.2':
    resolution: {integrity: sha512-LPDZ85aEJyYSd18/DkjNh4/y1ntkE5KwUHWTiqgRxruuZL2F1yuHligVHLvcHY2vMHXttKFpJn6LwfI7cw7ODw==}
    engines: {node: '>=6.9.0'}

  '@babel/traverse@7.27.4':
    resolution: {integrity: sha512-oNcu2QbHqts9BtOWJosOVJapWjBDSxGCpFvikNR5TGDYDQf3JwpIoMzIKrvfoti93cLfPJEG4tH9SPVeyCGgdA==}
    engines: {node: '>=6.9.0'}

  '@babel/types@7.27.6':
    resolution: {integrity: sha512-ETyHEk2VHHvl9b9jZP5IHPavHYk57EhanlRRuae9XCpb/j5bDCbPPMOBfCWhnl/7EDJz0jEMCi/RhccCE8r1+Q==}
    engines: {node: '>=6.9.0'}

  '@bufbuild/protobuf@2.5.2':
    resolution: {integrity: sha512-foZ7qr0IsUBjzWIq+SuBLfdQCpJ1j8cTuNNT4owngTHoN5KsJb8L9t65fzz7SCeSWzescoOil/0ldqiL041ABg==}

  '@emnapi/core@1.4.3':
    resolution: {integrity: sha512-4m62DuCE07lw01soJwPiBGC0nAww0Q+RY70VZ+n49yDIO13yyinhbWCeNnaob0lakDtWQzSdtNWzJeOJt2ma+g==}

  '@emnapi/runtime@1.4.3':
    resolution: {integrity: sha512-pBPWdu6MLKROBX05wSNKcNb++m5Er+KQ9QkB+WVM+pW2Kx9hoSrVTnu3BdkI5eBLZoKu/J6mW/B6i6bJB2ytXQ==}

  '@emnapi/wasi-threads@1.0.2':
    resolution: {integrity: sha512-5n3nTJblwRi8LlXkJ9eBzu+kZR8Yxcc7ubakyQTFzPMtIhFpUBRbsnc2Dv88IZDIbCDlBiWrknhB4Lsz7mg6BA==}

  '@isaacs/cliui@8.0.2':
    resolution: {integrity: sha512-O8jcjabXaleOG9DQ0+ARXWZBTfnP4WNAqzuiJK7ll44AmxGKv/J2M4TPjxjY3znBCfvBXFzucm1twdyFybFqEA==}
    engines: {node: '>=12'}

  '@jest/schemas@29.6.3':
    resolution: {integrity: sha512-mo5j5X+jIZmJQveBKeS/clAueipV7KgiX1vMgCxam1RNYiqE1w62n0/tJJnHtjW8ZHcQco5gY85jA3mi0L+nSA==}
    engines: {node: ^14.15.0 || ^16.10.0 || >=18.0.0}

  '@jest/types@29.6.3':
    resolution: {integrity: sha512-u3UPsIilWKOM3F9CXtrG8LEJmNxwoCQC/XVj4IKYXvvpx7QIi/Kg1LI5uDmDpKlac62NUtX7eLjRh+jVZcLOzw==}
    engines: {node: ^14.15.0 || ^16.10.0 || >=18.0.0}

  '@jridgewell/gen-mapping@0.3.8':
    resolution: {integrity: sha512-imAbBGkb+ebQyxKgzv5Hu2nmROxoDOXHh80evxdoXNOrvAnVx7zimzc1Oo5h9RlfV4vPXaE2iM5pOFbvOCClWA==}
    engines: {node: '>=6.0.0'}

  '@jridgewell/resolve-uri@3.1.2':
    resolution: {integrity: sha512-bRISgCIjP20/tbWSPWMEi54QVPRZExkuD9lJL+UIxUKtwVJA8wW1Trb1jMs1RFXo1CBTNZ/5hpC9QvmKWdopKw==}
    engines: {node: '>=6.0.0'}

  '@jridgewell/set-array@1.2.1':
    resolution: {integrity: sha512-R8gLRTZeyp03ymzP/6Lil/28tGeGEzhx1q2k703KGWRAI1VdvPIXdG70VJc2pAMw3NA6JKL5hhFu1sJX0Mnn/A==}
    engines: {node: '>=6.0.0'}

  '@jridgewell/source-map@0.3.6':
    resolution: {integrity: sha512-1ZJTZebgqllO79ue2bm3rIGud/bOe0pP5BjSRCRxxYkEZS8STV7zN84UBbiYu7jy+eCKSnVIUgoWWE/tt+shMQ==}

  '@jridgewell/sourcemap-codec@1.5.0':
    resolution: {integrity: sha512-gv3ZRaISU3fjPAgNsriBRqGWQL6quFx04YMPW/zD8XMLsU32mhCCbfbO6KZFLjvYpCZ8zyDEgqsgf+PwPaM7GQ==}

  '@jridgewell/trace-mapping@0.3.25':
    resolution: {integrity: sha512-vNk6aEwybGtawWmy/PzwnGDOjCkLWSD2wqvjGGAgOAwCGWySYXfYoxt00IJkTF+8Lb57DwOb3Aa0o9CApepiYQ==}

  '@jsonjoy.com/base64@1.1.2':
    resolution: {integrity: sha512-q6XAnWQDIMA3+FTiOYajoYqySkO+JSat0ytXGSuRdq9uXE7o92gzuQwQM14xaCRlBLGq3v5miDGC4vkVTn54xA==}
    engines: {node: '>=10.0'}
    peerDependencies:
      tslib: '2'

  '@jsonjoy.com/json-pack@1.2.0':
    resolution: {integrity: sha512-io1zEbbYcElht3tdlqEOFxZ0dMTYrHz9iMf0gqn1pPjZFTCgM5R4R5IMA20Chb2UPYYsxjzs8CgZ7Nb5n2K2rA==}
    engines: {node: '>=10.0'}
    peerDependencies:
      tslib: '2'

  '@jsonjoy.com/util@1.6.0':
    resolution: {integrity: sha512-sw/RMbehRhN68WRtcKCpQOPfnH6lLP4GJfqzi3iYej8tnzpZUDr6UkZYJjcjjC0FWEJOJbyM3PTIwxucUmDG2A==}
    engines: {node: '>=10.0'}
    peerDependencies:
      tslib: '2'

  '@leichtgewicht/ip-codec@2.0.5':
    resolution: {integrity: sha512-Vo+PSpZG2/fmgmiNzYK9qWRh8h/CHrwD0mo1h1DzL4yzHNSfWYujGTYsWGreD000gcgmZ7K4Ys6Tx9TxtsKdDw==}

  '@napi-rs/wasm-runtime@0.2.4':
    resolution: {integrity: sha512-9zESzOO5aDByvhIAsOy9TbpZ0Ur2AJbUI7UT73kcUTS2mxAMHOBaa1st/jAymNoCtvrit99kkzT1FZuXVcgfIQ==}

  '@nodelib/fs.scandir@2.1.5':
    resolution: {integrity: sha512-vq24Bq3ym5HEQm2NKCr3yXDwjc7vTsEThRDnkp2DK9p1uqLR+DHurm/NOTo0KG7HYHU7eppKZj3MyqYuMBf62g==}
    engines: {node: '>= 8'}

  '@nodelib/fs.stat@2.0.5':
    resolution: {integrity: sha512-RkhPPp2zrqDAQA/2jNhnztcPAlv64XdhIp7a7454A5ovI7Bukxgt7MX7udwAu3zg1DcpPU0rz3VV1SeaqvY4+A==}
    engines: {node: '>= 8'}

  '@nodelib/fs.walk@1.2.8':
    resolution: {integrity: sha512-oGB+UxlgWcgQkgwo8GcEGwemoTFt3FIO9ababBmaGwXIoBKZ+GTy0pP185beGg7Llih/NSHSV2XAs1lnznocSg==}
    engines: {node: '>= 8'}

  '@nx/devkit@21.1.2':
    resolution: {integrity: sha512-1dgjwSsNDdp/VXydZnSfzfVwySEB3C9yjzeIw6+3+nRvZfH16a7ggZE7MF5sJTq4d+01hAgIDz3KyvGa6Jf73g==}
    peerDependencies:
      nx: 21.1.2

  '@nx/devkit@21.1.3':
    resolution: {integrity: sha512-NSNXdn+PaNoPcxAKIhnZUbOA91Jzgk68paZEiABzAhkvfmrE5jM6VDMT6sJZ8lHWocrf6QFnzAOon1R4MoBeZw==}
    peerDependencies:
      nx: 21.1.3

  '@nx/js@21.1.2':
    resolution: {integrity: sha512-ZF6Zf4Ys+RBvH0GoQHio94C/0N07Px/trAvseMuQ8PKc0tSkXycu/EBc1uAZQvgJThR5o3diAKtIQug77pPYMQ==}
    peerDependencies:
      verdaccio: ^6.0.5
    peerDependenciesMeta:
      verdaccio:
        optional: true

  '@nx/js@21.1.3':
    resolution: {integrity: sha512-pwn1tgWX8sxh+VKZRZl9VkabXkEyeELFCgkWS/on2Y1J6W2dMBcmyGuZAeLef2GkUNaR79VMWIqvPaK0JLyf4g==}
    peerDependencies:
      verdaccio: ^6.0.5
    peerDependenciesMeta:
      verdaccio:
        optional: true

  '@nx/nx-darwin-arm64@21.1.2':
    resolution: {integrity: sha512-9dO32jd+h7SrvQafJph6b7Bsmp2IotTE0w7dAGb4MGBQni3JWCXaxlMMpWUZXWW1pM5uIkFJO5AASW4UOI7w2w==}
    cpu: [arm64]
    os: [darwin]

  '@nx/nx-darwin-arm64@21.1.3':
    resolution: {integrity: sha512-gbBKQrw9ecjXHVs7Kwaht5Dip//NBCgmnkf3GGoA40ad3zyvHDe+MBWMxueRToUVW/mDPh8b5lvLbmFApiY6sQ==}
    cpu: [arm64]
    os: [darwin]

  '@nx/nx-darwin-x64@21.1.2':
    resolution: {integrity: sha512-5sf+4PRVg9pDVgD53NE1hoPz4lC8Ni34UovQsOrZgDvwU5mqPbIhTzVYRDH86i/086AcCvjT5tEt7rEcuRwlKw==}
    cpu: [x64]
    os: [darwin]

  '@nx/nx-darwin-x64@21.1.3':
    resolution: {integrity: sha512-yGDWqxwNty1BJcuvZlwGGravAhg8eIRMEIp2omfIxeyfZEVA4b7egwMCqczwU2Li/StNjTtzrUe1HPWgcCVAuQ==}
    cpu: [x64]
    os: [darwin]

  '@nx/nx-freebsd-x64@21.1.2':
    resolution: {integrity: sha512-E5HR44fimXlQuAgn/tP9esmvxbzt/92AIl0PBT6L3Juh/xYiXKWhda63H4+UNT8AcLRxVXwfZrGPuGCDs+7y/Q==}
    cpu: [x64]
    os: [freebsd]

  '@nx/nx-freebsd-x64@21.1.3':
    resolution: {integrity: sha512-vpZPfSQgNIQ0vmnQA26DlJKZog20ISdS14ir234mvCaJJFdlgWGcpyEOSCU3Vg+32Z/VsSx7kIkBwRhfEZ73Ag==}
    cpu: [x64]
    os: [freebsd]

  '@nx/nx-linux-arm-gnueabihf@21.1.2':
    resolution: {integrity: sha512-V4n6DE+r12gwJHFjZs+e2GmWYZdhpgA2DYWbsYWRYb1XQCNUg4vPzt+YFzWZ+K2o91k93EBnlLfrag7CqxUslw==}
    cpu: [arm]
    os: [linux]

  '@nx/nx-linux-arm-gnueabihf@21.1.3':
    resolution: {integrity: sha512-R2GzEyHvyree2m7w+e/MOZjUY/l99HbW4E/jJl5BBXRGEAnGTIx9fOxSDiOW5QK6U0oZb2YO2b565t+IC+7rBQ==}
    cpu: [arm]
    os: [linux]

  '@nx/nx-linux-arm64-gnu@21.1.2':
    resolution: {integrity: sha512-NFhsp27O+mS3r7PWLmJgyZy42WQ72c2pTQSpYfhaBbZPTI5DqBHdANa0sEPmV+ON24qkl5CZKvsmhzjsNmyW6A==}
    cpu: [arm64]
    os: [linux]

  '@nx/nx-linux-arm64-gnu@21.1.3':
    resolution: {integrity: sha512-TlFT0G5gO6ujdkT7KUmvS2bwurvpV3olQwchqW1rQwuZ1eEQ1GVDuyzg49UG7lgESYruFn2HRhBf4V+iaD8WIw==}
    cpu: [arm64]
    os: [linux]

  '@nx/nx-linux-arm64-musl@21.1.2':
    resolution: {integrity: sha512-BgS9npARwcnw+hoaRsbas6vdBAJRBAj5qSeL57LO8Dva+e/6PYqoNyVJ0BgJ98xPXDpzM/NnpeRsndQGpLyhDw==}
    cpu: [arm64]
    os: [linux]

  '@nx/nx-linux-arm64-musl@21.1.3':
    resolution: {integrity: sha512-YkdzrZ7p2Y0YpteRyT9lPKhfuz2t5rNFQ87x9WHK2/cFD6H6M42Fg2JldCPIVj2chN9liH+s5ougW5oPQpZyKw==}
    cpu: [arm64]
    os: [linux]

  '@nx/nx-linux-x64-gnu@21.1.2':
    resolution: {integrity: sha512-tjBINbymQgxnIlNK/m6B0P5eiGRSHSYPNkFdh3+sra80AP/ymHGLRxxZy702Ga2xg8RVr9zEvuXYHI+QBa1YmA==}
    cpu: [x64]
    os: [linux]

  '@nx/nx-linux-x64-gnu@21.1.3':
    resolution: {integrity: sha512-nnHxhakNCr4jR1y13g0yS/UOmn5aXkJ+ZA1R6jFQxIwLv3Ocy05i0ZvU7rPOtflluDberxEop8xzoiuEZXDa/w==}
    cpu: [x64]
    os: [linux]

  '@nx/nx-linux-x64-musl@21.1.2':
    resolution: {integrity: sha512-+0V0YAOWMh1wvpQZuayQ7y+sj2MhE3l7z0JMD9SX/4xv9zLOWGv+EiUmN/fGoU/mwsSkH2wTCo6G6quKF1E8jQ==}
    cpu: [x64]
    os: [linux]

  '@nx/nx-linux-x64-musl@21.1.3':
    resolution: {integrity: sha512-poPt/LnFbq54CA3PZ1af8wcdQ4VsWRuA9w1Q1/G1BhCfDUAVIOZ0mhH1NzFpPwCxgVZ1TbNCZWhV2qjVRwQtlw==}
    cpu: [x64]
    os: [linux]

  '@nx/nx-win32-arm64-msvc@21.1.2':
    resolution: {integrity: sha512-E+ECMQIMJ6R47BMW5YpDyOhTqczvFaL8k24umRkcvlRh3SraczyxBVPkYHDukDp7tCeIszc5EvdWc83C3W8U4w==}
    cpu: [arm64]
    os: [win32]

  '@nx/nx-win32-arm64-msvc@21.1.3':
    resolution: {integrity: sha512-gBSVMRkXRqxTKgj/dabAD1EaptROy64fEtlU1llPz/RtcJcVhIlDczBF/y2WSD6A72cSv6zF/F1n3NrekNSfBA==}
    cpu: [arm64]
    os: [win32]

  '@nx/nx-win32-x64-msvc@21.1.2':
    resolution: {integrity: sha512-J9rNTBOS7Ld6CybU/cou1Fg52AHSYsiwpZISM2RNM0XIoVSDk3Jsvh4OJgS2rvV0Sp/cgDg3ieOMAreekH+TKw==}
    cpu: [x64]
    os: [win32]

  '@nx/nx-win32-x64-msvc@21.1.3':
    resolution: {integrity: sha512-k3/1b2dLQjnWzrg2UqHDLCoaqEBx2SRgujjYCACRJ12vmYH2gTyFX2UPXikVbbpaTJNeXv8eaCzyCKhuvPK1sQ==}
    cpu: [x64]
    os: [win32]

  '@nx/webpack@21.1.3':
    resolution: {integrity: sha512-xrWio5Bg0bXrDsWiE54Y2XrajaLhIQBuKWUvkTb6rdn6n7yWC3pSdfAdMZ6MUtmJr6HMSBc8bFSb44IYXSMJ9Q==}

  '@nx/workspace@21.1.2':
    resolution: {integrity: sha512-I4e/X/GN0Vx3FDZv/7bFYmXfOPmcMI3cDO/rg+TqudsuxVM7tJ7+8jtwdpU4I2IEpI6oU9FZ7Fu9R2uNqL5rrQ==}

  '@nx/workspace@21.1.3':
    resolution: {integrity: sha512-SAObZmW1cx0hRddC2PCFWJBHpzdjsTGNArJta8iyzfrbP9KAxQd8jjDBZvXLpXU6YMOw0fLwm8YAD2E1xvIoyw==}

  '@parcel/watcher-android-arm64@2.5.1':
    resolution: {integrity: sha512-KF8+j9nNbUN8vzOFDpRMsaKBHZ/mcjEjMToVMJOhTozkDonQFFrRcfdLWn6yWKCmJKmdVxSgHiYvTCef4/qcBA==}
    engines: {node: '>= 10.0.0'}
    cpu: [arm64]
    os: [android]

  '@parcel/watcher-darwin-arm64@2.5.1':
    resolution: {integrity: sha512-eAzPv5osDmZyBhou8PoF4i6RQXAfeKL9tjb3QzYuccXFMQU0ruIc/POh30ePnaOyD1UXdlKguHBmsTs53tVoPw==}
    engines: {node: '>= 10.0.0'}
    cpu: [arm64]
    os: [darwin]

  '@parcel/watcher-darwin-x64@2.5.1':
    resolution: {integrity: sha512-1ZXDthrnNmwv10A0/3AJNZ9JGlzrF82i3gNQcWOzd7nJ8aj+ILyW1MTxVk35Db0u91oD5Nlk9MBiujMlwmeXZg==}
    engines: {node: '>= 10.0.0'}
    cpu: [x64]
    os: [darwin]

  '@parcel/watcher-freebsd-x64@2.5.1':
    resolution: {integrity: sha512-SI4eljM7Flp9yPuKi8W0ird8TI/JK6CSxju3NojVI6BjHsTyK7zxA9urjVjEKJ5MBYC+bLmMcbAWlZ+rFkLpJQ==}
    engines: {node: '>= 10.0.0'}
    cpu: [x64]
    os: [freebsd]

  '@parcel/watcher-linux-arm-glibc@2.5.1':
    resolution: {integrity: sha512-RCdZlEyTs8geyBkkcnPWvtXLY44BCeZKmGYRtSgtwwnHR4dxfHRG3gR99XdMEdQ7KeiDdasJwwvNSF5jKtDwdA==}
    engines: {node: '>= 10.0.0'}
    cpu: [arm]
    os: [linux]

  '@parcel/watcher-linux-arm-musl@2.5.1':
    resolution: {integrity: sha512-6E+m/Mm1t1yhB8X412stiKFG3XykmgdIOqhjWj+VL8oHkKABfu/gjFj8DvLrYVHSBNC+/u5PeNrujiSQ1zwd1Q==}
    engines: {node: '>= 10.0.0'}
    cpu: [arm]
    os: [linux]

  '@parcel/watcher-linux-arm64-glibc@2.5.1':
    resolution: {integrity: sha512-LrGp+f02yU3BN9A+DGuY3v3bmnFUggAITBGriZHUREfNEzZh/GO06FF5u2kx8x+GBEUYfyTGamol4j3m9ANe8w==}
    engines: {node: '>= 10.0.0'}
    cpu: [arm64]
    os: [linux]

  '@parcel/watcher-linux-arm64-musl@2.5.1':
    resolution: {integrity: sha512-cFOjABi92pMYRXS7AcQv9/M1YuKRw8SZniCDw0ssQb/noPkRzA+HBDkwmyOJYp5wXcsTrhxO0zq1U11cK9jsFg==}
    engines: {node: '>= 10.0.0'}
    cpu: [arm64]
    os: [linux]

  '@parcel/watcher-linux-x64-glibc@2.5.1':
    resolution: {integrity: sha512-GcESn8NZySmfwlTsIur+49yDqSny2IhPeZfXunQi48DMugKeZ7uy1FX83pO0X22sHntJ4Ub+9k34XQCX+oHt2A==}
    engines: {node: '>= 10.0.0'}
    cpu: [x64]
    os: [linux]

  '@parcel/watcher-linux-x64-musl@2.5.1':
    resolution: {integrity: sha512-n0E2EQbatQ3bXhcH2D1XIAANAcTZkQICBPVaxMeaCVBtOpBZpWJuf7LwyWPSBDITb7In8mqQgJ7gH8CILCURXg==}
    engines: {node: '>= 10.0.0'}
    cpu: [x64]
    os: [linux]

  '@parcel/watcher-win32-arm64@2.5.1':
    resolution: {integrity: sha512-RFzklRvmc3PkjKjry3hLF9wD7ppR4AKcWNzH7kXR7GUe0Igb3Nz8fyPwtZCSquGrhU5HhUNDr/mKBqj7tqA2Vw==}
    engines: {node: '>= 10.0.0'}
    cpu: [arm64]
    os: [win32]

  '@parcel/watcher-win32-ia32@2.5.1':
    resolution: {integrity: sha512-c2KkcVN+NJmuA7CGlaGD1qJh1cLfDnQsHjE89E60vUEMlqduHGCdCLJCID5geFVM0dOtA3ZiIO8BoEQmzQVfpQ==}
    engines: {node: '>= 10.0.0'}
    cpu: [ia32]
    os: [win32]

  '@parcel/watcher-win32-x64@2.5.1':
    resolution: {integrity: sha512-9lHBdJITeNR++EvSQVUcaZoWupyHfXe1jZvGZ06O/5MflPcuPLtEphScIBL+AiCWBO46tDSHzWyD0uDmmZqsgA==}
    engines: {node: '>= 10.0.0'}
    cpu: [x64]
    os: [win32]

  '@parcel/watcher@2.5.1':
    resolution: {integrity: sha512-dfUnCxiN9H4ap84DvD2ubjw+3vUNpstxa0TneY/Paat8a3R4uQZDLSvWjmznAY/DoahqTHl9V46HF/Zs3F29pg==}
    engines: {node: '>= 10.0.0'}

  '@phenomnomnominal/tsquery@5.0.1':
    resolution: {integrity: sha512-3nVv+e2FQwsW8Aw6qTU6f+1rfcJ3hrcnvH/mu9i8YhxO+9sqbOfpL8m6PbET5+xKOlz/VSbp0RoYWYCtIsnmuA==}
    peerDependencies:
      typescript: ^3 || ^4 || ^5

  '@pkgjs/parseargs@0.11.0':
    resolution: {integrity: sha512-+1VkjdD0QBLPodGrJUeqarH8VAIvQODIbwh9XpP5Syisf7YoQgsJKPNFoqqLQlu+VQ/tVSshMR6loPMn8U+dPg==}
    engines: {node: '>=14'}

  '@sinclair/typebox@0.27.8':
    resolution: {integrity: sha512-+Fj43pSMwJs4KRrH/938Uf+uAELIgVBmQzg/q1YG10djyfA3TnrU8N8XzqCh/okZdszqBQTZf96idMfE5lnwTA==}

  '@swc-node/core@1.13.3':
    resolution: {integrity: sha512-OGsvXIid2Go21kiNqeTIn79jcaX4l0G93X2rAnas4LFoDyA9wAwVK7xZdm+QsKoMn5Mus2yFLCc4OtX2dD/PWA==}
    engines: {node: '>= 10'}
    peerDependencies:
      '@swc/core': '>= 1.4.13'
      '@swc/types': '>= 0.1'

  '@swc-node/register@1.9.2':
    resolution: {integrity: sha512-BBjg0QNuEEmJSoU/++JOXhrjWdu3PTyYeJWsvchsI0Aqtj8ICkz/DqlwtXbmZVZ5vuDPpTfFlwDBZe81zgShMA==}
    peerDependencies:
      '@swc/core': '>= 1.4.13'
      typescript: '>= 4.3'

  '@swc-node/sourcemap-support@0.5.1':
    resolution: {integrity: sha512-JxIvIo/Hrpv0JCHSyRpetAdQ6lB27oFYhv0PKCNf1g2gUXOjpeR1exrXccRxLMuAV5WAmGFBwRnNOJqN38+qtg==}

  '@swc/core-darwin-arm64@1.5.29':
    resolution: {integrity: sha512-6F/sSxpHaq3nzg2ADv9FHLi4Fu2A8w8vP8Ich8gIl16D2htStlwnaPmCLjRswO+cFkzgVqy/l01gzNGWd4DFqA==}
    engines: {node: '>=10'}
    cpu: [arm64]
    os: [darwin]

  '@swc/core-darwin-x64@1.5.29':
    resolution: {integrity: sha512-rF/rXkvUOTdTIfoYbmszbSUGsCyvqACqy1VeP3nXONS+LxFl4bRmRcUTRrblL7IE5RTMCKUuPbqbQSE2hK7bqg==}
    engines: {node: '>=10'}
    cpu: [x64]
    os: [darwin]

  '@swc/core-linux-arm-gnueabihf@1.5.29':
    resolution: {integrity: sha512-2OAPL8iWBsmmwkjGXqvuUhbmmoLxS1xNXiMq87EsnCNMAKohGc7wJkdAOUL6J/YFpean/vwMWg64rJD4pycBeg==}
    engines: {node: '>=10'}
    cpu: [arm]
    os: [linux]

  '@swc/core-linux-arm64-gnu@1.5.29':
    resolution: {integrity: sha512-eH/Q9+8O5qhSxMestZnhuS1xqQMr6M7SolZYxiXJqxArXYILLCF+nq2R9SxuMl0CfjHSpb6+hHPk/HXy54eIRA==}
    engines: {node: '>=10'}
    cpu: [arm64]
    os: [linux]

  '@swc/core-linux-arm64-musl@1.5.29':
    resolution: {integrity: sha512-TERh2OICAJz+SdDIK9+0GyTUwF6r4xDlFmpoiHKHrrD/Hh3u+6Zue0d7jQ/he/i80GDn4tJQkHlZys+RZL5UZg==}
    engines: {node: '>=10'}
    cpu: [arm64]
    os: [linux]

  '@swc/core-linux-x64-gnu@1.5.29':
    resolution: {integrity: sha512-WMDPqU7Ji9dJpA+Llek2p9t7pcy7Bob8ggPUvgsIlv3R/eesF9DIzSbrgl6j3EAEPB9LFdSafsgf6kT/qnvqFg==}
    engines: {node: '>=10'}
    cpu: [x64]
    os: [linux]

  '@swc/core-linux-x64-musl@1.5.29':
    resolution: {integrity: sha512-DO14glwpdKY4POSN0201OnGg1+ziaSVr6/RFzuSLggshwXeeyVORiHv3baj7NENhJhWhUy3NZlDsXLnRFkmhHQ==}
    engines: {node: '>=10'}
    cpu: [x64]
    os: [linux]

  '@swc/core-win32-arm64-msvc@1.5.29':
    resolution: {integrity: sha512-V3Y1+a1zG1zpYXUMqPIHEMEOd+rHoVnIpO/KTyFwAmKVu8v+/xPEVx/AGoYE67x4vDAAvPQrKI3Aokilqa5yVg==}
    engines: {node: '>=10'}
    cpu: [arm64]
    os: [win32]

  '@swc/core-win32-ia32-msvc@1.5.29':
    resolution: {integrity: sha512-OrM6yfXw4wXhnVFosOJzarw0Fdz5Y0okgHfn9oFbTPJhoqxV5Rdmd6kXxWu2RiVKs6kGSJFZXHDeUq2w5rTIMg==}
    engines: {node: '>=10'}
    cpu: [ia32]
    os: [win32]

  '@swc/core-win32-x64-msvc@1.5.29':
    resolution: {integrity: sha512-eD/gnxqKyZQQR0hR7TMkIlJ+nCF9dzYmVVNbYZWuA1Xy94aBPUsEk3Uw3oG7q6R3ErrEUPP0FNf2ztEnv+I+dw==}
    engines: {node: '>=10'}
    cpu: [x64]
    os: [win32]

  '@swc/core@1.5.29':
    resolution: {integrity: sha512-nvTtHJI43DUSOAf3h9XsqYg8YXKc0/N4il9y4j0xAkO0ekgDNo+3+jbw6MInawjKJF9uulyr+f5bAutTsOKVlw==}
    engines: {node: '>=10'}
    peerDependencies:
      '@swc/helpers': '*'
    peerDependenciesMeta:
      '@swc/helpers':
        optional: true

  '@swc/counter@0.1.3':
    resolution: {integrity: sha512-e2BR4lsJkkRlKZ/qCHPw9ZaSxc0MVUd7gtbtaB7aMvHeJVYe8sOB8DBZkP2DtISHGSku9sCK6T6cnY0CtXrOCQ==}

  '@swc/helpers@0.5.17':
    resolution: {integrity: sha512-5IKx/Y13RsYd+sauPb2x+U/xZikHjolzfuDgTAl/Tdf3Q8rslRvC19NKDLgAJQ6wsqADk10ntlv08nPFw/gO/A==}

  '@swc/types@0.1.22':
    resolution: {integrity: sha512-D13mY/ZA4PPEFSy6acki9eBT/3WgjMoRqNcdpIvjaYLQ44Xk5BdaL7UkDxAh6Z9UOe7tCCp67BVmZCojYp9owg==}

  '@trysound/sax@0.2.0':
    resolution: {integrity: sha512-L7z9BgrNEcYyUYtF+HaEfiS5ebkh9jXqbszz7pC0hRBPaatV0XjSD3+eHrpqFemQfgwiFF0QPIarnIihIDn7OA==}
    engines: {node: '>=10.13.0'}

  '@tybys/wasm-util@0.9.0':
    resolution: {integrity: sha512-6+7nlbMVX/PVDCwaIQ8nTOPveOcFLSt8GcXdx8hD0bt39uWxYT88uXzqTd4fTvqta7oeUJqudepapKNt2DYJFw==}

  '@types/body-parser@1.19.6':
    resolution: {integrity: sha512-HLFeCYgz89uk22N5Qg3dvGvsv46B8GLvKKo1zKG4NybA8U2DiEO3w9lqGg29t/tfLRJpJ6iQxnVw4OnB7MoM9g==}

  '@types/bonjour@3.5.13':
    resolution: {integrity: sha512-z9fJ5Im06zvUL548KvYNecEVlA7cVDkGUi6kZusb04mpyEFKCIZJvloCcmpmLaIahDpOQGHaHmG6imtPMmPXGQ==}

  '@types/connect-history-api-fallback@1.5.4':
    resolution: {integrity: sha512-n6Cr2xS1h4uAulPRdlw6Jl6s1oG8KrVilPN2yUITEs+K48EzMJJ3W1xy8K5eWuFvjp3R74AOIGSmp2UfBJ8HFw==}

  '@types/connect@3.4.38':
    resolution: {integrity: sha512-K6uROf1LD88uDQqJCktA4yzL1YYAK6NgfsI0v/mTgyPKWsX1CnJ0XPSDhViejru1GcRkLWb8RlzFYJRqGUbaug==}

  '@types/eslint-scope@3.7.7':
    resolution: {integrity: sha512-MzMFlSLBqNF2gcHWO0G1vP/YQyfvrxZ0bF+u7mzUdZ1/xK4A4sru+nraZz5i3iEIk1l1uyicaDVTB4QbbEkAYg==}

  '@types/eslint@9.6.1':
    resolution: {integrity: sha512-FXx2pKgId/WyYo2jXw63kk7/+TY7u7AziEJxJAnSFzHlqTAS3Ync6SvgYAN/k4/PQpnnVuzoMuVnByKK2qp0ag==}

  '@types/estree@1.0.8':
    resolution: {integrity: sha512-dWHzHa2WqEXI/O1E9OjrocMTKJl2mSrEolh1Iomrv6U+JuNwaHXsXx9bLu5gG7BUWFIN0skIQJQ/L1rIex4X6w==}

  '@types/express-serve-static-core@4.19.6':
    resolution: {integrity: sha512-N4LZ2xG7DatVqhCZzOGb1Yi5lMbXSZcmdLDe9EzSndPV2HpWYWzRbaerl2n27irrm94EPpprqa8KpskPT085+A==}

  '@types/express@4.17.23':
    resolution: {integrity: sha512-Crp6WY9aTYP3qPi2wGDo9iUe/rceX01UMhnF1jmwDcKCFM6cx7YhGP/Mpr3y9AASpfHixIG0E6azCcL5OcDHsQ==}

  '@types/http-errors@2.0.5':
    resolution: {integrity: sha512-r8Tayk8HJnX0FztbZN7oVqGccWgw98T/0neJphO91KkmOzug1KkofZURD4UaD5uH8AqcFLfdPErnBod0u71/qg==}

  '@types/http-proxy@1.17.16':
    resolution: {integrity: sha512-sdWoUajOB1cd0A8cRRQ1cfyWNbmFKLAqBB89Y8x5iYyG/mkJHc0YUH8pdWBy2omi9qtCpiIgGjuwO0dQST2l5w==}

  '@types/istanbul-lib-coverage@2.0.6':
    resolution: {integrity: sha512-2QF/t/auWm0lsy8XtKVPG19v3sSOQlJe/YHZgfjb/KBBHOGSV+J2q/S671rcq9uTBrLAXmZpqJiaQbMT+zNU1w==}

  '@types/istanbul-lib-report@3.0.3':
    resolution: {integrity: sha512-NQn7AHQnk/RSLOxrBbGyJM/aVQ+pjj5HCgasFxc0K/KhoATfQ/47AyUl15I2yBUpihjmas+a+VJBOqecrFH+uA==}

  '@types/istanbul-reports@3.0.4':
    resolution: {integrity: sha512-pk2B1NWalF9toCRu6gjBzR69syFjP4Od8WRAX+0mmf9lAjCRicLOWc+ZrxZHx/0XRjotgkF9t6iaMJ+aXcOdZQ==}

  '@types/json-schema@7.0.15':
    resolution: {integrity: sha512-5+fP8P8MFNC+AyZCDxrB2pkZFPGzqQWUzpSeuuVLvm8VMcorNYavBqoFcxK8bQz4Qsbn4oUEEem4wDLfcysGHA==}

  '@types/mime@1.3.5':
    resolution: {integrity: sha512-/pyBZWSLD2n0dcHE3hq8s8ZvcETHtEuF+3E7XVt0Ig2nvsVQXdghHVcEkIWjy9A0wKfTn97a/PSDYohKIlnP/w==}

  '@types/node-forge@1.3.11':
    resolution: {integrity: sha512-FQx220y22OKNTqaByeBGqHWYz4cl94tpcxeFdvBo3wjG6XPBuZ0BNgNZRV5J5TFmmcsJ4IzsLkmGRiQbnYsBEQ==}

  '@types/node@18.16.9':
    resolution: {integrity: sha512-IeB32oIV4oGArLrd7znD2rkHQ6EDCM+2Sr76dJnrHwv9OHBTTM6nuDLK9bmikXzPa0ZlWMWtRGo/Uw4mrzQedA==}

  '@types/parse-json@4.0.2':
    resolution: {integrity: sha512-dISoDXWWQwUquiKsyZ4Ng+HX2KsPL7LyHKHQwgGFEA3IaKac4Obd+h2a/a6waisAoepJlBcx9paWqjA8/HVjCw==}

  '@types/qs@6.14.0':
    resolution: {integrity: sha512-eOunJqu0K1923aExK6y8p6fsihYEn/BYuQ4g0CxAAgFc4b/ZLN4CrsRZ55srTdqoiLzU2B2evC+apEIxprEzkQ==}

  '@types/range-parser@1.2.7':
    resolution: {integrity: sha512-hKormJbkJqzQGhziax5PItDUTMAM9uE2XXQmM37dyd4hVM+5aVl7oVxMVUiVQn2oCQFN/LKCZdvSM0pFRqbSmQ==}

  '@types/retry@0.12.2':
    resolution: {integrity: sha512-XISRgDJ2Tc5q4TRqvgJtzsRkFYNJzZrhTdtMoGVBttwzzQJkPnS3WWTFc7kuDRoPtPakl+T+OfdEUjYJj7Jbow==}

  '@types/send@0.17.5':
    resolution: {integrity: sha512-z6F2D3cOStZvuk2SaP6YrwkNO65iTZcwA2ZkSABegdkAh/lf+Aa/YQndZVfmEXT5vgAp6zv06VQ3ejSVjAny4w==}

  '@types/serve-index@1.9.4':
    resolution: {integrity: sha512-qLpGZ/c2fhSs5gnYsQxtDEq3Oy8SXPClIXkW5ghvAvsNuVSA8k+gCONcUCS/UjLEYvYps+e8uBtfgXgvhwfNug==}

  '@types/serve-static@1.15.8':
    resolution: {integrity: sha512-roei0UY3LhpOJvjbIP6ZZFngyLKl5dskOtDhxY5THRSpO+ZI+nzJ+m5yUMzGrp89YRa7lvknKkMYjqQFGwA7Sg==}

  '@types/sockjs@0.3.36':
    resolution: {integrity: sha512-MK9V6NzAS1+Ud7JV9lJLFqW85VbC9dq3LmwZCuBe4wBDgKC0Kj/jd8Xl+nSviU+Qc3+m7umHHyHg//2KSa0a0Q==}

  '@types/ws@8.18.1':
    resolution: {integrity: sha512-ThVF6DCVhA8kUGy+aazFQ4kXQ7E1Ty7A3ypFOe0IcJV8O/M511G99AW24irKrW56Wt44yG9+ij8FaqoBGkuBXg==}

  '@types/yargs-parser@21.0.3':
    resolution: {integrity: sha512-I4q9QU9MQv4oEOz4tAHJtNz1cwuLxn2F3xcc2iV5WdqLPpUnj30aUuxt1mAxYTG+oe8CZMV/+6rU4S4gRDzqtQ==}

  '@types/yargs@17.0.33':
    resolution: {integrity: sha512-WpxBCKWPLr4xSsHgz511rFJAM+wS28w2zEO1QDNY5zM/S8ok70NNfztH0xwhqKyaK0OHCbN98LDAZuy1ctxDkA==}

  '@webassemblyjs/ast@1.14.1':
    resolution: {integrity: sha512-nuBEDgQfm1ccRp/8bCQrx1frohyufl4JlbMMZ4P1wpeOfDhF6FQkxZJ1b/e+PLwr6X1Nhw6OLme5usuBWYBvuQ==}

  '@webassemblyjs/floating-point-hex-parser@1.13.2':
    resolution: {integrity: sha512-6oXyTOzbKxGH4steLbLNOu71Oj+C8Lg34n6CqRvqfS2O71BxY6ByfMDRhBytzknj9yGUPVJ1qIKhRlAwO1AovA==}

  '@webassemblyjs/helper-api-error@1.13.2':
    resolution: {integrity: sha512-U56GMYxy4ZQCbDZd6JuvvNV/WFildOjsaWD3Tzzvmw/mas3cXzRJPMjP83JqEsgSbyrmaGjBfDtV7KDXV9UzFQ==}

  '@webassemblyjs/helper-buffer@1.14.1':
    resolution: {integrity: sha512-jyH7wtcHiKssDtFPRB+iQdxlDf96m0E39yb0k5uJVhFGleZFoNw1c4aeIcVUPPbXUVJ94wwnMOAqUHyzoEPVMA==}

  '@webassemblyjs/helper-numbers@1.13.2':
    resolution: {integrity: sha512-FE8aCmS5Q6eQYcV3gI35O4J789wlQA+7JrqTTpJqn5emA4U2hvwJmvFRC0HODS+3Ye6WioDklgd6scJ3+PLnEA==}

  '@webassemblyjs/helper-wasm-bytecode@1.13.2':
    resolution: {integrity: sha512-3QbLKy93F0EAIXLh0ogEVR6rOubA9AoZ+WRYhNbFyuB70j3dRdwH9g+qXhLAO0kiYGlg3TxDV+I4rQTr/YNXkA==}

  '@webassemblyjs/helper-wasm-section@1.14.1':
    resolution: {integrity: sha512-ds5mXEqTJ6oxRoqjhWDU83OgzAYjwsCV8Lo/N+oRsNDmx/ZDpqalmrtgOMkHwxsG0iI//3BwWAErYRHtgn0dZw==}

  '@webassemblyjs/ieee754@1.13.2':
    resolution: {integrity: sha512-4LtOzh58S/5lX4ITKxnAK2USuNEvpdVV9AlgGQb8rJDHaLeHciwG4zlGr0j/SNWlr7x3vO1lDEsuePvtcDNCkw==}

  '@webassemblyjs/leb128@1.13.2':
    resolution: {integrity: sha512-Lde1oNoIdzVzdkNEAWZ1dZ5orIbff80YPdHx20mrHwHrVNNTjNr8E3xz9BdpcGqRQbAEa+fkrCb+fRFTl/6sQw==}

  '@webassemblyjs/utf8@1.13.2':
    resolution: {integrity: sha512-3NQWGjKTASY1xV5m7Hr0iPeXD9+RDobLll3T9d2AO+g3my8xy5peVyjSag4I50mR1bBSN/Ct12lo+R9tJk0NZQ==}

  '@webassemblyjs/wasm-edit@1.14.1':
    resolution: {integrity: sha512-RNJUIQH/J8iA/1NzlE4N7KtyZNHi3w7at7hDjvRNm5rcUXa00z1vRz3glZoULfJ5mpvYhLybmVcwcjGrC1pRrQ==}

  '@webassemblyjs/wasm-gen@1.14.1':
    resolution: {integrity: sha512-AmomSIjP8ZbfGQhumkNvgC33AY7qtMCXnN6bL2u2Js4gVCg8fp735aEiMSBbDR7UQIj90n4wKAFUSEd0QN2Ukg==}

  '@webassemblyjs/wasm-opt@1.14.1':
    resolution: {integrity: sha512-PTcKLUNvBqnY2U6E5bdOQcSM+oVP/PmrDY9NzowJjislEjwP/C4an2303MCVS2Mg9d3AJpIGdUFIQQWbPds0Sw==}

  '@webassemblyjs/wasm-parser@1.14.1':
    resolution: {integrity: sha512-JLBl+KZ0R5qB7mCnud/yyX08jWFw5MsoalJ1pQ4EdFlgj9VdXKGuENGsiCIjegI1W7p91rUlcB/LB5yRJKNTcQ==}

  '@webassemblyjs/wast-printer@1.14.1':
    resolution: {integrity: sha512-kPSSXE6De1XOR820C90RIo2ogvZG+c3KiHzqUoO/F34Y2shGzesfqv7o57xrxovZJH/MetF5UjroJ/R/3isoiw==}

  '@xtuc/ieee754@1.2.0':
    resolution: {integrity: sha512-DX8nKgqcGwsc0eJSqYt5lwP4DH5FlHnmuWWBRy7X0NcaGR0ZtuyeESgMwTYVEtxmsNGY+qit4QYT/MIYTOTPeA==}

  '@xtuc/long@4.2.2':
    resolution: {integrity: sha512-NuHqBY1PB/D8xU6s/thBgOAiAP7HOYDQ32+BFZILJ8ivkUkAHQnWfn6WhL79Owj1qmUnoN/YPhktdIoucipkAQ==}

  '@yarnpkg/lockfile@1.1.0':
    resolution: {integrity: sha512-GpSwvyXOcOOlV70vbnzjj4fW5xW/FdUF6nQEt1ENy7m4ZCczi1+/buVUPAqmGfqznsORNFzUMjctTIp8a9tuCQ==}

  '@yarnpkg/parsers@3.0.2':
    resolution: {integrity: sha512-/HcYgtUSiJiot/XWGLOlGxPYUG65+/31V8oqk17vZLW1xlCoR4PampyePljOxY2n8/3jz9+tIFzICsyGujJZoA==}
    engines: {node: '>=18.12.0'}

  '@zkochan/js-yaml@0.0.7':
    resolution: {integrity: sha512-nrUSn7hzt7J6JWgWGz78ZYI8wj+gdIJdk0Ynjpp8l+trkn58Uqsf6RYrYkEK+3X18EX+TNdtJI0WxAtc+L84SQ==}
    hasBin: true

  accepts@1.3.8:
    resolution: {integrity: sha512-PYAthTa2m2VKxuvSD3DPC/Gy+U+sOA1LAuT8mkmRuvw+NACSaeXEQ+NHcVF7rONl6qcaxV3Uuemwawk+7+SJLw==}
    engines: {node: '>= 0.6'}

  acorn@8.15.0:
    resolution: {integrity: sha512-NZyJarBfL7nWwIq+FDL6Zp/yHEhePMNnnJ0y3qfieCrmNvYct8uvtiV41UvlSe6apAfk0fY1FbWx+NwfmpvtTg==}
    engines: {node: '>=0.4.0'}
    hasBin: true

  address@1.2.2:
    resolution: {integrity: sha512-4B/qKCfeE/ODUaAUpSwfzazo5x29WD4r3vXiWsB7I2mSDAihwEqKO+g8GELZUQSSAo5e1XTYh3ZVfLyxBc12nA==}
    engines: {node: '>= 10.0.0'}

  ajv-formats@2.1.1:
    resolution: {integrity: sha512-Wx0Kx52hxE7C18hkMEggYlEifqWZtYaRgouJor+WMdPnQyEK13vgEWyVNup7SoeeoLMsr4kf5h6dOW11I15MUA==}
    peerDependencies:
      ajv: ^8.0.0
    peerDependenciesMeta:
      ajv:
        optional: true

  ajv-keywords@3.5.2:
    resolution: {integrity: sha512-5p6WTN0DdTGVQk6VjcEju19IgaHudalcfabD7yhDGeA6bcQnmL+CpveLJq/3hvfwd1aof6L386Ougkx6RfyMIQ==}
    peerDependencies:
      ajv: ^6.9.1

  ajv-keywords@5.1.0:
    resolution: {integrity: sha512-YCS/JNFAUyr5vAuhk1DWm1CBxRHW9LbJ2ozWeemrIqpbsqKjHVxYPyi5GC0rjZIT5JxJ3virVTS8wk4i/Z+krw==}
    peerDependencies:
      ajv: ^8.8.2

  ajv@6.12.6:
    resolution: {integrity: sha512-j3fVLgvTo527anyYyJOGTYJbG+vnnQYvE0m5mmkc1TK+nxAppkCLMIL0aZ4dblVCNoGShhm+kzE4ZUykBoMg4g==}

  ajv@8.17.1:
    resolution: {integrity: sha512-B/gBuNg5SiMTrPkC+A2+cW0RszwxYmn6VYxB/inlBStS5nx6xHIt/ehKRhIMhqusl7a8LjQoZnjCs5vhwxOQ1g==}

  ansi-colors@4.1.3:
    resolution: {integrity: sha512-/6w/C21Pm1A7aZitlI5Ni/2J6FFQN8i1Cvz3kHABAAbw93v/NlvKdVOqz7CCWz/3iv/JplRSEEZ83XION15ovw==}
    engines: {node: '>=6'}

  ansi-html-community@0.0.8:
    resolution: {integrity: sha512-1APHAyr3+PCamwNw3bXCPp4HFLONZt/yIH0sZp0/469KWNTEy+qN5jQ3GVX6DMZ1UXAi34yVwtTeaG/HpBuuzw==}
    engines: {'0': node >= 0.8.0}
    hasBin: true

  ansi-regex@5.0.1:
    resolution: {integrity: sha512-quJQXlTSUGL2LH9SUXo8VwsY4soanhgo6LNSm84E1LBcE8s3O0wpdiRzyR9z/ZZJMlMWv37qOOb9pdJlMUEKFQ==}
    engines: {node: '>=8'}

  ansi-regex@6.1.0:
    resolution: {integrity: sha512-7HSX4QQb4CspciLpVFwyRe79O3xsIZDDLER21kERQ71oaPodF8jL725AgJMFAYbooIqolJoRLuM81SpeUkpkvA==}
    engines: {node: '>=12'}

  ansi-styles@4.3.0:
    resolution: {integrity: sha512-zbB9rCJAT1rbjiVDb2hqKFHNYLxgtk8NURxZ3IZwD3F6NtxbXZQCnnSi1Lkx+IDohdPlFp222wVALIheZJQSEg==}
    engines: {node: '>=8'}

  ansi-styles@5.2.0:
    resolution: {integrity: sha512-Cxwpt2SfTzTtXcfOlzGEee8O+c+MmUgGrNiBcXnuWxuFJHe6a5Hz7qwhwe5OgaSYI0IJvkLqWX1ASG+cJOkEiA==}
    engines: {node: '>=10'}

  ansi-styles@6.2.1:
    resolution: {integrity: sha512-bN798gFfQX+viw3R7yrGWRqnrN2oRkEkUjjl4JNn4E8GxxbjtG3FbrEIIY3l8/hrwUwIeCZvi4QuOTP4MErVug==}
    engines: {node: '>=12'}

  anymatch@3.1.3:
    resolution: {integrity: sha512-KMReFUr0B4t+D+OBkjR3KYqvocp2XaSzO55UcB6mgQMd3KbcE+mWTyvVV7D/zsdEbNnV6acZUutkiHQXvTr1Rw==}
    engines: {node: '>= 8'}

  argparse@1.0.10:
    resolution: {integrity: sha512-o5Roy6tNG4SL/FOkCAN6RzjiakZS25RLYFrcMttJqbdd8BWrnA+fGz57iN5Pb06pvBGvl5gQ0B48dJlslXvoTg==}

  argparse@2.0.1:
    resolution: {integrity: sha512-8+9WqebbFzpX9OR+Wa6O29asIogeRMzcGtAINdpMHHyAg10f05aSFVBbcEqGf/PXw1EjAZ+q2/bEBg3DvurK3Q==}

  array-flatten@1.1.1:
    resolution: {integrity: sha512-PCVAQswWemu6UdxsDFFX/+gVeYqKAod3D3UVm91jHwynguOwAvYPhx8nNlM++NqRcK6CxxpUafjmhIdKiHibqg==}

  array-union@3.0.1:
    resolution: {integrity: sha512-1OvF9IbWwaeiM9VhzYXVQacMibxpXOMYVNIvMtKRyX9SImBXpKcFr8XvFDeEslCyuH/t6KRt7HEO94AlP8Iatw==}
    engines: {node: '>=12'}

  async@3.2.6:
    resolution: {integrity: sha512-htCUDlxyyCLMgaM3xXg0C0LW2xqfuQ6p05pCEIsXuyQ+a1koYKTuBMzRNwmybfLgvJDMd0r1LTn4+E0Ti6C2AA==}

  asynckit@0.4.0:
    resolution: {integrity: sha512-Oei9OH4tRh0YqU3GxhX79dM/mwVgvbZJaSNaRk+bshkj0S5cfHcgYakreBjrHwatXKbz+IoIdYLxrKim2MjW0Q==}

  autoprefixer@10.4.21:
    resolution: {integrity: sha512-O+A6LWV5LDHSJD3LjHYoNi4VLsj/Whi7k6zG12xTYaU4cQ8oxQGckXNX8cRHK5yOZ/ppVHe0ZBXGzSV9jXdVbQ==}
    engines: {node: ^10 || ^12 || >=14}
    hasBin: true
    peerDependencies:
      postcss: ^8.1.0

  axios@1.9.0:
    resolution: {integrity: sha512-re4CqKTJaURpzbLHtIi6XpDv20/CnpXOtjRY5/CU32L8gU8ek9UIivcfvSWvmKEngmVbrUtPpdDwWDWL7DNHvg==}

  babel-loader@9.2.1:
    resolution: {integrity: sha512-fqe8naHt46e0yIdkjUZYqddSXfej3AHajX+CSO5X7oy0EmPc6o5Xh+RClNoHjnieWz9AW4kZxW9yyFMhVB1QLA==}
    engines: {node: '>= 14.15.0'}
    peerDependencies:
      '@babel/core': ^7.12.0
      webpack: '>=5'

  babel-plugin-const-enum@1.2.0:
    resolution: {integrity: sha512-o1m/6iyyFnp9MRsK1dHF3bneqyf3AlM2q3A/YbgQr2pCat6B6XJVDv2TXqzfY2RYUi4mak6WAksSBPlyYGx9dg==}
    peerDependencies:
      '@babel/core': ^7.0.0-0

  babel-plugin-macros@3.1.0:
    resolution: {integrity: sha512-Cg7TFGpIr01vOQNODXOOaGz2NpCU5gl8x1qJFbb6hbZxR7XrcE2vtbAsTAbJ7/xwJtUuJEw8K8Zr/AE0LHlesg==}
    engines: {node: '>=10', npm: '>=6'}

  babel-plugin-polyfill-corejs2@0.4.13:
    resolution: {integrity: sha512-3sX/eOms8kd3q2KZ6DAhKPc0dgm525Gqq5NtWKZ7QYYZEv57OQ54KtblzJzH1lQF/eQxO8KjWGIK9IPUJNus5g==}
    peerDependencies:
      '@babel/core': ^7.4.0 || ^8.0.0-0 <8.0.0

  babel-plugin-polyfill-corejs3@0.11.1:
    resolution: {integrity: sha512-yGCqvBT4rwMczo28xkH/noxJ6MZ4nJfkVYdoDaC/utLtWrXxv27HVrzAeSbqR8SxDsp46n0YF47EbHoixy6rXQ==}
    peerDependencies:
      '@babel/core': ^7.4.0 || ^8.0.0-0 <8.0.0

  babel-plugin-polyfill-regenerator@0.6.4:
    resolution: {integrity: sha512-7gD3pRadPrbjhjLyxebmx/WrFYcuSjZ0XbdUujQMZ/fcE9oeewk2U/7PCvez84UeuK3oSjmPZ0Ch0dlupQvGzw==}
    peerDependencies:
      '@babel/core': ^7.4.0 || ^8.0.0-0 <8.0.0

  babel-plugin-transform-typescript-metadata@0.3.2:
    resolution: {integrity: sha512-mWEvCQTgXQf48yDqgN7CH50waTyYBeP2Lpqx4nNWab9sxEpdXVeKgfj1qYI2/TgUPQtNFZ85i3PemRtnXVYYJg==}
    peerDependencies:
      '@babel/core': ^7
      '@babel/traverse': ^7
    peerDependenciesMeta:
      '@babel/traverse':
        optional: true

  balanced-match@1.0.2:
    resolution: {integrity: sha512-3oSeUO0TMV67hN1AmbXsK4yaqU7tjiHlbxRDZOpH0KW9+CeX4bRAaX0Anxt0tx2MrpRpWwQaPwIlISEJhYU5Pw==}

  base64-js@1.5.1:
    resolution: {integrity: sha512-AKpaYlHn8t4SVbOHCy+b5+KKgvR4vrsD8vbvrbiQJps7fKDTkjkDry6ji0rUJjC0kzbNePLwzxq8iypo41qeWA==}

  batch@0.6.1:
    resolution: {integrity: sha512-x+VAiMRL6UPkx+kudNvxTl6hB2XNNCG2r+7wixVfIYwu/2HKRXimwQyaumLjMveWvT2Hkd/cAJw+QBMfJ/EKVw==}

  big.js@5.2.2:
    resolution: {integrity: sha512-vyL2OymJxmarO8gxMr0mhChsO9QGwhynfuu4+MHTAW6czfq9humCB7rKpUjDd9YUiDPU4mzpyupFSvOClAwbmQ==}

  binary-extensions@2.3.0:
    resolution: {integrity: sha512-Ceh+7ox5qe7LJuLHoY0feh3pHuUDHAcRUeyL2VYghZwfpkNIy/+8Ocg0a3UuSoYzavmylwuLWQOf3hl0jjMMIw==}
    engines: {node: '>=8'}

  bl@4.1.0:
    resolution: {integrity: sha512-1W07cM9gS6DcLperZfFSj+bWLtaPGSOHWhPiGzXmvVJbRLdG82sH/Kn8EtW1VqWVA54AKf2h5k5BbnIbwF3h6w==}

  body-parser@1.20.3:
    resolution: {integrity: sha512-7rAxByjUMqQ3/bHJy7D6OGXvx/MMc4IqBn/X0fcM1QUcAItpZrBEYhWGem+tzXH90c+G01ypMcYJBO9Y30203g==}
    engines: {node: '>= 0.8', npm: 1.2.8000 || >= 1.4.16}

  bonjour-service@1.3.0:
    resolution: {integrity: sha512-3YuAUiSkWykd+2Azjgyxei8OWf8thdn8AITIog2M4UICzoqfjlqr64WIjEXZllf/W6vK1goqleSR6brGomxQqA==}

  boolbase@1.0.0:
    resolution: {integrity: sha512-JZOSA7Mo9sNGB8+UjSgzdLtokWAky1zbztM3WRLCbZ70/3cTANmQmOdR7y2g+J0e2WXywy1yS468tY+IruqEww==}

  brace-expansion@1.1.11:
    resolution: {integrity: sha512-iCuPHDFgrHX7H2vEI/5xpz07zSHB00TpugqhmYtVmMO6518mCuRMoOYFldEBl0g187ufozdaHgWKcYFb61qGiA==}

  brace-expansion@2.0.1:
    resolution: {integrity: sha512-XnAIvQ8eM+kC6aULx6wuQiwVsnzsi9d3WxzV3FpWTGA19F621kwdbsAcFKXgKUHZWsy+mY6iL1sHTxWEFCytDA==}

  braces@3.0.3:
    resolution: {integrity: sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==}
    engines: {node: '>=8'}

  browserslist@4.25.0:
    resolution: {integrity: sha512-PJ8gYKeS5e/whHBh8xrwYK+dAvEj7JXtz6uTucnMRB8OiGTsKccFekoRrjajPBHV8oOY+2tI4uxeceSimKwMFA==}
    engines: {node: ^6 || ^7 || ^8 || ^9 || ^10 || ^11 || ^12 || >=13.7}
    hasBin: true

  buffer-builder@0.2.0:
    resolution: {integrity: sha512-7VPMEPuYznPSoR21NE1zvd2Xna6c/CloiZCfcMXR1Jny6PjX0N4Nsa38zcBFo/FMK+BlA+FLKbJCQ0i2yxp+Xg==}

  buffer-from@1.1.2:
    resolution: {integrity: sha512-E+XQCRwSbaaiChtv6k6Dwgc+bx+Bs6vuKJHHl5kox/BaKbhiXzqQOwK4cO22yElGp2OCmjwVhT3HmxgyPGnJfQ==}

  buffer@5.7.1:
    resolution: {integrity: sha512-EHcyIPBQ4BSGlvjB16k5KgAJ27CIsHY/2JBmCRReo48y9rQ3MaUzWX3KVlBa4U7MyX02HdVj0K7C3WaB3ju7FQ==}

  bundle-name@4.1.0:
    resolution: {integrity: sha512-tjwM5exMg6BGRI+kNmTntNsvdZS1X8BFYS6tnJ2hdH0kVxM6/eVZ2xy+FqStSWvYmtfFMDLIxurorHwDKfDz5Q==}
    engines: {node: '>=18'}

  bytes@3.1.2:
    resolution: {integrity: sha512-/Nf7TyzTx6S3yRJObOAV7956r8cr2+Oj8AC5dt8wSP3BQAoeX58NoHyCU8P8zGkNXStjTSi6fzO6F0pBdcYbEg==}
    engines: {node: '>= 0.8'}

  call-bind-apply-helpers@1.0.2:
    resolution: {integrity: sha512-Sp1ablJ0ivDkSzjcaJdxEunN5/XvksFJ2sMBFfq6x0ryhQV/2b/KwFe21cMpmHtPOSij8K99/wSfoEuTObmuMQ==}
    engines: {node: '>= 0.4'}

  call-bound@1.0.4:
    resolution: {integrity: sha512-+ys997U96po4Kx/ABpBCqhA9EuxJaQWDQg7295H4hBphv3IZg0boBKuwYpt4YXp6MZ5AmZQnU/tyMTlRpaSejg==}
    engines: {node: '>= 0.4'}

  callsites@3.1.0:
    resolution: {integrity: sha512-P8BjAsXvZS+VIDUI11hHCQEv74YT67YUi5JJFNWIqL235sBmjX4+qx9Muvls5ivyNENctx46xQLQ3aTuE7ssaQ==}
    engines: {node: '>=6'}

  caniuse-api@3.0.0:
    resolution: {integrity: sha512-bsTwuIg/BZZK/vreVTYYbSWoe2F+71P7K5QGEX+pT250DZbfU1MQ5prOKpPR+LL6uWKK3KMwMCAS74QB3Um1uw==}

  caniuse-lite@1.0.30001721:
    resolution: {integrity: sha512-cOuvmUVtKrtEaoKiO0rSc29jcjwMwX5tOHDy4MgVFEWiUXj4uBMJkwI8MDySkgXidpMiHUcviogAvFi4pA2hDQ==}

  chalk@4.1.2:
    resolution: {integrity: sha512-oKnbhFyRIXpUuez8iBMmyEa4nbj4IOQyuhc/wy9kY7/WVPcwIO9VA668Pu8RkO7+0G76SLROeyw9CpQ061i4mA==}
    engines: {node: '>=10'}

  chokidar@3.6.0:
    resolution: {integrity: sha512-7VT13fmjotKpGipCW9JEQAusEPE+Ei8nl6/g4FBAmIm0GOOLMua9NDDo/DWp0ZAxCr3cPq5ZpBqmPAQgDda2Pw==}
    engines: {node: '>= 8.10.0'}

  chokidar@4.0.3:
    resolution: {integrity: sha512-Qgzu8kfBvo+cA4962jnP1KkS6Dop5NS6g7R5LFYJr4b8Ub94PPQXUksCw9PvXoeXPRRddRNC5C1JQUR2SMGtnA==}
    engines: {node: '>= 14.16.0'}

  chrome-trace-event@1.0.4:
    resolution: {integrity: sha512-rNjApaLzuwaOTjCiT8lSDdGN1APCiqkChLMJxJPWLunPAt5fy8xgU9/jNOchV84wfIxrA0lRQB7oCT8jrn/wrQ==}
    engines: {node: '>=6.0'}

  ci-info@3.9.0:
    resolution: {integrity: sha512-NIxF55hv4nSqQswkAeiOi1r83xy8JldOFDTWiug55KBu9Jnblncd2U6ViHmYgHf01TPZS77NJBhBMKdWj9HQMQ==}
    engines: {node: '>=8'}

  cli-cursor@3.1.0:
    resolution: {integrity: sha512-I/zHAwsKf9FqGoXM4WWRACob9+SNukZTd94DWF57E4toouRulbCxcUh6RKUEOQlYTHJnzkPMySvPNaaSLNfLZw==}
    engines: {node: '>=8'}

  cli-spinners@2.6.1:
    resolution: {integrity: sha512-x/5fWmGMnbKQAaNwN+UZlV79qBLM9JFnJuJ03gIi5whrob0xV0ofNVHy9DhwGdsMJQc2OKv0oGmLzvaqvAVv+g==}
    engines: {node: '>=6'}

  cli-spinners@2.9.2:
    resolution: {integrity: sha512-ywqV+5MmyL4E7ybXgKys4DugZbX0FC6LnwrhjuykIjnK9k8OQacQ7axGKnjDXWNhns0xot3bZI5h55H8yo9cJg==}
    engines: {node: '>=6'}

  cliui@8.0.1:
    resolution: {integrity: sha512-BSeNnyus75C4//NQ9gQt1/csTXyo/8Sb+afLAkzAptFuMsod9HFokGNudZpi/oQV73hnVK+sR+5PVRMd+Dr7YQ==}
    engines: {node: '>=12'}

  clone@1.0.4:
    resolution: {integrity: sha512-JQHZ2QMW6l3aH/j6xCqQThY/9OH4D/9ls34cgkUBiEeocRTU04tHfKPBsUK1PqZCUQM7GiA0IIXJSuXHI64Kbg==}
    engines: {node: '>=0.8'}

  color-convert@2.0.1:
    resolution: {integrity: sha512-RRECPsj7iu/xb5oKYcsFHSppFNnsj/52OVTRKb4zP5onXwVF3zVmmToNcOfGC+CRDpfK/U584fMg38ZHCaElKQ==}
    engines: {node: '>=7.0.0'}

  color-name@1.1.4:
    resolution: {integrity: sha512-dOy+3AuW3a2wNbZHIuMZpTcgjGuLU/uBL/ubcZF9OXbDo8ff4O8yVp5Bf0efS8uEoYo5q4Fx7dY9OgQGXgAsQA==}

  colord@2.9.3:
    resolution: {integrity: sha512-jeC1axXpnb0/2nn/Y1LPuLdgXBLH7aDcHu4KEKfqw3CUhX7ZpfBSlPKyqXE6btIgEzfWtrX3/tyBCaCvXvMkOw==}

  colorette@2.0.20:
    resolution: {integrity: sha512-IfEDxwoWIjkeXL1eXcDiow4UbKjhLdq6/EuSVR9GMN7KVH3r9gQ83e73hsz1Nd1T3ijd5xv1wcWRYO+D6kCI2w==}

  colorjs.io@0.5.2:
    resolution: {integrity: sha512-twmVoizEW7ylZSN32OgKdXRmo1qg+wT5/6C3xu5b9QsWzSFAhHLn2xd8ro0diCsKfCj1RdaTP/nrcW+vAoQPIw==}

  columnify@1.6.0:
    resolution: {integrity: sha512-lomjuFZKfM6MSAnV9aCZC9sc0qGbmZdfygNv+nCpqVkSKdCxCklLtd16O0EILGkImHw9ZpHkAnHaB+8Zxq5W6Q==}
    engines: {node: '>=8.0.0'}

  combined-stream@1.0.8:
    resolution: {integrity: sha512-FQN4MRfuJeHf7cBbBMJFXhKSDq+2kAArBlmRBvcvFE5BB1HZKXtSFASDhdlz9zOYwxh8lDdnvmMOe/+5cdoEdg==}
    engines: {node: '>= 0.8'}

  commander@2.20.3:
    resolution: {integrity: sha512-GpVkmM8vF2vQUkj2LvZmD35JxeJOLCwJ9cUkugyk2nuhbv3+mJvpLYYt+0+USMxE+oj+ey/lJEnhZw75x/OMcQ==}

  commander@7.2.0:
    resolution: {integrity: sha512-QrWXB+ZQSVPmIWIhtEO9H+gwHaMGYiF5ChvoJ+K9ZGHG/sVsa6yiesAD1GC/x46sET00Xlwo1u49RVVVzvcSkw==}
    engines: {node: '>= 10'}

  common-path-prefix@3.0.0:
    resolution: {integrity: sha512-QE33hToZseCH3jS0qN96O/bSh3kaw/h+Tq7ngyY9eWDUnTlTNUyqfqvCXioLe5Na5jFsL78ra/wuBU4iuEgd4w==}

  compressible@2.0.18:
    resolution: {integrity: sha512-AF3r7P5dWxL8MxyITRMlORQNaOA2IkAFaTr4k7BUumjPtRpGDTZpl0Pb1XCO6JeDCBdp126Cgs9sMxqSjgYyRg==}
    engines: {node: '>= 0.6'}

  compression@1.8.0:
    resolution: {integrity: sha512-k6WLKfunuqCYD3t6AsuPGvQWaKwuLLh2/xHNcX4qE+vIfDNXpSqnrhwA7O53R7WVQUnt8dVAIW+YHr7xTgOgGA==}
    engines: {node: '>= 0.8.0'}

  concat-map@0.0.1:
    resolution: {integrity: sha512-/Srv4dswyQNBfohGpz9o6Yb3Gz3SrUDqBH5rTuhGR7ahtlbYKnVxw2bCFMRljaA7EXHaXZ8wsHdodFvbkhKmqg==}

  connect-history-api-fallback@2.0.0:
    resolution: {integrity: sha512-U73+6lQFmfiNPrYbXqr6kZ1i1wiRqXnp2nhMsINseWXO8lDau0LGEffJ8kQi4EjLZympVgRdvqjAgiZ1tgzDDA==}
    engines: {node: '>=0.8'}

  content-disposition@0.5.4:
    resolution: {integrity: sha512-FveZTNuGw04cxlAiWbzi6zTAL/lhehaWbTtgluJh4/E95DqMwTmha3KZN1aAWA8cFIhHzMZUvLevkw5Rqk+tSQ==}
    engines: {node: '>= 0.6'}

  content-type@1.0.5:
    resolution: {integrity: sha512-nTjqfcBFEipKdXCv4YDQWCfmcLZKm81ldF0pAopTvyrFGVbcR6P/VAAd5G7N+0tTr8QqiU0tFadD6FK4NtJwOA==}
    engines: {node: '>= 0.6'}

  convert-source-map@2.0.0:
    resolution: {integrity: sha512-Kvp459HrV2FEJ1CAsi1Ku+MY3kasH19TFykTz2xWmMeq6bk2NU3XXvfJ+Q61m0xktWwt+1HSYf3JZsTms3aRJg==}

  cookie-signature@1.0.6:
    resolution: {integrity: sha512-QADzlaHc8icV8I7vbaJXJwod9HWYp8uCqf1xa4OfNu1T7JVxQIrUgOWtHdNDtPiywmFbiS12VjotIXLrKM3orQ==}

  cookie@0.7.1:
    resolution: {integrity: sha512-6DnInpx7SJ2AK3+CTUE/ZM0vWTUboZCegxhC2xiIydHR9jNuTAASBrfEpHhiGOZw/nX51bHt6YQl8jsGo4y/0w==}
    engines: {node: '>= 0.6'}

  copy-anything@2.0.6:
    resolution: {integrity: sha512-1j20GZTsvKNkc4BY3NpMOM8tt///wY3FpIzozTOFO2ffuZcV61nojHXVKIy3WM+7ADCy5FVhdZYHYDdgTU0yJw==}

  copy-webpack-plugin@10.2.4:
    resolution: {integrity: sha512-xFVltahqlsRcyyJqQbDY6EYTtyQZF9rf+JPjwHObLdPFMEISqkFkr7mFoVOC6BfYS/dNThyoQKvziugm+OnwBg==}
    engines: {node: '>= 12.20.0'}
    peerDependencies:
      webpack: ^5.1.0

  core-js-compat@3.43.0:
    resolution: {integrity: sha512-2GML2ZsCc5LR7hZYz4AXmjQw8zuy2T//2QntwdnpuYI7jteT6GVYJL7F6C2C57R7gSYrcqVW3lAALefdbhBLDA==}

  core-util-is@1.0.3:
    resolution: {integrity: sha512-ZQBvi1DcpJ4GDqanjucZ2Hj3wEO5pZDS89BWbkcrvdxksJorwUDDZamX9ldFkp9aw2lmBDLgkObEA4DWNJ9FYQ==}

  cosmiconfig@7.1.0:
    resolution: {integrity: sha512-AdmX6xUzdNASswsFtmwSt7Vj8po9IuqXm0UXz7QKPuEUmPB4XyjGfaAr2PSuELMwkRMVH1EpIkX5bTZGRB3eCA==}
    engines: {node: '>=10'}

  cross-spawn@7.0.6:
    resolution: {integrity: sha512-uV2QOWP2nWzsy2aMp8aRibhi9dlzF5Hgh5SHaB9OiTGEyDTiJJyx0uy51QXdyWbtAHNua4XJzUKca3OzKUd3vA==}
    engines: {node: '>= 8'}

  css-declaration-sorter@7.2.0:
    resolution: {integrity: sha512-h70rUM+3PNFuaBDTLe8wF/cdWu+dOZmb7pJt8Z2sedYbAcQVQV/tEchueg3GWxwqS0cxtbxmaHEdkNACqcvsow==}
    engines: {node: ^14 || ^16 || >=18}
    peerDependencies:
      postcss: ^8.0.9

  css-loader@6.11.0:
    resolution: {integrity: sha512-CTJ+AEQJjq5NzLga5pE39qdiSV56F8ywCIsqNIRF0r7BDgWsN25aazToqAFg7ZrtA/U016xudB3ffgweORxX7g==}
    engines: {node: '>= 12.13.0'}
    peerDependencies:
      '@rspack/core': 0.x || 1.x
      webpack: ^5.0.0
    peerDependenciesMeta:
      '@rspack/core':
        optional: true
      webpack:
        optional: true

  css-minimizer-webpack-plugin@5.0.1:
    resolution: {integrity: sha512-3caImjKFQkS+ws1TGcFn0V1HyDJFq1Euy589JlD6/3rV2kj+w7r5G9WDMgSHvpvXHNZ2calVypZWuEDQd9wfLg==}
    engines: {node: '>= 14.15.0'}
    peerDependencies:
      '@parcel/css': '*'
      '@swc/css': '*'
      clean-css: '*'
      csso: '*'
      esbuild: '*'
      lightningcss: '*'
      webpack: ^5.0.0
    peerDependenciesMeta:
      '@parcel/css':
        optional: true
      '@swc/css':
        optional: true
      clean-css:
        optional: true
      csso:
        optional: true
      esbuild:
        optional: true
      lightningcss:
        optional: true

  css-select@5.1.0:
    resolution: {integrity: sha512-nwoRF1rvRRnnCqqY7updORDsuqKzqYJ28+oSMaJMMgOauh3fvwHqMS7EZpIPqK8GL+g9mKxF1vP/ZjSeNjEVHg==}

  css-tree@2.2.1:
    resolution: {integrity: sha512-OA0mILzGc1kCOCSJerOeqDxDQ4HOh+G8NbOJFOTgOCzpw7fCBubk0fEyxp8AgOL/jvLgYA/uV0cMbe43ElF1JA==}
    engines: {node: ^10 || ^12.20.0 || ^14.13.0 || >=15.0.0, npm: '>=7.0.0'}

  css-tree@2.3.1:
    resolution: {integrity: sha512-6Fv1DV/TYw//QF5IzQdqsNDjx/wc8TrMBZsqjL9eW01tWb7R7k/mq+/VXfJCl7SoD5emsJop9cOByJZfs8hYIw==}
    engines: {node: ^10 || ^12.20.0 || ^14.13.0 || >=15.0.0}

  css-what@6.1.0:
    resolution: {integrity: sha512-HTUrgRJ7r4dsZKU6GjmpfRK1O76h97Z8MfS1G0FozR+oF2kG6Vfe8JE6zwrkbxigziPHinCJ+gCPjA9EaBDtRw==}
    engines: {node: '>= 6'}

  cssesc@3.0.0:
    resolution: {integrity: sha512-/Tb/JcjK111nNScGob5MNtsntNM1aCNUDipB/TkwZFhyDrrE47SOx/18wF2bbjgc3ZzCSKW1T5nt5EbFoAz/Vg==}
    engines: {node: '>=4'}
    hasBin: true

  cssnano-preset-default@6.1.2:
    resolution: {integrity: sha512-1C0C+eNaeN8OcHQa193aRgYexyJtU8XwbdieEjClw+J9d94E41LwT6ivKH0WT+fYwYWB0Zp3I3IZ7tI/BbUbrg==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.4.31

  cssnano-utils@4.0.2:
    resolution: {integrity: sha512-ZR1jHg+wZ8o4c3zqf1SIUSTIvm/9mU343FMR6Obe/unskbvpGhZOo1J6d/r8D1pzkRQYuwbcH3hToOuoA2G7oQ==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.4.31

  cssnano@6.1.2:
    resolution: {integrity: sha512-rYk5UeX7VAM/u0lNqewCdasdtPK81CgX8wJFLEIXHbV2oldWRgJAsZrdhRXkV1NJzA2g850KiFm9mMU2HxNxMA==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.4.31

  csso@5.0.5:
    resolution: {integrity: sha512-0LrrStPOdJj+SPCCrGhzryycLjwcgUSHBtxNA8aIDxf0GLsRh1cKYhB00Gd1lDOS4yGH69+SNn13+TWbVHETFQ==}
    engines: {node: ^10 || ^12.20.0 || ^14.13.0 || >=15.0.0, npm: '>=7.0.0'}

  debug@2.6.9:
    resolution: {integrity: sha512-bC7ElrdJaJnPbAP+1EotYvqZsb3ecl5wi6Bfi6BJTUcNowp6cvspg0jXznRTKDjm/E7AdgFBVeAPVMNcKGsHMA==}
    peerDependencies:
      supports-color: '*'
    peerDependenciesMeta:
      supports-color:
        optional: true

  debug@4.4.1:
    resolution: {integrity: sha512-KcKCqiftBJcZr++7ykoDIEwSa3XWowTfNPo92BYxjXiyYEVrUQh2aLyhxBCwww+heortUFxEJYcRzosstTEBYQ==}
    engines: {node: '>=6.0'}
    peerDependencies:
      supports-color: '*'
    peerDependenciesMeta:
      supports-color:
        optional: true

  deepmerge@4.3.1:
    resolution: {integrity: sha512-3sUqbMEc77XqpdNO7FRyRog+eW3ph+GYCbj+rK+uYyRMuwsVy0rMiVtPn+QJlKFvWP/1PYpapqYn0Me2knFn+A==}
    engines: {node: '>=0.10.0'}

  default-browser-id@5.0.0:
    resolution: {integrity: sha512-A6p/pu/6fyBcA1TRz/GqWYPViplrftcW2gZC9q79ngNCKAeR/X3gcEdXQHl4KNXV+3wgIJ1CPkJQ3IHM6lcsyA==}
    engines: {node: '>=18'}

  default-browser@5.2.1:
    resolution: {integrity: sha512-WY/3TUME0x3KPYdRRxEJJvXRHV4PyPoUsxtZa78lwItwRQRHhd2U9xOscaT/YTf8uCXIAjeJOFBVEh/7FtD8Xg==}
    engines: {node: '>=18'}

  defaults@1.0.4:
    resolution: {integrity: sha512-eFuaLoy/Rxalv2kr+lqMlUnrDWV+3j4pljOIJgLIhI058IQfWJ7vXhyEIHu+HtC738klGALYxOKDO0bQP3tg8A==}

  define-lazy-prop@2.0.0:
    resolution: {integrity: sha512-Ds09qNh8yw3khSjiJjiUInaGX9xlqZDY7JVryGxdxV7NPeuqQfplOpQ66yJFZut3jLa5zOwkXw1g9EI2uKh4Og==}
    engines: {node: '>=8'}

  define-lazy-prop@3.0.0:
    resolution: {integrity: sha512-N+MeXYoqr3pOgn8xfyRPREN7gHakLYjhsHhWGT3fWAiL4IkAt0iDw14QiiEm2bE30c5XX5q0FtAA3CK5f9/BUg==}
    engines: {node: '>=12'}

  delayed-stream@1.0.0:
    resolution: {integrity: sha512-ZySD7Nf91aLB0RxL4KGrKHBXl7Eds1DAmEdcoVawXnLD7SDhpNgtuII2aAkg7a7QS41jxPSZ17p4VdGnMHk3MQ==}
    engines: {node: '>=0.4.0'}

  depd@1.1.2:
    resolution: {integrity: sha512-7emPTl6Dpo6JRXOXjLRxck+FlLRX5847cLKEn00PLAgc3g2hTZZgr+e4c2v6QpSmLeFP3n5yUo7ft6avBK/5jQ==}
    engines: {node: '>= 0.6'}

  depd@2.0.0:
    resolution: {integrity: sha512-g7nH6P6dyDioJogAAGprGpCtVImJhpPk/roCzdb3fIh61/s/nPsfR6onyMwkCAR/OlC3yBC0lESvUoQEAssIrw==}
    engines: {node: '>= 0.8'}

  destroy@1.2.0:
    resolution: {integrity: sha512-2sJGJTaXIIaR1w4iJSNoN0hnMY7Gpc/n8D4qSCJw8QqFWXf7cuAgnEHxBpweaVcPevC2l3KpjYCx3NypQQgaJg==}
    engines: {node: '>= 0.8', npm: 1.2.8000 || >= 1.4.16}

  detect-libc@1.0.3:
    resolution: {integrity: sha512-pGjwhsmsp4kL2RTz08wcOlGN83otlqHeD/Z5T8GXZB+/YcpQ/dgo+lbU8ZsGxV0HIvqqxo9l7mqYwyYMD9bKDg==}
    engines: {node: '>=0.10'}
    hasBin: true

  detect-node@2.1.0:
    resolution: {integrity: sha512-T0NIuQpnTvFDATNuHN5roPwSBG83rFsuO+MXXH9/3N1eFbn4wcPjttvjMLEPWJ0RGUYgQE7cGgS3tNxbqCGM7g==}

  detect-port@1.6.1:
    resolution: {integrity: sha512-CmnVc+Hek2egPx1PeTFVta2W78xy2K/9Rkf6cC4T59S50tVnzKj+tnx5mmx5lwvCkujZ4uRrpRSuV+IVs3f90Q==}
    engines: {node: '>= 4.0.0'}
    hasBin: true

  diff-sequences@29.6.3:
    resolution: {integrity: sha512-EjePK1srD3P08o2j4f0ExnylqRs5B9tJjcp9t1krH2qRi8CCdsYfwe9JgSLurFBWwq4uOlipzfk5fHNvwFKr8Q==}
    engines: {node: ^14.15.0 || ^16.10.0 || >=18.0.0}

  dir-glob@3.0.1:
    resolution: {integrity: sha512-WkrWp9GR4KXfKGYzOLmTuGVi1UWFfws377n9cc55/tb6DuqyF6pcQ5AbiHEshaDpY9v6oaSr2XCDidGmMwdzIA==}
    engines: {node: '>=8'}

  dns-packet@5.6.1:
    resolution: {integrity: sha512-l4gcSouhcgIKRvyy99RNVOgxXiicE+2jZoNmaNmZ6JXiGajBOJAesk1OBlJuM5k2c+eudGdLxDqXuPCKIj6kpw==}
    engines: {node: '>=6'}

  dom-serializer@2.0.0:
    resolution: {integrity: sha512-wIkAryiqt/nV5EQKqQpo3SToSOV9J0DnbJqwK7Wv/Trc92zIAYZ4FlMu+JPFW1DfGFt81ZTCGgDEabffXeLyJg==}

  domelementtype@2.3.0:
    resolution: {integrity: sha512-OLETBj6w0OsagBwdXnPdN0cnMfF9opN69co+7ZrbfPGrdpPVNBUj02spi6B1N7wChLQiPn4CSH/zJvXw56gmHw==}

  domhandler@5.0.3:
    resolution: {integrity: sha512-cgwlv/1iFQiFnU96XXgROh8xTeetsnJiDsTc7TYCLFd9+/WNkIqPTxiM/8pSd8VIrhXGTf1Ny1q1hquVqDJB5w==}
    engines: {node: '>= 4'}

  domutils@3.2.2:
    resolution: {integrity: sha512-6kZKyUajlDuqlHKVX1w7gyslj9MPIXzIFiz/rGu35uC1wMi+kMhQwGhl4lt9unC9Vb9INnY9Z3/ZA3+FhASLaw==}

  dotenv-expand@11.0.7:
    resolution: {integrity: sha512-zIHwmZPRshsCdpMDyVsqGmgyP0yT8GAgXUnkdAoJisxvf33k7yO6OuoKmcTGuXPWSsm8Oh88nZicRLA9Y0rUeA==}
    engines: {node: '>=12'}

  dotenv@16.4.7:
    resolution: {integrity: sha512-47qPchRCykZC03FhkYAhrvwU4xDBFIj1QPqaarj6mdM/hgUzfPHcpkHJOn3mJAufFeeAxAzeGsr5X0M4k6fLZQ==}
    engines: {node: '>=12'}

  dunder-proto@1.0.1:
    resolution: {integrity: sha512-KIN/nDJBQRcXw0MLVhZE9iQHmG68qAVIBg9CqmUYjmQIhgij9U5MFvrqkUL5FbtyyzZuOeOt0zdeRe4UY7ct+A==}
    engines: {node: '>= 0.4'}

  eastasianwidth@0.2.0:
    resolution: {integrity: sha512-I88TYZWc9XiYHRQ4/3c5rjjfgkjhLyW2luGIheGERbNQ6OY7yTybanSpDXZa8y7VUP9YmDcYa+eyq4ca7iLqWA==}

  ee-first@1.1.1:
    resolution: {integrity: sha512-WMwm9LhRUo+WUaRN+vRuETqG89IgZphVSNkdFgeb6sS/E4OrDIN7t48CAewSHXc6C8lefD8KKfr5vY61brQlow==}

  ejs@3.1.10:
    resolution: {integrity: sha512-UeJmFfOrAQS8OJWPZ4qtgHyWExa088/MtK5UEyoJGFH67cDEXkZSviOiKRCZ4Xij0zxI3JECgYs3oKx+AizQBA==}
    engines: {node: '>=0.10.0'}
    hasBin: true

  electron-to-chromium@1.5.165:
    resolution: {integrity: sha512-naiMx1Z6Nb2TxPU6fiFrUrDTjyPMLdTtaOd2oLmG8zVSg2hCWGkhPyxwk+qRmZ1ytwVqUv0u7ZcDA5+ALhaUtw==}

  emoji-regex@8.0.0:
    resolution: {integrity: sha512-MSjYzcWNOA0ewAHpz0MxpYFvwg6yjy1NG3xteoqz644VCo/RPgnr1/GGt+ic3iJTzQ8Eu3TdM14SawnVUmGE6A==}

  emoji-regex@9.2.2:
    resolution: {integrity: sha512-L18DaJsXSUk2+42pv8mLs5jJT2hqFkFE4j21wOmgbUqsZ2hL72NsUU785g9RXgo3s0ZNgVl42TiHp3ZtOv/Vyg==}

  emojis-list@3.0.0:
    resolution: {integrity: sha512-/kyM18EfinwXZbno9FyUGeFh87KC8HRQBQGildHZbEuRyWFOmv1U10o9BBp8XVZDVNNuQKyIGIu5ZYAAXJ0V2Q==}
    engines: {node: '>= 4'}

  encodeurl@1.0.2:
    resolution: {integrity: sha512-TPJXq8JqFaVYm2CWmPvnP2Iyo4ZSM7/QKcSmuMLDObfpH5fi7RUGmd/rTDf+rut/saiDiQEeVTNgAmJEdAOx0w==}
    engines: {node: '>= 0.8'}

  encodeurl@2.0.0:
    resolution: {integrity: sha512-Q0n9HRi4m6JuGIV1eFlmvJB7ZEVxu93IrMyiMsGC0lrMJMWzRgx6WGquyfQgZVb31vhGgXnfmPNNXmxnOkRBrg==}
    engines: {node: '>= 0.8'}

  end-of-stream@1.4.4:
    resolution: {integrity: sha512-+uw1inIHVPQoaVuHzRyXd21icM+cnt4CzD5rW+NC1wjOUSTOs+Te7FOv7AhN7vS9x/oIyhLP5PR1H+phQAHu5Q==}

  enhanced-resolve@5.18.1:
    resolution: {integrity: sha512-ZSW3ma5GkcQBIpwZTSRAI8N71Uuwgs93IezB7mf7R60tC8ZbJideoDNKjHn2O9KIlx6rkGTTEk1xUCK2E1Y2Yg==}
    engines: {node: '>=10.13.0'}

  enquirer@2.3.6:
    resolution: {integrity: sha512-yjNnPr315/FjS4zIsUxYguYUPP2e1NK4d7E7ZOLiyYCcbFBiTMyID+2wvm2w6+pZ/odMA7cRkjhsPbltwBOrLg==}
    engines: {node: '>=8.6'}

  entities@4.5.0:
    resolution: {integrity: sha512-V0hjH4dGPh9Ao5p0MoRY6BVqtwCjhz6vI5LT8AJ55H+4g9/4vbHx1I54fS0XuclLhDHArPQCiMjDxjaL8fPxhw==}
    engines: {node: '>=0.12'}

  errno@0.1.8:
    resolution: {integrity: sha512-dJ6oBr5SQ1VSd9qkk7ByRgb/1SH4JZjCHSW/mr63/QcXO9zLVxvJ6Oy13nio03rxpSnVDDjFor75SjVeZWPW/A==}
    hasBin: true

  error-ex@1.3.2:
    resolution: {integrity: sha512-7dFHNmqeFSEt2ZBsCriorKnn3Z2pj+fd9kmI6QoWw4//DL+icEBfc0U7qJCisqrTsKTjw4fNFy2pW9OqStD84g==}

  es-define-property@1.0.1:
    resolution: {integrity: sha512-e3nRfgfUZ4rNGL232gUgX06QNyyez04KdjFrF+LTRoOXmrOgFKDg4BCdsjW8EnT69eqdYGmRpJwiPVYNrCaW3g==}
    engines: {node: '>= 0.4'}

  es-errors@1.3.0:
    resolution: {integrity: sha512-Zf5H2Kxt2xjTvbJvP2ZWLEICxA6j+hAmMzIlypy4xcBg1vKVnx89Wy0GbS+kf5cwCVFFzdCFh2XSCFNULS6csw==}
    engines: {node: '>= 0.4'}

  es-module-lexer@1.7.0:
    resolution: {integrity: sha512-jEQoCwk8hyb2AZziIOLhDqpm5+2ww5uIE6lkO/6jcOCusfk6LhMHpXXfBLXTZ7Ydyt0j4VoUQv6uGNYbdW+kBA==}

  es-object-atoms@1.1.1:
    resolution: {integrity: sha512-FGgH2h8zKNim9ljj7dankFPcICIK9Cp5bm+c2gQSYePhpaG5+esrLODihIorn+Pe6FGJzWhXQotPv73jTaldXA==}
    engines: {node: '>= 0.4'}

  es-set-tostringtag@2.1.0:
    resolution: {integrity: sha512-j6vWzfrGVfyXxge+O0x5sh6cvxAog0a/4Rdd2K36zCMV5eJ+/+tOAngRO8cODMNWbVRdVlmGZQL2YS3yR8bIUA==}
    engines: {node: '>= 0.4'}

  escalade@3.2.0:
    resolution: {integrity: sha512-WUj2qlxaQtO4g6Pq5c29GTcWGDyd8itL8zTlipgECz3JesAiiOKotd8JU6otB3PACgG6xkJUyVhboMS+bje/jA==}
    engines: {node: '>=6'}

  escape-html@1.0.3:
    resolution: {integrity: sha512-NiSupZ4OeuGwr68lGIeym/ksIZMJodUGOSCZ/FSnTxcrekbvqrgdUxlJOMpijaKZVjAJrWrGs/6Jy8OMuyj9ow==}

  escape-string-regexp@1.0.5:
    resolution: {integrity: sha512-vbRorB5FUQWvla16U8R/qgaFIya2qGzwDrNmCZuYKrbdSUMG6I1ZCGQRefkRVhuOkIGVne7BQ35DSfo1qvJqFg==}
    engines: {node: '>=0.8.0'}

  eslint-scope@5.1.1:
    resolution: {integrity: sha512-2NxwbF/hZ0KpepYN0cNbo+FN6XoK7GaHlQhgx/hIZl6Va0bF45RQOOwhLIy8lQDbuCiadSLCBnH2CFYquit5bw==}
    engines: {node: '>=8.0.0'}

  esprima@4.0.1:
    resolution: {integrity: sha512-eGuFFw7Upda+g4p+QHvnW0RyTX/SVeJBDM/gCtMARO0cLuT2HcEKnTPvhjV6aGeqrCB/sbNop0Kszm0jsaWU4A==}
    engines: {node: '>=4'}
    hasBin: true

  esquery@1.6.0:
    resolution: {integrity: sha512-ca9pw9fomFcKPvFLXhBKUK90ZvGibiGOvRJNbjljY7s7uq/5YO4BOzcYtJqExdx99rF6aAcnRxHmcUHcz6sQsg==}
    engines: {node: '>=0.10'}

  esrecurse@4.3.0:
    resolution: {integrity: sha512-KmfKL3b6G+RXvP8N1vr3Tq1kL/oCFgn2NYXEtqP8/L3pKapUA4G8cFVaoF3SU323CD4XypR/ffioHmkti6/Tag==}
    engines: {node: '>=4.0'}

  estraverse@4.3.0:
    resolution: {integrity: sha512-39nnKffWz8xN1BU/2c79n9nB9HDzo0niYUqx6xyqUnyoAnQyyWpOTdZEeiCch8BBu515t4wp9ZmgVfVhn9EBpw==}
    engines: {node: '>=4.0'}

  estraverse@5.3.0:
    resolution: {integrity: sha512-MMdARuVEQziNTeJD8DgMqmhwR11BRQ/cBP+pLtYdSTnf3MIO8fFeiINEbX36ZdNlfU/7A9f3gUw49B3oQsvwBA==}
    engines: {node: '>=4.0'}

  esutils@2.0.3:
    resolution: {integrity: sha512-kVscqXk4OCp68SZ0dkgEKVi6/8ij300KBWTJq32P/dYeWTSwK41WyTxalN1eRmA5Z9UU/LX9D7FWSmV9SAYx6g==}
    engines: {node: '>=0.10.0'}

  etag@1.8.1:
    resolution: {integrity: sha512-aIL5Fx7mawVa300al2BnEE4iNvo1qETxLrPI/o05L7z6go7fCw1J6EQmbK4FmJ2AS7kgVF/KEZWufBfdClMcPg==}
    engines: {node: '>= 0.6'}

  eventemitter3@4.0.7:
    resolution: {integrity: sha512-8guHBZCwKnFhYdHr2ysuRWErTwhoN2X8XELRlrRwpmfeY2jjuUN4taQMsULKUVo1K4DvZl+0pgfyoysHxvmvEw==}

  events@3.3.0:
    resolution: {integrity: sha512-mQw+2fkQbALzQ7V0MY0IqdnXNOeTtP4r0lN9z7AAawCXgqea7bDii20AYrIBrFd/Hx0M2Ocz6S111CaFkUcb0Q==}
    engines: {node: '>=0.8.x'}

  express@4.21.2:
    resolution: {integrity: sha512-28HqgMZAmih1Czt9ny7qr6ek2qddF4FclbMzwhCREB6OFfH+rXAnuNCwo1/wFvrtbgsQDb4kSbX9de9lFbrXnA==}
    engines: {node: '>= 0.10.0'}

  fast-deep-equal@3.1.3:
    resolution: {integrity: sha512-f3qQ9oQy9j2AhBe/H9VC91wLmKBCCU/gDOnKNAYG5hswO7BLKj09Hc5HYNz9cGI++xlpDCIgDaitVs03ATR84Q==}

  fast-glob@3.3.3:
    resolution: {integrity: sha512-7MptL8U0cqcFdzIzwOTHoilX9x5BrNqye7Z/LuC7kCMRio1EMSyqRK3BEAUD7sXRq4iT4AzTVuZdhgQ2TCvYLg==}
    engines: {node: '>=8.6.0'}

  fast-json-stable-stringify@2.1.0:
    resolution: {integrity: sha512-lhd/wF+Lk98HZoTCtlVraHtfh5XYijIjalXck7saUtuanSDyLMxnHhSXEDJqHxD7msR8D0uCmqlkwjCV8xvwHw==}

  fast-uri@3.0.6:
    resolution: {integrity: sha512-Atfo14OibSv5wAp4VWNsFYE1AchQRTv9cBGWET4pZWHzYshFSS9NQI6I57rdKn9croWVMbYFbLhJ+yJvmZIIHw==}

  fastq@1.19.1:
    resolution: {integrity: sha512-GwLTyxkCXjXbxqIhTsMI2Nui8huMPtnxg7krajPJAjnEG/iiOS7i+zCtWGZR9G0NBKbXKh6X9m9UIsYX/N6vvQ==}

  faye-websocket@0.11.4:
    resolution: {integrity: sha512-CzbClwlXAuiRQAlUyfqPgvPoNKTckTPGfwZV4ZdAhVcP2lh9KUxJg2b5GkE7XbjKQ3YJnQ9z6D9ntLAlB+tP8g==}
    engines: {node: '>=0.8.0'}

  fdir@6.4.5:
    resolution: {integrity: sha512-4BG7puHpVsIYxZUbiUE3RqGloLaSSwzYie5jvasC4LWuBWzZawynvYouhjbQKw2JuIGYdm0DzIxl8iVidKlUEw==}
    peerDependencies:
      picomatch: ^3 || ^4
    peerDependenciesMeta:
      picomatch:
        optional: true

  figures@3.2.0:
    resolution: {integrity: sha512-yaduQFRKLXYOGgEn6AZau90j3ggSOyiqXU0F9JZfeXYhNa+Jk4X+s45A2zg5jns87GAFa34BBm2kXw4XpNcbdg==}
    engines: {node: '>=8'}

  filelist@1.0.4:
    resolution: {integrity: sha512-w1cEuf3S+DrLCQL7ET6kz+gmlJdbq9J7yXCSjK/OZCPA+qEN1WyF4ZAf0YYJa4/shHJra2t/d/r8SV4Ji+x+8Q==}

  fill-range@7.1.1:
    resolution: {integrity: sha512-YsGpe3WHLK8ZYi4tWDg2Jy3ebRz2rXowDxnld4bkQB00cc/1Zw9AWnC0i9ztDJitivtQvaI9KaLyKrc+hBW0yg==}
    engines: {node: '>=8'}

  finalhandler@1.3.1:
    resolution: {integrity: sha512-6BN9trH7bp3qvnrRyzsBz+g3lZxTNZTbVO2EV1CS0WIcDbawYVdYvGflME/9QP0h0pYlCDBCTjYa9nZzMDpyxQ==}
    engines: {node: '>= 0.8'}

  find-cache-dir@4.0.0:
    resolution: {integrity: sha512-9ZonPT4ZAK4a+1pUPVPZJapbi7O5qbbJPdYw/NOQWZZbVLdDTYM3A4R9z/DpAM08IDaFGsvPgiGZ82WEwUDWjg==}
    engines: {node: '>=14.16'}

  find-up@6.3.0:
    resolution: {integrity: sha512-v2ZsoEuVHYy8ZIlYqwPe/39Cy+cFDzp4dXPaxNvkEuouymu+2Jbz0PxpKarJHYJTmv2HWT3O382qY8l4jMWthw==}
    engines: {node: ^12.20.0 || ^14.13.1 || >=16.0.0}

  flat@5.0.2:
    resolution: {integrity: sha512-b6suED+5/3rTpUBdG1gupIl8MPFCAMA0QXwmljLhvCUKcUvdE4gWky9zpuGCcXHOsz4J9wPGNWq6OKpmIzz3hQ==}
    hasBin: true

  follow-redirects@1.15.9:
    resolution: {integrity: sha512-gew4GsXizNgdoRyqmyfMHyAmXsZDk6mHkSxZFCzW9gwlbtOW44CDtYavM+y+72qD/Vq2l550kMF52DT8fOLJqQ==}
    engines: {node: '>=4.0'}
    peerDependencies:
      debug: '*'
    peerDependenciesMeta:
      debug:
        optional: true

  foreground-child@3.3.1:
    resolution: {integrity: sha512-gIXjKqtFuWEgzFRJA9WCQeSJLZDjgJUOMCMzxtvFq/37KojM1BFGufqsCy0r4qSQmYLsZYMeyRqzIWOMup03sw==}
    engines: {node: '>=14'}

  fork-ts-checker-webpack-plugin@7.2.13:
    resolution: {integrity: sha512-fR3WRkOb4bQdWB/y7ssDUlVdrclvwtyCUIHCfivAoYxq9dF7XfrDKbMdZIfwJ7hxIAqkYSGeU7lLJE6xrxIBdg==}
    engines: {node: '>=12.13.0', yarn: '>=1.0.0'}
    peerDependencies:
      typescript: '>3.6.0'
      vue-template-compiler: '*'
      webpack: ^5.11.0
    peerDependenciesMeta:
      vue-template-compiler:
        optional: true

  form-data@4.0.3:
    resolution: {integrity: sha512-qsITQPfmvMOSAdeyZ+12I1c+CKSstAFAwu+97zrnWAbIr5u8wfsExUzCesVLC8NgHuRUqNN4Zy6UPWUTRGslcA==}
    engines: {node: '>= 6'}

  forwarded@0.2.0:
    resolution: {integrity: sha512-buRG0fpBtRHSTCOASe6hD258tEubFoRLb4ZNA6NxMVHNw2gOcwHo9wyablzMzOA5z9xA9L1KNjk/Nt6MT9aYow==}
    engines: {node: '>= 0.6'}

  fraction.js@4.3.7:
    resolution: {integrity: sha512-ZsDfxO51wGAXREY55a7la9LScWpwv9RxIrYABrlvOFBlH/ShPnrtsXeuUIfXKKOVicNxQ+o8JTbJvjS4M89yew==}

  fresh@0.5.2:
    resolution: {integrity: sha512-zJ2mQYM18rEFOudeV4GShTGIQ7RbzA7ozbU9I/XBpm7kqgMywgmylMwXHxZJmkVoYkna9d2pVXVXPdYTP9ej8Q==}
    engines: {node: '>= 0.6'}

  front-matter@4.0.2:
    resolution: {integrity: sha512-I8ZuJ/qG92NWX8i5x1Y8qyj3vizhXS31OxjKDu3LKP+7/qBgfIKValiZIEwoVoJKUHlhWtYrktkxV1XsX+pPlg==}

  fs-constants@1.0.0:
    resolution: {integrity: sha512-y6OAwoSIf7FyjMIv94u+b5rdheZEjzR63GTyZJm5qh4Bi+2YgwLCcI/fPFZkL5PSixOt6ZNKm+w+Hfp/Bciwow==}

  fs-extra@10.1.0:
    resolution: {integrity: sha512-oRXApq54ETRj4eMiFzGnHWGy+zo5raudjuxN0b8H7s/RU2oW0Wvsx9O0ACRN/kRq9E8Vu/ReskGB5o3ji+FzHQ==}
    engines: {node: '>=12'}

  fs-monkey@1.0.6:
    resolution: {integrity: sha512-b1FMfwetIKymC0eioW7mTywihSQE4oLzQn1dB6rZB5fx/3NpNEdAWeCSMB+60/AeT0TCXsxzAlcYVEFCTAksWg==}

  fsevents@2.3.3:
    resolution: {integrity: sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw==}
    engines: {node: ^8.16.0 || ^10.6.0 || >=11.0.0}
    os: [darwin]

  function-bind@1.1.2:
    resolution: {integrity: sha512-7XHNxH7qX9xG5mIwxkhumTox/MIRNcOgDrxWsMt2pAr23WHp6MrRlN7FBSFpCpr+oVO0F744iUgR82nJMfG2SA==}

  gensync@1.0.0-beta.2:
    resolution: {integrity: sha512-3hN7NaskYvMDLQY55gnW3NQ+mesEAepTqlg+VEbj7zzqEMBVNhzcGYYeqFo/TlYz6eQiFcp1HcsCZO+nGgS8zg==}
    engines: {node: '>=6.9.0'}

  get-caller-file@2.0.5:
    resolution: {integrity: sha512-DyFP3BM/3YHTQOCUL/w0OZHR0lpKeGrxotcHWcqNEdnltqFwXVfhEBQ94eIo34AfQpo0rGki4cyIiftY06h2Fg==}
    engines: {node: 6.* || 8.* || >= 10.*}

  get-intrinsic@1.3.0:
    resolution: {integrity: sha512-9fSjSaos/fRIVIp+xSJlE6lfwhES7LNtKaCBIamHsjr2na1BiABJPo0mOjjz8GJDURarmCPGqaiVg5mfjb98CQ==}
    engines: {node: '>= 0.4'}

  get-proto@1.0.1:
    resolution: {integrity: sha512-sTSfBjoXBp89JvIKIefqw7U2CCebsc74kiY6awiGogKtoSGbgjYE/G/+l9sF3MWFPNc9IcoOC4ODfKHfxFmp0g==}
    engines: {node: '>= 0.4'}

  glob-parent@5.1.2:
    resolution: {integrity: sha512-AOIgSQCepiJYwP3ARnGx+5VnTu2HBYdzbGP45eLw1vr3zB3vZLeyed1sC9hnbcOc9/SrMyM5RPQrkGz4aS9Zow==}
    engines: {node: '>= 6'}

  glob-parent@6.0.2:
    resolution: {integrity: sha512-XxwI8EOhVQgWp6iDL+3b0r86f4d6AX6zSU55HfB4ydCEuXLXc5FcYeOu+nnGftS4TEju/11rt4KJPTMgbfmv4A==}
    engines: {node: '>=10.13.0'}

  glob-to-regexp@0.4.1:
    resolution: {integrity: sha512-lkX1HJXwyMcprw/5YUZc2s7DrpAiHB21/V+E1rHUrVNokkvB6bqMzT0VfV6/86ZNabt1k14YOIaT7nDvOX3Iiw==}

  glob@10.4.5:
    resolution: {integrity: sha512-7Bv8RF0k6xjo7d4A/PxYLbUCfb6c+Vpd2/mB2yRDlew7Jb5hEXiCD9ibfO7wpk8i4sevK6DFny9h7EYbM3/sHg==}
    hasBin: true

  globals@11.12.0:
    resolution: {integrity: sha512-WOBp/EEGUiIsJSp7wcv/y6MO+lV9UoncWqxuFfm8eBwzWNgyfBd6Gz+IeKQ9jCmyhoH99g15M3T+QaVHFjizVA==}
    engines: {node: '>=4'}

  globby@12.2.0:
    resolution: {integrity: sha512-wiSuFQLZ+urS9x2gGPl1H5drc5twabmm4m2gTR27XDFyjUHJUNsS8o/2aKyIF6IoBaR630atdher0XJ5g6OMmA==}
    engines: {node: ^12.20.0 || ^14.13.1 || >=16.0.0}

  gopd@1.2.0:
    resolution: {integrity: sha512-ZUKRh6/kUFoAiTAtTYPZJ3hw9wNxx+BIBOijnlG9PnrJsCcSjs1wyyD6vJpaYtgnzDrKYRSqf3OO6Rfa93xsRg==}
    engines: {node: '>= 0.4'}

  graceful-fs@4.2.11:
    resolution: {integrity: sha512-RbJ5/jmFcNNCcDV5o9eTnBLJ/HszWV0P73bc+Ff4nS/rJj+YaS6IGyiOL0VoBYX+l1Wrl3k63h/KrH+nhJ0XvQ==}

  handle-thing@2.0.1:
    resolution: {integrity: sha512-9Qn4yBxelxoh2Ow62nP+Ka/kMnOXRi8BXnRaUwezLNhqelnN49xKz4F/dPP8OYLxLxq6JDtZb2i9XznUQbNPTg==}

  has-flag@4.0.0:
    resolution: {integrity: sha512-EykJT/Q1KjTWctppgIAgfSO0tKVuZUjhgMr17kqTumMl6Afv3EISleU7qZUzoXDFTAHTDC4NOoG/ZxU3EvlMPQ==}
    engines: {node: '>=8'}

  has-symbols@1.1.0:
    resolution: {integrity: sha512-1cDNdwJ2Jaohmb3sg4OmKaMBwuC48sYni5HUw2DvsC8LjGTLK9h+eb1X6RyuOHe4hT0ULCW68iomhjUoKUqlPQ==}
    engines: {node: '>= 0.4'}

  has-tostringtag@1.0.2:
    resolution: {integrity: sha512-NqADB8VjPFLM2V0VvHUewwwsw0ZWBaIdgo+ieHtK3hasLz4qeCRjYcqfB6AQrBggRKppKF8L52/VqdVsO47Dlw==}
    engines: {node: '>= 0.4'}

  hasown@2.0.2:
    resolution: {integrity: sha512-0hJU9SCPvmMzIBdZFqNPXWa6dqh7WdH0cII9y+CyS8rG3nL48Bclra9HmKhVVUHyPWNH5Y7xDwAB7bfgSjkUMQ==}
    engines: {node: '>= 0.4'}

  hosted-git-info@7.0.2:
    resolution: {integrity: sha512-puUZAUKT5m8Zzvs72XWy3HtvVbTWljRE66cP60bxJzAqf2DgICo7lYTY2IHUmLnNpjYvw5bvmoHvPc0QO2a62w==}
    engines: {node: ^16.14.0 || >=18.0.0}

  hpack.js@2.1.6:
    resolution: {integrity: sha512-zJxVehUdMGIKsRaNt7apO2Gqp0BdqW5yaiGHXXmbpvxgBYVZnAql+BJb4RO5ad2MgpbZKn5G6nMnegrH1FcNYQ==}

  http-deceiver@1.2.7:
    resolution: {integrity: sha512-LmpOGxTfbpgtGVxJrj5k7asXHCgNZp5nLfp+hWc8QQRqtb7fUy6kRY3BO1h9ddF6yIPYUARgxGOwB42DnxIaNw==}

  http-errors@1.6.3:
    resolution: {integrity: sha512-lks+lVC8dgGyh97jxvxeYTWQFvh4uw4yC12gVl63Cg30sjPX4wuGcdkICVXDAESr6OJGjqGA8Iz5mkeN6zlD7A==}
    engines: {node: '>= 0.6'}

  http-errors@2.0.0:
    resolution: {integrity: sha512-FtwrG/euBzaEjYeRqOgly7G0qviiXoJWnvEH2Z1plBdXgbyjv34pHTSb9zoeHMyDy33+DWy5Wt9Wo+TURtOYSQ==}
    engines: {node: '>= 0.8'}

  http-parser-js@0.5.10:
    resolution: {integrity: sha512-Pysuw9XpUq5dVc/2SMHpuTY01RFl8fttgcyunjL7eEMhGM3cI4eOmiCycJDVCo/7O7ClfQD3SaI6ftDzqOXYMA==}

  http-proxy-middleware@2.0.9:
    resolution: {integrity: sha512-c1IyJYLYppU574+YI7R4QyX2ystMtVXZwIdzazUIPIJsHuWNd+mho2j+bKoHftndicGj9yh+xjd+l0yj7VeT1Q==}
    engines: {node: '>=12.0.0'}
    peerDependencies:
      '@types/express': ^4.17.13
    peerDependenciesMeta:
      '@types/express':
        optional: true

  http-proxy@1.18.1:
    resolution: {integrity: sha512-7mz/721AbnJwIVbnaSv1Cz3Am0ZLT/UBwkC92VlxhXv/k/BBQfM2fXElQNC27BVGr0uwUpplYPQM9LnaBMR5NQ==}
    engines: {node: '>=8.0.0'}

  hyperdyperid@1.2.0:
    resolution: {integrity: sha512-Y93lCzHYgGWdrJ66yIktxiaGULYc6oGiABxhcO5AufBeOyoIdZF7bIfLaOrbM0iGIOXQQgxxRrFEnb+Y6w1n4A==}
    engines: {node: '>=10.18'}

  iconv-lite@0.4.24:
    resolution: {integrity: sha512-v3MXnZAcvnywkTUEZomIActle7RXXeedOR31wwl7VlyoXO4Qi9arvSenNQWne1TcRwhCL1HwLI21bEqdpj8/rA==}
    engines: {node: '>=0.10.0'}

  iconv-lite@0.6.3:
    resolution: {integrity: sha512-4fCk79wshMdzMp2rH06qWrJE4iolqLhCUH+OiuIgU++RB0+94NlDL81atO7GX55uUKueo0txHNtvEyI6D7WdMw==}
    engines: {node: '>=0.10.0'}

  icss-utils@5.1.0:
    resolution: {integrity: sha512-soFhflCVWLfRNOPU3iv5Z9VUdT44xFRbzjLsEzSr5AQmgqPMTHdU3PMT1Cf1ssx8fLNJDA1juftYl+PUcv3MqA==}
    engines: {node: ^10 || ^12 || >= 14}
    peerDependencies:
      postcss: ^8.1.0

  ieee754@1.2.1:
    resolution: {integrity: sha512-dcyqhDvX1C46lXZcVqCpK+FtMRQVdIMN6/Df5js2zouUsqG7I6sFxitIC+7KYK29KdXOLHdu9zL4sFnoVQnqaA==}

  ignore@5.3.2:
    resolution: {integrity: sha512-hsBTNUqQTDwkWtcdYI2i06Y/nUBEsNEDJKjWdigLvegy8kDuJAS8uRlpkkcQpyEXL0Z/pjDy5HBmMjRCJ2gq+g==}
    engines: {node: '>= 4'}

  image-size@0.5.5:
    resolution: {integrity: sha512-6TDAlDPZxUFCv+fuOkIoXT/V/f3Qbq8e37p+YOiYrUv3v9cc3/6x78VdfPgFVaB9dZYeLUfKgHRebpkm/oP2VQ==}
    engines: {node: '>=0.10.0'}
    hasBin: true

  immutable@5.1.2:
    resolution: {integrity: sha512-qHKXW1q6liAk1Oys6umoaZbDRqjcjgSrbnrifHsfsttza7zcvRAsL7mMV6xWcyhwQy7Xj5v4hhbr6b+iDYwlmQ==}

  import-fresh@3.3.1:
    resolution: {integrity: sha512-TR3KfrTZTYLPB6jUjfx6MF9WcWrHL9su5TObK4ZkYgBdWKPOFoSoQIdEuTuR82pmtxH2spWG9h6etwfr1pLBqQ==}
    engines: {node: '>=6'}

  inherits@2.0.3:
    resolution: {integrity: sha512-x00IRNXNy63jwGkJmzPigoySHbaqpNuzKbBOmzK+g2OdZpQ9w+sxCN+VSB3ja7IAge2OP2qpfxTjeNcyjmW1uw==}

  inherits@2.0.4:
    resolution: {integrity: sha512-k/vGaX4/Yla3WzyMCvTQOXYeIHvqOKtnqBduzTHpzpQZzAskKMhZ2K+EnBiSM9zGSoIFeMpXKxa4dYeZIQqewQ==}

  ipaddr.js@1.9.1:
    resolution: {integrity: sha512-0KI/607xoxSToH7GjN1FfSbLoU0+btTicjsQSWQlh/hZykN8KpmMf7uYwPW3R+akZ6R/w18ZlXSHBYXiYUPO3g==}
    engines: {node: '>= 0.10'}

  ipaddr.js@2.2.0:
    resolution: {integrity: sha512-Ag3wB2o37wslZS19hZqorUnrnzSkpOVy+IiiDEiTqNubEYpYuHWIf6K4psgN2ZWKExS4xhVCrRVfb/wfW8fWJA==}
    engines: {node: '>= 10'}

  is-arrayish@0.2.1:
    resolution: {integrity: sha512-zz06S8t0ozoDXMG+ube26zeCTNXcKIPJZJi8hBrF4idCLms4CG9QtK7qBl1boi5ODzFpjswb5JPmHCbMpjaYzg==}

  is-binary-path@2.1.0:
    resolution: {integrity: sha512-ZMERYes6pDydyuGidse7OsHxtbI7WVeUEozgR/g7rd0xUimYNlvZRE/K2MgZTjWy725IfelLeVcEM97mmtRGXw==}
    engines: {node: '>=8'}

  is-core-module@2.16.1:
    resolution: {integrity: sha512-UfoeMA6fIJ8wTYFEUjelnaGI67v6+N7qXJEvQuIGa99l4xsCruSYOVSQ0uPANn4dAzm8lkYPaKLrrijLq7x23w==}
    engines: {node: '>= 0.4'}

  is-docker@2.2.1:
    resolution: {integrity: sha512-F+i2BKsFrH66iaUFc0woD8sLy8getkwTwtOBjvs56Cx4CgJDeKQeqfz8wAYiSb8JOprWhHH5p77PbmYCvvUuXQ==}
    engines: {node: '>=8'}
    hasBin: true

  is-docker@3.0.0:
    resolution: {integrity: sha512-eljcgEDlEns/7AXFosB5K/2nCM4P7FQPkGc/DWLy5rmFEWvZayGrik1d9/QIY5nJ4f9YsVvBkA6kJpHn9rISdQ==}
    engines: {node: ^12.20.0 || ^14.13.1 || >=16.0.0}
    hasBin: true

  is-extglob@2.1.1:
    resolution: {integrity: sha512-SbKbANkN603Vi4jEZv49LeVJMn4yGwsbzZworEoyEiutsN3nJYdbO36zfhGJ6QEDpOZIFkDtnq5JRxmvl3jsoQ==}
    engines: {node: '>=0.10.0'}

  is-fullwidth-code-point@3.0.0:
    resolution: {integrity: sha512-zymm5+u+sCsSWyD9qNaejV3DFvhCKclKdizYaJUuHA83RLjb7nSuGnddCHGv0hk+KY7BMAlsWeK4Ueg6EV6XQg==}
    engines: {node: '>=8'}

  is-glob@4.0.3:
    resolution: {integrity: sha512-xelSayHH36ZgE7ZWhli7pW34hNbNl8Ojv5KVmkJD4hBdD3th8Tfk9vYasLM+mXWOZhFkgZfxhLSnrwRr4elSSg==}
    engines: {node: '>=0.10.0'}

  is-inside-container@1.0.0:
    resolution: {integrity: sha512-KIYLCCJghfHZxqjYBE7rEy0OBuTd5xCHS7tHVgvCLkx7StIoaxwNW3hCALgEUjFfeRk+MG/Qxmp/vtETEF3tRA==}
    engines: {node: '>=14.16'}
    hasBin: true

  is-interactive@1.0.0:
    resolution: {integrity: sha512-2HvIEKRoqS62guEC+qBjpvRubdX910WCMuJTZ+I9yvqKU2/12eSL549HMwtabb4oupdj2sMP50k+XJfB/8JE6w==}
    engines: {node: '>=8'}

  is-network-error@1.1.0:
    resolution: {integrity: sha512-tUdRRAnhT+OtCZR/LxZelH/C7QtjtFrTu5tXCA8pl55eTUElUHT+GPYV8MBMBvea/j+NxQqVt3LbWMRir7Gx9g==}
    engines: {node: '>=16'}

  is-number@7.0.0:
    resolution: {integrity: sha512-41Cifkg6e8TylSpdtTpeLVMqvSBEVzTttHvERD741+pnZ8ANv0004MRL43QKPDlK9cGvNp6NZWZUBlbGXYxxng==}
    engines: {node: '>=0.12.0'}

  is-plain-obj@3.0.0:
    resolution: {integrity: sha512-gwsOE28k+23GP1B6vFl1oVh/WOzmawBrKwo5Ev6wMKzPkaXaCDIQKzLnvsA42DRlbVTWorkgTKIviAKCWkfUwA==}
    engines: {node: '>=10'}

  is-unicode-supported@0.1.0:
    resolution: {integrity: sha512-knxG2q4UC3u8stRGyAVJCOdxFmv5DZiRcdlIaAQXAbSfJya+OhopNotLQrstBhququ4ZpuKbDc/8S6mgXgPFPw==}
    engines: {node: '>=10'}

  is-what@3.14.1:
    resolution: {integrity: sha512-sNxgpk9793nzSs7bA6JQJGeIuRBQhAaNGG77kzYQgMkrID+lS6SlK07K5LaptscDlSaIgH+GPFzf+d75FVxozA==}

  is-wsl@2.2.0:
    resolution: {integrity: sha512-fKzAra0rGJUUBwGBgNkHZuToZcn+TtXHpeCgmkMJMMYx1sQDYaCSyjJBSCa2nH1DGm7s3n1oBnohoVTBaN7Lww==}
    engines: {node: '>=8'}

  is-wsl@3.1.0:
    resolution: {integrity: sha512-UcVfVfaK4Sc4m7X3dUSoHoozQGBEFeDC+zVo06t98xe8CzHSZZBekNXH+tu0NalHolcJ/QAGqS46Hef7QXBIMw==}
    engines: {node: '>=16'}

  isarray@1.0.0:
    resolution: {integrity: sha512-VLghIWNM6ELQzo7zwmcg0NmTVyWKYjvIeM83yjp0wRDTmUnrM678fQbcKBo6n2CJEF0szoG//ytg+TKla89ALQ==}

  isexe@2.0.0:
    resolution: {integrity: sha512-RHxMLp9lnKHGHRng9QFhRCMbYAcVpn69smSGcq3f36xjgVVWThj4qqLbTLlq7Ssj8B+fIQ1EuCEGI2lKsyQeIw==}

  jackspeak@3.4.3:
    resolution: {integrity: sha512-OGlZQpz2yfahA/Rd1Y8Cd9SIEsqvXkLVoSw/cgwhnhFMDbsQFeZYoJJ7bIZBS9BcamUW96asq/npPWugM+RQBw==}

  jake@10.9.2:
    resolution: {integrity: sha512-2P4SQ0HrLQ+fw6llpLnOaGAvN2Zu6778SJMrCUwns4fOoG9ayrTiZk3VV8sCPkVZF8ab0zksVpS8FDY5pRCNBA==}
    engines: {node: '>=10'}
    hasBin: true

  jest-diff@29.7.0:
    resolution: {integrity: sha512-LMIgiIrhigmPrs03JHpxUh2yISK3vLFPkAodPeo0+BuF7wA2FoQbkEg1u8gBYBThncu7e1oEDUfIXVuTqLRUjw==}
    engines: {node: ^14.15.0 || ^16.10.0 || >=18.0.0}

  jest-get-type@29.6.3:
    resolution: {integrity: sha512-zrteXnqYxfQh7l5FHyL38jL39di8H8rHoecLH3JNxH3BwOrBsNeabdap5e0I23lD4HHI8W5VFBZqG4Eaq5LNcw==}
    engines: {node: ^14.15.0 || ^16.10.0 || >=18.0.0}

  jest-util@29.7.0:
    resolution: {integrity: sha512-z6EbKajIpqGKU56y5KBUgy1dt1ihhQJgWzUlZHArA/+X2ad7Cb5iF+AK1EWVL/Bo7Rz9uurpqw6SiBCefUbCGA==}
    engines: {node: ^14.15.0 || ^16.10.0 || >=18.0.0}

  jest-worker@27.5.1:
    resolution: {integrity: sha512-7vuh85V5cdDofPyxn58nrPjBktZo0u9x1g8WtjQol+jZDaE+fhN+cIvTj11GndBnMnyfrUOG1sZQxCdjKh+DKg==}
    engines: {node: '>= 10.13.0'}

  jest-worker@29.7.0:
    resolution: {integrity: sha512-eIz2msL/EzL9UFTFFx7jBTkeZfku0yUAyZZZmJ93H2TYEiroIx2PQjEXcwYtYl8zXCxb+PAmA2hLIt/6ZEkPHw==}
    engines: {node: ^14.15.0 || ^16.10.0 || >=18.0.0}

  js-tokens@4.0.0:
    resolution: {integrity: sha512-RdJUflcE3cUzKiMqQgsCu06FPu9UdIJO0beYbPhHN4k6apgJtifcoCtT9bcxOpYBtpD2kCM6Sbzg4CausW/PKQ==}

  js-yaml@3.14.1:
    resolution: {integrity: sha512-okMH7OXXJ7YrN9Ok3/SXrnu4iX9yOk+25nqX4imS2npuvTYDmo/QEZoqwZkYaIDk3jVvBOTOIEgEhaLOynBS9g==}
    hasBin: true

  jsesc@3.0.2:
    resolution: {integrity: sha512-xKqzzWXDttJuOcawBt4KnKHHIf5oQ/Cxax+0PWFG+DFDgHNAdi+TXECADI+RYiFUMmx8792xsMbbgXj4CwnP4g==}
    engines: {node: '>=6'}
    hasBin: true

  jsesc@3.1.0:
    resolution: {integrity: sha512-/sM3dO2FOzXjKQhJuo0Q173wf2KOo8t4I8vHy6lF9poUp7bKT0/NHE8fPX23PwfhnykfqnC2xRxOnVw5XuGIaA==}
    engines: {node: '>=6'}
    hasBin: true

  json-parse-even-better-errors@2.3.1:
    resolution: {integrity: sha512-xyFwyhro/JEof6Ghe2iz2NcXoj2sloNsWr/XsERDK/oiPCfaNhl5ONfp+jQdAZRQQ0IJWNzH9zIZF7li91kh2w==}

  json-schema-traverse@0.4.1:
    resolution: {integrity: sha512-xbbCH5dCYU5T8LcEhhuh7HJ88HXuW3qsI3Y0zOZFKfZEHcpWiHU/Jxzk629Brsab/mMiHQti9wMP+845RPe3Vg==}

  json-schema-traverse@1.0.0:
    resolution: {integrity: sha512-NM8/P9n3XjXhIZn1lLhkFaACTOURQXjWhV4BA/RnOv8xvgqtqpAX9IO4mRQxSx1Rlo4tqzeqb0sOlruaOy3dug==}

  json5@2.2.3:
    resolution: {integrity: sha512-XmOWe7eyHYH14cLdVPoyg+GOH3rYX++KpzrylJwSW98t3Nk+U8XOl8FWKOgwtzdb8lXGf6zYwDUzeHMWfxasyg==}
    engines: {node: '>=6'}
    hasBin: true

  jsonc-parser@3.2.0:
    resolution: {integrity: sha512-gfFQZrcTc8CnKXp6Y4/CBT3fTc0OVuDofpre4aEeEpSBPV5X5v4+Vmx+8snU7RLPrNHPKSgLxGo9YuQzz20o+w==}

  jsonfile@6.1.0:
    resolution: {integrity: sha512-5dgndWOriYSm5cnYaJNhalLNDKOqFwyDB/rr1E9ZsGciGvKPs8R2xYGCacuf3z6K1YKDz182fd+fY3cn3pMqXQ==}

  klona@2.0.6:
    resolution: {integrity: sha512-dhG34DXATL5hSxJbIexCft8FChFXtmskoZYnoPWjXQuebWYCNkVeV3KkGegCK9CP1oswI/vQibS2GY7Em/sJJA==}
    engines: {node: '>= 8'}

  launch-editor@2.10.0:
    resolution: {integrity: sha512-D7dBRJo/qcGX9xlvt/6wUYzQxjh5G1RvZPgPv8vi4KRU99DVQL/oW7tnVOCCTm2HGeo3C5HvGE5Yrh6UBoZ0vA==}

  less-loader@11.1.0:
    resolution: {integrity: sha512-C+uDBV7kS7W5fJlUjq5mPBeBVhYpTIm5gB09APT9o3n/ILeaXVsiSFTbZpTJCJwQ/Crczfn3DmfQFwxYusWFug==}
    engines: {node: '>= 14.15.0'}
    peerDependencies:
      less: ^3.5.0 || ^4.0.0
      webpack: ^5.0.0

  less@4.1.3:
    resolution: {integrity: sha512-w16Xk/Ta9Hhyei0Gpz9m7VS8F28nieJaL/VyShID7cYvP6IL5oHeL6p4TXSDJqZE/lNv0oJ2pGVjJsRkfwm5FA==}
    engines: {node: '>=6'}
    hasBin: true

  license-webpack-plugin@4.0.2:
    resolution: {integrity: sha512-771TFWFD70G1wLTC4oU2Cw4qvtmNrIw+wRvBtn+okgHl7slJVi7zfNcdmqDL72BojM30VNJ2UHylr1o77U37Jw==}
    peerDependencies:
      webpack: '*'
    peerDependenciesMeta:
      webpack:
        optional: true

  lilconfig@3.1.3:
    resolution: {integrity: sha512-/vlFKAoH5Cgt3Ie+JLhRbwOsCQePABiU3tJ1egGvyQ+33R/vcwM2Zl2QR/LzjsBeItPt3oSVXapn+m4nQDvpzw==}
    engines: {node: '>=14'}

  lines-and-columns@1.2.4:
    resolution: {integrity: sha512-7ylylesZQ/PV29jhEDl3Ufjo6ZX7gCqJr5F7PKrqc93v7fzSymt1BpwEU8nAUXs8qzzvqhbjhK5QZg6Mt/HkBg==}

  lines-and-columns@2.0.3:
    resolution: {integrity: sha512-cNOjgCnLB+FnvWWtyRTzmB3POJ+cXxTA81LoW7u8JdmhfXzriropYwpjShnz1QLLWsQwY7nIxoDmcPTwphDK9w==}
    engines: {node: ^12.20.0 || ^14.13.1 || >=16.0.0}

  loader-runner@4.3.0:
    resolution: {integrity: sha512-3R/1M+yS3j5ou80Me59j7F9IMs4PXs3VqRrm0TU3AbKPxlmpoY1TNscJV/oGJXo8qCatFGTfDbY6W6ipGOYXfg==}
    engines: {node: '>=6.11.5'}

  loader-utils@2.0.4:
    resolution: {integrity: sha512-xXqpXoINfFhgua9xiqD8fPFHgkoq1mmmpE92WlDbm9rNRd/EbRb+Gqf908T2DMfuHjjJlksiK2RbHVOdD/MqSw==}
    engines: {node: '>=8.9.0'}

  locate-path@7.2.0:
    resolution: {integrity: sha512-gvVijfZvn7R+2qyPX8mAuKcFGDf6Nc61GdvGafQsHL0sBIxfKzA+usWn4GFC/bk+QdwPUD4kWFJLhElipq+0VA==}
    engines: {node: ^12.20.0 || ^14.13.1 || >=16.0.0}

  lodash.debounce@4.0.8:
    resolution: {integrity: sha512-FT1yDzDYEoYWhnSGnpE/4Kj1fLZkDFyqRb7fNt6FdYOSxlUWAtp42Eh6Wb0rGIv/m9Bgo7x4GhQbm5Ys4SG5ow==}

  lodash.memoize@4.1.2:
    resolution: {integrity: sha512-t7j+NzmgnQzTAYXcsHYLgimltOV1MXHtlOWf6GjL9Kj8GK5FInw5JotxvbOs+IvV1/Dzo04/fCGfLVs7aXb4Ag==}

  lodash.uniq@4.5.0:
    resolution: {integrity: sha512-xfBaXQd9ryd9dlSDvnvI0lvxfLJlYAZzXomUYzLKtUeOQvOP5piqAWuGtrhWeqaXK9hhoM/iyJc5AV+XfsX3HQ==}

  lodash@4.17.21:
    resolution: {integrity: sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg==}

  log-symbols@4.1.0:
    resolution: {integrity: sha512-8XPvpAA8uyhfteu8pIvQxpJZ7SYYdpUivZpGy6sFsBuKRY/7rQGavedeB8aK+Zkyq6upMFVL/9AW6vOYzfRyLg==}
    engines: {node: '>=10'}

  lru-cache@10.4.3:
    resolution: {integrity: sha512-JNAzZcXrCt42VGLuYz0zfAzDfAvJWW6AfYlDBQyDV5DClI2m5sAmK+OIO7s59XfsRsWHp02jAJrRadPRGTt6SQ==}

  lru-cache@5.1.1:
    resolution: {integrity: sha512-KpNARQA3Iwv+jTA0utUVVbrh+Jlrr1Fv0e56GGzAFOXN7dk/FviaDW8LHmK52DlcH4WP2n6gI8vN1aesBFgo9w==}

  make-dir@2.1.0:
    resolution: {integrity: sha512-LS9X+dc8KLxXCb8dni79fLIIUA5VyZoyjSMCwTluaXA0o27cCK0bhXkpgw+sTXVpPy/lSO57ilRixqk0vDmtRA==}
    engines: {node: '>=6'}

  math-intrinsics@1.1.0:
    resolution: {integrity: sha512-/IXtbwEk5HTPyEwyKX6hGkYXxM9nbj64B+ilVJnC/R6B0pH5G4V3b0pVbL7DBj4tkhBAppbQUlf6F6Xl9LHu1g==}
    engines: {node: '>= 0.4'}

  mdn-data@2.0.28:
    resolution: {integrity: sha512-aylIc7Z9y4yzHYAJNuESG3hfhC+0Ibp/MAMiaOZgNv4pmEdFyfZhhhny4MNiAfWdBQ1RQ2mfDWmM1x8SvGyp8g==}

  mdn-data@2.0.30:
    resolution: {integrity: sha512-GaqWWShW4kv/G9IEucWScBx9G1/vsFZZJUO+tD26M8J8z3Kw5RDQjaoZe03YAClgeS/SWPOcb4nkFBTEi5DUEA==}

  media-typer@0.3.0:
    resolution: {integrity: sha512-dq+qelQ9akHpcOl/gUVRTxVIOkAJ1wR3QAvb4RsVjS8oVoFjDGTc679wJYmUmknUF5HwMLOgb5O+a3KxfWapPQ==}
    engines: {node: '>= 0.6'}

  memfs@3.5.3:
    resolution: {integrity: sha512-UERzLsxzllchadvbPs5aolHh65ISpKpM+ccLbOJ8/vvpBKmAWf+la7dXFy7Mr0ySHbdHrFv5kGFCUHHe6GFEmw==}
    engines: {node: '>= 4.0.0'}

  memfs@4.17.2:
    resolution: {integrity: sha512-NgYhCOWgovOXSzvYgUW0LQ7Qy72rWQMGGFJDoWg4G30RHd3z77VbYdtJ4fembJXBy8pMIUA31XNAupobOQlwdg==}
    engines: {node: '>= 4.0.0'}

  merge-descriptors@1.0.3:
    resolution: {integrity: sha512-gaNvAS7TZ897/rVaZ0nMtAyxNyi/pdbjbAwUpFQpN70GqnVfOiXpeUUMKRBmzXaSQ8DdTX4/0ms62r2K+hE6mQ==}

  merge-stream@2.0.0:
    resolution: {integrity: sha512-abv/qOcuPfk3URPfDzmZU1LKmuw8kT+0nIHvKrKgFrwifol/doWcdA4ZqsWQ8ENrFKkd67Mfpo/LovbIUsbt3w==}

  merge2@1.4.1:
    resolution: {integrity: sha512-8q7VEgMJW4J8tcfVPy8g09NcQwZdbwFEqhe/WZkoIzjn/3TGDwtOCYtXGxA3O8tPzpczCCDgv+P2P5y00ZJOOg==}
    engines: {node: '>= 8'}

  methods@1.1.2:
    resolution: {integrity: sha512-iclAHeNqNm68zFtnZ0e+1L2yUIdvzNoauKU4WBA3VvH/vPFieF7qfRlwUZU+DA9P9bPXIS90ulxoUoCH23sV2w==}
    engines: {node: '>= 0.6'}

  micromatch@4.0.8:
    resolution: {integrity: sha512-PXwfBhYu0hBCPw8Dn0E+WDYb7af3dSLVWKi3HGv84IdF4TyFoC0ysxFd0Goxw7nSv4T/PzEJQxsYsEiFCKo2BA==}
    engines: {node: '>=8.6'}

  mime-db@1.52.0:
    resolution: {integrity: sha512-sPU4uV7dYlvtWJxwwxHD0PuihVNiE7TyAbQ5SWxDCB9mUYvOgroQOwYQQOKPJ8CIbE+1ETVlOoK1UC2nU3gYvg==}
    engines: {node: '>= 0.6'}

  mime-db@1.54.0:
    resolution: {integrity: sha512-aU5EJuIN2WDemCcAp2vFBfp/m4EAhWJnUNSSw0ixs7/kXbd6Pg64EmwJkNdFhB8aWt1sH2CTXrLxo/iAGV3oPQ==}
    engines: {node: '>= 0.6'}

  mime-types@2.1.35:
    resolution: {integrity: sha512-ZDY+bPm5zTTF+YpCrAU9nK0UgICYPT0QtT1NZWFv4s++TNkcgVaT0g6+4R2uI4MjQjzysHB1zxuWL50hzaeXiw==}
    engines: {node: '>= 0.6'}

  mime@1.6.0:
    resolution: {integrity: sha512-x0Vn8spI+wuJ1O6S7gnbaQg8Pxh4NNHb7KSINmEWKiPE4RKOplvijn+NkmYmmRgP68mc70j2EbeTFRsrswaQeg==}
    engines: {node: '>=4'}
    hasBin: true

  mimic-fn@2.1.0:
    resolution: {integrity: sha512-OqbOk5oEQeAZ8WXWydlu9HJjz9WVdEIvamMCcXmuqUYjTknH/sqsWvhQ3vgwKFRR1HpjvNBKQ37nbJgYzGqGcg==}
    engines: {node: '>=6'}

  mini-css-extract-plugin@2.4.7:
    resolution: {integrity: sha512-euWmddf0sk9Nv1O0gfeeUAvAkoSlWncNLF77C0TP2+WoPvy8mAHKOzMajcCz2dzvyt3CNgxb1obIEVFIRxaipg==}
    engines: {node: '>= 12.13.0'}
    peerDependencies:
      webpack: ^5.0.0

  minimalistic-assert@1.0.1:
    resolution: {integrity: sha512-UtJcAD4yEaGtjPezWuO9wC4nwUnVH/8/Im3yEHQP4b67cXlD/Qr9hdITCU1xDbSEXg2XKNaP8jsReV7vQd00/A==}

  minimatch@3.1.2:
    resolution: {integrity: sha512-J7p63hRiAjw1NDEww1W7i37+ByIrOWO5XQQAzZ3VOcL0PNybwpfmV/N05zFAzwQ9USyEcX6t3UO+K5aqBQOIHw==}

  minimatch@5.1.6:
    resolution: {integrity: sha512-lKwV/1brpG6mBUFHtb7NUmtABCb2WZZmm2wNiOA5hAb8VdCS4B3dtMWyvcoViccwAW/COERjXLt0zP1zXUN26g==}
    engines: {node: '>=10'}

  minimatch@9.0.3:
    resolution: {integrity: sha512-RHiac9mvaRw0x3AYRgDC1CxAP7HTcNrrECeA8YYJeWnpo+2Q5CegtZjaotWTWxDG3UeGA1coE05iH1mPjT/2mg==}
    engines: {node: '>=16 || 14 >=14.17'}

  minimatch@9.0.5:
    resolution: {integrity: sha512-G6T0ZX48xgozx7587koeX9Ys2NYy6Gmv//P89sEte9V9whIapMNF4idKxnW2QtCcLiTWlb/wfCabAtAFWhhBow==}
    engines: {node: '>=16 || 14 >=14.17'}

  minimist@1.2.8:
    resolution: {integrity: sha512-2yyAR8qBkN3YuheJanUpWC5U3bb5osDywNB8RzDVlDwDHbocAJveqqj1u8+SVD7jkWT4yvsHCpWqqWqAxb0zCA==}

  minipass@7.1.2:
    resolution: {integrity: sha512-qOOzS1cBTWYF4BH8fVePDBOO9iptMnGUEZwNc/cMWnTV2nVLZ7VoNWEPHkYczZA0pdoA7dl6e7FL659nX9S2aw==}
    engines: {node: '>=16 || 14 >=14.17'}

  ms@2.0.0:
    resolution: {integrity: sha512-Tpp60P6IUJDTuOq/5Z8cdskzJujfwqfOTkrwIwj7IRISpnkJnT6SyJ4PCPnGMoFjC9ddhal5KVIYtAt97ix05A==}

  ms@2.1.3:
    resolution: {integrity: sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==}

  multicast-dns@7.2.5:
    resolution: {integrity: sha512-2eznPJP8z2BFLX50tf0LuODrpINqP1RVIm/CObbTcBRITQgmC/TjcREF1NeTBzIcR5XO/ukWo+YHOjBbFwIupg==}
    hasBin: true

  nanoid@3.3.11:
    resolution: {integrity: sha512-N8SpfPUnUp1bK+PMYW8qSWdl9U+wwNWI4QKxOYDy9JAro3WMX7p2OeVRF9v+347pnakNevPmiHhNmZ2HbFA76w==}
    engines: {node: ^10 || ^12 || ^13.7 || ^14 || >=15.0.1}
    hasBin: true

  needle@3.3.1:
    resolution: {integrity: sha512-6k0YULvhpw+RoLNiQCRKOl09Rv1dPLr8hHnVjHqdolKwDrdNyk+Hmrthi4lIGPPz3r39dLx0hsF5s40sZ3Us4Q==}
    engines: {node: '>= 4.4.x'}
    hasBin: true

  negotiator@0.6.3:
    resolution: {integrity: sha512-+EUsqGPLsM+j/zdChZjsnX51g4XrHFOIXwfnCVPGlQk/k5giakcKsuxCObBRu6DSm9opw/O6slWbJdghQM4bBg==}
    engines: {node: '>= 0.6'}

  negotiator@0.6.4:
    resolution: {integrity: sha512-myRT3DiWPHqho5PrJaIRyaMv2kgYf0mUVgBNOYMuCH5Ki1yEiQaf/ZJuQ62nvpc44wL5WDbTX7yGJi1Neevw8w==}
    engines: {node: '>= 0.6'}

  neo-async@2.6.2:
    resolution: {integrity: sha512-Yd3UES5mWCSqR+qNT93S3UoYUkqAZ9lLg8a7g9rimsWmYGK8cVToA4/sF3RrshdyV3sAGMXVUmpMYOw+dLpOuw==}

  node-abort-controller@3.1.1:
    resolution: {integrity: sha512-AGK2yQKIjRuqnc6VkX2Xj5d+QW8xZ87pa1UK6yA6ouUyuxfHuMP6umE5QK7UmTeOAymo+Zx1Fxiuw9rVx8taHQ==}

  node-addon-api@7.1.1:
    resolution: {integrity: sha512-5m3bsyrjFWE1xf7nz7YXdN4udnVtXK6/Yfgn5qnahL6bCkf2yKt4k3nuTKAtT4r3IG8JNR2ncsIMdZuAzJjHQQ==}

  node-forge@1.3.1:
    resolution: {integrity: sha512-dPEtOeMvF9VMcYV/1Wb8CPoVAXtp6MKMlcbAt4ddqmGqUJ6fQZFXkNZNkNlfevtNkGtaSoXf/vNNNSvgrdXwtA==}
    engines: {node: '>= 6.13.0'}

  node-machine-id@1.1.12:
    resolution: {integrity: sha512-QNABxbrPa3qEIfrE6GOJ7BYIuignnJw7iQ2YPbc3Nla1HzRJjXzZOiikfF8m7eAMfichLt3M4VgLOetqgDmgGQ==}

  node-releases@2.0.19:
    resolution: {integrity: sha512-xxOWJsBKtzAq7DY0J+DTzuz58K8e7sJbdgwkbMWQe8UYB6ekmsQ45q0M/tJDsGaZmbC+l7n57UV8Hl5tHxO9uw==}

  normalize-path@3.0.0:
    resolution: {integrity: sha512-6eZs5Ls3WtCisHWp9S2GUy8dqkpGi4BVSz3GaqiE6ezub0512ESztXUwUB6C6IKbQkY2Pnb/mD4WYojCRwcwLA==}
    engines: {node: '>=0.10.0'}

  normalize-range@0.1.2:
    resolution: {integrity: sha512-bdok/XvKII3nUpklnV6P2hxtMNrCboOjAcyBuQnWEhO665FwrSNRxU+AqpsyvO6LgGYPspN+lu5CLtw4jPRKNA==}
    engines: {node: '>=0.10.0'}

  npm-package-arg@11.0.1:
    resolution: {integrity: sha512-M7s1BD4NxdAvBKUPqqRW957Xwcl/4Zvo8Aj+ANrzvIPzGJZElrH7Z//rSaec2ORcND6FHHLnZeY8qgTpXDMFQQ==}
    engines: {node: ^16.14.0 || >=18.0.0}

  npm-run-path@4.0.1:
    resolution: {integrity: sha512-S48WzZW777zhNIrn7gxOlISNAqi9ZC/uQFnRdbeIHhZhCA6UqpkOT8T1G7BvfdgP4Er8gF4sUbaS0i7QvIfCWw==}
    engines: {node: '>=8'}

  nth-check@2.1.1:
    resolution: {integrity: sha512-lqjrjmaOoAnWfMmBPL+XNnynZh2+swxiX3WUE0s4yEHI6m+AwrK2UZOimIRl3X/4QctVqS8AiZjFqyOGrMXb/w==}

  nx@21.1.2:
    resolution: {integrity: sha512-oczAEOOkQHElxCXs2g2jXDRabDRsmub/h5SAgqAUDSJ2CRnYGVVlgZX7l+o+A9kSqfONyLy5FlJ1pSWlvPuG4w==}
    hasBin: true
    peerDependencies:
      '@swc-node/register': ^1.8.0
      '@swc/core': ^1.3.85
    peerDependenciesMeta:
      '@swc-node/register':
        optional: true
      '@swc/core':
        optional: true

  nx@21.1.3:
    resolution: {integrity: sha512-GZ7+Bve4xOVIk/hb9nN16fVqVq5PNNyFom1SCQbEGhGkyABJF8kA4JImCKhZpZyg1CtZeUrkPHK4xNO+rw9G5w==}
    hasBin: true
    peerDependencies:
      '@swc-node/register': ^1.8.0
      '@swc/core': ^1.3.85
    peerDependenciesMeta:
      '@swc-node/register':
        optional: true
      '@swc/core':
        optional: true

  object-inspect@1.13.4:
    resolution: {integrity: sha512-W67iLl4J2EXEGTbfeHCffrjDfitvLANg0UlX3wFUUSTx92KXRFegMHUVgSqE+wvhAbi4WqjGg9czysTV2Epbew==}
    engines: {node: '>= 0.4'}

  obuf@1.1.2:
    resolution: {integrity: sha512-PX1wu0AmAdPqOL1mWhqmlOd8kOIZQwGZw6rh7uby9fTc5lhaOWFLX3I6R1hrF9k3zUY40e6igsLGkDXK92LJNg==}

  on-finished@2.4.1:
    resolution: {integrity: sha512-oVlzkg3ENAhCk2zdv7IJwd/QUD4z2RxRwpkcGY8psCVcCYZNq4wYnVWALHM+brtuJjePWiYF/ClmuDr8Ch5+kg==}
    engines: {node: '>= 0.8'}

  on-headers@1.0.2:
    resolution: {integrity: sha512-pZAE+FJLoyITytdqK0U5s+FIpjN0JP3OzFi/u8Rx+EV5/W+JTWGXG8xFzevE7AjBfDqHv/8vL8qQsIhHnqRkrA==}
    engines: {node: '>= 0.8'}

  once@1.4.0:
    resolution: {integrity: sha512-lNaJgI+2Q5URQBkccEKHTQOPaXdUxnZZElQTZY0MFUAuaEqe1E+Nyvgdz/aIyNi6Z9MzO5dv1H8n58/GELp3+w==}

  onetime@5.1.2:
    resolution: {integrity: sha512-kbpaSSGJTWdAY5KPVeMOKXSrPtr8C8C7wodJbcsd51jRnmD+GZu8Y0VoU6Dm5Z4vWr0Ig/1NKuWRKf7j5aaYSg==}
    engines: {node: '>=6'}

  open@10.1.2:
    resolution: {integrity: sha512-cxN6aIDPz6rm8hbebcP7vrQNhvRcveZoJU72Y7vskh4oIm+BZwBECnx5nTmrlres1Qapvx27Qo1Auukpf8PKXw==}
    engines: {node: '>=18'}

  open@8.4.2:
    resolution: {integrity: sha512-7x81NCL719oNbsq/3mh+hVrAWmFuEYUqrq/Iw3kUzH8ReypT9QQ0BLoJS7/G9k6N81XjW4qHWtjWwe/9eLy1EQ==}
    engines: {node: '>=12'}

  ora@5.3.0:
    resolution: {integrity: sha512-zAKMgGXUim0Jyd6CXK9lraBnD3H5yPGBPPOkC23a2BG6hsm4Zu6OQSjQuEtV0BHDf4aKHcUFvJiGRrFuW3MG8g==}
    engines: {node: '>=10'}

  p-limit@4.0.0:
    resolution: {integrity: sha512-5b0R4txpzjPWVw/cXXUResoD4hb6U/x9BH08L7nw+GN1sezDzPdxeRvpc9c433fZhBan/wusjbCsqwqm4EIBIQ==}
    engines: {node: ^12.20.0 || ^14.13.1 || >=16.0.0}

  p-locate@6.0.0:
    resolution: {integrity: sha512-wPrq66Llhl7/4AGC6I+cqxT07LhXvWL08LNXz1fENOw0Ap4sRZZ/gZpTTJ5jpurzzzfS2W/Ge9BY3LgLjCShcw==}
    engines: {node: ^12.20.0 || ^14.13.1 || >=16.0.0}

  p-retry@6.2.1:
    resolution: {integrity: sha512-hEt02O4hUct5wtwg4H4KcWgDdm+l1bOaEy/hWzd8xtXB9BqxTWBBhb+2ImAtH4Cv4rPjV76xN3Zumqk3k3AhhQ==}
    engines: {node: '>=16.17'}

  package-json-from-dist@1.0.1:
    resolution: {integrity: sha512-UEZIS3/by4OC8vL3P2dTXRETpebLI2NiI5vIrjaD/5UtrkFX/tNbwjTSRAGC/+7CAo2pIcBaRgWmcBBHcsaCIw==}

  parent-module@1.0.1:
    resolution: {integrity: sha512-GQ2EWRpQV8/o+Aw8YqtfZZPfNRWZYkbidE9k5rpl/hC3vtHHBfGm2Ifi6qWV+coDGkrUKZAxE3Lot5kcsRlh+g==}
    engines: {node: '>=6'}

  parse-json@5.2.0:
    resolution: {integrity: sha512-ayCKvm/phCGxOkYRSCM82iDwct8/EonSEgCSxWxD7ve6jHggsFl4fZVQBPRNgQoKiuV/odhFrGzQXZwbifC8Rg==}
    engines: {node: '>=8'}

  parse-node-version@1.0.1:
    resolution: {integrity: sha512-3YHlOa/JgH6Mnpr05jP9eDG254US9ek25LyIxZlDItp2iJtwyaXQb57lBYLdT3MowkUFYEV2XXNAYIPlESvJlA==}
    engines: {node: '>= 0.10'}

  parse5@4.0.0:
    resolution: {integrity: sha512-VrZ7eOd3T1Fk4XWNXMgiGBK/z0MG48BWG2uQNU4I72fkQuKUTZpl+u9k+CxEG0twMVzSmXEEz12z5Fnw1jIQFA==}

  parseurl@1.3.3:
    resolution: {integrity: sha512-CiyeOxFT/JZyN5m0z9PfXw4SCBJ6Sygz1Dpl0wqjlhDEGGBP1GnsUVEL0p63hoG1fcj3fHynXi9NYO4nWOL+qQ==}
    engines: {node: '>= 0.8'}

  path-exists@5.0.0:
    resolution: {integrity: sha512-RjhtfwJOxzcFmNOi6ltcbcu4Iu+FL3zEj83dk4kAS+fVpTxXLO1b38RvJgT/0QwvV/L3aY9TAnyv0EOqW4GoMQ==}
    engines: {node: ^12.20.0 || ^14.13.1 || >=16.0.0}

  path-key@3.1.1:
    resolution: {integrity: sha512-ojmeN0qd+y0jszEtoY48r0Peq5dwMEkIlCOu6Q5f41lfkswXuKtYrhgoTpLnyIcHm24Uhqx+5Tqm2InSwLhE6Q==}
    engines: {node: '>=8'}

  path-parse@1.0.7:
    resolution: {integrity: sha512-LDJzPVEEEPR+y48z93A0Ed0yXb8pAByGWo/k5YYdYgpY2/2EsOsksJrq7lOHxryrVOn1ejG6oAp8ahvOIQD8sw==}

  path-scurry@1.11.1:
    resolution: {integrity: sha512-Xa4Nw17FS9ApQFJ9umLiJS4orGjm7ZzwUrwamcGQuHSzDyth9boKDaycYdDcZDuqYATXw4HFXgaqWTctW/v1HA==}
    engines: {node: '>=16 || 14 >=14.18'}

  path-to-regexp@0.1.12:
    resolution: {integrity: sha512-RA1GjUVMnvYFxuqovrEqZoxxW5NUZqbwKtYz/Tt7nXerk0LbLblQmrsgdeOxV5SFHf0UDggjS/bSeOZwt1pmEQ==}

  path-type@4.0.0:
    resolution: {integrity: sha512-gDKb8aZMDeD/tZWs9P6+q0J9Mwkdl6xMV8TjnGP3qJVJ06bdMgkbBlLU8IdfOsIsFz2BW1rNVT3XuNEl8zPAvw==}
    engines: {node: '>=8'}

  picocolors@1.1.1:
    resolution: {integrity: sha512-xceH2snhtb5M9liqDsmEw56le376mTZkEX/jEb/RxNFyegNul7eNslCXP9FDj/Lcu0X8KEyMceP2ntpaHrDEVA==}

  picomatch@2.3.1:
    resolution: {integrity: sha512-JU3teHTNjmE2VCGFzuY8EXzCDVwEqB2a8fsIvwaStHhAWJEeVd1o1QD80CU6+ZdEXXSLbSsuLwJjkCBWqRQUVA==}
    engines: {node: '>=8.6'}

  picomatch@4.0.2:
    resolution: {integrity: sha512-M7BAV6Rlcy5u+m6oPhAPFgJTzAioX/6B0DxyvDlo9l8+T3nLKbrczg2WLUyzd45L8RqfUMyGPzekbMvX2Ldkwg==}
    engines: {node: '>=12'}

  pify@2.3.0:
    resolution: {integrity: sha512-udgsAY+fTnvv7kI7aaxbqwWNb0AHiB0qBO89PZKPkoTmGOgdbrHDKD+0B2X4uTfJ/FT1R09r9gTsjUjNJotuog==}
    engines: {node: '>=0.10.0'}

  pify@4.0.1:
    resolution: {integrity: sha512-uB80kBFb/tfd68bVleG9T5GGsGPjJrLAUpR5PZIrhBnIaRTQRjqdJSsIKkOP6OAIFbj7GOrcudc5pNjZ+geV2g==}
    engines: {node: '>=6'}

  pirates@4.0.7:
    resolution: {integrity: sha512-TfySrs/5nm8fQJDcBDuUng3VOUKsd7S+zqvbOTiGXHfxX4wK31ard+hoNuvkicM/2YFzlpDgABOevKSsB4G/FA==}
    engines: {node: '>= 6'}

  pkg-dir@7.0.0:
    resolution: {integrity: sha512-Ie9z/WINcxxLp27BKOCHGde4ITq9UklYKDzVo1nhk5sqGEXU3FpkwP5GM2voTGJkGd9B3Otl+Q4uwSOeSUtOBA==}
    engines: {node: '>=14.16'}

  postcss-calc@9.0.1:
    resolution: {integrity: sha512-TipgjGyzP5QzEhsOZUaIkeO5mKeMFpebWzRogWG/ysonUlnHcq5aJe0jOjpfzUU8PeSaBQnrE8ehR0QA5vs8PQ==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.2.2

  postcss-colormin@6.1.0:
    resolution: {integrity: sha512-x9yX7DOxeMAR+BgGVnNSAxmAj98NX/YxEMNFP+SDCEeNLb2r3i6Hh1ksMsnW8Ub5SLCpbescQqn9YEbE9554Sw==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.4.31

  postcss-convert-values@6.1.0:
    resolution: {integrity: sha512-zx8IwP/ts9WvUM6NkVSkiU902QZL1bwPhaVaLynPtCsOTqp+ZKbNi+s6XJg3rfqpKGA/oc7Oxk5t8pOQJcwl/w==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.4.31

  postcss-discard-comments@6.0.2:
    resolution: {integrity: sha512-65w/uIqhSBBfQmYnG92FO1mWZjJ4GL5b8atm5Yw2UgrwD7HiNiSSNwJor1eCFGzUgYnN/iIknhNRVqjrrpuglw==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.4.31

  postcss-discard-duplicates@6.0.3:
    resolution: {integrity: sha512-+JA0DCvc5XvFAxwx6f/e68gQu/7Z9ud584VLmcgto28eB8FqSFZwtrLwB5Kcp70eIoWP/HXqz4wpo8rD8gpsTw==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.4.31

  postcss-discard-empty@6.0.3:
    resolution: {integrity: sha512-znyno9cHKQsK6PtxL5D19Fj9uwSzC2mB74cpT66fhgOadEUPyXFkbgwm5tvc3bt3NAy8ltE5MrghxovZRVnOjQ==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.4.31

  postcss-discard-overridden@6.0.2:
    resolution: {integrity: sha512-j87xzI4LUggC5zND7KdjsI25APtyMuynXZSujByMaav2roV6OZX+8AaCUcZSWqckZpjAjRyFDdpqybgjFO0HJQ==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.4.31

  postcss-import@14.1.0:
    resolution: {integrity: sha512-flwI+Vgm4SElObFVPpTIT7SU7R3qk2L7PyduMcokiaVKuWv9d/U+Gm/QAd8NDLuykTWTkcrjOeD2Pp1rMeBTGw==}
    engines: {node: '>=10.0.0'}
    peerDependencies:
      postcss: ^8.0.0

  postcss-loader@6.2.1:
    resolution: {integrity: sha512-WbbYpmAaKcux/P66bZ40bpWsBucjx/TTgVVzRZ9yUO8yQfVBlameJ0ZGVaPfH64hNSBh63a+ICP5nqOpBA0w+Q==}
    engines: {node: '>= 12.13.0'}
    peerDependencies:
      postcss: ^7.0.0 || ^8.0.1
      webpack: ^5.0.0

  postcss-merge-longhand@6.0.5:
    resolution: {integrity: sha512-5LOiordeTfi64QhICp07nzzuTDjNSO8g5Ksdibt44d+uvIIAE1oZdRn8y/W5ZtYgRH/lnLDlvi9F8btZcVzu3w==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.4.31

  postcss-merge-rules@6.1.1:
    resolution: {integrity: sha512-KOdWF0gju31AQPZiD+2Ar9Qjowz1LTChSjFFbS+e2sFgc4uHOp3ZvVX4sNeTlk0w2O31ecFGgrFzhO0RSWbWwQ==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.4.31

  postcss-minify-font-values@6.1.0:
    resolution: {integrity: sha512-gklfI/n+9rTh8nYaSJXlCo3nOKqMNkxuGpTn/Qm0gstL3ywTr9/WRKznE+oy6fvfolH6dF+QM4nCo8yPLdvGJg==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.4.31

  postcss-minify-gradients@6.0.3:
    resolution: {integrity: sha512-4KXAHrYlzF0Rr7uc4VrfwDJ2ajrtNEpNEuLxFgwkhFZ56/7gaE4Nr49nLsQDZyUe+ds+kEhf+YAUolJiYXF8+Q==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.4.31

  postcss-minify-params@6.1.0:
    resolution: {integrity: sha512-bmSKnDtyyE8ujHQK0RQJDIKhQ20Jq1LYiez54WiaOoBtcSuflfK3Nm596LvbtlFcpipMjgClQGyGr7GAs+H1uA==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.4.31

  postcss-minify-selectors@6.0.4:
    resolution: {integrity: sha512-L8dZSwNLgK7pjTto9PzWRoMbnLq5vsZSTu8+j1P/2GB8qdtGQfn+K1uSvFgYvgh83cbyxT5m43ZZhUMTJDSClQ==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.4.31

  postcss-modules-extract-imports@3.1.0:
    resolution: {integrity: sha512-k3kNe0aNFQDAZGbin48pL2VNidTF0w4/eASDsxlyspobzU3wZQLOGj7L9gfRe0Jo9/4uud09DsjFNH7winGv8Q==}
    engines: {node: ^10 || ^12 || >= 14}
    peerDependencies:
      postcss: ^8.1.0

  postcss-modules-local-by-default@4.2.0:
    resolution: {integrity: sha512-5kcJm/zk+GJDSfw+V/42fJ5fhjL5YbFDl8nVdXkJPLLW+Vf9mTD5Xe0wqIaDnLuL2U6cDNpTr+UQ+v2HWIBhzw==}
    engines: {node: ^10 || ^12 || >= 14}
    peerDependencies:
      postcss: ^8.1.0

  postcss-modules-scope@3.2.1:
    resolution: {integrity: sha512-m9jZstCVaqGjTAuny8MdgE88scJnCiQSlSrOWcTQgM2t32UBe+MUmFSO5t7VMSfAf/FJKImAxBav8ooCHJXCJA==}
    engines: {node: ^10 || ^12 || >= 14}
    peerDependencies:
      postcss: ^8.1.0

  postcss-modules-values@4.0.0:
    resolution: {integrity: sha512-RDxHkAiEGI78gS2ofyvCsu7iycRv7oqw5xMWn9iMoR0N/7mf9D50ecQqUo5BZ9Zh2vH4bCUR/ktCqbB9m8vJjQ==}
    engines: {node: ^10 || ^12 || >= 14}
    peerDependencies:
      postcss: ^8.1.0

  postcss-normalize-charset@6.0.2:
    resolution: {integrity: sha512-a8N9czmdnrjPHa3DeFlwqst5eaL5W8jYu3EBbTTkI5FHkfMhFZh1EGbku6jhHhIzTA6tquI2P42NtZ59M/H/kQ==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.4.31

  postcss-normalize-display-values@6.0.2:
    resolution: {integrity: sha512-8H04Mxsb82ON/aAkPeq8kcBbAtI5Q2a64X/mnRRfPXBq7XeogoQvReqxEfc0B4WPq1KimjezNC8flUtC3Qz6jg==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.4.31

  postcss-normalize-positions@6.0.2:
    resolution: {integrity: sha512-/JFzI441OAB9O7VnLA+RtSNZvQ0NCFZDOtp6QPFo1iIyawyXg0YI3CYM9HBy1WvwCRHnPep/BvI1+dGPKoXx/Q==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.4.31

  postcss-normalize-repeat-style@6.0.2:
    resolution: {integrity: sha512-YdCgsfHkJ2jEXwR4RR3Tm/iOxSfdRt7jplS6XRh9Js9PyCR/aka/FCb6TuHT2U8gQubbm/mPmF6L7FY9d79VwQ==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.4.31

  postcss-normalize-string@6.0.2:
    resolution: {integrity: sha512-vQZIivlxlfqqMp4L9PZsFE4YUkWniziKjQWUtsxUiVsSSPelQydwS8Wwcuw0+83ZjPWNTl02oxlIvXsmmG+CiQ==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.4.31

  postcss-normalize-timing-functions@6.0.2:
    resolution: {integrity: sha512-a+YrtMox4TBtId/AEwbA03VcJgtyW4dGBizPl7e88cTFULYsprgHWTbfyjSLyHeBcK/Q9JhXkt2ZXiwaVHoMzA==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.4.31

  postcss-normalize-unicode@6.1.0:
    resolution: {integrity: sha512-QVC5TQHsVj33otj8/JD869Ndr5Xcc/+fwRh4HAsFsAeygQQXm+0PySrKbr/8tkDKzW+EVT3QkqZMfFrGiossDg==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.4.31

  postcss-normalize-url@6.0.2:
    resolution: {integrity: sha512-kVNcWhCeKAzZ8B4pv/DnrU1wNh458zBNp8dh4y5hhxih5RZQ12QWMuQrDgPRw3LRl8mN9vOVfHl7uhvHYMoXsQ==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.4.31

  postcss-normalize-whitespace@6.0.2:
    resolution: {integrity: sha512-sXZ2Nj1icbJOKmdjXVT9pnyHQKiSAyuNQHSgRCUgThn2388Y9cGVDR+E9J9iAYbSbLHI+UUwLVl1Wzco/zgv0Q==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.4.31

  postcss-ordered-values@6.0.2:
    resolution: {integrity: sha512-VRZSOB+JU32RsEAQrO94QPkClGPKJEL/Z9PCBImXMhIeK5KAYo6slP/hBYlLgrCjFxyqvn5VC81tycFEDBLG1Q==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.4.31

  postcss-reduce-initial@6.1.0:
    resolution: {integrity: sha512-RarLgBK/CrL1qZags04oKbVbrrVK2wcxhvta3GCxrZO4zveibqbRPmm2VI8sSgCXwoUHEliRSbOfpR0b/VIoiw==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.4.31

  postcss-reduce-transforms@6.0.2:
    resolution: {integrity: sha512-sB+Ya++3Xj1WaT9+5LOOdirAxP7dJZms3GRcYheSPi1PiTMigsxHAdkrbItHxwYHr4kt1zL7mmcHstgMYT+aiA==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.4.31

  postcss-selector-parser@6.1.2:
    resolution: {integrity: sha512-Q8qQfPiZ+THO/3ZrOrO0cJJKfpYCagtMUkXbnEfmgUjwXg6z/WBeOyS9APBBPCTSiDV+s4SwQGu8yFsiMRIudg==}
    engines: {node: '>=4'}

  postcss-selector-parser@7.1.0:
    resolution: {integrity: sha512-8sLjZwK0R+JlxlYcTuVnyT2v+htpdrjDOKuMcOVdYjt52Lh8hWRYpxBPoKx/Zg+bcjc3wx6fmQevMmUztS/ccA==}
    engines: {node: '>=4'}

  postcss-svgo@6.0.3:
    resolution: {integrity: sha512-dlrahRmxP22bX6iKEjOM+c8/1p+81asjKT+V5lrgOH944ryx/OHpclnIbGsKVd3uWOXFLYJwCVf0eEkJGvO96g==}
    engines: {node: ^14 || ^16 || >= 18}
    peerDependencies:
      postcss: ^8.4.31

  postcss-unique-selectors@6.0.4:
    resolution: {integrity: sha512-K38OCaIrO8+PzpArzkLKB42dSARtC2tmG6PvD4b1o1Q2E9Os8jzfWFfSy/rixsHwohtsDdFtAWGjFVFUdwYaMg==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.4.31

  postcss-value-parser@4.2.0:
    resolution: {integrity: sha512-1NNCs6uurfkVbeXG4S8JFT9t19m45ICnif8zWLd5oPSZ50QnwMfK+H3jv408d4jw/7Bttv5axS5IiHoLaVNHeQ==}

  postcss@8.5.4:
    resolution: {integrity: sha512-QSa9EBe+uwlGTFmHsPKokv3B/oEMQZxfqW0QqNCyhpa6mB1afzulwn8hihglqAb2pOw+BJgNlmXQ8la2VeHB7w==}
    engines: {node: ^10 || ^12 || >=14}

  pretty-format@29.7.0:
    resolution: {integrity: sha512-Pdlw/oPxN+aXdmM9R00JVC9WVFoCLTKJvDVLgmJ+qAffBMxsV85l/Lu7sNx4zSzPyoL2euImuEwHhOXdEgNFZQ==}
    engines: {node: ^14.15.0 || ^16.10.0 || >=18.0.0}

  proc-log@3.0.0:
    resolution: {integrity: sha512-++Vn7NS4Xf9NacaU9Xq3URUuqZETPsf8L4j5/ckhaRYsfPeRyzGw+iDjFhV/Jr3uNmTvvddEJFWh5R1gRgUH8A==}
    engines: {node: ^14.17.0 || ^16.13.0 || >=18.0.0}

  process-nextick-args@2.0.1:
    resolution: {integrity: sha512-3ouUOpQhtgrbOa17J7+uxOTpITYWaGP7/AhoR3+A+/1e9skrzelGi/dXzEYyvbxubEF6Wn2ypscTKiKJFFn1ag==}

  proxy-addr@2.0.7:
    resolution: {integrity: sha512-llQsMLSUDUPT44jdrU/O37qlnifitDP+ZwrmmZcoSKyLKvtZxpyV0n2/bD/N4tBAAZ/gJEdZU7KMraoK1+XYAg==}
    engines: {node: '>= 0.10'}

  proxy-from-env@1.1.0:
    resolution: {integrity: sha512-D+zkORCbA9f1tdWRK0RaCR3GPv50cMxcrz4X8k5LTSUD1Dkw47mKJEZQNunItRTkWwgtaUSo1RVFRIG9ZXiFYg==}

  prr@1.0.1:
    resolution: {integrity: sha512-yPw4Sng1gWghHQWj0B3ZggWUm4qVbPwPFcRG8KyxiU7J2OHFSoEHKS+EZ3fv5l1t9CyCiop6l/ZYeWbrgoQejw==}

  punycode@2.3.1:
    resolution: {integrity: sha512-vYt7UD1U9Wg6138shLtLOvdAu+8DsC/ilFtEVHcH+wydcSpNE20AfSOduf6MkRFahL5FY7X1oU7nKVZFtfq8Fg==}
    engines: {node: '>=6'}

  qs@6.13.0:
    resolution: {integrity: sha512-+38qI9SOr8tfZ4QmJNplMUxqjbe7LKvvZgWdExBOmd+egZTtjLB67Gu0HRX3u/XOq7UU2Nx6nsjvS16Z9uwfpg==}
    engines: {node: '>=0.6'}

  queue-microtask@1.2.3:
    resolution: {integrity: sha512-NuaNSa6flKT5JaSYQzJok04JzTL1CA6aGhv5rfLW3PgqA+M2ChpZQnAC8h8i4ZFkBS8X5RqkDBHA7r4hej3K9A==}

  randombytes@2.1.0:
    resolution: {integrity: sha512-vYl3iOX+4CKUWuxGi9Ukhie6fsqXqS9FE2Zaic4tNFD2N2QQaXOMFbuKK4QmDHC0JO6B1Zp41J0LpT0oR68amQ==}

  range-parser@1.2.1:
    resolution: {integrity: sha512-Hrgsx+orqoygnmhFbKaHE6c296J+HTAQXoxEF6gNupROmmGJRoyzfG3ccAveqCBrwr/2yxQ5BVd/GTl5agOwSg==}
    engines: {node: '>= 0.6'}

  raw-body@2.5.2:
    resolution: {integrity: sha512-8zGqypfENjCIqGhgXToC8aB2r7YrBX+AQAfIPs/Mlk+BtPTztOvTS01NRW/3Eh60J+a48lt8qsCzirQ6loCVfA==}
    engines: {node: '>= 0.8'}

  react-is@18.3.1:
    resolution: {integrity: sha512-/LLMVyas0ljjAtoYiPqYiL8VWXzUUdThrmU5+n20DZv+a+ClRoevUzw5JxU+Ieh5/c87ytoTBV9G1FiKfNJdmg==}

  read-cache@1.0.0:
    resolution: {integrity: sha512-Owdv/Ft7IjOgm/i0xvNDZ1LrRANRfew4b2prF3OWMQLxLfu3bS8FVhCsrSCMK4lR56Y9ya+AThoTpDCTxCmpRA==}

  readable-stream@2.3.8:
    resolution: {integrity: sha512-8p0AUk4XODgIewSi0l8Epjs+EVnWiK7NoDIEGU0HhE7+ZyY8D1IMY7odu5lRrFXGg71L15KG8QrPmum45RTtdA==}

  readable-stream@3.6.2:
    resolution: {integrity: sha512-9u/sniCrY3D5WdsERHzHE4G2YCXqoG5FTHUiCC4SIbr6XcLZBY05ya9EKjYek9O5xOAwjGq+1JdGBAS7Q9ScoA==}
    engines: {node: '>= 6'}

  readdirp@3.6.0:
    resolution: {integrity: sha512-hOS089on8RduqdbhvQ5Z37A0ESjsqz6qnRcffsMU3495FuTdqSm+7bhJ29JvIOsBDEEnan5DPu9t3To9VRlMzA==}
    engines: {node: '>=8.10.0'}

  readdirp@4.1.2:
    resolution: {integrity: sha512-GDhwkLfywWL2s6vEjyhri+eXmfH6j1L7JE27WhqLeYzoh/A3DBaYGEj2H/HFZCn/kMfim73FXxEJTw06WtxQwg==}
    engines: {node: '>= 14.18.0'}

  regenerate-unicode-properties@10.2.0:
    resolution: {integrity: sha512-DqHn3DwbmmPVzeKj9woBadqmXxLvQoQIwu7nopMc72ztvxVmVk2SBhSnx67zuye5TP+lJsb/TBQsjLKhnDf3MA==}
    engines: {node: '>=4'}

  regenerate@1.4.2:
    resolution: {integrity: sha512-zrceR/XhGYU/d/opr2EKO7aRHUeiBI8qjtfHqADTwZd6Szfy16la6kqD0MIUs5z5hx6AaKa+PixpPrR289+I0A==}

  regexpu-core@6.2.0:
    resolution: {integrity: sha512-H66BPQMrv+V16t8xtmq+UC0CBpiTBA60V8ibS1QVReIp8T1z8hwFxqcGzm9K6lgsN7sB5edVH8a+ze6Fqm4weA==}
    engines: {node: '>=4'}

  regjsgen@0.8.0:
    resolution: {integrity: sha512-RvwtGe3d7LvWiDQXeQw8p5asZUmfU1G/l6WbUXeHta7Y2PEIvBTwH6E2EfmYUK8pxcxEdEmaomqyp0vZZ7C+3Q==}

  regjsparser@0.12.0:
    resolution: {integrity: sha512-cnE+y8bz4NhMjISKbgeVJtqNbtf5QpjZP+Bslo+UqkIt9QPnX9q095eiRRASJG1/tz6dlNr6Z5NsBiWYokp6EQ==}
    hasBin: true

  require-directory@2.1.1:
    resolution: {integrity: sha512-fGxEI7+wsG9xrvdjsrlmL22OMTTiHRwAMroiEeMgq8gzoLC/PQr7RsRDSTLUg/bZAZtF+TVIkHc6/4RIKrui+Q==}
    engines: {node: '>=0.10.0'}

  require-from-string@2.0.2:
    resolution: {integrity: sha512-Xf0nWe6RseziFMu+Ap9biiUbmplq6S9/p+7w7YXP/JBHhrUDDUhwa+vANyubuqfZWTveU//DYVGsDG7RKL/vEw==}
    engines: {node: '>=0.10.0'}

  requires-port@1.0.0:
    resolution: {integrity: sha512-KigOCHcocU3XODJxsu8i/j8T9tzT4adHiecwORRQ0ZZFcp7ahwXuRU1m+yuO90C5ZUyGeGfocHDI14M3L3yDAQ==}

  resolve-from@4.0.0:
    resolution: {integrity: sha512-pb/MYmXstAkysRFx8piNI1tGFNQIFA3vkE3Gq4EuA1dF6gHp/+vgZqsCGJapvy8N3Q+4o7FwvquPJcnZ7RYy4g==}
    engines: {node: '>=4'}

  resolve.exports@2.0.3:
    resolution: {integrity: sha512-OcXjMsGdhL4XnbShKpAcSqPMzQoYkYyhbEaeSko47MjRP9NfEQMhZkXL1DoFlt9LWQn4YttrdnV6X2OiyzBi+A==}
    engines: {node: '>=10'}

  resolve@1.22.10:
    resolution: {integrity: sha512-NPRy+/ncIMeDlTAsuqwKIiferiawhefFJtkNSW0qZJEqMEb+qBt/77B/jGeeek+F0uOeN05CDa6HXbbIgtVX4w==}
    engines: {node: '>= 0.4'}
    hasBin: true

  restore-cursor@3.1.0:
    resolution: {integrity: sha512-l+sSefzHpj5qimhFSE5a8nufZYAM3sBSVMAPtYkmC+4EH2anSGaEMXSD0izRQbu9nfyQ9y5JrVmp7E8oZrUjvA==}
    engines: {node: '>=8'}

  retry@0.13.1:
    resolution: {integrity: sha512-XQBQ3I8W1Cge0Seh+6gjj03LbmRFWuoszgK9ooCpwYIrhhoO80pfq4cUkU5DkknwfOfFteRwlZ56PYOGYyFWdg==}
    engines: {node: '>= 4'}

  reusify@1.1.0:
    resolution: {integrity: sha512-g6QUff04oZpHs0eG5p83rFLhHeV00ug/Yf9nZM6fLeUrPguBTkTQOdpAWWspMh55TZfVQDPaN3NQJfbVRAxdIw==}
    engines: {iojs: '>=1.0.0', node: '>=0.10.0'}

  run-applescript@7.0.0:
    resolution: {integrity: sha512-9by4Ij99JUr/MCFBUkDKLWK3G9HVXmabKz9U5MlIAIuvuzkiOicRYs8XJLxX+xahD+mLiiCYDqF9dKAgtzKP1A==}
    engines: {node: '>=18'}

  run-parallel@1.2.0:
    resolution: {integrity: sha512-5l4VyZR86LZ/lDxZTR6jqL8AFE2S0IFLMP26AbjsLVADxHdhB/c0GUsH+y39UfCi3dzz8OlQuPmnaJOMoDHQBA==}

  rxjs@7.8.2:
    resolution: {integrity: sha512-dhKf903U/PQZY6boNNtAGdWbG85WAbjT/1xYoZIC7FAY0yWapOBQVsVrDl58W86//e1VpMNBtRV4MaXfdMySFA==}

  safe-buffer@5.1.2:
    resolution: {integrity: sha512-Gd2UZBJDkXlY7GbJxfsE8/nvKkUEU1G38c1siN6QP6a9PT9MmHB8GnpscSmMJSoF8LOIrt8ud/wPtojys4G6+g==}

  safe-buffer@5.2.1:
    resolution: {integrity: sha512-rp3So07KcdmmKbGvgaNxQSJr7bGVSVk5S9Eq1F+ppbRo70+YeaDxkw5Dd8NPN+GD6bjnYm2VuPuCXmpuYvmCXQ==}

  safer-buffer@2.1.2:
    resolution: {integrity: sha512-YZo3K82SD7Riyi0E1EQPojLz7kpepnSQI9IyPbHHg1XXXevb5dJI7tpyN2ADxGcQbHG7vcyRHk0cbwqcQriUtg==}

  sass-embedded-android-arm64@1.89.1:
    resolution: {integrity: sha512-Je6x7uuJRGQdr5ziSJdaPA4NhBSO26BU/E55qiuMUZpjq2EWBEJPbNeugu/cWlCEmfqoVuxj37r8aEU+KG0H1g==}
    engines: {node: '>=14.0.0'}
    cpu: [arm64]
    os: [android]

  sass-embedded-android-arm@1.89.1:
    resolution: {integrity: sha512-wVchZSz8zbJBwwOs9/iwco/M5G3L5BaeqwUF1EC3Gtzn1BsXYUEkJfftW2HxGl4hQz2YlpR7BY1GRN817uxADA==}
    engines: {node: '>=14.0.0'}
    cpu: [arm]
    os: [android]

  sass-embedded-android-riscv64@1.89.1:
    resolution: {integrity: sha512-DhWe+A4RVtpHMVaQgdzRpiczAXKPl7XhyY9USkY9Xkhv94+csTfjyuFmsUuCpKSiQDQkD+rGByfg+9yQIk/RgQ==}
    engines: {node: '>=14.0.0'}
    cpu: [riscv64]
    os: [android]

  sass-embedded-android-x64@1.89.1:
    resolution: {integrity: sha512-LTEzxTXrv3evPiHBmDMtJtO5tEprg7bvNOwYTjDEhE9ZCYdb70l+haIY0dVyhGxyeaBJlyvatjWOKEduPP3Lyw==}
    engines: {node: '>=14.0.0'}
    cpu: [x64]
    os: [android]

  sass-embedded-darwin-arm64@1.89.1:
    resolution: {integrity: sha512-7qMO4BLdIOFMMc1M+hg5iWEjPxbPlH1XTPUCwyuXYqubz6kXkdrrtJXolNAAey/0ZOE6uXk0APugm93a/veQdQ==}
    engines: {node: '>=14.0.0'}
    cpu: [arm64]
    os: [darwin]

  sass-embedded-darwin-x64@1.89.1:
    resolution: {integrity: sha512-Jzuws3NNx4YtDdL2/skP8BvGqMBKn26XINehwLnD2kgbh0+k+vKNWt5JDomvIuZVLsK8zWrMoRkXpk4wuHdqrw==}
    engines: {node: '>=14.0.0'}
    cpu: [x64]
    os: [darwin]

  sass-embedded-linux-arm64@1.89.1:
    resolution: {integrity: sha512-h967EV2armjV+Re+hHv7LaIzCOvV6DoFod9GJhXTdnPvilqs7DAPTUfN07wOqbzjlaGEnITZXzLsWAoZ1Z7tWQ==}
    engines: {node: '>=14.0.0'}
    cpu: [arm64]
    os: [linux]

  sass-embedded-linux-arm@1.89.1:
    resolution: {integrity: sha512-8TvFr/lh7FARtNr9mM57m7NNvtSZwnlkXtfY1D48B81Ve6GgtLqQhELNzvTcfQ0WZa0aNnVjq9XUuWLlrMDaZQ==}
    engines: {node: '>=14.0.0'}
    cpu: [arm]
    os: [linux]

  sass-embedded-linux-musl-arm64@1.89.1:
    resolution: {integrity: sha512-l4TrsUmE3AEPy2gDThb+OQV5xSyrb807DJbkQiFtTwvtOZAAkoVl1v2QeocW0npgKjc/W7nHMiSempJe0UcV7w==}
    engines: {node: '>=14.0.0'}
    cpu: [arm64]
    os: [linux]

  sass-embedded-linux-musl-arm@1.89.1:
    resolution: {integrity: sha512-Tl8wDL+3qFa/AhvZZBb1OvhN1SvIsRSLaPdGP8cv3VmKKVBdlLp2zedPTlcLJpR9dG/bjtGJYGX15kWHAvZ6mQ==}
    engines: {node: '>=14.0.0'}
    cpu: [arm]
    os: [linux]

  sass-embedded-linux-musl-riscv64@1.89.1:
    resolution: {integrity: sha512-YJVZmz032U7dv4RW3u+SJGp+DQWmYWc5fX/aXzLuoL6PPUPon1/Sseaf/5YGtcuQf8RnxZBbM2nFHFVHDJfsQw==}
    engines: {node: '>=14.0.0'}
    cpu: [riscv64]
    os: [linux]

  sass-embedded-linux-musl-x64@1.89.1:
    resolution: {integrity: sha512-67ijpk87V0VlpdVTtgnfIzRkVUMtEH79nvGctvNpk0XT6v+oxoFRljFRiYItZOxb5gRZMnvtkgaz1VHVcMrhtg==}
    engines: {node: '>=14.0.0'}
    cpu: [x64]
    os: [linux]

  sass-embedded-linux-riscv64@1.89.1:
    resolution: {integrity: sha512-SQNWy5kUvlQJUKRXFy8jS05DBik+2ERIWDxOBk+QuJYEIktlA9fKKBU8c7RkgpZFNXSXZa0W1Gy27oOFCzhhuA==}
    engines: {node: '>=14.0.0'}
    cpu: [riscv64]
    os: [linux]

  sass-embedded-linux-x64@1.89.1:
    resolution: {integrity: sha512-KUqGzBvTDZG6D3Pq41sCzqO1wkxM0WmxxlI7PTuVkvgciTywHf8F7mkg2alMLVZQ6APJEYtlnCGQgn4cCgYsqw==}
    engines: {node: '>=14.0.0'}
    cpu: [x64]
    os: [linux]

  sass-embedded-win32-arm64@1.89.1:
    resolution: {integrity: sha512-Lk6dYA18RasZxQhShT91G7Z2o7+F9necTNJ951a5AICsSJpTbg3tTnAGB7Rvd6xB5reQSZoXfB/zXKEKwtzaow==}
    engines: {node: '>=14.0.0'}
    cpu: [arm64]
    os: [win32]

  sass-embedded-win32-x64@1.89.1:
    resolution: {integrity: sha512-YlvzrzFPHd4GKa04jMfP0t2DGJHPTm7zN4GEYtaOFqeS6BoEAUY5kBNYFy7zhwKesN3kGyU/D9rz1MfLRgGv0g==}
    engines: {node: '>=14.0.0'}
    cpu: [x64]
    os: [win32]

  sass-embedded@1.89.1:
    resolution: {integrity: sha512-alvGGlyYdkSXYKOfS/TTxUD0993EYOe3adIPtwCWEg037qe183p2dkYnbaRsCLJFKt+QoyRzhsrbCsK7sbR6MA==}
    engines: {node: '>=16.0.0'}
    hasBin: true

  sass-loader@16.0.5:
    resolution: {integrity: sha512-oL+CMBXrj6BZ/zOq4os+UECPL+bWqt6OAC6DWS8Ln8GZRcMDjlJ4JC3FBDuHJdYaFWIdKNIBYmtZtK2MaMkNIw==}
    engines: {node: '>= 18.12.0'}
    peerDependencies:
      '@rspack/core': 0.x || 1.x
      node-sass: ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0 || ^9.0.0
      sass: ^1.3.0
      sass-embedded: '*'
      webpack: ^5.0.0
    peerDependenciesMeta:
      '@rspack/core':
        optional: true
      node-sass:
        optional: true
      sass:
        optional: true
      sass-embedded:
        optional: true
      webpack:
        optional: true

  sass@1.89.1:
    resolution: {integrity: sha512-eMLLkl+qz7tx/0cJ9wI+w09GQ2zodTkcE/aVfywwdlRcI3EO19xGnbmJwg/JMIm+5MxVJ6outddLZ4Von4E++Q==}
    engines: {node: '>=14.0.0'}
    hasBin: true

  sax@1.4.1:
    resolution: {integrity: sha512-+aWOz7yVScEGoKNd4PA10LZ8sk0A/z5+nXQG5giUO5rprX9jgYsTdov9qCchZiPIZezbZH+jRut8nPodFAX4Jg==}

  schema-utils@3.3.0:
    resolution: {integrity: sha512-pN/yOAvcC+5rQ5nERGuwrjLlYvLTbCibnZ1I7B1LaiAz9BRBlE9GMgE/eqV30P7aJQUf7Ddimy/RsbYO/GrVGg==}
    engines: {node: '>= 10.13.0'}

  schema-utils@4.3.2:
    resolution: {integrity: sha512-Gn/JaSk/Mt9gYubxTtSn/QCV4em9mpAPiR1rqy/Ocu19u/G9J5WWdNoUT4SiV6mFC3y6cxyFcFwdzPM3FgxGAQ==}
    engines: {node: '>= 10.13.0'}

  select-hose@2.0.0:
    resolution: {integrity: sha512-mEugaLK+YfkijB4fx0e6kImuJdCIt2LxCRcbEYPqRGCs4F2ogyfZU5IAZRdjCP8JPq2AtdNoC/Dux63d9Kiryg==}

  selfsigned@2.4.1:
    resolution: {integrity: sha512-th5B4L2U+eGLq1TVh7zNRGBapioSORUeymIydxgFpwww9d2qyKvtuPU2jJuHvYAwwqi2Y596QBL3eEqcPEYL8Q==}
    engines: {node: '>=10'}

  semver@5.7.2:
    resolution: {integrity: sha512-cBznnQ9KjJqU67B52RMC65CMarK2600WFnbkcaiwWq3xy/5haFJlshgnpjovMVJ+Hff49d8GEn0b87C5pDQ10g==}
    hasBin: true

  semver@6.3.1:
    resolution: {integrity: sha512-BR7VvDCVHO+q2xBEWskxS6DJE1qRnb7DxzUrogb71CWoSficBxYsiAGd+Kl0mmq/MprG9yArRkyrQxTO6XjMzA==}
    hasBin: true

  semver@7.7.2:
    resolution: {integrity: sha512-RF0Fw+rO5AMf9MAyaRXI4AV0Ulj5lMHqVxxdSgiVbixSCXoEmmX/jk0CuJw4+3SqroYO9VoUh+HcuJivvtJemA==}
    engines: {node: '>=10'}
    hasBin: true

  send@0.19.0:
    resolution: {integrity: sha512-dW41u5VfLXu8SJh5bwRmyYUbAoSB3c9uQh6L8h/KtsFREPWpbX1lrljJo186Jc4nmci/sGUZ9a0a0J2zgfq2hw==}
    engines: {node: '>= 0.8.0'}

  serialize-javascript@6.0.2:
    resolution: {integrity: sha512-Saa1xPByTTq2gdeFZYLLo+RFE35NHZkAbqZeWNd3BpzppeVisAqpDjcp8dyf6uIvEqJRd46jemmyA4iFIeVk8g==}

  serve-index@1.9.1:
    resolution: {integrity: sha512-pXHfKNP4qujrtteMrSBb0rc8HJ9Ms/GrXwcUtUtD5s4ewDJI8bT3Cz2zTVRMKtri49pLx2e0Ya8ziP5Ya2pZZw==}
    engines: {node: '>= 0.8.0'}

  serve-static@1.16.2:
    resolution: {integrity: sha512-VqpjJZKadQB/PEbEwvFdO43Ax5dFBZ2UECszz8bQ7pi7wt//PWe1P6MN7eCnjsatYtBT6EuiClbjSWP2WrIoTw==}
    engines: {node: '>= 0.8.0'}

  setprototypeof@1.1.0:
    resolution: {integrity: sha512-BvE/TwpZX4FXExxOxZyRGQQv651MSwmWKZGqvmPcRIjDqWub67kTKuIMx43cZZrS/cBBzwBcNDWoFxt2XEFIpQ==}

  setprototypeof@1.2.0:
    resolution: {integrity: sha512-E5LDX7Wrp85Kil5bhZv46j8jOeboKq5JMmYM3gVGdGH8xFpPWXUMsNrlODCrkoxMEeNi/XZIwuRvY4XNwYMJpw==}

  shebang-command@2.0.0:
    resolution: {integrity: sha512-kHxr2zZpYtdmrN1qDjrrX/Z1rR1kG8Dx+gkpK1G4eXmvXswmcE1hTWBWYUzlraYw1/yZp6YuDY77YtvbN0dmDA==}
    engines: {node: '>=8'}

  shebang-regex@3.0.0:
    resolution: {integrity: sha512-7++dFhtcx3353uBaq8DDR4NuxBetBzC7ZQOhmTQInHEd6bSrXdiEyzCvG07Z44UYdLShWUyXt5M/yhz8ekcb1A==}
    engines: {node: '>=8'}

  shell-quote@1.8.3:
    resolution: {integrity: sha512-ObmnIF4hXNg1BqhnHmgbDETF8dLPCggZWBjkQfhZpbszZnYur5DUljTcCHii5LC3J5E0yeO/1LIMyH+UvHQgyw==}
    engines: {node: '>= 0.4'}

  side-channel-list@1.0.0:
    resolution: {integrity: sha512-FCLHtRD/gnpCiCHEiJLOwdmFP+wzCmDEkc9y7NsYxeF4u7Btsn1ZuwgwJGxImImHicJArLP4R0yX4c2KCrMrTA==}
    engines: {node: '>= 0.4'}

  side-channel-map@1.0.1:
    resolution: {integrity: sha512-VCjCNfgMsby3tTdo02nbjtM/ewra6jPHmpThenkTYh8pG9ucZ/1P8So4u4FGBek/BjpOVsDCMoLA/iuBKIFXRA==}
    engines: {node: '>= 0.4'}

  side-channel-weakmap@1.0.2:
    resolution: {integrity: sha512-WPS/HvHQTYnHisLo9McqBHOJk2FkHO/tlpvldyrnem4aeQp4hai3gythswg6p01oSoTl58rcpiFAjF2br2Ak2A==}
    engines: {node: '>= 0.4'}

  side-channel@1.1.0:
    resolution: {integrity: sha512-ZX99e6tRweoUXqR+VBrslhda51Nh5MTQwou5tnUDgbtyM0dBgmhEDtWGP/xbKn6hqfPRHujUNwz5fy/wbbhnpw==}
    engines: {node: '>= 0.4'}

  signal-exit@3.0.7:
    resolution: {integrity: sha512-wnD2ZE+l+SPC/uoS0vXeE9L1+0wuaMqKlfz9AMUo38JsyLSBWSFcHR1Rri62LZc12vLr1gb3jl7iwQhgwpAbGQ==}

  signal-exit@4.1.0:
    resolution: {integrity: sha512-bzyZ1e88w9O1iNJbKnOlvYTrWPDl46O1bG0D3XInv+9tkPrxrN8jUUTiFlDkkmKWgn1M6CfIA13SuGqOa9Korw==}
    engines: {node: '>=14'}

  slash@4.0.0:
    resolution: {integrity: sha512-3dOsAHXXUkQTpOYcoAxLIorMTp4gIQr5IW3iVb7A7lFIp0VHhnynm9izx6TssdrIcVIESAlVjtnO2K8bg+Coew==}
    engines: {node: '>=12'}

  sockjs@0.3.24:
    resolution: {integrity: sha512-GJgLTZ7vYb/JtPSSZ10hsOYIvEYsjbNU+zPdIHcUaWVNUEPivzxku31865sSSud0Da0W4lEeOPlmw93zLQchuQ==}

  source-map-js@1.2.1:
    resolution: {integrity: sha512-UXWMKhLOwVKb728IUtQPXxfYU+usdybtUrK/8uGE8CQMvrhOpwvzDBwj0QhSL7MQc7vIsISBG8VQ8+IDQxpfQA==}
    engines: {node: '>=0.10.0'}

  source-map-loader@5.0.0:
    resolution: {integrity: sha512-k2Dur7CbSLcAH73sBcIkV5xjPV4SzqO1NJ7+XaQl8if3VODDUj3FNchNGpqgJSKbvUfJuhVdv8K2Eu8/TNl2eA==}
    engines: {node: '>= 18.12.0'}
    peerDependencies:
      webpack: ^5.72.1

  source-map-support@0.5.19:
    resolution: {integrity: sha512-Wonm7zOCIJzBGQdB+thsPar0kYuCIzYvxZwlBa87yi/Mdjv7Tip2cyVbLj5o0cFPN4EVkuTwb3GDDyUx2DGnGw==}

  source-map-support@0.5.21:
    resolution: {integrity: sha512-uBHU3L3czsIyYXKX88fdrGovxdSCoTGDRZ6SYXtSRxLZUzHg5P/66Ht6uoUlHu9EZod+inXhKo3qQgwXUT/y1w==}

  source-map@0.6.1:
    resolution: {integrity: sha512-UjgapumWlbMhkBgzT7Ykc5YXUT46F0iKu8SGXq0bcwP5dz/h0Plj6enJqjz1Zbq2l5WaqYnrVbwWOWMyF3F47g==}
    engines: {node: '>=0.10.0'}

  source-map@0.7.4:
    resolution: {integrity: sha512-l3BikUxvPOcn5E74dZiq5BGsTb5yEwhaTSzccU6t4sDOH8NWJCstKO5QT2CvtFoK6F0saL7p9xHAqHOlCPJygA==}
    engines: {node: '>= 8'}

  spdy-transport@3.0.0:
    resolution: {integrity: sha512-hsLVFE5SjA6TCisWeJXFKniGGOpBgMLmerfO2aCyCU5s7nJ/rpAepqmFifv/GCbSbueEeAJJnmSQ2rKC/g8Fcw==}

  spdy@4.0.2:
    resolution: {integrity: sha512-r46gZQZQV+Kl9oItvl1JZZqJKGr+oEkB08A6BzkiR7593/7IbtuncXHd2YoYeTsG4157ZssMu9KYvUHLcjcDoA==}
    engines: {node: '>=6.0.0'}

  sprintf-js@1.0.3:
    resolution: {integrity: sha512-D9cPgkvLlV3t3IzL0D0YLvGA9Ahk4PcvVwUbN0dSGr1aP0Nrt4AEnTUbuGvquEC0mA64Gqt1fzirlRs5ibXx8g==}

  statuses@1.5.0:
    resolution: {integrity: sha512-OpZ3zP+jT1PI7I8nemJX4AKmAX070ZkYPVWV/AaKTJl+tXCTGyVdC1a4SL8RUQYEwk/f34ZX8UTykN68FwrqAA==}
    engines: {node: '>= 0.6'}

  statuses@2.0.1:
    resolution: {integrity: sha512-RwNA9Z/7PrK06rYLIzFMlaF+l73iwpzsqRIFgbMLbTcLD6cOao82TaWefPXQvB2fOC4AjuYSEndS7N/mTCbkdQ==}
    engines: {node: '>= 0.8'}

  string-width@4.2.3:
    resolution: {integrity: sha512-wKyQRQpjJ0sIp62ErSZdGsjMJWsap5oRNihHhu6G7JVO/9jIB6UyevL+tXuOqrng8j/cxKTWyWUwvSTriiZz/g==}
    engines: {node: '>=8'}

  string-width@5.1.2:
    resolution: {integrity: sha512-HnLOCR3vjcY8beoNLtcjZ5/nxn2afmME6lhrDrebokqMap+XbeW8n9TXpPDOqdGK5qcI3oT0GKTW6wC7EMiVqA==}
    engines: {node: '>=12'}

  string_decoder@1.1.1:
    resolution: {integrity: sha512-n/ShnvDi6FHbbVfviro+WojiFzv+s8MPMHBczVePfUpDJLwoLT0ht1l4YwBCbi8pJAveEEdnkHyPyTP/mzRfwg==}

  string_decoder@1.3.0:
    resolution: {integrity: sha512-hkRX8U1WjJFd8LsDJ2yQ/wWWxaopEsABU1XfkM8A+j0+85JAGppt16cr1Whg6KIbb4okU6Mql6BOj+uup/wKeA==}

  strip-ansi@6.0.1:
    resolution: {integrity: sha512-Y38VPSHcqkFrCpFnQ9vuSXmquuv5oXOKpGeT6aGrr3o3Gc9AlVa6JBfUSOCnbxGGZF+/0ooI7KrPuUSztUdU5A==}
    engines: {node: '>=8'}

  strip-ansi@7.1.0:
    resolution: {integrity: sha512-iq6eVVI64nQQTRYq2KtEg2d2uU7LElhTJwsH4YzIHZshxlgZms/wIc4VoDQTlG/IvVIrBKG06CrZnp0qv7hkcQ==}
    engines: {node: '>=12'}

  strip-bom@3.0.0:
    resolution: {integrity: sha512-vavAMRXOgBVNF6nyEEmL3DBK19iRpDcoIwW+swQ+CbGiu7lju6t+JklA1MHweoWtadgt4ISVUsXLyDq34ddcwA==}
    engines: {node: '>=4'}

  style-loader@3.3.4:
    resolution: {integrity: sha512-0WqXzrsMTyb8yjZJHDqwmnwRJvhALK9LfRtRc6B4UTWe8AijYLZYZ9thuJTZc2VfQWINADW/j+LiJnfy2RoC1w==}
    engines: {node: '>= 12.13.0'}
    peerDependencies:
      webpack: ^5.0.0

  stylehacks@6.1.1:
    resolution: {integrity: sha512-gSTTEQ670cJNoaeIp9KX6lZmm8LJ3jPB5yJmX8Zq/wQxOsAFXV3qjWzHas3YYk1qesuVIyYWWUpZ0vSE/dTSGg==}
    engines: {node: ^14 || ^16 || >=18.0}
    peerDependencies:
      postcss: ^8.4.31

  stylus-loader@7.1.3:
    resolution: {integrity: sha512-TY0SKwiY7D2kMd3UxaWKSf3xHF0FFN/FAfsSqfrhxRT/koXTwffq2cgEWDkLQz7VojMu7qEEHt5TlMjkPx9UDw==}
    engines: {node: '>= 14.15.0'}
    peerDependencies:
      stylus: '>=0.52.4'
      webpack: ^5.0.0

  stylus@0.64.0:
    resolution: {integrity: sha512-ZIdT8eUv8tegmqy1tTIdJv9We2DumkNZFdCF5mz/Kpq3OcTaxSuCAYZge6HKK2CmNC02G1eJig2RV7XTw5hQrA==}
    engines: {node: '>=16'}
    hasBin: true

  supports-color@7.2.0:
    resolution: {integrity: sha512-qpCAvRl9stuOHveKsn7HncJRvv501qIacKzQlO/+Lwxc9+0q2wLyv4Dfvt80/DPn2pqOBsJdDiogXGR9+OvwRw==}
    engines: {node: '>=8'}

  supports-color@8.1.1:
    resolution: {integrity: sha512-MpUEN2OodtUzxvKQl72cUF7RQ5EiHsGvSsVG0ia9c5RbWGL2CI4C7EpPS8UTBIplnlzZiNuV56w+FuNxy3ty2Q==}
    engines: {node: '>=10'}

  supports-preserve-symlinks-flag@1.0.0:
    resolution: {integrity: sha512-ot0WnXS9fgdkgIcePe6RHNk1WA8+muPa6cSjeR3V8K27q9BB1rTE3R1p7Hv0z1ZyAc8s6Vvv8DIyWf681MAt0w==}
    engines: {node: '>= 0.4'}

  svgo@3.3.2:
    resolution: {integrity: sha512-OoohrmuUlBs8B8o6MB2Aevn+pRIH9zDALSR+6hhqVfa6fRwG/Qw9VUMSMW9VNg2CFc/MTIfabtdOVl9ODIJjpw==}
    engines: {node: '>=14.0.0'}
    hasBin: true

  sync-child-process@1.0.2:
    resolution: {integrity: sha512-8lD+t2KrrScJ/7KXCSyfhT3/hRq78rC0wBFqNJXv3mZyn6hW2ypM05JmlSvtqRbeq6jqA94oHbxAr2vYsJ8vDA==}
    engines: {node: '>=16.0.0'}

  sync-message-port@1.1.3:
    resolution: {integrity: sha512-GTt8rSKje5FilG+wEdfCkOcLL7LWqpMlr2c3LRuKt/YXxcJ52aGSbGBAdI4L3aaqfrBt6y711El53ItyH1NWzg==}
    engines: {node: '>=16.0.0'}

  tapable@2.2.2:
    resolution: {integrity: sha512-Re10+NauLTMCudc7T5WLFLAwDhQ0JWdrMK+9B2M8zR5hRExKmsRDCBA7/aV/pNJFltmBFO5BAMlQFi/vq3nKOg==}
    engines: {node: '>=6'}

  tar-stream@2.2.0:
    resolution: {integrity: sha512-ujeqbceABgwMZxEJnk2HDY2DlnUZ+9oEcb1KzTVfYHio0UE6dG71n60d8D2I4qNvleWrrXpmjpt7vZeF1LnMZQ==}
    engines: {node: '>=6'}

  terser-webpack-plugin@5.3.14:
    resolution: {integrity: sha512-vkZjpUjb6OMS7dhV+tILUW6BhpDR7P2L/aQSAv+Uwk+m8KATX9EccViHTJR2qDtACKPIYndLGCyl3FMo+r2LMw==}
    engines: {node: '>= 10.13.0'}
    peerDependencies:
      '@swc/core': '*'
      esbuild: '*'
      uglify-js: '*'
      webpack: ^5.1.0
    peerDependenciesMeta:
      '@swc/core':
        optional: true
      esbuild:
        optional: true
      uglify-js:
        optional: true

  terser@5.41.0:
    resolution: {integrity: sha512-H406eLPXpZbAX14+B8psIuvIr8+3c+2hkuYzpMkoE0ij+NdsVATbA78vb8neA/eqrj7rywa2pIkdmWRsXW6wmw==}
    engines: {node: '>=10'}
    hasBin: true

  thingies@1.21.0:
    resolution: {integrity: sha512-hsqsJsFMsV+aD4s3CWKk85ep/3I9XzYV/IXaSouJMYIoDlgyi11cBhsqYe9/geRfB0YIikBQg6raRaM+nIMP9g==}
    engines: {node: '>=10.18'}
    peerDependencies:
      tslib: ^2

  thunky@1.1.0:
    resolution: {integrity: sha512-eHY7nBftgThBqOyHGVN+l8gF0BucP09fMo0oO/Lb0w1OF80dJv+lDVpXG60WMQvkcxAkNybKsrEIE3ZtKGmPrA==}

  tinyglobby@0.2.14:
    resolution: {integrity: sha512-tX5e7OM1HnYr2+a2C/4V0htOcSQcoSTH9KgJnVvNm5zm/cyEWKJ7j7YutsH9CxMdtOkkLFy2AHrMci9IM8IPZQ==}
    engines: {node: '>=12.0.0'}

  tmp@0.2.3:
    resolution: {integrity: sha512-nZD7m9iCPC5g0pYmcaxogYKggSfLsdxl8of3Q/oIbqCqLLIO9IAF0GWjX1z9NZRHPiXv8Wex4yDCaZsgEw0Y8w==}
    engines: {node: '>=14.14'}

  to-regex-range@5.0.1:
    resolution: {integrity: sha512-65P7iz6X5yEr1cwcgvQxbbIw7Uk3gOy5dIdtZ4rDveLqhrdJP+Li/Hx6tyK0NEb+2GCyneCMJiGqrADCSNk8sQ==}
    engines: {node: '>=8.0'}

  toidentifier@1.0.1:
    resolution: {integrity: sha512-o5sSPKEkg/DIQNmH43V0/uerLrpzVedkUh8tGNvaeXpfpuwjKenlSox/2O/BTlZUtEe+JG7s5YhEz608PlAHRA==}
    engines: {node: '>=0.6'}

  tree-dump@1.0.3:
    resolution: {integrity: sha512-il+Cv80yVHFBwokQSfd4bldvr1Md951DpgAGfmhydt04L+YzHgubm2tQ7zueWDcGENKHq0ZvGFR/hjvNXilHEg==}
    engines: {node: '>=10.0'}
    peerDependencies:
      tslib: '2'

  tree-kill@1.2.2:
    resolution: {integrity: sha512-L0Orpi8qGpRG//Nd+H90vFB+3iHnue1zSSGmNOOCh1GLJ7rUKVwV2HvijphGQS2UmhUZewS9VgvxYIdgr+fG1A==}
    hasBin: true

  ts-loader@9.5.2:
    resolution: {integrity: sha512-Qo4piXvOTWcMGIgRiuFa6nHNm+54HbYaZCKqc9eeZCLRy3XqafQgwX2F7mofrbJG3g7EEb+lkiR+z2Lic2s3Zw==}
    engines: {node: '>=12.0.0'}
    peerDependencies:
      typescript: '*'
      webpack: ^5.0.0

  tsconfig-paths-webpack-plugin@4.0.0:
    resolution: {integrity: sha512-fw/7265mIWukrSHd0i+wSwx64kYUSAKPfxRDksjKIYTxSAp9W9/xcZVBF4Kl0eqQd5eBpAQ/oQrc5RyM/0c1GQ==}
    engines: {node: '>=10.13.0'}

  tsconfig-paths@4.2.0:
    resolution: {integrity: sha512-NoZ4roiN7LnbKn9QqE1amc9DJfzvZXxF4xDavcOWt1BPkdx+m+0gJuPM+S0vCe7zTJMYUP0R8pO2XMr+Y8oLIg==}
    engines: {node: '>=6'}

  tslib@2.8.1:
    resolution: {integrity: sha512-oJFu94HQb+KVduSUQL7wnpmqnfmLsOA/nAh6b6EH0wCEoK0/mPeXU6c3wKDV83MkOuHPRHtSXKKU99IBazS/2w==}

  type-is@1.6.18:
    resolution: {integrity: sha512-TkRKr9sUTxEH8MdfuCSP7VizJyzRNMjj2J2do2Jr3Kym598JVdEksuzPQCnlFPW4ky9Q+iA+ma9BGm06XQBy8g==}
    engines: {node: '>= 0.6'}

  typed-assert@1.0.9:
    resolution: {integrity: sha512-KNNZtayBCtmnNmbo5mG47p1XsCyrx6iVqomjcZnec/1Y5GGARaxPs6r49RnSPeUP3YjNYiU9sQHAtY4BBvnZwg==}

  typescript@5.7.3:
    resolution: {integrity: sha512-84MVSjMEHP+FQRPy3pX9sTVV/INIex71s9TL2Gm5FG/WG1SqXeKyZ0k7/blY/4FdOzI12CBy1vGc4og/eus0fw==}
    engines: {node: '>=14.17'}
    hasBin: true

  unicode-canonical-property-names-ecmascript@2.0.1:
    resolution: {integrity: sha512-dA8WbNeb2a6oQzAQ55YlT5vQAWGV9WXOsi3SskE3bcCdM0P4SDd+24zS/OCacdRq5BkdsRj9q3Pg6YyQoxIGqg==}
    engines: {node: '>=4'}

  unicode-match-property-ecmascript@2.0.0:
    resolution: {integrity: sha512-5kaZCrbp5mmbz5ulBkDkbY0SsPOjKqVS35VpL9ulMPfSl0J0Xsm+9Evphv9CoIZFwre7aJoa94AY6seMKGVN5Q==}
    engines: {node: '>=4'}

  unicode-match-property-value-ecmascript@2.2.0:
    resolution: {integrity: sha512-4IehN3V/+kkr5YeSSDDQG8QLqO26XpL2XP3GQtqwlT/QYSECAwFztxVHjlbh0+gjJ3XmNLS0zDsbgs9jWKExLg==}
    engines: {node: '>=4'}

  unicode-property-aliases-ecmascript@2.1.0:
    resolution: {integrity: sha512-6t3foTQI9qne+OZoVQB/8x8rk2k1eVy1gRXhV3oFQ5T6R1dqQ1xtin3XqSlx3+ATBkliTaR/hHyJBm+LVPNM8w==}
    engines: {node: '>=4'}

  universalify@2.0.1:
    resolution: {integrity: sha512-gptHNQghINnc/vTGIk0SOFGFNXw7JVrlRUtConJRlvaw6DuX0wO5Jeko9sWrMBhh+PsYAZ7oXAiOnf/UKogyiw==}
    engines: {node: '>= 10.0.0'}

  unpipe@1.0.0:
    resolution: {integrity: sha512-pjy2bYhSsufwWlKwPc+l3cN7+wuJlK6uz0YdJEOlQDbl6jo/YlPi4mb8agUkVC8BF7V8NuzeyPNqRksA3hztKQ==}
    engines: {node: '>= 0.8'}

  update-browserslist-db@1.1.3:
    resolution: {integrity: sha512-UxhIZQ+QInVdunkDAaiazvvT/+fXL5Osr0JZlJulepYu6Jd7qJtDZjlur0emRlT71EN3ScPoE7gvsuIKKNavKw==}
    hasBin: true
    peerDependencies:
      browserslist: '>= 4.21.0'

  uri-js@4.4.1:
    resolution: {integrity: sha512-7rKUyy33Q1yc98pQ1DAmLtwX109F7TIfWlW1Ydo8Wl1ii1SeHieeh0HHfPeL2fMXK6z0s8ecKs9frCuLJvndBg==}

  util-deprecate@1.0.2:
    resolution: {integrity: sha512-EPD5q1uXyFxJpCrLnCc1nHnq3gOa6DZBocAIiI2TaSCA7VCJ1UJDMagCzIkXNsUYfD1daK//LTEQ8xiIbrHtcw==}

  utils-merge@1.0.1:
    resolution: {integrity: sha512-pMZTvIkT1d+TFGvDOqodOclx0QWkkgi6Tdoa8gC8ffGAAqz9pzPTZWAybbsHHoED/ztMtkv/VoYTYyShUn81hA==}
    engines: {node: '>= 0.4.0'}

  uuid@8.3.2:
    resolution: {integrity: sha512-+NYs2QeMWy+GWFOEm9xnn6HCDp0l7QBD7ml8zLUmJ+93Q5NF0NocErnwkTkXVFNiX3/fpC6afS8Dhb/gz7R7eg==}
    hasBin: true

  validate-npm-package-name@5.0.1:
    resolution: {integrity: sha512-OljLrQ9SQdOUqTaQxqL5dEfZWrXExyyWsozYlAWFawPVNuD83igl7uJD2RTkNMbniIYgt8l81eCJGIdQF7avLQ==}
    engines: {node: ^14.17.0 || ^16.13.0 || >=18.0.0}

  varint@6.0.0:
    resolution: {integrity: sha512-cXEIW6cfr15lFv563k4GuVuW/fiwjknytD37jIOLSdSWuOI6WnO/oKwmP2FQTU2l01LP8/M5TSAJpzUaGe3uWg==}

  vary@1.1.2:
    resolution: {integrity: sha512-BNGbWLfd0eUPabhkXUVm0j8uuvREyTh5ovRa/dyow/BqAbZJyC+5fU+IzQOzmAKzYqYRAISoRhdQr3eIZ/PXqg==}
    engines: {node: '>= 0.8'}

  watchpack@2.4.4:
    resolution: {integrity: sha512-c5EGNOiyxxV5qmTtAB7rbiXxi1ooX1pQKMLX/MIabJjRA0SJBQOjKF+KSVfHkr9U1cADPon0mRiVe/riyaiDUA==}
    engines: {node: '>=10.13.0'}

  wbuf@1.7.3:
    resolution: {integrity: sha512-O84QOnr0icsbFGLS0O3bI5FswxzRr8/gHwWkDlQFskhSPryQXvrTMxjxGP4+iWYoauLoBvfDpkrOauZ+0iZpDA==}

  wcwidth@1.0.1:
    resolution: {integrity: sha512-XHPEwS0q6TaxcvG85+8EYkbiCux2XtWG2mkc47Ng2A77BQu9+DqIOJldST4HgPkuea7dvKSj5VgX3P1d4rW8Tg==}

  webpack-dev-middleware@7.4.2:
    resolution: {integrity: sha512-xOO8n6eggxnwYpy1NlzUKpvrjfJTvae5/D6WOK0S2LSo7vjmo5gCM1DbLUmFqrMTJP+W/0YZNctm7jasWvLuBA==}
    engines: {node: '>= 18.12.0'}
    peerDependencies:
      webpack: ^5.0.0
    peerDependenciesMeta:
      webpack:
        optional: true

  webpack-dev-server@5.2.2:
    resolution: {integrity: sha512-QcQ72gh8a+7JO63TAx/6XZf/CWhgMzu5m0QirvPfGvptOusAxG12w2+aua1Jkjr7hzaWDnJ2n6JFeexMHI+Zjg==}
    engines: {node: '>= 18.12.0'}
    hasBin: true
    peerDependencies:
      webpack: ^5.0.0
      webpack-cli: '*'
    peerDependenciesMeta:
      webpack:
        optional: true
      webpack-cli:
        optional: true

  webpack-node-externals@3.0.0:
    resolution: {integrity: sha512-LnL6Z3GGDPht/AigwRh2dvL9PQPFQ8skEpVrWZXLWBYmqcaojHNN0onvHzie6rq7EWKrrBfPYqNEzTJgiwEQDQ==}
    engines: {node: '>=6'}

  webpack-sources@3.3.2:
    resolution: {integrity: sha512-ykKKus8lqlgXX/1WjudpIEjqsafjOTcOJqxnAbMLAu/KCsDCJ6GBtvscewvTkrn24HsnvFwrSCbenFrhtcCsAA==}
    engines: {node: '>=10.13.0'}

  webpack-subresource-integrity@5.1.0:
    resolution: {integrity: sha512-sacXoX+xd8r4WKsy9MvH/q/vBtEHr86cpImXwyg74pFIpERKt6FmB8cXpeuh0ZLgclOlHI4Wcll7+R5L02xk9Q==}
    engines: {node: '>= 12'}
    peerDependencies:
      html-webpack-plugin: '>= 5.0.0-beta.1 < 6'
      webpack: ^5.12.0
    peerDependenciesMeta:
      html-webpack-plugin:
        optional: true

  webpack@5.98.0:
    resolution: {integrity: sha512-UFynvx+gM44Gv9qFgj0acCQK2VE1CtdfwFdimkapco3hlPCJ/zeq73n2yVKimVbtm+TnApIugGhLJnkU6gjYXA==}
    engines: {node: '>=10.13.0'}
    hasBin: true
    peerDependencies:
      webpack-cli: '*'
    peerDependenciesMeta:
      webpack-cli:
        optional: true

  websocket-driver@0.7.4:
    resolution: {integrity: sha512-b17KeDIQVjvb0ssuSDF2cYXSg2iztliJ4B9WdsuB6J952qCPKmnVq4DyW5motImXHDC1cBT/1UezrJVsKw5zjg==}
    engines: {node: '>=0.8.0'}

  websocket-extensions@0.1.4:
    resolution: {integrity: sha512-OqedPIGOfsDlo31UNwYbCFMSaO9m9G/0faIHj5/dZFDMFqPTcx6UwqyOy3COEaEOg/9VsGIpdqn62W5KhoKSpg==}
    engines: {node: '>=0.8.0'}

  which@2.0.2:
    resolution: {integrity: sha512-BLI3Tl1TW3Pvl70l3yq3Y64i+awpwXqsGBYWkkqMtnbXgrMD+yj7rhW0kuEDxzJaYXGjEW5ogapKNMEKNMjibA==}
    engines: {node: '>= 8'}
    hasBin: true

  wrap-ansi@7.0.0:
    resolution: {integrity: sha512-YVGIj2kamLSTxw6NsZjoBxfSwsn0ycdesmc4p+Q21c5zPuZ1pl+NfxVdxPtdHvmNVOQ6XSYG4AUtyt/Fi7D16Q==}
    engines: {node: '>=10'}

  wrap-ansi@8.1.0:
    resolution: {integrity: sha512-si7QWI6zUMq56bESFvagtmzMdGOtoxfR+Sez11Mobfc7tm+VkUckk9bW2UeffTGVUbOksxmSw0AA2gs8g71NCQ==}
    engines: {node: '>=12'}

  wrappy@1.0.2:
    resolution: {integrity: sha512-l4Sp/DRseor9wL6EvV2+TuQn63dMkPjZ/sp9XkghTEbV9KlPS1xUsZ3u7/IQO4wxtcFB4bgpQPRcR3QCvezPcQ==}

  ws@8.18.2:
    resolution: {integrity: sha512-DMricUmwGZUVr++AEAe2uiVM7UoO9MAVZMDu05UQOaUII0lp+zOzLLU4Xqh/JvTqklB1T4uELaaPBKyjE1r4fQ==}
    engines: {node: '>=10.0.0'}
    peerDependencies:
      bufferutil: ^4.0.1
      utf-8-validate: '>=5.0.2'
    peerDependenciesMeta:
      bufferutil:
        optional: true
      utf-8-validate:
        optional: true

  y18n@5.0.8:
    resolution: {integrity: sha512-0pfFzegeDWJHJIAmTLRP2DwHjdF5s7jo9tuztdQxAhINCdvS+3nGINqPd00AphqJR/0LhANUS6/+7SCb98YOfA==}
    engines: {node: '>=10'}

  yallist@3.1.1:
    resolution: {integrity: sha512-a4UGQaWPH59mOXUYnAG2ewncQS4i4F43Tv3JoAM+s2VDAmS9NsK8GpDMLrCHPksFT7h3K6TOoUNn2pb7RoXx4g==}

  yaml@1.10.2:
    resolution: {integrity: sha512-r3vXyErRCYJ7wg28yvBY5VSoAF8ZvlcW9/BwUzEtUsjvX/DKs24dIkuwjtuprwJJHsbyUbLApepYTR1BN4uHrg==}
    engines: {node: '>= 6'}

  yaml@2.8.0:
    resolution: {integrity: sha512-4lLa/EcQCB0cJkyts+FpIRx5G/llPxfP6VQU5KByHEhLxY3IJCH0f0Hy1MHI8sClTvsIb8qwRJ6R/ZdlDJ/leQ==}
    engines: {node: '>= 14.6'}
    hasBin: true

  yargs-parser@21.1.1:
    resolution: {integrity: sha512-tVpsJW7DdjecAiFpbIB1e3qxIQsE6NoPc5/eTdrbbIC4h0LVsWhnoa3g+m2HclBIujHzsxZ4VJVA+GUuc2/LBw==}
    engines: {node: '>=12'}

  yargs@17.7.2:
    resolution: {integrity: sha512-7dSzzRQ++CKnNI/krKnYRV7JKKPUXMEh61soaHKg9mrWEhzFWhFnxPxGl+69cD1Ou63C13NUPCnmIcrvqCuM6w==}
    engines: {node: '>=12'}

  yocto-queue@1.2.1:
    resolution: {integrity: sha512-AyeEbWOu/TAXdxlV9wmGcR0+yh2j3vYPGOECcIj2S7MkrLyC7ne+oye2BKTItt0ii2PHk4cDy+95+LshzbXnGg==}
    engines: {node: '>=12.20'}

snapshots:

  '@adobe/css-tools@4.3.3': {}

  '@ampproject/remapping@2.3.0':
    dependencies:
      '@jridgewell/gen-mapping': 0.3.8
      '@jridgewell/trace-mapping': 0.3.25

  '@babel/code-frame@7.27.1':
    dependencies:
      '@babel/helper-validator-identifier': 7.27.1
      js-tokens: 4.0.0
      picocolors: 1.1.1

  '@babel/compat-data@7.27.5': {}

  '@babel/core@7.27.4':
    dependencies:
      '@ampproject/remapping': 2.3.0
      '@babel/code-frame': 7.27.1
      '@babel/generator': 7.27.5
      '@babel/helper-compilation-targets': 7.27.2
      '@babel/helper-module-transforms': 7.27.3(@babel/core@7.27.4)
      '@babel/helpers': 7.27.6
      '@babel/parser': 7.27.5
      '@babel/template': 7.27.2
      '@babel/traverse': 7.27.4
      '@babel/types': 7.27.6
      convert-source-map: 2.0.0
      debug: 4.4.1
      gensync: 1.0.0-beta.2
      json5: 2.2.3
      semver: 6.3.1
    transitivePeerDependencies:
      - supports-color

  '@babel/generator@7.27.5':
    dependencies:
      '@babel/parser': 7.27.5
      '@babel/types': 7.27.6
      '@jridgewell/gen-mapping': 0.3.8
      '@jridgewell/trace-mapping': 0.3.25
      jsesc: 3.1.0

  '@babel/helper-annotate-as-pure@7.27.3':
    dependencies:
      '@babel/types': 7.27.6

  '@babel/helper-compilation-targets@7.27.2':
    dependencies:
      '@babel/compat-data': 7.27.5
      '@babel/helper-validator-option': 7.27.1
      browserslist: 4.25.0
      lru-cache: 5.1.1
      semver: 6.3.1

  '@babel/helper-create-class-features-plugin@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-annotate-as-pure': 7.27.3
      '@babel/helper-member-expression-to-functions': 7.27.1
      '@babel/helper-optimise-call-expression': 7.27.1
      '@babel/helper-replace-supers': 7.27.1(@babel/core@7.27.4)
      '@babel/helper-skip-transparent-expression-wrappers': 7.27.1
      '@babel/traverse': 7.27.4
      semver: 6.3.1
    transitivePeerDependencies:
      - supports-color

  '@babel/helper-create-regexp-features-plugin@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-annotate-as-pure': 7.27.3
      regexpu-core: 6.2.0
      semver: 6.3.1

  '@babel/helper-define-polyfill-provider@0.6.4(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-compilation-targets': 7.27.2
      '@babel/helper-plugin-utils': 7.27.1
      debug: 4.4.1
      lodash.debounce: 4.0.8
      resolve: 1.22.10
    transitivePeerDependencies:
      - supports-color

  '@babel/helper-member-expression-to-functions@7.27.1':
    dependencies:
      '@babel/traverse': 7.27.4
      '@babel/types': 7.27.6
    transitivePeerDependencies:
      - supports-color

  '@babel/helper-module-imports@7.27.1':
    dependencies:
      '@babel/traverse': 7.27.4
      '@babel/types': 7.27.6
    transitivePeerDependencies:
      - supports-color

  '@babel/helper-module-transforms@7.27.3(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-module-imports': 7.27.1
      '@babel/helper-validator-identifier': 7.27.1
      '@babel/traverse': 7.27.4
    transitivePeerDependencies:
      - supports-color

  '@babel/helper-optimise-call-expression@7.27.1':
    dependencies:
      '@babel/types': 7.27.6

  '@babel/helper-plugin-utils@7.27.1': {}

  '@babel/helper-remap-async-to-generator@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-annotate-as-pure': 7.27.3
      '@babel/helper-wrap-function': 7.27.1
      '@babel/traverse': 7.27.4
    transitivePeerDependencies:
      - supports-color

  '@babel/helper-replace-supers@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-member-expression-to-functions': 7.27.1
      '@babel/helper-optimise-call-expression': 7.27.1
      '@babel/traverse': 7.27.4
    transitivePeerDependencies:
      - supports-color

  '@babel/helper-skip-transparent-expression-wrappers@7.27.1':
    dependencies:
      '@babel/traverse': 7.27.4
      '@babel/types': 7.27.6
    transitivePeerDependencies:
      - supports-color

  '@babel/helper-string-parser@7.27.1': {}

  '@babel/helper-validator-identifier@7.27.1': {}

  '@babel/helper-validator-option@7.27.1': {}

  '@babel/helper-wrap-function@7.27.1':
    dependencies:
      '@babel/template': 7.27.2
      '@babel/traverse': 7.27.4
      '@babel/types': 7.27.6
    transitivePeerDependencies:
      - supports-color

  '@babel/helpers@7.27.6':
    dependencies:
      '@babel/template': 7.27.2
      '@babel/types': 7.27.6

  '@babel/parser@7.27.5':
    dependencies:
      '@babel/types': 7.27.6

  '@babel/plugin-bugfix-firefox-class-in-computed-class-key@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1
      '@babel/traverse': 7.27.4
    transitivePeerDependencies:
      - supports-color

  '@babel/plugin-bugfix-safari-class-field-initializer-scope@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-bugfix-safari-id-destructuring-collision-in-function-expression@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-bugfix-v8-spread-parameters-in-optional-chaining@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1
      '@babel/helper-skip-transparent-expression-wrappers': 7.27.1
      '@babel/plugin-transform-optional-chaining': 7.27.1(@babel/core@7.27.4)
    transitivePeerDependencies:
      - supports-color

  '@babel/plugin-bugfix-v8-static-class-fields-redefine-readonly@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1
      '@babel/traverse': 7.27.4
    transitivePeerDependencies:
      - supports-color

  '@babel/plugin-proposal-decorators@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-create-class-features-plugin': 7.27.1(@babel/core@7.27.4)
      '@babel/helper-plugin-utils': 7.27.1
      '@babel/plugin-syntax-decorators': 7.27.1(@babel/core@7.27.4)
    transitivePeerDependencies:
      - supports-color

  '@babel/plugin-proposal-private-property-in-object@7.21.0-placeholder-for-preset-env.2(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4

  '@babel/plugin-syntax-decorators@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-syntax-import-assertions@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-syntax-import-attributes@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-syntax-jsx@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-syntax-typescript@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-syntax-unicode-sets-regex@7.18.6(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-create-regexp-features-plugin': 7.27.1(@babel/core@7.27.4)
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-arrow-functions@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-async-generator-functions@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1
      '@babel/helper-remap-async-to-generator': 7.27.1(@babel/core@7.27.4)
      '@babel/traverse': 7.27.4
    transitivePeerDependencies:
      - supports-color

  '@babel/plugin-transform-async-to-generator@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-module-imports': 7.27.1
      '@babel/helper-plugin-utils': 7.27.1
      '@babel/helper-remap-async-to-generator': 7.27.1(@babel/core@7.27.4)
    transitivePeerDependencies:
      - supports-color

  '@babel/plugin-transform-block-scoped-functions@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-block-scoping@7.27.5(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-class-properties@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-create-class-features-plugin': 7.27.1(@babel/core@7.27.4)
      '@babel/helper-plugin-utils': 7.27.1
    transitivePeerDependencies:
      - supports-color

  '@babel/plugin-transform-class-static-block@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-create-class-features-plugin': 7.27.1(@babel/core@7.27.4)
      '@babel/helper-plugin-utils': 7.27.1
    transitivePeerDependencies:
      - supports-color

  '@babel/plugin-transform-classes@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-annotate-as-pure': 7.27.3
      '@babel/helper-compilation-targets': 7.27.2
      '@babel/helper-plugin-utils': 7.27.1
      '@babel/helper-replace-supers': 7.27.1(@babel/core@7.27.4)
      '@babel/traverse': 7.27.4
      globals: 11.12.0
    transitivePeerDependencies:
      - supports-color

  '@babel/plugin-transform-computed-properties@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1
      '@babel/template': 7.27.2

  '@babel/plugin-transform-destructuring@7.27.3(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-dotall-regex@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-create-regexp-features-plugin': 7.27.1(@babel/core@7.27.4)
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-duplicate-keys@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-duplicate-named-capturing-groups-regex@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-create-regexp-features-plugin': 7.27.1(@babel/core@7.27.4)
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-dynamic-import@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-exponentiation-operator@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-export-namespace-from@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-for-of@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1
      '@babel/helper-skip-transparent-expression-wrappers': 7.27.1
    transitivePeerDependencies:
      - supports-color

  '@babel/plugin-transform-function-name@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-compilation-targets': 7.27.2
      '@babel/helper-plugin-utils': 7.27.1
      '@babel/traverse': 7.27.4
    transitivePeerDependencies:
      - supports-color

  '@babel/plugin-transform-json-strings@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-literals@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-logical-assignment-operators@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-member-expression-literals@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-modules-amd@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-module-transforms': 7.27.3(@babel/core@7.27.4)
      '@babel/helper-plugin-utils': 7.27.1
    transitivePeerDependencies:
      - supports-color

  '@babel/plugin-transform-modules-commonjs@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-module-transforms': 7.27.3(@babel/core@7.27.4)
      '@babel/helper-plugin-utils': 7.27.1
    transitivePeerDependencies:
      - supports-color

  '@babel/plugin-transform-modules-systemjs@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-module-transforms': 7.27.3(@babel/core@7.27.4)
      '@babel/helper-plugin-utils': 7.27.1
      '@babel/helper-validator-identifier': 7.27.1
      '@babel/traverse': 7.27.4
    transitivePeerDependencies:
      - supports-color

  '@babel/plugin-transform-modules-umd@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-module-transforms': 7.27.3(@babel/core@7.27.4)
      '@babel/helper-plugin-utils': 7.27.1
    transitivePeerDependencies:
      - supports-color

  '@babel/plugin-transform-named-capturing-groups-regex@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-create-regexp-features-plugin': 7.27.1(@babel/core@7.27.4)
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-new-target@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-nullish-coalescing-operator@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-numeric-separator@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-object-rest-spread@7.27.3(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-compilation-targets': 7.27.2
      '@babel/helper-plugin-utils': 7.27.1
      '@babel/plugin-transform-destructuring': 7.27.3(@babel/core@7.27.4)
      '@babel/plugin-transform-parameters': 7.27.1(@babel/core@7.27.4)

  '@babel/plugin-transform-object-super@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1
      '@babel/helper-replace-supers': 7.27.1(@babel/core@7.27.4)
    transitivePeerDependencies:
      - supports-color

  '@babel/plugin-transform-optional-catch-binding@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-optional-chaining@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1
      '@babel/helper-skip-transparent-expression-wrappers': 7.27.1
    transitivePeerDependencies:
      - supports-color

  '@babel/plugin-transform-parameters@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-private-methods@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-create-class-features-plugin': 7.27.1(@babel/core@7.27.4)
      '@babel/helper-plugin-utils': 7.27.1
    transitivePeerDependencies:
      - supports-color

  '@babel/plugin-transform-private-property-in-object@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-annotate-as-pure': 7.27.3
      '@babel/helper-create-class-features-plugin': 7.27.1(@babel/core@7.27.4)
      '@babel/helper-plugin-utils': 7.27.1
    transitivePeerDependencies:
      - supports-color

  '@babel/plugin-transform-property-literals@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-regenerator@7.27.5(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-regexp-modifiers@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-create-regexp-features-plugin': 7.27.1(@babel/core@7.27.4)
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-reserved-words@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-runtime@7.27.4(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-module-imports': 7.27.1
      '@babel/helper-plugin-utils': 7.27.1
      babel-plugin-polyfill-corejs2: 0.4.13(@babel/core@7.27.4)
      babel-plugin-polyfill-corejs3: 0.11.1(@babel/core@7.27.4)
      babel-plugin-polyfill-regenerator: 0.6.4(@babel/core@7.27.4)
      semver: 6.3.1
    transitivePeerDependencies:
      - supports-color

  '@babel/plugin-transform-shorthand-properties@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-spread@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1
      '@babel/helper-skip-transparent-expression-wrappers': 7.27.1
    transitivePeerDependencies:
      - supports-color

  '@babel/plugin-transform-sticky-regex@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-template-literals@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-typeof-symbol@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-typescript@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-annotate-as-pure': 7.27.3
      '@babel/helper-create-class-features-plugin': 7.27.1(@babel/core@7.27.4)
      '@babel/helper-plugin-utils': 7.27.1
      '@babel/helper-skip-transparent-expression-wrappers': 7.27.1
      '@babel/plugin-syntax-typescript': 7.27.1(@babel/core@7.27.4)
    transitivePeerDependencies:
      - supports-color

  '@babel/plugin-transform-unicode-escapes@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-unicode-property-regex@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-create-regexp-features-plugin': 7.27.1(@babel/core@7.27.4)
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-unicode-regex@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-create-regexp-features-plugin': 7.27.1(@babel/core@7.27.4)
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/plugin-transform-unicode-sets-regex@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-create-regexp-features-plugin': 7.27.1(@babel/core@7.27.4)
      '@babel/helper-plugin-utils': 7.27.1

  '@babel/preset-env@7.27.2(@babel/core@7.27.4)':
    dependencies:
      '@babel/compat-data': 7.27.5
      '@babel/core': 7.27.4
      '@babel/helper-compilation-targets': 7.27.2
      '@babel/helper-plugin-utils': 7.27.1
      '@babel/helper-validator-option': 7.27.1
      '@babel/plugin-bugfix-firefox-class-in-computed-class-key': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-bugfix-safari-class-field-initializer-scope': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-bugfix-safari-id-destructuring-collision-in-function-expression': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-bugfix-v8-spread-parameters-in-optional-chaining': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-bugfix-v8-static-class-fields-redefine-readonly': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-proposal-private-property-in-object': 7.21.0-placeholder-for-preset-env.2(@babel/core@7.27.4)
      '@babel/plugin-syntax-import-assertions': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-syntax-import-attributes': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-syntax-unicode-sets-regex': 7.18.6(@babel/core@7.27.4)
      '@babel/plugin-transform-arrow-functions': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-async-generator-functions': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-async-to-generator': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-block-scoped-functions': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-block-scoping': 7.27.5(@babel/core@7.27.4)
      '@babel/plugin-transform-class-properties': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-class-static-block': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-classes': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-computed-properties': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-destructuring': 7.27.3(@babel/core@7.27.4)
      '@babel/plugin-transform-dotall-regex': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-duplicate-keys': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-duplicate-named-capturing-groups-regex': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-dynamic-import': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-exponentiation-operator': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-export-namespace-from': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-for-of': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-function-name': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-json-strings': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-literals': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-logical-assignment-operators': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-member-expression-literals': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-modules-amd': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-modules-commonjs': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-modules-systemjs': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-modules-umd': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-named-capturing-groups-regex': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-new-target': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-nullish-coalescing-operator': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-numeric-separator': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-object-rest-spread': 7.27.3(@babel/core@7.27.4)
      '@babel/plugin-transform-object-super': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-optional-catch-binding': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-optional-chaining': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-parameters': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-private-methods': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-private-property-in-object': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-property-literals': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-regenerator': 7.27.5(@babel/core@7.27.4)
      '@babel/plugin-transform-regexp-modifiers': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-reserved-words': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-shorthand-properties': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-spread': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-sticky-regex': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-template-literals': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-typeof-symbol': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-unicode-escapes': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-unicode-property-regex': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-unicode-regex': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-unicode-sets-regex': 7.27.1(@babel/core@7.27.4)
      '@babel/preset-modules': 0.1.6-no-external-plugins(@babel/core@7.27.4)
      babel-plugin-polyfill-corejs2: 0.4.13(@babel/core@7.27.4)
      babel-plugin-polyfill-corejs3: 0.11.1(@babel/core@7.27.4)
      babel-plugin-polyfill-regenerator: 0.6.4(@babel/core@7.27.4)
      core-js-compat: 3.43.0
      semver: 6.3.1
    transitivePeerDependencies:
      - supports-color

  '@babel/preset-modules@0.1.6-no-external-plugins(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1
      '@babel/types': 7.27.6
      esutils: 2.0.3

  '@babel/preset-typescript@7.27.1(@babel/core@7.27.4)':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1
      '@babel/helper-validator-option': 7.27.1
      '@babel/plugin-syntax-jsx': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-modules-commonjs': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-typescript': 7.27.1(@babel/core@7.27.4)
    transitivePeerDependencies:
      - supports-color

  '@babel/runtime@7.27.6': {}

  '@babel/template@7.27.2':
    dependencies:
      '@babel/code-frame': 7.27.1
      '@babel/parser': 7.27.5
      '@babel/types': 7.27.6

  '@babel/traverse@7.27.4':
    dependencies:
      '@babel/code-frame': 7.27.1
      '@babel/generator': 7.27.5
      '@babel/parser': 7.27.5
      '@babel/template': 7.27.2
      '@babel/types': 7.27.6
      debug: 4.4.1
      globals: 11.12.0
    transitivePeerDependencies:
      - supports-color

  '@babel/types@7.27.6':
    dependencies:
      '@babel/helper-string-parser': 7.27.1
      '@babel/helper-validator-identifier': 7.27.1

  '@bufbuild/protobuf@2.5.2': {}

  '@emnapi/core@1.4.3':
    dependencies:
      '@emnapi/wasi-threads': 1.0.2
      tslib: 2.8.1

  '@emnapi/runtime@1.4.3':
    dependencies:
      tslib: 2.8.1

  '@emnapi/wasi-threads@1.0.2':
    dependencies:
      tslib: 2.8.1

  '@isaacs/cliui@8.0.2':
    dependencies:
      string-width: 5.1.2
      string-width-cjs: string-width@4.2.3
      strip-ansi: 7.1.0
      strip-ansi-cjs: strip-ansi@6.0.1
      wrap-ansi: 8.1.0
      wrap-ansi-cjs: wrap-ansi@7.0.0

  '@jest/schemas@29.6.3':
    dependencies:
      '@sinclair/typebox': 0.27.8

  '@jest/types@29.6.3':
    dependencies:
      '@jest/schemas': 29.6.3
      '@types/istanbul-lib-coverage': 2.0.6
      '@types/istanbul-reports': 3.0.4
      '@types/node': 18.16.9
      '@types/yargs': 17.0.33
      chalk: 4.1.2

  '@jridgewell/gen-mapping@0.3.8':
    dependencies:
      '@jridgewell/set-array': 1.2.1
      '@jridgewell/sourcemap-codec': 1.5.0
      '@jridgewell/trace-mapping': 0.3.25

  '@jridgewell/resolve-uri@3.1.2': {}

  '@jridgewell/set-array@1.2.1': {}

  '@jridgewell/source-map@0.3.6':
    dependencies:
      '@jridgewell/gen-mapping': 0.3.8
      '@jridgewell/trace-mapping': 0.3.25

  '@jridgewell/sourcemap-codec@1.5.0': {}

  '@jridgewell/trace-mapping@0.3.25':
    dependencies:
      '@jridgewell/resolve-uri': 3.1.2
      '@jridgewell/sourcemap-codec': 1.5.0

  '@jsonjoy.com/base64@1.1.2(tslib@2.8.1)':
    dependencies:
      tslib: 2.8.1

  '@jsonjoy.com/json-pack@1.2.0(tslib@2.8.1)':
    dependencies:
      '@jsonjoy.com/base64': 1.1.2(tslib@2.8.1)
      '@jsonjoy.com/util': 1.6.0(tslib@2.8.1)
      hyperdyperid: 1.2.0
      thingies: 1.21.0(tslib@2.8.1)
      tslib: 2.8.1

  '@jsonjoy.com/util@1.6.0(tslib@2.8.1)':
    dependencies:
      tslib: 2.8.1

  '@leichtgewicht/ip-codec@2.0.5': {}

  '@napi-rs/wasm-runtime@0.2.4':
    dependencies:
      '@emnapi/core': 1.4.3
      '@emnapi/runtime': 1.4.3
      '@tybys/wasm-util': 0.9.0

  '@nodelib/fs.scandir@2.1.5':
    dependencies:
      '@nodelib/fs.stat': 2.0.5
      run-parallel: 1.2.0

  '@nodelib/fs.stat@2.0.5': {}

  '@nodelib/fs.walk@1.2.8':
    dependencies:
      '@nodelib/fs.scandir': 2.1.5
      fastq: 1.19.1

  '@nx/devkit@21.1.2(nx@21.1.2(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17)))':
    dependencies:
      ejs: 3.1.10
      enquirer: 2.3.6
      ignore: 5.3.2
      minimatch: 9.0.3
      nx: 21.1.2(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17))
      semver: 7.7.2
      tmp: 0.2.3
      tslib: 2.8.1
      yargs-parser: 21.1.1

  '@nx/devkit@21.1.3(nx@21.1.2(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17)))':
    dependencies:
      ejs: 3.1.10
      enquirer: 2.3.6
      ignore: 5.3.2
      minimatch: 9.0.3
      nx: 21.1.2(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17))
      semver: 7.7.2
      tmp: 0.2.3
      tslib: 2.8.1
      yargs-parser: 21.1.1

  '@nx/devkit@21.1.3(nx@21.1.3(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17)))':
    dependencies:
      ejs: 3.1.10
      enquirer: 2.3.6
      ignore: 5.3.2
      minimatch: 9.0.3
      nx: 21.1.3(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17))
      semver: 7.7.2
      tmp: 0.2.3
      tslib: 2.8.1
      yargs-parser: 21.1.1

  '@nx/js@21.1.2(@babel/traverse@7.27.4)(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17))(nx@21.1.2(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17)))':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/plugin-proposal-decorators': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-class-properties': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-runtime': 7.27.4(@babel/core@7.27.4)
      '@babel/preset-env': 7.27.2(@babel/core@7.27.4)
      '@babel/preset-typescript': 7.27.1(@babel/core@7.27.4)
      '@babel/runtime': 7.27.6
      '@nx/devkit': 21.1.2(nx@21.1.2(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17)))
      '@nx/workspace': 21.1.2(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17))
      '@zkochan/js-yaml': 0.0.7
      babel-plugin-const-enum: 1.2.0(@babel/core@7.27.4)
      babel-plugin-macros: 3.1.0
      babel-plugin-transform-typescript-metadata: 0.3.2(@babel/core@7.27.4)(@babel/traverse@7.27.4)
      chalk: 4.1.2
      columnify: 1.6.0
      detect-port: 1.6.1
      enquirer: 2.3.6
      ignore: 5.3.2
      js-tokens: 4.0.0
      jsonc-parser: 3.2.0
      npm-package-arg: 11.0.1
      npm-run-path: 4.0.1
      ora: 5.3.0
      picocolors: 1.1.1
      picomatch: 4.0.2
      semver: 7.7.2
      source-map-support: 0.5.19
      tinyglobby: 0.2.14
      tslib: 2.8.1
    transitivePeerDependencies:
      - '@babel/traverse'
      - '@swc-node/register'
      - '@swc/core'
      - debug
      - nx
      - supports-color

  '@nx/js@21.1.3(@babel/traverse@7.27.4)(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17))(nx@21.1.2(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17)))':
    dependencies:
      '@babel/core': 7.27.4
      '@babel/plugin-proposal-decorators': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-class-properties': 7.27.1(@babel/core@7.27.4)
      '@babel/plugin-transform-runtime': 7.27.4(@babel/core@7.27.4)
      '@babel/preset-env': 7.27.2(@babel/core@7.27.4)
      '@babel/preset-typescript': 7.27.1(@babel/core@7.27.4)
      '@babel/runtime': 7.27.6
      '@nx/devkit': 21.1.3(nx@21.1.2(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17)))
      '@nx/workspace': 21.1.3(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17))
      '@zkochan/js-yaml': 0.0.7
      babel-plugin-const-enum: 1.2.0(@babel/core@7.27.4)
      babel-plugin-macros: 3.1.0
      babel-plugin-transform-typescript-metadata: 0.3.2(@babel/core@7.27.4)(@babel/traverse@7.27.4)
      chalk: 4.1.2
      columnify: 1.6.0
      detect-port: 1.6.1
      enquirer: 2.3.6
      ignore: 5.3.2
      js-tokens: 4.0.0
      jsonc-parser: 3.2.0
      npm-package-arg: 11.0.1
      npm-run-path: 4.0.1
      ora: 5.3.0
      picocolors: 1.1.1
      picomatch: 4.0.2
      semver: 7.7.2
      source-map-support: 0.5.19
      tinyglobby: 0.2.14
      tslib: 2.8.1
    transitivePeerDependencies:
      - '@babel/traverse'
      - '@swc-node/register'
      - '@swc/core'
      - debug
      - nx
      - supports-color

  '@nx/nx-darwin-arm64@21.1.2':
    optional: true

  '@nx/nx-darwin-arm64@21.1.3':
    optional: true

  '@nx/nx-darwin-x64@21.1.2':
    optional: true

  '@nx/nx-darwin-x64@21.1.3':
    optional: true

  '@nx/nx-freebsd-x64@21.1.2':
    optional: true

  '@nx/nx-freebsd-x64@21.1.3':
    optional: true

  '@nx/nx-linux-arm-gnueabihf@21.1.2':
    optional: true

  '@nx/nx-linux-arm-gnueabihf@21.1.3':
    optional: true

  '@nx/nx-linux-arm64-gnu@21.1.2':
    optional: true

  '@nx/nx-linux-arm64-gnu@21.1.3':
    optional: true

  '@nx/nx-linux-arm64-musl@21.1.2':
    optional: true

  '@nx/nx-linux-arm64-musl@21.1.3':
    optional: true

  '@nx/nx-linux-x64-gnu@21.1.2':
    optional: true

  '@nx/nx-linux-x64-gnu@21.1.3':
    optional: true

  '@nx/nx-linux-x64-musl@21.1.2':
    optional: true

  '@nx/nx-linux-x64-musl@21.1.3':
    optional: true

  '@nx/nx-win32-arm64-msvc@21.1.2':
    optional: true

  '@nx/nx-win32-arm64-msvc@21.1.3':
    optional: true

  '@nx/nx-win32-x64-msvc@21.1.2':
    optional: true

  '@nx/nx-win32-x64-msvc@21.1.3':
    optional: true

  '@nx/webpack@21.1.3(@babel/traverse@7.27.4)(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17))(nx@21.1.2(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17)))(typescript@5.7.3)':
    dependencies:
      '@babel/core': 7.27.4
      '@nx/devkit': 21.1.3(nx@21.1.2(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17)))
      '@nx/js': 21.1.3(@babel/traverse@7.27.4)(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17))(nx@21.1.2(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17)))
      '@phenomnomnominal/tsquery': 5.0.1(typescript@5.7.3)
      ajv: 8.17.1
      autoprefixer: 10.4.21(postcss@8.5.4)
      babel-loader: 9.2.1(@babel/core@7.27.4)(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17)))
      browserslist: 4.25.0
      copy-webpack-plugin: 10.2.4(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17)))
      css-loader: 6.11.0(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17)))
      css-minimizer-webpack-plugin: 5.0.1(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17)))
      fork-ts-checker-webpack-plugin: 7.2.13(typescript@5.7.3)(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17)))
      less: 4.1.3
      less-loader: 11.1.0(less@4.1.3)(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17)))
      license-webpack-plugin: 4.0.2(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17)))
      loader-utils: 2.0.4
      mini-css-extract-plugin: 2.4.7(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17)))
      parse5: 4.0.0
      picocolors: 1.1.1
      postcss: 8.5.4
      postcss-import: 14.1.0(postcss@8.5.4)
      postcss-loader: 6.2.1(postcss@8.5.4)(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17)))
      rxjs: 7.8.2
      sass: 1.89.1
      sass-embedded: 1.89.1
      sass-loader: 16.0.5(sass-embedded@1.89.1)(sass@1.89.1)(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17)))
      source-map-loader: 5.0.0(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17)))
      style-loader: 3.3.4(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17)))
      stylus: 0.64.0
      stylus-loader: 7.1.3(stylus@0.64.0)(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17)))
      terser-webpack-plugin: 5.3.14(@swc/core@1.5.29(@swc/helpers@0.5.17))(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17)))
      ts-loader: 9.5.2(typescript@5.7.3)(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17)))
      tsconfig-paths-webpack-plugin: 4.0.0
      tslib: 2.8.1
      webpack: 5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))
      webpack-dev-server: 5.2.2(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17)))
      webpack-node-externals: 3.0.0
      webpack-subresource-integrity: 5.1.0(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17)))
    transitivePeerDependencies:
      - '@babel/traverse'
      - '@parcel/css'
      - '@rspack/core'
      - '@swc-node/register'
      - '@swc/core'
      - '@swc/css'
      - bufferutil
      - clean-css
      - csso
      - debug
      - esbuild
      - html-webpack-plugin
      - lightningcss
      - node-sass
      - nx
      - supports-color
      - typescript
      - uglify-js
      - utf-8-validate
      - verdaccio
      - vue-template-compiler
      - webpack-cli

  '@nx/workspace@21.1.2(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17))':
    dependencies:
      '@nx/devkit': 21.1.2(nx@21.1.2(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17)))
      '@zkochan/js-yaml': 0.0.7
      chalk: 4.1.2
      enquirer: 2.3.6
      nx: 21.1.2(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17))
      picomatch: 4.0.2
      tslib: 2.8.1
      yargs-parser: 21.1.1
    transitivePeerDependencies:
      - '@swc-node/register'
      - '@swc/core'
      - debug

  '@nx/workspace@21.1.3(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17))':
    dependencies:
      '@nx/devkit': 21.1.3(nx@21.1.3(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17)))
      '@zkochan/js-yaml': 0.0.7
      chalk: 4.1.2
      enquirer: 2.3.6
      nx: 21.1.3(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17))
      picomatch: 4.0.2
      tslib: 2.8.1
      yargs-parser: 21.1.1
    transitivePeerDependencies:
      - '@swc-node/register'
      - '@swc/core'
      - debug

  '@parcel/watcher-android-arm64@2.5.1':
    optional: true

  '@parcel/watcher-darwin-arm64@2.5.1':
    optional: true

  '@parcel/watcher-darwin-x64@2.5.1':
    optional: true

  '@parcel/watcher-freebsd-x64@2.5.1':
    optional: true

  '@parcel/watcher-linux-arm-glibc@2.5.1':
    optional: true

  '@parcel/watcher-linux-arm-musl@2.5.1':
    optional: true

  '@parcel/watcher-linux-arm64-glibc@2.5.1':
    optional: true

  '@parcel/watcher-linux-arm64-musl@2.5.1':
    optional: true

  '@parcel/watcher-linux-x64-glibc@2.5.1':
    optional: true

  '@parcel/watcher-linux-x64-musl@2.5.1':
    optional: true

  '@parcel/watcher-win32-arm64@2.5.1':
    optional: true

  '@parcel/watcher-win32-ia32@2.5.1':
    optional: true

  '@parcel/watcher-win32-x64@2.5.1':
    optional: true

  '@parcel/watcher@2.5.1':
    dependencies:
      detect-libc: 1.0.3
      is-glob: 4.0.3
      micromatch: 4.0.8
      node-addon-api: 7.1.1
    optionalDependencies:
      '@parcel/watcher-android-arm64': 2.5.1
      '@parcel/watcher-darwin-arm64': 2.5.1
      '@parcel/watcher-darwin-x64': 2.5.1
      '@parcel/watcher-freebsd-x64': 2.5.1
      '@parcel/watcher-linux-arm-glibc': 2.5.1
      '@parcel/watcher-linux-arm-musl': 2.5.1
      '@parcel/watcher-linux-arm64-glibc': 2.5.1
      '@parcel/watcher-linux-arm64-musl': 2.5.1
      '@parcel/watcher-linux-x64-glibc': 2.5.1
      '@parcel/watcher-linux-x64-musl': 2.5.1
      '@parcel/watcher-win32-arm64': 2.5.1
      '@parcel/watcher-win32-ia32': 2.5.1
      '@parcel/watcher-win32-x64': 2.5.1
    optional: true

  '@phenomnomnominal/tsquery@5.0.1(typescript@5.7.3)':
    dependencies:
      esquery: 1.6.0
      typescript: 5.7.3

  '@pkgjs/parseargs@0.11.0':
    optional: true

  '@sinclair/typebox@0.27.8': {}

  '@swc-node/core@1.13.3(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)':
    dependencies:
      '@swc/core': 1.5.29(@swc/helpers@0.5.17)
      '@swc/types': 0.1.22

  '@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3)':
    dependencies:
      '@swc-node/core': 1.13.3(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)
      '@swc-node/sourcemap-support': 0.5.1
      '@swc/core': 1.5.29(@swc/helpers@0.5.17)
      colorette: 2.0.20
      debug: 4.4.1
      pirates: 4.0.7
      tslib: 2.8.1
      typescript: 5.7.3
    transitivePeerDependencies:
      - '@swc/types'
      - supports-color

  '@swc-node/sourcemap-support@0.5.1':
    dependencies:
      source-map-support: 0.5.21
      tslib: 2.8.1

  '@swc/core-darwin-arm64@1.5.29':
    optional: true

  '@swc/core-darwin-x64@1.5.29':
    optional: true

  '@swc/core-linux-arm-gnueabihf@1.5.29':
    optional: true

  '@swc/core-linux-arm64-gnu@1.5.29':
    optional: true

  '@swc/core-linux-arm64-musl@1.5.29':
    optional: true

  '@swc/core-linux-x64-gnu@1.5.29':
    optional: true

  '@swc/core-linux-x64-musl@1.5.29':
    optional: true

  '@swc/core-win32-arm64-msvc@1.5.29':
    optional: true

  '@swc/core-win32-ia32-msvc@1.5.29':
    optional: true

  '@swc/core-win32-x64-msvc@1.5.29':
    optional: true

  '@swc/core@1.5.29(@swc/helpers@0.5.17)':
    dependencies:
      '@swc/counter': 0.1.3
      '@swc/types': 0.1.22
    optionalDependencies:
      '@swc/core-darwin-arm64': 1.5.29
      '@swc/core-darwin-x64': 1.5.29
      '@swc/core-linux-arm-gnueabihf': 1.5.29
      '@swc/core-linux-arm64-gnu': 1.5.29
      '@swc/core-linux-arm64-musl': 1.5.29
      '@swc/core-linux-x64-gnu': 1.5.29
      '@swc/core-linux-x64-musl': 1.5.29
      '@swc/core-win32-arm64-msvc': 1.5.29
      '@swc/core-win32-ia32-msvc': 1.5.29
      '@swc/core-win32-x64-msvc': 1.5.29
      '@swc/helpers': 0.5.17

  '@swc/counter@0.1.3': {}

  '@swc/helpers@0.5.17':
    dependencies:
      tslib: 2.8.1

  '@swc/types@0.1.22':
    dependencies:
      '@swc/counter': 0.1.3

  '@trysound/sax@0.2.0': {}

  '@tybys/wasm-util@0.9.0':
    dependencies:
      tslib: 2.8.1

  '@types/body-parser@1.19.6':
    dependencies:
      '@types/connect': 3.4.38
      '@types/node': 18.16.9

  '@types/bonjour@3.5.13':
    dependencies:
      '@types/node': 18.16.9

  '@types/connect-history-api-fallback@1.5.4':
    dependencies:
      '@types/express-serve-static-core': 4.19.6
      '@types/node': 18.16.9

  '@types/connect@3.4.38':
    dependencies:
      '@types/node': 18.16.9

  '@types/eslint-scope@3.7.7':
    dependencies:
      '@types/eslint': 9.6.1
      '@types/estree': 1.0.8

  '@types/eslint@9.6.1':
    dependencies:
      '@types/estree': 1.0.8
      '@types/json-schema': 7.0.15

  '@types/estree@1.0.8': {}

  '@types/express-serve-static-core@4.19.6':
    dependencies:
      '@types/node': 18.16.9
      '@types/qs': 6.14.0
      '@types/range-parser': 1.2.7
      '@types/send': 0.17.5

  '@types/express@4.17.23':
    dependencies:
      '@types/body-parser': 1.19.6
      '@types/express-serve-static-core': 4.19.6
      '@types/qs': 6.14.0
      '@types/serve-static': 1.15.8

  '@types/http-errors@2.0.5': {}

  '@types/http-proxy@1.17.16':
    dependencies:
      '@types/node': 18.16.9

  '@types/istanbul-lib-coverage@2.0.6': {}

  '@types/istanbul-lib-report@3.0.3':
    dependencies:
      '@types/istanbul-lib-coverage': 2.0.6

  '@types/istanbul-reports@3.0.4':
    dependencies:
      '@types/istanbul-lib-report': 3.0.3

  '@types/json-schema@7.0.15': {}

  '@types/mime@1.3.5': {}

  '@types/node-forge@1.3.11':
    dependencies:
      '@types/node': 18.16.9

  '@types/node@18.16.9': {}

  '@types/parse-json@4.0.2': {}

  '@types/qs@6.14.0': {}

  '@types/range-parser@1.2.7': {}

  '@types/retry@0.12.2': {}

  '@types/send@0.17.5':
    dependencies:
      '@types/mime': 1.3.5
      '@types/node': 18.16.9

  '@types/serve-index@1.9.4':
    dependencies:
      '@types/express': 4.17.23

  '@types/serve-static@1.15.8':
    dependencies:
      '@types/http-errors': 2.0.5
      '@types/node': 18.16.9
      '@types/send': 0.17.5

  '@types/sockjs@0.3.36':
    dependencies:
      '@types/node': 18.16.9

  '@types/ws@8.18.1':
    dependencies:
      '@types/node': 18.16.9

  '@types/yargs-parser@21.0.3': {}

  '@types/yargs@17.0.33':
    dependencies:
      '@types/yargs-parser': 21.0.3

  '@webassemblyjs/ast@1.14.1':
    dependencies:
      '@webassemblyjs/helper-numbers': 1.13.2
      '@webassemblyjs/helper-wasm-bytecode': 1.13.2

  '@webassemblyjs/floating-point-hex-parser@1.13.2': {}

  '@webassemblyjs/helper-api-error@1.13.2': {}

  '@webassemblyjs/helper-buffer@1.14.1': {}

  '@webassemblyjs/helper-numbers@1.13.2':
    dependencies:
      '@webassemblyjs/floating-point-hex-parser': 1.13.2
      '@webassemblyjs/helper-api-error': 1.13.2
      '@xtuc/long': 4.2.2

  '@webassemblyjs/helper-wasm-bytecode@1.13.2': {}

  '@webassemblyjs/helper-wasm-section@1.14.1':
    dependencies:
      '@webassemblyjs/ast': 1.14.1
      '@webassemblyjs/helper-buffer': 1.14.1
      '@webassemblyjs/helper-wasm-bytecode': 1.13.2
      '@webassemblyjs/wasm-gen': 1.14.1

  '@webassemblyjs/ieee754@1.13.2':
    dependencies:
      '@xtuc/ieee754': 1.2.0

  '@webassemblyjs/leb128@1.13.2':
    dependencies:
      '@xtuc/long': 4.2.2

  '@webassemblyjs/utf8@1.13.2': {}

  '@webassemblyjs/wasm-edit@1.14.1':
    dependencies:
      '@webassemblyjs/ast': 1.14.1
      '@webassemblyjs/helper-buffer': 1.14.1
      '@webassemblyjs/helper-wasm-bytecode': 1.13.2
      '@webassemblyjs/helper-wasm-section': 1.14.1
      '@webassemblyjs/wasm-gen': 1.14.1
      '@webassemblyjs/wasm-opt': 1.14.1
      '@webassemblyjs/wasm-parser': 1.14.1
      '@webassemblyjs/wast-printer': 1.14.1

  '@webassemblyjs/wasm-gen@1.14.1':
    dependencies:
      '@webassemblyjs/ast': 1.14.1
      '@webassemblyjs/helper-wasm-bytecode': 1.13.2
      '@webassemblyjs/ieee754': 1.13.2
      '@webassemblyjs/leb128': 1.13.2
      '@webassemblyjs/utf8': 1.13.2

  '@webassemblyjs/wasm-opt@1.14.1':
    dependencies:
      '@webassemblyjs/ast': 1.14.1
      '@webassemblyjs/helper-buffer': 1.14.1
      '@webassemblyjs/wasm-gen': 1.14.1
      '@webassemblyjs/wasm-parser': 1.14.1

  '@webassemblyjs/wasm-parser@1.14.1':
    dependencies:
      '@webassemblyjs/ast': 1.14.1
      '@webassemblyjs/helper-api-error': 1.13.2
      '@webassemblyjs/helper-wasm-bytecode': 1.13.2
      '@webassemblyjs/ieee754': 1.13.2
      '@webassemblyjs/leb128': 1.13.2
      '@webassemblyjs/utf8': 1.13.2

  '@webassemblyjs/wast-printer@1.14.1':
    dependencies:
      '@webassemblyjs/ast': 1.14.1
      '@xtuc/long': 4.2.2

  '@xtuc/ieee754@1.2.0': {}

  '@xtuc/long@4.2.2': {}

  '@yarnpkg/lockfile@1.1.0': {}

  '@yarnpkg/parsers@3.0.2':
    dependencies:
      js-yaml: 3.14.1
      tslib: 2.8.1

  '@zkochan/js-yaml@0.0.7':
    dependencies:
      argparse: 2.0.1

  accepts@1.3.8:
    dependencies:
      mime-types: 2.1.35
      negotiator: 0.6.3

  acorn@8.15.0: {}

  address@1.2.2: {}

  ajv-formats@2.1.1(ajv@8.17.1):
    optionalDependencies:
      ajv: 8.17.1

  ajv-keywords@3.5.2(ajv@6.12.6):
    dependencies:
      ajv: 6.12.6

  ajv-keywords@5.1.0(ajv@8.17.1):
    dependencies:
      ajv: 8.17.1
      fast-deep-equal: 3.1.3

  ajv@6.12.6:
    dependencies:
      fast-deep-equal: 3.1.3
      fast-json-stable-stringify: 2.1.0
      json-schema-traverse: 0.4.1
      uri-js: 4.4.1

  ajv@8.17.1:
    dependencies:
      fast-deep-equal: 3.1.3
      fast-uri: 3.0.6
      json-schema-traverse: 1.0.0
      require-from-string: 2.0.2

  ansi-colors@4.1.3: {}

  ansi-html-community@0.0.8: {}

  ansi-regex@5.0.1: {}

  ansi-regex@6.1.0: {}

  ansi-styles@4.3.0:
    dependencies:
      color-convert: 2.0.1

  ansi-styles@5.2.0: {}

  ansi-styles@6.2.1: {}

  anymatch@3.1.3:
    dependencies:
      normalize-path: 3.0.0
      picomatch: 2.3.1

  argparse@1.0.10:
    dependencies:
      sprintf-js: 1.0.3

  argparse@2.0.1: {}

  array-flatten@1.1.1: {}

  array-union@3.0.1: {}

  async@3.2.6: {}

  asynckit@0.4.0: {}

  autoprefixer@10.4.21(postcss@8.5.4):
    dependencies:
      browserslist: 4.25.0
      caniuse-lite: 1.0.30001721
      fraction.js: 4.3.7
      normalize-range: 0.1.2
      picocolors: 1.1.1
      postcss: 8.5.4
      postcss-value-parser: 4.2.0

  axios@1.9.0:
    dependencies:
      follow-redirects: 1.15.9
      form-data: 4.0.3
      proxy-from-env: 1.1.0
    transitivePeerDependencies:
      - debug

  babel-loader@9.2.1(@babel/core@7.27.4)(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))):
    dependencies:
      '@babel/core': 7.27.4
      find-cache-dir: 4.0.0
      schema-utils: 4.3.2
      webpack: 5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))

  babel-plugin-const-enum@1.2.0(@babel/core@7.27.4):
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1
      '@babel/plugin-syntax-typescript': 7.27.1(@babel/core@7.27.4)
      '@babel/traverse': 7.27.4
    transitivePeerDependencies:
      - supports-color

  babel-plugin-macros@3.1.0:
    dependencies:
      '@babel/runtime': 7.27.6
      cosmiconfig: 7.1.0
      resolve: 1.22.10

  babel-plugin-polyfill-corejs2@0.4.13(@babel/core@7.27.4):
    dependencies:
      '@babel/compat-data': 7.27.5
      '@babel/core': 7.27.4
      '@babel/helper-define-polyfill-provider': 0.6.4(@babel/core@7.27.4)
      semver: 6.3.1
    transitivePeerDependencies:
      - supports-color

  babel-plugin-polyfill-corejs3@0.11.1(@babel/core@7.27.4):
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-define-polyfill-provider': 0.6.4(@babel/core@7.27.4)
      core-js-compat: 3.43.0
    transitivePeerDependencies:
      - supports-color

  babel-plugin-polyfill-regenerator@0.6.4(@babel/core@7.27.4):
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-define-polyfill-provider': 0.6.4(@babel/core@7.27.4)
    transitivePeerDependencies:
      - supports-color

  babel-plugin-transform-typescript-metadata@0.3.2(@babel/core@7.27.4)(@babel/traverse@7.27.4):
    dependencies:
      '@babel/core': 7.27.4
      '@babel/helper-plugin-utils': 7.27.1
    optionalDependencies:
      '@babel/traverse': 7.27.4

  balanced-match@1.0.2: {}

  base64-js@1.5.1: {}

  batch@0.6.1: {}

  big.js@5.2.2: {}

  binary-extensions@2.3.0: {}

  bl@4.1.0:
    dependencies:
      buffer: 5.7.1
      inherits: 2.0.4
      readable-stream: 3.6.2

  body-parser@1.20.3:
    dependencies:
      bytes: 3.1.2
      content-type: 1.0.5
      debug: 2.6.9
      depd: 2.0.0
      destroy: 1.2.0
      http-errors: 2.0.0
      iconv-lite: 0.4.24
      on-finished: 2.4.1
      qs: 6.13.0
      raw-body: 2.5.2
      type-is: 1.6.18
      unpipe: 1.0.0
    transitivePeerDependencies:
      - supports-color

  bonjour-service@1.3.0:
    dependencies:
      fast-deep-equal: 3.1.3
      multicast-dns: 7.2.5

  boolbase@1.0.0: {}

  brace-expansion@1.1.11:
    dependencies:
      balanced-match: 1.0.2
      concat-map: 0.0.1

  brace-expansion@2.0.1:
    dependencies:
      balanced-match: 1.0.2

  braces@3.0.3:
    dependencies:
      fill-range: 7.1.1

  browserslist@4.25.0:
    dependencies:
      caniuse-lite: 1.0.30001721
      electron-to-chromium: 1.5.165
      node-releases: 2.0.19
      update-browserslist-db: 1.1.3(browserslist@4.25.0)

  buffer-builder@0.2.0: {}

  buffer-from@1.1.2: {}

  buffer@5.7.1:
    dependencies:
      base64-js: 1.5.1
      ieee754: 1.2.1

  bundle-name@4.1.0:
    dependencies:
      run-applescript: 7.0.0

  bytes@3.1.2: {}

  call-bind-apply-helpers@1.0.2:
    dependencies:
      es-errors: 1.3.0
      function-bind: 1.1.2

  call-bound@1.0.4:
    dependencies:
      call-bind-apply-helpers: 1.0.2
      get-intrinsic: 1.3.0

  callsites@3.1.0: {}

  caniuse-api@3.0.0:
    dependencies:
      browserslist: 4.25.0
      caniuse-lite: 1.0.30001721
      lodash.memoize: 4.1.2
      lodash.uniq: 4.5.0

  caniuse-lite@1.0.30001721: {}

  chalk@4.1.2:
    dependencies:
      ansi-styles: 4.3.0
      supports-color: 7.2.0

  chokidar@3.6.0:
    dependencies:
      anymatch: 3.1.3
      braces: 3.0.3
      glob-parent: 5.1.2
      is-binary-path: 2.1.0
      is-glob: 4.0.3
      normalize-path: 3.0.0
      readdirp: 3.6.0
    optionalDependencies:
      fsevents: 2.3.3

  chokidar@4.0.3:
    dependencies:
      readdirp: 4.1.2

  chrome-trace-event@1.0.4: {}

  ci-info@3.9.0: {}

  cli-cursor@3.1.0:
    dependencies:
      restore-cursor: 3.1.0

  cli-spinners@2.6.1: {}

  cli-spinners@2.9.2: {}

  cliui@8.0.1:
    dependencies:
      string-width: 4.2.3
      strip-ansi: 6.0.1
      wrap-ansi: 7.0.0

  clone@1.0.4: {}

  color-convert@2.0.1:
    dependencies:
      color-name: 1.1.4

  color-name@1.1.4: {}

  colord@2.9.3: {}

  colorette@2.0.20: {}

  colorjs.io@0.5.2: {}

  columnify@1.6.0:
    dependencies:
      strip-ansi: 6.0.1
      wcwidth: 1.0.1

  combined-stream@1.0.8:
    dependencies:
      delayed-stream: 1.0.0

  commander@2.20.3: {}

  commander@7.2.0: {}

  common-path-prefix@3.0.0: {}

  compressible@2.0.18:
    dependencies:
      mime-db: 1.54.0

  compression@1.8.0:
    dependencies:
      bytes: 3.1.2
      compressible: 2.0.18
      debug: 2.6.9
      negotiator: 0.6.4
      on-headers: 1.0.2
      safe-buffer: 5.2.1
      vary: 1.1.2
    transitivePeerDependencies:
      - supports-color

  concat-map@0.0.1: {}

  connect-history-api-fallback@2.0.0: {}

  content-disposition@0.5.4:
    dependencies:
      safe-buffer: 5.2.1

  content-type@1.0.5: {}

  convert-source-map@2.0.0: {}

  cookie-signature@1.0.6: {}

  cookie@0.7.1: {}

  copy-anything@2.0.6:
    dependencies:
      is-what: 3.14.1

  copy-webpack-plugin@10.2.4(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))):
    dependencies:
      fast-glob: 3.3.3
      glob-parent: 6.0.2
      globby: 12.2.0
      normalize-path: 3.0.0
      schema-utils: 4.3.2
      serialize-javascript: 6.0.2
      webpack: 5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))

  core-js-compat@3.43.0:
    dependencies:
      browserslist: 4.25.0

  core-util-is@1.0.3: {}

  cosmiconfig@7.1.0:
    dependencies:
      '@types/parse-json': 4.0.2
      import-fresh: 3.3.1
      parse-json: 5.2.0
      path-type: 4.0.0
      yaml: 1.10.2

  cross-spawn@7.0.6:
    dependencies:
      path-key: 3.1.1
      shebang-command: 2.0.0
      which: 2.0.2

  css-declaration-sorter@7.2.0(postcss@8.5.4):
    dependencies:
      postcss: 8.5.4

  css-loader@6.11.0(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))):
    dependencies:
      icss-utils: 5.1.0(postcss@8.5.4)
      postcss: 8.5.4
      postcss-modules-extract-imports: 3.1.0(postcss@8.5.4)
      postcss-modules-local-by-default: 4.2.0(postcss@8.5.4)
      postcss-modules-scope: 3.2.1(postcss@8.5.4)
      postcss-modules-values: 4.0.0(postcss@8.5.4)
      postcss-value-parser: 4.2.0
      semver: 7.7.2
    optionalDependencies:
      webpack: 5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))

  css-minimizer-webpack-plugin@5.0.1(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))):
    dependencies:
      '@jridgewell/trace-mapping': 0.3.25
      cssnano: 6.1.2(postcss@8.5.4)
      jest-worker: 29.7.0
      postcss: 8.5.4
      schema-utils: 4.3.2
      serialize-javascript: 6.0.2
      webpack: 5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))

  css-select@5.1.0:
    dependencies:
      boolbase: 1.0.0
      css-what: 6.1.0
      domhandler: 5.0.3
      domutils: 3.2.2
      nth-check: 2.1.1

  css-tree@2.2.1:
    dependencies:
      mdn-data: 2.0.28
      source-map-js: 1.2.1

  css-tree@2.3.1:
    dependencies:
      mdn-data: 2.0.30
      source-map-js: 1.2.1

  css-what@6.1.0: {}

  cssesc@3.0.0: {}

  cssnano-preset-default@6.1.2(postcss@8.5.4):
    dependencies:
      browserslist: 4.25.0
      css-declaration-sorter: 7.2.0(postcss@8.5.4)
      cssnano-utils: 4.0.2(postcss@8.5.4)
      postcss: 8.5.4
      postcss-calc: 9.0.1(postcss@8.5.4)
      postcss-colormin: 6.1.0(postcss@8.5.4)
      postcss-convert-values: 6.1.0(postcss@8.5.4)
      postcss-discard-comments: 6.0.2(postcss@8.5.4)
      postcss-discard-duplicates: 6.0.3(postcss@8.5.4)
      postcss-discard-empty: 6.0.3(postcss@8.5.4)
      postcss-discard-overridden: 6.0.2(postcss@8.5.4)
      postcss-merge-longhand: 6.0.5(postcss@8.5.4)
      postcss-merge-rules: 6.1.1(postcss@8.5.4)
      postcss-minify-font-values: 6.1.0(postcss@8.5.4)
      postcss-minify-gradients: 6.0.3(postcss@8.5.4)
      postcss-minify-params: 6.1.0(postcss@8.5.4)
      postcss-minify-selectors: 6.0.4(postcss@8.5.4)
      postcss-normalize-charset: 6.0.2(postcss@8.5.4)
      postcss-normalize-display-values: 6.0.2(postcss@8.5.4)
      postcss-normalize-positions: 6.0.2(postcss@8.5.4)
      postcss-normalize-repeat-style: 6.0.2(postcss@8.5.4)
      postcss-normalize-string: 6.0.2(postcss@8.5.4)
      postcss-normalize-timing-functions: 6.0.2(postcss@8.5.4)
      postcss-normalize-unicode: 6.1.0(postcss@8.5.4)
      postcss-normalize-url: 6.0.2(postcss@8.5.4)
      postcss-normalize-whitespace: 6.0.2(postcss@8.5.4)
      postcss-ordered-values: 6.0.2(postcss@8.5.4)
      postcss-reduce-initial: 6.1.0(postcss@8.5.4)
      postcss-reduce-transforms: 6.0.2(postcss@8.5.4)
      postcss-svgo: 6.0.3(postcss@8.5.4)
      postcss-unique-selectors: 6.0.4(postcss@8.5.4)

  cssnano-utils@4.0.2(postcss@8.5.4):
    dependencies:
      postcss: 8.5.4

  cssnano@6.1.2(postcss@8.5.4):
    dependencies:
      cssnano-preset-default: 6.1.2(postcss@8.5.4)
      lilconfig: 3.1.3
      postcss: 8.5.4

  csso@5.0.5:
    dependencies:
      css-tree: 2.2.1

  debug@2.6.9:
    dependencies:
      ms: 2.0.0

  debug@4.4.1:
    dependencies:
      ms: 2.1.3

  deepmerge@4.3.1: {}

  default-browser-id@5.0.0: {}

  default-browser@5.2.1:
    dependencies:
      bundle-name: 4.1.0
      default-browser-id: 5.0.0

  defaults@1.0.4:
    dependencies:
      clone: 1.0.4

  define-lazy-prop@2.0.0: {}

  define-lazy-prop@3.0.0: {}

  delayed-stream@1.0.0: {}

  depd@1.1.2: {}

  depd@2.0.0: {}

  destroy@1.2.0: {}

  detect-libc@1.0.3:
    optional: true

  detect-node@2.1.0: {}

  detect-port@1.6.1:
    dependencies:
      address: 1.2.2
      debug: 4.4.1
    transitivePeerDependencies:
      - supports-color

  diff-sequences@29.6.3: {}

  dir-glob@3.0.1:
    dependencies:
      path-type: 4.0.0

  dns-packet@5.6.1:
    dependencies:
      '@leichtgewicht/ip-codec': 2.0.5

  dom-serializer@2.0.0:
    dependencies:
      domelementtype: 2.3.0
      domhandler: 5.0.3
      entities: 4.5.0

  domelementtype@2.3.0: {}

  domhandler@5.0.3:
    dependencies:
      domelementtype: 2.3.0

  domutils@3.2.2:
    dependencies:
      dom-serializer: 2.0.0
      domelementtype: 2.3.0
      domhandler: 5.0.3

  dotenv-expand@11.0.7:
    dependencies:
      dotenv: 16.4.7

  dotenv@16.4.7: {}

  dunder-proto@1.0.1:
    dependencies:
      call-bind-apply-helpers: 1.0.2
      es-errors: 1.3.0
      gopd: 1.2.0

  eastasianwidth@0.2.0: {}

  ee-first@1.1.1: {}

  ejs@3.1.10:
    dependencies:
      jake: 10.9.2

  electron-to-chromium@1.5.165: {}

  emoji-regex@8.0.0: {}

  emoji-regex@9.2.2: {}

  emojis-list@3.0.0: {}

  encodeurl@1.0.2: {}

  encodeurl@2.0.0: {}

  end-of-stream@1.4.4:
    dependencies:
      once: 1.4.0

  enhanced-resolve@5.18.1:
    dependencies:
      graceful-fs: 4.2.11
      tapable: 2.2.2

  enquirer@2.3.6:
    dependencies:
      ansi-colors: 4.1.3

  entities@4.5.0: {}

  errno@0.1.8:
    dependencies:
      prr: 1.0.1
    optional: true

  error-ex@1.3.2:
    dependencies:
      is-arrayish: 0.2.1

  es-define-property@1.0.1: {}

  es-errors@1.3.0: {}

  es-module-lexer@1.7.0: {}

  es-object-atoms@1.1.1:
    dependencies:
      es-errors: 1.3.0

  es-set-tostringtag@2.1.0:
    dependencies:
      es-errors: 1.3.0
      get-intrinsic: 1.3.0
      has-tostringtag: 1.0.2
      hasown: 2.0.2

  escalade@3.2.0: {}

  escape-html@1.0.3: {}

  escape-string-regexp@1.0.5: {}

  eslint-scope@5.1.1:
    dependencies:
      esrecurse: 4.3.0
      estraverse: 4.3.0

  esprima@4.0.1: {}

  esquery@1.6.0:
    dependencies:
      estraverse: 5.3.0

  esrecurse@4.3.0:
    dependencies:
      estraverse: 5.3.0

  estraverse@4.3.0: {}

  estraverse@5.3.0: {}

  esutils@2.0.3: {}

  etag@1.8.1: {}

  eventemitter3@4.0.7: {}

  events@3.3.0: {}

  express@4.21.2:
    dependencies:
      accepts: 1.3.8
      array-flatten: 1.1.1
      body-parser: 1.20.3
      content-disposition: 0.5.4
      content-type: 1.0.5
      cookie: 0.7.1
      cookie-signature: 1.0.6
      debug: 2.6.9
      depd: 2.0.0
      encodeurl: 2.0.0
      escape-html: 1.0.3
      etag: 1.8.1
      finalhandler: 1.3.1
      fresh: 0.5.2
      http-errors: 2.0.0
      merge-descriptors: 1.0.3
      methods: 1.1.2
      on-finished: 2.4.1
      parseurl: 1.3.3
      path-to-regexp: 0.1.12
      proxy-addr: 2.0.7
      qs: 6.13.0
      range-parser: 1.2.1
      safe-buffer: 5.2.1
      send: 0.19.0
      serve-static: 1.16.2
      setprototypeof: 1.2.0
      statuses: 2.0.1
      type-is: 1.6.18
      utils-merge: 1.0.1
      vary: 1.1.2
    transitivePeerDependencies:
      - supports-color

  fast-deep-equal@3.1.3: {}

  fast-glob@3.3.3:
    dependencies:
      '@nodelib/fs.stat': 2.0.5
      '@nodelib/fs.walk': 1.2.8
      glob-parent: 5.1.2
      merge2: 1.4.1
      micromatch: 4.0.8

  fast-json-stable-stringify@2.1.0: {}

  fast-uri@3.0.6: {}

  fastq@1.19.1:
    dependencies:
      reusify: 1.1.0

  faye-websocket@0.11.4:
    dependencies:
      websocket-driver: 0.7.4

  fdir@6.4.5(picomatch@4.0.2):
    optionalDependencies:
      picomatch: 4.0.2

  figures@3.2.0:
    dependencies:
      escape-string-regexp: 1.0.5

  filelist@1.0.4:
    dependencies:
      minimatch: 5.1.6

  fill-range@7.1.1:
    dependencies:
      to-regex-range: 5.0.1

  finalhandler@1.3.1:
    dependencies:
      debug: 2.6.9
      encodeurl: 2.0.0
      escape-html: 1.0.3
      on-finished: 2.4.1
      parseurl: 1.3.3
      statuses: 2.0.1
      unpipe: 1.0.0
    transitivePeerDependencies:
      - supports-color

  find-cache-dir@4.0.0:
    dependencies:
      common-path-prefix: 3.0.0
      pkg-dir: 7.0.0

  find-up@6.3.0:
    dependencies:
      locate-path: 7.2.0
      path-exists: 5.0.0

  flat@5.0.2: {}

  follow-redirects@1.15.9: {}

  foreground-child@3.3.1:
    dependencies:
      cross-spawn: 7.0.6
      signal-exit: 4.1.0

  fork-ts-checker-webpack-plugin@7.2.13(typescript@5.7.3)(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))):
    dependencies:
      '@babel/code-frame': 7.27.1
      chalk: 4.1.2
      chokidar: 3.6.0
      cosmiconfig: 7.1.0
      deepmerge: 4.3.1
      fs-extra: 10.1.0
      memfs: 3.5.3
      minimatch: 3.1.2
      node-abort-controller: 3.1.1
      schema-utils: 3.3.0
      semver: 7.7.2
      tapable: 2.2.2
      typescript: 5.7.3
      webpack: 5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))

  form-data@4.0.3:
    dependencies:
      asynckit: 0.4.0
      combined-stream: 1.0.8
      es-set-tostringtag: 2.1.0
      hasown: 2.0.2
      mime-types: 2.1.35

  forwarded@0.2.0: {}

  fraction.js@4.3.7: {}

  fresh@0.5.2: {}

  front-matter@4.0.2:
    dependencies:
      js-yaml: 3.14.1

  fs-constants@1.0.0: {}

  fs-extra@10.1.0:
    dependencies:
      graceful-fs: 4.2.11
      jsonfile: 6.1.0
      universalify: 2.0.1

  fs-monkey@1.0.6: {}

  fsevents@2.3.3:
    optional: true

  function-bind@1.1.2: {}

  gensync@1.0.0-beta.2: {}

  get-caller-file@2.0.5: {}

  get-intrinsic@1.3.0:
    dependencies:
      call-bind-apply-helpers: 1.0.2
      es-define-property: 1.0.1
      es-errors: 1.3.0
      es-object-atoms: 1.1.1
      function-bind: 1.1.2
      get-proto: 1.0.1
      gopd: 1.2.0
      has-symbols: 1.1.0
      hasown: 2.0.2
      math-intrinsics: 1.1.0

  get-proto@1.0.1:
    dependencies:
      dunder-proto: 1.0.1
      es-object-atoms: 1.1.1

  glob-parent@5.1.2:
    dependencies:
      is-glob: 4.0.3

  glob-parent@6.0.2:
    dependencies:
      is-glob: 4.0.3

  glob-to-regexp@0.4.1: {}

  glob@10.4.5:
    dependencies:
      foreground-child: 3.3.1
      jackspeak: 3.4.3
      minimatch: 9.0.5
      minipass: 7.1.2
      package-json-from-dist: 1.0.1
      path-scurry: 1.11.1

  globals@11.12.0: {}

  globby@12.2.0:
    dependencies:
      array-union: 3.0.1
      dir-glob: 3.0.1
      fast-glob: 3.3.3
      ignore: 5.3.2
      merge2: 1.4.1
      slash: 4.0.0

  gopd@1.2.0: {}

  graceful-fs@4.2.11: {}

  handle-thing@2.0.1: {}

  has-flag@4.0.0: {}

  has-symbols@1.1.0: {}

  has-tostringtag@1.0.2:
    dependencies:
      has-symbols: 1.1.0

  hasown@2.0.2:
    dependencies:
      function-bind: 1.1.2

  hosted-git-info@7.0.2:
    dependencies:
      lru-cache: 10.4.3

  hpack.js@2.1.6:
    dependencies:
      inherits: 2.0.4
      obuf: 1.1.2
      readable-stream: 2.3.8
      wbuf: 1.7.3

  http-deceiver@1.2.7: {}

  http-errors@1.6.3:
    dependencies:
      depd: 1.1.2
      inherits: 2.0.3
      setprototypeof: 1.1.0
      statuses: 1.5.0

  http-errors@2.0.0:
    dependencies:
      depd: 2.0.0
      inherits: 2.0.4
      setprototypeof: 1.2.0
      statuses: 2.0.1
      toidentifier: 1.0.1

  http-parser-js@0.5.10: {}

  http-proxy-middleware@2.0.9(@types/express@4.17.23):
    dependencies:
      '@types/http-proxy': 1.17.16
      http-proxy: 1.18.1
      is-glob: 4.0.3
      is-plain-obj: 3.0.0
      micromatch: 4.0.8
    optionalDependencies:
      '@types/express': 4.17.23
    transitivePeerDependencies:
      - debug

  http-proxy@1.18.1:
    dependencies:
      eventemitter3: 4.0.7
      follow-redirects: 1.15.9
      requires-port: 1.0.0
    transitivePeerDependencies:
      - debug

  hyperdyperid@1.2.0: {}

  iconv-lite@0.4.24:
    dependencies:
      safer-buffer: 2.1.2

  iconv-lite@0.6.3:
    dependencies:
      safer-buffer: 2.1.2

  icss-utils@5.1.0(postcss@8.5.4):
    dependencies:
      postcss: 8.5.4

  ieee754@1.2.1: {}

  ignore@5.3.2: {}

  image-size@0.5.5:
    optional: true

  immutable@5.1.2: {}

  import-fresh@3.3.1:
    dependencies:
      parent-module: 1.0.1
      resolve-from: 4.0.0

  inherits@2.0.3: {}

  inherits@2.0.4: {}

  ipaddr.js@1.9.1: {}

  ipaddr.js@2.2.0: {}

  is-arrayish@0.2.1: {}

  is-binary-path@2.1.0:
    dependencies:
      binary-extensions: 2.3.0

  is-core-module@2.16.1:
    dependencies:
      hasown: 2.0.2

  is-docker@2.2.1: {}

  is-docker@3.0.0: {}

  is-extglob@2.1.1: {}

  is-fullwidth-code-point@3.0.0: {}

  is-glob@4.0.3:
    dependencies:
      is-extglob: 2.1.1

  is-inside-container@1.0.0:
    dependencies:
      is-docker: 3.0.0

  is-interactive@1.0.0: {}

  is-network-error@1.1.0: {}

  is-number@7.0.0: {}

  is-plain-obj@3.0.0: {}

  is-unicode-supported@0.1.0: {}

  is-what@3.14.1: {}

  is-wsl@2.2.0:
    dependencies:
      is-docker: 2.2.1

  is-wsl@3.1.0:
    dependencies:
      is-inside-container: 1.0.0

  isarray@1.0.0: {}

  isexe@2.0.0: {}

  jackspeak@3.4.3:
    dependencies:
      '@isaacs/cliui': 8.0.2
    optionalDependencies:
      '@pkgjs/parseargs': 0.11.0

  jake@10.9.2:
    dependencies:
      async: 3.2.6
      chalk: 4.1.2
      filelist: 1.0.4
      minimatch: 3.1.2

  jest-diff@29.7.0:
    dependencies:
      chalk: 4.1.2
      diff-sequences: 29.6.3
      jest-get-type: 29.6.3
      pretty-format: 29.7.0

  jest-get-type@29.6.3: {}

  jest-util@29.7.0:
    dependencies:
      '@jest/types': 29.6.3
      '@types/node': 18.16.9
      chalk: 4.1.2
      ci-info: 3.9.0
      graceful-fs: 4.2.11
      picomatch: 2.3.1

  jest-worker@27.5.1:
    dependencies:
      '@types/node': 18.16.9
      merge-stream: 2.0.0
      supports-color: 8.1.1

  jest-worker@29.7.0:
    dependencies:
      '@types/node': 18.16.9
      jest-util: 29.7.0
      merge-stream: 2.0.0
      supports-color: 8.1.1

  js-tokens@4.0.0: {}

  js-yaml@3.14.1:
    dependencies:
      argparse: 1.0.10
      esprima: 4.0.1

  jsesc@3.0.2: {}

  jsesc@3.1.0: {}

  json-parse-even-better-errors@2.3.1: {}

  json-schema-traverse@0.4.1: {}

  json-schema-traverse@1.0.0: {}

  json5@2.2.3: {}

  jsonc-parser@3.2.0: {}

  jsonfile@6.1.0:
    dependencies:
      universalify: 2.0.1
    optionalDependencies:
      graceful-fs: 4.2.11

  klona@2.0.6: {}

  launch-editor@2.10.0:
    dependencies:
      picocolors: 1.1.1
      shell-quote: 1.8.3

  less-loader@11.1.0(less@4.1.3)(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))):
    dependencies:
      klona: 2.0.6
      less: 4.1.3
      webpack: 5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))

  less@4.1.3:
    dependencies:
      copy-anything: 2.0.6
      parse-node-version: 1.0.1
      tslib: 2.8.1
    optionalDependencies:
      errno: 0.1.8
      graceful-fs: 4.2.11
      image-size: 0.5.5
      make-dir: 2.1.0
      mime: 1.6.0
      needle: 3.3.1
      source-map: 0.6.1

  license-webpack-plugin@4.0.2(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))):
    dependencies:
      webpack-sources: 3.3.2
    optionalDependencies:
      webpack: 5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))

  lilconfig@3.1.3: {}

  lines-and-columns@1.2.4: {}

  lines-and-columns@2.0.3: {}

  loader-runner@4.3.0: {}

  loader-utils@2.0.4:
    dependencies:
      big.js: 5.2.2
      emojis-list: 3.0.0
      json5: 2.2.3

  locate-path@7.2.0:
    dependencies:
      p-locate: 6.0.0

  lodash.debounce@4.0.8: {}

  lodash.memoize@4.1.2: {}

  lodash.uniq@4.5.0: {}

  lodash@4.17.21: {}

  log-symbols@4.1.0:
    dependencies:
      chalk: 4.1.2
      is-unicode-supported: 0.1.0

  lru-cache@10.4.3: {}

  lru-cache@5.1.1:
    dependencies:
      yallist: 3.1.1

  make-dir@2.1.0:
    dependencies:
      pify: 4.0.1
      semver: 5.7.2
    optional: true

  math-intrinsics@1.1.0: {}

  mdn-data@2.0.28: {}

  mdn-data@2.0.30: {}

  media-typer@0.3.0: {}

  memfs@3.5.3:
    dependencies:
      fs-monkey: 1.0.6

  memfs@4.17.2:
    dependencies:
      '@jsonjoy.com/json-pack': 1.2.0(tslib@2.8.1)
      '@jsonjoy.com/util': 1.6.0(tslib@2.8.1)
      tree-dump: 1.0.3(tslib@2.8.1)
      tslib: 2.8.1

  merge-descriptors@1.0.3: {}

  merge-stream@2.0.0: {}

  merge2@1.4.1: {}

  methods@1.1.2: {}

  micromatch@4.0.8:
    dependencies:
      braces: 3.0.3
      picomatch: 2.3.1

  mime-db@1.52.0: {}

  mime-db@1.54.0: {}

  mime-types@2.1.35:
    dependencies:
      mime-db: 1.52.0

  mime@1.6.0: {}

  mimic-fn@2.1.0: {}

  mini-css-extract-plugin@2.4.7(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))):
    dependencies:
      schema-utils: 4.3.2
      webpack: 5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))

  minimalistic-assert@1.0.1: {}

  minimatch@3.1.2:
    dependencies:
      brace-expansion: 1.1.11

  minimatch@5.1.6:
    dependencies:
      brace-expansion: 2.0.1

  minimatch@9.0.3:
    dependencies:
      brace-expansion: 2.0.1

  minimatch@9.0.5:
    dependencies:
      brace-expansion: 2.0.1

  minimist@1.2.8: {}

  minipass@7.1.2: {}

  ms@2.0.0: {}

  ms@2.1.3: {}

  multicast-dns@7.2.5:
    dependencies:
      dns-packet: 5.6.1
      thunky: 1.1.0

  nanoid@3.3.11: {}

  needle@3.3.1:
    dependencies:
      iconv-lite: 0.6.3
      sax: 1.4.1
    optional: true

  negotiator@0.6.3: {}

  negotiator@0.6.4: {}

  neo-async@2.6.2: {}

  node-abort-controller@3.1.1: {}

  node-addon-api@7.1.1:
    optional: true

  node-forge@1.3.1: {}

  node-machine-id@1.1.12: {}

  node-releases@2.0.19: {}

  normalize-path@3.0.0: {}

  normalize-range@0.1.2: {}

  npm-package-arg@11.0.1:
    dependencies:
      hosted-git-info: 7.0.2
      proc-log: 3.0.0
      semver: 7.7.2
      validate-npm-package-name: 5.0.1

  npm-run-path@4.0.1:
    dependencies:
      path-key: 3.1.1

  nth-check@2.1.1:
    dependencies:
      boolbase: 1.0.0

  nx@21.1.2(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17)):
    dependencies:
      '@napi-rs/wasm-runtime': 0.2.4
      '@yarnpkg/lockfile': 1.1.0
      '@yarnpkg/parsers': 3.0.2
      '@zkochan/js-yaml': 0.0.7
      axios: 1.9.0
      chalk: 4.1.2
      cli-cursor: 3.1.0
      cli-spinners: 2.6.1
      cliui: 8.0.1
      dotenv: 16.4.7
      dotenv-expand: 11.0.7
      enquirer: 2.3.6
      figures: 3.2.0
      flat: 5.0.2
      front-matter: 4.0.2
      ignore: 5.3.2
      jest-diff: 29.7.0
      jsonc-parser: 3.2.0
      lines-and-columns: 2.0.3
      minimatch: 9.0.3
      node-machine-id: 1.1.12
      npm-run-path: 4.0.1
      open: 8.4.2
      ora: 5.3.0
      resolve.exports: 2.0.3
      semver: 7.7.2
      string-width: 4.2.3
      tar-stream: 2.2.0
      tmp: 0.2.3
      tree-kill: 1.2.2
      tsconfig-paths: 4.2.0
      tslib: 2.8.1
      yaml: 2.8.0
      yargs: 17.7.2
      yargs-parser: 21.1.1
    optionalDependencies:
      '@nx/nx-darwin-arm64': 21.1.2
      '@nx/nx-darwin-x64': 21.1.2
      '@nx/nx-freebsd-x64': 21.1.2
      '@nx/nx-linux-arm-gnueabihf': 21.1.2
      '@nx/nx-linux-arm64-gnu': 21.1.2
      '@nx/nx-linux-arm64-musl': 21.1.2
      '@nx/nx-linux-x64-gnu': 21.1.2
      '@nx/nx-linux-x64-musl': 21.1.2
      '@nx/nx-win32-arm64-msvc': 21.1.2
      '@nx/nx-win32-x64-msvc': 21.1.2
      '@swc-node/register': 1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3)
      '@swc/core': 1.5.29(@swc/helpers@0.5.17)
    transitivePeerDependencies:
      - debug

  nx@21.1.3(@swc-node/register@1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3))(@swc/core@1.5.29(@swc/helpers@0.5.17)):
    dependencies:
      '@napi-rs/wasm-runtime': 0.2.4
      '@yarnpkg/lockfile': 1.1.0
      '@yarnpkg/parsers': 3.0.2
      '@zkochan/js-yaml': 0.0.7
      axios: 1.9.0
      chalk: 4.1.2
      cli-cursor: 3.1.0
      cli-spinners: 2.6.1
      cliui: 8.0.1
      dotenv: 16.4.7
      dotenv-expand: 11.0.7
      enquirer: 2.3.6
      figures: 3.2.0
      flat: 5.0.2
      front-matter: 4.0.2
      ignore: 5.3.2
      jest-diff: 29.7.0
      jsonc-parser: 3.2.0
      lines-and-columns: 2.0.3
      minimatch: 9.0.3
      node-machine-id: 1.1.12
      npm-run-path: 4.0.1
      open: 8.4.2
      ora: 5.3.0
      resolve.exports: 2.0.3
      semver: 7.7.2
      string-width: 4.2.3
      tar-stream: 2.2.0
      tmp: 0.2.3
      tree-kill: 1.2.2
      tsconfig-paths: 4.2.0
      tslib: 2.8.1
      yaml: 2.8.0
      yargs: 17.7.2
      yargs-parser: 21.1.1
    optionalDependencies:
      '@nx/nx-darwin-arm64': 21.1.3
      '@nx/nx-darwin-x64': 21.1.3
      '@nx/nx-freebsd-x64': 21.1.3
      '@nx/nx-linux-arm-gnueabihf': 21.1.3
      '@nx/nx-linux-arm64-gnu': 21.1.3
      '@nx/nx-linux-arm64-musl': 21.1.3
      '@nx/nx-linux-x64-gnu': 21.1.3
      '@nx/nx-linux-x64-musl': 21.1.3
      '@nx/nx-win32-arm64-msvc': 21.1.3
      '@nx/nx-win32-x64-msvc': 21.1.3
      '@swc-node/register': 1.9.2(@swc/core@1.5.29(@swc/helpers@0.5.17))(@swc/types@0.1.22)(typescript@5.7.3)
      '@swc/core': 1.5.29(@swc/helpers@0.5.17)
    transitivePeerDependencies:
      - debug

  object-inspect@1.13.4: {}

  obuf@1.1.2: {}

  on-finished@2.4.1:
    dependencies:
      ee-first: 1.1.1

  on-headers@1.0.2: {}

  once@1.4.0:
    dependencies:
      wrappy: 1.0.2

  onetime@5.1.2:
    dependencies:
      mimic-fn: 2.1.0

  open@10.1.2:
    dependencies:
      default-browser: 5.2.1
      define-lazy-prop: 3.0.0
      is-inside-container: 1.0.0
      is-wsl: 3.1.0

  open@8.4.2:
    dependencies:
      define-lazy-prop: 2.0.0
      is-docker: 2.2.1
      is-wsl: 2.2.0

  ora@5.3.0:
    dependencies:
      bl: 4.1.0
      chalk: 4.1.2
      cli-cursor: 3.1.0
      cli-spinners: 2.9.2
      is-interactive: 1.0.0
      log-symbols: 4.1.0
      strip-ansi: 6.0.1
      wcwidth: 1.0.1

  p-limit@4.0.0:
    dependencies:
      yocto-queue: 1.2.1

  p-locate@6.0.0:
    dependencies:
      p-limit: 4.0.0

  p-retry@6.2.1:
    dependencies:
      '@types/retry': 0.12.2
      is-network-error: 1.1.0
      retry: 0.13.1

  package-json-from-dist@1.0.1: {}

  parent-module@1.0.1:
    dependencies:
      callsites: 3.1.0

  parse-json@5.2.0:
    dependencies:
      '@babel/code-frame': 7.27.1
      error-ex: 1.3.2
      json-parse-even-better-errors: 2.3.1
      lines-and-columns: 1.2.4

  parse-node-version@1.0.1: {}

  parse5@4.0.0: {}

  parseurl@1.3.3: {}

  path-exists@5.0.0: {}

  path-key@3.1.1: {}

  path-parse@1.0.7: {}

  path-scurry@1.11.1:
    dependencies:
      lru-cache: 10.4.3
      minipass: 7.1.2

  path-to-regexp@0.1.12: {}

  path-type@4.0.0: {}

  picocolors@1.1.1: {}

  picomatch@2.3.1: {}

  picomatch@4.0.2: {}

  pify@2.3.0: {}

  pify@4.0.1:
    optional: true

  pirates@4.0.7: {}

  pkg-dir@7.0.0:
    dependencies:
      find-up: 6.3.0

  postcss-calc@9.0.1(postcss@8.5.4):
    dependencies:
      postcss: 8.5.4
      postcss-selector-parser: 6.1.2
      postcss-value-parser: 4.2.0

  postcss-colormin@6.1.0(postcss@8.5.4):
    dependencies:
      browserslist: 4.25.0
      caniuse-api: 3.0.0
      colord: 2.9.3
      postcss: 8.5.4
      postcss-value-parser: 4.2.0

  postcss-convert-values@6.1.0(postcss@8.5.4):
    dependencies:
      browserslist: 4.25.0
      postcss: 8.5.4
      postcss-value-parser: 4.2.0

  postcss-discard-comments@6.0.2(postcss@8.5.4):
    dependencies:
      postcss: 8.5.4

  postcss-discard-duplicates@6.0.3(postcss@8.5.4):
    dependencies:
      postcss: 8.5.4

  postcss-discard-empty@6.0.3(postcss@8.5.4):
    dependencies:
      postcss: 8.5.4

  postcss-discard-overridden@6.0.2(postcss@8.5.4):
    dependencies:
      postcss: 8.5.4

  postcss-import@14.1.0(postcss@8.5.4):
    dependencies:
      postcss: 8.5.4
      postcss-value-parser: 4.2.0
      read-cache: 1.0.0
      resolve: 1.22.10

  postcss-loader@6.2.1(postcss@8.5.4)(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))):
    dependencies:
      cosmiconfig: 7.1.0
      klona: 2.0.6
      postcss: 8.5.4
      semver: 7.7.2
      webpack: 5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))

  postcss-merge-longhand@6.0.5(postcss@8.5.4):
    dependencies:
      postcss: 8.5.4
      postcss-value-parser: 4.2.0
      stylehacks: 6.1.1(postcss@8.5.4)

  postcss-merge-rules@6.1.1(postcss@8.5.4):
    dependencies:
      browserslist: 4.25.0
      caniuse-api: 3.0.0
      cssnano-utils: 4.0.2(postcss@8.5.4)
      postcss: 8.5.4
      postcss-selector-parser: 6.1.2

  postcss-minify-font-values@6.1.0(postcss@8.5.4):
    dependencies:
      postcss: 8.5.4
      postcss-value-parser: 4.2.0

  postcss-minify-gradients@6.0.3(postcss@8.5.4):
    dependencies:
      colord: 2.9.3
      cssnano-utils: 4.0.2(postcss@8.5.4)
      postcss: 8.5.4
      postcss-value-parser: 4.2.0

  postcss-minify-params@6.1.0(postcss@8.5.4):
    dependencies:
      browserslist: 4.25.0
      cssnano-utils: 4.0.2(postcss@8.5.4)
      postcss: 8.5.4
      postcss-value-parser: 4.2.0

  postcss-minify-selectors@6.0.4(postcss@8.5.4):
    dependencies:
      postcss: 8.5.4
      postcss-selector-parser: 6.1.2

  postcss-modules-extract-imports@3.1.0(postcss@8.5.4):
    dependencies:
      postcss: 8.5.4

  postcss-modules-local-by-default@4.2.0(postcss@8.5.4):
    dependencies:
      icss-utils: 5.1.0(postcss@8.5.4)
      postcss: 8.5.4
      postcss-selector-parser: 7.1.0
      postcss-value-parser: 4.2.0

  postcss-modules-scope@3.2.1(postcss@8.5.4):
    dependencies:
      postcss: 8.5.4
      postcss-selector-parser: 7.1.0

  postcss-modules-values@4.0.0(postcss@8.5.4):
    dependencies:
      icss-utils: 5.1.0(postcss@8.5.4)
      postcss: 8.5.4

  postcss-normalize-charset@6.0.2(postcss@8.5.4):
    dependencies:
      postcss: 8.5.4

  postcss-normalize-display-values@6.0.2(postcss@8.5.4):
    dependencies:
      postcss: 8.5.4
      postcss-value-parser: 4.2.0

  postcss-normalize-positions@6.0.2(postcss@8.5.4):
    dependencies:
      postcss: 8.5.4
      postcss-value-parser: 4.2.0

  postcss-normalize-repeat-style@6.0.2(postcss@8.5.4):
    dependencies:
      postcss: 8.5.4
      postcss-value-parser: 4.2.0

  postcss-normalize-string@6.0.2(postcss@8.5.4):
    dependencies:
      postcss: 8.5.4
      postcss-value-parser: 4.2.0

  postcss-normalize-timing-functions@6.0.2(postcss@8.5.4):
    dependencies:
      postcss: 8.5.4
      postcss-value-parser: 4.2.0

  postcss-normalize-unicode@6.1.0(postcss@8.5.4):
    dependencies:
      browserslist: 4.25.0
      postcss: 8.5.4
      postcss-value-parser: 4.2.0

  postcss-normalize-url@6.0.2(postcss@8.5.4):
    dependencies:
      postcss: 8.5.4
      postcss-value-parser: 4.2.0

  postcss-normalize-whitespace@6.0.2(postcss@8.5.4):
    dependencies:
      postcss: 8.5.4
      postcss-value-parser: 4.2.0

  postcss-ordered-values@6.0.2(postcss@8.5.4):
    dependencies:
      cssnano-utils: 4.0.2(postcss@8.5.4)
      postcss: 8.5.4
      postcss-value-parser: 4.2.0

  postcss-reduce-initial@6.1.0(postcss@8.5.4):
    dependencies:
      browserslist: 4.25.0
      caniuse-api: 3.0.0
      postcss: 8.5.4

  postcss-reduce-transforms@6.0.2(postcss@8.5.4):
    dependencies:
      postcss: 8.5.4
      postcss-value-parser: 4.2.0

  postcss-selector-parser@6.1.2:
    dependencies:
      cssesc: 3.0.0
      util-deprecate: 1.0.2

  postcss-selector-parser@7.1.0:
    dependencies:
      cssesc: 3.0.0
      util-deprecate: 1.0.2

  postcss-svgo@6.0.3(postcss@8.5.4):
    dependencies:
      postcss: 8.5.4
      postcss-value-parser: 4.2.0
      svgo: 3.3.2

  postcss-unique-selectors@6.0.4(postcss@8.5.4):
    dependencies:
      postcss: 8.5.4
      postcss-selector-parser: 6.1.2

  postcss-value-parser@4.2.0: {}

  postcss@8.5.4:
    dependencies:
      nanoid: 3.3.11
      picocolors: 1.1.1
      source-map-js: 1.2.1

  pretty-format@29.7.0:
    dependencies:
      '@jest/schemas': 29.6.3
      ansi-styles: 5.2.0
      react-is: 18.3.1

  proc-log@3.0.0: {}

  process-nextick-args@2.0.1: {}

  proxy-addr@2.0.7:
    dependencies:
      forwarded: 0.2.0
      ipaddr.js: 1.9.1

  proxy-from-env@1.1.0: {}

  prr@1.0.1:
    optional: true

  punycode@2.3.1: {}

  qs@6.13.0:
    dependencies:
      side-channel: 1.1.0

  queue-microtask@1.2.3: {}

  randombytes@2.1.0:
    dependencies:
      safe-buffer: 5.2.1

  range-parser@1.2.1: {}

  raw-body@2.5.2:
    dependencies:
      bytes: 3.1.2
      http-errors: 2.0.0
      iconv-lite: 0.4.24
      unpipe: 1.0.0

  react-is@18.3.1: {}

  read-cache@1.0.0:
    dependencies:
      pify: 2.3.0

  readable-stream@2.3.8:
    dependencies:
      core-util-is: 1.0.3
      inherits: 2.0.4
      isarray: 1.0.0
      process-nextick-args: 2.0.1
      safe-buffer: 5.1.2
      string_decoder: 1.1.1
      util-deprecate: 1.0.2

  readable-stream@3.6.2:
    dependencies:
      inherits: 2.0.4
      string_decoder: 1.3.0
      util-deprecate: 1.0.2

  readdirp@3.6.0:
    dependencies:
      picomatch: 2.3.1

  readdirp@4.1.2: {}

  regenerate-unicode-properties@10.2.0:
    dependencies:
      regenerate: 1.4.2

  regenerate@1.4.2: {}

  regexpu-core@6.2.0:
    dependencies:
      regenerate: 1.4.2
      regenerate-unicode-properties: 10.2.0
      regjsgen: 0.8.0
      regjsparser: 0.12.0
      unicode-match-property-ecmascript: 2.0.0
      unicode-match-property-value-ecmascript: 2.2.0

  regjsgen@0.8.0: {}

  regjsparser@0.12.0:
    dependencies:
      jsesc: 3.0.2

  require-directory@2.1.1: {}

  require-from-string@2.0.2: {}

  requires-port@1.0.0: {}

  resolve-from@4.0.0: {}

  resolve.exports@2.0.3: {}

  resolve@1.22.10:
    dependencies:
      is-core-module: 2.16.1
      path-parse: 1.0.7
      supports-preserve-symlinks-flag: 1.0.0

  restore-cursor@3.1.0:
    dependencies:
      onetime: 5.1.2
      signal-exit: 3.0.7

  retry@0.13.1: {}

  reusify@1.1.0: {}

  run-applescript@7.0.0: {}

  run-parallel@1.2.0:
    dependencies:
      queue-microtask: 1.2.3

  rxjs@7.8.2:
    dependencies:
      tslib: 2.8.1

  safe-buffer@5.1.2: {}

  safe-buffer@5.2.1: {}

  safer-buffer@2.1.2: {}

  sass-embedded-android-arm64@1.89.1:
    optional: true

  sass-embedded-android-arm@1.89.1:
    optional: true

  sass-embedded-android-riscv64@1.89.1:
    optional: true

  sass-embedded-android-x64@1.89.1:
    optional: true

  sass-embedded-darwin-arm64@1.89.1:
    optional: true

  sass-embedded-darwin-x64@1.89.1:
    optional: true

  sass-embedded-linux-arm64@1.89.1:
    optional: true

  sass-embedded-linux-arm@1.89.1:
    optional: true

  sass-embedded-linux-musl-arm64@1.89.1:
    optional: true

  sass-embedded-linux-musl-arm@1.89.1:
    optional: true

  sass-embedded-linux-musl-riscv64@1.89.1:
    optional: true

  sass-embedded-linux-musl-x64@1.89.1:
    optional: true

  sass-embedded-linux-riscv64@1.89.1:
    optional: true

  sass-embedded-linux-x64@1.89.1:
    optional: true

  sass-embedded-win32-arm64@1.89.1:
    optional: true

  sass-embedded-win32-x64@1.89.1:
    optional: true

  sass-embedded@1.89.1:
    dependencies:
      '@bufbuild/protobuf': 2.5.2
      buffer-builder: 0.2.0
      colorjs.io: 0.5.2
      immutable: 5.1.2
      rxjs: 7.8.2
      supports-color: 8.1.1
      sync-child-process: 1.0.2
      varint: 6.0.0
    optionalDependencies:
      sass-embedded-android-arm: 1.89.1
      sass-embedded-android-arm64: 1.89.1
      sass-embedded-android-riscv64: 1.89.1
      sass-embedded-android-x64: 1.89.1
      sass-embedded-darwin-arm64: 1.89.1
      sass-embedded-darwin-x64: 1.89.1
      sass-embedded-linux-arm: 1.89.1
      sass-embedded-linux-arm64: 1.89.1
      sass-embedded-linux-musl-arm: 1.89.1
      sass-embedded-linux-musl-arm64: 1.89.1
      sass-embedded-linux-musl-riscv64: 1.89.1
      sass-embedded-linux-musl-x64: 1.89.1
      sass-embedded-linux-riscv64: 1.89.1
      sass-embedded-linux-x64: 1.89.1
      sass-embedded-win32-arm64: 1.89.1
      sass-embedded-win32-x64: 1.89.1

  sass-loader@16.0.5(sass-embedded@1.89.1)(sass@1.89.1)(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))):
    dependencies:
      neo-async: 2.6.2
    optionalDependencies:
      sass: 1.89.1
      sass-embedded: 1.89.1
      webpack: 5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))

  sass@1.89.1:
    dependencies:
      chokidar: 4.0.3
      immutable: 5.1.2
      source-map-js: 1.2.1
    optionalDependencies:
      '@parcel/watcher': 2.5.1

  sax@1.4.1: {}

  schema-utils@3.3.0:
    dependencies:
      '@types/json-schema': 7.0.15
      ajv: 6.12.6
      ajv-keywords: 3.5.2(ajv@6.12.6)

  schema-utils@4.3.2:
    dependencies:
      '@types/json-schema': 7.0.15
      ajv: 8.17.1
      ajv-formats: 2.1.1(ajv@8.17.1)
      ajv-keywords: 5.1.0(ajv@8.17.1)

  select-hose@2.0.0: {}

  selfsigned@2.4.1:
    dependencies:
      '@types/node-forge': 1.3.11
      node-forge: 1.3.1

  semver@5.7.2:
    optional: true

  semver@6.3.1: {}

  semver@7.7.2: {}

  send@0.19.0:
    dependencies:
      debug: 2.6.9
      depd: 2.0.0
      destroy: 1.2.0
      encodeurl: 1.0.2
      escape-html: 1.0.3
      etag: 1.8.1
      fresh: 0.5.2
      http-errors: 2.0.0
      mime: 1.6.0
      ms: 2.1.3
      on-finished: 2.4.1
      range-parser: 1.2.1
      statuses: 2.0.1
    transitivePeerDependencies:
      - supports-color

  serialize-javascript@6.0.2:
    dependencies:
      randombytes: 2.1.0

  serve-index@1.9.1:
    dependencies:
      accepts: 1.3.8
      batch: 0.6.1
      debug: 2.6.9
      escape-html: 1.0.3
      http-errors: 1.6.3
      mime-types: 2.1.35
      parseurl: 1.3.3
    transitivePeerDependencies:
      - supports-color

  serve-static@1.16.2:
    dependencies:
      encodeurl: 2.0.0
      escape-html: 1.0.3
      parseurl: 1.3.3
      send: 0.19.0
    transitivePeerDependencies:
      - supports-color

  setprototypeof@1.1.0: {}

  setprototypeof@1.2.0: {}

  shebang-command@2.0.0:
    dependencies:
      shebang-regex: 3.0.0

  shebang-regex@3.0.0: {}

  shell-quote@1.8.3: {}

  side-channel-list@1.0.0:
    dependencies:
      es-errors: 1.3.0
      object-inspect: 1.13.4

  side-channel-map@1.0.1:
    dependencies:
      call-bound: 1.0.4
      es-errors: 1.3.0
      get-intrinsic: 1.3.0
      object-inspect: 1.13.4

  side-channel-weakmap@1.0.2:
    dependencies:
      call-bound: 1.0.4
      es-errors: 1.3.0
      get-intrinsic: 1.3.0
      object-inspect: 1.13.4
      side-channel-map: 1.0.1

  side-channel@1.1.0:
    dependencies:
      es-errors: 1.3.0
      object-inspect: 1.13.4
      side-channel-list: 1.0.0
      side-channel-map: 1.0.1
      side-channel-weakmap: 1.0.2

  signal-exit@3.0.7: {}

  signal-exit@4.1.0: {}

  slash@4.0.0: {}

  sockjs@0.3.24:
    dependencies:
      faye-websocket: 0.11.4
      uuid: 8.3.2
      websocket-driver: 0.7.4

  source-map-js@1.2.1: {}

  source-map-loader@5.0.0(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))):
    dependencies:
      iconv-lite: 0.6.3
      source-map-js: 1.2.1
      webpack: 5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))

  source-map-support@0.5.19:
    dependencies:
      buffer-from: 1.1.2
      source-map: 0.6.1

  source-map-support@0.5.21:
    dependencies:
      buffer-from: 1.1.2
      source-map: 0.6.1

  source-map@0.6.1: {}

  source-map@0.7.4: {}

  spdy-transport@3.0.0:
    dependencies:
      debug: 4.4.1
      detect-node: 2.1.0
      hpack.js: 2.1.6
      obuf: 1.1.2
      readable-stream: 3.6.2
      wbuf: 1.7.3
    transitivePeerDependencies:
      - supports-color

  spdy@4.0.2:
    dependencies:
      debug: 4.4.1
      handle-thing: 2.0.1
      http-deceiver: 1.2.7
      select-hose: 2.0.0
      spdy-transport: 3.0.0
    transitivePeerDependencies:
      - supports-color

  sprintf-js@1.0.3: {}

  statuses@1.5.0: {}

  statuses@2.0.1: {}

  string-width@4.2.3:
    dependencies:
      emoji-regex: 8.0.0
      is-fullwidth-code-point: 3.0.0
      strip-ansi: 6.0.1

  string-width@5.1.2:
    dependencies:
      eastasianwidth: 0.2.0
      emoji-regex: 9.2.2
      strip-ansi: 7.1.0

  string_decoder@1.1.1:
    dependencies:
      safe-buffer: 5.1.2

  string_decoder@1.3.0:
    dependencies:
      safe-buffer: 5.2.1

  strip-ansi@6.0.1:
    dependencies:
      ansi-regex: 5.0.1

  strip-ansi@7.1.0:
    dependencies:
      ansi-regex: 6.1.0

  strip-bom@3.0.0: {}

  style-loader@3.3.4(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))):
    dependencies:
      webpack: 5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))

  stylehacks@6.1.1(postcss@8.5.4):
    dependencies:
      browserslist: 4.25.0
      postcss: 8.5.4
      postcss-selector-parser: 6.1.2

  stylus-loader@7.1.3(stylus@0.64.0)(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))):
    dependencies:
      fast-glob: 3.3.3
      normalize-path: 3.0.0
      stylus: 0.64.0
      webpack: 5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))

  stylus@0.64.0:
    dependencies:
      '@adobe/css-tools': 4.3.3
      debug: 4.4.1
      glob: 10.4.5
      sax: 1.4.1
      source-map: 0.7.4
    transitivePeerDependencies:
      - supports-color

  supports-color@7.2.0:
    dependencies:
      has-flag: 4.0.0

  supports-color@8.1.1:
    dependencies:
      has-flag: 4.0.0

  supports-preserve-symlinks-flag@1.0.0: {}

  svgo@3.3.2:
    dependencies:
      '@trysound/sax': 0.2.0
      commander: 7.2.0
      css-select: 5.1.0
      css-tree: 2.3.1
      css-what: 6.1.0
      csso: 5.0.5
      picocolors: 1.1.1

  sync-child-process@1.0.2:
    dependencies:
      sync-message-port: 1.1.3

  sync-message-port@1.1.3: {}

  tapable@2.2.2: {}

  tar-stream@2.2.0:
    dependencies:
      bl: 4.1.0
      end-of-stream: 1.4.4
      fs-constants: 1.0.0
      inherits: 2.0.4
      readable-stream: 3.6.2

  terser-webpack-plugin@5.3.14(@swc/core@1.5.29(@swc/helpers@0.5.17))(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))):
    dependencies:
      '@jridgewell/trace-mapping': 0.3.25
      jest-worker: 27.5.1
      schema-utils: 4.3.2
      serialize-javascript: 6.0.2
      terser: 5.41.0
      webpack: 5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))
    optionalDependencies:
      '@swc/core': 1.5.29(@swc/helpers@0.5.17)

  terser@5.41.0:
    dependencies:
      '@jridgewell/source-map': 0.3.6
      acorn: 8.15.0
      commander: 2.20.3
      source-map-support: 0.5.21

  thingies@1.21.0(tslib@2.8.1):
    dependencies:
      tslib: 2.8.1

  thunky@1.1.0: {}

  tinyglobby@0.2.14:
    dependencies:
      fdir: 6.4.5(picomatch@4.0.2)
      picomatch: 4.0.2

  tmp@0.2.3: {}

  to-regex-range@5.0.1:
    dependencies:
      is-number: 7.0.0

  toidentifier@1.0.1: {}

  tree-dump@1.0.3(tslib@2.8.1):
    dependencies:
      tslib: 2.8.1

  tree-kill@1.2.2: {}

  ts-loader@9.5.2(typescript@5.7.3)(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))):
    dependencies:
      chalk: 4.1.2
      enhanced-resolve: 5.18.1
      micromatch: 4.0.8
      semver: 7.7.2
      source-map: 0.7.4
      typescript: 5.7.3
      webpack: 5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))

  tsconfig-paths-webpack-plugin@4.0.0:
    dependencies:
      chalk: 4.1.2
      enhanced-resolve: 5.18.1
      tsconfig-paths: 4.2.0

  tsconfig-paths@4.2.0:
    dependencies:
      json5: 2.2.3
      minimist: 1.2.8
      strip-bom: 3.0.0

  tslib@2.8.1: {}

  type-is@1.6.18:
    dependencies:
      media-typer: 0.3.0
      mime-types: 2.1.35

  typed-assert@1.0.9: {}

  typescript@5.7.3: {}

  unicode-canonical-property-names-ecmascript@2.0.1: {}

  unicode-match-property-ecmascript@2.0.0:
    dependencies:
      unicode-canonical-property-names-ecmascript: 2.0.1
      unicode-property-aliases-ecmascript: 2.1.0

  unicode-match-property-value-ecmascript@2.2.0: {}

  unicode-property-aliases-ecmascript@2.1.0: {}

  universalify@2.0.1: {}

  unpipe@1.0.0: {}

  update-browserslist-db@1.1.3(browserslist@4.25.0):
    dependencies:
      browserslist: 4.25.0
      escalade: 3.2.0
      picocolors: 1.1.1

  uri-js@4.4.1:
    dependencies:
      punycode: 2.3.1

  util-deprecate@1.0.2: {}

  utils-merge@1.0.1: {}

  uuid@8.3.2: {}

  validate-npm-package-name@5.0.1: {}

  varint@6.0.0: {}

  vary@1.1.2: {}

  watchpack@2.4.4:
    dependencies:
      glob-to-regexp: 0.4.1
      graceful-fs: 4.2.11

  wbuf@1.7.3:
    dependencies:
      minimalistic-assert: 1.0.1

  wcwidth@1.0.1:
    dependencies:
      defaults: 1.0.4

  webpack-dev-middleware@7.4.2(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))):
    dependencies:
      colorette: 2.0.20
      memfs: 4.17.2
      mime-types: 2.1.35
      on-finished: 2.4.1
      range-parser: 1.2.1
      schema-utils: 4.3.2
    optionalDependencies:
      webpack: 5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))

  webpack-dev-server@5.2.2(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))):
    dependencies:
      '@types/bonjour': 3.5.13
      '@types/connect-history-api-fallback': 1.5.4
      '@types/express': 4.17.23
      '@types/express-serve-static-core': 4.19.6
      '@types/serve-index': 1.9.4
      '@types/serve-static': 1.15.8
      '@types/sockjs': 0.3.36
      '@types/ws': 8.18.1
      ansi-html-community: 0.0.8
      bonjour-service: 1.3.0
      chokidar: 3.6.0
      colorette: 2.0.20
      compression: 1.8.0
      connect-history-api-fallback: 2.0.0
      express: 4.21.2
      graceful-fs: 4.2.11
      http-proxy-middleware: 2.0.9(@types/express@4.17.23)
      ipaddr.js: 2.2.0
      launch-editor: 2.10.0
      open: 10.1.2
      p-retry: 6.2.1
      schema-utils: 4.3.2
      selfsigned: 2.4.1
      serve-index: 1.9.1
      sockjs: 0.3.24
      spdy: 4.0.2
      webpack-dev-middleware: 7.4.2(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17)))
      ws: 8.18.2
    optionalDependencies:
      webpack: 5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))
    transitivePeerDependencies:
      - bufferutil
      - debug
      - supports-color
      - utf-8-validate

  webpack-node-externals@3.0.0: {}

  webpack-sources@3.3.2: {}

  webpack-subresource-integrity@5.1.0(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))):
    dependencies:
      typed-assert: 1.0.9
      webpack: 5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17))

  webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17)):
    dependencies:
      '@types/eslint-scope': 3.7.7
      '@types/estree': 1.0.8
      '@webassemblyjs/ast': 1.14.1
      '@webassemblyjs/wasm-edit': 1.14.1
      '@webassemblyjs/wasm-parser': 1.14.1
      acorn: 8.15.0
      browserslist: 4.25.0
      chrome-trace-event: 1.0.4
      enhanced-resolve: 5.18.1
      es-module-lexer: 1.7.0
      eslint-scope: 5.1.1
      events: 3.3.0
      glob-to-regexp: 0.4.1
      graceful-fs: 4.2.11
      json-parse-even-better-errors: 2.3.1
      loader-runner: 4.3.0
      mime-types: 2.1.35
      neo-async: 2.6.2
      schema-utils: 4.3.2
      tapable: 2.2.2
      terser-webpack-plugin: 5.3.14(@swc/core@1.5.29(@swc/helpers@0.5.17))(webpack@5.98.0(@swc/core@1.5.29(@swc/helpers@0.5.17)))
      watchpack: 2.4.4
      webpack-sources: 3.3.2
    transitivePeerDependencies:
      - '@swc/core'
      - esbuild
      - uglify-js

  websocket-driver@0.7.4:
    dependencies:
      http-parser-js: 0.5.10
      safe-buffer: 5.2.1
      websocket-extensions: 0.1.4

  websocket-extensions@0.1.4: {}

  which@2.0.2:
    dependencies:
      isexe: 2.0.0

  wrap-ansi@7.0.0:
    dependencies:
      ansi-styles: 4.3.0
      string-width: 4.2.3
      strip-ansi: 6.0.1

  wrap-ansi@8.1.0:
    dependencies:
      ansi-styles: 6.2.1
      string-width: 5.1.2
      strip-ansi: 7.1.0

  wrappy@1.0.2: {}

  ws@8.18.2: {}

  y18n@5.0.8: {}

  yallist@3.1.1: {}

  yaml@1.10.2: {}

  yaml@2.8.0: {}

  yargs-parser@21.1.1: {}

  yargs@17.7.2:
    dependencies:
      cliui: 8.0.1
      escalade: 3.2.0
      get-caller-file: 2.0.5
      require-directory: 2.1.1
      string-width: 4.2.3
      y18n: 5.0.8
      yargs-parser: 21.1.1

  yocto-queue@1.2.1: {}
`;
