const app = require('express')();
const request = require('request');
const bodyParser = require('body-parser');

/////////////////////////////////////////////////////////////////////////////
//////////////////////////// Behavior definition ////////////////////////////
/////////////////////////////////////////////////////////////////////////////

var commandHandlers = [];
var regexHandlers = [];
var eventHandlers = [];
var possibleEvents = ["message_allow", "message_deny", "message_reply", "no_match"];

// On exact command with prefix
exports.cmd = function (command, a, b) {
  if (!command || !a) {
    // At least a should be defined
    badParams("cmd");
  }

  var description = a;
  var callback = b;
  if (!b) {
    // We have only command and callback
    description = null;
    callback = a;
  }

  commandHandlers.push({
    command: command,
    description: description,
    callback: callback
  });
};

// On matching regex
exports.regex = function (regex, callback) {
  if (!regex || !callback) {
    badParams("regex");
  }

  regexHandlers.push({
    regex: regex,
    callback: callback
  });
};

// For special events
exports.on = function (e, callback) {
  if (!e || !callback) {
    badParams("on");
  }

  if (!possibleEvents.includes(e)) {
    log(logType.error, 'Tried to register a handler for an unsupported event type: ' + e);
    terminate();
  }

  eventHandlers.push({
    event: e,
    callback: callback
  });
};

/////////////////////////////////////////////////////////////////////////////
//////////////////////////////////// Help ///////////////////////////////////
/////////////////////////////////////////////////////////////////////////////

exports.help = function () {
  var helpMessage = "\n";

  for (var i = 0; i < commandHandlers.length; i++) {
    var commandHelpEntry = "";

    commandHelpEntry += cmdPrefix;
    commandHelpEntry += commandHandlers[i].command;

    if (commandHandlers[i].description) {
      commandHelpEntry += " - ";
      commandHelpEntry += commandHandlers[i].description;
    }

    helpMessage += commandHelpEntry + "\n";
  }

  return helpMessage;
};

/////////////////////////////////////////////////////////////////////////////
//////////////////////////////// Init & Start ///////////////////////////////
/////////////////////////////////////////////////////////////////////////////

var groupId, confirmationToken, secret, vkApiKey;
var cmdPrefix;

var initialized = false;

// Initialise the bot
exports.init = function (params) {
  if (!params) {
    badParams("init");
  }

  groupId = params.group_id;
  confirmationToken = params.confirmation_token;
  secret = params.secret;
  vkApiKey = params.vk_api_key;
  cmdPrefix = params.cmd_prefix;

  if (groupId && confirmationToken && secret && vkApiKey) {
    initialized = true;
  } else {
    badParams("init");
  }
};

// Start the bot
exports.start = function (port) {
  if (!port) {
    badParams("start");
  }

  if (!initialized) {
    log(logType.error, 'Please initialize the bot before starting it using init(params).');
    terminate();
  }

  app.use(bodyParser.json());

  app.get('/', (req, res) => {
    res.status(400).send('Only POST allowed.');
    log(logType.request, 'GET request.');
  })

  app.post('/', (req, res) => {
    body = req.body;

    if (body.type === "confirmation" && body.group_id == groupId) {
        res.status(200).send(confirmationToken);
    } else if (body.secret === secret) {
        res.status(200).send('ok');
        parseRequest(body);
    } else {
        res.status(400).send('Invalid secret key.');
        log(logType.request, 'Request with an invalid secret key.');
    }
  })

  app.listen(port, (err) => {
    if (err) return console.log('[!] Error: ' + err);
    log(logType.information, `Server is listening on port ${port}.`);
  })
};

/////////////////////////////////////////////////////////////////////////////
////////////////////////////// Helper functions /////////////////////////////
/////////////////////////////////////////////////////////////////////////////

// Parse Callback API's message
function parseRequest(body) {
  uid = body.object.user_id;
  obj = body.object;
  type = body.type;
  if (type === "message_new") {
    log(logType.request, 'New message from user: ' + uid);
    handleMessage(uid, obj);
  } else {
    log(logType.request, 'Received event: ' + type);
    handleEvent(uid, type, obj);
  }
}

// Handle message_new
function handleMessage(uid, obj) {
  msg = obj.body.toLocaleLowerCase();

  var command = msg.split(" ")[0];
  if (cmdPrefix) command = command.replace(cmdPrefix, "");

  // See if there is a matching command
  for (var i = 0; i < commandHandlers.length; i++) {
    handler = commandHandlers[i];
    if (handler.command === command) {
      regex = new RegExp(command, 'g');
      if (cmdPrefix) regex = new RegExp(cmdPrefix + command, 'g');

      msg_content = obj.body.replace(regex, "");

      var answer = handler.callback(msg_content, obj);
      if (answer != null) {
        send(uid, answer);
      }

      return;
    }
  }

  // If not, try to use a regex handler
  for (var i = 0; i < regexHandlers.length; i++) {
    handler = regexHandlers[i];
    if ((new RegExp(handler.regex)).test(msg)) {
      var answer = handler.callback(obj.body, obj);
      if (answer != null) {
        send(uid, answer);
      }

      return;
    }
  }

  // If not, call the no_match event
  log(logType.information, "Don't know how to respond to: \"" + msg + "\", calling 'no_match' event");
  handleEvent(uid, "no_match", obj);
}

// Handle a special event
function handleEvent(uid, e, obj) {
  if (!possibleEvents.includes(e) ) {
    log(logType.error, 'Received an unsupported event type: ' + e);
    return;
  }

  for (var i = 0; i < eventHandlers.length; i++) {
    handler = eventHandlers[i];
    if (handler.event === e) {
      var answer = handler.callback(uid, obj);
      if (answer != null && !(e === "message_deny")) {
        send(uid, answer);
      }
      return;
    }
  }

  log(logType.information, "No handler for event: " + e);
}

// Send a message to user by his id
function send(uid, msg) {
  var url = `https://api.vk.com/method/messages.send?user_id=${uid}&message=${encodeURIComponent(msg)}&access_token=${vkApiKey}`;
  request(url, function (error, response, body) {
    if (!error && response.statusCode == 200) log(logType.response, 'Message sent to user: ' + uid);
    if (error) log(logType.error, 'Error occured when sending a message: ' + error);
  })
}

/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////// Logging /////////////////////////////////
/////////////////////////////////////////////////////////////////////////////

logType = {
  information: 'i',
  request: '>',
  response: '<',
  error: '!'
}

function log(type, text) {
  message = `[${type}] ${text}`
  console.log(message);
}

function terminate() {
  log(logType.error, 'Terminating.');
  process.exit(1);
}

function badParams(functionName) {
  log(logType.error, 'Bad parameters for function ' + functionName + '().');
  terminate();
}
