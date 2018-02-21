const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'videocrawler'});
const dotenv = require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');

// cfenv provides access to your Cloud Foundry environment
let cfenv = require('cfenv');

// create a new express server
let app = express();
app.use(bodyParser.json()); // support json encoded bodies
app.use(function(req, res, next) { //CORS support
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

// serve the files out of ./public as our main files
app.use(express.static(__dirname + '/public'));

// get the app environment from Cloud Foundry
let appEnv = cfenv.getAppEnv();

// Metrics Router
let discoveryRouter = express.Router();
discoveryRouter.post('/', function(req, res) {

    // obtem parametros da consulta
    let text = req.body.text;
    let type = req.body.type;

    // faz query no discovery
    const username= process.env.DISCOVERY_USERNAME;
    const password= process.env.DISCOVERY_PASSWORD;
    const environment = process.env.DISCOVERY_ENVIRONMENT;
    const collection = process.env.DISCOVERY_COLLECTION;
    const url = 'https://'+ username + ':' + password +'@gateway.watsonplatform.net/discovery/api/v1/environments/' +
                environment +'/collections/' +
                collection +'/query?version=2017-11-07&highlight=false&passages=false&query=enriched_text.entities%3A%3A%28text%3A%3A%22' +
                encodeURIComponent(text) +'%22%2Ctype%3A%3A%22' +
                type +'%22%29' +
                '&return=etag,snippet';
    request(url, { json: true }, (err, response, body) => {
               if (err) {
                 log.error(err);
                 res.status(500).json({error: err});
               } else {
                 let resultado = [];
                 if ((body) && (body.results)) resultado = body.results;
                 res.json(resultado);
              }
            });
});
app.use("/discovery", discoveryRouter);

// start server on the specified port and binding host
app.listen(appEnv.port, '0.0.0.0', function() {
  log.info("server starting on " + appEnv.url);
});
