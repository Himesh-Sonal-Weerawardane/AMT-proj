

let staffNames = [];

async function listingHandler() {
    const response = await fetch("/api/get_user");
    const data = await response.json();

    console.log("userdata:", data);

    const staffList = document.getElementById('staff-list');
    staffList.innerHTML = '';


    data.forEach((staff) => {
        const fullName = `${staff.first_name} ${staff.last_name}`
        let role
        if(staff.is_admin){
            role = "Admin"
        } else {
            role = "Marker"
        }

        staffNames.push(fullName);
        const staffCard = document.createElement('div');
        staffCard.classList.add('staff-card','user-profile');
        staffCard.innerHTML = `
            <div class="staff-row">
                <img src="../images/front-page/minus-button.png" class="remove-user" alt="Remove">
                <div class="staff-profile"></div>
                <a href="./user-profile.html?id=${staff.auth_id}" class="staff-name">${fullName}</a>
                <div class="staff-email">${staff.email}</div>
                <div class="staff-role">${role}</div>
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
        const deleteImage = document.querySelectorAll('.user-profile .remove-user')
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

        const userHTML = staffCard.querySelector(".staff-name").getAttribute("href")
        const id = userHTML.split("id=")[1].trim()

        const user = staffCard.querySelector(".staff-name").textContent.trim()
        const confirmationStep = confirm(`Are you sure you want to continue with deleting user ${user}?
                                          Please Confirm`
        )
        if(!confirmationStep){
            return
        }
    
        try{
            const res = await fetch(`/api/delete_user/${id}`, { method: "POST" });
            const data = await res.json()

            if(res.ok){
                staffCard.remove()
                console.log("user removed ")
                alert(`User ${user} has been deleted`)
            } else {
                console.error("failed to remove user", data.error)
                alert(`There was an error in deleting user ${user}. Please try again`)
            }
        } catch(err){
            console.error(err)
            alert(`There was an error in deleting user ${user}. Please try again`)
        }
    })

})