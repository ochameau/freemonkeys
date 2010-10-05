const nsIAppShellService    = Components.interfaces.nsIAppShellService;
const nsISupports           = Components.interfaces.nsISupports;
const nsICategoryManager    = Components.interfaces.nsICategoryManager;
const nsIComponentRegistrar = Components.interfaces.nsIComponentRegistrar;
const nsICommandLine        = Components.interfaces.nsICommandLine;
const nsICommandLineHandler = Components.interfaces.nsICommandLineHandler;
const nsIFactory            = Components.interfaces.nsIFactory;
const nsIModule             = Components.interfaces.nsIModule;
const nsIWindowWatcher      = Components.interfaces.nsIWindowWatcher;


const appStartup = Components.classes['@mozilla.org/toolkit/app-startup;1'].
    getService(Components.interfaces.nsIAppStartup);


const clh_contractID = "@mozilla.org/commandlinehandler/general-startup;1?type=m-freemonkeys-network";

const clh_CID = Components.ID("{2991c315-b871-42cd-b33f-bfee4fcbf682}");

// category names are sorted alphabetically. Typical command-line handlers use a
// category that begins with the letter "m".
const clh_category = "m-freemonkeys-network";

/**
 * Utility functions
 */
 
/**
 * The XPCOM component that implements nsICommandLineHandler.
 * It also implements nsIFactory to serve as its own singleton factory.
 */
function myComponent() {
}
myComponent.prototype = {
  // this must match whatever is in chrome.manifest!
  classID: Components.ID("{2991c315-b871-42cd-b33f-bfee4fcbf682}"),


  /* nsISupports */
  QueryInterface : function clh_QI(iid)
  {
    if (iid.equals(nsICommandLineHandler) ||
        iid.equals(nsIFactory) ||
        iid.equals(nsISupports))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },
  
  /* nsICommandLineHandler */
  alreadyOpened : false,
  
  server : null,
  
  handle : function clh_handle(cmdLine)
  {
    var port;
    try {
      port = parseInt(cmdLine.handleFlagWithParam("fmport", false));
    } catch(e) {}
    if (!port)
      port = 9000;
    
    Components.utils.import("resource://fm-network/server.js");
    Components.utils.reportError("Starting freemonkey server on port : "+port+"\n");
    dump("Starting freemonkey server on port : "+port+"\n");
    this.server = startFreemonkeyServer(port);
    
  },

  // CHANGEME: change the help info as appropriate, but
  // follow the guidelines in nsICommandLineHandler.idl
  // specifically, flag descriptions should start at
  // character 24, and lines should be wrapped at
  // 72 characters with embedded newlines,
  // and finally, the string should end with a newline
  helpInfo : "  -fmport               Freemonkey port\n",
             

  /* nsIFactory */

  createInstance : function clh_CI(outer, iid)
  {
    if (outer != null)
      throw Components.results.NS_ERROR_NO_AGGREGATION;

    return this.QueryInterface(iid);
  },

  lockFactory : function clh_lock(lock)
  {
    /* no-op */
  }
};

/**
 * The XPCOM glue that implements nsIModule
 */
const myAppHandlerModule = {
  /* nsISupports */
  QueryInterface : function mod_QI(iid)
  {
    if (iid.equals(nsIModule) ||
        iid.equals(nsISupports))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  /* nsIModule */
  getClassObject : function mod_gch(compMgr, cid, iid)
  {
    if (cid.equals(clh_CID))
      return myComponent.prototype.QueryInterface(iid);

    throw Components.results.NS_ERROR_NOT_REGISTERED;
  },

  registerSelf : function mod_regself(compMgr, fileSpec, location, type)
  {
    compMgr.QueryInterface(nsIComponentRegistrar);

    compMgr.registerFactoryLocation(clh_CID,
                                    "myAppHandler",
                                    clh_contractID,
                                    fileSpec,
                                    location,
                                    type);

    var catMan = Components.classes["@mozilla.org/categorymanager;1"].
      getService(nsICategoryManager);
    catMan.addCategoryEntry("command-line-handler",
                            clh_category,
                            clh_contractID, true, true);
  },

  unregisterSelf : function mod_unreg(compMgr, location, type)
  {
    compMgr.QueryInterface(nsIComponentRegistrar);
    compMgr.unregisterFactoryLocation(clh_CID, location);

    var catMan = Components.classes["@mozilla.org/categorymanager;1"].
      getService(nsICategoryManager);
    catMan.deleteCategoryEntry("command-line-handler", clh_category);
  },

  canUnload : function (compMgr)
  {
    return true;
  }
};

try {
  Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
  var NSGetFactory = XPCOMUtils.generateNSGetFactory([myComponent]);
} catch(e) {
  /* The NSGetModule function is the magic entry point that XPCOM uses to find what XPCOM objects
   * this component provides
   */
  function NSGetModule(comMgr, fileSpec)
  {
    return myAppHandlerModule;
  }
}
  
