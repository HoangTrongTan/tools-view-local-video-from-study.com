'use strict';

/** Phát video, phụ đề và các file giao diện tĩnh trong public/. */

const fsp = require('node:fs').promises;
const path = require('node:path');
const { paths } = require('../config');
const { json, sendFile } = require('../http/response');
const library = require('../services/library');
const { streamVideo, srtToVtt } = require('../services/media');

const staticFiles = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/favicon.ico': ['favicon.ico', 'image/x-icon']
};

module.exports = [
  {
    method: ['GET', 'HEAD'], path: '/video',
    async handler({ req, res, url }) {
      const file = await library.videoPath(url.searchParams.get('name'));
      return streamVideo(req, res, file, await fsp.stat(file));
    }
  },
  {
    method: 'GET', path: '/subtitle',
    async handler({ res, url }) {
      const file = await library.videoPath(url.searchParams.get('name'));
      const subtitle = await library.subtitlePath(file);
      if (!subtitle) return json(res, 404, { error: 'Không có phụ đề.' });
      res.writeHead(200, { 'Content-Type': 'text/vtt; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(srtToVtt(await fsp.readFile(subtitle, 'utf8')));
    }
  },
  ...Object.entries(staticFiles).map(([route, [filename, type]]) => ({
    method: 'GET', path: route,
    handler: ({ res }) => sendFile(res, path.join(paths.publicDir, filename), type)
  }))
];
