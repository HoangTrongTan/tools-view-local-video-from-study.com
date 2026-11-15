'use strict';

const http = require('node:http');
const fsp = require('node:fs').promises;
const { host, port, paths } = require('./config');
const { json } = require('./http/response');
const { state, loadState } = require('./state/appState');
const { allowExtraNote } = require('./services/notes');
const { initContexts } = require('./services/knowledge/selection');

const routes = [
  ...require('./routes/system'),
  ...require('./routes/notes'),
  ...require('./routes/contexts'),
  ...require('./routes/quiz'),
  ...require('./routes/courseExam'),
  ...require('./routes/media')
];

function findRoute(method, pathname) {
  return routes.find(route => route.path === pathname
    && (Array.isArray(route.method) ? route.method.includes(method) : route.method === method));
}

const allowedOrigins = new Set([`http://${host}:${port}`, `http://localhost:${port}`]);

let ready = Promise.resolve();

const server = http.createServer(async (req, res) => {
  try {
    await ready;
    const url = new URL(req.url, `http://${host}:${port}`);
    // Trang web ở origin khác không được phép điều khiển server cục bộ.
    if (req.method === 'POST' && req.headers.origin && !allowedOrigins.has(req.headers.origin)) return json(res, 403, { error: 'Origin không được phép.' });
    const route = findRoute(req.method, url.pathname);
    if (!route) return json(res, 404, { error: 'Không tìm thấy.' });
    await route.handler({ req, res, url, server });
  } catch (error) {
    if (!res.headersSent) json(res, 400, { error: error.message }); else res.destroy();
  }
});

async function initialize() {
  await fsp.mkdir(paths.contextsDir, { recursive: true });
  await loadState();
  for (const item of state.pickedNotes || []) allowExtraNote(item);
  await initContexts();
}

/** Chiếm cổng trước rồi mới chuyển dữ liệu, để không đụng vào file khi một bản app khác đang chạy. */
async function start() {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => { server.off('error', reject); resolve(); });
  });
  ready = initialize();
  await ready;
  console.log(`Video tool: http://${host}:${port}`);
}

module.exports = { start, server };
