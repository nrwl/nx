# Nx and Angular CLI

Nx supports Angular Devkit. When you run `nx build myapp`, and the build target for `myapp` is implemented using Angular Devkit, Nx will do exactly the same as the Angular CLI. When you run `nx g component mycmp`, once again, Nx will invoke the same schematic. You can think of Nx wrapping the Angular CLI. The results of running commands will produce the same result, except that running `nx` will often be a lot faster.

How?

Nx CLI uses advanced code analysis and computation caching to reuse previous computation results when possible. The Angular CLI doesn't do it. The `Nx CLI` also supports a lot more commands than the Angular CLI. It can run a target against many projects in parallel, run a target against a project and its dependencies, etc..

## Decorating Angular CLI

Since Nx does everything Angular CLI does, but better, all workspace have a `decorate-angular-cli.js` file. This file remaps `ng` to invoke `nx`, which at the end of the day still invokes the Angular CLI. In other words, calling `ng` will invoke the wrapped version.
