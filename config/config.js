var fs = require('fs');
var configFile = './config/config.json';

// eslint-disable-next-line max-statements
module.exports = function load() {
  config = readConfigFile();
  try {
    // Override file values with environment values if present
    config.username = process.env.LOG_FORWARDER_USERNAME || config.username;
    config.token = process.env.LOG_FORWARDER_TOKEN || config.token;
    config.hostname = process.env.LOG_FORWARDER_HOSTNAME || config.hostname;
    config.maxAttempts = parseInt(process.env.LOG_FORWARDER_MAX_ATTEMPTS) || config.maxAttempts || 5;
    config.retryDelay = parseInt(process.env.LOG_FORWARDER_RETRY_DELAY) || config.retryDelay || 500;
    config.siem = process.env.LOG_FORWARDER_SIEM || config.siem;
    config.siemUrl = process.env.LOG_FORWARDER_SIEM_URL || config.siemUrl;
    config.siemToken = process.env.LOG_FORWARDER_SIEM_TOKEN || config.siemToken;
    config.siemBatchSize = parseInt(process.env.LOG_FORWARDER_SIEM_BATCH_SIZE) || config.siemBatchSize || 100;
    config.siemBatchInterval = parseInt(process.env.LOG_FORWARDER_SIEM_BATCH_INTERVAL) || config.siemBatchInterval ||
      1000;
    config.siemDefaultLevel = process.env.LOG_FORWARDER_SIEM_DEFAULT_LEVEL || config.siemDefaultLevel || 'INFO';
    config.tickets = process.env.LOG_FORWARDER_TICKETS || config.tickets;
    config.sanitizedEvents = process.env.LOG_FORWARDER_SANITIZED_EVENTS || config.sanitizedEvents || 'All';
    if (typeof config.sanitizedEvents === typeof '') {
      config.sanitizedEvents = config.sanitizedEvents.split(',');
    }
    if (config.sanitizedEvents.includes('None')) { config.sanitizeNone = true; }
    config.allowedEvents = process.env.LOG_FORWARDER_ALLOWED_EVENTS || config.allowedEvents || 'All';
    if (typeof config.allowedEvents === typeof '') {
      config.allowedEvents = config.allowedEvents.split(',');
    }
    if (config.allowedEvents.includes('None')) { config.allowedNone = true; }
    if (config.allowedEvents.includes('All')) { config.allowedAll = true; }
    config.auditOffset = parseInt(process.env.LOG_FORWARDER_AUDIT_OFFSET) || config.auditOffset || 60;
    config.ticketOffset = parseInt(process.env.LOG_FORWARDER_TICKET_OFFSET) || config.ticketOffset || 30;
    config.auditInterval = parseInt(process.env.LOG_FORWARDER_AUDIT_INTERVAL) || config.auditInterval || 0;
    config.ticketInterval = parseInt(process.env.LOG_FORWARDER_TICKET_INTERVAL) || config.auditInterval || 0;
    if (config.auditInterval > 0 && config.auditInterval < 1000) {
      config.auditInterval = config.auditInterval * 1000;
    }
    if (config.ticketInterval > 0 && config.ticketInterval < 1000) {
      config.ticketInterval = config.ticketInterval * 1000;
    }
    validateConfig();

  } catch (ex) {
    console.log(ex);
    process.abort();
  }

  return config;
};

function readConfigFile() {
  try {
    return JSON.parse(fs.readFileSync(configFile));
  } catch (ex) {
    return {};
  }
}

// Validate config values
function validateConfig() {
  var envValuesAbsent = !config.username || !config.token || !config.hostname || !config.siem || !config.siemUrl;
  if (envValuesAbsent) {
    throw 'Missing required values.  Consult the readme for required config values.';
  }
}
