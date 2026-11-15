'use strict';

/** Đọc/ghi kiến thức bài học của bộ kiến thức đang chọn và rút gọn nó để đưa vào prompt AI. */

const path = require('node:path');
const store = require('./contextStore');
const selection = require('./selection');

const sameLesson = (lesson, folder, video) => lesson.video === video
  && (!lesson.folder || path.resolve(lesson.folder).toLowerCase() === path.resolve(folder).toLowerCase());

/** Bài đã chấm của một thư mục (dấu "Đã làm", đề cuối khóa). */
async function courseLessons(folder) {
  return store.readCourseLessons(await selection.activeContextId(), path.resolve(folder));
}

/** Toàn bộ bài đã chấm trong bộ kiến thức đang chọn (để AI liên hệ và ôn tập). */
async function contextLessons() {
  return store.readAllLessons(await selection.activeContextId());
}

async function saveQuizResult(file, questions, wrongQuestions) {
  const folder = path.dirname(file), video = path.basename(file);
  const facts = questions.filter(item => !item.reviewSource && !item.extension).map(item => ({
    question: item.question.slice(0, 500), answer: item.options[item.answerIndex].slice(0, 300),
    explanation: item.explanation.slice(0, 600), needsReview: wrongQuestions.includes(item.question)
  }));
  await store.saveLessonFacts(await selection.contextForSaving(), folder, video, facts);
}

function contextForPrompt(lessons, folder, video) {
  const previous = lessons.filter(item => !sameLesson(item, folder, video)).slice(-8);
  const entries = [];
  let remaining = 5000;
  for (const lesson of previous.reverse()) {
    for (const fact of [...lesson.facts].sort((a, b) => Number(Boolean(b.needsReview)) - Number(Boolean(a.needsReview)))) {
      const text = JSON.stringify({ video: lesson.video, fact });
      if (text.length <= remaining) { entries.unshift(text); remaining -= text.length; }
    }
  }
  return entries.join('\n');
}

function reviewFacts(lessons, folder, video, count = 3) {
  const pool = lessons.filter(item => !sameLesson(item, folder, video)).flatMap(lesson =>
    lesson.facts.filter(fact => fact && fact.question && fact.answer).map(fact => ({ video: lesson.video, question: fact.question, answer: fact.answer, explanation: fact.explanation, needsReview: fact.needsReview })));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

module.exports = { courseLessons, contextLessons, saveQuizResult, contextForPrompt, reviewFacts };
