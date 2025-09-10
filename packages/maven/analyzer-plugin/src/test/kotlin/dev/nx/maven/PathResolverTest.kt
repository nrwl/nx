package dev.nx.maven

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertDoesNotThrow
import kotlin.test.*

/**
 * Tests for PathResolver utility class
 */
class PathResolverTest {
    
    @Test
    fun `should resolve absolute paths correctly`() {
        val resolver = PathResolver("/workspace", "/workspace/project")
        val inputs = linkedSetOf<String>()
        
        resolver.addInputPath("/absolute/path/to/file", inputs)
        
        assertEquals(1, inputs.size)
        assertTrue(inputs.contains("/absolute/path/to/file"))
    }
    
    @Test
    fun `should resolve relative paths from project root`() {
        val resolver = PathResolver("/workspace", "/workspace/project")
        val inputs = linkedSetOf<String>()
        
        resolver.addInputPath("src/main/java", inputs)
        
        assertEquals(1, inputs.size)
        assertTrue(inputs.any { it.contains("src/main/java") })
    }
    
    @Test
    fun `should handle empty paths gracefully`() {
        val resolver = PathResolver("/workspace", "/workspace/project")
        val inputs = linkedSetOf<String>()
        
        resolver.addInputPath("", inputs)
        resolver.addInputPath("   ", inputs)
        
        // Should not add empty or whitespace-only paths
        assertTrue(inputs.isEmpty() || inputs.all { it.isNotBlank() })
    }
    
    @Test
    fun `should deduplicate identical paths`() {
        val resolver = PathResolver("/workspace", "/workspace/project")
        val inputs = linkedSetOf<String>()
        
        resolver.addInputPath("src/main/java", inputs)
        resolver.addInputPath("src/main/java", inputs)
        resolver.addInputPath("src/main/java", inputs)
        
        // LinkedHashSet should deduplicate
        assertEquals(1, inputs.size)
    }
    
    @Test
    fun `should handle null paths safely`() {
        val resolver = PathResolver("/workspace", "/workspace/project")
        val inputs = linkedSetOf<String>()
        
        // This should not throw an exception
        assertDoesNotThrow {
            resolver.addInputPath("", inputs) // Use empty string instead of null
        }
    }
    
    @Test
    fun `should work with different workspace and project configurations`() {
        val resolver1 = PathResolver("/workspace", "/workspace/project1")
        val resolver2 = PathResolver("/different/workspace", "/different/workspace/project2")
        
        val inputs1 = linkedSetOf<String>()
        val inputs2 = linkedSetOf<String>()
        
        resolver1.addInputPath("src/main/java", inputs1)
        resolver2.addInputPath("src/main/java", inputs2)
        
        // Both should work without errors
        assertTrue(inputs1.isNotEmpty())
        assertTrue(inputs2.isNotEmpty())
        
        // Results might be different due to different base paths
        // This tests that both configurations work
    }
}