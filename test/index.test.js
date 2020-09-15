const tap = require('tap')
const meter = require('@buzuli/meter')
const unhandled = require('../lib')
const EventListener = require('events')

async function runTest (config, action) {
  const logs = []
  const events = new EventListener()
  const exitCalls = []

  if (typeof config === 'function') {
    action = config
    config = {}
  }

  const exit = code => exitCalls.push(code)
  const logger = { error: (...args) => logs.push(args) }

  const context = {
    doReject: error => events.emit('unhandledRejection', error),
    doThrow: error => events.emit('uncaughtException', error),
    exitCalls: () => exitCalls,
    logs: () => logs
  }

  const result = unhandled({
    logger,
    ...config,
    context: {
      events,
      exit,
      ...config.context
    }
  })

  action(context, {
    logs: () => logs
  })

  return result
}

tap.test('default config just logs the error', async assert => {
  await runTest(c => {
    c.doReject('async-fail')
    c.doThrow('sync-fail')

    assert.equal(c.exitCalls().length, 0)
    assert.equal(c.logs().length, 2)
    assert.same(c.logs()[0], ['Un-handled Promise Rejection :', 'async-fail'])
    assert.same(c.logs()[1], ['Un-caught Exception :', 'sync-fail'])
  })
})

tap.test('custom handler can be passed in', async assert => {
  const metrics = meter()
  const handler = ({ event, error }) => metrics.add(`handler:${event}:${error}`)
  await runTest({ handler }, c => {
    c.doReject('async-fail')
    c.doThrow('sync-fail')

    assert.equal(metrics.get('handler:unhandledRejection:async-fail'), 1)
    assert.equal(metrics.get('handler:uncaughtException:sync-fail'), 1)
  })
})

tap.test('event-specific handlers will override the global handler', async assert => {
  const metrics = meter()
  const globalHandler = ({ event, error }) => metrics.add(`globalHandler:${event}:${error}`)
  const exceptionHandler = ({ event, error }) => metrics.add(`exceptionHandler:${event}:${error}`)
  const rejectionHandler = ({ event, error }) => metrics.add(`rejectionHandler:${event}:${error}`)

  await runTest({ handler: globalHandler, exception: { handler: exceptionHandler } }, c => {
    c.doReject('async-fail')
    c.doThrow('sync-fail')

    assert.equal(metrics.get('globalHandler:unhandledRejection:async-fail'), 1)
    assert.equal(metrics.get('exceptionHandler:uncaughtException:sync-fail'), 1)
  })

  await runTest({ handler: globalHandler, rejection: { handler: rejectionHandler } }, c => {
    c.doReject('async-fail')
    c.doThrow('sync-fail')

    assert.equal(metrics.get('globalHandler:uncaughtException:sync-fail'), 1)
    assert.equal(metrics.get('rejectionHandler:unhandledRejection:async-fail'), 1)
  })
})

tap.test('exits if exit is true', async assert => {
  await runTest({ exit: true }, c => {
    c.doReject('async-fail')
    c.doThrow('sync-fail')

    assert.equal(c.exitCalls().length, 2)
    assert.equal(c.logs().length, 2)
    assert.same(c.logs()[0], ['Un-handled Promise Rejection :', 'async-fail'])
    assert.same(c.logs()[1], ['Un-caught Exception :', 'sync-fail'])
  })
})

tap.test('event-specific exit config supercedes global exit config', async assert => {
  const metrics = meter()
  const exitObserver = (code) => metrics.add('exit')

  await runTest({ exit: true, exception: { exit: false }, rejection: { exit: false }, context: { exit: exitObserver } }, c => {
    c.doReject('async-fail')
    assert.equal(metrics.get('exit'), 0)

    c.doThrow('sync-fail')
    assert.equal(metrics.get('exit'), 0)
  })

  metrics.clear()

  await runTest({ exit: false, exception: { exit: true }, rejection: { exit: true }, context: { exit: exitObserver } }, c => {
    c.doReject('async-fail')
    assert.equal(metrics.get('exit'), 1)

    c.doThrow('sync-fail')
    assert.equal(metrics.get('exit'), 2)
  })

  metrics.clear()

  await runTest({ exit: false, exception: { exit: true }, context: { exit: exitObserver } }, c => {
    c.doReject('async-fail')
    assert.equal(metrics.get('exit'), 0)

    c.doThrow('sync-fail')
    assert.equal(metrics.get('exit'), 1)
  })

  metrics.clear()

  await runTest({ exit: false, rejection: { exit: true }, context: { exit: exitObserver } }, c => {
    c.doReject('async-fail')
    assert.equal(metrics.get('exit'), 1)

    c.doThrow('sync-fail')
    assert.equal(metrics.get('exit'), 1)
  })

  metrics.clear()

  await runTest({ exit: true, exception: { exit: false }, context: { exit: exitObserver } }, c => {
    c.doReject('async-fail')
    assert.equal(metrics.get('exit'), 1)

    c.doThrow('sync-fail')
    assert.equal(metrics.get('exit'), 1)
  })

  metrics.clear()

  await runTest({ exit: true, rejection: { exit: false }, context: { exit: exitObserver } }, c => {
    c.doReject('async-fail')
    assert.equal(metrics.get('exit'), 0)

    c.doThrow('sync-fail')
    assert.equal(metrics.get('exit'), 1)
  })
})

tap.test('does nothing if ignore is true for an event type', async assert => {
  await runTest({ exit: true, exception: { ignore: true } }, c => {
    c.doReject('async-fail')
    c.doThrow('sync-fail')

    assert.equal(c.exitCalls().length, 1)
    assert.equal(c.logs().length, 1)
    assert.same(c.logs()[0], ['Un-handled Promise Rejection :', 'async-fail'])
  })

  await runTest({ exit: true, rejection: { ignore: true } }, c => {
    c.doReject('async-fail')
    c.doThrow('sync-fail')

    assert.equal(c.exitCalls().length, 1)
    assert.equal(c.logs().length, 1)
    assert.same(c.logs()[0], ['Un-caught Exception :', 'sync-fail'])
  })
})

tap.test('override the logger', async assert => {
  await runTest({ logger: { error: () => {} } }, c => {
    assert.equals(c.logs().length, 0)
  })

  await runTest({ logger: {} }, c => {
    assert.equals(c.logs().length, 0)
  })
})

tap.test('log error in handler', async assert => {
  await runTest({ handler: () => toss('handle-fail') }, c => {
    c.doThrow('sync-fail')
    assert.equals(c.logs().length, 1)
    assert.same(c.logs()[0][0], "Error in handler for 'uncaughtException' event :")
    assert.same(c.logs()[0][1].message, 'handle-fail')
  })

  await runTest({ handler: () => toss('handle-fail') }, c => {
    c.doReject('async-fail')
    assert.equals(c.logs().length, 1)
    assert.same(c.logs()[0][0], "Error in handler for 'unhandledRejection' event :")
    assert.same(c.logs()[0][1].message, 'handle-fail')
  })
})

function toss (message) {
  throw new Error(message)
}
