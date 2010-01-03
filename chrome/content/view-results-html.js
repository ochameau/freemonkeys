Components.utils.import("resource://xul-macro/actions.js");

const nativeJSON = Components.classes["@mozilla.org/dom/json;1"].createInstance(Components.interfaces.nsIJSON);

function loadOneResultFile(file) {
  var fileContents = "";
  var fstream = Components.classes["@mozilla.org/network/file-input-stream;1"].createInstance(Components.interfaces.nsIFileInputStream);
  var sstream = Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance(Components.interfaces.nsIScriptableInputStream);
  try {
  fstream.init(file, -1, 0, 0);
  
  sstream.init(fstream); 
  var str = sstream.read(4096);
  } catch(e) {
    dump("error opening file : "+file+"\n");
  }
  while (str.length > 0) {
      fileContents += str;
      str = sstream.read(4096);
  }
  var json = nativeJSON.decode(fileContents);
  delete str,fileContents;
  return json;
}


// Retrieve tests list by reading results directory
function getTestsList(directory) {
  var entries = directory.directoryEntries;
  var revisions = [];
  var files = {};
  while(entries.hasMoreElements())
  {
    var file = entries.getNext().QueryInterface(Components.interfaces.nsIFile);
    var t = file.leafName.match(/^(.+)-(\d+)\.fmr/);
    if (!t || t.length!=3) {
      dump("File ignored : "+file.leafName+"\n");
      continue;
    }
    var version = t[1];
    var testNb = t[2];
    dump(version +" --- "+testNb+"\n");
    if (revisions.indexOf(version)==-1)
      revisions.push(version);
    
    if (!files[version]) files[version]=[];
    files[version].push(file);
  }
  revisions = revisions.sort();
  return {revisions:revisions, files:files};
}

function loadResults(directory) {
  try {
    var tests = getTestsList(directory);
    var revisions = tests.revisions;
    var files = tests.files;
    var descriptions = {};
    
    // Process all tests for each revision in order to retrieve only the best one
    var bestTests = {};
    var overAllBestResultsNumber = null;
    var overAllBestTest = null;
    for(var i=0; i<revisions.length; i++) {
      var rev=revisions[i];
      /*
      var bestTest = null;
      var bestTime = null;
      var bestResultNumber = null;
      
      for(var j=0; j<files[rev].length; j++) {
        var file = files[rev][j];
        var test = loadOneResultFile(file);
        if (!bestTime || bestResultNumber<test.results.length || (bestResultNumber==test.results.length && bestTime>test.totalTime)) {
          bestTime = test.totalTime;
          bestTest = test;
          bestResultNumber = test.results.length;
          bestFile = file;
          if (!overAllBestTest || bestResultNumber>overAllBestResultsNumber) {
            overAllBestResultsNumber = bestResultNumber;
            overAllBestTest = test;
          }
        }
        delete test;
      }
      bestTests[rev] = {results:bestTest.results, totalTime:bestTest.totalTime, file:bestFile};
      */
      var tests = [];
      var bigestTestNumber = -1;
      for(var j=0; j<files[rev].length; j++) {
        var file = files[rev][j];
        var test = loadOneResultFile(file);
        tests.push({test : test, file : file});
        if (test.results.length > bigestTestNumber) {
          bigestTestNumber = test.results.length;
        }
      }
      var validTests = [];
      for(var j=0; j<tests.length; j++) {
        if (tests[j].test.results.length==bigestTestNumber)
          validTests.push(tests[j]);
      }
      delete tests;
      validTests.sort(function (a,b) {return (a.test.totalTime>b.test.totalTime?1:-1);});
      var bestTest = validTests[Math.round(validTests.length/1.1)];
      var bestTest = validTests[0];
      bestTests[rev] = {results:bestTest.test.results, totalTime:bestTest.test.totalTime, file:bestTest.file};
      if (!overAllBestTest || bestTest.test.results.length>overAllBestResultsNumber) {
        overAllBestResultsNumber = bestTest.test.results.length;
        overAllBestTest = bestTest.test;
      }
      delete validTests;
    }
    
    for(var testNb=0; testNb<overAllBestTest.results.length; testNb++) {
      var action = overAllBestTest.results[testNb].action;
      descriptions[testNb] = {type:action.type, detail:Actions.getActionDescription(action)};
    }
    
    delete files;
    
    // 2) Build Flot dataset
    var flotTicks = [];
    var flotDatasets = []; // Final flot datasets use for global graph with sumed values
    var originalDatasets = []; // Flot dataset for single views (view with only one test at a time)
    var datasets=[];
    var flotTotalDataset = [];
    for(var x=0; x<revisions.length; x++) {
      var rev=revisions[x];
      
      flotTicks.push([x, rev]);
      
      var test = bestTests[rev];
      var success = true;
      var total = 0;
      for(var j=0; j<test.results.length; j++) {
        var result = test.results[j];
        success &= result.success;
        if (!datasets[j]) datasets[j]=[];
        datasets[j][x]=result.time;
        total+=result.time;
      }
      
      flotTotalDataset.push([x, Math.max(test.totalTime,total+10) ]);
    }
    flotDatasets.push({label:"Total", data:flotTotalDataset});
    originalDatasets.push({label:"Total", data:flotTotalDataset});
    
    // 3) Configure Flot
    var currentY = [];
    for(var i=0;i<datasets.length;i++) {
      var summedDS=[];
      var originalDS=[];
      for(var j=0;j<datasets[i].length;j++) {
        if (!currentY[j])
          currentY[j] = 0;
        var value = datasets[i][j]?datasets[i][j]:0
        originalDS.push([j,value]);
        summedDS.push([j,currentY[j]+value]);
        currentY[j] += value;
      }
      dump("-->"+i+"/"+j+"\n");
      var label = "Test "+(i+1)+" ("+descriptions[i].type+")";
      flotDatasets.push({label:label, data:summedDS});
      originalDatasets.push({label:label, data: originalDS});
    }
    //inspect({tests:tests,flotDatasets:flotDatasets});
    var placeHolder = $("#results-graph");
    var options = 
      {
        lines: { show: true },
        points: { show: false },
        xaxis: {
            ticks: flotTicks,
            min: null,
            max: null
        },
        yaxis: {
            ticks: 10,
            min: null,
            max: null
        },
        grid: {
            backgroundColor: "#fffaff",
            hoverable: true
        },
        selection: { mode: "xy" }
      };
    
    var plot = null;
    
    placeHolder.bind("plotselected", function (event, ranges) {
        //$("#selection").text(ranges.xaxis.from.toFixed(1) + " to " + ranges.xaxis.to.toFixed(1));

        plot = $.plot(placeHolder, flotDatasets,
                      $.extend(true, {}, options, {
                          xaxis: { min: ranges.xaxis.from, max: ranges.xaxis.to },
                          yaxis: { min: ranges.yaxis.from, max: ranges.yaxis.to }
                      }));
    });
    
    var previousPoint=null;
    placeHolder.bind("plothover", function (event, pos, item) {
      if (item) {
        if (previousPoint != item.datapoint) {
          previousPoint = item.datapoint;
          var x = item.datapoint[0];//.toFixed(2),
              y = item.datapoint[1];//.toFixed(2);
          
          //inspect(item);
          var revision = revisions[x];
          var testNumber = item.seriesIndex-1;
          
          if (testNumber==-1) { // we are on total time result
            $("#overing-test").text(item.series.label+" with revision "+revision+" -> "+y+" ms");
            var img = document.getElementById("overing-img");
            img.style.display="none";
            $("#overing-test-action-desc").html("");
            return; 
          }
          
          
          $("#overing-test").html(item.series.label+" with revision "+revision+" -> "+y+" ms");
          //$("#overing-test-action-desc").html(descriptions[testNumber].detail);
          var test = loadOneResultFile(bestTests[revision].file).results[testNumber];
          if (!test) return;
          
          if (test.action.type=="screenshot") {
            var img = document.getElementById("overing-img");
            img.style.display="block";
            img.src=test.result.data;
            img.style.width=test.result.width+"px";
            img.style.height=test.result.height+"px";
          } else {
            var img = document.getElementById("overing-img");
            img.style.display="none";
          }
        }
      }
    });
    
    
    plot = $.plot(placeHolder, flotDatasets, options);
    
    $("#clearSelection").click(function () {
        try {
        plot.clearSelection();
        options.xaxis.min=null;
        options.yaxis.min=null;
        options.xaxis.max=null;
        options.yaxis.max=null;
        plot = $.plot(placeHolder, flotDatasets, options);
        alert("cleared");
        } catch(e) {
          alert(e);
        }
    });
    
    function refreshSelected() {
      var i = $("input[@name='data']:checked").val();
      var original = originalDatasets[i];
      var odata = original.data;
      var data = [];
      
      var datasets = [];
      
      if ($('#mean').attr('checked')) {
        /*
        var mean = data.length>0?data[0][1]:0;
        for(var i=0; i<data.length; i++) {
          data[i]=[].concat(data[i]);
          var v = data[i][1];
          data[i][1]=(mean+v)/2;
          mean=(mean+v)/2;
        }
        */
        var prevMean = 0;
        for(var i=0; i<odata.length-1; i++) {
          var v = odata[i][1];
          var vNext = odata[i+1][1];
          var mean = vNext-v;
          if (prevMean<0 && mean>0) {
            data.push([i,v]);
          }
          prevMean=mean;
        }
        //inspect([original.data,data]);
        datasets.push({label:"Mean",data:data});
      } else {
        datasets.push({label:original.label,data:odata});
      }
      options.yaxis.min=0;
      
      plot = $.plot(placeHolder, datasets, options);
    }
    $("#mean").click(function () {
      refreshSelected();
    });
    
    var choiceContainer = $("#axis");
    
    for(var i=0; i<flotDatasets.length; i++) {
      choiceContainer.append('<br/><input type="radio" name="data" value="' + i +
                               '" >' +  flotDatasets[i].label  + '</input>');
    }
    
    choiceContainer.change(
      function() {
          refreshSelected();
      }
    );
    window.clearSelection = function () {
      try {
          plot.clearSelection();
          options.xaxis.min=null;
          options.yaxis.min=null;
          options.xaxis.max=null;
          options.yaxis.max=null;
          plot = $.plot(placeHolder, flotDatasets, options);
          alert("cleared");
      } catch(e) {
        alert(e);
      }
    }

  } catch(e) {
    alert(e+"\n"+e.stack);
    dump("Load file error : "+e+"\n");
  }

}




function inspect(obj) {
  if (!top.inspectObject)
    return alert("You must install DOM Inspector!");
  top.inspectObject(obj);
}