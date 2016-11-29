'use strict';
var AWS = require("aws-sdk");
var jwtDecode = require('jwt-decode');
var requestor = require('request');

AWS.config.update({region: "us-east-1"});
const songsTableName = 'Songs';
const machinesTableName = 'Machines';
const hipchatApiRoot = 'https://api.hipchat.com/v2/';

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
    const response = {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Sonos not playing so skipping update',
        input: event,
      }),
    };
    callback(null, response);
  }

  var dynamo = new AWS.DynamoDB.DocumentClient();

  // Basic Callback
  var pfunc = function(err, data) {
      if (err) {
          context.fail(err);
      } else {
        const response = {
          statusCode: 200,
          body: JSON.stringify({
            message: 'Successfully Added',
            input: event,
          }),
        };
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

module.exports.getRoomGlance = (event, context, callback) => {
  var dynamo = new AWS.DynamoDB.DocumentClient();
  var dynamoResponse;

  var token = event.query.signed_request;

  var decoded = jwtDecode(token);

  // Basic Callback
  var pfunc = function(err, data) {
      if (err) {
          callback(err);
      } else {
        var songLabel =  data.Items[0].Artist + ' - ' +data.Items[0].Title;
        callback(null, {
        'label': {
          'type': 'html',
          'value': songLabel,
        },
        'metadata': {}
      });
      }
  };

  var getSonosFunc = function(err, data) {
    if(err){
      callback(err);
    } else{
      var request = {
        'TableName' : songsTableName,
        'KeyConditionExpression': "SonosName = :sonos",
        'ExpressionAttributeValues': {
          ':sonos': data.Item.SonosName
        },
        'Limit' : 1,
        'ScanIndexForward':'false'
      };

      dynamo.query(request, pfunc);
    }
  }

  var params = { };
  params.TableName = machinesTableName;
  var key = { 'RoomId': Number(decoded.context.room_id) };
  params.Key = key;
  dynamo.get(params, getSonosFunc);


  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // callback(null, { message: 'Go Serverless v1.0! Your function executed successfully!', event });
};

module.exports.roomGlancePush = (event, context, callback) => {
  var dynamo = new AWS.DynamoDB.DocumentClient();
  var dynamoResponse;

  event.Records.forEach(rec => {
    var item = rec.dynamodb.NewImage;
    var sonosName = item.SonosName.S;
    var request = {
            'TableName' : machinesTableName,
            'FilterExpression': "SonosName = :sonos",
            'ExpressionAttributeValues': {
              ':sonos': sonosName
            }
          };
          var songLabel =  item.Artist.S + ' - ' +item.Title.S;
          var glance =
            glance:[
          'label': {
            'type': 'html',
            'value': songLabel,
          },
          'metadata': {},
          'key':'glance'
        ]
      };
          dynamo.scan(request, function(err, data) {
            let roomIds = [];
            data.Items.forEach(item => {
              if(!roomIds[item]){
                roomIds.push(item);
              }
            });
            roomIds.forEach(r => {
              var post = requestor.post(hipchatApiRoot+'oauth/token', function (error, response, body) {
                // body is the decompressed response body
                var b = JSON.parse(body);
                var req = requestor.post(hipchatApiRoot+'addon/ui/room/'+r.RoomId, function (error, response, body) {
                  console.log(body);
                }
              )
                .auth(null, null, true, b.access_token)
                .json(glance)
                .on('error', function(err) {
                  console.log(err);
                });
              })
              .auth(r.OauthId, r.OauthSecret, true)
              .form({'grant_type': 'client_credentials'})
              .on('response', function(response) {
                console.log(response);
              })
              .on('error', function(err) {
                console.log(err);
              });

            });
          });
   });
//   // Use this code if you don't use the http event with the LAMBDA-PROXY integration
//   // callback(null, { message: 'Go Serverless v1.0! Your function executed successfully!', event });
 };

module.exports.associate = (event, context, callback) => {
  var dynamo = new AWS.DynamoDB.DocumentClient();
  var decoded = jwtDecode(event.body.jwt);
  console.log(decoded);
  var dynamoResponse;
  // Basic Callback
  var pfunc = function(err, data) {
      if (err) {
          context.fail(err);
      } else {
          context.succeed('Successfully Added');
      }
  };

  var params = {
    TableName:machinesTableName,
    Key:{
        'RoomId': decoded.context.roomId
    },
    UpdateExpression: "set SonosName = :n",
    ExpressionAttributeValues:{
        ":n":event.body.SonosName
    }
  }
  dynamo.update(params, pfunc);
  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  //callback(null, { message: 'Go Serverless v1.0! Your function executed successfully!', event });
};

module.exports.install = (event, context, callback) => {
  var dynamo = new AWS.DynamoDB.DocumentClient();
  console.log(event);
  var dynamoResponse;
  // Basic Callback
  var pfunc = function(err, data) {
      if (err) {
          context.fail(err);
      } else {
          context.succeed('Successfully Added');
      }
  };
  var params = {
    TableName:machinesTableName,
    Key:{
        'RoomId': event.body.roomId
    },
    UpdateExpression: "set OauthId = :i, OauthSecret=:s",
    ExpressionAttributeValues:{
        ":i":event.body.oauthId,
        ":s":event.body.oauthSecret
    }
  }
  dynamo.update(params, pfunc);
  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  //callback(null, { message: 'Go Serverless v1.0! Your function executed successfully!', event });
};

module.exports.machineNameForRoom = (event, context, callback) => {
  var dynamo = new AWS.DynamoDB.DocumentClient();
  console.log(event);
  var dynamoResponse;
  // Basic Callback
  var pfunc = function(err, data) {
      if (err) {
          context.fail(err);
      } else {
          context.succeed(data);
      }
  };
  var params = { }
  params.TableName = machinesTableName;
  var key = { 'RoomId': event.body.roomId };
  params.Key = key;
  dynamo.get(params, pfunc);
  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // callback(null, { message: 'Go Serverless v1.0! Your function executed successfully!', event });
};
