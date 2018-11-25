const redis = require("redis");
const Queue = require('bee-queue');
const bqScripts = require('bee-queue/lib/lua');

class BeeQueueService {

  /**
   * @param {String} appdir
   * @param {WinstonService} logger
   * @param {ConfigService} config
   */
  constructor({appdir, logger, config}) {
    this.appdir = appdir;
    this.logger = logger;
    this.config = config;
    this.queueProcessors = {};
  }

  /**
   * Child services should use this method to set worker function for a queue
   *
   * @param {String} queueName
   * @param {AsyncFunction} processorFn
   */
  worker(queueName, processorFn) {
    this.queueProcessors[queueName] = processorFn;
    return this;
  }

  /**
   * Returns configuration, with sane defaults for a given queue
   *
   * @param {String} name
   * @return {Object}
   */
  getQueueConfig(name) {
    const beeConfig = this.config.get('bee');
    const _queueConfig = (beeConfig[name] || {}).queue || {};
    const queueConfig = Object.assign({
        prefix: 'bq',
        stallInterval: 5000,
        nearTermWindow: 60000,
        delayedDebounce: 500,
        redis: {
          host: '127.0.0.1',
          port: 6379,
          db: 0,
          options: {}
        },
        isWorker: true,
        getEvents: true,
        sendEvents: true,
        storeJobs: true,
        ensureScripts: true,
        activateDelayedJobs: false,
        removeOnSuccess: false,
        removeOnFailure: false,
        redisScanCount: 100
    }, _queueConfig);

    // override redis retry startegy
    queueConfig.redis.retry_strategy = function(options) {
      const {attempt, total_retry_time, error, times_connected} = options;
      console.log(`redis retry strategy: attempt #${attempt}, time spent to reconnect: ${total_retry_time}, connected ${times_connected} times, err ${error?error.message:''}`);
      return 5000;
    };
    return queueConfig;
  }

  /**
   * Returns configuration, with sane defaults for a given worker
   *
   * @param {String} name - queue name
   * @return {Object}
   */
  getWorkerConfig(name) {
    const beeConfig = this.config.get('bee');
    const _workerConfig = (beeConfig[name] || {}).worker || {};
    const workerConfig = Object.assign({
      concurrency: 100
    }, _workerConfig);
    return workerConfig;
  }

  /**
   * Returns a bee queue by name
   *
   * @param {String} name
   * @return {Object}
   */
  getQueue(name) {
    const queueConfig = this.getQueueConfig(name);
    const queue = new Queue(name, queueConfig);
    return queue;
  }

  /**
   * Starts a queue processor by name
   *
   * @param {String} name - queue name
   */
  runWorker(name) {
    this.logger.info(`Starting queue ${name}...`);
    const queueConfig = this.getQueueConfig(name);
    const workerConfig = this.getWorkerConfig(name);
    const queue = this.getQueue(name);

    // health check
    setInterval(() => {
      queue
      .checkHealth()
      .then((counts) => {
        this.logger.info(`Queue ${queue.name} waiting: ${counts.waiting}, active: ${counts.active}, succeeded: ${counts.succeeded}, failed: ${counts.failed}, delayed: ${counts.delayed}, newestJob: ${counts.newestJob}`);
      })
      .catch(err => {
        this.logger.info(`Queue ${queue.name}, healthcheck failed`);
      })
    }, 5000);

    // stalled jobs checker
    queue.checkStalledJobs(5000, (err, numStalled) => {
        this.logger.info(`Queue ${queue.name} has ${numStalled} stalled jobs`);
    });
    
    // queue local events
    queue.on('ready', () => {
        this.logger.info(`Queue ${queue.name} is ready`);
    });
    queue.on('error', (err) => {
        this.logger.info(`Queue ${queue.name} received redis error: ${err.message}`);
    });
    queue.on('succeeded', (job, result) => {
        this.logger.info(`Queue ${queue.name} successfully completed job #${job.id}`);
    });
    queue.on('retrying', (job, err) => {
        this.logger.info(`Queue ${queue.name} is retrying job #${job.id} after error : ${err.message}`);
    });
    queue.on('failed', (job, err) => {
        this.logger.info(`Queue ${queue.name} received error on job #${job.id} : ${err.message}`);
    });
    queue.on('stalled', (jobId) => {
        this.logger.info(`Queue ${queue.name} detected stalled job #${jobId}`);
    });
    queue.process(workerConfig.concurrency, this.queueProcessors[name]);
    return this;
  }
  
  /**
   * Start all queue workers
   */
  run() {
    for (let name in this.queueProcessors) {
      this.runWorker(`${name}`);
    }
  }

  /**
   * Register all queue processors
   *
   * @return {String}
   */
  register() {
    return `${this.appdir}/res/bee/*.js`;
  }
}

module.exports = BeeQueueService;