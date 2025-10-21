
/*
    Handles the rubric and performs unmarked state
 */


let rubricData;

/* Fetching and rendering the rubric */
document.addEventListener('DOMContentLoaded', () => {

    fetch("http://localhost:3000/api/moderations/1")
        .then(response => response.json())
        .then(data => {
            rubricData = data;

            document.getElementById("moderation-doc").src = rubricData.pdf_url;
            document.getElementById("moderation-title").textContent = rubricData.moderation_title;

            renderUnmarkedModeration(rubricData.rubric_json);

            calculateTotalScore(rubricData.rubric_json);

            alertSubmission();

        })
        .catch(error => console.error("Error fetching moderation data.", err));

});

/* Render the Unmarked Moderation */
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


/* Render the Marked Moderation */
function renderMarkedModeration(results) {

    const submitButton = document.getElementById("moderation-submit");
    if (submitButton) submitButton.remove();

    const totalScore = document.getElementById("total-score");
    if (totalScore) {
        totalScore.style.marginRight = "20px";
    }

    const criteria = document.getElementById("criteria");
    criteria.innerHTML = "";

    const resultStorage = results || JSON.parse(localStorage.getItem("moderationResults"));
    if (!resultStorage) return;

    resultStorage.forEach((element, index) => {
        const criterionData = rubricData.criteria[element.criterionID]
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
        const scoreValue = parseFloat(element.score.split(" / ")[0]);
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

/* Highlight the grade group of each criterion based on user input */
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

/* Alert the user when submission is made */
function alertSubmission() {
    const submitButton = document.getElementById("moderation-submit");

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
                score: score,
                comment: comment
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

}



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






















