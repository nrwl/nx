package dev.nx.gradle.native

import org.gradle.api.tasks.Input

typealias Target = MutableMap<String, Any?>

typealias Targets = MutableMap<String, Target>

typealias TargetGroup = MutableList<String>

typealias TargetGroups = MutableMap<String, TargetGroup>

data class GradleTargets(
        val targets: Targets,
        val targetGroups: TargetGroups,
        var externalNodes: MutableMap<String, ExternalNode>
)

data class NodeMetadata(val targetGroups: TargetGroups, val technologies: List<String>, val description: String?)

data class ProjectNode(
        val targets: Targets,
        val metadata: NodeMetadata,
        val name: String)

data class Dependency(val source: String, val target: String, var sourceFile: String)

data class ExternalDepData(val version: String?, val packageName: String, val hash: String?)

data class ExternalNode(var type: String?, val name: String, var data: ExternalDepData)

data class GradleNodeReport(
        @Input
        var nodes: MutableMap<String, ProjectNode>?,
        @Input
        var dependencies: MutableSet<Dependency>?,
        @Input
        var externalNodes: MutableMap<String, ExternalNode>?)
