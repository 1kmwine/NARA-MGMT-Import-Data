import assert from 'node:assert/strict';
import { shortMinorLabel, formatMonthRange } from './format.js';

// shortMinorLabel
assert.equal(shortMinorLabel('레드 와인', '와인'), '레드');
assert.equal(shortMinorLabel('기타 와인', '와인'), '기타');
assert.equal(shortMinorLabel('맥주', '맥주'), '맥주'); // fully-consumed -> fallback to original
assert.equal(shortMinorLabel('논알콜 맥주', '맥주'), '논알콜');
assert.equal(shortMinorLabel('레드 와인', 'all'), '레드 와인'); // major === 'all' -> untouched
assert.equal(shortMinorLabel('레드 와인', null), '레드 와인'); // no major -> untouched

// formatMonthRange
assert.equal(formatMonthRange([]), '');
assert.equal(formatMonthRange([3]), '3월');
assert.equal(formatMonthRange([1, 2, 3, 4, 5]), '1~5월');
assert.equal(formatMonthRange([1, 2, 3, 5, 7, 8, 9]), '1~3월 5월 7~9월');
assert.equal(formatMonthRange([5, 1, 3, 2, 4]), '1~5월'); // unsorted input

console.log('format.selfcheck.mjs: all assertions passed');
