import express from "express"
import multer from "multer"
import fs from "fs/promises"
import mammoth from "mammoth" // .docx -> text extraction

// Multer temp storage
const upload = multer({ dest: "uploads/" })

export default function uploadRoutes(supabase) {
    const router = express.Router()

    // ---------- Helpers ----------
    const normaliseNumber = (value) => {
        if (value === undefined || value === null || value === "") return null
        const numberValue = Number(value)
        return Number.isNaN(numberValue) ? null : numberValue
    }

    const normaliseText = (value) => {
        if (typeof value !== "string") return null
        const trimmed = value.trim()
        return trimmed === "" ? null : trimmed
    }

    const normaliseDate = (value) => {
        if (typeof value !== "string") return null
        const trimmed = value.trim()
        return trimmed === "" ? null : trimmed
    }

    const toPositiveInteger = (value) => {
        const numberValue = Number(value)
        return Number.isFinite(numberValue) && numberValue >= 0 ? Math.floor(numberValue) : null
    }

    const defaultStatisticsColumns = [
        { key: "student", label: "Student", align: "left" },
        { key: "student_grade", label: "Student Grade", align: "right" },
        { key: "marker_average", label: "Marker Average", align: "right" },
        { key: "difference", label: "Difference", align: "right" }
    ]

    const buildFallbackStatistics = (moduleMeta = null) => {
        const label = moduleMeta?.moderation_number
            ? `Moderation ${moduleMeta.moderation_number}`
            : moduleMeta?.name || "Moderation"

        return {
            meta: {
                module_id: moduleMeta?.id ?? null,
                is_fallback: true
            },
            overall: {
                title: `${label} overall statistics`,
                subtitle: moduleMeta?.name ? moduleMeta.name : "",
                columns: [...defaultStatisticsColumns],
                rows: [],
                empty_message: "No statistics are available yet.",
                updated_at: null
            },
            progress: {
                title: `${label} progress`,
                subtitle: "Progress updates will appear once marking begins.",
                totals: { marked: 0, unmarked: 0, total: 0 },
                entries: [],
                empty_message: "No progress has been recorded yet.",
                updated_at: null
            }
        }
    }

    const safeUnlink = async (path) => {
        if (!path) return
        try { await fs.unlink(path) } catch { /* ignore */ }
    }

    // ---------- Routes ----------

    /**
     * POST /upload_moderation
     * Uploads an assignment file and a rubric .docx, extracts rubric text,
     * stores both in Supabase Storage, and creates a row in 'moderations'.
     * NOTE: Uses `due_date` only (no `deadline_date` column usage anywhere).
     *       For backward compatibility, if the client still posts `deadline_date`,
     *       it will be treated as `due_date` internally.
     */
    router.post(
        "/upload_moderation",
        upload.fields([
            { name: "assignment" },
            { name: "rubric" }
        ]),
        async (req, res) => {
            console.log("[UploadModeration] Incoming request received")

            const { authorization, ...otherHeaders } = req.headers
            console.log("[UploadModeration] Request headers:", {
                ...otherHeaders,
                authorization: authorization ? `${authorization.split(" ")[0]} ...${authorization.slice(-4)}` : undefined
            })

            console.log("[UploadModeration] Request body fields:", req.body)

            const assignmentFile = req.files?.assignment?.[0]
            const rubricFile = req.files?.rubric?.[0]

            console.log("[UploadModeration] Assignment file metadata:",
                assignmentFile
                    ? {
                        originalname: assignmentFile.originalname,
                        mimetype: assignmentFile.mimetype,
                        size: assignmentFile.size,
                        path: assignmentFile.path
                    }
                    : "No assignment file provided"
            )

            console.log("[UploadModeration] Rubric file metadata:",
                rubricFile
                    ? {
                        originalname: rubricFile.originalname,
                        mimetype: rubricFile.mimetype,
                        size: rubricFile.size,
                        path: rubricFile.path
                    }
                    : "No rubric file provided"
            )

            if (!assignmentFile) return res.status(400).json({ error: "Assignment file required" })
            if (!rubricFile) return res.status(400).json({ error: "Rubric file required" })

            let assignmentUrl = null
            let rubricUrl = null

            try {
                // 1) Read rubric file and extract raw text
                console.log("[UploadModeration] Reading rubric file from temp storage")
                const rubricBuffer = await fs.readFile(rubricFile.path)

                console.log("[UploadModeration] Converting rubric DOCX to raw text")
                const { value: rubricText } = await mammoth.extractRawText({ buffer: rubricBuffer })

                const rubricLines = rubricText.split("\n").map(s => s.trim()).filter(Boolean)
                console.log("[UploadModeration] Extracted rubric line count:", rubricLines.length)

                // Primitive JSON structure; adjust to your parsing needs later
                const rubricJSON = rubricLines.map((line, i) => ({ id: i + 1, criterion: line }))

                // 2) Upload assignment to Supabase storage
                console.log("[UploadModeration] Uploading assignment to Supabase storage")
                const assignmentBuffer = await fs.readFile(assignmentFile.path)

                {
                    const { data, error } = await supabase.storage
                        .from("comp30022-amt")
                        .upload(`modules/assignments/${assignmentFile.originalname}`, assignmentBuffer, {
                            contentType: assignmentFile.mimetype,
                            upsert: true
                        })

                    if (error) {
                        console.error("[UploadModeration] Assignment upload failed:", error)
                        throw error
                    }

                    console.log("[UploadModeration] Assignment upload response:", data)
                    assignmentUrl = data.path
                }

                // 3) Upload rubric to Supabase storage
                console.log("[UploadModeration] Uploading rubric to Supabase storage")

                {
                    const { data, error } = await supabase.storage
                        .from("comp30022-amt")
                        .upload(`modules/rubrics/${rubricFile.originalname}`, rubricBuffer, {
                            contentType: rubricFile.mimetype,
                            upsert: true
                        })

                    if (error) {
                        console.error("[UploadModeration] Rubric upload failed:", error)
                        throw error
                    }

                    console.log("[UploadModeration] Rubric upload response:", data)
                    rubricUrl = data.path
                }

                console.log("[UploadModeration] Assignment URL (storage path):", assignmentUrl)
                console.log("[UploadModeration] Rubric URL (storage path):", rubricUrl)

                // 4) Read form fields (accept both due_date and legacy deadline_date, but STORE as due_date)
                const {
                    year,
                    semester,
                    moderation_number,
                    name,
                    description
                } = req.body

                const rawDueDate = (req.body?.due_date ?? req.body?.deadline_date) ?? null
                const normalizedDueDate = normaliseDate(rawDueDate)

                console.log("[UploadModeration] Preparing database insert with:", {
                    year,
                    semester,
                    moderation_number,
                    name,
                    due_date: normalizedDueDate,
                    description,
                    assignmentUrl,
                    rubricUrl,
                    rubricCount: rubricJSON.length
                })

                // 5) Insert into 'moderations' (ONLY due_date; no deadline_date; no upload_date)
                console.log("[UploadModeration] Executing Supabase insert for moderations")

                const { data: inserted, error: insertError } = await supabase
                    .from("moderations")
                    .insert([{
                        name: normaliseText(name),
                        year: normaliseNumber(year),
                        semester: normaliseNumber(semester),
                        moderation_number: normaliseNumber(moderation_number),
                        description: normaliseText(description),
                        due_date: normalizedDueDate,
                        hidden_from_markers: false,
                        rubric_json: rubricJSON.length ? rubricJSON : null,
                        assignment_url: assignmentUrl,
                        rubric_url: rubricUrl
                    }])
                    .select("id") // ensure we get back the id

                if (insertError) {
                    console.error("[UploadModeration] Failed to insert module:", insertError)
                    return res.status(500).json({ error: insertError.message })
                }

                const moduleId = inserted?.[0]?.id
                console.log("[UploadModeration] Returning success response with moduleId:", moduleId)
                return res.json({ success: true, moduleId })
            } catch (err) {
                console.error("[UploadModeration] Unhandled error while publishing module:", err)
                return res.status(500).json({ error: "Server error" })
            } finally {
                // Clean up temp files
                await Promise.all([
                    safeUnlink(assignmentFile?.path),
                    safeUnlink(rubricFile?.path)
                ])
            }
        }
    )

    router.get("/moderations/:id/statistics", async (req, res) => {
        const { id } = req.params

        let moduleMeta = null
        try {
            const { data: moduleData } = await supabase
                .from("moderations")
                .select("id, name, moderation_number")
                .eq("id", id)
                .maybeSingle()
            moduleMeta = moduleData || null
        } catch (err) {
            console.warn("[ModerationStatistics] Failed to fetch module metadata", err)
        }

        const fallback = buildFallbackStatistics(moduleMeta)

        try {
            const { data: statsRow, error } = await supabase
                .from("moderation_statistics")
                .select("*")
                .eq("moderation_id", id)
                .maybeSingle()

            if (error) {
                console.warn("[ModerationStatistics] Failed to fetch statistics", error)
                return res.json(fallback)
            }

            if (!statsRow) {
                return res.json(fallback)
            }

            const response = {
                meta: { ...fallback.meta, is_fallback: false },
                overall: {
                    ...fallback.overall,
                    columns: [...fallback.overall.columns]
                },
                progress: {
                    ...fallback.progress,
                    totals: { ...fallback.progress.totals }
                }
            }

            if (statsRow.meta && typeof statsRow.meta === "object") {
                response.meta = { ...response.meta, ...statsRow.meta, is_fallback: false }
            }

            if (statsRow.updated_at) {
                response.meta.updated_at = statsRow.updated_at
            }

            const overallSource = statsRow.overall || statsRow.summary || null
            if (overallSource && typeof overallSource === "object") {
                const rows = Array.isArray(overallSource.rows)
                    ? overallSource.rows
                    : Array.isArray(overallSource.data)
                        ? overallSource.data
                        : response.overall.rows

                const columns = Array.isArray(overallSource.columns) && overallSource.columns.length > 0
                    ? overallSource.columns
                    : response.overall.columns

                response.overall = {
                    ...response.overall,
                    ...overallSource,
                    columns,
                    rows,
                    empty_message: overallSource.empty_message || overallSource.emptyMessage || response.overall.empty_message,
                    updated_at: overallSource.updated_at || overallSource.updatedAt || response.overall.updated_at
                }
            }

            const progressSource = statsRow.progress || statsRow.marker_progress || null
            if (progressSource && typeof progressSource === "object") {
                const entries = Array.isArray(progressSource.entries)
                    ? progressSource.entries
                    : Array.isArray(progressSource.markers)
                        ? progressSource.markers
                        : Array.isArray(progressSource.rows)
                            ? progressSource.rows
                            : response.progress.entries

                const totalsSource = progressSource.totals || {}
                const marked = toPositiveInteger(progressSource.marked ?? totalsSource.marked ?? totalsSource.completed)
                const unmarked = toPositiveInteger(progressSource.unmarked ?? totalsSource.unmarked ?? totalsSource.remaining ?? totalsSource.pending)
                const total = toPositiveInteger(progressSource.total ?? totalsSource.total ?? totalsSource.count)

                response.progress = {
                    ...response.progress,
                    ...progressSource,
                    entries,
                    totals: {
                        marked: marked ?? response.progress.totals.marked,
                        unmarked: unmarked ?? response.progress.totals.unmarked,
                        total: total ?? response.progress.totals.total
                    },
                    empty_message: progressSource.empty_message || progressSource.emptyMessage || response.progress.empty_message,
                    updated_at: progressSource.updated_at || progressSource.updatedAt || response.progress.updated_at
                }

                if (response.progress.totals.total === 0) {
                    const inferredTotal = (response.progress.totals.marked ?? 0) + (response.progress.totals.unmarked ?? 0)
                    if (inferredTotal > 0) {
                        response.progress.totals.total = inferredTotal
                    } else if (entries.length > 0) {
                        response.progress.totals.total = entries.length
                    }
                }

                if (
                    response.progress.totals.total > 0
                    && response.progress.totals.unmarked === 0
                    && response.progress.totals.total > response.progress.totals.marked
                ) {
                    response.progress.totals.unmarked = response.progress.totals.total - response.progress.totals.marked
                }
            }

            return res.json(response)
        } catch (err) {
            console.error("[ModerationStatistics] Unexpected error", err)
            return res.json(fallback)
        }
    })

    /**
     * GET /moderations/:id
     * Fetch a single moderation with public URLs for assignment & rubric.
     */
    router.get("/moderations/:id", async (req, res) => {
        const { id } = req.params

        try {
            const { data, error } = await supabase
                .from("moderations")
                .select("*")
                .eq("id", id)
                .single()

            if (error) {
                console.error("Failed to fetch module:", error)
                return res.status(404).json({ error: "Module not found" })
            }

            const assignmentPath = data.assignment_url
            const rubricPath = data.rubric_url

            const assignmentPublicUrl = assignmentPath
                ? supabase.storage
                    .from("comp30022-amt")
                    .getPublicUrl(assignmentPath).data.publicUrl
                : null

            const rubricPublicUrl = rubricPath
                ? supabase.storage
                    .from("comp30022-amt")
                    .getPublicUrl(rubricPath).data.publicUrl
                : null

            // Exclude upload_date from response payload if present
            const { upload_date, ...rest } = data || {}
            return res.json({
                ...rest,
                // Make it explicit in payload naming
                assignment_public_url: assignmentPublicUrl,
                rubric_public_url: rubricPublicUrl
            })
        } catch (err) {
            console.error("Failed to fetch module:", err)
            return res.status(500).json({ error: "Server error" })
        }
    })

    /**
     * GET /moderations
     * List moderations, newest year first. If role=marker, hide rows where hidden_from_markers = true.
     * Returns `due_date` (no `deadline_date` field in any response).
     */
    router.get("/moderations", async (req, res) => {
        try {
            const { role } = req.query

            let query = supabase
                .from("moderations")
                .select("*")
                .order("year", { ascending: false, nullsFirst: false })
                .order("semester", { ascending: true, nullsFirst: false })
                .order("moderation_number", { ascending: true, nullsFirst: false })

            if (role === "marker") {
                // show rows where hidden_from_markers is null or false
                query = query.or("hidden_from_markers.is.null,hidden_from_markers.eq.false")
            }

            const { data, error } = await query

            if (error) {
                console.error("Failed to fetch modules:", error)
                return res.status(500).json({ error: "Failed to fetch modules" })
            }

            const moderations = (data || []).map((module) => {
                const assignmentPublicUrl = module.assignment_url
                    ? supabase.storage
                        .from("comp30022-amt")
                        .getPublicUrl(module.assignment_url).data.publicUrl
                    : null

                const rubricPublicUrl = module.rubric_url
                    ? supabase.storage
                        .from("comp30022-amt")
                        .getPublicUrl(module.rubric_url).data.publicUrl
                    : null

                return {
                    id: module.id,
                    name: module.name,
                    year: module.year,
                    semester: module.semester,
                    moderation_number: module.moderation_number,
                    due_date: module.due_date, // <-- expose due_date only
                    description: module.description,
                    hidden_from_markers: module.hidden_from_markers,
                    assignment_public_url: assignmentPublicUrl,
                    rubric_public_url: rubricPublicUrl,
                    rubric: module.rubric_json
                }
            })

            return res.json({ moderations })
        } catch (err) {
            console.error("Failed to fetch modules:", err)
            return res.status(500).json({ error: "Server error" })
        }
    })

    /**
     * POST /moderations/batch-delete
     * Deletes multiple moderations by ID.
     */
    router.post("/moderations/batch-delete", async (req, res) => {
        const { ids } = req.body

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: "No module IDs supplied" })
        }

        try {
            const { error } = await supabase
                .from("moderations")
                .delete()
                .in("id", ids)

            if (error) {
                console.error("Failed to delete modules:", error)
                return res.status(500).json({ error: "Failed to delete modules" })
            }

            return res.json({ success: true })
        } catch (err) {
            console.error("Unhandled error deleting modules:", err)
            return res.status(500).json({ error: "Server error" })
        }
    })

    /**
     * POST /moderations/batch-visibility
     * Bulk-set hidden_from_markers for supplied IDs.
     */
    router.post("/moderations/batch-visibility", async (req, res) => {
        const { ids, hidden } = req.body

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: "No module IDs supplied" })
        }

        const shouldHide = Boolean(hidden)

        try {
            const { error } = await supabase
                .from("moderations")
                .update({ hidden_from_markers: shouldHide })
                .in("id", ids)

            if (error) {
                console.error("Failed to update module visibility:", error)
                return res.status(500).json({ error: "Failed to update module visibility" })
            }

            return res.json({ success: true, hidden: shouldHide })
        } catch (err) {
            console.error("Unhandled error updating visibility:", err)
            return res.status(500).json({ error: "Server error" })
        }
    })

    return router
}
