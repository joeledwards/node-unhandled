const tap = require('tap')
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
    logs: () => logs,
  }

  const result = unhandled({
    logger,
    context: {
      events,
      exit,
    },
    ...config
  })

  action(context, {
    logs: () => logs,
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

tap.test('does nothing if ignore is true for an event type', async assert => {
  await runTest({ exit: 1, exception: { ignore: true } }, c => {
    // Test ignoring uncaughtException
    c.doReject('async-fail')
    c.doThrow('sync-fail')

    assert.equal(c.exitCalls().length, 1)
    assert.equal(c.logs().length, 1)
    assert.same(c.logs()[0], ['Un-handled Promise Rejection :', 'async-fail'])
  })

  await runTest({ exit: true, rejection: { ignore: true } }, c => {
    // Test ignoring unhandledRejection
    c.doReject('async-fail')
    c.doThrow('sync-fail')

    assert.equal(c.exitCalls().length, 1)
    assert.equal(c.logs().length, 1)
    assert.same(c.logs()[0], ['Un-caught Exception :', 'sync-fail'])
  })
})
