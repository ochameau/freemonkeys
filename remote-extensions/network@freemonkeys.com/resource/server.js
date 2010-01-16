const EXPORTED_SYMBOLS = ["startFreemonkeyServer","stopFreemonkeyServer"];

Components.utils.import("resource://fm-network/moz-puppet.js");

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
  delete this.serv;
}
Server.prototype.onStopListening = function (serv, status) {
  dump("STOP LISTENING!!!!\n");
}
var puppets=[];
Server.prototype.onSocketAccepted = function (serv, transport) {
  dump("SOCKET ACCEPTED!!!!\n");
  var puppet = new PuppetConnexion();
  puppet.accept(transport);
  puppets.push(puppet);
}
Server.prototype.cleanPuppets = function () {
  for(var i=0; i<puppets.length; i++) {
    try {
      puppets[i].close();
    } catch(e) {
      dump("Unable to close puppet : "+e+"\n");
    }
  }
  this.serv.close();
}

var server = null;

function startFreemonkeyServer(port) {
  Components.utils.import("resource://fm-network/library.js");
  server = new Server(port);
  server.start();
  return server;
}

function stopFreemonkeyServer() {
  if (server)
    server.cleanPuppets();
}
