var windows = {};

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

windows.ORDER_BY_ZORDER = 1;
windows.ORDER_BY_CREATION_DATE = 2;
windows.get = function (id, type, title, order) {
  var list = [];
  
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                   .getService(Components.interfaces.nsIWindowMediator);
  var enumerator = wm.getXULWindowEnumerator(null);
  while(enumerator.hasMoreElements()) {
    var xulWin = enumerator.getNext().QueryInterface( Components.interfaces.nsIXULWindow);
    var requestor = xulWin.docShell.QueryInterface(Components.interfaces.nsIInterfaceRequestor);
    var chromewin = requestor.getInterface(Components.interfaces.nsIDOMWindow);
    var domwin = chromewin.document.documentElement;
    
    if (id && id!=domwin.id) continue;
    if (type && type!=domwin.getAttribute("windowtype")) continue;
    if (title && title!=domwin.getAttribute("title")) continue;
    
    var zindex = xulWin.zLevel;
    
    list.push({zindex:zindex,win:chromewin});
  }
  
  // Sort the retrieved list
  if (!order || order == monkey.windows.ORDER_BY_ZORDER) {
    list.sort(function (a,b) {return a.zindex<b.zindex;});
  }
  
  // Remove work info and return only windows wrapper
  var result = [];
  for(var i=0; i<list.length; i++) {
    result.push(new windows.MonkeyWindow(list[i].win));
  }
  
  return result;
};
