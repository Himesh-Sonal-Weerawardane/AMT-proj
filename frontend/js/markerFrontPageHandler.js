

document.addEventListener('DOMContentLoaded', loadMarkerFrontPage);

async function loadMarkerFrontPage() {

    try {

        const [userRes, recentRes, statsRes] = await Promise.all([
            fetch("/api/user_info", { method: "POST", credentials: "include" }),
            fetch("/api/marker/recent", { credentials: "include" }),
            fetch("/api/marker/stats/assignment", { credentials: "include" })
        ]);

        const [userInfo, recentData, statsData] = await Promise.all([
            safeJSON(userRes),
            safeJSON(recentRes),
            safeJSON(statsRes),
        ]);

        const markerId = userInfo?.user_id;
        if (!markerId) {
            console.error("Unable to fetch the marker");
            return;
        }

        if (!recentData?.result?.length) {
            noModerationsMessage();
            return;
        }

        renderCurrentMarking(recentData);
        renderMarkerStatistics(statsData, markerId);

    } catch (err) {
        console.error(err);
    }

}

function noModerationsMessage() {
    const messageHTML = '<p class="no-moderation-msg">No moderations at the moment.</p>';
    document.getElementById("marker-current-markings").innerHTML = messageHTML;
    document.getElementById("marker-moderation-statistics").innerHTML = messageHTML;
}

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



function renderCurrentMarking(data) {
    const container = document.getElementById('marker-current-markings');
    const { assignment_name, semester, year, result } = data;

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

    const moderationWrapper = document.getElementById('moderation-markings');

    result.forEach(m => {
        const submitted = m.submitted_at !== "-" ? formatDate(m.submitted_at) : "-";

        const moderationHTML = `
            <div class="moderation">
                <div class="moderation-head">
                    <a class="moderation-title" href="./moderation-page.html?id=${m.id}" class="moderation-link">${m.name}</a>
                </div>
                
                <div class="mini-divider"></div>
                
                <div class="moderation-body-2">
                    <div class="moderation-info">
                        <div class="moderation-due-date">
                            <p>Due Date:</p>
                            <span class="marking-due-date">${formatDate(m.due_date)}</span>
                        </div>
                        
                        <div class="moderation-submitted">
                            <p>Submitted at:</p>
                            <span class="marking-submitted">${submitted}</span>
                        </div>
                        
                        <div class="moderation-total-score">
                            <p>Your Score:</p>
                            <span class="marking-total-score">${m.score_progress}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        moderationWrapper.insertAdjacentHTML("beforeend", moderationHTML);
    })

}


function renderMarkerStatistics(statsData, markerId) {


    const container = document.getElementById('marker-moderation-statistics');
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

    const statsWrapper = document.getElementById('moderation-stats-cards');

    moderations.forEach((moderation) => {

        const { id, moderationName, criteria, rows, hasMarked } = moderation;
        console.log(rows)


        let statsHTML = `
            <div class="stats-wrapper">
                <div class="moderation-stats-title">
                    <a href="./moderation-page.html?id=${id}" class="moderation-link">${moderationName}</a>
                </div>
        `;

        if (!hasMarked) {
            statsHTML += `
                <p class="no-marks-msg">You haven't marked this moderation yet.</p>
            `;
            statsWrapper.insertAdjacentHTML("beforeend", statsHTML);
            return;
        }

        statsHTML += `
                <div class="stats-container">
                    <table class="stats-table">
                        <thead>
                            <tr>
                                <th>Criterion</th>
                                ${rows.map((row) => `<th>${row.label}</th>`).join("")}
                            </tr>
                        </thead>
                        <tbody>
            `;

        criteria.forEach((criterion, index) => {
            statsHTML += `
                    <tr>
                        <td class="row-label">${criterion}</td>
                        ${rows.map((row) => {
                            const score = row.scores[index];

                            if (
                                score === "-" ||
                                row.label.includes("Range") ||
                                row.label.includes("Unit Chair")
                            ) {
                                return `<td>${score}</td>`;
                            }
                            const rowLower = rows.find((row) => row.label === "5% Lower Range");
                            const rowUpper = rows.find((row) => row.label === "5% Upper Range");
                            
                            const inRange =
                                typeof score === "number" &&
                                score >= rowLower.scores[index] &&
                                score <= rowUpper.scores[index];
                            return `<td class="${inRange ? "in-range" : "out-of-range"}">${score}</td>`;
                            
                        }).join("")}
                    </tr>
                `;
        });

        statsHTML += `
                <tr class="total-row">
                    <td class="row-label">Total</td>
                    ${rows.map((row) => {
                        if (row.label === "Your Marks") {
                            const lower = parseFloat(rows.find(r => r.label === "5% Lower Range")?.total || 0);
                            const upper = parseFloat(rows.find(r => r.label === "5% Upper Range")?.total || 0);
                            const totalVal = parseFloat(row.total);
                     
                            const inRange = totalVal >= lower && totalVal <= upper;
                            return `<td class="total-cell ${inRange ? "in-range" : "out-of-range"}">${row.total}</td>`;
                        }
                        return `<td class="total-cell">${row.total}</td>`;
                    }).join("")}
                </tr>
            `;

        statsHTML += `
                        </tbody>
                    </table>
                </div>
            `;

        statsWrapper.insertAdjacentHTML("beforeend", statsHTML);


    });


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
