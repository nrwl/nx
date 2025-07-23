#!/usr/bin/env node

console.log('🤖 Testing AI Agent Detection');
console.log('================================');

// Show current environment
console.log('\n📋 Current Environment Variables:');
const aiVars = ['CLAUDECODE', 'REPL_ID'];
aiVars.forEach((varName) => {
  const value = process.env[varName];
  console.log(`  ${varName}: ${value ? '✅ ' + value : '❌ not set'}`);
});

// Check if any AI agent variables are present
const hasAiAgent = aiVars.some((varName) => process.env[varName]);

console.log('\n🔍 AI Agent Detection Result:');
console.log(
  `  Result: ${hasAiAgent ? '✅ AI AGENT DETECTED' : '❌ No AI agent detected'}`
);

// No simulation - just show current state

console.log('\n✨ Test Complete!');
console.log(
  '\n📝 Note: This simulates the detection logic. Once the native module is built,'
);
console.log(
  '   you can import { isAiAgent } from "./packages/nx/src/native" to test the actual Rust implementation.'
);

process.exit(hasAiAgent ? 0 : 1);
