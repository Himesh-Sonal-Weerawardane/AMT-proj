

document.addEventListener("DOMContentLoaded", async() => {

    console.time("FrontPage Load");
    await loadFrontPage();
    console.timeEnd("FrontPage Load");


});


async function loadFrontPage() {

    try {

        const [progressRes, statsRes] = await Promise.allSettled([
            fetch("/api/moderations/progress/recent-assignment"),
            fetch("/api/moderations/stats/assignment")
        ]);

        async function safeJSON(res) {
            if (!res || !res.ok) return null;
            const text = await res.text();
            if (!text) return null;
            try {
                return JSON.parse(text);
            } catch (err) {
                console.warn("json parse failed:", err);
                return null;
            }
        }


        let progressData = null;
        if (progressRes.status === "fulfilled" && progressRes.value.ok) {
            progressData = await safeJSON(progressRes.value);
        } else {
            console.warn("Failed to fetch moderations from progress");
        }


        let statsData = null;
        if (statsRes.status === "fulfilled" && statsRes.value.ok) {
            statsData = await safeJSON(statsRes.value);
        } else {
            console.warn("Failed to fetch stats");
        }

        console.log("Progress data:", progressData);
        console.log("Results length:", progressData?.results?.length);



        if (!progressData || !Array.isArray(progressData.results) || progressData.results.length === 0) {
            const messageHTML = '<p class="no-moderation-msg">No moderations at the moment.</p>';
            document.getElementById("current-assignment-markings").innerHTML = messageHTML;
            document.getElementById('current-marking-progress').innerHTML = messageHTML;
            document.getElementById("moderation-statistics").innerHTML = messageHTML;
            return;
        }

        console.log("stats data:", statsData);

        requestAnimationFrame(() => {
            renderMarkerProgress(progressData);
            renderCurrentMarking(progressData);
            renderStatistics(statsData);
        });

    } catch (err) {
        console.error(err);
    }
}



function renderMarkerProgress(data) {

    const container = document.getElementById("current-marking-progress");

    const { assignment_name, semester, year, results } = data;

    container.innerHTML = `
        <div class="assignment-header">
            <div class="assignment-main">
                <div class="assignment-semester">${year} Semester ${semester}</div>
            </div>
        </div>

        <div class="assignment-wrapper">
            <div class="assignment-title">Assignment ${assignment_name}</div>
            <div class="divider"></div>
            <div class="moderation-cards" id="moderation-cards"></div>
        </div>
        `;

    const moderationWrapper = document.getElementById("moderation-cards");

    results.sort((a, b) => a.name.localeCompare(b.name));

    results.forEach((mod, index) => {
        const submitted = mod.submitted ?? 0;
        const activeTotal = mod.activeTotal ?? 0;
        const unmarked = activeTotal - submitted;

        const chartId = `mod-chart-${index}`;

        console.log("mod:", mod);

        const moderationHTML = `
            <div class="moderation">
                <div class="moderation-head">
                    <a class="moderation-title" href="./moderation.html?id=${mod.id}">${mod.name}</a>
                </div>
                
                <div class="mini-divider"></div>
                
                <div class="moderation-body">
                    <div class="moderation-chart-wrapper">
                        <canvas id="${chartId}"></canvas>
                    </div>
               
                
                    <div class="moderation-stats">
                        <div class="moderation-stats-wrapper">
                            <span class="submitted">Marked: ${submitted}</span>
                            <span class="unmarked">Unmarked: ${unmarked}</span>
                        </div>
                    </div>
                </div>
            </div>
            `;

        moderationWrapper.insertAdjacentHTML("beforeend", moderationHTML);

        createDonutChart(chartId, submitted, unmarked, activeTotal);

    })

}


function renderCurrentMarking(data) {

    const container = document.getElementById("current-assignment-markings");

    const { assignment_name, semester, year, results } = data;

    container.innerHTML = `
        <div class="assignment-header">
            <div class="assignment-main">
                <div class="assignment-semester">${year} Semester ${semester}</div>
            </div>
        </div>

        <div class="assignment-wrapper">
            <div class="assignment-title">Assignment ${assignment_name}</div>
            <div class="divider"></div>
            <div class="moderation-markings" id="moderation-markings"></div>
        </div>
        `;

    const moderationWrapper = document.getElementById("moderation-markings");

    results.forEach(mod => {


        const moderationHTML = `
            <div class="moderation">
                <div class="moderation-head">
                    <a class="moderation-title" href="./moderation.html?id=${mod.id}">${mod.name}</a>
                </div>
                
                <div class="mini-divider"></div>
                
                <div class="moderation-body-2">
                    <div class="moderation-info">
                        <div class="moderation-due-date">
                            <p>Due Date:</p>
                            <span class="marking-due-date">${formatDate(mod.due_date)}</span>
                        </div>
                
                        <div class="moderation-total-score">
                            <p>Your Score:</p>
                            <span class="marking-total-score">${mod.totalScore ?? 0} / ${mod.maxScore ?? 0}</span>
                        </div>
                        
                    </div>
                </div>
            </div>
        `;

        moderationWrapper.insertAdjacentHTML("beforeend", moderationHTML);
    })

}


function renderStatistics(statsData) {
    console.time("renderStatistics");

    const container = document.getElementById("moderation-statistics");

    const { assignment_name, semester, year, moderations } = statsData;

    container.innerHTML = `
        <div class="assignment-header">
            <div class="assignment-main">
                <div class="assignment-semester">${year} Semester ${semester}</div>
            </div>
        </div>
        
        <div class="assignment-wrapper">
            <div class="assignment-title">Assignment ${assignment_name}</div>
            <div class="divider"></div>
            <div class="moderation-stats-cards" id="moderation-stats-cards"></div>
        </div>
    `;

    const statsWrapper = document.getElementById("moderation-stats-cards");
    let allStatsHTML = "";

    moderations.forEach((moderation) => {
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

        allStatsHTML += statsHTML;

    });

    statsWrapper.innerHTML = allStatsHTML;

    console.timeEnd("renderStatistics");
}


function formatDate(date) {
    const due_date = new Date(date);
    const formattedDate = due_date.toLocaleDateString("en-AU", {
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });
    return `${formattedDate}`;
}


function createDonutChart(chartId, submitted, unmarked, activeTotal) {

    const canvas = document.getElementById(chartId);

    new Chart(canvas, {
       type: 'doughnut',
       data: {
           labels: ["Marked", "Unmarked"],
           datasets: [
               {
                   data: [submitted, unmarked],
                   backgroundColor: ['#1B998B', '#E94F37'],
                   borderWidth: 0,
                   hoverOffset: 6
               }
           ]
       },
        options: {
           maintainAspectRatio: false,
           cutoutPercentage: 80,
            plugins: {
               legend: {
                   display: false
               },
                tooltip: {
                   display: false
               }
            }
        }
    });
}











