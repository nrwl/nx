export default `lockfileVersion: 5.4

specifiers:
  '@nrwl/next': 15.3.3
  next: 13.0.0
  react: 18.2.0
  react-dom: 18.2.0
  typescript: 4.8.4

dependencies:
  '@nrwl/next': 15.3.3_xvhegjze7sm3upzckgmd3qanmy
  next: 13.0.0_biqbaboplfbrettd7655fr4n2y
  react: 18.2.0
  react-dom: 18.2.0_react@18.2.0
  typescript: 4.8.4

packages:

  /@ampproject/remapping/2.2.0:
    resolution: {integrity: sha512-qRmjj8nj9qmLTQXXmaR1cck3UXSRMPrbsLJAasZpF+t3riI71BXed5ebIOYwQntykeZuhjsdweEc9BxH5Jc26w==}
    engines: {node: '>=6.0.0'}
    dependencies:
      '@jridgewell/gen-mapping': 0.1.1
      '@jridgewell/trace-mapping': 0.3.17
    dev: false

  /@babel/code-frame/7.18.6:
    resolution: {integrity: sha512-TDCmlK5eOvH+eH7cdAFlNXeVJqWIQ7gW9tY1GJIpUtFb6CmjVyq2VM3u71bOyR8CRihcCgMUYoDNyLXao3+70Q==}
    engines: {node: '>=6.9.0'}
    dependencies:
      '@babel/highlight': 7.18.6
    dev: false

  /@babel/compat-data/7.20.5:
    resolution: {integrity: sha512-KZXo2t10+/jxmkhNXc7pZTqRvSOIvVv/+lJwHS+B2rErwOyjuVRh60yVpb7liQ1U5t7lLJ1bz+t8tSypUZdm0g==}
    engines: {node: '>=6.9.0'}
    dev: false

  /@babel/core/7.20.5:
    resolution: {integrity: sha512-UdOWmk4pNWTm/4DlPUl/Pt4Gz4rcEMb7CY0Y3eJl5Yz1vI8ZJGmHWaVE55LoxRjdpx0z259GE9U5STA9atUinQ==}
    engines: {node: '>=6.9.0'}
    dependencies:
      '@ampproject/remapping': 2.2.0
      '@babel/code-frame': 7.18.6
      '@babel/generator': 7.20.5
      '@babel/helper-compilation-targets': 7.20.0_@babel+core@7.20.5
      '@babel/helper-module-transforms': 7.20.2
      '@babel/helpers': 7.20.6
      '@babel/parser': 7.20.5
      '@babel/template': 7.18.10
      '@babel/traverse': 7.20.5
      '@babel/types': 7.20.5
      convert-source-map: 1.9.0
      debug: 4.3.4
      gensync: 1.0.0-beta.2
      json5: 2.2.1
      semver: 6.3.0
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@babel/generator/7.20.5:
    resolution: {integrity: sha512-jl7JY2Ykn9S0yj4DQP82sYvPU+T3g0HFcWTqDLqiuA9tGRNIj9VfbtXGAYTTkyNEnQk1jkMGOdYka8aG/lulCA==}
    engines: {node: '>=6.9.0'}
    dependencies:
      '@babel/types': 7.20.5
      '@jridgewell/gen-mapping': 0.3.2
      jsesc: 2.5.2
    dev: false

  /@babel/helper-annotate-as-pure/7.18.6:
    resolution: {integrity: sha512-duORpUiYrEpzKIop6iNbjnwKLAKnJ47csTyRACyEmWj0QdUrm5aqNJGHSSEQSUAvNW0ojX0dOmK9dZduvkfeXA==}
    engines: {node: '>=6.9.0'}
    dependencies:
      '@babel/types': 7.20.5
    dev: false

  /@babel/helper-builder-binary-assignment-operator-visitor/7.18.9:
    resolution: {integrity: sha512-yFQ0YCHoIqarl8BCRwBL8ulYUaZpz3bNsA7oFepAzee+8/+ImtADXNOmO5vJvsPff3qi+hvpkY/NYBTrBQgdNw==}
    engines: {node: '>=6.9.0'}
    dependencies:
      '@babel/helper-explode-assignable-expression': 7.18.6
      '@babel/types': 7.20.5
    dev: false

  /@babel/helper-compilation-targets/7.20.0_@babel+core@7.20.5:
    resolution: {integrity: sha512-0jp//vDGp9e8hZzBc6N/KwA5ZK3Wsm/pfm4CrY7vzegkVxc65SgSn6wYOnwHe9Js9HRQ1YTCKLGPzDtaS3RoLQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0
    dependencies:
      '@babel/compat-data': 7.20.5
      '@babel/core': 7.20.5
      '@babel/helper-validator-option': 7.18.6
      browserslist: 4.21.4
      semver: 6.3.0
    dev: false

  /@babel/helper-create-class-features-plugin/7.20.5:
    resolution: {integrity: sha512-3RCdA/EmEaikrhayahwToF0fpweU/8o2p8vhc1c/1kftHOdTKuC65kik/TLc+qfbS8JKw4qqJbne4ovICDhmww==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0
    dependencies:
      '@babel/helper-annotate-as-pure': 7.18.6
      '@babel/helper-environment-visitor': 7.18.9
      '@babel/helper-function-name': 7.19.0
      '@babel/helper-member-expression-to-functions': 7.18.9
      '@babel/helper-optimise-call-expression': 7.18.6
      '@babel/helper-replace-supers': 7.19.1
      '@babel/helper-split-export-declaration': 7.18.6
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@babel/helper-create-class-features-plugin/7.20.5_@babel+core@7.20.5:
    resolution: {integrity: sha512-3RCdA/EmEaikrhayahwToF0fpweU/8o2p8vhc1c/1kftHOdTKuC65kik/TLc+qfbS8JKw4qqJbne4ovICDhmww==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-annotate-as-pure': 7.18.6
      '@babel/helper-environment-visitor': 7.18.9
      '@babel/helper-function-name': 7.19.0
      '@babel/helper-member-expression-to-functions': 7.18.9
      '@babel/helper-optimise-call-expression': 7.18.6
      '@babel/helper-replace-supers': 7.19.1
      '@babel/helper-split-export-declaration': 7.18.6
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@babel/helper-create-regexp-features-plugin/7.20.5_@babel+core@7.20.5:
    resolution: {integrity: sha512-m68B1lkg3XDGX5yCvGO0kPx3v9WIYLnzjKfPcQiwntEQa5ZeRkPmo2X/ISJc8qxWGfwUr+kvZAeEzAwLec2r2w==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-annotate-as-pure': 7.18.6
      regexpu-core: 5.2.2
    dev: false

  /@babel/helper-define-polyfill-provider/0.3.3_@babel+core@7.20.5:
    resolution: {integrity: sha512-z5aQKU4IzbqCC1XH0nAqfsFLMVSo22SBKUc0BxGrLkolTdPTructy0ToNnlO2zA4j9Q/7pjMZf0DSY+DSTYzww==}
    peerDependencies:
      '@babel/core': ^7.4.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-compilation-targets': 7.20.0_@babel+core@7.20.5
      '@babel/helper-plugin-utils': 7.20.2
      debug: 4.3.4
      lodash.debounce: 4.0.8
      resolve: 1.22.1
      semver: 6.3.0
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@babel/helper-environment-visitor/7.18.9:
    resolution: {integrity: sha512-3r/aACDJ3fhQ/EVgFy0hpj8oHyHpQc+LPtJoY9SzTThAsStm4Ptegq92vqKoE3vD706ZVFWITnMnxucw+S9Ipg==}
    engines: {node: '>=6.9.0'}
    dev: false

  /@babel/helper-explode-assignable-expression/7.18.6:
    resolution: {integrity: sha512-eyAYAsQmB80jNfg4baAtLeWAQHfHFiR483rzFK+BhETlGZaQC9bsfrugfXDCbRHLQbIA7U5NxhhOxN7p/dWIcg==}
    engines: {node: '>=6.9.0'}
    dependencies:
      '@babel/types': 7.20.5
    dev: false

  /@babel/helper-function-name/7.19.0:
    resolution: {integrity: sha512-WAwHBINyrpqywkUH0nTnNgI5ina5TFn85HKS0pbPDfxFfhyR/aNQEn4hGi1P1JyT//I0t4OgXUlofzWILRvS5w==}
    engines: {node: '>=6.9.0'}
    dependencies:
      '@babel/template': 7.18.10
      '@babel/types': 7.20.5
    dev: false

  /@babel/helper-hoist-variables/7.18.6:
    resolution: {integrity: sha512-UlJQPkFqFULIcyW5sbzgbkxn2FKRgwWiRexcuaR8RNJRy8+LLveqPjwZV/bwrLZCN0eUHD/x8D0heK1ozuoo6Q==}
    engines: {node: '>=6.9.0'}
    dependencies:
      '@babel/types': 7.20.5
    dev: false

  /@babel/helper-member-expression-to-functions/7.18.9:
    resolution: {integrity: sha512-RxifAh2ZoVU67PyKIO4AMi1wTenGfMR/O/ae0CCRqwgBAt5v7xjdtRw7UoSbsreKrQn5t7r89eruK/9JjYHuDg==}
    engines: {node: '>=6.9.0'}
    dependencies:
      '@babel/types': 7.20.5
    dev: false

  /@babel/helper-module-imports/7.18.6:
    resolution: {integrity: sha512-0NFvs3VkuSYbFi1x2Vd6tKrywq+z/cLeYC/RJNFrIX/30Bf5aiGYbtvGXolEktzJH8o5E5KJ3tT+nkxuuZFVlA==}
    engines: {node: '>=6.9.0'}
    dependencies:
      '@babel/types': 7.20.5
    dev: false

  /@babel/helper-module-transforms/7.20.2:
    resolution: {integrity: sha512-zvBKyJXRbmK07XhMuujYoJ48B5yvvmM6+wcpv6Ivj4Yg6qO7NOZOSnvZN9CRl1zz1Z4cKf8YejmCMh8clOoOeA==}
    engines: {node: '>=6.9.0'}
    dependencies:
      '@babel/helper-environment-visitor': 7.18.9
      '@babel/helper-module-imports': 7.18.6
      '@babel/helper-simple-access': 7.20.2
      '@babel/helper-split-export-declaration': 7.18.6
      '@babel/helper-validator-identifier': 7.19.1
      '@babel/template': 7.18.10
      '@babel/traverse': 7.20.5
      '@babel/types': 7.20.5
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@babel/helper-optimise-call-expression/7.18.6:
    resolution: {integrity: sha512-HP59oD9/fEHQkdcbgFCnbmgH5vIQTJbxh2yf+CdM89/glUNnuzr87Q8GIjGEnOktTROemO0Pe0iPAYbqZuOUiA==}
    engines: {node: '>=6.9.0'}
    dependencies:
      '@babel/types': 7.20.5
    dev: false

  /@babel/helper-plugin-utils/7.20.2:
    resolution: {integrity: sha512-8RvlJG2mj4huQ4pZ+rU9lqKi9ZKiRmuvGuM2HlWmkmgOhbs6zEAw6IEiJ5cQqGbDzGZOhwuOQNtZMi/ENLjZoQ==}
    engines: {node: '>=6.9.0'}
    dev: false

  /@babel/helper-remap-async-to-generator/7.18.9_@babel+core@7.20.5:
    resolution: {integrity: sha512-dI7q50YKd8BAv3VEfgg7PS7yD3Rtbi2J1XMXaalXO0W0164hYLnh8zpjRS0mte9MfVp/tltvr/cfdXPvJr1opA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-annotate-as-pure': 7.18.6
      '@babel/helper-environment-visitor': 7.18.9
      '@babel/helper-wrap-function': 7.20.5
      '@babel/types': 7.20.5
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@babel/helper-replace-supers/7.19.1:
    resolution: {integrity: sha512-T7ahH7wV0Hfs46SFh5Jz3s0B6+o8g3c+7TMxu7xKfmHikg7EAZ3I2Qk9LFhjxXq8sL7UkP5JflezNwoZa8WvWw==}
    engines: {node: '>=6.9.0'}
    dependencies:
      '@babel/helper-environment-visitor': 7.18.9
      '@babel/helper-member-expression-to-functions': 7.18.9
      '@babel/helper-optimise-call-expression': 7.18.6
      '@babel/traverse': 7.20.5
      '@babel/types': 7.20.5
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@babel/helper-simple-access/7.20.2:
    resolution: {integrity: sha512-+0woI/WPq59IrqDYbVGfshjT5Dmk/nnbdpcF8SnMhhXObpTq2KNBdLFRFrkVdbDOyUmHBCxzm5FHV1rACIkIbA==}
    engines: {node: '>=6.9.0'}
    dependencies:
      '@babel/types': 7.20.5
    dev: false

  /@babel/helper-skip-transparent-expression-wrappers/7.20.0:
    resolution: {integrity: sha512-5y1JYeNKfvnT8sZcK9DVRtpTbGiomYIHviSP3OQWmDPU3DeH4a1ZlT/N2lyQ5P8egjcRaT/Y9aNqUxK0WsnIIg==}
    engines: {node: '>=6.9.0'}
    dependencies:
      '@babel/types': 7.20.5
    dev: false

  /@babel/helper-split-export-declaration/7.18.6:
    resolution: {integrity: sha512-bde1etTx6ZyTmobl9LLMMQsaizFVZrquTEHOqKeQESMKo4PlObf+8+JA25ZsIpZhT/WEd39+vOdLXAFG/nELpA==}
    engines: {node: '>=6.9.0'}
    dependencies:
      '@babel/types': 7.20.5
    dev: false

  /@babel/helper-string-parser/7.19.4:
    resolution: {integrity: sha512-nHtDoQcuqFmwYNYPz3Rah5ph2p8PFeFCsZk9A/48dPc/rGocJ5J3hAAZ7pb76VWX3fZKu+uEr/FhH5jLx7umrw==}
    engines: {node: '>=6.9.0'}
    dev: false

  /@babel/helper-validator-identifier/7.19.1:
    resolution: {integrity: sha512-awrNfaMtnHUr653GgGEs++LlAvW6w+DcPrOliSMXWCKo597CwL5Acf/wWdNkf/tfEQE3mjkeD1YOVZOUV/od1w==}
    engines: {node: '>=6.9.0'}
    dev: false

  /@babel/helper-validator-option/7.18.6:
    resolution: {integrity: sha512-XO7gESt5ouv/LRJdrVjkShckw6STTaB7l9BrpBaAHDeF5YZT+01PCwmR0SJHnkW6i8OwW/EVWRShfi4j2x+KQw==}
    engines: {node: '>=6.9.0'}
    dev: false

  /@babel/helper-wrap-function/7.20.5:
    resolution: {integrity: sha512-bYMxIWK5mh+TgXGVqAtnu5Yn1un+v8DDZtqyzKRLUzrh70Eal2O3aZ7aPYiMADO4uKlkzOiRiZ6GX5q3qxvW9Q==}
    engines: {node: '>=6.9.0'}
    dependencies:
      '@babel/helper-function-name': 7.19.0
      '@babel/template': 7.18.10
      '@babel/traverse': 7.20.5
      '@babel/types': 7.20.5
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@babel/helpers/7.20.6:
    resolution: {integrity: sha512-Pf/OjgfgFRW5bApskEz5pvidpim7tEDPlFtKcNRXWmfHGn9IEI2W2flqRQXTFb7gIPTyK++N6rVHuwKut4XK6w==}
    engines: {node: '>=6.9.0'}
    dependencies:
      '@babel/template': 7.18.10
      '@babel/traverse': 7.20.5
      '@babel/types': 7.20.5
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@babel/highlight/7.18.6:
    resolution: {integrity: sha512-u7stbOuYjaPezCuLj29hNW1v64M2Md2qupEKP1fHc7WdOA3DgLh37suiSrZYY7haUB7iBeQZ9P1uiRF359do3g==}
    engines: {node: '>=6.9.0'}
    dependencies:
      '@babel/helper-validator-identifier': 7.19.1
      chalk: 2.4.2
      js-tokens: 4.0.0
    dev: false

  /@babel/parser/7.20.5:
    resolution: {integrity: sha512-r27t/cy/m9uKLXQNWWebeCUHgnAZq0CpG1OwKRxzJMP1vpSU4bSIK2hq+/cp0bQxetkXx38n09rNu8jVkcK/zA==}
    engines: {node: '>=6.0.0'}
    hasBin: true
    dependencies:
      '@babel/types': 7.20.5
    dev: false

  /@babel/plugin-bugfix-safari-id-destructuring-collision-in-function-expression/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-Dgxsyg54Fx1d4Nge8UnvTrED63vrwOdPmyvPzlNN/boaliRP54pm3pGzZD1SJUwrBA+Cs/xdG8kXX6Mn/RfISQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-bugfix-v8-spread-parameters-in-optional-chaining/7.18.9_@babel+core@7.20.5:
    resolution: {integrity: sha512-AHrP9jadvH7qlOj6PINbgSuphjQUAK7AOT7DPjBo9EHoLhQTnnK5u45e1Hd4DbSQEO9nqPWtQ89r+XEOWFScKg==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.13.0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
      '@babel/helper-skip-transparent-expression-wrappers': 7.20.0
      '@babel/plugin-proposal-optional-chaining': 7.18.9_@babel+core@7.20.5
    dev: false

  /@babel/plugin-proposal-async-generator-functions/7.20.1_@babel+core@7.20.5:
    resolution: {integrity: sha512-Gh5rchzSwE4kC+o/6T8waD0WHEQIsDmjltY8WnWRXHUdH8axZhuH86Ov9M72YhJfDrZseQwuuWaaIT/TmePp3g==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-environment-visitor': 7.18.9
      '@babel/helper-plugin-utils': 7.20.2
      '@babel/helper-remap-async-to-generator': 7.18.9_@babel+core@7.20.5
      '@babel/plugin-syntax-async-generators': 7.8.4_@babel+core@7.20.5
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@babel/plugin-proposal-class-properties/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-cumfXOF0+nzZrrN8Rf0t7M+tF6sZc7vhQwYQck9q1/5w2OExlD+b4v4RpMJFaV1Z7WcDRgO6FqvxqxGlwo+RHQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-create-class-features-plugin': 7.20.5_@babel+core@7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@babel/plugin-proposal-class-static-block/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-+I3oIiNxrCpup3Gi8n5IGMwj0gOCAjcJUSQEcotNnCCPMEnixawOQ+KeJPlgfjzx+FKQ1QSyZOWe7wmoJp7vhw==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.12.0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-create-class-features-plugin': 7.20.5_@babel+core@7.20.5
      '@babel/helper-plugin-utils': 7.20.2
      '@babel/plugin-syntax-class-static-block': 7.14.5_@babel+core@7.20.5
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@babel/plugin-proposal-decorators/7.20.5:
    resolution: {integrity: sha512-Lac7PpRJXcC3s9cKsBfl+uc+DYXU5FD06BrTFunQO6QIQT+DwyzDPURAowI3bcvD1dZF/ank1Z5rstUJn3Hn4Q==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/helper-create-class-features-plugin': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
      '@babel/helper-replace-supers': 7.19.1
      '@babel/helper-split-export-declaration': 7.18.6
      '@babel/plugin-syntax-decorators': 7.19.0
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@babel/plugin-proposal-dynamic-import/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-1auuwmK+Rz13SJj36R+jqFPMJWyKEDd7lLSdOj4oJK0UTgGueSAtkrCvz9ewmgyU/P941Rv2fQwZJN8s6QruXw==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
      '@babel/plugin-syntax-dynamic-import': 7.8.3_@babel+core@7.20.5
    dev: false

  /@babel/plugin-proposal-export-namespace-from/7.18.9_@babel+core@7.20.5:
    resolution: {integrity: sha512-k1NtHyOMvlDDFeb9G5PhUXuGj8m/wiwojgQVEhJ/fsVsMCpLyOP4h0uGEjYJKrRI+EVPlb5Jk+Gt9P97lOGwtA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
      '@babel/plugin-syntax-export-namespace-from': 7.8.3_@babel+core@7.20.5
    dev: false

  /@babel/plugin-proposal-json-strings/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-lr1peyn9kOdbYc0xr0OdHTZ5FMqS6Di+H0Fz2I/JwMzGmzJETNeOFq2pBySw6X/KFL5EWDjlJuMsUGRFb8fQgQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
      '@babel/plugin-syntax-json-strings': 7.8.3_@babel+core@7.20.5
    dev: false

  /@babel/plugin-proposal-logical-assignment-operators/7.18.9_@babel+core@7.20.5:
    resolution: {integrity: sha512-128YbMpjCrP35IOExw2Fq+x55LMP42DzhOhX2aNNIdI9avSWl2PI0yuBWarr3RYpZBSPtabfadkH2yeRiMD61Q==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
      '@babel/plugin-syntax-logical-assignment-operators': 7.10.4_@babel+core@7.20.5
    dev: false

  /@babel/plugin-proposal-nullish-coalescing-operator/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-wQxQzxYeJqHcfppzBDnm1yAY0jSRkUXR2z8RePZYrKwMKgMlE8+Z6LUno+bd6LvbGh8Gltvy74+9pIYkr+XkKA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
      '@babel/plugin-syntax-nullish-coalescing-operator': 7.8.3_@babel+core@7.20.5
    dev: false

  /@babel/plugin-proposal-numeric-separator/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-ozlZFogPqoLm8WBr5Z8UckIoE4YQ5KESVcNudyXOR8uqIkliTEgJ3RoketfG6pmzLdeZF0H/wjE9/cCEitBl7Q==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
      '@babel/plugin-syntax-numeric-separator': 7.10.4_@babel+core@7.20.5
    dev: false

  /@babel/plugin-proposal-object-rest-spread/7.20.2_@babel+core@7.20.5:
    resolution: {integrity: sha512-Ks6uej9WFK+fvIMesSqbAto5dD8Dz4VuuFvGJFKgIGSkJuRGcrwGECPA1fDgQK3/DbExBJpEkTeYeB8geIFCSQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/compat-data': 7.20.5
      '@babel/core': 7.20.5
      '@babel/helper-compilation-targets': 7.20.0_@babel+core@7.20.5
      '@babel/helper-plugin-utils': 7.20.2
      '@babel/plugin-syntax-object-rest-spread': 7.8.3_@babel+core@7.20.5
      '@babel/plugin-transform-parameters': 7.20.5_@babel+core@7.20.5
    dev: false

  /@babel/plugin-proposal-optional-catch-binding/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-Q40HEhs9DJQyaZfUjjn6vE8Cv4GmMHCYuMGIWUnlxH6400VGxOuwWsPt4FxXxJkC/5eOzgn0z21M9gMT4MOhbw==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
      '@babel/plugin-syntax-optional-catch-binding': 7.8.3_@babel+core@7.20.5
    dev: false

  /@babel/plugin-proposal-optional-chaining/7.18.9_@babel+core@7.20.5:
    resolution: {integrity: sha512-v5nwt4IqBXihxGsW2QmCWMDS3B3bzGIk/EQVZz2ei7f3NJl8NzAJVvUmpDW5q1CRNY+Beb/k58UAH1Km1N411w==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
      '@babel/helper-skip-transparent-expression-wrappers': 7.20.0
      '@babel/plugin-syntax-optional-chaining': 7.8.3_@babel+core@7.20.5
    dev: false

  /@babel/plugin-proposal-private-methods/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-nutsvktDItsNn4rpGItSNV2sz1XwS+nfU0Rg8aCx3W3NOKVzdMjJRu0O5OkgDp3ZGICSTbgRpxZoWsxoKRvbeA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-create-class-features-plugin': 7.20.5_@babel+core@7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@babel/plugin-proposal-private-property-in-object/7.20.5_@babel+core@7.20.5:
    resolution: {integrity: sha512-Vq7b9dUA12ByzB4EjQTPo25sFhY+08pQDBSZRtUAkj7lb7jahaHR5igera16QZ+3my1nYR4dKsNdYj5IjPHilQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-annotate-as-pure': 7.18.6
      '@babel/helper-create-class-features-plugin': 7.20.5_@babel+core@7.20.5
      '@babel/helper-plugin-utils': 7.20.2
      '@babel/plugin-syntax-private-property-in-object': 7.14.5_@babel+core@7.20.5
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@babel/plugin-proposal-unicode-property-regex/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-2BShG/d5yoZyXZfVePH91urL5wTG6ASZU9M4o03lKK8u8UW1y08OMttBSOADTcJrnPMpvDXRG3G8fyLh4ovs8w==}
    engines: {node: '>=4'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-create-regexp-features-plugin': 7.20.5_@babel+core@7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-syntax-async-generators/7.8.4_@babel+core@7.20.5:
    resolution: {integrity: sha512-tycmZxkGfZaxhMRbXlPXuVFpdWlXpir2W4AMhSJgRKzk/eDlIXOhb2LHWoLpDF7TEHylV5zNhykX6KAgHJmTNw==}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-syntax-bigint/7.8.3_@babel+core@7.20.5:
    resolution: {integrity: sha512-wnTnFlG+YxQm3vDxpGE57Pj0srRU4sHE/mDkt1qv2YJJSeUAec2ma4WLUnUPeKjyrfntVwe/N6dCXpU+zL3Npg==}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-syntax-class-properties/7.12.13_@babel+core@7.20.5:
    resolution: {integrity: sha512-fm4idjKla0YahUNgFNLCB0qySdsoPiZP3iQE3rky0mBUtMZ23yDJ9SJdg6dXTSDnulOVqiF3Hgr9nbXvXTQZYA==}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-syntax-class-static-block/7.14.5_@babel+core@7.20.5:
    resolution: {integrity: sha512-b+YyPmr6ldyNnM6sqYeMWE+bgJcJpO6yS4QD7ymxgH34GBPNDM/THBh8iunyvKIZztiwLH4CJZ0RxTk9emgpjw==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-syntax-decorators/7.19.0:
    resolution: {integrity: sha512-xaBZUEDntt4faL1yN8oIFlhfXeQAWJW7CLKYsHTUqriCUbj8xOra8bfxxKGi/UwExPFBuPdH4XfHc9rGQhrVkQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-syntax-dynamic-import/7.8.3_@babel+core@7.20.5:
    resolution: {integrity: sha512-5gdGbFon+PszYzqs83S3E5mpi7/y/8M9eC90MRTZfduQOYW76ig6SOSPNe41IG5LoP3FGBn2N0RjVDSQiS94kQ==}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-syntax-export-namespace-from/7.8.3_@babel+core@7.20.5:
    resolution: {integrity: sha512-MXf5laXo6c1IbEbegDmzGPwGNTsHZmEy6QGznu5Sh2UCWvueywb2ee+CCE4zQiZstxU9BMoQO9i6zUFSY0Kj0Q==}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-syntax-import-assertions/7.20.0_@babel+core@7.20.5:
    resolution: {integrity: sha512-IUh1vakzNoWalR8ch/areW7qFopR2AEw03JlG7BbrDqmQ4X3q9uuipQwSGrUn7oGiemKjtSLDhNtQHzMHr1JdQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-syntax-import-meta/7.10.4_@babel+core@7.20.5:
    resolution: {integrity: sha512-Yqfm+XDx0+Prh3VSeEQCPU81yC+JWZ2pDPFSS4ZdpfZhp4MkFMaDC1UqseovEKwSUpnIL7+vK+Clp7bfh0iD7g==}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-syntax-json-strings/7.8.3_@babel+core@7.20.5:
    resolution: {integrity: sha512-lY6kdGpWHvjoe2vk4WrAapEuBR69EMxZl+RoGRhrFGNYVK8mOPAW8VfbT/ZgrFbXlDNiiaxQnAtgVCZ6jv30EA==}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-syntax-jsx/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-6mmljtAedFGTWu2p/8WIORGwy+61PLgOMPOdazc7YoJ9ZCWUyFy3A6CpPkRKLKD1ToAesxX8KGEViAiLo9N+7Q==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-syntax-logical-assignment-operators/7.10.4_@babel+core@7.20.5:
    resolution: {integrity: sha512-d8waShlpFDinQ5MtvGU9xDAOzKH47+FFoney2baFIoMr952hKOLp1HR7VszoZvOsV/4+RRszNY7D17ba0te0ig==}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-syntax-nullish-coalescing-operator/7.8.3_@babel+core@7.20.5:
    resolution: {integrity: sha512-aSff4zPII1u2QD7y+F8oDsz19ew4IGEJg9SVW+bqwpwtfFleiQDMdzA/R+UlWDzfnHFCxxleFT0PMIrR36XLNQ==}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-syntax-numeric-separator/7.10.4_@babel+core@7.20.5:
    resolution: {integrity: sha512-9H6YdfkcK/uOnY/K7/aA2xpzaAgkQn37yzWUMRK7OaPOqOpGS1+n0H5hxT9AUw9EsSjPW8SVyMJwYRtWs3X3ug==}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-syntax-object-rest-spread/7.8.3_@babel+core@7.20.5:
    resolution: {integrity: sha512-XoqMijGZb9y3y2XskN+P1wUGiVwWZ5JmoDRwx5+3GmEplNyVM2s2Dg8ILFQm8rWM48orGy5YpI5Bl8U1y7ydlA==}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-syntax-optional-catch-binding/7.8.3_@babel+core@7.20.5:
    resolution: {integrity: sha512-6VPD0Pc1lpTqw0aKoeRTMiB+kWhAoT24PA+ksWSBrFtl5SIRVpZlwN3NNPQjehA2E/91FV3RjLWoVTglWcSV3Q==}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-syntax-optional-chaining/7.8.3_@babel+core@7.20.5:
    resolution: {integrity: sha512-KoK9ErH1MBlCPxV0VANkXW2/dw4vlbGDrFgz8bmUsBGYkFRcbRwMh6cIJubdPrkxRwuGdtCk0v/wPTKbQgBjkg==}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-syntax-private-property-in-object/7.14.5_@babel+core@7.20.5:
    resolution: {integrity: sha512-0wVnp9dxJ72ZUJDV27ZfbSj6iHLoytYZmh3rFcxNnvsJF3ktkzLDZPy/mA17HGsaQT3/DQsWYX1f1QGWkCoVUg==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-syntax-top-level-await/7.14.5_@babel+core@7.20.5:
    resolution: {integrity: sha512-hx++upLv5U1rgYfwe1xBQUhRmU41NEvpUvrp8jkrSCdvGSnM5/qdRMtylJ6PG5OFkBaHkbTAKTnd3/YyESRHFw==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-syntax-typescript/7.20.0_@babel+core@7.20.5:
    resolution: {integrity: sha512-rd9TkG+u1CExzS4SM1BlMEhMXwFLKVjOAFFCDx9PbX5ycJWDoWMcwdJH9RhkPu1dOgn5TrxLot/Gx6lWFuAUNQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-transform-arrow-functions/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-9S9X9RUefzrsHZmKMbDXxweEH+YlE8JJEuat9FdvW9Qh1cw7W64jELCtWNkPBPX5En45uy28KGvA/AySqUh8CQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-transform-async-to-generator/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-ARE5wZLKnTgPW7/1ftQmSi1CmkqqHo2DNmtztFhvgtOWSDfq0Cq9/9L+KnZNYSNrydBekhW3rwShduf59RoXag==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-module-imports': 7.18.6
      '@babel/helper-plugin-utils': 7.20.2
      '@babel/helper-remap-async-to-generator': 7.18.9_@babel+core@7.20.5
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@babel/plugin-transform-block-scoped-functions/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-ExUcOqpPWnliRcPqves5HJcJOvHvIIWfuS4sroBUenPuMdmW+SMHDakmtS7qOo13sVppmUijqeTv7qqGsvURpQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-transform-block-scoping/7.20.5_@babel+core@7.20.5:
    resolution: {integrity: sha512-WvpEIW9Cbj9ApF3yJCjIEEf1EiNJLtXagOrL5LNWEZOo3jv8pmPoYTSNJQvqej8OavVlgOoOPw6/htGZro6IkA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-transform-classes/7.20.2_@babel+core@7.20.5:
    resolution: {integrity: sha512-9rbPp0lCVVoagvtEyQKSo5L8oo0nQS/iif+lwlAz29MccX2642vWDlSZK+2T2buxbopotId2ld7zZAzRfz9j1g==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-annotate-as-pure': 7.18.6
      '@babel/helper-compilation-targets': 7.20.0_@babel+core@7.20.5
      '@babel/helper-environment-visitor': 7.18.9
      '@babel/helper-function-name': 7.19.0
      '@babel/helper-optimise-call-expression': 7.18.6
      '@babel/helper-plugin-utils': 7.20.2
      '@babel/helper-replace-supers': 7.19.1
      '@babel/helper-split-export-declaration': 7.18.6
      globals: 11.12.0
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@babel/plugin-transform-computed-properties/7.18.9_@babel+core@7.20.5:
    resolution: {integrity: sha512-+i0ZU1bCDymKakLxn5srGHrsAPRELC2WIbzwjLhHW9SIE1cPYkLCL0NlnXMZaM1vhfgA2+M7hySk42VBvrkBRw==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-transform-destructuring/7.20.2_@babel+core@7.20.5:
    resolution: {integrity: sha512-mENM+ZHrvEgxLTBXUiQ621rRXZes3KWUv6NdQlrnr1TkWVw+hUjQBZuP2X32qKlrlG2BzgR95gkuCRSkJl8vIw==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-transform-dotall-regex/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-6S3jpun1eEbAxq7TdjLotAsl4WpQI9DxfkycRcKrjhQYzU87qpXdknpBg/e+TdcMehqGnLFi7tnFUBR02Vq6wg==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-create-regexp-features-plugin': 7.20.5_@babel+core@7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-transform-duplicate-keys/7.18.9_@babel+core@7.20.5:
    resolution: {integrity: sha512-d2bmXCtZXYc59/0SanQKbiWINadaJXqtvIQIzd4+hNwkWBgyCd5F/2t1kXoUdvPMrxzPvhK6EMQRROxsue+mfw==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-transform-exponentiation-operator/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-wzEtc0+2c88FVR34aQmiz56dxEkxr2g8DQb/KfaFa1JYXOFVsbhvAonFN6PwVWj++fKmku8NP80plJ5Et4wqHw==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-builder-binary-assignment-operator-visitor': 7.18.9
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-transform-for-of/7.18.8_@babel+core@7.20.5:
    resolution: {integrity: sha512-yEfTRnjuskWYo0k1mHUqrVWaZwrdq8AYbfrpqULOJOaucGSp4mNMVps+YtA8byoevxS/urwU75vyhQIxcCgiBQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-transform-function-name/7.18.9_@babel+core@7.20.5:
    resolution: {integrity: sha512-WvIBoRPaJQ5yVHzcnJFor7oS5Ls0PYixlTYE63lCj2RtdQEl15M68FXQlxnG6wdraJIXRdR7KI+hQ7q/9QjrCQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-compilation-targets': 7.20.0_@babel+core@7.20.5
      '@babel/helper-function-name': 7.19.0
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-transform-literals/7.18.9_@babel+core@7.20.5:
    resolution: {integrity: sha512-IFQDSRoTPnrAIrI5zoZv73IFeZu2dhu6irxQjY9rNjTT53VmKg9fenjvoiOWOkJ6mm4jKVPtdMzBY98Fp4Z4cg==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-transform-member-expression-literals/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-qSF1ihLGO3q+/g48k85tUjD033C29TNTVB2paCwZPVmOsjn9pClvYYrM2VeJpBY2bcNkuny0YUyTNRyRxJ54KA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-transform-modules-amd/7.19.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-uG3od2mXvAtIFQIh0xrpLH6r5fpSQN04gIVovl+ODLdUMANokxQLZnPBHcjmv3GxRjnqwLuHvppjjcelqUFZvg==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-module-transforms': 7.20.2
      '@babel/helper-plugin-utils': 7.20.2
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@babel/plugin-transform-modules-commonjs/7.19.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-8PIa1ym4XRTKuSsOUXqDG0YaOlEuTVvHMe5JCfgBMOtHvJKw/4NGovEGN33viISshG/rZNVrACiBmPQLvWN8xQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-module-transforms': 7.20.2
      '@babel/helper-plugin-utils': 7.20.2
      '@babel/helper-simple-access': 7.20.2
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@babel/plugin-transform-modules-systemjs/7.19.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-fqGLBepcc3kErfR9R3DnVpURmckXP7gj7bAlrTQyBxrigFqszZCkFkcoxzCp2v32XmwXLvbw+8Yq9/b+QqksjQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-hoist-variables': 7.18.6
      '@babel/helper-module-transforms': 7.20.2
      '@babel/helper-plugin-utils': 7.20.2
      '@babel/helper-validator-identifier': 7.19.1
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@babel/plugin-transform-modules-umd/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-dcegErExVeXcRqNtkRU/z8WlBLnvD4MRnHgNs3MytRO1Mn1sHRyhbcpYbVMGclAqOjdW+9cfkdZno9dFdfKLfQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-module-transforms': 7.20.2
      '@babel/helper-plugin-utils': 7.20.2
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@babel/plugin-transform-named-capturing-groups-regex/7.20.5_@babel+core@7.20.5:
    resolution: {integrity: sha512-mOW4tTzi5iTLnw+78iEq3gr8Aoq4WNRGpmSlrogqaiCBoR1HFhpU4JkpQFOHfeYx3ReVIFWOQJS4aZBRvuZ6mA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-create-regexp-features-plugin': 7.20.5_@babel+core@7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-transform-new-target/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-DjwFA/9Iu3Z+vrAn+8pBUGcjhxKguSMlsFqeCKbhb9BAV756v0krzVK04CRDi/4aqmk8BsHb4a/gFcaA5joXRw==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-transform-object-super/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-uvGz6zk+pZoS1aTZrOvrbj6Pp/kK2mp45t2B+bTDre2UgsZZ8EZLSJtUg7m/no0zOJUWgFONpB7Zv9W2tSaFlA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
      '@babel/helper-replace-supers': 7.19.1
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@babel/plugin-transform-parameters/7.20.5_@babel+core@7.20.5:
    resolution: {integrity: sha512-h7plkOmcndIUWXZFLgpbrh2+fXAi47zcUX7IrOQuZdLD0I0KvjJ6cvo3BEcAOsDOcZhVKGJqv07mkSqK0y2isQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-transform-property-literals/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-cYcs6qlgafTud3PAzrrRNbQtfpQ8+y/+M5tKmksS9+M1ckbH6kzY8MrexEM9mcA6JDsukE19iIRvAyYl463sMg==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-transform-react-constant-elements/7.20.2_@babel+core@7.20.5:
    resolution: {integrity: sha512-KS/G8YI8uwMGKErLFOHS/ekhqdHhpEloxs43NecQHVgo2QuQSyJhGIY1fL8UGl9wy5ItVwwoUL4YxVqsplGq2g==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-transform-react-display-name/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-TV4sQ+T013n61uMoygyMRm+xf04Bd5oqFpv2jAEQwSZ8NwQA7zeRPg1LMVg2PWi3zWBz+CLKD+v5bcpZ/BS0aA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-transform-react-jsx-development/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-SA6HEjwYFKF7WDjWcMcMGUimmw/nhNRDWxr+KaLSCrkD/LMDBvWRmHAYgE1HDeF8KUuI8OAu+RT6EOtKxSW2qA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/plugin-transform-react-jsx': 7.19.0_@babel+core@7.20.5
    dev: false

  /@babel/plugin-transform-react-jsx/7.19.0_@babel+core@7.20.5:
    resolution: {integrity: sha512-UVEvX3tXie3Szm3emi1+G63jyw1w5IcMY0FSKM+CRnKRI5Mr1YbCNgsSTwoTwKphQEG9P+QqmuRFneJPZuHNhg==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-annotate-as-pure': 7.18.6
      '@babel/helper-module-imports': 7.18.6
      '@babel/helper-plugin-utils': 7.20.2
      '@babel/plugin-syntax-jsx': 7.18.6_@babel+core@7.20.5
      '@babel/types': 7.20.5
    dev: false

  /@babel/plugin-transform-react-pure-annotations/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-I8VfEPg9r2TRDdvnHgPepTKvuRomzA8+u+nhY7qSI1fR2hRNebasZEETLyM5mAUr0Ku56OkXJ0I7NHJnO6cJiQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-annotate-as-pure': 7.18.6
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-transform-regenerator/7.20.5_@babel+core@7.20.5:
    resolution: {integrity: sha512-kW/oO7HPBtntbsahzQ0qSE3tFvkFwnbozz3NWFhLGqH75vLEg+sCGngLlhVkePlCs3Jv0dBBHDzCHxNiFAQKCQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
      regenerator-transform: 0.15.1
    dev: false

  /@babel/plugin-transform-reserved-words/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-oX/4MyMoypzHjFrT1CdivfKZ+XvIPMFXwwxHp/r0Ddy2Vuomt4HDFGmft1TAY2yiTKiNSsh3kjBAzcM8kSdsjA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-transform-shorthand-properties/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-eCLXXJqv8okzg86ywZJbRn19YJHU4XUa55oz2wbHhaQVn/MM+XhukiT7SYqp/7o00dg52Rj51Ny+Ecw4oyoygw==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-transform-spread/7.19.0_@babel+core@7.20.5:
    resolution: {integrity: sha512-RsuMk7j6n+r752EtzyScnWkQyuJdli6LdO5Klv8Yx0OfPVTcQkIUfS8clx5e9yHXzlnhOZF3CbQ8C2uP5j074w==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
      '@babel/helper-skip-transparent-expression-wrappers': 7.20.0
    dev: false

  /@babel/plugin-transform-sticky-regex/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-kfiDrDQ+PBsQDO85yj1icueWMfGfJFKN1KCkndygtu/C9+XUfydLC8Iv5UYJqRwy4zk8EcplRxEOeLyjq1gm6Q==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-transform-template-literals/7.18.9_@babel+core@7.20.5:
    resolution: {integrity: sha512-S8cOWfT82gTezpYOiVaGHrCbhlHgKhQt8XH5ES46P2XWmX92yisoZywf5km75wv5sYcXDUCLMmMxOLCtthDgMA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-transform-typeof-symbol/7.18.9_@babel+core@7.20.5:
    resolution: {integrity: sha512-SRfwTtF11G2aemAZWivL7PD+C9z52v9EvMqH9BuYbabyPuKUvSWks3oCg6041pT925L4zVFqaVBeECwsmlguEw==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-transform-typescript/7.20.2_@babel+core@7.20.5:
    resolution: {integrity: sha512-jvS+ngBfrnTUBfOQq8NfGnSbF9BrqlR6hjJ2yVxMkmO5nL/cdifNbI30EfjRlN4g5wYWNnMPyj5Sa6R1pbLeag==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-create-class-features-plugin': 7.20.5_@babel+core@7.20.5
      '@babel/helper-plugin-utils': 7.20.2
      '@babel/plugin-syntax-typescript': 7.20.0_@babel+core@7.20.5
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@babel/plugin-transform-unicode-escapes/7.18.10_@babel+core@7.20.5:
    resolution: {integrity: sha512-kKAdAI+YzPgGY/ftStBFXTI1LZFju38rYThnfMykS+IXy8BVx+res7s2fxf1l8I35DV2T97ezo6+SGrXz6B3iQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/plugin-transform-unicode-regex/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-gE7A6Lt7YLnNOL3Pb9BNeZvi+d8l7tcRrG4+pwJjK9hD2xX4mEvjlQW60G9EEmfXVYRPv9VRQcyegIVHCql/AA==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-create-regexp-features-plugin': 7.20.5_@babel+core@7.20.5
      '@babel/helper-plugin-utils': 7.20.2
    dev: false

  /@babel/preset-env/7.20.2_@babel+core@7.20.5:
    resolution: {integrity: sha512-1G0efQEWR1EHkKvKHqbG+IN/QdgwfByUpM5V5QroDzGV2t3S/WXNQd693cHiHTlCFMpr9B6FkPFXDA2lQcKoDg==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/compat-data': 7.20.5
      '@babel/core': 7.20.5
      '@babel/helper-compilation-targets': 7.20.0_@babel+core@7.20.5
      '@babel/helper-plugin-utils': 7.20.2
      '@babel/helper-validator-option': 7.18.6
      '@babel/plugin-bugfix-safari-id-destructuring-collision-in-function-expression': 7.18.6_@babel+core@7.20.5
      '@babel/plugin-bugfix-v8-spread-parameters-in-optional-chaining': 7.18.9_@babel+core@7.20.5
      '@babel/plugin-proposal-async-generator-functions': 7.20.1_@babel+core@7.20.5
      '@babel/plugin-proposal-class-properties': 7.18.6_@babel+core@7.20.5
      '@babel/plugin-proposal-class-static-block': 7.18.6_@babel+core@7.20.5
      '@babel/plugin-proposal-dynamic-import': 7.18.6_@babel+core@7.20.5
      '@babel/plugin-proposal-export-namespace-from': 7.18.9_@babel+core@7.20.5
      '@babel/plugin-proposal-json-strings': 7.18.6_@babel+core@7.20.5
      '@babel/plugin-proposal-logical-assignment-operators': 7.18.9_@babel+core@7.20.5
      '@babel/plugin-proposal-nullish-coalescing-operator': 7.18.6_@babel+core@7.20.5
      '@babel/plugin-proposal-numeric-separator': 7.18.6_@babel+core@7.20.5
      '@babel/plugin-proposal-object-rest-spread': 7.20.2_@babel+core@7.20.5
      '@babel/plugin-proposal-optional-catch-binding': 7.18.6_@babel+core@7.20.5
      '@babel/plugin-proposal-optional-chaining': 7.18.9_@babel+core@7.20.5
      '@babel/plugin-proposal-private-methods': 7.18.6_@babel+core@7.20.5
      '@babel/plugin-proposal-private-property-in-object': 7.20.5_@babel+core@7.20.5
      '@babel/plugin-proposal-unicode-property-regex': 7.18.6_@babel+core@7.20.5
      '@babel/plugin-syntax-async-generators': 7.8.4_@babel+core@7.20.5
      '@babel/plugin-syntax-class-properties': 7.12.13_@babel+core@7.20.5
      '@babel/plugin-syntax-class-static-block': 7.14.5_@babel+core@7.20.5
      '@babel/plugin-syntax-dynamic-import': 7.8.3_@babel+core@7.20.5
      '@babel/plugin-syntax-export-namespace-from': 7.8.3_@babel+core@7.20.5
      '@babel/plugin-syntax-import-assertions': 7.20.0_@babel+core@7.20.5
      '@babel/plugin-syntax-json-strings': 7.8.3_@babel+core@7.20.5
      '@babel/plugin-syntax-logical-assignment-operators': 7.10.4_@babel+core@7.20.5
      '@babel/plugin-syntax-nullish-coalescing-operator': 7.8.3_@babel+core@7.20.5
      '@babel/plugin-syntax-numeric-separator': 7.10.4_@babel+core@7.20.5
      '@babel/plugin-syntax-object-rest-spread': 7.8.3_@babel+core@7.20.5
      '@babel/plugin-syntax-optional-catch-binding': 7.8.3_@babel+core@7.20.5
      '@babel/plugin-syntax-optional-chaining': 7.8.3_@babel+core@7.20.5
      '@babel/plugin-syntax-private-property-in-object': 7.14.5_@babel+core@7.20.5
      '@babel/plugin-syntax-top-level-await': 7.14.5_@babel+core@7.20.5
      '@babel/plugin-transform-arrow-functions': 7.18.6_@babel+core@7.20.5
      '@babel/plugin-transform-async-to-generator': 7.18.6_@babel+core@7.20.5
      '@babel/plugin-transform-block-scoped-functions': 7.18.6_@babel+core@7.20.5
      '@babel/plugin-transform-block-scoping': 7.20.5_@babel+core@7.20.5
      '@babel/plugin-transform-classes': 7.20.2_@babel+core@7.20.5
      '@babel/plugin-transform-computed-properties': 7.18.9_@babel+core@7.20.5
      '@babel/plugin-transform-destructuring': 7.20.2_@babel+core@7.20.5
      '@babel/plugin-transform-dotall-regex': 7.18.6_@babel+core@7.20.5
      '@babel/plugin-transform-duplicate-keys': 7.18.9_@babel+core@7.20.5
      '@babel/plugin-transform-exponentiation-operator': 7.18.6_@babel+core@7.20.5
      '@babel/plugin-transform-for-of': 7.18.8_@babel+core@7.20.5
      '@babel/plugin-transform-function-name': 7.18.9_@babel+core@7.20.5
      '@babel/plugin-transform-literals': 7.18.9_@babel+core@7.20.5
      '@babel/plugin-transform-member-expression-literals': 7.18.6_@babel+core@7.20.5
      '@babel/plugin-transform-modules-amd': 7.19.6_@babel+core@7.20.5
      '@babel/plugin-transform-modules-commonjs': 7.19.6_@babel+core@7.20.5
      '@babel/plugin-transform-modules-systemjs': 7.19.6_@babel+core@7.20.5
      '@babel/plugin-transform-modules-umd': 7.18.6_@babel+core@7.20.5
      '@babel/plugin-transform-named-capturing-groups-regex': 7.20.5_@babel+core@7.20.5
      '@babel/plugin-transform-new-target': 7.18.6_@babel+core@7.20.5
      '@babel/plugin-transform-object-super': 7.18.6_@babel+core@7.20.5
      '@babel/plugin-transform-parameters': 7.20.5_@babel+core@7.20.5
      '@babel/plugin-transform-property-literals': 7.18.6_@babel+core@7.20.5
      '@babel/plugin-transform-regenerator': 7.20.5_@babel+core@7.20.5
      '@babel/plugin-transform-reserved-words': 7.18.6_@babel+core@7.20.5
      '@babel/plugin-transform-shorthand-properties': 7.18.6_@babel+core@7.20.5
      '@babel/plugin-transform-spread': 7.19.0_@babel+core@7.20.5
      '@babel/plugin-transform-sticky-regex': 7.18.6_@babel+core@7.20.5
      '@babel/plugin-transform-template-literals': 7.18.9_@babel+core@7.20.5
      '@babel/plugin-transform-typeof-symbol': 7.18.9_@babel+core@7.20.5
      '@babel/plugin-transform-unicode-escapes': 7.18.10_@babel+core@7.20.5
      '@babel/plugin-transform-unicode-regex': 7.18.6_@babel+core@7.20.5
      '@babel/preset-modules': 0.1.5_@babel+core@7.20.5
      '@babel/types': 7.20.5
      babel-plugin-polyfill-corejs2: 0.3.3_@babel+core@7.20.5
      babel-plugin-polyfill-corejs3: 0.6.0_@babel+core@7.20.5
      babel-plugin-polyfill-regenerator: 0.4.1_@babel+core@7.20.5
      core-js-compat: 3.26.1
      semver: 6.3.0
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@babel/preset-modules/0.1.5_@babel+core@7.20.5:
    resolution: {integrity: sha512-A57th6YRG7oR3cq/yt/Y84MvGgE0eJG2F1JLhKuyG+jFxEgrd/HAMJatiFtmOiZurz+0DkrvbheCLaV5f2JfjA==}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
      '@babel/plugin-proposal-unicode-property-regex': 7.18.6_@babel+core@7.20.5
      '@babel/plugin-transform-dotall-regex': 7.18.6_@babel+core@7.20.5
      '@babel/types': 7.20.5
      esutils: 2.0.3
    dev: false

  /@babel/preset-react/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-zXr6atUmyYdiWRVLOZahakYmOBHtWc2WGCkP8PYTgZi0iJXDY2CN180TdrIW4OGOAdLc7TifzDIvtx6izaRIzg==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
      '@babel/helper-validator-option': 7.18.6
      '@babel/plugin-transform-react-display-name': 7.18.6_@babel+core@7.20.5
      '@babel/plugin-transform-react-jsx': 7.19.0_@babel+core@7.20.5
      '@babel/plugin-transform-react-jsx-development': 7.18.6_@babel+core@7.20.5
      '@babel/plugin-transform-react-pure-annotations': 7.18.6_@babel+core@7.20.5
    dev: false

  /@babel/preset-typescript/7.18.6_@babel+core@7.20.5:
    resolution: {integrity: sha512-s9ik86kXBAnD760aybBucdpnLsAt0jK1xqJn2juOn9lkOvSHV60os5hxoVJsPzMQxvnUJFAlkont2DvvaYEBtQ==}
    engines: {node: '>=6.9.0'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-plugin-utils': 7.20.2
      '@babel/helper-validator-option': 7.18.6
      '@babel/plugin-transform-typescript': 7.20.2_@babel+core@7.20.5
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@babel/runtime/7.20.6:
    resolution: {integrity: sha512-Q+8MqP7TiHMWzSfwiJwXCjyf4GYA4Dgw3emg/7xmwsdLJOZUp+nMqcOwOzzYheuM1rhDu8FSj2l0aoMygEuXuA==}
    engines: {node: '>=6.9.0'}
    dependencies:
      regenerator-runtime: 0.13.11
    dev: false

  /@babel/template/7.18.10:
    resolution: {integrity: sha512-TI+rCtooWHr3QJ27kJxfjutghu44DLnasDMwpDqCXVTal9RLp3RSYNh4NdBrRP2cQAoG9A8juOQl6P6oZG4JxA==}
    engines: {node: '>=6.9.0'}
    dependencies:
      '@babel/code-frame': 7.18.6
      '@babel/parser': 7.20.5
      '@babel/types': 7.20.5
    dev: false

  /@babel/traverse/7.20.5:
    resolution: {integrity: sha512-WM5ZNN3JITQIq9tFZaw1ojLU3WgWdtkxnhM1AegMS+PvHjkM5IXjmYEGY7yukz5XS4sJyEf2VzWjI8uAavhxBQ==}
    engines: {node: '>=6.9.0'}
    dependencies:
      '@babel/code-frame': 7.18.6
      '@babel/generator': 7.20.5
      '@babel/helper-environment-visitor': 7.18.9
      '@babel/helper-function-name': 7.19.0
      '@babel/helper-hoist-variables': 7.18.6
      '@babel/helper-split-export-declaration': 7.18.6
      '@babel/parser': 7.20.5
      '@babel/types': 7.20.5
      debug: 4.3.4
      globals: 11.12.0
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@babel/types/7.20.5:
    resolution: {integrity: sha512-c9fst/h2/dcF7H+MJKZ2T0KjEQ8hY/BNnDk/H3XY8C4Aw/eWQXWn/lWntHF9ooUBnGmEvbfGrTgLWc+um0YDUg==}
    engines: {node: '>=6.9.0'}
    dependencies:
      '@babel/helper-string-parser': 7.19.4
      '@babel/helper-validator-identifier': 7.19.1
      to-fast-properties: 2.0.0
    dev: false

  /@bcoe/v8-coverage/0.2.3:
    resolution: {integrity: sha512-0hYQ8SB4Db5zvZB4axdMHGwEaQjkZzFjQiN9LVYvIFB2nSUHW9tYpxWriPrWDASIxiaXax83REcLxuSdnGPZtw==}
    dev: false

  /@cspotcode/source-map-support/0.8.1:
    resolution: {integrity: sha512-IchNf6dN4tHoMFIn/7OE8LWZ19Y6q/67Bmf6vnGREv8RSbBVb9LPJxEcnwrcwX6ixSvaiGoomAUvu4YSxXrVgw==}
    engines: {node: '>=12'}
    dependencies:
      '@jridgewell/trace-mapping': 0.3.9
    dev: false

  /@cypress/webpack-preprocessor/5.15.7_z55wzhjjrdtefyvtzcfbwh2ocq:
    resolution: {integrity: sha512-fXlwoD6XrgKYgOCQuj8EJm4yekV2mba3yz7WwlYnlt4BRSUqD03kUkxZxkChRm1YqdS8IB89x9EycU9Ew5kLYA==}
    peerDependencies:
      '@babel/preset-env': ^7.0.0
      babel-loader: ^8.0.2
      webpack: ^4 || ^5
    dependencies:
      '@babel/core': 7.20.5
      '@babel/generator': 7.20.5
      '@babel/parser': 7.20.5
      '@babel/preset-env': 7.20.2_@babel+core@7.20.5
      '@babel/traverse': 7.20.5
      babel-loader: 8.3.0_ztqwsvkb6z73luspkai6ilstpu
      bluebird: 3.7.1
      debug: 4.3.4
      fs-extra: 10.1.0
      loader-utils: 2.0.4
      lodash: 4.17.21
      md5: 2.3.0
      source-map: 0.6.1
      webpack: 5.75.0
      webpack-virtual-modules: 0.4.6
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@istanbuljs/load-nyc-config/1.1.0:
    resolution: {integrity: sha512-VjeHSlIzpv/NyD3N0YuHfXOPDIixcA1q2ZV98wsMqcYlPmv2n3Yb2lYP9XMElnaFVXg5A7YLTeLu6V84uQDjmQ==}
    engines: {node: '>=8'}
    dependencies:
      camelcase: 5.3.1
      find-up: 4.1.0
      get-package-type: 0.1.0
      js-yaml: 3.14.1
      resolve-from: 5.0.0
    dev: false

  /@istanbuljs/schema/0.1.3:
    resolution: {integrity: sha512-ZXRY4jNvVgSVQ8DL3LTcakaAtXwTVUxE81hslsyD2AtoXW/wVob10HkOJ1X/pAlcI7D+2YoZKg5do8G/w6RYgA==}
    engines: {node: '>=8'}
    dev: false

  /@jest/console/28.1.3:
    resolution: {integrity: sha512-QPAkP5EwKdK/bxIr6C1I4Vs0rm2nHiANzj/Z5X2JQkrZo6IqvC4ldZ9K95tF0HdidhA8Bo6egxSzUFPYKcEXLw==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      '@jest/types': 28.1.3
      '@types/node': 18.11.15
      chalk: 4.1.2
      jest-message-util: 28.1.3
      jest-util: 28.1.3
      slash: 3.0.0
    dev: false

  /@jest/environment/28.1.3:
    resolution: {integrity: sha512-1bf40cMFTEkKyEf585R9Iz1WayDjHoHqvts0XFYEqyKM3cFWDpeMoqKKTAF9LSYQModPUlh8FKptoM2YcMWAXA==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      '@jest/fake-timers': 28.1.3
      '@jest/types': 28.1.3
      '@types/node': 18.11.15
      jest-mock: 28.1.3
    dev: false

  /@jest/expect-utils/28.1.3:
    resolution: {integrity: sha512-wvbi9LUrHJLn3NlDW6wF2hvIMtd4JUl2QNVrjq+IBSHirgfrR3o9RnVtxzdEGO2n9JyIWwHnLfby5KzqBGg2YA==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      jest-get-type: 28.0.2
    dev: false

  /@jest/expect/28.1.3:
    resolution: {integrity: sha512-lzc8CpUbSoE4dqT0U+g1qODQjBRHPpCPXissXD4mS9+sWQdmmpeJ9zSH1rS1HEkrsMN0fb7nKrJ9giAR1d3wBw==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      expect: 28.1.3
      jest-snapshot: 28.1.3
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@jest/fake-timers/28.1.3:
    resolution: {integrity: sha512-D/wOkL2POHv52h+ok5Oj/1gOG9HSywdoPtFsRCUmlCILXNn5eIWmcnd3DIiWlJnpGvQtmajqBP95Ei0EimxfLw==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      '@jest/types': 28.1.3
      '@sinonjs/fake-timers': 9.1.2
      '@types/node': 18.11.15
      jest-message-util: 28.1.3
      jest-mock: 28.1.3
      jest-util: 28.1.3
    dev: false

  /@jest/globals/28.1.3:
    resolution: {integrity: sha512-XFU4P4phyryCXu1pbcqMO0GSQcYe1IsalYCDzRNyhetyeyxMcIxa11qPNDpVNLeretItNqEmYYQn1UYz/5x1NA==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      '@jest/environment': 28.1.3
      '@jest/expect': 28.1.3
      '@jest/types': 28.1.3
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@jest/reporters/28.1.1:
    resolution: {integrity: sha512-597Zj4D4d88sZrzM4atEGLuO7SdA/YrOv9SRXHXRNC+/FwPCWxZhBAEzhXoiJzfRwn8zes/EjS8Lo6DouGN5Gg==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    peerDependencies:
      node-notifier: ^8.0.1 || ^9.0.0 || ^10.0.0
    peerDependenciesMeta:
      node-notifier:
        optional: true
    dependencies:
      '@bcoe/v8-coverage': 0.2.3
      '@jest/console': 28.1.3
      '@jest/test-result': 28.1.1
      '@jest/transform': 28.1.3
      '@jest/types': 28.1.3
      '@jridgewell/trace-mapping': 0.3.17
      '@types/node': 18.11.15
      chalk: 4.1.0
      collect-v8-coverage: 1.0.1
      exit: 0.1.2
      glob: 7.2.3
      graceful-fs: 4.2.10
      istanbul-lib-coverage: 3.2.0
      istanbul-lib-instrument: 5.2.1
      istanbul-lib-report: 3.0.0
      istanbul-lib-source-maps: 4.0.1
      istanbul-reports: 3.1.5
      jest-message-util: 28.1.3
      jest-util: 28.1.1
      jest-worker: 28.1.3
      slash: 3.0.0
      string-length: 4.0.2
      strip-ansi: 6.0.1
      terminal-link: 2.1.1
      v8-to-istanbul: 9.0.1
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@jest/schemas/28.1.3:
    resolution: {integrity: sha512-/l/VWsdt/aBXgjshLWOFyFt3IVdYypu5y2Wn2rOO1un6nkqIn8SLXzgIMYXFyYsRWDyF5EthmKJMIdJvk08grg==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      '@sinclair/typebox': 0.24.51
    dev: false

  /@jest/source-map/28.1.2:
    resolution: {integrity: sha512-cV8Lx3BeStJb8ipPHnqVw/IM2VCMWO3crWZzYodSIkxXnRcXJipCdx1JCK0K5MsJJouZQTH73mzf4vgxRaH9ww==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      '@jridgewell/trace-mapping': 0.3.17
      callsites: 3.1.0
      graceful-fs: 4.2.10
    dev: false

  /@jest/test-result/28.1.1:
    resolution: {integrity: sha512-hPmkugBktqL6rRzwWAtp1JtYT4VHwv8OQ+9lE5Gymj6dHzubI/oJHMUpPOt8NrdVWSrz9S7bHjJUmv2ggFoUNQ==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      '@jest/console': 28.1.3
      '@jest/types': 28.1.3
      '@types/istanbul-lib-coverage': 2.0.4
      collect-v8-coverage: 1.0.1
    dev: false

  /@jest/test-result/28.1.3:
    resolution: {integrity: sha512-kZAkxnSE+FqE8YjW8gNuoVkkC9I7S1qmenl8sGcDOLropASP+BkcGKwhXoyqQuGOGeYY0y/ixjrd/iERpEXHNg==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      '@jest/console': 28.1.3
      '@jest/types': 28.1.3
      '@types/istanbul-lib-coverage': 2.0.4
      collect-v8-coverage: 1.0.1
    dev: false

  /@jest/test-sequencer/28.1.3:
    resolution: {integrity: sha512-NIMPEqqa59MWnDi1kvXXpYbqsfQmSJsIbnd85mdVGkiDfQ9WQQTXOLsvISUfonmnBT+w85WEgneCigEEdHDFxw==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      '@jest/test-result': 28.1.3
      graceful-fs: 4.2.10
      jest-haste-map: 28.1.3
      slash: 3.0.0
    dev: false

  /@jest/transform/28.1.3:
    resolution: {integrity: sha512-u5dT5di+oFI6hfcLOHGTAfmUxFRrjK+vnaP0kkVow9Md/M7V/MxqQMOz/VV25UZO8pzeA9PjfTpOu6BDuwSPQA==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      '@babel/core': 7.20.5
      '@jest/types': 28.1.3
      '@jridgewell/trace-mapping': 0.3.17
      babel-plugin-istanbul: 6.1.1
      chalk: 4.1.2
      convert-source-map: 1.9.0
      fast-json-stable-stringify: 2.1.0
      graceful-fs: 4.2.10
      jest-haste-map: 28.1.3
      jest-regex-util: 28.0.2
      jest-util: 28.1.3
      micromatch: 4.0.5
      pirates: 4.0.5
      slash: 3.0.0
      write-file-atomic: 4.0.2
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@jest/types/28.1.3:
    resolution: {integrity: sha512-RyjiyMUZrKz/c+zlMFO1pm70DcIlST8AeWTkoUdZevew44wcNZQHsEVOiCVtgVnlFFD82FPaXycys58cf2muVQ==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      '@jest/schemas': 28.1.3
      '@types/istanbul-lib-coverage': 2.0.4
      '@types/istanbul-reports': 3.0.1
      '@types/node': 18.11.15
      '@types/yargs': 17.0.17
      chalk: 4.1.2
    dev: false

  /@jridgewell/gen-mapping/0.1.1:
    resolution: {integrity: sha512-sQXCasFk+U8lWYEe66WxRDOE9PjVz4vSM51fTu3Hw+ClTpUSQb718772vH3pyS5pShp6lvQM7SxgIDXXXmOX7w==}
    engines: {node: '>=6.0.0'}
    dependencies:
      '@jridgewell/set-array': 1.1.2
      '@jridgewell/sourcemap-codec': 1.4.14
    dev: false

  /@jridgewell/gen-mapping/0.3.2:
    resolution: {integrity: sha512-mh65xKQAzI6iBcFzwv28KVWSmCkdRBWoOh+bYQGW3+6OZvbbN3TqMGo5hqYxQniRcH9F2VZIoJCm4pa3BPDK/A==}
    engines: {node: '>=6.0.0'}
    dependencies:
      '@jridgewell/set-array': 1.1.2
      '@jridgewell/sourcemap-codec': 1.4.14
      '@jridgewell/trace-mapping': 0.3.17
    dev: false

  /@jridgewell/resolve-uri/3.1.0:
    resolution: {integrity: sha512-F2msla3tad+Mfht5cJq7LSXcdudKTWCVYUgw6pLFOOHSTtZlj6SWNYAp+AhuqLmWdBO2X5hPrLcu8cVP8fy28w==}
    engines: {node: '>=6.0.0'}
    dev: false

  /@jridgewell/set-array/1.1.2:
    resolution: {integrity: sha512-xnkseuNADM0gt2bs+BvhO0p78Mk762YnZdsuzFV018NoG1Sj1SCQvpSqa7XUaTam5vAGasABV9qXASMKnFMwMw==}
    engines: {node: '>=6.0.0'}
    dev: false

  /@jridgewell/source-map/0.3.2:
    resolution: {integrity: sha512-m7O9o2uR8k2ObDysZYzdfhb08VuEml5oWGiosa1VdaPZ/A6QyPkAJuwN0Q1lhULOf6B7MtQmHENS743hWtCrgw==}
    dependencies:
      '@jridgewell/gen-mapping': 0.3.2
      '@jridgewell/trace-mapping': 0.3.17
    dev: false

  /@jridgewell/sourcemap-codec/1.4.14:
    resolution: {integrity: sha512-XPSJHWmi394fuUuzDnGz1wiKqWfo1yXecHQMRf2l6hztTO+nPru658AyDngaBe7isIxEkRsPR3FZh+s7iVa4Uw==}
    dev: false

  /@jridgewell/trace-mapping/0.3.17:
    resolution: {integrity: sha512-MCNzAp77qzKca9+W/+I0+sEpaUnZoeasnghNeVc41VZCEKaCH73Vq3BZZ/SzWIgrqE4H4ceI+p+b6C0mHf9T4g==}
    dependencies:
      '@jridgewell/resolve-uri': 3.1.0
      '@jridgewell/sourcemap-codec': 1.4.14
    dev: false

  /@jridgewell/trace-mapping/0.3.9:
    resolution: {integrity: sha512-3Belt6tdc8bPgAtbcmdtNJlirVoTmEb5e2gC94PnkwEW9jI6CAHUeoG85tjWP5WquqfavoMtMwiG4P926ZKKuQ==}
    dependencies:
      '@jridgewell/resolve-uri': 3.1.0
      '@jridgewell/sourcemap-codec': 1.4.14
    dev: false

  /@leichtgewicht/ip-codec/2.0.4:
    resolution: {integrity: sha512-Hcv+nVC0kZnQ3tD9GVu5xSMR4VVYOteQIr/hwFPVEvPdlXqgGEuRjiheChHgdM+JyqdgNcmzZOX/tnl0JOiI7A==}
    dev: false

  /@next/env/13.0.0:
    resolution: {integrity: sha512-65v9BVuah2Mplohm4+efsKEnoEuhmlGm8B2w6vD1geeEP2wXtlSJCvR/cCRJ3fD8wzCQBV41VcMBQeYET6MRkg==}
    dev: false

  /@next/swc-android-arm-eabi/13.0.0:
    resolution: {integrity: sha512-+DUQkYF93gxFjWY+CYWE1QDX6gTgnUiWf+W4UqZjM1Jcef8U97fS6xYh+i+8rH4MM0AXHm7OSakvfOMzmjU6VA==}
    engines: {node: '>= 10'}
    cpu: [arm]
    os: [android]
    requiresBuild: true
    dev: false
    optional: true

  /@next/swc-android-arm64/13.0.0:
    resolution: {integrity: sha512-RW9Uy3bMSc0zVGCa11klFuwfP/jdcdkhdruqnrJ7v+7XHm6OFKkSRzX6ee7yGR1rdDZvTnP4GZSRSpzjLv/N0g==}
    engines: {node: '>= 10'}
    cpu: [arm64]
    os: [android]
    requiresBuild: true
    dev: false
    optional: true

  /@next/swc-darwin-arm64/13.0.0:
    resolution: {integrity: sha512-APA26nps1j4qyhOIzkclW/OmgotVHj1jBxebSpMCPw2rXfiNvKNY9FA0TcuwPmUCNqaTnm703h6oW4dvp73A4Q==}
    engines: {node: '>= 10'}
    cpu: [arm64]
    os: [darwin]
    requiresBuild: true
    dev: false
    optional: true

  /@next/swc-darwin-x64/13.0.0:
    resolution: {integrity: sha512-qsUhUdoFuRJiaJ7LnvTQ6GZv1QnMDcRXCIjxaN0FNVXwrjkq++U7KjBUaxXkRzLV4C7u0NHLNOp0iZwNNE7ypw==}
    engines: {node: '>= 10'}
    cpu: [x64]
    os: [darwin]
    requiresBuild: true
    dev: false
    optional: true

  /@next/swc-freebsd-x64/13.0.0:
    resolution: {integrity: sha512-sCdyCbboS7CwdnevKH9J6hkJI76LUw1jVWt4eV7kISuLiPba3JmehZSWm80oa4ADChRVAwzhLAo2zJaYRrInbg==}
    engines: {node: '>= 10'}
    cpu: [x64]
    os: [freebsd]
    requiresBuild: true
    dev: false
    optional: true

  /@next/swc-linux-arm-gnueabihf/13.0.0:
    resolution: {integrity: sha512-/X/VxfFA41C9jrEv+sUsPLQ5vbDPVIgG0CJrzKvrcc+b+4zIgPgtfsaWq9ockjHFQi3ycvlZK4TALOXO8ovQ6Q==}
    engines: {node: '>= 10'}
    cpu: [arm]
    os: [linux]
    requiresBuild: true
    dev: false
    optional: true

  /@next/swc-linux-arm64-gnu/13.0.0:
    resolution: {integrity: sha512-x6Oxr1GIi0ZtNiT6jbw+JVcbEi3UQgF7mMmkrgfL4mfchOwXtWSHKTSSPnwoJWJfXYa0Vy1n8NElWNTGAqoWFw==}
    engines: {node: '>= 10'}
    cpu: [arm64]
    os: [linux]
    requiresBuild: true
    dev: false
    optional: true

  /@next/swc-linux-arm64-musl/13.0.0:
    resolution: {integrity: sha512-SnMH9ngI+ipGh3kqQ8+mDtWunirwmhQnQeZkEq9e/9Xsgjf04OetqrqRHKM1HmJtG2qMUJbyXFJ0F81TPuT+3g==}
    engines: {node: '>= 10'}
    cpu: [arm64]
    os: [linux]
    requiresBuild: true
    dev: false
    optional: true

  /@next/swc-linux-x64-gnu/13.0.0:
    resolution: {integrity: sha512-VSQwTX9EmdbotArtA1J67X8964oQfe0xHb32x4tu+JqTR+wOHyG6wGzPMdXH2oKAp6rdd7BzqxUXXf0J+ypHlw==}
    engines: {node: '>= 10'}
    cpu: [x64]
    os: [linux]
    requiresBuild: true
    dev: false
    optional: true

  /@next/swc-linux-x64-musl/13.0.0:
    resolution: {integrity: sha512-xBCP0nnpO0q4tsytXkvIwWFINtbFRyVY5gxa1zB0vlFtqYR9lNhrOwH3CBrks3kkeaePOXd611+8sjdUtrLnXA==}
    engines: {node: '>= 10'}
    cpu: [x64]
    os: [linux]
    requiresBuild: true
    dev: false
    optional: true

  /@next/swc-win32-arm64-msvc/13.0.0:
    resolution: {integrity: sha512-NutwDafqhGxqPj/eiUixJq9ImS/0sgx6gqlD7jRndCvQ2Q8AvDdu1+xKcGWGNnhcDsNM/n1avf1e62OG1GaqJg==}
    engines: {node: '>= 10'}
    cpu: [arm64]
    os: [win32]
    requiresBuild: true
    dev: false
    optional: true

  /@next/swc-win32-ia32-msvc/13.0.0:
    resolution: {integrity: sha512-zNaxaO+Kl/xNz02E9QlcVz0pT4MjkXGDLb25qxtAzyJL15aU0+VjjbIZAYWctG59dvggNIUNDWgoBeVTKB9xLg==}
    engines: {node: '>= 10'}
    cpu: [ia32]
    os: [win32]
    requiresBuild: true
    dev: false
    optional: true

  /@next/swc-win32-x64-msvc/13.0.0:
    resolution: {integrity: sha512-FFOGGWwTCRMu9W7MF496Urefxtuo2lttxF1vwS+1rIRsKvuLrWhVaVTj3T8sf2EBL6gtJbmh4TYlizS+obnGKA==}
    engines: {node: '>= 10'}
    cpu: [x64]
    os: [win32]
    requiresBuild: true
    dev: false
    optional: true

  /@nodelib/fs.scandir/2.1.5:
    resolution: {integrity: sha512-vq24Bq3ym5HEQm2NKCr3yXDwjc7vTsEThRDnkp2DK9p1uqLR+DHurm/NOTo0KG7HYHU7eppKZj3MyqYuMBf62g==}
    engines: {node: '>= 8'}
    dependencies:
      '@nodelib/fs.stat': 2.0.5
      run-parallel: 1.2.0
    dev: false

  /@nodelib/fs.stat/2.0.5:
    resolution: {integrity: sha512-RkhPPp2zrqDAQA/2jNhnztcPAlv64XdhIp7a7454A5ovI7Bukxgt7MX7udwAu3zg1DcpPU0rz3VV1SeaqvY4+A==}
    engines: {node: '>= 8'}
    dev: false

  /@nodelib/fs.walk/1.2.8:
    resolution: {integrity: sha512-oGB+UxlgWcgQkgwo8GcEGwemoTFt3FIO9ababBmaGwXIoBKZ+GTy0pP185beGg7Llih/NSHSV2XAs1lnznocSg==}
    engines: {node: '>= 8'}
    dependencies:
      '@nodelib/fs.scandir': 2.1.5
      fastq: 1.14.0
    dev: false

  /@nrwl/cli/15.3.3:
    resolution: {integrity: sha512-ZWTmVP9H3ukppWWGaS/s3Nym2nOYgnt6eHtuUFNsroz8LesG5oFAJviOz9jDEM/b+pLIrvYfU5aAGZqrtM3Z2A==}
    dependencies:
      nx: 15.3.3
    transitivePeerDependencies:
      - '@swc-node/register'
      - '@swc/core'
      - debug
    dev: false

  /@nrwl/cypress/15.3.3_typescript@4.8.4:
    resolution: {integrity: sha512-+nxWdnRE0JJ1SPt3aKH1TiXSmmSf9xRyniFZ7pobQ74GzNCj6Vd5ZxrepZKYdYh/xzqINzLTHc+1FfRsWf1VUg==}
    peerDependencies:
      cypress: '>= 3 < 12'
    peerDependenciesMeta:
      cypress:
        optional: true
    dependencies:
      '@babel/core': 7.20.5
      '@babel/preset-env': 7.20.2_@babel+core@7.20.5
      '@cypress/webpack-preprocessor': 5.15.7_z55wzhjjrdtefyvtzcfbwh2ocq
      '@nrwl/devkit': 15.3.3_typescript@4.8.4
      '@nrwl/linter': 15.3.3_typescript@4.8.4
      '@nrwl/workspace': 15.3.3_typescript@4.8.4
      '@phenomnomnominal/tsquery': 4.1.1_typescript@4.8.4
      babel-loader: 8.3.0_ztqwsvkb6z73luspkai6ilstpu
      chalk: 4.1.0
      dotenv: 10.0.0
      fork-ts-checker-webpack-plugin: 7.2.13_qw7fmzhoapcndkteb5rsc33stq
      semver: 7.3.4
      ts-loader: 9.4.2_qw7fmzhoapcndkteb5rsc33stq
      tsconfig-paths-webpack-plugin: 3.5.2
      tslib: 2.4.1
      webpack: 5.75.0
      webpack-node-externals: 3.0.0
    transitivePeerDependencies:
      - '@swc-node/register'
      - '@swc/core'
      - debug
      - esbuild
      - eslint
      - nx
      - prettier
      - supports-color
      - typescript
      - uglify-js
      - vue-template-compiler
      - webpack-cli
    dev: false

  /@nrwl/devkit/15.3.3_nx@15.3.3+typescript@4.8.4:
    resolution: {integrity: sha512-48R9HAp6r6umWNXTlVTMsH94YYjU/XUPLDTtXBgKESMVbdq8Fk+HDHuN0thXG5dL6DFkXgD0MICLm3jSQU6xMw==}
    peerDependencies:
      nx: '>= 14 <= 16'
    dependencies:
      '@phenomnomnominal/tsquery': 4.1.1_typescript@4.8.4
      ejs: 3.1.8
      ignore: 5.2.1
      nx: 15.3.3
      semver: 7.3.4
      tslib: 2.4.1
    transitivePeerDependencies:
      - typescript
    dev: false

  /@nrwl/devkit/15.3.3_typescript@4.8.4:
    resolution: {integrity: sha512-48R9HAp6r6umWNXTlVTMsH94YYjU/XUPLDTtXBgKESMVbdq8Fk+HDHuN0thXG5dL6DFkXgD0MICLm3jSQU6xMw==}
    peerDependencies:
      nx: '>= 14 <= 16'
    dependencies:
      '@phenomnomnominal/tsquery': 4.1.1_typescript@4.8.4
      ejs: 3.1.8
      ignore: 5.2.1
      semver: 7.3.4
      tslib: 2.4.1
    transitivePeerDependencies:
      - typescript
    dev: false

  /@nrwl/jest/15.3.3_mwhvu7sfp6vq5ryuwb6hlbjfka:
    resolution: {integrity: sha512-hPqBSVmZzGh+FUsgOPim2KnPY7lbjgZlsT1W3D+1ac++gvZopcqyXA2mJJH1X/RxRS3RAYDsE14n+Z3HWFXbwg==}
    dependencies:
      '@jest/reporters': 28.1.1
      '@jest/test-result': 28.1.1
      '@nrwl/devkit': 15.3.3_typescript@4.8.4
      '@phenomnomnominal/tsquery': 4.1.1_typescript@4.8.4
      chalk: 4.1.0
      dotenv: 10.0.0
      identity-obj-proxy: 3.0.0
      jest-config: 28.1.1_ts-node@10.9.1
      jest-resolve: 28.1.1
      jest-util: 28.1.1
      resolve.exports: 1.1.0
      tslib: 2.4.1
    transitivePeerDependencies:
      - '@types/node'
      - node-notifier
      - nx
      - supports-color
      - ts-node
      - typescript
    dev: false

  /@nrwl/js/15.3.3_typescript@4.8.4:
    resolution: {integrity: sha512-q/ePt1U9PfhBIsm2DXQmO/MHIUMhIE69caNMuwCJ/W5oC0w5Lm7R6I7BsYuqni1X/CQchVUrVQa1+vYFXOWqUw==}
    dependencies:
      '@nrwl/devkit': 15.3.3_typescript@4.8.4
      '@nrwl/linter': 15.3.3_typescript@4.8.4
      '@nrwl/workspace': 15.3.3_typescript@4.8.4
      chalk: 4.1.0
      fast-glob: 3.2.7
      fs-extra: 10.1.0
      ignore: 5.2.1
      js-tokens: 4.0.0
      minimatch: 3.0.5
      source-map-support: 0.5.19
      tree-kill: 1.2.2
    transitivePeerDependencies:
      - '@swc-node/register'
      - '@swc/core'
      - debug
      - eslint
      - nx
      - prettier
      - typescript
    dev: false

  /@nrwl/linter/15.3.3_nx@15.3.3+typescript@4.8.4:
    resolution: {integrity: sha512-qAcSmbRuzBZ86ahn0/S+zCOj+PobJRAMf6OZq2ZnbfGwS+LXbqXyaoShzZC1e75nd8vroLV61fFbPkLlTqJwgA==}
    peerDependencies:
      eslint: ^8.0.0
    peerDependenciesMeta:
      eslint:
        optional: true
    dependencies:
      '@nrwl/devkit': 15.3.3_nx@15.3.3+typescript@4.8.4
      '@phenomnomnominal/tsquery': 4.1.1_typescript@4.8.4
      tmp: 0.2.1
      tslib: 2.4.1
    transitivePeerDependencies:
      - nx
      - typescript
    dev: false

  /@nrwl/linter/15.3.3_typescript@4.8.4:
    resolution: {integrity: sha512-qAcSmbRuzBZ86ahn0/S+zCOj+PobJRAMf6OZq2ZnbfGwS+LXbqXyaoShzZC1e75nd8vroLV61fFbPkLlTqJwgA==}
    peerDependencies:
      eslint: ^8.0.0
    peerDependenciesMeta:
      eslint:
        optional: true
    dependencies:
      '@nrwl/devkit': 15.3.3_typescript@4.8.4
      '@phenomnomnominal/tsquery': 4.1.1_typescript@4.8.4
      tmp: 0.2.1
      tslib: 2.4.1
    transitivePeerDependencies:
      - nx
      - typescript
    dev: false

  /@nrwl/next/15.3.3_xvhegjze7sm3upzckgmd3qanmy:
    resolution: {integrity: sha512-Ly3F76YFdX4ZS1SYV7r/KBWoul8kSefoKiLkdRXKar/8UFaK+eW8xnlAFC2MU9seoXpaqGQTl1GMsnEJ1gMEJg==}
    peerDependencies:
      next: ^13.0.0
    dependencies:
      '@babel/plugin-proposal-decorators': 7.20.5
      '@nrwl/cypress': 15.3.3_typescript@4.8.4
      '@nrwl/devkit': 15.3.3_typescript@4.8.4
      '@nrwl/jest': 15.3.3_mwhvu7sfp6vq5ryuwb6hlbjfka
      '@nrwl/linter': 15.3.3_typescript@4.8.4
      '@nrwl/react': 15.3.3_typescript@4.8.4
      '@nrwl/webpack': 15.3.3_typescript@4.8.4
      '@nrwl/workspace': 15.3.3_typescript@4.8.4
      '@svgr/webpack': 6.5.1
      chalk: 4.1.0
      dotenv: 10.0.0
      fs-extra: 10.1.0
      ignore: 5.2.1
      next: 13.0.0_biqbaboplfbrettd7655fr4n2y
      semver: 7.3.4
      ts-node: 10.9.1_typescript@4.8.4
      tsconfig-paths: 3.14.1
      url-loader: 4.1.1
      webpack-merge: 5.8.0
    transitivePeerDependencies:
      - '@babel/core'
      - '@parcel/css'
      - '@swc-node/register'
      - '@swc/core'
      - '@swc/wasm'
      - '@types/node'
      - bufferutil
      - clean-css
      - csso
      - cypress
      - debug
      - esbuild
      - eslint
      - fibers
      - file-loader
      - html-webpack-plugin
      - node-notifier
      - node-sass
      - nx
      - prettier
      - sass-embedded
      - supports-color
      - typescript
      - uglify-js
      - utf-8-validate
      - vue-template-compiler
      - webpack
      - webpack-cli
    dev: false

  /@nrwl/react/15.3.3_typescript@4.8.4:
    resolution: {integrity: sha512-sskKgloMmLVbugpbDV0zlDQkwCehrfiDH4Uo3qVGqkdIvPEjPARGGCmLDrxqF+KO5Gad7jZXGAlIMCjgFqfBww==}
    dependencies:
      '@nrwl/devkit': 15.3.3_typescript@4.8.4
      '@nrwl/linter': 15.3.3_typescript@4.8.4
      '@nrwl/workspace': 15.3.3_typescript@4.8.4
      '@phenomnomnominal/tsquery': 4.1.1_typescript@4.8.4
      chalk: 4.1.0
      minimatch: 3.0.5
      semver: 7.3.4
    transitivePeerDependencies:
      - '@swc-node/register'
      - '@swc/core'
      - debug
      - eslint
      - nx
      - prettier
      - typescript
    dev: false

  /@nrwl/tao/15.3.3:
    resolution: {integrity: sha512-f9+VwhlJ/7TWpjHSgoUOAA067uP9DmzABMY9HC5OREEDaCx+rzYEvbLAPv6cXzWw+6IYM6cyKw0zWSQrdEVrWg==}
    hasBin: true
    dependencies:
      nx: 15.3.3
    transitivePeerDependencies:
      - '@swc-node/register'
      - '@swc/core'
      - debug
    dev: false

  /@nrwl/webpack/15.3.3_typescript@4.8.4:
    resolution: {integrity: sha512-33JGYqg00NeEe1Lz3UZRweBL5zIWwWJhvaFrRLWcDgaTe5kOzXDHlizRIE3abVReI2OHpWbKBCM7KMK2XI3HRQ==}
    dependencies:
      '@nrwl/devkit': 15.3.3_typescript@4.8.4
      '@nrwl/js': 15.3.3_typescript@4.8.4
      '@nrwl/workspace': 15.3.3_typescript@4.8.4
      autoprefixer: 10.4.13_postcss@8.4.20
      babel-loader: 8.3.0_webpack@5.75.0
      browserslist: 4.21.4
      caniuse-lite: 1.0.30001439
      chalk: 4.1.0
      chokidar: 3.5.3
      copy-webpack-plugin: 10.2.4_webpack@5.75.0
      css-loader: 6.7.3_webpack@5.75.0
      css-minimizer-webpack-plugin: 3.4.1_webpack@5.75.0
      dotenv: 10.0.0
      file-loader: 6.2.0_webpack@5.75.0
      fork-ts-checker-webpack-plugin: 7.2.13_qw7fmzhoapcndkteb5rsc33stq
      fs-extra: 10.1.0
      ignore: 5.2.1
      less: 3.12.2
      less-loader: 11.1.0_less@3.12.2+webpack@5.75.0
      license-webpack-plugin: 4.0.2_webpack@5.75.0
      loader-utils: 2.0.4
      mini-css-extract-plugin: 2.4.7_webpack@5.75.0
      parse5: 4.0.0
      parse5-html-rewriting-stream: 6.0.1
      postcss: 8.4.20
      postcss-import: 14.1.0_postcss@8.4.20
      postcss-loader: 6.2.1_qxxfhhrl3yknjjmta266mo3u64
      raw-loader: 4.0.2_webpack@5.75.0
      rxjs: 6.6.7
      sass: 1.56.2
      sass-loader: 12.6.0_sass@1.56.2+webpack@5.75.0
      source-map-loader: 3.0.2_webpack@5.75.0
      style-loader: 3.3.1_webpack@5.75.0
      stylus: 0.55.0
      stylus-loader: 7.1.0_irl2hmhzopg6urv44vymn74p4e
      terser-webpack-plugin: 5.3.6_webpack@5.75.0
      ts-loader: 9.4.2_qw7fmzhoapcndkteb5rsc33stq
      ts-node: 10.9.1_typescript@4.8.4
      tsconfig-paths: 3.14.1
      tsconfig-paths-webpack-plugin: 3.5.2
      tslib: 2.4.1
      webpack: 5.75.0
      webpack-dev-server: 4.11.1_webpack@5.75.0
      webpack-merge: 5.8.0
      webpack-node-externals: 3.0.0
      webpack-sources: 3.2.3
      webpack-subresource-integrity: 5.1.0_webpack@5.75.0
    transitivePeerDependencies:
      - '@babel/core'
      - '@parcel/css'
      - '@swc-node/register'
      - '@swc/core'
      - '@swc/wasm'
      - '@types/node'
      - bufferutil
      - clean-css
      - csso
      - debug
      - esbuild
      - eslint
      - fibers
      - html-webpack-plugin
      - node-sass
      - nx
      - prettier
      - sass-embedded
      - supports-color
      - typescript
      - uglify-js
      - utf-8-validate
      - vue-template-compiler
      - webpack-cli
    dev: false

  /@nrwl/workspace/15.3.3_typescript@4.8.4:
    resolution: {integrity: sha512-vPv/JSy0K7X9f9oiciF74DpmzH0DvTyDr5HJZhom9tJsFM1FCfHRGu3LysfK3lC3pOpNeNeK4iApJw/BTdXI5A==}
    peerDependencies:
      prettier: ^2.6.2
    peerDependenciesMeta:
      prettier:
        optional: true
    dependencies:
      '@nrwl/devkit': 15.3.3_nx@15.3.3+typescript@4.8.4
      '@nrwl/linter': 15.3.3_nx@15.3.3+typescript@4.8.4
      '@parcel/watcher': 2.0.4
      chalk: 4.1.0
      chokidar: 3.5.3
      cli-cursor: 3.1.0
      cli-spinners: 2.6.1
      dotenv: 10.0.0
      enquirer: 2.3.6
      figures: 3.2.0
      flat: 5.0.2
      fs-extra: 10.1.0
      glob: 7.1.4
      ignore: 5.2.1
      minimatch: 3.0.5
      npm-run-path: 4.0.1
      nx: 15.3.3
      open: 8.4.0
      rxjs: 6.6.7
      semver: 7.3.4
      tmp: 0.2.1
      tslib: 2.4.1
      yargs: 17.6.2
      yargs-parser: 21.1.1
    transitivePeerDependencies:
      - '@swc-node/register'
      - '@swc/core'
      - debug
      - eslint
      - typescript
    dev: false

  /@parcel/watcher/2.0.4:
    resolution: {integrity: sha512-cTDi+FUDBIUOBKEtj+nhiJ71AZVlkAsQFuGQTun5tV9mwQBQgZvhCzG+URPQc8myeN32yRVZEfVAPCs1RW+Jvg==}
    engines: {node: '>= 10.0.0'}
    requiresBuild: true
    dependencies:
      node-addon-api: 3.2.1
      node-gyp-build: 4.5.0
    dev: false

  /@phenomnomnominal/tsquery/4.1.1_typescript@4.8.4:
    resolution: {integrity: sha512-jjMmK1tnZbm1Jq5a7fBliM4gQwjxMU7TFoRNwIyzwlO+eHPRCFv/Nv+H/Gi1jc3WR7QURG8D5d0Tn12YGrUqBQ==}
    peerDependencies:
      typescript: ^3 || ^4
    dependencies:
      esquery: 1.4.0
      typescript: 4.8.4
    dev: false

  /@sinclair/typebox/0.24.51:
    resolution: {integrity: sha512-1P1OROm/rdubP5aFDSZQILU0vrLCJ4fvHt6EoqHEM+2D/G5MK3bIaymUKLit8Js9gbns5UyJnkP/TZROLw4tUA==}
    dev: false

  /@sinonjs/commons/1.8.6:
    resolution: {integrity: sha512-Ky+XkAkqPZSm3NLBeUng77EBQl3cmeJhITaGHdYH8kjVB+aun3S4XBRti2zt17mtt0mIUDiNxYeoJm6drVvBJQ==}
    dependencies:
      type-detect: 4.0.8
    dev: false

  /@sinonjs/fake-timers/9.1.2:
    resolution: {integrity: sha512-BPS4ynJW/o92PUR4wgriz2Ud5gpST5vz6GQfMixEDK0Z8ZCUv2M7SkBLykH56T++Xs+8ln9zTGbOvNGIe02/jw==}
    dependencies:
      '@sinonjs/commons': 1.8.6
    dev: false

  /@svgr/babel-plugin-add-jsx-attribute/6.5.1_@babel+core@7.20.5:
    resolution: {integrity: sha512-9PYGcXrAxitycIjRmZB+Q0JaN07GZIWaTBIGQzfaZv+qr1n8X1XUEJ5rZ/vx6OVD9RRYlrNnXWExQXcmZeD/BQ==}
    engines: {node: '>=10'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
    dev: false

  /@svgr/babel-plugin-remove-jsx-attribute/6.5.0_@babel+core@7.20.5:
    resolution: {integrity: sha512-8zYdkym7qNyfXpWvu4yq46k41pyNM9SOstoWhKlm+IfdCE1DdnRKeMUPsWIEO/DEkaWxJ8T9esNdG3QwQ93jBA==}
    engines: {node: '>=10'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
    dev: false

  /@svgr/babel-plugin-remove-jsx-empty-expression/6.5.0_@babel+core@7.20.5:
    resolution: {integrity: sha512-NFdxMq3xA42Kb1UbzCVxplUc0iqSyM9X8kopImvFnB+uSDdzIHOdbs1op8ofAvVRtbg4oZiyRl3fTYeKcOe9Iw==}
    engines: {node: '>=10'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
    dev: false

  /@svgr/babel-plugin-replace-jsx-attribute-value/6.5.1_@babel+core@7.20.5:
    resolution: {integrity: sha512-8DPaVVE3fd5JKuIC29dqyMB54sA6mfgki2H2+swh+zNJoynC8pMPzOkidqHOSc6Wj032fhl8Z0TVn1GiPpAiJg==}
    engines: {node: '>=10'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
    dev: false

  /@svgr/babel-plugin-svg-dynamic-title/6.5.1_@babel+core@7.20.5:
    resolution: {integrity: sha512-FwOEi0Il72iAzlkaHrlemVurgSQRDFbk0OC8dSvD5fSBPHltNh7JtLsxmZUhjYBZo2PpcU/RJvvi6Q0l7O7ogw==}
    engines: {node: '>=10'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
    dev: false

  /@svgr/babel-plugin-svg-em-dimensions/6.5.1_@babel+core@7.20.5:
    resolution: {integrity: sha512-gWGsiwjb4tw+ITOJ86ndY/DZZ6cuXMNE/SjcDRg+HLuCmwpcjOktwRF9WgAiycTqJD/QXqL2f8IzE2Rzh7aVXA==}
    engines: {node: '>=10'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
    dev: false

  /@svgr/babel-plugin-transform-react-native-svg/6.5.1_@babel+core@7.20.5:
    resolution: {integrity: sha512-2jT3nTayyYP7kI6aGutkyfJ7UMGtuguD72OjeGLwVNyfPRBD8zQthlvL+fAbAKk5n9ZNcvFkp/b1lZ7VsYqVJg==}
    engines: {node: '>=10'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
    dev: false

  /@svgr/babel-plugin-transform-svg-component/6.5.1_@babel+core@7.20.5:
    resolution: {integrity: sha512-a1p6LF5Jt33O3rZoVRBqdxL350oge54iZWHNI6LJB5tQ7EelvD/Mb1mfBiZNAan0dt4i3VArkFRjA4iObuNykQ==}
    engines: {node: '>=12'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
    dev: false

  /@svgr/babel-preset/6.5.1_@babel+core@7.20.5:
    resolution: {integrity: sha512-6127fvO/FF2oi5EzSQOAjo1LE3OtNVh11R+/8FXa+mHx1ptAaS4cknIjnUA7e6j6fwGGJ17NzaTJFUwOV2zwCw==}
    engines: {node: '>=10'}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@svgr/babel-plugin-add-jsx-attribute': 6.5.1_@babel+core@7.20.5
      '@svgr/babel-plugin-remove-jsx-attribute': 6.5.0_@babel+core@7.20.5
      '@svgr/babel-plugin-remove-jsx-empty-expression': 6.5.0_@babel+core@7.20.5
      '@svgr/babel-plugin-replace-jsx-attribute-value': 6.5.1_@babel+core@7.20.5
      '@svgr/babel-plugin-svg-dynamic-title': 6.5.1_@babel+core@7.20.5
      '@svgr/babel-plugin-svg-em-dimensions': 6.5.1_@babel+core@7.20.5
      '@svgr/babel-plugin-transform-react-native-svg': 6.5.1_@babel+core@7.20.5
      '@svgr/babel-plugin-transform-svg-component': 6.5.1_@babel+core@7.20.5
    dev: false

  /@svgr/core/6.5.1:
    resolution: {integrity: sha512-/xdLSWxK5QkqG524ONSjvg3V/FkNyCv538OIBdQqPNaAta3AsXj/Bd2FbvR87yMbXO2hFSWiAe/Q6IkVPDw+mw==}
    engines: {node: '>=10'}
    dependencies:
      '@babel/core': 7.20.5
      '@svgr/babel-preset': 6.5.1_@babel+core@7.20.5
      '@svgr/plugin-jsx': 6.5.1_@svgr+core@6.5.1
      camelcase: 6.3.0
      cosmiconfig: 7.1.0
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@svgr/hast-util-to-babel-ast/6.5.1:
    resolution: {integrity: sha512-1hnUxxjd83EAxbL4a0JDJoD3Dao3hmjvyvyEV8PzWmLK3B9m9NPlW7GKjFyoWE8nM7HnXzPcmmSyOW8yOddSXw==}
    engines: {node: '>=10'}
    dependencies:
      '@babel/types': 7.20.5
      entities: 4.4.0
    dev: false

  /@svgr/plugin-jsx/6.5.1_@svgr+core@6.5.1:
    resolution: {integrity: sha512-+UdQxI3jgtSjCykNSlEMuy1jSRQlGC7pqBCPvkG/2dATdWo082zHTTK3uhnAju2/6XpE6B5mZ3z4Z8Ns01S8Gw==}
    engines: {node: '>=10'}
    peerDependencies:
      '@svgr/core': ^6.0.0
    dependencies:
      '@babel/core': 7.20.5
      '@svgr/babel-preset': 6.5.1_@babel+core@7.20.5
      '@svgr/core': 6.5.1
      '@svgr/hast-util-to-babel-ast': 6.5.1
      svg-parser: 2.0.4
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@svgr/plugin-svgo/6.5.1_@svgr+core@6.5.1:
    resolution: {integrity: sha512-omvZKf8ixP9z6GWgwbtmP9qQMPX4ODXi+wzbVZgomNFsUIlHA1sf4fThdwTWSsZGgvGAG6yE+b/F5gWUkcZ/iQ==}
    engines: {node: '>=10'}
    peerDependencies:
      '@svgr/core': '*'
    dependencies:
      '@svgr/core': 6.5.1
      cosmiconfig: 7.1.0
      deepmerge: 4.2.2
      svgo: 2.8.0
    dev: false

  /@svgr/webpack/6.5.1:
    resolution: {integrity: sha512-cQ/AsnBkXPkEK8cLbv4Dm7JGXq2XrumKnL1dRpJD9rIO2fTIlJI9a1uCciYG1F2aUsox/hJQyNGbt3soDxSRkA==}
    engines: {node: '>=10'}
    dependencies:
      '@babel/core': 7.20.5
      '@babel/plugin-transform-react-constant-elements': 7.20.2_@babel+core@7.20.5
      '@babel/preset-env': 7.20.2_@babel+core@7.20.5
      '@babel/preset-react': 7.18.6_@babel+core@7.20.5
      '@babel/preset-typescript': 7.18.6_@babel+core@7.20.5
      '@svgr/core': 6.5.1
      '@svgr/plugin-jsx': 6.5.1_@svgr+core@6.5.1
      '@svgr/plugin-svgo': 6.5.1_@svgr+core@6.5.1
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@swc/helpers/0.4.11:
    resolution: {integrity: sha512-rEUrBSGIoSFuYxwBYtlUFMlE2CwGhmW+w9355/5oduSw8e5h2+Tj4UrAGNNgP9915++wj5vkQo0UuOBqOAq4nw==}
    dependencies:
      tslib: 2.4.1
    dev: false

  /@trysound/sax/0.2.0:
    resolution: {integrity: sha512-L7z9BgrNEcYyUYtF+HaEfiS5ebkh9jXqbszz7pC0hRBPaatV0XjSD3+eHrpqFemQfgwiFF0QPIarnIihIDn7OA==}
    engines: {node: '>=10.13.0'}
    dev: false

  /@tsconfig/node10/1.0.9:
    resolution: {integrity: sha512-jNsYVVxU8v5g43Erja32laIDHXeoNvFEpX33OK4d6hljo3jDhCBDhx5dhCCTMWUojscpAagGiRkBKxpdl9fxqA==}
    dev: false

  /@tsconfig/node12/1.0.11:
    resolution: {integrity: sha512-cqefuRsh12pWyGsIoBKJA9luFu3mRxCA+ORZvA4ktLSzIuCUtWVxGIuXigEwO5/ywWFMZ2QEGKWvkZG1zDMTag==}
    dev: false

  /@tsconfig/node14/1.0.3:
    resolution: {integrity: sha512-ysT8mhdixWK6Hw3i1V2AeRqZ5WfXg1G43mqoYlM2nc6388Fq5jcXyr5mRsqViLx/GJYdoL0bfXD8nmF+Zn/Iow==}
    dev: false

  /@tsconfig/node16/1.0.3:
    resolution: {integrity: sha512-yOlFc+7UtL/89t2ZhjPvvB/DeAr3r+Dq58IgzsFkOAvVC6NMJXmCGjbptdXdR9qsX7pKcTL+s87FtYREi2dEEQ==}
    dev: false

  /@types/babel__core/7.1.20:
    resolution: {integrity: sha512-PVb6Bg2QuscZ30FvOU7z4guG6c926D9YRvOxEaelzndpMsvP+YM74Q/dAFASpg2l6+XLalxSGxcq/lrgYWZtyQ==}
    dependencies:
      '@babel/parser': 7.20.5
      '@babel/types': 7.20.5
      '@types/babel__generator': 7.6.4
      '@types/babel__template': 7.4.1
      '@types/babel__traverse': 7.18.3
    dev: false

  /@types/babel__generator/7.6.4:
    resolution: {integrity: sha512-tFkciB9j2K755yrTALxD44McOrk+gfpIpvC3sxHjRawj6PfnQxrse4Clq5y/Rq+G3mrBurMax/lG8Qn2t9mSsg==}
    dependencies:
      '@babel/types': 7.20.5
    dev: false

  /@types/babel__template/7.4.1:
    resolution: {integrity: sha512-azBFKemX6kMg5Io+/rdGT0dkGreboUVR0Cdm3fz9QJWpaQGJRQXl7C+6hOTCZcMll7KFyEQpgbYI2lHdsS4U7g==}
    dependencies:
      '@babel/parser': 7.20.5
      '@babel/types': 7.20.5
    dev: false

  /@types/babel__traverse/7.18.3:
    resolution: {integrity: sha512-1kbcJ40lLB7MHsj39U4Sh1uTd2E7rLEa79kmDpI6cy+XiXsteB3POdQomoq4FxszMrO3ZYchkhYJw7A2862b3w==}
    dependencies:
      '@babel/types': 7.20.5
    dev: false

  /@types/body-parser/1.19.2:
    resolution: {integrity: sha512-ALYone6pm6QmwZoAgeyNksccT9Q4AWZQ6PvfwR37GT6r6FWUPguq6sUmNGSMV2Wr761oQoBxwGGa6DR5o1DC9g==}
    dependencies:
      '@types/connect': 3.4.35
      '@types/node': 18.11.15
    dev: false

  /@types/bonjour/3.5.10:
    resolution: {integrity: sha512-p7ienRMiS41Nu2/igbJxxLDWrSZ0WxM8UQgCeO9KhoVF7cOVFkrKsiDr1EsJIla8vV3oEEjGcz11jc5yimhzZw==}
    dependencies:
      '@types/node': 18.11.15
    dev: false

  /@types/connect-history-api-fallback/1.3.5:
    resolution: {integrity: sha512-h8QJa8xSb1WD4fpKBDcATDNGXghFj6/3GRWG6dhmRcu0RX1Ubasur2Uvx5aeEwlf0MwblEC2bMzzMQntxnw/Cw==}
    dependencies:
      '@types/express-serve-static-core': 4.17.31
      '@types/node': 18.11.15
    dev: false

  /@types/connect/3.4.35:
    resolution: {integrity: sha512-cdeYyv4KWoEgpBISTxWvqYsVy444DOqehiF3fM3ne10AmJ62RSyNkUnxMJXHQWRQQX2eR94m5y1IZyDwBjV9FQ==}
    dependencies:
      '@types/node': 18.11.15
    dev: false

  /@types/eslint-scope/3.7.4:
    resolution: {integrity: sha512-9K4zoImiZc3HlIp6AVUDE4CWYx22a+lhSZMYNpbjW04+YF0KWj4pJXnEMjdnFTiQibFFmElcsasJXDbdI/EPhA==}
    dependencies:
      '@types/eslint': 8.4.10
      '@types/estree': 0.0.51
    dev: false

  /@types/eslint/8.4.10:
    resolution: {integrity: sha512-Sl/HOqN8NKPmhWo2VBEPm0nvHnu2LL3v9vKo8MEq0EtbJ4eVzGPl41VNPvn5E1i5poMk4/XD8UriLHpJvEP/Nw==}
    dependencies:
      '@types/estree': 0.0.51
      '@types/json-schema': 7.0.11
    dev: false

  /@types/estree/0.0.51:
    resolution: {integrity: sha512-CuPgU6f3eT/XgKKPqKd/gLZV1Xmvf1a2R5POBOGQa6uv82xpls89HU5zKeVoyR8XzHd1RGNOlQlvUe3CFkjWNQ==}
    dev: false

  /@types/express-serve-static-core/4.17.31:
    resolution: {integrity: sha512-DxMhY+NAsTwMMFHBTtJFNp5qiHKJ7TeqOo23zVEM9alT1Ml27Q3xcTH0xwxn7Q0BbMcVEJOs/7aQtUWupUQN3Q==}
    dependencies:
      '@types/node': 18.11.15
      '@types/qs': 6.9.7
      '@types/range-parser': 1.2.4
    dev: false

  /@types/express/4.17.15:
    resolution: {integrity: sha512-Yv0k4bXGOH+8a+7bELd2PqHQsuiANB+A8a4gnQrkRWzrkKlb6KHaVvyXhqs04sVW/OWlbPyYxRgYlIXLfrufMQ==}
    dependencies:
      '@types/body-parser': 1.19.2
      '@types/express-serve-static-core': 4.17.31
      '@types/qs': 6.9.7
      '@types/serve-static': 1.15.0
    dev: false

  /@types/graceful-fs/4.1.5:
    resolution: {integrity: sha512-anKkLmZZ+xm4p8JWBf4hElkM4XR+EZeA2M9BAkkTldmcyDY4mbdIJnRghDJH3Ov5ooY7/UAoENtmdMSkaAd7Cw==}
    dependencies:
      '@types/node': 18.11.15
    dev: false

  /@types/http-proxy/1.17.9:
    resolution: {integrity: sha512-QsbSjA/fSk7xB+UXlCT3wHBy5ai9wOcNDWwZAtud+jXhwOM3l+EYZh8Lng4+/6n8uar0J7xILzqftJdJ/Wdfkw==}
    dependencies:
      '@types/node': 18.11.15
    dev: false

  /@types/istanbul-lib-coverage/2.0.4:
    resolution: {integrity: sha512-z/QT1XN4K4KYuslS23k62yDIDLwLFkzxOuMplDtObz0+y7VqJCaO2o+SPwHCvLFZh7xazvvoor2tA/hPz9ee7g==}
    dev: false

  /@types/istanbul-lib-report/3.0.0:
    resolution: {integrity: sha512-plGgXAPfVKFoYfa9NpYDAkseG+g6Jr294RqeqcqDixSbU34MZVJRi/P+7Y8GDpzkEwLaGZZOpKIEmeVZNtKsrg==}
    dependencies:
      '@types/istanbul-lib-coverage': 2.0.4
    dev: false

  /@types/istanbul-reports/3.0.1:
    resolution: {integrity: sha512-c3mAZEuK0lvBp8tmuL74XRKn1+y2dcwOUpH7x4WrF6gk1GIgiluDRgMYQtw2OFcBvAJWlt6ASU3tSqxp0Uu0Aw==}
    dependencies:
      '@types/istanbul-lib-report': 3.0.0
    dev: false

  /@types/json-schema/7.0.11:
    resolution: {integrity: sha512-wOuvG1SN4Us4rez+tylwwwCV1psiNVOkJeM3AUWUNWg/jDQY2+HE/444y5gc+jBmRqASOm2Oeh5c1axHobwRKQ==}
    dev: false

  /@types/json5/0.0.29:
    resolution: {integrity: sha512-dRLjCWHYg4oaA77cxO64oO+7JwCwnIzkZPdrrC71jQmQtlhM556pwKo5bUzqvZndkVbeFLIIi+9TC40JNF5hNQ==}
    dev: false

  /@types/mime/3.0.1:
    resolution: {integrity: sha512-Y4XFY5VJAuw0FgAqPNd6NNoV44jbq9Bz2L7Rh/J6jLTiHBSBJa9fxqQIvkIld4GsoDOcCbvzOUAbLPsSKKg+uA==}
    dev: false

  /@types/node/18.11.15:
    resolution: {integrity: sha512-VkhBbVo2+2oozlkdHXLrb3zjsRkpdnaU2bXmX8Wgle3PUi569eLRaHGlgETQHR7lLL1w7GiG3h9SnePhxNDecw==}
    dev: false

  /@types/parse-json/4.0.0:
    resolution: {integrity: sha512-//oorEZjL6sbPcKUaCdIGlIUeH26mgzimjBB77G6XRgnDl/L5wOnpyBGRe/Mmf5CVW3PwEBE1NjiMZ/ssFh4wA==}
    dev: false

  /@types/prettier/2.7.1:
    resolution: {integrity: sha512-ri0UmynRRvZiiUJdiz38MmIblKK+oH30MztdBVR95dv/Ubw6neWSb8u1XpRb72L4qsZOhz+L+z9JD40SJmfWow==}
    dev: false

  /@types/qs/6.9.7:
    resolution: {integrity: sha512-FGa1F62FT09qcrueBA6qYTrJPVDzah9a+493+o2PCXsesWHIn27G98TsSMs3WPNbZIEj4+VJf6saSFpvD+3Zsw==}
    dev: false

  /@types/range-parser/1.2.4:
    resolution: {integrity: sha512-EEhsLsD6UsDM1yFhAvy0Cjr6VwmpMWqFBCb9w07wVugF7w9nfajxLuVmngTIpgS6svCnm6Vaw+MZhoDCKnOfsw==}
    dev: false

  /@types/retry/0.12.0:
    resolution: {integrity: sha512-wWKOClTTiizcZhXnPY4wikVAwmdYHp8q6DmC+EJUzAMsycb7HB32Kh9RN4+0gExjmPmZSAQjgURXIGATPegAvA==}
    dev: false

  /@types/serve-index/1.9.1:
    resolution: {integrity: sha512-d/Hs3nWDxNL2xAczmOVZNj92YZCS6RGxfBPjKzuu/XirCgXdpKEb88dYNbrYGint6IVWLNP+yonwVAuRC0T2Dg==}
    dependencies:
      '@types/express': 4.17.15
    dev: false

  /@types/serve-static/1.15.0:
    resolution: {integrity: sha512-z5xyF6uh8CbjAu9760KDKsH2FcDxZ2tFCsA4HIMWE6IkiYMXfVoa+4f9KX+FN0ZLsaMw1WNG2ETLA6N+/YA+cg==}
    dependencies:
      '@types/mime': 3.0.1
      '@types/node': 18.11.15
    dev: false

  /@types/sockjs/0.3.33:
    resolution: {integrity: sha512-f0KEEe05NvUnat+boPTZ0dgaLZ4SfSouXUgv5noUiefG2ajgKjmETo9ZJyuqsl7dfl2aHlLJUiki6B4ZYldiiw==}
    dependencies:
      '@types/node': 18.11.15
    dev: false

  /@types/stack-utils/2.0.1:
    resolution: {integrity: sha512-Hl219/BT5fLAaz6NDkSuhzasy49dwQS/DSdu4MdggFB8zcXv7vflBI3xp7FEmkmdDkBUI2bPUNeMttp2knYdxw==}
    dev: false

  /@types/ws/8.5.3:
    resolution: {integrity: sha512-6YOoWjruKj1uLf3INHH7D3qTXwFfEsg1kf3c0uDdSBJwfa/llkwIjrAGV7j7mVgGNbzTQ3HiHKKDXl6bJPD97w==}
    dependencies:
      '@types/node': 18.11.15
    dev: false

  /@types/yargs-parser/21.0.0:
    resolution: {integrity: sha512-iO9ZQHkZxHn4mSakYV0vFHAVDyEOIJQrV2uZ06HxEPcx+mt8swXoZHIbaaJ2crJYFfErySgktuTZ3BeLz+XmFA==}
    dev: false

  /@types/yargs/17.0.17:
    resolution: {integrity: sha512-72bWxFKTK6uwWJAVT+3rF6Jo6RTojiJ27FQo8Rf60AL+VZbzoVPnMFhKsUnbjR8A3BTCYQ7Mv3hnl8T0A+CX9g==}
    dependencies:
      '@types/yargs-parser': 21.0.0
    dev: false

  /@webassemblyjs/ast/1.11.1:
    resolution: {integrity: sha512-ukBh14qFLjxTQNTXocdyksN5QdM28S1CxHt2rdskFyL+xFV7VremuBLVbmCePj+URalXBENx/9Lm7lnhihtCSw==}
    dependencies:
      '@webassemblyjs/helper-numbers': 1.11.1
      '@webassemblyjs/helper-wasm-bytecode': 1.11.1
    dev: false

  /@webassemblyjs/floating-point-hex-parser/1.11.1:
    resolution: {integrity: sha512-iGRfyc5Bq+NnNuX8b5hwBrRjzf0ocrJPI6GWFodBFzmFnyvrQ83SHKhmilCU/8Jv67i4GJZBMhEzltxzcNagtQ==}
    dev: false

  /@webassemblyjs/helper-api-error/1.11.1:
    resolution: {integrity: sha512-RlhS8CBCXfRUR/cwo2ho9bkheSXG0+NwooXcc3PAILALf2QLdFyj7KGsKRbVc95hZnhnERon4kW/D3SZpp6Tcg==}
    dev: false

  /@webassemblyjs/helper-buffer/1.11.1:
    resolution: {integrity: sha512-gwikF65aDNeeXa8JxXa2BAk+REjSyhrNC9ZwdT0f8jc4dQQeDQ7G4m0f2QCLPJiMTTO6wfDmRmj/pW0PsUvIcA==}
    dev: false

  /@webassemblyjs/helper-numbers/1.11.1:
    resolution: {integrity: sha512-vDkbxiB8zfnPdNK9Rajcey5C0w+QJugEglN0of+kmO8l7lDb77AnlKYQF7aarZuCrv+l0UvqL+68gSDr3k9LPQ==}
    dependencies:
      '@webassemblyjs/floating-point-hex-parser': 1.11.1
      '@webassemblyjs/helper-api-error': 1.11.1
      '@xtuc/long': 4.2.2
    dev: false

  /@webassemblyjs/helper-wasm-bytecode/1.11.1:
    resolution: {integrity: sha512-PvpoOGiJwXeTrSf/qfudJhwlvDQxFgelbMqtq52WWiXC6Xgg1IREdngmPN3bs4RoO83PnL/nFrxucXj1+BX62Q==}
    dev: false

  /@webassemblyjs/helper-wasm-section/1.11.1:
    resolution: {integrity: sha512-10P9No29rYX1j7F3EVPX3JvGPQPae+AomuSTPiF9eBQeChHI6iqjMIwR9JmOJXwpnn/oVGDk7I5IlskuMwU/pg==}
    dependencies:
      '@webassemblyjs/ast': 1.11.1
      '@webassemblyjs/helper-buffer': 1.11.1
      '@webassemblyjs/helper-wasm-bytecode': 1.11.1
      '@webassemblyjs/wasm-gen': 1.11.1
    dev: false

  /@webassemblyjs/ieee754/1.11.1:
    resolution: {integrity: sha512-hJ87QIPtAMKbFq6CGTkZYJivEwZDbQUgYd3qKSadTNOhVY7p+gfP6Sr0lLRVTaG1JjFj+r3YchoqRYxNH3M0GQ==}
    dependencies:
      '@xtuc/ieee754': 1.2.0
    dev: false

  /@webassemblyjs/leb128/1.11.1:
    resolution: {integrity: sha512-BJ2P0hNZ0u+Th1YZXJpzW6miwqQUGcIHT1G/sf72gLVD9DZ5AdYTqPNbHZh6K1M5VmKvFXwGSWZADz+qBWxeRw==}
    dependencies:
      '@xtuc/long': 4.2.2
    dev: false

  /@webassemblyjs/utf8/1.11.1:
    resolution: {integrity: sha512-9kqcxAEdMhiwQkHpkNiorZzqpGrodQQ2IGrHHxCy+Ozng0ofyMA0lTqiLkVs1uzTRejX+/O0EOT7KxqVPuXosQ==}
    dev: false

  /@webassemblyjs/wasm-edit/1.11.1:
    resolution: {integrity: sha512-g+RsupUC1aTHfR8CDgnsVRVZFJqdkFHpsHMfJuWQzWU3tvnLC07UqHICfP+4XyL2tnr1amvl1Sdp06TnYCmVkA==}
    dependencies:
      '@webassemblyjs/ast': 1.11.1
      '@webassemblyjs/helper-buffer': 1.11.1
      '@webassemblyjs/helper-wasm-bytecode': 1.11.1
      '@webassemblyjs/helper-wasm-section': 1.11.1
      '@webassemblyjs/wasm-gen': 1.11.1
      '@webassemblyjs/wasm-opt': 1.11.1
      '@webassemblyjs/wasm-parser': 1.11.1
      '@webassemblyjs/wast-printer': 1.11.1
    dev: false

  /@webassemblyjs/wasm-gen/1.11.1:
    resolution: {integrity: sha512-F7QqKXwwNlMmsulj6+O7r4mmtAlCWfO/0HdgOxSklZfQcDu0TpLiD1mRt/zF25Bk59FIjEuGAIyn5ei4yMfLhA==}
    dependencies:
      '@webassemblyjs/ast': 1.11.1
      '@webassemblyjs/helper-wasm-bytecode': 1.11.1
      '@webassemblyjs/ieee754': 1.11.1
      '@webassemblyjs/leb128': 1.11.1
      '@webassemblyjs/utf8': 1.11.1
    dev: false

  /@webassemblyjs/wasm-opt/1.11.1:
    resolution: {integrity: sha512-VqnkNqnZlU5EB64pp1l7hdm3hmQw7Vgqa0KF/KCNO9sIpI6Fk6brDEiX+iCOYrvMuBWDws0NkTOxYEb85XQHHw==}
    dependencies:
      '@webassemblyjs/ast': 1.11.1
      '@webassemblyjs/helper-buffer': 1.11.1
      '@webassemblyjs/wasm-gen': 1.11.1
      '@webassemblyjs/wasm-parser': 1.11.1
    dev: false

  /@webassemblyjs/wasm-parser/1.11.1:
    resolution: {integrity: sha512-rrBujw+dJu32gYB7/Lup6UhdkPx9S9SnobZzRVL7VcBH9Bt9bCBLEuX/YXOOtBsOZ4NQrRykKhffRWHvigQvOA==}
    dependencies:
      '@webassemblyjs/ast': 1.11.1
      '@webassemblyjs/helper-api-error': 1.11.1
      '@webassemblyjs/helper-wasm-bytecode': 1.11.1
      '@webassemblyjs/ieee754': 1.11.1
      '@webassemblyjs/leb128': 1.11.1
      '@webassemblyjs/utf8': 1.11.1
    dev: false

  /@webassemblyjs/wast-printer/1.11.1:
    resolution: {integrity: sha512-IQboUWM4eKzWW+N/jij2sRatKMh99QEelo3Eb2q0qXkvPRISAj8Qxtmw5itwqK+TTkBuUIE45AxYPToqPtL5gg==}
    dependencies:
      '@webassemblyjs/ast': 1.11.1
      '@xtuc/long': 4.2.2
    dev: false

  /@xtuc/ieee754/1.2.0:
    resolution: {integrity: sha512-DX8nKgqcGwsc0eJSqYt5lwP4DH5FlHnmuWWBRy7X0NcaGR0ZtuyeESgMwTYVEtxmsNGY+qit4QYT/MIYTOTPeA==}
    dev: false

  /@xtuc/long/4.2.2:
    resolution: {integrity: sha512-NuHqBY1PB/D8xU6s/thBgOAiAP7HOYDQ32+BFZILJ8ivkUkAHQnWfn6WhL79Owj1qmUnoN/YPhktdIoucipkAQ==}
    dev: false

  /@yarnpkg/lockfile/1.1.0:
    resolution: {integrity: sha512-GpSwvyXOcOOlV70vbnzjj4fW5xW/FdUF6nQEt1ENy7m4ZCczi1+/buVUPAqmGfqznsORNFzUMjctTIp8a9tuCQ==}
    dev: false

  /@yarnpkg/parsers/3.0.0-rc.33:
    resolution: {integrity: sha512-az35wEPH00kW6eZDqHC0BumzAB4XD+YJb1b5tHEfsy73viCN7uGy8kvutwig5bgVwt1Hx7GuU09G50Sc5osBlA==}
    engines: {node: '>=14.15.0'}
    dependencies:
      js-yaml: 3.14.1
      tslib: 2.4.1
    dev: false

  /@zkochan/js-yaml/0.0.6:
    resolution: {integrity: sha512-nzvgl3VfhcELQ8LyVrYOru+UtAy1nrygk2+AGbTm8a5YcO6o8lSjAT+pfg3vJWxIoZKOUhrK6UU7xW/+00kQrg==}
    hasBin: true
    dependencies:
      argparse: 2.0.1
    dev: false

  /abab/2.0.6:
    resolution: {integrity: sha512-j2afSsaIENvHZN2B8GOpF566vZ5WVk5opAiMTvWgaQT8DkbOqsTfvNAvHoRGU2zzP8cPoqys+xHTRDWW8L+/BA==}
    dev: false

  /accepts/1.3.8:
    resolution: {integrity: sha512-PYAthTa2m2VKxuvSD3DPC/Gy+U+sOA1LAuT8mkmRuvw+NACSaeXEQ+NHcVF7rONl6qcaxV3Uuemwawk+7+SJLw==}
    engines: {node: '>= 0.6'}
    dependencies:
      mime-types: 2.1.35
      negotiator: 0.6.3
    dev: false

  /acorn-import-assertions/1.8.0_acorn@8.8.1:
    resolution: {integrity: sha512-m7VZ3jwz4eK6A4Vtt8Ew1/mNbP24u0FhdyfA7fSvnJR6LMdfOYnmuIrrJAgrYfYJ10F/otaHTtrtrtmHdMNzEw==}
    peerDependencies:
      acorn: ^8
    dependencies:
      acorn: 8.8.1
    dev: false

  /acorn-walk/8.2.0:
    resolution: {integrity: sha512-k+iyHEuPgSw6SbuDpGQM+06HQUa04DZ3o+F6CSzXMvvI5KMvnaEqXe+YVe555R9nn6GPt404fos4wcgpw12SDA==}
    engines: {node: '>=0.4.0'}
    dev: false

  /acorn/8.8.1:
    resolution: {integrity: sha512-7zFpHzhnqYKrkYdUjF1HI1bzd0VygEGX8lFk4k5zVMqHEoES+P+7TKI+EvLO9WVMJ8eekdO0aDEK044xTXwPPA==}
    engines: {node: '>=0.4.0'}
    hasBin: true
    dev: false

  /ajv-formats/2.1.1:
    resolution: {integrity: sha512-Wx0Kx52hxE7C18hkMEggYlEifqWZtYaRgouJor+WMdPnQyEK13vgEWyVNup7SoeeoLMsr4kf5h6dOW11I15MUA==}
    peerDependenciesMeta:
      ajv:
        optional: true
    dependencies:
      ajv: 8.11.2
    dev: false

  /ajv-keywords/3.5.2_ajv@6.12.6:
    resolution: {integrity: sha512-5p6WTN0DdTGVQk6VjcEju19IgaHudalcfabD7yhDGeA6bcQnmL+CpveLJq/3hvfwd1aof6L386Ougkx6RfyMIQ==}
    peerDependencies:
      ajv: ^6.9.1
    dependencies:
      ajv: 6.12.6
    dev: false

  /ajv-keywords/5.1.0_ajv@8.11.2:
    resolution: {integrity: sha512-YCS/JNFAUyr5vAuhk1DWm1CBxRHW9LbJ2ozWeemrIqpbsqKjHVxYPyi5GC0rjZIT5JxJ3virVTS8wk4i/Z+krw==}
    peerDependencies:
      ajv: ^8.8.2
    dependencies:
      ajv: 8.11.2
      fast-deep-equal: 3.1.3
    dev: false

  /ajv/6.12.6:
    resolution: {integrity: sha512-j3fVLgvTo527anyYyJOGTYJbG+vnnQYvE0m5mmkc1TK+nxAppkCLMIL0aZ4dblVCNoGShhm+kzE4ZUykBoMg4g==}
    dependencies:
      fast-deep-equal: 3.1.3
      fast-json-stable-stringify: 2.1.0
      json-schema-traverse: 0.4.1
      uri-js: 4.4.1
    dev: false

  /ajv/8.11.2:
    resolution: {integrity: sha512-E4bfmKAhGiSTvMfL1Myyycaub+cUEU2/IvpylXkUu7CHBkBj1f/ikdzbD7YQ6FKUbixDxeYvB/xY4fvyroDlQg==}
    dependencies:
      fast-deep-equal: 3.1.3
      json-schema-traverse: 1.0.0
      require-from-string: 2.0.2
      uri-js: 4.4.1
    dev: false

  /ansi-colors/4.1.3:
    resolution: {integrity: sha512-/6w/C21Pm1A7aZitlI5Ni/2J6FFQN8i1Cvz3kHABAAbw93v/NlvKdVOqz7CCWz/3iv/JplRSEEZ83XION15ovw==}
    engines: {node: '>=6'}
    dev: false

  /ansi-escapes/4.3.2:
    resolution: {integrity: sha512-gKXj5ALrKWQLsYG9jlTRmR/xKluxHV+Z9QEwNIgCfM1/uwPMCuzVVnh5mwTd+OuBZcwSIMbqssNWRm1lE51QaQ==}
    engines: {node: '>=8'}
    dependencies:
      type-fest: 0.21.3
    dev: false

  /ansi-html-community/0.0.8:
    resolution: {integrity: sha512-1APHAyr3+PCamwNw3bXCPp4HFLONZt/yIH0sZp0/469KWNTEy+qN5jQ3GVX6DMZ1UXAi34yVwtTeaG/HpBuuzw==}
    engines: {'0': node >= 0.8.0}
    hasBin: true
    dev: false

  /ansi-regex/5.0.1:
    resolution: {integrity: sha512-quJQXlTSUGL2LH9SUXo8VwsY4soanhgo6LNSm84E1LBcE8s3O0wpdiRzyR9z/ZZJMlMWv37qOOb9pdJlMUEKFQ==}
    engines: {node: '>=8'}
    dev: false

  /ansi-styles/3.2.1:
    resolution: {integrity: sha512-VT0ZI6kZRdTh8YyJw3SMbYm/u+NqfsAxEpWO0Pf9sq8/e94WxxOpPKx9FR1FlyCtOVDNOQ+8ntlqFxiRc+r5qA==}
    engines: {node: '>=4'}
    dependencies:
      color-convert: 1.9.3
    dev: false

  /ansi-styles/4.3.0:
    resolution: {integrity: sha512-zbB9rCJAT1rbjiVDb2hqKFHNYLxgtk8NURxZ3IZwD3F6NtxbXZQCnnSi1Lkx+IDohdPlFp222wVALIheZJQSEg==}
    engines: {node: '>=8'}
    dependencies:
      color-convert: 2.0.1
    dev: false

  /ansi-styles/5.2.0:
    resolution: {integrity: sha512-Cxwpt2SfTzTtXcfOlzGEee8O+c+MmUgGrNiBcXnuWxuFJHe6a5Hz7qwhwe5OgaSYI0IJvkLqWX1ASG+cJOkEiA==}
    engines: {node: '>=10'}
    dev: false

  /anymatch/3.1.3:
    resolution: {integrity: sha512-KMReFUr0B4t+D+OBkjR3KYqvocp2XaSzO55UcB6mgQMd3KbcE+mWTyvVV7D/zsdEbNnV6acZUutkiHQXvTr1Rw==}
    engines: {node: '>= 8'}
    dependencies:
      normalize-path: 3.0.0
      picomatch: 2.3.1
    dev: false

  /arg/4.1.3:
    resolution: {integrity: sha512-58S9QDqG0Xx27YwPSt9fJxivjYl432YCwfDMfZ+71RAqUrZef7LrKQZ3LHLOwCS4FLNBplP533Zx895SeOCHvA==}
    dev: false

  /argparse/1.0.10:
    resolution: {integrity: sha512-o5Roy6tNG4SL/FOkCAN6RzjiakZS25RLYFrcMttJqbdd8BWrnA+fGz57iN5Pb06pvBGvl5gQ0B48dJlslXvoTg==}
    dependencies:
      sprintf-js: 1.0.3
    dev: false

  /argparse/2.0.1:
    resolution: {integrity: sha512-8+9WqebbFzpX9OR+Wa6O29asIogeRMzcGtAINdpMHHyAg10f05aSFVBbcEqGf/PXw1EjAZ+q2/bEBg3DvurK3Q==}
    dev: false

  /array-flatten/1.1.1:
    resolution: {integrity: sha512-PCVAQswWemu6UdxsDFFX/+gVeYqKAod3D3UVm91jHwynguOwAvYPhx8nNlM++NqRcK6CxxpUafjmhIdKiHibqg==}
    dev: false

  /array-flatten/2.1.2:
    resolution: {integrity: sha512-hNfzcOV8W4NdualtqBFPyVO+54DSJuZGY9qT4pRroB6S9e3iiido2ISIC5h9R2sPJ8H3FHCIiEnsv1lPXO3KtQ==}
    dev: false

  /array-union/3.0.1:
    resolution: {integrity: sha512-1OvF9IbWwaeiM9VhzYXVQacMibxpXOMYVNIvMtKRyX9SImBXpKcFr8XvFDeEslCyuH/t6KRt7HEO94AlP8Iatw==}
    engines: {node: '>=12'}
    dev: false

  /async/3.2.4:
    resolution: {integrity: sha512-iAB+JbDEGXhyIUavoDl9WP/Jj106Kz9DEn1DPgYw5ruDn0e3Wgi3sKFm55sASdGBNOQB8F59d9qQ7deqrHA8wQ==}
    dev: false

  /asynckit/0.4.0:
    resolution: {integrity: sha512-Oei9OH4tRh0YqU3GxhX79dM/mwVgvbZJaSNaRk+bshkj0S5cfHcgYakreBjrHwatXKbz+IoIdYLxrKim2MjW0Q==}
    dev: false

  /atob/2.1.2:
    resolution: {integrity: sha512-Wm6ukoaOGJi/73p/cl2GvLjTI5JM1k/O14isD73YML8StrH/7/lRFgmg8nICZgD3bZZvjwCGxtMOD3wWNAu8cg==}
    engines: {node: '>= 4.5.0'}
    hasBin: true
    dev: false

  /autoprefixer/10.4.13_postcss@8.4.20:
    resolution: {integrity: sha512-49vKpMqcZYsJjwotvt4+h/BCjJVnhGwcLpDt5xkcaOG3eLrG/HUYLagrihYsQ+qrIBgIzX1Rw7a6L8I/ZA1Atg==}
    engines: {node: ^10 || ^12 || >=14}
    hasBin: true
    peerDependencies:
      postcss: ^8.1.0
    dependencies:
      browserslist: 4.21.4
      caniuse-lite: 1.0.30001439
      fraction.js: 4.2.0
      normalize-range: 0.1.2
      picocolors: 1.0.0
      postcss: 8.4.20
      postcss-value-parser: 4.2.0
    dev: false

  /axios/1.2.1:
    resolution: {integrity: sha512-I88cFiGu9ryt/tfVEi4kX2SITsvDddTajXTOFmt2uK1ZVA8LytjtdeyefdQWEf5PU8w+4SSJDoYnggflB5tW4A==}
    dependencies:
      follow-redirects: 1.15.2
      form-data: 4.0.0
      proxy-from-env: 1.1.0
    transitivePeerDependencies:
      - debug
    dev: false

  /babel-jest/28.1.3_@babel+core@7.20.5:
    resolution: {integrity: sha512-epUaPOEWMk3cWX0M/sPvCHHCe9fMFAa/9hXEgKP8nFfNl/jlGkE9ucq9NqkZGXLDduCJYS0UvSlPUwC0S+rH6Q==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    peerDependencies:
      '@babel/core': ^7.8.0
    dependencies:
      '@babel/core': 7.20.5
      '@jest/transform': 28.1.3
      '@types/babel__core': 7.1.20
      babel-plugin-istanbul: 6.1.1
      babel-preset-jest: 28.1.3_@babel+core@7.20.5
      chalk: 4.1.2
      graceful-fs: 4.2.10
      slash: 3.0.0
    transitivePeerDependencies:
      - supports-color
    dev: false

  /babel-loader/8.3.0_webpack@5.75.0:
    resolution: {integrity: sha512-H8SvsMF+m9t15HNLMipppzkC+Y2Yq+v3SonZyU70RBL/h1gxPkH08Ot8pEE9Z4Kd+czyWJClmFS8qzIP9OZ04Q==}
    engines: {node: '>= 8.9'}
    peerDependencies:
      '@babel/core': ^7.0.0
      webpack: '>=2'
    dependencies:
      find-cache-dir: 3.3.2
      loader-utils: 2.0.4
      make-dir: 3.1.0
      schema-utils: 2.7.1
      webpack: 5.75.0
    dev: false

  /babel-loader/8.3.0_ztqwsvkb6z73luspkai6ilstpu:
    resolution: {integrity: sha512-H8SvsMF+m9t15HNLMipppzkC+Y2Yq+v3SonZyU70RBL/h1gxPkH08Ot8pEE9Z4Kd+czyWJClmFS8qzIP9OZ04Q==}
    engines: {node: '>= 8.9'}
    peerDependencies:
      '@babel/core': ^7.0.0
      webpack: '>=2'
    dependencies:
      '@babel/core': 7.20.5
      find-cache-dir: 3.3.2
      loader-utils: 2.0.4
      make-dir: 3.1.0
      schema-utils: 2.7.1
      webpack: 5.75.0
    dev: false

  /babel-plugin-istanbul/6.1.1:
    resolution: {integrity: sha512-Y1IQok9821cC9onCx5otgFfRm7Lm+I+wwxOx738M/WLPZ9Q42m4IG5W0FNX8WLL2gYMZo3JkuXIH2DOpWM+qwA==}
    engines: {node: '>=8'}
    dependencies:
      '@babel/helper-plugin-utils': 7.20.2
      '@istanbuljs/load-nyc-config': 1.1.0
      '@istanbuljs/schema': 0.1.3
      istanbul-lib-instrument: 5.2.1
      test-exclude: 6.0.0
    transitivePeerDependencies:
      - supports-color
    dev: false

  /babel-plugin-jest-hoist/28.1.3:
    resolution: {integrity: sha512-Ys3tUKAmfnkRUpPdpa98eYrAR0nV+sSFUZZEGuQ2EbFd1y4SOLtD5QDNHAq+bb9a+bbXvYQC4b+ID/THIMcU6Q==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      '@babel/template': 7.18.10
      '@babel/types': 7.20.5
      '@types/babel__core': 7.1.20
      '@types/babel__traverse': 7.18.3
    dev: false

  /babel-plugin-polyfill-corejs2/0.3.3_@babel+core@7.20.5:
    resolution: {integrity: sha512-8hOdmFYFSZhqg2C/JgLUQ+t52o5nirNwaWM2B9LWteozwIvM14VSwdsCAUET10qT+kmySAlseadmfeeSWFCy+Q==}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/compat-data': 7.20.5
      '@babel/core': 7.20.5
      '@babel/helper-define-polyfill-provider': 0.3.3_@babel+core@7.20.5
      semver: 6.3.0
    transitivePeerDependencies:
      - supports-color
    dev: false

  /babel-plugin-polyfill-corejs3/0.6.0_@babel+core@7.20.5:
    resolution: {integrity: sha512-+eHqR6OPcBhJOGgsIar7xoAB1GcSwVUA3XjAd7HJNzOXT4wv6/H7KIdA/Nc60cvUlDbKApmqNvD1B1bzOt4nyA==}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-define-polyfill-provider': 0.3.3_@babel+core@7.20.5
      core-js-compat: 3.26.1
    transitivePeerDependencies:
      - supports-color
    dev: false

  /babel-plugin-polyfill-regenerator/0.4.1_@babel+core@7.20.5:
    resolution: {integrity: sha512-NtQGmyQDXjQqQ+IzRkBVwEOz9lQ4zxAQZgoAYEtU9dJjnl1Oc98qnN7jcp+bE7O7aYzVpavXE3/VKXNzUbh7aw==}
    peerDependencies:
      '@babel/core': ^7.0.0-0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/helper-define-polyfill-provider': 0.3.3_@babel+core@7.20.5
    transitivePeerDependencies:
      - supports-color
    dev: false

  /babel-preset-current-node-syntax/1.0.1_@babel+core@7.20.5:
    resolution: {integrity: sha512-M7LQ0bxarkxQoN+vz5aJPsLBn77n8QgTFmo8WK0/44auK2xlCXrYcUxHFxgU7qW5Yzw/CjmLRK2uJzaCd7LvqQ==}
    peerDependencies:
      '@babel/core': ^7.0.0
    dependencies:
      '@babel/core': 7.20.5
      '@babel/plugin-syntax-async-generators': 7.8.4_@babel+core@7.20.5
      '@babel/plugin-syntax-bigint': 7.8.3_@babel+core@7.20.5
      '@babel/plugin-syntax-class-properties': 7.12.13_@babel+core@7.20.5
      '@babel/plugin-syntax-import-meta': 7.10.4_@babel+core@7.20.5
      '@babel/plugin-syntax-json-strings': 7.8.3_@babel+core@7.20.5
      '@babel/plugin-syntax-logical-assignment-operators': 7.10.4_@babel+core@7.20.5
      '@babel/plugin-syntax-nullish-coalescing-operator': 7.8.3_@babel+core@7.20.5
      '@babel/plugin-syntax-numeric-separator': 7.10.4_@babel+core@7.20.5
      '@babel/plugin-syntax-object-rest-spread': 7.8.3_@babel+core@7.20.5
      '@babel/plugin-syntax-optional-catch-binding': 7.8.3_@babel+core@7.20.5
      '@babel/plugin-syntax-optional-chaining': 7.8.3_@babel+core@7.20.5
      '@babel/plugin-syntax-top-level-await': 7.14.5_@babel+core@7.20.5
    dev: false

  /babel-preset-jest/28.1.3_@babel+core@7.20.5:
    resolution: {integrity: sha512-L+fupJvlWAHbQfn74coNX3zf60LXMJsezNvvx8eIh7iOR1luJ1poxYgQk1F8PYtNq/6QODDHCqsSnTFSWC491A==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    peerDependencies:
      '@babel/core': ^7.0.0
    dependencies:
      '@babel/core': 7.20.5
      babel-plugin-jest-hoist: 28.1.3
      babel-preset-current-node-syntax: 1.0.1_@babel+core@7.20.5
    dev: false

  /balanced-match/1.0.2:
    resolution: {integrity: sha512-3oSeUO0TMV67hN1AmbXsK4yaqU7tjiHlbxRDZOpH0KW9+CeX4bRAaX0Anxt0tx2MrpRpWwQaPwIlISEJhYU5Pw==}
    dev: false

  /base64-js/1.5.1:
    resolution: {integrity: sha512-AKpaYlHn8t4SVbOHCy+b5+KKgvR4vrsD8vbvrbiQJps7fKDTkjkDry6ji0rUJjC0kzbNePLwzxq8iypo41qeWA==}
    dev: false

  /batch/0.6.1:
    resolution: {integrity: sha512-x+VAiMRL6UPkx+kudNvxTl6hB2XNNCG2r+7wixVfIYwu/2HKRXimwQyaumLjMveWvT2Hkd/cAJw+QBMfJ/EKVw==}
    dev: false

  /big.js/5.2.2:
    resolution: {integrity: sha512-vyL2OymJxmarO8gxMr0mhChsO9QGwhynfuu4+MHTAW6czfq9humCB7rKpUjDd9YUiDPU4mzpyupFSvOClAwbmQ==}
    dev: false

  /binary-extensions/2.2.0:
    resolution: {integrity: sha512-jDctJ/IVQbZoJykoeHbhXpOlNBqGNcwXJKJog42E5HDPUwQTSdjCHdihjj0DlnheQ7blbT6dHOafNAiS8ooQKA==}
    engines: {node: '>=8'}
    dev: false

  /bl/4.1.0:
    resolution: {integrity: sha512-1W07cM9gS6DcLperZfFSj+bWLtaPGSOHWhPiGzXmvVJbRLdG82sH/Kn8EtW1VqWVA54AKf2h5k5BbnIbwF3h6w==}
    dependencies:
      buffer: 5.7.1
      inherits: 2.0.4
      readable-stream: 3.6.0
    dev: false

  /bluebird/3.7.1:
    resolution: {integrity: sha512-DdmyoGCleJnkbp3nkbxTLJ18rjDsE4yCggEwKNXkeV123sPNfOCYeDoeuOY+F2FrSjO1YXcTU+dsy96KMy+gcg==}
    dev: false

  /body-parser/1.20.1:
    resolution: {integrity: sha512-jWi7abTbYwajOytWCQc37VulmWiRae5RyTpaCyDcS5/lMdtwSz5lOpDE67srw/HYe35f1z3fDQw+3txg7gNtWw==}
    engines: {node: '>= 0.8', npm: 1.2.8000 || >= 1.4.16}
    dependencies:
      bytes: 3.1.2
      content-type: 1.0.4
      debug: 2.6.9
      depd: 2.0.0
      destroy: 1.2.0
      http-errors: 2.0.0
      iconv-lite: 0.4.24
      on-finished: 2.4.1
      qs: 6.11.0
      raw-body: 2.5.1
      type-is: 1.6.18
      unpipe: 1.0.0
    transitivePeerDependencies:
      - supports-color
    dev: false

  /bonjour-service/1.0.14:
    resolution: {integrity: sha512-HIMbgLnk1Vqvs6B4Wq5ep7mxvj9sGz5d1JJyDNSGNIdA/w2MCz6GTjWTdjqOJV1bEPj+6IkxDvWNFKEBxNt4kQ==}
    dependencies:
      array-flatten: 2.1.2
      dns-equal: 1.0.0
      fast-deep-equal: 3.1.3
      multicast-dns: 7.2.5
    dev: false

  /boolbase/1.0.0:
    resolution: {integrity: sha512-JZOSA7Mo9sNGB8+UjSgzdLtokWAky1zbztM3WRLCbZ70/3cTANmQmOdR7y2g+J0e2WXywy1yS468tY+IruqEww==}
    dev: false

  /brace-expansion/1.1.11:
    resolution: {integrity: sha512-iCuPHDFgrHX7H2vEI/5xpz07zSHB00TpugqhmYtVmMO6518mCuRMoOYFldEBl0g187ufozdaHgWKcYFb61qGiA==}
    dependencies:
      balanced-match: 1.0.2
      concat-map: 0.0.1
    dev: false

  /brace-expansion/2.0.1:
    resolution: {integrity: sha512-XnAIvQ8eM+kC6aULx6wuQiwVsnzsi9d3WxzV3FpWTGA19F621kwdbsAcFKXgKUHZWsy+mY6iL1sHTxWEFCytDA==}
    dependencies:
      balanced-match: 1.0.2
    dev: false

  /braces/3.0.2:
    resolution: {integrity: sha512-b8um+L1RzM3WDSzvhm6gIz1yfTbBt6YTlcEKAvsmqCZZFw46z626lVj9j1yEPW33H5H+lBQpZMP1k8l+78Ha0A==}
    engines: {node: '>=8'}
    dependencies:
      fill-range: 7.0.1
    dev: false

  /browserslist/4.21.4:
    resolution: {integrity: sha512-CBHJJdDmgjl3daYjN5Cp5kbTf1mUhZoS+beLklHIvkOWscs83YAhLlF3Wsh/lciQYAcbBJgTOD44VtG31ZM4Hw==}
    engines: {node: ^6 || ^7 || ^8 || ^9 || ^10 || ^11 || ^12 || >=13.7}
    hasBin: true
    dependencies:
      caniuse-lite: 1.0.30001439
      electron-to-chromium: 1.4.284
      node-releases: 2.0.7
      update-browserslist-db: 1.0.10_browserslist@4.21.4
    dev: false

  /bser/2.1.1:
    resolution: {integrity: sha512-gQxTNE/GAfIIrmHLUE3oJyp5FO6HRBfhjnw4/wMmA63ZGDJnWBmgY/lyQBpnDUkGmAhbSe39tx2d/iTOAfglwQ==}
    dependencies:
      node-int64: 0.4.0
    dev: false

  /buffer-from/1.1.2:
    resolution: {integrity: sha512-E+XQCRwSbaaiChtv6k6Dwgc+bx+Bs6vuKJHHl5kox/BaKbhiXzqQOwK4cO22yElGp2OCmjwVhT3HmxgyPGnJfQ==}
    dev: false

  /buffer/5.7.1:
    resolution: {integrity: sha512-EHcyIPBQ4BSGlvjB16k5KgAJ27CIsHY/2JBmCRReo48y9rQ3MaUzWX3KVlBa4U7MyX02HdVj0K7C3WaB3ju7FQ==}
    dependencies:
      base64-js: 1.5.1
      ieee754: 1.2.1
    dev: false

  /bytes/3.0.0:
    resolution: {integrity: sha512-pMhOfFDPiv9t5jjIXkHosWmkSyQbvsgEVNkz0ERHbuLh2T/7j4Mqqpz523Fe8MVY89KC6Sh/QfS2sM+SjgFDcw==}
    engines: {node: '>= 0.8'}
    dev: false

  /bytes/3.1.2:
    resolution: {integrity: sha512-/Nf7TyzTx6S3yRJObOAV7956r8cr2+Oj8AC5dt8wSP3BQAoeX58NoHyCU8P8zGkNXStjTSi6fzO6F0pBdcYbEg==}
    engines: {node: '>= 0.8'}
    dev: false

  /call-bind/1.0.2:
    resolution: {integrity: sha512-7O+FbCihrB5WGbFYesctwmTKae6rOiIzmz1icreWJ+0aA7LJfuqhEso2T9ncpcFtzMQtzXf2QGGueWJGTYsqrA==}
    dependencies:
      function-bind: 1.1.1
      get-intrinsic: 1.1.3
    dev: false

  /callsites/3.1.0:
    resolution: {integrity: sha512-P8BjAsXvZS+VIDUI11hHCQEv74YT67YUi5JJFNWIqL235sBmjX4+qx9Muvls5ivyNENctx46xQLQ3aTuE7ssaQ==}
    engines: {node: '>=6'}
    dev: false

  /camelcase/5.3.1:
    resolution: {integrity: sha512-L28STB170nwWS63UjtlEOE3dldQApaJXZkOI1uMFfzf3rRuPegHaHesyee+YxQ+W6SvRDQV6UrdOdRiR153wJg==}
    engines: {node: '>=6'}
    dev: false

  /camelcase/6.3.0:
    resolution: {integrity: sha512-Gmy6FhYlCY7uOElZUSbxo2UCDH8owEk996gkbrpsgGtrJLM3J7jGxl9Ic7Qwwj4ivOE5AWZWRMecDdF7hqGjFA==}
    engines: {node: '>=10'}
    dev: false

  /caniuse-api/3.0.0:
    resolution: {integrity: sha512-bsTwuIg/BZZK/vreVTYYbSWoe2F+71P7K5QGEX+pT250DZbfU1MQ5prOKpPR+LL6uWKK3KMwMCAS74QB3Um1uw==}
    dependencies:
      browserslist: 4.21.4
      caniuse-lite: 1.0.30001439
      lodash.memoize: 4.1.2
      lodash.uniq: 4.5.0
    dev: false

  /caniuse-lite/1.0.30001439:
    resolution: {integrity: sha512-1MgUzEkoMO6gKfXflStpYgZDlFM7M/ck/bgfVCACO5vnAf0fXoNVHdWtqGU+MYca+4bL9Z5bpOVmR33cWW9G2A==}
    dev: false

  /chalk/2.4.2:
    resolution: {integrity: sha512-Mti+f9lpJNcwF4tWV8/OrTTtF1gZi+f8FqlyAdouralcFWFQWF2+NgCHShjkCb+IFBLq9buZwE1xckQU4peSuQ==}
    engines: {node: '>=4'}
    dependencies:
      ansi-styles: 3.2.1
      escape-string-regexp: 1.0.5
      supports-color: 5.5.0
    dev: false

  /chalk/4.1.0:
    resolution: {integrity: sha512-qwx12AxXe2Q5xQ43Ac//I6v5aXTipYrSESdOgzrN+9XjgEpyjpKuvSGaN4qE93f7TQTlerQQ8S+EQ0EyDoVL1A==}
    engines: {node: '>=10'}
    dependencies:
      ansi-styles: 4.3.0
      supports-color: 7.2.0
    dev: false

  /chalk/4.1.2:
    resolution: {integrity: sha512-oKnbhFyRIXpUuez8iBMmyEa4nbj4IOQyuhc/wy9kY7/WVPcwIO9VA668Pu8RkO7+0G76SLROeyw9CpQ061i4mA==}
    engines: {node: '>=10'}
    dependencies:
      ansi-styles: 4.3.0
      supports-color: 7.2.0
    dev: false

  /char-regex/1.0.2:
    resolution: {integrity: sha512-kWWXztvZ5SBQV+eRgKFeh8q5sLuZY2+8WUIzlxWVTg+oGwY14qylx1KbKzHd8P6ZYkAg0xyIDU9JMHhyJMZ1jw==}
    engines: {node: '>=10'}
    dev: false

  /charenc/0.0.2:
    resolution: {integrity: sha512-yrLQ/yVUFXkzg7EDQsPieE/53+0RlaWTs+wBrvW36cyilJ2SaDWfl4Yj7MtLTXleV9uEKefbAGUPv2/iWSooRA==}
    dev: false

  /chokidar/3.5.3:
    resolution: {integrity: sha512-Dr3sfKRP6oTcjf2JmUmFJfeVMvXBdegxB0iVQ5eb2V10uFJUCAS8OByZdVAyVb8xXNz3GjjTgj9kLWsZTqE6kw==}
    engines: {node: '>= 8.10.0'}
    dependencies:
      anymatch: 3.1.3
      braces: 3.0.2
      glob-parent: 5.1.2
      is-binary-path: 2.1.0
      is-glob: 4.0.3
      normalize-path: 3.0.0
      readdirp: 3.6.0
    optionalDependencies:
      fsevents: 2.3.2
    dev: false

  /chrome-trace-event/1.0.3:
    resolution: {integrity: sha512-p3KULyQg4S7NIHixdwbGX+nFHkoBiA4YQmyWtjb8XngSKV124nJmRysgAeujbUVb15vh+RvFUfCPqU7rXk+hZg==}
    engines: {node: '>=6.0'}
    dev: false

  /ci-info/3.7.0:
    resolution: {integrity: sha512-2CpRNYmImPx+RXKLq6jko/L07phmS9I02TyqkcNU20GCF/GgaWvc58hPtjxDX8lPpkdwc9sNh72V9k00S7ezog==}
    engines: {node: '>=8'}
    dev: false

  /cjs-module-lexer/1.2.2:
    resolution: {integrity: sha512-cOU9usZw8/dXIXKtwa8pM0OTJQuJkxMN6w30csNRUerHfeQ5R6U3kkU/FtJeIf3M202OHfY2U8ccInBG7/xogA==}
    dev: false

  /cli-cursor/3.1.0:
    resolution: {integrity: sha512-I/zHAwsKf9FqGoXM4WWRACob9+SNukZTd94DWF57E4toouRulbCxcUh6RKUEOQlYTHJnzkPMySvPNaaSLNfLZw==}
    engines: {node: '>=8'}
    dependencies:
      restore-cursor: 3.1.0
    dev: false

  /cli-spinners/2.6.1:
    resolution: {integrity: sha512-x/5fWmGMnbKQAaNwN+UZlV79qBLM9JFnJuJ03gIi5whrob0xV0ofNVHy9DhwGdsMJQc2OKv0oGmLzvaqvAVv+g==}
    engines: {node: '>=6'}
    dev: false

  /client-only/0.0.1:
    resolution: {integrity: sha512-IV3Ou0jSMzZrd3pZ48nLkT9DA7Ag1pnPzaiQhpW7c3RbcqqzvzzVu+L8gfqMp/8IM2MQtSiqaCxrrcfu8I8rMA==}
    dev: false

  /cliui/7.0.4:
    resolution: {integrity: sha512-OcRE68cOsVMXp1Yvonl/fzkQOyjLSu/8bhPDfQt0e0/Eb283TKP20Fs2MqoPsr9SwA595rRCA+QMzYc9nBP+JQ==}
    dependencies:
      string-width: 4.2.3
      strip-ansi: 6.0.1
      wrap-ansi: 7.0.0
    dev: false

  /cliui/8.0.1:
    resolution: {integrity: sha512-BSeNnyus75C4//NQ9gQt1/csTXyo/8Sb+afLAkzAptFuMsod9HFokGNudZpi/oQV73hnVK+sR+5PVRMd+Dr7YQ==}
    engines: {node: '>=12'}
    dependencies:
      string-width: 4.2.3
      strip-ansi: 6.0.1
      wrap-ansi: 7.0.0
    dev: false

  /clone-deep/4.0.1:
    resolution: {integrity: sha512-neHB9xuzh/wk0dIHweyAXv2aPGZIVk3pLMe+/RNzINf17fe0OG96QroktYAUm7SM1PBnzTabaLboqqxDyMU+SQ==}
    engines: {node: '>=6'}
    dependencies:
      is-plain-object: 2.0.4
      kind-of: 6.0.3
      shallow-clone: 3.0.1
    dev: false

  /co/4.6.0:
    resolution: {integrity: sha512-QVb0dM5HvG+uaxitm8wONl7jltx8dqhfU33DcqtOZcLSVIKSDDLDi7+0LbAKiyI8hD9u42m2YxXSkMGWThaecQ==}
    engines: {iojs: '>= 1.0.0', node: '>= 0.12.0'}
    dev: false

  /collect-v8-coverage/1.0.1:
    resolution: {integrity: sha512-iBPtljfCNcTKNAto0KEtDfZ3qzjJvqE3aTGZsbhjSBlorqpXJlaWWtPO35D+ZImoC3KWejX64o+yPGxhWSTzfg==}
    dev: false

  /color-convert/1.9.3:
    resolution: {integrity: sha512-QfAUtd+vFdAtFQcC8CCyYt1fYWxSqAiK2cSD6zDB8N3cpsEBAvRxp9zOGg6G/SHHJYAT88/az/IuDGALsNVbGg==}
    dependencies:
      color-name: 1.1.3
    dev: false

  /color-convert/2.0.1:
    resolution: {integrity: sha512-RRECPsj7iu/xb5oKYcsFHSppFNnsj/52OVTRKb4zP5onXwVF3zVmmToNcOfGC+CRDpfK/U584fMg38ZHCaElKQ==}
    engines: {node: '>=7.0.0'}
    dependencies:
      color-name: 1.1.4
    dev: false

  /color-name/1.1.3:
    resolution: {integrity: sha512-72fSenhMw2HZMTVHeCA9KCmpEIbzWiQsjN+BHcBbS9vr1mtt+vJjPdksIBNUmKAW8TFUDPJK5SUU3QhE9NEXDw==}
    dev: false

  /color-name/1.1.4:
    resolution: {integrity: sha512-dOy+3AuW3a2wNbZHIuMZpTcgjGuLU/uBL/ubcZF9OXbDo8ff4O8yVp5Bf0efS8uEoYo5q4Fx7dY9OgQGXgAsQA==}
    dev: false

  /colord/2.9.3:
    resolution: {integrity: sha512-jeC1axXpnb0/2nn/Y1LPuLdgXBLH7aDcHu4KEKfqw3CUhX7ZpfBSlPKyqXE6btIgEzfWtrX3/tyBCaCvXvMkOw==}
    dev: false

  /colorette/2.0.19:
    resolution: {integrity: sha512-3tlv/dIP7FWvj3BsbHrGLJ6l/oKh1O3TcgBqMn+yyCagOxc23fyzDS6HypQbgxWbkpDnf52p1LuR4eWDQ/K9WQ==}
    dev: false

  /combined-stream/1.0.8:
    resolution: {integrity: sha512-FQN4MRfuJeHf7cBbBMJFXhKSDq+2kAArBlmRBvcvFE5BB1HZKXtSFASDhdlz9zOYwxh8lDdnvmMOe/+5cdoEdg==}
    engines: {node: '>= 0.8'}
    dependencies:
      delayed-stream: 1.0.0
    dev: false

  /commander/2.20.3:
    resolution: {integrity: sha512-GpVkmM8vF2vQUkj2LvZmD35JxeJOLCwJ9cUkugyk2nuhbv3+mJvpLYYt+0+USMxE+oj+ey/lJEnhZw75x/OMcQ==}
    dev: false

  /commander/7.2.0:
    resolution: {integrity: sha512-QrWXB+ZQSVPmIWIhtEO9H+gwHaMGYiF5ChvoJ+K9ZGHG/sVsa6yiesAD1GC/x46sET00Xlwo1u49RVVVzvcSkw==}
    engines: {node: '>= 10'}
    dev: false

  /commondir/1.0.1:
    resolution: {integrity: sha512-W9pAhw0ja1Edb5GVdIF1mjZw/ASI0AlShXM83UUGe2DVr5TdAPEA1OA8m/g8zWp9x6On7gqufY+FatDbC3MDQg==}
    dev: false

  /compressible/2.0.18:
    resolution: {integrity: sha512-AF3r7P5dWxL8MxyITRMlORQNaOA2IkAFaTr4k7BUumjPtRpGDTZpl0Pb1XCO6JeDCBdp126Cgs9sMxqSjgYyRg==}
    engines: {node: '>= 0.6'}
    dependencies:
      mime-db: 1.52.0
    dev: false

  /compression/1.7.4:
    resolution: {integrity: sha512-jaSIDzP9pZVS4ZfQ+TzvtiWhdpFhE2RDHz8QJkpX9SIpLq88VueF5jJw6t+6CUQcAoA6t+x89MLrWAqpfDE8iQ==}
    engines: {node: '>= 0.8.0'}
    dependencies:
      accepts: 1.3.8
      bytes: 3.0.0
      compressible: 2.0.18
      debug: 2.6.9
      on-headers: 1.0.2
      safe-buffer: 5.1.2
      vary: 1.1.2
    transitivePeerDependencies:
      - supports-color
    dev: false

  /concat-map/0.0.1:
    resolution: {integrity: sha512-/Srv4dswyQNBfohGpz9o6Yb3Gz3SrUDqBH5rTuhGR7ahtlbYKnVxw2bCFMRljaA7EXHaXZ8wsHdodFvbkhKmqg==}
    dev: false

  /connect-history-api-fallback/2.0.0:
    resolution: {integrity: sha512-U73+6lQFmfiNPrYbXqr6kZ1i1wiRqXnp2nhMsINseWXO8lDau0LGEffJ8kQi4EjLZympVgRdvqjAgiZ1tgzDDA==}
    engines: {node: '>=0.8'}
    dev: false

  /content-disposition/0.5.4:
    resolution: {integrity: sha512-FveZTNuGw04cxlAiWbzi6zTAL/lhehaWbTtgluJh4/E95DqMwTmha3KZN1aAWA8cFIhHzMZUvLevkw5Rqk+tSQ==}
    engines: {node: '>= 0.6'}
    dependencies:
      safe-buffer: 5.2.1
    dev: false

  /content-type/1.0.4:
    resolution: {integrity: sha512-hIP3EEPs8tB9AT1L+NUqtwOAps4mk2Zob89MWXMHjHWg9milF/j4osnnQLXBCBFBk/tvIG/tUc9mOUJiPBhPXA==}
    engines: {node: '>= 0.6'}
    dev: false

  /convert-source-map/1.9.0:
    resolution: {integrity: sha512-ASFBup0Mz1uyiIjANan1jzLQami9z1PoYSZCiiYW2FczPbenXc45FZdBZLzOT+r6+iciuEModtmCti+hjaAk0A==}
    dev: false

  /cookie-signature/1.0.6:
    resolution: {integrity: sha512-QADzlaHc8icV8I7vbaJXJwod9HWYp8uCqf1xa4OfNu1T7JVxQIrUgOWtHdNDtPiywmFbiS12VjotIXLrKM3orQ==}
    dev: false

  /cookie/0.5.0:
    resolution: {integrity: sha512-YZ3GUyn/o8gfKJlnlX7g7xq4gyO6OSuhGPKaaGssGB2qgDUS0gPgtTvoyZLTt9Ab6dC4hfc9dV5arkvc/OCmrw==}
    engines: {node: '>= 0.6'}
    dev: false

  /copy-webpack-plugin/10.2.4_webpack@5.75.0:
    resolution: {integrity: sha512-xFVltahqlsRcyyJqQbDY6EYTtyQZF9rf+JPjwHObLdPFMEISqkFkr7mFoVOC6BfYS/dNThyoQKvziugm+OnwBg==}
    engines: {node: '>= 12.20.0'}
    peerDependencies:
      webpack: ^5.1.0
    dependencies:
      fast-glob: 3.2.12
      glob-parent: 6.0.2
      globby: 12.2.0
      normalize-path: 3.0.0
      schema-utils: 4.0.0
      serialize-javascript: 6.0.0
      webpack: 5.75.0
    dev: false

  /core-js-compat/3.26.1:
    resolution: {integrity: sha512-622/KzTudvXCDLRw70iHW4KKs1aGpcRcowGWyYJr2DEBfRrd6hNJybxSWJFuZYD4ma86xhrwDDHxmDaIq4EA8A==}
    dependencies:
      browserslist: 4.21.4
    dev: false

  /core-util-is/1.0.3:
    resolution: {integrity: sha512-ZQBvi1DcpJ4GDqanjucZ2Hj3wEO5pZDS89BWbkcrvdxksJorwUDDZamX9ldFkp9aw2lmBDLgkObEA4DWNJ9FYQ==}
    dev: false

  /cosmiconfig/7.1.0:
    resolution: {integrity: sha512-AdmX6xUzdNASswsFtmwSt7Vj8po9IuqXm0UXz7QKPuEUmPB4XyjGfaAr2PSuELMwkRMVH1EpIkX5bTZGRB3eCA==}
    engines: {node: '>=10'}
    dependencies:
      '@types/parse-json': 4.0.0
      import-fresh: 3.3.0
      parse-json: 5.2.0
      path-type: 4.0.0
      yaml: 1.10.2
    dev: false

  /create-require/1.1.1:
    resolution: {integrity: sha512-dcKFX3jn0MpIaXjisoRvexIJVEKzaq7z2rZKxf+MSr9TkdmHmsU4m2lcLojrj/FHl8mk5VxMmYA+ftRkP/3oKQ==}
    dev: false

  /cross-spawn/7.0.3:
    resolution: {integrity: sha512-iRDPJKUPVEND7dHPO8rkbOnPpyDygcDFtWjpeWNCgy8WP2rXcxXL8TskReQl6OrB2G7+UJrags1q15Fudc7G6w==}
    engines: {node: '>= 8'}
    dependencies:
      path-key: 3.1.1
      shebang-command: 2.0.0
      which: 2.0.2
    dev: false

  /crypt/0.0.2:
    resolution: {integrity: sha512-mCxBlsHFYh9C+HVpiEacem8FEBnMXgU9gy4zmNC+SXAZNB/1idgp/aulFJ4FgCi7GPEVbfyng092GqL2k2rmow==}
    dev: false

  /css-declaration-sorter/6.3.1_postcss@8.4.20:
    resolution: {integrity: sha512-fBffmak0bPAnyqc/HO8C3n2sHrp9wcqQz6ES9koRF2/mLOVAx9zIQ3Y7R29sYCteTPqMCwns4WYQoCX91Xl3+w==}
    engines: {node: ^10 || ^12 || >=14}
    peerDependencies:
      postcss: ^8.0.9
    dependencies:
      postcss: 8.4.20
    dev: false

  /css-loader/6.7.3_webpack@5.75.0:
    resolution: {integrity: sha512-qhOH1KlBMnZP8FzRO6YCH9UHXQhVMcEGLyNdb7Hv2cpcmJbW0YrddO+tG1ab5nT41KpHIYGsbeHqxB9xPu1pKQ==}
    engines: {node: '>= 12.13.0'}
    peerDependencies:
      webpack: ^5.0.0
    dependencies:
      icss-utils: 5.1.0_postcss@8.4.20
      postcss: 8.4.20
      postcss-modules-extract-imports: 3.0.0_postcss@8.4.20
      postcss-modules-local-by-default: 4.0.0_postcss@8.4.20
      postcss-modules-scope: 3.0.0_postcss@8.4.20
      postcss-modules-values: 4.0.0_postcss@8.4.20
      postcss-value-parser: 4.2.0
      semver: 7.3.8
      webpack: 5.75.0
    dev: false

  /css-minimizer-webpack-plugin/3.4.1_webpack@5.75.0:
    resolution: {integrity: sha512-1u6D71zeIfgngN2XNRJefc/hY7Ybsxd74Jm4qngIXyUEk7fss3VUzuHxLAq/R8NAba4QU9OUSaMZlbpRc7bM4Q==}
    engines: {node: '>= 12.13.0'}
    peerDependencies:
      '@parcel/css': '*'
      clean-css: '*'
      csso: '*'
      esbuild: '*'
      webpack: ^5.0.0
    peerDependenciesMeta:
      '@parcel/css':
        optional: true
      clean-css:
        optional: true
      csso:
        optional: true
      esbuild:
        optional: true
    dependencies:
      cssnano: 5.1.14_postcss@8.4.20
      jest-worker: 27.5.1
      postcss: 8.4.20
      schema-utils: 4.0.0
      serialize-javascript: 6.0.0
      source-map: 0.6.1
      webpack: 5.75.0
    dev: false

  /css-select/4.3.0:
    resolution: {integrity: sha512-wPpOYtnsVontu2mODhA19JrqWxNsfdatRKd64kmpRbQgh1KtItko5sTnEpPdpSaJszTOhEMlF/RPz28qj4HqhQ==}
    dependencies:
      boolbase: 1.0.0
      css-what: 6.1.0
      domhandler: 4.3.1
      domutils: 2.8.0
      nth-check: 2.1.1
    dev: false

  /css-tree/1.1.3:
    resolution: {integrity: sha512-tRpdppF7TRazZrjJ6v3stzv93qxRcSsFmW6cX0Zm2NVKpxE1WV1HblnghVv9TreireHkqI/VDEsfolRF1p6y7Q==}
    engines: {node: '>=8.0.0'}
    dependencies:
      mdn-data: 2.0.14
      source-map: 0.6.1
    dev: false

  /css-what/6.1.0:
    resolution: {integrity: sha512-HTUrgRJ7r4dsZKU6GjmpfRK1O76h97Z8MfS1G0FozR+oF2kG6Vfe8JE6zwrkbxigziPHinCJ+gCPjA9EaBDtRw==}
    engines: {node: '>= 6'}
    dev: false

  /css/3.0.0:
    resolution: {integrity: sha512-DG9pFfwOrzc+hawpmqX/dHYHJG+Bsdb0klhyi1sDneOgGOXy9wQIC8hzyVp1e4NRYDBdxcylvywPkkXCHAzTyQ==}
    dependencies:
      inherits: 2.0.4
      source-map: 0.6.1
      source-map-resolve: 0.6.0
    dev: false

  /cssesc/3.0.0:
    resolution: {integrity: sha512-/Tb/JcjK111nNScGob5MNtsntNM1aCNUDipB/TkwZFhyDrrE47SOx/18wF2bbjgc3ZzCSKW1T5nt5EbFoAz/Vg==}
    engines: {node: '>=4'}
    hasBin: true
    dev: false

  /cssnano-preset-default/5.2.13_postcss@8.4.20:
    resolution: {integrity: sha512-PX7sQ4Pb+UtOWuz8A1d+Rbi+WimBIxJTRyBdgGp1J75VU0r/HFQeLnMYgHiCAp6AR4rqrc7Y4R+1Rjk3KJz6DQ==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      css-declaration-sorter: 6.3.1_postcss@8.4.20
      cssnano-utils: 3.1.0_postcss@8.4.20
      postcss: 8.4.20
      postcss-calc: 8.2.4_postcss@8.4.20
      postcss-colormin: 5.3.0_postcss@8.4.20
      postcss-convert-values: 5.1.3_postcss@8.4.20
      postcss-discard-comments: 5.1.2_postcss@8.4.20
      postcss-discard-duplicates: 5.1.0_postcss@8.4.20
      postcss-discard-empty: 5.1.1_postcss@8.4.20
      postcss-discard-overridden: 5.1.0_postcss@8.4.20
      postcss-merge-longhand: 5.1.7_postcss@8.4.20
      postcss-merge-rules: 5.1.3_postcss@8.4.20
      postcss-minify-font-values: 5.1.0_postcss@8.4.20
      postcss-minify-gradients: 5.1.1_postcss@8.4.20
      postcss-minify-params: 5.1.4_postcss@8.4.20
      postcss-minify-selectors: 5.2.1_postcss@8.4.20
      postcss-normalize-charset: 5.1.0_postcss@8.4.20
      postcss-normalize-display-values: 5.1.0_postcss@8.4.20
      postcss-normalize-positions: 5.1.1_postcss@8.4.20
      postcss-normalize-repeat-style: 5.1.1_postcss@8.4.20
      postcss-normalize-string: 5.1.0_postcss@8.4.20
      postcss-normalize-timing-functions: 5.1.0_postcss@8.4.20
      postcss-normalize-unicode: 5.1.1_postcss@8.4.20
      postcss-normalize-url: 5.1.0_postcss@8.4.20
      postcss-normalize-whitespace: 5.1.1_postcss@8.4.20
      postcss-ordered-values: 5.1.3_postcss@8.4.20
      postcss-reduce-initial: 5.1.1_postcss@8.4.20
      postcss-reduce-transforms: 5.1.0_postcss@8.4.20
      postcss-svgo: 5.1.0_postcss@8.4.20
      postcss-unique-selectors: 5.1.1_postcss@8.4.20
    dev: false

  /cssnano-utils/3.1.0_postcss@8.4.20:
    resolution: {integrity: sha512-JQNR19/YZhz4psLX/rQ9M83e3z2Wf/HdJbryzte4a3NSuafyp9w/I4U+hx5C2S9g41qlstH7DEWnZaaj83OuEA==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      postcss: 8.4.20
    dev: false

  /cssnano/5.1.14_postcss@8.4.20:
    resolution: {integrity: sha512-Oou7ihiTocbKqi0J1bB+TRJIQX5RMR3JghA8hcWSw9mjBLQ5Y3RWqEDoYG3sRNlAbCIXpqMoZGbq5KDR3vdzgw==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      cssnano-preset-default: 5.2.13_postcss@8.4.20
      lilconfig: 2.0.6
      postcss: 8.4.20
      yaml: 1.10.2
    dev: false

  /csso/4.2.0:
    resolution: {integrity: sha512-wvlcdIbf6pwKEk7vHj8/Bkc0B4ylXZruLvOgs9doS5eOsOpuodOV2zJChSpkp+pRpYQLQMeF04nr3Z68Sta9jA==}
    engines: {node: '>=8.0.0'}
    dependencies:
      css-tree: 1.1.3
    dev: false

  /debug/2.6.9:
    resolution: {integrity: sha512-bC7ElrdJaJnPbAP+1EotYvqZsb3ecl5wi6Bfi6BJTUcNowp6cvspg0jXznRTKDjm/E7AdgFBVeAPVMNcKGsHMA==}
    peerDependencies:
      supports-color: '*'
    peerDependenciesMeta:
      supports-color:
        optional: true
    dependencies:
      ms: 2.0.0
    dev: false

  /debug/3.1.0:
    resolution: {integrity: sha512-OX8XqP7/1a9cqkxYw2yXss15f26NKWBpDXQd0/uK/KPqdQhxbPa994hnzjcE2VqQpDslf55723cKPUOGSmMY3g==}
    peerDependencies:
      supports-color: '*'
    peerDependenciesMeta:
      supports-color:
        optional: true
    dependencies:
      ms: 2.0.0
    dev: false

  /debug/4.3.4:
    resolution: {integrity: sha512-PRWFHuSU3eDtQJPvnNY7Jcket1j0t5OuOsFzPPzsekD52Zl8qUfFIPEiswXqIvHWGVHOgX+7G/vCNNhehwxfkQ==}
    engines: {node: '>=6.0'}
    peerDependencies:
      supports-color: '*'
    peerDependenciesMeta:
      supports-color:
        optional: true
    dependencies:
      ms: 2.1.2
    dev: false

  /decode-uri-component/0.2.2:
    resolution: {integrity: sha512-FqUYQ+8o158GyGTrMFJms9qh3CqTKvAqgqsTnkLI8sKu0028orqBhxNMFkFen0zGyg6epACD32pjVk58ngIErQ==}
    engines: {node: '>=0.10'}
    dev: false

  /dedent/0.7.0:
    resolution: {integrity: sha512-Q6fKUPqnAHAyhiUgFU7BUzLiv0kd8saH9al7tnu5Q/okj6dnupxyTgFIBjVzJATdfIAm9NAsvXNzjaKa+bxVyA==}
    dev: false

  /deepmerge/4.2.2:
    resolution: {integrity: sha512-FJ3UgI4gIl+PHZm53knsuSFpE+nESMr7M4v9QcgB7S63Kj/6WqMiFQJpBBYz1Pt+66bZpP3Q7Lye0Oo9MPKEdg==}
    engines: {node: '>=0.10.0'}
    dev: false

  /default-gateway/6.0.3:
    resolution: {integrity: sha512-fwSOJsbbNzZ/CUFpqFBqYfYNLj1NbMPm8MMCIzHjC83iSJRBEGmDUxU+WP661BaBQImeC2yHwXtz+P/O9o+XEg==}
    engines: {node: '>= 10'}
    dependencies:
      execa: 5.1.1
    dev: false

  /define-lazy-prop/2.0.0:
    resolution: {integrity: sha512-Ds09qNh8yw3khSjiJjiUInaGX9xlqZDY7JVryGxdxV7NPeuqQfplOpQ66yJFZut3jLa5zOwkXw1g9EI2uKh4Og==}
    engines: {node: '>=8'}
    dev: false

  /delayed-stream/1.0.0:
    resolution: {integrity: sha512-ZySD7Nf91aLB0RxL4KGrKHBXl7Eds1DAmEdcoVawXnLD7SDhpNgtuII2aAkg7a7QS41jxPSZ17p4VdGnMHk3MQ==}
    engines: {node: '>=0.4.0'}
    dev: false

  /depd/1.1.2:
    resolution: {integrity: sha512-7emPTl6Dpo6JRXOXjLRxck+FlLRX5847cLKEn00PLAgc3g2hTZZgr+e4c2v6QpSmLeFP3n5yUo7ft6avBK/5jQ==}
    engines: {node: '>= 0.6'}
    dev: false

  /depd/2.0.0:
    resolution: {integrity: sha512-g7nH6P6dyDioJogAAGprGpCtVImJhpPk/roCzdb3fIh61/s/nPsfR6onyMwkCAR/OlC3yBC0lESvUoQEAssIrw==}
    engines: {node: '>= 0.8'}
    dev: false

  /destroy/1.2.0:
    resolution: {integrity: sha512-2sJGJTaXIIaR1w4iJSNoN0hnMY7Gpc/n8D4qSCJw8QqFWXf7cuAgnEHxBpweaVcPevC2l3KpjYCx3NypQQgaJg==}
    engines: {node: '>= 0.8', npm: 1.2.8000 || >= 1.4.16}
    dev: false

  /detect-newline/3.1.0:
    resolution: {integrity: sha512-TLz+x/vEXm/Y7P7wn1EJFNLxYpUD4TgMosxY6fAVJUnJMbupHBOncxyWUG9OpTaH9EBD7uFI5LfEgmMOc54DsA==}
    engines: {node: '>=8'}
    dev: false

  /detect-node/2.1.0:
    resolution: {integrity: sha512-T0NIuQpnTvFDATNuHN5roPwSBG83rFsuO+MXXH9/3N1eFbn4wcPjttvjMLEPWJ0RGUYgQE7cGgS3tNxbqCGM7g==}
    dev: false

  /diff-sequences/28.1.1:
    resolution: {integrity: sha512-FU0iFaH/E23a+a718l8Qa/19bF9p06kgE0KipMOMadwa3SjnaElKzPaUC0vnibs6/B/9ni97s61mcejk8W1fQw==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dev: false

  /diff/4.0.2:
    resolution: {integrity: sha512-58lmxKSA4BNyLz+HHMUzlOEpg09FV+ev6ZMe3vJihgdxzgcwZ8VoEEPmALCZG9LmqfVoNMMKpttIYTVG6uDY7A==}
    engines: {node: '>=0.3.1'}
    dev: false

  /dir-glob/3.0.1:
    resolution: {integrity: sha512-WkrWp9GR4KXfKGYzOLmTuGVi1UWFfws377n9cc55/tb6DuqyF6pcQ5AbiHEshaDpY9v6oaSr2XCDidGmMwdzIA==}
    engines: {node: '>=8'}
    dependencies:
      path-type: 4.0.0
    dev: false

  /dns-equal/1.0.0:
    resolution: {integrity: sha512-z+paD6YUQsk+AbGCEM4PrOXSss5gd66QfcVBFTKR/HpFL9jCqikS94HYwKww6fQyO7IxrIIyUu+g0Ka9tUS2Cg==}
    dev: false

  /dns-packet/5.4.0:
    resolution: {integrity: sha512-EgqGeaBB8hLiHLZtp/IbaDQTL8pZ0+IvwzSHA6d7VyMDM+B9hgddEMa9xjK5oYnw0ci0JQ6g2XCD7/f6cafU6g==}
    engines: {node: '>=6'}
    dependencies:
      '@leichtgewicht/ip-codec': 2.0.4
    dev: false

  /dom-serializer/1.4.1:
    resolution: {integrity: sha512-VHwB3KfrcOOkelEG2ZOfxqLZdfkil8PtJi4P8N2MMXucZq2yLp75ClViUlOVwyoHEDjYU433Aq+5zWP61+RGag==}
    dependencies:
      domelementtype: 2.3.0
      domhandler: 4.3.1
      entities: 2.2.0
    dev: false

  /domelementtype/2.3.0:
    resolution: {integrity: sha512-OLETBj6w0OsagBwdXnPdN0cnMfF9opN69co+7ZrbfPGrdpPVNBUj02spi6B1N7wChLQiPn4CSH/zJvXw56gmHw==}
    dev: false

  /domhandler/4.3.1:
    resolution: {integrity: sha512-GrwoxYN+uWlzO8uhUXRl0P+kHE4GtVPfYzVLcUxPL7KNdHKj66vvlhiweIHqYYXWlw+T8iLMp42Lm67ghw4WMQ==}
    engines: {node: '>= 4'}
    dependencies:
      domelementtype: 2.3.0
    dev: false

  /domutils/2.8.0:
    resolution: {integrity: sha512-w96Cjofp72M5IIhpjgobBimYEfoPjx1Vx0BSX9P30WBdZW2WIKU0T1Bd0kz2eNZ9ikjKgHbEyKx8BB6H1L3h3A==}
    dependencies:
      dom-serializer: 1.4.1
      domelementtype: 2.3.0
      domhandler: 4.3.1
    dev: false

  /dotenv/10.0.0:
    resolution: {integrity: sha512-rlBi9d8jpv9Sf1klPjNfFAuWDjKLwTIJJ/VxtoTwIR6hnZxcEOQCZg2oIL3MWBYw5GpUDKOEnND7LXTbIpQ03Q==}
    engines: {node: '>=10'}
    dev: false

  /duplexer/0.1.2:
    resolution: {integrity: sha512-jtD6YG370ZCIi/9GTaJKQxWTZD045+4R4hTk/x1UyoqadyJ9x9CgSi1RlVDQF8U2sxLLSnFkCaMihqljHIWgMg==}
    dev: false

  /ee-first/1.1.1:
    resolution: {integrity: sha512-WMwm9LhRUo+WUaRN+vRuETqG89IgZphVSNkdFgeb6sS/E4OrDIN7t48CAewSHXc6C8lefD8KKfr5vY61brQlow==}
    dev: false

  /ejs/3.1.8:
    resolution: {integrity: sha512-/sXZeMlhS0ArkfX2Aw780gJzXSMPnKjtspYZv+f3NiKLlubezAHDU5+9xz6gd3/NhG3txQCo6xlglmTS+oTGEQ==}
    engines: {node: '>=0.10.0'}
    hasBin: true
    dependencies:
      jake: 10.8.5
    dev: false

  /electron-to-chromium/1.4.284:
    resolution: {integrity: sha512-M8WEXFuKXMYMVr45fo8mq0wUrrJHheiKZf6BArTKk9ZBYCKJEOU5H8cdWgDT+qCVZf7Na4lVUaZsA+h6uA9+PA==}
    dev: false

  /emittery/0.10.2:
    resolution: {integrity: sha512-aITqOwnLanpHLNXZJENbOgjUBeHocD+xsSJmNrjovKBW5HbSpW3d1pEls7GFQPUWXiwG9+0P4GtHfEqC/4M0Iw==}
    engines: {node: '>=12'}
    dev: false

  /emoji-regex/8.0.0:
    resolution: {integrity: sha512-MSjYzcWNOA0ewAHpz0MxpYFvwg6yjy1NG3xteoqz644VCo/RPgnr1/GGt+ic3iJTzQ8Eu3TdM14SawnVUmGE6A==}
    dev: false

  /emojis-list/3.0.0:
    resolution: {integrity: sha512-/kyM18EfinwXZbno9FyUGeFh87KC8HRQBQGildHZbEuRyWFOmv1U10o9BBp8XVZDVNNuQKyIGIu5ZYAAXJ0V2Q==}
    engines: {node: '>= 4'}
    dev: false

  /encodeurl/1.0.2:
    resolution: {integrity: sha512-TPJXq8JqFaVYm2CWmPvnP2Iyo4ZSM7/QKcSmuMLDObfpH5fi7RUGmd/rTDf+rut/saiDiQEeVTNgAmJEdAOx0w==}
    engines: {node: '>= 0.8'}
    dev: false

  /end-of-stream/1.4.4:
    resolution: {integrity: sha512-+uw1inIHVPQoaVuHzRyXd21icM+cnt4CzD5rW+NC1wjOUSTOs+Te7FOv7AhN7vS9x/oIyhLP5PR1H+phQAHu5Q==}
    dependencies:
      once: 1.4.0
    dev: false

  /enhanced-resolve/5.12.0:
    resolution: {integrity: sha512-QHTXI/sZQmko1cbDoNAa3mJ5qhWUUNAq3vR0/YiD379fWQrcfuoX1+HW2S0MTt7XmoPLapdaDKUtelUSPic7hQ==}
    engines: {node: '>=10.13.0'}
    dependencies:
      graceful-fs: 4.2.10
      tapable: 2.2.1
    dev: false

  /enquirer/2.3.6:
    resolution: {integrity: sha512-yjNnPr315/FjS4zIsUxYguYUPP2e1NK4d7E7ZOLiyYCcbFBiTMyID+2wvm2w6+pZ/odMA7cRkjhsPbltwBOrLg==}
    engines: {node: '>=8.6'}
    dependencies:
      ansi-colors: 4.1.3
    dev: false

  /entities/2.2.0:
    resolution: {integrity: sha512-p92if5Nz619I0w+akJrLZH0MX0Pb5DX39XOwQTtXSdQQOaYH03S1uIQp4mhOZtAXrxq4ViO67YTiLBo2638o9A==}
    dev: false

  /entities/4.4.0:
    resolution: {integrity: sha512-oYp7156SP8LkeGD0GF85ad1X9Ai79WtRsZ2gxJqtBuzH+98YUV6jkHEKlZkMbcrjJjIVJNIDP/3WL9wQkoPbWA==}
    engines: {node: '>=0.12'}
    dev: false

  /errno/0.1.8:
    resolution: {integrity: sha512-dJ6oBr5SQ1VSd9qkk7ByRgb/1SH4JZjCHSW/mr63/QcXO9zLVxvJ6Oy13nio03rxpSnVDDjFor75SjVeZWPW/A==}
    hasBin: true
    requiresBuild: true
    dependencies:
      prr: 1.0.1
    dev: false
    optional: true

  /error-ex/1.3.2:
    resolution: {integrity: sha512-7dFHNmqeFSEt2ZBsCriorKnn3Z2pj+fd9kmI6QoWw4//DL+icEBfc0U7qJCisqrTsKTjw4fNFy2pW9OqStD84g==}
    dependencies:
      is-arrayish: 0.2.1
    dev: false

  /es-module-lexer/0.9.3:
    resolution: {integrity: sha512-1HQ2M2sPtxwnvOvT1ZClHyQDiggdNjURWpY2we6aMKCQiUVxTmVs2UYPLIrD84sS+kMdUwfBSylbJPwNnBrnHQ==}
    dev: false

  /escalade/3.1.1:
    resolution: {integrity: sha512-k0er2gUkLf8O0zKJiAhmkTnJlTvINGv7ygDNPbeIsX/TJjGJZHuh9B2UxbsaEkmlEo9MfhrSzmhIlhRlI2GXnw==}
    engines: {node: '>=6'}
    dev: false

  /escape-html/1.0.3:
    resolution: {integrity: sha512-NiSupZ4OeuGwr68lGIeym/ksIZMJodUGOSCZ/FSnTxcrekbvqrgdUxlJOMpijaKZVjAJrWrGs/6Jy8OMuyj9ow==}
    dev: false

  /escape-string-regexp/1.0.5:
    resolution: {integrity: sha512-vbRorB5FUQWvla16U8R/qgaFIya2qGzwDrNmCZuYKrbdSUMG6I1ZCGQRefkRVhuOkIGVne7BQ35DSfo1qvJqFg==}
    engines: {node: '>=0.8.0'}
    dev: false

  /escape-string-regexp/2.0.0:
    resolution: {integrity: sha512-UpzcLCXolUWcNu5HtVMHYdXJjArjsF9C0aNnquZYY4uW/Vu0miy5YoWvbV345HauVvcAUnpRuhMMcqTcGOY2+w==}
    engines: {node: '>=8'}
    dev: false

  /eslint-scope/5.1.1:
    resolution: {integrity: sha512-2NxwbF/hZ0KpepYN0cNbo+FN6XoK7GaHlQhgx/hIZl6Va0bF45RQOOwhLIy8lQDbuCiadSLCBnH2CFYquit5bw==}
    engines: {node: '>=8.0.0'}
    dependencies:
      esrecurse: 4.3.0
      estraverse: 4.3.0
    dev: false

  /esprima/4.0.1:
    resolution: {integrity: sha512-eGuFFw7Upda+g4p+QHvnW0RyTX/SVeJBDM/gCtMARO0cLuT2HcEKnTPvhjV6aGeqrCB/sbNop0Kszm0jsaWU4A==}
    engines: {node: '>=4'}
    hasBin: true
    dev: false

  /esquery/1.4.0:
    resolution: {integrity: sha512-cCDispWt5vHHtwMY2YrAQ4ibFkAL8RbH5YGBnZBc90MolvvfkkQcJro/aZiAQUlQ3qgrYS6D6v8Gc5G5CQsc9w==}
    engines: {node: '>=0.10'}
    dependencies:
      estraverse: 5.3.0
    dev: false

  /esrecurse/4.3.0:
    resolution: {integrity: sha512-KmfKL3b6G+RXvP8N1vr3Tq1kL/oCFgn2NYXEtqP8/L3pKapUA4G8cFVaoF3SU323CD4XypR/ffioHmkti6/Tag==}
    engines: {node: '>=4.0'}
    dependencies:
      estraverse: 5.3.0
    dev: false

  /estraverse/4.3.0:
    resolution: {integrity: sha512-39nnKffWz8xN1BU/2c79n9nB9HDzo0niYUqx6xyqUnyoAnQyyWpOTdZEeiCch8BBu515t4wp9ZmgVfVhn9EBpw==}
    engines: {node: '>=4.0'}
    dev: false

  /estraverse/5.3.0:
    resolution: {integrity: sha512-MMdARuVEQziNTeJD8DgMqmhwR11BRQ/cBP+pLtYdSTnf3MIO8fFeiINEbX36ZdNlfU/7A9f3gUw49B3oQsvwBA==}
    engines: {node: '>=4.0'}
    dev: false

  /esutils/2.0.3:
    resolution: {integrity: sha512-kVscqXk4OCp68SZ0dkgEKVi6/8ij300KBWTJq32P/dYeWTSwK41WyTxalN1eRmA5Z9UU/LX9D7FWSmV9SAYx6g==}
    engines: {node: '>=0.10.0'}
    dev: false

  /etag/1.8.1:
    resolution: {integrity: sha512-aIL5Fx7mawVa300al2BnEE4iNvo1qETxLrPI/o05L7z6go7fCw1J6EQmbK4FmJ2AS7kgVF/KEZWufBfdClMcPg==}
    engines: {node: '>= 0.6'}
    dev: false

  /eventemitter3/4.0.7:
    resolution: {integrity: sha512-8guHBZCwKnFhYdHr2ysuRWErTwhoN2X8XELRlrRwpmfeY2jjuUN4taQMsULKUVo1K4DvZl+0pgfyoysHxvmvEw==}
    dev: false

  /events/3.3.0:
    resolution: {integrity: sha512-mQw+2fkQbALzQ7V0MY0IqdnXNOeTtP4r0lN9z7AAawCXgqea7bDii20AYrIBrFd/Hx0M2Ocz6S111CaFkUcb0Q==}
    engines: {node: '>=0.8.x'}
    dev: false

  /execa/5.1.1:
    resolution: {integrity: sha512-8uSpZZocAZRBAPIEINJj3Lo9HyGitllczc27Eh5YYojjMFMn8yHMDMaUHE2Jqfq05D/wucwI4JGURyXt1vchyg==}
    engines: {node: '>=10'}
    dependencies:
      cross-spawn: 7.0.3
      get-stream: 6.0.1
      human-signals: 2.1.0
      is-stream: 2.0.1
      merge-stream: 2.0.0
      npm-run-path: 4.0.1
      onetime: 5.1.2
      signal-exit: 3.0.7
      strip-final-newline: 2.0.0
    dev: false

  /exit/0.1.2:
    resolution: {integrity: sha512-Zk/eNKV2zbjpKzrsQ+n1G6poVbErQxJ0LBOJXaKZ1EViLzH+hrLu9cdXI4zw9dBQJslwBEpbQ2P1oS7nDxs6jQ==}
    engines: {node: '>= 0.8.0'}
    dev: false

  /expect/28.1.3:
    resolution: {integrity: sha512-eEh0xn8HlsuOBxFgIss+2mX85VAS4Qy3OSkjV7rlBWljtA4oWH37glVGyOZSZvErDT/yBywZdPGwCXuTvSG85g==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      '@jest/expect-utils': 28.1.3
      jest-get-type: 28.0.2
      jest-matcher-utils: 28.1.3
      jest-message-util: 28.1.3
      jest-util: 28.1.3
    dev: false

  /express/4.18.2:
    resolution: {integrity: sha512-5/PsL6iGPdfQ/lKM1UuielYgv3BUoJfz1aUwU9vHZ+J7gyvwdQXFEBIEIaxeGf0GIcreATNyBExtalisDbuMqQ==}
    engines: {node: '>= 0.10.0'}
    dependencies:
      accepts: 1.3.8
      array-flatten: 1.1.1
      body-parser: 1.20.1
      content-disposition: 0.5.4
      content-type: 1.0.4
      cookie: 0.5.0
      cookie-signature: 1.0.6
      debug: 2.6.9
      depd: 2.0.0
      encodeurl: 1.0.2
      escape-html: 1.0.3
      etag: 1.8.1
      finalhandler: 1.2.0
      fresh: 0.5.2
      http-errors: 2.0.0
      merge-descriptors: 1.0.1
      methods: 1.1.2
      on-finished: 2.4.1
      parseurl: 1.3.3
      path-to-regexp: 0.1.7
      proxy-addr: 2.0.7
      qs: 6.11.0
      range-parser: 1.2.1
      safe-buffer: 5.2.1
      send: 0.18.0
      serve-static: 1.15.0
      setprototypeof: 1.2.0
      statuses: 2.0.1
      type-is: 1.6.18
      utils-merge: 1.0.1
      vary: 1.1.2
    transitivePeerDependencies:
      - supports-color
    dev: false

  /fast-deep-equal/3.1.3:
    resolution: {integrity: sha512-f3qQ9oQy9j2AhBe/H9VC91wLmKBCCU/gDOnKNAYG5hswO7BLKj09Hc5HYNz9cGI++xlpDCIgDaitVs03ATR84Q==}
    dev: false

  /fast-glob/3.2.12:
    resolution: {integrity: sha512-DVj4CQIYYow0BlaelwK1pHl5n5cRSJfM60UA0zK891sVInoPri2Ekj7+e1CT3/3qxXenpI+nBBmQAcJPJgaj4w==}
    engines: {node: '>=8.6.0'}
    dependencies:
      '@nodelib/fs.stat': 2.0.5
      '@nodelib/fs.walk': 1.2.8
      glob-parent: 5.1.2
      merge2: 1.4.1
      micromatch: 4.0.5
    dev: false

  /fast-glob/3.2.7:
    resolution: {integrity: sha512-rYGMRwip6lUMvYD3BTScMwT1HtAs2d71SMv66Vrxs0IekGZEjhM0pcMfjQPnknBt2zeCwQMEupiN02ZP4DiT1Q==}
    engines: {node: '>=8'}
    dependencies:
      '@nodelib/fs.stat': 2.0.5
      '@nodelib/fs.walk': 1.2.8
      glob-parent: 5.1.2
      merge2: 1.4.1
      micromatch: 4.0.5
    dev: false

  /fast-json-stable-stringify/2.1.0:
    resolution: {integrity: sha512-lhd/wF+Lk98HZoTCtlVraHtfh5XYijIjalXck7saUtuanSDyLMxnHhSXEDJqHxD7msR8D0uCmqlkwjCV8xvwHw==}
    dev: false

  /fastq/1.14.0:
    resolution: {integrity: sha512-eR2D+V9/ExcbF9ls441yIuN6TI2ED1Y2ZcA5BmMtJsOkWOFRJQ0Jt0g1UwqXJJVAb+V+umH5Dfr8oh4EVP7VVg==}
    dependencies:
      reusify: 1.0.4
    dev: false

  /faye-websocket/0.11.4:
    resolution: {integrity: sha512-CzbClwlXAuiRQAlUyfqPgvPoNKTckTPGfwZV4ZdAhVcP2lh9KUxJg2b5GkE7XbjKQ3YJnQ9z6D9ntLAlB+tP8g==}
    engines: {node: '>=0.8.0'}
    dependencies:
      websocket-driver: 0.7.4
    dev: false

  /fb-watchman/2.0.2:
    resolution: {integrity: sha512-p5161BqbuCaSnB8jIbzQHOlpgsPmK5rJVDfDKO91Axs5NC1uu3HRQm6wt9cd9/+GtQQIO53JdGXXoyDpTAsgYA==}
    dependencies:
      bser: 2.1.1
    dev: false

  /figures/3.2.0:
    resolution: {integrity: sha512-yaduQFRKLXYOGgEn6AZau90j3ggSOyiqXU0F9JZfeXYhNa+Jk4X+s45A2zg5jns87GAFa34BBm2kXw4XpNcbdg==}
    engines: {node: '>=8'}
    dependencies:
      escape-string-regexp: 1.0.5
    dev: false

  /file-loader/6.2.0_webpack@5.75.0:
    resolution: {integrity: sha512-qo3glqyTa61Ytg4u73GultjHGjdRyig3tG6lPtyX/jOEJvHif9uB0/OCI2Kif6ctF3caQTW2G5gym21oAsI4pw==}
    engines: {node: '>= 10.13.0'}
    peerDependencies:
      webpack: ^4.0.0 || ^5.0.0
    dependencies:
      loader-utils: 2.0.4
      schema-utils: 3.1.1
      webpack: 5.75.0
    dev: false

  /filelist/1.0.4:
    resolution: {integrity: sha512-w1cEuf3S+DrLCQL7ET6kz+gmlJdbq9J7yXCSjK/OZCPA+qEN1WyF4ZAf0YYJa4/shHJra2t/d/r8SV4Ji+x+8Q==}
    dependencies:
      minimatch: 5.1.1
    dev: false

  /fill-range/7.0.1:
    resolution: {integrity: sha512-qOo9F+dMUmC2Lcb4BbVvnKJxTPjCm+RRpe4gDuGrzkL7mEVl/djYSu2OdQ2Pa302N4oqkSg9ir6jaLWJ2USVpQ==}
    engines: {node: '>=8'}
    dependencies:
      to-regex-range: 5.0.1
    dev: false

  /finalhandler/1.2.0:
    resolution: {integrity: sha512-5uXcUVftlQMFnWC9qu/svkWv3GTd2PfUhK/3PLkYNAe7FbqJMt3515HaxE6eRL74GdsriiwujiawdaB1BpEISg==}
    engines: {node: '>= 0.8'}
    dependencies:
      debug: 2.6.9
      encodeurl: 1.0.2
      escape-html: 1.0.3
      on-finished: 2.4.1
      parseurl: 1.3.3
      statuses: 2.0.1
      unpipe: 1.0.0
    transitivePeerDependencies:
      - supports-color
    dev: false

  /find-cache-dir/3.3.2:
    resolution: {integrity: sha512-wXZV5emFEjrridIgED11OoUKLxiYjAcqot/NJdAkOhlJ+vGzwhOAfcG5OX1jP+S0PcjEn8bdMJv+g2jwQ3Onig==}
    engines: {node: '>=8'}
    dependencies:
      commondir: 1.0.1
      make-dir: 3.1.0
      pkg-dir: 4.2.0
    dev: false

  /find-up/4.1.0:
    resolution: {integrity: sha512-PpOwAdQ/YlXQ2vj8a3h8IipDuYRi3wceVQQGYWxNINccq40Anw7BlsEXCMbt1Zt+OLA6Fq9suIpIWD0OsnISlw==}
    engines: {node: '>=8'}
    dependencies:
      locate-path: 5.0.0
      path-exists: 4.0.0
    dev: false

  /flat/5.0.2:
    resolution: {integrity: sha512-b6suED+5/3rTpUBdG1gupIl8MPFCAMA0QXwmljLhvCUKcUvdE4gWky9zpuGCcXHOsz4J9wPGNWq6OKpmIzz3hQ==}
    hasBin: true
    dev: false

  /follow-redirects/1.15.2:
    resolution: {integrity: sha512-VQLG33o04KaQ8uYi2tVNbdrWp1QWxNNea+nmIB4EVM28v0hmP17z7aG1+wAkNzVq4KeXTq3221ye5qTJP91JwA==}
    engines: {node: '>=4.0'}
    peerDependencies:
      debug: '*'
    peerDependenciesMeta:
      debug:
        optional: true
    dev: false

  /fork-ts-checker-webpack-plugin/7.2.13_qw7fmzhoapcndkteb5rsc33stq:
    resolution: {integrity: sha512-fR3WRkOb4bQdWB/y7ssDUlVdrclvwtyCUIHCfivAoYxq9dF7XfrDKbMdZIfwJ7hxIAqkYSGeU7lLJE6xrxIBdg==}
    engines: {node: '>=12.13.0', yarn: '>=1.0.0'}
    peerDependencies:
      typescript: '>3.6.0'
      vue-template-compiler: '*'
      webpack: ^5.11.0
    peerDependenciesMeta:
      vue-template-compiler:
        optional: true
    dependencies:
      '@babel/code-frame': 7.18.6
      chalk: 4.1.2
      chokidar: 3.5.3
      cosmiconfig: 7.1.0
      deepmerge: 4.2.2
      fs-extra: 10.1.0
      memfs: 3.4.12
      minimatch: 3.1.2
      node-abort-controller: 3.0.1
      schema-utils: 3.1.1
      semver: 7.3.8
      tapable: 2.2.1
      typescript: 4.8.4
      webpack: 5.75.0
    dev: false

  /form-data/4.0.0:
    resolution: {integrity: sha512-ETEklSGi5t0QMZuiXoA/Q6vcnxcLQP5vdugSpuAyi6SVGi2clPPp+xgEhuMaHC+zGgn31Kd235W35f7Hykkaww==}
    engines: {node: '>= 6'}
    dependencies:
      asynckit: 0.4.0
      combined-stream: 1.0.8
      mime-types: 2.1.35
    dev: false

  /forwarded/0.2.0:
    resolution: {integrity: sha512-buRG0fpBtRHSTCOASe6hD258tEubFoRLb4ZNA6NxMVHNw2gOcwHo9wyablzMzOA5z9xA9L1KNjk/Nt6MT9aYow==}
    engines: {node: '>= 0.6'}
    dev: false

  /fraction.js/4.2.0:
    resolution: {integrity: sha512-MhLuK+2gUcnZe8ZHlaaINnQLl0xRIGRfcGk2yl8xoQAfHrSsL3rYu6FCmBdkdbhc9EPlwyGHewaRsvwRMJtAlA==}
    dev: false

  /fresh/0.5.2:
    resolution: {integrity: sha512-zJ2mQYM18rEFOudeV4GShTGIQ7RbzA7ozbU9I/XBpm7kqgMywgmylMwXHxZJmkVoYkna9d2pVXVXPdYTP9ej8Q==}
    engines: {node: '>= 0.6'}
    dev: false

  /fs-constants/1.0.0:
    resolution: {integrity: sha512-y6OAwoSIf7FyjMIv94u+b5rdheZEjzR63GTyZJm5qh4Bi+2YgwLCcI/fPFZkL5PSixOt6ZNKm+w+Hfp/Bciwow==}
    dev: false

  /fs-extra/10.1.0:
    resolution: {integrity: sha512-oRXApq54ETRj4eMiFzGnHWGy+zo5raudjuxN0b8H7s/RU2oW0Wvsx9O0ACRN/kRq9E8Vu/ReskGB5o3ji+FzHQ==}
    engines: {node: '>=12'}
    dependencies:
      graceful-fs: 4.2.10
      jsonfile: 6.1.0
      universalify: 2.0.0
    dev: false

  /fs-monkey/1.0.3:
    resolution: {integrity: sha512-cybjIfiiE+pTWicSCLFHSrXZ6EilF30oh91FDP9S2B051prEa7QWfrVTQm10/dDpswBDXZugPa1Ogu8Yh+HV0Q==}
    dev: false

  /fs.realpath/1.0.0:
    resolution: {integrity: sha512-OO0pH2lK6a0hZnAdau5ItzHPI6pUlvI7jMVnxUQRtw4owF2wk8lOSabtGDCTP4Ggrg2MbGnWO9X8K1t4+fGMDw==}
    dev: false

  /fsevents/2.3.2:
    resolution: {integrity: sha512-xiqMQR4xAeHTuB9uWm+fFRcIOgKBMiOBP+eXiyT7jsgVCq1bkVygt00oASowB7EdtpOHaaPgKt812P9ab+DDKA==}
    engines: {node: ^8.16.0 || ^10.6.0 || >=11.0.0}
    os: [darwin]
    requiresBuild: true
    dev: false
    optional: true

  /function-bind/1.1.1:
    resolution: {integrity: sha512-yIovAzMX49sF8Yl58fSCWJ5svSLuaibPxXQJFLmBObTuCr0Mf1KiPopGM9NiFjiYBCbfaa2Fh6breQ6ANVTI0A==}
    dev: false

  /gensync/1.0.0-beta.2:
    resolution: {integrity: sha512-3hN7NaskYvMDLQY55gnW3NQ+mesEAepTqlg+VEbj7zzqEMBVNhzcGYYeqFo/TlYz6eQiFcp1HcsCZO+nGgS8zg==}
    engines: {node: '>=6.9.0'}
    dev: false

  /get-caller-file/2.0.5:
    resolution: {integrity: sha512-DyFP3BM/3YHTQOCUL/w0OZHR0lpKeGrxotcHWcqNEdnltqFwXVfhEBQ94eIo34AfQpo0rGki4cyIiftY06h2Fg==}
    engines: {node: 6.* || 8.* || >= 10.*}
    dev: false

  /get-intrinsic/1.1.3:
    resolution: {integrity: sha512-QJVz1Tj7MS099PevUG5jvnt9tSkXN8K14dxQlikJuPt4uD9hHAHjLyLBiLR5zELelBdD9QNRAXZzsJx0WaDL9A==}
    dependencies:
      function-bind: 1.1.1
      has: 1.0.3
      has-symbols: 1.0.3
    dev: false

  /get-package-type/0.1.0:
    resolution: {integrity: sha512-pjzuKtY64GYfWizNAJ0fr9VqttZkNiK2iS430LtIHzjBEr6bX8Am2zm4sW4Ro5wjWW5cAlRL1qAMTcXbjNAO2Q==}
    engines: {node: '>=8.0.0'}
    dev: false

  /get-stream/6.0.1:
    resolution: {integrity: sha512-ts6Wi+2j3jQjqi70w5AlN8DFnkSwC+MqmxEzdEALB2qXZYV3X/b1CTfgPLGJNMeAWxdPfU8FO1ms3NUfaHCPYg==}
    engines: {node: '>=10'}
    dev: false

  /glob-parent/5.1.2:
    resolution: {integrity: sha512-AOIgSQCepiJYwP3ARnGx+5VnTu2HBYdzbGP45eLw1vr3zB3vZLeyed1sC9hnbcOc9/SrMyM5RPQrkGz4aS9Zow==}
    engines: {node: '>= 6'}
    dependencies:
      is-glob: 4.0.3
    dev: false

  /glob-parent/6.0.2:
    resolution: {integrity: sha512-XxwI8EOhVQgWp6iDL+3b0r86f4d6AX6zSU55HfB4ydCEuXLXc5FcYeOu+nnGftS4TEju/11rt4KJPTMgbfmv4A==}
    engines: {node: '>=10.13.0'}
    dependencies:
      is-glob: 4.0.3
    dev: false

  /glob-to-regexp/0.4.1:
    resolution: {integrity: sha512-lkX1HJXwyMcprw/5YUZc2s7DrpAiHB21/V+E1rHUrVNokkvB6bqMzT0VfV6/86ZNabt1k14YOIaT7nDvOX3Iiw==}
    dev: false

  /glob/7.1.4:
    resolution: {integrity: sha512-hkLPepehmnKk41pUGm3sYxoFs/umurYfYJCerbXEyFIWcAzvpipAgVkBqqT9RBKMGjnq6kMuyYwha6csxbiM1A==}
    dependencies:
      fs.realpath: 1.0.0
      inflight: 1.0.6
      inherits: 2.0.4
      minimatch: 3.0.5
      once: 1.4.0
      path-is-absolute: 1.0.1
    dev: false

  /glob/7.2.3:
    resolution: {integrity: sha512-nFR0zLpU2YCaRxwoCJvL6UvCH2JFyFVIvwTLsIf21AuHlMskA1hhTdk+LlYJtOlYt9v6dvszD2BGRqBL+iQK9Q==}
    dependencies:
      fs.realpath: 1.0.0
      inflight: 1.0.6
      inherits: 2.0.4
      minimatch: 3.1.2
      once: 1.4.0
      path-is-absolute: 1.0.1
    dev: false

  /globals/11.12.0:
    resolution: {integrity: sha512-WOBp/EEGUiIsJSp7wcv/y6MO+lV9UoncWqxuFfm8eBwzWNgyfBd6Gz+IeKQ9jCmyhoH99g15M3T+QaVHFjizVA==}
    engines: {node: '>=4'}
    dev: false

  /globby/12.2.0:
    resolution: {integrity: sha512-wiSuFQLZ+urS9x2gGPl1H5drc5twabmm4m2gTR27XDFyjUHJUNsS8o/2aKyIF6IoBaR630atdher0XJ5g6OMmA==}
    engines: {node: ^12.20.0 || ^14.13.1 || >=16.0.0}
    dependencies:
      array-union: 3.0.1
      dir-glob: 3.0.1
      fast-glob: 3.2.12
      ignore: 5.2.1
      merge2: 1.4.1
      slash: 4.0.0
    dev: false

  /graceful-fs/4.2.10:
    resolution: {integrity: sha512-9ByhssR2fPVsNZj478qUUbKfmL0+t5BDVyjShtyZZLiK7ZDAArFFfopyOTj0M05wE2tJPisA4iTnnXl2YoPvOA==}
    dev: false

  /handle-thing/2.0.1:
    resolution: {integrity: sha512-9Qn4yBxelxoh2Ow62nP+Ka/kMnOXRi8BXnRaUwezLNhqelnN49xKz4F/dPP8OYLxLxq6JDtZb2i9XznUQbNPTg==}
    dev: false

  /harmony-reflect/1.6.2:
    resolution: {integrity: sha512-HIp/n38R9kQjDEziXyDTuW3vvoxxyxjxFzXLrBr18uB47GnSt+G9D29fqrpM5ZkspMcPICud3XsBJQ4Y2URg8g==}
    dev: false

  /has-flag/3.0.0:
    resolution: {integrity: sha512-sKJf1+ceQBr4SMkvQnBDNDtf4TXpVhVGateu0t918bl30FnbE2m4vNLX+VWe/dpjlb+HugGYzW7uQXH98HPEYw==}
    engines: {node: '>=4'}
    dev: false

  /has-flag/4.0.0:
    resolution: {integrity: sha512-EykJT/Q1KjTWctppgIAgfSO0tKVuZUjhgMr17kqTumMl6Afv3EISleU7qZUzoXDFTAHTDC4NOoG/ZxU3EvlMPQ==}
    engines: {node: '>=8'}
    dev: false

  /has-symbols/1.0.3:
    resolution: {integrity: sha512-l3LCuF6MgDNwTDKkdYGEihYjt5pRPbEg46rtlmnSPlUbgmB8LOIrKJbYYFBSbnPaJexMKtiPO8hmeRjRz2Td+A==}
    engines: {node: '>= 0.4'}
    dev: false

  /has/1.0.3:
    resolution: {integrity: sha512-f2dvO0VU6Oej7RkWJGrehjbzMAjFp5/VKPp5tTpWIV4JHHZK1/BxbFRtf/siA2SWTe09caDmVtYYzWEIbBS4zw==}
    engines: {node: '>= 0.4.0'}
    dependencies:
      function-bind: 1.1.1
    dev: false

  /hpack.js/2.1.6:
    resolution: {integrity: sha512-zJxVehUdMGIKsRaNt7apO2Gqp0BdqW5yaiGHXXmbpvxgBYVZnAql+BJb4RO5ad2MgpbZKn5G6nMnegrH1FcNYQ==}
    dependencies:
      inherits: 2.0.4
      obuf: 1.1.2
      readable-stream: 2.3.7
      wbuf: 1.7.3
    dev: false

  /html-entities/2.3.3:
    resolution: {integrity: sha512-DV5Ln36z34NNTDgnz0EWGBLZENelNAtkiFA4kyNOG2tDI6Mz1uSWiq1wAKdyjnJwyDiDO7Fa2SO1CTxPXL8VxA==}
    dev: false

  /html-escaper/2.0.2:
    resolution: {integrity: sha512-H2iMtd0I4Mt5eYiapRdIDjp+XzelXQ0tFE4JS7YFwFevXXMmOp9myNrUvCg0D6ws8iqkRPBfKHgbwig1SmlLfg==}
    dev: false

  /http-deceiver/1.2.7:
    resolution: {integrity: sha512-LmpOGxTfbpgtGVxJrj5k7asXHCgNZp5nLfp+hWc8QQRqtb7fUy6kRY3BO1h9ddF6yIPYUARgxGOwB42DnxIaNw==}
    dev: false

  /http-errors/1.6.3:
    resolution: {integrity: sha512-lks+lVC8dgGyh97jxvxeYTWQFvh4uw4yC12gVl63Cg30sjPX4wuGcdkICVXDAESr6OJGjqGA8Iz5mkeN6zlD7A==}
    engines: {node: '>= 0.6'}
    dependencies:
      depd: 1.1.2
      inherits: 2.0.3
      setprototypeof: 1.1.0
      statuses: 1.5.0
    dev: false

  /http-errors/2.0.0:
    resolution: {integrity: sha512-FtwrG/euBzaEjYeRqOgly7G0qviiXoJWnvEH2Z1plBdXgbyjv34pHTSb9zoeHMyDy33+DWy5Wt9Wo+TURtOYSQ==}
    engines: {node: '>= 0.8'}
    dependencies:
      depd: 2.0.0
      inherits: 2.0.4
      setprototypeof: 1.2.0
      statuses: 2.0.1
      toidentifier: 1.0.1
    dev: false

  /http-parser-js/0.5.8:
    resolution: {integrity: sha512-SGeBX54F94Wgu5RH3X5jsDtf4eHyRogWX1XGT3b4HuW3tQPM4AaBzoUji/4AAJNXCEOWZ5O0DgZmJw1947gD5Q==}
    dev: false

  /http-proxy-middleware/2.0.6_@types+express@4.17.15:
    resolution: {integrity: sha512-ya/UeJ6HVBYxrgYotAZo1KvPWlgB48kUJLDePFeneHsVujFaW5WNj2NgWCAE//B1Dl02BIfYlpNgBy8Kf8Rjmw==}
    engines: {node: '>=12.0.0'}
    peerDependencies:
      '@types/express': ^4.17.13
    peerDependenciesMeta:
      '@types/express':
        optional: true
    dependencies:
      '@types/express': 4.17.15
      '@types/http-proxy': 1.17.9
      http-proxy: 1.18.1
      is-glob: 4.0.3
      is-plain-obj: 3.0.0
      micromatch: 4.0.5
    transitivePeerDependencies:
      - debug
    dev: false

  /http-proxy/1.18.1:
    resolution: {integrity: sha512-7mz/721AbnJwIVbnaSv1Cz3Am0ZLT/UBwkC92VlxhXv/k/BBQfM2fXElQNC27BVGr0uwUpplYPQM9LnaBMR5NQ==}
    engines: {node: '>=8.0.0'}
    dependencies:
      eventemitter3: 4.0.7
      follow-redirects: 1.15.2
      requires-port: 1.0.0
    transitivePeerDependencies:
      - debug
    dev: false

  /human-signals/2.1.0:
    resolution: {integrity: sha512-B4FFZ6q/T2jhhksgkbEW3HBvWIfDW85snkQgawt07S7J5QXTk6BkNV+0yAeZrM5QpMAdYlocGoljn0sJ/WQkFw==}
    engines: {node: '>=10.17.0'}
    dev: false

  /iconv-lite/0.4.24:
    resolution: {integrity: sha512-v3MXnZAcvnywkTUEZomIActle7RXXeedOR31wwl7VlyoXO4Qi9arvSenNQWne1TcRwhCL1HwLI21bEqdpj8/rA==}
    engines: {node: '>=0.10.0'}
    dependencies:
      safer-buffer: 2.1.2
    dev: false

  /iconv-lite/0.6.3:
    resolution: {integrity: sha512-4fCk79wshMdzMp2rH06qWrJE4iolqLhCUH+OiuIgU++RB0+94NlDL81atO7GX55uUKueo0txHNtvEyI6D7WdMw==}
    engines: {node: '>=0.10.0'}
    dependencies:
      safer-buffer: 2.1.2
    dev: false

  /icss-utils/5.1.0_postcss@8.4.20:
    resolution: {integrity: sha512-soFhflCVWLfRNOPU3iv5Z9VUdT44xFRbzjLsEzSr5AQmgqPMTHdU3PMT1Cf1ssx8fLNJDA1juftYl+PUcv3MqA==}
    engines: {node: ^10 || ^12 || >= 14}
    peerDependencies:
      postcss: ^8.1.0
    dependencies:
      postcss: 8.4.20
    dev: false

  /identity-obj-proxy/3.0.0:
    resolution: {integrity: sha512-00n6YnVHKrinT9t0d9+5yZC6UBNJANpYEQvL2LlX6Ab9lnmxzIRcEmTPuyGScvl1+jKuCICX1Z0Ab1pPKKdikA==}
    engines: {node: '>=4'}
    dependencies:
      harmony-reflect: 1.6.2
    dev: false

  /ieee754/1.2.1:
    resolution: {integrity: sha512-dcyqhDvX1C46lXZcVqCpK+FtMRQVdIMN6/Df5js2zouUsqG7I6sFxitIC+7KYK29KdXOLHdu9zL4sFnoVQnqaA==}
    dev: false

  /ignore/5.2.1:
    resolution: {integrity: sha512-d2qQLzTJ9WxQftPAuEQpSPmKqzxePjzVbpAVv62AQ64NTL+wR4JkrVqR/LqFsFEUsHDAiId52mJteHDFuDkElA==}
    engines: {node: '>= 4'}
    dev: false

  /image-size/0.5.5:
    resolution: {integrity: sha512-6TDAlDPZxUFCv+fuOkIoXT/V/f3Qbq8e37p+YOiYrUv3v9cc3/6x78VdfPgFVaB9dZYeLUfKgHRebpkm/oP2VQ==}
    engines: {node: '>=0.10.0'}
    hasBin: true
    requiresBuild: true
    dev: false
    optional: true

  /immutable/4.1.0:
    resolution: {integrity: sha512-oNkuqVTA8jqG1Q6c+UglTOD1xhC1BtjKI7XkCXRkZHrN5m18/XsnUp8Q89GkQO/z+0WjonSvl0FLhDYftp46nQ==}
    dev: false

  /import-fresh/3.3.0:
    resolution: {integrity: sha512-veYYhQa+D1QBKznvhUHxb8faxlrwUnxseDAbAp457E0wLNio2bOSKnjYDhMj+YiAq61xrMGhQk9iXVk5FzgQMw==}
    engines: {node: '>=6'}
    dependencies:
      parent-module: 1.0.1
      resolve-from: 4.0.0
    dev: false

  /imurmurhash/0.1.4:
    resolution: {integrity: sha512-JmXMZ6wuvDmLiHEml9ykzqO6lwFbof0GG4IkcGaENdCRDDmMVnny7s5HsIgHCbaq0w2MyPhDqkhTUgS2LU2PHA==}
    engines: {node: '>=0.8.19'}
    dev: false

  /inflight/1.0.6:
    resolution: {integrity: sha512-k92I/b08q4wvFscXCLvqfsHCrjrF7yiXsQuIVvVE7N82W3+aqpzuUdBbfhWcy/FZR3/4IgflMgKLOsvPDrGCJA==}
    dependencies:
      once: 1.4.0
      wrappy: 1.0.2
    dev: false

  /inherits/2.0.3:
    resolution: {integrity: sha512-x00IRNXNy63jwGkJmzPigoySHbaqpNuzKbBOmzK+g2OdZpQ9w+sxCN+VSB3ja7IAge2OP2qpfxTjeNcyjmW1uw==}
    dev: false

  /inherits/2.0.4:
    resolution: {integrity: sha512-k/vGaX4/Yla3WzyMCvTQOXYeIHvqOKtnqBduzTHpzpQZzAskKMhZ2K+EnBiSM9zGSoIFeMpXKxa4dYeZIQqewQ==}
    dev: false

  /ipaddr.js/1.9.1:
    resolution: {integrity: sha512-0KI/607xoxSToH7GjN1FfSbLoU0+btTicjsQSWQlh/hZykN8KpmMf7uYwPW3R+akZ6R/w18ZlXSHBYXiYUPO3g==}
    engines: {node: '>= 0.10'}
    dev: false

  /ipaddr.js/2.0.1:
    resolution: {integrity: sha512-1qTgH9NG+IIJ4yfKs2e6Pp1bZg8wbDbKHT21HrLIeYBTRLgMYKnMTPAuI3Lcs61nfx5h1xlXnbJtH1kX5/d/ng==}
    engines: {node: '>= 10'}
    dev: false

  /is-arrayish/0.2.1:
    resolution: {integrity: sha512-zz06S8t0ozoDXMG+ube26zeCTNXcKIPJZJi8hBrF4idCLms4CG9QtK7qBl1boi5ODzFpjswb5JPmHCbMpjaYzg==}
    dev: false

  /is-binary-path/2.1.0:
    resolution: {integrity: sha512-ZMERYes6pDydyuGidse7OsHxtbI7WVeUEozgR/g7rd0xUimYNlvZRE/K2MgZTjWy725IfelLeVcEM97mmtRGXw==}
    engines: {node: '>=8'}
    dependencies:
      binary-extensions: 2.2.0
    dev: false

  /is-buffer/1.1.6:
    resolution: {integrity: sha512-NcdALwpXkTm5Zvvbk7owOUSvVvBKDgKP5/ewfXEznmQFfs4ZRmanOeKBTjRVjka3QFoN6XJ+9F3USqfHqTaU5w==}
    dev: false

  /is-core-module/2.11.0:
    resolution: {integrity: sha512-RRjxlvLDkD1YJwDbroBHMb+cukurkDWNyHx7D3oNB5x9rb5ogcksMC5wHCadcXoo67gVr/+3GFySh3134zi6rw==}
    dependencies:
      has: 1.0.3
    dev: false

  /is-docker/2.2.1:
    resolution: {integrity: sha512-F+i2BKsFrH66iaUFc0woD8sLy8getkwTwtOBjvs56Cx4CgJDeKQeqfz8wAYiSb8JOprWhHH5p77PbmYCvvUuXQ==}
    engines: {node: '>=8'}
    hasBin: true
    dev: false

  /is-extglob/2.1.1:
    resolution: {integrity: sha512-SbKbANkN603Vi4jEZv49LeVJMn4yGwsbzZworEoyEiutsN3nJYdbO36zfhGJ6QEDpOZIFkDtnq5JRxmvl3jsoQ==}
    engines: {node: '>=0.10.0'}
    dev: false

  /is-fullwidth-code-point/3.0.0:
    resolution: {integrity: sha512-zymm5+u+sCsSWyD9qNaejV3DFvhCKclKdizYaJUuHA83RLjb7nSuGnddCHGv0hk+KY7BMAlsWeK4Ueg6EV6XQg==}
    engines: {node: '>=8'}
    dev: false

  /is-generator-fn/2.1.0:
    resolution: {integrity: sha512-cTIB4yPYL/Grw0EaSzASzg6bBy9gqCofvWN8okThAYIxKJZC+udlRAmGbM0XLeniEJSs8uEgHPGuHSe1XsOLSQ==}
    engines: {node: '>=6'}
    dev: false

  /is-glob/4.0.3:
    resolution: {integrity: sha512-xelSayHH36ZgE7ZWhli7pW34hNbNl8Ojv5KVmkJD4hBdD3th8Tfk9vYasLM+mXWOZhFkgZfxhLSnrwRr4elSSg==}
    engines: {node: '>=0.10.0'}
    dependencies:
      is-extglob: 2.1.1
    dev: false

  /is-number/7.0.0:
    resolution: {integrity: sha512-41Cifkg6e8TylSpdtTpeLVMqvSBEVzTttHvERD741+pnZ8ANv0004MRL43QKPDlK9cGvNp6NZWZUBlbGXYxxng==}
    engines: {node: '>=0.12.0'}
    dev: false

  /is-plain-obj/3.0.0:
    resolution: {integrity: sha512-gwsOE28k+23GP1B6vFl1oVh/WOzmawBrKwo5Ev6wMKzPkaXaCDIQKzLnvsA42DRlbVTWorkgTKIviAKCWkfUwA==}
    engines: {node: '>=10'}
    dev: false

  /is-plain-object/2.0.4:
    resolution: {integrity: sha512-h5PpgXkWitc38BBMYawTYMWJHFZJVnBquFE57xFpjB8pJFiF6gZ+bU+WyI/yqXiFR5mdLsgYNaPe8uao6Uv9Og==}
    engines: {node: '>=0.10.0'}
    dependencies:
      isobject: 3.0.1
    dev: false

  /is-stream/2.0.1:
    resolution: {integrity: sha512-hFoiJiTl63nn+kstHGBtewWSKnQLpyb155KHheA1l39uvtO9nWIop1p3udqPcUd/xbF1VLMO4n7OI6p7RbngDg==}
    engines: {node: '>=8'}
    dev: false

  /is-wsl/2.2.0:
    resolution: {integrity: sha512-fKzAra0rGJUUBwGBgNkHZuToZcn+TtXHpeCgmkMJMMYx1sQDYaCSyjJBSCa2nH1DGm7s3n1oBnohoVTBaN7Lww==}
    engines: {node: '>=8'}
    dependencies:
      is-docker: 2.2.1
    dev: false

  /isarray/1.0.0:
    resolution: {integrity: sha512-VLghIWNM6ELQzo7zwmcg0NmTVyWKYjvIeM83yjp0wRDTmUnrM678fQbcKBo6n2CJEF0szoG//ytg+TKla89ALQ==}
    dev: false

  /isexe/2.0.0:
    resolution: {integrity: sha512-RHxMLp9lnKHGHRng9QFhRCMbYAcVpn69smSGcq3f36xjgVVWThj4qqLbTLlq7Ssj8B+fIQ1EuCEGI2lKsyQeIw==}
    dev: false

  /isobject/3.0.1:
    resolution: {integrity: sha512-WhB9zCku7EGTj/HQQRz5aUQEUeoQZH2bWcltRErOpymJ4boYE6wL9Tbr23krRPSZ+C5zqNSrSw+Cc7sZZ4b7vg==}
    engines: {node: '>=0.10.0'}
    dev: false

  /istanbul-lib-coverage/3.2.0:
    resolution: {integrity: sha512-eOeJ5BHCmHYvQK7xt9GkdHuzuCGS1Y6g9Gvnx3Ym33fz/HpLRYxiS0wHNr+m/MBC8B647Xt608vCDEvhl9c6Mw==}
    engines: {node: '>=8'}
    dev: false

  /istanbul-lib-instrument/5.2.1:
    resolution: {integrity: sha512-pzqtp31nLv/XFOzXGuvhCb8qhjmTVo5vjVk19XE4CRlSWz0KoeJ3bw9XsA7nOp9YBf4qHjwBxkDzKcME/J29Yg==}
    engines: {node: '>=8'}
    dependencies:
      '@babel/core': 7.20.5
      '@babel/parser': 7.20.5
      '@istanbuljs/schema': 0.1.3
      istanbul-lib-coverage: 3.2.0
      semver: 6.3.0
    transitivePeerDependencies:
      - supports-color
    dev: false

  /istanbul-lib-report/3.0.0:
    resolution: {integrity: sha512-wcdi+uAKzfiGT2abPpKZ0hSU1rGQjUQnLvtY5MpQ7QCTahD3VODhcu4wcfY1YtkGaDD5yuydOLINXsfbus9ROw==}
    engines: {node: '>=8'}
    dependencies:
      istanbul-lib-coverage: 3.2.0
      make-dir: 3.1.0
      supports-color: 7.2.0
    dev: false

  /istanbul-lib-source-maps/4.0.1:
    resolution: {integrity: sha512-n3s8EwkdFIJCG3BPKBYvskgXGoy88ARzvegkitk60NxRdwltLOTaH7CUiMRXvwYorl0Q712iEjcWB+fK/MrWVw==}
    engines: {node: '>=10'}
    dependencies:
      debug: 4.3.4
      istanbul-lib-coverage: 3.2.0
      source-map: 0.6.1
    transitivePeerDependencies:
      - supports-color
    dev: false

  /istanbul-reports/3.1.5:
    resolution: {integrity: sha512-nUsEMa9pBt/NOHqbcbeJEgqIlY/K7rVWUX6Lql2orY5e9roQOthbR3vtY4zzf2orPELg80fnxxk9zUyPlgwD1w==}
    engines: {node: '>=8'}
    dependencies:
      html-escaper: 2.0.2
      istanbul-lib-report: 3.0.0
    dev: false

  /jake/10.8.5:
    resolution: {integrity: sha512-sVpxYeuAhWt0OTWITwT98oyV0GsXyMlXCF+3L1SuafBVUIr/uILGRB+NqwkzhgXKvoJpDIpQvqkUALgdmQsQxw==}
    engines: {node: '>=10'}
    hasBin: true
    dependencies:
      async: 3.2.4
      chalk: 4.1.2
      filelist: 1.0.4
      minimatch: 3.1.2
    dev: false

  /jest-circus/28.1.3:
    resolution: {integrity: sha512-cZ+eS5zc79MBwt+IhQhiEp0OeBddpc1n8MBo1nMB8A7oPMKEO+Sre+wHaLJexQUj9Ya/8NOBY0RESUgYjB6fow==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      '@jest/environment': 28.1.3
      '@jest/expect': 28.1.3
      '@jest/test-result': 28.1.3
      '@jest/types': 28.1.3
      '@types/node': 18.11.15
      chalk: 4.1.2
      co: 4.6.0
      dedent: 0.7.0
      is-generator-fn: 2.1.0
      jest-each: 28.1.3
      jest-matcher-utils: 28.1.3
      jest-message-util: 28.1.3
      jest-runtime: 28.1.3
      jest-snapshot: 28.1.3
      jest-util: 28.1.3
      p-limit: 3.1.0
      pretty-format: 28.1.3
      slash: 3.0.0
      stack-utils: 2.0.6
    transitivePeerDependencies:
      - supports-color
    dev: false

  /jest-config/28.1.1_ts-node@10.9.1:
    resolution: {integrity: sha512-tASynMhS+jVV85zKvjfbJ8nUyJS/jUSYZ5KQxLUN2ZCvcQc/OmhQl2j6VEL3ezQkNofxn5pQ3SPYWPHb0unTZA==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    peerDependencies:
      '@types/node': '*'
      ts-node: '>=9.0.0'
    peerDependenciesMeta:
      '@types/node':
        optional: true
      ts-node:
        optional: true
    dependencies:
      '@babel/core': 7.20.5
      '@jest/test-sequencer': 28.1.3
      '@jest/types': 28.1.3
      babel-jest: 28.1.3_@babel+core@7.20.5
      chalk: 4.1.0
      ci-info: 3.7.0
      deepmerge: 4.2.2
      glob: 7.2.3
      graceful-fs: 4.2.10
      jest-circus: 28.1.3
      jest-environment-node: 28.1.3
      jest-get-type: 28.0.2
      jest-regex-util: 28.0.2
      jest-resolve: 28.1.1
      jest-runner: 28.1.3
      jest-util: 28.1.1
      jest-validate: 28.1.3
      micromatch: 4.0.5
      parse-json: 5.2.0
      pretty-format: 28.1.3
      slash: 3.0.0
      strip-json-comments: 3.1.1
      ts-node: 10.9.1_typescript@4.8.4
    transitivePeerDependencies:
      - supports-color
    dev: false

  /jest-diff/28.1.3:
    resolution: {integrity: sha512-8RqP1B/OXzjjTWkqMX67iqgwBVJRgCyKD3L9nq+6ZqJMdvjE8RgHktqZ6jNrkdMT+dJuYNI3rhQpxaz7drJHfw==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      chalk: 4.1.2
      diff-sequences: 28.1.1
      jest-get-type: 28.0.2
      pretty-format: 28.1.3
    dev: false

  /jest-docblock/28.1.1:
    resolution: {integrity: sha512-3wayBVNiOYx0cwAbl9rwm5kKFP8yHH3d/fkEaL02NPTkDojPtheGB7HZSFY4wzX+DxyrvhXz0KSCVksmCknCuA==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      detect-newline: 3.1.0
    dev: false

  /jest-each/28.1.3:
    resolution: {integrity: sha512-arT1z4sg2yABU5uogObVPvSlSMQlDA48owx07BDPAiasW0yYpYHYOo4HHLz9q0BVzDVU4hILFjzJw0So9aCL/g==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      '@jest/types': 28.1.3
      chalk: 4.1.2
      jest-get-type: 28.0.2
      jest-util: 28.1.3
      pretty-format: 28.1.3
    dev: false

  /jest-environment-node/28.1.3:
    resolution: {integrity: sha512-ugP6XOhEpjAEhGYvp5Xj989ns5cB1K6ZdjBYuS30umT4CQEETaxSiPcZ/E1kFktX4GkrcM4qu07IIlDYX1gp+A==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      '@jest/environment': 28.1.3
      '@jest/fake-timers': 28.1.3
      '@jest/types': 28.1.3
      '@types/node': 18.11.15
      jest-mock: 28.1.3
      jest-util: 28.1.3
    dev: false

  /jest-get-type/28.0.2:
    resolution: {integrity: sha512-ioj2w9/DxSYHfOm5lJKCdcAmPJzQXmbM/Url3rhlghrPvT3tt+7a/+oXc9azkKmLvoiXjtV83bEWqi+vs5nlPA==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dev: false

  /jest-haste-map/28.1.3:
    resolution: {integrity: sha512-3S+RQWDXccXDKSWnkHa/dPwt+2qwA8CJzR61w3FoYCvoo3Pn8tvGcysmMF0Bj0EX5RYvAI2EIvC57OmotfdtKA==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      '@jest/types': 28.1.3
      '@types/graceful-fs': 4.1.5
      '@types/node': 18.11.15
      anymatch: 3.1.3
      fb-watchman: 2.0.2
      graceful-fs: 4.2.10
      jest-regex-util: 28.0.2
      jest-util: 28.1.3
      jest-worker: 28.1.3
      micromatch: 4.0.5
      walker: 1.0.8
    optionalDependencies:
      fsevents: 2.3.2
    dev: false

  /jest-leak-detector/28.1.3:
    resolution: {integrity: sha512-WFVJhnQsiKtDEo5lG2mM0v40QWnBM+zMdHHyJs8AWZ7J0QZJS59MsyKeJHWhpBZBH32S48FOVvGyOFT1h0DlqA==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      jest-get-type: 28.0.2
      pretty-format: 28.1.3
    dev: false

  /jest-matcher-utils/28.1.3:
    resolution: {integrity: sha512-kQeJ7qHemKfbzKoGjHHrRKH6atgxMk8Enkk2iPQ3XwO6oE/KYD8lMYOziCkeSB9G4adPM4nR1DE8Tf5JeWH6Bw==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      chalk: 4.1.2
      jest-diff: 28.1.3
      jest-get-type: 28.0.2
      pretty-format: 28.1.3
    dev: false

  /jest-message-util/28.1.3:
    resolution: {integrity: sha512-PFdn9Iewbt575zKPf1286Ht9EPoJmYT7P0kY+RibeYZ2XtOr53pDLEFoTWXbd1h4JiGiWpTBC84fc8xMXQMb7g==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      '@babel/code-frame': 7.18.6
      '@jest/types': 28.1.3
      '@types/stack-utils': 2.0.1
      chalk: 4.1.2
      graceful-fs: 4.2.10
      micromatch: 4.0.5
      pretty-format: 28.1.3
      slash: 3.0.0
      stack-utils: 2.0.6
    dev: false

  /jest-mock/28.1.3:
    resolution: {integrity: sha512-o3J2jr6dMMWYVH4Lh/NKmDXdosrsJgi4AviS8oXLujcjpCMBb1FMsblDnOXKZKfSiHLxYub1eS0IHuRXsio9eA==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      '@jest/types': 28.1.3
      '@types/node': 18.11.15
    dev: false

  /jest-pnp-resolver/1.2.3_jest-resolve@28.1.1:
    resolution: {integrity: sha512-+3NpwQEnRoIBtx4fyhblQDPgJI0H1IEIkX7ShLUjPGA7TtUTvI1oiKi3SR4oBR0hQhQR80l4WAe5RrXBwWMA8w==}
    engines: {node: '>=6'}
    peerDependencies:
      jest-resolve: '*'
    peerDependenciesMeta:
      jest-resolve:
        optional: true
    dependencies:
      jest-resolve: 28.1.1
    dev: false

  /jest-pnp-resolver/1.2.3_jest-resolve@28.1.3:
    resolution: {integrity: sha512-+3NpwQEnRoIBtx4fyhblQDPgJI0H1IEIkX7ShLUjPGA7TtUTvI1oiKi3SR4oBR0hQhQR80l4WAe5RrXBwWMA8w==}
    engines: {node: '>=6'}
    peerDependencies:
      jest-resolve: '*'
    peerDependenciesMeta:
      jest-resolve:
        optional: true
    dependencies:
      jest-resolve: 28.1.3
    dev: false

  /jest-regex-util/28.0.2:
    resolution: {integrity: sha512-4s0IgyNIy0y9FK+cjoVYoxamT7Zeo7MhzqRGx7YDYmaQn1wucY9rotiGkBzzcMXTtjrCAP/f7f+E0F7+fxPNdw==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dev: false

  /jest-resolve/28.1.1:
    resolution: {integrity: sha512-/d1UbyUkf9nvsgdBildLe6LAD4DalgkgZcKd0nZ8XUGPyA/7fsnaQIlKVnDiuUXv/IeZhPEDrRJubVSulxrShA==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      chalk: 4.1.0
      graceful-fs: 4.2.10
      jest-haste-map: 28.1.3
      jest-pnp-resolver: 1.2.3_jest-resolve@28.1.1
      jest-util: 28.1.1
      jest-validate: 28.1.3
      resolve: 1.22.1
      resolve.exports: 1.1.0
      slash: 3.0.0
    dev: false

  /jest-resolve/28.1.3:
    resolution: {integrity: sha512-Z1W3tTjE6QaNI90qo/BJpfnvpxtaFTFw5CDgwpyE/Kz8U/06N1Hjf4ia9quUhCh39qIGWF1ZuxFiBiJQwSEYKQ==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      chalk: 4.1.2
      graceful-fs: 4.2.10
      jest-haste-map: 28.1.3
      jest-pnp-resolver: 1.2.3_jest-resolve@28.1.3
      jest-util: 28.1.3
      jest-validate: 28.1.3
      resolve: 1.22.1
      resolve.exports: 1.1.0
      slash: 3.0.0
    dev: false

  /jest-runner/28.1.3:
    resolution: {integrity: sha512-GkMw4D/0USd62OVO0oEgjn23TM+YJa2U2Wu5zz9xsQB1MxWKDOlrnykPxnMsN0tnJllfLPinHTka61u0QhaxBA==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      '@jest/console': 28.1.3
      '@jest/environment': 28.1.3
      '@jest/test-result': 28.1.3
      '@jest/transform': 28.1.3
      '@jest/types': 28.1.3
      '@types/node': 18.11.15
      chalk: 4.1.2
      emittery: 0.10.2
      graceful-fs: 4.2.10
      jest-docblock: 28.1.1
      jest-environment-node: 28.1.3
      jest-haste-map: 28.1.3
      jest-leak-detector: 28.1.3
      jest-message-util: 28.1.3
      jest-resolve: 28.1.3
      jest-runtime: 28.1.3
      jest-util: 28.1.3
      jest-watcher: 28.1.3
      jest-worker: 28.1.3
      p-limit: 3.1.0
      source-map-support: 0.5.13
    transitivePeerDependencies:
      - supports-color
    dev: false

  /jest-runtime/28.1.3:
    resolution: {integrity: sha512-NU+881ScBQQLc1JHG5eJGU7Ui3kLKrmwCPPtYsJtBykixrM2OhVQlpMmFWJjMyDfdkGgBMNjXCGB/ebzsgNGQw==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      '@jest/environment': 28.1.3
      '@jest/fake-timers': 28.1.3
      '@jest/globals': 28.1.3
      '@jest/source-map': 28.1.2
      '@jest/test-result': 28.1.3
      '@jest/transform': 28.1.3
      '@jest/types': 28.1.3
      chalk: 4.1.2
      cjs-module-lexer: 1.2.2
      collect-v8-coverage: 1.0.1
      execa: 5.1.1
      glob: 7.2.3
      graceful-fs: 4.2.10
      jest-haste-map: 28.1.3
      jest-message-util: 28.1.3
      jest-mock: 28.1.3
      jest-regex-util: 28.0.2
      jest-resolve: 28.1.3
      jest-snapshot: 28.1.3
      jest-util: 28.1.3
      slash: 3.0.0
      strip-bom: 4.0.0
    transitivePeerDependencies:
      - supports-color
    dev: false

  /jest-snapshot/28.1.3:
    resolution: {integrity: sha512-4lzMgtiNlc3DU/8lZfmqxN3AYD6GGLbl+72rdBpXvcV+whX7mDrREzkPdp2RnmfIiWBg1YbuFSkXduF2JcafJg==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      '@babel/core': 7.20.5
      '@babel/generator': 7.20.5
      '@babel/plugin-syntax-typescript': 7.20.0_@babel+core@7.20.5
      '@babel/traverse': 7.20.5
      '@babel/types': 7.20.5
      '@jest/expect-utils': 28.1.3
      '@jest/transform': 28.1.3
      '@jest/types': 28.1.3
      '@types/babel__traverse': 7.18.3
      '@types/prettier': 2.7.1
      babel-preset-current-node-syntax: 1.0.1_@babel+core@7.20.5
      chalk: 4.1.2
      expect: 28.1.3
      graceful-fs: 4.2.10
      jest-diff: 28.1.3
      jest-get-type: 28.0.2
      jest-haste-map: 28.1.3
      jest-matcher-utils: 28.1.3
      jest-message-util: 28.1.3
      jest-util: 28.1.3
      natural-compare: 1.4.0
      pretty-format: 28.1.3
      semver: 7.3.8
    transitivePeerDependencies:
      - supports-color
    dev: false

  /jest-util/28.1.1:
    resolution: {integrity: sha512-FktOu7ca1DZSyhPAxgxB6hfh2+9zMoJ7aEQA759Z6p45NuO8mWcqujH+UdHlCm/V6JTWwDztM2ITCzU1ijJAfw==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      '@jest/types': 28.1.3
      '@types/node': 18.11.15
      chalk: 4.1.0
      ci-info: 3.7.0
      graceful-fs: 4.2.10
      picomatch: 2.3.1
    dev: false

  /jest-util/28.1.3:
    resolution: {integrity: sha512-XdqfpHwpcSRko/C35uLYFM2emRAltIIKZiJ9eAmhjsj0CqZMa0p1ib0R5fWIqGhn1a103DebTbpqIaP1qCQ6tQ==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      '@jest/types': 28.1.3
      '@types/node': 18.11.15
      chalk: 4.1.2
      ci-info: 3.7.0
      graceful-fs: 4.2.10
      picomatch: 2.3.1
    dev: false

  /jest-validate/28.1.3:
    resolution: {integrity: sha512-SZbOGBWEsaTxBGCOpsRWlXlvNkvTkY0XxRfh7zYmvd8uL5Qzyg0CHAXiXKROflh801quA6+/DsT4ODDthOC/OA==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      '@jest/types': 28.1.3
      camelcase: 6.3.0
      chalk: 4.1.2
      jest-get-type: 28.0.2
      leven: 3.1.0
      pretty-format: 28.1.3
    dev: false

  /jest-watcher/28.1.3:
    resolution: {integrity: sha512-t4qcqj9hze+jviFPUN3YAtAEeFnr/azITXQEMARf5cMwKY2SMBRnCQTXLixTl20OR6mLh9KLMrgVJgJISym+1g==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      '@jest/test-result': 28.1.3
      '@jest/types': 28.1.3
      '@types/node': 18.11.15
      ansi-escapes: 4.3.2
      chalk: 4.1.2
      emittery: 0.10.2
      jest-util: 28.1.3
      string-length: 4.0.2
    dev: false

  /jest-worker/27.5.1:
    resolution: {integrity: sha512-7vuh85V5cdDofPyxn58nrPjBktZo0u9x1g8WtjQol+jZDaE+fhN+cIvTj11GndBnMnyfrUOG1sZQxCdjKh+DKg==}
    engines: {node: '>= 10.13.0'}
    dependencies:
      '@types/node': 18.11.15
      merge-stream: 2.0.0
      supports-color: 8.1.1
    dev: false

  /jest-worker/28.1.3:
    resolution: {integrity: sha512-CqRA220YV/6jCo8VWvAt1KKx6eek1VIHMPeLEbpcfSfkEeWyBNppynM/o6q+Wmw+sOhos2ml34wZbSX3G13//g==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      '@types/node': 18.11.15
      merge-stream: 2.0.0
      supports-color: 8.1.1
    dev: false

  /js-tokens/4.0.0:
    resolution: {integrity: sha512-RdJUflcE3cUzKiMqQgsCu06FPu9UdIJO0beYbPhHN4k6apgJtifcoCtT9bcxOpYBtpD2kCM6Sbzg4CausW/PKQ==}
    dev: false

  /js-yaml/3.14.1:
    resolution: {integrity: sha512-okMH7OXXJ7YrN9Ok3/SXrnu4iX9yOk+25nqX4imS2npuvTYDmo/QEZoqwZkYaIDk3jVvBOTOIEgEhaLOynBS9g==}
    hasBin: true
    dependencies:
      argparse: 1.0.10
      esprima: 4.0.1
    dev: false

  /js-yaml/4.1.0:
    resolution: {integrity: sha512-wpxZs9NoxZaJESJGIZTyDEaYpl0FKSA+FB9aJiyemKhMwkxQg63h4T1KJgUGHpTqPDNRcmmYLugrRjJlBtWvRA==}
    hasBin: true
    dependencies:
      argparse: 2.0.1
    dev: false

  /jsesc/0.5.0:
    resolution: {integrity: sha512-uZz5UnB7u4T9LvwmFqXii7pZSouaRPorGs5who1Ip7VO0wxanFvBL7GkM6dTHlgX+jhBApRetaWpnDabOeTcnA==}
    hasBin: true
    dev: false

  /jsesc/2.5.2:
    resolution: {integrity: sha512-OYu7XEzjkCQ3C5Ps3QIZsQfNpqoJyZZA99wd9aWd05NCtC5pWOkShK2mkL6HXQR6/Cy2lbNdPlZBpuQHXE63gA==}
    engines: {node: '>=4'}
    hasBin: true
    dev: false

  /json-parse-even-better-errors/2.3.1:
    resolution: {integrity: sha512-xyFwyhro/JEof6Ghe2iz2NcXoj2sloNsWr/XsERDK/oiPCfaNhl5ONfp+jQdAZRQQ0IJWNzH9zIZF7li91kh2w==}
    dev: false

  /json-schema-traverse/0.4.1:
    resolution: {integrity: sha512-xbbCH5dCYU5T8LcEhhuh7HJ88HXuW3qsI3Y0zOZFKfZEHcpWiHU/Jxzk629Brsab/mMiHQti9wMP+845RPe3Vg==}
    dev: false

  /json-schema-traverse/1.0.0:
    resolution: {integrity: sha512-NM8/P9n3XjXhIZn1lLhkFaACTOURQXjWhV4BA/RnOv8xvgqtqpAX9IO4mRQxSx1Rlo4tqzeqb0sOlruaOy3dug==}
    dev: false

  /json5/1.0.1:
    resolution: {integrity: sha512-aKS4WQjPenRxiQsC93MNfjx+nbF4PAdYzmd/1JIj8HYzqfbu86beTuNgXDzPknWk0n0uARlyewZo4s++ES36Ow==}
    hasBin: true
    dependencies:
      minimist: 1.2.7
    dev: false

  /json5/2.2.1:
    resolution: {integrity: sha512-1hqLFMSrGHRHxav9q9gNjJ5EXznIxGVO09xQRrwplcS8qs28pZ8s8hupZAmqDwZUmVZ2Qb2jnyPOWcDH8m8dlA==}
    engines: {node: '>=6'}
    hasBin: true
    dev: false

  /jsonc-parser/3.2.0:
    resolution: {integrity: sha512-gfFQZrcTc8CnKXp6Y4/CBT3fTc0OVuDofpre4aEeEpSBPV5X5v4+Vmx+8snU7RLPrNHPKSgLxGo9YuQzz20o+w==}
    dev: false

  /jsonfile/6.1.0:
    resolution: {integrity: sha512-5dgndWOriYSm5cnYaJNhalLNDKOqFwyDB/rr1E9ZsGciGvKPs8R2xYGCacuf3z6K1YKDz182fd+fY3cn3pMqXQ==}
    dependencies:
      universalify: 2.0.0
    optionalDependencies:
      graceful-fs: 4.2.10
    dev: false

  /kind-of/6.0.3:
    resolution: {integrity: sha512-dcS1ul+9tmeD95T+x28/ehLgd9mENa3LsvDTtzm3vyBEO7RPptvAD+t44WVXaUjTBRcrpFeFlC8WCruUR456hw==}
    engines: {node: '>=0.10.0'}
    dev: false

  /klona/2.0.5:
    resolution: {integrity: sha512-pJiBpiXMbt7dkzXe8Ghj/u4FfXOOa98fPW+bihOJ4SjnoijweJrNThJfd3ifXpXhREjpoF2mZVH1GfS9LV3kHQ==}
    engines: {node: '>= 8'}
    dev: false

  /less-loader/11.1.0_less@3.12.2+webpack@5.75.0:
    resolution: {integrity: sha512-C+uDBV7kS7W5fJlUjq5mPBeBVhYpTIm5gB09APT9o3n/ILeaXVsiSFTbZpTJCJwQ/Crczfn3DmfQFwxYusWFug==}
    engines: {node: '>= 14.15.0'}
    peerDependencies:
      less: ^3.5.0 || ^4.0.0
      webpack: ^5.0.0
    dependencies:
      klona: 2.0.5
      less: 3.12.2
      webpack: 5.75.0
    dev: false

  /less/3.12.2:
    resolution: {integrity: sha512-+1V2PCMFkL+OIj2/HrtrvZw0BC0sYLMICJfbQjuj/K8CEnlrFX6R5cKKgzzttsZDHyxQNL1jqMREjKN3ja/E3Q==}
    engines: {node: '>=6'}
    hasBin: true
    dependencies:
      tslib: 1.14.1
    optionalDependencies:
      errno: 0.1.8
      graceful-fs: 4.2.10
      image-size: 0.5.5
      make-dir: 2.1.0
      mime: 1.6.0
      native-request: 1.1.0
      source-map: 0.6.1
    dev: false

  /leven/3.1.0:
    resolution: {integrity: sha512-qsda+H8jTaUaN/x5vzW2rzc+8Rw4TAQ/4KjB46IwK5VH+IlVeeeje/EoZRpiXvIqjFgK84QffqPztGI3VBLG1A==}
    engines: {node: '>=6'}
    dev: false

  /license-webpack-plugin/4.0.2_webpack@5.75.0:
    resolution: {integrity: sha512-771TFWFD70G1wLTC4oU2Cw4qvtmNrIw+wRvBtn+okgHl7slJVi7zfNcdmqDL72BojM30VNJ2UHylr1o77U37Jw==}
    peerDependencies:
      webpack: '*'
    peerDependenciesMeta:
      webpack:
        optional: true
      webpack-sources:
        optional: true
    dependencies:
      webpack: 5.75.0
      webpack-sources: 3.2.3
    dev: false

  /lilconfig/2.0.6:
    resolution: {integrity: sha512-9JROoBW7pobfsx+Sq2JsASvCo6Pfo6WWoUW79HuB1BCoBXD4PLWJPqDF6fNj67pqBYTbAHkE57M1kS/+L1neOg==}
    engines: {node: '>=10'}
    dev: false

  /lines-and-columns/1.2.4:
    resolution: {integrity: sha512-7ylylesZQ/PV29jhEDl3Ufjo6ZX7gCqJr5F7PKrqc93v7fzSymt1BpwEU8nAUXs8qzzvqhbjhK5QZg6Mt/HkBg==}
    dev: false

  /loader-runner/4.3.0:
    resolution: {integrity: sha512-3R/1M+yS3j5ou80Me59j7F9IMs4PXs3VqRrm0TU3AbKPxlmpoY1TNscJV/oGJXo8qCatFGTfDbY6W6ipGOYXfg==}
    engines: {node: '>=6.11.5'}
    dev: false

  /loader-utils/2.0.4:
    resolution: {integrity: sha512-xXqpXoINfFhgua9xiqD8fPFHgkoq1mmmpE92WlDbm9rNRd/EbRb+Gqf908T2DMfuHjjJlksiK2RbHVOdD/MqSw==}
    engines: {node: '>=8.9.0'}
    dependencies:
      big.js: 5.2.2
      emojis-list: 3.0.0
      json5: 2.2.1
    dev: false

  /locate-path/5.0.0:
    resolution: {integrity: sha512-t7hw9pI+WvuwNJXwk5zVHpyhIqzg2qTlklJOf0mVxGSbe3Fp2VieZcduNYjaLDoy6p9uGpQEGWG87WpMKlNq8g==}
    engines: {node: '>=8'}
    dependencies:
      p-locate: 4.1.0
    dev: false

  /lodash.debounce/4.0.8:
    resolution: {integrity: sha512-FT1yDzDYEoYWhnSGnpE/4Kj1fLZkDFyqRb7fNt6FdYOSxlUWAtp42Eh6Wb0rGIv/m9Bgo7x4GhQbm5Ys4SG5ow==}
    dev: false

  /lodash.memoize/4.1.2:
    resolution: {integrity: sha512-t7j+NzmgnQzTAYXcsHYLgimltOV1MXHtlOWf6GjL9Kj8GK5FInw5JotxvbOs+IvV1/Dzo04/fCGfLVs7aXb4Ag==}
    dev: false

  /lodash.uniq/4.5.0:
    resolution: {integrity: sha512-xfBaXQd9ryd9dlSDvnvI0lvxfLJlYAZzXomUYzLKtUeOQvOP5piqAWuGtrhWeqaXK9hhoM/iyJc5AV+XfsX3HQ==}
    dev: false

  /lodash/4.17.21:
    resolution: {integrity: sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg==}
    dev: false

  /loose-envify/1.4.0:
    resolution: {integrity: sha512-lyuxPGr/Wfhrlem2CL/UcnUc1zcqKAImBDzukY7Y5F/yQiNdko6+fRLevlw1HgMySw7f611UIY408EtxRSoK3Q==}
    hasBin: true
    dependencies:
      js-tokens: 4.0.0
    dev: false

  /lru-cache/6.0.0:
    resolution: {integrity: sha512-Jo6dJ04CmSjuznwJSS3pUeWmd/H0ffTlkXXgwZi+eq1UCmqQwCh+eLsYOYCwY991i2Fah4h1BEMCx4qThGbsiA==}
    engines: {node: '>=10'}
    dependencies:
      yallist: 4.0.0
    dev: false

  /make-dir/2.1.0:
    resolution: {integrity: sha512-LS9X+dc8KLxXCb8dni79fLIIUA5VyZoyjSMCwTluaXA0o27cCK0bhXkpgw+sTXVpPy/lSO57ilRixqk0vDmtRA==}
    engines: {node: '>=6'}
    requiresBuild: true
    dependencies:
      pify: 4.0.1
      semver: 5.7.1
    dev: false
    optional: true

  /make-dir/3.1.0:
    resolution: {integrity: sha512-g3FeP20LNwhALb/6Cz6Dd4F2ngze0jz7tbzrD2wAV+o9FeNHe4rL+yK2md0J/fiSf1sa1ADhXqi5+oVwOM/eGw==}
    engines: {node: '>=8'}
    dependencies:
      semver: 6.3.0
    dev: false

  /make-error/1.3.6:
    resolution: {integrity: sha512-s8UhlNe7vPKomQhC1qFelMokr/Sc3AgNbso3n74mVPA5LTZwkB9NlXf4XPamLxJE8h0gh73rM94xvwRT2CVInw==}
    dev: false

  /makeerror/1.0.12:
    resolution: {integrity: sha512-JmqCvUhmt43madlpFzG4BQzG2Z3m6tvQDNKdClZnO3VbIudJYmxsT0FNJMeiB2+JTSlTQTSbU8QdesVmwJcmLg==}
    dependencies:
      tmpl: 1.0.5
    dev: false

  /md5/2.3.0:
    resolution: {integrity: sha512-T1GITYmFaKuO91vxyoQMFETst+O71VUPEU3ze5GNzDm0OWdP8v1ziTaAEPUr/3kLsY3Sftgz242A1SetQiDL7g==}
    dependencies:
      charenc: 0.0.2
      crypt: 0.0.2
      is-buffer: 1.1.6
    dev: false

  /mdn-data/2.0.14:
    resolution: {integrity: sha512-dn6wd0uw5GsdswPFfsgMp5NSB0/aDe6fK94YJV/AJDYXL6HVLWBsxeq7js7Ad+mU2K9LAlwpk6kN2D5mwCPVow==}
    dev: false

  /media-typer/0.3.0:
    resolution: {integrity: sha512-dq+qelQ9akHpcOl/gUVRTxVIOkAJ1wR3QAvb4RsVjS8oVoFjDGTc679wJYmUmknUF5HwMLOgb5O+a3KxfWapPQ==}
    engines: {node: '>= 0.6'}
    dev: false

  /memfs/3.4.12:
    resolution: {integrity: sha512-BcjuQn6vfqP+k100e0E9m61Hyqa//Brp+I3f0OBmN0ATHlFA8vx3Lt8z57R3u2bPqe3WGDBC+nF72fTH7isyEw==}
    engines: {node: '>= 4.0.0'}
    dependencies:
      fs-monkey: 1.0.3
    dev: false

  /merge-descriptors/1.0.1:
    resolution: {integrity: sha512-cCi6g3/Zr1iqQi6ySbseM1Xvooa98N0w31jzUYrXPX2xqObmFGHJ0tQ5u74H3mVh7wLouTseZyYIq39g8cNp1w==}
    dev: false

  /merge-stream/2.0.0:
    resolution: {integrity: sha512-abv/qOcuPfk3URPfDzmZU1LKmuw8kT+0nIHvKrKgFrwifol/doWcdA4ZqsWQ8ENrFKkd67Mfpo/LovbIUsbt3w==}
    dev: false

  /merge2/1.4.1:
    resolution: {integrity: sha512-8q7VEgMJW4J8tcfVPy8g09NcQwZdbwFEqhe/WZkoIzjn/3TGDwtOCYtXGxA3O8tPzpczCCDgv+P2P5y00ZJOOg==}
    engines: {node: '>= 8'}
    dev: false

  /methods/1.1.2:
    resolution: {integrity: sha512-iclAHeNqNm68zFtnZ0e+1L2yUIdvzNoauKU4WBA3VvH/vPFieF7qfRlwUZU+DA9P9bPXIS90ulxoUoCH23sV2w==}
    engines: {node: '>= 0.6'}
    dev: false

  /micromatch/4.0.5:
    resolution: {integrity: sha512-DMy+ERcEW2q8Z2Po+WNXuw3c5YaUSFjAO5GsJqfEl7UjvtIuFKO6ZrKvcItdy98dwFI2N1tg3zNIdKaQT+aNdA==}
    engines: {node: '>=8.6'}
    dependencies:
      braces: 3.0.2
      picomatch: 2.3.1
    dev: false

  /mime-db/1.52.0:
    resolution: {integrity: sha512-sPU4uV7dYlvtWJxwwxHD0PuihVNiE7TyAbQ5SWxDCB9mUYvOgroQOwYQQOKPJ8CIbE+1ETVlOoK1UC2nU3gYvg==}
    engines: {node: '>= 0.6'}
    dev: false

  /mime-types/2.1.35:
    resolution: {integrity: sha512-ZDY+bPm5zTTF+YpCrAU9nK0UgICYPT0QtT1NZWFv4s++TNkcgVaT0g6+4R2uI4MjQjzysHB1zxuWL50hzaeXiw==}
    engines: {node: '>= 0.6'}
    dependencies:
      mime-db: 1.52.0
    dev: false

  /mime/1.6.0:
    resolution: {integrity: sha512-x0Vn8spI+wuJ1O6S7gnbaQg8Pxh4NNHb7KSINmEWKiPE4RKOplvijn+NkmYmmRgP68mc70j2EbeTFRsrswaQeg==}
    engines: {node: '>=4'}
    hasBin: true
    dev: false

  /mimic-fn/2.1.0:
    resolution: {integrity: sha512-OqbOk5oEQeAZ8WXWydlu9HJjz9WVdEIvamMCcXmuqUYjTknH/sqsWvhQ3vgwKFRR1HpjvNBKQ37nbJgYzGqGcg==}
    engines: {node: '>=6'}
    dev: false

  /mini-css-extract-plugin/2.4.7_webpack@5.75.0:
    resolution: {integrity: sha512-euWmddf0sk9Nv1O0gfeeUAvAkoSlWncNLF77C0TP2+WoPvy8mAHKOzMajcCz2dzvyt3CNgxb1obIEVFIRxaipg==}
    engines: {node: '>= 12.13.0'}
    peerDependencies:
      webpack: ^5.0.0
    dependencies:
      schema-utils: 4.0.0
      webpack: 5.75.0
    dev: false

  /minimalistic-assert/1.0.1:
    resolution: {integrity: sha512-UtJcAD4yEaGtjPezWuO9wC4nwUnVH/8/Im3yEHQP4b67cXlD/Qr9hdITCU1xDbSEXg2XKNaP8jsReV7vQd00/A==}
    dev: false

  /minimatch/3.0.5:
    resolution: {integrity: sha512-tUpxzX0VAzJHjLu0xUfFv1gwVp9ba3IOuRAVH2EGuRW8a5emA2FlACLqiT/lDVtS1W+TGNwqz3sWaNyLgDJWuw==}
    dependencies:
      brace-expansion: 1.1.11
    dev: false

  /minimatch/3.1.2:
    resolution: {integrity: sha512-J7p63hRiAjw1NDEww1W7i37+ByIrOWO5XQQAzZ3VOcL0PNybwpfmV/N05zFAzwQ9USyEcX6t3UO+K5aqBQOIHw==}
    dependencies:
      brace-expansion: 1.1.11
    dev: false

  /minimatch/5.1.1:
    resolution: {integrity: sha512-362NP+zlprccbEt/SkxKfRMHnNY85V74mVnpUpNyr3F35covl09Kec7/sEFLt3RA4oXmewtoaanoIf67SE5Y5g==}
    engines: {node: '>=10'}
    dependencies:
      brace-expansion: 2.0.1
    dev: false

  /minimist/1.2.7:
    resolution: {integrity: sha512-bzfL1YUZsP41gmu/qjrEk0Q6i2ix/cVeAhbCbqH9u3zYutS1cLg00qhrD0M2MVdCcx4Sc0UpP2eBWo9rotpq6g==}
    dev: false

  /mkdirp/1.0.4:
    resolution: {integrity: sha512-vVqVZQyf3WLx2Shd0qJ9xuvqgAyKPLAiqITEtqW0oIUjzo3PePDd6fW9iFz30ef7Ysp/oiWqbhszeGWW2T6Gzw==}
    engines: {node: '>=10'}
    hasBin: true
    dev: false

  /ms/2.0.0:
    resolution: {integrity: sha512-Tpp60P6IUJDTuOq/5Z8cdskzJujfwqfOTkrwIwj7IRISpnkJnT6SyJ4PCPnGMoFjC9ddhal5KVIYtAt97ix05A==}
    dev: false

  /ms/2.1.2:
    resolution: {integrity: sha512-sGkPx+VjMtmA6MX27oA4FBFELFCZZ4S4XqeGOXCv68tT+jb3vk/RyaKWP0PTKyWtmLSM0b+adUTEvbs1PEaH2w==}
    dev: false

  /ms/2.1.3:
    resolution: {integrity: sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==}
    dev: false

  /multicast-dns/7.2.5:
    resolution: {integrity: sha512-2eznPJP8z2BFLX50tf0LuODrpINqP1RVIm/CObbTcBRITQgmC/TjcREF1NeTBzIcR5XO/ukWo+YHOjBbFwIupg==}
    hasBin: true
    dependencies:
      dns-packet: 5.4.0
      thunky: 1.1.0
    dev: false

  /nanoid/3.3.4:
    resolution: {integrity: sha512-MqBkQh/OHTS2egovRtLk45wEyNXwF+cokD+1YPf9u5VfJiRdAiRwB2froX5Co9Rh20xs4siNPm8naNotSD6RBw==}
    engines: {node: ^10 || ^12 || ^13.7 || ^14 || >=15.0.1}
    hasBin: true
    dev: false

  /native-request/1.1.0:
    resolution: {integrity: sha512-uZ5rQaeRn15XmpgE0xoPL8YWqcX90VtCFglYwAgkvKM5e8fog+vePLAhHxuuv/gRkrQxIeh5U3q9sMNUrENqWw==}
    requiresBuild: true
    dev: false
    optional: true

  /natural-compare/1.4.0:
    resolution: {integrity: sha512-OWND8ei3VtNC9h7V60qff3SVobHr996CTwgxubgyQYEpg290h9J0buyECNNJexkFm5sOajh5G116RYA1c8ZMSw==}
    dev: false

  /negotiator/0.6.3:
    resolution: {integrity: sha512-+EUsqGPLsM+j/zdChZjsnX51g4XrHFOIXwfnCVPGlQk/k5giakcKsuxCObBRu6DSm9opw/O6slWbJdghQM4bBg==}
    engines: {node: '>= 0.6'}
    dev: false

  /neo-async/2.6.2:
    resolution: {integrity: sha512-Yd3UES5mWCSqR+qNT93S3UoYUkqAZ9lLg8a7g9rimsWmYGK8cVToA4/sF3RrshdyV3sAGMXVUmpMYOw+dLpOuw==}
    dev: false

  /next/13.0.0_biqbaboplfbrettd7655fr4n2y:
    resolution: {integrity: sha512-puH1WGM6rGeFOoFdXXYfUxN9Sgi4LMytCV5HkQJvVUOhHfC1DoVqOfvzaEteyp6P04IW+gbtK2Q9pInVSrltPA==}
    engines: {node: '>=14.6.0'}
    hasBin: true
    peerDependencies:
      fibers: '>= 3.1.0'
      node-sass: ^6.0.0 || ^7.0.0
      react: ^18.0.0-0
      react-dom: ^18.0.0-0
      sass: ^1.3.0
    peerDependenciesMeta:
      fibers:
        optional: true
      node-sass:
        optional: true
      sass:
        optional: true
    dependencies:
      '@next/env': 13.0.0
      '@swc/helpers': 0.4.11
      caniuse-lite: 1.0.30001439
      postcss: 8.4.14
      react: 18.2.0
      react-dom: 18.2.0_react@18.2.0
      styled-jsx: 5.1.0_react@18.2.0
      use-sync-external-store: 1.2.0_react@18.2.0
    optionalDependencies:
      '@next/swc-android-arm-eabi': 13.0.0
      '@next/swc-android-arm64': 13.0.0
      '@next/swc-darwin-arm64': 13.0.0
      '@next/swc-darwin-x64': 13.0.0
      '@next/swc-freebsd-x64': 13.0.0
      '@next/swc-linux-arm-gnueabihf': 13.0.0
      '@next/swc-linux-arm64-gnu': 13.0.0
      '@next/swc-linux-arm64-musl': 13.0.0
      '@next/swc-linux-x64-gnu': 13.0.0
      '@next/swc-linux-x64-musl': 13.0.0
      '@next/swc-win32-arm64-msvc': 13.0.0
      '@next/swc-win32-ia32-msvc': 13.0.0
      '@next/swc-win32-x64-msvc': 13.0.0
    transitivePeerDependencies:
      - '@babel/core'
      - babel-plugin-macros
    dev: false

  /node-abort-controller/3.0.1:
    resolution: {integrity: sha512-/ujIVxthRs+7q6hsdjHMaj8hRG9NuWmwrz+JdRwZ14jdFoKSkm+vDsCbF9PLpnSqjaWQJuTmVtcWHNLr+vrOFw==}
    dev: false

  /node-addon-api/3.2.1:
    resolution: {integrity: sha512-mmcei9JghVNDYydghQmeDX8KoAm0FAiYyIcUt/N4nhyAipB17pllZQDOJD2fotxABnt4Mdz+dKTO7eftLg4d0A==}
    dev: false

  /node-forge/1.3.1:
    resolution: {integrity: sha512-dPEtOeMvF9VMcYV/1Wb8CPoVAXtp6MKMlcbAt4ddqmGqUJ6fQZFXkNZNkNlfevtNkGtaSoXf/vNNNSvgrdXwtA==}
    engines: {node: '>= 6.13.0'}
    dev: false

  /node-gyp-build/4.5.0:
    resolution: {integrity: sha512-2iGbaQBV+ITgCz76ZEjmhUKAKVf7xfY1sRl4UiKQspfZMH2h06SyhNsnSVy50cwkFQDGLyif6m/6uFXHkOZ6rg==}
    hasBin: true
    dev: false

  /node-int64/0.4.0:
    resolution: {integrity: sha512-O5lz91xSOeoXP6DulyHfllpq+Eg00MWitZIbtPfoSEvqIHdl5gfcY6hYzDWnj0qD5tz52PI08u9qUvSVeUBeHw==}
    dev: false

  /node-releases/2.0.7:
    resolution: {integrity: sha512-EJ3rzxL9pTWPjk5arA0s0dgXpnyiAbJDE6wHT62g7VsgrgQgmmZ+Ru++M1BFofncWja+Pnn3rEr3fieRySAdKQ==}
    dev: false

  /normalize-path/3.0.0:
    resolution: {integrity: sha512-6eZs5Ls3WtCisHWp9S2GUy8dqkpGi4BVSz3GaqiE6ezub0512ESztXUwUB6C6IKbQkY2Pnb/mD4WYojCRwcwLA==}
    engines: {node: '>=0.10.0'}
    dev: false

  /normalize-range/0.1.2:
    resolution: {integrity: sha512-bdok/XvKII3nUpklnV6P2hxtMNrCboOjAcyBuQnWEhO665FwrSNRxU+AqpsyvO6LgGYPspN+lu5CLtw4jPRKNA==}
    engines: {node: '>=0.10.0'}
    dev: false

  /normalize-url/6.1.0:
    resolution: {integrity: sha512-DlL+XwOy3NxAQ8xuC0okPgK46iuVNAK01YN7RueYBqqFeGsBjV9XmCAzAdgt+667bCl5kPh9EqKKDwnaPG1I7A==}
    engines: {node: '>=10'}
    dev: false

  /npm-run-path/4.0.1:
    resolution: {integrity: sha512-S48WzZW777zhNIrn7gxOlISNAqi9ZC/uQFnRdbeIHhZhCA6UqpkOT8T1G7BvfdgP4Er8gF4sUbaS0i7QvIfCWw==}
    engines: {node: '>=8'}
    dependencies:
      path-key: 3.1.1
    dev: false

  /nth-check/2.1.1:
    resolution: {integrity: sha512-lqjrjmaOoAnWfMmBPL+XNnynZh2+swxiX3WUE0s4yEHI6m+AwrK2UZOimIRl3X/4QctVqS8AiZjFqyOGrMXb/w==}
    dependencies:
      boolbase: 1.0.0
    dev: false

  /nx/15.3.3:
    resolution: {integrity: sha512-yR102AlVW5Sb7X1e9cyR+0h44RD6c3eLJbAZ0yVFKPCKw+zQTdGvAqITtB6ZeFnPkg6Qq6f1oWu6G0n6f2cTpw==}
    hasBin: true
    requiresBuild: true
    peerDependencies:
      '@swc-node/register': ^1.4.2
      '@swc/core': ^1.2.173
    peerDependenciesMeta:
      '@swc-node/register':
        optional: true
      '@swc/core':
        optional: true
    dependencies:
      '@nrwl/cli': 15.3.3
      '@nrwl/tao': 15.3.3
      '@parcel/watcher': 2.0.4
      '@yarnpkg/lockfile': 1.1.0
      '@yarnpkg/parsers': 3.0.0-rc.33
      '@zkochan/js-yaml': 0.0.6
      axios: 1.2.1
      chalk: 4.1.0
      chokidar: 3.5.3
      cli-cursor: 3.1.0
      cli-spinners: 2.6.1
      cliui: 7.0.4
      dotenv: 10.0.0
      enquirer: 2.3.6
      fast-glob: 3.2.7
      figures: 3.2.0
      flat: 5.0.2
      fs-extra: 10.1.0
      glob: 7.1.4
      ignore: 5.2.1
      js-yaml: 4.1.0
      jsonc-parser: 3.2.0
      minimatch: 3.0.5
      npm-run-path: 4.0.1
      open: 8.4.0
      semver: 7.3.4
      string-width: 4.2.3
      strong-log-transformer: 2.1.0
      tar-stream: 2.2.0
      tmp: 0.2.1
      tsconfig-paths: 3.14.1
      tslib: 2.4.1
      v8-compile-cache: 2.3.0
      yargs: 17.6.2
      yargs-parser: 21.1.1
    transitivePeerDependencies:
      - debug
    dev: false

  /object-inspect/1.12.2:
    resolution: {integrity: sha512-z+cPxW0QGUp0mcqcsgQyLVRDoXFQbXOwBaqyF7VIgI4TWNQsDHrBpUQslRmIfAoYWdYzs6UlKJtB2XJpTaNSpQ==}
    dev: false

  /obuf/1.1.2:
    resolution: {integrity: sha512-PX1wu0AmAdPqOL1mWhqmlOd8kOIZQwGZw6rh7uby9fTc5lhaOWFLX3I6R1hrF9k3zUY40e6igsLGkDXK92LJNg==}
    dev: false

  /on-finished/2.4.1:
    resolution: {integrity: sha512-oVlzkg3ENAhCk2zdv7IJwd/QUD4z2RxRwpkcGY8psCVcCYZNq4wYnVWALHM+brtuJjePWiYF/ClmuDr8Ch5+kg==}
    engines: {node: '>= 0.8'}
    dependencies:
      ee-first: 1.1.1
    dev: false

  /on-headers/1.0.2:
    resolution: {integrity: sha512-pZAE+FJLoyITytdqK0U5s+FIpjN0JP3OzFi/u8Rx+EV5/W+JTWGXG8xFzevE7AjBfDqHv/8vL8qQsIhHnqRkrA==}
    engines: {node: '>= 0.8'}
    dev: false

  /once/1.4.0:
    resolution: {integrity: sha512-lNaJgI+2Q5URQBkccEKHTQOPaXdUxnZZElQTZY0MFUAuaEqe1E+Nyvgdz/aIyNi6Z9MzO5dv1H8n58/GELp3+w==}
    dependencies:
      wrappy: 1.0.2
    dev: false

  /onetime/5.1.2:
    resolution: {integrity: sha512-kbpaSSGJTWdAY5KPVeMOKXSrPtr8C8C7wodJbcsd51jRnmD+GZu8Y0VoU6Dm5Z4vWr0Ig/1NKuWRKf7j5aaYSg==}
    engines: {node: '>=6'}
    dependencies:
      mimic-fn: 2.1.0
    dev: false

  /open/8.4.0:
    resolution: {integrity: sha512-XgFPPM+B28FtCCgSb9I+s9szOC1vZRSwgWsRUA5ylIxRTgKozqjOCrVOqGsYABPYK5qnfqClxZTFBa8PKt2v6Q==}
    engines: {node: '>=12'}
    dependencies:
      define-lazy-prop: 2.0.0
      is-docker: 2.2.1
      is-wsl: 2.2.0
    dev: false

  /p-limit/2.3.0:
    resolution: {integrity: sha512-//88mFWSJx8lxCzwdAABTJL2MyWB12+eIY7MDL2SqLmAkeKU9qxRvWuSyTjm3FUmpBEMuFfckAIqEaVGUDxb6w==}
    engines: {node: '>=6'}
    dependencies:
      p-try: 2.2.0
    dev: false

  /p-limit/3.1.0:
    resolution: {integrity: sha512-TYOanM3wGwNGsZN2cVTYPArw454xnXj5qmWF1bEoAc4+cU/ol7GVh7odevjp1FNHduHc3KZMcFduxU5Xc6uJRQ==}
    engines: {node: '>=10'}
    dependencies:
      yocto-queue: 0.1.0
    dev: false

  /p-locate/4.1.0:
    resolution: {integrity: sha512-R79ZZ/0wAxKGu3oYMlz8jy/kbhsNrS7SKZ7PxEHBgJ5+F2mtFW2fK2cOtBh1cHYkQsbzFV7I+EoRKe6Yt0oK7A==}
    engines: {node: '>=8'}
    dependencies:
      p-limit: 2.3.0
    dev: false

  /p-retry/4.6.2:
    resolution: {integrity: sha512-312Id396EbJdvRONlngUx0NydfrIQ5lsYu0znKVUzVvArzEIt08V1qhtyESbGVd1FGX7UKtiFp5uwKZdM8wIuQ==}
    engines: {node: '>=8'}
    dependencies:
      '@types/retry': 0.12.0
      retry: 0.13.1
    dev: false

  /p-try/2.2.0:
    resolution: {integrity: sha512-R4nPAVTAU0B9D35/Gk3uJf/7XYbQcyohSKdvAxIRSNghFl4e71hVoGnBNQz9cWaXxO2I10KTC+3jMdvvoKw6dQ==}
    engines: {node: '>=6'}
    dev: false

  /parent-module/1.0.1:
    resolution: {integrity: sha512-GQ2EWRpQV8/o+Aw8YqtfZZPfNRWZYkbidE9k5rpl/hC3vtHHBfGm2Ifi6qWV+coDGkrUKZAxE3Lot5kcsRlh+g==}
    engines: {node: '>=6'}
    dependencies:
      callsites: 3.1.0
    dev: false

  /parse-json/5.2.0:
    resolution: {integrity: sha512-ayCKvm/phCGxOkYRSCM82iDwct8/EonSEgCSxWxD7ve6jHggsFl4fZVQBPRNgQoKiuV/odhFrGzQXZwbifC8Rg==}
    engines: {node: '>=8'}
    dependencies:
      '@babel/code-frame': 7.18.6
      error-ex: 1.3.2
      json-parse-even-better-errors: 2.3.1
      lines-and-columns: 1.2.4
    dev: false

  /parse5-html-rewriting-stream/6.0.1:
    resolution: {integrity: sha512-vwLQzynJVEfUlURxgnf51yAJDQTtVpNyGD8tKi2Za7m+akukNHxCcUQMAa/mUGLhCeicFdpy7Tlvj8ZNKadprg==}
    dependencies:
      parse5: 6.0.1
      parse5-sax-parser: 6.0.1
    dev: false

  /parse5-sax-parser/6.0.1:
    resolution: {integrity: sha512-kXX+5S81lgESA0LsDuGjAlBybImAChYRMT+/uKCEXFBFOeEhS52qUCydGhU3qLRD8D9DVjaUo821WK7DM4iCeg==}
    dependencies:
      parse5: 6.0.1
    dev: false

  /parse5/4.0.0:
    resolution: {integrity: sha512-VrZ7eOd3T1Fk4XWNXMgiGBK/z0MG48BWG2uQNU4I72fkQuKUTZpl+u9k+CxEG0twMVzSmXEEz12z5Fnw1jIQFA==}
    dev: false

  /parse5/6.0.1:
    resolution: {integrity: sha512-Ofn/CTFzRGTTxwpNEs9PP93gXShHcTq255nzRYSKe8AkVpZY7e1fpmTfOyoIvjP5HG7Z2ZM7VS9PPhQGW2pOpw==}
    dev: false

  /parseurl/1.3.3:
    resolution: {integrity: sha512-CiyeOxFT/JZyN5m0z9PfXw4SCBJ6Sygz1Dpl0wqjlhDEGGBP1GnsUVEL0p63hoG1fcj3fHynXi9NYO4nWOL+qQ==}
    engines: {node: '>= 0.8'}
    dev: false

  /path-exists/4.0.0:
    resolution: {integrity: sha512-ak9Qy5Q7jYb2Wwcey5Fpvg2KoAc/ZIhLSLOSBmRmygPsGwkVVt0fZa0qrtMz+m6tJTAHfZQ8FnmB4MG4LWy7/w==}
    engines: {node: '>=8'}
    dev: false

  /path-is-absolute/1.0.1:
    resolution: {integrity: sha512-AVbw3UJ2e9bq64vSaS9Am0fje1Pa8pbGqTTsmXfaIiMpnr5DlDhfJOuLj9Sf95ZPVDAUerDfEk88MPmPe7UCQg==}
    engines: {node: '>=0.10.0'}
    dev: false

  /path-key/3.1.1:
    resolution: {integrity: sha512-ojmeN0qd+y0jszEtoY48r0Peq5dwMEkIlCOu6Q5f41lfkswXuKtYrhgoTpLnyIcHm24Uhqx+5Tqm2InSwLhE6Q==}
    engines: {node: '>=8'}
    dev: false

  /path-parse/1.0.7:
    resolution: {integrity: sha512-LDJzPVEEEPR+y48z93A0Ed0yXb8pAByGWo/k5YYdYgpY2/2EsOsksJrq7lOHxryrVOn1ejG6oAp8ahvOIQD8sw==}
    dev: false

  /path-to-regexp/0.1.7:
    resolution: {integrity: sha512-5DFkuoqlv1uYQKxy8omFBeJPQcdoE07Kv2sferDCrAq1ohOU+MSDswDIbnx3YAM60qIOnYa53wBhXW0EbMonrQ==}
    dev: false

  /path-type/4.0.0:
    resolution: {integrity: sha512-gDKb8aZMDeD/tZWs9P6+q0J9Mwkdl6xMV8TjnGP3qJVJ06bdMgkbBlLU8IdfOsIsFz2BW1rNVT3XuNEl8zPAvw==}
    engines: {node: '>=8'}
    dev: false

  /picocolors/1.0.0:
    resolution: {integrity: sha512-1fygroTLlHu66zi26VoTDv8yRgm0Fccecssto+MhsZ0D/DGW2sm8E8AjW7NU5VVTRt5GxbeZ5qBuJr+HyLYkjQ==}
    dev: false

  /picomatch/2.3.1:
    resolution: {integrity: sha512-JU3teHTNjmE2VCGFzuY8EXzCDVwEqB2a8fsIvwaStHhAWJEeVd1o1QD80CU6+ZdEXXSLbSsuLwJjkCBWqRQUVA==}
    engines: {node: '>=8.6'}
    dev: false

  /pify/2.3.0:
    resolution: {integrity: sha512-udgsAY+fTnvv7kI7aaxbqwWNb0AHiB0qBO89PZKPkoTmGOgdbrHDKD+0B2X4uTfJ/FT1R09r9gTsjUjNJotuog==}
    engines: {node: '>=0.10.0'}
    dev: false

  /pify/4.0.1:
    resolution: {integrity: sha512-uB80kBFb/tfd68bVleG9T5GGsGPjJrLAUpR5PZIrhBnIaRTQRjqdJSsIKkOP6OAIFbj7GOrcudc5pNjZ+geV2g==}
    engines: {node: '>=6'}
    dev: false
    optional: true

  /pirates/4.0.5:
    resolution: {integrity: sha512-8V9+HQPupnaXMA23c5hvl69zXvTwTzyAYasnkb0Tts4XvO4CliqONMOnvlq26rkhLC3nWDFBJf73LU1e1VZLaQ==}
    engines: {node: '>= 6'}
    dev: false

  /pkg-dir/4.2.0:
    resolution: {integrity: sha512-HRDzbaKjC+AOWVXxAU/x54COGeIv9eb+6CkDSQoNTt4XyWoIJvuPsXizxu/Fr23EiekbtZwmh1IcIG/l/a10GQ==}
    engines: {node: '>=8'}
    dependencies:
      find-up: 4.1.0
    dev: false

  /postcss-calc/8.2.4_postcss@8.4.20:
    resolution: {integrity: sha512-SmWMSJmB8MRnnULldx0lQIyhSNvuDl9HfrZkaqqE/WHAhToYsAvDq+yAsA/kIyINDszOp3Rh0GFoNuH5Ypsm3Q==}
    peerDependencies:
      postcss: ^8.2.2
    dependencies:
      postcss: 8.4.20
      postcss-selector-parser: 6.0.11
      postcss-value-parser: 4.2.0
    dev: false

  /postcss-colormin/5.3.0_postcss@8.4.20:
    resolution: {integrity: sha512-WdDO4gOFG2Z8n4P8TWBpshnL3JpmNmJwdnfP2gbk2qBA8PWwOYcmjmI/t3CmMeL72a7Hkd+x/Mg9O2/0rD54Pg==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      browserslist: 4.21.4
      caniuse-api: 3.0.0
      colord: 2.9.3
      postcss: 8.4.20
      postcss-value-parser: 4.2.0
    dev: false

  /postcss-convert-values/5.1.3_postcss@8.4.20:
    resolution: {integrity: sha512-82pC1xkJZtcJEfiLw6UXnXVXScgtBrjlO5CBmuDQc+dlb88ZYheFsjTn40+zBVi3DkfF7iezO0nJUPLcJK3pvA==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      browserslist: 4.21.4
      postcss: 8.4.20
      postcss-value-parser: 4.2.0
    dev: false

  /postcss-discard-comments/5.1.2_postcss@8.4.20:
    resolution: {integrity: sha512-+L8208OVbHVF2UQf1iDmRcbdjJkuBF6IS29yBDSiWUIzpYaAhtNl6JYnYm12FnkeCwQqF5LeklOu6rAqgfBZqQ==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      postcss: 8.4.20
    dev: false

  /postcss-discard-duplicates/5.1.0_postcss@8.4.20:
    resolution: {integrity: sha512-zmX3IoSI2aoenxHV6C7plngHWWhUOV3sP1T8y2ifzxzbtnuhk1EdPwm0S1bIUNaJ2eNbWeGLEwzw8huPD67aQw==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      postcss: 8.4.20
    dev: false

  /postcss-discard-empty/5.1.1_postcss@8.4.20:
    resolution: {integrity: sha512-zPz4WljiSuLWsI0ir4Mcnr4qQQ5e1Ukc3i7UfE2XcrwKK2LIPIqE5jxMRxO6GbI3cv//ztXDsXwEWT3BHOGh3A==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      postcss: 8.4.20
    dev: false

  /postcss-discard-overridden/5.1.0_postcss@8.4.20:
    resolution: {integrity: sha512-21nOL7RqWR1kasIVdKs8HNqQJhFxLsyRfAnUDm4Fe4t4mCWL9OJiHvlHPjcd8zc5Myu89b/7wZDnOSjFgeWRtw==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      postcss: 8.4.20
    dev: false

  /postcss-import/14.1.0_postcss@8.4.20:
    resolution: {integrity: sha512-flwI+Vgm4SElObFVPpTIT7SU7R3qk2L7PyduMcokiaVKuWv9d/U+Gm/QAd8NDLuykTWTkcrjOeD2Pp1rMeBTGw==}
    engines: {node: '>=10.0.0'}
    peerDependencies:
      postcss: ^8.0.0
    dependencies:
      postcss: 8.4.20
      postcss-value-parser: 4.2.0
      read-cache: 1.0.0
      resolve: 1.22.1
    dev: false

  /postcss-loader/6.2.1_qxxfhhrl3yknjjmta266mo3u64:
    resolution: {integrity: sha512-WbbYpmAaKcux/P66bZ40bpWsBucjx/TTgVVzRZ9yUO8yQfVBlameJ0ZGVaPfH64hNSBh63a+ICP5nqOpBA0w+Q==}
    engines: {node: '>= 12.13.0'}
    peerDependencies:
      postcss: ^7.0.0 || ^8.0.1
      webpack: ^5.0.0
    dependencies:
      cosmiconfig: 7.1.0
      klona: 2.0.5
      postcss: 8.4.20
      semver: 7.3.8
      webpack: 5.75.0
    dev: false

  /postcss-merge-longhand/5.1.7_postcss@8.4.20:
    resolution: {integrity: sha512-YCI9gZB+PLNskrK0BB3/2OzPnGhPkBEwmwhfYk1ilBHYVAZB7/tkTHFBAnCrvBBOmeYyMYw3DMjT55SyxMBzjQ==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      postcss: 8.4.20
      postcss-value-parser: 4.2.0
      stylehacks: 5.1.1_postcss@8.4.20
    dev: false

  /postcss-merge-rules/5.1.3_postcss@8.4.20:
    resolution: {integrity: sha512-LbLd7uFC00vpOuMvyZop8+vvhnfRGpp2S+IMQKeuOZZapPRY4SMq5ErjQeHbHsjCUgJkRNrlU+LmxsKIqPKQlA==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      browserslist: 4.21.4
      caniuse-api: 3.0.0
      cssnano-utils: 3.1.0_postcss@8.4.20
      postcss: 8.4.20
      postcss-selector-parser: 6.0.11
    dev: false

  /postcss-minify-font-values/5.1.0_postcss@8.4.20:
    resolution: {integrity: sha512-el3mYTgx13ZAPPirSVsHqFzl+BBBDrXvbySvPGFnQcTI4iNslrPaFq4muTkLZmKlGk4gyFAYUBMH30+HurREyA==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      postcss: 8.4.20
      postcss-value-parser: 4.2.0
    dev: false

  /postcss-minify-gradients/5.1.1_postcss@8.4.20:
    resolution: {integrity: sha512-VGvXMTpCEo4qHTNSa9A0a3D+dxGFZCYwR6Jokk+/3oB6flu2/PnPXAh2x7x52EkY5xlIHLm+Le8tJxe/7TNhzw==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      colord: 2.9.3
      cssnano-utils: 3.1.0_postcss@8.4.20
      postcss: 8.4.20
      postcss-value-parser: 4.2.0
    dev: false

  /postcss-minify-params/5.1.4_postcss@8.4.20:
    resolution: {integrity: sha512-+mePA3MgdmVmv6g+30rn57USjOGSAyuxUmkfiWpzalZ8aiBkdPYjXWtHuwJGm1v5Ojy0Z0LaSYhHaLJQB0P8Jw==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      browserslist: 4.21.4
      cssnano-utils: 3.1.0_postcss@8.4.20
      postcss: 8.4.20
      postcss-value-parser: 4.2.0
    dev: false

  /postcss-minify-selectors/5.2.1_postcss@8.4.20:
    resolution: {integrity: sha512-nPJu7OjZJTsVUmPdm2TcaiohIwxP+v8ha9NehQ2ye9szv4orirRU3SDdtUmKH+10nzn0bAyOXZ0UEr7OpvLehg==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      postcss: 8.4.20
      postcss-selector-parser: 6.0.11
    dev: false

  /postcss-modules-extract-imports/3.0.0_postcss@8.4.20:
    resolution: {integrity: sha512-bdHleFnP3kZ4NYDhuGlVK+CMrQ/pqUm8bx/oGL93K6gVwiclvX5x0n76fYMKuIGKzlABOy13zsvqjb0f92TEXw==}
    engines: {node: ^10 || ^12 || >= 14}
    peerDependencies:
      postcss: ^8.1.0
    dependencies:
      postcss: 8.4.20
    dev: false

  /postcss-modules-local-by-default/4.0.0_postcss@8.4.20:
    resolution: {integrity: sha512-sT7ihtmGSF9yhm6ggikHdV0hlziDTX7oFoXtuVWeDd3hHObNkcHRo9V3yg7vCAY7cONyxJC/XXCmmiHHcvX7bQ==}
    engines: {node: ^10 || ^12 || >= 14}
    peerDependencies:
      postcss: ^8.1.0
    dependencies:
      icss-utils: 5.1.0_postcss@8.4.20
      postcss: 8.4.20
      postcss-selector-parser: 6.0.11
      postcss-value-parser: 4.2.0
    dev: false

  /postcss-modules-scope/3.0.0_postcss@8.4.20:
    resolution: {integrity: sha512-hncihwFA2yPath8oZ15PZqvWGkWf+XUfQgUGamS4LqoP1anQLOsOJw0vr7J7IwLpoY9fatA2qiGUGmuZL0Iqlg==}
    engines: {node: ^10 || ^12 || >= 14}
    peerDependencies:
      postcss: ^8.1.0
    dependencies:
      postcss: 8.4.20
      postcss-selector-parser: 6.0.11
    dev: false

  /postcss-modules-values/4.0.0_postcss@8.4.20:
    resolution: {integrity: sha512-RDxHkAiEGI78gS2ofyvCsu7iycRv7oqw5xMWn9iMoR0N/7mf9D50ecQqUo5BZ9Zh2vH4bCUR/ktCqbB9m8vJjQ==}
    engines: {node: ^10 || ^12 || >= 14}
    peerDependencies:
      postcss: ^8.1.0
    dependencies:
      icss-utils: 5.1.0_postcss@8.4.20
      postcss: 8.4.20
    dev: false

  /postcss-normalize-charset/5.1.0_postcss@8.4.20:
    resolution: {integrity: sha512-mSgUJ+pd/ldRGVx26p2wz9dNZ7ji6Pn8VWBajMXFf8jk7vUoSrZ2lt/wZR7DtlZYKesmZI680qjr2CeFF2fbUg==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      postcss: 8.4.20
    dev: false

  /postcss-normalize-display-values/5.1.0_postcss@8.4.20:
    resolution: {integrity: sha512-WP4KIM4o2dazQXWmFaqMmcvsKmhdINFblgSeRgn8BJ6vxaMyaJkwAzpPpuvSIoG/rmX3M+IrRZEz2H0glrQNEA==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      postcss: 8.4.20
      postcss-value-parser: 4.2.0
    dev: false

  /postcss-normalize-positions/5.1.1_postcss@8.4.20:
    resolution: {integrity: sha512-6UpCb0G4eofTCQLFVuI3EVNZzBNPiIKcA1AKVka+31fTVySphr3VUgAIULBhxZkKgwLImhzMR2Bw1ORK+37INg==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      postcss: 8.4.20
      postcss-value-parser: 4.2.0
    dev: false

  /postcss-normalize-repeat-style/5.1.1_postcss@8.4.20:
    resolution: {integrity: sha512-mFpLspGWkQtBcWIRFLmewo8aC3ImN2i/J3v8YCFUwDnPu3Xz4rLohDO26lGjwNsQxB3YF0KKRwspGzE2JEuS0g==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      postcss: 8.4.20
      postcss-value-parser: 4.2.0
    dev: false

  /postcss-normalize-string/5.1.0_postcss@8.4.20:
    resolution: {integrity: sha512-oYiIJOf4T9T1N4i+abeIc7Vgm/xPCGih4bZz5Nm0/ARVJ7K6xrDlLwvwqOydvyL3RHNf8qZk6vo3aatiw/go3w==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      postcss: 8.4.20
      postcss-value-parser: 4.2.0
    dev: false

  /postcss-normalize-timing-functions/5.1.0_postcss@8.4.20:
    resolution: {integrity: sha512-DOEkzJ4SAXv5xkHl0Wa9cZLF3WCBhF3o1SKVxKQAa+0pYKlueTpCgvkFAHfk+Y64ezX9+nITGrDZeVGgITJXjg==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      postcss: 8.4.20
      postcss-value-parser: 4.2.0
    dev: false

  /postcss-normalize-unicode/5.1.1_postcss@8.4.20:
    resolution: {integrity: sha512-qnCL5jzkNUmKVhZoENp1mJiGNPcsJCs1aaRmURmeJGES23Z/ajaln+EPTD+rBeNkSryI+2WTdW+lwcVdOikrpA==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      browserslist: 4.21.4
      postcss: 8.4.20
      postcss-value-parser: 4.2.0
    dev: false

  /postcss-normalize-url/5.1.0_postcss@8.4.20:
    resolution: {integrity: sha512-5upGeDO+PVthOxSmds43ZeMeZfKH+/DKgGRD7TElkkyS46JXAUhMzIKiCa7BabPeIy3AQcTkXwVVN7DbqsiCew==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      normalize-url: 6.1.0
      postcss: 8.4.20
      postcss-value-parser: 4.2.0
    dev: false

  /postcss-normalize-whitespace/5.1.1_postcss@8.4.20:
    resolution: {integrity: sha512-83ZJ4t3NUDETIHTa3uEg6asWjSBYL5EdkVB0sDncx9ERzOKBVJIUeDO9RyA9Zwtig8El1d79HBp0JEi8wvGQnA==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      postcss: 8.4.20
      postcss-value-parser: 4.2.0
    dev: false

  /postcss-ordered-values/5.1.3_postcss@8.4.20:
    resolution: {integrity: sha512-9UO79VUhPwEkzbb3RNpqqghc6lcYej1aveQteWY+4POIwlqkYE21HKWaLDF6lWNuqCobEAyTovVhtI32Rbv2RQ==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      cssnano-utils: 3.1.0_postcss@8.4.20
      postcss: 8.4.20
      postcss-value-parser: 4.2.0
    dev: false

  /postcss-reduce-initial/5.1.1_postcss@8.4.20:
    resolution: {integrity: sha512-//jeDqWcHPuXGZLoolFrUXBDyuEGbr9S2rMo19bkTIjBQ4PqkaO+oI8wua5BOUxpfi97i3PCoInsiFIEBfkm9w==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      browserslist: 4.21.4
      caniuse-api: 3.0.0
      postcss: 8.4.20
    dev: false

  /postcss-reduce-transforms/5.1.0_postcss@8.4.20:
    resolution: {integrity: sha512-2fbdbmgir5AvpW9RLtdONx1QoYG2/EtqpNQbFASDlixBbAYuTcJ0dECwlqNqH7VbaUnEnh8SrxOe2sRIn24XyQ==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      postcss: 8.4.20
      postcss-value-parser: 4.2.0
    dev: false

  /postcss-selector-parser/6.0.11:
    resolution: {integrity: sha512-zbARubNdogI9j7WY4nQJBiNqQf3sLS3wCP4WfOidu+p28LofJqDH1tcXypGrcmMHhDk2t9wGhCsYe/+szLTy1g==}
    engines: {node: '>=4'}
    dependencies:
      cssesc: 3.0.0
      util-deprecate: 1.0.2
    dev: false

  /postcss-svgo/5.1.0_postcss@8.4.20:
    resolution: {integrity: sha512-D75KsH1zm5ZrHyxPakAxJWtkyXew5qwS70v56exwvw542d9CRtTo78K0WeFxZB4G7JXKKMbEZtZayTGdIky/eA==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      postcss: 8.4.20
      postcss-value-parser: 4.2.0
      svgo: 2.8.0
    dev: false

  /postcss-unique-selectors/5.1.1_postcss@8.4.20:
    resolution: {integrity: sha512-5JiODlELrz8L2HwxfPnhOWZYWDxVHWL83ufOv84NrcgipI7TaeRsatAhK4Tr2/ZiYldpK/wBvw5BD3qfaK96GA==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      postcss: 8.4.20
      postcss-selector-parser: 6.0.11
    dev: false

  /postcss-value-parser/4.2.0:
    resolution: {integrity: sha512-1NNCs6uurfkVbeXG4S8JFT9t19m45ICnif8zWLd5oPSZ50QnwMfK+H3jv408d4jw/7Bttv5axS5IiHoLaVNHeQ==}
    dev: false

  /postcss/8.4.14:
    resolution: {integrity: sha512-E398TUmfAYFPBSdzgeieK2Y1+1cpdxJx8yXbK/m57nRhKSmk1GB2tO4lbLBtlkfPQTDKfe4Xqv1ASWPpayPEig==}
    engines: {node: ^10 || ^12 || >=14}
    dependencies:
      nanoid: 3.3.4
      picocolors: 1.0.0
      source-map-js: 1.0.2
    dev: false

  /postcss/8.4.20:
    resolution: {integrity: sha512-6Q04AXR1212bXr5fh03u8aAwbLxAQNGQ/Q1LNa0VfOI06ZAlhPHtQvE4OIdpj4kLThXilalPnmDSOD65DcHt+g==}
    engines: {node: ^10 || ^12 || >=14}
    dependencies:
      nanoid: 3.3.4
      picocolors: 1.0.0
      source-map-js: 1.0.2
    dev: false

  /pretty-format/28.1.3:
    resolution: {integrity: sha512-8gFb/To0OmxHR9+ZTb14Df2vNxdGCX8g1xWGUTqUw5TiZvcQf5sHKObd5UcPyLLyowNwDAMTF3XWOG1B6mxl1Q==}
    engines: {node: ^12.13.0 || ^14.15.0 || ^16.10.0 || >=17.0.0}
    dependencies:
      '@jest/schemas': 28.1.3
      ansi-regex: 5.0.1
      ansi-styles: 5.2.0
      react-is: 18.2.0
    dev: false

  /process-nextick-args/2.0.1:
    resolution: {integrity: sha512-3ouUOpQhtgrbOa17J7+uxOTpITYWaGP7/AhoR3+A+/1e9skrzelGi/dXzEYyvbxubEF6Wn2ypscTKiKJFFn1ag==}
    dev: false

  /proxy-addr/2.0.7:
    resolution: {integrity: sha512-llQsMLSUDUPT44jdrU/O37qlnifitDP+ZwrmmZcoSKyLKvtZxpyV0n2/bD/N4tBAAZ/gJEdZU7KMraoK1+XYAg==}
    engines: {node: '>= 0.10'}
    dependencies:
      forwarded: 0.2.0
      ipaddr.js: 1.9.1
    dev: false

  /proxy-from-env/1.1.0:
    resolution: {integrity: sha512-D+zkORCbA9f1tdWRK0RaCR3GPv50cMxcrz4X8k5LTSUD1Dkw47mKJEZQNunItRTkWwgtaUSo1RVFRIG9ZXiFYg==}
    dev: false

  /prr/1.0.1:
    resolution: {integrity: sha512-yPw4Sng1gWghHQWj0B3ZggWUm4qVbPwPFcRG8KyxiU7J2OHFSoEHKS+EZ3fv5l1t9CyCiop6l/ZYeWbrgoQejw==}
    dev: false
    optional: true

  /punycode/2.1.1:
    resolution: {integrity: sha512-XRsRjdf+j5ml+y/6GKHPZbrF/8p2Yga0JPtdqTIY2Xe5ohJPD9saDJJLPvp9+NSBprVvevdXZybnj2cv8OEd0A==}
    engines: {node: '>=6'}
    dev: false

  /qs/6.11.0:
    resolution: {integrity: sha512-MvjoMCJwEarSbUYk5O+nmoSzSutSsTwF85zcHPQ9OrlFoZOYIjaqBAJIqIXjptyD5vThxGq52Xu/MaJzRkIk4Q==}
    engines: {node: '>=0.6'}
    dependencies:
      side-channel: 1.0.4
    dev: false

  /queue-microtask/1.2.3:
    resolution: {integrity: sha512-NuaNSa6flKT5JaSYQzJok04JzTL1CA6aGhv5rfLW3PgqA+M2ChpZQnAC8h8i4ZFkBS8X5RqkDBHA7r4hej3K9A==}
    dev: false

  /randombytes/2.1.0:
    resolution: {integrity: sha512-vYl3iOX+4CKUWuxGi9Ukhie6fsqXqS9FE2Zaic4tNFD2N2QQaXOMFbuKK4QmDHC0JO6B1Zp41J0LpT0oR68amQ==}
    dependencies:
      safe-buffer: 5.2.1
    dev: false

  /range-parser/1.2.1:
    resolution: {integrity: sha512-Hrgsx+orqoygnmhFbKaHE6c296J+HTAQXoxEF6gNupROmmGJRoyzfG3ccAveqCBrwr/2yxQ5BVd/GTl5agOwSg==}
    engines: {node: '>= 0.6'}
    dev: false

  /raw-body/2.5.1:
    resolution: {integrity: sha512-qqJBtEyVgS0ZmPGdCFPWJ3FreoqvG4MVQln/kCgF7Olq95IbOp0/BWyMwbdtn4VTvkM8Y7khCQ2Xgk/tcrCXig==}
    engines: {node: '>= 0.8'}
    dependencies:
      bytes: 3.1.2
      http-errors: 2.0.0
      iconv-lite: 0.4.24
      unpipe: 1.0.0
    dev: false

  /raw-loader/4.0.2_webpack@5.75.0:
    resolution: {integrity: sha512-ZnScIV3ag9A4wPX/ZayxL/jZH+euYb6FcUinPcgiQW0+UBtEv0O6Q3lGd3cqJ+GHH+rksEv3Pj99oxJ3u3VIKA==}
    engines: {node: '>= 10.13.0'}
    peerDependencies:
      webpack: ^4.0.0 || ^5.0.0
    dependencies:
      loader-utils: 2.0.4
      schema-utils: 3.1.1
      webpack: 5.75.0
    dev: false

  /react-dom/18.2.0_react@18.2.0:
    resolution: {integrity: sha512-6IMTriUmvsjHUjNtEDudZfuDQUoWXVxKHhlEGSk81n4YFS+r/Kl99wXiwlVXtPBtJenozv2P+hxDsw9eA7Xo6g==}
    peerDependencies:
      react: ^18.2.0
    dependencies:
      loose-envify: 1.4.0
      react: 18.2.0
      scheduler: 0.23.0
    dev: false

  /react-is/18.2.0:
    resolution: {integrity: sha512-xWGDIW6x921xtzPkhiULtthJHoJvBbF3q26fzloPCK0hsvxtPVelvftw3zjbHWSkR2km9Z+4uxbDDK/6Zw9B8w==}
    dev: false

  /react/18.2.0:
    resolution: {integrity: sha512-/3IjMdb2L9QbBdWiW5e3P2/npwMBaU9mHCSCUzNln0ZCYbcfTsGbTJrU/kGemdH2IWmB2ioZ+zkxtmq6g09fGQ==}
    engines: {node: '>=0.10.0'}
    dependencies:
      loose-envify: 1.4.0
    dev: false

  /read-cache/1.0.0:
    resolution: {integrity: sha512-Owdv/Ft7IjOgm/i0xvNDZ1LrRANRfew4b2prF3OWMQLxLfu3bS8FVhCsrSCMK4lR56Y9ya+AThoTpDCTxCmpRA==}
    dependencies:
      pify: 2.3.0
    dev: false

  /readable-stream/2.3.7:
    resolution: {integrity: sha512-Ebho8K4jIbHAxnuxi7o42OrZgF/ZTNcsZj6nRKyUmkhLFq8CHItp/fy6hQZuZmP/n3yZ9VBUbp4zz/mX8hmYPw==}
    dependencies:
      core-util-is: 1.0.3
      inherits: 2.0.4
      isarray: 1.0.0
      process-nextick-args: 2.0.1
      safe-buffer: 5.1.2
      string_decoder: 1.1.1
      util-deprecate: 1.0.2
    dev: false

  /readable-stream/3.6.0:
    resolution: {integrity: sha512-BViHy7LKeTz4oNnkcLJ+lVSL6vpiFeX6/d3oSH8zCW7UxP2onchk+vTGB143xuFjHS3deTgkKoXXymXqymiIdA==}
    engines: {node: '>= 6'}
    dependencies:
      inherits: 2.0.4
      string_decoder: 1.3.0
      util-deprecate: 1.0.2
    dev: false

  /readdirp/3.6.0:
    resolution: {integrity: sha512-hOS089on8RduqdbhvQ5Z37A0ESjsqz6qnRcffsMU3495FuTdqSm+7bhJ29JvIOsBDEEnan5DPu9t3To9VRlMzA==}
    engines: {node: '>=8.10.0'}
    dependencies:
      picomatch: 2.3.1
    dev: false

  /regenerate-unicode-properties/10.1.0:
    resolution: {integrity: sha512-d1VudCLoIGitcU/hEg2QqvyGZQmdC0Lf8BqdOMXGFSvJP4bNV1+XqbPQeHHLD51Jh4QJJ225dlIFvY4Ly6MXmQ==}
    engines: {node: '>=4'}
    dependencies:
      regenerate: 1.4.2
    dev: false

  /regenerate/1.4.2:
    resolution: {integrity: sha512-zrceR/XhGYU/d/opr2EKO7aRHUeiBI8qjtfHqADTwZd6Szfy16la6kqD0MIUs5z5hx6AaKa+PixpPrR289+I0A==}
    dev: false

  /regenerator-runtime/0.13.11:
    resolution: {integrity: sha512-kY1AZVr2Ra+t+piVaJ4gxaFaReZVH40AKNo7UCX6W+dEwBo/2oZJzqfuN1qLq1oL45o56cPaTXELwrTh8Fpggg==}
    dev: false

  /regenerator-transform/0.15.1:
    resolution: {integrity: sha512-knzmNAcuyxV+gQCufkYcvOqX/qIIfHLv0u5x79kRxuGojfYVky1f15TzZEu2Avte8QGepvUNTnLskf8E6X6Vyg==}
    dependencies:
      '@babel/runtime': 7.20.6
    dev: false

  /regexpu-core/5.2.2:
    resolution: {integrity: sha512-T0+1Zp2wjF/juXMrMxHxidqGYn8U4R+zleSJhX9tQ1PUsS8a9UtYfbsF9LdiVgNX3kiX8RNaKM42nfSgvFJjmw==}
    engines: {node: '>=4'}
    dependencies:
      regenerate: 1.4.2
      regenerate-unicode-properties: 10.1.0
      regjsgen: 0.7.1
      regjsparser: 0.9.1
      unicode-match-property-ecmascript: 2.0.0
      unicode-match-property-value-ecmascript: 2.1.0
    dev: false

  /regjsgen/0.7.1:
    resolution: {integrity: sha512-RAt+8H2ZEzHeYWxZ3H2z6tF18zyyOnlcdaafLrm21Bguj7uZy6ULibiAFdXEtKQY4Sy7wDTwDiOazasMLc4KPA==}
    dev: false

  /regjsparser/0.9.1:
    resolution: {integrity: sha512-dQUtn90WanSNl+7mQKcXAgZxvUe7Z0SqXlgzv0za4LwiUhyzBC58yQO3liFoUgu8GiJVInAhJjkj1N0EtQ5nkQ==}
    hasBin: true
    dependencies:
      jsesc: 0.5.0
    dev: false

  /require-directory/2.1.1:
    resolution: {integrity: sha512-fGxEI7+wsG9xrvdjsrlmL22OMTTiHRwAMroiEeMgq8gzoLC/PQr7RsRDSTLUg/bZAZtF+TVIkHc6/4RIKrui+Q==}
    engines: {node: '>=0.10.0'}
    dev: false

  /require-from-string/2.0.2:
    resolution: {integrity: sha512-Xf0nWe6RseziFMu+Ap9biiUbmplq6S9/p+7w7YXP/JBHhrUDDUhwa+vANyubuqfZWTveU//DYVGsDG7RKL/vEw==}
    engines: {node: '>=0.10.0'}
    dev: false

  /requires-port/1.0.0:
    resolution: {integrity: sha512-KigOCHcocU3XODJxsu8i/j8T9tzT4adHiecwORRQ0ZZFcp7ahwXuRU1m+yuO90C5ZUyGeGfocHDI14M3L3yDAQ==}
    dev: false

  /resolve-from/4.0.0:
    resolution: {integrity: sha512-pb/MYmXstAkysRFx8piNI1tGFNQIFA3vkE3Gq4EuA1dF6gHp/+vgZqsCGJapvy8N3Q+4o7FwvquPJcnZ7RYy4g==}
    engines: {node: '>=4'}
    dev: false

  /resolve-from/5.0.0:
    resolution: {integrity: sha512-qYg9KP24dD5qka9J47d0aVky0N+b4fTU89LN9iDnjB5waksiC49rvMB0PrUJQGoTmH50XPiqOvAjDfaijGxYZw==}
    engines: {node: '>=8'}
    dev: false

  /resolve.exports/1.1.0:
    resolution: {integrity: sha512-J1l+Zxxp4XK3LUDZ9m60LRJF/mAe4z6a4xyabPHk7pvK5t35dACV32iIjJDFeWZFfZlO29w6SZ67knR0tHzJtQ==}
    engines: {node: '>=10'}
    dev: false

  /resolve/1.22.1:
    resolution: {integrity: sha512-nBpuuYuY5jFsli/JIs1oldw6fOQCBioohqWZg/2hiaOybXOft4lonv85uDOKXdf8rhyK159cxU5cDcK/NKk8zw==}
    hasBin: true
    dependencies:
      is-core-module: 2.11.0
      path-parse: 1.0.7
      supports-preserve-symlinks-flag: 1.0.0
    dev: false

  /restore-cursor/3.1.0:
    resolution: {integrity: sha512-l+sSefzHpj5qimhFSE5a8nufZYAM3sBSVMAPtYkmC+4EH2anSGaEMXSD0izRQbu9nfyQ9y5JrVmp7E8oZrUjvA==}
    engines: {node: '>=8'}
    dependencies:
      onetime: 5.1.2
      signal-exit: 3.0.7
    dev: false

  /retry/0.13.1:
    resolution: {integrity: sha512-XQBQ3I8W1Cge0Seh+6gjj03LbmRFWuoszgK9ooCpwYIrhhoO80pfq4cUkU5DkknwfOfFteRwlZ56PYOGYyFWdg==}
    engines: {node: '>= 4'}
    dev: false

  /reusify/1.0.4:
    resolution: {integrity: sha512-U9nH88a3fc/ekCF1l0/UP1IosiuIjyTh7hBvXVMHYgVcfGvt897Xguj2UOLDeI5BG2m7/uwyaLVT6fbtCwTyzw==}
    engines: {iojs: '>=1.0.0', node: '>=0.10.0'}
    dev: false

  /rimraf/3.0.2:
    resolution: {integrity: sha512-JZkJMZkAGFFPP2YqXZXPbMlMBgsxzE8ILs4lMIX/2o0L9UBw9O/Y3o6wFw/i9YLapcUJWwqbi3kdxIPdC62TIA==}
    hasBin: true
    dependencies:
      glob: 7.2.3
    dev: false

  /run-parallel/1.2.0:
    resolution: {integrity: sha512-5l4VyZR86LZ/lDxZTR6jqL8AFE2S0IFLMP26AbjsLVADxHdhB/c0GUsH+y39UfCi3dzz8OlQuPmnaJOMoDHQBA==}
    dependencies:
      queue-microtask: 1.2.3
    dev: false

  /rxjs/6.6.7:
    resolution: {integrity: sha512-hTdwr+7yYNIT5n4AMYp85KA6yw2Va0FLa3Rguvbpa4W3I5xynaBZo41cM3XM+4Q6fRMj3sBYIR1VAmZMXYJvRQ==}
    engines: {npm: '>=2.0.0'}
    dependencies:
      tslib: 1.14.1
    dev: false

  /safe-buffer/5.1.2:
    resolution: {integrity: sha512-Gd2UZBJDkXlY7GbJxfsE8/nvKkUEU1G38c1siN6QP6a9PT9MmHB8GnpscSmMJSoF8LOIrt8ud/wPtojys4G6+g==}
    dev: false

  /safe-buffer/5.2.1:
    resolution: {integrity: sha512-rp3So07KcdmmKbGvgaNxQSJr7bGVSVk5S9Eq1F+ppbRo70+YeaDxkw5Dd8NPN+GD6bjnYm2VuPuCXmpuYvmCXQ==}
    dev: false

  /safer-buffer/2.1.2:
    resolution: {integrity: sha512-YZo3K82SD7Riyi0E1EQPojLz7kpepnSQI9IyPbHHg1XXXevb5dJI7tpyN2ADxGcQbHG7vcyRHk0cbwqcQriUtg==}
    dev: false

  /sass-loader/12.6.0_sass@1.56.2+webpack@5.75.0:
    resolution: {integrity: sha512-oLTaH0YCtX4cfnJZxKSLAyglED0naiYfNG1iXfU5w1LNZ+ukoA5DtyDIN5zmKVZwYNJP4KRc5Y3hkWga+7tYfA==}
    engines: {node: '>= 12.13.0'}
    peerDependencies:
      fibers: '>= 3.1.0'
      node-sass: ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0
      sass: ^1.3.0
      sass-embedded: '*'
      webpack: ^5.0.0
    peerDependenciesMeta:
      fibers:
        optional: true
      node-sass:
        optional: true
      sass:
        optional: true
      sass-embedded:
        optional: true
    dependencies:
      klona: 2.0.5
      neo-async: 2.6.2
      sass: 1.56.2
      webpack: 5.75.0
    dev: false

  /sass/1.56.2:
    resolution: {integrity: sha512-ciEJhnyCRwzlBCB+h5cCPM6ie/6f8HrhZMQOf5vlU60Y1bI1rx5Zb0vlDZvaycHsg/MqFfF1Eq2eokAa32iw8w==}
    engines: {node: '>=12.0.0'}
    hasBin: true
    dependencies:
      chokidar: 3.5.3
      immutable: 4.1.0
      source-map-js: 1.0.2
    dev: false

  /sax/1.2.4:
    resolution: {integrity: sha512-NqVDv9TpANUjFm0N8uM5GxL36UgKi9/atZw+x7YFnQ8ckwFGKrl4xX4yWtrey3UJm5nP1kUbnYgLopqWNSRhWw==}
    dev: false

  /scheduler/0.23.0:
    resolution: {integrity: sha512-CtuThmgHNg7zIZWAXi3AsyIzA3n4xx7aNyjwC2VJldO2LMVDhFK+63xGqq6CsJH4rTAt6/M+N4GhZiDYPx9eUw==}
    dependencies:
      loose-envify: 1.4.0
    dev: false

  /schema-utils/2.7.1:
    resolution: {integrity: sha512-SHiNtMOUGWBQJwzISiVYKu82GiV4QYGePp3odlY1tuKO7gPtphAT5R/py0fA6xtbgLL/RvtJZnU9b8s0F1q0Xg==}
    engines: {node: '>= 8.9.0'}
    dependencies:
      '@types/json-schema': 7.0.11
      ajv: 6.12.6
      ajv-keywords: 3.5.2_ajv@6.12.6
    dev: false

  /schema-utils/3.1.1:
    resolution: {integrity: sha512-Y5PQxS4ITlC+EahLuXaY86TXfR7Dc5lw294alXOq86JAHCihAIZfqv8nNCWvaEJvaC51uN9hbLGeV0cFBdH+Fw==}
    engines: {node: '>= 10.13.0'}
    dependencies:
      '@types/json-schema': 7.0.11
      ajv: 6.12.6
      ajv-keywords: 3.5.2_ajv@6.12.6
    dev: false

  /schema-utils/4.0.0:
    resolution: {integrity: sha512-1edyXKgh6XnJsJSQ8mKWXnN/BVaIbFMLpouRUrXgVq7WYne5kw3MW7UPhO44uRXQSIpTSXoJbmrR2X0w9kUTyg==}
    engines: {node: '>= 12.13.0'}
    dependencies:
      '@types/json-schema': 7.0.11
      ajv: 8.11.2
      ajv-formats: 2.1.1
      ajv-keywords: 5.1.0_ajv@8.11.2
    dev: false

  /select-hose/2.0.0:
    resolution: {integrity: sha512-mEugaLK+YfkijB4fx0e6kImuJdCIt2LxCRcbEYPqRGCs4F2ogyfZU5IAZRdjCP8JPq2AtdNoC/Dux63d9Kiryg==}
    dev: false

  /selfsigned/2.1.1:
    resolution: {integrity: sha512-GSL3aowiF7wa/WtSFwnUrludWFoNhftq8bUkH9pkzjpN2XSPOAYEgg6e0sS9s0rZwgJzJiQRPU18A6clnoW5wQ==}
    engines: {node: '>=10'}
    dependencies:
      node-forge: 1.3.1
    dev: false

  /semver/5.7.1:
    resolution: {integrity: sha512-sauaDf/PZdVgrLTNYHRtpXa1iRiKcaebiKQ1BJdpQlWH2lCvexQdX55snPFyK7QzpudqbCI0qXFfOasHdyNDGQ==}
    hasBin: true
    dev: false
    optional: true

  /semver/6.3.0:
    resolution: {integrity: sha512-b39TBaTSfV6yBrapU89p5fKekE2m/NwnDocOVruQFS1/veMgdzuPcnOM34M6CwxW8jH/lxEa5rBoDeUwu5HHTw==}
    hasBin: true
    dev: false

  /semver/7.3.4:
    resolution: {integrity: sha512-tCfb2WLjqFAtXn4KEdxIhalnRtoKFN7nAwj0B3ZXCbQloV2tq5eDbcTmT68JJD3nRJq24/XgxtQKFIpQdtvmVw==}
    engines: {node: '>=10'}
    hasBin: true
    dependencies:
      lru-cache: 6.0.0
    dev: false

  /semver/7.3.8:
    resolution: {integrity: sha512-NB1ctGL5rlHrPJtFDVIVzTyQylMLu9N9VICA6HSFJo8MCGVTMW6gfpicwKmmK/dAjTOrqu5l63JJOpDSrAis3A==}
    engines: {node: '>=10'}
    hasBin: true
    dependencies:
      lru-cache: 6.0.0
    dev: false

  /send/0.18.0:
    resolution: {integrity: sha512-qqWzuOjSFOuqPjFe4NOsMLafToQQwBSOEpS+FwEt3A2V3vKubTquT3vmLTQpFgMXp8AlFWFuP1qKaJZOtPpVXg==}
    engines: {node: '>= 0.8.0'}
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
    dev: false

  /serialize-javascript/6.0.0:
    resolution: {integrity: sha512-Qr3TosvguFt8ePWqsvRfrKyQXIiW+nGbYpy8XK24NQHE83caxWt+mIymTT19DGFbNWNLfEwsrkSmN64lVWB9ag==}
    dependencies:
      randombytes: 2.1.0
    dev: false

  /serve-index/1.9.1:
    resolution: {integrity: sha512-pXHfKNP4qujrtteMrSBb0rc8HJ9Ms/GrXwcUtUtD5s4ewDJI8bT3Cz2zTVRMKtri49pLx2e0Ya8ziP5Ya2pZZw==}
    engines: {node: '>= 0.8.0'}
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
    dev: false

  /serve-static/1.15.0:
    resolution: {integrity: sha512-XGuRDNjXUijsUL0vl6nSD7cwURuzEgglbOaFuZM9g3kwDXOWVTck0jLzjPzGD+TazWbboZYu52/9/XPdUgne9g==}
    engines: {node: '>= 0.8.0'}
    dependencies:
      encodeurl: 1.0.2
      escape-html: 1.0.3
      parseurl: 1.3.3
      send: 0.18.0
    transitivePeerDependencies:
      - supports-color
    dev: false

  /setprototypeof/1.1.0:
    resolution: {integrity: sha512-BvE/TwpZX4FXExxOxZyRGQQv651MSwmWKZGqvmPcRIjDqWub67kTKuIMx43cZZrS/cBBzwBcNDWoFxt2XEFIpQ==}
    dev: false

  /setprototypeof/1.2.0:
    resolution: {integrity: sha512-E5LDX7Wrp85Kil5bhZv46j8jOeboKq5JMmYM3gVGdGH8xFpPWXUMsNrlODCrkoxMEeNi/XZIwuRvY4XNwYMJpw==}
    dev: false

  /shallow-clone/3.0.1:
    resolution: {integrity: sha512-/6KqX+GVUdqPuPPd2LxDDxzX6CAbjJehAAOKlNpqqUpAqPM6HeL8f+o3a+JsyGjn2lv0WY8UsTgUJjU9Ok55NA==}
    engines: {node: '>=8'}
    dependencies:
      kind-of: 6.0.3
    dev: false

  /shebang-command/2.0.0:
    resolution: {integrity: sha512-kHxr2zZpYtdmrN1qDjrrX/Z1rR1kG8Dx+gkpK1G4eXmvXswmcE1hTWBWYUzlraYw1/yZp6YuDY77YtvbN0dmDA==}
    engines: {node: '>=8'}
    dependencies:
      shebang-regex: 3.0.0
    dev: false

  /shebang-regex/3.0.0:
    resolution: {integrity: sha512-7++dFhtcx3353uBaq8DDR4NuxBetBzC7ZQOhmTQInHEd6bSrXdiEyzCvG07Z44UYdLShWUyXt5M/yhz8ekcb1A==}
    engines: {node: '>=8'}
    dev: false

  /side-channel/1.0.4:
    resolution: {integrity: sha512-q5XPytqFEIKHkGdiMIrY10mvLRvnQh42/+GoBlFW3b2LXLE2xxJpZFdm94we0BaoV3RwJyGqg5wS7epxTv0Zvw==}
    dependencies:
      call-bind: 1.0.2
      get-intrinsic: 1.1.3
      object-inspect: 1.12.2
    dev: false

  /signal-exit/3.0.7:
    resolution: {integrity: sha512-wnD2ZE+l+SPC/uoS0vXeE9L1+0wuaMqKlfz9AMUo38JsyLSBWSFcHR1Rri62LZc12vLr1gb3jl7iwQhgwpAbGQ==}
    dev: false

  /slash/3.0.0:
    resolution: {integrity: sha512-g9Q1haeby36OSStwb4ntCGGGaKsaVSjQ68fBxoQcutl5fS1vuY18H3wSt3jFyFtrkx+Kz0V1G85A4MyAdDMi2Q==}
    engines: {node: '>=8'}
    dev: false

  /slash/4.0.0:
    resolution: {integrity: sha512-3dOsAHXXUkQTpOYcoAxLIorMTp4gIQr5IW3iVb7A7lFIp0VHhnynm9izx6TssdrIcVIESAlVjtnO2K8bg+Coew==}
    engines: {node: '>=12'}
    dev: false

  /sockjs/0.3.24:
    resolution: {integrity: sha512-GJgLTZ7vYb/JtPSSZ10hsOYIvEYsjbNU+zPdIHcUaWVNUEPivzxku31865sSSud0Da0W4lEeOPlmw93zLQchuQ==}
    dependencies:
      faye-websocket: 0.11.4
      uuid: 8.3.2
      websocket-driver: 0.7.4
    dev: false

  /source-map-js/1.0.2:
    resolution: {integrity: sha512-R0XvVJ9WusLiqTCEiGCmICCMplcCkIwwR11mOSD9CR5u+IXYdiseeEuXCVAjS54zqwkLcPNnmU4OeJ6tUrWhDw==}
    engines: {node: '>=0.10.0'}
    dev: false

  /source-map-loader/3.0.2_webpack@5.75.0:
    resolution: {integrity: sha512-BokxPoLjyl3iOrgkWaakaxqnelAJSS+0V+De0kKIq6lyWrXuiPgYTGp6z3iHmqljKAaLXwZa+ctD8GccRJeVvg==}
    engines: {node: '>= 12.13.0'}
    peerDependencies:
      webpack: ^5.0.0
    dependencies:
      abab: 2.0.6
      iconv-lite: 0.6.3
      source-map-js: 1.0.2
      webpack: 5.75.0
    dev: false

  /source-map-resolve/0.6.0:
    resolution: {integrity: sha512-KXBr9d/fO/bWo97NXsPIAW1bFSBOuCnjbNTBMO7N59hsv5i9yzRDfcYwwt0l04+VqnKC+EwzvJZIP/qkuMgR/w==}
    deprecated: See https://github.com/lydell/source-map-resolve#deprecated
    dependencies:
      atob: 2.1.2
      decode-uri-component: 0.2.2
    dev: false

  /source-map-support/0.5.13:
    resolution: {integrity: sha512-SHSKFHadjVA5oR4PPqhtAVdcBWwRYVd6g6cAXnIbRiIwc2EhPrTuKUBdSLvlEKyIP3GCf89fltvcZiP9MMFA1w==}
    dependencies:
      buffer-from: 1.1.2
      source-map: 0.6.1
    dev: false

  /source-map-support/0.5.19:
    resolution: {integrity: sha512-Wonm7zOCIJzBGQdB+thsPar0kYuCIzYvxZwlBa87yi/Mdjv7Tip2cyVbLj5o0cFPN4EVkuTwb3GDDyUx2DGnGw==}
    dependencies:
      buffer-from: 1.1.2
      source-map: 0.6.1
    dev: false

  /source-map-support/0.5.21:
    resolution: {integrity: sha512-uBHU3L3czsIyYXKX88fdrGovxdSCoTGDRZ6SYXtSRxLZUzHg5P/66Ht6uoUlHu9EZod+inXhKo3qQgwXUT/y1w==}
    dependencies:
      buffer-from: 1.1.2
      source-map: 0.6.1
    dev: false

  /source-map/0.6.1:
    resolution: {integrity: sha512-UjgapumWlbMhkBgzT7Ykc5YXUT46F0iKu8SGXq0bcwP5dz/h0Plj6enJqjz1Zbq2l5WaqYnrVbwWOWMyF3F47g==}
    engines: {node: '>=0.10.0'}
    dev: false

  /source-map/0.7.4:
    resolution: {integrity: sha512-l3BikUxvPOcn5E74dZiq5BGsTb5yEwhaTSzccU6t4sDOH8NWJCstKO5QT2CvtFoK6F0saL7p9xHAqHOlCPJygA==}
    engines: {node: '>= 8'}
    dev: false

  /spdy-transport/3.0.0:
    resolution: {integrity: sha512-hsLVFE5SjA6TCisWeJXFKniGGOpBgMLmerfO2aCyCU5s7nJ/rpAepqmFifv/GCbSbueEeAJJnmSQ2rKC/g8Fcw==}
    dependencies:
      debug: 4.3.4
      detect-node: 2.1.0
      hpack.js: 2.1.6
      obuf: 1.1.2
      readable-stream: 3.6.0
      wbuf: 1.7.3
    transitivePeerDependencies:
      - supports-color
    dev: false

  /spdy/4.0.2:
    resolution: {integrity: sha512-r46gZQZQV+Kl9oItvl1JZZqJKGr+oEkB08A6BzkiR7593/7IbtuncXHd2YoYeTsG4157ZssMu9KYvUHLcjcDoA==}
    engines: {node: '>=6.0.0'}
    dependencies:
      debug: 4.3.4
      handle-thing: 2.0.1
      http-deceiver: 1.2.7
      select-hose: 2.0.0
      spdy-transport: 3.0.0
    transitivePeerDependencies:
      - supports-color
    dev: false

  /sprintf-js/1.0.3:
    resolution: {integrity: sha512-D9cPgkvLlV3t3IzL0D0YLvGA9Ahk4PcvVwUbN0dSGr1aP0Nrt4AEnTUbuGvquEC0mA64Gqt1fzirlRs5ibXx8g==}
    dev: false

  /stable/0.1.8:
    resolution: {integrity: sha512-ji9qxRnOVfcuLDySj9qzhGSEFVobyt1kIOSkj1qZzYLzq7Tos/oUUWvotUPQLlrsidqsK6tBH89Bc9kL5zHA6w==}
    deprecated: 'Modern JS already guarantees Array#sort() is a stable sort, so this library is deprecated. See the compatibility table on MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort#browser_compatibility'
    dev: false

  /stack-utils/2.0.6:
    resolution: {integrity: sha512-XlkWvfIm6RmsWtNJx+uqtKLS8eqFbxUg0ZzLXqY0caEy9l7hruX8IpiDnjsLavoBgqCCR71TqWO8MaXYheJ3RQ==}
    engines: {node: '>=10'}
    dependencies:
      escape-string-regexp: 2.0.0
    dev: false

  /statuses/1.5.0:
    resolution: {integrity: sha512-OpZ3zP+jT1PI7I8nemJX4AKmAX070ZkYPVWV/AaKTJl+tXCTGyVdC1a4SL8RUQYEwk/f34ZX8UTykN68FwrqAA==}
    engines: {node: '>= 0.6'}
    dev: false

  /statuses/2.0.1:
    resolution: {integrity: sha512-RwNA9Z/7PrK06rYLIzFMlaF+l73iwpzsqRIFgbMLbTcLD6cOao82TaWefPXQvB2fOC4AjuYSEndS7N/mTCbkdQ==}
    engines: {node: '>= 0.8'}
    dev: false

  /string-length/4.0.2:
    resolution: {integrity: sha512-+l6rNN5fYHNhZZy41RXsYptCjA2Igmq4EG7kZAYFQI1E1VTXarr6ZPXBg6eq7Y6eK4FEhY6AJlyuFIb/v/S0VQ==}
    engines: {node: '>=10'}
    dependencies:
      char-regex: 1.0.2
      strip-ansi: 6.0.1
    dev: false

  /string-width/4.2.3:
    resolution: {integrity: sha512-wKyQRQpjJ0sIp62ErSZdGsjMJWsap5oRNihHhu6G7JVO/9jIB6UyevL+tXuOqrng8j/cxKTWyWUwvSTriiZz/g==}
    engines: {node: '>=8'}
    dependencies:
      emoji-regex: 8.0.0
      is-fullwidth-code-point: 3.0.0
      strip-ansi: 6.0.1
    dev: false

  /string_decoder/1.1.1:
    resolution: {integrity: sha512-n/ShnvDi6FHbbVfviro+WojiFzv+s8MPMHBczVePfUpDJLwoLT0ht1l4YwBCbi8pJAveEEdnkHyPyTP/mzRfwg==}
    dependencies:
      safe-buffer: 5.1.2
    dev: false

  /string_decoder/1.3.0:
    resolution: {integrity: sha512-hkRX8U1WjJFd8LsDJ2yQ/wWWxaopEsABU1XfkM8A+j0+85JAGppt16cr1Whg6KIbb4okU6Mql6BOj+uup/wKeA==}
    dependencies:
      safe-buffer: 5.2.1
    dev: false

  /strip-ansi/6.0.1:
    resolution: {integrity: sha512-Y38VPSHcqkFrCpFnQ9vuSXmquuv5oXOKpGeT6aGrr3o3Gc9AlVa6JBfUSOCnbxGGZF+/0ooI7KrPuUSztUdU5A==}
    engines: {node: '>=8'}
    dependencies:
      ansi-regex: 5.0.1
    dev: false

  /strip-bom/3.0.0:
    resolution: {integrity: sha512-vavAMRXOgBVNF6nyEEmL3DBK19iRpDcoIwW+swQ+CbGiu7lju6t+JklA1MHweoWtadgt4ISVUsXLyDq34ddcwA==}
    engines: {node: '>=4'}
    dev: false

  /strip-bom/4.0.0:
    resolution: {integrity: sha512-3xurFv5tEgii33Zi8Jtp55wEIILR9eh34FAW00PZf+JnSsTmV/ioewSgQl97JHvgjoRGwPShsWm+IdrxB35d0w==}
    engines: {node: '>=8'}
    dev: false

  /strip-final-newline/2.0.0:
    resolution: {integrity: sha512-BrpvfNAE3dcvq7ll3xVumzjKjZQ5tI1sEUIKr3Uoks0XUl45St3FlatVqef9prk4jRDzhW6WZg+3bk93y6pLjA==}
    engines: {node: '>=6'}
    dev: false

  /strip-json-comments/3.1.1:
    resolution: {integrity: sha512-6fPc+R4ihwqP6N/aIv2f1gMH8lOVtWQHoqC4yK6oSDVVocumAsfCqjkXnqiYMhmMwS/mEHLp7Vehlt3ql6lEig==}
    engines: {node: '>=8'}
    dev: false

  /strong-log-transformer/2.1.0:
    resolution: {integrity: sha512-B3Hgul+z0L9a236FAUC9iZsL+nVHgoCJnqCbN588DjYxvGXaXaaFbfmQ/JhvKjZwsOukuR72XbHv71Qkug0HxA==}
    engines: {node: '>=4'}
    hasBin: true
    dependencies:
      duplexer: 0.1.2
      minimist: 1.2.7
      through: 2.3.8
    dev: false

  /style-loader/3.3.1_webpack@5.75.0:
    resolution: {integrity: sha512-GPcQ+LDJbrcxHORTRes6Jy2sfvK2kS6hpSfI/fXhPt+spVzxF6LJ1dHLN9zIGmVaaP044YKaIatFaufENRiDoQ==}
    engines: {node: '>= 12.13.0'}
    peerDependencies:
      webpack: ^5.0.0
    dependencies:
      webpack: 5.75.0
    dev: false

  /styled-jsx/5.1.0_react@18.2.0:
    resolution: {integrity: sha512-/iHaRJt9U7T+5tp6TRelLnqBqiaIT0HsO0+vgyj8hK2KUk7aejFqRrumqPUlAqDwAj8IbS/1hk3IhBAAK/FCUQ==}
    engines: {node: '>= 12.0.0'}
    peerDependencies:
      '@babel/core': '*'
      babel-plugin-macros: '*'
      react: '>= 16.8.0 || 17.x.x || ^18.0.0-0'
    peerDependenciesMeta:
      '@babel/core':
        optional: true
      babel-plugin-macros:
        optional: true
    dependencies:
      client-only: 0.0.1
      react: 18.2.0
    dev: false

  /stylehacks/5.1.1_postcss@8.4.20:
    resolution: {integrity: sha512-sBpcd5Hx7G6seo7b1LkpttvTz7ikD0LlH5RmdcBNb6fFR0Fl7LQwHDFr300q4cwUqi+IYrFGmsIHieMBfnN/Bw==}
    engines: {node: ^10 || ^12 || >=14.0}
    peerDependencies:
      postcss: ^8.2.15
    dependencies:
      browserslist: 4.21.4
      postcss: 8.4.20
      postcss-selector-parser: 6.0.11
    dev: false

  /stylus-loader/7.1.0_irl2hmhzopg6urv44vymn74p4e:
    resolution: {integrity: sha512-gNUEjjozR+oZ8cuC/Fx4LVXqZOgDKvpW9t2hpXHcxjfPYqSjQftaGwZUK+wL9B0QJ26uS6p1EmoWHmvld1dF7g==}
    engines: {node: '>= 14.15.0'}
    peerDependencies:
      stylus: '>=0.52.4'
      webpack: ^5.0.0
    dependencies:
      fast-glob: 3.2.12
      klona: 2.0.5
      normalize-path: 3.0.0
      stylus: 0.55.0
      webpack: 5.75.0
    dev: false

  /stylus/0.55.0:
    resolution: {integrity: sha512-MuzIIVRSbc8XxHH7FjkvWqkIcr1BvoMZoR/oFuAJDlh7VSaNJzrB4uJ38GRQa+mWjLXODAMzeDe0xi9GYbGwnw==}
    hasBin: true
    dependencies:
      css: 3.0.0
      debug: 3.1.0
      glob: 7.2.3
      mkdirp: 1.0.4
      safer-buffer: 2.1.2
      sax: 1.2.4
      semver: 6.3.0
      source-map: 0.7.4
    transitivePeerDependencies:
      - supports-color
    dev: false

  /supports-color/5.5.0:
    resolution: {integrity: sha512-QjVjwdXIt408MIiAqCX4oUKsgU2EqAGzs2Ppkm4aQYbjm+ZEWEcW4SfFNTr4uMNZma0ey4f5lgLrkB0aX0QMow==}
    engines: {node: '>=4'}
    dependencies:
      has-flag: 3.0.0
    dev: false

  /supports-color/7.2.0:
    resolution: {integrity: sha512-qpCAvRl9stuOHveKsn7HncJRvv501qIacKzQlO/+Lwxc9+0q2wLyv4Dfvt80/DPn2pqOBsJdDiogXGR9+OvwRw==}
    engines: {node: '>=8'}
    dependencies:
      has-flag: 4.0.0
    dev: false

  /supports-color/8.1.1:
    resolution: {integrity: sha512-MpUEN2OodtUzxvKQl72cUF7RQ5EiHsGvSsVG0ia9c5RbWGL2CI4C7EpPS8UTBIplnlzZiNuV56w+FuNxy3ty2Q==}
    engines: {node: '>=10'}
    dependencies:
      has-flag: 4.0.0
    dev: false

  /supports-hyperlinks/2.3.0:
    resolution: {integrity: sha512-RpsAZlpWcDwOPQA22aCH4J0t7L8JmAvsCxfOSEwm7cQs3LshN36QaTkwd70DnBOXDWGssw2eUoc8CaRWT0XunA==}
    engines: {node: '>=8'}
    dependencies:
      has-flag: 4.0.0
      supports-color: 7.2.0
    dev: false

  /supports-preserve-symlinks-flag/1.0.0:
    resolution: {integrity: sha512-ot0WnXS9fgdkgIcePe6RHNk1WA8+muPa6cSjeR3V8K27q9BB1rTE3R1p7Hv0z1ZyAc8s6Vvv8DIyWf681MAt0w==}
    engines: {node: '>= 0.4'}
    dev: false

  /svg-parser/2.0.4:
    resolution: {integrity: sha512-e4hG1hRwoOdRb37cIMSgzNsxyzKfayW6VOflrwvR+/bzrkyxY/31WkbgnQpgtrNp1SdpJvpUAGTa/ZoiPNDuRQ==}
    dev: false

  /svgo/2.8.0:
    resolution: {integrity: sha512-+N/Q9kV1+F+UeWYoSiULYo4xYSDQlTgb+ayMobAXPwMnLvop7oxKMo9OzIrX5x3eS4L4f2UHhc9axXwY8DpChg==}
    engines: {node: '>=10.13.0'}
    hasBin: true
    dependencies:
      '@trysound/sax': 0.2.0
      commander: 7.2.0
      css-select: 4.3.0
      css-tree: 1.1.3
      csso: 4.2.0
      picocolors: 1.0.0
      stable: 0.1.8
    dev: false

  /tapable/2.2.1:
    resolution: {integrity: sha512-GNzQvQTOIP6RyTfE2Qxb8ZVlNmw0n88vp1szwWRimP02mnTsx3Wtn5qRdqY9w2XduFNUgvOwhNnQsjwCp+kqaQ==}
    engines: {node: '>=6'}
    dev: false

  /tar-stream/2.2.0:
    resolution: {integrity: sha512-ujeqbceABgwMZxEJnk2HDY2DlnUZ+9oEcb1KzTVfYHio0UE6dG71n60d8D2I4qNvleWrrXpmjpt7vZeF1LnMZQ==}
    engines: {node: '>=6'}
    dependencies:
      bl: 4.1.0
      end-of-stream: 1.4.4
      fs-constants: 1.0.0
      inherits: 2.0.4
      readable-stream: 3.6.0
    dev: false

  /terminal-link/2.1.1:
    resolution: {integrity: sha512-un0FmiRUQNr5PJqy9kP7c40F5BOfpGlYTrxonDChEZB7pzZxRNp/bt+ymiy9/npwXya9KH99nJ/GXFIiUkYGFQ==}
    engines: {node: '>=8'}
    dependencies:
      ansi-escapes: 4.3.2
      supports-hyperlinks: 2.3.0
    dev: false

  /terser-webpack-plugin/5.3.6_webpack@5.75.0:
    resolution: {integrity: sha512-kfLFk+PoLUQIbLmB1+PZDMRSZS99Mp+/MHqDNmMA6tOItzRt+Npe3E+fsMs5mfcM0wCtrrdU387UnV+vnSffXQ==}
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
    dependencies:
      '@jridgewell/trace-mapping': 0.3.17
      jest-worker: 27.5.1
      schema-utils: 3.1.1
      serialize-javascript: 6.0.0
      terser: 5.16.1
      webpack: 5.75.0
    dev: false

  /terser/5.16.1:
    resolution: {integrity: sha512-xvQfyfA1ayT0qdK47zskQgRZeWLoOQ8JQ6mIgRGVNwZKdQMU+5FkCBjmv4QjcrTzyZquRw2FVtlJSRUmMKQslw==}
    engines: {node: '>=10'}
    hasBin: true
    dependencies:
      '@jridgewell/source-map': 0.3.2
      acorn: 8.8.1
      commander: 2.20.3
      source-map-support: 0.5.21
    dev: false

  /test-exclude/6.0.0:
    resolution: {integrity: sha512-cAGWPIyOHU6zlmg88jwm7VRyXnMN7iV68OGAbYDk/Mh/xC/pzVPlQtY6ngoIH/5/tciuhGfvESU8GrHrcxD56w==}
    engines: {node: '>=8'}
    dependencies:
      '@istanbuljs/schema': 0.1.3
      glob: 7.2.3
      minimatch: 3.1.2
    dev: false

  /through/2.3.8:
    resolution: {integrity: sha512-w89qg7PI8wAdvX60bMDP+bFoD5Dvhm9oLheFp5O4a2QF0cSBGsBX4qZmadPMvVqlLJBBci+WqGGOAPvcDeNSVg==}
    dev: false

  /thunky/1.1.0:
    resolution: {integrity: sha512-eHY7nBftgThBqOyHGVN+l8gF0BucP09fMo0oO/Lb0w1OF80dJv+lDVpXG60WMQvkcxAkNybKsrEIE3ZtKGmPrA==}
    dev: false

  /tmp/0.2.1:
    resolution: {integrity: sha512-76SUhtfqR2Ijn+xllcI5P1oyannHNHByD80W1q447gU3mp9G9PSpGdWmjUOHRDPiHYacIk66W7ubDTuPF3BEtQ==}
    engines: {node: '>=8.17.0'}
    dependencies:
      rimraf: 3.0.2
    dev: false

  /tmpl/1.0.5:
    resolution: {integrity: sha512-3f0uOEAQwIqGuWW2MVzYg8fV/QNnc/IpuJNG837rLuczAaLVHslWHZQj4IGiEl5Hs3kkbhwL9Ab7Hrsmuj+Smw==}
    dev: false

  /to-fast-properties/2.0.0:
    resolution: {integrity: sha512-/OaKK0xYrs3DmxRYqL/yDc+FxFUVYhDlXMhRmv3z915w2HF1tnN1omB354j8VUGO/hbRzyD6Y3sA7v7GS/ceog==}
    engines: {node: '>=4'}
    dev: false

  /to-regex-range/5.0.1:
    resolution: {integrity: sha512-65P7iz6X5yEr1cwcgvQxbbIw7Uk3gOy5dIdtZ4rDveLqhrdJP+Li/Hx6tyK0NEb+2GCyneCMJiGqrADCSNk8sQ==}
    engines: {node: '>=8.0'}
    dependencies:
      is-number: 7.0.0
    dev: false

  /toidentifier/1.0.1:
    resolution: {integrity: sha512-o5sSPKEkg/DIQNmH43V0/uerLrpzVedkUh8tGNvaeXpfpuwjKenlSox/2O/BTlZUtEe+JG7s5YhEz608PlAHRA==}
    engines: {node: '>=0.6'}
    dev: false

  /tree-kill/1.2.2:
    resolution: {integrity: sha512-L0Orpi8qGpRG//Nd+H90vFB+3iHnue1zSSGmNOOCh1GLJ7rUKVwV2HvijphGQS2UmhUZewS9VgvxYIdgr+fG1A==}
    hasBin: true
    dev: false

  /ts-loader/9.4.2_qw7fmzhoapcndkteb5rsc33stq:
    resolution: {integrity: sha512-OmlC4WVmFv5I0PpaxYb+qGeGOdm5giHU7HwDDUjw59emP2UYMHy9fFSDcYgSNoH8sXcj4hGCSEhlDZ9ULeDraA==}
    engines: {node: '>=12.0.0'}
    peerDependencies:
      typescript: '*'
      webpack: ^5.0.0
    dependencies:
      chalk: 4.1.0
      enhanced-resolve: 5.12.0
      micromatch: 4.0.5
      semver: 7.3.4
      typescript: 4.8.4
      webpack: 5.75.0
    dev: false

  /ts-node/10.9.1_typescript@4.8.4:
    resolution: {integrity: sha512-NtVysVPkxxrwFGUUxGYhfux8k78pQB3JqYBXlLRZgdGUqTO5wU/UyHop5p70iEbGhB7q5KmiZiU0Y3KlJrScEw==}
    hasBin: true
    peerDependencies:
      '@swc/core': '>=1.2.50'
      '@swc/wasm': '>=1.2.50'
      '@types/node': '*'
      typescript: '>=2.7'
    peerDependenciesMeta:
      '@swc/core':
        optional: true
      '@swc/wasm':
        optional: true
    dependencies:
      '@cspotcode/source-map-support': 0.8.1
      '@tsconfig/node10': 1.0.9
      '@tsconfig/node12': 1.0.11
      '@tsconfig/node14': 1.0.3
      '@tsconfig/node16': 1.0.3
      acorn: 8.8.1
      acorn-walk: 8.2.0
      arg: 4.1.3
      create-require: 1.1.1
      diff: 4.0.2
      make-error: 1.3.6
      typescript: 4.8.4
      v8-compile-cache-lib: 3.0.1
      yn: 3.1.1
    dev: false

  /tsconfig-paths-webpack-plugin/3.5.2:
    resolution: {integrity: sha512-EhnfjHbzm5IYI9YPNVIxx1moxMI4bpHD2e0zTXeDNQcwjjRaGepP7IhTHJkyDBG0CAOoxRfe7jCG630Ou+C6Pw==}
    dependencies:
      chalk: 4.1.0
      enhanced-resolve: 5.12.0
      tsconfig-paths: 3.14.1
    dev: false

  /tsconfig-paths/3.14.1:
    resolution: {integrity: sha512-fxDhWnFSLt3VuTwtvJt5fpwxBHg5AdKWMsgcPOOIilyjymcYVZoCQF8fvFRezCNfblEXmi+PcM1eYHeOAgXCOQ==}
    dependencies:
      '@types/json5': 0.0.29
      json5: 1.0.1
      minimist: 1.2.7
      strip-bom: 3.0.0
    dev: false

  /tslib/1.14.1:
    resolution: {integrity: sha512-Xni35NKzjgMrwevysHTCArtLDpPvye8zV/0E4EyYn43P7/7qvQwPh9BGkHewbMulVntbigmcT7rdX3BNo9wRJg==}
    dev: false

  /tslib/2.4.1:
    resolution: {integrity: sha512-tGyy4dAjRIEwI7BzsB0lynWgOpfqjUdq91XXAlIWD2OwKBH7oCl/GZG/HT4BOHrTlPMOASlMQ7veyTqpmRcrNA==}
    dev: false

  /type-detect/4.0.8:
    resolution: {integrity: sha512-0fr/mIH1dlO+x7TlcMy+bIDqKPsw/70tVyeHW787goQjhmqaZe10uwLujubK9q9Lg6Fiho1KUKDYz0Z7k7g5/g==}
    engines: {node: '>=4'}
    dev: false

  /type-fest/0.21.3:
    resolution: {integrity: sha512-t0rzBq87m3fVcduHDUFhKmyyX+9eo6WQjZvf51Ea/M0Q7+T374Jp1aUiyUl0GKxp8M/OETVHSDvmkyPgvX+X2w==}
    engines: {node: '>=10'}
    dev: false

  /type-is/1.6.18:
    resolution: {integrity: sha512-TkRKr9sUTxEH8MdfuCSP7VizJyzRNMjj2J2do2Jr3Kym598JVdEksuzPQCnlFPW4ky9Q+iA+ma9BGm06XQBy8g==}
    engines: {node: '>= 0.6'}
    dependencies:
      media-typer: 0.3.0
      mime-types: 2.1.35
    dev: false

  /typed-assert/1.0.9:
    resolution: {integrity: sha512-KNNZtayBCtmnNmbo5mG47p1XsCyrx6iVqomjcZnec/1Y5GGARaxPs6r49RnSPeUP3YjNYiU9sQHAtY4BBvnZwg==}
    dev: false

  /typescript/4.8.4:
    resolution: {integrity: sha512-QCh+85mCy+h0IGff8r5XWzOVSbBO+KfeYrMQh7NJ58QujwcE22u+NUSmUxqF+un70P9GXKxa2HCNiTTMJknyjQ==}
    engines: {node: '>=4.2.0'}
    hasBin: true
    dev: false

  /unicode-canonical-property-names-ecmascript/2.0.0:
    resolution: {integrity: sha512-yY5PpDlfVIU5+y/BSCxAJRBIS1Zc2dDG3Ujq+sR0U+JjUevW2JhocOF+soROYDSaAezOzOKuyyixhD6mBknSmQ==}
    engines: {node: '>=4'}
    dev: false

  /unicode-match-property-ecmascript/2.0.0:
    resolution: {integrity: sha512-5kaZCrbp5mmbz5ulBkDkbY0SsPOjKqVS35VpL9ulMPfSl0J0Xsm+9Evphv9CoIZFwre7aJoa94AY6seMKGVN5Q==}
    engines: {node: '>=4'}
    dependencies:
      unicode-canonical-property-names-ecmascript: 2.0.0
      unicode-property-aliases-ecmascript: 2.1.0
    dev: false

  /unicode-match-property-value-ecmascript/2.1.0:
    resolution: {integrity: sha512-qxkjQt6qjg/mYscYMC0XKRn3Rh0wFPlfxB0xkt9CfyTvpX1Ra0+rAmdX2QyAobptSEvuy4RtpPRui6XkV+8wjA==}
    engines: {node: '>=4'}
    dev: false

  /unicode-property-aliases-ecmascript/2.1.0:
    resolution: {integrity: sha512-6t3foTQI9qne+OZoVQB/8x8rk2k1eVy1gRXhV3oFQ5T6R1dqQ1xtin3XqSlx3+ATBkliTaR/hHyJBm+LVPNM8w==}
    engines: {node: '>=4'}
    dev: false

  /universalify/2.0.0:
    resolution: {integrity: sha512-hAZsKq7Yy11Zu1DE0OzWjw7nnLZmJZYTDZZyEFHZdUhV8FkH5MCfoU1XMaxXovpyW5nq5scPqq0ZDP9Zyl04oQ==}
    engines: {node: '>= 10.0.0'}
    dev: false

  /unpipe/1.0.0:
    resolution: {integrity: sha512-pjy2bYhSsufwWlKwPc+l3cN7+wuJlK6uz0YdJEOlQDbl6jo/YlPi4mb8agUkVC8BF7V8NuzeyPNqRksA3hztKQ==}
    engines: {node: '>= 0.8'}
    dev: false

  /update-browserslist-db/1.0.10_browserslist@4.21.4:
    resolution: {integrity: sha512-OztqDenkfFkbSG+tRxBeAnCVPckDBcvibKd35yDONx6OU8N7sqgwc7rCbkJ/WcYtVRZ4ba68d6byhC21GFh7sQ==}
    hasBin: true
    peerDependencies:
      browserslist: '>= 4.21.0'
    dependencies:
      browserslist: 4.21.4
      escalade: 3.1.1
      picocolors: 1.0.0
    dev: false

  /uri-js/4.4.1:
    resolution: {integrity: sha512-7rKUyy33Q1yc98pQ1DAmLtwX109F7TIfWlW1Ydo8Wl1ii1SeHieeh0HHfPeL2fMXK6z0s8ecKs9frCuLJvndBg==}
    dependencies:
      punycode: 2.1.1
    dev: false

  /url-loader/4.1.1:
    resolution: {integrity: sha512-3BTV812+AVHHOJQO8O5MkWgZ5aosP7GnROJwvzLS9hWDj00lZ6Z0wNak423Lp9PBZN05N+Jk/N5Si8jRAlGyWA==}
    engines: {node: '>= 10.13.0'}
    peerDependencies:
      file-loader: '*'
      webpack: ^4.0.0 || ^5.0.0
    peerDependenciesMeta:
      file-loader:
        optional: true
    dependencies:
      loader-utils: 2.0.4
      mime-types: 2.1.35
      schema-utils: 3.1.1
    dev: false

  /use-sync-external-store/1.2.0_react@18.2.0:
    resolution: {integrity: sha512-eEgnFxGQ1Ife9bzYs6VLi8/4X6CObHMw9Qr9tPY43iKwsPw8xE8+EFsf/2cFZ5S3esXgpWgtSCtLNS41F+sKPA==}
    peerDependencies:
      react: ^16.8.0 || ^17.0.0 || ^18.0.0
    dependencies:
      react: 18.2.0
    dev: false

  /util-deprecate/1.0.2:
    resolution: {integrity: sha512-EPD5q1uXyFxJpCrLnCc1nHnq3gOa6DZBocAIiI2TaSCA7VCJ1UJDMagCzIkXNsUYfD1daK//LTEQ8xiIbrHtcw==}
    dev: false

  /utils-merge/1.0.1:
    resolution: {integrity: sha512-pMZTvIkT1d+TFGvDOqodOclx0QWkkgi6Tdoa8gC8ffGAAqz9pzPTZWAybbsHHoED/ztMtkv/VoYTYyShUn81hA==}
    engines: {node: '>= 0.4.0'}
    dev: false

  /uuid/8.3.2:
    resolution: {integrity: sha512-+NYs2QeMWy+GWFOEm9xnn6HCDp0l7QBD7ml8zLUmJ+93Q5NF0NocErnwkTkXVFNiX3/fpC6afS8Dhb/gz7R7eg==}
    hasBin: true
    dev: false

  /v8-compile-cache-lib/3.0.1:
    resolution: {integrity: sha512-wa7YjyUGfNZngI/vtK0UHAN+lgDCxBPCylVXGp0zu59Fz5aiGtNXaq3DhIov063MorB+VfufLh3JlF2KdTK3xg==}
    dev: false

  /v8-compile-cache/2.3.0:
    resolution: {integrity: sha512-l8lCEmLcLYZh4nbunNZvQCJc5pv7+RCwa8q/LdUx8u7lsWvPDKmpodJAJNwkAhJC//dFY48KuIEmjtd4RViDrA==}
    dev: false

  /v8-to-istanbul/9.0.1:
    resolution: {integrity: sha512-74Y4LqY74kLE6IFyIjPtkSTWzUZmj8tdHT9Ii/26dvQ6K9Dl2NbEfj0XgU2sHCtKgt5VupqhlO/5aWuqS+IY1w==}
    engines: {node: '>=10.12.0'}
    dependencies:
      '@jridgewell/trace-mapping': 0.3.17
      '@types/istanbul-lib-coverage': 2.0.4
      convert-source-map: 1.9.0
    dev: false

  /vary/1.1.2:
    resolution: {integrity: sha512-BNGbWLfd0eUPabhkXUVm0j8uuvREyTh5ovRa/dyow/BqAbZJyC+5fU+IzQOzmAKzYqYRAISoRhdQr3eIZ/PXqg==}
    engines: {node: '>= 0.8'}
    dev: false

  /walker/1.0.8:
    resolution: {integrity: sha512-ts/8E8l5b7kY0vlWLewOkDXMmPdLcVV4GmOQLyxuSswIJsweeFZtAsMF7k1Nszz+TYBQrlYRmzOnr398y1JemQ==}
    dependencies:
      makeerror: 1.0.12
    dev: false

  /watchpack/2.4.0:
    resolution: {integrity: sha512-Lcvm7MGST/4fup+ifyKi2hjyIAwcdI4HRgtvTpIUxBRhB+RFtUh8XtDOxUfctVCnhVi+QQj49i91OyvzkJl6cg==}
    engines: {node: '>=10.13.0'}
    dependencies:
      glob-to-regexp: 0.4.1
      graceful-fs: 4.2.10
    dev: false

  /wbuf/1.7.3:
    resolution: {integrity: sha512-O84QOnr0icsbFGLS0O3bI5FswxzRr8/gHwWkDlQFskhSPryQXvrTMxjxGP4+iWYoauLoBvfDpkrOauZ+0iZpDA==}
    dependencies:
      minimalistic-assert: 1.0.1
    dev: false

  /webpack-dev-middleware/5.3.3_webpack@5.75.0:
    resolution: {integrity: sha512-hj5CYrY0bZLB+eTO+x/j67Pkrquiy7kWepMHmUMoPsmcUaeEnQJqFzHJOyxgWlq746/wUuA64p9ta34Kyb01pA==}
    engines: {node: '>= 12.13.0'}
    peerDependencies:
      webpack: ^4.0.0 || ^5.0.0
    dependencies:
      colorette: 2.0.19
      memfs: 3.4.12
      mime-types: 2.1.35
      range-parser: 1.2.1
      schema-utils: 4.0.0
      webpack: 5.75.0
    dev: false

  /webpack-dev-server/4.11.1_webpack@5.75.0:
    resolution: {integrity: sha512-lILVz9tAUy1zGFwieuaQtYiadImb5M3d+H+L1zDYalYoDl0cksAB1UNyuE5MMWJrG6zR1tXkCP2fitl7yoUJiw==}
    engines: {node: '>= 12.13.0'}
    hasBin: true
    peerDependencies:
      webpack: ^4.37.0 || ^5.0.0
      webpack-cli: '*'
    peerDependenciesMeta:
      webpack-cli:
        optional: true
    dependencies:
      '@types/bonjour': 3.5.10
      '@types/connect-history-api-fallback': 1.3.5
      '@types/express': 4.17.15
      '@types/serve-index': 1.9.1
      '@types/serve-static': 1.15.0
      '@types/sockjs': 0.3.33
      '@types/ws': 8.5.3
      ansi-html-community: 0.0.8
      bonjour-service: 1.0.14
      chokidar: 3.5.3
      colorette: 2.0.19
      compression: 1.7.4
      connect-history-api-fallback: 2.0.0
      default-gateway: 6.0.3
      express: 4.18.2
      graceful-fs: 4.2.10
      html-entities: 2.3.3
      http-proxy-middleware: 2.0.6_@types+express@4.17.15
      ipaddr.js: 2.0.1
      open: 8.4.0
      p-retry: 4.6.2
      rimraf: 3.0.2
      schema-utils: 4.0.0
      selfsigned: 2.1.1
      serve-index: 1.9.1
      sockjs: 0.3.24
      spdy: 4.0.2
      webpack: 5.75.0
      webpack-dev-middleware: 5.3.3_webpack@5.75.0
      ws: 8.11.0
    transitivePeerDependencies:
      - bufferutil
      - debug
      - supports-color
      - utf-8-validate
    dev: false

  /webpack-merge/5.8.0:
    resolution: {integrity: sha512-/SaI7xY0831XwP6kzuwhKWVKDP9t1QY1h65lAFLbZqMPIuYcD9QAW4u9STIbU9kaJbPBB/geU/gLr1wDjOhQ+Q==}
    engines: {node: '>=10.0.0'}
    dependencies:
      clone-deep: 4.0.1
      wildcard: 2.0.0
    dev: false

  /webpack-node-externals/3.0.0:
    resolution: {integrity: sha512-LnL6Z3GGDPht/AigwRh2dvL9PQPFQ8skEpVrWZXLWBYmqcaojHNN0onvHzie6rq7EWKrrBfPYqNEzTJgiwEQDQ==}
    engines: {node: '>=6'}
    dev: false

  /webpack-sources/3.2.3:
    resolution: {integrity: sha512-/DyMEOrDgLKKIG0fmvtz+4dUX/3Ghozwgm6iPp8KRhvn+eQf9+Q7GWxVNMk3+uCPWfdXYC4ExGBckIXdFEfH1w==}
    engines: {node: '>=10.13.0'}
    dev: false

  /webpack-subresource-integrity/5.1.0_webpack@5.75.0:
    resolution: {integrity: sha512-sacXoX+xd8r4WKsy9MvH/q/vBtEHr86cpImXwyg74pFIpERKt6FmB8cXpeuh0ZLgclOlHI4Wcll7+R5L02xk9Q==}
    engines: {node: '>= 12'}
    peerDependencies:
      html-webpack-plugin: '>= 5.0.0-beta.1 < 6'
      webpack: ^5.12.0
    peerDependenciesMeta:
      html-webpack-plugin:
        optional: true
    dependencies:
      typed-assert: 1.0.9
      webpack: 5.75.0
    dev: false

  /webpack-virtual-modules/0.4.6:
    resolution: {integrity: sha512-5tyDlKLqPfMqjT3Q9TAqf2YqjwmnUleZwzJi1A5qXnlBCdj2AtOJ6wAWdglTIDOPgOiOrXeBeFcsQ8+aGQ6QbA==}
    dev: false

  /webpack/5.75.0:
    resolution: {integrity: sha512-piaIaoVJlqMsPtX/+3KTTO6jfvrSYgauFVdt8cr9LTHKmcq/AMd4mhzsiP7ZF/PGRNPGA8336jldh9l2Kt2ogQ==}
    engines: {node: '>=10.13.0'}
    hasBin: true
    peerDependencies:
      webpack-cli: '*'
    peerDependenciesMeta:
      webpack-cli:
        optional: true
    dependencies:
      '@types/eslint-scope': 3.7.4
      '@types/estree': 0.0.51
      '@webassemblyjs/ast': 1.11.1
      '@webassemblyjs/wasm-edit': 1.11.1
      '@webassemblyjs/wasm-parser': 1.11.1
      acorn: 8.8.1
      acorn-import-assertions: 1.8.0_acorn@8.8.1
      browserslist: 4.21.4
      chrome-trace-event: 1.0.3
      enhanced-resolve: 5.12.0
      es-module-lexer: 0.9.3
      eslint-scope: 5.1.1
      events: 3.3.0
      glob-to-regexp: 0.4.1
      graceful-fs: 4.2.10
      json-parse-even-better-errors: 2.3.1
      loader-runner: 4.3.0
      mime-types: 2.1.35
      neo-async: 2.6.2
      schema-utils: 3.1.1
      tapable: 2.2.1
      terser-webpack-plugin: 5.3.6_webpack@5.75.0
      watchpack: 2.4.0
      webpack-sources: 3.2.3
    transitivePeerDependencies:
      - '@swc/core'
      - esbuild
      - uglify-js
    dev: false

  /websocket-driver/0.7.4:
    resolution: {integrity: sha512-b17KeDIQVjvb0ssuSDF2cYXSg2iztliJ4B9WdsuB6J952qCPKmnVq4DyW5motImXHDC1cBT/1UezrJVsKw5zjg==}
    engines: {node: '>=0.8.0'}
    dependencies:
      http-parser-js: 0.5.8
      safe-buffer: 5.2.1
      websocket-extensions: 0.1.4
    dev: false

  /websocket-extensions/0.1.4:
    resolution: {integrity: sha512-OqedPIGOfsDlo31UNwYbCFMSaO9m9G/0faIHj5/dZFDMFqPTcx6UwqyOy3COEaEOg/9VsGIpdqn62W5KhoKSpg==}
    engines: {node: '>=0.8.0'}
    dev: false

  /which/2.0.2:
    resolution: {integrity: sha512-BLI3Tl1TW3Pvl70l3yq3Y64i+awpwXqsGBYWkkqMtnbXgrMD+yj7rhW0kuEDxzJaYXGjEW5ogapKNMEKNMjibA==}
    engines: {node: '>= 8'}
    hasBin: true
    dependencies:
      isexe: 2.0.0
    dev: false

  /wildcard/2.0.0:
    resolution: {integrity: sha512-JcKqAHLPxcdb9KM49dufGXn2x3ssnfjbcaQdLlfZsL9rH9wgDQjUtDxbo8NE0F6SFvydeu1VhZe7hZuHsB2/pw==}
    dev: false

  /wrap-ansi/7.0.0:
    resolution: {integrity: sha512-YVGIj2kamLSTxw6NsZjoBxfSwsn0ycdesmc4p+Q21c5zPuZ1pl+NfxVdxPtdHvmNVOQ6XSYG4AUtyt/Fi7D16Q==}
    engines: {node: '>=10'}
    dependencies:
      ansi-styles: 4.3.0
      string-width: 4.2.3
      strip-ansi: 6.0.1
    dev: false

  /wrappy/1.0.2:
    resolution: {integrity: sha512-l4Sp/DRseor9wL6EvV2+TuQn63dMkPjZ/sp9XkghTEbV9KlPS1xUsZ3u7/IQO4wxtcFB4bgpQPRcR3QCvezPcQ==}
    dev: false

  /write-file-atomic/4.0.2:
    resolution: {integrity: sha512-7KxauUdBmSdWnmpaGFg+ppNjKF8uNLry8LyzjauQDOVONfFLNKrKvQOxZ/VuTIcS/gge/YNahf5RIIQWTSarlg==}
    engines: {node: ^12.13.0 || ^14.15.0 || >=16.0.0}
    dependencies:
      imurmurhash: 0.1.4
      signal-exit: 3.0.7
    dev: false

  /ws/8.11.0:
    resolution: {integrity: sha512-HPG3wQd9sNQoT9xHyNCXoDUa+Xw/VevmY9FoHyQ+g+rrMn4j6FB4np7Z0OhdTgjx6MgQLK7jwSy1YecU1+4Asg==}
    engines: {node: '>=10.0.0'}
    peerDependencies:
      bufferutil: ^4.0.1
      utf-8-validate: ^5.0.2
    peerDependenciesMeta:
      bufferutil:
        optional: true
      utf-8-validate:
        optional: true
    dev: false

  /y18n/5.0.8:
    resolution: {integrity: sha512-0pfFzegeDWJHJIAmTLRP2DwHjdF5s7jo9tuztdQxAhINCdvS+3nGINqPd00AphqJR/0LhANUS6/+7SCb98YOfA==}
    engines: {node: '>=10'}
    dev: false

  /yallist/4.0.0:
    resolution: {integrity: sha512-3wdGidZyq5PB084XLES5TpOSRA3wjXAlIWMhum2kRcv/41Sn2emQ0dycQW4uZXLejwKvg6EsvbdlVL+FYEct7A==}
    dev: false

  /yaml/1.10.2:
    resolution: {integrity: sha512-r3vXyErRCYJ7wg28yvBY5VSoAF8ZvlcW9/BwUzEtUsjvX/DKs24dIkuwjtuprwJJHsbyUbLApepYTR1BN4uHrg==}
    engines: {node: '>= 6'}
    dev: false

  /yargs-parser/21.1.1:
    resolution: {integrity: sha512-tVpsJW7DdjecAiFpbIB1e3qxIQsE6NoPc5/eTdrbbIC4h0LVsWhnoa3g+m2HclBIujHzsxZ4VJVA+GUuc2/LBw==}
    engines: {node: '>=12'}
    dev: false

  /yargs/17.6.2:
    resolution: {integrity: sha512-1/9UrdHjDZc0eOU0HxOHoS78C69UD3JRMvzlJ7S79S2nTaWRA/whGCTV8o9e/N/1Va9YIV7Q4sOxD8VV4pCWOw==}
    engines: {node: '>=12'}
    dependencies:
      cliui: 8.0.1
      escalade: 3.1.1
      get-caller-file: 2.0.5
      require-directory: 2.1.1
      string-width: 4.2.3
      y18n: 5.0.8
      yargs-parser: 21.1.1
    dev: false

  /yn/3.1.1:
    resolution: {integrity: sha512-Ux4ygGWsu2c7isFWe8Yu1YluJmqVhxqK2cLXNQA5AcC3QfbGNpM7fu0Y8b/z16pXLnFxZYvWhd3fhBY9DLmC6Q==}
    engines: {node: '>=6'}
    dev: false

  /yocto-queue/0.1.0:
    resolution: {integrity: sha512-rVksvsnNCdJ/ohGc6xgPwyN8eheCxsiLM8mxuE/t/mOVqJewPuO1miLpTHQiRgTKCLexL4MeAFVagts7HmNZ2Q==}
    engines: {node: '>=10'}
    dev: false
`;
