'use strict'

module.exports = class Node{
  constructor(code,value){
      this.code=code;
      this.value = value;
      this.children = [];
      this.parent = null;
  }

  add(child){
    if (child.parent !== null) {
        throw new Error("One node cannot have multiple parents");
    } else {
        child.parent = this;
    }
    this.children.push(child);
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

  getKey(){
    return this.code.split(' ')[0].split(',')[0];
  }

  getTreeView(input) {
      if (typeof input !== "string") input = "";
      var x = "";
      x += input + this.getKey()+ "\n";
      for (var i = 0; i < this.children.length; i++) {
          var child = this.children[i];
          x += child.getTreeView(input + "-");
      }
      return x;
  }

  getCode(){
    return  '\t'.repeat(this.getDepth()-1) + this.code.trim();
  }

  travse(arr){
      for(var i=0; i<this.children.length; i++){
        var child = this.children[i];
        arr.push(child.getCode());
        child.travse(arr);
      }
      return arr;
  }

}
