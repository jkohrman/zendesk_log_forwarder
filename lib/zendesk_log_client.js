var Request = require('requestretry');
var Sanitizer = require('./sanitizer');

var MAX_TICKET_AUDITS = 1000;
var AUDIT_ENDPOINT = 'audit_logs.json';
var TICKET_AUDIT_ENDPOINT = 'ticket_audits.json';


function requestOptions(options) {
  var zendeskOptions = {
    auth: {
      user: options.username + '/token',
      password: options.token
    },
    json: true,
    maxAttempts: options.maxAttempts || 5,
    retryDelay: options.retryDelay || 500
  };
  return zendeskOptions;
}

var ZendeskLogClient = module.exports = function init(options, siem) {
  if (options === undefined || siem === undefined) { throw 'Must provide options and siem objects.'; }
  var zendeskOptions = requestOptions(options);

  // critical variables
  this.baseURL = options.hostname + '/api/v2/';
  this.sanitizer = new Sanitizer(options);
  this.request = Request.defaults(zendeskOptions);
  this.siem = siem;

  // state tracking
  this.filterStart = (new Date()).toISOString();
  this.cursor = 0;
  this.auditFilter = '';
  this.cursorProcessing = true; // blocks processing until cursor initialized

  // Initialize cursor state
  this._initializeTicketCursor();
};

// Audit Log private functions
// Private inteface to get Audit Logs
ZendeskLogClient.prototype._getZendeskAuditLogs = function(url) {
  if (!url) {
    this.auditFilter = '';
    return;
  }
  var that = this;
  console.log(url);
  this.request.get(url, function(err, resp, body) {
    that._processAuditLogResponse(err, resp, body);
  });
};

// Callback for _getZendeskAuditLogs
// Takes responses and forwards to the SIEM
// If response body indicates a next page processes the next page
// Updates state when done processing
ZendeskLogClient.prototype._processAuditLogResponse = function(err, resp, body) {
  if (err || body === undefined || body.audit_logs === undefined ) {
    console.log(err);
    this.auditFilter = '';
    return;
  }

  var that = this;
  this.filterStart = this.filterEnd;

  body.audit_logs.forEach(function(audit) {
    that.siem.log(audit);
  });

  if (body.next_page) {
    this._getZendeskAuditLogs(body.next_page + this.auditFilter);
  } else {
    this.auditFilter = '';
  }
};

// Ticket Audit Log private functions
// Private ticket audit cursor initializer function.
ZendeskLogClient.prototype._initializeTicketCursor = function() {
  var that = this;
  url = this.baseURL + TICKET_AUDIT_ENDPOINT + '?max_id=9999999999999999999999&limit=1';
  console.log(url);
  this.cursorProcessing = true;
  this.request.get(url, function cursorInitializer(err, resp, body) {
    if (err) {
      console.log(err);
      return;
    }
    that.cursor = body.prev_cursor || that.cursor;  // Reverse order
    if (!that.cursor) { throw 'cursor could not be obtained'; }
    console.log(that.cursor);
    that.cursorProcessing = false;
  });
};

// Private interface to get Ticket Audits
ZendeskLogClient.prototype._getZendeskTicketAudits = function() {
  var that = this;
  this.cursorProcessing = true;
  url = this.baseURL + TICKET_AUDIT_ENDPOINT + '?since_id=' + this.cursor + '&limit=' + MAX_TICKET_AUDITS;
  console.log(url);
  this.request.get(url, function(err, resp, body) {
    that._processTicketAuditResponse(err, resp, body);
  });
};

// Callback for _getZendeskTicketAudits
// Process response, updates cursor, sanitizes responses, and send to siem
// If response body if full page size processes the next page
ZendeskLogClient.prototype._processTicketAuditResponse = function(err, resp, body) {
  if (err || body === undefined || body.audits === undefined) {
    console.log(err);
    this.cursorProcessing = false;
    return;
  }

  var that = this;
  this.cursor = body.next_cursor || this.cursor;  // Reverse order
  if (!this.cursor) { _initializeTicketCursor(); }
  console.log(this.cursor);

  // Sanitize then send to SIEM
  body.audits.forEach(function(audit) {
    var entry = that.sanitizer.sanitize(audit);
    that.siem.log(entry);
  });

  // If there may be more check next page otherwise end processing and clear processing state
  if (body.count === MAX_TICKET_AUDITS) {
    this._getZendeskTicketAudits();
  } else {
    this.cursorProcessing = false;
  }
};

// Public functions
// Public interface to get Audit Logs
ZendeskLogClient.prototype.auditLogs = function () {
  if (!!this.auditFilter) { return; }
  this.filterEnd = (new Date()).toISOString();
  this.auditFilter='&filter[created_at][]=' + this.filterStart + '&filter[created_at][]=' + this.filterEnd;
  url = this.baseURL + AUDIT_ENDPOINT + '?sort_order=asc' + this.auditFilter;
  this._getZendeskAuditLogs(url);
};

// Public interface to get Ticket Audits
ZendeskLogClient.prototype.ticketAudits = function() {
  if (this.cursorProcessing) { return; }
  this._getZendeskTicketAudits();
};
