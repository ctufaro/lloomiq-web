document.getElementById('year').textContent = new Date().getFullYear();
// Set to 'local' or 'production' to override automatic hostname detection.
const apiEnvironment = 'auto';
const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || location.protocol === 'file:';
const environment = apiEnvironment === 'auto' ? (isLocal ? 'local' : 'production') : apiEnvironment;
const contactEndpoint = { local: 'http://localhost:7071/api/contact', production: 'https://azurefx.azurewebsites.net/api/contact' }[environment];
const form = document.getElementById('contact-form');
const status = document.getElementById('form-status');
const button = form.querySelector('button[type="submit"]');
let submitting = false;
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submitting || !form.reportValidity()) return;
  const data = new FormData(form);
  const payload = Object.fromEntries(['name', 'email', 'business', 'message'].map(key => [key, String(data.get(key) || '').trim()]));
  if (!payload.name || !payload.message) {
    status.textContent = 'Please enter your name and a little about what you would like help with.';
    document.getElementById(!payload.name ? 'name' : 'message').focus();
    return;
  }
  submitting = true;
  button.disabled = true;
  form.setAttribute('aria-busy', 'true');
  status.textContent = 'Submitting your inquiry…';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(contactEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
    if (!response.ok) {
      status.textContent = response.status === 400 ? 'Please check your details and try again.' : response.status === 429 ? 'Too many requests. Please wait before trying again.' : 'We could not submit your inquiry. Please try again or email hello@lloomiq.com.';
      return;
    }
    status.textContent = 'Thanks! Your inquiry has been submitted. I will be in touch soon.';
    form.reset();
  } catch (error) {
    status.textContent = error.name === 'AbortError' ? 'The request timed out, so we could not confirm submission. Your details are still here. Email hello@lloomiq.com or retry, which may submit a duplicate.' : 'We could not confirm submission. Your details are still here. Please try again or email hello@lloomiq.com.';
  } finally {
    clearTimeout(timeout);
    submitting = false;
    button.disabled = false;
    form.removeAttribute('aria-busy');
  }
});