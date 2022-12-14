'use strict';
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const device = require('express-device');
const requestIp = require('request-ip');
const logger = require('morgan');
const mongoose = require('mongoose');
const hpp = require('hpp');
const helmet = require('helmet');
var cors = require('cors');
const httpStatus = require('http-status');
const mongoURI = process.env.MONGODB_URI;
const otherHelper = require('./helper/others.helper');
const { AddErrorToLogs } = require('./modules/bug/bugController');
const routes = require('./routes/index');
const app = express();
// Logger middleware
if (app.get('env') === 'development') {
  app.use(logger('common'));
} else {
  app.use(logger('short'));
}
app.use(device.capture());
// Body parser middleware
// create application/json parser
app.use(
  bodyParser.json({
    limit: '50mb',
  }),
);
// create application/x-www-form-urlencoded parser
app.use(
  bodyParser.urlencoded({
    limit: '50mb',
    extended: false,
  }),
);

// protect against HTTP Parameter Pollution attacks
app.use(hpp());
app.use(helmet());

// DB Config
mongoose.Promise = global.Promise;
Promise.resolve(app)
  .then(MongoDBConnection())
  .catch((err) => console.error.bind(console, `MongoDB connection error: ${JSON.stringify(err)}`));

// Database Connection
async function MongoDBConnection() {
  await mongoose
    .connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(() => {
      console.log('\x1b[35m%s\x1b[0m', '| MongoDB Connected');
      console.log('|--------------------------------------------');
    });

  return null;
}
mongoose.connection.on('error', function (err) {
  console.log('Mongoose default connection has occured ' + err + ' error');
  process.exit(0);
});

mongoose.connection.on('disconnected', function () {
  console.log('Mongoose default connection is disconnected');
  process.exit(0);
});

process.on('SIGINT', function () {
  mongoose.connection.close(function () {
    console.log('Mongoose default connection is disconnected due to application termination');
    process.exit(0);
  });
});
process.on('ECONNREFUSED', function () {
  mongoose.connection.close(function () {
    console.log('Mongoose default connection is disconnected due to application termination');
    process.exit(0);
  });
});

// CORS setup for dev

app.use(function (req, res, next) {
  req.client_ip_address = requestIp.getClientIp(req);
  // res.header('Access-Control-Allow-Origin', '*');
  // res.header('Access-Control-Allow-Headers', 'Authorization, Origin, X-Requested-With, Content-Type, Accept');
  // res.header('Access-Control-Allow-Methods', 'DELETE, GET, POST, PUT, PATCH');
  // res.header('Access-Control-Allow-Credentials', true);
  next();
});
app.use(cors());

// Use Routes
app.use('/api', routes);

// catch 404 and forward to error handler
app.use((req, res, next) => {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
// no stacktraces leaked to user unless in development environment
app.use((err, req, res, next) => {
  if (err.status === 404) {
    return otherHelper.sendResponse(res, httpStatus.NOT_FOUND, false, null, err, 'Route Not Found', null);
  } else {
    console.log('\x1b[41m', err);
    let path = req.baseUrl + req.route && req.route.path;
    if (path.substr(path.length - 1) === '/') {
      path = path.slice(0, path.length - 1);
    }
    err.method = req.method;
    err.path = req.path;
    AddErrorToLogs(req, res, next, err);
    return otherHelper.sendResponse(res, httpStatus.INTERNAL_SERVER_ERROR, false, null, err, null, null);
  }
});

module.exports = app;
