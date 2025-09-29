
/*
    Handles the rubric and performs unmarked state
 */


let rubricData;

/* Fetching and rendering the rubric */
document.addEventListener('DOMContentLoaded', () => {

    fetch("./data/rubric.json")
        .then(response => response.json())
        .then(data => {
            rubricData = data;

            document.getElementById("moderation-doc").src = rubricData.rubric.pdfFile;
            document.getElementById("moderation-title").textContent = rubricData.rubric.rubricTitle;

            renderRubric(rubricData);
            //scoreLimits();
            //calculateTotalScore(rubricData);
            alertSubmission()

        });

});

function renderRubric(data) {

    const criteria = document.getElementById("criteria");
    criteria.innerHTML = "";

    data.criteria.forEach((element, index) => {
        const criterion = document.createElement("div");
        criterion.classList.add("criterion");

        /* Criterion title */
        const criterionTitle = document.createElement("h4");
        criterionTitle.classList.add("criterion-title");
        criterionTitle.textContent = element.criterion;
        criterion.appendChild(criterionTitle);

        const scoreWrapper = document.createElement("div");
        scoreWrapper.classList.add("score-wrapper");

        /* Criterion Score Bar */
        const scoreBar = document.createElement("input");
        scoreBar.id = `score-${index}`;
        scoreBar.type = "range";
        scoreBar.min = 0;
        scoreBar.max = element.maxPoints;
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
        criterion.appendChild(scoreWrapper);

        /* Criterion Description */
        const gradeDescription = document.createElement("ul");
        gradeDescription.classList.add("grade-description");

        element.grades.forEach(grade => {
            const li = document.createElement("li");
            li.innerHTML = `<strong>${grade.pointsRange}:</strong> ${grade.description.join(", ")}`;
            gradeDescription.appendChild(li);
        });

        criterion.appendChild(gradeDescription);


        const commentSection = document.createElement("div");
        commentSection.classList.add("comment-section");
        commentSection.contentEditable = "true";
        commentSection.setAttribute("data-placeholder", "Enter comment...");
        criterion.appendChild(commentSection);


        criteria.appendChild(criterion);

    });

}


/* Alert the user when submission is made */
function alertSubmission() {
    const submitButton = document.getElementById("moderation-submit");

    submitButton.addEventListener("click", () => {
        const scoreInput = document.querySelectorAll(".score-input");

        const allScoresFilled = Array.from(scoreInput).every(inp => inp.value.trim() !== "");

        if (allScoresFilled) {
            alert("Moderation submitted successfully!");
        } else {
            alert("Please fill in all scores before submission!");
        }
    });

}


/* Calculate the total score in real time */
function calculateTotalScore(data) {
    const scoreInput = document.querySelectorAll(".score-input");
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
        totalScore.textContent = filled ? `${total} / ${maxScore}` : `_ / ${maxScore}`;
    }

    scoreInput.forEach((input) => {
        input.addEventListener("input", (updateTotalScore));
    });

    updateTotalScore()
}



function scoreLimits(data) {
    const scoreInput = document.querySelectorAll(".score-input");

    scoreInput.forEach(input => {
        input.addEventListener("input", (e) => {
            const inputValue = parseFloat(input.value);
            const min = parseFloat(input.min);
            const max = parseFloat(input.max);

            if (!isNaN(inputValue) && (inputValue < min || inputValue > max)) {
                input.classList.add("invalid-score");
            } else {
                input.classList.remove("invalid-score");
            }
        });
    });
}























