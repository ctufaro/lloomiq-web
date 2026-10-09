# Website backend handoff

Reviewed: October 9, 2026.

## Current scope

The website needs one public endpoint to submit the contact form. The form in `public/index.html` posts JSON through `public/assets/js/script.js`. Local previews use `http://localhost:7071/api/contact`; deployed hosts use `https://azurefx.azurewebsites.net/api/contact`. The backend handles delivery. Live API acceptance and validation were verified on October 9, 2026; mailbox delivery still needs verification.

Navigation, service descriptions, the portrait, and other assets need no custom backend endpoints. `workflow-demo.html` contains fixed fictional data and a button that reveals predetermined results. It needs no backend for its current behavior. There are no accounts, uploads, booking flows, or newsletter signup forms in the current website.

## Required: POST /api/contact

Purpose: accept an inquiry from the website and arrange notification to `hello@lloomiq.com` without requiring the visitor's email app.

Request content type: `application/json`.

```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "business": "Example Company",
  "message": "We would like help automating incoming requests."
}
```

### Validation

- `name`: required string, trimmed, 1–120 characters.
- `email`: required string, trimmed, valid email format, at most 254 characters. Reject carriage returns and newlines.
- `business`: optional string, trimmed, at most 160 characters. Missing or empty means not provided.
- `message`: required string, trimmed, 1–4,000 characters.
- Reject invalid JSON, incorrect field types, oversized payloads, and unsupported content types. Suggested request size limit: 16 KiB.
- Apply all validation on the server, even though the browser also validates fields.

### Processing and email

1. Validate the request and apply abuse controls before sending email or creating a queue item.
2. Generate a server-side submission ID and UTC timestamp.
3. Send a notification through the backend's configured email provider, or durably enqueue it for a worker to send.
4. Use a fixed, configured recipient of `hello@lloomiq.com` and a fixed subject such as `Website inquiry: Let's talk about my workflow`.
5. Use a verified application sender. Set the visitor's validated email as `Reply-To`, so Chris can reply directly. Do not use the visitor's email as the sender.
6. Include name, email, business, message, submission ID, and timestamp. Use plain text, or escape all submitted values if generating HTML.
7. Return success only after the provider accepts the notification or a durable queue accepts the submission. Provider acceptance does not mean mailbox delivery.

A database is optional for direct sending. If using a queue, track processing failures, use bounded retries, and alert on exhausted retries so accepted inquiries do not disappear silently.

Do not send an automatic visitor confirmation email in the initial scope; the website does not request it.

### Responses

Direct provider acceptance: `200 OK`.

```json
{
  "status": "accepted",
  "submissionId": "server-generated-id",
  "message": "Thanks! Your inquiry has been submitted."
}
```

The current frontend requires HTTP 200 with `status: "accepted"` before showing success or clearing the form. HTTP 202 or any other unexpected success response preserves values and displays a friendly error. No public polling endpoint is needed for the current contact experience.

| Status | Meaning | Frontend behavior |
| --- | --- | --- |
| 400 | Invalid JSON or fields | Show `error.message` and inline `error.fields` when supplied; retain values. |
| 413 | Request too large | Show `error.message`; retain values. |
| 415 | Unsupported content type | Show `error.message`; retain values. |
| 429 | Too many requests | Show `error.message`; retain values; no automatic retry. |
| 503 | Email provider or queue unavailable | Show `error.message`; retain values. |

Example validation response:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the highlighted fields.",
    "fields": {
      "email": "Enter a valid email address."
    }
  }
}
```

Keep internal exception details and provider credentials out of responses. Unexpected failures should use a generic error response and a server-side correlation ID.

### Access, abuse controls, and operations

- This is a public visitor form; do not require a visitor account or put a Function key or email-provider secret in browser JavaScript. Enforce abuse controls on the server or gateway.
- Apply rate limits using a trustworthy client-IP source from the deployment's ingress. CORS alone does not prevent spam.
- Configure CORS for the actual production website origin and explicit development origins. Support preflight requests as needed. The frontend uses the absolute Azure Functions URL, not a relative `/api/contact` route.
- Keep provider credentials and recipient/sender configuration in server-side configuration.
- Log submission ID, timestamp, processing status, and operational errors. Avoid logging full messages or email addresses by default.
- If submissions are stored, define retention and access permissions before launch.
- Optional spam hardening: add a honeypot field or a challenge token to both the frontend and endpoint contract; verify challenge tokens server-side. Neither field exists in the current form.
- Optional retry hardening: accept an `Idempotency-Key` header and persist deduplication state for a documented period, returning the original result for the same request. The frontend should reuse that key when retrying the same submission, since a timeout can happen after the server accepts it.

## Frontend integration status and remaining checks

- Implemented: JSON POST to the configured contact route with automatic local/production selection.
- Implemented: the submit button is disabled while a request is pending, preventing concurrent submissions.
- Only display confirmation after a successful endpoint response. Use “submitted,” rather than claiming mailbox delivery.
- Keep all values on validation failures, network failures, and timeouts. A timeout means the outcome is unknown; provide retry guidance.
- Implemented: the form note and no-JavaScript fallback reflect API submission; the direct email link remains available.
- Implemented: the old mailto submission attributes have been removed. The no-JavaScript notice directs visitors to email Chris.
- Check invalid inputs, successful submission, provider failure, rate limiting, and receipt of a real test inquiry in the mailbox. Verify that replying targets the visitor.

## Optional: GET /api/health

Useful if the backend project needs a lightweight monitoring endpoint. Return `200` with a small status response when the service is available. Do not return secrets, environment variables, visitor data, or detailed infrastructure information. The website does not need to call it.

## Future scope only

A live report comparison endpoint would become relevant if visitors can upload reports or submit their own data. That requires a separate contract for formats, limits, processing rules, authentication, and data handling. The current demonstration does not require it.
