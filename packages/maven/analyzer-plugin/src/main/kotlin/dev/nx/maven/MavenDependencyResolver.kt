package dev.nx.maven

import com.fasterxml.jackson.databind.JsonNode
import org.apache.maven.project.MavenProject

/**
 * Handles Maven dependency resolution
 */
class MavenDependencyResolver {

    fun computeDependsOnForPhase(
        phase: String,
        mavenProject: MavenProject,
        coordinatesToProjectName: Map<String, String>,
        allProjects: List<MavenProject>,
        projectAnalyses: Map<String, JsonNode> = emptyMap()
    ): List<String> {
        val dependsOn = mutableListOf<String>()
// TODO: We might need this
//        // Child modules need their parent POM in the local repository
//        val parent = mavenProject.parent
//        if (parent != null) {
//            val parentCoordinates = "${parent.groupId}:${parent.artifactId}"
//            val parentProjectName = coordinatesToProjectName[parentCoordinates]
//            if (parentProjectName != null) {
//                dependsOn.add("$parentProjectName:install")
//            }
//        }
//
//        // Child modules need their dependencies installed in the local repository
//        for (dependency in mavenProject.dependencies) {
//            val depCoordinates = "${dependency.groupId}:${dependency.artifactId}"
//            val depProjectName = coordinatesToProjectName[depCoordinates]
//            if (depProjectName != null && depProjectName != "${mavenProject.groupId}.${mavenProject.artifactId}") {
//                dependsOn.add("$depProjectName:install")
//            }
//        }

        return dependsOn
    }

}
