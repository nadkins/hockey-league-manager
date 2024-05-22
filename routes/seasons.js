// routes/teams.js

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

// Show all seasons
router.get("/", async (req, res) => {
	try {
		// Fetch all seasons from the sdfhl_seasons table
		pool.query("SELECT * FROM sdfhl_seasons", (error, results) => {
			if (error) {
				console.error("Error fetching seasons:", error);
				res.status(500).send("Error fetching seasons.");
				return;
			}
			// Render the seasons page and pass the fetched seasons data to it
			res.render("seasons", {title: "Seasons", seasons: results, username: req.session.username});
		});
	} catch (err) {
		console.error("Error fetching teams:", err);
		res.status(500).send("Error fetching teams.");
	}
});

// Render the add team form
router.get("/add", (req, res) => {
	res.render("add-season", {title: "Add Season", username: req.session.username});
});

// Add a new player
router.post("/add", upload.single("season_logo"), async (req, res) => {
	try {
		const {season_name, season_division_4, season_division_3, season_division_2, season_division_1, season_active, season_start} = req.body;

		// Default division names
		const defaultDivision2 = "Division 2";
		const defaultDivision3 = "Division 3";
		const defaultDivision4 = "Division 4";

		// Set division names if not provided
		const division2 = season_division_2 || defaultDivision2;
		const division3 = season_division_3 || defaultDivision3;
		const division4 = season_division_4 || defaultDivision4;

		// Set season_active to 0 if not provided
		const active = season_active || 0;

		// Set the season_logo based on the presence of uploaded file
		const season_logo = req.file ? req.file.filename : ""; // or '' depending on your database schema

		// Insert the new season into the database
		pool.query("INSERT INTO sdfhl_seasons (season_name, season_division_4, season_division_3, season_division_2, season_division_1, season_active, season_logo, season_start) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [season_name, division4, division3, division2, season_division_1, active, season_logo, season_start], (error, results) => {
			if (error) {
				console.error("Error adding season:", error);
				res.status(500).send("Error adding season.");
				return;
			}

			// Retrieve the season_id of the newly added season
			const regularSeasonId = results.insertId;

			// Append "Playoffs" to the season name
			const playoffSeasonName = season_name + " Playoffs";

			// Insert the playoffs season into the database
			pool.query("INSERT INTO sdfhl_seasons (season_name, season_division_4, season_division_3, season_division_2, season_division_1, season_active, season_logo, season_regular, season_playoff, season_start) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [playoffSeasonName, division4, division3, division2, season_division_1, 0, season_logo, regularSeasonId, 0, season_start], (error, results) => {
				if (error) {
					console.error("Error adding playoffs season:", error);
					res.status(500).send("Error adding playoffs season.");
					return;
				}

				// Update the season_playoff value of the regular season record
				const updatedPlayoffSeasonId = regularSeasonId + 1;
				pool.query("UPDATE sdfhl_seasons SET season_playoff = ? WHERE season_id = ?", [updatedPlayoffSeasonId, regularSeasonId], (updateError, updateResults) => {
					if (updateError) {
						console.error("Error updating season_playoff value:", updateError);
						res.status(500).send("Error updating season_playoff value.");
						return;
					}

					// Redirect to the seasons page after adding the seasons
					res.redirect("/seasons");
				});
			});
		});
	} catch (err) {
		console.error(err);
		res.status(500).send("Server Error");
	}
});

// Render the edit season form
router.get("/edit/:id", async (req, res) => {
	try {
		const seasonId = req.params.id;
		// Fetch the season from the database based on the provided season ID
		pool.query("SELECT * FROM sdfhl_seasons WHERE season_id = ?", [seasonId], (error, results) => {
			if (error) {
				console.error("Error fetching season:", error);
				res.status(500).send("Error fetching season.");
				return;
			}

			if (results.length === 0) {
				res.status(404).send("Season not found.");
				return;
			}

			const season = results[0];
			// Format the start date to YYYY-MM-DD
			const formattedStartDate = season.season_start.toISOString().split("T")[0];
			season.season_start = formattedStartDate;
			res.render("edit-season", {title: "Edit Season", season, username: req.session.username});
		});
	} catch (err) {
		console.error(err);
		res.status(500).send("Server Error");
	}
});

// Update season information
router.post("/edit/:id", upload.single("season_logo"), async (req, res) => {
	try {
		const seasonId = req.params.id;
		const {season_name, season_division_4, season_division_3, season_division_2, season_division_1, season_active, season_start} = req.body;

		// Default division names
		const defaultDivision2 = "Division 2";
		const defaultDivision3 = "Division 3";
		const defaultDivision4 = "Division 4";

		// Set division names if not provided
		const division2 = season_division_2 || defaultDivision2;
		const division3 = season_division_3 || defaultDivision3;
		const division4 = season_division_4 || defaultDivision4;

		// Set season_active to 0 if not provided
		const active = season_active || 0;

		// Get the filename of the uploaded logo, if any
		const season_logo = req.file ? req.file.filename : null;

		// Update the season in the database
		pool.query("UPDATE sdfhl_seasons SET season_name = ?, season_division_4 = ?, season_division_3 = ?, season_division_2 = ?, season_division_1 = ?, season_active = ?, season_logo = ?, season_start = ? WHERE season_id = ?", [season_name, division4, division3, division2, season_division_1, active, season_logo, season_start, seasonId], (error, results) => {
			if (error) {
				console.error("Error updating season:", error);
				res.status(500).send("Error updating season.");
				return;
			}
			res.redirect("/seasons?updated=true");
		});
	} catch (err) {
		console.error(err);
		res.status(500).send("Server Error");
	}
});

module.exports = router;
