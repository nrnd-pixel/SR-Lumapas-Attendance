# Phase 8 Pilot Package Manifest

**Date:** 25 Sep 2026  
**Exact runtime source:** `dc8e29bbf727c1d4dacf9ad7986e28f450b75718`  
**Pilot branch:** `pilot/phase-8-cleaned-v1-preview`  
**Purpose:** define the exact minimal runtime payload for the separate manual Netlify pilot without publishing repository-only files.

## Important correction

The pilot runtime contains **16 JavaScript modules**, not 15.

Therefore the reviewed runtime payload is:

- 1 `index.html`
- 16 files under `assets/js/`
- 17 reviewed source files total
- 99,231 bytes across those 17 source files, using GitHub's blob-size metadata
- plus one generated deployment-only `_headers` file

The generated `_headers` file is not part of the signed runtime source SHA. It reproduces the current `netlify.toml` response-header policy for the manual publish directory.

## Exact reviewed source files

| Path | Git blob SHA | Bytes |
|---|---|---:|
| `index.html` | `e3502e0e4c32c00e89c7d06764c72b1b135f18fc` | 32,121 |
| `assets/js/admin-dashboard.js` | `5c955e8c6bceaa329236a2801b7b2f697d298299` | 4,960 |
| `assets/js/app-bootstrap.js` | `a5ed551751ab399531866641b2b93525ce752af2` | 2,604 |
| `assets/js/app-navigation.js` | `b10f8e6aaf66a7a134247902a378ccc21fddfa3b` | 1,388 |
| `assets/js/app-state.js` | `6e491cf10d9413d1a484cbac15f01d1d9451ee72` | 566 |
| `assets/js/attendance-register.js` | `86da0eb3ad45a510926a06173b3a14dbf485cae1` | 12,045 |
| `assets/js/auth-session.js` | `a97e357e3bec0740ef8587d1f933739d25e7a114` | 4,103 |
| `assets/js/date-helpers.js` | `82b76b7c4d208a04b4fd40ceabd31fbcd7151196` | 933 |
| `assets/js/main.js` | `a384b6637b2fec4c916735b339295bc28c9fe460` | 5,426 |
| `assets/js/period-reports.js` | `43c873428186571ece9caaa4bae73e1573718230` | 9,665 |
| `assets/js/reporting-population.js` | `816d5421ad530112d9d367ad367e762d32191541` | 1,453 |
| `assets/js/statistics.js` | `34fda80ad3de0dae30aa4bb68cfc472a61a7285d` | 4,327 |
| `assets/js/student-management.js` | `21e19bb38bc2f8c0137758976f8019c63ac824bc` | 6,993 |
| `assets/js/supabase-client.js` | `82741fd1d72301b83e37e16a9bdd15048455d8ae` | 350 |
| `assets/js/teacher-access.js` | `594903f1d53bbb0d3b5ece2f7af4662c5fe70ecd` | 6,627 |
| `assets/js/teacher-admin.js` | `a9fc2493a0af073a887c3af364f8bc6a2e044d25` | 4,603 |
| `assets/js/ui-helpers.js` | `6b52195b08e7612fc9871f3e907a2f0e7844a81c` | 1,067 |

Git blob SHAs are content-addressed identifiers for the exact repository blobs and are the authoritative package check for this checkpoint.

## Runtime dependency closure

`index.html` has one local script reference:

`./assets/js/main.js`

The exact pilot `main.js` imports the remaining application modules:

- `supabase-client.js`
- `app-state.js`
- `date-helpers.js`
- `ui-helpers.js`
- `auth-session.js`
- `attendance-register.js`
- `student-management.js`
- `teacher-admin.js`
- `teacher-access.js`
- `statistics.js`
- `admin-dashboard.js`
- `period-reports.js`
- `reporting-population.js`
- `app-bootstrap.js`
- `app-navigation.js`

The only external module dependency is the existing pinned Supabase browser module:

`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.114.0/+esm`

No separate local CSS, image, font, test, SQL, documentation, or build artifact is referenced by `index.html`.

## Deployment-only _headers

Create this file in the root of the manual Netlify upload folder:

```text
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  X-Frame-Options: DENY
  Cache-Control: no-store
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; connect-src https://rojetehazryfpcxlwtbi.supabase.co wss://rojetehazryfpcxlwtbi.supabase.co https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; frame-ancestors 'none';
```

Netlify documents `_headers` as a supported publish-directory mechanism for custom response headers. Official references: `https://docs.netlify.com/manage/routing/headers/` and `https://docs.netlify.com/build/configure-builds/file-based-configuration/`.

## Expected manual package tree

```text
pilot-package/
├── _headers
├── index.html
└── assets/
    └── js/
        ├── admin-dashboard.js
        ├── app-bootstrap.js
        ├── app-navigation.js
        ├── app-state.js
        ├── attendance-register.js
        ├── auth-session.js
        ├── date-helpers.js
        ├── main.js
        ├── period-reports.js
        ├── reporting-population.js
        ├── statistics.js
        ├── student-management.js
        ├── supabase-client.js
        ├── teacher-access.js
        ├── teacher-admin.js
        └── ui-helpers.js
```

Do not include:

- `.github/`
- `docs/`
- `supabase/`
- `tests/`
- `ATTENDANCE_TECH_DEBT_CLEANUP_ROADMAP.md`
- README files
- `netlify.toml` itself
- credentials, tokens, production exports, or pupil datasets

## Verification before upload

Before the manual Netlify upload:

1. verify exactly 17 reviewed source files are present;
2. verify every source file's Git blob SHA against the table above;
3. verify `_headers` matches the exact deployment-only content above;
4. verify no extra repository files are present;
5. record the stable Netlify pilot hostname after site creation;
6. then add only the exact pilot root to Supabase Auth Redirect URLs:
   `https://<pilot-site>.netlify.app/`

Supabase requires the requested `redirectTo` URL to match the configured Redirect URLs list and recommends exact redirect paths for stable production-style URLs. Official references: `https://supabase.com/docs/guides/auth/redirect-urls` and `https://supabase.com/docs/guides/local-development/cli/config`.

## Automated package builder

Repository workflow: `.github/workflows/phase8-pilot-package.yml`

The workflow is intentionally packaging-only:

- repository permission is `contents: read`;
- it requires no repository or Supabase secrets;
- it checks out frozen runtime SHA `dc8e29bbf727c1d4dacf9ad7986e28f450b75718`, not the workflow/PR head;
- it requires that exact checkout SHA;
- it verifies all 17 reviewed Git blob SHAs listed in this manifest;
- it verifies exactly 16 JavaScript modules;
- it verifies frozen `netlify.toml` blob `738c5f0b492f8a2b8a2e6c2857e95f0acaac87b9`;
- it assembles only `index.html`, `assets/js/*.js`, and generated `_headers`;
- it requires 18 deployment files total;
- it rejects repository-only QA/docs/SQL/config paths from the package;
- it prints per-file SHA-256 values into the Actions job summary;
- it uploads artifact `phase8-pilot-package-dc8e29bb` with 30-day retention;
- pinned `actions/upload-artifact` v7.0.1 records an artifact-level SHA-256 digest in the job summary; `actions/checkout` is likewise pinned to v7.0.1 by immutable commit SHA.

The uploaded artifact is a package candidate only. It must be inspected before any manual Netlify upload.

## Status

Package-builder implementation prepared on a focused CI branch. No package has been uploaded to Netlify, no Supabase Auth redirect has been changed, and production v0.7 remains untouched.
