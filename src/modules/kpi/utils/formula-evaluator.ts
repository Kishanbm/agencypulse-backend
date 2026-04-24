import { Parser } from 'expr-eval';
import { BadRequestException } from '@nestjs/common';

// Only allow these characters in a formula — prevents injection of any kind
const SAFE_FORMULA_REGEX = /^[a-zA-Z0-9_\s+\-*/().]+$/;
const parser = new Parser();

/**
 * Validates and parses a user-defined formula string.
 * Extracts variable names and verifies syntax.
 * Returns variable keys used in the formula.
 */
export function validateFormula(formula: string): string[] {
  if (!SAFE_FORMULA_REGEX.test(formula)) {
    throw new BadRequestException(
      'Formula contains invalid characters. Only alphanumeric identifiers and +, -, *, /, (, ) are allowed.',
    );
  }
  if (formula.length > 500) {
    throw new BadRequestException('Formula must be 500 characters or fewer.');
  }

  let expr;
  try {
    expr = parser.parse(formula);
  } catch {
    throw new BadRequestException(`Invalid formula syntax: ${formula}`);
  }

  return expr.variables();
}

/**
 * Evaluates a validated formula with the given variable values.
 * Returns null if denominator would be zero or result is not finite.
 */
export function evaluateFormula(
  formula: string,
  variables: Record<string, number>,
): number | null {
  try {
    const expr = parser.parse(formula);
    const result = expr.evaluate(variables);
    if (!isFinite(result) || isNaN(result)) return null;
    return Math.round(result * 1000000) / 1000000; // 6dp precision
  } catch {
    return null;
  }
}
