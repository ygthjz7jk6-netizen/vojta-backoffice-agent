const ai = require('ai');
console.log('exports:', Object.keys(ai).filter(k => k.includes('convert') || k.includes('Message')));
