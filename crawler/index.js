//initialization
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'videocrawler'});
const dotenv = require('dotenv').config();
const google = require('googleapis');
const youtube = google.youtube({version: 'v3', auth: process.env.YOUTUBE_KEY});
const playlistid = process.env.PLAYLIST_ID;
const Cloudant = require('cloudant');
const cloudant = Cloudant({url: process.env.CLOUDANT_URL});
const db = cloudant.db.use(process.env.CLOUDANT_DB_NAME);
const Storage = require("@google-cloud/storage");
const speech = require('@google-cloud/speech');
var Discovery = require('watson-developer-cloud/discovery/v1');


function getVideos() { // obtém vídeos da playlist no youtube
  const parameters= { 'maxResults': '50',
                      'part': 'snippet',
                      'playlistId': playlistid };
  return new Promise(function(resolve, reject){
    youtube.playlistItems.list(parameters, function(err, result) {
      if (err) return reject(err);
      const youtubeList = result.data.items.map(item => {
        //let newItem = item.snippet;
        let newItem = item;
        newItem._id = item.snippet.resourceId.videoId;
        return newItem;
      });
      resolve(youtubeList);
    });
  });
}

function getProcessedVideos() { // obtém a lista de vídeos que já foi processada
  return new Promise(function(resolve, reject){
    db.find({selector:{"snippet.resourceId.kind":"youtube#video"}}, function(er, result) {
      if (er) return reject(er);
      resolve(result.docs);
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

function uploadToDiscovery(documento){
  return new Promise(function(resolve, reject){
    // const fs = require('fs');
    var discovery = new Discovery({
      username: process.env.DISCOVERY_USERNAME,
      password: process.env.DISCOVERY_PASSWORD,
      version_date: '2017-11-07'
    });
    // var file = fs.readFileSync('{/path/to/file}');
    discovery.addJsonDocument({ environment_id: process.env.DISCOVERY_ENVIRONMENT,
                                collection_id: process.env.DISCOVERY_COLLECTION,
                                file: documento },
    (error, data) => {
      if (error) return reject(error);
      log.info(documento._id, ":: enviado para discovery");
      resolve(data);
    });
  });
}

function saveProcessedVideo(documento) {
    return new Promise(function(resolve, reject){
      db.insert(documento, function(err, data){
        if (err) return reject(err);
        log.info(documento._id, ":: gravando no db");
        documento._rev = data.rev;
        resolve(data);
      });
    });
}

async function main(){
  try {
    log.info("loop");
     let youtubeList = await getVideos();
     log.info(youtubeList);
     let processedItems = await getProcessedVideos();
     log.info(processedItems);

     let newItems = [];
     // seleciona apenas os vídeos que ainda não foram processados
     for (let item of youtubeList){
        if (processedItems.find(video => video._id === item._id) === undefined){
          newItems.push(item);
          // insere no db para controle dos itens processados
           await saveProcessedVideo(item);
        }
    }
    log.info(newItems);

     // processa cada item novo
     for (let item of newItems){
          log.info(item._id, ":: processamento iniciado");

          // extrai o áudio e manda para o object storage
          await extractAudio(item._id);

          // realiza transcrição com o stt
          let stt_result = await transcribe(item._id);

          if (stt_result){
             let transcricao = stt_result.results[0].alternatives[0].transcript;
             // log.info(item._id, ":: transcrição:",transcricao);
             item.text = transcricao
             // envia para o discovery
             let discovery_doc = await uploadToDiscovery(item);

             // atualiza db para controle dos itens processados
             if (discovery_doc.document_id != undefined){
               item.discovery_id = discovery_doc.document_id;
               await saveProcessedVideo(item);
             }
           }
     }

   } catch(err) {
     log.error(err);
   }
}

setInterval(main, process.env.LOOP_INTERVAL);
