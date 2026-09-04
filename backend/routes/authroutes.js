const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const db = require("../config/db");

const router = express.Router();

// REGISTER
// Public registration creates only SALES_USER.
// Admin/Operations accounts should be created by an authorized administrator.
router.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Name, email and password are required"
            });
        }

        db.query(
            "SELECT id FROM users WHERE email = ?",
            [email],
            async (err, results) => {

                if (err) {
                    return res.status(500).json({
                        message: "Database error",
                        error: err.message
                    });
                }

                if (results.length > 0) {
                    return res.status(409).json({
                        message: "Email already registered"
                    });
                }

                const hashedPassword = await bcrypt.hash(password, 10);

                db.query(
                    `INSERT INTO users
                    (name, email, password, role)
                    VALUES (?, ?, ?, ?)`,
                    [name, email, hashedPassword, "SALES_USER"],
                    (err, result) => {

                        if (err) {
                            return res.status(500).json({
                                message: "Could not create user",
                                error: err.message
                            });
                        }

                        res.status(201).json({
                            message: "User registered successfully",
                            userId: result.insertId,
                            role: "SALES_USER"
                        });
                    }
                );
            }
        );

    } catch (error) {
        res.status(500).json({
            message: "Server error"
        });
    }
});


// LOGIN
router.post("/login", (req, res) => {

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: "Email and password are required"
        });
    }

    db.query(
        "SELECT * FROM users WHERE email = ?",
        [email],
        async (err, results) => {

            if (err) {
                return res.status(500).json({
                    message: "Database error",
                    error: err.message
                });
            }

            if (results.length === 0) {
                return res.status(401).json({
                    message: "Invalid email or password"
                });
            }

            const user = results[0];

            const passwordMatch = await bcrypt.compare(
                password,
                user.password
            );

            if (!passwordMatch) {
                return res.status(401).json({
                    message: "Invalid email or password"
                });
            }

            const token = jwt.sign(
                {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: "2h"
                }
            );

            res.json({
                message: "Login successful",
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            });
        }
    );
});

module.exports = router;