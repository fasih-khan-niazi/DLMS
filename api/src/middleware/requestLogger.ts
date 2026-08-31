import { Request, Response, NextFunction } from "express";

const NOISE_PATHS = new Set(["/", "/favicon.ico", "/json/version"]);

function formatPath(url: string): string {
  const path = url.split("?")[0];
  if (path.includes("/cover-image")) {
    const base = path.replace(/\/cover-image$/, "");
    return `${base}/cover-image`.padEnd(42) + " cover";
  }
  if (path.includes("/file")) {
    const base = path.replace(/\/file$/, "");
    return `${base}/file`.padEnd(42) + " pdf";
  }
  return path.padEnd(48);
}

function formatDuration(ms: number): string {
  if (ms >= 10_000) return `${(ms / 1000).toFixed(1)}s`.padStart(6) + " SLOW";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`.padStart(6);
  return `${ms}ms`.padStart(6);
}

function formatStatus(status: number): string {
  if (status >= 500) return `${status} ERR`;
  if (status >= 400) return `${status} !  `;
  if (status === 304) return `${status}    `;
  return `${status} OK `;
}

function timestamp(): string {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

/** Structured HTTP request log — one line per request. */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const method = req.method.padEnd(5);
  const path = formatPath(req.originalUrl || req.url);

  if (NOISE_PATHS.has((req.originalUrl || req.url).split("?")[0])) {
    next();
    return;
  }

  res.on("finish", () => {
    const ms = Date.now() - start;
    const status = formatStatus(res.statusCode);
    const dur = formatDuration(ms);
    console.log(`${timestamp()}  ${method}  ${path}  ${status}  ${dur}`);
  });

  next();
}
