package dev.nx.maven

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Simple, readable tests for Maven analyzer
 * 
 * Think of this like testing a detective - we give it clues (plugins, sources, dependencies)
 * and see if it can figure out what's cacheable and what's not.
 */
class SimpleMavenAnalyzerTest : TestBase() {
    
    @Test
    fun `when no plugins exist, phase should not be cacheable`() {
        // Like having no instructions - can't do anything
        val result = analyzer.analyzeCacheability("compile", testProject.mockProject)
        
        assertFalse(result.cacheable)
        assertEquals("No meaningful inputs", result.reason)
        assertEquals(2, result.inputs.size()) // pom.xml + dependentTasksOutputFiles
    }
    
    @Test
    fun `when compiler plugin exists but no sources, should detect missing plugin info`() {
        // Like having a recipe but no ingredients
        testProject.withPlugin("maven-compiler-plugin", "compile", "compile")
        
        val result = analyzer.analyzeCacheability("compile", testProject.mockProject)
        
        assertFalse(result.cacheable)
        assertEquals("No meaningful inputs", result.reason)
    }
    
    @Test
    fun `when test plugin exists but no test classes, should detect missing plugin info`() {
        // Like trying to run tests with no test files
        testProject.withPlugin("maven-surefire-plugin", "test", "test")
        
        val result = analyzer.analyzeCacheability("test", testProject.mockProject)
        
        assertFalse(result.cacheable)
        assertEquals("No meaningful inputs", result.reason)
    }
    
    @Test
    fun `install phase should never be cacheable due to side effects`() {
        // Installing always has side effects - puts files in local repository
        testProject.withPlugin("maven-install-plugin", "install", "install")
        
        val result = analyzer.analyzeCacheability("install", testProject.mockProject)
        
        assertFalse(result.cacheable)
        assertEquals("No analysis available for phase 'install'", result.reason)
    }
    
    @Test
    fun `deploy phase should never be cacheable due to side effects`() {
        // Deploying has side effects - uploads to remote repository
        testProject.withPlugin("maven-deploy-plugin", "deploy", "deploy")
        
        val result = analyzer.analyzeCacheability("deploy", testProject.mockProject)
        
        assertFalse(result.cacheable)
        assertEquals("No analysis available for phase 'deploy'", result.reason)
    }
    
    @Test
    fun `clean phase should never be cacheable due to side effects`() {
        // Cleaning deletes files - definite side effect
        testProject.withPlugin("maven-clean-plugin", "clean", "clean")
        
        val result = analyzer.analyzeCacheability("clean", testProject.mockProject)
        
        assertFalse(result.cacheable)
        assertEquals("No analysis available for phase 'clean'", result.reason)
    }
    
    @Test
    fun `compile phase with sources and dependencies should try to analyze`() {
        // Like a chef with ingredients and recipe - should be able to cook
        testProject
            .withPlugin("maven-compiler-plugin", "compile", "compile")
            .withMainSources()
            .withMainResources()
            .withDependency("com.google.guava", "guava", "31.1-jre")
        
        val result = analyzer.analyzeCacheability("compile", testProject.mockProject)
        
        // Should be cacheable with meaningful inputs
        assertTrue(result.cacheable)
        assertEquals("Deterministic based on plugin parameters", result.reason)
    }
    
    @Test
    fun `test-compile phase should include test sources`() {
        // Test compilation needs both main and test sources
        testProject
            .withPlugin("maven-compiler-plugin", "test-compile", "testCompile")
            .withTestSources()
            .withTestResources()
        
        val result = analyzer.analyzeCacheability("test-compile", testProject.mockProject)
        
        assertTrue(result.cacheable)
        assertEquals("Deterministic based on plugin parameters", result.reason)
    }
    
    @Test
    fun `test phase should include test dependencies`() {
        // Testing needs compiled test classes and test dependencies
        testProject
            .withPlugin("maven-surefire-plugin", "test", "test")
            .withDependency("junit", "junit", "4.13.2", "test")
        
        val result = analyzer.analyzeCacheability("test", testProject.mockProject)
        
        assertFalse(result.cacheable)
        assertEquals("No meaningful inputs", result.reason)
    }
    
    @Test
    fun `package phase should create jar from compiled classes`() {
        // Packaging takes compiled classes and creates jar
        testProject
            .withPlugin("maven-jar-plugin", "package", "jar")
            .withMainResources()
        
        val result = analyzer.analyzeCacheability("package", testProject.mockProject)
        
        assertFalse(result.cacheable)
        assertEquals("No meaningful inputs", result.reason)
    }
    
    @Test
    fun `unknown phase should not be analyzable`() {
        // Like asking for instructions for a recipe that doesn't exist
        val result = analyzer.analyzeCacheability("custom-mystery-phase", testProject.mockProject)
        
        assertFalse(result.cacheable)
        assertEquals("No analysis available for phase 'custom-mystery-phase'", result.reason)
        assertEquals(2, result.inputs.size()) // pom.xml + dependentTasksOutputFiles
    }
}