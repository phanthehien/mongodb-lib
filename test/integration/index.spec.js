const chai = require('chai');
const Hapi = require('hapi');
const Path = require('path');
const Proxyquire = require('proxyquire');

const Config = require('./config');

const DummyPlugin = require('./fixtures/dummy-plugin');

const stub = { MongoModels: {} };
const ModelsPlugin = Proxyquire('../..', {
  './lib/index': stub.MongoModels
});

const { expect } = chai;

describe('Plugin', () => {
  it('it returns an error when the db connection fails', (done) => {
    const realConnect = stub.MongoModels.connect;
    stub.MongoModels.connect = function (uri, options) {
      return Promise.reject(new Error('connect failed', uri, options));
    };

    const server = new Hapi.Server();
    const Plugin = {
      register: ModelsPlugin,
      options: Config
    };

    server.connection({});

    return server.register(Plugin, (err) => {
      expect(err).to.exist;
      stub.MongoModels.connect = realConnect;
      done();
    });
  });

  it('it successfuly connects to the db and exposes the base model', (done) => {
    const server = new Hapi.Server();
    const Plugin = {
      register: ModelsPlugin,
      options: Config
    };

    server.connection({});

    return server.register(Plugin, (err) => {
      if (err) {
        return done(err);
      }

      expect(server.plugins['mongo-db-connector']).to.be.an('object');
      expect(server.plugins['mongo-db-connector'].MongoModels).to.exist;

      server.plugins['mongo-db-connector'].MongoModels.disconnect();

      return done();
    });
  });

  it('it successfuly connects to the db and exposes defined models', (done) => {
    const server = new Hapi.Server();
    const Plugin = {
      register: ModelsPlugin,
      options: {
        mongodb: Config.mongodb,
        models: {
          Dummy: Path.join(__dirname, './fixtures/dummy-model')
        }
      }
    };

    server.connection({ });
    server.register(Plugin, (err) => {

      if (err) {
        return done(err);
      }

      expect(server.plugins['mongo-db-connector']).to.be.an('object');
      expect(server.plugins['mongo-db-connector'].Dummy).to.exist;

      server.plugins['mongo-db-connector'].MongoModels.disconnect();

      return done();
    });
  });

  it('it successfuly connects to the db and exposes defined models (with absolute paths)', (done) => {
    const server = new Hapi.Server();
    const Plugin = {
      register: ModelsPlugin,
      options: {
        mongodb: Config.mongodb,
        models: {
          Dummy: Path.join(__dirname, './fixtures/dummy-model')
        }
      }
    };

    server.connection({});
    server.register(Plugin, (err) => {
      if (err) {
        return done(err);
      }

      expect(server.plugins['mongo-db-connector']).to.be.an('object');
      expect(server.plugins['mongo-db-connector'].Dummy).to.exist;

      server.plugins['mongo-db-connector'].MongoModels.disconnect();

      return done();
    });
  });

  it('it successfuly connects to the db, exposes defined models and skips indexing', (done) => {
    const server = new Hapi.Server();
    const Plugin = {
      register: ModelsPlugin,
      options: {
        mongodb: Config.mongodb,
        models: {
          Dummy: Path.join(__dirname, './fixtures/dummy-model')
        },
        autoIndex: false
      }
    };

    server.connection({});
    server.register(Plugin, (err) => {
      if (err) {
        return done(err);
      }

      return server.start((err) => {
        if (err) {
          return done(err);
        }

        expect(server.plugins['mongo-db-connector']).to.be.an('object');
        expect(server.plugins['mongo-db-connector'].Dummy).to.exist;

        server.plugins['mongo-db-connector'].MongoModels.disconnect();

        return done();
      });
    });
  });

  it('it skips calling `createIndexes` when none are defined', (done) => {
    const server = new Hapi.Server();
    const Plugin = {
      register: ModelsPlugin,
      options: {
        mongodb: Config.mongodb,
        models: {
          NoIndex: Path.join(__dirname, './fixtures/noindex-model')
        }
      }
    };

    server.connection({});
    server.register(Plugin, (err) => {
      if (err) {
        return done(err);
      }

      return server.start((err) => {
        if (err) {
          return done(err);
        }

        expect(server.plugins['mongo-db-connector']).to.be.an('object');
        expect(server.plugins['mongo-db-connector'].NoIndex).to.exist;

        server.plugins['mongo-db-connector'].MongoModels.disconnect();

        return done();
      });
    });
  });

  it('it allows models to be added dynamically specifically during another plugin\'s registration', (done) => {
    const server = new Hapi.Server();
    const hapiMongoModelsPlugin = {
      register: ModelsPlugin,
      options: {
        mongodb: Config.mongodb
      }
    };
    const plugins = [hapiMongoModelsPlugin, DummyPlugin];
    server.connection({ });
    server.register(plugins, (err) => {
      if (err) {
        return done(err);
      }

      return server.start((err) => {
        expect(server.plugins['mongo-db-connector']).to.be.an('object');
        expect(server.plugins['mongo-db-connector'].Dummy).to.exist;
        server.plugins['mongo-db-connector'].MongoModels.disconnect();
        return done(err);
      });
    });
  });
});
