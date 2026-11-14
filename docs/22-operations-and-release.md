# 22 — Operations and Release Management

## Operating constraint
Default budget is Rp0. No paid actor, API, domain add-on, hosting upgrade, or subscription may be activated without explicit owner approval of the exact cost.

## Environments
- Development: synthetic data only.
- Preview: isolated project, database, storage, and secrets.
- Production: only after release gates; no preview credentials or data reuse.

## Release checklist
- [ ] Commit reviewed and branch head checked.
- [ ] Automated checks executed and results recorded.
- [ ] Secret and dependency scans reviewed.
- [ ] Data migrations are reversible or have a tested recovery plan.
- [ ] Privacy and security impact reviewed.
- [ ] Backup and restore verified.
- [ ] Monitoring and error reporting avoid sensitive payloads.
- [ ] Rollback procedure documented.
- [ ] User-facing notices match actual behavior.
- [ ] Owner approves production release.

## Incident response
1. Protect users and contain the incident.
2. Disable affected feature or credential where appropriate.
3. Preserve minimal evidence without copying unnecessary personal data.
4. Assess data and user impact.
5. Follow applicable notification and legal obligations.
6. Restore safely and document corrective actions.

## Change management
- Work directly on main only for ready, scoped changes.
- Inspect latest main before each write.
- Never force-push or rewrite history.
- Keep commits focused and descriptive.
- Report what changed, what was tested, what remains unverified, and the exact commit.
