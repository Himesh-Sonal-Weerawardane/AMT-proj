// https://supabase.com/docs/reference/javascript/auth-onauthstatechange
// https://github.com/orgs/supabase/discussions/3360

document.addEventListener("DOMContentLoaded", async () => {
    const form = document.getElementById("psw-form")
 
    const button = form.querySelector("button")

    const { data: authStateData } = supabase.auth.onAuthStateChange((event, session) => {
        if(event === 'PASSWORD_RECOVERY'){
            form.addEventListener("submit", async (e) => {
                e.preventDefault()
                const password = document.getElementById("psw").value.trim()
                const passwordConfirmation = document.getElementById("confirm-psw").value.trim()
                const {data, error} = await supabase.auth.updateUser( { password})
            })
        }
    })

}) 
