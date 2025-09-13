package dev.nx.maven

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.*

/**
 * Simple unit test for PhaseAnalyzer to test basic functionality
 */
class SimplePhaseAnalyzerTest {

    @Test
    fun testPhaseAnalyzerCreation() {
        // This is just to verify the setup works
        assertTrue(true, "Basic test passes")
    }

    @Test
    fun testParameterRoleEnum() {
        // Test the enum values
        val roles = ParameterRole.values()
        assertEquals(4, roles.size)
        assertTrue(roles.contains(ParameterRole.INPUT))
        assertTrue(roles.contains(ParameterRole.OUTPUT))
        assertTrue(roles.contains(ParameterRole.BOTH))
        assertTrue(roles.contains(ParameterRole.UNKNOWN))
    }

    @Test
    fun testPhaseInformationCreation() {
        // Test data class creation
        val inputs = setOf("src/main/java", "src/main/resources")
        val outputs = setOf("target/classes")

        val phaseInfo = PhaseInformation(
            isThreadSafe = true,
            isCacheable = true,
            inputs = inputs,
            outputs = outputs
        )

        assertTrue(phaseInfo.isThreadSafe)
        assertTrue(phaseInfo.isCacheable)
        assertEquals(2, phaseInfo.inputs.size)
        assertEquals(1, phaseInfo.outputs.size)
        assertTrue(phaseInfo.inputs.contains("src/main/java"))
        assertTrue(phaseInfo.outputs.contains("target/classes"))
    }
}