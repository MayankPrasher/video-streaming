import express from "express";
import cors from "cors";
import multer from "multer";
import {v4 as uuidv4} from "uuid"
import path from "path"
import fs from "fs"
import { exec } from "child_process"; 


const app = express()

const storage = multer.diskStorage({
    destination: function(req,file,cb){
        cb(null,"./uploads")
    },
    filename : function(req,file,cb){
        cb(null,file.fieldname + "-" + uuidv4() + path.extname(file.originalname))
    }
})

const upload = multer({storage:storage})
app.use(
    cors({
        origin: ["http://localhost:5173"], 
        credentials:true
    })
)
app.use((req,res,next)=>{
    res.header("Access-Control-Allow-origin","*") //could remove
    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
    );
    next()
})

app.use(express.json())
app.use(express.urlencoded({extended: true}))
app.use("/uploads",express.static("uploads"))

app.get("/", function(req,res){
    res.json({message: "Hello Mayank"})
})

app.post("/upload", upload.single('file'), function(req,res){
    const lessonId = uuidv4()
    const videoPath = req.file.path
    const outputPath = `./uploads/courses/${lessonId}`
    const hlspath = `${outputPath}/index.m3u8`
    console.log("hlsPath",hlspath)

    if(!fs.existsSync(outputPath)){
         fs.mkdirSync(outputPath,{recursive:true})
    }
    
    const ffmpegCommand = `ffmpeg -i ${videoPath} -codec:v libx264 -codec:a aac -hls_time 10 -hls_playlist_type vod -hls_segment_filename "${outputPath}/segment%03d.ts" -start_number 0 ${hlspath}`;
/////////Intentionally doing////////////////////
    exec(ffmpegCommand,(error, stdout, stderr)=>{
        if(error){
            console.log(`exec error: ${error}`)
        }
        console.log(`stdout: ${stdout}`)
        console.log(`stderr: ${stderr}`)
        const videoUrl = `http://localhost:4003/uploads/courses/${lessonId}/index.m3u8`;

        res.json({
            message: "Video converted to HLS format",
            videoUrl: videoUrl,
            lessonId :lessonId
        })
    })
})
app.listen(4003,()=>{
    console.log("app is running on port 4003")
})