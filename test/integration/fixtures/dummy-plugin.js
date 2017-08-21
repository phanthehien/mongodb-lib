const Dummy = require('./dummy-model');

exports.register = function (server, options, next) {
  const addModel = server.plugins['@jenius2/node-j2-mongo-models'].addModel;
  addModel('Dummy', Dummy);
  next();
};


exports.register.attributes = {
  name: 'dummy',
  version: '0.0.0',
  dependencies: ['@jenius2/node-j2-mongo-models']
};
