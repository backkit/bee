const path = require('path');
const autoconf = require("@backkit/autoconf");
const beautifyjs = require('js-beautify').js;

autoconf('bee')
.generator(self => {
  let arr = [
    {
      putFileOnce: self.serviceConfigMainYML,
      contentYml: self.config
    },
    {
      putFileOnce: self.serviceCodeMainJS,
      content: `module.exports = require('${self.npmModuleName}')`
    }
  ];
  for (let queueName in self.config) {
    arr.push({
      putFileOnce: `${self.serviceResourceDir}${path.sep}${queueName}.js`,
      content: beautifyjs(`
        module.exports = ({bee}) => bee.worker('${queueName}', async (job) => {
          return await true;
        });`,
        { indent_size: 2 })
    });
  }
  return arr;
})
.default(self => ({
  default: {
    queue: {
      redis: {
        host: "127.0.0.1",
        port: 6379,
        db: 0,
        options: {}
      },
      removeOnSuccess: false,
      removeOnFailure: false,
      stallInterval: 5000,
      nearTermWindow: 60000,
      delayedDebounce: 500
    },
    worker: {
      concurrency: 100
    }
  }
}))
.prompt(self => ([
  {
    if: {
      fileNotFound: self.serviceConfigMainYML
    },
    type: 'input',
    name: 'default_queue_name',
    message: "default queue name",
    default: 'default',
    validate: function(value) {
      return true;
    }
  },
  {
    if: {
      fileNotFound: self.serviceConfigMainYML
    },
    type: 'input',
    name: 'default_queue_redis_host',
    message: "redis host for default queue",
    default: self.defaultConfig.default.queue.redis.host,
    validate: function(value) {
      return true;
    }
  },
  {
    if: {
      fileNotFound: self.serviceConfigMainYML
    },
    type: 'input',
    name: 'default_queue_redis_port',
    message: "redis port for default queue",
    default: self.defaultConfig.default.queue.redis.port,
    validate: function(value) {
      return ~~(value) > 0;
    }
  },
  {
    if: {
      fileNotFound: self.serviceConfigMainYML
    },
    type: 'input',
    name: 'default_queue_redis_db',
    message: "redis database id for default queue",
    default: self.defaultConfig.default.queue.redis.db,
    validate: function(value) {
      return ~~(value) >= 0;
    }
  },
  {
    if: {
      fileNotFound: self.serviceConfigMainYML
    },
    type: 'input',
    name: 'default_worker_concurrency',
    message: "concurrency for default worker",
    default: self.defaultConfig.default.worker.concurrency,
    validate: function(value) {
      return ~~(value) > 0;
    }
  },
  {
    if: {
      fileNotFound: self.serviceConfigMainYML
    },
    type: 'confirm',
    name: 'default_queue_remove_on_success',
    message: "remove a job on success ?",
    default: self.defaultConfig.default.queue.removeOnSuccess,
    validate: function(value) {
      console.log("default_queue_remove_on_success", value);
      return true;
    }
  },
  {
    if: {
      fileNotFound: self.serviceConfigMainYML
    },
    type: 'confirm',
    name: 'default_queue_remove_on_failure',
    message: "remove a job on failure ?",
    default: self.defaultConfig.default.queue.removeOnFailure,
    validate: function(value) {
      console.log("default_queue_remove_on_failure", value);
      return true;
    }
  }

]))
.answersToConfig((self, answers) => {
  if (answers.default_queue_name) {
    return {
      [answers.default_queue_name]: {
        queue: {
          redis: {
            host: answers.default_queue_redis_host,
            port: ~~(answers.default_queue_redis_port),
            db: ~~(answers.default_queue_redis_db)
          },
          removeOnSuccess: answers.default_queue_remove_on_success,
          removeOnFailure: answers.default_queue_remove_on_failure,
          stallInterval: self.defaultConfig.default.queue.stallInterval,
          nearTermWindow: self.defaultConfig.default.queue.nearTermWindow,
          delayedDebounce: self.defaultConfig.default.queue.delayedDebounce
        },
        worker: {
          concurrency: ~~(answers.default_worker_concurrency)
        }
      }
    };
  } else {
    return {};
  }
})
.run()

