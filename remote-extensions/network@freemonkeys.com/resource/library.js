const EXPORTED_SYMBOLS = [];

var hiddenWindow = Components.classes["@mozilla.org/appshell/appShellService;1"]
         .getService(Components.interfaces.nsIAppShellService)
         .hiddenDOMWindow;

function inspect(obj) {
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
  var win = wm.getMostRecentWindow("navigator:browser");
  if (!win.inspectObject)
    return alert("You must install DOM Inspector!");
  win.inspectObject(obj);
}

Components.utils.import("resource://fm-network/moz-puppet.js");

var macro = {};

macro.execute = function (code, listener) {
try {
  var garden = Components.utils.Sandbox(this.__parent__);//"http://localhost.localdomain.:0/");
  garden.__proto__ = this.__parent__.wrappedJSObject?this.__parent__.wrappedJSObject:this.__parent__;
  
  var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                       .getService(Components.interfaces.mozIJSSubScriptLoader); 
  
  garden.monkey = {};
  
  garden.___api_exception = function (exception) {
    listener("exception",Components.stack.caller.caller.lineNumber+1,{message:Components.stack.caller.name+" : "+exception,e:exception});
  }
  garden.listener = listener;
  
  // Some usefull functions in global context
  garden.setInterval = function (f,t) {hiddenWindow.setInterval(f,t)};
  garden.clearInterval = function (t) {hiddenWindow.clearInterval(t)};
  garden.setTimeout = function (f,t) {hiddenWindow.setTimeout(f,t)};
  garden.setTimeout = function (t) {hiddenWindow.clearTimeout(t)};
  
  garden.monkey.windows = {};
  loader.loadSubScript("resource://fm-network/api/monkey.windows.js", garden.monkey);
  
  garden.assert = {};
  loader.loadSubScript("resource://fm-network/api/assert.js", garden);
  
  garden.log = {};
  loader.loadSubScript("resource://fm-network/api/log.js", garden);
  
  garden.elements = {}
  loader.loadSubScript("resource://fm-network/api/elements.js", garden);
  
  try {
    Components.utils.reportError("start");
    var result = Components.utils.evalInSandbox(code, garden, "1.8", "test-buffer", 0);
    Components.utils.reportError("end");
  } catch(e) {
    Components.utils.reportError("ex");
    //inspect(e);
    var line;
    if (e.location || (e.fileName && e.lineNumber)) {
      var s=e.location || {filename:e.fileName,lineNumber:e.lineNumber};
      while(s.filename!="test-buffer" && s.caller) {
        Components.utils.reportError("stack : "+s);
        s = s.caller;
      }
      if (s && s.filename=="test-buffer")
        line = s.lineNumber+1;
    }
    if (!line)
      line=-1;
    listener("exception",line,{message:""+e,exception:e});
    Components.utils.reportError(e+"\n"+e.stack);
  }
  listener("execute",-1,"end");
} catch(e) {
  listener("exception",-1,{message:""+e,exception:e});
  Components.utils.reportError(e);
}
}


macro.screenshotWindow = function (win, maxSize) {
  var canvasW=0;
  var canvasH=0;
  if (win.innerWidth>win.innerHeight) {
      canvasW=maxSize;
      canvasH=(win.innerHeight/win.innerWidth)*maxSize;
  } else {
      canvasW=(win.innerWidth/win.innetHeight)*maxSize;
      canvasH=maxSize;
  }
  
  
  var canvas = win.document.createElementNS("http://www.w3.org/1999/xhtml","canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  canvas.mozOpaque = true;
  
  var ctx = canvas.getContext("2d");
  
  ctx.save();
  try {
    var w=win.innerWidth;
    var h=win.innerHeight;
    ctx.scale(canvasW/w, canvasH/h);
    ctx.drawWindow(win, win.scrollX, win.scrollY,
                             w, h,
                             "rgba(255,255,255,255)");
  } catch(e) {
    dump("Unable to screenshot a frame : "+e+"\n");
  }
  ctx.restore();
  
  return {
      image : canvas.toDataURL("image/png", ""),
      width : canvasW,
      height: canvasH
	  };
}

macro.getFramesList = function (winInfo) {
  
  var toplevelWin=this.getWindow(winInfo);
  var frames=[];
  var Ci = Components.interfaces;
  var docshell = toplevelWin.QueryInterface(Ci.nsIInterfaceRequestor)
                           .getInterface(Ci.nsIWebNavigation)
                           .QueryInterface(Ci.nsIDocShell);
  
  var shells = docshell.getDocShellEnumerator(Ci.nsIDocShellTreeItem.typeAll, Ci.nsIDocShell.ENUMERATE_FORWARDS);
  while (shells.hasMoreElements())
  {
    try {
      var shell = shells.getNext().QueryInterface(Ci.nsIDocShell);
      //if (shell == docshell) continue;
      shell.QueryInterface(Ci.nsIBaseWindow);
      //if (!shell.visibility) continue;
      
      var win = shell.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
      //if (win.wrappedJSObject)
        //win = win.wrappedJSObject;
      //var shellbo = win.document.getBoxObjectFor(win.document.documentElement);
      
      frames.push(this.getFrameInfo(win));
    
    } catch(e) {
      dump("Unable to enumerate a frame : "+e+"\n");
      throw e;
    }
  }
  return frames;
}

macro.getFrameInfo = function (win) {
  var shell = win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                .getInterface(Components.interfaces.nsIWebNavigation)
                .QueryInterface(Components.interfaces.nsIDocShell);
  var position = shell.chromeEventHandler?this.getNodeInfo(shell.chromeEventHandler,true):false;
  if (!position) {
    position = ['/'];
  } else {
    position = position.framesXPath.concat(position.xpath);
  }
  
  return {
    name : win.name+"--"+(shell.chromeEventHandler?(shell.chromeEventHandler.tagName+"/"+shell.chromeEventHandler.id+"/"+shell.chromeEventHandler.className):"null"),
    title : win.title?win.title:win.document.title,
    location : win.document.location.href,
    preview : this.screenshotWindow(win,100,100),
    position : position
  };
}


macro.close_session = function () {
  var observer = {
    observe: function(subject, topic, data) {
      if (subject=='xpcom-shutdown') {
        dump("XPCOM SHUTDOWN!\n");dump("XPCOM SHUTDOWN!\n");dump("XPCOM SHUTDOWN!\n");dump("XPCOM SHUTDOWN!\n");dump("XPCOM SHUTDOWN!\n");dump("XPCOM SHUTDOWN!\n");
        dump("XPCOM SHUTDOWN!\n");dump("XPCOM SHUTDOWN!\n");dump("XPCOM SHUTDOWN!\n");dump("XPCOM SHUTDOWN!\n");dump("XPCOM SHUTDOWN!\n");dump("XPCOM SHUTDOWN!\n");
      } else if (subject=='profile-change-net-teardown') {
        dump("NET TEARDOWN!\n");dump("NET TEARDOWN!\n");dump("NET TEARDOWN!\n");dump("NET TEARDOWN!\n");dump("NET TEARDOWN!\n");dump("NET TEARDOWN!\n");dump("NET TEARDOWN!\n");dump("NET TEARDOWN!\n");dump("NET TEARDOWN!\n");dump("NET TEARDOWN!\n");dump("NET TEARDOWN!\n");dump("NET TEARDOWN!\n");dump("NET TEARDOWN!\n");
        dump("NET TEARDOWN!\n");dump("NET TEARDOWN!\n");dump("NET TEARDOWN!\n");dump("NET TEARDOWN!\n");dump("NET TEARDOWN!\n");dump("NET TEARDOWN!\n");dump("NET TEARDOWN!\n");dump("NET TEARDOWN!\n");dump("NET TEARDOWN!\n");dump("NET TEARDOWN!\n");dump("NET TEARDOWN!\n");dump("NET TEARDOWN!\n");dump("NET TEARDOWN!\n");
        //callback(true,null);
      }
    }
  };
  //callback(true,null);
  const os = Components.classes['@mozilla.org/observer-service;1']
 	      .getService(Components.interfaces.nsIObserverService);
  os.addObserver(observer, 'profile-change-net-teardown', false);
  os.addObserver(observer, 'xpcom-shutdown', false);
  var appStartup = Components.classes['@mozilla.org/toolkit/app-startup;1'].
      getService(Components.interfaces.nsIAppStartup);
  hiddenWindow.setTimeout(function () {
    appStartup.quit(Components.interfaces.nsIAppStartup.eForceQuit);
  },500);
}

macro.click = function (action, callback, count) {
  try {
    var node = this.getElement(action.node);
    if (!node) {
      if (count>70) {
        return callback(false,{msg:"Unable to find node"});
      }
      hiddenWindow.setTimeout(function () {
        macro.click(action, callback, count?count+1:1);
      }, 100);
      return;
    }
    
    var button = 0;
    var name = "click";
    if (action.type=="middle")
      button = 1;
    else if (action.type=="right")
      button = 2;
    else if (action.type=="double")
      name = "dblclick";
    
    var event = node.ownerDocument.createEvent("MouseEvents");
    event.initMouseEvent(name, true, true, node.ownerDocument.defaultView,
      0, 0, 0, 0, 0, false, false, false, false, button, null);
    
    node.dispatchEvent(event);
    callback(true,null);
  } catch(e) {
    //alert(e+"\n"+e.stack);
    callback(false,{msg:e.toString()});
  }
}

macro.keypress = function (action, callback, count) {
  try {
    var node = this.getElement(action.node);
    if (!node) {
      if (count>40) { // timeout on 4sec 
        return callback(false,{msg:"Unable to find node"});
      }
      hiddenWindow.setTimeout(function () {
        macro.click(action, callback, count?count+1:1);
      }, 100);
      return;
    }
    
    hiddenWindow.setTimeout(function(){
  
    var keyCodes = action.keys;
    for(var i=0; i<keyCodes.length; i++) {
      
      var code = parseInt(keyCodes.charCodeAt(i));
      /*
      var event = node.ownerDocument.createEvent("KeyboardEvent");
      event.initKeyEvent(                                                                                      
                     "keydown",        //  in DOMString typeArg,                                                           
                      true,             //  in boolean canBubbleArg,                                                        
                      true,             //  in boolean cancelableArg,                                                       
                      null,             //  in nsIDOMAbstractView viewArg,  Specifies UIEvent.view. This value may be null.     
                      false,            //  in boolean ctrlKeyArg,                                                               
                      false,            //  in boolean altKeyArg,                                                        
                      false,            //  in boolean shiftKeyArg,                                                      
                      false,            //  in boolean metaKeyArg,                                                       
                      code,               //  in unsigned long keyCodeArg,                                                      
                      code);              //  in unsigned long charCodeArg)
      node.dispatchEvent(event);
      */
      var event = node.ownerDocument.createEvent("KeyboardEvent");
      event.initKeyEvent(                                                                                      
                     "keypress",        //  in DOMString typeArg,                                                           
                      true,             //  in boolean canBubbleArg,                                                        
                      true,             //  in boolean cancelableArg,                                                       
                      null,             //  in nsIDOMAbstractView viewArg,  Specifies UIEvent.view. This value may be null.     
                      false,            //  in boolean ctrlKeyArg,                                                               
                      false,            //  in boolean altKeyArg,                                                        
                      false,            //  in boolean shiftKeyArg,                                                      
                      false,            //  in boolean metaKeyArg,                                                       
                      null,               //  in unsigned long keyCodeArg,                                                      
                      code);              //  in unsigned long charCodeArg)
      node.dispatchEvent(event);
      
      //node.value += keyCodes.charAt(i); 
      /*
      var event = node.ownerDocument.createEvent("KeyboardEvent");
      event.initKeyEvent(                                                                                      
                     "keyup",        //  in DOMString typeArg,                                                           
                      true,             //  in boolean canBubbleArg,                                                        
                      true,             //  in boolean cancelableArg,                                                       
                      null,             //  in nsIDOMAbstractView viewArg,  Specifies UIEvent.view. This value may be null.     
                      false,            //  in boolean ctrlKeyArg,                                                               
                      false,            //  in boolean altKeyArg,                                                        
                      false,            //  in boolean shiftKeyArg,                                                      
                      false,            //  in boolean metaKeyArg,                                                       
                      code,               //  in unsigned long keyCodeArg,                                                      
                      code);              //  in unsigned long charCodeArg)
      node.dispatchEvent(event);*/
      /*
      var event = document.createEvent('HTMLEvents');
      event.initEvent("change", true, true);
      node.dispatchEvent(event);
      */
      dump("keypress event : "+code+"\n");
    }
    
    callback(true,null);
    
    }, 250);
    
  } catch(e) {
    callback(false,{msg:e.toString()});
  }
  
}


macro.quit = function () {
  Components.utils.import("resource://fm-network/server.js");
  //stopFreemonkeyServer();
  
  hiddenWindow.setTimeout(function () {
    var appStartup = Components.classes['@mozilla.org/toolkit/app-startup;1'].
      getService(Components.interfaces.nsIAppStartup);
    appStartup.quit(Components.interfaces.nsIAppStartup.eForceQuit);
  }, 500);
}



macro.saveCanvas = function (canvas, destFile) {
  
  var file = Components.classes["@mozilla.org/file/local;1"]
                       .createInstance(Components.interfaces.nsILocalFile);
  file.initWithPath(destFile);

  var io = Components.classes["@mozilla.org/network/io-service;1"]
                     .getService(Components.interfaces.nsIIOService);
  var source = io.newURI(canvas.toDataURL("image/png", ""), "UTF8", null);
  var target = io.newFileURI(file);
  
  var persist = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
                          .createInstance(Components.interfaces.nsIWebBrowserPersist);
  
  persist.persistFlags = Components.interfaces.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES;
  persist.persistFlags |= Components.interfaces.nsIWebBrowserPersist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;
  
  persist.saveURI(source, null, null, null, null, file);
}







macro.selectNode = function (callback) {
  Components.utils.import("resource://fm-network/elementInspector.js");
  elementInspector.startHighlighting(callback);
}

macro.getNavigatorWnd = function () {
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
  return wm.getMostRecentWindow("navigator:browser");
}

addLocalObject("macro",macro);

/*
var lastKeycode=null;
document.addEventListener("keydown",function (evt) {
  
  lastKeycode = evt.keyCode;
  
},true);

document.addEventListener("keyup",function (evt) {
  
  if (evt.keyCode == 17 && !evt.ctrlKey && lastKeycode == 17) { //CTRL
    macro.toggleOvering();
  }
  
},true);
*/
