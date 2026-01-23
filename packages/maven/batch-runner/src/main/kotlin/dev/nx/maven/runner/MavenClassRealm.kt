package dev.nx.maven.runner

import org.codehaus.plexus.classworlds.ClassWorld
import org.codehaus.plexus.classworlds.realm.ClassRealm
import org.slf4j.LoggerFactory
import java.io.File
import java.io.InputStream
import java.net.URL

/**
 * Manages the ClassRealm for loading Maven classes and adapter classes at runtime.
 *
 * Architecture:
 * - Creates a ClassWorld with a "plexus.core" realm
 * - Loads Maven JARs from $MAVEN_HOME/lib and /boot
 * - Injects pre-compiled adapter classes from embedded resources
 * - Provides a unified classloader for all Maven + adapter classes
 *
 * This allows the batch-runner to have NO Maven compile-time dependencies,
 * while still being able to instantiate and use Maven/adapter classes via reflection.
 */
class MavenClassRealm(private val mavenHome: File) : AutoCloseable {
    private val log = LoggerFactory.getLogger(MavenClassRealm::class.java)

    val classWorld: ClassWorld
    val realm: NxClassRealm

    init {
        System.err.println("[NX] Creating MavenClassRealm for: ${mavenHome.absolutePath}")

        // Create ClassWorld with our custom NxClassRealm (allows direct class injection)
        classWorld = ClassWorld()
        realm = NxClassRealm(classWorld, "plexus.core", ClassLoader.getSystemClassLoader())

        // Load Maven JARs
        loadMavenLibJars()
        loadMavenBootJars()

        // Set TCCL to our realm so Maven classes can load properly
        Thread.currentThread().contextClassLoader = realm
        System.err.println("[NX] ClassRealm initialized with Maven JARs")
    }

    /**
     * Load Maven lib JARs from MAVEN_HOME/lib
     */
    private fun loadMavenLibJars() {
        val libDir = File(mavenHome, "lib")
        if (!libDir.isDirectory) {
            System.err.println("[NX] ERROR: Maven lib directory not found: ${libDir.absolutePath}")
            log.warn("Maven lib directory not found: ${libDir.absolutePath}")
            return
        }

        val jarFiles = libDir.listFiles { file -> file.name.endsWith(".jar") } ?: emptyArray()
        System.err.println("[NX] Loading ${jarFiles.size} JARs from Maven lib: ${libDir.absolutePath}")
        log.debug("Loading ${jarFiles.size} JARs from Maven lib directory")

        jarFiles.forEach { jarFile ->
            try {
                realm.addURL(jarFile.toURI().toURL())
            } catch (e: Exception) {
                System.err.println("[NX] Failed to add JAR: ${jarFile.name} - ${e.message}")
                log.warn("Failed to add JAR to realm: ${jarFile.name} - ${e.message}")
            }
        }
    }

    /**
     * Load Maven boot JARs from MAVEN_HOME/boot
     */
    private fun loadMavenBootJars() {
        val bootDir = File(mavenHome, "boot")
        if (!bootDir.isDirectory) {
            log.debug("Maven boot directory not found (optional): ${bootDir.absolutePath}")
            return
        }

        val jarFiles = bootDir.listFiles { file -> file.name.endsWith(".jar") } ?: emptyArray()
        log.debug("Loading ${jarFiles.size} JARs from Maven boot directory")

        jarFiles.forEach { jarFile ->
            try {
                realm.addURL(jarFile.toURI().toURL())
            } catch (e: Exception) {
                log.warn("Failed to add boot JAR to realm: ${jarFile.name} - ${e.message}")
            }
        }
    }

    /**
     * Inject shared classes that use Maven types into the realm.
     * These must be injected before adapters since adapters depend on them.
     */
    fun injectSharedClasses() {
        System.err.println("[NX] Injecting shared classes into ClassRealm...")

        val manifestPath = "nx-maven-adapters/shared/classes.txt"
        val manifestStream = javaClass.classLoader.getResourceAsStream(manifestPath)
        if (manifestStream == null) {
            System.err.println("[NX] ERROR: Shared classes manifest not found: $manifestPath")
            return
        }

        val classFiles = manifestStream.bufferedReader().useLines { lines ->
            lines.filter { it.isNotBlank() && !it.startsWith("#") }.toList()
        }

        System.err.println("[NX] Found ${classFiles.size} shared classes to inject")

        var injectedCount = 0
        for (classFile in classFiles) {
            try {
                injectClass("shared", classFile)
                injectedCount++
            } catch (e: Exception) {
                System.err.println("[NX] Failed to inject shared $classFile: ${e.message}")
            }
        }

        System.err.println("[NX] Injected $injectedCount shared classes successfully")
    }

    /**
     * Inject adapter classes from embedded resources into the realm.
     *
     * @param mavenMajorVersion The major Maven version ("3" or "4")
     */
    fun injectAdapters(mavenMajorVersion: String) {
        // First inject shared classes that adapters depend on
        injectSharedClasses()

        val adapterPath = "maven$mavenMajorVersion"
        System.err.println("[NX] Injecting $adapterPath adapter classes into ClassRealm...")

        // Read the classes manifest
        val manifestPath = "nx-maven-adapters/$adapterPath/classes.txt"
        val manifestStream = javaClass.classLoader.getResourceAsStream(manifestPath)
        if (manifestStream == null) {
            System.err.println("[NX] ERROR: Adapter classes manifest not found: $manifestPath")
            return
        }

        val classFiles = manifestStream.bufferedReader().useLines { lines ->
            lines.filter { it.isNotBlank() && !it.startsWith("#") }.toList()
        }

        System.err.println("[NX] Found ${classFiles.size} adapter classes to inject")

        // Inject each class file
        var injectedCount = 0
        for (classFile in classFiles) {
            try {
                injectClass(adapterPath, classFile)
                injectedCount++
            } catch (e: Exception) {
                System.err.println("[NX] Failed to inject $classFile: ${e.message}")
            }
        }

        System.err.println("[NX] Injected $injectedCount adapter classes successfully")
    }

    /**
     * Inject a single class file into the realm.
     */
    private fun injectClass(adapterPath: String, classFile: String) {
        val resourcePath = "nx-maven-adapters/$adapterPath/$classFile"
        val inputStream = javaClass.classLoader.getResourceAsStream(resourcePath)
            ?: throw RuntimeException("Adapter class not found: $resourcePath")

        val classBytes = inputStream.use { it.readBytes() }
        val className = classFile
            .replace("/", ".")
            .removeSuffix(".class")

        // Use reflection to call ClassRealm.defineClass
        defineClassInRealm(className, classBytes)
        log.debug("  Injected: $className")
    }

    /**
     * Define a class in the realm.
     * Uses NxClassRealm which exposes the protected defineClass method directly.
     */
    private fun defineClassInRealm(className: String, classBytes: ByteArray) {
        // Check if class already exists
        try {
            realm.loadClass(className)
            log.debug("  Class already exists in realm: $className")
            return
        } catch (e: ClassNotFoundException) {
            // Expected - class doesn't exist yet, we'll define it
        }

        try {
            // Direct call via NxClassRealm - no reflection needed!
            realm.defineClass(className, classBytes)
        } catch (e: LinkageError) {
            val errorMsg = "${e.javaClass.simpleName}: ${e.message ?: "no message"}"
            System.err.println("[NX] defineClass error for $className: $errorMsg")
            System.err.println("[NX] This usually means a dependency class wasn't found")
            throw RuntimeException("Failed to define class $className: $errorMsg", e)
        } catch (e: Exception) {
            val errorMsg = "${e.javaClass.simpleName}: ${e.message ?: "no message"}"
            System.err.println("[NX] defineClass error for $className: $errorMsg")
            throw RuntimeException("Failed to define class $className: $errorMsg", e)
        }
    }

    /**
     * Load a class from the realm.
     */
    fun loadClass(className: String): Class<*> {
        return realm.loadClass(className)
    }

    /**
     * Get a resource from the realm.
     */
    fun getResource(name: String): URL? {
        return realm.getResource(name)
    }

    /**
     * Get a resource stream from the realm.
     */
    fun getResourceAsStream(name: String): InputStream? {
        return realm.getResourceAsStream(name)
    }

    override fun close() {
        try {
            classWorld.disposeRealm("plexus.core")
        } catch (e: Exception) {
            log.warn("Error disposing realm: ${e.message}")
        }
    }

    companion object {
        /**
         * Detect Maven major version from MAVEN_HOME.
         * Returns "4" for Maven 4.x, "3" for Maven 3.x.
         */
        fun detectMavenMajorVersion(mavenHome: File): String {
            // Try to detect from maven-core JAR version
            val libDir = File(mavenHome, "lib")
            if (libDir.isDirectory) {
                val mavenCoreJars = libDir.listFiles { file ->
                    file.name.startsWith("maven-core-") && file.name.endsWith(".jar")
                } ?: emptyArray()

                for (jar in mavenCoreJars) {
                    // Extract version from filename: maven-core-X.Y.Z.jar
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
