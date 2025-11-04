
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

// ---------- Rubric table (Handsontable) ----------
/**
 * We use array-of-arrays data to allow fully dynamic rows/columns.
 * `rubricHeaders` holds the column headers and is kept in sync when inserting/removing columns.
 */
const DEFAULT_HEADERS = [
    "Criteria",
    "High Distinction",
    "Distinction",
    "Credit",
    "Pass",
    "Fail",
    "Criteria Score",
];

// For mapping JSON -> columns in a predictable order
const GRADE_ORDER = [
    "High Distinction",
    "Distinction",
    "Credit",
    "Pass",
    "Fail",
];

let rubricHeaders = [...DEFAULT_HEADERS];
let rubricTable = null;

/**
 * Create the Handsontable instance if needed.
 */
function ensureRubricTable() {
    if (rubricTable) return rubricTable;

    const container = document.getElementById("handsontable-grid");
    if (!container) return null;

    rubricTable = new Handsontable(container, {
        themeName: "ht-theme-main",
        data: [new Array(rubricHeaders.length).fill("")], // one empty row
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
        // Rich context menu including row/col ops + undo/redo
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

/**
 * Update table headers + data together.
 * @param {string[]} headers
 * @param {Array<Array<any>>} rows
 */
function setRubricData(headers, rows) {
    rubricHeaders = headers && headers.length ? [...headers] : [...DEFAULT_HEADERS];

    ensureRubricTable();
    if (!rubricTable) return;

    rubricTable.updateSettings({ colHeaders: rubricHeaders });
    rubricTable.loadData(rows && rows.length ? rows : [new Array(rubricHeaders.length).fill("")]);
}

/**
 * Build headers + rows (2D array) from rubric JSON.
 * Expected JSON shape (example):
 * {
 *   criteria: [
 *     {
 *       criterion: "Artefacts – Requirements",
 *       maxPoints: 10,
 *       grades: [
 *         { grade: "High Distinction", description: ["...","..."], pointsRange: "9–10" },
 *         ...
 *       ]
 *     },
 *     ...
 *   ]
 * }
 */
function buildRubricFromJSON(rubricJSON) {
    // Start from the standard columns; you can make this dynamic if your JSON carries extra grade columns.
    const headers = [...DEFAULT_HEADERS];

    if (!rubricJSON?.criteria?.length) {
        return {
            headers,
            rows: [new Array(headers.length).fill("")],
        };
    }

    const rows = rubricJSON.criteria.map((c) => {
        const row = new Array(headers.length).fill("");

        // 0: Criteria
        row[0] = c.criterion || "";

        // 1..5: Grade descriptions in fixed order
        GRADE_ORDER.forEach((gradeName, idx) => {
            const g = (c.grades || []).find((gr) => gr.grade === gradeName);
            if (g) {
                const descriptionText = Array.isArray(g.description)
                    ? g.description.join("\n\n")
                    : (g.description || "");
                row[1 + idx] = [descriptionText, g.pointsRange || ""].filter(Boolean).join("\n\n");
            }
        });

        // last: Criteria Score
        const scoreColIndex = headers.length - 1;
        row[scoreColIndex] = c.maxPoints ? `/ ${c.maxPoints}` : "";

        return row;
    });

    return { headers, rows };
}

/**
 * Attach toolbar button handlers for add/remove row/column.
 * Expects buttons with IDs: add-row, remove-row, add-col, remove-col
 */
function wireRubricToolbar() {
    const $ = (id) => document.getElementById(id);
    const hot = ensureRubricTable();
    if (!hot) return;

    const getSel = () => hot.getSelectedLast();

    // Insert Row
    $("add-row")?.addEventListener("click", () => {
        const sel = getSel();
        const insertAt = sel ? Math.max(sel[0], sel[2]) + 1 : hot.countRows();
        hot.alter("insert_row", insertAt, 1);
    });

    // Remove Row (selected range or last row)
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

    // Insert Column
    $("add-col")?.addEventListener("click", () => {
        const sel = getSel();
        // Insert to the right of the selection (or at the end)
        const insertAt = sel ? Math.max(sel[1], sel[3]) + 1 : hot.countCols();
        hot.alter("insert_col", insertAt, 1);

        // Maintain headers array
        rubricHeaders.splice(insertAt, 0, `Column ${insertAt + 1}`);
        hot.updateSettings({ colHeaders: rubricHeaders });
    });

    // Remove Column (selected range or last column)
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

// ---------- Page bootstrapping ----------
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

    objectEl.type = config.mimeType;
    objectEl.data = config.src;
    objectEl.hidden = false;
    return { supported: true };
}

window.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const moduleId = params.get("id");

    const contentEl = document.getElementById("module-content");
    const rubricList = document.getElementById("rubric-list"); // (Left intact; you may fill this elsewhere)
    const rubricEmpty = document.getElementById("rubric-empty");
    const assignmentPreview = document.getElementById("assignment-preview");
    const assignmentDownload = document.getElementById("assignment-download");
    const rubricDownload = document.getElementById("rubric-download");
    const adminFeedbackCard = document.getElementById("admin-feedback-card");
    const adminFeedbackPreview = document.getElementById("admin-feedback-preview");
    const adminFeedbackDownload = document.getElementById("admin-feedback-download");
    const adminFeedbackMessage = document.getElementById("admin-feedback-message");

    if (!moduleId) {
        showStatus("Module ID missing from the URL.", true);
        return;
    }

    // Create the table immediately so toolbar works even before data loads
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
        adminFeedbackDownload.hidden = true;
        adminFeedbackPreview.hidden = true;
        adminFeedbackPreview.removeAttribute("data");
        adminFeedbackMessage.hidden = true;

        if (data.admin_feedback_public_url) {
            adminFeedbackDownload.href = data.admin_feedback_public_url;
            adminFeedbackDownload.hidden = false;
            const adminFeedbackPreviewState = applyDocumentPreview(adminFeedbackPreview, data.admin_feedback_public_url);
            if (!adminFeedbackPreviewState.supported) {
                adminFeedbackMessage.textContent = "Preview is only available for PDF, Word, and Excel files. Use the download link above to view the admin feedback document.";
                adminFeedbackMessage.hidden = false;
            }
        } else {
            adminFeedbackMessage.textContent = "No admin feedback file has been uploaded for this module.";
            adminFeedbackMessage.hidden = false;
        }

        // Build table data from JSON and load into Handsontable
        console.log(data.rubric_json);
        const { headers: builtHeaders, rows } = buildRubricFromJSON(data.rubric_json);
        setRubricData(builtHeaders, rows);

        if (rows && rows.length && rows.some(r => r.some(cell => String(cell).trim() !== ""))) {
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