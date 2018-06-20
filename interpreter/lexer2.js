module.exports = class Lexer {
    constructor() {

    }
    parse(code,order) {
        var args = order[0].key;
        return [{
          key:args,
          value:code.split(' ')[2]
        }];
    }

}
