/*
    Handles the rubric and performs unmarked state
*/

/* ------------------------------ Global debug safety nets ------------------------------ */
window.addEventListener("error", (e) => {
    console.error("[GLOBAL ERROR]", e.message, e.error || e);
});
window.addEventListener("unhandledrejection", (e) => {
    console.error("[GLOBAL UNHANDLED REJECTION]", e.reason);
});

/* ------------------------------ Globals ------------------------------ */
let rubricData;
let currentUser = null;
let moderationId = null;
let overrideMarkerId = null;

/* -----------------------------------Fetch User Info--------------------------------------- */
async function getUserInfo() {
    console.debug("[getUserInfo] start");
    try {
        const user = await fetch(`/api/user_info`, {
            method: "POST",
            credentials: "include",
        });
        console.debug("[getUserInfo] response status", user.status);

        if (!user.ok) throw new Error("Failed to fetch user data");
        currentUser = await user.json();
        console.debug("[getUserInfo] currentUser", currentUser);
    } catch (error) {
        console.error("[getUserInfo] error fetching user info", error);
    }
}

/* ----------------------------------Get Moderation ID----------------------------------------*/
function getModerationID() {
    const urlParams = new URLSearchParams(window.location.search);
    moderationId = urlParams.get("id");
    overrideMarkerId = urlParams.get("marker");
    console.debug("[getModerationID] moderationId", moderationId, "overrideMarkerId", overrideMarkerId);
    return { moderationId, overrideMarkerId };
}

/* ------------------------------LOADING MAIN MODERATION PAGE---------------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
    console.debug("[DOMContentLoaded] init");
    try {
        await getUserInfo();
        getModerationID();

        console.debug("[DOMContentLoaded] role routing", {
            role: currentUser?.role,
            overrideMarkerId,
        });

        if (currentUser.role === "Admin" && overrideMarkerId) {
            await loadMarkerModeration();
        } else if (currentUser.role === "Admin") {
            await loadAdminModeration();
        } else {
            await loadMarkerModeration();
        }
    } catch (e) {
        console.error("[DOMContentLoaded] Error loading mod data", e);
    }
});

/* ---------------------------------Load Admin's Moderation-----------------------------------*/
async function loadAdminModeration() {
    console.debug("[loadAdminModeration] start", { moderationId });
    try {
        const moderationRes = await fetch(`/api/moderations/${moderationId}`, { credentials: "include" });
        console.debug("[loadAdminModeration] response", moderationRes.status);

        const moderationData = await moderationRes.json().catch((err) => {
            console.error("[loadAdminModeration] moderationRes.json() failed", err);
            return null;
        });
        console.debug("[loadAdminModeration] moderationData", moderationData);
        if (!moderationData) throw new Error("No moderation data received");

        rubricData = moderationData;

        document.getElementById("moderation-title").textContent = rubricData.name;
        document.getElementById("moderation-doc").src = rubricData.assignment_public_url;
        document.getElementById("moderation-subtitle").textContent = `${currentUser.first_name} ${currentUser.last_name}'s Moderation`;

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
            console.debug("[loadAdminModeration] admin_feedback present -> renderMarkedModeration");
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
        } else {
            console.debug("[loadAdminModeration] no admin_feedback -> renderUnmarkedModeration");
            renderUnmarkedModeration(rubricData.rubric_json);
            calculateTotalScore(rubricData.rubric_json);
        }

        document.getElementById("moderation-description").textContent = rubricData.description;
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
    } catch (e) {
        console.error("[loadAdminModeration] fatal", e);
    }
}

/* ---------------------------------Load Marker's Moderation-----------------------------------*/
async function loadMarkerModeration() {
    console.debug("[loadMarkerModeration] start");
    const { moderationId, overrideMarkerId } = getModerationID();

    let moderationURL = `/api/moderations/${moderationId}`;
    if (overrideMarkerId) {
        moderationURL += `?marker_id=${overrideMarkerId}`;
    }
    console.debug("[loadMarkerModeration] moderationURL", moderationURL);

    try {
        const moderationRes = await fetch(moderationURL, { credentials: "include" });
        console.debug("[loadMarkerModeration] moderationRes", moderationRes.status);

        const moderationData = await moderationRes.json().catch((err) => {
            console.error("[loadMarkerModeration] moderationRes.json() failed", err);
            return null;
        });
        console.debug("[loadMarkerModeration] moderationData", moderationData);

        rubricData = moderationData;
        if (!rubricData) throw new Error("No moderationData");

        let subtitle = `${currentUser.first_name} ${currentUser.last_name}`;

        const overrideString = String(overrideMarkerId ?? "");
        if (overrideString && overrideString !== String(currentUser.user_id)) {
            try {
                const markerRes = await fetch(`/api/admin/user/${encodeURIComponent(overrideString)}/profile`, {
                    credentials: "include",
                });
                console.debug("[loadMarkerModeration] markerRes", markerRes.status);
                if (markerRes.ok) {
                    const markerData = await markerRes.json();
                    console.debug("[loadMarkerModeration] markerData", markerData);
                    const user = markerData.user;
                    if (user && user.first_name && user.last_name) {
                        subtitle = `${user.first_name} ${user.last_name}`;
                    }
                }
            } catch (err) {
                console.error("[loadMarkerModeration] marker lookup failed", err);
            }
        }

        document.getElementById("moderation-title").textContent = rubricData.name;
        document.getElementById("moderation-doc").src = rubricData.assignment_public_url;
        document.getElementById("moderation-subtitle").textContent = `${subtitle}'s Moderation`;

        document.getElementById("moderation-description").textContent = rubricData.description || "No description";
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

        const markerId = /^\d+$/.test(String(overrideMarkerId ?? "")) ? String(overrideMarkerId) : String(currentUser.user_id);
        const marksURL = `/api/marks/${moderationId}/${markerId}`;
        console.debug("[loadMarkerModeration] marksURL", marksURL);

        const marksRes = await fetch(marksURL, { credentials: "include" });
        console.debug("[loadMarkerModeration] marksRes", marksRes.status);

        const statsTab = document.getElementById("tab-stats");
        const feedbackTab = document.getElementById("tab-feedback");
        const statsTabContent = document.getElementById("Statistics");
        const feedbackTabContent = document.getElementById("Feedback");

        if (marksRes.ok) {
            const marksData = await marksRes.json().catch((err) => {
                console.error("[loadMarkerModeration] marksRes.json() failed", err);
                return null;
            });
            console.debug("[loadMarkerModeration] marksData raw", marksData);

            // normalise scores/comments
            let scores = marksData?.scores;
            if (typeof scores === "string") {
                try {
                    scores = JSON.parse(scores);
                } catch (err) {
                    console.warn("[loadMarkerModeration] parse scores failed", err);
                    scores = null;
                }
            }

            let comments = marksData?.comments;
            if (typeof comments === "string") {
                try {
                    comments = JSON.parse(comments);
                } catch (err) {
                    console.warn("[loadMarkerModeration] parse comments failed", err);
                    comments = null;
                }
            }

            const hasScores = Array.isArray(scores) && scores.length > 0;
            const isSubmitted = !!marksData?.submitted_at;
            console.debug("[loadMarkerModeration] flags", { hasScores, isSubmitted, scoresLen: Array.isArray(scores) ? scores.length : null });

            if (hasScores && isSubmitted) {
                console.debug("[loadMarkerModeration] -> MARKED PATH");
                setTimeout(() => {
                    statsTab.classList.remove("hidden");
                    feedbackTab.classList.remove("hidden");
                    statsTabContent.classList.remove("hidden");
                    feedbackTabContent.classList.remove("hidden");
                }, 50);

                renderMarkedModeration({
                    scores,
                    comments,
                    total_score: marksData.total_score,
                    submitted_at: marksData.submitted_at,
                });

                await renderStatistics(moderationId, markerId);
                await renderAdminFeedback(moderationId);
            } else {
                console.debug("[loadMarkerModeration] -> UNMARKED PATH (no scores or not submitted)");
                statsTab.classList.add("hidden");
                feedbackTab.classList.add("hidden");
                statsTabContent.classList.add("hidden");
                feedbackTabContent.classList.add("hidden");

                console.debug("[loadMarkerModeration] rubricData.rubric_json shape", {
                    hasRubricJson: !!rubricData?.rubric_json,
                    keys: rubricData?.rubric_json && Object.keys(rubricData.rubric_json),
                    criteriaCount: rubricData?.rubric_json?.criteria?.length,
                });

                renderUnmarkedModeration(rubricData.rubric_json);
                calculateTotalScore(rubricData.rubric_json);
                await alertSubmission();
            }
        } else {
            console.debug("[loadMarkerModeration] -> UNMARKED PATH (marksRes not ok)");
            statsTab.classList.add("hidden");
            feedbackTab.classList.add("hidden");
            statsTabContent.classList.add("hidden");
            feedbackTabContent.classList.add("hidden");

            console.debug("[loadMarkerModeration] rubricData.rubric_json shape", {
                hasRubricJson: !!rubricData?.rubric_json,
                keys: rubricData?.rubric_json && Object.keys(rubricData.rubric_json),
                criteriaCount: rubricData?.rubric_json?.criteria?.length,
            });

            renderUnmarkedModeration(rubricData.rubric_json);
            calculateTotalScore(rubricData.rubric_json);
            await alertSubmission();
        }
    } catch (e) {
        console.error("[loadMarkerModeration] fatal error", e);
        // fall back to unmarked with as much context as possible
        try {
            console.debug("[loadMarkerModeration] fallback rubricData", rubricData);
            renderUnmarkedModeration(rubricData?.rubric_json || {});
            calculateTotalScore(rubricData?.rubric_json || { criteria: [] });
            await alertSubmission();
        } catch (inner) {
            console.error("[loadMarkerModeration] fallback also failed", inner);
        }
    }
}

/* ---------------------------Render the Unmarked Moderation--------------------------------- */
function renderUnmarkedModeration(data) {
    try {
        console.debug("[renderUnmarkedModeration] input", data);
        const criteriaEl = document.getElementById("criteria");
        if (!criteriaEl) {
            console.error("[renderUnmarkedModeration] #criteria not found");
            return;
        }

        criteriaEl.innerHTML = "";

        const list = Array.isArray(data?.criteria) ? data.criteria : [];
        console.debug("[renderUnmarkedModeration] criteria count", list.length);

        if (!Array.isArray(data?.criteria)) {
            console.warn("[renderUnmarkedModeration] data.criteria is not an array", data?.criteria);
        }

        list.forEach((element, index) => {
            try {
                if (element == null) throw new Error(`criteria[${index}] is null/undefined`);

                // Basic schema checks / coercions
                const title = String(element.criterion ?? "");
                const maxPointsNum = Number(element.maxPoints);
                const grades = Array.isArray(element.grades) ? element.grades : [];

                console.debug(`[renderUnmarkedModeration] c${index}`, {
                    title,
                    maxPointsRaw: element.maxPoints,
                    maxPointsNum,
                    gradesLen: grades.length,
                });

                if (!Number.isFinite(maxPointsNum)) {
                    console.warn(`criteria[${index}].maxPoints is not a number:`, element.maxPoints);
                }

                const criterion = document.createElement("div");
                criterion.classList.add("criterion");

                const criterionTitle = document.createElement("h4");
                criterionTitle.classList.add("criterion-title");
                criterionTitle.textContent = title;

                const scoreWrapper = document.createElement("div");
                scoreWrapper.classList.add("score-wrapper");

                const scoreBar = document.createElement("input");
                scoreBar.id = `score-${index}`;
                scoreBar.type = "range";
                scoreBar.min = 0;
                if (Number.isFinite(maxPointsNum)) scoreBar.max = String(maxPointsNum);
                scoreBar.step = 0.5;
                scoreBar.value = 0;
                scoreBar.classList.add("score-bar");

                const scoreView = document.createElement("span");
                scoreView.classList.add("score-view");
                scoreView.textContent = `_ / ${Number.isFinite(maxPointsNum) ? maxPointsNum : "—"}`;

                const inputWrapper = document.createElement("div");
                inputWrapper.classList.add("input-wrapper");
                inputWrapper.appendChild(criterionTitle);
                inputWrapper.appendChild(scoreWrapper);

                scoreWrapper.appendChild(scoreBar);
                scoreWrapper.appendChild(scoreView);
                criterion.appendChild(inputWrapper);

                // Table
                const gradeTable = document.createElement("table");
                gradeTable.classList.add("grade-table");

                const headRow = document.createElement("tr");
                const bodyRow = document.createElement("tr");

                grades.forEach((g) => {
                    const gradeLabel = g && "grade" in g ? String(g.grade ?? "") : "";
                    const descParts = Array.isArray(g?.description)
                        ? g.description
                        : g?.description != null
                            ? [g.description]
                            : [];
                    const safeParts = descParts.filter((s) => typeof s === "string" && s.trim() !== "");

                    const th = document.createElement("th");
                    th.textContent = gradeLabel;
                    headRow.appendChild(th);

                    const td = document.createElement("td");
                    const desc = document.createElement("div");
                    desc.textContent = safeParts.join("\n\n");
                    td.appendChild(desc);

                    const pts = document.createElement("div");
                    pts.textContent = g?.pointsRange ?? "";
                    td.appendChild(pts);

                    bodyRow.appendChild(td);
                });

                gradeTable.appendChild(headRow);
                gradeTable.appendChild(bodyRow);
                criterion.appendChild(gradeTable);

                // Comment
                const commentContainer = document.createElement("div");
                commentContainer.classList.add("comment-container");
                const commentPara = document.createElement("p");
                commentPara.textContent = "Criterion Feedback (Optional)";
                commentPara.style.margin = "35px 30px 20px 30px";
                commentPara.style.fontWeight = "bold";
                const commentSection = document.createElement("div");
                commentSection.classList.add("comment-section");
                commentSection.contentEditable = "true";
                commentSection.setAttribute("data-placeholder", "Enter comment...");
                commentContainer.appendChild(commentPara);
                commentContainer.appendChild(commentSection);
                criterion.appendChild(commentContainer);

                criteriaEl.appendChild(criterion);

                // *** NEW: keep the row label & highlight in sync with the slider ***
                scoreBar.addEventListener("input", () => {
                    const val = parseFloat(scoreBar.value) || 0;
                    scoreView.textContent = `${val} / ${Number.isFinite(maxPointsNum) ? maxPointsNum : "—"}`;
                    try {
                        highlightGrade(val, gradeTable, grades);
                    } catch (e) {
                        console.warn(`[renderUnmarkedModeration] highlightGrade on input failed c${index}`, e);
                    }
                    // recompute totals immediately
                    try {
                        window.__updateTotalScore?.();
                    } catch (e) {
                        console.warn("[renderUnmarkedModeration] total recompute failed", e);
                    }
                });

                // Initial highlight
                try {
                    //highlightGrade(0, gradeTable, grades);
                } catch (e) {
                    console.warn(`highlightGrade failed on criteria[${index}]`, e);
                }
            } catch (e) {
                console.error(`[renderUnmarkedModeration] Render failed on criteria[${index}]`, element, e);
            }
        });

        if (list.length === 0) {
            console.warn("[renderUnmarkedModeration] No criteria to render. Raw data:", data);
        }
    } catch (e) {
        console.error("[renderUnmarkedModeration] fatal", e, "raw data:", data);
    }
}

/* -----------------------------Render the Marked Moderation---------------------------------- */
function renderMarkedModeration(results) {
    try {
        console.debug("[renderMarkedModeration] input", results);

        const submitButton = document.getElementById("moderation-submit");
        if (submitButton) submitButton.remove();

        if (results.total_score) {
            const totalDisplay = document.getElementById("total-score");
            totalDisplay.textContent = `${results.total_score}`;
            totalDisplay.style.marginRight = "20px";
            console.debug("[renderMarkedModeration] total-score", totalDisplay.textContent);
        }

        const criteria = document.getElementById("criteria");
        criteria.innerHTML = "";

        const resultStorage =
            Array.isArray(results)
                ? results
                : results?.scores?.map((s, i) => ({
                criterionID: s?.criterionID ?? i,
                score: s?.score ?? "0 / 0",
                comment: s?.comment || s?.feedback || results.comments?.[i]?.comment || "",
            })) || [];

        if (!resultStorage.length) {
            console.warn("[renderMarkedModeration] No result data to render");
            return;
        }

        console.debug("[renderMarkedModeration] resultStorage", resultStorage);

        resultStorage.forEach((element, idx) => {
            try {
                console.debug("[renderMarkedModeration] item", idx, element);
                console.debug("[renderMarkedModeration] rubric criterion ref", rubricData?.rubric_json?.criteria?.[Number(element.criterionID)]);

                if (!element || !rubricData?.rubric_json?.criteria[Number(element.criterionID)]) {
                    console.warn("[renderMarkedModeration] Skipping invalid entry:", element);
                    return;
                }

                const criterionData = rubricData.rubric_json.criteria[Number(element.criterionID)];
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
                console.debug("[renderMarkedModeration] scoreValue", scoreValue);

                const gradeGroups = criterionData.grades;

                const activeGroup = gradeGroups.find((g) => {
                    const parsed = parsePointsRange(g.pointsRange);
                    if (!parsed) return false;
                    const { min, max } = parsed;
                    return scoreValue >= min && scoreValue <= max;
                });
                console.debug("[renderMarkedModeration] activeGroup", activeGroup);

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
                    const parts = Array.isArray(activeGroup.description) ? activeGroup.description : [activeGroup.description ?? ""];
                    const safe = parts.filter((s) => typeof s === "string" && s.trim() !== "");
                    des.textContent = safe.join("\n\n"); // plain text, no HTML injection
                    des.style.whiteSpace = "pre-wrap"; // show the newlines as line breaks
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
            } catch (e) {
                console.error("[renderMarkedModeration] item render failed", e, element);
            }
        });
    } catch (e) {
        console.error("[renderMarkedModeration] fatal", e);
    }
}

/* -----------------------------------Render Statistics--------------------------------------*/
async function renderStatistics(moderationId, markerId) {
    console.debug("[renderStatistics] start", { moderationId, markerId });
    try {
        const res = await fetch(`/api/stats/${moderationId}/${markerId}`);
        console.debug("[renderStatistics] res", res.status);
        if (!res.ok) throw new Error("Failed to load stats");
        const data = await res.json();
        console.debug("[renderStatistics] data", data);

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

        data.criteria.forEach((criterion, idx) => {
            const diff = parseFloat(criterion.diff_percent);
            const diffColor = Math.abs(diff) <= 5 ? "lightgreen" : "transparent";
            console.debug("[renderStatistics] row", idx, criterion);

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

        const maxTotal = data.criteria.reduce((sum, b) => sum + Number(b.max_points || 0), 0);
        const adminTotal = data.criteria.reduce((sum, b) => sum + Number(b.admin_score || 0), 0);
        const markerTotal = data.criteria.reduce((sum, b) => sum + Number(b.marker_score || 0), 0);
        const lowerTotal = data.criteria.reduce((sum, b) => sum + Number(b.lower || 0), 0);
        const upperTotal = data.criteria.reduce((sum, b) => sum + Number(b.upper || 0), 0);

        const adminPercent = ((adminTotal / maxTotal) * 100).toFixed(2);
        const markerPercent = ((markerTotal / maxTotal) * 100).toFixed(2);
        const diffPercent = (adminPercent - markerPercent).toFixed(2);

        const cellColor = Math.abs(diffPercent) <= 5 ? "lightgreen" : "transparent";

        console.debug("[renderStatistics] totals", {
            maxTotal,
            adminTotal,
            markerTotal,
            lowerTotal,
            upperTotal,
            adminPercent,
            markerPercent,
            diffPercent,
        });

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
        console.error("[renderStatistics] error rendering stats", e);
    }
}

/* ---------------------------------Render Admin Feedback------------------------------------*/
async function renderAdminFeedback(moderationId) {
    console.debug("[renderAdminFeedback] start", { moderationId });
    try {
        const res = await fetch(`/api/feedback/${moderationId}`);
        console.debug("[renderAdminFeedback] res", res.status);
        if (!res.ok) throw new Error("Failed to fetch feedback");

        const data = await res.json();
        console.debug("[renderAdminFeedback] data", data);

        const feedbackContainer = document.getElementById("feedbacks");
        feedbackContainer.innerHTML = "";

        data.criteria.forEach((element, idx) => {
            console.debug("[renderAdminFeedback] row", idx, element);
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
        console.error("[renderAdminFeedback] Error fetching feedback", error);
    }
}

/* -----------Highlight the grade group of each criterion based on user input--------------- */
function highlightGrade(score, gradeDes, grades) {
    try {
        console.debug("[highlightGrade] score", score, "gradesLen", grades?.length);
        const groupDes = gradeDes.querySelectorAll("tr:nth-child(2) td");
        const gradeHead = gradeDes.querySelectorAll("tr:first-child th");

        grades.forEach((g, i) => {
            const parsed = parsePointsRange(g?.pointsRange);
            if (!parsed) {
                console.warn("[highlightGrade] could not parse pointsRange", g?.pointsRange, "for index", i);
                gradeHead[i]?.classList.remove("highlighted");
                groupDes[i]?.classList.remove("highlighted");
                return;
            }
            const { min, max } = parsed;
            const hit = score >= min && score <= max;
            if (hit) {
                gradeHead[i]?.classList.add("highlighted");
                groupDes[i]?.classList.add("highlighted");
            } else {
                gradeHead[i]?.classList.remove("highlighted");
                groupDes[i]?.classList.remove("highlighted");
            }
        });
    } catch (e) {
        console.error("[highlightGrade] fatal", e);
    }
}

/* ------------------------------------Parse points range---------------------------------------*/
function parsePointsRange(range) {
    if (!range || typeof range !== "string") {
        console.warn("[parsePointsRange] bad input", range);
        return null;
    }

    const clean = range.replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-").trim();
    const match = clean.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);

    if (!match) {
        console.warn("[parsePointsRange] could not parse", { range, clean });
        return null;
    }

    const min = parseFloat(match[1]);
    const max = parseFloat(match[2]);
    console.debug("[parsePointsRange] parsed", { range, clean, min, max });
    return { min, max };
}

/* -----------------------Alert the user when submission is made----------------------------- */
async function alertSubmission() {
    console.debug("[alertSubmission] attach listener");
    const submitButton = document.getElementById("moderation-submit");

    if (!submitButton) {
        console.warn("[alertSubmission] submit button not found");
        return;
    }

    submitButton.addEventListener("click", async () => {
        console.debug("[alertSubmission] click");
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

        console.debug("[alertSubmission] collected", { allScoresFilled, scores, comments });

        if (!allScoresFilled) {
            alert("Please fill in all scores before submission!");
            return;
        }

        try {
            const totalScore = document.getElementById("total-score").textContent.trim();
            console.debug("[alertSubmission] totalScore", totalScore);

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

            console.debug("[alertSubmission] POST /api/marks status", res.status);
            const result = await res.json().catch((e) => {
                console.error("[alertSubmission] res.json failed", e);
                return null;
            });
            console.debug("[alertSubmission] result", result);

            if (!res.ok || !result?.data) throw new Error("Could not find moderation results.");
            alert("Moderation submitted successfully!");

            const safeScores = Array.isArray(result.data.scores) ? result.data.scores : [];
            const safeComments = Array.isArray(result.data.comments) ? result.data.comments : [];

            const merged = safeScores.map((s, i) => ({
                criterionID: s?.criterionID ?? i,
                score: s?.score ?? "0 / 0",
                comment: safeComments[i]?.comment ?? "",
            }));

            const resultData = {
                scores: merged,
                total_score: result.data?.total_score ?? "0 / 0",
            };
            console.debug("[alertSubmission] resultData (normalized)", resultData);

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
            console.error("[alertSubmission] Error saving marks.", err);
            alert("Error saving marks.");
        }
    });
}

/* -------------------------Calculate moderation total score------------------------------ */
function calculateTotalScore(data) {
    try {
        console.debug("[calculateTotalScore] input", data);
        const scoreInputs = document.querySelectorAll(".score-bar");
        const totalScore = document.getElementById("total-score");

        const maxScore = Array.isArray(data?.criteria)
            ? data.criteria.reduce((a, b) => a + Number(b.maxPoints || 0), 0)
            : 0;

        console.debug("[calculateTotalScore] maxScore", maxScore);
        totalScore.textContent = `_ / ${maxScore}`;

        function updateTotalScore() {
            let total = 0;
            let anyFilled = false;

            scoreInputs.forEach((input) => {
                const val = parseFloat(input.value);
                console.debug("[calculateTotalScore] input change", { id: input.id, val });
                if (!isNaN(val)) {
                    total += val;
                    anyFilled = true;
                }
            });

            if (anyFilled) {
                totalScore.textContent = `${total} / ${maxScore}`;
            } else {
                totalScore.textContent = `_ / ${maxScore}`;
            }
            console.debug("[calculateTotalScore] totalScore text", totalScore.textContent);
        }

        // Expose so row handlers can force recompute immediately
        window.__updateTotalScore = updateTotalScore;

        // Attach input listeners once
        scoreInputs.forEach((input) => {
            input.addEventListener("input", updateTotalScore);
        });

        // Initial compute
        updateTotalScore();
    } catch (e) {
        console.error("[calculateTotalScore] fatal", e, "raw data:", data);
    }
}
