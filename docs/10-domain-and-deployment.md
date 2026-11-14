# 10 — Domain and Deployment Plan

## Domain
Primary domain target: `sandar.biz.id`.

The project owner has reported purchasing this domain. This repository does not independently verify registrar ownership, DNS delegation, SSL, or production routing. Those checks must be completed in the registrar and DNS provider account.

## Deployment posture
No production deployment is claimed by this documentation commit. Choose a hosting path only after checking current free-tier limits, data location, access controls, backup, and total operating cost.

## Suggested rollout
1. Verify domain ownership and DNS access in the registrar.
2. Decide whether the public site and private workspace use one host or separate subdomains.
3. Configure HTTPS and canonical redirects.
4. Keep preview and production isolated.
5. Use synthetic data in preview.
6. Store secrets only in the hosting provider's secret manager.
7. Configure backup and restore before real-user data.
8. Publish privacy notice and terms only after they reflect the actual implementation and legal review.

## Candidate host architecture
A Cloudflare-first static/PWA + Worker API + D1/R2 arrangement may be considered, but no account, binding, database, bucket, payment method, or domain configuration is assumed to exist.

## Domain release checklist
- [ ] Registrar purchase and renewal status confirmed by owner.
- [ ] DNS control confirmed.
- [ ] HTTPS certificate active.
- [ ] Apex and www/subdomain behavior tested.
- [ ] No secrets or private data in public pages.
- [ ] Privacy notice and terms match implemented behavior.
- [ ] Monitoring and rollback path documented.
