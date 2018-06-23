'use strict';
module.exports = class TreeNode {
	constructor(value, code, sourceLine) {
		this.value = value;
		this.code = code;
		this.children = [];
		this.parent = null;
		this.sourceLine = sourceLine;
		this.type = "unknown";
		this.canProm = true;
		this.parser = null;
	}
	increaseTreeValue(v) {
		this.value += v;
		for (var x in this.children) {
			var child = this.children[x];
			child.increaseTreeValue(v);
		}
	}
	generateJavascript(bgList, charList, conList, varList) {
		var arr = [];
		if (this.type === "unknown" && this.parent !== null) {
			throw new Error('Uknown operation at Line ' + this.sourceLine);
		}
		if (this.parent !== null) {
			var childval = this.parent.getIndexOfChildren(this);
			var isLast = childval === this.parent.children.length - 1;
		}
		if (this.canProm) {
			if (this.children.length > 0) {
				for (var i = 0; i < this.children.length; i++) {
					var compiled = this.children[i].generateJavascript(bgList, charList, conList, varList);
					arr.push(compiled);
				}
			}
		}
		switch (this.type) {
			case "command":
				switch (this.getKey()) {
					case "create":
						var caller = this.getArg(1);
						var constructionMethod = conList[caller];
						if (caller === "option") {
							var ret = 'return false;';
							if(arr.length>0){
								for (var i in arr) {
									if (arr[i].trim().substr(0, 9) === "playScene") {
										ret = 'return true;';
									}
								}
							}
							arr.push(ret);
						}
						if(caller === "option"){

							return constructionMethod.parseCode(caller, this.code, arr, 0, this.sourceLine) + '\n';
						}else{
							var code=arr.join('\n\t');
							code += '\n';
							code = '\t'+code;
							return constructionMethod.parseCode(caller, this.code, arr, 0, this.sourceLine) + '\n' +code;
						}
					case "start":
						var code = "function publicStaticVoidMain(id){\n";
						code += "\t\t	if(id===0){\n";
						for (var i = 0; i < arr.length; i++) {
							var p = arr[i];
							var ns = p.split('\n')
								.map(d => '  '.repeat(this.getDepth()) + d)
								.join('\n');
							code += ns + '\n';
						}
						code += "\t\t}\n";
						code += "}\n";
						return code;
					case 'play':
						var sceneid = this.getArg(1);
						var sceneframe = typeof this.getArg(2) === "string" ? this.getArg(2) : "0";
						return 'playScene(\'' + sceneid + '\',' + sceneframe + ');\n';
					case "frame":
						var code = childval === 0 ? "[" : "\n,";
						code += "new Frame(function(){ \n";
						for (var i = 0; i < arr.length; i++) {
							var p = arr[i];
							var ns = p.split('\n')
								.map(d => '  '.repeat(this.getDepth() - 1) + d)
								.join('\n');
							code += ns + '\n';
						}
						code += "}, function(){return null})";
						code += isLast ? "\n]" : "";
						return code;
					case "scene":
						var sid = typeof this.getArg(2) === "string" ? this.getArg(2) : this.getArg(1);
						var code = 'let ' + this.getArg(1) + ' =  new Scene(' +
							"\"" +
							sid.replace('"', '\\"').replace("'", "\\'") +
							"\",\n";
						for (var i = 0; i < arr.length; i++) {
							var p = arr[i];
							var ns = p.split('\n')
								.map(d => '  '.repeat(this.getDepth() - 1) + d)
								.join('\n');
							code += ns;
						}
						code += ");";
						return code;
					case "mod":
						var code = this.code.split(' ')
						code.shift();
						code = code.join(' ') + ";\n";
						return code;
					case "let":
						var vars = this.getArg(1).split(',');
						var code = "";
						for (var k in vars) {
							var vari = vars[k].trim();
							var vObj = varList[vari];
							code += '  '.repeat(this.getDepth()) + vObj.generateCode() + '\n';
						}
						return code;
					default:
						return "";
				}
			case "character":
				var cmd = this.getArg(1);
				var caller = this.getKey().trim();
				var method = charList[cmd];
				var code = ''
				//console.log('caller', caller, caller.split(',').filter(d => d !== null && typeof d1 == "undefined" && d.trim() !== "").map(d => d.trim()) > 1);
				//check parallel
				if (caller.split(',').filter(d => d !== null && typeof d1 == "undefined" && d.trim() !== "").map(d => d.trim()).length > 1) {
					var callers = caller.split(',').filter(d => d !== null && typeof d1 == "undefined" && d.trim() !== "").map(d => d.trim());
					var ret = "";
					for (var i7 = 0; i7 < callers.length; i7++) {
						var call = callers[i7];
						if (i7 === callers.length - 1) {
							code += method.parseCode(call, this.code, arr, this.getDepth(), this.sourceLine);
						} else {
							code += method.parseCode(call, this.code, [], this.getDepth(), this.sourceLine) + "\n";
						}
					}
					return code;
				} else if (caller.split('/').filter(d => d !== null && typeof d1 == "undefined" && d.trim() !== "").map(d => d.trim()).length > 1) {
					var callers = caller.split('/').filter(d => d !== null && typeof d1 == "undefined" && d.trim() !== "").map(d => d.trim());
					//console.log('callers', callers);
					var latest = "";
					for (var i7 = callers.length - 1; i7 >= 0; i7--) {
						var call = callers[i7];
						if (i7 === callers.length - 1) {
							latest = method.parseCode(call, this.code, arr, this.getDepth() + callers.length, this.sourceLine);
						} else {
							latest = method.parseCode(call, this.code, [latest], this.getDepth(), this.sourceLine) + "\n";
						}
					}
					return latest;
				} else {
					return method.parseCode(caller, this.code, arr, this.getDepth(), this.sourceLine);
				}
			case "stage":
				var cmd = this.getArg(1);
				var caller = this.getKey().trim();
				var method = bgList[cmd];
				var code = ''
				//check parallel
				if (caller.split(',').filter(d => d !== null && typeof d1 == "undefined" && d.trim() !== "").map(d => d.trim()).length > 1) {
					var callers = caller.split(',').filter(d => d !== null && typeof d1 == "undefined" && d.trim() !== "").map(d => d.trim());
					var ret = "";
					for (var i7 = 0; i7 < callers.length; i7++) {
						var call = callers[i7];
						if (i7 === callers.length - 1) {
							code += method.parseCode(call, this.code, arr, this.getDepth(), this.sourceLine);
						} else {
							code += method.parseCode(call, this.code, [], this.getDepth(), this.sourceLine) + "\n";
						}
					}
					return code;
				} else if (caller.split('/').filter(d => d !== null && typeof d1 == "undefined" && d.trim() !== "").map(d => d.trim()).length > 1) {
					var callers = caller.split('/').filter(d => d !== null && typeof d1 == "undefined" && d.trim() !== "").map(d => d.trim());
					var latest = "";
					for (var i7 = callers.length - 1; i7 >= 0; i7--) {
						var call = callers[i7];
						if (i7 === callers.length - 1) {
							latest = method.parseCode(call, this.code, arr, this.getDepth() + callers.length, this.sourceLine);
						} else {
							latest = method.parseCode(call, this.code, [latest], this.getDepth(), this.sourceLine) + "\n";
						}
					}
					return latest;
				} else {
					return method.parseCode(caller, this.code, arr, this.getDepth(), this.sourceLine);
				}
			default:
				return arr.join('');
		}
	}
	getIndexOfChildren(child) {
		for (var i = 0; i < this.children.length; i++) {
			var child1 = this.children[i];
			if (child1 === child) {
				return i;
			}
		}
	}
	replaceWithChildrens(child, children) {
		var i = this.getIndexOfChildren(child);
		var cc = this.children;
		var c = cc.splice(i + 1);
		cc.pop();
		var fA = cc.concat(children).concat(c);
		this.children = fA;
	}
	add(child) {
		if (!this.canProm) {
			throw new Error('The method does not have a promise! Please put under same indentation. Line ' + this.sourceLine);
		}
		this.children.push(child);
		if (child.parent !== null) {
			throw new Error("One node cannot have multiple parents");
		} else {
			child.parent = this;
		}
	}
	getDepth() {
		var count = 0;
		var par = this;
		while (par.parent !== null) {
			par = par.parent;
			count++;
		}
		return count;
	}
	getKey() {
		return this.code.split(' ')[0];
	}
	getArg(i) {
		var a = this.code.split(' ')[i]
		return typeof a === "string" ? a.trim() : a;
	}
	getTreeView(input) {
		if (typeof input !== "string") input = "";
		var x = "";
		x += input + this.getKey() + "; Line " + this.sourceLine + "\n";
		for (var i = 0; i < this.children.length; i++) {
			var child = this.children[i];
			x += child.getTreeView(input + "-");
		}
		return x;
	}
	getLatestNode() {
		if (this.children.length > 0) {
			return this.children[this.children.length - 1].getLatestNode();
		} else {
			return this;
		}
	}
}
