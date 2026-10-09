package dev.nx.maven.adapter.maven3

import org.codehaus.plexus.classworlds.ClassWorld
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import java.io.File

class CachingMaven3InvokerTest {
    private lateinit var tempDir: File
    private lateinit var mvnDir: File
    private lateinit var mavenConfigFile: File

    @BeforeEach
    fun setUp() {
        tempDir = File(System.getProperty("java.io.tmpdir"), "maven3-adapter-test-" + System.nanoTime())
        tempDir.mkdirs()
        mvnDir = File(tempDir, ".mvn")
        mvnDir.mkdirs()
        mavenConfigFile = File(mvnDir, "maven.config")
    }

    @AfterEach
    fun tearDown() {
        tempDir.deleteRecursively()
    }

    @Test
    fun `should read arguments from maven config`() {
        mavenConfigFile.writeText("-T 4 -DskipTests")

        // We can't easily instantiate CachingMaven3Invoker because it requires a ClassWorld with Maven JARs
        // But we can test the createRequest method if we make it accessible or use reflection,
        // or just test the mergeMavenConfig if we make it internal.

        // For now, let's just use reflection to test mergeMavenConfig
        val classWorld = ClassWorld()
        val invoker = CachingMaven3Invoker(classWorld, tempDir)

        val mergeMethod = invoker.javaClass.getDeclaredMethod("mergeMavenConfig", List::class.java, File::class.java)
        mergeMethod.isAccessible = true

        val initialArgs = listOf("-pl", "my-project")
        val result = mergeMethod.invoke(invoker, initialArgs, tempDir) as List<*>

        assertTrue(result.contains("-T"), "Should contain -T from maven.config")
        assertTrue(result.contains("4"), "Should contain 4 from maven.config")
        assertTrue(result.contains("-DskipTests"), "Should contain -DskipTests from maven.config")
        assertTrue(result.contains("-pl"), "Should contain original -pl")
        assertTrue(result.contains("my-project"), "Should contain original project")

        // config args should be before CLI args
        assertEquals("-T", result[0])
        assertEquals("4", result[1])
        assertEquals("-DskipTests", result[2])
    }
}
