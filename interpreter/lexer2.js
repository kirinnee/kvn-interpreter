module.exports = class Lexer {
    constructor() {

    }
    parse(code,order) {
        var args = order[0].key;
        var arg = code.split(' ')[2];
        function isNull(s){
            return s===null || typeof s === "undefined" || s.trim()==="";
        }
        var val = isNull(arg) ? null : arg
        return [{
          key:args,
          value: val
        }];
    }

}
