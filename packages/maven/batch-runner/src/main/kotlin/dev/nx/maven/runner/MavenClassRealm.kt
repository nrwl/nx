package dev.nx.maven.runner

import org.codehaus.plexus.classworlds.ClassWorld
import org.codehaus.plexus.classworlds.realm.ClassRealm
import org.slf4j.LoggerFactory
import java.io.File
import java.nio.file.Files

/**
 * Custom ClassRealm for loading Maven classes and adapter JARs at runtime.
 *
 * Architecture:
 * - Creates a ClassWorld with a "plexus.core" realm
 * - Loads Maven JARs from $MAVEN_HOME/lib and /boot
 * - Loads pre-compiled adapter JARs from embedded resources
 * - Provides a unified classloader for all Maven + adapter classes
 *
 * This allows the batch-runner to have NO Maven compile-time dependencies,
 * while still being able to instantiate and use Maven/adapter classes.
 */
class MavenClassRealm private constructor(
    val classWorld: ClassWorld,
    id: String,
    parent: ClassLoader?
) : ClassRealm(classWorld, id, parent), AutoCloseable {

    private val log = LoggerFactory.getLogger(MavenClassRealm::class.java)
    private val tempFiles = mutableListOf<File>()

    /**
     * Load Maven lib JARs from MAVEN_HOME/lib
     */
    private fun loadMavenLibJars(mavenHome: File) {
        val libDir = File(mavenHome, "lib")
        if (!libDir.isDirectory) {
            log.warn("Maven lib directory not found: ${libDir.absolutePath}")
            return
        }

        val jarFiles = libDir.listFiles { file -> file.name.endsWith(".jar") } ?: emptyArray()
        log.debug("Loading ${jarFiles.size} JARs from Maven lib: ${libDir.absolutePath}")

        jarFiles.forEach { jarFile ->
            try {
                addURL(jarFile.toURI().toURL())
            } catch (e: Exception) {
                log.warn("Failed to add JAR to realm: ${jarFile.name} - ${e.message}")
            }
        }
    }

    /**
     * Load Maven boot JARs from MAVEN_HOME/boot
     */
    private fun loadMavenBootJars(mavenHome: File) {
        val bootDir = File(mavenHome, "boot")
        if (!bootDir.isDirectory) {
            log.debug("Maven boot directory not found (optional): ${bootDir.absolutePath}")
            return
        }

        val jarFiles = bootDir.listFiles { file -> file.name.endsWith(".jar") } ?: emptyArray()
        log.debug("Loading ${jarFiles.size} JARs from Maven boot directory")

        jarFiles.forEach { jarFile ->
            try {
                addURL(jarFile.toURI().toURL())
            } catch (e: Exception) {
                log.warn("Failed to add boot JAR to realm: ${jarFile.name} - ${e.message}")
            }
        }
    }

    /**
     * Load adapter JAR from embedded resources into the realm.
     *
     * @param mavenMajorVersion The major Maven version ("3" or "4")
     */
    fun loadAdapterJar(mavenMajorVersion: String) {
        val jarName = "maven${mavenMajorVersion}-adapter.jar"
        val resourcePath = "nx-maven-adapters/$jarName"

        log.debug("Loading adapter JAR: $resourcePath")

        val inputStream = javaClass.classLoader.getResourceAsStream(resourcePath)
            ?: throw RuntimeException("Adapter JAR not found: $resourcePath")

        // Extract JAR to temp file (ClassRealm.addURL needs a file URL)
        val tempFile = Files.createTempFile("nx-maven-adapter-", ".jar").toFile()
        tempFile.deleteOnExit()
        tempFiles.add(tempFile)

        inputStream.use { input ->
            tempFile.outputStream().use { output ->
                input.copyTo(output)
            }
        }

        addURL(tempFile.toURI().toURL())
        log.debug("Loaded adapter JAR: $jarName (${tempFile.length()} bytes)")
    }

    override fun close() {
        try {
            classWorld.disposeRealm("plexus.core")
        } catch (e: Exception) {
            log.warn("Error disposing realm: ${e.message}")
        }

        // Clean up temp files
        tempFiles.forEach { file ->
            try {
                file.delete()
            } catch (e: Exception) {
                log.debug("Failed to delete temp file: ${file.absolutePath}")
            }
        }
        tempFiles.clear()
    }

    companion object {
        private val log = LoggerFactory.getLogger(MavenClassRealm::class.java)

        /**
         * Create a MavenClassRealm for the given Maven home directory.
         */
        fun create(mavenHome: File): MavenClassRealm {
            log.debug("Creating MavenClassRealm for: ${mavenHome.absolutePath}")

            val classWorld = ClassWorld()
            val realm = MavenClassRealm(classWorld, "plexus.core", ClassLoader.getSystemClassLoader())

            // Load Maven JARs
            realm.loadMavenLibJars(mavenHome)
            realm.loadMavenBootJars(mavenHome)

            // Set TCCL so Maven classes can load properly
            Thread.currentThread().contextClassLoader = realm
            log.debug("ClassRealm initialized with Maven JARs")

            return realm
        }

        /**
         * Detect Maven major version from MAVEN_HOME.
         * Returns "4" for Maven 4.x, "3" for Maven 3.x.
         */
        fun detectMavenMajorVersion(mavenHome: File): String {
            val libDir = File(mavenHome, "lib")
            if (libDir.isDirectory) {
                val mavenCoreJars = libDir.listFiles { file ->
                    file.name.startsWith("maven-core-") && file.name.endsWith(".jar")
                } ?: emptyArray()

                for (jar in mavenCoreJars) {
                    val versionMatch = Regex("maven-core-(\\d+)").find(jar.name)
                    if (versionMatch != null) {
                        return versionMatch.groupValues[1]
                    }
                }
            }

            // Default to Maven 4 if we can't detect
            return "4"
        }
    }
}
