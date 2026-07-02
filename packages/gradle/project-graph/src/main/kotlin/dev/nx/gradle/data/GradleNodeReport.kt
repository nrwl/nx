package dev.nx.gradle.data

import java.io.Serializable
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.Nested

/**
 * Bump when the report JSON shape changes in a way consumers must not misread. @nx/gradle refuses
 * reports without this marker (produced by plugin versions before 0.1.24).
 */
const val REPORT_FORMAT_VERSION = 1

data class GradleNodeReport(
    @Nested val nodes: Map<String, ProjectNode>,
    @Input val dependencies: Set<Dependency>,
    @Nested val externalNodes: Map<String, ExternalNode>,
    @Input val buildFiles: List<String>,
    @Input val formatVersion: Int = REPORT_FORMAT_VERSION
) : Serializable
