
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
});
