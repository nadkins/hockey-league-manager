// Function to submit a specific form to the specified route
function submitForm(formId, route) {
	const form = document.getElementById(formId);
	form.action = route; // Set the action attribute of the form
	form.submit(); // Submit the form
}

// Add event listeners to buttons to trigger form submission
document.getElementById("refSubmitButton").addEventListener("click", function () {
	const route = "/gamestats/<%= schedule.schedule_id %>/referee"; // Replace with your actual route
	submitForm("refForm", route);
});

// Add event listeners to buttons to trigger form submission
document.getElementById("homeSubmitButton").addEventListener("click", function () {
	const route = "/gamestats/<%= schedule.schedule_id %>/attendance"; // Replace with your actual route
	submitForm("homeTeamForm", route);
});

document.getElementById("visitorSubmitButton").addEventListener("click", function () {
	const route = "/gamestats/<%= schedule.schedule_id %>/attendance"; // Replace with your actual route
	submitForm("visitorTeamForm", route);
});

document.getElementById("add_visitor_sub_goalie").addEventListener("click", function () {
	const selectElement = document.getElementById("visitor_goalie_sub");
	const playerId = selectElement.value;
	if (playerId !== "") {
		const playerName = document.getElementById("visitor_goalie_sub").options[document.getElementById("visitor_goalie_sub").selectedIndex].text;
		const container = document.getElementById("visitor_sub_goalies_container");
		if (!container.querySelector(`input[value="${playerId}"]`)) {
			// Check if player already exists
			container.innerHTML = ""; // Clear container
			addAttendanceSubG(container, playerId, playerName);
			selectElement.selectedIndex = 0; // Reset select to top option
		}
	}
});

document.getElementById("add_home_sub_goalie").addEventListener("click", function () {
	const selectElement = document.getElementById("home_goalie_sub");
	const playerId = selectElement.value;
	if (playerId !== "") {
		const playerName = document.getElementById("home_goalie_sub").options[document.getElementById("home_goalie_sub").selectedIndex].text;
		const container = document.getElementById("home_sub_goalies_container");
		if (!container.querySelector(`input[value="${playerId}"]`)) {
			// Check if player already exists
			container.innerHTML = ""; // Clear container
			addAttendanceSubG(container, playerId, playerName);
			selectElement.selectedIndex = 0; // Reset select to top option
		}
	}
});

document.getElementById("add_home_player").addEventListener("click", function () {
	const playerId = document.getElementById("home_players_subs").value;
	if (playerId !== "") {
		const playerName = document.getElementById("home_players_subs").options[document.getElementById("home_players_subs").selectedIndex].text;
		const container = document.getElementById("home_players_container");
		if (!container.querySelector(`input[value="${playerId}"]`)) {
			// Check if player already exists
			addAttendanceSub(container, playerId, playerName);
		}
	}
});

document.getElementById("add_visitor_player").addEventListener("click", function () {
	const playerId = document.getElementById("visitor_players_subs").value;
	if (playerId !== "") {
		const playerName = document.getElementById("visitor_players_subs").options[document.getElementById("visitor_players_subs").selectedIndex].text;
		const container = document.getElementById("visitor_players_container");
		if (!container.querySelector(`input[value="${playerId}"]`)) {
			// Check if player already exists
			addAttendanceSub(container, playerId, playerName);
		}
	}
});

function addAttendanceSubG(container, playerId, playerName) {
	const input = document.createElement("input");
	input.type = "hidden";
	input.name = "attendance_subG[]";
	input.value = playerId;
	const span = document.createElement("span");
	span.textContent = playerName;
	const removeIcon = document.createElement("i");
	removeIcon.classList.add("fa-solid", "fa-circle-xmark");
	addRemoveIconEvent(removeIcon, input, span, container);
	container.appendChild(span);
	container.appendChild(removeIcon);
	container.appendChild(input);
	const br = document.createElement("br");
	container.appendChild(br);
}

function addAttendanceSub(container, playerId, playerName) {
	const input = document.createElement("input");
	input.type = "hidden";
	input.name = "attendance_subs[]";
	input.value = playerId;
	const span = document.createElement("span");
	span.textContent = playerName;
	const removeIcon = document.createElement("i");
	removeIcon.classList.add("fa-solid", "fa-circle-xmark");
	addRemoveIconEvent(removeIcon, input, span, container);
	container.appendChild(span);
	container.appendChild(removeIcon);
	container.appendChild(input);
	const br = document.createElement("br");
	container.appendChild(br);
}

function addRemoveIconEvent(removeIcon, input, span, container) {
	removeIcon.addEventListener("click", function () {
		container.removeChild(input);
		container.removeChild(span);
		container.removeChild(removeIcon);
	});
}

// Add event listeners to remove icons for items rendered on page load
document.querySelectorAll(".fa-circle-xmark").forEach(function (icon) {
	const input = icon.previousSibling;
	const span = input.previousSibling;
	const container = input.parentNode;
	addRemoveIconEvent(icon, input, span, container);
});

// Function to update player select elements based on selected team
function updatePlayerSelect(teamId, players) {
	const playerSelects = document.querySelectorAll(".load-players");

	playerSelects.forEach((select) => {
		// Clear previous options
		select.innerHTML = '<option value="">Select a Player</option>';

		// Add options for players of the selected team
		players.forEach((player) => {
			const option = document.createElement("option");
			option.value = player.player_id;
			option.textContent = player.player_first + " " + player.player_last;
			select.appendChild(option);
		});
	});
}

// Add event listener to choose-team select element
document.querySelector(".choose-team").addEventListener("change", function () {
	const selectedTeamId = this.value;
	let players;

	// Decode the encoded JSON data and parse it
	function decodeAndParse(encodedData) {
		return JSON.parse(decodeURIComponent(encodedData.replace(/\+/g, " ")));
	}

	// Determine which team's players to use based on the selected team
	if (selectedTeamId === "<%= schedule.home_team_id %>") {
		players = decodeAndParse("<%= encodeURIComponent(JSON.stringify(schedule.home_players)) %>");
	} else if (selectedTeamId === "<%= schedule.visitor_team_id %>") {
		players = decodeAndParse("<%= encodeURIComponent(JSON.stringify(schedule.visitor_players)) %>");
	}

	// Update player select elements
	updatePlayerSelect(selectedTeamId, players);
});

// Update the form submission route for adding a new entry to the sdfhl_gamescore table
document.getElementById("goalScoreTeamForm").addEventListener("submit", function (event) {
	event.preventDefault(); // Prevent default form submission

	const route = "/gamestats/<%= schedule.schedule_id %>/goalscore"; // Replace with your actual route
	submitForm("goalScoreTeamForm", route);
});
