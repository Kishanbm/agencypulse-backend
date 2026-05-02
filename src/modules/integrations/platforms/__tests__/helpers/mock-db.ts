// Mocks mysql2/promise and pg database drivers for Jest tests.
// Import this file in test suites that exercise services hitting MySQL or PostgreSQL/Redshift.

let mysqlRows: Record<string, unknown>[] = [];
let pgRows: Record<string, unknown>[] = [];

// Mocks mysql2/promise createConnection so services work without a real DB.
// Call mockMysqlResult(rows) before the test to set what the query returns.
export function mockMysqlResult(rows: Record<string, unknown>[]): void {
  mysqlRows = rows;
}

// Mocks pg Client so services work without a real Redshift/PostgreSQL DB.
// Call mockPgResult(rows) before the test to set what the query returns.
export function mockPgResult(rows: Record<string, unknown>[]): void {
  pgRows = rows;
}

jest.mock('mysql2/promise', () => ({
  createConnection: jest.fn().mockImplementation(async () => ({
    execute: jest.fn().mockResolvedValue([mysqlRows, []]),
    query: jest.fn().mockResolvedValue([mysqlRows, []]),
    end: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn(),
  })),
}));

jest.mock('pg', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockImplementation(async () => ({ rows: pgRows })),
    end: jest.fn().mockResolvedValue(undefined),
  })),
}));
