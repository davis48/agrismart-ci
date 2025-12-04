/**
 * Export des middlewares
 * AgriSmart CI - Système Agricole Intelligent
 */

const errorHandler = require('./errorHandler');
const auth = require('./auth');
const rbac = require('./rbac');
const validation = require('./validation');

module.exports = {
  errorHandler: errorHandler,
  AppError: errorHandler.AppError,
  errors: errorHandler.errors,
  ...auth,
  ...rbac,
  ...validation
};
