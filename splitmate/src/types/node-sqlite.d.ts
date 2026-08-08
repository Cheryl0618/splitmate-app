declare module "node:sqlite" {
  type SQLInputValue = null | number | bigint | string | Uint8Array;

  interface StatementSync {
    all(...anonymousParameters: SQLInputValue[]): unknown[];
    get(...anonymousParameters: SQLInputValue[]): unknown;
    run(...anonymousParameters: SQLInputValue[]): unknown;
  }

  interface DatabaseSyncOptions {
    readOnly?: boolean;
  }

  export class DatabaseSync {
    constructor(path: string, options?: DatabaseSyncOptions);
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
