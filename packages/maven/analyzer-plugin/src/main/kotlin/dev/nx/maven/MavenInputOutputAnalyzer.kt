package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import org.apache.maven.project.MavenProject
import org.apache.maven.plugin.logging.Log
import java.io.File
import java.nio.file.Paths

/**
 * Analyzes Maven goal inputs and outputs to determine cacheability
 * Uses intelligent input/output analysis to make optimal caching decisions
 */
class MavenInputOutputAnalyzer(
    private val objectMapper: ObjectMapper,
    private val workspaceRoot: String,
    private val log: Log
) {
    
    data class CacheabilityDecision(
        val cacheable: Boolean,
        val reason: String,
        val inputs: ArrayNode,
        val outputs: ArrayNode
    )
    
    fun analyzeCacheability(phase: String, project: MavenProject): CacheabilityDecision {
        log.debug("Analyzing cacheability for phase '$phase' in project ${project.artifactId}")
        
        // Check for external side effects first
        if (hasExternalSideEffects(phase)) {
            return CacheabilityDecision(
                cacheable = false,
                reason = "Phase '$phase' has external side effects",
                inputs = objectMapper.createArrayNode(),
                outputs = objectMapper.createArrayNode()
            )
        }
        
        // Analyze inputs and outputs
        val inputs = analyzeInputs(phase, project)
        val outputs = analyzeOutputs(phase, project)
        
        // Check if phase is deterministic and has meaningful inputs
        val isDeterministic = checkDeterminism(phase, project)
        val hasInputs = inputs.size() > 0
        
        val cacheable = isDeterministic && hasInputs
        val reason = when {
            !isDeterministic -> "Phase '$phase' is not deterministic"
            !hasInputs -> "Phase '$phase' has no trackable inputs"
            else -> "Phase '$phase' is deterministic with trackable inputs"
        }
        
        log.debug("Phase '$phase' cacheability: $cacheable ($reason) with ${inputs.size()} inputs, ${outputs.size()} outputs")
        
        return CacheabilityDecision(
            cacheable = cacheable,
            reason = reason,
            inputs = inputs,
            outputs = outputs
        )
    }
    
    private fun hasExternalSideEffects(phase: String): Boolean {
        return when (phase.lowercase()) {
            "install" -> true  // Modifies local repository
            "deploy" -> true   // Modifies remote repository  
            "clean" -> true    // Removes files (side effect, not cacheable)
            else -> false
        }
    }
    
    private fun checkDeterminism(phase: String, project: MavenProject): Boolean {
        return when (phase.lowercase()) {
            "validate" -> true     // Validation is deterministic
            "compile" -> true      // Compilation is deterministic
            "test-compile" -> true // Test compilation is deterministic
            "test" -> true         // Tests are deterministic (assuming no random behavior)
            "package" -> true      // Packaging is deterministic
            "verify" -> true       // Verification is deterministic
            "integration-test" -> false  // Integration tests may have external dependencies
            else -> false          // Unknown phases default to non-deterministic
        }
    }
    
    private fun analyzeInputs(phase: String, project: MavenProject): ArrayNode {
        val inputs = objectMapper.createArrayNode()
        val projectRoot = getRelativeProjectRoot(project)
        
        when (phase.lowercase()) {
            "validate" -> {
                // Validation typically checks POM structure
                addInput(inputs, "$projectRoot/pom.xml")
            }
            
            "compile" -> {
                // Source files
                addDirectoryInput(inputs, "$projectRoot/src/main/java")
                addDirectoryInput(inputs, "$projectRoot/src/main/kotlin")
                addDirectoryInput(inputs, "$projectRoot/src/main/scala")
                
                // Resources
                addDirectoryInput(inputs, "$projectRoot/src/main/resources")
                
                // Project configuration
                addInput(inputs, "$projectRoot/pom.xml")
                
                // Dependencies (represented by dependency list, not actual files)
                addDependenciesInput(inputs, project.compileArtifacts)
            }
            
            "test-compile" -> {
                // Test source files
                addDirectoryInput(inputs, "$projectRoot/src/test/java")
                addDirectoryInput(inputs, "$projectRoot/src/test/kotlin")
                addDirectoryInput(inputs, "$projectRoot/src/test/scala")
                
                // Test resources
                addDirectoryInput(inputs, "$projectRoot/src/test/resources")
                
                // Main compiled classes (test compilation depends on main compilation)
                addDirectoryInput(inputs, "$projectRoot/target/classes")
                
                // Project configuration
                addInput(inputs, "$projectRoot/pom.xml")
                
                // Test dependencies
                addDependenciesInput(inputs, project.testArtifacts)
            }
            
            "test" -> {
                // Compiled test classes
                addDirectoryInput(inputs, "$projectRoot/target/test-classes")
                
                // Compiled main classes
                addDirectoryInput(inputs, "$projectRoot/target/classes")
                
                // Test resources (if not already compiled into test-classes)
                addDirectoryInput(inputs, "$projectRoot/src/test/resources")
                
                // Project configuration (for test configuration)
                addInput(inputs, "$projectRoot/pom.xml")
                
                // Runtime dependencies
                addDependenciesInput(inputs, project.testArtifacts)
            }
            
            "package" -> {
                // Compiled main classes
                addDirectoryInput(inputs, "$projectRoot/target/classes")
                
                // Resources (if not already in classes)
                addDirectoryInput(inputs, "$projectRoot/src/main/resources")
                
                // Project configuration (for packaging configuration)
                addInput(inputs, "$projectRoot/pom.xml")
                
                // Runtime dependencies (for packaging)
                addDependenciesInput(inputs, project.runtimeArtifacts)
            }
            
            "verify" -> {
                // Packaged artifacts
                addDirectoryInput(inputs, "$projectRoot/target")
                
                // Project configuration
                addInput(inputs, "$projectRoot/pom.xml")
                
                // Test results (if verification includes test results)
                addDirectoryInput(inputs, "$projectRoot/target/surefire-reports")
                addDirectoryInput(inputs, "$projectRoot/target/failsafe-reports")
            }
        }
        
        return inputs
    }
    
    private fun analyzeOutputs(phase: String, project: MavenProject): ArrayNode {
        val outputs = objectMapper.createArrayNode()
        
        when (phase.lowercase()) {
            "validate" -> {
                // Validation typically doesn't produce files, but may create reports
                addOutput(outputs, "{projectRoot}/target/validation-reports")
            }
            
            "compile" -> {
                addOutput(outputs, "{projectRoot}/target/classes")
                addOutput(outputs, "{projectRoot}/target/generated-sources")
            }
            
            "test-compile" -> {
                addOutput(outputs, "{projectRoot}/target/test-classes")
                addOutput(outputs, "{projectRoot}/target/generated-test-sources")
            }
            
            "test" -> {
                addOutput(outputs, "{projectRoot}/target/surefire-reports")
                addOutput(outputs, "{projectRoot}/target/test-results")
            }
            
            "package" -> {
                // Main artifact
                val packaging = project.packaging ?: "jar"
                addOutput(outputs, "{projectRoot}/target/${project.artifactId}-${project.version}.$packaging")
                
                // Additional artifacts
                addOutput(outputs, "{projectRoot}/target/classes")
                addOutput(outputs, "{projectRoot}/target/maven-archiver")
            }
            
            "verify" -> {
                addOutput(outputs, "{projectRoot}/target/failsafe-reports")
                addOutput(outputs, "{projectRoot}/target/verification-reports")
            }
        }
        
        return outputs
    }
    
    private fun getRelativeProjectRoot(project: MavenProject): String {
        val workspaceRootPath = Paths.get(workspaceRoot)
        val projectPath = project.basedir.toPath()
        val relativePath = workspaceRootPath.relativize(projectPath).toString().replace("\\\\", "/")
        return if (relativePath.isEmpty()) "." else relativePath
    }
    
    private fun addInput(inputs: ArrayNode, path: String) {
        inputs.add(path)
    }
    
    private fun addDirectoryInput(inputs: ArrayNode, directory: String) {
        // Check if directory exists before adding
        val fullPath = if (directory.startsWith(".")) {
            File(workspaceRoot, directory.substring(2))
        } else {
            File(workspaceRoot, directory)
        }
        
        if (fullPath.exists() && fullPath.isDirectory) {
            inputs.add("$directory/**/*")
        }
    }
    
    private fun addDependenciesInput(inputs: ArrayNode, artifacts: Collection<org.apache.maven.artifact.Artifact>) {
        // Add a synthetic input representing the dependency fingerprint
        if (artifacts.isNotEmpty()) {
            val dependencyFingerprint = artifacts
                .sortedBy { "${it.groupId}:${it.artifactId}:${it.version}" }
                .joinToString(";") { "${it.groupId}:${it.artifactId}:${it.version}" }
            
            val dependencyInput = objectMapper.createObjectNode()
            dependencyInput.put("type", "maven-dependencies")
            dependencyInput.put("fingerprint", dependencyFingerprint)
            inputs.add(dependencyInput)
        }
    }
    
    private fun addOutput(outputs: ArrayNode, path: String) {
        outputs.add(path)
    }
}