const express = require("express");
const db = require("../config/db");
const authenticate = require("../middleware/auth");
const authorizeRoles = require("../middleware/role");

const router = express.Router();

// GET ALL WORK ORDERS
router.get("/", authenticate, (req, res) => {
    const sql = `
        SELECT
            wo.id,
            wo.work_order_id,
            locations.name AS location_name,
            items.name AS item_name,
            items.sku,
            wo.required_quantity,
            users.name AS assigned_user,
            wo.status,
            wo.created_at
        FROM work_orders wo
        JOIN locations ON wo.location_id = locations.id
        JOIN items ON wo.item_id = items.id
        JOIN users ON wo.assigned_user_id = users.id
        ORDER BY wo.id DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({
                message: "Failed to fetch work orders",
                error: err.message
            });
        }

        res.json(results);
    });
});


// CREATE WORK ORDER
// ADMIN ONLY
router.post(
    "/",
    authenticate,
    authorizeRoles("ADMIN"),
    (req, res) => {

        const {
            work_order_id,
            location_id,
            item_id,
            required_quantity,
            assigned_user_id
        } = req.body;

        if (
            !work_order_id ||
            !location_id ||
            !item_id ||
            !required_quantity ||
            !assigned_user_id ||
            required_quantity <= 0
        ) {
            return res.status(400).json({
                message: "All work order fields are required"
            });
        }

        const sql = `
            INSERT INTO work_orders
            (
                work_order_id,
                location_id,
                item_id,
                required_quantity,
                assigned_user_id,
                status
            )
            VALUES (?, ?, ?, ?, ?, 'ASSIGNED')
        `;

        db.query(
            sql,
            [
                work_order_id,
                location_id,
                item_id,
                required_quantity,
                assigned_user_id
            ],
            (err, result) => {

                if (err) {
                    if (err.code === "ER_DUP_ENTRY") {
                        return res.status(409).json({
                            message: "Work Order ID already exists"
                        });
                    }

                    return res.status(500).json({
                        message: "Could not create work order",
                        error: err.message
                    });
                }

                // Calculate shortage automatically
                const inventorySql = `
                    SELECT
                        COALESCE(
                            SUM(
                                physical_quantity -
                                reserved_quantity
                            ),
                            0
                        ) AS available_quantity
                    FROM inventory
                    WHERE item_id = ?
                    AND location_id = ?
                `;

                db.query(
                    inventorySql,
                    [item_id, location_id],
                    (err, inventoryResults) => {

                        if (err) {
                            return res.status(500).json({
                                message: "Work order created but shortage calculation failed",
                                error: err.message
                            });
                        }

                        const available =
                            Number(
                                inventoryResults[0].available_quantity
                            );

                        const shortage =
                            Math.max(
                                Number(required_quantity) - available,
                                0
                            );

                        const materialSql = `
                            INSERT INTO work_order_materials
                            (
                                work_order_id,
                                item_id,
                                required_quantity,
                                available_quantity,
                                shortage_quantity
                            )
                            VALUES (?, ?, ?, ?, ?)
                        `;

                        db.query(
                            materialSql,
                            [
                                result.insertId,
                                item_id,
                                required_quantity,
                                available,
                                shortage
                            ],
                            (err) => {

                                if (err) {
                                    return res.status(500).json({
                                        message: "Work order created but material calculation failed",
                                        error: err.message
                                    });
                                }

                                res.status(201).json({
                                    message: "Work order created successfully",
                                    work_order_id: result.insertId,
                                    available_quantity: available,
                                    shortage_quantity: shortage
                                });
                            }
                        );
                    }
                );
            }
        );
    }
);


// UPDATE WORK ORDER STATUS
router.patch(
    "/:id/status",
    authenticate,
    authorizeRoles(
        "ADMIN",
        "OPERATIONS_USER"
    ),
    (req, res) => {

        const { status } = req.body;

        const allowedStatuses = [
            "ASSIGNED",
            "IN_PROGRESS",
            "COMPLETED"
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                message: "Invalid work order status"
            });
        }

        const sql = `
            UPDATE work_orders
            SET status = ?
            WHERE id = ?
        `;

        db.query(
            sql,
            [status, req.params.id],
            (err, result) => {

                if (err) {
                    return res.status(500).json({
                        message: "Could not update work order",
                        error: err.message
                    });
                }

                if (result.affectedRows === 0) {
                    return res.status(404).json({
                        message: "Work order not found"
                    });
                }

                res.json({
                    message: "Work order status updated successfully"
                });
            }
        );
    }
);


module.exports = router;