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
    doSigint: () => events.emit('SIGINT'),
    doSigterm: () => events.emit('SIGTERM'),
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
    c.doReject('rejected')
    c.doThrow('excepted')
    c.doSigint()
    c.doSigterm()

    assert.equal(c.exitCalls().length, 0)
    assert.equal(c.logs().length, 4)
    assert.same(c.logs()[0], ['Un-handled Promise Rejection :', 'rejected'])
    assert.same(c.logs()[1], ['Un-caught Exception :', 'excepted'])
    assert.same(c.logs()[2], ['SIGINT Received'])
    assert.same(c.logs()[3], ['SIGTERM Received'])
  })
})

tap.test('verbose config logs more detail', async assert => {
  await runTest({ verbose: true }, c => {
    c.doReject('rejected')
    c.doThrow('excepted')
    c.doSigint()
    c.doSigterm()

    assert.equal(c.exitCalls().length, 0)
    assert.equal(c.logs().length, 12)
    assert.same(c.logs()[0], ['Setting up listener for event "uncaughtException"'])
    assert.same(c.logs()[1], ['Setting up listener for event "unhandledRejection"'])
    assert.same(c.logs()[2], ['Setting up listener for event "SIGINT"'])
    assert.same(c.logs()[3], ['Setting up listener for event "SIGTERM"'])
    assert.same(c.logs()[4], ['Un-handled Promise Rejection :', 'rejected'])
    assert.same(c.logs()[5], ['Not exiting process per config'])
    assert.same(c.logs()[6], ['Un-caught Exception :', 'excepted'])
    assert.same(c.logs()[7], ['Not exiting process per config'])
    assert.same(c.logs()[8], ['SIGINT Received'])
    assert.same(c.logs()[9], ['Not exiting process per config'])
    assert.same(c.logs()[10], ['SIGTERM Received'])
    assert.same(c.logs()[11], ['Not exiting process per config'])
  })
})

tap.test('custom handler can be passed in', async assert => {
  const metrics = meter()
  const handler = ({ event, error }) => metrics.add(`handler:${event}:${error}`)
  await runTest({ handler }, c => {
    c.doReject('rejected')
    c.doThrow('excepted')
    c.doSigint()
    c.doSigterm()

    assert.equal(metrics.get('handler:unhandledRejection:rejected'), 1)
    assert.equal(metrics.get('handler:uncaughtException:excepted'), 1)
    assert.equal(metrics.get('handler:SIGINT:undefined'), 1)
    assert.equal(metrics.get('handler:SIGTERM:undefined'), 1)
  })
})

tap.test('event-specific handlers will override the global handler', async assert => {
  const metrics = meter()
  const globalHandler = ({ event, error }) => metrics.add(`globalHandler:${event}:${error}`)
  const exceptionHandler = ({ event, error }) => metrics.add(`exceptionHandler:${event}:${error}`)
  const rejectionHandler = ({ event, error }) => metrics.add(`rejectionHandler:${event}:${error}`)
  const sigintHandler = ({ event, error }) => metrics.add(`sigintHandler:${event}:${error}`)
  const sigtermHandler = ({ event, error }) => metrics.add(`sigtermHandler:${event}:${error}`)

  await runTest({ handler: globalHandler, exception: { handler: exceptionHandler } }, c => {
    metrics.clear()
    c.doReject('rejected')
    c.doThrow('excepted')
    c.doSigint()
    c.doSigterm()

    assert.equal(metrics.get('globalHandler:unhandledRejection:rejected'), 1)
    assert.equal(metrics.get('globalHandler:SIGINT:undefined'), 1)
    assert.equal(metrics.get('globalHandler:SIGTERM:undefined'), 1)
    assert.equal(metrics.get('exceptionHandler:uncaughtException:excepted'), 1)
  })

  await runTest({ handler: globalHandler, rejection: { handler: rejectionHandler } }, c => {
    metrics.clear()
    c.doReject('rejected')
    c.doThrow('excepted')
    c.doSigint()
    c.doSigterm()

    assert.equal(metrics.get('globalHandler:uncaughtException:excepted'), 1)
    assert.equal(metrics.get('globalHandler:SIGINT:undefined'), 1)
    assert.equal(metrics.get('globalHandler:SIGTERM:undefined'), 1)
    assert.equal(metrics.get('rejectionHandler:unhandledRejection:rejected'), 1)
  })

  await runTest({ handler: globalHandler, sigint: { handler: sigintHandler } }, c => {
    metrics.clear()
    c.doReject('rejected')
    c.doThrow('excepted')
    c.doSigint()
    c.doSigterm()

    assert.equal(metrics.get('globalHandler:uncaughtException:excepted'), 1)
    assert.equal(metrics.get('globalHandler:SIGTERM:undefined'), 1)
    assert.equal(metrics.get('globalHandler:unhandledRejection:rejected'), 1)
    assert.equal(metrics.get('sigintHandler:SIGINT:undefined'), 1)
  })

  await runTest({ handler: globalHandler, sigterm: { handler: sigtermHandler } }, c => {
    metrics.clear()
    c.doReject('rejected')
    c.doThrow('excepted')
    c.doSigint()
    c.doSigterm()

    assert.equal(metrics.get('globalHandler:uncaughtException:excepted'), 1)
    assert.equal(metrics.get('globalHandler:unhandledRejection:rejected'), 1)
    assert.equal(metrics.get('globalHandler:SIGINT:undefined'), 1)
    assert.equal(metrics.get('sigtermHandler:SIGTERM:undefined'), 1)
  })
})

tap.test('exits if exit is true', async assert => {
  await runTest({ exit: true }, c => {
    c.doReject('rejected')
    c.doThrow('excepted')
    c.doSigint()
    c.doSigterm()

    assert.equal(c.exitCalls().length, 4)
    assert.equal(c.logs().length, 4)
    assert.same(c.logs()[0], ['Un-handled Promise Rejection :', 'rejected'])
    assert.same(c.logs()[1], ['Un-caught Exception :', 'excepted'])
    assert.same(c.logs()[2], ['SIGINT Received'])
    assert.same(c.logs()[3], ['SIGTERM Received'])
  })
})

tap.test('event-specific exit config supercedes global exit config', async assert => {
  const metrics = meter()
  const exitObserver = (code) => metrics.add('exit')

  await runTest({
    exit: true,
    exception: { exit: false },
    rejection: { exit: false },
    sigint: { exit: false },
    sigterm: { exit: false },
    context: { exit: exitObserver }
  }, c => {
    c.doReject('rejected')
    assert.equal(metrics.get('exit'), 0)

    c.doThrow('excepted')
    assert.equal(metrics.get('exit'), 0)

    c.doSigint()
    assert.equal(metrics.get('exit'), 0)

    c.doSigterm()
    assert.equal(metrics.get('exit'), 0)
  })

  metrics.clear()

  await runTest({
    exit: false,
    exception: { exit: true },
    rejection: { exit: true },
    sigint: { exit: true },
    sigterm: { exit: true },
    context: { exit: exitObserver }
  }, c => {
    c.doReject('rejected')
    assert.equal(metrics.get('exit'), 1)

    c.doThrow('excepted')
    assert.equal(metrics.get('exit'), 2)

    c.doSigint()
    assert.equal(metrics.get('exit'), 3)

    c.doSigterm()
    assert.equal(metrics.get('exit'), 4)
  })

  metrics.clear()

  await runTest({ exit: false, exception: { exit: true }, context: { exit: exitObserver } }, c => {
    c.doReject('rejected')
    assert.equal(metrics.get('exit'), 0)

    c.doThrow('excepted')
    assert.equal(metrics.get('exit'), 1)

    c.doSigint()
    assert.equal(metrics.get('exit'), 1)

    c.doSigterm()
    assert.equal(metrics.get('exit'), 1)
  })

  metrics.clear()

  await runTest({ exit: false, rejection: { exit: true }, context: { exit: exitObserver } }, c => {
    c.doReject('rejected')
    assert.equal(metrics.get('exit'), 1)

    c.doThrow('excepted')
    assert.equal(metrics.get('exit'), 1)

    c.doSigint()
    assert.equal(metrics.get('exit'), 1)

    c.doSigterm()
    assert.equal(metrics.get('exit'), 1)
  })

  metrics.clear()

  await runTest({ exit: false, sigint: { exit: true }, context: { exit: exitObserver } }, c => {
    c.doReject('rejected')
    assert.equal(metrics.get('exit'), 0)

    c.doThrow('excepted')
    assert.equal(metrics.get('exit'), 0)

    c.doSigint()
    assert.equal(metrics.get('exit'), 1)

    c.doSigterm()
    assert.equal(metrics.get('exit'), 1)
  })

  metrics.clear()

  await runTest({ exit: false, sigterm: { exit: true }, context: { exit: exitObserver } }, c => {
    c.doReject('rejected')
    assert.equal(metrics.get('exit'), 0)

    c.doThrow('excepted')
    assert.equal(metrics.get('exit'), 0)

    c.doSigint()
    assert.equal(metrics.get('exit'), 0)

    c.doSigterm()
    assert.equal(metrics.get('exit'), 1)
  })

  metrics.clear()

  await runTest({ exit: true, exception: { exit: false }, context: { exit: exitObserver } }, c => {
    c.doReject('rejected')
    assert.equal(metrics.get('exit'), 1)

    c.doThrow('excepted')
    assert.equal(metrics.get('exit'), 1)

    c.doSigint()
    assert.equal(metrics.get('exit'), 2)

    c.doSigterm()
    assert.equal(metrics.get('exit'), 3)
  })

  metrics.clear()

  await runTest({ exit: true, rejection: { exit: false }, context: { exit: exitObserver } }, c => {
    c.doReject('rejected')
    assert.equal(metrics.get('exit'), 0)

    c.doThrow('excepted')
    assert.equal(metrics.get('exit'), 1)

    c.doSigint()
    assert.equal(metrics.get('exit'), 2)

    c.doSigterm()
    assert.equal(metrics.get('exit'), 3)
  })

  metrics.clear()

  await runTest({ exit: true, sigint: { exit: false }, context: { exit: exitObserver } }, c => {
    c.doReject('rejected')
    assert.equal(metrics.get('exit'), 1)

    c.doThrow('excepted')
    assert.equal(metrics.get('exit'), 2)

    c.doSigint()
    assert.equal(metrics.get('exit'), 2)

    c.doSigterm()
    assert.equal(metrics.get('exit'), 3)
  })

  metrics.clear()

  await runTest({ exit: true, sigterm: { exit: false }, context: { exit: exitObserver } }, c => {
    c.doReject('rejected')
    assert.equal(metrics.get('exit'), 1)

    c.doThrow('excepted')
    assert.equal(metrics.get('exit'), 2)

    c.doSigint()
    assert.equal(metrics.get('exit'), 3)

    c.doSigterm()
    assert.equal(metrics.get('exit'), 3)
  })
})

tap.test('does nothing if ignore is true for an event type', async assert => {
  await runTest({ exit: true, exception: { ignore: true } }, c => {
    c.doReject('rejected')
    c.doThrow('excepted')
    c.doSigint()
    c.doSigterm()

    assert.equal(c.exitCalls().length, 3)
    assert.equal(c.logs().length, 3)
    assert.same(c.logs()[0], ['Un-handled Promise Rejection :', 'rejected'])
    assert.same(c.logs()[1], ['SIGINT Received'])
    assert.same(c.logs()[2], ['SIGTERM Received'])
  })

  await runTest({ exit: true, rejection: { ignore: true } }, c => {
    c.doReject('rejected')
    c.doThrow('excepted')
    c.doSigint()
    c.doSigterm()

    assert.equal(c.exitCalls().length, 3)
    assert.equal(c.logs().length, 3)
    assert.same(c.logs()[0], ['Un-caught Exception :', 'excepted'])
    assert.same(c.logs()[1], ['SIGINT Received'])
    assert.same(c.logs()[2], ['SIGTERM Received'])
  })

  await runTest({ exit: true, sigint: { ignore: true } }, c => {
    c.doReject('rejected')
    c.doThrow('excepted')
    c.doSigint()
    c.doSigterm()

    assert.equal(c.exitCalls().length, 3)
    assert.equal(c.logs().length, 3)
    assert.same(c.logs()[0], ['Un-handled Promise Rejection :', 'rejected'])
    assert.same(c.logs()[1], ['Un-caught Exception :', 'excepted'])
    assert.same(c.logs()[2], ['SIGTERM Received'])
  })

  await runTest({ exit: true, sigterm: { ignore: true } }, c => {
    c.doReject('rejected')
    c.doThrow('excepted')
    c.doSigint()
    c.doSigterm()

    assert.equal(c.exitCalls().length, 3)
    assert.equal(c.logs().length, 3)
    assert.same(c.logs()[0], ['Un-handled Promise Rejection :', 'rejected'])
    assert.same(c.logs()[1], ['Un-caught Exception :', 'excepted'])
    assert.same(c.logs()[2], ['SIGINT Received'])
  })
})

tap.test('override the logger', async assert => {
  await runTest({ logger: { error: () => {} } }, c => {
    c.doReject('rejected')
    c.doThrow('excepted')
    c.doSigint()
    c.doSigterm()

    assert.equal(c.logs().length, 0)
  })

  await runTest({ logger: {} }, c => {
    c.doReject('rejected')
    c.doThrow('excepted')
    c.doSigint()
    c.doSigterm()

    assert.equal(c.logs().length, 0)
  })
})

tap.test('log error in handler', async assert => {
  await runTest({ handler: () => toss('handle-fail') }, c => {
    c.doThrow('excepted')
    assert.equal(c.logs().length, 1)
    assert.same(c.logs()[0][0], "Error in handler for 'uncaughtException' event :")
    assert.same(c.logs()[0][1].message, 'handle-fail')
  })

  await runTest({ handler: () => toss('handle-fail') }, c => {
    c.doReject('rejected')
    assert.equal(c.logs().length, 1)
    assert.same(c.logs()[0][0], "Error in handler for 'unhandledRejection' event :")
    assert.same(c.logs()[0][1].message, 'handle-fail')
  })

  await runTest({ handler: () => toss('handle-fail') }, c => {
    c.doSigint()
    assert.equal(c.logs().length, 1)
    assert.same(c.logs()[0][0], "Error in handler for 'SIGINT' event :")
    assert.same(c.logs()[0][1].message, 'handle-fail')
  })

  await runTest({ handler: () => toss('handle-fail') }, c => {
    c.doSigterm()
    assert.equal(c.logs().length, 1)
    assert.same(c.logs()[0][0], "Error in handler for 'SIGTERM' event :")
    assert.same(c.logs()[0][1].message, 'handle-fail')
  })
})

function toss (message) {
  throw new Error(message)
}
