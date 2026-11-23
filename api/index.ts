import type { Request, Response } from 'express';
import app from '../server.ts';

/**
 * Vercel Serverless Function entry point
 * Bridges incoming Vercel API requests to the Express backend while preserving /api/* subpaths.
 */
export default function handler(req: Request, res: Response) {
  const urlObj = new URL(req.url || '/api', 'http://localhost');
  const queryParam = req.query?.__vercel_path;
  const vercelPathRaw = queryParam ?? urlObj.searchParams.get('__vercel_path') ?? undefined;
  const vercelPath = Array.isArray(vercelPathRaw) ? vercelPathRaw.join('/') : vercelPathRaw;

  if (typeof vercelPath === 'string' && vercelPath.trim().length > 0) {
    urlObj.searchParams.delete('__vercel_path');
    const cleanSubPath = vercelPath.replace(/^\/+/, '');
    const restoredUrl = `/api/${cleanSubPath}${urlObj.search}`;
    req.url = restoredUrl;
    (req as Request & { originalUrl?: string }).originalUrl = restoredUrl;
  } else if (req.url && !req.url.startsWith('/api')) {
    const normalized = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    req.url = normalized;
    (req as Request & { originalUrl?: string }).originalUrl = normalized;
  }

  return app(req, res);
}
