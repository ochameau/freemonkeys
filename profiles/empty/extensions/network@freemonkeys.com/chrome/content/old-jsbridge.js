

var uuidgen = Components.classes["@mozilla.org/uuid-generator;1"].getService(Components.interfaces.nsIUUIDGenerator);
function newUUID() {
  return uuidgen.generateUUID().toString();
}

var globalRegistry = {};

function Bridge (session) {
  this.session = session;
  this.registry = globalRegistry;
}
Bridge.prototype.returnEncoded = function (obj) {
  var response={type : typeof obj};
  
  if (typeof obj=="object") {
    var objectId=newUUID();
    this.registry[objectId]=obj;
    response.objectId=objectId;
    response.attributes={};
    for(var i in obj) {
      try {
      var type=typeof obj[i];
      response.attributes[i]={type:type,value:type!="object"&&type!="function"?obj[i]:null};
      } catch(e) {
        response.attributes[i]={type:"undefined",value:null};
      }
    }
  } else
    response.value = obj;
  return response;
}
Bridge.prototype.get = function (objStr) {
  
  var obj = eval("("+objStr+")");
  
  return this.returnEncoded(obj);
}
Bridge.prototype.execute = function (objectId, funName, args) {
  for(var i in args) {
    if (args[i].__uuid) {
      args[i]=this.registry[args[i].__uuid];
    }
  }
  var value = this.registry[objectId][funName].apply(this.registry[objectId],args);
  
  return this.returnEncoded(value);
}

Bridge.prototype.register = function (uuid, _type) {
  try {
    this._register(_type);
    var passed = true;
  } catch(e) {
    this.session.encodeOut({'result':false, 'exception':{'name':e.name, 'message':e.message}, 'uuid':uuid});
  }
  if (passed != undefined) {
    this.session.encodeOut({"result":true, 'eventType':'register', 'uuid':uuid});
  }
  
}
Bridge.prototype._describe = function (obj) {
  var response = {};
  var type = typeof(obj);
  if (type == "object") {
    if (obj.length != undefined) {
      var type = "array";
    }
    response.attributes = [];
    for (i in obj) {
      response.attributes = response.attributes.concat(i);
    }
  }
  else {
    response.data = obj;
  }
  response.type = type;
  return response;
}
Bridge.prototype.describe = function (uuid, obj) {
  var response = this._describe(obj);
  response.uuid = uuid;
  response.result = true;
  this.session.encodeOut(response);
}
Bridge.prototype._set = function (obj) {
  var uuid = uuidgen.generateUUID().toString();
  //dump("_set "+uuid+" = "+typeof obj+"-"+obj+"\n");
  this.registry[uuid] = obj;
  return uuid;
}
Bridge.prototype.set = function (uuid, obj) {
  var ruuid = this._set(obj);
  this.session.encodeOut({'result':true, 'data':'bridge.registry["'+ruuid+'"]', 'uuid':uuid});
}
Bridge.prototype._setAttribute = function (obj, name, value) {
  obj[name] = value;
  return value;
}
Bridge.prototype.setAttribute = function (uuid, obj, name, value) {
  // log(uuid, String(obj), name, String(value))
  try {
    var result = this._setAttribute(obj, name, value);
  } catch(e) {
    this.session.encodeOut({'result':false, 'exception':{'name':e.name, 'message':e.message}, 'uuid':uuid});
  }
  if (result != undefined) {
    this.set(uuid, obj[name]);
  }
}
Bridge.prototype._execFunction = function (func, obj, args) {
  return func.apply(obj, args);
}
Bridge.prototype.execFunction = function (uuid, func, obj, args) {
  var failed=false;
  try {
    var result = this._execFunction(func, obj, args);
    //dump("exec function ok : "+func.name+" ( "+args+" ) -> "+result+"\n");
  } catch(e) {
    dump("exec function exception : "+e+"\n");
    this.session.encodeOut({'result':false, 'exception':{'name':e.name, 'message':e.message}, 'uuid':uuid});
    failed = true;
  }  
  if (typeof result != "undefined") {
    this.set(uuid, result);
  } else if (!failed) {
    this.session.encodeOut({'result':true, 'data':null, 'uuid':uuid});
  }
}


function AsyncRead (session) {
  this.session = session;
}
AsyncRead.prototype.onStartRequest = function (request, context) {};
AsyncRead.prototype.onStopRequest = function (request, context, status) {
  this.session.onQuit();
}
AsyncRead.prototype.onDataAvailable = function (request, context, inputStream, offset, count) {
  var str = {};
  this.session.instream.readString(count, str);
  this.session.receive(str.value);
}

var backstage = this;
function Session (transport) {
  this.transpart = transport;
  this.sandbox = Components.utils.Sandbox(backstage);
  this.bridge = new Bridge(this);
  
  this.outstream = transport.openOutputStream(Components.interfaces.nsITransport.OPEN_BLOCKING , 0, 0);
  this.stream = transport.openInputStream(0, 0, 0);
  this.instream = Components.classes['@mozilla.org/intl/converter-input-stream;1'].createInstance(Components.interfaces.nsIConverterInputStream);
  this.instream.init(this.stream, 'UTF-8', 1024, Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
  
  this.pump = Components.classes['@mozilla.org/network/input-stream-pump;1'].createInstance(Components.interfaces.nsIInputStreamPump);
  this.pump.init(this.stream, -1, -1, 0, 0, false);
  this.pump.asyncRead(new AsyncRead(this), null);
}
Session.prototype.onOutput = function(string) {
  dump('jsbridge write: '+string)
  this.outstream.write(string, string.length);
};
Session.prototype.onQuit = function() {
  this.instream.close();
  this.outstream.close();
  sessions.remove(session);
};
var nativeJSON = Components.classes["@mozilla.org/dom/json;1"].createInstance(Components.interfaces.nsIJSON);
function jsonEncode(obj) {
  return nativeJSON.encode(obj);
}
Session.prototype.encodeOut = function (obj) {
  try {
    this.onOutput(jsonEncode(obj));
  } catch(e) {
    this.onOutput(jsonEncode({'result':false, 'exception':{'name':e.name, 'message':e.message}}));
  }
  
}
Session.prototype.receive = function(data) {
  dump('jsbrige receive: '+data);
  try {
    var params = Components.utils.evalInSandbox("("+data+")",this.sandbox);
    var response = this.bridge[params.action].apply(this.bridge,params.args);
    if (response && params.uuid) 
      this.onOutput(jsonEncode({uuid:params.uuid, response:response}));
  } catch(e) {
    alert("receive ex : "+e+"\n"+e.stack);
  }
}

function Server (port) {
  this.port = port;
}
Server.prototype.start = function () {
  try {
    this.serv = Components.classes['@mozilla.org/network/server-socket;1'].createInstance(Components.interfaces.nsIServerSocket);
    this.serv.init(this.port, true, -1);
    this.serv.asyncListen(this);
  } catch(e) {
    alert("Unable to start server : "+e);
  }    
}
Server.prototype.stop = function () {
    this.serv.close();
    this.sessions.quit();
    this.serv = undefined;
}
Server.prototype.onStopListening = function (serv, status) {
// Stub function
}
Server.prototype.onSocketAccepted = function (serv, transport) {
  session = new Session(transport)
  sessions.add(session);
}


  var server = new Server(24242);
  server.start();

