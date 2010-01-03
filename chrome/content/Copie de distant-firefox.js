var uuidgen = Components.classes["@mozilla.org/uuid-generator;1"].getService(Components.interfaces.nsIUUIDGenerator);
function newUUID() {
  return uuidgen.generateUUID().toString();
}

var nativeJSON = Components.classes["@mozilla.org/dom/json;1"].createInstance(Components.interfaces.nsIJSON);
function jsonEncode(obj) {
  return nativeJSON.encode(obj);
}

var PuppetNetworkAPI = {
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
/////////////////////////////////////////////////////////////////////////




function PuppetConnexion(host,port) {
  this.transportService = Components.classes["@mozilla.org/network/socket-transport-service;1"].getService(Components.interfaces.nsISocketTransportService);
  this.connect(host,port);
}

PuppetConnexion.prototype.connect = function (host,port)
{
  try {
    var transport = this.transportService.createTransport(null,0,"localhost",24242,null);
    
    this.outstream = transport.openOutputStream(Components.interfaces.nsITransport.OPEN_BLOCKING,0,0);
    
    var stream = transport.openInputStream(0,0,0);
    this.instream = Components.classes['@mozilla.org/intl/converter-input-stream;1']
            .createInstance(Components.interfaces.nsIConverterInputStream);
    this.instream.init(stream, 'UTF-8', 1024,
                  Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);

    var pump = Components.
      classes["@mozilla.org/network/input-stream-pump;1"].
        createInstance(Components.interfaces.nsIInputStreamPump);
    pump.init(stream, -1, -1, 0, 0, false);
    pump.asyncRead(this,null);
  
  } catch(ex) {
    alert("error during connect : "+ex+"\n"+ex.stack);
  }
}

PuppetConnexion.prototype.onStartRequest = function (request, context) {}

PuppetConnexion.prototype.onStopRequest = function (request, context, status) {
  this.instream.close();
  this.outstream.close();
}

PuppetConnexion.prototype._callbacks = {};
PuppetConnexion.prototype._response = {};
PuppetConnexion.prototype._buffer = "";
PuppetConnexion.prototype.onDataAvailable = function ( request, context, inputStream, offset, count ) {
  var str={};
  this.instream.readString(count,str);
  dump("receive async : "+str.value+"\n");
  
  this._buffer += str.value;
  var idx = this._buffer.indexOf('{');
  if (idx>0)
    this._buffer = this._buffer.substr(idx);
  try {
    var json=eval("("+this._buffer+")");
    this._buffer = "";
  } catch(e) {
    dump("ex eval async receive :"+e+"\nwith : "+this._buffer);
    return;
  }
  
  if (typeof json!="object") {
    throw "Call error : receive something else than an object >> "+json;
  }
  
  if (!json.uuid)
    throw "Receive message without UUID!";
  
  if (!json.type || (json.type!="response" && json.type!="request"))
    throw "Message with bad type property : "+json.type;
  
  if (json.type=="response") {
    if (!json.response)
      throw "Response without response argument : "+json.response;
    if (json.result=="FAIL" && json.exception)
      throw "Call error : something go wrong on distant side >> "+json.exception.msg+"\n"+json.exception.stack;
    if (json.result!="OK")
      throw "Call error : protocol error : result!='OK' >> "+json.toSource();
    
    if (this._callbacks[json.uuid]) {
      this._callsbacks[json.uuid](json.response);
      delete this._callsbacks[json.uuid];
      return;
    }
    this._response[json.uuid] = json.response;
  } 
  else if (json.type=="request") {
    if (!json.action || !json.args)
      throw "Request without action argument ("+json.action+") and/or without args ("+json.args+")";
    this.handleRequest(json.uuid, json.action, json.args);
  }

}

PuppetConnexion.prototype.handleRequest = function (uuid, action, args) {
  try {
    var response = PuppetNetworkAPI[action].apply(PuppetNetworkAPI,args);
    var encoded=jsonEncode({uuid:uuid, result:"OK", response:response});
    dump("send response -> "+encoded+"\n");
    this.outstream.write(encoded,encoded.length);
  } catch(e) {
    alert("receive async ex : "+e+"\n"+e.stack);
    var encoded=jsonEncode({uuid:uuid, result:"FAIL", exception:{msg:e.toString(),stack:(""+e.stack)}});
    this.outstream.write(encoded,encoded.length);
  }
}

PuppetConnexion.prototype.syncRequest = function (action, args) {
  var uuid=newUUID();
  var outputData = jsonEncode({type:"request",uuid:uuid,action:action,args:args});
  dump("send sync -> "+outputData+"\n");
  this.outstream.write(outputData,outputData.length);
  
  var json = null;
  var start=new Date().getTime();
  while(new Date().getTime()-start<5000) {
    //dump(">>>while request loop\n");
    var thread = Components.classes["@mozilla.org/thread-manager;1"]
               .getService()
               .currentThread;

    while (thread.hasPendingEvents()) {
      dump(">>>PROCESS EVENT "+(new Date().getTime()-start)+"\n");
      thread.processNextEvent(true);
    }
    
    if (!this._response[uuid]) continue;
    
    json=this._response[uuid];
    
    delete this._response[uuid];
  }
  return json;
}

PuppetConnexion.prototype.asyncRequest = function (action,args,callback) {
  var uuid=newUUID();
  var outputData = jsonEncode({type:"request",uuid:uuid,action:action,args:args});
  dump("send async -> "+outputData+"\n");
  this.outstream.write(outputData,outputData.length);
  this._callbacks[uuid]=callback;
}






function BlockingPuppet(connexion) {
  this.connexion = connexion;
}

BlockingPuppet.prototype.connect = function (host,port)
{
  try {
  var transport = this.transportService.createTransport(null,0,"localhost",24242,null);
  
  this.outstream = transport.openOutputStream(Components.interfaces.nsITransport.OPEN_BLOCKING,0,0);
  
  var stream = transport.openInputStream(0,0,0);
  this.instream = Components.classes['@mozilla.org/intl/converter-input-stream;1']
          .createInstance(Components.interfaces.nsIConverterInputStream);
  this.instream.init(stream, 'UTF-8', 1024,
                Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
  
  } catch(ex) {
    alert("error during connect : "+ex+"\n"+ex.stack);
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

var localObjects={};

BlockingPuppet.prototype._remoteObjectToLocal = function (response) {
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

BlockingPuppet.prototype._localObjectToRemote = function (obj) {
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

BlockingPuppet.prototype.getValue = function (id) {
  var response = this.request ("getValue",[id]);
  return this._remoteObjectToLocal( response );
}

BlockingPuppet.prototype.getAttribute = function (objectId,attributeName) {
  var response = this.request ("getAttribute",[objectId,attributeName]);
  return this._remoteObjectToLocal( response );
}

BlockingPuppet.prototype.execFunction = function (objectId,functionName,args) {
  
  // Pre-process function arguments in order to detect distants objects 
  var argsProcessed=[];
  for(var i=0; i<args.length; i++)
    argsProcessed.push(this._localObjectToRemote(args[i]));
  
  // Call firefox session
  var response = this.request ("execFunction",[objectId,functionName,argsProcessed]);
  
  // Convert response to a local object
  return this._remoteObjectToLocal( response );
  
}

BlockingPuppet.prototype._buffer="";
BlockingPuppet.prototype.request = function (action,args) {
  var outputData = jsonEncode({action:action,args:args});
  dump("send -> "+outputData+"\n");
  this.outstream.write(outputData,outputData.length);
  
  var start=new Date().getTime();
  while(new Date().getTime()-start<5000) {
    //dump(">>>while request loop\n");
    var thread = Components.classes["@mozilla.org/thread-manager;1"]
               .getService()
               .currentThread;

    while (thread.hasPendingEvents()) {
      dump(">>>PROCESS EVENT "+(new Date().getTime()-start)+"\n");
      thread.processNextEvent(true);
    }

    var str = {};
    while (this.instream.readString(4096, str) != 0) {
      dump(">>>ReadString loop\n");
      dump("receive <- "+str.value+"\n");
      this._buffer += str.value;
    }

    var idx = this._buffer.indexOf('{');
    if (idx>0)
      this._buffer = this._buffer.substr(idx);
    var json = null;
    try {
      json=eval("("+this._buffer+")");
      this._buffer = "";
    } catch(e) {
      //dump("unable to eval receive buffer : "+this._buffer+"\n");
      continue;
    }
    
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



///////////////////////////////////////////////////////////////////////////


function AsyncPuppet(host,port) {
  this.transportService = Components.classes["@mozilla.org/network/socket-transport-service;1"].getService(Components.interfaces.nsISocketTransportService);
  this.instream = null;
  this.outstream=null;
  this.data="";
  this.connect(host,port);
}

AsyncPuppet.prototype.connect = function (host,port)
{
  try {
  var transport = this.transportService.createTransport(null,0,"localhost",24242,null);
  
  this.outstream = transport.openOutputStream(Components.interfaces.nsITransport.OPEN_BLOCKING,0,0);
  
  var stream = transport.openInputStream(0,0,0);
  this.instream = Components.classes['@mozilla.org/intl/converter-input-stream;1']
          .createInstance(Components.interfaces.nsIConverterInputStream);
  this.instream.init(stream, 'UTF-8', 1024,
                Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);

  var pump = Components.
    classes["@mozilla.org/network/input-stream-pump;1"].
      createInstance(Components.interfaces.nsIInputStreamPump);
  pump.init(stream, -1, -1, 0, 0, false);
  pump.asyncRead(this,null);
  
  } catch(ex) {
    alert("error during connect : "+ex+"\n"+ex.stack);
  }
}

AsyncPuppet.prototype.onStartRequest = function (request, context) {}

AsyncPuppet.prototype.onStopRequest = function (request, context, status) {
  this.instream.close();
  this.outstream.close();
}

AsyncPuppet.prototype._buffer = "";
AsyncPuppet.prototype.onDataAvailable = function ( request, context, inputStream, offset, count ) {
  var str={};
  this.instream.readString(count,str);
  dump("receive async : "+str.value+"\n");
  this._buffer += str.value;
  var idx = this._buffer.indexOf('{');
  if (idx>0)
    this._buffer = this._buffer.substr(idx);
  try {
    var json=eval("("+this._buffer+")");
    this._buffer = "";
  } catch(e) {
    dump("ex eval async receive :"+e+"\nwith : "+this._buffer);
    return;
  }
  
  if (typeof json!="object") {
    throw "Call error : receive something else than an object >> "+json;
  }
  
  if (!json.uuid)
    throw "Receive async response without UUID!";
  
  if (json.action && json.args) {
    try {
      var response = API[json.action].apply(API,json.args);
      var encoded=jsonEncode({uuid:json.uuid, result:"OK", response:response});
      dump("send response async -> "+encoded+"\n");
      this.outstream.write(encoded,encoded.length);
    } catch(e) {
      alert("receive async ex : "+e+"\n"+e.stack);
      var encoded=jsonEncode({result:"ERROR",exception:{msg:e.toString(),stack:(""+e.stack)}});
      this.outstream.write(encoded,encoded.length);
    }
    
    return;
  }
  
  if (json.result!="FAIL" && json.exception) {
    throw "Call error : something go wrong on distant side >> "+json.exception.msg+"\n"+json.exception.stack;
  }
  
  if (json.result!="OK") {
    throw "Call error : protocol error : result!='OK' >> "+json.toSource();
  }
  
  var callback = this._callbacks[json.uuid];
  if (!callback)
    throw "Receive response but no callback are registered!";
  
  callback(json.response);
  
}



AsyncPuppet.prototype.convertResponseToObject = function (response) {
  if (response.type=="local-object") {
    var _self=this;
    var obj={
      _____id : response.id,
      getAttribute : function (name,callback) {
        _self.getAttribute(this._____id,name,callback);
      },
      setAttribute : function (name,value,callback) {
        _self.setAttribute(this._____id,name,value,callback);
      },
      execFunction : function (name,args,callback) {
        _self.execFunction(this._____id,name,args,callback);
      }
    };
    return obj;
  } else if (response.type=="remote-object") {
    return localObjects[response.id];
  } else if (response.type=="null") {
    return null;
  } else {
    return response.value;
  }
}

AsyncPuppet.prototype.getValue = function (id, callback) {
  var _self=this;
  this.request ("getValue",[id],
    function (response) {
        
        callback( _self.convertResponseToObject(response) );
        
    }
  );
}


AsyncPuppet.prototype.getAttribute = function (objectId,attributeName, callback) {
  var _self=this;
  this.request ("getAttribute",[objectId,attributeName],
    function (response) {
        
        callback( _self.convertResponseToObject(response) );
        
    }
  );
}

AsyncPuppet.prototype.execFunction = function (objectId,functionName,args,callback) {
  
  // Pre-process function arguments in order to detect distants objects 
  var argsProcessed=[];
  for(var i=0; i<args.length; i++) {
    var a=args[i];
    if (!a || a==null) {
      argsProcessed.push({type:"null"});
    } else if (typeof a=="object") {
      if (!a._____id) {
        var uuid=newUUID();
        localObjects[uuid]=a;
        var attributes=[];
        for(var name in a) {
          var att=null;
          try {
            att=a[name];
          } catch(e) {
            dump("Unable to read attribute : "+name+"\n");
          }
          attributes.push({name:name,type:typeof att});
        }
        argsProcessed.push({type:"local-object", id:uuid, attributes:attributes});
      } else {
        argsProcessed.push({type:"remote-object", id:a._____id});
      }
    } else {
      argsProcessed.push({type:typeof a,value:a});
    }
  }
  
  // Call firefox session
  var _self=this;
  this.request ("execFunction",[objectId,functionName,argsProcessed],
    function (response) {
        
        callback( _self.convertResponseToObject(response) );
        
    }
  );
  
}

AsyncPuppet.prototype._callbacks = {};
AsyncPuppet.prototype.request = function (action,args,callback) {
  var uuid=newUUID();
  var outputData = jsonEncode({uuid:uuid,action:action,args:args});
  dump("send async -> "+outputData+"\n");
  this.outstream.write(outputData,outputData.length);
  this._callbacks[uuid]=callback;
}



