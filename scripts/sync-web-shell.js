'use strict';
// Keep the optional browser workspace separate from the product website.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'widget/index.html'), 'utf8');
const web = source.replace('href="styles.css"', 'href="/widget/styles.css"').replaceAll('src="icon.png"', 'src="/widget/icon.png"').replace('href="icon.png"', 'href="/widget/icon.png"').replace('src="ui-state.js"', 'src="/widget/ui-state.js"').replace('src="app.js"', 'src="/widget/app.js"').replace('</head>', '  <link rel="manifest" href="/manifest.webmanifest">\n</head>');
fs.mkdirSync(path.join(root, 'public/app'), { recursive:true });
fs.writeFileSync(path.join(root, 'public/app/index.html'), web);
