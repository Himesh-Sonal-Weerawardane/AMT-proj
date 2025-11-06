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

function extractRubricDataFromTable() {
    const data = rubricTable.getData();
    const rubricJSON = {
        criteria: data.map(row => {
            const criterionName = row[0];
            const grades = [];

            for (let i = 1; i <= 5; i++) {
                const gradeDescription = row[i];
                const pointsRange = row[i + 5] || "";

                if (gradeDescription || pointsRange) {
                    grades.push({
                        grade: rubricHeaders[i],
                        description: gradeDescription,
                        pointsRange: pointsRange
                    });
                }
            }

            const maxPoints = row[10];

            return {
                criterion: criterionName,
                grades: grades,
                maxPoints: maxPoints
            };
        })
    };

    return rubricJSON;
}

function extractAdminDataFromTable() {
    const data = adminTable.getData();
    const adminJSON = {
        criteria: data.map(row => {
            return {
                feedback: row[1],
                criterion: row[0],
                admin_score: row[2]
            };
        })
    };
    return adminJSON;
}

function setRubricData(headers, rows) {
    rubricHeaders = headers && headers.length ? [...headers] : [...DEFAULT_HEADERS];

    ensureRubricTable();
    if (!rubricTable) return;

    rubricTable.updateSettings({ colHeaders: rubricHeaders });
    rubricTable.loadData(rows && rows.length ? rows : [new Array(rubricHeaders.length).fill("")]);
}

function buildRubricFromJSON(rubricJSON) {
    const headers = [...DEFAULT_HEADERS];

    if (!rubricJSON?.criteria?.length) {
        return {
            headers,
            rows: [new Array(headers.length).fill("")],
        };
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
                row[1 + idx] = [descriptionText, g.pointsRange || ""].filter(Boolean).join("\n\n");
            }
        });

        const scoreColIndex = headers.length - 1;
        row[scoreColIndex] = c.maxPoints ? `/ ${c.maxPoints}` : "";

        return row;
    });

    return { headers, rows };
}

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

function populateAdminTable(adminJSON) {
    if (!adminJSON.criteria?.length) {
        return [{}];
    }

    const rows = [];
    const len = adminJSON.feedback.length;

    for (let i = 0; i < len; i++) {
        const c = adminJSON.feedback[i];
        const row = {
            feedback: c.feedback,
            criterion: c.criterion || "",
            admin_score: c.admin_score || "",
        };
        rows.push(row);
    }

    return rows;
}

const OFFICE_VIEWER_EXTENSIONS = new Set([
    "doc",
    "docx",
    "xls",
    "xlsx",
    "ppt",
    "pptx"
]);

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
        return {
            mimeType: "application/pdf",
            src: url
        };
    }

    if (OFFICE_VIEWER_EXTENSIONS.has(extension)) {
        const viewerUrl = "https://view.officeapps.live.com/op/embed.aspx?src=" + encodeURIComponent(url);
        return {
            mimeType: "text/html",
            src: viewerUrl
        };
    }

    return null;
}

function applyDocumentPreview(objectEl, url, options = {}) {
    if (!objectEl) {
        return { supported: false, reason: "missing-element" };
    }

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

let adminTable = null;

window.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const moduleId = params.get("id");

    const contentEl = document.getElementById("module-content");
    const rubricList = document.getElementById("rubric-list");
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

        if (data.rubric_public_url) {
            rubricDownload.href = data.rubric_public_url;
            rubricDownload.hidden = false;
        }

        adminFeedbackCard.hidden = false;
        adminFeedbackMessage.hidden = true;

        if (adminGridEl) {
            adminTable = new Handsontable(adminGridEl, {
                themeName: 'ht-theme-main',
                columns: [
                    { data: 'criterion', title: 'Criterion', width: 200 },
                    { data: 'feedback', title: 'Feedback', width: 400 },
                    { data: 'admin_score', title: 'Admin Score', type: 'text', width: 120 }
                ],
                data: [{ criterion: "", feedback: "", admin_score: null }],
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

            document.getElementById("submit-button").addEventListener("click", async () => {
                const updatedAdminFeedback = extractAdminDataFromTable(adminTable);
                const updatedRubricJSON = extractRubricDataFromTable(rubricTable);

                try {
                    const res = await fetch(`/api/moderations/${moduleId}/rubric`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            rubric_json: updatedRubricJSON,
                            admin_feedback: updatedAdminFeedback,
                        }),
                    });
                    console.log("Working");
                    console.log("Admin Feedback:", updatedAdminFeedback);
                    console.log("Rubric JSON:", updatedRubricJSON);

                } catch (err) {
                    console.error("Error:", err);
                }
            });
        }
    } catch {
        showStatus("An unexpected error occurred while loading the module.", true);
    }
});
