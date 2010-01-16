const EXPORTED_SYMBOLS = ["elementInspector"];

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
  
  infoWin = hiddenWindow.open('data:text/html;charset=utf-8,',"fm-node-info","resizable=no,scrollbars=no,status=no,width=1,height=1,popup=yes");
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
  elementInspector.callback(null, null, elementInspector.getNodeInfo(elementInspector._currentOver));
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

elementInspector.updateNodeInfo = function (node) {
  var info = this.getNodeInfo(node);
  var html = "";
  html += '<div style="font-size: 0.8em;margin-bottom: 10px;">';
  if (info.win) {
    html += "<div>Child window with: title="+info.win.title+" name="+info.win.name+" location="+info.win.location+"</div>";
  }
  html += "<div>";
  if (info.win)
    html += "Of window with: ";
  else
    html += "Window with: ";
  html += "id="+info.topWindow.id+" title="+info.topWindow.title+" type="+info.topWindow.type+" name="+info.topWindow.name+"</div>";
  
  if (info.opener)
    html += "<div>Opened by window with: id="+info.opener.id+" title="+info.opener.title+" name="+info.opener.name+"</div>";
  html += '</div>';
  html += '<div style="font-weight: bold; font-size: 1em; padding-bottom: 10px;">'+info.xpath+'</div>';
  if (info.binding)
    html += '<div style="font-size: 1em; padding-bottom: 10px;">anonymous: '+info.binding+'</div>';
  html += '<div style="text-align: center">';
  html += '<img src="'+info.preview.data+'" style="max-width:350px; max-height: 150px;border: 1px solid #ddd; -moz-box-shadow:0 0 10px #000; " width="'+info.preview.width+'" height="'+info.preview.height+'" />'
  html += '</div>';
  this.infoWin.document.body.innerHTML=html;
}

elementInspector.getNodeInfo = function (node, dontGetPreview) {
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
  
  var binding = node;
  while(binding.ownerDocument.getBindingParent(binding)) {
    binding = binding.ownerDocument.getBindingParent(binding);
  }
  if (binding == node) binding = null;
  
  var win = node.ownerDocument.defaultView;
  
  var topWindow = win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                   .getInterface(Components.interfaces.nsIWebNavigation)
                   .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
                   .rootTreeItem
                   .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                   .getInterface(Components.interfaces.nsIDOMWindow);
  var topDomWindow = topWindow.document.documentElement;
  
  var obj = {
    xpath : getXPath(binding?binding:node).join('/'),
    binding : binding?getXPath(node,binding).join('/'):null,
    topWindow : {
      id: topWindow.document.documentElement.id,
      type : topWindow.document.documentElement.getAttribute("windowtype"),
      title : topWindow.document.title,
      name: topWindow.name,
      location: topWindow.document.location.href
    }
  };
  
  if (win!=topWindow) {
    obj.win = {
      name: win.name,
      title: win.document.title,
      location: win.document.location.href
    };
  }
  
  if (win.opener) {
    obj.opener = {
      id: win.opener.document.documentElement.id,
      type: win.opener.document.documentElement.getAttribute("windowtype"),
      name: win.opener.name,
      title: win.opener.document.title,
      location: win.opener.document.location.href
    };
  }
  
  if (!dontGetPreview) {
    var bo = getBoxobject(node);
    var sc = this.rectToCanvas(node.ownerDocument.defaultView,bo.x,bo.y,bo.width,bo.height);
    obj.preview = {
      data : sc.canvas.toDataURL("image/png", ""),
      width : sc.width,
      height : sc.height
    };
  }
  
  return obj;
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
