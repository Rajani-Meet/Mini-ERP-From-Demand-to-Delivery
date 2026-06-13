# Dependency Security Audit

## Approved Packages

### Frontend
- next
- react
- react-dom
- shadcn-ui
- tailwindcss
- framer-motion

### Backend
- prisma
- @prisma/client
- zod

## Required Commands

npm audit

npm audit fix

npx prisma validate

## Forbidden Packages

- request
- crypto-js
- jquery
- moment

## Security Policy

No package:
- abandoned > 1 year
- critical vulnerabilities
- unknown maintainers