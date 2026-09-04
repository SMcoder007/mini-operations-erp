# Mini Operations ERP

A production-oriented full-stack Operations ERP built as a technical case study.

The system manages inventory, work orders, internal stock transfers, customer orders and stock reservations with authentication, role-based authorization, validation and database transactions.

## Features

- JWT-based authentication
- Role-based authorization
- Admin, Operations User and Sales User roles
- Inventory management
- Stock-in and stock-out
- Available quantity calculation
- Negative inventory prevention
- Work order management
- Automatic material shortage calculation
- Internal stock transfers
- Transfer dispatch and receipt workflow
- Customer management
- Customer order creation
- Inventory reservation
- Reservation release on cancellation
- Transaction-safe inventory operations
- Backend validation
- REST APIs
- React frontend
- MySQL relational database

## Technology Stack

### Frontend
- React
- Vite
- JavaScript
- CSS

### Backend
- Node.js
- Express.js
- JWT
- bcryptjs
- mysql2
- CORS
- dotenv

### Database
- MySQL

## User Roles

### Admin
- Create Work Orders
- Manage inventory
- Manage transfers
- Manage customer orders

### Operations User
- Manage inventory
- Create and process internal transfers
- Update Work Order status

### Sales User
- Create customers
- Create customer orders
- Reserve inventory
- Cancel customer orders

## Main Business Flow

Inventory
→ Work Order
→ Stock Check
→ Internal Transfer / Shortage
→ Customer Reservation

## Inventory Logic

Available Quantity is calculated as:

Physical Quantity - Reserved Quantity

The backend prevents:

- Negative inventory
- Stock-out greater than available quantity
- Transfer greater than available quantity
- Reservation greater than available quantity
- Duplicate transfer receipt

## Internal Transfer Logic

Transfer lifecycle:

REQUESTED
→ DISPATCHED
→ RECEIVED

When a transfer is dispatched:

- Source inventory decreases.
- Destination inventory does not increase yet.

When the transfer is received:

- Destination inventory increases.
- The transfer is marked RECEIVED.

A received transfer cannot be received again.

## Customer Reservation Logic

Customer orders reserve inventory at the backend level.

The reservation operation uses a database transaction and row locking to prevent stock from being over-reserved during concurrent operations.

When an order is cancelled:

- Reserved quantity is released.
- Inventory becomes available again.

## Database

Database name:

mini_operations_erp

Import the database schema using:

database/schema.sql

Example:

```sql
SOURCE database/schema.sql;