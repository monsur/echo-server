// TODO: Save requests in a history object, keyed off an "id" parameter passed
//       in the query string. Query parameter "reset=true" resets the cache.
// TODO: Change "condition" parameter to accept an object of regex strings.
// TODO: Allow arbritraries paths, allow path to be part of condition.

const express = require('express');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const url = require('url');

const HTTP_STATUS_MESSAGES = {
    100: 'Continue',
    101: 'Switching Protocols',
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    203: 'Non-Authoritative Information',
    204: 'No Content',
    205: 'Reset Content',
    206: 'Partial Content',
    300: 'Multiple Choices',
    301: 'Moved Permanently',
    302: 'Found',
    303: 'See Other',
    304: 'Not Modified',
    305: 'Use Proxy',
    307: 'Temporary Redirect',
    400: 'Bad Request',
    401: 'Unauthorized',
    402: 'Payment Required',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    406: 'Not Acceptable',
    407: 'Proxy Authentication Required',
    408: 'Request Timeout',
    409: 'Conflict',
    410: 'Gone',
    411: 'Length Required',
    412: 'Precondition Failed',
    413: 'Request Entity Too Large',
    414: 'Request-URI Too Long',
    415: 'Unsupported Media Type',
    416: 'Requested Range Not Satisfiable',
    417: 'Expectation Failed',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
    505: 'HTTP Version Not Supported',
};

const argv = yargs(hideBin(process.argv))
    .option('port', {
        alias: 'p',
        type: 'number',
        default: 8124,
        description: 'Port to run the server on',
    })
    .argv;

const app = express();

function getOptions(req) {
    const u = url.parse(req.url);
    const qs = new URLSearchParams(u.query);
    let options = {};

    if (qs.has('json')) {
        const jsonString = qs.get('json');

        // Security: Validate JSON string size to prevent DoS
        const MAX_JSON_SIZE = 10000; // 10KB limit
        if (jsonString.length > MAX_JSON_SIZE) {
            throw new Error('JSON parameter exceeds maximum allowed size');
        }

        try {
            options = JSON.parse(jsonString);

            // Security: Prevent prototype pollution by checking for dangerous keys
            const hasDangerousKeys = (obj) => {
                if (!obj || typeof obj !== 'object') return false;
                const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
                for (const key of Object.keys(obj)) {
                    if (dangerousKeys.includes(key)) {
                        return true;
                    }
                    if (typeof obj[key] === 'object' && obj[key] !== null) {
                        if (hasDangerousKeys(obj[key])) {
                            return true;
                        }
                    }
                }
                return false;
            };

            if (hasDangerousKeys(options)) {
                throw new Error('Invalid JSON: prototype pollution attempt detected');
            }

            // Security: Validate JSON depth to prevent DoS via deeply nested objects
            const validateDepth = (obj, depth = 0, maxDepth = 10) => {
                if (depth > maxDepth) {
                    throw new Error('JSON nesting depth exceeds maximum allowed');
                }
                if (obj && typeof obj === 'object') {
                    for (const key in obj) {
                        if (obj.hasOwnProperty(key)) {
                            validateDepth(obj[key], depth + 1, maxDepth);
                        }
                    }
                }
            };
            validateDepth(options);

        } catch (error) {
            throw new Error(`Invalid JSON parameter: ${error.message}`);
        }
    }

    const getStatus = (u) => {
        const status = parseInt(u.pathname.substring(1), 10);
        return isNaN(status) ? 200 : status;
    };

    // A safer way to handle conditions
    const getCondition = (condition) => {
        return (r) => {
            if (!condition) return true;
            // Simple key-value check. For more complex conditions, a more robust solution is needed.
            for (const key in condition) {
                if (r.headers[key.toLowerCase()] !== condition[key]) {
                    return false;
                }
            }
            return true;
        };
    };

    if (Array.isArray(options)) {
        return options.map(opt => ({
            ...opt,
            condition: getCondition(opt.condition),
            statusCode: opt.statusCode || getStatus(u),
        }));
    }

    // Security: Validate header names to prevent header injection
    const isValidHeaderName = (name) => {
        // RFC 7230: header field names must be tokens (alphanumeric, -, and some special chars)
        // Prevent newlines, colons in names, and other control characters
        const headerNameRegex = /^[a-zA-Z0-9!#$%&'*+\-.^_`|~]+$/;
        return headerNameRegex.test(name) && !name.includes('\r') && !name.includes('\n');
    };

    const isValidHeaderValue = (value) => {
        // Prevent header injection via CRLF characters
        return typeof value === 'string' && !value.includes('\r') && !value.includes('\n');
    };

    // Whitelist of allowed root-level option keys
    const ALLOWED_ROOT_KEYS = ['headers', 'statusCode', 'reasonPhrase', 'body', 'condition'];

    for (const [name, value] of qs.entries()) {
        if (name === 'json') continue;

        const keys = name.split('.');

        // Security: Only allow whitelisted root keys
        if (!ALLOWED_ROOT_KEYS.includes(keys[0])) {
            throw new Error(`Invalid option key: ${keys[0]}`);
        }

        // Security: Validate header names and values
        if (keys[0] === 'headers') {
            if (keys.length !== 2) {
                throw new Error('Invalid header specification');
            }
            const headerName = keys[1];
            if (!isValidHeaderName(headerName)) {
                throw new Error(`Invalid header name: ${headerName}`);
            }
            if (!isValidHeaderValue(value)) {
                throw new Error(`Invalid header value for ${headerName}`);
            }
        }

        let current = options;
        keys.forEach((key, index) => {
            if (index === keys.length - 1) {
                current[key] = value;
            } else {
                current[key] = current[key] || {};
                current = current[key];
            }
        });
    }

    options.statusCode = getStatus(u);
    options.condition = getCondition(options.condition);

    return [options];
}

function getDefaultOptions() {
    return { statusCode: 200 };
}

function getHeadersAsString(headers) {
    let result = '';
    for (const name in headers) {
        result += `${name}: ${headers[name]}\r\n`;
    }
    return result;
}

function getBody(req, options) {
    const separator = '====================';
    let body = `${separator}\r\nREQUEST\r\n\r\n`;
    body += `${req.method} ${req.url}\r\n`;
    body += getHeadersAsString(req.headers);

    // TODO: add request body

    body += `\r\n\r\n${separator}\r\nRESPONSE\r\n\r\n`;
    body += options.statusCode;
    if (options.reasonPhrase) {
        body += ` ${options.reasonPhrase}`;
    }
    body += '\r\n';
    body += getHeadersAsString(options.headers);

    if (options.headers && options.headers['Content-Type'] === 'text/html') {
        return `<html><head><title>HTTP Response ${options.statusCode}</title></head><body><pre>${body}</pre></body></html>`;
    }

    return body;
}

function createResponse(req, options) {
    options.reasonPhrase = options.reasonPhrase || HTTP_STATUS_MESSAGES[options.statusCode];
    options.headers = options.headers || {};
    options.headers['Content-Type'] = options.headers['Content-Type'] || 'text/plain';
    options.headers['Cache-Control'] = options.headers['Cache-Control'] || 'no-cache';
    options.body = options.body || getBody(req, options);
    options.headers['Content-Length'] = Buffer.byteLength(options.body);
    return options;
}

app.all('*', (req, res) => {
    try {
        const options = getOptions(req);
        let match = null;
        for (const option of options) {
            if (option.condition(req)) {
                match = option;
                break;
            }
        }

        if (!match) {
            match = getDefaultOptions();
        }

        const responseOptions = createResponse(req, match);
        res.writeHead(responseOptions.statusCode, responseOptions.reasonPhrase, responseOptions.headers);
        console.log(responseOptions.body);
        res.end(responseOptions.body);
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Start the server only if this file is run directly
if (require.main === module) {
    const port = argv.port;
    app.listen(port, () => {
        console.log(`Server running at http://127.0.0.1:${port}/`);
    });
}

module.exports = app;