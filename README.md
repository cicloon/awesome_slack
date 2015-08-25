Awesome Slack
-------------

Minimalist wrapper for the Slack RTM API.

Work in progress.

To give it a try from an iojs console:

```

slackClient = new AwesomeSlack('your api token');

slackClient.on('connectionOpen', function(){
  console.log('connection with Slack ready');
});
slackClient.on('messageReceived', function(messageData){
  console.log("Received: " + messageData);
});

slackClient.sendMessage('hello world', 'channel or group id')
```
