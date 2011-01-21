Node.js Echo Server
===================

This HTTP server echos the request and response details, and allows you to craft custom HTTP responses based on request parameters.

Getting Started
---------------

Requirements: Node http://nodejs.org (version 2.6 or greater)

To run the server:

  node echo-server.js

Usage
-----

Trigger an HTTP 200 response:
http://localhost:8124/200

Trigger an HTTP 404 response:
http://localhost:8124/404

Trigger an HTTP 404 response with a custom message:
http://localhost:8124/404?reasonPhrase=Oh%20No%21

Trigger an HTTP 200 response with a custom header:
http://localhost:8124/200?headers.CustomHeader=foo

There are a lot more options and things you can do, including sending parameters as a serialized JSON object, sending an array of responses, and using conditionals to choose the appropriate response.  I'll write up more soon, in the meantime, check the source.
