## Necessary changes

- Review the package.json for each package and add some sort of post processing to update main and typings field to target the outputs path. Currently, they sort of work but each package needs to have this script to ensure it works for both development and release.
- Use the tsc executor
- Do not generate package.json (Check this)
- Copy Assets (This was done by the executor so we need to replicate this behaviour)

## Changes for TS references (tsconfig.base)

- Remove baseUrl and rootDir
- No paths
- composite: true

### Future

- Package json exports
- Module resolution: nodenext

### Next

- module tsconfig should be esnext
- resolution should be bundler

## Ending

- Packages
  -- We should check the output of the packages output against master
- Nx-dev
  - Check Build + deploy
- Graph Client
  - Check Build and Outputs
