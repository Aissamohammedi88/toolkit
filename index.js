<link rel="stylesheet" href="nexus-theme.css">
const express = require('express');
const app = express();
const PORT = 9010;

app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'NEXUS NODE.JS APP',
        timestamp: new Date().toISOString()
    });
});

app.get('/hello', (req, res) => {
    res.json({ message: 'Hello World depuis Node.js' });
});

app.listen(PORT, () => {
    console.log(`Nexus Node App sur http://localhost:${PORT}`);
});
