var should = require('chai').should();
var Sanitizer = require('../../lib/sanitizer');
var Fixture = require('../fixtures/ticket_audits.json');

describe('Sanitizer', function() {
  beforeEach(function() {
    options = {
      sanitizedEvents: ['Create', 'Notification'],
      allowedEvents: ['Cc', 'Notification']
    };
  });

  describe('Initialize', function() {
    it('detects and sets sanitizeAll', function() {
      options.sanitizedEvents.push('All');
      sanitizer = new Sanitizer(options);
      sanitizer.sanitizeAll.should.be.true;
      sanitizer.allowAll.should.be.false;
    });

    it('detects and sets allowAll', function() {
      options.allowedEvents.push('All');
      sanitizer = new Sanitizer(options);
      sanitizer.allowAll.should.be.true;
      sanitizer.sanitizeAll.should.be.false;
    });

    it('detects and sets sanitizeNone', function() {
      options.sanitizedEvents.push('None');
      sanitizer = new Sanitizer(options);
      sanitizer.sanitizeNone.should.be.true;
      sanitizer.allowNone.should.be.false;
    });

    it('detects and sets allowNone', function() {
      options.allowedEvents.push('None');
      sanitizer = new Sanitizer(options);
      sanitizer.allowNone.should.be.true;
      sanitizer.sanitizeNone.should.be.false;
    });

    it('sets options arrays', function() {
      sanitizer = new Sanitizer(options);
      sanitizer.sanitizeAll.should.be.false;
      sanitizer.sanitizedEvents.should.eql(options.sanitizedEvents);
      sanitizer.allowedEvents.should.eql(options.allowedEvents);
    });
  });

  describe('Instance tests', function() {
    beforeEach(function() { sanitizer = new Sanitizer(options); });

    describe('#sanitize', function() {
      beforeEach(function() {
        mockedEvent = JSON.parse(JSON.stringify(Fixture));
        expectedNormal = JSON.parse(JSON.stringify(mockedEvent));
        delete expectedNormal.events[1].subject;
        delete expectedNormal.events[1].body;
        expectedAll = JSON.parse(JSON.stringify(expectedNormal));
        delete expectedAll.events[0].body;
        delete expectedAll.events[0].attachments;
      });

      it('Filters out all events when allowNone', function() {
        sanitizer.allowNone = true;
        expectedNormal.events = [];
        actual = sanitizer.sanitize(mockedEvent);
        actual.should.eql(expectedNormal);
      });

      it('Filters out comments and sanitizes notification', function() {
          sanitizer.allowAll = false;
          expectedNormal.events.shift();
          actual = sanitizer.sanitize(mockedEvent);
          actual.should.eql(expectedNormal);
      });

      it('sanitizes configured event types', function() {
        sanitizer.allowAll = true;
        actual = sanitizer.sanitize(mockedEvent);
        actual.should.eql(expectedNormal);
      });

      it('sanitizes all event types', function() {
        sanitizer.allowAll = true;
        sanitizer.sanitizeAll = true;
        actual = sanitizer.sanitize(mockedEvent);
        actual.should.eql(expectedAll);
      });

      it('sanitizes events no events', function() {
        sanitizer.allowAll = true;
        sanitizer.sanitizeNone = true;
        actual = sanitizer.sanitize(mockedEvent);
        actual.should.eql(mockedEvent);
      });
    });
  });
});
