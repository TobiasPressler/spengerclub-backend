const express = require('express');
const logger = require('winston');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const app = express();

const dataProvider = require('./libs/dataProvider');
const timetableEndpoint = require('./endpoints/timetableEndpoint');
const definitionsEndpoint = require('./endpoints/definitionsEndpoint');
const freeRoomsEndpoint = require('./endpoints/freeRoomsEndpoint');

const httpPort = 4500;

var dev = false;

const originChecker = (req, res, next) => {
  var origin = req.headers.origin ? req.headers.origin : req.headers.referer.substring(0, 'https://spenger.club'.length);

  if ((!origin || (origin != 'https://spenger.club' && origin != 'http://localhost:5000'))) {
    logger.info('Declining request from bad origin: ' + origin);
    res.status(400).end('Bad Request');
  } else next();
}

const jsonParser = bodyParser.json();

function init() {
  process.env.NODE_ENV = 'production';
  setupWinston();
  setupExpress();

  dev = fs.existsSync('dev');
  if (dev) logger.info('Development environment detected!');

  dataProvider.setup(logger);

  timetableEndpoint(app, logger, originChecker, jsonParser, dataProvider);
  definitionsEndpoint(app, logger, originChecker, jsonParser, dataProvider);
  freeRoomsEndpoint(app, logger, originChecker, jsonParser, dataProvider);

  app.listen(httpPort, () => {
    logger.info('Http server running on port ' + httpPort);
  }).on('error', function(err) {
    logger.error('Express error: ' + err);
  });
}

function setupExpress() {
  // app.use(minify());
  app.use(express.static('/home/trailerpark/spengerclub/static'));

  app.get('*', (req, res) => {
    // res.end('Hello Worlderino! Auto deploy works!!');
    res.sendFile('/home/trailerpark/spengerclub/static/index.html');
  });
}

function setupWinston() {
  logger.remove(logger.transports.Console);
  logger.add(logger.transports.Console, {
    timestamp: () => {
      var now = new Date();
      return now.toDateString() + " - " + now.toLocaleTimeString()
    },
    colorize: true,
    handleExceptions: false
  });
}

init();
