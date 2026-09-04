const express = require("express");
const cors = require("cors");
require("dotenv").config();

require("./config/db");

const authRoutes = require("./routes/authroutes");
const inventoryRoutes = require("./routes/inventoryroutes");
const workOrderRoutes = require("./routes/workorderroutes");
const transferRoutes = require("./routes/transferroutes");
const orderRoutes = require("./routes/orderroutes");

const app = express();


// MIDDLEWARE
app.use(cors());
app.use(express.json());


// BASIC TEST
app.get("/", (req, res) => {
    res.json({
        message: "Mini Operations ERP Backend is running!"
    });
});


// API ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/work-orders", workOrderRoutes);
app.use("/api/transfers", transferRoutes);
app.use("/api/orders", orderRoutes);


// SERVER
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(
        `Server running on http://localhost:${PORT}`
    );
});