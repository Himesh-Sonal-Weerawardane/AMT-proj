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
        { key: "student", label: "Marker", align: "left" },
        { key: "student_grade", label: "Marker Score", align: "right" },
        { key: "marker_average", label: "Average Score", align: "right" },
        { key: "difference", label: "Δ vs average", align: "right" }
    ]

    const adaptModerationStatsRow = (statsRow) => {
        if (!statsRow || typeof statsRow !== "object") return null

        const normalisedMeta = statsRow.meta && typeof statsRow.meta === "object"
            ? { ...statsRow.meta }
            : {}

        const timestamp = statsRow.updated_at
            || statsRow.last_updated_at
            || statsRow.calculated_at
            || statsRow.generated_at
            || null

        if (!normalisedMeta.updated_at && timestamp) {
            normalisedMeta.updated_at = timestamp
        }

        const legacyOverall = statsRow.overall || statsRow.summary || null
        const legacyProgress = statsRow.progress || statsRow.marker_progress || null

        if (legacyOverall || legacyProgress) {
            return {
                meta: normalisedMeta,
                overall: legacyOverall,
                progress: legacyProgress,
                updated_at: normalisedMeta.updated_at || timestamp
            }
        }

        const maxPoints = normaliseNumber(
            statsRow.max_points
            ?? statsRow.maxPoints
            ?? statsRow.max_mark
            ?? statsRow.maximum_points
        )

        if (maxPoints !== null && normalisedMeta.max_points === undefined) {
            normalisedMeta.max_points = maxPoints
        }

        const unitChairMarks = normaliseNumber(
            statsRow.unit_chair_marks
            ?? statsRow.unit_chair_mark
            ?? statsRow.unitChairMarks
            ?? statsRow.unitChairMark
        )

        const unitChairAverage = normaliseNumber(
            statsRow.unit_chair_average
            ?? statsRow.unitChairAverage
            ?? statsRow.unit_chair_avg
        )

        const markerMark = normaliseNumber(
            statsRow.marker_mark
            ?? statsRow.markerMark
            ?? statsRow.marker_score
            ?? statsRow.markerScore
        )

        const markerAverage = normaliseNumber(
            statsRow.marker_average
            ?? statsRow.markerAverage
            ?? statsRow.marker_avg
        )

        const markerName = normaliseText(
            statsRow.marker_name
            ?? statsRow.markerName
            ?? statsRow.primary_marker_name
        )

        const markerIdentifierRaw = statsRow.marker_identifier
            ?? statsRow.markerIdentifier
            ?? statsRow.marker_id
            ?? null

        const markerIdentifier = markerIdentifierRaw !== null && markerIdentifierRaw !== undefined
            ? String(markerIdentifierRaw)
            : null

        const baseAverage = markerAverage ?? unitChairMarks ?? unitChairAverage ?? null
        const markerDifference = Number.isFinite(markerMark) && Number.isFinite(baseAverage)
            ? markerMark - baseAverage
            : null

        const overallRows = []
        if (markerMark !== null || baseAverage !== null) {
            overallRows.push({
                student: {
                    name: markerName || "Marker",
                    id: markerIdentifier || undefined
                },
                student_grade: markerMark ?? null,
                marker_average: baseAverage,
                difference: markerDifference
            })
        }

        const markerCount = toPositiveInteger(
            statsRow.marker_count
            ?? statsRow.markers_total
            ?? statsRow.total_markers
            ?? statsRow.marker_total
        )

        if (markerCount !== null && normalisedMeta.marker_count === undefined) {
            normalisedMeta.marker_count = markerCount
        }

        let marked = toPositiveInteger(
            statsRow.marked_count
            ?? statsRow.marked
            ?? statsRow.completed_count
            ?? statsRow.marked_submissions
            ?? statsRow.completed_submissions
            ?? statsRow.markers_completed
        )

        let unmarked = toPositiveInteger(
            statsRow.unmarked_count
            ?? statsRow.unmarked
            ?? statsRow.pending_count
            ?? statsRow.pending_submissions
            ?? statsRow.markers_remaining
        )

        let total = toPositiveInteger(
            statsRow.total_count
            ?? statsRow.total
            ?? statsRow.total_submissions
            ?? statsRow.submission_count
            ?? statsRow.total_markers
        )

        if (total === null && marked !== null && unmarked !== null) {
            total = marked + unmarked
        }

        if (unmarked === null && total !== null && marked !== null) {
            unmarked = Math.max(total - marked, 0)
        } else if (marked === null && total !== null && unmarked !== null) {
            marked = Math.max(total - unmarked, 0)
        } else if (total === null && marked !== null && unmarked === null) {
            total = marked
        }

        const totals = {}
        if (marked !== null) totals.marked = marked
        if (unmarked !== null) totals.unmarked = unmarked
        if (total !== null) totals.total = total

        const progressSourceEntries = Array.isArray(statsRow.progress_entries)
            ? statsRow.progress_entries
            : Array.isArray(statsRow.marker_entries)
                ? statsRow.marker_entries
                : null

        let progressEntries = []
        if (progressSourceEntries) {
            progressEntries = progressSourceEntries.filter((entry) => entry && typeof entry === "object")
        } else if (marked !== null || unmarked !== null || total !== null) {
            const notesParts = []
            if (marked !== null) notesParts.push(`${marked} marked`)
            if (unmarked !== null) notesParts.push(`${unmarked} remaining`)
            if (total !== null) notesParts.push(`${total} total`)

            const status = total !== null
                ? marked >= total
                    ? "completed"
                    : marked > 0
                        ? "in_progress"
                        : "pending"
                : "pending"

            progressEntries.push({
                name: markerName || "Marking progress",
                identifier: markerIdentifier,
                status,
                updated_at: statsRow.progress_updated_at || timestamp,
                notes: notesParts.length > 0 ? notesParts.join(" • ") : null
            })
        }

        const overall = overallRows.length > 0
            ? {
                title: statsRow.overall_title || null,
                subtitle: statsRow.overall_subtitle || null,
                columns: [...defaultStatisticsColumns],
                rows: overallRows,
                empty_message: statsRow.overall_empty_message || null,
                updated_at: statsRow.overall_updated_at || timestamp
            }
            : null

        const totalsHasValues = Object.values(totals).some((value) => value !== undefined && value !== null)
        const progress = (progressEntries.length > 0 || totalsHasValues)
            ? {
                title: statsRow.progress_title || null,
                subtitle: statsRow.progress_subtitle || null,
                totals,
                entries: progressEntries,
                empty_message: statsRow.progress_empty_message || null,
                updated_at: statsRow.progress_updated_at || timestamp
            }
            : null

        if (!overall && !progress) {
            return null
        }

        return {
            meta: normalisedMeta,
            overall,
            progress,
            updated_at: normalisedMeta.updated_at || timestamp
        }
    }

    const parseScoreValue = (value) => {
        const numeric = normaliseNumber(value)
        if (numeric !== null) return numeric

        if (typeof value === "string") {
            const trimmed = value.trim()
            if (trimmed === "") return null

            const cleaned = trimmed.replace(/[^0-9+\-.]/g, "")
            if (cleaned === "" || cleaned === "+" || cleaned === "-" || cleaned === ".") {
                return null
            }

            const fallbackNumber = Number(cleaned)
            if (Number.isFinite(fallbackNumber)) return fallbackNumber
        }

        return null
    }

    const extractScoreFromCollection = (collection) => {
        if (!collection) return null

        let foundNumeric = false

        const addValues = (acc, raw) => {
            if (raw === null || raw === undefined) return acc

            if (typeof raw === "number") {
                if (Number.isFinite(raw)) {
                    foundNumeric = true
                    return acc + raw
                }
                return acc
            }

            if (typeof raw === "string") {
                const numeric = parseScoreValue(raw)
                if (numeric !== null) {
                    foundNumeric = true
                    return acc + numeric
                }
                return acc
            }

            if (typeof raw === "object") {
                if (Array.isArray(raw)) {
                    return raw.reduce(addValues, acc)
                }

                return Object.values(raw).reduce(addValues, acc)
            }

            return acc
        }

        const total = addValues(0, collection)
        return foundNumeric ? total : null
    }

    const parseMarkScore = (mark) => {
        if (!mark || typeof mark !== "object") return null

        const fromTotal = parseScoreValue(mark.total_score ?? mark.totalScore)
        if (fromTotal !== null) return fromTotal

        const fromScores = extractScoreFromCollection(mark.scores ?? mark.score ?? null)
        if (fromScores !== null && Number.isFinite(fromScores)) return fromScores

        return null
    }

    const extractMarkerName = (marker, fallbackId) => {
        if (marker && typeof marker === "object") {
            const parts = [marker.first_name, marker.last_name]
                .map((part) => (typeof part === "string" ? part.trim() : ""))
                .filter(Boolean)

            if (parts.length > 0) return parts.join(" ")

            if (typeof marker.email === "string" && marker.email.trim() !== "") {
                return marker.email.trim()
            }
        }

        if (fallbackId !== null && fallbackId !== undefined) {
            return `Marker ${fallbackId}`
        }

        return "Unknown marker"
    }

    const summariseComments = (input) => {
        if (!input) return ""

        if (typeof input === "string") {
            return input.trim()
        }

        const collectStrings = (value) => {
            if (!value) return []

            if (typeof value === "string") {
                const trimmed = value.trim()
                return trimmed ? [trimmed] : []
            }

            if (Array.isArray(value)) {
                return value.flatMap(collectStrings)
            }

            if (typeof value === "object") {
                return Object.values(value).flatMap(collectStrings)
            }

            return []
        }

        const strings = collectStrings(input)
        if (strings.length === 0) return ""

        return strings.join(" • ")
    }

    const buildLiveStatisticsFromMarks = async (moderationId, moduleMeta) => {
        try {
            const { data: marks, error } = await supabase
                .from("marks")
                .select("mark_id, moderation_id, marker_id, submitted_at, total_score, scores, comments, marker:users!marks_marker_id_fkey(user_id, first_name, last_name, email)")
                .eq("moderation_id", moderationId)

            if (error) {
                console.warn("[ModerationStatistics] Failed to fetch marks for moderation", moderationId, error)
                return null
            }

            if (!marks || marks.length === 0) {
                return null
            }

            const fallback = buildFallbackStatistics(moduleMeta)
            const nowIso = new Date().toISOString()

            const mapped = marks.map((mark) => {
                const marker = mark.marker || {}
                const score = parseMarkScore(mark)
                const markerId = marker.user_id ?? mark.marker_id ?? null
                const name = extractMarkerName(marker, mark.marker_id)

                return {
                    raw: mark,
                    score,
                    markerId,
                    name,
                    comments: summariseComments(mark.comments)
                }
            })

            const numericScores = mapped
                .map(({ score }) => (Number.isFinite(score) ? score : null))
                .filter((value) => value !== null)

            const averageScore = numericScores.length > 0
                ? numericScores.reduce((acc, value) => acc + value, 0) / numericScores.length
                : null

            const overallRows = mapped.map(({ raw, score, markerId, name }) => ({
                student: {
                    name,
                    id: markerId !== null && markerId !== undefined ? String(markerId) : undefined
                },
                student_grade: Number.isFinite(score) ? score : null,
                marker_average: Number.isFinite(averageScore) ? averageScore : null,
                difference: Number.isFinite(score) && Number.isFinite(averageScore)
                    ? score - averageScore
                    : null,
                marker_id: raw.marker_id
            }))

            const progressEntries = mapped.map(({ raw, name, markerId, comments, score }) => {
                const status = raw.submitted_at
                    ? "completed"
                    : Number.isFinite(score)
                        ? "in_progress"
                        : "pending"

                return {
                    name,
                    identifier: markerId !== null && markerId !== undefined ? String(markerId) : null,
                    status,
                    updated_at: raw.submitted_at || null,
                    notes: comments,
                    marker_id: raw.marker_id
                }
            })

            let latestActivityIso = null
            for (const entry of progressEntries) {
                if (!entry?.updated_at) continue
                const timestamp = Date.parse(entry.updated_at)
                if (Number.isFinite(timestamp)) {
                    if (!latestActivityIso || timestamp > Date.parse(latestActivityIso)) {
                        latestActivityIso = new Date(timestamp).toISOString()
                    }
                }
            }

            const updatedTimestamp = latestActivityIso || nowIso

            const markedCount = progressEntries.filter((entry) => entry.status === "completed").length
            const totalCount = progressEntries.length
            const unmarkedCount = Math.max(totalCount - markedCount, 0)

            const result = {
                meta: {
                    ...fallback.meta,
                    updated_at: updatedTimestamp,
                    is_fallback: false,
                    source: "live",
                    marker_count: totalCount
                },
                overall: {
                    ...fallback.overall,
                    title: fallback.overall.title,
                    subtitle: fallback.overall.subtitle || "Comparison between marker scores.",
                    updated_at: updatedTimestamp,
                    columns: fallback.overall.columns.length > 0
                        ? fallback.overall.columns
                        : [...defaultStatisticsColumns],
                    rows: overallRows,
                    empty_message: overallRows.length > 0
                        ? fallback.overall.empty_message
                        : fallback.overall.empty_message
                },
                progress: {
                    ...fallback.progress,
                    title: fallback.progress.title,
                    subtitle: fallback.progress.subtitle || "Marker activity for this moderation.",
                    updated_at: updatedTimestamp,
                    totals: {
                        marked: markedCount,
                        unmarked: unmarkedCount,
                        total: totalCount
                    },
                    entries: progressEntries,
                    empty_message: progressEntries.length > 0
                        ? fallback.progress.empty_message
                        : fallback.progress.empty_message
                }
            }

            try {
                await supabase
                    .from("moderation_statistics")
                    .upsert({
                        moderation_id: moderationId,
                        meta: result.meta,
                        overall: result.overall,
                        progress: result.progress,
                        updated_at: updatedTimestamp
                    }, { onConflict: "moderation_id" })
            } catch (persistError) {
                console.warn("[ModerationStatistics] Failed to persist live statistics", persistError)
            }

            return result
        } catch (err) {
            console.warn("[ModerationStatistics] Unexpected error building live statistics", err)
            return null
        }
    }

    const demoModerations = [
        {
            id: "moderation-1",
            name: "Human-Centred Design Portfolio",
            year: 2025,
            semester: 2,
            moderation_number: 1,
            due_date: "2025-08-22T07:00:00Z",
            upload_date: "2025-08-15T07:45:00Z",
            description: "First moderation cycle for the Human-Centred Design project.",
            hidden_from_markers: false,
            rubric: [
                { criterion: "Research depth and insight" },
                { criterion: "Prototype quality" },
                { criterion: "Reflection and iteration" }
            ],
            assignment_public_url: "/pdf/sample.pdf",
            rubric_public_url: null
        }
    ]

    const demoStatisticsById = {
        "moderation-1": {
            meta: {
                description: "Snapshot generated from sample data for local demos.",
                updated_at: "2025-08-21T10:15:00Z"
            },
            overall: {
                title: "Moderation 1 overall statistics",
                subtitle: "Comparison between student submissions and marker averages.",
                updated_at: "2025-08-21T10:00:00Z",
                columns: [...defaultStatisticsColumns],
                rows: [
                    {
                        student: { name: "Amelia Chen", id: "S1034829" },
                        student_grade: 78,
                        marker_average: 75,
                        difference: 3
                    },
                    {
                        student: { name: "Noah Patel", id: "S1035834" },
                        student_grade: 85,
                        marker_average: 83,
                        difference: 2
                    },
                    {
                        student: { name: "Layla Thompson", id: "S1029475" },
                        student_grade: 62,
                        marker_average: 68,
                        difference: -6
                    },
                    {
                        student: { name: "Oliver Wright", id: "S1041203" },
                        student_grade: 91,
                        marker_average: 89,
                        difference: 2
                    },
                    {
                        student: { name: "Sophie Martinez", id: "S1042388" },
                        student_grade: 74,
                        marker_average: 74,
                        difference: 0
                    }
                ]
            },
            progress: {
                title: "Moderation 1 progress",
                subtitle: "Marker activity for the current moderation round.",
                updated_at: "2025-08-21T10:15:00Z",
                totals: { marked: 18, unmarked: 2, total: 20 },
                entries: [
                    {
                        name: "Sam Carter",
                        role: "Lead Marker",
                        identifier: "M-004",
                        status: "completed",
                        updated_at: "2025-08-21T09:50:00Z",
                        notes: "All scripts double-checked."
                    },
                    {
                        name: "Priya Nair",
                        role: "Moderator",
                        identifier: "M-017",
                        status: "in_progress",
                        updated_at: "2025-08-21T09:40:00Z",
                        notes: "Reviewing borderline cases."
                    },
                    {
                        name: "Jordan Lee",
                        role: "Assistant Marker",
                        identifier: "M-021",
                        status: "pending",
                        updated_at: "2025-08-21T08:15:00Z",
                        notes: "Awaiting reassigned scripts."
                    }
                ]
            }
        }
    }

    const mapDemoModule = (module) => ({
        id: module.id,
        name: module.name,
        year: module.year,
        semester: module.semester,
        moderation_number: module.moderation_number,
        due_date: module.due_date,
        upload_date: module.upload_date,
        description: module.description,
        hidden_from_markers: module.hidden_from_markers ?? false,
        assignment_public_url: module.assignment_public_url ?? null,
        rubric_public_url: module.rubric_public_url ?? null,
        rubric: module.rubric ?? []
    })

    const findDemoModule = (id, moduleMeta = null) => {
        if (!id && !moduleMeta) return null

        const normalisedId = typeof id === "string" ? id.trim().toLowerCase() : ""
        const numericId = Number.parseInt(normalisedId.replace(/[^0-9]/g, ""), 10)

        const matcher = (module) => {
            if (!module) return false
            if (typeof module.id === "string" && module.id.toLowerCase() === normalisedId) return true
            if (Number.isInteger(numericId) && module.moderation_number === numericId) return true
            if (moduleMeta?.moderation_number && module.moderation_number === moduleMeta.moderation_number) return true
            return false
        }

        return demoModerations.find(matcher) || null
    }

    const findDemoStatistics = (id, moduleMeta = null) => {
        const module = findDemoModule(id, moduleMeta)
        if (!module) return null
        return demoStatisticsById[module.id] || null
    }

    const getDemoModerations = (role) => demoModerations
        .filter((module) => !(role === "marker" && module.hidden_from_markers))
        .map(mapDemoModule)

    const mergeWithDemoStatistics = (fallbackStats, id, moduleMeta) => {
        const demoStats = findDemoStatistics(id, moduleMeta)
        if (!demoStats) return null

        const overall = demoStats.overall || {}
        const progress = demoStats.progress || {}

        return {
            meta: {
                ...fallbackStats.meta,
                ...demoStats.meta,
                is_fallback: false
            },
            overall: {
                ...fallbackStats.overall,
                ...overall,
                columns: Array.isArray(overall.columns) && overall.columns.length > 0
                    ? overall.columns
                    : fallbackStats.overall.columns,
                rows: Array.isArray(overall.rows) && overall.rows.length > 0
                    ? overall.rows
                    : fallbackStats.overall.rows,
                empty_message: overall.empty_message || overall.emptyMessage || fallbackStats.overall.empty_message,
                updated_at: overall.updated_at || overall.updatedAt || fallbackStats.overall.updated_at
            },
            progress: {
                ...fallbackStats.progress,
                ...progress,
                entries: Array.isArray(progress.entries) && progress.entries.length > 0
                    ? progress.entries
                    : fallbackStats.progress.entries,
                totals: {
                    ...fallbackStats.progress.totals,
                    ...(progress.totals || {}),
                    marked: progress.totals?.marked ?? fallbackStats.progress.totals.marked,
                    unmarked: progress.totals?.unmarked ?? fallbackStats.progress.totals.unmarked,
                    total: progress.totals?.total ?? fallbackStats.progress.totals.total
                },
                empty_message: progress.empty_message || progress.emptyMessage || fallbackStats.progress.empty_message,
                updated_at: progress.updated_at || progress.updatedAt || fallbackStats.progress.updated_at
            }
        }
    }

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
        console.log("[ModerationStatistics] Request received", { id })

        let moduleMeta = null
        try {
            console.log("[ModerationStatistics] Fetching module metadata", { id })
            const { data: moduleData } = await supabase
                .from("moderations")
                .select("id, name, moderation_number")
                .eq("id", id)
                .maybeSingle()
            moduleMeta = moduleData || null
            console.log("[ModerationStatistics] Module metadata result", { id, found: Boolean(moduleMeta) })
        } catch (err) {
            console.warn("[ModerationStatistics] Failed to fetch module metadata", err)
        }

        if (!moduleMeta) {
            console.log("[ModerationStatistics] Falling back to demo module metadata", { id })
            moduleMeta = findDemoModule(id) || null
        }

        const fallback = buildFallbackStatistics(moduleMeta)

        try {
            console.log("[ModerationStatistics] Fetching cached statistics", { id })
            const { data: statsRow, error } = await supabase
                .from("moderation_stats")
                .select("*")
                .eq("moderation_id", id)
                .maybeSingle()

            const ensureLiveStatistics = async () => {
                console.log("[ModerationStatistics] Falling back to live statistics", { id })
                const liveStatistics = await buildLiveStatisticsFromMarks(id, moduleMeta)
                if (liveStatistics) {
                    console.log("[ModerationStatistics] Live statistics generated", { id })
                    const payload = { ...liveStatistics }
                    if (payload.raw_stats === undefined) {
                        payload.raw_stats = null
                    }
                    return res.json(payload)
                }

                const merged = mergeWithDemoStatistics(fallback, id, moduleMeta)
                console.log("[ModerationStatistics] Returning merged fallback statistics", { id, merged: Boolean(merged) })
                const payload = { ...(merged || fallback) }
                payload.raw_stats = null
                return res.json(payload)
            }

            if (error) {
                console.warn("[ModerationStatistics] Failed to fetch statistics", error)
                return await ensureLiveStatistics()
            }

            if (!statsRow) {
                console.log("[ModerationStatistics] No cached statistics row", { id })
                return await ensureLiveStatistics()
            }

            const adaptedStats = adaptModerationStatsRow(statsRow)
            console.log("[ModerationStatistics] Adapted statistics row", { id, hasAdaptedStats: Boolean(adaptedStats) })
            if (!adaptedStats) {
                return await ensureLiveStatistics()
            }

            const hasOverallData = Array.isArray(adaptedStats.overall?.rows) && adaptedStats.overall.rows.length > 0
            const hasProgressEntries = Array.isArray(adaptedStats.progress?.entries) && adaptedStats.progress.entries.length > 0
            const hasProgressTotals = (() => {
                if (!adaptedStats.progress || typeof adaptedStats.progress !== "object") return false
                const totals = adaptedStats.progress.totals
                if (!totals || typeof totals !== "object") return false
                return ["marked", "unmarked", "total"].some((key) => normaliseNumber(totals[key]) !== null)
            })()

            console.log("[ModerationStatistics] Data availability flags", {
                id,
                hasOverallData,
                hasProgressEntries,
                hasProgressTotals
            })

            if (!hasOverallData && !hasProgressEntries && !hasProgressTotals) {
                console.log("[ModerationStatistics] Cached statistics missing required sections", { id })
                return await ensureLiveStatistics()
            }

            const response = {
                meta: { ...fallback.meta, is_fallback: false },
                overall: {
                    ...fallback.overall,
                    columns: [...fallback.overall.columns],
                    rows: [...fallback.overall.rows]
                },
                progress: {
                    ...fallback.progress,
                    totals: { ...fallback.progress.totals },
                    entries: [...fallback.progress.entries]
                }
            }

            if (adaptedStats.meta && typeof adaptedStats.meta === "object") {
                response.meta = { ...response.meta, ...adaptedStats.meta, is_fallback: false }
            }

            if (adaptedStats.updated_at) {
                response.meta.updated_at = adaptedStats.updated_at
            }

            const overallSource = adaptedStats.overall || null
            if (overallSource && typeof overallSource === "object") {
                const rows = Array.isArray(overallSource.rows)
                    ? overallSource.rows
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

            const progressSource = adaptedStats.progress || null
            if (progressSource && typeof progressSource === "object") {
                const entries = Array.isArray(progressSource.entries)
                    ? progressSource.entries
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

            console.log("[ModerationStatistics] Returning cached statistics", {
                id,
                rows: response.overall.rows.length,
                progressEntries: response.progress.entries.length
            })
            const payload = { ...response, raw_stats: statsRow }
            return res.json(payload)
        } catch (err) {
            console.error("[ModerationStatistics] Unexpected error", err)
            const merged = mergeWithDemoStatistics(fallback, id, moduleMeta)
            console.log("[ModerationStatistics] Returning merged fallback after error", { id, merged: Boolean(merged) })
            const payload = { ...(merged || fallback) }
            payload.raw_stats = null
            return res.json(payload)
        }
    })

    /**
     * GET /moderations/:id
     * Fetch a single moderation with public URLs for assignment & rubric.
     */
    router.get("/moderations/:id", async (req, res) => {
        const { id } = req.params
        console.log("[ModerationDetail] Request received", { id })

        try {
            console.log("[ModerationDetail] Fetching module row", { id })
            const { data, error } = await supabase
                .from("moderations")
                .select("*")
                .eq("id", id)
                .single()

            if (error) {
                console.error("Failed to fetch module:", error)
                const demoModule = findDemoModule(id)
                if (demoModule) {
                    console.log("[ModerationDetail] Returning demo module", { id })
                    return res.json(mapDemoModule(demoModule))
                }
                console.log("[ModerationDetail] Module not found", { id })
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

            // Include upload_date explicitly for the frontend display
            const { upload_date, ...rest } = data || {}
            console.log("[ModerationDetail] Returning module payload", {
                id,
                hasAssignment: Boolean(assignmentPublicUrl),
                hasRubric: Boolean(rubricPublicUrl)
            })
            return res.json({
                ...rest,
                upload_date,
                // Make it explicit in payload naming
                assignment_public_url: assignmentPublicUrl,
                rubric_public_url: rubricPublicUrl
            })
        } catch (err) {
            console.error("Failed to fetch module:", err)
            const demoModule = findDemoModule(id)
            if (demoModule) {
                console.log("[ModerationDetail] Returning demo module after error", { id })
                return res.json(mapDemoModule(demoModule))
            }
            return res.status(500).json({ error: "Server error" })
        }
    })

    /**
     * GET /moderations
     * List moderations, newest year first. If role=marker, hide rows where hidden_from_markers = true.
     * Returns `due_date` (no `deadline_date` field in any response).
     */
    router.get("/moderations", async (req, res) => {
        const { role } = req.query

        try {
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
                return res.json({ moderations: getDemoModerations(role) })
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
                    upload_date: module.upload_date,
                    description: module.description,
                    hidden_from_markers: module.hidden_from_markers,
                    assignment_public_url: assignmentPublicUrl,
                    rubric_public_url: rubricPublicUrl,
                    rubric: module.rubric_json
                }
            })

            if (moderations.length === 0) {
                const fallbackModerations = getDemoModerations(role)
                if (fallbackModerations.length > 0) {
                    return res.json({ moderations: fallbackModerations })
                }
            }

            return res.json({ moderations })
        } catch (err) {
            console.error("Failed to fetch modules:", err)
            return res.json({ moderations: getDemoModerations(role) })
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
