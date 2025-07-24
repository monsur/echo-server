# Node.js Echo Server

This HTTP server echoes request and response details and allows you to craft custom HTTP responses based on request parameters.

This project was originally created in 2011. I revisited it in 2025 to modernize it using Gemini CLI. Gemini updated it to use Express.js, wrote unit tests, and even updated this README. Full chat history [here](https://docs.google.com/document/d/1MeCSzXR5MmUbBjG0wXhlj9y7V9zj7QgYHAjfLY35wCU/edit?usp=sharing).

## Requirements

*   [Node.js](http://nodejs.org) (v14 or greater recommended)
*   [npm](https://www.npmjs.com/)

## Getting Started

### Installation

1.  Clone the repository.
2.  Install the dependencies:
    ```bash
    npm install
    ```

### Running the Servers

The project includes two servers: the main `echo-server` and a `cors-test-server` for browser-based testing. It's recommended to run them in separate terminals.

**1. Start the Echo Server:**

```bash
npm start
```

By default, the echo server runs on port 8124. You can specify a different port with the `--port` option:

```bash
npm start -- --port 12345
```
*(Note the `--` is necessary to pass arguments through npm to the script.)*

**2. Start the CORS Test Server:**

This server hosts a simple HTML page (`samples/cors/default.htm`) that acts as a client to the main echo server, which is useful for testing CORS and other browser-based interactions.

```bash
node samples/cors/cors-test-server.js
```

By default, this server runs on port 8125. You can also use the `--port` option here:

```bash
node samples/cors/cors-test-server.js --port 54321
```

Once running, you can access the test client at `http://localhost:8125`.

### Running Tests

The project uses Mocha, Chai, and Supertest for unit testing. To run the test suite:

```bash
npm test
```

## Usage Examples

You can control the server's response by changing the URL and query parameters.

*   **Trigger an HTTP 200 (OK) response:**
    `http://localhost:8124/200`

*   **Trigger an HTTP 404 (Not Found) response:**
    `http://localhost:8124/404`

*   **Trigger a 404 response with a custom reason phrase:**
    `http://localhost:8124/404?reasonPhrase=Oh%20No%21`

*   **Trigger a 200 response with a custom header:**
    `http://localhost:8124/200?headers.X-Custom-Header=foo`

*   **Use a serialized JSON object for complex responses:**
    This allows for fine-grained, almost script-like control over the response.
    `http://localhost:8124/201?json={"statusCode":201,"headers":{"Content-Type":"application/json"},"body":"{\"message\":\"Created\"}"}`

## Advanced Usage: Conditional and Chained Responses

You can define a series of possible responses in a JSON array. The server will evaluate each response object in the array and return the *first one* that meets the specified `condition`.

The `condition` object allows you to check for the presence and value of specific request headers.

### Example

Let's define two possible responses:
1.  A `200 OK` response if the request has a header `X-Request-Type` with the value `Special`.
2.  A `418 I'm a teapot` response for all other requests.

Here is the JSON array for this logic:
```json
[
  {
    "statusCode": 200,
    "condition": {
      "X-Request-Type": "Special"
    },
    "body": "You sent a special request!"
  },
  {
    "statusCode": 418,
    "body": "I am a teapot."
  }
]
```

To send this to the server, you must URL-encode it and pass it in the `json` query parameter.

**1. Request with the special header:**
This request will match the first condition and receive the `200 OK` response.
```bash
# Using curl to add the custom header
curl -H "X-Request-Type: Special" "http://localhost:8124/200?json=%5B%7B%22statusCode%22%3A200%2C%22condition%22%3A%7B%22X-Request-Type%22%3A%22Special%22%7D%2C%22body%22%3A%22You%20sent%20a%20special%20request!%22%7D%2C%7B%22statusCode%22%3A418%2C%22body%22%3A%22I%20am%20a%20teapot.%22%7D%5D"
```

**2. A regular request:**
This request will *not* match the first condition, so the server will proceed to the second response object, which has no condition and acts as a default, returning the `418 I'm a teapot` response.
```bash
curl "http://localhost:8124/200?json=%5B%7B%22statusCode%22%3A200%2C%22condition%22%3A%7B%22X-Request-Type%22%3A%22Special%22%7D%2C%22body%22%3A%22You%20sent%20a%20special%20request!%22%7D%2C%7B%22statusCode%22%3A418%2C%22body%22%3A%22I%20am%20a%20teapot.%22%7D%5D"
```

## Background

Testing client-server communications can be a pain. You either need to embed logging in your code or fire up a tool like Wireshark to view the requests/responses. And if you are debugging a server, the start server -> make request -> check logs -> stop server -> edit code cycle can be tedious. This server helps with these situations by echoing your request/response headers and giving you fine-grained control over the response.

One example where this is useful is testing a CORS preflight request (which is an HTTP OPTIONS request followed by another HTTP request). Testing this on a regular server would be difficult, but echo-server's `json` parameter gives you powerful control over responses or a series of responses.
