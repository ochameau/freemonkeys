var windows = {};

Components.utils.import("resource://fm-network/knownTopWindows.js");

windows.MonkeyTab = 
  function MonkeyTab(gBrowser, tab) {
    var linkedBrowser = tab.linkedBrowser;
    var webNavigation = linkedBrowser.webNavigation;
    
    this.__defineGetter__("document", function () {
      return linkedBrowser.contentDocument;
    });
    this.open = function (url) {
      linkedBrowser.loadURI(url,null,null);
    }
    this.close = function () {
      gBrowser.removeTab(tab);
    }
    this.back = function () {
      if (webNavigation.canGoBack)
        webNavigation.goBack();
    }
    this.forward = function () {
      if (webNavigation.canGoForward)
        webNavigation.goForward();
    }
    this.reload = function () {
      webNavigation.reload(webNavigation.LOAD_FLAGS_BYPASS_PROXY | webNavigation.LOAD_FLAGS_BYPASS_CACHE);
    }
    this.getInternal = function () {
      return tab;
    }
  };

windows.MonkeyWindow = 
  function MonkeyWindow(win) {
    this.win = win;
    var gBrowser = win.gBrowser;
    this.__defineGetter__("document", function () {
      return win.document;
    });
    this.tabs = {
      new : function (url, doNotSelect) {
        if (!url) url="about:blank";
        var tab = gBrowser.addTab(url);
        if (!doNotSelect)
          gBrowser.selectedTab = tab;
        return new windows.MonkeyTab(gBrowser, tab);
      },
      get current() {
        return new windows.MonkeyTab(gBrowser, gBrowser.selectedTab);
      },
      selectPrevious : function () {
        gBrowser.tabContainer.advanceSelectedTab(-1, true);
      },
      selectNext : function () {
        gBrowser.tabContainer.advanceSelectedTab(1, true);
      }
    }
    this.minimize = function () {
      win.minimize();
    }
    this.maximize = function () {
      win.maximize();
    }
    this.close = function () {
      win.close();
    }
    this.getInternal = function () {
      return win;
    }
  };

windows.ORDER_BY_ZORDER = "by_zorder";
windows.ORDER_BY_CREATION_DATE = "by_date";
// Sorted from the last recent to the newer
// or from the bottom to the top
windows.getList = function (id, type, name, location, order) {
  var list = [];
  
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                   .getService(Components.interfaces.nsIWindowMediator);
  var enumerator;
  if (order==windows.ORDER_BY_CREATION_DATE)
    enumerator = wm.getXULWindowEnumerator(type?type:null);
  else
    enumerator = wm.getZOrderXULWindowEnumerator(type?type:null,false);
  while(enumerator.hasMoreElements()) {
    var xulWin = enumerator.getNext().QueryInterface(Components.interfaces.nsIXULWindow);
    var requestor = xulWin.docShell.QueryInterface(Components.interfaces.nsIInterfaceRequestor);
    var chromewin = requestor.getInterface(Components.interfaces.nsIDOMWindow);
    var domwin = chromewin.document.documentElement;
    
    if (id && id!=domwin.id) continue;
    //if (type && type!=domwin.getAttribute("windowtype")) continue;
    if (name && name!=chromewin.name) continue;
    if (location && location!=chromewin.document.location.href) continue;
    
    // return only windows wrapper
    list.push(new windows.MonkeyWindow(chromewin));
  }
  
  return list;
};

windows.getByZindex = function (id, type, name, location, position) {
  var list = windows.getList(id, type, name, location, windows.ORDER_BY_ZORDER);
  if (position=="bottommost")
    return list[0];
  else if (typeof position=="number")
    return list[position];
  return list[list.length-1];
}

windows.getRegistered = function (id, position) {
try {
  var info = null;
  for(var i=0; i<knownTopWindows.length; i++) {
    var w = knownTopWindows[i];
    if (w.id == id) {
      info = w; break;
    }
  }
  if (!info) throw new Error("Unknown window id : "+id);
  var list = windows.getList(info.params.id, info.params.type, info.params.name, info.params.location, windows.ORDER_BY_ZORDER);
  var win = null;
  if (position=="bottommost")
    win = list[0];
  else if (typeof position=="number")
    win = list[position];
  else {
    position = "topmost";
    win = list[list.length-1];
  }
  if (!win) throw new Error("No such window at position: "+position);
  return win;
} catch(e) {
  ___api_exception(e);
}
}

windows.sub = function (parentWin, iframeXPath) {
try {
  return elements._waitForDefined(
    function () {
      var doc = parentWin.document;
      var results = doc.evaluate(iframeXPath,doc,null,Components.interfaces.nsIDOMXPathResult.ANY_TYPE, null);
      var iframe = results.iterateNext();
      if (!iframe) return null;
      return new windows.MonkeyWindow(iframe.contentWindow);
    });
} catch(e) {
  if (e && e.message=="waitForDefined")
    ___api_exception("Unable to found node with xpath:"+iframeXPath);
  else
    ___api_exception(e);
}
}
