// https://supabase.com/docs/reference/javascript/auth-onauthstatechange
// https://github.com/orgs/supabase/discussions/3360

const superbase = supabase.createClient(
    "https://gzdbbllkfxfnyhunxwvn.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6ZGJibGxrZnhmbnlodW54d3ZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1OTM1ODAsImV4cCI6MjA3NjE2OTU4MH0.7pplI6C1LJjXz_ODdexUDoWvtYeHHbZhD7QRt_qCOB4"
)
document.addEventListener("DOMContentLoaded", async () => {
    const form = document.getElementById("psw-form")
 
    const button = form.querySelector("button")

    const { data: authStateData } = superbase.auth.onAuthStateChange(async (event, session) => {
        if(event === 'PASSWORD_RECOVERY'){
            form.addEventListener("submit", async (e) => {
                e.preventDefault()
                const password = document.getElementById("psw").value.trim()
                const passwordConfirmation = document.getElementById("confirm-psw").value.trim()
                const {data, error} = await superbase.auth.updateUser( { password})
            })
        }
    })

}) 
