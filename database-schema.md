# Database Schema

## Product

- id
- sku
- name
- description
- costPrice
- stockPrice
- stockQty
- reservedQty
- procurementType
- createdAt
- updatedAt

## Vendor

- id
- name
- email
- phone

## SalesOrder

- id
- orderNumber
- customerName
- status
- totalAmount

## PurchaseOrder

- id
- poNumber
- vendorId
- status

## ManufacturingOrder

- id
- moNumber
- productId
- quantity
- status

## InventoryMovement

- id
- productId
- quantity
- movementType

## AuditLog

- id
- entity
- action
- oldValue
- newValue
- userId