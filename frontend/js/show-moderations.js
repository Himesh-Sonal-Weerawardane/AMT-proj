// Created by William Alexander Tang Wai on 10/10/2025

window.addEventListener("DOMContentLoaded", () => {
    showModules();
});

async function showModules() {
    try {
        // Fetch the modules' data for this user
        const res = await fetch("/api/display_modules_frontpage", { 
            method: "POST" 
        });
        const data = await res.json();

        // Something went wrong
        if (!data || !data.results) {
            if (data.error == "No marking attempts found") {
                console.log("No results found", data);
                const errorMessage = document.getElementById("no-marking-attempts-message");
                errorMessage.style.display = flex;
            } else {
                console.log("Invalid data", data);
                const errorMessage = document.getElementById("unknown-error-message");
                errorMessage.style.display = flex;
            }
        } else {
            if (data.role == "Admin") {
                createModerationTables(data, createAdminTable);
            } else {
                createModerationTables(data, createMarkerTable);
            }
        }
    } catch (err) {
        console.log("An error occurred: ", err);
    }
}

// Creates collapsible accordions for years and semesters,
// and moderation tables inside the semesters' accordions.
// Collapsibles/Accordion Tutorial on https://www.w3schools.com/howto/howto_js_accordion.asp
// https://www.w3schools.com/html/html_table_headers.asp
async function createModerationTables(data, createTableFn) {
    const container = document.getElementById("accordions");
    if (!container) return;

    const grouped = {};
    data.results.forEach(result => {
        const { year, semester, assignment_num } = result;

        // Initialize year and semester groups if missing
        if (!grouped[year]) grouped[year] = {};
        if (!grouped[year][semester]) grouped[year][semester] = {};
        if (!grouped[year][semester][assignment_num]) grouped[year][semester][assignment_num] = [];

        // Push this result into its semester
        grouped[year][semester][assignment_num].push(result);
    })

    for (const year in grouped) {
        // Create year accordion button
        const yearButton = document.createElement("button");
        yearButton.className = "accordion";
        yearButton.textContent = year;

        const yearPanel = document.createElement("div");
        yearPanel.className = "panel";

        for (const semester in grouped[year]) {
            const semesterButton = document.createElement("button");
            semesterButton.className = "accordion1";
            semesterButton.textContent = `Semester ${semester}`;

            const semesterPanel = document.createElement("div");
            semesterPanel.className = "panel";

            for (const assignmentNum in grouped[year][semester]) {
                const assignentButton = document.createElement("button");
                assignentButton.className = "accordion2";
                assignentButton.textContent = `Assignment ${assignmentNum}`;

                const assignmentPanel = document.createElement("div");
                assignmentPanel.className = "panel";

                const row = document.createElement("div");
                row.className = "row";

                // Loop through moderations
                for (const moderationData in grouped[year][semester][assignmentNum]) {
                    const column = createTableFn(moderationData);
                    row.appendChild(column);
                }

                assignmentPanel.appendChild(row);
                semesterPanel.appendChild(assignentButton);
                semesterPanel.appendChild(assignmentPanel);
            }

            yearPanel.appendChild(semesterButton);
            yearPanel.appendChild(semesterPanel);

            const lineBreak = document.createElement("br");
            yearPanel.appendChild(lineBreak);
        }

        container.appendChild(yearButton);
        container.appendChild(yearPanel);

        const lineBreak = document.createElement("br");
        container.appendChild(lineBreak);
    }

    // Initialise the interactive toggle
    // Call from accordions-toggle.js
    var accordion = document.getElementsByClassName("accordion");
    var accordion1 = document.getElementsByClassName("accordion1");
    var accordion2 = document.getElementsByClassName("accordion2");
    toggleAccordion(accordion);
    toggleAccordion(accordion1);
    toggleAccordion(accordion2);
}

// HTML code to generate the admin's moderation tables
function createAdminTable(moderationData) {
    const column = document.createElement("div");
    column.className = "column";

    // Also add a link to a page for each moderation (and generate the content depending on the link clicked)
    // Eg: Get the Year, Semester, and Moderation of the link and extract the appropriate data from the DB
    column.innerHTML = `
        <table class="moderation-table">
            <tr>
                <th colspan="2">
                    <span class="table-header">
                        <span class="moderation-link" onclick="window.location.href=
                            '../example-moderation-pages/admin-moderation.html'">
                            Moderation ${moderationData.moderation_num}
                        </span>
                        <input type="checkbox" class="table-checkbox">
                    </span>
                </th>
            </tr>
            <tr><td>Admin Marks</td><td>${moderationData.admin_total}</td></tr>
            <tr><td>Average</td><td>${moderationData.average}</td></tr>
            <tr><td>Variation</td><td>${moderationData.variation}</td></tr>
            <tr><td>Distribution</td><td>${moderationData.distribution}</td></tr>
        </table>
    `;

    return column;
}

// HTML code to generate the marker's moderation tables
function createMarkerTable(moderationData) {
    const column = document.createElement("div");
    column.className = "column";

    const adminMarks = moderationData.admin_total;
    const userMarks = moderationData.user_total;
    const difference = adminMarks - userMarks;

    column.innerHTML = `
        <table class="moderation-table">
            <tr>
                <th colspan="2">
                    <span class="table-header">
                        <span class="moderation-link" onclick="window.location.href=
                            '../example-moderation-pages/marker-moderation.html'">
                            Moderation ${moderationData.moderation_num}
                        </span>
                    </span>
                </th>
            </tr>
            <tr><td>Admin Marks</td><td>${moderationData.admin_total}</td></tr>
            <tr><td>Your Marks</td><td>${moderationData.user_total}</td></tr>
            <tr><td>Difference</td><td>${difference}</td></tr>
        </table>
    `;

    return column;
}