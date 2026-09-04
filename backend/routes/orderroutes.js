const express = require("express");
const db = require("../config/db");
const authenticate = require("../middleware/auth");
const authorizeRoles = require("../middleware/role");

const router = express.Router();


// GET ALL CUSTOMER ORDERS
router.get("/", authenticate, (req, res) => {

    const sql = `
        SELECT
            o.id,
            o.order_number,
            c.name AS customer_name,
            locations.name AS location_name,
            o.status,
            o.created_at
        FROM customer_orders o
        JOIN customers c
            ON o.customer_id = c.id
        JOIN locations
            ON o.location_id = locations.id
        ORDER BY o.id DESC
    `;

    db.query(sql, (err, results) => {

        if (err) {
            return res.status(500).json({
                message: "Failed to fetch orders",
                error: err.message
            });
        }

        res.json(results);
    });
});


// CREATE CUSTOMER
router.post(
    "/customers",
    authenticate,
    authorizeRoles(
        "ADMIN",
        "SALES_USER"
    ),
    (req, res) => {

        const {
            name,
            email,
            phone
        } = req.body;

        if (!name) {
            return res.status(400).json({
                message: "Customer name is required"
            });
        }

        const sql = `
            INSERT INTO customers
            (name, email, phone)
            VALUES (?, ?, ?)
        `;

        db.query(
            sql,
            [name, email || null, phone || null],
            (err, result) => {

                if (err) {
                    return res.status(500).json({
                        message: "Could not create customer",
                        error: err.message
                    });
                }

                res.status(201).json({
                    message: "Customer created successfully",
                    customer_id: result.insertId
                });
            }
        );
    }
);


// CREATE ORDER + RESERVE STOCK
router.post(
    "/",
    authenticate,
    authorizeRoles(
        "ADMIN",
        "SALES_USER"
    ),
    (req, res) => {

        const {
            order_number,
            customer_id,
            location_id,
            item_id,
            quantity
        } = req.body;

        if (
            !order_number ||
            !customer_id ||
            !location_id ||
            !item_id ||
            !quantity ||
            quantity <= 0
        ) {
            return res.status(400).json({
                message:
                    "Order number, customer, location, item and quantity are required"
            });
        }

        db.beginTransaction((err) => {

            if (err) {
                return res.status(500).json({
                    message: "Could not start transaction"
                });
            }

            // Lock inventory row.
            const inventorySql = `
                SELECT
                    id,
                    physical_quantity,
                    reserved_quantity
                FROM inventory
                WHERE item_id = ?
                AND location_id = ?
                ORDER BY id
                LIMIT 1
                FOR UPDATE
            `;

            db.query(
                inventorySql,
                [item_id, location_id],
                (err, inventoryResults) => {

                    if (err) {
                        return db.rollback(() => {
                            res.status(500).json({
                                message:
                                    "Inventory lookup failed",
                                error: err.message
                            });
                        });
                    }

                    if (inventoryResults.length === 0) {
                        return db.rollback(() => {
                            res.status(400).json({
                                message:
                                    "No inventory available for this item at this location"
                            });
                        });
                    }

                    const inventory = inventoryResults[0];

                    const available =
                        Number(inventory.physical_quantity) -
                        Number(inventory.reserved_quantity);

                    // IMPORTANT:
                    // Prevent reservation beyond available stock.
                    if (Number(quantity) > available) {
                        return db.rollback(() => {
                            res.status(400).json({
                                message:
                                    "Cannot reserve more stock than available",
                                available_quantity: available
                            });
                        });
                    }

                    // Create order.
                    const orderSql = `
                        INSERT INTO customer_orders
                        (
                            order_number,
                            customer_id,
                            location_id,
                            status,
                            created_by
                        )
                        VALUES (?, ?, ?, 'CREATED', ?)
                    `;

                    db.query(
                        orderSql,
                        [
                            order_number,
                            customer_id,
                            location_id,
                            req.user.id
                        ],
                        (err, orderResult) => {

                            if (err) {

                                if (
                                    err.code ===
                                    "ER_DUP_ENTRY"
                                ) {
                                    return db.rollback(() => {
                                        res.status(409).json({
                                            message:
                                                "Order number already exists"
                                        });
                                    });
                                }

                                return db.rollback(() => {
                                    res.status(500).json({
                                        message:
                                            "Could not create order",
                                        error: err.message
                                    });
                                });
                            }

                            // Add order item.
                            const itemSql = `
                                INSERT INTO customer_order_items
                                (
                                    order_id,
                                    item_id,
                                    quantity,
                                    reserved_quantity
                                )
                                VALUES (?, ?, ?, ?)
                            `;

                            db.query(
                                itemSql,
                                [
                                    orderResult.insertId,
                                    item_id,
                                    quantity,
                                    quantity
                                ],
                                (err) => {

                                    if (err) {
                                        return db.rollback(() => {
                                            res.status(500).json({
                                                message:
                                                    "Could not create order item",
                                                error: err.message
                                            });
                                        });
                                    }

                                    // Increase reserved quantity.
                                    const reserveSql = `
                                        UPDATE inventory
                                        SET reserved_quantity =
                                            reserved_quantity + ?
                                        WHERE id = ?
                                    `;

                                    db.query(
                                        reserveSql,
                                        [
                                            quantity,
                                            inventory.id
                                        ],
                                        (err) => {

                                            if (err) {
                                                return db.rollback(() => {
                                                    res.status(500).json({
                                                        message:
                                                            "Could not reserve inventory",
                                                        error: err.message
                                                    });
                                                });
                                            }

                                            // Record reservation transaction.
                                            const transactionSql = `
                                                INSERT INTO inventory_transactions
                                                (
                                                    inventory_id,
                                                    transaction_type,
                                                    quantity,
                                                    reference_type,
                                                    reference_id,
                                                    created_by
                                                )
                                                VALUES
                                                (
                                                    ?,
                                                    'RESERVATION',
                                                    ?,
                                                    'CUSTOMER_ORDER',
                                                    ?,
                                                    ?
                                                )
                                            `;

                                            db.query(
                                                transactionSql,
                                                [
                                                    inventory.id,
                                                    quantity,
                                                    orderResult.insertId,
                                                    req.user.id
                                                ],
                                                (err) => {

                                                    if (err) {
                                                        return db.rollback(() => {
                                                            res.status(500).json({
                                                                message:
                                                                    "Could not record reservation",
                                                                error: err.message
                                                            });
                                                        });
                                                    }

                                                    // Update order status.
                                                    const statusSql = `
                                                        UPDATE customer_orders
                                                        SET status = 'RESERVED'
                                                        WHERE id = ?
                                                    `;

                                                    db.query(
                                                        statusSql,
                                                        [
                                                            orderResult.insertId
                                                        ],
                                                        (err) => {

                                                            if (err) {
                                                                return db.rollback(() => {
                                                                    res.status(500).json({
                                                                        message:
                                                                            "Could not update order status"
                                                                    });
                                                                });
                                                            }

                                                            db.commit((err) => {

                                                                if (err) {
                                                                    return db.rollback(() => {
                                                                        res.status(500).json({
                                                                            message:
                                                                                "Commit failed"
                                                                        });
                                                                    });
                                                                }

                                                                res.status(201).json({
                                                                    message:
                                                                        "Order created and stock reserved successfully",
                                                                    order_id:
                                                                        orderResult.insertId,
                                                                    reserved_quantity:
                                                                        quantity,
                                                                    remaining_available_quantity:
                                                                        available -
                                                                        Number(quantity)
                                                                });
                                                            });
                                                        }
                                                    );
                                                }
                                            );
                                        }
                                    );
                                }
                            );
                        }
                    );
                }
            );
        });
    }
);


// CANCEL ORDER + RELEASE RESERVATION
router.patch(
    "/:id/cancel",
    authenticate,
    authorizeRoles(
        "ADMIN",
        "SALES_USER"
    ),
    (req, res) => {

        db.beginTransaction((err) => {

            if (err) {
                return res.status(500).json({
                    message: "Could not start transaction"
                });
            }

            const orderSql = `
                SELECT *
                FROM customer_orders
                WHERE id = ?
                FOR UPDATE
            `;

            db.query(
                orderSql,
                [req.params.id],
                (err, orders) => {

                    if (err) {
                        return db.rollback(() => {
                            res.status(500).json({
                                message:
                                    "Order lookup failed"
                            });
                        });
                    }

                    if (orders.length === 0) {
                        return db.rollback(() => {
                            res.status(404).json({
                                message:
                                    "Order not found"
                            });
                        });
                    }

                    const order = orders[0];

                    if (order.status === "CANCELLED") {
                        return db.rollback(() => {
                            res.status(400).json({
                                message:
                                    "Order is already cancelled"
                            });
                        });
                    }

                    const itemsSql = `
                        SELECT *
                        FROM customer_order_items
                        WHERE order_id = ?
                        FOR UPDATE
                    `;

                    db.query(
                        itemsSql,
                        [order.id],
                        (err, orderItems) => {

                            if (err) {
                                return db.rollback(() => {
                                    res.status(500).json({
                                        message:
                                            "Could not find order items"
                                    });
                                });
                            }

                            const releaseNext = (index) => {

                                if (index >= orderItems.length) {

                                    const updateOrderSql = `
                                        UPDATE customer_orders
                                        SET status = 'CANCELLED'
                                        WHERE id = ?
                                    `;

                                    return db.query(
                                        updateOrderSql,
                                        [order.id],
                                        (err) => {

                                            if (err) {
                                                return db.rollback(() => {
                                                    res.status(500).json({
                                                        message:
                                                            "Could not cancel order"
                                                    });
                                                });
                                            }

                                            db.commit((err) => {

                                                if (err) {
                                                    return db.rollback(() => {
                                                        res.status(500).json({
                                                            message:
                                                                "Commit failed"
                                                        });
                                                    });
                                                }

                                                res.json({
                                                    message:
                                                        "Order cancelled and reservation released successfully"
                                                });
                                            });
                                        }
                                    );
                                }

                                const orderItem =
                                    orderItems[index];

                                const inventorySql = `
                                    SELECT id
                                    FROM inventory
                                    WHERE item_id = ?
                                    AND location_id = ?
                                    AND reserved_quantity >= ?
                                    ORDER BY id
                                    LIMIT 1
                                    FOR UPDATE
                                `;

                                db.query(
                                    inventorySql,
                                    [
                                        orderItem.item_id,
                                        order.location_id,
                                        orderItem.reserved_quantity
                                    ],
                                    (err, inventoryResults) => {

                                        if (err) {
                                            return db.rollback(() => {
                                                res.status(500).json({
                                                    message:
                                                        "Inventory lookup failed"
                                                });
                                            });
                                        }

                                        if (
                                            inventoryResults.length === 0
                                        ) {
                                            return db.rollback(() => {
                                                res.status(400).json({
                                                    message:
                                                        "Could not release reservation"
                                                });
                                            });
                                        }

                                        const inventoryId =
                                            inventoryResults[0].id;

                                        const releaseSql = `
                                            UPDATE inventory
                                            SET reserved_quantity =
                                                reserved_quantity - ?
                                            WHERE id = ?
                                        `;

                                        db.query(
                                            releaseSql,
                                            [
                                                orderItem.reserved_quantity,
                                                inventoryId
                                            ],
                                            (err) => {

                                                if (err) {
                                                    return db.rollback(() => {
                                                        res.status(500).json({
                                                            message:
                                                                "Could not release stock"
                                                        });
                                                    });
                                                }

                                                const transactionSql = `
                                                    INSERT INTO inventory_transactions
                                                    (
                                                        inventory_id,
                                                        transaction_type,
                                                        quantity,
                                                        reference_type,
                                                        reference_id,
                                                        created_by
                                                    )
                                                    VALUES
                                                    (
                                                        ?,
                                                        'RELEASE',
                                                        ?,
                                                        'CUSTOMER_ORDER',
                                                        ?,
                                                        ?
                                                    )
                                                `;

                                                db.query(
                                                    transactionSql,
                                                    [
                                                        inventoryId,
                                                        orderItem.reserved_quantity,
                                                        order.id,
                                                        req.user.id
                                                    ],
                                                    (err) => {

                                                        if (err) {
                                                            return db.rollback(() => {
                                                                res.status(500).json({
                                                                    message:
                                                                        "Could not record release"
                                                                });
                                                            });
                                                        }

                                                        releaseNext(
                                                            index + 1
                                                        );
                                                    }
                                                );
                                            }
                                        );
                                    }
                                );
                            };

                            releaseNext(0);
                        }
                    );
                }
            );
        });
    }
);


module.exports = router;