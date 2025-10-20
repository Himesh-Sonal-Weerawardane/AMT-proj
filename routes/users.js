import express from "express"

//https://supabase.com/docs/reference/javascript/
export default function userRoutes(supabase) {
    const router = express.Router()

    //Add a user 
    router.post("/add_user", async (req, res) => {
        try {
            const {firstName, lastName, email, role } = req.body
            const {data: authData, error: authError} = await supabase.auth.admin.createUser(
                {
                    email,
                    password
                })

            if (authError) return res.status(400).json({ error: authError.message })  // User has wrong email/password

            const userID = authData.id

            const {data, error} = await supabase
                .from("users")
                .insert([{
                    firstName,
                    lastName,
                    email,
                    role,
                    userID 
                }])
            if (error) return res.status(400).json({ error: error.message })  // User has wrong email/password

            res.json({ success: true, userData: data[0]})

        } catch (err) {
            console.error("Network or server error:", err);
            res.status(500).json({err})
        }

    })

    //https://dev.to/therealmrmumba/beginners-guide-to-handling-delete-requests-in-nodejs-with-express-28dh

    //Deletes User
    /*
    router.post("/delete_user/:userID", async (req, res) => {
        const id = parseInt(req.params.userID)
        // const {data, error} = await supabase.auth.admin.deleteUser(id)

        const{data, error} = await supabase
            .from("users")
            .update({
                email: null,
                first_name: null,
                last_name: null,
                is_deleted: true, 

            })
            .eq("userID",id)

    })*/
    return router
}
