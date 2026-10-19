import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Question } from '../lib/claude';
import { gradeDeterministic, parseNumeric, quizScore } from '../lib/grading';

const base: Question = {
  id: 'q1',
  topic: 'fractions',
  skill: 'simplify',
  difficulty: 'easy',
  type: 'numeric',
  prompt: 'What is 2/4?',
  choices: [],
  correct_choice: null,
  numeric_answer: 0.5,
  tolerance: 0.001,
  unit: null,
  model_answer: '1/2',
  rubric: '',
  explanation: 'Divide top and bottom by 2.',
};

test('equivalent numeric forms are all accepted', () => {
  for (const answer of ['0.5', '.5', '1/2', '50%', ' 0.50 ', '5e-1']) {
    assert.equal(gradeDeterministic(base, answer)?.score, 1, answer);
  }
});

test('wrong and unreadable answers score zero with the answer shown', () => {
  assert.equal(gradeDeterministic(base, '0.4')?.score, 0);
  const unreadable = gradeDeterministic(base, 'half-ish');
  assert.equal(unreadable?.score, 0);
  assert.match(unreadable!.rationale, /couldn't be read/);
});

test('parses mixed numbers, negatives, thousands separators and units', () => {
  assert.deepEqual(parseNumeric('2 1/2'), [2.5]);
  assert.deepEqual(parseNumeric('-3/4'), [-0.75]);
  assert.deepEqual(parseNumeric('1,000'), [1000]);
  assert.deepEqual(parseNumeric('9.8 m/s^2'), [9.8]);
  assert.deepEqual(parseNumeric('−2'), [-2]);
});

test('a percent answer matches a question that expects the percent number', () => {
  assert.equal(gradeDeterministic({ ...base, numeric_answer: 50, tolerance: 0.5 }, '50%')?.score, 1);
});

test('multiple choice compares the chosen index', () => {
  const mc: Question = { ...base, type: 'multiple_choice', choices: ['a', 'b', 'c', 'd'], correct_choice: 2, numeric_answer: null };
  assert.equal(gradeDeterministic(mc, '2')?.score, 1);
  assert.equal(gradeDeterministic(mc, '1')?.score, 0);
});

test('written questions are left for the rubric grader', () => {
  assert.equal(gradeDeterministic({ ...base, type: 'written' }, 'because'), null);
});

test('quiz score is the mean of question scores, out of 100', () => {
  assert.equal(quizScore([1, 1, 0, 0.5, 0]), 50);
});
