import express from 'express';
import bodyParser from 'body-parser';
import { EventEmitter } from 'events';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Import your new ESM routers
// Make sure your files are named qr.mjs and pair.mjs
import server from './qr.js';
import code from './pair.js';

const app = express();

// 2. Define __path using process.cwd()
// process.cwd() works fine in ESM and gets the root directory
// where you start your server.
const __path = process.cwd();

const PORT = process.env.PORT || 3000;

// 3. Set max listeners on the imported EventEmitter
EventEmitter.defaultMaxListeners = 500;

// Use your routers
app.use('/server', server);
app.use('/code', code);

// Serve static HTML files
// Switched to path.join() which is safer for all OS
app.use('/pair', async (req, res, next) => {
    res.sendFile(path.join(__path, 'pair.html'));
});

app.use('/qr', async (req, res, next) => {
    res.sendFile(path.join(__path, 'qr.html'));
});

app.use('/', async (req, res, next) => {
    res.sendFile(path.join(__path, 'main.html'));
});

// Body parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Start the server
app.listen(PORT, () => {
    console.log(`
Don't Forgot To Give Star MALVIN-XD

 Server running on http://localhost:` + PORT);
});

// 4. Export the app using 'export default'
export default app;
