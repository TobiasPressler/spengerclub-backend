const https = require('https');
const authData = require('../auth.json');

const reqQueue = [];
var sessToken;
var authenticating = false;

function sendRequest(method, callback, parameters) {
    const reqObj = {
        isAuth: false,
        method,
        parameters
    }

    var cb = (error, data) => {
        if (error && (data.code == -8500 || data.code == -8520)) {
            reqObj.callback = callback;
            reqQueue.push(reqObj);

            if (authenticating) {
                return;
            }

            authenticating = true;

            sendRequest_({
                isAuth: true,
                callback: (error_, data_) => {
                    if (error_) {
                        console.error('Failed to authenticate: ' + data_.message);
                        process.exit();
                    } else {
                        sessToken = data_.sessionId;
                        authenticating = false;

                        for (var i = 0; i < reqQueue.length; i++) {
                            var curr = reqQueue[i];
                            sendRequest_(curr);
                        }

                        reqQueue.length = 0;
                    }
                }
            });
        } else {
            callback(error, data);
        }
    }

    reqObj.callback = cb;

    sendRequest_(reqObj)
}

function sendRequest_(reqObj) {
    const { isAuth, callback, method, parameters } = reqObj;

    var options = {
        hostname: authData.servername + '.webuntis.com',
        path: '/WebUntis/jsonrpc.do?' + (isAuth ? 'school=' + authData.school : ''), // 'school=' + authData.school +  '&jsessionid=' + sessToken
        port: 443,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie' : 'JSESSIONID=' + sessToken,
            'Cache-Control': 'private, no-cache, no-store, must-revalidate',
            'Expires': '-1',
            'Pragma': 'no-cache'
        }
    };

    var req = https.request(options, function(res) {
    	if(res.statusCode != 200){
    		callback(true, res.statusCode);
    		return;
    	}

        res.setEncoding('utf8');

        var data = '';

        res.on('data', function(chunk) {
            data += chunk;
        });

        res.on('end', function() {
            data = JSON.parse(data);

            callback(data.result === undefined, data.result === undefined ? data.error : data.result);
        });
    });

    var body = {
        id: 'ID',
        method,
        jsonrpc: '2.0',
        params: parameters
    };

    if (!parameters) delete body.params;

    if (isAuth) {
        body.method = 'authenticate';
        body.params = {
            user: authData.username,
            password: authData.password,
            client: 'CLIENT'
        }
    }

    // console.log('--- REQUEST DATA START ---');
    // console.log(body);
    // console.log(options.hostname);
    // console.log(options.path);
    // console.log('--- REQUEST DATA END ---');

    req.end(JSON.stringify(body));
}

function logout() {
     sendRequest('logout', (error, data) => {
        process.exit();
    });
}

process.on('exit', logout);
process.on('SIGINT', logout);

module.exports = {
    sendRequest
}