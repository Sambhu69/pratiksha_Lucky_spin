export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  meta?: Record<string, any>;
  timestamp: string;
}

export function sendSuccess<T>(
  res: any,
  data?: T,
  message?: string,
  statusCode = 200,
  meta?: Record<string, any>
) {
  const response: ApiResponse<T> = {
    success: true,
    ...(message ? { message } : {}),
    ...(data !== undefined ? { data } : {}),
    ...(meta ? { meta } : {}),
    timestamp: new Date().toISOString(),
  };

  return res.status(statusCode).json(response);
}

