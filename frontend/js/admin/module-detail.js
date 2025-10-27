const formatDate = (isoString) => {
    if (!isoString) return "";
    try {
        const date = new Date(isoString);
        return date.toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    } catch (err) {
        console.error("Failed to format date", err);
        return isoString;
    }
};

const sanitizeNumber = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};

const formatNumber = (value, options = {}) => {
    const numeric = sanitizeNumber(value);
    if (numeric === null) return "—";

    const formatter = new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
        ...options,
    });

    return formatter.format(numeric);
};

const formatPercent = (value) => {
    const numeric = sanitizeNumber(value);
    if (numeric === null) return "—";

    const formatter = new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    return `${formatter.format(numeric)}%`;
};

const formatDateTime = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const clearElement = (element) => {
    if (!element) return;
    while (element.firstChild) {
        element.removeChild(element.firstChild);
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

let activeBoxPlots = [];

const destroyActiveCharts = () => {
    activeBoxPlots.forEach((chart) => {
        if (chart && typeof chart.destroy === "function") {
            chart.destroy();
        }
    });
    activeBoxPlots = [];
};

const renderDifferenceBoxPlot = (rows, container) => {
    if (!container) return;

    destroyActiveCharts();
    clearElement(container);
    container.hidden = true;

    if (!Array.isArray(rows) || rows.length === 0 || typeof ApexCharts === "undefined") {
        return;
    }

    const grouped = rows.reduce((acc, row) => {
        const key = row.criterion || "Other";
        if (!acc[key]) acc[key] = [];
        acc[key].push(row);
        return acc;
    }, {});

    let hasRenderableData = false;

    Object.entries(grouped).forEach(([criterion, criterionRows]) => {
        const dataPoints = criterionRows
            .map((row) => {
                const lower = sanitizeNumber(row.range_lower);
                const upper = sanitizeNumber(row.range_upper);
                const markerMark = sanitizeNumber(row.marker_mark);

                if (lower === null || upper === null || markerMark === null) {
                    return null;
                }

                return {
                    x: row.marker_id != null ? `Marker ${row.marker_id}` : "Marker",
                    y: [lower, lower, markerMark, upper, upper],
                    lowerBound: lower,
                    upperBound: upper,
                    markerMark,
                    unitChairMark: sanitizeNumber(row.unit_chair_mark),
                };
            })
            .filter(Boolean);

        if (!dataPoints.length) {
            return;
        }

        hasRenderableData = true;

        const section = document.createElement("section");
        section.className = "moderation-chart-section";

        const heading = document.createElement("h3");
        heading.className = "moderation-chart-title";
        heading.textContent = criterion;
        section.appendChild(heading);

        const chartEl = document.createElement("div");
        chartEl.className = "moderation-chart-container";
        section.appendChild(chartEl);

        container.appendChild(section);

        const chart = new ApexCharts(chartEl, {
            chart: {
                type: "boxPlot",
                height: 320,
                toolbar: { show: false },
                animations: { enabled: false },
            },
            series: [
                {
                    name: "Marker Comparison",
                    data: dataPoints,
                },
            ],
            plotOptions: {
                boxPlot: {
                    colors: {
                        upper: "#4c6ef5",
                        lower: "#4c6ef5",
                    },
                },
            },
            stroke: {
                colors: ["#1b1b1f"],
            },
            dataLabels: {
                enabled: false,
            },
            xaxis: {
                type: "category",
                labels: {
                    rotate: -15,
                },
            },
            yaxis: {
                title: {
                    text: "Marks",
                },
            },
            tooltip: {
                custom: ({ seriesIndex, dataPointIndex, w }) => {
                    const point = w.config.series[seriesIndex].data[dataPointIndex];
                    const lines = [
                        `<strong>${point.x}</strong>`,
                        `Lower bound: ${formatNumber(point.lowerBound, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                        `Marker mark: ${formatNumber(point.markerMark, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                        `Upper bound: ${formatNumber(point.upperBound, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    ];

                    if (point.unitChairMark != null) {
                        lines.push(`Unit chair mark: ${formatNumber(point.unitChairMark, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                    }

                    return `<div class="stats-tooltip">${lines.join("<br>")}</div>`;
                },
            },
            theme: {
                mode: "light",
            },
        });

        chart.render();
        activeBoxPlots.push(chart);
    });

    if (hasRenderableData) {
        container.hidden = false;
    }
};

const loadModerationStats = async ({ moduleId, tableBody, statusElement, emptyElement, chartContainer, headers }) => {
    if (!moduleId || !tableBody) return;

    if (statusElement) {
        statusElement.textContent = "Loading moderation statistics…";
        statusElement.hidden = false;
        statusElement.dataset.state = "loading";
        statusElement.style.background = "rgba(76, 110, 245, 0.08)";
        statusElement.style.color = "var(--module-accent, #4c6ef5)";
        statusElement.style.borderColor = "rgba(76, 110, 245, 0.2)";
    }

    if (emptyElement) emptyElement.hidden = true;

    try {
        const res = await fetch(`/api/moderations/${encodeURIComponent(moduleId)}/stats`, { headers });

        if (!res.ok) {
            throw new Error(`Failed to fetch moderation stats: ${res.status}`);
        }

        const rows = await res.json();

        tableBody.innerHTML = "";

        if (!Array.isArray(rows) || rows.length === 0) {
            if (statusElement) statusElement.hidden = true;
            if (emptyElement) emptyElement.hidden = false;
            renderDifferenceBoxPlot([], chartContainer);
            return;
        }

        rows.forEach((row) => {
            const tr = document.createElement("tr");
            const cells = [
                row.marker_id ?? "—",
                row.moderation_id ?? "—",
                row.criterion ?? "—",
                formatNumber(row.max_points),
                formatNumber(row.unit_chair_mark),
                formatNumber(row.range_lower),
                formatNumber(row.range_upper),
                formatNumber(row.marker_mark),
                formatPercent(row.unit_chair_pct),
                formatPercent(row.marker_pct),
                formatPercent(row.difference_pct),
                formatDateTime(row.updated_at || row.created_at),
            ];

            cells.forEach((value) => {
                const td = document.createElement("td");
                td.textContent = value;
                tr.appendChild(td);
            });

            tableBody.appendChild(tr);
        });

        if (statusElement) statusElement.hidden = true;
        if (emptyElement) emptyElement.hidden = true;

        renderDifferenceBoxPlot(rows, chartContainer);
    } catch (error) {
        console.error("Failed to load moderation stats", error);
        if (statusElement) {
            statusElement.textContent = "Failed to load moderation statistics.";
            statusElement.hidden = false;
            statusElement.dataset.state = "error";
            statusElement.style.background = "rgba(224, 49, 49, 0.08)";
            statusElement.style.color = "#c92a2a";
            statusElement.style.borderColor = "rgba(224, 49, 49, 0.2)";
        }
        if (emptyElement) emptyElement.hidden = true;
        renderDifferenceBoxPlot([], chartContainer);
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
    const statsTableBody = document.getElementById("moderation-stats-tbody");
    const statsStatus = document.getElementById("moderation-stats-status");
    const statsEmpty = document.getElementById("moderation-stats-empty");
    const chartSections = document.getElementById("moderation-chart-sections");

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
        const res = await fetch(`/api/moderations/${encodeURIComponent(moduleId)}`, { headers });
        if (!res.ok) {
            const errorText = res.status === 404
                ? "We couldn't find that module."
                : "Failed to load module details.";
            showStatus(errorText, true);
            return;
        }

        const data = await res.json();

        const breadcrumbSegments = [];
        if (data.year) breadcrumbSegments.push(`Year ${data.year}`);
        if (data.semester) breadcrumbSegments.push(`Semester ${data.semester}`);
        if (data.moderation_number) breadcrumbSegments.push(`Moderation ${data.moderation_number}`);
        document.getElementById("module-breadcrumb").textContent = breadcrumbSegments.join(" • ") || "Module";

        document.getElementById("module-title").textContent = data.name || "Untitled Module";
        document.getElementById("module-description").textContent = data.description || "No description was provided for this module.";

        const deadline = formatDate(data.due_date);
        const uploaded = formatDate(data.upload_date);
        document.getElementById("module-deadline").textContent = deadline ? `Deadline: ${deadline}` : "";
        document.getElementById("module-uploaded").textContent = uploaded ? `Uploaded: ${uploaded}` : "";

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

        loadModerationStats({
            moduleId,
            tableBody: statsTableBody,
            statusElement: statsStatus,
            emptyElement: statsEmpty,
            chartContainer: chartSections,
            headers,
        });

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
    { key: "fail", name: "Fail" }
];
const criteriaScore = "criteriaScore";

// https://github.com/handsontable/handsontable
// npm install handsontable
const element = document.getElementById("handsontable-grid");
const rubricTable = new Handsontable(element, {
    // theme name with obligatory ht-theme-* prefix
    themeName: 'ht-theme-main',
    // other options
    columns: [
        { data: `${criteria}`, title: "Criteria", width: 170 },
        ...gradeMap.map(g => ({
            data: g.key,
            title: g.name,
            width: 170
        })),
        { data: `${criteriaScore}`, title: "Criteria Score", width: 100 },
    ],
    data: [
        {}
    ],
    
    height: '100%',
    width: '100%',
    stretchH: 'all',
    rowHeaders: true,
    navigableHeaders: true,
    tabNavigation: true,
    manualColumnResize: true,
    selectionMode: 'range',
    headerClassName: "htLeft",
    licenseKey: "non-commercial-and-evaluation",
    manualRowMove: true,
    contextMenu: true
});


function populateRubricTable(rubricJSON) {
    // Fallback empty row
    if (!rubricJSON?.criteria) return [{}];

    return rubricJSON.criteria.map(c => {
        const row = {
            criteria: c.criterion || "",
            criteriaScore: c.maxPoints ? `/ ${c.maxPoints}` : ""
        };

        // Initialize all grades to empty string
        gradeMap.forEach(g => row[g.key] = "");

        // Fill in grades from rubric JSON
        (c.grades || []).forEach(g => {
            const gradeKey = gradeMap.find(m => m.name === g.grade)?.key;
            if (!gradeKey) return;

            const descriptionText = (g.description || []).join("\n\n");
            row[gradeKey] = `${descriptionText}\n\n${g.pointsRange || ""}`;
        });

        return row;
    });
}
