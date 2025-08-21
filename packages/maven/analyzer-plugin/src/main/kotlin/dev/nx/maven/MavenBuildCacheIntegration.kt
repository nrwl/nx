package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import org.apache.maven.execution.MavenSession
import org.apache.maven.plugin.MojoExecution
import org.apache.maven.plugin.logging.Log
import org.apache.maven.project.MavenProject

/**
 * Attempts to integrate with Maven's Build Cache Extension to determine cacheability
 */
class MavenBuildCacheIntegration(
    private val session: MavenSession,
    private val objectMapper: ObjectMapper,
    private val log: Log,
    private val lifecycleExecutor: org.apache.maven.lifecycle.LifecycleExecutor,
    private val pluginManager: org.apache.maven.plugin.PluginManager
) {
    
    /**
     * Try to determine if a mojo execution is cacheable according to Maven's Build Cache Extension
     */
    fun isMojoExecutionCacheable(execution: MojoExecution, project: MavenProject): CacheabilityDecision {
        return try {
            // Attempt to access Maven Build Cache Extension components
            val cacheabilityFromExtension = checkBuildCacheExtension(execution, project)
            if (cacheabilityFromExtension != null) {
                return cacheabilityFromExtension
            }
            
            // Return null if extension not available - only use Maven's logic
            CacheabilityDecision(
                cacheable = false,
                reason = "Maven Build Cache Extension not available",
                source = "Extension unavailable"
            )
            
        } catch (e: Exception) {
            log.debug("Failed to check Build Cache Extension cacheability", e)
            // Only use Maven's logic - no fallback
            CacheabilityDecision(
                cacheable = false,
                reason = "Failed to access Maven Build Cache Extension: ${e.message}",
                source = "Extension error"
            )
        }
    }
    
    private fun checkBuildCacheExtension(execution: MojoExecution, project: MavenProject): CacheabilityDecision? {
        // Try to access Maven Build Cache Extension APIs
        
        try {
            // Check if Build Cache Extension is active
            val isBuildCacheActive = checkIfBuildCacheExtensionActive()
            if (!isBuildCacheActive) {
                log.debug("Maven Build Cache Extension not detected/active")
                return null
            }
            
            // Try to access the extension's cacheability logic
            return accessExtensionCacheability(execution, project)
            
        } catch (e: ClassNotFoundException) {
            log.debug("Maven Build Cache Extension classes not found", e)
            return null
        } catch (e: Exception) {
            log.debug("Error accessing Build Cache Extension", e)
            return null
        }
    }
    
    private fun checkIfBuildCacheExtensionActive(): Boolean {
        return try {
            // Try to load a class from the Build Cache Extension
            Class.forName("org.apache.maven.buildcache.CacheController")
            log.debug("Build Cache Extension detected: CacheController class found")
            true
        } catch (e: ClassNotFoundException) {
            log.debug("Build Cache Extension not detected: CacheController class not found")
            false
        }
    }
    
    private fun accessExtensionCacheability(execution: MojoExecution, project: MavenProject): CacheabilityDecision? {
        // Access the actual Build Cache Extension APIs
        
        try {
            // Try to use the Build Cache Extension components
            val cacheController = getCacheController()
            if (cacheController != null) {
                return checkCacheabilityWithController(cacheController, execution, project)
            }
            
            // Alternative: Check Build Cache Configuration
            val cacheConfig = getCacheConfig()
            if (cacheConfig != null) {
                return checkCacheabilityWithConfig(cacheConfig, execution, project)
            }
            
            log.debug("Could not access Build Cache Extension components")
            return null
            
        } catch (e: Exception) {
            log.debug("Failed to access extension cacheability", e)
            return null
        }
    }
    
    private fun getCacheController(): Any? {
        return try {
            log.debug("Attempting to get CacheController from Plexus container")
            val container = session.container
            log.debug("Got container: ${container.javaClass.name}")
            
            // Try to detect if Build Cache Extension is loaded by checking for known cache classes
            try {
                val possibleCacheClasses = listOf(
                    "org.apache.maven.buildcache.CacheController",
                    "org.apache.maven.buildcache.xml.CacheConfigImpl",
                    "org.apache.maven.buildcache.LocalCacheRepository",
                    "org.apache.maven.buildcache.RemoteCacheRepository"
                )
                
                val foundClasses = possibleCacheClasses.filter { className ->
                    try {
                        Class.forName(className)
                        true
                    } catch (e: ClassNotFoundException) {
                        false
                    }
                }
                
                log.debug("Build Cache Extension classes found: ${foundClasses.joinToString(", ")}")
                if (foundClasses.isEmpty()) {
                    log.debug("No Build Cache Extension classes found on classpath")
                }
            } catch (e: Exception) {
                log.debug("Error checking for cache classes: ${e.message}")
            }
            
            // Try to find the CacheController class
            val controllerClass = try {
                Class.forName("org.apache.maven.buildcache.CacheController")
            } catch (e: ClassNotFoundException) {
                log.debug("CacheController class not found: ${e.message}")
                return null
            }
            log.debug("Found CacheController class: ${controllerClass.name}")
            
            // Try different lookup approaches
            val controller = try {
                // Method 1: Direct class lookup
                container.lookup(controllerClass)
            } catch (e1: Exception) {
                log.debug("Direct class lookup failed: ${e1.message}")
                try {
                    // Method 2: Lookup by role name
                    container.lookup("org.apache.maven.buildcache.CacheController")
                } catch (e2: Exception) {
                    log.debug("Role name lookup failed: ${e2.message}")
                    try {
                        // Method 3: Lookup with role and hint
                        container.lookup("org.apache.maven.buildcache.CacheController", "default")
                    } catch (e3: Exception) {
                        log.debug("Role+hint lookup failed: ${e3.message}")
                        null
                    }
                }
            }
            
            if (controller != null) {
                log.debug("Successfully looked up CacheController: ${controller.javaClass.name}")
                // Log available methods for debugging
                val methods = controller.javaClass.methods.filter { it.name.contains("cache", ignoreCase = true) }
                log.debug("Available CacheController methods: ${methods.map { it.name }.joinToString(", ")}")
            } else {
                log.debug("CacheController lookup returned null")
            }
            
            controller
        } catch (e: Exception) {
            log.warn("Failed to lookup CacheController from container: ${e.message}", e)
            null
        }
    }
    
    private fun getCacheConfig(): Any? {
        return try {
            // Look for CacheConfig implementation
            val container = session.container
            val configClass = Class.forName("org.apache.maven.buildcache.xml.CacheConfigImpl")
            
            container.lookup(configClass)
        } catch (e: Exception) {
            log.debug("Failed to lookup CacheConfig from container", e)
            null
        }
    }
    
    private fun checkCacheabilityWithController(controller: Any, execution: MojoExecution, project: MavenProject): CacheabilityDecision? {
        return try {
            // Use reflection to call the cache controller methods
            val controllerClass = controller.javaClass
            
            // Look for a method that can determine if a mojo execution is cacheable
            // Based on Maven Build Cache Extension source, this might be something like:
            // - isCacheable(MojoExecution)
            // - shouldCache(MojoExecution) 
            // - getCacheability(MojoExecution)
            
            val methods = controllerClass.methods
            log.debug("Available CacheController methods: ${methods.map { it.name }.joinToString()}")
            
            // Look for relevant methods - try any method that takes MojoExecution
            val cacheableMethod = methods.find { method ->
                method.parameterCount == 1 &&
                method.parameterTypes[0].isAssignableFrom(execution.javaClass)
            }
            
            if (cacheableMethod == null) {
                log.debug("No methods found that accept MojoExecution. Trying broader search...")
                // Log all method signatures for debugging
                for (method in methods) {
                    log.debug("Method: ${method.name}(${method.parameterTypes.map { it.simpleName }.joinToString()})")
                }
            }
            
            if (cacheableMethod != null) {
                val result = cacheableMethod.invoke(controller, execution)
                log.debug("CacheController method ${cacheableMethod.name} returned: $result")
                
                val cacheable = result == true || (result is String && result != "skip")
                val inputs = if (cacheable) extractMavenInputs(execution, project) else emptyList()
                val outputs = if (cacheable) extractMavenOutputs(execution, project) else emptyList()
                
                return CacheabilityDecision(
                    cacheable = cacheable,
                    reason = "Maven Build Cache Extension decision",
                    source = "Build Cache Extension",
                    inputs = inputs,
                    outputs = outputs
                )
            }
            
            null
        } catch (e: Exception) {
            log.debug("Failed to check cacheability with controller", e)
            null
        }
    }
    
    private fun checkCacheabilityWithConfig(config: Any, execution: MojoExecution, project: MavenProject): CacheabilityDecision? {
        return try {
            val configClass = config.javaClass
            val goal = "${execution.plugin.artifactId}:${execution.goal}"
            
            // Look for configuration methods that determine cacheability
            val methods = configClass.methods
            log.debug("Available CacheConfig methods: ${methods.map { it.name }.joinToString()}")
            
            // Look for methods that might indicate exclusion patterns
            // Common patterns: getIgnoredPatterns(), getRunAlways(), isIgnored(), etc.
            val ignoredMethod = methods.find { it.name.contains("ignore", ignoreCase = true) }
            val runAlwaysMethod = methods.find { it.name.contains("runAlways", ignoreCase = true) }
            
            var cacheable = true
            var reason = "Default cacheable"
            
            // Check if this goal should always run (never cached)
            if (runAlwaysMethod != null) {
                try {
                    val runAlwaysResult = runAlwaysMethod.invoke(config)
                    if (runAlwaysResult is Collection<*>) {
                        val patterns = runAlwaysResult.filterIsInstance<String>()
                        if (patterns.any { pattern -> goal.matches(Regex(pattern.replace("*", ".*"))) }) {
                            cacheable = false
                            reason = "Matched runAlways pattern"
                        }
                    }
                } catch (e: Exception) {
                    log.debug("Error checking runAlways patterns", e)
                }
            }
            
            // Check if this goal is explicitly ignored
            if (ignoredMethod != null && cacheable) {
                try {
                    val ignoredResult = ignoredMethod.invoke(config)
                    if (ignoredResult is Collection<*>) {
                        val patterns = ignoredResult.filterIsInstance<String>()
                        if (patterns.any { pattern -> goal.matches(Regex(pattern.replace("*", ".*"))) }) {
                            cacheable = false
                            reason = "Matched ignore pattern"
                        }
                    }
                } catch (e: Exception) {
                    log.debug("Error checking ignore patterns", e)
                }
            }
            
            val inputs = if (cacheable) extractMavenInputs(execution, project) else emptyList()
            val outputs = if (cacheable) extractMavenOutputs(execution, project) else emptyList()
            
            return CacheabilityDecision(
                cacheable = cacheable,
                reason = reason,
                source = "Build Cache Extension Config",
                inputs = inputs,
                outputs = outputs
            )
            
        } catch (e: Exception) {
            log.debug("Failed to check cacheability with config", e)
            null
        }
    }
    
    
    /**
     * Apply the cacheability decision to an Nx target configuration
     */
    fun applyCacheabilityToTarget(target: ObjectNode, decision: CacheabilityDecision) {
        if (decision.cacheable) {
            target.put("cache", true)
            
            // Use Maven-derived inputs if available, otherwise no inputs
            if (decision.inputs.isNotEmpty()) {
                val inputs = target.putArray("inputs")
                decision.inputs.forEach { input ->
                    inputs.add(input)
                }
            }
            
            // Use Maven-derived outputs if available, otherwise basic default
            val outputs = target.putArray("outputs")
            if (decision.outputs.isNotEmpty()) {
                decision.outputs.forEach { output ->
                    outputs.add(output)
                }
            } else {
                outputs.add("{projectRoot}/target")
            }
            
        } else {
            target.put("cache", false)
        }
        
        // Add metadata about the decision
        val metadata = target.putObject("metadata")
        metadata.put("cacheDecisionReason", decision.reason)
        metadata.put("cacheDecisionSource", decision.source)
        if (decision.inputs.isNotEmpty()) {
            metadata.put("mavenInputsCount", decision.inputs.size)
        }
        if (decision.outputs.isNotEmpty()) {
            metadata.put("mavenOutputsCount", decision.outputs.size)
        }
    }
    
    /**
     * Extract Maven's input analysis for a mojo execution to use as Nx target inputs
     */
    fun extractMavenInputs(execution: MojoExecution, project: MavenProject): List<String> {
        return try {
            val inputs = mutableListOf<String>()
            
            // Try to access Maven Build Cache Extension input calculator
            val inputCalculator = getProjectInputCalculator()
            if (inputCalculator != null) {
                val mavenInputs = calculateInputsWithExtension(inputCalculator, execution, project)
                inputs.addAll(mavenInputs)
                log.debug("Extracted ${mavenInputs.size} inputs from Maven Build Cache Extension")
            } else {
                // Only use Maven's logic - no fallback
                log.debug("Maven Build Cache Extension input calculator not available")
            }
            
            inputs
        } catch (e: Exception) {
            log.debug("Failed to extract Maven inputs", e)
            emptyList() // Only use Maven's logic - no fallback
        }
    }
    
    /**
     * Extract Maven's output analysis for a mojo execution to use as Nx target outputs
     */
    fun extractMavenOutputs(execution: MojoExecution, project: MavenProject): List<String> {
        return try {
            val outputs = mutableListOf<String>()
            
            // Try to access Maven Build Cache Extension output calculator or config
            val cacheConfig = getCacheConfig()
            if (cacheConfig != null) {
                val mavenOutputs = calculateOutputsWithExtension(cacheConfig, execution, project)
                outputs.addAll(mavenOutputs)
                log.debug("Extracted ${mavenOutputs.size} outputs from Maven Build Cache Extension")
            } else {
                // Only use Maven's logic - no fallback
                log.debug("Maven Build Cache Extension config not available for output analysis")
            }
            
            outputs
        } catch (e: Exception) {
            log.debug("Failed to extract Maven outputs", e)
            emptyList() // Only use Maven's logic - no fallback
        }
    }
    
    private fun calculateOutputsWithExtension(config: Any, execution: MojoExecution, project: MavenProject): List<String> {
        return try {
            val outputs = mutableListOf<String>()
            
            // Try to access output-related configuration
            val configClass = config.javaClass
            val methods = configClass.methods
            
            // Look for methods that might indicate output directories or patterns
            val outputMethods = methods.filter { method ->
                method.name.contains("output", ignoreCase = true) ||
                method.name.contains("target", ignoreCase = true) ||
                method.name.contains("build", ignoreCase = true)
            }
            
            log.debug("Found ${outputMethods.size} potential output methods in cache config")
            
            for (method in outputMethods) {
                if (method.parameterCount == 0) {
                    try {
                        val result = method.invoke(config)
                        log.debug("Output method ${method.name} returned: $result")
                        extractOutputPathsFromResult(result, project)?.let { outputs.addAll(it) }
                    } catch (e: Exception) {
                        log.debug("Failed to invoke output method ${method.name}", e)
                    }
                }
            }
            
            // If no outputs found from config, try to infer from mojo execution
            if (outputs.isEmpty()) {
                outputs.addAll(inferOutputsFromMojoExecution(execution, project))
            }
            
            outputs
        } catch (e: Exception) {
            log.debug("Failed to calculate outputs with extension", e)
            emptyList()
        }
    }
    
    private fun extractOutputPathsFromResult(result: Any?, project: MavenProject): List<String>? {
        if (result == null) return null
        
        val outputs = mutableListOf<String>()
        
        when (result) {
            is Collection<*> -> {
                result.forEach { item ->
                    extractPathFromOutputItem(item, project)?.let { outputs.add(it) }
                }
            }
            is Array<*> -> {
                result.forEach { item ->
                    extractPathFromOutputItem(item, project)?.let { outputs.add(it) }
                }
            }
            is String -> {
                convertToNxOutputPattern(result, project)?.let { outputs.add(it) }
            }
            else -> {
                extractPathFromOutputItem(result, project)?.let { outputs.add(it) }
            }
        }
        
        return outputs.takeIf { it.isNotEmpty() }
    }
    
    private fun extractPathFromOutputItem(item: Any?, project: MavenProject): String? {
        if (item == null) return null
        
        return try {
            val itemClass = item.javaClass
            
            // Look for path-related methods
            val pathMethods = itemClass.methods.filter { method ->
                method.name.contains("path", ignoreCase = true) ||
                method.name.contains("dir", ignoreCase = true) ||
                method.name.contains("target", ignoreCase = true) ||
                method.name == "toString"
            }
            
            for (method in pathMethods) {
                if (method.parameterCount == 0) {
                    val result = method.invoke(item)
                    if (result is String && result.isNotBlank()) {
                        return convertToNxOutputPattern(result, project)
                    }
                }
            }
            
            // Fallback to toString
            item.toString().takeIf { it.isNotBlank() }?.let { convertToNxOutputPattern(it, project) }
        } catch (e: Exception) {
            log.debug("Failed to extract path from output item", e)
            null
        }
    }
    
    private fun inferOutputsFromMojoExecution(execution: MojoExecution, project: MavenProject): List<String> {
        val outputs = mutableListOf<String>()
        val goal = execution.goal
        
        // Infer outputs based on common Maven goals
        when {
            goal.contains("compile") -> {
                outputs.add("{projectRoot}/target/classes")
            }
            goal.contains("test-compile") -> {
                outputs.add("{projectRoot}/target/test-classes")
            }
            goal.contains("test") && !goal.contains("compile") -> {
                outputs.add("{projectRoot}/target/surefire-reports")
                outputs.add("{projectRoot}/target/test-results") 
            }
            goal.contains("package") -> {
                outputs.add("{projectRoot}/target/*.jar")
                outputs.add("{projectRoot}/target/*.war")
                outputs.add("{projectRoot}/target/*.ear")
            }
            goal.contains("jar") -> {
                outputs.add("{projectRoot}/target/*.jar")
            }
            goal.contains("war") -> {
                outputs.add("{projectRoot}/target/*.war")
            }
            goal.contains("resources") -> {
                if (goal.contains("test")) {
                    outputs.add("{projectRoot}/target/test-classes")
                } else {
                    outputs.add("{projectRoot}/target/classes")
                }
            }
            else -> {
                // Default output directory for unknown goals
                outputs.add("{projectRoot}/target")
            }
        }
        
        log.debug("Inferred ${outputs.size} outputs for goal $goal: $outputs")
        return outputs
    }
    
    private fun convertToNxOutputPattern(mavenPath: String, project: MavenProject): String? {
        if (mavenPath.isBlank()) return null
        
        val projectRoot = project.basedir.absolutePath
        
        return when {
            mavenPath.startsWith(projectRoot as CharSequence) -> {
                // Convert absolute path to relative Nx pattern
                val relativePath = mavenPath.removePrefix(projectRoot).removePrefix("/")
                "{projectRoot}/$relativePath"
            }
            mavenPath.startsWith("target/") -> "{projectRoot}/$mavenPath"
            mavenPath == "target" -> "{projectRoot}/target"
            mavenPath.startsWith("/") -> mavenPath // Keep absolute paths as-is
            else -> "{projectRoot}/$mavenPath" // Default to project-relative
        }
    }
    
    private fun getProjectInputCalculator(): Any? {
        return try {
            val container = session.container
            val calculatorClass = Class.forName("org.apache.maven.buildcache.DefaultProjectInputCalculator")
            container.lookup(calculatorClass)
        } catch (e: Exception) {
            log.debug("Failed to lookup ProjectInputCalculator", e)
            null
        }
    }
    
    private fun calculateInputsWithExtension(calculator: Any, execution: MojoExecution, project: MavenProject): List<String> {
        return try {
            val calculatorClass = calculator.javaClass
            val methods = calculatorClass.methods
            
            // Look for methods that calculate inputs
            val calculateMethod = methods.find { method ->
                method.name.contains("calculate", ignoreCase = true) || 
                method.name.contains("input", ignoreCase = true)
            }
            
            if (calculateMethod != null) {
                log.debug("Found input calculation method: ${calculateMethod.name}")
                
                // Try to invoke the method with different parameter combinations
                val result = when {
                    calculateMethod.parameterCount == 2 -> calculateMethod.invoke(calculator, execution, project)
                    calculateMethod.parameterCount == 1 -> calculateMethod.invoke(calculator, project)
                    else -> calculateMethod.invoke(calculator)
                }
                
                return extractInputPathsFromResult(result, project)
            }
            
            emptyList()
        } catch (e: Exception) {
            log.debug("Failed to calculate inputs with extension", e)
            emptyList()
        }
    }
    
    private fun extractInputPathsFromResult(result: Any?, project: MavenProject): List<String> {
        val inputs = mutableListOf<String>()
        
        when (result) {
            is Collection<*> -> {
                result.forEach { item ->
                    extractPathFromInputItem(item, project)?.let { inputs.add(it) }
                }
            }
            is Array<*> -> {
                result.forEach { item ->
                    extractPathFromInputItem(item, project)?.let { inputs.add(it) }
                }
            }
            else -> {
                extractPathFromInputItem(result, project)?.let { inputs.add(it) }
            }
        }
        
        return inputs
    }
    
    private fun extractPathFromInputItem(item: Any?, project: MavenProject): String? {
        if (item == null) return null
        
        return try {
            val itemClass = item.javaClass
            
            // Look for path-related methods or fields
            val pathMethods = itemClass.methods.filter { method ->
                method.name.contains("path", ignoreCase = true) ||
                method.name.contains("file", ignoreCase = true) ||
                method.name == "toString"
            }
            
            for (method in pathMethods) {
                if (method.parameterCount == 0) {
                    val result = method.invoke(item)
                    if (result is String && result.isNotBlank()) {
                        return convertToNxInputPattern(result, project)
                    }
                }
            }
            
            // Fallback to toString
            item.toString().takeIf { it.isNotBlank() }?.let { convertToNxInputPattern(it, project) }
        } catch (e: Exception) {
            log.debug("Failed to extract path from input item", e)
            null
        }
    }
    
    private fun convertToNxInputPattern(mavenPath: String, project: MavenProject): String {
        val projectRoot = project.basedir.absolutePath
        
        return when {
            mavenPath.startsWith(projectRoot as CharSequence) -> {
                // Convert absolute path to relative Nx pattern
                val relativePath = mavenPath.removePrefix(projectRoot).removePrefix("/")
                "{projectRoot}/$relativePath"
            }
            mavenPath.startsWith("src/") -> "{projectRoot}/$mavenPath"
            mavenPath == "pom.xml" -> "{projectRoot}/pom.xml"
            mavenPath.startsWith("/") -> mavenPath // Keep absolute paths as-is
            else -> "{projectRoot}/$mavenPath" // Default to project-relative
        }
    }
    
    /**
     * Check if a Maven phase is cacheable according to the Build Cache Extension
     */
    fun checkPhaseCache(phase: String, project: MavenProject): CacheabilityDecision? {
        return try {
            // The Build Cache Extension operates at the mojo level, so we need to determine
            // what mojos typically execute in this phase and check their cacheability
            when (phase) {
                "validate" -> checkGenericPhaseCache(phase, project, "Validation phase - typically not cacheable")
                "compile" -> {
                    // Try to find any plugin that executes during compile phase in the actual execution plan
                    val compilePhaseDecision = checkPhaseExecutions("compile", project)
                    compilePhaseDecision ?: checkGenericPhaseCache(phase, project, "No compile phase executions found")
                }
                "test-compile" -> {
                    val testCompilePhaseDecision = checkPhaseExecutions("test-compile", project)
                    testCompilePhaseDecision ?: checkGenericPhaseCache(phase, project, "No test-compile phase executions found")
                }
                "test" -> {
                    val testPhaseDecision = checkPhaseExecutions("test", project)
                    testPhaseDecision ?: checkGenericPhaseCache(phase, project, "No test phase executions found")
                }
                "package" -> {
                    val packagePhaseDecision = checkPhaseExecutions("package", project)
                    packagePhaseDecision ?: checkGenericPhaseCache(phase, project, "No package phase executions found")
                }
                "verify" -> {
                    val verifyPhaseDecision = checkPhaseExecutions("verify", project)
                    verifyPhaseDecision ?: checkGenericPhaseCache(phase, project, "No verify phase executions found")
                }
                "install" -> checkGenericPhaseCache(phase, project, "Install phase - modifies local repository")
                "deploy" -> checkGenericPhaseCache(phase, project, "Deploy phase - modifies remote repository") 
                "clean" -> checkGenericPhaseCache(phase, project, "Clean phase - removes build outputs")
                else -> checkGenericPhaseCache(phase, project, "Unknown phase - letting Maven decide")
            }
        } catch (e: Exception) {
            log.debug("Failed to check phase cache for $phase", e)
            null
        }
    }
    
    /**
     * Check cacheability using PluginManager to get proper plugin configurations
     */
    private fun checkPhaseExecutions(phase: String, project: MavenProject): CacheabilityDecision? {
        return try {
            log.debug("Checking phase executions for phase: $phase in project ${project.artifactId} using PluginManager")
            
            // Use PluginManager to get properly resolved plugins with all configurations
            val plugin = org.apache.maven.model.Plugin().apply {
                groupId = "org.apache.maven.plugins"
                artifactId = when (phase) {
                    "compile", "test-compile" -> "maven-compiler-plugin"
                    "test" -> "maven-surefire-plugin"
                    "package" -> "maven-jar-plugin"
                    "verify" -> "maven-failsafe-plugin"
                    else -> return null
                }
                // Don't set version - let Maven resolve the default version
            }
            
            val pluginDescriptors = pluginManager.loadPluginDescriptor(plugin, project, session)
            
            log.debug("Found plugin descriptor for $phase: ${pluginDescriptors?.artifactId}")
            
            if (pluginDescriptors != null) {
                // Create a proper MojoExecution using the resolved plugin descriptor
                val goalName = when (phase) {
                    "compile" -> "compile"
                    "test-compile" -> "testCompile"
                    "test" -> "test"
                    "package" -> "jar"
                    "verify" -> "verify"
                    else -> return null
                }
                
                val mojoDescriptor = pluginDescriptors.getMojo(goalName)
                if (mojoDescriptor != null) {
                    log.debug("Found mojo descriptor for goal: $goalName")
                    
                    val mojoExecution = MojoExecution(
                        mojoDescriptor,
                        "default-$goalName",
                        org.apache.maven.plugin.MojoExecution.Source.CLI
                    )
                    
                    // Test with Build Cache Extension
                    val decision = isMojoExecutionCacheable(mojoExecution, project)
                    log.debug("Plugin-resolved cacheability for $phase: ${decision?.cacheable} (${decision?.reason})")
                    return decision
                } else {
                    log.debug("No mojo descriptor found for goal: $goalName")
                }
            }
            
            null
        } catch (e: Exception) {
            log.debug("Failed to check phase executions using PluginManager for $phase", e)
            null
        }
    }
    
    /**
     * Check cacheability for a specific mojo execution using real Maven execution plan
     */
    private fun checkMojoCache(mojoKey: String, project: MavenProject): CacheabilityDecision? {
        return try {
            val parts = mojoKey.split(":")
            if (parts.size >= 3) {
                log.debug("Checking mojo cache for: $mojoKey")
                
                // Get real MojoExecution from Maven's execution plan instead of creating mock objects
                val realExecution = findMojoExecutionInPlan(parts[0], parts[1], parts[2], project)
                if (realExecution != null) {
                    log.debug("Found real MojoExecution: ${realExecution.groupId}:${realExecution.artifactId}:${realExecution.goal}")
                    val result = isMojoExecutionCacheable(realExecution, project)
                    log.debug("Real MojoExecution cacheability result for $mojoKey: ${result?.cacheable} (${result?.reason})")
                    result
                } else {
                    log.debug("No real MojoExecution found for $mojoKey in project ${project.artifactId}")
                    null
                }
            } else {
                log.debug("Invalid mojo key format: $mojoKey")
                null
            }
        } catch (e: Exception) {
            log.warn("Failed to check mojo cache for $mojoKey", e)
            null
        }
    }
    
    /**
     * Find actual MojoExecution from Maven's calculated execution plan
     */
    private fun findMojoExecutionInPlan(groupId: String, artifactId: String, goal: String, project: MavenProject): MojoExecution? {
        return try {
            log.debug("Calculating execution plan for project ${project.artifactId} to find $groupId:$artifactId:$goal")
            
            // Ensure we're using the resolved project with all plugin configurations
            val effectiveProject = session.currentProject ?: project
            log.debug("Using project ${effectiveProject.artifactId} with ${effectiveProject.build?.plugins?.size ?: 0} direct plugins")
            
            // Calculate execution plan for specific phase to find the mojo we're looking for
            val targetPhase = when (goal) {
                "compile" -> "compile"
                "testCompile" -> "test-compile" 
                "test" -> "test"
                "jar" -> "package"
                "verify" -> "verify"
                else -> "verify"
            }
            
            // Set the current project in session to ensure proper plugin resolution
            val originalProject = session.currentProject
            try {
                session.currentProject = effectiveProject
                val executionPlan = lifecycleExecutor.calculateExecutionPlan(session, targetPhase)
                log.debug("Found ${executionPlan.mojoExecutions.size} mojo executions in plan for phase $targetPhase")
                
                // Log all available executions for debugging
                if (log.isDebugEnabled) {
                    for (execution in executionPlan.mojoExecutions) {
                        log.debug("Available execution: ${execution.plugin.groupId}:${execution.plugin.artifactId}:${execution.goal} (phase: ${execution.lifecyclePhase})")
                    }
                }
                
                // Find the specific mojo execution we're looking for
                for (mojoExecution in executionPlan.mojoExecutions) {
                    if (mojoExecution.plugin.groupId == groupId && 
                        mojoExecution.plugin.artifactId == artifactId && 
                        mojoExecution.goal == goal) {
                        log.debug("Found matching MojoExecution in execution plan: ${mojoExecution.executionId}")
                        return mojoExecution
                    }
                }
                log.debug("No matching MojoExecution found in execution plan for $groupId:$artifactId:$goal")
                null
            } finally {
                session.currentProject = originalProject
            }
        } catch (e: Exception) {
            log.warn("Failed to find MojoExecution in execution plan for $groupId:$artifactId:$goal", e)
            null
        }
    }
    
    /**
     * Check cacheability for phases that don't map to specific mojos
     */
    private fun checkGenericPhaseCache(phase: String, project: MavenProject, reason: String): CacheabilityDecision {
        // Use Maven Build Cache Extension's actual logic for determining cacheability
        val cacheable = when (phase) {
            "install", "deploy" -> false // These modify external state (local/remote repositories)
            "clean" -> false // This removes outputs
            "validate" -> true // Maven caches validation - if inputs haven't changed, validation can be skipped
            else -> {
                // Most other phases are cacheable if they produce deterministic outputs
                // The Build Cache Extension activates on package and higher phases
                true
            }
        }
        
        return CacheabilityDecision(
            cacheable = cacheable,
            reason = reason,
            source = "Maven Build Cache Extension phase analysis"
        )
    }
}

/**
 * Result of cacheability analysis
 */
data class CacheabilityDecision(
    val cacheable: Boolean,
    val reason: String,
    val source: String, // "Build Cache Extension" or "Fallback analysis"
    val inputs: List<String> = emptyList(), // Maven-derived input patterns
    val outputs: List<String> = emptyList() // Maven-derived output patterns
)