# unhandled

Adds handlers for the `uncaughtException`, `unhandledRejection`, `SIGINT`, and `SIGTERM events.
The default behavior is to log the event to console (and the error, if applicable), then exit with code `1`.

The logger, exit code, and optional handler(s) can be configured

`unhandle(options)`
- `options.handler`: `({ event, error? }) => nil` | Generic handler function for unhandled events.
- `options.logger`: `{ error(...) => nil }` = `console` | The logger to which the unhandled event errors should be logged.
- `options.verbose`: `boolean` = `false` | Set to `true` to report all actions to the logger.error()
- `options.exit`: `boolean` = `false` | Indicates whether unhandled events should trigger runtime exit.
- `options.exception.exit`: `boolean` | Exit on uncaught exception (supercedes `options.exit`).
- `options.exception.handler`: `({ event, error }) => nil` | Custom, synchronous action to run on uncaught exception (supercedes `options.handler`).
- `options.exception.ignore`: `boolean` = `false` | Do not handled exceptions (permit default runtime behavior).
- `options.rejection.exit`: `boolean` | Exit on unhandled promise rejection (supercedes `options.exit`).
- `options.rejection.handler`: `({ event, error }) => nil` | Custom, synchronous action to run on unhandled promise rejection (supercedes `options.handler`).
- `options.rejection.ignore`: `boolean` = `false` | Do not handle rejections (permit default runtime behavior).
- `options.sigint.exit`: `boolean` | Exit on SIGINT event (supercedes `options.exit`).
- `options.sigint.handler`: `({ event }) => nil` | Custom, synchronous action to run on SIGINT signal (supercedes `options.handler`).
- `options.sigint.ignore`: `boolean` = `false` | Do not handle SIGINT (permit default runtime behavior).
- `options.sigterm.exit`: `boolean` | Exit on SIGTERM event (supercedes `options.exit`).
- `options.sigterm.handler`: `({ event }) => nil` | Custom, synchronous action to run on SIGTERM signal (supercedes `options.handler`).
- `options.sigterm.ignore`: `boolean` = `false` | Do not handle SIGTERM (permit default runtime behavior).
