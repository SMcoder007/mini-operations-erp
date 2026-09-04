const express = require("express");
const db = require("../config/db");
const authenticate = require("../middleware/auth");
const authorizeRoles = require("../middleware/role");

const router = express.Router();

// GET INVENTORY
router.get("/", authenticate, (req, res) => {
    const sql = `
        SELECT
            inventory.id,
            items.name AS item_name,
            items.sku,
            categories.name AS category_name,
            locations.name AS location_name,
            batches.batch_number,
            inventory.physical_quantity,
            inventory.reserved_quantity,
            (inventory.physical_quantity - inventory.reserved_quantity)
                AS available_quantity
        FROM inventory
        JOIN items ON inventory.item_id = items.id
        JOIN categories ON items.category_id = categories.id
        JOIN locations ON inventory.location_id = locations.id
        JOIN batches ON inventory.batch_id = batches.id
        ORDER BY inventory.id DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({
                message: "Failed to fetch inventory",
                error: err.message
            });
        }

        res.json(results);
    });
});


// STOCK IN
router.post(
    "/stock-in",
    authenticate,
    authorizeRoles("ADMIN", "OPERATIONS_USER"),
    (req, res) => {

        const {
            item_id,
            location_id,
            batch_id,
            quantity
        } = req.body;

        if (
            !item_id ||
            !location_id ||
            !batch_id ||
            !quantity ||
            quantity <= 0
        ) {
            return res.status(400).json({
                message: "Valid item, location, batch and quantity are required"
            });
        }

        db.beginTransaction((err) => {
            if (err) {
                return res.status(500).json({
                    message: "Could not start transaction",
                    error: err.message
                });
            }

            const sql = `
                SELECT id
                FROM inventory
                WHERE item_id = ?
                AND location_id = ?
                AND batch_id = ?
                FOR UPDATE
            `;

            db.query(
                sql,
                [item_id, location_id, batch_id],
                (err, results) => {

                    if (err) {
                        return db.rollback(() => {
                            res.status(500).json({
                                message: "Inventory lookup failed",
                                error: err.message
                            });
                        });
                    }

                    if (results.length > 0) {

                        const inventoryId = results[0].id;

                        const updateSql = `
                            UPDATE inventory
                            SET physical_quantity =
                                physical_quantity + ?
                            WHERE id = ?
                        `;

                        db.query(
                            updateSql,
                            [quantity, inventoryId],
                            (err) => {

                                if (err) {
                                    return db.rollback(() => {
                                        res.status(500).json({
                                            message: "Could not update inventory",
                                            error: err.message
                                        });
                                    });
                                }

                                recordTransaction(inventoryId);
                            }
                        );

                    } else {

                        const insertSql = `
                            INSERT INTO inventory
                            (
                                item_id,
                                location_id,
                                batch_id,
                                physical_quantity,
                                reserved_quantity
                            )
                            VALUES (?, ?, ?, ?, 0)
                        `;

                        db.query(
                            insertSql,
                            [
                                item_id,
                                location_id,
                                batch_id,
                                quantity
                            ],
                            (err, result) => {

                                if (err) {
                                    return db.rollback(() => {
                                        res.status(500).json({
                                            message: "Could not create inventory",
                                            error: err.message
                                        });
                                    });
                                }

                                recordTransaction(result.insertId);
                            }
                        );
                    }

                    function recordTransaction(inventoryId) {

                        const transactionSql = `
                            INSERT INTO inventory_transactions
                            (
                                inventory_id,
                                transaction_type,
                                quantity,
                                reference_type,
                                created_by
                            )
                            VALUES (?, 'STOCK_IN', ?, 'STOCK_IN', ?)
                        `;

                        db.query(
                            transactionSql,
                            [
                                inventoryId,
                                quantity,
                                req.user.id
                            ],
                            (err) => {

                                if (err) {
                                    return db.rollback(() => {
                                        res.status(500).json({
                                            message: "Transaction record failed",
                                            error: err.message
                                        });
                                    });
                                }

                                db.commit((err) => {

                                    if (err) {
                                        return db.rollback(() => {
                                            res.status(500).json({
                                                message: "Commit failed",
                                                error: err.message
                                            });
                                        });
                                    }

                                    res.status(201).json({
                                        message: "Stock added successfully"
                                    });
                                });
                            }
                        );
                    }
                }
            );
        });
    }
);


// STOCK OUT
router.post(
    "/stock-out",
    authenticate,
    authorizeRoles("ADMIN", "OPERATIONS_USER"),
    (req, res) => {

        const {
            inventory_id,
            quantity
        } = req.body;

        if (
            !inventory_id ||
            !quantity ||
            quantity <= 0
        ) {
            return res.status(400).json({
                message: "Valid inventory ID and quantity are required"
            });
        }

        db.beginTransaction((err) => {

            if (err) {
                return res.status(500).json({
                    message: "Could not start transaction",
                    error: err.message
                });
            }

            const sql = `
                SELECT
                    physical_quantity,
                    reserved_quantity
                FROM inventory
                WHERE id = ?
                FOR UPDATE
            `;

            db.query(
                sql,
                [inventory_id],
                (err, results) => {

                    if (err) {
                        return db.rollback(() => {
                            res.status(500).json({
                                message: "Inventory lookup failed",
                                error: err.message
                            });
                        });
                    }

                    if (results.length === 0) {
                        return db.rollback(() => {
                            res.status(404).json({
                                message: "Inventory record not found"
                            });
                        });
                    }

                    const inventory = results[0];

                    const available =
                        inventory.physical_quantity -
                        inventory.reserved_quantity;

                    if (quantity > available) {
                        return db.rollback(() => {
                            res.status(400).json({
                                message: "Cannot remove more stock than available"
                            });
                        });
                    }

                    const updateSql = `
                        UPDATE inventory
                        SET physical_quantity =
                            physical_quantity - ?
                        WHERE id = ?
                    `;

                    db.query(
                        updateSql,
                        [quantity, inventory_id],
                        (err) => {

                            if (err) {
                                return db.rollback(() => {
                                    res.status(500).json({
                                        message: "Could not remove stock",
                                        error: err.message
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
                                    created_by
                                )
                                VALUES (?, 'STOCK_OUT', ?, 'STOCK_OUT', ?)
                            `;

                            db.query(
                                transactionSql,
                                [
                                    inventory_id,
                                    quantity,
                                    req.user.id
                                ],
                                (err) => {

                                    if (err) {
                                        return db.rollback(() => {
                                            res.status(500).json({
                                                message: "Transaction record failed",
                                                error: err.message
                                            });
                                        });
                                    }

                                    db.commit((err) => {

                                        if (err) {
                                            return db.rollback(() => {
                                                res.status(500).json({
                                                    message: "Commit failed",
                                                    error: err.message
                                                });
                                            });
                                        }

                                        res.json({
                                            message: "Stock removed successfully"
                                        });
                                    });
                                }
                            );
                        }
                    );
                }
            );
        });
    }
);

module.exports = router;