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
        var relativePath = workspaceRootPath.relativize(projectPath).toString().replace("\\", "/")
        
        if (relativePath.isEmpty()) {
            // Project is at workspace root, use "." as the path
            relativePath = "."
            log.debug("Project ${mavenProject.artifactId} is at workspace root, using '.' as relative path")
        }
        
        try {
            val projectName = "${mavenProject.groupId}.${mavenProject.artifactId}"
            val projectType = determineProjectType(mavenProject)
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
    
    /**
     * Determine Nx project type based on Maven packaging and characteristics
     */
    private fun determineProjectType(mavenProject: MavenProject): String {
        return when (mavenProject.packaging.lowercase()) {
            "pom" -> "library"  // Parent/aggregator POMs are libraries
            "jar" -> "library"  // Default JAR projects to library - safer assumption
            "war", "ear" -> "application"  // Web/enterprise applications are clearly applications
            "maven-plugin" -> "library"   // Maven plugins are libraries
            "aar" -> "library"            // Android libraries
            else -> "library"             // Default to library for unknown types
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
     * Apply caching configuration using Maven's native build cache analysis
     */
    private fun applyReactorBasedCaching(target: ObjectNode, phase: String, mavenProject: MavenProject) {
        try {
            // Try to get Maven Build Cache Extension decision for common mojo executions
            val decision = when (phase) {
                "compile" -> tryGetMavenCacheDecision("org.apache.maven.plugins:maven-compiler-plugin:compile", mavenProject)
                "test-compile" -> tryGetMavenCacheDecision("org.apache.maven.plugins:maven-compiler-plugin:testCompile", mavenProject)
                "test" -> tryGetMavenCacheDecision("org.apache.maven.plugins:maven-surefire-plugin:test", mavenProject)
                "package" -> tryGetMavenCacheDecision("org.apache.maven.plugins:maven-jar-plugin:jar", mavenProject)
                else -> null
            }
            
            if (decision != null && decision.cacheable) {
                // Apply Maven's cacheability decision with native inputs/outputs
                buildCacheIntegration.applyCacheabilityToTarget(target, decision)
                log.info("Phase '$phase' in ${mavenProject.artifactId}: cache=${decision.cacheable} (${decision.reason}) with ${decision.inputs.size} inputs")
            } else {
                // Fallback to basic logic
                applyBasicCachingFallback(target, phase, mavenProject)
            }
            
            // Always enable parallelism for phases that don't modify external state
            val canRunInParallel = !isExternalStateModifyingPhase(phase)
            target.put("parallelism", canRunInParallel)
            
        } catch (e: Exception) {
            log.warn("Failed to apply Maven-based caching for phase $phase", e)
            // Fallback to safe defaults
            applyBasicCachingFallback(target, phase, mavenProject)
        }
    }
    
    /**
     * Try to get Maven Build Cache Extension decision for a specific mojo execution
     */
    private fun tryGetMavenCacheDecision(mojoKey: String, mavenProject: MavenProject): CacheabilityDecision? {
        return try {
            // Create a mock MojoExecution for the given mojo
            val parts = mojoKey.split(":")
            if (parts.size >= 3) {
                val mockExecution = org.apache.maven.plugin.MojoExecution(
                    org.apache.maven.model.Plugin().apply {
                        groupId = parts[0]
                        artifactId = parts[1]
                    },
                    parts[2],
                    "default-${parts[2]}"
                )
                buildCacheIntegration.isMojoExecutionCacheable(mockExecution, mavenProject)
            } else {
                null
            }
        } catch (e: Exception) {
            log.debug("Failed to check cacheability for $mojoKey", e)
            null
        }
    }
    
    /**
     * Fallback caching logic when Maven Build Cache Integration is not available
     */
    private fun applyBasicCachingFallback(target: ObjectNode, phase: String, mavenProject: MavenProject) {
        val cacheable = phase in setOf("compile", "test-compile", "test", "package")
        target.put("cache", cacheable)
        target.put("parallelism", true)
        
        if (cacheable) {
            addBasicCacheInputsAndOutputs(target, phase, mavenProject)
        }
        
        log.info("Phase '$phase' in ${mavenProject.artifactId}: cache=${cacheable} (basic fallback)")
    }
    
    private fun isExternalStateModifyingPhase(phase: String): Boolean {
        return phase in setOf("install", "deploy", "release")
    }
    
    private fun addBasicCacheInputsAndOutputs(
        target: ObjectNode, 
        phase: String, 
        mavenProject: MavenProject
    ) {
        // Use Maven project model to derive precise inputs instead of generic "default"
        val inputs = objectMapper.createArrayNode()
        
        // Add actual source directories from Maven model
        addMavenSourceInputs(inputs, phase, mavenProject)
        
        // Add POM file - always affects all targets
        inputs.add("{projectRoot}/pom.xml")
        
        // Add dependency inputs for phases that depend on other modules
        if (phase != "clean" && phase != "validate") {
            inputs.add("^production") // Dependencies' outputs
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
    
    /**
     * Add source directory inputs based on Maven project model
     */
    private fun addMavenSourceInputs(inputs: com.fasterxml.jackson.databind.node.ArrayNode, phase: String, mavenProject: MavenProject) {
        when (phase) {
            "compile", "process-sources", "generate-sources", "process-resources", "generate-resources" -> {
                // Main source directories
                mavenProject.compileSourceRoots?.forEach { sourceRoot ->
                    if (File(sourceRoot).exists()) {
                        inputs.add(convertToNxPattern(sourceRoot, mavenProject))
                    }
                }
                // Resource directories
                mavenProject.resources?.forEach { resource ->
                    if (File(resource.directory).exists()) {
                        inputs.add(convertToNxPattern(resource.directory, mavenProject))
                    }
                }
            }
            "test", "test-compile", "process-test-sources", "generate-test-sources", "process-test-resources", "generate-test-resources" -> {
                // Include main sources (tests depend on main)
                addMavenSourceInputs(inputs, "compile", mavenProject)
                
                // Test source directories
                mavenProject.testCompileSourceRoots?.forEach { sourceRoot ->
                    if (File(sourceRoot).exists()) {
                        inputs.add(convertToNxPattern(sourceRoot, mavenProject))
                    }
                }
                // Test resource directories
                mavenProject.testResources?.forEach { resource ->
                    if (File(resource.directory).exists()) {
                        inputs.add(convertToNxPattern(resource.directory, mavenProject))
                    }
                }
            }
            "package", "verify", "install", "deploy" -> {
                // Package phases depend on compiled output, not source
                inputs.add("{projectRoot}/target/classes/**/*")
                if (File("${mavenProject.build.directory}/test-classes").exists()) {
                    inputs.add("{projectRoot}/target/test-classes/**/*")
                }
            }
        }
    }
    
    /**
     * Convert absolute Maven path to Nx relative pattern
     */
    private fun convertToNxPattern(absolutePath: String, mavenProject: MavenProject): String {
        val projectRoot = File(mavenProject.basedir.absolutePath)
        val sourcePath = File(absolutePath)
        
        return try {
            val relativePath = projectRoot.toPath().relativize(sourcePath.toPath())
            "{projectRoot}/$relativePath/**/*"
        } catch (e: Exception) {
            // Fallback if path resolution fails
            "{projectRoot}/src/**/*"
        }
    }
}