# Security Requirements

## Authentication

Required:
- JWT
- Refresh Token
- Password Hashing (bcrypt)

## Authorization

RBAC Required

Roles:
- Admin
- Manager
- Operator
- Viewer

## Data Protection

- HTTPS only
- Secure cookies
- CSRF protection
- XSS prevention
- SQL injection prevention

## Audit Logging

Log:
- Create
- Update
- Delete
- Login
- Logout