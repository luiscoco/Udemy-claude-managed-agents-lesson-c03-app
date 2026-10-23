const $ = selector => document.querySelector(selector);
const button = $('#run'), status = $('#status');
fetch('/api/config').then(r => r.json()).then(c => { button.disabled = !c.configured; status.textContent = c.configured ? 'Configuration ready. Your API key stays on the server.' : 'Configure your API key and resource IDs in .env.'; }).catch(() => { button.disabled = true; status.textContent = 'Could not check configuration.'; });
button.addEventListener('click', async () => {
  const prompt = $('#prompt').value.trim(); if (!prompt) { status.textContent = 'Enter a prompt.'; return; }
  button.disabled = true; status.textContent = 'Creating session…'; $('#events').replaceChildren(); $('#history').textContent = 'Waiting for the session to finish.'; $('#answer').hidden = true; $('#answer').textContent = ''; $('#stored').textContent = 'Loading…';
  let sawStop = false, failed = false;
  const handle = ({ type, value }) => {
    if (type === 'session') { $('#empty').hidden = true; $('#result').hidden = false; $('#session').textContent = value.id; $('#agent').textContent = `${value.agentId} · version ${value.version}`; $('#effective').textContent = `Tools ${value.tools} · MCP ${value.mcp} · Skills ${value.skills}`; status.textContent = 'Listening for live events…'; }
    if (type === 'stored') $('#stored').textContent = `Tools ${value.tools} · MCP ${value.mcp} · Skills ${value.skills} · version ${value.version}`;
    if (type === 'event') { const li = document.createElement('li'); li.textContent = `${value.type} · ${value.id}`; $('#events').append(li); }
    if (type === 'answer') { $('#answer').hidden = false; $('#answer').textContent += value; }
    if (type === 'history') { $('#history').textContent = `${value.length} events recorded: ${value.map(e => e.type).join(', ')}`; }
    if (type === 'stop') { sawStop = true; status.textContent = `Session stopped: ${value}.`; }
    if (type === 'error') { failed = true; status.textContent = value; }
  };
  try {
    const response = await fetch('/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
    if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Request failed'); }
    const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '';
    while (true) { const { done, value } = await reader.read(); buffer += decoder.decode(value || new Uint8Array(), { stream: !done }); const lines = buffer.split('\n'); buffer = lines.pop(); for (const line of lines) if (line) handle(JSON.parse(line)); if (done) break; }
    if (buffer.trim()) handle(JSON.parse(buffer));
    if (!sawStop && !failed) status.textContent = 'Stream ended before a stop event; inspect the recorded session.';
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
});
