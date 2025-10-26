/*
    Handles the rubric and performs unmarked state
 */

let rubricData;
let currentUser = null;
let moderationId = null;

/* -----------------------------------Fetch User Info--------------------------------------- */
async function getUserInfo() {
	try {
		const user = await fetch(`/api/user_info`, {
			method: "POST",
			credentials: "include",
		});

		if (!user.ok) throw new Error("Failed to fetch user data");
		currentUser = await user.json();
		console.log(currentUser);
	} catch (error) {
		console.error("error fetching user info", error);
	}
}

/* ----------------------------------Get Moderation ID----------------------------------------*/

function getModerationID() {
	const urlParams = new URLSearchParams(window.location.search);
	moderationId = urlParams.get("id") || 1;
}

/* ------------------------------LOADING MAIN MODERATION PAGE---------------------------------- */

document.addEventListener("DOMContentLoaded", async () => {
	try {
		await getUserInfo();
		getModerationID();

		if (currentUser.role === "Admin") {
			await loadAdminModeration();
		} else {
			await loadMarkerModeration();
		}
	} catch (e) {
		console.error("Error loading mod data", e);
	}
});

/* ---------------------------------Load Admin's Moderation-----------------------------------*/

async function loadAdminModeration() {
	const moderationRes = await fetch(`/api/moderations/${moderationId}`);
	const moderationData = await moderationRes.json();

	rubricData = moderationData;

	document.getElementById("moderation-title").textContent = rubricData.name;
	document.getElementById("moderation-doc").src =
		rubricData.assignment_public_url;
	document.getElementById("moderation-subtitle").textContent =
		`${currentUser.first_name} ${currentUser.last_name}'s Moderation`;

	const tabs = document.querySelectorAll(".tab-links");
	tabs.forEach((tab) => {
		const text = tab.textContent.trim();
		if (text !== "Marking" && text !== "Description") {
			tab.style.display = "none";
		}
	});

	document.getElementById("Statistics").style.display = "none";
	document.getElementById("Feedback").style.display = "none";

	const submitButton = document.getElementById("moderation-submit");
	if (submitButton) submitButton.style.display = "none";

	if (rubricData.admin_feedback?.criteria) {
		renderMarkedModeration({
			scores: rubricData.admin_feedback.criteria.map((c, i) => ({
				criterionID: i,
				score: c.admin_score,
				comment: c.feedback,
			})),
			total_score:
				rubricData.admin_feedback.criteria
					.map((c) => parseFloat(c.admin_score.split("/")[0]))
					.reduce((a, b) => a + b, 0) +
				" / " +
				rubricData.admin_feedback.criteria
					.map((c) => parseFloat(c.admin_score.split("/")[1]))
					.reduce((a, b) => a + b, 0),
		});
	}

	document.getElementById("moderation-description").textContent =
		rubricData.description;
	const dueDate = document.getElementById("due-date");

	if (dueDate) {
		if (rubricData.due_date) {
			const date = new Date(rubricData.due_date);
			const formattedDate = date.toLocaleDateString("en-AU", {
				weekday: "long",
				year: "numeric",
				month: "long",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
				hour12: true,
			});
			dueDate.textContent = `Due: ${formattedDate}`;
		} else {
			dueDate.textContent = "No due date";
		}
	}
}

/* ---------------------------------Load Marker's Moderation-----------------------------------*/

async function loadMarkerModeration() {
	const moderationRes = await fetch(`/api/moderations/${moderationId}`);
	const moderationData = await moderationRes.json();

	console.log("Moderation Data:", moderationData);
	rubricData = moderationData;

	document.getElementById("moderation-title").textContent = rubricData.name;
	document.getElementById("moderation-doc").src =
		rubricData.assignment_public_url;
	document.getElementById("moderation-subtitle").textContent =
		`${currentUser.first_name} ${currentUser.last_name}'s Moderation Attempt`;

	document.getElementById("moderation-description").textContent =
		rubricData.description || "No description";
	const dueDate = document.getElementById("due-date");

	if (dueDate) {
		if (rubricData.due_date) {
			const date = new Date(rubricData.due_date);
			const formattedDate = date.toLocaleDateString("en-AU", {
				weekday: "long",
				year: "numeric",
				month: "long",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
				hour12: true,
			});
			dueDate.textContent = `Due: ${formattedDate}`;
		} else {
			dueDate.textContent = "No due date";
		}
	}

	const marksRes = await fetch(
		`/api/marks/${moderationId}/${currentUser.user_id}`
	);
	const statsTab = document.getElementById("tab-stats");
	const feedbackTab = document.getElementById("tab-feedback");
	const statsTabContent = document.getElementById("Statistics");
	const feedbackTabContent = document.getElementById("Feedback");

	if (marksRes.ok) {
		const marksData = await marksRes.json();

		if (marksData && marksData.scores) {
			setTimeout(() => {
				statsTab.classList.remove("hidden");
				feedbackTab.classList.remove("hidden");
				statsTabContent.classList.remove("hidden");
				feedbackTabContent.classList.remove("hidden");
			}, 50);

			renderMarkedModeration({
				scores: marksData.scores,
				comments: marksData.comments,
				total_score: marksData.total_score,
				submitted_at: marksData.submitted_at,
			});

			await renderStatistics(moderationId, currentUser.user_id);
			await renderAdminFeedback(moderationId);
		} else {
			statsTab.classList.add("hidden");
			feedbackTab.classList.add("hidden");
			statsTabContent.classList.add("hidden");
			feedbackTabContent.classList.add("hidden");

			renderUnmarkedModeration(rubricData.rubric_json);
			calculateTotalScore(rubricData.rubric_json);
			await alertSubmission();
		}
	} else {
		statsTab.classList.add("hidden");
		feedbackTab.classList.add("hidden");
		statsTabContent.classList.add("hidden");
		feedbackTabContent.classList.add("hidden");

		renderUnmarkedModeration(rubricData.rubric_json);
		calculateTotalScore(rubricData.rubric_json);
		await alertSubmission();
	}
}

/* ---------------------------Render the Unmarked Moderation--------------------------------- */

function renderUnmarkedModeration(data) {
	const criteria = document.getElementById("criteria");
	criteria.innerHTML = "";

	data.criteria.forEach((element, index) => {
		const criterion = document.createElement("div");
		criterion.classList.add("criterion");

		/* Criterion title */
		const criterionTitle = document.createElement("h4");
		criterionTitle.classList.add("criterion-title");
		criterionTitle.textContent = element.criterion;

		const scoreWrapper = document.createElement("div");
		scoreWrapper.classList.add("score-wrapper");

		/* Criterion Score Bar */
		const scoreBar = document.createElement("input");
		scoreBar.id = `score-${index}`;
		scoreBar.type = "range";
		scoreBar.min = 0;
		scoreBar.max = element.maxPoints;
		scoreBar.step = 0.5;
		scoreBar.value = 0;
		scoreBar.classList.add("score-bar");

		const scoreView = document.createElement("span");
		scoreView.classList.add("score-view");
		scoreView.textContent = `_ / ${element.maxPoints}`;

		scoreBar.addEventListener("input", () => {
			scoreView.textContent = `${scoreBar.value} / ${element.maxPoints}`;
		});

		scoreWrapper.appendChild(scoreBar);
		scoreWrapper.appendChild(scoreView);

		/* Wrapper for Criterion Title and Score Bar */
		const inputWrapper = document.createElement("div");
		inputWrapper.classList.add("input-wrapper");
		inputWrapper.appendChild(criterionTitle);
		inputWrapper.appendChild(scoreWrapper);
		criterion.appendChild(inputWrapper);

		/* Criterion Description */
		const gradeTable = document.createElement("table");
		gradeTable.classList.add("grade-table");

		const gradeGroup = document.createElement("tr");
		const gradeRow = document.createElement("tr");

		element.grades.forEach((g) => {
			const header = document.createElement("th");
			header.textContent = g.grade;
			gradeGroup.appendChild(header);

			const desCell = document.createElement("td");

			const desc = document.createElement("div");
			desc.innerHTML = g.description.join("<br><br>");
			desCell.appendChild(desc);

			const gradePoints = document.createElement("div");
			gradePoints.textContent = g.pointsRange;
			desCell.appendChild(gradePoints);

			gradeRow.appendChild(desCell);
		});

		gradeTable.appendChild(gradeGroup);
		gradeTable.appendChild(gradeRow);
		criterion.appendChild(gradeTable);

		/* Comment Section */
		const commentContainer = document.createElement("div");
		const commentPara = document.createElement("p");
		const commentSection = document.createElement("div");

		commentContainer.classList.add("comment-container");
		commentSection.classList.add("comment-section");

		commentPara.textContent = "Criterion Feedback (Optional)";
		commentPara.style.margin = "35px 30px 20px 30px";
		commentPara.style.fontWeight = "bold";

		commentSection.contentEditable = "true";
		commentSection.setAttribute("data-placeholder", "Enter comment...");

		commentContainer.appendChild(commentPara);
		commentContainer.appendChild(commentSection);
		criterion.appendChild(commentContainer);

		criteria.appendChild(criterion);

		scoreBar.addEventListener("input", () => {
			scoreView.textContent = `${scoreBar.value} / ${element.maxPoints}`;
			highlightGrade(parseFloat(scoreBar.value), gradeTable, element.grades);
		});
	});
}

/* -----------------------------Render the Marked Moderation---------------------------------- */

function renderMarkedModeration(results) {
	const submitButton = document.getElementById("moderation-submit");
	if (submitButton) submitButton.remove();

	if (results.total_score) {
		const totalDisplay = document.getElementById("total-score");
		totalDisplay.textContent = `${results.total_score}`;
		totalDisplay.style.marginRight = "20px";
	}

	const criteria = document.getElementById("criteria");
	criteria.innerHTML = "";

	const resultStorage = Array.isArray(results)
		? results
		: results?.scores?.map((s, i) => ({
				criterionID: s?.criterionID ?? i,
				score: s?.score ?? "0 / 0",
				comment:
					s?.comment || s?.feedback || results.comments?.[i]?.comment || "",
			})) || [];

	if (!resultStorage.length) {
		console.warn("No result data to render");
		return;
	}

	resultStorage.forEach((element) => {
		if (!element || !rubricData?.rubric_json?.criteria[element.criterionID]) {
			console.warn("Skipping invalid entry:", element);
			return;
		}

		const criterionData = rubricData.rubric_json.criteria[element.criterionID];
		const criterion = document.createElement("div");
		criterion.classList.add("marked-criterion");

		/* Criterion Title */
		const criterionTitle = document.createElement("h4");
		criterionTitle.classList.add("criterion-title");
		criterionTitle.textContent = criterionData.criterion;
		criterion.appendChild(criterionTitle);

		const scoreWrapper = document.createElement("div");
		scoreWrapper.classList.add("marked-score-wrapper");

		/* Criterion Score Bar */
		const rawScore = element.score || "0 / 0";
		const scoreValue = parseFloat(rawScore.split(" / ")[0]) || 0;

		const gradeGroups = criterionData.grades;

		const activeGroup = gradeGroups.find((g) => {
			const range = g.pointsRange.match(/\(([\d.]+)\s*-\s*([\d.]+)/);
			const min = parseFloat(range[1]);
			const max = parseFloat(range[2]);
			return scoreValue >= min && scoreValue <= max;
		});

		const scoreBarContainer = document.createElement("div");
		scoreBarContainer.classList.add("score-bar-container");

		const gradeColors = {
			"High Distinction": "#6ee277",
			Distinction: "#d5ed59",
			Credit: "#fee12d",
			Pass: "#f49b25",
			Fail: "#ee4c37",
		};

		gradeGroups.forEach((g) => {
			const block = document.createElement("div");
			block.classList.add("score-block");

			if (activeGroup && g.grade === activeGroup.grade) {
				block.classList.add("active-block");
				block.style.backgroundColor = gradeColors[g.grade];
				block.title = `${g.grade}: ${g.pointsRange}`;
			} else {
				block.title = `${g.grade}: ${g.pointsRange}`;
			}

			scoreBarContainer.appendChild(block);
		});

		scoreWrapper.appendChild(scoreBarContainer);

		const scoreInfo = document.createElement("div");
		scoreInfo.classList.add("score-info");

		if (activeGroup) {
			const gradeName = document.createElement("div");
			gradeName.classList.add("highlighted-grade");
			gradeName.textContent = activeGroup.grade;
			scoreInfo.appendChild(gradeName);
		}

		const scoreView = document.createElement("span");
		scoreView.classList.add("marked-score-view");
		scoreView.textContent = element.score;
		scoreInfo.appendChild(scoreView);

		scoreWrapper.appendChild(scoreInfo);
		criterion.appendChild(scoreWrapper);

		/* Criterion Description */
		if (activeGroup) {
			const gradeDes = document.createElement("div");
			gradeDes.classList.add("marked-grade-description");

			const des = document.createElement("div");
			des.innerHTML = activeGroup.description.join("<br><br>");
			gradeDes.appendChild(des);

			const gradePoints = document.createElement("div");
			gradePoints.classList.add("marked-grade-points");
			gradePoints.textContent = activeGroup.pointsRange;
			gradeDes.appendChild(gradePoints);

			criterion.appendChild(gradeDes);
		}

		/* Criterion Comment Section */
		const commentContainer = document.createElement("div");
		const commentPara = document.createElement("p");
		const commentSection = document.createElement("div");

		commentContainer.classList.add("comment-container");
		commentSection.classList.add("comment-section");

		commentPara.textContent = "Criterion Feedback";
		commentPara.style.margin = "25px 20px 20px 25px";
		commentPara.style.fontWeight = "bold";

		commentSection.contentEditable = "false";
		commentSection.textContent = element.comment;

		commentContainer.appendChild(commentPara);
		commentContainer.appendChild(commentSection);
		criterion.appendChild(commentContainer);

		criteria.appendChild(criterion);
	});
}

/* -----------------------------------Render Statistics--------------------------------------*/

async function renderStatistics(moderationId, markerId) {
	try {
		const res = await fetch(`/api/stats/${moderationId}/${markerId}`);
		if (!res.ok) throw new Error("Failed to load stats");
		const data = await res.json();

		const stats = document.getElementById("stats");
		stats.innerHTML = "";

		const statsTable = document.createElement("table");
		statsTable.classList.add("stats-table");

		const rowHeader = document.createElement("tr");
		rowHeader.innerHTML = `
            <th>Criteria</th>
            <th>Max Points</th>
            <th>Unit Chair Marks</th>
            <th>Range 5% Lower</th>
            <th>Range 5% Upper</th>
            <th>Unit Chair Marks (%)</th>
            <th style="background-color:lightgrey;">Your Marks</th>
            <th style="background-color:lightgrey;">Your Marks (%)</th>
            <th>Difference (%)</th>`;
		statsTable.appendChild(rowHeader);

		data.criteria.forEach((criterion) => {
			const diff = parseFloat(criterion.diff_percent);

			const diffColor = Math.abs(diff) <= 5 ? "lightgreen" : "transparent";

			const criterionRow = document.createElement("tr");
			criterionRow.innerHTML = `
            <td style="font-weight: bold">${criterion.criterion}</td>
            <td>${criterion.max_points}</td>
            <td>${criterion.admin_score}</td>
            <td>${criterion.lower}</td>
            <td>${criterion.upper}</td>
            <td>${criterion.admin_percent}%</td>
            <td style="background-color:lightgrey;">${criterion.marker_score}</td>
            <td style="background-color:lightgrey;">${criterion.marker_percent}%</td>
            <td style="background-color:${diffColor}">${criterion.diff_percent}%</td>`;

			statsTable.appendChild(criterionRow);
		});

		const totalRow = document.createElement("tr");

		const maxTotal = data.criteria.reduce(
			(sum, b) => sum + Number(b.max_points || 0),
			0
		);
		const adminTotal = data.criteria.reduce(
			(sum, b) => sum + Number(b.admin_score || 0),
			0
		);
		const markerTotal = data.criteria.reduce(
			(sum, b) => sum + Number(b.marker_score || 0),
			0
		);
		const lowerTotal = data.criteria.reduce(
			(sum, b) => sum + Number(b.lower || 0),
			0
		);
		const upperTotal = data.criteria.reduce(
			(sum, b) => sum + Number(b.upper || 0),
			0
		);

		const adminPercent = ((adminTotal / maxTotal) * 100).toFixed(2);
		const markerPercent = ((markerTotal / maxTotal) * 100).toFixed(2);
		const diffPercent = (adminPercent - markerPercent).toFixed(2);

		const cellColor = Math.abs(diffPercent) <= 5 ? "lightgreen" : "transparent";

		totalRow.innerHTML = `
            <td style="font-weight: bold">Total / Difference</td>
            <td>${maxTotal}</td>
            <td>${adminTotal}</td>
            <td>${lowerTotal}</td>
            <td>${upperTotal}</td>
            <td>${adminPercent}%</td>
            <td style="background-color:lightgrey;">${markerTotal}</td>
            <td style="background-color:lightgrey;">${markerPercent}%</td>
            <td style="background-color:${cellColor}">${diffPercent}%</td>`;

		statsTable.appendChild(totalRow);

		stats.appendChild(statsTable);
	} catch (e) {
		console.error("error rendering stats", e);
	}
}

/* ---------------------------------Render Admin Feedback------------------------------------*/

async function renderAdminFeedback(moderationId) {
	try {
		const res = await fetch(`/api/feedback/${moderationId}`);
		if (!res.ok) throw new Error("Failed to fetch feedback");

		const data = await res.json();

		const feedbackContainer = document.getElementById("feedbacks");
		feedbackContainer.innerHTML = "";

		data.criteria.forEach((element) => {
			const criterionWrapper = document.createElement("div");
			criterionWrapper.classList.add("criterion-wrapper");

			const feedbackHead = document.createElement("div");
			feedbackHead.classList.add("feedback-head");

			const criterion = document.createElement("h4");
			criterion.classList.add("feedback-title");
			criterion.textContent = element.criterion;

			feedbackHead.appendChild(criterion);
			criterionWrapper.appendChild(feedbackHead);

			const feedbackText = document.createElement("p");
			feedbackText.classList.add("feedback-comment");
			feedbackText.contentEditable = "false";
			feedbackText.textContent = element.feedback || "No feedback";
			criterionWrapper.appendChild(feedbackText);

			feedbackContainer.appendChild(criterionWrapper);
		});
	} catch (error) {
		console.error("Error fetching feedback", error);
	}
}

/* -----------Highlight the grade group of each criterion based on user input--------------- */

function highlightGrade(score, gradeDes, grades) {
	const groupDes = gradeDes.querySelectorAll("tr:nth-child(2) td");
	const gradeHead = gradeDes.querySelectorAll("tr:first-child th");

	grades.forEach((g, i) => {
		const range = g.pointsRange.match(/\(([\d.]+)\s*-\s*([\d.]+)/);
		const min = parseFloat(range[1]);
		const max = parseFloat(range[2]);
		if (score >= min && score <= max) {
			gradeHead[i].classList.add("highlighted");
			groupDes[i].classList.add("highlighted");
		} else {
			gradeHead[i].classList.remove("highlighted");
			groupDes[i].classList.remove("highlighted");
		}
	});
}

/* -----------------------Alert the user when submission is made----------------------------- */

async function alertSubmission() {
	const submitButton = document.getElementById("moderation-submit");

	submitButton.addEventListener("click", async () => {
		const criteria = document.querySelectorAll(".criterion");
		let allScoresFilled = true;
		const scores = [];
		const comments = [];

		criteria.forEach((criterion, index) => {
			const scoreInput = criterion.querySelector(".score-view");
			const commentInput = criterion.querySelector(".comment-section");

			const score = scoreInput ? scoreInput.textContent.trim() : "";
			const comment = commentInput ? commentInput.textContent.trim() : "";

			if (score.startsWith("_")) {
				allScoresFilled = false;
			}

			scores.push({ criterionID: index, score });
			comments.push({ criterionID: index, comment });
		});

		if (!allScoresFilled) {
			alert("Please fill in all scores before submission!");
			return;
		}

		try {
			const totalScore = document
				.getElementById("total-score")
				.textContent.trim();

			const res = await fetch(`/api/marks`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					moderation_id: moderationId,
					marker_id: currentUser.user_id,
					scores,
					comments,
					total_score: totalScore,
					submitted_at: new Date().toISOString(),
				}),
			});

			const result = await res.json();
			if (!res.ok || !result?.data)
				throw new Error("Could not find moderation results.");
			alert("Moderation submitted successfully!");

			const safeScores = Array.isArray(result.data.scores)
				? result.data.scores
				: [];
			const safeComments = Array.isArray(result.data.comments)
				? result.data.comments
				: [];

			const merged = safeScores.map((s, i) => ({
				criterionID: s?.criterionID ?? i,
				score: s?.score ?? "0 / 0",
				comment: safeComments[i]?.comment ?? "",
			}));

			const resultData = {
				scores: merged,
				total_score: result.data?.total_score ?? "0 / 0",
			};

			renderMarkedModeration({
				scores: result.data.scores,
				comments: result.data.comments,
				total_score: result.data.total_score,
				submitted_at: result.data.submitted_at,
			});

			document.getElementById("tab-stats").classList.remove("hidden");
			document.getElementById("tab-feedback").classList.remove("hidden");
			document.getElementById("Statistics").classList.remove("hidden");
			document.getElementById("Feedback").classList.remove("hidden");

			await renderStatistics(moderationId, currentUser.user_id);
			await renderAdminFeedback(moderationId);
		} catch (err) {
			console.error("Error saving marks.", err);
			alert("Error saving marks.");
		}
	});
}

/* -------------------------Calculate moderation total score------------------------------ */

function calculateTotalScore(data) {
	const scoreInput = document.querySelectorAll(".score-bar");
	const totalScore = document.getElementById("total-score");

	const maxScore = data.criteria.reduce((a, b) => a + b.maxPoints, 0);

	totalScore.textContent = `_ / ${maxScore}`;

	function updateTotalScore() {
		let total = 0;
		let filled = false;

		scoreInput.forEach((input) => {
			const val = parseFloat(input.value);
			if (!isNaN(val)) {
				total += val;
				filled = true;
			}
		});

		if (filled) {
			totalScore.textContent = `${total} / ${maxScore}`;
		} else {
			totalScore.textContent = `_ / ${maxScore}`;
		}
	}

	scoreInput.forEach((input) => {
		input.addEventListener("input", updateTotalScore);
	});

	totalScore.textContent = `_ / ${maxScore}`;
}
