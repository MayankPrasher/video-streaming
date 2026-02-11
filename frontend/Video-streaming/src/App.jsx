import './App.css'
import VideoPlayer from './VideoPlayer'
import {useRef} from 'react'
import videojs from 'video.js'

function App() {
  const playerRef = useRef(null)
  const videoLink = "http://localhost:4003/uploads/courses/8d41c9df-2f45-4915-bd68-2fffd3fe9976/index.m3u8"

  const videoPlayerOptions = {
    controls : true,
    responsive : true,
    fluid : true,
    sources: [
      {src: videoLink,
       type: "application/x-mpegURL"
      }
    ]
  }
  const handlePlayerReady = (player)=>{
    playerRef.current = player;

    player.on("waiting",()=>{
      videojs.log("player is waiting");
    });
    player.on("dispose",()=>{
      videojs.log("player will dispose");
    });
  }
  return (
   <>
   <div>
    <h1>Video Player</h1>
   </div>
   <VideoPlayer
   options={videoPlayerOptions}
   onReady={handlePlayerReady}/>
    </>
  )
}

export default App
