import express from "express";
import cors from "cors";
import multer from "multer";
import {v4 as uuidv4} from "uuid"
import path from "path"
import fs from "fs"
import {Queue} from "bullmq"
import { S3Client,PutObjectCommand } from "@aws-sdk/client-s3"
import dotenv from "dotenv"

dotenv.config()


const app = express()

const videoQueue = new Queue('video-processing-queue',{
    connection:{
        host : "127.0.0.1",
        port:6379
    }
})

const s3Client = new S3Client({
    region : process.env.AWS_REGION,
    credentials: {
        accessKeyId : process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
})

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

app.use(express.json())
app.use(express.urlencoded({extended: true}))
app.use("/uploads",express.static("uploads"))

app.get("/", function(req,res){
    res.json({message: "Hello Mayank"})
})

app.post("/upload", upload.single('file'), async function(req,res){
    console.log("File uploaded locally :", req.file.path)
    const lessonId = uuidv4()
    const videoPath = req.file.path
    const outputPath = `./uploads/courses/${lessonId}`
    // const hlspath = `${outputPath}/index.m3u8`
    const filename = `courses/${lessonId}/raw-video${path.extname(req.file.originalname)}`
    // const s3HlsFolder = `hls/${lessonId}`

    // console.log("Processing video:", videoPath);

    if(!fs.existsSync(outputPath)){
         fs.mkdirSync(outputPath,{recursive:true})
    }

    const fileStream = fs.createReadStream(videoPath)
    const uploadParams = {
        Bucket : process.env.AWS_BUCKET_NAME,
        Key: filename,
        Body: fileStream,
        ContentType : req.file.mimetype
    }
    try{
        console.log("Uploading to S3...")
        await s3Client.send(new PutObjectCommand(uploadParams))
        console.log("Successfully uploaded raw video to S3")

        await videoQueue.add('process-video',{
            lessonId:lessonId,
            videoPath:videoPath,
            outputPath:outputPath,
            filename:filename
        })
         
      res.json({
            message: "Video upload received. Processing started in background.",
            lessonId: lessonId
        });
    }catch(err){
        console.error("Error:", err)
        res.status(500).json({error : "Upload Failed"});
    }
})

app.listen(4003,()=>{
    console.log("app is running on port 4003")
})