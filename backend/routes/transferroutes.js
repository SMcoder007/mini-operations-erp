const express = require("express");
const db = require("../config/db");
const authenticate = require("../middleware/auth");
const authorizeRoles = require("../middleware/role");

const router = express.Router();

// GET ALL TRANSFERS
router.get("/", authenticate, (req, res) => {
    const sql = `
        SELECT
            t.id,
            t.transfer_id,
            sl.name AS source_location,
            dl.name AS destination_location,
            i.name AS item_name,
            i.sku,
            t.quantity,
            t.status,
            t.dispatched_at,
            t.received_at,
            u.name AS created_by,
            t.created_at
        FROM internal_transfers t
        JOIN locations sl
            ON t.source_location_id = sl.id
        JOIN locations dl
            ON t.destination_location_id = dl.id
        JOIN items i
            ON t.item_id = i.id
        JOIN users u
            ON t.created_by = u.id
        ORDER BY t.id DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({
                message: "Failed to fetch transfers",
                error: err.message
            });
        }

        res.json(results);
    });
});


// CREATE TRANSFER
router.post(
    "/",
    authenticate,
    authorizeRoles("ADMIN", "OPERATIONS_USER"),
    (req, res) => {

        const {
            transfer_id,
            source_location_id,
            destination_location_id,
            item_id,
            quantity
        } = req.body;

        if (
            !transfer_id ||
            !source_location_id ||
            !destination_location_id ||
            !item_id ||
            !quantity ||
            quantity <= 0
        ) {
            return res.status(400).json({
                message: "All transfer fields are required"
            });
        }

        if (
            Number(source_location_id) ===
            Number(destination_location_id)
        ) {
            return res.status(400).json({
                message: "Source and destination locations must be different"
            });
        }

        const sql = `
            INSERT INTO internal_transfers
            (
                transfer_id,
                source_location_id,
                destination_location_id,
                item_id,
                quantity,
                status,
                created_by
            )
            VALUES (?, ?, ?, ?, ?, 'REQUESTED', ?)
        `;

        db.query(
            sql,
            [
                transfer_id,
                source_location_id,
                destination_location_id,
                item_id,
                quantity,
                req.user.id
            ],
            (err, result) => {

                if (err) {

                    if (err.code === "ER_DUP_ENTRY") {
                        return res.status(409).json({
                            message: "Transfer ID already exists"
                        });
                    }

                    return res.status(500).json({
                        message: "Could not create transfer",
                        error: err.message
                    });
                }

                res.status(201).json({
                    message: "Transfer request created successfully",
                    transfer_id: result.insertId
                });
            }
        );
    }
);


// DISPATCH TRANSFER
router.patch(
    "/:id/dispatch",
    authenticate,
    authorizeRoles("ADMIN", "OPERATIONS_USER"),
    (req, res) => {

        const transferId = req.params.id;

        db.beginTransaction((err) => {

            if (err) {
                return res.status(500).json({
                    message: "Could not start transaction",
                    error: err.message
                });
            }

            // Lock transfer row
            const transferSql = `
                SELECT
                    id,
                    source_location_id,
                    destination_location_id,
                    item_id,
                    quantity,
                    status
                FROM internal_transfers
                WHERE id = ?
                FOR UPDATE
            `;

            db.query(
                transferSql,
                [transferId],
                (err, transfers) => {

                    if (err) {
                        return db.rollback(() => {
                            res.status(500).json({
                                message: "Transfer lookup failed",
                                error: err.message
                            });
                        });
                    }

                    if (transfers.length === 0) {
                        return db.rollback(() => {
                            res.status(404).json({
                                message: "Transfer not found"
                            });
                        });
                    }

                    const transfer = transfers[0];

                    if (transfer.status !== "REQUESTED") {
                        return db.rollback(() => {
                            res.status(400).json({
                                message: "Only requested transfers can be dispatched"
                            });
                        });
                    }

                    // Find source inventory
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
                        [
                            transfer.item_id,
                            transfer.source_location_id
                        ],
                        (err, inventoryResults) => {

                            if (err) {
                                return db.rollback(() => {
                                    res.status(500).json({
                                        message: "Source inventory lookup failed",
                                        error: err.message
                                    });
                                });
                            }

                            if (inventoryResults.length === 0) {
                                return db.rollback(() => {
                                    res.status(400).json({
                                        message: "No source inventory found"
                                    });
                                });
                            }

                            const inventory = inventoryResults[0];

                            const available =
                                inventory.physical_quantity -
                                inventory.reserved_quantity;

                            // Prevent negative inventory
                            if (transfer.quantity > available) {
                                return db.rollback(() => {
                                    res.status(400).json({
                                        message: "Cannot transfer more stock than available",
                                        available_quantity: available
                                    });
                                });
                            }

                            // Decrease source stock
                            const updateSql = `
                                UPDATE inventory
                                SET physical_quantity =
                                    physical_quantity - ?
                                WHERE id = ?
                            `;

                            db.query(
                                updateSql,
                                [
                                    transfer.quantity,
                                    inventory.id
                                ],
                                (err) => {

                                    if (err) {
                                        return db.rollback(() => {
                                            res.status(500).json({
                                                message: "Could not decrease source stock",
                                                error: err.message
                                            });
                                        });
                                    }

                                    // Record transfer out
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
                                        (?, 'TRANSFER_OUT', ?, 'TRANSFER', ?, ?)
                                    `;

                                    db.query(
                                        transactionSql,
                                        [
                                            inventory.id,
                                            transfer.quantity,
                                            transfer.id,
                                            req.user.id
                                        ],
                                        (err) => {

                                            if (err) {
                                                return db.rollback(() => {
                                                    res.status(500).json({
                                                        message: "Could not record transfer out",
                                                        error: err.message
                                                    });
                                                });
                                            }

                                            // Change status to DISPATCHED
                                            const statusSql = `
                                                UPDATE internal_transfers
                                                SET
                                                    status = 'DISPATCHED',
                                                    dispatched_at = CURRENT_TIMESTAMP
                                                WHERE id = ?
                                            `;

                                            db.query(
                                                statusSql,
                                                [transfer.id],
                                                (err) => {

                                                    if (err) {
                                                        return db.rollback(() => {
                                                            res.status(500).json({
                                                                message: "Could not update transfer status",
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
                                                            message: "Transfer dispatched successfully",
                                                            status: "DISPATCHED"
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
        });
    }
);


// RECEIVE TRANSFER
router.patch(
    "/:id/receive",
    authenticate,
    authorizeRoles("ADMIN", "OPERATIONS_USER"),
    (req, res) => {

        const transferId = req.params.id;

        db.beginTransaction((err) => {

            if (err) {
                return res.status(500).json({
                    message: "Could not start transaction",
                    error: err.message
                });
            }

            // Lock transfer
            const transferSql = `
                SELECT
                    id,
                    source_location_id,
                    destination_location_id,
                    item_id,
                    quantity,
                    status
                FROM internal_transfers
                WHERE id = ?
                FOR UPDATE
            `;

            db.query(
                transferSql,
                [transferId],
                (err, transfers) => {

                    if (err) {
                        return db.rollback(() => {
                            res.status(500).json({
                                message: "Transfer lookup failed",
                                error: err.message
                            });
                        });
                    }

                    if (transfers.length === 0) {
                        return db.rollback(() => {
                            res.status(404).json({
                                message: "Transfer not found"
                            });
                        });
                    }

                    const transfer = transfers[0];

                    // Prevent receiving twice
                    if (transfer.status === "RECEIVED") {
                        return db.rollback(() => {
                            res.status(400).json({
                                message: "Transfer has already been received"
                            });
                        });
                    }

                    if (transfer.status !== "DISPATCHED") {
                        return db.rollback(() => {
                            res.status(400).json({
                                message: "Only dispatched transfers can be received"
                            });
                        });
                    }

                    // Find destination inventory
                    const inventorySql = `
                        SELECT id
                        FROM inventory
                        WHERE item_id = ?
                        AND location_id = ?
                        ORDER BY id
                        LIMIT 1
                        FOR UPDATE
                    `;

                    db.query(
                        inventorySql,
                        [
                            transfer.item_id,
                            transfer.destination_location_id
                        ],
                        (err, inventoryResults) => {

                            if (err) {
                                return db.rollback(() => {
                                    res.status(500).json({
                                        message: "Destination inventory lookup failed",
                                        error: err.message
                                    });
                                });
                            }

                            if (inventoryResults.length > 0) {

                                const inventoryId =
                                    inventoryResults[0].id;

                                const updateSql = `
                                    UPDATE inventory
                                    SET physical_quantity =
                                        physical_quantity + ?
                                    WHERE id = ?
                                `;

                                db.query(
                                    updateSql,
                                    [
                                        transfer.quantity,
                                        inventoryId
                                    ],
                                    (err) => {

                                        if (err) {
                                            return db.rollback(() => {
                                                res.status(500).json({
                                                    message: "Could not increase destination stock",
                                                    error: err.message
                                                });
                                            });
                                        }

                                        recordTransferIn(inventoryId);
                                    }
                                );

                            } else {

                                // Find a batch for this item
                                const batchSql = `
                                    SELECT id
                                    FROM batches
                                    WHERE item_id = ?
                                    ORDER BY id
                                    LIMIT 1
                                `;

                                db.query(
                                    batchSql,
                                    [transfer.item_id],
                                    (err, batches) => {

                                        if (err) {
                                            return db.rollback(() => {
                                                res.status(500).json({
                                                    message: "Batch lookup failed",
                                                    error: err.message
                                                });
                                            });
                                        }

                                        if (batches.length === 0) {
                                            return db.rollback(() => {
                                                res.status(400).json({
                                                    message: "No batch found for this item"
                                                });
                                            });
                                        }

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
                                                transfer.item_id,
                                                transfer.destination_location_id,
                                                batches[0].id,
                                                transfer.quantity
                                            ],
                                            (err, result) => {

                                                if (err) {
                                                    return db.rollback(() => {
                                                        res.status(500).json({
                                                            message: "Could not create destination inventory",
                                                            error: err.message
                                                        });
                                                    });
                                                }

                                                recordTransferIn(
                                                    result.insertId
                                                );
                                            }
                                        );
                                    }
                                );
                            }

                            function recordTransferIn(inventoryId) {

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
                                    (?, 'TRANSFER_IN', ?, 'TRANSFER', ?, ?)
                                `;

                                db.query(
                                    transactionSql,
                                    [
                                        inventoryId,
                                        transfer.quantity,
                                        transfer.id,
                                        req.user.id
                                    ],
                                    (err) => {

                                        if (err) {
                                            return db.rollback(() => {
                                                res.status(500).json({
                                                    message: "Could not record transfer in",
                                                    error: err.message
                                                });
                                            });
                                        }

                                        const statusSql = `
                                            UPDATE internal_transfers
                                            SET
                                                status = 'RECEIVED',
                                                received_at = CURRENT_TIMESTAMP
                                            WHERE id = ?
                                        `;

                                        db.query(
                                            statusSql,
                                            [transfer.id],
                                            (err) => {

                                                if (err) {
                                                    return db.rollback(() => {
                                                        res.status(500).json({
                                                            message: "Could not update transfer status",
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
                                                        message: "Transfer received successfully",
                                                        status: "RECEIVED"
                                                    });
                                                });
                                            }
                                        );
                                    }
                                );
                            }
                        }
                    );
                }
            );
        });
    }
);


module.exports = router;