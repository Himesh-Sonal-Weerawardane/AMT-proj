
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
        showStatus.lastInfoTS = Date.now();
        statusEl.style.background = "rgba(76, 110, 245, 0.08)";
        statusEl.style.color = "var(--module-accent, #4c6ef5)";
        statusEl.style.borderColor = "rgba(76, 110, 245, 0.2)";
    }
};

const DEFAULT_HEADERS = [
    "Criteria",
    "High Distinction",
    "Distinction",
    "Credit",
    "Pass",
    "Fail",
    "Criteria Score",
];

const GRADE_ORDER = [
    "High Distinction",
    "Distinction",
    "Credit",
    "Pass",
    "Fail",
];

let rubricHeaders = [...DEFAULT_HEADERS];
let rubricTable = null;
let adminTable = null;

// =========================
// Handsontable setup
// =========================
function ensureRubricTable() {
    if (rubricTable) return rubricTable;

    const container = document.getElementById("handsontable-grid");
    if (!container) return null;

    rubricTable = new Handsontable(container, {
        themeName: "ht-theme-main",
        data: [new Array(rubricHeaders.length).fill("")],
        colHeaders: rubricHeaders,
        rowHeaders: true,
        navigableHeaders: true,
        tabNavigation: true,
        manualColumnResize: true,
        manualColumnMove: true,
        manualRowResize: true,
        manualRowMove: true,
        selectionMode: "range",
        headerClassName: "htLeft",
        stretchH: "all",
        height: "100%",
        width: "100%",
        licenseKey: "non-commercial-and-evaluation",
        enterBeginsEditing: true,
        readOnly: false,
        contextMenu: [
            "row_above",
            "row_below",
            "remove_row",
            "---------",
            "col_left",
            "col_right",
            "remove_col",
            "---------",
            "undo",
            "redo",
            "alignment",
            "copy",
            "cut",
            "paste",
        ],
        dropdownMenu: true,
        filters: true,
    });

    return rubricTable;
}

function setRubricData(headers, rows) {
    rubricHeaders = headers && headers.length ? [...headers] : [...DEFAULT_HEADERS];
    ensureRubricTable();
    if (!rubricTable) return;
    rubricTable.updateSettings({ colHeaders: rubricHeaders });
    rubricTable.loadData(rows && rows.length ? rows : [new Array(rubricHeaders.length).fill("")]);
}

// =========================
// Build <-> Table converters
// =========================
function buildRubricFromJSON(rubricJSON) {
    const headers = [...DEFAULT_HEADERS];

    if (!rubricJSON?.criteria?.length) {
        return { headers, rows: [new Array(headers.length).fill("")] };
    }

    const rows = rubricJSON.criteria.map((c) => {
        const row = new Array(headers.length).fill("");

        row[0] = c.criterion || "";

        GRADE_ORDER.forEach((gradeName, idx) => {
            const g = (c.grades || []).find((gr) => gr.grade === gradeName);
            if (g) {
                const descriptionText = Array.isArray(g.description)
                    ? g.description.join("\n\n")
                    : (g.description || "");
                // Join description + optional pointsRange on separate line (if present)
                row[1 + idx] = [descriptionText, g.pointsRange || ""].filter(Boolean).join("\n\n");
            }
        });

        const scoreColIndex = headers.length - 1; // "Criteria Score"
        row[scoreColIndex] = c.maxPoints ? `/ ${c.maxPoints}` : "";
        return row;
    });

    return { headers, rows };
}

/**
 * Serialize current rubric table to JSON (7 columns).
 * Columns:
 * [0] Criteria, [1] HD, [2] D, [3] C, [4] P, [5] F, [6] Criteria Score
 */

function extractRubricDataFromTable() {
    const data = rubricTable.getData();

    const normalizeDashes = (value) => {
        if (value == null) return "";
        return String(value).replace(/-/g, "–");
    };

    const parseMax = (cell) => {
        if (!cell) return "";
        const s = String(cell).trim();
        if (s.startsWith("/")) return s.replace("/", "").trim();
        return Number(s);
    };

    return {
        criteria: data.map((row) => {
            const criterionName = normalizeDashes(row[0] || "");

            const grades = [
                { grade: "High Distinction", description: normalizeDashes(row[1] || "") },
                { grade: "Distinction",      description: normalizeDashes(row[2] || "") },
                { grade: "Credit",           description: normalizeDashes(row[3] || "") },
                { grade: "Pass",             description: normalizeDashes(row[4] || "") },
                { grade: "Fail",             description: normalizeDashes(row[5] || "") },
            ];

            const maxPoints = normalizeDashes(parseMax(row[6]));

            return {
                criterion: criterionName,
                grades: [
                    {
                        grade: "High Distinction",
                        description: parseDescription(row[1] || ""),
                        pointsRange: extractRange(row[1] || ""),
                    },
                    {
                        grade: "Distinction",
                        description: parseDescription(row[2] || ""),
                        pointsRange: extractRange(row[2] || ""),
                    },
                    {
                        grade: "Credit",
                        description: parseDescription(row[3] || ""),
                        pointsRange: extractRange(row[3] || ""),
                    },
                    {
                        grade: "Pass",
                        description: parseDescription(row[4] || ""),
                        pointsRange: extractRange(row[4] || ""),
                    },
                    {
                        grade: "Fail",
                        description: parseDescription(row[5] || ""),
                        pointsRange: extractRange(row[5] || ""),
                    }
                ],
                maxPoints: Number(parseMax(row[6])) || 0,
            };
        }),
    };
}

function extractAdminDataFromTable() {
    const data = adminTable.getData();
    return {
        criteria: data.map((row) => ({
            criterion: row[0] || "",
            feedback: row[1] || "",
            admin_score: row[2] ?? "",
        })),
    };
}

// (Optional helper; fixed to use criteria consistently)
function populateAdminTable(adminJSON) {
    if (!adminJSON?.criteria?.length) {
        return [{ criterion: "", feedback: "", admin_score: null }];
    }
    return adminJSON.criteria.map((c) => ({
        criterion: c.criterion || "",
        feedback: c.feedback || "",
        admin_score: c.admin_score ?? "",
    }));
}

// =========================
// Document preview helpers
// =========================
const OFFICE_VIEWER_EXTENSIONS = new Set(["doc","docx","xls","xlsx","ppt","pptx"]);

function getFileExtensionFromUrl(url) {
    if (!url || typeof url !== "string") return null;
    const withoutHash = url.split("#")[0];
    const withoutQuery = withoutHash.split("?")[0];
    const parts = withoutQuery.split(".");
    if (parts.length <= 1) return null;
    return parts.pop().toLowerCase();
}

function getDocumentPreviewConfig(url) {
    const extension = getFileExtensionFromUrl(url);
    if (!extension) return null;

    if (extension === "pdf") {
        return { mimeType: "application/pdf", src: url };
    }
    if (OFFICE_VIEWER_EXTENSIONS.has(extension)) {
        const viewerUrl = "https://view.officeapps.live.com/op/embed.aspx?src=" + encodeURIComponent(url);
        return { mimeType: "text/html", src: viewerUrl };
    }
    return null;
}

function applyDocumentPreview(objectEl, url, options = {}) {
    if (!objectEl) return { supported: false, reason: "missing-element" };

    const { hideOnUnsupported = true } = options;
    const config = getDocumentPreviewConfig(url);

    if (!config) {
        objectEl.removeAttribute("data");
        objectEl.hidden = hideOnUnsupported;
        return { supported: false, reason: "unsupported-extension" };
    }

    console.log("Preview URL:", url);
    objectEl.type = config.mimeType;
    objectEl.data = config.src;
    objectEl.hidden = false;
    return { supported: true };
}

// -------- Render moderation stats -------------
function renderStatsCard(moderation) {

    const container = document.getElementById("moderation-stats-body");
    if (!container) return;

    const { moderationName, criteria, rows } = moderation;

    let statsHTML = `
        <div class="stats-wrapper">
            <div class="moderation-stats-title">
                <a href="./moderation.html?id=${moderation.id}" class="moderation-link">
                     ${moderationName}
                </a>
            </div>
                
            <div class="stats-container">
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th>Criterion</th>
                            ${rows.map((r) => `<th>${r.label}</th>`).join("")}
                        </tr>
                    </thead>
                    <tbody>    
        `;

    criteria.forEach((criterion, index) => {
        statsHTML += `
                <tr>
                    <td class="row-label">${criterion}</td>
                    ${rows.map((r) => {
            const score = r.scores[index];

            if (
                score === "-" ||
                r.label.includes("Range") ||
                r.label.includes("Unit Chair")
            ) {
                return `<td>${score}</td>`;
            } else {
                const rowLower = rows.find((row) => row.label === "5% Lower Range");
                const rowUpper = rows.find((row) => row.label === "5% Upper Range");
                const inRange =
                    typeof score === "number" &&
                    score >= rowLower.scores[index] &&
                    score <= rowUpper.scores[index];
                return `<td class="${inRange ? "in-range" : "out-of-range"}">${score}</td>`;
            }
        }).join("")}
                </tr>
            `;
    });

    const lowerRow = rows.find((row) => row.label === "5% Lower Range");
    const upperRow = rows.find((row) => row.label === "5% Upper Range");

    statsHTML += `
            <tr class="total-row">
                <td class="row-label">Total</td>
                ${rows.map((r) => {
        if (!r.label.includes("Range") && !r.label.includes("Unit Chair")) {
            const lower = parseFloat(lowerRow?.total || 0);
            const upper = parseFloat(upperRow?.total || 0);
            const totalVal = parseFloat(r.total || 0);

            const inRange = totalVal >= lower && totalVal <= upper;
            return `<td class="total-cell ${inRange ? "in-range" : "out-of-range"}">${r.total}</td>`;
        }
        return `<td class="total-cell">${r.total}</td>`;
    }).join("")}
            </tr>
        `;

    statsHTML += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;


    container.innerHTML = statsHTML;

}

// ------------ Render moderation overall statistics -----------

function renderOverallStats(overallStats) {

    const container = document.getElementById("overall-stats");
    if (!container) return;

    if (!Array.isArray(overallStats) || overallStats.length === 0) {
        container.innerHTML = `<p style="text-align: center">No markers have marked this moderation yet.</p>`;
        return;
    }

    let html = `
        <div class="stats-wrapper">
            <div class="stats-container">
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th>Criterion</th>
                            <th>Mean</th>
                            <th>Standard Deviation</th>
                            <th>Minimum</th>
                            <th>Maximum</th>
                        </tr>
                    </thead>
                    
                    <tbody>
                        ${overallStats.map((s) => `
                            <tr class="${s.criterion === "Total" ? "total-row" : ""}">
                                <td class="row-label">${s.criterion}</td>
                                <td>${s.mean}</td>
                                <td>${s.std}</td>
                                <td>${s.min}</td>
                                <td>${s.max}</td>
                            </tr>   
                        `).join("")}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    container.innerHTML = html;

}


window.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const moduleId = params.get("id");

    const contentEl = document.getElementById("module-content");
    const rubricEmpty = document.getElementById("rubric-empty");
    const assignmentPreview = document.getElementById("assignment-preview");
    const assignmentDownload = document.getElementById("assignment-download");
    const rubricDownload = document.getElementById("rubric-download");
    const adminFeedbackCard = document.getElementById("admin-feedback-card");
    const adminFeedbackMessage = document.getElementById("admin-feedback-message");
    const adminGridEl = document.getElementById("adminHandsontable-grid");

    if (!moduleId) {
        showStatus("Module ID missing from the URL.", true);
        return;
    }

    ensureRubricTable();
    wireRubricToolbar();
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

        try {
            const statsRes = await fetch(`/api/moderations/${encodeURIComponent(moduleId)}/stats`);
            if (statsRes.ok) {
                const statsData = await statsRes.json();
                console.log(statsData);
                renderStatsCard(statsData);
                renderOverallStats(statsData.overallStats);
            } else {
                console.warn(`Failed to load moderation stats.`);
                document.getElementById("moderation-stats-body").innerHTML =
                    "<p>No statistics available for this moderation.</p>"

            }
        } catch (err) {
            console.error("Failed to load moderation stats.", err);
            document.getElementById("moderation-stats-body").innerHTML =
                "<p>Failed to load moderation stats.</p>"
        }

        const breadcrumbSegments = [];
        if (data.year) breadcrumbSegments.push(`Year ${data.year}`);
        if (data.semester) breadcrumbSegments.push(`Semester ${data.semester}`);
        if (data.assignment_number) breadcrumbSegments.push(`Assignment ${data.assignment_number}`);
        if (data.moderation_number) breadcrumbSegments.push(`Moderation ${data.moderation_number}`);
        document.getElementById("module-breadcrumb").textContent = breadcrumbSegments.join(" • ") || "Module";

        document.getElementById("module-title").textContent = data.name || "Untitled Module";
        document.getElementById("module-description").textContent = data.description || "No description was provided for this module.";

        const deadline = formatDate(data.due_date);
        const uploaded = formatDate(data.upload_date);
        document.getElementById("module-deadline").textContent = deadline ? `Deadline: ${deadline}` : "";
        document.getElementById("module-uploaded").textContent = uploaded ? `Uploaded: ${uploaded}` : "";

        // Assignment doc preview
        if (data.assignment_public_url) {
            const assignmentPreviewState = applyDocumentPreview(assignmentPreview, data.assignment_public_url, { hideOnUnsupported: false });
            assignmentDownload.href = data.assignment_public_url;
            assignmentDownload.hidden = false;
            if (!assignmentPreviewState.supported) {
                assignmentPreview.removeAttribute("data");
            }
        } else {
            assignmentPreview.removeAttribute("data");
            assignmentPreview.hidden = true;
        }

        // Rubric download link
        if (data.rubric_public_url) {
            rubricDownload.href = data.rubric_public_url;
            rubricDownload.hidden = false;
        }

        // Admin feedback card visible
        adminFeedbackCard.hidden = false;
        adminFeedbackMessage.hidden = true;

        // Admin feedback table
        if (adminGridEl) {
            adminTable = new Handsontable(adminGridEl, {
                themeName: "ht-theme-main",
                columns: [
                    { data: "criterion", title: "Criterion", width: 200 },
                    { data: "feedback", title: "Feedback", width: 400 },
                    { data: "admin_score", title: "Admin Score", type: "text", width: 120 }
                ],
                data: [{ criterion: "", feedback: "", admin_score: null }],
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
                contextMenu: true
            });

            // Populate from API (restored)
            let adminJSON = data.admin_feedback;
            if (typeof adminJSON === "string") {
                try { adminJSON = JSON.parse(adminJSON); } catch { adminJSON = null; }
            }
            const adminRows = populateAdminTable(adminJSON);
            adminTable.loadData(adminRows);

            const hasRealData = adminRows.some(r =>
                (r.criterion && String(r.criterion).trim() !== "") ||
                (r.feedback && String(r.feedback).trim() !== "") ||
                (r.admin_score !== "" && r.admin_score !== null && r.admin_score !== undefined)
            );

            if (!hasRealData) {
                adminFeedbackMessage.textContent = "No admin feedback has been entered yet.";
                adminFeedbackMessage.hidden = false;
            }

            // Submit (guarded)
            const submitBtn = document.getElementById("submit-button");
            if (submitBtn) {
                submitBtn.addEventListener("click", async () => {
                    submitBtn.disabled = true;
                    try {
                        const updatedAdminFeedback = extractAdminDataFromTable();
                        const updatedRubricJSON = extractRubricDataFromTable();

                        await fetch(`/api/moderations/${moduleId}/rubric`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                rubric_json: updatedRubricJSON,
                                admin_feedback: updatedAdminFeedback,
                            }),
                        });

                        showStatus("Saved successfully.");
                        setTimeout(() => {
                            const statusEl = document.getElementById("status-message");
                            if (statusEl && statusEl.dataset.state !== "error") statusEl.hidden = true;
                        }, 2000);
                    } catch (err) {
                        console.error("Save error:", err);
                        showStatus("Failed to save feedback/rubric.", true);
                    } finally {
                        submitBtn.disabled = false;
                    }
                });
            }
        } else {
            adminFeedbackMessage.textContent = "Admin feedback table failed to initialise.";
            adminFeedbackMessage.hidden = false;
        }

        // Rubric population (restored)
        const { headers: builtHeaders, rows } = buildRubricFromJSON(data.rubric_json);
        setRubricData(builtHeaders, rows);

        // Rubric empty state toggle
        if (rows && rows.length && rows.some(r => r.some(cell => String(cell || "").trim() !== ""))) {
            rubricEmpty.hidden = true;
        } else {
            rubricEmpty.hidden = false;
        }

        // Finalise UI
        showStatus("Module ready.");
        setTimeout(() => {
            const statusEl = document.getElementById("status-message");
            if (statusEl && statusEl.dataset.state !== "error") statusEl.hidden = true;
        }, 2500);
        contentEl.hidden = false;

    } catch (e) {
        console.error(e);
        showStatus("An unexpected error occurred while loading the module.", true);
    }
});

// =========================
// Toolbar wiring
// =========================
function wireRubricToolbar() {
    const $ = (id) => document.getElementById(id);
    const hot = ensureRubricTable();
    if (!hot) return;

    const getSel = () => hot.getSelectedLast();

    $("add-row")?.addEventListener("click", () => {
        const sel = getSel();
        const insertAt = sel ? Math.max(sel[0], sel[2]) + 1 : hot.countRows();
        hot.alter("insert_row", insertAt, 1);
    });

    $("remove-row")?.addEventListener("click", () => {
        if (!hot.countRows()) return;
        const sel = getSel();
        if (!sel) {
            hot.alter("remove_row", hot.countRows() - 1, 1);
            return;
        }
        const rStart = Math.min(sel[0], sel[2]);
        const rAmount = Math.abs(sel[2] - sel[0]) + 1;
        hot.alter("remove_row", rStart, rAmount);
    });

    $("add-col")?.addEventListener("click", () => {
        const sel = getSel();
        const insertAt = sel ? Math.max(sel[1], sel[3]) + 1 : hot.countCols();
        hot.alter("insert_col", insertAt, 1);
        rubricHeaders.splice(insertAt, 0, `Column ${insertAt + 1}`);
        hot.updateSettings({ colHeaders: rubricHeaders });
    });

    $("remove-col")?.addEventListener("click", () => {
        if (!hot.countCols()) return;
        const sel = getSel();
        if (!sel) {
            hot.alter("remove_col", hot.countCols() - 1, 1);
            rubricHeaders.splice(rubricHeaders.length - 1, 1);
            hot.updateSettings({ colHeaders: rubricHeaders });
            return;
        }
        const cStart = Math.min(sel[1], sel[3]);
        const cAmount = Math.abs(sel[3] - sel[1]) + 1;
        hot.alter("remove_col", cStart, cAmount);
        rubricHeaders.splice(cStart, cAmount);
        hot.updateSettings({ colHeaders: rubricHeaders });
    });
}
