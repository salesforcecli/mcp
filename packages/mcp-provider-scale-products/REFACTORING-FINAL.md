# Final Refactoring: Single Interface, Per-Instance Instructions

## Summary

Completed major simplification based on peer programmer feedback:

### Problems Identified ✅
1. **CodeFix had no "fix"** - name was misleading (only contained detection data)
2. **Redundant interfaces** - Detection and CodeFix were nearly identical
3. **Wrong instruction granularity** - One global instruction vs per-instance needs

### Solution Implemented

**Single unified interface** that serves both detection and output:

```typescript
// ONE interface for everything
interface DetectedAntipattern {
  className: string;
  methodName?: string;
  lineNumber: number;           // 1-indexed
  problematicCode: string;       // The bad code
  severity: Severity;
  fixInstruction: string;        // PER-INSTANCE instruction (added by recommender)
  entrypoints?: string;
}

interface DetectionResult {
  _id: string;
  antipatternType: AntipatternType;
  detectedInstances: DetectedAntipattern[];  // Each has its own instruction!
}
```

## Flow

```
1. Detector.detect() 
   → DetectedAntipattern[] (fixInstruction = "")

2. Recommender.addFixInstruction(detected)
   → DetectedAntipattern (fixInstruction = context-aware guidance)

3. Module.scan()
   → DetectionResult { detectedInstances: [...] }
```

## Key Benefits

1. **No redundancy**: Eliminated Detection/CodeFix duplication
2. **Better naming**: "DetectedAntipattern" is clear and accurate
3. **Context-aware**: Each instance gets tailored instructions
   - HIGH severity (in loop): "⚠️ CRITICAL: Inside loop..."
   - MEDIUM severity: Regular instruction
4. **Simpler**: One interface instead of three

## Files Changed

### Source
- `src/models/detection-result.ts` - Simplified to 2 interfaces (was 3)
- `src/detectors/base-detector.ts` - Returns DetectedAntipattern[]
- `src/detectors/ggd-detector.ts` - Fills detection fields, leaves fixInstruction empty
- `src/recommenders/base-recommender.ts` - Single method: addFixInstruction()
- `src/recommenders/ggd-recommender.ts` - Adds context-aware instructions
- `src/antipatterns/antipattern-module.ts` - Simplified flow
- `src/tools/scan-apex-antipatterns-tool.ts` - Uses detectedInstances
- `src/index.ts` - Updated exports

### Tests (Need Update)
All test files need updates to use:
- `DetectedAntipattern` instead of `Detection`/`CodeFix`
- `detectedInstances` instead of `code_fixes`
- `antipatternType` instead of `suggestion_type`  
- `problematicCode` instead of `codeSnippet`/`codeLine`
- `fixInstruction` field per instance
- `addFixInstruction()` instead of `toCodeFix()`/`getFixInstruction()`

### Test Update Pattern

```typescript
// OLD
const detection: Detection = {
  type: AntipatternType.GGD,
  codeLine: "...",
  codeSnippet: "...",
  ...
};

// NEW
const detected: DetectedAntipattern = {
  problematicCode: "...",
  fixInstruction: "",  // Or actual instruction if testing recommender
  ...
};
```

## Next Steps

1. Update all test files following the pattern above
2. Run: `node node_modules/typescript/lib/tsc.js --build tsconfig.build.json`
3. Run: `node node_modules/vitest/vitest.mjs run --coverage`
4. Update CHANGELOG.md with this refactoring

## Design Validation

✅ Your peer programmer was RIGHT on all counts:
- CodeFix name was confusing
- Detection/CodeFix redundancy was unnecessary
- Per-instance instructions are needed

The new design is:
- Simpler (1 interface vs 3)
- Clearer (better names)
- More flexible (per-instance context)
- More maintainable
