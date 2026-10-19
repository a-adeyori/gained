// Deterministic grading for multiple-choice and numeric answers. Pure; safe anywhere.

import type { Question } from './claude';

/**
 * Every value a typed numeric answer could mean. Accepts 0.5, .5, 1/2, -3/4, 50%, 1,000,
 * 1.2e3, 2 1/2, and a trailing unit ("9.8 m/s^2"). "50%" counts as both 0.5 and 50, so it
 * matches whichever form the question expects.
 */
export function parseNumeric(raw: string): number[] {
  let text = raw.trim().replace(/,(?=\d{3}\b)/g, '').replace(/−/g, '-');
  if (!text) return [];

  const percent = /%\s*$/.test(text);
  text = text.replace(/%\s*$/, '').trim();

  const num = String.raw`[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?`;
  const mixed = new RegExp(String.raw`^([-+]?\d+)\s+(\d+)\s*/\s*(\d+)`, 'i').exec(text);
  const fraction = new RegExp(String.raw`^(${num})\s*/\s*(${num})`, 'i').exec(text);
  const plain = new RegExp(String.raw`^(${num})`, 'i').exec(text);

  let value: number;
  if (mixed) {
    const whole = Number(mixed[1]);
    const frac = Number(mixed[2]) / Number(mixed[3]);
    value = whole < 0 || mixed[1].startsWith('-') ? whole - frac : whole + frac;
  } else if (fraction) {
    value = Number(fraction[1]) / Number(fraction[2]);
  } else if (plain) {
    value = Number(plain[1]);
  } else {
    return [];
  }
  if (!Number.isFinite(value)) return [];
  return percent ? [value / 100, value] : [value];
}

/** Absolute tolerance, never tighter than a tiny relative tolerance for float noise. */
function withinTolerance(actual: number, expected: number, tolerance: number | null) {
  const allowed = Math.max(tolerance ?? 0, Math.abs(expected) * 1e-9, 1e-12);
  return Math.abs(actual - expected) <= allowed;
}

export type DeterministicGrade = { score: number; rationale: string };

/** Returns null for written questions, which Claude grades with the rubric. */
export function gradeDeterministic(question: Question, answer: string): DeterministicGrade | null {
  if (question.type === 'multiple_choice') {
    const picked = Number(answer);
    const correct = question.correct_choice;
    if (correct === null) return null;
    const right = picked === correct;
    return {
      score: right ? 1 : 0,
      rationale: right
        ? `Correct. ${question.explanation}`
        : `The answer is "${question.choices[correct]}". ${question.explanation}`,
    };
  }
  if (question.type === 'numeric') {
    if (question.numeric_answer === null) return null;
    const expected = question.numeric_answer;
    const candidates = parseNumeric(answer);
    const right = candidates.some((c) => withinTolerance(c, expected, question.tolerance));
    const unit = question.unit ? ` ${question.unit}` : '';
    return {
      score: right ? 1 : 0,
      rationale: right
        ? `Correct. ${question.explanation}`
        : candidates.length
          ? `The answer is ${expected}${unit}. ${question.explanation}`
          : `That couldn't be read as a number. The answer is ${expected}${unit}. ${question.explanation}`,
    };
  }
  return null;
}

/** Quiz score 0-100 from per-question scores of 0-1. */
export const quizScore = (scores: number[]) =>
  scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length) * 100 : 0;
