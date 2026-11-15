'use strict';

/** Chuẩn hóa và kiểm tra JSON câu hỏi trắc nghiệm do AI trả về. */

function normalizeAiResult(result) {
  if (!Array.isArray(result)) return result;
  if (result.every(item => item && typeof item.question === 'string' && Array.isArray(item.options))) return { questions: result };
  if (result.every(item => item && typeof item.title === 'string' && Array.isArray(item.points))) return { topics: result };
  return result;
}

function parseManualQuizResponse(text) {
  let cleaned = text.trim().replace(/^﻿/, '');
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) cleaned = fence[1].trim();
  cleaned = cleaned.replace(/\\[ \t]*\r?\n/g, '\n').replace(/&#x20;|&#32;|&nbsp;/gi, ' ');
  let result = JSON.parse(cleaned);
  if (typeof result === 'string') result = JSON.parse(result);
  return normalizeAiResult(result);
}

function questionFormatRule(count) {
  return `\n\nQUY TẮC KẾT QUẢ BẮT BUỘC: Tạo ĐÚNG ${count} câu, không ít hơn và không nhiều hơn. Gốc JSON phải là MỘT object có thuộc tính "questions" là mảng đúng ${count} phần tử; KHÔNG trả mảng trực tiếp. Mỗi phần tử có question (chuỗi), options (mảng đúng 4 chuỗi khác nhau), answerIndex (số nguyên 0–3), explanation (chuỗi giải thích) và keywords (mảng chuỗi). Chỉ trả JSON hợp lệ, không Markdown, không lời dẫn. Mẫu: {"questions":[{"question":"...","options":["...","...","...","..."],"answerIndex":0,"explanation":"...","keywords":["..."]}]}.`;
}

function validateQuiz(result, minQuestions = 3, maxQuestions = 20) {
  if (!Array.isArray(result?.questions)) throw new Error('Model chưa trả object JSON có mảng "questions". Hãy thử lại hoặc dùng chế độ thủ công.');
  if (result.questions.length < minQuestions || result.questions.length > maxQuestions)
    throw new Error(`Model trả ${result.questions.length} câu, cần ${minQuestions === maxQuestions ? `đúng ${minQuestions}` : `từ ${minQuestions} đến ${maxQuestions}`} câu. Hãy thử lại hoặc dùng chế độ thủ công.`);
  const seen = new Set();
  return result.questions.map(item => {
    const question = typeof item.question === 'string' ? item.question.trim() : '';
    const options = Array.isArray(item.options) ? item.options.map(option => typeof option === 'string' ? option.trim() : '') : [];
    const answerIndex = Number(item.answerIndex);
    const explanation = typeof item.explanation === 'string' ? item.explanation.trim() : '';
    if (!question || seen.has(question.toLowerCase()) || options.length !== 4 || options.some(option => !option)
      || new Set(options.map(option => option.toLowerCase())).size !== 4
      || !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3 || !explanation) {
      throw new Error('Model tạo câu hỏi chưa đúng cấu trúc. Hãy thử lại.');
    }
    seen.add(question.toLowerCase());
    const visibleText = `${question} ${explanation}`.toLocaleLowerCase('vi');
    const keywords = Array.isArray(item.keywords) ? item.keywords.filter(word => typeof word === 'string')
      .map(word => word.trim()).filter(word => word.length > 1 && word.length <= 80
        && visibleText.includes(word.toLocaleLowerCase('vi'))).slice(0, 6) : [];
    if (!keywords.some(word => question.toLocaleLowerCase('vi').includes(word.toLocaleLowerCase('vi')))) {
      const words = question.match(/[\p{L}\p{N}_.-]{4,}/gu) || [];
      const meaningful = words.find(word => /[A-Z][a-z]|[a-z][A-Z]|[A-Z]{2,}/.test(word))
        || words.find(word => word.length >= 7) || words[0];
      if (meaningful) keywords.unshift(meaningful.slice(0, 80));
    }
    return { question, options, answerIndex, explanation, keywords };
  });
}

module.exports = { normalizeAiResult, parseManualQuizResponse, questionFormatRule, validateQuiz };
