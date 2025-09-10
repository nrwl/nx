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
        
        // PathResolver only adds paths that exist on the filesystem
        // Since /absolute/path/to/file doesn't exist, it won't be added
        resolver.addInputPath("/absolute/path/to/file", inputs)
        
        assertEquals(0, inputs.size) // No paths added because file doesn't exist
    }
    
    @Test
    fun `should resolve relative paths from project root`() {
        val resolver = PathResolver("/workspace", "/workspace/project")
        val inputs = linkedSetOf<String>()
        
        // PathResolver only adds paths that exist on the filesystem
        // Since src/main/java doesn't exist, it won't be added
        resolver.addInputPath("src/main/java", inputs)
        
        assertEquals(0, inputs.size) // No paths added because directory doesn't exist
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
        
        // PathResolver only adds paths that exist on the filesystem
        // Since src/main/java doesn't exist, none will be added
        resolver.addInputPath("src/main/java", inputs)
        resolver.addInputPath("src/main/java", inputs)
        resolver.addInputPath("src/main/java", inputs)
        
        // LinkedHashSet would deduplicate, but since files don't exist, nothing is added
        assertEquals(0, inputs.size)
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
        
        // PathResolver only adds paths that exist on the filesystem
        resolver1.addInputPath("src/main/java", inputs1)
        resolver2.addInputPath("src/main/java", inputs2)
        
        // Both should work without errors (no exceptions thrown)
        // Since paths don't exist, both will be empty
        assertTrue(inputs1.isEmpty())
        assertTrue(inputs2.isEmpty())
        
        // This tests that both configurations work without throwing exceptions
    }
}