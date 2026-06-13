# API Standards

## Response Format

Success

{
  "success": true,
  "data": {}
}

Error

{
  "success": false,
  "message": "",
  "code": ""
}

## Validation

All requests:
- Zod schema
- Type-safe

## Naming

GET    /api/products
POST   /api/products
PATCH  /api/products/:id
DELETE /api/products/:id