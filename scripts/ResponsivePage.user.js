// ==UserScript==
// @name       ResponsivePage
// @namespace  http://lifia.unlp.edu.ar
// @author	   Mauricio Witkin, Ramon Serrano
// @version    0.9
// @description  Transform legacy web application to mobile platforms.
// @match      https://*/*
// @match      http://*/*
// @require    https://code.jquery.com/jquery-2.1.4.min.js
// @grant      GM_registerMenuCommand
// @noframes
// @run-at document-end
// ==/UserScript==

(function() {
	'use strict';

	if (window.jQuery){
		$('head script[src*="jquery"]').remove();
	}

	GM_registerMenuCommand('Importar configuración', importJson);
	GM_registerMenuCommand('Eliminar datos almacenados', delLocalSite, "L");

	var siteAdaptation = [];
	var pageUrl = window.location.href;
	var localStoragedError = "El navegador Web no tiene soporte de almacenamiento Local Storage.";
	
	initialize();

	function initialize() {	
		var siteAdaptationStorage = getLocalSite();
		if (siteAdaptationStorage) {
			siteAdaptation = siteAdaptationStorage;
			if($.isArray(siteAdaptation)) {
				var index = indexOfCompareByEquals(siteAdaptation, pageUrl, "url");
				if (index < 0) {
					index = indexOfCompareByIncludes(siteAdaptation, pageUrl, "url");
				}
				if (index > -1) {
					executePageAdaptation(index);
				}
			}
		}
	}

	function executePageAdaptation(index) {
		var pageStorage = siteAdaptation[index];
		var objectParent = constructObject(pageStorage.pageAdaptation);
		runPage(objectParent,$("body"),$("head"), pageStorage.template);
	}

	function importJson() {
		var dataImport = prompt("Importar la configuración. Ingrese el JSON correspondiente");
		/* La longitud debe tener un minimo de datos para asegurar la estructura inicial del Json. */
		if(dataImport.length >= 50 ){
			var siteImport = JSON.parse(dataImport);
			if($.isArray(siteImport)) {
				saveLocalSite(siteImport);
				siteAdaptation = siteImport;
				var index = indexOfCompareByEquals(siteAdaptation, pageUrl, "url");
				if (index < 0) {
					index = indexOfCompareByIncludes(siteAdaptation, pageUrl, "url");
				}
				if (index > -1) {
					executePageAdaptation(index);
				}
				alert("Se ha importado correctamente la configuración.");
			}
			else {
				alert("Los datos ingresados no tienen un formato válido.");
			}
		} else {
			alert("Los datos ingresados no tienen un formato válido.");
		}	
	}

	function saveLocalSite(site){
		if (typeof(Storage) !== "undefined") {
			localStorage.setItem("siteAdaptation", JSON.stringify(site));
		}
		else {
			alert(localStoragedError);
		}
	}

	function getLocalSite(){
		if (typeof(Storage) !== "undefined") {
			return JSON.parse(localStorage.getItem("siteAdaptation"));
		} else {
			alert(localStoragedError);
		}
	}

	function getElements(xpath){
		/* Recive algo como obj[0].headerLeft */
		var node = document.evaluate(
				xpath,
				document,
				null,
				XPathResult.FIRST_ORDERED_NODE_TYPE,
				null ).singleNodeValue;
		return node;
	}

	function concatElement(element){
		var stringElements = "";
		var getElement;
		$.each( element, function( key, value ) {
			if (value != "none"){
				getElement = getElements(value);
				if(getElement != null){
					stringElements += "<div>"+getElement.innerHTML+"</div>";
				}
				else
					stringElements = null;
			}
			else
				stringElements = "none";
		});
		return stringElements;
	}

	function constructObject(obj){
		var object = {};
		var error = false;
		var message = null;
		$.each( obj, function( key, value ) {
			var elem = concatElement(value["xpath"]);
			if (elem == null){
				error = true;
				message = "No se pudo cargar un elemento en "+key;
				return true;
			}
			if (elem == "none"){
				object[key] = {"xpath":"","pattern":"none"};
			}
			else
				object[key] = {"xpath":elem,"pattern":value["pattern"]};
		});
		if (error == true){
			alert(message);
			return null;
		}
		else
			return object;
	}

	function runPage(objectParent, iBody, iHead, selectedTemplate){
		if (objectParent !== null){
			iHead.append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">");
			iHead.append("<script src='https://code.jquery.com/jquery-2.1.4.min.js'></script>");
			iHead.append("<script src='https://maxcdn.bootstrapcdn.com/bootstrap/3.3.4/js/bootstrap.min.js'></script>");
			iHead.append("<link rel='stylesheet' href='https://maxcdn.bootstrapcdn.com/bootstrap/3.3.4/css/bootstrap-theme.min.css'>");
			iHead.append("<link rel='stylesheet' href='https://maxcdn.bootstrapcdn.com/bootstrap/3.3.4/css/bootstrap.min.css'>");
			iHead.append("<style>*{min-width: 0px !important;}</style>");
			iHead.append("<style>*{max-width: 100% !important;}</style>");  
			iBody.html("");
			if ("generic" === selectedTemplate){
	            iBody.append("<div class='container-fluid'> " +
	                "<div class='row'> <div id='header-0' class='col-md-4'> </div> <div id='header-1' class='col-md-4'> </div> <div id='header-2' class='col-md-4'> </div> </div> " +
	                "<div class='row'> <div id='navigation-0' class='col-md-12'> </div> </div> " +
	                "<div class='row'> <div id='main-0' class='col-md-4'> </div> <div id='main-1' class='col-md-4'> </div> <div id='main-2' class='col-md-4'> </div> </div> " +
	                "<div class='row'> <div id='footer-0' class='col-md-4'> </div> <div id='footer-1' class='col-md-4'> </div> <div id='footer-2' class='col-md-4'> </div> </div> </div>");
	            importElement(objectParent["header-0"],"#header-0",iBody);
	            importElement(objectParent["header-1"],"#header-1",iBody);
	            importElement(objectParent["header-2"],"#header-2",iBody);
	            importElement(objectParent["navigation-0"],"#navigation-0",iBody);
	            importElement(objectParent["main-0"],"#main-0",iBody);
	            importElement(objectParent["main-1"],"#main-1",iBody);
	            importElement(objectParent["main-2"],"#main-2",iBody);
	            importElement(objectParent["footer-0"],"#footer-0",iBody);
	            importElement(objectParent["footer-1"],"#footer-1",iBody);
	            importElement(objectParent["footer-2"],"#footer-2",iBody);
			}
			else if ("mobilePhone" === selectedTemplate) {
	            iBody.append("<div class='container-fluid'> " +
	                "<div class='row'> <div id='header-0' class='col-md-12'> </div> </div> " +
	                "<div class='row'> <div id='navigation-0' class='col-md-12'> </div> </div> " +
	                "<div class='row'> <div id='main-0' class='col-md-12'> </div> </div> " +
	                "<div class='row'> <div id='main-1' class='col-md-12'> </div> </div> " +
	                "<div class='row'> <div id='footer-0' class='col-md-12'> </div> </div> </div>");
	            importElement(objectParent["header-0"],"#header-0",iBody);
	            importElement(objectParent["navigation-0"],"#navigation-0",iBody);
	            importElement(objectParent["main-0"],"#main-0",iBody);
	            importElement(objectParent["main-1"],"#main-1",iBody);
	            importElement(objectParent["footer-0"],"#footer-0",iBody);
			}
			else if ("tablet" === selectedTemplate) {
	            iBody.append("<div class='container-fluid'> " +
	                "<div class='row'> <div id='header-0' class='col-md-12'> </div> </div> " +
	                "<div class='row'> <div id='navigation-0' class='col-md-12'> </div> </div> " +
	                "<div class='row'> <div id='main-0' class='col-md-6'> </div> <div id='main-1' class='col-md-6'> </div> </div> " +
	                "<div class='row'> <div id='footer-0' class='col-md-12'> </div> </div> </div>");
	            importElement(objectParent["header-0"],"#header-0",iBody);
	            importElement(objectParent["navigation-0"],"#navigation-0",iBody);
	            importElement(objectParent["main-0"],"#main-0",iBody);
	            importElement(objectParent["main-1"],"#main-1",iBody);
	            importElement(objectParent["footer-0"],"#footer-0",iBody);
			}
			else {
				alert("La configuración importada se encuentra incompleta.");
			}
		}
	}

	function importElement(source, destination, iBody){
		if (!!source) {
			var divElement = iBody.find(destination);
			if ( "pattern0" === source.pattern) {
				// Copiar
				divElement.append(source.xpath);
			}	
			else if ("pattern1" === source.pattern ) {
				// Menu
				applyPattern1(source.xpath, divElement, iBody);
			}
			else if ( "pattern2" === source.pattern) {
				// Títulos
				divElement.css({'font-size':'200%', 'font-weight':'bold'});
				divElement.append(source.xpath);
			}	
			else if ( "pattern3" === source.pattern) {
				// Formulario
				applyPattern3(divElement, source.xpath);
			}
		}
	}

	function applyPattern3(divElement, html){	
		var css = "<style class='patterCss3'>" +
		"@media screen and (max-width:721px) { " +
		"form > div { margin: 0 0 15px 0; } " + 
		"form > div > label, " + 
		"legend { " + 
		"width: 100%; " + 
		"float: none; " + 
		"margin: 0 0 5px 0;" +			
		"} " + 
		"form > div > div, " + 
		"form > div > fieldset > div { " + 
		"width: 100%; " + 
		"float: none;" + 
		"} " + 
		"input[type=text], " + 
		"input[type=email], " + 
		"input[type=url], " + 
		"input[type=password], " + 
		"textarea, " + 
		"select { " + 
		"width: 100%;" + 
		"} " + 
		"}" +
		"</style>";
		divElement.append(css);
		divElement.append(html);
	}

	function applyPattern1(xpath, divElement, iBody){
		if (xpath) {
			var dwrap = document.createElement("div");
			$(dwrap).html(xpath);
			var links = $(dwrap).find("a");
			divElement.append("<nav class='navbar navbar-default' role='navigation'> <div class='navbar-header'> " +
					"<button type='button' class='navbar-toggle' data-toggle='collapse' data-target='#bs-example-navbar-collapse-1'> " +
					"<span class='sr-only'>Toggle navigation</span><span class='icon-bar'></span><span class='icon-bar'></span><span class='icon-bar'></span></button> </div>  " +
					"<div class='collapse navbar-collapse' id='bs-example-navbar-collapse-1'> <ul id='menu-nav' class='nav navbar-nav'>  </ul> </div>  </nav> "); 
			$.each($(links), function(i, e){
				var newLinks = document.createElement("li");
				$(newLinks).append($(e));
				iBody.find("#menu-nav").append($(newLinks));
			});
		}
	}

	function indexOfCompareByIncludes(myArray, searchTerm, property) {
		if (!myArray) {
			return -1;
		}
		var searchUrl = normalizeUrl(searchTerm);
		for(var i = 0, len = myArray.length; i < len; i++) {
			if (myArray[i]["urlCompareType"] == "contain" && searchUrl.includes(normalizeUrl(myArray[i][property]))) 
				return i;
		}
		return -1;
	}

	function indexOfCompareByEquals(myArray, searchTerm, property) {
		if (!myArray) {
			return -1;
		}
		var searchUrl = normalizeUrl(searchTerm);
		for(var i = 0, len = myArray.length; i < len; i++) {
			if (myArray[i]["urlCompareType"] == "equal" && normalizeUrl(myArray[i][property]) === searchUrl) 
				return i;
		}
		return -1;
	}

	function delLocalSite(){
		if (typeof(Storage) !== "undefined") {
			localStorage.removeItem("siteAdaptation");
			siteAdaptation = [];
		}
		else {
			alert(localStoragedError);
		}
	}

	function normalizeUrl(url) {
		var normalize = url.replace("http://","");
		normalize = normalize.replace("https://","");
		return normalize;
	}

})();
