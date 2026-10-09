# Lloomiq website

Responsive static website for Chris Tufaro's AI implementation and software business. Native HTML, CSS, and JavaScript; no build step or package installation is required.

## Project layout

```text
public/                    Deployable website
  index.html               Main page and contact form
  workflow-demo.html       Standalone demo with fictional data
  favicon.svg
  assets/
    css/styles.css         Responsive styling
    js/script.js           Contact API submission and footer year
    images/                Portrait, logo, and retained hero artwork
docs/
  BACKEND-ENDPOINTS.md      Backend contract and integration notes
.github/workflows/         Azure Static Web Apps deployment
README.md
LICENSE
```

## Local preview

From the project root:

```powershell
python -m http.server 8000 --bind 127.0.0.1 --directory public
```

Open http://localhost:8000. The comparison demo is available at `/workflow-demo.html`.

## Contact API configuration

`public/assets/js/script.js` sets `apiEnvironment` to `auto` by default:

- Localhost, loopback, or a file preview uses `http://localhost:7071/api/contact`.
- Other hosts use `https://azurefx.azurewebsites.net/api/contact`.
- Set `apiEnvironment` to `local` or `production` to override detection.

The form posts trimmed JSON with `name`, `email`, `business`, and `message` to the absolute endpoint URL, without credentials or cookies. It shows inline validation errors, prevents concurrent submissions, and clears values only after HTTP 200 with `status: "accepted"`. Failed submissions preserve entered values; requests are never automatically retried. The direct email link remains available. See [the backend contract](docs/BACKEND-ENDPOINTS.md) for validation and delivery behavior.

Configure the backend to accept requests from the website's production origin and local preview origin. Run the local Functions project separately when testing local form submission.

## Verification

Run `node --test tests/contact.test.cjs` for contact submission and error-state checks. No dependencies are required. These use a simulated DOM and API responses; check browser CORS from the deployed website separately.

On October 9, 2026, the deployed Azure endpoint returned HTTP 200 with `status: "accepted"` for a labeled integration test and HTTP 400 with field errors for invalid input. This verifies API acceptance, not mailbox delivery.

## Deployment

The existing Azure Static Web Apps workflow deploys `public/` on pushes to `main`. Repository documentation stays outside the deployed site. No push or publication is performed as part of folder organization.

Before launch, test receipt of a real inquiry and its Reply-To behavior, review final copy, and check deployed metadata.
