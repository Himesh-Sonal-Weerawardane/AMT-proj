

let staffNames = [];

async function listingHandler() {
    const response = await fetch("../data/staff.json");
    const data = await response.json();

    const staffList = document.getElementById('staff-list');
    staffList.innerHTML = '';


    data.forEach((staff) => {
        staffNames.push(staff.name);
        const staffCard = document.createElement('div');
        staffCard.classList.add('staff-card');
        staffCard.innerHTML = `
            <div class="staff-row">
                <img src="image/minus-button.png" class="remove-user" alt="Remove">
                <div class="staff-profile"></div>
                <a href="user-profile.html?id=${staff.id}" class="staff-name">${staff.name}</a>
                <div class="staff-email">${staff.email}</div>
                <div class="staff-role">${staff.role}</div>
            </div>
            <div class="row-divider"></div>
        `;

        staffList.appendChild(staffCard);

    });


}

window.addEventListener('DOMContentLoaded', listingHandler);


