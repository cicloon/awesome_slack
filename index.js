"use strict";

let Q        = require('q'),
    Request  = require('request'),
    _        = require('lodash'),
    url      = require('url'),
    WebSocket = require('ws');


class SlackRTMClient{

  constructor(apiToken, options){
    this.options = _.extend({}, options);
    this.apiToken = apiToken;
    this.baseUrl = "https://slack.com/api";
    this.socket = null;
    this.users = [];
    this.channels = [];
    this.groups = [];
    this.messageCounter = 0;
    this.enqueuedSends = [];
  }

  startSocketConnection(cb){
    let deferred = Q.defer();
    this._startRTM().then( function(data){

      let err = data.err;
      let response = data.response;
      let body = data.body;

      if(cb){ cb(err, response, body);}
      if(err !== null){
        deferred.reject(new Error(err));
      } else{
        this.channels = body.channels;
        this.groups = body.groups;
        this._setSocketConnection(body.url);
        deferred.resolve(err, response, body);
      }
    }.bind(this) )

    return deferred.promise;
  }

  sendMessage(message, channel, cb){
    this._sendToSlack( {"id": this.messageCounter, "type": "message", "text": message, "channel": channel});
  }

  _onMessage(data, flags){
    console.log('message received');
    if( typeof this.options['onMessage'] != "undefined"){
      this.options['onMessage'](data);
    }
  }

  _startRTM(){
    console.log('startRTM called');
    return this._performHttpRequest('rtm.start');
  }

  _performHttpRequest(apiCall, method, params, cb){
    let deferred = Q.defer();
    let apiCallUrl = url.parse(`${this.baseUrl}/${apiCall}`);
    console.log(`performing http request to ${apiCallUrl}`);
    Request( { json:true, url:  apiCallUrl, qs: _.extend({ "token": this.apiToken }, params)},
      function(error, response, body){

        console.log("request resolved")
        console.log(error != null)
        console.log(response != null)
        console.log(body != null)

        // console.log(error);
        // console.log(response);
        // console.log(body);

        let err = null;
        if(error){ err = {error: 'There was an error performing the request'}; }
        if (body['ok'] == false){ err = {error: body['error']}  };

        // if a callback is provided, call it
        if( cb ){cb(err, response, body);}

        // promise
        if( err !== null ) {
          deferred.reject(new Error(err));
        } else {
          console.log("resolve promise")
          console.log(response);
          deferred.resolve({err: err, response: response, body: body});
        }
      }.bind(this)
    ) // request end

    return deferred.promise;
  }

  _sendToSlack(data){
    let send = function(){
      console.log('sending data through socket');
      console.log(data);
      this.messageCounter++;
      let res = this.socket.send( JSON.stringify(data) );
      console.log('data sent');
    }.bind(this);

    if (this.socket == null || this.socket.readyState != this.socket.OPEN ){
      // Enqueued data will be send as soon as the connection is open
      this._enqueueDataToSend(data);
      this.startSocketConnection();
    } else {
      send(data)
    };
  }

  _enqueueDataToSend(data){
    this.enqueuedSends.push(data);
  }

  _setSocketConnection(url){
    this.socket = new WebSocket(url);

    // Attach event handlers
    this.socket.on('message', _.bind( this._onMessage, this ) )
    this.socket.on('open', _.bind( this._onConnectionOpen, this) );
    this.socket.on('close', _.bind( this._onConnectionClose, this) );

    this.socket.open();
  }

  _onConnectionOpen(){
    console.log('socket open');
    _.each( this.enqueuedSends, function(data){
      let sendFunction = _.bind(this._sendToSlack,this, data);
      process.nextTick(sendFunction);
    }.bind(this))
    this.enqueuedSends = [];
  };

  _onConnectionClose(){
    console.log('socket closed');
    this.messageCounter = 0;
  };
}

module.exports = SlackRTMClient;
