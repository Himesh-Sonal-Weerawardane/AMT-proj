const inviteUser = document.getElementById("invite-submit");
inviteUser.addEventListener('click', async (e) => {
    e.preventDeafult()

    const firstName = document.getElementById('invite-first-name').value
    const surname = document.getElementById('invite-surname').value
    const role = document.getElementById('invite-role').value
    const email = document.getElementById('invite-email').value

    try{
        const res = await fetch('/api/add_user', {
            method: 'POST',
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({firstName, surname, role, email})
        })
        const data = await res.json()

        if (!data.ok) {
            alert('Invite Successful')
        } else {
            alert('Invite unsuccessful    '+ data.error)
        }
    } catch (err) {
        console.error("Network or server error:", err);
    }
    
})
