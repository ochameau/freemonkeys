var elements = {};



elements.MonkeyElement = 
  function MonkeyElement(node) {
    this.__defineGetter__("node", function () {
      return node;
    });
    this.getBoxobject = function () {
      var elt = node;
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
        var bo = this.getBoxobject();
        var sc = this.rectToCanvas(node.ownerDocument.defaultView,bo.x,bo.y,bo.width,bo.height, maxSize?maxSize:600);
        var data = sc.canvas.toDataURL("image/jpeg", "");
        ___listener("screenshot",Components.stack.caller.lineNumber+1,{boxObject:bo, data:data});
        return data;
      } catch(e) {
        ___api_exception(e);
      }
    }
    
    this.click = function click(type) {
      try {
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
    },
    
    this.type = function keypress(text) {
      try {
        for(var i=0; i<text.length; i++) {
          var code = parseInt(text.charCodeAt(i));
          
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
          
          //node.value += text.charAt(i); 
          
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
          node.dispatchEvent(event);
          /*
          var event = node.ownerDocument.createEvent('HTMLEvents');
          event.initEvent("change", true, true);
          node.dispatchEvent(event);
          */
        }
      } catch(e) {
        ___api_exception(e);
      }
    }
  }

elements._waitForDefined = function(fun) {
  var start = new Date().getTime();
  
  var result;
  var exception = null;
  
  function wait() {
    try {
      result = fun();
    } catch(e) {
      exception = e;
    }
  }
  
  var timeoutInterval = setInterval(wait, 100);
  
  var thread = Components.classes["@mozilla.org/thread-manager;1"]
            .getService()
            .currentThread;
  
  while((typeof result=="undefined" || result==null) && new Date().getTime()-start < 2000) {
    thread.processNextEvent(true);
  }
  
  clearInterval(timeoutInterval);
  
  if (typeof result!="undefined" && result!=null)
    return result;
  if (exception)
    throw new Error(exception.message?exception.message:exception);
  else
    throw new Error("waitForDefined");
}

elements.xpath = function xpath(win, xpath) {
  try {
    var node = elements._waitForDefined(
      function () {
        var doc = win.document;
        if (!doc) return;
        
        //if (doc.wrappedJSObject) doc = doc.wrappedJSObject;
        // XPathResult = Components.interfaces.nsIDOMXPathResult
        var results = doc.evaluate(xpath,doc,null,Components.interfaces.nsIDOMXPathResult.ANY_TYPE, null);
        return results.iterateNext();
      });
    return new elements.MonkeyElement(node);
  } catch(e) {
    if (e && e.message=="waitForDefined")
      ___api_exception("Unable to found node with xpath:"+xpath);
    else
      ___api_exception(e);
  }
}

elements.xblpath = function xblpath(win, xblpath) {
  try {
    var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                       .getService(Components.interfaces.mozIJSSubScriptLoader); 
    var xpathJSLib = null;
    var onlyOne = false;
    var node = elements._waitForDefined(
      function () {
        var doc = win.document;
        if (!doc) return;
        
        //if (doc.wrappedJSObject) doc = doc.wrappedJSObject;
        // XPathResult = Components.interfaces.nsIDOMXPathResult
        var results = doc.evaluate(xblpath[0],doc,null,Components.interfaces.nsIDOMXPathResult.ANY_TYPE, null);
        var node = results.iterateNext();;
        
        if (!xpathJSLib) {
          xpathJSLib = {};
          try {
            xpathJSLib.navigator = doc.defaultView.navigator;
            loader.loadSubScript("resource://fm-network/api/xpath/xmltoken.js", xpathJSLib);
            loader.loadSubScript("resource://fm-network/api/xpath/util.js", xpathJSLib);
            loader.loadSubScript("resource://fm-network/api/xpath/dom.js", xpathJSLib);
            loader.loadSubScript("resource://fm-network/api/xpath/xpath.js", xpathJSLib);
            //inspect(xpathJSLib);
          } catch(e) {
            Components.utils.reportError(e);
          }
        }
        try {
          for(var x=1; x<xblpath.length; x++) {
            var anon = doc.getAnonymousNodes(node);
            
            var fakeNode = {
              childNodes : anon,
              firstChild : anon[0],
              lastChild : anon[anon.length-1],
              attributes : node.attributes,
              nodeType : node.nodeType,
              nodeName : node.nodeName,
              nodeValue : node.nodeValue,
              ownerDocument : doc,

              nextSibling : node.nextSibling,
              previousSibling : node.previousSibling,
              parentNode : node.parentNode,
              hasAttributes : function() {
                Components.utils.reportError("hasAttribute");
                return this.attributes.length > 0;
              },
              getAttribute : function(name) {
                Components.utils.reportError("getAttribute");
                for (var i = 0; i < this.attributes.length; ++i) {
                  if (this.attributes[i].nodeName == name) {
                    return this.attributes[i].nodeValue;
                  }
                }
                return null;
              },
              getElementsByTagName : function(name) {
                var l = [];
                for(var i=0; i<this.childNodes.length; i++) {
                  var r = this.childNodes[i].getElementsByTagName(name);
                  for(var j=0; j<r.length; j++)
                    l.push(r[j]);
                }
                return l;
              },
              getElementById : function(id) {
                Components.utils.reportError("getById");
              }
              
            };
            
            
            try {
              var result2 = xpathJSLib.xpathDomEval("."+xblpath[x],fakeNode)
            } catch(e) {
              Components.utils.reportError(e);
            }
            if (!onlyOne) {
              onlyOne=true;
              //inspect(result2);
            }
            node = result2.value && result2.value.length>0?result2.value[0]:null
            
            if (!node) return;
          }
        } catch(e) {
          Components.utils.reportError(e);
          return;
        }
        
        return node;

      });
    return new elements.MonkeyElement(node);
  } catch(e) {
    if (e && e.message=="waitForDefined")
      ___api_exception("Unable to found node with xpath:"+xblpath.join(", "));
    else
      ___api_exception(e);
  }
}

elements.selector = function selector(win, selector) {
  
}
