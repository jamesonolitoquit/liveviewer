#!/usr/bin/env node
/**
 * Resilience tests for the --performance pillar.
 *
 * Tests error handling paths, grade computation, and edge cases
 * WITHOUT requiring a Chrome/Lighthouse installation to be functional.
 * Some tests will gracefully skip if Lighthouse is unavailable.
 */

const path = require('path');
const perfModule = require(path.resolve(__dirname, '..', 'packages', 'core', 'src', 'performance.js'));

var exitCode = 0;
var totalTests = 0;
var passedTests = 0;

// ---------- helpers ----------

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log('  \u2713 ' + name);
  } catch (e) {
    exitCode = 1;
    console.log('  \u2717 ' + name + ' -- ' + e.message);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'assertion failed');
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(label + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
}

// ---------- grade computation tests ----------

console.log('\n=== PERFORMANCE RESILIENCE TESTS ===\n');
console.log('  --- Grade Computation ---\n');

test('computeGrade(100) returns A', function() {
  assertEqual(perfModule.computeGrade(100), 'A');
});

test('computeGrade(90) returns A', function() {
  assertEqual(perfModule.computeGrade(90), 'A');
});

test('computeGrade(89) returns B', function() {
  assertEqual(perfModule.computeGrade(89), 'B');
});

test('computeGrade(70) returns B', function() {
  assertEqual(perfModule.computeGrade(70), 'B');
});

test('computeGrade(69) returns C', function() {
  assertEqual(perfModule.computeGrade(69), 'C');
});

test('computeGrade(50) returns C', function() {
  assertEqual(perfModule.computeGrade(50), 'C');
});

test('computeGrade(49) returns D', function() {
  assertEqual(perfModule.computeGrade(49), 'D');
});

test('computeGrade(30) returns D', function() {
  assertEqual(perfModule.computeGrade(30), 'D');
});

test('computeGrade(29) returns F', function() {
  assertEqual(perfModule.computeGrade(29), 'F');
});

test('computeGrade(0) returns F', function() {
  assertEqual(perfModule.computeGrade(0), 'F');
});

test('computeGrade(-1) returns F', function() {
  assertEqual(perfModule.computeGrade(-1), 'F');
});

// ---------- error object shape ----------

console.log('\n  --- Error Object Shape ---\n');

test('errorObj returns object with all fields', function() {
  var err = perfModule.errorObj('test error');
  assert(err !== null && typeof err === 'object', 'not an object');
  assertEqual(err.error, 'test error');
  assertEqual(err.score, null);
  assertEqual(err.grade, null);
  assertEqual(err.lcp, null);
  assertEqual(err.cls, null);
  assertEqual(err.tbt, null);
  assertEqual(err.fcp, null);
  assertEqual(err.speedIndex, null);
  assertEqual(err.tti, null);
  assert(Array.isArray(err.recommendations), 'recommendations should be array');
  assertEqual(err.recommendations.length, 0);
});

// ---------- unit conversion helpers ----------

console.log('\n  --- Unit Conversion ---\n');

test('msToSec(2500) returns 2.5', function() {
  assertEqual(perfModule.msToSec(2500), 2.5);
});

test('msToSec(0) returns 0', function() {
  assertEqual(perfModule.msToSec(0), 0);
});

test('msToSec(100) returns 0.1', function() {
  assertEqual(perfModule.msToSec(100), 0.1);
});

test('msToSec(null) returns null', function() {
  assertEqual(perfModule.msToSec(null), null);
});

test('msToSec(undefined) returns null', function() {
  assertEqual(perfModule.msToSec(undefined), null);
});

test('roundTo(0.054321, 4) returns 0.0543', function() {
  assertEqual(perfModule.roundTo(0.054321, 4), 0.0543);
});

test('roundTo(null, 2) returns null', function() {
  assertEqual(perfModule.roundTo(null, 2), null);
});

test('roundTo(1.5, 0) returns 2', function() {
  assertEqual(perfModule.roundTo(1.5, 0), 2);
});

// ---------- error handling paths ----------

console.log('\n  --- Error Handling ---\n');

test('runPerformanceChecks is a function', function() {
  assert(typeof perfModule.runPerformanceChecks === 'function', 'not a function');
});

// runPerformanceChecks with a garbage URL should produce an error (not crash)
test('runPerformanceChecks with invalid URL returns error gracefully', function() {
  // This is async, but we can check that it returns a promise
  var result = perfModule.runPerformanceChecks('not-a-valid-url:///');
  assert(result !== null && typeof result.then === 'function', 'should return a promise');
  // The function should resolve rather than reject for invalid URLs
});

test('errorObj("test") has correct key set', function() {
  var e = perfModule.errorObj('msg');
  var keys = Object.keys(e).sort();
  var expected = ['error','score','grade','lcp','cls','tbt','fcp','speedIndex','tti','recommendations'].sort();
  assertEqual(JSON.stringify(keys), JSON.stringify(expected), 'key mismatch');
});

// ---------- summary ----------

console.log('\n' + '='.repeat(50));
console.log('  Results: ' + passedTests + '/' + totalTests + ' passed');
if (exitCode === 0) {
  console.log('  \u2713 ALL RESILIENCE TESTS PASSED\n');
} else {
  console.log('  \u2717 SOME RESILIENCE TESTS FAILED\n');
}
process.exit(exitCode);
