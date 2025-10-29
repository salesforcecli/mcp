# Changelog

## Refactoring 4: Single Interface, Per-Instance Instructions (2025-10-28)

### Final Simplification
Based on peer programmer feedback, completed major architectural cleanup:

### Changed
- **Merged interfaces**: `Detection` and `CodeFix` → `DetectedAntipattern` (single interface)
- **Better naming**: `code_fixes` → `detectedInstances`, `suggestion_type` → `antipatternType`
- **Per-instance instructions**: Each `DetectedAntipattern` has its own `fixInstruction`
- **Removed global instruction**: No more `fix_instruction` at `DetectionResult` level

### Rationale
Peer programmer correctly identified:
1. **CodeFix had no "fix"** - misleading name (only contained detection data)
2. **Redundant interfaces** - Detection/CodeFix were 95% identical
3. **Wrong granularity** - Global instruction insufficient for context-aware guidance

### New Structure
```typescript
interface DetectedAntipattern {  // ONE interface for everything
  className, methodName, lineNumber, 
  codeBefore,                   // The problematic code
  severity,
  fixInstruction,               // Per-instance, context-aware
}

interface DetectionResult {
  antipatternType,
  detectedInstances: DetectedAntipattern[]  // Each has own instruction!
}
```

### Benefits
1. **No redundancy**: 1 interface instead of 3
2. **Better naming**: Clear, accurate names
3. **Context-aware**: HIGH severity gets "⚠️ CRITICAL: Inside loop..." 
4. **Simpler**: Easier to understand and maintain

### Test Results
✅ 36 tests passing (was 38, removed redundant tests)
✅ 94.26% coverage

---

## Refactoring 3: Recommenders Provide Instructions, Not Fixes (2025-10-28)

### Changed
- **CodeFix Interface**: Removed `recommendation`, `codeBefore`, `codeAfter` fields
  - Added `problematicCode` field (the code that needs fixing)
- **DetectionResult**: Added `fix_instruction` field containing LLM guidance
- **BaseRecommender Interface**:
  - Renamed `generateRecommendation()` → `toCodeFix()` (converts detection to fix format)
  - Renamed `getPromptInstruction()` → `getFixInstruction()` (returns LLM instructions)
- **GGDRecommender**: Now only converts detections and provides static LLM instructions

### Rationale
**Incorrect understanding**: Recommenders were generating actual fixed code (codeBefore/codeAfter)
**Correct understanding**: Recommenders should only provide instructions; the LLM generates the actual fixes

### Benefits
1. **Clear Separation**: Recommenders instruct, LLM fixes
2. **Simpler Code**: No complex code generation logic in recommenders
3. **More Flexible**: LLM can adapt fixes based on full context
4. **Better DX**: DetectionResult now contains everything the LLM needs

### API Changes

```typescript
// CodeFix - Before
interface CodeFix {
  recommendation: string;    // ❌ Removed
  codeBefore: string;        // ❌ Removed
  codeAfter: string;         // ❌ Removed
  problematicCode: string;   // ✅ Added
}

// DetectionResult - Before & After
interface DetectionResult {
  code_fixes: CodeFix[];
  fix_instruction: string;   // ✅ Added
}

// BaseRecommender - Before & After
interface BaseRecommender {
  toCodeFix(detection): CodeFix;        // ✅ Renamed from generateRecommendation
  getFixInstruction(): string;          // ✅ Renamed from getPromptInstruction
}
```

---

## Refactoring 2: Simplify Detection Model (2025-10-28)

### Changed
- **Detection Model**: Removed `contextBefore` and `contextAfter` fields from `Detection` interface
- **New Field**: Added `codeSnippet` field to capture the problematic code line
- **Detector Responsibility**: Detectors now focus purely on detection, not context gathering

### Rationale
The original design misunderstood the purpose of context fields:
- **Incorrect**: Capturing surrounding code lines for context
- **Correct**: Detectors should only identify the problem; recommenders handle the fix

### Benefits
1. **Clearer Separation of Concerns**: Detectors detect, recommenders recommend
2. **Simpler Detection Logic**: Removed ~60 lines of context-gathering code
3. **More Focused**: Each component has a single, well-defined responsibility
4. **Better Performance**: Less processing during detection phase

### Migration
If you were accessing `detection.contextBefore` or `detection.contextAfter`:
- Use `detection.codeSnippet` instead (contains the problematic code line)
- Context/fix generation is now handled by recommenders, not detectors

---

## Refactoring 1: Single Registry Pattern (2025-10-28)

### Removed
- `src/detectors/detector-registry.ts` (unused)
- `src/recommenders/recommender-registry.ts` (unused)

### Changed
- Made `AntipatternModule` recommender parameter optional
- Added `hasRecommender()` method to check if recommender is configured
- `getPromptInstruction()` now returns `string | undefined`

### Added
- Support for detection-only antipattern modules
- Fallback code fix generation when no recommender is provided
- Additional tests for detection-only workflow

### Rationale
Three registries were over-engineered when only one was actually used.

### Benefits
1. **Simpler Architecture**: One registry instead of three
2. **More Flexible**: Supports detection-only workflows
3. **Better Test Coverage**: 95.39% (up from 90.25%)
4. **Less Code**: ~70 lines of dead code removed

---

## Initial Release (2025-10-28)

### Added
- GGD (Schema.getGlobalDescribe) antipattern detection
- Regex-based static analysis
- Severity levels (MEDIUM, HIGH) based on context (loop detection)
- LLM prompt instructions for fix generation
- MCP tool: `scan_apex_class_for_antipatterns`
- Comprehensive test suite (40 tests, 95%+ coverage)
- SOLID architecture with extensibility in mind
