
  
function AsyncRead (session) {
  this.session = session;
}
AsyncRead.prototype.onStartRequest = function (request, context) {
  dump("START REQUEST!!!!\n");
};
AsyncRead.prototype.onStopRequest = function (request, context, status) {
  this.session.onQuit();
  dump("STOP REQUEST!!!!\n");
}
AsyncRead.prototype.onDataAvailable = function (request, context, inputStream, offset, count) {
  dump("Dataavailable : "+count+"\n");
  var str = {};
  this.session.instream.readString(count, str);
  this.session.receive(str.value);
}

////////////////////////////////////////// SESSION
function Session (transport) {
  this.transpart = transport;
  
  this.outstream = transport.openOutputStream(Components.interfaces.nsITransport.OPEN_BLOCKING, 0, 0);
  this.stream = transport.openInputStream(0, 0, 0);
  this.instream = Components.classes['@mozilla.org/intl/converter-input-stream;1'].createInstance(Components.interfaces.nsIConverterInputStream);
  this.instream.init(this.stream, 'UTF-8', 1024, Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
  
  this.pump = Components.classes['@mozilla.org/network/input-stream-pump;1'].createInstance(Components.interfaces.nsIInputStreamPump);
  this.pump.init(this.stream, -1, -1, 0, 0, false);
  this.pump.asyncRead(new AsyncRead(this), null);
}
Session.prototype.onOutput = function(string) {
  dump('jsbridge write: '+string+"\n")
  
};
Session.prototype.onQuit = function() {
  this.instream.close();
  this.outstream.close();
};
var nativeJSON = Components.classes["@mozilla.org/dom/json;1"].createInstance(Components.interfaces.nsIJSON);
function jsonEncode(obj) {
  return nativeJSON.encode(obj);
}


var uuidgen = Components.classes["@mozilla.org/uuid-generator;1"].getService(Components.interfaces.nsIUUIDGenerator);
function newUUID() {
  return uuidgen.generateUUID().toString();
}

var Root = {
  a : "A",
  b : 2,
  c : function (a1,a2,a3) {return "c"+a1+a2+a3;},
  d : {
    e: "e",
    f: 6,
    g: function (o) {return "g"+o.a;},
    h: { i:"i" }
  }
};

var localObjects={
  "root":Root,
  "macro":macro
};

var API = {
  _localObjectToRemote : function (obj) {
    if (!obj || obj==null) {
      return {type:"null"};
    }
    if (typeof obj=="object") {
      var attributes=[];
      var uuid=newUUID();
      localObjects[uuid]=obj;
      for(var name in obj) {
        var att=null;
        try {
          att=obj[name];
        } catch(e) {
          dump("Unable to read attribute : "+name+"\n");
        }
        attributes.push({name:name,type:typeof att});
      }
      return {type:"local-object",id:uuid, attributes:attributes};
    } else {
      return {type:(typeof obj),value:obj};
    }
  },
  
  _setGetterSetter : function (puppet,obj,id,name) {
    obj.__defineGetter__(name,function (){
      return puppet.getAttribute(id,name);
    });
    obj.__defineSetter__(name,function (value){
      puppet.setAttribute(id,name,value);
    });
  },
  
  _setFunction : function (puppet,obj,id,name) {
    obj[name]=function (){
      var args=[];
      for(var i=0;i<arguments.length;i++)
        args.push(arguments[i]);
      return puppet.execFunction(id,name,args);
    };
  },
  
  _remoteObjectToLocal : function (response) {
    if (response.type=="null") {
      
      return null;
      
    } else if (response.type=="remote-object") {
      
      if (!response.id)
        return dump("object without id!\n");
      if (!localObjects[response.id])
        return dump("Unable to found object["+response.id+"]\n");
      return localObjects[response.id];
      
    } else if (response.type=="local-object") {
      
      if (!response.id)
        return dump("object without id!\n");
      var obj = {_____remoteId : response.id};
      for(var i=0;i<response.attributes.length;i++) {
        var a=response.attributes[i];
        if (a.type=="function") {
          this._setFunction(lastPuppet,obj,response.id,a.name);
        } else {
          this._setGetterSetter(lastPuppet,obj,response.id,a.name);
        }
      }
      return obj;
      
    } else {
      return response.value;
    }
  },
  
  getValue : function (id) {
    var object=localObjects[id];
    return this._localObjectToRemote(object);
  },
  
  getAttribute : function (objectId, attributeName) {
    var attribute=null;
    try {
      attribute=localObjects[objectId][attributeName];
    } catch(e) {
      dump("Unable to read attribute : $("+objectId+")."+attributeName+"\n");
    }
    return this._localObjectToRemote(attribute);
  },
  
  execFunction : function (objectId, functionName, args) {
    var object=localObjects[objectId];
    if (!object || object==null || !object[functionName]) {
      return {type:"null"};
    }
    
    var decodedArgs=[];
    for(var i=0;i<args.length;i++)
      decodedArgs.push(this._remoteObjectToLocal(args[i]));
    
    var result=object[functionName].apply(object,decodedArgs);
    
    return this._localObjectToRemote(result);
  }
  
};

Session.prototype.receive = function(data) {
  dump('jsbrige receive: '+data+"\n");
  try {
    var json = eval("("+data+")");
    if (!json.action && json.uuid && json.result && json.response) {
      this._response[json.uuid]=json;
      return;
    }
    // json = {action:string,args:string array}
    var response = API[json.action].apply(API,json.args);
    var encoded=jsonEncode({uuid:json.uuid, type:"response", result:"OK", response:response});
    dump("response --> "+encoded+"\n");
    this.outstream.write(encoded, encoded.length);
  } catch(e) {
    dump("receive ex : "+e+"\n"+e.stack+"\n");
    var encoded=jsonEncode({uuid:json.uuid,type:"response",result:"FAIL",exception:{msg:e.toString(),stack:(""+e.stack)}});
    this.outstream.write(encoded, encoded.length);
  }
}  

function setGetterSetter(puppet,obj,id,name) {
  obj.__defineGetter__(name,function (){
    return puppet.getAttribute(id,name);
  });
  obj.__defineSetter__(name,function (value){
    puppet.setAttribute(id,name,value);
  });
}
function setFunction(puppet,obj,id,name) {
  obj[name]=function (){
    var args=[];
    for(var i=0;i<arguments.length;i++)
      args.push(arguments[i]);
    return puppet.execFunction(id,name,args);
  };
}

Session.prototype._remoteObjectToLocal = function (response) {
  var _self=this;
  if (response.type=="remote-object") { // Remote object from the sender point of view
    var obj = localObjects[response.id];
    if (!obj)
      throw "Unable to retrieve local object : "+response.id;
    return obj;
  } else if (response.type=="local-object") { // Local object from the sender point of view
    var obj = {_____remoteId : response.id};
    for(var i=0;i<response.attributes.length;i++) {
      var a=response.attributes[i];
      if (a.type=="function") {
        setFunction(this,obj,response.id,a.name);
      } else {
        setGetterSetter(this,obj,response.id,a.name);
      }
    }
    return obj;
  } else if (response.type=="null") {
    return null;
  } else {
    return response.value;
  }
}

Session.prototype._localObjectToRemote = function (obj) {
  if (!obj || obj==null) {
    return {type:"null"};
  } else if (typeof obj=="object") {
    if (!obj._____remoteId) {
      var uuid=newUUID();
      localObjects[uuid]=obj;
      var attributes=[];
      for(var name in obj) {
        var att=null;
        try {
          att=obj[name];
        } catch(e) {
          dump("Unable to read attribute : "+name+"\n");
        }
        attributes.push({name:name,type:typeof att});
      }
      return {type:"local-object", id:uuid, attributes:attributes};
    } else {
      return {type:"remote-object", id:obj._____remoteId};
    }
  } else {
    return {type:typeof obj, value:obj};
  }
}

Session.prototype.getValue = function (id) {
  var response = this.request ("getValue",[id]);
  return this._remoteObjectToLocal( response );
}

Session.prototype.getAttribute = function (objectId,attributeName) {
  var response = this.request ("getAttribute",[objectId,attributeName]);
  return this._remoteObjectToLocal( response );
}

Session.prototype.execFunction = function (objectId,functionName,args) {
  
  // Pre-process function arguments in order to detect distants objects 
  var argsProcessed=[];
  for(var i=0; i<args.length; i++)
    argsProcessed.push(this._localObjectToRemote(args[i]));
  
  // Call firefox session
  var response = this.request ("execFunction",[objectId,functionName,argsProcessed]);
  
  // Convert response to a local object
  return this._remoteObjectToLocal( response );
  
}

Session.prototype._response={};
Session.prototype._buffer="";
Session.prototype.request = function (action,args) {
  var uuid=newUUID();
  var outputData = jsonEncode({uuid:uuid, type:"request", action:action, args:args});
  dump("send -> "+outputData+"\n");
  this.outstream.write(outputData,outputData.length);
  
  var thread = Components.classes["@mozilla.org/thread-manager;1"]
               .getService()
               .currentThread;
  var start=new Date().getTime();
  while(new Date().getTime()-start<2000) {
    

    thread.processNextEvent(false);
    
    while (thread.hasPendingEvents()) {
      //dump(">>>PROCESS EVENT "+(new Date().getTime()-start)+"\n");
      thread.processNextEvent(false);
    }
    
    if (!this._response[uuid]) continue;
    
    var json = this._response[uuid];
    
    delete this._response[uuid];
    
    if (typeof json!="object") {
      throw "Call error : receive something else than an object >> "+json;
    }
    if (json.result!="FAIL" && json.exception) {
      throw "Call error : something go wrong on distant side >> "+json.exception.msg+"\n"+json.exception.stack;
    }
    if (json.result!="OK") {
      throw "Call error : protocol error : result!='OK' >> "+json.toSource();
    }
    return json.response;
  }
  
  throw "Call error : no response during timeout";
}


////////////////////////////////////////// SERVER
var sessions=[];
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
  this.serv = undefined;
}
Server.prototype.onStopListening = function (serv, status) {
  dump("STOP LISTENING!!!!\n");
}
var lastPuppet=null;
Server.prototype.onSocketAccepted = function (serv, transport) {
  dump("SOCKET ACCEPTED!!!!\n");
  session = new Session(transport);
  lastPuppet = session;
}


var server = new Server(24242);
server.start();
