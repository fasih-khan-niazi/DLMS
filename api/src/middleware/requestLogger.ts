import { Request, Response, NextFunction } from "express";

function shortPath(url: string): string {
  const path = url.split("?")[0];
  if (path.includes("/cover-image")) return path + " (cover)";
  if (path.includes("/file")) return path + " (pdf)";
  return path;
}

/** Log every HTTP request with status and duration. */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const method = req.method;
  const path = shortPath(req.originalUrl || req.url);

  res.on("finish", () => {
    const ms = Date.now() - start;
    const status = res.statusCode;
    const tag = status >= 500 ? "ERR" : status >= 400 ? "WARN" : "OK";
    console.log(`[${tag}] ${method} ${path} ${status} ${ms}ms`);
  });

  next();
}
