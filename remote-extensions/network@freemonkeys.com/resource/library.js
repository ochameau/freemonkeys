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
  hiddenWindow.setTimeout(function () {
    server.cleanPuppets();
  },250);
  hiddenWindow.setTimeout(function () {
    var appStartup = Components.classes['@mozilla.org/toolkit/app-startup;1'].
      getService(Components.interfaces.nsIAppStartup);
    appStartup.quit(Components.interfaces.nsIAppStartup.eForceQuit);
  }, 500);
}

macro.getElementPosInDoc = function (obj) {
  if (obj.boxObject)
    return {x:obj.boxObject.x, y:obj.boxObject.y};
  var curleft = curtop = 0;
	if (obj.offsetParent) {
		do {
			curleft += obj.offsetLeft;
			curtop += obj.offsetTop;
		} while (obj = obj.offsetParent);
	}
	return {x:curleft,y:curtop};
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

macro.rectToCanvas = function (wnd, x,y,w,h, maxSize) {
	
	var windowWidth = wnd.innerWidth;
  var windowHeight = wnd.innerHeight;
	
	if (!x)
		x=0;
	if (!y)
		y=0;
	if (!w)
		w=windowWidth;
	if (!h)
		h=windowHeight;
  
	if (!maxSize)
    maxSize = Math.max(w,h);
  
  var width=w, height=h;
  if (width>maxSize || height>maxSize) {
    if (w>h) {
      height = Math.round(height * maxSize/width);
      width = maxSize;
    } else {
      width = Math.round(width * maxSize/height);
      height = maxSize;
    }
  }
  
  var canvas = hiddenWindow.document.createElementNS("http://www.w3.org/1999/xhtml","canvas");
  canvas.width = width;
  canvas.height = height;
  
  var ctx = canvas.getContext("2d");

  ctx.scale(width / w,
            height / h);
            
  ctx.drawWindow(wnd,
                 x, y,
                 w, h,
                 "rgb(255,255,255)");
  
	return {canvas:canvas,width:width,height:height};
}

macro._currentOver = null;
macro.highlightOver = function (screenX, screenY,elt) {
try {
	if (this._currentOver) {
		this._currentOver.style.removeProperty("border");
	}
  var s="";
  var iframes=[];
	/*
  function isVisible(obj) {
    if (!obj) return false;
    if (!obj.parentNode) return false;
    
    var style = obj.ownerDocument.defaultView.getComputedStyle(obj, "");
    if (style.display == 'none') return false;
    if (style.visibility == 'hidden') return false;
    return true;
  }
  
  function elementFromPoint(doc, x, y) {
    var elt=doc.elementFromPoint(x,y);
    var anonymousNodes = elt.ownerDocument.getAnonymousNodes(elt);
    if (anonymousNodes && anonymousNodes.length>0) {
      //Components.utils.reportError("Got anonymous nodes!");
      for(var i=0; i<anonymousNodes.length; i++) {
        var np=macro.getElementPosInDoc(anonymousNodes[i]);
        var width = anonymousNodes[i].clientWidth;
        var height = anonymousNodes[i].clientHeight;
        //var debug = anonymousNodes[i].tagName+" -> "+np.x+"<="+x+" && "+np.y+"<="+y+" && "+x+"<="+np.x+"+"+width+" && "+y+"<="+np.y+"+"+height;
        if (np.x<=x && np.y<=y && x<=np.x+width && y<=np.y+height && isVisible(anonymousNodes[i])) {
          //Components.utils.reportError("MATCH : "+debug);
          elt = anonymousNodes[i];
          anonymousNodes = elt.childNodes;
          i=-1;
          if (!anonymousNodes || anonymousNodes.length==0)
            break;
          continue;
        } else {
          //Components.utils.reportError("no match : "+debug);
        }
      }
    }
    return elt;
  }
  
  var browser=this._overing;
	var x=screenX-browser.document.documentElement.boxObject.screenX;
	var y=screenY-browser.document.documentElement.boxObject.screenY;
	var elt = elementFromPoint(browser.document, x, y);
  
	
  
	while(elt && elt.contentWindow) {
		var p=this.getElementPosInDoc(elt);
		s+=x+"x"+y;
		x=x-p.x;
		y=y-p.y;
		s+=" -("+elt.tagName+":"+elt.id+"-"+p.x+"x"+p.y+")> "+x+"x"+y;
    iframes.push(elt);
		elt=elementFromPoint(elt.contentWindow.document, x, y);
	}
  */
  //Components.utils.reportError(s);
	if (!elt)
		return "no elt > "+s;
  
  // Hightlight current element
	elt.style.setProperty("border","1px solid red","important");
  
  // Save a reference
	this._currentOver=elt;
  this._currentOver.iframesList=iframes;
  
  return;
  // Update status message
  var status="<"+elt.tagName+"> ";
  if (elt.id)
    status+="#"+elt.id+" ";
  if (elt.className)
    status+="."+elt.className.replace(" ",",")+" ";
  if (s)
    status+="---"+s;
	this._overingStatus.setAttribute("label",status);
  
} catch(e) {
	throw "error > "+(s?s:e);
}
}


macro.getNodeInfo = function (node, dontGetPreview) {
  if (!node)
    return null;
  
  function isUniqueId(doc,id) {
    var results = doc.evaluate('id("'+id+'")',doc,null,Components.interfaces.nsIDOMXPathResult.ANY_TYPE, null);
    //alert(results.iterateNext()+" && "+results.iterateNext());
    return results.iterateNext() && !results.iterateNext();
  }
  
  function getXPath(elt,rootNode) {
    var doc = elt.ownerDocument;
    
    // Try to ignore dynamic generated ids like panel201392193 in <tabbrowser> ...
    if (elt.id && !elt.id.match(/\d{5,}/) &&  isUniqueId(doc,elt.id)) {
      return ["id('"+elt.id+"')"];
    }
    
    // In case of an anonymous node
    // Try to check if anonid attribute is unique
    if (rootNode) {
      var anonid = elt.getAttribute("anonid");
      if (anonid) {
        // Check that this node is unique
        return [elt.tagName.replace(/^.+:/,"").toLowerCase()+"[@anonid='"+anonid+"']"];
      }
    }
    
    var path = [];
    if (elt == doc.documentElement || elt==rootNode) {
      path = [""]; // in order to add a '/' at xpath begin (with xpath.join('/'))
    } else if(elt.parentNode && elt.parentNode!=rootNode) {
      path = getXPath(elt.parentNode,rootNode);
    }
    
    if(elt.previousSibling) {
      var count = 1;
      var sibling = elt.previousSibling
      do {
        if(sibling.nodeType == 1 && sibling.nodeName == elt.nodeName) {count++;}
        sibling = sibling.previousSibling;
      } while(sibling);
      if(count == 1) {count = null;}
    }
    
    path.push( elt.tagName.replace(/^.+:/,"").toLowerCase() + ( count ? "["+count+"]" : '[1]') );
    
    return path;
  }
  
  function getBoxobject(elt) {
    var boxobject = null;
    // html case
    if (elt.ownerDocument && elt.ownerDocument.getBoxObjectFor)
      boxobject=elt.ownerDocument.getBoxObjectFor(elt);
    // xul case
    if (!boxobject)
      boxobject=elt.boxObject;
    // problem case
    if (!boxobject) {
      dump("unable to get easily boxobject : "+elt.tagName);
      var docshell = elt.QueryInterface(Ci.nsIInterfaceRequestor)
                           .getInterface(Ci.nsIWebNavigation)
                           .QueryInterface(Ci.nsIDocShell);
      if (!docshell.chromeEventHandler)
        inspect(docshell);
      var boxobject = docshell.chromeEventHandler.boxObject;
      if (boxobject) {
        dump("getboxobject with doshell xul : "+docshell.chromeEventHandler.tagName);
      }
      if (!boxobject) {
        dump("get boxobject with docshell html : "+docshell.chromeEventHandler.tagName+"/"+docshell.chromeEventHandler.ownerDocument.tagName);
        boxobject = docshell.chromeEventHandler.ownerDocument.getBoxObjectFor(docshell.chromeEventHandler);
      }
      if (!boxobject)
        dump("Unable to get boxobject!!!");
    }
    return boxobject;
  }
  
  // Get all ancestors iframes
  var pos=this.getElementPosInDoc(node);
  //var screenX = node.ownerDocument.defaultView.screenX+pos.x;
  //var screenY = node.ownerDocument.defaultView.screenY+pos.y;
  var bo = getBoxobject(node);
  var screenX = bo.screenX;
  var screenY = bo.screenY;
  var browser=this.getNavigatorWnd();
	var x=screenX-browser.document.getElementById("main-window").boxObject.screenX;
	var y=screenY-browser.document.getElementById("main-window").boxObject.screenY;
	var elt=browser.document.elementFromPoint(x,y);

  var framesPaths = [];
  
	while(elt && elt.contentWindow) {
	    if (elt.tagName!="tabbrowser")
		framesPaths.push(getXPath(elt).join('/'));
    var p=this.getElementPosInDoc(elt);
		x=x-p.x;
		y=y-p.y;
		
		elt=elt.contentWindow.document.elementFromPoint(x,y);
	}
  
  var binding = node;
  while(binding.ownerDocument.getBindingParent(binding)) {
    binding = binding.ownerDocument.getBindingParent(binding);
  }
  if (binding == node) binding = null;
  
  var obj = {
    xpath : getXPath(binding?binding:node).join('/'),
    binding : binding?getXPath(node,binding).join('/'):null,
    framesXPath : framesPaths,
    pos : pos
  };
  
  if (!dontGetPreview) {
    var sc = this.rectToCanvas(node.ownerDocument.defaultView,bo.x,bo.y,bo.width,bo.height);
    obj.preview = {
      data : sc.canvas.toDataURL("image/png", ""),
      width : sc.width,
      height : sc.height
    };
  }
  
  return obj;

  var pos=this.getElementPosInDoc(node);
  
  
  // Search the first parent node with an ID
  var parentWithId=null;
  var cur=node.parentNode;
  while(cur) {
    if (cur.id)
        parentWithId=cur;
    cur=cur.parentNode;
  }

  // Get all ancestors iframes
  var framesPos = [];
  var screenX = node.ownerDocument.defaultView.screenX+pos.x;
  var screenY = node.ownerDocument.defaultView.screenY+pos.y;
  var browser=this.getNavigatorWnd();
	var x=screenX-browser.document.getElementById("main-window").boxObject.screenX;
	var y=screenY-browser.document.getElementById("main-window").boxObject.screenY;
	var elt=browser.document.elementFromPoint(x,y);

	while(elt && elt.contentWindow) {
		var p=this.getElementPosInDoc(elt);
		x=x-p.x;
		y=y-p.y;
    framesPos.push({elt:elt.id, x:p.x, y:p.y});
		elt=elt.contentWindow.document.elementFromPoint(x,y);
	}

  if (parentWithId.wrappedJSObject)
    parentWithId = parentWithId.wrappedJSObject;

  var obj={
    id : node.id,
    parentWithId : parentWithId.id,
    X : pos.x,
    Y : pos.y,
    framesPos : framesPos
  };
  return obj;

}


macro.selectNode = function (callback) {
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                   .getService(Components.interfaces.nsIWindowMediator);
  var win = wm.getMostRecentWindow(null);
  win.focus();
  this.startOvering(win, callback);
}

macro._overListener = function (evt) {
  var x=evt.screenX;
  var y=evt.screenY;
  if (x!=this.lastX || y!=this.lastY) {
    this.lastX=x;
    this.lastY=y;
    var prevOver = macro._currentOver;
    macro.highlightOver(x,y,evt.originalTarget);
    if (prevOver!=macro._currentOver) {
      macro.updateNodeInfo(macro._currentOver);
    }
  }
}
macro._overing = false;
macro._overingStatus = null;
macro.stopOvering = function () {
  if (this._overing) {
    if (this._currentOver)
      this._currentOver.style.border="";
    this._overing.document.removeEventListener("mousemove",this._overListener,true);
    this._overing=false;
  }
  if (this.infoWin) {
    this.infoWin.close();
    this.infoWin=null;
  }
}
macro.startOvering = function (win,callback) {
  this.stopOvering();
  
  this._overing=win;
  if (!this._overingStatus) {
    /*
    var doc=this.getNavigatorWnd().document;
    this._overingStatus=doc.createElement("statusbarpanel");
    var container=doc.getElementById("status-bar");
    container.insertBefore(this._overingStatus,container.firstChild);
    */
  }
  win.document.addEventListener("mousemove",this._overListener,true);
  var _self=this;
  win.document.addEventListener("click",function (event) {
      event.stopPropagation();
      event.preventDefault();
      win.document.removeEventListener("click",arguments.callee,true);
      _self.stopOvering();
      callback(null, null, _self.getNodeInfo(_self._currentOver));
    },true);
  
  infoWin = hiddenWindow.open('data:text/html;charset=utf-8,',"node-info","resizable=no,scrollbars=no,status=no,width=1,height=1,popup=yes");
  infoWin.addEventListener("load",function () {
    infoWin.document.body.innerHTML="...";
    infoWin.document.body.style.backgroundColor="transparent";
    var width = 400; var height = 200;
    infoWin.resizeTo(400,200);
    infoWin.moveTo(hiddenWindow.screen.availWidth-width-20,hiddenWindow.screen.availHeight-height-20);
  },false);
  this.infoWin = infoWin;
}
macro.updateNodeInfo = function (node) {
  var info = this.getNodeInfo(node);
  var html = "";
  html += '<div style="font-weight: bold; font-size: 1em; padding-bottom: 10px;">'+info.xpath+'</div>';
  if (info.binding)
    html += '<div style="font-size: 1em; padding-bottom: 10px;">anonymous: '+info.binding+'</div>';
  html += '<div style="text-align: center">';
  html += '<img src="'+info.preview.data+'" style="max-width:350px; max-height: 150px;border: 1px solid #ddd; -moz-box-shadow:0 0 10px #000; " width="'+info.preview.width+'" height="'+info.preview.height+'" />'
  html += '</div>';
  this.infoWin.document.body.innerHTML=html;
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
