package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import org.apache.maven.execution.MavenSession
import org.apache.maven.lifecycle.LifecycleExecutor
import org.apache.maven.project.MavenProject
import org.apache.maven.plugin.logging.Log
import java.io.File
import java.nio.file.Paths

/**
 * Generates Nx project configurations from Maven projects
 */
class NxProjectConfigurationGenerator(
    private val objectMapper: ObjectMapper,
    private val dependencyResolver: MavenDependencyResolver,
    private val workspaceRoot: String,
    private val log: Log,
    private val session: MavenSession,
    private val lifecycleExecutor: LifecycleExecutor
) {
    
    private val buildCacheIntegration = MavenBuildCacheIntegration(session, objectMapper, log)
    
    fun generateNxProjectConfiguration(
        mavenProject: MavenProject,
        coordinatesToProjectName: Map<String, String>,
        allProjects: List<MavenProject>
    ): ArrayNode? {
        // Skip root project with empty root to avoid conflict with Nx workspace
        if (mavenProject.artifactId.isNullOrEmpty()) return null
        
        val workspaceRootPath = Paths.get(workspaceRoot)
        val projectPath = mavenProject.basedir?.toPath() ?: return null
        val relativePath = workspaceRootPath.relativize(projectPath).toString().replace("\\", "/")
        
        if (relativePath.isEmpty()) return null
        
        try {
            val projectName = "${mavenProject.groupId}.${mavenProject.artifactId}"
            val projectType = if (mavenProject.packaging == "pom") "library" else "application"
            val sourceRoot = "$relativePath/src/main/java"
            
            // Generate targets using the same logic as TypeScript
            val targets = generateTargetsForProject(mavenProject, coordinatesToProjectName, allProjects)
            
            // Create the Nx project configuration
            val projectConfig = objectMapper.createObjectNode()
            projectConfig.put("name", projectName)
            projectConfig.put("root", relativePath)
            projectConfig.put("projectType", projectType)
            projectConfig.put("sourceRoot", sourceRoot)
            projectConfig.put("targets", targets)
            
            // Tags
            val tagsArray = objectMapper.createArrayNode()
            tagsArray.add("maven:${mavenProject.groupId}")
            tagsArray.add("maven:${mavenProject.packaging}")
            if (mavenProject.packaging == "maven-plugin") {
                tagsArray.add("maven:plugin")
            }
            projectConfig.put("tags", tagsArray)
            
            // Create the createNodesResult format: [root, { projects: { [root]: projectConfig } }]
            val resultArray = objectMapper.createArrayNode()
            resultArray.add(relativePath)
            
            val projectsWrapper = objectMapper.createObjectNode()
            val projectsNode = objectMapper.createObjectNode()
            projectsNode.put(relativePath, projectConfig)
            projectsWrapper.put("projects", projectsNode)
            
            resultArray.add(projectsWrapper)
            
            return resultArray
            
        } catch (e: Exception) {
            log.warn("Failed to generate Nx configuration for project: ${mavenProject.artifactId}", e)
            return null
        }
    }
    
    private fun generateTargetsForProject(
        mavenProject: MavenProject,
        coordinatesToProjectName: Map<String, String>,
        allProjects: List<MavenProject>
    ): ObjectNode {
        val targets = objectMapper.createObjectNode()
        val qualifiedName = "${mavenProject.groupId}:${mavenProject.artifactId}"
        
        // Get all available phases for this project
        val allPhases = mutableSetOf<String>()
        
        // Add common phases based on packaging (including clean which is always available)
        allPhases.add("clean")
        
        when (mavenProject.packaging.lowercase()) {
            "jar", "war", "ear" -> {
                allPhases.addAll(listOf("validate", "compile", "test", "package", "verify", "install", "deploy"))
            }
            "pom" -> {
                allPhases.addAll(listOf("validate", "install", "deploy"))
            }
            "maven-plugin" -> {
                allPhases.addAll(listOf("validate", "compile", "test", "package", "install", "deploy"))
            }
        }
        
        // Create targets for all phases
        for (phase in allPhases) {
            val target = objectMapper.createObjectNode()
            target.put("executor", "nx:run-commands")
            
            val options = objectMapper.createObjectNode()
            options.put("command", "mvn $phase -pl $qualifiedName")
            options.put("cwd", "{workspaceRoot}")
            target.put("options", options)
            
            // Add dependsOn relationships using pre-computed logic
            val dependsOn = dependencyResolver.computeDependsOnForPhase(phase, mavenProject, coordinatesToProjectName, allProjects)
            if (dependsOn.isNotEmpty()) {
                val dependsOnArray = objectMapper.createArrayNode()
                for (dep in dependsOn) {
                    dependsOnArray.add(dep)
                }
                target.put("dependsOn", dependsOnArray)
            }
            
            // Apply caching configuration using Maven Reactor analysis
            applyReactorBasedCaching(target, phase, mavenProject)
            
            targets.put(phase, target)
        }
        
        // Add test directory check for test target
        val testDir = File(mavenProject.basedir, "src/test/java")
        if (!testDir.exists() || !testDir.isDirectory) {
            targets.remove("test")
        }
        
        return targets
    }
    
    /**
     * Apply caching configuration based on Maven Reactor analysis
     */
    private fun applyReactorBasedCaching(target: ObjectNode, phase: String, mavenProject: MavenProject) {
        try {
            // TODO: Integrate with MavenBuildCacheIntegration for individual mojo executions
            // For now, use basic defaults since we removed the old hardcoded logic
            
            // Apply basic defaults - only cache compile and test phases
            val cacheable = phase in setOf("compile", "test-compile", "test", "package")
            target.put("cache", cacheable)
            
            // Always enable parallelism for phases that don't modify external state
            val canRunInParallel = !isExternalStateModifyingPhase(phase)
            target.put("parallelism", canRunInParallel)
            
            if (cacheable) {
                // Add basic inputs and outputs for cacheable phases
                addBasicCacheInputsAndOutputs(target, phase, mavenProject)
            }
            
            // Log the caching decision for debugging
            log.info("Phase '$phase' in ${mavenProject.artifactId}: cache=${cacheable} (basic fallback)")
            
        } catch (e: Exception) {
            log.warn("Failed to apply Reactor-based caching for phase $phase", e)
            // Fallback to safe defaults
            target.put("cache", false)
            target.put("parallelism", true)
        }
    }
    
    private fun isExternalStateModifyingPhase(phase: String): Boolean {
        return phase in setOf("install", "deploy", "release")
    }
    
    private fun addBasicCacheInputsAndOutputs(
        target: ObjectNode, 
        phase: String, 
        mavenProject: MavenProject
    ) {
        // Add standard inputs
        val inputs = objectMapper.createArrayNode()
        inputs.add("default") // Source files
        inputs.add("{projectRoot}/pom.xml") // POM file
        
        // Add dependency inputs for non-clean phases
        if (phase != "clean") {
            inputs.add("^production") // Dependencies' production outputs
        }
        
        // Add test-specific inputs for test phases
        if (phase.contains("test")) {
            inputs.add("{projectRoot}/src/test/**/*")
        }
        
        target.put("inputs", inputs)
        
        // Add standard outputs based on phase and packaging
        val outputs = objectMapper.createArrayNode()
        when (phase) {
            "compile" -> outputs.add("{projectRoot}/target/classes")
            "test-compile" -> outputs.add("{projectRoot}/target/test-classes")
            "test" -> {
                outputs.add("{projectRoot}/target/test-reports")
                outputs.add("{projectRoot}/target/surefire-reports")
                outputs.add("{workspaceRoot}/coverage/{projectRoot}")
            }
            "package" -> {
                when (mavenProject.packaging) {
                    "jar", "maven-plugin" -> outputs.add("{projectRoot}/target/*.jar")
                    "war" -> outputs.add("{projectRoot}/target/*.war")
                    "ear" -> outputs.add("{projectRoot}/target/*.ear")
                    "pom" -> outputs.add("{projectRoot}/target/maven-archiver")
                }
            }
            "verify" -> outputs.add("{projectRoot}/target/verify-reports")
        }
        
        if (outputs.size() > 0) {
            target.put("outputs", outputs)
        }
    }
}