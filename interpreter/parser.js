'use strict'
module.exports = class Parser {
	constructor(tree, macroList, objList, charMethodList, bgMethodList, conList, varList) {
		this.tree = tree;
		this.macroList = macroList;
		this.objList = objList;
		this.bgMethodList = bgMethodList;
		this.charMethodList = charMethodList;
		this.conList = conList;
		this.commandList = ['let', 'mod', 'js', 'scene', 'frame','create','play', 'start'];
		this.varList = varList;
	}
	isCharMethod(method) {
		return typeof this.charMethodList[method.trim()] !== "undefined";
	}
	isBackgroundMethod(method) {
		return typeof this.bgMethodList[method.trim()] !== "undefined";
	}

	getCharMethod(method) {
		return this.charMethodList[method.trim()];
	}
	getBackgroundMethod(method) {
		return this.bgMethodList[method.trim()];
	}


	isMacroKey(node) {
		for (var x in this.macroList) {
			if (x === node.getKey()) {
				return true;
			}
		}
		return false;
	}

	isConstructor(node){

	}

	isCharacter(node) {
		var keyComma = node.getKey().split(',').filter(d=>d!==null && typeof d1=="undefined" && d.trim() !== "").map(d=>d.trim());
		var keySlash = node.getKey().split('/').filter(d=>d!==null && typeof d1=="undefined" && d.trim() !== "").map(d=>d.trim());
		if(keyComma.length>1){
			var isChar = true;
			for(var i in keyComma){
				var fnode = {key:keyComma[i],getKey:function(){return this.key}};
				if(!this.isCharacter(fnode)){
					isChar = false;
				}
			}
			return isChar;
		}
		if(keySlash.length>1){
			var isChar = true;
			for(var i in keySlash){
				var fnode = {key:keySlash[i],getKey:function(){return this.key}};
				if(!this.isCharacter(fnode)){
					isChar = false;
				}
			}
			return isChar;
		}
		for (var x in this.objList) {
			if (x === node.getKey() && this.objList[x].type === "character") {
				return true;
			}
		}
		return false;
	}

	isBackground(node) {
		var keyComma = node.getKey().split(',').filter(d=>d!==null && typeof d1=="undefined" && d.trim() !== "").map(d=>d.trim());
	var keySlash = node.getKey().split('/').filter(d=>d!==null && typeof d1=="undefined" && d.trim() !== "").map(d=>d.trim());
	if(keyComma.length>1){
		var isChar = true;
		for(var i in keyComma){
			var fnode = {key:keyComma[i],getKey:function(){return this.key}};
			if(!this.isBackground(fnode)){
				isChar = false;
			}
		}
		return isChar;
	}
	if(keySlash.length>1){
		var isChar = true;
		for(var i in keySlash){
			var fnode = {key:keySlash[i],getKey:function(){return this.key}};
			if(!this.isBackground(fnode)){
				isChar = false;
			}
		}
		return isChar;
	}
		for (var x in this.objList) {
			if (x === node.getKey() && this.objList[x].type === "stage") {
				return true;
			}
		}
		return false;
	}
	isCommand(node) {
		for (var x in this.commandList) {
			var cmd = this.commandList[x];
			if (cmd === node.getKey()) {
				return true;
			}
		}
		return false;
	}
	parse() {
		//checks
		this.recursiveMacro(this.tree);
		this.recursiveCheck(this.tree, this.resolveUnknownCommand);
		this.recursiveCheck(this.tree, this.promiseCheck);
		return this.tree.generateJavascript(this.bgMethodList, this.charMethodList, this.conList, this.varList,[]);
	}
	promiseCheck(node, char) {
		if (node.type === "command") {
			switch (node.getKey()) {
				case "scene":
				case "frame":
				case "js":
				case 'start':
					node.canProm = true;
					return true;
				case "create":
					if(node.getArg(1).trim() !== "sound" ){
						node.canProm = true;
					}else{
						node.canProm = false;
						if (node.children.length > 0) {
							return "Method cannot have callbacks or make promises. ";
						}
					}
					return true;
				default:
					node.canProm = false;
					return true;
			}
		} else if (node.type === "character") {
			var verb = node.getArg(1);
			if (char.isCharMethod(verb)) {
				var method = char.getCharMethod(verb);
				if (!method.hasPromise()) {
					if (node.children.length > 0) {
						return "Method cannot have callbacks or make promises. " + method.key;
					}
				}
				return true;
			} else {
				return "There is no such method for character " + node.getKey() +"; Method: "+verb;
			}
		} else if (node.type === "stage") {
			var verb = node.getArg(1);
			if (char.isBackgroundMethod(verb)) {
				var method = char.getBackgroundMethod(verb);
				if (!method.hasPromise()) {
					if (node.children.length > 0) {
						return "Method cannot have callbacks or make promises. " + method.key;
					}
				}
				return true;
			} else {
				return "There is no such method for background " + node.getKey() +"; Method: "+verb;
			}
		}
		return "Type: " + node.type + "; Code: " + node.code;
	}
	recursiveCheck(root, checker) {
		for (var x in root.children) {
			var child = root.children[x];
			if (checker(child, this) !== true) {
				throw new Error(checker(child, this) + " Line " + child.sourceLine);
			}
			this.recursiveCheck(child, checker);
		}
	}
	resolveUnknownCommand(node, char) {
		if (char.isCommand(node)) {
			node.type = "command";
			return true;
		}
		if (char.isCharacter(node)) {
			node.type = "character";
			return true;
		}
		if (char.isBackground(node)) {
			node.type = "stage";
			return true;
		}
		return "Unsupported Operation Exception. " + node.code + ' ';
	}
	recursiveMacro(nodes) {
		for (var x in nodes.children) {
			var node = nodes.children[x];
			if (this.resolveMacro(node)) {
				this.recursiveMacro(this.tree);
				break;
			} else {
				this.recursiveMacro(node);
			}
		}
		return;
	}
	resolveMacro(node) {
		if (this.isMacroKey(node)) {
			var macro = this.macroList[node.getKey().trim()];
			var treeGen = macro.generateTree(node.code, node.value, node.sourceLine);
			var leaves = node.children;
			var parent = node.parent;
			var latestNode = treeGen.getLatestNode();
			if (leaves.length > 0) {
				leaves
					.map(d => {
						d.parent = null;
						return d;
					})
					.map(d => {
						d.increaseTreeValue(latestNode.value);
						return d;
					})
					.forEach(d => {
						latestNode.add(d)
					});
			}
			parent.replaceWithChildrens(node, treeGen.children);
			return true;
		}
		return false;
	}
}
