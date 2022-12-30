# defaultCollection

In the `nx.json` you can set a `defaultCollection` property like this:

```jsonc
{
  "cli": {
    "defaultCollection": "@nrwl/next"
  }
}
```

This would cause the following command

```shell
nx g library my-lib
```

To create a `@nrwl/next:library` library instead of some other generator with the name `library`.

This property is no longer needed because the Nx cli automatically will prompt you to choose between the available options if there is any ambiguity. The output looks like this:

```shell
> nx g lib my-lib
? Which generator would you like to use? …
@nrwl/react-native:library
@nrwl/angular:library
@nrwl/expo:library
@nrwl/nest:library
@nrwl/node:library

@nestjs/schematics:library
@schematics/angular:library
@nrwl/js:library
@nrwl/next:library
@nrwl/react:library
@nrwl/workspace:library

None of the above
```
