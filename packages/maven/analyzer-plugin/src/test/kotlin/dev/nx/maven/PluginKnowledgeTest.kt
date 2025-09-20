package dev.nx.maven

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.*

/**
 * Test for PluginKnowledge functionality using Maven build cache extension format.
 */
class PluginKnowledgeTest {

    @Test
    fun testKnownPluginParameterRole() {
        val knowledge = PluginKnowledge()

        // Test maven-compiler-plugin parameters
        val inputRole = knowledge.getParameterRole("maven-compiler-plugin", "default-compile", "compileSourceRoots")
        assertEquals(ParameterRole.INPUT, inputRole, "compileSourceRoots should be INPUT for maven-compiler-plugin")

        val outputRole = knowledge.getParameterRole("maven-compiler-plugin", "default-compile", "outputDirectory")
        assertEquals(ParameterRole.OUTPUT, outputRole, "outputDirectory should be OUTPUT for maven-compiler-plugin")

        // Test maven-surefire-plugin parameters
        val testInputRole = knowledge.getParameterRole("maven-surefire-plugin", "default-test", "testClassesDirectory")
        assertEquals(ParameterRole.INPUT, testInputRole, "testClassesDirectory should be INPUT for maven-surefire-plugin")

        val testOutputRole = knowledge.getParameterRole("maven-surefire-plugin", "default-test", "reportsDirectory")
        assertEquals(ParameterRole.OUTPUT, testOutputRole, "reportsDirectory should be OUTPUT for maven-surefire-plugin")
    }

    @Test
    fun testUnknownPluginParameterRole() {
        val knowledge = PluginKnowledge()

        // Test unknown plugin
        val unknownPluginRole = knowledge.getParameterRole("unknown-plugin", "default-compile", "someParameter")
        assertNull(unknownPluginRole, "Unknown plugin should return null")

        // Test unknown parameter for known plugin
        val unknownParamRole = knowledge.getParameterRole("maven-compiler-plugin", "default-compile", "unknownParameter")
        assertNull(unknownParamRole, "Unknown parameter should return null")
    }

    @Test
    fun testPluginKnowledge() {
        val knowledge = PluginKnowledge()

        // Test known plugin
        assertTrue(knowledge.isKnownPlugin("maven-compiler-plugin"), "maven-compiler-plugin should be known")
        assertTrue(knowledge.isKnownPlugin("maven-surefire-plugin"), "maven-surefire-plugin should be known")
        assertTrue(knowledge.isKnownPlugin("maven-resources-plugin"), "maven-resources-plugin should be known")

        // Test unknown plugin
        assertFalse(knowledge.isKnownPlugin("unknown-plugin"), "unknown-plugin should not be known")

        // Test known execution (should always return true for known plugins in this approach)
        assertTrue(knowledge.isKnownExecution("maven-compiler-plugin", "default-compile"), "any execution should be known for known plugins")
        assertTrue(knowledge.isKnownExecution("maven-surefire-plugin", "default-test"), "any execution should be known for known plugins")

        // Test unknown execution for unknown plugin
        assertFalse(knowledge.isKnownExecution("unknown-plugin", "unknown-execution"), "unknown-plugin should not have known executions")
    }

    @Test
    fun testTagScanConfigurations() {
        val knowledge = PluginKnowledge()

        // Test input tag scans for maven-compiler-plugin
        val inputTagScans = knowledge.getKnownInputTagScans("maven-compiler-plugin")
        assertFalse(inputTagScans.isEmpty(), "maven-compiler-plugin should have input tag scans")

        val compileSourceRootsScan = inputTagScans.find { it.tagName == "compileSourceRoots" }
        assertNotNull(compileSourceRootsScan, "Should have a tag scan for compileSourceRoots")
        assertEquals("**/*.java", compileSourceRootsScan?.glob, "compileSourceRoots should scan Java files")
        assertTrue(compileSourceRootsScan?.isRecursive == true, "compileSourceRoots scan should be recursive")

        // Test output tag excludes for maven-compiler-plugin
        val outputTagExcludes = knowledge.getKnownOutputTagExcludes("maven-compiler-plugin")
        assertFalse(outputTagExcludes.isEmpty(), "maven-compiler-plugin should have output tag excludes")

        val outputDirExclude = outputTagExcludes.find { it.tagName == "outputDirectory" }
        assertNotNull(outputDirExclude, "Should exclude outputDirectory tag")
    }

    @Test
    fun testDirScanConfig() {
        val knowledge = PluginKnowledge()

        // Test directory scan configuration for maven-compiler-plugin
        val dirScan = knowledge.getDirScanConfig("maven-compiler-plugin")
        assertNotNull(dirScan, "maven-compiler-plugin should have directory scan configuration")
        assertEquals("auto", dirScan?.mode, "Directory scan mode should be auto")

        // Test unknown plugin
        val unknownDirScan = knowledge.getDirScanConfig("unknown-plugin")
        assertNull(unknownDirScan, "Unknown plugin should not have directory scan configuration")
    }

    @Test
    fun testGlobalConfiguration() {
        val knowledge = PluginKnowledge()

        // Test global includes
        val globalIncludes = knowledge.getGlobalIncludes()
        assertFalse(globalIncludes.isEmpty(), "Should have global include patterns")

        val pomInclude = globalIncludes.find { it.value?.contains("pom.xml") == true }
        assertNotNull(pomInclude, "Should include pom.xml globally")

        // Test global excludes
        val globalExcludes = knowledge.getGlobalExcludes()
        assertFalse(globalExcludes.isEmpty(), "Should have global exclude patterns")

        val tmpExclude = globalExcludes.find { it.glob?.contains("**/*.tmp") == true }
        assertNotNull(tmpExclude, "Should exclude tmp files globally")
    }

    @Test
    fun testExecutionControl() {
        val knowledge = PluginKnowledge()

        // Test plugins that should always run
        assertTrue(knowledge.shouldAlwaysRun("maven-deploy-plugin"), "maven-deploy-plugin should always run")
        assertTrue(knowledge.shouldAlwaysRun("maven-install-plugin"), "maven-install-plugin should always run")
        assertFalse(knowledge.shouldAlwaysRun("maven-compiler-plugin"), "maven-compiler-plugin should not always run")

    }

    @Test
    fun testOutputExclusionPatterns() {
        val knowledge = PluginKnowledge()

        val outputExclusions = knowledge.getOutputExclusionPatterns()
        assertFalse(outputExclusions.isEmpty(), "Should have output exclusion patterns")

        assertTrue(outputExclusions.contains("**/*.tmp"), "Should exclude tmp files from output")
        assertTrue(outputExclusions.contains("**/*.log"), "Should exclude log files from output")
        assertTrue(outputExclusions.contains("**/maven-archiver/**"), "Should exclude maven-archiver from output")
    }

    @Test
    fun testNullSafety() {
        val knowledge = PluginKnowledge()

        // Test null parameters
        assertNull(knowledge.getParameterRole(null, "default-compile", "source"))
        assertNull(knowledge.getParameterRole("maven-compiler-plugin", "default-compile", null))
        assertFalse(knowledge.isKnownPlugin(null))

        // Test empty lists for null parameters
        assertTrue(knowledge.getKnownInputTagScans(null).isEmpty())
        assertTrue(knowledge.getKnownOutputTagExcludes(null).isEmpty())
        assertNull(knowledge.getDirScanConfig(null))
        assertFalse(knowledge.shouldAlwaysRun(null))
    }
}