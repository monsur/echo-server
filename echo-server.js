var http = require('http');
var querystring = require('querystring');
var url = require('url');

// Retrieve the port from the --port command line parameter.
// If --port is not specified, return the default port.
function getPort() {
  var argv = process.argv;
  for (var i = 0; i < argv.length; i++) {
    if (argv[i] == '--port') {
      return parseInt(argv[i+1]);
    }
  }
  return 8124;
}

// From http://javascript.crockford.com/remedial.html
function typeOf(value) {
  var s = typeof value;
  if (s === 'object') {
    if (value) {
      if (value instanceof Array) {
        s = 'array';
      }
    } else {
      s = 'null';
    }
  }
  return s;
}

// Parse the response options from the request.
function getOptions(request) {

  // Helper function to see if a string starts with a given string.
  var startsWith = function(source, str) {
    return (source.match("^"+str) == str);
  };

  // Retrieves the HTTP status code from the request path.
  var getStatus = function(u) {
    var status = parseInt(u.pathname.substring(1));
    if (isNaN(status)) {
      status = 200;
    }
    return status;
  };

  var u = url.parse(request.url);
  var qs = querystring.parse(u.query);
  var options = {};

  // Load any options in a serialized json object.
  if (qs.json) {
    options = JSON.parse(qs.json);
  }

  // If this is an array, all details must be in the array.
  if (typeOf(options) == 'array') {
    return options;
  }

  // Load any options that are in the query string
  for (var name in qs) {
    if (!qs.hasOwnProperty(name) || name == 'json') {
      continue;
    }
    var headerValue = qs[name];
    var splitName = name.split('.');
    var part = options;
    for (var i = 0; i < splitName.length; i++) {
      var partName = splitName[i];
      if (i == splitName.length - 1) {
        // We're at the last element, set the value.
        part[partName] = headerValue;
      } else {
        if (!part[partName]) {
          part[partName] = {};
        }
        part = part[partName];
      }
    }
  }

  // Add the status code to the response.
  options.statusCode = getStatus(u);

  var condition = options.condition || 'true';
  options.condition = new Function('r', 'return ' + condition + ';');

  return [options];
}

function getDefaultOptions() {
  return {'statusCode': 200};
}

function getHeadersAsString(headers) {
  var body = '';
  if (headers) {
    for (var name in headers) {
      if (!headers.hasOwnProperty(name)) {
        continue;
      }
      var val = headers[name];
      body += name + ': ' + val + '\r\n';
    }
  }
  return body;
}

function getBody(request, response, options) {
  var separator = '====================';
  var body = separator + '\r\nREQUEST\r\n\r\n';
  body += request.method + ' ' + request.url + '\r\n';
  body += getHeadersAsString(request.headers);

  // TODO: add request body

  body += '\r\n\r\n' + separator + '\r\nRESPONSE\r\n\r\n'
  body += options.statusCode;
  if (options.reasonPhrase) {
    body += ' ' + options.reasonPhrase + '\r\n';
  }
  body += '\r\n';
  body += getHeadersAsString(options.headers);

  if (options.headers && options.headers['Content-Type'] == 'text/html') {
    body = '<html><head><title>HTTP Response ' + options.statusCode +
        '</title></head><body><pre>' + body + '</pre></body></html>';
  }

  return body;
}

function createResponse(request, response, options) {
  options.headers = options.headers || {};
  options.headers['Content-Type'] = options.headers['Content-Type'] || 'text/plain';
  options.headers['Cache-Control'] = options.headers['Cache-Control'] || 'no-cache';
  options.body = options.body || getBody(request, response, options);
  options.headers['Content-Length'] = options.body.length;
}

var port = getPort();

http.createServer(function (request, response) {
  var options = getOptions(request);
  var match = null;
  for (var i = 0; i < options.length; i++) {
    var option = options[i];
    var result = option.condition.call(null, request);
    if (result) {
      match = option;
      break;
    }
  }
  if (!match) {
    match = getDefaultOptions();
  }
  createResponse(request, response, match);
  if (match.reasonPhrase) {
    response.writeHead(match.statusCode, match.reasonPhrase, match.headers);
  } else {
    response.writeHead(match.statusCode, match.headers);
  }
  console.log(match.body);
  response.end(match.body);
}).listen(port);

console.log('Server running at http://127.0.0.1:' + port + '/');
