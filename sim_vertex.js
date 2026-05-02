const { buildSystemPrompt } = require('./lib/agent/prompt');
const { getTools } = require('./lib/tools/index');
const tools = getTools('fake-token');

for (const key of Object.keys(tools)) {
  const t = tools[key];
  console.log(key, JSON.stringify(t.parameters || {}, null, 2));
}
