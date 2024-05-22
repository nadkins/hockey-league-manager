const mysql = require("mysql");

// Create a database connection pool
const pool = mysql.createPool({
	connectionLimit: 10,
	host: process.env.DB_HOST || "localhost", // Use environment variable for DB host or default to localhost
	user: process.env.DB_USER || "root", // Use environment variable for DB user or default to root
	password: process.env.DB_PASSWORD || "",
	database: process.env.DB_NAME || "sdfhl_site", // Use environment variable for DB name or default to sdfhl_site
});

// Test the connection pool
pool.getConnection((err, connection) => {
	if (err) {
		console.error("Error connecting to database:", err);
	} else {
		console.log("Connected to database successfully!");
		connection.release(); // Release the connection back to the pool
	}
});

module.exports = pool;
