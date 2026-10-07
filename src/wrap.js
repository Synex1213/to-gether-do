'use strict';

// 让 async 路由的异常统一交给 Express 错误处理中间件
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
