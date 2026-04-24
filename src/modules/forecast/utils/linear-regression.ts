/**
 * Ordinary Least Squares linear regression.
 * Pure math — no dependencies, unit-testable.
 */

export interface RegressionResult {
  slope: number;
  intercept: number;
  r2: number;            // 0–1, goodness of fit
  residualStdDev: number; // used for confidence interval
  direction: 'UP' | 'DOWN' | 'FLAT';
  lowConfidence: boolean; // true when r2 < 0.3 (FIX #4)
}

export interface ForecastPoint {
  date: string;
  projected: number;
  lower: number;
  upper: number;
}

const FLAT_THRESHOLD = 0.02; // 2% slope-to-mean ratio = FLAT
const LOW_CONFIDENCE_R2 = 0.3;
const Z_95 = 1.96; // 95% confidence interval

export function olsRegression(values: number[]): RegressionResult {
  const n = values.length;
  const xs = values.map((_, i) => i);
  const ys = values;

  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sumX2 = xs.reduce((a, x) => a + x * x, 0);

  const denom = n * sumX2 - sumX * sumX;
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / n;

  // R²
  const meanY = sumY / n;
  const ssTot = ys.reduce((a, y) => a + (y - meanY) ** 2, 0);
  const ssRes = ys.reduce((a, y, i) => a + (y - (slope * i + intercept)) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

  // Residual std deviation (for confidence band)
  const residualStdDev = Math.sqrt(ssRes / Math.max(n - 2, 1));

  // Direction
  const absRatio = meanY !== 0 ? Math.abs(slope / meanY) : 0;
  const direction: 'UP' | 'DOWN' | 'FLAT' =
    absRatio < FLAT_THRESHOLD ? 'FLAT' : slope > 0 ? 'UP' : 'DOWN';

  return {
    slope: Math.round(slope * 10000) / 10000,
    intercept: Math.round(intercept * 10000) / 10000,
    r2: Math.round(r2 * 10000) / 10000,
    residualStdDev: Math.round(residualStdDev * 10000) / 10000,
    direction,
    lowConfidence: r2 < LOW_CONFIDENCE_R2,
  };
}

export function buildForecast(
  regression: RegressionResult,
  historyLength: number,
  forecastDays: number,
  fromDate: string,
): ForecastPoint[] {
  const startMs = Date.UTC(
    parseInt(fromDate.slice(0, 4), 10),
    parseInt(fromDate.slice(5, 7), 10) - 1,
    parseInt(fromDate.slice(8, 10), 10),
  );
  const band = regression.residualStdDev * Z_95;

  const points: ForecastPoint[] = [];
  for (let d = 1; d <= forecastDays; d++) {
    const x = historyLength - 1 + d;
    const projected = Math.max(0, regression.slope * x + regression.intercept);
    const date = new Date(startMs + d * 86_400_000).toISOString().slice(0, 10);
    points.push({
      date,
      projected: Math.round(projected * 100) / 100,
      lower: Math.max(0, Math.round((projected - band) * 100) / 100),
      upper: Math.round((projected + band) * 100) / 100,
    });
  }
  return points;
}
