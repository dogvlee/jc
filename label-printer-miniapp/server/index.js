import { createServer } from './app.js';

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8787);
const ttlDays = Number(process.env.SESSION_TTL_DAYS || 30);

// TRUST_PROXY=1 means a reverse proxy sits in front and overwrites X-Real-IP;
// without it every user behind the proxy would share one rate-limit bucket.
const trustProxy = process.env.TRUST_PROXY === '1';
function envLimit(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 && value <= 100000 ? value : fallback;
}
const rateLimit = {
  loginLimit: envLimit('AUTH_RATE_LIMIT_LOGIN', 10),
  sessionLimit: envLimit('AUTH_RATE_LIMIT_SESSION', 120),
  globalLimit: envLimit('AUTH_RATE_LIMIT_GLOBAL', 300)
};
let server;
try {
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !Number.isFinite(ttlDays) || ttlDays <= 0 || ttlDays > 90) throw new Error('监听端口或会话时限配置无效');
  server = createServer({
    databasePath: process.env.DATABASE_PATH || undefined,
    sessionTtlMs: ttlDays * 24 * 60 * 60 * 1000,
    upstreamTimeoutMs: Number(process.env.UPSTREAM_TIMEOUT_MS || 18000),
    trustProxy,
    rateLimit
  });
  server.on('error', () => { console.error('登录服务启动失败，请检查端口和服务配置'); process.exitCode = 1; server.close(); });
  server.listen(port, host, () => console.log(`商跃账号服务已监听 ${host}:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
} catch (_) {
  // Configuration and database exceptions must never dump secrets or request data.
  console.error('登录服务启动失败，请检查服务端配置及数据库目录权限');
  process.exitCode = 1;
}
