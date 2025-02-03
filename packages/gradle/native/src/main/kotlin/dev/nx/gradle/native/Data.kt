package dev.nx.gradle.native

typealias Target = MutableMap<String, Any?>

typealias Targets = MutableMap<String, Target>

typealias TargetGroup = MutableList<String>

typealias TargetGroups = MutableMap<String, TargetGroup>

data class GradleTargets(
        val targets: Targets,
        val targetGroups: TargetGroups,
        var externalNodes: MutableMap<String, ExternalNode>
)

data class NodeMetadata(val targetGroups: TargetGroups, val technologies: Array<String>, val description: String?)

data class ProjectNode(
        val targets: Targets,
        val metadata: NodeMetadata,
        val name: String)

data class Dependency(val source: String, val target: String, var sourceFile: String)

data class ExternalDepData(val version: String?, val packageName: String, val hash: String?)

data class ExternalNode(var type: String?, val name: String, var data: ExternalDepData)

data class GradleNodeReport(var nodes: MutableMap<String, ProjectNode>?, var dependencies: MutableSet<Dependency>?, var externalNodes: MutableMap<String, ExternalNode>?)
