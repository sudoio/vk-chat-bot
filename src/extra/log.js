require('colors')

export var types = {
  progress: 'progress'.cyan,
  info: 'info'.blue,
  warn: 'warn'.yellow,
  res: 'response'.green,
  err: 'err!'.red
}

export default function log (type, text) {
  if (text === '') {
    return
  }

  if (process.env.TEST_MODE && type !== types.err) {
    return
  }

  var message = `vk-chat-bot ${type} ${text}`

  if (type === types.err) {
    text = message.red
    throw new Error(message)
  } else {
    console.log(message)
  }
}

export function info (info) {
  log(types.info, info)
}

export function progress (info) {
  log(types.progress, info)
}

export function warn (info) {
  if (info instanceof Error) {
    info = info.message
  }

  log(types.warn, info)
}

export function err (reason) {
  if (reason instanceof Error) {
    reason = reason.message
  }

  if (!process.env.TEST_MODE) {
    var note = `[⋅] An error occured. The messages below may contain
[⋅] useful information about the problem.
[⋅] If you think this is an issue with 'vk-chat-bot' itself,
[⋅] please report it at <https://github.com/u32i64/vk-chat-bot/issues>.`.inverse

    console.log(`\n\n${note}\n\n`)
  }

  log(types.err, reason)
}

export function res (info) {
  log(types.res, info)
}

export function requireParam (functionName, param, name) {
  if (!param) {
    if (name) {
      err(`In function '${functionName}': expected: '${name}', got: '${param}'.`)
    } else {
      err(`Bad parameter for function '${functionName}': '${param}'.`)
    }
  }
}

export function requireFunction (param) {
  if (typeof param !== 'function') {
    err(`Callback function that you specified is not a function.`)
  }
}
