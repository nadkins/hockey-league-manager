// routes/schedules.js

const express = require("express");
const router = express.Router();
const pool = require("../database"); // Assuming you have a database connection pool defined in a separate file
const {fetchPlayerDataById} = require("../playerUtils"); // Import the fetchPlayerDataById function

// Display all seasons schedule
router.get("/", async (req, res) => {
	try {
		// Fetch active season ID
		pool.query("SELECT season_id FROM sdfhl_seasons WHERE season_active = 1", async (error, seasonResults) => {
			if (error) {
				console.error("Error fetching active season:", error);
				res.status(500).send("Error fetching active season.");
				return;
			}

			const activeSeasonId = seasonResults.length > 0 ? seasonResults[0].season_id : null;

			try {
				// Fetch schedule data for the active season from the sdfhl_schedule table
				const scheduleQuery = `
					SELECT 
						s.*, 
						t1.team_name AS home_team_name, 
						t2.team_name AS away_team_name, 
						p1.player_first AS scorekeeper_first, 
						p1.player_last AS scorekeeper_last, 
						p2.player_first AS ref1_first, 
						p2.player_last AS ref1_last, 
						p3.player_first AS ref2_first, 
						p3.player_last AS ref2_last, 
						p4.player_first AS ref3_first, 
						p4.player_last AS ref3_last, 
						p5.player_first AS ref4_first, 
						p5.player_last AS ref4_last 
					FROM 
						sdfhl_schedule s 
					LEFT JOIN 
						sdfhl_teams t1 ON s.schedule_home = t1.team_id 
					LEFT JOIN 
						sdfhl_teams t2 ON s.schedule_visitor = t2.team_id 
					LEFT JOIN 
						sdfhl_players p1 ON s.schedule_scorekeeper = p1.player_id 
					LEFT JOIN 
						sdfhl_players p2 ON s.schedule_ref1 = p2.player_id 
					LEFT JOIN 
						sdfhl_players p3 ON s.schedule_ref2 = p3.player_id 
					LEFT JOIN 
						sdfhl_players p4 ON s.schedule_ref3 = p4.player_id 
					LEFT JOIN 
						sdfhl_players p5 ON s.schedule_ref4 = p5.player_id 
					WHERE 
						s.schedule_season = ?
					ORDER BY 
						s.schedule_week`;

				const scheduleResults = await new Promise((resolve, reject) => {
					pool.query(scheduleQuery, [activeSeasonId], (error, scheduleResults) => {
						if (error) {
							reject(error);
						} else {
							resolve(scheduleResults);
						}
					});
				});

				// Fetch all seasons from the sdfhl_seasons table
				pool.query("SELECT * FROM sdfhl_seasons", (error, seasonResults) => {
					if (error) {
						console.error("Error fetching seasons:", error);
						res.status(500).send("Error fetching seasons.");
						return;
					}

					// Render the schedule page and pass the fetched schedule data to it
					res.render("schedules", {
						title: "All Seasons Schedule",
						seasons: seasonResults,
						schedule: scheduleResults,
						seasonId: activeSeasonId,
						username: req.session.username,
					});
				});
			} catch (fetchError) {
				console.error("Error fetching schedule data:", fetchError);
				res.status(500).send("Error fetching schedule data.");
			}
		});
	} catch (err) {
		console.error(err);
		res.status(500).send("Server Error");
	}
});

// Display season schedule
router.get("/:id", async (req, res) => {
	try {
		// Check if season ID is provided
		const seasonId = req.params.id || req.query.activeSeasonId;

		if (seasonId) {
			// Fetch schedule data for the specified season from the database
			const query = `
                SELECT 
                    s.*, 
                    DATE_FORMAT(s.schedule_time, '%M %e, %Y') AS schedule_date,
                    DATE_FORMAT(s.schedule_time, '%h:%i %p') AS schedule_time,
                    t1.team_name AS home_team_name, 
                    t2.team_name AS away_team_name, 
                    CONCAT(p1.player_first, ' ', p1.player_last) AS scorekeeper_name, 
                    CONCAT(p2.player_first, ' ', p2.player_last) AS ref1_name, 
                    CONCAT(p3.player_first, ' ', p3.player_last) AS ref2_name, 
                    CONCAT(p4.player_first, ' ', p4.player_last) AS ref3_name, 
                    CONCAT(p5.player_first, ' ', p5.player_last) AS ref4_name 
                FROM 
                    sdfhl_schedule s 
                LEFT JOIN 
                    sdfhl_teams t1 ON s.schedule_home = t1.team_id 
                LEFT JOIN 
                    sdfhl_teams t2 ON s.schedule_visitor = t2.team_id 
                LEFT JOIN 
                    sdfhl_players p1 ON s.schedule_scorekeeper = p1.player_id 
                LEFT JOIN 
                    sdfhl_players p2 ON s.schedule_ref1 = p2.player_id 
                LEFT JOIN 
                    sdfhl_players p3 ON s.schedule_ref2 = p3.player_id 
                LEFT JOIN 
                    sdfhl_players p4 ON s.schedule_ref3 = p4.player_id 
                LEFT JOIN 
                    sdfhl_players p5 ON s.schedule_ref4 = p5.player_id 
                WHERE 
                    s.schedule_season = ?`;

			pool.query(query, [seasonId], async (error, scheduleResults) => {
				if (error) {
					console.error("Error fetching schedule:", error);
					res.status(500).send("Error fetching schedule.");
					return;
				}

				// Fetch all seasons from the sdfhl_seasons table
				pool.query("SELECT * FROM sdfhl_seasons", (error, seasonResults) => {
					if (error) {
						console.error("Error fetching seasons:", error);
						res.status(500).send("Error fetching seasons.");
						return;
					}

					// Render the schedule page and pass the fetched schedule, seasons data, and player data to it
					res.render("schedules", {
						title: "Season Schedule",
						schedule: scheduleResults,
						seasons: seasonResults,
						seasonId,
						username: req.session.username,
					});
				});
			});
		} else {
			// Fetch schedule data for all seasons from the database
			pool.query(
				`
                SELECT 
                    s.*, 
                    DATE_FORMAT(s.schedule_time, '%M %e, %Y') AS schedule_date,
                    DATE_FORMAT(s.schedule_time, '%h:%i %p') AS schedule_time,
                    t1.team_name AS home_team_name, 
                    t2.team_name AS away_team_name, 
                    CONCAT(p1.player_first, ' ', p1.player_last) AS scorekeeper_name, 
                    CONCAT(p2.player_first, ' ', p2.player_last) AS ref1_name, 
                    CONCAT(p3.player_first, ' ', p3.player_last) AS ref2_name, 
                    CONCAT(p4.player_first, ' ', p4.player_last) AS ref3_name, 
                    CONCAT(p5.player_first, ' ', p5.player_last) AS ref4_name 
                FROM 
                    sdfhl_schedule s 
                LEFT JOIN 
                    sdfhl_teams t1 ON s.schedule_home = t1.team_id 
                LEFT JOIN 
                    sdfhl_teams t2 ON s.schedule_visitor = t2.team_id 
                LEFT JOIN 
                    sdfhl_players p1 ON s.schedule_scorekeeper = p1.player_id 
                LEFT JOIN 
                    sdfhl_players p2 ON s.schedule_ref1 = p2.player_id 
                LEFT JOIN 
                    sdfhl_players p3 ON s.schedule_ref2 = p3.player_id 
                LEFT JOIN 
                    sdfhl_players p4 ON s.schedule_ref3 = p4.player_id 
                LEFT JOIN 
                    sdfhl_players p5 ON s.schedule_ref4 = p5.player_id`,
				async (error, scheduleResults) => {
					if (error) {
						console.error("Error fetching schedule:", error);
						res.status(500).send("Error fetching schedule.");
						return;
					}
					// Sort the schedule by week number
					scheduleResults.sort((a, b) => a.schedule_week - b.schedule_week);

					// Fetch all seasons from the sdfhl_seasons table
					pool.query("SELECT * FROM sdfhl_seasons", (error, seasonResults) => {
						if (error) {
							console.error("Error fetching seasons:", error);
							res.status(500).send("Error fetching seasons.");
							return;
						}

						// Render the schedule page and pass the fetched schedule and seasons data to it
						res.render("schedules", {
							title: "Season Schedule",
							schedule: scheduleResults,
							seasons: seasonResults,
							username: req.session.username,
						});
					});
				}
			);
		}
	} catch (err) {
		console.error(err);
		res.status(500).send("Server Error");
	}
});

// Render add new game form
router.get("/add/:id", async (req, res) => {
	try {
		const seasonId = req.params.id;

		// Fetch season information
		const seasonQuery = "SELECT * FROM sdfhl_seasons WHERE season_id = ?";
		pool.query(seasonQuery, [seasonId], (seasonError, seasonResults) => {
			if (seasonError) {
				console.error("Error fetching season:", seasonError);
				res.status(500).send("Error fetching season.");
				return;
			}

			const season = seasonResults[0];

			// Fetch all teams with the same season_id as the schedule's season_id
			const teamsQuery = "SELECT * FROM sdfhl_teams WHERE team_season = ?";
			pool.query(teamsQuery, [seasonId], (teamsError, teamResults) => {
				if (teamsError) {
					console.error("Error fetching teams:", teamsError);
					res.status(500).send("Error fetching teams.");
					return;
				}

				// Fetch all players from the sdfhl_players table
				const playersQuery = "SELECT * FROM sdfhl_players";
				pool.query(playersQuery, (playersError, playerResults) => {
					if (playersError) {
						console.error("Error fetching players:", playersError);
						res.status(500).send("Error fetching players.");
						return;
					}

					// Fetch the total number of weeks for the season
					pool.query("SELECT MAX(schedule_week) AS total_weeks FROM sdfhl_schedule WHERE schedule_season = ?", [seasonId], (weeksError, weeksResults) => {
						if (weeksError) {
							console.error("Error fetching weeks:", weeksError);
							res.status(500).send("Error fetching weeks.");
							return;
						}

						const totalWeeks = weeksResults[0].total_weeks;

						const teams = teamResults;
						const players = playerResults;

						// Render the schedule page and pass the fetched schedule, teams, players, total weeks, and season data to it
						res.render("add-schedules", {title: "Add New Game", teams, players, totalWeeks, season, username: req.session.username});
					});
				});
			});
		});
	} catch (error) {
		console.error("Error rendering add new game form:", error);
		res.status(500).send("Error rendering add new game form.");
	}
});

// Add a new game
router.post("/add", async (req, res) => {
	try {
		// Process form data and save the schedule
		const {schedule_season, schedule_week, schedule_time, schedule_home, schedule_visitor, schedule_sk_team, schedule_scorekeeper, schedule_ref1, schedule_ref2, schedule_ref3, schedule_ref4, schedule_postponed, schedule_makeup, schedule_makeupwk, schedule_makeupgm} = req.body;

		console.log("Received form data:", req.body);

		// Set schedule_postponed to 0 if not provided
		const postponed = schedule_postponed || 0;

		// If schedule_makeup is 0, set schedule_makeupwk to 0
		const makeupWkValue = schedule_makeup === "0" ? 0 : schedule_makeupwk;

		// Set schedule_makeupgm to 0 if not provided
		const makeupGmValue = schedule_makeupgm !== undefined ? schedule_makeupgm : 0;

		// Convert schedule_time to Unix timestamp
		const scheduleTimeUnix = new Date(schedule_time).toISOString().slice(0, 19).replace("T", " ");

		console.log("Inserting new game into the database...");

		// Execute the SQL query to insert the new schedule
		pool.query("INSERT INTO sdfhl_schedule (schedule_season, schedule_week, schedule_time, schedule_home, schedule_visitor, schedule_sk_team, schedule_scorekeeper, schedule_ref1, schedule_ref2, schedule_ref3, schedule_ref4, schedule_postponed, schedule_makeup, schedule_makeupwk, schedule_makeupgm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [schedule_season, schedule_week, scheduleTimeUnix, schedule_home, schedule_visitor, schedule_sk_team, schedule_scorekeeper, schedule_ref1, schedule_ref2, schedule_ref3, schedule_ref4, postponed, schedule_makeup, makeupWkValue, makeupGmValue], (error, results) => {
			if (error) {
				console.error("Error adding new game:", error);
				res.status(500).send(`Error adding new game: ${error.message}`); // Send error message as response
				return;
			}

			console.log("New game added successfully.");

			// Redirect to the schedule page after adding the game
			res.redirect("/schedules");
		});
	} catch (err) {
		console.error("Error adding new game:", err);
		res.status(500).send(`Error adding new game: ${err.message}`); // Send error message as response
	}
});

// Render edit schedule form
router.get("/edit/:id", async (req, res) => {
	try {
		const scheduleId = req.params.id;
		// Fetch the schedule from the database based on the provided schedule ID
		const query = `
            SELECT 
                s.*, 
                t1.team_name AS home_team_name,
                t2.team_name AS away_team_name,
                CONCAT(p.player_first, ' ', p.player_last) AS scorekeeper_name,
                CONCAT(p1.player_first, ' ', p1.player_last) AS ref1_name,
                CONCAT(p2.player_first, ' ', p2.player_last) AS ref2_name,
                CONCAT(p3.player_first, ' ', p3.player_last) AS ref3_name,
                CONCAT(p4.player_first, ' ', p4.player_last) AS ref4_name,
                DATE_FORMAT(CONCAT(s.schedule_time), '%Y-%m-%dT%H:%i') AS schedule_timestamp
            FROM 
                sdfhl_schedule s
            LEFT JOIN 
                sdfhl_teams t1 ON s.schedule_home = t1.team_id
            LEFT JOIN 
                sdfhl_teams t2 ON s.schedule_visitor = t2.team_id
            LEFT JOIN
                sdfhl_players p ON s.schedule_scorekeeper = p.player_id
            LEFT JOIN
                sdfhl_players p1 ON s.schedule_ref1 = p1.player_id
            LEFT JOIN
                sdfhl_players p2 ON s.schedule_ref2 = p2.player_id
            LEFT JOIN
                sdfhl_players p3 ON s.schedule_ref3 = p3.player_id
            LEFT JOIN
                sdfhl_players p4 ON s.schedule_ref4 = p4.player_id
            WHERE 
                s.schedule_id = ?`;

		pool.query(query, [scheduleId], (error, results) => {
			if (error) {
				console.error("Error fetching schedule:", error);
				res.status(500).send("Error fetching schedule.");
				return;
			}

			if (results.length === 0) {
				res.status(404).send("Schedule not found.");
				return;
			}

			const schedule = results[0];
			const seasonId = schedule.schedule_season;

			// Fetch all teams with the same season_id as the schedule's season_id
			const teamsQuery = "SELECT * FROM sdfhl_teams WHERE team_season = ?";
			pool.query(teamsQuery, [seasonId], (teamsError, teamResults) => {
				if (teamsError) {
					console.error("Error fetching teams:", teamsError);
					res.status(500).send("Error fetching teams.");
					return;
				}

				// Fetch all players from the sdfhl_players table
				pool.query("SELECT * FROM sdfhl_players", (playersError, playerResults) => {
					if (playersError) {
						console.error("Error fetching players:", playersError);
						res.status(500).send("Error fetching players.");
						return;
					}

					// Fetch the total number of weeks for the season
					pool.query("SELECT MAX(schedule_week) AS total_weeks FROM sdfhl_schedule WHERE schedule_season = ?", [seasonId], (weeksError, weeksResults) => {
						if (weeksError) {
							console.error("Error fetching weeks:", weeksError);
							res.status(500).send("Error fetching weeks.");
							return;
						}

						const totalWeeks = weeksResults[0].total_weeks;

						// Fetch matchups for the selected week
						pool.query("SELECT * FROM sdfhl_schedule WHERE schedule_season = ? AND schedule_week = ?", [seasonId, schedule.schedule_week], (matchupsError, matchupsResults) => {
							if (matchupsError) {
								console.error("Error fetching matchups:", matchupsError);
								res.status(500).send("Error fetching matchups.");
								return;
							}

							const matchups = matchupsResults;

							const players = playerResults;
							const teams = teamResults;
							res.render("edit-schedules", {title: "Edit Schedule", schedule, players, teams, totalWeeks, matchups, username: req.session.username});
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

router.post("/edit/:id", async (req, res) => {
	try {
		const scheduleId = req.params.id;
		// Process form data and update the schedule in the database
		const {schedule_season, schedule_week, schedule_time, schedule_home, schedule_visitor, schedule_sk_team, schedule_scorekeeper, schedule_ref1, schedule_ref2, schedule_ref3, schedule_ref4, schedule_postponed, schedule_makeupgm, schedule_makeupwk, schedule_makeup} = req.body;

		// Perform validation (example)
		if (!schedule_home || !schedule_visitor || !schedule_season || !schedule_week || !schedule_time) {
			return res.status(400).send("Required fields are missing.");
		}

		// Convert schedule_time to Unix timestamp
		const scheduleTimeUnix = new Date(schedule_time).toISOString().slice(0, 19).replace("T", " ");

		// Determine makeup game values
		let makeupWkValue = schedule_makeup === "0" ? 0 : schedule_makeupwk;
		let makeupGmValue = schedule_makeup === "0" ? 0 : schedule_makeupgm;

		// Update schedule in the database
		pool.query("UPDATE sdfhl_schedule SET schedule_season = ?, schedule_week = ?, schedule_time = ?, schedule_home = ?, schedule_visitor = ?, schedule_sk_team = ?, schedule_scorekeeper = ?, schedule_ref1 = ?, schedule_ref2 = ?, schedule_ref3 = ?, schedule_ref4 = ?, schedule_postponed = ?, schedule_makeupgm = ?, schedule_makeupwk = ?, schedule_makeup = ? WHERE schedule_id = ?", [schedule_season, schedule_week, scheduleTimeUnix, schedule_home, schedule_visitor, schedule_sk_team, schedule_scorekeeper, schedule_ref1, schedule_ref2, schedule_ref3, schedule_ref4, schedule_postponed, makeupGmValue, makeupWkValue, schedule_makeup, scheduleId], (error, results) => {
			if (error) {
				console.error("Error updating schedule:", error);
				res.status(500).send("Error updating schedule.");
				return;
			}
			res.redirect("/schedules?updated=true");
		});
	} catch (err) {
		console.error(err);
		res.status(500).send("Server Error");
	}
});

// Define a route to fetch matchups for a specific week and season
router.get("/matchups/:season/:week", async (req, res) => {
	try {
		const week = req.params.week;
		const season = req.params.season;

		// Query the database to fetch matchups for the specified week and season
		const query = `
            SELECT 
                s.schedule_id,
                th.team_name AS home_team_name,
                tv.team_name AS away_team_name
            FROM 
                sdfhl_schedule s
            LEFT JOIN 
                sdfhl_teams th ON s.schedule_home = th.team_id
            LEFT JOIN 
                sdfhl_teams tv ON s.schedule_visitor = tv.team_id
            WHERE 
                s.schedule_week = ? AND s.schedule_season = ?`;

		pool.query(query, [week, season], (error, results) => {
			if (error) {
				console.error("Error fetching matchups:", error);
				res.status(500).json({error: "Error fetching matchups"});
				return;
			}

			// Send the matchups as JSON response
			res.json(results);
		});
	} catch (error) {
		console.error("Server error:", error);
		res.status(500).json({error: "Server error"});
	}
});

module.exports = router;
