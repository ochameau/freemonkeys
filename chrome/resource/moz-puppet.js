const EXPORTED_SYMBOLS = ["PuppetConnexion"];

const hiddenWindow = Components.classes["@mozilla.org/appshell/appShellService;1"]
        .getService(Components.interfaces.nsIAppShellService)
	        .hiddenDOMWindow;

var uuidgen = Components.classes["@mozilla.org/uuid-generator;1"].getService(Components.interfaces.nsIUUIDGenerator);
function newUUID() {
  return uuidgen.generateUUID().toString();
}

var nativeJSON = Components.classes["@mozilla.org/dom/json;1"].createInstance(Components.interfaces.nsIJSON);
function jsonEncode(obj) {
  return nativeJSON.encode(obj);
}

var localObjects={};
if (!localObjects)
  localObjects = {};

function addLocalObject(id, o) {
  localObjects[id]=o;
}

function dump() {}

///////////////////////////////////////////////////////////////////////

var localFunctions = {};

var PuppetNetworkAPI = {

  _localObjectToRemote : function (obj) {
    if (!obj || obj==null) {
      
      return {type:"null"};
      
    } else if (typeof obj=="object" && obj.push && obj.pop && obj.slice) {
      
      var array=[];
      for(var i=0; i<obj.length; i++) {
        array.push(PuppetNetworkAPI._localObjectToRemote(obj[i]));
      }
      return {type:"array", array: array};
      
    } else if (typeof obj=="object" && obj._____remoteId) {
      
      return {type:"remote-object", id:obj._____remoteId};
      
    } else if (typeof obj=="object") {
      
      var attributes=[];
      var uuid=newUUID();
      localObjects[uuid]=obj;
      for(var name in obj) {
        var att=null;
        try {
          att=obj[name];
        } catch(e) {
          dump("!!! Unable to read attribute : "+name+"\n");
        }
        if (att && att._____remoteId)
          attributes.push({name:name,type:"remote-object",uuid:att._____remoteId});
        else
          attributes.push({name:name,type:typeof att});
      }
      return {type:"local-object", id:uuid, attributes:attributes};
      
    } else if (typeof obj=="function") {
      
      var uuid=newUUID();
      localFunctions[uuid]=obj;
      return {type:"function",id:uuid};
      
    } else {
      
      return {type:(typeof obj),value:obj};
      
    }
  },
  
  _setGetterSetter : function (puppet,obj,id,name) {
    obj.__defineGetter__(name,function (){
      return puppet.blocking.getAttribute(id,name);
    });
    obj.__defineSetter__(name,function (value){
      puppet.blocking.setAttribute(id,name,value);
    });
  },
  
  _setFunction : function (puppet,obj,id,name) {
    obj[name]=function (){
      var args=[];
      for(var i=0;i<arguments.length;i++)
        args.push(arguments[i]);
      return puppet.blocking.execObjectFunction(id,name,args);
    };
  },
  
  _remoteObjectToLocal : function (puppet, response) {
    dump("remote to local : "+response.type+"\n");
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
        if (a.type=="remote-object") {
          obj[a.name] = localObjects[a.uuid];
        } else if (a.type=="function") {
          this._setFunction(puppet,obj,response.id,a.name);
        } else {
          this._setGetterSetter(puppet,obj,response.id,a.name);
        }
      }
      return obj;
      
    } else if (response.type=="array") {
    
      dump("receive array\n");
      var array = [];
      for(var i=0; i<response.array.length; i++) {
        array.push(PuppetNetworkAPI._remoteObjectToLocal(puppet, response.array[i]));
      }
      return array;
      
    } else if (response.type=="function") {
      
      return (function () {
        var args=[];
        for(var i=0;i<arguments.length;i++)
          args.push(arguments[i]);
        return puppet.blocking.execFunction(response.id,args);
      });
      
    } else {
      
      dump("receive unknown type : "+response.type+"\n");
      return response.value;
      
    }
  },
  
  getValue : function (puppet, id) {
    var object=localObjects[id];
    return this._localObjectToRemote(object);
  },
  
  getAttribute : function (puppet, objectId, attributeName) {
    var attribute=null;
    try {
      attribute=localObjects[objectId][attributeName];
    } catch(e) {
      dump("!!! Unable to read attribute : $("+objectId+")."+attributeName+"\n");
    }
    return this._localObjectToRemote(attribute);
  },
  
  setAttribute : function (puppet, objectId, attributeName, attributeValue) {
    var attribute=null;
    try {
      localObjects[objectId][attributeName]=this._remoteObjectToLocal(puppet, attributeValue);
      attribute=localObjects[objectId][attributeName];
    } catch(e) {
      dump("!!! Unable to set attribute : $("+objectId+")."+attributeName+"\n");
    }
    return this._localObjectToRemote(attribute);
  },
  
  execObjectFunction : function (puppet, objectId, functionName, args) {
    var object=localObjects[objectId];
    if (!object || object==null || !object[functionName]) {
      return {type:"null"};
    }
    
    var decodedArgs=[];
    for(var i=0;i<args.length;i++)
      decodedArgs.push(this._remoteObjectToLocal(puppet, args[i]));
    
    var result=object[functionName].apply(object,decodedArgs);
    
    return this._localObjectToRemote(result);
  },
  
  execFunction : function (puppet, functionId, args) {
    var fun=localFunctions[functionId];
    if (!fun || fun==null || typeof fun!="function") {
      return {type:"null"};
    }
    
    var decodedArgs=[];
    for(var i=0;i<args.length;i++)
      decodedArgs.push(this._remoteObjectToLocal(puppet, args[i]));
    
    var result=fun.apply(null,decodedArgs);
    
    return this._localObjectToRemote(result);
  }
  
};
/////////////////////////////////////////////////////////////////////////




function PuppetConnexion() {}

PuppetConnexion.prototype.isAlive = function () {
  if (!this.transport) return false;
  if (this._closed) return false;
  try {
    if (!this.transport.isAlive()) {
      this.close();
      return false;
    }
  } catch(e) {
    return false;
  }
  return true;
} 

PuppetConnexion.prototype.connect = function (host, port, callback, count)
{
  try {
    var transportService = Components.classes["@mozilla.org/network/socket-transport-service;1"].getService(Components.interfaces.nsISocketTransportService);
    var transport = transportService.createTransport(null,0,"localhost",port,null);
    
    this.accept(transport);
    
    var _self=this;
    
    if (!count)
      count=1;
    hiddenWindow.setTimeout(function () {
	    if (transport.isAlive()) {
        callback(true,null);
	    } else if (count>10) {
        callback(false,"Connexion timeout");
	    } else {
        _self.close();
        _self.connect(host, port, callback, count+1);
	    }
    }, 1000);
    
  } catch(ex) {
    dump("!!! error during connect : "+ex+"\n"+ex.stack);
  }
}

PuppetConnexion.prototype.accept = function (transport)
{
  try {
    this._closed = false;
    this.transport = transport;
    this.outstream = transport.openOutputStream(/*Components.interfaces.nsITransport.OPEN_BLOCKING*/0, 0, 0);
    this.stream = transport.openInputStream(0, 0, 0);
    this.instream = Components.classes['@mozilla.org/intl/converter-input-stream;1'].createInstance(Components.interfaces.nsIConverterInputStream);
    this.instream.init(this.stream, 'UTF-8', 4096, Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
    
    /*
    // don't use asyncRead because 
    // thread.processNextEvent will not yield the pump's thread :/
    this.pump = Components.classes['@mozilla.org/network/input-stream-pump;1'].createInstance(Components.interfaces.nsIInputStreamPump);
    this.pump.init(this.stream, -1, -1, 0, 0, false);
    this.pump.asyncRead(this, null);
    */
    var _self=this;
    this.interval = hiddenWindow.setInterval(function () {
      try {
        _self.tryRead();
      } catch(e) {dump("!!! interval ex : "+e+"\n");}
    }, 10);
    
    this.blocking = new BlockingPuppet(this);
    this.async = new AsyncPuppet(this);
    
    
  } catch(ex) {
    dump("!!! error during accept : "+ex+"\n"+ex.stack);
  }
}

PuppetConnexion.prototype.close = function () {
  dump("CLOSE CONNEXION \n");
  this._closed=true;
  this.instream.close();
  this.outstream.close();
  hiddenWindow.clearInterval(this.interval);
}

PuppetConnexion.prototype._closed = false;
PuppetConnexion.prototype._callbacks = {};
PuppetConnexion.prototype._response = {};
PuppetConnexion.prototype._buffer = "";
PuppetConnexion.prototype.tryRead = function (count) {
  var str = {};
  if (count) {
    var read = this.instream.readString(count, str);
    if (read!=count)
      dump("async read doesn't retrieve expected buffer size : "+read+"!="+count+"\n");
    dump("receive async <- "+str.value+"\n");
    this._buffer += str.value;
/*
    var thread = Components.classes["@mozilla.org/thread-manager;1"]
               .getService()
               .currentThread;
    thread.processNextEvent(false);*/
  } else {
    while (!this._closed && this.transport.isAlive() && this.instream.readString(4096, str) != 0) {
      dump("receive sync <- "+str.value+"\n");
      this._buffer += str.value;
      str = {};
    }
/*
    var thread = Components.classes["@mozilla.org/thread-manager;1"]
               .getService()
               .currentThread;
    thread.processNextEvent(false);*/
  }
  //var str={};
  //this.instream.readString(count,str);
  //dump("receive async : "+this._buffer+"\n");
  //this._buffer += str.value;
  
  if (this._buffer.length==0) return;
  
  //var idx = this._buffer.indexOf('{');
  //if (idx>0)
  //  this._buffer = this._buffer.substr(idx);
  var json=null;
  try {
    var idx=this._buffer.indexOf("\n\n\n");
    if (idx>0 && this._buffer.length>idx+3) {
      try {
        var test=this._buffer.substr(0,idx);
        //dump("Split : "+idx+"\n"+test);
        json=eval(test);
      } catch(e) {
        dump("!!! split eval error : "+test+"\n");
      }
      this._buffer = this._buffer.substr(idx);
      json=eval("("+this._buffer+")");
      this._buffer = "";
    } else {
      json=eval("("+this._buffer+")");
      this._buffer = "";
    }
    
  } catch(e) {
    dump("!!! ex eval async receive :"+e+"\n with : \n"+this._buffer+"<<\n\n");
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
      dump("receive response with callback : "+json.uuid+"\n");
      this._callbacks[json.uuid](json.response);
      delete this._callbacks[json.uuid];
      return;
    }
    dump("receive response without callback : "+json.uuid+"\n");
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
    var response = PuppetNetworkAPI[action].apply(PuppetNetworkAPI,[this].concat(args));
    var encoded=jsonEncode({uuid:uuid, type:"response", result:"OK", response:response});
    dump("send response -> "+encoded+"\n");
    this.write(encoded);
    //this.outstream.flush();
  } catch(e) {
    dump("!!! receive async ex : "+e+"\n"+e.stack);
    var encoded=jsonEncode({uuid:uuid, type:"response", result:"FAIL", exception:{msg:e.toString(),stack:(""+e.stack)}});
    this.write(encoded);
    //this.outstream.flush();
  }
}

PuppetConnexion.prototype.write = function (buffer) {
  var idx=buffer.indexOf("\n\n\n");
  if (idx>0)
    dump("separator in : "+buffer);
  buffer+="\n\n\n";
  var len=buffer.length;
  while(len>0) {
    if (this._closed || !this.transport.isAlive()) return; 
    var write = this.outstream.write(buffer,len);
    dump("Send "+write+"/"+len+"\n");
    buffer=buffer.substr(write);
    len=buffer.length;
    var thread = Components.classes["@mozilla.org/thread-manager;1"]
               .getService()
               .currentThread;
    thread.processNextEvent(false);
  }
  this.outstream.flush();
}

PuppetConnexion.prototype.syncRequest = function (action, args) {
  var uuid=newUUID();
  var outputData = jsonEncode({type:"request",uuid:uuid,action:action,args:args});
  dump("send sync -> "+outputData+"\n");
  this.write(outputData);
  //this.outstream.flush();
  
  var json = null;
  
  var start=new Date().getTime();
  while(!this._response[uuid] && new Date().getTime()-start<30000) {
    if (this._closed || !this.transport.isAlive()) 
      throw "Unable to receive response for "+uuid+" because connexion was closed\n";
    //dump(">>>while request loop\n");
    try {
      this.tryRead();
    } catch(e) {dump("!!! read err : "+e+"\n");}
    
    if (this._response[uuid]) break;
    
    var thread = Components.classes["@mozilla.org/thread-manager;1"]
               .getService()
               .currentThread;
    thread.processNextEvent(false);
    
  }
  
  var json=this._response[uuid];
  
  delete this._response[uuid];
  
  if (!json) {
    dump("No response during timeout for : "+action+"\n");
    throw "No response during timeout for : "+action;
  }
  
  return json;
}

PuppetConnexion.prototype.asyncRequest = function (action,args,callback) {
  var uuid=newUUID();
  var outputData = jsonEncode({type:"request",uuid:uuid,action:action,args:args});
  dump("send async -> "+outputData+"\n");
  this.write(outputData);
  this._callbacks[uuid]=callback;
}




//////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////// BLOCKING

function BlockingPuppet(connexion) {
  this.connexion = connexion;
}

BlockingPuppet.prototype.getValue = function (id) {
  var response = this.connexion.syncRequest ("getValue",[id]);
  return PuppetNetworkAPI._remoteObjectToLocal( this.connexion, response );
}

BlockingPuppet.prototype.getAttribute = function (objectId,attributeName) {
  var response = this.connexion.syncRequest ("getAttribute",[objectId,attributeName]);
  return PuppetNetworkAPI._remoteObjectToLocal( this.connexion, response );
}

BlockingPuppet.prototype.setAttribute = function (objectId,attributeName,attributeValue) {
  var response = this.connexion.syncRequest ("setAttribute",[objectId,attributeName,PuppetNetworkAPI._localObjectToRemote(attributeValue)]);
  return PuppetNetworkAPI._remoteObjectToLocal( this.connexion, response );
}

BlockingPuppet.prototype.execObjectFunction = function (objectId,functionName,args) {
  
  // Pre-process function arguments in order to detect distants objects 
  var argsProcessed=[];
  for(var i=0; i<args.length; i++)
    argsProcessed.push(PuppetNetworkAPI._localObjectToRemote(args[i]));
  
  // Call firefox session
  var response = this.connexion.syncRequest ("execObjectFunction",[objectId,functionName,argsProcessed]);
  
  // Convert response to a local object
  return PuppetNetworkAPI._remoteObjectToLocal( this.connexion, response );
  
}
BlockingPuppet.prototype.execFunction = function (functionId,args) {

  // Pre-process function arguments in order to detect distants objects 
  var argsProcessed=[];
  for(var i=0; i<args.length; i++)
    argsProcessed.push(PuppetNetworkAPI._localObjectToRemote(args[i]));
  
  // Call firefox session
  var response = this.connexion.syncRequest ("execFunction",[functionId,argsProcessed]);
  
  // Convert response to a local object
  return PuppetNetworkAPI._remoteObjectToLocal( this.connexion, response );
  
}



//////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////// ASYNC

function AsyncPuppet(connexion) {
  this.connexion = connexion;
}

AsyncPuppet.prototype.convertResponseToObject = function (response) {
  if (response.type=="local-object") {
    var _self=this;
    var obj={
      _____remoteId : response.id,
      getAttribute : function (name,callback) {
        _self.getAttribute(this._____remoteId,name,callback);
      },
      setAttribute : function (name,value,callback) {
        _self.setAttribute(this._____remoteId,name,value,callback);
      },
      execObjectFunction : function (name,args,callback) {
        _self.execObjectFunction(this._____remoteId,name,args,callback);
      }
    };
    return obj;
  } else if (response.type=="remote-object") {
    return localObjects[response.id];
  } else if (response.type=="array") {
    var list = [];
    for(var i=0; i<response.array.length; i++) 
      list.push(this.convertResponseToObject(response.array[i]));
    return list;
  } else if (response.type=="null") {
    return null;
  } else {
    return response.value;
  }
}

AsyncPuppet.prototype.getValue = function (id, callback) {
  var _self=this;
  this.connexion.asyncRequest ("getValue",[id],
    function (response) {
        
        callback( _self.convertResponseToObject(response) );
        
    }
  );
}

AsyncPuppet.prototype.getAttribute = function (objectId,attributeName, callback) {
  var _self=this;
  this.connexion.asyncRequest ("getAttribute",[objectId,attributeName],
    function (response) {
        
        callback( _self.convertResponseToObject(response) );
        
    }
  );
}

AsyncPuppet.prototype.execObjectFunction = function (objectId,functionName,args,callback) {
  
  // Pre-process function arguments in order to detect distants objects 
  var argsProcessed=[];
  for(var i=0; i<args.length; i++)
    argsProcessed.push(PuppetNetworkAPI._localObjectToRemote(args[i]));
  
  // Call firefox session
  var _self=this;
  this.connexion.asyncRequest ("execObjectFunction",[objectId,functionName,argsProcessed],
    function (response) {
        
        callback( _self.convertResponseToObject(response) );
        
    }
  );
  
}

