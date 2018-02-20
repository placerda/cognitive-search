//initialization
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'videocrawler'});
const dotenv = require('dotenv').config();
const google = require('googleapis');
const youtube = google.youtube({version: 'v3', auth: process.env.YOUTUBE_KEY});
const playlistid = process.env.PLAYLIST_ID;
const Storage = require("@google-cloud/storage");
const speech = require('@google-cloud/speech');
const fs = require('fs');
var Discovery = require('watson-developer-cloud/discovery/v1');


function getVideos() { // obtém vídeos da playlist no youtube
  const parameters= { 'maxResults': '50',
                      'part': 'snippet',
                      'playlistId': playlistid };
  return new Promise(function(resolve, reject){
    youtube.playlistItems.list(parameters, function(err, result) {
      if (err) return reject(err);
      const youtubeList = result.data.items.map(item => {
        let newItem = item.snippet;
        newItem._id = item.snippet.resourceId.videoId;
        return newItem;
      });
      resolve(youtubeList);
    });
  });
}

function extractAudio(videoid){
  return new Promise(function(resolve,reject){

    const fs = require('fs');
    const ytdl = require('ytdl-core');
    const ffmpeg = require('fluent-ffmpeg');
    const reader = ytdl("http://www.youtube.com/watch?v="+videoid, {filter: "audioonly", audioFormat: "ogg"});
    const writer = ffmpeg(reader)
      .format("flac")
      .outputOptions('-bits_per_raw_sample 16')
      .outputOptions('-ar 16000')
      .duration(300)
      .outputOptions('-ac 1');
    const storage = new Storage({projectId: process.env.GOOGLE_PROJECT_ID});
    const bucket = storage.bucket(process.env.CLOUD_BUCKET);
    const file = bucket.file(videoid + ".flac");
    const stream = file.createWriteStream({
    metadata: {
        contentType: 'audio/flac'
      }
    });

    writer.output(stream).run();

    stream.on('error', (err) => {
      log.error(err);
      reject(err);
    });

    stream.on('finish', () => {
      log.info(videoid, ":: áudio extraido");
      resolve();
    });

  });

}

function transcribe (videoid){
  return new Promise(function(resolve, reject){

    const client = new speech.SpeechClient();
    const gcsUri = 'gs://' + process.env.CLOUD_BUCKET + '/' + videoid + '.flac';
    const encoding = 'FLAC';
    const sampleRateHertz = 16000;
    const languageCode = 'pt-BR';
    const config = {
      encoding: encoding,
      sampleRateHertz: sampleRateHertz,
      languageCode: languageCode,
    };
    const audio = {
      uri: gcsUri,
    };
    const request = {
      config: config,
      audio: audio,
    };
     client.longRunningRecognize(request).then(responses => {

         var operation = responses[0];
         var initialApiResponse = responses[1];

        operation.on('complete', (result, metadata, finalApiResponse) => {
           log.info(videoid, ":: concluiu transcrição");
           resolve(result);
         });

         operation.on('progress', (metadata, apiResponse) => {
          log.info(videoid, ":: transcrevendo");
           if (apiResponse.done){
             log.info(videoid, ":: sem transcrição");
             resolve(undefined);
           }
         });

         operation.on('error', err => {
           reject(err);
         });

       })
       .catch(err => {
         log.error(err);
         reject(err);
       });

  });
}

async function main(){
  try {
    log.info("main");
     let items = await getVideos();

     // processa cada item novo
     for (let item of items){
          log.info(item._id, ":: processamento iniciado");

          // extrai o áudio e manda para o object storage
          await extractAudio(item._id);

          // realiza transcrição com o stt
          let stt_result = await transcribe(item._id);

          if (stt_result){

             let transcricao = stt_result.results[0].alternatives[0].transcript;

             // log.info(item._id, ":: transcrição:",transcricao);
             let text = transcricao;

             // grava arquivo
             await new Promise (function(resolve, reject){
              fs.writeFile('./sandbox/files/' + item._id + '.txt', text, (err) => {
                  if (err) reject(err);
                  log.info(item._id,":: arquivo foi gerado");
                  resolve();
                });
            });

            // todo: apaga arquivo no object storage

           }
     }

   } catch(err) {
     log.error(err);
   }
}

main();
