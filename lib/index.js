module.exports = unhandled

function unhandled ({
  handler,
  logger = console,
  exit,
  exception: {
    exit: exitOnException,
    handler: exceptionHandler,
    ignore: ignoreException = false
  } = {},
  rejection: {
    exit: exitOnRejection,
    handler: rejectionHandler,
    ignore: ignoreRejection = false
  } = {},
  context: {
    events = process,
    exit: exitProcess = process.exit.bind(process)
  } = {}
} = {}) {
  handleIt({
    event: 'uncaughtException',
    message: 'Un-caught Exception',
    logger,
    handler: coalesce(exceptionHandler, handler),
    exit: coalesce(exitOnException, exit),
    ignore: ignoreException,
    context: {
      events,
      exit: exitProcess
    }
  })

  handleIt({
    event: 'unhandledRejection',
    message: 'Un-handled Promise Rejection',
    logger,
    handler: coalesce(rejectionHandler, handler),
    exit: coalesce(exitOnRejection, exit),
    ignore: ignoreRejection,
    context: {
      events,
      exit: exitProcess
    }
  })
}

function handleIt ({
  event,
  exit,
  handler,
  ignore,
  logger,
  message,
  context
}) {
  if (!ignore) {
    const logError = (...args) => {
      if (logger && typeof logger.error === 'function') {
        logger.error(...args)
      }
    }

    context.events.on(event, error => {
      try {
        if (isNil(handler)) {
          logError(`${message} :`, error)
        } else {
          handler({ event, error })
        }
      } catch (error) {
        logError(`Error in handler for '${event}' event :`, error)
      }

      if (exit === true && typeof context.exit === 'function') {
        context.exit(1)
      }
    })
  }
}

function coalesce () {
  const args = arguments
  const values = Object.values(args).filter(value => !isNil(value))

  return values[0]
}

function isNil (value) {
  return value === null || value === undefined
}
