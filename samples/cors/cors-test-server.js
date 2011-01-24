var fs = require('fs');

// Retrieve the port from the --port command line parameter.
// If --port is not specified, return the default port.
// This is copied from echo-server.js, it should eventually be consolidated.
function getPort() {
  var argv = process.argv;
  for (var i = 0; i < argv.length; i++) {
    if (argv[i] == '--port') {
      return parseInt(argv[i+1]);
    }
  }
  return 8125;
}

var port = getPort();
var filename = 'default.htm';

var contents = null;
function loadFileContents() {
  contents = fs.readFileSync(filename);
}
loadFileContents();
fs.watchFile(filename, {interval: 1000}, loadFileContents);

var jqueryFilename = 'jquery-1.4.4.min.js';
var jquery = fs.readFileSync(jqueryFilename);

require('http').createServer(function (request, response) {
  if (request.url.indexOf(jqueryFilename) > 0) {
  response.writeHead(200, {'Content-Type': 'text/javascript'});
  response.end(jquery);
  } else {
    response.writeHead(200, {'Content-Type': 'text/html'});
    response.end(contents);
  }
}).listen(port);

console.log('Server running at http://127.0.0.1:' + port + '/');
