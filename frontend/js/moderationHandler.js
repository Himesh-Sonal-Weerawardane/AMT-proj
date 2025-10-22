
/*
    Handles the rubric and performs unmarked state
 */


let rubricData;
let currentUser = null;
let moderationId = null;

/* ------------------------------LOADING MAIN MODERATION PAGE---------------------------------- */

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await getUserInfo();
        getModerationID();

        const moderationRes = await fetch(`http://localhost:3000/api/moderations/${moderationId}`)
        const moderationData = await moderationRes.json();

        console.log("Moderation Data:", moderationData);
        rubricData = moderationData;

        document.getElementById("moderation-title").textContent = rubricData.moderation_title;
        document.getElementById("moderation-doc").src = rubricData.pdf_url;

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
                    hour12: true
                });
                dueDate.textContent = `Due: ${formattedDate}`;
            } else {
                dueDate.textContent = "No due date";
            }
        }


        const marksRes = await fetch(`http://localhost:3000/api/marks/${moderationId}/${currentUser.user_id}`)
        if (marksRes.ok) {
            const marksData = await marksRes.json();


            if (marksData && marksData.scores) {
                renderMarkedModeration({
                    scores: marksData.scores,
                    comments: marksData.comments,
                    total_score: marksData.total_score,
                    submitted_at: marksData.submitted_at
                });
            } else {
                renderUnmarkedModeration(rubricData.rubric_json);
                calculateTotalScore(rubricData.rubric_json);
                alertSubmission();
            }
        } else {
            renderUnmarkedModeration(rubricData.rubric_json);
            calculateTotalScore(rubricData.rubric_json);
            alertSubmission();
        }
    } catch (error) {
        console.log("Error loading moderation data.", error);
    }
})

/* -----------------------------------Fetch User Info--------------------------------------- */
async function getUserInfo() {

    const user = await fetch(`http://localhost:3000/api/user_info`, {
        method: 'POST',
        credentials: 'include',
    });

    if (!user.ok) throw new Error("Failed to fetch user data");
    currentUser = await user.json();

}

/* ----------------------------------Get Moderation ID----------------------------------------*/

function getModerationID() {
    const urlParams = new URLSearchParams(window.location.search);
    moderationId = urlParams.get("id") || 1;
}

/* ---------------------------Render the Unmarked Moderation--------------------------------- */

function renderUnmarkedModeration(data) {

    const criteria = document.getElementById("criteria");
    criteria.innerHTML = "";

    data.criteria.forEach((element, index) => {
        const criterion = document.createElement("div");
        criterion.classList.add("criterion");

        /* Criterion title */
        const criterionTitle = document.createElement("h4");
        criterionTitle.classList.add("criterion-title");
        criterionTitle.textContent = element.criterion;

        const scoreWrapper = document.createElement("div");
        scoreWrapper.classList.add("score-wrapper");

        /* Criterion Score Bar */
        const scoreBar = document.createElement("input");
        scoreBar.id = `score-${index}`;
        scoreBar.type = "range";
        scoreBar.min = 0;
        scoreBar.max = element.maxPoints;
        scoreBar.step = 0.5;
        scoreBar.value = 0;
        scoreBar.classList.add("score-bar");

        const scoreView = document.createElement("span");
        scoreView.classList.add("score-view");
        scoreView.textContent = `_ / ${element.maxPoints}`;

        scoreBar.addEventListener("input", () => {
            scoreView.textContent = `${scoreBar.value} / ${element.maxPoints}`;
        });

        scoreWrapper.appendChild(scoreBar);
        scoreWrapper.appendChild(scoreView);


        /* Wrapper for Criterion Title and Score Bar */
        const inputWrapper = document.createElement("div");
        inputWrapper.classList.add("input-wrapper");
        inputWrapper.appendChild(criterionTitle);
        inputWrapper.appendChild(scoreWrapper);
        criterion.appendChild(inputWrapper);


        /* Criterion Description */
        const gradeTable = document.createElement("table");
        gradeTable.classList.add("grade-table");

        const gradeGroup = document.createElement("tr");
        const gradeRow = document.createElement("tr");

        element.grades.forEach((g) => {
            const header = document.createElement("th");
            header.textContent = g.grade;
            gradeGroup.appendChild(header);

            const desCell = document.createElement("td");

            const desc = document.createElement("div");
            desc.innerHTML = g.description.join("<br><br>");
            desCell.appendChild(desc);

            const gradePoints = document.createElement("div");
            gradePoints.textContent = g.pointsRange;
            desCell.appendChild(gradePoints);

            gradeRow.appendChild(desCell);
        });

        gradeTable.appendChild(gradeGroup);
        gradeTable.appendChild(gradeRow);
        criterion.appendChild(gradeTable);


        /* Comment Section */
        const commentContainer = document.createElement("div");
        const commentPara = document.createElement("p");
        const commentSection = document.createElement("div");

        commentContainer.classList.add("comment-container");
        commentSection.classList.add("comment-section");

        commentPara.textContent = 'Criterion Feedback (Optional)';
        commentPara.style.margin = "35px 30px 20px 30px";
        commentPara.style.fontWeight = "bold";

        commentSection.contentEditable = "true";
        commentSection.setAttribute("data-placeholder", "Enter comment...");

        commentContainer.appendChild(commentPara);
        commentContainer.appendChild(commentSection);
        criterion.appendChild(commentContainer);


        criteria.appendChild(criterion);

        scoreBar.addEventListener("input", () => {
            scoreView.textContent = `${scoreBar.value} / ${element.maxPoints}`;
            highlightGrade(parseFloat(scoreBar.value), gradeTable, element.grades);
        });

    });

}


/* -----------------------------Render the Marked Moderation---------------------------------- */

function renderMarkedModeration(results) {

    const submitButton = document.getElementById("moderation-submit");
    if (submitButton) submitButton.remove();

    /*
    const totalScore = document.getElementById("total-score");
    if (totalScore) {
        totalScore.style.marginRight = "20px";

    }

     */

    if (results.total_score) {
        const totalDisplay = document.getElementById("total-score");
        totalDisplay.textContent = `${results.total_score}`;
        totalDisplay.style.marginRight = "20px";
    }

    const criteria = document.getElementById("criteria");
    criteria.innerHTML = "";


    const resultStorage = Array.isArray(results)
        ? results
        : results?.scores?.map((s, i) => ({
        criterionID: s?.criterionID ?? i,
        score: s?.score ?? "0 / 0",
        comment: results.comments?.[i]?.comment ?? "",
    })) || [];

    if (!resultStorage.length) {
        console.warn("No result data to render");
        return;
    }

    resultStorage.forEach((element) => {
        if (!element || !rubricData?.rubric_json?.criteria[element.criterionID]) {
            console.warn("Skipping invalid entry:", element);
            return;
        }

        const criterionData = rubricData.rubric_json.criteria[element.criterionID]
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


        const gradeGroups = criterionData.grades;

        const activeGroup = gradeGroups.find((g) => {
            const range = g.pointsRange.match(/\(([\d.]+)\s*-\s*([\d.]+)/);
            const min = parseFloat(range[1]);
            const max = parseFloat(range[2]);
            return scoreValue >= min && scoreValue <= max;
        })

        const scoreBarContainer = document.createElement("div");
        scoreBarContainer.classList.add("score-bar-container");

        const gradeColors = {
            "High Distinction": "#6ee277",
            "Distinction": "#d5ed59",
            "Credit": "#fee12d",
            "Pass": "#f49b25",
            "Fail": "#ee4c37"
        }

        gradeGroups.forEach((g) => {
            //const range = g.pointsRange.match(/\(([\d.]+)\s*-\s*([\d.]+)/);
            const block = document.createElement("div");
            block.classList.add("score-block");

            if (activeGroup && g.grade === activeGroup.grade) {
                block.classList.add("active-block");
                block.style.backgroundColor = gradeColors[g.grade];
                block.title = `${g.grade}: ${g.pointsRange}`;
            } else {
                block.title = `${g.grade}: ${g.pointsRange}`
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
            des.innerHTML = activeGroup.description.join("<br><br>");
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

        commentPara.textContent = 'Criterion Feedback';
        commentPara.style.margin = "25px 20px 20px 25px";
        commentPara.style.fontWeight = "bold";

        commentSection.contentEditable = "false";
        commentSection.textContent = element.comment;

        commentContainer.appendChild(commentPara);
        commentContainer.appendChild(commentSection);
        criterion.appendChild(commentContainer);

        criteria.appendChild(criterion);


    });

}

/* -----------Highlight the grade group of each criterion based on user input--------------- */

function highlightGrade(score, gradeDes, grades) {
    const groupDes = gradeDes.querySelectorAll("tr:nth-child(2) td");
    const gradeHead = gradeDes.querySelectorAll("tr:first-child th");

    grades.forEach((g, i) => {
        const range = g.pointsRange.match(/\(([\d.]+)\s*-\s*([\d.]+)/);
        const min = parseFloat(range[1]);
        const max = parseFloat(range[2]);
        if (score>=min && score<=max) {
            gradeHead[i].classList.add("highlighted");
            groupDes[i].classList.add("highlighted");
        } else {
            gradeHead[i].classList.remove("highlighted");
            groupDes[i].classList.remove("highlighted");
        }
    });

}

/* -----------------------Alert the user when submission is made----------------------------- */

async function alertSubmission() {
    const submitButton = document.getElementById("moderation-submit");

    submitButton.addEventListener("click", async () => {
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

        if (!allScoresFilled) {
            alert("Please fill in all scores before submission!");
            return;
        }

        try {
            const totalScore = document.getElementById("total-score").textContent.trim();

            const res = await fetch(`http://localhost:3000/api/marks`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    moderation_id: moderationId,
                    marker_id: currentUser.user_id,
                    scores,
                    comments,
                    total_score: totalScore,
                    submitted_at: new Date().toISOString(),
                }),
            });

            const result = await res.json();

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
                total_score: result.data?.total_score ?? "0 / 0"
            };

            renderMarkedModeration(resultData);
        } catch (err) {
            console.error("Error saving marks.", err);
            alert("Error saving marks.");
        }
    });

}


/* -------------------------Calculate moderation total score------------------------------ */

function calculateTotalScore(data) {
    const scoreInput = document.querySelectorAll(".score-bar");
    const totalScore = document.getElementById("total-score");

    const maxScore = data.criteria.reduce((a, b) => a + b.maxPoints, 0);

    totalScore.textContent = `_ / ${maxScore}`;

    function updateTotalScore() {
        let total = 0;
        let filled = false;

        scoreInput.forEach(input => {
            const val = parseFloat(input.value);
            if (!isNaN(val)) {
                total += val;
                filled = true;
            }
        });

        if (filled) {
            totalScore.textContent = `${total} / ${maxScore}`;
        } else {
            totalScore.textContent = `_ / ${maxScore}`;
        }

    }

    scoreInput.forEach((input) => {
        input.addEventListener("input", (updateTotalScore));
    });

    totalScore.textContent = `_ / ${maxScore}`;
}






















