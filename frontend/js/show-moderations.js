// Created by William Alexander Tang Wai on 10/10/2025

// Fetch appropriate JSON file for admin and markers, and dynamically
// generate the moderation tables
window.addEventListener("DOMContentLoaded", async () => {
    try {
        const role = document.body.dataset.role;

        // NOTE: TO CHANGE
        // Check the login info (i.e. admin or marker) and filter data as appropriate
        if (role == "admin") {
            const response = await fetch('../example-moderation-data/admin-moderations.json');
            if (!response.ok) throw new Error('Data could not be fetched');
            const data = await response.json();
            createModerationTables(data, createAdminTable);
        } else if (role == "marker") {
            // fetch marker-moderations.json and a filtered version of admin-moderations.json
            // So server-side will filter the admin data and leave only "Admin Marks"
            const [adminRes, markerRes] = await Promise.all([
                fetch('../example-moderation-data/admin-moderations.json'),
                fetch('../example-moderation-data/marker-moderations.json')
            ]);

            if (!adminRes.ok || !markerRes.ok) {
                throw new Error('Failed to load moderation data');
            }

            const adminData = await adminRes.json();
            const markerData = await markerRes.json();

            const data = mergeModerationData(adminData, markerData);
            createModerationTables(data, createMarkerTable);
        }
    } catch (error) {
        console.error(error);
    }
});

// Merges the filtered admin's table and the marker's table
function mergeModerationData(adminData, markerData) {
    const merged = [];

    for (const [objNum, years] of Object.entries(adminData)) {
        yearObj = null;
        for (const [year, semesters] of Object.entries(years)) {
            yearObj = { [year]: {}};
            for (const [sem, moderations] of Object.entries(semesters)) {
                yearObj[year][sem] = {};
                for (const [mod, adminMod] of Object.entries(moderations)) {
                    // Find data at the same level in the markerData
                    const markerMod = markerData?.[objNum]?.[year]?.[sem]?.[mod] || {};
                    // Copy all properties into a new merged object
                    yearObj[year][sem][mod] = {
                        ...adminMod,
                        ...markerMod
                    };
                }
            }
        }
        merged.push(yearObj);
    }

    return merged;
}

// Creates collapsible accordions for years and semesters,
// and moderation tables inside the semesters' accordions.
// Collapsibles/Accordion Tutorial on https://www.w3schools.com/howto/howto_js_accordion.asp
// https://www.w3schools.com/html/html_table_headers.asp
async function createModerationTables(data, createTableFn) {
    const container = document.getElementById("accordions");
    if (!container) return;

    data.forEach(yearObj => {
        // One key in each object which is the year
        const year = Object.keys(yearObj)[0];
        const semesters = yearObj[year];

        // Create year accordion button
        const yearBtn = document.createElement("button");
        yearBtn.className = "accordion";
        yearBtn.textContent = year;

        const yearPanel = document.createElement("div");
        yearPanel.className = "panel";

        // Loop through semesters
        Object.entries(semesters).forEach(([sem, moderations]) => {
            const semBtn = document.createElement("button");
            semBtn.className = "accordion1";
            semBtn.textContent = `Semester ${sem}`;

            const semPanel = document.createElement("div");
            semPanel.className = "panel";

            const row = document.createElement("div");
            row.className = "row";

            // Loop through moderations
            Object.entries(moderations).forEach(([modNumber, modData]) => {
                const column = createTableFn(modNumber, modData);
                row.appendChild(column);
            });

            semPanel.appendChild(row);
            yearPanel.appendChild(semBtn);
            yearPanel.appendChild(semPanel);

            const lineBreak = document.createElement("br");
            yearPanel.appendChild(lineBreak);
        });

        container.appendChild(yearBtn);
        container.appendChild(yearPanel);

        const lineBreak = document.createElement("br");
        container.appendChild(lineBreak);
    });

    // Call from home-page.js
    var accordion = document.getElementsByClassName("accordion");
    var accordion1 = document.getElementsByClassName("accordion1");
    toggleAccordion(accordion);
    toggleAccordion(accordion1);
}

// HTML code to generate the admin's moderation tables
function createAdminTable(modNumber, modData) {
    const column = document.createElement("div");
    column.className = "column";

    // Also add a link to a page for each moderation (and generate the content depending on the link clicked)
    // Eg: Get the Year, Semester, and Moderation of the link and extract the appropriate data from the DB
    column.innerHTML = `
        <table class="moderation-table">
            <tr>
                <th colspan="2">
                    <label class="table-select">
                        Moderation ${modNumber}
                        <input type="checkbox" class="table-checkbox">
                    </label>
                </th>
            </tr>
            <tr><td>Admin Marks</td><td>${modData["Admin Marks"] ?? "-"}</td></tr>
            <tr><td>Average</td><td>${modData["Average"] ?? "-"}</td></tr>
            <tr><td>Variation</td><td>${modData["Variation"] ?? "-"}</td></tr>
            <tr><td>Distribution</td><td>${modData["Distribution"] ?? "-"}</td></tr>
        </table>
    `;

    return column;
}

// HTML code to generate the marker's moderation tables
function createMarkerTable(modNumber, modData) {
    const column = document.createElement("div");
    column.className = "column";

    const adminMarks = modData["Admin Marks"];
    const markerMarks = modData["Marks"];
    const difference = (adminMarks && markerMarks)
        ? markerMarks - adminMarks
        : "-";

    column.innerHTML = `
        <table class="moderation-table">
            <tr>
                <th colspan="2">
                    Moderation ${modNumber}
                </th>
            </tr>
            <tr><td>Admin Marks</td><td>${adminMarks ?? "-"}</td></tr>
            <tr><td>Your Marks</td><td>${markerMarks ?? "-"}</td></tr>
            <tr><td>Difference</td><td>${difference}</td></tr>
        </table>
    `;

    return column;
}