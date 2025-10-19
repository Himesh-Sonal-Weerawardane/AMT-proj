import express from "express"
import multer from "multer"
import fs from "fs"
//https://supabase.com/docs/reference/javascript/
export default function userRoutes(supabase) {
    const router = express.Router()

    //Add a user 
    router.post("/add_user", async (req, res) => {
        const {firstName, lastName, email, role } = req.body

        const {data, error} = await supabase.auth.admin.createUser(
            {
                email,
                password
            }
        )
        const {data2, error2} = await supabase
            .from("users")
            .insert([{
                firstName,
                lastName,
                email,
                role,
                userID 
            }])
    })

    //https://dev.to/therealmrmumba/beginners-guide-to-handling-delete-requests-in-nodejs-with-express-28dh
    router.post("/delete_user/ :userID", async (req, res) => {
        const id = parseInt(req.params.id)
        // const {data, error} = await supabase.auth.admin.deleteUser(id)

        const{data, error} = await supabase
            .from("users")
            .update({
                email: null,
                first_name: null,
                last_name: null,
                is_deleted: null, 

            })
            .eq("userID",id)

    })
    return router
}
