
const request = require('supertest');
const { expect } = require('chai');
const app = require('../echo-server');

describe('Echo Server', () => {
    describe('GET /', () => {
        it('should respond with a 200 status code', (done) => {
            request(app)
                .get('/200')
                .expect(200, done);
        });

        it('should respond with a 404 status code', (done) => {
            request(app)
                .get('/404')
                .expect(404, done);
        });
    });

    describe('Response Body', () => {
        it('should contain the request method and URL', (done) => {
            request(app)
                .get('/200')
                .expect(200)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.text).to.include('GET /200');
                    done();
                });
        });
    });

    describe('Query String Options', () => {
        it('should set a custom header from a query parameter', (done) => {
            request(app)
                .get('/200?headers.X-Custom-Header=hello')
                .expect('X-Custom-Header', 'hello')
                .expect(200, done);
        });

        it('should set a custom reason phrase', (done) => {
            request(app)
                .get('/200?reasonPhrase=Custom-OK')
                .expect(200)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.res.statusMessage).to.equal('Custom-OK');
                    done();
                });
        });
    });

    describe('JSON Options', () => {
        it('should handle complex options from a JSON parameter', (done) => {
            const options = {
                statusCode: 201,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Foo': 'Bar'
                },
                body: JSON.stringify({ message: 'Created' })
            };
            const json = encodeURIComponent(JSON.stringify(options));

            request(app)
                .get(`/201?json=${json}`)
                .expect(201)
                .expect('Content-Type', /json/)
                .expect('X-Foo', 'Bar')
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.text).to.equal('{"message":"Created"}');
                    done();
                });
        });
    });

    describe('JSON Security Validations', () => {
        it('should reject JSON exceeding size limit', (done) => {
            // Create a JSON string larger than 10KB
            const largeObject = { data: 'x'.repeat(11000) };
            const json = encodeURIComponent(JSON.stringify(largeObject));

            request(app)
                .get(`/200?json=${json}`)
                .expect(500)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.text).to.equal('Internal Server Error');
                    done();
                });
        });

        it('should reject JSON with __proto__ key', (done) => {
            const maliciousJson = encodeURIComponent('{"__proto__":{"isAdmin":true}}');

            request(app)
                .get(`/200?json=${maliciousJson}`)
                .expect(500)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.text).to.equal('Internal Server Error');
                    done();
                });
        });

        it('should reject JSON with constructor key', (done) => {
            const maliciousJson = encodeURIComponent('{"constructor":{"prototype":{"isAdmin":true}}}');

            request(app)
                .get(`/200?json=${maliciousJson}`)
                .expect(500)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.text).to.equal('Internal Server Error');
                    done();
                });
        });

        it('should reject JSON with prototype key', (done) => {
            const maliciousJson = encodeURIComponent('{"prototype":{"isAdmin":true}}');

            request(app)
                .get(`/200?json=${maliciousJson}`)
                .expect(500)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.text).to.equal('Internal Server Error');
                    done();
                });
        });

        it('should reject deeply nested JSON (DoS prevention)', (done) => {
            // Create an object nested more than 10 levels deep
            let deepObject = { value: 'test' };
            for (let i = 0; i < 15; i++) {
                deepObject = { nested: deepObject };
            }
            const json = encodeURIComponent(JSON.stringify(deepObject));

            request(app)
                .get(`/200?json=${json}`)
                .expect(500)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.text).to.equal('Internal Server Error');
                    done();
                });
        });

        it('should reject malformed JSON', (done) => {
            const invalidJson = encodeURIComponent('{invalid json}');

            request(app)
                .get(`/200?json=${invalidJson}`)
                .expect(500)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.text).to.equal('Internal Server Error');
                    done();
                });
        });

        it('should accept JSON at exactly the depth limit', (done) => {
            // Create an object nested exactly 10 levels deep
            let deepObject = { value: 'test' };
            for (let i = 0; i < 9; i++) {
                deepObject = { nested: deepObject };
            }
            const json = encodeURIComponent(JSON.stringify(deepObject));

            request(app)
                .get(`/200?json=${json}`)
                .expect(200, done);
        });

        it('should accept JSON at exactly the size limit', (done) => {
            // Create a JSON string just under 10KB
            const largeObject = { data: 'x'.repeat(9900) };
            const json = encodeURIComponent(JSON.stringify(largeObject));

            request(app)
                .get(`/200?json=${json}`)
                .expect(200, done);
        });
    });

    describe('Header Injection Security', () => {
        it('should reject header names with CRLF characters', (done) => {
            const maliciousHeader = encodeURIComponent('X-Test\r\nX-Injected: malicious');

            request(app)
                .get(`/200?headers.${maliciousHeader}=value`)
                .expect(500)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.text).to.equal('Internal Server Error');
                    done();
                });
        });

        it('should reject header values with CRLF characters', (done) => {
            const maliciousValue = encodeURIComponent('value\r\nX-Injected: malicious');

            request(app)
                .get(`/200?headers.X-Custom=${maliciousValue}`)
                .expect(500)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.text).to.equal('Internal Server Error');
                    done();
                });
        });

        it('should reject invalid header names', (done) => {
            const invalidHeader = encodeURIComponent('X-Test<script>');

            request(app)
                .get(`/200?headers.${invalidHeader}=value`)
                .expect(500)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.text).to.equal('Internal Server Error');
                    done();
                });
        });

        it('should reject non-whitelisted root keys', (done) => {
            request(app)
                .get('/200?malicious.key=value')
                .expect(500)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.text).to.equal('Internal Server Error');
                    done();
                });
        });

        it('should accept valid header names with allowed special characters', (done) => {
            request(app)
                .get('/200?headers.X-Custom-Header-123=ValidValue')
                .expect(200)
                .expect('X-Custom-Header-123', 'ValidValue')
                .end(done);
        });

        it('should reject deeply nested header parameters', (done) => {
            request(app)
                .get('/200?headers.X-Custom.nested=value')
                .expect(500)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.text).to.equal('Internal Server Error');
                    done();
                });
        });

        it('should accept whitelisted root keys', (done) => {
            request(app)
                .get('/200?body=CustomBody&reasonPhrase=CustomPhrase')
                .expect(200)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.text).to.include('CustomBody');
                    expect(res.res.statusMessage).to.equal('CustomPhrase');
                    done();
                });
        });
    });

    describe('Input Validation', () => {
        it('should reject status codes below 100', (done) => {
            request(app)
                .get('/99')
                .expect(500)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.text).to.equal('Internal Server Error');
                    done();
                });
        });

        it('should reject status codes above 599', (done) => {
            request(app)
                .get('/600')
                .expect(500)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.text).to.equal('Internal Server Error');
                    done();
                });
        });

        it('should accept valid status codes at lower boundary', (done) => {
            // Use 101 instead of 100 since 100 Continue has special HTTP semantics
            request(app)
                .get('/101')
                .expect(101, done);
        });

        it('should accept valid status codes at upper boundary', (done) => {
            request(app)
                .get('/599')
                .expect(599, done);
        });

        it('should reject reasonPhrase with CRLF characters', (done) => {
            const maliciousPhrase = encodeURIComponent('OK\r\nX-Injected: malicious');

            request(app)
                .get(`/200?reasonPhrase=${maliciousPhrase}`)
                .expect(500)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.text).to.equal('Internal Server Error');
                    done();
                });
        });

        it('should reject reasonPhrase exceeding 100 characters', (done) => {
            const longPhrase = 'A'.repeat(101);

            request(app)
                .get(`/200?reasonPhrase=${longPhrase}`)
                .expect(500)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.text).to.equal('Internal Server Error');
                    done();
                });
        });

        it('should accept reasonPhrase at exactly 100 characters', (done) => {
            const exactPhrase = 'A'.repeat(100);

            request(app)
                .get(`/200?reasonPhrase=${exactPhrase}`)
                .expect(200, done);
        });

        it('should accept body within size limit', (done) => {
            const body = 'x'.repeat(1000);

            request(app)
                .get(`/200?body=${body}`)
                .expect(200)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.text).to.include(body);
                    done();
                });
        });

        it('should reject nested reasonPhrase parameters', (done) => {
            request(app)
                .get('/200?reasonPhrase.nested=value')
                .expect(500)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.text).to.equal('Internal Server Error');
                    done();
                });
        });

        it('should reject nested body parameters', (done) => {
            request(app)
                .get('/200?body.nested=value')
                .expect(500)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.text).to.equal('Internal Server Error');
                    done();
                });
        });

        it('should handle URLs with special characters', (done) => {
            // Test that modern URL API handles encoded characters properly
            request(app)
                .get('/200?reasonPhrase=Hello%20World')
                .expect(200)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.res.statusMessage).to.equal('Hello World');
                    done();
                });
        });

        it('should handle URLs with multiple query parameters', (done) => {
            request(app)
                .get('/200?reasonPhrase=OK&headers.X-Test=value')
                .expect(200)
                .expect('X-Test', 'value')
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.res.statusMessage).to.equal('OK');
                    done();
                });
        });
    });
});
