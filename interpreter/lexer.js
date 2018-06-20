module.exports = class Lexer {
    constructor() {
        this.array = [];
        this.pos = 0;
        this.term = "";
        this.word = "";
        this.prevChar = ''
        this.code = "";
    }
    isEnd() {
        return this.pos > this.code.length - 1;
    }
    cChar() {
        return this.code.charAt(this.pos);
    }
    parse(code) {

        this.array = [];
        this.pos = 0;
        this.term = "";
        this.word = "";
        this.prevChar = '';
        this.code = code;
        return this.lookForTerm();
    }

    lookForTerm() {
        var c = this.cChar();
        while (c !== '=') {

            if (this.prevChar === ' ') {
                this.word += this.term;
                this.term = '';
            }
            this.term += c;
            this.prevChar = c;
            this.pos++;
            if (this.isEnd()) {
                this.word += this.term;
                this.word.trim();
                if (this.array.length > 0) {
                    this.array[this.array.length - 1]['value'] = this.word.trim();
                }
                return this.array;
            };
            c = this.cChar();
        }
        if (this.array.length > 0) {
            this.array[this.array.length - 1]['value'] = this.word.trim();
        }
        this.word = '';
        this.array.push({
            key: this.term.trim(),
            value: null
        });
        this.term = '';
        this.pos++;
        return this.lookForTerm();
    }
}
