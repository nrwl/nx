export default `lockfileVersion: '6.0'

dependencies:
  '@azure/msal-node':
    specifier: 2.8.1
    version: 2.8.1
  '@google-cloud/functions-framework':
    specifier: '*'
    version: 3.4.0
  '@microsoft/microsoft-graph-client':
    specifier: 3.0.7
    version: 3.0.7
  date-fns:
    specifier: 3.6.0
    version: 3.6.0
  firebase-admin:
    specifier: 12.1.0
    version: 12.1.0
  firebase-functions:
    specifier: 5.0.1
    version: 5.0.1(firebase-admin@12.1.0)
  gaxios:
    specifier: 6.6.0
    version: 6.6.0
  google-auth-library:
    specifier: 9.10.0
    version: 9.10.0
  googleapis:
    specifier: 137.1.0
    version: 137.1.0
  lru-cache:
    specifier: 10.2.2
    version: 10.2.2

packages:

  /@azure/msal-common@14.10.0:
    resolution: {integrity: sha512-Zk6DPDz7e1wPgLoLgAp0349Yay9RvcjPM5We/ehuenDNsz/t9QEFI7tRoHpp/e47I4p20XE3FiDlhKwAo3utDA==}
    engines: {node: '>=0.8.0'}
    dev: false

  /@azure/msal-node@2.8.1:
    resolution: {integrity: sha512-VcZZM+5VvCWRBTOF7SxMKaxrz+EXjntx2u5AQe7QE06e6FuPJElGBrImgNgCh5QmFaNCfVFO+3qNR7UoFD/Gfw==}
    engines: {node: '>=16'}
    dependencies:
      '@azure/msal-common': 14.10.0
      jsonwebtoken: 9.0.2
      uuid: 8.3.2
    dev: false

  /@babel/code-frame@7.24.2:
    resolution: {integrity: sha512-y5+tLQyV8pg3fsiln67BVLD1P13Eg4lh5RW9mF0zUuvLrv9uIQ4MCL+CRT+FTsBlBjcIan6PGsLcBN0m3ClUyQ==}
    engines: {node: '>=6.9.0'}
    dependencies:
      '@babel/highlight': 7.24.5
      picocolors: 1.0.1
    dev: false

  /@babel/helper-validator-identifier@7.24.5:
    resolution: {integrity: sha512-3q93SSKX2TWCG30M2G2kwaKeTYgEUp5Snjuj8qm729SObL6nbtUldAi37qbxkD5gg3xnBio+f9nqpSepGZMvxA==}
    engines: {node: '>=6.9.0'}
    dev: false

  /@babel/highlight@7.24.5:
    resolution: {integrity: sha512-8lLmua6AVh/8SLJRRVD6V8p73Hir9w5mJrhE+IPpILG31KKlI9iz5zmBYKcWPS59qSfgP9RaSBQSHHE81WKuEw==}
    engines: {node: '>=6.9.0'}
    dependencies:
      '@babel/helper-validator-identifier': 7.24.5
      chalk: 2.4.2
      js-tokens: 4.0.0
      picocolors: 1.0.1
    dev: false

  /@babel/runtime@7.24.5:
    resolution: {integrity: sha512-Nms86NXrsaeU9vbBJKni6gXiEXZ4CVpYVzEjDH9Sb8vmZ3UljyA1GSOJl/6LGPO8EHLuSF9H+IxNXHPX8QHJ4g==}
    engines: {node: '>=6.9.0'}
    dependencies:
      regenerator-runtime: 0.14.1
    dev: false

  /@fastify/busboy@2.1.1:
    resolution: {integrity: sha512-vBZP4NlzfOlerQTnba4aqZoMhE/a9HY7HRqoOPaETQcSQuWEIyZMHGfVu6w9wGtGK5fED5qRs2DteVCjOH60sA==}
    engines: {node: '>=14'}
    dev: false

  /@firebase/app-check-interop-types@0.3.2:
    resolution: {integrity: sha512-LMs47Vinv2HBMZi49C09dJxp0QT5LwDzFaVGf/+ITHe3BlIhUiLNttkATSXplc89A2lAaeTqjgqVkiRfUGyQiQ==}
    dev: false

  /@firebase/app-types@0.9.2:
    resolution: {integrity: sha512-oMEZ1TDlBz479lmABwWsWjzHwheQKiAgnuKxE0pz0IXCVx7/rtlkx1fQ6GfgK24WCrxDKMplZrT50Kh04iMbXQ==}
    dev: false

  /@firebase/auth-interop-types@0.2.3:
    resolution: {integrity: sha512-Fc9wuJGgxoxQeavybiuwgyi+0rssr76b+nHpj+eGhXFYAdudMWyfBHvFL/I5fEHniUM/UQdFzi9VXJK2iZF7FQ==}
    dev: false

  /@firebase/component@0.6.7:
    resolution: {integrity: sha512-baH1AA5zxfaz4O8w0vDwETByrKTQqB5CDjRls79Sa4eAGAoERw4Tnung7XbMl3jbJ4B/dmmtsMrdki0KikwDYA==}
    dependencies:
      '@firebase/util': 1.9.6
      tslib: 2.6.2
    dev: false

  /@firebase/database-compat@1.0.5:
    resolution: {integrity: sha512-NDSMaDjQ+TZEMDMmzJwlTL05kh1+0Y84C+kVMaOmNOzRGRM7VHi29I6YUhCetXH+/b1Wh4ZZRyp1CuWkd8s6hg==}
    dependencies:
      '@firebase/component': 0.6.7
      '@firebase/database': 1.0.5
      '@firebase/database-types': 1.0.3
      '@firebase/logger': 0.4.2
      '@firebase/util': 1.9.6
      tslib: 2.6.2
    dev: false

  /@firebase/database-types@1.0.3:
    resolution: {integrity: sha512-39V/Riv2R3O/aUjYKh0xypj7NTNXNAK1bcgY5Kx+hdQPRS/aPTS8/5c0CGFYKgVuFbYlnlnhrCTYsh2uNhGwzA==}
    dependencies:
      '@firebase/app-types': 0.9.2
      '@firebase/util': 1.9.6
    dev: false

  /@firebase/database@1.0.5:
    resolution: {integrity: sha512-cAfwBqMQuW6HbhwI3Cb/gDqZg7aR0OmaJ85WUxlnoYW2Tm4eR0hFl5FEijI3/gYPUiUcUPQvTkGV222VkT7KPw==}
    dependencies:
      '@firebase/app-check-interop-types': 0.3.2
      '@firebase/auth-interop-types': 0.2.3
      '@firebase/component': 0.6.7
      '@firebase/logger': 0.4.2
      '@firebase/util': 1.9.6
      faye-websocket: 0.11.4
      tslib: 2.6.2
    dev: false

  /@firebase/logger@0.4.2:
    resolution: {integrity: sha512-Q1VuA5M1Gjqrwom6I6NUU4lQXdo9IAQieXlujeHZWvRt1b7qQ0KwBaNAjgxG27jgF9/mUwsNmO8ptBCGVYhB0A==}
    dependencies:
      tslib: 2.6.2
    dev: false

  /@firebase/util@1.9.6:
    resolution: {integrity: sha512-IBr1MZbp4d5MjBCXL3TW1dK/PDXX4yOGbiwRNh1oAbE/+ci5Uuvy9KIrsFYY80as1I0iOaD5oOMA9Q8j4TJWcw==}
    dependencies:
      tslib: 2.6.2
    dev: false

  /@google-cloud/firestore@7.7.0:
    resolution: {integrity: sha512-41/vBFXOeSYjFI/2mJuJrDwg2umGk+FDrI/SCGzBRUe+UZWDN4GoahIbGZ19YQsY0ANNl6DRiAy4wD6JezK02g==}
    engines: {node: '>=14.0.0'}
    requiresBuild: true
    dependencies:
      fast-deep-equal: 3.1.3
      functional-red-black-tree: 1.0.1
      google-gax: 4.3.3
      protobufjs: 7.3.0
    transitivePeerDependencies:
      - encoding
      - supports-color
    dev: false
    optional: true

  /@google-cloud/functions-framework@3.4.0:
    resolution: {integrity: sha512-TAh4h8bspgWkZBgFEUfali5C1NQBgqEGIIKdBjrAeG3vaPtI4CjV4AzGNA6TrEBidLIXXqHb3naO2lI1eqT7+A==}
    engines: {node: '>=10.0.0'}
    hasBin: true
    dependencies:
      '@types/express': 4.17.21
      body-parser: 1.20.2
      cloudevents: 8.0.0
      express: 4.19.2
      minimist: 1.2.8
      on-finished: 2.4.1
      read-pkg-up: 7.0.1
      semver: 7.6.2
    transitivePeerDependencies:
      - supports-color
    dev: false

  /@google-cloud/paginator@5.0.0:
    resolution: {integrity: sha512-87aeg6QQcEPxGCOthnpUjvw4xAZ57G7pL8FS0C4e/81fr3FjkpUpibf1s2v5XGyGhUVGF4Jfg7yEcxqn2iUw1w==}
    engines: {node: '>=14.0.0'}
    requiresBuild: true
    dependencies:
      arrify: 2.0.1
      extend: 3.0.2
    dev: false
    optional: true

  /@google-cloud/projectify@4.0.0:
    resolution: {integrity: sha512-MmaX6HeSvyPbWGwFq7mXdo0uQZLGBYCwziiLIGq5JVX+/bdI3SAq6bP98trV5eTWfLuvsMcIC1YJOF2vfteLFA==}
    engines: {node: '>=14.0.0'}
    requiresBuild: true
    dev: false
    optional: true

  /@google-cloud/promisify@4.0.0:
    resolution: {integrity: sha512-Orxzlfb9c67A15cq2JQEyVc7wEsmFBmHjZWZYQMUyJ1qivXyMwdyNOs9odi79hze+2zqdTtu1E19IM/FtqZ10g==}
    engines: {node: '>=14'}
    requiresBuild: true
    dev: false
    optional: true

  /@google-cloud/storage@7.11.0:
    resolution: {integrity: sha512-W+OPOCgq7a3aAMANALbJAlEnpMV9fy681JWIm7dYe5W/+nRhq/UvA477TJT5/oPNA5DgiAdMEdiitdoLpZqhJg==}
    engines: {node: '>=14'}
    requiresBuild: true
    dependencies:
      '@google-cloud/paginator': 5.0.0
      '@google-cloud/projectify': 4.0.0
      '@google-cloud/promisify': 4.0.0
      abort-controller: 3.0.0
      async-retry: 1.3.3
      duplexify: 4.1.3
      fast-xml-parser: 4.3.6
      gaxios: 6.6.0
      google-auth-library: 9.10.0
      html-entities: 2.5.2
      mime: 3.0.0
      p-limit: 3.1.0
      retry-request: 7.0.2
      teeny-request: 9.0.0
      uuid: 8.3.2
    transitivePeerDependencies:
      - encoding
      - supports-color
    dev: false
    optional: true

  /@grpc/grpc-js@1.10.8:
    resolution: {integrity: sha512-vYVqYzHicDqyKB+NQhAc54I1QWCBLCrYG6unqOIcBTHx+7x8C9lcoLj3KVJXs2VB4lUbpWY+Kk9NipcbXYWmvg==}
    engines: {node: '>=12.10.0'}
    requiresBuild: true
    dependencies:
      '@grpc/proto-loader': 0.7.13
      '@js-sdsl/ordered-map': 4.4.2
    dev: false
    optional: true

  /@grpc/proto-loader@0.7.13:
    resolution: {integrity: sha512-AiXO/bfe9bmxBjxxtYxFAXGZvMaN5s8kO+jBHAJCON8rJoB5YS/D6X7ZNc6XQkuHNmyl4CYaMI1fJ/Gn27RGGw==}
    engines: {node: '>=6'}
    hasBin: true
    dependencies:
      lodash.camelcase: 4.3.0
      long: 5.2.3
      protobufjs: 7.3.0
      yargs: 17.7.2
    dev: false

  /@js-sdsl/ordered-map@4.4.2:
    resolution: {integrity: sha512-iUKgm52T8HOE/makSxjqoWhe95ZJA1/G1sYsGev2JDKUSS14KAgg1LHb+Ba+IPow0xflbnSkOsZcO08C7w1gYw==}
    requiresBuild: true
    dev: false
    optional: true

  /@microsoft/microsoft-graph-client@3.0.7:
    resolution: {integrity: sha512-/AazAV/F+HK4LIywF9C+NYHcJo038zEnWkteilcxC1FM/uK/4NVGDKGrxx7nNq1ybspAroRKT4I1FHfxQzxkUw==}
    engines: {node: '>=12.0.0'}
    peerDependencies:
      '@azure/identity': '*'
      '@azure/msal-browser': '*'
      buffer: '*'
      stream-browserify: '*'
    peerDependenciesMeta:
      '@azure/identity':
        optional: true
      '@azure/msal-browser':
        optional: true
      buffer:
        optional: true
      stream-browserify:
        optional: true
    dependencies:
      '@babel/runtime': 7.24.5
      tslib: 2.6.2
    dev: false

  /@protobufjs/aspromise@1.1.2:
    resolution: {integrity: sha512-j+gKExEuLmKwvz3OgROXtrJ2UG2x8Ch2YZUxahh+s1F2HZ+wAceUNLkvy6zKCPVRkU++ZWQrdxsUeQXmcg4uoQ==}
    dev: false

  /@protobufjs/base64@1.1.2:
    resolution: {integrity: sha512-AZkcAA5vnN/v4PDqKyMR5lx7hZttPDgClv83E//FMNhR2TMcLUhfRUBHCmSl0oi9zMgDDqRUJkSxO3wm85+XLg==}
    dev: false

  /@protobufjs/codegen@2.0.4:
    resolution: {integrity: sha512-YyFaikqM5sH0ziFZCN3xDC7zeGaB/d0IUb9CATugHWbd1FRFwWwt4ld4OYMPWu5a3Xe01mGAULCdqhMlPl29Jg==}
    dev: false

  /@protobufjs/eventemitter@1.1.0:
    resolution: {integrity: sha512-j9ednRT81vYJ9OfVuXG6ERSTdEL1xVsNgqpkxMsbIabzSo3goCjDIveeGv5d03om39ML71RdmrGNjG5SReBP/Q==}
    dev: false

  /@protobufjs/fetch@1.1.0:
    resolution: {integrity: sha512-lljVXpqXebpsijW71PZaCYeIcE5on1w5DlQy5WH6GLbFryLUrBD4932W/E2BSpfRJWseIL4v/KPgBFxDOIdKpQ==}
    dependencies:
      '@protobufjs/aspromise': 1.1.2
      '@protobufjs/inquire': 1.1.0
    dev: false

  /@protobufjs/float@1.0.2:
    resolution: {integrity: sha512-Ddb+kVXlXst9d+R9PfTIxh1EdNkgoRe5tOX6t01f1lYWOvJnSPDBlG241QLzcyPdoNTsblLUdujGSE4RzrTZGQ==}
    dev: false

  /@protobufjs/inquire@1.1.0:
    resolution: {integrity: sha512-kdSefcPdruJiFMVSbn801t4vFK7KB/5gd2fYvrxhuJYg8ILrmn9SKSX2tZdV6V+ksulWqS7aXjBcRXl3wHoD9Q==}
    dev: false

  /@protobufjs/path@1.1.2:
    resolution: {integrity: sha512-6JOcJ5Tm08dOHAbdR3GrvP+yUUfkjG5ePsHYczMFLq3ZmMkAD98cDgcT2iA1lJ9NVwFd4tH/iSSoe44YWkltEA==}
    dev: false

  /@protobufjs/pool@1.1.0:
    resolution: {integrity: sha512-0kELaGSIDBKvcgS4zkjz1PeddatrjYcmMWOlAuAPwAeccUrPHdUqo/J6LiymHHEiJT5NrF1UVwxY14f+fy4WQw==}
    dev: false

  /@protobufjs/utf8@1.1.0:
    resolution: {integrity: sha512-Vvn3zZrhQZkkBE8LSuW3em98c0FwgO4nxzv6OdSxPKJIEKY2bGbHn+mhGIPerzI4twdxaP8/0+06HBpwf345Lw==}
    dev: false

  /@tootallnate/once@2.0.0:
    resolution: {integrity: sha512-XCuKFP5PS55gnMVu3dty8KPatLqUoy/ZYzDzAGCQ8JNFCkLXzmI7vNHCR+XpbZaMWQK/vQubr7PkYq8g470J/A==}
    engines: {node: '>= 10'}
    dev: false

  /@types/body-parser@1.19.5:
    resolution: {integrity: sha512-fB3Zu92ucau0iQ0JMCFQE7b/dv8Ot07NI3KaZIkIUNXq82k4eBAqUaneXfleGY9JWskeS9y+u0nXMyspcuQrCg==}
    dependencies:
      '@types/connect': 3.4.38
      '@types/node': 20.12.12
    dev: false

  /@types/caseless@0.12.5:
    resolution: {integrity: sha512-hWtVTC2q7hc7xZ/RLbxapMvDMgUnDvKvMOpKal4DrMyfGBUfB1oKaZlIRr6mJL+If3bAP6sV/QneGzF6tJjZDg==}
    requiresBuild: true
    dev: false
    optional: true

  /@types/connect@3.4.38:
    resolution: {integrity: sha512-K6uROf1LD88uDQqJCktA4yzL1YYAK6NgfsI0v/mTgyPKWsX1CnJ0XPSDhViejru1GcRkLWb8RlzFYJRqGUbaug==}
    dependencies:
      '@types/node': 20.12.12
    dev: false

  /@types/cors@2.8.17:
    resolution: {integrity: sha512-8CGDvrBj1zgo2qE+oS3pOCyYNqCPryMWY2bGfwA0dcfopWGgxs+78df0Rs3rc9THP4JkOhLsAa+15VdpAqkcUA==}
    dependencies:
      '@types/node': 20.12.12
    dev: false

  /@types/express-serve-static-core@4.19.0:
    resolution: {integrity: sha512-bGyep3JqPCRry1wq+O5n7oiBgGWmeIJXPjXXCo8EK0u8duZGSYar7cGqd3ML2JUsLGeB7fmc06KYo9fLGWqPvQ==}
    dependencies:
      '@types/node': 20.12.12
      '@types/qs': 6.9.15
      '@types/range-parser': 1.2.7
      '@types/send': 0.17.4
    dev: false

  /@types/express@4.17.21:
    resolution: {integrity: sha512-ejlPM315qwLpaQlQDTjPdsUFSc6ZsP4AN6AlWnogPjQ7CVi7PYF3YVz+CY3jE2pwYf7E/7HlDAN0rV2GxTG0HQ==}
    dependencies:
      '@types/body-parser': 1.19.5
      '@types/express-serve-static-core': 4.19.0
      '@types/qs': 6.9.15
      '@types/serve-static': 1.15.7
    dev: false

  /@types/express@4.17.3:
    resolution: {integrity: sha512-I8cGRJj3pyOLs/HndoP+25vOqhqWkAZsWMEmq1qXy/b/M3ppufecUwaK2/TVDVxcV61/iSdhykUjQQ2DLSrTdg==}
    dependencies:
      '@types/body-parser': 1.19.5
      '@types/express-serve-static-core': 4.19.0
      '@types/serve-static': 1.15.7
    dev: false

  /@types/http-errors@2.0.4:
    resolution: {integrity: sha512-D0CFMMtydbJAegzOyHjtiKPLlvnm3iTZyZRSZoLq2mRhDdmLfIWOCYPfQJ4cu2erKghU++QvjcUjp/5h7hESpA==}
    dev: false

  /@types/jsonwebtoken@9.0.6:
    resolution: {integrity: sha512-/5hndP5dCjloafCXns6SZyESp3Ldq7YjH3zwzwczYnjxIT0Fqzk5ROSYVGfFyczIue7IUEj8hkvLbPoLQ18vQw==}
    dependencies:
      '@types/node': 20.12.12
    dev: false

  /@types/long@4.0.2:
    resolution: {integrity: sha512-MqTGEo5bj5t157U6fA/BiDynNkn0YknVdh48CMPkTSpFTVmvao5UQmm7uEF6xBEo7qIMAlY/JSleYaE6VOdpaA==}
    requiresBuild: true
    dev: false
    optional: true

  /@types/mime@1.3.5:
    resolution: {integrity: sha512-/pyBZWSLD2n0dcHE3hq8s8ZvcETHtEuF+3E7XVt0Ig2nvsVQXdghHVcEkIWjy9A0wKfTn97a/PSDYohKIlnP/w==}
    dev: false

  /@types/node@20.12.12:
    resolution: {integrity: sha512-eWLDGF/FOSPtAvEqeRAQ4C8LSA7M1I7i0ky1I8U7kD1J5ITyW3AsRhQrKVoWf5pFKZ2kILsEGJhsI9r93PYnOw==}
    dependencies:
      undici-types: 5.26.5
    dev: false

  /@types/normalize-package-data@2.4.4:
    resolution: {integrity: sha512-37i+OaWTh9qeK4LSHPsyRC7NahnGotNuZvjLSgcPzblpHB3rrCJxAOgI5gCdKm7coonsaX1Of0ILiTcnZjbfxA==}
    dev: false

  /@types/qs@6.9.15:
    resolution: {integrity: sha512-uXHQKES6DQKKCLh441Xv/dwxOq1TVS3JPUMlEqoEglvlhR6Mxnlew/Xq/LRVHpLyk7iK3zODe1qYHIMltO7XGg==}
    dev: false

  /@types/range-parser@1.2.7:
    resolution: {integrity: sha512-hKormJbkJqzQGhziax5PItDUTMAM9uE2XXQmM37dyd4hVM+5aVl7oVxMVUiVQn2oCQFN/LKCZdvSM0pFRqbSmQ==}
    dev: false

  /@types/request@2.48.12:
    resolution: {integrity: sha512-G3sY+NpsA9jnwm0ixhAFQSJ3Q9JkpLZpJbI3GMv0mIAT0y3mRabYeINzal5WOChIiaTEGQYlHOKgkaM9EisWHw==}
    requiresBuild: true
    dependencies:
      '@types/caseless': 0.12.5
      '@types/node': 20.12.12
      '@types/tough-cookie': 4.0.5
      form-data: 2.5.1
    dev: false
    optional: true

  /@types/send@0.17.4:
    resolution: {integrity: sha512-x2EM6TJOybec7c52BX0ZspPodMsQUd5L6PRwOunVyVUhXiBSKf3AezDL8Dgvgt5o0UfKNfuA0eMLr2wLT4AiBA==}
    dependencies:
      '@types/mime': 1.3.5
      '@types/node': 20.12.12
    dev: false

  /@types/serve-static@1.15.7:
    resolution: {integrity: sha512-W8Ym+h8nhuRwaKPaDw34QUkwsGi6Rc4yYqvKFo5rm2FUEhCFbzVWrxXUxuKK8TASjWsysJY0nsmNCGhCOIsrOw==}
    dependencies:
      '@types/http-errors': 2.0.4
      '@types/node': 20.12.12
      '@types/send': 0.17.4
    dev: false

  /@types/tough-cookie@4.0.5:
    resolution: {integrity: sha512-/Ad8+nIOV7Rl++6f1BdKxFSMgmoqEoYbHRpPcx3JEfv8VRsQe9Z4mCXeJBzxs7mbHY/XOZZuXlRNfhpVPbs6ZA==}
    dev: false

  /abort-controller@3.0.0:
    resolution: {integrity: sha512-h8lQ8tacZYnR3vNQTgibj+tODHI5/+l06Au2Pcriv/Gmet0eaj4TwWH41sO9wnHDiQsEj19q0drzdWdeAHtweg==}
    engines: {node: '>=6.5'}
    requiresBuild: true
    dependencies:
      event-target-shim: 5.0.1
    dev: false
    optional: true

  /accepts@1.3.8:
    resolution: {integrity: sha512-PYAthTa2m2VKxuvSD3DPC/Gy+U+sOA1LAuT8mkmRuvw+NACSaeXEQ+NHcVF7rONl6qcaxV3Uuemwawk+7+SJLw==}
    engines: {node: '>= 0.6'}
    dependencies:
      mime-types: 2.1.35
      negotiator: 0.6.3
    dev: false

  /agent-base@6.0.2:
    resolution: {integrity: sha512-RZNwNclF7+MS/8bDg70amg32dyeZGZxiDuQmZxKLAlQjr3jGyLx+4Kkk58UO7D2QdgFIQCovuSuZESne6RG6XQ==}
    engines: {node: '>= 6.0.0'}
    dependencies:
      debug: 4.3.4
    transitivePeerDependencies:
      - supports-color
    dev: false

  /agent-base@7.1.1:
    resolution: {integrity: sha512-H0TSyFNDMomMNJQBn8wFV5YC/2eJ+VXECwOadZJT554xP6cODZHPX3H9QMQECxvrgiSOP1pHjy1sMWQVYJOUOA==}
    engines: {node: '>= 14'}
    dependencies:
      debug: 4.3.4
    transitivePeerDependencies:
      - supports-color
    dev: false

  /ajv-formats@2.1.1(ajv@8.12.0):
    resolution: {integrity: sha512-Wx0Kx52hxE7C18hkMEggYlEifqWZtYaRgouJor+WMdPnQyEK13vgEWyVNup7SoeeoLMsr4kf5h6dOW11I15MUA==}
    peerDependencies:
      ajv: ^8.0.0
    peerDependenciesMeta:
      ajv:
        optional: true
    dependencies:
      ajv: 8.12.0
    dev: false

  /ajv-formats@2.1.1(ajv@8.13.0):
    resolution: {integrity: sha512-Wx0Kx52hxE7C18hkMEggYlEifqWZtYaRgouJor+WMdPnQyEK13vgEWyVNup7SoeeoLMsr4kf5h6dOW11I15MUA==}
    peerDependencies:
      ajv: ^8.0.0
    peerDependenciesMeta:
      ajv:
        optional: true
    dependencies:
      ajv: 8.13.0
    dev: false

  /ajv@8.12.0:
    resolution: {integrity: sha512-sRu1kpcO9yLtYxBKvqfTeh9KzZEwO3STyX1HT+4CaDzC6HpTGYhIhPIzj9XuKU7KYDwnaeh5hcOwjy1QuJzBPA==}
    dependencies:
      fast-deep-equal: 3.1.3
      json-schema-traverse: 1.0.0
      require-from-string: 2.0.2
      uri-js: 4.4.1
    dev: false

  /ajv@8.13.0:
    resolution: {integrity: sha512-PRA911Blj99jR5RMeTunVbNXMF6Lp4vZXnk5GQjcnUWUTsrXtekg/pnmFFI2u/I36Y/2bITGS30GZCXei6uNkA==}
    dependencies:
      fast-deep-equal: 3.1.3
      json-schema-traverse: 1.0.0
      require-from-string: 2.0.2
      uri-js: 4.4.1
    dev: false

  /ansi-regex@5.0.1:
    resolution: {integrity: sha512-quJQXlTSUGL2LH9SUXo8VwsY4soanhgo6LNSm84E1LBcE8s3O0wpdiRzyR9z/ZZJMlMWv37qOOb9pdJlMUEKFQ==}
    engines: {node: '>=8'}
    dev: false

  /ansi-styles@3.2.1:
    resolution: {integrity: sha512-VT0ZI6kZRdTh8YyJw3SMbYm/u+NqfsAxEpWO0Pf9sq8/e94WxxOpPKx9FR1FlyCtOVDNOQ+8ntlqFxiRc+r5qA==}
    engines: {node: '>=4'}
    dependencies:
      color-convert: 1.9.3
    dev: false

  /ansi-styles@4.3.0:
    resolution: {integrity: sha512-zbB9rCJAT1rbjiVDb2hqKFHNYLxgtk8NURxZ3IZwD3F6NtxbXZQCnnSi1Lkx+IDohdPlFp222wVALIheZJQSEg==}
    engines: {node: '>=8'}
    dependencies:
      color-convert: 2.0.1
    dev: false

  /array-flatten@1.1.1:
    resolution: {integrity: sha512-PCVAQswWemu6UdxsDFFX/+gVeYqKAod3D3UVm91jHwynguOwAvYPhx8nNlM++NqRcK6CxxpUafjmhIdKiHibqg==}
    dev: false

  /arrify@2.0.1:
    resolution: {integrity: sha512-3duEwti880xqi4eAMN8AyR4a0ByT90zoYdLlevfrvU43vb0YZwZVfxOgxWrLXXXpyugL0hNZc9G6BiB5B3nUug==}
    engines: {node: '>=8'}
    requiresBuild: true
    dev: false
    optional: true

  /async-retry@1.3.3:
    resolution: {integrity: sha512-wfr/jstw9xNi/0teMHrRW7dsz3Lt5ARhYNZ2ewpadnhaIp5mbALhOAP+EAdsC7t4Z6wqsDVv9+W6gm1Dk9mEyw==}
    requiresBuild: true
    dependencies:
      retry: 0.13.1
    dev: false
    optional: true

  /asynckit@0.4.0:
    resolution: {integrity: sha512-Oei9OH4tRh0YqU3GxhX79dM/mwVgvbZJaSNaRk+bshkj0S5cfHcgYakreBjrHwatXKbz+IoIdYLxrKim2MjW0Q==}
    dev: false

  /available-typed-arrays@1.0.7:
    resolution: {integrity: sha512-wvUjBtSGN7+7SjNpq/9M2Tg350UZD3q62IFZLbRAR1bSMlCo1ZaeW+BJ+D090e4hIIZLBcTDWe4Mh4jvUDajzQ==}
    engines: {node: '>= 0.4'}
    dependencies:
      possible-typed-array-names: 1.0.0
    dev: false

  /base64-js@1.5.1:
    resolution: {integrity: sha512-AKpaYlHn8t4SVbOHCy+b5+KKgvR4vrsD8vbvrbiQJps7fKDTkjkDry6ji0rUJjC0kzbNePLwzxq8iypo41qeWA==}
    dev: false

  /bignumber.js@9.1.2:
    resolution: {integrity: sha512-2/mKyZH9K85bzOEfhXDBFZTGd1CTs+5IHpeFQo9luiBG7hghdC851Pj2WAhb6E3R6b9tZj/XKhbg4fum+Kepug==}
    dev: false

  /bl@4.1.0:
    resolution: {integrity: sha512-1W07cM9gS6DcLperZfFSj+bWLtaPGSOHWhPiGzXmvVJbRLdG82sH/Kn8EtW1VqWVA54AKf2h5k5BbnIbwF3h6w==}
    dependencies:
      buffer: 5.7.1
      inherits: 2.0.4
      readable-stream: 3.6.2
    dev: false

  /body-parser@1.20.2:
    resolution: {integrity: sha512-ml9pReCu3M61kGlqoTm2umSXTlRTuGTx0bfYj+uIUKKYycG5NtSbeetV3faSU6R7ajOPw0g/J1PvK4qNy7s5bA==}
    engines: {node: '>= 0.8', npm: 1.2.8000 || >= 1.4.16}
    dependencies:
      bytes: 3.1.2
      content-type: 1.0.5
      debug: 2.6.9
      depd: 2.0.0
      destroy: 1.2.0
      http-errors: 2.0.0
      iconv-lite: 0.4.24
      on-finished: 2.4.1
      qs: 6.11.0
      raw-body: 2.5.2
      type-is: 1.6.18
      unpipe: 1.0.0
    transitivePeerDependencies:
      - supports-color
    dev: false

  /buffer-equal-constant-time@1.0.1:
    resolution: {integrity: sha512-zRpUiDwd/xk6ADqPMATG8vc9VPrkck7T07OIx0gnjmJAnHnTVXNQG3vfvWNuiZIkwu9KrKdA1iJKfsfTVxE6NA==}
    dev: false

  /buffer@5.7.1:
    resolution: {integrity: sha512-EHcyIPBQ4BSGlvjB16k5KgAJ27CIsHY/2JBmCRReo48y9rQ3MaUzWX3KVlBa4U7MyX02HdVj0K7C3WaB3ju7FQ==}
    dependencies:
      base64-js: 1.5.1
      ieee754: 1.2.1
    dev: false

  /bytes@3.1.2:
    resolution: {integrity: sha512-/Nf7TyzTx6S3yRJObOAV7956r8cr2+Oj8AC5dt8wSP3BQAoeX58NoHyCU8P8zGkNXStjTSi6fzO6F0pBdcYbEg==}
    engines: {node: '>= 0.8'}
    dev: false

  /call-bind@1.0.7:
    resolution: {integrity: sha512-GHTSNSYICQ7scH7sZ+M2rFopRoLh8t2bLSW6BbgrtLsahOIB5iyAVJf9GjWK3cYTDaMj4XdBpM1cA6pIS0Kv2w==}
    engines: {node: '>= 0.4'}
    dependencies:
      es-define-property: 1.0.0
      es-errors: 1.3.0
      function-bind: 1.1.2
      get-intrinsic: 1.2.4
      set-function-length: 1.2.2
    dev: false

  /chalk@2.4.2:
    resolution: {integrity: sha512-Mti+f9lpJNcwF4tWV8/OrTTtF1gZi+f8FqlyAdouralcFWFQWF2+NgCHShjkCb+IFBLq9buZwE1xckQU4peSuQ==}
    engines: {node: '>=4'}
    dependencies:
      ansi-styles: 3.2.1
      escape-string-regexp: 1.0.5
      supports-color: 5.5.0
    dev: false

  /chownr@1.1.4:
    resolution: {integrity: sha512-jJ0bqzaylmJtVnNgzTeSOs8DPavpbYgEr/b0YL8/2GO3xJEhInFmhKMUnEJQjZumK7KXGFhUy89PrsJWlakBVg==}
    dev: false

  /cliui@8.0.1:
    resolution: {integrity: sha512-BSeNnyus75C4//NQ9gQt1/csTXyo/8Sb+afLAkzAptFuMsod9HFokGNudZpi/oQV73hnVK+sR+5PVRMd+Dr7YQ==}
    engines: {node: '>=12'}
    dependencies:
      string-width: 4.2.3
      strip-ansi: 6.0.1
      wrap-ansi: 7.0.0
    dev: false

  /cloudevents@8.0.0:
    resolution: {integrity: sha512-G1Z/r8QMFAsP+F1PuZSHzx1ocPy4vrdQMTHD3orjDaM5kccmPU6nMmpVrF07b53aaxcrLbORUmRepY/DgvdhVw==}
    engines: {node: '>=16 <=20'}
    dependencies:
      ajv: 8.13.0
      ajv-formats: 2.1.1(ajv@8.13.0)
      json-bigint: 1.0.0
      process: 0.11.10
      util: 0.12.5
      uuid: 8.3.2
    dev: false

  /color-convert@1.9.3:
    resolution: {integrity: sha512-QfAUtd+vFdAtFQcC8CCyYt1fYWxSqAiK2cSD6zDB8N3cpsEBAvRxp9zOGg6G/SHHJYAT88/az/IuDGALsNVbGg==}
    dependencies:
      color-name: 1.1.3
    dev: false

  /color-convert@2.0.1:
    resolution: {integrity: sha512-RRECPsj7iu/xb5oKYcsFHSppFNnsj/52OVTRKb4zP5onXwVF3zVmmToNcOfGC+CRDpfK/U584fMg38ZHCaElKQ==}
    engines: {node: '>=7.0.0'}
    dependencies:
      color-name: 1.1.4
    dev: false

  /color-name@1.1.3:
    resolution: {integrity: sha512-72fSenhMw2HZMTVHeCA9KCmpEIbzWiQsjN+BHcBbS9vr1mtt+vJjPdksIBNUmKAW8TFUDPJK5SUU3QhE9NEXDw==}
    dev: false

  /color-name@1.1.4:
    resolution: {integrity: sha512-dOy+3AuW3a2wNbZHIuMZpTcgjGuLU/uBL/ubcZF9OXbDo8ff4O8yVp5Bf0efS8uEoYo5q4Fx7dY9OgQGXgAsQA==}
    dev: false

  /combined-stream@1.0.8:
    resolution: {integrity: sha512-FQN4MRfuJeHf7cBbBMJFXhKSDq+2kAArBlmRBvcvFE5BB1HZKXtSFASDhdlz9zOYwxh8lDdnvmMOe/+5cdoEdg==}
    engines: {node: '>= 0.8'}
    dependencies:
      delayed-stream: 1.0.0
    dev: false

  /content-disposition@0.5.4:
    resolution: {integrity: sha512-FveZTNuGw04cxlAiWbzi6zTAL/lhehaWbTtgluJh4/E95DqMwTmha3KZN1aAWA8cFIhHzMZUvLevkw5Rqk+tSQ==}
    engines: {node: '>= 0.6'}
    dependencies:
      safe-buffer: 5.2.1
    dev: false

  /content-type@1.0.5:
    resolution: {integrity: sha512-nTjqfcBFEipKdXCv4YDQWCfmcLZKm81ldF0pAopTvyrFGVbcR6P/VAAd5G7N+0tTr8QqiU0tFadD6FK4NtJwOA==}
    engines: {node: '>= 0.6'}
    dev: false

  /cookie-signature@1.0.6:
    resolution: {integrity: sha512-QADzlaHc8icV8I7vbaJXJwod9HWYp8uCqf1xa4OfNu1T7JVxQIrUgOWtHdNDtPiywmFbiS12VjotIXLrKM3orQ==}
    dev: false

  /cookie@0.6.0:
    resolution: {integrity: sha512-U71cyTamuh1CRNCfpGY6to28lxvNwPG4Guz/EVjgf3Jmzv0vlDp1atT9eS5dDjMYHucpHbWns6Lwf3BKz6svdw==}
    engines: {node: '>= 0.6'}
    dev: false

  /cors@2.8.5:
    resolution: {integrity: sha512-KIHbLJqu73RGr/hnbrO9uBeixNGuvSQjul/jdFvS/KFSIH1hWVd1ng7zOHx+YrEfInLG7q4n6GHQ9cDtxv/P6g==}
    engines: {node: '>= 0.10'}
    dependencies:
      object-assign: 4.1.1
      vary: 1.1.2
    dev: false

  /date-fns@3.6.0:
    resolution: {integrity: sha512-fRHTG8g/Gif+kSh50gaGEdToemgfj74aRX3swtiouboip5JDLAyDE9F11nHMIcvOaXeOC6D7SpNhi7uFyB7Uww==}
    dev: false

  /debug@2.6.9:
    resolution: {integrity: sha512-bC7ElrdJaJnPbAP+1EotYvqZsb3ecl5wi6Bfi6BJTUcNowp6cvspg0jXznRTKDjm/E7AdgFBVeAPVMNcKGsHMA==}
    peerDependencies:
      supports-color: '*'
    peerDependenciesMeta:
      supports-color:
        optional: true
    dependencies:
      ms: 2.0.0
    dev: false

  /debug@4.3.4:
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

  /decompress-response@6.0.0:
    resolution: {integrity: sha512-aW35yZM6Bb/4oJlZncMH2LCoZtJXTRxES17vE3hoRiowU2kWHaJKFkSBDnDR+cm9J+9QhXmREyIfv0pji9ejCQ==}
    engines: {node: '>=10'}
    dependencies:
      mimic-response: 3.1.0
    dev: false

  /deep-extend@0.6.0:
    resolution: {integrity: sha512-LOHxIOaPYdHlJRtCQfDIVZtfw/ufM8+rVj649RIHzcm/vGwQRXFt6OPqIFWsm2XEMrNIEtWR64sY1LEKD2vAOA==}
    engines: {node: '>=4.0.0'}
    dev: false

  /define-data-property@1.1.4:
    resolution: {integrity: sha512-rBMvIzlpA8v6E+SJZoo++HAYqsLrkg7MSfIinMPFhmkorw7X+dOXVJQs+QT69zGkzMyfDnIMN2Wid1+NbL3T+A==}
    engines: {node: '>= 0.4'}
    dependencies:
      es-define-property: 1.0.0
      es-errors: 1.3.0
      gopd: 1.0.1
    dev: false

  /delayed-stream@1.0.0:
    resolution: {integrity: sha512-ZySD7Nf91aLB0RxL4KGrKHBXl7Eds1DAmEdcoVawXnLD7SDhpNgtuII2aAkg7a7QS41jxPSZ17p4VdGnMHk3MQ==}
    engines: {node: '>=0.4.0'}
    dev: false

  /depd@2.0.0:
    resolution: {integrity: sha512-g7nH6P6dyDioJogAAGprGpCtVImJhpPk/roCzdb3fIh61/s/nPsfR6onyMwkCAR/OlC3yBC0lESvUoQEAssIrw==}
    engines: {node: '>= 0.8'}
    dev: false

  /destroy@1.2.0:
    resolution: {integrity: sha512-2sJGJTaXIIaR1w4iJSNoN0hnMY7Gpc/n8D4qSCJw8QqFWXf7cuAgnEHxBpweaVcPevC2l3KpjYCx3NypQQgaJg==}
    engines: {node: '>= 0.8', npm: 1.2.8000 || >= 1.4.16}
    dev: false

  /detect-libc@2.0.3:
    resolution: {integrity: sha512-bwy0MGW55bG41VqxxypOsdSdGqLwXPI/focwgTYCFMbdUiBAxLg9CFzG08sz2aqzknwiX7Hkl0bQENjg8iLByw==}
    engines: {node: '>=8'}
    dev: false

  /duplexify@4.1.3:
    resolution: {integrity: sha512-M3BmBhwJRZsSx38lZyhE53Csddgzl5R7xGJNk7CVddZD6CcmwMCH8J+7AprIrQKH7TonKxaCjcv27Qmf+sQ+oA==}
    requiresBuild: true
    dependencies:
      end-of-stream: 1.4.4
      inherits: 2.0.4
      readable-stream: 3.6.2
      stream-shift: 1.0.3
    dev: false
    optional: true

  /ecdsa-sig-formatter@1.0.11:
    resolution: {integrity: sha512-nagl3RYrbNv6kQkeJIpt6NJZy8twLB/2vtz6yN9Z4vRKHN4/QZJIEbqohALSgwKdnksuY3k5Addp5lg8sVoVcQ==}
    dependencies:
      safe-buffer: 5.2.1
    dev: false

  /ee-first@1.1.1:
    resolution: {integrity: sha512-WMwm9LhRUo+WUaRN+vRuETqG89IgZphVSNkdFgeb6sS/E4OrDIN7t48CAewSHXc6C8lefD8KKfr5vY61brQlow==}
    dev: false

  /emoji-regex@8.0.0:
    resolution: {integrity: sha512-MSjYzcWNOA0ewAHpz0MxpYFvwg6yjy1NG3xteoqz644VCo/RPgnr1/GGt+ic3iJTzQ8Eu3TdM14SawnVUmGE6A==}
    dev: false

  /encodeurl@1.0.2:
    resolution: {integrity: sha512-TPJXq8JqFaVYm2CWmPvnP2Iyo4ZSM7/QKcSmuMLDObfpH5fi7RUGmd/rTDf+rut/saiDiQEeVTNgAmJEdAOx0w==}
    engines: {node: '>= 0.8'}
    dev: false

  /end-of-stream@1.4.4:
    resolution: {integrity: sha512-+uw1inIHVPQoaVuHzRyXd21icM+cnt4CzD5rW+NC1wjOUSTOs+Te7FOv7AhN7vS9x/oIyhLP5PR1H+phQAHu5Q==}
    dependencies:
      once: 1.4.0
    dev: false

  /error-ex@1.3.2:
    resolution: {integrity: sha512-7dFHNmqeFSEt2ZBsCriorKnn3Z2pj+fd9kmI6QoWw4//DL+icEBfc0U7qJCisqrTsKTjw4fNFy2pW9OqStD84g==}
    dependencies:
      is-arrayish: 0.2.1
    dev: false

  /es-define-property@1.0.0:
    resolution: {integrity: sha512-jxayLKShrEqqzJ0eumQbVhTYQM27CfT1T35+gCgDFoL82JLsXqTJ76zv6A0YLOgEnLUMvLzsDsGIrl8NFpT2gQ==}
    engines: {node: '>= 0.4'}
    dependencies:
      get-intrinsic: 1.2.4
    dev: false

  /es-errors@1.3.0:
    resolution: {integrity: sha512-Zf5H2Kxt2xjTvbJvP2ZWLEICxA6j+hAmMzIlypy4xcBg1vKVnx89Wy0GbS+kf5cwCVFFzdCFh2XSCFNULS6csw==}
    engines: {node: '>= 0.4'}
    dev: false

  /escalade@3.1.2:
    resolution: {integrity: sha512-ErCHMCae19vR8vQGe50xIsVomy19rg6gFu3+r3jkEO46suLMWBksvVyoGgQV+jOfl84ZSOSlmv6Gxa89PmTGmA==}
    engines: {node: '>=6'}
    dev: false

  /escape-html@1.0.3:
    resolution: {integrity: sha512-NiSupZ4OeuGwr68lGIeym/ksIZMJodUGOSCZ/FSnTxcrekbvqrgdUxlJOMpijaKZVjAJrWrGs/6Jy8OMuyj9ow==}
    dev: false

  /escape-string-regexp@1.0.5:
    resolution: {integrity: sha512-vbRorB5FUQWvla16U8R/qgaFIya2qGzwDrNmCZuYKrbdSUMG6I1ZCGQRefkRVhuOkIGVne7BQ35DSfo1qvJqFg==}
    engines: {node: '>=0.8.0'}
    dev: false

  /etag@1.8.1:
    resolution: {integrity: sha512-aIL5Fx7mawVa300al2BnEE4iNvo1qETxLrPI/o05L7z6go7fCw1J6EQmbK4FmJ2AS7kgVF/KEZWufBfdClMcPg==}
    engines: {node: '>= 0.6'}
    dev: false

  /event-target-shim@5.0.1:
    resolution: {integrity: sha512-i/2XbnSz/uxRCU6+NdVJgKWDTM427+MqYbkQzD321DuCQJUqOuJKIA0IM2+W2xtYHdKOmZ4dR6fExsd4SXL+WQ==}
    engines: {node: '>=6'}
    requiresBuild: true
    dev: false
    optional: true

  /expand-template@2.0.3:
    resolution: {integrity: sha512-XYfuKMvj4O35f/pOXLObndIRvyQ+/+6AhODh+OKWj9S9498pHHn/IMszH+gt0fBCRWMNfk1ZSp5x3AifmnI2vg==}
    engines: {node: '>=6'}
    dev: false

  /express@4.19.2:
    resolution: {integrity: sha512-5T6nhjsT+EOMzuck8JjBHARTHfMht0POzlA60WV2pMD3gyXw2LZnZ+ueGdNxG+0calOJcWKbpFcuzLZ91YWq9Q==}
    engines: {node: '>= 0.10.0'}
    dependencies:
      accepts: 1.3.8
      array-flatten: 1.1.1
      body-parser: 1.20.2
      content-disposition: 0.5.4
      content-type: 1.0.5
      cookie: 0.6.0
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

  /extend@3.0.2:
    resolution: {integrity: sha512-fjquC59cD7CyW6urNXK0FBufkZcoiGG80wTuPujX590cB5Ttln20E2UB4S/WARVqhXffZl2LNgS+gQdPIIim/g==}
    dev: false

  /farmhash@3.3.1:
    resolution: {integrity: sha512-XUizHanzlr/v7suBr/o85HSakOoWh6HKXZjFYl5C2+Gj0f0rkw+XTUZzrd9odDsgI9G5tRUcF4wSbKaX04T0DQ==}
    engines: {node: '>=10'}
    requiresBuild: true
    dependencies:
      node-addon-api: 5.1.0
      prebuild-install: 7.1.2
    dev: false

  /fast-deep-equal@3.1.3:
    resolution: {integrity: sha512-f3qQ9oQy9j2AhBe/H9VC91wLmKBCCU/gDOnKNAYG5hswO7BLKj09Hc5HYNz9cGI++xlpDCIgDaitVs03ATR84Q==}
    dev: false

  /fast-xml-parser@4.3.6:
    resolution: {integrity: sha512-M2SovcRxD4+vC493Uc2GZVcZaj66CCJhWurC4viynVSTvrpErCShNcDz1lAho6n9REQKvL/ll4A4/fw6Y9z8nw==}
    hasBin: true
    requiresBuild: true
    dependencies:
      strnum: 1.0.5
    dev: false
    optional: true

  /faye-websocket@0.11.4:
    resolution: {integrity: sha512-CzbClwlXAuiRQAlUyfqPgvPoNKTckTPGfwZV4ZdAhVcP2lh9KUxJg2b5GkE7XbjKQ3YJnQ9z6D9ntLAlB+tP8g==}
    engines: {node: '>=0.8.0'}
    dependencies:
      websocket-driver: 0.7.4
    dev: false

  /finalhandler@1.2.0:
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

  /find-up@4.1.0:
    resolution: {integrity: sha512-PpOwAdQ/YlXQ2vj8a3h8IipDuYRi3wceVQQGYWxNINccq40Anw7BlsEXCMbt1Zt+OLA6Fq9suIpIWD0OsnISlw==}
    engines: {node: '>=8'}
    dependencies:
      locate-path: 5.0.0
      path-exists: 4.0.0
    dev: false

  /firebase-admin@12.1.0:
    resolution: {integrity: sha512-bU7uPKMmIXAihWxntpY/Ma9zucn5y3ec+HQPqFQ/zcEfP9Avk9E/6D8u+yT/VwKHNZyg7yDVWOoJi73TIdR4Ww==}
    engines: {node: '>=14'}
    dependencies:
      '@fastify/busboy': 2.1.1
      '@firebase/database-compat': 1.0.5
      '@firebase/database-types': 1.0.3
      '@types/node': 20.12.12
      farmhash: 3.3.1
      jsonwebtoken: 9.0.2
      jwks-rsa: 3.1.0
      long: 5.2.3
      node-forge: 1.3.1
      uuid: 9.0.1
    optionalDependencies:
      '@google-cloud/firestore': 7.7.0
      '@google-cloud/storage': 7.11.0
    transitivePeerDependencies:
      - encoding
      - supports-color
    dev: false

  /firebase-functions@5.0.1(firebase-admin@12.1.0):
    resolution: {integrity: sha512-1m+crtgAR8Tl36gjpM02KCY5zduAejFmDSXvih/DB93apg39f0U/WwRgT7sitGIRqyCcIpktNUbXJv7Y9JOF4A==}
    engines: {node: '>=14.10.0'}
    hasBin: true
    peerDependencies:
      firebase-admin: ^11.10.0 || ^12.0.0
    dependencies:
      '@types/cors': 2.8.17
      '@types/express': 4.17.3
      cors: 2.8.5
      express: 4.19.2
      firebase-admin: 12.1.0
      protobufjs: 7.3.0
    transitivePeerDependencies:
      - supports-color
    dev: false

  /for-each@0.3.3:
    resolution: {integrity: sha512-jqYfLp7mo9vIyQf8ykW2v7A+2N4QjeCeI5+Dz9XraiO1ign81wjiH7Fb9vSOWvQfNtmSa4H2RoQTrrXivdUZmw==}
    dependencies:
      is-callable: 1.2.7
    dev: false

  /form-data@2.5.1:
    resolution: {integrity: sha512-m21N3WOmEEURgk6B9GLOE4RuWOFf28Lhh9qGYeNlGq4VDXUlJy2th2slBNU8Gp8EzloYZOibZJ7t5ecIrFSjVA==}
    engines: {node: '>= 0.12'}
    requiresBuild: true
    dependencies:
      asynckit: 0.4.0
      combined-stream: 1.0.8
      mime-types: 2.1.35
    dev: false
    optional: true

  /forwarded@0.2.0:
    resolution: {integrity: sha512-buRG0fpBtRHSTCOASe6hD258tEubFoRLb4ZNA6NxMVHNw2gOcwHo9wyablzMzOA5z9xA9L1KNjk/Nt6MT9aYow==}
    engines: {node: '>= 0.6'}
    dev: false

  /fresh@0.5.2:
    resolution: {integrity: sha512-zJ2mQYM18rEFOudeV4GShTGIQ7RbzA7ozbU9I/XBpm7kqgMywgmylMwXHxZJmkVoYkna9d2pVXVXPdYTP9ej8Q==}
    engines: {node: '>= 0.6'}
    dev: false

  /fs-constants@1.0.0:
    resolution: {integrity: sha512-y6OAwoSIf7FyjMIv94u+b5rdheZEjzR63GTyZJm5qh4Bi+2YgwLCcI/fPFZkL5PSixOt6ZNKm+w+Hfp/Bciwow==}
    dev: false

  /function-bind@1.1.2:
    resolution: {integrity: sha512-7XHNxH7qX9xG5mIwxkhumTox/MIRNcOgDrxWsMt2pAr23WHp6MrRlN7FBSFpCpr+oVO0F744iUgR82nJMfG2SA==}
    dev: false

  /functional-red-black-tree@1.0.1:
    resolution: {integrity: sha512-dsKNQNdj6xA3T+QlADDA7mOSlX0qiMINjn0cgr+eGHGsbSHzTabcIogz2+p/iqP1Xs6EP/sS2SbqH+brGTbq0g==}
    requiresBuild: true
    dev: false
    optional: true

  /gaxios@6.6.0:
    resolution: {integrity: sha512-bpOZVQV5gthH/jVCSuYuokRo2bTKOcuBiVWpjmTn6C5Agl5zclGfTljuGsQZxwwDBkli+YhZhP4TdlqTnhOezQ==}
    engines: {node: '>=14'}
    dependencies:
      extend: 3.0.2
      https-proxy-agent: 7.0.4
      is-stream: 2.0.1
      node-fetch: 2.7.0
      uuid: 9.0.1
    transitivePeerDependencies:
      - encoding
      - supports-color
    dev: false

  /gcp-metadata@6.1.0:
    resolution: {integrity: sha512-Jh/AIwwgaxan+7ZUUmRLCjtchyDiqh4KjBJ5tW3plBZb5iL/BPcso8A5DlzeD9qlw0duCamnNdpFjxwaT0KyKg==}
    engines: {node: '>=14'}
    dependencies:
      gaxios: 6.6.0
      json-bigint: 1.0.0
    transitivePeerDependencies:
      - encoding
      - supports-color
    dev: false

  /get-caller-file@2.0.5:
    resolution: {integrity: sha512-DyFP3BM/3YHTQOCUL/w0OZHR0lpKeGrxotcHWcqNEdnltqFwXVfhEBQ94eIo34AfQpo0rGki4cyIiftY06h2Fg==}
    engines: {node: 6.* || 8.* || >= 10.*}
    dev: false

  /get-intrinsic@1.2.4:
    resolution: {integrity: sha512-5uYhsJH8VJBTv7oslg4BznJYhDoRI6waYCxMmCdnTrcCrHA/fCFKoTFz2JKKE0HdDFUF7/oQuhzumXJK7paBRQ==}
    engines: {node: '>= 0.4'}
    dependencies:
      es-errors: 1.3.0
      function-bind: 1.1.2
      has-proto: 1.0.3
      has-symbols: 1.0.3
      hasown: 2.0.2
    dev: false

  /github-from-package@0.0.0:
    resolution: {integrity: sha512-SyHy3T1v2NUXn29OsWdxmK6RwHD+vkj3v8en8AOBZ1wBQ/hCAQ5bAQTD02kW4W9tUp/3Qh6J8r9EvntiyCmOOw==}
    dev: false

  /google-auth-library@9.10.0:
    resolution: {integrity: sha512-ol+oSa5NbcGdDqA+gZ3G3mev59OHBZksBTxY/tYwjtcp1H/scAFwJfSQU9/1RALoyZ7FslNbke8j4i3ipwlyuQ==}
    engines: {node: '>=14'}
    dependencies:
      base64-js: 1.5.1
      ecdsa-sig-formatter: 1.0.11
      gaxios: 6.6.0
      gcp-metadata: 6.1.0
      gtoken: 7.1.0
      jws: 4.0.0
    transitivePeerDependencies:
      - encoding
      - supports-color
    dev: false

  /google-gax@4.3.3:
    resolution: {integrity: sha512-f4F2Y9X4+mqsrJuLZsuTljYuQpcBnQsCt9ScvZpdM8jGjqrcxyJi5JUiqtq0jtpdHVPzyit0N7f5t07e+kH5EA==}
    engines: {node: '>=14'}
    requiresBuild: true
    dependencies:
      '@grpc/grpc-js': 1.10.8
      '@grpc/proto-loader': 0.7.13
      '@types/long': 4.0.2
      abort-controller: 3.0.0
      duplexify: 4.1.3
      google-auth-library: 9.10.0
      node-fetch: 2.7.0
      object-hash: 3.0.0
      proto3-json-serializer: 2.0.1
      protobufjs: 7.2.6
      retry-request: 7.0.2
      uuid: 9.0.1
    transitivePeerDependencies:
      - encoding
      - supports-color
    dev: false
    optional: true

  /googleapis-common@7.2.0:
    resolution: {integrity: sha512-/fhDZEJZvOV3X5jmD+fKxMqma5q2Q9nZNSF3kn1F18tpxmA86BcTxAGBQdM0N89Z3bEaIs+HVznSmFJEAmMTjA==}
    engines: {node: '>=14.0.0'}
    dependencies:
      extend: 3.0.2
      gaxios: 6.6.0
      google-auth-library: 9.10.0
      qs: 6.12.1
      url-template: 2.0.8
      uuid: 9.0.1
    transitivePeerDependencies:
      - encoding
      - supports-color
    dev: false

  /googleapis@137.1.0:
    resolution: {integrity: sha512-2L7SzN0FLHyQtFmyIxrcXhgust77067pkkduqkbIpDuj9JzVnByxsRrcRfUMFQam3rQkWW2B0f1i40IwKDWIVQ==}
    engines: {node: '>=14.0.0'}
    dependencies:
      google-auth-library: 9.10.0
      googleapis-common: 7.2.0
    transitivePeerDependencies:
      - encoding
      - supports-color
    dev: false

  /gopd@1.0.1:
    resolution: {integrity: sha512-d65bNlIadxvpb/A2abVdlqKqV563juRnZ1Wtk6s1sIR8uNsXR70xqIzVqxVf1eTqDunwT2MkczEeaezCKTZhwA==}
    dependencies:
      get-intrinsic: 1.2.4
    dev: false

  /gtoken@7.1.0:
    resolution: {integrity: sha512-pCcEwRi+TKpMlxAQObHDQ56KawURgyAf6jtIY046fJ5tIv3zDe/LEIubckAO8fj6JnAxLdmWkUfNyulQ2iKdEw==}
    engines: {node: '>=14.0.0'}
    dependencies:
      gaxios: 6.6.0
      jws: 4.0.0
    transitivePeerDependencies:
      - encoding
      - supports-color
    dev: false

  /has-flag@3.0.0:
    resolution: {integrity: sha512-sKJf1+ceQBr4SMkvQnBDNDtf4TXpVhVGateu0t918bl30FnbE2m4vNLX+VWe/dpjlb+HugGYzW7uQXH98HPEYw==}
    engines: {node: '>=4'}
    dev: false

  /has-property-descriptors@1.0.2:
    resolution: {integrity: sha512-55JNKuIW+vq4Ke1BjOTjM2YctQIvCT7GFzHwmfZPGo5wnrgkid0YQtnAleFSqumZm4az3n2BS+erby5ipJdgrg==}
    dependencies:
      es-define-property: 1.0.0
    dev: false

  /has-proto@1.0.3:
    resolution: {integrity: sha512-SJ1amZAJUiZS+PhsVLf5tGydlaVB8EdFpaSO4gmiUKUOxk8qzn5AIy4ZeJUmh22znIdk/uMAUT2pl3FxzVUH+Q==}
    engines: {node: '>= 0.4'}
    dev: false

  /has-symbols@1.0.3:
    resolution: {integrity: sha512-l3LCuF6MgDNwTDKkdYGEihYjt5pRPbEg46rtlmnSPlUbgmB8LOIrKJbYYFBSbnPaJexMKtiPO8hmeRjRz2Td+A==}
    engines: {node: '>= 0.4'}
    dev: false

  /has-tostringtag@1.0.2:
    resolution: {integrity: sha512-NqADB8VjPFLM2V0VvHUewwwsw0ZWBaIdgo+ieHtK3hasLz4qeCRjYcqfB6AQrBggRKppKF8L52/VqdVsO47Dlw==}
    engines: {node: '>= 0.4'}
    dependencies:
      has-symbols: 1.0.3
    dev: false

  /hasown@2.0.2:
    resolution: {integrity: sha512-0hJU9SCPvmMzIBdZFqNPXWa6dqh7WdH0cII9y+CyS8rG3nL48Bclra9HmKhVVUHyPWNH5Y7xDwAB7bfgSjkUMQ==}
    engines: {node: '>= 0.4'}
    dependencies:
      function-bind: 1.1.2
    dev: false

  /hosted-git-info@2.8.9:
    resolution: {integrity: sha512-mxIDAb9Lsm6DoOJ7xH+5+X4y1LU/4Hi50L9C5sIswK3JzULS4bwk1FvjdBgvYR4bzT4tuUQiC15FE2f5HbLvYw==}
    dev: false

  /html-entities@2.5.2:
    resolution: {integrity: sha512-K//PSRMQk4FZ78Kyau+mZurHn3FH0Vwr+H36eE0rPbeYkRRi9YxceYPhuN60UwWorxyKHhqoAJl2OFKa4BVtaA==}
    dev: false

  /http-errors@2.0.0:
    resolution: {integrity: sha512-FtwrG/euBzaEjYeRqOgly7G0qviiXoJWnvEH2Z1plBdXgbyjv34pHTSb9zoeHMyDy33+DWy5Wt9Wo+TURtOYSQ==}
    engines: {node: '>= 0.8'}
    dependencies:
      depd: 2.0.0
      inherits: 2.0.4
      setprototypeof: 1.2.0
      statuses: 2.0.1
      toidentifier: 1.0.1
    dev: false

  /http-parser-js@0.5.8:
    resolution: {integrity: sha512-SGeBX54F94Wgu5RH3X5jsDtf4eHyRogWX1XGT3b4HuW3tQPM4AaBzoUji/4AAJNXCEOWZ5O0DgZmJw1947gD5Q==}
    dev: false

  /http-proxy-agent@5.0.0:
    resolution: {integrity: sha512-n2hY8YdoRE1i7r6M0w9DIw5GgZN0G25P8zLCRQ8rjXtTU3vsNFBI/vWK/UIeE6g5MUUz6avwAPXmL6Fy9D/90w==}
    engines: {node: '>= 6'}
    dependencies:
      '@tootallnate/once': 2.0.0
      agent-base: 6.0.2
      debug: 4.3.4
    transitivePeerDependencies:
      - supports-color
    dev: false

  /https-proxy-agent@5.0.1:
    resolution: {integrity: sha512-dFcAjpTQFgoLMzC2VwU+C/CbS7uRL0lWmxDITmqm7C+7F0Odmj6s9l6alZc6AELXhrnggM2CeWSXHGOdX2YtwA==}
    engines: {node: '>= 6'}
    dependencies:
      agent-base: 6.0.2
      debug: 4.3.4
    transitivePeerDependencies:
      - supports-color
    dev: false

  /https-proxy-agent@7.0.4:
    resolution: {integrity: sha512-wlwpilI7YdjSkWaQ/7omYBMTliDcmCN8OLihO6I9B86g06lMyAoqgoDpV0XqoaPOKj+0DIdAvnsWfyAAhmimcg==}
    engines: {node: '>= 14'}
    dependencies:
      agent-base: 7.1.1
      debug: 4.3.4
    transitivePeerDependencies:
      - supports-color
    dev: false

  /iconv-lite@0.4.24:
    resolution: {integrity: sha512-v3MXnZAcvnywkTUEZomIActle7RXXeedOR31wwl7VlyoXO4Qi9arvSenNQWne1TcRwhCL1HwLI21bEqdpj8/rA==}
    engines: {node: '>=0.10.0'}
    dependencies:
      safer-buffer: 2.1.2
    dev: false

  /ieee754@1.2.1:
    resolution: {integrity: sha512-dcyqhDvX1C46lXZcVqCpK+FtMRQVdIMN6/Df5js2zouUsqG7I6sFxitIC+7KYK29KdXOLHdu9zL4sFnoVQnqaA==}
    dev: false

  /inherits@2.0.4:
    resolution: {integrity: sha512-k/vGaX4/Yla3WzyMCvTQOXYeIHvqOKtnqBduzTHpzpQZzAskKMhZ2K+EnBiSM9zGSoIFeMpXKxa4dYeZIQqewQ==}
    dev: false

  /ini@1.3.8:
    resolution: {integrity: sha512-JV/yugV2uzW5iMRSiZAyDtQd+nxtUnjeLt0acNdw98kKLrvuRVyB80tsREOE7yvGVgalhZ6RNXCmEHkUKBKxew==}
    dev: false

  /ipaddr.js@1.9.1:
    resolution: {integrity: sha512-0KI/607xoxSToH7GjN1FfSbLoU0+btTicjsQSWQlh/hZykN8KpmMf7uYwPW3R+akZ6R/w18ZlXSHBYXiYUPO3g==}
    engines: {node: '>= 0.10'}
    dev: false

  /is-arguments@1.1.1:
    resolution: {integrity: sha512-8Q7EARjzEnKpt/PCD7e1cgUS0a6X8u5tdSiMqXhojOdoV9TsMsiO+9VLC5vAmO8N7/GmXn7yjR8qnA6bVAEzfA==}
    engines: {node: '>= 0.4'}
    dependencies:
      call-bind: 1.0.7
      has-tostringtag: 1.0.2
    dev: false

  /is-arrayish@0.2.1:
    resolution: {integrity: sha512-zz06S8t0ozoDXMG+ube26zeCTNXcKIPJZJi8hBrF4idCLms4CG9QtK7qBl1boi5ODzFpjswb5JPmHCbMpjaYzg==}
    dev: false

  /is-callable@1.2.7:
    resolution: {integrity: sha512-1BC0BVFhS/p0qtw6enp8e+8OD0UrK0oFLztSjNzhcKA3WDuJxxAPXzPuPtKkjEY9UUoEWlX/8fgKeu2S8i9JTA==}
    engines: {node: '>= 0.4'}
    dev: false

  /is-core-module@2.13.1:
    resolution: {integrity: sha512-hHrIjvZsftOsvKSn2TRYl63zvxsgE0K+0mYMoH6gD4omR5IWB2KynivBQczo3+wF1cCkjzvptnI9Q0sPU66ilw==}
    dependencies:
      hasown: 2.0.2
    dev: false

  /is-fullwidth-code-point@3.0.0:
    resolution: {integrity: sha512-zymm5+u+sCsSWyD9qNaejV3DFvhCKclKdizYaJUuHA83RLjb7nSuGnddCHGv0hk+KY7BMAlsWeK4Ueg6EV6XQg==}
    engines: {node: '>=8'}
    dev: false

  /is-generator-function@1.0.10:
    resolution: {integrity: sha512-jsEjy9l3yiXEQ+PsXdmBwEPcOxaXWLspKdplFUVI9vq1iZgIekeC0L167qeu86czQaxed3q/Uzuw0swL0irL8A==}
    engines: {node: '>= 0.4'}
    dependencies:
      has-tostringtag: 1.0.2
    dev: false

  /is-stream@2.0.1:
    resolution: {integrity: sha512-hFoiJiTl63nn+kstHGBtewWSKnQLpyb155KHheA1l39uvtO9nWIop1p3udqPcUd/xbF1VLMO4n7OI6p7RbngDg==}
    engines: {node: '>=8'}
    dev: false

  /is-typed-array@1.1.13:
    resolution: {integrity: sha512-uZ25/bUAlUY5fR4OKT4rZQEBrzQWYV9ZJYGGsUmEJ6thodVJ1HX64ePQ6Z0qPWP+m+Uq6e9UugrE38jeYsDSMw==}
    engines: {node: '>= 0.4'}
    dependencies:
      which-typed-array: 1.1.15
    dev: false

  /jose@4.15.5:
    resolution: {integrity: sha512-jc7BFxgKPKi94uOvEmzlSWFFe2+vASyXaKUpdQKatWAESU2MWjDfFf0fdfc83CDKcA5QecabZeNLyfhe3yKNkg==}
    dev: false

  /js-tokens@4.0.0:
    resolution: {integrity: sha512-RdJUflcE3cUzKiMqQgsCu06FPu9UdIJO0beYbPhHN4k6apgJtifcoCtT9bcxOpYBtpD2kCM6Sbzg4CausW/PKQ==}
    dev: false

  /json-bigint@1.0.0:
    resolution: {integrity: sha512-SiPv/8VpZuWbvLSMtTDU8hEfrZWg/mH/nV/b4o0CYbSxu1UIQPLdwKOCIyLQX+VIPO5vrLX3i8qtqFyhdPSUSQ==}
    dependencies:
      bignumber.js: 9.1.2
    dev: false

  /json-parse-even-better-errors@2.3.1:
    resolution: {integrity: sha512-xyFwyhro/JEof6Ghe2iz2NcXoj2sloNsWr/XsERDK/oiPCfaNhl5ONfp+jQdAZRQQ0IJWNzH9zIZF7li91kh2w==}
    dev: false

  /json-schema-traverse@1.0.0:
    resolution: {integrity: sha512-NM8/P9n3XjXhIZn1lLhkFaACTOURQXjWhV4BA/RnOv8xvgqtqpAX9IO4mRQxSx1Rlo4tqzeqb0sOlruaOy3dug==}
    dev: false

  /jsonwebtoken@9.0.2:
    resolution: {integrity: sha512-PRp66vJ865SSqOlgqS8hujT5U4AOgMfhrwYIuIhfKaoSCZcirrmASQr8CX7cUg+RMih+hgznrjp99o+W4pJLHQ==}
    engines: {node: '>=12', npm: '>=6'}
    dependencies:
      jws: 3.2.2
      lodash.includes: 4.3.0
      lodash.isboolean: 3.0.3
      lodash.isinteger: 4.0.4
      lodash.isnumber: 3.0.3
      lodash.isplainobject: 4.0.6
      lodash.isstring: 4.0.1
      lodash.once: 4.1.1
      ms: 2.1.3
      semver: 7.6.2
    dev: false

  /jwa@1.4.1:
    resolution: {integrity: sha512-qiLX/xhEEFKUAJ6FiBMbes3w9ATzyk5W7Hvzpa/SLYdxNtng+gcurvrI7TbACjIXlsJyr05/S1oUhZrc63evQA==}
    dependencies:
      buffer-equal-constant-time: 1.0.1
      ecdsa-sig-formatter: 1.0.11
      safe-buffer: 5.2.1
    dev: false

  /jwa@2.0.0:
    resolution: {integrity: sha512-jrZ2Qx916EA+fq9cEAeCROWPTfCwi1IVHqT2tapuqLEVVDKFDENFw1oL+MwrTvH6msKxsd1YTDVw6uKEcsrLEA==}
    dependencies:
      buffer-equal-constant-time: 1.0.1
      ecdsa-sig-formatter: 1.0.11
      safe-buffer: 5.2.1
    dev: false

  /jwks-rsa@3.1.0:
    resolution: {integrity: sha512-v7nqlfezb9YfHHzYII3ef2a2j1XnGeSE/bK3WfumaYCqONAIstJbrEGapz4kadScZzEt7zYCN7bucj8C0Mv/Rg==}
    engines: {node: '>=14'}
    dependencies:
      '@types/express': 4.17.21
      '@types/jsonwebtoken': 9.0.6
      debug: 4.3.4
      jose: 4.15.5
      limiter: 1.1.5
      lru-memoizer: 2.3.0
    transitivePeerDependencies:
      - supports-color
    dev: false

  /jws@3.2.2:
    resolution: {integrity: sha512-YHlZCB6lMTllWDtSPHz/ZXTsi8S00usEV6v1tjq8tOUZzw7DpSDWVXjXDre6ed1w/pd495ODpHZYSdkRTsa0HA==}
    dependencies:
      jwa: 1.4.1
      safe-buffer: 5.2.1
    dev: false

  /jws@4.0.0:
    resolution: {integrity: sha512-KDncfTmOZoOMTFG4mBlG0qUIOlc03fmzH+ru6RgYVZhPkyiy/92Owlt/8UEN+a4TXR1FQetfIpJE8ApdvdVxTg==}
    dependencies:
      jwa: 2.0.0
      safe-buffer: 5.2.1
    dev: false

  /limiter@1.1.5:
    resolution: {integrity: sha512-FWWMIEOxz3GwUI4Ts/IvgVy6LPvoMPgjMdQ185nN6psJyBJ4yOpzqm695/h5umdLJg2vW3GR5iG11MAkR2AzJA==}
    dev: false

  /lines-and-columns@1.2.4:
    resolution: {integrity: sha512-7ylylesZQ/PV29jhEDl3Ufjo6ZX7gCqJr5F7PKrqc93v7fzSymt1BpwEU8nAUXs8qzzvqhbjhK5QZg6Mt/HkBg==}
    dev: false

  /locate-path@5.0.0:
    resolution: {integrity: sha512-t7hw9pI+WvuwNJXwk5zVHpyhIqzg2qTlklJOf0mVxGSbe3Fp2VieZcduNYjaLDoy6p9uGpQEGWG87WpMKlNq8g==}
    engines: {node: '>=8'}
    dependencies:
      p-locate: 4.1.0
    dev: false

  /lodash.camelcase@4.3.0:
    resolution: {integrity: sha512-TwuEnCnxbc3rAvhf/LbG7tJUDzhqXyFnv3dtzLOPgCG/hODL7WFnsbwktkD7yUV0RrreP/l1PALq/YSg6VvjlA==}
    dev: false

  /lodash.clonedeep@4.5.0:
    resolution: {integrity: sha512-H5ZhCF25riFd9uB5UCkVKo61m3S/xZk1x4wA6yp/L3RFP6Z/eHH1ymQcGLo7J3GMPfm0V/7m1tryHuGVxpqEBQ==}
    dev: false

  /lodash.includes@4.3.0:
    resolution: {integrity: sha512-W3Bx6mdkRTGtlJISOvVD/lbqjTlPPUDTMnlXZFnVwi9NKJ6tiAk6LVdlhZMm17VZisqhKcgzpO5Wz91PCt5b0w==}
    dev: false

  /lodash.isboolean@3.0.3:
    resolution: {integrity: sha512-Bz5mupy2SVbPHURB98VAcw+aHh4vRV5IPNhILUCsOzRmsTmSQ17jIuqopAentWoehktxGd9e/hbIXq980/1QJg==}
    dev: false

  /lodash.isinteger@4.0.4:
    resolution: {integrity: sha512-DBwtEWN2caHQ9/imiNeEA5ys1JoRtRfY3d7V9wkqtbycnAmTvRRmbHKDV4a0EYc678/dia0jrte4tjYwVBaZUA==}
    dev: false

  /lodash.isnumber@3.0.3:
    resolution: {integrity: sha512-QYqzpfwO3/CWf3XP+Z+tkQsfaLL/EnUlXWVkIk5FUPc4sBdTehEqZONuyRt2P67PXAk+NXmTBcc97zw9t1FQrw==}
    dev: false

  /lodash.isplainobject@4.0.6:
    resolution: {integrity: sha512-oSXzaWypCMHkPC3NvBEaPHf0KsA5mvPrOPgQWDsbg8n7orZ290M0BmC/jgRZ4vcJ6DTAhjrsSYgdsW/F+MFOBA==}
    dev: false

  /lodash.isstring@4.0.1:
    resolution: {integrity: sha512-0wJxfxH1wgO3GrbuP+dTTk7op+6L41QCXbGINEmD+ny/G/eCqGzxyCsh7159S+mgDDcoarnBw6PC1PS5+wUGgw==}
    dev: false

  /lodash.once@4.1.1:
    resolution: {integrity: sha512-Sb487aTOCr9drQVL8pIxOzVhafOjZN9UU54hiN8PU3uAiSV7lx1yYNpbNmex2PK6dSJoNTSJUUswT651yww3Mg==}
    dev: false

  /long@5.2.3:
    resolution: {integrity: sha512-lcHwpNoggQTObv5apGNCTdJrO69eHOZMi4BNC+rTLER8iHAqGrUVeLh/irVIM7zTw2bOXA8T6uNPeujwOLg/2Q==}
    dev: false

  /lru-cache@10.2.2:
    resolution: {integrity: sha512-9hp3Vp2/hFQUiIwKo8XCeFVnrg8Pk3TYNPIR7tJADKi5YfcF7vEaK7avFHTlSy3kOKYaJQaalfEo6YuXdceBOQ==}
    engines: {node: 14 || >=16.14}
    dev: false

  /lru-cache@6.0.0:
    resolution: {integrity: sha512-Jo6dJ04CmSjuznwJSS3pUeWmd/H0ffTlkXXgwZi+eq1UCmqQwCh+eLsYOYCwY991i2Fah4h1BEMCx4qThGbsiA==}
    engines: {node: '>=10'}
    dependencies:
      yallist: 4.0.0
    dev: false

  /lru-memoizer@2.3.0:
    resolution: {integrity: sha512-GXn7gyHAMhO13WSKrIiNfztwxodVsP8IoZ3XfrJV4yH2x0/OeTO/FIaAHTY5YekdGgW94njfuKmyyt1E0mR6Ug==}
    dependencies:
      lodash.clonedeep: 4.5.0
      lru-cache: 6.0.0
    dev: false

  /media-typer@0.3.0:
    resolution: {integrity: sha512-dq+qelQ9akHpcOl/gUVRTxVIOkAJ1wR3QAvb4RsVjS8oVoFjDGTc679wJYmUmknUF5HwMLOgb5O+a3KxfWapPQ==}
    engines: {node: '>= 0.6'}
    dev: false

  /merge-descriptors@1.0.1:
    resolution: {integrity: sha512-cCi6g3/Zr1iqQi6ySbseM1Xvooa98N0w31jzUYrXPX2xqObmFGHJ0tQ5u74H3mVh7wLouTseZyYIq39g8cNp1w==}
    dev: false

  /methods@1.1.2:
    resolution: {integrity: sha512-iclAHeNqNm68zFtnZ0e+1L2yUIdvzNoauKU4WBA3VvH/vPFieF7qfRlwUZU+DA9P9bPXIS90ulxoUoCH23sV2w==}
    engines: {node: '>= 0.6'}
    dev: false

  /mime-db@1.52.0:
    resolution: {integrity: sha512-sPU4uV7dYlvtWJxwwxHD0PuihVNiE7TyAbQ5SWxDCB9mUYvOgroQOwYQQOKPJ8CIbE+1ETVlOoK1UC2nU3gYvg==}
    engines: {node: '>= 0.6'}
    dev: false

  /mime-types@2.1.35:
    resolution: {integrity: sha512-ZDY+bPm5zTTF+YpCrAU9nK0UgICYPT0QtT1NZWFv4s++TNkcgVaT0g6+4R2uI4MjQjzysHB1zxuWL50hzaeXiw==}
    engines: {node: '>= 0.6'}
    dependencies:
      mime-db: 1.52.0
    dev: false

  /mime@1.6.0:
    resolution: {integrity: sha512-x0Vn8spI+wuJ1O6S7gnbaQg8Pxh4NNHb7KSINmEWKiPE4RKOplvijn+NkmYmmRgP68mc70j2EbeTFRsrswaQeg==}
    engines: {node: '>=4'}
    hasBin: true
    dev: false

  /mime@3.0.0:
    resolution: {integrity: sha512-jSCU7/VB1loIWBZe14aEYHU/+1UMEHoaO7qxCOVJOw9GgH72VAWppxNcjU+x9a2k3GSIBXNKxXQFqRvvZ7vr3A==}
    engines: {node: '>=10.0.0'}
    hasBin: true
    requiresBuild: true
    dev: false
    optional: true

  /mimic-response@3.1.0:
    resolution: {integrity: sha512-z0yWI+4FDrrweS8Zmt4Ej5HdJmky15+L2e6Wgn3+iK5fWzb6T3fhNFq2+MeTRb064c6Wr4N/wv0DzQTjNzHNGQ==}
    engines: {node: '>=10'}
    dev: false

  /minimist@1.2.8:
    resolution: {integrity: sha512-2yyAR8qBkN3YuheJanUpWC5U3bb5osDywNB8RzDVlDwDHbocAJveqqj1u8+SVD7jkWT4yvsHCpWqqWqAxb0zCA==}
    dev: false

  /mkdirp-classic@0.5.3:
    resolution: {integrity: sha512-gKLcREMhtuZRwRAfqP3RFW+TK4JqApVBtOIftVgjuABpAtpxhPGaDcfvbhNvD0B8iD1oUr/txX35NjcaY6Ns/A==}
    dev: false

  /ms@2.0.0:
    resolution: {integrity: sha512-Tpp60P6IUJDTuOq/5Z8cdskzJujfwqfOTkrwIwj7IRISpnkJnT6SyJ4PCPnGMoFjC9ddhal5KVIYtAt97ix05A==}
    dev: false

  /ms@2.1.2:
    resolution: {integrity: sha512-sGkPx+VjMtmA6MX27oA4FBFELFCZZ4S4XqeGOXCv68tT+jb3vk/RyaKWP0PTKyWtmLSM0b+adUTEvbs1PEaH2w==}
    dev: false

  /ms@2.1.3:
    resolution: {integrity: sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==}
    dev: false

  /napi-build-utils@1.0.2:
    resolution: {integrity: sha512-ONmRUqK7zj7DWX0D9ADe03wbwOBZxNAfF20PlGfCWQcD3+/MakShIHrMqx9YwPTfxDdF1zLeL+RGZiR9kGMLdg==}
    dev: false

  /negotiator@0.6.3:
    resolution: {integrity: sha512-+EUsqGPLsM+j/zdChZjsnX51g4XrHFOIXwfnCVPGlQk/k5giakcKsuxCObBRu6DSm9opw/O6slWbJdghQM4bBg==}
    engines: {node: '>= 0.6'}
    dev: false

  /node-abi@3.62.0:
    resolution: {integrity: sha512-CPMcGa+y33xuL1E0TcNIu4YyaZCxnnvkVaEXrsosR3FxN+fV8xvb7Mzpb7IgKler10qeMkE6+Dp8qJhpzdq35g==}
    engines: {node: '>=10'}
    dependencies:
      semver: 7.6.2
    dev: false

  /node-addon-api@5.1.0:
    resolution: {integrity: sha512-eh0GgfEkpnoWDq+VY8OyvYhFEzBk6jIYbRKdIlyTiAXIVJ8PyBaKb0rp7oDtoddbdoHWhq8wwr+XZ81F1rpNdA==}
    dev: false

  /node-fetch@2.7.0:
    resolution: {integrity: sha512-c4FRfUm/dbcWZ7U+1Wq0AwCyFL+3nt2bEw05wfxSz+DWpWsitgmSgYmy2dQdWyKC1694ELPqMs/YzUSNozLt8A==}
    engines: {node: 4.x || >=6.0.0}
    peerDependencies:
      encoding: ^0.1.0
    peerDependenciesMeta:
      encoding:
        optional: true
    dependencies:
      whatwg-url: 5.0.0
    dev: false

  /node-forge@1.3.1:
    resolution: {integrity: sha512-dPEtOeMvF9VMcYV/1Wb8CPoVAXtp6MKMlcbAt4ddqmGqUJ6fQZFXkNZNkNlfevtNkGtaSoXf/vNNNSvgrdXwtA==}
    engines: {node: '>= 6.13.0'}
    dev: false

  /normalize-package-data@2.5.0:
    resolution: {integrity: sha512-/5CMN3T0R4XTj4DcGaexo+roZSdSFW/0AOOTROrjxzCG1wrWXEsGbRKevjlIL+ZDE4sZlJr5ED4YW0yqmkK+eA==}
    dependencies:
      hosted-git-info: 2.8.9
      resolve: 1.22.8
      semver: 5.7.2
      validate-npm-package-license: 3.0.4
    dev: false

  /object-assign@4.1.1:
    resolution: {integrity: sha512-rJgTQnkUnH1sFw8yT6VSU3zD3sWmu6sZhIseY8VX+GRu3P6F7Fu+JNDoXfklElbLJSnc3FUQHVe4cU5hj+BcUg==}
    engines: {node: '>=0.10.0'}
    dev: false

  /object-hash@3.0.0:
    resolution: {integrity: sha512-RSn9F68PjH9HqtltsSnqYC1XXoWe9Bju5+213R98cNGttag9q9yAOTzdbsqvIa7aNm5WffBZFpWYr2aWrklWAw==}
    engines: {node: '>= 6'}
    requiresBuild: true
    dev: false
    optional: true

  /object-inspect@1.13.1:
    resolution: {integrity: sha512-5qoj1RUiKOMsCCNLV1CBiPYE10sziTsnmNxkAI/rZhiD63CF7IqdFGC/XzjWjpSgLf0LxXX3bDFIh0E18f6UhQ==}
    dev: false

  /on-finished@2.4.1:
    resolution: {integrity: sha512-oVlzkg3ENAhCk2zdv7IJwd/QUD4z2RxRwpkcGY8psCVcCYZNq4wYnVWALHM+brtuJjePWiYF/ClmuDr8Ch5+kg==}
    engines: {node: '>= 0.8'}
    dependencies:
      ee-first: 1.1.1
    dev: false

  /once@1.4.0:
    resolution: {integrity: sha512-lNaJgI+2Q5URQBkccEKHTQOPaXdUxnZZElQTZY0MFUAuaEqe1E+Nyvgdz/aIyNi6Z9MzO5dv1H8n58/GELp3+w==}
    dependencies:
      wrappy: 1.0.2
    dev: false

  /p-limit@2.3.0:
    resolution: {integrity: sha512-//88mFWSJx8lxCzwdAABTJL2MyWB12+eIY7MDL2SqLmAkeKU9qxRvWuSyTjm3FUmpBEMuFfckAIqEaVGUDxb6w==}
    engines: {node: '>=6'}
    dependencies:
      p-try: 2.2.0
    dev: false

  /p-limit@3.1.0:
    resolution: {integrity: sha512-TYOanM3wGwNGsZN2cVTYPArw454xnXj5qmWF1bEoAc4+cU/ol7GVh7odevjp1FNHduHc3KZMcFduxU5Xc6uJRQ==}
    engines: {node: '>=10'}
    dependencies:
      yocto-queue: 0.1.0
    dev: false

  /p-locate@4.1.0:
    resolution: {integrity: sha512-R79ZZ/0wAxKGu3oYMlz8jy/kbhsNrS7SKZ7PxEHBgJ5+F2mtFW2fK2cOtBh1cHYkQsbzFV7I+EoRKe6Yt0oK7A==}
    engines: {node: '>=8'}
    dependencies:
      p-limit: 2.3.0
    dev: false

  /p-try@2.2.0:
    resolution: {integrity: sha512-R4nPAVTAU0B9D35/Gk3uJf/7XYbQcyohSKdvAxIRSNghFl4e71hVoGnBNQz9cWaXxO2I10KTC+3jMdvvoKw6dQ==}
    engines: {node: '>=6'}
    dev: false

  /parse-json@5.2.0:
    resolution: {integrity: sha512-ayCKvm/phCGxOkYRSCM82iDwct8/EonSEgCSxWxD7ve6jHggsFl4fZVQBPRNgQoKiuV/odhFrGzQXZwbifC8Rg==}
    engines: {node: '>=8'}
    dependencies:
      '@babel/code-frame': 7.24.2
      error-ex: 1.3.2
      json-parse-even-better-errors: 2.3.1
      lines-and-columns: 1.2.4
    dev: false

  /parseurl@1.3.3:
    resolution: {integrity: sha512-CiyeOxFT/JZyN5m0z9PfXw4SCBJ6Sygz1Dpl0wqjlhDEGGBP1GnsUVEL0p63hoG1fcj3fHynXi9NYO4nWOL+qQ==}
    engines: {node: '>= 0.8'}
    dev: false

  /path-exists@4.0.0:
    resolution: {integrity: sha512-ak9Qy5Q7jYb2Wwcey5Fpvg2KoAc/ZIhLSLOSBmRmygPsGwkVVt0fZa0qrtMz+m6tJTAHfZQ8FnmB4MG4LWy7/w==}
    engines: {node: '>=8'}
    dev: false

  /path-parse@1.0.7:
    resolution: {integrity: sha512-LDJzPVEEEPR+y48z93A0Ed0yXb8pAByGWo/k5YYdYgpY2/2EsOsksJrq7lOHxryrVOn1ejG6oAp8ahvOIQD8sw==}
    dev: false

  /path-to-regexp@0.1.7:
    resolution: {integrity: sha512-5DFkuoqlv1uYQKxy8omFBeJPQcdoE07Kv2sferDCrAq1ohOU+MSDswDIbnx3YAM60qIOnYa53wBhXW0EbMonrQ==}
    dev: false

  /picocolors@1.0.1:
    resolution: {integrity: sha512-anP1Z8qwhkbmu7MFP5iTt+wQKXgwzf7zTyGlcdzabySa9vd0Xt392U0rVmz9poOaBj0uHJKyyo9/upk0HrEQew==}
    dev: false

  /possible-typed-array-names@1.0.0:
    resolution: {integrity: sha512-d7Uw+eZoloe0EHDIYoe+bQ5WXnGMOpmiZFTuMWCwpjzzkL2nTjcKiAk4hh8TjnGye2TwWOk3UXucZ+3rbmBa8Q==}
    engines: {node: '>= 0.4'}
    dev: false

  /prebuild-install@7.1.2:
    resolution: {integrity: sha512-UnNke3IQb6sgarcZIDU3gbMeTp/9SSU1DAIkil7PrqG1vZlBtY5msYccSKSHDqa3hNg436IXK+SNImReuA1wEQ==}
    engines: {node: '>=10'}
    hasBin: true
    dependencies:
      detect-libc: 2.0.3
      expand-template: 2.0.3
      github-from-package: 0.0.0
      minimist: 1.2.8
      mkdirp-classic: 0.5.3
      napi-build-utils: 1.0.2
      node-abi: 3.62.0
      pump: 3.0.0
      rc: 1.2.8
      simple-get: 4.0.1
      tar-fs: 2.1.1
      tunnel-agent: 0.6.0
    dev: false

  /process@0.11.10:
    resolution: {integrity: sha512-cdGef/drWFoydD1JsMzuFf8100nZl+GT+yacc2bEced5f9Rjk4z+WtFUTBu9PhOi9j/jfmBPu0mMEY4wIdAF8A==}
    engines: {node: '>= 0.6.0'}
    dev: false

  /proto3-json-serializer@2.0.1:
    resolution: {integrity: sha512-8awBvjO+FwkMd6gNoGFZyqkHZXCFd54CIYTb6De7dPaufGJ2XNW+QUNqbMr8MaAocMdb+KpsD4rxEOaTBDCffA==}
    engines: {node: '>=14.0.0'}
    requiresBuild: true
    dependencies:
      protobufjs: 7.3.0
    dev: false
    optional: true

  /protobufjs@7.2.6:
    resolution: {integrity: sha512-dgJaEDDL6x8ASUZ1YqWciTRrdOuYNzoOf27oHNfdyvKqHr5i0FV7FSLU+aIeFjyFgVxrpTOtQUi0BLLBymZaBw==}
    engines: {node: '>=12.0.0'}
    requiresBuild: true
    dependencies:
      '@protobufjs/aspromise': 1.1.2
      '@protobufjs/base64': 1.1.2
      '@protobufjs/codegen': 2.0.4
      '@protobufjs/eventemitter': 1.1.0
      '@protobufjs/fetch': 1.1.0
      '@protobufjs/float': 1.0.2
      '@protobufjs/inquire': 1.1.0
      '@protobufjs/path': 1.1.2
      '@protobufjs/pool': 1.1.0
      '@protobufjs/utf8': 1.1.0
      '@types/node': 20.12.12
      long: 5.2.3
    dev: false
    optional: true

  /protobufjs@7.3.0:
    resolution: {integrity: sha512-YWD03n3shzV9ImZRX3ccbjqLxj7NokGN0V/ESiBV5xWqrommYHYiihuIyavq03pWSGqlyvYUFmfoMKd+1rPA/g==}
    engines: {node: '>=12.0.0'}
    requiresBuild: true
    dependencies:
      '@protobufjs/aspromise': 1.1.2
      '@protobufjs/base64': 1.1.2
      '@protobufjs/codegen': 2.0.4
      '@protobufjs/eventemitter': 1.1.0
      '@protobufjs/fetch': 1.1.0
      '@protobufjs/float': 1.0.2
      '@protobufjs/inquire': 1.1.0
      '@protobufjs/path': 1.1.2
      '@protobufjs/pool': 1.1.0
      '@protobufjs/utf8': 1.1.0
      '@types/node': 20.12.12
      long: 5.2.3
    dev: false

  /proxy-addr@2.0.7:
    resolution: {integrity: sha512-llQsMLSUDUPT44jdrU/O37qlnifitDP+ZwrmmZcoSKyLKvtZxpyV0n2/bD/N4tBAAZ/gJEdZU7KMraoK1+XYAg==}
    engines: {node: '>= 0.10'}
    dependencies:
      forwarded: 0.2.0
      ipaddr.js: 1.9.1
    dev: false

  /pump@3.0.0:
    resolution: {integrity: sha512-LwZy+p3SFs1Pytd/jYct4wpv49HiYCqd9Rlc5ZVdk0V+8Yzv6jR5Blk3TRmPL1ft69TxP0IMZGJ+WPFU2BFhww==}
    dependencies:
      end-of-stream: 1.4.4
      once: 1.4.0
    dev: false

  /punycode@2.3.1:
    resolution: {integrity: sha512-vYt7UD1U9Wg6138shLtLOvdAu+8DsC/ilFtEVHcH+wydcSpNE20AfSOduf6MkRFahL5FY7X1oU7nKVZFtfq8Fg==}
    engines: {node: '>=6'}
    dev: false

  /qs@6.11.0:
    resolution: {integrity: sha512-MvjoMCJwEarSbUYk5O+nmoSzSutSsTwF85zcHPQ9OrlFoZOYIjaqBAJIqIXjptyD5vThxGq52Xu/MaJzRkIk4Q==}
    engines: {node: '>=0.6'}
    dependencies:
      side-channel: 1.0.6
    dev: false

  /qs@6.12.1:
    resolution: {integrity: sha512-zWmv4RSuB9r2mYQw3zxQuHWeU+42aKi1wWig/j4ele4ygELZ7PEO6MM7rim9oAQH2A5MWfsAVf/jPvTPgCbvUQ==}
    engines: {node: '>=0.6'}
    dependencies:
      side-channel: 1.0.6
    dev: false

  /range-parser@1.2.1:
    resolution: {integrity: sha512-Hrgsx+orqoygnmhFbKaHE6c296J+HTAQXoxEF6gNupROmmGJRoyzfG3ccAveqCBrwr/2yxQ5BVd/GTl5agOwSg==}
    engines: {node: '>= 0.6'}
    dev: false

  /raw-body@2.5.2:
    resolution: {integrity: sha512-8zGqypfENjCIqGhgXToC8aB2r7YrBX+AQAfIPs/Mlk+BtPTztOvTS01NRW/3Eh60J+a48lt8qsCzirQ6loCVfA==}
    engines: {node: '>= 0.8'}
    dependencies:
      bytes: 3.1.2
      http-errors: 2.0.0
      iconv-lite: 0.4.24
      unpipe: 1.0.0
    dev: false

  /rc@1.2.8:
    resolution: {integrity: sha512-y3bGgqKj3QBdxLbLkomlohkvsA8gdAiUQlSBJnBhfn+BPxg4bc62d8TcBW15wavDfgexCgccckhcZvywyQYPOw==}
    hasBin: true
    dependencies:
      deep-extend: 0.6.0
      ini: 1.3.8
      minimist: 1.2.8
      strip-json-comments: 2.0.1
    dev: false

  /read-pkg-up@7.0.1:
    resolution: {integrity: sha512-zK0TB7Xd6JpCLmlLmufqykGE+/TlOePD6qKClNW7hHDKFh/J7/7gCWGR7joEQEW1bKq3a3yUZSObOoWLFQ4ohg==}
    engines: {node: '>=8'}
    dependencies:
      find-up: 4.1.0
      read-pkg: 5.2.0
      type-fest: 0.8.1
    dev: false

  /read-pkg@5.2.0:
    resolution: {integrity: sha512-Ug69mNOpfvKDAc2Q8DRpMjjzdtrnv9HcSMX+4VsZxD1aZ6ZzrIE7rlzXBtWTyhULSMKg076AW6WR5iZpD0JiOg==}
    engines: {node: '>=8'}
    dependencies:
      '@types/normalize-package-data': 2.4.4
      normalize-package-data: 2.5.0
      parse-json: 5.2.0
      type-fest: 0.6.0
    dev: false

  /readable-stream@3.6.2:
    resolution: {integrity: sha512-9u/sniCrY3D5WdsERHzHE4G2YCXqoG5FTHUiCC4SIbr6XcLZBY05ya9EKjYek9O5xOAwjGq+1JdGBAS7Q9ScoA==}
    engines: {node: '>= 6'}
    dependencies:
      inherits: 2.0.4
      string_decoder: 1.3.0
      util-deprecate: 1.0.2
    dev: false

  /regenerator-runtime@0.14.1:
    resolution: {integrity: sha512-dYnhHh0nJoMfnkZs6GmmhFknAGRrLznOu5nc9ML+EJxGvrx6H7teuevqVqCuPcPK//3eDrrjQhehXVx9cnkGdw==}
    dev: false

  /require-directory@2.1.1:
    resolution: {integrity: sha512-fGxEI7+wsG9xrvdjsrlmL22OMTTiHRwAMroiEeMgq8gzoLC/PQr7RsRDSTLUg/bZAZtF+TVIkHc6/4RIKrui+Q==}
    engines: {node: '>=0.10.0'}
    dev: false

  /require-from-string@2.0.2:
    resolution: {integrity: sha512-Xf0nWe6RseziFMu+Ap9biiUbmplq6S9/p+7w7YXP/JBHhrUDDUhwa+vANyubuqfZWTveU//DYVGsDG7RKL/vEw==}
    engines: {node: '>=0.10.0'}
    dev: false

  /resolve@1.22.8:
    resolution: {integrity: sha512-oKWePCxqpd6FlLvGV1VU0x7bkPmmCNolxzjMf4NczoDnQcIWrAF+cPtZn5i6n+RfD2d9i0tzpKnG6Yk168yIyw==}
    hasBin: true
    dependencies:
      is-core-module: 2.13.1
      path-parse: 1.0.7
      supports-preserve-symlinks-flag: 1.0.0
    dev: false

  /retry-request@7.0.2:
    resolution: {integrity: sha512-dUOvLMJ0/JJYEn8NrpOaGNE7X3vpI5XlZS/u0ANjqtcZVKnIxP7IgCFwrKTxENw29emmwug53awKtaMm4i9g5w==}
    engines: {node: '>=14'}
    requiresBuild: true
    dependencies:
      '@types/request': 2.48.12
      extend: 3.0.2
      teeny-request: 9.0.0
    transitivePeerDependencies:
      - encoding
      - supports-color
    dev: false
    optional: true

  /retry@0.13.1:
    resolution: {integrity: sha512-XQBQ3I8W1Cge0Seh+6gjj03LbmRFWuoszgK9ooCpwYIrhhoO80pfq4cUkU5DkknwfOfFteRwlZ56PYOGYyFWdg==}
    engines: {node: '>= 4'}
    dev: false

  /safe-buffer@5.2.1:
    resolution: {integrity: sha512-rp3So07KcdmmKbGvgaNxQSJr7bGVSVk5S9Eq1F+ppbRo70+YeaDxkw5Dd8NPN+GD6bjnYm2VuPuCXmpuYvmCXQ==}
    dev: false

  /safer-buffer@2.1.2:
    resolution: {integrity: sha512-YZo3K82SD7Riyi0E1EQPojLz7kpepnSQI9IyPbHHg1XXXevb5dJI7tpyN2ADxGcQbHG7vcyRHk0cbwqcQriUtg==}
    dev: false

  /semver@5.7.2:
    resolution: {integrity: sha512-cBznnQ9KjJqU67B52RMC65CMarK2600WFnbkcaiwWq3xy/5haFJlshgnpjovMVJ+Hff49d8GEn0b87C5pDQ10g==}
    hasBin: true
    dev: false

  /semver@7.6.2:
    resolution: {integrity: sha512-FNAIBWCx9qcRhoHcgcJ0gvU7SN1lYU2ZXuSfl04bSC5OpvDHFyJCjdNHomPXxjQlCBU67YW64PzY7/VIEH7F2w==}
    engines: {node: '>=10'}
    hasBin: true
    dev: false

  /send@0.18.0:
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

  /serve-static@1.15.0:
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

  /set-function-length@1.2.2:
    resolution: {integrity: sha512-pgRc4hJ4/sNjWCSS9AmnS40x3bNMDTknHgL5UaMBTMyJnU90EgWh1Rz+MC9eFu4BuN/UwZjKQuY/1v3rM7HMfg==}
    engines: {node: '>= 0.4'}
    dependencies:
      define-data-property: 1.1.4
      es-errors: 1.3.0
      function-bind: 1.1.2
      get-intrinsic: 1.2.4
      gopd: 1.0.1
      has-property-descriptors: 1.0.2
    dev: false

  /setprototypeof@1.2.0:
    resolution: {integrity: sha512-E5LDX7Wrp85Kil5bhZv46j8jOeboKq5JMmYM3gVGdGH8xFpPWXUMsNrlODCrkoxMEeNi/XZIwuRvY4XNwYMJpw==}
    dev: false

  /side-channel@1.0.6:
    resolution: {integrity: sha512-fDW/EZ6Q9RiO8eFG8Hj+7u/oW+XrPTIChwCOM2+th2A6OblDtYYIpve9m+KvI9Z4C9qSEXlaGR6bTEYHReuglA==}
    engines: {node: '>= 0.4'}
    dependencies:
      call-bind: 1.0.7
      es-errors: 1.3.0
      get-intrinsic: 1.2.4
      object-inspect: 1.13.1
    dev: false

  /simple-concat@1.0.1:
    resolution: {integrity: sha512-cSFtAPtRhljv69IK0hTVZQ+OfE9nePi/rtJmw5UjHeVyVroEqJXP1sFztKUy1qU+xvz3u/sfYJLa947b7nAN2Q==}
    dev: false

  /simple-get@4.0.1:
    resolution: {integrity: sha512-brv7p5WgH0jmQJr1ZDDfKDOSeWWg+OVypG99A/5vYGPqJ6pxiaHLy8nxtFjBA7oMa01ebA9gfh1uMCFqOuXxvA==}
    dependencies:
      decompress-response: 6.0.0
      once: 1.4.0
      simple-concat: 1.0.1
    dev: false

  /spdx-correct@3.2.0:
    resolution: {integrity: sha512-kN9dJbvnySHULIluDHy32WHRUu3Og7B9sbY7tsFLctQkIqnMh3hErYgdMjTYuqmcXX+lK5T1lnUt3G7zNswmZA==}
    dependencies:
      spdx-expression-parse: 3.0.1
      spdx-license-ids: 3.0.17
    dev: false

  /spdx-exceptions@2.5.0:
    resolution: {integrity: sha512-PiU42r+xO4UbUS1buo3LPJkjlO7430Xn5SVAhdpzzsPHsjbYVflnnFdATgabnLude+Cqu25p6N+g2lw/PFsa4w==}
    dev: false

  /spdx-expression-parse@3.0.1:
    resolution: {integrity: sha512-cbqHunsQWnJNE6KhVSMsMeH5H/L9EpymbzqTQ3uLwNCLZ1Q481oWaofqH7nO6V07xlXwY6PhQdQ2IedWx/ZK4Q==}
    dependencies:
      spdx-exceptions: 2.5.0
      spdx-license-ids: 3.0.17
    dev: false

  /spdx-license-ids@3.0.17:
    resolution: {integrity: sha512-sh8PWc/ftMqAAdFiBu6Fy6JUOYjqDJBJvIhpfDMyHrr0Rbp5liZqd4TjtQ/RgfLjKFZb+LMx5hpml5qOWy0qvg==}
    dev: false

  /statuses@2.0.1:
    resolution: {integrity: sha512-RwNA9Z/7PrK06rYLIzFMlaF+l73iwpzsqRIFgbMLbTcLD6cOao82TaWefPXQvB2fOC4AjuYSEndS7N/mTCbkdQ==}
    engines: {node: '>= 0.8'}
    dev: false

  /stream-events@1.0.5:
    resolution: {integrity: sha512-E1GUzBSgvct8Jsb3v2X15pjzN1tYebtbLaMg+eBOUOAxgbLoSbT2NS91ckc5lJD1KfLjId+jXJRgo0qnV5Nerg==}
    requiresBuild: true
    dependencies:
      stubs: 3.0.0
    dev: false
    optional: true

  /stream-shift@1.0.3:
    resolution: {integrity: sha512-76ORR0DO1o1hlKwTbi/DM3EXWGf3ZJYO8cXX5RJwnul2DEg2oyoZyjLNoQM8WsvZiFKCRfC1O0J7iCvie3RZmQ==}
    requiresBuild: true
    dev: false
    optional: true

  /string-width@4.2.3:
    resolution: {integrity: sha512-wKyQRQpjJ0sIp62ErSZdGsjMJWsap5oRNihHhu6G7JVO/9jIB6UyevL+tXuOqrng8j/cxKTWyWUwvSTriiZz/g==}
    engines: {node: '>=8'}
    dependencies:
      emoji-regex: 8.0.0
      is-fullwidth-code-point: 3.0.0
      strip-ansi: 6.0.1
    dev: false

  /string_decoder@1.3.0:
    resolution: {integrity: sha512-hkRX8U1WjJFd8LsDJ2yQ/wWWxaopEsABU1XfkM8A+j0+85JAGppt16cr1Whg6KIbb4okU6Mql6BOj+uup/wKeA==}
    dependencies:
      safe-buffer: 5.2.1
    dev: false

  /strip-ansi@6.0.1:
    resolution: {integrity: sha512-Y38VPSHcqkFrCpFnQ9vuSXmquuv5oXOKpGeT6aGrr3o3Gc9AlVa6JBfUSOCnbxGGZF+/0ooI7KrPuUSztUdU5A==}
    engines: {node: '>=8'}
    dependencies:
      ansi-regex: 5.0.1
    dev: false

  /strip-json-comments@2.0.1:
    resolution: {integrity: sha512-4gB8na07fecVVkOI6Rs4e7T6NOTki5EmL7TUduTs6bu3EdnSycntVJ4re8kgZA+wx9IueI2Y11bfbgwtzuE0KQ==}
    engines: {node: '>=0.10.0'}
    dev: false

  /strnum@1.0.5:
    resolution: {integrity: sha512-J8bbNyKKXl5qYcR36TIO8W3mVGVHrmmxsd5PAItGkmyzwJvybiw2IVq5nqd0i4LSNSkB/sx9VHllbfFdr9k1JA==}
    requiresBuild: true
    dev: false
    optional: true

  /stubs@3.0.0:
    resolution: {integrity: sha512-PdHt7hHUJKxvTCgbKX9C1V/ftOcjJQgz8BZwNfV5c4B6dcGqlpelTbJ999jBGZ2jYiPAwcX5dP6oBwVlBlUbxw==}
    requiresBuild: true
    dev: false
    optional: true

  /supports-color@5.5.0:
    resolution: {integrity: sha512-QjVjwdXIt408MIiAqCX4oUKsgU2EqAGzs2Ppkm4aQYbjm+ZEWEcW4SfFNTr4uMNZma0ey4f5lgLrkB0aX0QMow==}
    engines: {node: '>=4'}
    dependencies:
      has-flag: 3.0.0
    dev: false

  /supports-preserve-symlinks-flag@1.0.0:
    resolution: {integrity: sha512-ot0WnXS9fgdkgIcePe6RHNk1WA8+muPa6cSjeR3V8K27q9BB1rTE3R1p7Hv0z1ZyAc8s6Vvv8DIyWf681MAt0w==}
    engines: {node: '>= 0.4'}
    dev: false

  /tar-fs@2.1.1:
    resolution: {integrity: sha512-V0r2Y9scmbDRLCNex/+hYzvp/zyYjvFbHPNgVTKfQvVrb6guiE/fxP+XblDNR011utopbkex2nM4dHNV6GDsng==}
    dependencies:
      chownr: 1.1.4
      mkdirp-classic: 0.5.3
      pump: 3.0.0
      tar-stream: 2.2.0
    dev: false

  /tar-stream@2.2.0:
    resolution: {integrity: sha512-ujeqbceABgwMZxEJnk2HDY2DlnUZ+9oEcb1KzTVfYHio0UE6dG71n60d8D2I4qNvleWrrXpmjpt7vZeF1LnMZQ==}
    engines: {node: '>=6'}
    dependencies:
      bl: 4.1.0
      end-of-stream: 1.4.4
      fs-constants: 1.0.0
      inherits: 2.0.4
      readable-stream: 3.6.2
    dev: false

  /teeny-request@9.0.0:
    resolution: {integrity: sha512-resvxdc6Mgb7YEThw6G6bExlXKkv6+YbuzGg9xuXxSgxJF7Ozs+o8Y9+2R3sArdWdW8nOokoQb1yrpFB0pQK2g==}
    engines: {node: '>=14'}
    requiresBuild: true
    dependencies:
      http-proxy-agent: 5.0.0
      https-proxy-agent: 5.0.1
      node-fetch: 2.7.0
      stream-events: 1.0.5
      uuid: 9.0.1
    transitivePeerDependencies:
      - encoding
      - supports-color
    dev: false
    optional: true

  /toidentifier@1.0.1:
    resolution: {integrity: sha512-o5sSPKEkg/DIQNmH43V0/uerLrpzVedkUh8tGNvaeXpfpuwjKenlSox/2O/BTlZUtEe+JG7s5YhEz608PlAHRA==}
    engines: {node: '>=0.6'}
    dev: false

  /tr46@0.0.3:
    resolution: {integrity: sha512-N3WMsuqV66lT30CrXNbEjx4GEwlow3v6rr4mCcv6prnfwhS01rkgyFdjPNBYd9br7LpXV1+Emh01fHnq2Gdgrw==}
    dev: false

  /tslib@2.6.2:
    resolution: {integrity: sha512-AEYxH93jGFPn/a2iVAwW87VuUIkR1FVUKB77NwMF7nBTDkDrrT/Hpt/IrCJ0QXhW27jTBDcf5ZY7w6RiqTMw2Q==}
    dev: false

  /tunnel-agent@0.6.0:
    resolution: {integrity: sha512-McnNiV1l8RYeY8tBgEpuodCC1mLUdbSN+CYBL7kJsJNInOP8UjDDEwdk6Mw60vdLLrr5NHKZhMAOSrR2NZuQ+w==}
    dependencies:
      safe-buffer: 5.2.1
    dev: false

  /type-fest@0.6.0:
    resolution: {integrity: sha512-q+MB8nYR1KDLrgr4G5yemftpMC7/QLqVndBmEEdqzmNj5dcFOO4Oo8qlwZE3ULT3+Zim1F8Kq4cBnikNhlCMlg==}
    engines: {node: '>=8'}
    dev: false

  /type-fest@0.8.1:
    resolution: {integrity: sha512-4dbzIzqvjtgiM5rw1k5rEHtBANKmdudhGyBEajN01fEyhaAIhsoKNy6y7+IN93IfpFtwY9iqi7kD+xwKhQsNJA==}
    engines: {node: '>=8'}
    dev: false

  /type-is@1.6.18:
    resolution: {integrity: sha512-TkRKr9sUTxEH8MdfuCSP7VizJyzRNMjj2J2do2Jr3Kym598JVdEksuzPQCnlFPW4ky9Q+iA+ma9BGm06XQBy8g==}
    engines: {node: '>= 0.6'}
    dependencies:
      media-typer: 0.3.0
      mime-types: 2.1.35
    dev: false

  /undici-types@5.26.5:
    resolution: {integrity: sha512-JlCMO+ehdEIKqlFxk6IfVoAUVmgz7cU7zD/h9XZ0qzeosSHmUJVOzSQvvYSYWXkFXC+IfLKSIffhv0sVZup6pA==}
    dev: false

  /unpipe@1.0.0:
    resolution: {integrity: sha512-pjy2bYhSsufwWlKwPc+l3cN7+wuJlK6uz0YdJEOlQDbl6jo/YlPi4mb8agUkVC8BF7V8NuzeyPNqRksA3hztKQ==}
    engines: {node: '>= 0.8'}
    dev: false

  /uri-js@4.4.1:
    resolution: {integrity: sha512-7rKUyy33Q1yc98pQ1DAmLtwX109F7TIfWlW1Ydo8Wl1ii1SeHieeh0HHfPeL2fMXK6z0s8ecKs9frCuLJvndBg==}
    dependencies:
      punycode: 2.3.1
    dev: false

  /url-template@2.0.8:
    resolution: {integrity: sha512-XdVKMF4SJ0nP/O7XIPB0JwAEuT9lDIYnNsK8yGVe43y0AWoKeJNdv3ZNWh7ksJ6KqQFjOO6ox/VEitLnaVNufw==}
    dev: false

  /util-deprecate@1.0.2:
    resolution: {integrity: sha512-EPD5q1uXyFxJpCrLnCc1nHnq3gOa6DZBocAIiI2TaSCA7VCJ1UJDMagCzIkXNsUYfD1daK//LTEQ8xiIbrHtcw==}
    dev: false

  /util@0.12.5:
    resolution: {integrity: sha512-kZf/K6hEIrWHI6XqOFUiiMa+79wE/D8Q+NCNAWclkyg3b4d2k7s0QGepNjiABc+aR3N1PAyHL7p6UcLY6LmrnA==}
    dependencies:
      inherits: 2.0.4
      is-arguments: 1.1.1
      is-generator-function: 1.0.10
      is-typed-array: 1.1.13
      which-typed-array: 1.1.15
    dev: false

  /utils-merge@1.0.1:
    resolution: {integrity: sha512-pMZTvIkT1d+TFGvDOqodOclx0QWkkgi6Tdoa8gC8ffGAAqz9pzPTZWAybbsHHoED/ztMtkv/VoYTYyShUn81hA==}
    engines: {node: '>= 0.4.0'}
    dev: false

  /uuid@8.3.2:
    resolution: {integrity: sha512-+NYs2QeMWy+GWFOEm9xnn6HCDp0l7QBD7ml8zLUmJ+93Q5NF0NocErnwkTkXVFNiX3/fpC6afS8Dhb/gz7R7eg==}
    hasBin: true
    dev: false

  /uuid@9.0.1:
    resolution: {integrity: sha512-b+1eJOlsR9K8HJpow9Ok3fiWOWSIcIzXodvv0rQjVoOVNpWMpxf1wZNpt4y9h10odCNrqnYp1OBzRktckBe3sA==}
    hasBin: true
    dev: false

  /validate-npm-package-license@3.0.4:
    resolution: {integrity: sha512-DpKm2Ui/xN7/HQKCtpZxoRWBhZ9Z0kqtygG8XCgNQ8ZlDnxuQmWhj566j8fN4Cu3/JmbhsDo7fcAJq4s9h27Ew==}
    dependencies:
      spdx-correct: 3.2.0
      spdx-expression-parse: 3.0.1
    dev: false

  /vary@1.1.2:
    resolution: {integrity: sha512-BNGbWLfd0eUPabhkXUVm0j8uuvREyTh5ovRa/dyow/BqAbZJyC+5fU+IzQOzmAKzYqYRAISoRhdQr3eIZ/PXqg==}
    engines: {node: '>= 0.8'}
    dev: false

  /webidl-conversions@3.0.1:
    resolution: {integrity: sha512-2JAn3z8AR6rjK8Sm8orRC0h/bcl/DqL7tRPdGZ4I1CjdF+EaMLmYxBHyXuKL849eucPFhvBoxMsflfOb8kxaeQ==}
    dev: false

  /websocket-driver@0.7.4:
    resolution: {integrity: sha512-b17KeDIQVjvb0ssuSDF2cYXSg2iztliJ4B9WdsuB6J952qCPKmnVq4DyW5motImXHDC1cBT/1UezrJVsKw5zjg==}
    engines: {node: '>=0.8.0'}
    dependencies:
      http-parser-js: 0.5.8
      safe-buffer: 5.2.1
      websocket-extensions: 0.1.4
    dev: false

  /websocket-extensions@0.1.4:
    resolution: {integrity: sha512-OqedPIGOfsDlo31UNwYbCFMSaO9m9G/0faIHj5/dZFDMFqPTcx6UwqyOy3COEaEOg/9VsGIpdqn62W5KhoKSpg==}
    engines: {node: '>=0.8.0'}
    dev: false

  /whatwg-url@5.0.0:
    resolution: {integrity: sha512-saE57nupxk6v3HY35+jzBwYa0rKSy0XR8JSxZPwgLr7ys0IBzhGviA1/TUGJLmSVqs8pb9AnvICXEuOHLprYTw==}
    dependencies:
      tr46: 0.0.3
      webidl-conversions: 3.0.1
    dev: false

  /which-typed-array@1.1.15:
    resolution: {integrity: sha512-oV0jmFtUky6CXfkqehVvBP/LSWJ2sy4vWMioiENyJLePrBO/yKyV9OyJySfAKosh+RYkIl5zJCNZ8/4JncrpdA==}
    engines: {node: '>= 0.4'}
    dependencies:
      available-typed-arrays: 1.0.7
      call-bind: 1.0.7
      for-each: 0.3.3
      gopd: 1.0.1
      has-tostringtag: 1.0.2
    dev: false

  /wrap-ansi@7.0.0:
    resolution: {integrity: sha512-YVGIj2kamLSTxw6NsZjoBxfSwsn0ycdesmc4p+Q21c5zPuZ1pl+NfxVdxPtdHvmNVOQ6XSYG4AUtyt/Fi7D16Q==}
    engines: {node: '>=10'}
    dependencies:
      ansi-styles: 4.3.0
      string-width: 4.2.3
      strip-ansi: 6.0.1
    dev: false

  /wrappy@1.0.2:
    resolution: {integrity: sha512-l4Sp/DRseor9wL6EvV2+TuQn63dMkPjZ/sp9XkghTEbV9KlPS1xUsZ3u7/IQO4wxtcFB4bgpQPRcR3QCvezPcQ==}
    dev: false

  /y18n@5.0.8:
    resolution: {integrity: sha512-0pfFzegeDWJHJIAmTLRP2DwHjdF5s7jo9tuztdQxAhINCdvS+3nGINqPd00AphqJR/0LhANUS6/+7SCb98YOfA==}
    engines: {node: '>=10'}
    dev: false

  /yallist@4.0.0:
    resolution: {integrity: sha512-3wdGidZyq5PB084XLES5TpOSRA3wjXAlIWMhum2kRcv/41Sn2emQ0dycQW4uZXLejwKvg6EsvbdlVL+FYEct7A==}
    dev: false

  /yargs-parser@21.1.1:
    resolution: {integrity: sha512-tVpsJW7DdjecAiFpbIB1e3qxIQsE6NoPc5/eTdrbbIC4h0LVsWhnoa3g+m2HclBIujHzsxZ4VJVA+GUuc2/LBw==}
    engines: {node: '>=12'}
    dev: false

  /yargs@17.7.2:
    resolution: {integrity: sha512-7dSzzRQ++CKnNI/krKnYRV7JKKPUXMEh61soaHKg9mrWEhzFWhFnxPxGl+69cD1Ou63C13NUPCnmIcrvqCuM6w==}
    engines: {node: '>=12'}
    dependencies:
      cliui: 8.0.1
      escalade: 3.1.2
      get-caller-file: 2.0.5
      require-directory: 2.1.1
      string-width: 4.2.3
      y18n: 5.0.8
      yargs-parser: 21.1.1
    dev: false

  /yocto-queue@0.1.0:
    resolution: {integrity: sha512-rVksvsnNCdJ/ohGc6xgPwyN8eheCxsiLM8mxuE/t/mOVqJewPuO1miLpTHQiRgTKCLexL4MeAFVagts7HmNZ2Q==}
    engines: {node: '>=10'}
    requiresBuild: true
    dev: false
`;
