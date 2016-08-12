var AUTHORIZED_KEYS = [
  'id', 'type', 'field_name', 'public', 'created_at', 'author_id', 'comment_id',
  'attachment_id', 'trusted', 'recipients', 'via', 'score', 'agreement_id',
  'action', 'message', 'direct_message', 'page', 'communication', 'ticket_via',
  'graph_object_id', 'resource'
];

Sanitizer = module.exports = function initialize(options) {
  this.sanitizeAll = false;
  this.sanitizeNone = false;
  this.sanitizedEvents = options.sanitizedEvents;
  this.allowNone = false;
  this.allowAll = false;
  this.allowedEvents = options.allowedEvents;
  if (this.sanitizedEvents.includes('All')) { this.sanitizeAll = true; }
  if (this.sanitizedEvents.includes('None')) { this.sanitizeNone = true; }
  if (this.allowedEvents.includes('All')) { this.allowAll = true; }
  if (this.allowedEvents.includes('None')) { this.allowNone = true; }
};

Sanitizer.prototype.sanitize = function sanitize(entry) {
  var that = this;

  if (this.allowNone) {
    entry.events = [];
    return entry;
  }
  entry.events = entry.events.map(function sanitizeEvent(event) {
    var removeEvent = !(that.allowAll || that.allowedEvents.includes(event.type));
    if (removeEvent) { return null; }
    if (that.sanitizeNone) { return event; }
    return (that.sanitizeAll || that.sanitizedEvents.includes(event.type)) ? removeKeys(event) : event;
  });

  entry.events = entry.events.filter(function stripNull(val) {
    if (!!val) { return true; }
  });

  return entry;
};

function removeKeys(event) {
  for (var key in event) { if (!AUTHORIZED_KEYS.includes(key)) { delete event[key]; } }
  return event;
}
