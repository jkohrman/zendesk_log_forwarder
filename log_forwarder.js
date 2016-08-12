if (!process.env.TEST) {
  config = require('./config/config')(); // skip config load if test
}
var SiemClient = require('./lib/siem_client');
var ZendeskLogClient = require('./lib/zendesk_log_client');
var scheduler = require('node-schedule');

var Forwarder = function() {};

Forwarder.prototype.init = function() {
  // Initialize
  try {
    this.config = config;
    this.siem = new SiemClient(config);
    this.zendeskLogClient = new ZendeskLogClient(this.config, this.siem);
  } catch (ex) {
    console.log(ex);
    process.abort();
  }
};

Forwarder.prototype.main = function () {
  // Debug helper sets states to get audit log events and immediately calls
  // functions to get audits
  if (this.config.debug) {
    this.zendeskLogClient.filterStart = new Date(0).toISOString();
    this.zendeskLogClient.auditLogs();
    this.zendeskLogClient.cursor = 1;
    this.zendeskLogClient.ticketAudits();
  }

  // Start polling
  this.schedule();
};

// *** Schedule Jobs ***
Forwarder.prototype.schedule = function() {
  var that = this;
  var offset = this.config.auditOffset % 60;
  if (!!this.config.auditInterval) {
    setInterval(function() { that.zendeskLogClient.auditLogs(); }, that.config.auditInterval);
  } else {
    scheduler.scheduleJob({second: offset}, function() { that.zendeskLogClient.auditLogs(); });
  }

  if (config.tickets) {
    offset = this.config.ticketOffset % 60;
    if (!!this.config.ticketInterval) {
      setInterval(function() { that.zendeskLogClient.ticketAudits(); }, that.config.ticketInterval);
    } else {
      scheduler.scheduleJob({second: offset}, function() { that.zendeskLogClient.ticketAudits(); });
    }
  }
};

module.exports = Forwarder;
