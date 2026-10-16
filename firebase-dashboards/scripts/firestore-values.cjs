'use strict';
function value(v){
  if(v===null)return {nullValue:null};
  if(v instanceof Date)return {timestampValue:v.toISOString()};
  if(Array.isArray(v))return {arrayValue:{values:v.map(value)}};
  if(typeof v==='object')return {mapValue:{fields:fields(v)}};
  if(typeof v==='boolean')return {booleanValue:v};
  if(typeof v==='number'){
    if(!Number.isFinite(v))throw Error('Non-finite number cannot be published.');
    return Number.isSafeInteger(v)?{integerValue:String(v)}:{doubleValue:v};
  }
  if(typeof v==='string')return {stringValue:v};
  throw Error('Unsupported Firestore value.');
}
function fields(v){return Object.fromEntries(Object.entries(v).map(([k,v])=>[k,value(v)]));}
module.exports={fields};
