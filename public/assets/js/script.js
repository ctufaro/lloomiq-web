document.getElementById('year').textContent = new Date().getFullYear();
// Set to 'local' or 'production' to override automatic hostname detection.
const apiEnvironment = 'auto';
const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || location.protocol === 'file:';
const environment = apiEnvironment === 'auto' ? (isLocal ? 'local' : 'production') : apiEnvironment;
const contactEndpoint = { local: 'http://localhost:7071/api/contact', production: 'https://azurefx.azurewebsites.net/api/contact' }[environment];
const form = document.getElementById('contact-form');
const status = document.getElementById('form-status');
const button = form.querySelector('button[type="submit"]');
const limits = { name: 120, email: 254, business: 160, message: 4000 };
const fields = Object.fromEntries(Object.keys(limits).map(key => [key, document.getElementById(key)]));
const fieldErrors = Object.fromEntries(Object.entries(fields).map(([key, input]) => {
  const error = document.createElement('p');
  error.id = `${key}-error`;
  error.className = 'field-error';
  error.hidden = true;
  input.setAttribute('aria-describedby', error.id);
  input.after(error);
  return [key, error];
}));
// Validate trimmed values and show browser and API errors in the same places.
form.noValidate = true;
function clearErrors() {
  for (const key of Object.keys(fields)) {
    fields[key].removeAttribute('aria-invalid');
    fieldErrors[key].textContent = '';
    fieldErrors[key].hidden = true;
  }
}
function showErrors(errors) {
  let first;
  for (const key of Object.keys(fields)) {
    if (typeof errors?.[key] !== 'string' || !errors[key]) continue;
    fields[key].setAttribute('aria-invalid', 'true');
    fieldErrors[key].textContent = errors[key];
    fieldErrors[key].hidden = false;
    first ||= fields[key];
  }
  first?.focus();
}
const friendlyError = 'We could not confirm submission. Your details are still here. Please try again or email hello@lloomiq.com.';
let submitting = false;
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submitting) return;
  clearErrors();
  const data = new FormData(form);
  const payload = Object.fromEntries(['name', 'email', 'business', 'message'].map(key => [key, String(data.get(key) || '').trim()]));
  const errors = {};
  for (const key of Object.keys(fields)) {
    if (key !== 'business' && !payload[key]) errors[key] = 'This field is required.';
    else if (payload[key].length > limits[key]) errors[key] = `Use ${limits[key]} characters or fewer.`;
  }
  const emailCheck = document.createElement('input');
  emailCheck.type = 'email';
  emailCheck.value = payload.email;
  if (payload.email && (/[\r\n]/.test(payload.email) || !emailCheck.checkValidity())) errors.email = 'Enter a valid email address.';
  if (Object.keys(errors).length) {
    status.textContent = 'Please check the highlighted fields.';
    showErrors(errors);
    return;
  }
  submitting = true;
  button.disabled = true;
  form.setAttribute('aria-busy', 'true');
  status.textContent = 'Submitting your inquiry…';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(contactEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', body: JSON.stringify(payload), signal: controller.signal });
    const result = await response.json();
    if (response.status === 200 && result?.status === 'accepted') {
      status.textContent = 'Thanks! Your inquiry has been submitted.';
      form.reset();
      return;
    }
    status.textContent = !response.ok && typeof result?.error?.message === 'string' && result.error.message ? result.error.message : friendlyError;
    if (response.status === 400) showErrors(result?.error?.fields);
  } catch (error) {
    status.textContent = error.name === 'AbortError' ? 'The request timed out, so we could not confirm submission. Your details are still here. Email hello@lloomiq.com or retry, which may submit a duplicate.' : friendlyError;
  } finally {
    clearTimeout(timeout);
    submitting = false;
    button.disabled = false;
    form.removeAttribute('aria-busy');
  }
});
