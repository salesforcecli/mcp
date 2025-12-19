#!/usr/bin/env node
/**
 * Extract XPath patterns from PMD Apex source code
 * 
 * This script:
 * 1. Scans PMD Apex ruleset XML files for XPath rules
 * 2. Extracts XPath expressions and their test cases
 * 3. Creates a comprehensive pattern catalog
 * 
 * Usage: node extract-xpath-patterns.js <pmd-apex-source-dir>
 */

const fs = require('fs');
const path = require('path');
const { XMLParser, XMLBuilder } = require('fast-xml-parser');

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: true,
  trimValues: true
});

function findXmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findXmlFiles(filePath, fileList);
    } else if (file.endsWith('.xml')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function extractXPathRules(xmlFilePath) {
  const content = fs.readFileSync(xmlFilePath, 'utf-8');
  const rules = [];
  
  try {
    const parsed = parser.parse(content);
    const ruleset = parsed.ruleset || parsed['test-data'];
    
    if (!ruleset) return rules;
    
    // Handle ruleset XML files
    if (ruleset.rule) {
      const ruleArray = Array.isArray(ruleset.rule) ? ruleset.rule : [ruleset.rule];
      
      ruleArray.forEach(rule => {
        if (rule['@_class'] && rule['@_class'].includes('XPathRule')) {
          const xpathProperty = rule.properties?.property?.find(p => 
            p['@_name'] === 'xpath'
          );
          
          if (xpathProperty) {
            rules.push({
              name: rule['@_name'],
              message: rule['@_message'],
              description: rule.description?.['#text'] || rule.description,
              xpath: xpathProperty.value?.['#text'] || xpathProperty.value,
              example: rule.example?.['#text'] || rule.example,
              priority: rule.priority?.['#text'] || rule.priority,
              sourceFile: xmlFilePath
            });
          }
        }
      });
    }
    
    // Handle test data XML files
    if (ruleset['test-code']) {
      const testArray = Array.isArray(ruleset['test-code']) 
        ? ruleset['test-code'] 
        : [ruleset['test-code']];
      
      testArray.forEach(test => {
        rules.push({
          testCase: true,
          description: test.description?.['#text'] || test.description,
          code: test.code?.['#text'] || test.code,
          expectedProblems: test['expected-problems']?.['#text'] || test['expected-problems'],
          expectedLineNumbers: test['expected-linenumbers']?.['#text'] || test['expected-linenumbers'],
          sourceFile: xmlFilePath
        });
      });
    }
  } catch (error) {
    console.error(`Error parsing ${xmlFilePath}:`, error.message);
  }
  
  return rules;
}

function extractTestCases(testDir) {
  const testFiles = findXmlFiles(testDir);
  const testCases = [];
  
  testFiles.forEach(file => {
    const tests = extractXPathRules(file);
    testCases.push(...tests.filter(t => t.testCase));
  });
  
  return testCases;
}

function main() {
  const pmdApexDir = process.argv[2] || path.join(__dirname, '../../../../cursorMCPTools/pmd_container/pmd/pmd-apex');
  
  if (!fs.existsSync(pmdApexDir)) {
    console.error(`PMD Apex directory not found: ${pmdApexDir}`);
    process.exit(1);
  }
  
  console.log(`Scanning PMD Apex source: ${pmdApexDir}`);
  
  const rulesetDir = path.join(pmdApexDir, 'src/main/resources/category/apex');
  const testDir = path.join(pmdApexDir, 'src/test/resources');
  
  const rulesets = findXmlFiles(rulesetDir);
  const allRules = [];
  
  console.log(`Found ${rulesets.length} ruleset files`);
  
  rulesets.forEach(file => {
    const rules = extractXPathRules(file);
    allRules.push(...rules);
    console.log(`  ${path.basename(file)}: ${rules.length} XPath rules`);
  });
  
  const testCases = extractTestCases(testDir);
  console.log(`Found ${testCases.length} test cases`);
  
  // Group rules by pattern
  const patterns = {};
  
  allRules.filter(r => !r.testCase).forEach(rule => {
    const patternKey = rule.name || 'unknown';
    if (!patterns[patternKey]) {
      patterns[patternKey] = {
        rule_name: rule.name,
        description: rule.description,
        message: rule.message,
        xpath: rule.xpath,
        example_code: rule.example,
        priority: rule.priority,
        source_file: rule.sourceFile,
        test_cases: []
      };
    }
  });
  
  // Match test cases to rules (by filename pattern)
  testCases.forEach(test => {
    const fileName = path.basename(test.sourceFile, '.xml');
    const matchingRule = Object.values(patterns).find(p => 
      p.source_file && path.basename(p.source_file, '.xml').toLowerCase().includes(fileName.toLowerCase())
    );
    
    if (matchingRule) {
      matchingRule.test_cases.push({
        description: test.description,
        code: test.code,
        expected_problems: test.expectedProblems,
        expected_line_numbers: test.expectedLineNumbers
      });
    }
  });
  
  const output = {
    metadata: {
      extracted_at: new Date().toISOString(),
      pmd_version: "7.18.0",
      total_rules: allRules.filter(r => !r.testCase).length,
      total_test_cases: testCases.length
    },
    patterns: Object.values(patterns)
  };
  
  const outputPath = path.join(__dirname, '../src/resources/custom-rules/pmd/xpath-pattern-catalog.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  console.log(`\n✅ Extracted ${output.patterns.length} XPath patterns`);
  console.log(`📝 Output written to: ${outputPath}`);
}

if (require.main === module) {
  main();
}

module.exports = { extractXPathRules, extractTestCases };

