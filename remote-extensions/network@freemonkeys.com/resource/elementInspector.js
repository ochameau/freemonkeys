const EXPORTED_SYMBOLS = ["elementInspector"];

Components.utils.import("resource://fm-network/knownTopWindows.js");

function inspect(obj) {
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
  var win = wm.getMostRecentWindow("navigator:browser");
  if (!win.inspectObject)
    return alert("You must install DOM Inspector!");
  win.inspectObject(obj);
}

const hiddenWindow = Components.classes["@mozilla.org/appshell/appShellService;1"]
         .getService(Components.interfaces.nsIAppShellService)
         .hiddenDOMWindow;

const elementInspector = {};

elementInspector.callback = null;
elementInspector.startHighlighting = function (callback) {
  this.callback = callback;
  
  this.stopHighlighting();
  
  var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].getService(Components.interfaces.nsIWindowWatcher);
  var infoWin = ww.openWindow(
                null, // parent
                "data:text/html;charset=utf-8,",
                "fm-node-info", // name
                "resizable=no,scrollbars=no,status=no,width=1,height=1,popup=yes", 
                null); // arguments
  infoWin.addEventListener("load",function () {
    infoWin.document.body.innerHTML="...";
    infoWin.document.body.style.backgroundColor="transparent";
    var width = 400; var height = 200;
    infoWin.resizeTo(400,200);
    infoWin.moveTo(hiddenWindow.screen.availWidth-width-20,hiddenWindow.screen.availHeight-height-20);
  },false);
  this.infoWin = infoWin;
  
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                   .getService(Components.interfaces.nsIWindowMediator);
  var enumerator = wm.getEnumerator(null);
  while(enumerator.hasMoreElements()) {
    var win = enumerator.getNext();
    this.registerWindow(win);
  }
  var win = wm.getMostRecentWindow(null);
  win.focus();
}

elementInspector.stopHighlighting = function () {
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                   .getService(Components.interfaces.nsIWindowMediator);
  var enumerator = wm.getEnumerator(null);
  while(enumerator.hasMoreElements()) {
    var win = enumerator.getNext();
    this.unregisterWindow(win);
  }
  
  if (this.infoWin) {
    this.infoWin.close();
    this.infoWin=null;
  }
  
  if (this._currentOver)
    this.unhighlightNode(this._currentOver);
}

elementInspector.registerWindow = function (win) {
  win.document.addEventListener("mousemove",this._overListener,true);
  win.document.addEventListener("click",this._clickListener,true);
}

elementInspector.unregisterWindow = function (win) {
  win.document.removeEventListener("mousemove",this._overListener,true);
  win.document.removeEventListener("click",this._clickListener,true);
}

// /!\ this != elementInspector /!\
elementInspector._clickListener = function (event) {
  if (event.originalTarget.ownerDocument.defaultView.name=="fm-node-info") return;
  
  event.stopPropagation();
  event.preventDefault();
  
  elementInspector.stopHighlighting();
  
  hiddenWindow.setTimeout(function () {
    elementInspector.callback(elementInspector.getWindowInfo(elementInspector._currentOver), elementInspector.getNodeInfo(elementInspector._currentOver));
  },100);
}

elementInspector._currentOver = null;

// /!\ this != elementInspector /!\
elementInspector._overListener = function (event) {
  if (event.originalTarget.ownerDocument.defaultView.name=="fm-node-info") return;
  
  var x=event.screenX;
  var y=event.screenY;
  if (x==elementInspector.lastX && y==elementInspector.lastY)
    return;
  elementInspector.lastX=x;
  elementInspector.lastY=y;
  if (event.originalTarget==elementInspector._currentOver)
    return;
  if (elementInspector._currentOver) {
    elementInspector.unhighlightNode(elementInspector._currentOver);
  }
  elementInspector._currentOver = event.originalTarget;
  elementInspector.updateNodeInfo(elementInspector._currentOver);
  elementInspector.highlightNode(elementInspector._currentOver);
}

elementInspector.highlightNode = function (node) {
  node.style.setProperty("border","1px solid red","important");
}

elementInspector.unhighlightNode = function (node) {
  node.style.removeProperty("border");
}

elementInspector.identifyWindow = function (win) {
  for(var i=0; i<knownTopWindows.length; i++) {
    var w = knownTopWindows[i];
    if (typeof w.params.type=="string" && w.params.type!=win.type) continue;
    if (typeof w.params.id=="string" && w.params.id!=win.id) continue;
    if (typeof w.params.name=="string" && w.params.name!=win.name) continue;
    if (typeof w.params.location=="string" && w.params.location!=win.location) continue;
    return w.id;
  }
  return null;
}

elementInspector.getWindowIdentity = function (id) {
  for(var i=0; i<knownTopWindows.length; i++) {
    var w = knownTopWindows[i];
    if (w.id == id) return w;
  }
  return null;
}

elementInspector.updateNodeInfo = function (node) {
  var info = this.getNodeInfo(node);
  var html = "";
  html += '<div style="font-size: 0.8em;margin-bottom: 10px;">';
  
  html += '<div style="font-weight: bold; font-size: 1em; padding-bottom: 10px;">';
  
  function printWindow(winInfo) {
    if (winInfo.type=="sub-known") {
      var identity = elementInspector.getWindowIdentity(winInfo.id);
      html += "Child win: "+identity.name+"<br />";
      html += "Of ";
      printWindow(winInfo.parent);
    } else if (winInfo.type=="sub-unknown") {
      html += "Unknown child win: "+winInfo.xpath+" <br />";
      html += "Of ";
      printWindow(winInfo.parent);
    } else if (winInfo.type=="tab") {
      html += "Current firefox tab<br />";
      html += "Of ";
      printWindow(winInfo.top);
    } else if (winInfo.type=="top-known") {
      var identity = elementInspector.getWindowIdentity(winInfo.id);
      html += identity.name;
      if (winInfo.position.isFirst)
        html += " first";
      if (winInfo.position.isLast)
        html += " last";
      html += " "+winInfo.position.index+"-nth";
    } else if (winInfo.type=="top-unknown") {
      html += "Unknown top win : id="+winInfo.info.id+" name="+winInfo.info.name+" type="+winInfo.info.type+" location="+winInfo.info.location;
      if (winInfo.position.isFirst)
        html += " first";
      if (winInfo.position.isLast)
        html += " last";
      html += " "+winInfo.position.index+"-nth";
    }
  }
  html += 'Window: ';
  
  printWindow(this.getWindowInfo(node));
  
  
  html += '</div>';
  
  html += '<div style="font-weight: bold; font-size: 1em; padding-bottom: 10px;">'+info.xpath+'</div>';
  if (info.binding)
    html += '<div style="font-size: 1em; padding-bottom: 10px;">anonymous: '+info.binding+'</div>';
  html += '<div style="text-align: center">';
  html += '<img src="'+info.preview.data+'" style="max-width:350px; max-height: 150px;border: 1px solid #ddd; -moz-box-shadow:0 0 10px #000; " width="'+info.preview.width+'" height="'+info.preview.height+'" />'
  html += '</div>';
  this.infoWin.document.body.innerHTML=html;
}

elementInspector.getXPath = function (elt,rootNode) {
  function isUniqueId(doc,id) {
    var results = doc.evaluate('id("'+id+'")',doc,null,Components.interfaces.nsIDOMXPathResult.ANY_TYPE, null);
    //alert(results.iterateNext()+" && "+results.iterateNext());
    return results.iterateNext() && !results.iterateNext();
  }
  
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
      // TODO: Check that this node is unique
      var root = "//";
      if (elt.parentNode == doc.documentElement || elt.parentNode==rootNode)
        root = "/";
      return [root+elt.tagName/*.replace(/^.+:/,"")*/.toLowerCase()+"[@anonid='"+anonid+"']"];
    }
  }
  
  var path = [];
  if (elt == doc.documentElement || elt==rootNode) {
    path = [""]; // in order to add a '/' at xpath begin (with xpath.join('/'))
  } else if(elt.parentNode && elt.parentNode!=rootNode) {
    path = this.getXPath(elt.parentNode,rootNode);
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
  
  path.push( elt.tagName/*.replace(/^.+:/,"")*/.toLowerCase() + ( count ? "["+count+"]" : '[1]') );
  
  return path;
}

elementInspector.getNodeInfo = function (node, dontGetPreview) {
  if (!node)
    return null;
  
  
  
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
  
  var result = {};
  
  var anonymous = [];
  var binding = node;
  var doc = binding.ownerDocument; 
  while(doc.getBindingParent(binding)) {
    var newBinding = doc.getBindingParent(binding);
    if (doc.getAnonymousNodes(newBinding)) {
      // Weird thing on xul:textbox, default label is an anonymous <html:div> node (child of <html:input>)
      // which isn't retrieved by document.getAnonymousNode !?!
      anonymous.unshift(this.getXPath(binding,newBinding).join('/'));
    }
    binding = newBinding;
  }
  if (binding == node) binding = null;
  else result.anonymous = anonymous;
  
  result.xpath = this.getXPath(binding?binding:node).join('/');
  
  if (!dontGetPreview) {
    var bo = getBoxobject(node);
    var sc = this.rectToCanvas(node.ownerDocument.defaultView,bo.x,bo.y,bo.width,bo.height);
    result.preview = {
      data : sc.canvas.toDataURL("image/png", ""),
      width : sc.width,
      height : sc.height
    };
  }
  
  return result;
}

elementInspector.getWindowInfo = function (node) {
  var win = node.ownerDocument.defaultView;
  
  var topWindow = win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                   .getInterface(Components.interfaces.nsIWebNavigation)
                   .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
                   .rootTreeItem
                   .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                   .getInterface(Components.interfaces.nsIDOMWindow);
  /*
  // Get parent <iframe/browser> node ?
  var parentWindow = win.QueryInterface(nsIInterfaceRequestor)
                        .getInterface(nsIWebNavigation)
                        .QueryInterface(nsIDocShellTreeItem)
                        .treeOwner // or .parent
                        .QueryInterface(nsIInterfaceRequestor)
                        .getInterface(nsIBaseWindow);
  */
  
  /*
  // Opened by ?
  win.opener
  */
  
  function getWindowParams(win) {
    return {
      id: win.document.documentElement.id,
      type: win.document.documentElement.getAttribute("windowtype"),
      name: win.name,
      title: win.document.title,
      location: win.document.location.href
    };
  }
  var topWindowAttributes = getWindowParams(topWindow);
  var topWindowId = this.identifyWindow(topWindowAttributes);
  
  // Compute top window position
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                   .getService(Components.interfaces.nsIWindowMediator);
  var enumerator = wm.getZOrderXULWindowEnumerator(topWindowAttributes.type?topWindowAttributes.type:null,true);
  var sameTopWindows = [];
  while(enumerator.hasMoreElements()) {
    var xulWin = enumerator.getNext().QueryInterface(Components.interfaces.nsIXULWindow);
    var requestor = xulWin.docShell.QueryInterface(Components.interfaces.nsIInterfaceRequestor);
    var chromewin = requestor.getInterface(Components.interfaces.nsIDOMWindow);
    var domwin = chromewin.document.documentElement;
    
    if (topWindowAttributes.id && topWindowAttributes.id!=domwin.id) continue;
    //if (topWindowAttributes.type && topWindowAttributes.type!=domwin.getAttribute("windowtype")) continue;
    if (topWindowAttributes.name && topWindowAttributes.name!=chromewin.name) continue;
    if (topWindowAttributes.location && topWindowAttributes.location!=chromewin.document.location.href) continue;
    
    sameTopWindows.push(chromewin);
  }
  var zIndex = sameTopWindows.indexOf(topWindow);
  for(var i=0; i<sameTopWindows.length; i++) {
    var w = sameTopWindows[i];
    if (w==topWindow) 
      zIndex=i;
  }
  var position = {
    isFirst: zIndex==0,
    index: zIndex,
    isLast: (zIndex==sameTopWindows.length-1)
  };
  //inspect([position,sameTopWindows]);
  var topWindowInfo;
  if (topWindowId)
    topWindowInfo = { 
      type:"top-known", 
      id: topWindowId, 
      position: position
    };
  else
    topWindowInfo = {
      type: "top-unknown",
      info: topWindowAttributes, 
      position: position
    };
  
  function recurseOnWin(win) {
    if (win==topWindow)
      return topWindowInfo;
    // Is a child window of another one
    var parentWindow = win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                        .getInterface(Components.interfaces.nsIWebNavigation)
                        .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
                        .parent // .treeOwner or .parent
                        .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                        .getInterface(Components.interfaces.nsIDOMWindow);
    
    var winAttributes = getWindowParams(win);
    var winId = elementInspector.identifyWindow(winAttributes);
    if (winId) // Is a identified one!
      return { type:"sub-known", id : winId, parent : recurseOnWin(parentWindow) };
    // Try to check if this is a tab
    if (topWindowId=="firefox-window") {
      try {
        var gBrowser = topWindow.wrappedJSObject.gBrowser;
        var tabIndex = gBrowser.getBrowserIndexForDocument(win.document);
        if (tabIndex==-1) throw new Error("Not a tab");
        var browser = gBrowser.getBrowserAtIndex(tabIndex);
        if (!browser) throw new Error("Unable to get related browser");
        return { 
          type:"tab", 
          info : {
            isFirst: tabIndex==0,
            isLast: (gBrowser.browsers.length==tabIndex+1),
            isCurrent: (gBrowser.mCurrentBrowser==browser), // Obviously always true
            index: tabIndex
          },
          top : topWindowInfo
        };
      } catch(e) {
        Components.utils.reportError(e);
      }
    }
    
    var element = null;
    
    //Components.utils.reportError("search iframe in parent : "+parentWindow.document.location.href);
    
    var iframes = parentWindow.document.getElementsByTagName("iframe");
    for(var i=0; i<iframes.length; i++) {
      var iframe=iframes[i];
      Components.utils.reportError(iframe.contentWindow+" == "+win);
      if (iframe.contentWindow == win) {
        element = iframe;
        break;
      }
    }
    if (!element) {
      var iframes = parentWindow.document.getElementsByTagName("browser");
      for(var i=0; i<iframes.length; i++) {
        var iframe=iframes[i];
        Components.utils.reportError(iframe.contentWindow+" == "+win);
        if (iframe.contentWindow == win) {
          element = iframe;
          break;
        }
      }
    }
    if (!element)
      Components.utils.reportError("Unable to found matching iframe/browser !!!");
    
    /*
    var parentDocshell = win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                        .getInterface(Components.interfaces.nsIWebNavigation)
                        .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
                        .parent // .treeOwner or .parent
                        .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                        .getInterface(Components.interfaces.nsIDocShell);
    
    var docshell = elt.QueryInterface(Ci.nsIInterfaceRequestor)
                           .getInterface(Ci.nsIWebNavigation)
                           .QueryInterface(Ci.nsIDocShell);
      if (!docshell.chromeEventHandler)
    */
    /*
    var iface = Components.interfaces.nsIDocShellTreeItem;
    var docShellEnum = parentDocshell.getDocShellEnumerator(iface.typeAll, iface.ENUMERATE_FORWARDS);
    
    //inspect(parentDocshell.chromeEventHandler);
    
    while(docShellEnum.hasMoreElements()) {
      var docShell = docShellEnum.getNext();
      if(docShell instanceof Components.interfaces.nsIDocShell) {
        var domDocument = docShell.contentViewer.DOMDocument;
        //if(domDocument instanceof HTMLDocument) {
          Components.utils.reportError("docshell : "+docShell+" / "+domDocument);
          if (!docShell.chromeEventHandler) {
            inspect([docShell,domDocument]);
            continue;
          }
          //if (domDocument == win.document)
          docShell.chromeEventHandler.QueryInterface(Components.interfaces.nsIDOMElement);
            inspect(docShell.chromeEventHandler);
            
        //}
      }
    }
    */
    
    return {
      type: "sub-unknown",
      win: winAttributes,
      xpath: element?elementInspector.getXPath(element).join('/'):"",
      parent : recurseOnWin(parentWindow)
    };
  }
  
  return recurseOnWin(win);
}

elementInspector.rectToCanvas = function (wnd, x,y,w,h, maxSize) {
	
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

elementInspector.getElementAt = function (screenX, screenY) {
  var s="";
  var iframes=[];
	
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
  
  //Components.utils.reportError(s);
}
