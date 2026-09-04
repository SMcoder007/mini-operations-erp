import { useEffect, useState } from "react";
import "./App.css";

const API = "http://localhost:5000/api";

function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem("user") || "null")
  );

  const [page, setPage] = useState("dashboard");

  const [inventory, setInventory] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [orders, setOrders] = useState([]);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const showMessage = (text) => {
    setMessage(text);
    setError("");
    setTimeout(() => setMessage(""), 3000);
  };

  const showError = (text) => {
    setError(text);
    setMessage("");
    setTimeout(() => setError(""), 4000);
  };

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  const loadInventory = async () => {
    try {
      const response = await fetch(`${API}/inventory`, {
        headers: authHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load inventory");
      }

      setInventory(data);
    } catch (err) {
      showError(err.message);
    }
  };

  const loadWorkOrders = async () => {
    try {
      const response = await fetch(`${API}/work-orders`, {
        headers: authHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load work orders");
      }

      setWorkOrders(data);
    } catch (err) {
      showError(err.message);
    }
  };

  const loadTransfers = async () => {
    try {
      const response = await fetch(`${API}/transfers`, {
        headers: authHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load transfers");
      }

      setTransfers(data);
    } catch (err) {
      showError(err.message);
    }
  };

  const loadOrders = async () => {
    try {
      const response = await fetch(`${API}/orders`, {
        headers: authHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load orders");
      }

      setOrders(data);
    } catch (err) {
      showError(err.message);
    }
  };

  useEffect(() => {
    if (token) {
      loadInventory();
      loadWorkOrders();
      loadTransfers();
      loadOrders();
    }
  }, [token]);

  if (!token) {
    return (
      <Login
        setToken={setToken}
        setUser={setUser}
        showError={showError}
      />
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <h2>Mini ERP</h2>
          <span>Operations Management</span>
        </div>

        <nav>
          <button
            className={page === "dashboard" ? "active" : ""}
            onClick={() => setPage("dashboard")}
          >
            📊 Dashboard
          </button>

          <button
            className={page === "inventory" ? "active" : ""}
            onClick={() => setPage("inventory")}
          >
            📦 Inventory
          </button>

          <button
            className={page === "workorders" ? "active" : ""}
            onClick={() => setPage("workorders")}
          >
            🛠️ Work Orders
          </button>

          <button
            className={page === "transfers" ? "active" : ""}
            onClick={() => setPage("transfers")}
          >
            🔄 Internal Transfers
          </button>

          <button
            className={page === "orders" ? "active" : ""}
            onClick={() => setPage("orders")}
          >
            🧾 Customer Orders
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="logged-user">
            <strong>{user?.name || user?.email || "User"}</strong>
            <span>{user?.role || "User"}</span>
          </div>

          <button className="logout-btn" onClick={logout}>
            🚪 Logout
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>
              {page === "dashboard" && "Dashboard"}
              {page === "inventory" && "Inventory"}
              {page === "workorders" && "Work Orders"}
              {page === "transfers" && "Internal Transfers"}
              {page === "orders" && "Customer Orders"}
            </h1>
            <p>Mini Operations ERP</p>
          </div>

          <div className="top-user">
            <span>👤</span>
            {user?.role}
          </div>
        </header>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        <section className="content">
          {page === "dashboard" && (
            <Dashboard
              inventory={inventory}
              workOrders={workOrders}
              transfers={transfers}
              orders={orders}
            />
          )}

          {page === "inventory" && (
            <Inventory
              inventory={inventory}
              reload={loadInventory}
              showMessage={showMessage}
              showError={showError}
              headers={authHeaders}
              user={user}
            />
          )}

          {page === "workorders" && (
            <WorkOrders
              workOrders={workOrders}
              reload={loadWorkOrders}
              showMessage={showMessage}
              showError={showError}
              headers={authHeaders}
              user={user}
            />
          )}

          {page === "transfers" && (
            <Transfers
              transfers={transfers}
              reload={loadTransfers}
              showMessage={showMessage}
              showError={showError}
              headers={authHeaders}
              user={user}
            />
          )}

          {page === "orders" && (
            <Orders
              orders={orders}
              reload={loadOrders}
              showMessage={showMessage}
              showError={showError}
              headers={authHeaders}
              user={user}
            />
          )}
        </section>
      </main>
    </div>
  );
}

/* ================= LOGIN ================= */

function Login({ setToken, setUser, showError }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      showError("Please enter email and password");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      localStorage.setItem("token", data.token);

      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
        setUser(data.user);
      }

      setToken(data.token);
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-icon">🏢</div>

        <h1>Mini Operations ERP</h1>
        <p>Operations Management System</p>

        <form onSubmit={login}>
          <label>Email</label>

          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label>Password</label>

          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button className="login-btn" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ================= DASHBOARD ================= */

function Dashboard({ inventory, workOrders, transfers, orders }) {
  const totalPhysical = inventory.reduce(
    (sum, item) => sum + Number(item.physical_quantity || 0),
    0
  );

  const totalReserved = inventory.reduce(
    (sum, item) => sum + Number(item.reserved_quantity || 0),
    0
  );

  const totalAvailable = inventory.reduce(
    (sum, item) => sum + Number(item.available_quantity || 0),
    0
  );

  const completedOrders = orders.filter(
    (order) => order.status === "CANCELLED"
  ).length;

  return (
    <div>
      <div className="welcome">
        <h2>Welcome to Mini Operations ERP 👋</h2>
        <p>
          Manage inventory, work orders, stock transfers and customer
          reservations from one place.
        </p>
      </div>

      <div className="stats-grid">
        <StatCard
          title="Physical Stock"
          value={totalPhysical}
          icon="📦"
        />

        <StatCard
          title="Reserved Stock"
          value={totalReserved}
          icon="🔒"
        />

        <StatCard
          title="Available Stock"
          value={totalAvailable}
          icon="✅"
        />

        <StatCard
          title="Work Orders"
          value={workOrders.length}
          icon="🛠️"
        />

        <StatCard
          title="Transfers"
          value={transfers.length}
          icon="🔄"
        />

        <StatCard
          title="Customer Orders"
          value={orders.length}
          icon="🧾"
        />
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <h3>Operations Flow</h3>

          <div className="flow">
            <div>📦 Inventory</div>
            <span>→</span>
            <div>🛠️ Work Order</div>
            <span>→</span>
            <div>🔄 Transfer</div>
            <span>→</span>
            <div>🧾 Reservation</div>
          </div>
        </div>

        <div className="panel">
          <h3>System Overview</h3>

          <p>
            <strong>{inventory.length}</strong> inventory records
          </p>

          <p>
            <strong>{workOrders.length}</strong> work orders
          </p>

          <p>
            <strong>{transfers.length}</strong> internal transfers
          </p>

          <p>
            <strong>{orders.length}</strong> customer orders
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>

      <div>
        <p>{title}</p>
        <h2>{value}</h2>
      </div>
    </div>
  );
}

/* ================= INVENTORY ================= */

function Inventory({
  inventory,
  reload,
  showMessage,
  showError,
  headers,
  user,
}) {
  const [form, setForm] = useState({
    item_id: "1",
    location_id: "1",
    batch_id: "1",
    quantity: "",
  });

  const [stockOut, setStockOut] = useState({
    inventory_id: "",
    quantity: "",
  });

  const [loading, setLoading] = useState(false);

  const stockIn = async (e) => {
    e.preventDefault();

    if (!form.quantity || Number(form.quantity) <= 0) {
      showError("Enter a valid quantity");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API}/inventory/stock-in`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          item_id: Number(form.item_id),
          location_id: Number(form.location_id),
          batch_id: Number(form.batch_id),
          quantity: Number(form.quantity),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Stock in failed");
      }

      showMessage(data.message || "Stock added successfully");

      setForm({
        ...form,
        quantity: "",
      });

      reload();
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const stockOutRequest = async (e) => {
    e.preventDefault();

    if (!stockOut.inventory_id || !stockOut.quantity) {
      showError("Enter inventory ID and quantity");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API}/inventory/stock-out`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          inventory_id: Number(stockOut.inventory_id),
          quantity: Number(stockOut.quantity),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Stock out failed");
      }

      showMessage(data.message || "Stock removed successfully");

      setStockOut({
        inventory_id: "",
        quantity: "",
      });

      reload();
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-title">
        <h2>Inventory Management</h2>
        <p>View physical, reserved and available stock.</p>
      </div>

      <div className="two-column">
        {(user?.role === "ADMIN" || user?.role === "OPERATIONS_USER") && (
          <>
            <div className="form-card">
              <h3>Stock In</h3>

              <form onSubmit={stockIn}>
                <label>Item ID</label>
                <input
                  type="number"
                  value={form.item_id}
                  onChange={(e) =>
                    setForm({ ...form, item_id: e.target.value })
                  }
                />

                <label>Location ID</label>
                <input
                  type="number"
                  value={form.location_id}
                  onChange={(e) =>
                    setForm({ ...form, location_id: e.target.value })
                  }
                />

                <label>Batch ID</label>
                <input
                  type="number"
                  value={form.batch_id}
                  onChange={(e) =>
                    setForm({ ...form, batch_id: e.target.value })
                  }
                />

                <label>Quantity</label>
                <input
                  type="number"
                  min="1"
                  placeholder="Quantity"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({ ...form, quantity: e.target.value })
                  }
                />

                <button className="primary-btn" disabled={loading}>
                  Add Stock
                </button>
              </form>
            </div>

            <div className="form-card">
              <h3>Stock Out</h3>

              <form onSubmit={stockOutRequest}>
                <label>Inventory ID</label>

                <input
                  type="number"
                  placeholder="Inventory ID"
                  value={stockOut.inventory_id}
                  onChange={(e) =>
                    setStockOut({
                      ...stockOut,
                      inventory_id: e.target.value,
                    })
                  }
                />

                <label>Quantity</label>

                <input
                  type="number"
                  min="1"
                  placeholder="Quantity"
                  value={stockOut.quantity}
                  onChange={(e) =>
                    setStockOut({
                      ...stockOut,
                      quantity: e.target.value,
                    })
                  }
                />

                <button className="danger-btn" disabled={loading}>
                  Remove Stock
                </button>
              </form>
            </div>
          </>
        )}
      </div>

      <div className="table-card">
        <div className="table-header">
          <h3>Inventory Records</h3>

          <button className="secondary-btn" onClick={reload}>
            ↻ Refresh
          </button>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Item</th>
                <th>Category</th>
                <th>Location</th>
                <th>Batch</th>
                <th>Physical</th>
                <th>Reserved</th>
                <th>Available</th>
              </tr>
            </thead>

            <tbody>
              {inventory.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty">
                    No inventory records found.
                  </td>
                </tr>
              ) : (
                inventory.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.item_name}</td>
                    <td>{item.category_name}</td>
                    <td>{item.location_name}</td>
                    <td>{item.batch_number}</td>
                    <td>{item.physical_quantity}</td>
                    <td>{item.reserved_quantity}</td>
                    <td>
                      <span
                        className={
                          Number(item.available_quantity) > 0
                            ? "badge success"
                            : "badge danger"
                        }
                      >
                        {item.available_quantity}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ================= WORK ORDERS ================= */

function WorkOrders({
  workOrders,
  reload,
  showMessage,
  showError,
  headers,
  user,
}) {
  const [form, setForm] = useState({
    work_order_id: "",
    location_id: "1",
    item_id: "1",
    required_quantity: "",
    assigned_user_id: "1",
  });

  const [loading, setLoading] = useState(false);

  const createWorkOrder = async (e) => {
    e.preventDefault();

    if (
      !form.work_order_id ||
      !form.required_quantity ||
      Number(form.required_quantity) <= 0
    ) {
      showError("Please enter all required fields");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API}/work-orders`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          work_order_id: form.work_order_id,
          location_id: Number(form.location_id),
          item_id: Number(form.item_id),
          required_quantity: Number(form.required_quantity),
          assigned_user_id: Number(form.assigned_user_id),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not create work order");
      }

      showMessage(data.message || "Work order created successfully");

      setForm({
        ...form,
        work_order_id: "",
        required_quantity: "",
      });

      reload();
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      const response = await fetch(`${API}/work-orders/${id}/status`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Status update failed");
      }

      showMessage(data.message || "Status updated");
      reload();
    } catch (err) {
      showError(err.message);
    }
  };

  return (
    <div>
      <div className="page-title">
        <h2>Work Orders</h2>
        <p>Create and manage operational work orders.</p>
      </div>

      {user?.role === "ADMIN" && (
        <div className="form-card">
          <h3>Create Work Order</h3>

          <form className="form-grid" onSubmit={createWorkOrder}>
            <div>
              <label>Work Order ID</label>
              <input
                placeholder="WO-002"
                value={form.work_order_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    work_order_id: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label>Location ID</label>
              <input
                type="number"
                value={form.location_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    location_id: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label>Item ID</label>
              <input
                type="number"
                value={form.item_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    item_id: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label>Required Quantity</label>
              <input
                type="number"
                min="1"
                value={form.required_quantity}
                onChange={(e) =>
                  setForm({
                    ...form,
                    required_quantity: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label>Assigned User ID</label>
              <input
                type="number"
                value={form.assigned_user_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    assigned_user_id: e.target.value,
                  })
                }
              />
            </div>

            <div className="form-button">
              <button className="primary-btn" disabled={loading}>
                Create Work Order
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="table-card">
        <div className="table-header">
          <h3>Work Order List</h3>

          <button className="secondary-btn" onClick={reload}>
            ↻ Refresh
          </button>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Work Order</th>
                <th>Location</th>
                <th>Item</th>
                <th>Required</th>
                <th>Shortage</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {workOrders.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty">
                    No work orders found.
                  </td>
                </tr>
              ) : (
                workOrders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.id}</td>
                    <td>{order.work_order_id}</td>
                    <td>{order.location_name}</td>
                    <td>{order.item_name}</td>
                    <td>{order.required_quantity}</td>
                    <td>{order.shortage_quantity}</td>
                    <td>
                      <span className="badge info">{order.status}</span>
                    </td>
                    <td>
                      {(user?.role === "ADMIN" ||
                        user?.role === "OPERATIONS_USER") && (
                        <select
                          value={order.status}
                          onChange={(e) =>
                            updateStatus(order.id, e.target.value)
                          }
                        >
                          <option value="ASSIGNED">ASSIGNED</option>
                          <option value="IN_PROGRESS">IN_PROGRESS</option>
                          <option value="COMPLETED">COMPLETED</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ================= TRANSFERS ================= */

function Transfers({
  transfers,
  reload,
  showMessage,
  showError,
  headers,
  user,
}) {
  const [form, setForm] = useState({
    transfer_id: "",
    source_location_id: "1",
    destination_location_id: "2",
    item_id: "1",
    quantity: "",
  });

  const [loading, setLoading] = useState(false);

  const createTransfer = async (e) => {
    e.preventDefault();

    if (!form.transfer_id || !form.quantity) {
      showError("Please enter transfer ID and quantity");
      return;
    }

    if (
      Number(form.source_location_id) ===
      Number(form.destination_location_id)
    ) {
      showError("Source and destination cannot be the same");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API}/transfers`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          transfer_id: form.transfer_id,
          source_location_id: Number(form.source_location_id),
          destination_location_id: Number(form.destination_location_id),
          item_id: Number(form.item_id),
          quantity: Number(form.quantity),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Transfer creation failed");
      }

      showMessage(data.message || "Transfer created successfully");

      setForm({
        ...form,
        transfer_id: "",
        quantity: "",
      });

      reload();
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const transferAction = async (id, action) => {
    try {
      const response = await fetch(`${API}/transfers/${id}/${action}`, {
        method: "PATCH",
        headers: headers(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `${action} failed`);
      }

      showMessage(data.message || `Transfer ${action} successful`);
      reload();
    } catch (err) {
      showError(err.message);
    }
  };

  return (
    <div>
      <div className="page-title">
        <h2>Internal Transfers</h2>
        <p>Move inventory safely between locations.</p>
      </div>

      {(user?.role === "ADMIN" || user?.role === "OPERATIONS_USER") && (
        <div className="form-card">
          <h3>Create Transfer</h3>

          <form className="form-grid" onSubmit={createTransfer}>
            <div>
              <label>Transfer ID</label>
              <input
                placeholder="TR-002"
                value={form.transfer_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    transfer_id: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label>Source Location</label>
              <input
                type="number"
                value={form.source_location_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    source_location_id: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label>Destination Location</label>
              <input
                type="number"
                value={form.destination_location_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    destination_location_id: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label>Item ID</label>
              <input
                type="number"
                value={form.item_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    item_id: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label>Quantity</label>
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) =>
                  setForm({
                    ...form,
                    quantity: e.target.value,
                  })
                }
              />
            </div>

            <div className="form-button">
              <button className="primary-btn" disabled={loading}>
                Create Transfer
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="table-card">
        <div className="table-header">
          <h3>Transfer List</h3>

          <button className="secondary-btn" onClick={reload}>
            ↻ Refresh
          </button>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Transfer</th>
                <th>Source</th>
                <th>Destination</th>
                <th>Item</th>
                <th>Quantity</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty">
                    No transfers found.
                  </td>
                </tr>
              ) : (
                transfers.map((transfer) => (
                  <tr key={transfer.id}>
                    <td>{transfer.id}</td>
                    <td>{transfer.transfer_id}</td>
                    <td>{transfer.source_location_id}</td>
                    <td>{transfer.destination_location_id}</td>
                    <td>{transfer.item_id}</td>
                    <td>{transfer.quantity}</td>
                    <td>
                      <span className="badge info">
                        {transfer.status}
                      </span>
                    </td>

                    <td>
                      {transfer.status === "REQUESTED" && (
                        <button
                          className="small-btn"
                          onClick={() =>
                            transferAction(transfer.id, "dispatch")
                          }
                        >
                          Dispatch
                        </button>
                      )}

                      {transfer.status === "DISPATCHED" && (
                        <button
                          className="small-btn success-btn"
                          onClick={() =>
                            transferAction(transfer.id, "receive")
                          }
                        >
                          Receive
                        </button>
                      )}

                      {transfer.status === "RECEIVED" && (
                        <span className="completed">Completed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ================= CUSTOMER ORDERS ================= */

function Orders({
  orders,
  reload,
  showMessage,
  showError,
  headers,
  user,
}) {
  const [customer, setCustomer] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const [order, setOrder] = useState({
    order_number: "",
    customer_id: "1",
    location_id: "2",
    item_id: "1",
    quantity: "",
  });

  const [loading, setLoading] = useState(false);

  const createCustomer = async (e) => {
    e.preventDefault();

    if (!customer.name || !customer.email) {
      showError("Customer name and email are required");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API}/orders/customers`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(customer),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Customer creation failed");
      }

      showMessage(
        `Customer created successfully. Customer ID: ${
          data.customer_id || data.id
        }`
      );

      setCustomer({
        name: "",
        email: "",
        phone: "",
      });
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createOrder = async (e) => {
    e.preventDefault();

    if (!order.order_number || !order.quantity) {
      showError("Order number and quantity are required");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API}/orders`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          order_number: order.order_number,
          customer_id: Number(order.customer_id),
          location_id: Number(order.location_id),
          item_id: Number(order.item_id),
          quantity: Number(order.quantity),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Order creation failed");
      }

      showMessage(data.message || "Customer order created");

      setOrder({
        ...order,
        order_number: "",
        quantity: "",
      });

      reload();
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const cancelOrder = async (id) => {
    if (!window.confirm("Cancel this order and release its reservation?")) {
      return;
    }

    try {
      const response = await fetch(`${API}/orders/${id}/cancel`, {
        method: "PATCH",
        headers: headers(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Order cancellation failed");
      }

      showMessage(data.message || "Order cancelled successfully");
      reload();
    } catch (err) {
      showError(err.message);
    }
  };

  const canManage =
    user?.role === "ADMIN" || user?.role === "SALES_USER";

  return (
    <div>
      <div className="page-title">
        <h2>Customer Orders</h2>
        <p>Create customer orders and reserve available stock.</p>
      </div>

      {canManage && (
        <div className="two-column">
          <div className="form-card">
            <h3>Create Customer</h3>

            <form onSubmit={createCustomer}>
              <label>Name</label>

              <input
                placeholder="Customer name"
                value={customer.name}
                onChange={(e) =>
                  setCustomer({
                    ...customer,
                    name: e.target.value,
                  })
                }
              />

              <label>Email</label>

              <input
                type="email"
                placeholder="customer@email.com"
                value={customer.email}
                onChange={(e) =>
                  setCustomer({
                    ...customer,
                    email: e.target.value,
                  })
                }
              />

              <label>Phone</label>

              <input
                placeholder="Phone"
                value={customer.phone}
                onChange={(e) =>
                  setCustomer({
                    ...customer,
                    phone: e.target.value,
                  })
                }
              />

              <button className="primary-btn" disabled={loading}>
                Create Customer
              </button>
            </form>
          </div>

          <div className="form-card">
            <h3>Create Customer Order</h3>

            <form onSubmit={createOrder}>
              <label>Order Number</label>

              <input
                placeholder="ORD-003"
                value={order.order_number}
                onChange={(e) =>
                  setOrder({
                    ...order,
                    order_number: e.target.value,
                  })
                }
              />

              <label>Customer ID</label>

              <input
                type="number"
                value={order.customer_id}
                onChange={(e) =>
                  setOrder({
                    ...order,
                    customer_id: e.target.value,
                  })
                }
              />

              <label>Location ID</label>

              <input
                type="number"
                value={order.location_id}
                onChange={(e) =>
                  setOrder({
                    ...order,
                    location_id: e.target.value,
                  })
                }
              />

              <label>Item ID</label>

              <input
                type="number"
                value={order.item_id}
                onChange={(e) =>
                  setOrder({
                    ...order,
                    item_id: e.target.value,
                  })
                }
              />

              <label>Quantity</label>

              <input
                type="number"
                min="1"
                placeholder="Quantity"
                value={order.quantity}
                onChange={(e) =>
                  setOrder({
                    ...order,
                    quantity: e.target.value,
                  })
                }
              />

              <button className="primary-btn" disabled={loading}>
                Reserve Stock & Create Order
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="table-card">
        <div className="table-header">
          <h3>Customer Orders</h3>

          <button className="secondary-btn" onClick={reload}>
            ↻ Refresh
          </button>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Order Number</th>
                <th>Customer</th>
                <th>Location</th>
                <th>Status</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty">
                    No customer orders found.
                  </td>
                </tr>
              ) : (
                orders.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.order_number}</td>
                    <td>{item.customer_name || item.customer_id}</td>
                    <td>{item.location_id}</td>
                    <td>
                      <span className="badge info">
                        {item.status}
                      </span>
                    </td>
                    <td>
                      {item.created_at
                        ? new Date(item.created_at).toLocaleString()
                        : "-"}
                    </td>
                    <td>
                      {item.status !== "CANCELLED" && canManage && (
                        <button
                          className="danger-small"
                          onClick={() => cancelOrder(item.id)}
                        >
                          Cancel
                        </button>
                      )}

                      {item.status === "CANCELLED" && (
                        <span className="completed">Cancelled</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;