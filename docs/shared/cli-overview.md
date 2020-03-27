# Nx CLI

The Nx CLI allows you to interact with your workspace in many ways, including operating on your code with builders, modifing or creating code with schematics and other tasks.

## Run Builders

`nx run` launches builders to perform actions on your code like testing, building or linting.

- [nx run](./run)  
  Syntax: `nx run [project]:[command]`  
  Example: `nx run my-app:build`

Since there are several frequently run builders, there's a shorthand syntax for these:

- [nx build](./build)  
  Syntax: `nx build [project]`  
  Long form: `nx run [project]:build`  
  Example: `nx build my-app`
- [nx lint](./lint)  
  Syntax: `nx lint [project]`  
  Long form: `nx run [project]:lint`  
  Example: `nx lint my-app`
- [nx serve](./serve)  
  Syntax: `nx serve [project]`  
  Long form: `nx run [project]:serve`  
  Example: `nx serve my-app`
- [nx e2e](./e2e)  
  Syntax: `nx e2e [project]`  
  Long form: `nx run [project]:e2e`  
  Example: `nx e2e my-app`
- [nx test](./test)  
  Syntax: `nx test [project]`  
  Long form: `nx run [project]:test`  
  Example: `nx test my-app`

## Generate Schematics

`nx generate` runs schematics to create or modify code given some inputs from the developer.

- [nx generate](./generate)  
  Syntax: `nx generate [plugin]:[schematic-name] [options]`  
  Example: `nx generate @nrwl/express:app api`

Workspace schematics are schematics that you have created specifically for your own workspace. They are executed using the `nx workspace-schematic` command.

- [nx workspace-schematic](./workspace-schematic)  
  Syntax: `nx workspace-schematic [schematic-name] [options]`  
  Example: `nx workspace-schematic create-new-route contact-us`

## More Commands

`nx affected` allows you to run builders only on projects that have been affected by a particular code change.

- [nx affected](./affected)  
  Syntax: `nx affected --target=[command]`  
  Example: `nx affected --target=test`

`nx dep-graph` launches a visual graph of the dependencies between your projects.

- [nx dep-graph](./dep-graph)  
  Syntax: `nx dep-graph`

`nx affected:dep-graph` launches the dependency graph with all affected projects highlighted.

- [nx affected:dep-graph](./affected-dep-graph)  
  Syntax: `nx affected:dep-graph`

`nx list` lists all installed and available plugins.

- [nx list](./list)  
  Syntax: `nx list`
