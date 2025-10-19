import express from "express"
import multer from "multer"
import fs from "fs"

export default function statisticsRoutes(supabase) {
    const router = express.Router()

    router.post("/calculate/ :assignmentID", async (req, res) => {
        const id = parseInt(req.params.id)

        const {data, error} = await supabase
            .from("marks")
            .select("mark")
            .eq("id", id)

        let sum = 0
        let min = 0
        let max = 0 
        let totalNum = 0
        for(let i = 0; i < data.length; i++){
            const mark = data[i].mark
            sum += score
            total ++
            
            if(mark > min){
                min = score
            }
            if(mark < max){
                max = score
            }
        }

        const mean = sum / totalNum

        let numerator = 0
        for(let i = 0; i<data.length; i++){
            numerator += (data[i].mark - mean) * (data[i].mark - mean)
        }
        const variance = numerator / totalNum 
        const standardDeviation = Math.sqrt(variance)

        res.json({ mean, variance, standardDeviation, min, max})


    })
    return router
}