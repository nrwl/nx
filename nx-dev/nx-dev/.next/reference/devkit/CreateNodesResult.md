## Table of contents

### Properties

- [externalNodes](/docs/reference/devkit/CreateNodesResult#externalnodes)
- [projects](/docs/reference/devkit/CreateNodesResult#projects)

## Properties

### externalNodes

• `Optional` **externalNodes**: `Record`\<`string`, [`ProjectGraphExternalNode`](/docs/reference/devkit/ProjectGraphExternalNode)\>

A map of external node name -> external node. External nodes do not have a root, so the key is their name.

___

### projects

• `Optional` **projects**: `Record`\<`string`, `Optional`\<[`ProjectConfiguration`](/docs/reference/devkit/ProjectConfiguration), ``"root"``\>\>

A map of project root -> project configuration
