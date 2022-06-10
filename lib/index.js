module.exports = unhandled

function unhandled ({
  handler,
  logger = console,
  verbose = false,
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
  sigint: {
    exit: exitOnSigint,
    handler: sigintHandler,
    ignore: ignoreSigint = false
  } = {},
  sigterm: {
    exit: exitOnSigterm,
    handler: sigtermHandler,
    ignore: ignoreSigterm = false
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
    verbose,
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
    verbose,
    handler: coalesce(rejectionHandler, handler),
    exit: coalesce(exitOnRejection, exit),
    ignore: ignoreRejection,
    context: {
      events,
      exit: exitProcess
    }
  })

  handleIt({
    event: 'SIGINT',
    message: 'SIGINT Received',
    logger,
    verbose,
    handler: coalesce(sigintHandler, handler),
    exit: coalesce(exitOnSigint, exit),
    ignore: ignoreSigint,
    context: {
      events,
      exit: exitProcess
    }
  })

  handleIt({
    event: 'SIGTERM',
    message: 'SIGTERM Received',
    logger,
    verbose,
    handler: coalesce(sigtermHandler, handler),
    exit: coalesce(exitOnSigterm, exit),
    ignore: ignoreSigterm,
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
  verbose,
  message,
  context
}) {
  const {
    logError,
    logVerbose
  } = (() => {
    if (logger && typeof logger.error === 'function') {
      const errorLogger = (...args) => logger.error(...args)
      const noopLogger = () => {}

      return {
        logError: errorLogger,
        logVerbose: verbose ? errorLogger : noopLogger
      }
    } else {
      return { logError: () => {}, logVerbose: () => {} }
    }
  })()

  if (ignore) {
    logVerbose(`Ignoring event "${event}"`)
  } else {
    logVerbose(`Setting up listener for event "${event}"`)
    context.events.on(event, error => {
      try {
        if (isNil(handler)) {
          if (isNil(error)) {
            logError(`${message}`)
          } else {
            logError(`${message} :`, error)
          }
        } else {
          logVerbose(`Passing event "${event}" to handler.`)
          handler({ event, error })
        }
      } catch (handlerError) {
        logError(`Error in handler for '${event}' event :`, handlerError)
      }

      if (exit === true && typeof context.exit === 'function') {
        logVerbose(`Exiting process with code 1`)
        context.exit(1)
      } else {
        logVerbose(`Not exiting process per config`)
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
