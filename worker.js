import {Worker} from "bullmq"
import { exec } from "child_process"
import path from "path"
import fs from "fs"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import dotenv from "dotenv"

dotenv.config()

const s3Client = new S3Client({
    region:process.env.AWS_REGION,
    credentials:{
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
})

async function uploadHLSFolder(s3Client, bucketName, localFolder, s3Folder){
    const files = fs.readdirSync(localFolder)

    const uploadPromises = files.map(async (file)=>{
        const filePath = path.join(localFolder, file)
        const fileStream = fs.createReadStream(filePath)

        let contentType = "application/octet-stream";
        if(file.endsWith(".m3u8")) contentType = "application/x-mpegURL"
        if(file.endsWith(".ts")) contentType = "video/MP2T"

        const params = {
            Bucket: bucketName,
            Key:`${s3Folder}/${file}`,
            Body: fileStream,
            ContentType: contentType
        }

        await s3Client.send(new PutObjectCommand(params))
        console.log(`Uploaded ${file}`);
    })
    await Promise.all(uploadPromises);
}

const worker = new Worker('video-processing-queue', async(job)=>{
    console.log(`Job ${job.id} started. Processing lesson: ${job.data.lessonId}`)

    const {videoPath, outputPath, lessonId} = job.data
    const hlspath = `${outputPath}/index.m3u8`
    const s3HlsFolder = `hls/${lessonId}`

    if(!fs.existsSync(outputPath)){
             fs.mkdirSync(outputPath,{recursive:true})
        }
    const ffmpegCommand = `ffmpeg -i ${videoPath} -codec:v libx264 -codec:a aac -hls_time 10 -hls_playlist_type vod -hls_segment_filename "${outputPath}/segment%03d.ts" -start_number 0 ${hlspath}`;

    return new Promise((resolve, reject)=>{
       exec(ffmpegCommand, async(error, stdout, stderr)=>{
        if(error){
            console.error(`FFmpeg error: ${error}`)
            reject(error)
            return
        }
        console.log("FFmpeg finished. Uploading HLS to S3...")
        try{
            await uploadHLSFolder(s3Client, process.env.AWS_BUCKET_NAME, outputPath, s3HlsFolder)
            console.log("HLS uploaded successfully !!")

            fs.unlinkSync(videoPath);
            fs.rmSync(outputPath, {recursive: true, force:true})

            console.log(`Job ${job.id} completed`);
            resolve()
        }catch(err){
            console.error("S3 upload failed:", err)
            reject(err)
        }
       })
    })
},{
    connection:{
        host: "127.0.0.1",
        port:6379
    }
})

console.log("Worker is running and listening for jobs...")