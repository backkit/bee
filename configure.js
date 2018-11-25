const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const yaml = require('js-yaml');
const beautifyjs = require('js-beautify').js;

const skipPrompt = process.env.NO_INTERACTIVE || process.env.NO_PROMPT ? true : false;
const skipAutoconf = process.env.NO_AUTOCONF ? true : false;

const generate = (serviceName, moduleName, config) => {
  const serviceDir = `${__dirname}/../../services`;
  const servicePath = `${__dirname}/../../services/${serviceName}.js`;
  const configDir = `${__dirname}/../../config`;
  const configPath = `${__dirname}/../../config/${serviceName}.yml`;
  const resourceBaseDir = `${__dirname}/../../res`;
  const resourceDir = `${__dirname}/../../res/${serviceName}`;

  console.log("");
  console.log(`${serviceName} service config:`);
  console.log(JSON.stringify(config, null, '  '));
  console.log("");

  // save service config
  console.log(`writing config: ${configPath}`);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, {recursive: true});
  }
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, yaml.safeDump(config, {skipInvalid: true}));
  }

  // enable service
  console.log(`creating service alias: ${servicePath}`);
  if (!fs.existsSync(serviceDir)) {
    fs.mkdirSync(serviceDir, {recursive: true});
  }
  if (!fs.existsSync(servicePath)) {
    fs.writeFileSync(servicePath, `module.exports = require('${moduleName}')`);
  }
  
  // ensure resource dir exist
  console.log(`creating resources folder: ${resourceDir}`);
  if (!fs.existsSync(resourceBaseDir)) {
    fs.mkdirSync(resourceBaseDir, {recursive: true});
  }
  if (!fs.existsSync(resourceDir)) {
    fs.mkdirSync(resourceDir, {recursive: true});
    for (let queueName in config) {
      fs.writeFileSync(`${resourceDir}/${queueName}.js`,
        beautifyjs(`
        module.exports = ({bee}) => bee.worker('${queueName}', async (job) => {
          return await true;
        });`,
        { indent_size: 2 }));
    }
  }
};

if (!skipAutoconf) {
  const packageJson = require('./package.json');
  const serviceName = 'bee';
  const moduleName = packageJson.name;
  const defaultConf = {
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
  };

  if (!skipPrompt) {
    const questions = [
      {
        type: 'input',
        name: 'default_queue_name',
        message: "default queue name",
        default: 'default',
        validate: function(value) {
          return true;
        }
      },
      {
        type: 'input',
        name: 'default_queue_redis_host',
        message: "redis host for default queue",
        default: defaultConf.default.queue.redis.host,
        validate: function(value) {
          return true;
        }
      },
      {
        type: 'input',
        name: 'default_queue_redis_port',
        message: "redis port for default queue",
        default: defaultConf.default.queue.redis.port,
        validate: function(value) {
          return ~~(value) > 0;
        }
      },
      {
        type: 'input',
        name: 'default_queue_redis_db',
        message: "redis database id for default queue",
        default: defaultConf.default.queue.redis.db,
        validate: function(value) {
          return ~~(value) >= 0;
        }
      },
      {
        type: 'input',
        name: 'default_worker_concurrency',
        message: "concurrency for default worker",
        default: defaultConf.default.worker.concurrency,
        validate: function(value) {
          return ~~(value) > 0;
        }
      },
      {
        type: 'confirm',
        name: 'default_queue_remove_on_success',
        message: "remove a job on success ?",
        default: defaultConf.default.queue.removeOnSuccess,
        validate: function(value) {
          console.log("default_queue_remove_on_success", value);
          return true;
        }
      },
      {
        type: 'confirm',
        name: 'default_queue_remove_on_failure',
        message: "remove a job on failure ?",
        default: defaultConf.default.queue.removeOnFailure,
        validate: function(value) {
          console.log("default_queue_remove_on_failure", value);
          return true;
        }
      }
    ];

    inquirer.prompt(questions).then(conf => {
      generate(serviceName, moduleName, {
        [conf.default_queue_name]: {
          queue: {
            redis: {
              host: conf.default_queue_redis_host,
              port: ~~(conf.default_queue_redis_port),
              db: ~~(conf.default_queue_redis_db)
            },
            removeOnSuccess: conf.default_queue_remove_on_success,
            removeOnFailure: conf.default_queue_remove_on_failure,
            stallInterval: defaultConf.default.queue.stallInterval,
            nearTermWindow: defaultConf.default.queue.nearTermWindow,
            delayedDebounce: defaultConf.default.queue.delayedDebounce
          },
          worker: {
            concurrency: ~~(conf.default_worker_concurrency)
          }
        }
      });
    });
  } else {
    generate(serviceName, moduleName, defaultConf);
  }
}