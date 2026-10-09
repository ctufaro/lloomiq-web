const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function setup(fetchImpl, hostname = 'lloomiq.com') {
  const elements = {};
  function element() {
    return { value: '', textContent: '', attributes: {}, setAttribute(k, v) { this.attributes[k] = v; },
      removeAttribute(k) { delete this.attributes[k]; }, after() {}, focus() { this.focused = true; },
      checkValidity() { return /^[^\s@]+@[^\s@]+$/.test(this.value); } };
  }
  for (const id of ['year', 'contact-form', 'form-status', 'name', 'email', 'business', 'message']) elements[id] = element();
  const button = element();
  const form = elements['contact-form'];
  form.querySelector = () => button;
  form.addEventListener = (_, handler) => { form.submit = () => handler({ preventDefault() {} }); };
  form.reset = () => { form.resets = (form.resets || 0) + 1; for (const key of ['name', 'email', 'business', 'message']) elements[key].value = ''; };
  const calls = [];
  vm.runInNewContext(readFileSync('public/assets/js/script.js', 'utf8'), {
    document: { getElementById: id => elements[id], createElement: element },
    location: { hostname, protocol: 'https:' }, Date, AbortController, setTimeout, clearTimeout,
    FormData: class { get(key) { return elements[key].value; } },
    fetch: (...args) => { calls.push(args); return fetchImpl(...args); },
  });
  Object.assign(elements.name, { value: ' Jane Smith ' });
  elements.email.value = ' jane@example.com ';
  elements.business.value = ' Example Company ';
  elements.message.value = ' Test inquiry ';
  return { elements, form, button, calls };
}
const response = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

test('accepted submission uses absolute Azure URL, trimmed JSON, no cookies, and resets', async () => {
  const h = setup(async () => response(200, { status: 'accepted', submissionId: 'test' }));
  await h.form.submit();
  const [url, options] = h.calls[0];
  assert.equal(url, 'https://azurefx.azurewebsites.net/api/contact');
  assert.equal(options.method, 'POST');
  assert.deepEqual(Object.keys(options.headers), ['Content-Type']);
  assert.equal(options.headers['Content-Type'], 'application/json');
  assert.equal(options.credentials, 'omit');
  assert.deepEqual(JSON.parse(options.body), { name: 'Jane Smith', email: 'jane@example.com', business: 'Example Company', message: 'Test inquiry' });
  assert.equal(h.form.resets, 1);
  assert.equal(h.button.disabled, false);
});

test('pending submission prevents duplicates and keeps the button disabled', async () => {
  let resolve;
  const h = setup(() => new Promise(r => { resolve = r; }));
  const pending = h.form.submit();
  assert.equal(h.button.disabled, true);
  assert.equal(h.form.attributes['aria-busy'], 'true');
  await h.form.submit();
  assert.equal(h.calls.length, 1);
  resolve(response(200, { status: 'accepted' }));
  await pending;
  assert.equal(h.form.attributes['aria-busy'], undefined);
});

test('required, invalid email, and length validation block requests', async () => {
  for (const [key, value] of [['name', '   '], ['message', ' '], ['email', 'invalid'], ['email', 'a@b\r\n.com'], ['name', 'x'.repeat(121)], ['email', 'x'.repeat(250) + '@a.com'], ['business', 'x'.repeat(161)], ['message', 'x'.repeat(4001)]]) {
    const h = setup(() => { throw Error('Should not fetch'); });
    h.elements[key].value = value;
    await h.form.submit();
    assert.equal(h.calls.length, 0);
    assert.equal(h.elements[key].attributes['aria-invalid'], 'true');
    assert.equal(h.elements[key].focused, true);
  }
});

test('optional business and maximum lengths are accepted', async () => {
  const h = setup(async () => response(200, { status: 'accepted' }));
  h.elements.name.value = 'x'.repeat(120);
  h.elements.email.value = 'x'.repeat(242) + '@example.com';
  h.elements.business.value = ' '.repeat(3);
  h.elements.message.value = 'x'.repeat(4000);
  await h.form.submit();
  assert.equal(h.calls.length, 1);
  assert.equal(JSON.parse(h.calls[0][1].body).business, '');
});

test('400 shows field and form errors and retains values; next submission clears errors', async () => {
  let next = response(400, { error: { message: 'Please check your email.', fields: { email: 'Email rejected.' } } });
  const h = setup(async () => next);
  await h.form.submit();
  assert.equal(h.elements['form-status'].textContent, 'Please check your email.');
  assert.equal(h.elements.email.attributes['aria-invalid'], 'true');
  assert.equal(h.elements.email.value, ' jane@example.com ');
  assert.equal(h.button.disabled, false);
  assert.equal(h.form.resets, undefined);
  next = response(200, { status: 'accepted' });
  await h.form.submit();
  assert.equal(h.elements.email.attributes['aria-invalid'], undefined);
});

test('API failures display messages even without field errors', async () => {
  for (const code of [400, 413, 415, 503]) {
    const h = setup(async () => response(code, { error: { message: `Error ${code}` } }));
    await h.form.submit();
    assert.equal(h.elements['form-status'].textContent, `Error ${code}`);
    assert.equal(h.form.resets, undefined);
    assert.equal(h.button.disabled, false);
    assert.equal(h.elements.message.value, ' Test inquiry ');
    assert.equal(h.calls.length, 1);
  }
});

test('unexpected, malformed, network and timeout responses preserve values without retries', async () => {
  const failures = [
    async () => response(200, { status: 'other' }),
    async () => response(202, { status: 'accepted' }),
    async () => response(200, null),
    async () => ({ status: 200, json: async () => { throw SyntaxError('Invalid JSON'); } }),
    async () => { throw TypeError('Network failed'); },
    async () => { const error = Error('Timeout'); error.name = 'AbortError'; throw error; },
  ];
  for (const failure of failures) {
    const h = setup(failure);
    await h.form.submit();
    assert.match(h.elements['form-status'].textContent, /could not confirm submission/);
    assert.equal(h.form.resets, undefined);
    assert.equal(h.elements.message.value, ' Test inquiry ');
    assert.equal(h.button.disabled, false);
    assert.equal(h.calls.length, 1);
  }
});

test('existing localhost configuration uses the absolute local Functions URL', async () => {
  const h = setup(async () => response(200, { status: 'accepted' }), 'localhost');
  await h.form.submit();
  assert.equal(h.calls[0][0], 'http://localhost:7071/api/contact');
});
