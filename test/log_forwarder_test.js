
var config = require('./fixtures/config.json');
var should = require('chai').should();
var sinon = require('sinon');
var rewire = require('rewire');
var SiemClient = rewire('../lib/siem_client');
var ZendeskLogClient = rewire('../lib/zendesk_log_client');

beforeEach('Root beforeEach', function() {
  clock = sinon.useFakeTimers();
  process.env.TEST = 'TRUE'; // Set so loading the module doesn't throw error.
  LogForwarder = rewire('../log_forwarder');
  LogForwarder.__set__('config', config);
});
afterEach('Root afterEach', function() { clock.restore(); });

describe('LogForwarder', function() {
  describe('#init', function() {
    beforeEach(function() {
      this.SiemClient = sinon.spy(SiemClient);
      this.ZendeskLogClient = sinon.spy(ZendeskLogClient);
      this._initializeTicketCursor = sinon.spy();
      oldCursor = ZendeskLogClient.__set__('ZendeskLogClient.prototype._initializeTicketCursor',
        this._initializeTicketCursor);
      oldSiemClient = LogForwarder.__set__('SiemClient', this.SiemClient);
      oldZendeskLogClient = LogForwarder.__set__('ZendeskLogClient', this.ZendeskLogClient);
    });

    afterEach(function() {
      oldCursor();
      oldSiemClient();
      oldZendeskLogClient();
    });

    describe('with no errors in clients', function() {
      beforeEach(function() {
        forwarder = new LogForwarder();
      });

      it('initializes', function() {
        forwarder.init();
        forwarder.config.should.eql(config);
        this.SiemClient.callCount.should.equal(1);
        this.ZendeskLogClient.callCount.should.equal(1);
        this._initializeTicketCursor.callCount.should.equal(1);
      });
    });

    describe('with errors in clients', function() {
      beforeEach(function() {
        this.console = {log: sinon.spy()};
        this.process = {abort: sinon.spy()};
        errorSiemClient = function() { throw 'splunk requires a siemToken value to be provided'; };
        LogForwarder.__set__('SiemClient', errorSiemClient);
        oldConsole = LogForwarder.__set__('console', this.console);
        oldProcess = LogForwarder.__set__('process', this.process);
      });

      afterEach(function() {
        oldConsole();
        oldProcess();
      });

      it('aborts and outputs message to console if a client fails to initialize', function() {
        forwarder = new LogForwarder();

        forwarder.init();
        forwarder.config.should.eql(config);
        this.console.log.callCount.should.equal(1);
        this.console.log.args[0][0].should.equal('splunk requires a siemToken value to be provided');
        this.process.abort.callCount.should.equal(1);
      });
    });
  });

  describe('#main', function() {
    beforeEach(function() {
      forwarder = new LogForwarder();
      forwarder.config = config;
      forwarder.zendeskLogClient = {
        filterStart: '2000-01-01T00:00:00Z',
        cursor: 999,
        auditLogs: sinon.spy(),
        ticketAudits: sinon.spy()
      };
      forwarder.schedule = sinon.spy();
    });

    it('calls debug functions if config.debug', function() {
      forwarder.config.debug = true;
      forwarder.main();
      forwarder.zendeskLogClient.filterStart.should.eql('1970-01-01T00:00:00.000Z');
      forwarder.zendeskLogClient.cursor.should.eql(1);
      forwarder.zendeskLogClient.auditLogs.callCount.should.equal(1);
      forwarder.zendeskLogClient.ticketAudits.callCount.should.equal(1);
      forwarder.schedule.callCount.should.equal(1);
    });

    it('does not call debug functions if config.debug undefined', function() {
      forwarder.config.debug = undefined;
      forwarder.main();
      forwarder.zendeskLogClient.filterStart.should.eql('2000-01-01T00:00:00Z');
      forwarder.zendeskLogClient.cursor.should.eql(999);
      forwarder.zendeskLogClient.auditLogs.callCount.should.equal(0);
      forwarder.schedule.callCount.should.equal(1);
    });

    it('does not call debug functions if config.debug null', function() {
      forwarder.config.debug = null;
      forwarder.main();
      forwarder.zendeskLogClient.filterStart.should.eql('2000-01-01T00:00:00Z');
      forwarder.zendeskLogClient.cursor.should.eql(999);
      forwarder.zendeskLogClient.auditLogs.callCount.should.equal(0);
      forwarder.schedule.callCount.should.equal(1);
    });

    it('does not call debug functions if config.debug false', function() {
      forwarder.config.debug = false;
      forwarder.main();
      forwarder.zendeskLogClient.filterStart.should.eql('2000-01-01T00:00:00Z');
      forwarder.zendeskLogClient.cursor.should.eql(999);
      forwarder.zendeskLogClient.auditLogs.callCount.should.equal(0);
      forwarder.schedule.callCount.should.equal(1);
    });
  });

  describe('#schedule', function() {
    beforeEach(function() {
      forwarder = new LogForwarder();
      forwarder.config = config;
      forwarder.zendeskLogClient = {
        auditLogs: sinon.spy(),
        ticketAudits: sinon.spy()
      };
    });

    /* eslint-disable max-statements */
    it('calls zendeskLogClient when scheduled and handles seconds > 60', function() {
      forwarder.config.tickets = true;
      forwarder.config.auditOffset = 75;
      forwarder.config.ticketOffset = 90;
      forwarder.schedule();

      clock.tick(0);
      forwarder.zendeskLogClient.auditLogs.callCount.should.equal(0);
      forwarder.zendeskLogClient.ticketAudits.callCount.should.equal(0);
      clock.tick(15000);
      forwarder.zendeskLogClient.auditLogs.callCount.should.equal(1);
      forwarder.zendeskLogClient.ticketAudits.callCount.should.equal(0);
      clock.tick(15000);
      forwarder.zendeskLogClient.auditLogs.callCount.should.equal(1);
      forwarder.zendeskLogClient.ticketAudits.callCount.should.equal(1);
      clock.tick(15000);
      forwarder.zendeskLogClient.auditLogs.callCount.should.equal(1);
      forwarder.zendeskLogClient.ticketAudits.callCount.should.equal(1);
    });
    /* eslint-enable */

    it('does not schedule tickets when false', function() {
      forwarder.config.tickets = false;
      forwarder.config.auditOffset = 75;
      forwarder.config.ticketOffset = 90;
      forwarder.schedule();

      clock.tick(60000);
      forwarder.zendeskLogClient.auditLogs.callCount.should.equal(1);
      forwarder.zendeskLogClient.ticketAudits.callCount.should.equal(0);
    });

    it('schedules offset and intervals when separate', function() {
      forwarder.config.tickets = true;
      forwarder.config.auditOffset = 75;
      forwarder.config.ticketInterval = 1000;
      forwarder.schedule();

      clock.tick(60000);
      forwarder.zendeskLogClient.auditLogs.callCount.should.equal(1);
      forwarder.zendeskLogClient.ticketAudits.callCount.should.equal(60);
    });

    it('schedules intervals when offset and interval are present for same options', function() {
      forwarder.config.tickets = true;
      forwarder.config.auditOffset = 75;
      forwarder.config.auditInterval = 1000;
      forwarder.config.ticketOffset = 30;
      forwarder.config.ticketInterval = 1000;
      forwarder.schedule();

      clock.tick(60000);
      forwarder.zendeskLogClient.auditLogs.callCount.should.equal(60);
      forwarder.zendeskLogClient.ticketAudits.callCount.should.equal(60);
    });
  });
});
