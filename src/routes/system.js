'use strict';

/** Trạng thái app, chọn thư mục, lưu tiến độ và thoát. */

const { json, readBody } = require('../http/response');
const { state, persist } = require('../state/appState');
const library = require('../services/library');
const { chooseFolder, execFileAsync } = require('../services/windowsDialogs');

module.exports = [
  {
    method: 'POST', path: '/api/exit',
    async handler({ req, res, server }) {
      if (req.headers['x-video-tool-exit'] !== '1') return json(res, 403, { error: 'Yêu cầu thoát không hợp lệ.' });
      json(res, 200, { ok: true });
      setTimeout(async () => {
        if (process.platform === 'win32') {
          for (const image of ['ollama app.exe', 'ollama.exe']) {
            try { await execFileAsync('taskkill', ['/IM', image, '/T', '/F']); } catch {}
          }
        }
        server.closeAllConnections();
        server.close();
        setTimeout(() => process.exit(0), 1000).unref();
      }, 150).unref();
    }
  },
  { method: 'GET', path: '/api/state', handler: async ({ res }) => json(res, 200, await library.snapshot()) },
  { method: 'POST', path: '/api/folder', handler: async ({ req, res }) => json(res, 200, await library.setFolder((await readBody(req)).folder)) },
  {
    method: 'POST', path: '/api/choose',
    async handler({ res }) {
      const folder = await chooseFolder();
      return json(res, 200, folder ? await library.setFolder(folder) : await library.snapshot());
    }
  },
  {
    method: 'POST', path: '/api/progress',
    async handler({ req, res }) {
      const body = await readBody(req);
      await library.videoPath(body.current);
      const position = Number(body.position);
      if (!Number.isFinite(position) || position < 0) throw new Error('Vị trí video không hợp lệ.');
      state.current = body.current; state.position = position;
      await persist();
      return json(res, 200, { ok: true });
    }
  }
];
