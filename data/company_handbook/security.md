# Security and Compliance

## Certifications
Nimbus Cloud is SOC 2 Type II certified and ISO 27001 certified. A HIPAA Business Associate
Agreement (BAA) is available on the Enterprise plan only.

## Data encryption
- At rest: AES-256 on all disks and backups.
- In transit: TLS 1.2 or higher is required; TLS 1.0 and 1.1 are disabled.

## Authentication
- Two-factor authentication (2FA) is available on all plans and mandatory for Enterprise admins.
- SSO via SAML 2.0 is available on Enterprise.
- API keys can be scoped to a single project and rotated at any time.

## Backups
Daily backups are kept for 7 days on Starter, 30 days on Pro, and 90 days on Enterprise.
Point-in-time recovery is available for Managed PostgreSQL on Pro and Enterprise.

## Reporting a vulnerability
Send reports to security@nimbus.example. We acknowledge reports within 2 business days and run a
bug bounty that pays up to $10,000 for critical findings.
