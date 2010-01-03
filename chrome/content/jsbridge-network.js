/*

function Jsbridge(host,port) {
  this.transportService =
      Components.classes["@mozilla.org/network/socket-transport-service;1"]
        .getService(Components.interfaces.nsISocketTransportService);
  this.instream = null;
  this.outstream=null;
  this.data="";
  this.connect(host,port);
}

Jsbridge.prototype.connect = function (host,port)
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


Jsbridge.prototype.write = function (outputData) {
  dump("send : "+outputData+"\n");
  this.outstream.write(outputData,outputData.length);
}

Jsbridge.prototype.onStartRequest = function (request, context) {}

Jsbridge.prototype.onStopRequest = function (request, context, status) {
  this.instream.close();
  this.outstream.close();
}

Jsbridge.prototype._callbacks = {};
Jsbridge.prototype._buffer = "";
Jsbridge.prototype.onDataAvailable = function (request, context, inputStream, offset, count) {
  var str={};
  this.instream.readString(count,str);
  dump("receive : "+str.value+"\n");
  this._buffer += str.value;
  var idx = this._buffer.indexOf('{');
  if (idx>0)
    this._buffer = this._buffer.substr(idx);
  try {
    var json=eval("("+this._buffer+")");
    this._buffer = "";
  } catch(e) {
    //alert("ex eval :"+e+"\nwith : "+str.value);
    return;
  }
  if (json.uuid)
    dump("Get response : "+json.uuid+"\n");
  if (json.uuid && this._callbacks[json.uuid]) {
    this._callbacks[json.uuid](json.response);
  }
}



Jsbridge.prototype.doAction = function (name, args, callback) {
  var uuid=newUUID();
  if (callback)
    this._callbacks[uuid]=callback;
  var json={ action : name, uuid : uuid, args : args};
  this.write(jsonEncode(json));
}

Jsbridge.prototype.get = function (js,onGet) {
  
  var self=this;
  this.doAction('get',[js],function (response) {
    
    onGet(self.decodeReturn(response));
    
  });
}
Jsbridge.prototype.decodeReturn = function (response) {
  var self=this;
  function convertFun(id,obj,i) {
    obj[i]=function () {
          self.execute(id,i,arguments);
    }
  }
  var obj={};
  obj.__uuid=response.objectId;
  if (response.type=="object") {
    for(var i in response.attributes) {
      if (response.attributes[i].type=="function")
        convertFun(response.objectId,obj,i);
      else
        obj[i]=response.attributes[i].value;
    }
  } else {
    obj=response.value;
  }
  return obj;
}

Jsbridge.prototype.execute = function (objectId, funName, args) {
  var uuid=newUUID();
  var params=[];
  for(var i=0; i<args.length-1; i++) {
    if (args[i].__uuid)
      params.push("{__uuid:'"+args[i].__uuid+"'}");
    else
      params.push(jsonEncode(args[i]));
  }
  var self=this;
  if (arguments.length>0)
    this._callbacks[uuid]=function (response) {
      arguments[arguments.length-1](self.decodeReturn(response));
    }
  this.write("{action:'execute',uuid:'"+uuid+"',args:['"+objectId+"','"+funName+"',["+params.join(", ")+"]]}");
}
*/