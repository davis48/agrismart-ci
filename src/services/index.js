/**
 * Index des Services
 * AgriSmart CI - Système Agricole Intelligent
 */

const smsService = require('./smsService');
const emailService = require('./emailService');
const notificationService = require('./notificationService');
const alertesService = require('./alertesService');
const weatherService = require('./weatherService');

module.exports = {
  smsService,
  emailService,
  notificationService,
  alertesService,
  weatherService
};
