/**
 * Index des Contrôleurs
 * AgriSmart CI - Système Agricole Intelligent
 */

const authController = require('./authController');
const usersController = require('./usersController');
const parcellesController = require('./parcellesController');
const capteursController = require('./capteursController');
const mesuresController = require('./mesuresController');
const alertesController = require('./alertesController');
const culturesController = require('./culturesController');
const maladiesController = require('./maladiesController');
const recommandationsController = require('./recommandationsController');
const marketplaceController = require('./marketplaceController');
const formationsController = require('./formationsController');
const messagesController = require('./messagesController');

module.exports = {
  authController,
  usersController,
  parcellesController,
  capteursController,
  mesuresController,
  alertesController,
  culturesController,
  maladiesController,
  recommandationsController,
  marketplaceController,
  formationsController,
  messagesController
};
