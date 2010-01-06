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


const clh_contractID = "@mozilla.org/commandlinehandler/general-startup;1?type=m-xul-macro";

const clh_CID = Components.ID("{2991c315-b871-42cd-b33f-bfee4fcbf682}");

// category names are sorted alphabetically. Typical command-line handlers use a
// category that begins with the letter "m".
const clh_category = "m-xul-macro";

/**
 * Utility functions
 */

/**
 * Opens a chrome window.
 * @param aChromeURISpec a string specifying the URI of the window to open.
 * @param aArgument an argument to pass to the window (may be null)
 */
function openWindow(aChromeURISpec, aArgument)
{
  var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].
    getService(Components.interfaces.nsIWindowWatcher);
  ww.openWindow(null, aChromeURISpec, "_blank",
                "chrome,menubar,toolbar,status,resizable,dialog=no",
                aArgument);
}
 
/**
 * The XPCOM component that implements nsICommandLineHandler.
 * It also implements nsIFactory to serve as its own singleton factory.
 */
const myAppHandler = {
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
  
  handle : function clh_handle(cmdLine)
  {
    if (this.alreadyOpened) 
      return dump("Already opened!\n");
    dump("Hop\n");
    this.alreadyOpened = true;
    try {
      var testFile = cmdLine.handleFlagWithParam("execute", false);
      if (testFile) {
        dump("Execute : "+testFile+"\n");
        testFile = cmdLine.resolveFile(testFile);
        if (!testFile.exists())
          return dump("Unable to find test file at : "+testFile.path+"\n");
        var resultTarget = cmdLine.handleFlagWithParam("out", false);
        if (resultTarget) {
          resultTarget = cmdLine.resolveFile(resultTarget);
        } else {
          resultTarget = testFile.parent;
          resultTarget.append(testFile.leafName.replace(/\..+/,".fmr"));
        }
        if (resultTarget.exists()) {
          Components.utils.reportError("Result file '"+resultTarget.path+"' already exists!\n");
          return dump("Result file '"+resultTarget.path+"' already exists!\n");
        }
        
        Components.utils.import("resource://xul-macro/actions.js");
        
        dump("Execute : "+testFile.path+"\nSave results in : "+resultTarget.path+"\n");
        Actions.executeFile(testFile,resultTarget, function () {
              dump("try to quit\n");
              appStartup.exitLastWindowClosingSurvivalArea();
              try {
                dump("closing firefox session\n");
                Actions.quit();
              } catch(e) {
                dump("Exception while closing firefox sessions : "+e+"\n");
              }
          });
        
      }
    }
    catch (e) {
      dump("Execute file error : "+e+"\n"+e.stack+"\n");
      appStartup.exitLastWindowClosingSurvivalArea();
    }
    

    try {
      if (cmdLine.handleFlag("nogui", false)) {
        dump("NO GUI!\n");
        //cmdLine.preventDefault = true;
        appStartup.enterLastWindowClosingSurvivalArea();
      } else {
        dump("With GUI\n");
        openWindow("chrome://freemonkeys/content/freemonkeys.html",null);
        //cmdLine.preventDefault = true;
      }
    } catch(e) {
      dump("Cmd line error : "+e+"\n");
    }
  },

  // CHANGEME: change the help info as appropriate, but
  // follow the guidelines in nsICommandLineHandler.idl
  // specifically, flag descriptions should start at
  // character 24, and lines should be wrapped at
  // 72 characters with embedded newlines,
  // and finally, the string should end with a newline
  helpInfo : "  -myapp               Open My Application\n" +
             "  -viewapp <uri>       View and edit the URI in My Application,\n" +
             "                       wrapping this description\n",

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
      return myAppHandler.QueryInterface(iid);

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

/* The NSGetModule function is the magic entry point that XPCOM uses to find what XPCOM objects
 * this component provides
 */
function NSGetModule(comMgr, fileSpec)
{
  return myAppHandlerModule;
}
