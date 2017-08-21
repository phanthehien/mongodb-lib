const Hoek = require('hoek');
const Joi = require('joi');
const Mongodb = require('mongodb');


class MongoModels {
  constructor(attrs) {
    Object.assign(this, attrs);
  }

  static connect(uri, options) {
    return new Promise((resolve, reject) => {

      Mongodb.MongoClient.connect(uri, options, (err, db) => {

        if (err) {
          return reject(err);
        }
        MongoModels.db = db;
        return resolve(db);
      });
    });
  }

  static disconnect() {
    return MongoModels.db.close();
  }

  static createIndexes(...args) {
    const collection = MongoModels.db.collection(this.collection);
    return collection.createIndexes(...args);
  }

  static validate(input) {
    return Joi.validate(input, this.schema);
  }

  validate() {
    return Joi.validate(this, this.constructor.schema);
  }

  static resultFactory(...args) {
    const next = args.shift();
    const err = args.shift();
    let result = args.shift();

    if (err) {
      args.unshift(result);
      args.unshift(err);
      return next(...args);
    }

    const Self = this;

    if (Object.prototype.toString.call(result) === '[object Array]') {
      result.forEach((item, index) => {

        result[index] = new Self(item);
      });
    }

    if (Object.prototype.toString.call(result) === '[object Object]') {
      if (result.hasOwnProperty('value') && !result.hasOwnProperty('_id')) {
        if (result.value) {
          result = new this(result.value);
        } else {
          result = undefined;
        }
      } else if (result.hasOwnProperty('ops')) {
        result.ops.forEach((item, index) => {

          result.ops[index] = new Self(item);
        });

        result = result.ops;
      } else if (result.hasOwnProperty('_id')) {
        result = new this(result);
      }
    }

    args.unshift(result);
    args.unshift(err);
    next(...args);
  }

  static pagedFind(filter, fields, sort, limit, page) {
    const self = this;
    return new Promise((resolve, reject) => {

      const output = {
        data: undefined,
        pages: {
          current: page,
          prev: 0,
          hasPrev: false,
          next: 0,
          hasNext: false,
          total: 0
        },
        items: {
          limit,
          begin: ((page * limit) - limit) + 1,
          end: page * limit,
          total: 0
        }
      };

      const fieldItems = self.fieldsAdapter(fields);
      const sortItem = self.sortAdapter(sort);

      const options = {
        limit,
        skip: (page - 1) * limit,
        sortItem
      };

      Promise.all([
        self.count(filter),
        self.find(filter, fieldItems, options)
      ]).then((results) => {

        output.items.total = results[0];
        output.data = results[1];

        // paging calculations
        output.pages.total = Math.ceil(output.items.total / limit);
        output.pages.next = output.pages.current + 1;
        output.pages.hasNext = output.pages.next <= output.pages.total;
        output.pages.prev = output.pages.current - 1;
        output.pages.hasPrev = output.pages.prev !== 0;
        if (output.items.begin > output.items.total) {
          output.items.begin = output.items.total;
        }
        if (output.items.end > output.items.total) {
          output.items.end = output.items.total;
        }

        return resolve(output);
      }).catch((err) => {

        return reject(err);
      });
    });
  }

  static fieldsAdapter(fieldsArg) {
    let fields = fieldsArg;
    if (Object.prototype.toString.call(fields) === '[object String]') {
      const document = {};

      fields = fields.split(/\s+/);
      fields.forEach((field) => {
        let fieldItem = field;

        if (fieldItem) {
          const include = !(fieldItem[0] === '-');
          if (!include) {
            fieldItem = fieldItem.slice(1);
          }
          document[fieldItem] = include;
        }
      });

      fields = document;
    }

    return fields;
  }


  static sortAdapter(sortArgs) {
    let sorts = sortArgs;
    if (Object.prototype.toString.call(sorts) === '[object String]') {
      const document = {};

      sorts = sorts.split(/\s+/);
      sorts.forEach((sort) => {
        let sortItem = sort;
        if (sortItem) {
          const order = sortItem[0] === '-' ? -1 : 1;
          if (order === -1) {
            sortItem = sortItem.slice(1);
          }
          document[sortItem] = order;
        }
      });

      sorts = document;
    }

    return sorts;
  }

  static aggregate(...args) {
    const collection = MongoModels.db.collection(this.collection);
    collection.aggregate(...args);
  }

  static aggregateAsync(...args) {
    const self = this;
    return new Promise((resolve, reject) => {
      args.push((err, results) => {

        if (err) {
          return reject(err);
        }

        return resolve(results);
      });

      const collection = MongoModels.db.collection(self.collection);
      collection.aggregate(...args);
    });
  }


  static count(...args) {
    const collection = MongoModels.db.collection(this.collection);
    return collection.count(...args);
  }


  static distinct(...args) {
    const collection = MongoModels.db.collection(this.collection);
    return collection.distinct(...args);
  }


  static find(...args) {
    const collection = MongoModels.db.collection(this.collection);
    return collection.find(...args).toArray();
  }

  static findOne(...args) {
    const collection = MongoModels.db.collection(this.collection);
    return collection.findOne(...args);
  }

  static findOneAndUpdate(...args) {
    const collection = MongoModels.db.collection(this.collection);
    const filter = args.shift();
    const doc = args.shift();
    const options = Hoek.applyToDefaults({ returnOriginal: false }, args.pop() || {});

    args.push(filter);
    args.push(doc);
    args.push(options);

    return collection.findOneAndUpdate(...args);
  }

  static findOneAndDelete(...args) {
    const collection = MongoModels.db.collection(this.collection);

    return collection.findOneAndDelete(...args);
  }

  static findOneAndReplace(...args) {
    const collection = MongoModels.db.collection(this.collection);
    const filter = args.shift();
    const doc = args.shift();
    const options = Hoek.applyToDefaults({ returnOriginal: false }, args.pop() || {});

    args.push(filter);
    args.push(doc);
    args.push(options);

    return collection.findOneAndReplace(...args);
  }

  static findById(...args) {
    const collection = MongoModels.db.collection(this.collection);
    const id = args.shift();
    let filter;

    try {
      filter = { _id: this._idClass(id) };
    } catch (exception) {
      return Promise.reject(exception);
    }

    args.unshift(filter);
    return collection.findOne(...args);
  }

  static findByIdAndUpdate(...args) {
    const collection = MongoModels.db.collection(this.collection);
    const id = args.shift();
    const update = args.shift();
    const options = Hoek.applyToDefaults({ returnOriginal: false }, args.pop() || {});
    let filter;

    try {
      filter = { _id: this._idClass(id) };
    } catch (exception) {
      return Promise.reject(exception);
    }

    return collection.findOneAndUpdate(filter, update, options);
  }

  static findByIdAndDelete(...args) {
    const collection = MongoModels.db.collection(this.collection);
    const id = args.shift();
    const options = Hoek.applyToDefaults({}, args.pop() || {});
    let filter;

    try {
      filter = { _id: this._idClass(id) };
    } catch (exception) {
      return Promise.reject(exception);
    }

    return collection.findOneAndDelete(filter, options);
  }

  static insertMany(...args) {
    const collection = MongoModels.db.collection(this.collection);
    return collection.insertMany(...args);
  }

  static insertOne(...args) {
    const collection = MongoModels.db.collection(this.collection);
    return collection.insertOne(...args);
  }

  static updateMany(...args) {
    const collection = MongoModels.db.collection(this.collection);
    const filter = args.shift();
    const update = args.shift();
    const options = Hoek.applyToDefaults({}, args.pop() || {});

    args.push(filter);
    args.push(update);
    args.push(options);

    return collection.updateMany(...args);
  }

  static updateOne(...args) {
    const collection = MongoModels.db.collection(this.collection);
    const filter = args.shift();
    const update = args.shift();
    const options = Hoek.applyToDefaults({}, args.pop() || {});

    args.push(filter);
    args.push(update);
    args.push(options);

    return collection.updateOne(...args);
  }

  static replaceOne(...args) {
    const collection = MongoModels.db.collection(this.collection);
    const filter = args.shift();
    const doc = args.shift();
    const options = Hoek.applyToDefaults({}, args.pop() || {});

    args.push(filter);
    args.push(doc);
    args.push(options);

    return collection.replaceOne(...args);
  }

  static deleteOne(...args) {
    const collection = MongoModels.db.collection(this.collection);
    return collection.deleteOne(...args);
  }

  static deleteMany(...args) {
    const collection = MongoModels.db.collection(this.collection);
    return collection.deleteMany(...args);
  }
}

MongoModels._idClass = Mongodb.ObjectID;
MongoModels.ObjectID = Mongodb.ObjectID;
MongoModels.ObjectId = MongoModels.ObjectID;

module.exports = MongoModels;
