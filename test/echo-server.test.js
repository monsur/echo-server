
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
});
