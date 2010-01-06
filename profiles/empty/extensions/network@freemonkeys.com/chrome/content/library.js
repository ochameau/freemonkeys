function inspect(obj) {
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
  var win = wm.getMostRecentWindow("navigator:browser");
  if (!win.inspectObject)
    return alert("You must install DOM Inspector!");
  win.inspectObject(obj);
}




var screenshotId=1;

var macro = {

getWindow : function (winInfo) {
  var first=null;
  var last=null;
  var topmost=null;
  var maxZIndex=-10;
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                   .getService(Components.interfaces.nsIWindowMediator);
  var enumerator = wm.getXULWindowEnumerator(null);
  while(enumerator.hasMoreElements()) {
    var xulWin = enumerator.getNext().QueryInterface( Components.interfaces.nsIXULWindow);
    //inspect(["xulwin",xulWin]);
    var requestor = xulWin.docShell.QueryInterface(Components.interfaces.nsIInterfaceRequestor);
    var chromewin = requestor.getInterface(Components.interfaces.nsIDOMWindow);
    var domwin = chromewin.document.documentElement;
    //inspect(["domwin",domwin]);
    
    dump(winInfo.id+" =? "+domwin.id+" --- "+winInfo.type+" =? "+domwin.getAttribute("windowtype")+"\n");
    
    if (winInfo.id && winInfo.id!=domwin.id) continue;
    if (winInfo.type && winInfo.type!=domwin.getAttribute("windowtype")) continue;
    
    var zindex = xulWin.zLevel;
    
    if (zindex>maxZIndex) {
      maxZIndex=zindex;
      topmost=chromewin;
    }
    if (!first)
      first=chromewin;
    last=chromewin;
  }
  //inspect({winInfo:winInfo,first:first,last:last,topmost:topmost});
  if (winInfo.position=="first")
    return first;
  else if (winInfo.position=="last")
    return last;
  else
    return topmost;
},

getFrame : function (frame) {
  var win = this.getWindow(frame.win);
  if (frame) {
    var framesXPath=frame.frame.xpath;
    xpath=framesXPath.pop();
    var doc=win.document;
    for(var i=0; i<framesXPath.length; i++) {
      dump("EvalFrame : "+framesXPath[i]+"\n");
      var iframe=this.evalXPath(doc,framesXPath[i]);
      if (!iframe)
        return dump("frame not found ("+i+") : "+framesXPath[i]+"\n");
      dump("Walk throught frame -> "+((iframe&&iframe.tagName)?iframe.tagName:iframe)+"\n");
      doc=iframe.contentDocument;
      if (!doc)
        throw "Wait a frame but get : "+(iframe&&iframe.tagName?iframe.tagName:iframe);
      if (doc.wrappedJSObject)
        doc=doc.wrappedJSObject;
    }
    var eventHandler=this.evalXPath(doc,xpath);
    if (!eventHandler)
      throw "Unable to find frame with xpath = "+xpath+"\n"+frame.frame.xpath.join(", ");
    if (eventHandler.nodeType==9) { // We get a Document
      win = eventHandler.defaultView;
    } else if (!eventHandler.contentWindow) {
      throw "Selected frame "+eventHandler+"<"+eventHandler.tagName+"> is not a frame anymore...";
    } else {
      win = eventHandler.contentWindow;
    }
  }
  if (win.wrappedJSObject)
    win=win.wrappedJSObject;
  return win;
},

execute : function (action, callback, startTime, win) {
  if (!startTime) startTime=new Date().getTime();
  try {
    if (!win)
      win = this.getFrame(action.frame);
    
    var doc=win.document;
    if (doc.wrappedJSObject)
      doc=wrappedJSObject;
  
    var sandbox = new Components.utils.Sandbox(win); // Use DOM Window
    sandbox.window = win;
    sandbox.document = doc;
    var start=new Date().getTime();
    var v = Components.utils.evalInSandbox("with(window){"+action.script+"}", sandbox);
    callback(true, {value:v, time:new Date().getTime()-start});
  } catch(e) {
    dump("!!!!!!!!!!!!!!!!!"+e+"\n");
    if (new Date().getTime()-startTime>10000)
      callback(false,{msg:""+e, stack:""+e.stack});
    else
      window.setTimeout(function() {macro.execute(action,callback,startTime,win);});
  }
},

screenshotWindow : function (win, maxSize) {
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
},

getWindowsList : function () {
  var windows = [];
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                   .getService(Components.interfaces.nsIWindowMediator);
  var enumerator = wm.getEnumerator(null);
  while(enumerator.hasMoreElements()) {
    var win = enumerator.getNext();
    // |win| is [Object ChromeWindow] (just like |window|), do something with it
    domwin=win.document.documentElement;
    windows.push(this.getWindowInfo(win));
  }
  return windows;
},

// Wait a toplevel ChromeWindow
getWindowInfo : function (win) {
  var domwin = win.document.documentElement;
  return {
	    type : domwin.getAttribute("windowtype"),
      id : domwin.id,
      location : win.document.location.href,
      preview : this.screenshotWindow(win,100,100)
  };
},

getFramesList : function (winInfo) {
  
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
},

getFrameInfo : function (win) {
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
},

evalXPath : function (doc, xpath) {
  var results = doc.evaluate(xpath,doc,null,XPathResult.ANY_TYPE, null);
  return results.iterateNext();
},

getElement : function (nodeInfo) {
  var win;
  try {
    win = this.getFrame(nodeInfo.frame);
  } catch(e) {
    dump("Unable to found element because parent frame doesn't exists -> \n"+e);
    return null;
  }
  var doc = win.document;
  
  var xpath = nodeInfo.xpath;
  
  dump("Eval xpath : "+xpath+" in "+doc.location.href+"\n");
  var node=this.evalXPath(doc, xpath);
  if (!node)
    return dump("element not found with xpath = "+xpath);
  dump("Result : "+((node&&node.tagName)?node.tagName:node)+"\n");
  return node;
},
close_session : function () {
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
  window.setTimeout(function () {
    appStartup.quit(Components.interfaces.nsIAppStartup.eForceQuit);
  },500);
},
openurl : function (action, callback) {
  var url=action;
  
  var timeout = window.setTimeout(function () {
    callback(false,{msg:"Timeout!"});
  },10000);
  
  gBrowser.addEventListener("load", function (aEvent) {
    var doc = aEvent.originalTarget; 
    if (doc instanceof HTMLDocument && !doc.defaultView.frameElement){  
      if (gBrowser.selectedTab.linkedBrowser.contentDocument!=doc) return;
      gBrowser.removeEventListener("load", arguments.callee, true);
      window.clearTimeout(timeout);
      if (timeout)
        callback(true,null);
      timeout=null;
    }
  }, true);
  
  var win = this.getNavigatorWnd();
  win.openUILinkIn(url, 'current');
},
click : function (action, callback, count) {
  try {
    var node = this.getElement(action.node);
    if (!node) {
      if (count>70) {
        return callback(false,{msg:"Unable to find node"});
      }
      window.setTimeout(function () {
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
},
keypress : function (action, callback, count) {
  try {
    var node = this.getElement(action.node);
    if (!node) {
      if (count>40) { // timeout on 4sec 
        return callback(false,{msg:"Unable to find node"});
      }
      window.setTimeout(function () {
        macro.click(action, callback, count?count+1:1);
      }, 100);
      return;
    }
    
    window.setTimeout(function(){
  
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
  
},
screenshot : function (action, callback, count) {
  try {
    var node = this.getElement(action.node);
    if (!node) {
      if (count>70) {
        return callback(false,{msg:"Unable to find node"});
      }
      window.setTimeout(function () {
        macro.screenshot(action, callback, count?count+1:1);
      }, 100);
      return;
    }
    
    var pos=this.getElementPosInDoc(node);
    var canvas = this.rectToCanvas(node.ownerDocument.defaultView,pos.x,pos.y,node.offsetWidth,node.offsetHeight);
    
    var preview = {
      data : canvas.toDataURL("image/png", ""),
      width : node.boxObject?node.boxObject.width:node.offsetWidth,
      height : node.boxObject?node.boxObject.height:node.offsetHeight
    };
    callback(true,preview);
  } catch(e) {
    //alert(e+"\n"+e.stack);
    callback(false,{msg:e.toString()});
  }
  
},
quit : function () {
  window.setTimeout(function () {
    server.cleanPuppets();
  },250);
  window.setTimeout(function () {
    var appStartup = Components.classes['@mozilla.org/toolkit/app-startup;1'].
      getService(Components.interfaces.nsIAppStartup);
    appStartup.quit(Components.interfaces.nsIAppStartup.eForceQuit);
  }, 500);
},

getNavigatorWnd : function () {
	var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                   .getService(Components.interfaces.nsIWindowMediator);
	return wm.getMostRecentWindow("navigator:browser");
},

getXULSidebarWnd : function () {
	var browser=this.getNavigatorWnd();
	return browser.document.getElementById("yoono-sidebar").contentWindow;
},
getHTMLSidebarWnd : function () {
	var xul=this.getXULSidebarWnd();
	return xul.document.getElementById("yoonosb-iframe").contentWindow;
},
getSidebarElt : function (id) {
	return this.getHTMLSidebarWnd().document.getElementById(id);
},
getElementPosInDoc : function (obj) {
	var curleft = curtop = 0;
	if (obj.offsetParent) {
		do {
			curleft += obj.offsetLeft;
			curtop += obj.offsetTop;
		} while (obj = obj.offsetParent);
	}
	return {x:curleft,y:curtop};
},
getSidebarEltScreenPos : function (id) {
	var elt=this.getSidebarElt(id);
	var wnd=elt.ownerDocument.defaultView;
	var p=this.getElementPosInDoc(elt);
	var browser=this.getNavigatorWnd();
	var sidebar=browser.document.getElementById("yoono-sidebar");
	var x=p.x+sidebar.boxObject.screenX;
	var y=p.y+sidebar.boxObject.screenY;
	/*alert(p.x+"x"+p.y+"/"+sidebar.boxObject.screenX+"x"+sidebar.boxObject.screenY+" > "+x+"x"+y);*/
	return x+","+y+","+elt.clientWidth+","+elt.clientHeight;
},
saveCanvas : function (canvas, destFile) {
  
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
},
rectToCanvas : function (wnd, x,y,w,h) {
	
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
	
    var canvas = document.createElementNS("http://www.w3.org/1999/xhtml","canvas");
    canvas.width = w;
    canvas.height = h;
    
    var ctx = canvas.getContext("2d");
	/*
    ctx.scale(300 / windowWidth,
              300 / windowHeight);
	*/
    ctx.drawWindow(wnd,
                   x, y,
                   w, h,
                   "rgb(0,0,0)");
	
	return canvas;
},
screenSidebar : function (file) {
	var browser=this.getNavigatorWnd();
	var sidebar=browser.document.getElementById("yoono-sidebar").boxObject;
	var canvas = this.rectToCanvas(browser,sidebar.x,sidebar.y,sidebar.width,sidebar.height);
	this.saveCanvas(canvas,file);
},
screenSidebarElt : function (id,file) {
	var elt=this.getSidebarElt(id);
	var pos=this.getElementPosInDoc(elt);
	var browser=this.getNavigatorWnd();
	var sidebar=browser.document.getElementById("yoono-sidebar");
	var canvas = this.rectToCanvas(sidebar.contentWindow,pos.x,pos.y,elt.clientWidth,elt.clientHeight);
	this.saveCanvas(canvas,file);
},

_currentOver:null,
highlightOver : function (screenX, screenY) {
try {
	if (this._currentOver) {
		this._currentOver.style.border="";
	}
	var browser=this._overing;
	var x=screenX-browser.document.documentElement.boxObject.screenX;
	var y=screenY-browser.document.documentElement.boxObject.screenY;
	var elt=browser.document.elementFromPoint(x,y);
	var s="";
  var iframes=[];
	while(elt && elt.contentWindow) {
		var p=elt.boxObject?elt.boxObject:this.getElementPosInDoc(elt);
		s+=x+"x+"+y;
		x=x-p.x;
		y=y-p.y;
		s+=" -("+elt.tagName+":"+elt.id+"-"+p.x+"x"+p.y+")> "+x+"x"+y;
    iframes.push(elt);
		elt=elt.contentWindow.document.elementFromPoint(x,y);
	}
	if (!elt)
		return "no elt > "+s;
  
  // Hightlight current element
	elt.style.border="1px solid red";
  
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
},






getXPathElement : function (frames, xpath) {
  
  var browser=this.getNavigatorWnd();
  var doc = browser.document;
  
  for(var i=0; i<frames.length; i++) {
    var results = doc.evaluate(frames[i],doc,null,XPathResult.ANY_TYPE, null);
    var iframe=results.iterateNext();
    if (!iframe)
      return alert("frame not found ("+i+") : "+frames[i]);
    doc=iframe.contentDocument;
    if (doc.wrappedJSObject)
      doc=doc.wrappedJSObject;
  }
  
  var results = doc.evaluate(xpath,doc,null,XPathResult.ANY_TYPE, null);
  var node=results.iterateNext();
  if (!node)
    return alert("element not found with xpath = "+xpath);
  
  var pos=this.getElementPosInDoc(node);
  var canvas = this.rectToCanvas(node.ownerDocument.defaultView,pos.x,pos.y,node.offsetWidth,node.offsetHeight);
  var imageData = canvas.toDataURL("image/png", "");
  
  var obj= {
    xpath : xpath,
    framesXPath : frames,
    preview : {
      data : imageData,
      width : node.boxObject?node.boxObject.width:node.offsetWidth,
      height : node.boxObject?node.boxObject.height:node.offsetHeight
    }
  };
  return obj.toSource();
},
  
getNodeInfo : function (node, dontGetPreview) {
  if (!node)
    return null;
  
  function isUniqueId(doc,id) {
    var results = doc.evaluate('id("'+id+'")',doc,null,XPathResult.ANY_TYPE, null);
    //alert(results.iterateNext()+" && "+results.iterateNext());
    return results.iterateNext() && !results.iterateNext();
  }
  
  
  function getXPath(elt,rootNode) {
    var doc = elt.ownerDocument;
    
    // Try to ignore dynamic generated ids like panel201392193 in <tabbrowser> ...
    if (elt.id && !elt.id.match(/\d{5,}/) &&  isUniqueId(doc,elt.id)) {
      return ["id('"+elt.id+"')"];
    }
    
    var path = [];
    if (elt == doc.documentElement || elt==rootNode) {
      path = [""]; // in order to add a '/' at xpath begin (with xpath.join('/'))
    } else if(elt.parentNode) {
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
    var p=elt.boxObject?elt.boxObject:this.getElementPosInDoc(elt);
		x=x-p.x;
		y=y-p.y;
		
		elt=elt.contentWindow.document.elementFromPoint(x,y);
	}
  
  var binding = node.ownerDocument.getBindingParent(node);
  
  var obj = {
    xpath : getXPath(binding?binding:node).join('/'),
    binding : binding?getXPath(node,binding).join('/'):null,
    framesXPath : framesPaths
  };
  
  if (!dontGetPreview) {
    var canvas = this.rectToCanvas(node.ownerDocument.defaultView,pos.x,pos.y,node.offsetWidth,node.offsetHeight);
    obj.preview = {
      data : canvas.toDataURL("image/png", ""),
      width : node.offsetWidth,
      height : node.offsetHeight
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
		var p=elt.boxObject?elt.boxObject:this.getElementPosInDoc(elt);
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

},


selectNode : function (callback) {
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                   .getService(Components.interfaces.nsIWindowMediator);
  var win = wm.getMostRecentWindow(null);
  win.focus();
  this.startOvering(win, callback);
},
_overListener : function (evt) {
  var x=evt.screenX;
  var y=evt.screenY;
  if (x!=this.lastX || y!=this.lastY) {
    this.lastX=x;
    this.lastY=y;
    macro.highlightOver(x,y);
  }
},
_overing : false,
_overingStatus : null,
stopOvering : function () {
  if (this._overing) {
    if (this._currentOver)
      this._currentOver.style.border="";
    this._overing.document.removeEventListener("mousemove",this._overListener,true);
    this._overing=false;
  }
},
startOvering : function (win,callback) {
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
      callback(_self.getWindowInfo(win), _self.getFrameInfo(_self._currentOver.ownerDocument.defaultView), _self.getNodeInfo(_self._currentOver));
    },true);
}

};

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




////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////// SERVER

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
var inited=false;
var puppets=[];
Server.prototype.onSocketAccepted = function (serv, transport) {
  dump("SOCKET ACCEPTED!!!!\n");
  if (!inited) {
    inited=true;
    addLocalObject("root",Root);
    addLocalObject("macro",macro);
  }
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

var server = new Server(9000);
server.start();



var Root = {
  a : "A",
  b : 2,
  c : function (a1,a2,a3) {return "c"+a1+a2+a3;},
  d : {
    e: "e",
    f: 6,
    g: function (o) {return "g"+o.a;},
    h: { i:"i" }
  },
  callback : function(f) {
    f();
  }
};
