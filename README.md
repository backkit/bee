# bee

Backkit service for [beequeue](https://github.com/bee-queue/bee-queue), redis based job queue

## install

```bash
npm install --save @backkit/bee
```

## configuration example

```yml
test:
  queue:
    redis:
      host: 127.0.0.1
      port: 6379
      db: 0
    removeOnSuccess: false
    removeOnFailure: false
    stallInterval: 5000
    nearTermWindow: 60000
    delayedDebounce: 500
  worker:
    concurrency: 50
```

*note that you can use any configuration available for bee: https://github.com/bee-queue/bee-queue#settings


## worker example (async)

res/bee/test.js

```node
module.exports = ({bee}) => bee.worker('test', async (job) => {
  return await true;
});
```

## job producer example

services/bee-job-producer.js

```node
class BeeJobProducerService {
  constructor({bee}) {
    this.bee = bee;
  }
    
  run() {
    setInterval(() => {
      const queue = this.bee.getQueue('test');
      queue
      .ready()
      .then(() => {
        const job = queue.createJob({x: Math.random()*1000, y: Math.random()*1000});
        return job
        .retries(3)
        .timeout(1000*30)
        .on('succeeded', (result) => {
          console.log(`result for job ${job.queue.name}/${job.id}: ${result}`);
        })
        .on('failed', (jor, err) => {
          console.log(`job ${job.queue.name}/${job.id} failed:`, err.message);
        })
        .on('stalled', (jobId) => {
          console.log(`job ${job.queue.name}/${job.id} stalled...`);
        })
        .on('retrying', (jor, err) => {
          console.log(`job ${job.queue.name}/${job.id} failed (${err.message}), retrying...`);
        })
        .save();
      })
      .then((job) => {
        console.log(`job ${job.queue.name}/${job.id} created on ${queue.name} queue`);
      })
      .catch(err => {
        console.log(`error creating job on ${queue.name} queue: ${err.message}`)
      })
    }, 500);
  }
}

module.exports = BeeJobProducerService;
```

