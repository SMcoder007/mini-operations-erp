# Mini Operations ERP

A production-oriented full-stack Operations ERP system for managing inventory, work orders, internal stock transfers, and customer reservations with authentication, role-based authorization, validation, and transactional database operations.

---

## 1. Project Overview

Mini Operations ERP is a full-stack web application designed to manage day-to-day warehouse and operations activities.

The system follows this operational flow:

**Inventory → Work Order → Stock Check → Internal Transfer / Shortage → Customer Reservation**

The application provides:

- User authentication
- Role-based access control
- Inventory management
- Stock-in and stock-out operations
- Work order management
- Material shortage calculation
- Internal stock transfers
- Customer management
- Customer order creation
- Inventory reservation
- Order cancellation and reservation release
- Database transactions
- Concurrent reservation protection
- Input validation
- Error handling
- REST APIs
- Responsive frontend dashboard

---

## 2. Main Objectives

The main objectives of the project are:

1. Maintain accurate inventory quantities.
2. Prevent negative inventory.
3. Prevent reservations beyond available stock.
4. Prevent transfers beyond available stock.
5. Track work orders and material shortages.
6. Manage internal warehouse transfers.
7. Ensure destination inventory increases only after transfer receipt.
8. Provide customer order and reservation management.
9. Implement authentication and role-based authorization.
10. Use database transactions for critical inventory operations.

---

## 3. Technology Stack

### Frontend

- React.js
- Vite
- JavaScript
- HTML5
- CSS3
- Fetch API

### Backend

- Node.js
- Express.js
- REST API
- JWT Authentication
- bcryptjs
- CORS
- dotenv

### Database

- MySQL
- MySQL Workbench

### Development Tools

- Visual Studio Code
- Postman
- Git
- GitHub

---

## 4. User Roles

The system supports three roles.

### Admin

Admin has the highest level of access.

Admin can:

- Login
- View inventory
- Perform stock operations
- Create work orders
- Update work order status
- Manage internal transfers
- Create customer orders
- Cancel customer orders

### Operations User

Operations users mainly manage inventory and warehouse operations.

Operations users can:

- View inventory
- Perform stock-in
- Perform stock-out
- Create transfers
- Dispatch transfers
- Receive transfers
- View work orders
- Update work order status

### Sales User

Sales users mainly manage customers and customer orders.

Sales users can:

- Login
- View inventory
- Create customers
- Create customer orders
- Reserve inventory
- Cancel orders
- Release reserved inventory

Backend authorization is enforced using JWT authentication and role-based middleware.

---

## 5. Application Flow

The main business flow is:

```text
User Login
     |
     v
Dashboard
     |
     +----------------------+
     |                      |
     v                      v
Inventory              Work Orders
     |                      |
     |                      v
     |                Stock Requirement
     |                      |
     |             +--------+--------+
     |             |                 |
     |             v                 v
     |        Stock Available     Shortage
     |                               |
     |                               v
     |                         Internal Transfer
     |
     v
Customer Order
     |
     v
Stock Availability Check
     |
     v
Reservation
     |
     v
Order Cancellation
     |
     v
Reservation Release
mini-operations-erp/
│
├── backend/
│   ├── config/
│   │   └── db.js
│   │
│   ├── controllers/
│   │
│   ├── middleware/
│   │   ├── auth.js
│   │   └── role.js
│   │
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── inventoryRoutes.js
│   │   ├── workOrderRoutes.js
│   │   ├── transferRoutes.js
│   │   └── orderRoutes.js
│   │
│   ├── .env
│   ├── package.json
│   ├── package-lock.json
│   └── server.js
│
├── database/
│   └── schema.sql
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── docs/
│   └── ER-Diagram.png
│
├── README.md
└── LICENSE
Users
  |
  +---- Work Orders
  |
  +---- Orders

Categories
  |
  +---- Items
           |
           +---- Batches
           |
           +---- Inventory

Locations
  |
  +---- Inventory
  |
  +---- Work Orders
  |
  +---- Transfers
  |
  +---- Orders

Customers
  |
  +---- Orders
           |
           +---- Order Items
Available Quantity = Physical Quantity - Reserved Quantity
POST /api/inventory/stock-in
{
  "item_id": 1,
  "location_id": 1,
  "batch_id": 1,
  "quantity": 100
}
POST /api/inventory/stock-out
{
  "inventory_id": 3,
  "quantity": 20
}
Authentication
      |
      v
JWT Verification
      |
      v
User Role
      |
      +---- ADMIN
      |
      +---- OPERATIONS_USER
      |
      +---- SALES_USER
      {
  "work_order_id": "WO-001",
  "location_id": 1,
  "item_id": 1,
  "required_quantity": 30,
  "assigned_user_id": 1
}
ASSIGNED
IN_PROGRESS
COMPLETED
Physical Quantity = 20
Reserved Quantity = 10

Available Quantity = 20 - 10
                   = 10
BEGIN TRANSACTION
       |
       v
Lock Inventory Row
       |
       v
Check Available Quantity
       |
       +---- Insufficient
       |        |
       |        v
       |      ROLLBACK
       |
       +---- Sufficient
                |
                v
        Create Order
                |
                v
        Increase Reserved Qty
                |
                v
        Record Transaction
                |
                v
             COMMIT
Before Cancellation:

Physical = 20
Reserved = 10
Available = 10

After Cancellation:

Physical = 20
Reserved = 0
Available = 20
36. Future Improvements

Possible future improvements include:

Swagger/OpenAPI documentation
Refresh tokens
Password reset
Advanced inventory filtering
Multiple batches per reservation
Partial transfer receipt
Damaged stock management
Audit log dashboard
Pagination
Search and sorting
Advanced analytics
Docker deployment
Cloud database
Production deployment
Automated unit and integration tests
37. Conclusion

Mini Operations ERP demonstrates a complete full-stack ERP workflow with frontend, backend APIs, relational database integration, authentication, authorization, inventory business rules, transactions, and reservation management.

The system focuses on maintaining inventory correctness while supporting realistic operational workflows such as work orders, internal transfers, and customer reservations.

The application has been tested against the major business rules required for the technical case study.