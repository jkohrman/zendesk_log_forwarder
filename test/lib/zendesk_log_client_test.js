/*eslint camelcase: ["error", {properties: "never"}]*/
var config = require('../fixtures/config.json');
var should = require('chai').should();
var sinon = require('sinon');
var rewire = require('rewire');
var ZendeskLogClient = rewire('../../lib/zendesk_log_client');

describe('ZendeskLogClient', function() {
  beforeEach(function() {
    options = Object.assign({}, config);
    siem = {log: sinon.spy()};
  });

  describe('.init', function() {
    beforeEach(function() {
      this._initialize = sinon.spy();
      oldInit = ZendeskLogClient.__set__('ZendeskLogClient.prototype._initializeTicketCursor', this._initialize);
    });

    afterEach(function() { oldInit(); });

    it('does not throw exception', function() {
      try {
        zendeskLogClient = new ZendeskLogClient(options, siem);
        this._initialize.callCount.should.equal(1);
        zendeskLogClient.request.should.not.be.undefined;
        zendeskLogClient.sanitizer.should.not.be.undefined;
        zendeskLogClient.baseURL.should.eql(options.hostname + '/api/v2/');
      } catch (ex) {
        ex.should.be.undefined;
      }
    });

    it('throws must provide options and siem objects', function() {
      (ZendeskLogClient.bind(ZendeskLogClient, options, undefined)).should
        .throw('Must provide options and siem objects');
    });

    it('throws must provide options and siem objects', function() {
      (ZendeskLogClient.bind(ZendeskLogClient, undefined, siem)).should.throw('Must provide options and siem objects');
    });
  });

  describe('.requestOptions', function() {
    before(function() {
      requestOptions = ZendeskLogClient.__get__('requestOptions');
      expected = {auth: {user:'test@test.com/token', password:'123456'}, json: true, maxAttempts: 5, retryDelay: 500};
    });

    it('returns object with defaults', function() {
      actual = requestOptions(options);
      actual.should.eql(expected);
    });

    it('returns object with set config values', function() {
      options.maxAttempts = 10;
      expected.maxAttempts = 10;
      options.retryDelay = 1000;
      expected.retryDelay = 1000;
      actual = requestOptions(options);
      actual.should.eql(expected);
    });
  });

  describe('#_initializeTicketCursor', function() {
    beforeEach(function() {
      this.console = {log: sinon.spy()};
      oldConsole = ZendeskLogClient.__set__('console', this.console);
      this._initialize = sinon.spy();
      oldInit = ZendeskLogClient.__set__('ZendeskLogClient.prototype._initializeTicketCursor', this._initialize);
      zendeskLogClient = new ZendeskLogClient(options, siem);
      oldInit();
    });

    afterEach(function() {
      oldConsole();
    });

    describe('valid cursor', function() {
      beforeEach(function(done) {
        sinon.stub(zendeskLogClient.request, 'get').yields(null, null, {prev_cursor: 9999});
        done();
      });

      it('sets cursor value correctly and calls right url', function() {
        zendeskLogClient._initializeTicketCursor();
        this.console.log.callCount.should.equal(2);
        zendeskLogClient.request.get.callCount.should.equal(1);
        zendeskLogClient.request.get.args[0][0].should
          .equal('https://localhost/api/v2/ticket_audits.json?max_id=9999999999999999999999&limit=1');
        zendeskLogClient.cursor.should.equal(9999);
        zendeskLogClient.cursorProcessing.should.be.false;
      });
    });

    describe('invalid cursor', function() {
      beforeEach(function(done) {
        sinon.stub(zendeskLogClient.request, 'get').yields(null, null, {prev_cursor: 0});
        done();
      });

      it('throws on error', function() {
        (zendeskLogClient._initializeTicketCursor.bind(zendeskLogClient)).should.throw('cursor could not be obtained');
        this.console.log.callCount.should.equal(1);
        zendeskLogClient.request.get.callCount.should.equal(1);
        zendeskLogClient.request.get.args[0][0].should
          .equal('https://localhost/api/v2/ticket_audits.json?max_id=9999999999999999999999&limit=1');
      });
    });
  });

  describe('Instance tests', function() {
    beforeEach(function() {
      this._initialize = sinon.spy();
      oldInit = ZendeskLogClient.__set__('ZendeskLogClient.prototype._initializeTicketCursor', this._initialize);

      this.console = {log: sinon.spy()};
      oldConsole = ZendeskLogClient.__set__('console', this.console);
      zendeskLogClient = new ZendeskLogClient(options, siem);
      zendeskLogClient.cursor = 1000;
      zendeskLogClient.cursorProcessing = false;
    });

    afterEach(function() { oldConsole(); });
    after(function() { oldInit(); });

    describe('#auditLogs', function() {
      beforeEach(function() {
        this._getZendeskAuditLogs = sinon.spy();
        oldAuditLogs = ZendeskLogClient.__set__('ZendeskLogClient.prototype._getZendeskAuditLogs',
          this._getZendeskAuditLogs);
      });

      afterEach(function() { oldAuditLogs(); });

      it('calls _getZendeskAuditLogs with correct URL', function() {
        zendeskLogClient.auditFilter = false;
        zendeskLogClient.filterStart = '2000-01-01T00:00:00Z';

        zendeskLogClient.auditLogs();
        Math.abs((new Date()) - Date.parse(zendeskLogClient.filterEnd)).should.be.lessThan(1000);
        this._getZendeskAuditLogs.callCount.should.equal(1);
        this._getZendeskAuditLogs.args[0][0].should.eql('https://localhost/api/v2/audit_logs.json?sort_order=asc' +
          '&filter[created_at][]=2000-01-01T00:00:00Z&filter[created_at][]=' + zendeskLogClient.filterEnd);
      });

      it('does not call _getZendeskAuditLogs when processing', function() {
        zendeskLogClient.auditFilter = true;

        zendeskLogClient.auditLogs();
        this._getZendeskAuditLogs.callCount.should.equal(0);
      });
    });

    describe('#ticketAudits', function() {
      beforeEach(function() {
        this._getZendeskTicketAudits = sinon.spy();
        oldTicketAudits = ZendeskLogClient.__set__('ZendeskLogClient.prototype._getZendeskTicketAudits',
          this._getZendeskTicketAudits);
      });

      afterEach(function() { oldTicketAudits(); });

      it('calls _getZendeskTicketAudits when not processing', function() {
        zendeskLogClient.cursorProcessing = false;

        zendeskLogClient.ticketAudits();
        this._getZendeskTicketAudits.callCount.should.equal(1);
      });

      it('does not call _getZendeskAuditLogs when processing', function() {
        zendeskLogClient.cursorProcessing = true;

        zendeskLogClient.ticketAudits();
        this._getZendeskTicketAudits.callCount.should.equal(0);
      });
    });

    describe('#_getZendeskAuditLog', function() {
      beforeEach(function(done) {
        zendeskLogClient.auditFilter = '&TEST_FILTER';
        this._process = sinon.spy();
        oldProcess = ZendeskLogClient.__set__('ZendeskLogClient.prototype._processAuditLogResponse', this._process);
        sinon.stub(zendeskLogClient.request, 'get').yields(null, null, 'test');
        done();
      });

      afterEach(function() {
        zendeskLogClient.request.get.restore();
        oldProcess();
      });

      it('calls request and callback and outputs url when url present', function() {
        zendeskLogClient._getZendeskAuditLogs('https://localhost/api/v2/audit_logs.json&TEST_FILTER');
        this.console.log.callCount.should.equal(1);
        zendeskLogClient.request.get.callCount.should.equal(1);
        zendeskLogClient.request.get.args[0][0].should.equal('https://localhost/api/v2/audit_logs.json&TEST_FILTER');
        this._process.callCount.should.equal(1);
        this._process.calledWith(null, null, 'test');
        zendeskLogClient.auditFilter.should.equal('&TEST_FILTER');
      });

      it('does not call request or callback or outputs url when no url present', function() {
        zendeskLogClient._getZendeskAuditLogs('');
        this.console.log.callCount.should.equal(0);
        zendeskLogClient.request.get.callCount.should.equal(0);
        this._process.callCount.should.equal(0);
        zendeskLogClient.auditFilter.should.be.empty;
      });
    });

    describe('#_processAuditLogResponse', function() {
      beforeEach(function() {
        this._getZendeskAuditLogs = sinon.spy();
        oldGetZendeskAuditLogs = ZendeskLogClient.__set__('ZendeskLogClient.prototype._getZendeskAuditLogs',
          this._getZendeskAuditLogs);
        zendeskLogClient.auditFilter = '&TEST_FILTER';
        zendeskLogClient.filterStart = '2000-01-01T00:00:00Z';
        zendeskLogClient.filterEnd = '2000-01-01T00:01:00Z';
      });
      afterEach(function() { oldGetZendeskAuditLogs(); });

      it('exits and logs message with error', function() {
        zendeskLogClient._processAuditLogResponse('test error', null, {});
        zendeskLogClient.filterStart.should.equal('2000-01-01T00:00:00Z');
        zendeskLogClient.auditFilter.should.be.empty;

        zendeskLogClient.siem.log.callCount.should.equal(0);
        this._getZendeskAuditLogs.callCount.should.equal(0);
        this.console.log.callCount.should.equal(1);
        this.console.log.args[0][0].should.equal('test error');
      });

      it('updates state with null next_page & does not call _getZendeskAuditLogs', function() {
        zendeskLogClient._processAuditLogResponse(null, null, {audit_logs: [], next_page: null});
        zendeskLogClient.filterStart.should.equal('2000-01-01T00:01:00Z');
        zendeskLogClient.auditFilter.should.be.empty;

        zendeskLogClient.siem.log.callCount.should.equal(0);
        this._getZendeskAuditLogs.callCount.should.equal(0);
      });

      it('updates state with undefined next_page & does not call _getZendeskAuditLogs', function() {
        zendeskLogClient._processAuditLogResponse(null, null, {audit_logs: []});
        zendeskLogClient.filterStart.should.equal('2000-01-01T00:01:00Z');
        zendeskLogClient.auditFilter.should.be.empty;

        zendeskLogClient.siem.log.callCount.should.equal(0);
        this._getZendeskAuditLogs.callCount.should.equal(0);
      });

      it('calls siem.log N times for N audit_logs and updates', function() {
        zendeskLogClient._processAuditLogResponse(null, null, {
          audit_logs: [{a: '1'}, {a: '2'}, {a: '3'}],
        });
        zendeskLogClient.filterStart.should.equal('2000-01-01T00:01:00Z');
        zendeskLogClient.auditFilter.should.be.empty;

        zendeskLogClient.siem.log.callCount.should.equal(3);
        zendeskLogClient.siem.log.args[0][0].should.eql({a: '1'});
        zendeskLogClient.siem.log.args[1][0].should.eql({a: '2'});
        zendeskLogClient.siem.log.args[2][0].should.eql({a: '3'});
        this._getZendeskAuditLogs.callCount.should.equal(0);
      });

      it('calls _getZendeskAuditLogs when next_page set', function() {
        zendeskLogClient._processAuditLogResponse(null, null,
          {audit_logs: [], count:1000, next_page: 'http://test/?page=2'});
        zendeskLogClient.filterStart.should.equal('2000-01-01T00:01:00Z');
        zendeskLogClient.auditFilter.should.equal('&TEST_FILTER');

        zendeskLogClient.siem.log.callCount.should.equal(0);
        this._getZendeskAuditLogs.callCount.should.equal(1);
        this._getZendeskAuditLogs.args[0][0].should.equal('http://test/?page=2&TEST_FILTER');
      });
    });

    describe('#_getZendeskTicketAudits', function() {
      beforeEach(function(done) {
        this._process = sinon.spy();
        oldProcess = ZendeskLogClient.__set__('ZendeskLogClient.prototype._processTicketAuditResponse', this._process);
        sinon.stub(zendeskLogClient.request, 'get').yields(null, null, 'test');
        zendeskLogClient.cursor = 1;
        done();
      });

      afterEach(function() {
        zendeskLogClient.request.get.restore();
        oldProcess();
      });

      it('calls request and callback and outputs url when url present', function() {
        zendeskLogClient._getZendeskTicketAudits();
        this.console.log.callCount.should.equal(1);
        zendeskLogClient.request.get.callCount.should.equal(1);
        zendeskLogClient.request.get.args[0][0].should
          .equal('https://localhost/api/v2/ticket_audits.json?since_id=1&limit=1000');
        this._process.callCount.should.equal(1);
        this._process.calledWith(null, null, 'test');
        zendeskLogClient.cursorProcessing.should.be.true;
      });
    });

    describe('#_processTicketAuditResponse', function() {
      beforeEach(function() {
        this._getZendeskTicketAudits = sinon.spy();
        oldGetZendeskTicketAudits = ZendeskLogClient.__set__('ZendeskLogClient.prototype._getZendeskTicketAudits',
          this._getZendeskTicketAudits);
        sinon.stub(zendeskLogClient.sanitizer, 'sanitize').returnsArg(0);
        zendeskLogClient.cursorProcessing = true;
      });
      afterEach(function() { oldGetZendeskTicketAudits(); });

      it('exits and logs message with error', function() {
        zendeskLogClient._processTicketAuditResponse('test error', null, {audits: [], next_cursor: null});
        zendeskLogClient.sanitizer.sanitize.callCount.should.equal(0);
        zendeskLogClient.cursor.should.equal(1000);
        zendeskLogClient.cursorProcessing.should.be.false;
        this._getZendeskTicketAudits.callCount.should.equal(0);
        zendeskLogClient.sanitizer.sanitize.callCount.should.equal(0);
        zendeskLogClient.siem.log.callCount.should.equal(0);
        this.console.log.callCount.should.equal(1);
        this.console.log.args[0][0].should.equal('test error');
      });

      it('does not update nil next_cursor & does not call sanitize', function() {
        zendeskLogClient._processTicketAuditResponse(null, null, {audits: [], next_cursor: null});
        zendeskLogClient.sanitizer.sanitize.callCount.should.equal(0);
        zendeskLogClient.siem.log.callCount.should.equal(0);
        zendeskLogClient.cursor.should.equal(1000);
        zendeskLogClient.cursorProcessing.should.be.false;
        this._getZendeskTicketAudits.callCount.should.equal(0);
      });

      it('does not update undefined next_cursor', function() {
        zendeskLogClient._processTicketAuditResponse(null, null, {audits: []});
        zendeskLogClient.sanitizer.sanitize.callCount.should.equal(0);
        zendeskLogClient.siem.log.callCount.should.equal(0);
        zendeskLogClient.cursor.should.equal(1000);
        zendeskLogClient.cursorProcessing.should.be.false;
        this._getZendeskTicketAudits.callCount.should.equal(0);
      });

      it('calls sanitizer N times for N audits, logs and updates state', function() {
        zendeskLogClient._processTicketAuditResponse(null, null, {
          audits: [{a: '1'}, {a: '2'}, {a: '3'}],
          next_cursor: 2000
        });
        zendeskLogClient.sanitizer.sanitize.callCount.should.equal(3);
        zendeskLogClient.sanitizer.sanitize.args[0][0].should.eql({a: '1'});
        zendeskLogClient.sanitizer.sanitize.args[1][0].should.eql({a: '2'});
        zendeskLogClient.sanitizer.sanitize.args[2][0].should.eql({a: '3'});
        zendeskLogClient.siem.log.callCount.should.equal(3);
        zendeskLogClient.siem.log.args[0][0].should.eql({a: '1'});
        zendeskLogClient.siem.log.args[1][0].should.eql({a: '2'});
        zendeskLogClient.siem.log.args[2][0].should.eql({a: '3'});
        zendeskLogClient.cursor.should.equal(2000);
        zendeskLogClient.cursorProcessing.should.be.false;
        this._getZendeskTicketAudits.callCount.should.equal(0);
      });

      it('calls _getZendeskTicketAudit when count == MAX_TICKET_AUDITS', function() {
        zendeskLogClient._processTicketAuditResponse(null, null, {audits: [], count:1000, next_cursor: 2000});
        zendeskLogClient.sanitizer.sanitize.callCount.should.equal(0);
        zendeskLogClient.siem.log.callCount.should.equal(0);
        zendeskLogClient.cursor.should.equal(2000);
        zendeskLogClient.cursorProcessing.should.be.true;
        this._getZendeskTicketAudits.callCount.should.equal(1);
      });
    });
  });
});
