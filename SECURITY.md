# Security policy

## Reporting a vulnerability

Please use GitHub private vulnerability reporting for security issues. Do not open a public issue containing exploit details, credentials, private URLs, or user data.

Include the affected version, reproduction steps, impact, and any suggested mitigation. Reports will be acknowledged after they are reviewed and reproduced.

## Deployment boundary

The public BranchScript repository builds a static web container and has no server-side upload endpoint. It contains no production credentials, database access, mail configuration, or cloud backend implementation.

Browser sessions use a host-only Secure, HttpOnly, SameSite=Strict cookie. Tokens are not returned to BranchScript JavaScript or stored in web storage. Cloud authorization and persistence are handled by separately maintained services.

Local IndexedDB and explicit exports remain available without an account.

## Implemented safeguards

- Production responses use a restrictive Content Security Policy with exact hashes for structured-data scripts. Executable inline scripts, frames, objects, workers, and cross-origin connections are blocked.
- HSTS, MIME sniffing protection, clickjacking protection, a no-referrer policy, browser feature restrictions, and origin isolation headers are set by the production Nginx configuration.
- User-authored labels, answers, and imported projects are schema-validated and size-bounded before they reach the graph. They are rendered as text rather than HTML.
- Cloud responses are same-origin only, use credentials without exposing the session cookie, have a request timeout, reject redirects, and validate response type, size, and schema.
- The public container runs as an unprivileged user with a read-only filesystem, dropped Linux capabilities, no-new-privileges, and CPU, memory, and process limits.
- Dependency versions and GitHub Actions are pinned. CI runs dependency audit, package-signature verification, security configuration tests, browser XSS regression coverage, and runtime container checks.
- Production source maps are disabled. The static container fails closed on `/api/`; the trusted edge proxy is responsible for routing API requests to the private service.

## Production requirements

- Keep credentials, signing keys, mail settings, database URLs, gateway rules, and backend source outside this public repository and image.
- Terminate TLS at Cloudflare or another trusted edge and use strict certificate validation to the origin. Do not expose the origin service directly to the internet.
- Route only the documented API prefixes to the private backend. The backend must enforce Origin checks, CSRF protection where applicable, ownership checks, input limits, rate limits, and secure cookie attributes independently of the frontend.
- Keep the frontend and backend images patched. Review `npm audit`, container scan, and CI results before each deployment.
- Back up user diagrams and test restoration. Logs must avoid passwords, verification codes, cookies, diagram source, and other personal content.

These controls reduce common web risks but do not replace review of the private backend, Cloudflare configuration, host firewall, and operating system.
