package dev.nx.maven.runner

import org.codehaus.plexus.classworlds.ClassWorld
import org.codehaus.plexus.classworlds.realm.ClassRealm
import org.slf4j.LoggerFactory
import java.io.File

/**
 * Custom ClassRealm for loading Maven classes and adapter classes at runtime.
 *
 * Extends ClassRealm to expose the protected defineClass method, allowing
 * adapter classes to be injected without reflection.
 *
 * Architecture:
 * - Creates a ClassWorld with a "plexus.core" realm
 * - Loads Maven JARs from $MAVEN_HOME/lib and /boot
 * - Injects pre-compiled adapter classes from embedded resources
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
     * Define a class in this realm from bytecode.
     * Exposes the protected ClassLoader.defineClass method.
     */
    fun defineClassFromBytes(name: String, bytes: ByteArray): Class<*> {
        return defineClass(name, bytes, 0, bytes.size)
    }

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
     * Inject shared classes that use Maven types into the realm.
     * These must be injected before adapters since adapters depend on them.
     */
    private fun injectSharedClasses() {
        log.debug("Injecting shared classes into ClassRealm...")

        val manifestPath = "nx-maven-adapters/shared/classes.txt"
        val manifestStream = javaClass.classLoader.getResourceAsStream(manifestPath)
        if (manifestStream == null) {
            log.error("Shared classes manifest not found: $manifestPath")
            return
        }

        val classFiles = manifestStream.bufferedReader().useLines { lines ->
            lines.filter { it.isNotBlank() && !it.startsWith("#") }.toList()
        }

        log.debug("Found ${classFiles.size} shared classes to inject")

        var injectedCount = 0
        for (classFile in classFiles) {
            try {
                injectClass("shared", classFile)
                injectedCount++
            } catch (e: Exception) {
                log.error("Failed to inject shared $classFile: ${e.message}")
            }
        }

        log.debug("Injected $injectedCount shared classes successfully")
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
        log.debug("Injecting $adapterPath adapter classes into ClassRealm...")

        // Read the classes manifest
        val manifestPath = "nx-maven-adapters/$adapterPath/classes.txt"
        val manifestStream = javaClass.classLoader.getResourceAsStream(manifestPath)
        if (manifestStream == null) {
            log.error("Adapter classes manifest not found: $manifestPath")
            return
        }

        val classFiles = manifestStream.bufferedReader().useLines { lines ->
            lines.filter { it.isNotBlank() && !it.startsWith("#") }.toList()
        }

        log.debug("Found ${classFiles.size} adapter classes to inject")

        // Inject each class file
        var injectedCount = 0
        for (classFile in classFiles) {
            try {
                injectClass(adapterPath, classFile)
                injectedCount++
            } catch (e: Exception) {
                log.error("Failed to inject $classFile: ${e.message}")
            }
        }

        log.debug("Injected $injectedCount adapter classes successfully")
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

        defineClassInRealm(className, classBytes)
        log.debug("  Injected: $className")
    }

    /**
     * Define a class in the realm.
     */
    private fun defineClassInRealm(className: String, classBytes: ByteArray) {
        // Check if class already exists
        try {
            loadClass(className)
            log.debug("  Class already exists in realm: $className")
            return
        } catch (e: ClassNotFoundException) {
            // Expected - class doesn't exist yet, we'll define it
        }

        try {
            defineClassFromBytes(className, classBytes)
        } catch (e: LinkageError) {
            val errorMsg = "${e.javaClass.simpleName}: ${e.message ?: "no message"}"
            log.error("defineClass error for $className: $errorMsg (dependency class not found?)")
            throw RuntimeException("Failed to define class $className: $errorMsg", e)
        } catch (e: Exception) {
            val errorMsg = "${e.javaClass.simpleName}: ${e.message ?: "no message"}"
            log.error("defineClass error for $className: $errorMsg")
            throw RuntimeException("Failed to define class $className: $errorMsg", e)
        }
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
