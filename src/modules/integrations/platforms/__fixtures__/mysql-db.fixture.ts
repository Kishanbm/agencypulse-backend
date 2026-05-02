// MySQL fixture: simulates rows returned from a user-supplied SELECT query.
// Columns must be: date (YYYY-MM-DD), metric_key (string), value (numeric).
export const rows = [
  { date: '2024-03-01', metric_key: 'sessions', value: 1250 },
  { date: '2024-03-01', metric_key: 'conversions', value: 42 },
  { date: '2024-03-02', metric_key: 'sessions', value: 1340 },
  { date: '2024-03-02', metric_key: 'conversions', value: 48 },
  { date: '2024-03-03', metric_key: 'sessions', value: 1190 },
  { date: '2024-03-03', metric_key: 'conversions', value: 38 },
];
