'use strict';
module.exports = class Method {
	constructor(key, alias, realName, order, lexer, type, description) {
		this.key = key;
		this.alias = alias;
		this.realName = realName;
		if (realName === null) {
			this.realName = key;
		}
		this.order = order;
		this.lexer = lexer;
		this.type = type; //setter, chain constructor, instant, preAnimation, animation, frills
		this.des = description;
	}
	hasPromise() {
		for (var i = 0; i < this.order.length; i++) {
			var arg = this.order[i];
			if (arg.key.trim() === 'promise') {
				return true;
			}
		}
		return false;
	}
	isSingleArg() {
		if (this.hasPromise() && this.order.length === 2) {
			return true;
		} else {
			if (!this.hasPromise()) {
				return this.order.length === 1;
			}
		}
		return false;
	}
	parseCode(caller, code, promise, tabulation, SL) {
		var arrays = this.lexer.parse(code, this.order);
		if (Object.keys(arrays).length === 0) {
			var arg = code.split(' ').filter(d => d !== null && typeof d !== 'undefined' && d.trim !== "").map(d => d.trim());
			arg.shift();
			arg.shift();
			var value = arg.join(' ');
			var key = ''
			for (var i5 = 0; i5 < this.order.length; i5++) {
				if (this.order[i5].key.trim() !== "promise") {
					key = this.order[i5].key.trim();
					break;
				}
			}

			function isNull(s) {
				return s === null || typeof s === "undefined" || s.trim() === "";
			}
			if (!isNull(key) && !isNull(value)) {
				arrays = [{
					key: key,
					value: value
				}];
			}
		}
		var code = '  '.repeat(tabulation) + caller + "." + this.realName + "(";
		var temp = '';
		for (var i = 0; i < this.order.length; i++) {
			var val = "null";
			var arg = this.order[i];
			if (arg.key !== 'promise') {
				//generate list or alias to check against for this method
				var keys = arg.alias;
				keys.push(arg.key);
				for (var kk in keys) {
					//local pointer to the current accept alias for this method
					var key = keys[kk].trim();
					for (var x in arrays) {
						//local pointer to the parsed key
						var aKey = arrays[x].key.trim();
						if (aKey === key) {
							//if key for this method and key for parsed is the same
							try {
								var v = arrays[x].value === null ? null : arrays[x].value.trim();
							} catch (e) {
								console.log(e.stack);
								throw new Error('Error occured at Line ' + SL + "; " + e);
							}
							//if is def
							if (v === 'def') {
								val = 'def';
							} else if (v === null) {
								val = "null";
							} else {
								//if its string
								if (arg.type === "string") {
									v = v.replace(/"/g, '\\"');
									v = v.replace(/'/g, "\\'");
									v = v.replace(/([^\\]|^)#([^\s]+)(\s|$)/, '$1\' + $2 + \'');
									v = v.replace(/\\#/, '#');
									val = "\'" + v + "\'";
								} else {
									//if not string
									val = v;
								}
							}
							break;
						}
					}
				}
			} else {
				if (typeof promise !== "undefined" && promise.length > 0) {
					val = 'function() { \n';
					for (var i2 = 0; i2 < promise.length; i2++) {
						var p = promise[i2];
						var ns = p.split('\n')
							.map(d => '  '.repeat(tabulation + 1) + d)
							.join('\n');
						val += ns + '\n';
					}
					val += '  '.repeat(tabulation) + '}';
				}
			}
			if (val === "null") {
				temp += (i === 0 ? "" : ",") + val
			} else {
				temp += (i === 0 ? "" : ",") + val;
				code += temp;
				temp = '';
			}
			code += (i === this.order.length - 1 ? ");" : "");
		}
		if (this.order.length === 0) code += ");"
		return code;
	}
}
