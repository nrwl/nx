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
            val projectType = if (mavenProject.packaging == "pom") "library" else "application"
            val sourceRoot = "$relativePath/src/main/java"
            
            // Generate targets using the same logic as TypeScript
            val targets = generateTargetsForProject(mavenProject, coordinatesToProjectName, allProjects)
            val targetGroups = generateTargetGroupsForProject(targets, mavenProject)
            
            // Create the Nx project configuration
            val projectConfig = objectMapper.createObjectNode()
            projectConfig.put("name", projectName)
            projectConfig.put("root", relativePath)
            projectConfig.put("projectType", projectType)
            projectConfig.put("sourceRoot", sourceRoot)
            projectConfig.put("targets", targets)
            projectConfig.put("targetGroups", targetGroups)
            
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
     * Generate target groups to organize Maven phases and goals logically
     */
    private fun generateTargetGroupsForProject(targets: ObjectNode, mavenProject: MavenProject): ObjectNode {
        val targetGroups = objectMapper.createObjectNode()
        
        // Get all target names from the targets object
        val targetNames = targets.fieldNames().asSequence().toList()
        
        // Maven Lifecycle Phases Groups
        val buildPhases = targetNames.filter { it in setOf("validate", "initialize", "generate-sources", 
            "process-sources", "generate-resources", "process-resources", "compile", "process-classes") }
        if (buildPhases.isNotEmpty()) {
            val buildGroup = objectMapper.createArrayNode()
            buildPhases.forEach { buildGroup.add(it) }
            targetGroups.put("build", buildGroup)
        }
        
        val testPhases = targetNames.filter { it in setOf("generate-test-sources", "process-test-sources",
            "generate-test-resources", "process-test-resources", "test-compile", "process-test-classes", "test") }
        if (testPhases.isNotEmpty()) {
            val testGroup = objectMapper.createArrayNode()
            testPhases.forEach { testGroup.add(it) }
            targetGroups.put("test", testGroup)
        }
        
        val packagePhases = targetNames.filter { it in setOf("prepare-package", "package") }
        if (packagePhases.isNotEmpty()) {
            val packageGroup = objectMapper.createArrayNode()
            packagePhases.forEach { packageGroup.add(it) }
            targetGroups.put("package", packageGroup)
        }
        
        val integrationPhases = targetNames.filter { it in setOf("pre-integration-test", "integration-test", 
            "post-integration-test", "verify") }
        if (integrationPhases.isNotEmpty()) {
            val integrationGroup = objectMapper.createArrayNode()
            integrationPhases.forEach { integrationGroup.add(it) }
            targetGroups.put("integration", integrationGroup)
        }
        
        val deployPhases = targetNames.filter { it in setOf("install", "deploy") }
        if (deployPhases.isNotEmpty()) {
            val deployGroup = objectMapper.createArrayNode()
            deployPhases.forEach { deployGroup.add(it) }
            targetGroups.put("deploy", deployGroup)
        }
        
        val cleanPhases = targetNames.filter { it in setOf("pre-clean", "clean", "post-clean") }
        if (cleanPhases.isNotEmpty()) {
            val cleanGroup = objectMapper.createArrayNode()
            cleanPhases.forEach { cleanGroup.add(it) }
            targetGroups.put("clean", cleanGroup)
        }
        
        val sitePhases = targetNames.filter { it in setOf("pre-site", "site", "post-site", "site-deploy") }
        if (sitePhases.isNotEmpty()) {
            val siteGroup = objectMapper.createArrayNode()
            sitePhases.forEach { siteGroup.add(it) }
            targetGroups.put("site", siteGroup)
        }
        
        // Goal-based groups for common Maven plugins
        val compilerGoals = targetNames.filter { it.contains("compile") && !testPhases.contains(it) }
        if (compilerGoals.isNotEmpty()) {
            val compilerGroup = objectMapper.createArrayNode()
            compilerGoals.forEach { compilerGroup.add(it) }
            targetGroups.put("compiler", compilerGroup)
        }
        
        val testGoals = targetNames.filter { it.contains("test") || it.contains("surefire") || it.contains("failsafe") }
        if (testGoals.isNotEmpty()) {
            val testToolsGroup = objectMapper.createArrayNode()
            testGoals.forEach { testToolsGroup.add(it) }
            targetGroups.put("test-tools", testToolsGroup)
        }
        
        val jarGoals = targetNames.filter { it.contains("jar") && !it.contains("test") }
        if (jarGoals.isNotEmpty()) {
            val jarGroup = objectMapper.createArrayNode()
            jarGoals.forEach { jarGroup.add(it) }
            targetGroups.put("jar", jarGroup)
        }
        
        // Packaging-specific groups
        when (mavenProject.packaging) {
            "war" -> {
                val warGoals = targetNames.filter { it.contains("war") }
                if (warGoals.isNotEmpty()) {
                    val warGroup = objectMapper.createArrayNode()
                    warGoals.forEach { warGroup.add(it) }
                    targetGroups.put("war", warGroup)
                }
            }
            "ear" -> {
                val earGoals = targetNames.filter { it.contains("ear") }
                if (earGoals.isNotEmpty()) {
                    val earGroup = objectMapper.createArrayNode()
                    earGoals.forEach { earGroup.add(it) }
                    targetGroups.put("ear", earGroup)
                }
            }
            "maven-plugin" -> {
                val pluginGoals = targetNames.filter { it.contains("plugin") }
                if (pluginGoals.isNotEmpty()) {
                    val pluginGroup = objectMapper.createArrayNode()
                    pluginGoals.forEach { pluginGroup.add(it) }
                    targetGroups.put("plugin", pluginGroup)
                }
            }
        }
        
        // Quality and analysis groups
        val qualityGoals = targetNames.filter { 
            it.contains("checkstyle") || it.contains("pmd") || it.contains("spotbugs") || 
            it.contains("jacoco") || it.contains("sonar") 
        }
        if (qualityGoals.isNotEmpty()) {
            val qualityGroup = objectMapper.createArrayNode()
            qualityGoals.forEach { qualityGroup.add(it) }
            targetGroups.put("quality", qualityGroup)
        }
        
        val docsGoals = targetNames.filter { 
            it.contains("javadoc") || it.contains("asciidoc") || it.contains("antora") 
        }
        if (docsGoals.isNotEmpty()) {
            val docsGroup = objectMapper.createArrayNode()
            docsGoals.forEach { docsGroup.add(it) }
            targetGroups.put("docs", docsGroup)
        }
        
        return targetGroups
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