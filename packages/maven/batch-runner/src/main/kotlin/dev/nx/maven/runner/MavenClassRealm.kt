package dev.nx.maven.runner

import org.codehaus.plexus.classworlds.ClassWorld
import org.codehaus.plexus.classworlds.realm.ClassRealm
import org.slf4j.LoggerFactory
import java.io.File

/**
 * Custom ClassRealm for loading Maven classes and adapter JARs at runtime.
 *
 * Architecture:
 * - Creates a ClassWorld with a "plexus.core" realm
 * - Loads Maven JARs from $MAVEN_HOME/lib and /boot
 * - Loads adapter JARs from nx-maven-adapters directory (sibling to batch-runner.jar)
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
     * Load adapter JAR into the realm.
     * Looks for the adapter JAR in the nx-maven-adapters directory relative to this JAR.
     *
     * @param mavenMajorVersion The major Maven version ("3" or "4")
     */
    fun loadAdapterJar(mavenMajorVersion: String) {
        val adapterJar = findAdapterJar(mavenMajorVersion)
            ?: throw RuntimeException("Adapter JAR not found for Maven $mavenMajorVersion")

        log.debug("Loading adapter JAR: ${adapterJar.absolutePath}")
        addURL(adapterJar.toURI().toURL())
        log.debug("Loaded adapter JAR: ${adapterJar.name} (${adapterJar.length()} bytes)")
    }

    /**
     * Find the adapter JAR for the given Maven version.
     * Looks in nx-maven-adapters directory relative to this JAR's location.
     */
    private fun findAdapterJar(mavenMajorVersion: String): File? {
        // Find where this class's JAR is located
        val codeSource = MavenClassRealm::class.java.protectionDomain.codeSource
        if (codeSource?.location == null) {
            log.warn("Cannot determine JAR location")
            return null
        }

        val batchRunnerJar = File(codeSource.location.toURI())
        val adaptersDir = File(batchRunnerJar.parentFile, "nx-maven-adapters")

        if (!adaptersDir.isDirectory) {
            log.warn("Adapters directory not found: ${adaptersDir.absolutePath}")
            return null
        }

        // Look for adapter JAR matching the version pattern
        val pattern = Regex("maven${mavenMajorVersion}-adapter.*\\.jar")

        val adapterJar = adaptersDir.listFiles { file ->
            pattern.matches(file.name)
        }?.firstOrNull()

        if (adapterJar == null) {
            log.warn("No adapter JAR found in ${adaptersDir.absolutePath} for Maven $mavenMajorVersion")
        }

        return adapterJar
    }

    override fun close() {
        try {
            classWorld.disposeRealm("plexus.core")
        } catch (e: Exception) {
            log.warn("Error disposing realm: ${e.message}")
        }
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

            // Register realm with ClassWorld (required for Maven to find it)
            // ClassRealm constructor doesn't auto-register; ClassWorld.newRealm() does the registration
            // but we can't use newRealm() since we need our subclass
            registerRealmWithClassWorld(classWorld, realm)

            // Load Maven JARs
            realm.loadMavenLibJars(mavenHome)
            realm.loadMavenBootJars(mavenHome)

            // Set TCCL so Maven classes can load properly
            Thread.currentThread().contextClassLoader = realm
            log.debug("ClassRealm initialized with Maven JARs")

            return realm
        }

        /**
         * Register a ClassRealm with ClassWorld using reflection.
         * This is needed because ClassRealm constructor doesn't auto-register,
         * and ClassWorld.newRealm() creates a plain ClassRealm (not our subclass).
         */
        private fun registerRealmWithClassWorld(classWorld: ClassWorld, realm: ClassRealm) {
            try {
                val realmsField = ClassWorld::class.java.getDeclaredField("realms")
                realmsField.isAccessible = true
                @Suppress("UNCHECKED_CAST")
                val realms = realmsField.get(classWorld) as MutableMap<String, ClassRealm>
                realms[realm.id] = realm
                log.debug("Registered realm '${realm.id}' with ClassWorld")
            } catch (e: Exception) {
                log.error("Failed to register realm with ClassWorld: ${e.message}", e)
                throw RuntimeException("Failed to register ClassRealm", e)
            }
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
