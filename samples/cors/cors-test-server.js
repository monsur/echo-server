const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const chokidar = require('chokidar');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
    .option('port', {
        alias: 'p',
        type: 'number',
        default: 8125,
        description: 'Port to run the server on',
    })
    .argv;

const app = express();
const port = argv.port;

const filename = path.join(__dirname, 'default.htm');
const jqueryFilename = path.join(__dirname, 'jquery-3.7.1.min.js');

let contents = null;
let jquery = null;

async function loadFileContents() {
    try {
        contents = await fs.readFile(filename, 'utf-8');
        jquery = await fs.readFile(jqueryFilename, 'utf-8');
    } catch (error) {
        console.error('Error loading files:', error);
        process.exit(1);
    }
}

const watcher = chokidar.watch([filename, jqueryFilename]);

watcher.on('change', (filePath) => {
    console.log(`File ${filePath} has been changed. Reloading...`);
    loadFileContents();
});

app.get('/', (req, res) => {
    res.type('html').send(contents);
});

app.get('/jquery-3.7.1.min.js', (req, res) => {
    res.type('javascript').send(jquery);
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

(async () => {
    await loadFileContents();
    app.listen(port, () => {
        console.log(`CORS test server running at http://127.0.0.1:${port}/`);
    });
})();