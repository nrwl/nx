# Type alias: NxPluginV1

Ƭ **NxPluginV1**: `Object`

@deprecated(v18) Use v2 plugins w/ buildProjectNodes and buildProjectDependencies instead.

#### Type declaration

| Name                      | Type                                                                            | Description                                                                                                                                |
| :------------------------ | :------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                    | `string`                                                                        | -                                                                                                                                          |
| `processProjectGraph?`    | `ProjectGraphProcessor`                                                         | @deprecated(v18) Use buildProjectNodes and buildProjectDependencies instead.                                                               |
| `projectFilePatterns?`    | `string`[]                                                                      | A glob pattern to search for non-standard project files. @example: ["*.csproj", "pom.xml"] @deprecated(v18) Use buildProjectNodes instead. |
| `registerProjectTargets?` | [`ProjectTargetConfigurator`](../../devkit/documents/ProjectTargetConfigurator) | @deprecated(v18) Add targets to the nodes inside of buildProjectNodes instead.                                                             |
