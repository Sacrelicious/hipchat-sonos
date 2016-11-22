'use strict';
var AWS = require("aws-sdk");
var jwtDecode = require('jwt-decode');

AWS.config.update({region: "us-east-1"});
const songsTableName = 'Songs';

module.exports.hello = (event, context, callback) => {
  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Go Serverless v1.0! Your function executed successfully!',
      input: event,
    }),
  };

  callback(null, response);

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // callback(null, { message: 'Go Serverless v1.0! Your function executed successfully!', event });
};

module.exports.addPlayedSong = (event, context, callback) => {
  var dynamo = new AWS.DynamoDB.DocumentClient();
  var body = JSON.parse(event.body);

  var dynamoResponse;
  // Basic Callback
  var pfunc = function(err, data) {
      if (err) {
          context.fail(err);
      } else {
          context.succeed('Successfully Added');
      }
  };
  var datetime = new Date().getTime();
  var request = {
    'TableName' : songsTableName,
    'Item':{
      'SonosName': body.SonosName,
      'Timestamp':Number(datetime),
      'Title':body.Title,
      'Artist':body.Artist,
      'Album':body.Album,
      'AlbumArt':body.AlbumArt
    }
  };

  dynamo.put(request, pfunc);

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // callback(null, { message: 'Go Serverless v1.0! Your function executed successfully!', event });
};


module.exports.getSongList = (event, context, callback) => {
  var dynamo = new AWS.DynamoDB.DocumentClient();

  var dynamoResponse;
  // Basic Callback
  var pfunc = function(err, data) {
      if (err) {
          context.fail(err);
      } else {
          callback(null, data);
          context.succeed();
      }
  };

  GetSongs(dynamo, event.body.SonosName, event.body.Limit || 10, pfunc);

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // callback(null, { message: 'Go Serverless v1.0! Your function executed successfully!', event });
};

module.exports.apiListener = (event, context, callback) => {
  var body = JSON.parse(event.body);

  if(body.data.state.playbackState != 'PLAYING'){
    callback(null, {message: 'Sonos not playing so skipping update', event});
    context.succeed();
  }

  var dynamo = new AWS.DynamoDB.DocumentClient();

  // Basic Callback
  var pfunc = function(err, data) {
      if (err) {
          context.fail(err);
      } else {
          callback(null, {message: 'Successfully Added', event});
          context.succeed();
      }
  };

  var datetime = new Date().getTime();
  var request = {
    'TableName' : songsTableName,
    'Item':{
      'SonosName': body.data.roomName,
      'Timestamp':Number(datetime),
      'Title':body.data.state.currentTrack.title,
      'Artist':body.data.state.currentTrack.artist,
      'Album':body.data.state.currentTrack.album,
      'AlbumArt':body.data.state.currentTrack.albumArtUri
    }
  };

  dynamo.put(request, pfunc);

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
   // callback(null, { message: 'Go Serverless v1.0! Your function executed successfully!', event });
};

function GetSongs(dynamo, name, limit, pfunc) {
  var request = {
    'TableName' : songsTableName,
    'KeyConditionExpression': "SonosName = :sonos",
    'ExpressionAttributeValues': {
      ':sonos': name
    },
    'Limit' : limit,
    'ScanIndexForward':'false'
  };

  dynamo.query(request, pfunc);
}
