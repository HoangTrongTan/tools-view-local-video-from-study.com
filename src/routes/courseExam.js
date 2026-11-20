'use strict';

const { json, readBody } = require('../http/response');
const { courseExamPlan, createCourseExamPage } = require('../services/quiz/courseExam');

module.exports = [
  {
    method: 'GET', path: '/api/course-exam/plan',
    async handler({ res }) {
      const plan = await courseExamPlan();
      return json(res, 200, {
        contextId: plan.contextId,
        revision: plan.revision,
        pages: plan.pages,
        pageRevisions: plan.pageRevisions,
        facts: plan.facts.length,
        lessons: plan.lessonsCount
      });
    }
  },
  {
    method: 'POST', path: '/api/course-exam/page',
    async handler({ req, res }) {
      const { page } = await readBody(req);
      const plan = await courseExamPlan();
      if (!Number.isInteger(page) || page < 0 || page >= plan.pages) throw new Error('Trang đề không hợp lệ.');
      return json(res, 200, {
        contextId: plan.contextId,
        page,
        pages: plan.pages,
        pageRevision: plan.pageRevisions[page],
        questions: await createCourseExamPage(plan, page)
      });
    }
  }
];
