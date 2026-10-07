import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the component request lifecycle without a browser or real provider.
function harness(fetchResponse, initialState){
 const current={trip:{id:'trip-1'},days:[],members:[]},states=[],refs=[];let cursor=0,refCursor=0;
 const effects=[];
 const react={useState(initial){const index=cursor++;if(!(index in states))states[index]=index===0?current:initial;return [states[index],value=>{states[index]=typeof value==='function'?value(states[index]):value;}];},useRef(initial){const index=refCursor++;return refs[index]??(refs[index]={current:initial});},useEffect(effect){effects.push(effect);}};
 const jsx=(type,props)=>({type,props});
 const source=ts.transpileModule(readFileSync(new URL('../app/trip/copilot.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 vm.runInNewContext(source,{exports,require(name){if(name==='react')return react;if(name==='react/jsx-runtime')return{jsx,jsxs:jsx};if(name==='../home-state')return{DATA_KEY:'trips'};if(name.includes('trip-context'))return{buildTripContext:()=>current,suggestedQuestions:()=>[]};if(name.includes('member-add.js'))return{memberAddRequest:()=>null};if(name.includes('expense-intent'))return{expenseQuery:()=>null};if(name.includes('proposal-refinement'))return{pendingProposalContexts:()=>[]};return{};},localStorage:{getItem:()=>JSON.stringify({trips:[{id:'trip-1'}]})},crypto:{randomUUID:()=> 'new-answer'},AbortController,setTimeout,clearTimeout,fetch:fetchResponse,process:{env:{NODE_ENV:'test'}}});
 let snapshot;function render(){cursor=0;refCursor=0;effects.length=0;return exports.default({tripId:'trip-1',initialState,onStateChange:state=>{snapshot=state;}});}
 function nodes(node){if(!node||typeof node!=='object')return[];return [node,...[node.props?.children].flat(Infinity).flatMap(nodes)];}
 const tree=render();
 return{states,render,nodes,tree,save(){effects[1]();return snapshot;}};
}
const previous={id:'answer-old',role:'assistant',content:'原回答',proposals:[{id:'proposal-1',status:'pending',type:'move_item'}],requestContext:{},requestHistory:[{role:'user',content:'请调整时间'}]};
const initial={messages:[{id:'question',role:'user',content:'请调整时间'},previous],query:'尚未发送的文字',sessions:[{id:'saved',title:'原会话',createdAt:1,messages:[previous]}],sessionId:'saved'};
function regenerate(h){return h.nodes(h.tree).find(node=>node.type==='button'&&Array.isArray(node.props.children)&&node.props.children.includes('重新生成')).props.onClick();}
test('regeneration failure retains original answer, pending proposal and unsent input',async()=>{
 const h=harness(async()=>{throw Error('offline');},initial);
 const request=regenerate(h);assert.equal(h.states[1][1],previous);await request;
 assert.equal(h.states[1][1],previous);assert.equal(h.states[1][1].proposals[0].status,'pending');assert.equal(h.states[2],initial.query);assert.match(h.states[4],/原回答和调整建议已保留/);
 const retry=h.nodes(h.render()).filter(node=>node.type==='button'&&node.props.children==='重新生成');assert.equal(retry.length,1);
});
test('regeneration success replaces only the answer after the response arrives',async()=>{
 let resolve;const response=new Promise(done=>{resolve=done;});const h=harness(()=>response,initial);
 const request=regenerate(h);assert.equal(h.states[1][1],previous);
 resolve({ok:true,json:async()=>({success:true,data:{reply:'新的回答',proposals:[]}})});await request;
 assert.equal(h.states[1].length,2);assert.equal(h.states[1][0].id,'question');assert.equal(h.states[1][1].content,'新的回答');assert.equal(h.states[2],initial.query);
});
test('page snapshot restores per-trip messages, unsent query and session selection',()=>{
 const h=harness(async()=>{},initial),snapshot=h.save();
 assert.equal(snapshot.messages,initial.messages);assert.equal(snapshot.query,initial.query);assert.equal(snapshot.sessionId,'saved');assert.equal(snapshot.sessions,initial.sessions);
 const restored=harness(async()=>{},snapshot);assert.equal(restored.states[1],initial.messages);assert.equal(restored.states[2],initial.query);assert.equal(restored.save().sessionId,'saved');
});
