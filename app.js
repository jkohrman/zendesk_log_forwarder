LogForwarder = require('./log_forwarder');
app = new LogForwarder();

// initialize and start the forwarder
app.init();
setTimeout(function() { app.main(); }, 1000);
