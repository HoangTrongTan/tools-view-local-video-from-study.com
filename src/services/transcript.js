'use strict';

/** Xử lý lời thoại lấy từ phụ đề để đưa vào prompt AI. */

function transcriptFromSrt(srt) {
  return srt.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split(/\n\s*\n/)
    .map(block => block.split('\n').filter(line => !/^\d+$/.test(line.trim()) && !/\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->/.test(line))
      .join(' ').replace(/<[^>]+>/g, '').trim()).filter(Boolean).join('\n');
}

function transcriptChunks(transcript, limit = 10000) {
  const chunks = [];
  let current = '';
  for (const line of transcript.split('\n')) {
    if (current.length + line.length + 1 > limit && current) { chunks.push(current); current = ''; }
    current += (current ? '\n' : '') + line;
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Lấy các đoạn lời thoại khớp nhiều từ khóa nhất với câu hỏi đã trả lời sai. */
function relevantExcerpt(transcript, item) {
  const lines = transcript.split('\n');
  const tokens = `${item.question} ${item.correctAnswer}`.toLocaleLowerCase('vi')
    .split(/[^\p{L}\p{N}]+/u).filter(word => word.length >= 4).slice(0, 20);
  const ranked = lines.map((line, index) => ({ index,
    score: tokens.reduce((score, word) => score + (line.toLocaleLowerCase('vi').includes(word) ? 1 : 0), 0) }))
    .sort((a, b) => b.score - a.score).slice(0, 4);
  const indices = new Set();
  for (const { index, score } of ranked) if (score > 0) for (let i = Math.max(0, index - 1); i <= Math.min(lines.length - 1, index + 1); i++) indices.add(i);
  return [...indices].sort((a, b) => a - b).map(i => lines[i]).join('\n').slice(0, 3500)
    || transcript.slice(0, 1200);
}

module.exports = { transcriptFromSrt, transcriptChunks, relevantExcerpt };
