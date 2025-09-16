export type ServiceErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'BLOCK_INSERT_FAILED'
  | 'BLOCK_DELETE_FAILED'
  | 'BLOCK_LIST_FAILED'
  | 'BLOCK_CHECK_FAILED'
  | 'REPORT_INVALID_INPUT'
  | 'REPORT_INSERT_FAILED';

export class ServiceError extends Error {
  public code: ServiceErrorCode;
  public cause?: unknown;

  constructor(code: ServiceErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.cause = cause;
  }
}
