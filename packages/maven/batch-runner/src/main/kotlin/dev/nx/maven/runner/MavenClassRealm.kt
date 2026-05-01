package dev.nx.maven.runner

import org.codehaus.plexus.classworlds.ClassWorld
import org.codehaus.plexus.classworlds.realm.ClassRealm
import org.slf4j.LoggerFactory
import java.io.File

/**
 * Wrapper for ClassRealm that loads Maven classes and adapter JARs at runtime.
 *
 * This allows the batch-runner to have NO Maven compile-time dependencies,
 * while still being able to instantiate and use Maven/adapter classes.
 */
class MavenClassRealm private constructor(
    val classWorld: ClassWorld,
    val realm: ClassRealm,
    private val previousContextClassLoader: ClassLoader?
) : AutoCloseable {

    fun loadClass(name: String): Class<*> = realm.loadClass(name)

    fun loadAdapterJar(mavenMajorVersion: String) {
        val codeSource = MavenClassRealm::class.java.protectionDomain.codeSource
            ?: throw RuntimeException("Cannot locate batch-runner JAR: codeSource is null")

        val batchRunnerJar = File(codeSource.location.toURI())
        val adaptersDir = File(batchRunnerJar.parentFile, "nx-maven-adapters")
        val adapterJarName = "maven${mavenMajorVersion}-adapter.jar"
        val adapterJar = File(adaptersDir, adapterJarName)

        if (!adapterJar.exists()) {
            throw RuntimeException(
                "Adapter JAR not found: ${adapterJar.absolutePath}\n" +
                "Expected Maven $mavenMajorVersion adapter at: ${adapterJar.absolutePath}"
            )
        }

        realm.addURL(adapterJar.toURI().toURL())
        log.debug("Loaded adapter JAR: ${adapterJar.name}")
    }

    override fun close() {
        // Restore previous TCCL before disposing realm
        Thread.currentThread().contextClassLoader = previousContextClassLoader
        try {
            classWorld.disposeRealm("plexus.core")
        } catch (e: Exception) {
            log.warn("Error disposing realm: ${e.message}")
        }
    }

    companion object {
        private val log = LoggerFactory.getLogger(MavenClassRealm::class.java)

        fun create(mavenHome: File): MavenClassRealm {
            log.debug("Creating MavenClassRealm for: ${mavenHome.absolutePath}")

            // Save TCCL before changing it - will be restored on close()
            val previousContextClassLoader = Thread.currentThread().contextClassLoader

            val classWorld = ClassWorld()
            val realm = classWorld.newRealm("plexus.core", ClassLoader.getSystemClassLoader())

            // Load Maven JARs
            loadJarsFromDirectory(realm, File(mavenHome, "lib"))
            loadJarsFromDirectory(realm, File(mavenHome, "boot"))

            // Set TCCL so Maven classes can load properly
            Thread.currentThread().contextClassLoader = realm

            return MavenClassRealm(classWorld, realm, previousContextClassLoader)
        }

        private fun loadJarsFromDirectory(realm: ClassRealm, dir: File) {
            if (!dir.isDirectory) return

            dir.listFiles { file -> file.name.endsWith(".jar") }?.forEach { jarFile ->
                try {
                    realm.addURL(jarFile.toURI().toURL())
                } catch (e: Exception) {
                    log.warn("Failed to add JAR: ${jarFile.name} - ${e.message}")
                }
            }
        }

        fun detectMavenMajorVersion(mavenHome: File): String {
            val libDir = File(mavenHome, "lib")
            if (!libDir.isDirectory) return "4"

            val mavenCoreJar = libDir.listFiles { file ->
                file.name.startsWith("maven-core-") && file.name.endsWith(".jar")
            }?.firstOrNull() ?: return "4"

            return Regex("maven-core-(\\d+)").find(mavenCoreJar.name)
                ?.groupValues?.get(1) ?: "4"
        }
    }
}
