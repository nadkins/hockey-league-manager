// routes/players.js

const express = require("express");
const router = express.Router();
const multer = require("multer"); // For handling file uploads
const pool = require("../database"); // Assuming you have a database connection pool defined in a separate file

// Configure multer for handling file uploads
const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, "./public/uploads/");
	},
	filename: function (req, file, cb) {
		cb(null, Date.now() + "-" + file.originalname);
	},
});
const upload = multer({storage: storage});

// Show all players
router.get("/", async (req, res) => {
	try {
		// Fetch all records from the sdfhl_players table
		pool.query("SELECT * FROM sdfhl_players ORDER BY player_first", (error, results, fields) => {
			if (error) {
				console.error("Error fetching players:", error);
				res.status(500).send("Error fetching players.");
				return;
			}
			// Render the players page and pass the fetched records to it
			res.render("players", {title: "Players", players: results, username: req.session.username});
		});
	} catch (err) {
		console.error("Error fetching players:", err);
		res.status(500).send("Error fetching players.");
	}
});

// Render the add player form
router.get("/add", (req, res) => {
	res.render("add-player", {title: "Add Player", username: req.session.username});
});

// Add a new player
router.post("/add", upload.single("player_picture"), async (req, res) => {
	try {
		// Process form data and save the player
		const {player_first, player_last, player_dob, player_phone, player_email, player_gender, player_shot, player_shirt, player_hometown, player_active, player_draftpos} = req.body;

		// Parse the player_dob date string to obtain the timestamp
		const dobTimestamp = player_dob ? new Date(player_dob).getTime() : null;

		// Get the filename of the uploaded picture
		const player_picture = req.file ? req.file.filename : null;

		// Convert player_positions array to comma-separated string
		const player_positions = req.body.player_positions.join(",");

		// Execute the SQL query to insert the new player
		pool.query("INSERT INTO sdfhl_players (player_first, player_last, player_dob, player_phone, player_email, player_gender, player_shot, player_positions, player_shirt, player_picture, player_hometown, player_active, player_draftpos) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [player_first, player_last, dobTimestamp, player_phone, player_email, player_gender, player_shot, player_positions, player_shirt, player_picture, player_hometown, player_active, player_draftpos], (error, results) => {
			if (error) {
				console.error("Error adding player:", error);
				res.status(500).send("Error adding player.");
				return;
			}

			// Redirect to the edit player page with the newly inserted player ID
			const playerId = results.insertId;
			res.redirect(`/players/edit/${playerId}`);
		});
	} catch (err) {
		console.error(err);
		res.status(500).send("Server Error");
	}
});

// Render the edit player form
router.get("/edit/:id", async (req, res) => {
    try {
        const playerId = req.params.id;

        console.log(`Fetching player with ID: ${playerId}`);

        // Fetch the player from the database based on the provided player ID
        pool.query("SELECT * FROM sdfhl_players WHERE player_id = ? ORDER BY player_first", [playerId], (error, results) => {
            if (error) {
                console.error("Error fetching player:", error);
                res.status(500).send("Error fetching player.");
                return;
            }

            if (results.length === 0) {
                console.log(`Player with ID ${playerId} not found.`);
                res.status(404).send("Player not found.");
                return;
            }

            const player = results[0];

            // Convert player_dob from timestamp to "YYYY-MM-DD" format
            // const dob = new Date(player.player_dob).toISOString().split("T")[0];

            // Modify the player object to use the formatted date of birth
            // player.player_dob = dob;

            res.render("edit-player", {title: "Edit Player", player, username: req.session.username});
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});


// Update player information
router.post("/edit/:id", upload.single("player_picture"), async (req, res) => {
	try {
		// Process form data and update the player
		const playerId = req.params.id;
		const {player_first, player_last, player_dob, player_phone, player_email, player_gender, player_shot, player_positions, player_shirt, player_hometown, player_active, player_draftpos, player_nhl} = req.body;

		// Convert player_dob to the desired format "YYYY-MM-DD"
		const dob = new Date(player_dob).toISOString().split("T")[0];

		// Convert player_positions array to comma-separated string
		const positions = Array.isArray(player_positions) ? player_positions.join(",") : player_positions;

		// Update the player in the database
		pool.query("UPDATE sdfhl_players SET player_first = ?, player_last = ?, player_dob = ?, player_phone = ?, player_email = ?, player_gender = ?, player_shot = ?, player_positions = ?, player_shirt = ?, player_hometown = ?, player_active = ?, player_draftpos = ?, player_nhl = ? WHERE player_id = ?", [player_first, player_last, dob, player_phone, player_email, player_gender, player_shot, positions, player_shirt, player_hometown, player_active, player_draftpos, player_nhl, playerId], (error, results) => {
			if (error) {
				console.error("Error updating player:", error);
				res.status(500).send("Error updating player.");
				return;
			}
			res.redirect("/players?updated=true");
		});
	} catch (err) {
		console.error(err);
		res.status(500).send("Server Error");
	}
});

module.exports = router;
