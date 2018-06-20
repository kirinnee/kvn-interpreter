'use strict';
module.exports = class Variables {
    constructor(name, value, type) {
        this.name = name.trim();
        this.value = value.trim();
        this.type = type.trim();
    }
    generateCode() {
        var ret = 'var ' + this.name + " = ";
        if (this.type === "string") {
            var v = this.value.replace('"', '\\"');
            v = v.replace("'", "\\'");
            ret += "\'" + v + "\';";
            return ret;
        } else {
            return ret += this.value + ";"
        }
    }
}
