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

// Show all teams for active/selected season
router.get("/", async (req, res) => {
	try {
		// Fetch all seasons from the sdfhl_seasons table
		pool.query("SELECT * FROM sdfhl_seasons", (error, seasonsResults) => {
			if (error) {
				console.error("Error fetching seasons:", error);
				res.status(500).send("Error fetching seasons.");
				return;
			}

			// Fetch the active season from the sdfhl_seasons table
			pool.query("SELECT season_id FROM sdfhl_seasons WHERE season_active = 1", (error, activeSeasonResults) => {
				if (error) {
					console.error("Error fetching active season:", error);
					res.status(500).send("Error fetching active season.");
					return;
				}

				if (activeSeasonResults.length === 0) {
					res.status(404).send("No active season found.");
					return;
				}

				const activeSeasonId = activeSeasonResults[0].season_id;

				// Fetch all teams from the sdfhl_teams table that belong to the selected season
				const selectedSeasonId = req.query.season || activeSeasonId;
				pool.query("SELECT * FROM sdfhl_teams WHERE team_season = ?", [selectedSeasonId], (error, teamsResults) => {
					if (error) {
						console.error("Error fetching teams:", error);
						res.status(500).send("Error fetching teams.");
						return;
					}

					// Fetch the season name associated with the selected season ID
					pool.query("SELECT season_name FROM sdfhl_seasons WHERE season_id = ?", [selectedSeasonId], (error, seasonNameResult) => {
						if (error) {
							console.error("Error fetching season name:", error);
							res.status(500).send("Error fetching season name.");
							return;
						}

						const seasonName = seasonNameResult.length > 0 ? seasonNameResult[0].season_name : "";

						// Render the teams page and pass the fetched teams data, seasons data, and season name to it
						res.render("teams", {
							title: "Teams",
							teams: teamsResults,
							seasons: seasonsResults,
							selectedSeasonId: selectedSeasonId,
							seasonName: seasonName,
							username: req.session.username,
						});
					});
				});
			});
		});
	} catch (err) {
		console.error("Error fetching teams:", err);
		res.status(500).send("Error fetching teams.");
	}
});

// Render the add team form
router.get("/add", (req, res) => {
	const selectedSeasonId = req.query.selectedSeasonId; // Retrieve selectedSeasonId from query parameters

	// Fetch all players from the database
	pool.query("SELECT * FROM sdfhl_players ORDER BY player_first", (error, playerResults) => {
		if (error) {
			console.error("Error fetching players:", error);
			res.status(500).send("Error fetching players.");
			return;
		}

		const players = playerResults;

		// Fetch players with player_positions containing '3' from the database
		pool.query("SELECT * FROM sdfhl_players WHERE player_positions LIKE '%3%' ORDER BY player_first", (error, playerResults) => {
			if (error) {
				console.error("Error fetching players:", error);
				res.status(500).send("Error fetching players.");
				return;
			}

			const goaliePlayers = playerResults;

			// Fetch all seasons from the database
			pool.query("SELECT * FROM sdfhl_seasons", (error, seasonResults) => {
				if (error) {
					console.error("Error fetching seasons:", error);
					res.status(500).send("Error fetching seasons.");
					return;
				}
				res.render("add-team", {title: "Add Team", players, seasons: seasonResults, selectedSeasonId, goaliePlayers, username: req.session.username});
			});
		});
	});
});

// Add a new player
router.post("/add", upload.single("player_picture"), async (req, res) => {
	try {
		const {team_name, team_division, team_color, team_players, team_captain, team_goalie, team_season, team_season_playoff, team_playoff_rank, team_hex} = req.body;

		// Remove "#" symbol from team_hex
		const sanitizedHex = team_hex.replace("#", "");
		const teamPlayersCSV = team_players.join(",");

		// Insert the new team into the database
		pool.query("INSERT INTO sdfhl_teams (team_name, team_division, team_color, team_players, team_captain, team_goalie, team_season, team_season_playoff, team_playoff_rank, team_hex) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [team_name, team_division, team_color, teamPlayersCSV, team_captain, team_goalie, team_season, team_season_playoff, team_playoff_rank, sanitizedHex], (error, results) => {
			if (error) {
				console.error("Error adding team:", error);
				res.status(500).send("Error adding team.");
				return;
			}
			res.redirect("/teams");
		});
	} catch (err) {
		console.error(err);
		res.status(500).send("Server Error");
	}
});

// Render the edit team form
router.get("/edit/:id", async (req, res) => {
	try {
		const teamId = req.params.id;

		// Fetch the team from the database based on the provided team ID
		pool.query("SELECT * FROM sdfhl_teams WHERE team_id = ?", [teamId], (error, teamResults) => {
			if (error) {
				console.error("Error fetching team:", error);
				res.status(500).send("Error fetching team.");
				return;
			}

			if (teamResults.length === 0) {
				res.status(404).send("Team not found.");
				return;
			}

			const team = teamResults[0];

			pool.query("SELECT * FROM sdfhl_seasons", (error, seasonResults) => {
				if (error) {
					console.error("Error fetching season:", error);
					res.status(500).send("Error fetching season.");
					return;
				}

				if (seasonResults.length === 0) {
					res.status(404).send("Season not found.");
					return;
				}

				const seasons = seasonResults;

				// Fetch number of teams in the season
				pool.query("SELECT COUNT(*) AS num_teams FROM sdfhl_teams WHERE team_season = ?", [team.team_season], (error, countResults) => {
					if (error) {
						console.error("Error fetching number of teams:", error);
						res.status(500).send("Error fetching number of teams.");
						return;
					}

					if (countResults.length === 0) {
						res.status(404).send("No teams found for the season.");
						return;
					}

					const numTeams = countResults[0].num_teams;

					// Fetch all players from the database
					pool.query("SELECT * FROM sdfhl_players ORDER BY player_first", (error, playerResults) => {
						if (error) {
							console.error("Error fetching players:", error);
							res.status(500).send("Error fetching players.");
							return;
						}

						const players = playerResults;

						// Fetch player_first and player_last for each player in the team
						const teamPlayers = team.team_players.split(",").map((playerId) => parseInt(playerId.trim()));

						const playerNames = [];
						players.forEach((player) => {
							if (teamPlayers.includes(player.player_id)) {
								playerNames.push(`${player.player_first} ${player.player_last}`);
							}
						});

						// Render the edit-team template and pass necessary data
						res.render("edit-team", {
							title: "Edit Team",
							team,
							players: res.locals.players,
							teamPlayers,
							playerNames,
							players,
							seasons,
							numTeams,
							username: req.session.username,
						});
					});
				});
			});
		});
	} catch (err) {
		console.error(err);
		res.status(500).send("Server Error");
	}
});

// Update team information
router.post("/edit/:id", async (req, res) => {
	try {
		const teamId = req.params.id;

		// Handle form submission and update the team in the database
		const {team_name, team_division, team_color, team_players, team_captain, team_goalie, team_season, team_season_playoff, team_playoff_rank, team_hex} = req.body;

		const sanitizedHex = team_hex.replace("#", "");
		const teamPlayersCSV = team_players.join(",");

		pool.query("UPDATE sdfhl_teams SET team_name = ?, team_division = ?, team_color = ?, team_players = ?, team_captain = ?, team_goalie = ?, team_season = ?, team_season_playoff = ?, team_playoff_rank = ?, team_hex = ? WHERE team_id = ?", [team_name, team_division, team_color, teamPlayersCSV, team_captain, team_goalie, team_season, team_season_playoff, team_playoff_rank, sanitizedHex, teamId], (error, results) => {
			if (error) {
				console.error("Error updating team:", error);
				res.status(500).send("Error updating team.");
				return;
			}
			res.redirect("/teams");
		});
	} catch (err) {
		console.error(err);
		res.status(500).send("Server Error");
	}
});

// Define a route to fetch players of a team
router.get("/edit/:teamId/players", async (req, res) => {
	try {
		const teamId = req.params.teamId;

		// Query the database to fetch the comma-separated list of player IDs for the specified team
		const query = `
            SELECT 
                team_players
            FROM 
                sdfhl_teams
            WHERE 
                team_id = ?`;

		pool.query(query, [teamId], (error, results) => {
			if (error) {
				console.error("Error fetching team players:", error);
				res.status(500).json({error: "Error fetching team players"});
				return;
			}

			if (results.length === 0) {
				console.error("Team not found");
				res.status(404).json({error: "Team not found"});
				return;
			}

			const teamPlayersCSV = results[0].team_players;
			const playerIds = teamPlayersCSV.split(",");

			// Query the database to fetch player details for each player ID
			const playerQuery = `
                SELECT 
                    player_id,
                    player_first,
                    player_last
                FROM 
                    sdfhl_players
                WHERE 
                    player_id IN (?)`;

			pool.query(playerQuery, [playerIds], (playerError, playerResults) => {
				if (playerError) {
					console.error("Error fetching players:", playerError);
					res.status(500).json({error: "Error fetching players"});
					return;
				}

				// Send the fetched players as JSON response
				res.json(playerResults);
			});
		});
	} catch (error) {
		console.error("Server error:", error);
		res.status(500).json({error: "Server error"});
	}
});

module.exports = router;
