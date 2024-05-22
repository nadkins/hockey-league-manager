// Assuming you have already set up your Express.js app
const express = require("express");
const router = express.Router();
const pool = require("../database"); // Assuming you have a database connection pool defined in a separate file
const {fetchPlayerDataById, fetchTeamGoalieById, checkAttendance, checkGoalieAttendance, checkAttendanceSubs, getGameScoreSummary, getGamePenaltySummary, getGameShotSummary, getGameStarsSummary} = require("../playerUtils"); // Import required functions from playerUtils.js

// Middleware to parse request bodies
router.use(express.urlencoded({extended: true}));

// Route to handle the form submission
router.post("/:scheduleID/referee", async (req, res) => {
	try {
		const scheduleID = req.params.scheduleID;
		const schedule_ref1 = req.body.schedule_ref1;
		const schedule_ref2 = req.body.schedule_ref2;
		const schedule_ref3 = req.body.schedule_ref3;
		const schedule_ref4 = req.body.schedule_ref4;
		const schedule_scorekeeper = req.body.schedule_scorekeeper;

		const updateQuery = `
            UPDATE sdfhl_schedule
            SET schedule_ref1 = ?,
				schedule_ref2 = ?,
				schedule_ref3 = ?,
				schedule_ref4 = ?,
				schedule_scorekeeper = ?
            WHERE schedule_id = ?`;

		pool.query(updateQuery, [schedule_ref1, schedule_ref2, schedule_ref3, schedule_ref4, schedule_scorekeeper, scheduleID], (error, results) => {
			if (error) {
				console.error("Error updating referees:", error);
				res.status(500).send("Error updating referees.");
				return;
			}

			// Send a response indicating success
			res.redirect(`/gamestats/${scheduleID}?updated=true`);
		});
	} catch (err) {
		console.error("Error updating referees:", err);
		res.status(500).send("Error updating referees.");
	}
});

// Route to handle the form submission
router.post("/:scheduleID/attendance", async (req, res) => {
	try {
		const scheduleID = req.params.scheduleID;
		const attendanceTeam = req.body.attendance_team;
		const attendanceGoalie = req.body.attendance_goalie || [];
		const attendanceSubG = req.body.attendance_subG || [];
		const attendancePlayers = req.body.attendance_players || [];
		const attendanceSubs = req.body.attendance_subs || [];

		const updateQuery = `
            UPDATE sdfhl_attendance
            SET attendance_goalie = ?,
                attendance_subG = ?,
                attendance_players = ?,
                attendance_subs = ?
            WHERE attendance_game = ? AND attendance_team = ?`;

		pool.query(updateQuery, [attendanceGoalie.join(","), attendanceSubG.join(","), attendancePlayers.join(","), attendanceSubs.join(","), scheduleID, attendanceTeam], (error, results) => {
			if (error) {
				console.error("Error updating attendance:", error);
				res.status(500).send("Error updating attendance.");
				return;
			}

			// Send a response indicating success
			res.redirect(`/gamestats/${scheduleID}?updated=true`);
		});
	} catch (err) {
		console.error("Error updating attendance:", err);
		res.status(500).send("Error updating attendance.");
	}
});

router.get("/:scheduleID", async (req, res) => {
	try {
		const scheduleID = req.params.scheduleID;

		console.log("Fetching schedule information...");

		// Query to retrieve schedule information including team IDs
		const query = `
            SELECT s.*, 
                   th.team_name AS home_team_name, 
                   tv.team_name AS visitor_team_name,
                   th.team_goalie AS home_team_goalie,
                   tv.team_goalie AS visitor_team_goalie,
                   s.schedule_home AS home_team_id,
                   s.schedule_visitor AS visitor_team_id,
				   s.schedule_ref1 AS schedule_ref1,
				   s.schedule_ref2 AS schedule_ref2,
				   s.schedule_ref3 AS schedule_ref3,
				   s.schedule_ref4 AS schedule_ref4,
				   s.schedule_scorekeeper AS schedule_scorekeeper
            FROM sdfhl_schedule s
            LEFT JOIN sdfhl_teams th ON s.schedule_home = th.team_id
            LEFT JOIN sdfhl_teams tv ON s.schedule_visitor = tv.team_id
            WHERE s.schedule_id = ?`;

		pool.query(query, [scheduleID], async (error, results) => {
			if (error) {
				console.error("Error fetching game stats:", error);
				res.status(500).send("Error fetching game stats.");
				return;
			}

			if (results.length === 0) {
				console.log("Schedule not found.");
				res.status(404).send("Schedule not found.");
				return;
			}

			const schedule = results[0];

			console.log("Fetching players for the home team...");

			// Query to retrieve players for the home team
			const homePlayersQuery = `
                SELECT team_players
                FROM sdfhl_teams
                WHERE team_id = ?`;

			pool.query(homePlayersQuery, [schedule.home_team_id], async (homeError, homeResults) => {
				if (homeError) {
					console.error("Error fetching home team players:", homeError);
					res.status(500).send("Error fetching home team players.");
					return;
				}

				console.log("Fetching players for the visitor team...");

				// Query to retrieve players for the visitor team
				const visitorPlayersQuery = `
                    SELECT team_players
                    FROM sdfhl_teams
                    WHERE team_id = ?`;

				pool.query(visitorPlayersQuery, [schedule.visitor_team_id], async (visitorError, visitorResults) => {
					if (visitorError) {
						console.error("Error fetching visitor team players:", visitorError);
						res.status(500).send("Error fetching visitor team players.");
						return;
					}

					console.log("Parsing player IDs and fetching player details...");

					// Parse player IDs and fetch player details for the home team
					const homePlayerIds = homeResults[0].team_players.split(",");
					const homePlayerDetails = await Promise.all(
						homePlayerIds.map(async (playerId) => {
							const player = await fetchPlayerDataById(playerId);
							player.attending = await checkAttendance(scheduleID, schedule.home_team_id, playerId); // Check attendance
							return player;
						})
					);

					// Parse player IDs and fetch player details for the visitor team
					const visitorPlayerIds = visitorResults[0].team_players.split(",");
					const visitorPlayerDetails = await Promise.all(
						visitorPlayerIds.map(async (playerId) => {
							const player = await fetchPlayerDataById(playerId);
							player.attending = await checkAttendance(scheduleID, schedule.visitor_team_id, playerId); // Check attendance
							return player;
						})
					);

					// Query to fetch all players
					const allPlayersQuery = `
                        SELECT player_id, player_first, player_last, player_positions
                        FROM sdfhl_players`;

					pool.query(allPlayersQuery, async (allPlayersError, allPlayers) => {
						if (allPlayersError) {
							console.error("Error fetching all players:", allPlayersError);
							res.status(500).send("Error fetching all players.");
							return;
						}

						const scheduleRef1 = await fetchPlayerDataById(schedule.schedule_ref1);
						const scheduleRef2 = await fetchPlayerDataById(schedule.schedule_ref2);
						const scheduleRef3 = await fetchPlayerDataById(schedule.schedule_ref3);
						const scheduleRef4 = await fetchPlayerDataById(schedule.schedule_ref4);
						const schedule_scorekeeper = await fetchPlayerDataById(schedule.schedule_scorekeeper);

						// Fetch team goalies
						const homeTeamGoalie = await fetchTeamGoalieById(schedule.home_team_id);
						const visitorTeamGoalie = await fetchTeamGoalieById(schedule.visitor_team_id);

						const homeGoalieData = await fetchPlayerDataById(homeTeamGoalie);
						homeGoalieData.attending = await checkGoalieAttendance(scheduleID, schedule.home_team_id, homeTeamGoalie); // Check attendance
						const visitorGoalieData = await fetchPlayerDataById(visitorTeamGoalie);
						visitorGoalieData.attending = await checkGoalieAttendance(scheduleID, schedule.visitor_team_id, visitorTeamGoalie); // Check attendance

						const homeSubs = await checkAttendanceSubs(scheduleID, schedule.home_team_id);

						// Extract attendanceSubs and attendanceSubG from homeSubs
						const {attendanceSubs: homeAttendanceSubs, attendanceSubG: homeAttendanceSubG} = homeSubs;

						const visitorSubs = await checkAttendanceSubs(scheduleID, schedule.visitor_team_id);

						// Extract attendanceSubs and attendanceSubG from visitorSubs
						const {attendanceSubs: visitorAttendanceSubs, attendanceSubG: visitorAttendanceSubG} = visitorSubs;

						// Fetch player data for homeAttendanceSubG
						const homeAttendanceSubGData = await Promise.all(
							homeAttendanceSubG.map(async (playerId) => {
								return await fetchPlayerDataById(playerId);
							})
						);

						// Fetch player data for visitorAttendanceSubG
						const visitorAttendanceSubGData = await Promise.all(
							visitorAttendanceSubG.map(async (playerId) => {
								return await fetchPlayerDataById(playerId);
							})
						);

						const gameScoreSummary = await getGameScoreSummary(scheduleID);
						const penaltySummary = await getGamePenaltySummary(scheduleID);
						const shotSummary = await getGameShotSummary(scheduleID);
						const starsSummary = await getGameStarsSummary(scheduleID);
						console.log(starsSummary);

						// Render the game-stats page with the retrieved data
						res.render("gamestats", {
							title: "Game Stats",
							username: req.session.username,
							schedule: {
								...schedule,
								home_players: homePlayerDetails,
								visitor_players: visitorPlayerDetails,
								scheduleRef1: scheduleRef1,
								scheduleRef2: scheduleRef2,
								scheduleRef3: scheduleRef3,
								scheduleRef4: scheduleRef4,
								scheduleScorekeeper: schedule_scorekeeper,
								home_team_goalie: homeGoalieData,
								visitor_team_goalie: visitorGoalieData,
								homeSubs: {
									attendanceSubs: homeAttendanceSubs,
									attendanceSubG: homeAttendanceSubGData,
								},
								visitorSubs: {
									attendanceSubs: visitorAttendanceSubs,
									attendanceSubG: visitorAttendanceSubGData,
								},
							},
							all_players: allPlayers, // Pass all players to the template
							gameScoreSummary: gameScoreSummary, // Pass game score summary to the template
							penaltySummary: penaltySummary, // Pass game score summary to the template
							shotSummary: shotSummary, // Pass game shot summary to the template
							starsSummary: starsSummary, // Pass game stars to the template						
						});
					});
				});
			});
		});
	} catch (err) {
		console.error("Error fetching game stats:", err);
		res.status(500).send("Server Error");
	}
});

// Route to handle the form submission for adding a new goal score entry
router.post("/:scheduleID/goalscore", async (req, res) => {
	try {
		const scheduleID = req.params.scheduleID;
		const {gamescore_team, gamescore_period, gamescore_minutes, gamescore_seconds, gamescore_player, gamescore_assist1, gamescore_assist2, gamescore__type, gamescore_notes} = req.body;

		// Concatenate gamescore_minutes with gamescore_seconds using ":"
		const gamescore_time = `${gamescore_minutes}:${gamescore_seconds}`;

		// Convert checkbox values to comma-separated string
		const goalType = gamescore__type.join(",");

		const gamescore_id = null;

		const notes = gamescore_notes || "";

		// Insert the new goal score entry into the sdfhl_gamescore table
		const insertQuery = `INSERT INTO sdfhl_gamescore(gamescore_id, gamescore_game, gamescore_team, gamescore_period, gamescore_time, gamescore_player, gamescore_assist1, gamescore_assist2, gamescore_type, gamescore_notes)VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

		pool.query(insertQuery, [gamescore_id, scheduleID, gamescore_team, gamescore_period, gamescore_time, gamescore_player, gamescore_assist1, gamescore_assist2, goalType, notes], (error, results) => {
			if (error) {
				console.error("Error adding goal score entry:", error);
				res.status(500).send("Error adding goal score entry.");
				return;
			}

			// Redirect back to the gamestats page with a success message
			res.redirect(`/gamestats/${scheduleID}?goalAdded=true`);
		});
	} catch (err) {
		console.error("Error adding goal score entry:", err);
		res.status(500).send("Error adding goal score entry.");
	}
});

// Route to handle the form submission for updating a goal score entry
router.post("/:scheduleID/goalscore/:gamescoreID", async (req, res) => {
	try {
		const scheduleID = req.params.scheduleID;
		const gamescoreID = req.params.gamescoreID;
		const {gamescore_team, gamescore_period, gamescore_time, gamescore_player, gamescore_assist1, gamescore_assist2, gamescore_notes, gamescore_type} = req.body;

		// Combine gamescore_time values into a single string separated by colon
		const combinedTime = gamescore_time.join(":");

		// Convert checkbox values to comma-separated string
		const goalType = Array.isArray(gamescore_type) ? gamescore_type.join(",") : gamescore_type;

		// Update the goal score entry in the sdfhl_gamescore table
		const updateQuery = `
            UPDATE sdfhl_gamescore
            SET
                gamescore_team = ?,
                gamescore_period = ?,
                gamescore_time = ?,
                gamescore_player = ?,
                gamescore_assist1 = ?,
                gamescore_assist2 = ?,
                gamescore_type = ?,
                gamescore_notes = ?
            WHERE
                gamescore_id = ?
                AND gamescore_game = ?
        `;

		// Execute the query
		pool.query(updateQuery, [gamescore_team, gamescore_period, combinedTime, gamescore_player, gamescore_assist1, gamescore_assist2, goalType, gamescore_notes, gamescoreID, scheduleID], (error, results) => {
			if (error) {
				console.error("Error updating goal score entry:", error);
				res.status(500).send("Error updating goal score entry.");
				return;
			}

			// Redirect back to the gamestats page with a success message
			res.redirect(`/gamestats/${scheduleID}?goalUpdated=true`);
		});
	} catch (err) {
		console.error("Error updating goal score entry:", err);
		res.status(500).send("Error updating goal score entry.");
	}
});

// Route to handle the form submission for deleting a goal score entry
router.post("/:gamescoreID/goalscore/:gameID/delete", async (req, res) => {
	try {
		const gamescoreID = req.params.gamescoreID;
		const gameID = req.params.gameID;

		// Validate parameters
		if (!gamescoreID || !gameID) {
			throw new Error("Missing gamescoreID or gameID");
		}

		// Update the goal score entry in the sdfhl_gamescore table
		const deleteQuery = `
            DELETE FROM sdfhl_gamescore
            WHERE
                gamescore_id = ?
        `;

		// Execute the query
		pool.query(deleteQuery, [gamescoreID], (error, results) => {
			if (error) {
				console.error("Error deleting goal score entry:", error);
				return res.status(500).send("Error deleting goal score entry.");
			}

			// Check if any rows were affected
			if (results.affectedRows === 0) {
				console.error("No goal score entry found for deletion");
				return res.status(404).send("Goal score entry not found.");
			}

			// Redirect back to the gamestats page with a success message
			res.redirect(`/gamestats/${gameID}?goalUpdated=true`);
		});
	} catch (err) {
		console.error("Error deleting goal score entry:", err);
		res.status(500).send("Error deleting goal score entry.");
	}
});

// Route to handle the form submission for deleting a shootout entry
router.post("/:shootoutID/shootout/:gameID/delete", async (req, res) => {
	try {
		const shootoutID = req.params.shootoutID;
		const gameID = req.params.gameID;

		// Validate parameters
		if (!shootoutID || !gameID) {
			throw new Error("Missing gamescoreID or gameID");
		}

		// Update the goal score entry in the sdfhl_gamescore table
		const deleteQuery = `
            DELETE FROM sdfhl_shootout
            WHERE
                shootout_id = ?
        `;

		// Execute the query
		pool.query(deleteQuery, [shootoutID], (error, results) => {
			if (error) {
				console.error("Error deleting shootout entry:", error);
				return res.status(500).send("Error deleting shootout entry.");
			}

			// Check if any rows were affected
			if (results.affectedRows === 0) {
				console.error("No shootout entry found for deletion");
				return res.status(404).send("shootout entry not found.");
			}

			// Redirect back to the gamestats page with a success message
			res.redirect(`/gamestats/${gameID}?shootoutUpdated=true`);
		});
	} catch (err) {
		console.error("Error deleting shootout entry:", err);
		res.status(500).send("Error deleting shootout entry.");
	}
});

router.post("/shootout/:gameID/", async (req, res) => {
    try {
		const gameID = req.params.gameID;
        // Extract the shootout entry data from the request body
        const { shootout_team, shootout_game, shootout_player, shootout_round, shootout_goal } = req.body;
		const shootout_id = null;

        // Insert the shootout entry into the sdfhl_shootout table
        const insertQuery = `
            INSERT INTO sdfhl_shootout (shootout_id, shootout_team, shootout_game, shootout_player, shootout_round, shootout_goal)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        // Execute the query
        pool.query(insertQuery, [shootout_id, shootout_team, shootout_game, shootout_player, shootout_round, shootout_goal], (error, results) => {
            if (error) {
                console.error('Error adding shootout entry:', error);
                res.status(500).send('Error adding shootout entry.');
                return;
            }
            
			// Redirect back to the gamestats page with a success message
			res.redirect(`/gamestats/${gameID}?shootoutUpdated=true`);
        });
    } catch (err) {
        console.error('Error adding shootout entry:', err);
        res.status(500).send('Error adding shootout entry.');
    }
});

// Route to handle the form submission for deleting a penalty entry
router.post("/:penaltyID/penalty/:gameID/delete", async (req, res) => {
	try {
		const penaltyID = req.params.penaltyID;
		const gameID = req.params.gameID;

		// Validate parameters
		if (!penaltyID || !gameID) {
			throw new Error("Missing penaltyID or gameID");
		}

		// Update the goal penalty entry in the sdfhl_penalty table
		const deleteQuery = `
            DELETE FROM sdfhl_penalties
            WHERE
                penalty_id = ?
        `;

		// Execute the query
		pool.query(deleteQuery, [penaltyID], (error, results) => {
			if (error) {
				console.error("Error deleting penalty entry:", error);
				return res.status(500).send("Error deleting penalty entry.");
			}

			// Check if any rows were affected
			if (results.affectedRows === 0) {
				console.error("No penalty entry found for deletion");
				return res.status(404).send("Penalty entry not found.");
			}

			// Redirect back to the gamestats page with a success message
			res.redirect(`/gamestats/${gameID}?penalty Updated=true`);
		});
	} catch (err) {
		console.error("Error deleting penalty entry:", err);
		res.status(500).send("Error deleting penalty entry.");
	}
});

// route for adding shots to a period of a game
router.post("/shots/:gameID/", async (req, res) => {
    try {
        const gameID = req.params.gameID;
        // Extract the shots entry data from the request body
        const { shots_period, shots_team, shots_total } = req.body;

        // Check if gameID already exists in the sdfhl_shots table
        const selectQuery = `
            SELECT shots_game FROM sdfhl_shots WHERE shots_game = ? AND shots_period = ? AND shots_team = ?
        `;

        pool.query(selectQuery, [gameID, shots_period, shots_team], (error, results) => {
            if (error) {
                console.error('Error checking if gameID exists:', error);
                res.status(500).send('Error checking if gameID exists.');
                return;
            }

            if (results.length > 0) {
                // If gameID exists, update the existing record
                const updateQuery = `
                    UPDATE sdfhl_shots
                    SET shots_total = ?
                    WHERE shots_game = ? AND shots_period = ? AND shots_team = ?
                `;
                console.log('Updating shots entry:', updateQuery, [shots_total, gameID, shots_period, shots_team]);
                pool.query(updateQuery, [shots_total, gameID, shots_period, shots_team], (error, results) => {
                    if (error) {
                        console.error('Error updating shots entry:', error);
                        res.status(500).send('Error updating shots entry.');
                        return;
                    }
                    // Redirect back to the gamestats page with a success message
                    res.redirect(`/gamestats/${gameID}?shotsUpdated=true`);
                });
            } else {
                // If gameID does not exist, insert a new record
                const insertQuery = `
                    INSERT INTO sdfhl_shots (shots_game, shots_period, shots_team, shots_total)
                    VALUES (?, ?, ?, ?)
                `;
                console.log('Inserting shots entry:', insertQuery, [gameID, shots_period, shots_team, shots_total]);
                pool.query(insertQuery, [gameID, shots_period, shots_team, shots_total], (error, results) => {
                    if (error) {
                        console.error('Error adding shots entry:', error);
                        res.status(500).send('Error adding shots entry.');
                        return;
                    }
                    // Redirect back to the gamestats page with a success message
                    res.redirect(`/gamestats/${gameID}?shotsUpdated=true`);
                });
            }
        });
    } catch (err) {
        console.error('Error adding shots entry:', err);
        res.status(500).send('Error adding shots entry.');
    }
});

// route for adding shots to a period of a game
router.post("/stars/:gameID/", async (req, res) => {
    try {
        const gameID = req.params.gameID;
        // Extract the stars entry data from the request body
        const { star_player, star_rank, star_notes } = req.body;

        // Check if gameID already exists in the sdfhl_shots table
        const selectQuery = `
            SELECT star_game FROM sdfhl_threestars WHERE star_game = ? AND star_rank = ?
        `;

        pool.query(selectQuery, [gameID, star_rank], (error, results) => {
            if (error) {
                console.error('Error checking if star_game exists:', error);
                res.status(500).send('Error checking if star_game exists.');
                return;
            }

            if (results.length > 0) {
                // If star_game exists, update the existing record
                const updateQuery = `
                    UPDATE sdfhl_threestars
                    SET star_player = ?, star_notes = ?
                    WHERE star_game = ? AND star_rank = ?
                `;
                console.log('Updating stars entry:', updateQuery, [star_player, star_notes, gameID, star_rank]);
                pool.query(updateQuery, [star_player, star_notes, gameID, star_rank], (error, results) => {
                    if (error) {
                        console.error('Error updating stars entry:', error);
                        res.status(500).send('Error updating stars entry.');
                        return;
                    }
                    // Redirect back to the gamestats page with a success message
                    res.redirect(`/gamestats/${gameID}?starsUpdated=true`);
                });
            } else {
                // If gameID does not exist, insert a new record
                const insertQuery = `
                    INSERT INTO sdfhl_threestars (star_player, star_game, star_notes, star_rank)
                    VALUES (?, ?, ?, ?)
                `;
                console.log('Inserting stars entry:', insertQuery, [star_player, gameID, star_notes, star_rank]);
                pool.query(insertQuery, [star_player, gameID, star_notes, star_rank], (error, results) => {
                    if (error) {
                        console.error('Error adding stars entry:', error);
                        res.status(500).send('Error adding stars entry.');
                        return;
                    }
                    // Redirect back to the gamestats page with a success message
                    res.redirect(`/gamestats/${gameID}?starUpdated=true`);
                });
            }
        });
    } catch (err) {
        console.error('Error adding shots entry:', err);
        res.status(500).send('Error adding shots entry.');
    }
});




module.exports = router;
