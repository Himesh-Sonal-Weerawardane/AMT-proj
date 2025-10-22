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

        const deadline = formatDate(data.deadline_date);
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

        contentEl.hidden = false;
    } catch (err) {
        console.error("Failed to load module details", err);
        showStatus("An unexpected error occurred while loading the module.", true);
    }
});
