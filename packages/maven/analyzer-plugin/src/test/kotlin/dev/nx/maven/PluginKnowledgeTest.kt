package dev.nx.maven

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.*

/**
 * Test for PluginKnowledge functionality.
 */
class PluginKnowledgeTest {

    @Test
    fun testKnownPluginParameterRole() {
        val knowledge = PluginKnowledge.getInstance()

        // Test maven-compiler-plugin compile goal
        val inputRole = knowledge.getParameterRole("maven-compiler-plugin", "compile", "sourceDirectory")
        assertEquals(ParameterRole.INPUT, inputRole, "sourceDirectory should be INPUT for maven-compiler-plugin:compile")

        val outputRole = knowledge.getParameterRole("maven-compiler-plugin", "compile", "outputDirectory")
        assertEquals(ParameterRole.OUTPUT, outputRole, "outputDirectory should be OUTPUT for maven-compiler-plugin:compile")

        // Test maven-surefire-plugin test goal
        val testInputRole = knowledge.getParameterRole("maven-surefire-plugin", "test", "testClasspath")
        assertEquals(ParameterRole.INPUT, testInputRole, "testClasspath should be INPUT for maven-surefire-plugin:test")

        val testOutputRole = knowledge.getParameterRole("maven-surefire-plugin", "test", "reportsDirectory")
        assertEquals(ParameterRole.OUTPUT, testOutputRole, "reportsDirectory should be OUTPUT for maven-surefire-plugin:test")
    }

    @Test
    fun testUnknownPluginParameterRole() {
        val knowledge = PluginKnowledge.getInstance()

        // Test unknown plugin
        val unknownPluginRole = knowledge.getParameterRole("unknown-plugin", "compile", "sourceDirectory")
        assertNull(unknownPluginRole, "Unknown plugin should return null")

        // Test unknown goal for known plugin
        val unknownGoalRole = knowledge.getParameterRole("maven-compiler-plugin", "unknown-goal", "sourceDirectory")
        assertNull(unknownGoalRole, "Unknown goal should return null")

        // Test unknown parameter for known plugin and goal
        val unknownParamRole = knowledge.getParameterRole("maven-compiler-plugin", "compile", "unknownParameter")
        assertNull(unknownParamRole, "Unknown parameter should return null")
    }

    @Test
    fun testPluginKnowledge() {
        val knowledge = PluginKnowledge.getInstance()

        // Test known plugin
        assertTrue(knowledge.isKnownPlugin("maven-compiler-plugin"), "maven-compiler-plugin should be known")
        assertTrue(knowledge.isKnownPlugin("maven-surefire-plugin"), "maven-surefire-plugin should be known")

        // Test unknown plugin
        assertFalse(knowledge.isKnownPlugin("unknown-plugin"), "unknown-plugin should not be known")

        // Test known goal
        assertTrue(knowledge.isKnownGoal("maven-compiler-plugin", "compile"), "compile goal should be known for maven-compiler-plugin")
        assertTrue(knowledge.isKnownGoal("maven-surefire-plugin", "test"), "test goal should be known for maven-surefire-plugin")

        // Test unknown goal
        assertFalse(knowledge.isKnownGoal("maven-compiler-plugin", "unknown-goal"), "unknown-goal should not be known")
    }

    @Test
    fun testGetKnownParameters() {
        val knowledge = PluginKnowledge.getInstance()

        // Test input parameters
        val inputParams = knowledge.getKnownInputParameters("maven-compiler-plugin", "compile")
        assertTrue(inputParams.contains("sourceDirectory"), "sourceDirectory should be in input parameters")
        assertTrue(inputParams.contains("compileSourceRoots"), "compileSourceRoots should be in input parameters")
        assertFalse(inputParams.contains("outputDirectory"), "outputDirectory should not be in input parameters")

        // Test output parameters
        val outputParams = knowledge.getKnownOutputParameters("maven-compiler-plugin", "compile")
        assertTrue(outputParams.contains("outputDirectory"), "outputDirectory should be in output parameters")
        assertFalse(outputParams.contains("sourceDirectory"), "sourceDirectory should not be in output parameters")
    }

    @Test
    fun testNullSafety() {
        val knowledge = PluginKnowledge.getInstance()

        // Test null parameters
        assertNull(knowledge.getParameterRole(null, "compile", "sourceDirectory"))
        assertNull(knowledge.getParameterRole("maven-compiler-plugin", null, "sourceDirectory"))
        assertNull(knowledge.getParameterRole("maven-compiler-plugin", "compile", null))

        // Test empty parameters
        assertTrue(knowledge.getKnownInputParameters(null, "compile").isEmpty())
        assertTrue(knowledge.getKnownInputParameters("maven-compiler-plugin", null).isEmpty())
        assertTrue(knowledge.getKnownOutputParameters(null, "compile").isEmpty())
        assertTrue(knowledge.getKnownOutputParameters("maven-compiler-plugin", null).isEmpty())
    }
}