// The single page served by the setup form (tools/setup-form.mjs): provider
// fields and the HTML. No external assets; saved secrets never reach the page —
// it only learns which keys are already set.

export const FIELDS = {
  isracard: [
    { key: 'ISRACARD_ID', label: 'Teudat zehut (ID)', hint: '9 digits, as on your ID card', type: 'text' },
    {
      key: 'ISRACARD_CARD6DIGITS',
      label: 'Last 6 digits of the card',
      hint: 'from the front of the card',
      type: 'text',
    },
    { key: 'ISRACARD_PASSWORD', label: 'Personal-area password', hint: '', type: 'password' },
  ],
  hapoalim: [
    { key: 'HAPOALIM_USERCODE', label: 'User code', hint: 'the one you type on the bank site', type: 'text' },
    { key: 'HAPOALIM_PASSWORD', label: 'Password', hint: '', type: 'password' },
  ],
  leumi: [
    { key: 'LEUMI_USERNAME', label: 'Username', hint: '', type: 'text' },
    { key: 'LEUMI_PASSWORD', label: 'Password', hint: '', type: 'password' },
  ],
  cal: [
    { key: 'CAL_USERNAME', label: 'Username', hint: 'same as on cal-online.co.il', type: 'text' },
    { key: 'CAL_PASSWORD', label: 'Password', hint: '', type: 'password' },
  ],
};

export const PROVIDER_META = {
  isracard: { title: 'Isracard', kind: 'credit card', step: 'On each refresh you may need to pass a Cloudflare check' },
  hapoalim: {
    title: 'Bank Hapoalim',
    kind: 'bank',
    step: 'On each refresh you type the SMS code in the browser window',
  },
  leumi: { title: 'Bank Leumi', kind: 'bank', step: 'Login is automatic — usually nothing to type' },
  cal: { title: 'Cal (כאל)', kind: 'credit card', step: 'Login is automatic — usually nothing to type' },
};

export function page(state, token, months) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>kesef.ai setup</title>
<style>
  :root {
    --bg: #f6f7f9; --card: #fff; --fg: #16181d; --muted: #6b7280; --line: #e3e6ea;
    --accent: #2f6fe4; --accent-fg: #fff; --ok: #147a4b; --warn-bg: #fff8e6; --warn-line: #f0d089;
    --input-bg: #fff;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #14161a; --card: #1c1f25; --fg: #e8eaed; --muted: #9aa3af; --line: #2c313a;
      --accent: #5b91ff; --accent-fg: #0d1117; --ok: #4ec98a; --warn-bg: #2a2415; --warn-line: #5c4d22;
      --input-bg: #14171c;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 32px 20px 64px; background: var(--bg); color: var(--fg);
    font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .wrap { max-width: 620px; margin: 0 auto; }
  h1 { font-size: 24px; margin: 0 0 6px; letter-spacing: -0.01em; }
  .sub { color: var(--muted); margin: 0 0 24px; font-size: 14px; }
  .note {
    background: var(--warn-bg); border: 1px solid var(--warn-line); border-radius: 10px;
    padding: 12px 14px; font-size: 13.5px; margin-bottom: 24px; color: var(--fg);
  }
  .card {
    background: var(--card); border: 1px solid var(--line); border-radius: 14px;
    margin-bottom: 14px; overflow: hidden;
  }
  .head {
    display: flex; align-items: center; gap: 12px; padding: 16px 18px; cursor: pointer;
    user-select: none;
  }
  .head:hover { background: color-mix(in srgb, var(--fg) 3%, transparent); }
  .head input { width: 18px; height: 18px; accent-color: var(--accent); cursor: pointer; flex: none; }
  .title { font-weight: 600; }
  .kind { color: var(--muted); font-weight: 400; font-size: 13px; }
  .saved { margin-left: auto; color: var(--ok); font-size: 12.5px; font-weight: 500; flex: none; }
  .body { display: none; padding: 4px 18px 18px; border-top: 1px solid var(--line); }
  .body.open { display: block; }
  .step { color: var(--muted); font-size: 13px; margin: 12px 0 16px; }
  label { display: block; margin-bottom: 14px; }
  .lab { display: block; font-size: 13.5px; font-weight: 500; margin-bottom: 5px; }
  .hint { color: var(--muted); font-weight: 400; }
  .row { display: flex; gap: 8px; }
  input[type=text], input[type=password], input[type=number] {
    width: 100%; padding: 9px 11px; font-size: 15px; font-family: inherit;
    background: var(--input-bg); color: var(--fg);
    border: 1px solid var(--line); border-radius: 9px;
  }
  input:focus { outline: 2px solid var(--accent); outline-offset: -1px; border-color: transparent; }
  input::placeholder { color: var(--muted); opacity: 0.7; }
  .eye {
    flex: none; width: 42px; border: 1px solid var(--line); border-radius: 9px;
    background: var(--input-bg); color: var(--muted); cursor: pointer; font-size: 15px;
  }
  .eye:hover { color: var(--fg); }
  .months { display: flex; align-items: center; gap: 12px; padding: 16px 18px; }
  .months input { width: 88px; }
  .months .lab { margin: 0; }
  button.save {
    width: 100%; margin-top: 8px; padding: 13px; font-size: 15.5px; font-weight: 600;
    font-family: inherit; color: var(--accent-fg); background: var(--accent);
    border: 0; border-radius: 11px; cursor: pointer;
  }
  button.save:hover { filter: brightness(1.08); }
  button.save:disabled { opacity: 0.55; cursor: default; filter: none; }
  .msg { margin-top: 14px; font-size: 14px; }
  .msg.err { color: #c0392b; }
  @media (prefers-color-scheme: dark) { .msg.err { color: #ff8b7a; } }
  .done { text-align: center; padding: 40px 0; }
  .done .check { font-size: 44px; }
  .done h2 { margin: 12px 0 8px; font-size: 20px; }
  .done p { color: var(--muted); margin: 0 auto 8px; max-width: 420px; }
  .done code {
    background: color-mix(in srgb, var(--fg) 8%, transparent); padding: 2px 6px;
    border-radius: 5px; font-size: 13px;
  }
</style>
</head>
<body>
<div class="wrap" id="wrap">
  <h1>kesef.ai setup</h1>
  <p class="sub">Tick the banks and cards you use and fill in their fields. Leave the rest alone.</p>

  <div class="note">
    This page runs only on your computer (127.0.0.1) and writes a local <code>.env</code> file.
    Nothing is sent anywhere. The form shuts itself down after you save.
  </div>

  <form id="form">
    ${Object.keys(FIELDS)
      .map(p => providerCard(p, state[p]))
      .join('\n')}

    <div class="card">
      <div class="months">
        <span class="lab">Months of history to fetch</span>
        <input type="number" id="months" name="months" min="1" max="36" value="${months}">
      </div>
    </div>

    <button class="save" type="submit">Save</button>
    <div class="msg" id="msg"></div>
  </form>
</div>

<script>
const TOKEN = ${JSON.stringify(token)};

for (const head of document.querySelectorAll('.head')) {
  const box = head.querySelector('input[type=checkbox]');
  const body = head.parentElement.querySelector('.body');
  const sync = () => body.classList.toggle('open', box.checked);
  head.addEventListener('click', e => {
    if (e.target !== box) box.checked = !box.checked;
    sync();
  });
  sync();
}

for (const eye of document.querySelectorAll('.eye')) {
  eye.addEventListener('click', () => {
    const input = eye.previousElementSibling;
    const shown = input.type === 'text';
    input.type = shown ? 'password' : 'text';
    eye.textContent = shown ? '\\u{1F441}' : '\\u{1F648}';
  });
}

document.getElementById('form').addEventListener('submit', async e => {
  e.preventDefault();
  const msg = document.getElementById('msg');
  const btn = e.target.querySelector('button.save');
  const providers = {}, values = {};
  for (const box of document.querySelectorAll('input[type=checkbox]')) providers[box.dataset.provider] = box.checked;
  for (const input of document.querySelectorAll('input[data-key]')) values[input.dataset.key] = input.value.trim();
  if (!Object.values(providers).some(Boolean)) {
    msg.className = 'msg err';
    msg.textContent = 'Tick at least one bank or card.';
    return;
  }
  btn.disabled = true;
  msg.className = 'msg';
  msg.textContent = 'Saving…';
  try {
    const res = await fetch('/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Setup-Token': TOKEN },
      body: JSON.stringify({ providers, values, months: document.getElementById('months').value }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || ('HTTP ' + res.status));
    document.getElementById('wrap').innerHTML =
      '<div class="done"><div class="check">✅</div><h2>Saved</h2>' +
      '<p>' + data.summary + '</p>' +
      '<p>Close this tab and ask your agent to refresh a bank — no restart needed.</p></div>';
  } catch (err) {
    btn.disabled = false;
    msg.className = 'msg err';
    msg.textContent = 'Not saved: ' + err.message;
  }
});
</script>
</body>
</html>`;
}

function providerCard(provider, saved) {
  const meta = PROVIDER_META[provider];
  const fields = FIELDS[provider]
    .map(f => {
      const isSaved = saved.fields[f.key];
      const ph = isSaved ? 'saved — leave empty to keep it' : '';
      const input =
        `<input type="${f.type}" data-key="${f.key}" placeholder="${ph}" autocomplete="off" ` +
        `spellcheck="false" ${f.type === 'password' ? '' : 'inputmode="text"'}>`;
      const control =
        f.type === 'password'
          ? `<div class="row">${input}<button type="button" class="eye">\u{1F441}</button></div>`
          : input;
      return `<label><span class="lab">${f.label}${f.hint ? ` <span class="hint">— ${f.hint}</span>` : ''}</span>${control}</label>`;
    })
    .join('\n');
  return `<div class="card">
  <div class="head">
    <input type="checkbox" data-provider="${provider}" ${saved.any ? 'checked' : ''}>
    <span class="title">${meta.title} <span class="kind">— ${meta.kind}</span></span>
    ${saved.any ? '<span class="saved">already set up</span>' : ''}
  </div>
  <div class="body">
    <div class="step">${meta.step}</div>
    ${fields}
  </div>
</div>`;
}
