package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import org.apache.maven.project.MavenProject
import java.io.File

/**
 * Simple test class discovery utility for Maven projects
 * Uses lightweight string matching instead of complex AST parsing
 */
class TestClassDiscovery {

    private val objectMapper = ObjectMapper()
    
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
    fun discoverTestClasses(project: MavenProject): ArrayNode {
        val testClasses = objectMapper.createArrayNode()
        
        // Get test source roots
        val testSourceRoots = project.testCompileSourceRoots ?: emptyList()
        
        for (testSourceRoot in testSourceRoots) {
            val testDir = File(testSourceRoot)
            if (!testDir.exists() || !testDir.isDirectory) {
                continue
            }
            
            // Find all Java files recursively
            val javaFiles = findJavaFiles(testDir)
            
            for (javaFile in javaFiles) {
                val testClassInfo = parseTestFile(javaFile, testDir, project)
                if (testClassInfo != null) {
                    testClasses.add(testClassInfo)
                }
            }
        }
        
        return testClasses
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
    private fun parseTestFile(javaFile: File, testSourceRoot: File, project: MavenProject): ObjectNode? {
        try {
            val content = javaFile.readText()
            
            // Quick check: does this file contain any test annotations?
            val hasTestAnnotation = testAnnotations.any { content.contains(it) }
            if (!hasTestAnnotation) {
                return null
            }
            
            // Extract package name (simple approach)
            val packageName = extractPackageName(content)
            
            // Extract public class name (simple approach)
            val className = extractPublicClassName(content) ?: return null
            
            // Double check: does this class actually have test methods?
            if (!hasTestMethodsInClass(content, className)) {
                return null
            }
            
            // Create test class info
            val testClassInfo = objectMapper.createObjectNode()
            val packagePath = if (packageName.isNotEmpty()) "$packageName.$className" else className
            val relativePath = testSourceRoot.toPath().relativize(javaFile.toPath()).toString().replace('\\', '/')
            
            testClassInfo.put("className", className)
            testClassInfo.put("packagePath", packagePath)
            testClassInfo.put("filePath", relativePath)
            testClassInfo.put("packageName", packageName)
            
            return testClassInfo
            
        } catch (e: Exception) {
            // Ignore errors - test discovery is optional
            return null
        }
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
     * Extract public class name from Java file content using simple string matching
     */
    private fun extractPublicClassName(content: String): String? {
        val lines = content.lines()
        for (line in lines) {
            val trimmed = line.trim()
            if (trimmed.contains("public class ")) {
                // Simple extraction: find "public class ClassName"
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
    private fun hasTestMethodsInClass(content: String, className: String): Boolean {
        // Simple check: look for test annotations anywhere in the file
        return testAnnotations.any { content.contains(it) }
    }
}