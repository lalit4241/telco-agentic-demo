// Inline CSS + JS into a single offline file: dist/index.html
const fs = require('fs'), path = require('path');
const src = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const js = ['sha256.js', 'data.js', 'engine.js', 'ui.js'].map(src).join('\n;\n').replace(/<\/script/gi, '<\\/script');
const html = src('index.template.html').replace('/*CSS*/', () => src('styles.css')).replace('/*JS*/', () => js);
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), html);
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('dist/index.html + index.html', (html.length / 1024).toFixed(1) + ' KB');
