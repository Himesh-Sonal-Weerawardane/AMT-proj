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

const parseNumber = (value) => {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed === "") return null;
        const normalised = Number(trimmed.replace(/[^0-9+\-.]/g, ""));
        return Number.isFinite(normalised) ? normalised : null;
    }
    return null;
};

const formatNumber = (value) => {
    const num = parseNumber(value);
    if (num === null) {
        if (typeof value === "string" && value.trim() !== "") return value;
        return "—";
    }

    const isInteger = Number.isInteger(num);
    return num.toLocaleString(undefined, {
        minimumFractionDigits: isInteger ? 0 : 1,
        maximumFractionDigits: isInteger ? 0 : 1
    });
};

const formatDifference = (value) => {
    const num = parseNumber(value);
    if (num === null) {
        if (typeof value === "string" && value.trim() !== "") return value;
        return "—";
    }

    const formatted = formatNumber(num);
    if (num > 0) return `+${formatted}`;
    if (num === 0) return "0";
    return formatted;
};

const formatDateTime = (isoString) => {
    if (!isoString) return "";
    try {
        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) return "";
        return new Intl.DateTimeFormat(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
        }).format(date);
    } catch (err) {
        console.error("Failed to format date/time", err);
        return "";
    }
};

const createEmptyMessage = (message, className = "statistics-empty") => {
    const paragraph = document.createElement("p");
    paragraph.className = className;
    paragraph.textContent = message;
    return paragraph;
};

const guessAlignment = (key) => {
    if (!key) return "left";
    return /(grade|score|mark|average|difference)/i.test(key) ? "right" : "left";
};

const normaliseColumns = (columns) => {
    if (!Array.isArray(columns) || columns.length === 0) {
        return [
            { key: "student", label: "Student", align: "left" },
            { key: "student_grade", label: "Student Grade", align: "right" },
            { key: "marker_average", label: "Marker Average", align: "right" },
            { key: "difference", label: "Difference", align: "right" }
        ];
    }

    const normalised = columns.map((column) => {
        if (!column) return null;
        if (typeof column === "string") {
            return { key: column, label: column, align: guessAlignment(column) };
        }
        if (typeof column === "object") {
            const key = typeof column.key === "string"
                ? column.key
                : typeof column.id === "string"
                    ? column.id
                    : null;
            if (!key) return null;
            const label = typeof column.label === "string"
                ? column.label
                : key.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
            const align = typeof column.align === "string" ? column.align : guessAlignment(key);
            return { key, label, align };
        }
        return null;
    }).filter(Boolean);

    return normalised.length > 0 ? normalised : normaliseColumns();
};

const extractStudentInfo = (row) => {
    if (!row || typeof row !== "object") return {};
    const student = row.student || row.learner;
    const studentName = typeof student === "object"
        ? student.name || student.full_name || student.display_name
        : student;
    const fallbackName = row.student_name || row.studentName || row.name || "Unknown student";

    const studentId = typeof student === "object"
        ? student.id || student.student_id || student.number
        : row.student_id || row.studentId || row.student_number || null;

    const rubric = row.rubric || row.assignment || row.component || null;

    return {
        primary: studentName || fallbackName,
        secondary: studentId ? `ID: ${studentId}` : undefined,
        tertiary: typeof rubric === "string" && rubric.trim() !== "" ? rubric : undefined
    };
};

const normaliseOverall = (overallInput = {}, moduleData = {}) => {
    const overall = typeof overallInput === "object" && overallInput !== null ? overallInput : {};
    const columns = normaliseColumns(overall.columns);

    const rowsSource = Array.isArray(overall.rows)
        ? overall.rows
        : Array.isArray(overall.data)
            ? overall.data
            : [];

    const rows = rowsSource.map((row) => {
        if (!row || typeof row !== "object") return null;

        const studentGrade = row.student_grade
            ?? row.student_mark
            ?? row.studentScore
            ?? row.grade
            ?? (row.student && row.student.grade);

        const markerAverage = row.marker_average
            ?? row.marker_mark
            ?? row.markerScore
            ?? row.average
            ?? (row.marker && row.marker.average);

        const differenceRaw = row.difference
            ?? row.delta
            ?? row.variance
            ?? (parseNumber(studentGrade) !== null && parseNumber(markerAverage) !== null
                ? parseNumber(studentGrade) - parseNumber(markerAverage)
                : null);

        return {
            student: extractStudentInfo(row),
            student_grade: formatNumber(studentGrade),
            marker_average: formatNumber(markerAverage),
            difference: formatDifference(differenceRaw)
        };
    }).filter(Boolean);

    const defaultTitle = moduleData?.name
        ? `${moduleData.name} overall statistics`
        : "Overall statistics";

    return {
        title: typeof overall.title === "string" && overall.title.trim() ? overall.title : defaultTitle,
        subtitle: typeof overall.subtitle === "string" && overall.subtitle.trim()
            ? overall.subtitle
            : typeof overall.description === "string" && overall.description.trim()
                ? overall.description
                : "",
        updatedAt: overall.updated_at || overall.updatedAt || null,
        columns,
        rows,
        emptyMessage: overall.empty_message || overall.emptyMessage || "No statistics are available yet."
    };
};

const describeStatus = (status, label) => {
    if (typeof label === "string" && label.trim() !== "") {
        return { label, variant: "pending" };
    }

    const normalised = typeof status === "string" ? status.trim().toLowerCase() : "";

    if (normalised === "completed" || normalised === "complete" || normalised === "done" || normalised === "submitted") {
        return { label: "Completed", variant: "complete" };
    }
    if (normalised === "in_progress" || normalised === "in-progress" || normalised === "progress" || normalised === "marking" || normalised === "started") {
        return { label: "In progress", variant: "progress" };
    }
    if (normalised === "missing" || normalised === "overdue" || normalised === "late") {
        return { label: "Missing", variant: "alert" };
    }
    if (normalised === "pending" || normalised === "not_started" || normalised === "not-started" || normalised === "queued") {
        return { label: "Pending", variant: "pending" };
    }
    if (normalised === "idle") {
        return { label: "Idle", variant: "idle" };
    }

    if (typeof status === "string" && status.trim() !== "") {
        return { label: status, variant: "pending" };
    }

    return { label: "Pending", variant: "pending" };
};

const normaliseProgress = (progressInput = {}) => {
    const progress = typeof progressInput === "object" && progressInput !== null ? progressInput : {};
    const entriesSource = Array.isArray(progress.entries)
        ? progress.entries
        : Array.isArray(progress.markers)
            ? progress.markers
            : Array.isArray(progress.rows)
                ? progress.rows
                : [];

    const entries = entriesSource.map((entry) => {
        if (!entry || typeof entry !== "object") return null;

        const name = entry.name
            ?? entry.student_name
            ?? entry.studentName
            ?? entry.student
            ?? entry.marker_name
            ?? entry.marker
            ?? "Unnamed";

        const roleValue = entry.role
            ?? entry.student_id
            ?? entry.studentNumber
            ?? entry.marker_role
            ?? entry.markerId
            ?? "";

        const statusDetails = describeStatus(
            entry.status ?? entry.state ?? (entry.completed ? "completed" : ""),
            entry.status_label ?? entry.statusLabel
        );

        const updatedAt = entry.updated_at
            ?? entry.updatedAt
            ?? entry.last_updated
            ?? entry.lastUpdated
            ?? entry.last_activity
            ?? null;

        const updatedAtFormatted = formatDateTime(updatedAt);

        const identifier = entry.identifier
            ?? entry.student_id
            ?? entry.studentNumber
            ?? entry.marker_id
            ?? entry.id
            ?? null;

        const notes = entry.notes
            ?? entry.comment
            ?? entry.submission
            ?? entry.summary
            ?? entry.message
            ?? entry.reason
            ?? "";

        const roleText = typeof roleValue === "string" ? roleValue : roleValue ? String(roleValue) : "";

        let metaText = "";
        if (identifier) {
            metaText = `ID: ${identifier}`;
        } else if (roleText) {
            metaText = roleText;
        }

        return {
            name,
            statusLabel: statusDetails.label,
            statusVariant: statusDetails.variant,
            updatedAt,
            updatedAtFormatted,
            meta: metaText,
            notes: typeof notes === "string" && notes.trim() !== "" ? notes : ""
        };
    }).filter(Boolean);

    const totals = progress.totals || {};
    let marked = parseNumber(progress.marked ?? totals.marked ?? totals.completed);
    let unmarked = parseNumber(progress.unmarked ?? totals.unmarked ?? totals.remaining ?? totals.pending);
    let total = parseNumber(progress.total ?? totals.total ?? totals.count);

    if (total === null && entries.length > 0) {
        total = entries.length;
    }
    if (marked === null && entries.length > 0) {
        marked = entries.filter((entry) => entry.statusVariant === "complete").length;
    }
    if (unmarked === null && total !== null && marked !== null) {
        unmarked = Math.max(total - marked, 0);
    }
    if (total === null && marked !== null && unmarked !== null) {
        total = Math.max(marked + unmarked, 0);
    }

    const defaultTitle = typeof progress.title === "string" && progress.title.trim() !== ""
        ? progress.title
        : "Progress";

    return {
        title: defaultTitle,
        subtitle: typeof progress.subtitle === "string" && progress.subtitle.trim() !== ""
            ? progress.subtitle
            : typeof progress.description === "string" && progress.description.trim() !== ""
                ? progress.description
                : "",
        updatedAt: progress.updated_at || progress.updatedAt || null,
        totals: {
            marked: Number.isFinite(marked) ? Math.max(marked, 0) : 0,
            unmarked: Number.isFinite(unmarked) ? Math.max(unmarked, 0) : Math.max((total ?? 0) - (marked ?? 0), 0),
            total: Number.isFinite(total) ? Math.max(total, 0) : Math.max((marked ?? 0) + (unmarked ?? 0), 0)
        },
        entries,
        emptyMessage: progress.empty_message || progress.emptyMessage || "No progress has been recorded yet."
    };
};

const updateProgressRing = (marked, total) => {
    const ring = document.getElementById("progress-ring");
    const valueEl = document.getElementById("progress-ring-value");
    if (!ring || !valueEl) return;

    const safeMarked = Number.isFinite(marked) ? Math.max(marked, 0) : 0;
    const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
    const ratio = safeTotal > 0 ? Math.min(Math.max(safeMarked / safeTotal, 0), 1) : 0;
    const angle = ratio * 360;

    ring.style.setProperty("--progress-angle", `${angle}deg`);
    valueEl.textContent = safeMarked.toString();
};

const renderOverallStatistics = (overall) => {
    const titleEl = document.getElementById("overall-title");
    if (titleEl) {
        titleEl.textContent = overall.title;
    }

    const subtitleEl = document.getElementById("overall-subtitle");
    if (subtitleEl) {
        if (overall.subtitle) {
            subtitleEl.textContent = overall.subtitle;
            subtitleEl.hidden = false;
        } else {
            subtitleEl.hidden = true;
        }
    }

    const updatedEl = document.getElementById("overall-updated");
    if (updatedEl) {
        const formatted = formatDateTime(overall.updatedAt);
        if (formatted) {
            updatedEl.textContent = `Updated ${formatted}`;
            updatedEl.hidden = false;
        } else {
            updatedEl.hidden = true;
        }
    }

    const tableWrapper = document.getElementById("overall-table-wrapper");
    if (!tableWrapper) return;

    tableWrapper.textContent = "";

    if (overall.rows.length === 0) {
        tableWrapper.appendChild(createEmptyMessage(overall.emptyMessage));
        return;
    }

    const table = document.createElement("table");
    table.className = "statistics-table";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    overall.columns.forEach((column) => {
        const th = document.createElement("th");
        th.textContent = column.label;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    overall.rows.forEach((row) => {
        const tr = document.createElement("tr");
        overall.columns.forEach((column) => {
            const td = document.createElement("td");
            if (column.align === "right") {
                td.classList.add("statistics-table__cell--number");
            }

            const value = row[column.key];
            if (value && typeof value === "object" && (value.primary || value.secondary || value.tertiary)) {
                const wrapper = document.createElement("div");
                wrapper.className = "statistics-student";

                const primary = document.createElement("span");
                primary.className = "statistics-student__name";
                primary.textContent = value.primary || "Unknown";
                wrapper.appendChild(primary);

                if (value.secondary) {
                    const secondary = document.createElement("span");
                    secondary.className = "statistics-student__meta";
                    secondary.textContent = value.secondary;
                    wrapper.appendChild(secondary);
                }

                if (value.tertiary) {
                    const tertiary = document.createElement("span");
                    tertiary.className = "statistics-student__meta";
                    tertiary.textContent = value.tertiary;
                    wrapper.appendChild(tertiary);
                }

                td.appendChild(wrapper);
            } else {
                td.textContent = value ?? "—";
            }

            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    tableWrapper.appendChild(table);
};

const renderProgressStatistics = (progress) => {
    const titleEl = document.getElementById("progress-title");
    if (titleEl) {
        titleEl.textContent = progress.title;
    }

    const subtitleEl = document.getElementById("progress-subtitle");
    if (subtitleEl) {
        if (progress.subtitle) {
            subtitleEl.textContent = progress.subtitle;
            subtitleEl.hidden = false;
        } else {
            subtitleEl.hidden = true;
        }
    }

    const updatedEl = document.getElementById("progress-updated");
    if (updatedEl) {
        const formatted = formatDateTime(progress.updatedAt);
        if (formatted) {
            updatedEl.textContent = `Updated ${formatted}`;
            updatedEl.hidden = false;
        } else {
            updatedEl.hidden = true;
        }
    }

    const { marked, unmarked, total } = progress.totals;
    updateProgressRing(marked, total);

    const markedEl = document.getElementById("progress-marked");
    if (markedEl) {
        markedEl.textContent = marked.toString();
    }

    const unmarkedEl = document.getElementById("progress-unmarked");
    if (unmarkedEl) {
        unmarkedEl.textContent = unmarked.toString();
    }

    const totalEl = document.getElementById("progress-total");
    if (totalEl) {
        totalEl.textContent = total.toString();
    }

    const list = document.getElementById("progress-list");
    if (!list) return;

    list.textContent = "";

    if (progress.entries.length === 0) {
        list.appendChild(createEmptyMessage(progress.emptyMessage, "progress-empty"));
        return;
    }

    progress.entries.forEach((entry) => {
        const item = document.createElement("li");
        item.className = "progress-list__item";

        const content = document.createElement("div");
        content.className = "progress-list__content";

        const nameEl = document.createElement("span");
        nameEl.className = "progress-list__name";
        nameEl.textContent = entry.name || "Unassigned";
        content.appendChild(nameEl);

        if (entry.meta) {
            const metaEl = document.createElement("span");
            metaEl.className = "progress-list__meta";
            metaEl.textContent = entry.meta;
            content.appendChild(metaEl);
        }

        if (entry.notes) {
            const notesEl = document.createElement("span");
            notesEl.className = "progress-list__notes";
            notesEl.textContent = entry.notes;
            content.appendChild(notesEl);
        }

        item.appendChild(content);

        const aside = document.createElement("div");
        aside.className = "progress-list__aside";

        if (entry.statusLabel) {
            const badge = document.createElement("span");
            badge.className = `progress-badge progress-badge--${entry.statusVariant || "pending"}`;
            badge.textContent = entry.statusLabel;
            aside.appendChild(badge);
        }

        if (entry.updatedAtFormatted) {
            const updatedElItem = document.createElement("span");
            updatedElItem.className = "progress-list__meta";
            updatedElItem.textContent = entry.updatedAtFormatted;
            aside.appendChild(updatedElItem);
        }

        item.appendChild(aside);
        list.appendChild(item);
    });
};

const renderStatistics = (payload, moduleData) => {
    const statsHeading = document.getElementById("statistics-heading");
    if (statsHeading) {
        const moduleName = moduleData?.name || "Moderation";
        statsHeading.textContent = `${moduleName} statistics`;
    }

    const descriptionEl = document.getElementById("statistics-description");
    if (descriptionEl) {
        if (payload?.meta?.description) {
            descriptionEl.textContent = payload.meta.description;
        } else if (payload?.meta?.is_fallback) {
            descriptionEl.textContent = "Statistics will appear once marking begins.";
        }
    }

    const statsMetaEl = document.getElementById("statistics-updated");
    if (statsMetaEl) {
        const metaDate = payload?.meta?.updated_at
            || payload?.overall?.updated_at
            || payload?.overall?.updatedAt
            || payload?.progress?.updated_at
            || payload?.progress?.updatedAt
            || null;
        const formatted = formatDateTime(metaDate);
        if (formatted) {
            statsMetaEl.textContent = `Last updated ${formatted}`;
            statsMetaEl.hidden = false;
        } else {
            statsMetaEl.hidden = true;
        }
    }

    const overall = normaliseOverall(payload?.overall, moduleData);
    renderOverallStatistics(overall);

    const progress = normaliseProgress(payload?.progress);
    renderProgressStatistics(progress);
};

const loadStatistics = async (moduleId, moduleData, headers) => {
    const statsSection = document.getElementById("module-statistics");
    const statusEl = document.getElementById("statistics-status");
    if (!statsSection) return;

    statsSection.hidden = false;

    if (statusEl) {
        statusEl.textContent = "Loading statistics…";
        statusEl.hidden = false;
        statusEl.dataset.state = "info";
    }

    try {
        const res = await fetch(`/api/moderations/${encodeURIComponent(moduleId)}/statistics`, { headers });
        if (!res.ok) {
            throw new Error(`Failed to fetch statistics: ${res.status}`);
        }

        const payload = await res.json();
        renderStatistics(payload, moduleData);

        if (statusEl) {
            statusEl.hidden = true;
        }
    } catch (err) {
        console.error("Failed to load moderation statistics", err);
        if (statusEl) {
            statusEl.textContent = "We couldn't load the statistics right now. Please try again later.";
            statusEl.hidden = false;
            statusEl.dataset.state = "error";
        }
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

        rubricList.textContent = "";
        if (Array.isArray(data.rubric) && data.rubric.length > 0) {
            data.rubric.forEach((criterion) => {
                const item = document.createElement("li");
                item.textContent = criterion.criterion || "(Untitled criterion)";
                rubricList.appendChild(item);
            });
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

        void loadStatistics(moduleId, data, headers);

        contentEl.hidden = false;
    } catch (err) {
        console.error("Failed to load module details", err);
        showStatus("An unexpected error occurred while loading the module.", true);
    }
});
