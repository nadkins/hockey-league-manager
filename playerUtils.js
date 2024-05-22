const pool = require("./database"); // Assuming you have a database connection pool defined in a separate file

// Function to fetch player data by player_id
async function fetchPlayerDataById(playerId) {
	return new Promise((resolve, reject) => {
		pool.query("SELECT * FROM sdfhl_players WHERE player_id = ?", [playerId], (error, results) => {
			if (error) {
				reject(error);
				return;
			}
			resolve(results[0]); // Assuming there will be only one player with a given ID
		});
	});
}
// Function to fetch player data by player_id
async function fetchTeamDataById(teamId) {
	return new Promise((resolve, reject) => {
		pool.query("SELECT * FROM sdfhl_teams WHERE team_id = ?", [teamId], (error, results) => {
			if (error) {
				reject(error);
				return;
			}
			resolve(results[0]);
		});
	});
}

// Function to fetch team players by team_id
async function fetchTeamPlayersById(teamId) {
	return new Promise((resolve, reject) => {
		pool.query("SELECT team_players FROM sdfhl_teams WHERE team_id = ?", [teamId], (error, results) => {
			if (error) {
				reject(error);
				return;
			}
			resolve(results[0]); // Assuming there will be only one team with a given ID
		});
	});
}

// Function to fetch team players by team_id
async function fetchTeamPlayersById(teamId) {
	return new Promise((resolve, reject) => {
		pool.query("SELECT team_players FROM sdfhl_teams WHERE team_id = ?", [teamId], (error, results) => {
			if (error) {
				reject(error);
				return;
			}
			// Parse the comma-separated list and return it as an array
			const teamPlayers = results[0].team_players.split(",").map((playerId) => parseInt(playerId.trim(), 10));
			resolve(teamPlayers);
		});
	});
}

// Function to fetch team goalie by team_id
async function fetchTeamGoalieById(teamId) {
	return new Promise((resolve, reject) => {
		pool.query("SELECT team_goalie FROM sdfhl_teams WHERE team_id = ?", [teamId], (error, results) => {
			if (error) {
				reject(error);
				return;
			}
			resolve(results[0].team_goalie);
		});
	});
}

// Function to check if a player is present in the attendance for a given game and team
async function checkAttendance(gameId, teamId, playerId) {
	return new Promise((resolve, reject) => {
		pool.query("SELECT * FROM sdfhl_attendance WHERE attendance_game = ? AND attendance_team = ? AND FIND_IN_SET(?, attendance_players)", [gameId, teamId, playerId], (error, results) => {
			if (error) {
				reject(error);
				return;
			}
			resolve(results.length > 0); // Returns true if the player is found in the attendance, false otherwise
		});
	});
}

// Function to check if a goalie is present in the attendance for a given game and team
async function checkGoalieAttendance(gameId, teamId, goalieId) {
	return new Promise((resolve, reject) => {
		pool.query("SELECT * FROM sdfhl_attendance WHERE attendance_game = ? AND attendance_team = ? AND attendance_goalie = ?", [gameId, teamId, goalieId], (error, results) => {
			if (error) {
				reject(error);
				return;
			}
			resolve(results.length > 0); // Returns true if the goalie is found in the attendance, false otherwise
		});
	});
}

async function checkAttendanceSubs(gameId, teamId) {
	return new Promise((resolve, reject) => {
		pool.query("SELECT attendance_subs, attendance_subG FROM sdfhl_attendance WHERE attendance_game = ? AND attendance_team = ?", [gameId, teamId], (error, results) => {
			if (error) {
				reject(error);
				return;
			}

			if (results.length > 0) {
				// Extract the attendance_subs and attendance_subG values from the query result
				const attendanceSubs = results[0].attendance_subs;
				const attendanceSubG = results[0].attendance_subG;

				// Split the comma-separated values into arrays
				const subsArray = attendanceSubs ? attendanceSubs.split(",") : [];
				const subsGArray = attendanceSubG ? attendanceSubG.split(",") : [];

				// Resolve with the arrays
				resolve({attendanceSubs: subsArray, attendanceSubG: subsGArray});
			} else {
				// If no attendance record found, resolve with empty arrays
				resolve({attendanceSubs: [], attendanceSubG: []});
			}
		});
	});
}

async function getGameScoreSummary(gameId) {
	try {
		// Query to check if the game is in the shootout table
		const shootoutQuery = `
            SELECT *
            FROM sdfhl_shootout
            WHERE shootout_game = ?
			ORDER BY shootout_round ASC, shootout_team ASC;`;

		// Execute the query to check shootout information
		const shootoutResult = await new Promise((resolve, reject) => {
			pool.query(shootoutQuery, [gameId], async (error, results) => {
				if (error) {
					reject(error);
					return;
				}
				// Fetch player data for each goal
				for (const goal of results) {
					const teamData = await fetchTeamDataById(goal.shootout_team);
					goal.shootout_team = teamData; // Replace shootout_team with team information

					const playerData = await fetchPlayerDataById(goal.shootout_player);
					goal.shootout_player = playerData; // Replace shootout_player with player information
				}
				resolve(results); // Resolve with the entire results array
			});
		});

		// Query to get the total goals for each team in a specific game, including the period
		const goalsPerTeamQuery = `
            SELECT *, COUNT(*) AS total_team_goals
            FROM sdfhl_gamescore
            WHERE gamescore_game = ?
            GROUP BY gamescore_team, gamescore_period`;

		// Execute the query to get goals per team
		const goalsPerTeamResult = await new Promise((resolve, reject) => {
			pool.query(goalsPerTeamQuery, [gameId], (error, results) => {
				if (error) {
					reject(error);
					return;
				}
				resolve(results);
			});
		});

		// Query to get the total goals for each team in a specific game, including the period
		const goalsList = `
            SELECT *
            FROM sdfhl_gamescore
            WHERE gamescore_game = ?
            ORDER BY gamescore_period`;

		// Execute the query to get goals per team
		const goalsListResult = await new Promise((resolve, reject) => {
			pool.query(goalsList, [gameId], async (error, results) => {
				// Make the callback function async
				if (error) {
					reject(error);
					return;
				}

				try {
					// Fetch player data for each goal
					for (const goal of results) {
						const teamData = await fetchTeamDataById(goal.gamescore_team);
						goal.gamescore_team = teamData; // Replace gamescore_player with player information

						const playerData = await fetchPlayerDataById(goal.gamescore_player);
						goal.gamescore_player = playerData; // Replace gamescore_player with player information

						if (goal.gamescore_assist1 !== "Unassisted") {
							const assist1Data = await fetchPlayerDataById(goal.gamescore_assist1);
							goal.gamescore_assist1 = assist1Data; // Replace gamescore_assist1 with player information
						}

						if (goal.gamescore_assist2 !== "Unassisted") {
							const assist2Data = await fetchPlayerDataById(goal.gamescore_assist2);
							goal.gamescore_assist2 = assist2Data; // Replace gamescore_assist2 with player information
						}
					}

					resolve(results);
				} catch (error) {
					reject(error);
				}
			});
		});

		// Query to get the total goals for each period
		const goalsPerPeriodQuery = `
            SELECT *, COUNT(*) AS goals_per_period
            FROM sdfhl_gamescore
            WHERE gamescore_game = ?
            GROUP BY gamescore_period`;

		// Execute the query to get goals per period
		const goalsPerPeriodResult = await new Promise((resolve, reject) => {
			pool.query(goalsPerPeriodQuery, [gameId], async (error, results) => {
				if (error) {
					reject(error);
					return;
				}
				try {
					// Fetch player data for each goal
					for (const goal of results) {
						const teamData = await fetchTeamDataById(goal.gamescore_team);
						goal.gamescore_team = teamData; // Replace gamescore_player with player information

						const playerData = await fetchPlayerDataById(goal.gamescore_player);
						goal.gamescore_player = playerData; // Replace gamescore_player with player information

						if (goal.gamescore_assist1 !== "Unassisted") {
							const assist1Data = await fetchPlayerDataById(goal.gamescore_assist1);
							goal.gamescore_assist1 = assist1Data; // Replace gamescore_assist1 with player information
						}

						if (goal.gamescore_assist2 !== "Unassisted") {
							const assist2Data = await fetchPlayerDataById(goal.gamescore_assist2);
							goal.gamescore_assist2 = assist2Data; // Replace gamescore_assist2 with player information
						}
					}

					resolve(results);
				} catch (error) {
					reject(error);
				}

				resolve(results);
			});
		});

		// Check if there are any overtime goals
		const overtimeGoals = goalsPerTeamResult.some((result) => result.gamescore_period === 4);

		// Check if there are any shootout goals
		const shootoutGoals = shootoutResult.length > 0;

		// Return an object containing goals per team, goals per period, shootout information, overtime goals, and shootout goals
		return {
			goalsPerTeamResult,
			goalsListResult,
			goalsPerPeriod: goalsPerPeriodResult,
			shootoutInfo: shootoutResult,
			hasOvertimeGoals: overtimeGoals,
			hasShootoutGoals: shootoutGoals,
		};
	} catch (error) {
		throw new Error(`Error retrieving game score summary: ${error.message}`);
	}
}

// Function to load the penalty summary for a specific game
async function getGamePenaltySummary(gameId) {
	return new Promise((resolve, reject) => {
		pool.query("SELECT * FROM sdfhl_penalties WHERE penalty_game = ?", [gameId], async (error, results) => {
			if (error) {
				reject(error);
				return;
			}
			try {
				// Fetch player data for each goal
				for (const penalty of results) {
					const teamData = await fetchTeamDataById(penalty.penalty_team);
					penalty.penalty_team = teamData; // Replace penalty_team with player information

					const playerData = await fetchPlayerDataById(penalty.penalty_player);
					penalty.penalty_player = playerData; // Replace penalty_player with player information

					const servingData = await fetchPlayerDataById(penalty.penalty_serving);
					penalty.penalty_serving = servingData; // Replace penalty_player with player information
				}
				resolve(results);
			} catch (error) {
				reject(error);
			}

		});
	});
}

// Function to load the shot summary for a specific game
async function getGameShotSummary(gameId) {
	return new Promise((resolve, reject) => {
		pool.query("SELECT * FROM sdfhl_shots WHERE shots_game = ?", [gameId], async (error, results) => {
			if (error) {
				reject(error);
				return;
			}
			try {
				// Fetch team data for each goal
				for (const shots of results) {
					const teamData = await fetchTeamDataById(shots.shots_team);
					shots.shots_team = teamData; // Replace shots_team with team information
				}
				resolve(results);
			} catch (error) {
				reject(error);
			}

		});
	});
}

// Function to load the shot summary for a specific game
async function getGameStarsSummary(gameId) {
	return new Promise((resolve, reject) => {
		pool.query("SELECT * FROM sdfhl_threestars WHERE star_game = ? ORDER BY star_rank", [gameId], async (error, results) => {
			if (error) {
				reject(error);
				return;
			}
			try {
				// Fetch player data for each goal
				for (const stars of results) {
					const PlayerData = await fetchPlayerDataById(stars.star_player);
					stars.star_player = PlayerData; // Replace shots_team with team information
					// Strip HTML tags from star_notes
					stars.star_notes = stars.star_notes.replace(/<[^>]*>?/gm, '');
				}
				resolve(results);
			} catch (error) {
				reject(error);
			}

		});
	});
}

module.exports = {getGameScoreSummary, fetchPlayerDataById, fetchTeamDataById, fetchTeamPlayersById, fetchTeamGoalieById, checkAttendance, checkGoalieAttendance, checkAttendanceSubs, getGamePenaltySummary, getGameShotSummary, getGameStarsSummary};
