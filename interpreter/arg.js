'use strict';
module.exports = class Args {
    constructor(key, alias,type,dtype, desription, acceptedValues){
        this.key = key;
        this.alias = alias;
        this.type = type;
        this.dtype = dtype;
        this.des = desription;
        this.acceptedValues = acceptedValues;
    }
}
