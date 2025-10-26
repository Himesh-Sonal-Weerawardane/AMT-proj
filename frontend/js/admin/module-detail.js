const formatDate = (isoString) => {
	if (!isoString) return "";
	try {
		const date = new Date(isoString);
		return date.toLocaleDateString(undefined, {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	} catch (err) {
		console.error("Failed to format date", err);
		return isoString;
	}
};

const showStatus = (message, isError = false) => {
	const statusEl = document.getElementById("status-message");
	if (!statusEl) return;

	statusEl.textContent = message;
	statusEl.hidden = false;
	statusEl.dataset.state = isError ? "error" : "info";

	if (isError) {
		statusEl.style.background = "rgba(224, 49, 49, 0.08)";
		statusEl.style.color = "#c92a2a";
		statusEl.style.borderColor = "rgba(224, 49, 49, 0.2)";
	} else {
		statusEl.style.background = "rgba(76, 110, 245, 0.08)";
		statusEl.style.color = "var(--module-accent, #4c6ef5)";
		statusEl.style.borderColor = "rgba(76, 110, 245, 0.2)";
	}
};

window.addEventListener("DOMContentLoaded", async () => {
	const params = new URLSearchParams(window.location.search);
	const moduleId = params.get("id");

	const contentEl = document.getElementById("module-content");
	const rubricList = document.getElementById("rubric-list");
	const rubricEmpty = document.getElementById("rubric-empty");
	const assignmentPreview = document.getElementById("assignment-preview");
	const assignmentDownload = document.getElementById("assignment-download");
	const rubricDownload = document.getElementById("rubric-download");

	if (!moduleId) {
		showStatus("Module ID missing from the URL.", true);
		return;
	}

	showStatus("Loading module details…");

	const headers = {};
	if (typeof token !== "undefined" && token) {
		headers["Authorization"] = "Bearer " + token;
	}

	try {
		const res = await fetch(
			`/api/moderations/${encodeURIComponent(moduleId)}`,
			{ headers }
		);
		if (!res.ok) {
			const errorText =
				res.status === 404
					? "We couldn't find that module."
					: "Failed to load module details.";
			showStatus(errorText, true);
			return;
		}

		const data = await res.json();

		const breadcrumbSegments = [];
		if (data.year) breadcrumbSegments.push(`Year ${data.year}`);
		if (data.semester) breadcrumbSegments.push(`Semester ${data.semester}`);
		if (data.moderation_number)
			breadcrumbSegments.push(`Moderation ${data.moderation_number}`);
		document.getElementById("module-breadcrumb").textContent =
			breadcrumbSegments.join(" • ") || "Module";

		document.getElementById("module-title").textContent =
			data.name || "Untitled Module";
		document.getElementById("module-description").textContent =
			data.description || "No description was provided for this module.";

		const deadline = formatDate(data.due_date);
		const uploaded = formatDate(data.upload_date);
		document.getElementById("module-deadline").textContent = deadline
			? `Deadline: ${deadline}`
			: "";
		document.getElementById("module-uploaded").textContent = uploaded
			? `Uploaded: ${uploaded}`
			: "";

		if (data.assignment_public_url) {
			assignmentPreview.data = data.assignment_public_url;
			assignmentDownload.href = data.assignment_public_url;
			assignmentDownload.hidden = false;
		} else {
			assignmentPreview.removeAttribute("data");
		}

		if (data.rubric_public_url) {
			rubricDownload.href = data.rubric_public_url;
			rubricDownload.hidden = false;
		}

		console.log(data.rubric_json);
		const tableData = populateRubricTable(data.rubric_json);
		rubricTable.loadData(tableData);

		if (tableData) {
			rubricEmpty.hidden = true;
		} else {
			rubricEmpty.hidden = false;
		}

		showStatus("Module ready.");
		setTimeout(() => {
			const statusEl = document.getElementById("status-message");
			if (statusEl && statusEl.dataset.state !== "error") {
				statusEl.hidden = true;
			}
		}, 2500);

		contentEl.hidden = false;
	} catch (err) {
		console.error("Failed to load module details", err);
		showStatus("An unexpected error occurred while loading the module.", true);
	}
});

const criteria = "criteria";
const gradeMap = [
	{ key: "highDistinction", name: "High Distinction" },
	{ key: "distinction", name: "Distinction" },
	{ key: "credit", name: "Credit" },
	{ key: "pass", name: "Pass" },
	{ key: "fail", name: "Fail" },
];
const criteriaScore = "criteriaScore";

// https://github.com/handsontable/handsontable
// npm install handsontable
const element = document.getElementById("handsontable-grid");
const rubricTable = new Handsontable(element, {
	// theme name with obligatory ht-theme-* prefix
	themeName: "ht-theme-main",
	// other options
	columns: [
		{ data: `${criteria}`, title: "Criteria", width: 170 },
		...gradeMap.map((g) => ({
			data: g.key,
			title: g.name,
			width: 170,
		})),
		{ data: `${criteriaScore}`, title: "Criteria Score", width: 100 },
	],
	data: [{}],

	height: "100%",
	width: "100%",
	stretchH: "all",
	rowHeaders: true,
	navigableHeaders: true,
	tabNavigation: true,
	manualColumnResize: true,
	selectionMode: "range",
	headerClassName: "htLeft",
	licenseKey: "non-commercial-and-evaluation",
	manualRowMove: true,
	contextMenu: true,
});

function populateRubricTable(rubricJSON) {
	// Fallback empty row
	if (!rubricJSON?.criteria) return [{}];

	return rubricJSON.criteria.map((c) => {
		const row = {
			criteria: c.criterion || "",
			criteriaScore: c.maxPoints ? `/ ${c.maxPoints}` : "",
		};

		// Initialize all grades to empty string
		gradeMap.forEach((g) => (row[g.key] = ""));

		// Fill in grades from rubric JSON
		(c.grades || []).forEach((g) => {
			const gradeKey = gradeMap.find((m) => m.name === g.grade)?.key;
			if (!gradeKey) return;

			const descriptionText = (g.description || []).join("\n\n");
			row[gradeKey] = `${descriptionText}\n\n${g.pointsRange || ""}`;
		});

		return row;
	});
}
