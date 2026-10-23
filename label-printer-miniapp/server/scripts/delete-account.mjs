// Deletes one account and all of its sessions, for the owner who asks for their
// data to be removed through 反馈与投诉. Run it on the host that holds the
// database, then reply in that thread. Nothing is served over HTTP.
//
//   node scripts/delete-account.mjs --openid=oXXXX --yes
//   node scripts/delete-account.mjs --user=syu_XXXX --yes
//
// AppID comes from WECHAT_APP_ID (or --appid), the database from DATABASE_PATH
// (or --database, default server/data/auth.sqlite).
import { createStore } from '../store.js';

function argument(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const appId = argument('appid', process.env.WECHAT_APP_ID || '');
const openid = argument('openid');
const userId = argument('user');
const databasePath = argument('database', process.env.DATABASE_PATH || undefined);
const confirmed = process.argv.slice(2).includes('--yes');

if (!appId || (!openid && !userId)) {
  console.error('用法：node scripts/delete-account.mjs --openid=… 或 --user=… [--appid=…] [--database=…] --yes');
  process.exitCode = 2;
} else if (!confirmed) {
  console.error('这会永久删除该账号及其登录会话，确认请加 --yes。');
  process.exitCode = 2;
} else {
  let store;
  try {
    store = createStore({ databasePath });
    const removed = store.deleteAccount({ appId, openid, userId });
    console.log(removed ? `已删除 ${removed} 个账号及其会话` : '没有找到这个账号');
  } catch (_) {
    // Never print connection strings or SQL: they can name the private database.
    console.error('删除失败：请检查数据库路径与文件权限');
    process.exitCode = 1;
  } finally {
    if (store) store.close();
  }
}
