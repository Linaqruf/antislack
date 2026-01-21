import type { MathDifficulty } from './types';

export interface MathProblem {
  question: string;    // e.g., "47 + 83"
  answer: number;      // e.g., 130
}

type Operation = '+' | '-' | '×';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate an easy math problem
 * 2-digit addition/subtraction only (e.g., 15 + 23)
 */
function generateEasyProblem(): MathProblem {
  const operations: Operation[] = ['+', '-'];
  const operation = operations[randomInt(0, 1)];

  let a: number;
  let b: number;
  let answer: number;

  if (operation === '+') {
    a = randomInt(10, 50);
    b = randomInt(10, 50);
    answer = a + b;
  } else {
    // Ensure positive result
    a = randomInt(30, 99);
    b = randomInt(10, a - 10);
    answer = a - b;
  }

  return { question: `${a} ${operation} ${b}`, answer };
}

/**
 * Generate a medium math problem
 * Multi-digit + multiplication (e.g., 47 × 8)
 */
function generateMediumProblem(): MathProblem {
  const operations: Operation[] = ['+', '-', '×'];
  const operation = operations[randomInt(0, operations.length - 1)];

  let a: number;
  let b: number;
  let answer: number;

  switch (operation) {
    case '+':
      a = randomInt(10, 99);
      b = randomInt(10, 99);
      answer = a + b;
      break;
    case '-':
      a = randomInt(50, 99);
      b = randomInt(10, a - 1);
      answer = a - b;
      break;
    case '×':
      a = randomInt(2, 12);
      b = randomInt(2, 12);
      answer = a * b;
      break;
    default:
      // Fallback for type safety - should never execute
      a = randomInt(10, 99);
      b = randomInt(10, 99);
      answer = a + b;
  }

  return { question: `${a} ${operation} ${b}`, answer };
}

/**
 * Generate a hard math problem
 * Multi-step operations with parentheses (e.g., (12 × 5) + 28)
 */
function generateHardProblem(): MathProblem {
  const type = randomInt(0, 2);

  let question: string;
  let answer: number;

  switch (type) {
    case 0: {
      // (a × b) + c
      const a = randomInt(2, 12);
      const b = randomInt(2, 12);
      const c = randomInt(10, 50);
      answer = (a * b) + c;
      question = `(${a} × ${b}) + ${c}`;
      break;
    }
    case 1: {
      // (a + b) × c
      const a = randomInt(5, 20);
      const b = randomInt(5, 20);
      const c = randomInt(2, 6);
      answer = (a + b) * c;
      question = `(${a} + ${b}) × ${c}`;
      break;
    }
    case 2:
    default: {
      // a × b - c
      const a = randomInt(5, 12);
      const b = randomInt(5, 12);
      const product = a * b;
      const c = randomInt(10, Math.min(product - 1, 50));
      answer = product - c;
      question = `${a} × ${b} - ${c}`;
      break;
    }
  }

  return { question, answer };
}

/**
 * Generate a math problem based on difficulty level
 */
export function generateMathProblem(difficulty: MathDifficulty = 'medium'): MathProblem {
  switch (difficulty) {
    case 'easy':
      return generateEasyProblem();
    case 'hard':
      return generateHardProblem();
    case 'medium':
    default:
      return generateMediumProblem();
  }
}

/**
 * Get a preview problem for the settings UI
 */
export function getPreviewProblem(difficulty: MathDifficulty): string {
  switch (difficulty) {
    case 'easy':
      return '15 + 23 = ?';
    case 'medium':
      return '47 × 8 = ?';
    case 'hard':
      return '(12 × 5) + 28 = ?';
    default:
      return '47 × 8 = ?';
  }
}

export function checkAnswer(problem: MathProblem, userAnswer: number): boolean {
  return problem.answer === userAnswer;
}
