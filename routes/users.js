import express from "express"

//https://stackoverflow.com/questions/9719570/generate-random-password-string-with-5-letters-and-3-numbers-in-javascript
//https://supabase.com/docs/reference/javascript/
export default function userRoutes(supabase) {
    const router = express.Router()

    //Add a user 
    router.post("/add_user", async (req, res) => {
        try {
            console.log("attempt", req.body)
            const {first_name, last_name, email, role } = req.body

            const password = Math.random().toString(36).slice(-8)

            const {data: authData, error: authError} = await supabase.auth.admin.createUser(
                {
                    email,
                    password
                })

            if (authError) {
                console.error("auth error", authError)
                return res.status(400).json({ error: authError.message })  // User has wrong email/password
            }
            const auth_id = authData.user.id
            const user_role = role.toLowerCase()
            const is_admin = user_role === "admin"
            console.log("user created in auth", authData)
            const {data, error} = await supabase
                .from("users")
                .insert([{
                    first_name,
                    last_name,
                    email,
                    is_admin,
                    auth_id,
                    is_deleted: false, 
                    current_marker: true
                }], { returning: 'representation' })
            if (error) {
                console.error("be error", error)
                return res.status(400).json({ error: error.message })  // User has wrong email/password
            }
            console.log("added",data[0])
            res.json({ success: true, userData: data[0]})

        } catch (err) {
            console.error("Network or server error:", err);
            res.status(500).json({err});        }

    })

    //https://dev.to/therealmrmumba/beginners-guide-to-handling-delete-requests-in-nodejs-with-express-28dh

    //Deletes User
    
    router.post("/delete_user/:userID", async (req, res) => {
        const id = parseInt(req.params.userID)
        try{
            const{data, error} = await supabase
            .from("users")
            .update({
                email: null,
                first_name: null,
                last_name: null,
                is_deleted: true,
                current_marker: false

            })
            .eq("userID",id)
            if(error) {
                console.error("be error", error)
                return res.status(400).json({ error: error.message })  // User has wrong email/password   
            }
            res.json({ success: true, message: "user deleted"})
        } catch (err){
            console.error("Network or server error:", err);
            res.status(500).json({err});         
        }
    })

    router.get("/get_user", async (req, res) =>{
        try{
            const{data, error} = await supabase
                .from("users")
                .select("id, first-name, last-name, email, is_admin")
            if(error){
                console.error("be error", error)
                return res.status(400).json({ error: error.message })  // User has wrong email/password
            }
            res.json({success: true, data})
        } catch (err){
            console.error("Network or server error:", err);
            res.status(500).json({err}); 
        }
    }
    )

    return router
}
