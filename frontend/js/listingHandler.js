

let staffNames = [];

async function listingHandler() {
    const response = await fetch("/api/get_user");
    const data = await response.json();

    const staffList = document.getElementById('staff-list');
    staffList.innerHTML = '';


    data.forEach((staff) => {
        staffNames.push(staff.name);
        const staffCard = document.createElement('div');
        staffCard.classList.add('staff-card');
        staffCard.innerHTML = `
            <div class="staff-row">
                <img src="../images/front-page/minus-button.png" class="remove-user" alt="Remove">
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

window.addEventListener('DOMContentLoaded', async() => {
    await listingHandler()

    const editButton = document.getElementById('edit-button')
    let editFunction = false

    editButton.addEventListener('click', () => {
        editFunction = !editFunction
        const deleteImage = document.querySelectorAll('.remove-user')
        deleteImage.forEach(image => {
            if(editFunction){
                image.style.display = 'inline'
            } else {
                image.style.display = 'none'
            }
        })
        if(editFunction) {
            editButton.textContent = 'Done'
        } else {
            editButton.textContent = 'Edit'
        }
    })

    const listOfStaff = document.getElementById("staff-list")
    listOfStaff.addEventListener("click", async (e) => {
        const button = e.target.closest(".remove-user")
        if(!button){
            return
        }
        const staffCard = button.closest(".staff-card")
        if(!staffCard){
            return
        }
        try{
            const res = await fetch("/api/delete_user/${id}", { method: "POST" });
            const data = await res.json()

            if(res.ok){
                staffCard.remove()
                console.log("user removed ")
            } else {
                console.error("failed to remove user", data.error)
            }
        } catch(err){
            console.error(err)
        }
    })

})


