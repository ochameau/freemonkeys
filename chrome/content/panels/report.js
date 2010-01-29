const gFMReport = {
  
  get reportList () {
    delete this.reportList;
    this.reportList = document.getElementById("report-list");
    return this.reportList;
  }
  
};

gFMReport.clean = function () {
  this.reportList.innerHTML = "";
}

gFMReport.print = function (classname, type, time, msg) {
  this.reportList.innerHTML += '<li class="'+classname+'">('+time+') '+type+" : "+msg+"</li>";
}
