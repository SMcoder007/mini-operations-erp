CREATE DATABASE IF NOT EXISTS mini_operations_erp;

USE mini_operations_erp;

-- =========================================
-- 1. USERS
-- =========================================

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('ADMIN', 'OPERATIONS_USER', 'SALES_USER') NOT NULL,
    location_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- 2. LOCATIONS
-- =========================================

CREATE TABLE locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    address VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- Add location relationship to users
-- =========================================

ALTER TABLE users
ADD CONSTRAINT fk_users_location
FOREIGN KEY (location_id)
REFERENCES locations(id)
ON DELETE SET NULL;

-- =========================================
-- 3. CATEGORIES
-- =========================================

CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- 4. ITEMS
-- =========================================

CREATE TABLE items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category_id INT NOT NULL,
    sku VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_items_category
    FOREIGN KEY (category_id)
    REFERENCES categories(id)
    ON DELETE RESTRICT
);

-- =========================================
-- 5. BATCHES
-- =========================================

CREATE TABLE batches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    batch_number VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_batches_item
    FOREIGN KEY (item_id)
    REFERENCES items(id)
    ON DELETE RESTRICT,

    UNIQUE(item_id, batch_number)
);

-- =========================================
-- 6. INVENTORY
-- =========================================

CREATE TABLE inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    location_id INT NOT NULL,
    batch_id INT NOT NULL,

    physical_quantity INT NOT NULL DEFAULT 0,
    reserved_quantity INT NOT NULL DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_inventory_item
    FOREIGN KEY (item_id)
    REFERENCES items(id)
    ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_location
    FOREIGN KEY (location_id)
    REFERENCES locations(id)
    ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_batch
    FOREIGN KEY (batch_id)
    REFERENCES batches(id)
    ON DELETE RESTRICT,

    CONSTRAINT chk_physical_quantity
    CHECK (physical_quantity >= 0),

    CONSTRAINT chk_reserved_quantity
    CHECK (reserved_quantity >= 0),

    UNIQUE(item_id, location_id, batch_id)
);

-- =========================================
-- 7. INVENTORY TRANSACTIONS
-- =========================================

CREATE TABLE inventory_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,

    inventory_id INT NOT NULL,

    transaction_type ENUM(
        'STOCK_IN',
        'STOCK_OUT',
        'RESERVATION',
        'RELEASE',
        'TRANSFER_OUT',
        'TRANSFER_IN'
    ) NOT NULL,

    quantity INT NOT NULL,

    reference_type VARCHAR(50),
    reference_id INT NULL,

    created_by INT NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_transaction_inventory
    FOREIGN KEY (inventory_id)
    REFERENCES inventory(id)
    ON DELETE RESTRICT,

    CONSTRAINT fk_transaction_user
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE RESTRICT,

    CONSTRAINT chk_transaction_quantity
    CHECK (quantity > 0)
);

-- =========================================
-- 8. WORK ORDERS
-- =========================================

CREATE TABLE work_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,

    work_order_id VARCHAR(50) NOT NULL UNIQUE,

    location_id INT NOT NULL,
    item_id INT NOT NULL,

    required_quantity INT NOT NULL,

    assigned_user_id INT NOT NULL,

    status ENUM(
        'ASSIGNED',
        'IN_PROGRESS',
        'COMPLETED'
    ) NOT NULL DEFAULT 'ASSIGNED',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_workorder_location
    FOREIGN KEY (location_id)
    REFERENCES locations(id)
    ON DELETE RESTRICT,

    CONSTRAINT fk_workorder_item
    FOREIGN KEY (item_id)
    REFERENCES items(id)
    ON DELETE RESTRICT,

    CONSTRAINT fk_workorder_user
    FOREIGN KEY (assigned_user_id)
    REFERENCES users(id)
    ON DELETE RESTRICT,

    CONSTRAINT chk_workorder_quantity
    CHECK (required_quantity > 0)
);

-- =========================================
-- 9. WORK ORDER MATERIALS
-- =========================================

CREATE TABLE work_order_materials (
    id INT AUTO_INCREMENT PRIMARY KEY,

    work_order_id INT NOT NULL,
    item_id INT NOT NULL,

    required_quantity INT NOT NULL,
    available_quantity INT NOT NULL DEFAULT 0,
    shortage_quantity INT NOT NULL DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_material_workorder
    FOREIGN KEY (work_order_id)
    REFERENCES work_orders(id)
    ON DELETE CASCADE,

    CONSTRAINT fk_material_item
    FOREIGN KEY (item_id)
    REFERENCES items(id)
    ON DELETE RESTRICT,

    CONSTRAINT chk_material_required
    CHECK (required_quantity > 0),

    CONSTRAINT chk_material_available
    CHECK (available_quantity >= 0),

    CONSTRAINT chk_material_shortage
    CHECK (shortage_quantity >= 0)
);

-- =========================================
-- 10. INTERNAL TRANSFERS
-- =========================================

CREATE TABLE internal_transfers (
    id INT AUTO_INCREMENT PRIMARY KEY,

    transfer_id VARCHAR(50) NOT NULL UNIQUE,

    source_location_id INT NOT NULL,
    destination_location_id INT NOT NULL,

    item_id INT NOT NULL,

    quantity INT NOT NULL,

    status ENUM(
        'REQUESTED',
        'DISPATCHED',
        'RECEIVED'
    ) NOT NULL DEFAULT 'REQUESTED',

    created_by INT NOT NULL,

    dispatched_at TIMESTAMP NULL,
    received_at TIMESTAMP NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_transfer_source
    FOREIGN KEY (source_location_id)
    REFERENCES locations(id)
    ON DELETE RESTRICT,

    CONSTRAINT fk_transfer_destination
    FOREIGN KEY (destination_location_id)
    REFERENCES locations(id)
    ON DELETE RESTRICT,

    CONSTRAINT fk_transfer_item
    FOREIGN KEY (item_id)
    REFERENCES items(id)
    ON DELETE RESTRICT,

    CONSTRAINT fk_transfer_user
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE RESTRICT,

    CONSTRAINT chk_transfer_quantity
    CHECK (quantity > 0),

    CONSTRAINT chk_different_locations
    CHECK (source_location_id <> destination_location_id)
);

-- =========================================
-- 11. CUSTOMERS
-- =========================================

CREATE TABLE customers (
    id INT AUTO_INCREMENT PRIMARY KEY,

    name VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(30),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- 12. CUSTOMER ORDERS
-- =========================================

CREATE TABLE customer_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,

    order_number VARCHAR(50) NOT NULL UNIQUE,

    customer_id INT NOT NULL,

    location_id INT NOT NULL,

    status ENUM(
        'CREATED',
        'RESERVED',
        'COMPLETED',
        'CANCELLED'
    ) NOT NULL DEFAULT 'CREATED',

    created_by INT NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_order_customer
    FOREIGN KEY (customer_id)
    REFERENCES customers(id)
    ON DELETE RESTRICT,

    CONSTRAINT fk_order_location
    FOREIGN KEY (location_id)
    REFERENCES locations(id)
    ON DELETE RESTRICT,

    CONSTRAINT fk_order_user
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE RESTRICT
);

-- =========================================
-- 13. CUSTOMER ORDER ITEMS
-- =========================================

CREATE TABLE customer_order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,

    order_id INT NOT NULL,
    item_id INT NOT NULL,

    quantity INT NOT NULL,
    reserved_quantity INT NOT NULL DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_orderitem_order
    FOREIGN KEY (order_id)
    REFERENCES customer_orders(id)
    ON DELETE CASCADE,

    CONSTRAINT fk_orderitem_item
    FOREIGN KEY (item_id)
    REFERENCES items(id)
    ON DELETE RESTRICT,

    CONSTRAINT chk_order_quantity
    CHECK (quantity > 0),

    CONSTRAINT chk_reserved_order_quantity
    CHECK (reserved_quantity >= 0)
);

-- =========================================
-- INDEXES
-- =========================================

CREATE INDEX idx_inventory_item
ON inventory(item_id);

CREATE INDEX idx_inventory_location
ON inventory(location_id);

CREATE INDEX idx_workorders_location
ON work_orders(location_id);

CREATE INDEX idx_transfers_source
ON internal_transfers(source_location_id);

CREATE INDEX idx_transfers_destination
ON internal_transfers(destination_location_id);

CREATE INDEX idx_orders_customer
ON customer_orders(customer_id);

-- =========================================
-- VIEW: AVAILABLE INVENTORY
-- =========================================

CREATE VIEW available_inventory AS
SELECT
    i.id,
    i.item_id,
    i.location_id,
    i.batch_id,
    i.physical_quantity,
    i.reserved_quantity,
    (i.physical_quantity - i.reserved_quantity)
        AS available_quantity
FROM inventory i;