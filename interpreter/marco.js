'use strict';

var TreeNode = require('./tree');

function numberOfSpaces(text) {
    var count = 0;
    var index = 0;
    while (text.charAt(index++) === " ") {
        count++;
    }
    return count;
}

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.split(search).join(replacement);
};

module.exports = class Macro {
    constructor(macroKey, args, lines) {
        this.key = macroKey;
        this.args = args;
        this.lines = lines;
    }



    generateTree(code, value, index) {
        var args = code.split(' ');
        var key = args.shift();
        if (this.key === key) {
            if (this.args.length !== args.length) {
                throw new Error('Macro agrument mismatch. Line ' + index);
            }
            var rootNode = new TreeNode(value - 1, "root", "none");
            var latestNode = rootNode;
            for (var i = 0; i < this.lines.length; i++) {
                var line = this.lines[i].code;
                var ind = this.lines[i].index;
                for(var id = 0; id < this.args.length; id++){
                  line = line.replaceAll(this.args[id].trim(),args[id].trim());
                }
                var s = value + numberOfSpaces(line);
                var node = new TreeNode(s, line.trim(), index);
                if (latestNode === rootNode) {
                    rootNode.add(node);

                }else{
                    if(s>latestNode.value){
                      latestNode.add(node);
                    }else if(s === latestNode.value){
                      latestNode.parent.add(node);
                    }else{
                      while(s<latestNode.value){
                        latestNode = latestNode.parent;
                      }
                      if(s>latestNode.value){
                        latestNode.add(node);
                      }else if(s === latestNode.value){
                        latestNode.parent.add(node);
                      }else{
                        throw new Error("Tree Traversal Failed. Line "+ind);
                      }
                    }
                }
                latestNode = node;
            }
            for(var i in rootNode.children){
              var node = rootNode.children[i];
              node[value] = value;
            }
            return rootNode;
        }
    }
}
