const registration = document.getElementById('registration-form')
registration.addEventListener('click', async (e) => {
    e.preventDefault()

    const firstName = document.getElementById('firstName').value.trim()
    const lastName = document.getElementById('lastName').value.trim()
    const email = document.getElementById('email').value.trim().toLowerCase()
    const password = document.getElementById('password').value

    try{
        const res = await fetch('/api/register_user', {
            method: 'POST',
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({firstName, lastName, email, password})
        })
        const data = await res.json()
        if(!res.ok){
            alert(res.error)
            return
        }
        if (!data.success) {
            alert('Invite Unsuccessful      ' + data.error)
        } else {
            alert('Invite Successful')
            window.location.href = "../index.html"
        }
    } catch (err) {
        console.error("Network or server error:", err);
    }
    
})
