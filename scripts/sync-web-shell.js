'use strict';
// The browser uses the exact desktop widget markup and scripts.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'widget/index.html'), 'utf8');
const web = source.replace('href="styles.css"', 'href="/widget/styles.css"').replaceAll('src="icon.png"', 'src="/widget/icon.png"').replace('href="icon.png"', 'href="/widget/icon.png"').replace('src="ui-state.js"', 'src="/widget/ui-state.js"').replace('src="app.js"', 'src="/widget/app.js"').replace('</head>', '  <link rel="manifest" href="/manifest.webmanifest">\n</head>');
fs.writeFileSync(path.join(root, 'public/index.html'), web);
