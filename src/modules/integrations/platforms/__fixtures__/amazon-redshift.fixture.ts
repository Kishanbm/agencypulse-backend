// Amazon Redshift fixture: simulates rows returned from a user-supplied SELECT query
// via the node-postgres (pg) driver. Columns must be: date (YYYY-MM-DD), metric_key, value.
export const rows = [
  { date: '2024-03-01', metric_key: 'ad_spend', value: 1842.50 },
  { date: '2024-03-01', metric_key: 'impressions', value: 98400 },
  { date: '2024-03-02', metric_key: 'ad_spend', value: 1930.20 },
  { date: '2024-03-02', metric_key: 'impressions', value: 103100 },
  { date: '2024-03-03', metric_key: 'ad_spend', value: 1764.80 },
  { date: '2024-03-03', metric_key: 'impressions', value: 92700 },
];
