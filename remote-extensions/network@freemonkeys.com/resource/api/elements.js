var elements = {};



elements.MonkeyElement = 
  function MonkeyElement(getter) {
    
    this._cache = null;
    this.waitForNode = function () {
      if (this._cache) return this._cache;
      
      var start = new Date().getTime();
      
      var node = false;
      var exception;
      
      var self=this;
      function wait() {
        try {
          node = self.getNode();
        } catch(e) {
          exception = e;
        }
      }
      
      var timeoutInterval = setInterval(wait, 100);
      
      var thread = Components.classes["@mozilla.org/thread-manager;1"]
                .getService()
                .currentThread;

      while(!node && new Date().getTime()-start < 2000) {
        thread.processNextEvent(true);
      }
      
      clearInterval(timeoutInterval);
      
      if (node)
        return node;
      if (exception)
        throw new Error(exception.message?exception.message:exception);
      else
        throw new Error("Unable to found this node");
    }
    
    this.getNode = function () {
      if (this._cache) return this._cache;
      try {
        this._cache = getter();
      } catch(e) {
        throw new Error("Unable to retrieve node : "+(e.message?e.message:e));
      }
      if (!this._cache)
        throw new Error("Unable to found this node");
      return this._cache;
    }
    
    this.getBoxobject = function () {
      var elt = this.waitForNode();
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
    
    this.rectToCanvas = function (wnd, x,y,w,h, maxSize) {
      
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
      
      var hiddenWindow = Components.classes["@mozilla.org/appshell/appShellService;1"]
         .getService(Components.interfaces.nsIAppShellService)
         .hiddenDOMWindow;
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
    
    this.screenshot = function screenshot(maxSize) {
      try {
        var node = this.waitForNode();
        var bo = this.getBoxobject();
        var sc = this.rectToCanvas(node.ownerDocument.defaultView,bo.x,bo.y,bo.width,bo.height, maxSize?maxSize:600);
        var data = sc.canvas.toDataURL("image/jpeg", "");
        listener("screenshot",Components.stack.caller.lineNumber+1,data);
        return data;
      } catch(e) {
        ___api_exception(e);
      }
    }
    
    this.click = function click(type) {
      try {
        var node = this.waitForNode();
        
        var button = 0;
        var name = "click";
        if (type == "middle")
          button = 1;
        else if (type == "right")
          button = 2;
        else if (type == "double")
          name = "dblclick";
        
        var event = node.ownerDocument.createEvent("MouseEvents");
        event.initMouseEvent(name, true, true, node.ownerDocument.defaultView,
          0, 0, 0, 0, 0, false, false, false, false, button, null);
        
        node.dispatchEvent(event);
      } catch(e) {
        ___api_exception(e);
      }
    }
  }

elements.xpath = function (win, xpath, anonymousXPath) {
  return new elements.MonkeyElement(
    function () {
      var doc = win.document;
      //if (doc.wrappedJSObject) doc = doc.wrappedJSObject;
      // XPathResult = Components.interfaces.nsIDOMXPathResult
      var results = doc.evaluate(xpath,doc,null,Components.interfaces.nsIDOMXPathResult.ANY_TYPE, null);
      return results.iterateNext();
    });
}

elements.selector = function (win, selector) {
  
}
