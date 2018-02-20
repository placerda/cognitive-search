//initialization
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'videocrawler'});
const dotenv = require('dotenv').config();
const google = require('googleapis');
const Cloudant = require('cloudant');
const cloudant = Cloudant({url: process.env.CLOUDANT_URL});
const db = cloudant.db.use(process.env.CLOUDANT_DB_NAME);
const Storage = require("@google-cloud/storage");
var Discovery = require('watson-developer-cloud/discovery/v1');

function getProcessedVideos() { // obtém a lista de vídeos que já foi processada
  return new Promise(function(resolve, reject){
    db.find({selector:{"resourceId.kind":"youtube#video"}}, function(er, result) {
      if (er) return reject(er);
      resolve(result.docs);
    });
  });
}

// faz um "reset", removendo documentos do db, discovery e arquivos do storage
async function main () {

  // remove todos objetos do bucket
  log.info("Reset Storage");
  const storage = new Storage();
  const bucketName = process.env.CLOUD_BUCKET;
  await storage
  .bucket(bucketName)
  .getFiles()
  .then(results => {
    const files = results[0];
    files.forEach(file => {
    storage
        .bucket(bucketName)
        .file(file.name)
        .delete()
        .then(() => {
          log.info(file.name, ":: removendo do storage");
        })
        .catch(err => {
          console.error('ERROR:', err);
        });
    });
  })
  .catch(err => {
    console.error('ERROR:', err);
  });

  // limpando discovery
  log.info("Reset Discovery");
  var discovery = new Discovery({
    username: process.env.DISCOVERY_USERNAME,
    password: process.env.DISCOVERY_PASSWORD,
    version_date: '2017-11-07'
  });

  let docs = await new Promise(function(resolve, reject){
        discovery.query({ environment_id: process.env.DISCOVERY_ENVIRONMENT,
                          collection_id: process.env.DISCOVERY_COLLECTION,
                          query: 'query?version=2017-11-07&count=100&deduplicate=false&query=snippet.resourceId.videoId%3A%3A%21%22null%22',
                          'return': 'id,snippet.resourceId.videoId'
                   }, function(error, data) {
                      resolve(data.results);
                   });
        });

   for (doc of docs){
     log.info(doc);
     log.info(doc.snippet.resourceId.videoId, ":: removendo do discovery");
     await new Promise(function(resolve, reject){
       discovery.deleteDocument({ environment_id: process.env.DISCOVERY_ENVIRONMENT,
                                  collection_id: process.env.DISCOVERY_COLLECTION,
                                  document_id: doc.id }, function(error, data) {
                                     if (error) log.error(error);
                                     log.info(doc.snippet.resourceId.videoId, ":: removeu do discovery");
                                     resolve(data);
                                   });
     });
   }


   // cloudant
   log.info("Reset Cloudant");
   let dbdocs = await new Promise(function(resolve, reject){
     db.find({selector:{"snippet.resourceId.kind":"youtube#video"}}, function(er, result) {
       if (er) return reject(er);
       resolve(result.docs);
     });
   });
   for (doc of dbdocs){
      await new Promise(function(resolve, reject){
          db.destroy(doc._id, doc._rev, function(err, data){
            if (err) log.error(err);
            log.info(doc._id, ":: removendo do db");
            resolve(data);
          });
      });
   }
}

main();
