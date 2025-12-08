# MCP Provider - Scale Products

**For Internal Use Only**

This npm package is currently for internal use only. Its contents may change at any time with no guarantee of compatibility with prior versions.

## Overview

This package provides MCP tools for detecting and fixing performance antipatterns in Apex code. It uses a SOLID architecture with clear separation of concerns:

- **Detectors**: Identify antipatterns using regex-based static analysis (detection only)
- **Recommenders**: Convert detections to CodeFix format and provide LLM fix instructions
- **Antipattern Modules**: Couple detectors and recommenders (recommender is optional)
- **MCP Tool**: Returns detections with fix instructions for LLM to generate actual fixes

## Features

### Currently Supported Antipatterns

#### GGD (Schema.getGlobalDescribe)
Detects usage of the expensive `Schema.getGlobalDescribe()` method with different severity levels:
- **MEDIUM**: Regular invocations
- **HIGH**: Invocations inside loops (for, while, do-while)

Provides recommendations to use `Type.forName()` or direct SObject references instead.

## Architecture

The package follows SOLID principles with a simplified, focused design:

- **Single Responsibility**: Each detector/recommender handles one antipattern
- **Open/Closed**: Easy to add new antipatterns without modifying existing code
- **Liskov Substitution**: All detectors/recommenders implement base interfaces
- **Interface Segregation**: Clean, focused interfaces - one registry instead of three
- **Dependency Inversion**: Depends on abstractions, not concrete implementations

### Design Decisions

**Single Registry Pattern**: Uses only `AntipatternRegistry` to manage modules. Removed separate `DetectorRegistry` and `RecommenderRegistry` as they were unused and added unnecessary complexity.

**Separation of Concerns**:
- **Detectors** find antipatterns and report them with metadata (line number, severity, problematic code)
- **Recommenders** convert detections to CodeFix format and provide LLM fix instructions
- **LLM** receives the detections + instructions and generates the actual fixes

**Optional Recommenders**: Antipattern modules support detection-only workflows:
- **Full workflow**: Detector + Recommender → Detections with detailed LLM fix instructions
- **Detection-only**: Just detector → Detections with basic/default instructions

This architecture ensures:
- Detectors stay focused on detection
- Recommenders provide guidance, not implementations
- LLMs have full context to generate optimal fixes

### Directory Structure

```
src/
├── models/              # Data models (DetectionResult, Severity, etc.)
├── detectors/           # Antipattern detection logic
├── recommenders/        # Recommendation generation logic
├── antipatterns/        # Modules coupling detectors + recommenders
├── tools/               # MCP tool implementations
├── provider.ts          # MCP provider registration
└── index.ts            # Package exports
```

## Development Workflow

### Prerequisites

Ensure you're in the monorepo root or the package directory for these commands.

### Essential Commands

#### Install Dependencies
```bash
# From package directory
yarn install

# Or from monorepo root
yarn workspace @salesforce/mcp-provider-scale-products install
```

#### Build
```bash
# From package directory
node node_modules/typescript/lib/tsc.js --build tsconfig.build.json --verbose

# Or from monorepo root  
yarn workspace @salesforce/mcp-provider-scale-products build
```

#### Run Tests
```bash
# From package directory
node node_modules/vitest/vitest.mjs run

# With coverage
node node_modules/vitest/vitest.mjs run --coverage

# Or from monorepo root
yarn workspace @salesforce/mcp-provider-scale-products test
```

#### Lint
```bash
# From package directory
node node_modules/eslint/bin/eslint.js **/*.ts

# Or from monorepo root
yarn workspace @salesforce/mcp-provider-scale-products lint
```

#### Clean
```bash
# From package directory
node node_modules/typescript/lib/tsc.js --build tsconfig.build.json --clean

# Or from monorepo root
yarn workspace @salesforce/mcp-provider-scale-products clean
```

### Adding a New Antipattern

#### Option 1: Full Detection + Recommendation

1. **Create Detector** (`src/detectors/your-detector.ts`):
   ```typescript
   export class YourDetector implements BaseDetector {
     getAntipatternType(): AntipatternType {
       return AntipatternType.YOUR_TYPE;
     }
     
     detect(className: string, apexCode: string): Detection[] {
       // Detection logic using regex or other static analysis
     }
   }
   ```

2. **Create Recommender** (`src/recommenders/your-recommender.ts`):
   ```typescript
   export class YourRecommender implements BaseRecommender {
     getAntipatternType(): AntipatternType {
       return AntipatternType.YOUR_TYPE;
     }
     
     generateRecommendation(detection: Detection): CodeFix {
       // Generate detailed code fix with before/after examples
     }
     
     getPromptInstruction(): string {
       // Return comprehensive LLM prompt with examples
     }
   }
   ```

3. **Register Module** (in `src/tools/scan-apex-antipatterns-tool.ts`):
   ```typescript
   const yourModule = new AntipatternModule(
     new YourDetector(),
     new YourRecommender()  // Include recommender
   );
   registry.register(yourModule);
   ```

#### Option 2: Detection-Only

For simpler antipatterns that don't need detailed recommendations:

1. **Create Detector** (same as above)

2. **Register Module** (without recommender):
   ```typescript
   const yourModule = new AntipatternModule(
     new YourDetector()
     // No recommender - will use basic code fixes
   );
   registry.register(yourModule);
   ```

The module will automatically generate basic code fixes without LLM prompts.

#### Testing & Building

4. **Add Tests**:
   - `test/detectors/your-detector.test.ts`
   - `test/recommenders/your-recommender.test.ts` (if using recommender)
   - `test/antipatterns/` (integration tests)

5. **Run Tests and Build**:
   ```bash
   node node_modules/vitest/vitest.mjs run --coverage
   node node_modules/typescript/lib/tsc.js --build tsconfig.build.json
   ```

## Usage

### As an MCP Tool

The tool `scan_apex_class_for_antipatterns` accepts:

**Input:**
- `className` (string): Name of the Apex class
- `apexCode` (string): Full Apex class source code
- `identifier` (string, optional): Unique identifier for this scan

**Output:**
- JSON detection results with code fixes
- LLM prompt instructions for generating recommendations

**Example:**
```json
{
  "_id": "org:MyClass:0:GGD",
  "antipatternType": "GGD",
  "detectedInstances": [{
    "className": "MyClass",
    "methodName": "myMethod",
    "lineNumber": 5,
    "codeBefore": "Schema.SObjectType t = Schema.getGlobalDescribe().get('Account');",
    "severity": "medium",
    "fixInstruction": "# Fix Schema.getGlobalDescribe() at line 5\n\n## Problem\n...\n\n## Fix Strategies\n..."
  }]
}
```

Each `detectedInstance` has its own context-aware `fixInstruction` that the LLM uses to generate the fix.

## Test Coverage

Current coverage: **94.26%** (36 tests passing)

- All detectors: Comprehensive test cases
- All recommenders: Recommendation generation tests
- Antipattern modules: Integration tests (including detection-only)
- MCP tool: End-to-end tests

## Contributing

When adding features:

1. Follow existing patterns and SOLID principles
2. Write tests first (TDD approach recommended)
3. Ensure all tests pass: `node node_modules/vitest/vitest.mjs run --coverage`
4. Maintain or improve code coverage (target: >85%)
5. Update this README with new antipatterns

## License

Apache-2.0
