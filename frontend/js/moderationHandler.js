let rubricData;
let submissionHandlerInitialised = false;

const formatDate = (isoString) => {
    if (!isoString) return "";
    try {
        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) return "";
        return date.toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    } catch (err) {
        console.error("Failed to format date", err);
        return "";
    }
};

const showStatus = (message, isError = false) => {
    const statusEl = document.getElementById("moderation-status");
    if (!statusEl) return;

    statusEl.textContent = message;
    statusEl.hidden = false;
    statusEl.dataset.state = isError ? "error" : "info";
};

const hideStatusIfNotError = () => {
    const statusEl = document.getElementById("moderation-status");
    if (!statusEl) return;
    if (statusEl.dataset.state !== "error") {
        statusEl.hidden = true;
    }
};

const normalizeGrades = (grades) => {
    if (!Array.isArray(grades)) return [];
    return grades
        .map((grade) => ({
            grade: typeof grade?.grade === "string" ? grade.grade : "",
            description: Array.isArray(grade?.description)
                ? grade.description
                : typeof grade?.description === "string"
                    ? [grade.description]
                    : [],
            pointsRange: typeof grade?.pointsRange === "string" ? grade.pointsRange : ""
        }))
        .filter((grade) => grade.grade || grade.description.length || grade.pointsRange);
};

const normalizeCriteria = (rubric) => {
    if (!Array.isArray(rubric)) return [];
    return rubric.map((item, index) => ({
        ...item,
        criterion: typeof item?.criterion === "string" ? item.criterion : `Criterion ${index + 1}`,
        maxPoints: typeof item?.maxPoints === "number" ? item.maxPoints : null,
        grades: normalizeGrades(item?.grades)
    }));
};

const updateAssignment = (module) => {
    const docFrame = document.getElementById("moderation-doc");
    const placeholder = document.getElementById("assignment-placeholder");

    if (!docFrame || !placeholder) return;

    if (module.assignment_public_url) {
        docFrame.src = module.assignment_public_url;
        placeholder.hidden = true;
    } else {
        docFrame.removeAttribute("src");
        placeholder.hidden = false;
    }
};

const updateMetadata = (module) => {
    const title = document.getElementById("moderation-title");
    const subtitle = document.getElementById("moderation-subtitle");
    const description = document.getElementById("module-description");

    if (title) {
        title.textContent = module.name || "Moderation";
    }

    if (subtitle) {
        const segments = [];
        if (module.year) segments.push(`Year ${module.year}`);
        if (module.semester) segments.push(`Semester ${module.semester}`);
        if (module.moderation_number) segments.push(`Moderation ${module.moderation_number}`);
        const deadline = formatDate(module.deadline_date);
        if (deadline) segments.push(`Deadline: ${deadline}`);
        subtitle.textContent = segments.join(" • ") || "";
    }

    if (description) {
        description.textContent = module.description || "No description provided.";
    }
};

const createNoRubricMessage = () => {
    const message = document.createElement("p");
    message.className = "rubric-empty-message";
    message.textContent = "No rubric criteria have been provided for this module.";
    return message;
};

const renderUnmarkedModeration = (data) => {
    const criteria = document.getElementById("criteria");
    if (!criteria) return;
    criteria.innerHTML = "";

    const criteriaList = Array.isArray(data.criteria) ? data.criteria : [];
    if (criteriaList.length === 0) {
        criteria.appendChild(createNoRubricMessage());
        const submitButton = document.getElementById("moderation-submit");
        if (submitButton) submitButton.disabled = true;
        const totalScore = document.getElementById("total-score");
        if (totalScore) totalScore.textContent = "Scoring unavailable";
        return;
    }

    let hasScoreInputs = false;

    criteriaList.forEach((element, index) => {
        const criterion = document.createElement("div");
        criterion.classList.add("criterion");

        const inputWrapper = document.createElement("div");
        inputWrapper.classList.add("input-wrapper");

        const criterionTitle = document.createElement("h4");
        criterionTitle.classList.add("criterion-title");
        criterionTitle.textContent = element.criterion;
        inputWrapper.appendChild(criterionTitle);

        const maxPoints = typeof element.maxPoints === "number" && element.maxPoints > 0
            ? element.maxPoints
            : null;

        if (maxPoints) {
            const scoreWrapper = document.createElement("div");
            scoreWrapper.classList.add("score-wrapper");

            const scoreBar = document.createElement("input");
            scoreBar.id = `score-${index}`;
            scoreBar.type = "range";
            scoreBar.min = 0;
            scoreBar.max = maxPoints;
            scoreBar.step = 0.5;
            scoreBar.value = 0;
            scoreBar.classList.add("score-bar");

            const scoreView = document.createElement("span");
            scoreView.classList.add("score-view");
            scoreView.textContent = `_ / ${maxPoints}`;

            scoreBar.addEventListener("input", () => {
                scoreView.textContent = `${scoreBar.value} / ${maxPoints}`;
                if (Array.isArray(element.grades) && element.grades.length > 0) {
                    highlightGrade(parseFloat(scoreBar.value), gradeTable, element.grades);
                }
            });

            scoreWrapper.appendChild(scoreBar);
            scoreWrapper.appendChild(scoreView);
            inputWrapper.appendChild(scoreWrapper);
            hasScoreInputs = true;
        } else {
            const scoreUnavailable = document.createElement("p");
            scoreUnavailable.className = "score-unavailable";
            scoreUnavailable.textContent = "No score range is available for this criterion.";
            inputWrapper.appendChild(scoreUnavailable);
        }

        criterion.appendChild(inputWrapper);

        const gradeTable = document.createElement("table");
        gradeTable.classList.add("grade-table");

        if (Array.isArray(element.grades) && element.grades.length > 0) {
            const gradeGroup = document.createElement("tr");
            const gradeRow = document.createElement("tr");

            element.grades.forEach((g) => {
                const header = document.createElement("th");
                header.textContent = g.grade || "";
                gradeGroup.appendChild(header);

                const desCell = document.createElement("td");
                const desc = document.createElement("div");
                desc.innerHTML = Array.isArray(g.description) ? g.description.join("<br><br>") : "";
                desCell.appendChild(desc);

                if (g.pointsRange) {
                    const gradePoints = document.createElement("div");
                    gradePoints.textContent = g.pointsRange;
                    desCell.appendChild(gradePoints);
                }

                gradeRow.appendChild(desCell);
            });

            gradeTable.appendChild(gradeGroup);
            gradeTable.appendChild(gradeRow);
            criterion.appendChild(gradeTable);
        }

        const commentContainer = document.createElement("div");
        const commentPara = document.createElement("p");
        const commentSection = document.createElement("div");

        commentContainer.classList.add("comment-container");
        commentSection.classList.add("comment-section");

        commentPara.textContent = "Criterion Feedback (Optional)";
        commentPara.style.margin = "35px 30px 20px 30px";
        commentPara.style.fontWeight = "bold";

        commentSection.contentEditable = "true";
        commentSection.setAttribute("data-placeholder", "Enter comment...");

        commentContainer.appendChild(commentPara);
        commentContainer.appendChild(commentSection);
        criterion.appendChild(commentContainer);

        criteria.appendChild(criterion);
    });

    if (!hasScoreInputs) {
        const totalScore = document.getElementById("total-score");
        if (totalScore) totalScore.textContent = "Scoring unavailable";
    }
};

const renderMarkedModeration = (results) => {
    if (!rubricData) return;

    const submitButton = document.getElementById("moderation-submit");
    if (submitButton) submitButton.remove();

    const totalScore = document.getElementById("total-score");
    if (totalScore) {
        totalScore.style.marginRight = "20px";
    }

    const criteria = document.getElementById("criteria");
    if (!criteria) return;
    criteria.innerHTML = "";

    const resultStorage = results || JSON.parse(localStorage.getItem("moderationResults"));
    if (!resultStorage) return;

    resultStorage.forEach((element) => {
        const criterionData = rubricData.criteria[element.criterionID];
        if (!criterionData) return;

        const criterion = document.createElement("div");
        criterion.classList.add("marked-criterion");

        const criterionTitle = document.createElement("h4");
        criterionTitle.classList.add("criterion-title");
        criterionTitle.textContent = criterionData.criterion;
        criterion.appendChild(criterionTitle);

        const scoreWrapper = document.createElement("div");
        scoreWrapper.classList.add("marked-score-wrapper");

        const scoreValue = parseFloat(element.score?.split(" / ")[0]);
        const gradeGroups = Array.isArray(criterionData.grades) ? criterionData.grades : [];

        const scoreBarContainer = document.createElement("div");
        scoreBarContainer.classList.add("score-bar-container");

        let activeGroup = null;

        gradeGroups.forEach((g) => {
            const block = document.createElement("div");
            block.classList.add("score-block");
            const range = typeof g.pointsRange === "string"
                ? g.pointsRange.match(/\(([\d.]+)\s*-\s*([\d.]+)/)
                : null;
            if (range) {
                const min = parseFloat(range[1]);
                const max = parseFloat(range[2]);
                if (!Number.isNaN(scoreValue) && scoreValue >= min && scoreValue <= max) {
                    activeGroup = g;
                    block.classList.add("active-block");
                }
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
        scoreView.textContent = element.score || "";
        scoreInfo.appendChild(scoreView);

        scoreWrapper.appendChild(scoreInfo);
        criterion.appendChild(scoreWrapper);

        if (activeGroup) {
            const gradeDes = document.createElement("div");
            gradeDes.classList.add("marked-grade-description");

            const des = document.createElement("div");
            des.innerHTML = Array.isArray(activeGroup.description)
                ? activeGroup.description.join("<br><br>")
                : "";
            gradeDes.appendChild(des);

            if (activeGroup.pointsRange) {
                const gradePoints = document.createElement("div");
                gradePoints.classList.add("marked-grade-points");
                gradePoints.textContent = activeGroup.pointsRange;
                gradeDes.appendChild(gradePoints);
            }

            criterion.appendChild(gradeDes);
        }

        const commentContainer = document.createElement("div");
        const commentPara = document.createElement("p");
        const commentSection = document.createElement("div");

        commentContainer.classList.add("comment-container");
        commentSection.classList.add("comment-section");

        commentPara.textContent = "Criterion Feedback";
        commentPara.style.margin = "25px 20px 20px 25px";
        commentPara.style.fontWeight = "bold";

        commentSection.contentEditable = "false";
        commentSection.textContent = element.comment || "";

        commentContainer.appendChild(commentPara);
        commentContainer.appendChild(commentSection);
        criterion.appendChild(commentContainer);

        criteria.appendChild(criterion);
    });
};

const highlightGrade = (score, gradeDes, grades) => {
    if (!Array.isArray(grades) || !gradeDes) return;

    const groupDes = gradeDes.querySelectorAll("tr:nth-child(2) td");
    const gradeHead = gradeDes.querySelectorAll("tr:first-child th");

    grades.forEach((g, i) => {
        const range = typeof g.pointsRange === "string"
            ? g.pointsRange.match(/\(([\d.]+)\s*-\s*([\d.]+)/)
            : null;
        if (!range) return;
        const min = parseFloat(range[1]);
        const max = parseFloat(range[2]);
        if (!Number.isNaN(score) && score >= min && score <= max) {
            gradeHead[i]?.classList.add("highlighted");
            groupDes[i]?.classList.add("highlighted");
        } else {
            gradeHead[i]?.classList.remove("highlighted");
            groupDes[i]?.classList.remove("highlighted");
        }
    });
};

const alertSubmission = () => {
    if (submissionHandlerInitialised) return;
    const submitButton = document.getElementById("moderation-submit");
    if (!submitButton) return;

    const scoreInputs = document.querySelectorAll(".score-bar");
    if (scoreInputs.length === 0) {
        submitButton.disabled = true;
        submitButton.title = "Scoring is unavailable for this module.";
        return;
    }

    submissionHandlerInitialised = true;

    submitButton.addEventListener("click", () => {
        const criteria = document.querySelectorAll(".criterion");
        let allScoresFilled = true;
        const results = [];

        criteria.forEach((criterion, index) => {
            const scoreInput = criterion.querySelector(".score-view");
            const commentInput = criterion.querySelector(".comment-section");

            const score = scoreInput ? scoreInput.textContent.trim() : "";
            const comment = commentInput ? commentInput.textContent.trim() : "";

            if (score.startsWith("_")) {
                allScoresFilled = false;
            }

            results.push({
                criterionID: index,
                score,
                comment
            });
        });

        if (allScoresFilled) {
            alert("Moderation submitted successfully!");
            localStorage.setItem("moderationResults", JSON.stringify(results));
            renderMarkedModeration(results);
        } else {
            alert("Please fill in all scores before submission!");
        }
    });
};

const calculateTotalScore = (data) => {
    const totalScore = document.getElementById("total-score");
    if (!totalScore) return;

    const scoreInputs = document.querySelectorAll(".score-bar");
    if (scoreInputs.length === 0) {
        totalScore.textContent = "Scoring unavailable";
        return;
    }

    const maxScore = (data.criteria || []).reduce((sum, criterion) => {
        const value = typeof criterion.maxPoints === "number" ? criterion.maxPoints : 0;
        return sum + value;
    }, 0);

    if (!maxScore) {
        totalScore.textContent = "Scoring unavailable";
        return;
    }

    totalScore.textContent = `_ / ${maxScore}`;

    const updateTotalScore = () => {
        let total = 0;
        let filled = false;

        scoreInputs.forEach((input) => {
            const val = parseFloat(input.value);
            if (!Number.isNaN(val)) {
                total += val;
                filled = true;
            }
        });

        if (filled) {
            totalScore.textContent = `${total} / ${maxScore}`;
        } else {
            totalScore.textContent = `_ / ${maxScore}`;
        }
    };

    scoreInputs.forEach((input) => {
        input.addEventListener("input", updateTotalScore);
    });
};

window.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const moduleId = params.get('id');

    if (!moduleId) {
        showStatus('Module ID missing from the URL.', true);
        return;
    }

    showStatus('Loading module…');

    const headers = {};
    if (typeof token !== 'undefined' && token) {
        headers['Authorization'] = 'Bearer ' + token;
    }

    try {
        const res = await fetch(`/api/moderations/${encodeURIComponent(moduleId)}`, { headers });
        if (res.status === 404) {
            showStatus("We couldn't find that module.", true);
            return;
        }
        if (!res.ok) {
            throw new Error(`Failed to fetch module: ${res.status}`);
        }

        const module = await res.json();
        rubricData = {
            rubric: {
                rubricTitle: module.name || 'Moderation',
                pdfFile: module.assignment_public_url || ''
            },
            criteria: normalizeCriteria(module.rubric)
        };

        updateAssignment(module);
        updateMetadata(module);

        renderUnmarkedModeration(rubricData);
        calculateTotalScore(rubricData);
        alertSubmission();

        showStatus('Module ready.');
        setTimeout(() => hideStatusIfNotError(), 2500);
    } catch (err) {
        console.error('Failed to load moderation', err);
        showStatus('Failed to load module. Please try again later.', true);
    }
});
