package dev.nx.gradle.data

import java.io.Serializable

typealias NxTarget = MutableMap<String, Any?>

typealias NxTargets = MutableMap<String, NxTarget>

typealias GradleTaskName = String

typealias GradleGroupName = String

typealias GradleTaskGroup = MutableList<GradleTaskName>

typealias TargetGroups = MutableMap<GradleGroupName, GradleTaskGroup>

data class GradleTargets(
    val targets: NxTargets,
    val targetGroups: TargetGroups,
    var externalNodes: MutableMap<String, ExternalNode>
) : Serializable
