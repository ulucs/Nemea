var waitlist = require('waitlist');
var EventEmitter = require('events').EventEmitter;
var app = require('express')();
var server = require('http').createServer(app);
var io = require('socket.io')(server);

var ws = waitlist();

var userHasKey = {};

// repeat as many times as needed for user functions
var resourceAmount = 2;

for (var i = 0; i < resourceAmount ; i++) {
    ws.add('Resource'+i, { id : i });
};

// serve the waiting page

app.get('/', function(req, res){
  res.sendfile('index.html');
});

// allow access to inside or use proxy to reach an outer service

app.get('/main', function(req,res){
    var userId = req.query.uid;
    if (userHasKey[userId]) {
        // send your main web page here
        res.send('You\'re in!!');
    } else {
        res.send('Illegal entry point!');
    }
});

// the magic happens here

// enter the queue on connection
io.on('connection', function(socket){
    var tempId = socket.id;
    userHasKey[tempId] = false;
    var em = new EventEmitter;

    // queue entrance and moving forward event
    em.on('spot', function (n) {
        console.log('user ' + tempId + ' in spot ' + n);
        io.to(tempId).emit('new',n)
    });
    
    // resource usage event
    em.on('available', function (res) {
        console.log('user ' + tempId
            + ' using resource ' + JSON.stringify(res)
        );
        // send user id info here
        io.to(tempId).emit('foo',{uid : tempId});
        userHasKey[tempId] = true;
    });
    
    // timeout or disconnection event
    em.on('release', function () {
        console.log('user ' + tempId + ' expired');
        io.to(tempId).emit('bar');
        userHasKey[tempId] = false;
    });
    
    // allotted time is the time user is allowed to use resource
    var allottedTime = 30 * 1000;

    var token = ws.acquire(allottedTime, em.emit.bind(em));

    // release spot on disconnection
    socket.on('disconnect', function(){
        console.log('user ' + tempId +' disconnected');
        ws.release(token);
    });
});

server.listen(3000);