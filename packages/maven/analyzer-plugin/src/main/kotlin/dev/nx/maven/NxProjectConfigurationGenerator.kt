package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
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
    private val log: Log
) {
    
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
            
            // Add caching configuration for cacheable phases
            addCachingConfiguration(target, phase, mavenProject)
            
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
     * Add caching configuration to targets based on Maven phase characteristics
     */
    private fun addCachingConfiguration(target: ObjectNode, phase: String, mavenProject: MavenProject) {
        val relativePath = Paths.get(workspaceRoot).relativize(mavenProject.basedir.toPath()).toString().replace("\\", "/")
        
        when (phase) {
            "compile" -> {
                target.put("cache", true)
                target.put("parallelism", true)
                
                // Inputs: source files, pom.xml, dependencies
                val inputs = objectMapper.createArrayNode()
                inputs.add("default") // Default Nx inputs (source files)
                inputs.add("^production") // Dependencies' production outputs
                inputs.add("{projectRoot}/pom.xml")
                target.put("inputs", inputs)
                
                // Outputs: compiled classes
                val outputs = objectMapper.createArrayNode()
                outputs.add("{projectRoot}/target/classes")
                target.put("outputs", outputs)
            }
            
            "test-compile" -> {
                target.put("cache", true)
                target.put("parallelism", true)
                
                val inputs = objectMapper.createArrayNode()
                inputs.add("default")
                inputs.add("^production")
                inputs.add("{projectRoot}/pom.xml")
                inputs.add("{projectRoot}/src/test/**/*")
                target.put("inputs", inputs)
                
                val outputs = objectMapper.createArrayNode()
                outputs.add("{projectRoot}/target/test-classes")
                target.put("outputs", outputs)
            }
            
            "test" -> {
                target.put("cache", true)
                target.put("parallelism", true)
                
                val inputs = objectMapper.createArrayNode()
                inputs.add("default")
                inputs.add("^production")
                inputs.add("{projectRoot}/pom.xml")
                inputs.add("{projectRoot}/src/test/**/*")
                target.put("inputs", inputs)
                
                val outputs = objectMapper.createArrayNode()
                outputs.add("{projectRoot}/target/test-reports")
                outputs.add("{projectRoot}/target/surefire-reports")
                outputs.add("{projectRoot}/target/failsafe-reports")
                outputs.add("{workspaceRoot}/coverage/{projectRoot}")
                target.put("outputs", outputs)
            }
            
            "package" -> {
                target.put("cache", true)
                target.put("parallelism", true)
                
                val inputs = objectMapper.createArrayNode()
                inputs.add("production") // Production files only (no tests)
                inputs.add("^production")
                inputs.add("{projectRoot}/pom.xml")
                target.put("inputs", inputs)
                
                val outputs = objectMapper.createArrayNode()
                when (mavenProject.packaging) {
                    "jar", "maven-plugin" -> outputs.add("{projectRoot}/target/*.jar")
                    "war" -> outputs.add("{projectRoot}/target/*.war")
                    "ear" -> outputs.add("{projectRoot}/target/*.ear")
                    "pom" -> {
                        // POM projects don't produce artifacts, but cache anyway for consistency
                        outputs.add("{projectRoot}/target/maven-archiver")
                    }
                }
                target.put("outputs", outputs)
            }
            
            "verify" -> {
                target.put("cache", true)
                target.put("parallelism", true)
                
                val inputs = objectMapper.createArrayNode()
                inputs.add("default")
                inputs.add("^production")
                inputs.add("{projectRoot}/pom.xml")
                target.put("inputs", inputs)
                
                val outputs = objectMapper.createArrayNode()
                outputs.add("{projectRoot}/target/verify-reports")
                outputs.add("{projectRoot}/target/integration-test-reports")
                target.put("outputs", outputs)
            }
            
            // Non-cacheable phases: clean, install, deploy, validate
            "clean" -> {
                // Clean is destructive and shouldn't be cached
                target.put("cache", false)
            }
            
            "install", "deploy" -> {
                // These modify external state (repositories) and shouldn't be cached
                target.put("cache", false)
            }
            
            "validate" -> {
                // Usually fast validation, caching overhead not worth it
                target.put("cache", false)
                target.put("parallelism", true) // But can run in parallel
            }
        }
    }
}