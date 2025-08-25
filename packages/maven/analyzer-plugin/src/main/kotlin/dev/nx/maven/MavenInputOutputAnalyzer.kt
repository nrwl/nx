package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import org.apache.maven.project.MavenProject
import org.apache.maven.plugin.logging.Log
import java.io.File

class MavenInputOutputAnalyzer(
    private val objectMapper: ObjectMapper,
    private val workspaceRoot: String,
    private val log: Log
) {
    data class CacheabilityDecision(val cacheable: Boolean, val reason: String, val inputs: ArrayNode, val outputs: ArrayNode)
    
    fun analyzeCacheability(phase: String, project: MavenProject): CacheabilityDecision {
        val plugins = project.buildPlugins.filter { 
            it.executions.any { ex -> ex.phase == phase } || hasDefaultBinding(it.artifactId, phase) 
        }.map { it.artifactId }
        
        val hasSideEffects = plugins.any { it.contains("install") || it.contains("deploy") || it.contains("clean") }
        val inputs = collectInputs(phase, project)
        val outputs = collectOutputs(phase, project)
        
        return CacheabilityDecision(
            !hasSideEffects && inputs.size() > 0,
            if (hasSideEffects) "External side effects" else if (inputs.size() == 0) "No inputs" else "Deterministic",
            inputs, outputs
        )
    }
    
    private fun hasDefaultBinding(artifactId: String, phase: String) = when (phase) {
        "compile", "test-compile" -> artifactId == "maven-compiler-plugin"
        "test" -> artifactId == "maven-surefire-plugin"
        "package" -> artifactId == "maven-jar-plugin"
        "clean" -> artifactId == "maven-clean-plugin"
        "install" -> artifactId == "maven-install-plugin"
        "deploy" -> artifactId == "maven-deploy-plugin"
        else -> false
    }
    
    private fun collectInputs(phase: String, project: MavenProject): ArrayNode {
        val inputs = objectMapper.createArrayNode().apply { add("{projectRoot}/pom.xml") }
        
        when (phase) {
            "compile" -> {
                project.compileSourceRoots.forEach { addPath(inputs, it) }
                project.build.resources.forEach { addPath(inputs, it.directory) }
                addDeps(inputs, project.compileArtifacts)
            }
            "test-compile" -> {
                project.testCompileSourceRoots.forEach { addPath(inputs, it) }
                project.build.testResources.forEach { addPath(inputs, it.directory) }
                addPath(inputs, project.build.outputDirectory)
                addDeps(inputs, project.testArtifacts)
            }
            "test" -> {
                addPath(inputs, project.build.testOutputDirectory)
                addPath(inputs, project.build.outputDirectory)
                addDeps(inputs, project.testArtifacts)
            }
            "package" -> {
                addPath(inputs, project.build.outputDirectory)
                project.build.resources.forEach { addPath(inputs, it.directory) }
            }
        }
        return inputs
    }
    
    private fun collectOutputs(phase: String, project: MavenProject): ArrayNode {
        val outputs = objectMapper.createArrayNode()
        when (phase) {
            "compile" -> outputs.add(toPath(project.build.outputDirectory))
            "test-compile" -> outputs.add(toPath(project.build.testOutputDirectory))
            "test" -> outputs.add(toPath(project.build.directory + "/surefire-reports"))
            "package" -> outputs.add(toPath(project.build.directory + "/${project.build.finalName}.jar"))
        }
        return outputs
    }
    
    private fun addPath(inputs: ArrayNode, path: String) {
        if (File(path).exists()) inputs.add(toPath(path) + "/**/*")
    }
    
    private fun addDeps(inputs: ArrayNode, deps: Collection<org.apache.maven.artifact.Artifact>) {
        if (deps.isNotEmpty()) {
            val node = objectMapper.createObjectNode()
            node.put("type", "deps")
            node.put("hash", deps.joinToString(";") { "${it.groupId}:${it.artifactId}:${it.version}" })
            inputs.add(node)
        }
    }
    
    private fun toPath(path: String): String = try {
        val rel = java.nio.file.Paths.get(workspaceRoot).relativize(java.nio.file.Paths.get(path))
        "{projectRoot}/$rel".replace("\\", "/")
    } catch (e: Exception) { 
        "{projectRoot}/$path" 
    }
}