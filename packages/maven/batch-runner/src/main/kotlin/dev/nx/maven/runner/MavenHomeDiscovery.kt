package dev.nx.maven.runner

import dev.nx.maven.shared.MavenCommandResolver
import org.slf4j.LoggerFactory
import java.io.File

/**
 * Utility for discovering Maven home directory and version from various sources.
 *
 * Discovery priority order:
 * 1. MAVEN_HOME environment variable (explicit override)
 * 2. maven.home system property (explicit override)
 * 3. ./mvnw --version output (respects project's Maven version)
 * 4. .mvn/wrapper/maven-wrapper.properties (project config)
 * 5. Maven 4.x installation (fallback for batch executor)
 * 6. Maven wrapper in ~/.m2/wrapper/ (any version)
 * 7. `which mvn` command
 * 8. Common Maven installation paths
 *
 * Also detects Maven version from the discovered home directory.
 */
data class MavenDiscoveryResult(
  val mavenHome: File,
  val version: String? = null
)

class MavenHomeDiscovery(
  private val workspaceRoot: File = File("."),
  private val userHome: String = System.getProperty("user.home")
) {
  private val log = LoggerFactory.getLogger(MavenHomeDiscovery::class.java)

  /**
   * Discover Maven home directory and version using the standard priority order.
   * Returns a MavenDiscoveryResult containing both the Maven home and its version.
   */
  fun discoverMavenHomeWithVersion(): MavenDiscoveryResult? {
    log.debug("🔍 Starting Maven home discovery from workspace: ${workspaceRoot.absolutePath}")

    // 1. Check MAVEN_HOME environment variable (explicit override)
    log.debug("1️⃣ Checking MAVEN_HOME environment variable...")
    val mavenHomeEnv = System.getenv("MAVEN_HOME")
    if (mavenHomeEnv != null && mavenHomeEnv.isNotEmpty()) {
      val dir = File(mavenHomeEnv)
      if (dir.isDirectory) {
        log.debug("✓ Found Maven home from MAVEN_HOME env var: $mavenHomeEnv")
        val version = detectMavenVersion(dir)
        return MavenDiscoveryResult(dir, version)
      }
    }

    // 2. Check maven.home system property (explicit override)
    log.debug("2️⃣ Checking maven.home system property...")
    val mavenHomeProp = System.getProperty("maven.home")
    if (mavenHomeProp != null && mavenHomeProp.isNotEmpty()) {
      val dir = File(mavenHomeProp)
      if (dir.isDirectory) {
        log.debug("✓ Found Maven home from maven.home property: $mavenHomeProp")
        val version = detectMavenVersion(dir)
        return MavenDiscoveryResult(dir, version)
      }
    }

    // 3. Run ./mvnw --version to get Maven home (respects project's Maven version)
    log.debug("3️⃣ Checking ./mvnw --version (respects project's Maven version)...")
    val (mvnwHome, mvnwVersion) = extractMavenHomeFromMvnwWithVersion()
    if (mvnwHome != null) {
      return MavenDiscoveryResult(mvnwHome, mvnwVersion)
    }

    // 4. Check Maven wrapper config in project (.mvn/wrapper/maven-wrapper.properties)
    log.debug("4️⃣ Checking .mvn/wrapper/maven-wrapper.properties...")
    val fromWrapperConfig = extractMavenHomeFromWrapperConfig()
    if (fromWrapperConfig != null) {
      val version = detectMavenVersion(fromWrapperConfig)
      return MavenDiscoveryResult(fromWrapperConfig, version)
    }

    // 5. Find Maven 4.x installation (fallback for batch executor performance)
    log.debug("5️⃣ Searching for Maven 4.x installations (batch executor fallback)...")
    val maven4 = findMaven4Installation()
    if (maven4 != null) {
      return MavenDiscoveryResult(maven4, "4.x")  // 4.x is inferred from location
    }

    // 6. Check Maven wrapper (any version, prioritized over system Maven)
    log.debug("6️⃣ Checking Maven wrapper in ~/.m2/wrapper/dists...")
    val fromMavenWrapper = findMavenInWrapper()
    if (fromMavenWrapper != null) {
      val version = detectMavenVersion(fromMavenWrapper)
      return MavenDiscoveryResult(fromMavenWrapper, version)
    }

    // 7. Try to find Maven using `which mvn`
    log.debug("7️⃣ Trying 'which mvn' to find Maven installation...")
    val fromWhich = findMavenUsingWhich()
    if (fromWhich != null) {
      val version = detectMavenVersion(fromWhich)
      return MavenDiscoveryResult(fromWhich, version)
    }

    // 8. Try common Maven installation paths
    log.debug("8️⃣ Checking common Maven installation paths...")
    val fromCommonPaths = findMavenInCommonPaths()
    if (fromCommonPaths != null) {
      val version = detectMavenVersion(fromCommonPaths)
      return MavenDiscoveryResult(fromCommonPaths, version)
    }

    log.warn("❌ Could not determine Maven home directory. Set MAVEN_HOME environment variable, maven.home system property, ensure 'mvn' is in PATH, or install Maven wrapper in ~/.m2/wrapper/")
    return null
  }

  /**
   * Discover Maven home directory using the standard priority order.
   * Legacy method - returns just the home directory for backward compatibility.
   */
  fun discoverMavenHome(): File? {
    return discoverMavenHomeWithVersion()?.mavenHome
  }

  /**
   * Detect the best available Maven executable command: mvnd > mvnw > mvn
   */
  fun detectMavenExecutable(): String {
    return MavenCommandResolver.getMavenCommand(workspaceRoot)
  }

  /**
   * Extract Maven home and version by running ./mvnw --version and parsing the output.
   * Returns a Pair of (mavenHome: File?, version: String?)
   */
  private fun extractMavenHomeFromMvnwWithVersion(): Pair<File?, String?> {
    return try {
      val mvnwFile = File(workspaceRoot, "mvnw")
      log.debug("Checking for mvnw in: ${mvnwFile.absolutePath}")

      if (!mvnwFile.exists()) {
        log.debug("❌ No mvnw script found in workspace root: ${workspaceRoot.absolutePath}")
        return Pair(null, null)
      }

      log.debug("✓ Found mvnw script, running ./mvnw --version to detect Maven home and version...")

      val processBuilder = ProcessBuilder("./mvnw", "--version")
        .directory(workspaceRoot)
        .redirectErrorStream(true)

      val process = processBuilder.start()
      val output = process.inputStream.bufferedReader().readText()
      val exitCode = process.waitFor()

      log.debug("./mvnw --version exit code: $exitCode")
      log.debug("./mvnw --version output:\n$output")

      if (exitCode != 0) {
        log.warn("❌ ./mvnw --version exited with code $exitCode")
        return Pair(null, null)
      }

      // Parse Maven version first: "Apache Maven 3.6.3" or "Apache Maven 4.0.0-rc-4"
      var detectedVersion: String? = null
      val versionMatcher = Regex("""Apache Maven ([0-9.]+[a-zA-Z0-9-]*)""").find(output)
      if (versionMatcher != null) {
        detectedVersion = versionMatcher.groupValues[1].trim()
        log.debug("Parsed Maven version: $detectedVersion")
      }

      // Parse "Maven home: /path/to/maven" from output
      val matcher = Regex("""Maven home:\s*(.+)""").find(output)
      if (matcher != null) {
        val mavenHomePath = matcher.groupValues[1].trim()
        log.debug("Parsed Maven home path: $mavenHomePath")

        val mavenHome = File(mavenHomePath)
        val libDir = File(mavenHome, "lib")

        log.debug("Checking if Maven home exists: ${mavenHome.absolutePath}")
        log.debug("  - Directory exists: ${mavenHome.isDirectory}")
        log.debug("  - lib exists: ${libDir.isDirectory}")

        if (mavenHome.isDirectory && libDir.isDirectory) {
          log.debug("✓ Found Maven home from ./mvnw --version: $mavenHomePath (version: $detectedVersion)")
          return Pair(mavenHome, detectedVersion)
        } else {
          log.warn("❌ Maven home from ./mvnw does not exist or is invalid: $mavenHomePath")
          log.warn("   Directory exists: ${mavenHome.isDirectory}, lib exists: ${libDir.isDirectory}")
        }
      } else {
        log.debug("❌ Could not parse 'Maven home:' from ./mvnw --version output")
      }
      Pair(null, null)
    } catch (e: Exception) {
      log.warn("❌ Error extracting Maven home from ./mvnw: ${e.message}", e)
      Pair(null, null)
    }
  }

  /**
   * Extract Maven home by running ./mvnw --version and parsing the output.
   * The Maven wrapper script prints "Maven home: /path/to/maven" which we extract.
   */
  private fun extractMavenHomeFromMvnw(): File? {
    return try {
      val mvnwFile = File(workspaceRoot, "mvnw")
      log.debug("Checking for mvnw in: ${mvnwFile.absolutePath}")

      if (!mvnwFile.exists()) {
        log.debug("❌ No mvnw script found in workspace root: ${workspaceRoot.absolutePath}")
        return null
      }

      log.debug("✓ Found mvnw script, running ./mvnw --version to detect Maven home...")

      val processBuilder = ProcessBuilder("./mvnw", "--version")
        .directory(workspaceRoot)
        .redirectErrorStream(true)

      val process = processBuilder.start()
      val output = process.inputStream.bufferedReader().readText()
      val exitCode = process.waitFor()

      log.debug("./mvnw --version exit code: $exitCode")
      log.debug("./mvnw --version output:\n$output")

      if (exitCode != 0) {
        log.warn("❌ ./mvnw --version exited with code $exitCode")
        return null
      }

      // Parse "Maven home: /path/to/maven" from output
      val matcher = Regex("""Maven home:\s*(.+)""").find(output)
      if (matcher != null) {
        val mavenHomePath = matcher.groupValues[1].trim()
        log.debug("Parsed Maven home path: $mavenHomePath")

        val mavenHome = File(mavenHomePath)
        val libDir = File(mavenHome, "lib")

        log.debug("Checking if Maven home exists: ${mavenHome.absolutePath}")
        log.debug("  - Directory exists: ${mavenHome.isDirectory}")
        log.debug("  - lib exists: ${libDir.isDirectory}")

        if (mavenHome.isDirectory && libDir.isDirectory) {
          log.debug("✓ Found Maven home from ./mvnw --version: $mavenHomePath")
          return mavenHome
        } else {
          log.warn("❌ Maven home from ./mvnw does not exist or is invalid: $mavenHomePath")
          log.warn("   Directory exists: ${mavenHome.isDirectory}, lib exists: ${libDir.isDirectory}")
        }
      } else {
        log.debug("❌ Could not parse 'Maven home:' from ./mvnw --version output")
      }
      null
    } catch (e: Exception) {
      log.warn("❌ Error extracting Maven home from ./mvnw: ${e.message}", e)
      null
    }
  }

  /**
   * Extract Maven home from wrapper configuration if available.
   * Reads the maven-wrapper.properties to find the Maven distribution version
   * and infers the installation path from wrapper cache.
   */
  private fun extractMavenHomeFromWrapperConfig(): File? {
    return try {
      val wrapperProps = File(workspaceRoot, ".mvn/wrapper/maven-wrapper.properties")
      if (wrapperProps.exists()) {
        val props = wrapperProps.readLines()
          .filter { it.isNotEmpty() && !it.startsWith("#") }
          .map { it.split("=") }
          .filter { it.size == 2 }
          .associate { it[0].trim() to it[1].trim() }

        val distributionUrl = props["distributionUrl"] ?: return null
        val matcher = Regex("""apache-maven-([0-9.]+)""").find(distributionUrl)
        val version = matcher?.groupValues?.get(1) ?: return null

        // Find in wrapper cache
        val wrapperBaseDir = File(userHome, ".m2/wrapper/dists")
        val versionDir = File(wrapperBaseDir, "apache-maven-$version")
        if (versionDir.exists()) {
          val hashDirs = versionDir.listFiles { file -> file.isDirectory }
          if (hashDirs != null && hashDirs.isNotEmpty()) {
            val mavenHome = hashDirs[0]
            if (File(mavenHome, "lib").isDirectory) {
              log.debug("Extracted Maven home from wrapper config: ${mavenHome.absolutePath}")
              return mavenHome
            }
          }
        }
      }
      null
    } catch (e: Exception) {
      log.debug("Could not extract Maven home from wrapper config: ${e.message}")
      null
    }
  }

  /**
   * Find Maven 4.x installation from standard locations.
   * Prefers newer versions (4.0.0 final, then rc-4, then rc-3, etc).
   */
  private fun findMaven4Installation(): File? {
    val candidates = listOf(
      // Prefer newer versions that have fixed plexus-container issues
      File(userHome, ".m2/wrapper/dists/apache-maven-4.0.0"),
      File(userHome, ".m2/wrapper/dists/apache-maven-4.0.0-bin"),
      File(userHome, ".m2/wrapper/dists/apache-maven-4.0.0-rc-4"),
      File(userHome, ".m2/wrapper/dists/apache-maven-4.0.0-rc.4"),
      File(userHome, ".m2/wrapper/dists/apache-maven-4.0.0-rc.4-bin"),
      File(userHome, ".m2/wrapper/dists/apache-maven-4.0.0-rc-3"),
      File("/usr/local/opt/maven-4"),  // Homebrew on macOS
      File("/opt/maven-4"),  // Linux
    )

    for (candidate in candidates) {
      if (!candidate.exists()) {
        continue
      }

      // Check if this is a direct Maven installation
      val directLibDir = File(candidate, "lib")
      if (directLibDir.isDirectory) {
        log.debug("Found Maven 4.x installation at: ${candidate.absolutePath}")
        return candidate
      }

      // Check if this is a wrapper parent directory with hash subdirectories
      val hashDirs = candidate.listFiles { file -> file.isDirectory && file.name.matches(Regex("[a-f0-9]+")) }
      if (hashDirs != null && hashDirs.isNotEmpty()) {
        val sortedDirs = hashDirs.sortedByDescending { it.name }
        for (hashDir in sortedDirs) {
          val libDir = File(hashDir, "lib")
          if (libDir.isDirectory) {
            log.debug("Found Maven 4.x installation at: ${hashDir.absolutePath}")
            return hashDir
          }
        }
      }
    }

    log.debug("Maven 4.x not found in standard locations")
    return null
  }

  /**
   * Find Maven in ~/.m2/wrapper/ (any version, prioritized over system Maven).
   */
  private fun findMavenInWrapper(): File? {
    return try {
      val wrapperBaseDir = File(userHome, ".m2/wrapper/dists")
      if (wrapperBaseDir.isDirectory) {
        // Look for Maven 4.x wrapper installations first
        val maven4Dirs = wrapperBaseDir.listFiles { file ->
          file.isDirectory && file.name.startsWith("apache-maven-4")
        }?.sortedByDescending { it.name }

        if (maven4Dirs != null && maven4Dirs.isNotEmpty()) {
          val versionDir = maven4Dirs[0]
          val hashDirs = versionDir.listFiles { file -> file.isDirectory }
          if (hashDirs != null && hashDirs.isNotEmpty()) {
            val mavenHome = hashDirs[0]
            if (File(mavenHome, "lib").isDirectory && File(mavenHome, "bin").isDirectory) {
              log.debug("Found Maven 4.x from wrapper: ${mavenHome.absolutePath}")
              return mavenHome
            }
          }
        }
      }
      null
    } catch (e: Exception) {
      log.debug("Error finding Maven in wrapper: ${e.message}")
      null
    }
  }

  /**
   * Try to find Maven using `which mvn` command.
   */
  private fun findMavenUsingWhich(): File? {
    return try {
      val process = Runtime.getRuntime().exec("which mvn")
      val output = process.inputStream.bufferedReader().readText().trim()
      process.waitFor()

      if (output.isNotEmpty()) {
        var mvnFile = File(output)

        // Resolve symlinks
        while (mvnFile.isSymbolicLink()) {
          val target = mvnFile.canonicalPath
          mvnFile = File(target)
        }

        // Navigate from bin/mvn up to Maven home
        val mavenHome = mvnFile.parentFile?.parentFile
        if (mavenHome != null && mavenHome.isDirectory) {
          if (File(mavenHome, "lib").isDirectory && File(mavenHome, "bin").isDirectory) {
            val version = detectMavenVersion(mavenHome)
            log.debug("Found Maven home from 'which mvn': ${mavenHome.absolutePath} (version: $version)")
            return mavenHome
          }
        }
      }
      null
    } catch (e: Exception) {
      log.debug("Could not use 'which mvn' to find Maven: ${e.message}")
      null
    }
  }

  /**
   * Try common Maven installation paths.
   */
  private fun findMavenInCommonPaths(): File? {
    val commonPaths = listOf(
      "/usr/local/opt/maven",  // Homebrew on macOS
      "/usr/local/maven",      // Linux
      "/opt/maven",            // Common Linux path
      "$userHome/.m2/maven"    // User-local
    )

    for (path in commonPaths) {
      val dir = File(path)
      if (dir.isDirectory && File(dir, "lib").isDirectory) {
        log.debug("Found Maven home at common path: $path")
        return dir
      }
    }
    return null
  }

  /**
   * Detect Maven version from Maven home.
   * Returns the version string (e.g., "3.9.11", "4.0.0") or null if detection fails.
   */
  private fun detectMavenVersion(mavenHome: File?): String? {
    if (mavenHome == null) return null

    return try {
      val libDir = File(mavenHome, "lib")
      if (!libDir.isDirectory) return null

      // Look for maven-core-*.jar to extract version
      val mavenCoreJar = libDir.listFiles { file ->
        file.name.startsWith("maven-core-") && file.name.endsWith(".jar")
      }?.firstOrNull()

      if (mavenCoreJar != null) {
        val matcher = Regex("""maven-core-([0-9.]+)""").find(mavenCoreJar.name)
        matcher?.groupValues?.get(1)
      } else {
        null
      }
    } catch (e: Exception) {
      log.debug("Could not detect Maven version: ${e.message}")
      null
    }
  }

  /**
   * Check if a file is a symbolic link.
   */
  private fun File.isSymbolicLink(): Boolean {
    return try {
      this.canonicalPath != this.absolutePath
    } catch (e: Exception) {
      false
    }
  }
}
