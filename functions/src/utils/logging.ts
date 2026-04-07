import { Request } from "express";
import * as logger from "firebase-functions/logger";
import { AuthRequest } from "../middleware/auth";

type LogMetadata = Record<string, unknown>;

function buildRequestMetadata(
  req: Request,
  extra: LogMetadata = {},
): LogMetadata {
  const authReq = req as AuthRequest;

  const metadata: LogMetadata = {
    method: req.method,
    path: req.originalUrl,
    requestId: authReq.requestId ?? null,
    uid: authReq.uid ?? null,
    ...extra,
  };

  if (Object.keys(req.params).length > 0) {
    metadata.params = req.params;
  }

  if (Object.keys(req.query).length > 0) {
    metadata.query = req.query;
  }

  return metadata;
}

export function logRouteAck(
  routeName: string,
  req: Request,
  extra: LogMetadata = {},
): void {
  logger.info(`${routeName} hit`, buildRequestMetadata(req, extra));
}

export function logRouteStep(
  routeName: string,
  req: Request,
  message: string,
  extra: LogMetadata = {},
): void {
  logger.info(`${routeName} ${message}`, buildRequestMetadata(req, extra));
}

export function logRouteError(
  routeName: string,
  req: Request,
  message: string,
  error: unknown,
  extra: LogMetadata = {},
): void {
  const errorMetadata =
    error instanceof Error
      ? { error: error.message, stack: error.stack }
      : { error };

  logger.error(`${routeName} ${message}`, {
    ...buildRequestMetadata(req, extra),
    ...errorMetadata,
  });
}
