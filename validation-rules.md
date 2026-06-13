# Validation Rules

## Product

SKU:
- required
- unique

Name:
- required
- max 150 chars

Cost Price:
- > 0

Stock:
- >= 0

## Sales Order

Customer:
- required

Quantity:
- > 0

## Purchase Order

Vendor:
- required

Expected Date:
- future date

## Manufacturing Order

Quantity:
- > 0