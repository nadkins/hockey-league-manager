// server.js for SDFHL Admin 

const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcrypt");
const mysql = require("mysql");
const ejs = require("ejs");
const multer = require("multer");
const path = require("path");
const playerUtils = require("./playerUtils"); // Import playerUtils.js
const crypto = require("crypto");

const app = express();
const port = process.env.PORT || 3000; // Use environment variable for port or default to 3000

const nonce = crypto.randomBytes(16).toString("base64");

// Set CSP header with nonce
app.use((req, res, next) => {
	res.setHeader("Content-Security-Policy", `script-src 'self' 'nonce-${nonce}'`);
	next();
});

// Expose fetchPlayerDataById function
app.locals.fetchPlayerDataById = playerUtils.fetchPlayerDataById;

// Middleware
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public"))); // Serve static files from the public directory

// Pass nonce to all routes
app.use((req, res, next) => {
	res.locals.nonce = nonce;
	next();
});

// Session middleware
app.use(
	session({
		secret: process.env.SESSION_SECRET || "secret", // Use environment variable for session secret or default to "secret"
		resave: true,
		saveUninitialized: true,
	})
);

// Configure multer for file upload
const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, "./public/uploads/");
	},
	filename: function (req, file, cb) {
		cb(null, Date.now() + "-" + file.originalname);
	},
});
const upload = multer({storage: storage});

// Database connection pool
const pool = mysql.createPool({
	connectionLimit: 10,
	host: process.env.DB_HOST || "localhost", // Use environment variable for DB host or default to localhost
	user: process.env.DB_USER || "manager", // Use environment variable for DB user or default to root
	password: process.env.DB_PASSWORD || "Manager@123!",
	database: process.env.DB_NAME || "sdfhl_site", // Use environment variable for DB name or default to sdfhl_site
});

// Middleware to handle database errors
app.use((err, req, res, next) => {
	console.error("Database error:", err);
	res.status(500).send("Internal Server Error");
});

// Middleware to include navigation menu on each page
app.use((req, res, next) => {
	ejs.renderFile(path.join(__dirname, "views", "navbar.ejs"), {username: req.session.username}, (err, str) => {
		if (err) {
			console.error("Error rendering navbar:", err);
			req.navbar = "";
		} else {
			req.navbar = str;
		}
		next();
	});
});

// Middleware to ensure user is logged in
const requireLogin = (req, res, next) => {
	if (req.session.loggedin) {
		next();
	} else {
		res.redirect("/login");
	}
};

// Apply requireLogin middleware to routes that require authentication
app.use((req, res, next) => {
	if (req.path === "/login" || req.path === "/register") {
		next();
	} else {
		requireLogin(req, res, next);
	}
});

// Set EJS as the view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Routes
app.get("/", (req, res) => {
	res.render("home", {title: "Home", username: req.session.username});
});

app.get("/login", (req, res) => {
	if (req.session.loggedin) {
		res.redirect("/"); // Redirect to home page if already logged in
	} else {
		res.render("login", {title: "Login"});
	}
});

app.post("/login", (req, res) => {
	const {username, password} = req.body;

	// Retrieve user from the database based on the provided username
	pool.query("SELECT * FROM users WHERE username = ?", [username], (error, results, fields) => {
		if (error) {
			console.error("Error retrieving user:", error);
			res.send("Error logging in.");
			return;
		}

		// Check if a user with the provided username exists
		if (results.length === 0) {
			res.send("User does not exist.");
			return;
		}

		const user = results[0];

		// Compare the provided password with the hashed password stored in the database
		bcrypt.compare(password, user.password, (err, result) => {
			if (err) {
				console.error("Error comparing passwords:", err);
				res.send("Error logging in.");
				return;
			}

			// If passwords match, create a session for the user
			if (result) {
				req.session.loggedin = true;
				req.session.username = username;
				res.redirect("/");
			} else {
				res.send("Incorrect password.");
			}
		});
	});
});

app.get("/register", (req, res) => {
	if (req.session.loggedin) {
		res.redirect("/"); // Redirect to home page if already logged in
	} else {
		res.render("register", {title: "Register"});
	}
});

app.post("/register", (req, res) => {
	const {username, password} = req.body;

	// Hash the password before storing it in the database
	bcrypt.hash(password, 10, (err, hash) => {
		if (err) {
			console.error("Error hashing password:", err);
			res.send("Error registering user.");
			return;
		}

		// Insert the new user into the database
		pool.query("INSERT INTO users (username, password) VALUES (?, ?)", [username, hash], (error, results, fields) => {
			if (error) {
				console.error("Error registering user:", error);
				res.send("Error registering user.");
				return;
			}
			console.log("User registered successfully:", username);
			res.redirect("/login"); // Redirect to login page after successful registration
		});
	});
});

app.get("/logout", (req, res) => {
	// Clear the user's session to log them out
	req.session.destroy((err) => {
		if (err) {
			console.error("Error logging out:", err);
			res.send("Error logging out.");
			return;
		}
		// Redirect to the login page after logging out
		res.redirect("/login");
	});
});

// Import routes
// Players route
const playersRouter = require("./routes/players");
// Teams route
const teamsRouter = require("./routes/teams");
// Seasons route
const seasonsRouter = require("./routes/seasons");
// Schedules route
const schedulesRouter = require("./routes/schedules");
// Gamestats route
const gamestatsRouter = require("./routes/gamestats");

// Use routes
app.use("/players", playersRouter);
app.use("/teams", teamsRouter);
app.use("/seasons", seasonsRouter);
app.use("/schedules", schedulesRouter);
app.use("/gamestats", gamestatsRouter);

// Start server
app.listen(port, () => {
	console.log(`Server is listening on port ${port}`);
});
