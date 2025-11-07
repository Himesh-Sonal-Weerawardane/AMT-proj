import express from "express";
import { sendAccountRegistrationEmail } from "../mail.js";

//https://stackoverflow.com/questions/9719570/generate-random-password-string-with-5-letters-and-3-numbers-in-javascript
//https://supabase.com/docs/reference/javascript/
export default function userRoutes(supabase) {
  const router = express.Router();

  //https://dev.to/therealmrmumba/beginners-guide-to-handling-delete-requests-in-nodejs-with-express-28dh
  //Deletes User

  router.post("/delete_user/:userID", async (req, res) => {
    const id = req.params.userID;
    try {
      console.log("Attempting to delete user with auth_id:", id)
      
      const { data, error } = await supabase
        .from("users")
        .update({
          auth_id: null,
          email: null,
          first_name: null,
          last_name: null,
          is_deleted: true,
          current_marker: false,
        })
        .eq("auth_id", id);
      if (error) {
        console.error("be error", error);
        return res.status(400).json({ error: error.message }); 
      }
      const {data: deleteData, error: deleteError } = await supabase.auth.admin.deleteUser(id)

      if(deleteError){
        console.error("error with deleting auth", deleteError)
        return res.status(400).json({deleteError})
      }

      res.json({ success: true, message: "user deleted" });
    } catch (err) {
      console.error("Network or server error:", err);
      res.status(500).json({ err });
    }
  });

  router.get("/get_user", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("auth_id, first_name, last_name, email, is_admin")
        .eq("is_deleted", false);
      if (error) {
        console.error("be error", error);
        return res.status(400).json({ error: error.message }); 
      }
      res.json(data);
    } catch (err) {
      console.error("Network or server error:", err);
      res.status(500).json({ err });
    }
  });

  router.post("/invite_user", async (req, res) => {
    try {
      console.log("attempt", req.body);
      const { email, role } = req.body;

      if (!email || !role) {
        return res
          .status(400)
          .json({ error: "Missing Field. All Fields Are Required" });
      }

      const roleLowerCase = role.toLowerCase();

      const url = process.env.RENDER_EXTERNAL_URL || "http://localhost:3000"
      const link =
        `${url}/account/account-registration.html?role=${roleLowerCase}`;
      await sendAccountRegistrationEmail(email, link)

      return res.json({success: true})
    } catch (err) {
      console.error("Network or server error:", err);
      res.status(500).json({ err });
    }
  });


  router.post("/register_user", async (req, res) => {
    try {
      console.log("attempt", req.body);
      const { firstName, lastName, email, password, role } = req.body;

      if (!firstName || !lastName || !email || !password || !role) {
        return res
          .status(400)
          .json({ error: "Missing Field. All Fields Are Required" });
      }
      const {data: userData, error: userError} = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true, 
      })
      if(userError){
        console.error(userError)
        return res.status(400).json({ userError }); 
      }
      const first_name = firstName;
      const last_name = lastName;
      const auth_id = userData.user.id;
      if(!auth_id){
        console.warn("no authid")
      }
      const user_role = role.toLowerCase();
      const is_admin = user_role === "admin";

      const { data, error } = await supabase.from("users").insert(
        [
          {
            first_name,
            last_name,
            email,
            is_admin,
            auth_id,
            is_deleted: false,
            current_marker: true,
          },
        ],
        { returning: "representation" }
      );
      console.log("data registered", {data, error});
      if (error) {
        console.error("be error", error);
        return res.status(400).json({ error: error.message }); 
      }
      console.log("added user");
      return res.json({ success: true });
    } catch (err) {
      console.error("Network or server error:", err);
      res.status(500).json({ err });
    }
  });
  
  router.post("/forgot_psw", async (req, res) => {
    
      console.log("attempt", req.body);
      const { email } = req.body;

      if (!email) {
        return res
          .status(400)
          .json({ error: "Missing Field. All Fields Are Required" });
      }

      const url = process.env.RENDER_EXTERNAL_URL || "http://localhost:3000"
      const {data: userData, error: userError} = await supabase.auth.resetPasswordForEmail(email,{
        redirectTo: `${url}/login-pages/reset-psw.html`,
      })

      if(userError){
        console.error(userError);
        res.status(500).json({ userError });
      }

      return res.json({success: true})

  });
  return router;
}