// ==UserScript==
// @name        WebAdaptation
// @namespace   http://lifia.unlp.edu.ar
// @author      Mauricio Witkin, Ramon Serrano
// @description A design tool for adapting a web application to mobile.
// @version     0.9
// @match      	https://*/*
// @match      	http://*/*
// @require     https://code.jquery.com/jquery-2.1.4.min.js
// @grant       GM_registerMenuCommand
// @noframes
// @run-at document-end
// ==/UserScript==

(function() {
'use strict';

// Comandos del GreaseMonkey
GM_registerMenuCommand('Seleccionar template adaptativo', selectTemplate, "S");
GM_registerMenuCommand('Seleccionar elementos de la página', startEdit, "E");
GM_registerMenuCommand('Ver elementos seleccionados', viewSelected, "V");
GM_registerMenuCommand('Detener selección de elementos', stopEdit, "D");
GM_registerMenuCommand('Adaptar página', previewPage, "A");
GM_registerMenuCommand('Eliminar datos almacenados', delLocalSite, "L");
GM_registerMenuCommand('Importar configuración', importJson, "I");
GM_registerMenuCommand('Exportar configuración', exportJson, "X");

//-----------------------------------------------------------
// VARIABLES GLOBALES
//-----------------------------------------------------------

// Estilos del div modal, del fondo, y se tiene una variable la cual contendra los estilos originales del elemento.
var stylesBackground = {"position": "absolute", "left": "0px", "top": "0px", "background": "#000000", "z-index": "2000", "width": "100%", "opacity": "0"};
var hrefOriginal = "#";
var eventsDisabled = false;
var editIniciado = false;

// Formato que se usa para almacenar la adaptacion de un pagina
var pageAdaptationGeneric = {
	"header-0":{"xpath":["none"],"pattern":"none"},
	"header-1":{"xpath":["none"],"pattern":"none"},
	"header-2":{"xpath":["none"],"pattern":"none"},
	"navigation-0":{"xpath":["none"],"pattern":"none"},
	"main-0":{"xpath":["none"],"pattern":"none"},
	"main-1":{"xpath":["none"],"pattern":"none"},
	"main-2":{"xpath":["none"],"pattern":"none"},
	"footer-0":{"xpath":["none"],"pattern":"none"},
	"footer-1":{"xpath":["none"],"pattern":"none"},
	"footer-2":{"xpath":["none"],"pattern":"none"}
};
var pageAdaptationMobilePhone = {
	"header-0":{"xpath":["none"],"pattern":"none"},
	"navigation-0":{"xpath":["none"],"pattern":"none"},
	"main-0":{"xpath":["none"],"pattern":"none"},
	"footer-0":{"xpath":["none"],"pattern":"none"}
};
var pageAdaptationTablet = {
    "header-0":{"xpath":["none"],"pattern":"none"},
    "navigation-0":{"xpath":["none"],"pattern":"none"},
    "main-0":{"xpath":["none"],"pattern":"none"},
    "main-1":{"xpath":["none"],"pattern":"none"},
    "footer-0":{"xpath":["none"],"pattern":"none"}
};
var pageAdaptation = {};

var elements = "body, html, tr, td, th, thead, tbody, li, li a";	//Todos los elementos que no se tomaran en cuenta para exportara
var element_button_click = "";   									// Los ID de los elementos del boton que se crean para el menu de seleccion de elementos.
var unwelcome_element = "script, style, noscript, meta, link";  	// Los elementos no deseados para extraer del HTML.
var modal_activated = false; 										// Variable que sirve para notificar que si el modal esta activado, del keys habilita solamente el ESC.
var dinamicPreview = false; 										// Interruptor para distinguir entre previsualizar dinamicamente o por comando GreaseMonkey
var pageTemplate;	 												// almacena el identificador del template seleccionado por el usuario.
var selectedPattern;	 											// almacena el identificador del patron seleccionado por el usuario.
var urlCompareType = "equal";
var pageUrl = window.location.href;
var siteAdaptation = [];											// almacena todas las transformaciones realizadas.


//-----------------------------------------------------------
// INICIALIZACION DEL SISTEMA
//-----------------------------------------------------------

//Elimina todos los .js para utilizar la version del @require y no se genere conflicto
if (window.jQuery){
	$('head script[src*="jquery"]').remove();
}

initialize();
initializeEdition();


//-----------------------------------------------------------
// FUNCIONES DEL SISTEMA
//-----------------------------------------------------------

// Funcion que se encarga de configurar la edicion del sitio Web con la herramienta
function initializeEdition() {	
	$(window).load(function(){
		stopEdit();
	});

	$('#framePreview').load(function() {
		if(pageTemplate != null){
			actualizarIFrame();
		}
	});
}

// Funcion que arma la tabla con los elementos cargados en el JSON
function viewSelected(){
	if (countSeletedElements() == 0) {
		alert("No se encontrarón elementos seleccionados.");
	}
	else {
		// Se crea un div que contendra la tabla.
		$("body").append("<div id= 'aryta-table' style='width: 50%; padding: 10px;'></div>");

		// Se crea la tabla
		var tabla = "<table style='width: 100%;'><thead><th style='width= 50%; text-align:left;'>Tag</th><th style='width= 25%; text-align:left;'>Lugar</th><th style='width= 25%; text-align:left;'>Acci&oacute;n</th></thead><tbody></tbody></table>";
		$("#aryta-table").append(tabla);
		var selectedElements = pageAdaptation;
		for(var i in pageAdaptation){
			var key = i;
			var val = pageAdaptation[i];
			if(val.pattern != "none"){
				$("#aryta-table tbody").append("<tr><td id='"+key+"Table'style='width= 50%;'>"+val.xpath+"</td><td style='width= 25%;'>"+key+"</td><td style='width= 25%;'><input id= '"+key+"'/></td></tr>");
				$("#"+key).attr("type", "button").attr("value", "Eliminar").css("margin-button", "0.5%");
				$("#"+key).on("click", removeFromSelected);
			}
		}
	}

	// Se le asigna los estilos de resaltado al elemento clonado mediante una funcion. En otra funcion separada se le asignan los tamaños.
	stylesModal($("#aryta-table")); // ID del div que contiene al clon y a los botones
	sizeModal($("#aryta-table"));

	// Se guarda la altura del documento para poder asignarsela al fondo del modal.
	var altura=$(document).height();

	// Se crea el fondo como hijo del elemento body y se le agregan los estilos asignados al principio del documento y se le asigna la altura del documento.
	// Se utiliza la funcion fadeTo de Jquery para una transicion que ayudara a la visual.
	$("body").append("<div id='backgroundModal'></div>");
	$("#backgroundModal").css(stylesBackground);
	$("#backgroundModal").fadeTo(400, 0.7);
	$("#backgroundModal").height(altura);

	// Se le asigna el evento click al fondo para que cuando ocurra se cierre el modal.
	$("#backgroundModal").on("click", function(){closeModal($("[id='aryta-table']"));});
}

// Funcion que elimina una adaptacion en un pagina
function removeFromSelected(){
	var elementId = $(this).attr("id");
	pageAdaptation[elementId] = {"xpath":["none"],"pattern":"none"};
	closeModal($("[id='aryta-table']"));
	saveLocal();
	viewSelected();
	actualizarIFrame();
}

// Funcion que arma el xPath del elemento seleccionado
function armarXpath(selectedElement){
	var element = selectedElement;
	var findId = false;
	var xPath = "";
	var tag = $(element).get(0).tagName.toLowerCase();
	var id = $(element).attr("id");

	while ($(element).get(0).tagName != "BODY" ){
		var padre = $(element).parent();
		var hijosFiltrados= $(padre).children(""+tag+"");
		var find = false;
		var position = 0;
		var pos = 0;
		while(find == false){
			if(($(hijosFiltrados).eq(pos).is($(element))) == true ){
				position = pos;
				find = true;
			}
			pos = pos + 1;
		}  
		xPath = "/"+tag+"["+(position + 1)+"]"+xPath;
		element = element.parent(); 	// Se guarda al padre
		tag = $(element).get(0).tagName;
	}
	xPath = "/html/body"+xPath;
	return xPath;
}

// Funcion que le agrega los estilos al elemento clonado que sea parte del Modal
function stylesModal(cloned){
	var clonedPosition = "fixed";
	var clonedZIndex = "3000";
	var clonedBackgroundColor;
	if(cloned.css("background-color") == "transparent" || cloned.css("background-color") == "rgba(0, 0, 0, 0)"){
		clonedBackgroundColor = "white";
	}
	else{
		clonedBackgroundColor = cloned.css("background-color");
	}
	var stylesCloned = {'position' : clonedPosition, 'z-index': clonedZIndex, 'background-color': clonedBackgroundColor};
	if ($("#main-menu").length) {
		$("#main-menu").css("bottom", "auto");
	}
	cloned.css(stylesCloned);
}

// Funcion que calcula el tamaño y posicion del elemento clonado para posicionar el Modal
function sizeModal(cloned){
	var winH = $(window).height();
	var winW = $(window).width();
	var clonedTop;
	var menu = $("#BackgroundMenuButton");
	var element = $(menu).prev();
	if(cloned.height() < winH){
		clonedTop = (winH/2)-(cloned.height()/2);
	}
	else{
		clonedTop = 100;
		$(element).height(winH - $(menu).height() - 200); 
		$(element).css({overflow: "scroll"});
	}
	var clonedLeft;
	if((cloned.width() < winW)) {
		clonedLeft = (winW/2)-(cloned.width()/2);
	}
	else{
		clonedLeft = 0;
	}
	var stylesCloned = {left: clonedLeft, top: 120};
	cloned.css(stylesCloned);
}


// Funcion que guarda los estilos de borde y ancho del elemento resaltado por el hover
function saveStyles(savedElement){
	// Variables que guardan los estilos de borde
	var originalBorder = $(savedElement).css("border");
	var originalBackground = $(savedElement).css("background-color");

	// Arreglo que guarda los estilos de borde para poder ser recuperados mas facilmente.
	$(savedElement).attr("aryta-border", originalBorder);
	$(savedElement).attr("aryta-background", originalBackground);
}

function getOriginalStyles(savedElement){
	var originalBorder = $(savedElement).attr("aryta-border");
	var originalBackground = $(savedElement).attr("aryta-background");

	var stylesOriginal = {"background-color": originalBackground, border: originalBorder};
	$(savedElement).css(stylesOriginal);
}

// Funcion que se encarga de darle el borde rojo al elemento que activa el evento de entrada del hover.
function frameElement(){
	// A medida que se va haciendo mouseenter a los elementos, se va actualizando el elemento seleccionado para luego a partir de ahi se pueda mover con el key.
	$("[selected_Aryta='on']:eq(0)").removeAttr("selected_Aryta");
	$(this).attr("selected_Aryta", "on");

	//Se le da el borde rojo al elemento. Como el evento hover se aplica tambien a los elementos padres, se guarda los bordes originales y cuando cambie el hover se le asignan los originales nuevamente.
	if($(this).attr("aryta-background") == undefined){
		saveStyles($(this));
	}
	var elementBackground = $(this).css("background-color");
	if ((elementBackground == "transparent") || (elementBackground > "rgb(125, 125, 125)")){
		// seleccion de elementos color verde
		$(this).css({"background-color":"#95BB93", "border-style":"solid", "border-color":"#175414", "border-width":"2px"});
	}
	else{
		$(this).css({"background-color":"rgba(255, 255, 255, 0.3)", "border-style":"solid", "border-color":"#175414"}); 
	}

	getOriginalStyles($("*[aryta-hovered='aryta-hovered']").not(this));

	// Se le asigna un atributo para diferenciarlo mas tarde. Se le modifica el atributo a los otros elementos que fueron anteriormente resaltados.
	$(this).attr("aryta-hovered", "aryta-hovered");
	$("*[aryta-hovered='aryta-hovered']").not(this).not(element_button_click).attr("aryta-hovered", "aryta-not-hovered");

	// Si el elemento es un link, hago que no le haga caso a este y me guardo el href para volver a reestablecerselo.
	if($(this).attr("href") !== undefined){
		hrefOriginal = $(this).attr("href");
		$(this).removeAttr("href");
		$(this).attr("aryta-hasLink", "aryta-hasLink");
	}

	// Se le agrega el evento click al elemento resaltados y se le quita a los elementos anteriormente resaltados.
	$(this).not(elements).not(".buttonAryta").on("click", disableFramer);
	$("*[aryta-hovered='aryta-not-hovered']").off("click");
}

// Funcion que se encarga de quitar el borde al elemento que activa el evento de salida del hover.
function deframeElement(element_selected){
	// Si la funcion no recibe un parametro, la variable element_selected asume el valor de this.
	getOriginalStyles($(element_selected));

	//Si el elemento es un link, le reestablezco el href.
	if($(element_selected).attr("aryta-hasLink") !== undefined){
		$(element_selected).attr("href", hrefOriginal);
		$(element_selected).removeAttr("aryta-hasLink");
	}
}

// Funcion que se encarga de llamar a la funcion que abre el divModal. Es llamada por frameElement.
function disableFramer(){
	//Se desactivan todos los eventos relacionados con el posicionamiento del mouse.
	$("*").off("mouseenter");
	$("*").off("mouseleave");

	//Se desactiva el evento click para evitar duplicaciones mas tarde.
	$(this).off("click");

	//Se ponen todos los elementos con los mismos atributos para evitar errores.
	getOriginalStyles($("*[aryta-hovered='aryta-hovered']"));
	$("*[aryta-hovered='aryta-hovered']").attr("aryta-hovered", "aryta-not-hovered");

	eventsDisabled = false;
	if(!modal_activated){
		//Se llama a la funcion que abre el modal con el elemento a clonar.
		openModal($(this));
	}
}

// Funcion que se encarga de cerrar el div modal y su fondo, y recupera los estilos por defecto del elemento resaltado.
function closeModal(elementToRemove){
	//Se elimina el fondo del modal
	$("#backgroundModal").remove();
	$("#backgroundModal").fadeTo(400, 0, function(){$("#backgroundModal").remove();});
	getOriginalStyles($("*[aryta-border]"));

	//Se elimina el div que contiene el elemento clonado y el menu de botones.
	$(elementToRemove).remove(); // Elimina el div.


	//Se agregan los eventos de posicionamiento del mouse en todos los elementos excepto los indicados al principio del documento. Mismo funcionamiento que la funcion de inicio del sistema.
	if(!eventsDisabled &editIniciado){
		$("*").not(elements).not(element_button_click).not("#BackgroundMenuButton").not("#buttonMenuFlotant").on("mouseenter", frameElement);
		$("*").not(elements).not(element_button_click).not("#BackgroundMenuButton").not("#buttonMenuFlotant").on("mouseleave", function(){deframeElement($(this));});
	}

	eventsDisabled = false;

	/* == Codigo embebido de Diego, para habilitar nuevamente los eventos del menu de botones === */
	modal_activated = false;
	activateButton();
}

// Funcion que se encarga de abrir el div modal y su fondo. Recibe un parametro que sera el elemento a resaltar. (Ubicar elemento seleccionado)
function openModal(highlightElement){
	//Se clona el elemento para poder resaltarlo.
	var clonedElement = highlightElement.clone();

	modal_activated = true; // Se dice que se realizo un modal a un elemento/

	// El crea un div, cuyo div esta integrado por: el clon y el menu con los botones
	$("body").append("<div id= 'div-aryta-cloned'></div>");
	clonedElement.attr("id", "aryta-cloned");
	$("#div-aryta-cloned").append(clonedElement);
	createMenuButton(highlightElement);

	//Se le asigna los estilos de resaltado al elemento clonado mediante una funcion. En otra funcion separada se le asignan los tamaños. 
	//Se separo porque no tomaba bien los tamaños en caso de que se tenga un margen automatico.

	stylesModal($("#div-aryta-cloned")); // ID del div que contiene al clon y a los botones
	$("#div-aryta-cloned").css({"min-width":"450px", "max-width":"800px", "border-style":"solid", "border-color":"#175414", "border-width":"2px", "min-height":"200px", "max-height":"500px", "overflow":"auto"});	// borde verde
	sizeModal($("#div-aryta-cloned"));

	//Se guarda la altura del documento para poder asignarsela al fondo del modal.
	var altura=$(document).height();

	//Se crea el fondo como hijo del elemento body y se le agregan los estilos asignados al principio del documento y se le asigna la altura del documento.
	//Se utiliza la funcion fadeTo de Jquery para una transicion que ayudara a la visual.
	$("body").append("<div id='backgroundModal'></div>");
	$("#backgroundModal").css(stylesBackground);
	$("#backgroundModal").fadeTo(400, 0.7);
	$("#backgroundModal").height(altura);

	//Se le asigna el evento click al fondo para que cuando ocurra se cierre el modal. 
	$("#backgroundModal").on("click", function(){closeModal($("[id='div-aryta-cloned']"));});
}

// Funcion que se encarga de abrir el div modal y su fondo. Recibe un parametro que sera el elemento a resaltar.
function openModalInsertElement(){
	if ("generic" === pageTemplate){
		selectTemplateHeaderCommon();
		selectGeneric(true);
	}
	else if ("mobilePhone" === pageTemplate) {
		selectTemplateHeaderCommon();
		selectMobilePhone(true);
	}
	else if ("tablet" === pageTemplate) {
		selectTemplateHeaderCommon();
		selectTablet(true);
	}
	markSelected();
}

// Funcion que marca con color los elementos seleccionados
function markSelected(){
	for (var key in pageAdaptation) {
		if (pageAdaptation[key]["xpath"] != "none") {
			var markElement = "table-" + key;
			$("#"+markElement+"").css("background-color","#abbfdd");
			$("#"+markElement+"").off("mouseleave");
			$("#"+markElement+"").off("mouseenter");
			$("#"+markElement+"").off("click");
			$("#"+markElement+"").on("click", replaceElement);
		}
	}
}

//Funcion que reemplaza una adapacion en un pagina por otra
function replaceElement(){
	var answer= confirm("¿Desea reemplazar el elemento anterior del template por el actual?");
	if(answer){
		for (var key in pageAdaptation) {
			if (pageAdaptation[key]["xpath"] != "none") {
				var markElement = "table-" + key;
				if($(this).attr("id") == markElement){
					saveElementSelected($(this).attr("templateSelectable"), selectedPattern);
				}
			}
		}
		actualizarIFrame();
	}
	closeModal($("[id='div-aryta-cloned']"));
}

// Funcion que realiza la relacion entre el elemento seleccionado con la posicion del template.
function addElement_template(){
	var id = $(this).attr("templateSelectable");
	saveElementSelected(id, selectedPattern);
	closeModal($("[id='div-aryta-cloned']"));
	actualizarIFrame();
}

// Funcion que realiza el bordeado al elemento recibido como parametro.
function borderElement(seleccionado){
	if($(seleccionado).attr("aryta-background") == undefined){
		saveStyles($(seleccionado));
	}
	if(modal_activated){
		$(seleccionado).css("border", "red 3px outset");
	} else {
		var elementBackground = $(seleccionado).css("background-color");
		if ((elementBackground == "transparent") || (elementBackground > "rgb(125, 125, 125)")){
			$(seleccionado).css({"background-color":"#01DF01", "border-width":"2px"});
		} else{
			$(seleccionado).css({"background-color":"#01DF01", "border-width":"2px"});
		}
	}

	getOriginalStyles($("*[aryta-hovered='aryta-hovered']").not(seleccionado));

	//Se le asigna un atributo para diferenciarlo mas tarde. Se le modifica el atributo a los otros elementos que fueron anteriormente resaltados.
	$(seleccionado).attr("aryta-hovered", "aryta-hovered");
	$("*[aryta-hovered='aryta-hovered']").not(seleccionado).not(element_button_click).attr("aryta-hovered", "aryta-not-hovered");

	//Si el elemento es un link, hago que no le haga caso a este y me guardo el href para volver a reestablecerselo.
	if($(seleccionado).attr("href") !== undefined){
		hrefOriginal = $(seleccionado).attr("href");
		$(seleccionado).removeAttr("href");
		$(seleccionado).attr("aryta-hasLink", "aryta-hasLink");
	}
}

// Funcion que permite bordear al elemento correspondiente al hacer un hover al boton
function frameElementButton(){
	// Guarda en la variable el elemento relacionado del boton seleccionado
	var elementAryta = identificationOfTheElement($(this), "clone");

	borderElement($(elementAryta));
}

// Funcion que permite quitar el bordeado al elemento correspondiente al hacer un hover al boton
function deframeElementButton(){
	// Guarda en la variable el elemento relacionado del boton seleccionado
	var elementAryta = identificationOfTheElement($(this), "clone");

	// //Si el elemento es un link, le reestablezco el href.
	deframeElement(elementAryta);
}

// Funcion que permite identificar si el elemento selecionado si es padre o hijo de un elemento seleccionado.
function identificationOfTheElement(seleccionado, referencia){
	// Se verifica mediante el identificador si es el elemento padre o algunos de los hijos.
	switch($(seleccionado).attr("identity")){
	case "father": 
		return $("[selected_Aryta='on']:eq(0)").parent();
	default:
		var index = $(seleccionado).attr("identity");
	var element = $("[buttonAryta='"+ referencia +"']:eq("+index+")");
	if(referencia == "original"){
		$("[buttonAryta='original']").removeAttr("buttonAryta");
	}
	return $(element); 
	} 
}

// Funcion que agrega agrega manejadores de eventos al boton activo
function activateButton(){
	$(element_button_click).on("mouseenter", frameElementButton);
	$(element_button_click).on("mouseleave", function(){deframeElement($(this));});
	$(element_button_click).on("click", clickButton);
}

// Funcion que crea la funcionalidad de seleccion hacia los botones.
function clickButton(){
	//Se desactivan todos los eventos relacionados con el posicionamiento del mouse.
	$("*").off("mouseenter");
	$("*").off("mouseleave");

	//Se desactiva el evento click para evitar duplicaciones mas tarde.
	$(this).off("click");

	//Se ponen todos los elementos con los mismos atributos para evitar errores.
	getOriginalStyles($("*[aryta-hovered='aryta-hovered']"));
	$("*[aryta-hovered='aryta-hovered']").attr("aryta-hovered", "aryta-not-hovered");
	eventsDisabled = true;
	closeModal($("[id='div-aryta-cloned']"));
	openModal(identificationOfTheElement($(this), "original"));
}

// Funcion que almancena el elemento en el localStorage.
function saveElementSelected(choice, pattern){
	var element_selected = $("[selected_Aryta='on']:eq(0)");
	var data = [armarXpath(element_selected)];
	pageAdaptation[choice]["xpath"] = data;
	pageAdaptation[choice]["pattern"] = pattern;
	saveLocal();
}

// Funcion que se encarga de crear el boton padre del elemento seleccionado
function createFatherButton(){
	// Se crea el boton padre del elemento seleccionado
	if (!$("*[selected_Aryta*=on]:eq(0)").parent().is('body')){
		$("#BackgroundMenuButton").append("<input id= 'fatherButton'/>");
		$("#fatherButton").attr("type", "button").attr("value", "Padre").attr("identity", "father").css("margin-button", "0.5%");
		element_button_click = "#fatherButton";   
	}
}

// Funcion que se encarga de crear el/los boton/es hijo/s del elemento seleccionado
function createChildrenButton(){
	// Se extraen los hijos del elemento seleccionado 
	var children = $("[selected_Aryta='on']:eq(0)").children().not(unwelcome_element).not(":hidden").not(":empty");
	var children_clone = $("#aryta-cloned").children().not(unwelcome_element).not(":hidden").not(":empty");
	var button_name; // Para el TagName del elemento. Se le agrega al value del boton.

	// Se les agrega un atributo de marca a los hijos, para sincronizar con los botones
	children.attr("buttonAryta", "original");
	children_clone.attr("buttonAryta", "clone");

	// Se crean los botones a partir de la cantidad de hijos del elemento seleccionado
	for (var i = 0; i <= children_clone.length-1; i++) {
		$("#BackgroundMenuButton").append("<input id= 'new_boton' class= 'buttonAryta'/>");
		button_name = $("[buttonAryta='original']:eq("+i+")").prop("tagName");
		$("#new_boton").attr("type", "button").attr("value", button_name + ' - ' + i).attr("id", "childrenButton" + i).attr("identity", i).css("margin-button", "0.5%");
		if (element_button_click.length !== 0){
			element_button_click = element_button_click + ", ";
		}
		element_button_click = element_button_click + "#childrenButton" + i;
	};
}

// Fncion que crea el boton que permite ubicar un elmento en el template
function createButtonAddElement(){
	$("#BackgroundMenuButton").append("<br><br><div id='div-add-element'> <b>Operaci&oacute;n:</b> </div>").append("<input id= 'button-add-element'/>");
	//$("#div-add-element").css("border-top", "8px solid #ECFEFF"); // linea separador
	$("#button-add-element").attr("type", "button").attr("value", "Ubicar elemento");
	$("#button-add-element").on("click", openModalInsertElement);
}

// Funcion que crea el menu y las funcionalidades que conlleva el mismo.
function createMenuButton(seleccionado){

	$("[buttonAryta='original']").removeAttr("buttonAryta");
	// Se marca al elemento seleccionado para tener como referencia con los botones.
	$("[selected_Aryta='on']").removeAttr("selected_Aryta");
	$(seleccionado).attr("selected_Aryta", "on");

	// Creacion del div menu
	$("#div-aryta-cloned").append("<br><br><div id='BackgroundMenuButton'></div>");
	$("#BackgroundMenuButton").css({"background-color": "#E6E6FA", "padding": "2%", "border": "1px solid #175414", "display": "block"}).append("<div id= 'div-button-family'>  <b>Seleccionar elemento:</b>  </div>"); 	// verde


	// Se crea el boton padre e hijo/s y el agregador del elemento seleccionado
	createFatherButton();
	createChildrenButton();
	createButtonAddElement();

	//Se habilitan los eventos correspondientes de los botones
	activateButton();
}

// Fuuncion para marcar el elemento seleccionado con las flechas del teclado
function frameElementKey(event){
	var seleccionado = keysNavigation(event);
	borderElement($(seleccionado));
}

// Funcion que permite identificar mediante el boton elegido, el elemento correspondiente.
function selectorFamily(element , var_elemento, attribute){

	if($(element).length > 0){
		$(element).attr(""+ attribute + "", "on");

		// Necesario saber si el elemento a identificar es parte del clon.
		if(attribute == "selected_Aryta_cloned"){   
			element = identificationOfTheElement($(element),"clone");
		}
		var_elemento.removeAttr(""+ attribute + "");
		var_elemento = element;
	}
	return $(var_elemento);
}

// Funcion que permite navegar mediante teclas sobre los elementos.
function keysNavigation(event){
	var key_code = event.keyCode; // Codigo del teclado
	var attribute; //Atributo del elemento
	var first_element; // Primer elemento para el keys
	var element; //Elemento al cual se realizara el frame o el modal.
	if(modal_activated) {
		// Si el modal esta activado, entonces seteo las variables para que las teclas funcionen sobre el clon.
		attribute = "selected_Aryta_cloned";
		first_element= $("[identity]");
	} else{
		// Si el modal esta desactivado, se setean las variables para que las teclas funcionen sobre la pagina.
		attribute = "selected_Aryta";
		first_element= $('body').children();
	}

	// Se trae el elemento correspondiente mediante el id, dependiendo de lo que tenga el attribute.
	element = $("["+ attribute +"]");

	// En caso de que el elemento con ese id no exista, se toma por defecto un elemento predeterminado para ser el comienzo.
	if(element.length == 0){
		element = $(first_element).first();
	}
	// Switch que se ejecutara cierto caso dependiendo de la tecla elegida.
	switch (key_code){
	case 39: // Derecha -> Se seleccionara al siguiente elemento del elemento actual.
		if(modal_activated){
			// En el modal activado, se define el limite para que no se sobrepase a elegir al un elemento que no es su hno.
			var limit = $("[identity]").length - 2;
			if($(element).attr("identity") == limit.toString()){
				return selectorFamily($(element), element, attribute);
			}
		}
		return selectorFamily($(element).next(), element, attribute);
		break;
	case 37: // Izquierda <- Se selecccionara al anterior elemento del elemento actual.
		if(modal_activated){
			// En el modal activado, se define el limite para que no se sobrepase a elegir al un elemento que no es su hno.
			if($(element).attr("identity") == "father"){
				return selectorFamily($(element), element, attribute);
			}
		}
		return selectorFamily($(element).prev(), element, attribute);
		break;
	case 38: // Arriba - Se seleccionara al elemento padre del elemento actual.
		if(!modal_activated){
			// En el modal desactivado, se define que el body es el limite para ir seleccionando al padre.
			if($(element).parent().is('body')) {
				return selectorFamily($(element), element, attribute);
			}
			return selectorFamily($(element).parent(), element, attribute);
		}
		break;      
	case 40: // Abajo - Se seleccionara al primer hijo del elemento actual. Esta funcion solamente estara habilitado con el modal desactivado.
		if(!modal_activated){
			return selectorFamily($(element).children().first(), element,  attribute);
		}
		break;
	case 13: // Enter - Se realizara el modal para el elemento actual.
		if(modal_activated){
			element = identificationOfTheElement($(element),"original");
		}

		//Se desactivan todos los eventos relacionados con el posicionamiento del mouse.
		$("*").off("mouseenter");
		$("*").off("mouseleave");

		//Se desactiva el evento click para evitar duplicaciones mas tarde.
		$(this).off("click");
		getOriginalStyles($("*[aryta-hovered='aryta-hovered']"));
		$("*[aryta-hovered='aryta-hovered']").attr("aryta-hovered", "aryta-not-hovered");
		closeModal($("[id='div-aryta-cloned']"));
		eventsDisabled = true;
		openModal($(element));
		break;
	case 27: // Tecla ESC - Se realizara el cierre del modal.
		if(modal_activated){
			closeModal($("[id='div-aryta-cloned']"));
		}
	}
}

// Funcion que hace que se active el editor de seleccion de elementos, cuando se elija por el comando de GreaseMonkey
function startEdit(){
	if (!pageTemplate) {
		alert("Seleccione un template antes de comenzar la selección de elementos.");
		return;
	}
	if(!editIniciado){
		editIniciado=true;
		$("html").on("keypress", frameElementKey);
		$("*").not(elements).not(element_button_click).not("#BackgroundMenuButton").not("#buttonMenuFlotant").on("mouseenter", frameElement);
		$("*").not(elements).not(element_button_click).not("#BackgroundMenuButton").not("#buttonMenuFlotant").on("mouseleave", function(){deframeElement($(this));});
		createPreviewIFrame();
	}
}

// Funcion que desactiva el editor de seleccion de elementos.
function stopEdit(){
	editIniciado=false;
	$("html").off("keypress", frameElementKey);
	$("*").not(elements).not(element_button_click).not("#BackgroundMenuButton").off("mouseenter", frameElement);
	$("*").not(elements).not(element_button_click).not("#BackgroundMenuButton").off("mouseleave", function(){deframeElement($(this));});
}

// Funcion que previsualiza mediante el comando de GreaseMonkey
function previewPage(){
	if (countSeletedElements() == 0) {
		alert("No hay elementos seleccionados para adaptar.");
	}
	else {
		dinamicPreview = false;
		adaptationTemplate();
	}
}

// Motor de adaptacion del template
function adaptationTemplate(){
	stopEdit();
	var objectParent = constructObject(pageAdaptation);
	//runPage(objectParent);
	$("head").html("");
	$("body").html("");
	runPage(objectParent, $("body"), $("head"));
}

// Funcion para exportar el json con las adaptaciones
function exportJson() {
	if (countSeletedElements() == 0) {
		alert("No hay elementos seleccionados para exportar.");
	}
	else {
		prompt("Exportar configuración. Presione Ctrl+C para copiar los datos:", JSON.stringify(siteAdaptation));
	}
}

// Funcion para importar el json con las adaptaciones
function importJson() {
	var importData = prompt("Importar configuración. Ingrese los datos:                         ");
	// La longitud debe ser igual o mayor a 218, como para asegurar la estructura inicial del Json.
	if(importData.length >= 50 ){
		var siteImport = JSON.parse(importData);
		if($.isArray(siteImport)) {
			delLocal();
			saveLocalSite(siteImport);
			initialize();
			alert("Se ha importado exitosamente la configuración.");
			actualizarIFrame()
		}
		else {
			alert("Formato JSON ingresado no es el correspondiente. Por favor, reintente nuevamente.");
		}
	} else {
		alert("Formato JSON ingresado no es el correspondiente. Por favor, reintente nuevamente.");
	}
}

// Funcion para borrar las configuraciones almacenadas
function delLocal(){
	pageTemplate = undefined;
	urlCompareType = 'equal';
	pageUrl = window.location.href;
	clearJson(pageAdaptation);
	$('#framePreview').remove();
}

// Funcion para borrar del local storage las configuraciones almacenadas
function delLocalSite(){
	if (typeof(Storage) !== "undefined") {
		delLocal();
		siteAdaptation = [];
		localStorage.removeItem("siteAdaptation");
	}
	else {
		alert("El navegador Web no soporta el uso de Local Storage.");
	}
}

// Funcion para guardar las adaptaciones en el local storage
function saveLocalSite(site){
	if (typeof(Storage) !== "undefined") {
		localStorage.setItem("siteAdaptation", JSON.stringify(site));
	}
	else {
		alert("El navegador Web no soporta el uso de Local Storage.");
	}
}

// Funcion para guardar las adaptaciones
function saveLocal(){
	if (typeof(Storage) !== "undefined") {
		var i = indexOfCompareByEquals(siteAdaptation, pageUrl, "url");
		if (i < 0) {
			i =  indexOfCompareByIncludes(siteAdaptation, pageUrl, "url");
		}
		if (i > -1) {
			siteAdaptation[i] = {
					"url":pageUrl,
					"urlCompareType":urlCompareType,
					"template":pageTemplate,
					"pageAdaptation":pageAdaptation
			};
		}
		else {
			var json = {
					"url":pageUrl,
					"urlCompareType":urlCompareType,
					"template":pageTemplate,
					"pageAdaptation":pageAdaptation
			};
			siteAdaptation.push(json);
		}
		localStorage.setItem("siteAdaptation", JSON.stringify(siteAdaptation));

	} else {
		alert("El navegador Web no soporta el uso de Local Storage.");
	}
}

// Funcion para recuperar un elemento a traves del xpath
function getElements(xpath){
	// Recive algo como obj[0].headerLeft
	var node = document.evaluate(
			xpath,
			document,
			null,
			XPathResult.FIRST_ORDERED_NODE_TYPE,
			null ).singleNodeValue;
	return node;
}

// Funcion para unir elementos HTML
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

// Funcion para construir los objetos json que son parte de la adaptacion
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

// Funcion para generar el HTML y la funcionalidad de la seleccion del template.
function selectTemplate(){
	selectTemplateHeaderCommon();
	$("#col21").append("<div id='optionsTemplate'></div>");
	$("#optionsTemplate").css({"margin-left": "30px", "margin-right": "30px"});
	$("#optionsTemplate").append("<b>Seleccione un template:</b><br/><br/>" +
			"<form><select id='selectedOptionTemplate' style='visibility: visible; top:0px'>" +
			"<option value='generic'>Genérico</option> " +
			"<option value='mobilePhone'>Celular</option> " +
			"<option value='tablet'>Tablet</option> " +
	"</select></form>");
	selectGeneric();
	$("#selectedOptionTemplate").change(function(){
		if ("generic" === $(this).val()){
			$("#div-templateTable").remove();
			$("#templateTable").remove();
			selectGeneric(false);
		}
		else if ("mobilePhone" === $(this).val()) {
			$("#div-templateTable").remove();
			$("#templateTable").remove();
			selectMobilePhone(false);
		}
		else if ("tablet" === $(this).val()) {
			$("#div-templateTable").remove();
			$("#templateTable").remove();
			selectTablet(false);
		}
	});
	$("#col31").append("<hr/><br/>&nbsp;<b>URL: </b>" +
			"<input type='text' id='pageUrl' name='pageUrl' size='50' maxlength='200'>&nbsp;" +
			"<br/><br/>&nbsp;<b>comparar por: </b>" +
			"<form><input type='radio' id='optionUrl1' name='optionUrl' value='equal' checked='checked'/>igualdad " +
	"<input type='radio' id='optionUrl2' name='optionUrl' value='contain'/>contiene</form><br/><hr/>");

	$("#col42").append("<input id='templateAceptar' type='button' value='Aceptar'/>&nbsp;&nbsp;");
	$("#col42").append("<input id='templateCancel' type='button' value='Cancelar'/>");
	$("#templateCancel").on("click", function(){
		closeModal($("[id='div-aryta-cloned']"));
	});
	$("#templateAceptar").on("click", function(){
		delLocal();
		if ("generic" === $("#selectedOptionTemplate").val()){
			pageAdaptation =  pageAdaptationGeneric;
			pageTemplate = "generic";
		}
		else if ("mobilePhone" === $("#selectedOptionTemplate").val()) {
			pageAdaptation =  pageAdaptationMobilePhone;
			pageTemplate = "mobilePhone";
		}
		else if ("tablet" === $("#selectedOptionTemplate").val()) {
			pageAdaptation =  pageAdaptationTablet;
			pageTemplate = "tablet";
		}
		if ($("#optionUrl1").is(':checked')) {
			urlCompareType = 'equal';
		}
		else {
			urlCompareType = 'contain';
		}
		pageUrl = $("#pageUrl").val();
		closeModal($("[id='div-aryta-cloned']"));
		editIniciado=false;
		startEdit();
	});
	$("#pageUrl").val(pageUrl);
}

// Funcion para seleccionar el template generico
function selectGeneric(isSelected){
	if (isSelected) {
		selectPatter();
	}
	else {
		$("#col22").append("<div id='div-templateTable'></div>");
	}
	$("#div-templateTable").css({"display": "inline-block", "margin-left": "30px", "margin-right": "30px", "text-align":"left"});
	$("#div-templateTable").append("<div id='templateTable' class='contenedor-tabla'></div>");
	$("#templateTable").append("<div id='table-header' class='contenedor-fila' style='height:50px;'></div>");
	$("#templateTable").append("<div id='table-navigation-0' class='contenedor-fila' style='height:50px;' templateSelectable='navigation-0'>&nbsp;Navigation</div>");
	$("#templateTable").append("<div id='table-main' class='contenedor-fila'></div>");
	$("#templateTable").append("<div id='table-footer' class='contenedor-fila' style='height:50px;'></div>");

	var positionTemplate= ["0", "1", "2"];
	for (var i = 0; i < 3; i++) {
		$("#table-header").append("<div id='table-header-"+i+"' class='contenedor-columna' templateSelectable='header-"+positionTemplate[i]+"'>&nbsp;Header "+ i +"</div>");
	}
	for (var i = 0; i < 3; i++) {
		$("#table-main").append("<div id='table-main-"+i+"' class='contenedor-columna' templateSelectable='main-"+positionTemplate[i]+"'>&nbsp;Main "+ i +" </div>");
	}
	for (var i = 0; i < 3; i++) {
		$("#table-footer").append("<div id='table-footer-"+i+"' class='contenedor-columna' templateSelectable='footer-"+positionTemplate[i]+"'>&nbsp;Footer "+ i +" </div>");
	}
	$(".contenedor-tabla").css({"display":"table","border-style": "groove", "height": "240px", "width": "240px", "border-collapse": "collapse", "border-width": "1px"});
	selectTemplateCommon();
}

// Funcion para generar la funcionalidad comun de la seleccion del template
function selectTemplateHeaderCommon(){
	// Se desactivan todos los eventos relacionados con el posicionamiento del mouse.
	$("*").off("mouseenter");
	$("*").off("mouseleave");

	// Se desactiva el evento click para evitar duplicaciones mas tarde.
	$(this).off("click");

	// Se ponen todos los elementos con los mismos atributos para evitar errores.
	getOriginalStyles($("*[aryta-hovered='aryta-hovered']"));
	$("*[aryta-hovered='aryta-hovered']").attr("aryta-hovered", "aryta-not-hovered");
	eventsDisabled = true;
	closeModal($("[id='div-aryta-cloned']"));

	modal_activated = true; // Se dice que se realizo un modal a un elemento

	// El crea un div, cuyo div esta integrado por: el clon y el menu con los botones
	$("body").append("<div id='div-aryta-cloned' class='text-center'></div>");
	$("#div-aryta-cloned").css({"font":"12px Verdana, sans-serif","background-color":"white"});
	$("#div-aryta-cloned").append("<div id='designMain'></div>");
	$("#designMain").append("<table style='width:100%; border: 1px solid black; background-color:white;'><tr id='row1'></tr><tr id='row2'></tr><tr id='row3'></tr><tr id='row4'></tr><tr id='row5'></tr></table>");
	$("#row1").append("<td id='col11'>&nbsp;</td><td id='col12'>&nbsp;</td>");
	$("#row2").append("<td id='col21' class='contenedor-center'></td><td id='col22' class='contenedor-center'></td>");
	$("#row3").append("<td id='col31' colspan='2' class='contenedor-left'></td>");
	$("#row4").append("<td id='col41'></td><td id='col42' class='contenedor-center'></td>");
	$("#row5").append("<td id='col51'>&nbsp;</td><td id='col42'>&nbsp;</td>");
}

// Funcion para generar la funcionalidad comun de la seleccion del template en los botones
function selectTemplateCommon(){
	$(".contenedor-center").css({"text-align":"center", "vertical-align":"top"});
	$(".contenedor-fila").css({"display":"table-row", "border-style": "groove", "border":"1px solid black"});
	$(".contenedor-columna").css({"display":"table-cell", "border-style": "groove", "border":"1px solid black"});

	//Se le asigna los estilos de resaltado al elemento clonado mediante una funcion. En otra funcion separada se le asignan los tamaños. 
	//Se separo porque no tomaba bien los tamaños en caso de que se tenga un margen automatico.

	stylesModal($("#div-aryta-cloned")); // ID del div que contiene al clon y a los botones
	sizeModal($("#div-aryta-cloned"));

	//Se guarda la altura del documento para poder asignarsela al fondo del modal.
	var altura=$(document).height();

	//Se crea el fondo como hijo del elemento body y se le agregan los estilos asignados al principio del documento y se le asigna la altura del documento.
	//Se utiliza la funcion fadeTo de Jquery para una transicion que ayudara a la visual.
	$("body").append("<div id='backgroundModal'></div>");
	$("#backgroundModal").css(stylesBackground);
	$("#backgroundModal").fadeTo(400, 0.7);
	$("#backgroundModal").height(altura);

	//Se le asigna el evento click al fondo para que cuando ocurra se cierre el modal. 
	$("#backgroundModal").on("click", function(){closeModal($("[id='div-aryta-cloned']"));});

	//Se habilita la funcion de poder seleccionar un lugar en el template.
	$("[templateSelectable]").on("mouseenter", function(){$(this).css("background-color","#F0F8FF");});
	$("[templateSelectable]").on("mouseleave", function(){$(this).css("background-color","white");});
	$("[templateSelectable]").on("click", addElement_template);
}

// Funcion para el template Mobile
function selectMobilePhone(isSelected){
	if (isSelected) {
		selectPatter();
	}
	else {
		$("#col22").append("<div id='div-templateTable'></div>");
	}
	$("#div-templateTable").css({"display": "inline-block", "margin-left": "30px", "margin-right": "30px", "text-align":"left", "vertical-align":"middle"});
	$("#div-templateTable").append("<div id='templateTable' class='contenedor-tabla'></div>");
	$("#templateTable").append("<div id='table-header-0' class='contenedor-fila' style='height:50px;' templateSelectable='header-0'>&nbsp;Header</div>");
    $("#templateTable").append("<div id='table-navigation-0' class='contenedor-fila' style='height:50px;' templateSelectable='navigation-0'>&nbsp;Navigation</div>");
	$("#templateTable").append("<div id='table-main-0' class='contenedor-fila' templateSelectable='main-0'>&nbsp;Main</div>");	
	$("#templateTable").append("<div id='table-footer-0' class='contenedor-fila' style='height:50px;' templateSelectable='footer-0'>&nbsp;Footer</div>");

	$(".contenedor-tabla").css({"display":"table","border-style": "groove", "height": "250px", "width": "180px", "border-collapse": "collapse", "border-width": "1px"});
	selectTemplateCommon();
}

// Funcion para el template Tablet
function selectTablet(isSelected){
	if (isSelected) {
		selectPatter();
	}
	else {
		$("#col22").append("<div id='div-templateTable'></div>");
	}
	$("#div-templateTable").css({"display": "inline-block", "margin-left": "30px", "margin-right": "30px", "text-align":"left", "vertical-align":"middle"});
	$("#div-templateTable").append("<div id='templateTable' class='contenedor-tabla'></div>");
	$("#templateTable").append("<div id='table-header-0' class='contenedor-fila' style='height:40px;' templateSelectable='header-0'>&nbsp;Header</div>");
    $("#templateTable").append("<div id='table-navigation-0' class='contenedor-fila' style='height:40px;' templateSelectable='navigation-0'>&nbsp;Navigation</div>");
	$("#templateTable").append("<div id='table-main' class='contenedor-fila'></div>"); 
	$("#templateTable").append("<div id='table-footer-0' class='contenedor-fila' style='height:40px;' templateSelectable='footer-0'>&nbsp;Footer</div>");

	$("#table-main").append("<div id='table-main-0' class='contenedor-columna' style='width:50%' templateSelectable='main-0'>&nbsp;Main 0</div>");
	$("#table-main").append("<div id='table-main-1' class='contenedor-columna' style='width:50%' templateSelectable='main-1'>&nbsp;Main 1</div>");

	$(".contenedor-tabla").css({"display":"table","border-style": "groove", "height": "190px", "width": "260px", "border-collapse": "collapse", "border-width": "1px"});
	selectTemplateCommon();
}

// Funcion para verificar si el array contiene una propiedad con el atributo 'contain'
function indexOfCompareByIncludes(myArray, searchTerm, property) {
	if (!myArray) {
		return -1;
	}
	for(var i = 0, len = myArray.length; i < len; i++) {
		if (myArray[i]["urlCompareType"] == "contain" && searchTerm.includes(myArray[i][property])) return i;
	}
	return -1;
}

// Funcion para verificar si el array contiene una propiedad con el atributo 'equal'
function indexOfCompareByEquals(myArray, searchTerm, property) {
	if (!myArray) {
		return -1;
	}
	for(var i = 0, len = myArray.length; i < len; i++) {
		if (myArray[i]["urlCompareType"] == "equal" && myArray[i][property] === searchTerm) return i;
	}
	return -1;
}

// Funcion para dar valores iniciales al json con info. de la adaptacion
function clearJson(object) {
	if (object) {
		for (var property in object) {
			object[property] = {"xpath":["none"],"pattern":"none"};
		}
	}
}

// Funcion para mostrar un json por pantalla
function showJson(object) {	
	if (object) {
		alert(JSON.stringify(object));
	}
}

// Funcion para mostrar un json por consola 
function showJsonLog(object) {
	if (object) {
		console.log(JSON.stringify(object));
	}
}

// Funcion para generar el HTML para la seleccion de un patron
function selectPatter(){
	selectedPattern = "pattern0";
	$("#col22").append("<p style='margin-left:30px;'><div id='desingPatter'></div><b>Seleccione el lugar:</b></p><br/><div id='div-templateTable'></div>");
	$("#desingPatter").append("<b>Seleccione un patr&oacute;n de adaptaci&oacute;n:</b>&nbsp;<br/><br/><form>" +
			"<select id='selectPattern' style='visibility: visible; top:0px'>" +
			"<option value='pattern0'>Copiar</option> " +
			"<option value='pattern1'>Men&uacute;</option> " +
			"<option value='pattern2'>T&iacute;tulo</option> " +
			"<option value='pattern3'>Formulario</option> " +
	"</select></form><br/><br/>");
	$("#selectPattern").on("change", function(){
		selectedPattern = $("#selectPattern").val();
	});
}

// Funcion para aplicar el patron formulario
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

// Funcion para aplicar el patron menu
function applyPattern1(xpath, divElement, iBody){
	if (xpath) {
		var dwrap = document.createElement("div");
		$(dwrap).html(xpath);
		var links = $(dwrap).find("a");
		divElement.append("<nav class='navbar navbar-default' role='navigation'> <div class='navbar-header'> <button type='button' class='navbar-toggle' data-toggle='collapse' data-target='#bs-example-navbar-collapse-1'> <span class='sr-only'>Toggle navigation</span><span class='icon-bar'></span><span class='icon-bar'></span><span class='icon-bar'></span></button> </div>  <div class='collapse navbar-collapse' id='bs-example-navbar-collapse-1'> <ul id='menu-nav' class='nav navbar-nav'>  </ul> </div>  </nav> "); 
		$.each($(links), function(i, e){
			var newLinks = document.createElement("li");
			$(newLinks).append($(e));
			iBody.find("#menu-nav").append($(newLinks));
		});
	}
}

// Funcion para recuperar del local storage la informacion de la portabilizacion
function getLocalSite(){
	if (typeof(Storage) !== "undefined") {
		return JSON.parse(localStorage.getItem("siteAdaptation"));
	} else {
		alert("El navegador Web no soporta el uso de Local Storage.");
	}
}

// Funcion para cargar las variables y el HTML necesario al iniciarse la herramienta
function initialize() {
	//stopEdit();
	var siteAdaptationStorage = getLocalSite();
	if (siteAdaptationStorage) {
		siteAdaptation = siteAdaptationStorage;
		var index = indexOfCompareByEquals(siteAdaptation, pageUrl, "url");
		if (index < 0) {
			index = indexOfCompareByIncludes(siteAdaptation, pageUrl, "url");
		}
		if (index > -1) {
			var pageStorage = siteAdaptation[index];
			pageTemplate = pageStorage.template;
			pageAdaptation = pageStorage.pageAdaptation;
			urlCompareType = pageStorage.urlCompareType;
			pageUrl = pageStorage.url;
			createPreviewIFrame();
		}
	}
}

// Funcion para obtener la cantidad elementos adaptados
function countSeletedElements() {
	var count = 0;
	for (var i in pageAdaptation) {
		var val = pageAdaptation[i];
		if (val.pattern != "none") {
			count++;
		}
	}
}

// Funcion para crear el iframe de previsualizacion
function createPreviewIFrame(){
	if (!$("#framePreview").length) {
		var iframeStyle = 'height:1280px; width:720px; background-color:white; position:fixed; top:-330px; right:-170px; z-index:99; border:5px solid #cc3300; transform:scale(0.45);';
		if ("generic" === pageTemplate){
			iframeStyle = 'height:769px; width:1366px; background-color:white; position:fixed; top:-200px; right:-382px; z-index:99; border:5px solid #cc3300; transform:scale(0.42);';			
		}
		else if ("mobilePhone" === pageTemplate) {
			iframeStyle = 'height:1280px; width:720px; background-color:white; position:fixed; top:-330px; right:-185px; z-index:99; border:5px solid #cc3300; transform:scale(0.45);';
		}
		else if ("tablet" === pageTemplate) {
			iframeStyle = 'height:720px; width:1280px; background-color:white; position:fixed; top:-173px; right:-337px; z-index:99; border:5px solid #cc3300; transform:scale(0.45);';
		}

		$('<iframe />', {
			name: 'framePreview',
			id:   'framePreview',
			style: iframeStyle
		}).appendTo('body');
	}
	setTimeout(function(){
		actualizarIFrame();
	}, 250);
}

// Funcion para actualizar el iframe de previsualizacion 
function actualizarIFrame(){
	var objectParent = constructObject(pageAdaptation);
	var bodyFrame = $("#framePreview").contents().find("body");
	var headFrame = $("#framePreview").contents().find("head");
	headFrame.html("");
	bodyFrame.html("");
	runPage(objectParent, bodyFrame, headFrame);
}

// Funcion para generar el HTML del iframe de previsualizacion
function runPage(objectParent, iBody, iHead){
	iHead.append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">");
	iHead.append("<script src='https://code.jquery.com/jquery-2.1.4.min.js'></script>");
	iHead.append("<script src='https://maxcdn.bootstrapcdn.com/bootstrap/3.3.4/js/bootstrap.min.js'></script>");
	iHead.append("<link rel='stylesheet' href='https://maxcdn.bootstrapcdn.com/bootstrap/3.3.4/css/bootstrap-theme.min.css'>");
	iHead.append("<link rel='stylesheet' href='https://maxcdn.bootstrapcdn.com/bootstrap/3.3.4/css/bootstrap.min.css'>");
	iHead.append("<style>*{min-width: 0px !important;}</style>");
	iHead.append("<style>.heighBand20{height:20%;}</style>");
	iHead.append("<style>.height15{height:15%;}</style>");
	iHead.append("<style>.height20{height:20%;}</style>");
	iHead.append("<style>.height25{height:25%;}</style>");
	iHead.append("<style>.height40{height:40%;}</style>");
	iHead.append("<style>.height55{height:55%;}</style>");
	iHead.append("<style>.heighBand33{height:33%;}</style>");
	iHead.append("<style>.widthBand50{width:50%;}</style>");
	iHead.append("<style>.dashedBottom{border-bottom-style:dashed;}</style>");
	iHead.append("<style>.dashedRight{border-right-style:dashed;}</style>");

	if (objectParent != null){
		// Se verifica si es una adaptacion mediante el editor o por comando GreaseMonkey.
		if(!dinamicPreview){
			iBody.html("");	    
			if ("generic" === pageTemplate){
				iBody.append("<div class='container-fluid'> " +
					"<div class='row'> <div id='header-0' class='col-xs-4 height20 dashedBottom dashedRight widthBand33'> </div> <div id='header-1' class='col-xs-4 height20 dashedBottom dashedRight widthBand33'> </div> <div id='header-2' class='col-xs-4 height20 dashedBottom widthBand33'> </div> </div> " +
					"<div class='row'> <div id='navigation-0' class='col-xs-12 height20 dashedBottom'> </div> </div> " +
					"<div class='row'> <div id='main-0' class='col-xs-4 height40 dashedBottom dashedRight widthBand33'> </div> <div id='main-1' class='col-xs-4 height40 dashedBottom dashedRight widthBand33'> </div> <div id='main-2' class='col-xs-4 height40 dashedBottom widthBand33'> </div> </div> " +
					"<div class='row'> <div id='footer-0' class='col-xs-4 height20 dashedRight widthBand33'> </div> <div id='footer-1' class='col-xs-4 height20 dashedRight widthBand33'> </div> <div id='footer-2' class='col-xs-4 height20 widthBand33'> </div> </div> </div>");
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
			else if ("mobilePhone" === pageTemplate) {
				iBody.append("<div class='container-fluid'> " +
					"<div class='row'> <div id='header-0' class='col-xs-12 height15 dashedBottom'></div> </div> " +
                    "<div class='row'> <div id='navigation-0' class='col-xs-12 height15 dashedBottom'></div> </div> " +
					"<div class='row'> <div id='main-0' class='col-xs-12 height55 dashedBottom'></div> </div> " +				
					"<div class='row'> <div id='footer-0' class='col-xs-12 height15'></div> </div> </div>");
				importElement(objectParent["header-0"],"#header-0",iBody);
                importElement(objectParent["navigation-0"],"#navigation-0",iBody);
				importElement(objectParent["main-0"],"#main-0",iBody);
				importElement(objectParent["footer-0"],"#footer-0",iBody);
			}
			else if ("tablet" === pageTemplate) {
				iBody.append("<div class='container-fluid'> " +
					"<div class='row'> <div id='header-0' class='col-xs-12 height20 dashedBottom'> </div> </div> " +
					"<div class='row'> <div id='navigation-0' class='col-xs-12 height20 dashedBottom'> </div> </div> " +
					"<div class='row'> <div id='main-0' class='col-xs-6 height40 dashedBottom dashedRight widthBand50'> </div> <div id='main-1' class='col-xs-6 height40 dashedBottom widthBand50'> </div> </div> " +
					"<div class='row'> <div id='footer-0' class='col-xs-12 height20'> </div> </div> </div>");
				importElement(objectParent["header-0"],"#header-0",iBody);
                importElement(objectParent["navigation-0"],"#navigation-0",iBody);
				importElement(objectParent["main-0"],"#main-0",iBody);
				importElement(objectParent["main-1"],"#main-1",iBody);
				importElement(objectParent["footer-0"],"#footer-0",iBody);
			}
			else {
				alert("Información del template incompleta.");
			}
		}
	}
}

// Funcion para aplicar un patron en el iframe de previsualizacion
function importElement(source, destination, iBody){
	var divElement = iBody.find(destination);
	if ("pattern0" === source.pattern ) {
		//divElement.removeClass("heighBand20");
		divElement.append(source.xpath);
	}
	else if ("pattern1" === source.pattern ) {
		// Menu
		applyPattern1(source.xpath, divElement, iBody);
	}
	else if ("pattern2" === source.pattern ) {
		// Títulos
		divElement.css({'font-size':'200%', 'font-weight':'bold'});
		divElement.append(source.xpath);
	}
	else if ("pattern3" === source.pattern ) {
		// Formulario
		applyPattern3(divElement, source.xpath);
	}
}

})();