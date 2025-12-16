# Cycle Discovery Testing and Validation

## Overview

The cycle discovery feature includes comprehensive testing and validation utilities to ensure accurate detection of feedback cycles in nuclear reactions. This document describes the testing approach and validation methods.

## Test Suite

### Location
- **Test File**: `src/services/cycleDiscoveryService.test.ts`
- **Validation Utilities**: `src/services/cycleValidation.ts`

### Test Categories

#### 1. Basic Cycle Detection
Tests fundamental cycle detection functionality:
- Simple feedback cycle detection
- Energy threshold filtering
- Maximum cycle depth limits
- Empty database handling

#### 2. Cycle Metrics
Validates calculation of cycle metrics:
- Feedback ratio calculation
- Abundance score calculation
- Stability score calculation
- Energy aggregation

#### 3. Element Filtering
Tests filtering capabilities:
- Allowed elements filter
- Radioactive exclusion filter
- Abundant-only filter

#### 4. Cycle Ranking
Validates sorting and ranking:
- Energy-based ranking
- Multi-criteria sorting

#### 5. Known Cycle Examples
Tests against documented cycles:
- **CNO Cycle**: Stellar nucleosynthesis cycle (H-1 + C-12 → ... → C-12)
- **Li-6 Cycle**: Single-nuclide cycle with high feedback ratio
- **H-1 + B-11 Cycle**: CNO-like cycle with high natural abundance

#### 6. Algorithm Validation
Tests cycle detection logic:
- Feedback path identification
- Multiple feedback paths
- Cycle closure detection

#### 7. Cycle Validation
Validates cycle structure and calculations:
- Energy calculation validation
- Structure validation
- Comparison against known patterns

## Known Cycle Patterns

The validation service includes known cycle patterns from literature:

### CNO Cycle
```
H-1 + C-12 → N-13 → C-13 + e+
H-1 + C-13 → N-14
H-1 + N-14 → O-15 → N-15 + e+
H-1 + N-15 → C-12 + He-4
Net: 4 H-1 → He-4 + 2 e+ + 2 neutrinos
Total Energy: ~26.7 MeV
```

### Li-6 Cycle
```
Li-6 + Li-6 → C-12 (28.18 MeV)
C-12 + Li-6 → O-18 (14.87 MeV) ← Feedback
O-18 + Li-6 → Mg-24 (27.24 MeV) ← Feedback
Mg-24 + Li-6 → Si-30 (24.60 MeV) ← Feedback
Total Energy: ~95.09 MeV
Feedback Ratio: 75%
```

### H-1 + B-11 Cycle
```
H-1 + B-11 → C-12 (15.96 MeV)
C-12 + H-1 → C-13 (4.16 MeV) ← Feedback
C-13 + H-1 → N-14 (7.39 MeV) ← Feedback
N-14 + H-1 → N-15 (10.21 MeV) ← Feedback
Total Energy: ~37.72 MeV
Feedback Ratio: 75%
Natural Abundance: Very high (H-1 ~100%, B-11 ~80%)
```

## Validation Utilities

### `validateCycleAgainstKnown(cycle, tolerance)`
Compares a discovered cycle against known cycle patterns:
- Returns match status and similarity score
- Can identify cycles matching documented patterns
- Useful for validating algorithm correctness

### `validateCycleEnergy(cycle)`
Validates energy calculations:
- Checks if sum of reaction energies matches total energy
- Detects calculation errors
- Returns detailed energy breakdown

### `validateCycleStructure(cycle)`
Validates cycle structure:
- Checks for missing fuel nuclides
- Validates metric ranges (0-100)
- Detects structural inconsistencies

## External Database Integration

The validation system is designed to be extended with external database integration:

### Potential Data Sources

1. **EXFOR Database** (IAEA)
   - Experimental nuclear reaction data
   - Over 22,000 experiments
   - Detailed reaction cross-sections

2. **NNDC Databases** (Brookhaven)
   - Evaluated Nuclear Data File (ENDF)
   - Nuclear structure data
   - Recommended values

3. **JINA Reaclib Database**
   - Nuclear reaction rates
   - Astrophysical model calculations
   - Multiple rate versions

### Integration Approach

To integrate external databases:

1. Create data parsers for database formats
2. Map database reactions to our cycle format
3. Use `validateCycleAgainstKnown()` to compare
4. Add new known cycles to `KNOWN_CYCLES` constant

## Running Tests

```bash
# Run all tests
npm test

# Run cycle discovery tests only
npm test -- cycleDiscoveryService.test.ts

# Run with coverage
npm run test:coverage

# Run in watch mode
npm test -- --watch
```

## Test Coverage

The test suite covers:
- ✅ Basic cycle detection
- ✅ Energy threshold filtering
- ✅ Cycle depth limits
- ✅ Element filtering
- ✅ Cycle ranking
- ✅ Known cycle patterns
- ✅ Algorithm validation
- ✅ Energy calculation validation
- ✅ Structure validation
- ✅ Edge cases

## Future Enhancements

1. **Database Integration**: Connect to EXFOR/NNDC for real validation data
2. **Performance Testing**: Test with large reaction graphs
3. **Visualization Testing**: Test cycle visualization components
4. **E2E Testing**: Test full user workflow
5. **Benchmarking**: Compare against other cycle detection algorithms

## References

- [EXFOR Database](https://www.iaea.org/resources/databases/experimental-nuclear-reaction-data)
- [NNDC Databases](https://www.nndc.bnl.gov/)
- [JINA Reaclib](https://reaclib.jinaweb.org/)
- Issue #92: Feedback Cycle Discovery Feature



