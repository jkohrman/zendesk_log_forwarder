var config = require('../fixtures/config.json');
var should = require('chai').should();
var sinon = require('sinon');
var rewire = require('rewire');
var SiemClient = rewire('../../lib/siem_client');

describe('SiemClient', function() {
  beforeEach(function() {
    clock = sinon.useFakeTimers();
    options = Object.assign({}, config);
    options.batchInterval  = 1000;
  });

  afterEach(function() { clock.restore(); });

  describe('.init', function() {
    it('does not throw exception', function() {
      (SiemClient.bind(SiemClient, options)).should.not.throw();
    });

    it('throws unsupported siem', function() {
      options.siem = 'unsupported';
      (SiemClient.bind(SiemClient, options)).should.throw(options.siem + ' is an unsupported SIEM');
    });

    it('throws missing siem token', function() {
      options.siem = 'splunk';
      delete options.siemToken;
      (SiemClient.bind(SiemClient, options)).should.throw('splunk requires a siemToken value to be provided');
    });

    it('calls _siemSend when timer is triggered', function() {
      var spy = sinon.spy();
      var SiemClient2 = rewire('../../lib/siem_client');
      SiemClient2.__set__('SiemClient.prototype._siemSend', spy);

      client = new SiemClient2(options);
      clock.tick(0);
      client._siemSend.callCount.should.equal(0);
      clock.tick(1000);
      client._siemSend.callCount.should.equal(1);
      clock.tick(1000);
      client._siemSend.callCount.should.equal(2);
    });
  });

  describe('_objectToJSON', function() {
    beforeEach(function() {
      this.console = {log: sinon.spy()};
      objectToJSON = SiemClient.__get__('objectToJSON');
      oldConsole = SiemClient.__set__('console', this.console);
    });

    afterEach(function() {oldConsole(); });

    it('returns serialized string and outputs no error', function() {
      actual = objectToJSON({hello: 'world'});
      actual.should.equal('{"hello":"world"}');
      this.console.log.callCount.should.equal(0);
    });

    it('logs error and does not throw', function() {
      badObject = {};
      Object.defineProperty(badObject, 'foo', {
        get: function() { throw 'Not serializable'; },
        enumerable: true
      });

      (objectToJSON.bind(objectToJSON, badObject)).should.not.throw();
      this.console.log.callCount.should.equal(1);
      actual = objectToJSON(badObject);
      (typeof actual).should.equal('undefined');
    });
  });

  describe('_prepareRequestOptions', function() {
    beforeEach(function() {
      expected = {
        url: options.siemUrl,
        method: 'POST',
        strictSSL: false,
        headers: {
          'Content-Type': 'application/json'
        }
      };
      options.siem = 'http';
      _prepareRequestOptions = SiemClient.__get__('prepareRequestOptions');
    });

    it('returns values', function() {
      actual = _prepareRequestOptions(options);
      actual.should.eql(expected);
    });

    it('returns values with strictSSL true when absent', function() {
      delete options.strictSSL;
      expected.strictSSL = true;
      actual = _prepareRequestOptions(options);
      actual.should.eql(expected);
    });

    it('returns correct value for sumologic with token', function() {
      options.siem = 'sumologic';
      expected.url += options.siemToken;
      actual = _prepareRequestOptions(options);
      actual.should.eql(expected);
    });

    it('returns correct value for sumologic with no token', function() {
      options.siem = 'sumologic';
      delete options.siemToken;
      actual = _prepareRequestOptions(options);
      actual.should.eql(expected);
    });

    it('returns correct values for splunk', function() {
      options.siem = 'splunk';
      expected.headers.Authorization = 'Splunk ' + options.siemToken;
      expected.url += '/services/collector/event/1.0';
      actual = _prepareRequestOptions(options);
      actual.should.eql(expected);
    });
  });

  describe('instance tests', function() {
    beforeEach(function() {
      client = new SiemClient(options);
    });

    describe('_siemSend', function() {
      beforeEach(function() {
        client.messageQueue = ['{"a":1}','{"b": 2}'];
        this.request = sinon.spy();
        oldRequest = SiemClient.__set__('request', this.request);
      });

      afterEach(function() { oldRequest(); });

      it('submits request once', function() {
        client._siemSend();
        client._siemSend();
        this.request.callCount.should.equal(1);
      });

      it('does not submit with empty messageQueue', function() {
        client.messageQueue = [];
        client._siemSend();
        this.request.callCount.should.equal(0);
      });

      it('submits request once first row in queue when batchSize = 1 and sets state', function() {
        client.batchSize = 1;
        client._siemSend();
        this.request.callCount.should.equal(1);
        request = this.request.args[0][0];
        request.body.split('\n').length.should.equal(1);
        request.body.should.eql('{"a":1}');
        client.currentBatch.should.equal(1);
      });
    });

    describe('_append', function() {
      beforeEach(function() {
        this.console = {log: sinon.spy()};
        oldConsole = SiemClient.__set__('console', this.console);
      });

      afterEach(function() {oldConsole(); });

      function testAppend() { client._append('TEST', arguments); }

      it('appends to message queue logging a string and not splunk', function() {
        client.siem='http';
        testAppend('test log message');
        client.messageQueue.length.should.equal(1);
        client.messageQueue[0].should.eql('{"level":"TEST","message":"test log message"}');
      });

      it('appends to message queue when logging an array object and not splunk', function() {
        client.siem='http';
        testAppend(['test message 1', 'test message 2']);
        client.messageQueue.length.should.equal(1);
        client.messageQueue[0].should.eql('{"level":"TEST","message":["test message 1","test message 2"]}');
      });

      it('appends to message queue when logging multiple strings and not splunk', function() {
        client.siem='http';
        testAppend('test message 1', 'test message 2');
        client.messageQueue.length.should.equal(1);
        client.messageQueue[0].should.eql('{"level":"TEST","message":["test message 1","test message 2"]}');
      });

      it('appends to message queue when logging an serializable object and not splunk', function() {
        client.siem='http';
        object = {a: 1};
        testAppend(object);
        client.messageQueue.length.should.equal(1);
        client.messageQueue[0].should.eql('{"level":"TEST","message":{"a":1}}');
      });

      it('appends to message queue when logging an serializable object and splunk', function() {
        object = {a: 1};
        testAppend(object);
        client.messageQueue.length.should.equal(1);
        client.messageQueue[0].should.eql('{"event":{"level":"TEST","message":{"a":1}}}');
      });

      it('does not append an nonserializable object and displays error', function() {
        badObject = {};
        Object.defineProperty(badObject, 'foo', {
          get: function() { throw 'Not serializable'; },
          enumerable: true
        });

        testAppend(badObject);
        client.messageQueue.length.should.equal(0);
        this.console.log.callCount.should.equal(1);
      });
    });

    describe('.log, .info, .error, .warn', function() {
      beforeEach(function() {
        this._append = sinon.spy();
        oldAppend = SiemClient.__set__('SiemClient.prototype._append', this._append);
      });
      afterEach(function() { oldAppend(); });

      it('.log sends defaultlevel and message to _append', function() {
        client.log('test');
        this._append.callCount.should.equal(1);
        var params = this._append.args[0];
        params[0].should.equal(client.defaultLevel);
        params[1][0].should.equal('test');
      });

      it('.log sends defaultlevel and messages to _append', function() {
        client.log('test', 'number 2');
        this._append.callCount.should.equal(1);
        var params = this._append.args[0];
        params[0].should.equal(client.defaultLevel);
        params[1][0].should.equal('test');
        params[1][1].should.equal('number 2');
      });

      it('.info sends INFO and message to _append', function() {
        client.info('test');
        this._append.callCount.should.equal(1);
        var params = this._append.args[0];
        params[0].should.equal('INFO');
        params[1][0].should.equal('test');
      });

      it('.error sends ERROR and message to _append', function() {
        client.error('test');
        this._append.callCount.should.equal(1);
        var params = this._append.args[0];
        params[0].should.equal('ERROR');
        params[1][0].should.equal('test');
      });

      it('.warn sends WARN and message to _append', function() {
        client.warn('test');
        this._append.callCount.should.equal(1);
        var params = this._append.args[0];
        params[0].should.equal('WARN');
        params[1][0].should.equal('test');
      });
    });

    describe('_siemPostCallback', function() {
      beforeEach(function() {
        client.siem = 'http';
        client.messageQueue = ['message 1', 'message 2'];
        client.currentBatch = 1;
        resp = {status: 200};
      });

      it('does not remove messages from queue and reset state on error', function() {
        client._siemPostCallback('1', resp, '');
        client.messageQueue.length.should.equal(2);
        client.currentBatch.should.equal(0);
      });

      it('does not remove messages from queue and reset state on < 200 status', function() {
        resp.status = 199;
        client._siemPostCallback(null, resp, '');
        client.messageQueue.length.should.equal(2);
        client.currentBatch.should.equal(0);
      });

      it('does not remove messages from queue and reset state on >= 400 status', function() {
        resp.status = 400;
        client._siemPostCallback(null, resp, '');
        client.messageQueue.length.should.equal(2);
        client.currentBatch.should.equal(0);

        resp.status = 401;
        client._siemPostCallback(null, resp, '');
        client.messageQueue.length.should.equal(2);
        client.currentBatch.should.equal(0);
      });

      it('does not remove messages from queue and reset state on splunk with blank response', function() {
        client.siem = 'splunk';
        client._siemPostCallback(null, resp, '');
        client.messageQueue.length.should.equal(2);
        client.currentBatch.should.equal(0);
      });

      it('does not remove messages from queue and reset state on splunk with != 0 code', function() {
        client.siem = 'splunk';
        client._siemPostCallback(null, resp, '{"code": 1}');
        client.messageQueue.length.should.equal(2);
        client.currentBatch.should.equal(0);
      });

      it('removes messages from queue and reset state on splunk with 0 code', function() {
        client.siem = 'splunk';
        client._siemPostCallback(null, resp, '{"code": 0}');
        client.messageQueue.length.should.equal(1);
        client.messageQueue.should.eql(['message 2']);
        client.currentBatch.should.equal(0);
      });

      it('removes messages from queue and reset state when successful and no body for nonsplunk', function() {
        client._siemPostCallback(null, resp, '{"code": 0}');
        client.messageQueue.length.should.equal(1);
        client.messageQueue.should.eql(['message 2']);
        client.currentBatch.should.equal(0);
      });
    });
  });
});
