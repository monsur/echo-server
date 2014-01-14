// TODO: Save requests in a history object, keyed off an "id" parameter passed
//       in the query string. Query parameter "reset=true" resets the cache.
// TODO: Change "condition" parameter to accept an object of regex strings.
// TODO: Better error handling so server doesn't die.
// TODO: Allow arbritraries paths, allow path to be part of condition.

// From http://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html
var HTTP_STATUS_MESSAGES = {
  100: "Continue",
  101: "Switching Protocols",
  200: "OK",
  201: "Created",
  202: "Accepted",
  203: "Non-Authoritative Information",
  204: "No Content",
  205: "Reset Content",
  206: "Partial Content",
  300: "Multiple Choices",
  301: "Moved Permanently",
  302: "Found",
  303: "See Other",
  304: "Not Modified",
  305: "Use Proxy",
  307: "Temporary Redirect",
  400: "Bad Request",
  401: "Unauthorized",
  402: "Payment Required",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  406: "Not Acceptable",
  407: "Proxy Authentication Required",
  408: "Request Timeout",
  409: "Conflict",
  410: "Gone",
  411: "Length Required",
  412: "Precondition Failed",
  413: "Request Entity Too Large",
  414: "Request-URI Too Long",
  415: "Unsupported Media Type",
  416: "Requested Range Not Satisfiable",
  417: "Expectation Failed",
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
  505: "HTTP Version Not Supported"
};

var querystring = require('querystring');
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

  // This is dangerous, but hey, this server should only be used for testing.
  function getCondition(condition) {
    condition = condition || true;
    return new Function('r', 'return ' + condition + ';');
  }

  var u = require('url').parse(request.url);
  var qs = require('querystring').parse(u.query);
  var options = {};

  // Load any options in a serialized json object.
  if (qs.json) {
    options = JSON.parse(qs.json);
  }

  // If this is an array, all details must be in the array.
  if (typeOf(options) == 'array') {
    for (var i = 0; i < options.length; i++) {
      // Set certain defaults on each object.
      options[i].condition = getCondition(options[i].condition);
      options[i].statusCode = options[i].statusCode || getStatus(u);
    }
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

  options.condition = getCondition(options.condition);

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
    var queryData = "";
function getBody(request, response, options) {
  var separator = '====================';
  var body = separator + '\r\nREQUEST\r\n\r\n';
  body += request.method + ' ' + request.url + '\r\n';
  body += getHeadersAsString(request.headers);

  body += '\r\n\r\n' + separator + '\r\nREQUEST BODY\r\n\r\n';
  body += queryData;
  queryData = "";
  // TODO: add request body

  body += '\r\n\r\n' + separator + '\r\nRESPONSE\r\n\r\n'
  body += options.statusCode;
  if (options.reasonPhrase) {
    body += ' ' + options.reasonPhrase;
  }
  body += '\r\n';
  body += getHeadersAsString(options.headers);

  if (options.headers && options.headers['Content-Type'] == 'text/html') {
    body = '<html><head><title>HTTP Response ' + options.statusCode +
        '</title></head><body><pre>' + body + '</pre></body></html>';
  }

  return body;
}

function processPost(request, response, callback) {
    if(typeof callback !== 'function') return null;

    if(request.method == 'POST') {
        request.on('data', function(data) {
            queryData += data;
            if(queryData.length > 1e6) {
                queryData = "";
                response.writeHead(413, {'Content-Type': 'text/plain'}).end();
                request.connection.destroy();
            }
        });
        request.on('end', function() {
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
          response.post = querystring.parse(queryData);
          createResponse(request, response, match);
		  response.writeHead(match.statusCode, match.reasonPhrase, match.headers);
		  console.log(match.body);
		  response.end(match.body)
            callback();
        });

    } else {
        response.writeHead(405, {'Content-Type': 'text/plain'});
        response.end();
    }
}

function createResponse(request, response, options) {
  options.reasonPhrase = options.reasonPhrase || HTTP_STATUS_MESSAGES[options.statusCode];
  options.headers = options.headers || {};
  options.headers['Content-Type'] = options.headers['Content-Type'] || 'text/plain';
  options.headers['Cache-Control'] = options.headers['Cache-Control'] || 'no-cache';
  options.body = options.body || getBody(request, response, options);
  options.headers['Content-Length'] = options.body.length;
}

var port = getPort();

require('http').createServer(function (request, response) {
 if(request.method == 'POST') {
        processPost(request, response, function() {
            response.writeHead(200, "OK", {'Content-Type': 'text/plain'});
            response.end();
        });
    } else {
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
  response.writeHead(match.statusCode, match.reasonPhrase, match.headers);
  console.log(match.body);
  response.end(match.body);
}
}).listen(port);

console.log('Server running at http://127.0.0.1:' + port + '/');