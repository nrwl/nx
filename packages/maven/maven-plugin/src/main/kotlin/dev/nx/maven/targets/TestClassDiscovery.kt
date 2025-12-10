package dev.nx.maven.targets

import org.apache.maven.project.MavenProject
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.io.File
import java.util.concurrent.ConcurrentLinkedQueue

data class TestClassInfo(
    val className: String,
    val packagePath: String,
    val filePath: String,
    val packageName: String
)

/**
 * Simple test class discovery utility for Maven projects
 * Uses lightweight string matching instead of complex AST parsing
 * TODO: This should be pretty similar to the gradle one. We should look into merging them.
 */
class TestClassDiscovery() {
    private val log: Logger = LoggerFactory.getLogger(TestClassDiscovery::class.java)

    // Essential test annotations (simple string matching)
    private val testAnnotations = setOf(
        "@Test",
        "@TestTemplate",
        "@ParameterizedTest",
        "@RepeatedTest",
        "@TestFactory",
        "@org.junit.Test", // JUnit 4
        "@org.testng.annotations.Test" // TestNG
    )

    /**
     * Discover test classes in the given Maven project
     */
    fun discoverTestClasses(project: MavenProject): List<TestClassInfo> {
        val testClasses = ConcurrentLinkedQueue<TestClassInfo>()

        log.info("Getting Test Classes for project ${project.artifactId}")

        // Get test source roots
        val testSourceRoots = project.testCompileSourceRoots

        testSourceRoots.parallelStream().forEach { testSourceRoot ->
            val testDir = File(testSourceRoot.toString())
            if (!testDir.exists() || !testDir.isDirectory) {
                return@forEach
            }

            // Find all Java files recursively
            val javaFiles = findJavaFiles(testDir)

            javaFiles.parallelStream().forEach { javaFile ->
                val testClassInfo = getTestClass(javaFile, testDir)
                if (testClassInfo != null) {
                    testClasses.add(testClassInfo)
                }
            }
        }

        return testClasses.toList()
    }

    /**
     * Find all Java files in directory recursively
     */
    private fun findJavaFiles(directory: File): List<File> {
        val javaFiles = mutableListOf<File>()

        directory.walkTopDown()
            .filter { it.isFile && it.name.endsWith(".java") }
            .forEach { javaFiles.add(it) }

        return javaFiles
    }

    /**
     * Parse a Java test file using simple string matching
     */
    private fun getTestClass(javaFile: File, testSourceRoot: File): TestClassInfo? {
        log.info("Getting Test Classes from $javaFile")

        val content = javaFile.readText()

        // Quick check: does this file contain any test annotations?
        val hasTestAnnotation = testAnnotations.any { content.contains(it) }
        if (!hasTestAnnotation) {
            return null
        }

        // Extract package name (simple approach)
        val packageName = extractPackageName(content)

        // Extract class name (simple approach)
        val className = extractClassName(content) ?: return null

        // Double check: does this class actually have test methods?
        if (!hasTestMethodsInClass(content, className)) {
            return null
        }

        // Create test class info
        val packagePath = if (packageName.isNotEmpty()) "$packageName.$className" else className
        val relativePath = testSourceRoot.toPath().relativize(javaFile.toPath()).toString().replace('\\', '/')

        return TestClassInfo(
            className = className,
            packagePath = packagePath,
            filePath = relativePath,
            packageName = packageName
        )
    }

    /**
     * Extract package name from Java file content using simple string matching
     */
    private fun extractPackageName(content: String): String {
        // Find "package com.example.something;"
        val lines = content.lines()
        for (line in lines) {
            val trimmed = line.trim()
            if (trimmed.startsWith("package ") && trimmed.endsWith(";")) {
                return trimmed.substring(8, trimmed.length - 1).trim()
            }
        }
        return ""
    }

    /**
     * Extract class name from Java file content using simple string matching
     * Matches any class declaration, not just public ones (test classes can be package-private)
     */
    private fun extractClassName(content: String): String? {
        val lines = content.lines()
        for (line in lines) {
            val trimmed = line.trim()
            if (trimmed.contains("class ")) {
                // Simple extraction: find "class ClassName" (handles public, package-private, etc.)
                val parts = trimmed.split(" ", "\t").filter { it.isNotEmpty() }
                val classIndex = parts.indexOf("class")
                if (classIndex >= 0 && classIndex + 1 < parts.size) {
                    val className = parts[classIndex + 1]
                    // Remove generic types or extends clause
                    return className.split("<", "{", "extends", "implements")[0].trim()
                }
            }
        }
        return null
    }

    /**
     * Check if the class content actually contains test methods
     */
    private fun hasTestMethodsInClass(content: String, @Suppress("UNUSED_PARAMETER") className: String): Boolean {
        // Simple check: look for test annotations anywhere in the file
        return testAnnotations.any { content.contains(it) }
    }
}
