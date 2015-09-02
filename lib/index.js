"use strict";

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; desc = parent = getter = undefined; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Q = require('q'),
    Request = require('request'),
    _ = require('lodash'),
    url = require('url'),
    WebSocket = require('ws'),
    EventEmitter = require('events'),
    util = require('util');

var SlackRTMClient = (function (_EventEmitter) {
  _inherits(SlackRTMClient, _EventEmitter);

  function SlackRTMClient(apiToken, options) {
    _classCallCheck(this, SlackRTMClient);

    _get(Object.getPrototypeOf(SlackRTMClient.prototype), 'constructor', this).call(this);
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

  _createClass(SlackRTMClient, [{
    key: 'startSocketConnection',
    value: function startSocketConnection(cb) {
      var deferred = Q.defer();
      if (this.socket == null || this.socket.readyState != this.socket.OPEN) {
        this._startRTM().then((function (data) {

          var err = data.err;
          var response = data.response;
          var body = data.body;

          if (cb) {
            cb(err, response, body);
          }
          if (err !== null) {
            deferred.reject(new Error(err));
          } else {
            this.channels = body.channels;
            this.groups = body.groups;
            this.users = body.users;
            this._setSocketConnection(body.url);
            deferred.resolve(err, response, body);
          }
        }).bind(this));
      } else {
        process.nextTick((function () {
          deferred.resolve(null, {}, {});
        }).bind(this));
      }

      return deferred.promise;
    }
  }, {
    key: 'sendMessage',
    value: function sendMessage(message, channel, cb) {
      this._sendToSlack({ "id": this.messageCounter, "type": "message", "text": message, "channel": channel });
    }
  }, {
    key: '_onMessage',
    value: function _onMessage(data, flags) {
      this.emit('messageReceived', data);
    }
  }, {
    key: '_startRTM',
    value: function _startRTM() {
      console.log('startRTM called');
      return this._performHttpRequest('rtm.start');
    }
  }, {
    key: '_performHttpRequest',
    value: function _performHttpRequest(apiCall, method, params, cb) {
      var deferred = Q.defer();
      var apiCallUrl = url.parse(this.baseUrl + '/' + apiCall);

      Request({ json: true, url: apiCallUrl, qs: _.extend({ "token": this.apiToken }, params) }, (function (error, response, body) {

        var err = null;
        if (error) {
          err = { error: 'There was an error performing the request' };
        }
        if (typeof body === "undefined" || body['ok'] == false) {
          err = { error: "Error performing http request" };
        };

        // if a callback is provided, call it
        if (cb) {
          cb(err, response, body);
        }

        // promise
        if (err !== null) {
          deferred.reject(new Error(err));
        } else {
          deferred.resolve({ err: err, response: response, body: body });
        }
      }).bind(this)); // request end

      return deferred.promise;
    }
  }, {
    key: '_sendToSlack',
    value: function _sendToSlack(data) {
      var send = (function () {
        this.messageCounter++;
        var res = this.socket.send(JSON.stringify(data));
      }).bind(this);

      if (this.socket == null || this.socket.readyState != this.socket.OPEN) {
        // Enqueued data will be send as soon as the connection is open
        this._enqueueDataToSend(data);
        this.startSocketConnection();
      } else {
        send(data);
      };
    }
  }, {
    key: '_enqueueDataToSend',
    value: function _enqueueDataToSend(data) {
      this.enqueuedSends.push(data);
    }
  }, {
    key: '_setSocketConnection',
    value: function _setSocketConnection(url) {
      this.socket = new WebSocket(url);

      // Attach event handlers
      this.socket.on('message', _.bind(this._onMessage, this));
      this.socket.on('open', _.bind(this._onConnectionOpen, this));
      this.socket.on('close', _.bind(this._onConnectionClose, this));

      this.socket.open();
    }
  }, {
    key: '_onConnectionOpen',
    value: function _onConnectionOpen() {
      this.emit('connectionOpen');
      _.each(this.enqueuedSends, (function (data) {
        var sendFunction = _.bind(this._sendToSlack, this, data);
        process.nextTick(sendFunction);
      }).bind(this));
      this.enqueuedSends = [];
    }
  }, {
    key: '_onConnectionClose',
    value: function _onConnectionClose() {
      this.emit('connectionClosed');
      this.messageCounter = 0;
    }
  }]);

  return SlackRTMClient;
})(EventEmitter);

module.exports = SlackRTMClient;