const LEVELS = ["All","Beginner","Intermediate","Advanced","Projects"];
const SECTIONS = ["All",...new Set(LESSONS.map(l=>l.ch))];
function parseLine(src){
  const parts=[]; const re=/\[([^\]]+)\]|([^[]+)/g; let m;
  while((m=re.exec(src))){
    if(m[1]!=null) parts.push({slot:true,text:m[1]});
    else parts.push({slot:false,text:m[2]});
  }
  return parts;
}
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function esc(s){ return String(s).replace(/&/g,"&").replace(/</g,"<").replace(/>/g,">"); }
function wordNote(tok){ return COMPILER[tok] || COMPILER[tok.replace(/[()]/g,"")] || (`Compiler treats "`+tok+`" as a name or literal in this slot.`); }
let filterLevel="All", filterSec="All", currentId=null, selectedTile=null;
function visible(){
  return LESSONS.filter(l =>
    (filterLevel==="All" || l.level===filterLevel) &&
    (filterSec==="All" || l.ch===filterSec)
  );
}
function renderHome(){
  document.getElementById("play").classList.add("hidden");
  const home=document.getElementById("home");
  home.classList.remove("hidden");
  document.getElementById("backBtn").classList.add("hidden");
  document.getElementById("hdrTitle").textContent="Tap to Code";
  const list=visible();
  document.getElementById("hdrSub").textContent=done.size+"/"+LESSONS.length+" done · "+list.length+" in this view";
  let html=`<div class="levels">`+LEVELS.map(lv=>`<button class="chip ${filterLevel===lv?"on":""}" data-lv="${lv}">${lv}</button>`).join("")+`</div>`;
  html+=`<div class="sections">`+SECTIONS.map(s=>`<button class="chip ${filterSec===s?"on":""}" data-sec="${s}">${s}</button>`).join("")+`</div>`;
  html+=`<div class="actions" style="margin:0 0 16px"><button type="button" id="exportBtn">Save progress</button><button type="button" id="importBtn">Restore progress</button></div>`;
  html+=`<p class="prompt">Finish a lesson and it checks off automatically. Add this site to your Home Screen so progress stays.</p>`;
  const groups=new Map();
  list.forEach(l=>{ if(!groups.has(l.ch)) groups.set(l.ch,[]); groups.get(l.ch).push(l); });
  for(const [ch,items] of groups){
    html+=`<section class="chapter"><h2>${ch}</h2>`;
    items.forEach(l=>{
      html+=`<button class="lesson-row ${done.has(l.id)?"done":""}" data-id="${l.id}"><div class="num">${done.has(l.id)?"\u2713":"D"+l.day}</div><div><div class="t">${l.title}</div><div class="d">${l.hint}</div></div></button>`;
    });
    html+=`</section>`;
  }
  home.innerHTML=html;
  home.querySelectorAll("[data-lv]").forEach(b=>b.onclick=()=>{ filterLevel=b.dataset.lv; renderHome(); });
  home.querySelectorAll("[data-sec]").forEach(b=>b.onclick=()=>{ filterSec=b.dataset.sec; renderHome(); });
  home.querySelectorAll("[data-id]").forEach(b=>b.onclick=()=>openLesson(b.dataset.id));
  document.getElementById("exportBtn").onclick=exportProgress;
  document.getElementById("importBtn").onclick=importProgress;
}
function openLesson(id){
  currentId=id; selectedTile=null;
  const lesson=LESSONS.find(l=>l.id===id);
  const parsed=lesson.lines.map(parseLine);
  const answers=[];
  parsed.forEach((parts,li)=>parts.forEach((p,pi)=>{ if(p.slot) answers.push({li,pi,text:p.text}); }));
  const tiles=shuffle(answers.map(a=>({text:a.text})));
  const filled=answers.map(()=>null);
  document.getElementById("home").classList.add("hidden");
  const play=document.getElementById("play");
  play.classList.remove("hidden");
  document.getElementById("backBtn").classList.remove("hidden");
  document.getElementById("hdrTitle").textContent=lesson.title;
  document.getElementById("hdrSub").textContent=`Day ${lesson.day} \u00b7 ${lesson.ch} \u00b7 ${lesson.level}`;
  let activeLine=0, lastWrong=null;
  function countFilled(t){ return filled.filter(v=>v===t).length; }
  function tileUsed(i){
    const text=tiles[i].text;
    const my=tiles.slice(0,i+1).filter(t=>t.text===text).length;
    return countFilled(text)>=my;
  }
  function paint(){
    let canvas="";
    parsed.forEach((parts,li)=>{
      canvas+=`<div class="row"><button class="ln ${li===activeLine?"on":""}" data-ln="${li}">${li+1}</button><div class="code">`;
      parts.forEach((p)=>{
        if(!p.slot){ canvas+=`<span class="fixed">${esc(p.text)}</span>`; return; }
        const ans=answers.findIndex(a=>a.li===li&&a.pi===parts.indexOf(p));
        const val=filled[ans];
        const complete=filled.every((v,i)=>v===answers[i].text);
        let cls="slot";
        if(val==null) cls+="";
        else if(complete || val===p.text) cls+= val===p.text?" locked filled":" wrong";
        else cls+=" filled";
        if(lastWrong && lastWrong.ans===ans) cls+=" wrong";
        canvas+=`<button class="${cls}" data-ans="${ans}">${val?esc(val):" "}</button>`;
      });
      canvas+=`</div></div>`;
    });
    let tray="";
    tiles.forEach((t,i)=>{ tray+=`<button class="tile ${tileUsed(i)?"used":""} ${selectedTile===i?"primary":""}" data-tile="${i}">${esc(t.text)}</button>`; });
    const complete=filled.every((v,i)=>v===answers[i].text);
    if(complete){ done.add(lesson.id); save(); }
    const n=lesson.notes?.[activeLine];
    const lineBox=`<div class="panel"><h3>What the compiler does on this line</h3><div class="title">Line ${activeLine+1}</div><p class="${n && /error/i.test(n)?"err":""}">${n?esc(n):"Tap a line number."}</p></div>`;
    const words=[...new Set(answers.filter(a=>a.li===activeLine).map(a=>a.text))];
    let wordTable="<div class=\"panel\"><h3>Each action word on this line</h3><table>";
    if(!words.length) wordTable+="<tr><td>No slots on this line.</td></tr>";
    words.forEach(w=>{ wordTable+=`<tr><td class="tok">${esc(w)}</td><td>${esc(wordNote(w))}</td></tr>`; });
    wordTable+="</table></div>";
    let wrong="";
    if(lastWrong){
      wrong=`<div class="panel"><h3>Wrong place</h3><p class="err">You dropped <b>${esc(lastWrong.got)}</b> where <b>${esc(lastWrong.want)}</b> belongs.</p><p style="margin-top:8px">${esc(wordNote(lastWrong.want))}</p></div>`;
    }
    play.innerHTML=`<p class="prompt">${esc(lesson.hint)} Tap a tile, then a slot. Tap a line number for the compiler note.</p><div class="canvas">${canvas}</div><div class="tray">${tray}</div>${complete?`<div class="win">Slots match.</div>`:""}${lineBox}${wrong}${wordTable}<div class="actions"><button type="button" id="resetBtn">Reset</button><button class="primary" type="button" id="nextBtn">${complete?"Next":"Skip"}</button></div>`;
    play.querySelectorAll("[data-ln]").forEach(el=>el.onclick=()=>{ activeLine=+el.dataset.ln; lastWrong=null; paint(); });
    play.querySelectorAll("[data-tile]").forEach(el=>el.onclick=()=>{ const i=+el.dataset.tile; if(tileUsed(i)) return; selectedTile=i; paint(); });
    play.querySelectorAll("[data-ans]").forEach(el=>el.onclick=()=>{
      const ans=+el.dataset.ans;
      if(filled[ans]!=null){ filled[ans]=null; lastWrong=null; paint(); return; }
      if(selectedTile==null) return;
      const got=tiles[selectedTile].text, want=answers[ans].text;
      if(got!==want){ lastWrong={ans,got,want}; selectedTile=null; paint(); return; }
      filled[ans]=got; lastWrong=null; selectedTile=null; paint();
    });
    play.querySelector("#resetBtn").onclick=()=>{ filled.fill(null); selectedTile=null; lastWrong=null; paint(); };
    play.querySelector("#nextBtn").onclick=()=>{
      const vis=visible();
      const idx=vis.findIndex(l=>l.id===lesson.id);
      if(idx>=0 && idx<vis.length-1) openLesson(vis[idx+1].id);
      else {
        const allIdx=LESSONS.findIndex(l=>l.id===lesson.id);
        if(allIdx<LESSONS.length-1) openLesson(LESSONS[allIdx+1].id);
        else renderHome();
      }
    };
  }
  paint();
}
document.getElementById("backBtn").onclick=renderHome;
renderHome();
