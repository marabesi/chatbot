"use strict"

require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const request = require('request');
const apiai = require('apiai');
const apiaiApp = apiai(process.env.API_AI);
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  console.log(req);

  if (req.query['hub.mode'] && req.query['hub.verify_token'] === 'tuxedo_cat') {
    res.status(200).send(req.query['hub.challenge']);
  } else {
    res.status(403).end();
  }
});

app.post('/', (req, res) => {
  console.log(req.body);
  
  if (req.body.object === 'page') {
    req.body.entry.forEach((entry) => {
      entry.messaging.forEach((event) => {
        if (event.message && event.message.text) {
          sendMessage(event);
        }
      });
    });
  }

  res.status(200).end();
});

app.post('/ai', (req, res) => {
  if (req.body.result.action === 'weather') {
    let city = req.body.result.parameters['geo-city'];
    let restUrl = 'http://api.openweathermap.org/data/2.5/weather?APPID=' + WEATHER_API_KEY + '&q=' + city;

    console.log(city);
    console.log(restUrl);

    request.get(restUrl, (err, response, body) => {
      if (!err && response.statusCode == 200) {
        let json = JSON.parse(body);
        let msg = json.weather[0].description + ' and the temperature is ' + json.main.temp + ' ℉';
        
        return res.json({
          speech: msg,
          displayText: msg,
          source: 'weather'});
      } else {
        return res.status(400).json({
          status: {
            code: 400,
            errorType: 'I failed to look up the city name.'}});
      }})
  }
});

function sendMessage(event) {
  let sender = event.sender.id;
  let text = event.message.text;

  let apiai = apiaiApp.textRequest(text, {
      sessionId: 'marabesi_bot'
    });

    apiai.on('response', (response) => {
      let aiText = response.result.fulfillment.speech;

      request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: PAGE_ACCESS_TOKEN},
        method: 'POST',
        json: {
          recipient: {id: sender},
          message: {text: aiText}
        }
      }, (error, response) => {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }
      });
    });

    apiai.on('error', (error) => {
      console.log(error);
    });

    apiai.end();
}

const server = app.listen(process.env.PORT || 5000, () => {
  console.log('Express server listening on port %d in %s mode', server.address().port, app.settings.env);
});