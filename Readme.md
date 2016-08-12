# Zendesk Log Forwarder

## Description
This application is a log forwarder that queries the Zendesk audit_logs
API endpoint and forwards each audit log to an HTTP Collector for a
wide variety of SIEM devices.

## Owners
Zendesk Security Development and Zendesk Security.

## Getting started
To use this application **node.js** and **npm** is needed.

Install dependencies with **npm install**.
Once config/config.json is prepared along with env variables start the app by
running **npm start**.

Configurations need to be stored in the config/config.json file or environment
variables.  If using environment variables the config file may be excluded, but
all required config values must be present.  Where a config file exists and
environment variable exists, the environment variable wins.  For example
config.username = foo ENV["LOG_FORWARDER_USERNAME"] = bar username will be bar.

If you wish to utilize Docker to run this app.  From the root directory run
'docker build -t "your_tag"', after the image is built, you can create an 
environment file and start the docker image by running 
'docker run --env-file "path to env file" "your_tag"'.

### Configuration Options:
* **username** or environment variable **LOG_FORWARDER_USERNAME** **required** 
is the Zendesk account username that the token belongs to
* **token** or environment variable **LOG_FORWARDER_TOKEN** **required** is the 
Zendesk token associated with the username above
* **hostname** or environment variable **LOG_FORWARDER_HOSTNAME** **required** 
is the Zendesk base hostname for example https://<your_subdomain>.zendesk.com
* **maxAttempts** or environment variable **LOG_FORWARDER_MAX_ATTEMPTS**
is the amount of retries allowed to the Zendesk API, defaults to 5.
* **retryDelay** or environment variable **LOG_FORWARDER_RETRY_DELAY** is the
time period in milliseconds between retrying to pull data from the Zendesk API,
defaults to 500 milliseconds.
* **siem** or environment variable **LOG_FORWARDER_SIEM**  **required** is the 
type of SIEM you are using in all lowercase.  Valid values is "splunk", 
"sumologic" and "http".  HTTP will work for any endpoint that accepts a post 
request with no authentication or headers.
* **siemUrl** or environment variable **LOG_FORWARDER_SIEM_URL** **required** 
is your SIEM HTTP collector URL consult your SIEM documentation for setting up 
and getting the URL.
  * Splunk requires only the URL string with no path, example
  "https://foo.splunk.com:8088/"
  * Sumologic requires the url minus the random string value, example
  "https://foo.sumologic.com/receiver/v1/http/"
  * HTTP requires the full URL, example "https://foo.com/event_handler"
* **siemToken** or environment variable **LOG_FORWARDER_SIEM_TOKEN** is your
SIEM HTTP collector token or random value.
  * Splunk **required** provided in the Splunk UI
  * Sumologic extract the random string after v1/http in the Sumologic url,
  example "https://foo.sumologic.com/receiver/v1/http/108aLLJ234Cv==" your
  token is "108aLLJ234Cv==" (Alternatively you could enter the long URL string
  as your **siem_url** and leave out the **siem_token** parameter)
  * HTTP requires no token
* **siemBatchSize** or environment variable **LOG_FORWARDER_SIEM_BATCH_SIZE**
is the amount of logs to be sent to the SIEM in 1 request, defaults to 100.
* **siemBatchInterval** or environment variable
**LOG_FORWARDER_SIEM_BATCH_INTERVAL** is the time period in milliseconds
between batch sending to the SIEM, defaults to 1000 milliseconds.
* **siemDefaultLevel** or environment variable
**LOG_FORWARDER_SIEM_DEFAULT_LEVEL** is the default SIEM log level, defaults
to 'INFO'.
* **tickets** or environment variable **LOG_FORWARDER_TICKETS** is a boolean
value that turns on forwarding Ticket Audit logs, this can be noisy and it's
recommended to turn sanitization filters on to reduce the data size of each
audit event.
* **sanitized_events** or environment variable **LOG_FORWARDER_SANITIZED_EVENTS**
is an optional config value that defaults to "All".  If no sanitization is
desired use "None".  Sensitive information including any sumbmitted information
such as credit card numbers could enter your SIEM without sanitization.  If
using environment variable this needs to be in a comma separated string, if
used in the config.json file it needs to match the JSON notation specifications
or can be a comma separated string.
* **allowed_events** or environment variable **LOG_FORWARDER_ALLOWED_EVENTS**
is an optional config value that defaults to "All".  If no ticket events is
desired use "None", however no context about actions performed for the ticket
will be provided.  If using environment variable this needs to be in a comma
separated string, if used in the config.json file it needs to match the JSON
notation specifications or can be a comma separated string.
* **audit_offset** or environment variable **LOG_FORWARDER_AUDIT_OFFSET** is an
optional config value that defaults to 15.  This is the second at which the app
pulls audit logs from the API each minute.  Use 60 for to poll at 0 second of
each minute.
* **ticket_offset** or environment variable **LOG_FORWARDER_TICKET_OFFSET** is
an optional config value that defaults to 45.  This is the second at which the
app pulls ticket audit logs from the API each minute.  Use 60 for to poll at 0
second of each minute.
* **audit_interval** or environment variable **LOG_FORWARDER_AUDIT_INTERVAL**
is an optional config value that defaults to 0.  This should be in milliseconds
for time between polling of the audit_logs API endpoint.  1000 milliseconds is
the minimal time interval for polling.  If < 1000 is provided, it will be
multiplied by 1000.
* **ticket_interval** or environment variable **LOG_FORWARDER_TICKET_INTERVAL**
is an optional config value that defaults to 0.  This should be in milliseconds
for time between polling of the ticket_audits API endpoint.  1000 milliseconds
is the minimal time interval for polling.  If < 1000 is provided, it will be
multiplied by 1000.

### Development config options
* **debug** triggers pulling all logs immediately from the API endpoints.
* **strictSSL** required if using a non-publicly trusted SSL certificate for
instance a https://localhost:8088/ for splunk.  Defaults to true

### Event values
* **None** - Sanitize / submit no events
* **All** - Sanitize / submit all events
* Sanitize / Submit particular event type see
https://developer.zendesk.com/rest_api/docs/core/ticket_audits for
details on events
  * Create
  * Change
  * CommentRedactionEvent
  * AttachmentRedactionEvent
  * VoiceComment
  * CommentPrivacyChange
  * Notification
  * Cc
  * SatisfactionRating
  * TicketSharingEvent
  * OrganizationActivity
  * Error
  * Tweet
  * FacebookEvent
  * FacebookComment
  * External
  * LogMeInTranscript
  * Push

## Testing
Utilizes mocha, chai and sinon.  Tests should be written in BDD syntax with the
chai should libraries.  Code should pass eslint tests as well.  

Execute tests using **npm test**.

## Contribute
Improvements are always welcome. Please follow these steps to contribute

1. Submit a Pull Request with a detailed explanation of changes
1. Receive a :+1: from a core team member
1. Core team will merge your changes

## Dependencies
Node.js version 6.3
NPM package manager

### License
Use of this software is subject to important terms and conditions as
set forth in the [LICENSE](LICENSE) file
