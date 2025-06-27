# Interface: CreateNodesResult

## Table of contents

### Properties

- [externalNodes](/reference/core-api/devkit/documents/CreateNodesResult#externalnodes): Record<string, ProjectGraphExternalNode>
- [projects](/reference/core-api/devkit/documents/CreateNodesResult#projects): Record<string, Optional<ProjectConfiguration, "root">>

## Properties

### externalNodes

• `Optional` **externalNodes**: `Record`\<`string`, [`ProjectGraphExternalNode`](/reference/core-api/devkit/documents/ProjectGraphExternalNode)\>

A map of external node name -> external node. External nodes do not have a root, so the key is their name.

---

### projects

• `Optional` **projects**: `Record`\<`string`, `Optional`\<[`ProjectConfiguration`](/reference/core-api/devkit/documents/ProjectConfiguration), `"root"`\>\>

A map of project root -> project configuration
