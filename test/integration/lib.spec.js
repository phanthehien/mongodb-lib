const chai = require('chai');
const Proxyquire = require('proxyquire');
const Joi = require('joi');

const Config = require('./config');

const stub = { mongodb: {} };
const MongoModels = Proxyquire('../../lib/index', {
  mongodb: stub.mongodb
});

const { expect } = chai;

describe('module', () => {

  it('it connects and disconnects the database by Promise', () => {
    return MongoModels.connect(Config.mongodb.uri, Config.mongodb.options)
    .then((db) => {
      expect(db).to.exist;
      expect(MongoModels.db.serverConfig.isConnected()).to.equal(true);

      return MongoModels.disconnect().then(() => {
        expect(MongoModels.db.serverConfig.isConnected()).to.equal(false);
      });
    });
  });

  it('it returns an error when the db connection fails', () => {

    const realMongoClient = stub.mongodb.MongoClient;
    stub.mongodb.MongoClient = {
      connect: function (uri, settings, callback) {
        callback(new Error('mongodb is gone'));
      }
    };

    return MongoModels.connect(Config.mongodb.uri, Config.mongodb.options)
    .catch((err) => {
      expect(err).to.exist;
      stub.mongodb.MongoClient = realMongoClient;
    });
  });

});


describe('MongoModels Validation', () => {

  it('it returns the Joi validation results of a SubClass', (done) => {

    const SubModel = class extends MongoModels {};

    SubModel.schema = Joi.object().keys({
      name: Joi.string().required()
    });

    const result = SubModel.validate();
    expect(result).to.exist;
    done();
  });


  it('it returns the Joi validation results of a SubClass instance', (done) => {

    const SubModel = class extends MongoModels {};

    SubModel.schema = Joi.object().keys({
      name: Joi.string().required()
    });

    const myModel = new SubModel({ name: 'Stimpy' });
    const result = myModel.validate();
    expect(result).to.exist;
    done();
  });
});


describe('MongoModels Result Factory', () => {

  it('it returns early when an error is present', (done) => {

    const SubModel = class extends MongoModels {};

    const callback = function (err, result) {
      expect(result).to.not.exist;
      expect(err).to.exist;
      done();
    };

    SubModel.resultFactory(callback, new Error('it Result Factory boom'), undefined);
  });


  it('it returns an instance for a single document result', (done) => {

    const SubModel = class extends MongoModels { };

    const callback = function (err, result) {
      expect(err).to.not.exist;
      expect(result).to.exist;
      done();
    };

    const document = {
      _id: '54321',
      name: 'Stimpy'
    };

    SubModel.resultFactory(callback, undefined, document);
  });

  it('it returns an instance for array result', (done) => {

    const SubModel = class extends MongoModels { };

    const callback = function (err, result) {
      expect(err).to.not.exist;
      expect(result).to.be.an('array');

      done();
    };

    const documents = [{
      _id: '54321',
      name: 'Stimpy'
    }, {
      _id: '123456',
      name: 'YpmitS'
    }];

    SubModel.resultFactory(callback, undefined, documents);
  });

  it('it returns an array of instances for a `writeOpResult` object', (done) => {

    const SubModel = class extends MongoModels { };

    const callback = function (err, docs) {
      expect(err).to.not.exist;
      expect(docs).to.be.an('array');

      docs.forEach((result) => {

        expect(result).to.be.an.instanceOf(SubModel);
      });

      done();
    };
    const docs = {
      ops: [
        { name: 'Ren' },
        { name: 'Stimpy' }
      ]
    };

    SubModel.resultFactory(callback, undefined, docs);
  });


  it('it returns a instance for a `findOpResult` object', (done) => {

    const SubModel = class extends MongoModels { };

    const callback = function (err, result) {
      expect(err).to.not.exist;
      expect(result).to.exist;
      expect(result).to.be.an.instanceOf(SubModel);
      done();
    };
    const result = {
      value: { _id: 'ren', name: 'Ren' }
    };

    SubModel.resultFactory(callback, undefined, result);
  });


  it('it returns undefined for a `findOpResult` object that missed', (done) => {

    const SubModel = class extends MongoModels { };

    const callback = function (err, result) {
      expect(err).to.not.exist;
      expect(result).to.not.exist;
      done();
    };
    const result = {
      value: null
    };

    SubModel.resultFactory(callback, undefined, result);
  });


  it('it does not convert an object into an instance without an _id property', (done) => {

    const SubModel = class extends MongoModels { };

    const callback = function (err, result) {
      expect(err).to.not.exist;
      expect(result).to.exist;
      expect(result).to.not.be.an.instanceOf(SubModel);
      done();
    };
    const document = { name: 'Ren' };

    SubModel.resultFactory(callback, undefined, document);
  });
});


describe('MongoModels Indexes', () => {

  let SubModel;

  before(() => {

    SubModel = class extends MongoModels { };
    SubModel.collection = 'submodels';

    return MongoModels.connect(Config.mongodb.uri, Config.mongodb.options);
  });


  after(() => {

    return MongoModels.disconnect();
  });


  it('it successfully creates indexes', () => {

    return SubModel.createIndexes([{ key: { username: 1 } }]).then((results) => {

      expect(results).to.exist;
    });
  });
});


describe('MongoModels Helpers', () => {

  it('it returns expected results for the fields adapter', (done) => {

    const fieldsDoc = MongoModels.fieldsAdapter('one -two three');
    expect(fieldsDoc).to.exist;
    expect(fieldsDoc.one).to.equal(true);
    expect(fieldsDoc.two).to.equal(false);
    expect(fieldsDoc.three).to.equal(true);

    const fieldsDoc2 = MongoModels.fieldsAdapter('');
    expect(Object.keys(fieldsDoc2)).to.have.length(0);
    done();
  });


  it('it returns expected results for the sort adapter', (done) => {

    const sortDoc = MongoModels.sortAdapter('one -two three');
    expect(sortDoc).to.exist;
    expect(sortDoc.one).to.equal(1);
    expect(sortDoc.two).to.equal(-1);
    expect(sortDoc.three).to.equal(1);

    const sortDoc2 = MongoModels.sortAdapter('');
    expect(Object.keys(sortDoc2)).to.have.length(0);
    done();
  });
});


describe('MongoModels Paged Find', () => {

  let SubModel;

  beforeEach(() => {

    SubModel = class extends MongoModels { };
    SubModel.collection = 'submodels';

    return MongoModels.connect(Config.mongodb.uri, Config.mongodb.options);
  });


  after(() => {
    return MongoModels.disconnect();
  });

  afterEach((done) => {
    SubModel.deleteMany({}).then(() => done()).catch(() => done());
  });

  it('it returns early when an error occurs', () => {
    const realCount = SubModel.count;
    SubModel.count = function (filter) {
      return Promise.reject(new Error('count failed with filter', filter));
    };

    const filter = {};
    let fields;
    const limit = 10;
    const page = 1;
    const sort = { _id: -1 };

    return SubModel
    .pagedFind(filter, fields, sort, limit, page)
    .catch((err) => {
      expect(err).to.exist;
      SubModel.count = realCount;
    });
  });


  it('it returns paged results', () => {

    const testDocs = [
      { name: 'Ren' },
      { name: 'Stimpy' },
      { name: 'Yak' }
    ];

    return SubModel.insertMany(testDocs).then(() => {
      const filter = {};
      let fields;
      const limit = 10;
      const page = 1;
      const sort = { _id: -1 };

      return SubModel.pagedFind(filter, fields, sort, limit, page).then((docs) => {
        expect(docs).to.exist;
        expect(docs.data).to.be.an('array');
        expect(docs.data.length).to.be.equal(3);
      });
    });
  });

  it('it returns paged results where end item is less than total', () => {

    const testDocs = [
      { name: 'Ren' },
      { name: 'Stimpy' },
      { name: 'Yak' }
    ];

    return SubModel.insertMany(testDocs).then(() => {
      const filter = {};
      let fields;
      const limit = 2;
      const page = 1;
      const sort = { _id: -1 };

      return SubModel
      .pagedFind(filter, fields, sort, limit, page)
      .then((docs) => {

        expect(docs).to.exist;
        expect(docs.data).to.be.an('array');
        expect(docs.data.length).to.be.equal(2);
      });
    });
  });


  it('it returns paged results where begin item is less than total', () => {

    const testDocs = [
      { name: 'Ren' },
      { name: 'Stimpy' },
      { name: 'Yak' }
    ];

    return SubModel
    .insertMany(testDocs)
    .then((results) => {

      expect(results).to.exist;

      const filter = { 'role.special': { $exists: true } };
      let fields;
      const limit = 2;
      const page = 1;
      const sort = { _id: -1 };

      return SubModel
      .pagedFind(filter, fields, sort, limit, page)
      .then((docs) => {

        expect(docs).to.exist;
        expect(docs.data).to.be.an('array');
        expect(docs.data.length).to.be.equal(0);
      });
    });
  });
});


describe('MongoModels Proxied Methods', () => {

  let SubModel;

  before(() => {
    SubModel = class extends MongoModels { };
    SubModel.collection = 'submodels';

    return MongoModels
    .connect(Config.mongodb.uri, Config.mongodb.options)
    .catch(err => console.log('There is error', err));
  });


  after(() => {
    return MongoModels
    .disconnect()
    .catch(err => console.log('There is error when disconnect', err));
  });

  afterEach((done) => {

    SubModel.deleteMany({}).then(() => done()).catch(() => done());
  });


  it('it inserts data and returns the results', () => {
    const testDocs = [
      { name: 'Ren' },
      { name: 'Stimpy' },
      { name: 'Yak' }
    ];

    return SubModel
    .insertMany(testDocs)
    .then((docs) => {

      expect(docs).to.exist;
      expect(docs.insertedIds).to.be.an('array');
      expect(docs.insertedIds.length).to.equal(3);
    });
  });

  it('it inserts one document and returns the result Async', () => {
    const testDoc = { name: 'Horse' };

    return SubModel
    .insertOne(testDoc)
    .then((docs) => {

      expect(docs.insertedCount).to.equal(1);
    });
  });

  it('it inserts many documents and returns the results Async', () => {

    const testDocs = [
      { name: 'Toast' },
      { name: 'Space' }
    ];

    return SubModel
    .insertMany(testDocs)
    .then((docs) => {

      expect(docs.insertedCount).to.equal(2);
    });
  });

  it('it updates a document and returns the results Async', () => {
    const testDocs = [
      { name: 'Ren' },
      { name: 'Stimpy' },
      { name: 'Yak' }
    ];

    return SubModel.insertMany(testDocs).then((results) => {

      const filter = {
        _id: results.insertedIds[0]
      };
      const update = {
        $set: { isCool: true }
      };

      return SubModel
      .updateOne(filter, update)
      .then((result) => {

        expect(result.modifiedCount).to.equal(1);
      });
    });
  });

  it('it updates a document and returns the results (with options)', () => {
    const testDocs = [
      { name: 'Ren' },
      { name: 'Stimpy' },
      { name: 'Yak' }
    ];

    return SubModel
    .insertMany(testDocs)
    .then((results) => {

      const filter = {
        _id: results.insertedIds[0]
      };
      const update = {
        $set: { isCool: true }
      };
      const options = { upsert: true };
      return SubModel
      .updateOne(filter, update, options)
      .then((result) => {

        expect(result).to.exist;
        expect(result.modifiedCount).to.equal(1);
      });
    });
  });


  it('it returns an error when updateOne fails', () => {
    const testDoc = { name: 'Ren' };
    return SubModel.insertOne(testDoc).then(() => {

      const realCollection = MongoModels.db.collection;
      MongoModels.db.collection = function () {

        return {
          updateOne: function (filter, update, options) {

            return Promise.reject(new Error('Whoops!', options));
          }
        };
      };

      const filter = {};
      const update = { $set: { isCool: true } };

      return SubModel.updateOne(filter, update).catch((err) => {

        expect(err).to.exist;
        MongoModels.db.collection = realCollection;
      });
    });

  });

  it('it updates many documents and returns the results Async', () => {
    const testDocs = [
      { name: 'Ren' },
      { name: 'Stimpy' },
      { name: 'Yak' }
    ];

    return SubModel
    .insertMany(testDocs)
    .then(() => {

      const filter = {};
      const update = { $set: { isCool: true } };

      return SubModel
      .updateMany(filter, update)
      .then((result) => {

        expect(result.modifiedCount).to.equal(3);
      });
    });
  });

  it('it updates many documents and returns the results (with options)', () => {
    const testDocs = [
      { name: 'Ren' },
      { name: 'Stimpy' },
      { name: 'Yak' }
    ];

    return SubModel
    .insertMany(testDocs)
    .then(() => {

      const filter = {};
      const update = { $set: { isCool: true } };
      const options = { upsert: true };

      return SubModel.updateMany(filter, update, options).then((result) => {

        expect(result).to.exist;
        expect(result.modifiedCount).to.equal(3);
      });
    });
  });


  it('it returns an error when updateMany fails', () => {
    const testDoc = { name: 'Ren' };
    return SubModel
    .insertOne(testDoc)
    .then(() => {

      const realCollection = MongoModels.db.collection;
      MongoModels.db.collection = function () {

        return {
          updateMany: (filter, update, options) => Promise.reject(new Error('Whoops!', options))
        };
      };

      const filter = {};
      const update = { $set: { isCool: true } };

      return SubModel.updateMany(filter, update).catch((err) => {

        expect(err).to.exist;
        MongoModels.db.collection = realCollection;
      });
    });
  });


  it('it returns aggregate results from a collection', (done) => {
    const testDocs = [
      { name: 'Ren', group: 'Friend', count: 100 },
      { name: 'Stimpy', group: 'Friend', count: 10 },
      { name: 'Yak', group: 'Foe', count: 430 }
    ];

    SubModel
    .insertMany(testDocs)
    .then(() => {

      const pipeline = [
        { $match: {} },
        { $group: { _id: '$group', total: { $sum: '$count' } } },
        { $sort: { total: -1 } }
      ];

      SubModel.aggregate(pipeline, (err, results) => {

        expect(err).to.not.exist;
        expect(results[0].total).to.equal(430);
        expect(results[1].total).to.equal(110);
        done();
      });
    });
  });

  it('it returns aggregate results from a collection Async', () => {
    const testDocs = [
      { name: 'Ren', group: 'Friend', count: 100 },
      { name: 'Stimpy', group: 'Friend', count: 10 },
      { name: 'Yak', group: 'Foe', count: 430 }
    ];

    return SubModel
    .insertMany(testDocs)
    .then(() => {

      const pipeline = [
        { $match: {} },
        { $group: { _id: '$group', total: { $sum: '$count' } } },
        { $sort: { total: -1 } }
      ];

      return SubModel
      .aggregateAsync(pipeline)
      .then((results) => {

        expect(results[0].total).to.equal(430);
        expect(results[1].total).to.equal(110);
      });
    });
  });

  it('it returns errors from a collection Async', () => {
    const testDocs = [
      { name: 'Ren', group: 'Friend', count: 100 },
      { name: 'Stimpy', group: 'Friend', count: 10 },
      { name: 'Yak', group: 'Foe', count: 430 }
    ];

    return SubModel
    .insertMany(testDocs)
    .then(() => {

      const pipeline = [
        { $match: {} },
        { $group: { _id: '$group', total: { $$$sum: '$count' } } },
        { $sort: { total: -1 } }
      ];

      return SubModel
      .aggregateAsync(pipeline)
      .then(() => {
      })
      .catch((err) => {

        expect(err).to.exist;
      });
    });
  });

  it('it returns a collection count', () => {
    const testDocs = [
      { name: 'Ren' },
      { name: 'Stimpy' },
      { name: 'Yak' }
    ];

    return SubModel.insertMany(testDocs).then(() => {
      return SubModel.count({}).then((result) => {
        expect(result).to.be.a('number');
        expect(result).to.equal(3);
      });
    });
  });


  it('it returns distinct results from a collection', () => {
    const testDocs = [
      { name: 'Ren', group: 'Friend' },
      { name: 'Stimpy', group: 'Friend' },
      { name: 'Yak', group: 'Foe' }
    ];

    return SubModel.insertMany(testDocs).then(() => {
      return SubModel.distinct('group').then((values) => {
        expect(values).to.be.an('array');
        expect(values.length).to.equal(2);
      });
    });
  });


  it('it returns a result array', () => {
    const testDocs = [
      { name: 'Ren' },
      { name: 'Stimpy' },
      { name: 'Yak' }
    ];

    return SubModel
    .insertMany(testDocs)
    .then(() => {
      return SubModel.find({}).then((docs) => {
        expect(docs).to.be.an('array');
        docs.forEach((result) => {
          expect(result).to.exist;
        });
      });
    });
  });


  it('it returns a single result', () => {
    const testDoc = { name: 'Ren' };

    return SubModel.insertOne(testDoc).then(() => {
      return SubModel.findOne({}).then((result) => {
        expect(result).to.exist;
      });
    });
  });

  it('it returns a single result via id Async', () => {
    const testDoc = { name: 'Ren' };
    return SubModel.insertOne(testDoc).then((doc) => {
      const id = doc.insertedId;

      return SubModel.findById(id)
      .then((result) => {

        expect(result).to.exist;
      });
    });
  });

  it('it returns and error when id casting fails during findById', () => {

    return SubModel.findById('NOTVALIDOBJECTID').catch((err) => {
      expect(err).to.exist;
    });
  });


  it('it updates a single document via findByIdAndUpdate', () => {
    const testDoc = { name: 'Ren' };

    return SubModel.insertOne(testDoc).then((doc) => {
      const id = doc.insertedId;
      const update = { name: 'New Name' };

      return SubModel
      .findByIdAndUpdate(id, update)
      .then((result) => {

        expect(result).to.exist;
        expect(result.value).to.exist;
      });
    });
  });


  it('it returns an error when casting fails during findByIdAndUpdate', () => {
    return SubModel
    .findByIdAndUpdate('NOTVALIDOBJECTID', {})
    .catch((err) => {
      expect(err).to.exist;
    });
  });


  it('it updates a single document via id (with options)', () => {
    const testDoc = { name: 'Ren' };

    return SubModel.insertOne(testDoc).then((doc) => {

      const id = doc.insertedId;
      const update = { name: 'New Name' };
      const options = { returnOriginal: false };

      return SubModel
      .findByIdAndUpdate(id, update, options)
      .then((result) => {

        expect(result).to.exist;
        expect(result.value).to.exist;
      });
    });
  });


  it('it updates a single document via findOneAndUpdate', () => {
    const testDoc = { name: 'Ren' };

    return SubModel
    .insertOne(testDoc)
    .then(() => {

      const filter = { name: 'Ren' };
      const update = { name: 'New Name' };

      return SubModel
      .findOneAndUpdate(filter, update)
      .then((result) => {

        expect(result).to.exist;
      });
    });
  });


  it('it updates a single document via findOneAndUpdate (with options)', () => {
    const testDoc = { name: 'Ren' };

    return SubModel.insertOne(testDoc).then(() => {
      const filter = { name: 'Ren' };
      const update = { name: 'New Name' };
      const options = { returnOriginal: true };

      return SubModel
      .findOneAndUpdate(filter, update, options)
      .then((result) => {

        expect(result).to.exist;
        expect(result.value).to.exist;
      });
    });
  });

  it('it replaces a single document via findOneAndReplace', () => {
    const testDoc = { name: 'Ren' };
    return SubModel.insertOne(testDoc).then(() => {

      const filter = { name: 'Ren' };
      const doc = { isCool: true };

      return SubModel
      .findOneAndReplace(filter, doc)
      .then((result) => {
        expect(result).to.exist;
        expect(result.value).to.exist;
      });
    });
  });


  it('it replaces a single document via findOneAndReplace', () => {
    const testDoc = { name: 'Ren' };
    return SubModel.insertOne(testDoc).then(() => {

      const filter = { name: 'Ren' };
      const doc = { isCool: true };

      return SubModel
      .findOneAndReplace(filter, doc)
      .then((result) => {
        expect(result).to.exist;
        expect(result.value).to.exist;
      });
    });
  });


  it('it replaces a single document via findOneAndReplace (with options)', () => {
    const testDoc = { name: 'Ren' };

    return SubModel.insertOne(testDoc).then(() => {

      const filter = { name: 'Ren' };
      const doc = { isCool: true };
      const options = { returnOriginal: true };

      SubModel
      .findOneAndReplace(filter, doc, options)
      .then((result) => {
        expect(result).to.exist;
      });
    });
  });

  it('it replaces one document and returns the result Async', () => {
    const testDoc = { name: 'Ren' };

    return SubModel
    .insertOne(testDoc)
    .then(() => {
      const filter = { name: 'Ren' };
      const doc = { isCool: true };

      return SubModel.replaceOne(filter, doc).then((result) => {
        expect(result).to.exist;
        expect(result.modifiedCount).to.equal(1);
      });
    });

  });

  it('it replaces one document and returns the result', () => {
    const testDoc = { name: 'Ren' };

    return SubModel
    .insertOne(testDoc)
    .then(() => {
      const filter = { name: 'Ren' };
      const doc = { isCool: true };

      return SubModel
      .replaceOne(filter, doc)
      .then((result) => {
        expect(result.result).to.exist;
        expect(result.modifiedCount).to.equal(1);
        expect(result).to.exist;
      });
    });

  });


  it('it replaces one document and returns the result (with options)', () => {
    const testDoc = { name: 'Ren' };

    return SubModel.insertOne(testDoc).then(() => {
      const filter = { name: 'Ren' };
      const doc = { isCool: true };
      const options = { upsert: true };

      return SubModel
      .replaceOne(filter, doc, options)
      .then((result) => {
        expect(result.result).to.exist;
        expect(result.modifiedCount).to.equal(1);
        expect(result).to.exist;
      });
    });
  });


  it('it returns an error when replaceOne fails', () => {
    const testDoc = { name: 'Ren' };

    return SubModel
    .insertOne(testDoc)
    .then(() => {
      const realCollection = MongoModels.db.collection;
      MongoModels.db.collection = function () {
        return {
          replaceOne: function (filter, doc, options) {
            return Promise.reject(new Error('Whoops!', options));
          }
        };
      };

      const filter = { name: 'Ren' };
      const doc = { isCool: true };

      return SubModel
      .replaceOne(filter, doc)
      .catch((err) => {
        expect(err).to.exist;
        MongoModels.db.collection = realCollection;
      });
    });
  });


  it('it deletes a document via findOneAndDelete', () => {
    const testDoc = { name: 'Ren' };

    return SubModel.insertOne(testDoc).then(() => {
      const filter = { name: 'Ren' };

      return SubModel
      .findOneAndDelete(filter)
      .then((result) => {
        expect(result).to.exist;
        expect(result.value).to.exist;
      });
    });
  });


  it('it deletes a document via findByIdAndDelete', () => {
    const testDoc = { name: 'Ren' };

    return SubModel.insertOne(testDoc).then((doc) => {
      const id = doc.insertedId;

      return SubModel
      .findByIdAndDelete(id)
      .then((result) => {

        expect(result).to.exist;
        expect(result.value).to.exist;
      });
    });
  });


  it('it deletes a single document via findByIdAndDelete (with options)', () => {
    const testDoc = { name: 'Ren' };

    return SubModel.insertOne(testDoc).then((doc) => {
      const id = doc.insertedId;
      const options = {
        projection: {
          name: 1
        }
      };

      return SubModel
      .findByIdAndDelete(id, options)
      .then((result) => {

        expect(result).to.exist;
        expect(result.value).to.exist;
      });
    });
  });


  it('it returns an error when id casting fails during findByIdAndDelete', () => {
    return SubModel.findByIdAndDelete('NOTVALIDOBJECTID').catch((err) => {
      expect(err).to.exist;
    });
  });

  it('it deletes one document via deleteOne Async', () => {
    const testDoc = { name: 'Ren' };

    return SubModel.insertOne(testDoc).then((record) => {
      const _id = record.ops[0]._id;
      return SubModel
      .deleteOne({ _id })
      .then((result) => {

        expect(result.deletedCount).to.equal(1);
      });
    });
  });

  it('it deletes one document via deleteOne', () => {
    const testDoc = { name: 'Ren' };

    return SubModel
    .insertOne(testDoc)
    .then(() => {
      return SubModel
      .deleteOne({})
      .then((result) => {

        expect(result).to.exist;
        expect(result.deletedCount).to.equal(1);
      });
    });
  });


  it('it returns an error when deleteOne fails', () => {
    const testDocs = [
      { name: 'Ren' },
      { name: 'Stimpy' }
    ];

    return SubModel
    .insertMany(testDocs)
    .then(() => {
      const realCollection = MongoModels.db.collection;
      MongoModels.db.collection = function () {
        return {
          deleteOne: function (filter) {
            return Promise.reject(new Error('Whoops!', filter));
          }
        };
      };

      return SubModel
      .deleteOne({})
      .catch((err) => {
        expect(err).to.exist;
        MongoModels.db.collection = realCollection;
      });
    });
  });

  it('it deletes multiple documents and returns the count via deleteMany Async', () => {
    const testDocs = [
      { name: 'Ren' },
      { name: 'Stimpy' }
    ];

    return SubModel.insertMany(testDocs).then(() => {
      return SubModel.deleteMany({}).then((result) => {
        expect(result.deletedCount).to.equal(2);
      });
    });
  });

  it('it deletes multiple documents and returns the count via deleteMany', () => {
    const testDocs = [
      { name: 'Ren' },
      { name: 'Stimpy' }
    ];

    return SubModel
    .insertMany(testDocs)
    .then(() => {
      SubModel
      .deleteMany({})
      .then((result) => {
        expect(result).to.exist;
        expect(result.deletedCount).to.equal(2);
      });
    });
  });


  it('it returns an error when deleteMany fails', () => {
    const testDocs = [
      { name: 'Ren' },
      { name: 'Stimpy' }
    ];

    return SubModel
    .insertMany(testDocs)
    .then((result) => {
      const realCollection = MongoModels.db.collection;
      MongoModels.db.collection = function () {
        return {
          deleteMany: function (filter) {
            return Promise.reject(new Error('Whoops!', result, filter));
          }
        };
      };

      SubModel
      .deleteMany({})
      .catch((err) => {
        expect(err).to.exist;
        MongoModels.db.collection = realCollection;
      });
    });
  });
});
