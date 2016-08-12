var should = require('chai').should();
var sinon = require('sinon');
var rewire = require('rewire');
var config = rewire('../../config/config');

describe('Config', function() {
  beforeEach(function() {
    config.__set__('configFile', './test/fixtures/config.json');
    readConfigFile = config.__get__('readConfigFile');
  });

  describe('_readConfigFile', function() {
    it('returns expected values', function() {
      options = readConfigFile();
      options.token.should.equal('123456');
    });

    it('returns {} when file not exists', function() {
      config.__set__('configFile', './config/config.json.not_exists');
      options = readConfigFile();
      JSON.stringify(options).should.equal(JSON.stringify({}));
    });
  });

  describe('_validateConfig', function() {
    beforeEach(function() {
      options = readConfigFile();
      validateConfig = config.__get__('validateConfig');
    });

    it('does not throw exception with required values present', function() {
      config.__set__('config', options);
      validateConfig.should.not.throw();
    });

    it('throw exception for missing require values', function() {
      delete options.siemUrl;
      config.__set__('config', options);
      validateConfig.should.throw('Missing required values.  Consult the readme for required config values.');
    });
  });

  describe('#load', function() {
    it('loads with env values', function() {
      this.process = {
        abort: sinon.spy(),
        env: {
          LOG_FORWARDER_TOKEN: 'XYZ',
          LOG_FORWARDER_SANITIZED_EVENTS: 'All'
        }
      };
      config.__set__('process', this.process);

      options = config();
      options.token.should.equal('XYZ');
      options.sanitizedEvents.should.be.a('Array');
      options.sanitizedEvents.should.eql(['All']);
      this.process.abort.callCount.should.equal(0);
    });

    it('aborts and logs error message to console', function() {
      this.console = {log: sinon.spy()};
      this.process = {abort: sinon.spy()};
      config.__set__('console', this.console);
      config.__set__('process', this.process);
      config.__set__('configFile', './config/config.json.not_exists');
      global.SUPPORTED_SIEM = ['unsupported'];

      options = config();
      this.console.log.callCount.should.equal(1);
      this.process.abort.callCount.should.equal(1);
    });
  });
});
