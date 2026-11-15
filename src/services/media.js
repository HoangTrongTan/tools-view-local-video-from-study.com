'use strict';

/** Phát video (hỗ trợ Range) và chuyển phụ đề SRT sang WebVTT. */

const fs = require('node:fs');
const path = require('node:path');
const { videoMime } = require('../config');

function streamVideo(req, res, file, stat) {
  let start = 0, end = stat.size - 1, status = 200;
  const range = req.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) { res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); return res.end(); }
    if (!match[1]) { const suffix = Number(match[2]); start = Math.max(stat.size - suffix, 0); }
    else { start = Number(match[1]); if (match[2]) end = Math.min(Number(match[2]), end); }
    if (start > end || start >= stat.size) { res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); return res.end(); }
    status = 206;
  }
  const headers = { 'Content-Type': videoMime[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
  if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
  res.writeHead(status, headers);
  if (req.method === 'HEAD') return res.end();
  const stream = fs.createReadStream(file, { start, end });
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}

function srtToVtt(srt) {
  return 'WEBVTT\n\n' + srt.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
}

module.exports = { streamVideo, srtToVtt };
