var SUPPORTED_SIEM = ['sumologic', 'splunk', 'http'];
var request = require('request');
var SPLUNK_PATH = '/services/collector/event/1.0';

// Serialize object or string to JSON
// Fails safely catching seralization errors
function objectToJSON(event) {
  try {
    return JSON.stringify(event);
  } catch (err) {
    console.log('error seralizing log line');
  }
}

// Prepares request options
function prepareRequestOptions(options) {
  var requestOptions = {
    url: options.siemUrl,
    method: 'POST',
    strictSSL: options.strictSSL === undefined ? true : options.strictSSL,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (options.siem === 'sumologic' && !!options.siemToken) {
    requestOptions.url = options.siemUrl + options.siemToken;
  }

  if (options.siem === 'splunk') {
    requestOptions.url = options.siemUrl + SPLUNK_PATH;
    requestOptions.headers.Authorization = 'Splunk ' + options.siemToken;
  }

  return requestOptions;
}

// Constructs a SIEM Client to send events to a supported HTTP Endpoint currently
// supports Splunk and Sumologic and any http receiver that accepts post requests.
var SiemClient = module.exports = function init(options) {
  var that = this;
  if (!SUPPORTED_SIEM.includes(options.siem)) { throw options.siem + ' is an unsupported SIEM'; }
  if (options.siem === 'splunk' && !options.siemToken) { throw 'splunk requires a siemToken value to be provided'; }
  this.siem = options.siem;
  this.batchSize = options.siemBatchSize || 100;
  this.batchInterval = options.siemBatchInterval || 1000;
  this.defaultLevel = options.siemDefaultLevel || 'INFO';
  this.currentBatch = 0;
  this.messageQueue = [];
  this.options = prepareRequestOptions(options);
  this.scheduler = setInterval(function() { that._siemSend(); },
    this.batchInterval);
};

// Decides if we are ready to send logs to the server
SiemClient.prototype._siemSend = function() {
  var that = this;
  // Exit if currently sending or trying to send nothing.
  if (this.currentBatch > 0 || this.messageQueue.length === 0) { return; }

  var batchLines = this.messageQueue.slice(0, this.batchSize);
  this.currentBatch = batchLines.length;
  var options = this.options;
  options.body = batchLines.join('\n');

  request(options, function(err, resp, body) {
    that._siemPostCallback(err, resp, body);
  });
};

// Add message to message queue
SiemClient.prototype._append = function(level, args) {
  var data = {};
  var messages = [];

  for (var i = 0; i < args.length; i++ ) { messages.push(args[i]); }

  data.level = level;
  if (messages.length === 1) {
    data.message = messages[0];
  } else {
    data.message = messages;
  }

  if (this.siem === 'splunk') { data = {event: data}; }
  var serializedData = objectToJSON(data);
  if (serializedData !== undefined) { this.messageQueue.push(serializedData); }
};

SiemClient.prototype._siemPostCallback = function(err, resp, body) {
  var failed = !!err || resp.status < 200 || resp.status >= 400;
  if (!failed && this.siem === 'splunk') {
    if (!!body) {
      var parsedBody = JSON.parse(body);
      failed = parsedBody.code !== 0;
    } else {
      failed = true;
    }
  }
  if (!failed) { this.messageQueue.splice(0, this.currentBatch); }
  this.currentBatch = 0;
};

SiemClient.prototype.log = function() { this._append(this.defaultLevel, arguments); };
SiemClient.prototype.info = function() { this._append('INFO', arguments); };
SiemClient.prototype.error = function() { this._append('ERROR', arguments); };
SiemClient.prototype.warn = function() { this._append('WARN', arguments); };
